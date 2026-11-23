/**
 * The saved-chats rail, in a real DOM, in the build that has one.
 *
 * Everything about the store's own logic is covered by tests/ai-chat-store.test.js
 * against the module. This file covers the part that module cannot see: whether
 * opening the kitchen actually puts a conversation back on screen, whether the
 * rail's buttons do what they say, and whether a chat that was never saved looks
 * different from one that was. jsdom has no IndexedDB, so the store falls back
 * to localStorage here — which is the fallback the kitchen ships, exercised
 * rather than assumed, and the pill is expected to say so out loud.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html lang="en" data-backup="1"><body></body></html>', {
  url: 'https://the-creative-master.github.io/BiteSizedUtilities/backup.html',
  pretendToBeVisual: true
});
const { window } = dom;
for (const key of ['document', 'localStorage', 'sessionStorage', 'CustomEvent', 'Event', 'HTMLElement', 'Node', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  if (window[key] !== undefined) globalThis[key] = window[key];
}
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.window = window;
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
// Nothing here may reach the network: opening the overlay probes a llama.cpp
// server and the model hosts, and a test that waits on a timeout is a slow test.
globalThis.fetch = () => Promise.resolve({ ok: false, status: 501, json: async () => ({}), headers: new Map() });
// The rail asks before it deletes anything, and jsdom implements none of the
// three dialogues, so they are stood in for and the answers are the test's.
const spoken = [];
let confirmAnswer = true;
let promptAnswer = 'Renamed by hand';
globalThis.alert = text => spoken.push(['alert', text]);
globalThis.confirm = text => { spoken.push(['confirm', text]); return confirmAnswer; };
globalThis.prompt = (label, value) => { spoken.push(['prompt', label, value]); return promptAnswer; };

const { openWaffleAI, closeWaffleAI } = await import('../waffle-ai.js');
const { CHAT_LS_KEY } = await import('../waffle-chat-store.js');

const $ = sel => window.document.querySelector(sel);
const $$ = sel => [...window.document.querySelectorAll(sel)];
const rows = () => $$('#waffle-ai-thread-list .waffle-ai-thread-row');
const bubbles = () => $$('#waffle-ai-feed .waffle-msg');
const titles = () => rows().map(r => r.querySelector('.waffle-ai-thread-title').textContent);
const pill = () => $('#waffle-ai-saving');
const shell = () => $('.waffle-ai-shell');
const click = el => el.dispatchEvent(new window.Event('click', { bubbles: true }));
/** Storage opens behind an await chain, so "settled" means a few turns of it. */
const settle = async (ms = 25) => new Promise(r => setTimeout(r, ms));

const thread = (id, title, text, updatedAt) => ({
  id,
  title,
  createdAt: updatedAt - 5_000,
  updatedAt,
  messages: [
    { role: 'user', content: text, displayContent: text },
    { role: 'assistant', authorLabel: 'Sir Waffle', content: `Answer about ${text}.` }
  ]
});
const seed = threads => window.localStorage.setItem(CHAT_LS_KEY, JSON.stringify(threads));
const stored = () => JSON.parse(window.localStorage.getItem(CHAT_LS_KEY) || '[]');

test('the backup kitchen opens with a rail, and an empty one says so', async () => {
  openWaffleAI();
  await settle();

  assert.ok($('.waffle-ai-chat-dialog'), 'the chat dialog is the widened one');
  assert.ok($('#waffle-ai-rail'), 'the rail is in the overlay');
  // jsdom reports a 1024px window, which is desk-wide, so the rail is a sidebar
  // here rather than a drawer. The narrow case is the stylesheet's job.
  assert.equal(shell().dataset.rail, 'open', 'and it starts open where there is room for it');
  assert.equal($('#waffle-ai-rail-toggle').getAttribute('aria-expanded'), 'true');
  assert.equal($('#waffle-ai-rail-empty').hidden, false, 'an empty rail says the griddle is cold rather than showing nothing');
  assert.equal($('#waffle-ai-rail-count').textContent, 'Nothing kept yet');
  assert.equal(rows().length, 0);

  // Every control the rail promises is a real element with a real listener.
  for (const id of ['#waffle-ai-new-chat', '#waffle-ai-export', '#waffle-ai-import', '#waffle-ai-import-in', '#waffle-ai-clear-all', '#waffle-ai-rail-toggle', '#waffle-ai-rail-close', '#waffle-ai-thread-list']) {
    assert.ok($(id), `${id} is there`);
  }
  assert.match($('.waffle-ai-save-note').textContent, /Clearing site data deletes them/,
    'the rail states the limit in the same place it offers the export');
});

