// The backup build, its TVBR version scheme, and the rule that nothing in the
// public kitchen advertises either of them.
//
// Two things are pinned here that are easy to break by accident:
//   1. index.html reports a plain release version and never sees a TVBR entry;
//   2. the retired wording for the second build is gone from every source file,
//      apart from the one legacy constant that keeps old drawings openable.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  APP_VERSION, TVBR, TVBR_CYCLE, APP_VERSION_EXTENDED, TVBR_LOG, CHANGELOG, appVersionLabel
} from '../changelog.js';
import { isBackupBuild, isPublicBuild } from '../build-mode.js';
import { cupboards, allTools, backupToolAdditions, resolveTools } from '../catalog.js';

/** Points `document` at a page whose <html> carries (or lacks) the flag. */
function pageWith(dataset) {
  globalThis.document = { documentElement: { dataset } };
}

/* ============================== the version scheme ============================== */

test('the public kitchen reports a plain release version and knows nothing about TVBR', () => {
  pageWith({});
  assert.equal(APP_VERSION, '1.2.10');
  assert.equal(appVersionLabel(), '1.2.10', 'index.html says 1.2.10 and nothing else');
  assert.equal(isBackupBuild(), false);
  assert.equal(isPublicBuild(), true);
  // Both spellings: the label is TVBR now, but six shipped builds read TVAR, and
  // the public page is not allowed to mention a test version in either one.
  for (const label of ['TVBR', 'TVAR']) {
    assert.ok(!APP_VERSION.includes(label), `the release version never carries a ${label} suffix`);
    assert.ok(!JSON.stringify(CHANGELOG).includes(label), `and the public release notes never mention ${label}`);
  }
  // That the backup kitchen exists is public and has been since 1.1.1 — three
  // released entries say so, and one of them says it got harder to get into
  // "on purpose". What may never appear in the public notes is the *mechanism*:
  // the test-version label in either spelling, the disguised filename, the page
  // it decodes to, or the
  // string that opens it. The release notes are the most discoverable page on
  // the site, so they are the last place any of that belongs.
  const publicCopy = JSON.stringify(CHANGELOG).toLowerCase();
  for (const forbidden of ['tvbr', 'tvar', 'dontaskme', 'backup.html', 'backupkitchen', 'passphrase']) {
    assert.ok(!publicCopy.includes(forbidden), `the public notes never reveal "${forbidden}"`);
  }
});

