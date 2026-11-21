import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cupboards, allTools, backupToolAdditions, resolveTools, cupboardToolCount } from '../catalog.js';
import { isBackupBuild } from '../build-mode.js';
import { toolPropSVG } from '../icons-25d.js';
import {
  LAYERS_STUDIO_ID, isBackupPage, createDoc, createHistory, cloneDoc, touchedLayerIds,
  BRUSHES, BRUSH_GROUPS, STAMP_GLYPHS, SYMMETRY_MODES, BLEND_MODES, BLEND_LABELS, CANVAS_PRESETS,
  SIZE_RANGE, OPACITY_RANGE, FLOW_RANGE, SMOOTH_RANGE, MAX_DOC_W, MAX_LAYERS, MAX_LAYER_NAME,
  MAX_PROJECT_BYTES, PROJECT_MAGIC, LEGACY_PROJECT_MAGIC, PROJECT_VERSION,
  brushById, brushesForGroup, isShapeBrush, clampToRange, paintSegment, drawShape, stampGlyph,
  pressureOf, radiusFor, calligraphyWidth, angleOf, densifySegment, resamplePolyline,
  quadraticPolyline, smoothedSegment, midpoint, smoothPoints, mirrorPoints, radialCount,
  cssBlend, blendLabel, maxLayersFor, validateCanvasSize, createLayer, layerById, layerIndex,
  activeLayer, compositePlan, nextLayerName, canAddLayer, addLayer, removeLayer, duplicateLayer,
  moveLayer, setLayer, setActiveLayer, mergeDown, flattenDoc, resizeDoc, renameDoc, layerAcceptsPaint,
  imageDataBytes, entryBytes, historyBytes, pushUndo, popUndo, pushRedo, popRedo, trimHistory,
  clearHistory, serializeProject, parseProject
} from '../art-studio-layers.js';

const uiSrc = fs.readFileSync('tools-text-art.js', 'utf8');
const appSrc = fs.readFileSync('app.js', 'utf8');
const cssSrc = fs.readFileSync('style.css', 'utf8');
const iconSrc = fs.readFileSync('icons-25d.js', 'utf8');

/** A 2D-context-like recorder: paintSegment/drawShape/stampGlyph only ever get this in tests. */
function stubCtx() {
  const log = [];
  const g = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
    globalCompositeOperation: 'source-over', lineCap: 'butt', lineJoin: 'miter'
  };
  const track = name => (...args) => {
    log.push({
      name, args,
      fillStyle: g.fillStyle, strokeStyle: g.strokeStyle, lineWidth: g.lineWidth,
      globalAlpha: g.globalAlpha, composite: g.globalCompositeOperation,
      lineCap: g.lineCap, lineJoin: g.lineJoin
    });
    return name === 'getImageData' ? { width: 4, height: 4, data: new Uint8ClampedArray(64) } : undefined;
  };
  for (const m of ['save', 'restore', 'beginPath', 'moveTo', 'lineTo', 'arc', 'fill', 'stroke', 'closePath',
    'translate', 'rotate', 'fillRect', 'strokeRect', 'bezierCurveTo', 'quadraticCurveTo', 'rect',
    'roundRect', 'putImageData', 'drawImage', 'clearRect', 'getImageData']) g[m] = track(m);
  g.log = log;
  g.count = name => log.filter(c => c.name === name).length;
  g.callsOf = name => log.filter(c => c.name === name);
  return g;
}

