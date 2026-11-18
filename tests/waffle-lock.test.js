import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  WAFFLE_AI_LOCK_MESSAGE,
  WaffleAiLockedError,
  isBetaTesting,
  isWaffleAiLocked,
  openWaffleAI,
  closeWaffleAI,
  streamWaffleChat,
  warmupWaffleAI,
  waffleAiLockedNoticeHTML
} from '../waffle-ai.js';
import { APP_VERSION, CHANGELOG } from '../changelog.js';

/**
 * A deliberately tiny DOM: just enough for the paused-AI overlay, which only
 * needs createElement/append and null-safe querySelector. The full chat overlay
 * needs a real browser and is covered by the Playwright suites instead.
 */
function miniDOM({ beta = false } = {}) {
  const mk = tag => ({
    tagName: String(tag).toUpperCase(),
    children: [],
    hidden: false,
    className: '',
    id: '',
    innerHTML: '',
    textContent: '',
    dataset: {},
    style: { setProperty() {} },
    classList: {
      _set: new Set(),
      add(...c) { c.forEach(x => this._set.add(x)); },
      remove(...c) { c.forEach(x => this._set.delete(x)); },
      contains(c) { return this._set.has(c); }
    },
    append(...nodes) { this.children.push(...nodes); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    removeEventListener() {},
    scrollTo() {},
    focus() {}
  });
  const doc = {
    documentElement: mk('html'),
    body: mk('body'),
    createElement: mk,
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; }
  };
  if (beta) doc.documentElement.dataset.beta = '1';
  globalThis.document = doc;
  if (!globalThis.window) globalThis.window = { addEventListener() {}, removeEventListener() {} };
  return doc;
}

function clearDOM() {
  delete globalThis.document;
}

test('Waffle AI is paused with the promised apology, and the pause is spelled correctly', () => {
  assert.match(WAFFLE_AI_LOCK_MESSAGE, /^I apologize for the inconvenience but WaffleAI isn\u2019t available/);
  assert.match(WAFFLE_AI_LOCK_MESSAGE, /countless bugs with open-source AI models/);
  assert.match(WAFFLE_AI_LOCK_MESSAGE, /We will make it available in a later update\.$/);
  // The message visitors actually read must not carry the typo it was drafted with.
  assert.ok(!WAFFLE_AI_LOCK_MESSAGE.includes('avaible'), 'lock message spells "available" correctly');
  assert.equal(new WaffleAiLockedError().name, 'WaffleAiLocked');
  assert.match(waffleAiLockedNoticeHTML(), /waffle-ai-locked-note/);
});

test('the AI gate is locked by default and opens only for the beta build', async () => {
  miniDOM({ beta: false });
  assert.equal(isBetaTesting(), false, 'index.html is not a beta build');
  assert.equal(isWaffleAiLocked(), true, 'AI is paused in the public build');

  await assert.rejects(
    () => streamWaffleChat({ messages: [{ role: 'user', content: 'hello' }] }),
    err => err.name === 'WaffleAiLocked' && err.message === WAFFLE_AI_LOCK_MESSAGE,
    'streamWaffleChat refuses while paused'
  );

  globalThis.document.documentElement.dataset.beta = '1';
  assert.equal(isBetaTesting(), true, 'data-beta="1" switches AI back on');
  assert.equal(isWaffleAiLocked(), false);
  clearDOM();
});

