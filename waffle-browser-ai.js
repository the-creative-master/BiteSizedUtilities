// Rough GGUF size per model at the default Compact (Q3_K_L) preset, in MB.
// Used only to warn / budget *before* a download starts — the real byte size
// always comes from the HuggingFace tree API when it is reachable.
export const TEXT_MODELS = [
  {
    id: 'qwen2.5-1.5b',
    params: 1.5,
    label: 'Qwen 2.5 1.5B',
    badge: 'Balanced · Q3_K_L / q4',
    kind: 'server',
    hfId: 'onnx-community/Qwen2.5-1.5B-Instruct',
    hfIdAlts: ['onnx-community/Qwen2.5-1.5B-Instruct-ONNX'],
    dtype: 'q4',
    hfGgufRepo: 'Qwen/Qwen2.5-1.5B-Instruct-GGUF',
    hfGgufQuant: 'Q3_K_L',
    ggufFile: 'qwen2.5-1.5b.gguf',
    ggufMB: 700,
    desc: 'Qwen 2.5 1.5B via local llama.cpp when cached, or Q3_K_L / q4 in browser (~700 MB)'
  },
  {
    id: 'qwen2.5-coder-1.5b',
    params: 1.5,
    label: 'Qwen 2.5 Coder 1.5B',
    badge: 'Coding · Q3_K_L / q4',
    kind: 'server',
    hfId: 'onnx-community/Qwen2.5-Coder-1.5B-Instruct',
    hfIdAlts: ['onnx-community/Qwen2.5-Coder-1.5B-Instruct-ONNX'],
    dtype: 'q4',
    hfGgufRepo: 'Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF',
    hfGgufQuant: 'Q3_K_L',
    ggufFile: 'qwen2.5-coder-1.5b.gguf',
    ggufMB: 700,
    desc: 'Qwen 2.5 Coder 1.5B for coding & debugging (local server or Q3_K_L / q4 fallback)'
  },
  {
    id: 'qwen3-0.6b',
    params: 0.6,
    label: 'Qwen 3 0.6B',
    badge: 'Light · ~300 MB',
    kind: 'server',
    hfId: 'onnx-community/Qwen3-0.6B-ONNX',
    hfIdAlts: ['onnx-community/Qwen3-0.6B'],
    dtype: 'q4',
    hfGgufRepo: 'unsloth/Qwen3-0.6B-GGUF',
    hfGgufQuant: 'Q3_K_L',
    ggufFile: 'qwen3-0.6b.gguf',
    ggufMB: 300,
    desc: 'Fast, lightweight Qwen 3 0.6B via llama.cpp, q4 ONNX, or Q3_K_L WLlama'
  },
  {
    id: 'smollm2-135m',
    params: 0.135,
    label: 'SmolLM2 135M',
    badge: 'Chromium Safe · ~70 MB',
    kind: 'browser',
    hfId: 'HuggingFaceTB/SmolLM2-135M-Instruct-ONNX',
    hfIdAlts: ['onnx-community/SmolLM2-135M-Instruct', 'HuggingFaceTB/SmolLM2-135M-Instruct'],
    dtype: 'q4',
    hfGgufRepo: 'bartowski/SmolLM2-135M-Instruct-GGUF',
    hfGgufQuant: 'Q3_K_L',
    ggufFile: 'smollm2-135m.gguf',
    ggufMB: 70,
    desc: 'Ultra-compact ~70 MB model safe for low-RAM Chromium & mobile browsers'
  },
  {
    id: 'smollm2-360m',
    params: 0.36,
    label: 'SmolLM2 360M',
    badge: 'Browser · ~170 MB',
    kind: 'browser',
    hfId: 'HuggingFaceTB/SmolLM2-360M-Instruct-ONNX',
    hfIdAlts: ['onnx-community/SmolLM2-360M-Instruct', 'HuggingFaceTB/SmolLM2-360M-Instruct'],
    dtype: 'q4',
    hfGgufRepo: 'bartowski/SmolLM2-360M-Instruct-GGUF',
    hfGgufQuant: 'Q3_K_L',
    ggufFile: 'smollm2-360m.gguf',
    ggufMB: 170,
    desc: 'Compact in-browser WebGPU/WASM model (~170 MB in Q3_K_L / q4)'
  },
  {
    id: 'qwen2.5-0.5b',
    params: 0.5,
    label: 'Qwen 2.5 0.5B',
    badge: 'Browser · ~250 MB',
    kind: 'browser',
    hfId: 'onnx-community/Qwen2.5-0.5B-Instruct',
    hfIdAlts: ['onnx-community/Qwen2.5-0.5B-Instruct-ONNX'],
    dtype: 'q4',
    hfGgufRepo: 'Qwen/Qwen2.5-0.5B-Instruct-GGUF',
    hfGgufQuant: 'Q3_K_L',
    ggufFile: 'qwen2.5-0.5b.gguf',
    ggufMB: 250,
    desc: 'Nimble multilingual model in-browser (~250 MB in Q3_K_L / q4)'
  },
  {
    id: 'qwen3.5-0.8b',
    params: 0.8,
    label: 'Qwen 3.5 0.8B',
    badge: 'Browser · Vision + Chat',
    kind: 'browser',
    loader: 'qwen3_5',
    hfId: 'onnx-community/Qwen3.5-0.8B-ONNX',
    hfIdAlts: ['onnx-community/Qwen3.5-0.8B'],
    dtype: { embed_tokens: 'q4', decoder_model_merged: 'q4' },
    hfGgufRepo: 'unsloth/Qwen3.5-0.8B-GGUF',
    hfGgufQuant: 'Q3_K_L',
    ggufFile: 'qwen3.5-0.8b.gguf',
    ggufMB: 400,
    desc: 'Qwen 3.5 0.8B multimodal & chat in-browser (~400 MB Q3_K_L / q4)'
  },
  {
    id: 'llama3.2-1b',
    params: 1.0,
    label: 'Llama 3.2 1B',
    badge: 'Browser · ~500 MB',
    kind: 'browser',
    hfId: 'onnx-community/Llama-3.2-1B-Instruct-ONNX',
    hfIdAlts: ['onnx-community/Llama-3.2-1B-Instruct'],
    dtype: 'q4',
    hfGgufRepo: 'bartowski/Llama-3.2-1B-Instruct-GGUF',
    hfGgufQuant: 'Q3_K_L',
    ggufFile: 'llama3.2-1b.gguf',
    ggufMB: 500,
    desc: 'Meta Llama 3.2 1B in-browser (~500 MB Q3_K_L — decent WebGPU recommended)'
  },
  {
    id: 'deepseek-r1-1.5b',
    params: 1.5,
    label: 'DeepSeek R1 1.5B',
    badge: 'Browser · Reasoning',
    kind: 'browser',
    hfId: 'onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX',
    hfIdAlts: ['onnx-community/DeepSeek-R1-Distill-Qwen-1.5B'],
    dtype: 'q4',
    hfGgufRepo: 'bartowski/DeepSeek-R1-Distill-Qwen-1.5B-GGUF',
    hfGgufQuant: 'Q3_K_L',
    ggufFile: 'deepseek-r1-1.5b.gguf',
    ggufMB: 700,
    desc: 'DeepSeek R1 reasoning model (~700 MB Q3_K_L — strong WebGPU device required)'
  }
];

