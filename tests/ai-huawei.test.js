// Huawei and HarmonyOS support: what the browser really is, what that means for
// the runtimes, and the honest answer about the NPU.
//
// Every user agent here is a real one — Huawei Browser on HarmonyOS NEXT, ArkWeb
// inside another app, the older Android-based Huawei Browser with HMS Core, a
// HarmonyOS TV — because a profile that is only tested against invented strings
// is a profile that guesses in the field.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  parsePlatformProfile,
  platformLabelFor,
  deviceModelFrom,
  chromiumForArkWeb,
  gradeWebgpuAdapter,
  rankBrowserAttempts,
  resolveOnnxDevice,
  detectWasmSimd,
  detectWebNN,
  estimateWasmBudgetBytes,
  detectDeviceDiagnostics,
  describeModelSourceFacts,
  isWebnnRuntimeShipped,
  ANDROID_WEBGPU_CHROMIUM,
  AI_DISCLAIMER_TEXT
} from '../waffle-browser-ai.js';

/* ------------------------------ real user agents ------------------------------ */

const UA = {
  harmonyNextPhone: 'Mozilla/5.0 (Phone; OpenHarmony 6.1; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 ArkWeb/6.1.0.120 Mobile HuaweiBrowser/6.1.4.303',
  harmonyTabletArkWeb4: 'Mozilla/5.0 (Tablet; OpenHarmony 5.0; HUAWEI MatePad Pro 13.2 Build/HUAWEI) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36 ArkWeb/4.1.6.1',
  arkWebInsideLark: 'Mozilla/5.0 (Phone; OpenHarmony 6.1; VYG-AL30 Build/HUAWEI) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 ArkWeb/4.1.6.1 Mobile Lark/7.72.7 LarkLocale/zh_CN',
  huaweiAndroidOld: 'Mozilla/5.0 (Linux; Android 12; CTR-LX3; HMSCore 6.11.0.329) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.5735.196 HuaweiBrowser/16.0.9.302 Mobile Safari/537.36',
  huaweiBareEngineVersion: 'Mozilla/5.0 (Linux; Android 10; DNN-LX9; HMSCore 6.15.0.331) AppleWebKit/537.36 (KHTML, like Gecko) 141.0.7390.44 HuaweiBrowser/14.0.5.303 Mobile Safari/537.36',
  harmonyTv: 'Mozilla/5.0 (HarmonyOS 5.0; Harmony5.0) ArkWeb/5.0 (FengMing Kernel) HuaweiBrowser/30.0 HM5/5.0 DeviceType/TV',
  iPad: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  iPhone26: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1',
  windowsChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  pixelChrome144: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36'
};

test('HarmonyOS NEXT in Huawei Browser is read as HarmonyOS, not as Android', () => {
  const p = parsePlatformProfile(UA.harmonyNextPhone);
  assert.equal(p.platform, 'harmony');
  assert.equal(p.isHuawei, true);
  assert.equal(p.harmonyVersion, '6.1');
  assert.equal(p.arkWebVersion, '6.1.0.120');
  assert.equal(p.huaweiBrowserVersion, '6.1.4.303');
  assert.equal(p.chromiumMajor, 132);
  assert.equal(p.chromiumSource, 'user-agent', 'the Chrome token wins over the mapping');
  assert.equal(p.deviceType, 'phone');
});

test('a tablet ArkWeb user agent with no Chrome token still gets a Chromium baseline', () => {
  const p = parsePlatformProfile(UA.harmonyTabletArkWeb4);
  assert.equal(p.platform, 'harmony');
  assert.equal(p.chromiumMajor, 114, 'ArkWeb 4.1 is Chromium 114 by Huawei’s own mapping');
  assert.equal(p.chromiumSource, 'arkweb-mapping');
  assert.equal(p.deviceType, 'tablet');
  assert.equal(p.deviceModel, 'HUAWEI MatePad Pro 13.2');
  assert.match(platformLabelFor(p), /from the ArkWeb version/, 'and the label says where that number came from');
});

test('ArkWeb inside another app is still HarmonyOS, and its model code is read', () => {
  const p = parsePlatformProfile(UA.arkWebInsideLark);
  assert.equal(p.platform, 'harmony');
  assert.equal(p.chromiumMajor, 114);
  assert.equal(p.deviceModel, 'VYG-AL30');
  assert.equal(p.deviceType, 'phone');
  assert.equal(p.huaweiBrowserVersion, null, 'Lark is not Huawei Browser, and it is not called that');
});

