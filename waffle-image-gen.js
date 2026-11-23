/**
 * Waffle AI — image generation in the browser, on FLUX.2 Klein 4B.
 *
 * WHY THIS FILE WAS REWRITTEN
 * The first engine asked for two Stable Diffusion checkpoints under
 * `./api/waffle-ai/sd-models/` (SDXS-512 and SD-Turbo, ~675 MB and ~2.5 GB of
 * ONNX split into numbered chunks). Nothing in the repository ever produced that
 * directory: the model fetcher is GGUF-only, the build's `closeBundle` copies
 * games, runtimes, GGUF weights and the ORT runtimes, CI precaches GGUF only,
 * and `git ls-files` has zero entries under `sd-models`. The dev middleware
 * pointed the route at a `.cache/waffle-ai/sd-models` folder nothing fills, and
 * the three tests that would have caught it were wrapped in `fs.existsSync`.
 * So every `/imagine` on the deployed site died the same way, on every device:
 *
 *     Image generation hit a bump: Model file HTTP 404: studio-ai-hq3/t2i09/te09/gq.onnx
 *
 * — after tokenising the prompt and, for short ones, after running a whole chat
 * model to polish it first. Replacing the missing chunks was not an option
 * either: both checkpoints together are over the build's 400 MB self-host budget,
 * and 2023-era SD at 512² is not what this kitchen should be shipping now.
 *
 * WHAT IT IS NOW
 * `flux-klein.js` (MIT) is a WebGPU port of FLUX.2 Klein 4B — Apache-2.0, the
 * model Bonsai Image 4B is itself derived from. Its peer dependencies
 * (`@huggingface/transformers` and `onnxruntime-web`) are the two this kitchen
 * already ships, so the engine adds code (~12 MB with its tokenizer) and no new
 * runtime.
 *
 * The weights are deliberately NOT vendored. They stream from the model's
 * Hugging Face repo into the browser's own origin-private storage on first use,
 * so a deploy costs nothing extra and the kitchen stays inside its self-host
 * budget. The trade is honest and worth stating: the first generation downloads
 * ~3.3 GB (phone build) or ~5 GB (desktop build), and it needs the browser to be
 * allowed to keep that much.
 *
 * The two builds under one entry point:
 *   desktop — int8 transformer resident on the GPU (~4 GB), the fast path;
 *   mobile  — int4 shards streamed from storage through a small GPU ring
 *             (~0.6 GB resident), built to survive a phone's 2 GB tab cap.
 * `mode: 'auto'` picks by user agent; the Settings pills can force either.
 *
 * No COOP/COEP: ONNX Runtime's wasm threads need cross-origin isolation, which
 * this site removed on purpose (GitHub Pages plus those headers is what broke
 * workers site-wide). The engine tolerates it — it runs single-threaded, a few
 * seconds slower per prompt. `ortThreads()` below keeps asking for one thread
 * only, exactly like the chat pipeline does.
 */

/** The model repo the weights stream from. `flux-klein.js`' own default; named
 *  here so a future self-host is a one-line change and so the Settings copy can
 *  tell the truth about where the gigabytes come from. */
export const KLEIN_BASE = 'https://huggingface.co/radames/flux2-klein-edge-web/resolve/main';

/** Our own directory in the browser's origin-private storage, not the library's
 *  default, so clearing the kitchen's model cache never surprises anything else
 *  on the origin. */
const KLEIN_CACHE_DIR = 'waffle-ai-klein-v1';

/** What the two builds need on disk, from the library's own documented figures
 *  (`limits.NEED_GB` is 3.3 for the phone build; the desktop download is ~5 GB).
 *  Used only to refuse a hopeless run *before* it eats somebody's data plan. */
const STORAGE_NEED_GB = { mobile: 3.3, desktop: 5 };