export const QUANT_PRESETS = [
  {
    id: 'compact',
    label: 'Compact (Q3_K_L / q4)',
    desc: '25–35% smaller downloads & lower RAM for Chromium browsers (Default)',
    ggufQuants: ['Q3_K_L', 'Q3_K_M', 'Q3_K_S', 'IQ3_M', 'IQ3_XS', 'Q4_K_S', 'Q4_K_M', 'Q4_0'],
    onnxDtype: 'q4'
  },
  {
    id: 'ultralight',
    label: 'Ultra-Light (Q2_K / Q3_K_S)',
    desc: 'Smallest possible file size for mobile & low-RAM Chromium tabs',
    ggufQuants: ['Q2_K', 'IQ2_M', 'IQ2_XS', 'Q3_K_S', 'Q3_K_M', 'Q3_K_L', 'Q4_K_S', 'Q4_0'],
    onnxDtype: 'q4'
  },
  {
    id: 'balanced',
    label: 'Balanced (Q4_K_M / q4f16)',
    desc: 'Higher precision weights (larger files, needs more device RAM)',
    ggufQuants: ['Q4_K_M', 'Q4_K_S', 'Q3_K_L', 'Q4_0', 'Q3_K_M'],
    onnxDtype: 'q4f16'
  }
];

export const EXECUTION_MODES = [
  { id: 'auto', label: 'Auto Fallbacks', desc: 'Automatically falls back across WebGPU, WLlama, WASM CPU, and local server' },
  { id: 'server', label: 'Local Server', desc: 'Uses pre-cached server llama.cpp (safest on iOS < 26 & low-RAM phones)' },
  { id: 'webgpu', label: 'Browser WebGPU', desc: 'Runs on device GPU via WebGPU (falls back if unsupported)' },
  { id: 'wllama', label: 'Browser WLlama', desc: 'Runs GGUF inside browser via WLlama WebGPU / WASM' },
  { id: 'wasm', label: 'Browser WASM CPU', desc: 'CPU-only WebAssembly fallback when WebGPU is unavailable' }
];

const KEY_TEXT = 'bite-ai-text-model';
const KEY_IMAGE = 'bite-ai-image-model';
const KEY_EXEC = 'bite-ai-exec-mode';
const KEY_QUANT = 'bite-ai-quant-preset';
const KEY_SMART = 'bite-ai-smart-prompt';