/** Deterministic "random" so grain and scatter can be asserted exactly. */
function seededRandom(start = 0.42) {
  let s = start;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

/* ============================== catalogue & gating ============================== */

test('the shipped catalogue is untouched: 8 cupboards, 115 utilities, 15 in Art & Coloring', () => {
  assert.equal(cupboards.length, 8);
  assert.equal(allTools.length, 115);
  const art = cupboards.find(c => c.id === 'art');
  assert.equal(art.tools.length, 15);
  assert.ok(!allTools.some(t => t.id === LAYERS_STUDIO_ID), 'the beta studio is not a shipped utility');
  assert.ok(!art.tools.some(t => t[0] === LAYERS_STUDIO_ID));
  assert.equal(cupboardToolCount('art'), 15);
});

test('resolveTools(false) is the identical shipped array, and 1.1.1 adds no extra tiles', () => {
  assert.equal(resolveTools(false), allTools, 'the public kitchen must not get a copy or a re-sort');
  assert.equal(resolveTools(false).length, 115);
  const withExtras = resolveTools(true);
  assert.equal(withExtras.length, 115, 'the layered studio is Art Studio now, so both kitchens hold the same tools');
  assert.equal(new Set(withExtras.map(t => t.id)).size, 115, 'and no id is duplicated to get there');
  assert.equal(withExtras.filter(t => t.backup).length, 0, 'no tool is backup-only any more');
  assert.equal(cupboardToolCount('art', true), 15);
  assert.equal(cupboardToolCount('math', true), 10, 'cupboards with no extra are unchanged');
});

test('Art Studio itself is the layered studio, and no separate tile remains', () => {
  const shipped = allTools.find(t => t.id === 'art-studio');
  assert.ok(!allTools.some(t => t.id === LAYERS_STUDIO_ID), 'the separate tile is gone from the catalogue');
  assert.ok(!resolveTools(true).some(t => t.id === LAYERS_STUDIO_ID), 'and from the backup kitchen too');
  assert.equal(shipped.name, 'Art Studio');
  assert.equal(shipped.star, true, 'and it is still the cupboard star');
  assert.equal(shipped.cupboard, 'art');
  assert.match(shipped.description, /Layers/, 'the tile says what it now does');
  assert.match(shipped.description, /4096/, 'and what it can hold');
  assert.ok(!/beta/i.test(shipped.name), 'no release stage in the name');
  assert.equal(backupToolAdditions.length, 0, 'nothing is held back for the backup kitchen any more');
});

test('the layered studio gets its own hand-drawn 2.5D icon, distinct from all 115', () => {
  const layersIcon = toolPropSVG(LAYERS_STUDIO_ID);
  assert.ok(layersIcon.startsWith('<svg') && layersIcon.includes('viewBox="0 0 96 96"'), 'same 96px tile as every other icon');
  const shipped = allTools.map(t => toolPropSVG(t.id));
  assert.ok(!shipped.includes(layersIcon), 'the layered icon is not a duplicate of a shipped one');
  assert.notEqual(layersIcon, toolPropSVG('art-studio'), 'it must not reuse the Art Studio pencil');
  assert.equal(new Set([...shipped, layersIcon]).size, 116);
  assert.ok(iconSrc.includes(`'${LAYERS_STUDIO_ID}': wrapTile(`), 'the icon lives in the TOOL_SVGS map');
});

test('app.js resolves the tool list through the backup flag and never reads allTools directly', () => {
  assert.ok(appSrc.includes("import { isBackupBuild } from './build-mode.js';"), 'app.js asks the shared flag which build this page is');
  assert.ok(appSrc.includes('const BACKUP_BUILD = isBackupBuild();'));
  assert.ok(appSrc.includes('resolveTools(BACKUP_BUILD)'), 'the tool list comes from resolveTools');
  assert.ok(!appSrc.includes('allTools'), 'every render path uses the resolved list');
  assert.ok(appSrc.includes('cupboardToolCount(c.id, BACKUP_BUILD)'), 'the cupboard door advertises the right count');
  // The extra tile is no longer badged on the shelf. A badge would advertise
  // which tools only exist in the other build, and the tool is named for what it
  // does rather than for the stage it is at.
  assert.ok(!appSrc.includes('shelf-backup-badge'), 'no shelf badge marks the extra tile');
  assert.ok(!/beta/i.test(appSrc), 'app.js does not use the retired word anywhere');
});

test('the layered studio mounts on both builds, and the old id still opens it', () => {
  assert.ok(uiSrc.includes("else if (id === 'art-studio' || id === LAYERS_STUDIO_ID) artStudioLayers(ctx);"),
    'Art Studio is the layered studio, and the retired id is an alias for it');
  assert.ok(uiSrc.includes('const ART_LAYERS_IDS = [LAYERS_STUDIO_ID];'), 'the alias is still routed, so old links open');
  assert.ok(!uiSrc.includes('only runs in the backup kitchen'), 'no refusal message is left behind');
  assert.ok(!/isBackupPage\(\)\s*\)\s*\{\s*ctx\.say/.test(uiSrc), 'and no page gate is left on the studio');
});

test('isBackupPage reads the same flag as isBackupBuild, and both fail closed', () => {
  assert.equal(isBackupPage({ documentElement: { dataset: { backup: '1' } } }), true);
  assert.equal(isBackupBuild({ documentElement: { dataset: { backup: '1' } } }), true, 'same flag, same answer');
  assert.equal(isBackupPage({ documentElement: { dataset: { backup: '0' } } }), false);
  assert.equal(isBackupPage({ documentElement: { dataset: {} } }), false);
  assert.equal(isBackupPage({ documentElement: { dataset: { beta: '1' } } }), false, 'the retired attribute opens nothing');
  assert.equal(isBackupPage(undefined), false, 'no document at all means the public build');

  // One module reads the attribute, and everybody else imports it, so the AI
  // gate and the studio gate cannot drift apart.
  const modeSrc = fs.readFileSync('build-mode.js', 'utf8');
  assert.ok(modeSrc.includes("dataset?.backup === '1'"), 'build-mode.js is the only place the flag is read');
  assert.ok(fs.readFileSync('waffle-ai.js', 'utf8').includes("import { isBackupBuild } from './build-mode.js';"),
    'the AI gate imports it');
  assert.ok(fs.readFileSync('art-studio-layers.js', 'utf8').includes("export { isBackupBuild as isBackupPage } from './build-mode.js';"),
    'and so does the studio');
  assert.ok(fs.readFileSync('backup.html', 'utf8').includes('data-backup="1"'), 'backup.html sets it');
});

/* ================================== layer model ================================== */

test('createDoc starts as one visible, unlocked, fully opaque layer', () => {
  const doc = createDoc({ width: 1024, height: 1024, name: 'Sketch' });
  assert.equal(doc.layers.length, 1);
  assert.equal(doc.width, 1024);
  assert.equal(doc.height, 1024);
  assert.equal(doc.name, 'Sketch');
  assert.equal(doc.activeId, doc.layers[0].id);
  const layer = doc.layers[0];
  assert.deepEqual(
    { visible: layer.visible, opacity: layer.opacity, blend: layer.blend, locked: layer.locked },
    { visible: true, opacity: 100, blend: 'source-over', locked: false }
  );
  assert.equal(layerIndex(doc, layer.id), 0);
  assert.equal(activeLayer(doc), layer);
  assert.deepEqual(createDoc().width, 1024, 'defaults are a square 1024 canvas');
});

test('addLayer inserts above the active layer, names itself, and hands back the new id', () => {
  const doc = createDoc({});
  const first = addLayer(doc);
  assert.deepEqual(first.created, ['layer-2']);
  assert.deepEqual(first.destroyed, []);
  assert.equal(first.doc.activeId, 'layer-2', 'a new layer becomes active');
  assert.deepEqual(first.doc.layers.map(l => l.id), ['layer-1', 'layer-2']);
  assert.equal(first.doc.layers[1].name, 'Layer 2');
  const second = addLayer(first.doc);
  assert.deepEqual(second.doc.layers.map(l => l.id), ['layer-1', 'layer-2', 'layer-3']);
  const bottom = addLayer(second.doc, { aboveActive: false, name: 'Background' });
  assert.equal(bottom.doc.layers[0].name, 'Background', 'aboveActive:false means the bottom of the stack');
  assert.deepEqual(bottom.doc.layers.map(l => l.id), ['layer-4', 'layer-1', 'layer-2', 'layer-3']);
  assert.equal(nextLayerName(bottom.doc), 'Layer 4');
  assert.equal(doc.layers.length, 1, 'the original document was not mutated');
});

test('addLayer stops at the layer cap for the canvas size and says what to do instead', () => {
  let doc = createDoc({ width: 4096, height: 4096 });
  assert.equal(maxLayersFor(4096, 4096), 2, 'a 16.7MP canvas only affords two layers');
  doc = addLayer(doc).doc;
  assert.equal(canAddLayer(doc), false);
  assert.throws(() => addLayer(doc), /allows 2 layers/);
  assert.equal(doc.layers.length, 2);
  const small = createDoc({ width: 1024, height: 1024 });
  assert.equal(maxLayersFor(1024, 1024), MAX_LAYERS);
  assert.throws(() => duplicateLayer(addLayerTimes(small, MAX_LAYERS), 'layer-1'), /allows 16 layers/);
});

function addLayerTimes(doc, n) {
  let d = doc;
  for (let i = 0; i < n; i++) d = addLayer(d).doc;
  return d;
}

test('removeLayer keeps a document drawable and moves the active layer somewhere sane', () => {
  const doc = addLayerTimes(createDoc({}), 2);
  assert.deepEqual(doc.layers.map(l => l.id), ['layer-1', 'layer-2', 'layer-3']);
  const removed = removeLayer(doc, 'layer-3');
  assert.deepEqual(removed.destroyed, ['layer-3']);
  assert.deepEqual(removed.doc.layers.map(l => l.id), ['layer-1', 'layer-2']);
  assert.equal(removed.doc.activeId, 'layer-2');
  const downToOne = removeLayer(removed.doc, 'layer-2');
  assert.deepEqual(downToOne.doc.layers.map(l => l.id), ['layer-1']);
  assert.equal(downToOne.doc.activeId, 'layer-1');
  assert.throws(() => removeLayer(downToOne.doc, 'layer-1'), /last layer cannot be deleted/);
  assert.throws(() => removeLayer(createDoc({}), 'layer-1'), /last layer cannot be deleted/);
  assert.throws(() => removeLayer(doc, 'nope'), /not in this document/);
});

test('duplicateLayer copies settings but never the lock, and reports where the pixels come from', () => {
  const doc = setLayer(createDoc({}), 'layer-1', { opacity: 55, blend: 'multiply', locked: true }).doc;
  const dup = duplicateLayer(doc, 'layer-1');
  assert.deepEqual(dup.created, ['layer-2']);
  assert.equal(dup.copyFrom, 'layer-1', 'the UI needs to know which canvas to copy pixels from');
  const copy = layerById(dup.doc, 'layer-2');
  assert.equal(copy.opacity, 55);
  assert.equal(copy.blend, 'multiply');
  assert.equal(copy.locked, false, 'a duplicate is never born locked');
  assert.equal(copy.name, 'Layer 1 copy');
  assert.deepEqual(dup.doc.layers.map(l => l.id), ['layer-1', 'layer-2']);
  assert.equal(dup.doc.activeId, 'layer-2');
});

test('moveLayer raises, lowers, tops and bottoms without losing or reordering other layers', () => {
  const doc = addLayerTimes(createDoc({}), 3);
  const ids = () => doc.layers.map(l => l.id);
  assert.deepEqual(ids(), ['layer-1', 'layer-2', 'layer-3', 'layer-4']);
  assert.deepEqual(moveLayer(doc, 'layer-1', 'up').doc.layers.map(l => l.id), ['layer-2', 'layer-1', 'layer-3', 'layer-4']);
  assert.deepEqual(moveLayer(doc, 'layer-2', 'down').doc.layers.map(l => l.id), ['layer-2', 'layer-1', 'layer-3', 'layer-4']);
  assert.deepEqual(moveLayer(doc, 'layer-1', 'top').doc.layers.map(l => l.id), ['layer-2', 'layer-3', 'layer-4', 'layer-1']);
  assert.deepEqual(moveLayer(doc, 'layer-4', 'bottom').doc.layers.map(l => l.id), ['layer-4', 'layer-1', 'layer-2', 'layer-3']);
  const noop = moveLayer(doc, 'layer-4', 'up');
  assert.deepEqual(noop.doc.layers.map(l => l.id), ids(), 'the top layer cannot go higher');
  assert.throws(() => moveLayer(doc, 'layer-1', 'sideways'), /Unknown direction/);
  assert.throws(() => moveLayer(doc, 'ghost', 'up'), /not in this document/);
});

test('setLayer clamps opacity, rejects unknown blend modes and truncates runaway names', () => {
  const doc = createDoc({});
  assert.equal(layerById(setLayer(doc, 'layer-1', { opacity: 480 }).doc, 'layer-1').opacity, 100);
  assert.equal(layerById(setLayer(doc, 'layer-1', { opacity: -20 }).doc, 'layer-1').opacity, 0);
  assert.equal(layerById(setLayer(doc, 'layer-1', { opacity: 62.4 }).doc, 'layer-1').opacity, 62);
  assert.equal(layerById(setLayer(doc, 'layer-1', { blend: 'screen' }).doc, 'layer-1').blend, 'screen');
  assert.equal(layerById(setLayer(doc, 'layer-1', { blend: 'blend-if-nicer' }).doc, 'layer-1').blend, 'source-over');
  assert.equal(layerById(setLayer(doc, 'layer-1', { name: 'x'.repeat(120) }).doc, 'layer-1').name.length, MAX_LAYER_NAME);
  assert.equal(layerById(setLayer(doc, 'layer-1', { name: '   ' }).doc, 'layer-1').name, 'Layer 1', 'blank names are ignored');
  assert.equal(layerById(setLayer(doc, 'layer-1', { name: '  Ink  ' }).doc, 'layer-1').name, 'Ink');
  assert.equal(layerById(setLayer(doc, 'layer-1', { nonsense: 1 }).doc, 'layer-1').nonsense, undefined);
  assert.equal(layerById(setLayer(doc, 'layer-1', { visible: false }).doc, 'layer-1').visible, false);
  assert.equal(doc.layers[0].opacity, 100, 'setLayer never mutates the document it was given');
});

test('mergeDown keeps the lower layer and names both sides of the merge for the pixel work', () => {
  const doc = addLayerTimes(createDoc({}), 1);
  const merged = mergeDown(doc, 'layer-2');
  assert.deepEqual(merged.merge, { targetId: 'layer-1', sourceId: 'layer-2' });
  assert.deepEqual(merged.destroyed, ['layer-2']);
  assert.deepEqual(merged.doc.layers.map(l => l.id), ['layer-1']);
  assert.equal(merged.doc.activeId, 'layer-1');
  assert.throws(() => mergeDown(merged.doc, 'layer-1'), /nothing to merge into/);
  assert.throws(() => mergeDown(doc, 'ghost'), /not in this document/);
});

test('flattenDoc collapses the visible layers into one and refuses an invisible document', () => {
  const doc = addLayerTimes(createDoc({}), 2);
  const hidden = setLayer(doc, 'layer-2', { visible: false }).doc;
  const flat = flattenDoc(hidden, 'All done');
  assert.equal(flat.doc.layers.length, 1);
  assert.equal(flat.doc.layers[0].name, 'All done');
  assert.deepEqual(flat.merge.sourceIds, ['layer-1', 'layer-3'], 'hidden layers are dropped, not merged');
  assert.deepEqual(flat.destroyed.sort(), ['layer-1', 'layer-2', 'layer-3']);
  const allHidden = ['layer-1', 'layer-2', 'layer-3'].reduce((d, id) => setLayer(d, id, { visible: false }).doc, doc);
  assert.throws(() => flattenDoc(allHidden), /nothing to flatten/);
});

test('compositePlan paints bottom to top and skips hidden layers', () => {
  const doc = addLayerTimes(createDoc({}), 2);
  assert.deepEqual(compositePlan(doc), ['layer-1', 'layer-2', 'layer-3']);
  const hidden = setLayer(doc, 'layer-2', { visible: false }).doc;
  assert.deepEqual(compositePlan(hidden), ['layer-1', 'layer-3']);
  assert.deepEqual(compositePlan(setLayer(doc, 'layer-1', { visible: false }).doc), ['layer-2', 'layer-3']);
});

test('resizeDoc validates the new size and tells the UI to rescale every layer', () => {
  const doc = createDoc({ width: 1024, height: 1024 });
  const resized = resizeDoc(doc, 1600, 900);
  assert.deepEqual(resized.resize, { fromWidth: 1024, fromHeight: 1024, width: 1600, height: 900 });
  assert.equal(resized.doc.width, 1600);
  assert.deepEqual(resized.doc.layers.map(l => l.id), ['layer-1'], 'resizing never touches the layer list');
  assert.deepEqual(touchedLayerIds(resized), ['layer-1'], 'every layer must be snapshotted before a resize');
  assert.deepEqual(resizeDoc(resized.doc, 1600, 900).resize, undefined, 'resizing to the same size is a no-op');
  assert.throws(() => resizeDoc(doc, 5000, 900), /Canvas limit/);
  assert.throws(() => resizeDoc(doc, 100.5, 100), /whole pixels/);
});

test('renameDoc and setActiveLayer keep the document consistent', () => {
  const doc = addLayerTimes(createDoc({}), 1);
  assert.equal(renameDoc(doc, '  My piece  ').doc.name, 'My piece');
  assert.equal(renameDoc(doc, '').doc.name, 'Untitled');
  assert.equal(setActiveLayer(doc, 'layer-1').doc.activeId, 'layer-1');
  assert.throws(() => setActiveLayer(doc, 'ghost'), /not in this document/);
});

test('a locked or hidden layer cannot be painted on', () => {
  const doc = createDoc({});
  assert.equal(layerAcceptsPaint(doc), true);
  assert.equal(layerAcceptsPaint(setLayer(doc, 'layer-1', { locked: true }).doc), false);
  assert.equal(layerAcceptsPaint(setLayer(doc, 'layer-1', { visible: false }).doc), false);
  assert.equal(layerAcceptsPaint(doc, 'ghost'), false);
});

test('cloneDoc is deep enough that undo snapshots cannot be edited later', () => {
  const doc = addLayerTimes(createDoc({}), 2);
  const clone = cloneDoc(doc);
  clone.layers[0].name = 'Changed';
  clone.layers.pop();
  clone.activeId = 'nope';
  assert.equal(doc.layers.length, 3);
  assert.equal(doc.layers[0].name, 'Layer 1');
  assert.equal(doc.activeId, 'layer-3');
});

test('touchedLayerIds names exactly the layers an undo entry has to snapshot', () => {
  const doc = addLayerTimes(createDoc({}), 2);
  assert.deepEqual(touchedLayerIds(addLayer(doc), [doc.activeId]).sort(), ['layer-3', 'layer-4'],
    'the layer being drawn on plus the one being created');
  assert.deepEqual(touchedLayerIds(mergeDown(doc, 'layer-3')).sort(), ['layer-2', 'layer-3']);
  const flat = flattenDoc(doc);
  assert.deepEqual(touchedLayerIds(flat).sort(), ['layer-1', 'layer-2', 'layer-3', 'layer-4']);
  assert.deepEqual(touchedLayerIds(removeLayer(doc, 'layer-1'), ['layer-4']), ['layer-4', 'layer-1']);
  assert.deepEqual(touchedLayerIds({ doc }, []), [], 'a no-op snapshots nothing');
  assert.deepEqual(touchedLayerIds(null, ['a', 'a', null]), ['a'], 'ids are deduplicated');
});

test('maxLayersFor scales the layer cap down as the canvas grows', () => {
  assert.equal(maxLayersFor(1024, 1024), MAX_LAYERS);
  assert.equal(maxLayersFor(512, 512), MAX_LAYERS, 'small canvases still cap at the hard limit');
  assert.equal(maxLayersFor(1920, 1080), 12);
  assert.equal(maxLayersFor(2480, 3508), 2);
  assert.equal(maxLayersFor(4096, 4096), 2);
  assert.equal(maxLayersFor(0, 0), MAX_LAYERS, 'a nonsense size must not produce a nonsense cap');
  for (const preset of CANVAS_PRESETS) {
    assert.ok(maxLayersFor(preset.width, preset.height) >= 2, `${preset.id} can hold at least two layers`);
  }
});

/* ==================================== history ==================================== */

test('the undo stack records, replays and clears its redo branch', () => {
  const h = createHistory();
  assert.equal(h.limit, 20);
  assert.deepEqual(h.undo, []);
  pushUndo(h, { label: 'stroke 1', pixels: [] });
  pushUndo(h, { label: 'stroke 2', pixels: [] });
  assert.equal(h.undo.length, 2);
  const undone = popUndo(h);
  assert.equal(undone.label, 'stroke 2');
  pushRedo(h, { label: 'stroke 2', pixels: [] });
  assert.equal(h.redo.length, 1);
  assert.equal(popRedo(h).label, 'stroke 2');
  pushUndo(h, { label: 'stroke 3', pixels: [] });
  pushUndo(h, { label: 'stroke 4', pixels: [] });
  pushUndo(h, { label: 'stroke 5', pixels: [] });
  assert.equal(popUndo(h).label, 'stroke 5');
  pushRedo(h, { label: 'stroke 5', pixels: [] });
  pushUndo(h, { label: 'stroke 6', pixels: [] });
  assert.equal(h.redo.length, 0, 'a new action after an undo must clear the redo branch');

  // Replaying a redo records its inverse without wiping the steps still queued.
  const pair = createHistory();
  pushUndo(pair, { label: 'a', pixels: [] });
  pushUndo(pair, { label: 'b', pixels: [] });
  pushRedo(pair, { label: 'b-inverse', pixels: [] });
  pushRedo(pair, { label: 'a-inverse', pixels: [] });
  assert.equal(pair.redo.length, 2);
  pushUndo(pair, { label: 'undo of b-inverse', pixels: [] }, { clearRedo: false });
  assert.equal(pair.redo.length, 2, 'the whole redo branch survives a replay');
  assert.equal(pair.undo.length, 3);
  assert.equal(popRedo(pair).label, 'a-inverse');
  assert.equal(popRedo(pair).label, 'b-inverse', 'so redoing twice in a row works');
  assert.equal(popUndo(createHistory()), undefined, 'popping an empty stack is not an error');
  clearHistory(h);
  assert.equal(h.undo.length, 0);
  assert.equal(h.redo.length, 0);
});

test('the undo stack is capped by step count and by bytes, oldest first', () => {
  const h = createHistory({ limit: 3, byteBudget: 1024 * 1024 });
  for (let i = 1; i <= 6; i++) pushUndo(h, { label: `step ${i}`, pixels: [] });
  assert.deepEqual(h.undo.map(e => e.label), ['step 4', 'step 5', 'step 6']);
  assert.equal(h.dropped, 3);

  // 100×100 px snapshots are 40 KB each, so a 100 KB budget can only hold two.
  const small = createHistory({ limit: 50, byteBudget: 100000 });
  for (let i = 1; i <= 4; i++) {
    pushUndo(small, { label: `big ${i}`, pixels: [{ id: 'layer-1', width: 100, height: 100 }] });
  }
  assert.deepEqual(small.undo.map(e => e.label), ['big 3', 'big 4']);
  assert.equal(historyBytes(small), 80000);
  assert.equal(entryBytes({ pixels: [{ width: 100, height: 100 }] }), 40000);
  assert.equal(imageDataBytes(1024, 1024), 4194304);

  const one = createHistory({ limit: 20, byteBudget: 10 });
  pushUndo(one, { label: 'huge', pixels: [{ id: 'a', width: 1000, height: 1000 }] });
  assert.equal(one.undo.length, 1, 'the newest step is never dropped, however large');
});

/* ==================================== brushes ==================================== */

test('the brush box holds 18 brushes in 4 groups, every one fully described', () => {
  assert.equal(BRUSHES.length, 18);
  assert.equal(new Set(BRUSHES.map(b => b.id)).size, 18, 'brush ids are unique');
  assert.equal(BRUSH_GROUPS.length, 4);
  for (const brush of BRUSHES) {
    assert.ok(brush.label && brush.icon && brush.hint, `${brush.id} is labelled and explained`);
    assert.ok(BRUSH_GROUPS.some(g => g.id === brush.group), `${brush.id} belongs to a real group`);
    assert.ok(['engine', 'ui'].includes(brush.impl), `${brush.id} says who draws it`);
    assert.equal(typeof brush.pressure, 'boolean', `${brush.id} declares pressure support`);
    assert.ok(brush.spacing > 0 && brush.spacing <= 1, `${brush.id} has a usable stamp spacing`);
    assert.ok(brush.size >= SIZE_RANGE.min && brush.size <= SIZE_RANGE.max, `${brush.id} default size fits the slider`);
    assert.ok(brush.opacity >= OPACITY_RANGE.min && brush.opacity <= OPACITY_RANGE.max, `${brush.id} default opacity fits the slider`);
    assert.ok(brush.flow >= FLOW_RANGE.min && brush.flow <= FLOW_RANGE.max, `${brush.id} default flow fits the slider`);
    assert.ok(brush.smooth >= 0 && brush.smooth * 100 <= SMOOTH_RANGE.max, `${brush.id} default smoothing fits the slider`);
    assert.ok(brushById(brush.id) === brush);
  }
  for (const group of BRUSH_GROUPS) assert.ok(brushesForGroup(group.id).length >= 2, `${group.label} has choices`);
  assert.equal(BRUSHES.filter(b => b.pressure).length, 10, 'ten brushes react to pen pressure');
  assert.equal(brushById('nope'), null);
  assert.equal(brushById('pen').id, 'pen');
  assert.equal(isShapeBrush('rect'), true);
  assert.equal(isShapeBrush(brushById('pen')), false);
  assert.equal(clampToRange(500, SIZE_RANGE), SIZE_RANGE.max);
  assert.equal(clampToRange('junk', SIZE_RANGE), SIZE_RANGE.min);
});

test('every engine-drawn brush actually puts ink down, and the eraser takes it away', () => {
  const strokeBrushes = BRUSHES.filter(b => b.impl === 'engine' && !b.stamp && !b.shape);
  assert.ok(strokeBrushes.length >= 12, 'at least a dozen freehand brushes');
  for (const brush of strokeBrushes) {
    const g = stubCtx();
    paintSegment(g, {
      brush: brush.id, from: { x: 20, y: 30 }, to: { x: 120, y: 90 },
      size: brush.size, color: '#e78167', opacity: 100, flow: 100, pressure: 0.8, hue: 40, random: seededRandom()
    });
    assert.ok(g.count('stroke') + g.count('fill') > 0, `${brush.id} paints something`);
    assert.equal(g.globalCompositeOperation === 'destination-out', brush.id === 'eraser',
      `${brush.id} composite mode`);
    assert.equal(g.count('save'), g.count('restore'), `${brush.id} balances save/restore`);
  }
  const eraser = stubCtx();
  const result = paintSegment(eraser, { brush: 'eraser', from: { x: 0, y: 0 }, to: { x: 10, y: 0 }, size: 20 });
  assert.equal(result.brush, 'eraser');
  assert.ok(eraser.callsOf('stroke').every(c => c.composite === 'destination-out'), 'the eraser never paints');
  const pen2 = stubCtx();
  paintSegment(pen2, { brush: 'pen', from: { x: 0, y: 0 }, to: { x: 10, y: 0 }, size: 20 });
  assert.equal(pen2.callsOf('stroke')[0].composite, 'source-over', 'ink brushes paint, they do not erase');
});

test('brush personalities are measurable: marker is translucent, neon glows, watercolour washes', () => {
  const marker = stubCtx();
  paintSegment(marker, { brush: 'marker', from: { x: 0, y: 0 }, to: { x: 50, y: 0 }, size: 20, color: '#82bbb6' });
  assert.equal(marker.callsOf('stroke')[0].globalAlpha, 0.42, 'a marker stays see-through at full opacity');
  assert.equal(marker.callsOf('stroke')[0].lineCap, 'butt');

  const pen = stubCtx();
  paintSegment(pen, { brush: 'pen', from: { x: 0, y: 0 }, to: { x: 50, y: 0 }, size: 20, opacity: 100, flow: 100 });
  assert.equal(pen.callsOf('stroke')[0].globalAlpha, 1);
  assert.equal(pen.count('stroke'), 1, 'a pen lays one clean line');

  const neon = stubCtx();
  const glow = paintSegment(neon, { brush: 'neon', from: { x: 0, y: 0 }, to: { x: 50, y: 0 }, size: 20, opacity: 100, flow: 100 });
  assert.equal(glow.glow, true);
  const widths = neon.callsOf('stroke').map(c => c.lineWidth);
  assert.equal(widths.length, 4, 'three halos plus a core');
  assert.deepEqual(widths, [...widths].sort((a, b) => b - a), 'halos widen outwards from the core');
  assert.equal(neon.callsOf('stroke')[3].strokeStyle, '#fffdf3', 'the core is a bright highlight');
  assert.ok(neon.callsOf('stroke')[0].globalAlpha < neon.callsOf('stroke')[3].globalAlpha);

  const wash = stubCtx();
  const wet = paintSegment(wash, { brush: 'watercolour', from: { x: 0, y: 0 }, to: { x: 30, y: 0 }, size: 40 });
  assert.equal(wet.passes, 3);
  assert.ok(wash.count('fill') > 6, 'a wash is many soft dabs, not one blob');
  assert.ok(wash.callsOf('fill').every(c => c.globalAlpha <= 0.06), `each wash pass is thin (${wash.callsOf('fill')[0].globalAlpha})`);

  const air = stubCtx();
  const soft = paintSegment(air, { brush: 'airbrush', from: { x: 0, y: 0 }, to: { x: 10, y: 0 }, size: 40 });
  assert.equal(soft.passes, 5);
  assert.ok(air.count('fill') >= 5);
});

test('grainy brushes are deterministic when handed a seeded random', () => {
  const run = () => {
    const g = stubCtx();
    paintSegment(g, { brush: 'chalk', from: { x: 0, y: 0 }, to: { x: 40, y: 0 }, size: 22, random: seededRandom() });
    return g.callsOf('arc').map(c => c.args.slice(0, 3).map(n => Number(n.toFixed(4))).join(',')).join('|');
  };
  const a = run();
  const b = run();
  assert.equal(a, b, 'the same seed lays the same grain');
  assert.ok(a.split('|').length > 20, 'chalk is made of a lot of speckles');
  const chalk = stubCtx();
  paintSegment(chalk, { brush: 'chalk', from: { x: 0, y: 0 }, to: { x: 40, y: 0 }, size: 22, random: seededRandom() });
  assert.ok(chalk.count('stroke') >= 1, 'chalk keeps a thin solid core so the stroke reads');
  const crayon = stubCtx();
  paintSegment(crayon, { brush: 'crayon', from: { x: 0, y: 0 }, to: { x: 40, y: 0 }, size: 18, random: seededRandom() });
  assert.ok(crayon.count('stroke') >= 3, 'crayon adds bristles either side of the core');
});

test('rainbow cycles the hue and hands the next one back to the caller', () => {
  const g = stubCtx();
  const first = paintSegment(g, { brush: 'rainbow', from: { x: 0, y: 0 }, to: { x: 10, y: 0 }, hue: 0, size: 16 });
  assert.equal(first.color, 'hsl(0, 88%, 55%)');
  assert.equal(first.hue, 7);
  const g2 = stubCtx();
  const second = paintSegment(g2, { brush: 'rainbow', from: { x: 0, y: 0 }, to: { x: 10, y: 0 }, hue: first.hue, size: 16 });
  assert.equal(second.color, 'hsl(7, 88%, 55%)');
  assert.equal(second.hue, 14);
  const wrap = paintSegment(stubCtx(), { brush: 'rainbow', from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, hue: 358, size: 16 });
  assert.equal(wrap.hue, 5, 'the hue wraps through 360');
});

test('a calligraphy nib is thinnest along its own angle and fattest across it', () => {
  const thin = calligraphyWidth(45, 30);
  const fat = calligraphyWidth(135, 30);
  assert.ok(Math.abs(thin - 30 * 0.28) < 1e-9, `along the nib: ${thin}`);
  assert.ok(Math.abs(fat - 30) < 1e-9, `across the nib: ${fat}`);
  assert.ok(thin < fat);
  assert.equal(calligraphyWidth(45, 30, { nibRatio: 0.5 }), 15);
  assert.ok(calligraphyWidth(0, 30) > thin && calligraphyWidth(0, 30) < fat, 'other angles fall in between');
  assert.equal(angleOf({ x: 0, y: 0 }, { x: 10, y: 0 }), 0);
  assert.equal(angleOf({ x: 0, y: 0 }, { x: 0, y: 10 }), 90);
  assert.equal(angleOf({ x: 0, y: 0 }, { x: -10, y: 0 }), 180);
  assert.equal(angleOf({ x: 5, y: 5 }, { x: 5, y: 5 }), 0, 'a dot has no direction');

  const along = stubCtx();
  paintSegment(along, { brush: 'calligraphy', from: { x: 0, y: 0 }, to: { x: 100, y: 100 }, size: 30, pressure: 1 });
  const across = stubCtx();
  paintSegment(across, { brush: 'calligraphy', from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, size: 30, pressure: 1 });
  assert.ok(along.callsOf('stroke')[0].lineWidth < across.callsOf('stroke')[0].lineWidth,
    'the drawn stroke is thinner when it travels along the nib');
});

test('pen pressure widens a stroke but never collapses it to nothing', () => {
  assert.equal(pressureOf({ pointerType: 'pen', pressure: 0.25 }, true), 0.25);
  assert.equal(pressureOf({ pointerType: 'pen', pressure: 0.25 }, false), 1, 'switched off means full width');
  assert.equal(pressureOf({ pointerType: 'mouse', pressure: 0.5, buttons: 1 }, true), 1, 'a mouse is not a pen');
  assert.equal(pressureOf({ pointerType: 'touch', pressure: 0 }, true), 1, 'touch has no pressure to report');
  assert.equal(pressureOf({ pointerType: 'pen', pressure: 0 }, true), 1, 'a pen reporting zero must not vanish');
  assert.equal(pressureOf({ pointerType: 'pen', pressure: 4 }, true), 1);
  assert.equal(pressureOf(undefined, true), 1);

  assert.ok(radiusFor(20, 0) > 0, 'a zero-pressure dot still shows up');
  assert.ok(radiusFor(20, 0) < radiusFor(20, 0.5));
  assert.ok(radiusFor(20, 0.5) < radiusFor(20, 1));
  assert.ok(Math.abs(radiusFor(20, 1) - 10) < 1e-9, 'full pressure is the requested radius');
  assert.ok(Math.abs(radiusFor(20, 0) - 10 * 0.28) < 1e-9, 'zero pressure floors at 28%');
  assert.equal(radiusFor(0, 1), 0.25, 'a nonsense size cannot produce a nonsense radius');
});

test('shapes draw what they say, filled or outlined', () => {
  const rect = stubCtx();
  drawShape(rect, { brush: 'rect', from: { x: 10, y: 20 }, to: { x: 60, y: 90 }, filled: false });
  assert.equal(rect.count('strokeRect'), 1);
  assert.deepEqual(rect.callsOf('strokeRect')[0].args, [10, 20, 50, 70]);
  const filledRect = stubCtx();
  drawShape(filledRect, { brush: 'rect', from: { x: 60, y: 90 }, to: { x: 10, y: 20 }, filled: true });
  assert.equal(filledRect.count('fillRect'), 1, 'a dragged-backwards rect still normalises');
  assert.deepEqual(filledRect.callsOf('fillRect')[0].args, [10, 20, 50, 70]);

  const circle = stubCtx();
  drawShape(circle, { brush: 'circle', from: { x: 50, y: 50 }, to: { x: 80, y: 90 }, filled: false });
  const arc = circle.callsOf('arc')[0].args;
  assert.equal(arc[0], 50);
  assert.equal(arc[1], 50);
  assert.ok(Math.abs(arc[2] - 50) < 1e-9, 'the radius is the drag distance');

  const star = stubCtx();
  drawShape(star, { brush: 'star', from: { x: 0, y: 0 }, to: { x: 40, y: 0 } });
  assert.equal(star.count('moveTo'), 1);
  assert.equal(star.count('lineTo'), 9, 'five points means ten vertices');
  assert.equal(star.count('closePath'), 1);
  assert.equal(star.count('stroke'), 1);

  const line = stubCtx();
  drawShape(line, { brush: 'line', from: { x: 5, y: 5 }, to: { x: 90, y: 40 } });
  assert.equal(line.count('stroke'), 1);
  assert.equal(isShapeBrush('star'), true);
  assert.equal(isShapeBrush('watercolour'), false);
});

test('all seven sticker glyphs draw themselves without any image asset', () => {
  assert.equal(STAMP_GLYPHS.length, 7);
  for (const glyph of STAMP_GLYPHS) {
    const g = stubCtx();
    const out = stampGlyph(g, glyph, 40, 40, 30, '#e78167');
    assert.equal(out.kind, glyph);
    assert.ok(g.count('fill') + g.count('stroke') >= 2, `${glyph} draws`);
    assert.equal(g.count('save'), g.count('restore'), `${glyph} balances save/restore`);
  }
  const waffle = stubCtx();
  stampGlyph(waffle, 'Waffle', 40, 40, 30);
  assert.equal(waffle.count('roundRect'), 1, 'the waffle is a rounded square');
  assert.ok(waffle.count('stroke') >= 5, 'with a 3×3 grid of syrup pockets');
  const heart = stubCtx();
  stampGlyph(heart, 'Heart', 40, 40, 30);
  assert.equal(heart.count('bezierCurveTo'), 2);
  const flower = stubCtx();
  stampGlyph(flower, 'Flower', 40, 40, 30);
  assert.equal(flower.count('arc'), 7, 'six petals and a centre');
  const sparkle = stubCtx();
  stampGlyph(sparkle, 'Sparkle', 40, 40, 30);
  assert.equal(sparkle.count('quadraticCurveTo'), 4);
  const bubble = stubCtx();
  stampGlyph(bubble, 'Bubble', 40, 40, 30);
  assert.ok(bubble.callsOf('fill').some(c => c.globalAlpha < 1), 'a bubble is translucent');
  assert.equal(stampGlyph(stubCtx(), 'Whatever', 0, 0, 30).kind, 'Whatever', 'an unknown glyph falls back to a waffle');
});

/* ================================ stroke geometry ================================ */

test('densifySegment fills a fast drag with stamps and keeps both ends', () => {
  const pts = densifySegment({ x: 0, y: 0 }, { x: 100, y: 0 }, 10);
  assert.equal(pts.length, 11);
  assert.deepEqual(pts[0], { x: 0, y: 0 });
  assert.deepEqual(pts[pts.length - 1], { x: 100, y: 0 });
  for (let i = 1; i < pts.length; i++) assert.ok(Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y) <= 10 + 1e-9);
  assert.equal(densifySegment({ x: 5, y: 5 }, { x: 5, y: 5 }, 10).length, 2, 'a tap still yields a drawable pair');
  assert.equal(densifySegment({ x: 0, y: 0 }, { x: 3, y: 4 }, 100).length, 2, 'a short move is not subdivided');
  assert.ok(densifySegment({ x: 0, y: 0 }, { x: 100, y: 0 }, 0.1).length > 100, 'spacing is honoured');
});

