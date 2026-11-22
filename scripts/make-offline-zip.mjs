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
import { fileURLToPath, pathToFileURL } from 'node:url';
// offline-facts.js is bundled into the app, so it holds the numbers and nothing that
// scans source; the patterns live here, where the census can read them without
// counting its own module as a blocker.
import { FOLDER_FACTS } from '../offline-facts.js';
import { classifyGameSource, measureGames, toolModuleMap, moduleSet, classifyTools } from './folder-census.mjs';

import {
  OFFLINE_ZIP_NAME as ZIP_NAME,
  OFFLINE_ZIP_RELEASE_TAG as RELEASE_TAG,
  FALLBACK_REPO,
  releaseDownloadUrl
} from '../offline-download.js';

export { ZIP_NAME, RELEASE_TAG, FALLBACK_REPO, releaseDownloadUrl };

/** Where the source lives, so the census does not depend on the caller's directory. */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

  // Three head links that a page which is not served cannot use, and which the
  // picker therefore owns:
  //
  //   the manifest       it is fetched, and a page off the disk cannot fetch
  //   fonts/fonts.css    the sheet itself loads, but every woff2 inside it is
  //                      CORS-restricted and the origin is opaque, so it costs five
  //                      red errors for faces the folder build carries inline
  //   the app stylesheet marked crossorigin, which an opaque origin cannot satisfy
  //
  // They come out of the head for both branches and go back in for the served one,
  // so serving the extracted folder still gets the site exactly as Pages sends it.
  // Each removal is asserted: if Vite ever writes them differently the build fails
  // here, instead of shipping a front page with dead links in it.
  const movable = [
    { what: 'the manifest', re: /[ \t]*<link[^>]*rel="manifest"[^>]*>\n?/ },
    { what: 'the font stylesheet', re: /[ \t]*<link[^>]*href="\.\/fonts\/fonts\.css"[^>]*>\n?/ },
    { what: 'the app stylesheet', re: /[ \t]*<link[^>]*rel="stylesheet"[^>]*href="(\.\/assets\/[^"]+\.css)"[^>]*>\n?/, capture: true }
  ];
  let head = indexHtml;
  let appCss = null;
  for (const link of movable) {
    const found = link.re.exec(head);
    if (!found) throw new Error(`dist/index.html has no ${link.what} to hand to the picker — Vite writes it differently now`);
    if (link.capture) appCss = found[1];
    head = head.replace(link.re, '');
  }
  head = head.replace(/[ \t]*<link[^>]*rel="modulepreload"[^>]*>\n?/g, '');

  const boot = `<script>/* ${BOOT_MARK} */
(function () {
  var proto = location.protocol;
  // Served means http or https, and nothing else is served. A page on a disk
  // arrives as file:, and a tablet file manager hands the browser content:
  // instead. Every scheme that is not http refuses an ES module just as firmly as
  // file: does, because the origin is opaque either way — so the folder build is
  // the default and the module is the special case. Testing for file: alone put
  // content: on the module path, which is how an archive that worked on a desktop
  // still showed a hiccup on the device it was made for.
  var served = proto === 'http:' || proto === 'https:';
  // A blob: or data: page has no directory to resolve ./ against, so neither
  // script could load and no amount of picking would change that. Say so, and say
  // what to do, rather than blaming a folder that is sitting there intact.
  var homeless = proto === 'blob:' || proto === 'data:' || proto === 'about:';
  var el = document.getElementById('app');

  function card(title, body) {
    if (!el || el.children.length) return;
    el.innerHTML = '<div style="max-width:540px;margin:48px auto;padding:20px;background:#fff8e8;' +
      'border:3px solid #4f2f23;border-radius:18px;font-weight:700;text-align:left">' +
      '<h2 style="margin:0 0 8px">' + title + '</h2>' + body + '</div>';
  }

  if (homeless) {
    card('This page was handed to the browser, not opened from the folder',
      '<p style="margin:0 0 8px">Your viewer passed it over as a <code>' + proto + '</code> address, which has no folder ' +
      'behind it, so there is nothing here to load the kitchen from. Extract the zip somewhere first — a preview inside a ' +
      'file manager or an email is not enough — then open <b>index.html</b> inside the extracted folder.</p>' +
      '<p style="margin:0;opacity:0.8;font-size:0.9em">Nothing is wrong with the archive.</p>');
    return;
  }

  function addCss(href, cross) {
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    if (cross) l.crossOrigin = 'anonymous';
    l.href = href;
    document.head.appendChild(l);
  }

  var s = document.createElement('script');
  var tried;
  if (served) {
    addCss('${appCss}', true);
    addCss('./fonts/fonts.css', false);
    var manifest = document.createElement('link');
    manifest.rel = 'manifest';
    manifest.href = './manifest.webmanifest';
    document.head.appendChild(manifest);
    s.type = 'module';
    s.crossOrigin = 'anonymous';
    tried = '${moduleSrc}';
  } else {
    // The folder build brings its own sheet, with the five faces inside it as data
    // URLs. Linking the site fonts.css instead would cost five CORS errors off the
    // disk and no custom type at all.
    addCss('./${CLASSIC_CSS}', false);
    tried = './${CLASSIC_JS}';
  }
  s.src = tried;
  s.onerror = function () {
    // Names the scheme and the file it reached for. "The kitchen script did not
    // load" on its own sent somebody hunting for a missing folder when the real
    // answer was that their viewer had changed the protocol under the page.
    card('Waffle Kitchen hiccup',
      '<p style="margin:0 0 8px">The kitchen script did not load: <code>' + tried + '</code> at <code>' + proto + '</code>.</p>' +
      '<p style="margin:0">' + (served
        ? 'Check that the assets folder is still next to index.html.'
        : 'Check that ${CLASSIC_JS} and ${CLASSIC_CSS} are still in this folder next to index.html. If they are, your browser is refusing local files, which Chrome and Edge both do when a file manager hands them a content address.') + '</p>');
  };
  document.body.appendChild(s);
})();
<\/script>`;

  const withoutModule = head.replace(moduleTag[0], '');
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

