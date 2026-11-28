/**
 * The image engine, and the reason it is tested this hard.
 *
 * The engine this replaced asked the deployed site for two Stable Diffusion
 * checkpoints under `api/waffle-ai/sd-models/`. Nothing in the repository ever
 * produced that directory, so every `/imagine` died with `Model file HTTP 404`
 * after it had already tokenised the prompt. Three assertions that would have
 * caught it were wrapped in `if (fs.existsSync('.cache/waffle-ai/sd-models'))` —
 * a check for a folder that did not exist, so they never ran, and the one that
 * did run pinned the broken model menu as correct.
 *
 * So this file tests the plumbing that decides whether a generation can even
 * start: the menu, the engine it names, the storage maths that refuses a hopeless
 * run, the clamps on size and steps, the progress bands, the failure sentences,
 * and the build steps that put the engine's assets where the browser can fetch
 * them. What it cannot do is run the model — that needs a WebGPU device and
 * several gigabytes of download, and this runner has neither. That limit is
 * written down in the changelog entry rather than left for somebody to discover.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const engineSrc = fs.readFileSync('waffle-image-gen.js', 'utf8');
const aiSrc = fs.readFileSync('waffle-ai.js', 'utf8');
const appSrc = fs.readFileSync('app.js', 'utf8');
const viteSrc = fs.readFileSync('vite.config.js', 'utf8');

// The header of waffle-image-gen.js records what the old engine asked for and why
// that could never work, so the paths it names appear in prose. What must be
// absent from a build is the code, not the words.
const stripped = src => src.split('\n').filter(l => !/^\s*(?:\/\/|\*|\/\*)/.test(l)).join('\n');
const engineCode = stripped(engineSrc);
const viteCode = stripped(viteSrc);

// The module reads `self.crossOriginIsolated` and `navigator.userAgent` when it is
// called, not when it is imported, so a plain node import is safe — but the calls
// need both to exist. Assignment to globalThis.navigator throws in modern node, so
// it is defined rather than assigned.
globalThis.self = { crossOriginIsolated: false };
// The stored image-model choice lives in localStorage, which node does not have;
// without a shim the write is swallowed and every read looks like the default —
// exactly the failure mode this file is here to catch.
const prefs = new Map();
globalThis.localStorage = {
  getItem: k => (prefs.has(String(k)) ? prefs.get(String(k)) : null),
  setItem: (k, v) => prefs.set(String(k), String(v)),
  removeItem: k => prefs.delete(String(k)),
  clear: () => prefs.clear()
};
Object.defineProperty(globalThis, 'navigator', {
  value: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/141.0.0.0 Safari/537.36', hardwareConcurrency: 8 },
  configurable: true,
  writable: true
});

const {
  IMAGE_MODELS,
  KLEIN_BASE,
  resolveImageModel,
  isRetiredImageModel,
  autoImageMode,
  ortThreads,
  detectImageCapabilities,
  imageStorageRoom,
  resetImageCapabilities
} = await import('../waffle-image-gen.js');

const withUA = async (ua, fn) => {
  const prev = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', { value: { ...prev, userAgent: ua }, configurable: true, writable: true });
  try {
    return await fn();
  } finally {
    Object.defineProperty(globalThis, 'navigator', { value: prev, configurable: true, writable: true });
  }
};

/* --------------------------------- the menu --------------------------------- */

test('the image menu names one model family, and every entry can be rendered', () => {
  assert.ok(IMAGE_MODELS.length >= 1, 'there is something to choose from');
  for (const m of IMAGE_MODELS) {
    assert.ok(m.id && m.name && m.badge && m.sizeLabel, `${m.id} carries the four strings the Settings pill prints`);
    assert.ok(['auto', 'desktop', 'mobile'].includes(m.mode), `${m.id} picks an engine build that exists`);
    assert.equal(m.requiresWebGPU, true, `${m.id} says it needs WebGPU, because a WGSL transformer has no CPU path`);
    assert.ok(m.defaultSteps >= 2 && m.defaultSteps <= 8, `${m.id} asks for a step count the engine can do`);
    assert.ok(m.defaultSize % 16 === 0 && m.defaultSize >= 128 && m.defaultSize <= 1024,
      `${m.id} defaults to a side the transformer can pack`);
  }
  assert.ok(IMAGE_MODELS.some(m => m.mode === 'auto'), 'and one of them lets the engine pick');
});

