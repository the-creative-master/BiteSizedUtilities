/**
 * What the offline folder can and cannot run, in one place.
 *
 * This list used to be written out by hand in five places: START-HERE.html,
 * README.txt, the release notes, the folder build's own refusal message and the
 * changelog entry. Five copies of one fact drifted inside a single working session —
 * one of them claimed all 115 utilities work off the disk, when 15 of them ask Waffle
 * AI to do the work and cannot. So the counts live here, the packer measures the same
 * source, and everything else quotes the measurement.
 *
 * Two guarantees keep this honest, and neither is a person reading it:
 *   - `scripts/folder-census.mjs` counts the utilities and the games from the source
 *     that was just built, and `scripts/make-offline-zip.mjs` refuses to pack an
 *     archive whose documents would disagree with these numbers;
 *   - `tests/offline-zip.test.js` runs the same census and pins these literals to it,
 *     so the folder build's refusal text cannot drift from the shipped documents
 *     either. The refusal is compiled into the bundle before any archive is packed,
 *     which is why the numbers here are literals at all.
 *
 * This module is bundled into the app, so it holds no scanning patterns: the census
 * reads the source of everything a cupboard imports, and a module full of the strings
 * `fetch(` and `new Worker(` would be counted as needing a server by its own rules.
 */

/**
 * Counts that are properties of the source, and so are written down once — and then
 * checked, as above.
 */
export const FOLDER_FACTS = {
  /** Every utility on the kitchen's shelves. */
  utilitiesTotal: 115,
  /**
   * Utilities that work from a folder. Two groups, measured separately:
   *   - the six cupboards whose modules contain no `fetch`, no `XMLHttpRequest`, no
   *     worker, no WASM and no AI import — maths 10, science 15, text 15, art 15,
   *     music 15, video 15 = 85;
   *   - the ten coding tools that do their work in the page, out of that cupboard's
   *     fifteen.
   * The old figure was 85, which quietly wrote off ten tools that work.
   */
  utilitiesOffline: 95,
  /** The cupboards that work in full, and so need no per-tool caveat. */
  offlineCupboards: ['Math & Numbers', 'Science & Physics', 'Text & Files', 'Art & Coloring', 'Music & Composing', 'Videography & Editing'],
  /** Every tool in English & Languages asks an AI: 14 ask Waffle AI, one calls a translation API. */
  englishTools: 15,
  /** The coding tools that run your code in a worker. The cupboard's other ten are counted above. */
  codeBlocked: ['CodeHub', 'Regex Tester', 'CSS Minifier', 'JavaScript Formatter', 'SQL Formatter']
};

/**
 * The sentence the folder build uses when a tool asks it for something a page off the
 * disk cannot do. Built from the same counts as the documents, so the refusal a person
 * reads in the kitchen and the table they read in START-HERE.html cannot disagree with
 * each other.
 *
 * It says what still works before it says what does not, because somebody who opens a
 * tool and gets a refusal needs to know the folder is not broken. It used to end by
 * telling them to open a terminal and serve the folder over http, which is a
 * precondition, not an answer — the site's own offline copy needs neither a server nor
 * an install, and that is what it offers instead.
 *
 * @param {{ playable?: number, total?: number }} measured the cabinet counts, when the
 *   build knows them; the folder build is compiled before the archive is packed, so it
 *   quotes the game count only when it has one.
 */
export function folderRefusal(measured = {}) {
  const games = typeof measured.playable === 'number' && typeof measured.total === 'number'
    ? ` and ${measured.playable} of the ${measured.total} games`
    : '';
  return 'You opened this folder straight off the disk, and a browser will not let a page like that download a model: '
    + 'it cannot fetch a file, start a worker, or run the WASM the AI engines need. '
    + `The rest of the kitchen still works — the ${FOLDER_FACTS.utilitiesOffline} utilities that run in the page${games}. `
    + 'This one needs Waffle AI, so open the site online instead; that also needs no server and no install, '
    + 'because the site keeps its own offline copy after one visit. START-HERE.html in this folder explains both.';
}
