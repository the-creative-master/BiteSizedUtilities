/**
 * The single-file offline kitchen, and the folder that used to hiccup.
 *
 * Two artefacts are being pinned here. The first is `dist/offline.html`: one
 * document with every tool, the stylesheet and the fonts inlined, built by
 * `npm run build:offline`. The second is a change to `index.html`, so that a copy
 * of the site unzipped onto a disk explains itself instead of failing.
 *
 * Most of these tests read source rather than run it, and say so. The reason is
 * that the interesting failure in this feature was not visible in the source at
 * all: Rollup emitted an exported constant above the declaration it aliased, and
 * the flattened bundle died on a temporal dead zone error before the kitchen
 * rendered. Every line of source involved was correct. So the artefact tests at
 * the bottom matter more than the ones above them, and they are skipped only when
 * the file has not been built — in CI, `npm test` runs before the build does.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

import {
  OFFLINE_BUILD_FLAG, OFFLINE_BUILD_REASON, isOfflineBuild, isPublicBuild
} from '../build-mode.js';

const read = rel => fs.readFileSync(path.resolve(rel), 'utf8');
const exists = rel => fs.existsSync(path.resolve(rel));

/* ======================= the flag ======================= */

test('the offline flag is off everywhere except the offline build', () => {
  // Under Node nothing defines it, so `globalThis.__WAFFLE_OFFLINE__` is undefined
  // and the comparison is false rather than a ReferenceError at an undeclared name.
  // Every other test file imports build-mode.js, so this being true by accident
  // would turn the whole suite into a kitchen with no AI in it.
  assert.equal(OFFLINE_BUILD_FLAG, false);
  assert.equal(isOfflineBuild(), false);
  assert.equal(isPublicBuild(), true);

  assert.match(read('vite.config.js'), /'globalThis\.__WAFFLE_OFFLINE__': 'false'/,
    'the site defines it false');
  assert.match(read('vite.offline.config.js'), /'globalThis\.__WAFFLE_OFFLINE__': 'true'/,
    'and the offline build defines it true');
  assert.ok(!read('vite.config.js').includes("'globalThis.__WAFFLE_OFFLINE__': 'true'"),
    'never the other way round: that would ship a kitchen that refuses its own AI');
});

test('the refusal explains itself instead of just failing', () => {
  assert.ok(OFFLINE_BUILD_REASON.length > 200, 'it is a paragraph, not a code');
  assert.match(OFFLINE_BUILD_REASON, /one HTML document/, 'what the build is');
  assert.match(OFFLINE_BUILD_REASON, /fetch model weights/, 'what a folder cannot do');
  assert.match(OFFLINE_BUILD_REASON, /start a worker/, 'including the two engines that need one');
  assert.match(OFFLINE_BUILD_REASON, /as a module/, 'and the one browsers refuse outright');
  assert.match(OFFLINE_BUILD_REASON, /The tools all work/, 'so the reader knows what is left');
  assert.match(OFFLINE_BUILD_REASON, /over http instead/, 'with the way out');
});

/* ======================= the guards ======================= */

/**
 * A guard has to sit *before* the `await import()` it protects. After it, the
 * bytes are already in the chunk and the throw only wastes the download — which
 * is how the first attempt came to 190 MB.
 */
function assertGuarded(file, specifier, label) {
  const src = read(file);
  let at = -1;
  let count = 0;
  while ((at = src.indexOf(`await import('${specifier}`, at + 1)) !== -1) {
    count += 1;
    const before = src.slice(Math.max(0, at - 500), at);
    assert.match(before, /if \(OFFLINE_BUILD_FLAG\) throw new Error\(OFFLINE_BUILD_REASON\);/,
      `${label}: ${specifier} is guarded immediately before, not after`);
    // "Immediately" is load-bearing: a guard three screens earlier protects a
    // different call, and this is what stops that from passing.
    assert.ok(before.lastIndexOf('if (OFFLINE_BUILD_FLAG)') > before.length - 400,
      `${label}: the guard on ${specifier} is the last thing before the import`);
  }
  assert.ok(count > 0, `${label}: ${specifier} is still imported somewhere to guard`);
  return count;
}

