/**
 * Console telemetry for the whole kitchen.
 *
 * Every rule here comes from one requirement: a line in the console is only
 * worth its cost if it is *true*. So nothing in this module invents a value.
 * Durations come from `performance.now()` around the call that actually ran,
 * token counts come from the fitter that actually fitted the prompt, engine
 * facts come from the adapter and the diagnostics that measured it, and network
 * facts come from the `Response` object the browser handed back. Where a number
 * is not available it is reported as `unknown`, never as a plausible guess —
 * a fabricated figure in a debugging tool is worse than no figure at all,
 * because it gets believed.
 *
 * Games & Fun is deliberately not wired up. Those are animations on a rAF loop
 * where a console line per frame would cost more than the thing being measured.
 *
 * The AI turn ledger at the bottom exists because of a specific bug: Waffle AI
 * freezing after exactly three or four replies on a machine with plenty of GPU.
 * A freeze at a fixed, small turn count is what a resource that accumulates and
 * is never released looks like, and the obvious candidate is the KV cache
 * inside a context window that both the prompt and the reply have to share.
 * That cannot be confirmed by reading Wllama's source — the cache lives in
 * llama.cpp's C++ inside the wasm module, and the JS layer is bundled glue. So
 * the ledger records, per turn, what was asked of the window and what came
 * back, and the turn at which it stops is the answer.
 */

let enabled = true;

/* ------------------------------------------------------------------ *
 * Whether this kitchen ships the console log at all
 *
 * 1.3 put the log in both kitchens on purpose: the device that needed
 * diagnosing was a visitor's tablet, and a diagnostic that only exists
 * in the build a developer opens cannot hear from the devices that
 * break. 1.3.1 takes it back out of the public one. The log earned its
 * keep -- it is how the reasoning-model bug and the missing WebGPU
 * adapter were found -- and a shipping kitchen does not need to keep
 * paying for it on every visitor's device: an object allocated per
 * utility mount and per AI turn, on a page whose job is a calculator.
 *
 * So it is a test-kitchen instrument now, and the test kitchen is where
 * a build gets tried before everybody is asked to run it.
 *
 * The default is `true`, which looks backwards for a gate that is off
 * in the public kitchen. It is not: this module is unit-tested in Node,
 * where there is no `document` and so no build flag to read, and a
 * default of `false` would silence every test that asserts a line was
 * recorded. The app is the only place that knows which kitchen it is,
 * so the app says so once at boot and the module obeys.
 * ------------------------------------------------------------------ */
let shipped = true;

/** Whether this kitchen keeps the console log. Set once, at boot, by the app. */
export function setConsoleLogShipped(v) {
  shipped = Boolean(v);
  if (!shipped) { entries.length = 0; }
  return shipped;
}

/** Read the gate: what the panel markup and the log button are built from. */
export function consoleLogShipped() { return shipped; }

/** Turn telemetry off without a rebuild. Exposed for a console kill switch. */
export function setTelemetryEnabled(v) {
  enabled = Boolean(v);
  return enabled;
}

export function telemetryEnabled() { return enabled; }

/* ------------------------------------------------------------------ *
 * The on-screen copy
 *
 * A console is no use on a device that has no DevTools, which describes the
 * tablet this kitchen most needs diagnosing on. So every line is also kept in a
 * bounded buffer that the Settings panel can render and the visitor can copy out
 * and paste, the same way they paste the device report.
 *
 * Recording happens whether or not console output is enabled: silencing the
 * console is a reasonable thing to want, and it should not blind the panel.
 * ------------------------------------------------------------------ */

const MAX_ENTRIES = 80;
const entries = [];
const listeners = new Set();

function record(level, scope, event, facts) {
  // One gate for both the buffer and the console, so a kitchen that does not
  // ship the log cannot half-ship it: a panel with nothing in it is worse than
  // no panel, and a console line nobody can read on a tablet is just cost.
  if (!shipped) return;
  try {
    entries.push({ t: Date.now(), level, scope, event, facts: facts && typeof facts === 'object' ? facts : null });
    // Bounded, oldest first out. A log that grows without limit on a device
    // with 8 GB and a long chat is how a diagnostic becomes the problem.
    if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  } catch { return; }
  for (const fn of [...listeners]) { try { fn(); } catch {} }
}

