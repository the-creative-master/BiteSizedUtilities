// Wllama 4, and the fit check that was silently wrong before it.
//
// The report that started this was a real one, from a HarmonyOS tablet running
// Chrome inside a virtual environment:
//
//   WebGPU adapter: Maleoon 910 (verified, no FP16 -> CPU offload)
//   WASM: SIMD yes, threads no, heap budget ~2048 MB
//   llama.cpp WebGPU blocked (no FP16) -> CPU
//
// A 2400 MB model was picked, nothing was said, and it hung.
//
// Both numbers in that quote are the report exactly as it printed then. The
// budget reads 2.6 GB on that device now, and the bare "no FP16" is gone: the
// silicon does FP16, and what was measured is that this browser does not expose
// it through WebGPU. tests/adapter-facts.test.js holds that wording and the
// adapter facts that go with it. Two of those lines
// contradict each other and the code believed both: the adapter exists, so the
// budget was computed as though the weights would live in GPU memory and the
// heap only had to hold scratch; and the adapter has no shader-f16, so
// llama.cpp could not use it and the weights were going into that heap after
// all. The same contradiction suppressed the one warning that would have
// explained the hang, because every guard read "unless the GPU can take it" as
// "an adapter exists".
//
// These tests hold the distinction, the corrected arithmetic on the numbers
// that device actually reported, and the v4 facts the upgrade rests on.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { estimateWasmBudgetBytes, TEXT_MODELS } from '../waffle-browser-ai.js';

const MB = 1024 ** 2;
const GB = 1024 ** 3;
const mb = bytes => Math.round(bytes / MB);

const browserSrc = fs.readFileSync('waffle-browser-ai.js', 'utf8');
const aiSrc = fs.readFileSync('waffle-ai.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

/* ------------------------- the device that reported it ------------------------- */

// What the tablet said about itself: 8 GB of RAM, an adapter that verified, and
// no FP16 on it.
const reported = { hasWebGPU: true, deviceMemoryGB: 8 };
// The model that was picked. Its ceiling is arithmetic, not a measurement, and
// the release notes say so — but it is the number the fit check compares.
const gemma = TEXT_MODELS.find(m => m.id === 'gemma2-2b');

test('the model at the centre of this is on the table with the ceiling it was given', () => {
  assert.ok(gemma, 'gemma2-2b is in TEXT_MODELS');
  assert.equal(gemma.ggufMB, 2400, 'the heaviest file on any menu here');
});

test('an adapter that exists but cannot be used is not a GPU that holds the weights', () => {
  const wrong = estimateWasmBudgetBytes(reported);
  const right = estimateWasmBudgetBytes({ ...reported, gpuHoldsWeights: false });

  assert.equal(wrong, 2 * GB, 'the legacy branch: heap only holds scratch');
  assert.equal(mb(right), 2662, 'the CPU branch on 8 GB of RAM');
  assert.ok(right > wrong, 'the honest budget for this device is the larger one');
});

test('the 2400 MB model did not fit the wrong budget and does fit the right one', () => {
  const need = gemma.ggufMB * MB;
  assert.ok(need > estimateWasmBudgetBytes(reported),
    'against the GPU-branch budget it does not fit — which is where it hung');
  assert.ok(need <= estimateWasmBudgetBytes({ ...reported, gpuHoldsWeights: false }),
    'against the CPU-branch budget it fits, so it is attempted instead of refused');
});

test('on a memory-tight tablet the same model still does not fit, and that is correct', () => {
  // The fix is not "make the number bigger". A phone or tablet reaps a tab whose
  // heap grows into the system's way, so the tight branch stays tight — and now
  // the refusal it produces is a sentence rather than a hang.
  const tight = estimateWasmBudgetBytes({ ...reported, gpuHoldsWeights: false, memoryTightPlatform: true });
  assert.equal(mb(tight), 1843);
  assert.ok(gemma.ggufMB * MB > tight, 'a 2400 MB model does not fit in 1843 MB');
  assert.ok(tight < estimateWasmBudgetBytes(reported),
    'and it is smaller than the budget the wrong branch was handing this device');
});

test('gpuHoldsWeights is the deciding parameter, in both directions', () => {
  assert.equal(estimateWasmBudgetBytes({ hasWebGPU: false, gpuHoldsWeights: true, deviceMemoryGB: 8 }), 2 * GB,
    'told the GPU will hold them, it budgets for scratch even with no adapter reported');
  assert.equal(estimateWasmBudgetBytes({ hasWebGPU: true, gpuHoldsWeights: false, deviceMemoryGB: 8 }),
    estimateWasmBudgetBytes({ hasWebGPU: false, deviceMemoryGB: 8 }),
    'told it will not, an existing adapter changes nothing');
});

test('a caller that only knows an adapter exists still gets the old assumption', () => {
  // tests/ai-huawei.test.js pins this too. It is kept deliberately: the
  // parameter is optional, so an older or lazier caller must not silently move
  // to a different budget. Only the diagnostics, which actually established the
  // fact, pass it.
  assert.equal(estimateWasmBudgetBytes({ hasWebGPU: true, memoryTightPlatform: true }), 2 * GB);
});

/* ------------------------------ the wiring, pinned ------------------------------ */

test('the diagnostics pass the fact they established, not the adapter they found', () => {
  assert.match(browserSrc, /const wllamaGpuSafe = Boolean\(hasWebGPU && hasF16\);/,
    'shader-f16 is still what makes the GPU usable for llama.cpp');
  assert.match(browserSrc, /estimateWasmBudgetBytes\(\{[^}]*gpuHoldsWeights: wllamaGpuSafe[^}]*\}\)/,
    'and it is what the budget is computed from');
  assert.match(browserSrc, /const onGpu = gpuHoldsWeights \?\? Boolean\(hasWebGPU\);/,
    'with the legacy fallback spelled as a fallback');
});

