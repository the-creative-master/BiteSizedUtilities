import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  WAFFLE_AI_LOCK_MESSAGE,
  WaffleAiLockedError,
  isBackupBuild,
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
function miniDOM({ backup = false } = {}) {
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
  if (backup) doc.documentElement.dataset.backup = '1';
  globalThis.document = doc;
  if (!globalThis.window) globalThis.window = { addEventListener() {}, removeEventListener() {} };
  return doc;
}

function clearDOM() {
  delete globalThis.document;
}

test('the pause machinery is still here, spelled correctly, and one line away', () => {
  // 1.2 reopened the gate. Nothing below was deleted with it, on purpose: the
  // message, the error class and the notice are what a future release needs in
  // order to pause again by changing one return.

  assert.match(WAFFLE_AI_LOCK_MESSAGE, /^I apologize for the inconvenience but WaffleAI isn\u2019t available/);
  assert.match(WAFFLE_AI_LOCK_MESSAGE, /countless bugs with open-source AI models/);
  assert.match(WAFFLE_AI_LOCK_MESSAGE, /We will make it available in a later update\.$/);
  // The message visitors actually read must not carry the typo it was drafted with.
  assert.ok(!WAFFLE_AI_LOCK_MESSAGE.includes('avaible'), 'lock message spells "available" correctly');
  assert.equal(new WaffleAiLockedError().name, 'WaffleAiLocked');
  assert.match(waffleAiLockedNoticeHTML(), /waffle-ai-locked-note/);
});

test('the AI gate is open in both kitchens, and one function closes it again', () => {
  miniDOM({ backup: false });
  assert.equal(isBackupBuild(), false, 'index.html is not the backup build');
  assert.equal(isWaffleAiLocked(), false, '1.2 put Waffle AI back in the public kitchen');

  globalThis.document.documentElement.dataset.backup = '1';
  assert.equal(isBackupBuild(), true, 'backup.html is still the build with the test switches on');
  assert.equal(isWaffleAiLocked(), false, 'and AI works there too, because it is the same kitchen');
  clearDOM();

  // The pause is one line rather than a hunt: every entry point still asks the
  // same function, so closing the gate again cannot miss a surface.
  const src = fs.readFileSync('waffle-ai.js', 'utf8');
  assert.match(src, /export function isWaffleAiLocked\(\) \{\n  return false;\n\}/,
    'the gate is a single return');
  assert.ok(src.split('isWaffleAiLocked()').length - 1 >= 4,
    'and every AI surface still reads it');
});

test('a paused kitchen would still do no AI network work — the guards stayed wired', () => {
  // Nothing is paused now, so there is no quiet behaviour left to observe. What
  // is still worth pinning is that reopening the gate did not delete the checks:
  // one returned `true` and every background entry point stops again.
  const src = fs.readFileSync('waffle-ai.js', 'utf8');
  assert.equal(src.split('if (isWaffleAiLocked()) return;').length - 1, 2,
    'both background paths still check the gate before they touch the network');
  assert.match(src, /if \(isWaffleAiLocked\(\)\) throw new WaffleAiLockedError\(\);/,
    'and the chat path throws rather than half-working');
  assert.match(src, /if \(isWaffleAiLocked\(\)\) \{ openLockedWaffleAI\(\); return; \}/,
    'so a paused build shows the notice instead of a dead composer');
});

test('the paused notice is still built, and only when the gate is closed', () => {
  // With the gate open, opening the AI builds the real chat overlay, which needs
  // a browser rather than this file's miniature DOM — the Playwright suites own
  // that. What is pinned here is the branch: the notice still exists, it is
  // still the thing a paused build shows, and an open build never reaches it.
  const src = fs.readFileSync('waffle-ai.js', 'utf8');
  assert.match(src, /function buildLockedOverlay\(\)/, 'the paused overlay is still built by the same function');
  assert.match(src, /Waffle AI is taking a break/, 'with the copy visitors were promised');
  assert.match(src, /data-waffle-tap/, 'and Sir Waffle stays tappable as the hidden unlock gesture');

  const openFn = src.slice(src.indexOf('export function openWaffleAI()'), src.indexOf('export function openWaffleAI()') + 400);
  assert.ok(openFn.length > 100, 'openWaffleAI was captured');
  assert.match(openFn, /if \(isWaffleAiLocked\(\)\) \{ openLockedWaffleAI\(\); return; \}/,
    'the notice is only reachable through the gate');
  assert.equal(isWaffleAiLocked(), false, 'which 1.2 leaves open');
});

