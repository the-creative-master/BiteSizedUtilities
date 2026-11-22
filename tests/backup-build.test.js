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
  APP_VERSION, TVAR, TVAR_CYCLE, APP_VERSION_EXTENDED, TVAR_LOG, CHANGELOG, appVersionLabel
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
  assert.equal(APP_VERSION, '1.2.6');
  assert.equal(appVersionLabel(), '1.2.6', 'index.html says 1.2.6 and nothing else');
  assert.equal(isBackupBuild(), false);
  assert.equal(isPublicBuild(), true);
  assert.ok(!APP_VERSION.includes('TVAR'), 'the release version never carries a TVAR suffix');
  assert.ok(!JSON.stringify(CHANGELOG).includes('TVAR'), 'and the public release notes never mention one');
  // That the backup kitchen exists is public and has been since 1.1.1 — three
  // released entries say so, and one of them says it got harder to get into
  // "on purpose". What may never appear in the public notes is the *mechanism*:
  // the TVAR label, the disguised filename, the page it decodes to, or the
  // string that opens it. The release notes are the most discoverable page on
  // the site, so they are the last place any of that belongs.
  const publicCopy = JSON.stringify(CHANGELOG).toLowerCase();
  for (const forbidden of ['tvar', 'dontaskme', 'backup.html', 'backupkitchen', 'passphrase']) {
    assert.ok(!publicCopy.includes(forbidden), `the public notes never reveal "${forbidden}"`);
  }
});