/**
 * Read the cabinet and work out which games a folder can run.
 *
 * Each game is its entrypoint plus the source of the files sitting beside it,
 * because a page that pulls in a sibling script is only as folder-safe as that
 * script. Classified by offline-facts.js, so the rule lives in one place and the
 * numbers in every document come out of this one walk.
 *
 * Returns zeros rather than throwing when there is no catalog to read, which is
 * what a scratch directory in a test looks like; buildZip refuses to pack a
 * cabinet it measured as empty, so a real archive can never be stamped with them.
 */
export function measureCabinet(distDir) {
  const catalogPath = path.join(distDir, 'games', 'catalog.json');
  if (!fs.existsSync(catalogPath)) return measureGames([]);
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const games = (Array.isArray(catalog) ? catalog : catalog.games || []).map(game => {
    const entry = path.join(distDir, String(game.entrypoint || '').replace(/^\.?\//, ''));
    let source = '';
    try {
      source = fs.readFileSync(entry, 'utf8');
      const dir = path.dirname(entry);
      for (const sibling of fs.readdirSync(dir)) {
        // Not the .wasm itself: its bytes prove nothing, and the reference to it in
        // the source beside it is what a browser would refuse.
        if (!/\.(js|json)$/i.test(sibling)) continue;
        try { source += fs.readFileSync(path.join(dir, sibling), 'utf8'); } catch {}
      }
    } catch {}
    return { id: game.id, blockers: classifyGameSource(source) };
  });
  return measureGames(games);
}

/** A list of names as English reads it, for a sentence rather than a table. */
export function andList(items) {
  const all = [...items];
  if (all.length < 2) return all.join('');
  return `${all.slice(0, -1).join(', ')} and ${all[all.length - 1]}`;
}

/**
 * Count the utilities a folder can run, from the source that was just shipped.
 *
 * The games are counted from the built cabinet because each one is a page of its
 * own. The utilities are not: they are branches of a mount chain in eight modules,
 * so this walks the chain instead — app.js says which module mounts which cupboard,
 * that module's own imports say what it pulls in, and `classifyTools` says which of
 * its tools reach a worker, an API or an AI.
 *
 * Returns null when there is no source to read, which is what CI looks like on its
 * first `npm test`, before either build has happened.
 *
 * @param {string} repo the repository root
 */
export async function measureTools(repo) {
  const appPath = path.join(repo, 'app.js');
  const catalogPath = path.join(repo, 'catalog.js');
  if (!fs.existsSync(appPath) || !fs.existsSync(catalogPath)) return null;
  const read = name => {
    try { return fs.readFileSync(path.join(repo, name), 'utf8'); } catch { return null; }
  };
  const appSource = read('app.js');
  const { cupboards } = await import(pathToFileURL(catalogPath).href);
  const map = toolModuleMap(appSource, cupboards.map(c => c.id));
  const sources = { 'app.js': appSource };
  const modulesByCupboard = {};
  for (const c of cupboards) {
    const mods = moduleSet(map[c.id], read);
    modulesByCupboard[c.id] = mods;
    for (const m of mods) sources[m] = read(m);
  }
  return classifyTools({ cupboards, sources, modulesByCupboard });
}

/**
 * The counts in offline-facts.js are literals, because the folder build's own
 * refusal quotes them and that bundle is compiled before the archive is packed, so
 * it has no measurement to read. This is what stops them going stale: the census is
 * run against the same source at pack time, and a disagreement stops the build with
 * the number that moved.
 */
export function factsAgree(tools) {
  const wrong = [];
  if (tools.total !== FOLDER_FACTS.utilitiesTotal) {
    wrong.push(`utilitiesTotal is ${FOLDER_FACTS.utilitiesTotal} in offline-facts.js and ${tools.total} in catalog.js`);
  }
  if (tools.offline !== FOLDER_FACTS.utilitiesOffline) {
    wrong.push(`utilitiesOffline is ${FOLDER_FACTS.utilitiesOffline} in offline-facts.js and ${tools.offline} measured`);
  }
  const clean = [...tools.cleanCupboards].sort();
  const saidClean = [...FOLDER_FACTS.offlineCupboards].sort();
  if (clean.join('|') !== saidClean.join('|')) {
    wrong.push(`offlineCupboards is ${saidClean.join(', ')} and the census found ${clean.join(', ')}`);
  }
  const english = tools.byCupboard.english;
  if (english && english.blockedIds.length !== FOLDER_FACTS.englishTools) {
    wrong.push(`englishTools is ${FOLDER_FACTS.englishTools} and ${english.blockedIds.length} English tools are blocked`);
  }
  const code = tools.byCupboard.code;
  if (code) {
    const found = tools.blockedIds.filter(b => b.cupboard === code.name).map(b => b.title).sort();
    const saidCode = [...FOLDER_FACTS.codeBlocked].sort();
    if (found.join('|') !== saidCode.join('|')) {
      wrong.push(`codeBlocked is ${saidCode.join(', ')} and the census blocked ${found.join(', ')}`);
    }
  }
  return wrong;
}

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

export function factsFor(distDir, repo, sha, { games = measureCabinet(distDir), tools = null } = {}) {
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
    games,
    tools,
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
      // Counts, so no document has to remember one. Every one of these is measured
      // from what was just built: the games from the cabinet, the utilities from the
      // mount chains. offline-facts.js holds the same numbers as literals for the
      // folder build's refusal text, and factsAgree() is what keeps the two from
      // drifting apart.
      UTILITIES_TOTAL: tools ? tools.total : FOLDER_FACTS.utilitiesTotal,
      UTILITIES_OFFLINE: tools ? tools.offline : FOLDER_FACTS.utilitiesOffline,
      UTILITIES_BLOCKED: tools ? tools.blocked : FOLDER_FACTS.utilitiesTotal - FOLDER_FACTS.utilitiesOffline,
      ENGLISH_TOOLS: tools && tools.byCupboard.english ? tools.byCupboard.english.blockedIds.length : FOLDER_FACTS.englishTools,
      CODE_BLOCKED: tools && tools.byCupboard.code
        ? andList(tools.blockedIds.filter(b => b.cupboard === tools.byCupboard.code.name).map(b => b.title))
        : andList(FOLDER_FACTS.codeBlocked),
      CODE_TOTAL: tools && tools.byCupboard.code ? tools.byCupboard.code.total : 15,
      CODE_OFFLINE: tools && tools.byCupboard.code ? tools.byCupboard.code.offline : 10,
      GAMES_TOTAL: games.total,
      GAMES_PLAYABLE: games.playable,
      GAMES_BLOCKED: games.blocked,
      // The same fact as a sentence, for the places where a parenthetical would not read.
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
  for (const needle of [`tried = './${CLASSIC_JS}'`, `addCss('./${CLASSIC_CSS}', false)`, "s.type = 'module'", /tried = '\.\/assets\/app-[^']+\.js'/]) {
    const found = needle instanceof RegExp ? needle.test(front) : front.includes(needle);
    if (!found) throw new Error(`the front page picker is missing ${needle} — one of its two branches would not load anything`);
  }
  // The three links a page off the disk cannot use must be gone from the markup and
  // owned by the picker instead. They are still in the file as JavaScript strings,
  // which is why this looks for the tags and not for the filenames.
  for (const tag of [/<link[^>]*rel="manifest"/, /<link[^>]*fonts\.css/, /<link[^>]*rel="stylesheet"[^>]*crossorigin/]) {
    if (tag.test(front)) throw new Error(`the front page still has a ${tag} tag in its markup, which a folder cannot satisfy and which reads as an error in the console`);
  }
  if (!/var served = proto === 'http:' \|\| proto === 'https:'/.test(front)) {
    throw new Error("the picker is not choosing by 'is it served' — anything that is not http would be sent down the module path again");
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

export function buildZip({ distDir = DIST_DIR, outDir = OUT_DIR, level = 9, log = console.log, tools = null } = {}) {
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
  // measureTools() is async and this is not, so the census is handed in: main() runs
  // it, and the tests run it themselves. Without one the documents fall back to the
  // literals in offline-facts.js, which is exactly what factsAgree() checks.
  if (tools) {
    const wrong = factsAgree(tools);
    if (wrong.length) {
      throw new Error(`offline-facts.js disagrees with the source it describes:\n  - ${wrong.join('\n  - ')}`);
    }
    if (tools.unresolved.length) {
      throw new Error(`${tools.unresolved.length} tool(s) sit in a cupboard with a blocker but appear nowhere in its mount chain, so they cannot be counted: ${tools.unresolved.map(u => u.id).join(', ')}`);
    }
  }
  const { files, extractedBytes, games, weights, facts } = factsFor(distDir, repo, sha, { tools });
  // Zeros here mean the cabinet was not in the build, not that no game works from a
  // folder. Stamping them would have every document in the archive claim the arcade
  // is empty, which is the kind of lie that is only found by somebody reading it.
  if (!games.total) {
    throw new Error(`${distDir}/games/catalog.json is missing or empty, so there is no cabinet to measure — run \`npm run build\` first`);
  }

  log(`[zip] ${repo}${sha ? ` at ${sha.slice(0, 7)}` : ''}: ${files} files, ${mb(extractedBytes)} extracted`);
  for (const row of biggestSubdirs(distDir)) {
    log(`[zip]   ${row.name.padEnd(18)} ${mb(row.bytes).padStart(9)}  ${plural(row.files, 'file')}`);
  }
  log(`[zip]   model weights     ${weights.present ? `${mb(weights.bytes)} in ${plural(weights.files, 'file')}` : 'none in this build'}`);
  log(`[zip]   from a folder: ${tools ? tools.offline : FOLDER_FACTS.utilitiesOffline} of ${tools ? tools.total : FOLDER_FACTS.utilitiesTotal} utilities, ${games.playable} of ${games.total} games`);

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

async function main() {
  try {
    buildZip({ tools: await measureTools(REPO_ROOT) });
  } catch (err) {
    console.error(`[zip] ${err.message}`);
    process.exitCode = 1;
  }
}

// Importing this module must not start a 400 MB archive.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main();
