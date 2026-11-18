// 10 bespoke 2.5D Mobile-Game Math & Numbers utilities with tactile toys, visualizers & SFX.
import { el, createGameSlider, createGameTabs, createGameToggle, createGameField } from './game-ui.js';
import { playPop, playSquish, playDiceRoll, playSparkle } from './sfx.js';

const PI = Math.PI;
const INK = '#4b3121';

function numberText(n) {
  if (!Number.isFinite(n)) throw new Error('Result is out of range.');
  if (Object.is(n, -0) || n === 0) return '0';
  return Number(n.toPrecision(11)).toString();
}

function integerCheck(n, name, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error(`${name} must be a whole number from ${min} to ${max}.`);
  return n;
}

/** Safe recursive-descent expression parser (supports the x variable — also spelled t — for graphing). */
function evalExpression(source, { degrees = false, xValue = null } = {}) {
  if (source.length > 500) throw new Error('Expression is too long.');
  const tokens = [];
  const re = /\s*(?:(\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)|([A-Za-z]+)|([+\-*/%^(),!×÷−]))/gy;
  let offset = 0;
  source = source.trim();
  while (offset < source.length) {
    re.lastIndex = offset;
    const match = re.exec(source);
    if (!match) throw new Error(`Unexpected character near position ${offset + 1}.`);
    let tok = match[1] !== undefined ? Number(match[1]) : (match[2] || match[3]).toLowerCase();
    if (tok === '×') tok = '*';
    if (tok === '÷') tok = '/';
    if (tok === '−') tok = '-';
    tokens.push(tok);
    offset = re.lastIndex;
  }
  if (!tokens.length) throw new Error('Enter an expression.');
  let i = 0;
  let depth = 0;
  const finite = n => {
    if (!Number.isFinite(n)) throw new Error('Undefined math result.');
    return n;
  };
  const toAngle = v => (degrees ? (v * PI) / 180 : v);
  const fromAngle = v => (degrees ? (v * 180) / PI : v);
  const funcs = {
    sin: [1, v => Math.sin(toAngle(v))],
    cos: [1, v => Math.cos(toAngle(v))],
    tan: [1, v => {
      if (Math.abs(Math.cos(toAngle(v))) < 1e-12) throw new Error('tan undefined here');
      return Math.tan(toAngle(v));
    }],
    asin: [1, v => fromAngle(Math.asin(v))],
    acos: [1, v => fromAngle(Math.acos(v))],
    atan: [1, v => fromAngle(Math.atan(v))],
    sqrt: [1, Math.sqrt],
    cbrt: [1, Math.cbrt],
    abs: [1, Math.abs],
    ln: [1, Math.log],
    log: [1, Math.log10],
    exp: [1, Math.exp],
    floor: [1, Math.floor],
    ceil: [1, Math.ceil],
    round: [1, Math.round],
    min: [2, Math.min],
    max: [2, Math.max],
    pow: [2, Math.pow]
  };

  function primary() {
    if (++depth > 80) throw new Error('Expression too deep.');
    let res;
    const tok = tokens[i++];
    if (typeof tok === 'number') res = tok;
    else if (tok === '(') {
      res = sum();
      if (tokens[i++] !== ')') throw new Error('Missing ).');
    } else if (tok === 'pi') res = PI;
    else if (tok === 'e') res = Math.E;
    else if ((tok === 'x' || tok === 't') && xValue !== null) res = xValue;
    else if (typeof tok === 'string' && Object.hasOwn(funcs, tok)) {
      if (tokens[i++] !== '(') throw new Error(`Use ${tok}(...)`);
      const args = [sum()];
      while (tokens[i] === ',') { i++; args.push(sum()); if (args.length > 2) throw new Error('Too many args.'); }
      if (tokens[i++] !== ')') throw new Error('Missing ).');
      const [arity, fn] = funcs[tok];
      if (args.length !== arity) throw new Error(`${tok} needs ${arity} arg(s).`);
      res = fn(...args);
    } else {
      throw new Error(`Unexpected “${tok ?? ''}”.`);
    }
    while (tokens[i] === '!') {
      i++;
      integerCheck(res, 'Factorial', 0, 170);
      let prod = 1;
      for (let j = 2; j <= res; j++) prod *= j;
      res = prod;
    }
    depth--;
    return finite(res);
  }
  function power() {
    const left = primary();
    if (tokens[i] === '^') { i++; return finite(left ** unary()); }
    return left;
  }
  function unary() {
    if (tokens[i] === '+' || tokens[i] === '-') {
      if (++depth > 80) throw new Error('Expression too deep.');
      const sign = tokens[i++] === '-' ? -1 : 1;
      const r = sign * unary();
      depth--;
      return r;
    }
    return power();
  }
  function product() {
    let res = unary();
    while (['*', '/', '%'].includes(tokens[i])) {
      const op = tokens[i++], right = unary();
      if ((op === '/' || op === '%') && right === 0) throw new Error('Cannot divide by zero.');
      res = finite(op === '*' ? res * right : op === '/' ? res / right : res % right);
    }
    return res;
  }
  function sum() {
    let res = product();
    while (tokens[i] === '+' || tokens[i] === '-') {
      const op = tokens[i++], right = product();
      res = finite(op === '+' ? res + right : res - right);
    }
    return res;
  }
  const result = sum();
  if (i !== tokens.length) throw new Error('Use * for multiplication (e.g. 2*pi).');
  return finite(result);
}

// =========================================================================
// 1. CALCULATOR — eight WAFFLE-CALC chassis (2500 / 2200 / 2900 / 1900, each with a -PRO twin)
// =========================================================================
/**
 * Eight calculator chassis. The model numbers are the product names: the 2500
 * is the everyday one, the 2200 the slim pocket model, the 2900 the fat desk
 * model and the 1900 the sideways landscape model. Every chassis has a -PRO
 * twin that bolts a scientific block onto the same keypad — those keys only
 * insert text that evalExpression already parses, so PRO is a keyboard, not
 * new maths.
 *
 * A key is [label, style, insert?]; `insert` defaults to the label.
 */
const SCIENCE_KEYS = Object.freeze({
  sin: ['sin', 'sci', 'sin('],
  cos: ['cos', 'sci', 'cos('],
  tan: ['tan', 'sci', 'tan('],
  ln: ['ln', 'sci', 'ln('],
  log: ['log', 'sci', 'log('],
  abs: ['abs', 'sci', 'abs('],
  asin: ['asin', 'sci', 'asin('],
  acos: ['acos', 'sci', 'acos('],
  atan: ['atan', 'sci', 'atan('],
  cbrt: ['∛', 'sci', 'cbrt('],
  square: ['x²', 'sci', '^2'],
  exp: ['eˣ', 'sci', 'exp('],
  floor: ['floor', 'sci', 'floor('],
  ceil: ['ceil', 'sci', 'ceil('],
  round: ['round', 'sci', 'round('],
  e: ['e', 'sci', 'e']
});

/** The twelve functions every PRO model carries, in reading order. */
const CORE_SCIENCE = ['sin', 'cos', 'tan', 'ln', 'log', 'abs', 'asin', 'acos', 'atan', 'cbrt', 'square', 'exp'];
/** Flagships also get the rounding family and Euler's number. */
const FLAGSHIP_SCIENCE = [...CORE_SCIENCE, 'floor', 'ceil', 'round', 'e'];

const CALC_CHASSIS = Object.freeze([
  {
    id: '2500',
    tab: '2500 Normal',
    blurb: 'the everyday four-column calculator',
    columns: 4,
    cls: '',
    science: FLAGSHIP_SCIENCE,
    keys: [
      ['C', 'danger'], ['(', 'soft'], [')', 'soft'], ['⌫', 'warn'],
      ['7', 'num'], ['8', 'num'], ['9', 'num'], ['÷', 'op', '/'],
      ['4', 'num'], ['5', 'num'], ['6', 'num'], ['×', 'op', '*'],
      ['1', 'num'], ['2', 'num'], ['3', 'num'], ['−', 'op', '-'],
      ['0', 'num'], ['.', 'num'], ['^', 'soft'], ['+', 'op', '+'],
      ['√', 'soft', 'sqrt('], ['π', 'soft', 'pi'], ['!', 'soft'], ['=', 'eq']
    ]
  },
  {
    id: '2200',
    tab: '2200 Slim',
    blurb: 'a narrow pocket calculator with tall keys',
    columns: 3,
    cls: 'calc-slim',
    science: CORE_SCIENCE,
    keys: [
      ['C', 'danger'], ['⌫', 'warn'], ['(', 'soft'],
      ['7', 'num'], ['8', 'num'], ['9', 'num'],
      ['4', 'num'], ['5', 'num'], ['6', 'num'],
      ['1', 'num'], ['2', 'num'], ['3', 'num'],
      ['0', 'num'], ['.', 'num'], [')', 'soft'],
      ['+', 'op', '+'], ['−', 'op', '-'], ['×', 'op', '*'],
      ['÷', 'op', '/'], ['^', 'soft'], ['√', 'soft', 'sqrt('],
      ['π', 'soft', 'pi'], ['!', 'soft'], ['=', 'eq']
    ]
  },
  {
    id: '2900',
    tab: '2900 Fat',
    blurb: 'a fat desk calculator with big chunky keys and a 00 key',
    columns: 5,
    cls: 'calc-fat',
    science: [...CORE_SCIENCE, 'floor', 'ceil', 'round'],
    keys: [
      ['C', 'danger'], ['⌫', 'warn'], ['(', 'soft'], [')', 'soft'], ['π', 'soft', 'pi'],
      ['7', 'num'], ['8', 'num'], ['9', 'num'], ['÷', 'op', '/'], ['√', 'soft', 'sqrt('],
      ['4', 'num'], ['5', 'num'], ['6', 'num'], ['×', 'op', '*'], ['^', 'soft'],
      ['1', 'num'], ['2', 'num'], ['3', 'num'], ['−', 'op', '-'], ['!', 'soft'],
      ['0', 'num'], ['00', 'num', '00'], ['.', 'num'], ['+', 'op', '+'], ['=', 'eq']
    ]
  },
  {
    id: '1900',
    tab: '1900 Sideways',
    blurb: 'a sideways landscape calculator for wide screens',
    columns: 6,
    cls: 'calc-sideways',
    science: CORE_SCIENCE,
    keys: [
      ['C', 'danger'], ['⌫', 'warn'], ['7', 'num'], ['8', 'num'], ['9', 'num'], ['÷', 'op', '/'],
      ['(', 'soft'], [')', 'soft'], ['4', 'num'], ['5', 'num'], ['6', 'num'], ['×', 'op', '*'],
      ['^', 'soft'], ['√', 'soft', 'sqrt('], ['1', 'num'], ['2', 'num'], ['3', 'num'], ['−', 'op', '-'],
      ['π', 'soft', 'pi'], ['!', 'soft'], ['0', 'num'], ['.', 'num'], ['+', 'op', '+'], ['=', 'eq']
    ]
  }
]);

const CALC_MODEL_STORE = 'bite-calculator-model';
const calcModelName = (chassis, pro) => `WAFFLE-CALC-${chassis.id}${pro ? '-PRO' : ''}`;
const calcKeysFor = (chassis, pro) => pro
  ? [...chassis.science.map(name => SCIENCE_KEYS[name]), ...chassis.keys]
  : chassis.keys;

function readStoredCalcModel() {
  try {
    const saved = String(localStorage.getItem(CALC_MODEL_STORE) || '');
    const m = saved.match(/^WAFFLE-CALC-(\d+)(-PRO)?$/);
    if (!m) return null;
    const chassis = CALC_CHASSIS.find(c => c.id === m[1]);
    return chassis ? { chassis, pro: Boolean(m[2]) } : null;
  } catch { return null; }
}

function storeCalcModel(model) {
  try { localStorage.setItem(CALC_MODEL_STORE, model); } catch { /* private mode */ }
}

function calculator(root) {
  let degrees = false;
  const history = [];
  const restored = readStoredCalcModel();
  let chassis = restored ? restored.chassis : CALC_CHASSIS[0];
  let pro = restored ? restored.pro : false;

  const exprInput = el('input', {
    type: 'text',
    class: 'calc-expr-input',
    value: '(12 + 8) * 3 / 2',
    placeholder: 'Tap keys or type…',
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-label': 'Calculator expression'
  });
  const resultOut = el('div', { class: 'output calc-result', 'aria-live': 'polite' }, '30');
  const tapeEl = el('div', { class: 'calc-tape' });
  const badge = el('span', { class: 'gbadge' }, calcModelName(chassis, pro));
  const modelNote = el('p', { class: 'calc-model-note' });
  const keypad = el('div', { class: 'calc-keypad' });

  const angleToggle = createGameToggle({
    checked: false,
    offLabel: 'RAD',
    onLabel: 'DEG',
    label: 'Angle unit',
    onChange: v => { degrees = v; playPop(540); evaluate(); }
  });

  const proToggle = createGameToggle({
    checked: pro,
    offLabel: 'STD',
    onLabel: 'PRO',
    label: 'Scientific PRO keys',
    onChange: v => { pro = v; playPop(640); applyLayout(true); }
  });

  const chassisTabs = createGameTabs({
    items: CALC_CHASSIS.map(c => ({ value: c.id, label: c.tab })),
    value: chassis.id,
    cls: 'calc-model-tabs',
    onChange: v => {
      const next = CALC_CHASSIS.find(c => c.id === v);
      if (!next || next === chassis) return;
      chassis = next;
      playPop(500);
      applyLayout(true);
    }
  });

  function renderTape() {
    tapeEl.replaceChildren(...history.slice(0, 3).map(item =>
      el('button', {
        type: 'button',
        class: 'gbtn gbtn-chip',
        onclick: () => { playPop(480); exprInput.value = item.expr; evaluate(); }
      }, `${item.expr} = ${item.res}`)
    ));
  }

  function evaluate(record = false) {
    const raw = exprInput.value.trim();
    if (!raw) {
      resultOut.classList.remove('error');
      resultOut.textContent = '0';
      return;
    }
    try {
      const ans = numberText(evalExpression(raw, { degrees }));
      resultOut.classList.remove('error');
      resultOut.textContent = ans;
      resultOut.classList.remove('pop-bounce');
      void resultOut.offsetWidth;
      resultOut.classList.add('pop-bounce');
      if (record) {
        playSparkle();
        history.unshift({ expr: raw, res: ans });
        if (history.length > 6) history.pop();
        renderTape();
      }
    } catch (e) {
      resultOut.classList.add('error');
      resultOut.textContent = e.message;
    }
  }

  function insertKey(val) {
    if (val === 'C') { playSquish(); exprInput.value = ''; evaluate(); return; }
    if (val === '⌫') {
      playPop(380);
      const s = exprInput.selectionStart ?? exprInput.value.length;
      const e = exprInput.selectionEnd ?? s;
      const from = s === e ? Math.max(0, s - 1) : s;
      exprInput.value = exprInput.value.slice(0, from) + exprInput.value.slice(e);
      exprInput.focus();
      exprInput.setSelectionRange(from, from);
      evaluate();
      return;
    }
    if (val === '=') { evaluate(true); return; }
    playPop(460 + (val.charCodeAt(0) % 7) * 35);
    const s = exprInput.selectionStart ?? exprInput.value.length;
    const e = exprInput.selectionEnd ?? s;
    exprInput.value = exprInput.value.slice(0, s) + val + exprInput.value.slice(e);
    const cur = s + val.length;
    exprInput.focus();
    exprInput.setSelectionRange(cur, cur);
    evaluate();
  }

  exprInput.addEventListener('input', () => evaluate(false));
  exprInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); evaluate(true); }
  });

  // The model switcher is shelf furniture, not part of the device. It lives in
  // its own panel above the calculator so the calculator's face is only ever
  // calculator: screws, model plate, angle switch, screen, tape and keys. That
  // also stops the device growing a row of tabs every time a chassis is added.
  const picker = el('div', { class: 'game-panel calc-picker' },
    el('div', { class: 'calc-picker-head' },
      el('span', { class: 'calc-picker-title' }, 'Which calculator?'),
      el('span', { class: 'calc-picker-sub' }, 'Eight chassis, one honest maths engine')
    ),
    chassisTabs.el,
    el('div', { class: 'calc-picker-row' },
      proToggle.el,
      el('span', { class: 'calc-pro-hint' }, 'PRO adds sin, cos, tan and the rest')
    ),
    modelNote
  );

  const shell = el('div', { class: 'game-panel calc-shell' },
    el('div', { class: 'calc-top-row' },
      el('span', { class: 'toy-screw' }),
      badge,
      angleToggle.el,
      el('span', { class: 'toy-screw' })
    ),
    el('div', { class: 'calc-screen' },
      exprInput,
      resultOut
    ),
    tapeEl,
    keypad
  );

  function applyLayout(announce = false) {
    const keys = calcKeysFor(chassis, pro);
    // The badge is the model number, so it has to move with the chassis — a
    // 2200 that still says 2500 on its face is lying about what you are using.
    badge.textContent = calcModelName(chassis, pro);
    shell.className = `game-panel calc-shell calc-cols-${chassis.columns}${chassis.cls ? ` ${chassis.cls}` : ''}`;
    keypad.replaceChildren(...keys.map(([label, style, insert]) =>
      el('button', {
        type: 'button',
        class: `gbtn calc-key key-${style}`,
        'aria-label': label === '⌫' ? 'Backspace' : label === '=' ? 'Calculate equals' : label,
        onclick: () => insertKey(insert ?? label)
      }, label)
    ));
    const scienceNote = pro
      ? ` Scientific block: ${chassis.science.map(n => SCIENCE_KEYS[n][0]).join(', ')}.`
      : '';
    modelNote.textContent = `${calcModelName(chassis, pro)} · ${keys.length} keys · ${chassis.blurb}.${scienceNote}`;
    if (announce) {
      storeCalcModel(calcModelName(chassis, pro));
      evaluate(false);
    }
  }

  applyLayout(false);
  root.replaceChildren(picker, shell);
  evaluate();
}

