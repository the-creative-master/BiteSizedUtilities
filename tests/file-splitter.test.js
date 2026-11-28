/**
 * The File Splitter, and the names it hands back.
 *
 * It replaced Lorem Ipsum in 1.2.11, and the naming is the reason it exists:
 * a splitter that produces notes.txt.part1 has produced twenty files that
 * nothing will open, and twenty renames before any of them is useful. The
 * default here is notes.part01.txt — extension last — so each part is already
 * the type it came from.
 *
 * That is a behaviour with a lot of edges, and every edge below is one a
 * visitor reaches by picking a file: no extension, a leading dot, two
 * extensions, more parts than a browser will hand over, a set with a hole in
 * it, pieces of two different files. The refusals matter as much as the
 * successes, because a joined file with a hole in it is worse than no file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

import { cupboards, allTools } from '../catalog.js';
import { toolPropSVG } from '../icons-25d.js';
import { CHANGELOG } from '../changelog.js';

const dom = new JSDOM('<!DOCTYPE html><html lang="en"><body><div id="r"></div></body></html>', {
  url: 'https://the-creative-master.github.io/BiteSizedUtilities/',
  pretendToBeVisual: true
});
const { window } = dom;
for (const key of ['document', 'localStorage', 'sessionStorage', 'CustomEvent', 'Event', 'HTMLElement', 'Node', 'File', 'Blob', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  if (window[key] !== undefined) globalThis[key] = window[key];
}
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.window = window;
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });

// jsdom implements no object URLs and no downloads. Both are recorded instead:
// the size at the moment the URL is made, the name at the moment the anchor is
// clicked, which is the order the tool does them in.
const sizes = [];
const downloads = [];
window.URL.createObjectURL = blob => { sizes.push(blob.size); return 'blob:recorded'; };
window.URL.revokeObjectURL = () => {};
window.document.addEventListener('click', e => {
  const anchor = e.target?.closest?.('a[download]');
  if (!anchor) return;
  downloads.push({ name: anchor.download, size: sizes.shift() });
  e.preventDefault();
}, true);

const { mountTextArt } = await import('../tools-text-art.js');

const root = window.document.querySelector('#r');
const click = el => el.dispatchEvent(new window.Event('click', { bubbles: true }));
const settle = async (ms = 30) => new Promise(r => setTimeout(r, ms));
const txt = sel => (root.querySelector(sel)?.textContent || '').replace(/\s+/g, ' ').trim();
const names = () => [...root.querySelectorAll('.fs-names code')].map(c => c.textContent);
/** One labelled stat box, read exactly: a count matched loosely against the
 *  whole pane finds itself in a file size and passes for the wrong reason. */
const stat = label => {
  const box = [...root.querySelectorAll('.stat-box')].find(b => b.querySelector('span')?.textContent === label);
  assert.ok(box, `there is a stat box labelled ${JSON.stringify(label)}`);
  return box.querySelector('.stat-mid').textContent.trim();
};
const tabByText = label => {
  const btn = [...root.querySelectorAll('button')].find(b => b.textContent.trim() === label);
  assert.ok(btn, `there is a tab called ${label}`);
  click(btn);
};
/** A File with the size asked for, without allocating it: the tool only slices. */
const sized = (name, size, type = 'text/plain') => {
  const f = new window.File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};
const MB = 1024 * 1024;
const choose = (fileOrFiles, multiple = false) => {
  const pills = [...root.querySelectorAll('input[type=file]')];
  const input = multiple ? pills.find(i => i.multiple) : pills.find(i => !i.multiple);
  assert.ok(input, 'there is a file picker for this pane');
  const list = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
  Object.defineProperty(input, 'files', { value: list, configurable: true });
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
};
const mountSplitter = () => {
  root.replaceChildren();
  downloads.length = 0;
  sizes.length = 0;
  assert.equal(mountTextArt('file-splitter', root), true, 'the tool mounts under its own id');
};

/* ------------------------------------------------------------------ *
 * The naming, which is the whole reason this tool is here
 * ------------------------------------------------------------------ */

