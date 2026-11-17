import fs from 'node:fs';
import path from 'node:path';

export const WAFFLE_MODEL_PATH = process.env.WAFFLE_AI_MODEL_PATH || path.resolve('.cache/waffle-ai/qwen2.5-1.5b.gguf');

export const SERVER_MODELS = {
  'qwen2.5-1.5b': {
    id: 'qwen2.5-1.5b',
    label: 'Qwen 2.5 1.5B',
    path: WAFFLE_MODEL_PATH
  },
  'qwen2.5-coder-1.5b': {
    id: 'qwen2.5-coder-1.5b',
    label: 'Qwen 2.5 Coder 1.5B',
    path: WAFFLE_MODEL_PATH
  },
  'qwen3-0.6b': {
    id: 'qwen3-0.6b',
    label: 'Qwen 3 0.6B',
    path: path.resolve('.cache/waffle-ai/qwen3-0.6b.gguf')
  }
};

export const WAFFLE_SYSTEM_PROMPT = [
  'You are Sir Waffle, the cheerful, warm-hearted 2.5D waffle mascot of BiteSizedUtilities.',
  'Always respond in English unless the user explicitly asks you to write in another language.',
  'Speak with cozy kitchen charm (occasional maple syrup, butter, or crispy waffle puns are welcome, but keep answers clear, accurate, and well-formatted in Markdown).',
  'Never say "As an AI language model" — stay in character as Sir Waffle.',
  'You live in the BiteSizedUtilities kitchen, which has 6 utility cupboards (85 tools: Math & Numbers, Coding & Developing, Text & Files, Art & Coloring, Science & Physics, and English & Languages) plus a 45-game arcade (including Fancade hit Roper!).',
  'When writing code, always use standard fenced code blocks with the language name (like ```python).',
  'When the user asks you to make, create, or generate a downloadable file (such as .docx, .md, .txt, .csv, .json, .html, .py, .js), wrap the full file contents inside a fenced block whose tag is file:filename.ext (for example ```file:waffle-guide.docx with clean Markdown headings/lists/paragraphs inside, or ```file:hello.py).',
  'Users can also attach/upload .docx, .txt, .md, .csv, and code files for you to read, summarize, translate, edit, or turn into new files.'
].join(' ');

let llamaInstance = null;
let modelInstance = null;
let contextInstance = null;
let sessionInstance = null;
let activeModelId = 'qwen2.5-1.5b';
let loadPromise = null;
let loadingModelId = null;
let loadError = null;
let chatQueue = Promise.resolve();

function resolveModel(modelId) {
  return SERVER_MODELS[modelId] || SERVER_MODELS['qwen2.5-1.5b'];
}

function getModelStats(modelId = activeModelId) {
  const cfg = resolveModel(modelId);
  try {
    const st = fs.statSync(cfg.path);
    return { exists: st.isFile() && st.size > 100_000_000, sizeBytes: st.size, cfg };
  } catch {
    return { exists: false, sizeBytes: 0, cfg };
  }
}

export function getWaffleStatus(modelId = activeModelId) {
  const stats = getModelStats(modelId);
  const available = Object.values(SERVER_MODELS)
    .filter(m => m.id !== 'qwen2.5-coder-1.5b')
    .map(m => {
      const s = getModelStats(m.id);
      return { id: m.id, label: m.label, preCached: s.exists, sizeBytes: s.sizeBytes };
    });
  return {
    ok: stats.exists && !loadError,
    preCached: stats.exists,
    loaded: Boolean(sessionInstance && activeModelId === stats.cfg.id),
    loading: Boolean(loadPromise && !sessionInstance),
    engine: 'node-llama.cpp',
    model: stats.cfg.label,
    modelId: stats.cfg.id,
    modelFile: path.basename(stats.cfg.path),
    sizeBytes: stats.sizeBytes,
    available,
    error: loadError ? String(loadError.message || loadError) : null
  };
}

async function disposeActiveModel() {
  const s = sessionInstance;
  const c = contextInstance;
  const m = modelInstance;
  sessionInstance = null;
  contextInstance = null;
  modelInstance = null;
  loadPromise = null;
  loadingModelId = null;
  try { await s?.dispose?.(); } catch {}
  try { await c?.dispose?.(); } catch {}
  try { await m?.dispose?.(); } catch {}
}

