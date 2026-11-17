import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cupboards, allTools } from '../catalog.js';
import { toolPropSVG, gamePropSVG } from '../icons-25d.js';

test('Math & Numbers cupboard contains exact 10 utilities and other seven cupboards (including English, Music & Composing, and Videography & Editing) contain 15 each', () => {
  assert.equal(cupboards.length, 8);
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
  const eng = cupboards.find(c => c.id === 'english');
  assert.ok(eng, 'English & Languages cupboard exists');
  assert.equal(eng.star, 'waffle-translate');
  assert.ok(eng.tools.some(t => t[0] === 'sentence-corrector'));

  const music = cupboards.find(c => c.id === 'music');
  assert.ok(music, 'Music & Composing cupboard exists');
  assert.equal(music.star, 'waffle-music-lab');

  const video = cupboards.find(c => c.id === 'video');
  assert.ok(video, 'Videography & Editing cupboard exists');
  assert.equal(video.star, 'waffle-studio');

  for (const c of cupboards) {
    if (c.id !== 'math') assert.equal(c.tools.length, 15, c.name);
  }
  assert.equal(allTools.length, 115);
});

test('every single one of the 115 utilities has its own unique 2.5D SVG icon', () => {
  const svgs = allTools.map(t => toolPropSVG(t.id));
  assert.equal(new Set(svgs).size, 115, 'Every tool across all cupboards must have a distinct SVG');
});

test('tool identifiers are unique and every cupboard has its star', () => {
  assert.equal(new Set(allTools.map(t => t.id)).size, 115);
  for (const c of cupboards) assert.ok(c.tools.some(t => t[0] === c.star));
});

test('all utility identifiers have implementation dispatch cases', () => {
  const mathSrc = fs.readFileSync('tools-math-numbers.js', 'utf8');
  const sciSrc = fs.readFileSync('tools-math-science.js', 'utf8');
  const codeSrc = fs.readFileSync('tools-code.js', 'utf8');
  const textArtSrc = fs.readFileSync('tools-text-art.js', 'utf8');
  const engSrc = fs.readFileSync('tools-english.js', 'utf8');
  const musicSrc = fs.readFileSync('tools-music.js', 'utf8');
  const videoSrc = fs.readFileSync('tools-video.js', 'utf8');
  for (const t of allTools) {
    const source = t.cupboard === 'math'
      ? mathSrc
      : t.cupboard === 'science'
        ? sciSrc
        : t.cupboard === 'code'
          ? codeSrc
          : t.cupboard === 'english'
            ? engSrc
            : t.cupboard === 'music'
              ? musicSrc
              : t.cupboard === 'video'
                ? videoSrc
                : textArtSrc;
    assert.ok(source.includes(t.id), t.id);
  }
});

