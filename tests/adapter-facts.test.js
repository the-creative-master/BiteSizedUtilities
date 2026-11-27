// What the kitchen records about a WebGPU adapter, and who it blames for a
// missing feature.
//
// A HarmonyOS tablet reported "no FP16" and sent chat to the CPU. That is a true
// statement about the browser and an unverifiable one about the GPU: the
// Maleoon 910 is documented as doing FP16/FP32 mixed precision, and mobile
// drivers of that generation expose Vulkan shaderFloat16 and OpenCL cl_khr_fp16
// as a matter of course. Whether Chrome's Dawn surfaces it as the WebGPU
// `shader-f16` feature is a separate question with a separate answer, and it
// depends on which backend Dawn picked — native Vulkan, or GLES/ANGLE, or a
// translated adapter inside a virtual environment.
//
// One boolean cannot tell those apart, and they have opposite conclusions: a
// translated adapter is a dead end, while a complete adapter missing one
// feature is a browser decision that might be flippable. So the whole feature
// set and the limits that say whether this is real hardware are recorded, and
// the wording says which layer was measured.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { detectDeviceDiagnostics, clearDeclaredOS } from '../waffle-browser-ai.js';

const browserSrc = fs.readFileSync('waffle-browser-ai.js', 'utf8');
const aiSrc = fs.readFileSync('waffle-ai.js', 'utf8');
const appSrc = fs.readFileSync('app.js', 'utf8');

/** Drive one fake adapter through the real diagnostics, then clean up. */
async function diagnose(adapter) {
  if (adapter) {
    Object.defineProperty(globalThis.navigator, 'gpu', {
      value: { requestAdapter: async () => adapter },
      configurable: true
    });
  }
  clearDeclaredOS();               // the module caches; this is the reset it offers
  try {
    return await detectDeviceDiagnostics();
  } finally {
    delete globalThis.navigator?.gpu;
    clearDeclaredOS();
  }
}

const info = { description: 'Maleoon 910' };
// What a translated or software adapter tends to look like: nothing optional,
// and limits too small to be real hardware.
const bare = {
  info,
  features: new Set(),
  limits: { maxBufferSize: 256 * 1024 ** 2, maxStorageBufferBindingSize: 128 * 1024 ** 2, maxComputeWorkgroupSizeX: 256, maxBindGroups: 4, maxTextureDimension2D: 8192 }
};
// What real hardware with one feature withheld looks like: a full set, and
// limits at the sizes the image engine already requires.
const complete = {
  info,
  features: new Set(['subgroup', 'texture-compression-astc', 'float32-filterable', 'rg11b10ufloat-renderable']),
  limits: { maxBufferSize: 4 * 1024 ** 3, maxStorageBufferBindingSize: 2 * 1024 ** 3, maxComputeWorkgroupSizeX: 1024, maxBindGroups: 8, maxTextureDimension2D: 16384 }
};

test('two adapters that both lack FP16 are recorded as the different situations they are', async () => {
  const a = await diagnose(bare);
  const b = await diagnose(complete);

  // The old boolean said the same thing about both, and that was the problem.
  assert.equal(a.hasF16, false);
  assert.equal(b.hasF16, false);
  assert.equal(a.wllamaGpuSafe, false, 'neither can run llama.cpp on the GPU');
  assert.equal(b.wllamaGpuSafe, false);
  assert.equal(a.adapterName, b.adapterName, 'and both even name the same GPU');

  // The new facts do not.
  assert.deepEqual(a.adapterFeatures, [], 'a bare adapter reports no optional features');
  assert.equal(b.adapterFeatures.length, 4, 'a real one reports the rest of them');
  assert.ok(b.adapterFeatures.includes('subgroup'));
  assert.ok(a.adapterLimits.maxBufferSize < b.adapterLimits.maxBufferSize,
    'and the limits separate a shim from hardware');
  assert.notEqual(a.adapterFactLine, b.adapterFactLine,
    'so the one-line summary a visitor pastes is different for each');
});

test('the compact summary is a diagnosis, not a restatement of the boolean', async () => {
  const d = await diagnose(complete);
  assert.match(d.adapterFactLine, /^WebGPU: 4 features, no FP16, buffer 4\.0 GB, storage buffer 2\.0 GB$/);
  const none = await diagnose(null);
  assert.equal(none.adapterFactLine, null, 'with no adapter there is nothing to summarise');
  assert.equal(none.hasWebGPU, false);
  assert.deepEqual(none.adapterFeatures, []);
  assert.equal(none.adapterLimits, null);
});