test('backup.html is the second build of the kitchen and is wired into the build', () => {
  assert.ok(fs.existsSync('backup.html'), 'backup.html exists');
  const backup = fs.readFileSync('backup.html', 'utf8');
  assert.match(backup, /<html lang="en" data-backup="1">/, 'the build is marked on <html> so isBackupBuild() can see it');
  assert.match(backup, /<title>BiteSized Utilities \u2014 Backup Kitchen<\/title>/);
  assert.match(backup, /content="noindex,nofollow"/, 'the page asks not to be indexed');
  assert.match(backup, /src="\.\/app\.js"/, 'it runs the same kitchen app');
  assert.ok(!backup.includes('iframe'), 'it embeds no iframes');

  const viteSrc = fs.readFileSync('vite.config.js', 'utf8');
  assert.match(viteSrc, /backup:\s*path\.resolve\('backup\.html'\)/, 'Rollup emits backup.html alongside index.html');

  const indexSrc = fs.readFileSync('index.html', 'utf8');
  assert.ok(!indexSrc.includes('data-backup'), 'the public page is never the backup build');
});

test('the unlock gesture still works, and nothing in the UI explains it', () => {
  const appSrc = fs.readFileSync('app.js', 'utf8');
  assert.match(appSrc, /const UNLOCK_TAP_TARGET = 10;/, 'the recipe still lives in one constant');
  assert.match(appSrc, /const UNLOCK_TAP_WINDOW_MS = 3000;/);
  assert.match(appSrc, /new URL\('backup\.html', document\.baseURI\)/, 'the redirect is resolved against the document so GitHub Pages sub-paths work');
  assert.match(appSrc, /data-waffle-tap/, 'the corner mascot and the paused notice are both tap targets');
  // The mascot handler calls stopPropagation(), so the counter must listen in
  // the capture phase or taps would never reach it.
  assert.match(appSrc, /document\.addEventListener\('click'[\s\S]{0,120}?\}, true\);/, 'tap counter listens in the capture phase');
  assert.match(appSrc, /if \(isBackupBuild\(\)\) \{ unlockTaps = \[\]; return; \}/, 'the backup page does not redirect to itself');

  // The gesture is hidden on purpose: it used to be spelled out in the
  // changelog, on a banner, and in a hint that counted taps out loud.
  const aiSrc = fs.readFileSync('waffle-ai.js', 'utf8');
  const changelogSrc = fs.readFileSync('changelog.js', 'utf8');
  for (const [name, src] of [['app.js', appSrc], ['waffle-ai.js', aiSrc], ['changelog.js', changelogSrc]]) {
    assert.ok(!/ten times|ten taps|tap him ten|10 taps/i.test(src), `${name} does not print the recipe`);
  }
  assert.ok(!appSrc.includes('waffle-unlock-progress'), 'and the run is not broadcast for a hint to display');
  assert.ok(!aiSrc.includes('waffle-ai-locked-tap-hint'), 'the paused notice has no tap hint');
});

