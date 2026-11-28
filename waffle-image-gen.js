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
    onEvent: ev => {
      if (isDeviceLostEvent(ev)) {
        // The device is gone and cannot be brought back from in here. Ending the run
        // and dropping the engine is what leaves the next attempt able to succeed.
        settleGpuLost(String(ev?.detail?.text || ev?.detail?.code || 'device lost')
          .replace(/^GPU device lost \\((.*)\\)$/, '$1'));
        releaseImageEngine();
      }
      reportProgress(ev, progressSink);
    }
  });
  engineMode = mode;
  return engine;
}

// --- the GPU going away -----------------------------------------------------------------------

/**
 * What a lost device costs, and why it has to be handled rather than waited out.
 *
 * `device.lost` resolves when the GPU process is restarted — which is what an OEM
 * power manager does to a tab it has decided is too expensive, and what an
 * out-of-memory kill does to the renderer around it. The library reports it as a
 * `warning` event and carries on, so a run whose device is gone can simply never
 * finish: the bar holds its last number, the seconds count up, and nothing is
 * coming. Worse, the engine object survives, so every later attempt in the same
 * tab is handed the same dead device and fails the same quiet way until the page
 * is reloaded.
 *
 * So a loss ends that run and that engine: the waiters are rejected with something
 * `explainFailure` can put into words, and the engine is released so the next run
 * asks for a device that works. That is the difference between "battery
 * optimisation killed my image generation" and "it failed, it told me why, and the
 * button worked again".
 */
let gpuLostReason = '';
let gpuLostWaiters = [];

/** The reason the last device went away, or '' — exported so the UI can say it. */
export function gpuLostState() { return gpuLostReason; }

/** Forget it. A fresh run has earned a fresh start. */
export function clearGpuLost() { gpuLostReason = ''; }

function isDeviceLostEvent(ev) {
  return ev?.stage === 'warning' && ev?.detail?.code === 'device-lost';
}

function gpuLossError(reason) {
  const e = new Error(`GPU device lost (${reason}). The weights already downloaded are kept, so trying again resumes rather than re-downloading.`);
  e.code = 'gpu-lost';
  return e;
}

/** A promise that rejects the moment the GPU reports itself gone. */
function raceGpuLoss() {
  return new Promise((_res, reject) => {
    if (gpuLostReason) reject(gpuLossError(gpuLostReason));
    else gpuLostWaiters.push(reject);
  });
}