function readPref(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writePref(key, val) {
  try {
    localStorage.setItem(key, String(val));
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bite-ai-settings-changed'));
  }
}

/**
 * Which models this build may offer.
 *
 * The public kitchen ships the small end of the catalogue only. Bigger models
 * were the ones that kept failing in the wild — a 700 MB download that OOMs a
 * phone tab, or a WebGPU adapter that aborts the whole runtime — while
 * SmolLM2 135M reliably answered. So the public picker is capped at under 1B
 * parameters and everything larger stays in `beta.html`, where testers opt in
 * knowing the model may not start on their device.
 *
 * `beta.html` sets `data-beta="1"` on <html>. The flag is page-scoped on
 * purpose: nothing is stored, so a beta session can never leak big models back
 * into the public kitchen (they share localStorage).
 */
export const SMALL_MODEL_MAX_PARAMS = 1; // billions — strictly *under* 1B
export const DEFAULT_TEXT_MODEL = 'smollm2-135m';
export const VISION_TEXT_MODEL = 'qwen3.5-0.8b';

export function isBetaTesting() {
  if (typeof document === 'undefined') return false;
  return document.documentElement?.dataset?.beta === '1';
}

export function isModelUnlockedInThisBuild(model) {
  if (!model) return false;
  if (isBetaTesting()) return true;
  return Number(model.params || 0) < SMALL_MODEL_MAX_PARAMS;
}

/** The models the Settings picker may show in this build. */
export function getAvailableTextModels() {
  return TEXT_MODELS.filter(isModelUnlockedInThisBuild);
}

export function isVisionModel(model) {
  return Boolean(model) && (model.id === VISION_TEXT_MODEL || model.loader === 'qwen3_5');
}

export function getSelectedTextModel() {
  const saved = readPref(KEY_TEXT, DEFAULT_TEXT_MODEL);
  // Clamp to what this build offers. Beta and public share localStorage, so a
  // model picked in beta must not carry over into the public kitchen.
  return getAvailableTextModels().some(m => m.id === saved) ? saved : DEFAULT_TEXT_MODEL;
}
export function setSelectedTextModel(id) {
  const cfg = TEXT_MODELS.find(m => m.id === id);
  if (cfg && isModelUnlockedInThisBuild(cfg)) writePref(KEY_TEXT, id);
}

export function getSelectedImageModel() {
  const saved = readPref(KEY_IMAGE, 'sdxs-512');
  return saved === 'sd-turbo' ? 'sd-turbo' : 'sdxs-512';
}
export function setSelectedImageModel(id) {
  writePref(KEY_IMAGE, id === 'sd-turbo' ? 'sd-turbo' : 'sdxs-512');
}

export function getSelectedExecutionMode() {
  const saved = readPref(KEY_EXEC, 'auto');
  return EXECUTION_MODES.some(m => m.id === saved) ? saved : 'auto';
}
export function setSelectedExecutionMode(id) {
  if (EXECUTION_MODES.some(m => m.id === id)) writePref(KEY_EXEC, id);
}

export function getSelectedQuantPreset() {
  const saved = readPref(KEY_QUANT, 'compact');
  return QUANT_PRESETS.some(q => q.id === saved) ? saved : 'compact';
}
export function setSelectedQuantPreset(id) {
  if (QUANT_PRESETS.some(q => q.id === id)) writePref(KEY_QUANT, id);
}

export function getSmartPromptEnabled() {
  return readPref(KEY_SMART, 'true') !== 'false';
}
export function setSmartPromptEnabled(v) {
  writePref(KEY_SMART, v ? 'true' : 'false');
}

export function getAiTemperature() {
  const n = parseFloat(readPref('bite-ai-temp', '0.7'));
  return Number.isFinite(n) ? Math.max(0, Math.min(1.5, Math.round(n * 20) / 20)) : 0.7;
}
export function setAiTemperature(v) {
  const n = Math.max(0, Math.min(1.5, Math.round(Number(v) * 20) / 20));
  writePref('bite-ai-temp', Number.isFinite(n) ? n.toFixed(2) : '0.70');
}

export function isTempUnlocked() {
  return readPref('bite-ai-temp-unlocked', 'false') === 'true';
}
export function setTempUnlocked(v) {
  writePref('bite-ai-temp-unlocked', v ? 'true' : 'false');
}

export const AI_DISCLAIMER_TEXT =
  'DISCLAIMER: You might not be able to enjoy local/browser AI smoothly in BiteSizedUtilities if you are on an iPhone below iOS 26, an older phone/tablet, or a device that does not support WebGPU. Roughly 1 in 4 mobile devices lack WebGPU, which can cause browser AI models to crash, fail to load, or run slowly unless you have a capable device. Automatic fallbacks (WebGPU, WLlama, WASM CPU, and local server) are built in — you can adjust models and fallback mode in Settings.';

let cachedDiag = null;

// Bytes a single WebAssembly heap can realistically hold on this device.
// llama.cpp needs roughly: model weights + KV cache + compute buffers, and the
// browser tab needs its own room on top of that. Over-committing here is what
// makes a model "download perfectly" and then die during load/generation.
function estimateWasmBudgetBytes({ hasWebGPU, deviceMemoryGB }) {
  if (hasWebGPU) {
    // Weights live in GPU memory, the wasm heap only holds scratch buffers.
    return 2 * 1024 ** 3;
  }
  // navigator.deviceMemory is coarse and capped at 8; assume 4 when unknown.
  const reportedGB = Number(deviceMemoryGB) > 0 ? Number(deviceMemoryGB) : 4;
  const usableGB = Math.max(0.9, Math.min(reportedGB * 0.45, 2.6));
  return Math.floor(usableGB * 1024 ** 3);
}

export async function detectDeviceDiagnostics() {
  if (cachedDiag) return cachedDiag;
  let hasWebGPU = false;
  let hasF16 = false;
  let adapterName = '';

  if (typeof navigator !== 'undefined' && navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        hasWebGPU = true;
        hasF16 = Boolean(adapter.features?.has('shader-f16'));
        adapterName = adapter.info?.description || adapter.info?.architecture || 'WebGPU Adapter';
      }
    } catch {}
  }

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const iosMatch = ua.match(/OS (\d+)[._]/i);
  const iosMajor = isIOS && iosMatch ? parseInt(iosMatch[1], 10) : null;
  const isOldIOS = Boolean(isIOS && iosMajor !== null && iosMajor < 26);
  const deviceMemoryGB = typeof navigator !== 'undefined' && navigator.deviceMemory ? navigator.deviceMemory : null;
  const cores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : null;

  // Static hosts (GitHub Pages, Netlify, S3, …) cannot send COOP/COEP, so there
  // is no SharedArrayBuffer and no multi-threaded WASM. Everything has to run
  // single-threaded on the CPU or on the GPU.
  const isCrossOriginIsolated = Boolean(typeof globalThis !== 'undefined' && globalThis.crossOriginIsolated);
  const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
  const canThread = isCrossOriginIsolated && hasSharedArrayBuffer;
  // wllama picks its fast (JSPI + memory64) build from these two flags.
  const hasJSPI = typeof WebAssembly !== 'undefined' && Boolean(WebAssembly.Suspending);
  let hasMem64 = false;
  try {
    // eslint-disable-next-line no-new
    new WebAssembly.Memory({ address: 'i64', initial: 1n });
    hasMem64 = true;
  } catch {}
  const wllamaUsesCompat = !hasJSPI || !hasMem64;
  const hasOPFS = typeof navigator !== 'undefined' && Boolean(navigator.storage?.getDirectory);

  let storageQuotaMB = null;
  let storageUsageMB = null;
  try {
    const est = await navigator.storage?.estimate?.();
    if (est?.quota) storageQuotaMB = Math.round(est.quota / 1024 ** 2);
    if (est?.usage) storageUsageMB = Math.round(est.usage / 1024 ** 2);
  } catch {}

  // llama.cpp's WebGPU backend hard-aborts the whole module when the adapter
  // lacks shader-f16 (ngxson/wllama#241), so GPU offload is only safe with it.
  const wllamaGpuSafe = Boolean(hasWebGPU && hasF16);
  const wasmBudgetBytes = estimateWasmBudgetBytes({ hasWebGPU, deviceMemoryGB });

  const hasRisk = !hasWebGPU || isOldIOS || (deviceMemoryGB !== null && deviceMemoryGB < 4);

  let summaryLabel = hasWebGPU
    ? `WebGPU Ready${hasF16 ? ' (FP16)' : ' · no FP16 → CPU offload'}`
    : 'WebGPU Unavailable — CPU WASM Fallback';
  if (isOldIOS) summaryLabel = `iOS ${iosMajor} (< iOS 26) — WebGPU/Memory Risk`;
  if (!canThread) summaryLabel += ' · single-thread WASM';

  cachedDiag = {
    hasWebGPU,
    hasF16,
    adapterName,
    isIOS,
    iosMajor,
    isOldIOS,
    deviceMemoryGB,
    cores,
    hasRisk,
    summaryLabel,
    isCrossOriginIsolated,
    hasSharedArrayBuffer,
    canThread,
    hasJSPI,
    hasMem64,
    wllamaUsesCompat,
    wllamaGpuSafe,
    hasOPFS,
    storageQuotaMB,
    storageUsageMB,
    wasmBudgetBytes
  };
  return cachedDiag;
}

const pipeCache = new Map();
let wllamaInstance = null;
let wllamaLoadedFile = null;

async function disposeBrowserModels(keepKey = null) {
  for (const [key, entryPromise] of [...pipeCache.entries()]) {
    if (key === keepKey) continue;
    pipeCache.delete(key);
    try {
      const entry = await entryPromise;
      await entry?.model?.dispose?.();
      await entry?.gen?.dispose?.();
    } catch {}
  }
}

async function disposeWllama() {
  try { await wllamaInstance?.exit?.(); } catch {}
  wllamaInstance = null;
  wllamaLoadedFile = null;
}

function resolveAssetUrl(relPath) {
  const base = typeof document !== 'undefined' && document.baseURI
    ? document.baseURI
    : (typeof window !== 'undefined' ? window.location.href : 'http://localhost/');
  return new URL(relPath, base).href;
}

