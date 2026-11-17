/** Shared Cozy 2.5D Game UI Kit — zero default HTML select/range/checkbox/color inputs */
import { playPop, playSquish } from './sfx.js';

export const SWATCH_PALETTE = [
  '#4f2f23', '#e78167', '#f7c46c', '#ffe17d',
  '#8fc487', '#7ec3d4', '#5577ee', '#b89ad9',
  '#f2a2b4', '#c98550', '#fff9ec', '#222222'
];

export function gEl(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in node && key !== 'list' && key !== 'style') node[key] = value;
    else if (value !== undefined && value !== null) node.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child !== null && child !== undefined) node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function gameBtn(label, variant = '', onClick) {
  const cls = ['gbtn', variant === 'primary' ? 'gbtn-primary' : variant === 'chip' ? 'gbtn-chip' : variant === 'warn' ? 'warn' : variant === 'danger' ? 'danger' : ''].filter(Boolean).join(' ');
  const b = gEl('button', { type: 'button', class: cls }, label);
  b.addEventListener('click', e => {
    playSquish();
    onClick?.(e);
  });
  return b;
}

/** Pill tabs replacing default <select> */
export function gameTabs(items, initialValue, onChange, label = '') {
  const norm = items.map(it => Array.isArray(it) ? [String(it[0]), String(it[1])] : [String(it), String(it)]);
  let current = initialValue !== undefined ? String(initialValue) : norm[0]?.[0] ?? '';
  const row = gEl('div', { class: 'gtabs' });
  const btns = new Map();

  const api = {
    el: label ? gEl('div', { class: 'gfield' }, gEl('span', { class: 'gfield-label' }, label), row) : row,
    get value() { return current; },
    set value(v) {
      current = String(v);
      for (const [k, b] of btns) {
        const on = k === current;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      }
    },
    setItems(nextItems, nextVal) {
      norm.length = 0;
      for (const it of nextItems) norm.push(Array.isArray(it) ? [String(it[0]), String(it[1])] : [String(it), String(it)]);
      build();
      if (nextVal !== undefined) api.value = nextVal;
      else if (norm.length) api.value = norm[0][0];
    }
  };

  function build() {
    row.replaceChildren();
    btns.clear();
    for (const [val, title] of norm) {
      const b = gEl('button', { type: 'button', class: `gbtn gtab${val === current ? ' is-active' : ''}`, 'aria-pressed': String(val === current) }, title);
      b.addEventListener('click', () => {
        playPop(540);
        api.value = val;
        onChange?.(val);
      });
      btns.set(val, b);
      row.append(b);
    }
  }
  build();
  return api;
}

/** Pill switch replacing default <input type="checkbox"> */
export function gameToggle(label, initial = false, onChange) {
  let checked = Boolean(initial);
  const btn = gEl('button', { type: 'button', class: `gtoggle${checked ? ' is-on' : ''}`, 'aria-pressed': String(checked) },
    gEl('span', { class: 'gtoggle-knob', 'aria-hidden': 'true' }),
    gEl('span', {}, label)
  );
  const api = {
    el: btn,
    get checked() { return checked; },
    set checked(v) {
      checked = Boolean(v);
      btn.classList.toggle('is-on', checked);
      btn.setAttribute('aria-pressed', String(checked));
    }
  };
  btn.addEventListener('click', () => {
    playPop(checked ? 420 : 620);
    api.checked = !checked;
    onChange?.(checked);
  });
  return api;
}

/** Custom 2.5D pointer-draggable slider replacing default <input type="range"> */
export function gameSlider({ label, min = 0, max = 100, step = 1, value = 50, unit = '', color = '#8fc487', onChange }) {
  let val = Number(value);
  const badge = gEl('span', { class: 'gslider-badge' });
  const fill = gEl('div', { class: 'gslider-fill', style: { background: color } });
  const thumb = gEl('div', { class: 'gslider-thumb' });
  const track = gEl('div', {
    class: 'gslider-track', role: 'slider', tabindex: '0',
    'aria-label': label, 'aria-valuemin': String(min), 'aria-valuemax': String(max), 'aria-valuenow': String(val)
  }, fill, thumb);
  const minus = gEl('button', { type: 'button', class: 'gbtn gbtn-mini', 'aria-label': `Decrease ${label}` }, '−');
  const plus = gEl('button', { type: 'button', class: 'gbtn gbtn-mini', 'aria-label': `Increase ${label}` }, '+');
  const wrap = gEl('div', { class: 'gslider-wrap' },
    gEl('div', { class: 'gslider-head' }, gEl('span', { class: 'gslider-label' }, label), badge),
    gEl('div', { class: 'gslider-row' }, minus, track, plus)
  );

  function snap(n) {
    const clamped = Math.min(max, Math.max(min, n));
    const snapped = Math.round((clamped - min) / step) * step + min;
    const dec = (String(step).split('.')[1] || '').length;
    return Number(Math.min(max, Math.max(min, snapped)).toFixed(dec));
  }

  function render() {
    const pct = max === min ? 0 : ((val - min) / (max - min)) * 100;
    fill.style.width = `${pct}%`;
    thumb.style.left = `${pct}%`;
    badge.textContent = `${val}${unit ? ' ' + unit : ''}`;
    track.setAttribute('aria-valuenow', String(val));
  }

  function update(next, emit = true) {
    val = snap(next);
    render();
    if (emit) onChange?.(val);
  }

  function fromClientX(clientX) {
    const r = track.getBoundingClientRect();
    if (!r.width) return;
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    update(min + ratio * (max - min));
  }

  let dragging = false;
  track.addEventListener('pointerdown', e => {
    dragging = true;
    track.setPointerCapture?.(e.pointerId);
    fromClientX(e.clientX);
  });
  track.addEventListener('pointermove', e => { if (dragging) fromClientX(e.clientX); });
  track.addEventListener('pointerup', () => { if (dragging) { dragging = false; playPop(520); } });
  track.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); update(val - step); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); update(val + step); }
  });
  minus.addEventListener('click', () => { playPop(460); update(val - step); });
  plus.addEventListener('click', () => { playPop(560); update(val + step); });
  render();

  return {
    el: wrap,
    get value() { return String(val); },
    set value(v) { update(Number(v), false); },
    get num() { return val; }
  };
}

