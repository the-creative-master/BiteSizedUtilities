import { backupDoorMatches, openBackupKitchenDoor, BACKUP_DOOR_FILE } from './backup-door.js';
import { appVersionLabel } from './changelog.js';
import { buildWaffleSystemPrompt, stripModelScaffolding } from './waffle-persona.js';
import { waffleMascotSVG } from './icons-25d.js';
import { playPop, playBoing, playSquish, playSparkle } from './sfx.js';
import { copyToClipboard } from './ui-kit.js';
import { createDocxBlob, extractFilePayload, triggerFileDownload } from './file-tools-client.js';
import {
  openChatStore, createChatStore, makeThread, titleFrom, UNTITLED, MAX_THREADS, parseExport, importThreads
} from './waffle-chat-store.js';
import {
  TEXT_MODELS,
  DEFAULT_TEXT_MODEL_ID,
  streamBrowserChat,
  streamWllamaChat,
  getSelectedTextModel,
  getSelectedImageModel,
  getSelectedExecutionMode,
  getSmartPromptEnabled,
  getAiTemperature,
  detectDeviceDiagnostics,
  rankBrowserAttempts,
  OS_CHOICES,
  getDeclaredOS,
  setDeclaredOS,
  clearDeclaredOS,
  AI_DISCLAIMER_TEXT,
  AI_WARNING_SHORT,
  classifyAiFailure,
  summarizeAiFailures,
  fetchModelSourceFacts,
  describeModelSourceFacts,
  modelSourceFixAdvice,
  reconcileAiFailureWithFacts,
  HF_DIAG_TIMEOUT_MS,
  runBrowserInference,
  markInferenceBeat,
  markInferenceToken
} from './waffle-browser-ai.js';
import {
  IMAGE_MODELS,
  resolveImageModel,
  isRetiredImageModel,
  detectImageCapabilities,
  generateWaffleImage,
  imageCacheInfo,
  clearImageModelCache,
  humanDuration,
  screenLockState,
  isImageGenPaused,
  IMAGE_GEN_PAUSE_MESSAGE
} from './waffle-image-gen.js';

const STARTER_PROMPTS = [
  '/imagine a cozy golden waffle bakery at sunrise',
  'Make a .docx study guide on photosynthesis',
  'Write a Python binary search with examples',
  'Summarize my uploaded file in bullet points'
];

const WELCOME_MSG = {
  role: 'assistant',
  isWelcome: true,
  // Slimmed in 1.3 TVBR 2. This bubble used to open the conversation with a
  // nine-model menu, a list of attachable file types and the whole 887-character
  // device disclaimer — several screens to scroll past before the first question,
  // and the model names went stale with every release. The menu lives in Settings,
  // the disclaimer lives behind the device pill, and this is a greeting again.
  content: [
    'Hey there, kitchen friend! I’m **Sir Waffle**, your **Waffle AI** assistant.',
    '',
    'Ask me anything, attach a file, `/search` the web, or `/imagine` a picture. Models and fallbacks are in ⚙ **Settings**, and the device pill in the header says what this hardware can run.'
  ].join('\n')
};

const LANG_EXT = {
  python: 'py', py: 'py', javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts',
  html: 'html', css: 'css', json: 'json', sql: 'sql', bash: 'sh', sh: 'sh',
  markdown: 'md', md: 'md', csv: 'csv', yaml: 'yml', yml: 'yml', xml: 'xml',
  ruby: 'rb', php: 'php', rust: 'rs', go: 'go', java: 'java', cpp: 'cpp', c: 'c'
};

let overlayEl = null;
let lockedEl = null;
let messages = [WELCOME_MSG];
let attachments = [];
let isGenerating = false;
let activeAbort = null;
/** One-second redraw of the image run's elapsed clock. See `runImageGeneration`. */
let progressTicker = null;
let modelState = { preCached: false, loaded: false, loading: false, serverReachable: null, available: [] };

/**
 * A conversation is no longer just a variable that dies with the tab.
 * `chatThread` is the one being edited right now, `chatThreads` is the rail's
 * view of everything kept, `chatStore` is whichever storage the browser
 * allowed us (IndexedDB, localStorage, or plain memory), and `chatSaving` is
 * what the header pill reports — because a chat that failed to save must not
 * look like one that saved.
 */
let chatStore = null;
let chatThread = null;
let chatThreads = [];
let chatSaving = 'idle';
let railOpen = false;
let persistTimer = 0;

/**
 * The local llama.cpp server only hosts the models in SERVER_MODELS, so when a
 * browser-only model is selected and the chain wants a server attempt, this is
 * what it asks for. Named once because the swap is worth being explicit about:
 * `report()` flags it via `swapped`, so a reply can say which model answered.
 */
const SERVER_FALLBACK_ID = 'qwen2.5-1.5b';
let codeArtifacts = [];
/**
 * Where each rendered bubble's artifacts begin in `codeArtifacts`, by message
 * index. The markdown formatter numbers a code box by its position in the whole
 * thread, so a paint that rebuilds one bubble on its own can only keep the
 * buttons in every *earlier* bubble pointing at the right entry if it knows
 * where the tail it is allowed to replace begins.
 */
let feedArtifactBase = [];
let imageMode = false;
let webSearchMode = false;
let imageCaps = { hasWebGPU: false, hasF16: false, mode: '', threads: 1, quotaOK: null };
let deviceDiag = { hasWebGPU: false, isOldIOS: false, hasRisk: true, summaryLabel: 'Checking device…' };

/**
 * Waffle AI is paused in the public build.
 *
 * Open-source models in the browser turned into an endless stream of device,
 * driver, memory and runtime bugs: models that download perfectly and then
 * refuse to build a session, WebGPU adapters that abort the whole runtime,
 * hosts with no cross-origin isolation. Rather than ship a feature that works
 * on one machine in ten, every AI surface is switched off behind this one flag
 * — the Sir Waffle chat, CodeHub's AI Error Diagnostics, and the AI writing
 * helpers in English & Languages. Nothing half-works and nothing quietly
 * guesses.
 *
 * `backup.html` puts `data-backup="1"` on <html>, which turns all of it back on.
 * The gate is deliberately page-scoped rather than a stored preference, so the
 * public kitchen can never leak AI back in from a stale localStorage value.
 * Nothing in the public UI advertises that page or how to reach it.
 */
export const WAFFLE_AI_LOCK_MESSAGE = 'I apologize for the inconvenience but WaffleAI isn\u2019t available due to countless bugs with open-source AI models. We will make it available in a later update.';

// The page-scoped build flag lives in build-mode.js so the changelog and the
// art studio can read it without importing the AI stack. Imported *and*
// re-exported: `export ... from` alone would leave the name unbound in this
// module, and isWaffleAiLocked() below reads it.
import { isBackupBuild } from './build-mode.js';
export { isBackupBuild };

/**
 * 1.2 put Waffle AI back in the main kitchen. The pause was never about the
 * feature being unwanted: it was about the runtimes underneath it claiming
 * devices they could not run on, and that is the part the diagnostics, the
 * stall watchdog and the honest failure reports have now fixed.
 *
 * The backup kitchen stays, and stays different — same tools, test switches on,
 * which is where new AI behaviour gets tried before it lands here. Every locked
 * surface still reads this one function, so a future release can pause the
 * feature again by changing one line rather than hunting for the places.
 */
export function isWaffleAiLocked() {
  return false;
}

/**
 * Whether this kitchen keeps conversations.
 *
 * It used to read `isBackupBuild()`, which gave the public kitchen a single pane
 * and one unsaved conversation that died with the tab, while the backup kitchen
 * had the two-pane panel: a rail of saved threads, export and import, and a
 * conversation you could come back to. That asymmetry was the whole difference
 * between the two AI surfaces, and it was not a difference anybody outside the
 * test kitchen could act on.
 *
 * One function, read by both the markup and the store, so the two cannot
 * disagree about which kitchen they are in — a rail that renders with no store
 * behind it, or a store writing chats nobody can open, would each be worse than
 * neither. That is the same discipline the image pause and the AI lock use.
 *
 * Deliberately *not* the model menu. `offeredModelIds()` in waffle-browser-ai.js
 * still reads the build flag on its own, so the four models above 1.7B stay in
 * the test kitchen where their repository paths can be checked before anybody is
 * asked to download them. Bringing the rail over does not bring them with it,
 * and a test asserts the two flags did not get merged.
 *
 * Everything saved stays on the device: the store is IndexedDB with a
 * localStorage fallback, and nothing is uploaded anywhere.
 */
export function keepsChatHistory() {
  return true;
}

/** Thrown by every AI entry point while paused, so callers can tell "locked" apart from "failed". */
/**
 * Thrown for a model the table reserves but the kitchen cannot fetch yet.
 *
 * `arrivesIn` on a TEXT_MODELS entry is what marks one, and there is exactly one
 * today: Granite Code 0.5B, which CodeHub's AI Error Helper is pinned to and
 * which IBM's weights have not reached the kitchen for. A caller can catch this
 * by name and say "not yet" in its own words; everything else about the failure
 * machinery — the classifier, the source report, the retry chain — is for models
 * that exist and did not load, and running it here would report a 404 from a repo
 * nobody has as though the kitchen had broken something.
 */
export class WaffleModelPendingError extends Error {
  constructor(cfg) {
    super(`${cfg?.label || 'That model'} is not in the kitchen yet — it arrives in ${cfg?.arrivesIn || 'a later update'}.`);
    this.name = 'WaffleModelPending';
    this.modelId = cfg?.id || null;
    this.label = cfg?.label || null;
    this.arrivesIn = cfg?.arrivesIn || 'a later update';
  }
}

/** The notice a surface shows for a model that has been promised, not shipped. */
export function waffleModelPendingNoticeHTML(cfg) {
  const label = esc(cfg?.label || 'That model');
  const when = esc(cfg?.arrivesIn || 'a later update');
  return `
    <div class="waffle-ai-locked-note">
      <span class="waffle-ai-locked-icon" aria-hidden="true">🕒</span>
      <p class="waffle-ai-locked-copy">${label} arrives in ${when}. Nothing else is substituted for it, so there is no answer here yet.</p>
    </div>`;
}

export class WaffleAiLockedError extends Error {
  constructor(message = WAFFLE_AI_LOCK_MESSAGE) {
    super(message);
    this.name = 'WaffleAiLocked';
  }
}

/** The one notice every locked AI surface shows. */
export function waffleAiLockedNoticeHTML() {
  return `
    <div class="waffle-ai-locked-note">
      <span class="waffle-ai-locked-icon" aria-hidden="true">🔒</span>
      <p class="waffle-ai-locked-copy">${esc(WAFFLE_AI_LOCK_MESSAGE)}</p>
    </div>
  `;
}

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
        // The server streams raw chunks, so the cleaning happens here: the second
        // argument is what gets rendered, and it is the accumulated text with the
        // scaffolding taken off, exactly like the in-browser engines hand over.
        onToken?.(payload.text, stripModelScaffolding(finalText, { streaming: true }));
      } else if (evName === 'done' && typeof payload.text === 'string') {
        finalText = payload.text || finalText;
      } else if (evName === 'error') {
        throw new Error(payload.error || 'Generation failed');
      }
    }
  }
  return stripModelScaffolding(finalText).trim();
}

/**
 * The extended half of an AI failure: what the *source* really looks like,
 * fetched live from Hugging Face and from this host while the visitor waits.
 *
 * The engine errors above it can only say "Failed to fetch" or "out of memory".
 * The facts that decide whether those are a network problem, a renamed repo, a
 * gated licence, a quantization nobody publishes, or a model table whose size
 * guess is wrong all live one API call away, so a failure now goes and gets
 * them and prints them under the error. Bounded and swallowed whole: a
 * diagnostic that hangs or throws must never replace the failure it explains.
 */
/**
 * Facts first, prose second — because the facts also get to overrule the
 * headline the engines produced. Never throws: a diagnostic that fails must not
 * take the error it was called to explain down with it.
 */