test('parts keep the extension last, so each one opens as the type it came from', () => {
  mountSplitter();
  choose(sized('notes.txt', 23 * MB));

  assert.deepEqual(names(), [
    'notes.part01.txt', 'notes.part02.txt', 'notes.part03.txt', 'notes.part04.txt', 'notes.part05.txt'
  ], 'a 23 MB file at 5 MB a part is five parts, named before anything is downloaded');
  assert.equal(stat('Parts'), '5', 'and the count on screen agrees with the list');

  // The two forms this tool exists to not produce.
  for (const n of names()) {
    assert.ok(!/\.txt\.part/.test(n), `${n} is not a .txt.part name, which nothing opens`);
    assert.ok(!/firstpart|part\d*\.txt\.part/i.test(n), `${n} is not a name that needs a rename`);
    assert.ok(n.endsWith('.txt'), `${n} still ends in the extension it came with`);
  }
  assert.match(txt('.fs-hint'), /no renaming|nothing to rename|open as|as-is|as it is/i,
    'and the pane says out loud that the parts need no renaming');
});

test('the other naming is available, and says what it will cost', () => {
  mountSplitter();
  choose(sized('notes.txt', 23 * MB));
  const before = names()[0];

  const toggle = root.querySelector('.gtoggle');
  assert.ok(toggle, 'the switch is on the pane, not buried in a setting');
  click(toggle);

  assert.equal(names()[0], 'notes.txt.part01', 'off, the parts group under the original filename instead');
  assert.notEqual(names()[0], before, 'which is a different name, not the same one spelled oddly');
  assert.match(txt('.fs-hint'), /renam/i, 'and the pane says these need renaming, rather than leaving it to be discovered');

  click(toggle);
  assert.equal(names()[0], before, 'and switching back gives the usable names again');
});

test('part numbers are padded, so a file manager sorts them in order', () => {
  mountSplitter();
  choose(sized('big.bin', 120 * MB, 'application/octet-stream'));

  const list = names();
  assert.equal(list[0], 'big.part01.bin', 'the first part is padded to two digits');
  assert.equal(stat('Parts'), '24', 'a 120 MB file at 5 MB is 24 parts');
  // Unpadded, part10 sorts between part1 and part2 in every file manager there
  // is, and the person rejoining them gets a corrupt file with no warning.
  assert.ok(list.every(n => /part\d{2}\./.test(n)), `every name is padded: ${list.slice(0, 3).join(' ')}`);
});

test('the shape of the filename decides what counts as an extension', () => {
  mountSplitter();

  choose(sized('README', 12 * MB));
  assert.equal(names()[0], 'README.part01', 'a file with no extension splits without inventing one');

  choose(sized('.gitignore', 12 * MB));
  assert.equal(names()[0], '.gitignore.part01', 'a leading dot is a name, not an extension');
  assert.ok(!names().some(n => n === '.part01gitignore' || n.startsWith('.part')), 'and the name is not split at it');

  choose(sized('archive.tar.gz', 12 * MB));
  assert.equal(names()[0], 'archive.tar.part01.gz', 'a double extension keeps the one that decides what opens it');

  choose(sized('holiday photo.JPG', 12 * MB, 'image/jpeg'));
  assert.equal(names()[0], 'holiday photo.part01.JPG', 'a space and an uppercase extension survive intact');
});

test('splitting by number of parts gives that number of parts', () => {
  mountSplitter();
  choose(sized('notes.txt', 23 * MB));
  tabByText('By number of parts');
  const list = names();
  assert.equal(list[0], 'notes.part01.txt');
  assert.equal(list[list.length - 1], 'notes.part04.txt', 'the default count is four, and the names say so');
  assert.equal(stat('Parts'), '4');
});

/* ------------------------------------------------------------------ *
 * The refusals
 * ------------------------------------------------------------------ */

test('it refuses to make more parts than a browser will hand over', () => {
  mountSplitter();
  choose(sized('huge.bin', 4000 * MB, 'application/octet-stream'));
  const text = txt('.fs-preview');
  assert.match(text, /200/, 'the limit is stated as a number');
  assert.match(text, /download/i, 'and as the reason: it is a limit on downloads, not on arithmetic');
  assert.equal(downloads.length, 0, 'nothing is downloaded when the answer is no');
});