function settleGpuLoss(reason) {
  gpuLostReason = reason;
  const waiters = gpuLostWaiters;
  gpuLostWaiters = [];
  const err = gpuLossError(reason);
  for (const reject of waiters) { try { reject(err); } catch {} }
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
 * Engine events → the kitchen's `{ stage, percent, detail, … }`.
 *
 * The bands are the honest *shape* of a run: most of a first run is the download,
 * most of a warm run is the denoise. A band on its own is not enough, though, and
 * the version that shipped first proved it — it reported 4% and then held that
 * number for minutes while gigabytes arrived, because two things were thrown away:
 *
 *   • a stage that reported no fraction fell back to the bottom of its band, and
 *     the monotonic clamp then held that number for as long as the stage lasted.
 *     A frozen number reads as a stuck download even when nothing is stuck;
 *   • weights arrive in shards, and every shard restarts its own `loaded/total` at
 *     zero, so shard two pulled the bar back down and the clamp froze it at shard
 *     one's high-water mark for the rest of the download.
 *
 * So a report now carries what is actually known, and says out loud when that is
 * not enough:
 *
 *   `indeterminate` — no fraction arrived for this stage. The number on the bar is
 *       a band edge, not a measurement, so the surface stripes the bar and counts
 *       seconds instead of presenting a guess as a reading.
 *   `loadedMB` / `totalMB` / `shard` / `shards` — the engine's own bytes. During a
 *       multi-gigabyte first run these are the numbers worth reading.
 *   `etaMs` — only ever present once a real byte rate has been measured, because an
 *       estimate with no measurement behind it is the same lie with extra steps.
 *   `elapsedMs` — how long this run has taken so far.
 *
 * `percent` stays monotonic within a run: a stage that reports less than the bar
 * has already shown must not drag it backwards. `detail` is the engine's own
 * sentence, so a held number is never the only signal on screen.
 */
const PHASES = {
  cache:             { label: 'Checking cached weights',   from: 1,  to: 2 },
  warning:           { label: 'Warning',                   from: 1,  to: 2 },
  tokenizer:         { label: '1/4 · Loading tokenizer',    from: 2,  to: 5 },
  'text-encoder':    { label: '1/4 · Text encoder',         from: 5,  to: 25 },
  embeddings:        { label: '1/4 · Token embeddings',     from: 25, to: 28 },
  weights:           { label: '2/4 · Streaming weights',    from: 28, to: 78 },
  'weights-upload':  { label: '2/4 · Uploading to GPU',     from: 78, to: 84 },
  'weights-ready':   { label: '2/4 · Weights ready',        from: 84, to: 85 },
  lora:              { label: '2/4 · LoRA',                 from: 84, to: 86 },
  'lora-ready':      { label: '2/4 · LoRA ready',           from: 86, to: 87 },
  release:           { label: 'Freeing GPU memory',         from: 87, to: 88 },
  'encode-prompt':   { label: '3/4 · Encoding prompt',      from: 88, to: 90 },
  'encode-reference':{ label: '3/4 · Encoding your picture', from: 88, to: 90 },
  'build-engine':    { label: '3/4 · Building engine',      from: 90, to: 91 },
  denoise:           { label: '3/4 · Denoising',            from: 91, to: 98 },
  decode:            { label: '4/4 · Decoding pixels',      from: 98, to: 99 },
  cooldown:          { label: 'Waiting on GPU memory',      from: 96, to: 98 },
  worker:            { label: 'Working',                    from: 5,  to: 78 },
  'worker-fallback': { label: 'Retrying a stage',           from: 5,  to: 78 },
  'idle-release':    { label: 'GPU memory released',        from: 99, to: 99 }
};

const MB = 2 ** 20;
/** An ETA needs two samples this far apart. Anything sooner is noise with a
 *  confident unit on it. */
const RATE_MIN_MS = 1200;

/** Per-run progress state. `generateWaffleImage` makes one; `reportProgress` reads it. */
export function newProgressState(now = 0) {
  return { lastPercent: 0, startedAt: now, sample: null, rate: 0 };
}

let progressState = newProgressState(0);

const clamp01 = n => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

/**
 * The fraction an event really carries, or `null` when it carries none.
 *
 * Two rules the engine's own `progressFraction` does not apply, because it answers
 * a narrower question:
 *   • `cached: true` is a *finished* stage, not 0% of itself. Reading a weight
 *     shard out of OPFS takes milliseconds and used to park the bar at the floor
 *     of its band;
 *   • a shard's `loaded/total` describes that shard. Folded into the band on its
 *     own it restarts at zero for every shard, so the bar climbs once and then
 *     waits at the clamp while the rest of the download happens.
 */
export function stageFraction(ev) {
  const d = ev?.detail || {};
  if (ev?.stage === 'denoise') {
    if (Number(d.n) > 0) return clamp01(d.i / d.n);
    // Half a step's credit for a finished step: after step 1 of 2 a run is
    // halfway through the denoise, not at zero and not at one.
    if (Number(d.steps) > 0) return clamp01((Math.max(1, d.step) - 0.5) / d.steps);
    return null;
  }
  if (d.cached) return 1;
  if (Number(d.total) > 0) {
    const one = clamp01((Number(d.loaded) || 0) / d.total);
    const shards = Number(d.shards) || 0;
    const shard = Number(d.shard) || 0;
    if (shards > 1 && shard >= 1) return clamp01((shard - 1 + one) / shards);
    return one;
  }
  // Nothing this file has a rule for still gets the engine's own answer rather
  // than silence: it knows stages that may not exist yet.
  try {
    const lib = kleinLib?.progressFraction ? kleinLib.progressFraction(ev) : null;
    return lib === null || Number.isNaN(lib) ? null : clamp01(lib);
  } catch {
    return null;
  }
}

/**
 * Bytes still to come on the download in flight, shards included: what is left of
 * this one plus the ones after it, assuming they are the same size. Built only
 * from totals the engine reported, never from a size this file guessed.
 */
function bytesRemaining(ev) {
  const d = ev?.detail || {};
  if (!(Number(d.total) > 0) || d.cached) return 0;
  const shards = Math.max(1, Number(d.shards) || 1);
  const shard = Math.max(1, Number(d.shard) || 1);
  return Math.max(0, d.total - (Number(d.loaded) || 0)) + Math.max(0, shards - shard) * d.total;
}

/**
 * Track the byte rate of the download in flight and return the ETA it implies.
 *
 * Sampled per stage *and* per shard, so a rate measured on the 5 MB tokenizer is
 * never used to promise a time for three gigabytes of weights. `null` until two
 * samples at least `RATE_MIN_MS` apart show the transfer actually moving.
 */
function trackRate(ev, state, now) {
  const d = ev?.detail || {};
  const key = `${ev.stage}:${d.shard || 0}`;
  const loaded = Number(d.loaded) || 0;
  const s = state.sample;
  if (!s || s.key !== key) {
    state.sample = { key, firstT: now, t: now, loaded };
    state.rate = 0;
    return null;
  }
  const dt = (now - s.t) / 1000;
  const dB = loaded - s.loaded;
  s.t = now;
  s.loaded = loaded;
  if (!(dt > 0) || !(dB > 0)) return null;
  const inst = dB / dt;
  // Smoothed, because one burst on a phone's radio is not a speed.
  state.rate = state.rate ? state.rate * 0.6 + inst * 0.4 : inst;
  if (now - state.sample.firstT < RATE_MIN_MS) return null;
  const left = bytesRemaining(ev);
  return left > 0 && state.rate > 0 ? Math.round((left / state.rate) * 1000) : null;
}

/**
 * One engine event → one honest report. Pure apart from the state it is handed,
 * which is why the tests can drive a whole first run through it without an engine,
 * a GPU or a download.
 */
export function progressFromEvent(ev, state = progressState, now = performance.now()) {
  const d = ev?.detail || {};
  const frac = stageFraction(ev);
  const known = frac !== null;
  const phase = PHASES[ev?.stage];
  let label;
  let percent;
  let indeterminate;

  if (!phase) {
    // An event this file does not know about is still worth showing: the engine's
    // own sentence, held at the current percent rather than dropped.
    label = 'Working…';
    percent = Math.max(state.lastPercent, 1);
    indeterminate = true;
  } else if (ev?.stage === 'warning') {
    // A warning arrives mid-run and carries nothing measurable, so the percent is
    // held rather than pulled back to the band's floor — a run 78% through a
    // download has not become 1% because the GPU said something. What changes is
    // the sentence: "Warning" on its own is the one label here that tells nobody
    // anything, and the device-lost case is the one a person most needs named.
    label = d.code === 'device-lost' ? 'The GPU went away · retrying needs a fresh device' : 'Heads up';
    percent = Math.max(state.lastPercent, phase.from);
    indeterminate = true;
  } else if (known) {
    label = phase.label;
    percent = Math.round(phase.from + frac * (phase.to - phase.from));
    indeterminate = false;
  } else {
    // The engine named the stage but has nothing to measure yet — "fetching text
    // encoder…" before the first byte lands, say. The band's floor is all that is
    // known, so the report says so instead of standing on a number as if it were.
    label = phase.label;
    percent = Math.max(state.lastPercent, phase.from);
    indeterminate = true;
  }

  state.lastPercent = Math.max(state.lastPercent, Math.min(99, percent));
  const report = {
    stage: label,
    percent: state.lastPercent,
    detail: safeDetail(ev),
    indeterminate,
    // `startedAt` of 0 is a real epoch, not a missing one, so this cannot be a
    // truthiness check: at 0 the bar would have counted from `now` forever.
    elapsedMs: Math.max(0, Math.round(now - (Number.isFinite(state.startedAt) ? state.startedAt : now))),
    engineStage: ev?.stage || ''
  };
  if (Number(d.total) > 0 && !d.cached) {
    report.loadedMB = Math.round((Number(d.loaded) || 0) / MB);
    report.totalMB = Math.round(d.total / MB);
    if (Number(d.shards) > 1) {
      report.shard = Number(d.shard);
      report.shards = Number(d.shards);
    }
    const eta = trackRate(ev, state, now);
    if (eta !== null) report.etaMs = eta;
  }
  if (ev?.stage === 'denoise' && Number(d.steps) > 0) {
    report.step = Number(d.step);
    report.steps = Number(d.steps);
  }
  return report;
}

function reportProgress(ev, onProgress) {
  if (!onProgress) return;
  onProgress(progressFromEvent(ev, progressState, performance.now()));
}

function safeDetail(ev) {
  try {
    return kleinLib?.formatProgress ? kleinLib.formatProgress(ev) : String(ev?.stage || '');
  } catch {
    return String(ev?.stage || '');
  }
}

/**
 * How long a wait is, in the shape a person reads: "42 s", "3 min 20 s",
 * "1 h 04 min". Deliberately coarse — a countdown to the second on a transfer
 * whose rate is still settling would be a more precise lie than the one this
 * replaces.
 */
export function humanDuration(ms) {
  const total = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  if (total < 60) return `${total} s`;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins < 60) return secs ? `${mins} min ${secs} s` : `${mins} min`;
  const hours = Math.floor(mins / 60);
  return `${hours} h ${String(mins % 60).padStart(2, '0')} min`;
}

