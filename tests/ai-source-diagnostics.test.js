// The extended half of a Waffle AI failure: the facts fetched live from Hugging
// Face (and from this host) that turn "Failed to fetch" into something a person
// can fix.
//
// Every test here injects its own fetch, because the point of the feature is
// that it reports what the *real* host said — so the assertions are on the
// numbers that came back, never on invented ones.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  TEXT_MODELS,
  fetchModelSourceFacts,
  describeModelSourceFacts,
  modelSourceFixAdvice,
  reconcileAiFailureWithFacts,
  clearModelSourceFactsCache,
  sourceStatus,
  fmtBytes,
  HF_DIAG_TIMEOUT_MS
} from '../waffle-browser-ai.js';

const MB = 1024 * 1024;
const GB = 1024 * MB;

const CFG = {
  id: 'smollm2-135m',
  label: 'SmolLM2 135M',
  hfId: 'HuggingFaceTB/SmolLM2-135M-Instruct-ONNX',
  hfIdAlts: ['onnx-community/SmolLM2-135M-Instruct'],
  hfGgufRepo: 'bartowski/SmolLM2-135M-Instruct-GGUF',
  hfGgufQuant: 'Q3_K_L',
  ggufFile: 'smollm2-135m.gguf',
  ggufMB: 70
};

/* ---------------------------------- fakes ---------------------------------- */

const headers = map => ({ get: k => (map[String(k).toLowerCase()] ?? null) });
const jsonResponse = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: headers({}),
  json: async () => data
});
const bareResponse = (status, hdrs = {}) => ({ ok: status >= 200 && status < 300, status, headers: headers(hdrs) });

/** A fetch stub driven by [url-substring, handler] pairs, first match wins. */
function fakeFetch(routes, calls = []) {
  return async (url, init = {}) => {
    calls.push({ url: String(url), method: init?.method || 'GET', range: init?.headers?.Range || null });
    for (const [match, handler] of routes) {
      if (String(url).includes(match)) return handler(String(url), init);
    }
    throw new Error(`unexpected URL in test: ${url}`);
  };
}

const metaOf = extra => jsonResponse(Object.assign({
  siblings: [{ rfilename: 'README.md' }],
  lastModified: '2026-09-04T10:11:12.000Z',
  downloads: 4242,
  likes: 17,
  sha: 'deadbeef'
}, extra));

/** Tree entries the way Hugging Face returns them: LFS files carry both sizes. */
const treeOf = files => jsonResponse(files.map(([p, pointerBytes, realBytes]) => ({
  type: 'file',
  path: p,
  size: pointerBytes,
  lfs: realBytes === undefined ? undefined : { size: realBytes, oid: 'abc' }
})));

const localMissing = ['api/waffle-ai/gguf', () => bareResponse(404)];

/**
 * One byte of a model file, the way the CDN answers it: the redirect has
 * already happened by the time the response comes back, so `url` is the CDN and
 * the real total arrives in Content-Range.
 */
const downloadResponse = (bytes, { status = 206, host = 'cdn-lfs-us-1.hf.co', url = null } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  url: url || `https://${host}/lfs/objects/abc123`,
  headers: headers(status === 206
    ? { 'content-range': `bytes 0-0/${bytes}` }
    : { 'content-length': String(bytes) })
});
const downloadRoute = (bytes, opts) => ['resolve/main', () => downloadResponse(bytes, opts)];
/** A scenario that says nothing about the file gets a healthy CDN. */
const DEFAULT_DOWNLOAD = downloadRoute(Math.round(68.4 * MB));

async function diagnose(routes, opts = {}) {
  const { model = CFG, classified = null, ...rest } = opts;
  clearModelSourceFactsCache();
  const calls = [];
  // Appended last, so a scenario that cares about the file probe overrides it
  // and every other scenario still gets a consistent, healthy download.
  const facts = await fetchModelSourceFacts(model, {
    fetchImpl: fakeFetch([...routes, DEFAULT_DOWNLOAD], calls),
    timeoutMs: 800,
    ...rest
  });
  return { facts, calls, lines: describeModelSourceFacts(facts), fix: modelSourceFixAdvice(facts, classified) };
}

/* ============================== status and sizes ============================== */

test('HTTP statuses are mapped onto causes worth acting on', () => {
  assert.equal(sourceStatus(200, null), 'ok');
  assert.equal(sourceStatus(206, null), 'ok');
  assert.equal(sourceStatus(401, null), 'restricted');
  assert.equal(sourceStatus(403, null), 'restricted');
  assert.equal(sourceStatus(404, null), 'not-found');
  assert.equal(sourceStatus(410, null), 'not-found');
  assert.equal(sourceStatus(429, null), 'rate-limited');
  assert.equal(sourceStatus(500, null), 'server-error');
  assert.equal(sourceStatus(503, null), 'server-error');
  assert.equal(sourceStatus(null, 'timeout'), 'timeout');
  assert.equal(sourceStatus(null, 'unreachable'), 'unreachable');
  assert.equal(sourceStatus(null, 'aborted'), 'aborted');
  assert.equal(sourceStatus(418, null), 'http-418', 'an unrecognised status is reported, not guessed at');
});

test('sizes are printed the way a person reads them, and never as a lie', () => {
  assert.equal(fmtBytes(0), 'unknown size');
  assert.equal(fmtBytes(NaN), 'unknown size');
  assert.equal(fmtBytes(-5), 'unknown size');
  assert.equal(fmtBytes(70 * MB), '70.0 MB');
  assert.equal(fmtBytes(Math.round(68.4 * MB)), '68.4 MB');
  assert.equal(fmtBytes(1.86 * GB), '1.86 GB');
});

/* ============================== the healthy path ============================== */

