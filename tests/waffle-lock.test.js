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
  assert.ok(!src.includes('data-waffle-tap'), 'and nothing is marked tappable any more — the gesture that needed it is retired');

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

test('the way in is a string typed at Waffle AI, and nothing in the UI explains it', () => {
  const appSrc = fs.readFileSync('app.js', 'utf8');
  const aiSrc = fs.readFileSync('waffle-ai.js', 'utf8');
  const doorSrc = fs.readFileSync('backup-door.js', 'utf8');
  const cipherSrc = fs.readFileSync('backup-cipher.js', 'utf8');

  // The gesture is gone from the page: no counter, no window, no tap targets and
  // no redirect. What replaced it lives in two modules the page never renders.
  for (const gone of ['UNLOCK_TAP_TARGET', 'UNLOCK_TAP_WINDOW_MS', 'unlockTaps', 'registerWaffleTap', 'data-waffle-tap']) {
    assert.ok(!appSrc.includes(gone), `app.js no longer carries ${gone}`);
  }
  assert.ok(!/new URL\('backup\.html'/.test(appSrc), 'and no longer navigates to a URL a visitor could type');

  // The string is checked before anything else reads the message, and the text
  // never reaches the transcript — a key in the chat history gets copy-pasted.
  assert.match(aiSrc, /if \(!attachments\.length && backupDoorMatches\(text\)\) \{/, 'the chat checks the door');
  const send = aiSrc.slice(aiSrc.indexOf('async function sendMessage(rawText) {'));
  const doorAt = send.indexOf('backupDoorMatches(text)');
  const imageAt = send.indexOf('parseImageIntent(text)');
  assert.ok(doorAt > 0 && imageAt > 0 && doorAt < imageAt,
    'before it checks anything else about the message');
  assert.match(aiSrc, /await runBackupDoor\(\);\s*return;/, 'and stops there instead of asking a model about it');
  assert.ok(!aiSrc.slice(aiSrc.indexOf('async function sendMessage'), aiSrc.indexOf('async function sendMessage') + 1400)
    .includes('messages.push'), 'the string is never pushed into the transcript');

  // Neither the string nor a tap count is printed anywhere a visitor can read.
  for (const [name, src] of [['app.js', appSrc], ['waffle-ai.js', aiSrc], ['changelog.js', fs.readFileSync('changelog.js', 'utf8')],
    ['backup-door.js', doorSrc], ['index.html', fs.readFileSync('index.html', 'utf8')]]) {
    assert.ok(!/ten times|ten taps|tap him ten|10 taps/i.test(src), `${name} does not print the old recipe`);
    assert.ok(!src.includes('BACKUPKITCHEN'), `${name} does not print the string`);
  }
  assert.ok(!appSrc.includes('waffle-unlock-progress'), 'nothing broadcasts a run for a hint to display');
  assert.ok(!aiSrc.includes('waffle-ai-locked-tap-hint'), 'the paused notice has no tap hint');

  // The string itself is stored ciphered, so it is not in the source as text.
  assert.match(cipherSrc, /const PASSPHRASE_OBF = '[A-Za-z0-9+/=]{20,}';/, 'the passphrase is a ciphertext constant');
  assert.match(cipherSrc, /export function backupPassphrase\(\)/, 'recovered by one function');
  assert.match(doorSrc, /export function backupDoorMatches/, 'and matched through the door module');
});

test('the paused dialog is still dismissible, and counts nothing', () => {
  // This used to be a regression test for the unlock gesture: the dialog opened
  // on the first tap and covered the whole viewport, so the second tap landed on
  // the backdrop and closed it without counting, and the run could never finish.
  // The gesture is retired — the way in is a string typed at Waffle AI — so what
  // is left to pin is that the dialog this build no longer shows is still a
  // dialog a person can get out of, and that none of the counting machinery
  // survived with it.
  const aiSrc = fs.readFileSync('waffle-ai.js', 'utf8');
  const lockedFn = aiSrc.slice(aiSrc.indexOf('function buildLockedOverlay()'), aiSrc.indexOf('export function openLockedWaffleAI()'));
  assert.ok(lockedFn.length > 400, 'the paused overlay was captured');

  // Dismissal must still be reachable, or the dialog becomes a trap.
  assert.match(lockedFn, /#waffle-ai-locked-close/, 'the ✕ still closes it');
  assert.match(lockedFn, /#waffle-ai-locked-done/, 'the button still closes it');
  assert.match(lockedFn, /e\.key === 'Escape'/, 'and so does Escape');

  // No tap targets, no counter, no hint: the gesture is gone from the markup and
  // from the styling alike, not merely unreachable.
  assert.ok(!/waffleTap/.test(lockedFn), 'the dialog is not a tap target');
  assert.ok(!/waffle-unlock-progress/.test(lockedFn), 'and does not listen for a tap count');
  assert.ok(!/taps/.test(lockedFn), 'and never prints one');

  const css = fs.readFileSync('style.css', 'utf8');
  assert.ok(!css.includes('waffle-ai-locked-tap-hint'), 'the hint styling went with the hint');
});

test('the changelog puts 1.2.8 above 1.2.7 above 1.2.6 above 1.2.5 above 1.2.1 above 1.2 above 1.1.1 above 1.1 above 1.0.1 above the original 1.0 release', () => {
  assert.equal(APP_VERSION, '1.2.8');
  assert.equal(CHANGELOG.length, 10, 'every release is documented');
  assert.deepEqual(CHANGELOG.map(e => e.version), ['1.2.8', '1.2.7', '1.2.6', '1.2.5', '1.2.1', '1.2', '1.1.1', '1.1', '1.0.1', '1.0'], 'newest release is listed first');

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

  // 1.2.8 changed what CodeHub says when a runtime will not start. The public
  // notes have to carry the awkward half of that — the wall is still there and a
  // folder still cannot run a language — or the entry reads as a fix that is not.
  const diagnosed = textOf('1.2.8');
  assert.match(diagnosed, /Runtime could not load over file/, 'it quotes the line a visitor actually saw');
  assert.match(diagnosed, /wherever the page was served from/, 'and says what was wrong with it: it blamed a disk from a served page too');
  assert.match(diagnosed, /names the file that did not load/, 'what it reports instead, which is something a real break can be debugged from');
  assert.match(diagnosed, /41 of its 42 languages/, 'the count of what hits the wall, derived from the catalogue rather than typed in');
  assert.match(diagnosed, /the Regex Tester, the CSS Minifier, the JavaScript Formatter and the SQL Formatter/, 'and the four other tools that share it, named');
  assert.match(diagnosed, /as a link that can be tapped/, 'the way out is an address, because a folder can follow a link');
  assert.match(diagnosed, /HTML \/ CSS \/ JS sandbox still runs from a folder/, 'including the one language that does work there');
  assert.match(diagnosed, /does not make the languages run from a folder, and cannot/, 'the title of the last group is the honest one');
  assert.match(diagnosed, /freezes the tab and takes the whole kitchen with it/, 'with the reason: the worker is also the timeout guard');
  assert.match(diagnosed, /will not receive any of this/, 'and the fact that a copy already on a disk cannot be reached');
  for (const oversold of ['now works offline', 'works from a folder now', 'every language runs offline', 'fixed offline']) {
    assert.ok(!diagnosed.toLowerCase().includes(oversold), `it never says "${oversold}", which would not be true`);
  }
  // The entry quotes the old line, so the quote goes before the check: what must
  // not survive is the *instruction*, and the notes withdraw it explicitly.
  const unquoted = diagnosed.split('"Runtime could not load over file://; serve over HTTP."').join('');
  assert.ok(unquoted !== diagnosed, 'the old line is quoted, so a reader can recognise it');
  assert.match(diagnosed, /The old advice is gone from it/, 'and told that it was withdrawn');
  assert.ok(!/serve over HTTP/i.test(unquoted), 'nowhere else does it tell a reader to do the thing a folder cannot');

  // 1.2.7 is the release that took the offline download back out, and it has to say
  // so plainly: somebody who read the notes for 1.2.6 and went looking for an archive
  // should find out here that it is gone, why, and what still works with no connection.
  const removed = textOf('1.2.7');
  assert.match(removed, /no longer builds or publishes an offline archive/, 'it says what stopped happening');
  assert.match(removed, /release it lived under has been deleted/, 'and that there is nothing left to download');
  assert.match(removed, /If you already have a copy, it still opens/, 'without pretending a folder on somebody\u2019s disk stopped working');
  assert.match(removed, /exactly as it was in 1\.2\.6/, 'and without implying the kitchen changed');
  assert.match(removed, /an ES module, a worker, and a fetch of the file sitting beside it/, 'with the browser rule that beat it, not a shrug');
  assert.match(removed, /95 of the 115 utilities/, 'keeping what the last build measured before it went');
  assert.match(removed, /a browser feature and not a promise/, 'the offline copy the site keeps is detected, never promised');
  for (const gone of ['zip:offline', 'build:classic', 'START-HERE', 'node-llama']) {
    assert.ok(!removed.includes(gone), `${gone} is build machinery, and the public notes do not hand anybody a command to run`);
  }

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

test('AI is in Settings in both kitchens, and the probes follow the gate', () => {
  // Until 1.2 the whole AI settings block sat inside `${isBackupBuild() ? ... }`,
  // which would have left the public kitchen with AI it could not configure: the
  // model menu, the device pill and the pre-cache panel all live in there.
  const appSrc = fs.readFileSync('app.js', 'utf8');
  const section = appSrc.slice(
    appSrc.indexOf('<div class="gfield settings-ai-section"'),
    appSrc.indexOf('<div class="settings-overlay" id="english-warning-overlay"')
  );
  assert.ok(section.length > 500, 'the whole AI settings block was captured');
  for (const id of ['settings-ai-section', 'settings-ai-text-list', 'settings-ai-image-list', 'settings-ai-exec-list', 'settings-ai-quant-list', 'settings-ai-precache', 'settings-temp-wrap']) {
    assert.ok(section.includes(id), `${id} is part of the settings both builds render`);
  }
  assert.ok(!section.includes('${isBackupBuild()'), 'and none of it is conditional on the build');
  assert.equal(appSrc.split('${isBackupBuild() ? `').length - 1, 1,
    'the only build-conditional markup left is the backup banner itself');

  assert.match(appSrc, /if \(!\$\('#settings-ai-precache'\)\) return;/, 'pre-cache state is not refreshed when the panel is gone');
  // The probes were folded into refreshDeviceFacts() in 1.3 TVBR 2, so the device
  // popup can reuse the answer instead of re-probing; the gate is still what skips
  // them, and the function it calls is still the one that probes.
  assert.match(appSrc, /if \(isWaffleAiLocked\(\)\) return;\n\n  refreshDeviceFacts\(true\)/,
    'the device probes skip on the gate, not on the build');
  assert.match(appSrc, /function refreshDeviceFacts\(force = false\) \{[\s\S]{0,320}?detectDeviceDiagnostics\(\)/,
    'and they are still the probes that run');
  assert.ok(appSrc.includes('id="ai-warning-overlay"'), 'the popup the short warnings open is in both kitchens too');
  const warnPopup = appSrc.slice(appSrc.indexOf('id="ai-warning-overlay"'), appSrc.indexOf('id="exp-warning-overlay"'));
  assert.ok(warnPopup.length > 400, 'and the whole of it was captured');
  assert.ok(!warnPopup.includes('${isBackupBuild()'), 'with none of it conditional on the build');
  assert.ok(warnPopup.includes('AI_DISCLAIMER_TEXT'), 'carrying the long warning the strips no longer print');
});

test('Sir Waffle stops advertising Waffle AI while the feature is paused', () => {
  const appSrc = fs.readFileSync('app.js', 'utf8');
  const corner = appSrc.slice(appSrc.indexOf('<aside class="waffle-corner"'), appSrc.indexOf('</aside>'));
  assert.match(corner, /\$\{aiLocked \? 'Tap Sir Waffle!' : 'Touch me for Waffle AI!'\}/);
  assert.match(corner, /\$\{aiLocked \? '' : '<span class="waffle-ai-tag"[^>]*>Waffle AI<\/span>'\}/, 'the Waffle AI tag is conditional');
  assert.ok(!/aria-label="Waffle AI Button"/.test(corner), 'no hardcoded Waffle AI label survives');

  // The wall quip is an AI feature, so it must stay behind the same gate while
  // the endpoint string the existing suite asserts on is still present. The folder
  // build shares the gate: there is no server to ask, and a fetch of ./api/... off
  // the disk is refused and printed before it fails.
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
  assert.ok(codeSrc.includes('AI Error Diagnostics'), 'the diagnostics toggle is still wired');
  // 1.2.1 pinned the helper to one model. The pin is a named constant rather than
  // a string at the call site, so the thing that decides is in one place.
  assert.match(codeSrc, /const CODE_DIAGNOSTIC_MODEL_ID = 'granite-code-0\.5b';/, 'and it is pinned to Granite Code 0.5B');
  assert.match(codeSrc, /modelId: CODE_DIAGNOSTIC_MODEL_ID/, 'through the constant, at the call');
  assert.match(codeSrc, /err\.name === 'WaffleModelPending'/, 'a model that has not arrived is handled, not swallowed');
  assert.ok(!codeSrc.includes("'qwen2.5-coder-1.5b'"), 'and nothing still asks for the old one');

  const engSrc = fs.readFileSync('tools-english.js', 'utf8');
  assert.match(engSrc, /isWaffleAiLocked, waffleAiLockedNoticeHTML/);
  assert.match(engSrc, /if \(isWaffleAiLocked\(\)\) \{[\s\S]{0,400}?waffleAiLockedNoticeHTML\(\);\s*return;/, 'every AI writing helper funnels through the gate');
  assert.match(engSrc, /isWaffleAiLocked\(\) \? \['Google Translate'\] : \['Google Translate', 'Waffle AI \(Strict\)'\]/, 'the strict-AI engine is only offered in the backup build');
  assert.match(engSrc, /isWaffleAiLocked\(\) \? '🔒 AI writing helpers are paused' : `✨ Powered by \$\{chosenLabel\}`/,
    'the banner names the model that is actually selected, not one hard-coded three releases ago');
  assert.match(engSrc, /const chosenLabel = TEXT_MODELS\.find\(m => m\.id === getSelectedTextModel\(\)\)\?\.label/, 'read from the choice');
  assert.ok(engSrc.includes('translate.googleapis.com/translate_a/single'), 'Google Translate keeps working without AI');
  assert.ok(engSrc.includes('(Speak in ${appLang})'), 'language hint survives in the backup build');
  assert.match(engSrc, /appLang !== 'English'/, 'but is not appended when the kitchen is already in English');
  assert.match(engSrc, /maxTokens: budget,/, 'and every tool asks for a device-sized answer');
  assert.match(engSrc, /const TOKEN_BUDGETS = \{/, 'each one from a table of its own');
  assert.equal(engSrc.match(/'[a-z0-9-]+': \d+,?/g)?.length >= 15, true, 'one budget per tool in the cupboard');

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
