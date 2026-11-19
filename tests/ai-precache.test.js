// Pre-caching, end to end: the models a deploy puts on its own origin, the
// rules that decide what an idle browser copies onto the device, and the order
// the loader walks so a same-origin file beats a third-party download.
//
// The point of all of it is that a same-origin request cannot be blocked by the
// things that block Hugging Face — no CORS preflight, no redirect to an LFS CDN,
// no third-party host — so every rule here is about never paying for a download
// the site could have served itself, and never claiming a file that is not one.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  TEXT_MODELS,
  planAutoPrecache,
  probeServedModels,
  autoPrecacheServedModels,
  isAutoPrecacheRunning,
  stopAutoPrecache,
  AUTO_PRECACHE_COOLDOWN_MS
} from '../waffle-browser-ai.js';
import { planBudget, pickQuantFile } from '../scripts/fetch-model.mjs';

const MB = 1024 * 1024;
const HOUR = 60 * 60 * 1000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------------------------------- fakes ---------------------------------- */

const headers = map => ({ get: k => (map[String(k).toLowerCase()] ?? null) });
const bareResponse = (status, hdrs = {}) => ({ ok: status >= 200 && status < 300, status, headers: headers(hdrs) });

const ggufAnswer = (bytes, contentType = 'application/octet-stream') =>
  bareResponse(200, { 'content-type': contentType, 'content-length': String(bytes) });

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

const MODELS = [
  { id: 'a', label: 'A', hfGgufRepo: 'org/a-GGUF', ggufFile: 'a.gguf' },
  { id: 'b', label: 'B', hfGgufRepo: 'org/b-GGUF', ggufFile: 'b.gguf' },
  { id: 'c', label: 'C', hfGgufRepo: 'org/c-GGUF', ggufFile: 'c.gguf' }
];

const servedMap = entries => Object.fromEntries(Object.entries(entries).map(([id, v]) => [id, v]));

/* ------------------------------ the plan rules ------------------------------ */

test('the background pre-cache never starts while a chat is running', () => {
  const plan = planAutoPrecache({
    models: MODELS,
    served: servedMap({ a: { status: 'present', bytes: 93 * MB } }),
    cached: {},
    busy: true
  });
  assert.equal(plan.run, false);
  assert.match(plan.reason, /a chat is running/);
  assert.deepEqual(plan.ids, []);
});

test('it needs on-device storage, and it respects a data-saver connection', () => {
  const served = servedMap({ a: { status: 'present', bytes: 93 * MB } });
  const noStorage = planAutoPrecache({ models: MODELS, served, cached: {}, storageOk: false });
  assert.equal(noStorage.run, false);
  assert.match(noStorage.reason, /no on-device storage/);

  const saver = planAutoPrecache({ models: MODELS, served, cached: {}, saveData: true });
  assert.equal(saver.run, false);
  assert.match(saver.reason, /save data/);
});

test('only a file this origin really serves qualifies — not a page, not a stub', () => {
  const plan = planAutoPrecache({
    models: MODELS,
    served: servedMap({
      a: { status: 'not-a-model', bytes: 4 * 1024 },   // the host's own index page
      b: { status: 'present', bytes: 900 },            // far too small to be a model
      c: { status: 'not-found', http: 404, bytes: null }
    }),
    cached: {}
  });
  assert.equal(plan.run, false);
  assert.match(plan.reason, /serves no model/);
});

test('a model already usable on the device is not downloaded again', () => {
  const served = servedMap({ a: { status: 'present', bytes: 93 * MB }, b: { status: 'present', bytes: 93 * MB } });
  const plan = planAutoPrecache({
    models: MODELS,
    served,
    cached: { 'org/a-GGUF': { present: true } }
  });
  assert.equal(plan.run, true);
  assert.deepEqual(plan.ids, ['b'], 'only the one that is not on the device yet');
});

test('it runs at most once a day, and force overrides the cooldown', () => {
  assert.equal(AUTO_PRECACHE_COOLDOWN_MS, 12 * HOUR);
  const served = servedMap({ a: { status: 'present', bytes: 93 * MB } });
  const now = Date.UTC(2026, 10, 19, 12);

  const soon = planAutoPrecache({ models: MODELS, served, cached: {}, now, lastRunAt: now - 3 * HOUR });
  assert.equal(soon.run, false);
  assert.match(soon.reason, /already ran within the last 12 hours/);

  const later = planAutoPrecache({ models: MODELS, served, cached: {}, now, lastRunAt: now - 13 * HOUR });
  assert.equal(later.run, true);
  assert.deepEqual(later.ids, ['a']);

  const forced = planAutoPrecache({ models: MODELS, served, cached: {}, now, lastRunAt: now, force: true });
  assert.equal(forced.run, true, 'a deliberate re-run is not blocked by the cooldown');
});