async function modelSourceFactsFor(cfg, signal) {
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
    if (!cfg?.hfGgufRepo && !cfg?.hfId) return null;
    return await fetchModelSourceFacts(cfg, { signal, timeoutMs: HF_DIAG_TIMEOUT_MS });
  } catch {
    return null;
  }
}

function renderModelSourceReport(facts, classified) {
  if (!facts) return '';
  const lines = describeModelSourceFacts(facts);
  if (!lines.length) return '';
  const fix = modelSourceFixAdvice(facts, classified);
  const stamp = new Date(facts.fetchedAt);
  const when = Number.isNaN(stamp.getTime()) ? 'just now' : stamp.toUTCString().replace('GMT', 'UTC');
  return `\n\n**Where this model was supposed to come from** (checked live against Hugging Face, ${when}):\n` +
    lines.map(l => `- ${l}`).join('\n') +
    (fix ? `\n- **Fix:** ${fix}` : '');
}

export async function streamWaffleChat({ modelId, messages: msgList, imageUrls = [], systemPrompt, maxTokens = 520, temperature = 0.7, signal, onStatus, onToken, onRuntime }) {
  // One gate for every caller: the Sir Waffle chat, CodeHub's AI Error
  // Diagnostics and the English tools' AI writing all come through here, so
  // pausing the feature cannot leave a tool half-working.
  if (isWaffleAiLocked()) throw new WaffleAiLockedError();
  const chosenId = modelId || getSelectedTextModel();
  const cfg = TEXT_MODELS.find(m => m.id === chosenId) || TEXT_MODELS[0];
  // Reserved but not shipped. Checked before a single probe runs: there is no
  // device fact, no repo and no runtime that changes the answer.
  if (cfg.arrivesIn) throw new WaffleModelPendingError(cfg);
  const mode = getSelectedExecutionMode();
  const diag = await detectDeviceDiagnostics().catch(() => ({
    hasWebGPU: false, wllamaGpuSafe: false, wasmBudgetBytes: 0, canThread: false,
    gpuPreferred: true, webnnUsable: false, hasWebNN: false, hasWasmSimd: true,
    platform: null, platformLabel: '', deviceNote: '', npuNote: ''
  }));
  const hasImages = Array.isArray(imageUrls) && imageUrls.length > 0;
  const serverInfo = modelState.available?.find(a => a.id === cfg.id);
  const canTryServer = modelState.serverReachable !== false && (serverInfo ? serverInfo.preCached !== false : true);

  // What this device can actually hold. A static host (GitHub Pages) has no
  // llama.cpp server and no COOP/COEP, so everything below runs in one
  // single-threaded WASM heap unless the GPU can take the weights.
  const budgetBytes = diag.wasmBudgetBytes || 0;
  const estBytes = (cfg.ggufMB || 0) * 1024 ** 2;
  const fitsOnCpu = !estBytes || !budgetBytes || estBytes <= budgetBytes;
  const gpuOk = Boolean(diag.hasWebGPU);
  // llama.cpp's WebGPU backend aborts the whole module without shader-f16
  // (ngxson/wllama#241), so WLlama only gets GPU layers when it is safe.
  const wllamaGpuOk = Boolean(diag.wllamaGpuSafe);
  // gpuOk stays "an adapter exists", which is what the ONNX WebGPU path needs.
  // The chat's weights, though, go wherever WLlama can put them, and a verified
  // adapter with no FP16 is a GPU that cannot take them. Reading gpuOk as that
  // fact is what suppressed the warning below and left a model that could not
  // fit hanging with nothing on screen to explain it.
  const gpuHoldsWeights = wllamaGpuOk;

  // Build ordered automatic fallback chain preserving the selected model (never swap models unless images require Vision)
  const attempts = [];
  const pushBrowser = (dev, id = cfg.id) => {
    const m = TEXT_MODELS.find(x => x.id === id);
    if (!m?.hfId) return;
    // CPU ONNX keeps the whole model inside the wasm heap with no mmap, so it
    // is the first thing to drop for a model that cannot fit this device.
    if (dev === 'wasm' && !fitsOnCpu && !gpuOk) return;
    attempts.push({ kind: 'browser', id: m.id, dev, label: m.label });
  };
  const pushWllama = (webgpu, m = cfg) => {
    if (webgpu && !wllamaGpuOk) return;
    // Never invent a filename: a guessed GGUF name would quietly run a
    // different model than the one the user picked.
    if (!m.hfGgufRepo && !m.ggufFile) return;
    // ggufQuants travels with the attempt: the range is a property of the model,
    // and the loader that resolves the file is three modules away from the table.
    attempts.push({ kind: 'wllama', gguf: m.ggufFile, hfRepo: m.hfGgufRepo, hfQuant: m.hfGgufQuant, ggufQuants: m.ggufQuants || null, webgpu, label: m.label });
  };
  const pushServer = (id = cfg.kind === 'server' ? cfg.id : SERVER_FALLBACK_ID) => {
    attempts.push({ kind: 'server', id, label: cfg.label });
  };
  const pushChromiumSafetyNet = () => {
    // The last resort follows the starting model rather than naming one. It used
    // to be hardcoded to SmolLM2 135M, which 1.2.6 took off the menu: a safety
    // net pointing at a model nobody can select, and that a deploy no longer
    // pre-caches, is a net with a hole in it — the rescue would have depended on
    // reaching Hugging Face too, which is the thing that just failed.
    const tiny = TEXT_MODELS.find(x => x.id === DEFAULT_TEXT_MODEL_ID);
    if (!tiny || cfg.id === tiny.id) return;
    pushWllama(false, tiny);
    pushBrowser('wasm', tiny.id);
  };
  // Which browser runtime to try first is a question about the device, not
  // about the model: GPU-first is right when WebGPU is verified, and wrong on a
  // HarmonyOS or Android Chromium below 144, where an adapter can be handed back
  // that then hangs the tab instead of answering. `rankBrowserAttempts` holds
  // that rule, and it puts an NPU first on the rare browser that exposes WebNN.
  const pushBrowserChain = (opts = {}) => {
    for (const step of rankBrowserAttempts(diag, opts)) {
      if (step === 'onnx-npu') pushBrowser('webnn-npu');
      else if (step === 'onnx-webgpu') pushBrowser('webgpu');
      else if (step === 'wllama-gpu') pushWllama(true);
      else if (step === 'wllama-cpu') pushWllama(false);
      else if (step === 'onnx-wasm') pushBrowser('wasm');
    }
  };

  if (hasImages) {
    // Images MUST go to multimodal Vision (Qwen 3.5 0.8B) — never fall back to blind text-only models
    if (diag.webnnUsable) attempts.push({ kind: 'browser', id: 'qwen3.5-0.8b', dev: 'webnn-npu', vision: true });
    if (gpuOk && diag.gpuPreferred !== false) attempts.push({ kind: 'browser', id: 'qwen3.5-0.8b', dev: 'webgpu', vision: true });
    attempts.push({ kind: 'browser', id: 'qwen3.5-0.8b', dev: 'wasm', vision: true });
    if (gpuOk && diag.gpuPreferred === false) attempts.push({ kind: 'browser', id: 'qwen3.5-0.8b', dev: 'webgpu', vision: true });
  } else if (mode === 'server') {
    if (canTryServer) pushServer(cfg.kind === 'server' ? cfg.id : SERVER_FALLBACK_ID);
    pushBrowserChain();
    pushChromiumSafetyNet();
  } else if (mode === 'webgpu') {
    pushBrowserChain({ gpuFirst: true });
    if (canTryServer) pushServer();
    pushChromiumSafetyNet();
  } else if (mode === 'wllama') {
    pushWllama(true);
    pushWllama(false);
    if (gpuOk && diag.gpuPreferred !== false) pushBrowser('webgpu');
    pushBrowser('wasm');
    if (gpuOk && diag.gpuPreferred === false) pushBrowser('webgpu');
    if (canTryServer) pushServer();
    pushChromiumSafetyNet();
  } else if (mode === 'wasm') {
    pushWllama(false);
    pushBrowser('wasm');
    if (canTryServer) pushServer();
    pushChromiumSafetyNet();
  } else {
    // Auto fallback chain — always try the user's chosen model on its best available runtime first
    if (cfg.kind === 'server' && canTryServer) {
      pushServer(cfg.id);
      pushBrowserChain();
      pushChromiumSafetyNet();
    } else if (cfg.kind === 'server') {
      pushBrowserChain();
      if (canTryServer) pushServer(cfg.id);
      pushChromiumSafetyNet();
    } else {
      pushBrowserChain();
      if (canTryServer) pushServer(SERVER_FALLBACK_ID);
      pushChromiumSafetyNet();
    }
  }

  if (!fitsOnCpu && !gpuHoldsWeights && !hasImages) {
    // Both numbers, and the reason the second one is not bigger. A GPU the
    // visitor can see listed in their own device report and still cannot use
    // is the confusing case, so it is named rather than left to be inferred
    // from a budget that looks too small for no stated reason.
    const whyNoGpu = gpuOk
      ? ', and its GPU cannot take the weights because llama.cpp needs FP16 and this browser does not expose it through WebGPU'
      : ' without WebGPU';
    onStatus?.({
      state: 'loading',
      detail: `${cfg.label} is ~${Math.round(estBytes / 1024 ** 2)} MB but this device can only hold ~${Math.round(budgetBytes / 1024 ** 2)} MB in its WASM heap${whyNoGpu} — trying a smaller quant…`
    });
  }

  const failures = [];
  const report = (step, engine, text) => {
    const answeredBy = step.id || cfg.id;
    onRuntime?.({
      modelId: answeredBy,
      label: step.label || cfg.label,
      engine,
      device: step.dev || (step.webgpu ? 'webgpu' : step.kind === 'wllama' ? 'wasm' : 'server'),
      swapped: answeredBy !== cfg.id,
      requested: cfg.label,
      failures
    });
    return text;
  };

  for (let i = 0; i < attempts.length; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const step = attempts[i];
    const stepName = step.label || cfg.label;
    const stepLabel = step.kind === 'wllama'
      ? `${stepName} WLlama (${step.webgpu ? 'WebGPU' : 'CPU WASM'})`
      : step.kind === 'browser'
        ? `${stepName} ONNX (${step.dev.toUpperCase()})`
        : 'Server llama.cpp';
    if (i > 0) {
      onStatus?.({ state: 'loading', detail: `Switching to ${stepLabel}…` });
    }
    // One inference at a time, and none of them allowed to go quiet forever.
    // Every status and token also feeds the watchdog, so "still downloading"
    // and "still writing" both count as alive.
    const beatStatus = payload => { markInferenceBeat(); onStatus?.(payload); };
    const beatToken = (chunk, acc) => { markInferenceToken(); onToken?.(chunk, acc); };
    const engineName = step.kind === 'server' ? 'node-llama.cpp' : step.kind === 'wllama' ? 'WLlama' : 'ONNX Runtime Web';
    try {
      const text = await runBrowserInference(stepLabel, () => {
        if (step.kind === 'server') {
          return streamServerChat({ modelId: step.id, messages: msgList, systemPrompt, maxTokens, temperature, signal, onStatus: beatStatus, onToken: beatToken });
        }
        if (step.kind === 'wllama') {
          return streamWllamaChat({ ggufFile: step.gguf, hfRepo: step.hfRepo, hfQuant: step.hfQuant, ggufQuants: step.ggufQuants, messages: msgList, systemPrompt, maxTokens, temperature, useWebGPU: step.webgpu, signal, onStatus: beatStatus, onToken: beatToken });
        }
        return streamBrowserChat({ modelId: step.id, messages: msgList, imageUrls: step.vision ? imageUrls : [], systemPrompt, maxTokens, temperature, preferredDevice: step.dev, signal, onStatus: beatStatus, onToken: beatToken });
      }, { kind: step.kind, signal });
      return report(step, engineName, text);
    } catch (err) {
      if (err.name === 'AbortError' || signal?.aborted) throw err;
      failures.push({
        step: stepLabel,
        message: String(err?.message || err).slice(0, 300),
        cls: classifyAiFailure(err)
      });
    }
  }
  if (hasImages) {
    throw new Error(`Image vision requires Qwen 3.5 0.8B Vision in the browser (${failures.at(-1)?.message || 'vision model unavailable'}). Text-only fallback is disabled for images so the AI won’t guess.`);
  }

  // Lead with the *cause*. A chain where all six runtimes died with the same
  // "Failed to fetch" is one network problem, not six model problems, and the
  // old wording buried that under a list of engine names.
  const headline = summarizeAiFailures(failures.map(f => f.cls).filter(Boolean));
  const isHostProblem = headline && (headline.kind === 'network' || headline.kind === 'offline');
  // Only mention device/server limits when the device is actually the problem.
  const diagHint = !isHostProblem && !gpuOk && !canTryServer
    ? ' This host has no local llama.cpp server and this browser has no usable WebGPU, so only small CPU models can run — pre-cache one in Settings → AI Models.'
    : '';

  // Ask the real source what it has, so the failure carries evidence and not
  // only engine names. Skipped when the device is offline: there is nothing to
  // ask, and the attempt would only add a second confusing network error.
  const facts = headline?.kind === 'offline' ? null : await modelSourceFactsFor(cfg, signal);
  // Five engines reporting "Failed to fetch" is not evidence that the network is
  // down when the host answered their metadata calls with HTTP 200 and only the
  // file download failed. The facts get the last word on the headline.
  const cause = reconcileAiFailureWithFacts(headline, facts);
  const sourceReport = renderModelSourceReport(facts, cause);

  if (cause) {
    const detail = cause.uniform
      ? `All ${cause.count} runtimes failed the same way.`
      : `${cause.count} runtimes failed, with different causes.`;
    throw new Error(
      `${cause.title}. ${cause.hint}\n\n${detail}\n\n${failures.map(f => `• ${f.step} → ${f.message}`).join('\n')}${sourceReport}`
    );
  }
  throw new Error(`Could not run ${cfg.label}.${diagHint}${sourceReport}`);
}

