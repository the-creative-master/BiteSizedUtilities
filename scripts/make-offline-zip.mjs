#!/usr/bin/env node
/**
 * Make the offline zip: the entire built site, plus the handful of files that
 * turn a folder of it back into a working kitchen.
 *
 *   npm run build          # the site, into dist/
 *   npm run zip:offline    # this, into dist-zip/BiteSizedUtilities-offline.zip
 *
 * The zip is not deployed with the site. It goes to a GitHub release asset,
 * because 226 MB of it would otherwise be uploaded into Pages on every deploy
 * and downloaded out of the site's own monthly bandwidth. See the `Publish the
 * offline zip` step in .github/workflows/pages.yml.
 *
 * The archive's index.html is not the site's index.html. That is the single most
 * important thing in this file, and it is why the archive is worth having: a
 * browser refuses an ES module from a page opened off the disk, so the site's own
 * front page cannot start that way, and an archive you have to read instructions
 * before you can use is an archive nobody uses. So the packer rewrites it into a
 * page that picks whichever kind of script the way it was opened allows — the
 * classic folder build from a folder, the real module app when it is served — and
 * a double-click on index.html opens the kitchen either way. See bootPage().
 *
 * Three more things are worth knowing before editing this.
 *
 * The extras are stamped, not copied. START-HERE.html and README.txt describe
 * the folder they are shipped in — file count, extracted size, whether the model
 * weights came with it — and those numbers are only known here, at the moment the
 * zip is made. A page that says "about 400 MB" forever is a page that eventually
 * lies.
 *
 * The zip is verified after it is built. `zip -r .` succeeds happily on a
 * directory that is missing half its contents, and the failure would only show up
 * on somebody's machine weeks later. So the archive is listed back and checked
 * for the directories that have to be in it, and the build fails if they are not.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  OFFLINE_ZIP_NAME as ZIP_NAME,
  OFFLINE_ZIP_RELEASE_TAG as RELEASE_TAG,
  FALLBACK_REPO,
  releaseDownloadUrl
} from '../offline-download.js';

export { ZIP_NAME, RELEASE_TAG, FALLBACK_REPO, releaseDownloadUrl };

export const DIST_DIR = 'dist';
export const OUT_DIR = 'dist-zip';
export const STAGE_DIR = path.join(OUT_DIR, 'stage');
export const EXTRAS_DIR = 'offline-zip';

/** The folder build, made by `npm run build:classic`. See vite.classic.config.js. */
export const CLASSIC_DIR = 'dist-classic';
export const CLASSIC_JS = 'kitchen.js';
export const CLASSIC_CSS = 'kitchen.css';

/** Marks the rewritten front page, so a test can tell it from the site's own. */
export const BOOT_MARK = 'waffle-folder-boot';

/** Everything that is added to the root of the zip on top of dist/. */
export const EXTRAS = [
  'START-HERE.html',
  'README.txt',
  'start-server.sh',
  'start-server.command',
  'start-server.bat'
];

/** Executable in the zip, so a double-click works after extracting. */
const EXECUTABLE = new Set(['start-server.sh', 'start-server.command']);

/**
 * Directories and files the archive must contain, as `unzip -l` shows them.
 * Weights are checked separately, because a local build legitimately has none.
 */
export const REQUIRED_ENTRIES = [
  'index.html',
  CLASSIC_JS,
  CLASSIC_CSS,
  'START-HERE.html',
  'README.txt',
  'start-server.sh',
  'start-server.command',
  'start-server.bat',
  'manifest.webmanifest',
  'sw.js',
  'assets/',
  'games/',
  'runtimes/',
  'ort/',
  'ort-chat/',
  'wllama/',
  'wllama-compat/',
  'fonts/'
];

const WEIGHTS_GLOB = 'api/waffle-ai/gguf/*.gguf';

/** Written into dist/ so the live site can put a real number on the button. */
export const META_NAME = 'offline-zip.json';

