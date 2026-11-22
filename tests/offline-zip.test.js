/**
 * The offline zip: the entire built site as one download, and the folder it
 * becomes when somebody extracts it.
 *
 * Three things are pinned here, in increasing order of how much they prove.
 *
 * The source: what the packer contains, what the launcher scripts do, where the
 * button points, and that the single-file build this replaced is really gone
 * rather than merely unused.
 *
 * The pages: booted in jsdom, because START-HERE.html shows a different page
 * depending on whether the folder is being served, and because the archive's
 * index.html starts the kitchen one way off the disk and another way over http.
 * Reading those files proves nothing about which of them a person gets — and the
 * one question that actually matters about this zip is which of them a person
 * gets when they double-click index.html, so that one is booted, not read.
 *
 * The archive: only when it exists. In CI the suite runs before the build does, so
 * these skip there and the workflow runs this file a second time after packing —
 * see the `Verify the archive that was just packed` step. Everything below that
 * line is the part that would otherwise be trusted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  OFFLINE_ZIP_NAME, OFFLINE_ZIP_RELEASE_TAG, OFFLINE_ZIP_META_PATH, FALLBACK_REPO,
  offlineZipUrl, releaseDownloadUrl, annotateOfflineZipButton
} from '../offline-download.js';
import {
  ZIP_NAME, RELEASE_TAG, META_NAME, EXTRAS, REQUIRED_ENTRIES, CONTENT_LABELS,
  measure, biggestSubdirs, stamp, weightsIn, contentsTable, factsFor, verifyZip,
  buildZip, resolveRepo, bootPage, BOOT_MARK, STAGED_BESIDES_SITE,
  CLASSIC_DIR, CLASSIC_JS, CLASSIC_CSS, measureCabinet, measureTools, factsAgree
} from '../scripts/make-offline-zip.mjs';
import { FOLDER_FACTS, folderRefusal } from '../offline-facts.js';
import { classifyGameSource, toolModuleMap, moduleSet } from '../scripts/folder-census.mjs';

const read = rel => fs.readFileSync(path.resolve(rel), 'utf8');
const exists = rel => fs.existsSync(path.resolve(rel));
const have = bin => !spawnSync(bin, ['--help'], { encoding: 'utf8' }).error;

const ZIP_PATH = path.join('dist-zip', ZIP_NAME);
const NOTES_PATH = path.join('dist-zip', 'RELEASE-NOTES.md');

/* ============================== the single file is gone ============================== */

test('the single-file build is gone, not merely unused', () => {
  // Retiring a thing means deleting it. Left in place "for now", it keeps being
  // built, keeps being bundled, and keeps its guards in the AI stack — three
  // sites in waffle-browser-ai.js and one in waffle-image-gen.js that existed only
  // to protect a build that no longer ships.
  for (const gone of ['vite.offline.config.js', 'offline-stubs', 'dist/offline.html', 'tests/offline-build.test.js']) {
    assert.ok(!exists(gone), `${gone} is deleted`);
  }
  const mode = read('build-mode.js');
  assert.ok(!mode.includes('OFFLINE'), 'build-mode.js is back to describing two builds, not three');
  for (const file of ['waffle-browser-ai.js', 'waffle-image-gen.js', 'vite.config.js', 'app.js', 'index.html']) {
    const src = read(file);
    assert.ok(!src.includes('OFFLINE_BUILD_FLAG'), `${file} has no offline guard left`);
    assert.ok(!src.includes('__WAFFLE_OFFLINE__'), `${file} has no offline flag left`);
    assert.ok(!src.includes('offline.html'), `${file} does not link a file that does not exist`);
  }
  assert.ok(!read('package.json').includes('build:offline'), 'and the script that made it is gone');
});

/* ============================== the download ============================== */

test('one button, in the backup kitchen, pointing at a release asset', () => {
  const app = read('app.js');
  const link = app.indexOf('data-offline-zip');
  assert.ok(link > -1, 'the button exists');
  assert.equal(app.match(/data-offline-zip(?!-)/g).length, 1, 'and there is exactly one of them');

  const branch = app.indexOf('isBackupBuild() ? `');
  const end = app.indexOf('<header class="game-hud">');
  assert.ok(branch > -1 && end > branch, 'the banner is the backup-only branch of the shell');
  assert.ok(link > branch && link < end, 'so the button is inside it and the public kitchen never shows it');

  assert.match(app.slice(link, link + 220), /Download BSU \(\.zip\)/, 'it says what it downloads');
  assert.match(app.slice(link, link + 220), /data-offline-zip-size/, 'with somewhere to put the size once it is known');
  assert.match(app.slice(link, link + 220), /\$\{offlineZipUrl\(\)\}/, 'and a URL worked out at runtime, not hardcoded');
  assert.match(app, /if \(BACKUP_BUILD\) annotateOfflineZipButton\(\)\.catch\(\(\) => \{\}\);/,
    'the size is fetched only where the button exists, and a failure changes nothing');
  assert.match(app, /every game, runtime and model weight/, 'the banner says what is in it');
  assert.match(app, /index\.html is the kitchen/, 'and says what you get when you open it');
  assert.match(app, /nothing to install/, 'which is the part that makes it usable at all');
  assert.match(app, /wake up on a computer/, 'without letting a tablet think the rest of it works there too');
});

