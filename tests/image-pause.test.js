// Image generation is paused in 1.3. These tests hold the pause where it is
// meant to be: one function, read by every surface that offers an image or
// starts one, so that unpausing is a one-line change rather than a hunt.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { isImageGenPaused, IMAGE_GEN_PAUSE_MESSAGE } from '../waffle-image-gen.js';

const engineSrc = fs.readFileSync('waffle-image-gen.js', 'utf8');
const aiSrc = fs.readFileSync('waffle-ai.js', 'utf8');
const appSrc = fs.readFileSync('app.js', 'utf8');

test('the pause is real, and is one function', () => {
  assert.equal(isImageGenPaused(), true, 'image generation is off in this release');
  assert.match(engineSrc, /export function isImageGenPaused\(\) \{\n  return true;\n\}/,
    'and reversing it is a single literal, not a search through two files');
});

test('the notice says why, and does not promise a date', () => {
  assert.match(IMAGE_GEN_PAUSE_MESSAGE, /paused/, 'it names the state plainly');
  assert.match(IMAGE_GEN_PAUSE_MESSAGE, /needs WebGPU/, 'it gives the reason');
  assert.match(IMAGE_GEN_PAUSE_MESSAGE, /no fallback/, 'including the part that makes it a pause and not a setting');
  assert.match(IMAGE_GEN_PAUSE_MESSAGE, /later update/, 'it says the feature is coming back');
  assert.ok(!/\b(soon|tomorrow|next week|\d{4}-\d{2}-\d{2})\b/.test(IMAGE_GEN_PAUSE_MESSAGE),
    'and it commits to no date it cannot keep');
});

test('the run refuses before it creates a progress bubble it cannot fill', () => {
  const run = aiSrc.slice(aiSrc.indexOf('async function runImageGeneration'));
  const gate = run.indexOf('if (isImageGenPaused()) {');
  assert.ok(gate > 0, 'runImageGeneration checks the pause');
  // The order is the whole point. A paused run that pushed the "Preparing…"
  // bubble first would announce a run and then explain itself, which reads as a
  // failure rather than as a feature that is off.
  assert.ok(gate < run.indexOf('imageProgress'), 'before any progress state exists');
  assert.ok(gate < run.indexOf('noteImageRun'), 'and before the run is written to the survival record');
  assert.ok(gate < run.indexOf('isGenerating = true'), 'and it never claims to be generating');

  const gated = run.slice(gate, run.indexOf('const imgCfg = activeImageCfg();'));
  assert.match(gated, /role: 'user'/, 'the visitor’s prompt is still echoed');
  assert.match(gated, /IMAGE_GEN_PAUSE_MESSAGE/, 'and answered with the notice');
  assert.match(gated, /renderMessages\(\);\n    syncComposerState\(\);\n    return;/,
    'so the thread reads as answered rather than dropped');
});

test('the picker says "this is off", not "your device cannot"', () => {
  assert.match(appSrc, /if \(imgList && isImageGenPaused\(\)\) \{/, 'Settings checks the pause first');
  const block = appSrc.slice(appSrc.indexOf('if (imgList && isImageGenPaused())'));
  assert.match(block, /IMAGE_GEN_PAUSE_MESSAGE/, 'and shows the same sentence the run does');
  assert.match(block, /\} else if \(imgList\) \{/, 'with the ordinary picker as the other branch');
  // A row of disabled pills is a claim about the visitor's hardware. That claim
  // is still made, separately, for models that need WebGPU on a device without
  // it — but it is not what a paused feature should say.
  assert.ok(!/disabled title="Requires WebGPU browser"/.test(block.slice(0, block.indexOf('} else if'))),
    'the paused branch does not fall back to greying out the models');
});

test('both surfaces read the one function, and it lives in the image module', () => {
  for (const [name, src] of [['waffle-ai.js', aiSrc], ['app.js', appSrc]]) {
    assert.match(src, /isImageGenPaused/, `${name} reads it`);
    assert.match(src, /IMAGE_GEN_PAUSE_MESSAGE/, `${name} and shows the same message`);
  }
  // In the image module rather than the panel, so the two surfaces cannot drift
  // into their own copies of the reason.
  assert.ok(engineSrc.includes('export function isImageGenPaused'));
  assert.match(aiSrc, /isImageGenPaused,\n  IMAGE_GEN_PAUSE_MESSAGE\n\} from '\.\/waffle-image-gen\.js';/);
  assert.match(appSrc, /isImageGenPaused,\n  IMAGE_GEN_PAUSE_MESSAGE\n\} from '\.\/waffle-image-gen\.js';/);
});

test('the chat AI is not paused along with it', () => {
  // Pausing one AI surface must not pause the other. Waffle AI has its own
  // single-function lock, and it is open.
  assert.match(aiSrc, /export function isWaffleAiLocked\(\) \{\n  return false;\n\}/,
    'chat still works');
  assert.notEqual(isImageGenPaused(), false, 'while images do not');
});
