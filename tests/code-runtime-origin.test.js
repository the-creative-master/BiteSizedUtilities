/**
 * The wall a folder puts in front of every runtime, and what the kitchen now
 * says about it.
 *
 * CodeHub runs 41 of its 42 languages inside a worker, and the Regex Tester and
 * the three formatters run theirs in one too. A page opened straight off a disk
 * has an opaque origin, and from one every browser refuses to construct a
 * worker, so all of those tools fail at once — before they read a single
 * character of code. That is not fixable from inside the page: it is the same
 * rule that ended the offline archive.
 *
 * What *was* broken is the diagnosis. The failure used to read "Runtime could
 * not load over file://; serve over HTTP." wherever the page was served from,
 * which pointed anybody debugging a real break (a missing file, a wrong content
 * type on the host) at the wrong cause, and told anybody genuinely on a disk to
 * do the one thing a disk cannot do. These tests pin the two halves of the fix:
 * the message now names the wall it actually hit, and a page on a folder is told
 * once, at the top of the tool, with a link it can tap.
 *
 * jsdom cannot mount a document whose URL is a file: one — it throws
 * "localStorage is not available for opaque origins", which is the same browser
 * rule wearing a different hat. So the documents here are served over HTTPS and
 * `globalThis.location` is swapped for a folder one, which is all the helpers
 * read.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { SITE_URL, opaqueOrigin, runtimeLoadFailure, runtimeWallNotice, mountCode } from '../tools-code.js';

const SERVED = 'https://the-creative-master.github.io/BiteSizedUtilities/';
const FOLDER = 'file:///sdcard/Download/BiteSizedUtilities/index.html';

// The five tools whose work happens in a worker, and two that do not: JSON is
// parsed in the page and hashing goes through crypto.subtle, which a file: page
// is allowed to use. They are the control — if the notice showed up on those too
// it would be decoration rather than a diagnosis.
const WORKER_TOOLS = ['codehub', 'regex-tester', 'css-minifier', 'js-formatter', 'sql-formatter'];
const PAGE_TOOLS = ['json-validator', 'hash-playground'];

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: SERVED,
  pretendToBeVisual: true
});
const win = dom.window;
for (const key of ['window', 'document', 'HTMLElement', 'Node', 'Element', 'DOMParser', 'requestAnimationFrame',
  'cancelAnimationFrame', 'CustomEvent', 'Event', 'AbortController', 'MutationObserver', 'getComputedStyle',
  'Blob', 'URL', 'FileReader', 'FormData', 'Image', 'Audio', 'HTMLCanvasElement', 'ResizeObserver',
  'localStorage', 'sessionStorage']) {
  if (key in win) {
    try { globalThis[key] = win[key]; } catch { Object.defineProperty(globalThis, key, { value: win[key], configurable: true }); }
  }
}
globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;

/** Mount every tool under test with `location` reporting the given protocol. */
function mountAll(protocol) {
  const realLocation = globalThis.location;
  globalThis.location = protocol === 'file:' ? { protocol } : win.location;
  const panels = {};
  try {
    for (const id of [...WORKER_TOOLS, ...PAGE_TOOLS]) {
      const holder = win.document.createElement('div');
      win.document.getElementById('root').append(holder);
      mountCode(id, holder);
      panels[id] = holder;
    }
  } finally {
    globalThis.location = realLocation;
  }
  return panels;
}

const servedPanels = mountAll('https:');
const folderPanels = mountAll('file:');

test('a page with a real origin never sees the folder wall', () => {
  assert.equal(opaqueOrigin(), false, 'served over HTTPS, the origin is not opaque');
  assert.equal(runtimeWallNotice('anything'), null, 'so the notice is not built at all');
  for (const id of [...WORKER_TOOLS, ...PAGE_TOOLS]) {
    assert.equal(servedPanels[id].querySelector('.runtime-wall'), null, `${id} says nothing about folders when it does not need to`);
  }
});

test('a page opened off a disk is told once, on every tool that needs a worker', () => {
  for (const id of WORKER_TOOLS) {
    const walls = folderPanels[id].querySelectorAll('.runtime-wall');
    assert.equal(walls.length, 1, `${id} carries exactly one notice, not one per button`);
    const text = walls[0].textContent;
    assert.match(text, /This copy is a folder, not the site/, 'and it says which of the two copies the reader is looking at');
    assert.match(text, /worker/, 'naming the thing a folder cannot start, rather than blaming a runtime');
  }
  for (const id of PAGE_TOOLS) {
    assert.equal(folderPanels[id].querySelector('.runtime-wall'), null, `${id} works from a folder, so it must not claim otherwise`);
  }
});

