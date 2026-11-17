import { waffleMascotSVG } from './icons-25d.js';
import { playPop, playBoing, playSquish } from './sfx.js';

const STARTER_PROMPTS = [
  'Tell me a crispy waffle joke!',
  'Recommend a fun game in the arcade',
  'Write a tiny JS palindrome checker',
  'Explain black holes simply'
];

const WELCOME_MSG = {
  role: 'assistant',
  content: 'Hey there, kitchen friend! I’m **Sir Waffle**, your **Waffle AI** assistant powered locally by **Qwen 2.5 1.5B** & **node-llama.cpp** (already pre-cached and ready!). Ask me about math, coding, science, writing, arcade games, or anything else!'
};

let overlayEl = null;
let messages = [WELCOME_MSG];
let isGenerating = false;
let activeAbort = null;
let modelState = { preCached: true, loaded: false, loading: false };

const esc = s => String(s).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

function formatWaffleMarkdown(raw) {
  const text = String(raw || '');
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map(part => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const inner = part.slice(3, -3).replace(/^[a-zA-Z0-9_-]+\n/, '');
      return `<pre class="waffle-code-block"><code>${esc(inner)}</code></pre>`;
    }
    let html = esc(part);
    html = html.replace(/`([^`\n]+)`/g, '<code class="waffle-inline-code">$1</code>');
    html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\n/g, '<br>');
    return html;
  }).join('');
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

function renderMessages() {
  if (!overlayEl) return;
  const feed = overlayEl.querySelector('#waffle-ai-feed');
  const starters = overlayEl.querySelector('#waffle-ai-starters');
  if (!feed) return;

  feed.innerHTML = messages.map((m, idx) => {
    const isUser = m.role === 'user';
    const streamingCursor = !isUser && isGenerating && idx === messages.length - 1
      ? '<span class="waffle-cursor" aria-hidden="true">▌</span>'
      : '';
    return `
      <div class="waffle-msg ${isUser ? 'is-user' : 'is-bot'}">
        ${isUser ? '' : `<span class="waffle-msg-avatar" aria-hidden="true">${waffleMascotSVG('waffle-mini-svg')}</span>`}
        <div class="waffle-msg-bubble">
          <div class="waffle-msg-author">${isUser ? 'You' : 'Sir Waffle'}</div>
          <div class="waffle-msg-body">${m.content ? formatWaffleMarkdown(m.content) : '<span class="waffle-thinking">Warming up the waffle iron…</span>'}${streamingCursor}</div>
        </div>
      </div>
    `;
  }).join('');

  if (starters) {
    starters.hidden = messages.length > 1 || isGenerating;
  }
  feed.scrollTop = feed.scrollHeight;
}

function syncComposerState() {
  if (!overlayEl) return;
  const sendBtn = overlayEl.querySelector('#waffle-ai-send');
  const stopBtn = overlayEl.querySelector('#waffle-ai-stop');
  const input = overlayEl.querySelector('#waffle-ai-input');
  if (sendBtn) sendBtn.hidden = isGenerating;
  if (stopBtn) stopBtn.hidden = !isGenerating;
  if (input) input.disabled = false;
  updateStatusBadge();
}

async function sendMessage(rawText) {
  const text = String(rawText || '').trim();
  if (!text || isGenerating) return;

  const input = overlayEl?.querySelector('#waffle-ai-input');
  if (input) input.value = '';

  playPop(580);
  messages.push({ role: 'user', content: text });
  messages.push({ role: 'assistant', content: '' });
  isGenerating = true;
  renderMessages();
  syncComposerState();

  const assistantIdx = messages.length - 1;
  const historyPayload = messages.slice(0, assistantIdx).map(m => ({ role: m.role, content: m.content }));
  activeAbort = new AbortController();

  try {
    const res = await fetch('./api/waffle-ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: historyPayload, stream: true }),
      signal: activeAbort.signal
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

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

        if (evName === 'status' && payload.state === 'generating') {
          modelState.loaded = true;
          updateStatusBadge();
        } else if (evName === 'token' && typeof payload.text === 'string') {
          messages[assistantIdx].content += payload.text;
          renderMessages();
        } else if (evName === 'done') {
          modelState.loaded = true;
          if (typeof payload.text === 'string' && payload.text) {
            messages[assistantIdx].content = payload.text;
          }
        } else if (evName === 'error') {
          throw new Error(payload.error || 'Generation failed');
        }
      }
    }
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

      <form class="waffle-ai-composer" id="waffle-ai-form">
        <textarea id="waffle-ai-input" class="waffle-ai-input" rows="1" placeholder="Ask Sir Waffle anything…" aria-label="Message Waffle AI"></textarea>
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
    messages = [WELCOME_MSG];
    playBoing();
    renderMessages();
    syncComposerState();
    wrap.querySelector('#waffle-ai-input').focus();
  });

  wrap.querySelector('#waffle-ai-stop').addEventListener('click', () => {
    if (activeAbort) activeAbort.abort();
    playPop(380);
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
  renderMessages();
  syncComposerState();
  fetchStatus();
  if (!modelState.loaded && !modelState.loading) warmupWaffleAI();
  setTimeout(() => overlayEl?.querySelector('#waffle-ai-input')?.focus(), 40);
}
