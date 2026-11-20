// Rough GGUF size per model at the default Compact (Q3_K_L) preset, in MB.
// Used only to warn / budget *before* a download starts — the real byte size
// always comes from the HuggingFace tree API when it is reachable.
export const TEXT_MODELS = [
  {
    id: 'qwen2.5-1.5b',
    label: 'Qwen 2.5 1.5B',
    badge: 'Balanced · Q3_K_L / q4',
    kind: 'server',
    hfId: 'onnx-community/Qwen2.5-1.5B-Instruct',
    hfIdAlts: ['onnx-community/Qwen2.5-1.5B-Instruct-ONNX'],
    dtype: 'q4',
    hfGgufRepo: 'Qwen/Qwen2.5-1.5B-Instruct-GGUF',
    hfGgufQuant: 'Q3_K_L',
    ggufFile: 'qwen2.5-1.5b.gguf',
    // Measured, not guessed: the source report for this entry came back with
    // qwen2.5-1.5b-instruct-q3_k_m.gguf at 881.6 MB (Q3_K_L is not published in
    // that repo, so the loader falls through to Q3_K_M). The table said 700 MB,
    // which is what the "will this fit?" check and the warnings are built from.
    ggufMB: 882,
    desc: 'Qwen 2.5 1.5B via local llama.cpp when cached, or Q3_K_M / q4 in browser (~882 MB)'
  },
  {
    id: 'qwen2.5-coder-1.5b',
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
    label: 'SmolLM2 135M',
    badge: 'Chromium Safe · ~93 MB',
    kind: 'browser',
    hfId: 'HuggingFaceTB/SmolLM2-135M-Instruct-ONNX',
    hfIdAlts: ['onnx-community/SmolLM2-135M-Instruct', 'HuggingFaceTB/SmolLM2-135M-Instruct'],
    dtype: 'q4',
    hfGgufRepo: 'bartowski/SmolLM2-135M-Instruct-GGUF',
    hfGgufQuant: 'Q3_K_L',
    ggufFile: 'smollm2-135m.gguf',
    // Measured by the source report: SmolLM2-135M-Instruct-Q3_K_L.gguf is
    // 93.0 MB in bartowski/SmolLM2-135M-Instruct-GGUF. The table said 70 MB,
    // and this figure is what the "will it fit?" check is computed from.
    ggufMB: 93,
    desc: 'Ultra-compact ~93 MB model safe for low-RAM Chromium & mobile browsers'
  },
  {
    id: 'smollm2-360m',
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

export function getSelectedTextModel() {
  const saved = readPref(KEY_TEXT, 'qwen2.5-1.5b');
  return TEXT_MODELS.some(m => m.id === saved) ? saved : 'qwen2.5-1.5b';
}
export function setSelectedTextModel(id) {
  if (TEXT_MODELS.some(m => m.id === id)) writePref(KEY_TEXT, id);
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
  'DISCLAIMER: You might not be able to enjoy local/browser AI smoothly in BiteSizedUtilities if you are on an iPhone below iOS 26, a Huawei or HarmonyOS tablet, an older phone/tablet, or a device that does not support WebGPU. Roughly 1 in 4 mobile devices lack WebGPU, which can cause browser AI models to crash, fail to load, or run slowly unless you have a capable device. Automatic fallbacks (WebGPU, WLlama, WASM CPU, and local server) are built in — you can adjust models and fallback mode in Settings. Huawei and HarmonyOS browsers are profiled rather than assumed: the kitchen reads ArkWeb and Huawei Browser and their Chromium baseline, checks for WebNN (the only web API that can reach an NPU, and one those browsers do not have), and orders the runtimes by what the device can really do — so a WebGPU adapter that Chromium on Android cannot honour is tried last instead of first.';

/* ------------------------------------------------------------------ *
 * Platform profile — which browser this really is, and what that means
 * for the runtimes. Written for Huawei/HarmonyOS tablets, where the
 * answers are unusual and guessing them costs a failed model load.
 * ------------------------------------------------------------------ */

/**
 * Huawei documents ArkWeb's Chromium baseline per system version: 4.1–5.1 →
 * M114, 6.0/6.1 → M132, 7.0 → M144. HarmonyOS NEXT user agents often carry no
 * `Chrome/` token at all, so this mapping is the only way to know which web
 * platform the page is running on — and that decides what can be attempted.
 */
export function chromiumForArkWeb(arkWebVersion) {
  const major = Number(String(arkWebVersion || '').split('.')[0]);
  if (!Number.isFinite(major) || major <= 0) return null;
  if (major >= 7) return 144;
  if (major >= 6) return 132;
  if (major >= 4) return 114;
  return null;
}

/**
 * Chromium shipped WebGPU on desktop in 113 but on Android only from 144. An
 * adapter handed back before that on a phone or tablet is a software or
 * half-finished one, which is how a "WebGPU ready" device ends up hanging the
 * whole tab instead of answering.
 */
export const ANDROID_WEBGPU_CHROMIUM = 144;

/** The smallest WASM module that needs SIMD, so the answer comes from the engine. */
export function detectWasmSimd() {
  try {
    return WebAssembly.validate(new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11
    ]));
  } catch {
    return false;
  }
}

/**
 * Grade a WebGPU adapter instead of merely noticing one. On Android and
 * HarmonyOS an adapter can be handed back by a Chromium that cannot really
 * honour it (WebGPU reached Android in 144), and a runtime that trusts it does
 * not fail cleanly — it hangs. An unverifiable version counts as suspect too:
 * guessing "fine" is what puts a dead runtime first in the chain.
 */
export function gradeWebgpuAdapter({ hasWebGPU, profile }) {
  if (!hasWebGPU) return 'absent';
  if (!profile?.isAndroid) return 'verified';
  const major = profile.chromiumMajor;
  if (major === null || major === undefined || !Number.isFinite(major) || major < ANDROID_WEBGPU_CHROMIUM) return 'suspect';
  return 'verified';
}

/** Does this browser expose WebNN, the only web API that can reach an NPU? */
export function detectWebNN(nav) {
  const n = nav || (typeof navigator !== 'undefined' ? navigator : null);
  const ml = n?.ml;
  return Boolean(ml && typeof ml.createContext === 'function');
}

/**
 * Read a user agent into a platform profile. Pure and exported: the real user
 * agents this was written against are in tests/ai-huawei.test.js, so a rule can
 * be changed without guessing what a MatePad sends.
 */
/** Tokens that are part of the platform, never a device model. */
const NOT_A_MODEL = /^(android|openharmony|harmonyos|harmony\d|hmscore|gmscore|build|linux|mobile|tablet|phone|safari|applewebkit|k|wv|hm5|deviceType)/i;

/**
 * Pull a device name out of a user agent, or return null rather than guess.
 * Huawei names its hardware two ways — a marketing name ("HUAWEI MatePad Pro")
 * and a model code ("CTR-LX3", "VYG-AL30") — and HarmonyOS pads both with
 * platform tokens that must not be mistaken for the device.
 */
export function deviceModelFrom(ua) {
  const s = String(ua || '');
  const candidates = [
    /;\s*(HUAWEI [^;)]+?)(?:\s+Build\/[^;)]*)?\s*[;)]/i,
    /;\s*((?:MatePad|MateBook|Mate|P|Nova|MediaPad|Honor)[^;)]*?)(?:\s+Build\/[^;)]*)?\s*[;)]/i,
    /(?:\(|;)\s*([A-Z]{2,4}-[A-Z0-9]{2,6})\s*(?:Build\/|[;)])/
  ];
  for (const re of candidates) {
    const m = s.match(re);
    const value = m?.[1]?.trim();
    if (value && value.length > 2 && value.length < 48 && !NOT_A_MODEL.test(value)) return value;
  }
  return null;
}

