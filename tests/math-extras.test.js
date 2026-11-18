// Drives the bodily, fraction and percentage calculators through the real UI and
// checks their numbers against hand-computed answers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mountMathScience } from '../tools-math-science.js';

function makeDOMShim() {
  class FakeEvent {
    constructor(type, init = {}) { Object.assign(this, init); this.type = type; this.defaultPrevented = false; }
    preventDefault() { this.defaultPrevented = true; }
  }
  class FakeElement {
    constructor(tagName) {
      this.tagName = String(tagName).toUpperCase();
      this.children = [];
      this.parentNode = null;
      this.attrs = {};
      this.style = {};
      this.dataset = {};
      this.listeners = {};
      this._text = '';
      this.value = '';
      this.hidden = false;
      this.classList = {
        add: (...c) => { this.className = [...new Set([...this.classes, ...c])].join(' '); },
        remove: (...c) => { this.className = this.classes.filter(x => !c.includes(x)).join(' '); },
        toggle: (c, force) => {
          const has = this.classes.includes(c);
          const next = force === undefined ? !has : Boolean(force);
          if (next) this.classList.add(c); else this.classList.remove(c);
          return next;
        },
        contains: c => this.classes.includes(c)
      };
    }
    get classes() { return String(this.className || '').split(/\s+/).filter(Boolean); }
    get nodeType() { return 1; }
    get textContent() { return this._text || this.children.map(c => c.textContent ?? String(c)).join(''); }
    set textContent(v) { this._text = String(v); this.children = []; }
    get innerHTML() { return this._text; }
    set innerHTML(v) { this._text = String(v); this.children = []; }
    setAttribute(k, v) {
      this.attrs[k] = String(v);
      if (k === 'class') this.className = String(v);
      if (k.startsWith('data-')) this.dataset[k.slice(5)] = String(v);
      if (k === 'value' && this.tagName === 'INPUT') this.value = String(v);
    }
    getAttribute(k) { return this.attrs[k] ?? null; }
    append(...nodes) {
      for (const n of nodes) {
        if (n && typeof n === 'object') {
          if (n.parentNode && n.parentNode !== this && Array.isArray(n.parentNode.children)) {
            n.parentNode.children = n.parentNode.children.filter(c => c !== n);
          }
          const at = this.children.indexOf(n);
          if (at >= 0) this.children.splice(at, 1);
          n.parentNode = this;
          this.children.push(n);
        } else if (n != null) this.children.push({ nodeType: 3, textContent: String(n) });
      }
    }
    replaceChildren(...nodes) { this.children = []; this._text = ''; this.append(...nodes); }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    dispatchEvent(evt) { for (const fn of this.listeners[evt.type] || []) fn.call(this, evt); }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    querySelectorAll(sel) {
      const out = [];
      const visit = node => {
        for (const c of node.children || []) {
          if (c.nodeType !== 1) continue;
          if (sel.startsWith('.') && c.classes?.includes(sel.slice(1))) out.push(c);
          visit(c);
        }
      };
      visit(this);
      return out;
    }
    // The slider track maps a pointer x onto its range, so it needs a real rect.
    getBoundingClientRect() { return { left: 0, top: 0, width: 320, height: 24 }; }
    focus() {}
  }
  globalThis.document = {
    documentElement: new FakeElement('html'),
    body: new FakeElement('body'),
    createElement: tag => new FakeElement(tag),
    createTextNode: text => ({ nodeType: 3, textContent: String(text) })
  };
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.Event = FakeEvent;
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
}