function readCachePref(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// Internal caches must not fire `bite-ai-settings-changed` (that re-renders the
// whole Settings modal), so they bypass writePref().
function writeCachePref(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

/* ------------------------------------------------------------------ *
 * HuggingFace helpers (shared by the ONNX and the GGUF/WLlama paths)
 * ------------------------------------------------------------------ */

const HF_BASE = 'https://huggingface.co';
const hfTreeCache = new Map();

async function fetchHfTree(repo, signal) {
  if (hfTreeCache.has(repo)) return hfTreeCache.get(repo);
  const pending = (async () => {
    const res = await fetch(`${HF_BASE}/api/models/${repo}/tree/main?recursive=true`, {
      headers: { Accept: 'application/json' },
      signal
    });
    if (!res.ok) throw new Error(`HF repo lookup failed (${res.status}) for ${repo}`);
    const files = await res.json();
    return Array.isArray(files) ? files : [];
  })();
  hfTreeCache.set(repo, pending);
  try {
    return await pending;
  } catch (err) {
    hfTreeCache.delete(repo);
    throw err;
  }
}

function ggufCandidates(files) {
  return files.filter(
    f => f?.type === 'file' && typeof f.path === 'string' && /\.gguf$/i.test(f.path) && !/mmproj/i.test(f.path)
  );
}

function hasOnnxWeights(files) {
  return files.some(
    f => f?.type === 'file' && typeof f.path === 'string' && /\.onnx$/i.test(f.path) && !/\.onnx_data$/i.test(f.path)
  );
}

/**
 * transformers.js can only load a repo that actually ships ONNX weights.
 * Several official repos (e.g. HuggingFaceTB/SmolLM2-*) publish safetensors
 * only, which used to burn a full tokenizer download and then fail. Probe the
 * candidates once and remember the winner.
 */
export async function resolveOnnxRepo(modelCfg, signal) {
  const candidates = [...new Set([modelCfg?.hfId, ...(modelCfg?.hfIdAlts || [])].filter(Boolean))];
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];
  const remembered = readCachePref(`bite-ai-onnx-repo:${modelCfg.id}`, '');
  if (remembered && candidates.includes(remembered)) return remembered;
  for (const repo of candidates) {
    try {
      if (hasOnnxWeights(await fetchHfTree(repo, signal))) {
        writeCachePref(`bite-ai-onnx-repo:${modelCfg.id}`, repo);
        return repo;
      }
    } catch (err) {
      if (err?.name === 'AbortError' || signal?.aborted) throw err;
    }
  }
  return candidates[0];
}

/* ------------------------------------------------------------------ *
 * ONNX Runtime assets
 * ------------------------------------------------------------------ */

async function blobifyJsModule(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  let code = await res.text();
  // Same neutralising transformers.js applies for non-Chrome browsers.
  code = code.replaceAll('globalThis.process?.versions?.node', 'false');
  return URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
}

let ortPathsPromise = null;

/**
 * Two things break the ORT WASM backend *after* a model has already downloaded
 * perfectly -- which is exactly the "downloads fine but errors responding"
 * symptom:
 *
 * 1. Build mismatch. The chat pipeline reaches ORT through
 *    @huggingface/transformers, which pins its OWN onnxruntime-web build (a dev
 *    pre-release nested inside the package). The top-level onnxruntime-web that
 *    `dist/ort/` mirrors belongs to the image pipeline. Handing ORT JS from one
 *    build a WASM factory from the other throws `version mismatch`. The build
 *    therefore emits the chat runtime into `dist/ort-chat/` and we look there
 *    first, falling back to `dist/ort/` when both are the same build.
 *
 * 2. MIME. GitHub Pages serves the app from a sub-path and can answer `.mjs`
 *    with a non-JavaScript type; ORT `import()`s the factory URL directly
 *    whenever it is same-origin, so a wrong Content-Type kills it. Re-wrapping
 *    the factory in a `text/javascript` blob URL sidesteps the server headers
 *    entirely, so that is always what we hand over.
 *
 * When neither local runtime is reachable we return null, which leaves
 * transformers.js on its own jsDelivr default -- that one always matches.
 */
const ORT_CHAT_BASES = ['ort-chat/', 'ort/'];

async function readOrtRuntimeVersion(ortBase) {
  // Written by the build next to the copied runtime. Absent on an older cached
  // deploy, in which case we simply cannot check and must trust the copy.
  try {
    const res = await fetch(`${ortBase}ort-version.json`, { cache: 'no-store' });
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('text/html')) return null;
    const json = await res.json();
    return typeof json?.version === 'string' && json.version ? json.version : null;
  } catch {
    return null;
  }
}

async function probeOrtRuntime(ortBase, suffix, expectedVersion) {
  if (expectedVersion) {
    const shipped = await readOrtRuntimeVersion(ortBase);
    // A stale or foreign runtime is worse than no runtime at all: ORT would
    // download the whole model and then refuse to build a session.
    if (shipped && shipped !== expectedVersion) return null;
  }
  const mjsUrl = `${ortBase}ort-wasm-simd-threaded${suffix}.mjs`;
  const wasmUrl = `${ortBase}ort-wasm-simd-threaded${suffix}.wasm`;
  let res = null;
  try {
    res = await fetch(mjsUrl, { headers: { Range: 'bytes=0-15' } });
  } catch {
    return null;
  }
  if (!res || (!res.ok && res.status !== 206)) return null;
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  // GitHub Pages answers missing files with its 404 HTML page -- never treat
  // that as a JS module.
  if (ct.includes('text/html')) return null;
  try {
    return { mjs: await blobifyJsModule(mjsUrl), wasm: wasmUrl, base: ortBase };
  } catch {
    return null;
  }
}

function resolveOrtWasmPaths(diag, expectedVersion) {
  if (!ortPathsPromise) {
    ortPathsPromise = (async () => {
      const suffix = diag.isOldIOS && !diag.hasWebGPU ? '' : '.asyncify';
      for (const rel of ORT_CHAT_BASES) {
        const paths = await probeOrtRuntime(resolveAssetUrl(rel), suffix, expectedVersion).catch(() => null);
        if (paths) return paths;
      }
      return null;
    })().catch(() => null);
  }
  return ortPathsPromise;
}

async function getTransformers() {
  const mod = await import('@huggingface/transformers');
  if (mod.env) {
    mod.env.allowLocalModels = false;
    if (mod.env.backends?.onnx?.wasm) {
      const diag = await detectDeviceDiagnostics().catch(() => ({ hasWebGPU: false, isOldIOS: false, canThread: false, wasmBudgetBytes: 1024 ** 3 }));
      const ortVersion = mod.env.backends.onnx.versions?.web || mod.env.versions?.web || '';
      const paths = await resolveOrtWasmPaths(diag, ortVersion);
      if (paths) mod.env.backends.onnx.wasm.wasmPaths = { mjs: paths.mjs, wasm: paths.wasm };
      if (!diag.canThread) {
        // No COOP/COEP on static hosts → no SharedArrayBuffer → ORT must stay
        // single-threaded or it fails to spawn its worker pool.
        mod.env.backends.onnx.wasm.numThreads = 1;
      }
      if ((diag.wasmBudgetBytes || 0) < 1.4 * 1024 ** 3) {
        // Pre-loading keeps a second ~29 MB copy of the runtime in the JS heap;
        // on a tight device streaming compilation is the cheaper option.
        mod.env.useWasmCache = false;
      }
    }
  }
  return mod;
}