/**
 * The archive's front page: the site's own index.html, with the module tag replaced
 * by a picker and the folder explanation removed.
 *
 * The picker is a classic script, because that is the one kind a `file:` page will
 * run, and it decides by protocol rather than by trying and failing: from a folder
 * it loads the folder build, and served over http it injects the same module tag
 * Vite put in the head, so the archive over a local server is the whole site —
 * Waffle AI, CodeHub runtimes, all 51 games — with nothing fetched from anywhere.
 *
 * Two details that are easy to get wrong and were.
 *
 * The script goes at the end of the body, not where the module tag was. Vite moves
 * that tag into the head, and a head script calling `document.body.appendChild`
 * gets a null body. The module case is unaffected by the move: module scripts are
 * deferred either way.
 *
 * The folder explanation goes, because in this archive it would be a lie. The
 * kitchen does start from this folder. The site's own index.html keeps it, for
 * anybody who unzips the source instead.
 */
export function bootPage(indexHtml) {
  const moduleTag = /<script type="module"[^>]*\ssrc="([^"]+)"[^>]*><\/script>/.exec(indexHtml);
  if (!moduleTag) throw new Error('no module script tag in dist/index.html — nothing to pick between');
  const moduleSrc = moduleTag[1];

  const handoff = /<script>\(function\(\)\{if\(location\.protocol!=='file:'\)return;[\s\S]*?<\/script>/;
  if (!handoff.test(indexHtml)) throw new Error('the folder explanation is missing from dist/index.html');

  const boot = `<script>/* ${BOOT_MARK} */
(function () {
  var fromFolder = location.protocol === 'file:';
  var s = document.createElement('script');
  if (fromFolder) {
    // The head's stylesheet link carries a crossorigin attribute, which a page on
    // the disk has no origin to satisfy, so the folder build brings its own. The
    // two hold the same rules; this one is simply not minified.
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = './${CLASSIC_CSS}';
    document.head.appendChild(css);
    s.src = './${CLASSIC_JS}';
  } else {
    s.type = 'module';
    s.crossOrigin = 'anonymous';
    s.src = '${moduleSrc}';
  }
  s.onerror = function () {
    var el = document.getElementById('app');
    if (el && !el.children.length) {
      el.innerHTML = '<div style="max-width:520px;margin:48px auto;padding:20px;background:#fff8e8;border:3px solid #4f2f23;border-radius:18px;font-weight:700"><h2>Waffle Kitchen hiccup</h2><p>The kitchen script did not load. ' +
        (fromFolder ? 'Check that ${CLASSIC_JS} is still in this folder next to index.html.' : 'Check that the assets folder is still next to index.html.') + '</p></div>';
    }
  };
  document.body.appendChild(s);
})();
<\/script>`;

  const withoutModule = indexHtml.replace(moduleTag[0], '');
  const withoutHandoff = withoutModule.replace(handoff, '');
  const at = withoutHandoff.lastIndexOf('</body>');
  if (at === -1) throw new Error('dist/index.html has no </body> to put the picker before');
  return withoutHandoff.slice(0, at) + boot + withoutHandoff.slice(at);
}

const MB = 1024 * 1024;
const mb = bytes => (bytes < MB
  ? `${Math.round(bytes / 1024)} KB`
  : `${(bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0)} MB`);

/** `1 file` / `2 files` — the release notes and the stamped README read these aloud. */
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Recurse a directory into `{ files, bytes }`, following nothing exotic. */
export function measure(dir) {
  let files = 0;
  let bytes = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      const sub = measure(full);
      files += sub.files;
      bytes += sub.bytes;
    } else if (entry.isFile()) {
      files += 1;
      bytes += fs.statSync(full).size;
    }
  }
  return { files, bytes };
}

/** The biggest contributors, so the log says where the megabytes went. */
export function biggestSubdirs(dir, limit = 8) {
  const rows = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const m = measure(path.join(dir, entry.name));
    rows.push({ name: `${entry.name}/`, ...m });
  }
  return rows.sort((a, b) => b.bytes - a.bytes).slice(0, limit);
}

/** `owner/repo` from the environment, then git, then the constant. */
export function resolveRepo() {
  const fromEnv = process.env.GITHUB_REPOSITORY;
  if (fromEnv && fromEnv.includes('/')) return fromEnv;
  const remote = spawnSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' });
  const url = (remote.stdout || '').trim();
  const m = /github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?$/.exec(url);
  if (m) return m[1];
  return FALLBACK_REPO;
}

/** Replace the `{{PLACEHOLDER}}`s the two text extras are written with. */
export function stamp(text, facts) {
  return text.replace(/\{\{(\w+)\}\}/g, (whole, key) => {
    if (!(key in facts)) throw new Error(`${key} is stamped nowhere — the template and the facts disagree`);
    return String(facts[key]);
  });
}