test('the backup kitchen reports the test build it is, not the release beside it', () => {
  pageWith({ backup: '1' });
  // 1.2.6 is what the public kitchen says. This build is a test version on top
  // of 1.2, so it says so — and the two labels are allowed to disagree, which is
  // the whole reason the cycle is its own constant instead of APP_VERSION.
  assert.equal(TVAR, 5, 'one test build is open');
  assert.equal(TVAR_CYCLE, '1.2', 'on the 1.2 cycle');
  assert.equal(APP_VERSION, '1.2.6', 'while the release has moved on without it');
  assert.equal(appVersionLabel(), '1.2 TVAR 5', 'backup.html reports the build it is');
  assert.equal(isBackupBuild(), true);
  assert.equal(isPublicBuild(), false);

  // The 1.1 test versions stay documented as history; they are not this build.
  assert.equal(TVAR_LOG.length, 8, 'every extended minor version is still documented');
  assert.deepEqual(TVAR_LOG.map(e => e.version), ['1.2 TVAR 5', '1.2 TVAR 4', '1.2 TVAR 3', '1.2 TVAR 2', '1.2 TVAR 1', '1.1 TVAR 3', '1.1 TVAR 2', '1.1 TVAR 1'],
    'newest first, and an old entry keeps its own number');
  assert.equal(TVAR_LOG[0].version, APP_VERSION_EXTENDED,
    'the newest entry spells out the label this build reports, so it cannot be renumbered behind its own back');

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

  const open = textOf(TVAR_LOG[0]);
  // The name is in the title, and textOf() reads labels and items — asserting on
  // `open` here would have been asserting on a string the entry never contains.
  assert.match(TVAR_LOG[0].title, /NO-SERVER/, '1.2 TVAR 5 is named after what it is testing');
  assert.match(open, /content:/, 'it names the protocol a tablet file manager actually hands the browser');
  assert.match(open, /The folder was intact/, 'and says what the old hiccup message got wrong');
  assert.match(open, /Served now means http or https and nothing else/, 'the rule that replaced the file: test');
  assert.match(open, /blob: or data:/, 'including the addresses that have no folder behind them at all');
  assert.match(open, /the manifest/, 'it lists what a disk page used to ask for and could not have');
  assert.match(open, /service worker/i, 'and the registration that had no scope to register into');
  assert.match(open, /80 KB of woff2/, 'with the size of the faces it now carries inline');
  assert.match(open, /five places/, 'the copies of one list that drifted inside a single session');
  assert.match(open, /offline-facts\.js/, 'and the module that replaced them');
  assert.match(open, /26 playable from a folder/, 'the cabinet is measured, not remembered');
  assert.match(open, /four protocols/, 'tested at every protocol a person can arrive by');
  assert.match(open, /jsdom does not enforce/, 'honest about what the passing test did not prove');
  assert.ok(!open.includes('BACKUPKITCHEN'), 'without printing the string that opens this kitchen');

  const folderKitchen = textOf(TVAR_LOG[1]);
  // The name is in the title, and textOf() reads labels and items — asserting on
  // `open` here would have been asserting on a string the entry never contains.
  assert.match(TVAR_LOG[1].title, /FOLDER-KITCHEN/, '1.2 TVAR 4 stays documented as the build it was');
  assert.match(folderKitchen, /explained itself instead of being the kitchen/, 'it says what the last build got wrong');
  assert.match(folderKitchen, /assumed a tool/, 'and that assuming Python was the worse half of it');
  assert.match(folderKitchen, /nothing about opening a folder should require one/, 'the rule this build was made to satisfy');
  assert.match(folderKitchen, /npm run build:classic/, 'with the command that makes the folder build');
  assert.match(folderKitchen, /classic script/, 'naming the one kind of script a file: page will run');
  assert.match(folderKitchen, /190 MB/, 'and the size aliasing the AI engines out of it avoids');
  assert.match(folderKitchen, /Unable to load the offline arcade/, 'including the error the bundled catalog replaced');
  assert.match(folderKitchen, /26 of those games/, 'with the count of what actually plays from a folder');
  assert.match(folderKitchen, /no prerequisite software/, 'nothing has to be installed to open it');
  assert.match(folderKitchen, /still optional/, 'the server is offered, and the entry says so');
  assert.match(folderKitchen, /unzipped and booted/, 'and the claim is tested against the finished archive');
  assert.match(folderKitchen, /1 file\u201d instead of \u201c1 files/, 'down to the pluralisation in the release notes');
  assert.ok(!folderKitchen.includes('BACKUPKITCHEN'), 'without printing the string that opens this kitchen');

  const zipBuild = textOf(TVAR_LOG[2]);
  assert.match(TVAR_LOG[2].title, /OFFLINE-ZIP/, '1.2 TVAR 3 stays documented as the build it was');
  assert.match(zipBuild, /single HTML file from the last test build is gone/, 'it says what it retired, not only what it added');
  assert.match(zipBuild, /entire site as a zip/, 'and what replaced it');
  assert.match(zipBuild, /release asset/, 'where the archive lives');
  assert.match(zipBuild, /661 MB/, 'with the number that ruled out shipping it inside the site');
  assert.match(zipBuild, /440 downloads/, 'and the one that ruled out its bandwidth');
  assert.match(zipBuild, /127\.0\.0\.1/, 'the launcher serves the folder to this machine only');
  assert.match(zipBuild, /one thread deep/, 'honest about the WASM a plain server cannot isolate');
  assert.match(zipBuild, /all 51 game entrypoints/, 'checked against the extracted folder, not assumed');
  assert.match(zipBuild, /offline-zip\.json/, 'including the stale-metadata bug that check found');
  assert.match(zipBuild, /npm run zip:offline/, 'with the command that packs it');
  assert.ok(!zipBuild.includes('BACKUPKITCHEN'), 'without printing the string that opens this kitchen');

  const single = textOf(TVAR_LOG[3]);
  assert.match(TVAR_LOG[3].title, /OFFLINE-HTML-TEST/, '1.2 TVAR 2 stays documented as the build it was');
  assert.match(single, /single HTML file/, 'it says what it added');
  assert.match(single, /1\.2 MB/, 'including the number the guards brought it down to');
  assert.match(single, /temporal dead zone/, 'and the bug that booting the artifact caught');
  assert.match(single, /npm run build:offline/, 'with the command that made it, since retired');

  const tvar1 = textOf(TVAR_LOG[4]);
  assert.match(tvar1, /Falcon 3 1B/, '1.2 TVAR 1 names the model it added');
  assert.match(tvar1, /DONTASKMEWHATTHATIS\.txt/, 'and the file the build now ships as');
  assert.match(tvar1, /obfuscation and not encryption/, 'without pretending the disguise is a secret');
  assert.ok(!tvar1.includes('BACKUPKITCHEN'), 'and without printing the string that opens it');

  const latest = textOf(TVAR_LOG[5]);
  assert.match(latest, /Huawei/, 'TVAR 3 records the devices it was built for');
  assert.match(latest, /Kirin NPU cannot be reached from a web page/,
    'and says plainly what the NPU cannot do instead of implying it works');
  assert.match(latest, /WebNN/, 'naming the one web API that could');
  assert.match(latest, /suspect/, 'an adapter is graded, not just detected');
  assert.match(latest, /rankBrowserAttempts/, 'the ordering rule is written down');
  assert.match(latest, /1\.8 GB/, 'so is the tighter heap budget on a tablet');
  assert.match(latest, /ArkWeb/, 'and the mapping that dates a Huawei browser');

  const tvar2 = textOf(TVAR_LOG[6]);
  assert.match(tvar2, /freez/, 'TVAR 2 records the freeze it was built to fix');
  assert.match(tvar2, /Only one inference runs at a time/, 'what replaced it');
  assert.match(tvar2, /45 seconds/, 'the watchdog window a visitor would actually hit');
  assert.match(tvar2, /cannot be revived/, 'and it is honest about what a watchdog cannot do');
});