// =========================================================================
// GRAPH ANALYSIS — pure maths behind the plotter, exported so it is testable
// without a canvas. Every function returns NaN or [] rather than throwing when
// a curve is not defined somewhere, because "undefined here" is an answer a
// graphing calculator has to be able to give.
// =========================================================================

/** f(x) with every failure flattened to NaN. */
function graphValue(expr, x) {
  try {
    const v = evalExpression(expr, { xValue: x });
    return Number.isFinite(v) ? v : NaN;
  } catch { return NaN; }
}

/** Central-difference slope. */
function graphDerivative(expr, x, h = 1e-5) {
  const left = graphValue(expr, x - h);
  const right = graphValue(expr, x + h);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return NaN;
  return (right - left) / (2 * h);
}

/** Second derivative, used to tell a peak from a valley. */
function graphSecondDerivative(expr, x, h = 1e-4) {
  const left = graphValue(expr, x - h);
  const mid = graphValue(expr, x);
  const right = graphValue(expr, x + h);
  if (!Number.isFinite(left) || !Number.isFinite(mid) || !Number.isFinite(right)) return NaN;
  return (right - 2 * mid + left) / (h * h);
}

/** Bisection on any sign-changing function; NaN when the bracket is not usable. */
function bisect(fn, a, b, iterations = 60) {
  let lo = a, hi = b;
  let flo = fn(lo), fhi = fn(hi);
  if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) return NaN;
  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2;
    const fmid = fn(mid);
    if (!Number.isFinite(fmid)) return NaN;
    if (fmid === 0) return mid;
    if (flo * fmid < 0) { hi = mid; fhi = fmid; } else { lo = mid; flo = fmid; }
  }
  return (lo + hi) / 2;
}

/** Keep a list of x positions deduplicated and capped, so wiggly curves cannot flood the panel. */
function pushFound(list, value, limit, tolerance) {
  if (list.length >= limit) return false;
  if (list.some(v => Math.abs(v - value) <= tolerance)) return false;
  list.push(value);
  return true;
}

/**
 * Simpson's rule. Returns NaN when any sample is undefined, which is the honest
 * answer for an integral that runs through a pole such as 1/x across zero.
 */
function graphIntegral(expr, a, b, steps = 400) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
  if (a === b) return 0;
  if (a > b) return -graphIntegral(expr, b, a, steps);
  const n = Math.max(2, Math.round(steps / 2) * 2);
  const h = (b - a) / n;
  const first = graphValue(expr, a);
  const last = graphValue(expr, b);
  if (!Number.isFinite(first) || !Number.isFinite(last)) return NaN;
  let sum = first + last;
  for (let i = 1; i < n; i++) {
    const v = graphValue(expr, a + i * h);
    if (!Number.isFinite(v)) return NaN;
    sum += v * (i % 2 === 0 ? 2 : 4);
  }
  return (sum * h) / 3;
}

/** Signed area enclosed by a polar curve, 1/2 * integral of r^2. */
function graphPolarArea(expr, t0, t1, steps = 400) {
  const swept = graphIntegral(`(${expr})^2`, t0, t1, steps);
  return Number.isFinite(swept) ? swept / 2 : NaN;
}

/** Length of the curve itself, as a polyline over the samples (gaps break it). */
function graphArcLength(expr, a, b, samples = 800) {
  if (!(b > a)) return NaN;
  let total = 0, prevX = null, prevY = null;
  for (let i = 0; i <= samples; i++) {
    const x = a + ((b - a) * i) / samples;
    const y = graphValue(expr, x);
    if (Number.isFinite(y)) {
      if (prevY !== null) total += Math.hypot(x - prevX, y - prevY);
      prevX = x; prevY = y;
    } else { prevX = null; prevY = null; }
  }
  return total;
}

/** Length of a polar curve, integral of sqrt(r^2 + (dr/dt)^2) by polyline. */
function graphPolarArcLength(expr, t0, t1, samples = 900) {
  if (!(t1 > t0)) return NaN;
  let total = 0, prev = null;
  for (let i = 0; i <= samples; i++) {
    const t = t0 + ((t1 - t0) * i) / samples;
    const r = graphValue(expr, t);
    if (!Number.isFinite(r)) { prev = null; continue; }
    const pt = { x: r * Math.cos(t), y: r * Math.sin(t) };
    if (prev) total += Math.hypot(pt.x - prev.x, pt.y - prev.y);
    prev = pt;
  }
  return total;
}

/** Mean height of the curve across [a, b]. */
function graphAverageValue(expr, a, b, steps = 400) {
  if (!(b > a)) return NaN;
  const area = graphIntegral(expr, a, b, steps);
  return Number.isFinite(area) ? area / (b - a) : NaN;
}

/** Lowest and highest point actually reached on [a, b]. */
function graphRangeStats(expr, a, b, samples = 800) {
  if (!(b > a)) return { min: NaN, max: NaN };
  let min = Infinity, max = -Infinity;
  for (let i = 0; i <= samples; i++) {
    const y = graphValue(expr, a + ((b - a) * i) / samples);
    if (!Number.isFinite(y)) continue;
    if (y < min) min = y;
    if (y > max) max = y;
  }
  return { min: Number.isFinite(min) ? min : NaN, max: Number.isFinite(max) ? max : NaN };
}

/**
 * Zeros of a curve. A sign change is only accepted as a root when the value at
 * the refined point is genuinely small relative to the bracket ends — that is
 * what tells x^2 - 2 = 0 at 1.414 apart from 1/x flipping sign across its pole.
 */
function graphRoots(expr, a, b, { samples = 800, limit = 24 } = {}) {
  const found = [];
  if (!(b > a) || !expr || !expr.trim()) return found;
  const f = x => graphValue(expr, x);
  const tol = (b - a) / (samples * 2);
  let prevX = a, prevY = f(a);
  for (let i = 1; i <= samples; i++) {
    const x = a + ((b - a) * i) / samples;
    const y = f(x);
    if (Number.isFinite(prevY) && Number.isFinite(y)) {
      if (prevY === 0) pushFound(found, prevX, limit, tol);
      else if (prevY * y < 0) {
        const r = bisect(f, prevX, x);
        if (Number.isFinite(r)) {
          const atRoot = f(r);
          const scale = Math.max(1, Math.abs(prevY), Math.abs(y));
          if (Number.isFinite(atRoot) && Math.abs(atRoot) <= 1e-4 * scale) pushFound(found, r, limit, tol);
        }
      }
    }
    prevX = x; prevY = y;
  }
  if (Number.isFinite(prevY) && prevY === 0) pushFound(found, prevX, limit, tol);
  return found.sort((p, q) => p - q);
}

/**
 * Peaks and valleys. A sign change of the slope is only a candidate; it is then
 * confirmed by comparing the curve either side of it. That two-step matters:
 * it catches a minimum where the slope lands on exactly zero at a sample point
 * (x^2 - 2 at x = 0, which a pure sign test walks straight past) and it rejects
 * the slope spikes a jump discontinuity such as floor(x) produces.
 */
function graphExtrema(expr, a, b, { samples = 800, limit = 24 } = {}) {
  const found = [];
  if (!(b > a) || !expr || !expr.trim()) return found;
  const slope = x => graphDerivative(expr, x);
  const tol = (b - a) / (samples * 2);
  const reach = tol * 4;

  function confirm(at) {
    const y = graphValue(expr, at);
    if (!Number.isFinite(y)) return;
    if (found.length >= limit || found.some(p => Math.abs(p.x - at) <= tol)) return;
    const left = graphValue(expr, at - reach);
    const right = graphValue(expr, at + reach);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return;
    const isMax = y >= left && y >= right;
    const isMin = y <= left && y <= right;
    if (!isMax && !isMin) return;                       // a saddle or a pole
    // A real turning point arrives at the same height from both sides, so the
    // two neighbours agree. A jump discontinuity (floor, round, a step) also
    // satisfies the comparison above but has wildly different neighbours —
    // that asymmetry is what separates a plateau from a cliff.
    const margin = isMax ? y - Math.min(left, right) : Math.max(left, right) - y;
    if (Math.abs(right - left) > Math.abs(margin) * 0.5) return;
    found.push({ x: at, y, kind: isMax && isMin ? 'flat' : isMax ? 'max' : 'min' });
  }

  let prevX = a, prevSlope = slope(a);
  for (let i = 1; i <= samples; i++) {
    const x = a + ((b - a) * i) / samples;
    const s = slope(x);
    if (Number.isFinite(prevSlope) && Number.isFinite(s)) {
      if (prevSlope * s < 0) confirm(bisect(slope, prevX, x));
      else if (s === 0 && prevSlope !== 0) confirm(x);  // the slope landed exactly on zero
    }
    prevX = x; prevSlope = s;
  }
  return found.sort((p, q) => p.x - q.x);
}

/**
 * Where two curves cross, which is just the roots of their difference — the
 * parser handles the combined expression, so both curves stay user-editable.
 */
function graphIntersections(exprA, exprB, a, b, opts = {}) {
  if (!exprA || !exprA.trim() || !exprB || !exprB.trim()) return [];
  return graphRoots(`(${exprA})-(${exprB})`, a, b, opts);
}

/** Everything the Analyse button reports, for one curve in one mode. */
function analyseCurve(expr, { a, b, mode = 'cartesian', others = [] } = {}) {
  if (!expr || !expr.trim()) return { ok: false, reason: 'Enter a formula first.' };
  if (!Number.isFinite(a) || !Number.isFinite(b) || a >= b) return { ok: false, reason: 'The range needs a lower bound smaller than the upper bound.' };
  const probe = graphValue(expr, (a + b) / 2);
  if (Number.isNaN(probe) && Number.isNaN(graphValue(expr, a)) && Number.isNaN(graphValue(expr, b))) {
    return { ok: false, reason: 'That formula is undefined across the whole range.' };
  }

  if (mode === 'polar') {
    const stats = graphRangeStats(expr, a, b);
    return {
      ok: true, mode, expr, a, b,
      area: graphPolarArea(expr, a, b),
      arcLength: graphPolarArcLength(expr, a, b),
      minR: stats.min, maxR: stats.max,
      zeros: graphRoots(expr, a, b, { limit: 12 }),
      crossings: []
    };
  }

  const stats = graphRangeStats(expr, a, b);
  const roots = graphRoots(expr, a, b, { limit: 12 });
  const extrema = graphExtrema(expr, a, b, { limit: 12 });
  return {
    ok: true, mode, expr, a, b,
    integral: graphIntegral(expr, a, b),
    arcLength: graphArcLength(expr, a, b),
    average: graphAverageValue(expr, a, b),
    min: stats.min, max: stats.max,
    slopeAtA: graphDerivative(expr, a),
    slopeAtB: graphDerivative(expr, b),
    curvature: graphSecondDerivative(expr, (a + b) / 2),
    roots, extrema,
    crossings: others
      .filter(o => o && o.expr && o.expr.trim() && o.id !== undefined)
      .map(o => ({ id: o.id, label: o.label, points: graphIntersections(expr, o.expr, a, b, { limit: 8 }) }))
      .filter(o => o.points.length)
  };
}

const GRAPH_ANALYSIS = Object.freeze({
  graphValue, graphDerivative, graphSecondDerivative, bisect, graphIntegral, graphPolarArea,
  graphArcLength, graphPolarArcLength, graphAverageValue, graphRangeStats,
  graphRoots, graphExtrema, graphIntersections, analyseCurve
});