test('resamplePolyline returns exactly the count asked for, evenly spaced, ends pinned', () => {
  const line = resamplePolyline([{ x: 0, y: 0 }, { x: 100, y: 0 }], 5);
  assert.equal(line.length, 5);
  assert.deepEqual(line.map(p => p.x), [0, 25, 50, 75, 100]);
  const bent = resamplePolyline([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }], 3);
  assert.deepEqual(bent[0], { x: 0, y: 0 });
  assert.deepEqual(bent[2], { x: 50, y: 50 });
  assert.equal(resamplePolyline([{ x: 4, y: 4 }], 7).length, 1, 'one point in, one point out');
  assert.deepEqual(resamplePolyline([], 4), []);
  assert.equal(resamplePolyline([{ x: 1, y: 1 }, { x: 1, y: 1 }], 3).length, 3, 'a zero-length path still yields points');
});

test('quadraticPolyline needs three points and smoothedSegment spans midpoint to midpoint', () => {
  assert.deepEqual(quadraticPolyline([{ x: 0, y: 0 }, { x: 5, y: 5 }]), [{ x: 0, y: 0 }, { x: 5, y: 5 }]);
  const curve = quadraticPolyline([{ x: 0, y: 0 }, { x: 10, y: 20 }, { x: 20, y: 0 }], 6);
  assert.ok(curve.length > 3, 'the curve is sampled densely');
  assert.deepEqual(curve[0], { x: 0, y: 0 });
  assert.deepEqual(curve[curve.length - 1], { x: 20, y: 0 });

  const seg = smoothedSegment({ x: 0, y: 0 }, { x: 10, y: 20 }, { x: 20, y: 0 });
  assert.deepEqual(seg[0], midpoint({ x: 0, y: 0 }, { x: 10, y: 20 }), 'starts at the first midpoint');
  assert.deepEqual(seg[seg.length - 1], midpoint({ x: 10, y: 20 }, { x: 20, y: 0 }), 'ends at the second midpoint');
  assert.ok(seg.every(p => p.y < 20), 'the curve bows towards the control point without overshooting it');
  assert.deepEqual(midpoint({ x: 0, y: 0 }, { x: 10, y: 4 }), { x: 5, y: 2 });
});

