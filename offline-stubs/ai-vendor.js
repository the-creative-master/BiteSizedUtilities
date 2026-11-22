/**
 * What `@huggingface/transformers`, `@wllama/wllama` and `onnxruntime-web` are
 * replaced with in the single-file offline build. See vite.offline.config.js.
 *
 * Those three packages are the reason the alias exists at all. onnxruntime-web
 * embeds its WASM binaries in its own JavaScript as base64 data URLs — 179 MB of
 * them across the variants and the copy nested under transformers.js — and
 * `inlineDynamicImports`, which an iife build requires, puts every dynamic
 * import into the one chunk. The first offline build measured 190 MB because of
 * exactly that.
 *
 * The guards in waffle-browser-ai.js and waffle-image-gen.js are what make the
 * app refuse politely instead of calling into nothing. This file is the
 * guarantee behind them: a guard that is missed, or added later without anyone
 * remembering, costs 179 MB rather than a confusing undefined.
 */
const REASON =
  'The single-file offline build ships no AI engine. Its weights are fetched and its runtimes are WASM and workers, and a page opened from a folder can do neither.';

/** Every property access and every call is a refusal that says why. */
export default new Proxy(function offlineVendorStub() { throw new Error(REASON); }, {
  get(_target, prop) {
    if (prop === 'then') return undefined; // never look like a promise to an awaiting caller
    throw new Error(`${REASON} (asked for "${String(prop)}")`);
  },
  apply() {
    throw new Error(REASON);
  }
});

export const __offlineVendorStub = true;
