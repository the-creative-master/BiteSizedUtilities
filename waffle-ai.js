import { waffleMascotSVG } from './icons-25d.js';
import { playPop, playBoing, playSquish, playSparkle } from './sfx.js';
import { copyToClipboard } from './ui-kit.js';
import { createDocxBlob, extractTextFromUpload, triggerFileDownload } from './file-tools-client.js';
import {
  TEXT_MODELS,
  streamBrowserChat,
  streamWllamaChat,
  getSelectedTextModel,
  getSelectedImageModel,
  getSelectedExecutionMode,
  getSmartPromptEnabled,
  getAiTemperature,
  detectDeviceDiagnostics,
  AI_DISCLAIMER_TEXT
} from './waffle-browser-ai.js';
import { IMAGE_MODELS, detectImageCapabilities, generateWaffleImage } from './waffle-image-gen.js';

const STARTER_PROMPTS = [
  '/imagine a cozy golden waffle bakery at sunrise',
  'Make a .docx study guide on photosynthesis',
  'Write a Python binary search with examples',
  'Summarize my uploaded file in bullet points'
];

const WELCOME_MSG = {
  role: 'assistant',
  content: [
    'Hey there, kitchen friend! I’m **Sir Waffle**, your **Waffle AI** assistant.',
    '',
    '- **AI Models & Fallbacks (in ⚙ Settings)**: Choose **Qwen 2.5 1.5B**, **Qwen 2.5 Coder 1.5B**, **Qwen 3 0.6B**, **Llama 3.2 1B**, **Qwen 3.5 0.8B**, **SmolLM2 360M**, **Qwen 2.5 0.5B**, or **DeepSeek R1 1.5B**',
    '- **Image Generation**: Tap **🎨 Image** (or type `/imagine ...`) with **SDXS-512 (1-Step)** or **SD-Turbo (WebGPU)**',
    '- **Files & Markdown**: Attach `.docx` / `.txt` / `.md` / code files, or ask me to generate a downloadable `.docx`!',
    '',
    `> ⚠ **${AI_DISCLAIMER_TEXT}**`
  ].join('\n')
};

const LANG_EXT = {
  python: 'py', py: 'py', javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts',
  html: 'html', css: 'css', json: 'json', sql: 'sql', bash: 'sh', sh: 'sh',
  markdown: 'md', md: 'md', csv: 'csv', yaml: 'yml', yml: 'yml', xml: 'xml',
  ruby: 'rb', php: 'php', rust: 'rs', go: 'go', java: 'java', cpp: 'cpp', c: 'c'
};

let overlayEl = null;
let messages = [WELCOME_MSG];
let attachments = [];
let isGenerating = false;
let activeAbort = null;
let modelState = { preCached: true, loaded: false, loading: false };
let codeArtifacts = [];
let imageMode = false;
let webSearchMode = false;
let imageCaps = { hasWebGPU: false, hasF16: false };
let deviceDiag = { hasWebGPU: false, isOldIOS: false, hasRisk: true, summaryLabel: 'Checking device…' };

const esc = s => String(s).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

function splitFencedSegments(raw) {
  const lines = String(raw || '').split('\n');
  const segments = [];
  let textBuf = [];
  let inFence = false;
  let fenceTag = '';
  let codeBuf = [];

  const flushText = () => {
    if (textBuf.length) {
      segments.push({ type: 'text', text: textBuf.join('\n') });
      textBuf = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!inFence) {
      if (trimmed.startsWith('```')) {
        flushText();
        inFence = true;
        fenceTag = trimmed.slice(3).trim();
        codeBuf = [];
      } else {
        textBuf.push(line);
      }
    } else {
      if (trimmed === '```') {
        segments.push({ type: 'fence', tag: fenceTag, code: codeBuf.join('\n'), closed: true });
        inFence = false;
        fenceTag = '';
        codeBuf = [];
      } else {
        codeBuf.push(line);
      }
    }
  }

  if (inFence) {
    segments.push({ type: 'fence', tag: fenceTag, code: codeBuf.join('\n'), closed: false });
  }
  flushText();
  return segments;
}

