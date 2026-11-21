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
  TVAR_OFFERED_TEXT_MODEL_IDS,
  ALL_OFFERED_TEXT_MODEL_IDS,
  offeredTextModels,
  allOfferedTextModels,
  offeredModelIds,
  quantListFor,
  quantRangeOrder,
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
  assert.deepEqual(gone, [
    'deepseek-r1-1.5b', 'falcon3-1b', 'granite-code-0.5b', 'llama3.2-1b',
    'qwen2.5-0.5b', 'qwen2.5-coder-1.5b', 'smollm2-360m'
  ], 'off the public menu, and three of them only because they are on the other one');
  assert.equal(TEXT_MODELS.length, 12, 'the ten 1.2 shipped, plus Falcon 3 1B and the reserved Granite');
  assert.ok(TEXT_MODELS.some(m => m.id === 'falcon3-1b'), 'and the new ones are really in the table');

  // One entry is in the table and on no menu at all: it is reserved for CodeHub's
  // error diagnostics, and its weights have not arrived. It must not be pickable,
  // and it must not be downloadable, and both of those fall out of it being on
  // neither list.
  const reserved = TEXT_MODELS.filter(m => !ALL_OFFERED_TEXT_MODEL_IDS.includes(m.id)).map(m => m.id).sort();
  assert.deepEqual(reserved, ['deepseek-r1-1.5b', 'granite-code-0.5b', 'llama3.2-1b', 'qwen2.5-coder-1.5b']);
  const granite = TEXT_MODELS.find(m => m.id === 'granite-code-0.5b');
  assert.equal(granite.arrivesIn, 'a later update', 'it says when it is coming instead of guessing a repo');
  assert.equal(granite.hfGgufRepo, undefined, 'and there is no repo to be wrong about');
});

test('the backup kitchen offers eight, and only the backup kitchen', () => {
  // 1.2 TVAR 1 is the tighter set: this is where a wider menu gets compared for
  // reliability before the public kitchen is asked to live with it. The switch is
  // the same one the rest of the build uses, so there is no second mechanism.
  assert.equal(offeredModelIds(), OFFERED_TEXT_MODEL_IDS, 'no page means no test build');

  const store = shimStorage();
  globalThis.document = { documentElement: { dataset: { backup: '1' } } };
  try {
    assert.equal(offeredModelIds(), TVAR_OFFERED_TEXT_MODEL_IDS);
    assert.deepEqual(TVAR_OFFERED_TEXT_MODEL_IDS, [
      'smollm2-135m', 'smollm2-360m', 'qwen2.5-0.5b', 'qwen3-0.6b',
      'qwen3.5-0.8b', 'falcon3-1b', 'qwen2.5-1.5b', 'smollm2-1.7b'
    ]);
    assert.deepEqual(offeredTextModels().map(m => m.id), TVAR_OFFERED_TEXT_MODEL_IDS, 'and the menu renders in that order');
    for (const m of offeredTextModels()) {
      assert.ok(m.label && m.desc && m.badge, `${m.id} can be shown in the picker`);
      assert.ok(m.hfGgufRepo && m.ggufFile, `${m.id} has a GGUF source to load from`);
    }
    assert.ok(!offeredTextModels().some(m => m.arrivesIn), 'nothing on a menu is waiting for weights');

    // A preference stored for a backup-only model must not be honoured on the
    // public page, and vice versa: the same localStorage is shared by both builds.
    setSelectedTextModel('falcon3-1b');
    assert.equal(getSelectedTextModel(), 'falcon3-1b', 'offered here, so it sticks');
    // An id on neither menu is refused rather than stored, and refusing it must
    // not cost the visitor the choice they had already made.
    setSelectedTextModel('deepseek-r1-1.5b');
    assert.equal(getSelectedTextModel(), 'falcon3-1b', 'a model on no menu cannot be chosen, and the last valid choice survives');
  } finally {
    delete globalThis.document;
  }
  assert.equal(getSelectedTextModel(), DEFAULT_TEXT_MODEL_ID, 'and falls back to the default once the page is not the backup build');
  delete globalThis.localStorage;
  store.clear();

  assert.deepEqual(ALL_OFFERED_TEXT_MODEL_IDS,
    [...OFFERED_TEXT_MODEL_IDS, 'smollm2-360m', 'qwen2.5-0.5b', 'falcon3-1b'],
    'the union adds exactly what the test build offers on top, with no duplicates');
  assert.equal(allOfferedTextModels().length, 8);
});

