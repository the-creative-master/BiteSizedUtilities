import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  TEXT_MODELS,
  SMALL_MODEL_MAX_PARAMS,
  DEFAULT_TEXT_MODEL,
  VISION_TEXT_MODEL,
  isBetaTesting,
  isModelUnlockedInThisBuild,
  getAvailableTextModels,
  isVisionModel,
  getSelectedTextModel,
  setSelectedTextModel
} from '../waffle-browser-ai.js';
import { canAttachFiles, waffleAiModelBadge, ATTACH_NEEDS_VISION } from '../waffle-ai.js';
import { APP_VERSION, CHANGELOG } from '../changelog.js';

/**
 * A deliberately tiny DOM: enough to flip the beta flag and to stand in for
 * localStorage. The full chat overlay needs a real browser and is covered by the
 * Playwright suites instead, so anything here that would build DOM is asserted
 * against source rather than executed.
 */
function miniDOM({ beta = false, stored = null } = {}) {
  const doc = {
    documentElement: { dataset: beta ? { beta: '1' } : {} },
    body: { append() {}, classList: { add() {}, remove() {} } },
    createElement: () => ({ append() {}, querySelector: () => null, addEventListener() {} }),
    addEventListener() {},
    removeEventListener() {},
    querySelector: () => null
  };
  globalThis.document = doc;
  if (!globalThis.window) globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
  let value = stored;
  globalThis.localStorage = {
    getItem: () => value,
    setItem: (_k, v) => { value = String(v); },
    removeItem: () => { value = null; }
  };
  return doc;
}

function clearDOM() {
  delete globalThis.document;
  delete globalThis.localStorage;
}

const PUBLIC_IDS = ['qwen3-0.6b', 'smollm2-135m', 'smollm2-360m', 'qwen2.5-0.5b', 'qwen3.5-0.8b'];
const BETA_ONLY_IDS = ['qwen2.5-1.5b', 'qwen2.5-coder-1.5b', 'llama3.2-1b', 'deepseek-r1-1.5b'];

test('every model declares a parameter count, so the size gate is data-driven', () => {
  assert.equal(TEXT_MODELS.length, 9, 'the whole catalogue still ships');
  for (const m of TEXT_MODELS) {
    assert.equal(typeof m.params, 'number', `${m.id} declares params`);
    assert.ok(m.params > 0, `${m.id} params is positive`);
    assert.ok(m.hfId && m.hfGgufRepo, `${m.id} keeps its own ONNX and GGUF sources`);
  }
  assert.equal(SMALL_MODEL_MAX_PARAMS, 1, 'the public cap is under 1B parameters');
});

test('the public build offers the models under 1B and nothing larger', () => {
  miniDOM({ beta: false });
  assert.equal(isBetaTesting(), false);
  const offered = getAvailableTextModels().map(m => m.id);
  assert.deepEqual(offered.sort(), [...PUBLIC_IDS].sort());
  for (const id of BETA_ONLY_IDS) {
    assert.ok(!offered.includes(id), `${id} is not offered publicly`);
  }
  // "Under 1B" is strict: Llama 3.2 1B is exactly 1.0 and stays in beta.
  const llama = TEXT_MODELS.find(m => m.id === 'llama3.2-1b');
  assert.equal(llama.params, 1.0);
  assert.equal(isModelUnlockedInThisBuild(llama), false, 'a 1B model is not *under* 1B');
  clearDOM();
});

test('beta.html unlocks all nine models, including the large experimental ones', () => {
  miniDOM({ beta: true });
  assert.equal(isBetaTesting(), true);
  const offered = getAvailableTextModels().map(m => m.id);
  assert.equal(offered.length, 9, 'beta offers the whole catalogue');
  for (const id of BETA_ONLY_IDS) {
    assert.ok(offered.includes(id), `${id} is selectable in beta`);
  }
  assert.ok(TEXT_MODELS.every(isModelUnlockedInThisBuild), 'nothing is gated in beta');
  clearDOM();
});

test('the default chat model is the small one that actually worked', () => {
  miniDOM({ beta: false });
  assert.equal(DEFAULT_TEXT_MODEL, 'smollm2-135m');
  assert.equal(getSelectedTextModel(), 'smollm2-135m', 'no 700 MB download on first chat');
  const tiny = TEXT_MODELS.find(m => m.id === 'smollm2-135m');
  assert.ok(tiny.params < 1 && tiny.kind === 'browser', 'the default runs in-browser, no backend needed');
  assert.ok(tiny.ggufMB <= 100, 'the default is a small download');
  clearDOM();
});

