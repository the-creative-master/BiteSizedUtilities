import {defineConfig} from 'vite';
import fs from 'node:fs';
import path from 'node:path';
export default defineConfig({base:'./',build:{target:'es2022',chunkSizeWarningLimit:1200},plugins:[{name:'local-assets-and-offline',configureServer(server){
 // Serve runtime JS byte-for-byte: Vite's HMR import breaks classic workers/importScripts.
 const runtimeRoot=path.resolve('runtimes');
 server.middlewares.use((req,res,next)=>{
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{return next()}
  const marker='/runtimes/',offset=pathname.indexOf(marker);if(offset<0)return next();
  const file=path.resolve(runtimeRoot,pathname.slice(offset+marker.length));
  if(!file.startsWith(runtimeRoot+path.sep)){res.statusCode=403;res.end('Forbidden');return}
  if(!fs.existsSync(file)||!fs.statSync(file).isFile())return next();
  res.setHeader('Content-Type',({'.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.wasm':'application/wasm','.json':'application/json','.zip':'application/zip'})[path.extname(file)]||'application/octet-stream');
  fs.createReadStream(file).on('error',()=>{res.statusCode=500;res.end()}).pipe(res);
 });
},closeBundle(){
 for(const dir of ['games','runtimes'])if(fs.existsSync(dir))fs.cpSync(dir,`dist/${dir}`,{recursive:true});
 // Cache the application shell, not hundreds of megabytes of optional games/runtimes.
 const files=[];function walk(dir){for(const f of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())walk(p);else files.push('./'+path.relative('dist',p).split(path.sep).join('/'));}}walk('dist');
 const shell=files.filter(p=>!p.startsWith('./games/')&&!p.startsWith('./runtimes/')&&p!=='./sw.js');
 const version='bite-'+Date.now();
 fs.writeFileSync('dist/sw.js',`const CACHE=${JSON.stringify(version)};const SHELL=${JSON.stringify(shell)};self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('bite-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{if(r.ok&&r.type==='basic'){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{})}return r}).catch(()=>{if(e.request.mode==='navigate')return caches.match('./index.html');return Response.error()})))});`);
}}]});