test('every route to an AI engine is guarded before it is imported', () => {
  assert.equal(assertGuarded('waffle-browser-ai.js', '@huggingface/transformers', 'chat'), 1);
  assert.equal(assertGuarded('waffle-browser-ai.js', '@wllama/wllama', 'chat'), 2,
    'the manager and the engine are separate imports');
  assert.equal(assertGuarded('waffle-image-gen.js', 'onnxruntime-web', 'images'), 2,
    'one per backend');
});

test('the vendors resolve to a stub, so a missed guard cannot cost 179 MB', () => {
  // onnxruntime-web embeds its WASM in its own JavaScript as base64 — 179 MB
  // across the variants and the copy nested under transformers.js — and an iife
  // build has to inline every dynamic import into its single chunk. The guards
  // make the app refuse politely; this makes the bytes unshippable regardless.
  const cfg = read('vite.offline.config.js');
  for (const specifier of ['@huggingface/transformers', '@wllama/wllama', 'onnxruntime-web']) {
    assert.ok(cfg.includes(specifier.replace('/', '\\/')),
      `the alias list names ${specifier}`);
  }
  assert.equal(cfg.match(/offline-stubs\/ai-vendor\.js/g).length, 4,
    'and each of them, plus wllama-compat, resolves to the stub');

  const stub = read('offline-stubs/ai-vendor.js');
  assert.match(stub, /ships no AI engine/, 'the stub says what happened');
  assert.match(stub, /prop === 'then'/, 'and refuses to look like a promise, so awaiting it fails loudly instead of hanging');
});

test('the stub refuses on every access, and never pretends to be thenable', async () => {
  const stub = await import('../offline-stubs/ai-vendor.js');
  assert.equal(stub.__offlineVendorStub, true);
  assert.equal(stub.default.then, undefined, 'await would otherwise never settle on a refusal');
  assert.throws(() => stub.default(), /ships no AI engine/);
  assert.throws(() => stub.default.env, /ships no AI engine/);
});

/* ======================= the offline config ======================= */

test('the offline build is a library, because a page cannot be a module', () => {
  const cfg = read('vite.offline.config.js');
  assert.match(cfg, /formats: \['iife'\]/, 'a classic script: the only format a file: page will run');
  assert.match(cfg, /inlineDynamicImports: true/, 'which is also the only format Rollup will inline imports for');
  assert.match(cfg, /outDir: OUT/, 'it builds beside dist, not into it');
  assert.match(cfg, /writeBundle\(options, bundle\)/,
    'the chunk is read out of the bundle, not guessed at from a filename on disk');
  assert.match(cfg, /minify: false/, 'no minifier: esbuild was killed mid-build by memory pressure');
  assert.match(cfg, /target: 'esnext'/, 'and no transpile pass, for the same reason');
  assert.match(cfg, /inlineFontUrls/, 'the fonts are inlined too — Vite copies public/ verbatim and rewrites nothing');
});

