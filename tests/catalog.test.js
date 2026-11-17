import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cupboards, allTools } from '../catalog.js';
import { toolPropSVG, gamePropSVG } from '../icons-25d.js';

test('Math & Numbers cupboard contains exact 10 utilities and other four cupboards contain 15 each', () => {
  assert.equal(cupboards.length, 5);
  const math = cupboards.find(c => c.id === 'math');
  assert.ok(math);
  assert.deepEqual(
    math.tools.map(t => t[0]),
    [
      'calculator',
      'graphing-calculator',
      'bodily-calculator',
      'fractions',
      'percentage',
      'dice-roller',
      'roman-numerals',
      'number-base',
      'prime-checker',
      'sequence-playground'
    ]
  );
  for (const c of cupboards) {
    if (c.id !== 'math') assert.equal(c.tools.length, 15, c.name);
  }
  assert.equal(allTools.length, 70);
});

test('every single one of the 70 utilities has its own unique 2.5D SVG icon', () => {
  const svgs = allTools.map(t => toolPropSVG(t.id));
  assert.equal(new Set(svgs).size, 70, 'Every tool across all cupboards must have a distinct SVG');
});

test('tool identifiers are unique and every cupboard has its star', () => {
  assert.equal(new Set(allTools.map(t => t.id)).size, 70);
  for (const c of cupboards) assert.ok(c.tools.some(t => t[0] === c.star));
});

test('all utility identifiers have implementation dispatch cases', () => {
  const mathSrc = fs.readFileSync('tools-math-numbers.js', 'utf8');
  const sciSrc = fs.readFileSync('tools-math-science.js', 'utf8');
  const codeSrc = fs.readFileSync('tools-code.js', 'utf8');
  const textArtSrc = fs.readFileSync('tools-text-art.js', 'utf8');
  for (const t of allTools) {
    const source = t.cupboard === 'math'
      ? mathSrc
      : t.cupboard === 'science'
        ? sciSrc
        : t.cupboard === 'code'
          ? codeSrc
          : textArtSrc;
    assert.ok(source.includes(t.id), t.id);
  }
});

test('all 45 games (including Roper) have valid entrypoints, unique logos, and no iframe embedding', () => {
  const gamesSrc = fs.readFileSync('games.js', 'utf8');
  assert.ok(!gamesSrc.includes('iframe'), 'games.js must not iframe the game sites');
  const games = JSON.parse(fs.readFileSync('games/catalog.json', 'utf8'));
  assert.equal(games.length, 45);
  assert.ok(games.some(g => g.id === 'roper' && g.category === 'Fancade'));
  assert.ok(!fs.existsSync('games/arcade'));
  assert.ok(!fs.existsSync('games/original'));
  assert.ok(!fs.existsSync('games/fetched'));
  assert.ok(fs.existsSync('games/arcade-controls.js'));
  assert.ok(fs.existsSync('games/ATTRIBUTION.md'));
  for (const g of games) {
    assert.equal(g.origin, 'github', g.id + ' must come from GitHub');
    assert.ok(g.repo.startsWith('https://github.com/'), g.id + ' must have GitHub repo');
    assert.ok(g.title);
    assert.ok(g.license);
    assert.ok(fs.existsSync(g.entrypoint), g.id + ' entrypoint exists');
    assert.ok(fs.statSync(g.entrypoint).size > 200, g.id + ' entrypoint nonempty');
  }
  const gameLogos = games.map(g => gamePropSVG(g, g.category));
  assert.equal(new Set(gameLogos).size, 45, 'Every game in the arcade must have a unique 2.5D logo');
});

test('CodeHub runtimes (Luau, Haskell, Ruby, PHP, SQL, C++, Clojure, Prolog, Wasm, etc.) and instant tool loading are wired', () => {
  const workerSrc = fs.readFileSync('runtimes/worker.js', 'utf8');
  const codeSrc = fs.readFileSync('tools-code.js', 'utf8');
  const appSrc = fs.readFileSync('app.js', 'utf8');
  const requiredLangs = [
    'luau', 'haskell', 'ruby', 'php', 'sql', 'c', 'cpp', 'clojure',
    'prolog', 'wasm', 'jq', 'tcl', 'sass', 'yaml', 'toml', 'markdown',
    'xml', 'handlebars', 'ejs', 'erb', 'javascript', 'typescript', 'python', 'lua', 'bash'
  ];
  for (const lang of requiredLangs) {
    assert.ok(codeSrc.includes(`'${lang}'`), `tools-code.js has ${lang}`);
    assert.ok(workerSrc.includes(`'${lang}'`) || workerSrc.includes(`${lang}:`), `worker.js handles ${lang}`);
  }
  const vendoredFiles = [
    'runtimes/vendor/luau/lib/Luau.Web.Asyncify.js',
    'runtimes/vendor/haskell/jshc.js',
    'runtimes/vendor/ruby/opal.js',
    'runtimes/vendor/ruby/opal-builder.js',
    'runtimes/vendor/php/php8.3-web.mjs',
    'runtimes/vendor/php/1b0372a2c42bfce11af8ba65b5cf84b7ef4c15ee.wasm',
    'runtimes/vendor/jscpp.js',
    'runtimes/vendor/scittle.js',
    'runtimes/vendor/tau-prolog.js',
    'runtimes/vendor/wabt.js',
    'runtimes/vendor/jq/jq.js',
    'runtimes/vendor/sass.js',
    'runtimes/vendor/tcl.js',
    'runtimes/vendor/markup-bundle.js'
  ];
  for (const file of vendoredFiles) assert.ok(fs.existsSync(file), `${file} exists`);
  assert.ok(!appSrc.includes('await import('), 'app.js uses static imports for instant loading');
});

test('Waffle AI chatbot is wired to Sir Waffle mascot and powered by node-llama.cpp Qwen 2.5 1.5B', async () => {
  const appSrc = fs.readFileSync('app.js', 'utf8');
  const viteSrc = fs.readFileSync('vite.config.js', 'utf8');
  const serverSrc = fs.readFileSync('waffle-ai-server.js', 'utf8');
  const uiSrc = fs.readFileSync('waffle-ai.js', 'utf8');
  assert.ok(appSrc.includes('openWaffleAI'), 'app.js opens Waffle AI when touching the waffle');
  assert.ok(viteSrc.includes('attachWaffleAiMiddleware'), 'vite.config.js attaches Waffle AI middleware');
  assert.ok(serverSrc.includes('node-llama-cpp'), 'waffle-ai-server.js uses node-llama-cpp');
  assert.ok(uiSrc.includes('/api/waffle-ai/chat'), 'waffle-ai.js streams from /api/waffle-ai/chat');
  const { getWaffleStatus } = await import('../waffle-ai-server.js');
  const status = getWaffleStatus();
  assert.equal(status.engine, 'node-llama.cpp');
  assert.equal(status.model, 'Qwen 2.5 1.5B');
  assert.equal(status.preCached, true, 'Qwen 2.5 1.5B GGUF model must be pre-cached on disk');
});