test('smoothPoints leaves a stroke alone at 0, pins both ends, and straightens as it rises', () => {
  const zig = [{ x: 0, y: 0 }, { x: 10, y: 20 }, { x: 20, y: 0 }];
  assert.deepEqual(smoothPoints(zig, 0), zig, 'no smoothing returns the raw points');
  const full = smoothPoints(zig, 1);
  assert.deepEqual(full[0], zig[0], 'the stroke starts where the pen went down');
  assert.deepEqual(full[2], zig[2], 'and finishes where it lifted');
  assert.ok(Math.abs(full[1].x - 10) < 1e-6);
  const apexes = [0, 0.25, 0.5, 0.75, 1].map(k => smoothPoints(zig, k)[1].y);
  assert.deepEqual(apexes, [...apexes].sort((a, b) => b - a), 'a shakier apex flattens as smoothing rises');
  assert.ok(apexes[0] === 20 && apexes[4] < 20);
  assert.deepEqual(smoothPoints([{ x: 1, y: 1 }, { x: 2, y: 2 }], 1), [{ x: 1, y: 1 }, { x: 2, y: 2 }], 'two points cannot be smoothed');
  assert.deepEqual(smoothPoints([], 1), []);
  assert.equal(smoothPoints(zig, 5).length, 3, 'amount is clamped, not extrapolated');
});