test('a healthy repo reports the file the loader would really take, at its real size', async () => {
  const { facts, lines } = await diagnose([
    ['/tree/main', () => treeOf([
      ['SmolLM2-135M-Instruct-Q3_K_L.gguf', 134, Math.round(68.4 * MB)],
      ['SmolLM2-135M-Instruct-Q8_0.gguf', 134, Math.round(145.9 * MB)],
      ['mmproj-model-f16.gguf', 134, Math.round(50 * MB)]
    ])],
    ['/api/models/bartowski', () => metaOf({ gated: false, private: false })],
    ['/api/models/HuggingFaceTB', () => metaOf({ siblings: [{ rfilename: 'onnx/model_q4.onnx' }] })],
    localMissing
  ]);

  assert.equal(facts.gguf.status, 'ok');
  assert.equal(facts.gguf.http, 200);
  assert.equal(facts.gguf.gated, false);
  assert.equal(facts.gguf.lastModified, '2026-09-04T10:11:12.000Z');
  assert.equal(facts.gguf.wouldLoad.path, 'SmolLM2-135M-Instruct-Q3_K_L.gguf');
  assert.equal(facts.gguf.wouldLoad.bytes, Math.round(68.4 * MB),
    'the real LFS size is quoted, not the 134-byte pointer');
  assert.equal(facts.gguf.ggufCount, 2, 'the mmproj sidecar is not counted as a model');
  assert.equal(facts.onnx.hasOnnxWeights, true);

  const text = lines.join('\n');
  assert.match(text, /bartowski\/SmolLM2-135M-Instruct-GGUF — HTTP 200, reachable/);
  assert.match(text, /last modified 2026-09-04/);
  assert.match(text, /2 GGUF file\(s\) in it/);
  assert.match(text, /68\.4 MB/, 'the report carries the real byte size');
  assert.ok(!text.includes('134'), 'and never the LFS pointer size');
  assert.match(text, /the budget is honest/, 'a correct size guess in the model table says so');
  assert.ok(!text.includes('NaN') && !text.includes('undefined'), 'no half-built numbers');
  assert.equal(modelSourceFixAdvice(facts, { kind: 'network' }), null, 'a healthy source needs no fix line');
});

test('the quant chain in the report is the one the loader actually walks', async () => {
  const { facts, lines } = await diagnose([
    ['/tree/main', () => treeOf([
      ['SmolLM2-135M-Instruct-Q4_K_M.gguf', 134, Math.round(72.1 * MB)],
      ['SmolLM2-135M-Instruct-Q8_0.gguf', 134, Math.round(145.9 * MB)]
    ])],
    ['/api/models/bartowski', () => metaOf({})],
    ['/api/models/HuggingFaceTB', () => metaOf({})],
    localMissing
  ]);

  assert.equal(facts.gguf.status, 'ok', 'Q3_K_L is absent but the preset chain reaches Q4_K_M');
  assert.ok(facts.gguf.quantsTried.length >= 2, 'the whole preset chain is reported');
  assert.equal(facts.gguf.quantsTried[0], CFG.hfGgufQuant, 'starting with the quant the model table asks for');
  assert.equal(facts.gguf.wouldLoad.path, 'SmolLM2-135M-Instruct-Q4_K_M.gguf');
  const chain = lines.find(l => l.startsWith('Quant asked for:'));
  assert.ok(chain.includes(' → '), 'the report shows the order the loader tried');
  assert.ok(chain.includes('Q4_K_M'), 'and which one it landed on');
});

/* ============================== the broken paths ============================== */

test('a repo that no longer exists is reported as gone, with the line to change', async () => {
  const { facts, lines, fix } = await diagnose([
    ['/api/models/bartowski', () => jsonResponse({ error: 'Repository not found' }, 404)],
    ['/api/models/HuggingFaceTB', () => jsonResponse({ error: 'Repository not found' }, 404)],
    ['api/waffle-ai/gguf', () => bareResponse(200, { 'content-length': String(Math.round(70 * MB)) })]
  ], { classified: { kind: 'network' } });

  assert.equal(facts.gguf.status, 'not-found');
  assert.equal(facts.gguf.http, 404);
  assert.equal(facts.gguf.error, 'Repository not found');
  assert.equal(facts.selfHosted.status, 'present');
  assert.equal(facts.selfHosted.bytes, Math.round(70 * MB));

  const text = lines.join('\n');
  assert.match(text, /HTTP 404, does not exist/);
  assert.match(text, /Hugging Face said: Repository not found/);
  assert.match(text, /This site is serving the model itself/, 'and it says when the local copy would have worked');
  assert.match(fix, /hfGgufRepo/);
  assert.match(fix, /TEXT_MODELS in waffle-browser-ai\.js \(entry "smollm2-135m"\)/, 'the fix names the file and the entry');
});

test('a gated repo is reported as gated, because a browser can never accept the licence', async () => {
  const { facts, fix } = await diagnose([
    ['/api/models/bartowski', () => jsonResponse({ error: 'You must be logged in' }, 401)],
    ['/api/models/HuggingFaceTB', () => jsonResponse({ error: 'gated' }, 401)],
    localMissing
  ]);
  assert.equal(facts.gguf.status, 'restricted');
  assert.match(fix, /gated or private repository can never load from a public page/);
  assert.match(fix, /scripts\/fetch-model\.mjs/, 'and points at the self-hosting script');

  // Hugging Face also answers 200 with gated:true for some repos.
  const gated = await diagnose([
    ['/tree/main', () => treeOf([['m-Q3_K_L.gguf', 134, Math.round(68 * MB)]])],
    ['/api/models/bartowski', () => metaOf({ gated: 'manual' })],
    ['/api/models/HuggingFaceTB', () => metaOf({})],
    localMissing
  ]);
  assert.equal(gated.facts.gguf.status, 'restricted', 'a 200 with gated:true is still refused');
  assert.equal(gated.facts.gguf.gated, true);
  assert.match(gated.lines.join('\n'), /gated: the licence has to be accepted with an account/);

  const priv = await diagnose([
    ['/api/models/bartowski', () => metaOf({ private: true })],
    ['/api/models/HuggingFaceTB', () => metaOf({})],
    localMissing
  ]);
  assert.equal(priv.facts.gguf.status, 'restricted');
  assert.equal(priv.facts.gguf.isPrivate, true);
  assert.match(priv.lines.join('\n'), /private, so it is invisible to an unauthenticated browser/);
});