async function getBrowserGenerator(modelCfg, preferredDevice, onStatus, withVision = false) {
  const preset = QUANT_PRESETS.find(q => q.id === getSelectedQuantPreset()) || QUANT_PRESETS[0];
  const cacheKey = `${modelCfg.id}:${withVision ? 'vision:' : ''}${preferredDevice}:${preset.id}`;
  if (pipeCache.has(cacheKey)) return pipeCache.get(cacheKey);
  await disposeWllama();
  await disposeBrowserModels(cacheKey);
  const promise = (async () => {
    const mod = await getTransformers();
    const { pipeline, AutoTokenizer, AutoProcessor, Qwen3_5ForCausalLM, Qwen3_5ForConditionalGeneration } = mod;
    onStatus?.({ state: 'loading', detail: `Loading ${modelCfg.label}${withVision ? ' Vision' : ''} (${preferredDevice.toUpperCase()})…` });

    // Only a repo that really ships ONNX weights can load; picking the wrong
    // one wastes a full tokenizer download before failing.
    const repo = await resolveOnnxRepo(modelCfg);

    const progress_callback = p => {
      if (p?.status === 'progress' && typeof p.progress === 'number') {
        onStatus?.({
          state: 'downloading',
          detail: `Downloading ${modelCfg.label}: ${Math.round(p.progress)}%`
        });
      }
    };

    if (modelCfg.loader === 'qwen3_5') {
      if (withVision && Qwen3_5ForConditionalGeneration && AutoProcessor) {
        const processor = await AutoProcessor.from_pretrained(repo, { progress_callback });
        const model = await Qwen3_5ForConditionalGeneration.from_pretrained(repo, {
          device: preferredDevice,
          dtype: { embed_tokens: 'q4', vision_encoder: 'q4', decoder_model_merged: 'q4' },
          progress_callback
        });
        return { kind: 'qwen3_5_vision', processor, tokenizer: processor.tokenizer, model, device: preferredDevice, repo };
      }
      const tokenizer = await AutoTokenizer.from_pretrained(repo, { progress_callback })
        .catch(async () => {
          const proc = await AutoProcessor.from_pretrained(repo, { progress_callback });
          return proc.tokenizer || proc;
        });
      const dtypeMap = typeof modelCfg.dtype === 'object'
        ? modelCfg.dtype
        : { embed_tokens: 'q4', decoder_model_merged: 'q4' };
      const model = await Qwen3_5ForCausalLM.from_pretrained(repo, {
        device: preferredDevice,
        dtype: dtypeMap,
        progress_callback
      });
      return { kind: 'qwen3_5', tokenizer, model, device: preferredDevice, repo };
    }

    const diag = await detectDeviceDiagnostics().catch(() => ({ hasF16: false }));
    const wantF16 = preferredDevice === 'webgpu' && preset.onnxDtype === 'q4f16' && diag.hasF16;
    const dtypeOrder = wantF16
      ? ['q4f16', 'q4', 'int8']
      : ['q4', 'int8', ...(preferredDevice === 'webgpu' && diag.hasF16 ? ['q4f16'] : [])];

    let gen;
    const dtypeErrors = [];
    for (const dt of dtypeOrder) {
      try {
        gen = await pipeline('text-generation', repo, {
          device: preferredDevice,
          dtype: dt,
          progress_callback
        });
        break;
      } catch (err) {
        dtypeErrors.push(`${dt}: ${err?.message || err}`);
      }
    }
    if (!gen) {
      throw new Error(
        `ONNX ${preferredDevice.toUpperCase()} load failed for ${modelCfg.label} (${repo}) — ${dtypeErrors.join(' / ').slice(0, 400)}`
      );
    }
    return { kind: 'pipeline', gen, device: preferredDevice, repo };
  })();
  pipeCache.set(cacheKey, promise);
  try {
    return await promise;
  } catch (err) {
    pipeCache.delete(cacheKey);
    throw err;
  }
}

export async function streamBrowserChat({
  modelId,
  messages,
  imageUrls = [],
  systemPrompt,
  maxTokens = 520,
  temperature = 0.7,
  preferredDevice,
  signal,
  onStatus,
  onToken
}) {
  const cfg = TEXT_MODELS.find(m => m.id === modelId);
  if (!cfg || !cfg.hfId) throw new Error(`No browser ONNX model configured for: ${modelId}`);

  const diag = await detectDeviceDiagnostics();
  const device = preferredDevice || (diag.hasWebGPU ? 'webgpu' : 'wasm');
  const useVision = cfg.loader === 'qwen3_5' && Array.isArray(imageUrls) && imageUrls.length > 0;
  const loaded = await getBrowserGenerator(cfg, device, onStatus, useVision);
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const { TextStreamer, RawImage } = await getTransformers();
  onStatus?.({ state: 'generating', detail: `${cfg.label}${useVision ? ' Vision' : ''} · ${loaded.device.toUpperCase()}` });

  const chat = [];
  if (systemPrompt) chat.push({ role: 'system', content: systemPrompt });
  const recent = messages.slice(-8);
  for (let i = 0; i < recent.length; i++) {
    const m = recent[i];
    if (!m?.role || typeof m.content !== 'string') continue;
    if (loaded.kind === 'qwen3_5_vision' && i === recent.length - 1 && m.role === 'user') {
      chat.push({
        role: 'user',
        content: [
          ...imageUrls.map(() => ({ type: 'image' })),
          { type: 'text', text: m.content }
        ]
      });
    } else {
      chat.push({ role: m.role, content: m.content });
    }
  }

  let acc = '';
  const tokenizer = (loaded.kind === 'qwen3_5' || loaded.kind === 'qwen3_5_vision')
    ? loaded.tokenizer
    : loaded.gen.tokenizer;
  const streamer = new TextStreamer(tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function(text) {
      if (signal?.aborted) return;
      acc += text;
      const cleaned = acc.replace(/<think>[\s\S]*?<\/think>\s*/g, '').replace(/<think>[\s\S]*$/, '');
      onToken?.(text, cleaned);
    }
  });

  if (loaded.kind === 'qwen3_5_vision') {
    const rawImgs = await Promise.all(imageUrls.map(u => RawImage.fromURL(u)));
    const promptStr = loaded.processor.apply_chat_template(chat, {
      tokenize: false,
      add_generation_prompt: true,
      enable_thinking: false
    });
    const inputs = await loaded.processor(promptStr, rawImgs);
    if (!inputs?.pixel_values) {
      throw new Error('Vision processor did not encode image pixels.');
    }
    const out = await loaded.model.generate({
      ...inputs,
      max_new_tokens: maxTokens,
      temperature: Math.max(0.1, temperature),
      do_sample: temperature > 0.15,
      streamer
    });
    if (!acc && out) {
      const inputLen = inputs.input_ids?.dims?.[1] || 0;
      const decoded = loaded.processor.batch_decode(out.slice(null, [inputLen, null]), { skip_special_tokens: true })?.[0] || '';
      acc = decoded;
      onToken?.(decoded, acc);
    }
    return acc.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
  }

  if (loaded.kind === 'qwen3_5') {
    const promptStr = tokenizer.apply_chat_template(chat, {
      tokenize: false,
      add_generation_prompt: true,
      enable_thinking: false
    });
    const inputs = tokenizer(promptStr);
    const out = await loaded.model.generate({
      ...inputs,
      max_new_tokens: maxTokens,
      temperature: Math.max(0.1, temperature),
      do_sample: temperature > 0.15,
      streamer
    });
    if (!acc && out) {
      const inputLen = inputs.input_ids?.dims?.[1] || 0;
      const decoded = tokenizer.decode(out[0].slice(inputLen), { skip_special_tokens: true });
      acc = decoded;
      onToken?.(decoded, acc);
    }
    return acc.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
  }

  const out = await loaded.gen(chat, {
    max_new_tokens: maxTokens,
    temperature: Math.max(0.1, temperature),
    do_sample: temperature > 0.15,
    streamer
  });

  if (!acc && out?.[0]?.generated_text) {
    const last = out[0].generated_text;
    const text = Array.isArray(last) ? (last[last.length - 1]?.content || '') : String(last);
    acc = text;
    onToken?.(text, acc.replace(/<think>[\s\S]*?<\/think>\s*/g, '').replace(/<think>[\s\S]*$/, ''));
  }
  return acc.replace(/<think>[\s\S]*?<\/think>\s*/g, '').replace(/<think>[\s\S]*$/, '').trim();
}