test('TVAR entries reset with each release and are rendered only in the backup build', () => {
  pageWith({});
  const src = fs.readFileSync('changelog.js', 'utf8');
  assert.match(src, /export const APP_VERSION_EXTENDED = `\$\{TVAR_CYCLE\} TVAR \$\{TVAR\}`;/,
    'the extended label is derived, so bumping TVAR is a one-character change');
  assert.match(src, /export const TVAR_CYCLE = '1\.2';/,
    'from the cycle it belongs to, which is a literal: APP_VERSION has moved on to 1.2.6 and deriving from it would announce a build that has never existed');
  assert.match(src, /Reset to 0 on every public release/, 'the reset rule is written down where the counter lives');
  assert.match(src, /const releases = isBackupBuild\(\) \? \[\.\.\.TVAR_LOG, \.\.\.CHANGELOG\] : CHANGELOG;/,
    'the renderer only prepends TVAR entries in the backup build');
  assert.match(src, /\$\{esc\(appVersionLabel\(\)\)\}/, 'and the footer prints the label for this build');
  assert.match(src, /entry\.tvar \? ' is-tvar' : ''/, 'TVAR entries are marked in the markup');

  // A TVAR entry belongs to the release cycle it was built from and sits above
  // that release in the combined list, which is what makes "newest first" true.
  // The counter resets on release, so what is left is history: these are 1.1's
  // test builds, not 1.1.1's, and they say so.
  assert.equal(TVAR, Number(TVAR_LOG[0].version.split(' TVAR ')[1]), 'the counter and the newest entry agree');
  for (const entry of TVAR_LOG) {
    assert.match(entry.version, /^\d+\.\d+(\.\d+)? TVAR \d+$/, `${entry.version} names its cycle and its counter`);
    assert.ok(entry.version.startsWith('1.2 TVAR ') || entry.version.startsWith('1.1 TVAR '),
      `${entry.version} belongs to a cycle that really shipped`);
    assert.equal(entry.tvar, true, 'and is still marked so the renderer can style it apart');
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
  // index.html carries two things backup.html does not, and both have to be
  // inline, in the head, and public-only.
  //
  // The first is the four-line script that reads the door's stash and writes the
  // decoded page: the backup kitchen has no door to open into itself.
  //
  // The second answers an unzipped folder. It does nothing at all unless the page
  // was opened over file:, where a browser refuses the module that the rest of the
  // document depends on; on a served page it returns on its first line. The backup
  // page never needs it, because it is not in dist to be unzipped — the build
  // removes it and the door writes it.
  const DOOR_SCRIPT = /<script>\(function\(\)\{try\{var h=sessionStorage[\s\S]*?<\/script>/;
  const FILE_HANDOFF_SCRIPT = /<script>\(function\(\)\{if\(location\.protocol!=='file:'\)return;[\s\S]*?<\/script>/;
  const strip = (html, flag) => html
    .replace(DOOR_SCRIPT, '')
    .replace(FILE_HANDOFF_SCRIPT, '')
    .replace(flag ? / data-backup="1"/g : /\u0000/g, '')
    .replace(/<meta name="robots" content="noindex,nofollow">/g, '')
    .replace(/<title>[^<]*<\/title>/g, '')
    .replace(/<meta name="description" content="[^"]*">/g, '');
  assert.equal(strip(backup, true), strip(index, false),
    'apart from the flag, the title, the description and the noindex tag, the two pages are the same document');
});

test('no tool is backup-only any more, and both kitchens hold the same 115', () => {
  pageWith({});
  assert.equal(resolveTools(false), allTools, 'the public list is the shipped array itself');
  assert.equal(resolveTools(false).length, 115);
  assert.equal(backupToolAdditions.length, 0, '1.1.1 folded the layered studio into Art Studio');
  assert.equal(resolveTools(true).length, 115);
  assert.ok(!resolveTools(true).some(t => t.backup), 'nothing is gated behind the backup page');
  assert.ok(cupboards.find(c => c.id === 'art'), 'the Art & Coloring cupboard still exists');

  const ui = fs.readFileSync('tools-text-art.js', 'utf8');
  assert.ok(ui.includes('artStudioLayers(ctx)'), 'Art Studio mounts the layered studio');
  assert.match(ui, /id === 'art-studio' \|\| id === LAYERS_STUDIO_ID/, 'and the retired id still reaches it');
});

/* ============================== nothing advertises it ============================== */

// Build output is skipped, not searched: dist-offline/kitchen.js is the bundled
// art-studio-layers.js, so it carries the same pre-rename project magic that the
// ALLOWED map below permits in the source, minified beyond recognition.
// Build outputs are skipped: they are generated from files this sweep already
// reads, and the folder build in particular bundles the whole kitchen into one
// script, so anything anywhere in the source would appear in it a second time.
const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-offline', 'dist-zip', 'dist-classic', '.git', 'runtimes', 'cabinet', 'fonts', '.playwright-cli']);
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

test('the tap gesture is gone, and nothing explains the door that replaced it', () => {
  const appSrc = fs.readFileSync('app.js', 'utf8');
  // Ten taps inside three seconds was a door anybody could be told about and
  // anybody could hit by accident while bouncing the waffle wall, and it
  // navigated to an address sitting in the bundle in plain text. None of it is
  // left: no counter, no window, no redirect, no tap targets.
  for (const gone of ['UNLOCK_TAP_TARGET', 'UNLOCK_TAP_WINDOW_MS', 'unlockTaps', 'registerWaffleTap',
    'openBackupKitchen', 'data-waffle-tap']) {
    assert.ok(!appSrc.includes(gone), `app.js no longer carries ${gone}`);
  }
  assert.ok(!/new URL\('backup\.html'/.test(appSrc), 'and nothing in the page navigates to the backup URL');

  // What must not exist anywhere a visitor can read: the recipe, the string, or
  // a hint that counts anything out loud.
  const readable = [
    ['app.js', appSrc],
    ['waffle-ai.js', fs.readFileSync('waffle-ai.js', 'utf8')],
    ['changelog.js', fs.readFileSync('changelog.js', 'utf8')],
    ['backup-door.js', fs.readFileSync('backup-door.js', 'utf8')],
    ['index.html', fs.readFileSync('index.html', 'utf8')]
  ];
  for (const [name, src] of readable) {
    assert.ok(!/ten (times|taps)|tap him|10 taps|tap anywhere here ten/i.test(src),
      `${name} does not spell out the old recipe`);
    assert.ok(!src.includes('BACKUPKITCHEN'), `${name} does not print the string that opens the door`);
  }
  const css = fs.readFileSync('style.css', 'utf8');
  assert.ok(!css.includes('waffle-ai-locked-tap-hint'), 'the hint that used to count taps out loud is gone, styling and all');
  assert.ok(!appSrc.includes('waffle-unlock-progress'), 'and nothing broadcasts a run for a hint to render');

  // The banner in the backup build describes the build, not how to find it.
  assert.match(appSrc, /BACKUP KITCHEN/);
  assert.ok(!/how to (get|reach) here|ten taps/i.test(appSrc), 'the banner does not leak the way in either');
});

test('the paused-AI notice quotes the current cabinet and keeps its promise', () => {
  const aiSrc = fs.readFileSync('waffle-ai.js', 'utf8');
  assert.match(aiSrc, /all 115 utilities and all 51 games/, 'the notice counts what the kitchen actually has');
  assert.ok(!aiSrc.includes('all 45 games'), 'and not the number from launch day');

  const games = JSON.parse(fs.readFileSync('games/catalog.json', 'utf8'));
  assert.equal(games.length, 51, 'which is the real cabinet size');
  assert.equal(allTools.length, 115, 'and the real tool count');
});