test('no AI network work happens while the feature is paused', async () => {
  miniDOM({ beta: false });
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (url, opts) => { calls.push(String(url)); return Promise.resolve({ ok: false, json: async () => ({}) }); };
  try {
    await warmupWaffleAI();
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.deepEqual(calls, [], 'warmup must not reach for a server or a model while paused');
  clearDOM();
});

test('tapping Sir Waffle while paused shows the notice, not a dead chat', () => {
  const doc = miniDOM({ beta: false });
  openWaffleAI();
  const overlay = doc.body.children.find(el => el.id === 'waffle-ai-overlay');
  assert.ok(overlay, 'an overlay is appended to the body');
  assert.match(overlay.className, /is-locked/);
  assert.match(overlay.innerHTML, /Waffle AI is taking a break/);
  // esc() only escapes &<>"', so the curly apostrophe in the message survives
  // verbatim and the whole sentence must appear on screen.
  assert.ok(overlay.innerHTML.includes(WAFFLE_AI_LOCK_MESSAGE), 'the apology is on screen');
  assert.match(overlay.innerHTML, /data-waffle-tap/, 'Sir Waffle stays tappable as the beta door');
  assert.ok(!overlay.innerHTML.includes('waffle-ai-input'), 'no composer is rendered while paused');

  closeWaffleAI();
  assert.equal(overlay.hidden, true);
  assert.equal(doc.body.classList.contains('waffle-modal-open'), false, 'scroll lock is released on close');
  clearDOM();
});

test('beta.html is the beta-testing door and is wired into the build', () => {
  assert.ok(fs.existsSync('beta.html'), 'beta.html exists');
  const beta = fs.readFileSync('beta.html', 'utf8');
  assert.match(beta, /<html lang="en" data-beta="1">/, 'beta build is marked on <html> so isBetaTesting() can see it');
  assert.match(beta, /<title>BiteSizedUtilities Beta Testing<\/title>/);
  assert.match(beta, /src="\.\/app\.js"/, 'beta page runs the same kitchen app');
  assert.ok(!beta.includes('iframe'), 'beta page embeds no iframes');

  const viteSrc = fs.readFileSync('vite.config.js', 'utf8');
  assert.match(viteSrc, /beta:\s*path\.resolve\('beta\.html'\)/, 'Rollup emits beta.html alongside index.html');

  const indexSrc = fs.readFileSync('index.html', 'utf8');
  assert.ok(!indexSrc.includes('data-beta'), 'the public page is never a beta build');
});

test('ten taps on Sir Waffle in three seconds open beta testing', () => {
  const appSrc = fs.readFileSync('app.js', 'utf8');
  assert.match(appSrc, /const BETA_TAP_TARGET = 10;/);
  assert.match(appSrc, /const BETA_TAP_WINDOW_MS = 3000;/);
  assert.match(appSrc, /new URL\('beta\.html', document\.baseURI\)/, 'redirect is resolved against the document so GitHub Pages sub-paths work');
  assert.match(appSrc, /data-waffle-tap/, 'the corner mascot and the paused notice are both tap targets');
  // The mascot handler calls stopPropagation(), so the counter must listen in
  // the capture phase or taps would never reach it.
  assert.match(appSrc, /document\.addEventListener\('click'[\s\S]{0,120}?\}, true\);/, 'tap counter listens in the capture phase');
  assert.match(appSrc, /if \(isBetaTesting\(\)\) \{ betaTaps = \[\]; return; \}/, 'beta page does not redirect to itself');
});

test('the changelog puts 1.0.1 above the original 1.0 release', () => {
  assert.equal(APP_VERSION, '1.0.1');
  assert.equal(CHANGELOG.length, 2, 'exactly two releases are documented');
  assert.deepEqual(CHANGELOG.map(e => e.version), ['1.0.1', '1.0'], 'newest release is listed first');

  for (const entry of CHANGELOG) {
    assert.match(entry.version, /^\d+\.\d+(\.\d+)?$/);
    assert.ok(entry.date && entry.title, `${entry.version} has a date and a title`);
    assert.ok(Array.isArray(entry.groups) && entry.groups.length >= 3, `${entry.version} documents its changes in groups`);
    for (const g of entry.groups) {
      assert.ok(g.label && Array.isArray(g.items) && g.items.length, `${entry.version}/${g.label} has entries`);
      for (const item of g.items) assert.ok(item.length > 20, `${entry.version}: entries are real sentences`);
    }
  }

  const latest = CHANGELOG[0];
  const latestText = latest.groups.map(g => `${g.label} ${g.items.join(' ')}`).join(' ');
  assert.match(latestText, /Waffle AI is paused/, '1.0.1 says the AI is paused');
  assert.ok(latestText.includes(WAFFLE_AI_LOCK_MESSAGE), '1.0.1 carries the same apology visitors see');
  assert.match(latestText, /Beta Testing/, '1.0.1 tells testers how to get the AI back');
  assert.match(latestText, /ten times within three seconds/, 'the beta door recipe is documented');

  const original = CHANGELOG[1];
  const originalText = original.groups.map(g => `${g.label} ${g.items.join(' ')}`).join(' ');
  assert.match(originalText, /115 bite-sized utilities across 8 cupboards/, '1.0 records the launch scope');
  assert.match(originalText, /45 offline games/);
  assert.match(originalText, /CodeHub/);
  assert.match(originalText, /No accounts, no subscriptions, no uploads/);
});

