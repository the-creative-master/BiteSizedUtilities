import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  estimateTokens,
  clipToCharBudget,
  fitChatToTokenBudget,
  classifyAiFailure,
  summarizeAiFailures,
  CTX_MARGIN_TOKENS,
  WLAMA_CTX_CPU,
  WLAMA_CTX_GPU,
  ONNX_PROMPT_BUDGET,
  QUANT_PRESETS
} from '../waffle-browser-ai.js';

// The reply budget the chat actually asks for (waffle-ai.js: browser-kind models).
const REPLY_TOKENS = 560;
const SYS = 'You are a helpful, accurate assistant. Answer clearly in Markdown.';

test('the CPU context leaves real room for the prompt (regression: it was 208 tokens)', () => {
  const promptBudget = WLAMA_CTX_CPU - REPLY_TOKENS - CTX_MARGIN_TOKENS;
  assert.ok(promptBudget >= 400, `prompt budget is ${promptBudget}, must be >= 400`);
  assert.ok(WLAMA_CTX_GPU > WLAMA_CTX_CPU, 'the GPU path gets a larger window');
  assert.ok(ONNX_PROMPT_BUDGET > 512, 'the ONNX path has a usable prompt budget');
  // The old numbers, pinned so a regression back to them fails loudly.
  assert.notEqual(WLAMA_CTX_CPU, 768, 'n_ctx is no longer the 768 that overflowed');
});

test('estimateTokens is conservative and total is zero-safe', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens(null), 0);
  assert.equal(estimateTokens(undefined), 0);
  assert.ok(estimateTokens('abcd') >= 1, 'a short string is at least one token');
  // Under-estimating is what overflows a context window, so bias upward:
  // 3.5 chars/token rather than the optimistic 4.
  assert.ok(estimateTokens('x'.repeat(3500)) >= 1000);
  assert.ok(estimateTokens('x'.repeat(5200)) > 1000, 'a 5200-char attachment is over 1000 tokens');
});

test('clipToCharBudget keeps both ends and never exceeds the budget', () => {
  const text = 'HEAD-' + 'm'.repeat(2000) + '-TAIL';
  const clipped = clipToCharBudget(text, 300);
  assert.ok(clipped.length <= 300 + 60, 'stays near budget (marker adds a little)');
  assert.match(clipped, /^HEAD-/, 'the opening survives');
  assert.match(clipped, /-TAIL$/, 'the ending survives');
  assert.match(clipped, /trimmed to fit/, 'and says it was trimmed');
  assert.equal(clipToCharBudget(text, 0), '');
  assert.equal(clipToCharBudget(text, 10_000), text, 'no clipping when it already fits');
  assert.equal(clipToCharBudget('short', 3), 'sho', 'a tiny budget still returns something');
});

test('a short conversation passes through untouched', () => {
  const msgs = [{ role: 'user', content: 'What is 2+2?' }];
  const f = fitChatToTokenBudget({ systemPrompt: SYS, messages: msgs, promptBudget: 440 });
  assert.equal(f.messages.length, 1);
  assert.equal(f.messages[0].content, 'What is 2+2?');
  assert.equal(f.dropped, 0);
});

test('long history drops the OLDEST turns, never the newest', () => {
  const msgs = Array.from({ length: 8 }, (_, i) => ({
    role: i % 2 ? 'assistant' : 'user',
    content: `Turn ${i}: ${'lorem ipsum dolor sit amet '.repeat(8)}`
  }));
  const f = fitChatToTokenBudget({ systemPrompt: SYS, messages: msgs, promptBudget: 440 });
  assert.ok(f.messages.length >= 1 && f.messages.length < 8, `kept ${f.messages.length} of 8`);
  assert.ok(f.dropped > 0, 'something was dropped');
  // The survivor must be the newest message, not the oldest.
  assert.match(f.messages.at(-1).content, /^Turn 7:/, 'the newest turn survives');
  assert.ok(!f.messages.some(m => /^Turn 0:/.test(m.content)), 'the oldest turn was dropped first');
  // Order is preserved for the survivors.
  const nums = f.messages.map(m => Number(/^Turn (\d+):/.exec(m.content)[1]));
  assert.deepEqual(nums, [...nums].sort((a, b) => a - b), 'chronological order preserved');
});