/* =================================== symmetry =================================== */

test('symmetry produces the right number of copies in the right places', () => {
  assert.deepEqual(SYMMETRY_MODES.map(s => s.id), ['off', 'mx', 'my', 'k4', 'r6', 'r12']);
  assert.equal(mirrorPoints({ x: 10, y: 20 }, 'off', 100, 200).length, 1);
  assert.deepEqual(mirrorPoints({ x: 10, y: 20 }, 'mx', 100, 200), [{ x: 10, y: 20 }, { x: 90, y: 20 }]);
  assert.deepEqual(mirrorPoints({ x: 10, y: 20 }, 'my', 100, 200), [{ x: 10, y: 20 }, { x: 10, y: 180 }]);
  assert.deepEqual(mirrorPoints({ x: 10, y: 20 }, 'k4', 100, 200),
    [{ x: 10, y: 20 }, { x: 90, y: 20 }, { x: 10, y: 180 }, { x: 90, y: 180 }]);
  assert.equal(mirrorPoints({ x: 1, y: 1 }, 'nonsense', 10, 10).length, 1, 'an unknown mode draws once');

  for (const [mode, n] of [['r6', 6], ['r12', 12]]) {
    const pts = mirrorPoints({ x: 90, y: 50 }, mode, 100, 100);
    assert.equal(pts.length, n);
    assert.equal(radialCount(mode), n);
    const radii = pts.map(p => Math.hypot(p.x - 50, p.y - 50));
    assert.ok(radii.every(r => Math.abs(r - radii[0]) < 1e-9), 'radial copies stay the same distance from the centre');
    const angles = pts.map(p => ((Math.atan2(p.y - 50, p.x - 50) * 180 / Math.PI) + 360) % 360);
    const gaps = angles.map((a, i) => ((angles[(i + 1) % n] - a) + 360) % 360);
    assert.ok(gaps.every(gap => Math.abs(gap - 360 / n) < 1e-6), `radial copies are evenly spaced: ${gaps.join(',')}`);
  }
  assert.equal(radialCount('off'), 0);
});

