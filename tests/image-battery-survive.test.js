/**
 * A long first run against a battery optimiser.
 *
 * The complaint this pins: "battery optimization is constantly killing my image
 * gen. I turned battery optimization off but chrome keeps on aw snapping."
 *
 * Two things happen to a tab running a multi-gigabyte download and a GPU
 * denoise, and they are not the same thing:
 *
 *   - the tab is *frozen*: an OEM power manager suspends a background tab's
 *     timers. Nothing runs, so the bar stops. Switching battery optimisation off
 *     for Chrome does not reliably stop this, because the decision is about the
 *     tab, and a tab with the screen off is a background tab however the app is
 *     classified.
 *   - the renderer or the GPU process is *killed*: Chrome prints "Aw, Snap!". No
 *     JavaScript survives to explain anything, and the tab that comes back has
 *     lost the conversation it was showing.
 *
 * Neither can be prevented from inside a page. What can be done, and what these
 * tests hold in place:
 *
 *   1. ask for the screen, which is the one signal power managers consistently
 *      respect, and ask again after the system takes it away;
 *   2. say plainly when a browser has no screen lock to give, instead of implying
 *      a protection that does not exist;
 *   3. treat a lost GPU as the end of that run and of that engine, so the retry
 *      asks for a device that works instead of reusing a dead one;
 *   4. race the loss against the generation, so a run whose device is gone fails
 *      in words rather than holding a bar still forever;
 *   5. write down what was in flight before the first byte, so a killed tab can
 *      come back and offer to finish it;
 *   6. never move the bar backwards because of any of this.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  screenLockSupported,
  screenLockState,
  holdScreenForRun,
  releaseScreenLock,
  progressFromEvent,
  newProgressState,
  explainFailure,
  gpuLostState,
  clearGpuLost
} from '../waffle-image-gen.js';

const engineSrc = fs.readFileSync(path.join(process.cwd(), 'waffle-image-gen.js'), 'utf8');
const aiSrc = fs.readFileSync(path.join(process.cwd(), 'waffle-ai.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(process.cwd(), 'app.js'), 'utf8');
const styleSrc = fs.readFileSync(path.join(process.cwd(), 'style.css'), 'utf8');

// --- a browser that can be told to hold the screen on --------------------------

let requests = 0;
let releases = 0;
let nextRequestFails = false;
let visibilityHandler = null;

function installWakeLock({ supported = true } = {}) {
  const listeners = [];
  const sentinel = {
    released: false,
    addEventListener: (kind, fn) => { if (kind === 'release') listeners.push(fn); },
    release: async () => { sentinel.released = true; releases += 1; }
  };
  const nav = {
    ...(supported ? { wakeLock: { request: async type => {
      requests += 1;
      assert.equal(type, 'screen', 'screen is the only lock a page may ask for');
      if (nextRequestFails) throw new DOMException('NotAllowedError', 'NotAllowedError');
      return sentinel;
    } } } : {}),
    userAgent: 'test'
  };
  Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'document', {
    value: { hidden: false, addEventListener: (kind, fn) => { if (kind === 'visibilitychange') visibilityHandler = fn; } },
    configurable: true, writable: true
  });
  return { sentinel, fireRelease: () => listeners.forEach(fn => fn()) };
}

function resetCounters() { requests = 0; releases = 0; nextRequestFails = false; }

test('a run asks for the screen, and gives it back when it is over', async () => {
  resetCounters();
  installWakeLock();
  releaseScreenLock();
  assert.equal(screenLockState().held, false, 'nothing held before a run');
  const got = await holdScreenForRun();
  assert.equal(got, true, 'the sentinel came back');
  assert.equal(requests, 1, 'exactly one request');
  assert.deepEqual(screenLockState(), { supported: true, held: true, wanted: true },
    'and the state says what it is actually doing');
  releaseScreenLock();
  assert.equal(releases, 1, 'released, because a finished run has no business holding a screen on');
  assert.deepEqual(screenLockState(), { supported: true, held: false, wanted: false });
});

test('the screen is asked for again after the system takes it away', async () => {
  resetCounters();
  const { sentinel, fireRelease } = installWakeLock();
  releaseScreenLock();
  await holdScreenForRun();
  assert.equal(requests, 1);
  // Hiding the page is what drops the sentinel, and the run is still going.
  fireRelease();
  assert.equal(sentinel.released, false, 'the sentinel itself does not mark released on a system drop');
  await new Promise(r => setTimeout(r, 0));
  assert.equal(requests, 2, 'so it is asked for again without waiting to be told');
  assert.equal(screenLockState().held, true);
  releaseScreenLock();
});

test('a browser with no screen lock is told so, rather than left to assume one', async () => {
  resetCounters();
  installWakeLock({ supported: false });
  releaseScreenLock();
  assert.equal(screenLockSupported(), false);
  const got = await holdScreenForRun();
  assert.equal(got, false, 'asking for something that does not exist is not a held lock');
  assert.equal(requests, 0, 'and nothing was requested');
  assert.deepEqual(screenLockState(), { supported: false, held: false, wanted: true },
    'the state still records that a run wanted one — that is the honest claim');
});

test('a refused screen lock does not throw the run away', async () => {
  resetCounters();
  installWakeLock();
  nextRequestFails = true;
  releaseScreenLock();
  const got = await holdScreenForRun();
  assert.equal(got, false, 'NotAllowedError is the usual one: the page was hidden, or the browser refused');
  assert.equal(screenLockState().held, false);
  releaseScreenLock();
});

test('a run says which of the three situations it is in, in the words of that situation', () => {
  // The note is built in generateWaffleImage and rides along on the very first
  // progress report, which is the only message guaranteed to be on screen before
  // anything can go wrong.
  const notes = engineSrc.slice(
    engineSrc.indexOf('const lockNote = lockHeld'),
    engineSrc.indexOf('onProgress?.({', engineSrc.indexOf('const lockNote = lockHeld'))
  );
  assert.match(notes, /The screen is being held on for as long as this runs\./, 'held: said plainly');
  assert.match(notes, /The screen lock was refused, so keep this tab on screen/, 'refused: the workaround, not a shrug');
  assert.match(notes, /This browser offers no screen lock/, 'unsupported: no implied protection');
  assert.match(notes, /a hidden tab is the one thing that will pause this run/,
    'and the reason is the tab, which is why exempting the app does not fix it');
  assert.ok(engineSrc.indexOf('const lockHeld = await holdScreenForRun();') < engineSrc.indexOf('res = await Promise.race(['),
    'asked for before the first byte: by the time a run stalls, nothing may be left running to ask');
});

test('a lost GPU ends the run and drops the engine, so the next one can work', () => {
  // The library emits `{ stage: 'warning', detail: { code: 'device-lost' } }` when
  // device.lost resolves, and carries on. Nothing in the kitchen used to notice.
  const hook = engineSrc.slice(engineSrc.indexOf('onEvent: ev => {'), engineSrc.indexOf('reportProgress(ev, progressSink);\n    }'));
  assert.match(hook, /isDeviceLostEvent\(ev\)/, 'the engine hook recognises it');
  assert.match(hook, /settleGpuLost\(/, 'ends every run waiting on that device');
  assert.match(hook, /releaseImageEngine\(\)/,
    'and drops the engine — keeping it would hand the same dead device to every later attempt until the page was reloaded');
  assert.match(engineSrc, /export function gpuLostState\(\)/, 'the reason is readable afterwards');
  assert.match(engineSrc, /clearGpuLost\(\);\n  const lockHeld/, 'and forgotten when a new run starts');
});

test('a run races the loss, because a dead device may never resolve', () => {
  assert.match(engineSrc, /res = await Promise\.race\(\[/, 'the generation is raced');
  assert.match(engineSrc, /const lost = raceGpuLoss\(\);\n    \/\/ The race may never pick it/,
    'against a promise that rejects the moment the GPU reports itself gone');
  assert.match(engineSrc, /lost\.catch\(\(\) => \{\}\);/,
    'with the losing rejection swallowed, or node reports an unhandled one');
  assert.match(engineSrc, /gpuLostWaiters = \[\];\n  \}/, 'and the waiters cleared when the run is over');
});

test('a lost GPU is put into words that name the cause and the way out', () => {
  const err = new Error('GPU device lost (out of memory). The weights already downloaded are kept.');
  err.code = 'gpu-lost';
  const said = explainFailure(err, { mode: 'desktop', side: 768 });
  assert.equal(said.code, 'gpu-lost', 'coded, so the panel can tell this from a refusal');
  assert.match(said.message, /The GPU went away mid-run at 768×768/, 'what happened, with the size it happened at');
  assert.match(said.message, /the system took it back/, 'who did it');
  assert.match(said.message, /weights already in this browser are kept, so trying again does not re-download them/,
    'what it cost — the download is not the part that is lost');
  assert.match(said.message, /the phone build in Settings keeps far less memory resident/,
    'and the lever that actually changes the odds');
  // The same words arrive when the library throws rather than warns.
  const thrown = explainFailure(new Error('device-lost: buffer destroyed'), { mode: 'mobile', side: 512 });
  assert.equal(thrown.code, 'gpu-lost');
  const noSide = explainFailure(new Error('device-lost'), { mode: 'mobile', side: 0 });
  assert.doesNotMatch(noSide.message, /at 0×0/, 'a side of 0 is not printed as a size');
});

test('a warning does not pull the bar backwards, and a device loss is named', () => {
  const state = newProgressState(0);
  // A run already 61% through a download.
  const mid = progressFromEvent({ stage: 'weights', detail: { shard: 2, shards: 3, loaded: 500, total: 1100 } }, state, 5_000);
  assert.ok(mid.percent > 30 && mid.percent < 78, `the run is mid-download (${mid.percent}%)`);
  const warn = progressFromEvent({ stage: 'warning', detail: { code: 'device-lost', text: 'GPU device lost' } }, state, 6_000);
  assert.equal(warn.percent, mid.percent, 'the percent is held: a run does not become 1% because the GPU said something');
  assert.equal(warn.indeterminate, true, 'and it is not presented as measured');
  assert.match(warn.stage, /The GPU went away/, 'named, where the old label was just "Warning"');
  // A benign warning gets a label worth reading too, and still holds.
  const benign = progressFromEvent({ stage: 'warning', detail: { code: 'no-f16', text: 'no shader-f16' } }, state, 7_000);
  assert.equal(benign.percent, mid.percent);
  assert.equal(benign.stage, 'Heads up');
});

test('a paused tab is reported as paused, by a clock that cannot be faked', () => {
  // The ticker measures its own gap. A one-second timer that took three minutes to
  // fire was not busy: the tab was throttled, frozen, or discarded and restored.
  const tick = aiSrc.slice(aiSrc.indexOf('let lastTickAt = Date.now();'), aiSrc.indexOf('renderMessages();\n  }, 1000);'));
  assert.match(tick, /if \(gap > 5_000\) suspendedMs \+= gap - 1_000;/,
    'the paused time is counted, minus the second the timer was owed');
  assert.match(tick, /\{ \.\.\.stampElapsed\(cur\), suspendedMs \}/, 'and carried on the report');
  assert.match(aiSrc, /p\.suspendedMs \? `the system paused this tab for \$\{humanDuration\(p\.suspendedMs\)\}` : ''/,
    'so the facts line says the system did it, instead of a bar standing still and saying nothing');
});

test('what was in flight is written down before the first byte', () => {
  assert.match(aiSrc, /const IMAGE_RUN_KEY = 'waffle-ai-image-run-v1';/, 'under a versioned key');
  const noted = aiSrc.indexOf('noteImageRun({ prompt: displayPrompt');
  assert.ok(noted > aiSrc.indexOf('function runImageGeneration'), 'noted by the run itself');
  assert.ok(noted < aiSrc.indexOf('generateWaffleImage(', noted), 'and before anything can be killed');
  assert.match(aiSrc, /clearImageRun\(\);\n    if \(progressTicker\)/, 'cleared in the finally, so a finished run leaves nothing behind');
  assert.match(aiSrc, /const IMAGE_RUN_MAX_AGE_MS = 12 \* 60 \* 60 \* 1000;/,
    'with an expiry: a run cut off yesterday is not news today');
});

test('a tab that comes back offers to finish, and says the download survived', () => {
  const offer = aiSrc.slice(aiSrc.indexOf('function offerCutOffRun()'), aiSrc.indexOf('async function runImageGeneration'));
  assert.match(offer, /if \(isGenerating\) return;/, 'never over a run that is live');
  assert.match(offer, /if \(messages\.some\(m => m\.imageCutOff\)\) return;/, 'and never twice');
  assert.match(offer, /The weights it had already downloaded are still in this browser, so trying again does not start from nothing\./,
    'the cost of the interruption is stated, because it is the part that matters');
  assert.match(offer, /the freeze is about the tab and not the app/,
    'and so is the reason turning battery optimisation off did not stop it');
  assert.match(offer, /It was running the desktop build, which keeps roughly 4 GB resident/,
    'with the specific advice for the build that gets killed');
  assert.match(aiSrc, /offerCutOffRun\(\);\n  \}\)\.catch\(\(\) => \{/,
    'offered after the saved conversation is swapped in, on the failure path too');
});

test('the offer is a button that runs again, not a message to read', () => {
  assert.match(aiSrc, /data-img-resume="\$\{idx\}"[^>]*>▶ Run it again</, 'resume, labelled as what it does');
  assert.match(aiSrc, /data-img-dismiss="\$\{idx\}"/, 'and dismiss, because a notice that cannot be cleared is clutter');
  const resume = aiSrc.slice(aiSrc.indexOf("feed.querySelectorAll('[data-img-resume]')"), aiSrc.indexOf("feed.querySelectorAll('[data-img-dismiss]')"));
  assert.match(resume, /if \(!cut \|\| isGenerating\) return;/, 'guarded against a double tap');
  assert.match(resume, /messages\.splice\(at, 1\);\n      runImageGeneration\(cut\.prompt, cut\.prompt, false\)/,
    'the notice goes and the run comes back in the same place — enhance is off, so the prompt is the one that was lost');
  assert.match(aiSrc, /class="waffle-img-cut"/, 'and marked up as its own card');
  assert.match(styleSrc, /\.waffle-img-cut \{/, 'styled in the same card family as the progress bar');
});

test('whether a run can be protected at all is a device fact, not a footnote', () => {
  const fact = /screen lock: held while a picture generates/;
  const absent = /screen lock: not available in this browser, so a hidden tab can be paused mid-run/;
  assert.match(aiSrc, fact, 'the AI panel says so when it can');
  assert.match(aiSrc, absent, 'and when it cannot');
  assert.match(appSrc, fact, 'Settings says the same thing');
  assert.match(appSrc, absent);
  assert.ok(appSrc.indexOf('screenLockState()') > appSrc.indexOf('function paintDeviceFacts'),
    'read at paint time, so it reflects the browser this page is running in');
});

test('nothing here promises a protection the page cannot deliver', () => {
  // Comments wrap at 78 columns and carry a ` * ` prefix on every continuation
  // line, so a phrase spanning a break has to be matched with both removed.
  const flatEngine = engineSrc.replace(/^\s*\* ?/gm, '').replace(/\s+/g, ' ');
  // The failure mode this whole release is about is a surface that implies more
  // control than it has. These are the claims that must not appear.
  for (const src of [engineSrc, aiSrc]) {
    assert.doesNotMatch(src, /battery optimisation (is|has been) (fixed|disabled|handled)/i, 'no "fixed"');
    assert.doesNotMatch(src, /will never be (paused|killed|interrupted)/i, 'no "never"');
    assert.doesNotMatch(src, /prevents? (the )?(system|OS|android) from/i, 'a page cannot prevent the system from anything');
  }
  assert.match(flatEngine, /no JavaScript is running to move the bar, so the bar simply stops/,
    'what is said instead: the mechanism, and its limits');
  assert.match(flatEngine, /Where the API does not exist — and on some Huawei builds it does not — nothing here can help/,
    'including the case where none of this applies');
});

test('gpuLostState reports what happened, and clears for the next run', () => {
  clearGpuLost();
  assert.equal(gpuLostState(), '', 'clean to start');
  assert.equal(typeof gpuLostState, 'function');
  assert.equal(typeof clearGpuLost, 'function');
  // The settle path is driven by an engine event, which needs a real GPU to fire;
  // what is pinned here is that the state is readable and resettable from outside,
  // which is what the panel and the recovery message depend on.
  assert.match(engineSrc, /function settleGpuLoss\(reason\) \{\n  gpuLostReason = reason;/, 'set by the loss');
});