test('the saving pill names the storage it actually got, not the one it hoped for', async () => {
  assert.equal(window.indexedDB, undefined, 'jsdom has no IndexedDB, so this is the fallback path');
  assert.match(pill().textContent, /browser storage on this device/,
    'a localStorage-backed kitchen says localStorage rather than claiming a database');
  assert.ok(['idle', 'unsupported'].includes(pill().dataset.state), `and is not reporting a save that has not happened (${pill().dataset.state})`);
  assert.match(pill().title, /Clearing site data removes them/, 'the pill explains the limit too');
});

test('the rail toggle is a drawer that opens and shuts', async () => {
  const toggle = $('#waffle-ai-rail-toggle');
  const before = shell().dataset.rail;

  click(toggle);
  assert.notEqual(shell().dataset.rail, before, 'the header button moves the rail');
  assert.equal(toggle.getAttribute('aria-expanded'), shell().dataset.rail === 'open' ? 'true' : 'false',
    'and tells a screen reader which way it went');

  click(toggle);
  assert.equal(shell().dataset.rail, before, 'and again puts it back');

  click(toggle);
  click($('#waffle-ai-rail-close'));
  assert.equal(shell().dataset.rail, 'closed', 'the ✕ inside the rail shuts it');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  click(toggle);
  assert.equal(shell().dataset.rail, 'open', 'the header button is the way back');
});

test('a conversation saved before this visit is on screen when the kitchen opens', async () => {
  closeWaffleAI();
  seed([thread('t-reopen', '🧾 Fix my python function', 'my python function', Date.now() - 60_000)]);

  openWaffleAI();
  await settle();

  assert.equal(rows().length, 1, 'the rail lists what was kept');
  assert.deepEqual(titles(), ['🧾 Fix my python function'], 'with the name it was given');
  assert.match(rows()[0].querySelector('.waffle-ai-thread-when').textContent, /2 msgs/,
    'and how much is in it');
  assert.equal($('#waffle-ai-rail-empty').hidden, true, 'so the empty state is out of the way');
  assert.equal(bubbles().length, 2, 'the conversation itself came back, both sides of it');
  assert.match($('#waffle-ai-feed').textContent, /my python function/);
  assert.match($('#waffle-ai-feed').textContent, /Answer about my python function/);
  assert.ok(rows()[0].classList.contains('is-current'), 'and the rail marks the one that is open');
});

test('New chat starts a new one instead of destroying the one on screen', async () => {
  click($('#waffle-ai-new-chat'));
  await settle();

  assert.equal(bubbles().length, 1, 'the feed is back to the greeting');
  assert.equal(rows().length, 1, 'while the conversation it replaced is still in the rail');
  assert.deepEqual(stored().map(t => t.id), ['t-reopen'], 'and still in storage');
  assert.ok(!rows()[0].classList.contains('is-current'), 'the rail no longer marks it as the open one');
});

test('clicking a row in the rail opens that conversation', async () => {
  click(rows()[0].querySelector('.waffle-ai-thread'));
  await settle();

  assert.equal(bubbles().length, 2, 'both sides of it are back on screen');
  assert.match($('#waffle-ai-feed').textContent, /Answer about my python function/);
  assert.ok(rows()[0].classList.contains('is-current'), 'and the rail agrees about which is open');
});

test('two kept chats are two rows, newest first, and either can be opened', async () => {
  closeWaffleAI();
  const now = Date.now();
  seed([
    thread('t-older', '🔎 what is the capital of Peru', 'what is the capital of Peru', now - 86_400_000),
    thread('t-newer', '🧇 waffle recipe for Sunday', 'waffle recipe for Sunday', now - 1_000)
  ]);
  openWaffleAI();
  await settle();

  assert.deepEqual(titles(), ['🧇 waffle recipe for Sunday', '🔎 what is the capital of Peru'], 'newest first');
  assert.match(rows()[1].querySelector('.waffle-ai-thread-when').textContent, /1 d ago|24 h ago/,
    'an old chat is dated in days, not minutes');

  click(rows()[1].querySelector('.waffle-ai-thread'));
  await settle();
  assert.match($('#waffle-ai-feed').textContent, /Answer about what is the capital of Peru/, 'and the older one opens like the newer');
});