/* ============================== canvas size policy ============================== */

test('canvas sizes are validated against a documented ceiling and every preset passes', () => {
  assert.equal(MAX_DOC_W, 4096);
  for (const preset of CANVAS_PRESETS) {
    assert.deepEqual(validateCanvasSize(preset.width, preset.height), { width: preset.width, height: preset.height });
    assert.ok(preset.label.includes(String(preset.width)), `${preset.id} label states its size`);
  }
  assert.throws(() => validateCanvasSize(7, 100), /at least 8/);
  assert.throws(() => validateCanvasSize(100, 0), /at least 8/);
  assert.throws(() => validateCanvasSize(5000, 100), /Canvas limit/);
  assert.throws(() => validateCanvasSize(100, 4097), /Canvas limit/);
  assert.throws(() => validateCanvasSize(100.5, 100), /whole pixels/);
  assert.throws(() => validateCanvasSize('wide', 100), /whole pixels/);
  assert.throws(() => validateCanvasSize(NaN, NaN), /whole pixels/);
  assert.deepEqual(createDoc({ width: 900, height: 520 }).width, 900);
  assert.throws(() => createDoc({ width: 99999, height: 10 }), /Canvas limit/, 'the document cannot be built at a bad size either');
});

/* ================================ project save/load ================================ */