function formatInlineMarkdown(raw) {
  let s = esc(raw);
  const codeSpans = [];
  s = s.replace(/`([^`\n]+)`/g, (_, inner) => {
    const idx = codeSpans.length;
    codeSpans.push(`<code class="waffle-inline-code">${inner}</code>`);
    return `\u0000CODE${idx}\u0000`;
  });
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a class="waffle-md-link" href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/\u0000CODE(\d+)\u0000/g, (_, idx) => codeSpans[Number(idx)] || '');
  return s;
}

function renderProseMarkdown(text) {
  const lines = text.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { i++; continue; }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      out.push('<hr class="waffle-md-hr">');
      i++; continue;
    }

    const h = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (h) {
      const lvl = Math.min(h[1].length, 3);
      out.push(`<h${lvl + 2} class="waffle-md-h waffle-md-h${lvl}">${formatInlineMarkdown(h[2])}</h${lvl + 2}>`);
      i++; continue;
    }

    if (trimmed.startsWith('>')) {
      const qLines = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        qLines.push(formatInlineMarkdown(lines[i].trim().replace(/^>\s?/, '')));
        i++;
      }
      out.push(`<blockquote class="waffle-md-quote">${qLines.join('<br>')}</blockquote>`);
      continue;
    }

    if (trimmed.startsWith('|') && i + 1 < lines.length && /^\|?[\s:|-]+\|/.test(lines[i + 1].trim())) {
      const parseRow = r => r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      const headers = parseRow(trimmed);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().includes('|')) {
        rows.push(parseRow(lines[i]));
        i++;
      }
      out.push(
        `<div class="waffle-md-table-wrap"><table class="waffle-md-table"><thead><tr>${
          headers.map(c => `<th>${formatInlineMarkdown(c)}</th>`).join('')
        }</tr></thead><tbody>${
          rows.map(r => `<tr>${headers.map((_, ci) => `<td>${formatInlineMarkdown(r[ci] || '')}</td>`).join('')}</tr>`).join('')
        }</tbody></table></div>`
      );
      continue;
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(`<li>${formatInlineMarkdown(lines[i].trim().replace(/^[-*•]\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ul class="waffle-md-list">${items.join('')}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(`<li>${formatInlineMarkdown(lines[i].trim().replace(/^\d+\.\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ol class="waffle-md-list">${items.join('')}</ol>`);
      continue;
    }

    const pLines = [];
    while (i < lines.length) {
      const t = lines[i].trim();
      if (!t || /^(#{1,4}\s+|[-*•]\s+|\d+\.\s+|>\s?|---|\*\*\*|\|.*\|)/.test(t)) break;
      pLines.push(formatInlineMarkdown(lines[i]));
      i++;
    }
    if (pLines.length) out.push(`<p class="waffle-md-p">${pLines.join('<br>')}</p>`);
  }

  return out.join('');
}

export function formatWaffleMarkdown(raw, streaming = false) {
  const segments = splitFencedSegments(raw);
  return segments.map(seg => {
    if (seg.type === 'text') return renderProseMarkdown(seg.text);

    const tag = (seg.tag || '').trim();
    const isFile = /^file:/i.test(tag);
    const artifactId = codeArtifacts.length;

    if (isFile) {
      const fileName = tag.slice(5).trim() || 'waffle-file.txt';
      codeArtifacts.push({ kind: 'file', fileName, code: seg.code });
      const ext = (fileName.split('.').pop() || 'txt').toLowerCase();
      return `
        <div class="waffle-file-box">
          <div class="waffle-code-head">
            <span class="waffle-code-lang">📄 ${esc(fileName)}</span>
            <div class="waffle-code-btns">
              <button type="button" class="waffle-mini-btn" data-copy-artifact="${artifactId}">Copy</button>
              <button type="button" class="waffle-mini-btn is-primary" data-dl-artifact="${artifactId}" ${streaming && !seg.closed ? 'disabled' : ''}>⬇ Download .${esc(ext)}</button>
            </div>
          </div>
          <pre class="waffle-code-pre"><code>${esc(seg.code || (streaming ? 'Baking file…' : ''))}</code></pre>
        </div>
      `;
    }

    const langLabel = (tag || 'code').toLowerCase();
    const ext = LANG_EXT[langLabel] || 'txt';
    const fileName = `waffle-snippet.${ext}`;
    codeArtifacts.push({ kind: 'code', fileName, code: seg.code });

    return `
      <div class="waffle-code-box">
        <div class="waffle-code-head">
          <span class="waffle-code-lang">${esc(langLabel)}</span>
          <div class="waffle-code-btns">
            <button type="button" class="waffle-mini-btn" data-copy-artifact="${artifactId}">Copy</button>
            <button type="button" class="waffle-mini-btn" data-dl-artifact="${artifactId}">⬇ .${esc(ext)}</button>
          </div>
        </div>
        <pre class="waffle-code-pre"><code>${esc(seg.code || '')}</code></pre>
      </div>
    `;
  }).join('');
}

async function streamServerChat({ modelId, messages: msgList, systemPrompt, maxTokens = 520, temperature = 0.7, signal, onStatus, onToken }) {
  const res = await fetch('./api/waffle-ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId, messages: msgList, systemPrompt, maxTokens, temperature, stream: true }),
    signal
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalText = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() || '';
    for (const frame of frames) {
      let evName = 'message';
      let dataLine = '';
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) evName = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLine += line.slice(5).trim();
      }
      if (!dataLine) continue;
      let payload;
      try { payload = JSON.parse(dataLine); } catch { continue; }
      if (evName === 'status') onStatus?.(payload);
      else if (evName === 'token' && typeof payload.text === 'string') {
        finalText += payload.text;
        onToken?.(payload.text, finalText);
      } else if (evName === 'done' && typeof payload.text === 'string') {
        finalText = payload.text || finalText;
      } else if (evName === 'error') {
        throw new Error(payload.error || 'Generation failed');
      }
    }
  }
  return finalText.trim();
}

