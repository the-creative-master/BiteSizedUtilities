/** Standalone, dependency-free math and science tools. All user text uses textContent. */
import { MATH_NUMBER_TOOLS } from './tools-math-numbers.js';
const PI = Math.PI;
const G = 6.67430e-11;
const C = 299792458;
const R = 8.31446261815324;
const H = 6.62607015e-34;
const LN2 = Math.LN2;

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value !== undefined && value !== null) node.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child !== null && child !== undefined) node.append(typeof child === 'object' ? child : document.createTextNode(String(child)));
  }
  return node;
}
function numberText(n) {
  if (!Number.isFinite(n)) throw new Error('The result is not finite. Check the inputs and domains.');
  if (Object.is(n, -0) || n === 0) return '0';
  return Number(n.toPrecision(12)).toString();
}
function lines(...items) { return items.filter(x => x !== undefined && x !== null).join('\n'); }
function positive(n, name, zero = false) {
  if (zero ? n < 0 : n <= 0) throw new Error(`${name} must be ${zero ? 'nonnegative' : 'greater than zero'}.`);
  return n;
}
function integer(n, name, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error(`${name} must be a whole number from ${min} to ${max}.`);
  return n;
}
function show(output, text, error = false) {
  output.textContent = String(text);
  output.classList.toggle('error', error);
  output.setAttribute('role', error ? 'alert' : 'status');
}
function field(spec) {
  const { name, label, type = 'number', value = '', options, ...attrs } = spec;
  let input;
  if (type === 'select') {
    input = el('select', { name, ...attrs }, options.map(option => {
      const [v, title] = Array.isArray(option) ? option : [option, option];
      return el('option', { value: v }, title);
    }));
    input.value = String(value || (Array.isArray(options[0]) ? options[0][0] : options[0]));
  } else if (type === 'textarea') {
    input = el('textarea', { name, rows: 4, ...attrs });
    input.value = value;
  } else {
    input = el('input', { name, type, ...(type === 'number' ? { step: 'any' } : {}), ...attrs });
    input.value = String(value);
  }
  return { wrapper: el('label', { class: 'field' }, el('span', {}, label), input), input };
}
function formTool(root, title, description, specs, calculate, buttonText = 'Calculate') {
  const output = el('pre', { class: 'output', 'aria-live': 'polite', 'aria-atomic': 'true', style: 'white-space:pre-wrap;overflow-wrap:anywhere' }, 'Enter values and calculate.');
  const fields = Object.create(null);
  const grid = el('div', { class: 'two-col' });
  for (const spec of specs) {
    const item = field(spec);
    fields[spec.name] = item.input;
    grid.append(item.wrapper);
  }
  const run = () => {
    try {
      const values = Object.create(null);
      for (const spec of specs) {
        const raw = fields[spec.name].value.trim();
        if (spec.type === undefined || spec.type === 'number') {
          if (!raw) throw new Error(`${spec.label} is required.`);
          values[spec.name] = Number(raw);
          if (!Number.isFinite(values[spec.name])) throw new Error(`${spec.label} must be a finite number.`);
          if (spec.min !== undefined && values[spec.name] < Number(spec.min)) throw new Error(`${spec.label} must be at least ${spec.min}.`);
          if (spec.max !== undefined && values[spec.name] > Number(spec.max)) throw new Error(`${spec.label} must be at most ${spec.max}.`);
        } else values[spec.name] = raw;
      }
      show(output, calculate(values, fields));
    } catch (error) { show(output, error.message || 'Please check your inputs.', true); }
  };
  const form = el('form', { class: 'tool-form', novalidate: '', onsubmit: event => { event.preventDefault(); run(); } }, grid,
    el('button', { class: 'action', type: 'submit' }, buttonText));
  root.replaceChildren(el('section', { class: 'panel' }, el('h2', {}, title), el('p', {}, description), form, output));
  return { form, fields, output, run, grid };
}
const select = (name, label, options, value) => ({ name, label, type: 'select', options, value });
const num = (name, label, value, attrs = {}) => ({ name, label, value, ...attrs });
const text = (name, label, value = '', attrs = {}) => ({ name, label, value, type: 'text', ...attrs });

