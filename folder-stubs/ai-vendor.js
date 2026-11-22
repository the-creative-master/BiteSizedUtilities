/**
 * What `@huggingface/transformers`, `@wllama/wllama` and `onnxruntime-web`
 * resolve to in the folder build. See vite.classic.config.js.
 *
 * The folder build is the kitchen as a *classic* script, which is the one kind of
 * script a browser will run from a page opened off the disk. It is what makes the
 * offline zip's index.html actually open into the kitchen instead of explaining
 * itself.
 *
 * Those three packages cannot come along. onnxruntime-web embeds its WASM binaries
 * in its own JavaScript as base64 data URLs — 179 MB of them across the variants
 * and the copy nested under transformers.js — and `inlineDynamicImports`, which an
 * iife build requires, puts every dynamic import into the one chunk. The first
 * time this was built without the alias, the artifact came to 190 MB.
 *
 * The guards in waffle-browser-ai.js and waffle-image-gen.js are what make the app
 * say something useful instead of calling into nothing. This file is the guarantee
 * behind them: a guard that is missed, or an import site added later without
 * anyone remembering, costs 179 MB rather than a confusing undefined.
 */
const REASON =
  'The folder build ships no AI engine. Its weights are downloaded and its runtimes are WASM and workers, and a page opened straight off the disk can do neither.';

/** Every property access and every call is a refusal that says why. */
export default new Proxy(function folderVendorStub() { throw new Error(REASON); }, {
  get(_target, prop) {
    if (prop === 'then') return undefined; // never look like a promise to an awaiting caller
    throw new Error(`${REASON} (asked for "${String(prop)}")`);
  },
  apply() {
    throw new Error(REASON);
  }
});

export const __folderVendorStub = true;
