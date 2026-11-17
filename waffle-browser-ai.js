export const TEXT_MODELS = [
  {
    id: 'qwen2.5-1.5b',
    label: 'Qwen 2.5 1.5B',
    badge: 'Local Server · Instant',
    kind: 'server',
    desc: 'Pre-cached on server via node-llama.cpp'
  },
  {
    id: 'smollm2-360m',
    label: 'SmolLM2 360M',
    badge: 'Browser · Ultra-Fast',
    kind: 'browser',
    hfId: 'HuggingFaceTB/SmolLM2-360M-Instruct',
    dtype: 'q4',
    desc: 'Compact in-browser WebGPU/WASM model (~250 MB)'
  },
  {
    id: 'qwen2.5-0.5b',
    label: 'Qwen 2.5 0.5B',
    badge: 'Browser · Light',
    kind: 'browser',
    hfId: 'onnx-community/Qwen2.5-0.5B-Instruct',
    dtype: 'q4',
    desc: 'Nimble multilingual model in-browser (~400 MB)'
  },
  {
    id: 'qwen3-0.6b',
    label: 'Qwen 3 0.6B',
    badge: 'Browser · Smart',
    kind: 'browser',
    hfId: 'onnx-community/Qwen3-0.6B-ONNX',
    dtype: 'q4f16',
    desc: 'Next-gen Qwen 3 reasoning model in-browser (~450 MB)'
  },
  {
    id: 'llama3.2-1b',
    label: 'Llama 3.2 1B',
    badge: 'Browser · WebGPU',
    kind: 'browser',
    hfId: 'onnx-community/Llama-3.2-1B-Instruct-ONNX',
    dtype: 'q4f16',
    desc: 'Meta Llama 3.2 1B running in-browser (~750 MB)'
  },
  {
    id: 'deepseek-r1-1.5b',
    label: 'DeepSeek R1 1.5B',
    badge: 'Browser · Reasoning',
    kind: 'browser',
    hfId: 'onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX',
    dtype: 'q4f16',
    desc: 'DeepSeek R1 distilled reasoning model (~1.1 GB)'
  }
];

const pipeCache = new Map();

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

async function getBrowserGenerator(modelCfg, onStatus) {
  if (pipeCache.has(modelCfg.id)) return pipeCache.get(modelCfg.id);
  const promise = (async () => {
    const { pipeline } = await getTransformers();
    let device = 'wasm';
    if (typeof navigator !== 'undefined' && navigator.gpu) {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) device = 'webgpu';
      } catch {}
    }
    onStatus?.({ state: 'loading', detail: `Loading ${modelCfg.label} (${device.toUpperCase()})…` });
    const gen = await pipeline('text-generation', modelCfg.hfId, {
      device,
      dtype: device === 'webgpu' ? (modelCfg.dtype || 'q4f16') : 'q4',
      progress_callback(p) {
        if (p?.status === 'progress' && typeof p.progress === 'number') {
          onStatus?.({
            state: 'downloading',
            detail: `Downloading ${modelCfg.label}: ${Math.round(p.progress)}%`
          });
        }
      }
    });
    return { gen, device };
  })();
  pipeCache.set(modelCfg.id, promise);
  try {
    return await promise;
  } catch (err) {
    pipeCache.delete(modelCfg.id);
    throw err;
  }
}

export async function streamBrowserChat({
  modelId,
  messages,
  systemPrompt,
  maxTokens = 520,
  temperature = 0.7,
  signal,
  onStatus,
  onToken
}) {
  const cfg = TEXT_MODELS.find(m => m.id === modelId);
  if (!cfg || cfg.kind !== 'browser') throw new Error(`Unknown browser model: ${modelId}`);

  const { gen, device } = await getBrowserGenerator(cfg, onStatus);
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const { TextStreamer } = await getTransformers();
  onStatus?.({ state: 'generating', detail: `${cfg.label} · ${device.toUpperCase()}` });

  const chat = [];
  if (systemPrompt) chat.push({ role: 'system', content: systemPrompt });
  for (const m of messages.slice(-8)) {
    if (m?.role && typeof m.content === 'string') {
      chat.push({ role: m.role, content: m.content });
    }
  }

  let acc = '';
  const streamer = new TextStreamer(gen.tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function(text) {
      if (signal?.aborted) return;
      acc += text;
      onToken?.(text, acc);
    }
  });

  const out = await gen(chat, {
    max_new_tokens: maxTokens,
    temperature: Math.max(0.1, temperature),
    do_sample: temperature > 0.15,
    streamer
  });

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const generated = out?.[0]?.generated_text;
  const last = Array.isArray(generated) ? generated[generated.length - 1]?.content : '';
  return (acc || last || '').trim();
}
