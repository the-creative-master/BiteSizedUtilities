// Drives the eight WAFFLE-CALC chassis through the real UI: every model must
// mount, show its own model number, lay its keys out on a grid that divides
// evenly, and actually compute — including the scientific PRO block.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mountMathScience } from '../tools-math-science.js';

/**
 * Minimal DOM. Compared with the shim in all-tools-ui.test.js this one also
 * implements text-selection state (the keypad inserts at the caret) and a
 * localStorage stub (the chosen model is remembered).
 */
function makeDOMShim() {
  class FakeEvent {
    constructor(type) { this.type = type; this.defaultPrevented = false; }
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
      this.selectionStart = 0;
      this.selectionEnd = 0;
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
    setAttribute(k, v) {
      this.attrs[k] = String(v);
      if (k === 'class') this.className = String(v);
      if (k.startsWith('data-')) this.dataset[k.slice(5)] = String(v);
      // A real <input value="..."> reflects onto the value property, and the
      // calculator opens with a worked example already in its screen.
      if (k === 'value' && this.tagName === 'INPUT') this.value = String(v);
    }
    getAttribute(k) { return this.attrs[k] ?? null; }
    setSelectionRange(a, b) { this.selectionStart = a; this.selectionEnd = b === undefined ? a : b; }
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
    querySelectorAll(sel) {
      const out = [];
      const visit = node => {
        for (const c of node.children || []) {
          if (c.nodeType !== 1) continue;
          if (sel.startsWith('.') && c.classes?.includes(sel.slice(1))) out.push(c);
          else if (sel === 'select' && c.tagName === 'SELECT') out.push(c);
          visit(c);
        }
      };
      visit(this);
      return out;
    }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    focus() {}
  }
  const store = new Map();
  globalThis.document = {
    documentElement: new FakeElement('html'),
    body: new FakeElement('body'),
    createElement: tag => new FakeElement(tag),
    createTextNode: text => ({ nodeType: 3, textContent: String(text) })
  };
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.Event = FakeEvent;
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    clear: () => store.clear()
  };
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  return { FakeElement, store };
}

const walk = (node, out = []) => {
  for (const c of node.children || []) {
    if (!c || c.nodeType !== 1) continue;
    out.push(c);
    walk(c, out);
  }
  return out;
};
const byClass = (root, cls) => walk(root).filter(n => String(n.className || '').split(/\s+/).includes(cls));
const click = node => node.dispatchEvent(new globalThis.Event('click'));
const byAria = (root, label) => walk(root).find(n => n.getAttribute && n.getAttribute('aria-label') === label);

/** The eight models, in the order the chassis tabs are laid out. */
const MODELS = [
  { tab: '2500 Normal', std: 'WAFFLE-CALC-2500', pro: 'WAFFLE-CALC-2500-PRO', columns: 4, stdKeys: 24, proKeys: 40, cls: '' },
  { tab: '2200 Slim', std: 'WAFFLE-CALC-2200', pro: 'WAFFLE-CALC-2200-PRO', columns: 3, stdKeys: 24, proKeys: 36, cls: 'calc-slim' },
  { tab: '2900 Fat', std: 'WAFFLE-CALC-2900', pro: 'WAFFLE-CALC-2900-PRO', columns: 5, stdKeys: 25, proKeys: 40, cls: 'calc-fat' },
  { tab: '1900 Sideways', std: 'WAFFLE-CALC-1900', pro: 'WAFFLE-CALC-1900-PRO', columns: 6, stdKeys: 24, proKeys: 36, cls: 'calc-sideways' }
];

/** Wipes the remembered model so a mount starts from a clean slate. */
function freshCalc() {
  globalThis.localStorage?.clear?.();
  return mountCalc();
}

