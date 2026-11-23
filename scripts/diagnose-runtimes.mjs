/**
 * Throwaway diagnostic, second cut. The first one settled where the wall is:
 *
 *   HOST   200  application/javascript  32008 bytes     (the file is fine)
 *   page   fetch(worker.js) -> 200 application/javascript (the page can read it)
 *   page   new Worker(worker.js)  -> onerror, empty message, no filename
 *   page   service worker unregistered + caches deleted -> the same worker runs
 *
 * So the kitchen's own service worker is what stops CodeHub's runtimes from
 * starting on the deployed site, and it does it silently — an empty error
 * message and nothing in the console. Two things the worker does could be
 * responsible, and they need different fixes:
 *
 *   A. it intercepts the worker-script request and answers it, and something
 *      about that answer is refused (the fetch inside it rejects, and the catch
 *      hands back Response.error(), which is exactly a silent network failure);
 *   B. it re-serves the document with COOP/COEP, so the page boots cross-origin
 *      isolated, and Chromium then refuses the worker script for that reason.
 *
 * This runs the deployed service worker, fetched from the live site and served
 * unmodified, against a minimal page on a local origin, and then runs the two
 * candidate fixes as variants of the same file. Whichever variant lets the
 * worker start is the one to ship. A third variant drops only the cache put(),
 * in case teeing the response body is what breaks it.
 */
import { chromium } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';

const LIVE = 'https://the-creative-master.github.io/BiteSizedUtilities/';
const deployed = await (await fetch(LIVE + 'sw.js')).text();
if (!/function isolated\(/.test(deployed)) throw new Error('the deployed sw.js is not the one this experiment assumes');

const GET_LINE = '  if (req.method !== \'GET\') return;';
const SET_HEADERS = `  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Embedder-Policy', 'credentialless');`;
const PUT_BLOCK = `        if (!len || len <= MAX_CACHE_BYTES) {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }`;

function variant(name, fn) {
  const src = fn(deployed);
  if (src === deployed && name !== 'as deployed') throw new Error(`variant "${name}" did not change anything — the needle moved`);
  return [name, src];
}

const variants = Object.fromEntries([
  variant('as deployed', s => s),
  variant('A: skips worker-script requests', s => s.replace(GET_LINE,
    `  if (req.destination === 'worker' || req.destination === 'sharedworker') return;\n${GET_LINE}`)),
  variant('B: no COOP/COEP on the document', s => s.replace(SET_HEADERS, '  // headers deliberately not set')),
  variant('C: no cache put()', s => s.replace(PUT_BLOCK, '        // deliberately not cached'))
]);

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>booting</title></head><body>
<script>
navigator.serviceWorker.register('./sw.js').then(() => {
  const ready = () => { document.title = navigator.serviceWorker.controller ? 'controlled' : 'ready'; };
  navigator.serviceWorker.addEventListener('controllerchange', ready);
  navigator.serviceWorker.ready.then(ready);
  setTimeout(ready, 4000);
}).catch(e => { document.title = 'register-failed: ' + e.message; });
</script></body></html>`;

const WORKER = `self.onmessage = e => { postMessage({ type: 'done', value: 'ran:' + e.data.op }); };`;

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const results = [];

for (const [name, swSource] of Object.entries(variants)) {
  const server = http.createServer((req, res) => {
    const p = new URL(req.url, 'http://x').pathname;
    if (p === '/' || p === '/index.html') return res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(PAGE);
    if (p === '/sw.js') return res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }).end(swSource);
    if (p === '/runtimes/worker.js') return res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' }).end(WORKER);
    // Everything the deployed worker precaches is absent here on purpose: the
    // install step is allSettled, so a missing shell file must not sink it.
    return res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404');
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;

  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message.slice(0, 160)));

  await page.goto(origin + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => document.title !== 'booting', null, { timeout: 15000 }).catch(() => {});
  const firstTitle = await page.title();
  // Second navigation: the document now comes back through the worker, which is
  // the state the live kitchen reloads itself into.
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(800);

  const probe = await page.evaluate(() => new Promise(resolve => {
    const out = { crossOriginIsolated: globalThis.crossOriginIsolated === true, controller: !!navigator.serviceWorker?.controller };
    let w, done = false;
    const finish = r => { if (!done) { done = true; clearTimeout(t); try { w?.terminate(); } catch {} resolve({ ...out, ...r }); } };
    const t = setTimeout(() => finish({ worker: 'timeout after 6s' }), 6000);
    try { w = new Worker(new URL('runtimes/worker.js', document.baseURI)); }
    catch (e) { return finish({ worker: 'threw: ' + (e.message || e) }); }
    w.onmessage = ({ data }) => finish({ worker: 'ran', value: data.value });
    w.onerror = e => finish({ worker: 'onerror', message: e.message || '(empty)', filename: e.filename || null });
    w.postMessage({ op: 'json' });
  }));

  results.push({ name, origin, firstTitle, ...probe, consoleErrors: consoleErrors.slice(0, 4) });
  console.log(JSON.stringify(results[results.length - 1]));
  await context.close();
  await new Promise(r => server.close(r));
}

await browser.close();
fs.writeFileSync('DIAGNOSIS.txt', results.map(r => JSON.stringify(r, null, 1)).join('\n') + '\n');
console.log('\nVERDICT');
for (const r of results) {
  console.log(`  ${r.worker === 'ran' ? 'WORKS ' : 'BLOCKED'}  isolated=${r.crossOriginIsolated ? 'yes' : 'no '}  ${r.name}`);
}
