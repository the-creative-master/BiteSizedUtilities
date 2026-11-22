// "It answered one question and then froze on the next."
//
// The cause was structural, not a model: a browser runtime answers one request
// at a time, WLlama only releases its inference slot when *its own* loop ends,
// and nothing in the fallback chain had a timeout — so a walked-away stream
// left the next prompt waiting forever on a busy worker, with the composer
// disabled and no error to show.
//
// These tests run the real queue and the real watchdog with short windows, so
// they finish in milliseconds and need no browser, no network and no model.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  runBrowserInference,
  markInferenceBeat,
  markInferenceToken,
  getInferenceQueueState,
  resetInferenceQueue,
  classifyAiFailure,
  summarizeAiFailures,
  modelSourceFixAdvice,
  AI_STALL_TIMEOUT_MS,
  AI_LOAD_STALL_TIMEOUT_MS,
  AI_ABORT_GRACE_MS
} from '../waffle-browser-ai.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const never = () => new Promise(() => {});

/** Short windows + a fine tick, so a test measures the watchdog, not a minute. */
const FAST = { stallMs: 120, loadStallMs: 400, abortGraceMs: 80, checkMs: 10 };

async function expectRejection(promise) {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new assert.AssertionError({ message: 'expected the attempt to reject, and it resolved' });
}

test('the watchdog windows are the ones the changelog promises, and in the right order', () => {
  assert.equal(AI_STALL_TIMEOUT_MS, 45_000, '45 seconds of silence once text is streaming');
  assert.equal(AI_LOAD_STALL_TIMEOUT_MS, 240_000, 'four minutes before the first token');
  assert.equal(AI_ABORT_GRACE_MS, 5_000, 'five seconds to free the page after Stop');
  assert.ok(AI_ABORT_GRACE_MS < AI_STALL_TIMEOUT_MS, 'Stop is faster than a stall');
  assert.ok(AI_STALL_TIMEOUT_MS < AI_LOAD_STALL_TIMEOUT_MS,
    'loading is allowed to be quiet far longer than replying is');
});

test('only one inference runs at a time, so two callers cannot deadlock a single-slot runtime', async () => {
  resetInferenceQueue();
  const order = [];
  const first = runBrowserInference('first', async () => {
    order.push('first:start');
    await sleep(60);
    order.push('first:end');
    return 'a';
  }, FAST);
  const second = runBrowserInference('second', async () => {
    order.push('second:start');
    return 'b';
  }, FAST);
  const third = runBrowserInference('third', async () => 'c', FAST);

  await sleep(5);             // let the first attempt actually start
  const mid = getInferenceQueueState();
  assert.equal(mid.busy, true, 'one inference is running');
  assert.equal(mid.waiting, 2, 'the two later callers are queued behind it, not running');
  assert.deepEqual(order, ['first:start'], 'and neither of them has begun');

  assert.deepEqual([await first, await second, await third], ['a', 'b', 'c']);
  assert.deepEqual(order, ['first:start', 'first:end', 'second:start'],
    'the second inference did not begin until the first had finished');
  const state = getInferenceQueueState();
  assert.equal(state.busy, false, 'the queue is idle again');
  assert.equal(state.waiting, 0, 'and nothing is left waiting');
});

test('a failed inference does not strand the ones behind it', async () => {
  resetInferenceQueue();
  const boom = await expectRejection(runBrowserInference('boom', () => Promise.reject(new Error('out of memory')), FAST));
  assert.match(boom.message, /out of memory/);
  assert.equal(await runBrowserInference('next', async () => 'recovered', FAST), 'recovered',
    'the chain continues after a rejection');

  const thrown = await expectRejection(runBrowserInference('sync-throw', () => { throw new Error('bad params'); }, FAST));
  assert.match(thrown.message, /bad params/, 'a task that throws before returning a promise is caught too');
  assert.equal(await runBrowserInference('after-sync-throw', async () => 'ok', FAST), 'ok');
});

