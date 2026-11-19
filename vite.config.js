import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { attachWaffleAiMiddleware, scheduleWaffleWarmup } from './waffle-ai-server.js';

const nodeRequire = createRequire(import.meta.url);

/** Walk up from a resolved module file until its own package.json is found. */
function packageRootOf(resolvedFile) {
  let dir = path.dirname(resolvedFile);
  for (let i = 0; i < 12; i++) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pj = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pj?.name) return { dir, version: pj.version || '', name: pj.name };
      } catch {}
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function resolvePackage(spec, fromFile) {
  try {
    const r = fromFile ? createRequire(fromFile) : nodeRequire;
    return packageRootOf(r.resolve(spec));
  } catch {
    return null;
  }
}

/**
 * onnxruntime-web ships its WASM factory next to the JS that was built against
 * it, and the two must come from the SAME build. This app pulls ORT in through
 * two different doors:
 *
 *   - waffle-image-gen.js imports `onnxruntime-web/webgpu` directly, so Vite
 *     bundles the top-level onnxruntime-web.
 *   - waffle-browser-ai.js goes through @huggingface/transformers, which ships
 *     its own pre-bundled ORT JS built against a *pinned* onnxruntime-web
 *     (often a dev pre-release nested inside the transformers package).
 *
 * Feeding the chat pipeline the top-level WASM therefore mixes ORT JS 1.31.x
 * with a WASM factory from a different build: the model downloads fine and the
 * session then dies. So each consumer gets its own directory.
 */
function resolveOrtRuntimes() {
  const image = resolvePackage('onnxruntime-web');
  const transformers = resolvePackage('@huggingface/transformers');
  const chat = transformers
    ? (resolvePackage('onnxruntime-web', path.join(transformers.dir, 'package.json')) || image)
    : image;
  const withDist = entry => {
    if (!entry) return null;
    const dist = path.join(entry.dir, 'dist');
    return fs.existsSync(dist) ? { ...entry, dist } : null;
  };
  return { image: withDist(image), chat: withDist(chat) };
}

const ORT_RUNTIME_FILES = /^ort-wasm-simd-threaded(\.asyncify)?\.(wasm|mjs)$/;
const HASHED_ORT_ASSET = /^(ort-wasm-simd-threaded(?:\.asyncify|\.jsep|\.jspi)?)-[\w-]{8}\.(wasm|mjs)$/;

/**
 * Rollup also emits every `new URL('ort-wasm-simd-threaded*.wasm',
 * import.meta.url)` reference inside the ORT bundles as a hashed asset under
 * `dist/assets/`. Those copies are pure dead weight: `env.wasm.wasmPaths` is
 * always set before a session is created (transformers.js points it at
 * jsDelivr, Waffle AI points it at the local `ort/` + `ort-chat/` dirs), so the
 * `locateFile` fallback that reads them never runs. Repoint the reference at
 * the stable copy and delete the duplicate — that is ~27 MB less per deploy.
 */
function dedupeOrtAssets(outDirs) {
  const assetsDir = path.resolve('dist/assets');
  if (!fs.existsSync(assetsDir)) return 0;
  const stable = new Map();
  for (const rel of outDirs) {
    const dir = path.resolve(rel);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (ORT_RUNTIME_FILES.test(f) && !stable.has(f)) stable.set(f, { dir: rel, file: dir + path.sep + f });
    }
  }
  let removed = 0;
  for (const f of fs.readdirSync(assetsDir)) {
    const m = HASHED_ORT_ASSET.exec(f);
    if (!m) continue;
    const twin = stable.get(`${m[1]}.${m[2]}`);
    const assetPath = path.join(assetsDir, f);
    if (!twin || fs.statSync(assetPath).size !== fs.statSync(twin.file).size) continue;
    const target = `../${path.basename(twin.dir)}/${m[1]}.${m[2]}`;
    for (const chunk of fs.readdirSync(assetsDir)) {
      if (!chunk.endsWith('.js')) continue;
      const chunkPath = path.join(assetsDir, chunk);
      const code = fs.readFileSync(chunkPath, 'utf8');
      if (!code.includes(f)) continue;
      fs.writeFileSync(chunkPath, code.split(f).join(target));
    }
    fs.rmSync(assetPath);
    removed++;
  }
  return removed;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.zip': 'application/zip',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