test('the backup kitchen reports the test build it is, not the release beside it', () => {
  pageWith({ backup: '1' });
  // 1.2.10 is what the public kitchen says. This build is the third test version
  // of the open cycle, so it says so — and the two labels are allowed to
  // disagree, which is the whole reason the cycle is its own constant instead of
  // APP_VERSION. A new cycle restarts the counter at 1 rather than counting on
  // from the last cycle's 3, and the entries below keep the numbers they had.
  //
  // 1.2.10 is the case that proves the cycle has to be its own constant. It ships
  // part of 1.3 TVBR 3 — the star utilities — so the public version moved while
  // the cycle this build is named for did not. Resetting here would have announced
  // that 1.3 had shipped, which it has not.
  assert.equal(TVBR, 3, 'the counter sits at the build this kitchen reports');
  assert.equal(TVBR_CYCLE, '1.3', 'on the 1.3 cycle');
  assert.equal(APP_VERSION, '1.2.10', 'while the release has moved on without it');
  assert.equal(appVersionLabel(), '1.3 TVBR 3', 'backup.html reports the build it is');
  assert.equal(isBackupBuild(), true);
  assert.equal(isPublicBuild(), false);

  // The earlier test versions stay documented as history; they are not this build.
  assert.equal(TVBR_LOG.length, 9, 'every extended minor version is still documented');
  assert.deepEqual(TVBR_LOG.map(e => e.version), ['1.3 TVBR 3', '1.3 TVBR 2', '1.3 TVBR 1', '1.2 TVAR 3', '1.2 TVAR 2', '1.2 TVAR 1', '1.1 TVAR 3', '1.1 TVAR 2', '1.1 TVAR 1'],
    'newest first, and an old entry keeps its own number and its own spelling');
  assert.equal(TVBR_LOG[0].version, APP_VERSION_EXTENDED,
    'the newest entry spells out the label this build reports, so it cannot be renumbered behind its own back');

  for (const tvbr of TVBR_LOG) {
    assert.equal(tvbr.tvbr, true, `${tvbr.version} is marked so the renderer can style it apart`);
    assert.ok(tvbr.date && tvbr.title, `${tvbr.version} has a date and a title`);
    assert.ok(tvbr.groups.length >= 3, `${tvbr.version} documents itself in groups`);
    for (const g of tvbr.groups) {
      assert.ok(g.label && g.items.length, `${g.label} has entries`);
      for (const item of g.items) assert.ok(item.length > 20, 'entries are real sentences');
    }
  }

  const textOf = e => e.groups.map(g => `${g.label} ${g.items.join(' ')}`).join(' ');
  const all = TVBR_LOG.map(textOf).join(' ');
  assert.match(all, /test version after release/, 'the 1.1 entry still explains what TVAR stood for when it was written');
  assert.match(all, /Hugging Face/, 'and records the extended AI error report');

  const chat = textOf(TVBR_LOG[2]);
  // The build this kitchen reports. It has to state the storage limit in the
  // same breath as the feature, because a chat that says "saved" and then
  // disappears when somebody clears site data has oversold itself.
  assert.match(TVBR_LOG[0].title, /progress bar|lying/i, '1.3 TVBR 3 says what it is about in the title');
  assert.match(TVBR_LOG[1].title, /image generation|warnings/i, '1.3 TVBR 2 still says what it was about');
  assert.match(TVBR_LOG[2].title, /memory|sidebar/i, 'and 1.3 TVBR 1 still says what it was about');
  assert.match(chat, /Test Version BEfore Release/, 'the entry says what its own label stands for');
  assert.match(chat, /Test Version BEfore Release/, 'and what the open build\u2019s own label means');
  assert.match(chat, /1\.3 does not exist yet|does not exist yet/, 'which is why it is a before-release build at all');
  assert.match(chat, /Clear cookies and site data/, 'the limit is stated in the words the button uses');
  assert.match(chat, /no server/, 'including why there is nowhere else to put a conversation');
  assert.match(chat, /only copy that outlives a wipe/, 'so the export is presented as the answer, not a footnote');
  assert.match(chat, /264px rail/, 'the layout numbers are the ones in the stylesheet');
  assert.match(chat, /680px to as much as 1040px/, 'both the old width and the new one');
  assert.match(chat, /60 threads/, 'the rail cap is written down');
  assert.match(chat, /6 MB/, 'so is the budget a thread of pictures has to fit in');
  assert.match(chat, /newer timestamp wins/, 'and the rule that stops an old file rolling a live chat back');
  assert.match(chat, /12 tests/, 'pointing at the suite that holds the store');
  assert.match(chat, /fake wearing the same interface/, 'which admits that node has no real IndexedDB');
  assert.ok(!/syncs to the cloud|saved to (our|a|the) server|follows you to|on every device|backed up for you/i.test(chat),
    'it never claims a chat leaves this browser, because there is no server for it to leave to');

  const imageEntry = textOf(TVBR_LOG[1]);
  // The build this kitchen reports. It has to quote the failure it replaced and
  // say why the device it was reported from was a red herring, because the point
  // of the entry is that the bug was never about anybody's hardware.
  assert.match(imageEntry, /HTTP 404/, '1.3 TVBR 2 quotes the error every /imagine ended with');
  assert.match(imageEntry, /every other device tried/, 'and says why the reporting device was not the variable');
  assert.match(imageEntry, /nothing in the repository ever produced them/i, 'naming the missing producer rather than a missing file');
  assert.match(imageEntry, /FLUX\.2 Klein 4B/, 'the model that replaced the two checkpoints');
  assert.match(imageEntry, /flux-klein\.js 0\.7\.0/, 'and the engine, with the version that ships');
  assert.match(imageEntry, /Bonsai/, 'including the model the search started from');
  assert.match(imageEntry, /MLX/, 'and the concrete reason it is not what ships: no browser runtime');
  assert.match(imageEntry, /3\.3 GB/, 'the first-run download is stated where it is met');
  assert.match(imageEntry, /not in the deploy/, 'so is the fact that the weights are streamed, not shipped');
  assert.match(imageEntry, /28 words/, 'the short warning is counted rather than described');
  assert.match(imageEntry, /887 characters/, 'and so is the long one it took off the screen');
  assert.match(imageEntry, /word for word/, 'which moved rather than being cut');
  assert.match(imageEntry, /cannot be from here/, 'the group that admits what no test in this repo can do');
  assert.ok(!/works on any device|runs everywhere|any browser can generate|no download/i.test(imageEntry),
    'it never claims the image model runs where WebGPU does not, or without its weights');

  const tvbr3 = textOf(TVBR_LOG[3]);
  // The build this kitchen reports. It has to say what was wrong with the old
  // message rather than only what replaced it, because the point of the entry is
  // that a diagnostic was inventing its own cause.
  assert.match(tvbr3, /Runtime could not load over file/, '1.2 TVAR 3 quotes the string it took out');
  assert.match(tvbr3, /invented by the code that printed it/, 'and says plainly that the diagnosis was fabricated');
  assert.match(tvbr3, /throwing straight out of its constructor/, 'naming the second way a worker fails, which read differently from the first');
  assert.match(tvbr3, /python-worker\.js/, 'python keeps the worker file of its own it has always had');
  assert.match(tvbr3, /returning null on a served page/, 'the notice costs nothing where there is no wall');
  assert.match(tvbr3, /the JSON validator and the hash playground, get none/, 'and it is not pasted onto tools that run in the page');
  assert.match(tvbr3, /tests\/code-runtime-origin\.test\.js/, 'pointing at the suite that holds all of it');
  assert.match(tvbr3, /freezes the tab and takes the kitchen with it/, 'why there is no in-page fallback to offer instead');
  assert.ok(!/runs from a folder now|works offline now|fixed the folder/.test(tvbr3),
    'it never claims the wall came down, because it did not');

  const scrapped = textOf(TVBR_LOG[4]);
  // The name is in the title, and textOf() reads labels and items — asserting on
  // `scrapped` here would have been asserting on a string the entry never contains.
  assert.match(TVBR_LOG[4].title, /SCRAPPED/, '1.2 TVAR 2 is the entry that closed the offline package down');
  assert.match(scrapped, /whole offline package/i, 'it says what went, in one place, rather than by omission');
  assert.match(scrapped, /release it lived under is deleted/i, 'including the archive somebody could still go and fetch');
  assert.match(scrapped, /public kitchen is untouched/, 'and that the served site never loaded any of it');
  assert.match(scrapped, /an ES module, a worker, and a fetch of the file sitting next to it/, 'with the rule that beat four builds of it');
  assert.match(scrapped, /95 of them working/, 'keeping the count that was measured rather than remembered');
  assert.match(scrapped, /26 of the 51 games/, 'and the cabinet beside it');
  assert.match(scrapped, /node-llama-cpp/, 'naming the engine that was asked for, and the fact that it is Node-only');
  assert.match(scrapped, /every language it offers/, 'and why CodeHub goes as a whole cupboard rather than one tool at a time');
  assert.match(scrapped, /all 115 utilities work off the disk/, 'it records the copy that oversold it, since that is why the counts were measured at all');
  assert.match(scrapped, /only 85 do when 95 actually did/, 'and the one that undersold it');
  assert.match(scrapped, /1\.2\.6/, 'the release this build sits beside, so the entry can be dated by something real');
  for (const gone of ['npm run build:classic', 'npm run zip:offline', 'START-HERE']) {
    assert.ok(!scrapped.includes(gone), `${gone} is not offered to anybody any more, not even as a command to type`);
  }
  assert.ok(!scrapped.includes('BACKUPKITCHEN'), 'without printing the string that opens this kitchen');

  const tvbr1 = textOf(TVBR_LOG[5]);
  assert.match(tvbr1, /Falcon 3 1B/, '1.2 TVAR 1 names the model it added');
  assert.match(tvbr1, /DONTASKMEWHATTHATIS\.txt/, 'and the file the build now ships as');
  assert.match(tvbr1, /obfuscation and not encryption/, 'without pretending the disguise is a secret');
  assert.ok(!tvbr1.includes('BACKUPKITCHEN'), 'and without printing the string that opens it');

  const latest = textOf(TVBR_LOG[6]);
  assert.match(latest, /Huawei/, '1.1 TVAR 3 records the devices it was built for');
  assert.match(latest, /Kirin NPU cannot be reached from a web page/,
    'and says plainly what the NPU cannot do instead of implying it works');
  assert.match(latest, /WebNN/, 'naming the one web API that could');
  assert.match(latest, /suspect/, 'an adapter is graded, not just detected');
  assert.match(latest, /rankBrowserAttempts/, 'the ordering rule is written down');
  assert.match(latest, /1\.8 GB/, 'so is the tighter heap budget on a tablet');
  assert.match(latest, /ArkWeb/, 'and the mapping that dates a Huawei browser');

  const tvbr2 = textOf(TVBR_LOG[7]);
  assert.match(tvbr2, /freez/, '1.1 TVAR 2 records the freeze it was built to fix');
  assert.match(tvbr2, /Only one inference runs at a time/, 'what replaced it');
  assert.match(tvbr2, /45 seconds/, 'the watchdog window a visitor would actually hit');
  assert.match(tvbr2, /cannot be revived/, 'and it is honest about what a watchdog cannot do');
});

