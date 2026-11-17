export const TEXT_MODELS = [
  {
    id: 'qwen2.5-1.5b',
    label: 'Qwen 2.5 1.5B',
    badge: 'Server · Balanced',
    kind: 'server',
    ggufFile: 'qwen2.5-1.5b.gguf',
    desc: 'Pre-cached on server via llama.cpp (works on all devices, even without WebGPU)'
  },
  {
    id: 'qwen2.5-coder-1.5b',
    label: 'Qwen 2.5 Coder 1.5B',
    badge: 'Server · Coding',
    kind: 'server',
    ggufFile: 'qwen2.5-1.5b.gguf',
    desc: 'Pre-cached Qwen 2.5 Coder 1.5B on server via llama.cpp'
  },
  {
    id: 'qwen3-0.6b',
    label: 'Qwen 3 0.6B',
    badge: 'Server · Light 462 MB',
    kind: 'server',
    ggufFile: 'qwen3-0.6b.gguf',
    desc: 'Fast, lightweight 462 MB GGUF model via llama.cpp or WLlama'
  },
  {
    id: 'llama3.2-1b',
    label: 'Llama 3.2 1B',
    badge: 'Browser · WebGPU / WASM',
    kind: 'browser',
    hfId: 'onnx-community/Llama-3.2-1B-Instruct-ONNX',
    dtype: 'q4f16',
    ggufFile: 'qwen3-0.6b.gguf',
    desc: 'Meta Llama 3.2 1B in-browser (~750 MB, requires decent device / WebGPU)'
  },
  {
    id: 'qwen3.5-0.8b',
    label: 'Qwen 3.5 0.8B',
    badge: 'Browser · Compact',
    kind: 'browser',
    loader: 'qwen3_5',
    hfId: 'onnx-community/Qwen3.5-0.8B-ONNX',
    dtype: { embed_tokens: 'q4', decoder_model_merged: 'q4' },
    ggufFile: 'qwen3-0.6b.gguf',
    desc: 'Qwen 3.5 0.8B in-browser (~550 MB, auto-falls back if WebGPU missing)'
  },
  {
    id: 'smollm2-360m',
    label: 'SmolLM2 360M',
    badge: 'Browser · Ultra-Fast',
    kind: 'browser',
    hfId: 'HuggingFaceTB/SmolLM2-360M-Instruct',
    dtype: 'q4',
    ggufFile: 'qwen3-0.6b.gguf',
    desc: 'Compact in-browser WebGPU/WASM model (~250 MB)'
  },
  {
    id: 'qwen2.5-0.5b',
    label: 'Qwen 2.5 0.5B',
    badge: 'Browser · Light',
    kind: 'browser',
    hfId: 'onnx-community/Qwen2.5-0.5B-Instruct',
    dtype: 'q4',
    ggufFile: 'qwen3-0.6b.gguf',
    desc: 'Nimble multilingual model in-browser (~400 MB)'
  },
  {
    id: 'deepseek-r1-1.5b',
    label: 'DeepSeek R1 1.5B',
    badge: 'Browser · Heavy',
    kind: 'browser',
    hfId: 'onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX',
    dtype: 'q4f16',
    ggufFile: 'qwen2.5-1.5b.gguf',
    desc: 'DeepSeek R1 reasoning model (~1.1 GB — strong WebGPU device required)'
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

async function getTransformers() {
  const mod = await import('@huggingface/transformers');
  if (mod.env) {
    mod.env.allowLocalModels = false;
    if (mod.env.backends?.onnx?.wasm) {
      mod.env.backends.onnx.wasm.wasmPaths = new URL('./ort/', window.location.href).href;
    }
  }
  return mod;
}

async function getBrowserGenerator(modelCfg, preferredDevice, onStatus) {
  const cacheKey = `${modelCfg.id}:${preferredDevice}`;
  if (pipeCache.has(cacheKey)) return pipeCache.get(cacheKey);
  const promise = (async () => {
    const mod = await getTransformers();
    const { pipeline, AutoTokenizer, Qwen3_5ForCausalLM } = mod;
    onStatus?.({ state: 'loading', detail: `Loading ${modelCfg.label} (${preferredDevice.toUpperCase()})…` });

    const progress_callback = p => {
      if (p?.status === 'progress' && typeof p.progress === 'number') {
        onStatus?.({
          state: 'downloading',
          detail: `Downloading ${modelCfg.label}: ${Math.round(p.progress)}%`
        });
      }
    };

    if (modelCfg.loader === 'qwen3_5') {
      const tokenizer = await AutoTokenizer.from_pretrained(modelCfg.hfId, { progress_callback })
        .catch(async () => {
          const proc = await mod.AutoProcessor.from_pretrained(modelCfg.hfId, { progress_callback });
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

    const wantedDtype = preferredDevice === 'webgpu' ? (modelCfg.dtype || 'q4f16') : 'q4';
    let gen;
    try {
      gen = await pipeline('text-generation', modelCfg.hfId, {
        device: preferredDevice,
        dtype: wantedDtype,
        progress_callback
      });
    } catch (err) {
      if (wantedDtype !== 'q4') {
        gen = await pipeline('text-generation', modelCfg.hfId, {
          device: preferredDevice,
          dtype: 'q4',
          progress_callback
        });
      } else {
        throw err;
      }
    }
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
  systemPrompt,
  maxTokens = 520,
  temperature = 0.7,
  preferredDevice,
  signal,
  onStatus,
  onToken
}) {
  const cfg = TEXT_MODELS.find(m => m.id === modelId);
  if (!cfg || cfg.kind !== 'browser') throw new Error(`Unknown browser model: ${modelId}`);

  const diag = await detectDeviceDiagnostics();
  const device = preferredDevice || (diag.hasWebGPU ? 'webgpu' : 'wasm');
  const loaded = await getBrowserGenerator(cfg, device, onStatus);
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const { TextStreamer } = await getTransformers();
  onStatus?.({ state: 'generating', detail: `${cfg.label} · ${loaded.device.toUpperCase()}` });

  const chat = [];
  if (systemPrompt) chat.push({ role: 'system', content: systemPrompt });
  for (const m of messages.slice(-8)) {
    if (m?.role && typeof m.content === 'string') {
      chat.push({ role: m.role, content: m.content });
    }
  }

  let acc = '';
  const tokenizer = loaded.kind === 'qwen3_5' ? loaded.tokenizer : loaded.gen.tokenizer;
  const streamer = new TextStreamer(tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function(text) {
      if (signal?.aborted) return;
      acc += text;
      onToken?.(text, acc);
    }
  });

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
    onToken?.(text, acc);
  }
  return acc.trim();
}

export async function streamWllamaChat({
  ggufFile = 'qwen3-0.6b.gguf',
  messages,
  systemPrompt,
  maxTokens = 480,
  temperature = 0.7,
  useWebGPU = false,
  signal,
  onStatus,
  onToken
}) {
  const { Wllama } = await import('@wllama/wllama');
  const wasmUrl = new URL('./wllama/wllama.wasm', window.location.href).href;
  const ggufUrl = new URL(`./api/waffle-ai/gguf/${ggufFile}`, window.location.href).href;

  if (!wllamaInstance) {
    wllamaInstance = new Wllama({ default: wasmUrl }, { suppressNativeLog: true });
  }

  if (wllamaLoadedFile !== `${ggufFile}:${useWebGPU}`) {
    onStatus?.({
      state: 'loading',
      detail: `Loading ${ggufFile} via WLlama (${useWebGPU ? 'WebGPU' : 'WASM CPU'})…`
    });
    await wllamaInstance.loadModelFromUrl(ggufUrl, {
      n_ctx: 2048,
      n_gpu_layers: useWebGPU ? 99 : 0,
      progressCallback({ loaded, total }) {
        if (total > 0) {
          onStatus?.({
            state: 'downloading',
            detail: `Loading WLlama (${Math.round((loaded / total) * 100)}%)…`
          });
        }
      }
    });
    wllamaLoadedFile = `${ggufFile}:${useWebGPU}`;
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
      onToken?.(piece, acc);
    }
  }
  return acc.trim();
}
