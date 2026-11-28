/**
 * Star utilities: the plinth, and the badge that follows the tool.
 *
 * `catalog.js` has named one utility per cupboard as its star since 1.2 —
 * `star: id === c.star` — and nothing on screen ever read the flag: CodeHub looked
 * exactly like the fourteenth utility on its shelf. This suite holds the two things
 * that changed, and the boundary between them:
 *
 *   - in its own cupboard, a star is taken *off* the shelf and put on a plinth of
 *     its own, because that is a layout and not a highlight. A cupboard should read
 *     as one flagship and the tools beside it, not as fifteen equal tiles one of
 *     which glows.
 *   - anywhere else — Saved Toys, Recently Played, search results — the same tool
 *     is a guest, keeps the shelf layout, and wears a corner badge. Three search
 *     hits cannot each claim a plinth.
 *
 * `app.js` opens with `import './style.css'`, so it cannot be loaded in node; every
 * existing suite pins it by reading the source, and this one does the same. The
 * catalogue is imported for real, because the claims about *which* tools are stars
 * are data claims and should fail if the data changes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cupboards, allTools } from '../catalog.js';
import { APP_VERSION, CHANGELOG, appVersionLabel } from '../changelog.js';

const appSrc = fs.readFileSync(path.join(process.cwd(), 'app.js'), 'utf8');
const styleSrc = fs.readFileSync(path.join(process.cwd(), 'style.css'), 'utf8');
const catalogSrc = fs.readFileSync(path.join(process.cwd(), 'catalog.js'), 'utf8');

/** app.js cannot be imported, so a render is checked by reading the branch. */
const cupboardView = appSrc.slice(appSrc.indexOf('const starTool = c ? tools.find'), appSrc.indexOf('function openTool(id)'));
const plinth = appSrc.slice(appSrc.indexOf('function starPlinthHTML'), appSrc.indexOf('function chunkShelves'));
const shelfCard = appSrc.slice(appSrc.indexOf('function shelfItemCard'), appSrc.indexOf('/** The cupboard\'s display name'));

test('every cupboard names exactly one star, and it is one of its own tools', () => {
  assert.equal(cupboards.length, 8);
  for (const c of cupboards) {
    assert.ok(typeof c.star === 'string' && c.star, `${c.id} names a star`);
    const stars = c.tools.filter(([id]) => id === c.star);
    assert.equal(stars.length, 1, `${c.id} has exactly one tool carrying the flag`);
    assert.equal(cupboards.filter(x => x.star === c.star).length, 1, `${c.star} stars only ${c.id}`);
  }
});

test('the flag reaches the resolved tools the renderer reads', () => {
  assert.match(catalogSrc, /star:id===c\.star/, 'allTools derives it rather than repeating it');
  for (const c of cupboards) {
    const starred = allTools.filter(t => t.cupboard === c.id && t.star);
    assert.equal(starred.length, 1, `${c.id} resolves to one star`);
    assert.equal(starred[0].id, c.star);
  }
  assert.equal(allTools.filter(t => t.star).length, cupboards.length,
    'and no tool outside a cupboard claims one');
});

test('a backup extra is never a star, however good it is', () => {
  // resolveTools(true) splices experiments in beside the tool each one upgrades.
  // An experiment appearing on a plinth would advertise an unfinished thing as the
  // cupboard's flagship, so the flag is off for them at the point of construction.
  assert.match(catalogSrc, /star:backup\?false:id===c\.star/, 'the backup branch cannot be a star');
});

test('a cupboard puts its star on a plinth and takes it off the shelves', () => {
  assert.match(cupboardView, /const starTool = c \? tools\.find\(t => t\.star\) : null;/,
    'only a real cupboard has one: `c` is falsy for Saved Toys and Recently Played');
  assert.match(cupboardView, /const shelfTools = starTool \? tools\.filter\(t => t !== starTool\) : tools;/,
    'and the star comes off the row rather than being emphasised inside it');
  assert.match(cupboardView, /\$\{starTool \? starPlinthHTML\(starTool, c\.name\) : ''\}/,
    'the plinth is rendered above the bookcase');
  assert.match(cupboardView, /const shelves = chunkShelves\(shelfTools, perShelf\);/,
    'so the shelves are chunked from what is left, and cannot also contain it');
  const plinthAt = cupboardView.indexOf('starPlinthHTML(starTool');
  const bookcaseAt = cupboardView.indexOf('cabinet-bookcase');
  assert.ok(plinthAt > 0 && plinthAt < bookcaseAt, 'and it sits above them, where a cupboard opens');
});