// =========================================================================
// 2. GRAPHING CALCULATOR — 2.5D Wooden Tablet Plotter: five curves, polar mode,
//    derivative and area overlays, and a full analysis report per curve.
// =========================================================================
function graphingCalculator(root) {
  const slots = [
    { id: 'f', label: 'f(x)', color: '#d96b6b', expr: 'sin(x) + 0.3*x', visible: true },
    { id: 'g', label: 'g(x)', color: '#589c61', expr: '0.2*x^2 - 2', visible: true },
    { id: 'h', label: 'h(x)', color: '#8a6bb8', expr: 'cos(2*x)', visible: false },
    { id: 'p', label: 'p(x)', color: '#d99a3c', expr: 'exp(-x^2/2)*3', visible: false },
    { id: 'q', label: 'q(x)', color: '#3f8fa8', expr: '0.5*x^3 - 2*x', visible: false }
  ];
  let activeSlot = 'f';
  let mode = 'cartesian';
  let centerX = 0, centerY = 0, scale = 42;
  let hoverPt = null;
  let showDerivative = false;
  let showArea = false;
  let showMarkers = true;
  let polarTurns = 1;
  let bounds = { a: -6, b: 6 };
  let analysis = null;
  let analysisFor = null;

  const canvas = el('canvas', { class: 'graph-canvas', width: 680, height: 390, 'aria-label': '2.5D Graphing calculator grid' });
  const readout = el('div', { class: 'graph-readout' }, 'Slide or tap the 2.5D grid to trace points');
  const modeHint = el('p', { class: 'graph-mode-hint' });
  const analysisBox = el('div', { class: 'graph-analysis', hidden: true });
  const tableBox = el('div', { class: 'graph-table', hidden: true });

  const exprField = createGameField({
    label: 'Formula y =',
    value: slots[0].expr,
    placeholder: 'e.g. sin(x) or x^2 - 3',
    onInput: val => {
      const s = slots.find(x => x.id === activeSlot);
      if (s) { s.expr = val; s.visible = true; invalidateAnalysis(); syncVisibility(); draw(); }
    }
  });
  const boundA = createGameField({ label: 'from a', value: String(bounds.a), placeholder: '-6', inputmode: 'decimal', cls: 'graph-bound', onInput: v => setBound('a', v) });
  const boundB = createGameField({ label: 'to b', value: String(bounds.b), placeholder: '6', inputmode: 'decimal', cls: 'graph-bound', onInput: v => setBound('b', v) });

  const visToggle = createGameToggle({
    checked: true, onLabel: 'SHOWN', offLabel: 'HIDDEN', label: 'Show curve',
    onChange: v => { playPop(500); const s = slots.find(x => x.id === activeSlot); if (s) { s.visible = v; draw(); } }
  });
  const derivToggle = createGameToggle({
    checked: false, onLabel: 'SLOPE ON', offLabel: 'SLOPE OFF', label: 'Plot the derivative',
    onChange: v => { playPop(560); showDerivative = v; draw(); }
  });
  const areaToggle = createGameToggle({
    checked: false, onLabel: 'AREA ON', offLabel: 'AREA OFF', label: 'Shade the area under the curve',
    onChange: v => { playPop(520); showArea = v; draw(); }
  });
  const markerToggle = createGameToggle({
    checked: true, onLabel: 'MARKS ON', offLabel: 'MARKS OFF', label: 'Mark roots and turning points',
    onChange: v => { playPop(520); showMarkers = v; draw(); }
  });
  const turnsSlider = createGameSlider({
    label: 'Polar turns', min: 1, max: 8, step: 1, value: 1, unit: '×2π', color: '#8a6bb8',
    // syncMode, not draw: the hint line and the polar table both quote the turn count.
    onChange: v => { polarTurns = v; invalidateAnalysis(); syncMode(); }
  });

  function syncVisibility() {
    const s = slots.find(x => x.id === activeSlot);
    if (!s) return;
    visToggle.el.classList.toggle('is-on', s.visible);
    visToggle.el.setAttribute('aria-checked', String(s.visible));
    visToggle.el.querySelector('.gtoggle-text').textContent = s.visible ? 'SHOWN' : 'HIDDEN';
  }

  /** Anything that changes what the report was about makes the report stale. */
  function invalidateAnalysis() {
    analysis = null;
    analysisFor = null;
    analysisBox.hidden = true;
  }

  function setBound(which, raw) {
    const v = Number(String(raw).trim());
    if (!Number.isFinite(v)) return;
    bounds[which] = v;
    invalidateAnalysis();
  }

  /** The x range currently on screen, used by "Use window". */
  function windowRange() {
    const w = canvas.width;
    const originX = w / 2 - centerX * scale;
    return { a: (0 - originX) / scale, b: (w - originX) / scale };
  }

  const tabs = createGameTabs({
    items: [
      ...slots.map(s => ({ value: s.id, label: s.label, icon: el('span', { class: 'color-dot', style: `background:${s.color}` }) })),
      { value: 'table', label: 'Table' },
      { value: 'analyse', label: 'Analyse' }
    ],
    value: 'f',
    onChange: val => {
      playPop(540);
      if (val === 'table') { tableBox.hidden = false; analysisBox.hidden = true; renderTable(); return; }
      if (val === 'analyse') { tableBox.hidden = true; runAnalysis(); return; }
      tableBox.hidden = true;
      analysisBox.hidden = true;
      if (val !== activeSlot) invalidateAnalysis();
      activeSlot = val;
      const s = slots.find(x => x.id === activeSlot);
      exprField.input.value = s.expr;
      syncVisibility();
    }
  });

  const modeTabs = createGameTabs({
    items: [{ value: 'cartesian', label: 'Cartesian y = f(x)' }, { value: 'polar', label: 'Polar r = f(θ)' }],
    value: 'cartesian',
    cls: 'graph-mode-tabs',
    onChange: val => {
      if (val === mode) return;
      playPop(580);
      mode = val;
      invalidateAnalysis();
      syncMode();
    }
  });

  const CARTESIAN_PRESETS = ['sin(x)', 'x^2 - 2', 'cos(2*x)', '0.2*x^3 - x', 'abs(x) - 2', '2/x', 'tan(x)',
    'sin(x)/x', 'exp(-x^2/2)', 'ln(abs(x))', 'floor(x)', 'x*sin(1/x)', 'sqrt(abs(x))*2', 'sin(x^2)', '3*sin(x)*cos(3*x)'];
  const POLAR_PRESETS = ['1+cos(x)', 'cos(3*x)', 'sin(5*x)', 'x/2', '2+sin(4*x)', 'cos(x/3)', '1+2*sin(x)',
    'abs(sin(2*x))*3', '3+2*cos(5*t)', 'sin(t)*exp(cos(t))*3'];
  const presetRow = el('div', { class: 'preset-row' });

  function renderPresets() {
    const list = mode === 'polar' ? POLAR_PRESETS : CARTESIAN_PRESETS;
    presetRow.replaceChildren(...list.map(p => el('button', {
      type: 'button',
      class: 'gbtn gbtn-chip',
      onclick: () => {
        playPop(580);
        const s = slots.find(x => x.id === activeSlot);
        if (s) { s.expr = p; s.visible = true; exprField.input.value = p; invalidateAnalysis(); syncVisibility(); draw(); }
      }
    }, p)));
  }

  /** Labels and controls that only make sense in one of the two modes. */
  function syncMode() {
    const polar = mode === 'polar';
    modeHint.textContent = polar
      ? `Polar mode: the formula is r(θ), and θ is written as x (or t). Sweeping ${polarTurns} full turn${polarTurns === 1 ? '' : 's'}.`
      : 'Cartesian mode: the formula is y = f(x). Analyse reports roots, turning points, area, arc length and crossings.';
    turnsSlider.el.hidden = !polar;
    derivToggle.el.hidden = polar;
    renderPresets();
    if (tableBox.hidden === false && tabs.getValue() === 'table') renderTable();
    draw();
  }

  function renderTable() {
    const polar = mode === 'polar';
    const rows = [];
    const steps = polar ? 12 : 9;
    const lo = polar ? 0 : -4;
    const hi = polar ? PI * 2 * polarTurns : 4;
    for (let i = 0; i <= steps; i++) {
      const x = lo + ((hi - lo) * i) / steps;
      const cells = [el('td', {}, Number(x.toPrecision(4)).toString())];
      for (const s of slots) {
        let out = '—';
        if (s.visible && s.expr.trim()) {
          const v = graphValue(s.expr, x);
          out = Number.isFinite(v) ? numberText(v) : 'undef';
        }
        cells.push(el('td', {}, out));
      }
      rows.push(el('tr', {}, ...cells));
    }
    tableBox.replaceChildren(
      el('table', { class: 'gtable' },
        el('thead', {}, el('tr', {}, el('th', {}, polar ? 'θ (rad)' : 'x'), ...slots.map(s => el('th', { style: `color:${s.color}` }, polar ? `r from ${s.label}` : s.label)))),
        el('tbody', {}, ...rows)
      )
    );
  }

  function runAnalysis() {
    const s = slots.find(x => x.id === activeSlot);
    const polar = mode === 'polar';
    const range = polar ? { a: 0, b: PI * 2 * polarTurns } : { a: bounds.a, b: bounds.b };
    const result = analyseCurve(s.expr, {
      a: range.a,
      b: range.b,
      mode,
      others: polar ? [] : slots.filter(o => o.id !== s.id && o.visible && o.expr.trim())
    });
    analysisFor = { slot: s.id, mode, a: range.a, b: range.b };
    analysis = result.ok ? result : null;
    renderAnalysis(s, result, polar);
    tableBox.hidden = true;
    analysisBox.hidden = false;
    draw();
  }

  const fmt = v => Number.isFinite(v) ? Number(v.toPrecision(6)).toString() : 'undefined';
  const fmtList = (list, mapper) => list.length ? list.map(mapper).join(',  ') : 'none in range';

  function renderAnalysis(slot, result, polar) {
    const rows = [];
    const add = (label, value) => rows.push(el('div', { class: 'graph-analysis-row' },
      el('span', { class: 'graph-analysis-label' }, label),
      el('span', { class: 'graph-analysis-value' }, value)));

    if (!result.ok) {
      analysisBox.replaceChildren(
        el('h4', { class: 'graph-analysis-title' }, `Analysis · ${slot.label}`),
        el('p', { class: 'graph-analysis-empty' }, result.reason)
      );
      return;
    }

    const rangeText = polar
      ? `θ from ${fmt(result.a)} to ${fmt(result.b)}`
      : `x from ${fmt(result.a)} to ${fmt(result.b)}`;
    add('Formula', `${slot.label} = ${result.expr}`);
    add('Range', rangeText);
    if (polar) {
      add('Area swept (½∫r² dθ)', fmt(result.area));
      add('Curve length', fmt(result.arcLength));
      add('Smallest r', fmt(result.minR));
      add('Largest r', fmt(result.maxR));
      add('θ where r = 0', fmtList(result.zeros, v => `${fmt(v)} rad`));
    } else {
      add('Area under curve (∫)', fmt(result.integral));
      add('Curve length (arc)', fmt(result.arcLength));
      add('Average height', fmt(result.average));
      add('Lowest point', fmt(result.min));
      add('Highest point', fmt(result.max));
      add('Slope at a', fmt(result.slopeAtA));
      add('Slope at b', fmt(result.slopeAtB));
      add('Concavity at midpoint', fmt(result.curvature));
      add('Roots (y = 0)', fmtList(result.roots, v => `x = ${fmt(v)}`));
      add('Turning points', fmtList(result.extrema, p =>
        `${p.kind === 'max' ? 'peak' : p.kind === 'min' ? 'valley' : 'flat'} at (${fmt(p.x)}, ${fmt(p.y)})`));
      for (const c of result.crossings) {
        add(`Crosses ${c.label}`, fmtList(c.points, v => `x = ${fmt(v)}`));
      }
      if (!result.crossings.length) add('Crosses other curves', 'none in range');
    }
    analysisBox.replaceChildren(
      el('h4', { class: 'graph-analysis-title' }, `Analysis · ${slot.label} · ${polar ? 'polar' : 'cartesian'}`),
      ...rows,
      el('button', {
        type: 'button',
        class: 'gbtn gbtn-chip',
        onclick: () => { playPop(560); runAnalysis(); }
      }, '↻ Run it again')
    );
  }

  /** A grid spacing that reads as 1, 2, 5 or 10 at any zoom. */
  function niceStep(target) {
    const mag = 10 ** Math.floor(Math.log10(target));
    const norm = target / mag;
    return (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag;
  }

  function plotCartesian(ctx, s, originX, originY, w, h) {
    const stepPx = 2;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let drawing = false;
    let prevPy = null;
    for (let px = 0; px <= w; px += stepPx) {
      const xv = (px - originX) / scale;
      const yv = graphValue(s.expr, xv);
      const py = originY - yv * scale;
      if (!Number.isFinite(py) || Math.abs(py) > h * 4 || (prevPy !== null && Math.abs(py - prevPy) > h * 0.9)) {
        drawing = false; prevPy = null;
      } else if (!drawing) {
        ctx.moveTo(px, py); drawing = true; prevPy = py;
      } else {
        ctx.lineTo(px, py); prevPy = py;
      }
    }
    ctx.stroke();
  }

  function shadeArea(ctx, s, originX, originY, w, h) {
    const x0 = Math.max(0, originX + bounds.a * scale);
    const x1 = Math.min(w, originX + bounds.b * scale);
    if (x1 <= x0) return;
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = s.color;
    ctx.beginPath();
    let started = false;
    const axisY = Math.min(Math.max(originY, 0), h);
    for (let px = x0; px <= x1; px += 2) {
      const xv = (px - originX) / scale;
      const yv = graphValue(s.expr, xv);
      const py = originY - yv * scale;
      if (!Number.isFinite(py) || Math.abs(py) > h * 4) continue;
      const clamped = Math.min(Math.max(py, -h), h * 2);
      if (!started) { ctx.moveTo(px, axisY); ctx.lineTo(px, clamped); started = true; }
      else ctx.lineTo(px, clamped);
    }
    if (started) { ctx.lineTo(x1, axisY); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }

  function plotDerivative(ctx, s, originX, originY, w, h) {
    const hh = Math.max(1e-6, 1 / (scale * 8));
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    let drawing = false;
    let prevPy = null;
    for (let px = 0; px <= w; px += 3) {
      const xv = (px - originX) / scale;
      const left = graphValue(s.expr, xv - hh);
      const right = graphValue(s.expr, xv + hh);
      const slope = Number.isFinite(left) && Number.isFinite(right) ? (right - left) / (2 * hh) : NaN;
      const py = originY - slope * scale;
      if (!Number.isFinite(py) || Math.abs(py) > h * 4 || (prevPy !== null && Math.abs(py - prevPy) > h * 0.9)) {
        drawing = false; prevPy = null;
      } else if (!drawing) { ctx.moveTo(px, py); drawing = true; prevPy = py; }
      else { ctx.lineTo(px, py); prevPy = py; }
    }
    ctx.stroke();
    ctx.restore();
  }

  function plotPolar(ctx, s, originX, originY, w, h) {
    const turns = polarTurns;
    const steps = 1400;
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const t = (PI * 2 * turns * i) / steps;
      const r = graphValue(s.expr, t);
      if (!Number.isFinite(r)) { points.push(null); continue; }
      const px = originX + r * Math.cos(t) * scale;
      const py = originY - r * Math.sin(t) * scale;
      if (Math.abs(px) > w * 4 || Math.abs(py) > h * 4) { points.push(null); continue; }
      points.push({ px, py });
    }
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let drawing = false;
    for (const p of points) {
      if (!p) { drawing = false; continue; }
      if (!drawing) { ctx.moveTo(p.px, p.py); drawing = true; } else ctx.lineTo(p.px, p.py);
    }
    ctx.stroke();

    if (showArea && s.id === activeSlot) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      let started = false;
      for (const p of points) {
        if (!p) continue;
        if (!started) { ctx.moveTo(originX, originY); ctx.lineTo(p.px, p.py); started = true; }
        else ctx.lineTo(p.px, p.py);
      }
      if (started) { ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
  }

  function drawMarkers(ctx, s, originX, originY, h) {
    if (!analysis || !analysisFor || analysisFor.slot !== s.id || analysisFor.mode !== mode) return;
    ctx.save();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    const mark = (x, y, kind) => {
      const px = originX + x * scale;
      const py = originY - y * scale;
      if (px < -12 || px > canvas.width + 12 || py < -12 || py > h + 12) return;
      ctx.beginPath();
      if (kind === 'root') { ctx.fillStyle = '#fff8ea'; ctx.arc(px, py, 5.5, 0, PI * 2); ctx.fill(); ctx.stroke(); return; }
      if (kind === 'cross') {
        ctx.beginPath(); ctx.moveTo(px - 5, py - 5); ctx.lineTo(px + 5, py + 5);
        ctx.moveTo(px + 5, py - 5); ctx.lineTo(px - 5, py + 5); ctx.stroke(); return;
      }
      ctx.fillStyle = s.color;
      ctx.moveTo(px, py - 6); ctx.lineTo(px + 6, py); ctx.lineTo(px, py + 6); ctx.lineTo(px - 6, py);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    };
    for (const r of analysis.roots || analysis.zeros || []) mark(r, 0, 'root');
    for (const p of analysis.extrema || []) mark(p.x, p.y, p.kind === 'max' ? 'peak' : 'valley');
    for (const c of analysis.crossings || []) for (const x of c.points) mark(x, graphValue(s.expr, x), 'cross');
    ctx.restore();
  }

  function draw() {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    const polar = mode === 'polar';
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#fff8ea';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#efe0c2';
    ctx.fillRect(0, 0, w, 9);
    ctx.fillRect(0, 0, 7, h);

    const originX = w / 2 - centerX * scale;
    const originY = h / 2 + centerY * scale;
    const step = niceStep(65 / scale);

    if (polar) {
      ctx.strokeStyle = '#efe2c9';
      ctx.lineWidth = 1.5;
      const maxR = (Math.max(w, h) / 2 + Math.abs(centerX) + Math.abs(centerY)) / scale + step;
      for (let r = step; r <= maxR; r += step) {
        ctx.beginPath(); ctx.arc(originX, originY, r * scale, 0, PI * 2); ctx.stroke();
      }
      for (let i = 0; i < 12; i++) {
        const t = (PI * 2 * i) / 12;
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(originX + Math.cos(t) * maxR * scale, originY - Math.sin(t) * maxR * scale);
        ctx.stroke();
      }
      ctx.strokeStyle = '#8b6647';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, originY); ctx.lineTo(w, originY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(originX, 0); ctx.lineTo(originX, h); ctx.stroke();
      ctx.fillStyle = '#6d4b33';
      ctx.font = '700 13px Nunito, sans-serif';
      for (let r = step; r <= maxR; r += step) {
        ctx.fillText(Number(r.toPrecision(3)).toString(), originX + r * scale + 4, originY - 6);
      }
    } else {
      ctx.strokeStyle = '#efe2c9';
      ctx.lineWidth = 1.5;
      const minX = Math.floor((0 - originX) / (scale * step)) * step;
      const maxX = Math.ceil((w - originX) / (scale * step)) * step;
      for (let x = minX; x <= maxX; x += step) {
        const px = originX + x * scale;
        ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
      }
      const minY = Math.floor((originY - h) / (scale * step)) * step;
      const maxY = Math.ceil(originY / (scale * step)) * step;
      for (let y = minY; y <= maxY; y += step) {
        const py = originY - y * scale;
        ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
      }

      ctx.strokeStyle = '#8b6647';
      ctx.lineWidth = 3;
      if (originX >= 0 && originX <= w) { ctx.beginPath(); ctx.moveTo(originX, 0); ctx.lineTo(originX, h); ctx.stroke(); }
      if (originY >= 0 && originY <= h) { ctx.beginPath(); ctx.moveTo(0, originY); ctx.lineTo(w, originY); ctx.stroke(); }

      ctx.fillStyle = '#6d4b33';
      ctx.font = '700 13px Nunito, sans-serif';
      for (let x = minX; x <= maxX; x += step) {
        if (Math.abs(x) < step * 0.1) continue;
        ctx.fillText(Number(x.toPrecision(4)).toString(), originX + x * scale + 4, Math.min(h - 18, Math.max(20, originY + 18)));
      }
      for (let y = minY; y <= maxY; y += step) {
        if (Math.abs(y) < step * 0.1) continue;
        ctx.fillText(Number(y.toPrecision(4)).toString(), Math.min(w - 38, Math.max(8, originX + 8)), originY - y * scale - 5);
      }
    }

    const errors = [];
    for (const s of slots) {
      if (!s.visible || !s.expr.trim()) continue;
      const probe = graphValue(s.expr, polar ? 0.7 : 0);
      if (Number.isNaN(probe)) {
        try { evalExpression(s.expr, { xValue: polar ? 0.7 : 0 }); } catch (err) {
          if (err.message !== 'Undefined math result.' && err.message !== 'Cannot divide by zero.') errors.push(`${s.label}: ${err.message}`);
        }
      }
      if (polar) {
        plotPolar(ctx, s, originX, originY, w, h);
      } else {
        if (showArea && s.id === activeSlot) shadeArea(ctx, s, originX, originY, w, h);
        plotCartesian(ctx, s, originX, originY, w, h);
        if (showDerivative && s.id === activeSlot) plotDerivative(ctx, s, originX, originY, w, h);
        if (showMarkers) drawMarkers(ctx, s, originX, originY, h);
      }
    }

    if (hoverPt && !polar) {
      const xv = (hoverPt.x - originX) / scale;
      ctx.strokeStyle = '#c49d78';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(hoverPt.x, 0); ctx.lineTo(hoverPt.x, h); ctx.stroke();
      ctx.setLineDash([]);

      const parts = [`x = ${xv.toFixed(2)}`];
      for (const s of slots) {
        if (!s.visible || !s.expr.trim()) continue;
        const yv = graphValue(s.expr, xv);
        if (Number.isFinite(yv)) {
          const py = originY - yv * scale;
          if (py >= -10 && py <= h + 10) {
            ctx.fillStyle = s.color;
            ctx.strokeStyle = INK;
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(hoverPt.x, py, 6.5, 0, PI * 2); ctx.fill(); ctx.stroke();
          }
          parts.push(`${s.label} = ${Number(yv.toFixed(3))}`);
          if (s.id === activeSlot) {
            const slope = graphDerivative(s.expr, xv);
            if (Number.isFinite(slope)) parts.push(`slope = ${Number(slope.toFixed(3))}`);
          }
        }
      }
      readout.textContent = errors.length ? errors[0] : parts.join('   •   ');
    } else if (hoverPt && polar) {
      const dx = (hoverPt.x - originX) / scale;
      const dy = -(hoverPt.y - originY) / scale;
      const r = Math.hypot(dx, dy);
      let t = Math.atan2(dy, dx);
      if (t < 0) t += PI * 2;
      readout.textContent = `r = ${r.toFixed(2)}   •   θ = ${t.toFixed(2)} rad (${((t * 180) / PI).toFixed(0)}°)`;
    } else if (errors.length) {
      readout.textContent = errors[0];
    } else {
      readout.textContent = polar
        ? `Pole at (${centerX.toFixed(1)}, ${centerY.toFixed(1)})  •  ${polarTurns} turn${polarTurns === 1 ? '' : 's'}  •  Tap the grid to read r and θ`
        : `Center (${centerX.toFixed(1)}, ${centerY.toFixed(1)})  •  Tap grid to inspect`;
    }
  }

  function trace(e) {
    const r = canvas.getBoundingClientRect();
    hoverPt = {
      x: ((e.clientX - r.left) / (r.width || 1)) * canvas.width,
      y: ((e.clientY - r.top) / (r.height || 1)) * canvas.height
    };
    draw();
  }
  canvas.addEventListener('pointerdown', trace);
  canvas.addEventListener('pointermove', trace);
  canvas.addEventListener('pointerleave', () => { hoverPt = null; draw(); });

  const zoomPad = el('div', { class: 'graph-controls' },
    el('button', { type: 'button', class: 'gbtn gbtn-mini', onclick: () => { playPop(600); scale = Math.min(200, scale * 1.25); draw(); } }, 'Zoom +'),
    el('button', { type: 'button', class: 'gbtn gbtn-mini', onclick: () => { playPop(420); scale = Math.max(10, scale / 1.25); draw(); } }, 'Zoom −'),
    el('button', { type: 'button', class: 'gbtn gbtn-mini', onclick: () => { playPop(460); centerX -= 1.5; draw(); } }, '←'),
    el('button', { type: 'button', class: 'gbtn gbtn-mini', onclick: () => { playPop(460); centerX += 1.5; draw(); } }, '→'),
    el('button', { type: 'button', class: 'gbtn gbtn-mini', onclick: () => { playPop(460); centerY += 1.5; draw(); } }, '↑'),
    el('button', { type: 'button', class: 'gbtn gbtn-mini', onclick: () => { playPop(460); centerY -= 1.5; draw(); } }, '↓'),
    el('button', { type: 'button', class: 'gbtn gbtn-mini', onclick: () => {
      playPop(460);
      const win = windowRange();
      bounds = { a: Number(win.a.toPrecision(4)), b: Number(win.b.toPrecision(4)) };
      boundA.input.value = String(bounds.a);
      boundB.input.value = String(bounds.b);
      invalidateAnalysis();
    } }, 'Use window'),
    el('button', { type: 'button', class: 'gbtn gbtn-mini warn', onclick: () => { playSquish(); centerX = 0; centerY = 0; scale = 42; draw(); } }, 'Center')
  );

  const analysisPad = el('div', { class: 'graph-controls' },
    boundA.el,
    boundB.el,
    el('button', { type: 'button', class: 'gbtn gbtn-primary', onclick: () => { playSparkle(); runAnalysis(); } }, '⚡ Analyse curve')
  );

  root.replaceChildren(
    el('div', { class: 'game-panel' },
      modeTabs.el,
      modeHint,
      tabs.el,
      el('div', { class: 'graph-expr-row' }, exprField.el, visToggle.el),
      el('div', { class: 'graph-overlay-row' }, derivToggle.el, areaToggle.el, markerToggle.el),
      turnsSlider.el,
      presetRow,
      analysisPad,
      analysisBox,
      tableBox,
      el('div', { class: 'graph-bezel' }, canvas),
      zoomPad,
      readout
    )
  );
  syncMode();
}

// =========================================================================
// 3. BODILY CALCULATOR — Cozy Scale Dial Gauge, tape-test body fat and eleven
//    more readings beside the BMI.
// =========================================================================
function bodilyCalculator(root) {
  let imperial = false;
  let sex = 'female';
  let activity = 1.375;
  let age = 26;

  const unitToggle = createGameToggle({
    checked: false,
    offLabel: 'CM / KG',
    onLabel: 'IN / LB',
    label: 'Unit system',
    onChange: val => {
      playPop(520);
      imperial = val;
      const label = (slider, metric, imp) => { slider.el.querySelector('.gslider-label').textContent = imperial ? imp : metric; };
      label(heightSlider, 'Height (cm)', 'Height (ft / in)');
      label(weightSlider, 'Weight (kg)', 'Weight (lb)');
      label(waistSlider, 'Waist (cm)', 'Waist (in)');
      label(neckSlider, 'Neck (cm)', 'Neck (in)');
      label(hipSlider, 'Hip (cm)', 'Hip (in)');
      update();
    }
  });

  const sexTabs = createGameTabs({
    items: [
      { value: 'female', label: 'Female', icon: '🌸' },
      { value: 'male', label: 'Male', icon: '🌿' }
    ],
    value: 'female',
    onChange: v => { playPop(540); sex = v; update(); }
  });

  const activityTabs = createGameTabs({
    items: [
      { value: '1.2', label: 'Cozy Rest' },
      { value: '1.375', label: 'Light Walk' },
      { value: '1.55', label: 'Active' },
      { value: '1.725', label: 'Sporty' },
      { value: '1.9', label: 'Two-a-days' }
    ],
    value: '1.375',
    onChange: v => { playPop(560); activity = Number(v); update(); }
  });

  const heightSlider = createGameSlider({ label: 'Height (cm)', min: 120, max: 220, step: 1, value: 170, color: '#9bc9f2', onChange: () => update() });
  const weightSlider = createGameSlider({ label: 'Weight (kg)', min: 35, max: 180, step: 0.5, value: 66, color: '#f7b2a6', onChange: () => update() });
  const ageSlider = createGameSlider({ label: 'Age (years)', min: 14, max: 95, step: 1, value: 26, color: '#ffe082', onChange: v => { age = v; update(); } });
  const waistSlider = createGameSlider({ label: 'Waist (cm)', min: 50, max: 140, step: 1, value: 76, color: '#b7dfb3', onChange: () => update() });
  const neckSlider = createGameSlider({ label: 'Neck (cm)', min: 25, max: 60, step: 0.5, value: 33, color: '#dfd0f5', onChange: () => update() });
  const hipSlider = createGameSlider({ label: 'Hip (cm)', min: 60, max: 150, step: 1, value: 95, color: '#ffd2b8', onChange: () => update() });

  const bmiValEl = el('div', { class: 'stat-big' }, '22.8');
  const bmiBadge = el('span', { class: 'gbadge' }, 'Cozy & Healthy');
  const dialWrap = el('div', { class: 'bmi-dial-wrap' });
  const bmrValEl = el('div', { class: 'stat-mid' });
  const bmrHbEl = el('div', { class: 'stat-mid' });
  const tdeeValEl = el('div', { class: 'stat-mid' });
  const rangeValEl = el('div', { class: 'stat-mid' });
  const whtrValEl = el('div', { class: 'stat-mid' });
  const fatValEl = el('div', { class: 'stat-mid' });
  const leanValEl = el('div', { class: 'stat-mid' });
  const idealValEl = el('div', { class: 'stat-mid' });
  const bsaValEl = el('div', { class: 'stat-mid' });
  const waterValEl = el('div', { class: 'stat-mid' });
  const proteinValEl = el('div', { class: 'stat-mid' });
  const primeValEl = el('div', { class: 'stat-mid' });
  const ponderalValEl = el('div', { class: 'stat-mid' });
  const whrValEl = el('div', { class: 'stat-mid' });

  function renderDial(bmi) {
    // Map BMI 12..40 to -78deg..+78deg
    const clamped = Math.min(40, Math.max(12, bmi));
    const deg = -78 + ((clamped - 12) / 28) * 156;
    dialWrap.innerHTML = `<svg class="game-svg" viewBox="0 0 220 125" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M22 105 A88 88 0 0 1 65 30" stroke="#bfe3ff" stroke-width="20" stroke-linecap="round"/>
      <path d="M68 28 A88 88 0 0 1 132 20" stroke="#b8e3b3" stroke-width="20" stroke-linecap="round"/>
      <path d="M135 21 A88 88 0 0 1 175 48" stroke="#ffe082" stroke-width="20" stroke-linecap="round"/>
      <path d="M177 51 A88 88 0 0 1 198 105" stroke="#ffb3a7" stroke-width="20" stroke-linecap="round"/>
      <path d="M22 105 A88 88 0 0 1 198 105" stroke="${INK}" stroke-width="3.5" stroke-dasharray="2 12" opacity="0.35"/>
      <g transform="translate(110,104) rotate(${deg.toFixed(1)})">
        <path d="M-6 0 L0 -76 L6 0 Z" fill="#e36d5b" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      </g>
      <circle cx="110" cy="104" r="12" fill="#ffe184" stroke="${INK}" stroke-width="3.5"/>
    </svg>`;
  }

  /** US Navy tape test. Everything in centimetres; NaN when the tape readings cannot work. */
  function bodyFatPercent(heightCm, waistCm, neckCm, hipCm) {
    if (sex === 'male') {
      const diff = waistCm - neckCm;
      if (diff <= 0) return NaN;
      return 495 / (1.0324 - 0.19077 * Math.log10(diff) + 0.15456 * Math.log10(heightCm)) - 455;
    }
    const diff = waistCm + hipCm - neckCm;
    if (diff <= 0) return NaN;
    return 495 / (1.29579 - 0.35004 * Math.log10(diff) + 0.221 * Math.log10(heightCm)) - 455;
  }

  function fatCategory(pct) {
    if (!Number.isFinite(pct)) return '—';
    const bands = sex === 'male'
      ? [[6, 'Essential'], [14, 'Athletic'], [18, 'Fit'], [25, 'Average']]
      : [[14, 'Essential'], [21, 'Athletic'], [25, 'Fit'], [32, 'Average']];
    for (const [limit, name] of bands) if (pct < limit) return name;
    return 'High';
  }

  /** A reading plus the unit it is in, so imperial mode never shows centimetres by accident. */
  const lenText = cm => (imperial ? `${Math.round(cm / 2.54)} in` : `${Number(cm.toFixed(1))} cm`);
  const massText = kg => (imperial ? `${Math.round(kg / 0.45359237)} lb` : `${Number(kg.toFixed(1))} kg`);

  function update() {
    const hVal = heightSlider.getValue();
    const wVal = weightSlider.getValue();
    const wsVal = waistSlider.getValue();
    const nkVal = neckSlider.getValue();
    const hpVal = hipSlider.getValue();

    const actualCm = imperial ? Math.round(48 + ((hVal - 120) / 100) * 38) * 2.54 : hVal;
    const actualKg = imperial ? Math.round(80 + ((wVal - 35) / 145) * 270) * 0.45359237 : wVal;
    const actualWaist = imperial ? Math.round(20 + ((wsVal - 50) / 90) * 36) * 2.54 : wsVal;
    const actualNeck = imperial ? Math.round(10 + ((nkVal - 25) / 35) * 14) * 2.54 : nkVal;
    const actualHip = imperial ? Math.round(24 + ((hpVal - 60) / 90) * 36) * 2.54 : hpVal;

    if (imperial) {
      const inches = Math.round(actualCm / 2.54);
      heightSlider.el.querySelector('.gslider-badge').textContent = `${Math.floor(inches / 12)}'${inches % 12}"`;
      weightSlider.el.querySelector('.gslider-badge').textContent = `${Math.round(actualKg / 0.45359237)} lb`;
      waistSlider.el.querySelector('.gslider-badge').textContent = `${Math.round(actualWaist / 2.54)} in`;
      neckSlider.el.querySelector('.gslider-badge').textContent = `${Math.round(actualNeck / 2.54)} in`;
      hipSlider.el.querySelector('.gslider-badge').textContent = `${Math.round(actualHip / 2.54)} in`;
    } else {
      heightSlider.el.querySelector('.gslider-badge').textContent = `${actualCm} cm`;
      weightSlider.el.querySelector('.gslider-badge').textContent = `${actualKg} kg`;
      waistSlider.el.querySelector('.gslider-badge').textContent = `${actualWaist} cm`;
      neckSlider.el.querySelector('.gslider-badge').textContent = `${actualNeck} cm`;
      hipSlider.el.querySelector('.gslider-badge').textContent = `${actualHip} cm`;
    }

    const m = actualCm / 100;
    const bmi = actualKg / (m * m);
    bmiValEl.textContent = bmi.toFixed(1);
    renderDial(bmi);

    let cat = 'Cozy & Healthy', badgeBg = '#b8e3b3';
    if (bmi < 18.5) { cat = 'Light / Underweight'; badgeBg = '#bfe3ff'; }
    else if (bmi < 25) { cat = 'Cozy & Healthy'; badgeBg = '#b8e3b3'; }
    else if (bmi < 30) { cat = 'Slightly Over'; badgeBg = '#ffe082'; }
    else { cat = 'High BMI'; badgeBg = '#ffb3a7'; }
    bmiBadge.textContent = cat;
    bmiBadge.style.background = badgeBg;

    // Mifflin-St Jeor, which is what the kitchen has always used.
    const bmr = 10 * actualKg + 6.25 * actualCm - 5 * age + (sex === 'male' ? 5 : -161);
    // Harris-Benedict revised, as a second opinion — the two disagree by a few
    // percent and seeing both is more honest than pretending one is the truth.
    const bmrHb = sex === 'male'
      ? 88.362 + 13.397 * actualKg + 4.799 * actualCm - 5.677 * age
      : 447.593 + 9.247 * actualKg + 3.098 * actualCm - 4.33 * age;
    const tdee = bmr * activity;
    const lowKg = 18.5 * m * m;
    const highKg = 24.9 * m * m;
    const whtr = actualWaist / actualCm;
    const whr = actualWaist / actualHip;

    const fatPct = bodyFatPercent(actualCm, actualWaist, actualNeck, actualHip);
    const leanKg = Number.isFinite(fatPct) ? actualKg * (1 - fatPct / 100) : NaN;
    const inchesOver60 = actualCm / 2.54 - 60;
    const idealKg = (sex === 'male' ? 50 : 45.5) + 2.3 * Math.max(0, inchesOver60);
    const bsa = Math.sqrt((actualCm * actualKg) / 3600);          // Mosteller
    const waterL = (actualKg * 35) / 1000;                        // 35 mL per kg
    const prime = bmi / 25;
    const ponderal = actualKg / (m * m * m);

    bmrValEl.textContent = `${Math.round(bmr)} kcal/day`;
    bmrHbEl.textContent = `${Math.round(bmrHb)} kcal/day`;
    tdeeValEl.textContent = `${Math.round(tdee)} kcal/day`;
    rangeValEl.textContent = imperial
      ? `${Math.round(lowKg / 0.45359237)}–${Math.round(highKg / 0.45359237)} lb`
      : `${lowKg.toFixed(1)}–${highKg.toFixed(1)} kg`;
    whtrValEl.textContent = `${whtr.toFixed(2)} ${whtr < 0.5 ? '(Balanced)' : '(Elevated)'}`;
    whrValEl.textContent = `${whr.toFixed(2)} ${whr < (sex === 'male' ? 0.9 : 0.85) ? '(Balanced)' : '(Elevated)'}`;
    fatValEl.textContent = Number.isFinite(fatPct)
      ? `${Math.max(0, fatPct).toFixed(1)}% (${fatCategory(Math.max(0, fatPct))})`
      : 'Check the tape readings';
    leanValEl.textContent = Number.isFinite(leanKg) ? massText(leanKg) : '—';
    idealValEl.textContent = `${massText(idealKg)} (Devine)`;
    bsaValEl.textContent = `${bsa.toFixed(2)} m² (Mosteller)`;
    waterValEl.textContent = `${waterL.toFixed(1)} L/day`;
    proteinValEl.textContent = `${Math.round(actualKg * 0.8)}–${Math.round(actualKg * 1.6)} g/day`;
    primeValEl.textContent = `${prime.toFixed(2)} ${prime < 0.74 ? '(Light)' : prime <= 1 ? '(Cozy)' : prime <= 1.2 ? '(Slightly over)' : '(High)'}`;
    ponderalValEl.textContent = `${ponderal.toFixed(1)} kg/m³`;
  }

  const cuteHeaderIcon = `<svg class="game-svg body-icon" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="26" fill="#ffd9c8" stroke="${INK}" stroke-width="3.5"/><path d="M32 46 C32 46 17 36 17 27 C17 22.5 20.5 19.5 24.5 19.5 C27.8 19.5 30.4 21.6 32 24.2 C33.6 21.6 36.2 19.5 39.5 19.5 C43.5 19.5 47 22.5 47 27 C47 36 32 46 32 46Z" fill="#ff8f8f" stroke="${INK}" stroke-width="3"/></svg>`;

  const panel = el('div', { class: 'game-panel body-panel' },
    el('div', { class: 'body-top' },
      el('div', { class: 'body-title-row' },
        (() => { const d = el('span'); d.innerHTML = cuteHeaderIcon; return d; })(),
        el('div', {}, el('strong', {}, 'Cozy Kitchen Scale & BMI'), el('p', {}, 'Drag the round sliders to watch the dial needle swing'))
      ),
      unitToggle.el
    ),
    el('div', { class: 'two-col' },
      el('div', { class: 'pastel-card peach' },
        sexTabs.el,
        heightSlider.el,
        weightSlider.el,
        ageSlider.el,
        waistSlider.el,
        neckSlider.el,
        hipSlider.el,
        el('div', { class: 'gfield-label' }, 'Daily Activity'),
        activityTabs.el,
        el('p', { class: 'body-note' }, 'Neck and hip feed the US Navy tape test. Hip is only used for the female formula. These are cozy estimates, not medical advice.')
      ),
      el('div', { class: 'pastel-card cream' },
        el('div', { class: 'bmi-card' },
          el('span', { class: 'gfield-label' }, 'Body Mass Dial'),
          dialWrap,
          bmiValEl,
          bmiBadge
        ),
        el('div', { class: 'stat-grid' },
          el('div', { class: 'stat-box' }, el('span', {}, '🔥 Resting BMR (Mifflin)'), bmrValEl),
          el('div', { class: 'stat-box' }, el('span', {}, '🔥 Resting BMR (Harris-Benedict)'), bmrHbEl),
          el('div', { class: 'stat-box' }, el('span', {}, '⚡ Daily Calories'), tdeeValEl),
          el('div', { class: 'stat-box' }, el('span', {}, '⚖️ Healthy Weight'), rangeValEl),
          el('div', { class: 'stat-box' }, el('span', {}, '🥧 Body Fat (Navy)'), fatValEl),
          el('div', { class: 'stat-box' }, el('span', {}, '🥩 Lean Mass'), leanValEl),
          el('div', { class: 'stat-box' }, el('span', {}, '🎯 Ideal Weight'), idealValEl),
          el('div', { class: 'stat-box' }, el('span', {}, '📐 Body Surface Area'), bsaValEl),
          el('div', { class: 'stat-box' }, el('span', {}, '📏 Waist / Height'), whtrValEl),
          el('div', { class: 'stat-box' }, el('span', {}, '📏 Waist / Hip'), whrValEl),
          el('div', { class: 'stat-box' }, el('span', {}, '📊 BMI Prime'), primeValEl),
          el('div', { class: 'stat-box' }, el('span', {}, '📏 Ponderal Index'), ponderalValEl),
          el('div', { class: 'stat-box' }, el('span', {}, '💧 Daily Water'), waterValEl),
          el('div', { class: 'stat-box' }, el('span', {}, '🍗 Protein Target'), proteinValEl)
        )
      )
    )
  );
  root.replaceChildren(panel);
  update();
}

// =========================================================================
// 4. FRACTION CALCULATOR — Wooden Bakery Fraction Blocks: eight operations,
//    three pies, the working shown, and a strip of facts about A and B.
// =========================================================================
function gcdBig(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
}

function makeFractionBox(label, initN, initD, color, onChange) {
  const numIn = el('input', { type: 'text', class: 'frac-input', value: String(initN), inputmode: 'numeric', 'aria-label': `${label} numerator` });
  const denIn = el('input', { type: 'text', class: 'frac-input', value: String(initD), inputmode: 'numeric', 'aria-label': `${label} denominator` });

  const step = (inp, delta, preventZero = false) => {
    playPop(delta > 0 ? 580 : 440);
    const v = parseInt(inp.value, 10);
    let next = (Number.isFinite(v) ? v : 0) + delta;
    if (preventZero && next === 0) next += delta;
    inp.value = String(next);
    onChange();
  };

  numIn.addEventListener('input', onChange);
  denIn.addEventListener('input', onChange);

  const box = el('div', { class: 'frac-card', style: `background:${color}` },
    el('span', { class: 'gfield-label' }, label),
    el('div', { class: 'frac-row' },
      el('button', { type: 'button', class: 'gbtn gbtn-mini', onclick: () => step(numIn, -1) }, '−'),
      numIn,
      el('button', { type: 'button', class: 'gbtn gbtn-mini', onclick: () => step(numIn, 1) }, '+')
    ),
    el('div', { class: 'frac-bar' }),
    el('div', { class: 'frac-row' },
      el('button', { type: 'button', class: 'gbtn gbtn-mini', onclick: () => step(denIn, -1, true) }, '−'),
      denIn,
      el('button', { type: 'button', class: 'gbtn gbtn-mini', onclick: () => step(denIn, 1, true) }, '+')
    )
  );
  return { el: box, numIn, denIn };
}

function fractions(root) {
  let op = '+';
  const resultFrac = el('div', { class: 'frac-result-big' });
  const resultDetail = el('div', { class: 'output', 'aria-live': 'polite' });
  const workingEl = el('div', { class: 'frac-working' });
  const pieWrap = el('div', { class: 'frac-pie-row' });
  const insightBox = el('div', { class: 'frac-insights' });

  const boxA = makeFractionBox('Fraction A', 1, 2, '#fff1cf', compute);
  const boxB = makeFractionBox('Fraction B', 1, 3, '#dff2db', compute);

  const opTabs = createGameTabs({
    items: [
      { value: '+', label: '+' },
      { value: '-', label: '−' },
      { value: '*', label: '×' },
      { value: '/', label: '÷' },
      { value: 'avg', label: 'Average' },
      { value: 'delta', label: 'Difference' },
      { value: 'percent', label: 'A as % of B' },
      { value: 'flip', label: 'Flip A' }
    ],
    value: '+',
    cls: 'frac-ops',
    onChange: v => { playPop(560); op = v; compute(); }
  });

  /** One pie as an SVG string, so several can sit side by side under a label. */
  function pieSVG(n, d) {
    const num = Number(n), den = Number(d);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0 || den > 24 || Math.abs(num) > 48) {
      return `<span class="gbadge">Pie needs a denominator of 24 or less</span>`;
    }
    const ratio = Math.min(1, Math.max(0, Math.abs(num) / den));
    const cx = 56, cy = 56, r = 46;
    const angle = ratio * 2 * PI;
    const x = cx + r * Math.sin(angle);
    const y = cy - r * Math.cos(angle);
    const large = ratio > 0.5 ? 1 : 0;
    const slice = ratio === 0 ? '' : ratio >= 0.9999
      ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ff9e85" stroke="${INK}" stroke-width="3"/>`
      : `<path d="M${cx} ${cy} L${cx} ${cy - r} A${r} ${r} 0 ${large} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z" fill="#ff9e85" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
    let lines = '';
    for (let k = 0; k < den; k++) {
      const a = (k / den) * 2 * PI;
      lines += `<line x1="${cx}" y1="${cy}" x2="${(cx + r * Math.sin(a)).toFixed(2)}" y2="${(cy - r * Math.cos(a)).toFixed(2)}" stroke="${INK}" stroke-width="2.2"/>`;
    }
    return `<svg class="game-svg" width="112" height="112" viewBox="0 0 112 112"><circle cx="${cx}" cy="${cy + 4}" r="${r}" fill="#d6a057" stroke="${INK}" stroke-width="3.5"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff6df" stroke="${INK}" stroke-width="3.5"/>${slice}${lines}<circle cx="${cx}" cy="${cy}" r="6" fill="#fff6df" stroke="${INK}" stroke-width="2.5"/></svg>`;
  }

  /** Reduced form of a fraction, with the sign carried by the numerator. */
  function reduce(n, d) {
    if (d < 0n) { n = -n; d = -d; }
    const g = gcdBig(n, d) || 1n;
    return { n: n / g, d: d / g };
  }

  function lcmBig(a, b) {
    const g = gcdBig(a, b);
    return g === 0n ? 0n : (a < 0n ? -a : a) / g * (b < 0n ? -b : b);
  }

  const mixedText = (n, d) => {
    if (d === 1n) return `whole number ${n}`;
    const whole = n / d;
    const rem = (n < 0n ? -n : n) % d;
    if (rem === 0n) return `whole number ${whole}`;
    // "mixed 0 5/6" is a silly way to describe a fraction that is already proper.
    if (whole === 0n) return `proper fraction ${n < 0n ? '-' : ''}${rem}/${d}`;
    return `mixed ${n < 0n ? '-' : ''}${whole < 0n ? -whole : whole} ${rem}/${d}`;
  };

  const decimalText = (n, d) => {
    const dec = Number(n) / Number(d);
    return Number.isFinite(dec) ? numberText(dec) : 'too large for decimals';
  };

  function renderInsights(a, b, c, d) {
    // Everything here works from the reduced forms. Using the raw denominators
    // would call 8 the lowest common denominator of 4/8 and 3/4, which is a
    // common denominator but not the lowest one.
    const ra = reduce(a, b);
    const rb = reduce(c, d);
    const lcm = lcmBig(ra.d, rb.d);
    const left = ra.n * rb.d, right = rb.n * ra.d;           // cross-multiply to compare
    const comparison = left > right ? 'A is bigger' : left < right ? 'B is bigger' : 'A and B are equal';
    const diff = reduce(left - right, ra.d * rb.d);
    const rows = [
      ['A simplified', `${ra.n}/${ra.d}`],
      ['B simplified', `${rb.n}/${rb.d}`],
      ['A as a decimal', decimalText(ra.n, ra.d)],
      ['B as a decimal', decimalText(rb.n, rb.d)],
      ['A as a percent', `${decimalText(ra.n * 100n, ra.d)}%`],
      ['B as a percent', `${decimalText(rb.n * 100n, rb.d)}%`],
      ['Flip A (reciprocal)', ra.n === 0n ? 'zero has no reciprocal' : `${ra.d}/${ra.n}`],
      ['Flip B (reciprocal)', rb.n === 0n ? 'zero has no reciprocal' : `${rb.d}/${rb.n}`],
      ['Greatest common divisor', `${gcdBig(ra.n, rb.n)} of the numerators, ${gcdBig(ra.d, rb.d)} of the denominators`],
      ['Lowest common denominator', `${lcm} — A becomes ${ra.n * (lcm / ra.d)}/${lcm}, B becomes ${rb.n * (lcm / rb.d)}/${lcm}`],
      ['Comparing them', comparison],
      ['How much bigger', diff.d === 1n ? `${diff.n}` : `${diff.n}/${diff.d} (${decimalText(diff.n, diff.d)})`]
    ];
    insightBox.replaceChildren(...rows.map(([label, value]) =>
      el('div', { class: 'frac-insight-row' },
        el('span', { class: 'frac-insight-label' }, label),
        el('span', { class: 'frac-insight-value' }, value))
    ));
  }

  /** Three pies side by side: A, B and the fractional part of the result. */
  function renderPies(a, b, c, d, n, den) {
    const cell = (label, num, dd) => el('div', { class: 'frac-pie-cell' },
      el('span', { class: 'gfield-label' }, label),
      (() => { const holder = el('span'); holder.innerHTML = pieSVG(num, dd); return holder; })()
    );
    const ra = reduce(a, b);
    const rb = reduce(c, d);
    const rem = (n < 0n ? -n : n) % den;
    pieWrap.replaceChildren(
      cell('A', ra.n, ra.d),
      cell('B', rb.n, rb.d),
      cell('Result', rem === 0n && n !== 0n ? den : rem, den)
    );
  }

  function compute() {
    try {
      const rawA = boxA.numIn.value.trim(), rawB = boxA.denIn.value.trim();
      const rawC = boxB.numIn.value.trim(), rawD = boxB.denIn.value.trim();
      if (![rawA, rawB, rawC, rawD].every(r => /^[+-]?\d+$/.test(r) && r.length < 40)) {
        throw new Error('Enter whole numbers in every fraction box.');
      }
      const a = BigInt(rawA), b = BigInt(rawB), c = BigInt(rawC), d = BigInt(rawD);
      if (b === 0n || d === 0n) throw new Error('Denominators cannot be zero!');

      let n, den, working;
      if (op === '+') {
        n = a * d + c * b; den = b * d;
        working = `${a * d}/${b * d} + ${c * b}/${b * d} = ${n}/${den}`;
      } else if (op === '-') {
        n = a * d - c * b; den = b * d;
        working = `${a * d}/${b * d} − ${c * b}/${b * d} = ${n}/${den}`;
      } else if (op === '*') {
        n = a * c; den = b * d;
        working = `${a}×${c} over ${b}×${d} = ${n}/${den}`;
      } else if (op === '/') {
        if (c === 0n) throw new Error('Cannot divide by a zero fraction!');
        n = a * d; den = b * c;
        working = `${a}/${b} × ${d}/${c} = ${n}/${den}`;
      } else if (op === 'avg') {
        n = a * d + c * b; den = b * d * 2n;
        working = `(${a}/${b} + ${c}/${d}) ÷ 2 = ${a * d + c * b}/${b * d * 2n}`;
      } else if (op === 'delta') {
        n = a * d - c * b; den = b * d;
        if (n < 0n) n = -n;
        working = `|${a}/${b} − ${c}/${d}| = ${n}/${den < 0n ? -den : den}`;
        if (den < 0n) den = -den;
      } else if (op === 'percent') {
        if (c === 0n) throw new Error('Cannot take a percentage of a zero fraction!');
        n = a * d; den = b * c;
        working = `${a}/${b} ÷ ${c}/${d} × 100`;
      } else {
        if (a === 0n) throw new Error('Zero has no reciprocal!');
        n = b; den = a;
        working = `flip ${a}/${b} upside down`;
      }
      if (den < 0n) { n = -n; den = -den; }
      const g = gcdBig(n, den) || 1n;
      n /= g; den /= g;

      resultDetail.classList.remove('error');
      resultFrac.replaceChildren(
        el('div', { class: 'frac-stacked' },
          el('span', {}, String(n)),
          el('i'),
          el('span', {}, String(den))
        )
      );
      const percentLine = op === 'percent'
        ? `\nPercent: ${decimalText(n * 100n, den)}%`
        : `\nDecimal: ${decimalText(n, den)}  •  Percent: ${decimalText(n * 100n, den)}%`;
      resultDetail.textContent = `${mixedText(n, den)}${percentLine}`;
      workingEl.textContent = `${working}${g === 1n ? '' : `  →  divide top and bottom by ${g}  →  ${n}/${den}`}`;
      renderPies(a, b, c, d, n, den);
      renderInsights(a, b, c, d);
    } catch (e) {
      resultDetail.classList.add('error');
      resultDetail.textContent = e.message;
      resultFrac.replaceChildren();
      workingEl.textContent = '';
      pieWrap.replaceChildren();
      insightBox.replaceChildren();
    }
  }

  root.replaceChildren(
    el('div', { class: 'game-panel' },
      el('div', { class: 'frac-stage' }, boxA.el, opTabs.el, boxB.el),
      el('div', { class: 'frac-output-card' }, resultFrac, pieWrap, resultDetail, workingEl),
      insightBox
    )
  );
  compute();
}

// =========================================================================
// 5. PERCENTAGE CALCULATOR — Cozy Shop Price Tag: nine percentage jobs, each
//    showing the arithmetic behind its answer.
// =========================================================================
/**
 * Nine percentage jobs. Each mode names its two fields, works out the answer
 * and shows the arithmetic it used, because a percentage tool that only prints
 * a number teaches nobody anything. `run` returns either { big, text, working,
 * fill } or { error } — a percentage calculator has to be able to refuse.
 */
const PCT_MODES = Object.freeze({
  of: {
    tab: 'A% of B', icon: '🏷️', a: 'Percent A (%)', b: 'Of Value B', percentA: true,
    run: (a, b) => {
      const res = (a / 100) * b;
      return { big: numberText(res), text: `${numberText(a)}% of ${numberText(b)} = ${numberText(res)}`, working: `${numberText(b)} × ${numberText(a)} ÷ 100`, fill: a };
    }
  },
  what: {
    tab: 'A is ?% of B', icon: '🥧', a: 'Part A', b: 'Whole B', percentA: false,
    run: (a, b) => {
      if (b === 0) return { error: 'Whole B cannot be zero.' };
      const pct = (a / b) * 100;
      return { big: `${numberText(pct)}%`, text: `${numberText(a)} is ${numberText(pct)}% of ${numberText(b)}`, working: `${numberText(a)} ÷ ${numberText(b)} × 100`, fill: pct };
    }
  },
  change: {
    tab: '% Change', icon: '📈', a: 'Original A', b: 'New Value B', percentA: false,
    run: (a, b) => {
      if (a === 0) return { error: 'Original value A cannot be zero.' };
      const chg = ((b - a) / Math.abs(a)) * 100;
      return {
        big: `${chg >= 0 ? '+' : ''}${numberText(chg)}%`,
        text: `${chg >= 0 ? '+' : ''}${numberText(chg)}% change (difference ${numberText(b - a)}) — ${chg >= 0 ? 'a rise' : 'a fall'}`,
        working: `(${numberText(b)} − ${numberText(a)}) ÷ |${numberText(a)}| × 100`,
        fill: Math.abs(chg)
      };
    }
  },
  discount: {
    tab: 'Sale Discount', icon: '🛍️', a: 'Discount (%)', b: 'Price', percentA: true,
    run: (a, b) => {
      const saved = (a / 100) * b;
      return {
        big: numberText(b - saved),
        text: `Pay ${numberText(b - saved)}   •   You save ${numberText(saved)} (${numberText(a)}% off ${numberText(b)})`,
        working: `${numberText(b)} − (${numberText(b)} × ${numberText(a)} ÷ 100)`,
        fill: 100 - a
      };
    }
  },
  tip: {
    tab: 'Add % / Tip', icon: '🪙', a: 'Add / Tip (%)', b: 'Subtotal', percentA: true,
    run: (a, b) => {
      const added = (a / 100) * b;
      return {
        big: numberText(b + added),
        text: `Total ${numberText(b + added)}   •   Added ${numberText(added)} (+${numberText(a)}%)`,
        working: `${numberText(b)} × (1 + ${numberText(a)} ÷ 100)`,
        fill: a
      };
    }
  },
  reverse: {
    tab: 'B is A% of what?', icon: '🔍', a: 'Percent A (%)', b: 'The Part B', percentA: true,
    run: (a, b) => {
      if (a === 0) return { error: 'Zero percent of anything is zero, so the whole cannot be found.' };
      const whole = b / (a / 100);
      return {
        big: numberText(whole),
        text: `${numberText(b)} is ${numberText(a)}% of ${numberText(whole)}`,
        working: `${numberText(b)} ÷ (${numberText(a)} ÷ 100)`,
        fill: a
      };
    }
  },
  extract: {
    tab: 'Take A% out of B', icon: '🧾', a: 'Tax / Fee (%)', b: 'Price Including It', percentA: true,
    run: (a, b) => {
      if (a === -100) return { error: 'A price cannot include −100% tax.' };
      const net = b / (1 + a / 100);
      return {
        big: numberText(net),
        text: `Before tax ${numberText(net)}   •   The ${numberText(a)}% inside it is ${numberText(b - net)}`,
        working: `${numberText(b)} ÷ (1 + ${numberText(a)} ÷ 100)`,
        fill: 100 - a
      };
    }
  },
  margin: {
    tab: 'Margin & Markup', icon: '🏪', a: 'What It Cost You', b: 'What You Sold It For', percentA: false,
    run: (a, b) => {
      if (b === 0) return { error: 'The selling price cannot be zero.' };
      if (a === 0) return { error: 'Markup needs a cost that is not zero.' };
      const profit = b - a;
      const margin = (profit / b) * 100;
      const markup = (profit / a) * 100;
      return {
        big: `${numberText(margin)}%`,
        text: `Margin ${numberText(margin)}%   •   Markup ${numberText(markup)}%   •   Profit ${numberText(profit)}`,
        working: `margin = profit ÷ selling price, markup = profit ÷ cost — same ${numberText(profit)}, two different bases`,
        fill: margin
      };
    }
  },
  compound: {
    tab: 'A% Repeated B Times', icon: '📚', a: 'Rate Each Time (%)', b: 'How Many Times', percentA: true,
    run: (a, b) => {
      const factor = (1 + a / 100) ** b;
      if (!Number.isFinite(factor)) return { error: 'That grows past any number this tool can print.' };
      const overall = (factor - 1) * 100;
      return {
        big: `${overall >= 0 ? '+' : ''}${numberText(overall)}%`,
        text: `${numberText(a)}% applied ${numberText(b)} times multiplies by ${numberText(factor)} — ${overall >= 0 ? 'a rise' : 'a fall'} of ${numberText(Math.abs(overall))}% in total, not ${numberText(Math.abs(a * b))}%`,
        working: `(1 + ${numberText(a)} ÷ 100) ^ ${numberText(b)}`,
        fill: Math.abs(overall)
      };
    }
  }
});

const PCT_COINS = [1, 5, 7.5, 10, 12.5, 15, 20, 25, 30, 50, 75, 100];

function percentage(root) {
  let mode = 'of';
  const aField = createGameField({ label: 'Percent (%)', value: '20', inputmode: 'decimal', onInput: update });
  const bField = createGameField({ label: 'Amount', value: '150', inputmode: 'decimal', onInput: update });
  const out = el('div', { class: 'output', 'aria-live': 'polite' });
  const working = el('div', { class: 'pct-working' });
  const barFill = el('div', { class: 'pct-fill' });
  const priceTagBig = el('div', { class: 'price-tag-val' }, '30');

  const modeTabs = createGameTabs({
    items: Object.entries(PCT_MODES).map(([value, m]) => ({ value, label: m.tab, icon: m.icon })),
    value: 'of',
    onChange: v => { playPop(540); mode = v; syncMode(); }
  });

  const coinRow = el('div', { class: 'preset-row' },
    PCT_COINS.map(p =>
      el('button', {
        type: 'button',
        class: 'gbtn gbtn-coin',
        onclick: () => { playPop(640); aField.input.value = String(p); update(); }
      }, `${p}%`)
    )
  );

  function syncMode() {
    const m = PCT_MODES[mode];
    aField.el.querySelector('.gfield-label').textContent = m.a;
    bField.el.querySelector('.gfield-label').textContent = m.b;
    aField.input.setAttribute('aria-label', m.a);
    bField.input.setAttribute('aria-label', m.b);
    // The coin row is a shortcut for a percentage, so it only shows up when A is one.
    coinRow.hidden = !m.percentA;
    update();
  }

  function update() {
    const cfg = PCT_MODES[mode];
    const rawA = aField.input.value.trim();
    const rawB = bField.input.value.trim();
    const a = Number(rawA);
    const b = Number(rawB);
    if (!rawA || !rawB || !Number.isFinite(a) || !Number.isFinite(b)) {
      out.classList.add('error');
      out.textContent = 'Enter valid numbers in both boxes.';
      working.textContent = '';
      priceTagBig.textContent = '?';
      barFill.style.width = '0%';
      return;
    }
    out.classList.remove('error');
    let result;
    try {
      // numberText throws on anything non-finite, and a wild input such as
      // 1e300 % of 1e300 would otherwise break out of the input handler.
      result = cfg.run(a, b);
    } catch (e) {
      out.classList.add('error');
      out.textContent = e.message;
      working.textContent = '';
      priceTagBig.textContent = '—';
      barFill.style.width = '0%';
      return;
    }
    if (result.error) {
      out.classList.add('error');
      out.textContent = result.error;
      working.textContent = '';
      priceTagBig.textContent = '—';
      barFill.style.width = '0%';
      return;
    }
    priceTagBig.textContent = result.big;
    out.textContent = result.text;
    working.textContent = result.working;
    barFill.style.width = `${Math.min(100, Math.max(0, Number(result.fill) || 0))}%`;
  }

  const tagIcon = `<svg class="game-svg" width="52" height="52" viewBox="0 0 64 64" fill="none"><path d="M12 18 L38 10 L55 30 L33 54 L10 34 Z" fill="#ffe184" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/><circle cx="22" cy="24" r="3.5" fill="#fff8e8" stroke="${INK}" stroke-width="2.5"/><circle cx="30" cy="31" r="4" fill="#ff9e85" stroke="${INK}" stroke-width="2.2"/><circle cx="40" cy="37" r="4" fill="#8fd3a4" stroke="${INK}" stroke-width="2.2"/><line x1="40" y1="25" x2="29" y2="43" stroke="${INK}" stroke-width="3" stroke-linecap="round"/></svg>`;
  const iconHolder = el('span');
  iconHolder.innerHTML = tagIcon;

  root.replaceChildren(
    el('div', { class: 'game-panel' },
      el('div', { class: 'pct-head' },
        iconHolder,
        el('div', { style: 'flex:1' }, el('strong', {}, 'Cozy Bakery Discount Tag'), el('p', {}, 'Tap a gold coin or enter numbers')),
        el('div', { class: 'hanging-price-tag' }, el('span', { class: 'tag-hole' }), priceTagBig)
      ),
      modeTabs.el,
      coinRow,
      el('div', { class: 'two-col' }, aField.el, bField.el),
      el('div', { class: 'pct-bar' }, barFill),
      out,
      working
    )
  );
  syncMode();
}

// =========================================================================
// 6. DICE ROLLER — 2.5D Felt Tray + Bouncing Custom Dice
// =========================================================================
function secureRandInt(maxExclusive) {
  if (globalThis.crypto?.getRandomValues) {
    const arr = new Uint32Array(1);
    const limit = 0x100000000 - (0x100000000 % maxExclusive);
    let r;
    do { globalThis.crypto.getRandomValues(arr); r = arr[0]; } while (r >= limit);
    return r % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

function diceRoller(root) {
  let dice = [
    { faces: ['1', '2', '3', '4', '5', '6'], current: 5, color: '#fff4da' },
    { faces: ['1', '2', '3', '4', '5', '6'], current: 2, color: '#ffd8c2' }
  ];
  let selectedIdx = 0;

  const trayEl = el('div', { class: 'dice-tray' });
  const summaryEl = el('div', { class: 'output', 'aria-live': 'polite' });
  const editorWrap = el('div', { class: 'dice-editor pastel-card cream' });

  const palette = ['#fff4da', '#ffd8c2', '#d7f0d2', '#cbe5fa', '#ead7f7', '#ffe29a'];

  function renderPipsOrText(face) {
    const pipLayouts = {
      '1': [[50, 50]],
      '2': [[28, 28], [72, 72]],
      '3': [[28, 28], [50, 50], [72, 72]],
      '4': [[28, 28], [72, 28], [28, 72], [72, 72]],
      '5': [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
      '6': [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]]
    };
    if (pipLayouts[face]) {
      return el('div', { class: 'die-pips' },
        pipLayouts[face].map(([x, y]) => el('span', { class: 'die-pip', style: `left:${x}%;top:${y}%` }))
      );
    }
    return el('span', { class: 'die-face-text' }, face);
  }

  function renderTray(bouncing = false) {
    trayEl.replaceChildren(...dice.map((d, idx) => {
      const face = d.faces[d.current] ?? '?';
      return el('button', {
        type: 'button',
        class: `die-25d ${idx === selectedIdx ? 'is-selected' : ''} ${bouncing ? 'die-bounce' : ''}`,
        style: `background:${d.color};animation-delay:${idx * 35}ms`,
        'aria-label': `Die ${idx + 1} showing ${face}. Tap to edit faces.`,
        onclick: () => { playPop(520); selectedIdx = idx; renderTray(); renderEditor(); }
      },
        el('span', { class: 'die-tag' }, `D${d.faces.length}`),
        renderPipsOrText(face)
      );
    }));

    const shown = dice.map(d => d.faces[d.current] ?? '?');
    const numeric = shown.map(x => Number(x)).filter(x => Number.isFinite(x));
    const sumText = numeric.length === shown.length && shown.length ? `  •  Total = ${numeric.reduce((a, b) => a + b, 0)}` : '';
    summaryEl.textContent = `Rolled: ${shown.join(' , ')}${sumText}`;
  }

  function renderEditor() {
    const d = dice[selectedIdx];
    if (!d) return;
    const faceChips = el('div', { class: 'face-grid' },
      d.faces.map((f, fi) => {
        const inp = el('input', {
          type: 'text',
          class: 'face-edit-input',
          value: f,
          maxlength: 14,
          'aria-label': `Face ${fi + 1}`,
          oninput: e => { d.faces[fi] = e.target.value || '?'; renderTray(); }
        });
        const del = d.faces.length > 2 ? el('button', {
          type: 'button',
          class: 'gbtn gbtn-mini danger',
          'aria-label': `Remove face ${fi + 1}`,
          onclick: () => {
            playPop(380);
            d.faces.splice(fi, 1);
            if (d.current >= d.faces.length) d.current = 0;
            renderTray(); renderEditor();
          }
        }, '×') : null;
        return el('div', { class: 'face-chip' }, inp, del);
      })
    );

    const presets = [
      ['D4', ['1', '2', '3', '4']],
      ['D6', ['1', '2', '3', '4', '5', '6']],
      ['D8', ['1', '2', '3', '4', '5', '6', '7', '8']],
      ['D12', Array.from({ length: 12 }, (_, i) => String(i + 1))],
      ['D20', Array.from({ length: 20 }, (_, i) => String(i + 1))],
      ['Coin', ['Heads', 'Tails']],
      ['Snacks', ['Waffle', 'Pancake', 'Berry', 'Honey', 'Toast', 'Cookie']]
    ];

    editorWrap.replaceChildren(
      el('div', { class: 'dice-ed-head' },
        el('strong', {}, `Editing Die #${selectedIdx + 1} (${d.faces.length} faces)`),
        el('button', {
          type: 'button',
          class: 'gbtn gbtn-mini',
          onclick: () => { playPop(580); d.faces.push(String(d.faces.length + 1)); renderTray(); renderEditor(); }
        }, '+ Add Face')
      ),
      el('div', { class: 'preset-row' },
        presets.map(([name, faces]) =>
          el('button', {
            type: 'button',
            class: 'gbtn gbtn-chip',
            onclick: () => { playPop(540); d.faces = [...faces]; d.current = 0; renderTray(); renderEditor(); }
          }, name)
        )
      ),
      faceChips
    );
  }

  function rollAll() {
    playDiceRoll();
    for (const d of dice) d.current = secureRandInt(d.faces.length);
    renderTray(true);
  }

  const controls = el('div', { class: 'dice-controls' },
    el('button', { type: 'button', class: 'gbtn gbtn-primary dice-roll-btn', onclick: rollAll }, '🎲 ROLL DICE!'),
    el('button', {
      type: 'button',
      class: 'gbtn',
      onclick: () => {
        if (dice.length >= 8) return;
        playPop(600);
        dice.push({ faces: ['1', '2', '3', '4', '5', '6'], current: secureRandInt(6), color: palette[dice.length % palette.length] });
        selectedIdx = dice.length - 1;
        renderTray(true); renderEditor();
      }
    }, '+ Die'),
    el('button', {
      type: 'button',
      class: 'gbtn',
      onclick: () => {
        if (dice.length <= 1) return;
        playPop(420);
        dice.splice(selectedIdx, 1);
        selectedIdx = Math.min(selectedIdx, dice.length - 1);
        renderTray(); renderEditor();
      }
    }, '− Die')
  );

  root.replaceChildren(
    el('div', { class: 'game-panel' },
      controls,
      trayEl,
      summaryEl,
      editorWrap
    )
  );
  renderTray();
  renderEditor();
}

// =========================================================================
// 7. ROMAN NUMERAL CALCULATOR (PARCHMENT + VINCULUM OVERLINE)
// =========================================================================
const ROMAN_PAIRS = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
];

function intToRomanParts(n) {
  if (!Number.isSafeInteger(n) || n < 1 || n > 3999999) {
    throw new Error('Roman numerals support whole numbers from 1 to 3,999,999.');
  }
  const thousands = Math.floor(n / 1000);
  const units = n % 1000;
  let over = '';
  let base = '';
  if (n >= 4000) {
    let t = thousands;
    for (const [val, sym] of ROMAN_PAIRS) { while (t >= val) { over += sym; t -= val; } }
    let u = units;
    for (const [val, sym] of ROMAN_PAIRS) { while (u >= val) { base += sym; u -= val; } }
  } else {
    let rem = n;
    for (const [val, sym] of ROMAN_PAIRS) { while (rem >= val) { base += sym; rem -= val; } }
  }
  return { over, base };
}

function renderRomanNode(n) {
  const { over, base } = intToRomanParts(n);
  const frag = el('span', { class: 'roman-display' });
  if (over) frag.append(el('span', { class: 'vinculum' }, over));
  if (base) frag.append(el('span', {}, base));
  return frag;
}

function parseRomanInput(raw) {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!cleaned) throw new Error('Enter a Roman numeral (use _V or V̅ for ×1,000).');
  const tokens = [];
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === '_') {
      const next = cleaned[i + 1];
      if (!next || !'IVXLCDM'.includes(next)) throw new Error('Place _ before I, V, X, L, C, D, or M.');
      tokens.push({ sym: next, vinc: true });
      i++;
    } else if ('IVXLCDM'.includes(ch)) {
      const hasOver = cleaned[i + 1] === '\u0305' || cleaned[i + 1] === '\u0304';
      tokens.push({ sym: ch, vinc: hasOver });
      if (hasOver) i++;
    } else if (ch === '\u0305' || ch === '\u0304') {
      continue;
    } else {
      throw new Error(`Invalid Roman character “${ch}”.`);
    }
  }
  const vals = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < tokens.length; i++) {
    const cur = vals[tokens[i].sym] * (tokens[i].vinc ? 1000 : 1);
    const nxt = i + 1 < tokens.length ? vals[tokens[i + 1].sym] * (tokens[i + 1].vinc ? 1000 : 1) : 0;
    if (cur < nxt) { total += nxt - cur; i++; }
    else { total += cur; }
  }
  if (total < 1 || total > 3999999) throw new Error('Value must be between 1 and 3,999,999.');
  return total;
}