test('a runtime that stops answering is abandoned instead of freezing the page', async () => {
  resetInferenceQueue();
  const started = Date.now();
  const err = await expectRejection(runBrowserInference('SmolLM2 135M WLlama (CPU WASM)', never, FAST));
  const waited = Date.now() - started;

  assert.ok(waited >= FAST.loadStallMs && waited < FAST.loadStallMs + 500,
    `abandoned after the load window (${waited} ms), not after forever`);
  assert.match(err.message, /SmolLM2 135M WLlama \(CPU WASM\) stopped answering/, 'it names the runtime that died');
  assert.match(err.message, /no progress for [\d.]+s while loading/);
  assert.match(err.message, /abandoned instead of freezing the page/);
  assert.match(err.message, /has been discarded and the next one takes over/);
  assert.ok(!err.message.includes('NaN') && !err.message.includes('undefined'));

  const cls = classifyAiFailure(err);
  assert.equal(cls.kind, 'stall', 'a wedge is its own cause, not a network or model problem');
  assert.match(cls.title, /stopped answering/);
  assert.match(cls.hint, /reload the page/, 'and the hint says what a person can actually do');
});

test('the next prompt still runs after a stall — the freeze was the queue, not the model', async () => {
  resetInferenceQueue();
  await expectRejection(runBrowserInference('wedged', never, { ...FAST, kind: 'wllama' }));

  const state = getInferenceQueueState();
  assert.equal(state.busy, false, 'the abandoned attempt released the queue');
  assert.ok(state.lastStall, 'and recorded what happened');
  assert.equal(state.lastStall.label, 'wedged');
  assert.equal(state.lastStall.kind, 'wllama');
  assert.equal(state.lastStall.phase, 'while loading');
  assert.ok(state.lastStall.idleMs >= FAST.loadStallMs);

  const order = [];
  const answer = await runBrowserInference('the second prompt', async () => {
    order.push('ran');
    return 'here you go';
  }, FAST);
  assert.equal(answer, 'here you go');
  assert.deepEqual(order, ['ran'], 'the second prompt was answered by a working runtime');
});

test('a slow runtime that keeps reporting progress is never killed', async () => {
  resetInferenceQueue();
  const beat = setInterval(() => markInferenceBeat(), 20);
  try {
    const out = await runBrowserInference('slow download', async () => {
      await sleep(500);
      return 'finished';
    }, FAST);
    assert.equal(out, 'finished', 'five times the stall window, and still running, because it was alive');
  } finally {
    clearInterval(beat);
  }
});

test('one token switches the watchdog to the stricter streaming window', async () => {
  resetInferenceQueue();
  const started = Date.now();
  const attempt = runBrowserInference('streaming then silent', never, FAST);
  await sleep(30);            // the attempt has started
  markInferenceToken();       // text arrived once, then the runtime went quiet
  const err = await expectRejection(attempt);
  const waited = Date.now() - started;

  assert.ok(waited < FAST.loadStallMs,
    `cut off at ${waited} ms by the streaming window (${FAST.stallMs} ms), not the loading one (${FAST.loadStallMs} ms)`);
  assert.match(err.message, /no output for [\d.]+s after it started replying/);
  assert.equal(getInferenceQueueState().lastStall.phase, 'after it started replying');
});

test('Stop frees the page in seconds even when the runtime ignores the signal', async () => {
  resetInferenceQueue();
  const ctrl = new AbortController();
  const attempt = runBrowserInference('wedged ONNX', never, { ...FAST, signal: ctrl.signal });
  await sleep(30);
  ctrl.abort();               // ONNX generate() has no abort at all
  const started = Date.now();
  const err = await expectRejection(attempt);
  const waited = Date.now() - started;

  assert.equal(err.name, 'AbortError', 'a Stop the runtime ignored is still reported as a Stop');
  assert.match(err.message, /did not stop when asked/);
  assert.ok(waited < FAST.stallMs,
    `freed after the abort grace (${waited} ms), well before the ${FAST.stallMs} ms stall window`);
  assert.equal(getInferenceQueueState().lastStall.stopped, true);
  assert.equal(getInferenceQueueState().busy, false, 'and the queue is free for the next question');
});

test('a stall is ranked and explained like the other causes', () => {
  const stall = classifyAiFailure(new Error('Qwen 2.5 1.5B ONNX (WEBGPU) stopped answering — no output for 45s after it started replying'));
  assert.equal(stall.kind, 'stall');

  // A chain that failed in mixed ways leads with the most informative cause.
  const mixed = summarizeAiFailures([
    classifyAiFailure(new Error('Failed to fetch')),
    stall,
    classifyAiFailure(new Error('Failed to fetch'))
  ]);
  assert.equal(mixed.count, 3);
  assert.equal(mixed.uniform, false);
  assert.equal(mixed.kind, 'network', 'two network failures outvote one wedge');

  const allStalled = summarizeAiFailures([stall, stall]);
  assert.equal(allStalled.kind, 'stall');
  assert.equal(allStalled.uniform, true);

  // The source report is fine, so the fix line points at the runtime.
  const facts = { id: 'smollm2-135m', gguf: { status: 'ok', wouldLoad: { bytes: 1024 }, budgetBytes: 0 } };
  assert.match(modelSourceFixAdvice(facts, stall), /wedged mid-reply/);
  assert.match(modelSourceFixAdvice(facts, stall), /reload the page/);
  assert.equal(modelSourceFixAdvice(facts, classifyAiFailure(new Error('something odd'))), null,
    'an unknown cause still gets no invented advice');
});

