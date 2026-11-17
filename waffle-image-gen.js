const SD_CACHE = 'waffle-sd-models-v1';
const BASE_URL = './api/waffle-ai/sd-models/';

export const IMAGE_MODELS = [
  {
    id: 'sdxs-512',
    name: 'SDXS-512 (1-Step)',
    badge: 'Fast · WebGPU / WASM',
    sizeLabel: '~675 MB (cached locally)',
    requiresWebGPU: false,
    defaultSteps: 1
  },
  {
    id: 'sd-turbo',
    name: 'SD-Turbo (Stability AI)',
    badge: 'High Quality · WebGPU',
    sizeLabel: '~2.5 GB (cached locally)',
    requiresWebGPU: true,
    defaultSteps: 2
  }
];

const SD_PARTS = {
  te09: {
    type: 'qonly',
    gq: 'studio-ai-hq3/t2i09/te09/gq.onnx',
    size: 340696064,
    bytes: 342499710,
    chunks: [
      ...Array.from({ length: 13 }, (_, i) => `studio-ai/t2i09/te09/q.${String(i).padStart(3, '0')}`),
      ...Array.from({ length: 9 }, (_, i) => `studio-ai-hq3/t2i09/te09/q.${String(i + 13).padStart(3, '0')}`)
    ]
  },
  unet09: {
    type: 'qonly',
    gq: 'studio-ai-hq3/t2i09/unet09/gq.onnx',
    size: 328385280,
    bytes: 329971879,
    chunks: [
      ...Array.from({ length: 4 }, (_, i) => `studio-ai-hq3/t2i09/unet09/q.${String(i).padStart(3, '0')}`),
      ...Array.from({ length: 5 }, (_, i) => `studio-ai-t2i/t2i09/unet09/q.${String(i + 4).padStart(3, '0')}`),
      ...Array.from({ length: 5 }, (_, i) => `studio-ai-hq2/t2i09/unet09/q.${String(i + 9).padStart(3, '0')}`),
      ...Array.from({ length: 4 }, (_, i) => `studio-ai-m3/t2i09/unet09/q.${String(i + 14).padStart(3, '0')}`),
      ...Array.from({ length: 3 }, (_, i) => `studio-ai-m4/t2i09/unet09/q.${String(i + 18).padStart(3, '0')}`)
    ]
  },
  vae_decoder: {
    type: 'fp16',
    g16: 'studio-ai-t2i/models/vae_decoder/g16.onnx',
    g32: 'studio-ai-t2i/models/vae_decoder/g32.onnx',
    segs: 'studio-ai-t2i/models/vae_decoder/segs.json',
    size16: 2445056,
    bytes: 2482882,
    chunks: ['studio-ai-t2i/models/vae_decoder/w.000']
  },
  hq_text_encoder: {
    type: 'raw',
    bytes: 681393168,
    chunks: Array.from({ length: 15 }, (_, i) => `studio-ai-hq3/text_encoder/m.${String(i).padStart(3, '0')}`)
  },
  hq_unet: {
    type: 'raw',
    bytes: 1733430199,
    chunks: [
      ...Array.from({ length: 20 }, (_, i) => `studio-ai-hq1/unet/m.${String(i).padStart(3, '0')}`),
      ...Array.from({ length: 17 }, (_, i) => `studio-ai-hq2/unet/m.${String(i + 20).padStart(3, '0')}`)
    ]
  },
  hq_vae_decoder: {
    type: 'raw',
    bytes: 99094314,
    chunks: Array.from({ length: 3 }, (_, i) => `studio-ai-hq2/vae_decoder/m.${String(i).padStart(3, '0')}`)
  }
};

const ACP = (() => {
  const a = new Float64Array(1000);
  let c = 1;
  for (let i = 0; i < 1000; i++) {
    const b = (Math.sqrt(0.00085) + (Math.sqrt(0.012) - Math.sqrt(0.00085)) * i / 999) ** 2;
    c *= 1 - b;
    a[i] = c;
  }
  return a;
})();