/* ------------------------------------------------------------------ *
 * GGUF selection (WLlama) — size aware
 * ------------------------------------------------------------------ */

function ggufUrlFor(repo, file) {
  return `${HF_BASE}/${repo}/resolve/main/${file}`;
}

function firstShardOf(candidates, p) {
  const m = p.match(/^(.+)-(\d{5})-of-(\d{5})\.gguf$/i);
  if (!m) return p;
  const first = `${m[1]}-00001-of-${m[3]}.gguf`;
  return candidates.some(c => c.path === first) ? first : p;
}

function shardTotalBytes(candidates, firstPath) {
  const m = firstPath.match(/^(.+)-(\d{5})-of-(\d{5})\.gguf$/i);
  if (!m) return candidates.find(c => c.path === firstPath)?.size || 0;
  const prefix = `${m[1]}-`;
  const suffix = `-of-${m[3]}.gguf`;
  let total = 0;
  for (const c of candidates) {
    if (c.path.startsWith(prefix) && c.path.endsWith(suffix)) total += c.size || 0;
  }
  return total || (candidates.find(c => c.path === firstPath)?.size || 0);
}

/**
 * Pick the best GGUF in a repo for the active quant preset.
 * `budgetBytes` (0 = no limit) skips quants that cannot possibly fit in this
 * device's WASM heap, so we stop downloading 700 MB that would only abort
 * during load. When nothing fits, the smallest file is used anyway and the
 * caller is told the size.
 */
async function resolveBestHFGguf(repo, preferredQuants, signal, budgetBytes = 0) {
  const files = await fetchHfTree(repo, signal);
  const candidates = ggufCandidates(files);
  if (!candidates.length) throw new Error(`No GGUF files found in ${repo}`);

  const choose = hits => {
    const bySize = [...hits].sort((a, b) => (a.size || Infinity) - (b.size || Infinity));
    const sized = bySize.map(c => {
      const file = firstShardOf(candidates, c.path);
      return { file, sizeBytes: shardTotalBytes(candidates, file) };
    });
    const fitting = budgetBytes > 0 ? sized.filter(s => s.sizeBytes > 0 && s.sizeBytes <= budgetBytes) : [];
    const [chosen] = fitting.length ? fitting : sized;
    return { ...chosen, overBudget: Boolean(budgetBytes > 0 && chosen.sizeBytes > budgetBytes) };
  };

  for (const q of preferredQuants) {
    const hits = candidates.filter(f => f.path.toUpperCase().includes(q.toUpperCase()));
    if (hits.length) return { ...choose(hits), quant: q };
  }
  return { ...choose(candidates), quant: 'smallest' };
}