test('the paused dialog cannot swallow the taps meant for the unlock gesture', () => {
  // Regression: the dialog opens on the FIRST tap and covers the whole viewport
  // (position fixed, inset 0, z-index 90) including the corner mascot (45). A
  // second tap in the same place landed on the backdrop, which closed the dialog
  // without counting, so the run alternated open/close and could never reach ten
  // — which reads exactly like a timeout.
  const aiSrc = fs.readFileSync('waffle-ai.js', 'utf8');
  const lockedFn = aiSrc.slice(aiSrc.indexOf('function buildLockedOverlay()'), aiSrc.indexOf('export function openLockedWaffleAI()'));

  assert.match(lockedFn, /wrap\.dataset\.waffleTap = ''/,
    'the whole dialog is a tap target, so a tap anywhere in it counts');
  assert.ok(!/if \(e\.target === wrap\) closeWaffleAI\(\)/.test(lockedFn),
    'the backdrop no longer closes the dialog mid-run');
  // Dismissal must still be reachable, or the dialog becomes a trap.
  assert.match(lockedFn, /#waffle-ai-locked-close/, 'the ✕ still closes it');
  assert.match(lockedFn, /#waffle-ai-locked-done/, 'the button still closes it');
  assert.match(lockedFn, /e\.key === 'Escape'/, 'and so does Escape');

  // The dialog still has to stay out of the way, but it no longer narrates the
  // run: no hint, no counter, no styling for either.
  assert.ok(!/waffle-unlock-progress/.test(lockedFn), 'the dialog does not listen for a tap count');
  assert.ok(!/taps/.test(lockedFn), 'and never prints one');

  const css = fs.readFileSync('style.css', 'utf8');
  assert.ok(!css.includes('waffle-ai-locked-tap-hint'), 'the hint styling went with the hint');
});

test('the changelog puts 1.2 above 1.1.1 above 1.1 above 1.0.1 above the original 1.0 release', () => {
  assert.equal(APP_VERSION, '1.2');
  assert.equal(CHANGELOG.length, 5, 'every release is documented');
  assert.deepEqual(CHANGELOG.map(e => e.version), ['1.2', '1.1.1', '1.1', '1.0.1', '1.0'], 'newest release is listed first');

  for (const entry of CHANGELOG) {
    assert.match(entry.version, /^\d+\.\d+(\.\d+)?$/);
    assert.ok(entry.date && entry.title, `${entry.version} has a date and a title`);
    assert.ok(Array.isArray(entry.groups) && entry.groups.length >= 3, `${entry.version} documents its changes in groups`);
    for (const g of entry.groups) {
      assert.ok(g.label && Array.isArray(g.items) && g.items.length, `${entry.version}/${g.label} has entries`);
      for (const item of g.items) assert.ok(item.length > 20, `${entry.version}: entries are real sentences`);
    }
  }

  const textOf = v => {
    const entry = CHANGELOG.find(e => e.version === v);
    assert.ok(entry, `${v} is documented`);
    return entry.groups.map(g => `${g.label} ${g.items.join(' ')}`).join(' ');
  };

  const latest = textOf('1.1');
  assert.match(latest, /WAFFLE-CALC-2500/, '1.1 names the calculator chassis it shipped');
  assert.match(latest, /-PRO/, '1.1 says the scientific keypads are a -PRO model');
  assert.match(latest, /polar mode|polar turns/, '1.1 records the graphing polar work');
  assert.match(latest, /Analyse report/, '1.1 records the analysis engine');
  assert.match(latest, /Two-a-days/, '1.1 records the new bodily tab');
  assert.match(latest, /Toast Breakout/, '1.1 names an original game');
  assert.match(latest, /Kitchen Snake/);
  assert.match(latest, /Syrup Glide/);
  assert.match(latest, /Waffle Whisk/);
  assert.match(latest, /51 games/, '1.1 states the new cabinet size');
  assert.match(latest, /Art Studio \(with layers\)/, '1.1 records the layered art studio by its real name');
  assert.match(latest, /Waffle AI is still paused/, '1.1 does not pretend the AI came back');
  assert.match(latest, /backup build/, '1.1 mentions the other build without advertising how to reach it');

  // Vendored games are credited in the release notes, and the retired folder
  // name is not: that rename was never a user-facing change to announce.
  assert.match(latest, /Susam Pal/, '1.1 credits the MIT authors it vendored from');
  assert.match(latest, /Jack Rugile/);
  assert.match(latest, /MIT licence/, '1.1 says under what licence they arrived');
  const wholeChangelog = JSON.stringify(CHANGELOG);
  assert.ok(!/schoolgames/i.test(wholeChangelog), 'the changelog never names the retired folder');

  const honest = textOf('1.0.1');
  assert.match(honest, /Waffle AI is paused/, '1.0.1 says the AI is paused');
  assert.ok(honest.includes(WAFFLE_AI_LOCK_MESSAGE), '1.0.1 carries the same apology visitors see');
  assert.ok(!/testing programme/i.test(honest), '1.0.1 no longer advertises a testing programme');
  assert.ok(!/ten times within three seconds/i.test(honest), 'and no longer prints the unlock recipe');

  const originalText = textOf('1.0');
  assert.match(originalText, /115 bite-sized utilities across 8 cupboards/, '1.0 records the launch scope');
  assert.match(originalText, /45 offline games/, '1.0 keeps its launch-day count as history');
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

test('AI is out of Settings in the public build but back in the backup build', () => {
  const appSrc = fs.readFileSync('app.js', 'utf8');
  const section = appSrc.slice(
    appSrc.indexOf('${isBackupBuild() ? `'),
    appSrc.indexOf('` : \'\'}\n      </div>\n    </div>\n\n    <div class="settings-overlay" id="english-warning-overlay"')
  );
  assert.ok(section.length > 500, 'the whole AI settings block is inside the backup conditional');
  for (const id of ['settings-ai-section', 'settings-ai-text-list', 'settings-ai-image-list', 'settings-ai-exec-list', 'settings-ai-quant-list', 'settings-ai-precache', 'settings-temp-wrap']) {
    assert.ok(section.includes(id), `${id} only renders in the backup build`);
  }
  assert.match(appSrc, /if \(!\$\('#settings-ai-precache'\)\) return;/, 'pre-cache state is not refreshed when the panel is gone');
  assert.match(appSrc, /if \(!isBackupBuild\(\)\) return;\n\n  detectDeviceDiagnostics/, 'device probes are skipped while AI is paused');
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
  assert.ok(appSrc.includes('/api/waffle-ai/wall-quip'), 'the backup build still calls the quip endpoint');
  assert.ok(appSrc.includes('openWaffleAI'), 'Sir Waffle still opens the AI surface');
  assert.ok(!appSrc.includes('waffle-hud-btn'), 'still exactly one Waffle button');
  assert.ok(!appSrc.includes('await import('), 'app.js keeps static imports');
});

test('every AI feature inside tools is gated, not silently broken', () => {
  const codeSrc = fs.readFileSync('tools-code.js', 'utf8');
  assert.match(codeSrc, /isWaffleAiLocked, waffleAiLockedNoticeHTML/);
  const diagnose = codeSrc.slice(codeSrc.indexOf('async function diagnoseWithCoderAI'), codeSrc.indexOf('function buildMoreChips'));
  assert.match(diagnose, /if \(isWaffleAiLocked\(\)\) \{[\s\S]*?waffleAiLockedNoticeHTML\(\);[\s\S]*?return;/, 'CodeHub diagnostics show the notice instead of calling a model');
  assert.ok(codeSrc.includes('AI Error Diagnostics') && codeSrc.includes('qwen2.5-coder-1.5b'), 'the backup build keeps the real diagnostics wiring');

  const engSrc = fs.readFileSync('tools-english.js', 'utf8');
  assert.match(engSrc, /isWaffleAiLocked, waffleAiLockedNoticeHTML/);
  assert.match(engSrc, /if \(isWaffleAiLocked\(\)\) \{[\s\S]{0,400}?waffleAiLockedNoticeHTML\(\);\s*return;/, 'every AI writing helper funnels through the gate');
  assert.match(engSrc, /isWaffleAiLocked\(\) \? \['Google Translate'\] : \['Google Translate', 'Waffle AI \(Strict\)'\]/, 'the strict-AI engine is only offered in the backup build');
  assert.match(engSrc, /isWaffleAiLocked\(\) \? '🔒 AI writing helpers are paused' : '✨ Powered by Qwen 2\.5 1\.5B'/, 'badges stop naming a model that cannot run');
  assert.ok(engSrc.includes('translate.googleapis.com/translate_a/single'), 'Google Translate keeps working without AI');
  assert.ok(engSrc.includes('(Speak in ${appLang})'), 'language hint survives in the backup build');

  for (const f of ['tools-code.js', 'tools-english.js', 'app.js', 'waffle-ai.js', 'changelog.js']) {
    assert.ok(!fs.readFileSync(f, 'utf8').includes('iframe'), `${f} embeds no iframes`);
    assert.ok(!fs.readFileSync(f, 'utf8').includes('navigator.clipboard?.writeText'), `${f} uses copyToClipboard`);
  }
});

test('the paused notice and backup banner are styled, and nothing is deleted', () => {
  const css = fs.readFileSync('style.css', 'utf8');
  for (const cls of ['.waffle-ai-locked-dialog', '.waffle-ai-locked-mascot', '.waffle-ai-locked-copy', '.waffle-ai-locked-note', '.backup-banner', '.backup-banner-exit']) {
    assert.ok(css.includes(cls), `style.css styles ${cls}`);
  }
  assert.ok(!css.includes('backdrop-filter'), 'no frosted blur anywhere');
  assert.ok(css.includes('Fredoka') && css.includes('Nunito'), 'local fonts still declared');
  assert.ok(css.includes('rotateY(-108deg)'), 'cupboard door animation intact');

  // Pausing is not deleting: the models, runtimes and server stay in the tree so
  // the backup build can switch them straight back on.
  for (const f of ['waffle-browser-ai.js', 'waffle-ai-server.js', 'waffle-image-gen.js']) {
    assert.ok(fs.existsSync(f), `${f} still ships`);
  }
  const browserAi = fs.readFileSync('waffle-browser-ai.js', 'utf8');
  assert.match(browserAi, /export const TEXT_MODELS/);
  assert.match(browserAi, /streamWllamaChat/);
  assert.match(browserAi, /precacheTextModel/);
});