function romanNumerals(root) {
  let tab = 'convert';
  let op = '+';

  const modeTabs = createGameTabs({
    items: [
      { value: 'convert', label: 'Convert (↔)', icon: '📜' },
      { value: 'calc', label: 'Roman Math (+ − × ÷)', icon: '⚖️' }
    ],
    value: 'convert',
    onChange: v => { playPop(520); tab = v; renderMode(); }
  });

  const body = el('div');

  function renderMode() {
    if (tab === 'convert') {
      const decField = createGameField({ label: 'Decimal (1 – 3,999,999)', value: '25400', inputmode: 'numeric' });
      const romField = createGameField({ label: 'Roman (use V̅ or _V for ×1,000)', value: 'X̅X̅V̅CD' });
      const scrollOut = el('div', { class: 'parchment-result', 'aria-live': 'polite' });

      const syncFromDec = () => {
        try {
          const n = Number(decField.input.value.trim());
          integerCheck(n, 'Number', 1, 3999999);
          const { over, base } = intToRomanParts(n);
          romField.input.value = [...over].map(c => c + '\u0305').join('') + base;
          scrollOut.replaceChildren(
            el('div', { class: 'roman-big' }, renderRomanNode(n)),
            el('div', { class: 'roman-sub' }, `= ${n.toLocaleString()}  ${over ? '•  Overline (vinculum) multiplies by 1,000' : ''}`)
          );
        } catch (e) {
          scrollOut.replaceChildren(el('span', { class: 'error' }, e.message));
        }
      };

      const syncFromRom = () => {
        try {
          const n = parseRomanInput(romField.input.value);
          decField.input.value = String(n);
          scrollOut.replaceChildren(
            el('div', { class: 'roman-big' }, renderRomanNode(n)),
            el('div', { class: 'roman-sub' }, `= ${n.toLocaleString()}`)
          );
        } catch (e) {
          scrollOut.replaceChildren(el('span', { class: 'error' }, e.message));
        }
      };

      decField.input.addEventListener('input', syncFromDec);
      romField.input.addEventListener('input', syncFromRom);

      const tileSyms = [
        ['I', 'I'], ['V', 'V'], ['X', 'X'], ['L', 'L'], ['C', 'C'], ['D', 'D'], ['M', 'M'],
        ['V̅', 'V\u0305'], ['X̅', 'X\u0305'], ['L̅', 'L\u0305'], ['C̅', 'C\u0305'], ['D̅', 'D\u0305'], ['M̅', 'M\u0305'], ['Clear', '']
      ];
      const pad = el('div', { class: 'preset-row' },
        tileSyms.map(([lbl, ins]) =>
          el('button', {
            type: 'button',
            class: `gbtn gbtn-chip ${lbl.length > 1 && lbl !== 'Clear' ? 'vinc-chip' : ''}`,
            onclick: () => {
              playPop(480);
              if (lbl === 'Clear') romField.input.value = '';
              else romField.input.value += ins;
              syncFromRom();
            }
          }, lbl)
        )
      );

      body.replaceChildren(
        el('div', { class: 'two-col' }, decField.el, romField.el),
        pad,
        scrollOut
      );
      syncFromDec();
    } else {
      const aField = createGameField({ label: 'First Roman Numeral', value: 'V\u0305CC' });
      const bField = createGameField({ label: 'Second Roman Numeral', value: 'MCC' });
      const scrollOut = el('div', { class: 'parchment-result', 'aria-live': 'polite' });
      const opTabs = createGameTabs({
        items: [
          { value: '+', label: '+' },
          { value: '-', label: '−' },
          { value: '*', label: '×' },
          { value: '/', label: '÷' }
        ],
        value: op,
        onChange: v => { playPop(540); op = v; calcRoman(); }
      });

      const calcRoman = () => {
        try {
          const a = parseRomanInput(aField.input.value);
          const b = parseRomanInput(bField.input.value);
          let res;
          if (op === '+') res = a + b;
          else if (op === '-') res = a - b;
          else if (op === '*') res = a * b;
          else res = Math.floor(a / b);
          if (res < 1 || res > 3999999) throw new Error(`Result (${res}) is outside 1 – 3,999,999.`);
          scrollOut.replaceChildren(
            el('div', { class: 'roman-big' }, renderRomanNode(res)),
            el('div', { class: 'roman-sub' }, `${a.toLocaleString()} ${op} ${b.toLocaleString()} = ${res.toLocaleString()}${op === '/' && a % b ? ` (remainder ${a % b})` : ''}`)
          );
        } catch (e) {
          scrollOut.replaceChildren(el('span', { class: 'error' }, e.message));
        }
      };
      aField.input.addEventListener('input', calcRoman);
      bField.input.addEventListener('input', calcRoman);

      body.replaceChildren(
        el('div', { class: 'two-col' }, aField.el, bField.el),
        opTabs.el,
        scrollOut
      );
      calcRoman();
    }
  }

  root.replaceChildren(
    el('div', { class: 'game-panel parchment-panel' },
      el('div', { class: 'parchment-curl top' }),
      modeTabs.el,
      body,
      el('div', { class: 'parchment-curl bottom' })
    )
  );
  renderMode();
}