/** Recursive-descent expression evaluator; never evaluates JavaScript. Angles default to radians. */
function expression(source, degrees = false) {
  if (source.length > 2000) throw new Error('Expression is too long (maximum 2,000 characters).');
  const tokens = [];
  const re = /\s*(?:(\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)|([A-Za-z]+)|([+\-*/%^(),!]))/gy;
  let offset = 0;
  source = source.trim();
  while (offset < source.length) {
    re.lastIndex = offset;
    const match = re.exec(source);
    if (!match) throw new Error(`Unexpected character at position ${offset + 1}.`);
    tokens.push(match[1] !== undefined ? Number(match[1]) : (match[2] || match[3]).toLowerCase());
    offset = re.lastIndex;
  }
  if (!tokens.length) throw new Error('Enter an expression.');
  let i = 0;
  let depth = 0;
  const finite = n => { if (!Number.isFinite(n)) throw new Error('Undefined or non-finite result (check division by zero and function domains).'); return n; };
  const toAngle = x => degrees ? x * PI / 180 : x;
  const fromAngle = x => degrees ? x * 180 / PI : x;
  const funcs = {
    sin: [1, x => Math.sin(toAngle(x))], cos: [1, x => Math.cos(toAngle(x))], tan: [1, x => {
      if (Math.abs(Math.cos(toAngle(x))) < 1e-14) throw new Error('tan is undefined at this angle.');
      return Math.tan(toAngle(x));
    }],
    asin: [1, x => fromAngle(Math.asin(x))], acos: [1, x => fromAngle(Math.acos(x))], atan: [1, x => fromAngle(Math.atan(x))],
    sqrt: [1, Math.sqrt], cbrt: [1, Math.cbrt], abs: [1, Math.abs], ln: [1, Math.log], log: [1, Math.log10],
    exp: [1, Math.exp], floor: [1, Math.floor], ceil: [1, Math.ceil], round: [1, Math.round],
    min: [2, Math.min], max: [2, Math.max], pow: [2, Math.pow]
  };
  function primary() {
    if (++depth > 100) throw new Error('Expression nesting is too deep.');
    let result;
    const token = tokens[i++];
    if (typeof token === 'number') result = token;
    else if (token === '(') {
      result = sum();
      if (tokens[i++] !== ')') throw new Error('Missing closing parenthesis.');
    } else if (token === 'pi') result = PI;
    else if (token === 'e') result = Math.E;
    else if (typeof token === 'string' && Object.hasOwn(funcs, token)) {
      if (tokens[i++] !== '(') throw new Error(`Use ${token}(…) with parentheses.`);
      const args = [sum()];
      while (tokens[i] === ',') { i++; args.push(sum()); if (args.length > 2) throw new Error('Too many function arguments.'); }
      if (tokens[i++] !== ')') throw new Error('Missing closing function parenthesis.');
      const [arity, fn] = funcs[token];
      if (args.length !== arity) throw new Error(`${token} requires ${arity} argument(s).`);
      result = fn(...args);
    } else throw new Error(`Expected a number, constant, or function${token !== undefined ? `; found “${token}”` : ''}.`);
    while (tokens[i] === '!') {
      i++;
      integer(result, 'Factorial argument', 0, 170);
      let product = 1;
      for (let j = 2; j <= result; j++) product *= j;
      result = product;
    }
    depth--;
    return finite(result);
  }
  function power() { const left = primary(); if (tokens[i] === '^') { i++; return finite(left ** unary()); } return left; }
  function unary() {
    if (tokens[i] === '+' || tokens[i] === '-') {
      if (++depth > 100) throw new Error('Expression nesting is too deep.');
      const sign = tokens[i++] === '-' ? -1 : 1;
      const result = sign * unary(); depth--; return result;
    }
    return power();
  }
  function product() {
    let result = unary();
    while (['*', '/', '%'].includes(tokens[i])) {
      const op = tokens[i++], right = unary();
      if ((op === '/' || op === '%') && right === 0) throw new Error('Cannot divide by zero.');
      result = finite(op === '*' ? result * right : op === '/' ? result / right : result % right);
    }
    return result;
  }
  function sum() {
    let result = product();
    while (tokens[i] === '+' || tokens[i] === '-') {
      const op = tokens[i++], right = product();
      result = finite(op === '+' ? result + right : result - right);
    }
    return result;
  }
  const result = sum();
  if (i !== tokens.length) throw new Error('Unexpected token. Use * for multiplication, for example 2*pi.');
  return finite(result);
}
function calculator(root, scientific) {
  const tool = formTool(root, scientific ? 'Scientific calculator' : 'Calculator',
    'Use + − * / % (remainder) ^, parentheses, pi, e, and factorial (!). Functions: sin, cos, tan, asin, acos, atan, sqrt, cbrt, log (base 10), ln, exp, abs, floor, ceil, round, min, max, pow. Multiplication must be explicit.',
    [text('expression', 'Expression', scientific ? 'sin(pi/6)^2 + cos(pi/6)^2' : '(12 + 8) * 3 / 2', { autocomplete: 'off', spellcheck: 'false' }),
      select('angles', 'Angle mode', [['rad', 'Radians'], ['deg', 'Degrees']], 'rad')],
    v => numberText(expression(v.expression, v.angles === 'deg')), 'Evaluate');
  const keys = el('div', { class: 'calculator-keys two-col', 'aria-label': 'Calculator keypad' });
  for (const key of (scientific ? ['sin(', 'cos(', 'tan(', 'sqrt(', 'log(', 'ln(', 'pi', '^', '(', ')', '7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '+', '!', 'Clear', '⌫'] : ['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '(', ')', '+', '^', 'Clear', '⌫'])) {
    keys.append(el('button', { class: 'action secondary', type: 'button', 'aria-label': key === '⌫' ? 'Backspace' : key, onclick: () => {
      const input = tool.fields.expression;
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? start;
      let cursor;
      if (key === 'Clear') { input.value = ''; cursor = 0; }
      else if (key === '⌫') { const from = start === end ? Math.max(0, start - 1) : start; input.value = input.value.slice(0, from) + input.value.slice(end); cursor = from; }
      else { input.value = input.value.slice(0, start) + key + input.value.slice(end); cursor = start + key.length; }
      input.focus(); input.setSelectionRange(cursor, cursor);
    } }, key));
  }
  tool.form.append(keys);
}
const UNITS = {
  length: { m: ['Metres (m)', 1], km: ['Kilometres (km)', 1000], cm: ['Centimetres (cm)', .01], mm: ['Millimetres (mm)', .001], um: ['Micrometres (µm)', 1e-6], nm: ['Nanometres (nm)', 1e-9], in: ['Inches (in)', .0254], ft: ['Feet (ft)', .3048], yd: ['Yards (yd)', .9144], mi: ['Miles (mi)', 1609.344] },
  mass: { kg: ['Kilograms (kg)', 1], g: ['Grams (g)', .001], mg: ['Milligrams (mg)', 1e-6], t: ['Metric tonnes (t)', 1000], lb: ['Pounds (lb)', .45359237], oz: ['Ounces (oz)', .028349523125] },
  area: { m2: ['Square metres (m²)', 1], km2: ['Square kilometres (km²)', 1e6], cm2: ['Square centimetres (cm²)', 1e-4], ha: ['Hectares (ha)', 1e4], acre: ['Acres', 4046.8564224], ft2: ['Square feet (ft²)', .09290304] },
  volume: { m3: ['Cubic metres (m³)', 1], L: ['Litres (L)', .001], mL: ['Millilitres (mL)', 1e-6], gal: ['US gallons', .003785411784], impgal: ['Imperial gallons', .00454609], cup: ['US cups', .0002365882365] },
  speed: { ms: ['Metres per second (m/s)', 1], kmh: ['Kilometres per hour (km/h)', 1 / 3.6], mph: ['Miles per hour (mph)', .44704], knot: ['Knots', .5144444444444445] },
  time: { s: ['Seconds (s)', 1], ms: ['Milliseconds (ms)', .001], min: ['Minutes', 60], h: ['Hours', 3600], d: ['Days', 86400], week: ['Weeks', 604800] },
  pressure: { Pa: ['Pascals (Pa)', 1], kPa: ['Kilopascals (kPa)', 1000], bar: ['Bar', 1e5], atm: ['Standard atmospheres (atm)', 101325], psi: ['Pounds per square inch (psi)', 6894.757293168], torr: ['Torr', 101325 / 760] },
  energy: { J: ['Joules (J)', 1], kJ: ['Kilojoules (kJ)', 1000], cal: ['Thermochemical calories', 4.184], kcal: ['Kilocalories', 4184], kWh: ['Kilowatt-hours', 3.6e6], eV: ['Electronvolts', 1.602176634e-19] },
  temperature: { K: ['Kelvin (K)'], C: ['Celsius (°C)'], F: ['Fahrenheit (°F)'] }
};
function kelvin(value, unit) {
  const k = unit === 'C' ? value + 273.15 : unit === 'F' ? (value - 32) * 5 / 9 + 273.15 : value;
  if (k < -1e-10) throw new Error('Temperature cannot be below absolute zero (0 K).');
  return Math.max(0, k);
}
function fromKelvin(k, unit) { return unit === 'C' ? k - 273.15 : unit === 'F' ? (k - 273.15) * 9 / 5 + 32 : k; }
function unitConverter(root) {
  const tool = formTool(root, 'Unit converter', 'Convert common measurement units. Gallons and cups are US units unless marked Imperial.',
    [select('category', 'Measurement', Object.keys(UNITS).map(x => [x, x[0].toUpperCase() + x.slice(1)]), 'length'), num('value', 'Value', 1),
      select('from', 'From', [['m', 'Metres (m)']], 'm'), select('to', 'To', [['km', 'Kilometres (km)']], 'km')],
    v => {
      const units = UNITS[v.category];
      const converted = v.category === 'temperature' ? fromKelvin(kelvin(v.value, v.from), v.to) : v.value * units[v.from][1] / units[v.to][1];
      return `${numberText(v.value)} ${units[v.from][0]} = ${numberText(converted)} ${units[v.to][0]}`;
    }, 'Convert');
  const update = () => {
    const options = Object.entries(UNITS[tool.fields.category.value]);
    for (const key of ['from', 'to']) tool.fields[key].replaceChildren(...options.map(([id, data]) => el('option', { value: id }, data[0])));
    tool.fields.from.value = options[0][0]; tool.fields.to.value = options[Math.min(1, options.length - 1)][0];
  };
  tool.fields.category.addEventListener('change', update); update();
}
function percentage(root) {
  formTool(root, 'Percentage calculator', 'Choose a calculation. For percentage change, A is the original value and B is the new value.',
    [select('mode', 'Calculation', [['of', 'A% of B'], ['what', 'A is what percent of B?'], ['change', 'Percentage change from A to B'], ['increase', 'Increase A by B%'], ['decrease', 'Decrease A by B%']]), num('a', 'A', 20), num('b', 'B', 150)], v => {
      if (v.mode === 'of') return `${numberText(v.a)}% of ${numberText(v.b)} = ${numberText(v.a / 100 * v.b)}`;
      if (v.mode === 'what') { if (!v.b) throw new Error('B cannot be zero.'); return `${numberText(v.a / v.b * 100)}%`; }
      if (v.mode === 'change') { if (!v.a) throw new Error('An original value of zero has no defined percentage change.'); return `${numberText((v.b - v.a) / Math.abs(v.a) * 100)}% change`; }
      return numberText(v.a * (1 + (v.mode === 'increase' ? 1 : -1) * v.b / 100));
    });
}
function gcd(a, b) { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; }
function bigInteger(raw, label, limit = 200) {
  if (!/^[+-]?\d+$/.test(raw) || raw.replace(/^[+-]/, '').length > limit) throw new Error(`${label} must be an integer with at most ${limit} digits.`);
  return BigInt(raw);
}
function fractions(root) {
  formTool(root, 'Fraction calculator', 'Exact integer fraction arithmetic. Fractions are reduced automatically; denominators cannot be zero.',
    [text('a', 'First numerator', '1', { inputmode: 'numeric' }), text('b', 'First denominator', '2', { inputmode: 'numeric' }),
      select('op', 'Operation', [['+', 'Add (+)'], ['-', 'Subtract (−)'], ['*', 'Multiply (×)'], ['/', 'Divide (÷)']]),
      text('c', 'Second numerator', '1', { inputmode: 'numeric' }), text('d', 'Second denominator', '3', { inputmode: 'numeric' })], v => {
      const a = bigInteger(v.a, 'First numerator'), b = bigInteger(v.b, 'First denominator'), c = bigInteger(v.c, 'Second numerator'), d = bigInteger(v.d, 'Second denominator');
      if (!b || !d) throw new Error('Denominators cannot be zero.');
      if (v.op === '/' && !c) throw new Error('Cannot divide by a zero fraction.');
      let n = v.op === '+' ? a * d + c * b : v.op === '-' ? a * d - c * b : v.op === '*' ? a * c : a * d;
      let den = v.op === '/' ? b * c : b * d;
      if (den < 0n) { n = -n; den = -den; }
      const factor = gcd(n, den); n /= factor; den /= factor;
      const whole = n / den, remainder = (n < 0n ? -n : n) % den;
      const approx = Number(n) / Number(den);
      return lines(`Reduced fraction: ${n}/${den}`, den === 1n ? `Integer: ${n}` : `Mixed: ${n < 0n && whole === 0n ? '-' : ''}${whole} ${remainder}/${den}`,
        Number.isFinite(approx) ? `Decimal (approximate): ${numberText(approx)}` : 'Decimal: too large for floating-point display');
    });
}
function parseList(raw) {
  const parts = raw.trim().split(/[\s,;]+/).filter(Boolean);
  if (!parts.length || parts.length > 10000) throw new Error('Enter between 1 and 10,000 numbers, separated by commas or spaces.');
  const values = parts.map(x => Number(x));
  if (values.some((x, i) => !Number.isFinite(x) || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(parts[i]))) throw new Error('Every entry must be a finite decimal number.');
  return values;
}
function statistics(root) {
  formTool(root, 'Statistics', 'Paste numbers separated by commas, semicolons, or whitespace. Variance uses Welford’s numerically stable method.',
    [{ name: 'data', label: 'Data set', type: 'textarea', value: '2, 4, 4, 4, 5, 5, 7, 9' }], v => {
      const values = parseList(v.data), sorted = [...values].sort((a, b) => a - b), n = values.length;
      let mean = 0, m2 = 0, sum = 0;
      const counts = new Map();
      values.forEach((x, i) => { sum += x; const delta = x - mean; mean += delta / (i + 1); m2 += delta * (x - mean); counts.set(x, (counts.get(x) || 0) + 1); });
      const quantile = p => { const index = (n - 1) * p, lower = Math.floor(index), weight = index - lower; return sorted[lower] * (1 - weight) + sorted[Math.ceil(index)] * weight; };
      const maxCount = Math.max(...counts.values());
      const modes = [...counts].filter(([, count]) => count === maxCount).map(([x]) => numberText(x));
      return lines(`Count: ${n}`, `Sum: ${numberText(sum)}`, `Mean: ${numberText(mean)}`, `Median: ${numberText(quantile(.5))}`,
        `Mode: ${maxCount === 1 ? 'None (all values unique)' : modes.slice(0, 50).join(', ') + (modes.length > 50 ? ' …' : '')}`,
        `Minimum: ${numberText(sorted[0])}`, `Maximum: ${numberText(sorted[n - 1])}`, `Range: ${numberText(sorted[n - 1] - sorted[0])}`,
        `Q1 / Q3 (linear interpolation): ${numberText(quantile(.25))} / ${numberText(quantile(.75))}`,
        `Population variance: ${numberText(Math.max(0, m2 / n))}`, `Population standard deviation: ${numberText(Math.sqrt(Math.max(0, m2 / n)))}`,
        n > 1 ? `Sample variance: ${numberText(Math.max(0, m2 / (n - 1)))}\nSample standard deviation: ${numberText(Math.sqrt(Math.max(0, m2 / (n - 1))))}` : 'Sample variance / standard deviation: undefined for a single value');
    }, 'Analyze');
}
function secureRandom() {
  if (typeof globalThis.crypto?.getRandomValues !== 'function') throw new Error('Secure random generation is unavailable in this browser.');
  const words = new Uint32Array(2); globalThis.crypto.getRandomValues(words);
  return words[0] * 2097152 + (words[1] >>> 11); // Uniform 53-bit integer.
}
function randomBelow(range) {
  const size = 9007199254740992;
  const threshold = size - size % range;
  let sample; do { sample = secureRandom(); } while (sample >= threshold);
  return sample % range;
}
function randomNumber(root) {
  formTool(root, 'Random number generator', 'Uses browser cryptographic randomness. Integer bounds are inclusive; decimal upper bounds are exclusive.',
    [select('type', 'Type', [['integer', 'Integers'], ['decimal', 'Decimals']]), num('min', 'Minimum', 1), num('max', 'Maximum', 100), num('count', 'How many', 5, { min: 1, max: 1000, step: 1 }), select('unique', 'Allow duplicates?', [['yes', 'Yes'], ['no', 'No (integers only)']])], v => {
      integer(v.count, 'Count', 1, 1000);
      if (v.max < v.min) throw new Error('Maximum must be at least the minimum.');
      if (v.type === 'decimal') {
        if (v.unique === 'no') throw new Error('Unique sampling is supported for integers only.');
        if (v.max === v.min || !Number.isFinite(v.max - v.min)) throw new Error('Decimals require a finite, nonzero range.');
        return Array.from({ length: v.count }, () => String(v.min + (secureRandom() / 9007199254740992) * (v.max - v.min))).join('\n');
      }
      integer(v.min, 'Minimum'); integer(v.max, 'Maximum');
      const range = v.max - v.min + 1;
      if (!Number.isSafeInteger(range)) throw new Error('Integer range is too wide; use a span of at most 9,007,199,254,740,991.');
      if (v.unique === 'no' && v.count > range) throw new Error('Count exceeds the number of unique integers in the range.');
      const result = [], swaps = new Map();
      for (let i = 0; i < v.count; i++) {
        if (v.unique === 'yes') result.push(v.min + randomBelow(range));
        else { // Partial Fisher–Yates without allocating the whole range.
          const remaining = range - i, j = randomBelow(remaining);
          result.push(v.min + (swaps.get(j) ?? j));
          swaps.set(j, swaps.get(remaining - 1) ?? remaining - 1);
        }
      }
      return result.join(', ');
    }, 'Generate');
}
function numberBase(root) {
  formTool(root, 'Number base converter', 'Exact signed integer conversion between bases 2–36. Enter digits only, without 0x or 0b prefixes.',
    [text('value', 'Integer', '255'), num('from', 'Input base (2–36)', 10, { min: 2, max: 36, step: 1 }), num('to', 'Output base (2–36)', 16, { min: 2, max: 36, step: 1 })], v => {
      integer(v.from, 'Input base', 2, 36); integer(v.to, 'Output base', 2, 36);
      if (!/^[+-]?[a-z0-9]+$/i.test(v.value) || v.value.length > 1002) throw new Error('Enter an integer of at most 1,000 digits.');
      let digits = v.value.toLowerCase(), sign = 1n;
      if (digits[0] === '-' || digits[0] === '+') { if (digits[0] === '-') sign = -1n; digits = digits.slice(1); }
      if (digits.length > 1000) throw new Error('Maximum length is 1,000 digits.');
      let result = 0n;
      for (const char of digits) {
        const digit = '0123456789abcdefghijklmnopqrstuvwxyz'.indexOf(char);
        if (digit >= v.from) throw new Error(`Digit “${char}” is invalid in base ${v.from}.`);
        result = result * BigInt(v.from) + BigInt(digit);
      }
      result *= sign;
      return lines(`Base ${v.to}: ${result.toString(v.to).toUpperCase()}`, `Decimal: ${result}`, `Binary: ${result.toString(2)}`, `Octal: ${result.toString(8)}`, `Hexadecimal: ${result.toString(16).toUpperCase()}`);
    }, 'Convert');
}
function modularPower(a, d, n) { let r = 1n; while (d > 0n) { if (d & 1n) r = r * a % n; a = a * a % n; d >>= 1n; } return r; }
function isPrime(n) {
  if (n < 2n) return false;
  for (const p of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) { if (n === p) return true; if (n % p === 0n) return false; }
  let d = n - 1n, s = 0;
  while (d % 2n === 0n) { d /= 2n; s++; }
  // This base set is deterministic for every unsigned 64-bit integer.
  for (let a of [2n, 325n, 9375n, 28178n, 450775n, 9780504n, 1795265022n]) {
    a %= n; if (!a) continue;
    let x = modularPower(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    let witness = true;
    for (let r = 1; r < s; r++) { x = x * x % n; if (x === n - 1n) { witness = false; break; } }
    if (witness) return false;
  }
  return true;
}
function primeChecker(root) {
  formTool(root, 'Prime checker', 'Deterministic Miller–Rabin primality test for integers from 0 to 18,446,744,073,709,551,615 (2⁶⁴ − 1).',
    [text('n', 'Nonnegative integer', '97', { inputmode: 'numeric' })], v => {
      const n = bigInteger(v.n, 'Input', 20);
      if (n < 0n || n > 18446744073709551615n) throw new Error('Input must be in the unsigned 64-bit range.');
      if (n < 2n) return `${n} is neither prime nor composite.`;
      if (isPrime(n)) return `${n} is prime.`;
      let factor = n % 2n === 0n ? 2n : null;
      if (!factor) for (let p = 3n; p <= 10001n && p * p <= n; p += 2n) if (n % p === 0n) { factor = p; break; }
      return lines(`${n} is composite.`, factor ? `A factorization: ${factor} × ${n / factor}` : 'No small factor ≤ 10,001 found. The compositeness test is conclusive.');
    }, 'Check');
}
function equationSolver(root) {
  formTool(root, 'Equation solver', 'Solve a·x² + b·x + c = 0. Set a = 0 for a linear equation. Real and complex roots are supported.',
    [num('a', 'a (quadratic coefficient)', 1), num('b', 'b (linear coefficient)', -3), num('c', 'c (constant)', 2)], v => {
      let { a, b, c } = v;
      if (a === 0) {
        if (b === 0) return c === 0 ? 'Every real number is a solution (identity).' : 'No solution (inconsistent constant equation).';
        return `Linear solution: x = ${numberText(-c / b)}`;
      }
      const scale = Math.max(Math.abs(a), Math.abs(b), Math.abs(c)); a /= scale; b /= scale; c /= scale;
      const d = b * b - 4 * a * c;
      if (d < 0) return `Complex roots: x = ${numberText(-b / (2 * a))} ± ${numberText(Math.sqrt(-d) / (2 * Math.abs(a)))}i`;
      if (d === 0) return `Repeated real root: x = ${numberText(-b / (2 * a))}`;
      const q = -.5 * (b + (b >= 0 ? 1 : -1) * Math.sqrt(d));
      return `Real roots:\nx₁ = ${numberText(q / a)}\nx₂ = ${numberText(c / q)}`;
    }, 'Solve');
}
function geometry(root) {
  formTool(root, 'Geometry', 'Lengths are in metres. Rectangle uses a,b; triangle uses three sides a,b,c; circle/sphere use a as radius; cylinder/cone use a as radius and b as height; box uses a,b,c.',
    [select('shape', 'Shape', [['circle', 'Circle'], ['rectangle', 'Rectangle'], ['triangle', 'Triangle (three sides)'], ['sphere', 'Sphere'], ['cylinder', 'Cylinder'], ['cone', 'Cone'], ['box', 'Rectangular box']]), num('a', 'a / radius (m)', 3, { min: 0 }), num('b', 'b / height (m)', 4, { min: 0 }), num('c', 'c / third side (m)', 5, { min: 0 })], v => {
      const a = positive(v.a, 'a'), b = v.b, c = v.c;
      if (v.shape === 'circle') return `Area: ${numberText(PI * a * a)} m²\nCircumference: ${numberText(2 * PI * a)} m`;
      if (v.shape === 'sphere') return `Surface area: ${numberText(4 * PI * a * a)} m²\nVolume: ${numberText(4 / 3 * PI * a ** 3)} m³`;
      positive(b, 'b');
      if (v.shape === 'rectangle') return `Area: ${numberText(a * b)} m²\nPerimeter: ${numberText(2 * (a + b))} m\nDiagonal: ${numberText(Math.hypot(a, b))} m`;
      if (v.shape === 'cylinder') return `Volume: ${numberText(PI * a * a * b)} m³\nTotal surface area: ${numberText(2 * PI * a * (a + b))} m²`;
      if (v.shape === 'cone') return `Volume: ${numberText(PI * a * a * b / 3)} m³\nSlant height: ${numberText(Math.hypot(a, b))} m\nTotal surface area: ${numberText(PI * a * (a + Math.hypot(a, b)))} m²`;
      positive(c, 'c');
      if (v.shape === 'box') return `Volume: ${numberText(a * b * c)} m³\nSurface area: ${numberText(2 * (a * b + b * c + a * c))} m²\nSpace diagonal: ${numberText(Math.hypot(a, b, c))} m`;
      const sorted = [a, b, c].sort((x, y) => y - x), [x, y, z] = sorted;
      if (z <= x - y) throw new Error('These sides do not form a nondegenerate triangle.');
      const area = .25 * Math.sqrt((x + (y + z)) * (z - (x - y)) * (z + (x - y)) * (x + (y - z)));
      return `Area: ${numberText(area)} m²\nPerimeter: ${numberText(a + b + c)} m`;
    });
}
function loanCalculator(root) {
  formTool(root, 'Loan calculator', 'Fixed-rate, fully amortizing loan with monthly payments. APR is nominal annual interest compounded monthly. Excludes fees, insurance, and taxes; currency-neutral.',
    [num('principal', 'Principal (currency units)', 200000, { min: 0 }), num('apr', 'Annual interest rate (%)', 6, { min: 0 }), num('years', 'Term (years; whole months)', 30, { min: 0 })], v => {
      positive(v.principal, 'Principal'); positive(v.apr, 'Annual interest rate', true); positive(v.years, 'Term');
      const n = Math.round(v.years * 12);
      if (Math.abs(v.years * 12 - n) > 1e-8) throw new Error('The term must be an exact number of months (for example, 1.5 years).');
      integer(n, 'Number of monthly payments', 1, 12000);
      const r = v.apr / 1200, payment = r === 0 ? v.principal / n : v.principal * r / -Math.expm1(-n * Math.log1p(r));
      const total = payment * n;
      if (![payment, total].every(Number.isFinite)) throw new Error('Loan values are too large.');
      return lines(`Monthly payment: ${payment.toFixed(2)}`, `Number of payments: ${n}`, `Total paid: ${total.toFixed(2)}`, `Total interest: ${(total - v.principal).toFixed(2)}`, 'Amounts are currency units; totals use unrounded payments.');
    });
}
function tipSplitter(root) {
  formTool(root, 'Tip splitter', 'Split a bill, tax, and tip equally. Tax is entered as an amount; choose whether tip includes tax.',
    [num('bill', 'Bill before tax (currency units)', 80, { min: 0 }), num('tax', 'Tax amount', 8, { min: 0 }), num('tip', 'Tip (%)', 18, { min: 0 }), num('people', 'People', 4, { min: 1, step: 1 }), select('base', 'Tip basis', [['before', 'Before tax'], ['after', 'After tax']])], v => {
      positive(v.bill, 'Bill', true); positive(v.tax, 'Tax', true); positive(v.tip, 'Tip', true); integer(v.people, 'People', 1, 1000000);
      const tip = (v.bill + (v.base === 'after' ? v.tax : 0)) * v.tip / 100, total = v.bill + v.tax + tip;
      if (!Number.isFinite(total) || total > Number.MAX_SAFE_INTEGER / 100) throw new Error('Bill is too large for cent-accurate splitting.');
      const cents = Math.round(total * 100), low = Math.floor(cents / v.people), extra = cents % v.people;
      return lines(`Tip: ${tip.toFixed(2)}`, `Total: ${(cents / 100).toFixed(2)}`, `Average per person: ${(cents / 100 / v.people).toFixed(2)}`,
        extra ? `Exact cent split: ${extra} pay ${((low + 1) / 100).toFixed(2)}; ${v.people - extra} pay ${(low / 100).toFixed(2)}.` : `Each person pays ${(low / 100).toFixed(2)}.`);
    }, 'Split bill');
}
function parseDate(raw, label) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) throw new Error(`${label} must be a date in YYYY-MM-DD format.`);
  const y = Number(match[1]), m = Number(match[2]), d = Number(match[3]);
  if (y < 1) throw new Error(`${label}: year must be 0001–9999.`);
  const date = new Date(0); date.setUTCHours(0, 0, 0, 0); date.setUTCFullYear(y, m - 1, d);
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) throw new Error(`${label} is not a valid calendar date.`);
  return date;
}
function dateCalculator(root) {
  const today = new Date().toISOString().slice(0, 10);
  formTool(root, 'Date calculator', 'Calendar-day arithmetic uses UTC, avoiding daylight-saving errors. Difference is end minus start, not inclusive of both endpoints. In add mode, end date is ignored.',
    [select('mode', 'Operation', [['difference', 'Days between dates'], ['add', 'Add / subtract days']]), { name: 'start', label: 'Start date', type: 'date', value: today }, { name: 'end', label: 'End date', type: 'date', value: today }, num('days', 'Days to add (negative to subtract)', 30, { step: 1 })], v => {
      const start = parseDate(v.start, 'Start date');
      if (v.mode === 'difference') { const end = parseDate(v.end, 'End date'), days = (end - start) / 86400000; return `${days} days\n${numberText(days / 7)} weeks\n${days * 24} hours (calendar-day equivalent)`; }
      integer(v.days, 'Days', -3652058, 3652058);
      start.setUTCDate(start.getUTCDate() + v.days);
      if (start.getUTCFullYear() < 1 || start.getUTCFullYear() > 9999) throw new Error('Result must lie between years 0001 and 9999.');
      return `${start.toISOString().slice(0, 10)}\n${start.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })}`;
    });
}
const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
function toRoman(n) { let result = ''; for (const [value, symbol] of ROMAN) while (n >= value) { result += symbol; n -= value; } return result; }
function romanNumerals(root) {
  formTool(root, 'Roman numerals', 'Convert canonical Roman numerals and integers from 1 through 3,999. Roman input is case-insensitive.',
    [select('mode', 'Direction', [['to', 'Integer → Roman'], ['from', 'Roman → integer']]), text('value', 'Number or Roman numeral', '2026')], v => {
      if (v.mode === 'to') { if (!/^\d+$/.test(v.value)) throw new Error('Enter a whole number from 1 to 3,999.'); return toRoman(integer(Number(v.value), 'Number', 1, 3999)); }
      const roman = v.value.toUpperCase();
      if (!roman || roman.length > 15 || !/^[MDCLXVI]+$/.test(roman)) throw new Error('Enter a Roman numeral using I, V, X, L, C, D, M.');
      let offset = 0, n = 0;
      for (const [value, symbol] of ROMAN) while (roman.slice(offset, offset + symbol.length) === symbol) { n += value; offset += symbol.length; }
      if (offset !== roman.length || n > 3999 || toRoman(n) !== roman) throw new Error('Invalid Roman numeral. Use canonical notation, for example IV, IX, or MCMXCIV.');
      return String(n);
    }, 'Convert');
}