test('the URL follows the site it is served from, so a fork ships its own archive', () => {
  const pages = offlineZipUrl({ href: 'https://the-creative-master.github.io/BiteSizedUtilities/' });
  assert.equal(pages, 'https://github.com/the-creative-master/BiteSizedUtilities/releases/download/offline-zip/BiteSizedUtilities-offline.zip');

  const fork = offlineZipUrl({ href: 'https://somebody-else.github.io/TheirFork/index.html' });
  assert.equal(fork, 'https://github.com/somebody-else/TheirFork/releases/download/offline-zip/BiteSizedUtilities-offline.zip',
    'derived from the origin: on Pages the owner is the subdomain and the repo is the first path segment');

  // A local build and the dev server have no Pages origin to read, so they fall
  // back rather than producing a URL with `undefined` in it.
  for (const href of ['http://localhost:5173/', 'file:///tmp/whatever/index.html', '']) {
    assert.equal(offlineZipUrl({ href }), releaseDownloadUrl(FALLBACK_REPO), `${href || 'nothing'} falls back`);
  }
  assert.equal(offlineZipUrl(), releaseDownloadUrl(FALLBACK_REPO), 'and so does no location at all');
  assert.match(releaseDownloadUrl('a/b'), /^https:\/\/github\.com\/a\/b\/releases\/download\//);
  assert.equal(OFFLINE_ZIP_RELEASE_TAG, 'offline-zip');
  assert.equal(OFFLINE_ZIP_NAME, ZIP_NAME, 'the browser module and the packer agree on the filename');
  assert.equal(RELEASE_TAG, OFFLINE_ZIP_RELEASE_TAG);
  assert.equal(OFFLINE_ZIP_META_PATH, `./${META_NAME}`);
});

test('the button quotes a real size, and stays quiet when it cannot', async () => {
  assert.equal(await annotateOfflineZipButton(undefined), null, 'no document, no annotation, no throw');
  assert.equal(await annotateOfflineZipButton({ querySelector: () => null }), null, 'and no button either');

  const meta = {
    bytes: 145_505_954, files: 210, extractedBytes: 354_036_558,
    weights: { files: 3, bytes: 98_304_000 }, builtAt: '2026-11-22T12:15:10.618Z'
  };
  const size = { textContent: '' };
  const link = { title: '', querySelector: sel => (sel === '[data-offline-zip-size]' ? size : null) };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => meta });
  try {
    const got = await annotateOfflineZipButton({ querySelector: () => link });
    assert.equal(got, meta);
    assert.equal(size.textContent, ' · 139 MB', 'the number a person is about to download');
    assert.match(link.title, /210 files/, 'and the rest of it in the tooltip');
    assert.match(link.title, /338 MB extracted/);
    assert.match(link.title, /94 MB of model weights/);
    assert.match(link.title, /built 2026-11-22/);
    assert.match(link.title, /index\.html is the kitchen, with nothing to install/);
    assert.match(link.title, /need a computer/, 'the honest half of the old claim, kept');
  } finally {
    globalThis.fetch = realFetch;
  }

  // A 404, a truncated file and a thrown fetch are all normal here: the metadata
  // only exists on a deploy that packed an archive.
  for (const fetchImpl of [
    async () => ({ ok: false, status: 404 }),
    async () => ({ ok: true, json: async () => ({}) }),
    async () => ({ ok: true, json: async () => ({ bytes: 0 }) }),
    async () => { throw new Error('offline'); }
  ]) {
    const quiet = { title: '', querySelector: () => ({ textContent: '' }) };
    globalThis.fetch = fetchImpl;
    try {
      assert.equal(await annotateOfflineZipButton({ querySelector: () => quiet }), null);
      assert.equal(quiet.title, '', 'the button is unchanged, so it still downloads');
    } finally {
      globalThis.fetch = realFetch;
    }
  }
});

/* ============================== the packer ============================== */

test('the packer measures, stamps and refuses, without touching an archive', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-test-'));
  try {
    fs.mkdirSync(path.join(dir, 'games'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), 'x'.repeat(10));
    fs.writeFileSync(path.join(dir, 'games', 'a.html'), 'y'.repeat(2048));
    assert.deepEqual(measure(dir), { files: 2, bytes: 2058 }, 'measure counts what is there');
    assert.deepEqual(biggestSubdirs(dir).map(d => d.name), ['games/'], 'and the subdirectories by size');
    assert.equal(weightsIn(dir).present, false, 'a build with no weights says so rather than failing');

    assert.equal(stamp('{{A}} and {{B}}', { A: 1, B: 'two' }), '1 and two');
    assert.throws(() => stamp('{{MISSING}}', { A: 1 }), /MISSING is stamped nowhere/,
      'an unknown placeholder fails the build instead of shipping as literal braces');

    const facts = factsFor(dir, 'owner/repo', 'abcdef1234567').facts;
    assert.equal(facts.FILES, `${2 + EXTRAS.length + STAGED_BESIDES_SITE.length}`,
      '2 files measured, plus the extras and the folder build packed on top — index.html is stamped over the built one, so it adds nothing');
    assert.match(facts.BUILT, /^\d{4}-\d\d-\d\d \d\d:\d\d UTC$/);
    assert.match(facts.SOURCE, /^owner\/repo at abcdef1$/);
    assert.match(facts.WEIGHTS, /no weights in this build/);
    assert.match(facts.WEIGHTS_SENTENCE, /came without the model weights/, 'the same fact, as a sentence');
    assert.match(contentsTable(dir), /^\| `games\/` — all 51 games, each its own page \| 2 KB \|$/m,
      'the table is derived from the directory that was packed, with the sizes in readable units');
    assert.ok(Object.keys(CONTENT_LABELS).every(k => k.endsWith('/')), 'every label is for a directory');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  // Importing the packer must not start a 400 MB archive, which is why the call is
  // behind an argv check; this test file imports it.
  const src = read('scripts/make-offline-zip.mjs');
  assert.match(src, /if \(process\.argv\[1\] && path\.resolve\(process\.argv\[1\]\) === fileURLToPath\(import\.meta\.url\)\) void main\(\);/);
  assert.match(src, /^import \{[\s\S]*?\} from '\.\.\/offline-download\.js';/m,
    'the filename and tag live in the browser module, and the packer imports them');
  assert.throws(() => buildZip({ distDir: 'no-such-dist' }), /Run `npm run build` first/,
    'it will not pack a site that has not been built');
  for (const entry of ['index.html', 'START-HERE.html', 'README.txt', 'games/', 'runtimes/', 'assets/', 'sw.js']) {
    assert.ok(REQUIRED_ENTRIES.includes(entry), `${entry} is one of the entries the archive is checked for`);
  }
  assert.ok(typeof resolveRepo() === 'string' && resolveRepo().includes('/'), 'the repository resolves somewhere');
});