test('the older Android-based Huawei Browser is its own platform', () => {
  const p = parsePlatformProfile(UA.huaweiAndroidOld);
  assert.equal(p.platform, 'huawei-android');
  assert.equal(p.isHuawei, true);
  assert.equal(p.hmsCoreVersion, '6.11.0.329');
  assert.equal(p.huaweiBrowserVersion, '16.0.9.302');
  assert.equal(p.chromiumMajor, 114);
  assert.equal(p.deviceModel, 'CTR-LX3');
  assert.equal(p.harmonyVersion, null);
});

test('a Huawei build that prints its engine version bare is still dated', () => {
  const p = parsePlatformProfile(UA.huaweiBareEngineVersion);
  assert.equal(p.chromiumMajor, 141, 'the version in front of HuaweiBrowser/ is the Chromium baseline');
  assert.equal(p.deviceModel, 'DNN-LX9');
  assert.equal(p.platform, 'huawei-android');
});

test('a HarmonyOS TV is a TV, and its platform token is not mistaken for a model', () => {
  const p = parsePlatformProfile(UA.harmonyTv);
  assert.equal(p.platform, 'harmony');
  assert.equal(p.deviceType, 'tv');
  assert.equal(p.chromiumMajor, 114, 'ArkWeb 5.0 sits in the 4.1–5.1 band');
  assert.equal(deviceModelFrom(UA.harmonyTv), null, '"Harmony5.0" is a platform token, not a device');
});

test('Apple, Windows and modern Android are left alone', () => {
  assert.equal(parsePlatformProfile(UA.iPad).platform, 'ios');
  assert.equal(parsePlatformProfile(UA.iPad).deviceType, 'tablet');
  assert.equal(parsePlatformProfile(UA.iPhone26).deviceType, 'phone');
  assert.equal(parsePlatformProfile(UA.windowsChrome).platform, 'desktop');
  assert.equal(parsePlatformProfile(UA.windowsChrome).chromiumMajor, 141);
  const pixel = parsePlatformProfile(UA.pixelChrome144);
  assert.equal(pixel.platform, 'android');
  assert.equal(pixel.isHuawei, false);
  assert.equal(pixel.deviceModel, 'Pixel 9');
});

test('a user agent it cannot read is called unknown instead of guessed', () => {
  const p = parsePlatformProfile('');
  assert.equal(p.platform, 'unknown');
  assert.equal(p.isHuawei, false);
  assert.equal(p.chromiumMajor, null);
  assert.equal(p.deviceModel, null);
  assert.match(platformLabelFor(p), /Unknown platform/);
});

test('the ArkWeb to Chromium mapping follows Huawei’s documented bands', () => {
  assert.equal(chromiumForArkWeb('4.1.6.1'), 114);
  assert.equal(chromiumForArkWeb('5.0'), 114);
  assert.equal(chromiumForArkWeb('5.1.3'), 114);
  assert.equal(chromiumForArkWeb('6.0.0.130'), 132);
  assert.equal(chromiumForArkWeb('6.1.0.120'), 132);
  assert.equal(chromiumForArkWeb('7.0.0.1'), 144);
  assert.equal(chromiumForArkWeb('nonsense'), null);
  assert.equal(chromiumForArkWeb(null), null);
});

/* ------------------------------- WebGPU trust ------------------------------- */

test('an adapter is graded, and Android below Chromium 144 is not trusted', () => {
  assert.equal(ANDROID_WEBGPU_CHROMIUM, 144);
  const grade = (ua, hasWebGPU = true) => gradeWebgpuAdapter({ hasWebGPU, profile: parsePlatformProfile(ua) });

  assert.equal(grade(UA.harmonyNextPhone), 'suspect', 'HarmonyOS Chromium 132 with an adapter');
  assert.equal(grade(UA.harmonyTabletArkWeb4), 'suspect', 'Chromium 114 from the ArkWeb mapping');
  assert.equal(grade(UA.huaweiBareEngineVersion), 'suspect');
  assert.equal(grade(UA.pixelChrome144), 'verified', 'Android 144 really has WebGPU');
  assert.equal(grade(UA.windowsChrome), 'verified', 'desktop is graded on the adapter alone');
  assert.equal(grade(UA.iPad), 'verified');
  assert.equal(grade(UA.harmonyNextPhone, false), 'absent');
  assert.equal(grade('', true), 'verified', 'an unrecognised desktop-class agent is not penalised');
});

/* ------------------------------ runtime ordering ------------------------------ */

test('a suspect adapter is tried last, and a verified one first', () => {
  const suspect = rankBrowserAttempts({ hasWebGPU: true, wllamaGpuSafe: false, gpuPreferred: false });
  assert.deepEqual(suspect, ['wllama-cpu', 'onnx-wasm', 'onnx-webgpu'],
    'the CPU runtimes get their chance before a GPU that may hang the tab');

  const verified = rankBrowserAttempts({ hasWebGPU: true, wllamaGpuSafe: true, gpuPreferred: true });
  assert.deepEqual(verified, ['onnx-webgpu', 'wllama-gpu', 'wllama-cpu', 'onnx-wasm']);

  const none = rankBrowserAttempts({ hasWebGPU: false, wllamaGpuSafe: false, gpuPreferred: true });
  assert.deepEqual(none, ['wllama-cpu', 'onnx-wasm'], 'no GPU step is invented for a device without one');
});

