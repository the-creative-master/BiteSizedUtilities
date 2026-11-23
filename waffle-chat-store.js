/**
 * Where Waffle AI's conversations live between visits.
 *
 * Until this, a chat was a module-level array: closing the overlay kept it, but
 * reloading the kitchen — or opening it next week — started from Sir Waffle's
 * greeting again. Nothing was ever written down.
 *
 * What this does, and the limit it cannot get around:
 *
 *   Threads are kept in IndexedDB, so they survive reloads, restarts and months
 *   of disuse, and so a conversation with generated images in it does not have to
 *   fit in the ~5 MB the whole origin gets from localStorage.
 *
 *   They do NOT survive the browser clearing site data. Chrome and Firefox both
 *   file IndexedDB, localStorage, OPFS and the cache under the same heading, so
 *   "delete cookies and site data" takes all of it in one go, and there is no
 *   server here to hold a copy — the kitchen is a static site. The only thing
 *   that survives a wipe is a file somebody exported, which is why export and
 *   import are part of the store and not an afterthought, and why the rail says
 *   so out loud instead of letting a promise sit in a changelog.
 *
 * The store is a factory over a backend so the logic can be tested without a
 * browser: IndexedDB where it exists, localStorage where it does not (private
 * windows, older Safari, a page opened off a disk), and an in-memory backend for
 * the tests and for a browser that refuses both. Every backend is the same five
 * promises, so nothing above this line knows which one it got.
 */

export const CHAT_DB_NAME = 'waffle-ai-chats';
export const CHAT_DB_VERSION = 1;
export const CHAT_STORE_NAME = 'threads';
export const CHAT_LS_KEY = 'waffle-ai-chats-v1';
export const CHAT_EXPORT_KIND = 'waffle-ai-chats';
export const CHAT_EXPORT_VERSION = 1;

/** A conversation nobody has named yet starts as this, and stays this. */
export const UNTITLED = 'New chat';

/** Past this many threads the oldest are dropped, so the rail stays a rail. */
export const MAX_THREADS = 60;

/**
 * Past this many bytes a thread is saved without its pictures rather than not
 * saved at all. Generated images are data URLs, and one 512×512 PNG is around
 * half a megabyte of base64 — enough that a handful of image chats can outrun
 * the quota a browser will hand one origin.
 */
export const THREAD_IMAGE_BUDGET = 6 * 1024 * 1024;

export function makeThreadId(now = Date.now()) {
  return `chat-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeThread(now = Date.now()) {
  return { id: makeThreadId(now), title: UNTITLED, createdAt: now, updatedAt: now, messages: [] };
}

/** Rough byte size of anything JSON-able, without building the string twice. */
export function sizeOf(value) {
  try { return new TextEncoder().encode(JSON.stringify(value)).length; } catch { return 0; }
}

const EMOJI_RULES = [
  [/imagine|image|picture|draw|paint|logo|portrait|🎨/i, '🎨'],
  [/code|function|bug|error|regex|sql|python|javascript|typescript|html|css|json|🧾/i, '🧾'],
  [/recipe|bake|waffle|syrup|kitchen|cook|breakfast/i, '🧇'],
  [/math|solve|equation|calculate|number|fraction|algebra/i, '🔢'],
  [/translate|essay|write|poem|story|grammar|word|letter/i, '✍️'],
  [/search|news|weather|who|what is|when|where|why/i, '🔎']
];

/**
 * A thread is named after the first thing somebody actually said, which is how
 * every real chat app does it and the only naming that survives a month of not
 * looking. Falls back to "New chat" rather than inventing a title for a
 * conversation that never happened.
 */
export function titleFrom(messages, fallback = UNTITLED) {
  const first = (messages || []).find(m => m && m.role === 'user' && !m.isWelcome);
  const raw = first ? String(first.displayContent ?? (Array.isArray(first.content) ? first.content.join(' ') : first.content) ?? '') : '';
  const clean = raw
    .replace(/```[\s\S]*?```/g, ' code ')
    .replace(/^\s*\/[a-z]+\s+/i, '')
    .replace(/[*_`#>~[\]()!-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return fallback;
  // Matched against what was actually typed, not the cleaned-up title: a slash
  // command is the loudest signal of intent there is, and stripping it first
  // would have named every /imagine prompt after whatever noun came next.
  const emoji = (EMOJI_RULES.find(([re]) => re.test(raw) || re.test(clean)) || [, '💬'])[1];
  const words = clean.slice(0, 44);
  const trimmed = words.length < clean.length ? `${words.replace(/[\s,;:]+$/, '')}…` : words;
  return `${emoji} ${trimmed}`;
}

/**
 * What is worth keeping from a live message. Anything describing work still in
 * flight is dropped, because restoring it would show a chat frozen halfway
 * through an answer that will never arrive.
 */