// --- holding the screen on --------------------------------------------------------------------

/**
 * The screen lock a generation holds, and the honest limits of holding one.
 *
 * A long run is exactly what an aggressive power manager is built to interrupt.
 * Android freezes a backgrounded tab; HarmonyOS and Huawei's own browsers go
 * further and discard or kill the renderer outright, which is what lands on screen
 * as Chrome's "Aw, Snap". From inside the page the two are indistinguishable: no
 * JavaScript is running to move the bar, so the bar simply stops, and switching
 * battery optimisation off for Chrome does not reliably stop either one — the
 * freeze is a decision about the *tab*, and a tab with the screen off is a
 * background tab however the app itself is classified.
 *
 * What a page can do is keep the screen on, which is the one signal an OEM power
 * manager consistently respects: `navigator.wakeLock.request('screen')`. The
 * sentinel is dropped by the system whenever the page is hidden, so it is asked
 * for again on the way back, and it is released when the run ends rather than held
 * against the rest of the tab's life. Where the API does not exist — and on some
 * Huawei builds it does not — nothing here can help, and `screenLockState()` says
 * so plainly instead of letting the surface imply a protection it does not have.
 */
let wakeLock = null;
let wakeLockWanted = false;
let wakeLockHooked = false;

export function screenLockSupported() {
  try {
    return typeof navigator !== 'undefined' && Boolean(navigator.wakeLock?.request);
  } catch {
    return false;
  }
}