test('the two dead checkpoints are gone from the menu but not from a saved choice', () => {
  assert.ok(!IMAGE_MODELS.some(m => m.id === 'sdxs-512' || m.id === 'sd-turbo'),
    'neither retired model is offered any more');
  assert.ok(isRetiredImageModel('sdxs-512') && isRetiredImageModel('sd-turbo'),
    'and both are still recognised as retired, so a stored selection can be spotted');
  for (const old of ['sdxs-512', 'sd-turbo', '', null, undefined, 'nonsense']) {
    const cfg = resolveImageModel(old);
    assert.ok(cfg && cfg.id, `${String(old)} resolves to a real model instead of undefined`);
    assert.ok(IMAGE_MODELS.includes(cfg), 'and to one that is on the menu');
  }
  assert.equal(resolveImageModel(IMAGE_MODELS[1].id).id, IMAGE_MODELS[1].id, 'a current choice is left alone');
  assert.match(aiSrc, /return resolveImageModel\(getSelectedImageModel\(\)\);/,
    'the chat surface resolves through that, so an old save cannot crash a generation');
});

/* ------------------------- the stored selection ------------------------- */

test('a choice of image model survives being stored, including a new one', async () => {
  // Both accessors used to clamp the id to the retired pair, so anything else was
  // written down as `sdxs-512` and read back as it. That made the new menu
  // impossible to select, which is the kind of bug no amount of engine work fixes.
  const store = await import('../waffle-browser-ai.js');
  const { getSelectedImageModel, setSelectedImageModel } = store;
  for (const m of IMAGE_MODELS) {
    setSelectedImageModel(m.id);
    assert.equal(getSelectedImageModel(), m.id, `${m.id} comes back as itself`);
  }
  setSelectedImageModel('sdxs-512');
  assert.equal(getSelectedImageModel(), 'sdxs-512', 'a retired id is stored rather than silently rewritten');
  assert.equal(resolveImageModel(getSelectedImageModel()).mode, 'auto',
    'and resolves to a model that exists, which is where the menu is allowed to change');
  const src = fs.readFileSync('waffle-browser-ai.js', 'utf8');
  assert.ok(!/saved === 'sd-turbo' \? 'sd-turbo' : 'sdxs-512'/.test(src), 'the clamp on reading is gone');
  assert.ok(!/id === 'sd-turbo' \? 'sd-turbo' : 'sdxs-512'/.test(src), 'and so is the one on writing');
});

/* ------------------------------ device and mode ----------------------------- */

test('which build runs is decided by the device, and the thread count by the isolation flag', async () => {
  assert.equal(await withUA('Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15', autoImageMode), 'mobile',
    'an iPhone gets the streamed build');
  assert.equal(await withUA('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15', autoImageMode), 'mobile',
    'so does an iPad, which reports MacIntel with touch points');
  assert.equal(await withUA('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36', autoImageMode), 'mobile',
    'and an Android phone');
  assert.equal(await withUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0.0.0', autoImageMode), 'desktop',
    'while a desktop gets the resident one');

  // The site has not sent COOP/COEP since the headers stopped workers from
  // starting on GitHub Pages, so this lands on one thread everywhere — and the
  // engine tolerates that, a few seconds slower per prompt.
  globalThis.self = { crossOriginIsolated: false };
  assert.equal(ortThreads(), 1, 'a page without isolation asks ONNX Runtime for one thread');
  globalThis.self = { crossOriginIsolated: true };
  assert.equal(ortThreads(), 4, 'and one that has it asks for cores, capped at four');
  globalThis.self = { crossOriginIsolated: false };
  assert.match(engineSrc, /self\.crossOriginIsolated \? Math\.min\(4, navigator\.hardwareConcurrency \|\| 2\) : 1/,
    'still reading the same flag the chat pipeline reads');
});