test('a model chosen in beta cannot leak into the public build', () => {
  // Both builds share localStorage, so the saved preference has to be clamped.
  miniDOM({ beta: true });
  setSelectedTextModel('deepseek-r1-1.5b');
  assert.equal(getSelectedTextModel(), 'deepseek-r1-1.5b', 'beta honours the big model');

  miniDOM({ beta: false, stored: 'deepseek-r1-1.5b' });
  assert.equal(getSelectedTextModel(), DEFAULT_TEXT_MODEL, 'public clamps back to a small model');

  miniDOM({ beta: false, stored: 'qwen2.5-0.5b' });
  assert.equal(getSelectedTextModel(), 'qwen2.5-0.5b', 'a small saved choice survives');
  clearDOM();
});

test('the picker refuses to save a model this build does not offer', () => {
  miniDOM({ beta: false, stored: null });
  setSelectedTextModel('llama3.2-1b');
  assert.equal(getSelectedTextModel(), DEFAULT_TEXT_MODEL, 'the write was rejected');
  setSelectedTextModel('not-a-real-model');
  assert.equal(getSelectedTextModel(), DEFAULT_TEXT_MODEL, 'unknown ids are rejected too');
  clearDOM();
});

test('attachments need the vision model, and only the vision model', () => {
  miniDOM({ beta: false, stored: null });
  assert.equal(VISION_TEXT_MODEL, 'qwen3.5-0.8b');
  assert.equal(canAttachFiles(), false, 'the default text model cannot read a photo');
  assert.match(ATTACH_NEEDS_VISION, /Qwen 3\.5 0\.8B/, 'the reason names the model to pick');
  assert.match(ATTACH_NEEDS_VISION, /Settings/, 'and says where to pick it');

  miniDOM({ beta: false, stored: 'qwen2.5-0.5b' });
  assert.equal(canAttachFiles(), false, 'a non-vision small model still cannot attach');
  miniDOM({ beta: false, stored: 'qwen3.5-0.8b' });
  assert.equal(canAttachFiles(), true, 'the vision model re-opens the paperclip');

  // The vision model is itself under 1B, so images stay available publicly.
  assert.ok(isModelUnlockedInThisBuild(TEXT_MODELS.find(m => m.id === VISION_TEXT_MODEL)));
  assert.equal(isVisionModel(TEXT_MODELS.find(m => m.id === 'smollm2-135m')), false);
  assert.equal(TEXT_MODELS.filter(isVisionModel).length, 1, 'exactly one multimodal model');
  clearDOM();
});

