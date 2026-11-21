// Runs the four original cabinet games headlessly inside a real VM sandbox:
// a DOM shim built from each file's own markup, a fake clock, timers, rAF,
// localStorage, Web Audio, and a recording 2D canvas. Then drives them with
// pointer/keyboard events and asserts on what they actually render.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const CABINET = 'games/cabinet';
const ORIGINALS = [
  { file: 'toast-breakout.html', title: 'Toast Breakout' },
  { file: 'kitchen-snake.html', title: 'Kitchen Snake' },
  { file: 'waffle-whisk.html', title: 'Waffle Whisk' },
  { file: 'syrup-glide.html', title: 'Syrup Glide' }
];

/* ------------------------------------------------------------ markup parse */

/** Every attribute on a tag, as a plain object. */
function attrsOf(openTag) {
  const attrs = {};
  const re = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let m;
  while ((m = re.exec(openTag))) attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  return attrs;
}

/**
 * All opening tags of a given name, in document order, each with the text it
 * wraps so an element starts life reading the same as it does in the markup.
 */
function tagsNamed(html, tag) {
  const out = [];
  const re = new RegExp('<' + tag + '(\\s[^>]*)?>', 'gi');
  let m;
  while ((m = re.exec(html))) {
    const attrs = attrsOf(m[0]);
    const rest = html.slice(m.index + m[0].length);
    const close = rest.toLowerCase().indexOf('</' + tag + '>');
    if (close >= 0) {
      const inner = rest.slice(0, close);
      // Skip anything that nests its own tag: the naive close would be wrong.
      if (!new RegExp('<' + tag + '[\\s>]', 'i').test(inner)) {
        attrs.__text = inner.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      }
    }
    out.push(attrs);
  }
  return out;
}

/* ------------------------------------------------------------- DOM shim */

class ClassList {
  constructor(el) { this.el = el; }
  get set() {
    return String(this.el.className || '').split(/\s+/).filter(Boolean);
  }
  write(list) { this.el.className = list.join(' '); }
  add(...names) { const s = this.set; for (const n of names) if (!s.includes(n)) s.push(n); this.write(s); }
  remove(...names) { this.write(this.set.filter(n => !names.includes(n))); }
  toggle(name, force) {
    const has = this.set.includes(name);
    const want = force === undefined ? !has : Boolean(force);
    if (want) this.add(name); else this.remove(name);
    return want;
  }
  contains(name) { return this.set.includes(name); }
}

class Element {
  constructor(tag, attrs = {}) {
    this.tagName = String(tag).toUpperCase();
    this.attrs = {};
    this.dataset = {};
    this.style = {};
    this.children = [];
    this.listeners = {};
    this._text = '';
    for (const [k, v] of Object.entries(attrs)) {
      if (k === '__text') this._text = String(v);
      else this.setAttribute(k, v);
    }
    const self = this;
    this.classList = new ClassList(this);
    Object.defineProperty(this, 'className', {
      get() { return self.attrs.class || ''; },
      set(v) { self.attrs.class = String(v); },
      configurable: true
    });
  }
  setAttribute(name, value) {
    const k = String(name).toLowerCase();
    this.attrs[k] = String(value);
    if (k === 'id') { this.id = String(value); if (this._onId) this._onId(this); }
    else if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value);
    else if (k === 'value') this.value = String(value);
  }
  getAttribute(name) {
    const k = String(name).toLowerCase();
    return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null;
  }
  hasAttribute(name) { return this.getAttribute(name) !== null; }
  removeAttribute(name) { delete this.attrs[String(name).toLowerCase()]; }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); }
  get innerText() { return this._text; }
  set innerText(v) { this._text = String(v); }
  appendChild(child) { this.children.push(child); child.parentNode = this; return child; }
  append(...kids) { for (const k of kids) this.appendChild(k); }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  removeEventListener(type, fn) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter(f => f !== fn);
  }
  dispatchEvent(ev) { fire(this, ev.type, ev); return true; }
  /**
   * Scoped queries. Markup parsed from a string has no parent links, so when the
   * subtree is empty this falls back to the whole document, which is what the
   * game sees anyway for a flat minified layout.
   */
  querySelectorAll(selector) {
    const scope = [];
    const walk = el => { for (const c of el.children || []) { scope.push(c); walk(c); } };
    walk(this);
    const pool = scope.length ? scope : (Element.all ? Element.all() : []);
    return matchesAll(pool, selector);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  getElementsByClassName(name) { return this.querySelectorAll('.' + name); }
  getElementsByTagName(name) { return this.querySelectorAll(String(name)); }
  closest() { return null; }
  contains(other) { return other === this || (this.children || []).includes(other); }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(c => c !== this); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 420, height: 560, right: 420, bottom: 560 }; }
  focus() {}
  blur() {}
}

class FakeEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.defaultPrevented = false;
    Object.assign(this, init);
  }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() {}
}

const KEY_CODES = {
  ' ': 'Space', enter: 'Enter', escape: 'Escape', tab: 'Tab', shift: 'Shift',
  arrowleft: 'ArrowLeft', arrowright: 'ArrowRight', arrowup: 'ArrowUp', arrowdown: 'ArrowDown',
  backspace: 'Backspace', delete: 'Delete'
};

const KEY_CODES_NUMERIC = {
  ' ': 32, enter: 13, escape: 27, tab: 9, backspace: 8, delete: 46,
  arrowleft: 37, arrowup: 38, arrowright: 39, arrowdown: 40
};

/**
 * Games read e.key, e.code, or the legacy e.keyCode, so a keystroke carries all
 * three the way a real KeyboardEvent does.
 */
function withCode(key, init) {
  const k = String(key);
  const lower = k.toLowerCase();
  let code = KEY_CODES[lower];
  if (!code) code = /^[0-9]$/.test(k) ? 'Digit' + k : /^[a-z]$/.test(lower) ? 'Key' + lower.toUpperCase() : k;
  let keyCode = KEY_CODES_NUMERIC[lower];
  if (keyCode === undefined) {
    keyCode = /^[a-z]$/i.test(k) ? k.toUpperCase().charCodeAt(0) : /^[0-9]$/.test(k) ? k.charCodeAt(0) : 0;
  }
  return Object.assign({ key: k, code: code, keyCode: keyCode, which: keyCode, charCode: 0 }, init);
}

function fire(target, type, init = {}) {
  const ev = init instanceof FakeEvent ? init : new FakeEvent(type, init);
  const registry = target.listeners || {};
  // A real handler runs with `this` bound to whatever it was attached to, and
  // plenty of games read this.className or this.getAttribute() from there.
  for (const fn of (registry[type] || []).slice()) fn.call(target, ev);
  return ev;
}

/**
 * A 2D canvas context that records what it is asked to draw, so a test can read
 * the screen (fillText), follow a sprite (translate), and find a shape by the
 * colour it was filled with (moveTo after a fillStyle change).
 */
function makeContext(recorder) {
  const noop = () => {};
  const ctx = {
    canvas: null,
    save: noop, restore: noop, rotate: noop, scale: noop,
    translate(x, y) { recorder.sprites.push({ x: x, y: y }); },
    beginPath: noop, closePath: noop, lineTo: noop, arcTo: noop,
    moveTo(x, y) { recorder.moves.push({ x: x, y: y, style: recorder.style }); },
    arc: noop, bezierCurveTo: noop, quadraticCurveTo: noop, rect: noop,
    fill() { recorder.ops += 1; }, stroke() { recorder.ops += 1; },
    clip: noop, setLineDash: noop, drawImage() { recorder.ops += 1; },
    clearRect() { recorder.ops += 1; }, fillRect() { recorder.ops += 1; }, strokeRect() { recorder.ops += 1; },
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createConicGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}),
    measureText: () => ({ width: 10 }),
    fillText(text, x, y) { recorder.text.push(String(text)); }
  };
  return new Proxy(ctx, {
    set(target, key, value) {
      if (key === 'fillStyle') recorder.style = String(value);
      target[key] = value;
      return true;
    }
  });
}

