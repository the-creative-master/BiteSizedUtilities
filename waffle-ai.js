import { backupDoorMatches, openBackupKitchenDoor, BACKUP_DOOR_FILE } from './backup-door.js';
import { appVersionLabel } from './changelog.js';
import { buildWaffleSystemPrompt, stripModelScaffolding } from './waffle-persona.js';
import { waffleMascotSVG } from './icons-25d.js';
import { playPop, playBoing, playSquish, playSparkle } from './sfx.js';
import { copyToClipboard } from './ui-kit.js';
import { createDocxBlob, extractFilePayload, triggerFileDownload } from './file-tools-client.js';
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
  rankBrowserAttempts,
  OS_CHOICES,
  getDeclaredOS,
  setDeclaredOS,
  clearDeclaredOS,
  AI_DISCLAIMER_TEXT,
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
import { IMAGE_MODELS, detectImageCapabilities, generateWaffleImage } from './waffle-image-gen.js';

const STARTER_PROMPTS = [
  '/imagine a cozy golden waffle bakery at sunrise',
  'Make a .docx study guide on photosynthesis',
  'Write a Python binary search with examples',
  'Summarize my uploaded file in bullet points'
];

const WELCOME_MSG = {
  role: 'assistant',
  isWelcome: true,
  content: [
    'Hey there, kitchen friend! I’m **Sir Waffle**, your **Waffle AI** assistant.',
    '',
    '- **AI Models & Fallbacks (in ⚙ Settings)**: Choose **Qwen 2.5 1.5B**, **Qwen 2.5 Coder 1.5B**, **Qwen 3 0.6B**, **SmolLM2 135M (Chromium Safe)**, **SmolLM2 360M**, **Qwen 2.5 0.5B**, **Qwen 3.5 0.8B**, **Llama 3.2 1B**, or **DeepSeek R1 1.5B** (default **Compact Q3_K_L / q4** quantization for lighter Chromium memory)',
    '- **Image Generation**: Tap **🎨 Image** (or type `/imagine ...`) with **SDXS-512 (1-Step)** or **SD-Turbo (WebGPU)**',
    '- **Files & Images**: Attach `.docx`, `.pdf`, `.xlsx`, `.pptx`, `.txt`, code files, or images for **Qwen 3.5 0.8B Vision**!',
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
let lockedEl = null;
let messages = [WELCOME_MSG];
let attachments = [];
let isGenerating = false;
let activeAbort = null;
let modelState = { preCached: false, loaded: false, loading: false, serverReachable: null, available: [] };

/**
 * The local llama.cpp server only hosts the models in SERVER_MODELS, so when a
 * browser-only model is selected and the chain wants a server attempt, this is
 * what it asks for. Named once because the swap is worth being explicit about:
 * `report()` flags it via `swapped`, so a reply can say which model answered.
 */
const SERVER_FALLBACK_ID = 'qwen2.5-1.5b';
let codeArtifacts = [];
let imageMode = false;
let webSearchMode = false;
let imageCaps = { hasWebGPU: false, hasF16: false };
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
    const tiny = TEXT_MODELS.find(x => x.id === 'smollm2-135m');
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

  if (!fitsOnCpu && !gpuOk && !hasImages) {
    onStatus?.({
      state: 'loading',
      detail: `${cfg.label} is ~${Math.round(estBytes / 1024 ** 2)} MB but this device can only hold ~${Math.round(budgetBytes / 1024 ** 2)} MB without WebGPU — trying a smaller quant…`
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
  const id = getSelectedImageModel();
  return IMAGE_MODELS.find(m => m.id === id) || IMAGE_MODELS[0];
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
    diagEl.title = `${deviceDiag.deviceNote || deviceDiag.summaryLabel}\n\nTap to say which device this is.`;
    // The pill is the way back to the device question once it has been answered
    // or dismissed, so it has to look and act like something you can press.
    if (!diagEl.dataset.osDoor) {
      diagEl.dataset.osDoor = '1';
      diagEl.tabIndex = 0;
      diagEl.setAttribute('role', 'button');
      diagEl.addEventListener('click', () => { playPop?.(520); reopenOsAsk(); });
      diagEl.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playPop?.(520); reopenOsAsk(); }
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
    const imgNote = isUser && m.imageUrls?.length
      ? `<div class="waffle-msg-images">${m.imageUrls.map(u => `<img class="waffle-msg-img" src="${u}" alt="Uploaded image">`).join('')}</div>`
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
        renderMessages();
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
  const closing = overlayEl || lockedEl;
  if (!closing) return;
  if (activeAbort) activeAbort.abort();
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
          <li>Everything else in the kitchen &mdash; all 115 utilities and all 51 games &mdash; works exactly as before, on your device, with no account.</li>
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

function buildOverlay() {
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

    <div class="waffle-ai-dialog" role="dialog" aria-modal="true" aria-labelledby="waffle-ai-title">
      <div class="waffle-ai-header">
        <div class="window-grab-pill" aria-hidden="true"></div>
        <div class="waffle-ai-head-row">
          <div class="waffle-ai-title-wrap">
            <span class="waffle-ai-avatar" aria-hidden="true">${waffleMascotSVG('waffle-header-svg')}</span>
            <div>
              <h2 id="waffle-ai-title" class="waffle-ai-title">Waffle AI</h2>
              <span id="waffle-ai-badge" class="waffle-ai-badge">Checking runtimes…</span>
            </div>
          </div>
          <div class="waffle-ai-actions">
            <button type="button" class="gbtn waffle-reset-btn" id="waffle-ai-models-btn" title="Open Settings to switch Chat, Image, or Fallback AI Mode">🤖 AI Models · ⚙</button>
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
          <pre class="waffle-device-note" id="waffle-ai-device-note" hidden></pre>
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
