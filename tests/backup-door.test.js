// The door to the backup kitchen: a string typed at Waffle AI, a file that is not
// a page, and a decode that has to produce something that actually runs.
//
// Most of what is pinned here is source-matching, because that is what a build
// rule looks like. The parts that are behaviour — does the ciphertext round-trip,
// does the decoded page carry the build flag, do its scripts get recreated so
// they execute — are run for real, in jsdom and against the built dist/ when
// there is one. The last release shipped a popup that every test said was fine
// and no visitor ever saw; a door is the same kind of thing.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import {
  BACKUP_DOOR_FILE,
  BACKUP_DOOR_PAGE,
  BACKUP_DOOR_STASH,
  backupPassphrase,
  isBackupPassphrase,
  encodePayload,
  decodePayload
} from '../backup-cipher.js';
import {
  backupDoorMatches,
  stashDecodedPage,
  readStashedPage,
  mountDecodedPage,
  openBackupKitchenDoor
} from '../backup-door.js';

const PAGE = '<!doctype html><html lang="en" data-backup="1"><head><meta charset="UTF-8">' +
  '<title>Backup</title><link rel="stylesheet" href="./assets/app-test.css"></head>' +
  '<body><div id="app"></div><script>console.log("inline")</' + 'script>' +
  '<script type="module" crossorigin src="./assets/app-test.js"></' + 'script></body></html>';

function domWith(html = '<!doctype html><html lang="en"><head></head><body><div id="app">public</div></body></html>') {
  const dom = new JSDOM(html, { url: 'https://the-creative-master.github.io/BiteSizedUtilities/' });
  return dom.window;
}

test('the passphrase is a ciphertext constant, and both of its spellings open the door', () => {
  const src = fs.readFileSync('backup-cipher.js', 'utf8');
  assert.match(src, /const PASSPHRASE_OBF = '[A-Za-z0-9+/=]{20,}';/, 'stored ciphered');
  assert.ok(!src.includes(backupPassphrase()), 'and never as text');

  const want = backupPassphrase();
  assert.ok(want.startsWith('BACKUPKITCHEN'), 'it is the string that was asked for');
  assert.ok(want.length > 30, 'and long enough not to guess');
  assert.equal(isBackupPassphrase(want), true, 'exactly as stored');
  // The string arrived in a chat message with every asterisk escaped, and which
  // of the two was meant cannot be known from here — so a backslash before
  // punctuation is dropped before comparing rather than building a door that
  // opens for one spelling of its own key.
  assert.equal(isBackupPassphrase(want.replace(/\\(?=[^\w\s])/g, '')), true, 'and unescaped');
  assert.equal(isBackupPassphrase(`  ${want}\n`), true, 'surrounding whitespace is not part of it');
  assert.equal(isBackupPassphrase(want.slice(0, -1)), false, 'one character short is not it');
  assert.equal(isBackupPassphrase('BACKUPKITCHEN'), false, 'nor the part anybody would guess');
  assert.equal(isBackupPassphrase(''), false);
  assert.equal(isBackupPassphrase(null), false);
});

test('the payload round-trips, and reads as junk on the way', () => {
  const encoded = encodePayload(PAGE);
  assert.ok(!encoded.includes('data-backup'), 'the build flag is not in the file');
  assert.ok(!encoded.includes('app-test.js'), 'and neither is anything it would load');
  assert.match(encoded, /^DONTASKMEWHATTHATIS\.txt/, 'it starts by naming itself');
  assert.match(encoded, /var _0x[0-9a-f]+=\["[A-Za-z0-9+/=]+"\];/, 'and looks like obfuscated code, in a .txt');
  assert.equal(decodePayload(encoded), PAGE, 'byte for byte');

  assert.throws(() => decodePayload(encoded, 'the wrong key'), /did not decode to a page/,
    'a wrong key is reported, not mounted');
  assert.throws(() => decodePayload('nothing here'), /holds no payload/, 'and so is an edited file');
  // The file is written by the build and read back by the browser, so both ends
  // are the same code: nothing here is allowed to reimplement it.
  assert.equal(decodePayload(encodePayload('<html data-backup="1"><body>x</body></html>')).length > 0, true);
});