test('the changelog is reachable from the kitchen header and styled like the rest of the site', () => {
  const appSrc = fs.readFileSync('app.js', 'utf8');
  assert.match(appSrc, /import \{ openChangelog \} from '\.\/changelog\.js';/);
  assert.match(appSrc, /id="changelog-toggle"/, 'a What\u2019s New button sits in the kitchen header');
  assert.match(appSrc, /uiIconSVG\('scroll'\)/, 'the button uses a hand-drawn 2.5D icon');

  const iconsSrc = fs.readFileSync('icons-25d.js', 'utf8');
  assert.match(iconsSrc, /scroll: `<svg class="game-svg"/, 'the scroll icon is a real inline SVG');

  const css = fs.readFileSync('style.css', 'utf8');
  for (const cls of ['.changelog-card', '.changelog-entry', '.changelog-version', '.changelog-items', '.changelog-nav-btn']) {
    assert.ok(css.includes(cls), `style.css styles ${cls}`);
  }
  assert.ok(!css.includes('backdrop-filter'), 'changelog keeps the strict 2.5D rules (no frosted blur)');
});

test('AI is out of Settings in the public build but back for beta testers', () => {
  const appSrc = fs.readFileSync('app.js', 'utf8');
  const section = appSrc.slice(
    appSrc.indexOf('${isBetaTesting() ? `'),
    appSrc.indexOf('` : \'\'}\n      </div>\n    </div>\n\n    <div class="settings-overlay" id="english-warning-overlay"')
  );
  assert.ok(section.length > 500, 'the whole AI settings block is inside the beta conditional');
  for (const id of ['settings-ai-section', 'settings-ai-text-list', 'settings-ai-image-list', 'settings-ai-exec-list', 'settings-ai-quant-list', 'settings-ai-precache', 'settings-temp-wrap']) {
    assert.ok(section.includes(id), `${id} only renders for beta testers`);
  }
  assert.match(appSrc, /if \(!\$\('#settings-ai-precache'\)\) return;/, 'pre-cache state is not refreshed when the panel is gone');
  assert.match(appSrc, /if \(!isBetaTesting\(\)\) return;\n\n  detectDeviceDiagnostics/, 'device probes are skipped while AI is paused');
});

test('Sir Waffle stops advertising Waffle AI while the feature is paused', () => {
  const appSrc = fs.readFileSync('app.js', 'utf8');
  const corner = appSrc.slice(appSrc.indexOf('<aside class="waffle-corner"'), appSrc.indexOf('</aside>'));
  assert.match(corner, /\$\{aiLocked \? 'Tap Sir Waffle!' : 'Touch me for Waffle AI!'\}/);
  assert.match(corner, /\$\{aiLocked \? '' : '<span class="waffle-ai-tag"[^>]*>Waffle AI<\/span>'\}/, 'the Waffle AI tag is conditional');
  assert.ok(!/aria-label="Waffle AI Button"/.test(corner), 'no hardcoded Waffle AI label survives');

  // The wall quip is an AI feature, so it must stay behind the same gate while
  // the endpoint string the existing suite asserts on is still present.
  assert.match(appSrc, /if \(aiLocked\) \{[\s\S]{0,240}?return;\s*\}\s*\n\s*if \(wallQuipAbort\)/);
  assert.ok(appSrc.includes('/api/waffle-ai/wall-quip'), 'beta build still calls the quip endpoint');
  assert.ok(appSrc.includes('openWaffleAI'), 'Sir Waffle still opens the AI surface');
  assert.ok(!appSrc.includes('waffle-hud-btn'), 'still exactly one Waffle button');
  assert.ok(!appSrc.includes('await import('), 'app.js keeps static imports');
});