export function sanitizeMessage(message) {
  if (!message || typeof message !== 'object') return null;
  const out = { ...message };
  delete out.imageProgress;
  delete out.streamPending;
  // An assistant bubble that never got an answer is not a memory, it is a stall.
  const empty = !out.content || (Array.isArray(out.content) && !out.content.some(Boolean)) || out.content === '';
  if (out.role === 'assistant' && empty && !out.imageResult && !out.isWelcome) return null;
  return out;
}

/** Images out, everything else kept — the fallback when a thread will not fit. */
export function stripImages(thread) {
  const messages = (thread.messages || []).map(m => {
    if (!m || typeof m !== 'object') return m;
    const out = { ...m };
    let dropped = false;
    if (Array.isArray(out.imageUrls) && out.imageUrls.length) { dropped = true; delete out.imageUrls; }
    if (out.imageResult?.dataUrl) { dropped = true; out.imageResult = { ...out.imageResult, dataUrl: '', droppedForSpace: true }; }
    if (dropped) out.imagesDroppedForSpace = true;
    return out;
  });
  return { ...thread, messages, imagesDroppedForSpace: true };
}

export function sanitizeThread(thread) {
  const messages = (thread.messages || []).map(sanitizeMessage).filter(Boolean);
  return {
    id: String(thread.id || makeThreadId()),
    title: String(thread.title || titleFrom(messages) || UNTITLED).slice(0, 80),
    createdAt: Number(thread.createdAt) || Date.now(),
    updatedAt: Number(thread.updatedAt) || Date.now(),
    messages,
    ...(thread.modelId ? { modelId: String(thread.modelId) } : {}),
    ...(thread.imagesDroppedForSpace ? { imagesDroppedForSpace: true } : {}),
    // A title somebody typed is kept as typed: without this flag the next save
    // would rename the thread from its first message all over again.
    ...(thread.renamed ? { renamed: true } : {})
  };
}

/** Newest first, which is the order a rail reads in. */
export function byRecency(threads) {
  return [...threads].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

// ---------------------------------------------------------------------------
// Backends. Five promises each, so the store above them never knows which it got.
// ---------------------------------------------------------------------------

export function memoryBackend(seed = []) {
  const rows = new Map(seed.map(t => [t.id, t]));
  return {
    kind: 'memory',
    async list() { return byRecency([...rows.values()]); },
    async get(id) { return rows.get(id) || null; },
    async put(thread) { rows.set(thread.id, thread); return thread; },
    async remove(id) { rows.delete(id); },
    async clear() { rows.clear(); },
    async close() {}
  };
}

export function localStorageBackend(storage = globalThis.localStorage, key = CHAT_LS_KEY) {
  const read = () => {
    try {
      const rows = JSON.parse(storage.getItem(key) || '[]');
      return Array.isArray(rows) ? rows.filter(r => r && r.id) : [];
    } catch { return []; }
  };
  const write = rows => storage.setItem(key, JSON.stringify(rows));
  return {
    kind: 'localStorage',
    async list() { return byRecency(read()); },
    async get(id) { return read().find(t => t.id === id) || null; },
    async put(thread) {
      const rows = read().filter(t => t.id !== thread.id);
      rows.push(thread);
      write(byRecency(rows).slice(0, MAX_THREADS));
      return thread;
    },
    async remove(id) { write(read().filter(t => t.id !== id)); },
    async clear() { write([]); },
    async close() {}
  };
}

function idbRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB request failed'));
  });
}

export function indexedDbBackend(idbFactory = globalThis.indexedDB, name = CHAT_DB_NAME) {
  if (!idbFactory) return null;
  let dbPromise = null;
  const open = () => {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        let req;
        try { req = idbFactory.open(name, CHAT_DB_VERSION); } catch (e) { return reject(e); }
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(CHAT_STORE_NAME)) {
            const store = db.createObjectStore(CHAT_STORE_NAME, { keyPath: 'id' });
            store.createIndex('updatedAt', 'updatedAt');
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('could not open the chat database'));
        req.onblocked = () => reject(new Error('the chat database is blocked by another tab'));
      }).catch(e => { dbPromise = null; throw e; });
    }
    return dbPromise;
  };
  const tx = async mode => (await open()).transaction(CHAT_STORE_NAME, mode).objectStore(CHAT_STORE_NAME);
  return {
    kind: 'indexedDB',
    async list() { return byRecency((await idbRequest(await tx('readonly').then(s => s.getAll()))) || []); },
    async get(id) { return (await idbRequest((await tx('readonly')).get(id))) || null; },
    async put(thread) { await idbRequest((await tx('readwrite')).put(thread)); return thread; },
    async remove(id) { await idbRequest((await tx('readwrite')).delete(id)); },
    async clear() { await idbRequest((await tx('readwrite')).clear()); },
    async close() { try { (await open()).close(); } catch {} }
  };
}

// ---------------------------------------------------------------------------
// The store
// ---------------------------------------------------------------------------