test('the plinth is a bigger tile, a named cupboard, and a description', () => {
  assert.match(plinth, /<span class="star-badge">⭐ Star of \$\{esc\(cupName\)\}<\/span>/,
    'the badge names the cupboard, so the same badge means the same thing wherever it is read');
  assert.match(plinth, /<span class="star-plinth-name">\$\{esc\(t\.name\)\}<\/span>/, 'the name');
  assert.match(plinth, /<span class="star-plinth-desc">\$\{esc\(t\.description \|\| ''\)\}<\/span>/,
    'and the description, which is the part a 40 px label could never carry');
  assert.match(plinth, /<span class="star-plinth-cta">Open it →<\/span>/, 'with an invitation on it');
  assert.match(plinth, /style="--cup:\$\{t\.color\}"/, 'in the cupboard\u2019s own colour');
  assert.match(plinth, /class="star-plinth-open" data-tool="\$\{t\.id\}"/,
    'and it opens the tool through the same data-tool binding every other tile uses');
});

test('the plinth is usable without looking at it', () => {
  assert.match(plinth, /aria-label="Open \$\{esc\(t\.name\)\}, star of the \$\{esc\(cupName\)\} cupboard"/,
    'the open button says what it is, not just what it is called');
  assert.match(plinth, /aria-pressed="\$\{isFav\}"/, 'the heart is a toggle and reports its state');
  assert.match(plinth, /aria-label="\$\{isFav \? 'Unsave' : 'Save'\} \$\{esc\(t\.name\)\}"/,
    'and its label changes with that state');
  assert.match(plinth, /type="button"/g, 'buttons, so a keyboard reaches them');
});

test('a guest appearance keeps the shelf and wears a corner badge instead', () => {
  assert.match(shelfCard, /\$\{t\.star \? `<span class="shelf-star-badge" aria-hidden="true">⭐<\/span>` : ''\}/,
    'the badge is decorative: the aria-label carries the same fact');
  assert.match(shelfCard, /<div class="shelf-object-slot\$\{t\.star \? ' is-star' : ''\}">/,
    'and the slot is marked, so the emphasis is in CSS rather than in a second markup path');
  assert.match(shelfCard, /const starName = t\.star \? `\$\{esc\(t\.name\)\} — star of the \$\{esc\(cupboardName\(t\.cupboard\)\)\} cupboard` : '';/,
    'a screen reader is told which cupboard it stars in');
  assert.match(shelfCard, /\$\{starName \? ` aria-label="\$\{starName\}"` : ''\}/, 'and only then');
  assert.match(shelfCard, /aria-hidden="true">⭐/, 'the visible star never becomes a spoken one');
});

