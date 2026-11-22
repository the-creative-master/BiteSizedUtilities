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
import { folderRefusal } from './offline-facts.js';

export function isBackupBuild(doc = (typeof document === 'undefined' ? undefined : document)) {
  return doc?.documentElement?.dataset?.backup === '1';
}

/** True on the public kitchen, false on the backup page. */
export function isPublicBuild(doc) {
  return !isBackupBuild(doc);
}

/**
 * True only in the folder build: the kitchen compiled as one classic script, so
 * that the offline zip's index.html opens into the kitchen when it is double-clicked
 * on somebody's disk.
 *
 * A browser refuses an ES module from a file: page, which is why the site's own
 * index.html cannot start that way and why this build exists. It refuses a worker
 * from one too, and it will not let such a page fetch anything — so the AI engines
 * cannot come along, and the code that would reach for them has to say so instead.
 *
 * The flag is a bare `globalThis` member rather than `import.meta.env.SOMETHING`
 * for two reasons. Vite's `define` replaces this exact expression with `true` or
 * `false`, Rollup folds `if (FOLDER_BUILD_FLAG)` away, and the guarded
 * `await import()` goes with it — which is the entire mechanism that keeps 179 MB
 * of base64 WASM out of the file. A guard that survived to runtime would bundle the
 * engines and then refuse to use them. And under Node, where every test imports this
 * module, an undeclared bare identifier would throw a ReferenceError while
 * `globalThis.X === true` simply reads false.
 *
 * One declaration, and the exported name is the declaration: when this was two
 * (`const X = …` then `export const Y = X`) Rollup emitted the alias above the thing
 * it aliases in the flattened bundle, and the kitchen died on a temporal dead zone
 * error before it rendered. Every line of source involved was correct.
 */
export const FOLDER_BUILD_FLAG = globalThis.__WAFFLE_FOLDER__ === true;

/** True in the build that runs from a folder: no network, no workers, no modules. */
export function isFolderBuild() {
  return FOLDER_BUILD_FLAG;
}

/**
 * What the folder build says instead of trying something a file: page cannot do.
 *
 * Written for a person who has just double-clicked index.html and wants to know why
 * one tool is refusing, so it says what still works and what to do about the rest
 * before it says anything about the mechanism.
 */
export const FOLDER_BUILD_REASON = folderRefusal();