test('the features are sorted, so two runs of the same device report the same string', async () => {
  const shuffled = { info, features: new Set(['float32-filterable', 'subgroup', 'rg11b10ufloat-renderable', 'texture-compression-astc']), limits: complete.limits };
  const d = await diagnose(shuffled);
  assert.deepEqual(d.adapterFeatures, [...complete.features].sort(),
    'a Set iterates in insertion order, and a report that changes with insertion order cannot be compared');
});

test('an adapter that reports nothing at all does not take the diagnostics with it', async () => {
  // ai-image-engine.test.js already fakes `{ features: new Set([...]), limits: {} }`;
  // a browser mid-implementation can be sparser than that.
  const d = await diagnose({ info: {}, features: undefined, limits: undefined });
  assert.equal(d.hasWebGPU, true, 'the adapter was found');
  assert.equal(d.hasF16, false);
  assert.deepEqual(d.adapterFeatures, []);
  assert.equal(d.adapterLimits.maxBufferSize, null, 'missing limits read as unknown, not as zero');
  assert.match(d.adapterFactLine, /buffer \?/, 'and unknown is printed as unknown');
});

test('the note says which layer was measured, and only when it matters', async () => {
  const d = await diagnose(complete);
  assert.match(d.deviceNote, /FP16: not exposed through WebGPU here/);
  assert.match(d.deviceNote, /a fact about this browser, not about the GPU/,
    'the attribution is explicit, because the silicon may well have it');
  assert.match(d.deviceNote, /shaderFloat16/, 'the driver-level name is given');
  assert.match(d.deviceNote, /cl_khr_fp16/, 'and the OpenCL one');
  assert.match(d.deviceNote, /chrome:\/\/gpu/, 'with the one page that names the backend Dawn chose');
  assert.match(d.deviceNote, /WebGPU features \(4\): /);
  assert.match(d.deviceNote, /maxStorageBufferBindingSize 2\.0 GB/);

  const f16 = await diagnose({ info, features: new Set(['shader-f16']), limits: complete.limits });
  assert.equal(f16.hasF16, true);
  assert.equal(f16.wllamaGpuSafe, true);
  assert.ok(!/FP16: not exposed/.test(f16.deviceNote), 'a device that has it is not told it does not');
  assert.match(f16.deviceNote, /FP16 exposed/);

  const none = await diagnose(null);
  assert.match(none.deviceNote, /WebGPU: no adapter/);
  assert.ok(!/FP16: not exposed/.test(none.deviceNote), 'and no adapter is a different sentence again');
});

test('both copies of the report blame the browser, in the same words', () => {
  // The device report is printed in two places. Duplicated wording is how the
  // two came to disagree about what the heap budget meant, so the sentence is
  // asserted identical rather than merely similar.
  const line = /d\.wllamaGpuSafe \? 'llama\.cpp WebGPU safe' : 'llama\.cpp WebGPU blocked \(this browser exposes no FP16\) \u2192 CPU',/;
  assert.match(appSrc, line, 'Settings');
  assert.match(aiSrc, line, 'and the AI panel');
  assert.ok(!/WebGPU blocked \(no FP16\)/.test(appSrc + aiSrc + browserSrc),
    'the bare "no FP16" is gone from every report, because it reads as a verdict on the GPU');
});

test('the compact line is formatted once and printed twice', () => {
  assert.match(browserSrc, /const adapterFactLine = hasWebGPU/, 'built where the facts are');
  for (const [name, src] of [['app.js', appSrc], ['waffle-ai.js', aiSrc]]) {
    assert.match(src, /d\.adapterFactLine \|\| null,/, `${name} prints it`);
    assert.ok(!/adapterFeatures\.join/.test(src), `${name} does not re-format it`);
    assert.ok(!/adapterLimits\.max/.test(src), `${name} and does not reach into the limits either`);
  }
});

test('what decides GPU safety did not move while the wording was being fixed', () => {
  // This is a reporting change. If the gate moved with it, that is a different
  // release and a different conversation.
  assert.match(browserSrc, /hasF16 = Boolean\(adapter\.features\?\.has\('shader-f16'\)\)/);
  assert.match(browserSrc, /const wllamaGpuSafe = Boolean\(hasWebGPU && hasF16\);/);
  assert.match(aiSrc, /const gpuHoldsWeights = wllamaGpuOk;/);
});

test('the fit warning carries the same attribution', () => {
  assert.match(aiSrc, /llama\.cpp needs FP16 and this browser does not expose it through WebGPU/);
  assert.ok(!/this adapter does not have it/.test(aiSrc), 'the old wording claimed something nobody measured');
});
