/**
 * What it costs to show one more token.
 *
 * A reply used to arrive token by token, and every token rebuilt the entire
 * feed: each message's markdown parsed again, `feed.innerHTML` replaced, and
 * with it every image element in the thread destroyed and recreated. The cost
 * of the next character therefore grew with the length of the conversation,
 * which is the wrong way round for the one thing that happens most often in a
 * chat. It now paints the bubble the reply is arriving in, at most once per
 * frame, and rebuilds the whole feed when the reply is finished.
 *
 * The part that can break quietly is the numbering. A code box is numbered by
 * its position in a list shared by the whole thread, so a paint that rebuilds
 * one bubble on its own can leave every other bubble's Copy button pointing at
 * somebody else's code. That is a DOM behaviour, not a rule, so the first test
 * here runs it in jsdom and clicks the buttons. The cheap paint itself is only
 * reachable from inside a live model stream, which no test in this repo can
 * start, so the rest of the file pins the conditions it refuses to paint
 * under — every one of which sends it back to a full rebuild.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
globalThis.alert = () => {};
globalThis.confirm = () => true;
globalThis.prompt = (l, v) => v;
// jsdom implements no clipboard, and the copy buttons are what this file clicks.
const copied = [];
Object.defineProperty(window.navigator, 'clipboard', {
  value: { writeText: async text => { copied.push(text); } },
  configurable: true
});

const { openWaffleAI, closeWaffleAI, formatWaffleMarkdown } = await import('../waffle-ai.js');
const { CHAT_LS_KEY } = await import('../waffle-chat-store.js');

const aiSrc = fs.readFileSync('waffle-ai.js', 'utf8');
const $ = sel => window.document.querySelector(sel);
const $$ = sel => [...window.document.querySelectorAll(sel)];
const click = el => el.dispatchEvent(new window.Event('click', { bubbles: true }));
const settle = async (ms = 25) => new Promise(r => setTimeout(r, ms));
const bubbles = () => $$('#waffle-ai-feed .waffle-msg');
const copyButtons = () => $$('#waffle-ai-feed [data-copy-artifact]');

/** Slice a function out of the source, ending where the next top-level one starts. */
function sliceFrom(startMarker, endMarker) {
  const a = aiSrc.indexOf(startMarker);
  assert.ok(a >= 0, `the source still has ${startMarker}`);
  const b = aiSrc.indexOf(endMarker, a + startMarker.length);
  assert.ok(b > a, `${endMarker} comes after ${startMarker}`);
  return aiSrc.slice(a, b);
}

test('a code box is numbered by its place in the thread, and the number is not decorative', async () => {
  const thread = {
    id: 't-numbering',
    title: '🧾 Two snippets',
    createdAt: Date.now() - 60_000,
    updatedAt: Date.now() - 30_000,
    messages: [
      { role: 'user', content: 'first question', displayContent: 'first question' },
      { role: 'assistant', authorLabel: 'Sir Waffle', content: "Here you go:\n```js\nconsole.log('one');\n```\nThat is the first." },
      { role: 'user', content: 'and another', displayContent: 'and another' },
      { role: 'assistant', authorLabel: 'Sir Waffle', content: "Second:\n```python\nprint('two')\n```\nAnd that is the second." }
    ]
  };
  window.localStorage.setItem(CHAT_LS_KEY, JSON.stringify([thread]));

  openWaffleAI();
  await settle(60);

  assert.equal(bubbles().length, 4, 'the saved conversation came back, both sides of both turns');
  const buttons = copyButtons();
  assert.deepEqual(buttons.map(b => b.dataset.copyArtifact), ['0', '1'],
    'the two code boxes are numbered by their position in the whole thread, not per bubble');

  // The number only matters if it selects the code it sits next to. This is the
  // contract a single-bubble repaint has to preserve: get it wrong and every
  // Copy button in an older message silently copies a newer message's code.
  click(buttons[0]);
  await settle();
  click(buttons[1]);
  await settle();
  assert.deepEqual(copied, ["console.log('one');", "print('two')"],
    'each button copies the code in its own box');

  assert.ok(buttons[0].closest('.waffle-msg') === bubbles()[1], 'the first box is in the first answer');
  assert.ok(buttons[1].closest('.waffle-msg') === bubbles()[3], 'and the second is in the second');
  closeWaffleAI();
});