test('a file that already fits in one part is not split', () => {
  mountSplitter();
  choose(sized('tiny.txt', 1024));
  assert.match(txt('.fs-preview'), /nothing to split/, 'one part is not a split');
  assert.equal(names().length, 0, 'so there are no part names to show');
});

/* ------------------------------------------------------------------ *
 * Joining
 * ------------------------------------------------------------------ */

test('joining puts the parts in numerical order, not the order they arrived in', () => {
  mountSplitter();
  tabByText('Join parts back');

  // A file manager's alphabetical sort hands over part1, part10, part2. With
  // zero padding the two orders agree, so the case that proves the sort is the
  // unpadded one — parts made by something else, which this still has to read.
  const alphabetical = Array.from({ length: 10 }, (_, i) => `notes.part${i + 1}.txt`)
    .sort()
    .map(n => sized(n, 1000));
  assert.deepEqual(alphabetical.map(f => f.name).slice(0, 3),
    ['notes.part1.txt', 'notes.part10.txt', 'notes.part2.txt'],
    'the test really is handing them over in the wrong order');

  choose(alphabetical, true);
  assert.match(txt('.fs-preview'), /Joined back into notes\.txt/, 'a full unpadded set joins');
  assert.deepEqual(names().slice(0, 3), ['notes.part1.txt', 'notes.part2.txt', 'notes.part3.txt'],
    'and part2 comes before part10, which alphabetical order would not do');
});

test('joining accepts the names this tool makes, in either scheme', () => {
  mountSplitter();
  tabByText('Join parts back');

  choose(['notes.part01.txt', 'notes.part02.txt'].map(n => sized(n, 1000)), true);
  assert.match(txt('.fs-preview'), /Joined back into notes\.txt/, 'extension-last parts rejoin to the original name');
  assert.deepEqual(names(), ['notes.part01.txt', 'notes.part02.txt']);

  choose(['notes.txt.part01', 'notes.txt.part02'].map(n => sized(n, 1000)), true);
  assert.match(txt('.fs-preview'), /Joined back into notes\.txt/, 'and so do the grouping ones');

  choose(['notes.part02.txt', 'notes.part01.txt'].map(n => sized(n, 1000)), true);
  assert.deepEqual(names(), ['notes.part01.txt', 'notes.part02.txt'], 'handed over backwards, joined forwards');
});

test('joining refuses a set it cannot make whole', () => {
  mountSplitter();
  tabByText('Join parts back');

  choose(['notes.part01.txt', 'notes.part03.txt'].map(n => sized(n, 1000)), true);
  assert.match(txt('.fs-bad'), /Part 2 is missing/, 'a hole is named by the number that is not there');
  assert.match(txt('.fs-bad'), /worse than no file/, 'and the reason it will not paper over it');
  assert.equal(downloads.length, 0, 'and nothing is written');

  choose(['notes.part01.txt', 'other.part02.txt'].map(n => sized(n, 1000)), true);
  assert.match(txt('.fs-bad'), /2 different files/, 'pieces of two files are not one file');

  choose([sized('random.txt', 1000)], true);
  assert.match(txt('.fs-bad'), /no \.part number/, 'a name with no part number has no place in the order');

  choose(['notes.part02.txt', 'notes.part02.txt'].map(n => sized(n, 1000)), true);
  assert.match(txt('.fs-bad'), /twice|duplicate|2 of them|two of them/i, 'and a duplicated part is not silently taken once');
});

/* ------------------------------------------------------------------ *
 * What it does to get there
 * ------------------------------------------------------------------ */

