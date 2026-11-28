// The AI overlay in a real DOM. Everything else about Waffle AI is pinned by
// reading source, which is good for rules and useless for this: a window that is
// rendered by one function, suppressed by another and reopened by a third is a
// behaviour. 1.2 shipped one that never asked anybody who had answered the
// previous release, and no amount of source-matching would have said so. jsdom
// is a dev dependency for exactly this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html lang="en"><body></body></html>', {
  url: 'https://the-creative-master.github.io/BiteSizedUtilities/',
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

const { openWaffleAI, closeWaffleAI, isWaffleAiLocked } = await import('../waffle-ai.js');
const { APP_VERSION } = await import('../changelog.js');
const { getDeclaredOS, OS_CHOICES } = await import('../waffle-browser-ai.js');

const $ = sel => window.document.querySelector(sel);
const modal = () => $('#waffle-ai-os-ask');
const deviceModal = () => $('#waffle-ai-device-modal');
const buttons = () => [...window.document.querySelectorAll('#waffle-ai-os-choices [data-os]')];
const marked = () => buttons().filter(b => b.classList.contains('is-current'));
const stamp = () => window.localStorage.getItem('waffle-ai-os-asked');
const reopen = () => { closeWaffleAI(); openWaffleAI(); };
const click = el => el.dispatchEvent(new window.Event('click', { bubbles: true }));

test('opening Waffle AI asks which device this is, in its own window', () => {
  assert.equal(isWaffleAiLocked(), false, '1.2 opened the gate in both kitchens');
  openWaffleAI();

  const box = modal();
  assert.ok(box, 'the window exists');
  assert.equal(box.hidden, false, 'and it is showing on a first visit');
  assert.deepEqual(buttons().map(b => b.dataset.os), OS_CHOICES.map(c => c.id), 'every OS is offered');
  assert.ok($('#waffle-os-skip'), 'so is "let it detect"');
  assert.ok($('#waffle-os-close'), 'and so is a way to dismiss it');

  // The reason it moved: inside the chat dialog it changed the dialog's height,
  // so the window was a different shape on every device that had not answered.
  assert.equal($('.waffle-ai-dialog #waffle-ai-os-ask'), null, 'it is not inside the chat dialog');
  assert.equal(box.parentElement.id, 'waffle-ai-overlay', 'it is a sibling of it');
});

test('answering stores the OS, closes the window, and stamps this release', () => {
  const harmony = buttons().find(b => b.dataset.os === 'harmonyos');
  assert.ok(harmony, 'HarmonyOS is one of the choices');
  click(harmony);

  assert.equal(getDeclaredOS(), 'harmonyos', 'the answer is stored');
  assert.equal(modal().hidden, true, 'the window closes');
  assert.equal(stamp(), APP_VERSION, 'and this release is marked as having asked');
});

test('the same release does not ask twice', () => {
  reopen();
  assert.equal(modal().hidden, true, 'opening again in the same release keeps it closed');
  assert.equal(getDeclaredOS(), 'harmonyos', 'and the answer is still the answer');
});

test('a new release asks again, even with an answer already stored', () => {
  // The bug this file exists for. Suppression was keyed on "has an answer"
  // instead of "has this release asked", so everybody who answered under 1.1.1 —
  // which is everybody who was told to, the question being new — never saw the
  // window again, and never learned that 1.2 changed what answering does: a
  // HarmonyOS answer now puts the GPU first instead of last.
  window.localStorage.setItem('waffle-ai-os-asked', '1.1.1');
  reopen();

  assert.equal(getDeclaredOS(), 'harmonyos', 'the stored answer survived');
  assert.equal(modal().hidden, false, 'and the new release asks anyway');
  assert.equal(marked().length, 1, 'with the previous answer marked');
  assert.equal(marked()[0].dataset.os, 'harmonyos');
  assert.equal(marked()[0].getAttribute('aria-pressed'), 'true', 'so keeping it is one tap');
});

test('the pill in the header is the way back, and looks like one', () => {
  click($('#waffle-os-close'));
  assert.equal(modal().hidden, true, 'the ✕ closes it');
  assert.equal(stamp(), APP_VERSION, 'and counts as having been asked');
  assert.equal(getDeclaredOS(), null, 'it means "let it detect", so the answer is cleared');

  const pill = $('#waffle-ai-device-status');
  assert.ok(pill, 'the pill is there');
  assert.equal(pill.getAttribute('role'), 'button', 'it is a control, not a readout');
  assert.equal(pill.tabIndex, 0, 'and reachable by keyboard');
  assert.match(pill.className, /is-door/, 'styled as the door it is');
  assert.match(pill.title, /Tap to say which device this is/, 'with the tooltip saying so');

  // The pill opens the device popup now: the short warning in the header points
  // here, and the long one lives in it. The device question is one tap further in
  // rather than gone, and the popup steps aside for it instead of stacking.
  click(pill);
  assert.equal(deviceModal().hidden, false, 'it opens the device popup');
  assert.equal(modal().hidden, true, 'and leaves the device question closed until it is asked for');
  assert.match(deviceModal().textContent, /DISCLAIMER/, 'which is where the long warning went');
  assert.ok($('#waffle-ai-device-note'), 'with the recognised profile in it');
  assert.ok($('#waffle-ai-device-facts'), 'and the hardware facts beside it');

  click($('#waffle-ai-device-os-ask'));
  assert.equal(modal().hidden, false, 'the question reopens from there');
  assert.equal(deviceModal().hidden, true, 'and the popup gets out of the way');
  assert.equal(buttons().length, OS_CHOICES.length, 'full of choices');
  assert.equal(marked().length, 0, 'none of them marked, because the answer was cleared');
  // Left open on purpose: the next test is about a reopened window surviving the
  // status update that follows it, which is only a real test if it is still open.
});