/** The tiny VAE decoder (fal's 2.9M-parameter TAE): ~11 MB instead of ~107 MB
 *  per output shape and about a twentieth of the decode work, at the cost of
 *  slightly softer textures. On a phone that trade is not close. */
const KLEIN_DECODER = 'tiny';

/** 2 steps is the library's "fast and good" setting; 4 is sharper and roughly
 *  twice the GPU time. 1 needs the optional SANA-Sprint LoRA (+0.39 GB), which
 *  this kitchen does not ship. */
const KLEIN_MIN_STEPS = 2;
const KLEIN_MAX_STEPS = 8;

const SIDE_STEP = 16;
const MIN_SIDE = 128;
const MAX_SIDE = 1024;

export const IMAGE_MODELS = [
  {
    id: 'klein-auto',
    name: 'FLUX.2 Klein 4B',
    badge: 'Recommended · picks your build',
    sizeLabel: 'First run streams ~3.3–5 GB of weights, then they stay cached',
    mode: 'auto',
    requiresWebGPU: true,
    defaultSteps: KLEIN_MIN_STEPS,
    defaultSize: 768
  },
  {
    id: 'klein-desktop',
    name: 'Klein 4B · desktop build',
    badge: 'Sharpest · ~4 GB in GPU memory',
    sizeLabel: 'First run streams ~5 GB of weights, then they stay cached',
    mode: 'desktop',
    requiresWebGPU: true,
    defaultSteps: KLEIN_MIN_STEPS,
    defaultSize: 768
  },
  {
    id: 'klein-mobile',
    name: 'Klein 4B · phone build',
    badge: 'Streams shards · ~0.6 GB resident',
    sizeLabel: 'First run streams ~3.3 GB of weights, then they stay cached',
    mode: 'mobile',
    requiresWebGPU: true,
    defaultSteps: KLEIN_MIN_STEPS,
    defaultSize: 512
  }
];

/** The model a stored id resolves to. Old saves can still say `sdxs-512` or
 *  `sd-turbo`; those engines are gone, so they land on the recommended one
 *  instead of throwing on a selection nobody can see. */
export function resolveImageModel(id) {
  return IMAGE_MODELS.find(m => m.id === id) || IMAGE_MODELS[0];
}

export function isRetiredImageModel(id) {
  return id === 'sdxs-512' || id === 'sd-turbo';
}

const hasNavigator = () => typeof navigator !== 'undefined';

const isPhoneUA = () => {
  if (!hasNavigator()) return false;
  const ua = navigator.userAgent || '';
  const ios = /iPhone|iPad|iPod/.test(ua)
    || (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1);
  return ios || /Android|Mobile/i.test(ua);
};

/**
 * ONNX Runtime wasm threads this page may use: up to four when the document is
 * cross-origin isolated, one when it is not — and on this deploy it is not, so
 * every device gets one. Same flag, same answer as the chat pipeline; the
 * isolation headers are not coming back (see the note at the top of this file).
 */
export function ortThreads() {
  return self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
}

/** Which of the library's two builds `auto` would pick here. */
export function autoImageMode() {
  return isPhoneUA() ? 'mobile' : 'desktop';
}

let capsCache = null;

/**
 * What this device can do, without importing the engine: WebGPU presence, the
 * fp16 shader feature, the build `auto` would choose, the thread count and
 * whether the browser will hold the weights. Called every time the overlay opens
 * and every time Settings re-renders, so it must stay cheap — the engine module
 * is only pulled in by `generateWaffleImage`.
 */