test('no site or utility embeds iframes anywhere in the application', () => {
  for (const file of ['games.js', 'app.js', 'waffle-ai.js', 'tools-code.js', 'tools-text-art.js', 'tools-english.js']) {
    const src = fs.readFileSync(file, 'utf8');
    assert.ok(!src.includes('iframe'), `${file} must not iframe any site or preview`);
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
  assert.ok(codeSrc.includes('qwen2.5-coder-1.5b') && codeSrc.includes('AI Error Diagnostics'), 'CodeHub uses Qwen 2.5 Coder 1.5B for AI error diagnostics');
  assert.ok(!appSrc.includes('await import('), 'app.js uses static imports for instant loading');
});

test('Waffle AI chatbot, streaming code boxes, DOCX creation/parsing, single Waffle button, and AI wall bounce are wired', async () => {
  const appSrc = fs.readFileSync('app.js', 'utf8');
  const viteSrc = fs.readFileSync('vite.config.js', 'utf8');
  const serverSrc = fs.readFileSync('waffle-ai-server.js', 'utf8');
  const uiSrc = fs.readFileSync('waffle-ai.js', 'utf8');
  assert.ok(appSrc.includes('openWaffleAI'), 'app.js opens Waffle AI when touching the waffle');
  assert.ok(!appSrc.includes('waffle-hud-btn'), 'Only one Waffle AI button should exist (Sir Waffle)');
  assert.ok(appSrc.includes('/api/waffle-ai/wall-quip'), 'Bouncing the wall triggers AI-powered quips');
  assert.ok(viteSrc.includes('attachWaffleAiMiddleware'), 'vite.config.js attaches Waffle AI middleware');
  assert.ok(serverSrc.includes('node-llama-cpp'), 'waffle-ai-server.js uses node-llama-cpp');
  assert.ok(uiSrc.includes('/api/waffle-ai/chat'), 'waffle-ai.js streams from /api/waffle-ai/chat');

  const { getWaffleStatus } = await import('../waffle-ai-server.js');
  const status = getWaffleStatus();
  assert.equal(status.engine, 'node-llama.cpp');
  assert.equal(status.model, 'Qwen 2.5 1.5B');
  assert.equal(typeof status.preCached, 'boolean');
  const hasLocalModels = fs.existsSync('.cache/waffle-ai/qwen2.5-1.5b.gguf');
  if (hasLocalModels) {
    assert.equal(status.preCached, true, 'Qwen 2.5 1.5B GGUF model must be pre-cached when local cache is present');
  }

  const { formatWaffleMarkdown } = await import('../waffle-ai.js');
  const partial = formatWaffleMarkdown('Here is code:\n```python\nprint("hi")', true);
  assert.ok(partial.includes('waffle-code-box') && partial.includes('python'), 'Streaming unclosed fence renders inside a live code box');
  const fileCard = formatWaffleMarkdown('```file:notes.docx\n# Hello\nWorld\n```', false);
  assert.ok(fileCard.includes('waffle-file-box') && fileCard.includes('notes.docx'), 'File fence renders downloadable file card');

  const { createDocxBytes, extractTextFromDocxBuffer } = await import('../file-tools-client.js');
  const docx = createDocxBytes('# Cozy Test\n\nHello **Waffle**!', 'Cozy Test');
  const parsed = await extractTextFromDocxBuffer(docx.buffer);
  assert.ok(parsed.includes('Cozy Test') && parsed.includes('Hello Waffle!'));

  const englishSrc = fs.readFileSync('tools-english.js', 'utf8');
  assert.ok(englishSrc.includes('translate.googleapis.com/translate_a/single'), 'Waffle Translate uses Google Translate API');
  assert.ok(englishSrc.includes('(Speak in ${appLang})'), 'English utilities silently append Speak-in language hint');

  const { SERVER_MODELS } = await import('../waffle-ai-server.js');
  assert.ok(SERVER_MODELS['qwen2.5-coder-1.5b'] && SERVER_MODELS['qwen3-0.6b'], 'Server exposes Qwen 2.5 Coder 1.5B and Qwen 3 0.6B');
  if (hasLocalModels) {
    assert.ok(fs.existsSync('.cache/waffle-ai/qwen3-0.6b.gguf'), 'Qwen 3 0.6B GGUF is pre-cached on disk');
  }

  const { TEXT_MODELS, EXECUTION_MODES, AI_DISCLAIMER_TEXT } = await import('../waffle-browser-ai.js');
  assert.ok(TEXT_MODELS.some(m => m.id === 'llama3.2-1b'), 'Llama 3.2 1B available');
  const browserAiSrc = fs.readFileSync('waffle-browser-ai.js', 'utf8');
  assert.ok(browserAiSrc.includes('Qwen3_5ForCausalLM') && browserAiSrc.includes('decoder_model_merged'), 'Qwen 3.5 0.8B uses Qwen3_5ForCausalLM with split ONNX dtype');
  assert.ok(TEXT_MODELS.some(m => m.id === 'qwen2.5-coder-1.5b'), 'Qwen 2.5 Coder 1.5B available');
  assert.ok(['auto', 'server', 'webgpu', 'wllama', 'wasm'].every(id => EXECUTION_MODES.some(m => m.id === id)), 'All fallback modes wired');
  assert.ok(AI_DISCLAIMER_TEXT.includes('iOS 26') && AI_DISCLAIMER_TEXT.includes('WebGPU'), 'AI disclaimer warns about iOS 26 and WebGPU');
  assert.ok(!/tier\s*[123]|diagram/i.test(AI_DISCLAIMER_TEXT), 'AI disclaimer does not mention tier numbers or diagrams');
  assert.ok(fs.existsSync('node_modules/@wllama/wllama/esm/wasm/wllama.wasm'), 'WLlama WASM binary installed locally');
  assert.ok(fs.existsSync('node_modules/@wllama/wllama-compat/wasm/wllama.wasm'), 'WLlama compat WASM binary installed locally');
  assert.ok(viteSrc.includes('/wllama/') && viteSrc.includes('/wllama-compat/') && viteSrc.includes('/api/waffle-ai/gguf/'), 'Vite serves self-hosted WLlama, compat WASM, and local GGUF ranges');
  assert.ok(uiSrc.includes('bite-open-settings') && uiSrc.includes('streamWllamaChat'), 'Waffle AI opens Settings for models and supports WLlama fallback');

  const { APP_LANGUAGES, tUI } = await import('../i18n.js');
  const { EN_KEYS, NATIVE_DICTS } = await import('../i18n-dicts.js');
  assert.ok(APP_LANGUAGES.length >= 12, 'Settings supports many languages');
  const i18nSrc = fs.readFileSync('i18n.js', 'utf8');
  assert.ok(i18nSrc.includes('#waffle-ai-overlay'), 'i18n skips Waffle AI modal');
  assert.ok(!i18nSrc.includes('translate.googleapis.com'), 'i18n uses native translations instead of Google Translate API');
  for (const lang of APP_LANGUAGES.filter(l => l.code !== 'en')) {
    assert.equal(NATIVE_DICTS[lang.code]?.length, EN_KEYS.length, `Native dictionary complete for ${lang.code}`);
  }
  assert.equal(tUI('Settings', 'es'), 'Ajustes');
  assert.equal(tUI('10 UTILITIES', 'fr'), '10 OUTILS');

  const { IMAGE_MODELS } = await import('../waffle-image-gen.js');
  assert.ok(IMAGE_MODELS.some(m => m.id === 'sdxs-512') && IMAGE_MODELS.some(m => m.id === 'sd-turbo'), 'Waffle AI exposes SDXS-512 and SD-Turbo image generation');
  if (fs.existsSync('.cache/waffle-ai/sd-models')) {
    assert.ok(fs.existsSync('.cache/waffle-ai/sd-models/studio-ai/models/tok/vocab.json'), 'CLIP tokenizer for SD models is pre-cached');
    assert.ok(fs.existsSync('.cache/waffle-ai/sd-models/studio-ai-hq1/unet/m.000'), 'SD-Turbo weights are pre-cached');
    assert.ok(fs.existsSync('.cache/waffle-ai/sd-models/studio-ai-t2i/t2i09/unet09/q.004'), 'SDXS-512 weights are pre-cached');
  }

  const uiKitSrc = fs.readFileSync('ui-kit.js', 'utf8');
  assert.ok(uiKitSrc.includes('export async function copyToClipboard') && uiKitSrc.includes("execCommand('copy')"), 'copyToClipboard includes execCommand fallback for iframes');
  for (const f of ['waffle-ai.js', 'tools-code.js', 'tools-text-art.js', 'tools-math-science.js', 'tools-english.js']) {
    assert.ok(!fs.readFileSync(f, 'utf8').includes('navigator.clipboard?.writeText'), `${f} uses copyToClipboard instead of raw clipboard API`);
  }

  const fileToolsSrc = fs.readFileSync('file-tools-client.js', 'utf8');
  assert.ok(fileToolsSrc.includes('FlateDecode') && fileToolsSrc.includes('slides') && fileToolsSrc.includes('sharedStrings') && fileToolsSrc.includes('extractFilePayload'), 'file-tools-client supports PDF FlateDecode, PPTX, XLSX, and image payloads');
  assert.ok(browserAiSrc.includes('Qwen3_5ForConditionalGeneration') && browserAiSrc.includes('AutoProcessor') && browserAiSrc.includes('RawImage'), 'waffle-browser-ai supports multimodal image vision via Qwen3_5ForConditionalGeneration');
  assert.ok(serverSrc.includes('BEGIN FILE') && uiSrc.includes('extractFilePayload') && uiSrc.includes('waffle-msg-img'), 'Server and UI explicitly handle inline file blocks and image previews');
  const { WAFFLE_SYSTEM_PROMPT } = await import('../waffle-ai-server.js');
  assert.ok(!/maple syrup|crispy waffle|golden waffle/i.test(WAFFLE_SYSTEM_PROMPT), 'System prompt does not bias models with waffle/syrup roleplay');
  assert.ok(uiSrc.includes('!m.isWelcome') && uiSrc.includes('Text-only fallback is disabled for images'), 'Welcome message is excluded from LLM history and images never fall back to blind text models');

  assert.ok(serverSrc.includes('/api/waffle-ai/web-search') && uiSrc.includes('waffle-ai-web-toggle'), 'Web Search Mode is wired on server and UI');
  assert.ok(appSrc.includes('english-warning-overlay') && appSrc.includes('showEnglishEntryWarning'), 'English warning appears as cupboard-entry popup');
  assert.ok(!englishSrc.includes('english-disclaimer-card'), 'Individual English tools do not show big inline disclaimer card');
  assert.ok(appSrc.includes('exp-warning-overlay') && appSrc.includes('Experienced Users Only') && browserAiSrc.includes('getAiTemperature'), 'Temperature tweaking is gated behind Experienced Users Only popup');
  assert.ok(['butter', 'matcha', 'berry', 'midnight', 'blueberry', 'citrus', 'lavender', 'mintchoco'].every(t => appSrc.includes(`id: '${t}'`)), 'All 8 Kitchen Mood themes exist in app.js');
});
