/**
 * The warning split: one short sentence on screen, the long one behind a tap.
 *
 * `AI_DISCLAIMER_TEXT` is 887 characters and 155 words, and before 1.3 TVBR 2 it
 * was printed in full in four places — the Waffle AI header, the welcome bubble,
 * Settings and the English cupboard popup. Opening the AI panel alone put about
 * 1,774 characters of disclaimer on screen before anybody had asked a question,
 * and most of it described hardware the reader does not have.
 *
 * What this file holds the build to is both halves of the fix. The visible copy
 * has to be short, and the long text has to still be there — unchanged, in the
 * popup the device pill opens — because "make the warning smaller" is one edit
 * away from "delete the warning", and the second one would leave a person on an
 * iPhone below iOS 26 with no idea why the model will not load.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const aiSrc = fs.readFileSync('waffle-ai.js', 'utf8');
const appSrc = fs.readFileSync('app.js', 'utf8');
const browserAiSrc = fs.readFileSync('waffle-browser-ai.js', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');

const { AI_DISCLAIMER_TEXT, AI_WARNING_SHORT } = await import('../waffle-browser-ai.js');

/** A window of source starting at a marker, so an assertion is about one box and
 *  not about whatever else happens to be in the file. */
const sliceFrom = (src, marker, len) => {
  const at = src.indexOf(marker);
  assert.ok(at >= 0, `the marker ${JSON.stringify(marker.slice(0, 40))} is in the source`);
  return src.slice(at, at + len);
};

/* ------------------------------ the two texts ------------------------------- */

test('the short warning is short, and says what a warning has to say', () => {
  const words = AI_WARNING_SHORT.trim().split(/\s+/).length;
  assert.ok(words >= 20 && words <= 30, `it is ${words} words, inside the 20 to 30 asked for`);
  assert.ok(AI_WARNING_SHORT.length < 200, `and ${AI_WARNING_SHORT.length} characters rather than 887`);
  assert.ok(AI_WARNING_SHORT.length * 4 < AI_DISCLAIMER_TEXT.length,
    'a quarter of the long one at most, so the difference is felt and not just claimed');

  assert.match(AI_WARNING_SHORT, /on this device/i, 'it says where the AI runs');
  assert.match(AI_WARNING_SHORT, /hardware/i, 'and that the hardware decides how it goes');
  assert.match(AI_WARNING_SHORT, /Nothing you type is uploaded/i, 'including the part that is actually reassuring');
  assert.match(AI_WARNING_SHORT, /some devices cannot run it/i,
    'and the part that is not: this does not work everywhere');
  assert.ok(!/guarantee|always works|every device|any browser/i.test(AI_WARNING_SHORT),
    'it promises nothing the runtimes cannot keep');
});

test('the long warning was moved, not cut', () => {
  assert.equal(AI_DISCLAIMER_TEXT.length, 887, 'still 887 characters, word for word');
  assert.match(AI_DISCLAIMER_TEXT, /iOS 26/);
  assert.match(AI_DISCLAIMER_TEXT, /WebGPU/);
  assert.match(AI_DISCLAIMER_TEXT, /Huawei or HarmonyOS tablet/);
  assert.match(AI_DISCLAIMER_TEXT, /WebNN/);
  assert.match(AI_DISCLAIMER_TEXT, /tried last instead of first/);
  assert.match(browserAiSrc, /export const AI_WARNING_SHORT =/, 'both are exported side by side');
  assert.match(browserAiSrc, /The always-on warning, and the reason there are two/,
    'and the file says why there are two, so the next reader does not merge them back');
});

/* ------------------------------ where each goes ----------------------------- */

test('the Waffle AI header carries the short line and the pill beside it', () => {
  const box = sliceFrom(aiSrc, 'class="waffle-disclaimer-box" id="waffle-ai-disclaimer"', 700);
  assert.match(box, /\$\{esc\(AI_WARNING_SHORT\)\}/, 'one sentence, escaped like everything else');
  assert.ok(!box.includes('AI_DISCLAIMER_TEXT'), 'and not the 887 characters');
  assert.match(box, /id="waffle-ai-device-status"/, 'the pill is still in the same strip');
  assert.match(box, /\$\{saveRowHtml\}/, 'so is the row that says where the chats are being kept');
});

test('the device popup holds the long text and everything that makes it concrete', () => {
  const modal = sliceFrom(aiSrc, 'id="waffle-ai-device-modal"', 1800);
  assert.match(modal, /\$\{esc\(AI_DISCLAIMER_TEXT\)\}/, 'the whole disclaimer, unchanged');
  assert.match(modal, /id="waffle-ai-device-note"/, 'the profile this device was recognised as');
  assert.match(modal, /id="waffle-ai-device-facts"/, 'and the hardware facts beside it');
  assert.match(modal, /id="waffle-ai-device-os-ask"/, 'with the device question still one tap further in');
  assert.match(modal, /aria-modal="true"/, 'announced as the dialog it is');
  assert.match(modal, /id="waffle-device-modal-close"/, 'and closable');

  assert.match(aiSrc, /function openDeviceModal\(\)/, 'the pill opens it');
  assert.match(aiSrc, /diagEl\.addEventListener\('click', \(\) => \{ playPop\?\.\(520\); openDeviceModal\(\); \}\)/,
    'on a click, and on a key, because the pill has been pressable for a while');
  assert.match(aiSrc, /e\.key === 'Enter' \|\| e\.key === ' '\) \{ e\.preventDefault\(\); playPop\?\.\(520\); openDeviceModal\(\); \}/);
  assert.match(aiSrc, /Tap to say which device this is\./, 'the tooltip still says what the pill was for');
  assert.match(aiSrc, /box\.hidden = true;\n      reopenOsAsk\(\);/,
    'and the question it opens steps in front rather than stacking on top of it');

  // The facts are the same ones Settings prints, so a refused model or a failed
  // image generation can be explained from either place.
  assert.match(aiSrc, /function renderDeviceFacts\(\)/);
  for (const fact of ['cores', 'wasm budget', 'OPFS', 'llama.cpp WebGPU', 'single-thread']) {
    assert.ok(aiSrc.includes(fact), `${fact} is one of the facts shown`);
  }
  assert.match(aiSrc, /image model: no WebGPU here, so \/imagine cannot run/,
    'including the one that explains a dead image button');
});

