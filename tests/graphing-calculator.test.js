// Drives the graphing calculator through the real UI with a recording canvas:
// five curves, both modes, every preset, every overlay, and the analysis report.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mountMathScience } from '../tools-math-science.js';
import { GRAPH_ANALYSIS } from '../tools-math-numbers.js';

const CALLS = [];

function makeDOMShim() {
  CALLS.length = 0;
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
      if ((k === 'width' || k === 'height') && this.tagName === 'CANVAS' && Number.isFinite(Number(v))) this[k] = Number(v);
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
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    querySelectorAll(sel) {
      const out = [];
      const visit = node => {
        for (const c of node.children || []) {
          if (c.nodeType !== 1) continue;
          const type = c.type || c.attrs?.type;
          if ((sel === 'select' && c.tagName === 'SELECT')
            || (sel === 'input[type="range"]' && c.tagName === 'INPUT' && type === 'range')
            || (sel === 'input[type="checkbox"]' && c.tagName === 'INPUT' && type === 'checkbox')
            || (sel.startsWith('.') && c.classes?.includes(sel.slice(1)))) out.push(c);
          visit(c);
        }
      };
      visit(this);
      return out;
    }
    /** Records every 2D call so a test can prove the plot actually drew. */
    getContext() {
      const ctx = {
        fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', globalAlpha: 1, lineCap: '', lineJoin: ''
      };
      for (const name of ['clearRect', 'fillRect', 'beginPath', 'moveTo', 'lineTo', 'arc', 'closePath',
        'stroke', 'fill', 'fillText', 'save', 'restore', 'setLineDash', 'translate', 'rotate', 'scale', 'clip', 'rect']) {
        ctx[name] = (...args) => { CALLS.push({ name, args, stroke: ctx.strokeStyle, alpha: ctx.globalAlpha }); };
      }
      ctx.getImageData = (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)) });
      ctx.putImageData = () => {};
      ctx.createLinearGradient = () => ({ addColorStop() {} });
      return ctx;
    }
    getBoundingClientRect() { return { left: 0, top: 0, width: 680, height: 390 }; }
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
  const store = new Map();
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    clear: () => store.clear()
  };
  return { FakeElement };
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
const tabNamed = (root, label) => {
  const t = byClass(root, 'gtab').find(b => b.textContent === label);
  assert.ok(t, `a tab called "${label}" exists`);
  return t;
};
const countCalls = name => CALLS.filter(c => c.name === name).length;
/** Every drawing call made while a stroke style belonging to a curve was active. */
const curveCalls = (name, color) => CALLS.filter(c => c.name === name && c.stroke === color).length;

function mountGraph() {
  const root = globalThis.document.createElement('div');
  assert.ok(mountMathScience('graphing-calculator', root), 'the graphing calculator mounts');
  return root;
}
const canvasOf = root => byClass(root, 'graph-canvas')[0];
const readoutOf = root => byClass(root, 'graph-readout')[0].textContent;
const hintOf = root => byClass(root, 'graph-mode-hint')[0].textContent;
const presetChips = root => byClass(root, 'preset-row')[0].children.filter(c => c.nodeType === 1);
const rowsOf = root => byClass(root, 'graph-analysis-row');
const rowValue = (root, label) => {
  const row = rowsOf(root).find(r => byClass(r, 'graph-analysis-label')[0]?.textContent === label);
  assert.ok(row, `the report has a "${label}" row`);
  return byClass(row, 'graph-analysis-value')[0].textContent;
};
const traceAt = (root, x, y) => fire(canvasOf(root), 'pointermove', { clientX: x, clientY: y });

test('the plotter offers five curves, both modes, a table and an analysis tab', () => {
  makeDOMShim();
  const root = mountGraph();

  const labels = byClass(root, 'gtab').map(t => t.textContent);
  for (const expected of ['f(x)', 'g(x)', 'h(x)', 'p(x)', 'q(x)', 'Table', 'Analyse']) {
    assert.ok(labels.includes(expected), `the tab row offers "${expected}" (has ${labels.join(', ')})`);
  }
  assert.ok(byClass(root, 'graph-mode-tabs').length === 1, 'there is a mode switch');
  assert.match(hintOf(root), /y = f\(x\)/, 'it opens in Cartesian mode and says so');

  assert.ok(canvasOf(root), 'a canvas is present');
  assert.equal(canvasOf(root).width, 680);
  assert.equal(canvasOf(root).height, 390);
  assert.ok(countCalls('stroke') > 20, 'the grid, axes and curves are drawn on mount');
  assert.ok(curveCalls('stroke', '#d96b6b') >= 1, 'f(x) is stroked in its own colour');
  assert.ok(curveCalls('stroke', '#589c61') >= 1, 'g(x) is stroked in its own colour');
  assert.equal(root.querySelectorAll('select').length, 0, 'no default <select> anywhere');

  // Selecting a slot swaps the formula into the field without disturbing the plot.
  click(tabNamed(root, 'h(x)'));
  const field = byAria(root, 'Formula y =');
  assert.equal(field.value, 'cos(2*x)', 'the h(x) slot shows its own formula');
});