export function telemetryEntries() { return entries.slice(); }
export function telemetryCount() { return entries.length; }

export function clearTelemetry() {
  entries.length = 0;
  for (const fn of [...listeners]) { try { fn(); } catch {} }
}

/** Re-render on every new line. Returns the unsubscribe function. */
export function subscribeTelemetry(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * One value as text. `null`, `undefined` and `''` all print as `unknown` rather
 * than as nothing, because on a copied log the difference between "measured as
 * absent" and "not printed" is exactly the thing being debugged. The empty
 * string counts as absent on purpose: in this codebase it arrives from `|| ''`
 * fallbacks such as an adapter that reported no name, so it means "nobody said",
 * not "the answer was blank".
 */
function fmtVal(v) {
  if (v === null || v === undefined || v === '') return 'unknown';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (Array.isArray(v)) return v.length ? v.join('|') : 'none';
  if (typeof v === 'object') { try { return JSON.stringify(v); } catch { return 'unserialisable'; } }
  const s = String(v);
  return /[\s=]/.test(s) ? JSON.stringify(s) : s;
}

/** One entry as one line, copy-pasteable and greppable. */
export function formatEntry(e) {
  const clock = new Date(e.t).toISOString().slice(11, 23);
  const facts = e.facts
    ? ' ' + Object.keys(e.facts).map(k => `${k}=${fmtVal(e.facts[k])}`).join(' ')
    : '';
  return `${clock} ${e.level === 'warn' ? 'WARN' : '    '} [waffle:${e.scope}] ${e.event}${facts}`;
}

/** The whole buffer as text, oldest first, for the copy button. */
export function formatTelemetryLog() {
  return entries.map(formatEntry).join('\n');
}

const stamp = () => {
  try { return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(); }
  catch { return Date.now(); }
};

/** The clock the module measures with, so callers and logs share one timeline. */
export function telNow() { return stamp(); }

/** Milliseconds since an earlier `telNow()`, to one decimal. Never negative. */
export function elapsedMs(from) {
  const ms = stamp() - Number(from);
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms * 10) / 10) : null;
}

/**
 * One console line. `facts` is printed as an object rather than interpolated
 * into a string so the browser's own inspector keeps it expandable and the
 * numbers stay numbers — a stringified 2048 cannot be compared or sorted.
 */
export function telLog(scope, event, facts = null) {
  record('log', scope, event, facts);
  if (!shipped || !enabled) return;
  try {
    const tag = `[waffle:${scope}]`;
    if (facts && typeof facts === 'object') console.log(tag, event, facts);
    else console.log(tag, event);
  } catch { /* a logger that throws would take the utility down with it */ }
}

export function telWarn(scope, event, facts = null) {
  record('warn', scope, event, facts);
  if (!shipped || !enabled) return;
  try {
    const tag = `[waffle:${scope}]`;
    if (facts && typeof facts === 'object') console.warn(tag, event, facts);
    else console.warn(tag, event);
  } catch {}
}

/**
 * Run `fn`, returning its value and how long it really took. Sync only — the
 * mounts this wraps are sync, and an async wrapper would report the time to
 * the first `await` rather than the time to a painted tool.
 */
export function measured(fn) {
  const t0 = stamp();
  let value = null;
  let error = null;
  try { value = fn(); } catch (err) { error = err; }
  const ms = elapsedMs(t0);
  if (error) throw Object.assign(error, { waffleMountMs: ms });
  return { value, ms };
}

/**
 * Wrap a utility's mount call. This is the single hook that covers all 105
 * non-game utilities, because every one of them is opened through `openTool`,
 * which dispatches by cupboard and nothing else.
 *
 * `cleanupReturned` matters more than it looks: a mount that returns no cleanup
 * function is a mount that intends to leave listeners behind, and that is how a
 * tool that was opened and closed forty times ends up holding forty sets of
 * handlers. It is read off the real return value, not assumed.
 */
