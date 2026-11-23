/**
 * Throwaway diagnostic: what actually happens to runtimes/worker.js on the
 * deployed site. Run from CI, because CI is the only place with both a browser
 * and a route to GitHub Pages.
 *
 * It separates the layers that can refuse a worker script, so the fix can be
 * aimed instead of guessed:
 *   1. does Pages serve the file, and with what content type
 *   2. can the page fetch it
 *   3. does a trivial worker construct at all
 *   4. does the real worker construct, first visit and after the service worker
 *      has taken control (the two states differ: the worker re-serves the
 *      document with COOP/COEP, so the second visit is cross-origin isolated)
 *   5. does it construct with the service worker unregistered and its caches
 *      deleted, which is the difference between "the worker is in the way" and
 *      "the page is isolated"
 *   6. does a blob worker that importScripts the same file work, which is the
 *      fallback if the worker-script load path itself is what is refused
 */
import { chromium } from '@playwright/test';

const LIVE = 'https://the-creative-master.github.io/BiteSizedUtilities/';
const WORKER = LIVE + 'runtimes/worker.js';
const out = [];
const say = (...a) => { const line = a.join(' '); out.push(line); console.log(line); };

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

// ---- layer 1: what the host actually sends, headers and all ----
{
  const ctx = await browser.newContext();
  const r = await ctx.request.get(WORKER);
  const body = await r.text();
  say('HOST  status=%s  content-type=%s  bytes=%d', r.status(), r.headers()['content-type'], body.length);
  say('HOST  headers: %s', JSON.stringify(r.headers()));
  say('HOST  first line: %s', body.split('\n')[0].slice(0, 100));
  const swr = await ctx.request.get(LIVE + 'sw.js');
  const swb = await swr.text();
  say('HOST  sw.js status=%s bytes=%d isolated()=%s COEP=%s',
    swr.status(), swb.length, /function isolated\(/.test(swb), /Cross-Origin-Embedder-Policy/.test(swb));
  const idx = await ctx.request.get(LIVE);
  const idxb = await idx.text();
  say('HOST  index status=%s bytes=%d bundle=%s', idx.status(), idxb.length,
    (idxb.match(/assets\/app-[\w-]+\.js/) || ['(none)'])[0]);
  await ctx.close();
}

// ---- layers 2-6: inside a real page on the real origin ----
const context = await browser.newContext();
const page = await context.newPage();
const consoleLines = [];
page.on('console', m => consoleLines.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', e => consoleLines.push(`pageerror: ${e.message}`));
// Keep the probe quick: the kitchen boots models and games this run does not need.
await page.route('**/*', route => {
  const u = route.request().url();
  if (/\/(ort|ort-chat|wllama|wllama-compat|games)\//.test(u) || /huggingface|\.gguf|\.onnx/.test(u)) return route.abort();
  return route.continue();
});

const probes = () => page.evaluate(async workerUrl => {
  const res = {};
  res.crossOriginIsolated = globalThis.crossOriginIsolated === true;
  res.swController = navigator.serviceWorker?.controller?.scriptURL || null;
  res.protocol = location.protocol;
  try {
    const r = await fetch(workerUrl, { cache: 'no-store' });
    res.fetch = { ok: r.ok, status: r.status, type: r.type, contentType: r.headers.get('content-type') };
    res.fetchHead = (await r.text()).slice(0, 60);
  } catch (e) { res.fetch = { threw: String(e) }; }

  const attempt = (make, ms = 8000) => new Promise(resolve => {
    let done = false;
    const finish = r => { if (!done) { done = true; try { w?.terminate(); } catch {} resolve(r); } };
    let w;
    try { w = make(); } catch (e) { return finish({ threw: String(e && e.message || e) }); }
    const t = setTimeout(() => finish({ timeout: true }), ms);
    w.onmessage = ({ data }) => { clearTimeout(t); finish({ ok: true, data: JSON.stringify(data).slice(0, 120) }); };
    w.onerror = e => { clearTimeout(t); finish({ onerror: e.message || '(empty message)', filename: e.filename || null, lineno: e.lineno || null }); };
    try { w.postMessage({ op: 'json', code: '{"a":1}', options: {}, input: '' }); } catch (e) { clearTimeout(t); finish({ postThrew: String(e) }); }
  });

  res.plainBlobWorker = await attempt(() => new Worker(URL.createObjectURL(
    new Blob(['onmessage=e=>postMessage({pong:e.data})'], { type: 'text/javascript' }))));
  res.realWorker = await attempt(() => new Worker(workerUrl));
  res.blobImportScriptsWorker = await attempt(() => new Worker(URL.createObjectURL(
    new Blob([`importScripts(${JSON.stringify(workerUrl)});`], { type: 'text/javascript' }))));
  return res;
}, WORKER);

await page.goto(LIVE, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(4000);
say('VISIT1 %s', JSON.stringify(await probes(), null, 0));

// The app reloads itself once the worker takes control; give it the chance.
await page.waitForTimeout(9000);
say('VISIT1b %s', JSON.stringify(await probes(), null, 0));

await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(6000);
say('VISIT2 %s', JSON.stringify(await probes(), null, 0));

// ---- layer 5: same page, service worker gone ----
const unregistered = await page.evaluate(async () => {
  const rs = await navigator.serviceWorker.getRegistrations();
  for (const r of rs) await r.unregister();
  if (globalThis.caches) for (const k of await caches.keys()) await caches.delete(k);
  return rs.length;
});
say('UNREGISTERED %d registration(s)', unregistered);
await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(4000);
say('VISIT3-no-sw %s', JSON.stringify(await probes(), null, 0));

say('CONSOLE (%d lines)', consoleLines.length);
for (const line of consoleLines.slice(0, 40)) say('  | %s', line.slice(0, 220));

await browser.close();