async function fetchStatus() {
  // While paused there is nothing to report, and probing the API on a static
  // host only produces a confusing 404/501 in the network log.
  if (isWaffleAiLocked()) return;
  try {
    const r = await fetch('./api/waffle-ai/status', { cache: 'no-store' });
    const ct = r.headers.get('content-type') || '';
    if (r.ok && ct.includes('application/json')) {
      const data = await r.json();
      modelState = { ...data, serverReachable: true };
    } else {
      modelState = { preCached: false, loaded: false, loading: false, serverReachable: false, available: [] };
    }
  } catch {
    modelState = { preCached: false, loaded: false, loading: false, serverReachable: false, available: [] };
  }
  updateStatusBadge();
}

export async function warmupWaffleAI() {
  // No background AI work while the feature is paused.
  if (isWaffleAiLocked()) return;
  // A static host (GitHub Pages) has no llama.cpp server, so this POST is a
  // guaranteed failure on every page load for every visitor. The status probe is
  // answered locally by the service worker, so check reachability through that
  // first and skip the warmup entirely when there is nothing to warm.
  if (modelState.serverReachable === null) await fetchStatus();
  if (modelState.serverReachable === false) return;
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
  // resolveImageModel, not a bare find: a saved selection can still name one of
  // the two Stable Diffusion checkpoints this kitchen shipped before 1.3 TVBR 2,
  // and that engine no longer exists. They land on the recommended model instead
  // of on `undefined` and a crash at generation time.
  return resolveImageModel(getSelectedImageModel());
}

/**
 * What a generated picture is captioned with.
 *
 * A thread saved before 1.3 TVBR 2 can still hold a picture from the old engine,
 * whose model id is retired. Naming it after the model that ships now would be a
 * lie about how it was made, so a retired id keeps the name it was generated
 * under and everything else is looked up.
 */
function imageModelLabel(r) {
  if (r?.modelName) return r.modelName;
  const id = r?.model || '';
  if (isRetiredImageModel(id)) return id === 'sd-turbo' ? 'SD-Turbo (retired engine)' : 'SDXS-512 (retired engine)';
  return resolveImageModel(id).name;
}

/**
 * Asked once per *release*, not once ever — and the stamp is the version.
 *
 * It used to be suppressed by having an answer at all, which meant anybody who
 * answered under 1.1.1 never saw the question again. That is exactly wrong for
 * 1.2: the answer now does something it did not do before (a HarmonyOS answer
 * puts the GPU first instead of last), and the window that asks it moved out of
 * the chat into its own dialog. So a release that changes what the answer means
 * asks once more, with the previous answer marked and one tap from being kept.
 *
 * The stamp is `appVersionLabel()` rather than the release number, so a test
 * build and the release it was built from each ask once: they are different
 * builds asking about different behaviour, and 1.2 TVAR 1 changes what an answer
 * decides just as much as 1.2 did.
 */
const KEY_OS_ASKED = 'waffle-ai-os-asked';

function osAskedThisRelease() {
  try { return localStorage.getItem(KEY_OS_ASKED) === appVersionLabel(); } catch { return false; }
}

function markOsAsked() {
  try { localStorage.setItem(KEY_OS_ASKED, appVersionLabel()); } catch {}
}

// Set while the question is open because somebody asked for it back from the
// device pill. Without it the next status update would re-render the question,
// see an answer already stored, and close the window the visitor just opened.
let osAskReopened = false;

/**
 * Ask which device this is, in its own window, until it has been answered.
 * Detection fills in the version and the capabilities, but a browser can hide or
 * rewrite its agent, and on HarmonyOS it often does; being told outranks
 * guessing, and the answer is what decides which runtimes get tried.
 *
 * It used to be a strip inside the chat dialog, which made the dialog a
 * different height on every device that had not answered yet — a window that
 * changes shape while a model is loading. As a modal the chat keeps its shape
 * and the question sits on top of it.
 */
function renderOsAsk() {
  if (!overlayEl) return;
  const box = overlayEl.querySelector('#waffle-ai-os-ask');
  const choices = overlayEl.querySelector('#waffle-ai-os-choices');
  if (!box || !choices) return;
  if (osAskReopened) return;
  const declared = getDeclaredOS();
  if (osAskedThisRelease()) {
    box.hidden = true;
    return;
  }
  box.hidden = false;

  const answered = () => {
    osAskReopened = false;
    markOsAsked();
    box.hidden = true;
    detectDeviceDiagnostics().then(d => { deviceDiag = d; updateStatusBadge(); }).catch(() => {});
  };

  choices.innerHTML = OS_CHOICES.map(c =>
    `<button type="button" class="gbtn waffle-os-btn${c.id === declared ? ' is-current' : ''}" data-os="${c.id}"${c.id === declared ? ' aria-pressed="true"' : ''}>${esc(c.label)}</button>`
  ).join('') + '<button type="button" class="gbtn waffle-mini-btn" id="waffle-os-skip">Let it detect</button>';
  choices.querySelectorAll('[data-os]').forEach(btn => {
    btn.addEventListener('click', () => {
      playPop?.(620);
      setDeclaredOS(btn.dataset.os);
      answered();
    });
  });
  // "Let it detect", the ✕ and the backdrop all mean the same thing: go with
  // what detection found, and stop asking.
  const detect = () => { playPop?.(420); clearDeclaredOS(); answered(); };
  choices.querySelector('#waffle-os-skip')?.addEventListener('click', detect);
  box.querySelector('#waffle-os-close')?.addEventListener('click', detect);
  box.addEventListener('click', e => { if (e.target === box) detect(); });
}

/**
 * The device popup: what the pill opens.
 *
 * The header used to print the whole 887-character disclaimer inline on every
 * visit. It is unchanged and in here instead, next to the two things that make it
 * concrete — the profile this device was recognised as, and the hardware facts the
 * runtime choices are made from. A short warning stays on screen; the detail is one
 * tap away and is not repeated in four places at once.
 */
function openDeviceModal() {
  if (!overlayEl) return;
  const box = overlayEl.querySelector('#waffle-ai-device-modal');
  if (!box) return;
  box.hidden = false;
  if (!box.dataset.wired) {
    box.dataset.wired = '1';
    const close = () => { playPop?.(420); box.hidden = true; };
    box.querySelector('#waffle-device-modal-close')?.addEventListener('click', close);
    box.addEventListener('click', e => { if (e.target === box) close(); });
    // The device question is reachable from here, and the two are both overlays —
    // so this one steps aside instead of stacking on top of the other.
    box.querySelector('#waffle-ai-device-os-ask')?.addEventListener('click', () => {
      box.hidden = true;
      reopenOsAsk();
    });
  }
  renderDeviceFacts();
  box.querySelector('#waffle-device-modal-close')?.focus();
}

/**
 * The hardware the runtimes are chosen from, in the same words Settings uses. A
 * skipped model or a refused image generation should be explainable from here
 * rather than looking like a random failure.
 */
function renderDeviceFacts() {
  if (!overlayEl) return;
  const factsEl = overlayEl.querySelector('#waffle-ai-device-facts');
  if (!factsEl) return;
  const d = deviceDiag || {};
  const gb = n => `${(n / 1024 ** 3).toFixed(1)} GB`;
  const bits = [
    `${d.cores || '?'} cores`,
    d.deviceMemoryGB ? `${d.deviceMemoryGB} GB RAM` : 'RAM unknown',
    `wasm budget ${gb(d.wasmBudgetBytes || 0)}`,
    d.hasOPFS ? 'OPFS ok' : 'no OPFS (pre-cache unavailable)',
    d.storageQuotaMB ? `storage ${Math.round((d.storageUsageMB || 0) / 1024)} / ${Math.round(d.storageQuotaMB / 1024)} GB used` : null,
    d.wllamaGpuSafe ? 'llama.cpp WebGPU safe' : 'llama.cpp WebGPU blocked (this browser exposes no FP16) → CPU',
    d.adapterFactLine || null,
    d.canThread ? 'multi-thread ok' : 'single-thread (no COOP/COEP on static hosts)',
    imageCaps.hasWebGPU
      ? `image model: WebGPU ok${imageCaps.hasF16 ? ' · fp16' : ''} · ${imageCaps.mode} build`
      : 'image model: no WebGPU here, so /imagine cannot run',
    // Whether a long run can be protected at all on this browser. Where it cannot,
    // the fact belongs here rather than in a failure message after the fact.
    screenLockState().supported
      ? 'screen lock: held while a picture generates'
      : 'screen lock: not available in this browser, so a hidden tab can be paused mid-run'
  ].filter(Boolean);
  factsEl.textContent = bits.join(' · ');
  factsEl.hidden = false;
}

/**
 * The door back to the question: the device pill in the header. Reopening shows
 * the current answer marked, so "HarmonyOS" can be corrected rather than only
 * cleared.
 */
