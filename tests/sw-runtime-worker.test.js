// The regression that reading source files could not catch.
//
// Every language in CodeHub runs in a worker, and so do the Regex Tester and the
// three formatters. For a while the generated service worker re-served the
// document with COOP same-origin and COEP credentialless, so that the next
// navigation would boot cross-origin isolated and the AI runtimes could thread.
// Chromium refuses to construct a dedicated worker from a page in that state —
// silently, with an empty error message and nothing in the console — so all of
// them were dead on the deployed site while every test passed, because no test
// had ever registered the worker and then asked for a runtime.
//
// So this drives a browser. It serves the service worker exactly as the build
// writes it, and checks both directions: a document that carries the two headers
// cannot start a worker, and the same document behind this worker can. Without
// the first half the second would pass for the wrong reason — a worker that
// never took control would look identical to one that behaves.
//
// Needs Playwright's Chromium, like tests/code-runtime.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const viteSrc = fs.readFileSync('vite.config.js', 'utf8');

/**
 * The service worker this build ships, stamped the way the build stamps it. The
 * template is read back out of vite.config.js and evaluated as the template
 * literal it is, so what gets served here is byte-for-byte what lands in
 * dist/sw.js rather than a copy that can drift from it.
 */
function builtWorkerSource() {
  const raw = viteSrc.match(/const swSource = `([\s\S]*?)`;\s*\n\s*fs\.writeFileSync\(/);
  assert.ok(raw, 'the service worker template was found in vite.config.js');
  return new Function(`return \`${raw[1]}\`;`)()
    .replace('__CACHE__', JSON.stringify('bite-sw-runtime-test'))
    .replace('__SHELL__', JSON.stringify([]));
}

const RUNTIME = `self.onmessage = e => { postMessage({ type: 'done', value: 'ran:' + e.data.op }); };`;

function pageScript() {
  return `navigator.serviceWorker.register('./sw.js')
    .then(() => navigator.serviceWorker.ready)
    .catch(e => { document.title = 'register-failed: ' + e.message; });`;
}

const DOCUMENT = `<!doctype html><html><head><meta charset="utf-8"><title>booting</title></head>
<body><script>${pageScript()}<\/script></body></html>`;

let server, browser, origin;

test.before(async () => {
  const swSource = builtWorkerSource();
  server = http.createServer((req, res) => {
    const p = new URL(req.url, 'http://localhost').pathname;
    if (p === '/sw.js') return res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }).end(swSource);
    if (p === '/runtimes/worker.js') return res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' }).end(RUNTIME);
    if (p === '/isolated') {
      // What the deployed worker used to do to every navigation.
      return res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless'
      }).end(DOCUMENT);
    }
    if (p === '/') return res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(DOCUMENT);
    return res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404');
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
});

test.after(async () => {
  await browser?.close();
  await new Promise(r => server?.close(r));
});

/** Ask the page to build a worker and report what the browser actually did. */
function attemptWorker(page) {
  return page.evaluate(() => new Promise(resolve => {
    const result = {
      crossOriginIsolated: globalThis.crossOriginIsolated === true,
      controller: navigator.serviceWorker?.controller?.scriptURL || null
    };
    let worker, done = false;
    const finish = r => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { worker?.terminate(); } catch {}
      resolve({ ...result, ...r });
    };
    const timer = setTimeout(() => finish({ worker: 'timeout' }), 8000);
    try { worker = new Worker(new URL('runtimes/worker.js', document.baseURI)); }
    catch (e) { return finish({ worker: 'threw', message: e.message || '(empty)' }); }
    worker.onmessage = ({ data }) => finish({ worker: 'ran', value: data.value });
    worker.onerror = e => finish({ worker: 'refused', message: e.message || '(empty)', filename: e.filename || null });
    worker.postMessage({ op: 'json' });
  }));
}

test('a page carrying the isolation headers cannot start a runtime', async () => {
  const page = await browser.newPage();
  await page.goto(`${origin}/isolated`, { waitUntil: 'load' });
  const out = await attemptWorker(page);
  assert.equal(out.crossOriginIsolated, true, 'the two headers did what they were sent to do');
  assert.equal(out.worker, 'refused', 'and that is the state Chromium will not build a dedicated worker in');
  assert.equal(out.message, '(empty)', 'with no message, which is why this looked like a missing file for so long');
  await page.close();
});

test('the same page behind the shipped service worker runs its runtimes', async () => {
  const page = await browser.newPage();
  await page.goto(`${origin}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, { timeout: 20000 });
  // Second navigation: the document now comes back through the worker, which is
  // the state a returning visitor is actually in.
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, { timeout: 20000 });

  const out = await attemptWorker(page);
  assert.ok(out.controller, 'the worker is in control, so this is not passing on an unregistered page');
  assert.equal(out.crossOriginIsolated, false, 'and it is no longer handing the document isolation headers');
  assert.equal(out.worker, 'ran', 'so the runtime starts');
  assert.equal(out.value, 'ran:json', 'and it is the runtime that answered, not a stub');

  // Proof the worker really was in the request path rather than merely installed:
  // it caches what it serves, so its cache exists and holds this document.
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    for (const key of keys) {
      const hit = await caches.open(key).then(c => c.match('./', { ignoreSearch: true }));
      if (hit) return { key, status: hit.status };
    }
    return null;
  });
  assert.ok(cached, 'the worker cached the document it served, so it was in the path');
  assert.equal(cached.key, 'bite-sw-runtime-test');
  await page.close();
});