test('rate limiting is named as rate limiting, not as a broken model', async () => {
  const { facts, fix } = await diagnose([
    ['/api/models/bartowski', () => jsonResponse({ error: 'Too many requests' }, 429)],
    ['/api/models/HuggingFaceTB', () => jsonResponse({ error: 'Too many requests' }, 429)],
    localMissing
  ]);
  assert.equal(facts.gguf.status, 'rate-limited');
  assert.match(fix, /rate-limiting this IP/);
  assert.match(describeModelSourceFacts(facts).join('\n'), /429/);
});

test('a quantization nobody publishes lists what IS there and picks the closest file', async () => {
  const { facts, lines, fix } = await diagnose([
    ['/tree/main', () => treeOf([
      ['SmolLM2-135M-Instruct-IQ2_XXS.gguf', 134, Math.round(44 * MB)],
      ['SmolLM2-135M-Instruct-Q4_K_M.gguf', 134, Math.round(72.1 * MB)],
      ['SmolLM2-135M-Instruct-Q8_0.gguf', 134, Math.round(145.9 * MB)]
    ])],
    ['/api/models/bartowski', () => metaOf({})],
    ['/api/models/HuggingFaceTB', () => metaOf({})],
    localMissing
  ], { quants: ['Q9_K_S'], classified: { kind: 'model' } });

  assert.equal(facts.gguf.status, 'quant-missing');
  assert.equal(facts.gguf.wouldLoad, null);
  assert.equal(facts.gguf.availableQuants.length, 3);
  assert.deepEqual(facts.gguf.availableQuants.map(q => q.quant), ['IQ2_XXS', 'Q4_K_M', 'Q8_0'], 'smallest first');
  assert.equal(facts.gguf.suggested.path, 'SmolLM2-135M-Instruct-IQ2_XXS.gguf',
    'the suggestion is a file that still fits the 70 MB this build budgets, not the nearest one that would blow it');
  assert.match(facts.gguf.suggested.why, /the closest real size to the 70\.0 MB this build budgets, and it fits/);

  const text = lines.join('\n');
  assert.match(text, /No file in that repository matches Q9_K_S/);
  assert.match(text, /Quants actually present: IQ2_XXS \(44\.0 MB\), Q4_K_M \(72\.1 MB\), Q8_0 \(145\.9 MB\)/);
  assert.match(text, /Closest usable file: SmolLM2-135M-Instruct-IQ2_XXS\.gguf \(44\.0 MB\)/);
  assert.match(text, /and it fits/);
  assert.match(fix, /Set hfGgufQuant to IQ2_XXS/, 'the fix names the quant to write into the table');

  // When nothing in the repository fits the budget, it says so rather than
  // quietly suggesting a file that would fail anyway.
  const tightRoutes = () => [
    ['/tree/main', () => treeOf([
      ['SmolLM2-135M-Instruct-IQ2_XXS.gguf', 134, Math.round(44 * MB)],
      ['SmolLM2-135M-Instruct-Q4_K_M.gguf', 134, Math.round(72.1 * MB)]
    ])],
    ['/api/models/bartowski', () => metaOf({})],
    ['/api/models/HuggingFaceTB', () => metaOf({})],
    localMissing
  ];
  const tight = await diagnose(tightRoutes(), { quants: ['Q9_K_S'], model: { ...CFG, ggufMB: 40 } });
  assert.equal(tight.facts.gguf.suggested.path, 'SmolLM2-135M-Instruct-IQ2_XXS.gguf');
  assert.match(tight.facts.gguf.suggested.why, /nothing fits it/);
});

test('a repo with no GGUF at all says so instead of blaming the quant', async () => {
  const { facts, lines, fix } = await diagnose([
    ['/tree/main', () => treeOf([['model.safetensors', 134, Math.round(270 * MB)], ['README.md', 900]])],
    ['/api/models/bartowski', () => metaOf({})],
    ['/api/models/HuggingFaceTB', () => metaOf({})],
    localMissing
  ]);
  assert.equal(facts.gguf.status, 'no-gguf');
  assert.equal(facts.gguf.ggufCount, 0);
  assert.match(lines.join('\n'), /holds no GGUF files at all/);
  assert.match(fix, /publishes no GGUF/);
});

test('a size guess in the model table that is wrong is reported with both numbers', async () => {
  const { facts, lines, fix } = await diagnose([
    ['/tree/main', () => treeOf([['SmolLM2-135M-Instruct-Q3_K_L.gguf', 134, Math.round(1.86 * GB)]])],
    ['/api/models/bartowski', () => metaOf({})],
    ['/api/models/HuggingFaceTB', () => metaOf({})],
    localMissing
  ], { classified: { kind: 'memory' } });

  assert.equal(facts.gguf.status, 'ok');
  assert.equal(facts.gguf.realBytes, Math.round(1.86 * GB));
  assert.equal(facts.gguf.budgetBytes, 70 * MB, 'the budget comes from the model table');
  const text = lines.join('\n');
  assert.match(text, /budgets 70\.0 MB for this model but the real file is 1\.86 GB/);
  assert.match(text, /27\.\dx more than/, 'past twice the budget it says "Nx", not "2614%"');
  assert.match(fix, /Raise ggufMB/, 'and the fix is the field that is wrong');

  // Under budget is reported too, so an honest table is visibly honest.
  const under = await diagnose([
    ['/tree/main', () => treeOf([['SmolLM2-135M-Instruct-Q3_K_L.gguf', 134, Math.round(30 * MB)]])],
    ['/api/models/bartowski', () => metaOf({})],
    ['/api/models/HuggingFaceTB', () => metaOf({})],
    localMissing
  ]);
  assert.match(describeModelSourceFacts(under.facts).join('\n'), /57% under/);
});