export async function detectImageCapabilities() {
  if (capsCache) return capsCache;
  const caps = {
    hasWebGPU: false,
    hasF16: false,
    reason: '',
    mode: autoImageMode(),
    threads: hasNavigator() ? ortThreads() : 1,
    quotaBytes: 0,
    usedBytes: 0,
    quotaOK: null
  };

  if (!hasNavigator() || !navigator.gpu) {
    caps.reason = 'This browser has no WebGPU, which the image model runs on. Chrome or Edge 121+, or Safari 18+, can do it — text chat works everywhere.';
    capsCache = caps;
    return caps;
  }

  try {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) {
      caps.reason = 'This device handed the page no GPU adapter (blocklisted or software-only graphics), so the image model cannot start. Text chat still works.';
      capsCache = caps;
      return caps;
    }
    caps.hasWebGPU = true;
    caps.hasF16 = Boolean(adapter.features?.has?.('shader-f16'));
  } catch (err) {
    caps.reason = `WebGPU refused to start here: ${err?.message || err}. Text chat still works.`;
    capsCache = caps;
    return caps;
  }

  try {
    const est = await navigator.storage?.estimate?.();
    if (est?.quota) {
      caps.quotaBytes = est.quota;
      caps.usedBytes = est.usage || 0;
      const need = STORAGE_NEED_GB[caps.mode] * 2 ** 30;
      caps.quotaOK = caps.quotaBytes >= need * 0.6;
    }
  } catch {}

  capsCache = caps;
  return caps;
}

/** Drop the memo — the device pill re-probes after the browser says storage was
 *  granted, and tests need a clean slate between cases. */
export function resetImageCapabilities() {
  capsCache = null;
}

/** How much room the chosen build needs, and whether the browser has it. Returns
 *  `null` when the browser would not say (no `navigator.storage.estimate`), which
 *  is not the same as "no" — that run is allowed to try. */
export async function imageStorageRoom(mode) {
  const caps = await detectImageCapabilities();
  const needGB = STORAGE_NEED_GB[mode] || STORAGE_NEED_GB.mobile;
  if (!caps.quotaBytes) return null;
  const free = caps.quotaBytes - caps.usedBytes;
  return {
    needGB,
    needBytes: needGB * 2 ** 30,
    quotaBytes: caps.quotaBytes,
    usedBytes: caps.usedBytes,
    quotaGB: caps.quotaBytes / 2 ** 30,
    usedGB: caps.usedBytes / 2 ** 30,
    freeGB: free / 2 ** 30,
    ok: free >= needGB * 2 ** 30 * 0.6
  };
}

/**
 * Refuse a run that cannot finish, before it downloads gigabytes. A browser
 * quota below what the weights need means the download will be thrown away — or
 * worse, will complete and then be evicted — so the honest thing is to say so up
 *  front rather than after somebody has spent their data plan.
 */
async function assertStorageRoom(mode) {
  const room = await imageStorageRoom(mode);
  if (!room || room.ok) return room;
  const err = new Error(
    `This browser will only hold about ${room.quotaGB.toFixed(1)} GB for the site and ${room.usedGB.toFixed(1)} GB is already used, and the ${mode} image model needs roughly ${room.needGB} GB of its own. Free up space first — Settings has a button that clears the cached image weights — then try again.`
  );
  err.code = 'storage';
  throw err;
}

// --- the engine -------------------------------------------------------------------------------

let kleinLib = null;
let engine = null;
let engineMode = '';
let assetProbe;

/**
 * The two things the engine needs served as plain files, found by probing rather
 * than by guessing.
 *
 *  - ORT's `.wasm`. The build copies the installed `onnxruntime-web/dist` to
 *    `dist/ort/` and the service worker serves it, so the kitchen self-hosts when
 *    it can; the library's fallback is the jsDelivr CDN, used when the local copy
 *    is not there. Probing matters because mixing one build's ORT JS with
 *    another's wasm downloads fine and then dies at session creation.
 *  - The tokenizer directory (`tokenizer.json`, `tokenizer_config.json`,
 *    `chat_template.jinja` — 5 MB of Qwen3 vocab). The library resolves it with
 *    `new URL('../tokenizer/', import.meta.url)` and marks it `@vite-ignore`, so
 *    a bundler leaves it pointing at a directory it never emitted. The build
 *    copies the package's `tokenizer/` to `dist/flux-klein-tokenizer/` and this
 *    hands that directory over instead. In dev the mount answers the same path,
 *    and if neither is there the library's own default is left alone — it works
 *    unbundled, which is what a dev server is.
 */