test('a browser without WebGPU is refused in words, before anything is downloaded', async () => {
  resetImageCapabilities();
  const prev = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: prev.userAgent, hardwareConcurrency: 8 }, // no `gpu`
    configurable: true, writable: true
  });
  const caps = await detectImageCapabilities();
  assert.equal(caps.hasWebGPU, false);
  assert.match(caps.reason, /WebGPU/, 'the reason names the missing API');
  assert.match(caps.reason, /Chrome or Edge 121\+|Safari 18\+/, 'and what would have it');
  assert.match(caps.reason, /text chat|Text chat/, 'while saying plainly that the rest of the AI still works');

  await assert.rejects(
    () => import('../waffle-image-gen.js').then(m => m.generateWaffleImage({ prompt: 'a waffle' })),
    err => {
      assert.equal(err.code, 'no-webgpu', 'the failure is tagged, so the chat can point at the device popup');
      assert.match(err.message, /WebGPU/);
      return true;
    }
  );
  Object.defineProperty(globalThis, 'navigator', { value: prev, configurable: true, writable: true });
  resetImageCapabilities();
});

test('a browser that will not hold the weights is told so before it spends a data plan', async () => {
  resetImageCapabilities();
  const prev = globalThis.navigator;
  const withQuota = quota => Object.defineProperty(globalThis, 'navigator', {
    value: {
      userAgent: prev.userAgent,
      hardwareConcurrency: 8,
      gpu: { requestAdapter: async () => ({ features: new Set(['shader-f16']), limits: {} }) },
      storage: { estimate: async () => ({ quota, usage: 0 }) }
    },
    configurable: true, writable: true
  });

  withQuota(1 * 1024 ** 3); // 1 GB offered, ~3.3 GB needed
  const caps = await detectImageCapabilities();
  assert.equal(caps.hasWebGPU, true, 'WebGPU is there');
  assert.equal(caps.quotaOK, false, 'and the quota is not enough');
  const room = await imageStorageRoom('mobile');
  assert.equal(room.needGB, 3.3, 'the phone build needs what the engine documents');
  assert.equal(room.ok, false);

  await assert.rejects(
    () => import('../waffle-image-gen.js').then(m => m.generateWaffleImage({ prompt: 'a waffle' })),
    err => {
      assert.equal(err.code, 'storage');
      assert.match(err.message, /GB/, 'the refusal is in gigabytes, not in an errno');
      assert.match(err.message, /Settings|clear/i, 'and it says where the way out is');
      return true;
    }
  );

  withQuota(60 * 1024 ** 3); // plenty
  resetImageCapabilities();
  const wide = await imageStorageRoom('desktop');
  assert.equal(wide.ok, true, 'a roomy browser is waved through');
  assert.equal(wide.needGB, 5, 'and the desktop build is asked for the larger figure');

  Object.defineProperty(globalThis, 'navigator', { value: prev, configurable: true, writable: true });
  resetImageCapabilities();
});

test('a browser that will not answer about storage is allowed to try', async () => {
  resetImageCapabilities();
  const prev = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      userAgent: prev.userAgent,
      hardwareConcurrency: 8,
      gpu: { requestAdapter: async () => ({ features: new Set(), limits: {} }) }
      // no navigator.storage at all
    },
    configurable: true, writable: true
  });
  const caps = await detectImageCapabilities();
  assert.equal(caps.hasWebGPU, true);
  assert.equal(caps.quotaOK, null, 'unknown is not the same as no');
  assert.equal(await imageStorageRoom('mobile'), null, 'so there is nothing to refuse the run against');
  Object.defineProperty(globalThis, 'navigator', { value: prev, configurable: true, writable: true });
  resetImageCapabilities();
});

/* --------------------------- the weights on disk ---------------------------- */

