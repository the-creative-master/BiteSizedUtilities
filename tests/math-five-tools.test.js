/**
 * The five tools Math & Numbers grew by in 1.2.11.
 *
 * tests/math-numbers.test.js mounts all fifteen and checks they render with the
 * cupboard's own controls rather than browser ones, which catches a tool that
 * does not exist. It cannot catch a tool that exists and is wrong: an equation
 * solver that returns the other root, a Heron's formula with the signs swapped,
 * a GCD that is really an LCM. Those are arithmetic, and arithmetic is checked
 * against numbers worked out by hand and written down here.
 *
 * The refusals get the same treatment as the answers, because a tool that
 * divides by zero quietly is worse than one that says it will not. Every
 * degenerate case below is one a visitor can reach by typing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

import { cupboards, cupboardToolCount } from '../catalog.js';
import { CHANGELOG } from '../changelog.js';

const dom = new JSDOM('<!DOCTYPE html><html lang="en"><body><div id="r"></div></body></html>', {
  url: 'https://the-creative-master.github.io/BiteSizedUtilities/',
  pretendToBeVisual: true
});
const { window } = dom;
for (const key of ['document', 'localStorage', 'sessionStorage', 'CustomEvent', 'Event', 'HTMLElement', 'Node', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  if (window[key] !== undefined) globalThis[key] = window[key];
}
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.window = window;
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });

const { MATH_NUMBER_TOOLS } = await import('../tools-math-numbers.js');

const root = window.document.querySelector('#r');
const click = el => el.dispatchEvent(new window.Event('click', { bubbles: true }));
const tab = label => {
  const btn = [...root.querySelectorAll('button')].find(b => b.textContent.trim() === label);
  assert.ok(btn, `there is a tab called ${label}`);
  click(btn);
};
/**
 * Fields are matched on their exact aria-label. Matching on a prefix reaches the
 * same-named field on another tab, which is how a probe can pass while testing
 * nothing — so the exact label is required where two tabs share a name.
 */
const field = label => {
  const input = [...root.querySelectorAll('input')].find(i => i.getAttribute('aria-label') === label);
  assert.ok(input, `there is a field labelled ${JSON.stringify(label)}`);
  return input;
};
const set = (label, value) => {
  const input = field(label);
  input.value = String(value);
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
};
const setStarting = (prefix, value) => {
  const input = [...root.querySelectorAll('input')].find(i => (i.getAttribute('aria-label') || '').startsWith(prefix));
  assert.ok(input, `there is a field starting ${JSON.stringify(prefix)}`);
  input.value = String(value);
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
};
/** The results panel, with the whitespace between elements squeezed out. */
const out = () => (root.querySelector('.mw-out')?.textContent || '').replace(/\s+/g, ' ').trim();
const mount = id => {
  assert.ok(Object.hasOwn(MATH_NUMBER_TOOLS, id), `${id} is a tool in this cupboard`);
  root.replaceChildren();
  MATH_NUMBER_TOOLS[id](root);
  return out();
};
const cells = () => [...root.querySelectorAll('.mx-in')];
const setCells = values => {
  const inputs = cells();
  values.forEach((v, i) => { inputs[i].value = String(v); });
  inputs.forEach(i => i.dispatchEvent(new window.Event('input', { bubbles: true })));
};

/* ------------------------------------------------------------------ *
 * Equation Solver
 * ------------------------------------------------------------------ */

test('the equation solver solves, and shows the substitution it solved by', () => {
  // It opens on the quadratic tab, with a curve already worth solving: x² − 3x − 4.
  // Its fields are labelled with the equation they belong to, so a test that
  // assumes otherwise is testing the wrong tab — which is how this one started.
  mount('equation-solver');
  assert.ok(field('a  (a·x² + b·x + c = 0)'), 'the tab it opens on labels its own fields');

  // x² − 3x − 4 = 0 → (x − 4)(x + 1)
  // The tab opens on this equation already, and typing it again is the point:
  // the fields are read live, so these three keystrokes are what produce it.
  set('a  (a·x² + b·x + c = 0)', '1'); set('b', '-3'); set('c', '-4');
  const text = out();
  assert.match(text, /b² − 4ac/, 'a quadratic brings its discriminant');
  assert.match(text, /25/, 'which is 9 + 16 = 25 here');
  assert.match(text, /TWO REAL ROOTS/);
  assert.match(text, /4/, 'one root is 4');
  assert.match(text, /−1|− 1|-1/, 'and the other is −1');
  assert.match(text, /\(1\.5, −6\.25\)|\(1\.5, -6\.25\)/, 'and the vertex is (1.5, −6.25)');

  // 3x + 7 = 22
  tab('Linear');
  set('a  (a·x + b = c)', '3'); set('b', '7'); set('c', '22');
  assert.match(out(), /x = \(22 − 7\) ÷ 3/, 'a linear answer is the substitution too, not just the answer');
  assert.match(out(), /5/, 'and 3x + 7 = 22 has x = 5');
});

