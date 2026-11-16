import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cupboards } from '../catalog.js';

// Minimal DOM shim for mounting and verifying all 10 Math & Numbers utilities
function installDomShim() {
  class FakeNode {
    constructor(tag) {
      this.tagName = tag.toUpperCase();
      this.attrs = {};
      this.children = [];
      this.listeners = {};
      this.style = {};
      this.value = '';
      this.className = '';
      this.hidden = false;
      this.parentNode = null;
      this._text = '';
      this.classList = {
        _set: new Set(),
        add: (...c) => c.forEach(x => { this.classList._set.add(x); this._syncClass(); }),
        remove: (...c) => c.forEach(x => { this.classList._set.delete(x); this._syncClass(); }),
        toggle: (c, f) => {
          const on = f !== undefined ? Boolean(f) : !this.classList._set.has(c);
          if (on) this.classList._set.add(c); else this.classList._set.delete(c);
          this._syncClass();
        },
        contains: c => this.classList._set.has(c)
      };
    }
    _syncClass() { this.className = [...this.classList._set].join(' '); }
    set className(v) {
      this._className = String(v || '');
      if (this.classList) this.classList._set = new Set(this._className.split(/\s+/).filter(Boolean));
    }
    get className() { return this._className || ''; }
    setAttribute(k, v) {
      this.attrs[k] = String(v);
      if (k === 'value') this.value = String(v);
    }
    getAttribute(k) { return this.attrs[k] ?? null; }
    addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
    dispatchEvent(ev) {
      for (const fn of this.listeners[ev.type] || []) fn(ev);
    }
    append(...nodes) {
      for (const n of nodes) {
        if (typeof n === 'string') {
          this.children.push({ textContent: n, nodeType: 3 });
        } else if (n) {
          n.parentNode = this;
          this.children.push(n);
        }
      }
    }
    replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
    set textContent(t) { this._text = String(t); this.children = [{ textContent: this._text, nodeType: 3 }]; }
    get textContent() {
      if (this.children.length === 0) return this._text;
      return this.children.map(c => c.textContent || '').join('');
    }
    set innerHTML(h) { this._innerHTML = h; }
    get innerHTML() { return this._innerHTML || ''; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 200, height: 20 }; }
    setSelectionRange() {}
    focus() {}
    getContext() {
      return {
        clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
        stroke() {}, fill() {}, arc() {}, fillText() {}, setLineDash() {}
      };
    }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    querySelectorAll(sel) {
      const cls = sel.startsWith('.') ? sel.slice(1) : null;
      const out = [];
      const walk = node => {
        if (!node || !node.children) return;
        for (const c of node.children) {
          if (c instanceof FakeNode) {
            if (cls && c.className.split(/\s+/).includes(cls)) out.push(c);
            else if (!cls && c.tagName.toLowerCase() === sel.toLowerCase()) out.push(c);
            walk(c);
          }
        }
      };
      walk(this);
      return out;
    }
  }

  globalThis.document = {
    createElement: tag => new FakeNode(tag),
    createTextNode: text => ({ textContent: String(text), nodeType: 3 })
  };
  return FakeNode;
}

test('all 10 Math & Numbers utilities mount and function with zero default HTML range/select inputs', async () => {
  const FakeNode = installDomShim();
  const { MATH_NUMBER_TOOLS } = await import('../tools-math-numbers.js');
  const mathCupboard = cupboards.find(c => c.id === 'math');
  assert.equal(mathCupboard.tools.length, 10);

  for (const [id] of mathCupboard.tools) {
    const root = new FakeNode('div');
    assert.ok(Object.hasOwn(MATH_NUMBER_TOOLS, id), `Missing tool: ${id}`);
    MATH_NUMBER_TOOLS[id](root);
    assert.ok(root.children.length > 0, `${id} rendered empty`);
    // Ensure zero <select> and zero <input type="range">
    assert.equal(root.querySelectorAll('select').length, 0, `${id} uses forbidden <select>`);
    const ranges = root.querySelectorAll('input').filter(i => i.attrs.type === 'range');
    assert.equal(ranges.length, 0, `${id} uses forbidden <input type="range">`);
  }

  // Verify Sequence Playground has all 8 required sequence tiles
  const seqRoot = new FakeNode('div');
  MATH_NUMBER_TOOLS['sequence-playground'](seqRoot);
  const tiles = seqRoot.querySelectorAll('.seq-tile').map(t => t.textContent);
  assert.equal(tiles.length, 8);
  for (const expected of ['Fibonacci', 'Triangular', 'Square', 'Cube', 'Prime', 'Palindromic', 'Happy numbers', 'Perfect numbers']) {
    assert.ok(tiles.some(txt => txt.includes(expected)), `Missing sequence tile: ${expected}`);
  }

  // Verify Roman Numeral Calculator renders vinculum overline for large numbers
  const romRoot = new FakeNode('div');
  MATH_NUMBER_TOOLS['roman-numerals'](romRoot);
  assert.ok(romRoot.querySelectorAll('.vinculum').length > 0, 'Expected vinculum overline element for 25,400');

  // Verify Number Base Converter populates all 5 bases (2, 8, 10, 16, 36)
  const baseRoot = new FakeNode('div');
  MATH_NUMBER_TOOLS['number-base'](baseRoot);
  const baseVals = baseRoot.querySelectorAll('.base-input').map(i => i.value);
  assert.deepEqual(baseVals, ['11111111', '377', '255', 'FF', '73']);
});

test('CSS follows strict 2.5D game art rules (no frosted blur, local fonts)', () => {
  const css = fs.readFileSync('style.css', 'utf8');
  assert.equal(/backdrop-filter/i.test(css), false, 'No frosted blur allowed');
  assert.ok(css.includes('Fredoka'), 'Uses bold rounded Fredoka font');
  assert.ok(css.includes('Nunito'), 'Uses bold rounded Nunito font');
  assert.ok(css.includes('rotateY(-108deg)'), 'Includes 2.5D cupboard hinge swing animation');
});

test('README.md has been removed as requested', () => {
  assert.equal(fs.existsSync('README.md'), false, 'README.md should be removed');
});