function resolveKleinAssets() {
  assetProbe ??= (async () => {
    // `ok` is not enough: a static host that answers a missing path with its
    // index.html would make an HTML document look like a wasm file or a JSON
    // vocab, and the failure would surface much later and much more cryptically.
    const probe = async rel => {
      try {
        const res = await fetch(new URL(rel, document.baseURI).href, { method: 'HEAD', cache: 'no-store' });
        if (!res.ok) return false;
        return !/html/i.test(res.headers.get('content-type') || '');
      } catch {
        return false;
      }
    };
    const [ort, tokenizer] = await Promise.all([
      probe('ort/ort-wasm-simd-threaded.wasm'),
      probe('flux-klein-tokenizer/tokenizer.json')
    ]);
    return {
      wasmPaths: ort ? new URL('ort/', document.baseURI).href : undefined,
      tokenizerUrl: tokenizer ? new URL('flux-klein-tokenizer/', document.baseURI).href : undefined
    };
  })();
  return assetProbe;
}

/**
 * Where progress goes right now.
 *
 * The engine outlives a single generation — that is the point of keeping it — so
 * it cannot be handed one run's callback at construction: a second picture would
 * have reported its progress to the first one's bubble. Events read this instead,
 * and it is cleared when a run ends, so a late `idle-release` from the GPU cannot
 * put a progress bar back on a message that already has its picture.
 */
let progressSink = null;

async function ensureEngine({ mode }) {
  if (engine && engineMode === mode) return engine;
  if (engine) {
    try { engine.destroy(); } catch {}
    engine = null;
    engineMode = '';
  }
  kleinLib ??= await import('flux-klein.js');
  const { wasmPaths, tokenizerUrl } = await resolveKleinAssets();
  engine = await kleinLib.createFluxKlein({
    mode,
    base: KLEIN_BASE,
    cacheDir: KLEIN_CACHE_DIR,
    decoder: KLEIN_DECODER,
    threads: ortThreads(),
    ...(wasmPaths ? { wasmPaths } : {}),
    ...(tokenizerUrl ? { tokenizerUrl } : {}),
    onEvent: ev => reportProgress(ev, progressSink)
  });
  engineMode = mode;
  return engine;
}

/** Let go of the GPU weights without touching the cached download. A phone that
 *  has just generated a picture does not want ~4 GB of GPU memory held against
 *  the rest of the tab's life, and the next generation re-uploads from storage. */
export function releaseImageEngine() {
  if (engine) {
    try { engine.destroy(); } catch {}
  }
  engine = null;
  engineMode = '';
}

/**
 * The directory the engine keeps its weights in, walked directly.
 *
 * Deliberately not the library's own `createCache({ dir }).cacheInfo()`. That
 * would import the whole engine — about 28 kB gzipped of pipeline, kernels and
 * sampling code — the first time anybody opened Settings, just to read one number
 * off a button. The cache is a directory of files under a name this file chose,
 * so counting it and emptying it is a directory walk, and the engine then loads
 * only when somebody actually asks for a picture.
 */
async function openWeightsDir(create = false) {
  try {
    const root = await navigator.storage?.getDirectory?.();
    if (!root) return null;
    return await root.getDirectoryHandle(KLEIN_CACHE_DIR, { create });
  } catch {
    return null;
  }
}

async function measureWeightsDir(dir) {
  let bytes = 0;
  let files = 0;
  if (!dir) return { bytes, files };
  for await (const [, handle] of dir.entries()) {
    if (handle.kind === 'file') {
      files++;
      try { bytes += (await handle.getFile()).size; } catch {}
    } else if (handle.kind === 'directory') {
      // One level is all the engine writes today; walking deeper costs nothing and
      // keeps this honest if a future version nests its shards.
      const sub = await measureWeightsDir(handle);
      bytes += sub.bytes;
      files += sub.files;
    }
  }
  return { bytes, files };
}