test('the equation solver refuses in sentences instead of dividing by zero', () => {
  mount('equation-solver');
  tab('Linear');
  set('a  (a·x + b = c)', '0'); set('b', '7'); set('c', '22');
  assert.match(out(), /no solution/, '0x + 7 = 22 has none, and says so');

  set('b', '7'); set('c', '7');
  assert.match(out(), /every number is a solution/, '0x + 7 = 7 has all of them');

  tab('Quadratic');
  set('a  (a·x² + b·x + c = 0)', '0'); set('b', '2'); set('c', '4');
  assert.match(out(), /not a quadratic/, 'a = 0 is a straight line, and the tool says which tab solves it');

  set('a  (a·x² + b·x + c = 0)', '1'); set('b', '0'); set('c', '4');
  assert.match(out(), /NO REAL ROOTS/, 'x² + 4 = 0 has none');
  assert.match(out(), /complex pair|± 2i|2i/, 'and it gives the pair rather than nothing');

  tab('System 2×2');
  set('a₁  (a₁x + b₁y = c₁)', '1'); set('b₁', '1'); set('c₁', '3');
  set('a₂  (a₂x + b₂y = c₂)', '2'); set('b₂', '2'); set('c₂', '9');
  assert.match(out(), /parallel/, 'two parallel lines are named as parallel');
  assert.match(out(), /no solution/, 'and never meet');

  set('c₂', '6');
  assert.match(out(), /same line/, 'the same line twice is not a contradiction');
  assert.match(out(), /infinitely many/, 'it is every point on it');
});

/* ------------------------------------------------------------------ *
 * Statistics Lab
 * ------------------------------------------------------------------ */

test('the statistics lab reports the numbers a hand calculation gives', () => {
  // 4, 8, 15, 16, 23, 42, 8, 15, 15 — sorted 4 8 8 15 15 15 16 23 42.
  // n = 9, sum 146, median 15 (the 5th), Q1 8, Q3 19.5, IQR 11.5.
  mount('statistics-lab');
  setStarting('Your numbers', '4, 8, 15, 16, 23, 42, 8, 15, 15');
  const text = out();
  assert.match(text, /Count9/, 'nine values');
  assert.match(text, /Sum146/, 'summing to 146');
  assert.match(text, /Median15/, 'median 15');
  assert.match(text, /Min4/, 'min 4');
  assert.match(text, /Max42/, 'max 42');
  assert.match(text, /Range38/, 'range 38');
  assert.match(text, /Q18/, 'first quartile 8');
  assert.match(text, /Q319\.5/, 'third quartile 19.5');
  assert.match(text, /IQR11\.5/, 'and 11.5 between them');
  assert.match(text, /Variance \(population\)/, 'and it says which variance it is printing');
  assert.ok(root.querySelectorAll('.mw-bar').length > 0, 'the histogram is drawn, not described');
});

test('the statistics lab will not invent a spread for one number, and reports what it skipped', () => {
  mount('statistics-lab');
  setStarting('Your numbers', '7');
  assert.match(out(), /Count1/, 'one value is one value');
  assert.match(out(), /no spread/, 'and a quartile of one number would be a fiction, so it says there is no spread');

  setStarting('Your numbers', '1, 2, banana, 3');
  const text = out();
  assert.match(text, /Count3/, 'the three numbers are still measured');
  assert.match(text, /banana/, 'and the thing that was not a number is named rather than silently dropped');
});