function mountCalc() {
  const root = globalThis.document.createElement('div');
  assert.ok(mountMathScience('calculator', root), 'the calculator mounts');
  return root;
}
const badge = root => byClass(root, 'gbadge')[0].textContent;
const note = root => byClass(root, 'calc-model-note')[0].textContent;
const keys = root => byClass(root, 'calc-key');
const screen = root => byClass(root, 'calc-result')[0].textContent;
const expr = root => walk(root).find(n => n.tagName === 'INPUT' && n.classes.includes('calc-expr-input'));
const shell = root => byClass(root, 'calc-shell')[0];
const tabFor = (root, label) => {
  const tab = byClass(root, 'gtab').find(b => b.textContent === label);
  assert.ok(tab, `a ${label} chassis tab exists`);
  return tab;
};
const proToggle = root => {
  const t = byAria(root, 'Scientific PRO keys');
  assert.ok(t, 'a PRO switch exists');
  return t;
};
/** Clears the screen and types a run of characters using the on-screen keys. */
function type(root, text) {
  click(keys(root).find(k => k.textContent === 'C'));
  for (const ch of text) {
    const key = keys(root).find(k => k.getAttribute('aria-label') === ch || k.textContent === ch);
    assert.ok(key, `the keypad has a key for "${ch}"`);
    click(key);
  }
}
const keyByLabel = (root, label) => {
  const k = keys(root).find(x => x.textContent === label);
  assert.ok(k, `a "${label}" key exists`);
  return k;
};

test('all eight WAFFLE-CALC models mount with their own badge, key count and column grid', () => {
  makeDOMShim();

  for (const m of MODELS) {
    for (const pro of [false, true]) {
      const root = freshCalc();
      click(tabFor(root, m.tab));
      if (pro) click(proToggle(root));

      const model = pro ? m.pro : m.std;
      assert.equal(badge(root), model, `${m.tab} shows its model number${pro ? ' with PRO' : ''}`);

      const found = keys(root);
      const expected = pro ? m.proKeys : m.stdKeys;
      assert.equal(found.length, expected, `${model} has ${expected} keys`);
      assert.equal(expected % m.columns, 0, `${model}'s ${expected} keys fill its ${m.columns}-column grid exactly`);

      assert.ok(shell(root).classes.includes(`calc-cols-${m.columns}`), `${model} tells CSS to use ${m.columns} columns`);
      for (const cls of ['calc-shell', ...(m.cls ? [m.cls] : [])]) {
        assert.ok(shell(root).classes.includes(cls), `${model} keeps the ${cls} chassis styling`);
      }

      const labels = found.map(k => k.textContent);
      assert.equal(new Set(labels).size, labels.length, `${model} has no duplicate key label`);
      for (const essential of ['C', '⌫', '=', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '+', '−', '×', '÷']) {
        assert.ok(labels.includes(essential), `${model} keeps the essential "${essential}" key`);
      }
      assert.ok(!pro || labels.includes('sin'), `${model} is the scientific one`);
      assert.ok(pro || !labels.includes('sin'), `${m.std} stays a plain calculator`);

      assert.match(note(root), new RegExp(`^${model} · ${expected} keys · `), `${model} explains itself in the note line`);
      if (pro) {
        for (const fn of ['sin', 'cos', 'tan']) assert.ok(note(root).includes(fn), `${model}'s note advertises ${fn}`);
      }
      assert.equal(root.querySelectorAll('select').length, 0, `${model} uses no default <select>`);
    }
  }
});

test('every PRO scientific key computes instead of leaving a parse error', () => {
  makeDOMShim();

  for (const m of MODELS) {
    const root = freshCalc();
    click(tabFor(root, m.tab));
    click(proToggle(root));
    assert.equal(badge(root), m.pro);

    const science = keys(root).filter(k => k.classes.includes('key-sci'));
    assert.ok(science.length >= 12, `${m.pro} carries a scientific block (${science.length} keys)`);

    for (const key of science) {
      const label = key.textContent;
      click(keys(root).find(k => k.textContent === 'C'));
      if (label === 'x²') { click(keyByLabel(root, '5')); click(key); }
      else if (label === 'e') { click(key); }
      else {
        click(key);
        // Function keys open a parenthesis; give them a real argument to chew on.
        // 0.5 sits inside the domain of every one of them, asin and acos included.
        if (expr(root).value.endsWith('(')) { typeInto(root, '0.5'); click(keyByLabel(root, ')')); }
      }
      click(keyByLabel(root, '='));

      const shown = screen(root);
      assert.match(shown, /^-?[\d.]+(e-?\d+)?$/i,
        `${m.pro}: "${label}" produced "${shown}" from "${expr(root).value}"`);
      assert.ok(!byClass(root, 'calc-result')[0].classes.includes('error'),
        `${m.pro}: "${label}" must not error`);
    }
  }
});