function makeRng(seed) {
  let s = seed >>> 0;
  const u = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => {
    let a = u();
    while (a <= 1e-12) a = u();
    return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * u());
  };
}

let f16TableCache = null;
function f16Table() {
  if (f16TableCache) return f16TableCache;
  f16TableCache = new Float32Array(65536);
  for (let h = 0; h < 65536; h++) {
    const s = (h & 0x8000) ? -1 : 1;
    const e = (h >> 10) & 31;
    const f = h & 1023;
    f16TableCache[h] = e === 0
      ? s * f * 2 ** -24
      : e === 31
        ? (f ? NaN : s * Infinity)
        : s * (1 + f / 1024) * 2 ** (e - 15);
  }
  return f16TableCache;
}

function expandFp16ToFp32(w16, segs) {
  const T = f16Table();
  const out = new Uint8Array(segs.size32);
  for (const [a, n, b, is16] of segs.segs) {
    if (is16) {
      const src = new Uint16Array(w16.buffer, w16.byteOffset + a, n / 2);
      const dst = new Float32Array(out.buffer, b, n / 2);
      for (let i = 0; i < src.length; i++) dst[i] = T[src[i]];
    } else {
      out.set(w16.subarray(a, a + n), b);
    }
  }
  return out;
}

let tokPromise = null;
function bytesToUnicode() {
  const bs = [];
  for (let i = 33; i <= 126; i++) bs.push(i);
  for (let i = 161; i <= 172; i++) bs.push(i);
  for (let i = 174; i <= 255; i++) bs.push(i);
  const cs = [...bs];
  let n = 0;
  for (let b = 0; b < 256; b++) {
    if (!bs.includes(b)) { bs.push(b); cs.push(256 + n); n++; }
  }
  const m = {};
  bs.forEach((b, i) => { m[b] = String.fromCharCode(cs[i]); });
  return m;
}

async function loadClipTokenizer() {
  if (tokPromise) return tokPromise;
  tokPromise = (async () => {
    const [vocab, merges] = await Promise.all([
      fetch(`${BASE_URL}studio-ai/models/tok/vocab.json`).then(r => {
        if (!r.ok) throw new Error(`Tokenizer vocab HTTP ${r.status}`);
        return r.json();
      }),
      fetch(`${BASE_URL}studio-ai/models/tok/merges.txt`).then(r => {
        if (!r.ok) throw new Error(`Tokenizer merges HTTP ${r.status}`);
        return r.text();
      })
    ]);
    const ranks = new Map();
    merges.split('\n').slice(1).filter(l => l.trim()).forEach((l, i) => ranks.set(l, i));
    return { vocab, ranks, b2u: bytesToUnicode(), cache: new Map() };
  })();
  return tokPromise;
}

function bpe(T, token) {
  if (T.cache.has(token)) return T.cache.get(token);
  let word = [...token.slice(0, -1), token.slice(-1) + '</w>'];
  if (word.length === 1) return [token + '</w>'];
  for (;;) {
    let best = null;
    let br = Infinity;
    for (let i = 0; i < word.length - 1; i++) {
      const r = T.ranks.get(`${word[i]} ${word[i + 1]}`);
      if (r !== undefined && r < br) { br = r; best = i; }
    }
    if (best === null) break;
    const a = word[best];
    const b = word[best + 1];
    const nw = [];
    for (let i = 0; i < word.length;) {
      if (i < word.length - 1 && word[i] === a && word[i + 1] === b) { nw.push(a + b); i += 2; }
      else { nw.push(word[i]); i++; }
    }
    word = nw;
    if (word.length === 1) break;
  }
  T.cache.set(token, word);
  return word;
}