/** `{ supported, held, wanted }` — the most the device facts may claim. */
export function screenLockState() {
  return {
    supported: screenLockSupported(),
    held: Boolean(wakeLock) && wakeLock.released !== true,
    wanted: wakeLockWanted
  };
}

async function acquireScreenLock() {
  if (!screenLockSupported()) return false;
  if (wakeLock && wakeLock.released !== true) return true;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    // Fired when the system takes the lock away: the page was hidden, a
    // browser-level power save kicked in, or the display went. The run is still
    // going either way and still wants it back.
    wakeLock.addEventListener?.('release', () => {
      wakeLock = null;
      if (wakeLockWanted && typeof document !== 'undefined' && !document.hidden) acquireScreenLock();
    });
    return true;
  } catch {
    // NotAllowedError is the usual one — the page is not visible, or the browser
    // refused. Neither is a reason to throw a generation away.
    wakeLock = null;
    return false;
  }
}

function hookVisibilityForScreenLock() {
  if (wakeLockHooked || typeof document === 'undefined') return;
  wakeLockHooked = true;
  document.addEventListener('visibilitychange', () => {
    // Coming back to a run that is still in flight is exactly when the lock has to
    // be re-asked for, because hiding the page is what took it away.
    if (!document.hidden && wakeLockWanted) acquireScreenLock();
  });
}

