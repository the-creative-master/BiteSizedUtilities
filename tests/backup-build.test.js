// The backup build, its TVAR version scheme, and the rule that nothing in the
// public kitchen advertises either of them.
//
// Two things are pinned here that are easy to break by accident:
//   1. index.html reports a plain release version and never sees a TVAR entry;
//   2. the retired wording for the second build is gone from every source file,
//      apart from the one legacy constant that keeps old drawings openable.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  APP_VERSION, TVAR, APP_VERSION_EXTENDED, TVAR_LOG, CHANGELOG, appVersionLabel
} from '../changelog.js';
import { isBackupBuild, isPublicBuild } from '../build-mode.js';
import { cupboards, allTools, backupToolAdditions, resolveTools } from '../catalog.js';

/** Points `document` at a page whose <html> carries (or lacks) the flag. */
function pageWith(dataset) {
  globalThis.document = { documentElement: { dataset } };
}

/* ============================== the version scheme ============================== */

test('the public kitchen reports a plain release version and knows nothing about TVAR', () => {
  pageWith({});
  assert.equal(APP_VERSION, '1.1');
  assert.equal(appVersionLabel(), '1.1', 'index.html says 1.1 and nothing else');
  assert.equal(isBackupBuild(), false);
  assert.equal(isPublicBuild(), true);
  assert.ok(!APP_VERSION.includes('TVAR'), 'the release version never carries a TVAR suffix');
  assert.ok(!JSON.stringify(CHANGELOG).includes('TVAR'), 'and the public release notes never mention one');
});

test('the backup kitchen reports 1.1 TVAR 3 and gets the extended entries', () => {
  pageWith({ backup: '1' });
  assert.equal(TVAR, 3, 'this is the third test version after 1.1');
  assert.equal(APP_VERSION_EXTENDED, '1.1 TVAR 3');
  assert.equal(appVersionLabel(), '1.1 TVAR 3', 'backup.html reports the extended version');
  assert.equal(isBackupBuild(), true);
  assert.equal(isPublicBuild(), false);

  assert.equal(TVAR_LOG.length, 3, 'every extended minor version is documented');
  assert.equal(TVAR_LOG[0].version, APP_VERSION_EXTENDED,
    'the newest entry spells out the counter, so bumping TVAR cannot leave it describing the wrong build');
  assert.deepEqual(TVAR_LOG.map(e => e.version), [`${APP_VERSION} TVAR 3`, `${APP_VERSION} TVAR 2`, `${APP_VERSION} TVAR 1`],
    'newest first, and an old entry keeps its own number');

  for (const tvar of TVAR_LOG) {
    assert.equal(tvar.tvar, true, `${tvar.version} is marked so the renderer can style it apart`);
    assert.ok(tvar.date && tvar.title, `${tvar.version} has a date and a title`);
    assert.ok(tvar.groups.length >= 3, `${tvar.version} documents itself in groups`);
    for (const g of tvar.groups) {
      assert.ok(g.label && g.items.length, `${g.label} has entries`);
      for (const item of g.items) assert.ok(item.length > 20, 'entries are real sentences');
    }
  }

  const textOf = e => e.groups.map(g => `${g.label} ${g.items.join(' ')}`).join(' ');
  const all = TVAR_LOG.map(textOf).join(' ');
  assert.match(all, /test version after release/, 'the log explains what TVAR stands for');
  assert.match(all, /Hugging Face/, 'and records the extended AI error report');

  const latest = textOf(TVAR_LOG[0]);
  assert.match(latest, /Huawei/, 'TVAR 3 records the devices it was built for');
  assert.match(latest, /Kirin NPU cannot be reached from a web page/,
    'and says plainly what the NPU cannot do instead of implying it works');
  assert.match(latest, /WebNN/, 'naming the one web API that could');
  assert.match(latest, /suspect/, 'an adapter is graded, not just detected');
  assert.match(latest, /rankBrowserAttempts/, 'the ordering rule is written down');
  assert.match(latest, /1\.8 GB/, 'so is the tighter heap budget on a tablet');
  assert.match(latest, /ArkWeb/, 'and the mapping that dates a Huawei browser');

  const tvar2 = textOf(TVAR_LOG[1]);
  assert.match(tvar2, /freez/, 'TVAR 2 records the freeze it was built to fix');
  assert.match(tvar2, /Only one inference runs at a time/, 'what replaced it');
  assert.match(tvar2, /45 seconds/, 'the watchdog window a visitor would actually hit');
  assert.match(tvar2, /cannot be revived/, 'and it is honest about what a watchdog cannot do');
});