test('TVBR entries reset with each release and are rendered only in the backup build', () => {
  pageWith({});
  const src = fs.readFileSync('changelog.js', 'utf8');
  assert.match(src, /export const APP_VERSION_EXTENDED = `\$\{TVBR_CYCLE\} TVBR \$\{TVBR\}`;/,
    'the extended label is derived, so bumping TVBR is a one-character change');
  assert.match(src, /export const TVBR_CYCLE = '1\.3';/,
    'from the cycle it belongs to, which is a literal: APP_VERSION has moved on to 1.2.10 and deriving from it would announce a build that has never existed');
  assert.match(src, /A public release that ships \*part\* of an open cycle does not close it/,
    'and the rule for a partial release is written down where the constants live, because 1.2.10 is the first one');
  assert.match(src, /Reset to 0 when that/, 'the reset rule is written down where the counter lives');
  assert.match(src, /const releases = isBackupBuild\(\) \? \[\.\.\.TVBR_LOG, \.\.\.CHANGELOG\] : CHANGELOG;/,
    'the renderer only prepends TVBR entries in the backup build');
  assert.match(src, /\$\{esc\(appVersionLabel\(\)\)\}/, 'and the footer prints the label for this build');
  assert.match(src, /entry\.tvbr \? ' is-tvbr' : ''/, 'TVBR entries are marked in the markup');

  // A TVBR entry belongs to the release cycle it was built from and sits above
  // that release in the combined list, which is what makes "newest first" true.
  // The counter resets on release, so what is left is history: these are 1.1's
  // test builds, not 1.1.1's, and they say so.
  assert.equal(TVBR, Number(TVBR_LOG[0].version.split(' TVBR ')[1]), 'the counter and the newest entry agree');
  for (const entry of TVBR_LOG) {
    assert.match(entry.version, /^\d+\.\d+(\.\d+)? TV(?:AR|BR) \d+$/, `${entry.version} names its cycle and its counter`);
    assert.ok(/^1\.3 TVBR /.test(entry.version) || /^1\.[12] TVAR /.test(entry.version),
      `${entry.version} is either the open build, which reads TVBR, or one that shipped as TVAR`);
    assert.equal(entry.tvbr, true, 'and is still marked so the renderer can style it apart');
  }
});