test('the archive gets the extras at its root, stamped, with the executable bits on', () => {
  for (const name of EXTRAS) {
    assert.ok(exists(path.join('offline-zip', name)), `${name} exists to be packed`);
  }
  const staged = path.join('dist-zip', 'stage');
  if (exists(staged)) {
    for (const name of ['start-server.sh', 'start-server.command']) {
      const mode = fs.statSync(path.join(staged, name)).mode;
      assert.ok(mode & 0o111, `${name} is executable in the archive, so a double-click works`);
    }
    assert.match(read(path.join(staged, 'START-HERE.html')), /\d+ files/, 'the staged copy was stamped');
    assert.ok(!/\{\{\w+\}\}/.test(read(path.join(staged, 'START-HERE.html'))), 'and no placeholder survived');
  }
  // Stored in git as executable too, or a fresh checkout packs them without the bit.
  const listed = spawnSync('git', ['ls-files', '-s', 'offline-zip/'], { encoding: 'utf8' }).stdout || '';
  for (const name of ['start-server.sh', 'start-server.command']) {
    assert.match(listed, new RegExp(`100755 [0-9a-f]+ 0\\toffline-zip/${name.replace('.', '\\.')}`),
      `${name} is committed executable`);
  }
});

test('the launcher scripts serve this machine only, and say what they need', () => {
  for (const name of ['start-server.sh', 'start-server.command']) {
    const src = read(path.join('offline-zip', name));
    assert.match(src, /--bind 127\.0\.0\.1/, `${name} does not expose the folder to the network`);
    assert.ok(!src.includes('0.0.0.0'), `${name} does not bind every interface either`);
    assert.match(src, /http\.server "\$PORT"/, `${name} serves with Python's own server`);
    assert.match(src, /sys\.version_info\[0\] >= 3/, `${name} wants Python 3, not just any python`);
    assert.match(src, /cd "\$\(dirname "\$0"\)"/, `${name} serves the folder it lives in, not the caller's`);
    assert.match(src, /8123/, `${name} defaults to the port the instructions quote`);
    assert.match(src, /Close this window to stop|Press Ctrl\+C to stop/, `${name} says how to stop it`);
  }
  const bat = read(path.join('offline-zip', 'start-server.bat'));
  assert.match(bat, /--bind 127\.0\.0\.1/);
  assert.match(bat, /where py/, 'the Windows launcher prefers the py launcher');
  assert.match(bat, /Add python\.exe to PATH/, 'and says what to tick if Python is missing');
  assert.match(bat, /start "BiteSizedUtilities server"/, 'the server gets its own window, so this one can close');
  assert.match(read('scripts/make-offline-zip.mjs'), /\.bat'\) \? stamped\.replace\(\/\\r\?\\n\/g, '\\r\\n'\)/,
    'and it is packed with CRLF, because cmd.exe is inconsistent about LF');
});

/* ============================== the pages in the folder ============================== */

test('START-HERE.html works from a folder and fetches nothing', () => {
  const src = read('offline-zip/START-HERE.html');
  assert.ok(!/type="module"/.test(src), 'a classic script: a file: page refuses a module');
  assert.ok(!/<script[^>]+\ssrc=/.test(src), 'nothing to fetch');
  assert.ok(!/<link[^>]+href=/.test(src), 'not even a stylesheet');
  assert.ok(src.includes('<style>'), 'the styles are inline');
  for (const id of ['folder-view', 'served-view', 'status']) {
    assert.match(src, new RegExp(`id="${id}"`), `${id} is one of the three states`);
  }
  assert.match(src, /location\.protocol === 'http:'/, 'it tells the two situations apart by protocol');
  for (const name of ['start-server.bat', 'start-server.command', 'start-server.sh']) {
    assert.ok(src.includes(name), `it names ${name}`);
  }
  assert.match(src, /python3 -m http\.server 8123 --bind 127\.0\.0\.1/, 'and the command for doing it by hand');
  assert.match(src, /one thread deep/, 'honest about the WASM a plain server cannot isolate');
  assert.match(src, /cannot run the local server/, 'and about the device that cannot serve at all');
  assert.match(src, /not a broken download/, 'it does not let a person think they downloaded it wrong');
  // The reason this page exists at all, and the claim it must not contradict.
  assert.match(src, /index\.html is the kitchen/i, 'it points at the kitchen instead of standing in for it');
  assert.match(src, /href="index\.html"/, 'with a link a person can tap rather than a filename to type');
  assert.match(src, /nothing to install/, 'and it says so in the words somebody looking for a catch would look for');
  // Counting what works is not enough: the page has to name what does not, or
  // somebody who opens the English cupboard thinks their download is broken.
  for (const asleep of ['English &amp; Languages', '{{CODE_BLOCKED}}', 'Waffle AI']) {
    assert.ok(src.includes(asleep), `it names ${asleep} as one of the things a folder will not run`);
  }
  // Every count is a placeholder. These documents once held the same list written
  // out by hand in five places, and one of them claimed all 115 utilities work off
  // the disk while another said the English cupboard does not.
  for (const ph of ['{{UTILITIES_TOTAL}}', '{{UTILITIES_OFFLINE}}', '{{GAMES_PLAYABLE}}', '{{GAMES_BLOCKED}}', '{{ENGLISH_TOOLS}}', '{{CODE_BLOCKED}}', '{{CODE_OFFLINE}}']) {
    assert.ok(src.includes(ph), `${ph} is stamped from the measurement, not typed in`);
  }
  for (const stale of ['all 115 utilities', '85 of them', 'all 51 games', '26 of those games', 'The other 25 games']) {
    assert.ok(!src.includes(stale), `a literal ${stale} would go stale the day the cabinet changes`);
  }
  assert.match(src, /optional/i, 'the server is offered, never demanded');
  for (const ph of ['{{FILES}}', '{{EXTRACTED}}', '{{BUILT}}', '{{SOURCE}}', '{{WEIGHTS}}']) {
    assert.ok(src.includes(ph), `${ph} is stamped rather than hardcoded, so the page cannot drift from the folder`);
  }
});