test('the build fails rather than warns if the file is not self-contained', () => {
  const cfg = read('vite.offline.config.js');
  for (const [needle, what] of [
    [/AGFzbQ/, 'base64 WASM'],
    [/<script\[\^>\]\+\\ssrc=/, 'a script with a src'],
    [/<link\[\^>\]\+href=/, 'a stylesheet or manifest to fetch'],
    [/type="module"/, 'a module script'],
    [/new vm\.Script\(js\.code/, 'and whether the whole thing parses as a classic script']
  ]) {
    assert.match(cfg, needle, `it checks for ${what}`);
  }
  assert.match(cfg, /throw new Error\(`offline\.html is not self-contained/,
    'and any of them stops the build');
  assert.match(cfg, /url\\\(\\s\*\['"\]\?\(\[\^'"\)\]\+\)/,
    'while the stylesheet check extracts values, because a lookahead backtracks into a false alarm');
});

test('the offline build is wired into the scripts and the deploy', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['build:offline'], 'vite build --config vite.offline.config.js');
  assert.equal(pkg.scripts.build, 'vite build', 'and the public build is unchanged');

  const ci = read('.github/workflows/pages.yml');
  assert.equal(ci.match(/npm run build:offline/g).length, 2,
    'CI builds it twice: once before the tests can boot it, once after the public build empties dist');
  assert.match(ci, /npm run build && npm run build:offline/,
    'and the second time is after the public build, so the file lands in an intact dist');
  assert.ok(ci.lastIndexOf('build:offline') < ci.indexOf('upload-pages-artifact'),
    'both of them before the artifact is uploaded, or it ships nowhere');
  assert.ok(ci.indexOf('build:offline') < ci.indexOf('npm test'),
    'with the first one before the tests, or the boot test is skipped in the only place it runs');
  assert.match(read('.gitignore'), /dist-offline\//, 'the scratch output is not source');
});

/* ======================= the unzipped folder ======================= */

test('an unzipped index.html explains itself instead of hiccupping', () => {
  const index = read('index.html');
  // The whole point: a browser refuses an ES module from a file: page, so the
  // module tag that the served site depends on is the thing that cannot work here.
  assert.match(index, /<script type="module" src="\.\/app\.js"><\/script>/,
    'the served site still loads the app as a module');

  const handoff = /<script>\(function\(\)\{if\(location\.protocol!=='file:'\)return;([\s\S]*?)<\/script>/;
  assert.match(index, handoff, 'the handoff is inline, so there is nothing to fetch');
  const body = index.match(handoff)[1];
  assert.match(body, /This folder is not a server/, 'and it says what is actually wrong');
  assert.match(body, /refuse to load an ES module from a/, 'naming the refusal rather than a symptom');
  assert.match(body, /offline\.html/, 'with the file that does work from a folder');
  assert.match(body, /npm install/, 'and the answer for a folder that has no offline file in it');
  // Last in the body, and it replaces the body rather than writing a document.
  // Two reasons, both learned the hard way. Vite injects the built entry tag by
  // string-matching `</head>`, and a handoff that wrote a whole document had one
  // inside its own string: the built page came out with the kitchen's module tag
  // spliced into the middle of it. And replacing the body removes `#app`, which is
  // the element the fallback writes the hiccup into, so the eight-second timeout
  // cannot overwrite this page with a message blaming the visitor.
  assert.ok(index.indexOf('location.protocol') > index.indexOf('type="module"'),
    'it runs after the module tag, which is the thing that has just failed');
  assert.match(body, /document\.body\.innerHTML=/, 'replacing the body, not writing a document');
  assert.ok(!body.includes('</head>') && !body.includes('</body>'),
    'and with no closing head or body tag in it, which is what Vite string-matches');
  assert.ok(!/<script/.test(body), 'and no script tag, which would end the element early');
});

test('the download button belongs to the backup kitchen alone', () => {
  const app = read('app.js');
  const link = app.indexOf('href="./offline.html"');
  assert.ok(link > -1, 'the button exists');
  const branch = app.indexOf('isBackupBuild() ? `');
  const end = app.indexOf('<header class="game-hud">');
  assert.ok(branch > -1 && end > branch, 'the banner is the backup-only branch of the shell');
  assert.ok(link > branch && link < end,
    'and the link is inside it, so the public kitchen does not advertise a test artefact');
  // Forward from the href, because the download attribute follows it.
  assert.match(app.slice(link, link + 200), /download="BiteSizedUtilities-offline\.html"/,
    'it downloads under a name a person can find again');
});

/* ======================= the artefacts ======================= */

test('the public build kept its AI engines', { skip: !exists('dist/assets') }, () => {
  // The stub and the flag exist to keep engines out of *one* build. This is the
  // check that they did not leak into the build that has to have them.
  const assets = fs.readdirSync(path.resolve('dist/assets'));
  assert.ok(assets.some(f => f.startsWith('transformers.web-')),
    'the transformers chunk is still emitted');
  assert.ok(assets.some(f => f.endsWith('.wasm')), 'and so is the WASM it loads');
  const index = read('dist/index.html');
  assert.ok(!index.includes('This folder is not a server') === false,
    'the handoff survives the build, since it only fires over file:');
});

test('dist/offline.html is one file with nothing left to fetch', { skip: !exists('dist/offline.html') }, () => {
  const html = read('dist/offline.html');
  const bytes = Buffer.byteLength(html);

  assert.ok(bytes < 6 * 1024 * 1024, `${(bytes / 1024).toFixed(0)} KB is a document, not a payload`);
  assert.ok(bytes > 400 * 1024, 'and it is not an empty shell either');

  assert.match(html, /<div id="app"><\/div>/, 'the same single mount point the app expects');
  assert.ok(!/<script[^>]+\ssrc=/.test(html), 'no script to fetch');
  assert.ok(!/type="module"/.test(html), 'no module a file: page would refuse');
  assert.ok(!/<link[^>]+href=/.test(html), 'no stylesheet, icon or manifest to fetch');
  // Not `!/import\.meta/.test(html)`. The bundle legitimately contains those two
  // words, because this project's own release notes describe the trap, and a
  // string in changelog.js is part of the kitchen. Compiling it is the check that
  // cannot be argued with: vm.Script builds a classic script, so import.meta,
  // import, export and top-level await all fail here, and no string or comment can
  // fake a pass. This is the same trap as the build's own earlier word check.
  const parts = html.split('</script>');
  assert.equal(parts.length, 3, 'two script elements, so the kitchen chunk is the middle part');
  const kitchen = parts[1].slice(parts[1].indexOf('<script>') + '<script>'.length);
  assert.ok(kitchen.length > 400 * 1024, 'and that middle part is the kitchen, not a stub');
  assert.doesNotThrow(() => new vm.Script(kitchen, { filename: 'offline.html' }),
    'the kitchen parses as a classic script, which is what a file: page can run');
  assert.ok(!/AGFzbQ/.test(html), 'no base64 WASM — the mistake that made this 190 MB');
  assert.ok(html.includes('url(data:font/woff2;base64,'), 'the fonts came along as data URLs');
  assert.ok(html.includes(OFFLINE_BUILD_REASON), 'and the refusal is compiled in, so the tools can explain themselves');

  // Not a count of `<script>`: one of the code tools builds an HTML document as a
  // string, so the kitchen's own JavaScript contains a literal `<script>`. What
  // matters is that nothing inside it can *close* the element early — the app
  // writes that one as `<\\/script>`, escaped, and these two closers are the real
  // ones. If this ever becomes three, the document is truncated mid-bundle.
  assert.equal(html.split('</script>').length - 1, 2,
    'the fallback reporter and the kitchen: exactly two elements, nothing closing early');
});

test('the built file boots from a file: URL', { skip: !exists('dist/offline.html') }, async () => {
  // The test that earns its keep. Every assertion above reads source, and the one
  // failure this feature actually had was invisible in source: Rollup hoisted an
  // exported constant above the declaration it aliased, and the flattened bundle
  // died on a temporal dead zone error before the kitchen rendered. Booting the
  // artefact at the URL a person unzips it to is the only check that sees it.
  const { JSDOM, VirtualConsole } = await import('jsdom');
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(String(e.message || e).slice(0, 200)));
  const dom = new JSDOM(read('dist/offline.html'), {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    url: 'file:///home/somebody/Downloads/BSU/offline.html'
  });
  try {
    await new Promise(r => setTimeout(r, 1200));
    const doc = dom.window.document;
    const app = doc.getElementById('app');
    assert.deepEqual(errors, [], 'nothing threw while booting');
    assert.ok(app.children.length > 0, 'the kitchen rendered its own DOM');
    assert.ok(!/Waffle Kitchen hiccup/.test(app.textContent), 'and the fallback did not take over');
    assert.ok(doc.querySelectorAll('button').length > 10, 'with a real interface behind it');
    assert.match(app.textContent, /Bite Sized Utilities/, 'naming itself');
  } finally {
    dom.window.close();
  }
});

test('an unzipped index.html explains itself, and a served one does not', async () => {
  // jsdom cannot run the app's module script, so this is not a test of the
  // kitchen; it is a test of the one inline script that has to work before any
  // module does. Both halves matter: the first is the repair, the second is the
  // proof the repair cannot fire on the live site.
  const { JSDOM } = await import('jsdom');
  const boot = async url => {
    const dom = new JSDOM(read('index.html'), {
      runScripts: 'dangerously', pretendToBeVisual: true, url
    });
    try {
      await new Promise(r => setTimeout(r, 500));
      return dom.window.document;
    } finally {
      dom.window.close();
    }
  };

  // Elements, not body.textContent. textContent includes the source of every
  // script in the body, so a handoff that never ran still "said" everything it
  // would have said — which is how the served case below failed while the page was
  // behaving perfectly.
  const folder = await boot('file:///home/somebody/Downloads/BSU/index.html');
  assert.equal(folder.querySelector('h2')?.textContent, 'This folder is not a server',
    'it says what is wrong in the page, not only in a script');
  assert.match(folder.querySelector('h2').nextElementSibling.textContent, /refuse to load an ES module/,
    'and why');
  assert.equal(folder.querySelector('a[href="offline.html"]')?.textContent, 'Open the offline kitchen',
    'with the way out one tap away');
  assert.equal(folder.getElementById('app'), null,
    '#app is gone, so the fallback has nowhere to write a hiccup over this');
  assert.ok(![...folder.querySelectorAll('h2')].some(h => /hiccup/i.test(h.textContent)),
    'and no hiccup is shown');
  assert.equal(folder.title, 'BiteSized Utilities - opened from a folder');

  const served = await boot('https://the-creative-master.github.io/BiteSizedUtilities/');
  assert.equal(served.querySelector('h2'), null, 'the handoff never fired on a served page');
  assert.equal(served.getElementById('app').children.length, 0,
    'and nothing has written into the mount point');
  assert.ok(served.getElementById('app'), 'and #app is still there for the kitchen to mount into');
  assert.match(served.querySelector('script[type="module"]').getAttribute('src'), /app\.js$/,
    'with the module tag untouched');
});

test('the built page survived Vite, which injects by string-matching', { skip: !exists('dist/index.html') }, () => {
  // Vite puts the built entry tag in the head by replacing the first `</head>` it
  // finds in the serialized document. A handoff that wrote a whole page had one
  // inside its own string, and the built index.html came out with the kitchen's
  // module tag spliced into the middle of that string — a broken live site that
  // no source-level check would have seen, because the source was fine.
  const built = read('dist/index.html');
  assert.equal(built.match(/<\/head>/g).length, 1, 'one closing head, and it is the real one');
  assert.equal(built.match(/<script type="module"/g).length, 1, 'one entry tag');
  assert.match(built, /<script type="module" crossorigin src="\.\/assets\/app-[^"]+\.js">/,
    'pointing at the built bundle');
  assert.ok(built.includes("if(location.protocol!=='file:')return;"), 'the handoff is still in there');
  assert.equal(built.match(/This folder is not a server/g).length, 1, 'once, in the handoff');
  assert.ok(!/<script type="module"[^>]*>[^<]*<script/.test(built), 'and not nested inside another script');
});

test('the service worker does not precache the offline file', { skip: !exists('dist/sw.js') }, () => {
  // 1.2 MB that no visitor to the site asked for, fetched on the first load. The
  // build order in CI is what keeps it out — the worker is written during
  // `npm run build`, before `build:offline` puts the file there — so this pins the
  // outcome rather than trusting the ordering to stay that way by accident.
  assert.ok(!read('dist/sw.js').includes('offline.html'), 'it is a download, not part of the shell');
});