test('an NPU goes first when the browser can actually reach one', () => {
  assert.deepEqual(
    rankBrowserAttempts({ hasWebGPU: false, webnnUsable: true }),
    ['onnx-npu', 'wllama-cpu', 'onnx-wasm']
  );
  assert.deepEqual(
    rankBrowserAttempts({ hasWebGPU: true, wllamaGpuSafe: true, gpuPreferred: true, webnnUsable: true })[0],
    'onnx-npu'
  );
  assert.ok(!rankBrowserAttempts({ hasWebGPU: true, webnnUsable: false }).includes('onnx-npu'),
    'and no NPU step appears where WebNN is missing — which is every phone and tablet today');
});

test('an explicit WebGPU choice overrides the device’s preference', () => {
  const forced = rankBrowserAttempts({ hasWebGPU: true, wllamaGpuSafe: true, gpuPreferred: false }, { gpuFirst: true });
  assert.deepEqual(forced, ['onnx-webgpu', 'wllama-gpu', 'wllama-cpu', 'onnx-wasm']);
});

test('a requested ONNX device this browser does not have falls back instead of failing', () => {
  assert.equal(resolveOnnxDevice({ hasWebGPU: false, webnnUsable: false }, 'webnn-npu'), 'wasm');
  assert.equal(resolveOnnxDevice({ hasWebGPU: false }, 'webgpu'), 'wasm');
  assert.equal(resolveOnnxDevice({ hasWebGPU: true, webnnUsable: true }, null), 'webnn-npu');
  assert.equal(resolveOnnxDevice({ hasWebGPU: true }, null), 'webgpu');
  assert.equal(resolveOnnxDevice({ hasWebGPU: true }, 'wasm'), 'wasm', 'an explicit CPU choice is honoured');
});

/* -------------------------------- capabilities -------------------------------- */

test('WASM SIMD is probed with a real module, not assumed', () => {
  assert.equal(typeof detectWasmSimd(), 'boolean');
  assert.equal(detectWasmSimd(), true, 'Node has SIMD, so a false here would mean the probe bytes are wrong');
});

test('WebNN is detected from navigator.ml and from nothing else', () => {
  assert.equal(detectWebNN({ ml: { createContext() {} } }), true);
  assert.equal(detectWebNN({ ml: {} }), false, 'an ML object with no createContext is not WebNN');
  assert.equal(detectWebNN({}), false);
  assert.equal(detectWebNN(null), false);
  assert.equal(detectWebNN(globalThis.navigator), false, 'and it is absent here, as it is on every phone browser');
});

test('the NPU runtime is not shipped by default, so webnnUsable stays false', () => {
  assert.equal(isWebnnRuntimeShipped(), false, 'WAFFLE_WEBNN is off in a normal build');
});

test('a phone or tablet keeps a wider memory margin than a desktop', () => {
  const MB = 1024 ** 2;
  const desktop = estimateWasmBudgetBytes({ deviceMemoryGB: 8 });
  const tight = estimateWasmBudgetBytes({ deviceMemoryGB: 8, memoryTightPlatform: true });
  assert.ok(tight < desktop, `${Math.round(tight / MB)} MB should be under ${Math.round(desktop / MB)} MB`);
  assert.ok(tight <= 1.8 * 1024 * MB, 'capped so a big reported memory cannot over-commit');
  const unknown = estimateWasmBudgetBytes({ memoryTightPlatform: true });
  assert.ok(unknown > 0.5 * 1024 * MB && unknown < tight, 'an unreported deviceMemory assumes less, not more');
  assert.equal(estimateWasmBudgetBytes({ hasWebGPU: true, memoryTightPlatform: true }), 2 * 1024 ** 3,
    'with a real GPU the weights do not live in the heap');
});

test('the diagnostics this environment produces carry the new fields', async () => {
  const d = await detectDeviceDiagnostics();
  assert.equal(typeof d.platformLabel, 'string');
  assert.equal(d.platform.platform, 'unknown', 'Node sends no browser agent');
  assert.equal(d.hasWebNN, false);
  assert.equal(d.webnnUsable, false);
  assert.equal(d.gpuTrustLevel, 'absent');
  assert.equal(d.gpuPreferred, true);
  assert.equal(d.hasWasmSimd, true);
  assert.match(d.npuNote, /WebNN/, 'the NPU situation is stated in words');
  assert.match(d.deviceNote, /NPU: /);
  assert.match(d.deviceNote, /WASM: SIMD yes, threads no/);
  assert.match(d.summaryLabel, /single-thread WASM/);
});