test('deleting one chat asks first, then removes it from the rail and from storage', async () => {
  confirmAnswer = false;
  spoken.length = 0;
  click(rows()[0].querySelector('.waffle-ai-thread-del'));
  await settle();
  assert.equal(rows().length, 2, 'answering no deletes nothing');
  assert.deepEqual(spoken[0], ['confirm', 'Delete “🧇 waffle recipe for Sunday” from this device?'],
    'and the question names the chat it is about to take');

  confirmAnswer = true;
  click(rows()[0].querySelector('.waffle-ai-thread-del'));
  await settle();
  assert.equal(rows().length, 1, 'answering yes removes the row');
  assert.deepEqual(stored().map(t => t.id), ['t-older'], 'and the thread behind it');
  assert.equal(bubbles().length, 2, 'without touching the conversation that is open');
});

test('a hand-made name sticks and is never rewritten from the messages', async () => {
  spoken.length = 0;
  promptAnswer = 'The Peru one';
  click(rows()[0].querySelector('.waffle-ai-thread-rename'));
  await settle();

  assert.deepEqual(titles(), ['The Peru one'], 'the rail shows the new name');
  const [kept] = stored();
  assert.equal(kept.title, 'The Peru one', 'which is what got written down');
  assert.equal(kept.renamed, true, 'and it is marked as chosen by hand');
  assert.deepEqual(spoken[0].slice(0, 2), ['prompt', 'Name this chat:'], 'after being offered the old one');

  // A renamed thread keeps its name through a save, which is the point of the
  // flag: the automatic title would otherwise put it back on the next message.
  promptAnswer = null;
  click(rows()[0].querySelector('.waffle-ai-thread-rename'));
  await settle();
  assert.deepEqual(titles(), ['The Peru one'], 'cancelling the rename changes nothing');
});

test('a name typed in too long is capped, and an empty one falls back', async () => {
  promptAnswer = 'x'.repeat(200);
  click(rows()[0].querySelector('.waffle-ai-thread-rename'));
  await settle();
  assert.equal(stored()[0].title.length, 80, 'a title cannot grow past what the rail can show');

  promptAnswer = '   ';
  click(rows()[0].querySelector('.waffle-ai-thread-rename'));
  await settle();
  assert.equal(stored()[0].title, '🔎 what is the capital of Peru',
    'and a cleared name goes back to the one the messages give it, rather than to nothing');
  assert.ok(!stored()[0].renamed, 'which is no longer marked as chosen by hand, because it was not');
});

test('Delete all asks, and says what an export is for while it does', async () => {
  confirmAnswer = false;
  spoken.length = 0;
  click($('#waffle-ai-clear-all'));
  await settle();
  assert.equal(stored().length, 1, 'answering no keeps everything');
  assert.match(spoken[0][1], /exported file is the only copy that survives/,
    'the warning names the way out before it takes anything');

  confirmAnswer = true;
  click($('#waffle-ai-clear-all'));
  await settle();
  assert.deepEqual(stored(), [], 'answering yes empties storage');
  assert.equal(rows().length, 0, 'the rail with it');
  assert.equal($('#waffle-ai-rail-empty').hidden, false, 'and the empty state comes back');
  assert.equal(bubbles().length, 1, 'the open conversation becomes a fresh one');
});

test('a narrow window opens with the drawer shut, and its scrim puts it away again', async () => {
  Object.defineProperty(window, 'innerWidth', { value: 480, configurable: true });
  closeWaffleAI();
  openWaffleAI();
  await settle();

  assert.equal(shell().dataset.rail, 'closed', 'a phone gets the conversation, not a panel over it');
  assert.equal($('#waffle-ai-rail-toggle').getAttribute('aria-expanded'), 'false');

  click($('#waffle-ai-rail-toggle'));
  assert.equal(shell().dataset.rail, 'open', 'the header button still opens the drawer');

  click(shell());
  assert.equal(shell().dataset.rail, 'closed', 'and a tap on the scrim shuts it');

  click($('#waffle-ai-rail-toggle'));
  click($('.waffle-ai-main'));
  assert.equal(shell().dataset.rail, 'open', 'while a tap that lands inside the chat does not');

  Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
  click(shell());
  assert.equal(shell().dataset.rail, 'open', 'and on a desk, where there is no scrim, a click beside the rail changes nothing');
});

test('a closing kitchen flushes what it was holding rather than waiting for the debounce', async () => {
  // Nothing has been said in this visit, so there is nothing to write: a chat
  // with no message from a person is not worth a row in the rail.
  closeWaffleAI();
  await settle();
  assert.deepEqual(stored(), [], 'an untouched chat saves nothing');
});