// =========================================================================
// 8. NUMBER BASE CONVERTER (2, 8, 10, 16, 36 + Tappable 8-Bit Lamp Row)
// =========================================================================
function parseBigIntInBase(str, base) {
  let s = str.trim().toLowerCase();
  if (!s) return 0n;
  let sign = 1n;
  if (s[0] === '-') { sign = -1n; s = s.slice(1); }
  else if (s[0] === '+') { s = s.slice(1); }
  if (!s) return 0n;
  if (s.length > 200) throw new Error('Max 200 digits.');
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
  let val = 0n;
  const b = BigInt(base);
  for (const ch of s) {
    const idx = alphabet.indexOf(ch);
    if (idx < 0 || idx >= base) throw new Error(`“${ch.toUpperCase()}” is not valid in Base ${base}.`);
    val = val * b + BigInt(idx);
  }
  return val * sign;
}

function numberBase(root) {
  const bases = [
    { base: 2, name: 'Binary (Base 2)', color: '#d7f0d2' },
    { base: 8, name: 'Octal (Base 8)', color: '#cbe5fa' },
    { base: 10, name: 'Decimal (Base 10)', color: '#ffe5a8' },
    { base: 16, name: 'Hexadecimal (Base 16)', color: '#ffd8c2' },
    { base: 36, name: 'Base-36 (0–Z)', color: '#ead7f7' }
  ];

  let activeBase = 10;
  let currentVal = 255n;
  const inputs = new Map();
  const status = el('div', { class: 'output', 'aria-live': 'polite' });
  const bitRow = el('div', { class: 'bit-switch-row' });
  const padWrap = el('div', { class: 'base-pad' });

  function renderBits() {
    const abs = currentVal < 0n ? -currentVal : currentVal;
    const buttons = [];
    for (let bit = 7; bit >= 0; bit--) {
      const mask = 1n << BigInt(bit);
      const isOn = (abs & mask) !== 0n;
      buttons.push(
        el('button', {
          type: 'button',
          class: `gbtn bit-pill ${isOn ? 'is-on' : ''}`,
          onclick: () => {
            playPop(isOn ? 420 : 620);
            const next = abs ^ mask;
            const signed = currentVal < 0n ? -next : next;
            inputs.get(10).value = String(signed);
            updateFrom(10, String(signed));
          }
        }, el('small', {}, `2^${bit}`), el('strong', {}, isOn ? '1' : '0'))
      );
    }
    bitRow.replaceChildren(...buttons);
  }

  function updateFrom(sourceBase, raw) {
    try {
      const val = parseBigIntInBase(raw, sourceBase);
      currentVal = val;
      for (const b of bases) {
        if (b.base !== sourceBase) {
          inputs.get(b.base).value = val.toString(b.base).toUpperCase();
        }
      }
      const bin = (val < 0n ? (-val).toString(2) : val.toString(2));
      const grouped = bin.padStart(Math.ceil(bin.length / 4) * 4, '0').replace(/(.{4})/g, '$1 ').trim();
      status.classList.remove('error');
      status.textContent = `Decimal: ${val}  •  Nibbles: ${val < 0n ? '-' : ''}${grouped}`;
      renderBits();
    } catch (e) {
      status.classList.add('error');
      status.textContent = e.message;
    }
  }

  function renderKeypad() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, activeBase).split('');
    padWrap.replaceChildren(
      el('div', { class: 'gfield-label' }, `Quick Keypad for Base ${activeBase}`),
      el('div', { class: 'preset-row' },
        chars.map(ch => el('button', {
          type: 'button',
          class: 'gbtn gbtn-mini',
          onclick: () => {
            playPop(540);
            const inp = inputs.get(activeBase);
            inp.value = (inp.value === '0' ? '' : inp.value) + ch;
            updateFrom(activeBase, inp.value);
          }
        }, ch)),
        el('button', {
          type: 'button',
          class: 'gbtn gbtn-mini warn',
          onclick: () => {
            playPop(400);
            const inp = inputs.get(activeBase);
            inp.value = inp.value.slice(0, -1) || '0';
            updateFrom(activeBase, inp.value);
          }
        }, '⌫'),
        el('button', {
          type: 'button',
          class: 'gbtn gbtn-mini danger',
          onclick: () => {
            playSquish();
            const inp = inputs.get(activeBase);
            inp.value = '0';
            updateFrom(activeBase, '0');
          }
        }, 'C')
      )
    );
  }

  const cards = bases.map(b => {
    const inp = el('input', {
      type: 'text',
      class: 'gfield-input base-input',
      value: (255).toString(b.base).toUpperCase(),
      autocomplete: 'off',
      spellcheck: 'false',
      'aria-label': b.name,
      onfocus: () => { activeBase = b.base; highlightActive(); renderKeypad(); },
      oninput: () => { activeBase = b.base; highlightActive(); updateFrom(b.base, inp.value); }
    });
    inputs.set(b.base, inp);
    return el('div', { class: 'base-card', style: `background:${b.color}`, 'data-base': b.base },
      el('span', { class: 'gfield-label' }, b.name),
      el('div', { class: 'gfield-tray' }, inp)
    );
  });

  function highlightActive() {
    cards.forEach(c => c.classList.toggle('is-active', Number(c.getAttribute('data-base')) === activeBase));
  }

  root.replaceChildren(
    el('div', { class: 'game-panel' },
      el('div', { class: 'gfield-label' }, 'Tap Bits to Flip (8-bit Toy Switches)'),
      bitRow,
      el('div', { class: 'base-grid' }, ...cards),
      padWrap,
      status
    )
  );
  highlightActive();
  renderKeypad();
  updateFrom(10, '255');
}