test('the cached-weights readout measures the directory without loading the engine', async () => {
  // Reading one number for a Settings button used to be able to cost a 28 kB
  // gzipped import of the whole pipeline. These two walk the directory instead,
  // and the only dynamic import of the engine in the module is the one that
  // starts a generation.
  const imports = engineSrc.match(/import\('flux-klein\.js'\)/g) || [];
  assert.equal(imports.length, 1, 'exactly one place imports the engine');
  const bodyOf = name => {
    const at = engineSrc.indexOf(`export async function ${name}(`);
    assert.ok(at >= 0, `${name} is exported`);
    return engineSrc.slice(at, engineSrc.indexOf('\n}', at));
  };
  for (const fn of ['imageCacheInfo', 'clearImageModelCache']) {
    assert.ok(!bodyOf(fn).includes('import('), `${fn} reads the directory itself`);
  }

  // And it really does measure, rather than reporting a number nobody checked.
  const { imageCacheInfo, clearImageModelCache } = await import('../waffle-image-gen.js');
  const sizes = { 'te_q8.onnx': 1_000_000, 'shard_0.bin': 2_500_000, 'vae_tiny.onnx': 11_000_000 };
  const files = new Map(Object.entries(sizes));
  const dir = {
    kind: 'directory',
    async *entries() {
      for (const [name, size] of files) yield [name, { kind: 'file', name, getFile: async () => ({ size }) }];
    },
    removeEntry: async name => { files.delete(name); }
  };
  const prev = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      ...prev,
      storage: {
        getDirectory: async () => ({ getDirectoryHandle: async () => dir }),
        estimate: async () => ({ quota: 40 * 1024 ** 3, usage: 14 * 1024 ** 3 }),
        persisted: async () => true
      }
    },
    configurable: true, writable: true
  });
  resetImageCapabilities();

  const info = await imageCacheInfo();
  assert.equal(info.files, 3, 'every file in the directory was counted');
  assert.equal(info.bytes, 14_500_000, 'and their sizes added up');
  assert.equal(info.persisted, true, 'whether the browser will keep them is reported too');
  assert.equal(info.available, true);

  const cleared = await clearImageModelCache();
  assert.equal(cleared.freed, 14_500_000, 'clearing says how much it gave back');
  assert.equal(files.size, 0, 'and the directory is actually empty afterwards');
  assert.equal((await imageCacheInfo()).bytes, 0, 'which the next readout agrees on');

  Object.defineProperty(globalThis, 'navigator', { value: prev, configurable: true, writable: true });
  resetImageCapabilities();
});

/* --------------------------- sizes, steps, progress -------------------------- */