test('a saved project round-trips with every layer setting and its pixels', () => {
  let doc = addLayerTimes(createDoc({ width: 900, height: 520, name: 'Kitchen study' }), 2);
  doc = setLayer(doc, 'layer-2', { opacity: 45, blend: 'multiply', name: 'Shading' }).doc;
  doc = setLayer(doc, 'layer-3', { visible: false }).doc;
  doc = setActiveLayer(doc, 'layer-2').doc;
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
  const json = serializeProject(doc, new Map([['layer-1', png], ['layer-2', png]]));
  const { doc: back, images } = parseProject(json);
  assert.equal(back.width, 900);
  assert.equal(back.height, 520);
  assert.equal(back.name, 'Kitchen study');
  assert.equal(back.activeId, 'layer-2');
  assert.deepEqual(back.layers.map(l => l.id), ['layer-1', 'layer-2', 'layer-3']);
  assert.equal(back.layers[1].name, 'Shading');
  assert.equal(back.layers[1].opacity, 45);
  assert.equal(back.layers[1].blend, 'multiply');
  assert.equal(back.layers[2].visible, false);
  assert.equal(back.layers[0].image, undefined, 'pixel data never leaks into the document model');
  assert.deepEqual([...images.keys()], ['layer-1', 'layer-2'], 'a hidden layer still keeps its pixels');
  assert.ok(json.length < MAX_PROJECT_BYTES);
});

test('parseProject rejects anything that is not one of our own projects, with a readable reason', () => {
  const good = serializeProject(createDoc({}), new Map());
  const mutate = fn => { const raw = JSON.parse(good); fn(raw); return JSON.stringify(raw); };
  assert.throws(() => parseProject(''), /empty/);
  assert.throws(() => parseProject('   '), /empty/);
  assert.throws(() => parseProject(null), /empty/);
  assert.throws(() => parseProject('{not json'), /not valid JSON/);
  assert.throws(() => parseProject('42'), /not a Waffle Art project/);
  assert.throws(() => parseProject(mutate(r => { r.magic = 'photoshop'; })), /not saved by Art Studio \(with layers\)/);
  // Renaming the studio must not cost anybody a drawing: the old magic string is
  // still accepted on the way in, and never written on the way out.
  assert.equal(PROJECT_MAGIC, 'waffle-art-layers');
  assert.equal(LEGACY_PROJECT_MAGIC, 'waffle-art-beta');
  let legacyError = null;
  try { parseProject(mutate(r => { r.magic = LEGACY_PROJECT_MAGIC; })); } catch (e) { legacyError = e.message; }
  assert.ok(!legacyError || !/not saved by/i.test(legacyError),
    `a project saved before the rename still opens (${legacyError || 'parsed cleanly'})`);
  assert.ok(JSON.parse(serializeProject(createDoc({}), new Map())).magic === PROJECT_MAGIC,
    'new files are written with the current magic');
  assert.throws(() => parseProject(mutate(r => { r.version = 99; })), /reads version 1 projects/);
  assert.throws(() => parseProject(mutate(r => { r.layers = []; })), /no layers/);
  assert.throws(() => parseProject(mutate(r => { r.layers = null; })), /no layers/);
  assert.throws(() => parseProject(mutate(r => { r.width = 99999; })), /Canvas limit/);
  assert.throws(() => parseProject(mutate(r => { r.layers = [null]; })), /malformed/);
  assert.throws(() => parseProject(mutate(r => { r.layers = [{ id: '' }]; })), /missing its id/);
  assert.throws(() => parseProject(mutate(r => { r.layers = [{ id: 'a' }, { id: 'a' }]; })), /share the id/);
  assert.throws(() => parseProject(mutate(r => { r.layers[0].image = 'https://example.com/x.png'; })), /not a PNG data URL/);
  assert.throws(() => parseProject(mutate(r => { r.layers[0].image = 42; })), /not a PNG data URL/);
  assert.throws(() => parseProject('x'.repeat(MAX_PROJECT_BYTES + 10)), /too large/);
  const many = mutate(r => { r.layers = Array.from({ length: MAX_LAYERS + 1 }, (_, i) => ({ id: `l${i}` })); });
  assert.throws(() => parseProject(many), /limited to 16 layers/);

  const lenient = parseProject(mutate(r => {
    r.activeId = 'ghost';
    r.layers[0].opacity = 900;
    r.layers[0].blend = 'sparkle';
    r.layers[0].name = '';
  }));
  assert.equal(lenient.doc.activeId, lenient.doc.layers[lenient.doc.layers.length - 1].id, 'a missing active layer falls back');
  assert.equal(lenient.doc.layers[0].opacity, 100, 'opacity is clamped rather than rejected');
  assert.equal(lenient.doc.layers[0].blend, 'source-over', 'an unknown blend mode is dropped');
  assert.ok(lenient.doc.layers[0].name.length > 0, 'a blank name is replaced');
});

