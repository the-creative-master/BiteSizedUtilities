import test from 'node:test';
import assert from 'node:assert/strict';
import { cupboards, allTools, backupToolAdditions, resolveTools } from '../catalog.js';
import { mountMathScience } from '../tools-math-science.js';
import { mountCode } from '../tools-code.js';
import { mountTextArt } from '../tools-text-art.js';
import { mountEnglish } from '../tools-english.js';
import { mountMusic } from '../tools-music.js';
import { mountVideo } from '../tools-video.js';

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
      // A real canvas or img reflects width/height back as properties, and tools
      // read them to map pointer coordinates onto the drawing surface.
      if ((k === 'width' || k === 'height') && /^(CANVAS|IMG)$/.test(this.tagName) && Number.isFinite(Number(v))) this[k] = Number(v);
    }
    getAttribute(k) { return this.attrs[k] ?? null; }
    append(...nodes) {
      for (const n of nodes) {
        if (n && typeof n === 'object') {
          // Real append() relocates a node: re-appending a child that is already
          // in the tree (or in another parent) moves it rather than cloning it.
          // Layer canvases are re-appended on every sync to keep paint order.
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
        querySelectorAll: () => [],
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

test('all 120 utilities across all 8 cupboards render with cozy 2.5D game UI and zero default HTML select/range/checkbox/color controls', () => {
  const { FakeElement } = makeDOMShim();
  assert.equal(allTools.length, 120);

  for (const t of allTools) {
    const root = new FakeElement('div');
    let ok = false;
    if (t.cupboard === 'math' || t.cupboard === 'science') ok = mountMathScience(t.id, root);
    else if (t.cupboard === 'code') ok = mountCode(t.id, root);
    else if (t.cupboard === 'english') ok = mountEnglish(t.id, root);
    else if (t.cupboard === 'music') ok = mountMusic(t.id, root);
    else if (t.cupboard === 'video') ok = mountVideo(t.id, root);
    else ok = mountTextArt(t.id, root);

    assert.ok(ok, `${t.cupboard}/${t.id} should mount cleanly`);
    assert.ok(root.querySelectorAll('.game-panel').length >= 1, `${t.id} must use .game-panel`);
    assert.equal(root.querySelectorAll('select').length, 0, `${t.id} must NOT use <select>`);
    assert.equal(root.querySelectorAll('input[type="range"]').length, 0, `${t.id} must NOT use <input type="range">`);
    assert.equal(root.querySelectorAll('input[type="checkbox"]').length, 0, `${t.id} must NOT use <input type="checkbox">`);
    assert.equal(root.querySelectorAll('input[type="color"]').length, 0, `${t.id} must NOT use <input type="color">`);
  }
});

/* ==================== Art Studio (with layers): mounted and driven for real ==================== */

function walk(node, out = []) {
  for (const c of node.children || []) {
    if (!c || c.nodeType === 3) continue;
    out.push(c);
    walk(c, out);
  }
  return out;
}
const byClass = (root, cls) => walk(root).filter(n => String(n.className || '').split(/\s+/).includes(cls));
const byLabel = (root, label) => walk(root).find(n => n.attrs?.['aria-label'] === label) || null;
const byText = (root, text) => walk(root).find(n => n.textContent === text) || null;
const click = node => { assert.ok(node, 'the control exists'); node.dispatchEvent(new Event('click')); };
const pointerEvent = (type, x, y, extra = {}) => ({
  type, button: 0, pointerId: 1, pointerType: 'pen', pressure: 0.6, clientX: x, clientY: y,
  preventDefault() {}, ...extra
});

test('Art Studio is the layered studio on the public page too, and the old id still opens it', () => {
  const { FakeElement } = makeDOMShim();
  assert.equal(backupToolAdditions.length, 0, '1.1.1 folded the extra studio into Art Studio');

  document.documentElement.dataset.backup = '0';
  const publicRoot = new FakeElement('div');
  assert.equal(mountTextArt('art-studio', publicRoot), true, 'index.html mounts it now');
  assert.equal(byClass(publicRoot, 'studio-stage').length, 1, 'and it is the layered studio, not the old one');

  document.documentElement.dataset.backup = '1';
  const root = new FakeElement('div');
  assert.equal(mountTextArt('art-studio-layers', root), true, 'a saved link to the retired tool still opens it');
  assert.equal(resolveTools(true).some(t => t.id === 'art-studio'), true);
  assert.ok(root.querySelectorAll('.game-panel').length >= 1, 'it uses the shared cozy panel');
  for (const banned of ['select', 'input[type="range"]', 'input[type="checkbox"]', 'input[type="color"]']) {
    assert.equal(root.querySelectorAll(banned).length, 0, `no default ${banned}`);
  }
  assert.equal(byClass(root, 'studio-stage').length, 1, 'one layer stack');
  assert.equal(byClass(root, 'studio-layer-row').length, 1, 'it opens with a single layer');
  assert.equal(byClass(root, 'studio-layer-canvas').length, 1);
  assert.ok(byClass(root, 'studio-chip').length >= 12, 'every blend mode is offered');
  assert.ok(byText(root, '↩ Undo') && byText(root, '↪ Redo'), 'undo and redo are on the panel');
});

test('driving the layered studio: layers, strokes, undo order, merge and flatten', () => {
  const { FakeElement } = makeDOMShim();
  document.documentElement.dataset.backup = '1';
  const root = new FakeElement('div');
  mountTextArt('art-studio-layers', root);
  const stage = byClass(root, 'studio-stage')[0];
  const status = () => byClass(root, 'output')[0].textContent;
  const rows = () => byClass(root, 'studio-layer-row').length;
  const canvases = () => byClass(root, 'studio-layer-canvas').length;
  assert.equal(rows(), 1);

  // A stroke on the empty document is undoable on its own.
  stage.dispatchEvent(pointerEvent('pointerdown', 20, 20));
  stage.dispatchEvent(pointerEvent('pointermove', 60, 40));
  stage.dispatchEvent(pointerEvent('pointermove', 140, 90));
  stage.dispatchEvent(pointerEvent('pointerup', 140, 90));
  assert.equal(rows(), 1, 'drawing does not invent layers');

  click(byLabel(root, 'Add a layer above'));
  assert.equal(rows(), 2);
  assert.equal(canvases(), 2, 'a new layer gets its own canvas');
  click(byLabel(root, 'Add a layer above'));
  assert.equal(rows(), 3);
  assert.match(status(), /3 layers/, 'every layer op confirms itself and the new count');

  // Undo unwinds the newest action first: the second add, then the first.
  click(byText(root, '↩ Undo'));
  assert.equal(rows(), 2);
  click(byText(root, '↩ Undo'));
  assert.equal(rows(), 1);
  assert.match(status(), /Undid/);
  click(byText(root, '↪ Redo'));
  assert.equal(rows(), 2, 'redo brings the layer back');
  click(byText(root, '↪ Redo'));
  assert.equal(rows(), 3);

  // Hiding a layer flips its own accessible label.
  click(byLabel(root, 'Hide Layer 3'));
  assert.ok(byLabel(root, 'Show Layer 3'), 'the eye button now offers to show it again');
  click(byLabel(root, 'Show Layer 3'));

  // Raising the bottom layer moves it, and the panel still lists three.
  click(byLabel(root, 'Raise Layer 1'));
  assert.equal(rows(), 3);

  // A locked layer refuses ink rather than silently swallowing the stroke.
  click(byText(root, 'Lock active layer'));
  stage.dispatchEvent(pointerEvent('pointerdown', 30, 30));
  assert.match(status(), /locked/i);
  click(byText(root, 'Lock active layer'));

  // Merging and flattening both collapse the stack, and both are undoable.
  click(byLabel(root, 'Merge the active layer down'));
  assert.equal(rows(), 2);
  click(byText(root, '↩ Undo'));
  assert.equal(rows(), 3, 'undo rebuilds the merged layer');
  click(byLabel(root, 'Flatten every visible layer'));
  assert.equal(rows(), 1);
  assert.equal(canvases(), 1, 'the hidden canvases are released');
  assert.ok(byClass(root, 'studio-layer-row')[0].textContent.includes('Flattened'));
  click(byText(root, '↩ Undo'));
  assert.equal(rows(), 3, 'flattening is not a one-way door');

  // Deleting is allowed down to a single layer, and the last one is protected.
  click(byLabel(root, 'Delete Layer 3'));
  assert.equal(rows(), 2);
  click(byLabel(root, 'Delete Layer 2'));
  assert.equal(rows(), 1);
  click(byLabel(root, 'Delete Layer 1'));
  assert.equal(rows(), 1, 'the last layer survives');
  assert.match(status(), /last layer cannot be deleted/i, 'and it says why');
});