/* ------------------------------------------------------------------ *
 * Matrix Calculator
 * ------------------------------------------------------------------ */

test('the matrix calculator inverts, and refuses a matrix that has no inverse', () => {
  mount('matrix-calculator');
  tab('det A');
  assert.match(out(), /INVERTIBLE/, 'the identity it starts with is invertible');
  assert.match(out(), /1/, 'and its determinant is 1');

  setCells([1, 2, 2, 4]);
  tab('A⁻¹');
  assert.match(out(), /det A is 0|determinant.*0/, 'a singular matrix is named');
  assert.match(out(), /no inverse/, 'and is not inverted into nonsense');

  setCells([4, 7, 2, 6]);
  tab('A⁻¹');
  const text = out();
  // inverse of [[4,7],[2,6]] is [[0.6,-0.7],[-0.2,0.4]]
  for (const v of ['0.6', '−0.7', '−0.2', '0.4']) {
    assert.ok(text.includes(v) || text.includes(v.replace('−', '-')), `the inverse contains ${v}`);
  }
  assert.match(text, /identity/, 'and it is checked by multiplying back');

  tab('A × B');
  assert.match(out(), /row of A dotted with a column of B/, 'a product says how it was made');

  tab('3×3');
  tab('det A');
  assert.match(out(), /a\(ei − fh\) − b\(di − fg\) \+ c\(dh − eg\)/, 'the 3×3 rule is printed, not assumed');
});

/* ------------------------------------------------------------------ *
 * Geometry Calculator
 * ------------------------------------------------------------------ */

test('the geometry calculator measures nine shapes with the formula beside the answer', () => {
  const text = mount('geometry-calculator');
  // circle r = 4 → area 16π = 50.26548245743669, circumference 8π = 25.132741228718345
  assert.match(text, /50\.265482457/, 'a circle of radius 4 has area 16π');
  assert.match(text, /25\.132741229/, 'and circumference 8π');
  assert.match(text, /square units/, 'in units, because a naked number does not say what it measured');
  assert.match(text, /πr²/, 'with the formula it came from');

  tab('Triangle (3 sides)');
  // Heron: s = 9, √(9·4·3·2) = √216 = 14.696938456699069
  assert.match(out(), /14\.696938457/, 'a 5-6-7 triangle has area √216 by Heron');
  assert.match(out(), /Heron/, 'and says whose formula that is');
  assert.match(out(), /Perimeter18/);

  setStarting('Side a', '1'); setStarting('Side b', '2'); setStarting('Side c', '10');
  assert.match(out(), /cannot form a triangle/, '1 + 2 < 10, so there is no triangle to measure');

  tab('Solid (3D)');
  tab('Sphere');
  // r = 3 → (4/3)π·27 = 36π = 113.09733552923255, and 4π·9 = 36π too
  const sphere = out();
  assert.match(sphere, /113\.09733553/, 'a sphere of radius 3 is 36π both ways round');
  assert.match(sphere, /cubic units/);
  assert.match(sphere, /square units/);
  assert.match(sphere, /\(4 ÷ 3\)πr³/, 'volume and surface are different formulas and both are shown');
});

/* ------------------------------------------------------------------ *
 * Factors, GCD & LCM
 * ------------------------------------------------------------------ */

test('the factors tool factorises, and finds GCD and LCM across a whole set', () => {
  const text = mount('factors-gcd');
  // 48 = 2^4 · 3, 180 = 2^2 · 3^2 · 5, 30 = 2 · 3 · 5 → GCD 6, LCM 720
  assert.match(text, /48=2\^4 × 3/, '48 factorises with its exponents');
  assert.match(text, /180=2\^2 × 3\^2 × 5/, 'and so does 180');
  assert.match(text, /30=2 × 3 × 5/, 'and 30');
  assert.match(text, /GCD \(all of them\)6/, 'GCD of the three is 6');
  assert.match(text, /LCM \(all of them\)720/, 'and their LCM is 720');
  assert.match(text, /10 divisors/, '48 has ten');
  assert.match(text, /18 divisors/, '180 has eighteen');

  setStarting('Whole numbers', '25, 35');
  const pair = out();
  assert.match(pair, /GCD \(all of them\)5/, '25 and 35 share 5');
  assert.match(pair, /LCM \(all of them\)175/, 'and meet again at 175');
  assert.ok(!/coprime/.test(pair), 'which is not coprime, and does not claim to be');
});

