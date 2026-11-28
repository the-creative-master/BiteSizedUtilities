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
  TVBR_OFFERED_TEXT_MODEL_IDS,
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

test('the menu is the eight models Waffle AI offers, cheapest download first', () => {
  // 1.3.1 changes three entries at once: Qwen 3.5 0.8B comes off (it stays in
  // the table as the ONNX vision engine), MiniCPM-V 4.6 and SmolLM3 3B go on.
  assert.deepEqual(OFFERED_TEXT_MODEL_IDS, [
    'qwen2.5-0.5b', 'qwen3-0.6b', 'falcon3-1b', 'smollm2-360m',
    'qwen2.5-1.5b', 'smollm2-1.7b', 'minicpm-v-4.6', 'smollm3-3b'
  ]);
  assert.deepEqual(offeredTextModels().map(m => m.id), OFFERED_TEXT_MODEL_IDS);
  // 1.2.6 put every model in the normal kitchen and ordered the menu by what a
  // model costs to fetch, because on a tablet that is the only order a list of
  // models gets read in.
  const ladder = offeredTextModels().map(m => m.ggufMB);
  assert.deepEqual(ladder, [...ladder].sort((a, b) => a - b), 'top to bottom is cheap to expensive');
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
    'deepseek-r1-1.5b', 'gemma2-2b', 'granite-code-0.5b', 'llama3.2-1b', 'llama3.2-3b',
    'minicpm-2b', 'qwen2.5-0.8b-placeholder', 'qwen2.5-3b', 'qwen2.5-coder-1.5b', 'qwen3.5-0.8b', 'smollm2-135m'
  ].filter(x => !x.includes('placeholder')), 'off the public menu, and still readable by id');
  assert.equal(TEXT_MODELS.length, 18,
    'the ten 1.2 shipped, plus Falcon 3 1B, the reserved Granite, the four the test kitchen grew into, and the two 1.3.1 added');
  // Coming off a menu is not coming out of the table, and 1.3.1 is the clearest
  // case yet: the model that left is still loadable, still routes photos, and is
  // still what a visitor's stored preference resolves to.
  const leftTheMenu = TEXT_MODELS.find(m => m.id === 'qwen3.5-0.8b');
  assert.ok(leftTheMenu, 'Qwen 3.5 0.8B is still in the table');
  assert.match(leftTheMenu.badge, /Off the menu/, 'and says so where a picker would have shown it');
  assert.match(leftTheMenu.badge, /vision engine/i, 'including what it is still for');
  // SmolLM2 135M is the one 1.2.6 retired: SmolLM2 360M took its place. A
  // visitor who chose it before has it in localStorage, and the source reports
  // still price it by id, so it stays in the table and comes off the menu.
  const retired = TEXT_MODELS.find(m => m.id === 'smollm2-135m');
  assert.ok(retired, 'the retired model is still in the table');
  assert.match(retired.badge, /Off the menu/, 'and it says so where a picker would have shown it');
  assert.match(retired.desc, /retired from the menu in 1\.2\.6/, 'in the line a visitor would read');
  assert.ok(TEXT_MODELS.some(m => m.id === 'smollm2-360m'), 'its replacement is in the table too');

  // 1.3 TVBR 4 opened the seam between the kitchens again, so "off the public
  // menu" and "on no menu at all" are different lists for the first time since
  // 1.2.6: four models are in the test kitchen and nowhere else. One of the five
  // that are on neither is reserved for CodeHub's error diagnostics and its
  // weights have not arrived: it must not be pickable and must not be
  // downloadable, and both fall out of it being on neither list.
  // "On no menu" and "not used" are different things, and 1.3.1 is the first
  // time the list has to say so: Qwen 3.5 0.8B is pickable nowhere, and the
  // kitchen still routes every attached photo to it when the projector path
  // cannot run. The other five are genuinely dormant.
  const reserved = TEXT_MODELS.filter(m => !ALL_OFFERED_TEXT_MODEL_IDS.includes(m.id)).map(m => m.id).sort();
  assert.deepEqual(reserved, [
    'deepseek-r1-1.5b', 'granite-code-0.5b', 'llama3.2-1b', 'qwen2.5-0.8b', 'qwen2.5-coder-1.5b', 'qwen3.5-0.8b', 'smollm2-135m'
  ].filter(x => x !== 'qwen2.5-0.8b'), 'on neither menu');
  assert.deepEqual(reserved.filter(x => x !== 'qwen3.5-0.8b'), [
    'deepseek-r1-1.5b', 'granite-code-0.5b', 'llama3.2-1b', 'qwen2.5-coder-1.5b', 'smollm2-135m'
  ], 'on no menu at all, in either kitchen');
  assert.deepEqual(gone.filter(id => !reserved.includes(id)).sort(), [
    'gemma2-2b', 'llama3.2-3b', 'minicpm-2b', 'qwen2.5-3b'
  ], 'and exactly the four the test kitchen offers are on one menu and not the other');
  const granite = TEXT_MODELS.find(m => m.id === 'granite-code-0.5b');
  assert.equal(granite.arrivesIn, 'a later update', 'it says when it is coming instead of guessing a repo');
  assert.equal(granite.hfGgufRepo, undefined, 'and there is no repo to be wrong about');
});