/** What the browser is holding for the image model, for the Settings line. */
export async function imageCacheInfo() {
  const blank = {
    dir: KLEIN_CACHE_DIR, files: 0, bytes: 0, quotaBytes: 0, usedBytes: 0,
    needGB: STORAGE_NEED_GB.mobile, persisted: false, available: false
  };
  try {
    const room = await imageStorageRoom(autoImageMode());
    const { bytes, files } = await measureWeightsDir(await openWeightsDir(false));
    const persisted = await navigator.storage?.persisted?.().catch(() => false);
    return {
      ...blank,
      files,
      bytes,
      quotaBytes: room?.quotaBytes ?? 0,
      usedBytes: room?.usedBytes ?? 0,
      needGB: room?.needGB ?? STORAGE_NEED_GB.mobile,
      persisted: Boolean(persisted),
      available: true
    };
  } catch {
    return blank;
  }
}

/** Delete the streamed weights. The only way to get that storage back from inside
 *  the page, and the fix the quota refusal tells people about. */
export async function clearImageModelCache() {
  let freed = 0;
  try {
    const dir = await openWeightsDir(false);
    if (dir) {
      freed = (await measureWeightsDir(dir)).bytes;
      for await (const [name] of dir.entries()) {
        await dir.removeEntry(name, { recursive: true }).catch(() => {});
      }
    }
  } catch {}
  // Whatever was resident goes with it, and the memoised probe is dropped so the
  // next look at this device reports the storage it now has.
  releaseImageEngine();
  resetImageCapabilities();
  return { freed };
}

// --- progress ---------------------------------------------------------------------------------

/**
 * Engine events → the kitchen's `{ stage, percent, detail }`. The bands are the
 * honest shape of a run: most of a first run is the download, most of a warm run
 * is the denoise, so each stage owns a slice and the library's own 0…1 fraction
 * fills it in. `detail` is `formatProgress` verbatim — the sentence the engine
 * would have logged — so nothing here has to invent wording.
 */
const PHASES = {
  cache:            { label: 'Checking cached weights', from: 1,  to: 3 },
  warning:          { label: 'Warning',                 from: 1,  to: 3 },
  tokenizer:        { label: '1/4 · Loading tokenizer',  from: 3,  to: 6 },
  'text-encoder':   { label: '1/4 · Text encoder',       from: 6,  to: 30 },
  embeddings:       { label: '1/4 · Token embeddings',   from: 30, to: 36 },
  weights:          { label: '2/4 · Streaming weights',  from: 36, to: 66 },
  'weights-upload': { label: '2/4 · Uploading to GPU',   from: 66, to: 72 },
  'weights-ready':  { label: '2/4 · Weights ready',      from: 72, to: 73 },
  lora:             { label: '2/4 · LoRA',               from: 72, to: 74 },
  'lora-ready':     { label: '2/4 · LoRA ready',         from: 74, to: 75 },
  release:          { label: 'Freeing GPU memory',       from: 75, to: 76 },
  'encode-prompt':  { label: '3/4 · Encoding prompt',    from: 76, to: 80 },
  'build-engine':   { label: '3/4 · Building engine',    from: 80, to: 82 },
  denoise:          { label: '3/4 · Denoising',          from: 82, to: 95 },
  decode:           { label: '4/4 · Decoding pixels',    from: 95, to: 99 },
  cooldown:         { label: 'Waiting on GPU memory',    from: 95, to: 97 },
  worker:           { label: 'Working',                  from: 6,  to: 72 },
  'worker-fallback':{ label: 'Retrying a stage',         from: 6,  to: 72 },
  'idle-release':   { label: 'GPU memory released',      from: 99, to: 99 }
};