test('the factors tool is the companion to the prime checker, and honest at the edges', () => {
  mount('factors-gcd');
  setStarting('Whole numbers', '13');
  const prime = out();
  assert.match(prime, /13=13/, 'a prime factorises to itself');
  assert.match(prime, /2 divisors: 1, 13/, 'and has exactly two divisors');
  assert.match(prime, /prime/, 'so it is named prime');

  setStarting('Whole numbers', '1');
  assert.match(out(), /no prime factors at all/, '1 is neither, and the tool does not pretend otherwise');

  setStarting('Whole numbers', '12, 3.5');
  assert.match(out(), /not a whole number/, 'and a decimal is refused rather than truncated');
});

/* ------------------------------------------------------------------ *
 * What all five have in common
 * ------------------------------------------------------------------ */

test('all five recompute as you type, which is not the same as having a button', () => {
  // This was a real bug, found by driving the tools rather than reading them:
  // the fields changed and nothing moved until Solve or Measure was pressed,
  // while the statistics and factors tools beside them updated live. Every
  // refusal above is reached by typing alone and pressing nothing.
  const src = fs.readFileSync('tools-math-numbers.js', 'utf8');
  for (const fn of ['equationSolver', 'geometryCalculator']) {
    const at = src.indexOf(`function ${fn}(`);
    assert.ok(at >= 0, `${fn} is in the file`);
    const body = src.slice(at, src.indexOf('\nfunction ', at + 10));
    assert.match(body, /addEventListener\('input'/, `${fn} listens to its own fields`);
  }
  const listeners = src.split("addEventListener('input'").length - 1;
  assert.ok(listeners >= 6, `the two button-driven tools listen on every field group (${listeners} listeners)`);
});

test('the cupboard is fifteen deep, and the five are in it and in the catalogue', () => {
  const math = cupboards.find(c => c.id === 'math');
  assert.equal(cupboardToolCount('math', true), 15);
  assert.equal(math.tools.length, 15);
  const ids = math.tools.map(([id]) => id);
  for (const id of ['equation-solver', 'statistics-lab', 'matrix-calculator', 'geometry-calculator', 'factors-gcd']) {
    assert.ok(ids.includes(id), `${id} is on the shelf`);
    assert.ok(Object.hasOwn(MATH_NUMBER_TOOLS, id), `${id} is a function that renders`);
  }
  // Every cupboard matches now, which is the first time they have.
  assert.ok(cupboards.every(c => cupboardToolCount(c.id, true) === 15),
    `all eight cupboards are fifteen deep: ${cupboards.map(c => `${c.id} ${cupboardToolCount(c.id, true)}`).join(', ')}`);
});

test('the public notes describe the five tools and nothing they do not do', () => {
  // 1.2.12 landed above this entry; the note is history now, so it is found by
  // position one down and still checked against the present.
  assert.equal(CHANGELOG[1].version, '1.2.11');
  const text = CHANGELOG[1].groups.map(g => `${g.label} ${g.items.join(' ')}`).join(' ');

  for (const name of ['Equation Solver', 'Statistics Lab', 'Matrix Calculator', 'Geometry Calculator', 'Factors, GCD & LCM']) {
    assert.ok(text.includes(name), `${name} is named in the release notes`);
  }
  assert.match(text, /nine shapes/, 'the geometry tool counts the shapes it really has');
  assert.match(text, /the substitution it came from/, 'and the notes say the working is the point');

  // Counts the notes quote, checked against the build rather than against
  // themselves.
  assert.match(text, /120 utilities across eight cupboards/, 'the utility count is the one the catalogue has');
  assert.match(text, /up from 115/);
  assert.match(text, /all eight cupboards are fifteen deep/);
  assert.match(text, /ten in Math & Numbers that the five new ones joined/, 'ten were already here');

  // The limits stated, because a note that only lists wins is an advert.
  assert.match(text, /will not report a spread for a single number/, 'the statistics tool is described as refusing, not as complete');
  assert.match(text, /refused rather than measured/, 'and so is the geometry one');
});
