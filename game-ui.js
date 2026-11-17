// Custom 2.5D mobile game UI components — zero default HTML inputs/ranges/selects.

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value !== undefined && value !== null && value !== false) node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child !== null && child !== undefined && child !== false) {
      node.append(typeof child === 'object' ? child : document.createTextNode(String(child)));
    }
  }
  return node;
}

export function createGameSlider({ label, min = 0, max = 100, step = 1, value = 50, unit = '', color = '#8cd18d', onChange }) {
  let current = Number(value);
  const clamp = v => {
    const stepped = Math.round((Math.min(max, Math.max(min, v)) - min) / step) * step + min;
    return Number(stepped.toFixed(6));
  };
  current = clamp(current);

  const valueBadge = el('span', { class: 'gslider-badge' }, `${current}${unit}`);
  const fill = el('div', { class: 'gslider-fill', style: `background:${color}` });
  const thumb = el('div', { class: 'gslider-thumb', role: 'slider', tabindex: '0', 'aria-label': label, 'aria-valuemin': min, 'aria-valuemax': max, 'aria-valuenow': current });
  const track = el('div', { class: 'gslider-track' }, fill, thumb);

  const minusBtn = el('button', { type: 'button', class: 'gbtn gbtn-mini', 'aria-label': `Decrease ${label}`, onclick: () => set(current - step) }, '−');
  const plusBtn = el('button', { type: 'button', class: 'gbtn gbtn-mini', 'aria-label': `Increase ${label}`, onclick: () => set(current + step) }, '+');

  function render() {
    const pct = max === min ? 0 : ((current - min) / (max - min)) * 100;
    fill.style.width = `${pct}%`;
    thumb.style.left = `${pct}%`;
    thumb.setAttribute('aria-valuenow', String(current));
    valueBadge.textContent = `${current}${unit}`;
  }

  function set(next, notify = true) {
    const clamped = clamp(next);
    if (clamped === current && notify) return;
    current = clamped;
    render();
    if (notify && onChange) onChange(current);
  }

  function updateFromPointer(clientX) {
    const rect = track.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    set(min + ratio * (max - min));
  }

  let dragging = false;
  track.addEventListener('pointerdown', e => {
    e.preventDefault();
    dragging = true;
    thumb.classList.add('is-dragging');
    track.setPointerCapture?.(e.pointerId);
    updateFromPointer(e.clientX);
  });
  track.addEventListener('pointermove', e => {
    if (dragging) updateFromPointer(e.clientX);
  });
  const endDrag = () => { dragging = false; thumb.classList.remove('is-dragging'); };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);

  thumb.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); set(current - step); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); set(current + step); }
    else if (e.key === 'Home') { e.preventDefault(); set(min); }
    else if (e.key === 'End') { e.preventDefault(); set(max); }
  });

  render();
  const root = el('div', { class: 'gslider-wrap' },
    el('div', { class: 'gslider-head' }, el('span', { class: 'gslider-label' }, label), valueBadge),
    el('div', { class: 'gslider-row' }, minusBtn, track, plusBtn)
  );
  return { el: root, getValue: () => current, setValue: v => set(v, false) };
}

export function createGameTabs({ items, value, onChange, cls = '' }) {
  let current = value ?? items[0]?.value;
  const buttons = new Map();
  const bar = el('div', { class: `gtabs ${cls}`, role: 'tablist' });

  function select(val, notify = true) {
    current = val;
    for (const [k, btn] of buttons.entries()) {
      const active = k === val;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
    }
    if (notify && onChange) onChange(val);
  }

  for (const item of items) {
    const btn = el('button', {
      type: 'button',
      role: 'tab',
      class: `gbtn gtab ${item.value === current ? 'is-active' : ''}`,
      'aria-selected': String(item.value === current),
      onclick: () => select(item.value)
    }, item.icon ? el('span', { class: 'gtab-icon' }, item.icon) : null, item.label);
    buttons.set(item.value, btn);
    bar.append(btn);
  }
  return { el: bar, getValue: () => current, setValue: v => select(v, false) };
}

export function createGameToggle({ checked = false, onLabel = 'ON', offLabel = 'OFF', label = '', onChange }) {
  let state = Boolean(checked);
  const knob = el('span', { class: 'gtoggle-knob' });
  const text = el('span', { class: 'gtoggle-text' }, state ? onLabel : offLabel);
  const btn = el('button', {
    type: 'button',
    role: 'switch',
    class: `gtoggle ${state ? 'is-on' : ''}`,
    'aria-checked': String(state),
    'aria-label': label || `${offLabel} / ${onLabel}`,
    onclick: () => {
      state = !state;
      btn.classList.toggle('is-on', state);
      btn.setAttribute('aria-checked', String(state));
      text.textContent = state ? onLabel : offLabel;
      if (onChange) onChange(state);
    }
  }, knob, text);
  return { el: btn, getValue: () => state };
}

export function createGameField({ label, value = '', placeholder = '', inputmode = 'text', onInput, cls = '' }) {
  const input = el('input', {
    type: 'text',
    class: 'gfield-input',
    value: String(value),
    placeholder,
    inputmode,
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-label': label || placeholder || 'Value'
  });
  if (onInput) input.addEventListener('input', () => onInput(input.value));
  const box = el('div', { class: `gfield ${cls}` },
    label ? el('span', { class: 'gfield-label' }, label) : null,
    el('div', { class: 'gfield-tray' }, input)
  );
  return { el: box, input };
}