test('the welcome bubble is a greeting again', () => {
  const at = aiSrc.indexOf('const WELCOME_MSG = {');
  assert.ok(at >= 0);
  const bubble = aiSrc.slice(at, aiSrc.indexOf('\n};', at));
  assert.match(bubble, /kitchen friend/, 'it still introduces Sir Waffle');
  assert.ok(!bubble.includes('AI_DISCLAIMER_TEXT'), 'without the disclaimer inside it');
  assert.ok(!bubble.includes('AI_WARNING_SHORT'), 'and without the short one either — the header is right there');
  assert.ok(!/Qwen 2\.5 1\.5B|SmolLM2|DeepSeek/.test(bubble),
    'no model menu, which went stale with every release and lives in Settings');
  assert.match(bubble, /\/imagine/, 'the things it can do are still named');
  // Measured on what a visitor reads, not on the source slice, which carries the
  // comment explaining why the bubble shrank.
  // Line by line, because the array holds an empty string as a paragraph break
  // and a quote-matching regex reads straight through it.
  const content = bubble.slice(bubble.indexOf('content: ['));
  const visible = content.split('\n')
    .map(l => l.trim().match(/^'([\s\S]*)'[,]?$/))
    .filter(Boolean)
    .map(m => m[1])
    .join('\n');
  const said = visible.split('\n').filter(l => l.trim());
  assert.equal(said.length, 2, 'two lines are said: a hello, and what it can do');
  assert.ok(visible.length < 320, `and they are ${visible.length} characters rather than several screens`);
});

test('Settings and the English cupboard show the short line and open the same popup', () => {
  const settings = sliceFrom(appSrc, 'id="settings-ai-section"', 1200);
  assert.match(settings, /\$\{esc\(AI_WARNING_SHORT\)\}/, 'Settings has the one sentence');
  assert.ok(!settings.includes('AI_DISCLAIMER_TEXT'), 'and not the long one inline');
  assert.match(settings, /id="settings-device-pill"/, 'with the pill beside it');
  assert.match(settings, /id="settings-ai-warning-open"/, 'and a button for the rest');

  const english = sliceFrom(appSrc, 'id="english-warning-overlay"', 1800);
  assert.match(english, /\$\{esc\(AI_WARNING_SHORT\)\}/, 'the English popup got the same line');
  assert.ok(!english.includes('AI_DISCLAIMER_TEXT'), 'its copy of the long text went to the popup');
  assert.match(english, /Waffle Translate uses Google Translate/,
    'while the one sentence that is actually about English tools stayed');
  assert.match(english, /id="eng-warn-details"/, 'and it can open the details too');

  const popup = sliceFrom(appSrc, 'id="ai-warning-overlay"', 2000);
  assert.match(popup, /\$\{esc\(AI_DISCLAIMER_TEXT\)\}/, 'the popup carries all 887 characters');
  assert.match(popup, /iPhone \/ Mobile Warning/, 'and the mobile note that used to sit in the English popup');
  assert.match(popup, /id="settings-device-detail"/, 'plus the detected-device facts');
  assert.match(popup, /id="ai-warn-device-pill"/, 'and its own pill, so it reads the same as the strip it came from');

  for (const opener of ["$('#settings-ai-warning-open')?.addEventListener('click', openAiWarning)",
    "$('#eng-warn-details')?.addEventListener('click', openAiWarning)"]) {
    assert.ok(appSrc.includes(opener), `${opener.slice(0, 40)}… opens it`);
  }
  assert.match(appSrc, /for \(const pillId of \['#settings-device-pill', '#eng-warn-device-pill', '#ai-warn-device-pill'\]\)/,
    'every one of the three pills opens it as well');
  assert.match(appSrc, /pill\.setAttribute\('role', 'button'\)/, 'and says it is pressable to a screen reader');
  assert.match(appSrc, /function refreshDeviceFacts\(force = false\)/, 'the facts are probed once and reused');
  assert.match(appSrc, /pill\.classList\.remove\('is-risk', 'is-ok'\)/,
    'painted with classList, so the wiring that makes a pill a door is not wiped out');
});

test('the popup is readable on the phone that needs it most', () => {
  assert.match(css, /\.waffle-disclaimer-more \{/, 'the button that opens it has its own style');
  assert.match(css, /#waffle-ai-device-modal \.waffle-os-card \{/, 'and the card is styled for the long text');
  const card = sliceFrom(css, '#waffle-ai-device-modal .waffle-os-card {', 240);
  assert.match(card, /max-height/, 'capped in height');
  assert.match(card, /overflow-y: auto/, 'so the text scrolls inside it');
  assert.ok(!css.includes('backdrop-filter'), 'still no frosted blur anywhere in the kitchen');
});
