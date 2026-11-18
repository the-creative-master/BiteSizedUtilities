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