const walk = (node, out = []) => {
  for (const c of node.children || []) {
    if (!c || c.nodeType !== 1) continue;
    out.push(c);
    walk(c, out);
  }
  return out;
};
const byClass = (root, cls) => walk(root).filter(n => n.classes?.includes(cls));
const click = node => node.dispatchEvent(new globalThis.Event('click'));
const fire = (node, type, init) => node.dispatchEvent(new globalThis.Event(type, init));
const byAria = (root, label) => walk(root).find(n => n.getAttribute && n.getAttribute('aria-label') === label);
/** A tab's label without its emoji icon, which lives in its own span. */
const tabLabel = t => {
  const icon = byClass(t, 'gtab-icon')[0];
  return icon ? t.textContent.slice(icon.textContent.length) : t.textContent;
};
const tabNamed = (root, label) => {
  const tabs = byClass(root, 'gtab');
  const t = tabs.find(b => tabLabel(b) === label);
  assert.ok(t, `a tab called "${label}" exists (has ${tabs.map(tabLabel).join(', ')})`);
  return t;
};
const mount = id => {
  const root = globalThis.document.createElement('div');
  assert.ok(mountMathScience(id, root), `${id} mounts`);
  return root;
};
/** Slides a game slider to an exact value by aiming its pointer handler at the right pixel. */
function setSlider(root, label, target) {
  const wrap = byClass(root, 'gslider-wrap').find(w => byClass(w, 'gslider-label')[0]?.textContent === label);
  assert.ok(wrap, `a slider called "${label}" exists`);
  const thumb = byClass(wrap, 'gslider-thumb')[0];
  const min = Number(thumb.getAttribute('aria-valuemin'));
  const max = Number(thumb.getAttribute('aria-valuemax'));
  const track = byClass(wrap, 'gslider-track')[0];
  fire(track, 'pointerdown', { clientX: 320 * (target - min) / (max - min), pointerId: 1 });
  return wrap;
}
const sliderValue = (root, label) => {
  const wrap = byClass(root, 'gslider-wrap').find(w => byClass(w, 'gslider-label')[0]?.textContent === label);
  return byClass(wrap, 'gslider-badge')[0].textContent;
};
const statOf = (root, label) => {
  const box = byClass(root, 'stat-box').find(b => b.children[0]?.textContent === label);
  assert.ok(box, `a stat box called "${label}" exists (has ${byClass(root, 'stat-box').map(b => b.children[0]?.textContent).join(' | ')})`);
  return box.children[1].textContent;
};

// ---------------------------------------------------------------- bodily ---

test('the bodily calculator reads neck and hip and reports eleven more things', () => {
  makeDOMShim();
  const root = mount('bodily-calculator');

  const sliders = byClass(root, 'gslider-label').map(l => l.textContent);
  for (const label of ['Height (cm)', 'Weight (kg)', 'Age (years)', 'Waist (cm)', 'Neck (cm)', 'Hip (cm)']) {
    assert.ok(sliders.includes(label), `a ${label} slider exists`);
  }
  assert.ok(byClass(root, 'stat-box').length >= 14, `${byClass(root, 'stat-box').length} readings on the card`);

  // 170 cm, 66 kg, 26 years, waist 76, neck 33, hip 95, female, light activity.
  assert.equal(byClass(root, 'stat-big')[0].textContent, '22.8', 'BMI is 66 / 1.7²');
  assert.equal(statOf(root, '🔥 Resting BMR (Mifflin)'), '1432 kcal/day', '10·66 + 6.25·170 − 5·26 − 161');
  assert.equal(statOf(root, '🔥 Resting BMR (Harris-Benedict)'), '1472 kcal/day', 'a second opinion from 1919, revised');
  assert.equal(statOf(root, '⚡ Daily Calories'), '1968 kcal/day', 'BMR × 1.375');
  assert.equal(statOf(root, '⚖️ Healthy Weight'), '53.5–72.0 kg', 'BMI 18.5 to 24.9 at this height');
  assert.equal(statOf(root, '📐 Body Surface Area'), '1.77 m² (Mosteller)', '√(170·66/3600)');
  assert.equal(statOf(root, '🎯 Ideal Weight'), '61.4 kg (Devine)', '45.5 + 2.3 per inch over five feet');
  assert.equal(statOf(root, '💧 Daily Water'), '2.3 L/day', '35 mL per kg');
  assert.equal(statOf(root, '🍗 Protein Target'), '53–106 g/day', '0.8 to 1.6 g per kg');
  assert.equal(statOf(root, '📊 BMI Prime'), '0.91 (Cozy)', 'BMI ÷ 25');
  assert.equal(statOf(root, '📏 Ponderal Index'), '13.4 kg/m³', 'kg ÷ m³, which tall people deserve');
  assert.equal(statOf(root, '📏 Waist / Height'), '0.45 (Balanced)');
  assert.equal(statOf(root, '📏 Waist / Hip'), '0.80 (Balanced)', 'under 0.85 for a female');

  // The tape test: 495 / (1.29579 − 0.35004·log10(76+95−33) + 0.221·log10(170)) − 455
  assert.equal(statOf(root, '🥧 Body Fat (Navy)'), '21.1% (Fit)');
  assert.equal(statOf(root, '🥩 Lean Mass'), '52.1 kg', '66 kg minus 21.1%');
});