/* ============================== the network itself ============================== */

test('an unreachable host is reported without throwing, and the network is blamed first', async () => {
  const { facts, lines, fix } = await diagnose([
    ['/api/models/bartowski', () => { throw new TypeError('Failed to fetch'); }],
    ['/api/models/HuggingFaceTB', () => { throw new TypeError('Failed to fetch'); }],
    ['api/waffle-ai/gguf', () => { throw new TypeError('Failed to fetch'); }]
  ]);
  assert.equal(facts.gguf.status, 'unreachable');
  assert.equal(facts.gguf.http, null);
  assert.equal(facts.gguf.error, 'Failed to fetch');
  assert.equal(facts.onnx.status, 'unreachable');
  assert.equal(facts.selfHosted.status, 'unreachable');
  assert.match(lines.join('\n'), /could not be reached from this browser/);
  assert.match(fix, /treat the network as the suspect before the model/);
});

test('a fetch that ignores its abort signal still cannot hang the report', async () => {
  const started = Date.now();
  const { facts } = await diagnose([
    ['/api/models/bartowski', () => new Promise(() => {})],
    ['/api/models/HuggingFaceTB', () => new Promise(() => {})],
    ['api/waffle-ai/gguf', () => new Promise(() => {})]
  ], { timeoutMs: 300 });
  const elapsed = Date.now() - started;
  assert.equal(facts.gguf.status, 'timeout');
  assert.match(facts.gguf.error, /no answer within 300 ms/);
  assert.match(describeModelSourceFacts(facts).join('\n'), /the request timed out/);
  assert.ok(elapsed < 3000, `three time-boxed calls finished in ${elapsed} ms instead of hanging`);
  assert.ok(HF_DIAG_TIMEOUT_MS >= 3000 && HF_DIAG_TIMEOUT_MS <= 15000,
    `the production timeout is bounded (${HF_DIAG_TIMEOUT_MS} ms)`);
});

test('a caller abort is reported as cancelled, not as a broken host', async () => {
  clearModelSourceFactsCache();
  const ctrl = new AbortController();
  const facts = fetchModelSourceFacts(CFG, {
    fetchImpl: async (url, init) => {
      ctrl.abort();
      init?.signal?.throwIfAborted?.();
      throw Object.assign(new Error('This operation was aborted'), { name: 'AbortError' });
    },
    timeoutMs: 800,
    signal: ctrl.signal
  });
  const resolved = await facts;
  assert.equal(resolved.gguf.status, 'aborted');
});

/* ============================== the self-hosted copy ============================== */

test('the report says whether this site serves the model itself', async () => {
  const present = await diagnose([
    ['/tree/main', () => treeOf([['SmolLM2-135M-Instruct-Q3_K_L.gguf', 134, Math.round(68 * MB)]])],
    ['/api/models/bartowski', () => metaOf({})],
    ['/api/models/HuggingFaceTB', () => metaOf({})],
    ['api/waffle-ai/gguf', () => bareResponse(200, { 'content-length': String(Math.round(68 * MB)) })]
  ]);
  assert.equal(present.facts.selfHosted.status, 'present');
  assert.equal(present.facts.selfHosted.bytes, Math.round(68 * MB));
  assert.match(present.lines.join('\n'), /This site is serving the model itself/);

  const missing = await diagnose([
    ['/tree/main', () => treeOf([['SmolLM2-135M-Instruct-Q3_K_L.gguf', 134, Math.round(68 * MB)]])],
    ['/api/models/bartowski', () => metaOf({})],
    ['/api/models/HuggingFaceTB', () => metaOf({})],
    localMissing
  ]);
  assert.equal(missing.facts.selfHosted.status, 'not-found');
  assert.match(missing.lines.join('\n'), /not serving the model itself/);
  assert.match(missing.lines.join('\n'), /node scripts\/fetch-model\.mjs/, 'and names the command that would fix it');

  // A host that refuses HEAD is asked with a one-byte ranged GET instead.
  const calls = [];
  clearModelSourceFactsCache();
  const headless = await fetchModelSourceFacts(CFG, {
    fetchImpl: fakeFetch([
      ['/tree/main', () => treeOf([['SmolLM2-135M-Instruct-Q3_K_L.gguf', 134, Math.round(68 * MB)]])],
      ['/api/models/bartowski', () => metaOf({})],
      ['/api/models/HuggingFaceTB', () => metaOf({})],
      ['api/waffle-ai/gguf', (url, init) => (init?.method === 'HEAD'
        ? bareResponse(405)
        : bareResponse(206, { 'content-range': `bytes 0-0/${Math.round(68 * MB)}` }))]
    ], calls),
    timeoutMs: 800
  });
  assert.equal(headless.selfHosted.status, 'present', 'a 405 on HEAD falls back to a ranged GET');
  assert.equal(headless.selfHosted.bytes, Math.round(68 * MB), 'and the size comes from Content-Range');
  assert.ok(calls.some(c => c.method === 'HEAD') && calls.some(c => c.method === 'GET'), 'both were tried');

  const skipped = await diagnose([
    ['/tree/main', () => treeOf([['SmolLM2-135M-Instruct-Q3_K_L.gguf', 134, Math.round(68 * MB)]])],
    ['/api/models/bartowski', () => metaOf({})],
    ['/api/models/HuggingFaceTB', () => metaOf({})],
    localMissing
  ], { probeSelfHosted: false });
  assert.equal(skipped.facts.selfHosted, null, 'the local probe can be turned off');
});

/* ============================== shape and safety ============================== */

