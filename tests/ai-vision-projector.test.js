// 1.3.1 puts a vision model on the public menu, and takes the previous one off
// it. Both halves are easy to get wrong in the same direction: a vision model
// whose projector never loads is a chat model wearing a misleading name, and a
// model removed from a menu must not be removed from the kitchen that still
// routes photos to it. These pin the wiring rather than the intent.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  TEXT_MODELS,
  OFFERED_TEXT_MODEL_IDS,
  TVBR_OFFERED_TEXT_MODEL_IDS,
  ALL_OFFERED_TEXT_MODEL_IDS,
  offeredTextModels
} from '../waffle-browser-ai.js';

const byId = id => TEXT_MODELS.find(m => m.id === id);
const aiSrc = fs.readFileSync('waffle-browser-ai.js', 'utf8');
const uiSrc = fs.readFileSync('waffle-ai.js', 'utf8');

test('the recommended vision model is priced as two files, because it is two files', () => {
  const vlm = byId('minicpm-v-4.6');
  assert.ok(vlm, 'it is in the table');
  assert.ok(OFFERED_TEXT_MODEL_IDS.includes(vlm.id), 'and on the public menu');
  assert.equal(vlm.hfGgufRepo, 'openbmb/MiniCPM-V-4.6-gguf', 'from the maker, not a mirror');
  assert.equal(vlm.hfGgufQuant, 'Q4_K_M');
  assert.deepEqual(vlm.ggufQuants, ['Q4_K_M'], 'one quant, so the budget is a number and not a range');
  assert.equal(vlm.mmprojFile, 'mmproj-model-f16.gguf', 'and it names the projector it cannot see without');

  // 529 MB of Q4_K_M plus a 1.11 GB f16 projector, both read off the
  // repository's own tree. What the device holds is the total, so the total is
  // what the budget carries: pricing this model as its language file alone
  // would under-state it by 1.11 GB, which is most of a phone's wasm budget.
  assert.equal(vlm.mmprojMB, 1110, 'the projector is budgeted');
  assert.equal(vlm.ggufMB, 529 + 1110, 'and the budget is the two files added together');
  assert.match(vlm.badge, /Recommended/, 'the menu says which one is recommended');
  assert.match(vlm.badge, /~1\.64 GB/, 'in the same number the fit check weighs');
  assert.match(vlm.desc, /~1\.64 GB/, 'and the line under it agrees');
  assert.match(vlm.desc, /529 MB/, 'broken down, so nobody has to guess which half is which');
  assert.match(vlm.desc, /1\.11 GB/, 'including the projector');
  assert.ok(!vlm.hfId, 'no ONNX build is invented for it: its vision goes through the projector path');

  const projectors = TEXT_MODELS.filter(m => m.mmprojFile);
  assert.equal(projectors.length, 1, 'exactly one entry declares a projector');
  assert.equal(projectors[0].id, 'minicpm-v-4.6');
});