test('the formatter numbers from a shared list, which is why the base has to be recorded', () => {
  // Demonstrates the hazard the cheap paint is built around, against the real
  // formatter: format the same text twice and the second copy's boxes are
  // numbered 2 and 3, because the list kept growing. A repaint that did not put
  // the list back to where this bubble starts would renumber the bubble it was
  // painting and leave every earlier button pointing past the end of it.
  const once = formatWaffleMarkdown("```js\none\n```");
  const twice = formatWaffleMarkdown("```js\none\n```");
  const idsOf = html => [...html.matchAll(/data-copy-artifact="(\d+)"/g)].map(m => Number(m[1]));
  assert.equal(idsOf(once).length, 1, 'one box in one snippet');
  assert.ok(idsOf(twice)[0] > idsOf(once)[0],
    'and the same text formatted again is numbered higher, because the list is shared and only a full render clears it');

  assert.match(aiSrc, /feedArtifactBase\[idx\] = codeArtifacts\.length;/,
    'so a full render writes down where each bubble\'s artifacts begin');
  const render = sliceFrom('function renderMessages() {', '\n  feed.querySelectorAll(\'[data-dl-img]\')');
  assert.match(render, /feedArtifactBase = \[\];/, 'the record is rebuilt with the feed');
  assert.match(render, /wireArtifactButtons\(feed\);/, 'and the whole feed is still wired after a full render');
});

test('a token paints the bubble it is arriving in, at most once per frame', () => {
  const onToken = sliceFrom('      onToken(chunk, acc) {', '      onRuntime(rt) {');
  assert.match(onToken, /scheduleFeedRender\(assistantIdx\);/, 'the token names the bubble it is filling');
  assert.ok(!/renderMessages\(\);/.test(onToken),
    'and does not rebuild the thread itself — that is the whole point of the change');

  const sched = sliceFrom('function scheduleFeedRender(', 'function renderMessagesNow() {');
  assert.match(sched, /if \(feedFrame\) return;/, 'tokens that arrive inside one frame collapse into one paint');
  assert.match(sched, /requestAnimationFrame\(paint\)/, 'the paint waits for a frame rather than taking one');
  assert.match(sched, /setTimeout\(paint, 16\)/, 'and a page with no frames to wait for still collapses the burst');
  assert.match(sched, /if \(idx >= 0 && paintStreamingMessage\(idx\)\) return;/,
    'a queued paint tries the one bubble first, and only rebuilds the feed if that was not allowed');

  const now = sliceFrom('function renderMessagesNow() {', '/** Wire the copy/download buttons');
  assert.match(now, /cancelFeedFrame\(\); feedFrame = 0;/, 'a deliberate render cancels the frame it would otherwise race');
  assert.match(now, /feedStreamIdx = -1;/, 'and forgets the bubble, so nothing paints a state that has moved on');
});

test('the cheap paint refuses everything it cannot vouch for', () => {
  const paint = sliceFrom('function paintStreamingMessage(idx) {', '\nfunction renderMessages() {');
  const refusals = paint.match(/return false;/g) || [];
  assert.ok(refusals.length >= 5, `every condition it cannot vouch for falls back to a full render (${refusals.length} of them)`);

  assert.match(paint, /m\.role === 'user' \|\| m\.imageProgress \|\| m\.imageResult \|\| m\.imageCutOff/,
    'only a plain assistant reply is painted alone — an image run has its own markup and its own tests');
  assert.match(paint, /idx !== messages\.length - 1 \|\| !isGenerating/,
    'only while a reply is actually streaming, and only into the last bubble');
  assert.match(paint, /feed\.children\.length !== messages\.length/,
    'and only when the feed on screen still matches the thread in memory');
  assert.match(paint, /if \(!body \|\| !Number\.isFinite\(base\)\) return false;/,
    'a bubble it cannot find, or cannot number, is a full render');

  assert.match(paint, /codeArtifacts\.length = base;/,
    'it puts the shared list back to where this bubble starts before reformatting it');
  assert.match(paint, /wireArtifactButtons\(bubble\);/,
    'and wires the buttons of that bubble only, since no other bubble was touched');
  assert.match(paint, /feed\.scrollTop = feed\.scrollHeight;/,
    'the reply still follows itself down the feed');
});

test('the work that must not be coalesced is still painted directly', () => {
  // The image progress ticker is the one path in the chat that a stalled or
  // paused tab is judged by, and it was written after a run spent minutes
  // announcing 4%. It keeps its own direct render.
  assert.match(aiSrc, /renderMessages\(\);\n  \}, 1000\);/,
    'the one-second image ticker still paints on its own timer');
  const progress = sliceFrom('      onProgress(p) {', '    delete messages[assistantIdx].imageProgress;');
  assert.match(progress, /renderMessages\(\);/, 'and so does every image progress report');

  // Named by the comment in it: the image run has a `finally` of its own that
  // starts the same way, and slicing from the wrong one would let this pass
  // while the chat path regressed.
  const done = sliceFrom('    // A frame may still be holding the last few tokens, and the reply is', 'export function closeWaffleAI() {');
  assert.match(done, /renderMessagesNow\(\);/,
    'a finished reply paints at once, so no token is left waiting in a frame that will not fire');
  assert.match(done, /syncComposerState\(\);/, 'and the composer comes back with it');
});