test('TVAR and TVBR say where a build sits relative to its release', () => {
  // Not two spellings of one label. TVAR is a test version built AFTER its
  // release shipped; TVBR is one built BEFORE the release it is testing toward.
  // The open build is 1.3 TVBR 3 because 1.3 does not exist yet, and so are the
  // two below it; the six under those are TVAR because 1.1 and 1.2 did. Nothing
  // has been renamed, and the entry that documented the label meanings keeps its
  // own number and its own text.
  assert.equal(TVBR_LOG[0].version, '1.3 TVBR 3', 'the open build comes before its release');
  assert.deepEqual(TVBR_LOG.slice(1).map(e => e.version),
    ['1.3 TVBR 2', '1.3 TVBR 1', '1.2 TVAR 3', '1.2 TVAR 2', '1.2 TVAR 1', '1.1 TVAR 3', '1.1 TVAR 2', '1.1 TVAR 1'],
    'the builds before this one, and then the ones that came after theirs');

  const src = fs.readFileSync('changelog.js', 'utf8');
  assert.match(src, /TVAR means "Test Version AFTER Release"/, 'both definitions are written down');
  assert.match(src, /TVBR means "Test Version BEfore Release"/, 'not just the one in use');
  assert.match(src, /Each entry keeps the label that says where it sat/,
    'and so is the rule that an entry is not relabelled to suit the build above it');
  assert.match(src, /Reset to 0 when that/, 'including when the counter starts over');

  const text = e => e.groups.map(g => `${g.label} ${g.items.join(' ')}`).join(' ');
  const history = TVBR_LOG.slice(1).map(text).join(' ');
  assert.match(history, /test version after release/,
    'the 1.1 explainer still defines TVAR in its own words, and is still right');
  assert.ok(!/1\.[12] TVBR /.test(history), 'and no after-release build has been called a before-release one');

  const chat = text(TVBR_LOG[2]);
  assert.match(chat, /Test Version AFTER Release/, 'the open entry explains the other label rather than assuming it');
  assert.match(chat, /1\.2 TVAR 1 to 3 and 1\.1 TVAR 1 to 3/, 'and names the builds it sits above');
  assert.match(chat, /not which spelling was current when it was written/,
    'stating plainly that this is not a rename');
  assert.ok(!/renamed along with it|141 occurrences|repo-wide|a spelling changes|does not reach back/i.test(chat),
    'no leftover claim that the old entries were relabelled');
});

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