function reopenOsAsk() {
  if (!overlayEl) return;
  const box = overlayEl.querySelector('#waffle-ai-os-ask');
  const choices = overlayEl.querySelector('#waffle-ai-os-choices');
  if (!box || !choices) return;
  osAskReopened = true;
  const declared = getDeclaredOS();
  choices.innerHTML = OS_CHOICES.map(c =>
    `<button type="button" class="gbtn waffle-os-btn${c.id === declared ? ' is-current' : ''}" data-os="${c.id}"${c.id === declared ? ' aria-pressed="true"' : ''}>${esc(c.label)}</button>`
  ).join('') + '<button type="button" class="gbtn waffle-mini-btn" id="waffle-os-skip">Let it detect</button>';
  const answered = () => {
    osAskReopened = false;
    markOsAsked();
    box.hidden = true;
    detectDeviceDiagnostics().then(d => { deviceDiag = d; updateStatusBadge(); }).catch(() => {});
  };
  choices.querySelectorAll('[data-os]').forEach(btn => {
    btn.addEventListener('click', () => { playPop?.(620); setDeclaredOS(btn.dataset.os); answered(); });
  });
  const detect = () => { playPop?.(420); clearDeclaredOS(); answered(); };
  choices.querySelector('#waffle-os-skip')?.addEventListener('click', detect);
  box.querySelector('#waffle-os-close')?.addEventListener('click', detect);
  box.hidden = false;
  choices.querySelector('.is-current, [data-os]')?.focus?.();
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
    diagEl.className = `waffle-device-pill is-door ${deviceDiag.hasRisk ? 'is-risk' : 'is-ok'}`;
    diagEl.title = `${deviceDiag.deviceNote || deviceDiag.summaryLabel}\n\nTap to say which device this is. The same tap opens the full warning and what was detected here.`;
    // The pill is the way back to the device question once it has been answered
    // or dismissed, so it has to look and act like something you can press. It now
    // opens the device popup, which holds that question alongside the long
    // disclaimer the header no longer prints inline.
    if (!diagEl.dataset.osDoor) {
      diagEl.dataset.osDoor = '1';
      diagEl.tabIndex = 0;
      diagEl.setAttribute('role', 'button');
      diagEl.addEventListener('click', () => { playPop?.(520); openDeviceModal(); });
      diagEl.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playPop?.(520); openDeviceModal(); }
      });
    }
  }
  renderOsAsk();
  const noteEl = overlayEl.querySelector('#waffle-ai-device-note');
  if (noteEl) {
    // The profile this device was recognised as, in plain words: which browser
    // and Chromium baseline, whether an NPU is reachable at all, and what the
    // WASM heap is allowed to be. When AI fails on a Huawei or HarmonyOS tablet
    // this is the part that explains why.
    const note = deviceDiag.deviceNote || '';
    noteEl.textContent = note;
    noteEl.hidden = !note;
  }
  renderDeviceFacts();
  if (!badge) return;
  if (customNote) {
    badge.textContent = customNote;
    badge.className = 'waffle-ai-badge is-busy';
    return;
  }
  if (imageMode) {
    // There is no "WASM CPU Fallback" for the image model any more. FLUX.2 Klein's
    // transformer is hand-written WGSL, so a browser without WebGPU has no slower
    // path to fall back to — it has no path. The old label promised one.
    const gpuLabel = imageCaps.hasWebGPU
      ? `WebGPU · ${imageCaps.mode || 'desktop'} build`
      : 'needs WebGPU · not available here';
    badge.textContent = `${iCfg.name} · ${gpuLabel}`;
    badge.className = imageCaps.hasWebGPU ? 'waffle-ai-badge is-ready' : 'waffle-ai-badge is-busy';
    return;
  }
  if (tCfg.kind === 'browser') {
    badge.textContent = `${tCfg.label} · ${tCfg.badge}`;
    badge.className = isGenerating ? 'waffle-ai-badge is-busy' : 'waffle-ai-badge is-ready';
    return;
  }
  if (isGenerating) {
    badge.textContent = `${tCfg.label} · Thinking…`;
    badge.className = 'waffle-ai-badge is-busy';
  } else if (modelState.loaded && modelState.modelId === tCfg.id) {
    badge.textContent = `${tCfg.label} · Ready`;
    badge.className = 'waffle-ai-badge is-ready';
  } else if (modelState.serverReachable && modelState.preCached) {
    if (modelState.error) {
      badge.textContent = `${tCfg.label} · ${modelState.error}`;
      badge.className = 'waffle-ai-badge is-warn';
    } else {
      badge.textContent = `${tCfg.label} · Pre-cached`;
      badge.className = 'waffle-ai-badge';
    }
  } else {
    badge.textContent = `${tCfg.label} · ${deviceDiag.hasWebGPU ? 'Browser WebGPU' : 'Browser WASM'}`;
    badge.className = 'waffle-ai-badge is-ready';
  }
}