test('the report is evidence, so it can never invent a number or throw', () => {
  assert.deepEqual(describeModelSourceFacts(null), [], 'no facts, no lines');
  assert.deepEqual(describeModelSourceFacts(undefined), []);
  assert.deepEqual(describeModelSourceFacts({}), []);
  assert.equal(modelSourceFixAdvice(null, null), null);
  assert.equal(modelSourceFixAdvice({}, {}), null);
});

test('facts are cached per model so one failure does not become six API calls', async () => {
  clearModelSourceFactsCache();
  const calls = [];
  const impl = fakeFetch([
    ['/tree/main', () => treeOf([['SmolLM2-135M-Instruct-Q3_K_L.gguf', 134, Math.round(68 * MB)]])],
    ['/api/models/bartowski', () => metaOf({})],
    ['/api/models/HuggingFaceTB', () => metaOf({})],
    localMissing
  ], calls);
  const first = await fetchModelSourceFacts(CFG, { fetchImpl: impl, timeoutMs: 800 });
  const afterFirst = calls.length;
  const second = await fetchModelSourceFacts(CFG, { fetchImpl: impl, timeoutMs: 800 });
  assert.equal(calls.length, afterFirst, 'the second ask hit the cache');
  assert.equal(second, first, 'and returned the same facts object');

  clearModelSourceFactsCache();
  await fetchModelSourceFacts(CFG, { fetchImpl: impl, timeoutMs: 800 });
  assert.ok(calls.length > afterFirst, 'clearing the cache really does re-ask');
});

test('every model in the table can be diagnosed without producing junk', async () => {
  assert.ok(TEXT_MODELS.length >= 9, 'the whole model table is covered');
  for (const model of TEXT_MODELS) {
    clearModelSourceFactsCache();
    const facts = await fetchModelSourceFacts(model, {
      fetchImpl: fakeFetch([
        ['/tree/main', () => treeOf([[`${model.id}-Q3_K_L.gguf`, 134, (model.ggufMB || 100) * MB]])],
        ['/api/models/', () => metaOf({})],
        ['api/waffle-ai/gguf', () => bareResponse(404)]
      ]),
      timeoutMs: 800
    });
    const lines = describeModelSourceFacts(facts);
    assert.ok(lines.length >= 2, `${model.id}: the report has something to say`);
    const text = lines.join('\n');
    for (const junk of ['NaN', 'undefined', '[object', 'null MB', 'Infinity']) {
      assert.ok(!text.includes(junk), `${model.id}: the report contains no "${junk}"\n${text}`);
    }
    assert.match(text, new RegExp(model.hfGgufRepo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `${model.id}: the report names the repo it checked`);
    assert.equal(facts.id, model.id);
  }
});

test('the failure path in Waffle AI appends the report and can never be masked by it', () => {
  const src = fs.readFileSync('waffle-ai.js', 'utf8');
  assert.match(src, /fetchModelSourceFacts,\s*describeModelSourceFacts,\s*modelSourceFixAdvice,\s*reconcileAiFailureWithFacts,\s*HF_DIAG_TIMEOUT_MS/,
    'the chat imports the diagnostics');
  assert.match(src, /async function modelSourceFactsFor\(cfg, signal\)/, 'the facts come from one bounded helper');
  assert.match(src, /function renderModelSourceReport\(facts, classified\)/, 'and the prose is rendered from them separately');
  assert.match(src, /catch \{\s*return null;\s*\}/, 'which swallows its own failures');
  assert.match(src, /navigator\.onLine === false\) return null/, 'and does not ask anyone when the device is offline');

  const chain = src.slice(src.indexOf('const headline = summarizeAiFailures'), src.indexOf('async function fetchStatus'));
  assert.match(chain, /headline\?\.kind === 'offline' \? null : await modelSourceFactsFor/,
    'nor when the cause is already known to be offline');
  assert.match(chain, /const cause = reconcileAiFailureWithFacts\(headline, facts\);/,
    "the facts get to overrule the engines' guess at the cause");
  assert.equal(chain.split('${sourceReport}').length - 1, 2,
    'both failure throws carry the report — the classified one and the bare one');
  assert.match(chain, /join\('\\n'\)\}\$\{sourceReport\}/,
    'appended after the engine errors, not instead of them');
  assert.match(chain, /\$\{cause\.title\}\. \$\{cause\.hint\}/, 'and the headline printed is the reconciled one');
  assert.match(src, /checked live against Hugging Face/, 'the report says where its facts came from');
});

/* ================= the file itself, which lives on another host ================= */

const NETWORK_HEADLINE = {
  kind: 'network',
  title: 'Could not reach the model host',
  hint: 'The download never started — huggingface.co was unreachable from this browser.',
  uniform: true,
  count: 5
};

const healthyRoutes = () => [
  ['/tree/main', () => treeOf([['SmolLM2-135M-Instruct-Q3_K_L.gguf', 134, Math.round(68.4 * MB)]])],
  ['/api/models/bartowski', () => metaOf({})],
  ['/api/models/HuggingFaceTB', () => metaOf({ siblings: [{ rfilename: 'onnx/model_q4.onnx' }, { rfilename: 'onnx/model_q4.onnx_data' }, { rfilename: 'README.md' }] })],
  localMissing
];