test('each model is limited to the quantisations it may be fetched at', () => {
  const byId = id => TEXT_MODELS.find(m => m.id === id);
  const ranges = {
    'smollm2-135m': ['F16'],
    'smollm2-360m': ['F16'],
    'qwen2.5-0.5b': ['Q4_K_M', 'Q5_K_M', 'Q6_K'],
    'qwen3-0.6b': ['Q4_K_M', 'Q5_K_M', 'Q6_K'],
    'qwen3.5-0.8b': ['Q3_K_L', 'Q4_K_M', 'Q5_K_M', 'Q6_K'],
    'falcon3-1b': ['Q3_K_L', 'Q4_K_M', 'Q5_K_M', 'Q6_K'],
    'qwen2.5-1.5b': ['Q3_K_L', 'Q4_K_M', 'Q5_K_M', 'Q6_K'],
    'smollm2-1.7b': ['Q2_K', 'Q3_K_L', 'Q4_K_M', 'Q5_K_M', 'Q6_K']
  };
  for (const [id, quants] of Object.entries(ranges)) {
    assert.deepEqual(byId(id).ggufQuants, quants, `${id} carries its range`);
    assert.ok(quants.includes(byId(id).hfGgufQuant), `${id} leads with a quant its own range allows`);
  }
  // What is tried first is the model's own quant, not the bottom of its range:
  // widening a list of what is allowed must never downgrade what is served.
  const leads = {
    'smollm2-135m': ['F16'],
    'smollm2-360m': ['F16'],
    'qwen2.5-0.5b': ['Q4_K_M', 'Q5_K_M', 'Q6_K'],
    'qwen3-0.6b': ['Q4_K_M', 'Q5_K_M', 'Q6_K'],
    'qwen3.5-0.8b': ['Q3_K_L', 'Q4_K_M', 'Q5_K_M', 'Q6_K'],
    'falcon3-1b': ['Q3_K_L', 'Q4_K_M', 'Q5_K_M', 'Q6_K'],
    'qwen2.5-1.5b': ['Q3_K_L', 'Q4_K_M', 'Q5_K_M', 'Q6_K'],
    'smollm2-1.7b': ['Q4_K_M', 'Q2_K', 'Q3_K_L', 'Q5_K_M', 'Q6_K']
  };

  // The range is a limit, not a preference with the preset chain behind it: a
  // preset must not be able to widen it back to a quant the range excluded.
  const store = shimStorage();
  try {
    for (const id of Object.keys(ranges)) {
      assert.deepEqual(quantListFor(byId(id)), leads[id], `${id} gets its range, lead first and nothing added`);
      assert.deepEqual([...quantListFor(byId(id))].sort(), [...ranges[id]].sort(), `${id} and exactly its range`);
    }
    // A model with no range of its own keeps the old behaviour.
    const legacy = byId('qwen2.5-coder-1.5b');
    assert.equal(legacy.ggufQuants, undefined);
    assert.equal(quantListFor(legacy)[0], legacy.hfGgufQuant, 'declared quant first');
    assert.ok(quantListFor(legacy).length > 1, 'with the preset chain behind it');
  } finally {
    delete globalThis.localStorage;
    store.clear();
  }

  // The browser and the download script have to want the same file, or the
  // weights a deploy ships are not the weights the loader looks for. One
  // exported rule, and a pin that both call it.
  const script = fs.readFileSync('scripts/fetch-model.mjs', 'utf8');
  assert.match(script, /quantRangeOrder\(cfg\)/, 'the download script asks the same rule');
  assert.match(script, /allOfferedTextModels, quantRangeOrder \} from '\.\.\/waffle-browser-ai\.js';/, 'instead of restating it');
  const ai = fs.readFileSync('waffle-browser-ai.js', 'utf8');
  assert.equal(ai.split('quantRangeOrder(').length - 1, 2, 'defined once and called by quantListFor — nowhere else in the browser, and nowhere else in the script');
  assert.deepEqual(quantRangeOrder(byId('smollm2-1.7b')), leads['smollm2-1.7b'], 'the rule is what the table shows');
  assert.equal(quantRangeOrder(byId('qwen2.5-coder-1.5b')), null, 'and a model with no range gets null, not an empty list');
  assert.match(script, /publishes none of \$\{cfg\.id\}'s allowed quants/,
    'and refuses a repo that has none of them, instead of taking the smallest file like it does for a preference');
  assert.match(ai, /\{ strict = false \} = \{\}\)/, 'the resolver can be told a list is a limit');
  assert.match(ai, /which the range excludes/, 'and says what it refused');
  assert.equal(ai.split('{ strict: Boolean(').length - 1, 2, 'both callers that resolve a file pass it');
  assert.match(fs.readFileSync('waffle-browser-ai.js', 'utf8'), /ggufQuants\?\.length \? ggufQuants\.slice\(\)/,
    'and so does the loader that resolves a file at run time');
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
  assert.match(script, /selectSmallModels\(allOfferedTextModels\(TEXT_MODELS\)\)/,
    'and a deploy pre-caches what either menu offers, not weights nobody can pick');
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
  // 1.2 TVAR 1 changed five sizes and added a model, and every one of them is a
  // figure nobody could measure from here. Each says so where it is written.
  assert.ok(src.split('Arithmetic').length - 1 >= 5, 'every size that was computed says it was computed');
  assert.equal(src.split('Measured, not guessed').length - 1, 1, 'and the one that was measured says that instead');

  const tiny = TEXT_MODELS.find(m => m.id === 'smollm2-135m');
  assert.equal(tiny.hfGgufQuant, 'F16', '1.2 asked for the 135M at full 16-bit');
  const big = TEXT_MODELS.find(m => m.id === 'smollm2-1.7b');
  assert.equal(big.hfGgufQuant, 'Q4_K_M', '1.2 TVAR 1 widened what it may be fetched at, not what it is fetched at');
  assert.equal(big.ggufMB, 1050, 'so the size it is budgeted by is still the quant it leads with');
  // ggufMB is the ceiling the real file is checked against, so it has to cover the
  // lead quant. Budgeting a model by the lightest thing its range allows fails
  // every load of the quant it actually asks for first.
  const budgetMsg = fs.readFileSync('waffle-browser-ai.js', 'utf8')
    .match(/the budget in the table is what the warnings[^`]*`/);
  assert.ok(budgetMsg, 'and the source report says as much when a real file exceeds it');
  for (const m of allOfferedTextModels()) {
    assert.ok(m.ggufMB >= 100, `${m.id} carries a size big enough to be a ceiling for its lead`);
  }
  assert.ok(big.ggufMB > 560, 'the 1.7B is not budgeted by the bottom of its range');
  assert.ok(big.ggufMB > 400, 'over the self-hosting ceiling, so it is never shipped inside the site');

  // The two 16-bit models are the expensive ones, and one of them is new to it.
  assert.equal(TEXT_MODELS.find(m => m.id === 'smollm2-360m').ggufMB, 720);
  assert.ok(TEXT_MODELS.find(m => m.id === 'smollm2-360m').ggufMB > 400,
    'which puts it over the ceiling too — it always downloads from Hugging Face');
  assert.equal(TEXT_MODELS.find(m => m.id === 'qwen3-0.6b').ggufMB, 385, 'the reliable one, at 4-bit');
  assert.ok(src.includes('cannot reach Hugging Face') || src.includes('no route to huggingface.co'),
    'and the table says why none of these could be measured');
});
