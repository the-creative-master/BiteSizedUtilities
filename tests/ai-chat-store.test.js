/**
 * The chat store: what a conversation is, where it goes, and what happens when
 * the browser will not take it.
 *
 * IndexedDB gets a fake here rather than being skipped, because it is the path
 * that ships — a store that is only ever tested against an in-memory Map proves
 * nothing about the one a real kitchen uses. The fake is deliberately small:
 * open, one object store, and the five requests the backend actually issues.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UNTITLED, MAX_THREADS, THREAD_IMAGE_BUDGET, CHAT_EXPORT_KIND, CHAT_EXPORT_KIND as KIND,
  makeThread, makeThreadId, sizeOf, titleFrom, sanitizeMessage, sanitizeThread, stripImages, byRecency,
  memoryBackend, localStorageBackend, indexedDbBackend, openChatStore, createChatStore,
  parseExport, importThreads
} from '../waffle-chat-store.js';

/** A minimal IndexedDB: enough for the backend, and enough to fail on demand. */
function fakeIndexedDb({ failOpen = false, failPut = null } = {}) {
  const rows = new Map();
  const puts = [];
  const req = (result, error) => {
    const r = { result, error, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
    setTimeout(() => { if (error) r.onerror?.(); else r.onsuccess?.(); }, 0);
    return r;
  };
  const store = () => ({
    createIndex() {},
    getAll: () => req([...rows.values()]),
    get: id => req(rows.get(id) || null),
    put: t => { puts.push(t); if (failPut) return req(null, failPut); rows.set(t.id, t); return req(t.id); },
    delete: id => { rows.delete(id); return req(); },
    clear: () => { rows.clear(); return req(); }
  });
  const db = {
    objectStoreNames: { contains: () => Boolean(db._made) },
    createObjectStore() { db._made = true; return store(); },
    transaction: () => ({ objectStore: store }),
    close() {}
  };
  return {
    puts,
    rows,
    open() {
      if (failOpen) {
        const r = req(null, new Error('opening is not allowed here'));
        r.onupgradeneeded = null;
        return r;
      }
      const r = req(db);
      setTimeout(() => r.onupgradeneeded?.(), 0);
      return r;
    }
  };
}

function fakeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k), get length() { return map.size; } };
}

const user = (text, extra = {}) => ({ role: 'user', content: text, displayContent: text, ...extra });
const bot = (text, extra = {}) => ({ role: 'assistant', authorLabel: 'Sir Waffle', content: text, ...extra });

test('a thread round-trips through IndexedDB, newest first', async () => {
  const idb = fakeIndexedDb();
  const backend = indexedDbBackend(idb);
  assert.ok(backend, 'the backend is built when a factory is there');
  const store = createChatStore(backend);
  assert.equal(store.kind, 'indexedDB');

  const older = { ...makeThread(1000), messages: [user('first ever question'), bot('first answer')] };
  const newer = { ...makeThread(2000), messages: [user('second question'), bot('second answer')] };
  await store.save(older, { now: 1000 });
  await store.save(newer, { now: 2000 });

  const list = await store.list();
  assert.equal(list.length, 2);
  assert.equal(list[0].id, newer.id, 'the rail reads newest first');
  assert.equal(idb.rows.size, 2, 'and both are actually in the database, not just in the store array');

  const fetched = await store.get(newer.id);
  assert.equal(fetched.messages.length, 2);
  await store.remove(newer.id);
  assert.equal((await store.list()).length, 1);
  await store.clear();
  assert.equal((await store.list()).length, 0);
});

test('a thread is named after the first thing somebody said', () => {
  assert.equal(titleFrom([bot('hello')]), UNTITLED, 'a greeting from Sir Waffle is not a title');
  assert.equal(titleFrom([]), UNTITLED);
  assert.equal(titleFrom([user('Fix my python function')]), '🧾 Fix my python function', 'code words get the code emoji');
  assert.equal(titleFrom([user('/imagine a waffle in space')]), '🎨 a waffle in space', 'and an image prompt gets the palette');
  assert.equal(titleFrom([user('waffle recipe for Sunday')]), '🧇 waffle recipe for Sunday', 'the kitchen gets a waffle');
  assert.equal(titleFrom([user('what is the capital of Peru')]), '🔎 what is the capital of Peru');
  assert.equal(titleFrom([user('hello there')]), '💬 hello there', 'anything else gets a plain bubble');

  const long = user('x'.repeat(120));
  const titled = titleFrom([long]);
  // An emoji, a space, 44 characters of the message and an ellipsis: the widest
  // a rail entry can get, whatever somebody typed.
  assert.equal(titled.length, 48, `a title stays short enough for a rail (got ${titled.length})`);
  assert.match(titled, /…$/, 'and says it was cut');

  assert.equal(titleFrom([user('**bold** and `code` and [a](b)')]), '🧾 bold and code and a b', 'markdown punctuation does not leak into the rail, though the words do');
  assert.equal(titleFrom([{ role: 'user', content: ['a paragraph', 'another paragraph'] }]), '💬 a paragraph another paragraph', 'nor does a multi-part message');
});