export function parsePlatformProfile(ua) {
  const s = String(ua || '');
  const grab = re => { const m = s.match(re); return m ? m[1] : null; };

  const arkWebVersion = grab(/ArkWeb\/([\d.]+)/i);
  const huaweiBrowserVersion = grab(/HuaweiBrowser\/([\d.]+)/i);
  const hmsCoreVersion = grab(/HMSCore[\s/]([\d.]+)/i);
  const harmonyVersion = grab(/(?:OpenHarmony|HarmonyOS)\s*([\d.]+)/i);
  // Some Huawei builds drop the `Chrome/` token and print the engine version
  // bare just before `HuaweiBrowser/` — that number is the Chromium baseline.
  const chromeToken = Number(grab(/Chrome\/(\d+)/i))
    || Number(grab(/(?:AppleWebKit\/[\d.]+ \(KHTML, like Gecko\)\s+)?(\d{2,3})\.\d+\.\d+\.\d+\s+HuaweiBrowser/i))
    || null;
  const isHuawei = /HUAWEI|HarmonyOS|OpenHarmony|ArkWeb|HuaweiBrowser|HMSCore|EMUI/i.test(s);
  const isIOS = /iPhone|iPad|iPod/i.test(s);
  const isAndroid = /Android/i.test(s) || /OpenHarmony|HarmonyOS/i.test(s);

  let platform = 'unknown';
  if (arkWebVersion || harmonyVersion) platform = 'harmony';
  else if (isHuawei && isAndroid) platform = 'huawei-android';
  else if (isIOS) platform = 'ios';
  else if (isAndroid) platform = 'android';
  else if (chromeToken || /Safari|Firefox|Edg/i.test(s)) platform = 'desktop';

  // No Chrome token (HarmonyOS NEXT often sends none) → Huawei's own mapping.
  const chromiumMajor = chromeToken ?? chromiumForArkWeb(arkWebVersion);
  const chromiumSource = chromeToken ? 'user-agent' : (arkWebVersion ? 'arkweb-mapping' : null);

  let deviceType = 'desktop';
  if (/DeviceType\/TV/i.test(s)) deviceType = 'tv';
  else if (/iPad/i.test(s)) deviceType = 'tablet';
  else if (/iPhone|iPod/i.test(s)) deviceType = 'phone';
  else if (/\(\s*(?:Tablet|Phone)\s*;/i.test(s)) deviceType = /\(\s*Tablet\s*;/i.test(s) ? 'tablet' : 'phone';
  else if (/Tablet/i.test(s)) deviceType = 'tablet';
  else if (/Mobile/i.test(s)) deviceType = 'phone';
  else if (isAndroid) deviceType = 'tablet';

  const deviceModel = deviceModelFrom(s);

  return {
    platform,
    isHuawei,
    isIOS,
    isAndroid,
    harmonyVersion,
    arkWebVersion,
    huaweiBrowserVersion,
    hmsCoreVersion,
    chromiumMajor,
    chromiumSource,
    deviceType,
    deviceModel: deviceModel ? deviceModel.trim() : null
  };
}

/** One line naming the browser, for a pill, a report or a support message. */
export function platformLabelFor(profile) {
  if (!profile) return '';
  const bits = [];
  if (profile.platform === 'harmony') {
    bits.push(`HarmonyOS${profile.harmonyVersion ? ` ${profile.harmonyVersion}` : ''}`);
    if (profile.huaweiBrowserVersion) bits.push(`Huawei Browser ${profile.huaweiBrowserVersion}`);
    if (profile.arkWebVersion) bits.push(`ArkWeb ${profile.arkWebVersion}`);
  } else if (profile.platform === 'huawei-android') {
    bits.push(`Huawei on Android${profile.huaweiBrowserVersion ? ` · Huawei Browser ${profile.huaweiBrowserVersion}` : ''}`);
    if (profile.hmsCoreVersion) bits.push(`HMS Core ${profile.hmsCoreVersion}`);
  } else if (profile.platform === 'ios') {
    bits.push('iOS');
  } else if (profile.platform === 'android') {
    bits.push('Android');
  } else if (profile.platform === 'desktop') {
    bits.push('Desktop browser');
  } else {
    bits.push('Unknown platform');
  }
  if (profile.chromiumMajor) bits.push(`Chromium ${profile.chromiumMajor}${profile.chromiumSource === 'arkweb-mapping' ? ' (from the ArkWeb version)' : ''}`);
  if (profile.deviceModel) bits.push(profile.deviceModel);
  if (profile.deviceType && profile.deviceType !== 'desktop') bits.push(profile.deviceType);
  return bits.join(' · ');
}

/**
 * The ONNX WebNN provider lives in onnxruntime-web's JSPI build
 * (`ort-wasm-simd-threaded.jspi.wasm`, ~18 MB). It is not shipped by default
 * because no phone or tablet browser exposes WebNN — Chrome's is a desktop
 * origin trial with Android excluded — so those bytes would be dead weight for
 * every visitor. `WAFFLE_WEBNN=1 npm run build` ships them, and then the NPU
 * path switches on by itself wherever `navigator.ml` exists.
 */
const WEBNN_RUNTIME_SHIPPED = (() => {
  try {
    // No optional chaining here on purpose: Vite's `define` replaces this exact
    // expression at build time, and `import.meta.env?.X` would not match it, so
    // a WAFFLE_WEBNN=1 build would silently ship the runtime and never use it.
    // Outside a bundler `import.meta.env` is undefined and the throw is caught.
    return String(import.meta.env.WAFFLE_WEBNN || '') === '1';
  } catch {
    return false;
  }
})();

export function isWebnnRuntimeShipped() {
  return WEBNN_RUNTIME_SHIPPED;
}

let cachedDiag = null;

// Bytes a single WebAssembly heap can realistically hold on this device.
// llama.cpp needs roughly: model weights + KV cache + compute buffers, and the
// browser tab needs its own room on top of that. Over-committing here is what
// makes a model "download perfectly" and then die during load/generation.
export function estimateWasmBudgetBytes({ hasWebGPU, deviceMemoryGB, memoryTightPlatform = false }) {
  if (hasWebGPU) {
    // Weights live in GPU memory, the wasm heap only holds scratch buffers.
    return 2 * 1024 ** 3;
  }
  // navigator.deviceMemory is coarse, capped at 8, and absent on most Huawei and
  // HarmonyOS browsers — so assume 4 when unknown. Phones and tablets kill a tab
  // whose heap grows into the system's way long before the desktop limit, which
  // is the "it downloaded fine and then died" failure; a model that fits beats a
  // bigger one that gets the tab reaped.
  const reportedGB = Number(deviceMemoryGB) > 0 ? Number(deviceMemoryGB) : 4;
  const usableGB = memoryTightPlatform
    ? Math.max(0.7, Math.min(reportedGB * 0.35, 1.8))
    : Math.max(0.9, Math.min(reportedGB * 0.45, 2.6));
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
  const platform = parsePlatformProfile(ua);
  const isIOS = platform.isIOS;
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
  const hasWasmSimd = detectWasmSimd();

  // WebNN is the only web API that reaches an NPU — the Kirin one included.
  // Chrome's implementation is a desktop origin trial (M147+) with Android
  // excluded, and ArkWeb/Huawei Browser does not ship it, so on a MatePad this
  // is false and the NPU simply cannot be addressed from a web page. The
  // provider also lives in onnxruntime-web's JSPI build, which is ~18 MB this
  // app does not ship by default (WAFFLE_WEBNN=1 does), so "available" means all
  // three: the API, the JSPI engine feature and the runtime.
  const hasWebNN = detectWebNN();
  const webnnUsable = Boolean(hasWebNN && hasJSPI && WEBNN_RUNTIME_SHIPPED);
  let npuNote;
  if (webnnUsable) {
    npuNote = 'WebNN is available, so the ONNX runtimes will ask for the NPU first.';
  } else if (hasWebNN && !WEBNN_RUNTIME_SHIPPED) {
    npuNote = 'This browser exposes WebNN, but this build ships no WebNN runtime — rebuild with WAFFLE_WEBNN=1 to use the NPU.';
  } else if (hasWebNN && !hasJSPI) {
    npuNote = 'This browser exposes WebNN but no JSPI, which the ONNX WebNN provider needs; the NPU stays unused.';
  } else {
    npuNote = platform.isHuawei
      ? 'No WebNN here (navigator.ml is absent), so the NPU — the Kirin one included — cannot be reached from a web page at all. It needs a native HarmonyOS app; a browser can only use the CPU and the GPU.'
      : 'No WebNN in this browser (navigator.ml is absent), so no NPU is available — inference runs on the CPU, or the GPU when WebGPU works.';
  }

  // An adapter on Android/HarmonyOS Chromium older than 144 is not proof of a
  // working WebGPU, so it is tried *after* the CPU runtimes rather than first:
  // a suspect adapter that hangs costs the whole attempt chain, while a CPU
  // model that answers is still an answer.
  const gpuTrustLevel = gradeWebgpuAdapter({ hasWebGPU, profile: platform });
  // "Prefer the GPU" means "do not distrust it": with no adapter at all there is
  // nothing to order, and only a suspect one changes the chain.
  const gpuPreferred = gpuTrustLevel !== 'suspect';
  const memoryTightPlatform = Boolean(platform.isAndroid && !hasWebGPU);

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
  const wasmBudgetBytes = estimateWasmBudgetBytes({ hasWebGPU, deviceMemoryGB, memoryTightPlatform });

  const hasRisk = !hasWebGPU || isOldIOS || gpuTrustLevel === 'suspect' || !hasWasmSimd
    || (deviceMemoryGB !== null && deviceMemoryGB < 4);

  let summaryLabel = hasWebGPU
    ? `WebGPU Ready${hasF16 ? ' (FP16)' : ' · no FP16 → CPU offload'}`
    : 'WebGPU Unavailable — CPU WASM Fallback';
  if (isOldIOS) summaryLabel = `iOS ${iosMajor} (< iOS 26) — WebGPU/Memory Risk`;
  else if (gpuTrustLevel === 'suspect') summaryLabel = `WebGPU present but unverified on Chromium ${platform.chromiumMajor} — CPU first`;
  if (!hasWasmSimd) summaryLabel = ' · no WASM SIMD';
  if (!canThread) summaryLabel += ' · single-thread WASM';

  const platformLabel = platformLabelFor(platform);
  const deviceNote = [
    platformLabel,
    hasWebGPU
      ? `WebGPU adapter: ${adapterName || 'present'} (${gpuTrustLevel}${hasF16 ? ', FP16' : ', no FP16 → CPU offload'})`
      : 'WebGPU: no adapter',
    `NPU: ${npuNote}`,
    `WASM: ${hasWasmSimd ? 'SIMD yes' : 'SIMD no'}, threads ${canThread ? 'yes' : 'no'}, heap budget ~${Math.round(wasmBudgetBytes / 1024 ** 2)} MB, on-device storage ${hasOPFS ? 'yes' : 'no'}`
  ].filter(Boolean).join('\n');

  cachedDiag = {
    hasWebGPU,
    hasF16,
    adapterName,
    platform,
    platformLabel,
    deviceNote,
    npuNote,
    hasWebNN,
    webnnUsable,
    gpuTrustLevel,
    gpuPreferred,
    hasWasmSimd,
    memoryTightPlatform,
    isHuawei: platform.isHuawei,
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

/**
 * The order the browser runtimes should be tried in, given what this device
 * actually is. The caller turns these tokens into real attempts.
 *
 * GPU-first is right when WebGPU is verified. On a device whose adapter cannot
 * be trusted (Android or HarmonyOS Chromium older than 144) the CPU runtimes go
 * first: a suspect adapter does not merely fail, it can hang the tab and take
 * the whole chain with it, and a slower CPU answer still is an answer. A caller
 * can force GPU-first with `gpuFirst: true` — that is what an explicit "WebGPU"
 * choice in Settings means.
 */
export function rankBrowserAttempts(diag, { gpuFirst = null } = {}) {
  const gpuOk = Boolean(diag?.hasWebGPU);
  const wllamaGpuOk = Boolean(diag?.wllamaGpuSafe);
  const npuOk = Boolean(diag?.webnnUsable);
  const gpuPreferred = gpuFirst === null ? diag?.gpuPreferred !== false : Boolean(gpuFirst);

  const gpuSteps = gpuPreferred
    ? [...(gpuOk ? ['onnx-webgpu'] : []), ...(wllamaGpuOk ? ['wllama-gpu'] : [])]
    : [...(wllamaGpuOk ? ['wllama-gpu'] : []), ...(gpuOk ? ['onnx-webgpu'] : [])];
  const cpuSteps = ['wllama-cpu', 'onnx-wasm'];

  return [
    ...(npuOk ? ['onnx-npu'] : []),
    ...(gpuPreferred ? gpuSteps : []),
    ...cpuSteps,
    ...(gpuPreferred ? [] : gpuSteps)
  ];
}

/**
 * Which ONNX device a request should run on. `preferredDevice` comes from the
 * attempt chain, and a chain can name a device this browser turns out not to
 * have: asking anyway fails with "WebNN is not supported in current
 * environment" instead of running on something that works.
 */
export function resolveOnnxDevice(diag, preferredDevice) {
  const auto = diag?.webnnUsable ? 'webnn-npu' : (diag?.hasWebGPU ? 'webgpu' : 'wasm');
  if (!preferredDevice) return auto;
  if (String(preferredDevice).startsWith('webnn') && !diag?.webnnUsable) return auto;
  if (preferredDevice === 'webgpu' && !diag?.hasWebGPU) return auto;
  return preferredDevice;
}

const pipeCache = new Map();
let wllamaInstance = null;
let wllamaLoadedFile = null;
// Set when a request was abandoned mid-flight (Stop, a stall, an engine error).
// Wllama holds one inference slot per loaded model and only releases it when
// its own loop finishes or its abort fires, so an instance that was walked away
// from must never be handed to the next prompt.
let wllamaDirty = false;

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
  wllamaDirty = false;
}

/* ------------------------------------------------------------------ *
 * One inference at a time, and none of them allowed to hang forever.
 *
 * A browser runtime is single-slot: the Wllama worker answers one request at a
 * time (`cancelRequest` exists precisely to "release the slot occupied by the
 * request") and an ONNX WebGPU session is no better. Two overlapping
 * generations — a second prompt sent before the first one settled, CodeHub
 * diagnostics firing while the chat is busy, or a Stop that walked away from a
 * stream that was still running — left the next caller waiting for a slot that
 * was never released. On screen that is a tab that answers one prompt and then
 * freezes on the second, with no error to show.
 *
 * Nothing in the chain timed out either, so the freeze was permanent:
 * `isGenerating` stayed true, the composer stayed disabled, and Stop did
 * nothing because an abort signal is only ever observed *between* tokens.
 *
 * So every engine attempt runs through here: strictly serialized, and watched
 * for silence rather than for total time — a small model on a phone can
 * legitimately take minutes, but it never goes quiet for minutes. Two windows,
 * because the phases fail differently: before the first token the runtime is
 * downloading and compiling shaders (slow, but it reports progress), and once
 * text is streaming a long silence really does mean wedged.
 * ------------------------------------------------------------------ */

/** Silence allowed once text has started streaming. */
export const AI_STALL_TIMEOUT_MS = 45_000;
/** Silence allowed before the first token: download, WASM compile, shader compile. */
export const AI_LOAD_STALL_TIMEOUT_MS = 240_000;
/**
 * Once the visitor has pressed Stop, waiting on a runtime that cannot be
 * interrupted is waiting for nothing: ORT's `generate()` has no abort at all,
 * so the UI is freed after this instead of after the full stall window.
 */
export const AI_ABORT_GRACE_MS = 5_000;
const STALL_CHECK_MS = 1000;

let inferenceTail = Promise.resolve();
let inferenceBusy = false;
let inferenceWaiting = 0;
let inferenceBeat = 0;
let inferenceSawToken = false;
let lastInferenceStall = null;

/** "Still working" — every status, download-progress and load callback. */
export function markInferenceBeat() {
  inferenceBeat = Date.now();
}

/** "Text is arriving" — switches the watchdog to the stricter streaming window. */
export function markInferenceToken() {
  inferenceSawToken = true;
  inferenceBeat = Date.now();
}

export function getInferenceQueueState() {
  return {
    busy: inferenceBusy,
    waiting: inferenceWaiting,
    sawToken: inferenceSawToken,
    idleMs: inferenceBusy ? Date.now() - inferenceBeat : 0,
    lastStall: lastInferenceStall
  };
}

/** Tests need a clean slate; so does a "reset the AI" action. */
export function resetInferenceQueue() {
  inferenceTail = Promise.resolve();
  inferenceBusy = false;
  inferenceWaiting = 0;
  inferenceBeat = 0;
  inferenceSawToken = false;
  lastInferenceStall = null;
}

/** Throw away whichever runtime just wedged, so the next attempt starts clean. */
async function discardWedgedRuntime(kind) {
  if (kind === 'wllama') {
    wllamaDirty = true;
    await disposeWllama();
    return;
  }
  await disposeBrowserModels();
}

/**
 * Run one browser inference, alone, with a watchdog on its silence.
 *
 * `task` is a factory (not a promise) so nothing starts before its turn. When
 * the watchdog fires it releases the queue, discards the runtime and rejects —
 * the wedged task is left running in the background with nobody listening to
 * it, which is the only thing possible: a WASM worker that stopped answering
 * cannot be talked into finishing.
 */
export function runBrowserInference(label, task, opts = {}) {
  const {
    kind = 'browser',
    signal = null,
    stallMs = AI_STALL_TIMEOUT_MS,
    loadStallMs = AI_LOAD_STALL_TIMEOUT_MS,
    abortGraceMs = AI_ABORT_GRACE_MS,
    // How often the watchdog looks at the clock. One second is free next to a
    // model download; tests dial it down so they can assert on real timings.
    checkMs = STALL_CHECK_MS
  } = opts;

  const start = () => new Promise((resolve, reject) => {
    let settled = false;
    // No longer queued behind somebody else: it is the one running now.
    inferenceWaiting = Math.max(0, inferenceWaiting - 1);
    // A background pre-cache must never compete with a real prompt for the
    // single inference slot, the network or the visitor's patience.
    stopAutoPrecache('a chat started');
    inferenceBusy = true;
    inferenceBeat = Date.now();
    inferenceSawToken = false;

    const timer = setInterval(() => {
      if (settled) return;
      const idle = Date.now() - inferenceBeat;
      const stopped = Boolean(signal?.aborted);
      const limit = stopped ? abortGraceMs : (inferenceSawToken ? stallMs : loadStallMs);
      if (idle < limit) return;
      settled = true;
      clearInterval(timer);
      inferenceBusy = false;
      const phase = inferenceSawToken ? 'after it started replying' : 'while loading';
      const measure = inferenceSawToken ? 'no output' : 'no progress';
      // Whole seconds read better than "0s" on a short stall, and one decimal
      // is more useful than "0" when the wait was under ten seconds.
      const secs = idle < 10_000 ? (idle / 1000).toFixed(1) : String(Math.round(idle / 1000));
      lastInferenceStall = { label, kind, idleMs: idle, phase, stopped, at: Date.now() };
      // Cannot await here, and must not block the rejection on it.
      Promise.resolve(discardWedgedRuntime(kind)).catch(() => {});
      // A Stop the runtime ignored is still a Stop: callers branch on the name
      // to tell "you stopped me" apart from "I failed".
      if (stopped) {
        reject(new DOMException(
          `${label} did not stop when asked and was abandoned after ${secs}s.`,
          'AbortError'
        ));
        return;
      }
      reject(new Error(
        `${label} stopped answering — ${measure} for ${secs}s ${phase}, ` +
        'so this attempt was abandoned instead of freezing the page. ' +
        'The runtime it was using has been discarded and the next one takes over.'
      ));
    }, Math.max(5, checkMs));
    // Deliberately left referenced: this watchdog is the only thing that can
    // end a task that never settles, so it has to keep running (in Node that
    // means keeping the loop alive) until it either fires or is cleared. Every
    // exit path clears it, so it cannot outlive the attempt it watches.

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearInterval(timer);
      inferenceBusy = false;
      fn(value);
    };

    let out;
    try {
      out = task();
    } catch (err) {
      finish(reject, err);
      return;
    }
    Promise.resolve(out).then(
      value => finish(resolve, value),
      err => finish(reject, err)
    );
  });

  inferenceWaiting++;
  // Runs after whatever is in flight, and after a rejection too: a failed
  // attempt must not strand the queue behind it.
  const run = inferenceTail.then(start, start);
  inferenceTail = run.then(() => {}, () => {});
  return run;
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

/**
 * Turn a raw runtime error into something a person can act on.
 *
 * Every engine reports a network failure as a bare "Failed to fetch", which
 * reads like a model problem and is not one: six runtimes can all fail
 * identically because the model host was simply unreachable, and nothing in the
 * text says so. That ambiguity costs hours, so the kitchen classifies the
 * failure and leads with the cause instead of a wall of engine names.
 */
export function classifyAiFailure(err) {
  const raw = String(err?.message || err || '');
  const text = raw.toLowerCase();

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      kind: 'offline',
      title: 'This device is offline',
      hint: 'Nothing can be downloaded without a connection. A model already pre-cached on this device would still run — pre-cache one while online from Settings \u2192 AI Models.'
    };
  }
  // A wedged runtime is its own cause: the model loaded and the engine was
  // alive, so neither the network nor the weights are the suspect.
  if (/stopped answering|no output for|no progress for|abandoned instead of freezing/.test(text)) {
    return {
      kind: 'stall',
      title: 'The AI runtime stopped answering',
      hint: 'The engine loaded and then went silent, so the attempt was abandoned rather than left hanging. A wedged WASM or WebGPU worker cannot be revived from inside the tab: reload the page, and if it happens again choose a smaller model or CPU/WASM in Settings \u2192 AI Models.'
    };
  }
  // Covers the browser's own wording plus what the engines wrap around it.
  if (/failed to fetch|networkerror|network error|load failed|net::err_|could not resolve|err_name_not_resolved|err_internet|err_connection|err_cert|err_blocked|econnrefused|enotfound|etimedout|request failed|status 429|status 503|\(429\)|\(503\)/.test(text)) {
    return {
      kind: 'network',
      title: 'Could not reach the model host',
      hint: 'The download never started \u2014 huggingface.co was unreachable from this browser (blocked network, firewall, DNS, a privacy extension, or CORS from this origin). This is not a model, memory or device problem. Fix: run `node scripts/fetch-model.mjs` once so the site serves the model itself, or open the site from a network that can reach Hugging Face.'
    };
  }
  if (/out of memory|\boom\b|allocation failed|cannot allocate|memory access out of bounds|ran out of memory|bad_alloc|abort\(\).*memory/.test(text)) {
    return {
      kind: 'memory',
      title: 'Not enough memory for this model',
      hint: 'The weights would not fit this browser\u2019s WASM heap. Choose a smaller model or a lighter quantization preset in Settings \u2192 AI Models.'
    };
  }
  if (/version_mismatch|checkwasmversion|shader-f16|shader f16|unsupported feature|wasm.*compil|compil.*wasm|instantiate.*fail/.test(text)) {
    return {
      kind: 'runtime',
      title: 'This browser cannot run the AI runtime',
      hint: 'A WASM or WebGPU capability is missing or mismatched. Chromium without shader-f16 aborts the whole GPU module (ngxson/wllama#241), so switch the fallback mode to CPU/WASM.'
    };
  }
  if (/gguf|corrupt|invalid model|bad magic|unsupported model|unknown architecture|truncated/.test(text)) {
    return {
      kind: 'model',
      title: 'The model file could not be loaded',
      hint: 'The download may be incomplete or in a format this runtime does not support. Re-fetch the model and try again.'
    };
  }
  return { kind: 'unknown', title: 'The AI runtime failed', hint: raw.slice(0, 220) };
}

/**
 * One headline for a whole failed fallback chain. When every runtime died the
 * same way, repeating it six times is noise — the cause is what matters.
 */
export function summarizeAiFailures(classified) {
  if (!classified.length) return null;
  const kinds = new Set(classified.map(c => c.kind));
  if (kinds.size === 1) {
    const only = classified[0];
    return { ...only, uniform: true, count: classified.length };
  }
  // Mixed causes: lead with the most common one, because that is what the
  // visitor is actually hitting. A fixed priority would report "network" for a
  // chain where five runtimes ran out of memory and one could not fetch — but
  // a memory failure proves the host *was* reachable, so it is the better lead.
  // Ties break toward whichever runtime got furthest.
  const depth = ['memory', 'runtime', 'stall', 'model', 'offline', 'network', 'unknown'];
  const counts = new Map();
  for (const c of classified) counts.set(c.kind, (counts.get(c.kind) || 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) =>
    (b[1] - a[1]) || (depth.indexOf(a[0]) - depth.indexOf(b[0])));
  const hit = classified.find(c => c.kind === ranked[0][0]);
  return { ...hit, uniform: false, count: classified.length };
}

/**
 * A headline is only as good as the evidence behind it, and the engines can
 * only ever report "Failed to fetch". When the source facts contradict the
 * headline — every runtime said the host was unreachable, while the host
 * answered HTTP 200 for the metadata and failed only on the file — the facts
 * win. Blaming the visitor's network for a blocked CDN redirect sends them off
 * to check their wifi instead of the thing that is actually broken.
 */
export function reconcileAiFailureWithFacts(headline, facts) {
  if (!headline || !facts || headline.kind !== 'network') return headline;
  const probes = [facts.download, facts.onnxDownload].filter(Boolean);
  if (!probes.length) return headline;
  const apiAnswered = [facts.gguf, facts.onnx].some(r => r && (r.http === 200 || r.http === 206));
  const fileFailed = probes.some(d => d.status !== 'ok' && d.status !== 'no-source');
  const fileWorked = probes.some(d => d.status === 'ok');
  // Only overrule on a clean contradiction: the API answered, no file could be
  // fetched, and none of them succeeded. Anything less and the original
  // headline is the more honest one.
  if (!apiAnswered || !fileFailed || fileWorked) return headline;

  // A plain HEAD got through where the ranged GET did not. That separates two
  // completely different fixes: a network that blocks the CDN host, and one
  // that only blocks the preflight a Range header forces the browser to send.
  if (probes.some(d => d.plainStatus === 'ok')) {
    return {
      ...headline,
      kind: 'blocked-preflight',
      title: 'The model host is reachable — the ranged download request is what is being blocked',
      hint: 'The repository API answered HTTP 200 and a plain, header-free request for the model file succeeded from this same browser, so neither huggingface.co nor its CDN is blocked. The loaders ask for the file with a Range header, and because Range is not a CORS-simple header the browser has to preflight it with an OPTIONS request — and that request is what never came back. A proxy, firewall or privacy extension that drops preflights looks exactly like this: metadata fine, weights never start. Fix: allow OPTIONS requests to huggingface.co and its CDN hosts (cdn-lfs*.hf.co), turn off privacy extensions for this site, or serve the weights from this site with `node scripts/fetch-model.mjs`.'
    };
  }

  return {
    ...headline,
    kind: 'blocked-download',
    title: 'Hugging Face answered, but the model file could not be downloaded',
    hint: 'The repository metadata came back HTTP 200 from this same browser, so the network is not down and huggingface.co is not blocked. The weights are served from a different host after a redirect (Hugging Face\u2019s LFS CDN), and that request is what failed — typically a firewall, proxy or privacy extension that allows the API but not large binaries. Fix: serve the file from this site instead with `node scripts/fetch-model.mjs`, or retry on a network that allows the download.'
  };
}

/* ------------------------------------------------------------------ *
 * Source diagnostics — what Hugging Face actually says about a model.
 *
 * A failed fallback chain can only quote its engines: "Failed to fetch",
 * "out of memory", "version mismatch". Every one of those is downstream of a
 * *fact about the source* that the build never checked — the repository may be
 * gone, renamed, gated behind a licence a browser cannot accept, rate-limiting
 * this IP, or simply not containing the quantization the model table asks for.
 * Those facts are one API call away, and having them turns an hour of guessing
 * into a one-line fix, so a failure now goes and fetches them.
 *
 * Defensive by construction: a diagnostic that hangs, throws, or invents a
 * number is worse than no diagnostic. Every fetch is time-boxed, every result
 * is labelled with the HTTP status it came from, and nothing here can replace
 * the real error message.
 * ------------------------------------------------------------------ */

export const HF_DIAG_TIMEOUT_MS = 6000;
const HF_DIAG_CACHE_MS = 10 * 60 * 1000;
const HF_DIAG_FAIL_CACHE_MS = 60 * 1000;
const hfDiagCache = new Map();
const MB = 1024 * 1024;

/** Bytes the way a person reads them. */
export function fmtBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'unknown size';
  if (bytes < 1024 ** 3) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

/** An HTTP status (or a thrown fetch) mapped onto a cause worth acting on. */
export function sourceStatus(http, thrown) {
  if (thrown) return thrown === 'timeout' ? 'timeout' : thrown === 'aborted' ? 'aborted' : 'unreachable';
  if (http === null || http === undefined) return 'no-response';
  if (http === 401 || http === 403) return 'restricted';
  if (http === 404 || http === 410) return 'not-found';
  if (http === 429) return 'rate-limited';
  if (http >= 500) return 'server-error';
  if (http >= 200 && http < 300) return 'ok';
  return `http-${http}`;
}

/** Plain-English label for each status, used in the printed report. */
const SOURCE_STATUS_COPY = {
  ok: 'reachable',
  restricted: 'refused (401/403 — gated, private, or needs a token a browser cannot carry)',
  'not-found': 'does not exist (404 — renamed, made private, or deleted)',
  'not-a-model': 'answered with something that is not a model file',
  'rate-limited': 'rate-limited this IP (429)',
  'server-error': 'server error on their side (5xx)',
  timeout: 'the request timed out',
  unreachable: 'could not be reached from this browser',
  aborted: 'was cancelled',
  'no-response': 'gave no response',
  'bad-json': 'answered with something that is not JSON'
};

/**
 * One time-boxed request. Never throws: the report has to be able to say
 * "this call failed" instead of taking the whole error path down with it.
 *
 * The timeout is raced rather than only signalled. Aborting is the polite way
 * to end a fetch, but an implementation that ignores its signal — a stub, a
 * polyfill, a service worker that already went away — would otherwise hang a
 * visitor's error message forever, and a diagnostic must never do that.
 */
const DIAG_TIMEOUT = Symbol('diag-timeout');

async function diagRequest(url, { fetchImpl, timeoutMs = HF_DIAG_TIMEOUT_MS, signal, init, parse = 'json' } = {}) {
  const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  if (!doFetch) return { http: null, data: null, headers: null, thrown: 'unreachable', error: 'no fetch implementation in this environment', finalUrl: null };
  const ctrl = new AbortController();
  let timer = null;
  const gate = new Promise(resolve => {
    timer = setTimeout(() => { ctrl.abort(); resolve(DIAG_TIMEOUT); }, Math.max(250, timeoutMs));
  });
  const onOuterAbort = () => ctrl.abort();
  if (signal?.addEventListener) signal.addEventListener('abort', onOuterAbort);
  const attempt = doFetch(url, { ...(init || {}), signal: ctrl.signal, headers: { Accept: 'application/json', ...((init || {}).headers || {}) } })
    .then(res => ({ res }), err => ({ err }));
  try {
    const outcome = await Promise.race([attempt, gate]);
    if (outcome === DIAG_TIMEOUT) {
      return { http: null, data: null, headers: null, thrown: 'timeout', error: `no answer within ${Math.round(timeoutMs)} ms`, finalUrl: null };
    }
    if (outcome.err) {
      if (signal?.aborted) return { http: null, data: null, headers: null, thrown: 'aborted', error: String(outcome.err?.message || outcome.err), finalUrl: null };
      return { http: null, data: null, headers: null, thrown: 'unreachable', error: String(outcome.err?.message || outcome.err), finalUrl: null };
    }
    const res = outcome.res;
    const http = res?.status ?? null;
    const headers = res?.headers || null;
    // `res.url` is where the request ended up after redirects — for a model
    // file that is the CDN host, which is the whole point of probing it.
    const finalUrl = typeof res?.url === 'string' ? res.url : null;
    if (parse === 'none') return { http, data: null, headers, thrown: null, error: null, finalUrl };
    if (!res?.ok) {
      let detail = null;
      try { detail = await res.json(); } catch { /* a non-JSON error body is normal */ }
      return { http, data: detail, headers, thrown: null, error: detail?.error || detail?.message || null, finalUrl };
    }
    try {
      return { http, data: await res.json(), headers, thrown: null, error: null, finalUrl };
    } catch (err) {
      return { http, data: null, headers, thrown: 'bad-json', error: String(err?.message || err) };
    }
  } finally {
    clearTimeout(timer);
    if (signal?.removeEventListener) signal.removeEventListener('abort', onOuterAbort);
  }
}

/**
 * The real byte size of a Hugging Face tree entry. For an LFS-tracked file the
 * `size` field can be the size of the *pointer*, so take whichever of the two
 * is bigger — quoting 134 bytes for a 700 MB model would be worse than saying
 * nothing.
 */
function hfEntryBytes(entry) {
  const direct = Number(entry?.size) || 0;
  const lfs = Number(entry?.lfs?.size) || 0;
  return Math.max(direct, lfs);
}

/** One quant family per distinct GGUF in the repo, smallest first. */
function summariseQuants(files) {
  const byQuant = new Map();
  for (const f of files) {
    const quant = quantFromPath(f.path) || 'unlabelled';
    const hit = byQuant.get(quant) || { quant, files: 0, smallestBytes: Infinity, example: f.path };
    hit.files += 1;
    if (f.bytes < hit.smallestBytes) { hit.smallestBytes = f.bytes; hit.example = f.path; }
    byQuant.set(quant, hit);
  }
  return [...byQuant.values()]
    .map(q => ({ ...q, smallestBytes: Number.isFinite(q.smallestBytes) ? q.smallestBytes : 0 }))
    .sort((a, b) => (a.smallestBytes || Infinity) - (b.smallestBytes || Infinity))
    .slice(0, 8);
}

/**
 * Which available file is the closest stand-in for the one this build asked
 * for: the nearest real size to the budget in the model table, preferring a
 * file that fits inside it.
 */
function suggestFile(files, budgetBytes) {
  if (!files.length) return null;
  const usable = files.filter(f => f.bytes > 0);
  const pool = usable.length ? usable : files;
  if (!(budgetBytes > 0)) {
    const smallest = pool.slice().sort((a, b) => a.bytes - b.bytes)[0];
    return { ...smallest, why: 'the smallest file in the repository' };
  }
  const fitting = pool.filter(f => f.bytes <= budgetBytes);
  const ranked = (fitting.length ? fitting : pool)
    .map(f => ({ ...f, delta: Math.abs(f.bytes - budgetBytes) / budgetBytes }))
    .sort((a, b) => a.delta - b.delta);
  const best = ranked[0];
  if (!best) return null;
  return {
    path: best.path,
    bytes: best.bytes,
    quant: quantFromPath(best.path),
    why: fitting.length
      ? `the closest real size to the ${fmtBytes(budgetBytes)} this build budgets, and it fits`
      : `the closest real size to the ${fmtBytes(budgetBytes)} this build budgets (nothing fits it)`
  };
}

/**
 * Ask Hugging Face what it really has for one model.
 *
 * Returns facts, never a formatted string, so the caller (and the tests) can
 * assert on the numbers rather than on prose.
 */
export async function fetchModelSourceFacts(modelCfg, opts = {}) {
  const {
    fetchImpl,
    timeoutMs = HF_DIAG_TIMEOUT_MS,
    signal,
    quants,
    probeSelfHosted = true,
    budgetBytes
  } = opts;

  const cfg = modelCfg || {};
  let preferred = Array.isArray(quants) && quants.length ? quants.slice() : [];
  if (!preferred.length) {
    try { preferred = quantListFor(cfg); } catch { preferred = []; }
  }
  if (!preferred.length && cfg.hfGgufQuant) preferred = [cfg.hfGgufQuant];

  const cacheKey = `${cfg.id || '?'}|${cfg.hfGgufRepo || ''}|${cfg.hfId || ''}|${preferred.join(',')}|${probeSelfHosted ? 1 : 0}`;
  const cached = hfDiagCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.facts;

  const reqOpts = { fetchImpl, timeoutMs, signal };
  const gguf = await inspectGgufRepo(cfg, preferred, { ...reqOpts, budgetBytes });
  const onnx = cfg.hfId ? await inspectOnnxRepo(cfg, reqOpts) : null;
  const local = probeSelfHosted && cfg.ggufFile ? await inspectSelfHostedCopy(cfg, reqOpts) : null;

  // The metadata calls above can all answer 200 while the file itself is
  // unreachable, so ask for one byte of each real download too. Together,
  // because the failure path is already slow and these are independent.
  const ggufPath = gguf?.wouldLoad?.path || gguf?.suggested?.path || null;
  const [download, onnxDownload] = await Promise.all([
    ggufPath && gguf?.repo ? probeDownloadUrl(ggufUrlFor(gguf.repo, ggufPath), ggufPath, reqOpts) : null,
    onnx?.weightFile && onnx?.repo
      ? probeDownloadUrl(`${HF_BASE}/${onnx.repo}/resolve/main/${onnx.weightFile}`, onnx.weightFile, reqOpts)
      : null
  ]);

  // What this browser already holds for this model *on this origin*. Browser
  // caches are per origin, so a model that is pre-cached on the live site has
  // to download from scratch on a preview host, a localhost port or a new
  // deploy — which is exactly when "it worked yesterday" stops being true.
  let deviceCache = null;
  try {
    const entry = cfg.hfGgufRepo ? readPrecacheIndex()[cfg.hfGgufRepo] : null;
    deviceCache = entry
      ? {
        present: true,
        repo: cfg.hfGgufRepo,
        url: entry.url || null,
        quant: entry.quant || null,
        sizeBytes: Number.isFinite(entry.sizeBytes) && entry.sizeBytes > 0 ? entry.sizeBytes : null,
        preset: entry.preset || null,
        at: Number.isFinite(entry.at) ? entry.at : null
      }
      : { present: false, repo: cfg.hfGgufRepo || null };
  } catch { deviceCache = null; }

  // The device matters as much as the source: the same "Failed to fetch" has a
  // different cause on a HarmonyOS tablet than on a desktop, and a report
  // without the device in it sends whoever reads it after the wrong one.
  const diagForReport = await detectDeviceDiagnostics().catch(() => null);
  const platform = diagForReport ? {
    label: diagForReport.platformLabel,
    note: diagForReport.deviceNote,
    platform: diagForReport.platform?.platform || null,
    isHuawei: Boolean(diagForReport.isHuawei),
    deviceType: diagForReport.platform?.deviceType || null,
    deviceModel: diagForReport.platform?.deviceModel || null,
    chromiumMajor: diagForReport.platform?.chromiumMajor ?? null,
    hasWebGPU: Boolean(diagForReport.hasWebGPU),
    gpuTrustLevel: diagForReport.gpuTrustLevel || 'absent',
    hasWebNN: Boolean(diagForReport.hasWebNN),
    webnnUsable: Boolean(diagForReport.webnnUsable),
    npuNote: diagForReport.npuNote || null,
    hasWasmSimd: Boolean(diagForReport.hasWasmSimd),
    canThread: Boolean(diagForReport.canThread),
    wasmBudgetBytes: diagForReport.wasmBudgetBytes || 0
  } : null;

  const facts = {
    platform,
    id: cfg.id || null,
    label: cfg.label || cfg.id || 'the selected model',
    budgetBytes: Number.isFinite(budgetBytes) ? budgetBytes : (cfg.ggufMB > 0 ? cfg.ggufMB * MB : null),
    fetchedAt: new Date().toISOString(),
    gguf,
    onnx,
    download,
    onnxDownload,
    deviceCache,
    selfHosted: local
  };
  const broken = [gguf, onnx, local, download, onnxDownload]
    .some(r => r && r.status !== 'ok' && r.status !== 'present' && r.status !== 'no-source');
  hfDiagCache.set(cacheKey, { facts, expires: Date.now() + (broken ? HF_DIAG_FAIL_CACHE_MS : HF_DIAG_CACHE_MS) });
  return facts;
}

/**
 * Ask for one byte of the file the loaders actually download.
 *
 * `/api/models/<repo>` and `resolve/main/<file>` are not the same request: the
 * first is JSON on huggingface.co, the second is a redirect to Hugging Face's
 * LFS CDN. A firewall, proxy or privacy extension that allows one and blocks
 * the other makes every engine report "Failed to fetch" while the repository
 * metadata answers HTTP 200 — which reads as "your network is down" and is
 * exactly wrong. One ranged byte settles which host is the problem, and names
 * the CDN it was redirected to when it works.
 */
async function probeDownloadUrl(url, path, { fetchImpl, timeoutMs, signal }) {
  const out = {
    path: path || null,
    url,
    status: 'no-source',
    http: null,
    finalUrl: null,
    host: null,
    bytes: null,
    error: null,
    // The second probe, only run when the first one failed.
    plainStatus: null,
    plainHttp: null,
    plainHost: null
  };
  if (!url) return out;
  const res = await diagRequest(url, {
    fetchImpl,
    timeoutMs,
    signal,
    init: { method: 'GET', headers: { Range: 'bytes=0-0' } },
    parse: 'none'
  });
  out.http = res.http;
  out.finalUrl = res.finalUrl || null;
  try { out.host = out.finalUrl ? new URL(out.finalUrl).host : null; } catch { out.host = null; }
  if (res.error) out.error = res.error;
  const total = Number(String(res.headers?.get?.('content-range') || '').split('/')[1]);
  if (Number.isFinite(total) && total > 0) {
    out.bytes = total;
  } else {
    const len = Number(res.headers?.get?.('content-length'));
    if (Number.isFinite(len) && len > 0) out.bytes = len;
  }
  out.status = res.http === 200 || res.http === 206 ? 'ok' : sourceStatus(res.http, res.thrown);
  if (out.status === 'ok') return out;

  // The loaders ask for a byte range, and `Range` is not a CORS-simple header,
  // so the browser preflights it with an OPTIONS request. A proxy, firewall or
  // privacy extension that drops preflights therefore breaks every model
  // download while leaving plain API calls working — which is indistinguishable
  // from a blocked CDN right up to here. A HEAD with no custom headers is a
  // simple request: no preflight, no body. If that gets through, the host is
  // reachable and the *ranged* request is what is being stopped.
  const plain = await diagRequest(url, { fetchImpl, timeoutMs, signal, init: { method: 'HEAD' }, parse: 'none' });
  out.plainHttp = plain.http;
  try { out.plainHost = plain.finalUrl ? new URL(plain.finalUrl).host : null; } catch { out.plainHost = null; }
  out.plainStatus = plain.http === 200 || plain.http === 206 ? 'ok' : sourceStatus(plain.http, plain.thrown);
  return out;
}

/** The GGUF side: does the repo exist, and is the quant we ask for in it? */
async function inspectGgufRepo(cfg, preferred, { fetchImpl, timeoutMs, signal, budgetBytes }) {
  const out = {
    repo: cfg.hfGgufRepo || null,
    requestedQuant: cfg.hfGgufQuant || null,
    quantsTried: preferred.slice(),
    status: 'no-source',
    http: null,
    error: null,
    gated: false,
    isPrivate: false,
    lastModified: null,
    downloads: null,
    likes: null,
    repoFileCount: null,
    ggufCount: null,
    treeHttp: null,
    treeStatus: null,
    wouldLoad: null,
    availableQuants: [],
    suggested: null,
    realBytes: null,
    budgetBytes: Number.isFinite(budgetBytes) ? budgetBytes : (cfg.ggufMB > 0 ? cfg.ggufMB * MB : null)
  };
  if (!out.repo) return out;

  const meta = await diagRequest(`${HF_BASE}/api/models/${out.repo}`, { fetchImpl, timeoutMs, signal });
  out.http = meta.http;
  out.status = sourceStatus(meta.http, meta.thrown);
  if (meta.error) out.error = meta.error;
  const data = meta.data && typeof meta.data === 'object' ? meta.data : null;
  if (data) {
    out.gated = data.gated === true || data.gated === 'auto' || data.gated === 'manual';
    out.isPrivate = data.private === true;
    out.lastModified = data.lastModified || null;
    out.downloads = Number.isFinite(data.downloads) ? data.downloads : null;
    out.likes = Number.isFinite(data.likes) ? data.likes : null;
    out.repoFileCount = Array.isArray(data.siblings) ? data.siblings.length : null;
    out.revision = data.sha || null;
  }
  if (meta.thrown === 'bad-json') out.status = 'bad-json';
  if (out.status !== 'ok') return out;
  if (out.gated || out.isPrivate) { out.status = 'restricted'; return out; }

  const tree = await diagRequest(`${HF_BASE}/api/models/${out.repo}/tree/main?recursive=true`, { fetchImpl, timeoutMs, signal });
  out.treeHttp = tree.http;
  out.treeStatus = sourceStatus(tree.http, tree.thrown);
  if (tree.error) out.error = out.error || tree.error;
  const entries = Array.isArray(tree.data) ? tree.data : [];
  const files = ggufCandidates(entries).map(f => ({ path: f.path, bytes: hfEntryBytes(f) }));
  out.ggufCount = files.length;
  if (out.treeStatus !== 'ok') return out;
  if (!files.length) { out.status = 'no-gguf'; return out; }

  const matchFor = q => files.filter(f => f.path.toUpperCase().includes(String(q).toUpperCase()));
  out.quantMatches = preferred.map(q => {
    const hits = matchFor(q);
    const smallest = hits.slice().sort((a, b) => a.bytes - b.bytes)[0] || null;
    return { quant: q, count: hits.length, smallestBytes: smallest ? smallest.bytes : 0, example: smallest ? smallest.path : null };
  });

  const firstHit = preferred.map(q => ({ quant: q, hits: matchFor(q) })).find(x => x.hits.length);
  if (firstHit) {
    const pick = firstHit.hits.slice().sort((a, b) => a.bytes - b.bytes)[0];
    out.wouldLoad = { quant: firstHit.quant, path: pick.path, bytes: pick.bytes };
    out.realBytes = pick.bytes;
    out.status = 'ok';
    return out;
  }

  out.status = 'quant-missing';
  out.availableQuants = summariseQuants(files);
  out.suggested = suggestFile(files, out.budgetBytes || 0);
  return out;
}

/**
 * The ONNX side, which the browser path uses instead of GGUF.
 *
 * Walks the candidate repositories in the same order `resolveOnnxRepo` does and
 * stops at the first one that really holds .onnx weights, because reporting on
 * the configured repo while the loader quietly used a fallback is how a report
 * ends up describing a repository nobody asked for.
 */
async function inspectOnnxRepo(cfg, { fetchImpl, timeoutMs, signal }) {
  const candidates = [...new Set([cfg?.hfId, ...(cfg?.hfIdAlts || [])].filter(Boolean))];
  const out = {
    repo: null,
    configured: cfg?.hfId || null,
    alts: (cfg?.hfIdAlts || []).slice(),
    resolved: null,
    checked: [],
    status: 'no-source',
    http: null,
    error: null,
    fileCount: null,
    hasOnnxWeights: null,
    weightFile: null,
    lastModified: null,
    gated: false
  };
  if (!candidates.length) return out;

  for (const repo of candidates) {
    const meta = await diagRequest(`${HF_BASE}/api/models/${repo}`, { fetchImpl, timeoutMs, signal });
    const entry = {
      repo,
      http: meta.http,
      status: sourceStatus(meta.http, meta.thrown),
      hasWeights: null,
      weightFile: null,
      error: meta.error || null
    };
    const data = meta.data && typeof meta.data === 'object' ? meta.data : null;
    if (data) {
      entry.lastModified = data.lastModified || null;
      entry.fileCount = Array.isArray(data.siblings) ? data.siblings.length : null;
      entry.gated = data.gated === true || data.gated === 'auto' || data.gated === 'manual';
      // Only a real file list can prove the weights are missing; an empty one
      // proves nothing, so leave it unknown rather than reporting a false absence.
      if (Array.isArray(data.siblings) && data.siblings.length) {
        const weights = data.siblings
          .map(f => String(f?.rfilename || ''))
          .filter(f => /\.onnx$/i.test(f) && !/\.onnx_data$/i.test(f));
        entry.hasWeights = weights.length > 0;
        entry.weightFile = weights[0] || null;
      }
    }
    if (meta.thrown === 'bad-json') entry.status = 'bad-json';
    out.checked.push(entry);
    if (entry.status === 'ok' && entry.hasWeights === true) {
      out.resolved = repo;
      break;
    }
  }

  // `resolveOnnxRepo` falls back to the first candidate when none of them can
  // prove they hold weights, so the report describes the same repository the
  // loader would actually try.
  const chosen = out.resolved ? out.checked.find(c => c.repo === out.resolved) : out.checked[0];
  out.repo = chosen.repo;
  out.http = chosen.http;
  out.status = chosen.status;
  out.error = chosen.error;
  out.fileCount = chosen.fileCount ?? null;
  out.hasOnnxWeights = chosen.hasWeights;
  out.weightFile = chosen.weightFile;
  out.lastModified = chosen.lastModified ?? null;
  out.gated = Boolean(chosen.gated);
  return out;
}

/**
 * Does a successful response actually carry a model, or is it the host's own
 * index page? A static host with no such file answers 200 text/html — the dev
 * server's SPA fallback does exactly that — and calling that "present" would
 * send the loader after a few kilobytes of HTML instead of a GGUF.
 */
function servedLooksLikeModel(headers, bytes) {
  const ct = String(headers?.get?.('content-type') || '').toLowerCase();
  if (ct.includes('text/html')) return false;
  if (Number(bytes) > MIN_SERVED_GGUF_BYTES) return true;
  // No usable length: trust an explicit binary/model type, reject the rest.
  return ct.includes('octet-stream') || ct.includes('gguf');
}

/** Is this site serving the model itself, or is every load a download? */
async function inspectSelfHostedCopy(cfg, { fetchImpl, timeoutMs, signal }) {
  let url = null;
  try { url = resolveAssetUrl(`api/waffle-ai/gguf/${cfg.ggufFile}`); } catch { return null; }
  const out = { file: cfg.ggufFile, url, status: 'unknown', http: null, bytes: null, contentType: null };
  const head = await diagRequest(url, { fetchImpl, timeoutMs, signal, init: { method: 'HEAD' }, parse: 'none' });
  out.http = head.http;
  out.contentType = String(head.headers?.get?.('content-type') || '') || null;
  if (head.http === 405 || head.http === 501) {
    // Some static hosts refuse HEAD; a one-byte ranged GET asks the same thing.
    const ranged = await diagRequest(url, { fetchImpl, timeoutMs, signal, init: { method: 'GET', headers: { Range: 'bytes=0-0' } }, parse: 'none' });
    out.http = ranged.http;
    out.contentType = String(ranged.headers?.get?.('content-type') || '') || out.contentType;
    const range = ranged.headers?.get?.('content-range') || '';
    const total = Number(String(range).split('/')[1]);
    if (Number.isFinite(total) && total > 0) out.bytes = total;
    if (ranged.http !== 200 && ranged.http !== 206) out.status = sourceStatus(ranged.http, ranged.thrown);
    else out.status = servedLooksLikeModel(ranged.headers, out.bytes) ? 'present' : 'not-a-model';
    return out;
  }
  if (head.http === 200 || head.http === 206) {
    const len = Number(head.headers?.get?.('content-length'));
    out.bytes = Number.isFinite(len) && len > 0 ? len : null;
    out.status = servedLooksLikeModel(head.headers, out.bytes) ? 'present' : 'not-a-model';
    return out;
  }
  out.status = sourceStatus(head.http, head.thrown);
  return out;
}

/**
 * Turn the facts into the lines a person reads at the end of a failed reply.
 * Every number in here came from a response, and every line names where it came
 * from — an invented size is worse than no size.
 */
export function describeModelSourceFacts(facts) {
  if (!facts) return [];
  const lines = [];
  const g = facts.gguf;

  if (g && g.repo) {
    // The headline is about the *request*; the finding that came after a
    // successful request (no GGUF in there, quant missing) gets its own line.
    // With an HTTP status the headline quotes it; with none, the request never
    // got that far, so the headline says why (timed out, unreachable) instead of
    // the meaningless "no response".
    const reached = g.http !== null && g.http !== undefined;
    const copy = (reached ? SOURCE_STATUS_COPY[sourceStatus(g.http, null)] : SOURCE_STATUS_COPY[g.status]) || g.status;
    const head = `GGUF repo ${g.repo} — HTTP ${reached ? g.http : 'none'}, ${copy}`;
    lines.push(reached
      ? `${head}${g.lastModified ? `, last modified ${String(g.lastModified).slice(0, 10)}` : ''}${g.ggufCount !== null && g.ggufCount !== undefined ? `, ${g.ggufCount} GGUF file(s) in it` : ''}.`
      : `${head}.`);
    if (g.error && g.status !== 'ok') lines.push(`Hugging Face said: ${String(g.error).slice(0, 180)}`);
    if (g.gated) lines.push('That repository is gated: the licence has to be accepted with an account, which a web page cannot do for you.');
    if (g.isPrivate) lines.push('That repository is private, so it is invisible to an unauthenticated browser.');

    if (g.status === 'ok' && g.wouldLoad) {
      lines.push(`Quant asked for: ${(g.quantsTried || []).join(' → ') || g.requestedQuant || 'the preset default'}. The loader would take ${g.wouldLoad.path} (${fmtBytes(g.wouldLoad.bytes)}).`);
      if (g.budgetBytes > 0) {
        const over = g.wouldLoad.bytes > g.budgetBytes;
        const ratio = g.wouldLoad.bytes / g.budgetBytes;
        const pct = Math.round(Math.abs(ratio - 1) * 100);
        // Past a couple of times the budget a percentage stops meaning
        // anything, so say "27x" rather than "2614%".
        const gap = over ? (ratio >= 2 ? `${ratio.toFixed(1)}x more than` : `${pct}% more than`) : `${pct}% under`;
        lines.push(over
          ? `The model table budgets ${fmtBytes(g.budgetBytes)} for this model but the real file is ${fmtBytes(g.wouldLoad.bytes)} — ${gap} the warning and the WASM budget were written against.`
          : `The model table budgets ${fmtBytes(g.budgetBytes)}; the real file is ${fmtBytes(g.wouldLoad.bytes)} (${gap}), so the budget is honest.`);
      }
    }
    if (g.status === 'quant-missing') {
      lines.push(`No file in that repository matches ${(g.quantsTried || []).join(', ') || g.requestedQuant}.`);
      if (g.availableQuants?.length) {
        lines.push(`Quants actually present: ${g.availableQuants.map(q => `${q.quant} (${fmtBytes(q.smallestBytes)}${q.files > 1 ? `, ${q.files} files` : ''})`).join(', ')}.`);
      }
      if (g.suggested) lines.push(`Closest usable file: ${g.suggested.path} (${fmtBytes(g.suggested.bytes)}) — ${g.suggested.why}.`);
    }
    if (g.status === 'no-gguf') lines.push('That repository holds no GGUF files at all, so the WLlama path cannot load from it whatever quant is asked for.');
  }

  const o = facts.onnx;
  if (o && o.repo) {
    const chain = (o.checked || []).filter(c => c && c.repo);
    if (chain.length > 1) {
      // More than one candidate was really asked, so show the walk. A 401 on the
      // configured repo is not a dead end when a fallback answered, and the repo
      // the loader settles on is the one whose files get probed.
      lines.push(`ONNX repos this build tries, in order: ${chain.map(c =>
        `${c.repo} → HTTP ${c.http ?? 'none'}, ${SOURCE_STATUS_COPY[c.status] || c.status}${c.hasWeights === true ? ', with .onnx weights' : c.hasWeights === false ? ', and not one .onnx weight among them' : ''}`
      ).join('; ')}.`);
      lines.push(o.resolved
        ? `The loader would use ${o.resolved} — the first of those that really holds .onnx weights${o.configured && o.configured !== o.resolved ? `, not the configured ${o.configured}` : ''}.`
        : `None of them could prove it holds .onnx weights, so the loader would try ${o.repo} anyway and report whatever it finds there.`);
    } else {
      const copy = SOURCE_STATUS_COPY[o.status] || o.status;
      lines.push(`ONNX repo ${o.repo} — HTTP ${o.http ?? 'none'}, ${copy}${o.fileCount !== null ? `, ${o.fileCount} file(s)` : ''}${o.hasOnnxWeights === false ? ', and not one .onnx weight among them' : o.hasOnnxWeights === true ? ', with .onnx weights present' : ''}.`);
      if (o.alts?.length) lines.push(`Fallback ONNX repos this build would try next: ${o.alts.join(', ')}.`);
    }
  }

  // The file itself is a different request from the metadata above, and on a
  // different host once Hugging Face redirects it to the CDN.
  const probes = [
    { what: 'The GGUF file WLlama would download', d: facts.download },
    { what: 'The ONNX weight the browser path would download', d: facts.onnxDownload }
  ].filter(x => x.d && x.d.status !== 'no-source');
  let contradicted = false;
  let plainWorked = false;
  for (const { what, d } of probes) {
    const name = d.path ? `${what} — ${d.path} —` : `${what} —`;
    if (d.status === 'ok') {
      lines.push(`${name} answered HTTP ${d.http}${d.bytes ? ` and is ${fmtBytes(d.bytes)} in total` : ''}${d.host ? `, served from ${d.host}` : ''}, so this browser can fetch the weights.`);
      continue;
    }
    lines.push(`${name} could not be fetched: HTTP ${d.http ?? 'none'}, ${SOURCE_STATUS_COPY[d.status] || d.status}${d.error ? ` (${String(d.error).slice(0, 140)})` : ''}.`);
    if (d.plainStatus === 'ok') {
      plainWorked = true;
      lines.push(`A plain request for that same file — a HEAD, with no Range header and therefore no CORS preflight — did succeed: HTTP ${d.plainHttp}${d.plainHost ? `, from ${d.plainHost}` : ''}. The file host is reachable, so what is being stopped is the *ranged* download the loaders send, which a browser must preflight with an OPTIONS request first.`);
    } else if (d.plainStatus) {
      lines.push(`A plain request for that same file failed too (HTTP ${d.plainHttp ?? 'none'}, ${SOURCE_STATUS_COPY[d.plainStatus] || d.plainStatus}), so this is not only about the Range header.`);
    }
    if ([g, facts.onnx].some(r => r && (r.http === 200 || r.http === 206))) contradicted = true;
  }
  if (contradicted) {
    lines.push('That is not a dead network: the repository API on huggingface.co answered HTTP 200 from this same browser moments earlier. Hugging Face serves metadata from huggingface.co and the weights from its LFS CDN after a redirect, so what is blocked, filtered or timing out is the *file* host — most often a firewall, proxy or privacy extension that allows the API but not large binaries.');
  }

  const dc = facts.deviceCache;
  if (dc && dc.repo) {
    if (dc.present) {
      const detail = [dc.sizeBytes ? fmtBytes(dc.sizeBytes) : null, dc.quant || null].filter(Boolean).join(', ');
      lines.push(`This browser has that GGUF pre-cached on *this origin*${detail ? ` (${detail})` : ''}, so the WLlama path can start it with no download at all. Pre-cached copies belong to one origin: the same model can be ready on the live site and missing on a preview host or a new port.`);
    } else {
      lines.push(`This origin holds no pre-cached copy of that GGUF, so every load from here has to download it. Pre-caches are per origin, which is why a model that already ran on the live site can still fail from scratch on a different host or port.`);
    }
  }

  const pf = facts.platform;
  if (pf && (pf.label || pf.note)) {
    lines.push(`This device: ${pf.label || 'unknown platform'}. ${String(pf.note || '').replace(/\s*\n\s*/g, ' ')}`);
  }

  const l = facts.selfHosted;
  if (l) {
    if (l.status === 'present') {
      lines.push(`This site is serving the model itself: ${l.file} is present on this origin${l.bytes ? ` (${fmtBytes(l.bytes)})` : ''}. The WLlama path loads that copy *first* — same origin, so no CORS preflight and no third-party host to block — and keeps it on this device afterwards. Only the ONNX runtimes still have to reach Hugging Face.`);
    } else if (l.status === 'not-a-model') {
      lines.push(`This origin answered ${l.file} with ${l.contentType ? `${l.contentType}` : 'a page'}${l.bytes ? ` of ${fmtBytes(l.bytes)}` : ''}, not a model — a static host with no such file usually serves its own index page, so it counts as absent. Every load still has to reach huggingface.co.`);
    } else if (l.status === 'not-found') {
      lines.push(`This site is not serving the model itself — ${l.file} is absent on this origin (HTTP ${l.http}), so every load has to reach huggingface.co. \`node scripts/fetch-model.mjs\` (or \`npm run models\`) puts it here; a deploy that runs it serves the weights from its own origin and the browser pre-caches them by itself.`);
    }
    else lines.push(`The self-hosted copy at ${l.url} reported ${SOURCE_STATUS_COPY[l.status] || l.status}.`);
  }

  return lines;
}

/**
 * The one-line fix that follows from the facts. Kept separate from the report
 * so a caller can show the evidence without the advice, or the advice without
 * re-deriving it.
 */
export function modelSourceFixAdvice(facts, classified) {
  const g = facts?.gguf;
  if (!g) return null;
  const where = `TEXT_MODELS in waffle-browser-ai.js (entry "${facts.id}")`;
  if (g.status === 'not-found') return `That GGUF repository is gone. Point hfGgufRepo for this model at a live one in ${where}, or self-host the file.`;
  if (g.status === 'restricted') return 'A gated or private repository can never load from a public page: accept the licence with a token on a machine, then self-host the file with `node scripts/fetch-model.mjs`.';
  if (g.status === 'rate-limited') return 'Hugging Face is rate-limiting this IP. Wait, or self-host the model so the site never asks them again.';
  if (g.status === 'quant-missing' && g.suggested) {
    const quant = g.suggested.quant || quantFromPath(g.suggested.path);
    return `Set hfGgufQuant to ${quant || 'a quant that exists in that repo'} in ${where} — the quant in the table is not published there.`;
  }
  if (g.status === 'no-gguf') return `That repo publishes no GGUF. Change hfGgufRepo in ${where} to a repo that does, or drop the WLlama attempt for this model.`;
  const served = facts.selfHosted;
  const downloadBlocked = classified?.kind === 'blocked-download' || classified?.kind === 'blocked-preflight';
  if (downloadBlocked && served?.status === 'present') {
    const what = classified.kind === 'blocked-preflight' ? 'a blocked preflight' : 'a blocked download';
    return `Hugging Face is out of the WLlama path already: this site serves ${served.file} from its own origin${served.bytes ? ` (${fmtBytes(served.bytes)})` : ''} and that copy is tried first, so ${what} on the CDN should not have stopped it. If WLlama still failed, look at this origin instead — the file being answered as text/html, truncated, or blocked here too. The ONNX runtimes have no same-origin copy and will keep failing until the network allows huggingface.co.`;
  }
  if (classified?.kind === 'blocked-preflight') return 'A plain request for the file succeeded, so the host is reachable and the block is on the preflighted ranged download: allow OPTIONS to huggingface.co and cdn-lfs*.hf.co (or disable privacy extensions for this site) — or take the CDN out of the path entirely by serving the weights from this origin with `node scripts/fetch-model.mjs`, after which the browser pre-caches them itself.';
  if (classified?.kind === 'blocked-download') return 'The repository is reachable and the file exists, so the block is on the download itself: serve it from this origin with `node scripts/fetch-model.mjs` (a deploy that runs it does this automatically), which removes the CDN redirect and the cross-origin preflight, or retry from a network that allows large downloads.';
  if (g.status === 'timeout' || g.status === 'unreachable') return 'The diagnostic call itself could not reach huggingface.co, so treat the network as the suspect before the model: blocked DNS, a firewall, a privacy extension, or no CORS from this origin.';
  if (g.status === 'ok' && g.wouldLoad && g.budgetBytes > 0 && g.wouldLoad.bytes > g.budgetBytes) {
    return `Raise ggufMB for this model in ${where} (the real file is ${fmtBytes(g.wouldLoad.bytes)}), or pick a lighter quant — the budget in the table is what the warnings and the WASM heap check are computed from.`;
  }
  if (classified?.kind === 'memory') return 'The source is fine, so this is the device: pick a smaller model or a lighter quantization preset in Settings → AI Models.';
  if (classified?.kind === 'runtime') return 'The source is fine, so this is the runtime: switch the fallback mode to CPU/WASM — Chromium without shader-f16 aborts the whole WebGPU module.';
  if (classified?.kind === 'stall') return 'The source is fine and the model loaded, so the runtime wedged mid-reply: reload the page (a stuck WASM or WebGPU worker cannot be revived in place) and try a smaller model or CPU/WASM in Settings \u2192 AI Models.';
  return null;
}

/** Drops the session cache; used by tests and by a "check again" action. */
export function clearModelSourceFactsCache() {
  hfDiagCache.clear();
}

/* ------------------------------------------------------------------ *
 * Context budgeting.
 *
 * `n_ctx` is the *total* window: prompt and reply share it. The chat used to
 * reserve 560 tokens for a reply inside a 768-token CPU context, leaving 208
 * tokens (~800 characters) for the system prompt, the question and eight turns
 * of history combined — and a file attachment is clipped to 5200 characters,
 * roughly six times the entire budget. Overflowing the window does not produce
 * a short answer, it produces no answer, which reads as "the AI is broken".
 * ------------------------------------------------------------------ */

export const CTX_MARGIN_TOKENS = 24;
export const WLAMA_CTX_CPU = 1024;
export const WLAMA_CTX_GPU = 2048;
export const ONNX_PROMPT_BUDGET = 1536;
export const MAX_HISTORY_MESSAGES = 8;

/**
 * Rough token count. Deliberately conservative (3.5 chars/token rather than 4):
 * over-estimating costs a little context, under-estimating overflows the window
 * and the model returns nothing.
 */
export function estimateTokens(text) {
  const s = String(text ?? '');
  return s ? Math.ceil(s.length / 3.5) : 0;
}

/**
 * Clip to a character budget keeping both ends. A file attachment usually
 * matters at the top (what it is) and the bottom (the conclusion), and a
 * question keeps its opening words; the middle is the cheapest thing to lose.
 */
export function clipToCharBudget(text, maxChars) {
  const s = String(text ?? '');
  if (maxChars <= 0) return '';
  if (s.length <= maxChars) return s;
  if (maxChars < 80) return s.slice(0, maxChars);
  const head = Math.floor(maxChars * 0.7);
  const tail = Math.max(0, maxChars - head - 40);
  return `${s.slice(0, head)}\n\u2026[trimmed to fit the model\u2019s context window]\u2026\n${tail ? s.slice(s.length - tail) : ''}`;
}

/**
 * Fit a conversation into `promptBudget` tokens, newest first.
 *
 * Dropping the *oldest* history is free; dropping the newest message would
 * generate a reply to nothing, so when the newest one is too big it is clipped
 * instead of discarded. Returns the messages to send and the tokens they cost
 * (excluding the system prompt) so the caller can size the reply.
 */
export function fitChatToTokenBudget({ systemPrompt, messages, promptBudget, maxMessages = MAX_HISTORY_MESSAGES, systemShare = 0.4 }) {
  const budget = Math.max(0, Math.floor(promptBudget));
  // The system prompt is fitted as well. A long one can consume the entire
  // window before the visitor’s question arrives, and nothing downstream
  // re-checks it, so it is capped at a share of the budget and clipped like any
  // other message. Callers must send the returned `systemPrompt`, not the input.
  const sysCap = Math.max(32, Math.floor(budget * systemShare));
  let sys = systemPrompt == null ? '' : String(systemPrompt);
  if (estimateTokens(sys) > sysCap) sys = clipToCharBudget(sys, Math.floor(sysCap * 3.5));
  const sysTokens = estimateTokens(sys);
  let room = Math.max(0, budget - sysTokens);
  const usable = (Array.isArray(messages) ? messages : [])
    .filter(m => m?.role && typeof m.content === 'string')
    .slice(-maxMessages);

  const kept = [];
  let usedTokens = 0;
  for (let i = usable.length - 1; i >= 0; i--) {
    const m = usable[i];
    const t = estimateTokens(m.content);
    if (t <= room) {
      kept.unshift({ role: m.role, content: m.content });
      room -= t;
      usedTokens += t;
      continue;
    }
    if (!kept.length && room > 40) {
      const clipped = clipToCharBudget(m.content, Math.floor(room * 3.5));
      kept.unshift({ role: m.role, content: clipped });
      usedTokens += estimateTokens(clipped);
    }
    // Older history cannot fit either once a newer message did not.
    break;
  }
  return {
    systemPrompt: sys,
    messages: kept,
    promptTokens: usedTokens,
    systemTokens: sysTokens,
    dropped: usable.length - kept.length
  };
}

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
      markInferenceBeat();
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
  const device = resolveOnnxDevice(diag, preferredDevice);
  const useVision = cfg.loader === 'qwen3_5' && Array.isArray(imageUrls) && imageUrls.length > 0;
  const loaded = await getBrowserGenerator(cfg, device, onStatus, useVision);
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const { TextStreamer, RawImage } = await getTransformers();
  onStatus?.({ state: 'generating', detail: `${cfg.label}${useVision ? ' Vision' : ''} · ${loaded.device.toUpperCase()}` });

  // Fit by tokens, not by message count: eight long turns overflow the window
  // and the model then answers with nothing at all.
  const onnxFit = fitChatToTokenBudget({
    systemPrompt,
    messages,
    promptBudget: ONNX_PROMPT_BUDGET
  });
  const chat = [];
  if (onnxFit.systemPrompt) chat.push({ role: 'system', content: onnxFit.systemPrompt });
  const recent = onnxFit.messages;
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
      markInferenceToken();
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
    // Dedupe by first shard, then sort by the *total* bytes of the whole shard
    // set. Sorting on one shard's size picks the wrong model for any sharded
    // repo, and without the dedupe the same file could be chosen twice.
    const seen = new Map();
    for (const c of hits) {
      const file = firstShardOf(candidates, c.path);
      if (seen.has(file)) continue;
      seen.set(file, { file, path: c.path, sizeBytes: shardTotalBytes(candidates, file), size: c.size || 0 });
    }
    const sized = [...seen.values()].sort((a, b) =>
      (a.sizeBytes || a.size || Infinity) - (b.sizeBytes || b.size || Infinity));
    const fitting = budgetBytes > 0 ? sized.filter(x => x.sizeBytes > 0 && x.sizeBytes <= budgetBytes) : [];
    const chosen = (fitting.length ? fitting : sized)[0];
    if (!chosen) throw new Error(`No usable GGUF file in ${repo}`);
    return {
      file: chosen.file,
      path: chosen.path,
      sizeBytes: chosen.sizeBytes,
      overBudget: Boolean(budgetBytes > 0 && chosen.sizeBytes > budgetBytes)
    };
  };

  for (const q of preferredQuants) {
    const hits = candidates.filter(f => f.path.toUpperCase().includes(q.toUpperCase()));
    if (hits.length) return { ...choose(hits), quant: q };
  }
  // Name the quant actually taken rather than the sentinel 'smallest'. That
  // sentinel made the on-device cache permanently unusable for these repos: the
  // load path only accepts a cached quant that appears in the preset's list, and
  // 'smallest' never does, so every load went back to the network for nothing.
  const fallback = choose(candidates);
  return { ...fallback, quant: quantFromPath(fallback.path) || 'smallest' };
}