test('the file the loaders really download is probed, and the CDN behind it is named', async () => {
  const { facts, calls, lines } = await diagnose(healthyRoutes());

  assert.equal(facts.download.status, 'ok');
  assert.equal(facts.download.path, 'SmolLM2-135M-Instruct-Q3_K_L.gguf', 'the probe is of the file the loader picked');
  assert.equal(facts.download.http, 206);
  assert.equal(facts.download.bytes, Math.round(68.4 * MB), 'the total comes from Content-Range, not the one byte asked for');
  assert.equal(facts.download.host, 'cdn-lfs-us-1.hf.co', 'and the redirect target is recorded');

  const probe = calls.find(c => c.url.includes('resolve/main/SmolLM2-135M-Instruct-Q3_K_L.gguf'));
  assert.ok(probe, `the file URL was really requested: ${calls.map(c => c.url).join(' | ')}`);
  assert.equal(probe.range, 'bytes=0-0', 'one byte, because the report must not download 880 MB to make a point');

  const text = lines.join('\n');
  assert.match(text, /The GGUF file WLlama would download — SmolLM2-135M-Instruct-Q3_K_L\.gguf — answered HTTP 206 and is 68\.4 MB in total, served from cdn-lfs-us-1\.hf\.co/);
  assert.match(text, /so this browser can fetch the weights/);
  assert.ok(!text.includes('not a dead network'), 'a working download does not get the contradiction paragraph');
});

test('the ONNX weight is probed too, and the .onnx_data sidecar is not mistaken for it', async () => {
  const { facts, calls } = await diagnose(healthyRoutes());
  assert.equal(facts.onnx.weightFile, 'onnx/model_q4.onnx');
  assert.equal(facts.onnx.hasOnnxWeights, true);
  assert.equal(facts.onnxDownload.status, 'ok');
  assert.equal(facts.onnxDownload.path, 'onnx/model_q4.onnx');
  assert.ok(calls.some(c => c.url.includes('resolve/main/onnx/model_q4.onnx')),
    'the browser path downloads a different file from the GGUF path, so it gets its own probe');
  assert.ok(!calls.some(c => c.url.includes('.onnx_data')), 'and the sidecar is never probed');
  assert.match(describeModelSourceFacts(facts).join('\n'), /The ONNX weight the browser path would download — onnx\/model_q4\.onnx —/);
});

test('the report refuses to blame the network when the host answered and only the file failed', async () => {
  // Exactly the failure that came back from a real device: five runtimes all
  // said "Failed to fetch", while the metadata calls answered HTTP 200.
  const { facts, lines } = await diagnose([
    ['/tree/main', () => treeOf([['qwen2.5-1.5b-instruct-q3_k_m.gguf', 134, Math.round(881.6 * MB)]])],
    ['/api/models/Qwen', () => metaOf({})],
    ['/api/models/onnx-community', () => metaOf({ siblings: [{ rfilename: 'onnx/decoder_model_merged_quantized.q4.onnx' }] })],
    ['resolve/main', () => { throw new TypeError('Failed to fetch'); }],
    localMissing
  ], {
    quants: ['Q3_K_L', 'Q3_K_M'],
    model: {
      ...CFG,
      id: 'qwen2.5-1.5b',
      label: 'Qwen 2.5 1.5B',
      hfId: 'onnx-community/Qwen2.5-1.5B-Instruct',
      hfGgufRepo: 'Qwen/Qwen2.5-1.5B-Instruct-GGUF',
      hfGgufQuant: 'Q3_K_L',
      ggufFile: 'qwen2.5-1.5b.gguf',
      ggufMB: 882
    }
  });

  assert.equal(facts.gguf.status, 'ok', 'the repository is fine');
  assert.equal(facts.gguf.http, 200);
  assert.equal(facts.download.status, 'unreachable', 'the file is not');
  assert.equal(facts.download.error, 'Failed to fetch');
  assert.equal(facts.onnxDownload.status, 'unreachable');

  const text = lines.join('\n');
  assert.match(text, /could not be fetched: HTTP none, could not be reached from this browser \(Failed to fetch\)/);
  assert.match(text, /That is not a dead network/);
  assert.match(text, /the repository API on huggingface\.co answered HTTP 200 from this same browser/);
  assert.match(text, /LFS CDN after a redirect/, 'it names the host that is actually failing');
  assert.equal(text.split('That is not a dead network').length - 1, 1,
    'the explanation is printed once, not once per probe');

  const cause = reconcileAiFailureWithFacts(NETWORK_HEADLINE, facts);
  assert.equal(cause.kind, 'blocked-download');
  assert.match(cause.title, /Hugging Face answered, but the model file could not be downloaded/);
  assert.match(cause.hint, /the network is not down/);
  assert.match(cause.hint, /scripts\/fetch-model\.mjs/, 'and it says what to do about it');
  assert.equal(cause.count, 5, 'the chain facts survive the overrule');
  assert.equal(cause.uniform, true);

  const fix = modelSourceFixAdvice(facts, cause);
  assert.match(fix, /the block is on the download itself/);
  assert.match(fix, /takes the CDN redirect out of the path/);
  assert.ok(!fix.includes('treat the network as the suspect'),
    'the old advice — check your firewall and DNS — is exactly what sent this report down the wrong road');
});

test('the headline is left alone unless the contradiction is clean', () => {
  // A download that worked proves nothing was blocked.
  assert.equal(reconcileAiFailureWithFacts(NETWORK_HEADLINE, {
    gguf: { http: 200 }, onnx: null,
    download: { status: 'ok' }, onnxDownload: null
  }), NETWORK_HEADLINE, 'a working download cannot overrule anything');

  // A dead network fails the metadata call too — that really is the network.
  assert.equal(reconcileAiFailureWithFacts(NETWORK_HEADLINE, {
    gguf: { http: null, status: 'unreachable' }, onnx: null,
    download: { status: 'unreachable' }, onnxDownload: null
  }).kind, 'network');

  // No file probe, no overrule: nothing was measured.
  assert.equal(reconcileAiFailureWithFacts(NETWORK_HEADLINE, {
    gguf: { http: 200 }, onnx: null, download: null, onnxDownload: null
  }), NETWORK_HEADLINE);

  // And a different kind of failure is none of this function's business.
  const memory = { kind: 'memory', title: 'Not enough memory', hint: '' };
  assert.equal(reconcileAiFailureWithFacts(memory, {
    gguf: { http: 200 }, onnx: null, download: { status: 'unreachable' }, onnxDownload: null
  }), memory);

  assert.equal(reconcileAiFailureWithFacts(null, null), null, 'it cannot invent a headline');
  assert.equal(reconcileAiFailureWithFacts(NETWORK_HEADLINE, null), NETWORK_HEADLINE);
});