test('it takes every served model that is not on the device, in table order', () => {
  const plan = planAutoPrecache({
    models: MODELS,
    served: servedMap({
      c: { status: 'present', bytes: 40 * MB },
      a: { status: 'present', bytes: 93 * MB }
    }),
    cached: {}
  });
  assert.deepEqual(plan.ids, ['a', 'c'], 'table order, not probe order');
});

/* --------------------------- what an origin serves --------------------------- */

test('probeServedModels reports the size of a real same-origin GGUF', async () => {
  const calls = [];
  const served = await probeServedModels({
    fetchImpl: fakeFetch([
      ['api/waffle-ai/gguf/smollm2-135m.gguf', () => ggufAnswer(Math.round(93 * MB))]
    ], calls)
  });
  const hit = served['smollm2-135m'];
  assert.equal(hit.status, 'present');
  assert.equal(hit.bytes, Math.round(93 * MB));
  assert.match(hit.url, /api\/waffle-ai\/gguf\/smollm2-135m\.gguf$/);
  assert.ok(calls.every(c => c.method === 'HEAD'), 'it asks, it does not download');
  assert.ok(calls.every(c => !c.url.includes('huggingface.co')), 'same origin only');
});

test('an HTML answer is not a model — the SPA fallback would otherwise look present', async () => {
  const served = await probeServedModels({
    fetchImpl: fakeFetch([
      ['api/waffle-ai/gguf/', () => bareResponse(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': '4211' })]
    ])
  });
  for (const m of TEXT_MODELS.filter(x => x.ggufFile)) {
    assert.equal(served[m.id].status, 'not-a-model', `${m.id}: a page is never reported as a served model`);
  }
});

test('a missing file is reported as absent, and a host that refuses HEAD is asked with a ranged GET', async () => {
  const calls = [];
  const served = await probeServedModels({
    fetchImpl: fakeFetch([
      ['api/waffle-ai/gguf/smollm2-135m.gguf', (url, init) => {
        if ((init?.method || 'GET') === 'HEAD') return bareResponse(405);
        return bareResponse(206, { 'content-type': 'application/octet-stream', 'content-range': `bytes 0-0/${Math.round(93 * MB)}` });
      }],
      ['api/waffle-ai/gguf/', () => bareResponse(404)]
    ], calls)
  });
  assert.equal(served['smollm2-135m'].status, 'present');
  assert.equal(served['smollm2-135m'].bytes, Math.round(93 * MB));
  assert.ok(calls.some(c => c.method === 'GET' && c.range === 'bytes=0-0'), 'one byte asked for, not the whole file');
  assert.equal(served['qwen2.5-1.5b'].status, 'not-found');
});

test('against a real HTTP server: a served GGUF is present, an SPA fallback is not', async () => {
  // Real headers, real HEAD, real Range support — the fakes above only prove the
  // logic reads them, this proves a server actually sends them this way.
  const http = await import('node:http');
  const MODEL = Buffer.alloc(3 * MB, 7);
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/waffle-ai/gguf/smollm2-135m.gguf')) {
      const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
      res.setHeader('content-type', 'application/octet-stream');
      res.setHeader('accept-ranges', 'bytes');
      if (req.method === 'HEAD') {
        res.setHeader('content-length', String(MODEL.length));
        res.writeHead(200).end();
        return;
      }
      if (range) {
        const start = Number(range[1]);
        const end = range[2] ? Number(range[2]) : start;
        res.setHeader('content-range', `bytes ${start}-${end}/${MODEL.length}`);
        res.writeHead(206).end(MODEL.subarray(start, end + 1));
        return;
      }
      res.writeHead(200).end(MODEL);
      return;
    }
    // Anything else is the host's own page: what a static site answers for a
    // path it does not have.
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.writeHead(200).end('<!doctype html><title>kitchen</title>');
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const rewritingFetch = (url, init) => fetch(String(url).replace('http://localhost', base), init);
    const served = await probeServedModels({ fetchImpl: rewritingFetch });

    const hit = served['smollm2-135m'];
    assert.equal(hit.status, 'present', 'a real octet-stream answer of a real size is a served model');
    assert.equal(hit.bytes, 3 * MB);
    assert.equal(hit.contentType, 'application/octet-stream');

    const miss = served['qwen2.5-1.5b'];
    assert.equal(miss.status, 'not-a-model', 'an HTML answer for a missing file is never reported as served');
    assert.match(miss.contentType, /text\/html/);
  } finally {
    await new Promise(r => server.close(r));
  }
});