test('every preset in both modes parses and plots without reporting an error', () => {
  makeDOMShim();
  const root = mountGraph();

  const cartesian = presetChips(root).map(c => c.textContent);
  assert.ok(cartesian.length >= 12, `Cartesian offers a deep preset row (${cartesian.length})`);
  for (const chip of presetChips(root)) {
    const formula = chip.textContent;
    click(chip);
    assert.equal(byAria(root, 'Formula y =').value, formula, `${formula} lands in the formula field`);
    assert.match(readoutOf(root), /Center \(/, `${formula} plots without an error: "${readoutOf(root)}"`);
    const sample = GRAPH_ANALYSIS.graphValue(formula, 1.3);
    assert.ok(Number.isFinite(sample) || Number.isNaN(sample), `${formula} evaluates to a number or a clean NaN`);
  }

  click(tabNamed(root, 'Polar r = f(θ)'));
  const polar = presetChips(root).map(c => c.textContent);
  assert.ok(polar.length >= 8, `Polar offers its own preset row (${polar.length})`);
  assert.notDeepEqual(polar, cartesian, 'the preset row changes with the mode');
  for (const chip of presetChips(root)) {
    const formula = chip.textContent;
    click(chip);
    assert.match(readoutOf(root), /Pole at \(/, `${formula} plots in polar mode: "${readoutOf(root)}"`);
  }
});

test('polar mode redraws the grid as rings and spokes and hides Cartesian-only controls', () => {
  makeDOMShim();
  const root = mountGraph();
  const ringsBefore = countCalls('arc');

  click(tabNamed(root, 'Polar r = f(θ)'));
  assert.match(hintOf(root), /r\(θ\)/, 'the hint explains that θ is written as x or t');
  assert.match(hintOf(root), /written as x \(or t\)/, 'it names both variable spellings');
  assert.equal(byAria(root, 'Plot the derivative').hidden, true, 'the slope overlay is Cartesian-only');
  assert.equal(byAria(root, 'Polar turns').hidden, false, 'the turns slider appears in polar mode');

  assert.ok(countCalls('arc') > ringsBefore, 'the polar grid draws rings and the curves sweep arcs');
  assert.ok(countCalls('fillText') > 0, 'ring radii are labelled');

  // More turns means a longer sweep.
  const strokesBefore = countCalls('lineTo');
  click(byAria(root, 'Increase Polar turns'));
  assert.equal(byAria(root, 'Polar turns').hidden, false);
  assert.ok(countCalls('lineTo') > strokesBefore, 'an extra turn sweeps more of the curve');
  assert.match(hintOf(root), /2 full turns/, 'the hint counts the turns');

  // The pole can be read by tracing.
  traceAt(root, 340 + 42, 195);
  assert.match(readoutOf(root), /r = 1\.00/, `tracing reports a radius, got "${readoutOf(root)}"`);
  assert.match(readoutOf(root), /θ = 0\.00 rad \(0°\)/, 'and an angle in radians and degrees');
});

test('Cartesian tracing reports the value of every visible curve and the slope of the active one', () => {
  makeDOMShim();
  const root = mountGraph();

  traceAt(root, 340, 195);                      // the origin
  assert.match(readoutOf(root), /x = 0\.00/, 'the trace names the x position');
  assert.match(readoutOf(root), /f\(x\) = 0/, 'and the value of f');
  assert.match(readoutOf(root), /g\(x\) = -2/, 'and the value of g');
  assert.match(readoutOf(root), /slope = /, 'and the slope of the active curve');
  assert.ok(!/h\(x\)/.test(readoutOf(root)), 'a hidden curve is not reported');

  // A tap traces too, which is what the readout invites touch users to do.
  fire(canvasOf(root), 'pointerleave');
  assert.match(readoutOf(root), /Tap grid to inspect/, 'leaving the grid restores the invitation');
  fire(canvasOf(root), 'pointerdown', { clientX: 340 + 42, clientY: 195 });
  assert.match(readoutOf(root), /x = 1\.00/, 'tapping the grid traces a point');
});

test('the slope and area overlays draw extra geometry without breaking the plot', () => {
  makeDOMShim();
  const root = mountGraph();
  click(tabNamed(root, 'f(x)'));

  const lineToBefore = countCalls('lineTo');
  const dashBefore = countCalls('setLineDash');
  click(byAria(root, 'Plot the derivative'));
  assert.ok(countCalls('setLineDash') > dashBefore, 'the derivative is drawn dashed');
  assert.ok(countCalls('lineTo') > lineToBefore, 'the derivative adds a curve');

  const fillBefore = countCalls('fill');
  const saveBefore = countCalls('save');
  click(byAria(root, 'Shade the area under the curve'));
  assert.ok(countCalls('fill') > fillBefore, 'the area is filled');
  assert.ok(countCalls('save') > saveBefore, 'the shading saves and restores the context');

  click(byAria(root, 'Mark roots and turning points'));
  assert.match(readoutOf(root), /Center \(/, 'the plot still reports cleanly with every overlay on');
});

test('the analysis report works out real calculus for the curve on screen', () => {
  makeDOMShim();
  const root = mountGraph();

  // Put a curve with known answers on screen: x^2 - 2 across [-3, 3].
  click(tabNamed(root, 'g(x)'));
  const field = byAria(root, 'Formula y =');
  field.value = 'x^2 - 2';
  fire(field, 'input');
  const a = byAria(root, 'from a'); a.value = '-3'; fire(a, 'input');
  const b = byAria(root, 'to b'); b.value = '3'; fire(b, 'input');

  click(tabNamed(root, 'Analyse'));
  const rows = rowsOf(root);
  assert.ok(rows.length >= 12, `the report is thorough (${rows.length} rows)`);

  assert.equal(rowValue(root, 'Formula'), 'g(x) = x^2 - 2');
  assert.equal(rowValue(root, 'Area under curve (∫)'), '6', '∫(x²−2)dx from −3 to 3 is 6');
  assert.equal(rowValue(root, 'Average height'), '1', '6 over a width of 6 averages 1');
  assert.equal(rowValue(root, 'Lowest point'), '-2');
  assert.equal(rowValue(root, 'Highest point'), '7');
  assert.equal(rowValue(root, 'Slope at a'), '-6', 'the slope of x²−2 at −3 is −6');
  assert.equal(rowValue(root, 'Slope at b'), '6');
  assert.equal(rowValue(root, 'Concavity at midpoint'), '2', 'x² curves at 2 everywhere');
  assert.equal(rowValue(root, 'Roots (y = 0)'), 'x = -1.41421,  x = 1.41421', '±√2, to six digits');
  assert.equal(rowValue(root, 'Turning points'), 'valley at (0, -2)');
  assert.match(rowValue(root, 'Curve length (arc)'), /^19\.4/, 'the arc length of a parabola segment');
  assert.match(rowValue(root, 'Crosses f(x)'), /x = /, 'it reports where the curve meets the other visible one');

  // "Use window" pulls the visible x range into the bounds fields.
  const win = walk(root).find(n => n.textContent === 'Use window');
  click(win);
  const aAfter = Number(byAria(root, 'from a').value);
  const bAfter = Number(byAria(root, 'to b').value);
  assert.ok(aAfter < 0 && bAfter > 0, `the window range is centred (${aAfter} to ${bAfter})`);
  assert.ok(Math.abs(bAfter - aAfter - 680 / 42) < 0.2, 'the range matches the canvas width at the current zoom');

  // Editing the formula invalidates the old report rather than leaving it to lie.
  click(tabNamed(root, 'Analyse'));
  assert.ok(rowsOf(root).length >= 12, 'the report is rebuilt for the new range');
  const f2 = byAria(root, 'Formula y =');
  f2.value = 'x^3';
  fire(f2, 'input');
  assert.equal(byClass(root, 'graph-analysis')[0].hidden, true, 'changing the formula hides the stale report');
});

test('the polar report gives the swept area and the zeros of r', () => {
  makeDOMShim();
  const root = mountGraph();
  click(tabNamed(root, 'Polar r = f(θ)'));

  // The cardioid r = 1 + cos θ sweeps exactly 3π/2 and closes at θ = π.
  const chip = presetChips(root).find(c => c.textContent === '1+cos(x)');
  click(chip);
  click(tabNamed(root, 'Analyse'));

  assert.equal(rowValue(root, 'Area swept (½∫r² dθ)'), '4.71239', '3π/2 to six digits');
  const cardioidLength = Number(rowValue(root, 'Curve length'));
  assert.ok(Math.abs(cardioidLength - 8) < 0.001, `a cardioid is 8 units round (got ${cardioidLength})`);
  assert.equal(rowValue(root, 'Smallest r'), '0');
  assert.equal(rowValue(root, 'Largest r'), '2');
  assert.equal(rowValue(root, 'θ where r = 0'), '3.14159 rad', 'it closes at θ = π');
  assert.match(rowValue(root, 'Range'), /θ from 0 to 6\.28319/, 'one full turn by default');

  const rerun = walk(root).find(n => n.textContent === '↻ Run it again');
  assert.ok(rerun, 'the report can be re-run');
  click(rerun);
  assert.equal(rowValue(root, 'Area swept (½∫r² dθ)'), '4.71239');
});

test('a formula that is nonsense, empty or out of range reports a reason instead of crashing', () => {
  makeDOMShim();
  const root = mountGraph();
  const field = byAria(root, 'Formula y =');

  field.value = 'x +* 2';
  fire(field, 'input');
  assert.match(readoutOf(root), /f\(x\): /, `a broken formula is explained on the readout: "${readoutOf(root)}"`);

  field.value = '';
  fire(field, 'input');
  click(tabNamed(root, 'Analyse'));
  assert.match(byClass(root, 'graph-analysis')[0].textContent, /Enter a formula first/, 'an empty formula is refused politely');

  field.value = 'x^2';
  fire(field, 'input');
  const a = byAria(root, 'from a'); a.value = '5'; fire(a, 'input');
  const b = byAria(root, 'to b'); b.value = '1'; fire(b, 'input');
  click(tabNamed(root, 'Analyse'));
  assert.match(byClass(root, 'graph-analysis')[0].textContent, /lower bound smaller than the upper bound/, 'an inverted range is refused');

  a.value = 'not a number'; fire(a, 'input');
  assert.equal(a.value, 'not a number', 'the field keeps what was typed…');
  click(tabNamed(root, 'Analyse'));
  assert.match(byClass(root, 'graph-analysis')[0].textContent, /lower bound smaller than the upper bound/, '…and unparsable bounds are ignored rather than used');

  // A curve that is undefined across the whole range says so.
  a.value = '-5'; fire(a, 'input');
  b.value = '-1'; fire(b, 'input');
  field.value = 'ln(x)';
  fire(field, 'input');
  click(tabNamed(root, 'Analyse'));
  assert.match(byClass(root, 'graph-analysis')[0].textContent, /undefined across the whole range/, 'a domain error is named');
});

test('the table lists every curve and follows the mode', () => {
  makeDOMShim();
  const root = mountGraph();
  click(tabNamed(root, 'Table'));
  const table = byClass(root, 'gtable')[0];
  assert.ok(table, 'a table is rendered');
  const heads = walk(table).filter(n => n.tagName === 'TH').map(n => n.textContent);
  assert.deepEqual(heads, ['x', 'f(x)', 'g(x)', 'h(x)', 'p(x)', 'q(x)'], 'one column per curve');
  const bodyRows = walk(table).filter(n => n.tagName === 'TR').length - 1;
  assert.ok(bodyRows >= 9, `the table samples the range (${bodyRows} rows)`);
  const cells = walk(table).filter(n => n.tagName === 'TD').map(n => n.textContent);
  assert.ok(cells.includes('—'), 'a hidden curve shows a dash');

  click(tabNamed(root, 'Polar r = f(θ)'));
  click(tabNamed(root, 'Table'));
  const polarHeads = walk(byClass(root, 'gtable')[0]).filter(n => n.tagName === 'TH').map(n => n.textContent);
  assert.equal(polarHeads[0], 'θ (rad)', 'the polar table is headed by theta');
  assert.match(polarHeads[1], /^r from f\(x\)$/, 'and each column is a radius');
});

test('awkward curves plot without throwing: poles, jumps, division by zero and wild oscillation', () => {
  makeDOMShim();
  const root = mountGraph();
  const field = byAria(root, 'Formula y =');

  for (const formula of ['tan(x)', '1/x', 'floor(x)', 'sin(x)/x', 'x*sin(1/x)', 'sqrt(x)', '2^x', 'ln(abs(x))', '(x)', 'x%3']) {
    field.value = formula;
    fire(field, 'input');
    traceAt(root, 100, 100);
    traceAt(root, 500, 300);
    click(tabNamed(root, 'Table'));
    click(tabNamed(root, 'f(x)'));
    assert.ok(countCalls('stroke') > 0, `${formula} drew something`);
  }
  const after = readoutOf(root);
  assert.ok(/^(x = |Center \()/.test(after), `the readout is still healthy after all of that: "${after}"`);
  assert.ok(!/Unexpected|Missing|Use \* for|needs \d+ arg/.test(after), `no parse error leaked into the readout: "${after}"`);
});