function motion(root) {
  formTool(root, 'Motion', 'One-dimensional motion with constant acceleration. Positive and negative signs indicate direction.',
    [num('u', 'Initial velocity u (m/s)', 0), num('a', 'Acceleration a (m/s²)', 9.80665), num('t', 'Elapsed time t (s)', 2, { min: 0 })], v => {
      positive(v.t, 'Time', true);
      const velocity = v.u + v.a * v.t, displacement = v.u * v.t + .5 * v.a * v.t ** 2;
      let distance = Math.abs(displacement);
      if (v.a !== 0) { const turn = -v.u / v.a; if (turn > 0 && turn < v.t) { const first = v.u * turn + .5 * v.a * turn ** 2; distance = Math.abs(first) + Math.abs(displacement - first); } }
      return `Final velocity v = u + at: ${numberText(velocity)} m/s\nDisplacement s = ut + ½at²: ${numberText(displacement)} m\nDistance traveled: ${numberText(distance)} m\nAverage velocity: ${v.t ? numberText(displacement / v.t) + ' m/s' : 'undefined at t = 0'}`;
    });
}
function force(root) {
  formTool(root, 'Force', 'Newton’s second law F = ma, weight W = mg, and linear momentum p = mv. Mass must be positive.',
    [num('m', 'Mass m (kg)', 10, { min: 0 }), num('a', 'Acceleration a (m/s²)', 2), num('g', 'Gravitational acceleration g (m/s²)', 9.80665, { min: 0 }), num('v', 'Velocity v (m/s)', 3)], v => {
      positive(v.m, 'Mass'); positive(v.g, 'Gravity', true);
      return `Net force: ${numberText(v.m * v.a)} N\nWeight: ${numberText(v.m * v.g)} N\nMomentum: ${numberText(v.m * v.v)} kg·m/s`;
    });
}
function energy(root) {
  formTool(root, 'Energy', 'Classical mechanical energy. Height is measured from your chosen zero-potential reference; spring displacement may be signed.',
    [num('m', 'Mass m (kg)', 2, { min: 0 }), num('v', 'Speed v (m/s)', 3, { min: 0 }), num('h', 'Height h (m)', 5), num('g', 'Gravity g (m/s²)', 9.80665, { min: 0 }), num('k', 'Spring constant k (N/m)', 100, { min: 0 }), num('x', 'Spring displacement x (m)', .1)], v => {
      positive(v.m, 'Mass'); positive(v.v, 'Speed', true); positive(v.g, 'Gravity', true); positive(v.k, 'Spring constant', true);
      const kinetic = .5 * v.m * v.v ** 2, potential = v.m * v.g * v.h, spring = .5 * v.k * v.x ** 2;
      return `Kinetic energy ½mv²: ${numberText(kinetic)} J\nGravitational potential mgh: ${numberText(potential)} J\nSpring potential ½kx²: ${numberText(spring)} J\nCombined energy: ${numberText(kinetic + potential + spring)} J`;
    });
}
function gravity(root) {
  formTool(root, 'Gravity', 'Newtonian point masses / spherical bodies. Distance is center-to-center; circular orbit assumes the central mass dominates. G = 6.67430 × 10⁻¹¹ m³·kg⁻¹·s⁻².',
    [num('m1', 'Central mass M (kg)', 5.9722e24, { min: 0 }), num('m2', 'Test mass m (kg)', 1, { min: 0 }), num('r', 'Center-to-center distance r (m)', 6371000, { min: 0 })], v => {
      positive(v.m1, 'Central mass'); positive(v.m2, 'Test mass'); positive(v.r, 'Distance');
      const mu = G * v.m1;
      return `Attractive force GMm/r²: ${numberText(mu / v.r / v.r * v.m2)} N\nAcceleration GM/r²: ${numberText(mu / v.r / v.r)} m/s²\nPotential energy −GMm/r: ${numberText(-mu / v.r * v.m2)} J\nCircular orbital speed: ${numberText(Math.sqrt(mu / v.r))} m/s\nEscape speed: ${numberText(Math.sqrt(2 * mu / v.r))} m/s\nCircular orbital period: ${numberText(2 * PI * v.r / Math.sqrt(mu / v.r))} s`;
    });
}
function waves(root) {
  formTool(root, 'Waves', 'v = fλ. Solve for one wave quantity using the other two; the selected unknown’s input is ignored.',
    [select('solve', 'Solve for', [['speed', 'Wave speed v'], ['frequency', 'Frequency f'], ['wavelength', 'Wavelength λ']]), num('speed', 'Wave speed v (m/s)', 343, { min: 0 }), num('frequency', 'Frequency f (Hz)', 440, { min: 0 }), num('wavelength', 'Wavelength λ (m)', .78, { min: 0 })], v => {
      let speed = v.speed, frequency = v.frequency, wavelength = v.wavelength;
      if (v.solve === 'speed') { positive(frequency, 'Frequency'); positive(wavelength, 'Wavelength'); speed = frequency * wavelength; }
      else if (v.solve === 'frequency') { positive(speed, 'Speed'); positive(wavelength, 'Wavelength'); frequency = speed / wavelength; }
      else { positive(speed, 'Speed'); positive(frequency, 'Frequency'); wavelength = speed / frequency; }
      return `Speed: ${numberText(speed)} m/s\nFrequency: ${numberText(frequency)} Hz\nWavelength: ${numberText(wavelength)} m\nPeriod: ${numberText(1 / frequency)} s\nAngular frequency: ${numberText(2 * PI * frequency)} rad/s`;
    });
}
function electricity(root) {
  formTool(root, 'Electricity', 'Ohm’s law V = IR for an ideal resistor. Select the unknown; that input is ignored. Energy assumes constant power over the given time.',
    [select('solve', 'Solve for', [['current', 'Current I'], ['voltage', 'Voltage V'], ['resistance', 'Resistance R']]), num('voltage', 'Voltage V (V)', 12), num('current', 'Current I (A)', 2), num('resistance', 'Resistance R (Ω)', 6, { min: 0 }), num('time', 'Duration (s)', 60, { min: 0 })], v => {
      let voltage = v.voltage, current = v.current, resistance = v.resistance;
      positive(v.time, 'Time', true);
      if (v.solve === 'current') { positive(resistance, 'Resistance'); current = voltage / resistance; }
      else if (v.solve === 'voltage') { positive(resistance, 'Resistance'); voltage = current * resistance; }
      else {
        if (current === 0) throw new Error('Cannot infer resistance from zero current.');
        resistance = voltage / current; positive(resistance, 'Calculated resistance');
      }
      const power = voltage * current;
      return `Voltage: ${numberText(voltage)} V\nCurrent: ${numberText(current)} A\nResistance: ${numberText(resistance)} Ω\nPower VI: ${numberText(power)} W\nEnergy Pt: ${numberText(power * v.time)} J\nEnergy: ${numberText(power * v.time / 3.6e6)} kWh`;
    });
}
function optics(root) {
  formTool(root, 'Optics', 'Thin lens: 1/f = 1/u + 1/v (real object u > 0; converging f > 0, diverging f < 0). Refraction angles are measured from the normal.',
    [select('mode', 'Calculation', [['lens', 'Thin lens'], ['snell', 'Refraction (Snell’s law)']]), num('f', 'Focal length f (m)', .1), num('u', 'Object distance u (m)', .3), num('n1', 'Incident refractive index n₁', 1, { min: 0 }), num('n2', 'Transmitted refractive index n₂', 1.5, { min: 0 }), num('angle', 'Incidence angle (degrees, 0–90)', 30, { min: 0, max: 90 })], v => {
      if (v.mode === 'lens') {
        if (!v.f) throw new Error('Focal length cannot be zero.'); positive(v.u, 'Object distance');
        if (Math.abs(v.u - v.f) <= Number.EPSILON * Math.max(Math.abs(v.u), Math.abs(v.f)) * 4) return 'Object is at the focal point: outgoing rays are parallel; image is at infinity.\nMagnification is not finite.';
        const image = v.f * v.u / (v.u - v.f), magnification = -image / v.u;
        return `Image distance v: ${numberText(image)} m\nMagnification −v/u: ${numberText(magnification)}\nImage: ${image > 0 ? 'real' : 'virtual'}, ${magnification < 0 ? 'inverted' : 'upright'}`;
      }
      positive(v.n1, 'Incident index'); positive(v.n2, 'Transmitted index');
      const sine = v.n1 / v.n2 * Math.sin(v.angle * PI / 180);
      const critical = v.n1 > v.n2 ? `Critical angle: ${numberText(Math.asin(v.n2 / v.n1) * 180 / PI)}°` : 'No total-internal-reflection critical angle from this medium.';
      if (sine > 1 + 1e-14) return `Total internal reflection; no refracted ray.\n${critical}`;
      return `Refraction angle: ${numberText(Math.asin(Math.min(1, sine)) * 180 / PI)}°\nReflection angle: ${numberText(v.angle)}°\n${critical}`;
    });
}
function pressure(root) {
  formTool(root, 'Pressure', 'Contact pressure P = F/A and static fluid pressure P = P₀ + ρgh. Both results are calculated independently.',
    [num('force', 'Normal force F (N)', 100, { min: 0 }), num('area', 'Contact area A (m²)', .01, { min: 0 }), num('rho', 'Fluid density ρ (kg/m³)', 1000, { min: 0 }), num('depth', 'Depth h (m)', 10, { min: 0 }), num('g', 'Gravity g (m/s²)', 9.80665, { min: 0 }), num('ambient', 'Surface absolute pressure P₀ (Pa)', 101325, { min: 0 })], v => {
      positive(v.force, 'Force', true); positive(v.area, 'Area'); positive(v.rho, 'Density'); positive(v.depth, 'Depth', true); positive(v.g, 'Gravity', true); positive(v.ambient, 'Surface pressure', true);
      const contact = v.force / v.area, gauge = v.rho * v.g * v.depth, absolute = v.ambient + gauge;
      return `Contact pressure F/A: ${numberText(contact)} Pa (${numberText(contact / 1000)} kPa)\nHydrostatic gauge pressure: ${numberText(gauge)} Pa\nHydrostatic absolute pressure: ${numberText(absolute)} Pa\nAbsolute pressure: ${numberText(absolute / 101325)} atm`;
    });
}
function density(root) {
  formTool(root, 'Density', 'ρ = m/V. Choose the unknown; its input is ignored. 1 g/cm³ = 1,000 kg/m³.',
    [select('solve', 'Solve for', [['density', 'Density ρ'], ['mass', 'Mass m'], ['volume', 'Volume V']]), num('rho', 'Density ρ (kg/m³)', 1000, { min: 0 }), num('mass', 'Mass m (kg)', 2, { min: 0 }), num('volume', 'Volume V (m³)', .002, { min: 0 })], v => {
      let rho = v.rho, mass = v.mass, volume = v.volume;
      if (v.solve === 'density') { positive(mass, 'Mass'); positive(volume, 'Volume'); rho = mass / volume; }
      else if (v.solve === 'mass') { positive(rho, 'Density'); positive(volume, 'Volume'); mass = rho * volume; }
      else { positive(rho, 'Density'); positive(mass, 'Mass'); volume = mass / rho; }
      return `Density: ${numberText(rho)} kg/m³\nDensity: ${numberText(rho / 1000)} g/cm³\nMass: ${numberText(mass)} kg\nVolume: ${numberText(volume)} m³\nVolume: ${numberText(volume * 1000)} L`;
    });
}
function temperature(root) {
  formTool(root, 'Temperature', 'Convert absolute temperatures. Values below absolute zero are rejected; these are not temperature-difference conversions.',
    [num('value', 'Temperature', 20), select('unit', 'Input scale', [['C', 'Celsius (°C)'], ['F', 'Fahrenheit (°F)'], ['K', 'Kelvin (K)']], 'C')], v => {
      const k = kelvin(v.value, v.unit);
      return `Celsius: ${numberText(fromKelvin(k, 'C'))} °C\nFahrenheit: ${numberText(fromKelvin(k, 'F'))} °F\nKelvin: ${numberText(k)} K`;
    }, 'Convert');
}
function idealGas(root) {
  formTool(root, 'Ideal gas', 'PV = nRT with R = 8.31446261815324 J/(mol·K). Use absolute pressure and absolute temperature; 1 L = 0.001 m³. Selected unknown’s input is ignored.',
    [select('solve', 'Solve for', [['P', 'Pressure P'], ['V', 'Volume V'], ['n', 'Amount n'], ['T', 'Temperature T']]), num('P', 'Absolute pressure P (Pa)', 101325, { min: 0 }), num('V', 'Volume V (m³)', .024, { min: 0 }), num('n', 'Amount n (mol)', 1, { min: 0 }), num('T', 'Temperature T (K)', 293.15, { min: 0 })], v => {
      let { P, V, n, T } = v;
      for (const [key, label] of [['P', 'Pressure'], ['V', 'Volume'], ['n', 'Amount'], ['T', 'Temperature']]) if (v.solve !== key) positive(v[key], label);
      if (v.solve === 'P') P = n * R * T / V;
      else if (v.solve === 'V') V = n * R * T / P;
      else if (v.solve === 'n') n = P * V / (R * T);
      else T = P * V / (n * R);
      return `Pressure: ${numberText(P)} Pa (${numberText(P / 101325)} atm)\nVolume: ${numberText(V)} m³ (${numberText(V * 1000)} L)\nAmount: ${numberText(n)} mol\nTemperature: ${numberText(T)} K (${numberText(T - 273.15)} °C)`;
    });
}
function halfLife(root) {
  formTool(root, 'Half-life', 'Exponential decay: N = N₀·2^(−t/T½). Amounts may use any consistent unit; all times are seconds. Selected unknown’s input is ignored.',
    [select('solve', 'Solve for', [['remaining', 'Remaining amount N'], ['time', 'Elapsed time t'], ['half', 'Half-life T½']]), num('initial', 'Initial amount N₀ (consistent units)', 100, { min: 0 }), num('remaining', 'Remaining amount N (same units)', 25, { min: 0 }), num('time', 'Elapsed time t (s)', 20, { min: 0 }), num('half', 'Half-life T½ (s)', 10, { min: 0 })], v => {
      positive(v.initial, 'Initial amount'); let remaining = v.remaining, time = v.time, half = v.half;
      if (v.solve === 'remaining') { positive(time, 'Time', true); positive(half, 'Half-life'); remaining = v.initial * Math.exp(-LN2 * time / half); }
      else {
        positive(remaining, 'Remaining amount');
        if (remaining > v.initial) throw new Error('Remaining amount cannot exceed the initial amount in a decay process.');
        const logRatio = Math.log(v.initial) - Math.log(remaining);
        if (v.solve === 'time') { positive(half, 'Half-life'); time = half * logRatio / LN2; }
        else { positive(time, 'Time'); if (remaining === v.initial) throw new Error('No decay observed: no finite half-life can be inferred.'); half = time * LN2 / logRatio; }
      }
      return `Remaining amount: ${numberText(remaining)}\nFraction remaining: ${numberText(remaining / v.initial * 100)}%\nElapsed time: ${numberText(time)} s\nHalf-life: ${numberText(half)} s\nDecay constant λ: ${numberText(LN2 / half)} s⁻¹\nActivity λN: ${numberText(LN2 / half * remaining)} amount units/s${remaining === 0 ? '\nRemaining amount underflows floating-point precision (mathematically approaches zero).' : ''}`;
    });
}
const CONSTANTS = [
  ['Speed of light in vacuum', 'c', C, 'm/s', 'Exact'],
  ['Planck constant', 'h', H, 'J·s', 'Exact'],
  ['Reduced Planck constant', 'ℏ', H / (2 * PI), 'J·s', 'h/(2π)'],
  ['Elementary charge', 'e', 1.602176634e-19, 'C', 'Exact'],
  ['Boltzmann constant', 'kB', 1.380649e-23, 'J/K', 'Exact'],
  ['Avogadro constant', 'NA', 6.02214076e23, 'mol⁻¹', 'Exact'],
  ['Molar gas constant', 'R', R, 'J/(mol·K)', 'Exact; NA·kB'],
  ['Newtonian gravitational constant', 'G', G, 'm³/(kg·s²)', 'CODATA 2022; uncertainty ±0.00015 × 10⁻¹¹'],
  ['Standard gravity', 'g0', 9.80665, 'm/s²', 'Exact conventional value'],
  ['Standard atmosphere', 'atm', 101325, 'Pa', 'Exact'],
  ['Electron mass', 'me', 9.1093837139e-31, 'kg', 'CODATA 2022; measured'],
  ['Proton mass', 'mp', 1.67262192595e-27, 'kg', 'CODATA 2022; measured'],
  ['Neutron mass', 'mn', 1.67492750056e-27, 'kg', 'CODATA 2022; measured'],
  ['Vacuum electric permittivity', 'ε0', 8.8541878188e-12, 'F/m', 'CODATA 2022; measured'],
  ['Vacuum magnetic permeability', 'μ0', 1.25663706127e-6, 'N/A²', 'CODATA 2022; measured'],
  ['Coulomb constant', 'ke', 8.9875517862e9, 'N·m²/C²', 'Derived; approximately'],
  ['Fine-structure constant', 'α', 7.2973525643e-3, 'dimensionless', 'CODATA 2022; measured'],
  ['Stefan–Boltzmann constant', 'σ', 5.670374419e-8, 'W/(m²·K⁴)', 'Derived; rounded'],
  ['Wien displacement constant', 'b', 2.897771955e-3, 'm·K', 'Derived; rounded'],
  ['Atomic mass constant', 'u', 1.66053906892e-27, 'kg', 'CODATA 2022; measured'],
  ['Rydberg constant', 'R∞', 10973731.568157, 'm⁻¹', 'CODATA 2022; measured'],
  ['Bohr radius', 'a0', 5.29177210544e-11, 'm', 'CODATA 2022; measured']
];
function constants(root) {
  const search = el('input', { type: 'search', placeholder: 'Name, symbol, or unit…', 'aria-label': 'Filter physical constants' });
  const body = el('tbody');
  const status = el('p', { class: 'output', 'aria-live': 'polite' });
  const update = () => {
    const q = search.value.trim().toLowerCase(), rows = CONSTANTS.filter(row => row.join(' ').toLowerCase().includes(q));
    body.replaceChildren(...rows.map(([name, symbol, value, unit, note]) => el('tr', {}, el('td', {}, name), el('td', {}, symbol), el('td', {}, String(value)), el('td', {}, unit), el('td', {}, note))));
    status.textContent = `${rows.length} constant${rows.length === 1 ? '' : 's'} found.`;
  };
  root.replaceChildren(el('section', { class: 'panel' }, el('h2', {}, 'Physical constants'), el('p', {}, 'SI values; exact defining constants and selected CODATA 2022 recommended values. Measured values are not exact.'), el('label', { class: 'field' }, 'Search constants', search), status,
    el('div', { style: 'overflow-x:auto' }, el('table', { class: 'constants-table' }, el('caption', {}, 'Physical constants in SI units'), el('thead', {}, el('tr', {}, ...['Name', 'Symbol', 'Value', 'SI unit', 'Notes'].map(x => el('th', { scope: 'col' }, x)))), body)),
    el('p', {}, el('a', { href: 'https://physics.nist.gov/cuu/Constants/', target: '_blank', rel: 'noopener noreferrer' }, 'Reference: NIST / CODATA'))));
  search.addEventListener('input', update); update();
}
// Relative atomic masses are representative rounded values; [n] is a selected isotope mass number.
const ELEMENT_DATA = `H|Hydrogen|1.008
He|Helium|4.002602
Li|Lithium|6.94
Be|Beryllium|9.0121831
B|Boron|10.81
C|Carbon|12.011
N|Nitrogen|14.007
O|Oxygen|15.999
F|Fluorine|18.998403163
Ne|Neon|20.1797
Na|Sodium|22.98976928
Mg|Magnesium|24.305
Al|Aluminium|26.9815385
Si|Silicon|28.085
P|Phosphorus|30.973761998
S|Sulfur|32.06
Cl|Chlorine|35.45
Ar|Argon|39.95
K|Potassium|39.0983
Ca|Calcium|40.078
Sc|Scandium|44.955908
Ti|Titanium|47.867
V|Vanadium|50.9415
Cr|Chromium|51.9961
Mn|Manganese|54.938044
Fe|Iron|55.845
Co|Cobalt|58.933194
Ni|Nickel|58.6934
Cu|Copper|63.546
Zn|Zinc|65.38
Ga|Gallium|69.723
Ge|Germanium|72.630
As|Arsenic|74.921595
Se|Selenium|78.971
Br|Bromine|79.904
Kr|Krypton|83.798
Rb|Rubidium|85.4678
Sr|Strontium|87.62
Y|Yttrium|88.90584
Zr|Zirconium|91.224
Nb|Niobium|92.90637
Mo|Molybdenum|95.95
Tc|Technetium|[98]
Ru|Ruthenium|101.07
Rh|Rhodium|102.90550
Pd|Palladium|106.42
Ag|Silver|107.8682
Cd|Cadmium|112.414
In|Indium|114.818
Sn|Tin|118.710
Sb|Antimony|121.760
Te|Tellurium|127.60
I|Iodine|126.90447
Xe|Xenon|131.293
Cs|Caesium|132.90545196
Ba|Barium|137.327
La|Lanthanum|138.90547
Ce|Cerium|140.116
Pr|Praseodymium|140.90766
Nd|Neodymium|144.242
Pm|Promethium|[145]
Sm|Samarium|150.36
Eu|Europium|151.964
Gd|Gadolinium|157.25
Tb|Terbium|158.92535
Dy|Dysprosium|162.500
Ho|Holmium|164.93033
Er|Erbium|167.259
Tm|Thulium|168.93422
Yb|Ytterbium|173.045
Lu|Lutetium|174.9668
Hf|Hafnium|178.49
Ta|Tantalum|180.94788
W|Tungsten|183.84
Re|Rhenium|186.207
Os|Osmium|190.23
Ir|Iridium|192.217
Pt|Platinum|195.084
Au|Gold|196.966569
Hg|Mercury|200.592
Tl|Thallium|204.38
Pb|Lead|207.2
Bi|Bismuth|208.98040
Po|Polonium|[209]
At|Astatine|[210]
Rn|Radon|[222]
Fr|Francium|[223]
Ra|Radium|[226]
Ac|Actinium|[227]
Th|Thorium|232.0377
Pa|Protactinium|231.03588
U|Uranium|238.02891
Np|Neptunium|[237]
Pu|Plutonium|[244]
Am|Americium|[243]
Cm|Curium|[247]
Bk|Berkelium|[247]
Cf|Californium|[251]
Es|Einsteinium|[252]
Fm|Fermium|[257]
Md|Mendelevium|[258]
No|Nobelium|[259]
Lr|Lawrencium|[266]
Rf|Rutherfordium|[267]
Db|Dubnium|[268]
Sg|Seaborgium|[269]
Bh|Bohrium|[270]
Hs|Hassium|[269]
Mt|Meitnerium|[278]
Ds|Darmstadtium|[281]
Rg|Roentgenium|[282]
Cn|Copernicium|[285]
Nh|Nihonium|[286]
Fl|Flerovium|[289]
Mc|Moscovium|[290]
Lv|Livermorium|[293]
Ts|Tennessine|[294]
Og|Oganesson|[294]`;
const ELEMENTS = ELEMENT_DATA.split('\n').map((line, index) => {
  const [symbol, name, mass] = line.split('|'), z = index + 1;
  let period, group, column, row;
  if (z <= 2) { period = 1; group = z === 1 ? 1 : 18; }
  else if (z <= 10) { period = 2; group = z <= 4 ? z - 2 : z + 8; }
  else if (z <= 18) { period = 3; group = z <= 12 ? z - 10 : z; }
  else if (z <= 36) { period = 4; group = z - 18; }
  else if (z <= 54) { period = 5; group = z - 36; }
  else if (z <= 86) { period = 6; group = z <= 56 ? z - 54 : z >= 72 ? z - 68 : null; }
  else { period = 7; group = z <= 88 ? z - 86 : z >= 104 ? z - 100 : null; }
  const lanthanide = z >= 57 && z <= 71, actinide = z >= 89 && z <= 103;
  column = lanthanide ? z - 54 : actinide ? z - 86 : group;
  row = lanthanide ? 9 : actinide ? 10 : period;
  let category;
  if (lanthanide) category = 'Lanthanide';
  else if (actinide) category = 'Actinide';
  else if (group === 18) category = 'Noble gas';
  else if (group === 17) category = 'Halogen';
  else if ([5, 14, 32, 33, 51, 52].includes(z)) category = 'Metalloid';
  else if ([1, 6, 7, 8, 15, 16, 34].includes(z)) category = 'Other nonmetal';
  else if (group === 1) category = 'Alkali metal';
  else if (group === 2) category = 'Alkaline earth metal';
  else if (group >= 3 && group <= 12) category = 'Transition metal';
  else category = 'Post-transition metal';
  return { z, symbol, name, mass, period, group, column, row, category };
});
function periodicTable(root) {
  const search = el('input', { type: 'search', 'aria-label': 'Find element by name, symbol, or atomic number', placeholder: 'Hydrogen, Fe, 79…' });
  const category = el('select', { 'aria-label': 'Element category' }, el('option', { value: '' }, 'All categories'), [...new Set(ELEMENTS.map(e => e.category))].sort().map(x => el('option', { value: x }, x)));
  const detail = el('pre', { class: 'output', 'aria-live': 'polite', style: 'white-space:pre-wrap' });
  const count = el('p', { 'aria-live': 'polite' });
  const grid = el('div', { class: 'periodic-table', style: 'display:grid;grid-template-columns:repeat(18,minmax(48px,1fr));gap:4px;min-width:970px' });
  let selected = 1;
  const buttons = [];
  const pick = element => {
    selected = element.z;
    for (const button of buttons) button.setAttribute('aria-pressed', String(Number(button.getAttribute('data-z')) === selected));
    const state = [35, 80].includes(element.z) ? 'Liquid' : [1, 2, 7, 8, 9, 10, 17, 18, 36, 54, 86].includes(element.z) ? 'Gas' : element.z >= 104 || [85, 87, 100, 101, 102, 103].includes(element.z) ? 'Uncertain / predicted; not listed' : 'Solid';
    detail.textContent = lines(`${element.z}. ${element.name} (${element.symbol})`, `Atomic number / protons: ${element.z}`, `Electrons in a neutral atom: ${element.z}`,
      `${element.mass.startsWith('[') ? 'Selected isotope mass number (not standard atomic weight)' : 'Representative relative atomic mass (dimensionless)'}: ${element.mass}`,
      `Period: ${element.period} | Group: ${element.group || 'f-block (group convention varies)'}`, `Family: ${element.category}`, `State near 20 °C and 1 atm: ${state}`,
      'Atomic weights vary with isotope composition. Neutron count requires a particular isotope. Superheavy chemical families are placement-based; properties may be predicted.');
  };
  for (let group = 1; group <= 18; group++) grid.append(el('span', { style: `grid-column:${group};grid-row:1;text-align:center`, 'aria-hidden': 'true' }, group));
  for (const element of ELEMENTS) {
    const button = el('button', { type: 'button', class: 'element action secondary', style: `grid-column:${element.column};grid-row:${element.row + 1};padding:5px;min-width:0`, title: `${element.z}: ${element.name} — ${element.category}`, 'aria-label': `${element.z} ${element.name}, ${element.symbol}`, 'data-z': element.z, 'aria-pressed': 'false', onclick: () => pick(element) },
      el('small', {}, element.z), el('br'), el('strong', {}, element.symbol));
    buttons.push(button); grid.append(button);
  }
  grid.append(el('span', { style: 'grid-column:3;grid-row:7;text-align:center', title: 'Lanthanides shown below' }, '57–71'), el('span', { style: 'grid-column:3;grid-row:8;text-align:center', title: 'Actinides shown below' }, '89–103'));
  const update = () => {
    const q = search.value.trim().toLowerCase(); let matches = 0;
    ELEMENTS.forEach((e, i) => {
      const match = (!q || e.name.toLowerCase().includes(q) || e.symbol.toLowerCase() === q || String(e.z) === q || (q === 'aluminum' && e.z === 13) || (q === 'cesium' && e.z === 55)) && (!category.value || e.category === category.value);
      buttons[i].style.opacity = match ? '1' : '.2';
      buttons[i].disabled = !match;
      if (match) matches++;
    });
    count.textContent = `${matches} of 118 elements match. Select an enabled element for details.`;
    if (matches === 1) pick(ELEMENTS[buttons.findIndex(b => !b.disabled)]);
  };
  root.replaceChildren(el('section', { class: 'panel' }, el('h2', {}, 'Periodic table'), el('p', {}, 'Explore all 118 elements. The separate rows contain the lanthanides and actinides.'),
    el('div', { class: 'two-col' }, el('label', { class: 'field' }, 'Search elements', search), el('label', { class: 'field' }, 'Family', category)), count, el('div', { style: 'overflow-x:auto' }, grid), detail));
  search.addEventListener('input', update); category.addEventListener('change', update); pick(ELEMENTS[0]); update();
}
function physicsHub(root) {
  const panel = el('section', { class: 'panel' }, el('h2', {}, 'Physics hub — pendulum laboratory'),
    el('p', {}, 'Explore a nonlinear pendulum in SI units: θ″ = −(g/L)sin θ − bθ′. Change controls and reset to release the bob from rest. Damping b is per second. Simulation time advances at real-time speed while visible.'));
  const controls = el('div', { class: 'tool-form two-col' });
  const inputs = {};
  for (const spec of [num('length', 'Length L (m)', 2, { min: .1, max: 10 }), num('mass', 'Bob mass m (kg)', 1, { min: .01, max: 100 }), num('gravity', 'Gravity g (m/s²)', 9.80665, { min: 0, max: 100 }), num('angle', 'Release angle (degrees)', 35, { min: -175, max: 175 }), num('damping', 'Damping b (s⁻¹)', .02, { min: 0, max: 5 })]) {
    const item = field(spec); inputs[spec.name] = item.input; controls.append(item.wrapper);
  }
  const canvas = el('canvas', { width: 720, height: 380, style: 'display:block;width:100%;max-width:900px;height:auto;border:1px solid currentColor;border-radius:8px', role: 'img', 'aria-label': 'Animated pendulum with pivot, rod, and bob. Current angle, speed, and energy are reported below.' }, 'Your browser must support Canvas to display the pendulum.');
  const output = el('pre', { class: 'output', 'aria-live': 'off', style: 'white-space:pre-wrap' });
  const status = el('p', { 'aria-live': 'polite' }, 'Paused. Press Start to run.');
  const start = el('button', { type: 'button', class: 'action' }, 'Start');
  const reset = el('button', { type: 'button', class: 'action secondary' }, 'Reset');
  panel.append(controls, el('div', { class: 'two-col' }, start, reset), status, canvas, output,
    el('p', {}, 'The small-angle period is only an approximation; large swings take longer. Mass changes energy but not the ideal pendulum’s trajectory. Numerical integration uses fixed 1/240 s RK4 steps.'));
  root.replaceChildren(panel);
  let ctx;
  try { ctx = canvas.getContext('2d'); } catch { ctx = null; }
  if (!ctx) { status.textContent = 'Canvas 2D is not supported by this browser.'; start.disabled = true; reset.disabled = true; return; }
  let state = { theta: 35 * PI / 180, omega: 0, time: 0 };
  let config = { length: 2, mass: 1, gravity: 9.80665, damping: .02 };
  let running = false, frame = 0, last = 0, accumulator = 0, lastOutput = -Infinity;
  function readConfig() {
    const ranges = { length: [.1, 10], mass: [.01, 100], gravity: [0, 100], angle: [-175, 175], damping: [0, 5] }, next = {};
    for (const [key, input] of Object.entries(inputs)) {
      const value = Number(input.value), [min, max] = ranges[key];
      if (!input.value.trim() || !Number.isFinite(value) || value < min || value > max) throw new Error(`${key} must be between ${min} and ${max}.`);
      next[key] = value;
    }
    return next;
  }
  function draw(forceOutput = false) {
    const { theta, omega, time } = state, { length, mass, gravity } = config;
    const w = canvas.width, pivotX = w / 2, pivotY = 45, pixels = 250 * Math.sqrt(length / 10);
    const x = pivotX + pixels * Math.sin(theta), y = pivotY + pixels * Math.cos(theta);
    ctx.clearRect(0, 0, w, canvas.height);
    ctx.fillStyle = '#f5f7fb'; ctx.fillRect(0, 0, w, canvas.height);
    ctx.strokeStyle = '#64748b'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(pivotX, pivotY); ctx.lineTo(pivotX, pivotY + pixels); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(pivotX - 55, pivotY); ctx.lineTo(pivotX + 55, pivotY); ctx.moveTo(pivotX, pivotY); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = '#2563eb'; ctx.beginPath(); ctx.arc(x, y, 10 + 4 * Math.log10(mass + 1), 0, 2 * PI); ctx.fill();
    ctx.fillStyle = '#0f172a'; ctx.font = '16px sans-serif'; ctx.fillText(`t = ${time.toFixed(2)} s`, 20, 28); ctx.fillText(`L = ${length} m   g = ${gravity} m/s²`, 20, 355);
    if (forceOutput || time - lastOutput >= .15) {
      lastOutput = time;
      const kinetic = .5 * mass * (length * omega) ** 2, potential = mass * gravity * length * (1 - Math.cos(theta));
      output.textContent = `Time: ${time.toFixed(2)} s\nAngle: ${(theta * 180 / PI).toFixed(2)}°\nAngular velocity: ${omega.toFixed(3)} rad/s\nBob speed: ${Math.abs(length * omega).toFixed(3)} m/s\nKinetic / potential energy: ${kinetic.toFixed(3)} / ${potential.toFixed(3)} J\nMechanical energy: ${(kinetic + potential).toFixed(3)} J\nSmall-angle period: ${gravity ? (2 * PI * Math.sqrt(length / gravity)).toFixed(3) + ' s' : 'undefined at zero gravity'}`;
    }
  }
  function step(dt) {
    const f = (theta, omega) => -config.gravity / config.length * Math.sin(theta) - config.damping * omega;
    const t = state.theta, o = state.omega;
    const k1t = o, k1o = f(t, o), k2t = o + k1o * dt / 2, k2o = f(t + k1t * dt / 2, k2t),
      k3t = o + k2o * dt / 2, k3o = f(t + k2t * dt / 2, k3t), k4t = o + k3o * dt, k4o = f(t + k3t * dt, k4t);
    state.theta += dt / 6 * (k1t + 2 * k2t + 2 * k3t + k4t); state.omega += dt / 6 * (k1o + 2 * k2o + 2 * k3o + k4o); state.time += dt;
  }
  function animate(now) {
    if (!running || !canvas.isConnected) { running = false; start.textContent = 'Start'; return; }
    const elapsed = last ? Math.min((now - last) / 1000, .1) : 0; last = now;
    accumulator += elapsed;
    while (accumulator >= 1 / 240) { step(1 / 240); accumulator -= 1 / 240; }
    draw(); frame = requestAnimationFrame(animate);
  }
  function pause() { running = false; cancelAnimationFrame(frame); start.textContent = 'Start'; status.textContent = 'Paused.'; draw(true); }
  function resetState() {
    try {
      const next = readConfig(); config = next; state = { theta: next.angle * PI / 180, omega: 0, time: 0 }; last = 0; accumulator = 0; lastOutput = -Infinity;
      show(status, running ? 'Running.' : 'Paused. Press Start to run.'); draw(true); return true;
    } catch (error) { pause(); show(status, error.message, true); return false; }
  }
  start.addEventListener('click', () => {
    if (running) { pause(); return; }
    // Apply edited parameters before starting; resume unchanged parameters without resetting.
    try { const next = readConfig(); if (Object.keys(next).some(key => next[key] !== config[key]) && !resetState()) return; }
    catch (error) { show(status, error.message, true); return; }
    running = true; last = 0; start.textContent = 'Pause'; show(status, 'Running.'); frame = requestAnimationFrame(animate);
  });
  reset.addEventListener('click', resetState);
  for (const input of Object.values(inputs)) input.addEventListener('change', resetState);
  // Angle is part of configuration so pausing and restarting does not unintentionally reset.
  config.angle = 35;
  draw(true);
}

const TOOLS = Object.freeze({
  ...MATH_NUMBER_TOOLS,
  'physics-hub': physicsHub,
  'periodic-table': periodicTable,
  'motion': motion,
  'force': force,
  'energy': energy,
  'gravity': gravity,
  'waves': waves,
  'electricity': electricity,
  'optics': optics,
  'pressure': pressure,
  'density': density,
  'temperature': temperature,
  'ideal-gas': idealGas,
  'half-life': halfLife,
  'constants': constants
});

/** Mount a recognized utility into a DOM container; unknown IDs leave root untouched. */
export function mountMathScience(id, root) {
  if (typeof id !== 'string' || !Object.hasOwn(TOOLS, id)) return false;
  if (!root || typeof root.replaceChildren !== 'function') throw new TypeError('mountMathScience requires a DOM container.');
  TOOLS[id](root);
  return true;
}