export async function streamWaffleChat({ modelId, messages: msgList, systemPrompt, maxTokens = 520, temperature = 0.7, signal, onStatus, onToken }) {
  const chosenId = modelId || getSelectedTextModel();
  const cfg = TEXT_MODELS.find(m => m.id === chosenId) || TEXT_MODELS[0];
  const mode = getSelectedExecutionMode();
  const diag = await detectDeviceDiagnostics().catch(() => ({ hasWebGPU: false }));

  // Build ordered automatic fallback chain without surfacing internal tier names
  const attempts = [];
  if (mode === 'server') {
    attempts.push({ kind: 'server', id: cfg.kind === 'server' ? cfg.id : 'qwen2.5-1.5b' });
    if (diag.hasWebGPU) attempts.push({ kind: 'browser', id: cfg.kind === 'browser' ? cfg.id : 'qwen2.5-0.5b', dev: 'webgpu' });
    attempts.push({ kind: 'wllama', gguf: cfg.ggufFile || 'qwen3-0.6b.gguf', hfRepo: cfg.hfGgufRepo, hfQuant: cfg.hfGgufQuant, webgpu: false });
    attempts.push({ kind: 'browser', id: cfg.kind === 'browser' ? cfg.id : 'qwen2.5-0.5b', dev: 'wasm' });
  } else if (mode === 'webgpu') {
    if (diag.hasWebGPU) {
      attempts.push({ kind: 'browser', id: cfg.kind === 'browser' ? cfg.id : 'qwen3.5-0.8b', dev: 'webgpu' });
      attempts.push({ kind: 'wllama', gguf: cfg.ggufFile || 'qwen3-0.6b.gguf', hfRepo: cfg.hfGgufRepo, hfQuant: cfg.hfGgufQuant, webgpu: true });
    }
    attempts.push({ kind: 'wllama', gguf: cfg.ggufFile || 'qwen3-0.6b.gguf', hfRepo: cfg.hfGgufRepo, hfQuant: cfg.hfGgufQuant, webgpu: false });
    attempts.push({ kind: 'browser', id: cfg.kind === 'browser' ? cfg.id : 'qwen2.5-0.5b', dev: 'wasm' });
    attempts.push({ kind: 'server', id: cfg.kind === 'server' ? cfg.id : 'qwen2.5-1.5b' });
  } else if (mode === 'wllama') {
    if (diag.hasWebGPU) attempts.push({ kind: 'wllama', gguf: cfg.ggufFile || 'qwen3-0.6b.gguf', hfRepo: cfg.hfGgufRepo, hfQuant: cfg.hfGgufQuant, webgpu: true });
    attempts.push({ kind: 'wllama', gguf: cfg.ggufFile || 'qwen3-0.6b.gguf', hfRepo: cfg.hfGgufRepo, hfQuant: cfg.hfGgufQuant, webgpu: false });
    attempts.push({ kind: 'browser', id: 'qwen2.5-0.5b', dev: 'wasm' });
    attempts.push({ kind: 'server', id: cfg.kind === 'server' ? cfg.id : 'qwen2.5-1.5b' });
  } else if (mode === 'wasm') {
    attempts.push({ kind: 'browser', id: cfg.kind === 'browser' ? cfg.id : 'qwen2.5-0.5b', dev: 'wasm' });
    attempts.push({ kind: 'wllama', gguf: cfg.ggufFile || 'qwen3-0.6b.gguf', hfRepo: cfg.hfGgufRepo, hfQuant: cfg.hfGgufQuant, webgpu: false });
    attempts.push({ kind: 'server', id: cfg.kind === 'server' ? cfg.id : 'qwen2.5-1.5b' });
  } else {
    // Auto fallback chain
    if (cfg.kind === 'browser') {
      if (diag.hasWebGPU) {
        attempts.push({ kind: 'browser', id: cfg.id, dev: 'webgpu' });
      }
      attempts.push({ kind: 'browser', id: cfg.id, dev: 'wasm' });
      if (diag.hasWebGPU) {
        attempts.push({ kind: 'wllama', gguf: cfg.ggufFile || 'qwen3-0.6b.gguf', hfRepo: cfg.hfGgufRepo, hfQuant: cfg.hfGgufQuant, webgpu: true });
      }
      attempts.push({ kind: 'wllama', gguf: cfg.ggufFile || 'qwen3-0.6b.gguf', hfRepo: cfg.hfGgufRepo, hfQuant: cfg.hfGgufQuant, webgpu: false });
      attempts.push({ kind: 'server', id: 'qwen2.5-1.5b' });
    } else {
      attempts.push({ kind: 'server', id: cfg.id });
      if (diag.hasWebGPU) {
        attempts.push({ kind: 'browser', id: 'qwen3.5-0.8b', dev: 'webgpu' });
        attempts.push({ kind: 'wllama', gguf: cfg.ggufFile || 'qwen3-0.6b.gguf', hfRepo: cfg.hfGgufRepo, hfQuant: cfg.hfGgufQuant, webgpu: true });
      }
      attempts.push({ kind: 'wllama', gguf: cfg.ggufFile || 'qwen3-0.6b.gguf', hfRepo: cfg.hfGgufRepo, hfQuant: cfg.hfGgufQuant, webgpu: false });
      attempts.push({ kind: 'browser', id: 'qwen2.5-0.5b', dev: 'wasm' });
    }
  }

  let lastErr = null;
  for (let i = 0; i < attempts.length; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const step = attempts[i];
    if (i > 0) {
      onStatus?.({ state: 'loading', detail: `Switching to fallback (${step.kind === 'wllama' ? 'WLlama' : step.dev ? step.dev.toUpperCase() : 'Server'})…` });
    }
    try {
      if (step.kind === 'server') {
        return await streamServerChat({ modelId: step.id, messages: msgList, systemPrompt, maxTokens, temperature, signal, onStatus, onToken });
      }
      if (step.kind === 'wllama') {
        return await streamWllamaChat({ ggufFile: step.gguf, hfRepo: step.hfRepo, hfQuant: step.hfQuant, messages: msgList, systemPrompt, maxTokens, temperature, useWebGPU: step.webgpu, signal, onStatus, onToken });
      }
      return await streamBrowserChat({ modelId: step.id, messages: msgList, systemPrompt, maxTokens, temperature, preferredDevice: step.dev, signal, onStatus, onToken });
    } catch (err) {
      if (err.name === 'AbortError' || signal?.aborted) throw err;
      lastErr = err;
    }
  }
  throw lastErr || new Error('All AI runtimes failed on this device.');
}

async function fetchStatus() {
  try {
    const r = await fetch('./api/waffle-ai/status', { cache: 'no-store' });
    if (r.ok) {
      modelState = await r.json();
      updateStatusBadge();
    }
  } catch {}
}

export async function warmupWaffleAI() {
  try {
    const r = await fetch('./api/waffle-ai/warmup', { method: 'POST' });
    if (r.ok) {
      modelState = await r.json();
      updateStatusBadge();
    }
  } catch {}
}

