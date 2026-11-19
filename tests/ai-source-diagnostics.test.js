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
    calls.push({ url: String(url), method: init?.method || 'GET' });
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

async function diagnose(routes, opts = {}) {
  const { model = CFG, classified = null, ...rest } = opts;
  clearModelSourceFactsCache();
  const calls = [];
  const facts = await fetchModelSourceFacts(model, {
    fetchImpl: fakeFetch(routes, calls),
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
  assert.match(src, /fetchModelSourceFacts,\s*describeModelSourceFacts,\s*modelSourceFixAdvice,\s*HF_DIAG_TIMEOUT_MS/,
    'the chat imports the diagnostics');
  assert.match(src, /async function modelSourceReport\(cfg, classified, signal\)/, 'behind one bounded helper');
  assert.match(src, /catch \{\s*return '';\s*\}/, 'which swallows its own failures');
  assert.match(src, /navigator\.onLine === false\) return ''/, 'and does not ask anyone when the device is offline');
  assert.match(src, /headline\?\.kind === 'offline' \? '' : await modelSourceReport/, 'nor when the cause is already known to be offline');

  const chain = src.slice(src.indexOf('const headline = summarizeAiFailures'), src.indexOf('async function fetchStatus'));
  assert.equal(chain.split('${sourceReport}').length - 1, 2,
    'both failure throws carry the report — the classified one and the bare one');
  assert.match(chain, /failures\.map\(f => `• \$\{f\.step\} → \$\{f\.message\}`\)\.join\('\\n'\)\}\$\{sourceReport\}/,
    'appended after the engine errors, not instead of them');
  assert.match(src, /checked live against Hugging Face/, 'and the report says where its facts came from');
});