/* ---------------------------- the run itself ---------------------------- */

test('with no on-device storage the background run declines and leaves nothing running', async () => {
  const result = await autoPrecacheServedModels({
    fetchImpl: fakeFetch([['api/waffle-ai/gguf/', () => ggufAnswer(Math.round(93 * MB))]])
  });
  assert.equal(result.run, false);
  assert.match(result.reason, /no on-device storage/, 'Node exposes no OPFS, and the run must say so instead of failing');
  assert.deepEqual(result.done, []);
  assert.equal(isAutoPrecacheRunning(), false, 'the running flag is cleared even when it declines');
});

test('only one background pre-cache runs at a time', async () => {
  let release;
  const gate = new Promise(r => { release = r; });
  const blockingFetch = async () => { await gate; return bareResponse(404); };

  const first = autoPrecacheServedModels({ fetchImpl: blockingFetch });
  const second = await autoPrecacheServedModels({ fetchImpl: blockingFetch });
  assert.equal(second.run, false);
  assert.match(second.reason, /already running/);

  release();
  await first;
  assert.equal(isAutoPrecacheRunning(), false);
});

test('an outside abort cancels it before any download is planned', async () => {
  const controller = new AbortController();
  const slowFetch = async () => {
    await sleep(5);
    if (controller.signal.aborted) throw new DOMException('aborted', 'AbortError');
    return bareResponse(404);
  };
  const running = autoPrecacheServedModels({ fetchImpl: slowFetch, signal: controller.signal });
  controller.abort('the visitor moved on');
  const result = await running;
  assert.equal(result.run, false);
  assert.match(result.reason, /cancelled/);
  assert.equal(isAutoPrecacheRunning(), false);
});

test('stopAutoPrecache reports whether there was anything to stop', () => {
  assert.equal(stopAutoPrecache('nothing running'), false);
});

/* --------------------------- the loader's order --------------------------- */