test('a file probe that hangs cannot stall the failure report either', async () => {
  const started = Date.now();
  const { facts, lines } = await diagnose([
    ['/tree/main', () => treeOf([['SmolLM2-135M-Instruct-Q3_K_L.gguf', 134, Math.round(68.4 * MB)]])],
    ['/api/models/bartowski', () => metaOf({})],
    ['/api/models/HuggingFaceTB', () => metaOf({})],
    ['resolve/main', () => new Promise(() => {})],
    localMissing
  ], { timeoutMs: 300 });
  const elapsed = Date.now() - started;

  assert.equal(facts.download.status, 'timeout');
  assert.match(lines.join('\n'), /could not be fetched: HTTP none, the request timed out/);
  assert.ok(elapsed < 3000, `both probes were time-boxed and ran together (${elapsed} ms)`);
});

test('the model table carries the size the live report measured, not a guess', () => {
  const qwen = TEXT_MODELS.find(m => m.id === 'qwen2.5-1.5b');
  assert.ok(qwen, 'the model is still in the table');
  // The source report from a real device measured qwen2.5-1.5b-instruct-q3_k_m.gguf
  // at 881.6 MB while the table claimed 700 MB. That number drives the
  // "will this fit?" check and every warning built on it.
  assert.equal(qwen.ggufMB, 882);
  assert.match(qwen.desc, /~882 MB/, 'the description quotes the same measured figure');
  assert.ok(!qwen.desc.includes('700'), 'and not the old guess');
  assert.equal(qwen.hfGgufRepo, 'Qwen/Qwen2.5-1.5B-Instruct-GGUF');
});

/* ========= which request is blocked: the host, or the preflighted download ========= */

/**
 * A precache index in localStorage, the way the app writes it. Only the
 * precache key answers, so the other prefs the module reads keep their defaults.
 */
async function withPrecache(index, run) {
  const prev = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: key => (String(key).endsWith('precached-gguf') ? JSON.stringify(index) : null),
    setItem: () => {},
    removeItem: () => {}
  };
  try {
    // Awaited *inside* the try: the shim has to still be installed when the
    // diagnostics read it, not only when the call was made.
    return await run();
  } finally {
    if (prev === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prev;
  }
}

const preflightRoutes = () => [
  ['/tree/main', () => treeOf([['SmolLM2-135M-Instruct-Q3_K_L.gguf', 134, Math.round(93 * MB)]])],
  ['/api/models/bartowski', () => metaOf({})],
  ['/api/models/HuggingFaceTB', () => metaOf({ siblings: [{ rfilename: 'onnx/model_q4.onnx' }] })],
  // The loaders' ranged GET never comes back; a plain HEAD does.
  ['resolve/main', (url, init) => (init?.method === 'HEAD'
    ? downloadResponse(Math.round(93 * MB), { status: 200 })
    : (() => { throw new TypeError('Failed to fetch'); })())],
  localMissing
];

test('a plain request that succeeds proves the host is reachable and the preflight is the problem', async () => {
  const { facts, lines } = await diagnose(preflightRoutes());

  assert.equal(facts.gguf.status, 'ok', 'the repo is fine');
  assert.equal(facts.download.status, 'unreachable', 'the ranged download the loaders send is not');
  assert.equal(facts.download.plainStatus, 'ok', 'but a header-free HEAD got through');
  assert.equal(facts.download.plainHttp, 200);
  assert.equal(facts.download.plainHost, 'cdn-lfs-us-1.hf.co', 'and it names the CDN that answered');

  const text = lines.join('\n');
  assert.match(text, /A plain request for that same file — a HEAD, with no Range header and therefore no CORS preflight — did succeed: HTTP 200, from cdn-lfs-us-1\.hf\.co/);
  assert.match(text, /what is being stopped is the \*ranged\* download/);
  assert.match(text, /preflight with an OPTIONS request/);

  const cause = reconcileAiFailureWithFacts(NETWORK_HEADLINE, facts);
  assert.equal(cause.kind, 'blocked-preflight');
  assert.match(cause.title, /the ranged download request is what is being blocked/);
  assert.match(cause.hint, /neither huggingface\.co nor its CDN is blocked/);
  assert.match(cause.hint, /allow OPTIONS requests to huggingface\.co and its CDN hosts \(cdn-lfs\*\.hf\.co\)/);
  assert.match(cause.hint, /privacy extension/, 'and it names the usual suspect');
  assert.equal(cause.count, NETWORK_HEADLINE.count, 'the chain facts survive');

  const fix = modelSourceFixAdvice(facts, cause);
  assert.match(fix, /the block is on the preflighted ranged download/);
  assert.match(fix, /scripts\/fetch-model\.mjs/, 'with the self-hosting escape hatch');
});

test('when the plain request fails too, the report does not pretend it knows which header was the problem', async () => {
  const { facts, lines } = await diagnose([
    ['/tree/main', () => treeOf([['SmolLM2-135M-Instruct-Q3_K_L.gguf', 134, Math.round(93 * MB)]])],
    ['/api/models/bartowski', () => metaOf({})],
    ['/api/models/HuggingFaceTB', () => metaOf({})],
    ['resolve/main', () => { throw new TypeError('Failed to fetch'); }],
    localMissing
  ]);

  assert.equal(facts.download.status, 'unreachable');
  assert.equal(facts.download.plainStatus, 'unreachable', 'both probes were tried and both failed');
  const text = lines.join('\n');
  assert.match(text, /A plain request for that same file failed too/);
  assert.match(text, /so this is not only about the Range header/);
  assert.equal(reconcileAiFailureWithFacts(NETWORK_HEADLINE, facts).kind, 'blocked-download',
    'so it stays the broader diagnosis instead of guessing at preflights');
});