/** Types a run of characters using the on-screen keys, without clearing first. */
function typeInto(root, text) {
  for (const ch of text) {
    const key = keys(root).find(k => k.textContent === ch);
    assert.ok(key, `the keypad has a key for "${ch}"`);
    click(key);
  }
}

test('the plain keypads still do arithmetic and the angle switch drives trig', () => {
  makeDOMShim();
  const root = freshCalc();

  // The default chassis is the 2500 and it opens on a solved example.
  assert.equal(badge(root), 'WAFFLE-CALC-2500');
  assert.equal(screen(root), '30', '(12 + 8) * 3 / 2 is already worked out on mount');

  type(root, '7×8=');
  assert.equal(screen(root), '56', 'the base keypad multiplies');

  type(root, '2^10=');
  assert.equal(screen(root), '1024', 'the base keypad raises powers');

  type(root, '5!=');
  assert.equal(screen(root), '120', 'the base keypad does factorials');

  type(root, '√');
  typeInto(root, '16)');
  click(keyByLabel(root, '='));
  assert.equal(screen(root), '4', 'the base keypad does square roots');

  // Degrees vs radians on a PRO model.
  click(tabFor(root, '1900 Sideways'));
  click(proToggle(root));
  click(byAria(root, 'Angle unit'));       // RAD -> DEG
  type(root, '');
  click(keyByLabel(root, 'sin'));
  typeInto(root, '30)');
  click(keyByLabel(root, '='));
  assert.equal(screen(root), '0.5', 'sin(30) is 0.5 in degrees');

  click(byAria(root, 'Angle unit'));       // DEG -> RAD
  type(root, '');
  click(keyByLabel(root, 'sin'));
  typeInto(root, 'π÷6)');
  click(keyByLabel(root, '='));
  assert.equal(screen(root), '0.5', 'sin(pi/6) is 0.5 in radians');
});

test('the fat model gets a 00 key and the chosen model is remembered', () => {
  const { store } = makeDOMShim();

  const fat = mountCalc();
  click(tabFor(fat, '2900 Fat'));
  type(fat, '1');
  click(keyByLabel(fat, '00'));
  click(keyByLabel(fat, '='));
  assert.equal(screen(fat), '100', 'the 00 key types two zeroes at once');

  click(tabFor(fat, '1900 Sideways'));
  click(proToggle(fat));
  assert.equal(store.get('bite-calculator-model'), 'WAFFLE-CALC-1900-PRO', 'the choice is stored');

  // A fresh mount picks the stored model back up, toggle state included.
  const again = mountCalc();
  assert.equal(badge(again), 'WAFFLE-CALC-1900-PRO', 'the calculator reopens as the model you left');
  assert.equal(keys(again).length, 36);
  assert.equal(proToggle(again).getAttribute('aria-checked'), 'true', 'the PRO switch is still on');
  assert.ok(byClass(again, 'gtab').find(b => b.textContent === '1900 Sideways').classes.includes('is-active'),
    'the right chassis tab is highlighted');

  store.set('bite-calculator-model', 'WAFFLE-CALC-9999-PRO');
  const bogus = mountCalc();
  assert.equal(badge(bogus), 'WAFFLE-CALC-2500', 'an unknown stored model falls back to the 2500');
});

test('the calculator works without localStorage at all', () => {
  makeDOMShim();
  delete globalThis.localStorage;
  const root = mountCalc();   // deliberately not freshCalc(): there is no storage here
  assert.equal(badge(root), 'WAFFLE-CALC-2500');
  click(tabFor(root, '2200 Slim'));
  click(proToggle(root));
  assert.equal(badge(root), 'WAFFLE-CALC-2200-PRO', 'switching models still works when storage throws');
  type(root, '6×7=');
  assert.equal(screen(root), '42');
});