test('the door is a chat message, checked before anything else reads it', () => {
  const src = fs.readFileSync('waffle-ai.js', 'utf8');
  assert.match(src, /import \{ backupDoorMatches, openBackupKitchenDoor, BACKUP_DOOR_FILE \} from '\.\/backup-door\.js';/);
  const send = src.slice(src.indexOf('async function sendMessage(rawText) {'));
  assert.ok(send.indexOf('backupDoorMatches(text)') > 0, 'sendMessage asks the door');
  assert.ok(send.indexOf('backupDoorMatches(text)') < send.indexOf('parseImageIntent(text)'),
    'before the image intent, so a string that is a key is not also a prompt');
  assert.match(src, /async function runBackupDoor\(\)/, 'which hands over to one function');
  assert.match(src, /await openBackupKitchenDoor\(\{/, 'that opens the door');

  // A key that ends up in the transcript gets copy-pasted, quoted back, and
  // eventually posted somewhere. It is consumed instead.
  const door = src.slice(src.indexOf('async function runBackupDoor()'), src.indexOf('async function sendMessage(rawText) {'));
  assert.ok(!door.includes('${text}'), 'the string is never echoed into the chat');
  assert.ok(!/displayContent/.test(door), 'and never pushed as a message of its own');
});

test('the door is not offered inside the backup kitchen itself', () => {
  const win = domWith();
  globalThis.document = win.document;
  try {
    assert.equal(backupDoorMatches(backupPassphrase(), win.document), true, 'open on the public page');
    win.document.documentElement.dataset.backup = '1';
    assert.equal(backupDoorMatches(backupPassphrase(), win.document), false, 'and closed on the backup one');
  } finally {
    delete globalThis.document;
  }
});

test('the decoded page is handed to the next load rather than mounted into this one', () => {
  // Both kitchens are built from the same entry, so the decoded page names the
  // same ./assets/app-*.js this document has already evaluated — and a document
  // evaluates a module URL once. Mounting here would produce a correctly decoded,
  // completely inert page, which is why the plan is a reload and mounting is the
  // fallback for a browser that refuses sessionStorage.
  const win = domWith();
  assert.equal(stashDecodedPage(PAGE, win), true, 'the page fits in sessionStorage');
  assert.equal(win.sessionStorage.getItem(BACKUP_DOOR_STASH), PAGE);
  assert.equal(readStashedPage(win), PAGE, 'and is read back once');
  assert.equal(win.sessionStorage.getItem(BACKUP_DOOR_STASH), null, 'then cleared, so a later load is not ambushed');
  assert.equal(readStashedPage(win), null);

  // A storage that accepts writes and returns nothing must not look like success:
  // the door would reload into the public kitchen and seem to have ignored you.
  // (Plain objects, not a patched jsdom Storage — that one is a proxy, and
  // assigning setItem on it stores an item called "setItem".)
  const windowWith = sessionStorage => ({ sessionStorage });
  assert.equal(stashDecodedPage(PAGE, windowWith({ setItem() {}, getItem: () => null })), false,
    'a write that does not stick is reported as a failure');
  assert.equal(stashDecodedPage(PAGE, windowWith({ setItem() { throw new Error('denied'); } })), false,
    'and so is one that throws');
  assert.equal(readStashedPage(windowWith({ getItem: () => { throw new Error('denied'); } })), null,
    'reading is just as guarded');
});

test('index.html carries the four lines that write the page, in the head', async () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const at = html.indexOf(BACKUP_DOOR_STASH);
  assert.ok(at > 0, 'the head script knows the key');
  const script = html.slice(html.lastIndexOf('<script>', at), html.indexOf('</script>', at));
  assert.ok(html.indexOf(script) < html.indexOf('<script type="module"'),
    'and runs before the module that builds the kitchen');
  assert.ok(html.indexOf(script) < html.indexOf('<body'), 'in the head, so nothing has rendered yet');
  assert.match(script, /sessionStorage\.removeItem/, 'it clears the stash');
  assert.match(script, /history\.replaceState\(null,'','backup\.html'\)/, 'renames the address bar');
  assert.match(script, /document\.open\(\);document\.write\(h\);document\.close\(\);/, 'and writes the page');
  assert.match(script, /catch\(e\)\{\}/, 'so a browser that refuses any of it still gets the public kitchen');

  // The two spellings of the key are the only thing holding this together, since
  // an inline script cannot import one.
  const { BACKUP_DOOR_STASH: key } = await import('../backup-cipher.js');
  assert.ok(script.includes(`'${key}'`), 'the inline script and the module agree on the key');
  assert.ok(!script.includes('backupPassphrase'), 'and it decodes nothing itself — the door already did');
});

test('mounting the fallback way still produces a page that runs', () => {
  const win = domWith();
  const before = win.document.querySelector('#app').textContent;
  assert.equal(before, 'public');

  const out = mountDecodedPage(PAGE, win.document);
  assert.equal(out.backup, true, 'the build flag landed on <html>');
  assert.equal(win.document.documentElement.dataset.backup, '1');
  assert.equal(win.document.documentElement.lang, 'en', 'and so did the rest of its attributes');
  assert.equal(win.document.title, 'Backup', 'the title came with it');
  assert.equal(win.document.querySelector('#app').textContent, '', 'the public page\'s markup was replaced');
  assert.equal(win.document.querySelectorAll('link[rel="stylesheet"]').length, 1, 'the stylesheet was adopted');

  // The part that is easy to get wrong: a script a parser has already processed
  // never runs again when it is moved, and a module URL that has already been
  // evaluated is not evaluated twice. So scripts are rebuilt, and external ones
  // get a distinguishing query.
  const scripts = [...win.document.querySelectorAll('script')];
  assert.equal(scripts.length, 2, 'both scripts were recreated');
  assert.equal(out.scripts, 2);
  const inline = scripts.find(s => !s.src);
  assert.equal(inline.textContent, 'console.log("inline")', 'the inline one kept its text');
  const module = scripts.find(s => s.src);
  assert.equal(module.type, 'module', 'the module one kept its type');
  assert.ok(module.src.startsWith('https://the-creative-master.github.io/BiteSizedUtilities/assets/app-test.js?door='),
    `and got a URL of its own so the module map cannot swallow it (${module.src})`);
  assert.ok(win.document.body.contains(module), 'appended where it was, in document order');
});

test('the door fetches the disguised file, relative to the page', async () => {
  const win = domWith();
  const asked = [];
  const fetchImpl = async url => {
    asked.push(url);
    return { ok: true, status: 200, text: async () => encodePayload(PAGE) };
  };

  const out = await openBackupKitchenDoor({
    fetchImpl, base: win.document.baseURI, doc: win.document, reload: false
  });
  assert.equal(out.ok, true);
  assert.equal(out.via, 'reload', 'the plan, when sessionStorage will hold the page');
  assert.deepEqual(asked, ['https://the-creative-master.github.io/BiteSizedUtilities/DONTASKMEWHATTHATIS.txt'],
    'resolved against the document, so a GitHub Pages sub-path works');
  assert.equal(win.sessionStorage.getItem(BACKUP_DOOR_STASH), PAGE, 'decoded and stashed for the next load');
  assert.equal(win.document.querySelector('#app').textContent, 'public',
    'and this document was left alone — the next one is the kitchen');

  // No sessionStorage: fall back to mounting here, rename, and say which happened.
  const win2 = domWith();
  let renamed = null;
  const fallback = await openBackupKitchenDoor({
    fetchImpl,
    base: win2.document.baseURI,
    doc: win2.document,
    win: {
      sessionStorage: { setItem() { throw new Error('denied'); }, getItem: () => null },
      history: { replaceState: (_s, _t, url) => { renamed = url; } }
    }
  });
  assert.equal(fallback.via, 'mount');
  assert.equal(fallback.backup, true, 'the page is the backup build');
  assert.equal(renamed, 'https://the-creative-master.github.io/BiteSizedUtilities/backup.html',
    'and the address bar was told what it is called');

  // A host that does not serve the file says so instead of decoding a 404 page.
  const win3 = domWith();
  await assert.rejects(
    openBackupKitchenDoor({
      fetchImpl: async () => ({ ok: false, status: 404, text: async () => '<html>Not Found</html>' }),
      base: win3.document.baseURI, doc: win3.document, reload: false
    }),
    /is not being served here \(HTTP 404\)/
  );
});

test('the build ships the disguise and deletes the page', () => {
  const cfg = fs.readFileSync('vite.config.js', 'utf8');
  assert.match(cfg, /import \{ BACKUP_DOOR_FILE, backupPassphrase, encodePayload \} from '\.\/backup-cipher\.js';/,
    'the build encodes with the same code the browser decodes with');
  assert.match(cfg, /fs\.writeFileSync\(path\.resolve\('dist', BACKUP_DOOR_FILE\), payload\);/, 'it writes the .txt');
  assert.match(cfg, /fs\.rmSync\(backupPage\);/, 'and removes dist/backup.html, so the address 404s');
  const wrote = cfg.indexOf('BACKUP_DOOR_FILE), payload');
  const walked = cfg.indexOf('function walk(dir)');
  assert.ok(wrote > 0 && walked > 0 && wrote < walked,
    'before the shell walk, so the worker precaches the .txt and never sees a page that is gone');

  // The dev server serves the same thing, or the door could only ever be tested
  // against a deploy.
  assert.match(cfg, /server\.transformIndexHtml\('\/backup\.html', raw\)/, 'dev transforms the real page');
  assert.match(cfg, /res\.end\(encodePayload\(html\)\);/, 'and serves it through the same cipher');

  if (!fs.existsSync(`dist/${BACKUP_DOOR_FILE}`)) return;  // no build yet
  assert.ok(!fs.existsSync(`dist/${BACKUP_DOOR_PAGE}`), 'the built page is not on the host');
  const body = fs.readFileSync(`dist/${BACKUP_DOOR_FILE}`, 'utf8');
  const html = decodePayload(body);
  assert.match(html, /<html[^>]*data-backup="1"/, 'what comes out is the backup build');
  assert.ok(body.length < 64 * 1024, `the disguise stays small enough to precache (${body.length} bytes)`);

  // The decoded page has to point at files that exist, or the door opens onto a
  // blank page with a console full of 404s.
  for (const ref of [...html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)].map(m => m[1])) {
    assert.ok(fs.existsSync(path.join('dist', ref)), `dist/${ref} really is there`);
  }
  const sw = fs.existsSync('dist/sw.js') ? fs.readFileSync('dist/sw.js', 'utf8') : '';
  if (sw) {
    const shell = JSON.parse(/const SHELL = (\[[^\]]*\])/.exec(sw)[1]);
    assert.ok(shell.includes(`./${BACKUP_DOOR_FILE}`), 'the worker precaches the disguised file');
    assert.ok(!shell.some(u => u.includes('backup.html')), 'and not a page that no longer exists');
    // The worker falls back to index.html when a fetch *fails*, not when it
    // answers 404 — which is the only reason the address the door removed stays
    // removed on a host with no SPA fallback of its own.
    assert.match(sw, /\.catch\(\(\) => caches\.match\(req\)/, 'the offline fallback fires on a failed fetch');
    assert.ok(!/!r\.ok[\s\S]{0,120}index\.html/.test(sw), 'and never on a 404');
  }
});

test('nothing in the repository hands out the string or the address', () => {
  const passphrase = backupPassphrase();
  for (const file of ['app.js', 'waffle-ai.js', 'changelog.js', 'index.html', 'backup.html',
    'backup-door.js', 'backup-cipher.js', 'style.css', 'README.md']) {
    const src = fs.readFileSync(file, 'utf8');
    assert.ok(!src.includes(passphrase), `${file} does not contain the passphrase`);
    assert.ok(!src.includes(passphrase.replace(/\\(?=[^\w\s])/g, '')), `${file} does not contain it unescaped either`);
  }
  // The changelog says the door exists and is harder, without saying what it is.
  const notes = fs.readFileSync('changelog.js', 'utf8');
  assert.match(notes, /DONTASKMEWHATTHATIS\.txt/, 'the test build names the file');
  assert.ok(!/type .*string.*at Waffle AI.*:.*BACKUP/i.test(notes), 'and never prints the string');
});