/** The quantization token in a GGUF filename, when it uses a name we know. */
function quantFromPath(p) {
  const m = String(p || '').toUpperCase().match(/(IQ[1-8]_[A-Z0-9_]+|Q[1-8]_[A-Z0-9_]+|BF16|F16)/);
  return m ? m[1] : null;
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

function rememberPrecachedGguf(repo, { url, quant, sizeBytes, preset }) {
  if (!repo || !url) return;
  const index = readPrecacheIndex();
  // The preset is recorded because the same repo resolves to a different file
  // under a different quantization preset; without it a cached entry cannot be
  // validated after the visitor changes their mind.
  index[repo] = { url, quant, sizeBytes: sizeBytes || 0, preset: preset || null, at: Date.now() };
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
  rememberPrecachedGguf(cfg.hfGgufRepo, { url, quant: picked.quant, sizeBytes, preset: preset.id });
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

/**
 * Anything smaller than this is not a model: a static host that has no such
 * file answers 200 with its own index page, and loading that as a GGUF would
 * fail in a way that looks like a corrupt download.
 */
const MIN_SERVED_GGUF_BYTES = 1_000_000;

/**
 * The label recorded for a copy this origin serves. Its quant lives in
 * `.cache/waffle-ai/models.json`, which the browser never sees, so claiming one
 * would be inventing evidence — the preset is recorded instead, which is what
 * the loader actually validates against.
 */
const LOCAL_QUANT_LABEL = 'served here';

const KEY_AUTO_PRECACHE = 'bite-ai-auto-precache';

/** How long an automatic pre-cache waits before it would consider running again. */
export const AUTO_PRECACHE_COOLDOWN_MS = 12 * 60 * 60 * 1000;

let autoPrecacheController = null;

/**
 * Cancel the background pre-cache, if one is running. Called by the inference
 * queue the moment a real prompt starts, and by anything that needs the device
 * copy slot or the network for itself.
 */
export function stopAutoPrecache(reason = 'interrupted') {
  const controller = autoPrecacheController;
  autoPrecacheController = null;
  if (controller) {
    try { controller.abort(reason); } catch { controller.abort(); }
  }
  return Boolean(controller);
}

export function isAutoPrecacheRunning() {
  return Boolean(autoPrecacheController);
}

/** What this origin serves itself, per model id. Same-origin HEADs only. */
export async function probeServedModels({ fetchImpl = fetch, signal = null } = {}) {
  const out = {};
  for (const m of TEXT_MODELS.filter(x => x.ggufFile)) {
    try {
      out[m.id] = await inspectSelfHostedCopy(m, { fetchImpl, timeoutMs: HF_DIAG_TIMEOUT_MS, signal });
    } catch {
      out[m.id] = null;
    }
  }
  return out;
}

/**
 * Decide what an idle browser should pre-cache — pure, so the rules can be
 * tested without a network or an OPFS.
 *
 * Only files this origin already serves qualify. The site shipped them, so
 * keeping a device copy costs no third-party request, trips no CORS preflight
 * and works on exactly the networks that block huggingface.co.
 */
export function planAutoPrecache({
  models,
  served = {},
  cached = {},
  now = Date.now(),
  lastRunAt = 0,
  cooldownMs = AUTO_PRECACHE_COOLDOWN_MS,
  storageOk = true,
  saveData = false,
  busy = false,
  force = false
}) {
  if (busy) return { run: false, reason: 'a chat is running', ids: [] };
  if (!storageOk) return { run: false, reason: 'this browser exposes no on-device storage', ids: [] };
  if (saveData) return { run: false, reason: 'the browser asked to save data', ids: [] };
  const eligible = models.filter(m => {
    if (!m.hfGgufRepo || !m.ggufFile) return false;
    const local = served[m.id];
    if (local?.status !== 'present' || (local.bytes || 0) <= MIN_SERVED_GGUF_BYTES) return false;
    return !cached[m.hfGgufRepo]?.present;
  });
  if (!eligible.length) {
    return { run: false, reason: 'this origin serves no model that is not already on the device', ids: [] };
  }
  if (!force && now - lastRunAt < cooldownMs) {
    return { run: false, reason: 'it already ran within the last 12 hours', ids: [] };
  }
  return { run: true, reason: '', ids: eligible.map(m => m.id) };
}

/**
 * Pre-cache one model from *this origin's* copy — never from Hugging Face.
 */
export async function precacheFromThisOrigin(modelId, { onProgress, signal, fetchImpl = fetch } = {}) {
  const cfg = TEXT_MODELS.find(m => m.id === modelId);
  if (!cfg?.ggufFile) throw new Error(`${modelId} has no GGUF file name to look for on this origin.`);
  const served = await inspectSelfHostedCopy(cfg, { fetchImpl, timeoutMs: HF_DIAG_TIMEOUT_MS, signal });
  if (!served || served.status !== 'present' || (served.bytes || 0) <= MIN_SERVED_GGUF_BYTES) {
    throw new Error(`This site is not serving ${cfg.ggufFile}${served?.http ? ` (HTTP ${served.http})` : ''}, so there is nothing here to pre-cache.`);
  }
  const diag = await detectDeviceDiagnostics().catch(() => null);
  if (diag && !diag.hasOPFS) {
    throw new Error('This browser exposes no on-device storage (OPFS), so models cannot be pre-cached.');
  }
  onProgress?.({
    state: 'downloading',
    detail: `Pre-caching ${cfg.label} from this site (${fmtMB(served.bytes)})…`,
    loaded: 0,
    total: served.bytes
  });
  const mm = await getModelManager();
  const model = await mm.downloadModel({ url: served.url }, {
    signal,
    progressCallback: pr => onProgress?.({
      state: 'downloading',
      detail: `Pre-caching ${cfg.label} from this site: ${pr.total > 0 ? Math.round((pr.loaded / pr.total) * 100) : 0}%`,
      loaded: pr.loaded,
      total: pr.total
    })
  });
  const sizeBytes = model?.size > 0 ? model.size : served.bytes;
  if (cfg.hfGgufRepo) {
    rememberPrecachedGguf(cfg.hfGgufRepo, {
      url: served.url,
      quant: LOCAL_QUANT_LABEL,
      sizeBytes,
      preset: null
    });
  }
  return { modelId, url: served.url, sizeBytes, source: 'this origin' };
}

/**
 * Pre-cache whatever this origin serves, in the background, at most once every
 * `AUTO_PRECACHE_COOLDOWN_MS`. Quiet by design: it reports through `onProgress`
 * only, and it cancels itself the moment a chat starts.
 */
export async function autoPrecacheServedModels({ onProgress, signal, fetchImpl = fetch, now = Date.now(), force = false } = {}) {
  if (autoPrecacheController) return { run: false, reason: 'a pre-cache is already running', done: [] };
  const controller = new AbortController();
  const onOuterAbort = () => { try { controller.abort('interrupted'); } catch {} };
  signal?.addEventListener?.('abort', onOuterAbort, { once: true });
  autoPrecacheController = controller;
  const done = [];
  try {
    const models = TEXT_MODELS.filter(m => m.hfGgufRepo && m.ggufFile);
    const served = await probeServedModels({ fetchImpl, signal: controller.signal });
    const cached = {};
    for (const e of await listPrecachedModels().catch(() => [])) cached[e.repo] = { present: Boolean(e.usable) };
    const conn = typeof navigator !== 'undefined' ? navigator.connection || null : null;
    const diag = await detectDeviceDiagnostics().catch(() => null);
    const plan = planAutoPrecache({
      models,
      served,
      cached,
      now,
      lastRunAt: Number(readCachePref(KEY_AUTO_PRECACHE, {})?.at) || 0,
      storageOk: diag ? Boolean(diag.hasOPFS) : true,
      saveData: Boolean(conn?.saveData) || ['slow-2g', '2g'].includes(conn?.effectiveType),
      busy: getInferenceQueueState().busy,
      force
    });
    if (controller.signal.aborted) return { run: false, reason: 'cancelled before it started', done };
    if (!plan.run) return { run: false, reason: plan.reason, done };

    writeCachePref(KEY_AUTO_PRECACHE, { at: now, ids: plan.ids });
    for (const id of plan.ids) {
      if (controller.signal.aborted) break;
      if (getInferenceQueueState().busy) { stopAutoPrecache('a chat started'); break; }
      try {
        const result = await precacheFromThisOrigin(id, { signal: controller.signal, onProgress });
        done.push({ id, sizeBytes: result.sizeBytes });
      } catch (err) {
        if (err?.name === 'AbortError' || controller.signal.aborted) break;
        onProgress?.({ state: 'error', id, detail: `${id}: ${err?.message || err}`, loaded: 0, total: 0 });
      }
    }
    return { run: true, reason: '', done };
  } finally {
    if (autoPrecacheController === controller) autoPrecacheController = null;
    signal?.removeEventListener?.('abort', onOuterAbort);
  }
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

  // Fit the prompt once against the *smallest* window we might end up loading
  // with, so the result is valid on either the CPU or the GPU path. Reserving
  // max_tokens inside n_ctx is what used to leave ~208 tokens for everything
  // the visitor actually typed.
  const fitted = fitChatToTokenBudget({
    systemPrompt,
    messages,
    promptBudget: Math.max(64, WLAMA_CTX_CPU - maxTokens - CTX_MARGIN_TOKENS)
  });
  // If the trimmed prompt plus the requested reply still will not fit, shrink
  // the reply rather than overflowing: a short answer beats no answer.
  // Both halves of the prompt count: ignoring systemTokens let a long system
  // prompt push prompt+reply past n_ctx even after the messages were trimmed.
  const usedPromptTokens = fitted.systemTokens + fitted.promptTokens;
  const effectiveMaxTokens = Math.max(48, Math.min(maxTokens, WLAMA_CTX_CPU - usedPromptTokens - CTX_MARGIN_TOKENS));

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
      n_ctx: gpu ? WLAMA_CTX_GPU : WLAMA_CTX_CPU,
      n_batch: gpu ? 256 : 128,
      n_threads: threads,
      n_gpu_layers: gpu ? 99 : 0,
      log_level: 3,
      useCache: true,
      progressCallback({ loaded, total }) {
        markInferenceBeat();
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
    // Valid only for the preset it was fetched with. Entries written before the
    // preset was recorded fall back to the quant-name check, and an unrecognised
    // quant ('smallest') is still accepted — re-resolving it would mean another
    // trip to the network to arrive at the same file.
    // A copy of what this origin serves is one fixed file, not a promise about
    // a quant, so it stays usable whatever preset is selected — and its label
    // says 'served here' rather than naming a quant nobody verified.
    const cacheUsable = cachedEntry?.quant === LOCAL_QUANT_LABEL
      ? true
      : cachedEntry?.preset
        ? cachedEntry.preset === preset.id
        : (quantList.includes(cachedEntry?.quant) || cachedEntry?.quant === 'smallest');
    if (cachedEntry?.url && cacheUsable) {
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

    // 2) A GGUF this origin serves itself. Same origin means no CORS
    //    preflight, no redirect to an LFS CDN and no third-party host for a
    //    firewall or a privacy extension to block — which is the failure this
    //    app keeps meeting in the wild. It is copied into on-device storage on
    //    the way, so the next start needs no network at all.
    if (localGgufUrl) {
      let served = null;
      try { served = await inspectSelfHostedCopy({ ggufFile }, { timeoutMs: HF_DIAG_TIMEOUT_MS, signal }); } catch {}
      if (served?.status === 'present' && (served.bytes || 0) > MIN_SERVED_GGUF_BYTES) {
        const sizeNote = served.bytes ? ` (${fmtMB(served.bytes)})` : '';
        quantLabel = LOCAL_QUANT_LABEL;
        onStatus?.({
          state: 'loading',
          detail: `Loading ${ggufFile} from this site${sizeNote} via WLlama (${gpu ? 'WebGPU' : 'CPU WASM'})…`
        });
        try {
          const mm = await getModelManager();
          const model = await mm.downloadModel({ url: localGgufUrl }, {
            signal,
            progressCallback: pr => {
              if (pr.total > 0) {
                onStatus?.({
                  state: 'loading',
                  detail: `Keeping this site's copy of ${ggufFile} on your device (${Math.round((pr.loaded / pr.total) * 100)}%)…`
                });
              }
            }
          });
          await inst.loadModel(model, loadParams);
          if (hfRepo) {
            rememberPrecachedGguf(hfRepo, {
              url: localGgufUrl,
              quant: quantLabel,
              sizeBytes: model?.size > 0 ? model.size : served.bytes,
              preset: null
            });
          }
          return { source: 'local', quant: quantLabel, sizeBytes: served.bytes };
        } catch (err) {
          if (err?.name === 'AbortError' || signal?.aborted) throw err;
          // No on-device storage, or the copy failed. Streaming the same-origin
          // file still beats a third-party download, so do that instead.
          pushNativeLog('warn', [`could not keep ${ggufFile} on device: ${err?.message || err}`]);
          await inst.loadModelFromUrl(localGgufUrl, loadParams);
          return { source: 'local', quant: quantLabel, sizeBytes: served.bytes };
        }
      }
    }

    // 3) HuggingFace → downloaded straight into on-device storage.
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
      rememberPrecachedGguf(hfRepo, { url, quant: picked.quant, sizeBytes: picked.sizeBytes, preset: preset.id });
      return { source: 'hf', quant: quantLabel, sizeBytes: picked.sizeBytes };
    }

    // 4) Nothing on this device, nothing served by this origin, and no
    //    HuggingFace repo configured to fall back on.
    throw new Error(ggufFile
      ? `Local GGUF (${ggufFile}) is not served by this host and no HuggingFace GGUF repo is configured.`
      : 'No HuggingFace GGUF repo is configured for this model and this host serves no local GGUF.');
  };

  let loadedHere = false;
  if (wllamaInstance && !wllamaDirty && wllamaLoadedFile === `${targetKey}:${useGpu}` && wllamaInstance.isModelLoaded?.()) {
    loadedHere = true;
  } else if (wllamaInstance && wllamaDirty) {
    // The last request on it never finished, so its slot may still be held.
    // Starting from it is how a second prompt ends up waiting forever.
    await disposeWllama();
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
  if (fitted.systemPrompt) chat.push({ role: 'system', content: fitted.systemPrompt });
  // Already role-checked and token-fitted above.
  for (const m of fitted.messages) {
    chat.push({ role: m.role, content: m.content });
  }

  let acc = '';
  let stream;
  try {
    stream = await wllamaInstance.createChatCompletion({
      messages: chat,
      max_tokens: effectiveMaxTokens,
      temperature,
      stream: true,
      // Wllama only releases the request slot when *its* loop ends: `getResponse`
      // polls until the model is done and calls `cancelRequest` in its finally
      // when it was not. Handing it our signal is what makes Stop actually stop,
      // instead of leaving the worker generating into a queue nobody reads —
      // which is what the next prompt then waits behind.
      abortSignal: signal
    });
  } catch (err) {
    if (err?.name === 'AbortError' || signal?.aborted) throw err;
    throw wllamaFailure('WLlama chat start', err);
  }

  try {
    for await (const chunk of stream) {
      markInferenceToken();
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const piece = chunk?.choices?.[0]?.delta?.content || '';
      if (piece) {
        acc += piece;
        const cleaned = acc.replace(/<think>[\s\S]*?<\/think>\s*/g, '').replace(/<think>[\s\S]*$/, '');
        onToken?.(piece, cleaned);
      }
    }
  } catch (err) {
    // Walking away from a stream leaves Wllama's slot occupied, so this
    // instance is not reusable — the next prompt gets a fresh one.
    wllamaDirty = true;
    if (err?.name === 'AbortError' || signal?.aborted) throw err;
    if (!acc) throw wllamaFailure('WLlama generation', err);
    // Keep whatever already streamed instead of throwing the answer away.
    pushNativeLog('warn', [`generation interrupted: ${err?.message || err}`]);
  }
  wllamaDirty = false;
  return acc.replace(/<think>[\s\S]*?<\/think>\s*/g, '').replace(/<think>[\s\S]*$/, '').trim();
}

export function getWllamaRuntimeHints() {
  return {
    gpuPoisoned: wllamaGpuPoisoned,
    nativeLog: [...wllamaNativeLog],
    loadedFile: wllamaLoadedFile
  };
}
