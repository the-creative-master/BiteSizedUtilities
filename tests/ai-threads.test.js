// Every model on a deployed kitchen used to run on one CPU core, and not because
// anybody chose that: multi-threaded WebAssembly needs SharedArrayBuffer, which
// needs cross-origin isolation, which needs two response headers a static host
// cannot send. The service worker this build already writes can send them, so
// these pin that it does — and that the page asks for a second chance exactly
// once rather than in a loop.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const viteSrc = fs.readFileSync('vite.config.js', 'utf8');
const appSrc = fs.readFileSync('app.js', 'utf8');
const aiSrc = fs.readFileSync('waffle-browser-ai.js', 'utf8');

test('the generated service worker sends the isolation headers on navigations', () => {
  assert.match(viteSrc, /Cross-Origin-Opener-Policy', 'same-origin'/);
  assert.match(viteSrc, /Cross-Origin-Embedder-Policy', 'credentialless'/);
  assert.match(viteSrc, /const isDocument = req\.mode === 'navigate'/, 'only a document gets them');
  assert.match(viteSrc, /isDocument \? isolated\(fallback\) : fallback/, 'and an offline document is isolated too');

  // credentialless rather than require-corp, on purpose: two vendored games in
  // the cabinet fetch a display font from a CDN, and require-corp would break
  // them for no benefit here. A browser that does not understand credentialless
  // ignores the header and stays single-threaded, which is what it does today.
  assert.ok(!/Cross-Origin-Embedder-Policy', 'require-corp'/.test(viteSrc),
    'require-corp would break the off-origin fonts the cabinet still uses');

  // The cached copy stays plain, so a document served from cache later can be
  // isolated again rather than being frozen without the headers.
  assert.match(viteSrc, /caches\.open\(CACHE\)\.then\(c => c\.put\(req, copy\)\)/);
  assert.ok(viteSrc.indexOf('c.put(req, copy)') < viteSrc.indexOf('isolated(r)'),
    'what is cached is the plain response, not the rewritten one');
});

test('the runtimes were already waiting on crossOriginIsolated', () => {
  // Nothing about threading had to be taught to the engines: they ask for it and
  // fall back when it is missing. The headers are the only thing that was absent.
  assert.match(aiSrc, /const canThread = isCrossOriginIsolated && hasSharedArrayBuffer;/);
  assert.match(aiSrc, /if \(!diag\.canThread\) \{/, 'ONNX is pinned to one thread only while isolation is missing');
  assert.match(aiSrc, /mod\.env\.backends\.onnx\.wasm\.numThreads = 1;/);
  assert.match(aiSrc, /Math\.min\(4, Math\.floor\(\(diag\.cores \|\| 2\) \/ 2\)\)/, 'wllama already knows how many threads to ask for');
});

test('a page that registered the worker asks for one isolated reload, once', () => {
  // The document that registers a worker was served before the worker existed,
  // so it has no headers and this page is still one thread. Asking again is the
  // only way to get them — and asking twice would be a reload loop on a browser
  // that refuses.
  assert.match(appSrc, /waffle-isolation-reload/, 'guarded by a stored flag');
  assert.match(appSrc, /if \(globalThis\.crossOriginIsolated\) return;/, 'never reloads a page that is already isolated');
  assert.match(appSrc, /if \(!navigator\.serviceWorker\.controller\) return;/, 'and never before the worker is in charge');
  assert.ok(appSrc.indexOf("localStorage.setItem(KEY, '1')") < appSrc.indexOf('location.reload()'),
    'the flag is set before the reload, so it cannot loop');
  assert.match(appSrc, /requestIdleCallback\(go, \{ timeout: 8000 \}\)/, 'it waits for idle instead of fighting the boot');
  assert.match(appSrc, /navigator\.serviceWorker\.addEventListener\('controllerchange', reloadOnce, \{ once: true \}\)/,
    'and it fires when the worker actually takes control');
});

test('the built worker carries all of it', () => {
  // Only exists after a build; in CI the tests run before it, which is the point
  // of the guard rather than an excuse.
  if (!fs.existsSync('dist/sw.js')) return;
  const sw = fs.readFileSync('dist/sw.js', 'utf8');
  assert.match(sw, /function isolated\(res\)/);
  assert.match(sw, /Cross-Origin-Opener-Policy/);
  assert.match(sw, /credentialless/);
  assert.match(sw, /req\.mode === 'navigate'/);
});

test('the worker really does attach the headers, rather than only mentioning them', async () => {
  // Reading the source for a string proves the string is there. This runs the
  // built worker's own isolated() against a real Response and reads back what a
  // browser would see — headers, status and body — because the difference
  // between "sets the header" and "returns a usable response" is the whole
  // feature.
  if (!fs.existsSync('dist/sw.js')) return;
  const sw = fs.readFileSync('dist/sw.js', 'utf8');
  const start = sw.indexOf('function isolated(res)');
  const end = sw.indexOf('function staticHostAnswer()');
  assert.ok(start > 0 && end > start, 'isolated() was captured from the built worker');
  const isolated = new Function(`${sw.slice(start, end)}; return isolated;`)();

  const plain = new Response('<html></html>', {
    status: 200,
    headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' }
  });
  const out = isolated(plain);
  assert.equal(out.headers.get('Cross-Origin-Opener-Policy'), 'same-origin');
  assert.equal(out.headers.get('Cross-Origin-Embedder-Policy'), 'credentialless');
  assert.equal(out.headers.get('Content-Type'), 'text/html', 'the headers it arrived with survive');
  assert.equal(out.status, 200);
  assert.equal(await out.text(), '<html></html>', 'and so does the document');
  assert.equal(isolated(null), null, 'an offline miss is passed through, not wrapped');
});