test('the pause is gone: Waffle AI answers in the public build', () => {
  const ai = fs.readFileSync('waffle-ai.js', 'utf8');
  for (const gone of ['isWaffleAiLocked', 'WaffleAiLockedError', 'WAFFLE_AI_LOCK_MESSAGE',
    'waffleAiLockedNoticeHTML', 'openLockedWaffleAI', 'buildLockedOverlay', 'lockedEl']) {
    assert.ok(!ai.includes(gone), `waffle-ai.js no longer references ${gone}`);
  }
  assert.ok(!ai.includes('is taking a break'), 'the paused overlay copy is gone');
  assert.match(ai, /export function openWaffleAI\(\) \{\n  if \(!overlayEl\) overlayEl = buildOverlay\(\);/,
    'openWaffleAI builds the real chat with no short-circuit');
  // The status probe and warmup run again instead of returning early.
  assert.ok(!/async function fetchStatus\(\) \{[^}]*isWaffleAiLocked/s.test(ai));
  assert.ok(!/export async function warmupWaffleAI\(\) \{[^}]*isWaffleAiLocked/s.test(ai));
  assert.match(ai, /export \{ isBetaTesting, isModelUnlockedInThisBuild, getAvailableTextModels, VISION_TEXT_MODEL \};/,
    'the build gate is re-exported for the kitchen and the tools');
});

test('the fallback chain cannot escape this build\u2019s model budget', () => {
  const ai = fs.readFileSync('waffle-ai.js', 'utf8');
  // A server fallback used to reach for the 1.5B model no matter what was picked.
  assert.ok(!ai.includes("pushServer(cfg.kind === 'server' ? cfg.id : 'qwen2.5-1.5b')"),
    'the server fallback no longer hardcodes a 1.5B model');
  assert.match(ai, /const SERVER_FALLBACK_ID = 'qwen3-0\.6b';/);
  assert.match(ai, /if \(!m \|\| !isModelUnlockedInThisBuild\(m\)\) return;/,
    'a fallback model is checked against the build gate before it is queued');
  assert.match(ai, /pushChromiumSafetyNet[\s\S]{0,200}smollm2-135m/,
    'the low-RAM safety net still drops to SmolLM2 135M');
});

test('CodeHub keeps its dedicated coder model', () => {
  const src = fs.readFileSync('tools-code.js', 'utf8');
  assert.match(src, /modelId:\s*'qwen2\.5-coder-1\.5b'/, 'diagnostics still ask for the coder model');
  assert.ok(!src.includes('isWaffleAiLocked'), 'no lock gate left in CodeHub');
  assert.ok(!src.includes('waffleAiLockedNoticeHTML'));
  assert.match(src, /AI Error Diagnostics/);
  // The coder model is 1.5B, so it is deliberately *not* in the public picker —
  // an explicit modelId from a caller bypasses the gate, and that is intended.
  assert.ok(!PUBLIC_IDS.includes('qwen2.5-coder-1.5b'));
  assert.equal(TEXT_MODELS.find(m => m.id === 'qwen2.5-coder-1.5b').params, 1.5);
});

test('the English tools run again and name the model that answers', () => {
  const src = fs.readFileSync('tools-english.js', 'utf8');
  assert.ok(!src.includes('isWaffleAiLocked'), 'no lock gate left in the English tools');
  assert.ok(!src.includes('waffleAiLockedNoticeHTML'));
  assert.ok(!src.includes('AI writing helpers are paused'));
  assert.match(src, /\['Google Translate', 'Waffle AI \(Strict\)'\]/, 'both engines are offered');
  assert.ok(src.includes('translate.googleapis.com/translate_a/single'), 'Google Translate endpoint intact');
  assert.ok(src.includes('(Speak in ${appLang})'), 'speak hint intact');
  // The badge must follow the selected model rather than hardcoding a 1.5B name.
  assert.ok(!src.includes('Powered by Qwen 2.5 1.5B'), 'no hardcoded model name on the badge');
  assert.match(src, /waffleAiModelBadge\(\)/);
  assert.match(src, /bite-ai-settings-changed/, 'the badge updates when the model changes');

  miniDOM({ beta: false, stored: null });
  assert.equal(waffleAiModelBadge(), '\u2728 Powered by SmolLM2 135M');
  miniDOM({ beta: false, stored: 'qwen2.5-0.5b' });
  assert.equal(waffleAiModelBadge(), '\u2728 Powered by Qwen 2.5 0.5B');
  clearDOM();
});

test('Settings shows the AI panel to everyone, with a filtered picker', () => {
  const src = fs.readFileSync('app.js', 'utf8');
  assert.ok(!src.includes('isWaffleAiLocked') && !src.includes('aiLocked'), 'no lock flag left in the kitchen');
  assert.ok(!src.includes('${isBetaTesting() ? `\n        <div class="gfield settings-ai-section"'),
    'the AI section is no longer beta-only');
  assert.match(src, /<div class="gfield settings-ai-section" id="settings-ai-section" data-no-i18n>/);
  assert.match(src, /getAvailableTextModels\(\)\.map\(m =>/, 'the picker lists only allowed models');
  assert.match(src, /getAvailableTextModels\(\)\.filter\(m => m\.hfGgufRepo\)/,
    'the pre-cache list follows the same budget');
  assert.ok(!/renderSettingsModal[\s\S]{0,4000}if \(!isBetaTesting\(\)\) return;/.test(src),
    'the device probes run for the always-visible panel');
  // Sir Waffle is branded again, and still carries the beta-door tap target.
  assert.match(src, /Touch me for Waffle AI!/);
  assert.match(src, /<span class="waffle-ai-tag" aria-hidden="true">Waffle AI<\/span>/);
  assert.match(src, /aria-label="Waffle AI Button"/);
  assert.equal(src.match(/data-waffle-tap/g).length >= 2, true, 'tap targets remain on the mascot');
  // The wall quip is live again.
  assert.ok(src.includes('/api/waffle-ai/wall-quip'), 'the wall quip endpoint is back in use');
  assert.ok(src.includes('openWaffleAI'), 'the kitchen still opens Waffle AI');
});

test('the beta door still needs ten taps on Sir Waffle in three seconds', () => {
  const src = fs.readFileSync('app.js', 'utf8');
  assert.match(src, /const BETA_TAP_TARGET = 10;/);
  assert.match(src, /const BETA_TAP_WINDOW_MS = 3000;/);
  assert.match(src, /betaTaps\.filter\(t => now - t <= BETA_TAP_WINDOW_MS\)\.concat\(now\)/,
    'taps outside the three-second window are dropped');
  assert.match(src, /addEventListener\('click', e => \{\n  if \(e\.target\.closest\?\.\('\[data-waffle-tap\]'\)\) registerWaffleTap\(\);\n\}, true\);/,
    'the counter listens in the capture phase, past the mascot\u2019s stopPropagation');
  assert.match(src, /new URL\('beta\.html', document\.baseURI\)/, 'the redirect works from a Pages sub-path');
  assert.match(src, /id="settings-beta-link"/, 'Settings links to the door too');
  assert.match(src, /all nine AI models are live/, 'the toast says what beta unlocks');

  const beta = fs.readFileSync('beta.html', 'utf8');
  assert.match(beta, /data-beta="1"/);
  assert.match(beta, /<title>BiteSizedUtilities Beta Testing<\/title>/);
  assert.match(beta, /noindex/, 'beta is kept out of search results');
  assert.match(beta, /<script type="module" src="\.\/app\.js"><\/script>/, 'beta runs the same app');

  const vite = fs.readFileSync('vite.config.js', 'utf8');
  assert.match(vite, /beta: path\.resolve\('beta\.html'\)/, 'beta.html is a real build input');
  assert.match(vite, /main: path\.resolve\('index\.html'\)/);
});

test('the changelog dates the launch correctly and drops the pause story', () => {
  assert.equal(APP_VERSION, '1.0.1');
  assert.equal(JSON.parse(fs.readFileSync('package.json', 'utf8')).version, '1.0.1');
  assert.equal(CHANGELOG.length, 2);
  assert.equal(CHANGELOG[0].version, '1.0.1', 'newest first');
  assert.equal(CHANGELOG[1].version, '1.0');
  assert.equal(CHANGELOG[1].date, 'November 16, 2026', '1.0 shipped November 16 2026');
  assert.equal(CHANGELOG[0].date, 'November 17, 2026');

  const all = JSON.stringify(CHANGELOG);
  assert.ok(!all.includes('isn\u2019t available'), 'the apology notice is no longer the story');
  assert.ok(!all.includes('now paused'), 'no stale "paused" wording');
  assert.ok(!all.includes('avaible'), 'no typo carried over');
  assert.match(all, /under 1B parameters/, '1.0.1 explains the small-models rule');
  assert.match(all, /SmolLM2 135M/);
  assert.match(all, /Qwen 3\.5 0\.8B/, 'the vision requirement is documented');
  assert.match(all, /ten times within three seconds/, 'so is the beta door');
  assert.match(all, /Qwen 2\.5 Coder 1\.5B/, 'and CodeHub keeping its coder model');
  for (const id of PUBLIC_IDS) {
    const label = TEXT_MODELS.find(m => m.id === id).label;
    assert.ok(all.includes(label), `1.0.1 lists ${label} as available`);
  }
});

test('styles: paused-notice CSS removed, new pieces added, invariants kept', () => {
  const css = fs.readFileSync('style.css', 'utf8');
  assert.ok(!css.includes('waffle-ai-locked'), 'the paused-notice styles are gone');
  assert.match(css, /\.settings-ai-note \{/, 'the small-models note is styled');
  assert.match(css, /\.waffle-attach-btn\.is-locked-out/, 'the disabled paperclip is styled');
  assert.match(css, /\.beta-banner \{/, 'the beta banner survives');
  assert.match(css, /\.changelog-entry \{/, 'the changelog survives');
  // Long-standing house rules from the wider suite.
  assert.ok(!css.includes('backdrop-filter'), 'no backdrop-filter anywhere');
  assert.ok(css.includes('Fredoka') && css.includes('Nunito'), 'the kitchen fonts are intact');
  assert.ok(css.includes('rotateY(-108deg)'), 'the 2.5D cupboard door still swings');
});

test('nothing was deleted to achieve any of this', () => {
  for (const f of ['waffle-browser-ai.js', 'waffle-ai-server.js', 'waffle-image-gen.js',
    'waffle-ai.js', 'beta.html', 'changelog.js']) {
    assert.ok(fs.existsSync(f), `${f} still ships`);
  }
  const server = fs.readFileSync('waffle-ai-server.js', 'utf8');
  assert.ok(server.includes('node-llama-cpp'), 'the local server backend is untouched');
  const gen = fs.readFileSync('waffle-image-gen.js', 'utf8');
  assert.match(gen, /IMAGE_MODELS/, 'image generation is untouched');
  // Image generation resolves `ort/` against document.baseURI (the 1.31.1
  // runtime). The chat pipeline needs the separately mounted `ort-chat/` build,
  // and mixing the two was the original "downloads fine, never answers" bug.
  assert.match(gen, /new URL\('ort\/'/, 'image generation keeps the 1.31.1 runtime path');
  assert.ok(!gen.includes("'ort-chat/'"), 'and does not borrow the chat runtime');
  // The chat pipeline must keep its own matched runtime, never the image one.
  const vite = fs.readFileSync('vite.config.js', 'utf8');
  assert.ok(vite.includes('/ort-chat/'), 'the chat runtime stays separately mounted');
  assert.ok(vite.includes('attachWaffleAiMiddleware'));
});
