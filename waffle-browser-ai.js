export const TEXT_MODELS = [
  {
    id: 'qwen2.5-1.5b',
    label: 'Qwen 2.5 1.5B',
    badge: 'Balanced · Q3_K_L / q4',
    kind: 'server',
    hfId: 'onnx-community/Qwen2.5-1.5B-Instruct',
    dtype: 'q4',
    hfGgufRepo: 'Qwen/Qwen2.5-1.5B-Instruct-GGUF',
    hfGgufQuant: 'Q3_K_L',
    ggufFile: 'qwen2.5-1.5b.gguf',
    desc: 'Qwen 2.5 1.5B via local llama.cpp when cached, or Q3_K_L / q4 in browser (~850 MB)'
  },
  {
    id: 'qwen2.5-coder-1.5b',
    label: 'Qwen 2.5 Coder 1.5B',
    badge: 'Coding · Q3_K_L / q4',
    kind: 'server',
    hfId: 'onnx-community/Qwen2.5-Coder-1.5B-Instruct',
    dtype: 'q4',
    hfGgufRepo: 'Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF',
    hfGgufQuant: 'Q3_K_L',
    ggufFile: 'qwen2.5-1.5b.gguf',
    desc: 'Qwen 2.5 Coder 1.5B for coding & debugging (local server or Q3_K_L / q4 fallback)'
  },
  {
    id: 'qwen3-0.6b',
    label: 'Qwen 3 0.6B',
    badge: 'Light · ~350 MB',
    kind: 'server',
    hfId: 'onnx-community/Qwen3-0.6B-ONNX',
    dtype: 'q4',
    hfGgufRepo: 'unsloth/Qwen3-0.6B-GGUF',
    hfGgufQuant: 'Q3_K_L',
    ggufFile: 'qwen3-0.6b.gguf',
    desc: 'Fast, lightweight Qwen 3 0.6B via llama.cpp, q4 ONNX, or Q3_K_L WLlama'
  },
  {
    id: 'smollm2-135m',
    label: 'SmolLM2 135M',
    badge: 'Chromium Safe · ~95 MB',
    kind: 'browser',
    hfId: 'HuggingFaceTB/SmolLM2-135M-Instruct',
    dtype: 'q4',
    hfGgufRepo: 'bartowski/SmolLM2-135M-Instruct-GGUF',
    hfGgufQuant: 'Q3_K_L',
    ggufFile: 'qwen3-0.6b.gguf',
    desc: 'Ultra-compact ~95 MB model safe for low-RAM Chromium & mobile browsers'
  },
  {
    id: 'smollm2-360m',
    label: 'SmolLM2 360M',
    badge: 'Browser · ~190 MB',
    kind: 'browser',
    hfId: 'HuggingFaceTB/SmolLM2-360M-Instruct',
    dtype: 'q4',
    hfGgufRepo: 'bartowski/SmolLM2-360M-Instruct-GGUF',
    hfGgufQuant: 'Q3_K_L',
    ggufFile: 'qwen3-0.6b.gguf',
    desc: 'Compact in-browser WebGPU/WASM model (~190 MB in Q3_K_L / q4)'
  },
  {
    id: 'qwen2.5-0.5b',
    label: 'Qwen 2.5 0.5B',
    badge: 'Browser · ~310 MB',
    kind: 'browser',
    hfId: 'onnx-community/Qwen2.5-0.5B-Instruct',
    dtype: 'q4',
    hfGgufRepo: 'Qwen/Qwen2.5-0.5B-Instruct-GGUF',
    hfGgufQuant: 'Q3_K_L',
    ggufFile: 'qwen3-0.6b.gguf',
    desc: 'Nimble multilingual model in-browser (~310 MB in Q3_K_L / q4)'
  },
  {
    id: 'qwen3.5-0.8b',
    label: 'Qwen 3.5 0.8B',
    badge: 'Browser · Vision + Chat',
    kind: 'browser',
    loader: 'qwen3_5',
    hfId: 'onnx-community/Qwen3.5-0.8B-ONNX',
    dtype: { embed_tokens: 'q4', decoder_model_merged: 'q4' },
    hfGgufRepo: 'unsloth/Qwen3.5-0.8B-GGUF',
    hfGgufQuant: 'Q3_K_L',
    ggufFile: 'qwen3-0.6b.gguf',
    desc: 'Qwen 3.5 0.8B multimodal & chat in-browser (~420 MB Q3_K_L / q4)'
  },
  {
    id: 'llama3.2-1b',
    label: 'Llama 3.2 1B',
    badge: 'Browser · ~630 MB',
    kind: 'browser',
    hfId: 'onnx-community/Llama-3.2-1B-Instruct-ONNX',
    dtype: 'q4',
    hfGgufRepo: 'bartowski/Llama-3.2-1B-Instruct-GGUF',
    hfGgufQuant: 'Q3_K_L',
    ggufFile: 'qwen3-0.6b.gguf',
    desc: 'Meta Llama 3.2 1B in-browser (~630 MB Q3_K_L — decent WebGPU recommended)'
  },
  {
    id: 'deepseek-r1-1.5b',
    label: 'DeepSeek R1 1.5B',
    badge: 'Browser · Reasoning',
    kind: 'browser',
    hfId: 'onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX',
    dtype: 'q4',
    hfGgufRepo: 'bartowski/DeepSeek-R1-Distill-Qwen-1.5B-GGUF',
    hfGgufQuant: 'Q3_K_L',
    ggufFile: 'qwen2.5-1.5b.gguf',
    desc: 'DeepSeek R1 reasoning model (~850 MB Q3_K_L — strong WebGPU device required)'
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
  'DISCLAIMER: You might not be able to enjoy local/browser AI smoothly in BiteSizedUtilities if you are on an iPhone below iOS 26, an older phone/tablet, or a device that does not support WebGPU. Roughly 1 in 4 mobile devices lack WebGPU, which can cause browser AI models to crash, fail to load, or run slowly unless you have a capable device. Automatic fallbacks (WebGPU, WLlama, WASM CPU, and local server) are built in — you can adjust models and fallback mode in Settings.';

let cachedDiag = null;

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
  const hasRisk = !hasWebGPU || isOldIOS || (deviceMemoryGB !== null && deviceMemoryGB < 4);

  let summaryLabel = hasWebGPU
    ? `WebGPU Ready${hasF16 ? ' (FP16)' : ''}`
    : 'WebGPU Unavailable — Fallback Mode Active';
  if (isOldIOS) summaryLabel = `iOS ${iosMajor} (< iOS 26) — WebGPU/Memory Risk`;

  cachedDiag = { hasWebGPU, hasF16, adapterName, isIOS, iosMajor, isOldIOS, deviceMemoryGB, cores, hasRisk, summaryLabel };
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

async function getTransformers() {
  const mod = await import('@huggingface/transformers');
  if (mod.env) {
    mod.env.allowLocalModels = false;
    if (mod.env.backends?.onnx?.wasm) {
      const ortBase = resolveAssetUrl('ort/');
      const diag = await detectDeviceDiagnostics().catch(() => ({ hasWebGPU: false, isOldIOS: false }));
      const suffix = diag.isOldIOS && !diag.hasWebGPU ? '' : '.asyncify';
      mod.env.backends.onnx.wasm.wasmPaths = {
        mjs: `${ortBase}ort-wasm-simd-threaded${suffix}.mjs`,
        wasm: `${ortBase}ort-wasm-simd-threaded${suffix}.wasm`
      };
      if (!globalThis.crossOriginIsolated) {
        mod.env.backends.onnx.wasm.numThreads = 1;
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
        const processor = await AutoProcessor.from_pretrained(modelCfg.hfId, { progress_callback });
        const model = await Qwen3_5ForConditionalGeneration.from_pretrained(modelCfg.hfId, {
          device: preferredDevice,
          dtype: { embed_tokens: 'q4', vision_encoder: 'q4', decoder_model_merged: 'q4' },
          progress_callback
        });
        return { kind: 'qwen3_5_vision', processor, tokenizer: processor.tokenizer, model, device: preferredDevice };
      }
      const tokenizer = await AutoTokenizer.from_pretrained(modelCfg.hfId, { progress_callback })
        .catch(async () => {
          const proc = await AutoProcessor.from_pretrained(modelCfg.hfId, { progress_callback });
          return proc.tokenizer || proc;
        });
      const dtypeMap = typeof modelCfg.dtype === 'object'
        ? modelCfg.dtype
        : { embed_tokens: 'q4', decoder_model_merged: 'q4' };
      const model = await Qwen3_5ForCausalLM.from_pretrained(modelCfg.hfId, {
        device: preferredDevice,
        dtype: dtypeMap,
        progress_callback
      });
      return { kind: 'qwen3_5', tokenizer, model, device: preferredDevice };
    }

    const diag = await detectDeviceDiagnostics().catch(() => ({ hasF16: false }));
    const wantF16 = preferredDevice === 'webgpu' && preset.onnxDtype === 'q4f16' && diag.hasF16;
    const dtypeOrder = wantF16
      ? ['q4f16', 'q4', 'int8']
      : ['q4', 'int8', ...(preferredDevice === 'webgpu' && diag.hasF16 ? ['q4f16'] : [])];

    let gen;
    let lastErr;
    for (const dt of dtypeOrder) {
      try {
        gen = await pipeline('text-generation', modelCfg.hfId, {
          device: preferredDevice,
          dtype: dt,
          progress_callback
        });
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (!gen) throw lastErr || new Error(`Failed to load ${modelCfg.label}`);
    return { kind: 'pipeline', gen, device: preferredDevice };
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

async function resolveBestHFGguf(repo, preferredQuants, signal) {
  const res = await fetch(`https://huggingface.co/api/models/${repo}/tree/main?recursive=true`, {
    headers: { Accept: 'application/json' },
    signal
  });
  if (!res.ok) throw new Error(`HF repo lookup failed (${res.status}) for ${repo}`);
  const files = await res.json();
  const candidates = (Array.isArray(files) ? files : []).filter(
    f => f?.type === 'file' && typeof f.path === 'string' && /\.gguf$/i.test(f.path) && !/mmproj/i.test(f.path)
  );
  if (!candidates.length) throw new Error(`No GGUF files found in ${repo}`);
  const firstShard = p => {
    const m = p.match(/^(.+)-(\d{5})-of-(\d{5})\.gguf$/i);
    if (!m) return p;
    const s1 = `${m[1]}-00001-of-${m[3]}.gguf`;
    return candidates.some(c => c.path === s1) ? s1 : p;
  };
  for (const q of preferredQuants) {
    const hits = candidates
      .filter(f => f.path.toUpperCase().includes(q.toUpperCase()))
      .sort((a, b) => (a.size || Infinity) - (b.size || Infinity));
    if (hits.length) return { file: firstShard(hits[0].path), quant: q };
  }
  const smallest = [...candidates].sort((a, b) => (a.size || Infinity) - (b.size || Infinity))[0];
  return { file: firstShard(smallest.path), quant: 'smallest' };
}

export async function streamWllamaChat({
  ggufFile = 'qwen3-0.6b.gguf',
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
  const preset = QUANT_PRESETS.find(q => q.id === getSelectedQuantPreset()) || QUANT_PRESETS[0];
  const quantList = hfQuant && !preset.ggufQuants.includes(hfQuant)
    ? [...preset.ggufQuants, hfQuant]
    : preset.ggufQuants;
  const wasmUrl = resolveAssetUrl('wllama/wllama.wasm');
  const compatJsUrl = resolveAssetUrl('wllama-compat/wllama.js');
  const compatWasmUrl = resolveAssetUrl('wllama-compat/wllama.wasm');
  const ggufUrl = resolveAssetUrl(`api/waffle-ai/gguf/${ggufFile}`);
  const targetKey = `${hfRepo ? `${hfRepo}:${preset.id}` : ggufFile}:${useWebGPU}`;

  const createFreshWllama = async () => {
    await disposeBrowserModels();
    await disposeWllama();
    const inst = new Wllama({ default: wasmUrl }, { suppressNativeLog: true, parallelDownloads: 1 });
    inst.setCompat({ worker: compatJsUrl, wasm: compatWasmUrl }, 'firefox_safari');
    wllamaInstance = inst;
    return inst;
  };

  if (!wllamaInstance || wllamaLoadedFile !== targetKey || !wllamaInstance.isModelLoaded?.()) {
    let activeQuantLabel = quantList[0] || 'GGUF';
    const loadParams = {
      n_ctx: 1024,
      n_batch: 256,
      n_threads: 1,
      n_gpu_layers: useWebGPU ? 99 : 0,
      useCache: true,
      progressCallback({ loaded, total }) {
        if (total > 0) {
          onStatus?.({
            state: 'downloading',
            detail: `Loading ${activeQuantLabel} (${Math.round((loaded / total) * 100)}%)…`
          });
        }
      }
    };

    let loadedOk = false;
    let hfErr = null;
    if (hfRepo) {
      const inst = await createFreshWllama();
      try {
        const picked = await resolveBestHFGguf(hfRepo, quantList, signal);
        activeQuantLabel = picked.quant;
        onStatus?.({
          state: 'loading',
          detail: `Loading ${picked.quant} via WLlama (${useWebGPU ? 'WebGPU' : 'WASM CPU'})…`
        });
        await inst.loadModelFromHF({ repo: hfRepo, file: picked.file }, loadParams);
        wllamaLoadedFile = targetKey;
        loadedOk = true;
      } catch (err) {
        if (err.name === 'AbortError' || signal?.aborted) throw err;
        hfErr = err;
        await disposeWllama();
      }
    }

    if (!loadedOk) {
      let hasLocalGguf = false;
      try {
        const probe = await fetch(ggufUrl, { method: 'HEAD', signal });
        const ct = probe.headers.get('content-type') || '';
        const len = Number(probe.headers.get('content-length') || '0');
        hasLocalGguf = probe.ok && !ct.includes('text/html') && len > 1_000_000;
      } catch {}
      if (!hasLocalGguf) {
        throw hfErr || new Error(`Local GGUF (${ggufFile}) is not cached on this host and HuggingFace GGUF download failed.`);
      }
      const inst = await createFreshWllama();
      onStatus?.({
        state: 'loading',
        detail: `Loading ${ggufFile} via WLlama (${useWebGPU ? 'WebGPU' : 'WASM CPU'})…`
      });
      try {
        await inst.loadModelFromUrl(ggufUrl, loadParams);
        wllamaLoadedFile = targetKey;
      } catch (err) {
        await disposeWllama();
        throw err;
      }
    }
  }

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  onStatus?.({
    state: 'generating',
    detail: `WLlama (${useWebGPU ? 'WebGPU' : 'WASM CPU'})`
  });

  const chat = [];
  if (systemPrompt) chat.push({ role: 'system', content: systemPrompt });
  for (const m of messages.slice(-8)) {
    if (m?.role && typeof m.content === 'string') {
      chat.push({ role: m.role, content: m.content });
    }
  }

  let acc = '';
  const stream = await wllamaInstance.createChatCompletion({
    messages: chat,
    max_tokens: maxTokens,
    temperature,
    stream: true
  });

  for await (const chunk of stream) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const piece = chunk?.choices?.[0]?.delta?.content || '';
    if (piece) {
      acc += piece;
      const cleaned = acc.replace(/<think>[\s\S]*?<\/think>\s*/g, '').replace(/<think>[\s\S]*$/, '');
      onToken?.(piece, cleaned);
    }
  }
  return acc.replace(/<think>[\s\S]*?<\/think>\s*/g, '').replace(/<think>[\s\S]*$/, '').trim();
}
