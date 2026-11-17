import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { attachWaffleAiMiddleware, scheduleWaffleWarmup } from './waffle-ai-server.js';

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
  const ortRoot = path.resolve('node_modules/onnxruntime-web/dist');
  const wllamaRoot = path.resolve('node_modules/@wllama/wllama/esm/wasm');
  const mounts = [
    ['/api/waffle-ai/sd-models/', sdRoot, 'public, max-age=86400'],
    ['/api/waffle-ai/gguf/', ggufRoot, 'public, max-age=86400'],
    ['/ort/', ortRoot, 'public, max-age=86400'],
    ['/wllama/', wllamaRoot, 'public, max-age=86400'],
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
    for (const [marker, rootDir, cacheCtl] of mounts) {
      const offset = pathname.indexOf(marker);
      if (offset < 0) continue;
      const rel = pathname.slice(offset + marker.length);
      if (marker === '/api/waffle-ai/gguf/' && !rel.endsWith('.gguf')) return next();
      const file = path.resolve(rootDir, rel);
      if (!file.startsWith(rootDir + path.sep)) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
      }
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
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
  server: { host: '0.0.0.0', allowedHosts: true },
  preview: { host: '0.0.0.0', allowedHosts: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
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
        if (pathname === '/' || pathname === '/index.html') {
          res.setHeader('Cache-Control', 'no-store, max-age=0');
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
      const ortDist = path.resolve('node_modules/onnxruntime-web/dist');
      if (fs.existsSync(ortDist)) {
        fs.mkdirSync('dist/ort', { recursive: true });
        for (const f of fs.readdirSync(ortDist)) {
          if (/^ort-wasm.*\.(wasm|mjs|js)$/.test(f)) {
            fs.copyFileSync(path.join(ortDist, f), path.join('dist/ort', f));
          }
        }
      }
      const wllamaDist = path.resolve('node_modules/@wllama/wllama/esm/wasm');
      if (fs.existsSync(wllamaDist)) {
        fs.mkdirSync('dist/wllama', { recursive: true });
        for (const f of fs.readdirSync(wllamaDist)) {
          if (f.endsWith('.wasm')) {
            fs.copyFileSync(path.join(wllamaDist, f), path.join('dist/wllama', f));
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
      const shell = files.filter(p => !p.startsWith('./games/') && !p.startsWith('./runtimes/') && !p.startsWith('./ort/') && !p.startsWith('./wllama/') && p !== './sw.js');
      const version = 'bite-' + Date.now();
      fs.writeFileSync('dist/sw.js', `const CACHE=${JSON.stringify(version)};const SHELL=${JSON.stringify(shell)};self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('bite-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api/'))return;e.respondWith(fetch(e.request).then(r=>{if(r.ok&&r.type==='basic'){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{})}return r}).catch(()=>caches.match(e.request).then(hit=>hit||(e.request.mode==='navigate'?caches.match('./index.html'):Response.error()))))});`);
    }
  }]
});
