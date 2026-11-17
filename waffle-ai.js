import { waffleMascotSVG } from './icons-25d.js';
import { playPop, playBoing, playSquish } from './sfx.js';
import { createDocxBlob, extractTextFromUpload, triggerFileDownload } from './file-tools-client.js';

const STARTER_PROMPTS = [
  'Make a .docx study guide on photosynthesis',
  'Write a Python binary search with examples',
  'Summarize my uploaded file in bullet points',
  'Tell me a crispy waffle joke in Markdown'
];

const WELCOME_MSG = {
  role: 'assistant',
  content: [
    'Hey there, kitchen friend! I’m **Sir Waffle**, your **Waffle AI** assistant powered locally by **Qwen 2.5 1.5B** & **node-llama.cpp** (pre-cached and ready!).',
    '',
    '- Ask for **Markdown** notes, **live code boxes**, or explanations',
    '- **Attach `.docx`, `.txt`, `.md`, `.csv`, or code files** with the paperclip (or drag & drop!)',
    '- Ask me to **make a `.docx` or any file**, or export any reply below!'
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
  // Inline code first so we don't style inside code spans
  const codeSpans = [];
  s = s.replace(/`([^`\n]+)`/g, (_, inner) => {
    const idx = codeSpans.length;
    codeSpans.push(`<code class="waffle-inline-code">${inner}</code>`);
    return `\u0000CODE${idx}\u0000`;
  });
  // Safe links [label](https://...)
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

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      out.push('<hr class="waffle-md-hr">');
      i++; continue;
    }

    // Headings
    const h = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (h) {
      const lvl = Math.min(h[1].length, 3);
      out.push(`<h${lvl + 2} class="waffle-md-h waffle-md-h${lvl}">${formatInlineMarkdown(h[2])}</h${lvl + 2}>`);
      i++; continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const qLines = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        qLines.push(formatInlineMarkdown(lines[i].trim().replace(/^>\s?/, '')));
        i++;
      }
      out.push(`<blockquote class="waffle-md-quote">${qLines.join('<br>')}</blockquote>`);
      continue;
    }

    // Markdown Table
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

    // Unordered list
    if (/^[-*•]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(`<li>${formatInlineMarkdown(lines[i].trim().replace(/^[-*•]\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ul class="waffle-md-list">${items.join('')}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(`<li>${formatInlineMarkdown(lines[i].trim().replace(/^\d+\.\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ol class="waffle-md-list">${items.join('')}</ol>`);
      continue;
    }

    // Paragraph (collect adjacent plain lines)
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
        <pre class="waffle-code-pre"><code>${esc(seg.code || (streaming ? '' : ''))}</code></pre>
      </div>
    `;
  }).join('');
}

export async function streamWaffleChat({ messages: msgList, systemPrompt, maxTokens = 520, temperature = 0.7, signal, onStatus, onToken }) {
  const res = await fetch('./api/waffle-ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: msgList, systemPrompt, maxTokens, temperature, stream: true }),
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

function updateStatusBadge() {
  if (!overlayEl) return;
  const badge = overlayEl.querySelector('#waffle-ai-badge');
  if (!badge) return;
  if (modelState.error) {
    badge.textContent = `Qwen 2.5 1.5B · ${modelState.error}`;
    badge.className = 'waffle-ai-badge is-warn';
  } else if (isGenerating) {
    badge.textContent = 'Qwen 2.5 1.5B · Thinking…';
    badge.className = 'waffle-ai-badge is-busy';
  } else if (modelState.loaded) {
    badge.textContent = 'Qwen 2.5 1.5B · node-llama.cpp · Ready';
    badge.className = 'waffle-ai-badge is-ready';
  } else {
    badge.textContent = 'Qwen 2.5 1.5B · node-llama.cpp · Pre-cached';
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
    const streamingCursor = streamingNow ? '<span class="waffle-cursor" aria-hidden="true">▌</span>' : '';
    const fileNote = isUser && m.fileNames?.length
      ? `<div class="waffle-msg-files">${m.fileNames.map(n => `<span class="waffle-msg-file-tag">📎 ${esc(n)}</span>`).join('')}</div>`
      : '';
    const bodyHtml = isUser
      ? `<p class="waffle-md-p">${esc(m.displayContent ?? m.content).replace(/\n/g, '<br>')}</p>`
      : (m.content ? formatWaffleMarkdown(m.content, streamingNow) : '<span class="waffle-thinking">Warming up the waffle iron…</span>');
    const exportBar = !isUser && !streamingNow && m.content
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
          <div class="waffle-msg-author">${isUser ? 'You' : 'Sir Waffle'}</div>
          ${fileNote}
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
      await navigator.clipboard?.writeText(art.code).catch(() => {});
      btn.textContent = 'Copied!';
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

  feed.querySelectorAll('[data-copy-msg]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const m = messages[Number(btn.dataset.copyMsg)];
      if (!m) return;
      await navigator.clipboard?.writeText(m.content).catch(() => {});
      btn.textContent = 'Copied!';
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
  if (sendBtn) sendBtn.hidden = isGenerating;
  if (stopBtn) stopBtn.hidden = !isGenerating;
  updateStatusBadge();
}

async function handleFilesSelected(fileList) {
  for (const file of [...fileList].slice(0, 4)) {
    try {
      const extracted = await extractTextFromUpload(file);
      const clipped = extracted.slice(0, 6000);
      attachments.push({ name: file.name, text: clipped });
      playPop(620);
    } catch (err) {
      alert(`Could not read ${file.name}: ${err.message}`);
    }
  }
  renderAttachments();
}

async function sendMessage(rawText) {
  const text = String(rawText || '').trim();
  if ((!text && !attachments.length) || isGenerating) return;

  const input = overlayEl?.querySelector('#waffle-ai-input');
  if (input) input.value = '';

  const currentFiles = attachments.splice(0);
  renderAttachments();

  const fileNames = currentFiles.map(f => f.name);
  const fileContext = currentFiles.map(f => `[Attached File: ${f.name}]\n${f.text}`).join('\n\n');
  const promptText = [fileContext, text || 'Please analyze the attached file(s).'].filter(Boolean).join('\n\n');

  playPop(580);
  messages.push({
    role: 'user',
    displayContent: text || `Analyze ${fileNames.join(', ')}`,
    fileNames,
    content: promptText
  });
  messages.push({ role: 'assistant', content: '' });
  isGenerating = true;
  renderMessages();
  syncComposerState();

  const assistantIdx = messages.length - 1;
  const historyPayload = messages.slice(0, assistantIdx).map(m => ({ role: m.role, content: m.content }));
  activeAbort = new AbortController();

  try {
    const finalText = await streamWaffleChat({
      messages: historyPayload,
      maxTokens: 680,
      temperature: 0.7,
      signal: activeAbort.signal,
      onStatus(payload) {
        if (payload.state === 'generating') {
          modelState.loaded = true;
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
            <button type="button" class="gbtn waffle-reset-btn" id="waffle-ai-reset" title="Start a fresh chat">New Chat</button>
            <button type="button" class="window-close-x" id="waffle-ai-close" aria-label="Close Waffle AI">✕</button>
          </div>
        </div>
      </div>

      <div class="waffle-ai-feed" id="waffle-ai-feed" aria-live="polite"></div>

      <div class="waffle-ai-starters" id="waffle-ai-starters">
        ${STARTER_PROMPTS.map(p => `<button type="button" class="gbtn waffle-starter-chip" data-prompt="${esc(p)}">${esc(p)}</button>`).join('')}
      </div>

      <div class="waffle-ai-files" id="waffle-ai-files" hidden></div>

      <form class="waffle-ai-composer" id="waffle-ai-form">
        <input type="file" id="waffle-ai-file-in" multiple accept=".txt,.md,.csv,.json,.js,.ts,.py,.html,.css,.xml,.yaml,.yml,.docx,.pdf,.log,.sql" hidden>
        <button type="button" class="gbtn waffle-attach-btn" id="waffle-ai-attach" title="Attach .docx, .txt, .md, .csv, or code file">📎</button>
        <textarea id="waffle-ai-input" class="waffle-ai-input" rows="1" placeholder="Ask Sir Waffle or drop a file…" aria-label="Message Waffle AI"></textarea>
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
  if (!modelState.loaded && !modelState.loading) warmupWaffleAI();
  setTimeout(() => overlayEl?.querySelector('#waffle-ai-input')?.focus(), 40);
}
