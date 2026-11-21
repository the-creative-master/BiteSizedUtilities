// 1.2 cut the model menu to five. The table in waffle-browser-ai.js keeps every
// entry it has ever had — CI, the pre-cache budget, the source reports and a
// dozen tests all read it by id, and deleting an entry breaks them for no
// benefit — so what a visitor can pick is a separate list. These pin that
// nothing renders, honours or pre-caches a model that is not on it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  TEXT_MODELS,
  OFFERED_TEXT_MODEL_IDS,
  offeredTextModels,
  DEFAULT_TEXT_MODEL_ID,
  getSelectedTextModel,
  setSelectedTextModel
} from '../waffle-browser-ai.js';

function shimStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k)
  };
  return store;
}

test('the menu is the five models 1.2 offers, in the order they are listed', () => {
  assert.deepEqual(OFFERED_TEXT_MODEL_IDS,
    ['smollm2-135m', 'qwen3-0.6b', 'qwen3.5-0.8b', 'qwen2.5-1.5b', 'smollm2-1.7b']);
  assert.deepEqual(offeredTextModels().map(m => m.id), OFFERED_TEXT_MODEL_IDS);
  for (const m of offeredTextModels()) {
    assert.ok(m.label && m.desc && m.badge, `${m.id} can be shown in the picker`);
    assert.ok(m.hfGgufRepo && m.ggufFile, `${m.id} has a GGUF source`);
  }
});

test('the table keeps the models the menu stopped offering', () => {
  // This is the part that is easy to get wrong: cutting a menu is not deleting a
  // table. The five that are no longer offered are still here, still readable by
  // id, still priced by the pre-cache budget and still diagnosable by the source
  // report if somebody has one stored.
  const gone = TEXT_MODELS.filter(m => !OFFERED_TEXT_MODEL_IDS.includes(m.id)).map(m => m.id).sort();
  assert.deepEqual(gone, ['deepseek-r1-1.5b', 'llama3.2-1b', 'qwen2.5-0.5b', 'qwen2.5-coder-1.5b', 'smollm2-360m']);
  assert.equal(TEXT_MODELS.length, 10, 'nine entries plus SmolLM2 1.7B');
  assert.ok(TEXT_MODELS.some(m => m.id === 'smollm2-1.7b'), 'and the new one is really in the table');
});

test('a typo in the menu throws instead of quietly shortening it', () => {
  assert.throws(() => offeredTextModels([{ id: 'smollm2-135m' }]), /not in TEXT_MODELS/);
});

test('the picker and the pre-cache panel render the menu, not the archive', () => {
  const appSrc = fs.readFileSync('app.js', 'utf8');
  assert.equal(appSrc.split('offeredTextModels()').length - 1, 2,
    'the model list and the pre-cache rows both go through it');
  assert.ok(!/textList\.innerHTML = TEXT_MODELS\.map/.test(appSrc), 'the picker no longer renders the whole table');
  assert.ok(!/TEXT_MODELS\.filter\(m => m\.hfGgufRepo\)/.test(appSrc), 'nor does the pre-cache panel');

  const script = fs.readFileSync('scripts/fetch-model.mjs', 'utf8');
  assert.match(script, /selectSmallModels\(offeredTextModels\(TEXT_MODELS\)\)/,
    'and a deploy pre-caches what the menu offers, not weights nobody can pick');
});

test('the default is the model this site serves from its own origin', () => {
  assert.equal(DEFAULT_TEXT_MODEL_ID, 'smollm2-135m');
  const store = shimStorage();
  try {
    assert.equal(getSelectedTextModel(), DEFAULT_TEXT_MODEL_ID, 'nothing stored means the 135M');
    // It used to be Qwen 2.5 1.5B, a `server` model, which on a static host
    // means the first message falls back through the whole chain before anything
    // runs. The 135M is the one a deploy pre-caches, so it is the one that starts.
    assert.equal(TEXT_MODELS.find(m => m.id === DEFAULT_TEXT_MODEL_ID).kind, 'browser');
  } finally {
    delete globalThis.localStorage;
    store.clear();
  }
});

test('a preference for a model that is no longer offered is not honoured', () => {
  const store = shimStorage();
  try {
    setSelectedTextModel('deepseek-r1-1.5b');
    assert.equal(getSelectedTextModel(), DEFAULT_TEXT_MODEL_ID, 'an unoffered id is never stored');

    setSelectedTextModel('smollm2-1.7b');
    assert.equal(getSelectedTextModel(), 'smollm2-1.7b', 'an offered one is');

    // Somebody who picked a model before 1.2 has it in localStorage already, and
    // reading that back must not resurrect a model the menu dropped.
    const key = [...store.keys()].find(k => store.get(k) === 'smollm2-1.7b');
    assert.ok(key, 'the preference is stored under one key');
    store.set(key, 'llama3.2-1b');
    assert.equal(getSelectedTextModel(), DEFAULT_TEXT_MODEL_ID, 'and a stale one falls back to the default');
  } finally {
    delete globalThis.localStorage;
    store.clear();
  }
});

test('the two new decisions about size say where their numbers came from', () => {
  // Neither figure could be measured here: this sandbox has no route to
  // huggingface.co. Both are arithmetic from a parameter count, both say so in
  // the table, and neither is what a download is actually priced by — the fetch
  // script reads real sizes from the repo tree before it takes anything.
  const src = fs.readFileSync('waffle-browser-ai.js', 'utf8');
  assert.equal(src.split('Arithmetic, not a measurement').length - 1, 1, 'the F16 135M says so');
  assert.equal(src.split('Arithmetic again').length - 1, 1, 'and so does the 1.7B');

  const tiny = TEXT_MODELS.find(m => m.id === 'smollm2-135m');
  assert.equal(tiny.hfGgufQuant, 'F16', '1.2 asked for the 135M at full 16-bit');
  const big = TEXT_MODELS.find(m => m.id === 'smollm2-1.7b');
  assert.equal(big.hfGgufQuant, 'Q4_K_M');
  assert.ok(big.ggufMB > 400, 'over the self-hosting ceiling, so it is never shipped inside the site');
});
