// 10 bespoke 2.5D Mobile-Game Math & Numbers utilities.
import { el, createGameSlider, createGameTabs, createGameToggle, createGameField } from './game-ui.js';

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

/** Safe recursive-descent expression parser (supports x variable for graphing). */
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
    else if (tok === 'x' && xValue !== null) res = xValue;
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
// 1. CALCULATOR
// =========================================================================
function calculator(root) {
  let degrees = false;
  const history = [];

  const exprInput = el('input', {
    type: 'text',
    class: 'calc-expr-input',
    value: '(12 + 8) * 3 / 2',
    placeholder: 'Type or tap buttons…',
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-label': 'Calculator expression'
  });
  const resultOut = el('div', { class: 'output calc-result', 'aria-live': 'polite' }, '30');
  const tapeEl = el('div', { class: 'calc-tape' });

  const angleToggle = createGameToggle({
    checked: false,
    offLabel: 'RAD',
    onLabel: 'DEG',
    label: 'Angle unit',
    onChange: v => { degrees = v; evaluate(); }
  });

  function renderTape() {
    tapeEl.replaceChildren(...history.slice(0, 3).map(item =>
      el('button', {
        type: 'button',
        class: 'gbtn gbtn-chip',
        onclick: () => { exprInput.value = item.expr; evaluate(); }
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
    if (val === 'C') { exprInput.value = ''; evaluate(); return; }
    if (val === '⌫') {
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

  const rows = [
    [['C', 'danger'], ['(', 'soft'], [')', 'soft'], ['⌫', 'warn']],
    [['7', 'num'], ['8', 'num'], ['9', 'num'], ['÷', 'op', '/']],
    [['4', 'num'], ['5', 'num'], ['6', 'num'], ['×', 'op', '*']],
    [['1', 'num'], ['2', 'num'], ['3', 'num'], ['−', 'op', '-']],
    [['0', 'num'], ['.', 'num'], ['^', 'soft'], ['+', 'op', '+']],
    [['sqrt(', 'soft'], ['pi', 'soft'], ['!', 'soft'], ['=', 'eq']]
  ];

  const keypad = el('div', { class: 'calc-keypad' },
    rows.flat().map(([label, style, insert]) =>
      el('button', {
        type: 'button',
        class: `gbtn calc-key key-${style}`,
        'aria-label': label === '⌫' ? 'Backspace' : label === '=' ? 'Calculate equals' : label,
        onclick: () => insertKey(insert ?? label)
      }, label)
    )
  );

  const shell = el('div', { class: 'game-panel calc-shell' },
    el('div', { class: 'calc-top-row' },
      el('span', { class: 'gbadge' }, 'POCKET CALC'),
      angleToggle.el
    ),
    el('div', { class: 'calc-screen' },
      exprInput,
      resultOut
    ),
    tapeEl,
    keypad
  );
  root.replaceChildren(shell);
  evaluate();
}

// =========================================================================
// 2. GRAPHING CALCULATOR
// =========================================================================
function graphingCalculator(root) {
  const slots = [
    { id: 'f', label: 'f(x)', color: '#d96b6b', expr: 'sin(x) + 0.3*x', visible: true },
    { id: 'g', label: 'g(x)', color: '#589c61', expr: '0.2*x^2 - 2', visible: true },
    { id: 'h', label: 'h(x)', color: '#8a6bb8', expr: 'cos(2*x)', visible: false }
  ];
  let activeSlot = 'f';
  let centerX = 0, centerY = 0, scale = 42; // pixels per unit
  let hoverPt = null;

  const canvas = el('canvas', { class: 'graph-canvas', width: 680, height: 390, 'aria-label': '2.5D Graphing calculator grid' });
  const readout = el('div', { class: 'graph-readout' }, 'Tap or hover the 2.5D grid to inspect (x, y)');
  const exprField = createGameField({
    label: 'Formula y =',
    value: slots[0].expr,
    placeholder: 'e.g. sin(x) or x^2 - 3',
    onInput: val => {
      const s = slots.find(x => x.id === activeSlot);
      if (s) { s.expr = val; s.visible = true; syncVisibility(); draw(); }
    }
  });
  const visToggle = createGameToggle({
    checked: true,
    onLabel: 'SHOWN',
    offLabel: 'HIDDEN',
    label: 'Show curve',
    onChange: v => {
      const s = slots.find(x => x.id === activeSlot);
      if (s) { s.visible = v; draw(); }
    }
  });

  function syncVisibility() {
    const s = slots.find(x => x.id === activeSlot);
    if (!s) return;
    visToggle.el.classList.toggle('is-on', s.visible);
    visToggle.el.setAttribute('aria-checked', String(s.visible));
    visToggle.el.querySelector('.gtoggle-text').textContent = s.visible ? 'SHOWN' : 'HIDDEN';
  }

  const tableBox = el('div', { class: 'graph-table', hidden: true });

  const tabs = createGameTabs({
    items: [
      ...slots.map(s => ({ value: s.id, label: s.label, icon: el('span', { class: 'color-dot', style: `background:${s.color}` }) })),
      { value: 'table', label: 'Table' }
    ],
    value: 'f',
    onChange: val => {
      if (val === 'table') {
        tableBox.hidden = false;
        renderTable();
      } else {
        tableBox.hidden = true;
        activeSlot = val;
        const s = slots.find(x => x.id === activeSlot);
        exprField.input.value = s.expr;
        syncVisibility();
      }
    }
  });

  function renderTable() {
    const rows = [];
    for (let x = -4; x <= 4; x += 1) {
      const cells = [el('td', {}, String(x))];
      for (const s of slots) {
        let out = '—';
        if (s.visible && s.expr.trim()) {
          try { out = numberText(evalExpression(s.expr, { xValue: x })); } catch { out = 'undef'; }
        }
        cells.push(el('td', {}, out));
      }
      rows.push(el('tr', {}, ...cells));
    }
    tableBox.replaceChildren(
      el('table', { class: 'gtable' },
        el('thead', {}, el('tr', {}, el('th', {}, 'x'), ...slots.map(s => el('th', { style: `color:${s.color}` }, s.label)))),
        el('tbody', {}, ...rows)
      )
    );
  }

  function draw() {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Warm parchment background
    ctx.fillStyle = '#fff8ea';
    ctx.fillRect(0, 0, w, h);

    // Subtle 2.5D top inner recess strip
    ctx.fillStyle = '#efe0c2';
    ctx.fillRect(0, 0, w, 7);

    const originX = w / 2 - centerX * scale;
    const originY = h / 2 + centerY * scale;

    // Grid spacing adaptive
    const rawStep = 65 / scale;
    const mag = 10 ** Math.floor(Math.log10(rawStep));
    const norm = rawStep / mag;
    const step = (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag;

    // Minor grid
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

    // Axes
    ctx.strokeStyle = '#8b6647';
    ctx.lineWidth = 3;
    if (originX >= 0 && originX <= w) {
      ctx.beginPath(); ctx.moveTo(originX, 0); ctx.lineTo(originX, h); ctx.stroke();
    }
    if (originY >= 0 && originY <= h) {
      ctx.beginPath(); ctx.moveTo(0, originY); ctx.lineTo(w, originY); ctx.stroke();
    }

    // Labels
    ctx.fillStyle = '#6d4b33';
    ctx.font = '700 13px Nunito, sans-serif';
    for (let x = minX; x <= maxX; x += step) {
      if (Math.abs(x) < step * 0.1) continue;
      const px = originX + x * scale;
      const py = Math.min(h - 18, Math.max(20, originY + 18));
      ctx.fillText(Number(x.toPrecision(4)).toString(), px + 4, py);
    }
    for (let y = minY; y <= maxY; y += step) {
      if (Math.abs(y) < step * 0.1) continue;
      const py = originY - y * scale;
      const px = Math.min(w - 38, Math.max(8, originX + 8));
      ctx.fillText(Number(y.toPrecision(4)).toString(), px, py - 5);
    }

    // Plot smooth curves
    const errors = [];
    for (const s of slots) {
      if (!s.visible || !s.expr.trim()) continue;
      try {
        // Test expression once
        evalExpression(s.expr, { xValue: 0 });
      } catch (err) {
        if (err.message !== 'Undefined math result.' && err.message !== 'Cannot divide by zero.') {
          errors.push(`${s.label}: ${err.message}`);
          continue;
        }
      }
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let drawing = false;
      let prevPy = null;
      const pxStep = 2;
      for (let px = 0; px <= w; px += pxStep) {
        const xv = (px - originX) / scale;
        try {
          const yv = evalExpression(s.expr, { xValue: xv });
          const py = originY - yv * scale;
          if (!Number.isFinite(py) || Math.abs(py) > h * 4 || (prevPy !== null && Math.abs(py - prevPy) > h * 0.9)) {
            drawing = false;
            prevPy = null;
          } else if (!drawing) {
            ctx.moveTo(px, py);
            drawing = true;
            prevPy = py;
          } else {
            ctx.lineTo(px, py);
            prevPy = py;
          }
        } catch {
          drawing = false;
          prevPy = null;
        }
      }
      ctx.stroke();
    }

    // Hover crosshair
    if (hoverPt) {
      const xv = (hoverPt.x - originX) / scale;
      ctx.strokeStyle = '#c49d78';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(hoverPt.x, 0); ctx.lineTo(hoverPt.x, h); ctx.stroke();
      ctx.setLineDash([]);

      const parts = [`x = ${xv.toFixed(2)}`];
      for (const s of slots) {
        if (!s.visible || !s.expr.trim()) continue;
        try {
          const yv = evalExpression(s.expr, { xValue: xv });
          const py = originY - yv * scale;
          if (py >= -10 && py <= h + 10) {
            ctx.fillStyle = s.color;
            ctx.strokeStyle = INK;
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(hoverPt.x, py, 6, 0, PI * 2); ctx.fill(); ctx.stroke();
          }
          parts.push(`${s.label} = ${Number(yv.toFixed(3))}`);
        } catch {}
      }
      readout.textContent = errors.length ? errors[0] : parts.join('   •   ');
    } else if (errors.length) {
      readout.textContent = errors[0];
    } else {
      readout.textContent = `Center (${centerX.toFixed(1)}, ${centerY.toFixed(1)})  •  Tap grid to inspect`;
    }
  }

  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    hoverPt = { x: ((e.clientX - r.left) / r.width) * canvas.width, y: ((e.clientY - r.top) / r.height) * canvas.height };
    draw();
  });
  canvas.addEventListener('pointerleave', () => { hoverPt = null; draw(); });

  const presets = ['sin(x)', 'x^2 - 2', 'cos(2*x)', '0.2*x^3 - x', 'abs(x) - 2', '2/x'];
  const presetRow = el('div', { class: 'preset-row' },
    presets.map(p => el('button', {
      type: 'button',
      class: 'gbtn gbtn-chip',
      onclick: () => {
        const s = slots.find(x => x.id === activeSlot);
        if (s) { s.expr = p; s.visible = true; exprField.input.value = p; syncVisibility(); draw(); }
      }
    }, p))
  );

  const zoomPad = el('div', { class: 'graph-controls' },
    el('button', { type: 'button', class: 'gbtn gbtn-mini', onclick: () => { scale = Math.min(200, scale * 1.25); draw(); } }, 'Zoom +'),
    el('button', { type: 'button', class: 'gbtn gbtn-mini', onclick: () => { scale = Math.max(10, scale / 1.25); draw(); } }, 'Zoom −'),
    el('button', { type: 'button', class: 'gbtn gbtn-mini', onclick: () => { centerX -= 1.5; draw(); } }, '←'),
    el('button', { type: 'button', class: 'gbtn gbtn-mini', onclick: () => { centerX += 1.5; draw(); } }, '→'),
    el('button', { type: 'button', class: 'gbtn gbtn-mini', onclick: () => { centerY += 1.5; draw(); } }, '↑'),
    el('button', { type: 'button', class: 'gbtn gbtn-mini', onclick: () => { centerY -= 1.5; draw(); } }, '↓'),
    el('button', { type: 'button', class: 'gbtn gbtn-mini', onclick: () => { centerX = 0; centerY = 0; scale = 42; draw(); } }, 'Center')
  );

  root.replaceChildren(
    el('div', { class: 'game-panel' },
      tabs.el,
      el('div', { class: 'graph-expr-row' }, exprField.el, visToggle.el),
      presetRow,
      tableBox,
      el('div', { class: 'graph-bezel' }, canvas),
      zoomPad,
      readout
    )
  );
  draw();
}

// =========================================================================
// 3. BODILY CALCULATOR (BMI etc.)
// =========================================================================
function bodilyCalculator(root) {
  let imperial = false;
  let sex = 'female';
  let activity = 1.375;

  let heightCm = 170;
  let weightKg = 66;
  let age = 26;
  let waistCm = 76;

  const unitToggle = createGameToggle({
    checked: false,
    offLabel: 'CM / KG',
    onLabel: 'IN / LB',
    label: 'Unit system',
    onChange: val => {
      imperial = val;
      if (imperial) {
        heightSlider.el.querySelector('.gslider-label').textContent = 'Height (inches)';
        weightSlider.el.querySelector('.gslider-label').textContent = 'Weight (pounds)';
        waistSlider.el.querySelector('.gslider-label').textContent = 'Waist (inches)';
      } else {
        heightSlider.el.querySelector('.gslider-label').textContent = 'Height (cm)';
        weightSlider.el.querySelector('.gslider-label').textContent = 'Weight (kg)';
        waistSlider.el.querySelector('.gslider-label').textContent = 'Waist (cm)';
      }
      update();
    }
  });

  const sexTabs = createGameTabs({
    items: [
      { value: 'female', label: 'Female', icon: '🌸' },
      { value: 'male', label: 'Male', icon: '🌿' }
    ],
    value: 'female',
    onChange: v => { sex = v; update(); }
  });

  const activityTabs = createGameTabs({
    items: [
      { value: '1.2', label: 'Cozy Rest' },
      { value: '1.375', label: 'Light Walk' },
      { value: '1.55', label: 'Active' },
      { value: '1.725', label: 'Sporty' }
    ],
    value: '1.375',
    onChange: v => { activity = Number(v); update(); }
  });

  const heightSlider = createGameSlider({ label: 'Height (cm)', min: 120, max: 220, step: 1, value: 170, color: '#9bc9f2', onChange: v => { heightCm = imperial ? v * 2.54 : v; update(); } });
  const weightSlider = createGameSlider({ label: 'Weight (kg)', min: 35, max: 180, step: 0.5, value: 66, color: '#f7b2a6', onChange: v => { weightKg = imperial ? v * 0.45359237 : v; update(); } });
  const ageSlider = createGameSlider({ label: 'Age (years)', min: 14, max: 95, step: 1, value: 26, color: '#ffe082', onChange: v => { age = v; update(); } });
  const waistSlider = createGameSlider({ label: 'Waist (cm)', min: 50, max: 140, step: 1, value: 76, color: '#b7dfb3', onChange: v => { waistCm = imperial ? v * 2.54 : v; update(); } });

  const bmiValEl = el('div', { class: 'stat-big' }, '22.8');
  const bmiBadge = el('span', { class: 'gbadge' }, 'Cozy & Balanced');
  const pinEl = el('div', { class: 'bmi-pin' }, '▼');
  const bmrValEl = el('div', { class: 'stat-mid' });
  const tdeeValEl = el('div', { class: 'stat-mid' });
  const rangeValEl = el('div', { class: 'stat-mid' });
  const whtrValEl = el('div', { class: 'stat-mid' });

  function update() {
    const hVal = heightSlider.getValue();
    const wVal = weightSlider.getValue();
    const wsVal = waistSlider.getValue();

    // Interpret slider directly according to unit mode
    const cm = imperial ? (hVal * 1.15) : hVal; // keep sliders mapped nicely:
    const actualCm = imperial ? Math.round(48 + ((hVal - 120) / 100) * 38) * 2.54 : hVal;
    const actualKg = imperial ? Math.round(80 + ((wVal - 35) / 145) * 270) * 0.45359237 : wVal;
    const actualWaist = imperial ? Math.round(20 + ((wsVal - 50) / 90) * 36) * 2.54 : wsVal;

    // Update badge texts with exact displayed units when imperial
    if (imperial) {
      const inches = Math.round(actualCm / 2.54);
      const lbs = Math.round(actualKg / 0.45359237);
      const wIn = Math.round(actualWaist / 2.54);
      heightSlider.el.querySelector('.gslider-badge').textContent = `${Math.floor(inches / 12)}'${inches % 12}" (${inches} in)`;
      weightSlider.el.querySelector('.gslider-badge').textContent = `${lbs} lb`;
      waistSlider.el.querySelector('.gslider-badge').textContent = `${wIn} in`;
    } else {
      heightSlider.el.querySelector('.gslider-badge').textContent = `${actualCm} cm`;
      weightSlider.el.querySelector('.gslider-badge').textContent = `${actualKg} kg`;
      waistSlider.el.querySelector('.gslider-badge').textContent = `${actualWaist} cm`;
    }

    const m = actualCm / 100;
    const bmi = actualKg / (m * m);
    bmiValEl.textContent = bmi.toFixed(1);

    let cat = 'Healthy Range', badgeBg = '#b8e3b3';
    if (bmi < 18.5) { cat = 'Light / Underweight'; badgeBg = '#bfe3ff'; }
    else if (bmi < 25) { cat = 'Cozy & Healthy'; badgeBg = '#b8e3b3'; }
    else if (bmi < 30) { cat = 'Slightly Over'; badgeBg = '#ffe082'; }
    else { cat = 'High BMI'; badgeBg = '#ffb3a7'; }
    bmiBadge.textContent = cat;
    bmiBadge.style.background = badgeBg;

    const pct = Math.min(96, Math.max(4, ((bmi - 14) / 24) * 100));
    pinEl.style.left = `${pct}%`;

    const bmr = 10 * actualKg + 6.25 * actualCm - 5 * age + (sex === 'male' ? 5 : -161);
    const tdee = bmr * activity;
    const lowKg = 18.5 * m * m;
    const highKg = 24.9 * m * m;
    const whtr = actualWaist / actualCm;

    bmrValEl.textContent = `${Math.round(bmr)} kcal/day`;
    tdeeValEl.textContent = `${Math.round(tdee)} kcal/day`;
    rangeValEl.textContent = imperial
      ? `${Math.round(lowKg / 0.45359237)}–${Math.round(highKg / 0.45359237)} lb`
      : `${lowKg.toFixed(1)}–${highKg.toFixed(1)} kg`;
    whtrValEl.textContent = `${whtr.toFixed(2)} ${whtr < 0.5 ? '(Balanced)' : '(Elevated)'}`;
  }

  const cuteHeaderIcon = `<svg class="game-svg body-icon" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="26" fill="#ffd9c8" stroke="${INK}" stroke-width="3.5"/><path d="M32 46 C32 46 17 36 17 27 C17 22.5 20.5 19.5 24.5 19.5 C27.8 19.5 30.4 21.6 32 24.2 C33.6 21.6 36.2 19.5 39.5 19.5 C43.5 19.5 47 22.5 47 27 C47 36 32 46 32 46Z" fill="#ff8f8f" stroke="${INK}" stroke-width="3"/></svg>`;

  const panel = el('div', { class: 'game-panel body-panel' },
    el('div', { class: 'body-top' },
      el('div', { class: 'body-title-row' },
        (() => { const d = el('span'); d.innerHTML = cuteHeaderIcon; return d; })(),
        el('div', {}, el('strong', {}, 'Cozy Health Check'), el('p', {}, 'Slide the knobs to explore BMI, calories & ratios'))
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
        el('div', { class: 'gfield-label' }, 'Daily Activity'),
        activityTabs.el
      ),
      el('div', { class: 'pastel-card cream' },
        el('div', { class: 'bmi-card' },
          el('span', { class: 'gfield-label' }, 'Body Mass Index (BMI)'),
          bmiValEl,
          bmiBadge,
          el('div', { class: 'bmi-meter' },
            pinEl,
            el('div', { class: 'bmi-bar' },
              el('span', { style: 'width:20%;background:#bfe3ff' }),
              el('span', { style: 'width:32%;background:#b8e3b3' }),
              el('span', { style: 'width:24%;background:#ffe082' }),
              el('span', { style: 'width:24%;background:#ffb3a7' })
            )
          )
        ),
        el('div', { class: 'stat-grid' },
          el('div', { class: 'stat-box' }, el('span', {}, '🔥 Resting BMR'), bmrValEl),
          el('div', { class: 'stat-box' }, el('span', {}, '⚡ Daily Calories'), tdeeValEl),
          el('div', { class: 'stat-box' }, el('span', {}, '⚖️ Healthy Weight'), rangeValEl),
          el('div', { class: 'stat-box' }, el('span', {}, '📏 Waist / Height'), whtrValEl)
        )
      )
    )
  );
  root.replaceChildren(panel);
  update();
}

// =========================================================================
// 4. FRACTION CALCULATOR
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
  const pieWrap = el('div', { class: 'frac-pie-wrap' });

  const boxA = makeFractionBox('Fraction A', 1, 2, '#fff1cf', compute);
  const boxB = makeFractionBox('Fraction B', 1, 3, '#dff2db', compute);

  const opTabs = createGameTabs({
    items: [
      { value: '+', label: '+' },
      { value: '-', label: '−' },
      { value: '*', label: '×' },
      { value: '/', label: '÷' }
    ],
    value: '+',
    cls: 'frac-ops',
    onChange: v => { op = v; compute(); }
  });

  function drawPie(n, d) {
    const num = Number(n), den = Number(d);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0 || den > 24 || Math.abs(num) > 48) {
      pieWrap.replaceChildren(el('span', { class: 'gbadge' }, 'Pie preview for denominators ≤ 24'));
      return;
    }
    const ratio = Math.min(1, Math.max(0, Math.abs(num) / den));
    const cx = 48, cy = 48, r = 38;
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
      lines += `<line x1="${cx}" y1="${cy}" x2="${(cx + r * Math.sin(a)).toFixed(2)}" y2="${(cy - r * Math.cos(a)).toFixed(2)}" stroke="${INK}" stroke-width="2"/>`;
    }
    pieWrap.innerHTML = `<svg class="game-svg" width="96" height="96" viewBox="0 0 96 96"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff6df" stroke="${INK}" stroke-width="3.5"/>${slice}${lines}<circle cx="${cx}" cy="${cy}" r="5" fill="#fff6df" stroke="${INK}" stroke-width="2.5"/></svg>`;
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
      if (op === '/' && c === 0n) throw new Error('Cannot divide by a zero fraction!');
      let n = op === '+' ? a * d + c * b : op === '-' ? a * d - c * b : op === '*' ? a * c : a * d;
      let den = op === '/' ? b * c : b * d;
      if (den < 0n) { n = -n; den = -den; }
      const g = gcdBig(n, den);
      n /= g; den /= g;

      const whole = n / den;
      const rem = (n < 0n ? -n : n) % den;
      const dec = Number(n) / Number(den);

      resultDetail.classList.remove('error');
      resultFrac.replaceChildren(
        el('div', { class: 'frac-stacked' },
          el('span', {}, String(n)),
          el('i'),
          el('span', {}, String(den))
        )
      );
      const mixed = den === 1n ? `Whole number: ${n}` : `Mixed: ${n < 0n && whole === 0n ? '-' : ''}${whole} ${rem}/${den}`;
      resultDetail.textContent = `${mixed}\nDecimal: ${Number.isFinite(dec) ? numberText(dec) : 'too large'}`;
      drawPie(rem === 0n && n !== 0n ? den : rem, den);
    } catch (e) {
      resultDetail.classList.add('error');
      resultDetail.textContent = e.message;
      resultFrac.replaceChildren();
      pieWrap.replaceChildren();
    }
  }

  root.replaceChildren(
    el('div', { class: 'game-panel' },
      el('div', { class: 'frac-stage' }, boxA.el, opTabs.el, boxB.el),
      el('div', { class: 'frac-output-card' }, resultFrac, pieWrap, resultDetail)
    )
  );
  compute();
}

// =========================================================================
// 5. PERCENTAGE CALCULATOR
// =========================================================================
function percentage(root) {
  let mode = 'of';
  const aField = createGameField({ label: 'Percent (%)', value: '20', inputmode: 'decimal', onInput: update });
  const bField = createGameField({ label: 'Amount', value: '150', inputmode: 'decimal', onInput: update });
  const out = el('div', { class: 'output', 'aria-live': 'polite' });
  const barFill = el('div', { class: 'pct-fill' });

  const modeTabs = createGameTabs({
    items: [
      { value: 'of', label: 'A% of B', icon: '🏷️' },
      { value: 'what', label: 'A is ?% of B', icon: '🥧' },
      { value: 'change', label: '% Change', icon: '📈' },
      { value: 'discount', label: 'Sale Discount', icon: '🛍️' },
      { value: 'tip', label: 'Add % / Tip', icon: '🪙' }
    ],
    value: 'of',
    onChange: v => {
      mode = v;
      if (v === 'of') { aField.el.querySelector('.gfield-label').textContent = 'Percent A (%)'; bField.el.querySelector('.gfield-label').textContent = 'Of Value B'; }
      else if (v === 'what') { aField.el.querySelector('.gfield-label').textContent = 'Part A'; bField.el.querySelector('.gfield-label').textContent = 'Whole B'; }
      else if (v === 'change') { aField.el.querySelector('.gfield-label').textContent = 'Original A'; bField.el.querySelector('.gfield-label').textContent = 'New Value B'; }
      else if (v === 'discount') { aField.el.querySelector('.gfield-label').textContent = 'Discount (%)'; bField.el.querySelector('.gfield-label').textContent = 'Price ($)'; }
      else { aField.el.querySelector('.gfield-label').textContent = 'Add / Tip (%)'; bField.el.querySelector('.gfield-label').textContent = 'Subtotal ($)'; }
      update();
    }
  });

  const coinRow = el('div', { class: 'preset-row' },
    [5, 10, 15, 20, 25, 50, 75].map(p =>
      el('button', {
        type: 'button',
        class: 'gbtn gbtn-coin',
        onclick: () => { aField.input.value = String(p); update(); }
      }, `${p}%`)
    )
  );

  function update() {
    const a = Number(aField.input.value.trim());
    const b = Number(bField.input.value.trim());
    if (!aField.input.value.trim() || !bField.input.value.trim() || !Number.isFinite(a) || !Number.isFinite(b)) {
      out.classList.add('error');
      out.textContent = 'Enter valid numbers in both boxes.';
      return;
    }
    out.classList.remove('error');
    let fillPct = 0;
    if (mode === 'of') {
      const res = (a / 100) * b;
      fillPct = Math.min(100, Math.max(0, a));
      out.textContent = `${numberText(a)}% of ${numberText(b)} = ${numberText(res)}`;
    } else if (mode === 'what') {
      if (b === 0) { out.classList.add('error'); out.textContent = 'Whole B cannot be zero.'; return; }
      const pct = (a / b) * 100;
      fillPct = Math.min(100, Math.max(0, pct));
      out.textContent = `${numberText(a)} is ${numberText(pct)}% of ${numberText(b)}`;
    } else if (mode === 'change') {
      if (a === 0) { out.classList.add('error'); out.textContent = 'Original value A cannot be zero.'; return; }
      const chg = ((b - a) / Math.abs(a)) * 100;
      fillPct = Math.min(100, Math.max(0, Math.abs(chg)));
      out.textContent = `${chg >= 0 ? '+' : ''}${numberText(chg)}% change (diff ${numberText(b - a)})`;
    } else if (mode === 'discount') {
      const saved = (a / 100) * b;
      const finalPrice = b - saved;
      fillPct = Math.min(100, Math.max(0, 100 - a));
      out.textContent = `Pay: ${numberText(finalPrice)}   •   You save: ${numberText(saved)} (${numberText(a)}% off)`;
    } else {
      const added = (a / 100) * b;
      fillPct = Math.min(100, Math.max(0, a));
      out.textContent = `Total: ${numberText(b + added)}   •   Added: ${numberText(added)} (+${numberText(a)}%)`;
    }
    barFill.style.width = `${fillPct}%`;
  }

  const tagIcon = `<svg class="game-svg" width="52" height="52" viewBox="0 0 64 64" fill="none"><path d="M12 18 L38 10 L55 30 L33 54 L10 34 Z" fill="#ffe184" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/><circle cx="22" cy="24" r="3.5" fill="#fff8e8" stroke="${INK}" stroke-width="2.5"/><circle cx="30" cy="31" r="4" fill="#ff9e85" stroke="${INK}" stroke-width="2.2"/><circle cx="40" cy="37" r="4" fill="#8fd3a4" stroke="${INK}" stroke-width="2.2"/><line x1="40" y1="25" x2="29" y2="43" stroke="${INK}" stroke-width="3" stroke-linecap="round"/></svg>`;

  const iconHolder = el('span');
  iconHolder.innerHTML = tagIcon;

  root.replaceChildren(
    el('div', { class: 'game-panel' },
      el('div', { class: 'pct-head' }, iconHolder, el('div', {}, el('strong', {}, 'Cozy Percent Shop'), el('p', {}, 'Tap a quick coin or type your own numbers'))),
      modeTabs.el,
      coinRow,
      el('div', { class: 'two-col' }, aField.el, bField.el),
      el('div', { class: 'pct-bar' }, barFill),
      out
    )
  );
  update();
}

// =========================================================================
// 6. DICE ROLLER (CUSTOM FACES)
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
      const btn = el('button', {
        type: 'button',
        class: `die-25d ${idx === selectedIdx ? 'is-selected' : ''} ${bouncing ? 'die-bounce' : ''}`,
        style: `background:${d.color}`,
        'aria-label': `Die ${idx + 1} showing ${face}. Tap to edit faces.`,
        onclick: () => { selectedIdx = idx; renderTray(); renderEditor(); }
      },
        el('span', { class: 'die-tag' }, `D${d.faces.length}`),
        renderPipsOrText(face)
      );
      return btn;
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
          onclick: () => { d.faces.push(String(d.faces.length + 1)); renderTray(); renderEditor(); }
        }, '+ Add Face')
      ),
      el('div', { class: 'preset-row' },
        presets.map(([name, faces]) =>
          el('button', {
            type: 'button',
            class: 'gbtn gbtn-chip',
            onclick: () => { d.faces = [...faces]; d.current = 0; renderTray(); renderEditor(); }
          }, name)
        )
      ),
      faceChips
    );
  }

  function rollAll() {
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
// 7. ROMAN NUMERAL CALCULATOR (WITH VINCULUM)
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
  // Use vinculum for >= 4000 (standard M up to 3999, vinculum for thousands >= 4)
  if (n >= 4000) {
    let t = thousands;
    for (const [val, sym] of ROMAN_PAIRS) {
      while (t >= val) { over += sym; t -= val; }
    }
    let u = units;
    for (const [val, sym] of ROMAN_PAIRS) {
      while (u >= val) { base += sym; u -= val; }
    }
  } else {
    let rem = n;
    for (const [val, sym] of ROMAN_PAIRS) {
      while (rem >= val) { base += sym; rem -= val; }
    }
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

/** Parse Roman input where `_` prefix or combining overline `\u0305` marks vinculum (x1000). */
function parseRomanInput(raw) {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!cleaned) throw new Error('Enter a Roman numeral (use _V or V̅ for ×1,000).');

  // Tokenize into { sym, vinc }
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
      throw new Error(`Invalid Roman character “${ch}”. Use I, V, X, L, C, D, M (and _ or overline for ×1000).`);
    }
  }
  const vals = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < tokens.length; i++) {
    const cur = vals[tokens[i].sym] * (tokens[i].vinc ? 1000 : 1);
    const nxt = i + 1 < tokens.length ? vals[tokens[i + 1].sym] * (tokens[i + 1].vinc ? 1000 : 1) : 0;
    if (cur < nxt) {
      total += nxt - cur;
      i++;
    } else {
      total += cur;
    }
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
    onChange: v => { tab = v; renderMode(); }
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
        onChange: v => { op = v; calcRoman(); }
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
// 8. NUMBER BASE CONVERTER (2, 8, 10, 16, 36)
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
  const inputs = new Map();
  const status = el('div', { class: 'output', 'aria-live': 'polite' });
  const padWrap = el('div', { class: 'base-pad' });

  function updateFrom(sourceBase, raw) {
    try {
      const val = parseBigIntInBase(raw, sourceBase);
      for (const b of bases) {
        if (b.base !== sourceBase) {
          inputs.get(b.base).value = val.toString(b.base).toUpperCase();
        }
      }
      const bin = (val < 0n ? (-val).toString(2) : val.toString(2));
      const grouped = bin.padStart(Math.ceil(bin.length / 4) * 4, '0').replace(/(.{4})/g, '$1 ').trim();
      status.classList.remove('error');
      status.textContent = `Value: ${val}  •  Nibbles: ${val < 0n ? '-' : ''}${grouped}`;
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
            const inp = inputs.get(activeBase);
            inp.value = (inp.value === '0' ? '' : inp.value) + ch;
            updateFrom(activeBase, inp.value);
          }
        }, ch)),
        el('button', {
          type: 'button',
          class: 'gbtn gbtn-mini warn',
          onclick: () => {
            const inp = inputs.get(activeBase);
            inp.value = inp.value.slice(0, -1) || '0';
            updateFrom(activeBase, inp.value);
          }
        }, '⌫'),
        el('button', {
          type: 'button',
          class: 'gbtn gbtn-mini danger',
          onclick: () => {
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
    const card = el('div', { class: 'base-card', style: `background:${b.color}`, 'data-base': b.base },
      el('span', { class: 'gfield-label' }, b.name),
      el('div', { class: 'gfield-tray' }, inp)
    );
    return card;
  });

  function highlightActive() {
    cards.forEach(c => c.classList.toggle('is-active', Number(c.getAttribute('data-base')) === activeBase));
  }

  root.replaceChildren(
    el('div', { class: 'game-panel' },
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
// 9. PRIME NUMBER CHECKER
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
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * 2 * PI;
      const dist = 55 + (i % 3) * 28;
      const dot = el('span', {
        class: 'confetti-sprinkle',
        style: `background:${colors[i % colors.length]};--tx:${Math.cos(angle) * dist}px;--ty:${Math.sin(angle) * dist}px`
      });
      confettiLayer.append(dot);
    }
  }

  function stepPrime(dir) {
    try {
      let n = BigInt(numField.input.value.trim() || '2') + BigInt(dir);
      if (n < 2n) n = 2n;
      while (!isPrimeBig(n) && n < 18446744073709551615n) n += BigInt(dir);
      numField.input.value = String(n);
      check();
    } catch {}
  }

  function check() {
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
      cardEl.className = 'prime-card is-prime';
      cardEl.replaceChildren(
        confettiLayer,
        el('div', { class: 'prime-mascot' }, '⭐'),
        el('div', { class: 'prime-big-num' }, String(n)),
        el('span', { class: 'gbadge prime-yes' }, 'PRIME NUMBER!'),
        el('p', {}, `${n} is only divisible by 1 and itself.`)
      );
      burstConfetti();
    } else {
      const facs = smallFactorize(n);
      const expr = facs.map(([p, c, unfactored]) => `${p}${c > 1 ? `^${c}` : ''}${unfactored ? ' (composite)' : ''}`).join(' × ');
      const firstDiv = facs[0][0];
      cardEl.className = 'prime-card is-composite';
      cardEl.replaceChildren(
        el('div', { class: 'prime-mascot split' }, '🧩'),
        el('div', { class: 'prime-big-num' }, String(n)),
        el('span', { class: 'gbadge prime-no' }, 'COMPOSITE'),
        el('p', {}, `Splits into: ${firstDiv} × ${n / firstDiv}`),
        el('div', { class: 'prime-factors' }, `Factorization: ${expr}`)
      );
    }
  }

  const actions = el('div', { class: 'preset-row' },
    el('button', { type: 'button', class: 'gbtn gbtn-mini', onclick: () => { try { const v = BigInt(numField.input.value || '2') - 1n; numField.input.value = String(v < 0n ? 0n : v); check(); } catch {} } }, '− 1'),
    el('button', { type: 'button', class: 'gbtn gbtn-mini', onclick: () => { try { numField.input.value = String(BigInt(numField.input.value || '0') + 1n); check(); } catch {} } }, '+ 1'),
    el('button', { type: 'button', class: 'gbtn gbtn-chip', onclick: () => stepPrime(-1) }, '← Prev Prime'),
    el('button', { type: 'button', class: 'gbtn gbtn-chip', onclick: () => stepPrime(1) }, 'Next Prime →'),
    el('button', { type: 'button', class: 'gbtn gbtn-chip', onclick: () => {
      const sample = [17, 29, 97, 131, 353, 797, 1999, 7919, 104729][secureRandInt(9)];
      numField.input.value = String(sample);
      check();
    } }, '✨ Lucky Prime')
  );

  root.replaceChildren(
    el('div', { class: 'game-panel' },
      numField.el,
      actions,
      cardEl
    )
  );
  check();
}

// =========================================================================
// 10. SEQUENCE PLAYGROUND (8 PHYSICAL SEQUENCE TILES)
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
  while (cur !== 1 && path.length < 10) {
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

function sequencePlayground(root) {
  let activeId = 'fibonacci';
  let count = 12;
  let inspectedVal = 13;

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
          inspectedVal = val;
          testField.input.value = String(val);
          renderInspector();
        }
      }, el('small', {}, `#${idx + 1}`), el('strong', {}, val.toLocaleString()))
    ));

    detailBox.replaceChildren(
      el('div', { class: 'seq-head' },
        el('span', { class: 'seq-big-icon' }, seq.icon),
        el('div', {},
          el('h3', {}, seq.name),
          el('p', {}, seq.rule)
        )
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
  inspectedVal = 28;
  renderInspector();
}

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