/** Ask for the screen for the length of a run. Safe to call more than once. */
export async function holdScreenForRun() {
  wakeLockWanted = true;
  hookVisibilityForScreenLock();
  return acquireScreenLock();
}

/** Give it back. A finished run has no business holding a screen on. */
export function releaseScreenLock() {
  wakeLockWanted = false;
  const lock = wakeLock;
  wakeLock = null;
  try { lock?.release?.(); } catch {}
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
  progressState = newProgressState(performance.now());

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

  // Asked for before the first byte rather than after the first stall: by then
  // the tab may already be frozen, and nothing is running to ask.
  clearGpuLost();
  const lockHeld = await holdScreenForRun();
  const lockNote = lockHeld
    ? ' The screen is being held on for as long as this runs.'
    : screenLockSupported()
      ? ' The screen lock was refused, so keep this tab on screen — a hidden tab is the one thing that will pause this run.'
      : ' This browser offers no screen lock, so keep the tab open and the screen on: nothing in here can stop the system pausing a hidden run.';

  onProgress?.({
    stage: mode === engineMode && engine ? 'Warming up…' : `Starting the ${mode} build…`,
    percent: 1,
    indeterminate: true,
    detail: (engine && engineMode === mode
      ? 'Weights are already in this tab.'
      : `First run streams the weights from ${new URL(KLEIN_BASE).host} into this browser's own storage and keeps them for next time.`) + lockNote
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
    // Raced against the loss rather than awaited alone: a run whose device has
    // gone away may never resolve, and a bar that holds still forever is the exact
    // thing this release set out to stop.
    const lost = raceGpuLoss();
    // The race may never pick it, and that is not an error — but a rejection with
    // nobody listening for it is reported as one, so it is swallowed here.
    lost.catch(() => {});
    res = await Promise.race([
      eng.generate({
        prompt: String(prompt || 'a cozy golden waffle in a sunny kitchen'),
        width: side,
        height: side,
        steps: totalSteps,
        seed: usedSeed,
        signal
      }),
      lost
    ]);
  } catch (err) {
    throw explainFailure(err, { mode, side });
  } finally {
    progressSink = null;
    releaseScreenLock();
    gpuLostWaiters = [];
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
export function explainFailure(err, { mode, side }) {
  const name = err?.name || '';
  const text = String(err?.message || err || '');
  const code = String(err?.code || '');
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
  if (code === 'gpu-lost' || /device-lost/i.test(text)) {
    return wrap(
      `The GPU went away mid-run${side ? ` at ${side}×${side}` : ''}: the system took it back, which is what a power manager or an out-of-memory kill looks like from inside a page. The weights already in this browser are kept, so trying again does not re-download them. If it keeps happening on the ${mode} build, the phone build in Settings keeps far less memory resident.`,
      'gpu-lost'
    );
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


/* ------------------------------------------------------------------ *
 * The pause
 * ------------------------------------------------------------------ */

/**
 * Image generation is paused as of 1.3, and this is the one place that says so.
 *
 * It lives here rather than in the panel for the same reason the Waffle AI pause
 * lives in waffle-ai.js: every surface that offers an image or starts one reads
 * this function, so bringing the feature back is a one-line change instead of a
 * hunt through two files for the places that were gated. Both the Settings
 * picker and the run itself check it, which is what keeps a paused feature from
 * offering a button that cannot work.
 *
 * The honest reason is in the 1.3 notes. The short version is that the engine
 * needs WebGPU and has no fallback for a browser that does not expose it, and a
 * real device log showed a browser that had stopped exposing it at all — at
 * which point the picker was offering a run that could not happen.
 */
export function isImageGenPaused() {
  return true;
}

/** The one notice every paused image surface shows. */
export const IMAGE_GEN_PAUSE_MESSAGE =
  'Image generation is paused. The engine behind it needs WebGPU and has no fallback for a browser that does not expose it, so rather than offer a run that cannot finish, it is off until there is a path that works. It will be back in a later update.';