test('an oversized newest message is clipped, not dropped', () => {
  // Dropping the question would generate a reply to nothing.
  const msgs = [{ role: 'user', content: 'y'.repeat(9000) }];
  const f = fitChatToTokenBudget({ systemPrompt: SYS, messages: msgs, promptBudget: 440 });
  assert.equal(f.messages.length, 1, 'the message survives');
  assert.ok(f.messages[0].content.length < 9000, 'but it was clipped');
  assert.match(f.messages[0].content, /trimmed to fit/);
});

test('a 5200-char file attachment now fits the CPU context', () => {
  // This is the exact shape waffle-ai.js sends: an attachment clipped to 5200
  // chars wrapped in BEGIN/END FILE markers. It used to be ~1300 tokens against
  // a 208-token budget, i.e. six times over.
  const msgs = [{
    role: 'user',
    content: `--- BEGIN FILE ---\n${'x'.repeat(5200)}\n--- END FILE ---\nSummarize this.`
  }];
  const budget = WLAMA_CTX_CPU - REPLY_TOKENS - CTX_MARGIN_TOKENS;
  const f = fitChatToTokenBudget({ systemPrompt: SYS, messages: msgs, promptBudget: budget });
  const effectiveReply = Math.max(48, Math.min(REPLY_TOKENS, WLAMA_CTX_CPU - f.promptTokens - CTX_MARGIN_TOKENS));
  const total = f.systemTokens + f.promptTokens + effectiveReply;
  assert.ok(total <= WLAMA_CTX_CPU, `prompt+reply=${total} must fit n_ctx=${WLAMA_CTX_CPU}`);
  assert.match(f.messages[0].content, /BEGIN FILE/, 'the attachment framing survives');
  assert.match(f.messages[0].content, /Summarize this\.$/, 'and so does the actual question');
});

test('no input shape overflows the window', () => {
  const budget = WLAMA_CTX_CPU - REPLY_TOKENS - CTX_MARGIN_TOKENS;
  const shapes = {
    empty: [],
    missing: null,
    'non-string content': [{ role: 'user', content: 42 }, { role: 'user' }],
    'huge system prompt': [{ role: 'user', content: 'hi' }],
    'twenty huge turns': Array.from({ length: 20 }, () => ({ role: 'user', content: 'z'.repeat(4000) }))
  };
  for (const [name, msgs] of Object.entries(shapes)) {
    const sys = name === 'huge system prompt' ? 's'.repeat(4000) : SYS;
    const f = fitChatToTokenBudget({ systemPrompt: sys, messages: msgs, promptBudget: budget });
    assert.ok(Array.isArray(f.messages), `${name}: returns an array`);
    const reply = Math.max(48, Math.min(REPLY_TOKENS, WLAMA_CTX_CPU - f.promptTokens - CTX_MARGIN_TOKENS));
    assert.ok(f.systemTokens + f.promptTokens + reply <= WLAMA_CTX_CPU, `${name}: fits`);
  }
});

test('a network failure says "could not reach the model host", not "Failed to fetch"', () => {
  // These are the six real strings from the reported failure.
  const real = [
    'ONNX WEBGPU load failed for Qwen 2.5 1.5B (onnx-community/Qwen2.5-1.5B-Instruct) — q4: Failed to fetch / int8: Failed to fetch',
    'WLlama CPU load: Failed to fetch',
    'ONNX WASM load failed for SmolLM2 135M (HuggingFaceTB/SmolLM2-135M-Instruct) — q4: Failed to fetch / int8: Failed to fetch'
  ];
  for (const msg of real) {
    const c = classifyAiFailure(new Error(msg));
    assert.equal(c.kind, 'network', msg.slice(0, 40));
    assert.equal(c.title, 'Could not reach the model host');
    assert.match(c.hint, /huggingface\.co/, 'names the host that was unreachable');
    assert.match(c.hint, /fetch-model/, 'and the command that fixes it');
    assert.match(c.hint, /not a model, memory or device problem/, 'rules out the wrong theories');
  }
});

test('each failure class gets its own actionable message', () => {
  const cases = [
    ['std::bad_alloc: out of memory', 'memory', 'Not enough memory for this model'],
    ['version_mismatch in checkWasmVersion', 'runtime', 'This browser cannot run the AI runtime'],
    ['shader-f16 is not supported', 'runtime', 'This browser cannot run the AI runtime'],
    ['bad magic: not a GGUF file', 'model', 'The model file could not be loaded'],
    ['download was truncated', 'model', 'The model file could not be loaded'],
    ['something entirely novel went wrong', 'unknown', 'The AI runtime failed']
  ];
  for (const [msg, kind, title] of cases) {
    const c = classifyAiFailure(new Error(msg));
    assert.equal(c.kind, kind, msg);
    assert.equal(c.title, title, msg);
    assert.ok(c.hint.length > 20, `${kind} has a real hint`);
  }
});