const CLIP_PAT = /<\|startoftext\|>|<\|endoftext\|>|'s|'t|'re|'ve|'m|'ll|'d|[\p{L}]+|[\p{N}]|[^\s\p{L}\p{N}]+/gu;
function encodeClipPrompt(T, text, pad = 49407, len = 77) {
  const clean = String(text || '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
  const ids = [49406];
  const enc = new TextEncoder();
  for (const m of clean.matchAll(CLIP_PAT)) {
    const tok = [...enc.encode(m[0])].map(b => T.b2u[b]).join('');
    for (const p of bpe(T, tok)) {
      const id = T.vocab[p];
      if (id !== undefined) ids.push(id);
    }
  }
  const out = ids.slice(0, len - 1);
  out.push(49407);
  while (out.length < len) out.push(pad);
  return out;
}

let ortState = null;
export async function detectImageCapabilities() {
  let hasWebGPU = false;
  let hasF16 = false;
  if (typeof navigator !== 'undefined' && navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        hasWebGPU = true;
        hasF16 = adapter.features?.has('shader-f16') || false;
      }
    } catch {}
  }
  return { hasWebGPU, hasF16 };
}

async function getOrt(preferWebGPU = true) {
  if (ortState && (!preferWebGPU || ortState.backend === 'webgpu')) return ortState;
  const caps = await detectImageCapabilities();
  const useGpu = preferWebGPU && caps.hasWebGPU;
  const ort = useGpu
    ? await import('onnxruntime-web/webgpu')
    : await import('onnxruntime-web/wasm');
  ort.env.wasm.wasmPaths = new URL('ort/', typeof document !== 'undefined' && document.baseURI ? document.baseURI : window.location.href).href;
  ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
  ort.env.logLevel = 'error';
  ortState = { ort, backend: useGpu ? 'webgpu' : 'wasm', hasF16: caps.hasF16 };
  return ortState;
}