test('sizes land on the packing grid and steps on a count the engine can run', () => {
  assert.match(engineSrc, /const SIDE_STEP = 16;/, 'the grid the transformer packs latents on');
  assert.match(engineSrc, /const MIN_SIDE = 128;/);
  assert.match(engineSrc, /const MAX_SIDE = 1024;/);
  assert.match(engineSrc, /function snapSide\(n\) \{/, 'and a requested side is snapped to it');
  assert.match(engineSrc, /Math\.max\(MIN_SIDE, Math\.min\(MAX_SIDE, v \|\| MIN_SIDE\)\)/,
    'clamped at both ends, with a fallback for a size that is not a number');
  assert.match(engineSrc, /function sideWithinArea\(side, maxArea\)/,
    'then narrowed again to the area the GPU can actually bind');
  assert.match(engineSrc, /eng\.limits\?\.maxArea/, 'which comes from the engine, not from a guess in this file');
  assert.match(engineSrc, /KLEIN_MIN_STEPS = 2/, 'one step needs the optional LoRA this kitchen does not ship');
  assert.match(engineSrc, /Math\.max\(KLEIN_MIN_STEPS, Math\.min\(KLEIN_MAX_STEPS, Number\(steps\) \|\| cfg\.defaultSteps\)\)/,
    'so the step count is clamped the same way');
});

test('progress is a band per stage, and the bar says when it is only guessing', () => {
  assert.match(engineSrc, /const PHASES = \{/, 'every stage owns a slice of the bar');
  for (const stage of ['weights', 'denoise', 'decode', 'text-encoder', 'tokenizer', 'encode-reference']) {
    // The hyphenated stages are quoted keys, so the quote is optional here.
    assert.ok(new RegExp(`'?${stage}'?:\\s*\\{ label:`).test(engineSrc), `${stage} has a band and a label`);
  }
  assert.match(engineSrc, /progressFraction/, 'a stage this file has no rule for still gets the engine’s own fraction');
  assert.match(engineSrc, /formatProgress/, 'and so does the sentence, so nothing invents wording');

  // The two ways the bar that shipped first lied, both pinned here because both
  // looked correct and both were reported from a real device as "stuck":
  //   • weights arrive in shards and each shard restarts its own loaded/total at
  //     zero, so the bar climbed once and then waited at the clamp;
  //   • a stage with nothing to measure printed the floor of its band, and the
  //     rule against walking backwards held that number for the whole stage.
  assert.match(engineSrc, /\(shard - 1 \+ one\) \/ shards/, 'shards fold into one walk across the band');
  assert.match(engineSrc, /if \(d\.cached\) return 1;/, 'a stage that was instant is finished, not 0% of itself');
  assert.match(engineSrc, /indeterminate/, 'and a report says when its number is a band edge rather than a reading');
  assert.match(engineSrc, /RATE_MIN_MS/, 'an estimate waits for a rate that was actually measured');
  assert.match(engineSrc, /state\.lastPercent = Math\.max\(state\.lastPercent/, 'the bar still only moves forward');
  assert.match(engineSrc, /if \(!phase\) \{/, 'and an event this file has never heard of is printed anyway');

  assert.match(aiSrc, /p\.indeterminate \? humanDuration\(p\.elapsedMs/,
    'the header badge reads elapsed time when there is nothing to measure');
  assert.ok(!/· \$\{p\.stage\} \(\$\{p\.percent\}%\)/.test(aiSrc),
    'and no longer prints a percentage it cannot back up');
  assert.match(aiSrc, /stampElapsed/, 'the bubble carries the run’s own clock');
  assert.match(aiSrc, /is-indeterminate/, 'so a phase with no fraction is drawn as one');
});

test('a second generation reports to its own bubble, not the first one’s', () => {
  // The engine is kept between runs — that is the point, a warm run skips the
  // download — so it cannot be handed one run's callback when it is built. A
  // second picture would otherwise have drawn its progress into the first one's
  // message, and a late GPU event could put a bar back on a finished one.
  assert.match(engineSrc, /let progressSink = null;/, 'progress goes through a sink the run sets');
  assert.match(engineSrc, /onEvent: ev => \{\n      if \(isDeviceLostEvent\(ev\)\)/,
    'which the engine reads when the event happens, not when it was created');
  assert.match(engineSrc, /reportProgress\(ev, progressSink\);\n    \}/, 'and still forwards every event to whichever run is live');
  assert.match(engineSrc, /progressSink = typeof onProgress === 'function' \? onProgress : null;/, 'set per run');
  const cleared = engineSrc.indexOf('progressSink = null;\n    releaseScreenLock();');
  assert.ok(cleared > engineSrc.indexOf('res = await Promise.race(['), 'and cleared in a finally once the run is over');
  assert.match(engineSrc, /if \(!onProgress\) return;/, 'so an event with nowhere to go is dropped');

  // Starting the engine is where a first run fetches the tokenizer, the ORT wasm
  // and the GPU device — most of the ways a first run can fail happen there, so
  // those failures get the same plain-language treatment as the generation's.
  const tryAt = engineSrc.indexOf('  try {\n    if (signal?.aborted)');
  const ensureAt = engineSrc.indexOf('eng = await ensureEngine({ mode });');
  assert.ok(tryAt > 0, 'the run has one try block');
  assert.ok(ensureAt > tryAt, 'and building the engine is inside it');
  assert.match(engineSrc, /throw explainFailure\(err, \{ mode, side \}\);\n  \} finally \{/,
    'with the explanation on the way out either way');
});

test('a failure says which failure it was, and an unknown one keeps its own message', () => {
  assert.match(engineSrc, /function explainFailure\(err, \{ mode, side \}\)/);
  assert.match(engineSrc, /name === 'AbortError' \|\| \/aborted\/i\.test\(text\)/,
    'a stop is still a stop, so the chat can say "Stopped image generation"');
  assert.match(engineSrc, /This browser cannot run the image model/, 'no WebGPU');
  assert.match(engineSrc, /The GPU ran out of room at \$\{side\}×\$\{side\}/, 'an out-of-memory names the size it died at');
  assert.match(engineSrc, /would not keep the image weights on disk/, 'a storage refusal');
  assert.match(engineSrc, /could not be downloaded from the model host/, 'a dropped download');
  assert.match(engineSrc, /whatever already arrived is kept, so the next attempt resumes/,
    'and says the retry is cheaper, because the cache resumes with HTTP Range');
  assert.match(engineSrc, /Image generation stopped: \$\{text\}/,
    'anything unrecognised passes its own message through instead of being dressed up');
  assert.match(engineSrc, /e\.cause = err/, 'with the original error attached for whoever debugs it');
  assert.match(aiSrc, /err\.code === 'no-webgpu'/, 'the chat surface points a device failure at the device popup');
});

/* ------------------------------ what ships, where ---------------------------- */

test('the weights are streamed, and the assets that cannot be are copied by the build', () => {
  assert.match(engineSrc, /export const KLEIN_BASE = 'https:\/\/huggingface\.co\/radames\/flux2-klein-edge-web\/resolve\/main';/,
    'the weights come from the model repo, named in one place');
  assert.match(engineSrc, /First run streams the weights from \$\{new URL\(KLEIN_BASE\)\.host\}/,
    'and the first run says so before it starts');
  assert.ok(!engineCode.includes('api/waffle-ai/sd-models'), 'the directory nothing ever produced is not asked for any more');
  assert.ok(!engineCode.includes('SD_PARTS') && !engineCode.includes('studio-ai'),
    'and neither are the chunk tables that described it');
  assert.ok(!fs.existsSync('api/waffle-ai/sd-models'), 'nor is it sitting in the tree');

  // The engine finds its tokenizer with `new URL('../tokenizer/', import.meta.url)`
  // marked @vite-ignore, and a bundler emits no directory for that. The build has
  // to serve one, or the first thing a generation does is fail.
  assert.match(viteSrc, /node_modules\/flux-klein\.js\/tokenizer/, 'the build knows where the tokenizer lives');
  assert.match(viteSrc, /dist\/flux-klein-tokenizer/, 'and copies it somewhere the browser can fetch');
  for (const f of ['tokenizer.json', 'tokenizer_config.json', 'chat_template.jinja']) {
    assert.ok(viteSrc.includes(`'${f}'`), `${f} is one of the files it copies`);
  }
  assert.match(viteSrc, /'\/flux-klein-tokenizer\/', kleinTokenizerRoot/, 'the dev server mounts the same path');
  assert.match(engineSrc, /probe\('flux-klein-tokenizer\/tokenizer\.json'\)/,
    'the module looks for it there and hands the directory over as tokenizerUrl');
  assert.match(engineSrc, /\.\.\.\(tokenizerUrl \? \{ tokenizerUrl \} : \{\}\)/, 'only when it is really there');

  // ONNX Runtime's wasm: self-hosted where the build already puts it, CDN when not.
  assert.match(engineSrc, /probe\('ort\/ort-wasm-simd-threaded\.wasm'\)/, 'the wasm is probed too');
  assert.match(engineSrc, /!\/html\/i\.test\(res\.headers\.get\('content-type'\) \|\| ''\)/,
    'and a static host that answers a missing file with its index.html does not fool the probe');
  assert.match(viteSrc, /exclude: \['flux-klein\.js', 'onnxruntime-web'\]/,
    'the package is left alone in dev, so its worker and its import.meta.url assets resolve');
  assert.match(viteSrc, /!p\.startsWith\('\.\/flux-klein-tokenizer\/'\)/,
    'and the tokenizer is not precached into the service worker with the app shell');
});

test('the engine gets no cross-origin isolation headers back, and does not need them', () => {
  // Removing COOP/COEP is what made workers start again on GitHub Pages. ONNX
  // Runtime threads need them; the engine tolerates their absence.
  assert.ok(!viteCode.includes("headers.set('Cross-Origin-Opener-Policy'"), 'no isolation header is sent');
  assert.ok(!viteCode.includes('Cross-Origin-Embedder-Policy'), 'and no embedding policy either');
  assert.match(viteSrc, /COEP credentialless/, 'and the comment still says which one it was, so it is not re-added');
  assert.match(engineSrc, /GitHub Pages plus those headers is what broke/, 'with the reason, where the engine is configured');
  assert.match(engineSrc, /No COOP\/COEP/, 'the trade is written down where the engine is configured');
  assert.match(engineSrc, /it runs single-threaded/, 'in the words the library documents it in');
  assert.match(engineSrc, /seconds slower per prompt/, 'with the cost of that stated rather than hidden');
});

/* ------------------------------- the surfaces -------------------------------- */

test('the chat and Settings surfaces describe the engine that is actually there', () => {
  // The two retired names survive in exactly one place: the caption of a picture
  // a saved thread still holds from the old engine, which has to keep saying how
  // it was made. They are gone from everything that advertises a model.
  const aiCode = aiSrc.split('\n').filter(l => !/^\s*(?:\/\/|\*|\/\*)/.test(l)).join('\n');
  const retiredLines = aiCode.split('\n').filter(l => /SDXS-512|SD-Turbo/.test(l));
  assert.equal(retiredLines.length, 1, 'one line mentions the retired pair, and it is the caption helper');
  assert.match(retiredLines[0], /isRetiredImageModel/, 'which is the line that only runs for a retired id');
  assert.match(retiredLines[0], /retired engine/, 'and it says so on the picture it captions');
  assert.match(aiCode, /isRetiredImageModel\(id\)/, 'which is reached only for a retired id');
  assert.ok(!aiSrc.includes('Toggle Image Generation mode (SDXS'), 'the image toggle no longer advertises them');
  assert.match(aiSrc, /FLUX\.2 Klein 4B — needs WebGPU/, 'the image toggle names the model and its requirement');
  assert.ok(!aiSrc.includes("'WASM CPU Fallback'"), 'and the badge no longer promises a CPU path a WGSL transformer does not have');
  assert.match(aiSrc, /needs WebGPU · not available here/, 'saying what it is instead');
  assert.match(aiSrc, /size: imgCfg\.defaultSize/, 'the size the chosen model wants is passed through');
  assert.match(aiSrc, /res\.modelName \|\| res\.model/, 'and the result names the model in words');

  // The prompt-polishing step used to ask for Stable Diffusion tags. Klein's text
  // encoder is a distilled Qwen3 behind a chat template, which wants a sentence.
  assert.ok(!aiSrc.includes('Stable Diffusion image prompt'), 'the polish step is not writing for a 2023 model');
  assert.match(aiSrc, /one vivid sentence describing a picture/, 'it asks for what this encoder was distilled on');

  assert.match(appSrc, /settings-img-cache-clear/, 'Settings has the button that gives the storage back');
  assert.match(appSrc, /Clear cached image weights/);
  assert.match(appSrc, /imageCacheInfo\(\)\.then\(info =>/, 'and it says how much is cached before offering to delete it');
  assert.match(appSrc, /clearImageModelCache\(\)/, 'deleting goes through the engine, so the GPU is released too');
});

test('the module still exposes what the rest of the kitchen imports from it', () => {
  for (const name of ['IMAGE_MODELS', 'detectImageCapabilities', 'generateWaffleImage', 'isImageGenPaused', 'IMAGE_GEN_PAUSE_MESSAGE']) {
    assert.match(engineSrc, new RegExp(`export (async )?function ${name}|export const ${name}`), `${name} is still exported`);
  }
  assert.equal(typeof detectImageCapabilities, 'function');
  assert.match(engineSrc, /export async function generateWaffleImage\(\{/, 'with the same destructured contract it has always had');
  for (const arg of ['model', 'prompt', 'seed', 'steps', 'size', 'onProgress', 'signal']) {
    assert.ok(new RegExp(`\\n  ${arg}[ =,]`).test(engineSrc) || new RegExp(`\\n  ${arg}\\n`).test(engineSrc),
      `${arg} is still accepted`);
  }
  assert.match(engineSrc, /dataUrl: canvas\.toDataURL\('image\/png'\)/, 'and still returns a PNG data URL');
  assert.match(aiSrc, /import \{\n  IMAGE_MODELS,\n  resolveImageModel,\n  isRetiredImageModel,\n  detectImageCapabilities,\n  generateWaffleImage,\n  imageCacheInfo,\n  clearImageModelCache,\n  humanDuration,\n  screenLockState,\n  isImageGenPaused,\n  IMAGE_GEN_PAUSE_MESSAGE\n\} from '\.\/waffle-image-gen\.js';/,
    'which is what the AI panel imports — humanDuration included, so the bubble and the header badge word the same wait the same way, screenLockState so the device facts can say whether a run can be protected at all, and the pause so the run can refuse before it creates a progress bubble it cannot fill');
  assert.match(appSrc, /IMAGE_MODELS,\n  detectImageCapabilities,\n  imageCacheInfo,\n  clearImageModelCache,\n  screenLockState,\n  isImageGenPaused,\n  IMAGE_GEN_PAUSE_MESSAGE\n\} from '\.\/waffle-image-gen\.js';/,
    'and what Settings does');
  for (const name of ['screenLockSupported', 'screenLockState', 'holdScreenForRun', 'releaseScreenLock', 'gpuLostState', 'clearGpuLost']) {
    assert.match(engineSrc, new RegExp(`export (async )?function ${name}`), `${name} is exported so the panel and the tests can ask`);
  }
  assert.equal(KLEIN_BASE.startsWith('https://huggingface.co/'), true, 'the weights host is https');
});