test('the projector file can never be picked as the model', () => {
  // A vision repo publishes its projector beside the weights, both ending in
  // .gguf. The candidate filter is what stops a resolver looking for "the
  // smallest Q-whatever in here" from loading 1.11 GB of clip encoder and
  // calling it a language model.
  assert.match(aiSrc, /function ggufCandidates\(files\) \{/, 'the filter exists');
  const fn = aiSrc.slice(aiSrc.indexOf('function ggufCandidates(files) {'));
  assert.match(fn.slice(0, 300), /!\/mmproj\/i\.test\(f\.path\)/,
    'and it excludes anything named mmproj');
});

test('a photo is routed to the model that can see, and that model is found rather than named', () => {
  // Found, not hardcoded: a second list saying "this one is the vision model"
  // is a second chance for the routing and the table to disagree.
  assert.match(uiSrc, /TEXT_MODELS\.find\(m => m\.mmprojFile && m\.hfGgufRepo\)/,
    'the photo chain asks the table which entry declares a projector');
  assert.match(uiSrc, /pushWllama\(true, projectorModel, true\);\s*\n\s*pushWllama\(false, projectorModel, true\);/,
    'and tries it on the GPU path and the CPU path');
  assert.match(uiSrc, /mmprojFile: m\.mmprojFile \|\| null/, 'the projector name travels with the attempt');
  assert.match(uiSrc, /const onnxVisionId = 'qwen3\.5-0\.8b';/,
    'the ONNX vision path is still behind it, so a projector that fails to load is not the end of the chain');
  assert.match(uiSrc, /vision \?\s*imageUrls : \[\]/, 'and only a vision step is handed the photos');
  assert.match(uiSrc, /mmprojFile: step\.mmprojFile \|\| null, imageUrls: step\.vision \? imageUrls : \[\]/,
    'both reach the loader that needs them');
  assert.match(uiSrc, /MiniCPM-V 4\.6 with its projector, or Qwen 3\.5 0\.8B Vision/,
    'the message a visitor reads when neither could run names both, not just the old one');
});

test('the projector loads for a turn that has a photo, and never for one that does not', () => {
  assert.match(aiSrc, /const wantsVision = Array\.isArray\(imageUrls\) && imageUrls\.length > 0;/);
  assert.match(aiSrc, /wantsVision && mmprojFile && hfRepo \? ggufUrlFor\(hfRepo, mmprojFile\) : null/,
    'the projector URL is built from a repo and a filename that both exist');
  assert.match(aiSrc, /\.\.\.\(mmprojUrl \? \{ mmprojUrl \} : \{\}\)/,
    'and it is only added to the load parameters when there is one');
  // 1.11 GB of weights a text turn would pay for twice — in download and in
  // heap — is the cost this guard exists to avoid.
  assert.ok(!/\.\.\.\(mmprojFile \? \{ mmprojUrl/.test(aiSrc), 'it is not keyed on the config alone');
  assert.match(aiSrc, /if \(wantsVision && !mmprojUrl\) \{/, 'a turn with a photo and no projector');
  assert.match(aiSrc, /throw new Error\(`This model cannot see/,
    'refuses instead of running blind: describing a photo the model was never given produces fluent nonsense');
});

test('images are read as bytes and attached to the turn being answered', () => {
  assert.match(aiSrc, /return await r\.arrayBuffer\(\);/, 'the projector takes bytes, not a URL');
  assert.match(aiSrc, /Could not read attached image \$\{i \+ 1\}/,
    'and a photo that cannot be read is an error, not a turn that quietly loses it');
  assert.match(aiSrc, /i === fittedMsgs\.length - 1 && m\.role === 'user'/,
    'attached to the last user message only');
  assert.match(aiSrc, /\.\.\.imageBytes\.map\(data => \(\{ type: 'image', data \}\)\)/, 'before the text');
  assert.match(aiSrc, /\{ type: 'text', text: m\.content \}/, 'which stays the question being asked');
});

test('SmolLM3 3B states the sizes its repository actually publishes', () => {
  const m = byId('smollm3-3b');
  assert.ok(m && OFFERED_TEXT_MODEL_IDS.includes(m.id), 'it is on the public menu');
  assert.equal(m.hfGgufRepo, 'bartowski/HuggingFaceTB_SmolLM3-3B-GGUF');
  assert.equal(m.hfGgufQuant, 'Q4_K_M');
  assert.deepEqual(m.ggufQuants, ['Q4_K_M', 'Q5_K_M', 'Q6_K'], 'four bit and up: below that a 3B loses the reason to download a 3B');
  // Read off the repo tree, not scaled from a sibling: Q4_K_M 1.92 GB,
  // Q5_K_M 2.21 GB, Q6_K 2.53 GB. ggufMB is the ceiling the fit check budgets
  // against, so it carries the largest quant the range allows.
  assert.equal(m.ggufMB, 2530);
  assert.match(m.badge, /~2\.53 GB/, 'the badge says the ceiling');
  assert.match(m.badge, /~1\.92 GB/, 'and the quant it starts from');
  assert.match(m.desc, /~2\.53 GB/, 'so does the line under it');
  assert.match(aiSrc, /Q4_K_M 1\.92 GB/, 'and the entry says where the numbers came from');
  assert.ok(!m.hfId, 'GGUF only, like Falcon 3 1B, with no ONNX repo invented for it');
});

test('Qwen 3.5 0.8B came off the menu and stayed in the kitchen', () => {
  const m = byId('qwen3.5-0.8b');
  assert.ok(m, 'still in the table: deleting an entry breaks CI, the source reports and a stored preference');
  assert.ok(!OFFERED_TEXT_MODEL_IDS.includes(m.id), 'off the public menu');
  assert.ok(!TVBR_OFFERED_TEXT_MODEL_IDS.includes(m.id), 'and off the test kitchen’s — it is not being tried, it is being replaced');
  assert.ok(!ALL_OFFERED_TEXT_MODEL_IDS.includes(m.id), 'so no deploy pre-caches it any more');
  assert.match(m.badge, /Off the menu/, 'which the badge would have said if a picker ever showed it');
  assert.match(m.badge, /ONNX vision engine/, 'and what it is still for');
  assert.equal(m.loader, 'qwen3_5', 'the transformers.js vision path is intact');
  assert.match(m.desc, /MiniCPM-V 4\.6 took the vision slot/, 'the reason is written where the entry is');
  assert.match(aiSrc, /Qwen3_5ForConditionalGeneration/, 'the code that loads it is still there');
});

test('both menus still read cheapest first, and no badge claims a title it can lose', () => {
  const ladder = ids => ids.map(id => byId(id).ggufMB);
  const asc = a => a.every((v, i) => i === 0 || a[i - 1] <= v);
  const pub = ladder(OFFERED_TEXT_MODEL_IDS);
  const tvbr = ladder(TVBR_OFFERED_TEXT_MODEL_IDS);
  assert.ok(asc(pub), `the public menu ascends: ${pub.join(' ')}`);
  assert.ok(asc(tvbr), `and so does the test kitchen's: ${tvbr.join(' ')}`);
  // The 1.7B's badge used to say "Biggest on the public menu". A superlative is
  // a claim the picker repeats on every open, and it goes stale the first time
  // something heavier joins — which is exactly what happened.
  for (const m of offeredTextModels()) {
    assert.ok(!/biggest/i.test(m.badge), `${m.id} claims no superlative`);
  }
  assert.equal(pub.at(-1), 2530, 'the heaviest thing on the public menu is the 3B');
});