test('every AI feature inside tools is gated, not silently broken', () => {
  const codeSrc = fs.readFileSync('tools-code.js', 'utf8');
  assert.match(codeSrc, /isWaffleAiLocked, waffleAiLockedNoticeHTML/);
  const diagnose = codeSrc.slice(codeSrc.indexOf('async function diagnoseWithCoderAI'), codeSrc.indexOf('function buildMoreChips'));
  assert.match(diagnose, /if \(isWaffleAiLocked\(\)\) \{[\s\S]*?waffleAiLockedNoticeHTML\(\);[\s\S]*?return;/, 'CodeHub diagnostics show the notice instead of calling a model');
  assert.ok(codeSrc.includes('AI Error Diagnostics') && codeSrc.includes('qwen2.5-coder-1.5b'), 'the beta build keeps the real diagnostics wiring');

  const engSrc = fs.readFileSync('tools-english.js', 'utf8');
  assert.match(engSrc, /isWaffleAiLocked, waffleAiLockedNoticeHTML/);
  assert.match(engSrc, /if \(isWaffleAiLocked\(\)\) \{[\s\S]{0,400}?waffleAiLockedNoticeHTML\(\);\s*return;/, 'every AI writing helper funnels through the gate');
  assert.match(engSrc, /isWaffleAiLocked\(\) \? \['Google Translate'\] : \['Google Translate', 'Waffle AI \(Strict\)'\]/, 'the strict-AI engine is only offered in beta');
  assert.match(engSrc, /isWaffleAiLocked\(\) \? '🔒 AI writing helpers are paused' : '✨ Powered by Qwen 2\.5 1\.5B'/, 'badges stop naming a model that cannot run');
  assert.ok(engSrc.includes('translate.googleapis.com/translate_a/single'), 'Google Translate keeps working without AI');
  assert.ok(engSrc.includes('(Speak in ${appLang})'), 'language hint survives for the beta build');

  for (const f of ['tools-code.js', 'tools-english.js', 'app.js', 'waffle-ai.js', 'changelog.js']) {
    assert.ok(!fs.readFileSync(f, 'utf8').includes('iframe'), `${f} embeds no iframes`);
    assert.ok(!fs.readFileSync(f, 'utf8').includes('navigator.clipboard?.writeText'), `${f} uses copyToClipboard`);
  }
});

test('the paused notice and beta banner are styled, and nothing is deleted', () => {
  const css = fs.readFileSync('style.css', 'utf8');
  for (const cls of ['.waffle-ai-locked-dialog', '.waffle-ai-locked-mascot', '.waffle-ai-locked-copy', '.waffle-ai-locked-note', '.beta-banner', '.beta-banner-exit']) {
    assert.ok(css.includes(cls), `style.css styles ${cls}`);
  }
  assert.ok(!css.includes('backdrop-filter'), 'no frosted blur anywhere');
  assert.ok(css.includes('Fredoka') && css.includes('Nunito'), 'local fonts still declared');
  assert.ok(css.includes('rotateY(-108deg)'), 'cupboard door animation intact');

  // Pausing is not deleting: the models, runtimes and server stay in the tree so
  // the beta build can switch them straight back on.
  for (const f of ['waffle-browser-ai.js', 'waffle-ai-server.js', 'waffle-image-gen.js']) {
    assert.ok(fs.existsSync(f), `${f} still ships`);
  }
  const browserAi = fs.readFileSync('waffle-browser-ai.js', 'utf8');
  assert.match(browserAi, /export const TEXT_MODELS/);
  assert.match(browserAi, /streamWllamaChat/);
  assert.match(browserAi, /precacheTextModel/);
});