async function fetchCachedBytes(relPath, onBytes, signal) {
  const url = new URL(`${BASE_URL}${relPath}`, window.location.href).href;
  const hasCache = typeof caches !== 'undefined';
  const cache = hasCache ? await caches.open(SD_CACHE) : null;
  if (cache) {
    const hit = await cache.match(url);
    if (hit) {
      const buf = new Uint8Array(await hit.arrayBuffer());
      onBytes?.(buf.length, true);
      return buf;
    }
  }

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Model file HTTP ${res.status}: ${relPath}`);
  const len = Number(res.headers.get('content-length') || 0);
  const rd = res.body.getReader();
  let out = new Uint8Array(len || (1 << 20));
  let got = 0;
  for (;;) {
    if (signal?.aborted) {
      try { await rd.cancel(); } catch {}
      throw new DOMException('Aborted', 'AbortError');
    }
    const { done, value } = await rd.read();
    if (done) break;
    if (got + value.length > out.length) {
      const next = new Uint8Array(Math.max(out.length * 2, got + value.length));
      next.set(out.subarray(0, got));
      out = next;
    }
    out.set(value, got);
    got += value.length;
    onBytes?.(value.length, false);
  }
  const bytes = got === out.length ? out : out.slice(0, got);
  if (cache) {
    await cache.put(url, new Response(bytes, { headers: { 'content-type': 'application/octet-stream' } })).catch(() => {});
  }
  return bytes;
}

async function loadPartInto(paths, totalSize, onProgress, stageLabel, signal) {
  const buf = new Uint8Array(totalSize);
  let offset = 0;
  let loadedBytes = 0;
  for (const rel of paths) {
    const chunk = await fetchCachedBytes(rel, n => {
      loadedBytes += n;
      onProgress?.({
        stage: stageLabel,
        percent: Math.min(99, Math.round((loadedBytes / Math.max(1, totalSize)) * 100)),
        detail: `${Math.round(loadedBytes / 1048576)} / ${Math.round(totalSize / 1048576)} MB`
      });
    }, signal);
    buf.set(chunk, offset);
    offset += chunk.length;
  }
  return buf;
}

async function createPartSession(partId, { ort, backend, hasF16 }, onProgress, signal) {
  const part = SD_PARTS[partId];
  const label = `Loading ${partId}…`;
  if (part.type === 'raw') {
    const buf = await loadPartInto(part.chunks, part.bytes, onProgress, label, signal);
    return ort.InferenceSession.create(buf, {
      logSeverityLevel: 3,
      executionProviders: ['webgpu'],
      graphOptimizationLevel: 'all'
    });
  }
  if (part.type === 'qonly') {
    const [graph, weights] = await Promise.all([
      fetchCachedBytes(part.gq, null, signal),
      loadPartInto(part.chunks, part.size, onProgress, label, signal)
    ]);
    return ort.InferenceSession.create(graph, {
      logSeverityLevel: 3,
      executionProviders: ['wasm'],
      externalData: [{ path: 'q.bin', data: weights }],
      graphOptimizationLevel: 'disabled',
      enableCpuMemArena: false,
      enableMemPattern: false
    });
  }
  const w16 = await loadPartInto(part.chunks, part.size16, onProgress, label, signal);
  if (backend === 'webgpu' && hasF16) {
    try {
      const g16 = await fetchCachedBytes(part.g16, null, signal);
      return await ort.InferenceSession.create(g16, {
        logSeverityLevel: 3,
        executionProviders: ['webgpu'],
        externalData: [{ path: 'w.bin', data: w16 }],
        graphOptimizationLevel: 'all'
      });
    } catch {}
  }
  const [segsBytes, g32] = await Promise.all([
    fetchCachedBytes(part.segs, null, signal),
    fetchCachedBytes(part.g32, null, signal)
  ]);
  const segs = JSON.parse(new TextDecoder().decode(segsBytes));
  const w32 = expandFp16ToFp32(w16, segs);
  return ort.InferenceSession.create(g32, {
    logSeverityLevel: 3,
    executionProviders: [backend === 'webgpu' ? 'webgpu' : 'wasm'],
    externalData: [{ path: 'w32.bin', data: w32 }],
    graphOptimizationLevel: 'all'
  });
}

async function runSingle(partId, inputs, ortCtx, onProgress, signal) {
  const sess = await createPartSession(partId, ortCtx, onProgress, signal);
  try {
    const feeds = {};
    inputs.forEach((inp, i) => {
      feeds[sess.inputNames[i]] = new ortCtx.ort.Tensor(inp.type, inp.data, inp.dims);
    });
    const out = await sess.run(feeds);
    const first = out[sess.outputNames[0]];
    return { type: first.type, data: first.data, dims: first.dims };
  } finally {
    await sess.release?.().catch?.(() => {});
  }
}

export async function generateWaffleImage({
  model = 'sdxs-512',
  prompt,
  seed,
  steps,
  size = 512,
  onProgress,
  signal
}) {
  const t0 = performance.now();
  const useHQ = model === 'sd-turbo';
  const ortCtx = await getOrt(true);

  if (useHQ && ortCtx.backend !== 'webgpu') {
    throw new Error('SD-Turbo requires WebGPU in this browser. Switch to SDXS-512 (Fast 1-Step), which works on any browser!');
  }

  const finalSize = Math.max(256, Math.min(512, Math.round(size / 64) * 64));
  const L = finalSize / 8;
  const usedSeed = Number.isFinite(seed) ? seed : Math.floor(Math.random() * 2 ** 31);
  const randn = makeRng(usedSeed);
  const mkNoise = () => {
    const n = new Float32Array(4 * L * L);
    for (let i = 0; i < n.length; i++) n[i] = randn();
    return n;
  };

  onProgress?.({ stage: 'Tokenizing prompt…', percent: 5, detail: prompt });
  const tok = await loadClipTokenizer();
  const ids = encodeClipPrompt(tok, prompt || 'a cozy golden waffle in a sunny kitchen', useHQ ? 0 : 49407);

  // 1. Text Encoder
  const tePart = useHQ ? 'hq_text_encoder' : 'te09';
  const teIn = useHQ
    ? { type: 'int32', data: Int32Array.from(ids), dims: [1, 77] }
    : { type: 'int64', data: BigInt64Array.from(ids.map(BigInt)), dims: [1, 77] };
  const hiddenOut = await runSingle(tePart, [teIn], ortCtx, p => {
    onProgress?.({ stage: '1/3 · Text Encoder', percent: Math.round(5 + p.percent * 0.25), detail: p.detail });
  }, signal);
  const hidden = { type: hiddenOut.type, data: hiddenOut.data, dims: hiddenOut.dims };

  // 2. UNet Denoising
  let x0 = null;
  const totalSteps = useHQ ? Math.max(1, Math.min(4, Number(steps) || 2)) : 1;

  if (!useHQ) {
    const t1 = 999;
    const aa = ACP[t1];
    const k = Math.sqrt(1 - aa);
    const xt = mkNoise().map(q => q * k);
    onProgress?.({ stage: '2/3 · UNet Denoising (1 step)', percent: 35, detail: 'Running SDXS-512…' });
    const epsOut = await runSingle('unet09', [
      { type: 'float32', data: xt, dims: [1, 4, L, L] },
      { type: 'int64', data: BigInt64Array.from([BigInt(t1)]), dims: [1] },
      hidden
    ], ortCtx, p => {
      onProgress?.({ stage: '2/3 · UNet Denoising', percent: Math.round(35 + p.percent * 0.45), detail: p.detail });
    }, signal);
    const eps = Float32Array.from(epsOut.data);
    x0 = xt.map((q, i) => (q - Math.sqrt(1 - aa) * eps[i]) / Math.sqrt(aa));
  } else {
    const unetSess = await createPartSession('hq_unet', ortCtx, p => {
      onProgress?.({ stage: '2/3 · Loading SD-Turbo UNet', percent: Math.round(30 + p.percent * 0.45), detail: p.detail });
    }, signal);
    try {
      const ts = Array.from({ length: totalSteps }, (_, k) => Math.round(999 - (k * 999) / totalSteps));
      for (let k = 0; k < ts.length; k++) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const t = ts[k];
        const aa = ACP[t];
        const nz = mkNoise();
        const xt = x0 ? x0.map((q, i) => Math.sqrt(aa) * q + Math.sqrt(1 - aa) * nz[i]) : nz;
        onProgress?.({ stage: `2/3 · SD-Turbo Step ${k + 1}/${ts.length}`, percent: Math.round(75 + (k / ts.length) * 12), detail: `t=${t}` });
        const feeds = {
          [unetSess.inputNames[0]]: new ortCtx.ort.Tensor('float32', xt, [1, 4, L, L]),
          [unetSess.inputNames[1]]: new ortCtx.ort.Tensor('int64', BigInt64Array.from([BigInt(t)]), [1]),
          [unetSess.inputNames[2]]: new ortCtx.ort.Tensor(hidden.type, hidden.data, hidden.dims)
        };
        const out = await unetSess.run(feeds);
        const eps = Float32Array.from(out[unetSess.outputNames[0]].data);
        x0 = xt.map((q, i) => (q - Math.sqrt(1 - aa) * eps[i]) / Math.sqrt(aa));
      }
    } finally {
      await unetSess.release?.().catch?.(() => {});
    }
  }

  // 3. VAE Decoder
  onProgress?.({ stage: '3/3 · Decoding Pixels', percent: 90, detail: 'Rendering 512×512 PNG…' });
  const latents = useHQ ? x0.map(v => v / 0.18215) : x0;
  const vaeOut = await runSingle(useHQ ? 'hq_vae_decoder' : 'vae_decoder', [
    { type: 'float32', data: latents, dims: [1, 4, L, L] }
  ], ortCtx, p => {
    onProgress?.({ stage: '3/3 · VAE Decoder', percent: Math.round(90 + p.percent * 0.09), detail: p.detail });
  }, signal);

  const W = vaeOut.dims[3];
  const H = vaeOut.dims[2];
  const y = vaeOut.data;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(W, H);
  const n = W * H;
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      imgData.data[i * 4 + k] = Math.max(0, Math.min(255, Math.round((y[k * n + i] + 1) * 127.5)));
    }
    imgData.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  onProgress?.({ stage: 'Done!', percent: 100, detail: '' });
  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: W,
    height: H,
    seed: usedSeed,
    steps: totalSteps,
    model,
    backend: ortCtx.backend,
    timeMs: Math.round(performance.now() - t0)
  };
}