function attachLocalModelRoutes(middlewares) {
  const sdRoot = path.resolve('.cache/waffle-ai/sd-models');
  const ggufRoot = path.resolve('.cache/waffle-ai');
  const ortRuntimes = resolveOrtRuntimes();
  const ortRoot = ortRuntimes.image?.dist || path.resolve('node_modules/onnxruntime-web/dist');
  const ortChatRoot = ortRuntimes.chat?.dist || ortRoot;
  const ortVersion = ortRuntimes.image?.version || '';
  const ortChatVersion = ortRuntimes.chat?.version || ortVersion;
  const wllamaRoot = path.resolve('node_modules/@wllama/wllama/esm/wasm');
  const wllamaCompatRoot = path.resolve('node_modules/@wllama/wllama-compat/wasm');
  const mounts = [
    ['/api/waffle-ai/sd-models/', sdRoot, 'public, max-age=86400'],
    ['/api/waffle-ai/gguf/', ggufRoot, 'public, max-age=86400'],
    ['/ort-chat/', ortChatRoot, 'public, max-age=86400', ortChatVersion],
    ['/ort/', ortRoot, 'public, max-age=86400', ortVersion],
    ['/wllama/', wllamaRoot, 'public, max-age=86400'],
    ['/wllama-compat/', wllamaCompatRoot, 'public, max-age=86400'],
    ['/runtimes/', path.resolve('runtimes'), 'no-cache'],
    ['/games/', path.resolve('games'), 'no-cache']
  ];

  middlewares.use((req, res, next) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      return next();
    }
    for (const [marker, rootDir, cacheCtl, runtimeVersion] of mounts) {
      const offset = pathname.indexOf(marker);
      if (offset < 0) continue;
      const rel = pathname.slice(offset + marker.length);
      if (marker === '/api/waffle-ai/gguf/' && !rel.endsWith('.gguf')) return next();
      if (rel === 'ort-version.json' && runtimeVersion) {
        res.statusCode = 200;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ version: runtimeVersion, dir: marker }));
        return;
      }
      const file = path.resolve(rootDir, rel);
      if (!file.startsWith(rootDir + path.sep)) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
      }
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
        if (pathname.startsWith('/api/waffle-ai/')) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'Local model asset not cached on disk' }));
          return;
        }
        return next();
      }
      const stat = fs.statSync(file);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', cacheCtl);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');

      const range = req.headers.range;
      if (range && /^bytes=\d*-\d*$/.test(range)) {
        const [sPart, ePart] = range.replace('bytes=', '').split('-');
        const start = sPart ? parseInt(sPart, 10) : 0;
        const end = ePart ? Math.min(parseInt(ePart, 10), stat.size - 1) : stat.size - 1;
        if (Number.isFinite(start) && Number.isFinite(end) && start <= end && end < stat.size) {
          res.statusCode = 206;
          res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
          res.setHeader('Content-Length', String(end - start + 1));
          if (req.method === 'HEAD') { res.end(); return; }
          fs.createReadStream(file, { start, end }).on('error', () => { res.statusCode = 500; res.end(); }).pipe(res);
          return;
        }
      }

      res.setHeader('Content-Length', String(stat.size));
      if (req.method === 'HEAD') { res.end(); return; }
      fs.createReadStream(file).on('error', () => {
        res.statusCode = 500;
        res.end();
      }).pipe(res);
      return;
    }
    next();
  });
}

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      'onnxruntime-node': path.resolve('waffle-ort-empty.js')
    }
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  },
  preview: { host: '0.0.0.0', allowedHosts: true },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      // backup.html is the second build of the same kitchen, reached by a
      // hidden gesture. Rollup only emits index.html unless it is listed here,
      // and the page would 404 on GitHub Pages.
      input: {
        main: path.resolve('index.html'),
        backup: path.resolve('backup.html')
      }
    }
  },
  plugins: [{
    name: 'local-assets-and-offline',
    configureServer(server) {
      attachWaffleAiMiddleware(server.middlewares);
      scheduleWaffleWarmup(1500);

      server.middlewares.use((req, res, next) => {
        let pathname;
        try {
          pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        } catch {
          return next();
        }
        if (pathname === '/' || pathname === '/index.html' || /\.(js|mjs|css|html)$/i.test(pathname)) {
          const origWriteHead = res.writeHead.bind(res);
          res.writeHead = (...args) => {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            return origWriteHead(...args);
          };
        }
        if (pathname === '/sw.js' || pathname.endsWith('/sw.js')) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(`self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>{e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)));await self.registration.unregister();const cs=await self.clients.matchAll({type:'window'});for(const c of cs)c.navigate(c.url);})())});`);
          return;
        }
        next();
      });
      attachLocalModelRoutes(server.middlewares);
    },
    configurePreviewServer(server) {
      attachWaffleAiMiddleware(server.middlewares);
      scheduleWaffleWarmup(1500);
      attachLocalModelRoutes(server.middlewares);
    },
    closeBundle() {
      for (const dir of ['games', 'runtimes']) {
        if (fs.existsSync(dir)) fs.cpSync(dir, `dist/${dir}`, { recursive: true });
      }
      // Self-hosted model weights. `scripts/fetch-model.mjs` downloads GGUFs into
      // .cache/waffle-ai/ (gitignored); the dev server already serves that folder
      // at /api/waffle-ai/gguf/, and this makes the *production* build serve the
      // same path, so a deployed site can run AI without touching huggingface.co.
      //
      // Absent folder is normal and silent: weights are never committed, so CI
      // builds without them and the browser downloads from HF as it always has.
      const ggufSrc = path.resolve('.cache/waffle-ai');
      if (fs.existsSync(ggufSrc)) {
        // GitHub Pages has a ~1 GB soft cap per site and this build already ships
        // ~340 MB, so cap what we add rather than quietly pushing a deploy over
        // it. Smallest first: a tight budget should still yield a working model
        // instead of one huge file and nothing else.
        const SELF_HOST_TOTAL_MAX = 400 * 1024 ** 2;
        const ggufOut = path.resolve('dist/api/waffle-ai/gguf');
        const files = fs.readdirSync(ggufSrc)
          .filter(f => f.endsWith('.gguf'))
          .map(f => ({ f, size: fs.statSync(path.join(ggufSrc, f)).size }))
          .sort((a, b) => a.size - b.size);
        let used = 0;
        let copied = 0;
        for (const { f, size } of files) {
          if (used + size > SELF_HOST_TOTAL_MAX) {
            console.warn(`[waffle] not self-hosting ${f} (${Math.round(size / 1024 ** 2)} MB) — would exceed the ${Math.round(SELF_HOST_TOTAL_MAX / 1024 ** 2)} MB budget; it will download from Hugging Face instead`);
            continue;
          }
          fs.mkdirSync(ggufOut, { recursive: true });
          fs.copyFileSync(path.join(ggufSrc, f), path.join(ggufOut, f));
          used += size;
          copied++;
        }
        if (copied) {
          console.log(`[waffle] self-hosting ${copied} GGUF model(s), ${Math.round(used / 1024 ** 2)} MB, at dist/api/waffle-ai/gguf/`);
        }
      }
      const ortRuntimes = resolveOrtRuntimes();
      const copyOrtRuntime = (srcDist, outDir, version) => {
        if (!srcDist || !fs.existsSync(srcDist)) return false;
        fs.mkdirSync(outDir, { recursive: true });
        let copied = 0;
        for (const f of fs.readdirSync(srcDist)) {
          if (ORT_RUNTIME_FILES.test(f)) {
            fs.copyFileSync(path.join(srcDist, f), path.join(outDir, f));
            copied++;
          }
        }
        // Lets the browser verify that the WASM factory matches the ORT JS it
        // was handed, and fall back to the CDN copy when it does not.
        fs.writeFileSync(path.join(outDir, 'ort-version.json'), JSON.stringify({ version: version || '' }));
        return copied > 0;
      };
      copyOrtRuntime(ortRuntimes.image?.dist, 'dist/ort', ortRuntimes.image?.version);
      // Only ship a second copy when the chat pipeline (transformers.js) really
      // was built against a different onnxruntime-web than the image pipeline.
      if (ortRuntimes.chat?.dist && ortRuntimes.chat.dist !== ortRuntimes.image?.dist) {
        copyOrtRuntime(ortRuntimes.chat.dist, 'dist/ort-chat', ortRuntimes.chat.version);
      }
      dedupeOrtAssets(['dist/ort-chat', 'dist/ort']);
      const wllamaDist = path.resolve('node_modules/@wllama/wllama/esm/wasm');
      if (fs.existsSync(wllamaDist)) {
        fs.mkdirSync('dist/wllama', { recursive: true });
        for (const f of fs.readdirSync(wllamaDist)) {
          if (f.endsWith('.wasm')) {
            fs.copyFileSync(path.join(wllamaDist, f), path.join('dist/wllama', f));
          }
        }
      }
      const wllamaCompatDist = path.resolve('node_modules/@wllama/wllama-compat/wasm');
      if (fs.existsSync(wllamaCompatDist)) {
        fs.mkdirSync('dist/wllama-compat', { recursive: true });
        for (const f of fs.readdirSync(wllamaCompatDist)) {
          if (f.endsWith('.wasm') || f.endsWith('.js')) {
            fs.copyFileSync(path.join(wllamaCompatDist, f), path.join('dist/wllama-compat', f));
          }
        }
      }
      // Cache the application shell, not hundreds of megabytes of optional games/runtimes.
      const files = [];
      function walk(dir) {
        for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, f.name);
          if (f.isDirectory()) walk(p);
          else files.push('./' + path.relative('dist', p).split(path.sep).join('/'));
        }
      }
      walk('dist');
      const shell = files.filter(p => !p.startsWith('./games/') && !p.startsWith('./runtimes/') && !p.startsWith('./ort/') && !p.startsWith('./ort-chat/') && !p.startsWith('./wllama/') && !p.startsWith('./wllama-compat/') && !p.endsWith('.wasm') && p !== './sw.js');
      const version = 'bite-' + Date.now();
      // The worker only exists on static hosts (GitHub Pages), where there is no
      // llama.cpp server and no COOP/COEP. It has to:
      //   - answer /api/waffle-ai/* instantly instead of letting the host return
      //     a 404 HTML page (the client then knows it is a static deploy at once),
      //   - stay out of the way of the huge runtime assets (transformers.js keeps
      //     its own copy of the ORT wasm, so caching it twice only burns quota),
      //   - work from a sub-path, so nothing may assume the site lives at "/".
      const swSource = `
const CACHE = __CACHE__;
const SHELL = __SHELL__;
const SCOPE = new URL('.', self.location.href).href;
const BIG_ASSET = /\\.(wasm|gguf|onnx|bin|safetensors|zip|mp4|webm)$/i;
const MAX_CACHE_BYTES = 8 * 1024 * 1024;

function staticHostAnswer() {
  return new Response(
    JSON.stringify({ ok: false, static: true, error: 'No llama.cpp server on this static host — using the in-browser runtimes.' }),
    { status: 501, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
  );
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // One missing file must not kill the whole install.
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('bite-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  let u;
  try { u = new URL(req.url); } catch { return; }
  if (u.origin !== self.location.origin) return;

  // The API only exists on the dev/preview server; on a static host answer at
  // once so Waffle AI switches to the browser runtimes without a 404 round trip.
  if (u.href.startsWith(SCOPE + 'api/')) {
    e.respondWith(staticHostAnswer());
    return;
  }

  if (req.method !== 'GET') return;
  const isBigAsset = BIG_ASSET.test(u.pathname);

  e.respondWith(
    fetch(req).then(r => {
      if (r.ok && r.type === 'basic' && !isBigAsset) {
        const len = Number(r.headers.get('content-length') || '0');
        if (!len || len <= MAX_CACHE_BYTES) {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
      }
      return r;
    }).catch(() => caches.match(req).then(hit => hit || (
      req.mode === 'navigate' ? caches.match(SCOPE + 'index.html') : Response.error()
    )))
  );
});
`;
      fs.writeFileSync(
        'dist/sw.js',
        swSource
          .replace('__CACHE__', JSON.stringify(version))
          .replace('__SHELL__', JSON.stringify(shell))
      );
    }
  }]
});