/** Highest percent already shown, so a stage that reports no fraction can never
 *  walk the bar backwards. Reset per run. */
let lastPercent = 0;

function reportProgress(ev, onProgress) {
  if (!onProgress) return;
  let phase = PHASES[ev?.stage];
  let frac = null;
  try {
    frac = kleinLib?.progressFraction ? kleinLib.progressFraction(ev) : null;
  } catch {}
  if (!phase) {
    // An event this file does not know about is still worth showing: the engine's
    // own sentence, held at the current percent rather than dropped.
    onProgress({ stage: 'Working…', percent: Math.min(99, Math.max(lastPercent, 1)), detail: safeDetail(ev) });
    return;
  }
  const percent = frac === null || Number.isNaN(frac)
    ? phase.from
    : Math.round(phase.from + Math.max(0, Math.min(1, frac)) * (phase.to - phase.from));
  lastPercent = Math.max(lastPercent, Math.min(99, percent));
  onProgress({ stage: phase.label, percent: lastPercent, detail: safeDetail(ev) });
}

function safeDetail(ev) {
  try {
    return kleinLib?.formatProgress ? kleinLib.formatProgress(ev) : String(ev?.stage || '');
  } catch {
    return String(ev?.stage || '');
  }
}

// --- sizes ------------------------------------------------------------------------------------

/** Snap a requested side to the grid the transformer packs latents on. */
function snapSide(n) {
  const v = Math.round((Number(n) || 0) / SIDE_STEP) * SIDE_STEP;
  return Math.max(MIN_SIDE, Math.min(MAX_SIDE, v || MIN_SIDE));
}

/** Largest square the engine's own area cap allows, on the 16 px grid. */
function sideWithinArea(side, maxArea) {
  if (!maxArea || maxArea <= 0) return side;
  const fit = Math.floor(Math.sqrt(maxArea) / SIDE_STEP) * SIDE_STEP;
  return Math.max(MIN_SIDE, Math.min(side, fit));
}

// --- the run ----------------------------------------------------------------------------------

/**
 * Turn a prompt into a PNG data URL.
 *
 * Same contract the chat surface has always called: `{ model, prompt, seed,
 * steps, size, onProgress, signal }` in, `{ dataUrl, width, height, seed, steps,
 * model, backend, timeMs }` out. `backend` now names the engine build and the
 * GPU path rather than an ONNX execution provider, because that is the part a
 * person can act on.
 */