test('the two kitchens offer different menus again, and the seam between them still works', () => {
  // 1.2 TVAR 1 was the tighter set: a wider menu got compared for reliability in
  // the second kitchen before the public one was asked to live with it. It had
  // been tested, so 1.2.6 made it the only menu. 1.3 TVBR 4 uses the seam the
  // way it was built to be used — four models above the 1.7B, with repo paths
  // that could not be checked from where they were written, get tried on one
  // device before everybody is asked to download them. The switch is still the
  // same one the rest of the build uses, so there is no second mechanism.
  assert.equal(offeredModelIds(), OFFERED_TEXT_MODEL_IDS, 'no page means no test build');

  const store = shimStorage();
  globalThis.document = { documentElement: { dataset: { backup: '1' } } };
  try {
    assert.equal(offeredModelIds(), TVBR_OFFERED_TEXT_MODEL_IDS, 'the backup build reads its own constant');
    // No longer expressible as "the public list, then the four": 1.3.1 put a
    // 3B on the public menu that outweighs every model held back for testing,
    // so appending them would have buried a 1.5 GB download under a 2.53 GB one.
    assert.deepEqual(TVBR_OFFERED_TEXT_MODEL_IDS, [
      'qwen2.5-0.5b', 'qwen3-0.6b', 'falcon3-1b', 'smollm2-360m',
      'qwen2.5-1.5b', 'smollm2-1.7b',
      'minicpm-2b', 'minicpm-v-4.6', 'llama3.2-3b', 'qwen2.5-3b', 'gemma2-2b', 'smollm3-3b'
    ], 'the test kitchen is the public menu plus the four, interleaved by cost');
    const tvbrLadder = offeredTextModels().map(m => m.ggufMB);
    assert.deepEqual(tvbrLadder, [...tvbrLadder].sort((a, b) => a - b),
      'and its ladder is still cheapest download first, all twelve of them');
    const four = TVBR_OFFERED_TEXT_MODEL_IDS.filter(id => !OFFERED_TEXT_MODEL_IDS.includes(id));
    assert.deepEqual(four, ['minicpm-2b', 'llama3.2-3b', 'qwen2.5-3b', 'gemma2-2b'],
      'the four held back are the same four, wherever the cost order puts them');
    assert.ok(four.every(id => TEXT_MODELS.find(m => m.id === id).ggufMB > 1050),
      'and every one of them is heavier than the 1.7B the public menu used to stop at');
    assert.ok(TVBR_OFFERED_TEXT_MODEL_IDS !== OFFERED_TEXT_MODEL_IDS,
      'as two separate lists, not one alias: a model tested in the second kitchen must not appear in the first');
    assert.deepEqual(offeredTextModels().map(m => m.id), TVBR_OFFERED_TEXT_MODEL_IDS, 'and the menu renders in that order');
    for (const m of offeredTextModels()) {
      assert.ok(m.label && m.desc && m.badge, `${m.id} can be shown in the picker`);
      assert.ok(m.hfGgufRepo && m.ggufFile, `${m.id} has a GGUF source to load from`);
    }
    assert.ok(!offeredTextModels().some(m => m.arrivesIn), 'nothing on a menu is waiting for weights');

    // Both builds share one localStorage, so a choice made in one kitchen is
    // read in the other. For the seven models both offer, that is continuity.
    setSelectedTextModel('falcon3-1b');
    assert.equal(getSelectedTextModel(), 'falcon3-1b', 'offered here, so it sticks');
    // An id on neither menu is refused rather than stored, and refusing it must
    // not cost the visitor the choice they had already made.
    setSelectedTextModel('deepseek-r1-1.5b');
    assert.equal(getSelectedTextModel(), 'falcon3-1b', 'a model on no menu cannot be chosen, and the last valid choice survives');
  } finally {
    delete globalThis.document;
  }
  assert.equal(getSelectedTextModel(), 'falcon3-1b',
    'and it survives the trip back to the public page, because that page offers it too');

  // Reopening the seam puts the old hazard back, so it is pinned here rather than
  // rediscovered on a device: the four can be chosen in the test kitchen, and the
  // public page refuses them and falls back to the default. That loses a
  // preference, not a working app — which is the trade the seam has always cost.
  globalThis.document = { documentElement: { dataset: { backup: '1' } } };
  try {
    setSelectedTextModel('qwen2.5-3b');
    assert.equal(getSelectedTextModel(), 'qwen2.5-3b', 'the test kitchen offers it, so it sticks there');
  } finally {
    delete globalThis.document;
  }
  assert.equal(getSelectedTextModel(), DEFAULT_TEXT_MODEL_ID,
    'the public page does not, and falls back to the default rather than to a model it has no entry for');
  delete globalThis.localStorage;
  store.clear();

  assert.deepEqual(ALL_OFFERED_TEXT_MODEL_IDS, [...TVBR_OFFERED_TEXT_MODEL_IDS],
    'the union of both menus is the test kitchen\'s: the public eight plus the four held back');
  assert.equal(new Set(ALL_OFFERED_TEXT_MODEL_IDS).size, ALL_OFFERED_TEXT_MODEL_IDS.length, 'and it has no duplicates');
  assert.equal(allOfferedTextModels().length, 12);
  // The invariant the cost-ordered rewrite could have quietly broken: a model
  // must be tryable in the test kitchen before it is served in the public one.
  assert.ok(OFFERED_TEXT_MODEL_IDS.every(id => TVBR_OFFERED_TEXT_MODEL_IDS.includes(id)),
    'everything the public kitchen serves, the test kitchen can serve too');
});