export async function ensureWaffleSession(requestedModelId = activeModelId) {
  const cfg = resolveModel(requestedModelId);
  const samePath = modelInstance && resolveModel(activeModelId).path === cfg.path;
  if (sessionInstance && (activeModelId === cfg.id || samePath)) {
    activeModelId = cfg.id;
    return sessionInstance;
  }
  if (loadPromise && loadingModelId === cfg.id) return loadPromise;

  if (sessionInstance || loadPromise) {
    await disposeActiveModel();
  }

  loadingModelId = cfg.id;
  loadPromise = (async () => {
    loadError = null;
    const stats = getModelStats(cfg.id);
    if (!stats.exists) {
      throw new Error(`Pre-cached ${cfg.label} GGUF model not found at ${cfg.path}`);
    }
    const { getLlama, LlamaChatSession } = await import('node-llama-cpp');
    if (!llamaInstance) llamaInstance = await getLlama();
    modelInstance = await llamaInstance.loadModel({ modelPath: cfg.path });
    contextInstance = await modelInstance.createContext({ contextSize: 3072, threads: 2 });
    sessionInstance = new LlamaChatSession({
      contextSequence: contextInstance.getSequence(),
      systemPrompt: WAFFLE_SYSTEM_PROMPT
    });
    activeModelId = cfg.id;
    loadingModelId = null;
    return sessionInstance;
  })().catch(err => {
    loadError = err;
    loadPromise = null;
    loadingModelId = null;
    throw err;
  });

  return loadPromise;
}

export function scheduleWaffleWarmup(delayMs = 1500) {
  const timer = setTimeout(() => {
    ensureWaffleSession('qwen2.5-1.5b').catch(err => {
      console.warn('[Waffle AI] Background warmup skipped:', err.message);
    });
  }, delayMs);
  timer.unref?.();
}

export async function disposeWaffleAI() {
  await disposeActiveModel();
  const l = llamaInstance;
  llamaInstance = null;
  try { await l?.dispose?.(); } catch {}
}

function buildChatHistory(messages, customSystemPrompt) {
  const cleaned = (Array.isArray(messages) ? messages : [])
    .filter(m => m && typeof m.content === 'string' && m.content.trim())
    .slice(-12);

  let lastUserIdx = -1;
  for (let i = cleaned.length - 1; i >= 0; i--) {
    if (cleaned[i].role === 'user') {
      lastUserIdx = i;
      break;
    }
  }
  if (lastUserIdx < 0) return { history: [], userText: '' };

  const userText = cleaned[lastUserIdx].content.trim();
  const hasSpeakHint = /\(Speak in [^)]+\)\s*$/i.test(userText);
  const baseSys = (typeof customSystemPrompt === 'string' && customSystemPrompt.trim())
    ? customSystemPrompt.trim().slice(0, 1500)
    : WAFFLE_SYSTEM_PROMPT;
  const langGuard = hasSpeakHint
    ? ' Follow the requested output language at the end of the prompt.'
    : (baseSys === WAFFLE_SYSTEM_PROMPT ? '' : ' Respond in English unless instructed otherwise.');
  const sysText = baseSys + langGuard;
  const history = [{ type: 'system', text: sysText }];

  for (let i = 0; i < lastUserIdx; i++) {
    const m = cleaned[i];
    if (m.role === 'user') {
      history.push({ type: 'user', text: m.content.trim() });
    } else if (m.role === 'assistant') {
      history.push({ type: 'model', response: [m.content.trim()] });
    }
  }

  return { history, userText };
}

