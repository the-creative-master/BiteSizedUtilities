import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cupboards,allTools} from '../catalog.js';
test('five utility cupboards each contain exactly fifteen tools',()=>{assert.equal(cupboards.length,5);for(const c of cupboards)assert.equal(c.tools.length,15,c.name);assert.equal(allTools.length,75)});
test('tool identifiers are unique and every cupboard has its star',()=>{assert.equal(new Set(allTools.map(t=>t.id)).size,75);for(const c of cupboards)assert.ok(c.tools.some(t=>t[0]===c.star))});
test('all utility identifiers have implementation dispatch cases',()=>{for(const t of allTools){const source=fs.readFileSync(t.cupboard==='math'||t.cupboard==='science'?'tools-math-science.js':t.cupboard==='code'?'tools-code.js':'tools-text-art.js','utf8');assert.ok(source.includes(t.id),t.id)}});
test('every curated game includes local entrypoint, license and download',()=>{const raw=JSON.parse(fs.readFileSync('games/catalog.json','utf8'));const games=Array.isArray(raw)?raw:raw.games;assert.ok(games.length>=20);for(const g of games){assert.ok(g.title);assert.ok(g.license);const entry=g.entrypoint||g.entry||g.path||g.url;const zip=g.zip||g.download;assert.ok(entry,g.title+' entry');assert.ok(zip,g.title+' zip');assert.ok(fs.existsSync(entry.replace(/^\.\//,'')),g.title+' entry exists');assert.ok(fs.existsSync(zip.replace(/^\.\//,'')),g.title+' zip exists')}});