/** Custom 2.5D pastel swatch + hex input replacing default <input type="color"> */
export function gameColorPicker(label, initial = '#e78167', onChange) {
  let color = /^#[0-9a-f]{6}$/i.test(initial) ? initial.toLowerCase() : '#e78167';
  const dot = gEl('span', { class: 'color-chip-preview', style: { background: color } });
  const hexIn = gEl('input', { type: 'text', class: 'gfield-input color-hex-input', value: color, maxlength: 7, 'aria-label': `${label} hex` });
  const swatchRow = gEl('div', { class: 'color-swatch-row' });

  const wrap = gEl('div', { class: 'gfield' },
    gEl('span', { class: 'gfield-label' }, label),
    gEl('div', { class: 'gfield-tray color-picker-tray' }, dot, hexIn),
    swatchRow
  );

  const btns = [];
  function sync(next, emit = true) {
    if (!/^#[0-9a-f]{6}$/i.test(next)) return;
    color = next.toLowerCase();
    dot.style.background = color;
    hexIn.value = color;
    for (const b of btns) b.classList.toggle('is-active', b.dataset.color === color);
    if (emit) onChange?.(color);
  }

  for (const hex of SWATCH_PALETTE) {
    const b = gEl('button', {
      type: 'button', class: `swatch-btn${hex === color ? ' is-active' : ''}`,
      style: { background: hex }, 'data-color': hex, 'aria-label': `Color ${hex}`
    });
    b.addEventListener('click', () => { playPop(580); sync(hex); });
    btns.push(b);
    swatchRow.append(b);
  }

  hexIn.addEventListener('input', () => {
    const v = hexIn.value.trim();
    if (/^#[0-9a-f]{6}$/i.test(v)) sync(v);
  });

  return {
    el: wrap,
    get value() { return color; },
    set value(v) { sync(String(v), false); }
  };
}

/** Cozy 2.5D file drop pill button */
export function gameFilePill(label, accept = '', multiple = false, onFiles) {
  const input = gEl('input', { type: 'file', hidden: true });
  if (accept) input.accept = accept;
  if (multiple) input.multiple = true;
  const nameBadge = gEl('span', { class: 'file-pill-name' }, 'No file chosen');
  const btn = gEl('label', { class: 'gbtn gbtn-primary file-drop-pill' },
    gEl('span', {}, `📁 ${label}`),
    input
  );
  const wrap = gEl('div', { class: 'file-pill-row' }, btn, nameBadge);
  input.addEventListener('change', () => {
    playPop(600);
    const fs = [...(input.files || [])];
    nameBadge.textContent = fs.length ? (fs.length === 1 ? fs[0].name : `${fs.length} files selected`) : 'No file chosen';
    onFiles?.(fs, input);
  });
  return { el: wrap, input, nameBadge };
}

export function gameField(label, control) {
  const tray = gEl('div', { class: 'gfield-tray' }, control);
  return gEl('div', { class: 'gfield' }, gEl('span', { class: 'gfield-label' }, label), tray);
}

export function statBox(label, value = '—', tone = '') {
  const valEl = gEl('div', { class: 'stat-mid' }, String(value));
  const box = gEl('div', { class: `stat-box ${tone}` }, gEl('span', {}, label), valEl);
  return { el: box, valEl, set(v) { valEl.textContent = String(v); } };
}

export async function copyToClipboard(text) {
  const str = String(text ?? '');
  if (!str) return false;
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(str);
      return true;
    } catch {}
  }
  if (typeof document !== 'undefined') {
    try {
      const ta = document.createElement('textarea');
      ta.value = str;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
      document.body.append(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, str.length);
      const ok = document.execCommand('copy');
      ta.remove();
      if (ok) return true;
    } catch {}
  }
  return false;
}