// Build output is skipped, not searched: dist/ is generated from files this sweep
// already reads, and it bundles the whole kitchen, so anything anywhere in the
// source would appear in it a second time — including the pre-rename project magic
// the ALLOWED map below permits in art-studio-layers.js alone.
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

/* ============================== the open build's own entry ============================== */

test('1.3 TVBR 3 says what the bar used to do, what an interruption costs, and what made it into 1.2.10', () => {
  const entry = TVBR_LOG[0];
  assert.equal(entry.version, APP_VERSION_EXTENDED);
  assert.equal(entry.date, 'November 24, 2026');
  const text = entry.groups.map(g => `${g.label} ${g.items.join(' ')}`).join(' ');

  // The complaint in the words it arrived in, and the mechanism behind it. An
  // entry about a misleading number that did not say which number, or what phase
  // it belonged to, would be the same kind of vagueness it is documenting.
  assert.match(text, /stuck at 4%/, 'it quotes the report verbatim');
  assert.match(text, /Polishing prompt/, 'and names the phase the number belonged to');
  assert.match(text, /onStatus/, 'the callback that was always available and was not passed');
  assert.match(text, /shards/, 'the second way the bar lied');
  assert.match(text, /high-water mark/, 'which is what the rule against walking backwards turned it into');
  assert.match(text, /indeterminate/, 'the flag that replaces a number nobody can back up');
  assert.match(text, /1\.2 seconds apart/, 'how long a rate has to be measured before it may become an estimate');
  assert.match(text, /estimated/, 'and the estimate says that it is one');
  assert.match(text, /encode-reference/, 'the stage that had no band at all');
  assert.match(text, /zero epoch/, 'the truthiness bug behind the elapsed clock');
  assert.match(text, /cached/, 'an instant stage is a finished one, not 0% of itself');

  // The stars: a layout and a badge, and the two places a star is not a star.
  assert.match(text, /plinth/, 'a star gets its own layout rather than a louder slot');
  assert.match(text, /Star of Coding & Developing/, 'the badge names the cupboard it stars in');
  assert.match(text, /corner/, 'and a guest appearance keeps the shelf and wears a badge');
  assert.match(text, /Games & Fun/, 'including why the arcade gets no plinth');

  // The bench.
  assert.match(text, /mulberry32/, 'the composer is seeded, and the seed is named');
  assert.match(text, /WL1\.Minor\.sine\.132\.7\.24\.10\.4242\.0/, 'so is the shape of a bench code');
  assert.match(text, /twenty-five distinct melodies/, 'the number the sweep actually produced');
  assert.match(text, /not seeded/, 'humanise is the one part that must not repeat');
  assert.match(text, /analyser/, 'and the spectrum is of the output, not of the room');
  assert.match(text, /sixteen rests/, 'the silence bug is written down rather than quietly fixed');

  // The interruption work, which arrived after the progress complaint and is the
  // half a reader on a phone acts on. The entry has to carry the limits as well as
  // the fix, or it reads as a setting that was switched off.
  assert.match(text, /Aw, Snap/, 'the crash is named in the words it arrives in');
  assert.match(text, /the decision is about the tab/, 'and so is why exempting the app did not stop it');
  assert.match(text, /navigator\.wakeLock\.request/, 'the one signal a power manager consistently respects');
  assert.match(text, /before the first byte rather than after the first stall/, 'asked for while something is still running to ask');
  assert.match(text, /device\.lost as a warning event/, 'the loss the engine reports and used to carry on through');
  assert.match(text, /handed the same dead device/, 'which is what made it permanent rather than one bad run');
  assert.match(text, /the system paused this tab for/, 'a frozen tab is reported as frozen, by a clock that cannot be faked');
  assert.match(text, /Run it again/, 'and a killed tab offers the retry rather than leaving a thread that ends mid-sentence');
  assert.match(text, /it cannot stop a renderer being killed/, 'with the limit stated, because the alternative is an over-promise');

  // What shipped where, which is the part a reader of this build acts on. 1.2.10
  // is now a real release rather than a plan, so this group reads as a record.
  assert.match(text, /1\.2\.10/, 'the entry says which release the star work went into');
  assert.match(text, /Shipped: the star utilities/, 'what is public now');
  assert.match(text, /Not shipped: the image progress work, the interruption work and the Music Lab bench/,
    'and what stayed in this build');
  assert.match(text, /Releasing part of an open cycle does not close it/,
    'the rule that kept TVBR at 3 while APP_VERSION moved to 1.2.10');

  // The bench badge sits on a panel that ships in the public kitchen too, so the
  // sentence a visitor reads must not be the one carrying this build's label.
  const musicSrc = fs.readFileSync('tools-music.js', 'utf8');
  assert.match(musicSrc, /EXPERIMENTAL/, 'the bench says experimental on the panel itself');
  const at = musicSrc.indexOf('A bench, not a finished tool');
  assert.ok(at > 0, 'and the panel carries a sentence about what it is');
  assert.ok(!/TVBR|TVAR/i.test(musicSrc.slice(at, at + 400)),
    'that sentence does not name the test build, because the public kitchen renders it too');
});