test('the notice hands over an address to open, not a server to run', () => {
  const wall = folderPanels.codehub.querySelector('.runtime-wall');
  const link = wall.querySelector('a');
  assert.ok(link, 'the way out is a link, because a folder can still follow one');
  assert.equal(link.getAttribute('href'), SITE_URL, 'pointing at where the kitchen is actually served');
  assert.equal(SITE_URL, SERVED, 'which is the deployed site, not a local one');
  assert.equal(link.target, '_blank', 'and it opens beside the copy rather than replacing it');
  const text = wall.textContent;
  for (const forbidden of ['serve over HTTP', 'npm', 'localhost', '127.0.0.1', 'python', 'start-server']) {
    assert.ok(!text.includes(forbidden), `it never tells the reader to "${forbidden}", which a tablet with no server app cannot do`);
  }
  assert.match(text, /a served page has an origin a browser trusts/, 'it gives the reason, so the wall reads as a rule and not as a broken download');
});

test('the counts in the notice are derived from the catalogue, not remembered', () => {
  const wall = folderPanels.codehub.querySelector('.runtime-wall');
  const counted = wall.textContent.match(/(\d+) of the (\d+) languages/);
  assert.ok(counted, 'CodeHub says how many of its languages hit the wall');
  const [blocked, total] = [Number(counted[1]), Number(counted[2])];
  assert.equal(total - blocked, 1, 'exactly one language runs in the page: the HTML / CSS / JS sandbox');
  // The filter field is stamped from the same catalogue, so the two numbers have
  // to agree — a hard-coded count here would drift the moment a language is added.
  const filter = folderPanels.codehub.querySelector('input[placeholder*="languages"]');
  assert.ok(filter, 'the filter field is still there to compare against');
  assert.equal(Number(filter.placeholder.match(/all (\d+) languages/)[1]), total, 'both read the catalogue');
  assert.match(wall.textContent, /HTML \/ CSS \/ JS sandbox is the exception/, 'and it names the one that still works');
});

test('the failure message names the wall it actually hit', () => {
  const realLocation = globalThis.location;
  try {
    globalThis.location = { protocol: 'file:' };
    const onDisk = runtimeLoadFailure('luau', new Error('Failed to construct \'Worker\'')).message;
    assert.match(onDisk, /luau runs in a worker/, 'it starts from the language the reader picked');
    assert.match(onDisk, /\(file:\)/, 'and it says where the page came from');
    assert.ok(onDisk.includes(SITE_URL), 'then gives the address that fixes it');
    assert.ok(!onDisk.includes('serve over HTTP'), 'without the instruction a folder cannot follow');

    globalThis.location = win.location;
    const served = runtimeLoadFailure('sql', new Error('')).message;
    assert.ok(!served.includes('file://'), 'served over HTTP it never mentions a disk — that was the lie');
    assert.ok(served.includes(`${SERVED}runtimes/worker.js`), 'it names the exact file that did not load');
    assert.match(served, /served over https:/, 'and the protocol it was asked over, so a host misconfiguration is visible');

    const real = runtimeLoadFailure('sql', new Error('Failed to fetch')).message;
    assert.equal(real, 'Failed to fetch', 'when the browser has something to say, the browser speaks');

    const python = runtimeLoadFailure('python', new Error('')).message;
    assert.ok(python.includes('runtimes/python-worker.js'), 'python is the one language with a worker file of its own');
    assert.ok(!python.includes('runtimes/worker.js'), 'and it is not reported as the shared one');
  } finally {
    globalThis.location = realLocation;
  }
});

test('the fabricated file:// diagnosis is gone from the source', () => {
  const src = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'tools-code.js'), 'utf8');
  assert.ok(!src.includes('Runtime could not load over file://; serve over HTTP.'), 'the string that blamed the wrong origin no longer exists');
  const routed = src.split('end(runtimeLoadFailure(op, e))').length - 1;
  assert.equal(routed, 2, 'both ways a worker can fail to start — the error event and the throw from constructing it — go through the honest one');
  assert.ok(src.includes("export const SITE_URL = 'https://the-creative-master.github.io/BiteSizedUtilities/'"), 'the address is a literal, since a folder has nothing to derive it from');
});