test('TVAR entries reset with each release and are rendered only in the backup build', () => {
  pageWith({});
  const src = fs.readFileSync('changelog.js', 'utf8');
  assert.match(src, /export const APP_VERSION_EXTENDED = `\$\{APP_VERSION\} TVAR \$\{TVAR\}`;/,
    'the extended label is derived, so bumping TVAR is a one-character change');
  assert.match(src, /Reset to 0 on every public release/, 'the reset rule is written down where the counter lives');
  assert.match(src, /const releases = isBackupBuild\(\) \? \[\.\.\.TVAR_LOG, \.\.\.CHANGELOG\] : CHANGELOG;/,
    'the renderer only prepends TVAR entries in the backup build');
  assert.match(src, /\$\{esc\(appVersionLabel\(\)\)\}/, 'and the footer prints the label for this build');
  assert.match(src, /entry\.tvar \? ' is-tvar' : ''/, 'TVAR entries are marked in the markup');

  // Every TVAR entry has to sit above the release it was built from, which is
  // what makes "newest first" true for the combined list.
  for (const entry of TVAR_LOG) {
    assert.ok(entry.version.startsWith(`${APP_VERSION} TVAR `), `${entry.version} belongs to the ${APP_VERSION} release`);
  }
});

/* ============================== the second build ============================== */

test('backup.html is the only page that switches the extra build on', () => {
  const backup = fs.readFileSync('backup.html', 'utf8');
  const index = fs.readFileSync('index.html', 'utf8');
  assert.match(backup, /<html lang="en" data-backup="1">/);
  assert.ok(!index.includes('data-backup'), 'the public page does not carry the flag');
  assert.ok(!index.includes('data-beta'), 'and not the retired one either');
  assert.match(backup, /<script type="module" src="\.\/app\.js"><\/script>/, 'both pages run the same app');
  // The backup page also asks not to be indexed, which is the only other
  // difference: same app, same shell, same fallback loader.
  const strip = (html, flag) => html
    .replace(flag ? / data-backup="1"/g : /\u0000/g, '')
    .replace(/<meta name="robots" content="noindex,nofollow">/g, '')
    .replace(/<title>[^<]*<\/title>/g, '')
    .replace(/<meta name="description" content="[^"]*">/g, '');
  assert.equal(strip(backup, true), strip(index, false),
    'apart from the flag, the title, the description and the noindex tag, the two pages are the same document');
});

test('the extra tools still only exist in the backup build, and are named for what they do', () => {
  pageWith({});
  assert.equal(resolveTools(false), allTools, 'the public list is the shipped array itself');
  assert.equal(resolveTools(false).length, 115);
  assert.equal(backupToolAdditions.length, 1);

  const tile = resolveTools(true).find(t => t.backup);
  assert.equal(tile.id, 'art-studio-layers');
  assert.equal(tile.name, 'Art Studio (with layers)');
  assert.ok(!/beta/i.test(tile.name), 'the tile is not named after a release stage');
  assert.equal(tile.cupboard, 'art');
  assert.ok(cupboards.find(c => c.id === 'art'), 'and that cupboard still exists');

  // The name in the catalogue, the icon map and the dispatch all agree.
  const icons = fs.readFileSync('icons-25d.js', 'utf8');
  assert.ok(icons.includes("'art-studio-layers': wrapTile("), 'the tile has its own drawn icon');
  const ui = fs.readFileSync('tools-text-art.js', 'utf8');
  assert.ok(ui.includes('artStudioLayers(ctx)'), 'and a mount path');
});