function readJsonBody(req, maxBytes = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error('Request body too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(Object.assign(new Error('Invalid JSON payload'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  if (res.writableEnded || res.destroyed) return;
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function sendSse(res, event, data) {
  if (res.writableEnded || res.destroyed) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function attachWaffleAiMiddleware(middlewares) {
  middlewares.use(async (req, res, next) => {
    let pathname;
    try {
      pathname = new URL(req.url, 'http://localhost').pathname;
    } catch {
      return next();
    }
    if (!pathname.startsWith('/api/waffle-ai/')) return next();

    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.end();
      return;
    }

    if (pathname === '/api/waffle-ai/status' && req.method === 'GET') {
      return sendJson(res, 200, getWaffleStatus());
    }

    if (pathname === '/api/waffle-ai/warmup' && req.method === 'POST') {
      let modelId = activeModelId;
      try {
        const b = await readJsonBody(req);
        if (b?.modelId) modelId = b.modelId;
      } catch {}
      try {
        await ensureWaffleSession(modelId);
        return sendJson(res, 200, getWaffleStatus(modelId));
      } catch (err) {
        return sendJson(res, 500, { ...getWaffleStatus(modelId), error: err.message });
      }
    }

    if (pathname === '/api/waffle-ai/wall-quip' && (req.method === 'POST' || req.method === 'GET')) {
      const themes = [
        'bouncy waffle walls', 'maple syrup physics', 'crispy waffle pockets',
        'Roper and the arcade', 'learning new languages', 'painting in Art Studio',
        'fresh math puzzles', 'writing clean code', 'science experiments', 'melted butter'
      ];
      const theme = themes[Math.floor(Math.random() * themes.length)];
      const abortController = new AbortController();
      req.on('close', () => { if (!res.writableEnded) abortController.abort(); });

      const runQuip = async () => {
        if (abortController.signal.aborted) return;
        const session = await ensureWaffleSession(activeModelId);
        if (abortController.signal.aborted) return;
        session.setChatHistory([{
          type: 'system',
          text: 'You are Sir Waffle, a cheerful 2.5D waffle mascot. Reply ONLY in English with ONE playful, short reaction (max 10 words, no quotes, no markdown) when someone pokes your bouncy waffle kitchen wall.'
        }]);
        const reply = await session.prompt(`The user just bounced the waffle wall! Make a cute 1-line English quip inspired by: ${theme}.`, {
          maxTokens: 28,
          temperature: 0.9,
          signal: abortController.signal,
          stopOnAbortSignal: true
        });
        const quip = (reply || 'Boing! Crispy waffle vibes!').replace(/["*\n\r]+/g, ' ').trim().slice(0, 72);
        sendJson(res, 200, { quip, model: resolveModel(activeModelId).label, engine: 'node-llama.cpp' });
      };

      const queued = chatQueue.then(runQuip, runQuip);
      chatQueue = queued.catch(() => {});
      try {
        await queued;
      } catch (err) {
        if (!abortController.signal.aborted && !res.writableEnded) {
          sendJson(res, 500, { error: err.message || 'Quip failed' });
        }
      }
      return;
    }

    if (pathname === '/api/waffle-ai/chat' && req.method === 'POST') {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (err) {
        return sendJson(res, err.statusCode || 400, { error: err.message });
      }

      const targetCfg = resolveModel(body.modelId || activeModelId);
      const { history, userText } = buildChatHistory(body.messages, body.systemPrompt);
      if (!userText) {
        return sendJson(res, 400, { error: 'A user message is required.' });
      }

      const stream = body.stream !== false;
      const maxTokens = Math.min(Math.max(Number(body.maxTokens) || 520, 16), 1200);
      const temperature = Math.min(Math.max(Number(body.temperature ?? 0.7), 0), 1.5);
      const abortController = new AbortController();

      req.on('close', () => {
        if (!res.writableEnded) abortController.abort();
      });

      if (stream) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders?.();
        sendSse(res, 'status', {
          state: sessionInstance && activeModelId === targetCfg.id ? 'generating' : 'loading',
          model: targetCfg.label,
          modelId: targetCfg.id,
          engine: 'node-llama.cpp'
        });
      }

      const runTask = async () => {
        if (abortController.signal.aborted) return;
        const session = await ensureWaffleSession(targetCfg.id);
        if (abortController.signal.aborted) return;

        if (stream) {
          sendSse(res, 'status', {
            state: 'generating',
            model: targetCfg.label,
            modelId: targetCfg.id,
            engine: 'node-llama.cpp'
          });
        }

        session.setChatHistory(history);
        const promptForModel = (targetCfg.id === 'qwen3-0.6b' && !/\/(think|no_think)\b/.test(userText))
          ? `${userText} /no_think`
          : userText;
        let fullText = '';
        const reply = await session.prompt(promptForModel, {
          maxTokens,
          temperature,
          signal: abortController.signal,
          stopOnAbortSignal: true,
          onTextChunk(chunk) {
            fullText += chunk;
            if (stream && chunk) sendSse(res, 'token', { text: chunk });
          }
        });

        const finalText = (reply || fullText || '').replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
        if (stream) {
          sendSse(res, 'done', { text: finalText, model: targetCfg.label, modelId: targetCfg.id, engine: 'node-llama.cpp' });
          if (!res.writableEnded) res.end();
        } else {
          sendJson(res, 200, { reply: finalText, model: targetCfg.label, modelId: targetCfg.id, engine: 'node-llama.cpp' });
        }
      };

      const queued = chatQueue.then(runTask, runTask);
      chatQueue = queued.catch(() => {});

      try {
        await queued;
      } catch (err) {
        if (abortController.signal.aborted) {
          if (!res.writableEnded) res.end();
          return;
        }
        console.error('[Waffle AI] Chat error:', err);
        if (stream) {
          sendSse(res, 'error', { error: err.message || 'Generation failed' });
          if (!res.writableEnded) res.end();
        } else {
          sendJson(res, 500, { error: err.message || 'Generation failed' });
        }
      }
      return;
    }

    next();
  });
}
