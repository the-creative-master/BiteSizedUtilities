/**
 * The door to the backup kitchen.
 *
 * It used to be a gesture — a fast run of taps on Sir Waffle — which is a door
 * anybody can be told about, and anybody can stumble into while bouncing the
 * waffle wall. It is a string now, typed into Waffle AI, and the
 * page it opens is not on the server under its own name: the build ships it as
 * `DONTASKMEWHATTHATIS.txt`, ciphertext inside what looks like somebody's
 * obfuscated build junk, and `dist/backup.html` is deleted. Typing `/backup.html`
 * into the address bar gets a 404, so there is no URL to try.
 *
 * What happens when the string is typed:
 *   1. fetch the disguised file, resolved against the document so it works from a
 *      GitHub Pages sub-path;
 *   2. decode it with the passphrase as the key — the string you typed *is* the
 *      key, which is why the file is useless without it;
 *   3. hand the decoded page to the next load and reload;
 *   4. that load renames the address bar to `backup.html` and writes the page.
 *
 * Step 3 rather than mounting the page here is not a stylistic choice. Both
 * kitchens are built from the same entry, so `dist/index.html` and the decoded
 * page name the same `./assets/app-*.js`, and a document evaluates a module URL
 * once. Mounting into the live document would append a script the browser has
 * already evaluated and get nothing back — a correctly decoded, completely inert
 * page. A reload starts from an empty module map. `mountDecodedPage()` below is
 * the fallback for a browser that will not let us use sessionStorage at all, and
 * it defeats the module map with a query parameter instead; that costs the
 * duplicated document-level listeners this page already had, which is why it is
 * the fallback and not the plan.
 *
 * Step 4 is a rename in the address bar, not on the server: a browser cannot
 * rename a file on a static host, and claiming otherwise in the changelog would
 * be a lie. It does mean that reloading after that 404s, because there is no
 * `backup.html` on the host any more. The string has to be typed again.
 */
import {
  BACKUP_DOOR_FILE,
  BACKUP_DOOR_PAGE,
  BACKUP_DOOR_STASH,
  decodePayload,
  isBackupPassphrase
} from './backup-cipher.js';
import { isBackupBuild } from './build-mode.js';

/**
 * Is this text the door? Never true inside the backup kitchen itself, where
 * there is nothing to open and a second copy of the page would only confuse.
 */
export function backupDoorMatches(text, doc = typeof document === 'undefined' ? undefined : document) {
  return !isBackupBuild(doc) && isBackupPassphrase(text);
}

/**
 * Leave the decoded page where the next load's head script will find it.
 *
 * Read back after writing, because a full or private-mode sessionStorage can
 * accept a write and give nothing back: without the check the door would reload
 * into the public kitchen and look like it had simply ignored you.
 */
export function stashDecodedPage(html, win = typeof window === 'undefined' ? undefined : window) {
  try {
    win.sessionStorage.setItem(BACKUP_DOOR_STASH, html);
    return win.sessionStorage.getItem(BACKUP_DOOR_STASH) === html;
  } catch {
    return false;
  }
}

/** What the head script in `index.html` reads. Exported so a test can hold the two in step. */
export function readStashedPage(win = typeof window === 'undefined' ? undefined : window) {
  try {
    const html = win.sessionStorage.getItem(BACKUP_DOOR_STASH);
    if (html) win.sessionStorage.removeItem(BACKUP_DOOR_STASH);
    return html || null;
  } catch {
    return null;
  }
}

/**
 * Put a decoded page into the live document — the fallback path.
 *
 * Every node is adopted rather than moved, and every script is rebuilt from
 * scratch: a script element a parser has already processed carries an
 * "already started" flag, and appending it somewhere else does nothing. External
 * scripts also get a distinguishing query parameter, because the module this page
 * needs is the module this page has already evaluated, and the module map is
 * keyed on the URL. Order is preserved head-then-body, which is document order.
 */
export function mountDecodedPage(html, doc = document) {
  // From the document's own window rather than the global: there is exactly one
  // parser that belongs to the document being written into, and reaching for a
  // global one is how a page ends up adopting nodes it cannot adopt.
  const Parser = (doc.defaultView || globalThis).DOMParser;
  const parsed = new Parser().parseFromString(String(html), 'text/html');

  // <html data-backup="1"> is the whole build switch, so its attributes go on
  // first: everything mounted below reads them the moment it runs.
  for (const attr of [...parsed.documentElement.attributes]) {
    doc.documentElement.setAttribute(attr.name, attr.value);
  }

  const pending = [];
  const move = (from, to) => {
    to.replaceChildren();
    for (const node of [...from.childNodes]) {
      if (node.nodeName === 'SCRIPT') {
        pending.push([node, to]);
        node.remove();
        continue;
      }
      to.append(doc.adoptNode(node));
    }
  };
  move(parsed.head, doc.head);
  move(parsed.body, doc.body);

  const stamp = `door=${Date.now()}`;
  for (const [old, parent] of pending) {
    const el = doc.createElement('script');
    for (const attr of [...old.attributes]) el.setAttribute(attr.name, attr.value);
    const src = old.getAttribute('src');
    if (src) {
      const url = new URL(src, doc.baseURI);
      url.searchParams.set('door', String(Date.now()));
      el.setAttribute('src', url.href);
    } else {
      el.textContent = old.textContent;
    }
    parent.append(el);
  }
  return { scripts: pending.length, stamp, backup: doc.documentElement.dataset.backup === '1' };
}

/**
 * Open the door. Throws with something a person can read if the file is not
 * being served or does not decode; the caller decides where that message goes.
 */
export async function openBackupKitchenDoor({
  fetchImpl = typeof fetch === 'function' ? fetch : null,
  base = typeof document === 'undefined' ? '' : document.baseURI,
  doc = typeof document === 'undefined' ? null : document,
  win = null,
  reload = true,
  onStatus
} = {}) {
  if (!doc) throw new Error('The door needs a page to open into.');
  if (!fetchImpl) throw new Error('This browser has no fetch, so the door cannot read the file.');

  const url = new URL(BACKUP_DOOR_FILE, base || undefined).href;
  onStatus?.(`Reading ${BACKUP_DOOR_FILE}…`);
  const res = await fetchImpl(url, { cache: 'no-store' });
  if (!res?.ok) {
    throw new Error(`${BACKUP_DOOR_FILE} is not being served here (HTTP ${res?.status ?? '?'}). The disguise only exists in a built deploy.`);
  }

  const body = await res.text();
  onStatus?.('Decoding…');
  const html = decodePayload(body);
  const view = win || doc.defaultView;

  // The plan: hand it to the next load, and let a document with nothing in it
  // yet write the page. The rename happens there too, after the stash is read —
  // renaming first would make the reload ask for a file that does not exist.
  if (stashDecodedPage(html, view)) {
    onStatus?.('Opening the backup kitchen…');
    if (reload) view.location.reload();
    return { ok: true, via: 'reload', file: BACKUP_DOOR_FILE, bytes: body.length };
  }

  // The fallback, for a browser that will not hold the page across a load.
  const mounted = mountDecodedPage(html, doc);
  try {
    view?.history?.replaceState(null, '', new URL(BACKUP_DOOR_PAGE, base || undefined).href);
  } catch { /* a browser that refuses the rename still gets the kitchen */ }
  return { ok: true, via: 'mount', file: BACKUP_DOOR_FILE, bytes: body.length, ...mounted };
}

export { BACKUP_DOOR_FILE, BACKUP_DOOR_PAGE, BACKUP_DOOR_STASH };
