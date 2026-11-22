/**
 * The game catalog, carried inside the folder build.
 *
 * The served site fetches `games/catalog.json` when the games cupboard opens,
 * which keeps 32 KB out of the bundle for the 99% of visits that never look at a
 * game. A page opened off the disk cannot do that: `file://` gives the page an
 * opaque origin, so a fetch of the JSON sitting right beside it is refused, and
 * the cupboard comes up empty in the one place where an empty cupboard is most
 * confusing — an offline folder with all 51 games actually in it.
 *
 * So the folder build imports the catalog statically and it lands inside
 * `kitchen.js`. The served build never reaches this file: vite.config.js aliases
 * it to folder-stubs/no-catalog.js, which is `null`, and games.js then takes the
 * lazy fetch it always took.
 *
 * Two builds, one source of truth: this is the same catalog.json the site serves,
 * re-exported, not a copy of it.
 */
export { default } from './games/catalog.json';