function activeTextCfg() {
  const id = getSelectedTextModel();
  return TEXT_MODELS.find(m => m.id === id) || TEXT_MODELS[0];
}

function activeImageCfg() {
  const id = getSelectedImageModel();
  return IMAGE_MODELS.find(m => m.id === id) || IMAGE_MODELS[0];
}

function updateStatusBadge(customNote) {
  if (!overlayEl) return;
  const badge = overlayEl.querySelector('#waffle-ai-badge');
  const toggleBtn = overlayEl.querySelector('#waffle-ai-models-btn');
  const diagEl = overlayEl.querySelector('#waffle-ai-device-status');
  const tCfg = activeTextCfg();
  const iCfg = activeImageCfg();
  if (toggleBtn) {
    toggleBtn.textContent = imageMode ? `🎨 ${iCfg.name} · ⚙` : `🤖 ${tCfg.label} · ⚙`;
  }
  if (diagEl) {
    diagEl.textContent = deviceDiag.summaryLabel;
    diagEl.className = `waffle-device-pill ${deviceDiag.hasRisk ? 'is-risk' : 'is-ok'}`;
  }
  if (!badge) return;
  if (customNote) {
    badge.textContent = customNote;
    badge.className = 'waffle-ai-badge is-busy';
    return;
  }
  if (imageMode) {
    const gpuLabel = imageCaps.hasWebGPU ? 'WebGPU Ready' : 'WASM CPU Fallback';
    badge.textContent = `${iCfg.name} · ${gpuLabel}`;
    badge.className = 'waffle-ai-badge is-ready';
    return;
  }
  if (tCfg.kind === 'browser') {
    badge.textContent = `${tCfg.label} · ${tCfg.badge}`;
    badge.className = isGenerating ? 'waffle-ai-badge is-busy' : 'waffle-ai-badge is-ready';
    return;
  }
  if (modelState.error) {
    badge.textContent = `${tCfg.label} · ${modelState.error}`;
    badge.className = 'waffle-ai-badge is-warn';
  } else if (isGenerating) {
    badge.textContent = `${tCfg.label} · Thinking…`;
    badge.className = 'waffle-ai-badge is-busy';
  } else if (modelState.loaded && modelState.modelId === tCfg.id) {
    badge.textContent = `${tCfg.label} · Ready`;
    badge.className = 'waffle-ai-badge is-ready';
  } else {
    badge.textContent = `${tCfg.label} · Pre-cached`;
    badge.className = 'waffle-ai-badge';
  }
}

function renderAttachments() {
  if (!overlayEl) return;
  const shelf = overlayEl.querySelector('#waffle-ai-files');
  if (!shelf) return;
  shelf.hidden = attachments.length === 0;
  shelf.innerHTML = attachments.map((f, idx) => `
    <span class="waffle-attach-pill">
      <span>📎 ${esc(f.name)} (${Math.max(1, Math.round(f.text.length / 1024))} KB)</span>
      <button type="button" class="waffle-attach-x" data-rm-file="${idx}" aria-label="Remove ${esc(f.name)}">✕</button>
    </span>
  `).join('');
  shelf.querySelectorAll('[data-rm-file]').forEach(btn => {
    btn.addEventListener('click', () => {
      attachments.splice(Number(btn.dataset.rmFile), 1);
      renderAttachments();
    });
  });
}