test('saving keeps the conversation and drops the parts still in flight', async () => {
  const store = createChatStore(memoryBackend());
  const thread = {
    ...makeThread(5000),
    messages: [
      user('draw me a syrup bottle'),
      bot('', { imagePrompt: 'syrup bottle', imageProgress: { stage: 'Diffusing…', percent: 44 } }),
      bot('Here it is!', { imageResult: { dataUrl: 'data:image/png;base64,AAAA' } })
    ]
  };
  const { saved } = await store.save(thread, { now: 5000 });
  assert.equal(saved, true);
  const [stored] = await store.list();
  assert.equal(stored.messages.length, 2, 'the half-finished bubble is not a memory');
  assert.ok(!stored.messages.some(m => m.imageProgress), 'and no progress bar is written down');
  assert.equal(stored.messages[1].imageResult.dataUrl, 'data:image/png;base64,AAAA', 'a finished image is kept');
  assert.match(stored.title, /^🎨/, 'the title came from the request');
});

test('a thread too big for one origin loses its pictures, not its words', async () => {
  const store = createChatStore(memoryBackend());
  const bigImage = `data:image/png;base64,${'A'.repeat(THREAD_IMAGE_BUDGET)}`;
  const thread = { ...makeThread(7000), messages: [user('imagine a very large waffle'), bot('done', { imageResult: { dataUrl: bigImage } })] };
  assert.ok(sizeOf(thread) > THREAD_IMAGE_BUDGET, 'the fixture really is over the budget');

  const result = await store.save(thread, { now: 7000 });
  assert.equal(result.saved, true);
  assert.equal(result.droppedImages, true, 'and it says so rather than doing it quietly');
  const [stored] = await store.list();
  assert.equal(stored.messages[1].imageResult.dataUrl, '', 'the picture is gone');
  assert.equal(stored.messages[1].imageResult.droppedForSpace, true, 'with a flag a bubble can explain');
  assert.equal(stored.messages[0].content, 'imagine a very large waffle', 'the words all survived');
});

test('a browser that runs out of room gets the same answer on the second try', async () => {
  const quota = Object.assign(new Error('quota exceeded'), { name: 'QuotaExceededError' });
  const idb = fakeIndexedDb({ failPut: quota });
  const store = createChatStore(indexedDbBackend(idb));
  const thread = { ...makeThread(9000), messages: [user('hello'), bot('hi', { imageResult: { dataUrl: 'data:image/png;base64,BBBB' } })] };

  const result = await store.save(thread, { now: 9000 });
  assert.equal(result.saved, false, 'when even the smaller copy will not fit, it admits that');
  assert.equal(result.droppedImages, true);
  assert.ok(result.error, 'and hands back the reason');
  assert.equal(idb.puts.length, 2, 'it tried the whole thread, then the thread without its pictures');
  assert.ok(!idb.puts[1].messages.some(m => m.imageResult?.dataUrl), 'and the retry really was the smaller one');
});

test('the rail cannot grow without end', async () => {
  const store = createChatStore(localStorageBackend(fakeStorage()));
  for (let i = 0; i < MAX_THREADS + 5; i += 1) {
    await store.save({ ...makeThread(1_000_000 + i), messages: [user(`question ${i}`), bot(`answer ${i}`)] }, { now: 1_000_000 + i });
  }
  const list = await store.list();
  assert.equal(list.length, MAX_THREADS, 'the oldest are dropped once the rail is full');
  assert.equal(list[0].title, `💬 question ${MAX_THREADS + 4}`, 'and the newest is still at the top');
});