/** What each directory in the archive is, for the table in the release notes. */
export const CONTENT_LABELS = {
  'games/': 'all 51 games, each its own page',
  'runtimes/': 'CodeHub workers and their WASM',
  'assets/': 'the app bundle and the AI chunks',
  'ort/': 'the ONNX runtime, for images',
  'ort-chat/': 'the ONNX runtime, for chat',
  'wllama/': 'the GGUF engine',
  'wllama-compat/': 'the GGUF engine, compatibility build',
  'fonts/': 'every face the kitchen uses',
  'api/': 'the model weights, and the endpoints that serve them'
};

/**
 * The markdown table of what is inside, stamped into the release notes.
 *
 * Derived from the directory that was actually packed rather than written by hand,
 * so the notes cannot drift away from the archive they describe.
 */
export function contentsTable(distDir) {
  const dirs = biggestSubdirs(distDir, 99);
  const shown = dirs.slice(0, 9);
  const rows = shown.map(d => `| \`${d.name}\` — ${CONTENT_LABELS[d.name] || 'the rest of the site'} | ${mb(d.bytes)} |`);
  const total = measure(distDir).bytes;
  const inDirs = dirs.reduce((n, d) => n + d.bytes, 0);
  rows.push(`| the pages, styles and icons at the root | ${mb(Math.max(0, total - inDirs))} |`);
  return rows.join('\n');
}

/** Are the model weights in this build? A local one has none, and that is fine. */
export function weightsIn(distDir) {
  const dir = path.join(distDir, 'api/waffle-ai/gguf');
  if (!fs.existsSync(dir)) return { present: false, bytes: 0, files: 0 };
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.gguf'));
  const bytes = files.reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);
  return { present: files.length > 0, bytes, files: files.length };
}

/**
 * The files the archive adds *beside* the built site.
 *
 * `index.html` is deliberately not in here: it is stamped over the built one
 * rather than placed next to it, so it changes no count. These two do — and both
 * the staged copy and the file count in the stamped docs read this one list, so
 * they cannot drift apart.
 */
export const STAGED_BESIDES_SITE = [CLASSIC_JS, CLASSIC_CSS];

export function factsFor(distDir, repo, sha) {
  const dist = measure(distDir);
  // The folder build's two files are counted only if they are there. That is not
  // leniency: buildZip() refuses to pack at all without them, and it refuses
  // before it ever gets here, so a real archive is always measured whole. This
  // stays tolerant because the suite measures a scratch directory to check the
  // arithmetic — and it runs in CI before either build has happened.
  const classicBytes = STAGED_BESIDES_SITE.reduce((n, f) => {
    const at = path.join(CLASSIC_DIR, f);
    return n + (fs.existsSync(at) ? fs.statSync(at).size : 0);
  }, 0);
  const extrasBytes = EXTRAS.reduce((n, f) => n + fs.statSync(path.join(EXTRAS_DIR, f)).size, 0) + classicBytes;
  const weights = weightsIn(distDir);
  const date = new Date();
  return {
    files: dist.files + EXTRAS.length + STAGED_BESIDES_SITE.length,
    extractedBytes: dist.bytes + extrasBytes,
    weights,
    repo,
    sha,
    builtAt: date.toISOString(),
    facts: {
      FILES: `${dist.files + EXTRAS.length + STAGED_BESIDES_SITE.length}`,
      EXTRACTED: mb(dist.bytes + extrasBytes),
      BUILT: date.toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
      SOURCE: sha ? `${repo} at ${sha.slice(0, 7)}` : `a local build of ${repo}`,
      WEIGHTS: weights.present
        ? `(weights included, ${mb(weights.bytes)} in ${plural(weights.files, 'file')})`
        : '(no weights in this build, so it downloads them the first time you ask it anything)',
      // The same fact as a sentence, for the places where a parenthetical would not
      // read — the release notes lead with it.
      WEIGHTS_SENTENCE: weights.present
        ? `The model weights Waffle AI runs on are in there too: ${mb(weights.bytes)} in ${plural(weights.files, 'file')}, so it answers without a network.`
        : 'This build came without the model weights, so Waffle AI downloads them the first time you ask it anything.'
    }
  };
}