/* ------------------------------------------------------------- runtime */

/**
 * Boots one cabinet game in a VM with a simulated clock.
 * Everything the game can observe is observable from the returned handle.
 */
function bootGame(file, opts = {}) {
  const html = fs.readFileSync(`${CABINET}/${file}`, 'utf8');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert.ok(blocks.length, `${file} must contain an inline game script`);
  const code = blocks[blocks.length - 1];

  const recorder = { text: [], moves: [], sprites: [], style: null, ops: 0 };
  const drawnText = recorder.text;
  let clock = 0;
  let rafId = 0;
  const rafQueue = [];
  let timerId = 0;
  const timers = new Map();
  const frames = [];

  class FakeStorage {
    constructor() { this.store = new Map(); }
    getItem(k) { return this.store.has(String(k)) ? this.store.get(String(k)) : null; }
    setItem(k, v) { this.store.set(String(k), String(v)); }
    removeItem(k) { this.store.delete(String(k)); }
    clear() { this.store.clear(); }
    key(i) { return Array.from(this.store.keys())[i] ?? null; }
    get length() { return this.store.size; }
  }
  const localStorage = new FakeStorage();
  const store = localStorage.store;

  const elements = [];
  const byId = new Map();
  // Browsers expose every element with an id as a property of window, and older
  // games lean on that instead of calling getElementById.
  const NAMED_DENY = new Set(['window', 'document', 'self', 'top', 'parent', 'frames', 'location',
    'history', 'screen', 'console', 'navigator', 'performance', 'localStorage', 'status', 'name',
    'length', 'closed', 'opener', 'origin', 'event', 'constructor', '__proto__', 'Math', 'Date',
    'Storage', 'Audio', 'Image', 'globalThis']);
  let namedTarget = null;
  const exposeNamed = el => {
    const id = el.id;
    if (!namedTarget || !id || NAMED_DENY.has(id) || id in namedTarget) return;
    namedTarget[id] = el;
  };
  const register = el => { elements.push(el); if (el.id) byId.set(el.id, el); exposeNamed(el); return el; };

  // Canvas first: games call getContext('2d') on it.
  Element.prototype._onId = null;
  const canvasAttrs = tagsNamed(html, 'canvas')[0] || {};
  const canvas = register(new Element('canvas', canvasAttrs));
  canvas.getContext = () => {
    const ctx = makeContext(recorder);
    ctx.canvas = canvas;
    return ctx;
  };

  // Then every element the markup declares, so ids/classes/data-* are real.
  const TAGS = ['div', 'p', 'b', 'i', 'span', 'button', 'kbd', 'input', 'a', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'strong',
    'em', 'small', 'label', 'section', 'header', 'footer', 'main', 'nav', 'aside', 'article',
    'figure', 'img', 'form', 'select', 'option', 'textarea', 'pre', 'code', 'blockquote'];
  for (const tag of TAGS) {
    for (const attrs of tagsNamed(html, tag)) register(new Element(tag, attrs));
  }
  const htmlEl = register(new Element('html', tagsNamed(html, 'html')[0] || {}));
  const bodyEl = register(new Element('body'));
  bodyEl.children = elements.slice();

  const document = new Element('document');
  // An inline script runs while the parser is still going, so a game that waits
  // for DOMContentLoaded or load must see exactly that sequence.
  document.readyState = 'loading';
  document.hidden = false;
  document.documentElement = htmlEl;
  document.body = bodyEl;
  document.head = register(new Element('head'));
  document.title = 'cabinet game';
  document.createDocumentFragment = () => new Element('fragment');
  document.getElementsByTagName = name => matchesAll(elements, String(name).toLowerCase());
  document.createElementNS = (ns, tag) => register(new Element(tag));
  document.getElementById = id => byId.get(String(id)) || null;
  document.createElement = tag => {
    const el = register(new Element(tag));
    if (String(tag).toLowerCase() === 'canvas') {
      el.width = 300;
      el.height = 150;
      el.getContext = () => {
        const ctx = makeContext(recorder);
        ctx.canvas = el;
        return ctx;
      };
    }
    return el;
  };
  document.currentScript = { src: 'https://example.test/games/arcade-controls.js' };
  document.querySelectorAll = selector => matchesAll(elements, selector);
  document.querySelector = selector => document.querySelectorAll(selector)[0] || null;

  class FakeAudio {
    constructor(src) { this.src = src || ''; this.paused = true; this.volume = 1; this.loop = false; }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    load() {}
    addEventListener() {}
    removeEventListener() {}
    cloneNode() { return new FakeAudio(this.src); }
  }
  // Date.now() must follow the simulated clock, or a game that times itself with
  // it computes a delta of zero every frame and appears frozen.
  const EPOCH = 1763438000000;
  class FakeDate extends Date {
    constructor(...args) {
      if (args.length === 0) super(EPOCH + clock);
      else super(...args);
    }
    static now() { return EPOCH + clock; }
  }

  class FakeImage {
    constructor(w, h) { this.width = w || 0; this.height = h || 0; this.src = ''; this.complete = true; }
    addEventListener() {}
  }
  const audioParam = (value = 0) => ({
    value: value, defaultValue: value, minValue: -3.4e38, maxValue: 3.4e38,
    setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {},
    setTargetAtTime: () => {}, setValueCurveAtTime: () => {},
    cancelScheduledValues: () => {}, cancelAndHoldAtTime: () => {}
  });

  const audioNode = (extra = {}) => Object.assign({
    connect: () => {}, disconnect: () => {}, start: () => {}, stop: () => {},
    frequency: audioParam(),
    gain: audioParam(),
    Q: audioParam(1), detune: audioParam(), pan: audioParam(), playbackRate: audioParam(1),
    threshold: audioParam(-24), knee: audioParam(30), ratio: audioParam(12),
    attack: audioParam(0.003), release: audioParam(0.25), curve: null, oversample: 'none',
    delayTime: audioParam(), positionX: audioParam(), positionY: audioParam(), positionZ: audioParam(),
    type: 'sine', buffer: null, loop: false, onended: null
  }, extra);
  class FakeAudioContext {
    constructor() { this.currentTime = 0; this.state = 'running'; this.destination = audioNode(); }
    resume() { this.state = 'running'; }
    createOscillator() { return audioNode(); }
    createGain() { return audioNode(); }
    createBiquadFilter() { return audioNode(); }
    createDynamicsCompressor() { return audioNode(); }
    createStereoPanner() { return audioNode(); }
    createWaveShaper() { return audioNode(); }
    createDelay() { return audioNode(); }
    createConvolver() { return audioNode(); }
    createChannelMerger() { return audioNode(); }
    createChannelSplitter() { return audioNode(); }
    createPeriodicWave() { return audioNode(); }
    createBufferSource() { return audioNode(); }
    createBuffer(channels, length) {
      return audioNode({ length: length, duration: length / 44100, sampleRate: 44100, numberOfChannels: channels, getChannelData: () => new Float32Array(length || 1) });
    }
    createMediaElementSource() { return audioNode(); }
  }

  // In a browser the window *is* the global object, and vendored games rely on
  // that: they assign window.jsfxr and then call the bare global jsfxr.
  const windowListeners = {};
  const windowTarget = new Element('window');
  windowTarget.listeners = windowListeners;

  const sandbox = {
    window: null,
    self: null,
    globalThis: null,
    top: null,
    parent: null,
    document,
    Audio: FakeAudio,
    Image: FakeImage,
    Storage: FakeStorage,
    localStorage,
    navigator: { userAgent: 'node-test', maxTouchPoints: 0, language: 'en' },
    performance: { now: () => clock },
    requestAnimationFrame(cb) { rafQueue.push({ id: ++rafId, cb }); return rafId; },
    cancelAnimationFrame() {},
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { at: clock + Math.max(0, Number(ms) || 0), fn }); return id; },
    clearTimeout(id) { timers.delete(id); },
    setInterval(fn, ms) {
      const id = ++timerId;
      timers.set(id, { at: clock + Math.max(0, Number(ms) || 0), fn: function repeat() { fn(); timers.set(id, { at: clock + Math.max(0, Number(ms) || 0), fn: repeat }); } });
      return id;
    },
    clearInterval(id) { timers.delete(id); },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    screen: { width: 420, height: 620, availWidth: 420, availHeight: 620 },
    alert: () => {}, confirm: () => true, prompt: () => '',
    matchMedia: query => ({
      matches: Boolean(opts.reduceMotion) && /prefers-reduced-motion/.test(String(query)),
      media: String(query),
      addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}
    }),
    addEventListener(type, fn) { (windowListeners[type] = windowListeners[type] || []).push(fn); },
    removeEventListener(type, fn) {
      if (!windowListeners[type]) return;
      windowListeners[type] = windowListeners[type].filter(f => f !== fn);
    },
    AudioContext: FakeAudioContext,
    webkitAudioContext: FakeAudioContext,
    opener: null,
    close: () => {},
    history: { length: 1, back: () => {} },
    location: { href: `https://kitchen.test/games/cabinet/${file}`, assign: () => {}, reload: () => {} },
    innerWidth: 420,
    innerHeight: 620,
    devicePixelRatio: 1,
    Math: Object.create(Math),
    Date: FakeDate,
    console
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.top = sandbox;
  sandbox.parent = sandbox;
  if (opts.random !== undefined) sandbox.Math.random = () => opts.random;

  Element.all = () => elements;
  namedTarget = sandbox;
  Element.prototype._onId = el => exposeNamed(el);
  for (const el of elements) exposeNamed(el);

  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: `${CABINET}/${file}` });

  // Then the document finishes parsing, and finally the window loads.
  document.readyState = 'interactive';
  fire(document, 'DOMContentLoaded');
  fire(sandbox, 'DOMContentLoaded');
  document.readyState = 'complete';
  fire(windowTarget, 'load');
  fire(document, 'load');

  /**
   * Fires on the target, then on the document and the window, the way a real
   * bubbling event reaches delegated handlers.
   */
  const bubble = (target, type, init, label) => {
    assert.ok(target, `${label}: no such event target`);
    const ev = fire(target, type, init);
    if (target !== document) fire(document, type, ev);
    if (target !== windowTarget) fire(windowTarget, type, ev);
    return ev;
  };

  const api = {
    html, code, canvas, document, window: windowTarget, sandbox, localStorage, store, drawnText,
    scheduled: () => ({ raf: rafQueue.length, timers: timers.size }),
    bubble,
    /** How many paint operations the canvas has been asked for. */
    ops: () => recorder.ops,
    resetOps() { recorder.ops = 0; },
    byId: id => byId.get(id) || null,
    /** Text of an element by id. */
    text(id) { const el = byId.get(id); assert.ok(el, `${file}: #${id} exists`); return el.textContent; },
    /** Everything drawn to the canvas since the last clearScreen(). */
    screen() { return drawnText.join(' | '); },
    clearScreen() { drawnText.length = 0; recorder.moves.length = 0; recorder.sprites.length = 0; },
    clearMoves() { recorder.moves.length = 0; recorder.sprites.length = 0; },
    /** Every ctx.translate since the last clear: sprite origins, newest last. */
    sprites() { return recorder.sprites; },
    /** Where the most recently drawn sprite sits. */
    lastSprite() { return recorder.sprites[recorder.sprites.length - 1] || null; },
    /** Every shape origin drawn with a given fill colour, oldest first. */
    movesWithStyle(style) { return recorder.moves.filter(m => m.style === style); },
    /** The most recent shape drawn with a given fill colour. */
    moveWithStyle(style) {
      for (let i = recorder.moves.length - 1; i >= 0; i--) {
        if (recorder.moves[i].style === style) return recorder.moves[i];
      }
      return null;
    },
    key(k, init = {}) { return bubble(windowTarget, 'keydown', withCode(k, init), file); },
    keyUp(k, init = {}) { return bubble(windowTarget, 'keyup', withCode(k, init), file); },
    click(el, init = {}) { return bubble(typeof el === 'string' ? byId.get(el) : el, 'click', init, file); },
    pointer(el, type, init = {}) {
      return bubble(typeof el === 'string' ? byId.get(el) : el, type, init, file);
    },
    /** Advance the clock, firing due timers in order, without rendering. */
    wait(ms) {
      const target = clock + ms;
      for (let guard = 0; guard < 20000; guard++) {
        let next = null, nextId = null;
        for (const [id, t] of timers) if (t.at <= target && (next === null || t.at < next.at)) { next = t; nextId = id; }
        if (!next) break;
        timers.delete(nextId);
        clock = Math.max(clock, next.at);
        next.fn();
      }
      clock = Math.max(clock, target);
    },
    /**
     * Advance n frames of dtMs each. Fires the rAF callback when the game has
     * one, and always fires timers, so a setTimeout-driven loop runs too.
     */
    run(n, dtMs = 16) {
      for (let i = 0; i < n; i++) {
        clock += dtMs;
        const due = rafQueue.splice(0, rafQueue.length);
        for (const { cb } of due) frames.push(cb(clock));
        this.wait(0);
      }
    },
    frameCount: () => frames.length
  };
  return api;
}