test('the WLlama loader tries this origin before Hugging Face, and keeps the copy', () => {
  const src = fs.readFileSync('waffle-browser-ai.js', 'utf8');
  const local = src.indexOf('// 2) A GGUF this origin serves itself.');
  const hf = src.indexOf('// 3) HuggingFace → downloaded straight into on-device storage.');
  const none = src.indexOf('// 4) Nothing on this device');
  assert.ok(local > 0 && hf > 0 && none > 0, 'all three steps are still there');
  assert.ok(local < hf && hf < none, 'the same-origin copy is tried first, then HF, then an honest error');

  const region = src.slice(local, hf);
  assert.ok(region.length > 900, 'the same-origin step is a real step, not a stub');
  assert.match(region, /inspectSelfHostedCopy/, 'it asks this origin whether the file exists');
  assert.match(region, /downloadModel\(\{ url: localGgufUrl \}/, 'it copies the file into on-device storage');
  assert.match(region, /inst\.loadModel\(model, loadParams\)/, 'and loads that stored copy');
  assert.match(region, /loadModelFromUrl\(localGgufUrl/, 'streaming it from this origin is the fallback when there is no storage');
  assert.match(region, /preset: null/, 'a same-origin copy makes no promise about a quant preset');
  assert.match(region, /LOCAL_QUANT_LABEL/, 'so its label says where it came from instead of naming a quant');
  assert.ok(!region.includes('resolveBestHFGguf'), 'this step never asks Hugging Face anything');
});

test('a stored same-origin copy stays usable whatever preset is selected', () => {
  const src = fs.readFileSync('waffle-browser-ai.js', 'utf8');
  const at = src.indexOf('const cacheUsable =');
  assert.ok(at > 0);
  const rule = src.slice(at, src.indexOf(';', src.indexOf(':', at + 400)) + 1);
  assert.ok(rule.length > 200, 'the whole rule was captured');
  assert.match(rule, /cachedEntry\?\.quant === LOCAL_QUANT_LABEL/, 'the marker is recognised first');
  assert.match(rule, /cachedEntry\.preset === preset\.id/, 'an HF copy is still validated against its preset');
});

/* ------------------------------ the deploy side ------------------------------ */

test('the fetch budget takes what fits and keeps going past a model that does not', () => {
  const picks = [
    { modelId: 'default', size: 93 * MB },
    { modelId: 'too-big', size: 880 * MB },
    { modelId: 'small-later', size: 40 * MB }
  ];
  const plan = planBudget(picks, 160 * MB);
  assert.deepEqual(plan.take.map(p => p.modelId), ['default', 'small-later']);
  assert.deepEqual(plan.skip.map(p => p.modelId), ['too-big']);
  assert.match(plan.skip[0].reason, /past the 160\.0 MB budget/);
  assert.equal(Math.round(plan.used / MB), 133);

  const unlimited = planBudget(picks);
  assert.equal(unlimited.take.length, 3, 'no budget means everything asked for');
  assert.equal(unlimited.skip.length, 0);
});

test('a file already on disk still counts against the budget', () => {
  const plan = planBudget([
    { modelId: 'present', size: 150 * MB, present: true },
    { modelId: 'new', size: 20 * MB }
  ], 160 * MB);
  assert.deepEqual(plan.take.map(p => p.modelId), ['present'], 'the build ships it either way, so it costs the same');
  assert.deepEqual(plan.skip.map(p => p.modelId), ['new']);
});

test('the quant picker prefers the configured quant and refuses shards', () => {
  const files = [
    { path: 'M-Q3_K_L.gguf', type: 'file', size: 93 },
    { path: 'M-Q3_K_M.gguf', type: 'file', size: 80 },
    { path: 'M-00001-of-00002.gguf', type: 'file', size: 10 },
    { path: 'README.md', type: 'file', size: 5 }
  ];
  assert.equal(pickQuantFile(files, ['Q3_K_L', 'Q4_K_M']).file.path, 'M-Q3_K_L.gguf');
  const fallback = pickQuantFile(files, ['Q8_0']);
  assert.equal(fallback.file.path, 'M-Q3_K_M.gguf', 'the smallest single file, never a shard');
  assert.equal(fallback.quant, 'smallest available');
});

test('the deployed service worker does not answer a served model with a 501', () => {
  const vite = fs.readFileSync('vite.config.js', 'utf8');
  const at = vite.indexOf('const CACHE = __CACHE__;');
  assert.ok(at > 0, 'the service worker template lives in the build config');
  const sw = vite.slice(at, vite.indexOf('`;', at));
  assert.ok(sw.length > 1500, 'the whole template was captured, not an empty slice');
  assert.match(sw, /SERVED_STATIC = \['api\/waffle-ai\/gguf\/', 'api\/waffle-ai\/sd-models\/'\]/,
    'the model paths the build can ship are named');
  assert.match(sw, /!isServedStatic && u\.href\.startsWith\(SCOPE \+ 'api\/'\)/,
    'the chat API is still answered at once on a static host');
  assert.match(sw, /BIG_ASSET = .*gguf/, 'and a model file is streamed, never copied into the SW cache');
  if (fs.existsSync('dist/sw.js')) {
    assert.match(fs.readFileSync('dist/sw.js', 'utf8'), /SERVED_STATIC/, 'the built worker carries the exclusion');
  }
});

test('the Pages deploy pre-caches after the tests, before the build, and cannot fail', () => {
  const yml = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
  const tests = yml.indexOf('- run: npm test');
  const precache = yml.indexOf('npm run precache');
  const build = yml.indexOf('- run: npm run build');
  assert.ok(tests > 0 && precache > 0 && build > 0, 'all three steps exist');
  assert.ok(tests < precache && precache < build, 'a deploy that cannot reach Hugging Face still builds and ships');
  const step = yml.slice(yml.lastIndexOf('- name: Pre-cache', precache), build);
  assert.match(step, /continue-on-error: true/);
  assert.match(yml, /actions\/cache@v4/, 'the weights are cached between deploys instead of re-downloaded');
  assert.match(yml, /path: \.cache\/waffle-ai/);
});

test('npm run precache is the same command the deploy runs', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts.precache, 'node scripts/fetch-model.mjs --all-small --max-mb=160');
  const script = fs.readFileSync('scripts/fetch-model.mjs', 'utf8');
  assert.match(script, /--max-mb=/, 'the flag the script documents is the one it parses');
  assert.match(script, /export function planBudget/, 'the budget rule is exported so it can be tested without a network');
  assert.ok(!/^main\(\);$/m.test(script), 'importing the script must not start a download');
});