// =========================================================================
// 9. PRIME NUMBER CHECKER — Collectible Prime Card + Factor Blocks
// =========================================================================
function modPow(a, d, n) {
  let r = 1n;
  while (d > 0n) {
    if (d & 1n) r = (r * a) % n;
    a = (a * a) % n;
    d >>= 1n;
  }
  return r;
}

function isPrimeBig(n) {
  if (n < 2n) return false;
  for (const p of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) {
    if (n === p) return true;
    if (n % p === 0n) return false;
  }
  let d = n - 1n, s = 0;
  while (d % 2n === 0n) { d /= 2n; s++; }
  for (let a of [2n, 325n, 9375n, 28178n, 450775n, 9780504n, 1795265022n]) {
    a %= n;
    if (!a) continue;
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    let witness = true;
    for (let r = 1; r < s; r++) {
      x = (x * x) % n;
      if (x === n - 1n) { witness = false; break; }
    }
    if (witness) return false;
  }
  return true;
}

function smallFactorize(n) {
  const factors = [];
  let rem = n;
  for (let p = 2n; p * p <= rem && p <= 50000n; p += p === 2n ? 1n : 2n) {
    let count = 0;
    while (rem % p === 0n) { rem /= p; count++; }
    if (count) factors.push([p, count]);
  }
  if (rem > 1n) factors.push([rem, 1, !isPrimeBig(rem)]);
  return factors;
}