test('an unzipped index.html explains itself, and a served one does not', async () => {
  // jsdom cannot run the kitchen's module script, so this is not a test of the
  // kitchen. It is a test of the one inline script that has to work before any
  // module does — and of both of its cases, because the second is the live site.
  const { JSDOM } = await import('jsdom');
  const boot = async url => {
    const dom = new JSDOM(read('index.html'), { runScripts: 'dangerously', pretendToBeVisual: true, url });
    try {
      await new Promise(r => setTimeout(r, 500));
      return dom.window.document;
    } finally {
      dom.window.close();
    }
  };

  // Elements, not body.textContent: textContent includes the source of every
  // script in the body, so a handoff that never ran still "says" all of it.
  const folder = await boot('file:///home/somebody/Downloads/BSU/index.html');
  assert.equal(folder.querySelector('h2')?.textContent, 'This folder is not a server');
  assert.match(folder.querySelector('h2').nextElementSibling.textContent, /refuse to load an ES module/,
    'naming the refusal rather than a symptom');
  assert.equal(folder.querySelector('a[href="START-HERE.html"]')?.textContent, 'Open START-HERE.html',
    'pointing at the page that explains the whole folder');
  assert.equal(folder.getElementById('app'), null,
    '#app is gone, so the fallback has nowhere to write a hiccup over this');
  assert.match(folder.body.textContent, /npm install/, 'and it still answers for a folder that came from the source');

  const served = await boot('https://the-creative-master.github.io/BiteSizedUtilities/');
  assert.equal(served.querySelector('h2'), null, 'the handoff never fired on a served page');
  assert.equal(served.getElementById('app').children.length, 0, 'and nothing wrote into the mount point');
  assert.match(served.querySelector('script[type="module"]').getAttribute('src'), /app\.js$/,
    'with the module tag untouched');
});

test('the built page survives Vite, which injects by string-matching', { skip: !exists('dist/index.html') }, () => {
  // Vite puts the built entry tag in the head by replacing the first `</head>` it
  // finds in the serialized document. A handoff that wrote a whole page had one
  // inside its own string, and the built index.html came out with the module tag
  // spliced into the middle of it — a broken live site that no source-level check
  // would have caught, because the source was correct.
  const built = read('dist/index.html');
  assert.equal(built.match(/<\/head>/g).length, 1, 'one closing head, and it is the real one');
  assert.equal(built.match(/<script type="module"/g).length, 1, 'one entry tag');
  assert.match(built, /<script type="module" crossorigin src="\.\/assets\/app-[^"]+\.js">/, 'pointing at the built bundle');
  assert.ok(built.includes("if(location.protocol!=='file:')return;"), 'the handoff is still in there');
  assert.ok(built.includes('START-HERE.html'), 'and still points at the folder front page');
  assert.ok(!/<script type="module"[^>]*>[^<]*<script/.test(built), 'not nested inside another script');
});

/* ============================== the deploy ============================== */

test('the archive is published as a release asset, not shipped inside the site', () => {
  const ci = read('.github/workflows/pages.yml');
  assert.match(ci, /contents: write/, 'which needs write permission, granted for this one step');
  assert.match(ci, /npm run build && npm run zip:offline/, 'packed from dist after the build, so the weights are already in it');
  assert.ok(!ci.includes('build:offline'), 'and nothing builds the retired single file');

  const pack = ci.indexOf('npm run zip:offline');
  const verify = ci.indexOf('node --test tests/offline-zip.test.js');
  const upload = ci.indexOf('upload-pages-artifact');
  const publish = ci.indexOf('Publish the offline zip');
  assert.ok(pack > 0 && verify > pack, 'the archive is verified in CI, after it is packed');
  assert.ok(upload > verify && publish > upload, 'then the site ships, then the archive is published');
  assert.match(ci, /gh release upload offline-zip dist-zip\/BiteSizedUtilities-offline\.zip --clobber/,
    'replaced in place, so the asset always matches the deploy');
  assert.match(ci, /--latest=false/, 'without taking the "Latest" slot from a version release');
  assert.match(ci, /--notes-file "\$NOTES"/, 'and the notes come from the stamped file, not a string in the workflow');
  assert.match(ci, /gh release edit offline-zip/, 'refreshed every deploy, so they quote the archive that is attached');

  assert.match(read('.gitignore'), /dist-zip\//, 'the archive is an artifact, not source');
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['zip:offline'], 'node scripts/make-offline-zip.mjs');
  assert.equal(pkg.scripts.build, 'vite build', 'the public build is unchanged');
});

/* ============================== the archive itself ============================== */

test('dist/offline-zip.json describes the archive that was just packed', { skip: !exists(path.join('dist', META_NAME)) }, () => {
  const meta = JSON.parse(read(path.join('dist', META_NAME)));
  assert.equal(meta.name, ZIP_NAME);
  assert.equal(meta.tag, RELEASE_TAG);
  assert.ok(meta.bytes > 100 * 1024 * 1024, `${meta.bytes} bytes is a whole site, not a page`);
  assert.ok(meta.extractedBytes > meta.bytes, 'and it compresses');
  assert.ok(meta.files > 200, `${meta.files} files`);
  assert.equal(meta.url, releaseDownloadUrl(meta.source.split('@')[0]), 'the URL the button will use');
  assert.match(meta.builtAt, /^\d{4}-\d\d-\d\dT/, 'with a timestamp');
  assert.ok(!('weights' in meta) || meta.weights === null || meta.weights.files > 0,
    'weights are either absent or real');
});

