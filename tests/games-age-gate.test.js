/**
 * The cabinet's age warning.
 *
 * BitLife is a life simulation built around grown-up life — relationships and
 * sex, crime and prison, drinking, gambling and money — and it sat on the same
 * shelf as 2048 and Google Dino with nothing to say so, one tap from opening.
 * These pin the three things that make the warning worth having: it is visible
 * before the game is opened, there is no route into the game that does not pass
 * it, and it comes back every time rather than being remembered after one tap.
 *
 * The second of those is the one that is easy to get wrong. The player window
 * carries three links to the game in its header as well as two in the launcher,
 * so a gate that only covers the launcher is a warning with a door around it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const SITE = 'https://the-creative-master.github.io/BiteSizedUtilities/';
const catalog = JSON.parse(fs.readFileSync('games/catalog.json', 'utf8'));
const games = Array.isArray(catalog) ? catalog : catalog.games;
const byId = id => games.find(g => g.id === id);

test('the rating lives in the cabinet list, with its reason', () => {
  const bitlife = byId('bitlife');
  assert.ok(bitlife, 'BitLife is catalogued');
  assert.equal(bitlife.age, '16+', 'and it is the one the warning was written for');
  assert.ok(bitlife.ageNote && bitlife.ageNote.length > 60, 'with a reason long enough to actually explain itself');
  assert.match(bitlife.ageNote, /not a game for a young child/, 'which says plainly who it is not for');
  assert.match(bitlife.ageNote, /17\+/, 'and where the commercial rating sits, since it is harsher than the pill');

  const rated = games.filter(g => g.age);
  assert.equal(rated.length, 1, 'one game in 51 carries a rating — adding another is a deliberate act, not a default');
  for (const g of rated) {
    assert.match(g.age, /^\d+\+$/, `${g.id}: a rating is an age and a plus, nothing freer than that`);
    assert.ok(g.ageNote && g.ageNote.length > 40, `${g.id}: a rating without a reason is just a number on a shelf`);
  }
  // The rest of the cabinet is cartoon and abstract action. Rating those too
  // would put a red wall in front of the games a six-year-old is the right age
  // for, which is how warnings get tapped past without being read.
  for (const id of ['2048', 'google-dino', 'kitchen-snake', 'bloons-td', 'tic-tac-toe', 'recoil']) {
    assert.equal(byId(id).age, undefined, `${id} is not rated, and should not be`);
  }
});

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: SITE,
  pretendToBeVisual: true
});
const win = dom.window;
for (const key of ['window', 'document', 'HTMLElement', 'Node', 'Element', 'Event', 'CustomEvent', 'AbortController',
  'MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle', 'localStorage',
  'sessionStorage', 'Blob', 'URL', 'Image', 'DOMParser']) {
  if (key in win) {
    try { globalThis[key] = win[key]; } catch { Object.defineProperty(globalThis, key, { value: win[key], configurable: true }); }
  }
}
globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;
// The arcade reads its own cabinet over the network; hand it the real file.
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => catalog });

const { mountGames } = await import('../games.js');
const root = win.document.getElementById('root');
await mountGames(root);

const card = id => {
  const btn = root.querySelector(`button[aria-label="Play ${byId(id).title}"]`);
  assert.ok(btn, `the ${id} card is on the shelf`);
  return btn;
};
const player = () => root.querySelector('.arcade-player-window');
const links = () => [...player().querySelectorAll('a')].filter(a => (a.getAttribute('href') || '').includes('bitlife'));
const visible = el => Boolean(el) && !el.hidden && !el.closest('[hidden]');

test('the shelf says so before the game is ever opened', () => {
  const rated = card('bitlife').querySelector('.arcade-age-pill');
  assert.ok(rated, 'BitLife carries a pill on its tile');
  assert.match(rated.textContent, /16\+/, 'reading 16+');
  assert.match(rated.title, /BitLife is rated 16\+/, 'and saying so to anybody hovering it');
  assert.equal(card('2048').querySelector('.arcade-age-pill'), null, 'while 2048 does not');
  assert.equal(card('google-dino').querySelector('.arcade-age-pill'), null, 'and neither does Google Dino');
});

test('opening a rated game puts the warning where the play buttons were', () => {
  card('bitlife').click();
  const gate = player().querySelector('.arcade-age-gate');
  assert.ok(gate, 'the gate is up');
  assert.equal(gate.getAttribute('role'), 'alert', 'announced as an alert rather than left as decoration');
  assert.match(gate.querySelector('.arcade-age-stamp').textContent, /16\+/, 'with the rating big enough to see');
  assert.match(gate.querySelector('.arcade-age-head').textContent, /Stop — BitLife is rated 16\+\./, 'and a headline that starts with stop');
  assert.match(gate.querySelector('.arcade-age-why').textContent, /not a game for a young child/, 'saying who it is not for');
  assert.match(gate.querySelector('.arcade-age-who').textContent, /pick something else off the shelf/, 'and what to do instead');
  assert.match(gate.querySelector('.arcade-age-fresh').textContent, /comes back every time/, 'with no promise that answering it once is enough');

  // The part that matters: every route into the game is dark while this is up.
  assert.ok(links().length >= 3, 'the player really does carry several links into the game');
  for (const a of links()) assert.equal(visible(a), false, `no link into BitLife is reachable: ${a.textContent}`);
  assert.equal(visible(player().querySelector('.arcade-launcher-card')), false, 'the launcher is hidden');
  assert.equal(visible(player().querySelector('.window-head-actions')), false, 'and so are the header links, which is the door people forget');
});

test('answering the warning opens the game, and only answering it does', () => {
  const gate = player().querySelector('.arcade-age-gate');
  const enter = [...gate.querySelectorAll('button')].find(b => /I am 16\+\. Open it\./.test(b.textContent));
  assert.ok(enter, 'the way through says the age out loud rather than just "continue"');
  const back = [...gate.querySelectorAll('button')].find(b => /Take me back/.test(b.textContent));
  assert.ok(back, 'and the way out is right beside it');

  enter.click();
  assert.equal(player().querySelector('.arcade-age-gate'), null, 'the gate is gone once it is answered');
  assert.ok(links().some(visible), 'a link into the game is live again');
  assert.equal(visible(player().querySelector('.arcade-launcher-card')), true, 'with the launcher back');
  assert.equal(visible(player().querySelector('.window-head-actions')), true, 'and the header actions');
});

test('nothing is remembered: the next open starts at the warning again', () => {
  player().querySelector('.window-close-x').click();
  assert.equal(player().hidden, true, 'closing the player closes it');
  card('bitlife').click();
  assert.ok(player().querySelector('.arcade-age-gate'), 'the warning is back, because a child who tapped through it once has not bought the game');
  for (const a of links()) assert.equal(visible(a), false, 'and the links are dark again with it');
  assert.equal(win.localStorage.length, 0, 'nothing was stored to remember the answer by');
});

test('an unrated game opens straight into its launcher', () => {
  player().querySelector('.window-close-x').click();
  card('2048').click();
  assert.equal(player().querySelector('.arcade-age-gate'), null, 'no gate for a game with no rating');
  assert.equal(visible(player().querySelector('.arcade-launcher-card')), true, 'the launcher is there immediately');
  assert.equal(visible(player().querySelector('.window-head-actions')), true, 'and so are the header links');
});

test('the warning is styled, not just present', () => {
  const css = fs.readFileSync('style.css', 'utf8');
  const gate = css.slice(css.indexOf('.arcade-age-gate {'));
  assert.ok(css.includes('.arcade-age-pill'), 'the shelf pill has a rule of its own');
  assert.match(gate.slice(0, 400), /border: 4px solid #b3261e/, 'the gate is drawn in red with a border you cannot miss');
  assert.match(gate.slice(0, 400), /background: #fff1e6/, 'on a background that is not the rest of the cabinet');
  const stamp = css.slice(css.indexOf('.arcade-age-stamp {'));
  assert.match(stamp.slice(0, 400), /font-size: 34px/, 'and the rating itself is set large');
});
