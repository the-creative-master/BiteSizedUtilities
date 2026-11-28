/**
 * The cipher behind the backup kitchen's disguise — and the only place the
 * passphrase exists, in either direction.
 *
 * The backup kitchen does not ship as a page. It ships as a dotfile named after
 * the GitHub Pages Jekyll bypass, so it reads as deployment plumbing and nobody
 * opens it, and the built HTML is
 * inside it as ciphertext. Typing the passphrase into Waffle AI fetches that
 * file, decodes it with a key derived from the passphrase itself, and hands the
 * result to the next page load, which writes it into a document of its own (see
 * backup-door.js for why it cannot be written into this one). `/backup.html` is
 * not on the host any more, so typing it into the address bar gets a 404: the
 * only way in is to know the string.
 *
 * Be honest about what this is. A static site has nowhere to keep a secret — the
 * key has to ship next to the ciphertext or the door could not open — so this is
 * obfuscation, not encryption in any sense that would survive an attacker who
 * cares. What it buys is that the string is nowhere in the source or the bundle
 * as text: it cannot be grepped out of the repo, cannot be found by viewing
 * source, and cannot be stumbled into. Anyone determined can still recover it by
 * running the bundle's own decoder, and that is the ceiling for anything a
 * browser-only page can do.
 *
 * Nothing in here touches the DOM, because `vite.config.js` imports it too: the
 * build encodes the payload with the same code the browser decodes it with, so
 * the two cannot drift.
 */

/** What the kitchen ships as, and what the browser goes and fetches. */
export const BACKUP_DOOR_FILE = '.nojekyll.txt';

/** What the address bar says once the payload has been decoded and mounted. */
export const BACKUP_DOOR_PAGE = 'backup.html';

/**
 * Where the decoded page waits for the next load.
 *
 * The door does not mount the page it decodes. It hands it to the load after
 * this one, because the backup kitchen and the public kitchen are built from the
 * same entry: `dist/index.html` and the decoded page both name one
 * `./assets/app-*.js`, and a document evaluates a given module URL exactly once.
 * Mounting in place would append a script the browser has already evaluated and
 * get nothing back — a perfectly decoded page sitting there inert. A reload gets
 * a document with an empty module map, so the bundle runs once, cleanly, and
 * with none of this page's listeners left over to fire twice.
 *
 * `index.html` has a four-line inline script in its head that reads this key,
 * renames the address bar to backup.html and writes the page. It has to be
 * inline and it has to be in the head: it runs before any module loads, and
 * document.write from there discards the rest of index.html rather than fighting
 * it. The key is spelled out in both places because an inline script cannot
 * import, and a test holds the two spellings together.
 */
export const BACKUP_DOOR_STASH = 'waffle-backup-door';

const CIPHER_SEED = 'waffle-kitchen-door-v1';

/**
 * The passphrase, XOR'd against a keystream from the seed above and base64'd.
 * `backupPassphrase()` is the only thing that turns it back into text, and the
 * build calls that rather than holding a plaintext copy of its own.
 */
const PASSPHRASE_OBF = 'efTZRHaz4RB8PaWeLXJXhbAVnyaySBIlEcTYiUBBhS1jb11K+5U2A7eS+7UQJafDjQ==';

const MASK = 0xffffffff;

const utf8 = str => new TextEncoder().encode(String(str));

function seedState(bytes) {
  let s = 0;
  for (const b of bytes) s = (Math.imul(s, 31) + b) >>> 0;
  return s || 0x9e3779b9;
}

/** xorshift32. Chosen for being six lines and identical in Node and a browser. */
function keystream(keyBytes, len) {
  let s = seedState(keyBytes);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    s ^= (s << 13) & MASK; s >>>= 0;
    s ^= (s >>> 17);
    s ^= (s << 5) & MASK; s >>>= 0;
    out[i] = s & 0xff;
  }
  return out;
}

function xor(data, keyBytes) {
  const ks = keystream(keyBytes, data.length);
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i] ^ ks[i];
  return out;
}

function bytesToBase64(bytes) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let s = '';
  // In slices: spreading 100k bytes into String.fromCharCode blows the stack.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function base64ToBytes(b64) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'));
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** The passphrase, as text. Also the key the payload is ciphered with. */
export function backupPassphrase() {
  const raw = base64ToBytes(PASSPHRASE_OBF);
  return new TextDecoder().decode(xor(raw, utf8(CIPHER_SEED)));
}

/**
 * Is this what somebody typed at the door?
 *
 * Two spellings are accepted, and only because of a markdown artefact: the
 * string was handed over in a chat message where every `*` arrived as `\*`, and
 * nobody can tell from here which of the two was meant. Rather than build a door
 * that opens for one spelling of its own key and quietly never opens for the
 * other, backslashes before punctuation are dropped before comparing. Anything
 * else has to match exactly.
 */
export function isBackupPassphrase(text) {
  const typed = String(text ?? '').trim();
  if (!typed) return false;
  const want = backupPassphrase();
  return typed === want || typed === want.replace(/\\(?=[^\w\s])/g, '');
}

// The header is part of the disguise, so it has to read like the thing the
// filename claims to be: a note about Jekyll not running over a prebuilt
// artifact. It must not hint that there is anything inside worth decoding, and
// it must not name the old file, which is what gave the whole scheme away in
// the changelog and in every public build log.
const HEADER = [
  '.nojekyll.txt',
  '=============',
  '',
  'Pages build note. This site deploys as a prebuilt artifact, so Jekyll does not',
  'run over it and nothing in this directory is processed or regenerated. This',
  'file is written by the build and read back by the build. It is not a page:',
  'nothing links to it and nothing renders it.',
  '',
  'Generated output. Do not edit by hand, do not reformat, and do not delete -',
  'the deploy expects it to be here.',
  ''
].join('\n');

const BEGIN = '/* generated at build time. obfuscated on purpose. */';
const END = '/* end of artefact */';
const CHUNK = 88;
const LINE_RE = /var _0x[0-9a-f]+=\["([^"]+)"\];/g;

const lineName = i => `var _0x${(0x1f2a + i * 37).toString(16)}=`;

/** Wrap a built page as the disguised file. Called by `vite.config.js`. */
export function encodePayload(html, key = backupPassphrase()) {
  const b64 = bytesToBase64(xor(utf8(html), utf8(key)));
  const lines = [];
  for (let i = 0; i < b64.length; i += CHUNK) {
    lines.push(`${lineName(lines.length)}["${b64.slice(i, i + CHUNK)}"];`);
  }
  return `${HEADER}\n${BEGIN}\n${lines.join('\n')}\n${END}\n`;
}

/** Read it back. Called by the browser, with the passphrase as the key. */
export function decodePayload(body, key = backupPassphrase()) {
  const chunks = [];
  const re = new RegExp(LINE_RE.source, 'g');
  let m;
  while ((m = re.exec(String(body ?? '')))) chunks.push(m[1]);
  if (!chunks.length) throw new Error(`${BACKUP_DOOR_FILE} holds no payload`);
  const bytes = base64ToBytes(chunks.join(''));
  const html = new TextDecoder().decode(xor(bytes, utf8(key)));
  // A wrong key does not throw, it produces noise — so say which of the two this
  // was instead of mounting a document full of it.
  if (!/<html[\s>]/i.test(html)) {
    throw new Error(`${BACKUP_DOOR_FILE} did not decode to a page: wrong key, or a file that has been edited`);
  }
  return html;
}