export function traceToolMount({ id, name, cupboard, mount }) {
  try {
    const { value, ms } = measured(mount);
    telLog('tool', `${id} mounted`, {
      cupboard,
      name,
      mountMs: ms,
      cleanupReturned: typeof value === 'function',
      rendered: Boolean(value) || value === undefined
    });
    return value;
  } catch (err) {
    telWarn('tool', `${id} mount FAILED`, {
      cupboard,
      // `measured` times the failure too, so a mount that dies slowly says so.
      mountMs: Number.isFinite(err?.waffleMountMs) ? err.waffleMountMs : null,
      // The real error, not a paraphrase. `String(err)` loses a DOMException's
      // name, which is the part that distinguishes an abort from a crash.
      error: err?.name || 'Error',
      message: String(err?.message || err).slice(0, 400)
    });
    throw err;
  }
}

/** A utility's own async work: a fetch, a file read, a decode. */
export async function traceAsync(scope, event, fn) {
  const t0 = stamp();
  try {
    const value = await fn();
    telLog(scope, event, { ms: elapsedMs(t0), ok: true });
    return value;
  } catch (err) {
    telWarn(scope, `${event} FAILED`, {
      ms: elapsedMs(t0),
      error: err?.name || 'Error',
      message: String(err?.message || err).slice(0, 400)
    });
    throw err;
  }
}

/**
 * Real network facts from a real `Response`. Status, ok and the URL come off
 * the object; size is only reported when the browser actually told us, because
 * `content-length` is absent on chunked and compressed responses and inventing
 * a byte count would defeat the purpose.
 */
export function netFacts(url, res, ms, bodyBytes = null) {
  let declared = null;
  try {
    const cl = res?.headers?.get?.('content-length');
    if (cl != null && Number.isFinite(Number(cl))) declared = Number(cl);
  } catch {}
  return {
    url: String(url || '').slice(0, 200),
    status: Number.isFinite(res?.status) ? res.status : null,
    ok: Boolean(res?.ok),
    ms: Number.isFinite(ms) ? ms : null,
    bytes: Number.isFinite(bodyBytes) ? bodyBytes : declared,
    bytesSource: Number.isFinite(bodyBytes) ? 'measured' : (declared != null ? 'content-length' : 'unknown')
  };
}

/** Real storage facts, or `unknown` where the browser will not say. */
export async function storageFacts() {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return { available: 'unknown' };
    const est = await navigator.storage.estimate();
    return {
      quotaBytes: Number.isFinite(est?.quota) ? est.quota : null,
      usedBytes: Number.isFinite(est?.usage) ? est.usage : null,
      persisted: typeof navigator.storage?.persisted === 'function' ? await navigator.storage.persisted().catch(() => 'unknown') : 'unknown'
    };
  } catch { return { available: 'unknown' }; }
}

/* ------------------------------------------------------------------ *
 * The AI turn ledger
 * ------------------------------------------------------------------ */

/**
 * Per-turn accounting for Wllama chat. Module-level on purpose: the thing being
 * hunted accumulates across calls to the same loaded model, so the counter has
 * to live as long as the model does and reset when the model is thrown away.
 */
let turnNo = 0;
let cumulativePromptTokens = 0;
let ledgerModel = null;

/** A fresh Wllama instance means a fresh context, so the ledger starts again. */
export function resetAiTurnLedger(modelKey = null) {
  turnNo = 0;
  cumulativePromptTokens = 0;
  ledgerModel = modelKey;
}

export function aiTurnLedger() {
  return { turnNo, cumulativePromptTokens, model: ledgerModel };
}

/**
 * Record one completed (or failed) chat turn.
 *
 * `nCtx` is the window the model was actually loaded with, and `promptTokens`
 * is what was actually sent into it. `cumulativePromptTokens` is the running
 * total across turns on this same loaded model, which is the number to compare
 * against `nCtx` when a freeze arrives: if it climbs past the window, the
 * context is being filled and never released, and the turn that stops is the
 * turn that ran out of room.
 *
 * Every field is supplied by the caller from a value it really holds. Nothing
 * here defaults to a number.
 */