/**
 * Opens whichever backend this browser will actually give us, and reports which
 * one it settled on — the rail says so, because "saved in this browser" and
 * "saved in memory until you close the tab" are not the same promise.
 */
export async function openChatStore(prefer = {}) {
  const candidates = [];
  if (prefer.backend) candidates.push(prefer.backend);
  else {
    const idb = indexedDbBackend(prefer.indexedDB, prefer.dbName);
    if (idb) candidates.push(idb);
    if (prefer.localStorage || globalThis.localStorage) candidates.push(localStorageBackend(prefer.localStorage));
    candidates.push(memoryBackend());
  }
  for (const backend of candidates) {
    try {
      await backend.list();
      return { backend, kind: backend.kind, degraded: backend.kind !== 'indexedDB' };
    } catch {
      try { await backend.close(); } catch {}
    }
  }
  const backend = memoryBackend();
  return { backend, kind: 'memory', degraded: true };
}

export function createChatStore(backend) {
  let threads = [];

  /** Re-reads the backend. `list()` serves the cache; this does not. */
  async function refresh() {
    threads = sortedRows(await backend.list());
    return threads;
  }
  function sortedRows(rows) { return byRecency((rows || []).filter(r => r && r.id)); }

  async function save(thread, { now = Date.now() } = {}) {
    const clean = sanitizeThread({ ...thread, updatedAt: now, title: thread.title && thread.title !== UNTITLED ? thread.title : titleFrom(thread.messages) });
    let stored = clean;
    let droppedImages = false;
    if (sizeOf(clean) > THREAD_IMAGE_BUDGET) {
      stored = sanitizeThread(stripImages(clean));
      droppedImages = true;
    }
    try {
      await backend.put(stored);
    } catch (err) {
      // Out of room. Keep the words, lose the pictures, and say so — a chat that
      // silently fails to save is worse than one that admits it got smaller.
      if (!droppedImages) {
        stored = sanitizeThread(stripImages(clean));
        droppedImages = true;
        try { await backend.put(stored); } catch { return { saved: false, droppedImages, error: err }; }
      } else {
        return { saved: false, droppedImages, error: err };
      }
    }
    threads = sortedRows([...threads.filter(t => t.id !== stored.id), stored]);
    if (threads.length > MAX_THREADS) {
      for (const gone of threads.slice(MAX_THREADS)) { try { await backend.remove(gone.id); } catch {} }
      threads = threads.slice(0, MAX_THREADS);
    }
    return { saved: true, thread: stored, droppedImages };
  }

  return {
    get backend() { return backend; },
    get kind() { return backend.kind; },
    get threads() { return threads; },
    refresh,
    list: async () => threads.length ? threads : refresh(),
    get: async id => (await backend.get(id)) || null,
    save,
    remove: async id => { await backend.remove(id); threads = threads.filter(t => t.id !== id); },
    clear: async () => { await backend.clear(); threads = []; },
    /** Everything, as one JSON document somebody can keep on a disk. */
    async exportJSON() {
      const rows = await refresh();
      return JSON.stringify({ kind: CHAT_EXPORT_KIND, version: CHAT_EXPORT_VERSION, exportedAt: Date.now(), threads: rows }, null, 1);
    }
  };
}

/**
 * Reads an export back. Strict on purpose: this is a file that came from
 * outside, and the only thing worse than a failed restore is a rail full of
 * half-parsed conversations.
 */
export function parseExport(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('That file is empty.');
  let doc;
  try { doc = JSON.parse(text); } catch { throw new Error('That is not a Waffle AI chat file — it does not parse as JSON.'); }
  if (!doc || doc.kind !== CHAT_EXPORT_KIND) throw new Error('That JSON is not a Waffle AI chat export.');
  if (!Array.isArray(doc.threads)) throw new Error('That export has no threads in it.');
  const threads = doc.threads
    .filter(t => t && typeof t === 'object' && Array.isArray(t.messages))
    .map(t => sanitizeThread({ ...t, id: String(t.id || makeThreadId()) }));
  if (!threads.length) throw new Error('That export held no conversations to restore.');
  return { threads, version: Number(doc.version) || 1, exportedAt: Number(doc.exportedAt) || null };
}

/**
 * Restores an export alongside what is already here. Threads are matched by id,
 * and whichever copy has been touched more recently wins — so importing an old
 * file into a live kitchen cannot roll a conversation back.
 */
export async function importThreads(store, threads) {
  const existing = new Map((await store.refresh()).map(t => [t.id, t]));
  let added = 0, updated = 0, skipped = 0;
  for (const incoming of threads) {
    const here = existing.get(incoming.id);
    if (!here) { added += 1; }
    else if ((incoming.updatedAt || 0) > (here.updatedAt || 0)) { updated += 1; }
    else { skipped += 1; continue; }
    await store.save(incoming, { now: incoming.updatedAt || Date.now() });
  }
  await store.refresh();
  return { added, updated, skipped };
}