test('the public kitchen gets the overhauled layout too — rail, thread list and all', async () => {
  // This file's document carries no data-backup, so everything asserted here is
  // what a visitor to the site gets. This test used to assert the opposite: that
  // the public kitchen kept a single pane and one unsaved conversation, because
  // the overhauled layout was the test kitchen's alone. 1.3 gives it to
  // everybody. That is a fact about the markup, so it is checked in the markup;
  // tests/ai-chat-rail.test.js drives the behaviour behind it.
  assert.equal(document.documentElement.dataset.backup, undefined, 'and this really is the public page');
  openWaffleAI();
  await new Promise(r => setTimeout(r, 25));

  assert.ok($('.waffle-ai-rail'), 'the rail of saved chats is here');
  assert.ok($('#waffle-ai-thread-list'), 'with the thread list behind it');
  assert.ok($('#waffle-ai-saving'), 'and the pill that names the store it actually got');
  assert.ok($('#waffle-ai-rail-toggle'), 'and the button that opens the drawer');
  for (const id of ['#waffle-ai-export', '#waffle-ai-import', '#waffle-ai-import-in', '#waffle-ai-clear-all',
    '#waffle-ai-new-chat', '#waffle-ai-rail-close', '#waffle-ai-rail-empty', '#waffle-ai-rail-count']) {
    assert.ok($(id), `${id} is in the public kitchen now`);
  }
  assert.ok($('.waffle-ai-dialog').classList.contains('waffle-ai-chat-dialog'),
    'and the dialog takes the widened two-pane width that goes with a rail');

  // The rail came over; the four models above 1.7B did not. They read the same
  // build flag through a different function, and their repository paths have not
  // been checked from anywhere that could reach Hugging Face — so bringing the
  // layout to everybody must not bring them with it.
  const pills = [...document.querySelectorAll('[data-set-model]')].map(b => b.dataset.setModel);
  for (const heldBack of ['minicpm-2b', 'llama3.2-3b', 'qwen2.5-3b', 'gemma2-2b']) {
    assert.ok(!pills.includes(heldBack), `${heldBack} stays in the test kitchen`);
  }

  // And everything a visitor already had is still there, in the same places,
  // with the pane wrapper the rail would share sitting inertly around it.
  for (const id of ['#waffle-ai-feed', '#waffle-ai-starters', '#waffle-ai-form', '#waffle-ai-input',
    '#waffle-ai-send', '#waffle-ai-stop', '#waffle-ai-attach', '#waffle-ai-file-in', '#waffle-ai-web-toggle',
    '#waffle-ai-img-toggle', '#waffle-ai-models-btn', '#waffle-ai-reset', '#waffle-ai-close', '#waffle-ai-title',
    '#waffle-ai-badge', '#waffle-ai-device-status', '#waffle-ai-device-note', '#waffle-ai-os-ask']) {
    assert.ok($(id), `${id} survived the rebuild`);
  }
  assert.ok($('.waffle-ai-dialog .waffle-ai-shell .waffle-ai-main #waffle-ai-feed'),
    'the feed is still inside the dialog, one wrapper deeper');
  assert.ok($('.waffle-ai-header #waffle-ai-models-btn'), 'and the header still holds its own buttons');
});

test('the public kitchen opens the chat store, and says which backend it got', async () => {
  closeWaffleAI();
  await new Promise(r => setTimeout(r, 25));
  openWaffleAI();
  await new Promise(r => setTimeout(r, 40));

  const keys = [];
  for (let i = 0; i < window.localStorage.length; i += 1) keys.push(window.localStorage.key(i));
  assert.ok(keys.includes('waffle-ai-os-asked'), 'the device answer is still stored, exactly as it was');
  // Which storage keys appear depends on the backend the browser allowed, and
  // jsdom has no IndexedDB, so the honest assertion here is that the store was
  // consulted and the pill reported the outcome — not that a particular key
  // exists. ai-chat-rail.test.js drives the real saving.
  assert.ok($('#waffle-ai-saving'), 'the pill that names the store is rendered');
  assert.ok($('#waffle-ai-saving').textContent.trim().length > 0, 'and it is not left blank');
});

test('a reopened window survives the next status update', () => {
  // renderOsAsk() runs on every badge refresh, and it closes the question when
  // this release has already asked — which is the state a reopened window is in.
  // Without its own flag the window closed itself the moment anything updated.
  assert.equal(stamp(), APP_VERSION, 'this release has asked');
  assert.equal(modal().hidden, false, 'the window is open because it was asked for');
  click(buttons().find(b => b.dataset.os === 'android'));
  assert.equal(getDeclaredOS(), 'android', 'answering it works from here too');
  assert.equal(modal().hidden, true);
});