export async function generateWaffleImage({
  model = 'klein-auto',
  prompt,
  seed,
  steps,
  size,
  onProgress,
  signal
} = {}) {
  const t0 = performance.now();
  const cfg = resolveImageModel(model);
  lastPercent = 0;

  const caps = await detectImageCapabilities();
  if (!caps.hasWebGPU) {
    const err = new Error(caps.reason);
    err.code = 'no-webgpu';
    throw err;
  }

  const mode = cfg.mode === 'auto' ? caps.mode : cfg.mode;
  const room = await assertStorageRoom(mode);
  if (room && room.freeGB < room.needGB) {
    // Past the hopeless-run gate above, but still short of comfortable. The first
    // thing anybody waiting on a multi-gigabyte download should be told.
    onProgress?.({
      stage: 'Heads up · storage is tight',
      percent: 1,
      detail: `About ${room.freeGB.toFixed(1)} GB free and the ${mode} build wants roughly ${room.needGB} GB. The weights may not survive as a cache.`
    });
  }

  onProgress?.({
    stage: mode === engineMode && engine ? 'Warming up…' : `Starting the ${mode} build…`,
    percent: 1,
    detail: engine && engineMode === mode
      ? 'Weights are already in this tab.'
      : `First run streams the weights from ${new URL(KLEIN_BASE).host} into this browser's own storage and keeps them for next time.`
  });

  const totalSteps = Math.max(KLEIN_MIN_STEPS, Math.min(KLEIN_MAX_STEPS, Number(steps) || cfg.defaultSteps));
  let side = snapSide(size || cfg.defaultSize);
  const usedSeed = Number.isFinite(seed) ? seed : Math.floor(Math.random() * 2 ** 31);
  const threads = ortThreads();
  progressSink = typeof onProgress === 'function' ? onProgress : null;

  let res;
  let eng;
  try {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    // Creating the engine is inside the try on purpose: on a first run this is
    // where the tokenizer, the ORT wasm and the GPU device are fetched, which is
    // where most of the ways a first run can fail actually happen.
    eng = await ensureEngine({ mode });
    side = sideWithinArea(side, eng.limits?.maxArea);
    res = await eng.generate({
      prompt: String(prompt || 'a cozy golden waffle in a sunny kitchen'),
      width: side,
      height: side,
      steps: totalSteps,
      seed: usedSeed,
      signal
    });
  } catch (err) {
    throw explainFailure(err, { mode, side });
  } finally {
    progressSink = null;
  }

  const W = res.width;
  const H = res.height;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  img.data.set(res.rgba);
  ctx.putImageData(img, 0, 0);

  onProgress?.({ stage: 'Done!', percent: 100, detail: `${W}×${H} in ${totalSteps} steps` });

  const timeMs = Math.round(performance.now() - t0);
  const out = {
    dataUrl: canvas.toDataURL('image/png'),
    width: W,
    height: H,
    seed: usedSeed,
    steps: totalSteps,
    model: cfg.id,
    modelName: cfg.name,
    backend: `${mode} build · WebGPU${eng.f16 ? ' fp16' : ''} · ${threads} ORT thread${threads === 1 ? '' : 's'}`,
    decoder: KLEIN_DECODER,
    timeMs
  };

  // A phone does not want gigabytes of GPU memory held for the rest of the tab's
  // life; the next run re-uploads from storage, which is the fast part.
  if (mode === 'mobile') releaseImageEngine();
  return out;
}

/**
 * Engine errors are written for a README. These are the four a person actually
 * hits, in the words the kitchen should say; anything unrecognised passes through
 * with its own message attached, because a guessed explanation is worse than the
 * real one.
 */
function explainFailure(err, { mode, side }) {
  const name = err?.name || '';
  const text = String(err?.message || err || '');
  if (name === 'AbortError' || /aborted/i.test(text)) {
    const e = new DOMException('Aborted', 'AbortError');
    return e;
  }

  const wrap = (message, code) => {
    const e = new Error(message);
    e.code = code;
    e.cause = err;
    return e;
  };

  if (/WebGPU is not available|no WebGPU adapter/i.test(text)) {
    return wrap('This browser cannot run the image model — it needs WebGPU (Chrome or Edge 121+, Safari 18+). Text chat still works here.', 'no-webgpu');
  }
  if (/Integer overflow|out of memory|OutOfMemory|allocation failed|buffer is too large|exceeded memory limit|device lost|Device lost/i.test(text)) {
    return wrap(
      `The GPU ran out of room at ${side}×${side} on the ${mode} build. Try again — a second run is usually lighter — or pick the phone build in Settings, which keeps about 0.6 GB resident instead of ~4 GB.`,
      'gpu-memory'
    );
  }
  if (/quota|storage|OPFS|persist/i.test(text)) {
    return wrap('The browser would not keep the image weights on disk. Free up space (Settings clears the cached weights) or allow this site more storage, then try again.', 'storage');
  }
  if (/Failed to fetch|NetworkError|Load failed|ERR_|CORS|403|404/i.test(text)) {
    return wrap('The image weights could not be downloaded from the model host. Check the connection and try again — whatever already arrived is kept, so the next attempt resumes.', 'network');
  }
  return wrap(`Image generation stopped: ${text}`, 'engine');
}