test('the store falls back rather than giving up, and says which it got', async () => {
  const good = await openChatStore({ indexedDB: fakeIndexedDb() });
  assert.equal(good.kind, 'indexedDB');
  assert.equal(good.degraded, false, 'a real database is not a degraded one');

  const noIdb = await openChatStore({ indexedDB: null, localStorage: fakeStorage() });
  assert.equal(noIdb.kind, 'localStorage');
  assert.equal(noIdb.degraded, true, 'and anything less says so, because it holds less');

  const broken = await openChatStore({ indexedDB: fakeIndexedDb({ failOpen: true }), localStorage: fakeStorage() });
  assert.equal(broken.kind, 'localStorage', 'a database that will not open falls through to storage');

  const nothing = await openChatStore({ indexedDB: null, localStorage: null });
  assert.equal(nothing.kind, 'memory', 'and a browser that refuses both still gets a chat that lasts the visit');
});

test('a localStorage-backed kitchen keeps its chats across a reload', async () => {
  const storage = fakeStorage();
  const first = createChatStore(localStorageBackend(storage));
  await first.save({ ...makeThread(11), messages: [user('remember me'), bot('remembered')] }, { now: 11 });

  // A reload is a new store over the same storage, which is the whole claim.
  const second = createChatStore(localStorageBackend(storage));
  const list = await second.list();
  assert.equal(list.length, 1);
  assert.equal(list[0].messages[0].content, 'remember me');
});

test('an export is a file, and a file comes back', async () => {
  const store = createChatStore(memoryBackend());
  await store.save({ ...makeThread(21), messages: [user('export me'), bot('exported')] }, { now: 21 });
  const json = await store.exportJSON();
  const doc = JSON.parse(json);
  assert.equal(doc.kind, KIND);
  assert.equal(doc.version, 1, 'the export carries a version so an old file can be recognised');
  assert.equal(doc.threads.length, 1);

  const parsed = parseExport(json);
  assert.equal(parsed.threads.length, 1);
  assert.equal(parsed.threads[0].messages[0].content, 'export me');

  const into = createChatStore(memoryBackend());
  const tally = await importThreads(into, parsed.threads);
  assert.deepEqual(tally, { added: 1, updated: 0, skipped: 0 });
  assert.equal((await into.list()).length, 1);
});

test('importing an old file cannot roll a live conversation back', async () => {
  const store = createChatStore(memoryBackend());
  const id = makeThreadId(1);
  await store.save({ id, title: '💬 shared', createdAt: 1, updatedAt: 500, messages: [user('newest work')] }, { now: 500 });

  const stale = [{ id, title: '💬 shared', createdAt: 1, updatedAt: 100, messages: [user('older work')] }];
  const tally = await store.refresh().then(() => importThreads(store, stale));
  assert.deepEqual(tally, { added: 0, updated: 0, skipped: 1 }, 'the copy already here is newer, so nothing is written');
  const [kept] = await store.list();
  assert.equal(kept.messages[0].content, 'newest work');

  const ahead = [{ id, title: '💬 shared', createdAt: 1, updatedAt: 900, messages: [user('from another device')] }];
  const second = await importThreads(store, ahead);
  assert.deepEqual(second, { added: 0, updated: 1, skipped: 0 });
  assert.equal((await store.list())[0].messages[0].content, 'from another device');
});

test('a file that is not a chat export is refused, with a reason worth reading', () => {
  assert.throws(() => parseExport(''), /empty/);
  assert.throws(() => parseExport('   '), /empty/);
  assert.throws(() => parseExport('{not json'), /does not parse as JSON/);
  assert.throws(() => parseExport('{"kind":"something-else","threads":[]}'), /not a Waffle AI chat export/);
  assert.throws(() => parseExport(`{"kind":"${KIND}"}`), /no threads/);
  assert.throws(() => parseExport(`{"kind":"${KIND}","threads":[{"nope":true}]}`), /held no conversations/);
  assert.throws(() => parseExport(null), /empty/);
});

test('the helpers are safe about what they are handed', () => {
  assert.equal(sanitizeMessage(null), null);
  assert.equal(sanitizeMessage('a string'), null);
  assert.equal(sanitizeMessage({ role: 'assistant', content: '' }), null, 'an empty answer is dropped');
  assert.ok(sanitizeMessage({ role: 'assistant', content: '', isWelcome: true }), 'except the greeting, which is meant to be empty of news');
  assert.equal(sanitizeThread({}).messages.length, 0);
  assert.equal(sanitizeThread({ id: 7, title: 'x'.repeat(200) }).title.length, 80, 'a title is capped, whatever it came from');
  assert.deepEqual(byRecency([]), []);
  assert.ok(stripImages({ messages: [] }).imagesDroppedForSpace, 'stripping marks the thread it stripped');
});