test('a uniform chain reports one cause, not six', () => {
  const cls = ['Failed to fetch', 'Failed to fetch', 'Failed to fetch'].map(m => classifyAiFailure(new Error(m)));
  const h = summarizeAiFailures(cls);
  assert.equal(h.uniform, true);
  assert.equal(h.count, 3);
  assert.equal(h.kind, 'network');
  assert.equal(summarizeAiFailures([]), null);
});

test('a mixed chain leads with the cause that got furthest', () => {
  // Five OOMs and one fetch failure: the OOMs prove the host was reachable, so
  // reporting "network" would send the visitor chasing the wrong problem.
  const cls = [
    ...Array.from({ length: 5 }, () => classifyAiFailure(new Error('out of memory'))),
    classifyAiFailure(new Error('Failed to fetch'))
  ];
  const h = summarizeAiFailures(cls);
  assert.equal(h.uniform, false);
  assert.equal(h.kind, 'memory', 'the majority and deeper cause wins');
  assert.equal(h.count, 6);

  // A tie breaks toward whichever runtime got furthest, not toward "network".
  const tie = summarizeAiFailures([
    classifyAiFailure(new Error('Failed to fetch')),
    classifyAiFailure(new Error('out of memory'))
  ]);
  assert.equal(tie.kind, 'memory', 'ties favour the deeper failure');
});

test('the on-device cache is no longer defeated by the "smallest" sentinel', () => {
  const src = fs.readFileSync('waffle-browser-ai.js', 'utf8');
  // The resolver must name the quant it actually took when no preset quant matched.
  assert.match(src, /function quantFromPath\(/, 'a real quant is derived from the filename');
  assert.match(src, /quant: quantFromPath\(fallback\.path\) \|\| 'smallest'/,
    'the sentinel is now a last resort, not the default');
  // Cache entries record the preset they were fetched under.
  assert.match(src, /function rememberPrecachedGguf\(repo, \{ url, quant, sizeBytes, preset \}\)/);
  assert.match(src, /preset: preset \|\| null/, 'the preset is persisted');
  assert.equal(src.match(/preset: preset\.id/g).length, 2, 'both writers record it');
  // And the read path accepts a preset match, or an unrecognised quant.
  assert.match(src, /cachedEntry\?\.preset\s*\n\s*\?\s*cachedEntry\.preset === preset\.id/,
    'a cached entry is validated against the current preset');
  assert.match(src, /cachedEntry\?\.quant === 'smallest'/,
    'an unrecognised quant is still served from cache rather than re-fetched');
  // No preset ever contained the sentinel, which is what broke it.
  for (const p of QUANT_PRESETS) {
    assert.ok(!p.ggufQuants.includes('smallest'), `${p.id} never listed 'smallest'`);
  }
});

test('sharded repos are sized by their total, and deduplicated', () => {
  const src = fs.readFileSync('waffle-browser-ai.js', 'utf8');
  assert.match(src, /Dedupe by first shard/, 'the intent is documented');
  assert.match(src, /const seen = new Map\(\);[\s\S]{0,400}if \(seen\.has\(file\)\) continue;/,
    'a shard set is only considered once');
  assert.match(src, /\(a\.sizeBytes \|\| a\.size \|\| Infinity\) - \(b\.sizeBytes \|\| b\.size \|\| Infinity\)/,
    'sorted by total bytes, not by one shard\u2019s size');
  assert.match(src, /if \(!chosen\) throw new Error\(`No usable GGUF file in \$\{repo\}`\);/,
    'an empty candidate set is a clear error, not a crash on undefined');
});

test('the fallback chain no longer scatters a hardcoded 1.5B server model', () => {
  const src = fs.readFileSync('waffle-ai.js', 'utf8');
  assert.match(src, /const SERVER_FALLBACK_ID = 'qwen2\.5-1\.5b';/, 'named once, with a reason');
  assert.equal(src.match(/'qwen2\.5-1\.5b'/g).length, 1,
    'the literal appears only in the constant definition');
  assert.ok(!src.includes("modelState.serverReachable !== false) pushServer("),
    'every server attempt uses canTryServer, which also checks preCached');
  assert.ok(src.match(/canTryServer\) pushServer/g).length >= 5, 'every server attempt is guarded');
});