/** The handful of selectors these games actually use. */
function matchesAll(elements, selector) {
  const sel = String(selector).trim();
  const parts = sel.split(',').map(s => s.trim()).filter(Boolean);
  return elements.filter(el => parts.some(part => matches(el, part)));
}
function matches(el, part) {
  if (part.startsWith('#')) return el.id === part.slice(1);
  if (part.startsWith('[') && part.endsWith(']')) {
    const name = part.slice(1, -1).replace(/["']/g, '');
    return el.hasAttribute(name);
  }
  if (part.startsWith('.')) return el.classList.contains(part.slice(1));
  return el.tagName === part.toUpperCase();
}

/* ------------------------------------------------------- static hygiene */

test('the four original cabinet games are complete, self-contained HTML documents', () => {
  for (const { file, title } of ORIGINALS) {
    const html = fs.readFileSync(`${CABINET}/${file}`, 'utf8');
    assert.ok(html.startsWith('<!DOCTYPE html>'), `${file} starts with a doctype`);
    assert.ok(html.includes('<script src="../arcade-controls.js"></script>'), `${file} loads the shared back-to-arcade control`);
    assert.ok(html.includes('<html lang="en">'), `${file} declares its language`);
    assert.ok(html.includes('<meta charset="utf-8">'), `${file} declares its charset`);
    assert.ok(/<meta name="viewport"[^>]*width=device-width/.test(html), `${file} is mobile-ready`);
    assert.ok(html.includes(`<title>${title} — BiteSizedUtilities</title>`), `${file} has its own title`);
    assert.ok(!html.includes('iframe'), `${file} must not iframe anything`);
    assert.ok(!/schoolgames/i.test(html), `${file} must not mention the retired folder`);

    // Nothing may be fetched at runtime: no CDN fonts, no analytics, no external script.
    const external = html.match(/(?:src|href)\s*=\s*["']https?:\/\/[^"']+/g) || [];
    assert.deepEqual(external, [], `${file} must not reference any external host`);
    assert.ok(!/@import|fonts\.googleapis|kit\.fontawesome/.test(html), `${file} stays offline`);

    // It must fit the house palette and honour reduced motion where it animates.
    assert.ok(html.includes('#4f2f23'), `${file} uses the ink colour`);
    assert.ok(html.includes('#fff8e8') || html.includes('#fbedcf'), `${file} uses the cream/parchment palette`);
    assert.ok(html.includes('aria-label'), `${file} labels its controls for screen readers`);

    const size = Buffer.byteLength(html);
    assert.ok(size > 6000 && size < 60000, `${file} is a hand-sized document (${size} bytes)`);
  }
});

test('no cabinet page loads a script, style or tracker from someone else\u2019s origin', () => {
  // These games are vendored, and three of them arrived still wired to the sites
  // they were copied from: a Google Analytics pixel in two, a Font Awesome kit and
  // a Google Fonts stylesheet in a third, and that third one also carried the nav
  // bar of a proxy site, including a link out to an anime pirate. Every one of
  // those is a request a visitor pays for before the game draws its first frame,
  // and on a filtered school network each one hangs until it times out.
  //
  // One exception stays, on purpose, and only for a font file inside a @font-face
  // src. Two vendored games carry a display face \u2014 a Japanese one, a Garamond \u2014
  // as unicode-range slices on Google's font CDN. Those are type rather than a
  // tracker, both pages declare a fallback face, and offline they render in the
  // system serif. Re-hosting the slices is worth doing; it is not something this
  // change can verify, so it is named here instead of quietly allowed.
  const loads = [];
  const trackers = [];
  // Recursive: seven of the catalogued games are Unity or js13k exports that live
  // in a folder of their own, and those are the likeliest to have arrived wired to
  // a CDN.
  const files = fs.readdirSync(CABINET, { recursive: true })
    .map(f => f.replaceAll('\\', '/'))
    .filter(f => /\.html?$/i.test(f))   // one catalogued game is a bare .htm
    .sort();
  // Not a magic count: prove the sweep reaches every page the arcade can open.
  const catalogued = JSON.parse(fs.readFileSync('games/catalog.json', 'utf8'))
    .map(g => g.entrypoint.replace(/^games\/cabinet\//, ''));
  for (const page of new Set(catalogued)) {
    assert.ok(files.includes(page), `${page} is in the cabinet and gets checked`);
  }

  for (const file of files) {
    const html = fs.readFileSync(`${CABINET}/${file}`, 'utf8');
    // Anything the browser will fetch on its own: a tag attribute, or a url() in
    // the page's own CSS. Links a visitor has to click are their own business.
    for (const m of html.matchAll(/<(?:script|link|iframe|img|embed|source)\b[^>]*?\b(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)["']/gi)) {
      loads.push(`${file} loads ${m[1]}`);
    }
    for (const m of html.matchAll(/url\(\s*["']?(https?:\/\/[^)"']+)["']?\s*\)/gi)) {
      if (!/\.(?:woff2?|ttf|otf)$/i.test(m[1])) loads.push(`${file} loads ${m[1]}`);
    }
    // Trackers are banned outright, however they are wired in: the classic
    // analytics snippet builds its script src by string concatenation, which no
    // attribute regex can see. Host names, not bare words \u2014 three of the games
    // ship a Construct 3 runtime whose own double-click handling would otherwise
    // look like an ad network.
    if (/google-analytics\.com|googletagmanager\.com|googlesyndication\.com|doubleclick\.net|kit\.fontawesome\.com|fonts\.googleapis\.com|4anime\./i.test(html)) {
      trackers.push(file);
    }
  }

  assert.deepEqual(loads, [], 'every cabinet page fetches its own scripts and styles from this origin');
  assert.deepEqual(trackers, [], 'no cabinet page reports its visitors to a third party');
});

test('Tic Tac Toe arrived wearing another site\u2019s clothes, and now wears the kitchen\u2019s', () => {
  const file = 'tic-tac-toe.html';
  const html = fs.readFileSync(`${CABINET}/${file}`, 'utf8');
  const script = fs.readFileSync(`${CABINET}/tic.js`, 'utf8');

  // It was two documents stapled together: a proxy site's nav bar in the first
  // <body>, pointing at seven pages and two assets that were never vendored with
  // it, then the actual game in a second one.
  assert.equal(html.match(/<body\b/g).length, 1, 'one body');
  assert.equal(html.match(/<\/body>/g).length, 1, 'one closing body');
  assert.ok(html.startsWith('<!DOCTYPE html>'), 'starts with a doctype');
  assert.ok(html.includes('<html lang="en">'), 'declares its language');
  assert.ok(html.includes('<meta charset="utf-8">'), 'declares its charset');
  assert.ok(html.includes('<title>Tic Tac Toe \u2014 BiteSizedUtilities</title>'), 'titles itself as this kitchen\u2019s game');

  // Nothing left of the site it was copied from.
  for (const gone of ['School Heaven', 'carrot.html', 'Unblocker', 'announcements.html', 'music.html']) {
    assert.ok(!html.includes(gone), `${gone} is gone`);
  }

  // The game's own wiring survives: the shared back-to-arcade control, its
  // script, and every element and handler that script drives.
  assert.ok(html.includes('<script src="../arcade-controls.js"></script>'), 'keeps the shared arcade control');
  assert.ok(html.includes('<script src="tic.js"></script>'), 'keeps the game');
  const ids = [...new Set([...script.matchAll(/getElementById\((["'])([^"']+)\1\)/g)].map(m => m[2]))];
  assert.ok(ids.length >= 10, `the game looks up its own elements (${ids.length})`);
  for (const id of ids) assert.ok(html.includes(`id="${id}"`), `#${id} is in the markup`);
  const handlers = [...new Set([...html.matchAll(/(myfunc_?\d*)\s*\(/g)].map(m => m[1]))];
  assert.ok(handlers.length >= 11, `the markup calls the game's handlers (${handlers.length})`);
  for (const fn of handlers) assert.ok(script.includes(`function ${fn}(`), `${fn}() is defined in tic.js`);

  // Its stylesheet never shipped with it, so the white headings sat on the
  // browser's white page and the grid's border colour was a seven-digit hex that
  // no browser parses. Both are fixed here rather than by re-adding the dead link.
  assert.ok(html.includes('#4f2f23'), 'the white text sits on the kitchen\u2019s ink');
  assert.ok(!html.includes('#dedfe0f'), 'no seven-digit hex colour');
  assert.ok(!/href="tic\.css"/.test(html), 'does not link the stylesheet that is not there');
});

test('Tic Tac Toe still plays after losing the other site\u2019s shell', () => {
  const html = fs.readFileSync(`${CABINET}/tic-tac-toe.html`, 'utf8');
  const script = fs.readFileSync(`${CABINET}/tic.js`, 'utf8');

  // The game's whole DOM surface is nine boxes with a value, the line that
  // announces the turn, and an alert when somebody wins. Take the handlers
  // straight out of the markup rather than writing them down again, so this
  // drives the page a visitor gets and not a copy of it.
  const taps = new Map([...html.matchAll(/id="(b\d)"\s+onclick=\s*"([^"]+)"/g)].map(m => [m[1], m[2]]));
  const reset = html.match(/id="but"\s+onclick=\s*"([^"]+)"/);
  assert.equal(taps.size, 9, 'every box in the markup carries its own handler');
  assert.ok(reset, 'the reset button carries its handler');

  const els = new Map([...html.matchAll(/id="([^"]+)"/g)]
    .map(m => [m[1], { id: m[1], value: '', innerHTML: '', disabled: false }]));
  const alerts = [];
  let reloads = 0;
  const sandbox = {
    document: { getElementById: id => els.get(id) ?? null },
    window: { alert: message => alerts.push(String(message)) },
    location: { reload() { reloads++; } }
  };
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox, { filename: 'tic.js' });
  const tap = box => vm.runInContext(taps.get(box), sandbox, { filename: `${box} onclick` });

  // X takes the top row while 0 collects the middle of the left column.
  tap('b1');
  assert.equal(els.get('b1').value, 'X', 'X opens');
  assert.equal(els.get('b1').disabled, true, 'a taken box locks');
  tap('b4');
  assert.equal(els.get('b4').value, '0', 'the turn alternates');
  tap('b2');
  tap('b5');
  tap('b3');

  assert.equal(els.get('print').innerHTML, 'Player X won', 'the top row wins');
  assert.ok(alerts.includes('Player X won'), 'and says so out loud');
  for (const box of ['b6', 'b7', 'b8', 'b9']) {
    assert.equal(els.get(box).disabled, true, `${box} locks once the game is over`);
  }

  vm.runInContext(reset[1], sandbox, { filename: 'reset onclick' });
  assert.equal(reloads, 1, 'reset asks for a fresh page');
  for (const box of taps.keys()) assert.equal(els.get(box).value, '', `${box} clears`);
});

test('every cabinet game in the catalogue exists, and no entry points outside the cabinet', () => {
  const games = JSON.parse(fs.readFileSync('games/catalog.json', 'utf8'));
  for (const g of games) {
    assert.ok(fs.existsSync(g.entrypoint), `${g.id}: ${g.entrypoint} exists`);
    assert.ok(g.entrypoint.startsWith('games/cabinet/'), `${g.id}: entrypoint lives in the cabinet`);
    assert.ok(fs.statSync(g.entrypoint).size > 200, `${g.id}: entrypoint is not a stub`);
  }
  const originals = games.filter(g => ORIGINALS.some(o => o.file === g.entrypoint.split('/').pop()));
  assert.equal(originals.length, ORIGINALS.length, 'all four originals are catalogued');
  for (const g of originals) {
    assert.equal(g.origin, 'github');
    assert.equal(g.repo, 'https://github.com/the-creative-master/BiteSizedUtilities');
    assert.ok(g.license.includes('BiteSizedUtilities'), `${g.id} is credited to this repo`);
    assert.ok(g.description.length > 40, `${g.id} has a real description`);
    assert.ok(Array.isArray(g.tags) && g.tags.length >= 3, `${g.id} has tags`);
    assert.ok(g.controls && g.controls.length > 10, `${g.id} explains its controls`);
    assert.ok(g.emoji, `${g.id} has an emoji`);
  }
});

/* ------------------------------------------------------- shared pilots */

const TOAST_FILL = '#e0a86a';      // the slice of toast, and the waffle in Syrup Glide
const KNIFE_FILL = '#f0ba50';      // the butter-knife paddle
const KNIFE_RADIUS = 7;            // roundRect starts at the corner radius, not the origin

// Kitchen Snake draws with fixed colours, so the canvas itself is the board state.
const SNAKE_CELL = 22;
const SNAKE_HEAD = { style: '#5fae62', ox: 8, oy: 1 };
const SNAKE_FOOD = { style: '#4d8f4f', ox: 9.52, oy: 3.96 };   // the strawberry leaf
const SNAKE_BODY = ['#7ec47f', '#8fd3a4'];
const SNAKE_BODY_OFFSET = { ox: 8.5, oy: 2.5 };
const SNAKE_GRID = 21;
const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const ARROWS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

const cellOf = (m, o) => ({ x: Math.round((m.x - o.ox) / SNAKE_CELL), y: Math.round((m.y - o.oy) / SNAKE_CELL) });

/** Reads head, food and body straight back off the recorded canvas. */
function readSnakeBoard(g) {
  const headMark = g.moveWithStyle(SNAKE_HEAD.style);
  const foodMark = g.moveWithStyle(SNAKE_FOOD.style);
  const marks = [];
  for (const style of SNAKE_BODY) marks.push(...g.movesWithStyle(style));
  // Segments are drawn tail-first, and each one twice (fill then stroke).
  const cells = [];
  for (const m of marks) {
    const c = cellOf(m, SNAKE_BODY_OFFSET);
    const last = cells[cells.length - 1];
    if (!last || last.x !== c.x || last.y !== c.y) cells.push(c);
  }
  return {
    head: headMark ? cellOf(headMark, SNAKE_HEAD) : null,
    food: foodMark ? cellOf(foodMark, SNAKE_FOOD) : null,
    tail: cells[0] || null,
    blocked: new Set(cells.slice(1).map(c => c.x + ',' + c.y))   // the tail vacates next step
  };
}

function headingOf(prev, head) {
  if (!prev) return 'right';
  if (head.x !== prev.x) return head.x > prev.x ? 'right' : 'left';
  if (head.y !== prev.y) return head.y > prev.y ? 'down' : 'up';
  return null;
}

/** Greedy step toward the strawberry that refuses reversals, walls and its own body. */
function chooseSnakeMove(head, food, heading, blocked, wallsOn) {
  const dx = food.x - head.x;
  const dy = food.y - head.y;
  const prefs = [];
  if (dx !== 0) prefs.push(dx > 0 ? 'right' : 'left');
  if (dy !== 0) prefs.push(dy > 0 ? 'down' : 'up');
  if (Math.abs(dy) > Math.abs(dx)) prefs.splice(0, 2, prefs[1], prefs[0]);
  if (dx !== 0) prefs.push(dx > 0 ? 'left' : 'right');
  if (dy !== 0) prefs.push(dy > 0 ? 'up' : 'down');
  for (const d of prefs) {
    if (!d || d === OPPOSITE[heading]) continue;
    const nx = head.x + DIRS[d].x;
    const ny = head.y + DIRS[d].y;
    if (wallsOn && (nx < 0 || ny < 0 || nx >= SNAKE_GRID || ny >= SNAKE_GRID)) continue;
    if (blocked.has(nx + ',' + ny)) continue;
    return d;
  }
  for (const d of ['up', 'down', 'left', 'right']) if (d !== OPPOSITE[heading]) return d;
  return null;
}

/** Plays Kitchen Snake for a while and reports how well it did. */
function pilotSnake(g, frames, opts = {}) {
  const wallsOn = opts.walls !== false;
  const padFor = key => g.document.querySelectorAll('[data-dir]').find(b => b.getAttribute('data-dir') === key);
  let prev = null;
  const out = { longest: 0, highScore: 0, restarts: 0, steps: 0 };
  for (let i = 0; i < frames; i++) {
    g.clearMoves();
    g.run(1, 20);
    out.steps += 1;
    out.longest = Math.max(out.longest, Number(g.text('length')));
    out.highScore = Math.max(out.highScore, Number(g.text('score')));
    if (/Ouch/.test(g.screen())) {
      out.restarts += 1;
      g.key('r');
      g.clearScreen();
      prev = null;
      continue;
    }
    const board = readSnakeBoard(g);
    if (!board.head || !board.food) continue;
    const heading = headingOf(prev, board.head) || 'right';
    const move = chooseSnakeMove(board.head, board.food, heading, board.blocked, wallsOn);
    if (!move) { prev = board.head; continue; }
    // Alternate between the keyboard and the on-screen pad: both must steer.
    if (i % 2 === 0) g.key(ARROWS[move]);
    else g.click(padFor(move));
    prev = board.head;
  }
  return out;
}

/** Waits until Waffle Whisk has finished playing back and is accepting input. */
function waitForTurn(g, maxMs = 6000) {
  for (let t = 0; t < maxMs; t += 25) {
    if (/your turn/.test(g.byId('status').textContent)) return;
    g.wait(25);
  }
  throw new Error('never reached the input phase: ' + g.byId('status').textContent);
}

/* ------------------------------------------------------------ game: breakout */

test('Toast Breakout boots, launches on Space, breaks bricks, and pauses', () => {
  const g = bootGame('toast-breakout.html', { random: 0.1 });
  assert.equal(g.text('score'), '0');
  assert.equal(g.text('best'), '0');
  assert.equal(g.text('lives'), '\u2665\u2665\u2665');
  assert.equal(g.text('level'), '1');
  g.run(2);
  assert.match(g.screen(), /Tap or press Space/, 'the rack waits for a launch');
  assert.match(g.screen(), /to launch the toast/);

  // Space launches the toast; the ball then falls into the top rows.
  g.key(' ');
  g.clearScreen();
  g.run(900);
  const scored = Number(g.text('score'));
  assert.ok(scored > 0, `some bricks were cleared (score is ${scored})`);

  // P pauses from a known state, and the button flips to a play arrow.
  g.key('r');
  assert.equal(g.text('score'), '0');
  g.key(' ');
  g.run(10);
  g.key('p');
  g.clearScreen();
  g.run(3);
  assert.match(g.screen(), /Paused/);
  assert.match(g.screen(), /P to carry on/);
  assert.equal(g.byId('pause').textContent, '\u25b6');
  g.key('p');
  g.clearScreen();
  g.run(3);
  assert.doesNotMatch(g.screen(), /Paused/, 'P again resumes the rally');
  assert.equal(g.byId('pause').textContent, '\u23f8');
});

test('Toast Breakout moves the butter knife with the pointer and clamps it inside the field', () => {
  const g = bootGame('toast-breakout.html', { random: 0.1 });
  g.run(1);
  const paddleX = () => g.moveWithStyle(KNIFE_FILL).x - KNIFE_RADIUS;
  assert.ok(g.moveWithStyle(KNIFE_FILL), 'the paddle was drawn');
  assert.equal(paddleX(), (420 - 78) / 2, 'the paddle starts centred');

  g.pointer('game', 'pointermove', { clientX: 210, clientY: 300 });
  g.run(1);
  assert.ok(Math.abs(paddleX() + 39 - 210) < 1.5, `the paddle centres on the pointer (x=${paddleX()})`);

  g.pointer('game', 'pointermove', { clientX: 420, clientY: 300 });
  g.run(1);
  assert.equal(paddleX(), 420 - 78 - 6, 'the paddle stops at the right wall');

  g.pointer('game', 'pointermove', { clientX: -50, clientY: 300 });
  g.run(1);
  assert.equal(paddleX(), 6, 'the paddle stops at the left wall');

  // Arrow keys steer it too, and are held while the key is down.
  g.key('ArrowRight');
  g.run(20);
  g.keyUp('ArrowRight');
  const afterKeys = paddleX();
  assert.ok(afterKeys > 6, `the arrow keys moved the paddle (x=${afterKeys})`);
  g.run(20);
  assert.equal(paddleX(), afterKeys, 'letting go stops it');
});

test('Toast Breakout costs a life per dropped slice, closes the kitchen, and stores the best score', () => {
  const g = bootGame('toast-breakout.html', { random: 0.1 });
  g.key('r');
  g.pointer('game', 'pointermove', { clientX: 0, clientY: 300 });   // park the knife on the left
  g.key(' ');

  const seen = [];
  let lives = g.text('lives');
  let frames = 0;
  let closed = false;
  while (frames < 6000 && !closed) {
    g.run(20);
    frames += 20;
    g.clearScreen();
    g.run(1);
    if (g.text('lives') !== lives) { seen.push(lives + ' > ' + g.text('lives')); lives = g.text('lives'); }
    if (/Tap or press Space/.test(g.screen())) { g.key(' '); g.clearScreen(); }
    closed = /Kitchen closed/.test(g.screen());
  }

  assert.ok(closed, 'the kitchen closes once every life is gone');
  assert.equal(lives, '\u2014', 'no lives left');
  assert.deepEqual(seen, [
    '\u2665\u2665\u2665 > \u2665\u2665',
    '\u2665\u2665 > \u2665',
    '\u2665 > \u2014'
  ], 'one heart goes per dropped slice');
  assert.match(g.screen(), /R for a fresh rack/);
  const score = Number(g.text('score'));
  assert.ok(score > 0, `bricks were broken before the end (${score})`);
  assert.equal(g.localStorage.getItem('toast-breakout-best'), String(score), 'the best score was stored');
  assert.equal(g.text('best'), String(score));

  // And a click after the end starts a fresh rack.
  g.pointer('game', 'pointerdown', { clientX: 210, clientY: 400 });
  assert.equal(g.text('score'), '0');
  assert.equal(g.text('lives'), '\u2665\u2665\u2665');
  assert.equal(g.text('level'), '1');
});

test('Toast Breakout breaks a whole rack and names the rack it just cleared', () => {
  const g = bootGame('toast-breakout.html', { random: 0.1 });
  g.key('r');
  g.key(' ');

  let cleared = -1;
  let deaths = 0;
  let lives = g.text('lives');
  for (let i = 0; i < 12000 && cleared < 0; i++) {
    g.run(1);
    if (g.text('lives') !== lives) { deaths += 1; lives = g.text('lives'); }
    const ball = g.moveWithStyle(TOAST_FILL);
    // Aim left of centre so the toast sweeps the rack instead of bouncing straight up.
    if (ball) g.pointer('game', 'pointermove', { clientX: ball.x + 3.5 - 22, clientY: 0 });
    if (/Level \d+ cleared/.test(g.screen())) { cleared = i; break; }
    g.clearScreen();
  }

  assert.ok(cleared > 0, 'the whole rack was broken');
  assert.equal(deaths, 0, 'a piloted paddle never drops a slice');
  assert.equal(g.text('lives'), '\u2665\u2665\u2665');
  assert.ok(Number(g.text('score')) > 900, `a full rack scores well (${g.text('score')})`);
  assert.match(g.screen(), /Level 1 cleared!/, 'the banner names the rack that was broken, not the next one');
  assert.match(g.screen(), /Space for the next rack/);

  g.key(' ');
  assert.equal(g.text('level'), '2', 'the next rack is level 2');
  assert.ok(Number(g.text('score')) > 900, 'the score carries over between racks');
});

/* --------------------------------------------------------------- game: snake */

test('Kitchen Snake starts on any arrow key, crashes into a wall, and restarts with R', () => {
  const g = bootGame('kitchen-snake.html', { random: 0.5 });
  assert.equal(g.text('length'), '3');
  assert.equal(g.text('score'), '0');
  g.run(2);
  assert.match(g.screen(), /Any arrow key starts it/);

  // The snake starts heading right, so ArrowRight must still get it moving.
  g.key('ArrowRight');
  g.run(40, 20);
  g.clearMoves();
  g.run(1, 20);
  const head = cellOf(g.moveWithStyle(SNAKE_HEAD.style), SNAKE_HEAD);
  assert.ok(head.x > 10, `ArrowRight starts the run (head is at column ${head.x})`);

  // Now head up into the top wall.
  g.key('ArrowUp');
  for (let i = 0; i < 200 && !/Ouch/.test(g.screen()); i++) g.run(6, 20);
  assert.match(g.screen(), /Ouch/, 'running into a wall ends the run');
  assert.match(g.screen(), /the wall/);
  assert.match(g.screen(), /press R or tap/);

  g.key('r');
  assert.equal(g.text('length'), '3');
  assert.equal(g.text('score'), '0');
});

test('Kitchen Snake wraps around when walls are off, and pauses on P', () => {
  const g = bootGame('kitchen-snake.html', { random: 0.5 });
  g.run(1);
  assert.equal(g.byId('walls').textContent, '\ud83e\uddf1 Walls');
  g.click('walls');
  assert.equal(g.byId('walls').getAttribute('aria-pressed'), 'false');
  assert.equal(g.byId('walls').textContent, '\ud83c\udf00 Wrap');

  // Straight up for far longer than the board is tall: wrap-around visits every row.
  g.key('ArrowUp');
  const rows = new Set();
  for (let i = 0; i < 400; i++) {
    g.clearMoves();
    g.run(1, 20);
    const mark = g.moveWithStyle(SNAKE_HEAD.style);
    if (mark) rows.add(cellOf(mark, SNAKE_HEAD).y);
  }
  assert.equal(rows.size, SNAKE_GRID, 'the head wrapped through every row of the board');
  assert.doesNotMatch(g.screen(), /Ouch/);

  g.key('p');
  g.clearScreen();
  g.run(3, 20);
  assert.match(g.screen(), /Paused/);
  assert.equal(g.byId('pause').textContent, '\u25b6');
  g.key('p');
  g.clearScreen();
  g.run(3, 20);
  assert.doesNotMatch(g.screen(), /Paused/);
});

test('Kitchen Snake eats strawberries, grows, and steers from keys and the pad alike', () => {
  const run = pilotSnake(bootGame('kitchen-snake.html', { random: 0.25 }), 900);
  assert.ok(run.longest > 3, `the snake grew (longest was ${run.longest})`);
  assert.ok(run.highScore > 0, `strawberries were eaten (${run.highScore})`);
  assert.ok(run.steps > 800);

  // A second seed, to be sure it is the game and not one lucky board.
  const other = pilotSnake(bootGame('kitchen-snake.html', { random: 0.75 }), 900);
  assert.ok(other.longest > 3, `the snake grew again (longest was ${other.longest})`);
  assert.ok(other.highScore > 0, `and ate again (${other.highScore})`);
});

/* --------------------------------------------------------------- game: whisk */

test('Waffle Whisk teaches a sequence, then advances a round per correct repeat', () => {
  // A fixed random means the recipe is always bowl 0, so the test can play perfectly.
  const g = bootGame('waffle-whisk.html', { random: 0 });
  const bowls = g.document.querySelectorAll('.bowl');
  assert.equal(bowls.length, 4);
  assert.deepEqual(bowls.map(b => b.getAttribute('data-key')), ['1', '2', '3', '4']);
  assert.equal(g.text('round'), '1', 'the readout starts on round 1, never round 0');
  assert.equal(g.text('best'), '0');
  assert.equal(g.text('strikes'), '\u2665\u2665\u2665');
  assert.match(g.byId('status').textContent, /Watch the bowls, then repeat the recipe/);

  g.click('start');
  assert.match(g.byId('status').textContent, /watch the bowls/i);
  waitForTurn(g);
  assert.match(g.byId('status').textContent, /Round 1 \u2014 your turn \(1 bowl\)/);

  g.click(bowls[0]);
  g.wait(800);
  assert.equal(g.text('round'), '2', 'a correct repeat starts the next round');
  waitForTurn(g);
  assert.match(g.byId('status').textContent, /Round 2 \u2014 your turn \(2 bowls\)/);

  g.click(bowls[0]);
  g.click(bowls[0]);
  g.wait(800);
  assert.equal(g.text('round'), '3');
  waitForTurn(g);
  assert.match(g.byId('status').textContent, /Round 3 \u2014 your turn \(3 bowls\)/);

  // An eager finger in the beat between rounds must not restart or cost a strike.
  g.click('start');
  waitForTurn(g);
  g.click(bowls[0]);
  assert.match(g.byId('status').textContent, /Yes! Round 1 complete/, 'the repeat was accepted');
  g.click(bowls[3]);
  g.click(bowls[1]);
  assert.equal(g.text('strikes'), '\u2665\u2665\u2665', 'taps in the gap cost nothing');
  assert.equal(g.text('round'), '1', 'the next round has not been dealt yet');
  waitForTurn(g);
  assert.equal(g.text('round'), '2', 'and the run carried on instead of restarting');
  assert.match(g.byId('status').textContent, /Round 2 \u2014 your turn/);

  // Tapping during playback is ignored too, and Start always begins again.
  g.click('start');
  g.click(bowls[2]);
  assert.equal(g.text('strikes'), '\u2665\u2665\u2665', 'early taps cost nothing');
  assert.equal(g.text('round'), '1', 'and restarting begins again at round 1');
});

test('Waffle Whisk costs a strike in lenient mode and replays the recipe', () => {
  const g = bootGame('waffle-whisk.html', { random: 0 });
  const bowls = g.document.querySelectorAll('.bowl');
  g.click('start');
  waitForTurn(g);

  g.click(bowls[3]);                              // wrong: the recipe was bowl 0
  assert.equal(g.text('strikes'), '\u2665\u2665', 'one strike used');
  assert.match(g.byId('status').textContent, /Not quite \u2014 2 strikes left/);
  waitForTurn(g);
  assert.match(g.byId('status').textContent, /your turn/, 'the recipe was replayed');

  g.click(bowls[0]);
  g.wait(800);
  assert.equal(g.text('round'), '2', 'the round still counts after a mistake');

  // Two more mistakes end it, and the best round is kept.
  waitForTurn(g);
  g.click(bowls[1]);
  assert.equal(g.text('strikes'), '\u2665');
  waitForTurn(g);
  g.click(bowls[1]);
  assert.equal(g.text('strikes'), '\u2014');
  assert.match(g.byId('status').textContent, /Out of strikes/);
  assert.match(g.byId('status').textContent, /reached round 2/);
  assert.equal(g.text('best'), '2');
  assert.equal(g.localStorage.getItem('waffle-whisk-best'), '2');
});

test('Waffle Whisk ends on the first wrong bowl in strict mode', () => {
  const g = bootGame('waffle-whisk.html', { random: 0 });
  const bowls = g.document.querySelectorAll('.bowl');
  g.click('strict');
  assert.equal(g.byId('strict').getAttribute('aria-pressed'), 'true');
  assert.equal(g.byId('strict').textContent, '\ud83d\ude2c Strict');
  assert.equal(g.text('strikes'), 'strict', 'strict mode drops the hearts at once');

  g.click('start');
  waitForTurn(g);
  g.click(bowls[0]);
  g.wait(800);
  assert.equal(g.text('round'), '2');
  waitForTurn(g);
  g.click(bowls[1]);
  assert.match(g.byId('status').textContent, /One wrong bowl ends it in strict mode/);
  assert.match(g.byId('status').textContent, /reached round 2/);
  assert.equal(g.text('best'), '2');
  assert.equal(g.localStorage.getItem('waffle-whisk-best'), '2');

  // Going back to lenient restores three hearts.
  g.click('strict');
  assert.equal(g.byId('strict').getAttribute('aria-pressed'), 'false');
  assert.equal(g.byId('strict').textContent, '\ud83d\ude0c Lenient');
  assert.equal(g.text('strikes'), '\u2665\u2665\u2665');
});

test('Waffle Whisk is playable from the keyboard and can be muted', () => {
  const g = bootGame('waffle-whisk.html', { random: 0 });
  g.key('m');
  assert.equal(g.byId('sound').textContent, '\ud83d\udd07');
  g.click('sound');
  assert.equal(g.byId('sound').textContent, '\ud83d\udd0a');

  g.key('Enter');
  waitForTurn(g);
  g.key('1');
  g.wait(800);
  assert.equal(g.text('round'), '2', 'key 1 presses the coral bowl');
  waitForTurn(g);
  g.key('d');                                     // also the coral bowl
  g.key('d');
  g.wait(800);
  assert.equal(g.text('round'), '3', 'D F J K map onto the same four bowls');
  waitForTurn(g);
  g.key('f');
  assert.equal(g.text('strikes'), '\u2665\u2665', 'F is the honey bowl, which was not in the recipe');
});

/* ---------------------------------------------------------------- game: glide */

test('Syrup Glide flaps on Space, dies on the worktop, and glides again on tap', () => {
  const g = bootGame('syrup-glide.html', { random: 0 });
  assert.equal(g.text('score'), '0');
  assert.equal(g.text('best'), '0');
  assert.equal(g.text('speed'), '1.0');
  g.run(2);
  assert.match(g.screen(), /Syrup Glide/);
  assert.match(g.screen(), /Tap or press Space to flap/);

  const waffle = g.lastSprite();
  assert.ok(waffle, 'the waffle was drawn');
  assert.equal(waffle.x, 108, 'the waffle flies at a fixed distance along the shelf run');
  assert.ok(waffle.y > 200 && waffle.y < 320, `it hovers before the first flap (y=${waffle.y.toFixed(1)})`);

  g.key(' ');
  g.clearScreen();
  g.run(4);
  assert.doesNotMatch(g.screen(), /Syrup Glide/, 'the banner goes away once you are flying');
  assert.ok(g.lastSprite().y < waffle.y, 'a flap lifts the waffle');

  // With a deterministic pantry the waffle cannot clear the first shelf.
  g.run(500);
  g.clearScreen();
  g.run(4);
  assert.match(g.screen(), /Splat!/, 'hitting a shelf or the worktop ends the glide');
  assert.match(g.screen(), /Tap again for another glide/);

  g.canvas.dispatchEvent(new FakeEvent('pointerdown', { clientX: 200, clientY: 300 }));
  g.clearScreen();
  g.run(3);
  assert.match(g.screen(), /Syrup Glide/, 'tapping after a crash starts a fresh glide');
  assert.equal(g.text('score'), '0');
});

test('Syrup Glide is survivable: a piloted waffle passes shelves and speeds up', () => {
  const g = bootGame('syrup-glide.html', { random: 0 });
  g.key(' ');
  let bestScore = 0;
  for (let beat = 0; beat < 900; beat++) {
    const pos = g.lastSprite();
    if (pos && pos.y > 160) g.key(' ');            // flap whenever the waffle sinks
    g.run(1);
    bestScore = Math.max(bestScore, Number(g.text('score')));
    if (/Splat!/.test(g.screen())) break;
  }
  assert.ok(bestScore >= 5, `shelves were passed (best was ${bestScore})`);
  assert.ok(Number(g.text('speed')) > 1, 'the pantry speeds up as the score climbs');
  assert.doesNotMatch(g.screen(), /Splat!/, 'a steady flap rhythm survives the run');
});

test('Syrup Glide mutes, restarts, and honours reduced motion', () => {
  const g = bootGame('syrup-glide.html', { random: 0, reduceMotion: true });
  g.run(2);
  g.click('sound');
  assert.equal(g.byId('sound').textContent, '\ud83d\udd07');
  g.key('m');
  assert.equal(g.byId('sound').textContent, '\ud83d\udd0a');
  g.key(' ');
  g.run(60);
  g.click('restart');
  assert.equal(g.text('score'), '0');
  g.run(3);
  assert.match(g.screen(), /Syrup Glide/);
  assert.equal(g.text('best'), '0');
  // Reduced motion keeps the flight, it only drops the particles and the shake.
  g.key(' ');
  g.run(120);
  assert.ok(g.lastSprite(), 'the waffle still flies with reduced motion');
});

/* ------------------------------------------- vendored MIT-licensed guests */

const VENDORED = [
  {
    file: 'invaders/index.html',
    id: 'andromeda-invaders',
    title: 'Andromeda Invaders',
    holder: 'Susam Pal',
    repo: 'https://github.com/susam/invaders',
    website: 'https://susam.net/invaders.html'
  },
  {
    file: 'spacepi/index.html',
    id: 'spacepi',
    title: 'SpacePi',
    holder: 'Jack Rugile',
    repo: 'https://github.com/jackrugile/spacepi-js13k',
    website: 'http://js13kgames.com/entries/spacepi/'
  }
];

test('the two vendored games are MIT-licensed, credited, and load nothing at runtime', () => {
  const catalogue = JSON.parse(fs.readFileSync('games/catalog.json', 'utf8'));
  for (const v of VENDORED) {
    const html = fs.readFileSync(`${CABINET}/${v.file}`, 'utf8');
    const licence = fs.readFileSync(`${CABINET}/${v.file.replace('index.html', 'LICENSE')}`, 'utf8');

    // MIT requires the copyright notice to travel with the code.
    assert.match(licence, /MIT/);
    assert.ok(licence.includes(v.holder), `${v.id}: the shipped licence names ${v.holder}`);
    assert.ok(licence.includes('Permission is hereby granted'), `${v.id}: the full MIT grant is shipped`);

    // One injected line, and nothing else, joins it to the cabinet.
    assert.ok(html.includes('<script src="../../arcade-controls.js"></script>'), `${v.id}: back button injected`);
    assert.ok(!/<script[^>]+src\s*=\s*["']https?:/i.test(html), `${v.id}: loads no external script`);
    assert.ok(!/<link[^>]+href\s*=\s*["']https?:/i.test(html), `${v.id}: loads no external style or font`);
    assert.ok(!html.includes('iframe'), `${v.id}: no iframe`);
    assert.ok(!/schoolgames/i.test(html), `${v.id}: no retired folder name`);

    const entry = catalogue.find(g => g.id === v.id);
    assert.ok(entry, `${v.id} is catalogued`);
    assert.equal(entry.title, v.title);
    assert.equal(entry.origin, 'github');
    assert.equal(entry.repo, v.repo, `${v.id} credits its upstream repository`);
    assert.equal(entry.website, v.website);
    assert.equal(entry.license, `MIT (${v.holder})`);
    assert.equal(entry.entrypoint, `games/cabinet/${v.file}`);
    assert.ok(entry.controls.length > 10, `${v.id} explains its controls`);
    assert.notEqual(entry.license, 'BiteSizedUtilities (the-creative-master)', `${v.id} is not claimed as in-house`);
  }
});

test('Andromeda Invaders boots, paints its screen, plays, and pauses', () => {
  const g = bootGame('invaders/index.html', { random: 0.5 });
  g.run(20);
  const opening = g.ops();
  assert.ok(opening > 50, `the opening screen is painted (${opening} ops)`);

  // Space/P starts it: the animation loop is a 20 ms setTimeout, not rAF.
  g.key(' ');
  const playing = g.ops();
  g.run(200);
  assert.ok(g.ops() > playing + 500, `the loop animates while playing (${playing} -> ${g.ops()})`);

  // Steer with every documented movement key; the loop must survive them all.
  const afterKeys = g.ops();
  g.key('ArrowLeft'); g.run(20); g.keyUp('ArrowLeft');
  g.key('KeyD'); g.run(20); g.keyUp('KeyD');
  g.key('KeyA'); g.run(20); g.keyUp('KeyA');
  g.key('KeyM'); g.run(10);                       // mute
  assert.ok(g.ops() > afterKeys + 100, `steering keeps drawing (${afterKeys} -> ${g.ops()})`);

  // P pauses: the frame freezes. P again resumes: it animates.
  g.key('KeyP');
  const paused = g.ops();
  g.run(10);
  assert.equal(g.ops(), paused, 'pausing freezes the frame');
  g.key('KeyP');
  g.run(100);
  assert.ok(g.ops() > paused + 200, `resuming animates again (${paused} -> ${g.ops()})`);

  // E/Enter opens the on-canvas credits and licence screen, then leaves it.
  const beforeInfo = g.ops();
  g.key('KeyE');
  g.run(10);
  assert.ok(g.ops() > beforeInfo, 'the info screen is drawn on the canvas');
  g.key('KeyE');
  g.run(30);
  assert.ok(g.scheduled().timers >= 1, 'the game is still alive after leaving the info screen');
});

test('SpacePi boots into its menu, starts a base, and defends it with a dragged line', () => {
  const g = bootGame('spacepi/index.html', { random: 0.5 });
  g.run(10);
  assert.equal(g.ops(), 0, 'the menu is DOM, not canvas');

  g.click('play-game-button');
  const levels = g.document.querySelectorAll('.level');
  assert.equal(levels.length, 13, 'thirteen bases to defend');
  assert.equal(levels[0].getAttribute('rel'), '0', 'the level buttons carry their index');

  g.click(levels[0]);
  g.run(30);
  assert.equal(g.scheduled().timers, 1, 'the level loop is running on a timer');
  assert.ok(g.ops() > 1000, `the level is painted (${g.ops()} ops)`);

  // Drag a defence line on the canvas, then let the level run.
  const canvas = g.byId('c');
  assert.ok(canvas, 'the play canvas is wired by id');
  const before = g.ops();
  g.pointer(canvas, 'mousedown', { clientX: 200, clientY: 200 });
  g.pointer(canvas, 'mousemove', { clientX: 260, clientY: 240 });
  g.run(20);
  g.pointer(canvas, 'mouseup', { clientX: 260, clientY: 240 });
  g.run(400);
  assert.ok(g.ops() > before + 5000, `the loop keeps painting (${before} -> ${g.ops()})`);
  assert.equal(g.scheduled().timers, 1, 'still alive after the line was drawn');

  // Pause with the space bar, as the game documents.
  g.key(' ');
  g.run(20);
  assert.equal(g.scheduled().timers, 0, 'the loop stops while paused');
  g.key(' ');
  g.run(20);
  assert.equal(g.scheduled().timers, 1, 'and starts again');
});