function primeChecker(root) {
  const numField = createGameField({ label: 'Check Any Whole Number (up to 2⁶⁴ − 1)', value: '97', inputmode: 'numeric', onInput: check });
  const cardEl = el('div', { class: 'prime-card' });
  const confettiLayer = el('div', { class: 'prime-confetti', 'aria-hidden': 'true' });

  function burstConfetti() {
    confettiLayer.replaceChildren();
    const colors = ['#ffbfa3', '#ffe082', '#b8e3b3', '#bfe3ff', '#e4c7f5'];
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * 2 * PI;
      const dist = 55 + (i % 3) * 30;
      confettiLayer.append(el('span', {
        class: 'confetti-sprinkle',
        style: `background:${colors[i % colors.length]};--tx:${Math.cos(angle) * dist}px;--ty:${Math.sin(angle) * dist}px`
      }));
    }
  }

  function stepPrime(dir) {
    try {
      let n = BigInt(numField.input.value.trim() || '2') + BigInt(dir);
      if (n < 2n) n = 2n;
      while (!isPrimeBig(n) && n < 18446744073709551615n) n += BigInt(dir);
      numField.input.value = String(n);
      check(true);
    } catch {}
  }

  function check(withSound = false) {
    const raw = numField.input.value.trim();
    if (!/^\d+$/.test(raw) || raw.length > 20) {
      cardEl.className = 'prime-card is-neutral';
      cardEl.replaceChildren(el('strong', {}, 'Enter a positive integer!'), el('p', {}, 'Numbers from 0 up to 18,446,744,073,709,551,615.'));
      return;
    }
    const n = BigInt(raw);
    if (n > 18446744073709551615n) {
      cardEl.className = 'prime-card is-neutral';
      cardEl.replaceChildren(el('strong', {}, 'Too huge!'), el('p', {}, 'Maximum supported is 2⁶⁴ − 1.'));
      return;
    }
    if (n < 2n) {
      cardEl.className = 'prime-card is-neutral';
      cardEl.replaceChildren(
        el('div', { class: 'prime-big-num' }, String(n)),
        el('span', { class: 'gbadge' }, 'Neither Prime Nor Composite')
      );
      return;
    }

    if (isPrimeBig(n)) {
      if (withSound) playSparkle();
      cardEl.className = 'prime-card is-prime';
      cardEl.replaceChildren(
        confettiLayer,
        el('div', { class: 'prime-mascot' }, '👑'),
        el('div', { class: 'prime-big-num' }, String(n)),
        el('span', { class: 'gbadge prime-yes' }, 'PRIME NUMBER!'),
        el('p', {}, `${n} is indivisible — only 1 and ${n} divide it evenly!`)
      );
      burstConfetti();
    } else {
      if (withSound) playSquish();
      const facs = smallFactorize(n);
      const firstDiv = facs[0][0];
      const blocks = el('div', { class: 'factor-blocks' },
        el('span', { class: 'factor-pill' }, String(firstDiv)),
        el('span', { class: 'factor-times' }, '×'),
        el('span', { class: 'factor-pill' }, String(n / firstDiv))
      );
      const expr = facs.map(([p, c, unfactored]) => `${p}${c > 1 ? `^${c}` : ''}${unfactored ? ' (composite)' : ''}`).join(' × ');
      cardEl.className = 'prime-card is-composite';
      cardEl.replaceChildren(
        el('div', { class: 'prime-mascot split' }, '🧩'),
        el('div', { class: 'prime-big-num' }, String(n)),
        el('span', { class: 'gbadge prime-no' }, 'COMPOSITE'),
        blocks,
        el('div', { class: 'prime-factors' }, `Prime factors: ${expr}`)
      );
    }
  }

  const actions = el('div', { class: 'preset-row' },
    el('button', { type: 'button', class: 'gbtn gbtn-mini', onclick: () => { try { const v = BigInt(numField.input.value || '2') - 1n; numField.input.value = String(v < 0n ? 0n : v); check(true); } catch {} } }, '− 1'),
    el('button', { type: 'button', class: 'gbtn gbtn-mini', onclick: () => { try { numField.input.value = String(BigInt(numField.input.value || '0') + 1n); check(true); } catch {} } }, '+ 1'),
    el('button', { type: 'button', class: 'gbtn gbtn-chip', onclick: () => stepPrime(-1) }, '← Prev Prime'),
    el('button', { type: 'button', class: 'gbtn gbtn-chip', onclick: () => stepPrime(1) }, 'Next Prime →'),
    el('button', { type: 'button', class: 'gbtn gbtn-chip', onclick: () => {
      const sample = [17, 29, 97, 131, 353, 797, 1999, 7919, 104729][secureRandInt(9)];
      numField.input.value = String(sample);
      check(true);
    } }, '✨ Lucky Prime')
  );

  root.replaceChildren(
    el('div', { class: 'game-panel' },
      numField.el,
      actions,
      cardEl
    )
  );
  check(false);
}