function renderAttachments() {
  if (!overlayEl) return;
  const shelf = overlayEl.querySelector('#waffle-ai-files');
  if (!shelf) return;
  shelf.hidden = attachments.length === 0;
  shelf.innerHTML = attachments.map((f, idx) => `
    <span class="waffle-attach-pill">
      ${f.imageUrl ? `<img class="waffle-attach-thumb" src="${f.imageUrl}" alt="">` : ''}
      <span>${f.imageUrl ? '🖼' : '📎'} ${esc(f.name)} (${Math.max(1, Math.round(f.text.length / 1024))} KB)</span>
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

/* ------------------------------------------------------------------ *
 * Painting the feed while a reply streams in
 *
 * renderMessages() rebuilds the whole feed: every message's markdown is
 * parsed again and feed.innerHTML is replaced, so every image element in
 * the thread is destroyed and recreated. That is the right thing to do
 * once, and a wasteful thing to do per token — a 500-token answer in a
 * long thread used to mean 500 full rebuilds of work that the screen can
 * only show 60 times a second anyway.
 *
 * So streaming asks for a paint instead of doing one. Requests collapse
 * into one rebuild per animation frame, which keeps the reply visibly
 * streaming and cuts the main-thread work to the rate the display can
 * use. Every path that means "show this now" — a finished reply, a
 * runtime note, a closed overlay — goes through renderMessagesNow(),
 * which cancels a queued frame rather than leaving it to paint a state
 * that has already moved on.
 * ------------------------------------------------------------------ */
let feedFrame = 0;
let cancelFeedFrame = () => {};
/** Which bubble a queued paint may repaint alone, or -1 for a full render. */
let feedStreamIdx = -1;

function scheduleFeedRender(streamIdx = -1) {
  if (streamIdx >= 0) feedStreamIdx = streamIdx;
  if (feedFrame) return;
  const paint = () => {
    feedFrame = 0;
    cancelFeedFrame = () => {};
    const idx = feedStreamIdx;
    feedStreamIdx = -1;
    if (idx >= 0 && paintStreamingMessage(idx)) return;
    renderMessages();
  };
  if (typeof requestAnimationFrame === 'function') {
    feedFrame = requestAnimationFrame(paint);
    cancelFeedFrame = () => cancelAnimationFrame(feedFrame);
  } else {
    // No frames to wait for (a test shim, or a page with no display): a short
    // timer still collapses a burst of tokens into one rebuild.
    feedFrame = setTimeout(paint, 16);
    cancelFeedFrame = () => clearTimeout(feedFrame);
  }
}

function renderMessagesNow() {
  if (feedFrame) { cancelFeedFrame(); feedFrame = 0; cancelFeedFrame = () => {}; }
  feedStreamIdx = -1;
  renderMessages();
}

/** Wire the copy/download buttons of code and file boxes anywhere in `root`. */
function wireArtifactButtons(root) {
  root.querySelectorAll('[data-copy-artifact]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const art = codeArtifacts[Number(btn.dataset.copyArtifact)];
      if (!art) return;
      const ok = await copyToClipboard(art.code);
      btn.textContent = ok ? 'Copied!' : 'Failed';
      setTimeout(() => { btn.textContent = 'Copy'; }, 1200);
    });
  });

  root.querySelectorAll('[data-dl-artifact]').forEach(btn => {
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
}

/**
 * Repaint the one bubble a streaming reply is arriving in, and nothing else.
 *
 * This is the win that does not depend on how fast the model is. A full render
 * re-parses the markdown of every message in the thread and replaces the whole
 * feed, which also destroys and recreates every image element in it — so the
 * cost of showing one more token grew with the length of the conversation. On a
 * long thread that is most of what the chat spends its main thread on, and it
 * happens whether tokens arrive at 15 a second or 150.
 *
 * Every condition it cannot vouch for sends it back to renderMessages(), which
 * is slower and always correct.
 */
function paintStreamingMessage(idx) {
  if (!overlayEl || idx < 0) return false;
  const m = messages[idx];
  // Only a plain assistant reply still streaming can be painted on its own.
  if (!m || m.role === 'user' || m.imageProgress || m.imageResult || m.imageCutOff) return false;
  if (idx !== messages.length - 1 || !isGenerating) return false;
  const feed = overlayEl.querySelector('#waffle-ai-feed');
  if (!feed || feed.children.length !== messages.length) return false;
  const bubble = feed.children[idx];
  const body = bubble?.querySelector('.waffle-msg-body');
  const base = feedArtifactBase[idx];
  if (!body || !Number.isFinite(base)) return false;

  // This bubble's artifacts are the tail of the list. Dropping them and letting
  // the formatter rebuild them from the same base is what keeps every earlier
  // bubble's buttons pointing at the entries they were rendered with.
  codeArtifacts.length = base;
  body.innerHTML = (m.content ? formatWaffleMarkdown(m.content, true) : '<span class="waffle-thinking">Warming up the waffle iron\u2026</span>')
    + '<span class="waffle-cursor" aria-hidden="true">\u258c</span>';
  wireArtifactButtons(bubble);
  feed.scrollTop = feed.scrollHeight;
  return true;
}

function renderMessages() {
  if (!overlayEl) return;
  const feed = overlayEl.querySelector('#waffle-ai-feed');
  const starters = overlayEl.querySelector('#waffle-ai-starters');
  if (!feed) return;

  codeArtifacts = [];
  feedArtifactBase = [];
  feedStreamIdx = -1;

  feed.innerHTML = messages.map((m, idx) => {
    const isUser = m.role === 'user';
    const streamingNow = !isUser && isGenerating && idx === messages.length - 1;
    const streamingCursor = streamingNow && !m.imageProgress ? '<span class="waffle-cursor" aria-hidden="true">▌</span>' : '';
    const fileNote = isUser && m.fileNames?.length
      ? `<div class="waffle-msg-files">${m.fileNames.map(n => `<span class="waffle-msg-file-tag">📎 ${esc(n)}</span>`).join('')}</div>`
      : '';
    const imgNote = isUser && m.imageUrls?.length
      ? `<div class="waffle-msg-images">${m.imageUrls.map(u => `<img class="waffle-msg-img" src="${u}" alt="Uploaded image">`).join('')}</div>`
      : '';

    feedArtifactBase[idx] = codeArtifacts.length;

    let bodyHtml = '';
    if (isUser) {
      bodyHtml = `<p class="waffle-md-p">${esc(m.displayContent ?? m.content).replace(/\n/g, '<br>')}</p>`;
    } else if (m.imageResult) {
      const r = m.imageResult;
      bodyHtml = `
        <div class="waffle-gen-img-card">
          <img class="waffle-gen-img" src="${r.dataUrl}" alt="${esc(m.imagePrompt || 'Generated image')}">
          <div class="waffle-gen-meta">
            <span>${esc(imageModelLabel(r))} · ${esc(r.backend || '')} · ${r.steps} step${r.steps > 1 ? 's' : ''} · ${(r.timeMs / 1000).toFixed(1)}s · seed ${r.seed}</span>
          </div>
          ${m.enhancedPrompt ? `<p class="waffle-gen-prompt">Prompt: <em>${esc(m.enhancedPrompt)}</em></p>` : ''}
          <div class="waffle-msg-actions">
            <button type="button" class="waffle-mini-btn is-primary" data-dl-img="${idx}">⬇ Save PNG</button>
            <button type="button" class="waffle-mini-btn" data-vary-img="${idx}">🎲 Vary Seed</button>
            <button type="button" class="waffle-mini-btn" data-art-img="${idx}">🎨 Edit in Art Studio</button>
          </div>
        </div>
      `;
    } else if (m.imageCutOff) {
      bodyHtml = `
        <div class="waffle-img-cut">
          ${formatWaffleMarkdown(m.content, streamingNow)}
          <div class="waffle-msg-actions">
            <button type="button" class="waffle-mini-btn is-primary" data-img-resume="${idx}">▶ Run it again</button>
            <button type="button" class="waffle-mini-btn" data-img-dismiss="${idx}">Dismiss</button>
          </div>
        </div>
      `;
    } else if (m.imageProgress) {
      const p = m.imageProgress;
      // A number this run cannot back up is not printed as one. `indeterminate`
      // means the engine named a stage but reported no fraction for it, so the bar
      // stripes and the seconds keep counting instead — that clock is the one
      // signal here guaranteed to be telling the truth. The old markup printed a
      // hard `Math.max(4, percent)` and a hard number, which is how a first run
      // spent several minutes announcing "4%" while gigabytes arrived.
      const pct = Number.isFinite(p.percent) ? p.percent : null;
      const width = p.indeterminate ? Math.max(8, Math.min(99, pct ?? 8)) : Math.max(2, pct ?? 0);
      const facts = [
        p.suspendedMs ? `the system paused this tab for ${humanDuration(p.suspendedMs)}` : '',
        p.totalMB ? `${p.loadedMB ?? 0} MB of ${p.totalMB} MB${p.shards ? ` · part ${p.shard} of ${p.shards}` : ''}` : '',
        p.etaMs ? `about ${humanDuration(p.etaMs)} left, estimated` : '',
        p.step && p.steps ? `step ${p.step} of ${p.steps}` : '',
        p.elapsedMs ? `${humanDuration(p.elapsedMs)} in` : ''
      ].filter(Boolean);
      bodyHtml = `
        <div class="waffle-img-progress${p.indeterminate ? ' is-indeterminate' : ''}">
          <div class="waffle-img-prog-head">
            <span>🎨 ${esc(p.stage || 'Preparing image model…')}</span>
            <b>${p.indeterminate ? '…' : `${pct ?? 0}%`}</b>
          </div>
          <div class="waffle-img-prog-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"${pct === null || p.indeterminate ? ' aria-valuetext="still working"' : ` aria-valuenow="${pct}"`}><span style="width:${width}%"></span></div>
          ${facts.length ? `<small class="waffle-img-prog-facts">${esc(facts.join(' · '))}</small>` : ''}
          ${p.detail ? `<small class="waffle-img-prog-detail" title="${esc(p.detail)}">${esc(p.detail)}</small>` : ''}
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
    const runtimeNote = !isUser && m.runtimeNote
      ? `<div class="waffle-msg-runtime">${m.runtimeNote}</div>`
      : '';
    return `
      <div class="waffle-msg ${isUser ? 'is-user' : 'is-bot'}">
        ${isUser ? '' : `<span class="waffle-msg-avatar" aria-hidden="true">${waffleMascotSVG('waffle-mini-svg')}</span>`}
        <div class="waffle-msg-bubble">
          <div class="waffle-msg-author">${isUser ? 'You' : (m.authorLabel || 'Sir Waffle')}</div>
          ${runtimeNote}
          ${fileNote}
          ${imgNote}
          ${webSourcesBar}
          <div class="waffle-msg-body">${bodyHtml}${streamingCursor}</div>
          ${exportBar}
        </div>
      </div>
    `;
  }).join('');

  wireArtifactButtons(feed);

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

  feed.querySelectorAll('[data-img-resume]').forEach(btn => {
    btn.addEventListener('click', () => {
      const at = Number(btn.dataset.imgResume);
      const cut = messages[at]?.imageCutOff;
      if (!cut || isGenerating) return;
      playPop(600);
      // The notice goes and the run comes back, in the same place in the thread.
      messages.splice(at, 1);
      runImageGeneration(cut.prompt, cut.prompt, false);
    });
  });

  feed.querySelectorAll('[data-img-dismiss]').forEach(btn => {
    btn.addEventListener('click', () => {
      const at = Number(btn.dataset.imgDismiss);
      if (!messages[at]?.imageCutOff) return;
      playPop(420);
      messages.splice(at, 1);
      renderMessages();
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

  // One hook at the end of every repaint: streaming, image results, web answers
  // and file reads all land here, so none of them can forget to be saved.
  persistThread();
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
      const payload = await extractFilePayload(file);
      const clipped = String(payload.text || '').trim().slice(0, 5200);
      if (!clipped) throw new Error('No readable text found inside this file.');
      attachments.push({ name: file.name, text: clipped, imageUrl: payload.imageUrl || null, isImage: Boolean(payload.isImage) });
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

/**
 * The run this tab was in the middle of when the system took it away.
 *
 * A screen lock makes that less likely and cannot make it impossible: some
 * browsers have no lock to give, and an OEM that discards a renderer does not ask
 * first. What can be changed is what an interruption *costs*. The weights land in
 * the browser's own storage as they arrive and survive the tab, so a killed run
 * loses the picture and not the download — provided somebody says so and offers
 * the retry. Without this the tab comes back showing a conversation that ends
 * mid-sentence, with no explanation and no way to continue it.
 */
const IMAGE_RUN_KEY = 'waffle-ai-image-run-v1';
/** A run cut off yesterday is not news today. */
const IMAGE_RUN_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function noteImageRun(intent) {
  try { localStorage.setItem(IMAGE_RUN_KEY, JSON.stringify({ ...intent, at: Date.now() })); } catch {}
}

function clearImageRun() {
  try { localStorage.removeItem(IMAGE_RUN_KEY); } catch {}
}

/** What was in flight when this tab last died, or null. Exported for the tests. */
export function cutOffImageRun() {
  try {
    const saved = JSON.parse(localStorage.getItem(IMAGE_RUN_KEY) || 'null');
    if (!saved || typeof saved.prompt !== 'string' || !saved.prompt) return null;
    if (!(Date.now() - Number(saved.at || 0) < IMAGE_RUN_MAX_AGE_MS)) { clearImageRun(); return null; }
    return saved;
  } catch {
    return null;
  }
}

/** Offer the retry once, after the saved conversation has been swapped in. */
function offerCutOffRun() {
  if (isGenerating) return;
  const cut = cutOffImageRun();
  if (!cut) return;
  if (messages.some(m => m.imageCutOff)) return;
  // Offered once rather than on every open: the button stays in the thread, so
  // nothing is lost by not repeating it, and a notice that reappears forever is a
  // notice people stop reading.
  clearImageRun();
  const desktop = cut.model === 'klein-desktop';
  messages.push({
    role: 'assistant',
    authorLabel: 'Sir Waffle',
    imageCutOff: cut,
    content: [
      '🧇 That last picture never arrived. The tab was closed, crashed, or frozen by the system while the run was still going — from in here those look identical, and battery optimisation is the usual reason even with Chrome exempted, because the freeze is about the tab and not the app.',
      'The weights it had already downloaded are still in this browser, so trying again does not start from nothing.',
      desktop ? 'It was running the desktop build, which keeps roughly 4 GB resident on the GPU and is the likeliest thing on this page to be killed for it. If it happens again, the phone build in Settings is the smaller one.' : ''
    ].filter(Boolean).join('\n\n')
  });
  renderMessages();
}

async function runImageGeneration(promptText, displayPrompt = promptText, allowEnhance = getSmartPromptEnabled()) {
  if (isGenerating) return;
  // Checked before anything is pushed. A paused run must not create the
  // progress bubble it can never fill: a bar that announces "Preparing…" and
  // then explains itself is worse than a notice that says so up front. The
  // visitor's prompt is still echoed, so the chat reads as a question that was
  // answered honestly rather than one that was dropped.
  if (isImageGenPaused()) {
    messages.push({
      role: 'user',
      displayContent: `\u{1F3A8} Generate: ${displayPrompt}`,
      content: displayPrompt
    });
    messages.push({ role: 'assistant', authorLabel: 'Sir Waffle', content: IMAGE_GEN_PAUSE_MESSAGE });
    renderMessages();
    syncComposerState();
    return;
  }
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
    imageProgress: { stage: 'Preparing…', percent: 1, indeterminate: true, elapsedMs: 0, detail: '' },
    content: ''
  });

  isGenerating = true;
  renderMessages();
  syncComposerState();

  const assistantIdx = messages.length - 1;
  activeAbort = new AbortController();
  // The bar can only move when something reports, and a first run spends minutes
  // between reports. This redraws once a second and stamps the run's own clock
  // onto whatever the last report was, so a busy download and a dead one no longer
  // look identical on screen.
  const runStartedAt = Date.now();
  const stampElapsed = prog => (prog ? { ...prog, elapsedMs: Date.now() - runStartedAt } : prog);
  // Written down before the first byte and cleared in the finally below: a run the
  // system kills leaves this behind, and it is the only trace of it that survives.
  noteImageRun({ prompt: displayPrompt, model: getSelectedImageModel(), modelName: imgCfg.name });
  if (progressTicker) clearInterval(progressTicker);
  let lastTickAt = Date.now();
  let suspendedMs = 0;
  progressTicker = setInterval(() => {
    const nowAt = Date.now();
    const gap = nowAt - lastTickAt;
    lastTickAt = nowAt;
    const cur = messages[assistantIdx]?.imageProgress;
    if (!cur) return;
    // A one-second timer that took three minutes to fire was not busy. The tab was
    // throttled, frozen, or discarded and restored, and nothing in here can tell
    // which — so it says that instead of carrying on as though the run had been
    // ticking along the whole time.
    if (gap > 5_000) suspendedMs += gap - 1_000;
    messages[assistantIdx].imageProgress = suspendedMs
      ? { ...stampElapsed(cur), suspendedMs }
      : stampElapsed(cur);
    renderMessages();
  }, 1000);

  try {
    let finalPrompt = promptText;
    if (allowEnhance && promptText.split(/\s+/).length <= 12) {
      // This is the phase the old bar froze in. Rewriting the prompt runs the
      // *chat* model, which on a cold start is its own download and load before a
      // single image weight moves — minutes, announced as "4%". It now says which
      // model is being loaded and passes the chat engine's own status through.
      messages[assistantIdx].imageProgress = stampElapsed({
        stage: 'Polishing your prompt with the chat model',
        percent: 2,
        indeterminate: true,
        detail: 'A short idea is rewritten as one vivid sentence first. On a cold start that loads the chat model before the image engine begins.'
      });
      renderMessages();
      try {
        // Worded for FLUX.2 Klein, not for a 2023 Stable Diffusion: Klein's text
        // encoder is a distilled Qwen3 run through a chat template, so a plain
        // descriptive sentence describes a picture better than a comma-separated
        // pile of tags does.
        const polished = await streamWaffleChat({
          messages: [{ role: 'user', content: `Rewrite this short idea as one vivid sentence describing a picture (max 35 words: subject, then light, setting and style; no preamble): "${promptText}"` }],
          systemPrompt: 'Output ONLY that one descriptive sentence. No quotes, no intro, no comma-separated tag lists.',
          maxTokens: 70,
          temperature: 0.6,
          signal: activeAbort.signal,
          onStatus: s => {
            messages[assistantIdx].imageProgress = stampElapsed({
              stage: 'Polishing your prompt with the chat model',
              percent: 3,
              indeterminate: true,
              detail: String(s?.detail || s?.state || '')
            });
            renderMessages();
          }
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
      size: imgCfg.defaultSize,
      signal: activeAbort.signal,
      onProgress(p) {
        messages[assistantIdx].imageProgress = stampElapsed(p);
        renderMessages();
        // The badge printed a percentage even when the run had nothing to measure,
        // so the frozen number appeared in the header as well as the bubble.
        updateStatusBadge(`${imgCfg.name} · ${p.stage} · ${p.indeterminate ? humanDuration(p.elapsedMs || 0) : `${p.percent}%`}`);
      }
    });

    delete messages[assistantIdx].imageProgress;
    messages[assistantIdx].imageResult = res;
    messages[assistantIdx].enhancedPrompt = finalPrompt !== displayPrompt ? finalPrompt : '';
    messages[assistantIdx].content = `Generated image for "${displayPrompt}" (${res.modelName || res.model}, ${res.backend}, seed ${res.seed}, ${res.timeMs} ms).`;
    playSparkle();
  } catch (err) {
    delete messages[assistantIdx].imageProgress;
    if (err.name === 'AbortError') {
      messages[assistantIdx].content = '*Stopped image generation.* Ready whenever you are!';
    } else if (err.code === 'no-webgpu') {
      // The one failure that is about the device rather than the prompt, so it
      // points at the place that explains the device.
      messages[assistantIdx].content = `Image generation cannot run here: ${err.message} The device pill in the header has what this hardware can do.`;
    } else {
      messages[assistantIdx].content = `Image generation hit a bump: ${err.message}`;
    }
  } finally {
    isGenerating = false;
    activeAbort = null;
    clearImageRun();
    if (progressTicker) { clearInterval(progressTicker); progressTicker = null; }
    renderMessages();
    syncComposerState();
    overlayEl?.querySelector('#waffle-ai-input')?.focus();
  }
}

async function runBackupDoor() {
  playSparkle();
  isGenerating = true;
  messages.push({
    role: 'assistant',
    authorLabel: 'Sir Waffle',
    content: `🧇 That is the door. Reading ${BACKUP_DOOR_FILE}…`
  });
  renderMessages();
  try {
    // On success this call replaces the document under us, so the success path
    // has nothing left to render into and no reason to try.
    await openBackupKitchenDoor({
      onStatus: detail => {
        const last = messages[messages.length - 1];
        if (last?.role === 'assistant') last.content = `🧇 ${detail}`;
        renderMessages();
      }
    });
  } catch (err) {
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant') {
      last.content = `The door did not open: ${err?.message || err}`;
      renderMessages();
    }
  } finally {
    isGenerating = false;
    // Every render above happened while generating, which is when saving is
    // skipped, so a failed attempt would otherwise leave the exchange on screen
    // and unwritten. On success the document is being replaced under us and the
    // write costs nothing.
    persistThread(true);
  }
}

async function sendMessage(rawText) {
  const text = String(rawText || '').trim();
  if ((!text && !attachments.length) || isGenerating) return;

  const input = overlayEl?.querySelector('#waffle-ai-input');
  if (input) input.value = '';

  // The door to the backup kitchen, before anything else looks at the text: not
  // the image intent, and not the transcript. A key that gets written into the
  // chat history is a key that gets copy-pasted, so the string is consumed here
  // and never appears in the conversation it was typed into.
  if (!attachments.length && backupDoorMatches(text)) {
    await runBackupDoor();
    return;
  }

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
  const imageUrls = currentFiles.map(f => f.imageUrl).filter(Boolean);
  const nonImageFiles = currentFiles.filter(f => !f.isImage);
  const fileContext = nonImageFiles.map(f =>
    `The user uploaded the file "${f.name}". Its extracted content/details are provided directly below — read and use them directly:\n--- BEGIN FILE: ${f.name} ---\n${f.text}\n--- END FILE: ${f.name} ---`
  ).join('\n\n');
  const tCfg = activeTextCfg();

  playPop(580);
  messages.push({
    role: 'user',
    displayContent: text || `Analyze ${fileNames.join(', ')}`,
    fileNames,
    imageUrls,
    content: [fileContext, cleanQuery || (imageUrls.length ? 'Describe what is actually shown in the attached image(s).' : 'Please read and summarize the attached file(s).')].filter(Boolean).join('\n\n')
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
      let results = [];
      try {
        const wr = await fetch('./api/waffle-ai/web-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: cleanQuery }),
          signal: activeAbort.signal
        });
        const ct = wr.headers.get('content-type') || '';
        if (wr.ok && ct.includes('application/json')) {
          const wd = await wr.json();
          if (Array.isArray(wd.results)) results = wd.results;
        }
      } catch {}
      if (!results.length) {
        const qEnc = encodeURIComponent(cleanQuery);
        const [wiki, gh, npm] = await Promise.allSettled([
          fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${qEnc}&srlimit=3&format=json&origin=*`, { signal: activeAbort.signal }).then(r => r.ok ? r.json() : null),
          fetch(`https://api.github.com/search/repositories?q=${qEnc}&per_page=2`, { signal: activeAbort.signal }).then(r => r.ok ? r.json() : null),
          fetch(`https://registry.npmjs.org/-/v1/search?text=${qEnc}&size=2`, { signal: activeAbort.signal }).then(r => r.ok ? r.json() : null)
        ]);
        for (const hit of (wiki.value?.query?.search || [])) {
          const clean = String(hit.snippet || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
          results.push({ title: hit.title, snippet: clean.slice(0, 340), url: `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`, source: 'Wikipedia' });
        }
        for (const repo of (gh.value?.items || [])) {
          results.push({ title: repo.full_name, snippet: `${repo.description || 'Repository'} (★ ${repo.stargazers_count ?? 0})`.slice(0, 320), url: repo.html_url, source: 'GitHub' });
        }
        for (const obj of (npm.value?.objects || [])) {
          const p = obj.package;
          if (p) results.push({ title: `${p.name}@${p.version}`, snippet: (p.description || 'npm package').slice(0, 320), url: p.links?.npm || `https://www.npmjs.com/package/${encodeURIComponent(p.name)}`, source: 'npm' });
        }
        results = results.slice(0, 6);
      }
      if (results.length) {
        messages[assistantIdx].webSources = results;
        webContext = `Web search results for "${cleanQuery}":\n` + results
          .map((r, i) => `[${i + 1}] ${r.title} (${r.source}) - ${r.url}\n${r.snippet}`)
          .join('\n\n');
        renderMessages();
      }
    } catch {}
  }

  const finalUserContent = [
    fileContext,
    webContext ? `Use these live web search results to answer accurately and cite sources:\n--- WEB SEARCH RESULTS ---\n${webContext}\n--- END WEB SEARCH RESULTS ---` : '',
    cleanQuery || (imageUrls.length ? 'Describe what is actually shown in the attached image(s).' : 'Please read and summarize the attached file(s).')
  ].filter(Boolean).join('\n\n');
  messages[assistantIdx - 1].content = finalUserContent;

  const historyPayload = messages
    .slice(0, assistantIdx)
    .filter(m => !m.isWelcome)
    .map(m => ({ role: m.role, content: m.content }));

  // One builder, shared with the server, so both kitchens introduce themselves
  // the same way. The attached-file rule travels only with a message that really
  // carries a file: it used to sit in every prompt whether or not anything was
  // attached, which is what taught Falcon 3 1B to wrap "hello" in file markers.
  // `undefined` still means "let the server use its own persona", which is the
  // same text built by the same function.
  const usesBrowserEngine = tCfg.kind === 'browser' || !modelState.serverReachable || !modelState.preCached;
  const effectiveSystemPrompt = imageUrls.length
    ? buildWaffleSystemPrompt({ vision: true, hasFile: Boolean(fileContext) })
    : (usesBrowserEngine
      ? buildWaffleSystemPrompt({ hasFile: Boolean(fileContext) })
      : undefined);

  try {
    const finalText = await streamWaffleChat({
      modelId: tCfg.id,
      messages: historyPayload,
      imageUrls,
      systemPrompt: effectiveSystemPrompt,
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
      onToken(chunk, acc) {
        messages[assistantIdx].content = typeof acc === 'string' ? acc : (messages[assistantIdx].content + chunk);
        // One paint per frame, not one per token, and that paint covers this
        // bubble rather than the thread: the text is already in place, so
        // nothing is lost by showing it at the rate a screen can.
        scheduleFeedRender(assistantIdx);
      },
      onRuntime(rt) {
        // Never pretend a fallback answered as the model the user picked.
        const engineLabel = rt.engine === 'WLlama'
          ? `WLlama · ${String(rt.device || 'wasm').toUpperCase()}`
          : rt.engine === 'ONNX Runtime Web'
            ? `ONNX Runtime Web · ${String(rt.device || 'wasm').toUpperCase()}`
            : String(rt.engine || 'runtime');
        const fails = Array.isArray(rt.failures) ? rt.failures : [];
        const failList = fails.map(f => `<li><strong>${esc(f.step)}</strong> — ${esc(f.message)}</li>`).join('');
        messages[assistantIdx].authorLabel = `Sir Waffle · ${rt.label}`;
        messages[assistantIdx].runtimeNote = [
          rt.swapped
            ? `⚠ <strong>${esc(rt.requested)}</strong> could not run on this device — this reply came from <strong>${esc(rt.label)}</strong> (${esc(engineLabel)}).`
            : `✅ ${esc(rt.label)} · ${esc(engineLabel)}`,
          failList
            ? `<details class="waffle-runtime-details"><summary>Why ${fails.length} runtime${fails.length === 1 ? '' : 's'} failed first</summary><ul>${failList}</ul></details>`
            : ''
        ].filter(Boolean).join('');
        if (rt.swapped) modelState.swappedTo = rt.modelId;
        renderMessagesNow();
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
    // A frame may still be holding the last few tokens, and the reply is
    // finished now, so this paints rather than queues.
    renderMessagesNow();
    syncComposerState();
    overlayEl?.querySelector('#waffle-ai-input')?.focus();
  }
}

export function closeWaffleAI() {
  const closing = overlayEl || lockedEl;
  if (!closing) return;
  if (activeAbort) activeAbort.abort();
  // Closing is the moment a save is most likely to be the last one, so it does
  // not wait for the debounce.
  persistThread(true);
  if (overlayEl) overlayEl.hidden = true;
  if (lockedEl) lockedEl.hidden = true;
  document.body.classList.remove('waffle-modal-open');
}

/**
 * The paused-AI notice. It reuses the `waffle-ai-overlay` id so i18n keeps
 * skipping it and the kitchen's click-through guard still recognises it, and it
 * keeps Sir Waffle on screen — tapping him is also the hidden unlock gesture.
 */
function buildLockedOverlay() {
  const wrap = document.createElement('div');
  wrap.id = 'waffle-ai-overlay';
  wrap.className = 'waffle-ai-overlay is-locked';
  wrap.hidden = true;
  wrap.innerHTML = `
    <div class="waffle-ai-dialog waffle-ai-locked-dialog" role="dialog" aria-modal="true" aria-labelledby="waffle-ai-locked-title">
      <div class="waffle-ai-header">
        <div class="window-grab-pill" aria-hidden="true"></div>
        <div class="waffle-ai-head-row">
          <div class="waffle-ai-title-wrap">
            <span class="waffle-ai-avatar" aria-hidden="true">${waffleMascotSVG('waffle-header-svg')}</span>
            <div>
              <h2 id="waffle-ai-locked-title" class="waffle-ai-title">Waffle AI is taking a break</h2>
              <span class="waffle-ai-badge">Paused &middot; back in a later update</span>
            </div>
          </div>
          <div class="waffle-ai-actions">
            <button type="button" class="window-close-x" id="waffle-ai-locked-close" aria-label="Close">✕</button>
          </div>
        </div>
      </div>
      <div class="waffle-ai-locked-body">
        <button type="button" class="waffle-ai-locked-mascot" id="waffle-ai-locked-mascot"
                aria-label="Sir Waffle" title="Sir Waffle">
          ${waffleMascotSVG('waffle-locked-svg')}
        </button>
        <p class="waffle-ai-locked-copy">${esc(WAFFLE_AI_LOCK_MESSAGE)}</p>
        <ul class="waffle-ai-locked-list">
          <li>The chat, CodeHub&rsquo;s AI Error Diagnostics, and the AI writing helpers in English &amp; Languages are all paused together.</li>
          <li>Everything else in the kitchen &mdash; all 120 utilities and all 51 games &mdash; works exactly as before, on your device, with no account.</li>
          <li>Nothing was deleted. The models and runtimes stay in the build so they can be switched back on when they behave.</li>
        </ul>
        <button type="button" class="gbtn gbtn-primary" id="waffle-ai-locked-done">Back to the Kitchen</button>
      </div>
    </div>
  `;

  // No backdrop-dismiss here, on purpose. This dialog opens on the *first* tap
  // of the unlock run and covers the whole viewport (z-index 90) including
  // the corner mascot (45), so a second tap in the same place used to land on
  // the backdrop and close it without counting. The run then alternated
  // open/close forever and could never reach ten — which reads exactly like a
  // timeout. The whole overlay is the tap target instead, and dismissal stays
  // one click away via ✕, the button, or Escape.
  // This overlay used to be one big target for the unlock gesture, and the whole
  // dialog was wired to count every click on itself. The gesture is retired — the
  // way into the backup kitchen is a string typed at Waffle AI, in backup-door.js
  // — so nothing here is marked tappable and nothing counts. What is left is the
  // paused notice this build no longer shows, kept because a build that can be
  // paused again should not have to be written twice.
  wrap.querySelector('#waffle-ai-locked-close')?.addEventListener('click', () => { playPop(460); closeWaffleAI(); });
  wrap.querySelector('#waffle-ai-locked-done')?.addEventListener('click', () => { playPop(460); closeWaffleAI(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && lockedEl && !lockedEl.hidden) closeWaffleAI();
  });

  document.body.append(wrap);
  return wrap;
}

export function openLockedWaffleAI() {
  if (!lockedEl) lockedEl = buildLockedOverlay();
  lockedEl.hidden = false;
  document.body.classList.add('waffle-modal-open');
  setTimeout(() => lockedEl?.querySelector('#waffle-ai-locked-done')?.focus(), 40);
}

/* --- Chats that are kept ---------------------------------------------------
 * Saving is the part that has to be honest about itself. A static site has no
 * server, so there is nowhere to put a conversation except the browser it was
 * had in — which means it survives closing the tab, restarting the browser and
 * coming back next month, and it does not survive anybody clearing site data.
 * Chrome and Firefox file IndexedDB, localStorage, OPFS and the cache together
 * under that one button. So the rail says both things: kept here, and the only
 * copy that outlives a wipe is the file Export writes.
 */

/** What the saving pill can say. Every state is reachable and every one is true. */
const SAVING_LABELS = {
  idle: 'Not saved yet',
  saving: 'Saving…',
  saved: 'Saved',
  trimmed: 'Saved without its pictures',
  failed: 'Could not save',
  unsupported: 'This browser refused storage'
};

/** Storage is named in the pill because "saved" means different things on different backends. */
const BACKING_LABELS = {
  indexedDB: 'IndexedDB on this device',
  localStorage: 'browser storage on this device',
  memory: 'this visit only'
};

const railEsc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

/** "3 min ago" beats a timestamp in a rail you scan rather than read. */
function railWhen(ms) {
  const diff = Date.now() - (ms || 0);
  if (!(diff >= 0)) return 'just now';
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.max(1, Math.round(diff / 60_000))} min ago`;
  if (diff < 86_400_000) return `${Math.max(1, Math.round(diff / 3_600_000))} h ago`;
  if (diff < 604_800_000) return `${Math.max(1, Math.round(diff / 86_400_000))} d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Opens storage once per visit and pulls the rail. Opening is async, so the
 * overlay paints first and repaints when the answer lands — a chat that took
 * half a second to appear would feel slower than one that saves.
 */
async function ensureChatStore() {
  // A kitchen that keeps no chats opens no storage and writes nothing. This one
  // keeps them, in both builds, so both open the store.
  if (!keepsChatHistory()) return null;
  if (!chatStore) {
    // openChatStore() answers which backend the browser allowed; the store that
    // reads and writes through it is a second step, and the two are separate so
    // the fallback chain can be tried without constructing anything.
    const opened = await openChatStore();
    chatStore = createChatStore(opened.backend);
    chatSaving = opened.kind === 'memory' ? 'unsupported' : 'idle';
  }
  // Re-read on every open rather than trusting the list already in memory:
  // another tab may have imported a file, and a rail that only ever shows what
  // this tab wrote is a rail that lies by omission.
  chatThreads = await chatStore.refresh();

  // Reopen the last conversation — that is the entire point of saving it — but
  // only when nothing has been said on screen. Landing somebody on an older chat
  // in the middle of one they are typing would be worse than not saving at all.
  const saidSomething = messages.some(m => m.role === 'user');
  const newest = chatThreads.find(t => t.messages?.some(m => m.role === 'user'));
  if (!saidSomething && newest) {
    chatThread = newest;
    messages = newest.messages.slice();
  } else if (!chatThread) {
    chatThread = makeThread();
  }
  updateSavingPill();
  renderThreadRail();
  return chatStore;
}

function updateSavingPill() {
  const pill = overlayEl?.querySelector('#waffle-ai-saving');
  if (!pill) return;
  const backing = BACKING_LABELS[chatStore?.kind] || BACKING_LABELS.memory;
  pill.dataset.state = chatSaving;
  pill.textContent = `${SAVING_LABELS[chatSaving] || SAVING_LABELS.idle} · ${backing}`;
  pill.title = chatSaving === 'trimmed'
    ? 'The conversation is kept; its generated pictures were too big for this browser\'s storage and were dropped to make room.'
    : 'Chats are kept in this browser. Clearing site data removes them — Export writes a file that survives that.';
}

/**
 * Writes the current conversation down. Called from the end of
 * renderMessages(), which every path funnels through, rather than from four
 * separate push sites that could drift apart. Skipped mid-generation so a
 * half-streamed reply is never what gets remembered, and debounced so a burst
 * of repaints costs one write.
 */
function persistThread(immediate = false) {
  if (!chatStore || !chatThread || isGenerating) return;
  if (!messages.some(m => m.role === 'user')) return;   // nothing worth keeping yet

  const write = async () => {
    chatSaving = 'saving';
    updateSavingPill();
    const next = {
      ...chatThread,
      messages: messages.slice(),
      updatedAt: Date.now(),
      // A thread is named once, from the first thing said, and then left alone:
      // renaming it later would make the rail shift under your cursor.
      title: chatThread.renamed ? chatThread.title
        : (chatThread.title === UNTITLED ? titleFrom(messages) : chatThread.title)
    };
    try {
      const { saved, droppedImages } = await chatStore.save(next, { now: next.updatedAt });
      chatThread = next;
      chatSaving = saved ? (droppedImages ? 'trimmed' : 'saved') : 'failed';
      chatThreads = await chatStore.list();
    } catch {
      chatSaving = 'failed';
    }
    updateSavingPill();
    renderThreadRail();
  };

  if (immediate) { write(); return; }
  clearTimeout(persistTimer);
  persistTimer = setTimeout(write, 350);
}

function renderThreadRail() {
  if (!overlayEl) return;
  const list = overlayEl.querySelector('#waffle-ai-thread-list');
  if (!list) return;
  const empty = overlayEl.querySelector('#waffle-ai-rail-empty');
  if (empty) empty.hidden = chatThreads.length > 0;
  const count = overlayEl.querySelector('#waffle-ai-rail-count');
  if (count) {
    count.textContent = chatThreads.length
      ? `${chatThreads.length} of ${MAX_THREADS} kept`
      : 'Nothing kept yet';
  }

  list.innerHTML = chatThreads.map(t => `
    <li class="waffle-ai-thread-row ${t.id === chatThread?.id ? 'is-current' : ''}">
      <button type="button" class="waffle-ai-thread" data-open-thread="${railEsc(t.id)}">
        <span class="waffle-ai-thread-title">${railEsc(t.title || UNTITLED)}</span>
        <span class="waffle-ai-thread-when">${railEsc(t.messages?.length || 0)} msgs · ${railWhen(t.updatedAt)}</span>
      </button>
      <button type="button" class="waffle-ai-thread-rename" data-rename-thread="${railEsc(t.id)}" aria-label="Rename this chat" title="Rename">✎</button>
      <button type="button" class="waffle-ai-thread-del" data-del-thread="${railEsc(t.id)}" aria-label="Delete this chat" title="Delete">✕</button>
    </li>`).join('');

  list.querySelectorAll('[data-open-thread]').forEach(btn => {
    btn.addEventListener('click', () => adoptThread(btn.dataset.openThread));
  });
  list.querySelectorAll('[data-del-thread]').forEach(btn => {
    btn.addEventListener('click', () => deleteThread(btn.dataset.delThread));
  });
  list.querySelectorAll('[data-rename-thread]').forEach(btn => {
    btn.addEventListener('click', () => renameThread(btn.dataset.renameThread));
  });
}

function adoptThread(id) {
  const found = chatThreads.find(t => t.id === id);
  if (!found) return;
  if (activeAbort) activeAbort.abort();
  isGenerating = false;
  chatThread = found;
  messages = found.messages?.length ? found.messages.slice() : [WELCOME_MSG];
  attachments = [];
  playPop(660);
  renderAttachments();
  renderMessages();
  syncComposerState();
  updateSavingPill();
  renderThreadRail();
  setRailOpen(false);
  overlayEl?.querySelector('#waffle-ai-input')?.focus();
}

async function deleteThread(id) {
  if (!chatStore) return;
  const gone = chatThreads.find(t => t.id === id);
  if (!gone) return;
  if (!confirm(`Delete “${gone.title || UNTITLED}” from this device?`)) return;
  await chatStore.remove(id);
  chatThreads = await chatStore.list();
  playPop(380);
  if (chatThread?.id === id) startNewChat({ quiet: true });
  renderThreadRail();
}

function renameThread(id) {
  const found = chatThreads.find(t => t.id === id) || (chatThread?.id === id ? chatThread : null);
  if (!found) return;
  const next = prompt('Name this chat:', found.title === UNTITLED ? '' : found.title);
  if (next === null) return;
  const typed = next.trim().slice(0, 80);
  if (typed) {
    found.title = typed;
    found.renamed = true;
  } else {
    // Cleared rather than named. Hand it back to the title the messages give it
    // and stop claiming it was chosen, because it was not.
    found.title = UNTITLED;
    delete found.renamed;
  }
  found.updatedAt = Date.now();
  if (chatThread?.id === id) chatThread = found;
  playPop(700);
  chatStore?.save(found).then(() => chatStore.list()).then(list => {
    chatThreads = list;
    renderThreadRail();
  }).catch(() => {});
}

/** A fresh chat is a fresh thread — the old one stays in the rail, which is the difference from clearing. */
function startNewChat({ quiet = false } = {}) {
  if (activeAbort) activeAbort.abort();
  isGenerating = false;
  clearTimeout(persistTimer);
  chatThread = makeThread();
  chatSaving = chatStore?.kind === 'memory' ? 'unsupported' : 'idle';
  messages = [WELCOME_MSG];
  attachments = [];
  if (!quiet) playBoing();
  renderAttachments();
  renderMessages();
  syncComposerState();
  updateSavingPill();
  renderThreadRail();
  overlayEl?.querySelector('#waffle-ai-input')?.focus();
}

async function exportChats() {
  if (!chatStore) return;
  try {
    const json = await chatStore.exportJSON();
    const when = new Date().toISOString().slice(0, 10);
    triggerFileDownload(json, `waffle-ai-chats-${when}.json`, 'application/json');
    playSparkle();
  } catch (err) {
    alert(`Could not write the export: ${err.message}`);
  }
}

async function importChats(file) {
  if (!chatStore || !file) return;
  try {
    const parsed = parseExport(await file.text());
    const tally = await importThreads(chatStore, parsed.threads);
    chatThreads = await chatStore.list();
    renderThreadRail();
    playSparkle();
    alert(`${tally.added} new, ${tally.updated} updated, ${tally.skipped} left alone.`);
  } catch (err) {
    alert(`That file could not be imported: ${err.message}`);
  }
}

async function clearAllChats() {
  if (!chatStore) return;
  if (!confirm('Delete every chat kept on this device? An exported file is the only copy that survives this.')) return;
  await chatStore.clear();
  chatThreads = [];
  startNewChat({ quiet: true });
  playPop(340);
}

/** On a phone the rail is a drawer, so opening one chat has to put it away again. */
function setRailOpen(open) {
  railOpen = open;
  const shell = overlayEl?.querySelector('.waffle-ai-shell');
  if (shell) shell.dataset.rail = open ? 'open' : 'closed';
  overlayEl?.querySelector('#waffle-ai-rail-toggle')?.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function buildOverlay() {
  /**
   * The overhauled layout and the chats it keeps belong to both kitchens now.
   * They were the test kitchen's alone while the rail was being tried, and 1.3
   * is where trying it stopped being the point.
   *
   * The four models above 1.7B are a *different* decision that happens to read
   * the same build flag, through offeredModelIds() in waffle-browser-ai.js, and
   * they stayed put: their repository paths have not been checked from anywhere
   * that could reach Hugging Face, so nobody should be asked to download them
   * yet. Markup and behaviour both read keepsChatHistory(), so the two cannot
   * disagree about whether this kitchen keeps chats — a rail that renders
   * without a store behind it, or a store writing chats nobody can open, would
   * each be worse than neither.
   */
  const keepsChats = keepsChatHistory();

  const railHtml = keepsChats ? `
      <aside class="waffle-ai-rail" id="waffle-ai-rail" aria-label="Saved chats">
        <div class="waffle-ai-rail-head">
          <div class="waffle-ai-rail-title">
            <span class="waffle-ai-rail-icon" aria-hidden="true">🧇</span>
            <div>
              <strong>Your chats</strong>
              <span class="waffle-ai-rail-count" id="waffle-ai-rail-count">Nothing kept yet</span>
            </div>
          </div>
          <button type="button" class="window-close-x waffle-ai-rail-x" id="waffle-ai-rail-close" aria-label="Hide saved chats">✕</button>
        </div>
        <button type="button" class="gbtn waffle-ai-new-chat" id="waffle-ai-new-chat" title="Start a new chat — this one stays in the rail">＋ New chat</button>
        <div class="waffle-ai-rail-scroll">
          <p class="waffle-ai-rail-empty" id="waffle-ai-rail-empty">The griddle is cold. Ask something and the chat lands here.</p>
          <ul class="waffle-ai-thread-list" id="waffle-ai-thread-list"></ul>
        </div>
        <div class="waffle-ai-rail-foot">
          <div class="waffle-ai-rail-btns">
            <button type="button" class="gbtn" id="waffle-ai-export" title="Download every saved chat as one .json file">⬇ Export</button>
            <button type="button" class="gbtn" id="waffle-ai-import" title="Put a previously exported .json file back">⬆ Import</button>
            <button type="button" class="gbtn waffle-ai-danger" id="waffle-ai-clear-all" title="Delete every chat kept on this device">🗑 All</button>
          </div>
          <input type="file" id="waffle-ai-import-in" accept=".json,application/json" hidden>
          <p class="waffle-ai-save-note">Kept in this browser, so a closed tab, a restart or next month finds them here. Clearing site data deletes them — only an exported file survives that.</p>
        </div>
      </aside>` : '';

  const railToggleHtml = keepsChats
    ? `<button type="button" class="gbtn waffle-ai-rail-toggle" id="waffle-ai-rail-toggle" aria-expanded="false" aria-controls="waffle-ai-rail" title="Show saved chats">☰ <span class="waffle-ai-rail-toggle-label">Chats</span></button>`
    : '';

  const saveRowHtml = keepsChats ? `
          <div class="waffle-save-row">
            <span class="waffle-save-pill" id="waffle-ai-saving" data-state="idle">Not saved yet</span>
            <span class="waffle-save-hint">Chats are kept in this browser. Export writes a file that survives clearing site data.</span>
          </div>` : '';

  const wrap = document.createElement('div');
  wrap.id = 'waffle-ai-overlay';
  wrap.className = 'waffle-ai-overlay';
  wrap.hidden = true;
  wrap.innerHTML = `
    <div class="waffle-os-modal" id="waffle-ai-os-ask" hidden role="dialog" aria-modal="true" aria-labelledby="waffle-ai-os-title">
      <div class="waffle-os-card">
        <button type="button" class="window-close-x" id="waffle-os-close" aria-label="Close">✕</button>
        <strong id="waffle-ai-os-title">Which device is this?</strong>
        <span class="waffle-os-why">So the kitchen picks runtimes it can actually use here. You can change this any time from the device pill in the header.</span>
        <div class="waffle-os-choices" id="waffle-ai-os-choices"></div>
      </div>
    </div>

    <!-- What the device pill opens. The header carries one short warning now; the
         887-character disclaimer and the detected-device facts moved in here
         rather than being cut, so the detail is one tap away instead of three
         screens of scrolling on every visit. -->
    <div class="waffle-os-modal" id="waffle-ai-device-modal" hidden role="dialog" aria-modal="true" aria-labelledby="waffle-ai-device-modal-title">
      <div class="waffle-os-card">
        <button type="button" class="window-close-x" id="waffle-device-modal-close" aria-label="Close">✕</button>
        <strong id="waffle-ai-device-modal-title">📟 This device, and the full warning</strong>
        <span class="waffle-os-why">What the kitchen detected here, and everything the short line in the header leaves out.</span>
        <pre class="waffle-device-note" id="waffle-ai-device-note" hidden></pre>
        <p class="waffle-device-detail" id="waffle-ai-device-facts" hidden></p>
        <p class="waffle-disclaimer-copy waffle-disclaimer-full">${esc(AI_DISCLAIMER_TEXT)}</p>
        <div class="waffle-os-choices">
          <button type="button" class="gbtn" id="waffle-ai-device-os-ask">Say which device this is</button>
        </div>
      </div>
    </div>

    <div class="waffle-ai-dialog${keepsChats ? ' waffle-ai-chat-dialog' : ''}" role="dialog" aria-modal="true" aria-labelledby="waffle-ai-title">
      <div class="waffle-ai-shell" data-rail="closed">${railHtml}

      <div class="waffle-ai-main">
      <div class="waffle-ai-header">
        <div class="window-grab-pill" aria-hidden="true"></div>
        <div class="waffle-ai-head-row">
          ${railToggleHtml}
          <div class="waffle-ai-title-wrap">
            <span class="waffle-ai-avatar" aria-hidden="true">${waffleMascotSVG('waffle-header-svg')}</span>
            <div>
              <h2 id="waffle-ai-title" class="waffle-ai-title">Waffle AI</h2>
              <span id="waffle-ai-badge" class="waffle-ai-badge">Checking runtimes…</span>
            </div>
          </div>
          <div class="waffle-ai-actions">
            <button type="button" class="gbtn waffle-reset-btn" id="waffle-ai-models-btn" title="Open Settings to switch Chat, Image, or Fallback AI Mode">🤖 AI Models · ⚙</button>
            <button type="button" class="gbtn waffle-reset-btn" id="waffle-ai-reset" title="Start a fresh chat — this one stays in the rail">New Chat</button>
            <button type="button" class="window-close-x" id="waffle-ai-close" aria-label="Close Waffle AI">✕</button>
          </div>
        </div>
        <div class="waffle-disclaimer-box" id="waffle-ai-disclaimer">
          <div class="waffle-disclaimer-head">
            <strong>⚠ Local AI</strong>
            <span class="waffle-device-pill is-risk" id="waffle-ai-device-status">Checking WebGPU…</span>
          </div>
          <p class="waffle-disclaimer-copy">${esc(AI_WARNING_SHORT)}</p>
          ${saveRowHtml}
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
        <button type="button" class="gbtn waffle-img-toggle" id="waffle-ai-img-toggle" aria-pressed="false" title="Toggle Image Generation mode (FLUX.2 Klein 4B — needs WebGPU)">🎨 Image</button>
        <textarea id="waffle-ai-input" class="waffle-ai-input" rows="1" placeholder="Ask Sir Waffle, attach a file, /search <query>, or /imagine <prompt>…" aria-label="Message Waffle AI"></textarea>
        <button type="submit" class="gbtn gbtn-primary waffle-send-btn" id="waffle-ai-send">Send</button>
        <button type="button" class="gbtn waffle-stop-btn" id="waffle-ai-stop" hidden>Stop</button>
      </form>
      </div><!-- /.waffle-ai-main -->
      </div><!-- /.waffle-ai-shell -->
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
    // Starts a new thread instead of destroying this one: the old conversation
    // is in the rail now, so "New Chat" no longer means "lose it".
    startNewChat();
  });

  // Optional chaining rather than an `if`: these handlers are the whole rail,
  // and a build without one simply has nothing here to listen.
  wrap.querySelector('#waffle-ai-rail-toggle')?.addEventListener('click', () => {
    playPop(railOpen ? 460 : 640);
    setRailOpen(!railOpen);
  });
  wrap.querySelector('#waffle-ai-rail-close')?.addEventListener('click', () => setRailOpen(false));
  // Where the rail is a drawer it gets a scrim, and the scrim is the shell's own
  // pseudo-element — so a tap on it arrives here as the shell itself. Only that
  // tap closes the rail: on a desk the rail is a sidebar with no scrim over
  // anything, and clicking the conversation must keep doing what it says.
  wrap.querySelector('.waffle-ai-shell')?.addEventListener('click', e => {
    if (e.target !== e.currentTarget || !railOpen) return;
    if (window.innerWidth >= 900) return;
    playPop(420);
    setRailOpen(false);
  });
  wrap.querySelector('#waffle-ai-new-chat')?.addEventListener('click', () => startNewChat());
  wrap.querySelector('#waffle-ai-export')?.addEventListener('click', () => exportChats());
  wrap.querySelector('#waffle-ai-clear-all')?.addEventListener('click', () => clearAllChats());

  const importIn = wrap.querySelector('#waffle-ai-import-in');
  wrap.querySelector('#waffle-ai-import')?.addEventListener('click', () => importIn?.click());
  importIn?.addEventListener('change', () => {
    if (importIn.files?.[0]) importChats(importIn.files[0]);
    importIn.value = '';
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
      // Escape steps back one level at a time: drawer first, kitchen second.
      if (railOpen) { setRailOpen(false); return; }
      closeWaffleAI();
    }
  });

  document.body.append(wrap);
  return wrap;
}

export function openWaffleAI() {
  // Paused: show the notice instead of a chat that cannot answer.
  if (isWaffleAiLocked()) { openLockedWaffleAI(); return; }
  if (!overlayEl) overlayEl = buildOverlay();
  overlayEl.hidden = false;
  document.body.classList.add('waffle-modal-open');
  // Asked on open rather than left to the badge: every other path into
  // renderOsAsk() runs after something async settles, and a question that
  // depends on a probe resolving is a question that sometimes never gets asked.
  renderOsAsk();
  renderAttachments();
  renderMessages();
  syncComposerState();
  fetchStatus();
  // Storage answers after the overlay is already on screen, so the saved
  // conversation is swapped in and repainted when it arrives.
  ensureChatStore().then(() => {
    renderMessages();
    syncComposerState();
    updateSavingPill();
    // After the saved conversation is swapped in, or the notice would be
    // overwritten by the thread it was appended to.
    offerCutOffRun();
  }).catch(() => {
    chatSaving = 'failed';
    updateSavingPill();
    offerCutOffRun();
  });
  detectDeviceDiagnostics().then(d => {
    deviceDiag = d;
    updateStatusBadge();
  }).catch(() => {});
  detectImageCapabilities().then(caps => {
    imageCaps = caps;
    updateStatusBadge();
  }).catch(() => {});
  // The rail is a sidebar where there is room for one and a drawer where there
  // is not — starting a phone with a panel over the conversation would hide the
  // very thing it was opened for.
  setRailOpen(typeof window !== 'undefined' && window.innerWidth >= 900);
  if (!modelState.loaded && !modelState.loading) warmupWaffleAI();
  setTimeout(() => overlayEl?.querySelector('#waffle-ai-input')?.focus(), 40);
}