test('the bodily calculator switches formula, units and activity level', () => {
  makeDOMShim();
  const root = mount('bodily-calculator');

  // The male tape test drops the hip term entirely and lands much lower.
  click(tabNamed(root, 'Male'));
  assert.equal(statOf(root, '🥧 Body Fat (Navy)'), '9.6% (Athletic)', '495/(1.0324 − 0.19077·log10(43) + 0.15456·log10(170)) − 455');
  assert.equal(statOf(root, '🥩 Lean Mass'), '59.7 kg');
  assert.equal(statOf(root, '🎯 Ideal Weight'), '65.9 kg (Devine)', '50 + 2.3 per inch over five feet');
  assert.equal(statOf(root, '🔥 Resting BMR (Mifflin)'), '1598 kcal/day', 'the male constant is +5');
  assert.equal(statOf(root, '🔥 Resting BMR (Harris-Benedict)'), '1641 kcal/day');
  assert.equal(statOf(root, '📏 Waist / Hip'), '0.80 (Balanced)', 'the male limit is 0.90');

  // A fifth activity level.
  click(tabNamed(root, 'Two-a-days'));
  assert.equal(statOf(root, '⚡ Daily Calories'), '3035 kcal/day', 'BMR × 1.9');

  // Imperial relabels every slider and rewrites the badges.
  click(byAria(root, 'Unit system'));
  assert.equal(byClass(root, 'gslider-label')[0].textContent, 'Height (ft / in)');
  assert.match(sliderValue(root, 'Height (ft / in)'), /^\d+'\d+"$/, 'height is shown as feet and inches');
  assert.match(sliderValue(root, 'Weight (lb)'), /^\d+ lb$/);
  assert.match(sliderValue(root, 'Neck (in)'), /^\d+ in$/);
  assert.match(statOf(root, '🎯 Ideal Weight'), /^\d+ lb \(Devine\)$/, 'the ideal weight follows the unit system');
  assert.match(statOf(root, '⚖️ Healthy Weight'), /^\d+–\d+ lb$/);

  // Sliders drive the numbers: a heavier reading moves BMI, water and protein.
  click(byAria(root, 'Unit system'));                       // back to metric
  setSlider(root, 'Weight (kg)', 90);
  assert.equal(byClass(root, 'stat-big')[0].textContent, '31.1', '90 / 1.7² is 31.1');
  assert.equal(byClass(root, 'gbadge')[0].textContent, 'High BMI');
  assert.equal(statOf(root, '💧 Daily Water'), '3.1 L/day');
  assert.equal(statOf(root, '🍗 Protein Target'), '72–144 g/day');

  // A neck wider than the waist cannot work in the male formula, and says so.
  click(tabNamed(root, 'Male'));
  setSlider(root, 'Waist (cm)', 50);
  setSlider(root, 'Neck (cm)', 60);
  assert.equal(statOf(root, '🥧 Body Fat (Navy)'), 'Check the tape readings');
  assert.equal(statOf(root, '🥩 Lean Mass'), '—');
});

// ------------------------------------------------------------- fractions ---

const fractionResult = root => {
  const stacked = byClass(root, 'frac-stacked')[0];
  assert.ok(stacked, 'a result fraction is shown');
  return walk(stacked).filter(n => n.tagName === 'SPAN').map(s => s.textContent).join('/');
};
const fractionDetail = root => byClass(root, 'output')[0].textContent;
const fractionWorking = root => byClass(root, 'frac-working')[0].textContent;
const insightOf = (root, label) => {
  const row = byClass(root, 'frac-insight-row').find(r => byClass(r, 'frac-insight-label')[0]?.textContent === label);
  assert.ok(row, `an insight called "${label}" exists`);
  return byClass(row, 'frac-insight-value')[0].textContent;
};
function setFraction(root, which, n, d) {
  const num = byAria(root, `Fraction ${which} numerator`);
  const den = byAria(root, `Fraction ${which} denominator`);
  num.value = String(n);
  fire(num, 'input');
  den.value = String(d);
  fire(den, 'input');
}

test('the fraction calculator does eight operations and shows its working', () => {
  makeDOMShim();
  const root = mount('fractions');

  const ops = byClass(root, 'gtab').map(t => t.textContent);
  assert.deepEqual(ops, ['+', '−', '×', '÷', 'Average', 'Difference', 'A as % of B', 'Flip A'], 'eight ways to combine two fractions');

  // 1/2 and 1/3 are already in the boxes.
  const cases = [
    ['+', '5/6', 'proper fraction 5/6', '3/6 + 2/6 = 5/6'],
    ['−', '1/6', 'proper fraction 1/6', '3/6 − 2/6 = 1/6'],
    ['×', '1/6', 'proper fraction 1/6', '1×1 over 2×3 = 1/6'],
    ['÷', '3/2', 'mixed 1 1/2', '1/2 × 3/1 = 3/2'],
    ['Average', '5/12', 'proper fraction 5/12', '(1/2 + 1/3) ÷ 2 = 5/12'],
    ['Difference', '1/6', 'proper fraction 1/6', '|1/2 − 1/3| = 1/6'],
    ['A as % of B', '3/2', 'Percent: 150%', '1/2 ÷ 1/3 × 100'],
    ['Flip A', '2/1', 'whole number 2', 'flip 1/2 upside down']
  ];
  for (const [op, fraction, detail, working] of cases) {
    click(tabNamed(root, op));
    assert.equal(fractionResult(root), fraction, `${op} gives ${fraction}`);
    assert.ok(fractionDetail(root).includes(detail), `${op} explains itself: "${fractionDetail(root)}"`);
    assert.ok(fractionWorking(root).includes(working), `${op} shows its working: "${fractionWorking(root)}"`);
  }

  // Every result also carries a decimal and a percentage.
  click(tabNamed(root, '+'));
  assert.match(fractionDetail(root), /Decimal: 0\.83333333333/, 'the decimal is carried to eleven digits');
  assert.match(fractionDetail(root), /Percent: 83\.333333333%/, 'and the percentage too');

  // Reduction is shown, not just done.
  setFraction(root, 'A', 4, 8);
  setFraction(root, 'B', 2, 4);
  assert.equal(fractionResult(root), '1/1', '4/8 + 2/4 is one whole');
  assert.equal(fractionDetail(root).split('\n')[0], 'whole number 1');
  assert.match(fractionWorking(root), /divide top and bottom by 32/, 'it shows the common factor it cancelled');
});

test('the fraction insight strip explains both fractions and compares them', () => {
  makeDOMShim();
  const root = mount('fractions');

  assert.equal(byClass(root, 'frac-pie-cell').length, 3, 'a pie for A, a pie for B and a pie for the result');
  const rows = byClass(root, 'frac-insight-row').map(r => byClass(r, 'frac-insight-label')[0].textContent);
  for (const label of ['A simplified', 'B simplified', 'A as a decimal', 'A as a percent', 'Flip A (reciprocal)',
    'Greatest common divisor', 'Lowest common denominator', 'Comparing them', 'How much bigger']) {
    assert.ok(rows.includes(label), `the strip explains "${label}"`);
  }

  assert.equal(insightOf(root, 'A simplified'), '1/2');
  assert.equal(insightOf(root, 'A as a decimal'), '0.5');
  assert.equal(insightOf(root, 'A as a percent'), '50%');
  assert.equal(insightOf(root, 'Flip A (reciprocal)'), '2/1');
  assert.equal(insightOf(root, 'Lowest common denominator'), '6 — A becomes 3/6, B becomes 2/6');
  assert.equal(insightOf(root, 'Comparing them'), 'A is bigger');
  assert.match(insightOf(root, 'How much bigger'), /^1\/6 \(0\.16666666667\)$/);

  // An unsimplified input is reduced in the strip.
  setFraction(root, 'A', 4, 8);
  assert.equal(insightOf(root, 'A simplified'), '1/2', '4/8 is really 1/2');
  assert.equal(insightOf(root, 'Comparing them'), 'A is bigger', '4/8 is 1/2, which still beats 1/3');
  setFraction(root, 'B', 3, 4);
  assert.equal(insightOf(root, 'Comparing them'), 'B is bigger', '1/2 is less than 3/4');
  assert.equal(insightOf(root, 'Lowest common denominator'), '4 — A becomes 2/4, B becomes 3/4');
  assert.equal(insightOf(root, 'Greatest common divisor'), '1 of the numerators, 2 of the denominators');
  setFraction(root, 'A', 0, 5);
  assert.equal(insightOf(root, 'Flip A (reciprocal)'), 'zero has no reciprocal');
});

test('the fraction calculator refuses nonsense in plain language', () => {
  makeDOMShim();
  const root = mount('fractions');

  setFraction(root, 'B', 1, 0);
  assert.equal(fractionDetail(root), 'Denominators cannot be zero!');
  assert.equal(byClass(root, 'frac-insight-row').length, 0, 'a refused calculation shows no insights');
  assert.equal(byClass(root, 'frac-pie-cell').length, 0, 'and no pies');

  setFraction(root, 'B', 1, 3);
  const num = byAria(root, 'Fraction A numerator');
  num.value = '1.5';
  fire(num, 'input');
  assert.equal(fractionDetail(root), 'Enter whole numbers in every fraction box.');

  num.value = '0';
  fire(num, 'input');
  click(tabNamed(root, 'Flip A'));
  assert.equal(fractionDetail(root), 'Zero has no reciprocal!');
  click(tabNamed(root, '÷'));
  assert.equal(fractionResult(root), '0/1', 'zero divided by a third is legitimately zero');

  // It is the divisor being zero that is refused, not the dividend.
  setFraction(root, 'B', 0, 3);
  assert.equal(fractionDetail(root), 'Cannot divide by a zero fraction!');
  click(tabNamed(root, 'A as % of B'));
  assert.equal(fractionDetail(root), 'Cannot take a percentage of a zero fraction!');

  // Huge but legal integers still work, because the arithmetic is BigInt.
  click(tabNamed(root, '+'));
  setFraction(root, 'A', '123456789012345678901234567890', 3);
  setFraction(root, 'B', 1, 7);
  const gcd = (x, y) => { x = x < 0n ? -x : x; y = y < 0n ? -y : y; while (y) [x, y] = [y, x % y]; return x; };
  let wantN = 123456789012345678901234567890n * 7n + 1n * 3n;
  let wantD = 3n * 7n;
  const g = gcd(wantN, wantD);
  wantN /= g; wantD /= g;
  assert.equal(fractionResult(root), `${wantN}/${wantD}`, 'a 30-digit numerator keeps every digit');
  assert.ok(String(wantN).length >= 25, 'and never rounds through a float');
});

// ----------------------------------------------------------- percentage ---

const pctFields = root => byClass(root, 'gfield-input');
function pctSet(root, a, b) {
  const [fa, fb] = pctFields(root);
  fa.value = String(a);
  fire(fa, 'input');
  fb.value = String(b);
  fire(fb, 'input');
}
const pctTag = root => byClass(root, 'price-tag-val')[0].textContent;
const pctOut = root => byClass(root, 'output')[0].textContent;
const pctWorking = root => byClass(root, 'pct-working')[0].textContent;
const pctFill = root => byClass(root, 'pct-fill')[0].style.width;

test('the percentage calculator does nine jobs and shows the arithmetic', () => {
  makeDOMShim();
  const root = mount('percentage');

  const modes = byClass(root, 'gtab').map(tabLabel);
  assert.deepEqual(modes, ['A% of B', 'A is ?% of B', '% Change', 'Sale Discount', 'Add % / Tip',
    'B is A% of what?', 'Take A% out of B', 'Margin & Markup', 'A% Repeated B Times'], 'nine percentage jobs');

  const cases = [
    ['A% of B', 20, 150, '30', '20% of 150 = 30', '150 × 20 ÷ 100'],
    ['A is ?% of B', 30, 150, '20%', '30 is 20% of 150', '30 ÷ 150 × 100'],
    ['% Change', 100, 125, '+25%', '+25% change (difference 25) — a rise', '(125 − 100) ÷ |100| × 100'],
    ['% Change', 100, 80, '-20%', '-20% change (difference -20) — a fall', '(80 − 100) ÷ |100| × 100'],
    ['Sale Discount', 20, 150, '120', 'Pay 120   •   You save 30 (20% off 150)', '150 − (150 × 20 ÷ 100)'],
    ['Add % / Tip', 15, 100, '115', 'Total 115   •   Added 15 (+15%)', '100 × (1 + 15 ÷ 100)'],
    ['B is A% of what?', 20, 150, '750', '150 is 20% of 750', '150 ÷ (20 ÷ 100)'],
    ['Take A% out of B', 5, 105, '100', 'Before tax 100   •   The 5% inside it is 5', '105 ÷ (1 + 5 ÷ 100)'],
    ['Margin & Markup', 80, 100, '20%', 'Margin 20%   •   Markup 25%   •   Profit 20', 'margin = profit ÷ selling price'],
    ['A% Repeated B Times', 10, 3, '+33.1%', 'multiplies by 1.331', '(1 + 10 ÷ 100) ^ 3']
  ];
  for (const [mode, a, b, tag, text, working] of cases) {
    click(tabNamed(root, mode));
    pctSet(root, a, b);
    assert.equal(pctTag(root), tag, `${mode}: the tag reads ${tag}`);
    assert.ok(pctOut(root).includes(text), `${mode}: "${pctOut(root)}"`);
    assert.ok(pctWorking(root).includes(working), `${mode} shows its working: "${pctWorking(root)}"`);
  }

  // Compounding is the one people get wrong, so it says so out loud.
  click(tabNamed(root, 'A% Repeated B Times'));
  pctSet(root, 10, 3);
  assert.match(pctOut(root), /not 30%/, 'it points out that three 10% rises are not 30%');

  // The coin row is a percentage shortcut, so it hides when A is not a percentage.
  const coins = byClass(root, 'preset-row')[0];
  for (const mode of ['A% of B', 'Sale Discount', 'Take A% out of B', 'B is A% of what?']) {
    click(tabNamed(root, mode));
    assert.equal(coins.hidden, false, `${mode} keeps the coins`);
  }
  for (const mode of ['A is ?% of B', '% Change', 'Margin & Markup']) {
    click(tabNamed(root, mode));
    assert.equal(coins.hidden, true, `${mode} hides the coins because A is not a percentage`);
  }

  // The coins still work, and the field labels follow the mode.
  click(tabNamed(root, 'A% of B'));
  assert.ok(byClass(root, 'gfield-label').some(l => l.textContent === 'Percent A (%)'), 'the field is labelled for the job');
  const coin = byClass(root, 'gbtn-coin').find(c => c.textContent === '12.5%');
  pctSet(root, 20, 200);
  click(coin);
  assert.equal(pctTag(root), '25', 'tapping the 12.5% coin gives 25 out of 200');
  click(tabNamed(root, 'Margin & Markup'));
  assert.equal(pctFields(root)[0].getAttribute('aria-label'), 'What It Cost You', 'the fields are relabelled for the job');
  assert.equal(pctFields(root)[1].getAttribute('aria-label'), 'What You Sold It For');
});

test('the percentage calculator refuses bad input instead of breaking', () => {
  makeDOMShim();
  const root = mount('percentage');

  click(tabNamed(root, 'A is ?% of B'));
  pctSet(root, 5, 0);
  assert.equal(pctOut(root), 'Whole B cannot be zero.');
  assert.equal(pctTag(root), '—');

  click(tabNamed(root, '% Change'));
  pctSet(root, 0, 5);
  assert.equal(pctOut(root), 'Original value A cannot be zero.');

  click(tabNamed(root, 'B is A% of what?'));
  pctSet(root, 0, 5);
  assert.match(pctOut(root), /Zero percent of anything is zero/);

  click(tabNamed(root, 'Margin & Markup'));
  pctSet(root, 0, 100);
  assert.equal(pctOut(root), 'Markup needs a cost that is not zero.');
  pctSet(root, 80, 0);
  assert.equal(pctOut(root), 'The selling price cannot be zero.');

  click(tabNamed(root, 'Take A% out of B'));
  pctSet(root, -100, 50);
  assert.match(pctOut(root), /cannot include −100% tax/);

  click(tabNamed(root, 'A% of B'));
  pctSet(root, 'abc', 5);
  assert.equal(pctOut(root), 'Enter valid numbers in both boxes.');
  assert.equal(pctTag(root), '?');
  assert.equal(pctFill(root), '0%');

  // A finite pair whose answer overflows used to throw out of the input handler.
  pctSet(root, '1e200', '1e200');
  assert.equal(pctOut(root), 'Result is out of range.', 'an overflow is reported, not thrown');
  assert.equal(pctTag(root), '—');

  click(tabNamed(root, 'A% Repeated B Times'));
  pctSet(root, 100, 5000);
  assert.match(pctOut(root), /grows past any number/, 'doubling five thousand times is refused politely');
});
