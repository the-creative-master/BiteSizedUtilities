// Every model on a deployed kitchen runs on one CPU core, and that is now a
// choice with a measurement behind it rather than an accident of the host.
//
// Multi-threaded WebAssembly needs SharedArrayBuffer, which needs cross-origin
// isolation, which needs two response headers a static host cannot send. The
// service worker this build writes *can* send them, and for a while it did: it
// re-served the document with COOP same-origin and COEP credentialless so the
// next navigation would boot isolated and the AI runtimes could use every core.
//
// Chromium refuses to construct a dedicated worker from a page in that state —
// with an empty error message and nothing in the console, so it reads like a
// missing file. Every language in CodeHub runs in a worker, and so do the Regex
// Tester and the three formatters, so all of them were dead on the deployed site
// while working on any server with no service worker registered. These pin that
// the headers are gone, that the runtimes fall back to one thread on their own
// without being told, and that a page which was served *with* them gets exactly
// one reload to pick up a document without.
//
// tests/sw-runtime-worker.test.js is the other half: it drives a real browser,
// because reading a source file for a header name is how this passed its tests
// while the deployed site was broken.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const viteSrc = fs.readFileSync('vite.config.js', 'utf8');
const appSrc = fs.readFileSync('app.js', 'utf8');
const aiSrc = fs.readFileSync('waffle-browser-ai.js', 'utf8');
const imageSrc = fs.readFileSync('waffle-image-gen.js', 'utf8');

test('the generated service worker no longer rewrites a document', () => {
  // Comments are stripped before the negative checks, because the comment above
  // the worker names the policy it no longer sends and why. What must be absent
  // is the code, not the word.
  const code = viteSrc.split('\n').filter(line => !line.trimStart().startsWith('//')).join('\n');
  assert.ok(!/headers\.set\('Cross-Origin-/.test(code), 'it sets neither isolation header');
  assert.ok(!/function isolated\(/.test(code), 'and the helper that set them is gone, not commented out');
  assert.ok(!/isolated\(r\)|isolated\(fallback\)/.test(code), 'nothing is wrapped on the way out');
  assert.ok(!/credentialless|require-corp/.test(code), 'no embedding policy is sent under any value');
  assert.match(viteSrc, /COEP credentialless/, 'while the comment still says which one it was, so the next reader does not re-add it');

  // What the worker is still for. Losing the headers must not have taken the
  // offline copy or the static-host answer with them.
  assert.match(viteSrc, /const isDocument = req\.mode === 'navigate'/, 'it still knows a document when it sees one');
  assert.match(viteSrc, /isDocument \? caches\.match\(SCOPE \+ 'index\.html'\) : Response\.error\(\)/,
    'an offline navigation still falls back to the cached kitchen');
  assert.match(viteSrc, /return r;/, 'and a document that does load is passed through exactly as the host sent it');
  assert.match(viteSrc, /staticHostAnswer\(\)/, 'the API answer that tells the client this is a static deploy stays');
  assert.match(viteSrc, /caches\.open\(CACHE\)\.then\(c => c\.put\(req, copy\)\)/, 'so does the cache that makes it work');
});

test('the runtimes fall back to one thread without being told', () => {
  // Nothing about threading had to be un-taught: the engines ask for isolation
  // and fall back when it is missing, which is the whole reason removing the
  // headers costs speed and not function.
  assert.match(aiSrc, /const canThread = isCrossOriginIsolated && hasSharedArrayBuffer;/);
  assert.match(aiSrc, /if \(!diag\.canThread\) \{/, 'ONNX is pinned to one thread only while isolation is missing');
  assert.match(aiSrc, /mod\.env\.backends\.onnx\.wasm\.numThreads = 1;/);
  assert.match(aiSrc, /Math\.min\(4, Math\.floor\(\(diag\.cores \|\| 2\) \/ 2\)\)/, 'and wllama still asks for cores when it can have them');
  assert.match(imageSrc, /self\.crossOriginIsolated \? Math\.min\(4, navigator\.hardwareConcurrency \|\| 2\) : 1/,
    'image generation reads the same flag and lands on one thread');
});

test('a page that was served with the headers asks for one clean reload, once', () => {
  // Inverted from what it was: the reload used to chase isolation, so it fired
  // when the page had none. Now it sheds isolation, so it fires only when the
  // page still has it — a first-time visitor never reloads at all.
  assert.match(appSrc, /waffle-isolation-reload-2/, 'under a fresh flag, because everybody who visited while the headers were sent has the old one set');
  assert.match(appSrc, /if \(!globalThis\.crossOriginIsolated\) return;/, 'a document served clean is left alone');
  assert.match(appSrc, /if \(!navigator\.serviceWorker\.controller\) return;/, 'and nothing happens before the worker is in charge');
  assert.ok(appSrc.indexOf("localStorage.setItem(KEY, '1')") < appSrc.indexOf('location.reload()'),
    'the flag is set before the reload, so it cannot loop');
  assert.match(appSrc, /requestIdleCallback\(go, \{ timeout: 8000 \}\)/, 'it waits for idle instead of fighting the boot');
  assert.match(appSrc, /navigator\.serviceWorker\.addEventListener\('controllerchange', reloadOnce, \{ once: true \}\)/,
    'and it fires when the worker actually takes control');
});

test('the built worker carries none of it', () => {
  // Only exists after a build; in CI the tests run before it, which is the point
  // of the guard rather than an excuse.
  if (!fs.existsSync('dist/sw.js')) return;
  const sw = fs.readFileSync('dist/sw.js', 'utf8');
  assert.ok(!/Cross-Origin-/.test(sw), 'the shipped worker mentions no isolation header at all');
  assert.ok(!/function isolated\(/.test(sw), 'and ships no helper to add one');
  assert.match(sw, /req\.mode === 'navigate'/, 'while keeping the offline document fallback');
  assert.match(sw, /No llama\.cpp server on this static host/, 'and the static-host answer');
});