test('the warmup does not POST to a server that provably is not there', () => {
  const src = fs.readFileSync('waffle-ai.js', 'utf8');
  assert.match(src, /if \(modelState\.serverReachable === null\) await fetchStatus\(\);/,
    'reachability is established first');
  assert.match(src, /if \(modelState\.serverReachable === false\) return;[\s\S]{0,200}api\/waffle-ai\/warmup/,
    'and the POST is skipped on a static host');
});

test('the context fitting is actually wired into both runtimes', () => {
  const src = fs.readFileSync('waffle-browser-ai.js', 'utf8');
  assert.ok(!src.includes('messages.slice(-8)'), 'no path still counts messages instead of tokens');
  assert.match(src, /n_ctx: gpu \? WLAMA_CTX_GPU : WLAMA_CTX_CPU/, 'WLlama sizes its window from the constants');
  assert.match(src, /max_tokens: effectiveMaxTokens/, 'and shrinks the reply rather than overflowing');
  assert.match(src, /for \(const m of fitted\.messages\)/, 'WLlama sends the fitted conversation');
  assert.match(src, /promptBudget: ONNX_PROMPT_BUDGET/, 'the ONNX path fits too');
});

test('models can be self-hosted so no Hugging Face access is needed', () => {
  assert.ok(fs.existsSync('scripts/fetch-model.mjs'), 'the fetch script ships');
  const script = fs.readFileSync('scripts/fetch-model.mjs', 'utf8');
  assert.match(script, /\.cache['"], ?['"]waffle-ai/, 'it writes to the gitignored cache dir');
  assert.match(script, /huggingface\.co/, 'and reads from Hugging Face');
  assert.match(script, /truncated/, 'a short download is rejected rather than kept');
  assert.match(script, /models\.json/, 'it records what it fetched');
  assert.match(script, /--all-small/, 'every small model can be fetched at once');
  // A misspelled model id is not a network problem; claiming otherwise would
  // send someone chasing a firewall that is fine.
  assert.match(script, /looksLikeNetwork/, 'the network hint is conditional on the failure actually looking like one');
  assert.match(script, /process\.exitCode = failed\.length \? 1 : 0/, 'it exits non-zero so CI and scripts can tell');
  assert.match(script, /!\/-\\d\{5\}-of-\\d\{5\}\\.gguf\$/, 'sharded repos are skipped: one local path cannot serve them');

  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts.models, 'node scripts/fetch-model.mjs', 'npm run models');
  assert.match(pkg.scripts['models:all'], /--all-small/, 'npm run models:all');

  // .cache/ must stay out of git: weights are not source code.
  const ignore = fs.readFileSync('.gitignore', 'utf8');
  assert.match(ignore, /^\.cache\/$/m, '.cache/ is gitignored');

  // The production build serves whatever was fetched at the same path the dev
  // server does, under a budget that respects the Pages size cap.
  const vite = fs.readFileSync('vite.config.js', 'utf8');
  assert.match(vite, /dist\/api\/waffle-ai\/gguf/, 'the build emits models to the served path');
  assert.match(vite, /SELF_HOST_TOTAL_MAX = 400 \* 1024 \*\* 2/, 'with an explicit total budget');
  assert.match(vite, /\.sort\(\(a, b\) => a\.size - b\.size\)/, 'smallest first, so a tight budget still yields a working model');
  assert.match(vite, /would exceed the/, 'and says so when it skips one');
});

test('the dev route and the client agree on the model path', () => {
  const vite = fs.readFileSync('vite.config.js', 'utf8');
  const client = fs.readFileSync('waffle-browser-ai.js', 'utf8');
  assert.match(vite, /'\/api\/waffle-ai\/gguf\/', ggufRoot/, 'dev serves the cache dir at /api/waffle-ai/gguf/');
  assert.match(client, /resolveAssetUrl\(`api\/waffle-ai\/gguf\/\$\{ggufFile\}`\)/,
    'the client asks for the same relative path, so it works from a Pages sub-path');
  assert.match(client, /loadModelFromUrl\(localGgufUrl/, 'and loads it with no Hugging Face involved');
  assert.match(client, /method: 'HEAD'/, 'it probes before committing to the local file');
});