test('the warning fires on the device that needed it, and names both numbers', () => {
  assert.match(aiSrc, /const gpuHoldsWeights = wllamaGpuOk;/,
    'the chat derives it from the runtime that will actually run the model');
  assert.match(aiSrc, /if \(!fitsOnCpu && !gpuHoldsWeights && !hasImages\) \{/,
    'the warning is gated on the GPU it can use');
  assert.ok(!/if \(!fitsOnCpu && !gpuOk && !hasImages\)/.test(aiSrc),
    'and not on the adapter that merely exists — that suppression was the silent hang');
  assert.match(aiSrc, /llama\.cpp needs FP16 and this browser does not expose it through WebGPU/,
    'attributed to the browser, which is the layer that was actually measured');
  // Both numbers appear *before* the phrase that names the heap, so the window
  // has to start upstream of it — and indexOf takes a start, because "trying a
  // smaller quant" is the kind of phrase that appears more than once in a file.
  const heap = aiSrc.indexOf('in its WASM heap');
  assert.ok(heap > 0);
  const detail = aiSrc.slice(Math.max(0, heap - 400), aiSrc.indexOf('trying a smaller quant', heap));
  assert.match(detail, /estBytes/, 'the model size is in the sentence');
  assert.match(detail, /budgetBytes/, 'and so is the budget');
});

test('gpuOk survives for the path that really is decided by an adapter existing', () => {
  // ONNX has its own WebGPU execution provider and its own requirements; the
  // blanket replacement of gpuOk would have been wrong there.
  assert.match(aiSrc, /const gpuOk = Boolean\(diag\.hasWebGPU\);/);
  assert.match(aiSrc, /if \(dev === 'wasm' && !fitsOnCpu && !gpuOk\) return;/,
    'dropping CPU ONNX still depends on whether a GPU path exists at all');
});

test('v4 RPC workers are refused where they cannot start, rather than left to hang', () => {
  assert.match(browserSrc, /\.\.\.\(diag\?\.canThread \? \{\} : \{ rpc_workers: 0 \}\)/);
  assert.match(browserSrc, /const canThread = isCrossOriginIsolated && hasSharedArrayBuffer;/,
    'keyed on the thing RPC workers actually need, not a guess about the device');
});

test('nothing on the menu needs those workers today, so the guard is a guard', () => {
  // v4 splits a model whose CPU part exceeds one wasm instance across RPC
  // workers. One instance is 4 GB. Every ceiling on this menu is below it, so
  // the guard never fires on a real pick — which is what makes it safe to add.
  for (const m of TEXT_MODELS) {
    assert.ok((m.ggufMB || 0) * MB < 4 * GB, `${m.id} stays inside one wasm instance`);
  }
});

test('a start from the on-device cache still announces itself, because v4 gives no progress there', () => {
  // loadModel() takes only LoadModelParams in v3.13 and in v4 alike, so the
  // progressCallback we pass on that path has never been read. The status line
  // before the call is the only thing the visitor gets, and it has to stay.
  // It lives in the loader module, not the chat orchestrator.
  const i = browserSrc.indexOf('loadModel(hit, loadParams)');
  assert.ok(i > 0, 'the cache path calls loadModel(hit, …)');
  const before = browserSrc.slice(Math.max(0, i - 700), i);
  assert.match(before, /onStatus\?\.\(/, 'a status is emitted before the call');
  assert.match(before, /on-device cache/, 'and it says the start is from cache');
});

/* -------------------------------- the upgrade -------------------------------- */

test('both Wllama packages are on v4, and the caret is what put them there', () => {
  assert.equal(pkg.dependencies['@wllama/wllama'], '^4.0.0');
  assert.equal(pkg.dependencies['@wllama/wllama-compat'], '^4.0.0');
  const installed = JSON.parse(fs.readFileSync('node_modules/@wllama/wllama/package.json', 'utf8'));
  const compat = JSON.parse(fs.readFileSync('node_modules/@wllama/wllama-compat/package.json', 'utf8'));
  assert.ok(Number(installed.version.split('.')[0]) >= 4, `resolved ${installed.version}`);
  assert.equal(compat.version, installed.version, 'the compat build tracks the main one');
});

test('v4 is really loaded, by a marker v3.13 does not have', async () => {
  const m = await import('@wllama/wllama');
  assert.ok(m.DOWNLOAD_CONFIG, 'DOWNLOAD_CONFIG arrived with the download-in-parts work');
  assert.equal(m.DOWNLOAD_CONFIG.partsMinSize, 64 * MB,
    'a file of 64 MB or more downloads over several connections');
  assert.equal(m.DOWNLOAD_CONFIG.savePrefixEvery, 256 * MB,
    'and progress is written every 256 MB, which is the granularity a resumed download restarts from');
  for (const sym of ['Wllama', 'ModelManager', 'CacheManager']) {
    assert.equal(typeof m[sym], 'function', `${sym} is still exported — we construct all three`);
  }
});

test('the published layout the build copies did not move', () => {
  // vite.config.js copies these two directories into dist/. v4 kept both, which
  // is why the upgrade needed no build change — asserted here because "it built
  // once on my machine" is not a reason.
  assert.ok(fs.existsSync('node_modules/@wllama/wllama/esm/wasm/wllama.wasm'), 'main wasm');
  assert.ok(fs.existsSync('node_modules/@wllama/wllama-compat/wasm/wllama.js'), 'compat glue');
  assert.ok(fs.existsSync('node_modules/@wllama/wllama-compat/wasm/wllama.wasm'), 'compat wasm');
  const vite = fs.readFileSync('vite.config.js', 'utf8');
  assert.match(vite, /@wllama\/wllama\/esm\/wasm/, 'still pointed at the main build');
  assert.match(vite, /@wllama\/wllama-compat\/wasm/, 'and at the compat one');
});

test('what v4 does not fix is still recorded as unfixed', () => {
  // The upgrade is not a claim that the GPU now works. shader-f16 is still
  // required by llama.cpp's WebGPU backend, so an adapter without it still runs
  // text on the CPU — the gate is right, it was only ever applied to the wrong
  // number.
  assert.match(browserSrc, /ngxson\/wllama#241/, 'the reason for the gate is still cited');
  assert.match(browserSrc, /hasF16 = Boolean\(adapter\.features\?\.has\('shader-f16'\)\)/,
    'and FP16 is still detected from the adapter itself');
});