/* ============================== nothing advertises it ============================== */

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'runtimes', 'cabinet', 'fonts', '.playwright-cli']);
const TEXT_EXT = new Set(['.js', '.mjs', '.cjs', '.html', '.css', '.json', '.md', '.webmanifest', '.yml', '.yaml', '.svg', '.txt']);
const SKIP_FILES = new Set(['package-lock.json']);
// Places where the retired word is allowed to survive, each with a reason.
const ALLOWED = new Map([
  ['art-studio-layers.js', 'the pre-rename project magic, so drawings saved before the rename still open'],
  ['tests/art-studio-layers.test.js', 'asserts that the pre-rename magic still opens'],
  ['tests/backup-build.test.js', 'this file has to name the word in order to forbid it']
]);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.github') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(full);
    } else if (entry.isFile()) {
      if (SKIP_FILES.has(entry.name)) continue;
      if (!TEXT_EXT.has(path.extname(entry.name))) continue;
      yield full;
    }
  }
}

test('the retired wording for the second build is gone from the whole repository', () => {
  const needle = 'beta';
  const offenders = [];
  let scanned = 0;
  for (const file of walk('.')) {
    const rel = path.relative('.', file).split(path.sep).join('/');
    scanned += 1;
    if (ALLOWED.has(rel)) continue;
    const src = fs.readFileSync(file, 'utf8');
    const hits = src.split('\n')
      .map((line, i) => (line.toLowerCase().includes(needle) ? `${rel}:${i + 1}: ${line.trim().slice(0, 110)}` : null))
      .filter(Boolean);
    offenders.push(...hits);
  }
  assert.ok(scanned > 40, `the sweep really walked the repository (${scanned} files)`);
  assert.deepEqual(offenders, [], 'every source file is free of the retired wording');

  // The allowlist has to stay honest: each entry still exists and still needs it.
  for (const [rel, reason] of ALLOWED) {
    if (rel === 'tests/backup-build.test.js') continue;
    assert.ok(fs.existsSync(rel), `${rel} still exists (${reason})`);
  }
  const studio = fs.readFileSync('art-studio-layers.js', 'utf8');
  assert.match(studio, /LEGACY_PROJECT_MAGIC/, 'the one surviving mention is the legacy project magic');
});

test('the unlock gesture is reachable but never explained', () => {
  const appSrc = fs.readFileSync('app.js', 'utf8');
  assert.match(appSrc, /const UNLOCK_TAP_TARGET = 10;/, 'the gesture still exists');
  assert.match(appSrc, /const UNLOCK_TAP_WINDOW_MS = 3000;/);
  assert.match(appSrc, /openBackupKitchen\(\)/, 'and still opens the backup kitchen');
  assert.match(appSrc, /new URL\('backup\.html', document\.baseURI\)/);

  // What must not exist: anything a visitor could read and then repeat.
  const readable = [
    ['app.js', appSrc],
    ['waffle-ai.js', fs.readFileSync('waffle-ai.js', 'utf8')],
    ['changelog.js', fs.readFileSync('changelog.js', 'utf8')],
    ['index.html', fs.readFileSync('index.html', 'utf8')]
  ];
  for (const [name, src] of readable) {
    assert.ok(!/ten (times|taps)|tap him|10 taps|tap anywhere here ten/i.test(src),
      `${name} does not spell out the recipe`);
  }
  const css = fs.readFileSync('style.css', 'utf8');
  assert.ok(!css.includes('waffle-ai-locked-tap-hint'), 'the hint that used to count taps out loud is gone, styling and all');
  assert.ok(!appSrc.includes('waffle-unlock-progress'), 'and nothing broadcasts the run for a hint to render');

  // The banner in the backup build describes the build, not how to find it.
  assert.match(appSrc, /BACKUP KITCHEN/);
  assert.ok(!/how to (get|reach) here|ten taps/i.test(appSrc), 'the banner does not leak the recipe either');
});

test('the paused-AI notice quotes the current cabinet and keeps its promise', () => {
  const aiSrc = fs.readFileSync('waffle-ai.js', 'utf8');
  assert.match(aiSrc, /all 115 utilities and all 51 games/, 'the notice counts what the kitchen actually has');
  assert.ok(!aiSrc.includes('all 45 games'), 'and not the number from launch day');

  const games = JSON.parse(fs.readFileSync('games/catalog.json', 'utf8'));
  assert.equal(games.length, 51, 'which is the real cabinet size');
  assert.equal(allTools.length, 115, 'and the real tool count');
});