function renderMessages() {
  if (!overlayEl) return;
  const feed = overlayEl.querySelector('#waffle-ai-feed');
  const starters = overlayEl.querySelector('#waffle-ai-starters');
  if (!feed) return;

  codeArtifacts = [];

  feed.innerHTML = messages.map((m, idx) => {
    const isUser = m.role === 'user';
    const streamingNow = !isUser && isGenerating && idx === messages.length - 1;
    const streamingCursor = streamingNow && !m.imageProgress ? '<span class="waffle-cursor" aria-hidden="true">▌</span>' : '';
    const fileNote = isUser && m.fileNames?.length
      ? `<div class="waffle-msg-files">${m.fileNames.map(n => `<span class="waffle-msg-file-tag">📎 ${esc(n)}</span>`).join('')}</div>`
      : '';

    let bodyHtml = '';
    if (isUser) {
      bodyHtml = `<p class="waffle-md-p">${esc(m.displayContent ?? m.content).replace(/\n/g, '<br>')}</p>`;
    } else if (m.imageResult) {
      const r = m.imageResult;
      bodyHtml = `
        <div class="waffle-gen-img-card">
          <img class="waffle-gen-img" src="${r.dataUrl}" alt="${esc(m.imagePrompt || 'Generated image')}">
          <div class="waffle-gen-meta">
            <span>${esc(r.model === 'sd-turbo' ? 'SD-Turbo' : 'SDXS-512')} · ${esc(r.backend.toUpperCase())} · ${r.steps} step${r.steps > 1 ? 's' : ''} · ${(r.timeMs / 1000).toFixed(1)}s · seed ${r.seed}</span>
          </div>
          ${m.enhancedPrompt ? `<p class="waffle-gen-prompt">Prompt: <em>${esc(m.enhancedPrompt)}</em></p>` : ''}
          <div class="waffle-msg-actions">
            <button type="button" class="waffle-mini-btn is-primary" data-dl-img="${idx}">⬇ Save PNG</button>
            <button type="button" class="waffle-mini-btn" data-vary-img="${idx}">🎲 Vary Seed</button>
            <button type="button" class="waffle-mini-btn" data-art-img="${idx}">🎨 Edit in Art Studio</button>
          </div>
        </div>
      `;
    } else if (m.imageProgress) {
      const p = m.imageProgress;
      bodyHtml = `
        <div class="waffle-img-progress">
          <div class="waffle-img-prog-head">
            <span>🎨 ${esc(p.stage || 'Preparing image model…')}</span>
            <b>${p.percent || 0}%</b>
          </div>
          <div class="waffle-img-prog-bar"><span style="width:${Math.max(4, p.percent || 0)}%"></span></div>
          ${p.detail ? `<small class="waffle-img-prog-detail">${esc(p.detail)}</small>` : ''}
        </div>
      `;
    } else {
      bodyHtml = m.content ? formatWaffleMarkdown(m.content, streamingNow) : '<span class="waffle-thinking">Warming up the waffle iron…</span>';
    }

    const webSourcesBar = !isUser && m.webSources?.length
      ? `<div class="waffle-web-sources"><span class="waffle-web-label">🌐 Sources:</span>${m.webSources.map(s => `<a class="waffle-web-chip" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} · <small>${esc(s.source)}</small></a>`).join('')}</div>`
      : '';
    const exportBar = !isUser && !streamingNow && m.content && !m.imageResult
      ? `<div class="waffle-msg-actions">
           <button type="button" class="waffle-mini-btn" data-copy-msg="${idx}">Copy</button>
           <button type="button" class="waffle-mini-btn" data-docx-msg="${idx}">⬇ Save .docx</button>
           <button type="button" class="waffle-mini-btn" data-md-msg="${idx}">⬇ Save .md</button>
         </div>`
      : '';
    return `
      <div class="waffle-msg ${isUser ? 'is-user' : 'is-bot'}">
        ${isUser ? '' : `<span class="waffle-msg-avatar" aria-hidden="true">${waffleMascotSVG('waffle-mini-svg')}</span>`}
        <div class="waffle-msg-bubble">
          <div class="waffle-msg-author">${isUser ? 'You' : (m.authorLabel || 'Sir Waffle')}</div>
          ${fileNote}
          ${webSourcesBar}
          <div class="waffle-msg-body">${bodyHtml}${streamingCursor}</div>
          ${exportBar}
        </div>
      </div>
    `;
  }).join('');

  feed.querySelectorAll('[data-copy-artifact]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const art = codeArtifacts[Number(btn.dataset.copyArtifact)];
      if (!art) return;
      const ok = await copyToClipboard(art.code);
      btn.textContent = ok ? 'Copied!' : 'Failed';
      setTimeout(() => { btn.textContent = 'Copy'; }, 1200);
    });
  });

  feed.querySelectorAll('[data-dl-artifact]').forEach(btn => {
    btn.addEventListener('click', () => {
      const art = codeArtifacts[Number(btn.dataset.dlArtifact)];
      if (!art) return;
      playPop(620);
      if (art.fileName.toLowerCase().endsWith('.docx')) {
        triggerFileDownload(createDocxBlob(art.code, art.fileName.replace(/\.docx$/i, '')), art.fileName);
      } else {
        triggerFileDownload(art.code, art.fileName);
      }
    });
  });

  feed.querySelectorAll('[data-dl-img]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const m = messages[Number(btn.dataset.dlImg)];
      if (!m?.imageResult?.dataUrl) return;
      playPop(620);
      const blob = await (await fetch(m.imageResult.dataUrl)).blob();
      triggerFileDownload(blob, `waffle-ai-${m.imageResult.seed}.png`, 'image/png');
    });
  });

  feed.querySelectorAll('[data-vary-img]').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = messages[Number(btn.dataset.varyImg)];
      if (!m?.imagePrompt || isGenerating) return;
      runImageGeneration(m.enhancedPrompt || m.imagePrompt, m.imagePrompt, false);
    });
  });

  feed.querySelectorAll('[data-art-img]').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = messages[Number(btn.dataset.artImg)];
      if (!m?.imageResult?.dataUrl) return;
      playSparkle();
      closeWaffleAI();
      window.dispatchEvent(new CustomEvent('waffle-open-art-studio', { detail: { dataUrl: m.imageResult.dataUrl } }));
    });
  });

  feed.querySelectorAll('[data-copy-msg]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const m = messages[Number(btn.dataset.copyMsg)];
      if (!m) return;
      const ok = await copyToClipboard(m.content);
      btn.textContent = ok ? 'Copied!' : 'Failed';
      setTimeout(() => { btn.textContent = 'Copy'; }, 1200);
    });
  });

  feed.querySelectorAll('[data-docx-msg]').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = messages[Number(btn.dataset.docxMsg)];
      if (!m) return;
      playPop(620);
      triggerFileDownload(createDocxBlob(m.content, 'Waffle AI Note'), 'waffle-ai-note.docx');
    });
  });

  feed.querySelectorAll('[data-md-msg]').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = messages[Number(btn.dataset.mdMsg)];
      if (!m) return;
      playPop(620);
      triggerFileDownload(m.content, 'waffle-ai-note.md', 'text/markdown;charset=utf-8');
    });
  });

  if (starters) {
    starters.hidden = messages.length > 1 || isGenerating;
  }
  feed.scrollTop = feed.scrollHeight;
}

function syncComposerState() {
  if (!overlayEl) return;
  const sendBtn = overlayEl.querySelector('#waffle-ai-send');
  const stopBtn = overlayEl.querySelector('#waffle-ai-stop');
  const imgToggle = overlayEl.querySelector('#waffle-ai-img-toggle');
  const webToggle = overlayEl.querySelector('#waffle-ai-web-toggle');
  const input = overlayEl.querySelector('#waffle-ai-input');
  if (sendBtn) {
    sendBtn.hidden = isGenerating;
    sendBtn.textContent = imageMode ? 'Imagine' : webSearchMode ? 'Search & Ask' : 'Send';
  }
  if (stopBtn) stopBtn.hidden = !isGenerating;
  if (imgToggle) {
    imgToggle.classList.toggle('selected', imageMode);
    imgToggle.setAttribute('aria-pressed', String(imageMode));
  }
  if (webToggle) {
    webToggle.classList.toggle('selected', webSearchMode);
    webToggle.setAttribute('aria-pressed', String(webSearchMode));
  }
  if (input) {
    input.placeholder = imageMode
      ? `Describe an image for ${activeImageCfg().name}…`
      : webSearchMode
        ? 'Ask with Web Search ON (e.g. latest news, GitHub repos, facts)…'
        : 'Ask Sir Waffle, attach a file, /search <query>, or /imagine <prompt>…';
  }
  updateStatusBadge();
}