/** Run a command, or fail with its own stderr rather than a mystery. */
function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  if (res.error) throw new Error(`${cmd} ${args[0] ?? ''} failed to start: ${res.error.message}`);
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} exited ${res.status}\n${res.stderr || res.stdout || ''}`.trim());
  }
  return res.stdout || '';
}

function haveZip() {
  const res = spawnSync('zip', ['--version'], { encoding: 'utf8' });
  return !res.error && res.status === 0;
}

/**
 * Write everything that is added to the archive root on top of dist/, into one
 * directory: the stamped extras, the folder build, and the rewritten front page.
 *
 * Adding a name the archive already holds replaces it, which is how the site's
 * index.html becomes the archive's.
 */
export function stageExtras(facts, { stageDir = STAGE_DIR, distDir = DIST_DIR } = {}) {
  fs.rmSync(stageDir, { recursive: true, force: true });
  fs.mkdirSync(stageDir, { recursive: true });
  for (const name of EXTRAS) {
    const stamped = stamp(fs.readFileSync(path.join(EXTRAS_DIR, name), 'utf8'), facts);
    // CRLF for the batch file: cmd.exe tolerates LF in simple scripts and then
    // does not in others, and there is no way to test that from here.
    const body = name.endsWith('.bat') ? stamped.replace(/\r?\n/g, '\r\n') : stamped;
    const out = path.join(stageDir, name);
    fs.writeFileSync(out, body);
    if (EXECUTABLE.has(name)) fs.chmodSync(out, 0o755);
  }
  for (const name of STAGED_BESIDES_SITE) {
    fs.copyFileSync(path.join(CLASSIC_DIR, name), path.join(stageDir, name));
  }
  fs.writeFileSync(path.join(stageDir, 'index.html'), bootPage(fs.readFileSync(path.join(distDir, 'index.html'), 'utf8')));
  return [...EXTRAS, ...STAGED_BESIDES_SITE, 'index.html'].map(name => path.join(stageDir, name));
}

/** Does the archive actually hold what it claims? */
export function verifyZip(zipPath, { expectWeights }) {
  const listing = run('unzip', ['-l', zipPath]);
  // The one entry that is rewritten on the way in, checked in the archive rather
  // than in the staging directory: replacing an entry is exactly the kind of thing
  // `zip` can silently not do.
  const front = run('unzip', ['-p', zipPath, 'index.html']);
  if (!front.includes(BOOT_MARK)) {
    throw new Error('the archive still holds the site\'s index.html, not the folder front page \u2014 a double-click would open an explanation instead of the kitchen');
  }
  if (front.includes("if(location.protocol!=='file:')return;")) {
    throw new Error('the archive\'s front page still carries the folder explanation, which the folder build makes a lie');
  }
  // Both branches of the picker, spelled the way the generated script spells them.
  // There is no literal `<script type="module">` to look for: the served branch
  // builds the element and sets `.type`, which is the only way to add a module to a
  // document that has already finished parsing.
  for (const needle of [`s.src = './${CLASSIC_JS}'`, `css.href = './${CLASSIC_CSS}'`, "s.type = 'module'", /s\.src = '\.\/assets\/app-[^']+\.js'/]) {
    const found = needle instanceof RegExp ? needle.test(front) : front.includes(needle);
    if (!found) throw new Error(`the front page picker is missing ${needle} — one of its two branches would not load anything`);
  }
  const entries = listing.split('\n')
    .map(l => l.trim().split(/\s+/).slice(3).join(' '))
    .filter(Boolean);
  const missing = REQUIRED_ENTRIES.filter(e => !entries.some(n => n === e || n.startsWith(e)));
  if (expectWeights && !entries.some(n => n.startsWith('api/waffle-ai/gguf/') && n.endsWith('.gguf'))) {
    missing.push(WEIGHTS_GLOB);
  }
  if (missing.length) {
    throw new Error(`the zip is missing ${missing.length} thing(s): ${missing.join(', ')}\n` +
      'zip -r reports success on a directory that is missing half its contents, so this is checked rather than trusted.');
  }
  return { entries: entries.length };
}

export function buildZip({ distDir = DIST_DIR, outDir = OUT_DIR, level = 9, log = console.log } = {}) {
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    throw new Error(`${distDir}/index.html is not there. Run \`npm run build\` first — the zip is the built site, not the source.`);
  }
  for (const name of STAGED_BESIDES_SITE) {
    if (!fs.existsSync(path.join(CLASSIC_DIR, name))) {
      throw new Error(`${CLASSIC_DIR}/${name} is not there. Run \`npm run build:classic\` first \u2014 without the folder build, index.html in the archive would open into an explanation instead of the kitchen.`);
    }
  }
  if (!haveZip()) {
    throw new Error('the `zip` command is not available. On Debian/Ubuntu: apt-get install zip. It is preinstalled on the GitHub runners.');
  }

  const sha = (() => {
    const r = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
    return r.status === 0 ? (r.stdout || '').trim() : '';
  })();
  const repo = resolveRepo();
  const { files, extractedBytes, weights, facts } = factsFor(distDir, repo, sha);

  log(`[zip] ${repo}${sha ? ` at ${sha.slice(0, 7)}` : ''}: ${files} files, ${mb(extractedBytes)} extracted`);
  for (const row of biggestSubdirs(distDir)) {
    log(`[zip]   ${row.name.padEnd(18)} ${mb(row.bytes).padStart(9)}  ${plural(row.files, 'file')}`);
  }
  log(`[zip]   model weights     ${weights.present ? `${mb(weights.bytes)} in ${plural(weights.files, 'file')}` : 'none in this build'}`);

  fs.mkdirSync(outDir, { recursive: true });
  const zipPath = path.resolve(outDir, ZIP_NAME);
  fs.rmSync(zipPath, { force: true });
  // The metadata file this script writes into dist/ describes the archive, so on a
  // second run the previous archive's file is sitting in dist/ waiting to be packed
  // into the next one — stale, and quoting the wrong size. Out first, back in after.
  fs.rmSync(path.join(distDir, META_NAME), { force: true });
  const staged = stageExtras(facts, { distDir });

  // From inside dist/, so the archive root is the site root: extracting gives
  // index.html, not dist/index.html, which is the difference between a folder a
  // person can use and one they have to rearrange first.
  run('zip', [`-${level}`, '-r', '-X', '-q', zipPath, '.'], { cwd: path.resolve(distDir) });
  // Same level as the first pass: these are the two biggest text files in the
  // archive root, and a default-level pass after a -9 one would show up as a
  // mysteriously larger zip.
  run('zip', [`-${level}`, '-X', '-q', zipPath, ...staged.map(f => path.basename(f))], { cwd: path.resolve(STAGE_DIR) });

  const zipped = fs.statSync(zipPath).size;
  const verified = verifyZip(zipPath, { expectWeights: weights.present });
  const ratio = (zipped / extractedBytes * 100).toFixed(0);

  const meta = {
    name: ZIP_NAME,
    bytes: zipped,
    files,
    extractedBytes,
    weights: weights.present ? { files: weights.files, bytes: weights.bytes } : null,
    builtAt: new Date().toISOString(),
    source: sha ? `${repo}@${sha}` : repo,
    tag: RELEASE_TAG,
    url: releaseDownloadUrl(repo)
  };
  // Into dist/, not into the zip: the live site reads this to put a real number on
  // the download button, and the zip was already closed when the number existed.
  fs.writeFileSync(path.join(distDir, META_NAME), `${JSON.stringify(meta, null, 2)}\n`);

  // Stamped after the archive is closed, because the one number the release notes
  // lead with is the size of the thing just built.
  const notesPath = path.join(outDir, 'RELEASE-NOTES.md');
  fs.writeFileSync(notesPath, stamp(
    fs.readFileSync(path.join(EXTRAS_DIR, 'RELEASE-NOTES.md'), 'utf8'),
    { ...facts, ZIP: mb(zipped), CONTENTS: contentsTable(distDir) }
  ));

  log(`[zip] → ${path.relative(process.cwd(), zipPath)}: ${mb(zipped)} from ${mb(extractedBytes)} (${ratio}%), ${verified.entries} entries verified`);
  log(`[zip]   ${meta.url}`);
  log(`[zip]   release notes → ${path.relative(process.cwd(), notesPath)}`);
  return { ...meta, notesPath, zipPath };
}

function main() {
  try {
    buildZip();
  } catch (err) {
    console.error(`[zip] ${err.message}`);
    process.exitCode = 1;
  }
}

// Importing this module must not start a 400 MB archive.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