/* --------------------------------- the report --------------------------------- */

test('a failure report ends with the device it happened on', () => {
  const facts = {
    id: 'smollm2-135m',
    label: 'SmolLM2 135M',
    budgetBytes: 93 * 1024 ** 2,
    fetchedAt: new Date().toISOString(),
    platform: {
      label: 'HarmonyOS 6.1 · Huawei Browser 6.1.4.303 · ArkWeb 6.1.0.120 · Chromium 132',
      note: 'WebGPU: no adapter\nNPU: No WebNN here (navigator.ml is absent), so the NPU — the Kirin one included — cannot be reached from a web page at all.',
      platform: 'harmony',
      isHuawei: true,
      chromiumMajor: 132,
      hasWebGPU: false,
      gpuTrustLevel: 'absent',
      hasWebNN: false,
      webnnUsable: false,
      hasWasmSimd: true,
      canThread: false,
      wasmBudgetBytes: 1434 * 1024 ** 2
    },
    gguf: { repo: 'bartowski/SmolLM2-135M-Instruct-GGUF', status: 'ok', http: 200 },
    onnx: null,
    download: null,
    onnxDownload: null,
    deviceCache: null,
    selfHosted: null
  };
  const lines = describeModelSourceFacts(facts);
  const device = lines.find(l => l.startsWith('This device:'));
  assert.ok(device, 'the device line is printed');
  assert.match(device, /HarmonyOS 6\.1 · Huawei Browser 6\.1\.4\.303/);
  assert.match(device, /the Kirin one included/, 'and it says plainly that the NPU is out of reach');
  assert.ok(!device.includes('\n'), 'one line, not a block');
  assert.equal(lines[lines.length - 1], device, 'it closes the report');
});

test('the disclaimer names Huawei and HarmonyOS, and still warns about iOS and WebGPU', () => {
  assert.match(AI_DISCLAIMER_TEXT, /Huawei or HarmonyOS tablet/);
  assert.match(AI_DISCLAIMER_TEXT, /iOS 26/);
  assert.match(AI_DISCLAIMER_TEXT, /WebGPU/);
  assert.match(AI_DISCLAIMER_TEXT, /WebNN/, 'and it explains what the NPU would need');
  assert.match(AI_DISCLAIMER_TEXT, /tried last instead of first/, 'the ordering change is disclosed');
});

/* -------------------------------- the wiring -------------------------------- */

test('the AI panel shows the profile it recognised', () => {
  const src = fs.readFileSync('waffle-ai.js', 'utf8');
  assert.match(src, /id="waffle-ai-device-note"/, 'there is somewhere to show it');
  assert.match(src, /noteEl\.textContent = note/, 'and it is filled from deviceNote');
  assert.match(src, /diagEl\.title = deviceDiag\.deviceNote/, 'the pill carries it as a tooltip too');
});

test('the attempt chain is ranked by the device, not hard-coded', () => {
  const src = fs.readFileSync('waffle-ai.js', 'utf8');
  assert.match(src, /rankBrowserAttempts\(diag, opts\)/, 'the ranking helper decides the order');
  assert.match(src, /step === 'onnx-npu'/, 'an NPU step exists');
  assert.match(src, /pushBrowserChain\(\{ gpuFirst: true \}\)/, 'an explicit WebGPU choice still forces the GPU first');

  const autoBranch = src.slice(src.indexOf('// Auto fallback chain'), src.indexOf('if (!fitsOnCpu && !gpuOk && !hasImages)'));
  assert.ok(autoBranch.length > 300, 'the auto branch was captured');
  assert.ok(!autoBranch.includes("if (gpuOk) pushBrowser('webgpu')"),
    'the auto chain no longer hard-codes GPU first');
  assert.equal(autoBranch.split('pushBrowserChain()').length - 1, 3, 'all three auto branches are ranked');
});

test('the WebNN runtime ships only when the build asks for it', () => {
  const vite = fs.readFileSync('vite.config.js', 'utf8');
  assert.match(vite, /SHIP_WEBNN = process\.env\.WAFFLE_WEBNN === '1'/);
  assert.match(vite, /'import\.meta\.env\.WAFFLE_WEBNN': JSON\.stringify\(process\.env\.WAFFLE_WEBNN \|\| ''\)/,
    'the client can see the flag it was built with');
  assert.match(vite, /\\\.jspi/, 'the JSPI ONNX build is the one that carries the WebNN provider');
  assert.ok(vite.indexOf('SHIP_WEBNN ?') < vite.indexOf('const HASHED_ORT_ASSET'),
    'and the default build still copies only the runtimes it uses');
});