// =========================================================================
// 10. SEQUENCE PLAYGROUND — 8 Physical Shelf Tiles + Geometry Visuals
// =========================================================================
function isPrimeNum(n) {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
  return true;
}

function isHappyNum(n) {
  if (n <= 0) return false;
  const seen = new Set();
  let cur = n;
  while (cur !== 1 && !seen.has(cur)) {
    seen.add(cur);
    let sum = 0;
    for (const ch of String(cur)) sum += Number(ch) ** 2;
    cur = sum;
  }
  return cur === 1;
}

function happyChain(n) {
  const path = [n];
  const seen = new Set([n]);
  let cur = n;
  while (cur !== 1 && path.length < 9) {
    let sum = 0;
    for (const ch of String(cur)) sum += Number(ch) ** 2;
    cur = sum;
    path.push(cur);
    if (seen.has(cur)) break;
    seen.add(cur);
  }
  return path.join(' → ');
}

function isPalindromeNum(n) {
  if (n < 0) return false;
  const s = String(n);
  return s === [...s].reverse().join('');
}

const SEQUENCES = [
  {
    id: 'fibonacci', name: 'Fibonacci', color: '#ffd9b8', icon: '🌻',
    rule: 'Each number is the sum of the two before it: F(n) = F(n−1) + F(n−2).',
    generate(count) {
      const out = []; let a = 1, b = 1;
      for (let i = 0; i < count; i++) { out.push(a); [a, b] = [b, a + b]; }
      return out;
    },
    test: n => {
      if (n < 1) return false;
      const isSq = x => { const r = Math.round(Math.sqrt(x)); return r * r === x; };
      return isSq(5 * n * n + 4) || isSq(5 * n * n - 4);
    }
  },
  {
    id: 'triangular', name: 'Triangular', color: '#ffe5a8', icon: '🔺',
    rule: 'Dots arranged in a neat triangle: T(n) = n(n + 1) / 2.',
    generate: count => Array.from({ length: count }, (_, i) => ((i + 1) * (i + 2)) / 2),
    test: n => { if (n < 1) return false; const r = Math.round(Math.sqrt(8 * n + 1)); return r * r === 8 * n + 1; }
  },
  {
    id: 'square', name: 'Square', color: '#cdebc7', icon: '🟩',
    rule: 'A number multiplied by itself: S(n) = n².',
    generate: count => Array.from({ length: count }, (_, i) => (i + 1) ** 2),
    test: n => { if (n < 1) return false; const r = Math.round(Math.sqrt(n)); return r * r === n; }
  },
  {
    id: 'cube', name: 'Cube', color: '#c4e2f7', icon: '🧊',
    rule: 'Three equal numbers multiplied: C(n) = n³.',
    generate: count => Array.from({ length: count }, (_, i) => (i + 1) ** 3),
    test: n => { if (n < 1) return false; const r = Math.round(Math.cbrt(n)); return r * r * r === n; }
  },
  {
    id: 'prime', name: 'Prime', color: '#ffe082', icon: '⭐',
    rule: 'Indivisible whole numbers greater than 1 with only two factors.',
    generate(count) {
      const out = []; let p = 2;
      while (out.length < count) { if (isPrimeNum(p)) out.push(p); p++; }
      return out;
    },
    test: isPrimeNum
  },
  {
    id: 'palindromic', name: 'Palindromic', color: '#f9cad6', icon: '🪞',
    rule: 'Reads the exact same forwards and backwards!',
    generate(count) {
      const out = []; let n = 0;
      while (out.length < count) { if (isPalindromeNum(n)) out.push(n); n++; }
      return out;
    },
    test: isPalindromeNum
  },
  {
    id: 'happy', name: 'Happy numbers', color: '#dfd0f5', icon: '😊',
    rule: 'Sum the squares of digits repeatedly until you reach 1!',
    generate(count) {
      const out = []; let n = 1;
      while (out.length < count) { if (isHappyNum(n)) out.push(n); n++; }
      return out;
    },
    test: isHappyNum
  },
  {
    id: 'perfect', name: 'Perfect numbers', color: '#f7c5ae', icon: '💎',
    rule: 'Equals the sum of all its proper positive divisors (e.g. 6 = 1 + 2 + 3).',
    generate(count) {
      const known = [6, 28, 496, 8128, 33550336, 8589869056, 137438691328];
      return known.slice(0, Math.min(count, known.length));
    },
    test: n => [6, 28, 496, 8128, 33550336, 8589869056, 137438691328].includes(n)
  }
];

function sequenceVisual(seqId) {
  if (seqId === 'triangular') {
    const rows = [1, 2, 3, 4].map(r =>
      el('div', { class: 'dot-row' }, Array.from({ length: r }, () => el('span', { class: 'vis-dot', style: 'background:#ffe082' })))
    );
    return el('div', { class: 'seq-vis-box' }, el('small', {}, 'T(4) = 1+2+3+4 = 10'), ...rows);
  }
  if (seqId === 'square') {
    const grid = el('div', { class: 'vis-square-grid' }, Array.from({ length: 16 }, () => el('span', { class: 'vis-dot', style: 'background:#9fd99e' })));
    return el('div', { class: 'seq-vis-box' }, el('small', {}, '4 × 4 = 16'), grid);
  }
  if (seqId === 'cube') {
    return el('div', { class: 'seq-vis-box' },
      el('small', {}, '3³ = 27 blocks'),
      el('div', { class: 'vis-cube-row' }, '🧊 🧊 🧊')
    );
  }
  if (seqId === 'happy') {
    return el('div', { class: 'seq-vis-box' }, el('small', {}, '19 → 1²+9²=82 → 68 → 100 → 1 😊'));
  }
  if (seqId === 'perfect') {
    return el('div', { class: 'seq-vis-box' }, el('small', {}, '28 = 1 + 2 + 4 + 7 + 14 💎'));
  }
  if (seqId === 'fibonacci') {
    return el('div', { class: 'seq-vis-box' },
      el('small', {}, 'Growing petal steps: 1, 1, 2, 3, 5, 8'),
      el('div', { class: 'vis-bars' }, [1, 1, 2, 3, 5, 8].map(h => el('span', { style: `height:${h * 5 + 8}px` })))
    );
  }
  if (seqId === 'palindromic') {
    return el('div', { class: 'seq-vis-box' }, el('small', {}, '12321 🪞 reads the same reversed!'));
  }
  return el('div', { class: 'seq-vis-box' }, el('small', {}, '2, 3, 5, 7, 11… indivisible stars ⭐'));
}

function sequencePlayground(root) {
  let activeId = 'fibonacci';
  let count = 12;
  let inspectedVal = 28;

  const shelfEl = el('div', { class: 'seq-shelf' });
  const detailBox = el('div', { class: 'seq-detail pastel-card cream' });
  const chipsEl = el('div', { class: 'seq-chips' });
  const inspectEl = el('div', { class: 'output', 'aria-live': 'polite' });

  const countSlider = createGameSlider({
    label: 'Terms on shelf',
    min: 4,
    max: 24,
    step: 1,
    value: 12,
    color: '#ffe082',
    onChange: v => { count = v; renderSequence(); }
  });

  const testField = createGameField({
    label: 'Inspect Any Number',
    value: '28',
    inputmode: 'numeric',
    onInput: val => {
      const n = Number(val.trim());
      if (Number.isSafeInteger(n) && n >= 0) { inspectedVal = n; renderInspector(); }
    }
  });

  function renderShelf() {
    shelfEl.replaceChildren(...SEQUENCES.map(seq =>
      el('button', {
        type: 'button',
        class: `seq-tile ${seq.id === activeId ? 'is-forward' : ''}`,
        style: `background:${seq.color}`,
        'aria-pressed': String(seq.id === activeId),
        onclick: () => {
          playPop(560);
          activeId = seq.id;
          renderShelf();
          renderSequence();
        }
      },
        el('span', { class: 'seq-icon' }, seq.icon),
        el('strong', {}, seq.name)
      )
    ));
  }

  function renderInspector() {
    const matches = SEQUENCES.filter(s => s.test(inspectedVal)).map(s => `${s.icon} ${s.name}`);
    const extra = activeId === 'happy' ? `\nHappy chain: ${happyChain(inspectedVal)}` : '';
    inspectEl.textContent = matches.length
      ? `${inspectedVal} belongs to: ${matches.join('  •  ')}${extra}`
      : `${inspectedVal} is a classic ordinary number!${extra}`;
  }

  function renderSequence() {
    const seq = SEQUENCES.find(s => s.id === activeId);
    const terms = seq.generate(seq.id === 'perfect' ? Math.min(count, 7) : count);
    chipsEl.replaceChildren(...terms.map((val, idx) =>
      el('button', {
        type: 'button',
        class: 'gbtn seq-num-chip',
        style: `background:${seq.color}`,
        onclick: () => {
          playPop(620);
          inspectedVal = val;
          testField.input.value = String(val);
          renderInspector();
        }
      }, el('small', {}, `#${idx + 1}`), el('strong', {}, val.toLocaleString()))
    ));

    detailBox.replaceChildren(
      el('div', { class: 'seq-head' },
        el('span', { class: 'seq-big-icon' }, seq.icon),
        el('div', { style: 'flex:1' },
          el('h3', {}, seq.name),
          el('p', {}, seq.rule)
        ),
        sequenceVisual(seq.id)
      ),
      seq.id === 'perfect' ? el('p', { class: 'seq-note' }, 'Showing the first known even perfect numbers (they grow astronomically fast!).') : null,
      chipsEl
    );
  }

  root.replaceChildren(
    el('div', { class: 'game-panel' },
      el('div', { class: 'seq-shelf-wrap' },
        shelfEl,
        el('div', { class: 'wooden-ledge' })
      ),
      countSlider.el,
      detailBox,
      testField.el,
      inspectEl
    )
  );
  renderShelf();
  renderSequence();
  renderInspector();
}

export { GRAPH_ANALYSIS };

export const MATH_NUMBER_TOOLS = Object.freeze({
  'calculator': calculator,
  'graphing-calculator': graphingCalculator,
  'bodily-calculator': bodilyCalculator,
  'fractions': fractions,
  'percentage': percentage,
  'dice-roller': diceRoller,
  'roman-numerals': romanNumerals,
  'number-base': numberBase,
  'prime-checker': primeChecker,
  'sequence-playground': sequencePlayground
});
