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
 * depending on whether the folder is being served, and index.html shows a third
 * thing when it is opened off the disk. Reading those files proves nothing about
 * which of the three a person gets.
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
  buildZip, resolveRepo
} from '../scripts/make-offline-zip.mjs';

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
  assert.match(app, /to run on a computer/, 'and does not let a tablet think otherwise');
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
    assert.match(link.title, /Needs a computer to run/);
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
    assert.equal(facts.FILES, '7', '2 files measured plus the 5 extras packed on top');
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
  assert.match(src, /if \(process\.argv\[1\] && path\.resolve\(process\.argv\[1\]\) === fileURLToPath\(import\.meta\.url\)\) main\(\);/);
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
  assert.match(src, /tablet cannot do the serving/, 'and about the device that cannot serve at all');
  assert.match(src, /not a broken download/, 'it does not let a person think they downloaded it wrong');
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
  assert.match(notes, /one thread deep/, 'with the same two caveats the folder carries');
  assert.match(notes, /tablet cannot do the serving/);
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