test('both engines feed the watchdog, and neither reuses a runtime that was walked away from', () => {
  const src = fs.readFileSync('waffle-browser-ai.js', 'utf8');

  assert.match(src, /abortSignal: signal/, 'WLlama gets our signal, so Stop releases its inference slot');
  assert.match(src, /Wllama only releases the request slot when \*its\* loop ends/, 'and the reason is written down');

  const wllama = src.slice(src.indexOf('export async function streamWllamaChat'));
  assert.match(wllama, /if \(wllamaInstance && !wllamaDirty && wllamaLoadedFile ===/,
    'a dirty instance is never handed to the next prompt');
  assert.match(wllama, /} else if \(wllamaInstance && wllamaDirty\) \{\s*\n\s*\/\/[\s\S]{0,200}?\n\s*await disposeWllama\(\);/,
    'it is thrown away instead');
  assert.match(wllama, /wllamaDirty = true;[\s\S]{0,200}?if \(err\?\.name === 'AbortError'/,
    'abandoning a stream marks the instance dirty');
  assert.match(wllama, /wllamaDirty = false;\s*\n\s*return stripModelScaffolding\(acc/, 'a finished reply makes it reusable again');
  assert.match(wllama, /markInferenceToken\(\);/, 'tokens keep the watchdog fed');
  assert.match(wllama, /progressCallback\(\{ loaded, total \}\) \{\s*\n\s*markInferenceBeat\(\);/,
    'and so does download progress');

  const ort = src.slice(src.indexOf('export async function streamBrowserChat'));
  assert.match(ort, /callback_function\(text\) \{\s*\n\s*markInferenceToken\(\);/, 'ONNX tokens feed it too');
  const loader = src.slice(src.indexOf('async function getBrowserGenerator'), src.indexOf('export async function streamBrowserChat'));
  assert.match(loader, /const progress_callback = p => \{\s*\n\s*markInferenceBeat\(\);/, 'as does the model download');
});

test('every engine attempt in the chat runs through the queue and the watchdog', () => {
  const src = fs.readFileSync('waffle-ai.js', 'utf8');
  assert.match(src, /runBrowserInference,\s*\n\s*markInferenceBeat,\s*\n\s*markInferenceToken/, 'the chat imports the guard');

  const loopStart = src.indexOf('for (let i = 0; i < attempts.length; i++)');
  assert.ok(loopStart > 0, 'the fallback chain is still a loop over attempts');
  // `hasImages` is branched on twice in this function; the slice has to end at
  // the one *after* the loop, or it comes back empty and every pin below is
  // vacuously about nothing.
  const chain = src.slice(loopStart, src.indexOf('if (hasImages) {', loopStart));
  assert.ok(chain.length > 500, `the slice really covers the dispatch (${chain.length} chars)`);
  assert.match(chain, /const text = await runBrowserInference\(stepLabel, \(\) => \{/,
    'one wrapper around the whole dispatch');
  assert.match(chain, /\}, \{ kind: step\.kind, signal \}\);/, 'which knows the runtime kind and the abort signal');
  for (const engine of ['streamServerChat', 'streamWllamaChat', 'streamBrowserChat']) {
    const at = chain.indexOf(engine);
    assert.ok(at > 0, `${engine} is still dispatched`);
    assert.ok(chain.indexOf('runBrowserInference') < at, `${engine} is dispatched inside the guard`);
    assert.match(chain.slice(at, at + 400), /onStatus: beatStatus, onToken: beatToken/,
      `${engine} reports liveness through the beating callbacks`);
  }
  assert.match(chain, /const beatToken = \(chunk, acc\) => \{ markInferenceToken\(\); onToken\?\.\(chunk, acc\); \};/,
    'a token switches to the strict window without swallowing the UI callback');
  assert.match(chain, /return report\(step, engineName, text\);/, 'and the answer is still reported the same way');
});