export function logAiTurn(facts = {}) {
  turnNo += 1;
  const promptTokens = Number.isFinite(facts.promptTokens) ? facts.promptTokens : null;
  if (promptTokens != null) cumulativePromptTokens += promptTokens;

  const line = {
    turn: turnNo,
    model: facts.model ?? 'unknown',
    quant: facts.quant ?? 'unknown',
    runtime: facts.useGpu ? 'WebGPU' : 'CPU WASM',
    nCtx: Number.isFinite(facts.nCtx) ? facts.nCtx : null,
    promptTokens,
    systemTokens: Number.isFinite(facts.systemTokens) ? facts.systemTokens : null,
    replyTokensRequested: Number.isFinite(facts.maxTokensRequested) ? facts.maxTokensRequested : null,
    replyTokensAllowed: Number.isFinite(facts.effectiveMaxTokens) ? facts.effectiveMaxTokens : null,
    historyKept: Number.isFinite(facts.historyKept) ? facts.historyKept : null,
    historyDropped: Number.isFinite(facts.historyDropped) ? facts.historyDropped : null,
    slotReused: facts.slotReused === true,
    instanceWasDirty: facts.instanceWasDirty === true,
    loadMs: Number.isFinite(facts.loadMs) ? facts.loadMs : null,
    msToFirstToken: Number.isFinite(facts.msToFirstToken) ? facts.msToFirstToken : null,
    totalMs: Number.isFinite(facts.totalMs) ? facts.totalMs : null,
    chunks: Number.isFinite(facts.chunks) ? facts.chunks : null,
    replyChars: Number.isFinite(facts.replyChars) ? facts.replyChars : null,
    replyTokensSeen: Number.isFinite(facts.replyTokensSeen) ? facts.replyTokensSeen : null,
    // Derived from two measured numbers, so it is real: tokens the model
    // actually produced over the time it actually took to produce them. Null
    // rather than 0 when either half is missing.
    tokensPerSec: Number.isFinite(facts.replyTokensSeen) && Number.isFinite(facts.genMs) && facts.genMs > 0
      ? Math.round((facts.replyTokensSeen / (facts.genMs / 1000)) * 10) / 10
      : null,
    cumulativePromptTokens,
    outcome: facts.outcome || 'unknown'
  };

  // The comparison that matters, printed rather than left to be done by hand.
  if (Number.isFinite(line.nCtx) && line.nCtx > 0) {
    line.windowHeadroomTokens = line.nCtx - cumulativePromptTokens;
    line.windowExhausted = cumulativePromptTokens >= line.nCtx;
  }

  const emit = line.outcome === 'ok' ? telLog : telWarn;
  emit('ai', `chat turn ${turnNo}`, line);
  return line;
}

/**
 * The device half of an AI turn, taken from the diagnostics that measured it.
 * Kept separate from the per-turn line because it does not change between
 * turns, and repeating it every reply would bury the numbers that do.
 */
export function logAiDeviceFacts(diag) {
  if (!diag) { telWarn('ai', 'no diagnostics available'); return null; }
  const facts = {
    adapter: diag.adapterName || 'unknown',
    hasWebGPU: Boolean(diag.hasWebGPU),
    fp16Exposed: Boolean(diag.hasF16),
    wllamaGpuSafe: Boolean(diag.wllamaGpuSafe),
    threads: diag.canThread ? 'yes' : 'no',
    cores: Number.isFinite(diag.cores) ? diag.cores : null,
    deviceMemoryGB: Number.isFinite(diag.deviceMemoryGB) ? diag.deviceMemoryGB : null,
    wasmBudgetMB: Number.isFinite(diag.wasmBudgetBytes) ? Math.round(diag.wasmBudgetBytes / 1024 ** 2) : null,
    adapterFactLine: diag.adapterFactLine || null
  };
  telLog('ai', 'device', facts);
  return facts;
}