async function handleFilesSelected(fileList) {
  for (const file of [...fileList].slice(0, 4)) {
    try {
      const extracted = await extractTextFromUpload(file);
      const clipped = String(extracted || '').trim().slice(0, 5200);
      if (!clipped) throw new Error('No readable text found inside this file.');
      attachments.push({ name: file.name, text: clipped });
      playPop(620);
    } catch (err) {
      alert(`Could not read ${file.name}: ${err.message}`);
    }
  }
  renderAttachments();
}

function parseImageIntent(text) {
  if (/^\/(imagine|img|draw)\b/i.test(text)) {
    return text.replace(/^\/(imagine|img|draw)\s*/i, '').trim() || 'a cozy golden waffle in warm sunlight';
  }
  if (imageMode) return text;
  const natural = /^(?:please\s+)?(?:generate|create|make|draw|paint|render)\s+(?:me\s+)?(?:an?\s+)?(?:image|picture|photo|illustration|drawing|painting|art(?:work)?)\s+(?:of\s+)?(.+)$/i.exec(text);
  return natural ? natural[1].trim() : null;
}

async function runImageGeneration(promptText, displayPrompt = promptText, allowEnhance = getSmartPromptEnabled()) {
  if (isGenerating) return;
  const imgCfg = activeImageCfg();
  playPop(600);

  messages.push({
    role: 'user',
    displayContent: `🎨 Generate (${imgCfg.name}): ${displayPrompt}`,
    content: displayPrompt
  });
  messages.push({
    role: 'assistant',
    authorLabel: `Sir Waffle · ${imgCfg.name}`,
    imagePrompt: displayPrompt,
    imageProgress: { stage: 'Preparing…', percent: 2, detail: '' },
    content: ''
  });

  isGenerating = true;
  renderMessages();
  syncComposerState();

  const assistantIdx = messages.length - 1;
  activeAbort = new AbortController();

  try {
    let finalPrompt = promptText;
    if (allowEnhance && promptText.split(/\s+/).length <= 12) {
      messages[assistantIdx].imageProgress = { stage: 'Polishing prompt…', percent: 4, detail: promptText };
      renderMessages();
      try {
        const polished = await streamWaffleChat({
          messages: [{ role: 'user', content: `Turn this short idea into a concise, vivid 1-sentence Stable Diffusion image prompt (max 35 words, comma-separated visual details only, no preamble): "${promptText}"` }],
          systemPrompt: 'Output ONLY a concise comma-separated visual image prompt. No quotes, no intro.',
          maxTokens: 70,
          temperature: 0.6,
          signal: activeAbort.signal
        });
        if (polished && polished.length > 6 && polished.length < 240) {
          finalPrompt = polished.replace(/^["']|["']$/g, '').trim();
        }
      } catch {}
    }

    const res = await generateWaffleImage({
      model: getSelectedImageModel(),
      prompt: finalPrompt,
      steps: imgCfg.defaultSteps,
      signal: activeAbort.signal,
      onProgress(p) {
        messages[assistantIdx].imageProgress = p;
        renderMessages();
        updateStatusBadge(`${imgCfg.name} · ${p.stage} (${p.percent}%)`);
      }
    });

    delete messages[assistantIdx].imageProgress;
    messages[assistantIdx].imageResult = res;
    messages[assistantIdx].enhancedPrompt = finalPrompt !== displayPrompt ? finalPrompt : '';
    messages[assistantIdx].content = `Generated image for "${displayPrompt}" (${res.model}, ${res.backend}, seed ${res.seed}).`;
    playSparkle();
  } catch (err) {
    delete messages[assistantIdx].imageProgress;
    if (err.name === 'AbortError') {
      messages[assistantIdx].content = '*Stopped image generation.* Ready whenever you are!';
    } else {
      messages[assistantIdx].content = `Image generation hit a bump: ${err.message}`;
    }
  } finally {
    isGenerating = false;
    activeAbort = null;
    renderMessages();
    syncComposerState();
    overlayEl?.querySelector('#waffle-ai-input')?.focus();
  }
}

async function sendMessage(rawText) {
  const text = String(rawText || '').trim();
  if ((!text && !attachments.length) || isGenerating) return;

  const input = overlayEl?.querySelector('#waffle-ai-input');
  if (input) input.value = '';

  if (!attachments.length) {
    const imgPrompt = parseImageIntent(text);
    if (imgPrompt) {
      await runImageGeneration(imgPrompt, imgPrompt, getSmartPromptEnabled());
      return;
    }
  }

  const currentFiles = attachments.splice(0);
  renderAttachments();

  const wantsWeb = webSearchMode || /^\/search\b/i.test(text);
  const cleanQuery = text.replace(/^\/search\s*/i, '').trim();

  const fileNames = currentFiles.map(f => f.name);
  const fileContext = currentFiles.map(f =>
    `The user uploaded the file "${f.name}". Read its exact contents carefully and use it to answer:\n--- BEGIN FILE: ${f.name} ---\n${f.text}\n--- END FILE: ${f.name} ---`
  ).join('\n\n');
  const tCfg = activeTextCfg();

  playPop(580);
  messages.push({
    role: 'user',
    displayContent: text || `Analyze ${fileNames.join(', ')}`,
    fileNames,
    content: [fileContext, cleanQuery || 'Please read and summarize the attached file(s).'].filter(Boolean).join('\n\n')
  });
  messages.push({
    role: 'assistant',
    authorLabel: `Sir Waffle · ${tCfg.label}`,
    webSources: [],
    content: ''
  });
  isGenerating = true;
  renderMessages();
  syncComposerState();

  const assistantIdx = messages.length - 1;
  activeAbort = new AbortController();

  let webContext = '';
  if (wantsWeb && cleanQuery) {
    updateStatusBadge('🌐 Searching the web…');
    try {
      const wr = await fetch('./api/waffle-ai/web-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: cleanQuery }),
        signal: activeAbort.signal
      });
      if (wr.ok) {
        const wd = await wr.json();
        if (Array.isArray(wd.results) && wd.results.length) {
          messages[assistantIdx].webSources = wd.results;
          webContext = `Web search results for "${cleanQuery}":\n` + wd.results
            .map((r, i) => `[${i + 1}] ${r.title} (${r.source}) - ${r.url}\n${r.snippet}`)
            .join('\n\n');
          renderMessages();
        }
      }
    } catch {}
  }

  const finalUserContent = [
    fileContext,
    webContext ? `Use these live web search results to answer accurately and cite sources:\n--- WEB SEARCH RESULTS ---\n${webContext}\n--- END WEB SEARCH RESULTS ---` : '',
    cleanQuery || 'Please read and summarize the attached file(s).'
  ].filter(Boolean).join('\n\n');
  messages[assistantIdx - 1].content = finalUserContent;

  const historyPayload = messages.slice(0, assistantIdx).map(m => ({ role: m.role, content: m.content }));

  try {
    const finalText = await streamWaffleChat({
      modelId: tCfg.id,
      messages: historyPayload,
      systemPrompt: tCfg.kind === 'browser'
        ? 'You are Sir Waffle, the cheerful, helpful mascot of BiteSizedUtilities. Answer clearly in Markdown.'
        : undefined,
      maxTokens: tCfg.kind === 'browser' ? 560 : 680,
      temperature: getAiTemperature(),
      signal: activeAbort.signal,
      onStatus(payload) {
        if (payload.detail) updateStatusBadge(payload.detail);
        else if (payload.state === 'loading') updateStatusBadge(`Loading ${tCfg.label}…`);
        else if (payload.state === 'generating') {
          modelState.loaded = true;
          modelState.modelId = tCfg.id;
          updateStatusBadge();
        }
      },
      onToken(chunk) {
        messages[assistantIdx].content += chunk;
        renderMessages();
      }
    });
    modelState.loaded = true;
    if (finalText) messages[assistantIdx].content = finalText;
    playSquish();
  } catch (err) {
    if (err.name === 'AbortError') {
      if (!messages[assistantIdx].content.trim()) {
        messages[assistantIdx].content = '*Stopped!* Ask me another question whenever you’re ready.';
      }
    } else {
      messages[assistantIdx].content = `Oops — waffle iron hiccup: ${err.message}`;
    }
  } finally {
    isGenerating = false;
    activeAbort = null;
    renderMessages();
    syncComposerState();
    overlayEl?.querySelector('#waffle-ai-input')?.focus();
  }
}

export function closeWaffleAI() {
  if (!overlayEl) return;
  if (activeAbort) activeAbort.abort();
  overlayEl.hidden = true;
  document.body.classList.remove('waffle-modal-open');
}

function buildOverlay() {
  const wrap = document.createElement('div');
  wrap.id = 'waffle-ai-overlay';
  wrap.className = 'waffle-ai-overlay';
  wrap.hidden = true;
  wrap.innerHTML = `
    <div class="waffle-ai-dialog" role="dialog" aria-modal="true" aria-labelledby="waffle-ai-title">
      <div class="waffle-ai-header">
        <div class="window-grab-pill" aria-hidden="true"></div>
        <div class="waffle-ai-head-row">
          <div class="waffle-ai-title-wrap">
            <span class="waffle-ai-avatar" aria-hidden="true">${waffleMascotSVG('waffle-header-svg')}</span>
            <div>
              <h2 id="waffle-ai-title" class="waffle-ai-title">Waffle AI</h2>
              <span id="waffle-ai-badge" class="waffle-ai-badge">Qwen 2.5 1.5B · node-llama.cpp · Pre-cached</span>
            </div>
          </div>
          <div class="waffle-ai-actions">
            <button type="button" class="gbtn waffle-reset-btn" id="waffle-ai-models-btn" title="Open Settings to switch Chat, Image, or Fallback AI Mode">🤖 Qwen 2.5 1.5B · ⚙</button>
            <button type="button" class="gbtn waffle-reset-btn" id="waffle-ai-reset" title="Start a fresh chat">New Chat</button>
            <button type="button" class="window-close-x" id="waffle-ai-close" aria-label="Close Waffle AI">✕</button>
          </div>
        </div>
        <div class="waffle-disclaimer-box" id="waffle-ai-disclaimer">
          <div class="waffle-disclaimer-head">
            <strong>⚠ DEVICE &amp; WEBGPU DISCLAIMER</strong>
            <span class="waffle-device-pill is-risk" id="waffle-ai-device-status">Checking WebGPU…</span>
          </div>
          <p class="waffle-disclaimer-copy">${esc(AI_DISCLAIMER_TEXT)}</p>
        </div>
      </div>

      <div class="waffle-ai-feed" id="waffle-ai-feed" aria-live="polite"></div>

      <div class="waffle-ai-starters" id="waffle-ai-starters">
        ${STARTER_PROMPTS.map(p => `<button type="button" class="gbtn waffle-starter-chip" data-prompt="${esc(p)}">${esc(p)}</button>`).join('')}
      </div>

      <div class="waffle-ai-files" id="waffle-ai-files" hidden></div>

      <form class="waffle-ai-composer" id="waffle-ai-form">
        <input type="file" id="waffle-ai-file-in" multiple accept=".docx,.pptx,.xlsx,.pdf,.txt,.md,.csv,.json,.js,.ts,.jsx,.tsx,.py,.java,.c,.cpp,.rs,.go,.rb,.php,.html,.css,.xml,.yaml,.yml,.sql,.log,.svg,.png,.jpg,.jpeg,.webp" hidden>
        <button type="button" class="gbtn waffle-attach-btn" id="waffle-ai-attach" title="Attach .docx, .pdf, .pptx, .xlsx, .txt, .md, .csv, or code file">📎</button>
        <button type="button" class="gbtn waffle-img-toggle" id="waffle-ai-web-toggle" aria-pressed="false" title="Toggle Web Search mode">🌐 Web</button>
        <button type="button" class="gbtn waffle-img-toggle" id="waffle-ai-img-toggle" aria-pressed="false" title="Toggle Image Generation mode (SDXS-512 / SD-Turbo)">🎨 Image</button>
        <textarea id="waffle-ai-input" class="waffle-ai-input" rows="1" placeholder="Ask Sir Waffle, attach a file, /search <query>, or /imagine <prompt>…" aria-label="Message Waffle AI"></textarea>
        <button type="submit" class="gbtn gbtn-primary waffle-send-btn" id="waffle-ai-send">Send</button>
        <button type="button" class="gbtn waffle-stop-btn" id="waffle-ai-stop" hidden>Stop</button>
      </form>
    </div>
  `;

  wrap.addEventListener('click', e => {
    if (e.target === wrap) {
      playPop(420);
      closeWaffleAI();
    }
  });

  wrap.querySelector('#waffle-ai-close').addEventListener('click', () => {
    playPop(420);
    closeWaffleAI();
  });

  wrap.querySelector('#waffle-ai-models-btn').addEventListener('click', () => {
    playPop(620);
    closeWaffleAI();
    window.dispatchEvent(new CustomEvent('bite-open-settings', { detail: { section: 'ai' } }));
  });

  window.addEventListener('bite-ai-settings-changed', () => {
    syncComposerState();
  });

  wrap.querySelector('#waffle-ai-web-toggle').addEventListener('click', () => {
    webSearchMode = !webSearchMode;
    if (webSearchMode) imageMode = false;
    playPop(webSearchMode ? 680 : 520);
    syncComposerState();
    wrap.querySelector('#waffle-ai-input').focus();
  });

  wrap.querySelector('#waffle-ai-img-toggle').addEventListener('click', () => {
    imageMode = !imageMode;
    if (imageMode) webSearchMode = false;
    playPop(imageMode ? 680 : 520);
    syncComposerState();
    wrap.querySelector('#waffle-ai-input').focus();
  });

  wrap.querySelector('#waffle-ai-reset').addEventListener('click', () => {
    if (activeAbort) activeAbort.abort();
    isGenerating = false;
    attachments = [];
    messages = [WELCOME_MSG];
    playBoing();
    renderAttachments();
    renderMessages();
    syncComposerState();
    wrap.querySelector('#waffle-ai-input').focus();
  });

  wrap.querySelector('#waffle-ai-stop').addEventListener('click', () => {
    if (activeAbort) activeAbort.abort();
    playPop(380);
  });

  const fileIn = wrap.querySelector('#waffle-ai-file-in');
  wrap.querySelector('#waffle-ai-attach').addEventListener('click', () => fileIn.click());
  fileIn.addEventListener('change', () => {
    if (fileIn.files?.length) handleFilesSelected(fileIn.files);
    fileIn.value = '';
  });

  const dialog = wrap.querySelector('.waffle-ai-dialog');
  dialog.addEventListener('dragover', e => { e.preventDefault(); dialog.classList.add('is-drag'); });
  dialog.addEventListener('dragleave', () => dialog.classList.remove('is-drag'));
  dialog.addEventListener('drop', e => {
    e.preventDefault();
    dialog.classList.remove('is-drag');
    if (e.dataTransfer?.files?.length) handleFilesSelected(e.dataTransfer.files);
  });

  wrap.querySelectorAll('.waffle-starter-chip').forEach(btn => {
    btn.addEventListener('click', () => sendMessage(btn.dataset.prompt));
  });

  const input = wrap.querySelector('#waffle-ai-input');
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input.value);
    }
  });

  wrap.querySelector('#waffle-ai-form').addEventListener('submit', e => {
    e.preventDefault();
    sendMessage(input.value);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlayEl && !overlayEl.hidden) {
      closeWaffleAI();
    }
  });

  document.body.append(wrap);
  return wrap;
}

export function openWaffleAI() {
  if (!overlayEl) overlayEl = buildOverlay();
  overlayEl.hidden = false;
  document.body.classList.add('waffle-modal-open');
  renderAttachments();
  renderMessages();
  syncComposerState();
  fetchStatus();
  detectDeviceDiagnostics().then(d => {
    deviceDiag = d;
    updateStatusBadge();
  }).catch(() => {});
  detectImageCapabilities().then(caps => {
    imageCaps = caps;
    updateStatusBadge();
  }).catch(() => {});
  if (!modelState.loaded && !modelState.loading) warmupWaffleAI();
  setTimeout(() => overlayEl?.querySelector('#waffle-ai-input')?.focus(), 40);
}