test('a healthy download is only probed once', async () => {
  const { facts, calls } = await diagnose(healthyRoutes());
  assert.equal(facts.download.status, 'ok');
  assert.equal(facts.download.plainStatus, null, 'no second request when the first one worked');
  assert.equal(calls.filter(c => c.url.includes('resolve/main/SmolLM2')).length, 1);
});

/* ============================== the ONNX candidate walk ============================== */

test('the ONNX report follows the fallback chain the loader really walks', async () => {
  const { facts, calls, lines } = await diagnose([
    ['/tree/main', () => treeOf([['SmolLM2-135M-Instruct-Q3_K_L.gguf', 134, Math.round(93 * MB)]])],
    ['/api/models/bartowski', () => metaOf({})],
    // The configured repo refuses; the first fallback has the weights.
    ['/api/models/HuggingFaceTB', () => jsonResponse({ error: 'You must be logged in' }, 401)],
    ['/api/models/onnx-community', () => metaOf({ siblings: [{ rfilename: 'onnx/model_q4.onnx' }, { rfilename: 'onnx/model_q4.onnx_data' }] })],
    localMissing
  ]);

  assert.equal(facts.onnx.configured, 'HuggingFaceTB/SmolLM2-135M-Instruct-ONNX');
  assert.equal(facts.onnx.resolved, 'onnx-community/SmolLM2-135M-Instruct', 'the loader would use the fallback');
  assert.equal(facts.onnx.repo, 'onnx-community/SmolLM2-135M-Instruct', 'and the report describes that one');
  assert.equal(facts.onnx.status, 'ok');
  assert.equal(facts.onnx.weightFile, 'onnx/model_q4.onnx');
  assert.deepEqual(facts.onnx.checked.map(c => [c.repo, c.http]), [
    ['HuggingFaceTB/SmolLM2-135M-Instruct-ONNX', 401],
    ['onnx-community/SmolLM2-135M-Instruct', 200]
  ], 'it stops at the first repo that can prove it holds weights');

  const text = lines.join('\n');
  assert.match(text, /ONNX repos this build tries, in order: HuggingFaceTB\/SmolLM2-135M-Instruct-ONNX → HTTP 401, refused[\s\S]*?; onnx-community\/SmolLM2-135M-Instruct → HTTP 200, reachable, with \.onnx weights/);
  assert.match(text, /The loader would use onnx-community\/SmolLM2-135M-Instruct — the first of those that really holds \.onnx weights, not the configured HuggingFaceTB\/SmolLM2-135M-Instruct-ONNX/);
  assert.ok(calls.some(c => c.url.includes('onnx-community/SmolLM2-135M-Instruct/resolve/main/onnx/model_q4.onnx')),
    'so the file probe targets the repo that will actually be used');
});

test('when no ONNX candidate can prove it has weights, the report says the loader is guessing', async () => {
  const { facts, lines } = await diagnose([
    ['/tree/main', () => treeOf([['SmolLM2-135M-Instruct-Q3_K_L.gguf', 134, Math.round(93 * MB)]])],
    ['/api/models/bartowski', () => metaOf({})],
    ['/api/models/', () => metaOf({ siblings: [{ rfilename: 'README.md' }] })],
    localMissing
  ]);
  assert.equal(facts.onnx.resolved, null);
  assert.equal(facts.onnx.repo, CFG.hfId, 'it falls back to the first candidate, exactly like the loader does');
  assert.equal(facts.onnx.hasOnnxWeights, false);
  assert.equal(facts.onnxDownload, null, 'with no weight file there is nothing to probe');
  assert.match(lines.join('\n'), /None of them could prove it holds \.onnx weights, so the loader would try HuggingFaceTB\/SmolLM2-135M-Instruct-ONNX anyway/);
});

/* ============================== the per-origin precache ============================== */

test('the report says whether this origin already holds the model, because browser caches are per origin', async () => {
  const cached = await withPrecache(
    { 'bartowski/SmolLM2-135M-Instruct-GGUF': { url: 'https://huggingface.co/x.gguf', quant: 'Q3_K_L', sizeBytes: Math.round(93 * MB), preset: 'compact', at: Date.now() } },
    () => diagnose(healthyRoutes())
  );
  assert.equal(cached.facts.deviceCache.present, true);
  assert.equal(cached.facts.deviceCache.quant, 'Q3_K_L');
  assert.equal(cached.facts.deviceCache.sizeBytes, Math.round(93 * MB));
  const text = cached.lines.join('\n');
  assert.match(text, /This browser has that GGUF pre-cached on \*this origin\* \(93\.0 MB, Q3_K_L\)/);
  assert.match(text, /can be ready on the live site and missing on a preview host/, 'which is the "it worked yesterday" explanation');

  const empty = await diagnose(healthyRoutes());
  assert.equal(empty.facts.deviceCache.present, false);
  assert.match(empty.lines.join('\n'), /This origin holds no pre-cached copy of that GGUF, so every load from here has to download it/);
});

test('the smallest model in the table carries the size this report measured', () => {
  const tiny = TEXT_MODELS.find(m => m.id === 'smollm2-135m');
  assert.ok(tiny);
  // SmolLM2-135M-Instruct-Q3_K_L.gguf measured 93.0 MB in
  // bartowski/SmolLM2-135M-Instruct-GGUF; the table claimed 70 MB, and the
  // badge in the model picker quoted the same wrong figure.
  assert.equal(tiny.ggufMB, 93);
  assert.match(tiny.badge, /~93 MB/);
  assert.match(tiny.desc, /~93 MB/);
  assert.ok(!`${tiny.badge} ${tiny.desc}`.includes('70'), 'the old guess is gone from the picker copy too');
});