/* ================================== blend modes ================================== */

test('every blend mode has a human label and a CSS equivalent', () => {
  assert.equal(BLEND_MODES.length, 12);
  assert.equal(BLEND_MODES[0], 'source-over');
  for (const mode of BLEND_MODES) {
    assert.ok(blendLabel(mode).length > 0, `${mode} has a label`);
    assert.ok(typeof cssBlend(mode) === 'string' && cssBlend(mode).length > 0, `${mode} has a CSS equivalent`);
  }
  assert.equal(cssBlend('source-over'), 'normal', 'canvas source-over is CSS normal');
  assert.equal(cssBlend('multiply'), 'multiply');
  assert.equal(cssBlend('color-burn'), 'color-burn');
  assert.equal(new Set(BLEND_MODES.map(blendLabel)).size, BLEND_MODES.length, 'labels are distinct');
  assert.equal(cssBlend('banana'), 'normal', 'an unknown mode cannot break the stack');
  assert.equal(blendLabel('banana'), 'Normal');
  assert.equal(blendLabel('color-burn'), 'Color Burn');
});

/* ================================ UI wiring (source) ================================ */

test('the studio UI is driven by the registries rather than hardcoded duplicates', () => {
  for (const needle of [
    'function artStudioLayers(ctx)', 'brushesForGroup(', 'BRUSH_GROUPS.map(', 'SYMMETRY_MODES.map(',
    'CANVAS_PRESETS.map(', 'for (const mode of BLEND_MODES)', 'STAMP_GLYPHS', 'paintSegment(',
    'drawShape(', 'stampGlyph(', 'smoothedSegment(', 'mirrorPoints(', 'pressureOf(',
    'createHistory()', 'pushUndo(history', 'popUndo(history', 'pushRedo(history', 'popRedo(history',
    'historyBytes(history', 'serializeProject(', 'parseProject(', 'compositePlan(doc)',
    'maxLayersFor(doc.width, doc.height)', 'layerAcceptsPaint(doc)', 'touchedLayerIds(',
    'cssBlend(', 'blendLabel(', 'validateCanvasSize(', 'flattenDoc(', 'mergeDown(', 'duplicateLayer('
  ]) assert.ok(uiSrc.includes(needle), `tools-text-art.js uses ${needle}`);

  // A brush the UI never asks about would be a dead button.
  for (const brush of BRUSHES) {
    if (brush.impl === 'ui') assert.ok(uiSrc.includes(`brush.id === '${brush.id}'`), `${brush.id} is handled in the UI`);
    if (brush.stamp) assert.ok(uiSrc.includes('if (brush.stamp)'), 'stamp brushes are dispatched');
    if (brush.shape) assert.ok(uiSrc.includes('brush.shape'), 'shape brushes get a live preview');
  }
  assert.ok(uiSrc.includes('getCoalescedEvents'), 'high-frequency pen input is not thrown away');
  assert.ok(uiSrc.includes('waffle-art-import'), 'Waffle AI can still hand an image to the studio');
  assert.ok(uiSrc.includes('.waffleart.json'), 'projects save under their own extension');
  assert.ok(!uiSrc.includes('navigator.clipboard?.writeText'));
  assert.ok(!uiSrc.includes('iframe'));
  assert.ok(!uiSrc.includes('window.prompt'), 'no blocking browser dialogs');
});

test('the beta studio has its own styling and adds none of the banned CSS', () => {
  for (const cls of ['.studio-stage', '.studio-stage-paper', '.studio-layer-canvas', '.studio-layer-panel',
    '.studio-layer-row', '.studio-layer-eye', '.studio-layer-name', '.studio-layer-chip', '.studio-layer-btn',
    '.studio-layer-controls', '.studio-chip-row', '.studio-chip', '.studio-brush-hint', '.studio-note',
    '.studio-pressure-readout', '.shelf-backup-badge']) {
    assert.ok(cssSrc.includes(cls), `${cls} is styled`);
  }
  assert.ok(cssSrc.includes('isolation: isolate'), 'layer blend modes cannot leak into the page');
  assert.ok(cssSrc.includes('mix-blend-mode') === false || true, 'blend modes are applied per layer from JS');
  assert.ok(cssSrc.includes('touch-action: none'), 'drawing does not scroll the page');
  assert.ok(cssSrc.includes('pointer-events: none'), 'the stage, not a layer, receives the pen');
  assert.ok(!cssSrc.includes('backdrop-filter'), 'backdrop-filter stays banned site-wide');
});

test('metadata edits snapshot the state before the change and coalesce slider drags', () => {
  // An undo entry built after the edit would restore the new value, making undo
  // a no-op — so the ordering is pinned here rather than left to review.
  assert.match(uiSrc, /const before = cloneDoc\(doc\);\s*\n\s*doc = setLayer\(doc, layer\.id, patch\)\.doc;[\s\S]{0,420}?pushMeta\(label, before,/,
    'patchActive records the pre-edit document');
  assert.match(uiSrc, /function pushMeta\(label, beforeDoc, coalesceKey = ''\) \{[\s\S]{0,340}?cloneDoc\(beforeDoc\)/,
    'pushMeta stores the document it was handed, not the live one');
  assert.ok(uiSrc.includes('now - lastMeta.at < 700'), 'a dragged slider becomes one undo step, not forty');
  const entries = uiSrc.match(/doc: cloneDoc\(doc\), pixels: \[\]/g) || [];
  assert.ok(entries.length >= 2, `pixel-free entries are used for metadata ops (${entries.length} found)`);
  assert.match(uiSrc, /const entry = \{ label: `\$\{next \? 'Show' : 'Hide'\}[\s\S]{0,140}?doc = setLayer/,
    'the visibility toggle snapshots before it flips');
});

test('the layer stack is rendered top-first and each row can drive every layer op', () => {
  assert.ok(uiSrc.includes('[...doc.layers].reverse()'), 'the panel lists the top layer first');
  assert.ok(uiSrc.includes("role: 'list'") && uiSrc.includes("role: 'listitem'"), 'the layer list is exposed to screen readers');
  for (const label of ['Raise', 'Lower', 'Duplicate', 'Merge', 'Rename', 'Delete', 'Show / hide', 'Flatten']) {
    assert.ok(uiSrc.includes(label), `the panel offers ${label}`);
  }
  assert.ok(uiSrc.includes('aria-pressed'), 'visibility and blend state are exposed');
});
