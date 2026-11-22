/**
 * Which build of the kitchen this page is.
 *
 * There are exactly two, and they are the same app: `index.html` is the public
 * kitchen, and `backup.html` sets `data-backup="1"` on <html> to switch on the
 * parts that are not ready for everyone yet (Waffle AI, the AI panels in
 * Settings, and the tools that are still being worked on).
 *
 * The flag lives in its own module so anything can ask — the changelog, the art
 * studio, the AI gate — without importing the AI stack and without a cycle.
 * It is page-scoped on purpose and never stored: the public kitchen cannot
 * inherit the extra build from a stale localStorage value.
 */
export function isBackupBuild(doc = (typeof document === 'undefined' ? undefined : document)) {
  return doc?.documentElement?.dataset?.backup === '1';
}

/** True on the public kitchen, false on the backup page. */
export function isPublicBuild(doc) {
  return !isBackupBuild(doc);
}

/**
 * True only in the single-file offline build (`offline.html`, made by
 * vite.offline.config.js and downloaded from the backup kitchen).
 *
 * That build is one HTML document on somebody's disk, opened with file://, and
 * three things are impossible from there: fetching a model weight, starting a
 * worker, and loading an ES module. So anything that would try has to say so
 * instead — and saying so has to happen *before* the import, because the whole
 * point of the flag is that the AI engines are never bundled into that file at
 * all. A guard placed after `await import()` would ship 3 MB of WASM glue to
 * throw it away a line later.
 *
 * It is a bare identifier rather than `import.meta.env.WAFFLE_OFFLINE` on
 * purpose. Vite's `define` replaces it with `true` or `false`, Rollup folds
 * `if (OFFLINE_BUILD)` away, and the guarded `await import()` goes with it —
 * which is the entire mechanism that keeps the ONNX and WLlama stacks out of
 * the single-file build. A function call would not fold as reliably, and a
 * guard that survives to runtime would bundle 3 MB and then refuse to use it.
 * `globalThis` keeps it safe to import in Node, where nothing defines it.
 */
// One declaration, and the exported name is the declaration. It was two (`const
// OFFLINE_BUILD = …` then `export const OFFLINE_BUILD_FLAG = OFFLINE_BUILD`) and
// Rollup emitted the alias *above* the thing it aliases in the flattened iife
// bundle, so the kitchen died on `Cannot access 'OFFLINE_BUILD' before
// initialization` — a temporal dead zone of my own making, caught by booting the
// built file in jsdom at a file: URL rather than by reading the source.
//
// `globalThis.` and not a bare identifier for two reasons: `define` replaces the
// whole member expression with a literal, so this folds to `true === true` or
// `false === true`; and Node — where every test imports this module — reads it as
// `undefined === true` instead of throwing a ReferenceError at an undeclared name.
export const OFFLINE_BUILD_FLAG = globalThis.__WAFFLE_OFFLINE__ === true;

/** True in the single-file build that has no network, no workers and no modules. */
export function isOfflineBuild() {
  return OFFLINE_BUILD_FLAG;
}

/** What the offline build says instead of trying something a file:// page cannot do. */
export const OFFLINE_BUILD_REASON =
  'This is the single-file offline build: it is one HTML document on your disk, and a page opened from a folder cannot fetch model weights, start a worker, or load another file as a module. The tools all work. For Waffle AI, CodeHub and the games, open the site over http instead.';
