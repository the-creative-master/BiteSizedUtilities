/**
 * What `folder-game-catalog.js` resolves to in the served build. See
 * vite.config.js and the comment on the real file.
 *
 * `null` means "not bundled, go and fetch it", which is what games.js does. The
 * served site keeps its 32 KB lazy; only the folder build pays for it, because
 * only the folder build has no way to fetch anything.
 */
export default null;