function fmtMB(bytes) {
  if (!bytes || bytes <= 0) return '? MB';
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

/* ------------------------------------------------------------------ *
 * On-device model storage (OPFS) — the "pre-cache" that makes a static
 * host such as GitHub Pages behave like the local llama.cpp server.
 * ------------------------------------------------------------------ */

const KEY_PRECACHE_INDEX = 'bite-ai-precached-gguf';

let sharedModelManager = null;
let sharedModelManagerErr = null;

async function getModelManager() {
  if (sharedModelManager) return sharedModelManager;
  if (sharedModelManagerErr) throw sharedModelManagerErr;
  try {
    const { ModelManager } = await import('@wllama/wllama');
    sharedModelManager = new ModelManager({ parallelDownloads: 1 });
    return sharedModelManager;
  } catch (err) {
    sharedModelManagerErr = new Error(
      `On-device model storage is unavailable (${err?.message || err}). Pre-caching needs OPFS, which requires a secure (HTTPS) page.`
    );
    throw sharedModelManagerErr;
  }
}

function readPrecacheIndex() {
  const raw = readCachePref(KEY_PRECACHE_INDEX, {});
  return raw && typeof raw === 'object' ? raw : {};
}

function rememberPrecachedGguf(repo, { url, quant, sizeBytes }) {
  if (!repo || !url) return;
  const index = readPrecacheIndex();
  index[repo] = { url, quant, sizeBytes: sizeBytes || 0, at: Date.now() };
  writePrecacheIndex(index);
}

function writePrecacheIndex(map) {
  writeCachePref(KEY_PRECACHE_INDEX, map);
}

function quantListFor(cfg) {
  const preset = QUANT_PRESETS.find(q => q.id === getSelectedQuantPreset()) || QUANT_PRESETS[0];
  return cfg?.hfGgufQuant && !preset.ggufQuants.includes(cfg.hfGgufQuant)
    ? [...preset.ggufQuants, cfg.hfGgufQuant]
    : preset.ggufQuants;
}

/**
 * Download a model's GGUF into on-device storage (OPFS) so later chats start
 * instantly and work offline — no server needed.
 */
export async function precacheTextModel(modelId, { onProgress, signal } = {}) {
  const cfg = TEXT_MODELS.find(m => m.id === modelId);
  if (!cfg?.hfGgufRepo) throw new Error(`${modelId} has no GGUF source to pre-cache.`);
  const diag = await detectDeviceDiagnostics().catch(() => null);
  if (diag && !diag.hasOPFS) {
    throw new Error('This browser exposes no on-device storage (OPFS), so models cannot be pre-cached.');
  }
  const preset = QUANT_PRESETS.find(q => q.id === getSelectedQuantPreset()) || QUANT_PRESETS[0];
  const budget = diag?.wasmBudgetBytes || 0;

  onProgress?.({
    state: 'resolving',
    detail: `Finding the best ${preset.label} GGUF for ${cfg.label}…`,
    loaded: 0,
    total: 0
  });
  const picked = await resolveBestHFGguf(cfg.hfGgufRepo, quantListFor(cfg), signal, budget);
  const url = ggufUrlFor(cfg.hfGgufRepo, picked.file);
  const mm = await getModelManager();

  onProgress?.({
    state: 'downloading',
    detail: `Pre-caching ${cfg.label} (${picked.quant} · ${fmtMB(picked.sizeBytes)})…`,
    loaded: 0,
    total: picked.sizeBytes
  });
  const model = await mm.downloadModel({ url }, {
    signal,
    progressCallback: p => onProgress?.({
      state: 'downloading',
      detail: `Pre-caching ${cfg.label}: ${p.total > 0 ? Math.round((p.loaded / p.total) * 100) : 0}%`,
      loaded: p.loaded,
      total: p.total
    })
  });

  const sizeBytes = model?.size > 0 ? model.size : picked.sizeBytes;
  rememberPrecachedGguf(cfg.hfGgufRepo, { url, quant: picked.quant, sizeBytes });
  return { modelId, url, quant: picked.quant, sizeBytes, overBudget: Boolean(picked.overBudget) };
}

export async function listPrecachedModels() {
  const index = readPrecacheIndex();
  const live = new Map();
  try {
    const mm = await getModelManager();
    for (const m of await mm.getModels({ includeInvalid: true })) {
      let valid = false;
      try { valid = m.validate() === 'valid'; } catch {}
      live.set(m.url, { valid, sizeBytes: m.size > 0 ? m.size : 0 });
    }
  } catch {}
  return Object.entries(index).map(([repo, entry]) => {
    const owners = TEXT_MODELS.filter(m => m.hfGgufRepo === repo);
    const state = live.get(entry.url);
    return {
      key: repo,
      repo,
      modelIds: owners.map(m => m.id),
      label: owners.map(m => m.label).join(' / ') || repo.split('/').pop(),
      quant: entry.quant,
      url: entry.url,
      sizeBytes: state?.sizeBytes || entry.sizeBytes || 0,
      onDisk: Boolean(state),
      usable: Boolean(state?.valid),
      cachedAt: entry.at || 0
    };
  }).sort((a, b) => (b.cachedAt || 0) - (a.cachedAt || 0));
}

export async function removePrecachedModel(key) {
  const index = readPrecacheIndex();
  const entry = index[key];
  delete index[key];
  writePrecacheIndex(index);
  if (!entry?.url) return;
  try {
    const mm = await getModelManager();
    for (const m of await mm.getModels({ includeInvalid: true })) {
      if (m.url === entry.url) await m.remove();
    }
  } catch {}
}

export async function clearPrecachedModels() {
  writePrecacheIndex({});
  try {
    const mm = await getModelManager();
    await mm.clear();
  } catch {}
  await disposeWllama();
}

export async function estimateModelStorage() {
  try {
    const est = await navigator.storage?.estimate?.();
    if (!est) return null;
    return {
      quotaBytes: est.quota || 0,
      usageBytes: est.usage || 0,
      persistent: Boolean((await navigator.storage?.persisted?.()) || false)
    };
  } catch {
    return null;
  }
}

/** Ask the browser to keep pre-cached models instead of evicting them. */
export async function requestPersistentStorage() {
  try {
    return Boolean(await navigator.storage?.persist?.());
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * WLlama runtime
 * ------------------------------------------------------------------ */

let wllamaNativeLog = [];
let wllamaGpuPoisoned = false;
let compatAssetsPromise = null;

function pushNativeLog(level, args) {
  let text;
  try {
    text = args
      .map(a => (a instanceof Error ? a.message : typeof a === 'object' ? JSON.stringify(a) : String(a)))
      .join(' ');
  } catch {
    text = String(args?.[0] ?? '');
  }
  text = text.replace(/\s+/g, ' ').trim();
  if (!text) return;
  wllamaNativeLog.push(text);
  if (wllamaNativeLog.length > 22) wllamaNativeLog.shift();
  if (level === 'error') console.warn('[WaffleAI · llama.cpp]', text);
}

const wllamaLogger = {
  debug: () => {},
  log: (...a) => pushNativeLog('log', a),
  warn: (...a) => pushNativeLog('warn', a),
  error: (...a) => pushNativeLog('error', a)
};

function wllamaFailure(stage, err) {
  const tail = wllamaNativeLog.slice(-3).join(' | ').slice(0, 400);
  const base = err?.message || String(err);
  const e = new Error(tail ? `${stage}: ${base} — llama.cpp: ${tail}` : `${stage}: ${base}`);
  if (err?.name) e.name = err.name;
  return e;
}

function looksLikeGpuAbort(err) {
  const text = `${err?.message || ''} ${wllamaNativeLog.slice(-6).join(' ')}`.toLowerCase();
  return /shaderf16|webgpu|wgpu|ggml_assert|abort/.test(text);
}

// The compat build is only needed without JSPI/memory64, but when it *is*
// needed the assets must really be there — some static hosts drop them.
function compatAssetsAvailable() {
  if (!compatAssetsPromise) {
    compatAssetsPromise = (async () => {
      const url = resolveAssetUrl('wllama-compat/wllama.js');
      try {
        const res = await fetch(url, { method: 'HEAD' });
        return Boolean(res?.ok);
      } catch {
        return false;
      }
    })();
  }
  return compatAssetsPromise;
}

export async function streamWllamaChat({
  ggufFile = null,
  hfRepo = null,
  hfQuant = null,
  messages,
  systemPrompt,
  maxTokens = 380,
  temperature = 0.7,
  useWebGPU = false,
  signal,
  onStatus,
  onToken
}) {
  const { Wllama } = await import('@wllama/wllama');
  const diag = await detectDeviceDiagnostics().catch(() => null);
  const preset = QUANT_PRESETS.find(q => q.id === getSelectedQuantPreset()) || QUANT_PRESETS[0];
  const quantList = hfQuant && !preset.ggufQuants.includes(hfQuant)
    ? [...preset.ggufQuants, hfQuant]
    : preset.ggufQuants;

  const wasmUrl = resolveAssetUrl('wllama/wllama.wasm');
  const compatJsUrl = resolveAssetUrl('wllama-compat/wllama.js');
  const compatWasmUrl = resolveAssetUrl('wllama-compat/wllama.wasm');
  // Only meaningful when the caller named a real file; a guessed name would
  // silently load a different model than the one the user picked.
  const localGgufUrl = ggufFile ? resolveAssetUrl(`api/waffle-ai/gguf/${ggufFile}`) : null;
  const budget = diag?.wasmBudgetBytes || 0;

  // GPU offload aborts the whole WASM module when the adapter has no
  // shader-f16 feature (ngxson/wllama#241), so only ask for it when safe.
  let useGpu = Boolean(useWebGPU && diag?.wllamaGpuSafe && !wllamaGpuPoisoned);
  const targetKey = `${hfRepo ? `${hfRepo}:${preset.id}` : ggufFile}`;

  const createFreshWllama = async () => {
    await disposeBrowserModels();
    await disposeWllama();
    wllamaNativeLog = [];
    const inst = new Wllama({ default: wasmUrl }, {
      suppressNativeLog: false,
      parallelDownloads: 1,
      allowOffline: true,
      logger: wllamaLogger
    });
    if (await compatAssetsAvailable()) {
      inst.setCompat({ worker: compatJsUrl, wasm: compatWasmUrl }, 'firefox_safari');
    } else {
      inst.setCompat('default', 'firefox_safari');
    }
    wllamaInstance = inst;
    return inst;
  };

  const activeLabel = () => `${targetKey.split(':')[0].split('/').pop()} (${preset.label})`;

  const loadOnce = async (inst, gpu) => {
    const threads = diag?.canThread
      ? Math.max(1, Math.min(4, Math.floor((diag.cores || 2) / 2)))
      : 1;
    const loadParams = {
      // A smaller context keeps the KV cache affordable when everything has
      // to live in one single-threaded WASM heap.
      n_ctx: gpu ? 1024 : 768,
      n_batch: gpu ? 256 : 128,
      n_threads: threads,
      n_gpu_layers: gpu ? 99 : 0,
      log_level: 3,
      useCache: true,
      progressCallback({ loaded, total }) {
        if (total > 0) {
          onStatus?.({
            state: 'downloading',
            detail: `Loading ${activeLabel()} (${Math.round((loaded / total) * 100)}%)…`
          });
        }
      }
    };

    let quantLabel = quantList[0] || 'GGUF';

    // 1) Already pre-cached on this device → start with zero network at all.
    const cachedEntry = hfRepo ? readPrecacheIndex()[hfRepo] : null;
    if (cachedEntry?.url && quantList.includes(cachedEntry.quant)) {
      try {
        const mm = await getModelManager();
        const hit = (await mm.getModels()).find(m => m.url === cachedEntry.url);
        if (hit) {
          quantLabel = cachedEntry.quant || quantLabel;
          onStatus?.({
            state: 'loading',
            detail: `Starting ${quantLabel} from on-device cache (${gpu ? 'WebGPU' : 'CPU WASM'})…`
          });
          await inst.loadModel(hit, loadParams);
          return { source: 'cache', quant: quantLabel };
        }
      } catch (err) {
        if (err?.name === 'AbortError' || signal?.aborted) throw err;
        pushNativeLog('warn', [`cache lookup failed: ${err?.message || err}`]);
      }
    }

    // 2) HuggingFace → downloaded straight into on-device storage.
    if (hfRepo) {
      const picked = await resolveBestHFGguf(hfRepo, quantList, signal, budget);
      quantLabel = picked.quant;
      if (picked.overBudget) {
        onStatus?.({
          state: 'loading',
          detail: `${quantLabel} is ${fmtMB(picked.sizeBytes)} — larger than this device's ~${fmtMB(budget)} budget, loading anyway…`
        });
      } else {
        onStatus?.({
          state: 'loading',
          detail: `Loading ${quantLabel} · ${fmtMB(picked.sizeBytes)} via WLlama (${gpu ? 'WebGPU' : 'CPU WASM'})…`
        });
      }
      const url = ggufUrlFor(hfRepo, picked.file);
      await inst.loadModelFromUrl(url, loadParams);
      // Remember it so the next start is fully offline.
      rememberPrecachedGguf(hfRepo, { url, quant: picked.quant, sizeBytes: picked.sizeBytes });
      return { source: 'hf', quant: quantLabel, sizeBytes: picked.sizeBytes };
    }

    // 3) A GGUF served by this host (the dev server's .cache/waffle-ai).
    let hasLocalGguf = false;
    if (localGgufUrl) {
      try {
        const probe = await fetch(localGgufUrl, { method: 'HEAD', signal });
        const ct = probe.headers.get('content-type') || '';
        const len = Number(probe.headers.get('content-length') || '0');
        hasLocalGguf = probe.ok && !ct.includes('text/html') && len > 1_000_000;
      } catch {}
    }
    if (!hasLocalGguf) {
      throw new Error(ggufFile
        ? `Local GGUF (${ggufFile}) is not served by this host and no HuggingFace GGUF repo is configured.`
        : 'No HuggingFace GGUF repo is configured for this model and this host serves no local GGUF.');
    }
    onStatus?.({
      state: 'loading',
      detail: `Loading ${ggufFile} via WLlama (${gpu ? 'WebGPU' : 'CPU WASM'})…`
    });
    await inst.loadModelFromUrl(localGgufUrl, loadParams);
    return { source: 'local', quant: quantLabel };
  };

  let loadedHere = false;
  if (wllamaInstance && wllamaLoadedFile === `${targetKey}:${useGpu}` && wllamaInstance.isModelLoaded?.()) {
    loadedHere = true;
  }

  let lastErr = null;
  for (let attempt = 0; attempt < 2 && !loadedHere; attempt++) {
    const inst = await createFreshWllama();
    try {
      await loadOnce(inst, useGpu);
      wllamaLoadedFile = `${targetKey}:${useGpu}`;
      loadedHere = true;
    } catch (err) {
      if (err?.name === 'AbortError' || signal?.aborted) throw err;
      lastErr = wllamaFailure(`WLlama ${useGpu ? 'WebGPU' : 'CPU'} load`, err);
      await disposeWllama();
      if (useGpu && looksLikeGpuAbort(err)) {
        // The GPU backend killed the module — never try it again this session
        // and give the CPU build one clean shot with the already-cached file.
        wllamaGpuPoisoned = true;
        useGpu = false;
        onStatus?.({ state: 'loading', detail: 'WebGPU offload crashed — retrying on CPU WASM…' });
        continue;
      }
      throw lastErr;
    }
  }
  if (!loadedHere) throw lastErr || new Error('WLlama could not load the model.');

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  onStatus?.({
    state: 'generating',
    detail: `WLlama (${useGpu ? 'WebGPU' : 'CPU WASM'})`
  });

  const chat = [];
  if (systemPrompt) chat.push({ role: 'system', content: systemPrompt });
  for (const m of messages.slice(-8)) {
    if (m?.role && typeof m.content === 'string') {
      chat.push({ role: m.role, content: m.content });
    }
  }

  let acc = '';
  let stream;
  try {
    stream = await wllamaInstance.createChatCompletion({
      messages: chat,
      max_tokens: maxTokens,
      temperature,
      stream: true
    });
  } catch (err) {
    if (err?.name === 'AbortError' || signal?.aborted) throw err;
    throw wllamaFailure('WLlama chat start', err);
  }

  try {
    for await (const chunk of stream) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const piece = chunk?.choices?.[0]?.delta?.content || '';
      if (piece) {
        acc += piece;
        const cleaned = acc.replace(/<think>[\s\S]*?<\/think>\s*/g, '').replace(/<think>[\s\S]*$/, '');
        onToken?.(piece, cleaned);
      }
    }
  } catch (err) {
    if (err?.name === 'AbortError' || signal?.aborted) throw err;
    if (!acc) throw wllamaFailure('WLlama generation', err);
    // Keep whatever already streamed instead of throwing the answer away.
    pushNativeLog('warn', [`generation interrupted: ${err?.message || err}`]);
  }
  return acc.replace(/<think>[\s\S]*?<\/think>\s*/g, '').replace(/<think>[\s\S]*$/, '').trim();
}

export function getWllamaRuntimeHints() {
  return {
    gpuPoisoned: wllamaGpuPoisoned,
    nativeLog: [...wllamaNativeLog],
    loadedFile: wllamaLoadedFile
  };
}