test('the four the test kitchen grew into price themselves honestly', () => {
  // None of these sizes could be measured here: this sandbox has no route to
  // huggingface.co, same as every other arithmetic figure in the table. What is
  // pinned is not that the numbers are right — the repo tree prices the real
  // file before anything downloads, and the source report shows the measured
  // size on the device — but that each one says where it came from, that it was
  // rounded in the safe direction, and that the figure a visitor reads in the
  // picker is the figure the fit check weighs.
  const src = fs.readFileSync('waffle-browser-ai.js', 'utf8');
  const four = ['minicpm-2b', 'llama3.2-3b', 'qwen2.5-3b', 'gemma2-2b'];
  const models = four.map(id => TEXT_MODELS.find(m => m.id === id));
  assert.ok(models.every(Boolean), 'all four are in the table');

  assert.deepEqual(four.filter(id => OFFERED_TEXT_MODEL_IDS.includes(id)), [],
    'and none of them is on the public menu: four repo paths nobody could check from here are tried in one kitchen first');
  // A set membership, not a position: the test kitchen's menu is cost-ordered
  // now, and the public menu has a 3B heavier than all four, so "the last four
  // entries" is no longer the same statement as "the four held back".
  assert.deepEqual(
    TVBR_OFFERED_TEXT_MODEL_IDS.filter(id => !OFFERED_TEXT_MODEL_IDS.includes(id)), four,
    'all four are on the test kitchen\'s, and only those four');

  // Each says which sibling it was scaled from, rather than presenting a
  // bytes-per-weight rule of thumb as though it were a measurement.
  assert.match(src, /Scaled from SmolLM2 1\.7B in this table/, 'the 2B MiniCPM names the model it was scaled from');
  assert.match(src, /Scaled from the Llama 3\.2 1B this table has carried since 1\.2/, 'and so does the 3B Llama');
  assert.match(src, /881\.6 MB for the 1\.5B's real 1\.78B parameters/, 'the 3B Qwen is scaled from the one measured figure in the table');
  assert.match(src, /0\.59B at two bytes is/, 'and Gemma is priced from its parts, because a quarter of it is a vocabulary');

  // The direction of the rounding is the part that matters: ggufMB is a ceiling,
  // so a low figure fails a load that would have worked and tells the visitor to
  // raise a number they cannot see.
  assert.match(src, /rounded \*up\*, because ggufMB is a ceiling rather/, 'the block says which way it rounded and why');
  assert.match(src, /arithmetic, not measurements/, 'and that it could not measure any of them');
  for (const m of models) assert.ok(m.ggufMB >= 1500, `${m.id} is above the 1.7B the public menu stops at`);

  // The picker and the budget must not disagree. A badge that says ~1.8 GB over
  // a ggufMB of 1800 is the same number twice; if either is edited alone the
  // visitor reads one size and the fit check weighs another.
  for (const m of models) {
    const gb = `~${String(parseFloat((m.ggufMB / 1000).toFixed(2)))} GB`;
    assert.ok(m.badge.includes(gb), `${m.id}: the badge says ${gb} (${m.badge})`);
    assert.ok(m.desc.includes(gb), `${m.id}: and so does the line under it`);
    assert.ok(m.ggufMB > 400, `${m.id} is over the self-hosting ceiling, so a deploy never ships it inside the site`);
  }
  const script = fs.readFileSync('scripts/fetch-model.mjs', 'utf8');
  assert.match(script, /const MAX_MODEL_MB = 400;/, 'which is the ceiling the pre-cache script selects under');

  // The 1.7B stopped being the biggest thing on any menu in 1.3.1, when a 3B
  // and a 1.3B vision model joined it. Its badge used to claim the title; a
  // superlative the picker repeats on every open is a lie that outlives the
  // edit that made it false, so nothing on a menu claims one now.
  const big = TEXT_MODELS.find(m => m.id === 'smollm2-1.7b');
  assert.ok(!/biggest/i.test(big.badge), 'the 1.7B no longer claims a title it lost');
  assert.ok(!big.desc.includes('the biggest model here'), 'and no longer claims to be the biggest model, full stop');
  for (const m of offeredTextModels()) {
    assert.ok(!/biggest/i.test(m.badge), `${m.id}: no badge on the menu claims to be the biggest`);
  }
  const heaviest = offeredTextModels().reduce((a, b) => (b.ggufMB > a.ggufMB ? b : a));
  assert.equal(heaviest.id, 'smollm3-3b', 'the 3B is what actually tops the public menu');
  assert.ok(heaviest.badge.includes('~2.53 GB') && heaviest.badge.includes('~1.92 GB'),
    'and its badge states the ceiling it is budgeted at and the quant it starts from');
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
    'smollm2-1.7b': ['Q2_K', 'Q3_K_L', 'Q4_K_M', 'Q5_K_M', 'Q6_K'],
    'minicpm-2b': ['Q4_K_M', 'Q5_K_M', 'Q6_K'],
    'llama3.2-3b': ['Q3_K_L', 'Q4_K_M', 'Q5_K_M', 'Q6_K'],
    'qwen2.5-3b': ['Q3_K_L', 'Q4_K_M', 'Q5_K_M', 'Q6_K'],
    'minicpm-v-4.6': ['Q4_K_M'],
    'smollm3-3b': ['Q4_K_M', 'Q5_K_M', 'Q6_K'],
    'gemma2-2b': ['Q4_K_M', 'Q5_K_M', 'Q6_K']
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
    'smollm2-1.7b': ['Q4_K_M', 'Q2_K', 'Q3_K_L', 'Q5_K_M', 'Q6_K'],
    'minicpm-2b': ['Q4_K_M', 'Q5_K_M', 'Q6_K'],
    'llama3.2-3b': ['Q4_K_M', 'Q3_K_L', 'Q5_K_M', 'Q6_K'],
    'qwen2.5-3b': ['Q4_K_M', 'Q3_K_L', 'Q5_K_M', 'Q6_K'],
    'minicpm-v-4.6': ['Q4_K_M'],
    'smollm3-3b': ['Q4_K_M', 'Q5_K_M', 'Q6_K'],
    'gemma2-2b': ['Q4_K_M', 'Q5_K_M', 'Q6_K']
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

test('the default is the smallest model a deploy serves from its own origin', () => {
  assert.equal(DEFAULT_TEXT_MODEL_ID, 'qwen2.5-0.5b');
  // It used to be Qwen 2.5 1.5B, a `server` model, which on a static host means
  // the first message falls back through the whole chain before anything runs.
  // Then it was SmolLM2 135M. The rule that picks it has not changed: the
  // smallest model on the menu that a deploy pre-caches, so the first message
  // does not depend on reaching somebody else's server.
  assert.ok(OFFERED_TEXT_MODEL_IDS.includes(DEFAULT_TEXT_MODEL_ID),
    'the default is on the menu — getSelectedTextModel falls back to it, so a default nobody can pick would leave the picker empty');
  assert.equal(OFFERED_TEXT_MODEL_IDS[0], DEFAULT_TEXT_MODEL_ID, 'and first on it, since the menu is a download ladder');
  const def = TEXT_MODELS.find(m => m.id === DEFAULT_TEXT_MODEL_ID);
  assert.ok(def.ggufMB <= 400, `${def.ggufMB} MB is inside the per-model ceiling a deploy self-hosts under`);
  assert.ok(offeredTextModels().every(m => m.ggufMB >= def.ggufMB), 'and nothing on the menu is cheaper to fetch');
  const store = shimStorage();
  try {
    assert.equal(getSelectedTextModel(), DEFAULT_TEXT_MODEL_ID, 'nothing stored means the default');
    assert.equal(def.kind, 'browser');
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