test('the badge reads the same in both places, because it is one sentence', () => {
  // Two layouts, one meaning. If these drift, a star on a shelf and a star on a
  // plinth stop being the same claim.
  assert.match(plinth, /⭐ Star of \$\{esc\(cupName\)\}/);
  assert.match(shelfCard, /star of the \$\{esc\(cupboardName\(t\.cupboard\)\)\} cupboard/);
  assert.match(appSrc, /function cupboardName\(id\) \{\n  return ALL_CUPBOARDS\.find\(c => c\.id === id\)\?\.name \|\| 'cupboard';/,
    'through one lookup, with a fallback rather than an undefined in a sentence');
});

test('Games & Fun gets no plinth, and neither does a shelf of somebody else\u2019s favourites', () => {
  const games = appSrc.slice(appSrc.indexOf("const ALL_CUPBOARDS = ["), appSrc.indexOf('// Backup-only utilities'));
  assert.match(games, /id: 'games', name: 'Games & Fun'.*star: 'games', tools: \[\]/s,
    'the arcade declares itself as its own star and carries no tool list');
  // With no tools in TOOLS for that cupboard, `tools.find(t => t.star)` cannot
  // match, so the plinth is not rendered — 51 games are not one flagship, and the
  // arcade has its own cabinet view.
  assert.equal(allTools.filter(t => t.cupboard === 'games').length, 0, 'no utility belongs to it');
  assert.match(appSrc, /: id === 'favorites'\n      \? TOOLS\.filter\(t => favorites\.has\(t\.id\)\)/,
    'Saved Toys is a shelf of guests');
  assert.match(appSrc, /: recent\.map\(rid => TOOLS\.find\(t => t\.id === rid\)\)\.filter\(Boolean\);/,
    'and so is Recently Played');
  assert.match(appSrc, /const shelfTools = starTool \? tools\.filter/, 'and guests keep the shelf they arrived on');
});

test('a cupboard with nothing on its shelves still does not offer to fill them', () => {
  // The empty-shelf message says "Open any toy in a cupboard and it will appear
  // here!" — which is the wrong sentence under a plinth that is already offering
  // the cupboard's flagship, and the wrong one twice over on Saved Toys where the
  // star has just been taken off the shelf it is describing.
  assert.match(cupboardView, /shelves\.length \? shelves\.map/, 'shelves when there are shelves');
  assert.match(cupboardView, /: starTool \? '' : `\n            <div class="empty-shelf">/,
    'the empty state only when there is also no plinth');
});

test('the plinth is styled, collapses on a phone, and stops for anybody who asked it to', () => {
  for (const sel of ['.star-plinth {', '.star-badge {', '.star-plinth-open {', '.star-plinth-tile {',
    '.star-plinth-name {', '.star-plinth-desc {', '.star-plinth-cta {', '.shelf-star-badge {']) {
    assert.ok(styleSrc.includes(sel), `${sel} is styled`);
  }
  assert.match(styleSrc, /\.star-plinth \{[^}]*max-width: 720px;/s, 'a plinth is not full-bleed');
  assert.match(styleSrc, /\.star-plinth \{[^}]*background: linear-gradient\(180deg, var\(--cup\) 0%, #fff9ec 58%\);/s,
    'and takes the cupboard colour it was handed');
  assert.match(styleSrc, /\.star-plinth-tile svg \{ width: 106px; height: 106px;/,
    'the tile is roughly twice a shelf object, which is the layout change');
  assert.match(styleSrc, /\.shelf-object-slot\.is-star \.object-tile \{/, 'the guest badge has its own emphasis');
  assert.match(styleSrc, /\.shelf-object-slot\.is-star \.object-label \{ text-decoration: underline;/,
    'and it is an underline, not a bigger tile: a guest does not take over the shelf');
  const narrow = styleSrc.slice(styleSrc.indexOf('.star-plinth { padding: 14px 12px 16px;'));
  assert.match(narrow, /\.star-plinth-tile \{ width: 74px; height: 74px; \}/,
    'on a phone the plinth tile drops to the size of a shelf object');
  assert.match(styleSrc, /\.star-plinth-open, \.star-plinth-open:active \{ transition: none; transform: none; \}/,
    'and nothing moves for anybody who has asked the system not to');
  assert.match(styleSrc, /@media \(prefers-reduced-motion: reduce\)/, 'inside a reduced-motion block');
});

test('the search grid still gives every hit the same shelf, stars included', () => {
  // Three results could each have claimed a plinth. They get the badge, because a
  // search result is by definition a guest appearance.
  const search = appSrc.slice(appSrc.indexOf('function renderSearchMatches'), appSrc.indexOf('function home('));
  assert.match(search, /shelfItemCard/, 'results are rendered with the shelf card');
  assert.doesNotMatch(search, /starPlinthHTML/, 'and never with the plinth');
});

/* ============================ the public release notes ============================
 * 1.2.10 is the release this work shipped in, and the public notes are the most
 * discoverable page on the site. These check the entry against the code and the
 * catalogue rather than against itself: a release note that names eight stars, a
 * tile size and a utility count should fail if any of those move. 1.2.11 and
 * 1.2.12 have since landed above it, so the entry is the third one down — and it is still
 * checked against the present, because a note that stops being true about the
 * code is worse than no note at all.
 */

test('1.2.10 is the public entry for this work, and 1.2.11 and 1.2.12 render above it', () => {
  assert.equal(APP_VERSION, '1.3', 'the kitchen reports the release it is');
  // appVersionLabel(), not APP_VERSION: this is the string the page actually
  // prints, and with no test version open it is the release and nothing else.
  assert.equal(appVersionLabel(), '1.3', 'and a public build prints nothing else');
  assert.equal(CHANGELOG[1].version, '1.2.12', 'newest first, because that is the order they render in');
  assert.equal(CHANGELOG[2].version, '1.2.11', 'then the release before it');
  assert.equal(CHANGELOG[3].version, '1.2.10', 'and the star work is two down');
  assert.equal(CHANGELOG[3].groups.length, 4, 'the plinth, the badge, the eight stars, and what did not change');
});

test('the public notes name the stars the catalogue actually has', () => {
  const text = CHANGELOG[3].groups.map(g => `${g.label} ${g.items.join(' ')}`).join(' ');
  for (const c of cupboards) {
    const star = c.tools.find(([id]) => id === c.star);
    assert.ok(text.includes(star[1]), `${star[1]} is named in the public notes`);
    assert.ok(text.includes(c.name), `and so is the cupboard it stars in, ${c.name}`);
  }
  assert.match(text, /Games & Fun gets no plinth/, 'including the cupboard that has none, and why');
  assert.match(text, /51 games are not one flagship/, 'in the reason rather than as an omission');
});

test('the public notes quote a description that is really on the plinth', () => {
  // The entry makes the case for a bigger tile by quoting one. If the catalogue
  // copy changes and the note does not, the note is quoting something no visitor
  // will ever read.
  const video = cupboards.find(c => c.id === 'video');
  const star = video.tools.find(([id]) => id === video.star);
  const text = CHANGELOG[3].groups.map(g => g.items.join(' ')).join(' ');
  assert.ok(text.includes(star[2]), `Waffle Studio's description is quoted verbatim: "${star[2]}"`);
  const art = cupboards.find(c => c.id === 'art');
  const artStar = art.tools.find(([id]) => id === art.star);
  assert.equal(artStar[1], 'Art Studio');
  assert.match(text, /layers, 18 brushes and a 4096 px canvas/i,
    'and Art Studio is described in the words its own catalogue entry uses');
});

test('the numbers in the public notes are the numbers in the build', () => {
  const text = CHANGELOG[3].groups.map(g => `${g.label} ${g.items.join(' ')}`).join(' ');
  // The note is a record of the kitchen as 1.2.10 shipped it, so it still says
  // 115 — five more utilities arrived in 1.2.11 and rewriting an old entry to
  // agree with the present is how a release note stops being a record.
  assert.equal(allTools.length, 120, 'the catalogue has moved on since that note was written');
  assert.match(text, /115 utilities across eight cupboards/, 'and the 1.2.10 note still says what was true then');
  assert.equal(cupboards.length, 8);
  assert.match(text, /the plinth tile drops to 74 px/, 'the collapsed tile size');
  assert.match(styleSrc, /\.star-plinth-tile \{ width: 74px; height: 74px; \}/, 'which is what the CSS says');
  // Measured out of the CSS rather than asserted, because the first version of
  // these notes said "twice the tile size" and the tiles are 108 px against 82 —
  // 1.32\u00D7 across, 1.76\u00D7 in area. A comparison written as `>= 2 * x - 20`
  // against a selector that did not match passed on a fallback of zero, which is
  // how an over-claim gets a green test attached to it.
  const plinthPx = Number(/\n\.star-plinth-tile \{[^}]*?width: (\d+)px/.exec(styleSrc)[1]);
  const shelfPx = Number(/\n\.object-tile \{[^}]*?width: (\d+)px/.exec(styleSrc)[1]);
  assert.equal(plinthPx, 108, 'the plinth tile, read out of the CSS');
  assert.equal(shelfPx, 82, 'and the shelf object it is being compared with');
  const areaRatio = (plinthPx / shelfPx) ** 2;
  assert.ok(areaRatio > 1.5 && areaRatio < 2,
    `close to twice the area, which is what the notes now claim (${areaRatio.toFixed(2)}\u00D7)`);
  assert.match(text, /108 px across against a shelf object\u2019s 82/, 'the note carries both numbers');
  assert.match(text, /close to twice the area/, 'and the honest ratio rather than the tidier one');
  assert.doesNotMatch(text, /twice the tile size/, 'the over-claim does not come back');
  assert.match(text, /prefers-reduced-motion/, 'the motion promise');
  assert.match(styleSrc, /\.star-plinth-open, \.star-plinth-open:active \{ transition: none; transform: none; \}/,
    'is a rule that exists');
});

test('the public notes describe a badge the code really renders', () => {
  const text = CHANGELOG[3].groups.map(g => g.items.join(' ')).join(' ');
  assert.match(text, /Star of Art & Coloring/, 'the badge is quoted as it appears');
  assert.match(plinth, /⭐ Star of \$\{esc\(cupName\)\}/, 'and that is the template it comes from');
  assert.match(text, /Open Art Studio, star of the Art & Coloring cupboard/, 'as is the aria-label');
  assert.match(plinth, /aria-label="Open \$\{esc\(t\.name\)\}, star of the \$\{esc\(cupName\)\} cupboard"/,
    'built from the same two values, so the two cannot disagree');
  assert.match(text, /never spoken twice/, 'the decorative star is hidden from a screen reader');
  assert.match(shelfCard, /aria-hidden="true">⭐/, 'in both layouts');
});

test('the public notes do not describe anything this release did not do', () => {
  const text = CHANGELOG[3].groups.map(g => `${g.label} ${g.items.join(' ')}`).join(' ');
  assert.match(text, /No behaviour did\./, 'it says so plainly, because that is the honest scope of a layout release');
  // The claims a layout release must not make. Each of these would be a promise
  // about something the star work does not touch.
  for (const claim of [/new utilit/i, /added .* tools?/i, /faster/i, /no longer needs WebGPU/i, /offline/i]) {
    assert.doesNotMatch(text, claim, `does not claim: ${claim}`);
  }
  // And the machinery behind a test build is not something a public note carries:
  // the release notes are the most discoverable page on the site.
  for (const forbidden of ['tvbr', 'tvar', 'dontaskme', 'backup.html', 'backupkitchen', 'passphrase']) {
    assert.ok(!JSON.stringify(CHANGELOG).toLowerCase().includes(forbidden),
      `the public notes never reveal "${forbidden}"`);
  }
});