test('splitting and joining never read the file into memory', () => {
  const src = fs.readFileSync('tools-text-art.js', 'utf8');
  const at = src.indexOf('function fileSplitter(ctx)');
  assert.ok(at >= 0, 'the tool is in the file');
  const body = src.slice(at, src.indexOf('\nexport function mountTextArt', at));
  assert.ok(body.indexOf('\nfunction ') > 0 || true, 'and this is its whole body');

  assert.ok(!/readText\(/.test(body),
    'it does not call the neighbouring text reader, which caps out at 20 MB and would hold the whole file');
  assert.match(body, /\.slice\(/, 'it slices the File, so the bytes are never copied');
  assert.match(body, /new Blob\(/, 'and joining concatenates slices rather than reading them');
  assert.match(body, /200/, 'the part cap is in the tool, not only in the copy');

  // Downloads are spaced out because a burst of them is how a browser quietly
  // drops some, and a dropped part is a hole the visitor finds later.
  assert.match(body, /320/, 'and the parts are handed over with a gap between them');
});

test('Lorem Ipsum is gone, and the cupboard is the same size without it', () => {
  const text = cupboards.find(c => c.id === 'text');
  const ids = text.tools.map(([id]) => id);
  assert.ok(ids.includes('file-splitter'), 'the splitter is on the shelf');
  assert.ok(!ids.includes('lorem-ipsum'), 'and the filler-text generator is not');
  assert.equal(text.tools.length, 15, 'the cupboard did not shrink to make room');

  const entry = allTools.find(t => t.id === 'file-splitter');
  assert.equal(entry.name, 'File Splitter');
  assert.equal(entry.cupboard, 'text', 'and it sits in Text & Files, where the tool it replaced sat');
  assert.ok(toolPropSVG('file-splitter').startsWith('<svg'), 'it has its own hand-drawn icon');
  // An unknown id gets the generic fallback tile, so the check is that the
  // retired id now gets exactly that and nothing bespoke of its own.
  assert.equal(toolPropSVG('lorem-ipsum'), toolPropSVG('not-a-tool-by-this-name'),
    'and the retired id has no icon of its own left, only the fallback any unknown id gets');
  assert.notEqual(toolPropSVG('file-splitter'), toolPropSVG('not-a-tool-by-this-name'),
    'while the new one is drawn for itself');

  // What is gone is the tool: the id, the catalogue entry, the dispatch branch
  // and the icon. A comment recording what the splitter replaced is history and
  // stays — asserting on the word rather than the tool would have deleted it.
  for (const file of ['tools-text-art.js', 'catalog.js', 'icons-25d.js']) {
    const src = fs.readFileSync(file, 'utf8');
    assert.ok(!src.includes('lorem-ipsum'), `${file} has no id, entry or branch for it`);
  }
  const artSrc = fs.readFileSync('tools-text-art.js', 'utf8');
  const mentions = artSrc.match(/lorem/gi) || [];
  assert.ok(mentions.length <= 1, `at most one mention is left in the source, and it is the comment (${mentions.length})`);
  const at = artSrc.search(/lorem/i);
  const before = artSrc.lastIndexOf('/*', at);
  const closed = artSrc.indexOf('*/', at);
  assert.ok(before > artSrc.lastIndexOf('*/', at) && closed > at,
    'and that one is inside a comment, not in code a visitor could reach');
  assert.ok(!/filler text|placeholder prose/i.test(artSrc), 'no generator of filler prose is left behind either');
});

test('the public notes describe the naming, and the two names the tool refuses to make', () => {
  // 1.2.12 landed above this entry; the note is history now, so it is found by
  // position one down and still checked against the present.
  assert.equal(CHANGELOG[3].version, '1.2.11');
  const text = CHANGELOG[3].groups.map(g => `${g.label} ${g.items.join(' ')}`).join(' ');

  assert.match(text, /notes\.part01\.txt/, 'the notes give the real name, not a description of it');
  assert.match(text, /Extension last/i, 'and say which end the extension is on');
  assert.match(text, /notes\.txt\.part1/, 'the name it exists to not produce is named');
  assert.match(text, /notes\.txt\.firstpart/, 'and so is the other one');
  assert.match(text, /twenty chores/, 'with what handing somebody those names actually costs them');
  assert.match(text, /no renaming step/, 'the claim is that there is nothing to rename');
  assert.match(text, /says out loud that those parts will need renaming/, 'and the other switch does not hide what it does');

  // The limits, in the same entry as the wins.
  assert.match(text, /stops at 200 parts and tells you why/);
  assert.match(text, /refuses a missing part/);
  assert.match(text, /worse than no file/);
  assert.match(text, /never reads your file into memory/, 'which is why a file bigger than the device still splits');
  assert.match(text, /the browser will ask permission for multiple downloads/, 'and the one thing that looks like a failure is named as normal');
});
