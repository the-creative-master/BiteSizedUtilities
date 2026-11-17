import test from 'node:test';
import assert from 'node:assert/strict';
import { cupboards, allTools } from '../catalog.js';
import { mountMathScience } from '../tools-math-science.js';
import { mountCode } from '../tools-code.js';
import { mountTextArt } from '../tools-text-art.js';

function makeDOMShim() {
  class FakeEvent {
    constructor(type) { this.type = type; this.defaultPrevented = false; }
    preventDefault() { this.defaultPrevented = true; }
  }
  class FakeElement {
    constructor(tagName) {
      this.tagName = tagName.toUpperCase();
      this.children = [];
      this.parentNode = null;
      this.attrs = {};
      this.style = {};
      this.dataset = {};
      this.listeners = {};
      this._text = '';
      this.value = '';
      this.checked = false;
      this.hidden = false;
      this.disabled = false;
      this.isConnected = true;
      this.classList = {
        add: (...cls) => {
          const set = new Set((this.className || '').split(/\s+/).filter(Boolean));
          for (const c of cls) set.add(c);
          this.className = [...set].join(' ');
        },
        remove: (...cls) => {
          const set = new Set((this.className || '').split(/\s+/).filter(Boolean));
          for (const c of cls) set.delete(c);
          this.className = [...set].join(' ');
        },
        toggle: (c, force) => {
          const set = new Set((this.className || '').split(/\s+/).filter(Boolean));
          const has = set.has(c);
          const next = force === undefined ? !has : Boolean(force);
          if (next) set.add(c); else set.delete(c);
          this.className = [...set].join(' ');
          return next;
        },
        contains: c => (this.className || '').split(/\s+/).includes(c)
      };
    }
    get nodeType() { return 1; }
    get ownerDocument() { return globalThis.document; }
    get parentElement() { return this.parentNode; }
    get textContent() { return this._text || this.children.map(c => c.textContent ?? String(c)).join(''); }
    set textContent(v) { this._text = String(v); this.children = []; }
    get innerHTML() { return this.textContent; }
    set innerHTML(v) { this._text = String(v); this.children = []; }
    setAttribute(k, v) {
      this.attrs[k] = String(v);
      if (k === 'class') this.className = String(v);
      if (k.startsWith('data-')) this.dataset[k.slice(5)] = String(v);
    }
    getAttribute(k) { return this.attrs[k] ?? null; }
    append(...nodes) {
      for (const n of nodes) {
        if (n && typeof n === 'object') { n.parentNode = this; this.children.push(n); }
        else if (n != null) this.children.push({ nodeType: 3, textContent: String(n) });
      }
    }
    replaceChildren(...nodes) { this.children = []; this._text = ''; this.append(...nodes); }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(c => c !== this); }
    contains(el) {
      if (el === this) return true;
      return this.children.some(c => typeof c.contains === 'function' && c.contains(el));
    }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    dispatchEvent(evt) {
      for (const fn of this.listeners[evt.type] || []) fn.call(this, evt);
    }
    querySelector(sel) {
      return this.querySelectorAll(sel)[0] || null;
    }
    querySelectorAll(sel) {
      const out = [];
      const visit = node => {
        for (const c of node.children || []) {
          if (c.nodeType !== 1) continue;
          const tag = c.tagName.toLowerCase();
          const type = c.type || c.attrs?.type;
          const match =
            (sel === 'select' && tag === 'select') ||
            (sel === 'input[type="range"]' && tag === 'input' && type === 'range') ||
            (sel === 'input[type="checkbox"]' && tag === 'input' && type === 'checkbox') ||
            (sel === 'input[type="color"]' && tag === 'input' && type === 'color') ||
            (sel.startsWith('.') && (c.className || '').split(/\s+/).includes(sel.slice(1)));
          if (match) out.push(c);
          visit(c);
        }
      };
      visit(this);
      return out;
    }
    getContext() {
      return {
        fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', filter: 'none', imageSmoothingEnabled: true,
        fillRect() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, arc() {}, ellipse() {}, rect() {},
        roundRect() {}, clip() {}, stroke() {}, fill() {}, setLineDash() {}, save() {}, restore() {},
        translate() {}, rotate() {}, scale() {}, drawImage() {}, fillText() {},
        createLinearGradient() { return { addColorStop() {} }; },
        createRadialGradient() { return { addColorStop() {} }; },
        getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData() {}
      };
    }
    getBoundingClientRect() { return { left: 0, top: 0, width: 320, height: 180 }; }
    focus() {}
  }
  const doc = {
    documentElement: new FakeElement('html'),
    body: new FakeElement('body'),
    createElement: tag => new FakeElement(tag),
    createTextNode: text => ({ nodeType: 3, textContent: String(text) })
  };
  globalThis.document = doc;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.Event = FakeEvent;
  globalThis.MutationObserver = class { observe() {} disconnect() {} };
  globalThis.DOMParser = class {
    parseFromString() {
      return {
        querySelector: () => null,
        documentElement: { localName: 'svg', namespaceURI: 'http://www.w3.org/2000/svg' },
        body: { textContent: '', querySelectorAll: () => [] }
      };
    }
  };
  globalThis.XMLSerializer = class { serializeToString() { return '<svg></svg>'; } };
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  return { FakeElement };
}

test('all 70 utilities across all 5 cupboards render with cozy 2.5D game UI and zero default HTML select/range/checkbox/color controls', () => {
  const { FakeElement } = makeDOMShim();
  assert.equal(allTools.length, 70);

  for (const t of allTools) {
    const root = new FakeElement('div');
    let ok = false;
    if (t.cupboard === 'math' || t.cupboard === 'science') ok = mountMathScience(t.id, root);
    else if (t.cupboard === 'code') ok = mountCode(t.id, root);
    else ok = mountTextArt(t.id, root);

    assert.ok(ok, `${t.cupboard}/${t.id} should mount cleanly`);
    assert.ok(root.querySelectorAll('.game-panel').length >= 1, `${t.id} must use .game-panel`);
    assert.equal(root.querySelectorAll('select').length, 0, `${t.id} must NOT use <select>`);
    assert.equal(root.querySelectorAll('input[type="range"]').length, 0, `${t.id} must NOT use <input type="range">`);
    assert.equal(root.querySelectorAll('input[type="checkbox"]').length, 0, `${t.id} must NOT use <input type="checkbox">`);
    assert.equal(root.querySelectorAll('input[type="color"]').length, 0, `${t.id} must NOT use <input type="color">`);
  }
});