test('the release notes are stamped and quote the archive they describe', { skip: !exists(NOTES_PATH) }, () => {
  const notes = read(NOTES_PATH);
  assert.ok(!/\{\{\w+\}\}/.test(notes), 'no placeholder survived');
  assert.match(notes, /#\s*BiteSizedUtilities/, 'they are a document, not a dump');
  assert.match(notes, /\*\*\d+ MB\*\* to download/, 'leading with the size of the file just built');
  assert.match(notes, /START-HERE\.html/, 'they say what to open first');
  assert.match(notes, /python3 -m http\.server 8123/, 'and how to serve it');
  assert.match(notes, /one thread deep/, 'with the same three caveats the folder carries');
  assert.match(notes, /cannot run the local server/);
  assert.match(notes, /double-click `index\.html`\. That is the kitchen/, 'leading with the tap, not the terminal');
  assert.match(notes, /\| `games\/` — all 51 games/, 'and a table derived from what was packed');
});

test('the archive holds the whole site and none of the site metadata', { skip: !exists(ZIP_PATH) || !have('unzip') }, () => {
  // verifyZip is the same function the packer runs before it reports success, so
  // this is the check that shipped, exercised against the archive that shipped.
  const meta = exists(path.join('dist', META_NAME)) ? JSON.parse(read(path.join('dist', META_NAME))) : null;
  const verified = verifyZip(ZIP_PATH, { expectWeights: !!meta?.weights });
  assert.ok(verified.entries > 200, `${verified.entries} entries`);

  const listing = spawnSync('unzip', ['-l', ZIP_PATH], { encoding: 'utf8' }).stdout || '';
  assert.ok(!listing.includes(META_NAME),
    'the metadata file is not in the archive: it describes the zip, and a second run would otherwise pack the previous one');
  assert.match(listing, /START-HERE\.html/, 'the front page is at the root');
  assert.match(listing, /start-server\.command/, 'so are the launchers');
  assert.ok(!/dist\//.test(listing), 'and nothing is nested under dist/, which would make the folder need rearranging');
});

/* ==================== the archive opens into the kitchen, not an explanation ==================== */

test('bootPage swaps the module tag for a picker that survives both protocols', { skip: !exists('dist/index.html') }, () => {
  const built = read('dist/index.html');
  const front = bootPage(built);

  assert.ok(front.includes(BOOT_MARK), 'the picker is marked, so verifyZip can find it in the archive');
  assert.ok(!front.includes("if(location.protocol!=='file:')return;"),
    'the folder explanation is gone — the folder build made it a lie');
  assert.ok(!/<script[^>]*type="module"[^>]*src=/.test(front),
    'and so is the module tag Vite injected, because a file: page would refuse it and the picker adds its own');
  assert.equal(front.match(/<\/body>/g).length, 1, 'one </body>: the picker went in before it, not inside a string');
  assert.ok(front.lastIndexOf(BOOT_MARK) < front.lastIndexOf('</body>'),
    'the picker is the last thing in the body, so #app exists by the time it runs');

  // Both branches, spelled the way the generated script spells them. There is no
  // literal `<script type="module">` to look for: the served branch builds the
  // element and sets `.type`, which is the only way to add a module to a document
  // that has already finished parsing.
  assert.ok(front.includes("var served = proto === 'http:' || proto === 'https:'"),
    'served means http and nothing else — a tablet hands the browser content:, which refuses a module just as firmly');
  assert.ok(front.includes(`tried = './${CLASSIC_JS}'`), 'off the disk it loads the folder build');
  assert.ok(front.includes(`addCss('./${CLASSIC_CSS}', false)`), 'with its own stylesheet, which carries the faces inline');
  assert.ok(front.includes("s.type = 'module'"), 'served, it loads a module');
  assert.match(front, /tried = '\.\/assets\/app-[^']+\.js'/, 'and the same hashed bundle Vite just built');

  // Three links a page off the disk cannot use, moved out of the markup and into
  // the picker. Left in the head they are not cosmetic: a manifest fetch, five
  // CORS-blocked woff2 files and a crossorigin stylesheet an opaque origin cannot
  // satisfy are all printed as errors before anybody taps anything.
  assert.ok(!/<link[^>]*rel="manifest"/.test(front), 'no manifest tag in the markup');
  assert.ok(!/<link[^>]*fonts\.css/.test(front), 'no font stylesheet tag either');
  assert.ok(!/<link[^>]*rel="stylesheet"[^>]*crossorigin/.test(front), 'and no crossorigin stylesheet');
  assert.ok(front.includes("manifest.rel = 'manifest'"), 'the served branch puts the manifest back');
  assert.ok(front.includes(`addCss('./fonts/fonts.css', false)`), 'and the faces, which a served page can fetch');

  assert.match(front, /Waffle Kitchen hiccup/, 'if neither loads it says so, instead of leaving a blank page');
  assert.ok(front.includes("at <code>' + proto + '</code>"),
    'and names the protocol it was handed, which is the thing that was actually wrong');
  assert.match(front, /This page was handed to the browser/,
    'while a blob: or data: page, which has no folder behind it, is told to extract the zip');

  // The module tag it replaced is the one from the build being packed, so a rename
  // in dist/ cannot leave the picker pointing at a file that is not there.
  const hashed = built.match(/assets\/app-[^"']+\.js/);
  assert.ok(hashed && front.includes(hashed[0]), `it points at ${hashed?.[0]} because that is what this build made`);
});

test('the folder build carries the game catalog, and the served build still fetches it', () => {
  const games = read('games.js');
  assert.match(games, /^import bundledCatalog from '\.\/folder-game-catalog\.js';$/m,
    'games.js imports the catalog as a module, so a bundler can put it in the script');
  const seed = games.indexOf('if (!cachedCatalog && bundledCatalog) cachedCatalog = bundledCatalog;');
  const fetchAt = games.indexOf("await fetch(assetURL('games/catalog.json'))");
  assert.ok(seed > -1 && fetchAt > -1 && seed < fetchAt,
    'and seeds the cache before the fetch, so the fetch is skipped rather than attempted and failed');

  assert.match(read('folder-game-catalog.js'), /export \{ default \} from '\.\/games\/catalog\.json';/,
    'the folder build re-exports the real catalog — two builds, one source of truth');
  assert.match(read('folder-stubs/no-catalog.js'), /export default null;/,
    'the served build gets null, which means "go and fetch it"');
  assert.match(read('vite.config.js'), /'\.\/folder-game-catalog\.js': path\.resolve\('folder-stubs\/no-catalog\.js'\)/,
    'and that is what the alias in the served build says');

  // A file: page has an opaque origin, so the fetch of the JSON sitting beside it
  // is refused and the cupboard reads "Unable to load the offline arcade" in the
  // one place where an empty arcade is most confusing — a folder holding all 51.
  if (exists(path.join(CLASSIC_DIR, CLASSIC_JS))) {
    const kitchen = read(path.join(CLASSIC_DIR, CLASSIC_JS));
    assert.ok(kitchen.includes('games/cabinet/2048.html'), 'the folder build has the catalog inside it');
    const app = fs.readdirSync(path.resolve('dist', 'assets')).find(f => /^app-.*\.js$/.test(f));
    if (app) {
      assert.ok(!read(path.join('dist', 'assets', app)).includes('games/cabinet/2048.html'),
        'and the served build does not: it keeps its 32 KB lazy');
      assert.ok(read(path.join('dist', 'assets', app)).includes('games/catalog.json'),
        'it still fetches the catalog when the cupboard opens');
    }
  }
});

test('CI builds the folder kitchen, and builds it before it packs', () => {
  const yml = read('.github/workflows/pages.yml');
  const classic = yml.indexOf('run: npm run build:classic');
  const pack = yml.indexOf('run: npm run build && npm run zip:offline');
  assert.ok(classic > -1, 'there is a step that makes the folder build');
  assert.ok(pack > -1, 'and the step that packs is still one line, which is how the precache test finds it');
  assert.ok(classic < pack, 'the folder build comes first: the packer refuses to run without it');
  assert.match(read('package.json'), /"build:classic":\s*"vite build --config vite\.classic\.config\.js"/,
    'the script it runs is the one in package.json');
});

test('a double-click on the archive’s index.html opens the kitchen', { skip: !exists(ZIP_PATH) || !have('unzip') }, async () => {
  // The whole reason this zip exists. Everything else in this file could pass and
  // this could still fail, so it is tested against the archive that shipped: three
  // files are unzipped into a temporary folder and opened the way a person opens
  // them — as a file: URL, with the browser doing the loading, not us.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bsu-front-'));
  try {
    const out = spawnSync('unzip', ['-o', '-q', ZIP_PATH, 'index.html', CLASSIC_JS, CLASSIC_CSS, 'START-HERE.html', '-d', dir], { encoding: 'utf8' });
    assert.equal(out.status, 0, `four files came out of the archive${out.stderr ? `: ${out.stderr}` : ''}`);

    // The page that explains the folder has to describe the folder that shipped.
    // Both come out of the same archive, so this is the check that they agree —
    // which is the contradiction that was reported, and the one worth pinning.
    if (exists('dist/games/catalog.json')) {
      const games = measureCabinet('dist');
      const here = fs.readFileSync(path.join(dir, 'START-HERE.html'), 'utf8');
      assert.ok(!/\{\{[A-Z_]+\}\}/.test(here), 'no placeholder survived into the archive');
      assert.ok(here.includes(`${games.playable} of those games`), `it quotes the ${games.playable} games this cabinet can actually play`);
      assert.ok(here.includes(`all ${games.total} games`), `and all ${games.total} of them in the cupboard`);
      assert.ok(here.includes(`The other ${games.blocked} games`), `and the ${games.blocked} that need the folder served`);
      assert.ok(here.includes(`${FOLDER_FACTS.utilitiesOffline} of them`), 'and the count of utilities that never touch a network');
    }

    const { JSDOM, VirtualConsole } = await import('jsdom');
    const noise = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', e => noise.push(String(e.message || e).slice(0, 160)));
    const dom = new JSDOM(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), {
      runScripts: 'dangerously',
      resources: 'usable',        // load ./kitchen.js off the disk, like a browser would
      pretendToBeVisual: true,
      virtualConsole: vc,
      url: `file://${dir}/index.html`
    });
    try {
      const doc = dom.window.document;
      await new Promise(r => setTimeout(r, 3500));

      assert.match(doc.querySelector(`script[src="./${CLASSIC_JS}"]`)?.getAttribute('src') || '', /kitchen\.js/,
        'the picker chose the folder build');
      const app = doc.getElementById('app');
      assert.equal(app.children.length > 0, true, 'and the kitchen mounted into #app');
      // #app, not body: body.textContent includes the source of every inline
      // script, and the picker's own onerror handler contains the words it is
      // being asked not to have written. Reading the mount point reads what a
      // person sees.
      const text = app.textContent.replace(/\s+/g, ' ');
      assert.match(text, /WELCOME TO THE TINY UTILITY KITCHEN/, 'the kitchen, rendered');
      assert.ok(doc.querySelectorAll('button').length > 15, `${doc.querySelectorAll('button').length} buttons: cupboards, not a card of prose`);
      assert.ok(!/Waffle Kitchen hiccup/.test(text), 'no hiccup');
      assert.ok(!/This folder is not a server/.test(text), 'no explanation where the kitchen should be');
      assert.ok(!/npm install/.test(text), 'and nobody is being told to install anything');

      // The cupboard, opened the way a person opens it. This is the part that
      // fails if the catalog is fetched instead of bundled: from a file: page the
      // fetch is refused and this reads "Unable to load the offline arcade".
      const cupboard = [...doc.querySelectorAll('button')].find(b => /Games & Fun/.test(b.textContent));
      assert.ok(cupboard, 'the games cupboard is on the shelf');
      cupboard.click();
      await new Promise(r => setTimeout(r, 2500));
      const open = doc.getElementById('app').textContent.replace(/\s+/g, ' ');
      assert.ok(!/Unable to load the offline arcade/.test(open), 'it loaded the arcade rather than reporting it could not');
      assert.match(open, /FAN FAVORITIES|MORE ARCADE/, 'and put games on a shelf');
    } finally {
      dom.window.close();
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the front page picks the folder build for every protocol that is not a server', { skip: !exists(ZIP_PATH) || !have('unzip') }, async () => {
  // The bug this exists for. The picker used to test `location.protocol === 'file:'`,
  // which is the desktop double-click and nothing else. A tablet file manager hands
  // the browser a content: address, that fell into the served branch, and the served
  // branch loads an ES module — refused by a content: page exactly as firmly as by a
  // file: page. The archive showed a hiccup blaming a missing assets folder that was
  // sitting right there. One protocol was tested, so one protocol worked.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bsu-proto-'));
  try {
    const out = spawnSync('unzip', ['-o', '-q', ZIP_PATH, 'index.html', CLASSIC_JS, CLASSIC_CSS, '-d', dir], { encoding: 'utf8' });
    assert.equal(out.status, 0, 'the front page and the folder build came out of the archive');
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    const { JSDOM, VirtualConsole } = await import('jsdom');

    const boot = async (url, wait) => {
      const vc = new VirtualConsole();          // a script jsdom cannot load is noise here, not a finding
      vc.on('jsdomError', () => {});
      const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc, url });
      await new Promise(r => setTimeout(r, wait));
      return dom;
    };
    const scriptOf = dom => dom.window.document.querySelector('script[src]');
    const moduleOf = dom => dom.window.document.querySelector('script[type="module"]');

    // file: — the desktop double-click. This is the one that really loads.
    const file = await boot(`file://${dir}/index.html`, 3500);
    assert.match(scriptOf(file)?.getAttribute('src') || '', /kitchen\.js$/, 'a page on the disk gets the folder build');
    assert.equal(moduleOf(file), null, 'and no module, which a page on the disk would refuse');
    assert.match(file.window.document.getElementById('app').textContent, /WELCOME TO THE TINY UTILITY KITCHEN/, 'which is enough to render the kitchen');
    file.window.close();

    // content: — what a tablet hands the browser. jsdom cannot load a script from a
    // content: base, so this asserts the choice rather than the render: the module
    // is what a real browser refuses outright, and the classic script is what it at
    // least tries. That difference is the whole fix.
    const content = await boot('content://com.android.filemanager/bsu/index.html', 400);
    assert.equal(moduleOf(content), null, 'no module: a content: page refuses it as firmly as a file: page does');
    assert.match(scriptOf(content)?.getAttribute('src') || '', /kitchen\.js$/, 'so the folder build is the one it reached for');
    content.window.close();

    // http: — the served branch, with everything the folder branch drops put back.
    const served = await boot('http://localhost:8123/index.html', 400);
    assert.match(moduleOf(served)?.getAttribute('src') || '', /assets\/app-[^/]+\.js$/, 'served, it is the real module app');
    assert.equal(served.window.document.querySelectorAll('link[rel="stylesheet"]').length, 2, 'its own CSS and the faces come back');
    assert.ok(served.window.document.querySelector('link[rel="manifest"]'), 'and so does the manifest');
    served.window.close();

    // blob: — no folder behind it, so nothing is attempted and nothing is blamed.
    const blob = await boot('blob:null/8f14e45f-ceea-467a-9d65-1e3d17a4a4c0', 300);
    assert.equal(scriptOf(blob), null, 'no script: a blob: address has no directory to resolve one against');
    assert.match(blob.window.document.getElementById('app').textContent, /handed to the browser/,
      'and the card says to extract the zip, instead of reporting a kitchen that could never load');
    blob.window.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('what a folder can run is measured once, and every document quotes it', { skip: !exists('dist/games/catalog.json') }, async () => {
  // The rule, on sources small enough to read here.
  assert.deepEqual(classifyGameSource('<script>var a = 1;</script>'), [], 'a whole game in one page is folder-safe');
  assert.deepEqual(classifyGameSource('<script>fetch("parts.json")</script>'), ['fetch'], 'one that reads a file beside it is not');
  assert.deepEqual(classifyGameSource('<script>new XMLHttpRequest()</script>'), ['xhr']);
  assert.deepEqual(classifyGameSource('<script>load("core.wasm")</script>'), ['wasm']);
  assert.deepEqual(classifyGameSource('<script type="module" src="m.js"></script>'), ['module']);
  assert.deepEqual(classifyGameSource('<script>new Worker("w.js")</script>'), ['worker']);

  // Then the cabinet that was actually built.
  const games = measureCabinet('dist');
  assert.equal(games.total, games.playable + games.blocked, 'every game in the cabinet is one or the other');
  assert.ok(games.total > 40, `${games.total} games were classified`);
  assert.ok(games.playable > 0, `${games.playable} of them play from a folder`);
  assert.ok(games.blockedIds.every(id => games.reasons[id]), 'and every game that needs a server says which rule it trips');
  assert.equal(measureCabinet('no-such-dir').total, 0, 'a directory with no cabinet measures as empty rather than throwing');

  // The counts every document is stamped with, and the census they come from. This
  // is the check that the literals offline-facts.js ships inside the folder build's
  // refusal agree with the source the archive was packed from: that bundle is
  // compiled before any measuring happens, so it cannot read a census at runtime.
  const tools = await measureTools('.');
  assert.equal(tools.total, FOLDER_FACTS.utilitiesTotal, `${tools.total} utilities on the shelves`);
  assert.equal(tools.offline, FOLDER_FACTS.utilitiesOffline, `${tools.offline} of them work from a folder`);
  assert.equal(tools.total, tools.offline + tools.blocked, 'and every one of them is one or the other');
  assert.deepEqual(tools.unresolved, [], 'no tool sits in a cupboard with a blocker and nowhere in its own dispatch');
  assert.deepEqual(factsAgree(tools), [], 'nothing in offline-facts.js disagrees with the census');
  assert.deepEqual(tools.cleanCupboards.slice().sort(), FOLDER_FACTS.offlineCupboards.slice().sort(),
    'the cupboards that work in full are the six the documents name');

  // The cupboard to module map is read out of app.js rather than written down, so a
  // cupboard that moves to a new module is measured where it actually lives.
  const map = toolModuleMap(read('app.js'), ['math', 'code', 'english', 'text', 'art', 'music', 'video']);
  assert.equal(map.code, 'tools-code.js');
  assert.equal(map.english, 'tools-english.js');
  assert.equal(map.text, 'tools-text-art.js', 'text and art are the dispatch ternary fallback, and both land there');
  assert.equal(map.art, 'tools-text-art.js');
  const readOrNull = n => { try { return read(n); } catch { return null; } };
  assert.ok(moduleSet(map.text, readOrNull).includes('art-studio-layers.js'),
    'and a cupboard pulls in its own helpers, which are scanned with it');
  assert.ok(moduleSet(map.music, readOrNull).includes('file-tools-client.js'),
    'so a fetch sitting in a shared helper is not missed by the cupboard that uses it');

  // Why the coding cupboard is counted per tool rather than as a whole: five of its
  // fifteen run your code in a worker and the other ten do their work in the page.
  // The figure the documents carried before this was 85, which wrote those ten off.
  const code = tools.byCupboard.code;
  assert.equal(code.total, 15, 'fifteen coding tools');
  assert.equal(code.offline, 10, 'ten of which a folder can run');
  assert.deepEqual(code.blockedIds.slice().sort(), ['codehub', 'css-minifier', 'js-formatter', 'regex-tester', 'sql-formatter'],
    'and the five that reach workerJob are the five that cannot');
  assert.deepEqual(tools.blockedIds.filter(t => t.cupboard === code.name).map(t => t.title).sort(),
    FOLDER_FACTS.codeBlocked.slice().sort(), 'named in the documents by the title on the shelf');

  // Why the English cupboard is counted as a whole. Not one of its branches mentions
  // an AI: all fifteen are mounted with a single runner built above the dispatch, so
  // a per-branch scan calls eleven of them safe and the folder shows a spinner where
  // a notice belongs.
  const english = tools.byCupboard.english;
  assert.equal(english.offline, 0, 'no English tool works from a folder');
  assert.deepEqual(english.sharedEngine, ['run'], 'they are blocked by the shared runner, not one by one');
  assert.equal(english.blockedIds.length, FOLDER_FACTS.englishTools, 'all fifteen of them');

  // The six cupboards that work in full do so because their modules are clean, which
  // is a fact about the source and not about the census: no network, no worker, no
  // WASM, and no AI imported.
  for (const mod of ['tools-math-numbers.js', 'tools-math-science.js', 'tools-music.js',
    'tools-text-art.js', 'tools-video.js', 'file-tools-client.js', 'art-studio-layers.js']) {
    for (const bad of ['fetch(', 'XMLHttpRequest', 'new Worker', '.wasm', 'waffle-ai.js']) {
      assert.ok(!read(mod).includes(bad), `${mod} has no ${bad} in it, which is what makes its cupboards folder-safe`);
    }
  }

  // Two tools ask for a digest. That is not a blocker, because a page on the disk is
  // a secure context and can give them one, but an opaque content: address cannot,
  // and a cupboard gaining a third is worth noticing.
  assert.deepEqual(tools.secureIds.slice().sort(), ['hash-generator', 'hash-playground'],
    'the two hash tools are the only ones that need a secure context');

  const facts = factsFor('dist', 'owner/repo', 'abcdef1234567', { tools }).facts;
  assert.equal(facts.UTILITIES_TOTAL, tools.total);
  assert.equal(facts.UTILITIES_OFFLINE, tools.offline);
  assert.equal(facts.UTILITIES_BLOCKED, tools.blocked);
  assert.equal(facts.ENGLISH_TOOLS, english.blockedIds.length);
  assert.equal(facts.CODE_TOTAL, code.total);
  assert.equal(facts.CODE_OFFLINE, code.offline);
  assert.equal(facts.CODE_BLOCKED, 'CodeHub, Regex Tester, CSS Minifier, JavaScript Formatter and SQL Formatter',
    'the blocked coding tools as a sentence, since that is where they are quoted');
  assert.equal(facts.GAMES_TOTAL, games.total);
  assert.equal(facts.GAMES_PLAYABLE, games.playable);
  assert.equal(facts.GAMES_BLOCKED, games.blocked);

  // The refusal a person reads inside the kitchen, from the same facts.
  const said = folderRefusal(games);
  assert.match(said, new RegExp(`${FOLDER_FACTS.utilitiesOffline} utilities`), 'it quotes the count of what still works');
  assert.match(said, new RegExp(`${games.playable} of the ${games.total} games`), 'and the cabinet it was handed');
  assert.match(said, /no server and no install/, 'pointing at the route that needs neither');
  assert.ok(!/python|terminal|command line/i.test(said), 'and not at a terminal, which is what it used to do');
});

test('nothing at boot reaches for a server the folder does not have', { skip: !exists(path.join(CLASSIC_DIR, CLASSIC_CSS)) }, () => {
  // jsdom does not enforce what a browser enforces about manifests, fonts, workers
  // and fetches from a page on the disk, so a clean console cannot be observed in a
  // test — which is exactly how the last build shipped with five errors in it. What
  // can be pinned is that every call which would dirty one is gated at the source.
  const app = read('app.js');
  assert.match(app, /if \(!isFolderBuild\(\) && 'serviceWorker' in navigator/,
    'the service worker is not registered from a folder, which has no scope to register into');

  const ai = read('waffle-ai.js');
  assert.match(ai, /export async function warmupWaffleAI\(\) \{[\s\S]{0,420}?if \(isFolderBuild\(\)\) return;/,
    'nor is the AI server warmed, which app.js asks for 800 ms after every boot');
  assert.match(ai, /async function fetchStatus\(\) \{[\s\S]{0,700}?if \(isFolderBuild\(\)\) return;/,
    'nor probed for a status the folder cannot answer');

  const browser = read('waffle-browser-ai.js');
  assert.match(browser, /export async function autoPrecacheServedModels[\s\S]{0,900}?if \(FOLDER_BUILD_FLAG\) return \{ run: false/,
    'and the idle pre-cache stays idle: there are no served models to fetch and no OPFS to put them in');

  // The faces come along inside the folder build's own sheet, which is what makes
  // dropping the link to fonts.css free rather than a downgrade.
  const css = read(path.join(CLASSIC_DIR, CLASSIC_CSS));
  assert.equal((css.match(/@font-face/g) || []).length, 5, 'five faces');
  assert.equal((css.match(/data:font\/woff2;base64/g) || []).length, 5, 'all five carried inline');
  const external = (css.match(/url\([^)]*\)/g) || []).filter(u => !/^url\(\s*['"]?data:/i.test(u));
  assert.deepEqual(external, [], 'and nothing in the sheet points at a file, which a page off the disk could not load');
});
