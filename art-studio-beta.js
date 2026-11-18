/**
 * Art Studio (Beta) — the engine behind the beta-only drawing toy.
 *
 * This module is deliberately DOM-free: every brush, layer rule, symmetry
 * transform and history policy lives here as a pure function so it can be
 * tested in node without a canvas. `tools-text-art.js` owns the DOM (sliders,
 * layer list, pointer events) and calls into this file.
 *
 * Two contracts make the brushes testable:
 *   - drawing functions take a 2D-context-like object as their first argument,
 *     so a recording stub can stand in for a real canvas;
 *   - anything random is passed in as `random`, so grain and spray are
 *     deterministic under test.
 */

/** The beta studio is reachable only on `beta.html`, which sets data-beta="1". */
export const BETA_STUDIO_ID = 'art-studio-beta';

/** Same flag `isBetaTesting()` reads in waffle-ai.js, kept local so this toy does not import the AI stack. */
export function isBetaPage(doc = (typeof document === 'undefined' ? undefined : document)) {
  return doc?.documentElement?.dataset?.beta === '1';
}

/* ============================== canvas limits ============================== */

export const MAX_DOC_W = 4096;
export const MAX_DOC_H = 4096;
export const MAX_DOC_PIXELS = MAX_DOC_W * MAX_DOC_H;   // 16.7MP, under the 24MP file-tools cap
export const MAX_LAYERS = 16;
/** Total pixels across every layer before we start refusing new ones. */
export const LAYER_PIXEL_BUDGET = 24 * 1024 * 1024;
export const MIN_LAYERS_AT_ANY_SIZE = 2;

export const CANVAS_PRESETS = [
  { id: 'square', label: 'Square 1024×1024', width: 1024, height: 1024 },
  { id: 'classic', label: 'Classic 900×520', width: 900, height: 520 },
  { id: 'wide', label: 'Wide 1600×900', width: 1600, height: 900 },
  { id: 'tall', label: 'Tall 900×1400', width: 900, height: 1400 },
  { id: 'hd', label: 'HD 1920×1080', width: 1920, height: 1080 },
  { id: 'print', label: 'Print 2480×3508', width: 2480, height: 3508 }
];

/** Throws a friendly message rather than letting the browser allocate something absurd. */
export function validateCanvasSize(width, height) {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isInteger(w) || !Number.isInteger(h)) throw new Error('Canvas size must be whole pixels.');
  if (w < 8 || h < 8) throw new Error('Canvas must be at least 8×8 px.');
  if (w > MAX_DOC_W || h > MAX_DOC_H) throw new Error(`Canvas limit is ${MAX_DOC_W}×${MAX_DOC_H} px.`);
  if (w * h > MAX_DOC_PIXELS) throw new Error('Canvas is too many pixels — pick a smaller size.');
  return { width: w, height: h };
}

/**
 * How many layers a document of this size can afford. Big canvases get fewer
 * layers, because every layer is its own full-size backing store.
 */
export function maxLayersFor(width, height) {
  const pixels = Number(width) * Number(height);
  if (!Number.isFinite(pixels) || pixels <= 0) return MAX_LAYERS;
  return Math.max(MIN_LAYERS_AT_ANY_SIZE, Math.min(MAX_LAYERS, Math.floor(LAYER_PIXEL_BUDGET / pixels)));
}

/* ================================= brushes ================================= */

/**
 * `impl: 'engine'` means paintSegment()/drawShape()/stampGlyph() in this file
 * draw it. `impl: 'ui'` means the DOM layer in tools-text-art.js handles it,
 * because it needs real pixel data (flood fill) or a whole-canvas snapshot.
 *
 * spacing is in multiples of the brush radius: 1 = one stamp per radius.
 */
export const BRUSHES = [
  { id: 'pen', label: 'Pen', icon: '🖌', group: 'ink', impl: 'engine', pressure: true, spacing: 0.5, size: 12, opacity: 100, flow: 100, smooth: 0.55, cap: 'round', hint: 'Clean ink line. Pressure tapers it on a stylus.' },
  { id: 'pencil', label: 'Pencil', icon: '✏️', group: 'ink', impl: 'engine', pressure: true, spacing: 0.35, size: 8, opacity: 90, flow: 70, smooth: 0.4, cap: 'round', grain: 0.5, hint: 'Graphite grain that builds up where you go slowly.' },
  { id: 'marker', label: 'Marker', icon: '🖍', group: 'ink', impl: 'engine', pressure: false, spacing: 0.6, size: 20, opacity: 42, flow: 100, smooth: 0.6, cap: 'butt', widthScale: 1.3, hint: 'Translucent chisel tip — overlapping strokes stay see-through.' },
  { id: 'calligraphy', label: 'Calligraphy', icon: '✒️', group: 'ink', impl: 'engine', pressure: true, spacing: 0.3, size: 26, opacity: 100, flow: 100, smooth: 0.7, cap: 'butt', nibAngle: 45, nibRatio: 0.28, hint: 'Flat nib: thin along its angle, fat across it.' },
  { id: 'watercolour', label: 'Watercolour', icon: '💧', group: 'paint', impl: 'engine', pressure: true, spacing: 0.25, size: 34, opacity: 60, flow: 26, smooth: 0.75, cap: 'round', passes: 3, wetEdge: true, hint: 'Soft translucent washes with a darker wet edge.' },
  { id: 'chalk', label: 'Chalk', icon: '🖍️', group: 'paint', impl: 'engine', pressure: true, spacing: 0.2, size: 22, opacity: 70, flow: 55, smooth: 0.3, cap: 'round', grain: 1.35, hint: 'Crumbly speckled grain, heaviest at the stroke edges.' },
  { id: 'crayon', label: 'Crayon', icon: '🖌️', group: 'paint', impl: 'engine', pressure: true, spacing: 0.3, size: 18, opacity: 85, flow: 80, smooth: 0.35, cap: 'round', grain: 0.85, waxy: true, hint: 'Waxy texture with a few stray bristles either side.' },
  { id: 'airbrush', label: 'Airbrush', icon: '🌫️', group: 'paint', impl: 'engine', pressure: true, spacing: 0.4, size: 40, opacity: 40, flow: 18, smooth: 0.65, cap: 'round', passes: 5, hint: 'Feathered spray that builds up while you hold still.' },
  { id: 'neon', label: 'Neon Glow', icon: '💡', group: 'paint', impl: 'engine', pressure: true, spacing: 0.5, size: 14, opacity: 100, flow: 100, smooth: 0.7, cap: 'round', glow: true, hint: 'A bright core inside three widening halos.' },
  { id: 'rainbow', label: 'Rainbow', icon: '🌈', group: 'paint', impl: 'engine', pressure: true, spacing: 0.5, size: 16, opacity: 100, flow: 100, smooth: 0.6, cap: 'round', hueStep: 7, hint: 'Cycles the hue as you draw.' },
  { id: 'spray', label: 'Spray', icon: '✨', group: 'paint', impl: 'engine', pressure: false, spacing: 1, size: 26, opacity: 100, flow: 100, smooth: 0, cap: 'round', scatter: true, hint: 'Loose speckles scattered inside the brush radius.' },
  { id: 'stamp', label: 'Sticker Stamp', icon: '🧇', group: 'shape', impl: 'engine', pressure: false, spacing: 1, size: 44, opacity: 100, flow: 100, smooth: 0, cap: 'round', stamp: true, hint: 'Dabs a shape wherever you tap.' },
  { id: 'line', label: 'Line', icon: '📏', group: 'shape', impl: 'engine', pressure: false, spacing: 1, size: 10, opacity: 100, flow: 100, smooth: 0, cap: 'round', shape: 'line', hint: 'Drag for a straight line.' },
  { id: 'rect', label: 'Rect', icon: '⬜', group: 'shape', impl: 'engine', pressure: false, spacing: 1, size: 10, opacity: 100, flow: 100, smooth: 0, cap: 'round', shape: 'rect', hint: 'Drag for a rectangle.' },
  { id: 'circle', label: 'Circle', icon: '⭕', group: 'shape', impl: 'engine', pressure: false, spacing: 1, size: 10, opacity: 100, flow: 100, smooth: 0, cap: 'round', shape: 'circle', hint: 'Drag out from the centre.' },
  { id: 'star', label: 'Star', icon: '⭐', group: 'shape', impl: 'engine', pressure: false, spacing: 1, size: 10, opacity: 100, flow: 100, smooth: 0, cap: 'round', shape: 'star', hint: 'Drag for a five-point star.' },
  { id: 'fill', label: 'Fill', icon: '🪣', group: 'utility', impl: 'ui', pressure: false, spacing: 1, size: 12, opacity: 100, flow: 100, smooth: 0, cap: 'round', hint: 'Floods the area you tap on the active layer.' },
  { id: 'eraser', label: 'Eraser', icon: '🧽', group: 'utility', impl: 'engine', pressure: true, spacing: 0.4, size: 24, opacity: 100, flow: 100, smooth: 0.5, cap: 'round', erase: true, hint: 'Rubbers out the active layer only.' }
];

export const BRUSH_GROUPS = [
  { id: 'ink', label: 'Ink & Line' },
  { id: 'paint', label: 'Paint & Texture' },
  { id: 'shape', label: 'Shapes & Stamps' },
  { id: 'utility', label: 'Utility' }
];

export const STAMP_GLYPHS = ['Waffle', 'Star', 'Heart', 'Flower', 'Sparkle', 'Leaf', 'Bubble'];

export const SIZE_RANGE = { min: 1, max: 160 };
export const OPACITY_RANGE = { min: 5, max: 100 };
export const FLOW_RANGE = { min: 5, max: 100 };
export const SMOOTH_RANGE = { min: 0, max: 90 };

export function brushById(id) {
  return BRUSHES.find(b => b.id === id) || null;
}

export function brushesForGroup(group) {
  return BRUSHES.filter(b => b.group === group);
}

/** Is this brush a drag-a-shape tool (needs a live preview) rather than a freehand stroke? */
export function isShapeBrush(brush) {
  return Boolean(brushById(brush?.id || brush)?.shape);
}

export function clampToRange(value, range) {
  const n = Number(value);
  if (!Number.isFinite(n)) return range.min;
  return Math.min(range.max, Math.max(range.min, n));
}

/* ================================ pressure ================================ */

/**
 * Normalised 0..1 pressure for a pointer event.
 *
 * Pens report real pressure. Mice and touch report 0 (or 0.5 while a button is
 * held) which would quietly halve every mouse stroke, so they fall back to 1 —
 * pressure is an enhancement, never a surprise width change.
 */
export function pressureOf(event, enabled = true) {
  if (!enabled) return 1;
  const type = event?.pointerType;
  if (type === 'mouse' || type === 'touch') return 1;
  const p = Number(event?.pressure);
  if (!Number.isFinite(p) || p <= 0) return 1;
  return Math.min(1, p);
}

/** Brush radius for a pressure value: never collapses to nothing at pressure 0. */
export function radiusFor(size, pressure = 1, minRatio = 0.28) {
  const s = Math.max(0.5, Number(size) || 0.5);
  const p = Number.isFinite(Number(pressure)) ? Math.min(1, Math.max(0, Number(pressure))) : 1;
  return (s / 2) * (minRatio + (1 - minRatio) * p);
}

/**
 * Flat-nib width for a calligraphy stroke.
 *
 * Thin when the stroke travels along the nib angle, full width across it — the
 * behaviour that makes a nib look like a nib instead of a round pen.
 */
export function calligraphyWidth(angleDegrees, size, { nibAngle = 45, nibRatio = 0.28 } = {}) {
  const s = Math.max(0.5, Number(size) || 0.5);
  const ratio = Math.min(0.95, Math.max(0.05, Number(nibRatio) || 0.28));
  const delta = ((Number(angleDegrees) || 0) - nibAngle) * Math.PI / 180;
  const across = Math.abs(Math.sin(delta));
  return s * (ratio + (1 - ratio) * across);
}

/** Direction of travel in degrees, 0 = rightward, 90 = down. */
export function angleOf(from, to) {
  const dx = Number(to?.x) - Number(from?.x);
  const dy = Number(to?.y) - Number(from?.y);
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return 0;
  return Math.atan2(dy, dx) * 180 / Math.PI;
}

/* ============================== stroke geometry ============================= */

/** Points along a→b no more than `spacing` apart, always including both ends. */
export function densifySegment(from, to, spacing) {
  const a = { x: Number(from?.x) || 0, y: Number(from?.y) || 0 };
  const b = { x: Number(to?.x) || 0, y: Number(to?.y) || 0 };
  const step = Math.max(0.25, Number(spacing) || 1);
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  if (dist <= step) return [a, b];
  const n = Math.max(1, Math.ceil(dist / step));
  const out = [];
  for (let i = 0; i <= n; i++) out.push({ x: a.x + (b.x - a.x) * (i / n), y: a.y + (b.y - a.y) * (i / n) });
  return out;
}

export function midpoint(a, b) {
  return { x: ((Number(a?.x) || 0) + (Number(b?.x) || 0)) / 2, y: ((Number(a?.y) || 0) + (Number(b?.y) || 0)) / 2 };
}

/**
 * The smoothed curve through three consecutive stroke points: from the midpoint
 * of (p1,p2) to the midpoint of (p2,p3), bowed by p2. Painting these back to
 * back is what gives a live stroke its smoothness with one point of lag, and
 * unlike resampling the whole stroke it never needs to know the future.
 */
export function smoothedSegment(p1, p2, p3, samplesPerSegment = 6) {
  const pts = quadraticPolyline([p1, p2, p3], samplesPerSegment);
  return pts.slice(1, -1);
}

function polylineLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return total;
}

/** Resample a polyline to exactly `count` evenly-spaced-by-arc-length points. */
export function resamplePolyline(points, count) {
  const pts = (points || []).filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.y));
  const n = Math.max(1, Math.floor(count));
  if (!pts.length) return [];
  if (n === 1 || pts.length === 1) return [{ ...pts[0] }];
  const total = polylineLength(pts);
  if (total <= 0) return Array.from({ length: n }, () => ({ ...pts[0] }));
  const out = [{ ...pts[0] }];
  let seg = 1;
  let walked = 0;
  for (let k = 1; k < n; k++) {
    const target = total * (k / (n - 1));
    while (seg < pts.length) {
      const len = Math.hypot(pts[seg].x - pts[seg - 1].x, pts[seg].y - pts[seg - 1].y);
      if (walked + len >= target || seg === pts.length - 1) {
        const t = len <= 0 ? 0 : Math.min(1, Math.max(0, (target - walked) / len));
        out.push({
          x: pts[seg - 1].x + (pts[seg].x - pts[seg - 1].x) * t,
          y: pts[seg - 1].y + (pts[seg].y - pts[seg - 1].y) * t
        });
        break;
      }
      walked += len;
      seg++;
    }
  }
  out[out.length - 1] = { ...pts[pts.length - 1] };
  return out;
}

/** Dense polyline through the quadratic-midpoint curve of a stroke (the classic smoothing path). */
export function quadraticPolyline(points, samplesPerSegment = 6) {
  const pts = (points || []).filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.y));
  if (pts.length < 3) return pts.map(p => ({ ...p }));
  const step = Math.max(1, Math.floor(samplesPerSegment));
  const out = [{ ...pts[0] }];
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = { x: (pts[i - 1].x + pts[i].x) / 2, y: (pts[i - 1].y + pts[i].y) / 2 };
    const p2 = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 };
    out.push({ ...p0 });
    for (let s = 1; s <= step; s++) {
      const t = s / step;
      const mt = 1 - t;
      out.push({
        x: mt * mt * p0.x + 2 * mt * t * pts[i].x + t * t * p2.x,
        y: mt * mt * p0.y + 2 * mt * t * pts[i].y + t * t * p2.y
      });
    }
  }
  out.push({ ...pts[pts.length - 1] });
  return out;
}

/**
 * Smooth a stroke. `amount` 0 returns the raw points untouched, 1 returns the
 * fully smoothed curve, and both endpoints are pinned exactly so a stroke never
 * creeps away from where it started or stopped.
 */
export function smoothPoints(points, amount = 0) {
  const pts = (points || []).filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.y)).map(p => ({ ...p }));
  const k = Math.min(1, Math.max(0, Number(amount) || 0));
  if (pts.length < 3 || k <= 0) return pts;
  const smooth = resamplePolyline(quadraticPolyline(pts, 6), pts.length);
  return pts.map((p, i) => {
    if (i === 0 || i === pts.length - 1) return p;
    return { x: p.x + (smooth[i].x - p.x) * k, y: p.y + (smooth[i].y - p.y) * k };
  });
}

/* ================================ symmetry ================================= */

export const SYMMETRY_MODES = [
  { id: 'off', label: 'Off' },
  { id: 'mx', label: 'Mirror X' },
  { id: 'my', label: 'Mirror Y' },
  { id: 'k4', label: '4-Way Kaleido' },
  { id: 'r6', label: 'Radial 6' },
  { id: 'r12', label: 'Radial 12' }
];

export function radialCount(mode) {
  if (mode === 'r6') return 6;
  if (mode === 'r12') return 12;
  return 0;
}

/**
 * Every point a stroke should be painted at for one raw pointer position.
 * Mirrors flip across the document; radial modes rotate about its centre.
 */
export function mirrorPoints(pt, mode, width, height) {
  const p = { x: Number(pt?.x) || 0, y: Number(pt?.y) || 0 };
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  const out = [p];
  if (mode === 'mx' || mode === 'k4') out.push({ x: w - p.x, y: p.y });
  if (mode === 'my' || mode === 'k4') out.push({ x: p.x, y: h - p.y });
  if (mode === 'k4') out.push({ x: w - p.x, y: h - p.y });
  const n = radialCount(mode);
  if (n) {
    out.length = 0;
    const cx = w / 2;
    const cy = h / 2;
    const dx = p.x - cx;
    const dy = p.y - cy;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      out.push({ x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos });
    }
  }
  return out;
}

/* ================================= layers ================================== */

export const BLEND_MODES = [
  'source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
  'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'luminosity'
];

/** Canvas globalCompositeOperation → the CSS mix-blend-mode that matches it. */
export function cssBlend(blend) {
  return blend === 'source-over' ? 'normal' : (BLEND_MODES.includes(blend) ? blend : 'normal');
}

export const BLEND_LABELS = {
  'source-over': 'Normal',
  multiply: 'Multiply',
  screen: 'Screen',
  overlay: 'Overlay',
  darken: 'Darken',
  lighten: 'Lighten',
  'color-dodge': 'Color Dodge',
  'color-burn': 'Color Burn',
  'hard-light': 'Hard Light',
  'soft-light': 'Soft Light',
  difference: 'Difference',
  luminosity: 'Luminosity'
};

export function blendLabel(mode) {
  return BLEND_LABELS[mode] || BLEND_LABELS['source-over'];
}

export const MAX_LAYER_NAME = 40;

/** A copy deep enough that an undo entry cannot be mutated by later edits. */
export function cloneDoc(doc) {
  return { ...doc, layers: (doc?.layers || []).map(l => ({ ...l })) };
}

/**
 * The layer ids an undo entry must snapshot for an op: everything it destroys,
 * everything it paints into, plus any extra the caller names (usually the layer
 * being drawn on). Snapshooting exactly these — rather than the whole document —
 * is what keeps a 16-layer file's undo stack affordable.
 */
export function touchedLayerIds(op, extra = []) {
  const ids = new Set();
  for (const id of extra || []) if (id) ids.add(id);
  for (const id of op?.destroyed || []) if (id) ids.add(id);
  for (const id of op?.created || []) if (id) ids.add(id);
  if (op?.merge) {
    if (op.merge.targetId) ids.add(op.merge.targetId);
    if (op.merge.sourceId) ids.add(op.merge.sourceId);
    for (const id of op.merge.sourceIds || []) if (id) ids.add(id);
  }
  if (op?.resize) for (const id of (op.doc?.layers || []).map(l => l.id)) ids.add(id);
  return [...ids];
}

function makeOp(doc, extra = {}) {
  return { doc, created: [], destroyed: [], merge: null, ...extra };
}

export function createLayer(id, name, extra = {}) {
  return {
    id: String(id),
    name: String(name || 'Layer').slice(0, MAX_LAYER_NAME),
    visible: true,
    opacity: 100,
    blend: 'source-over',
    locked: false,
    ...extra
  };
}

export function createDoc({ width = 1024, height = 1024, name = 'Untitled' } = {}) {
  const size = validateCanvasSize(width, height);
  const first = createLayer('layer-1', 'Layer 1');
  return {
    version: 1,
    width: size.width,
    height: size.height,
    name: String(name || 'Untitled').slice(0, MAX_LAYER_NAME),
    seq: 1,
    layers: [first],
    activeId: first.id
  };
}

export function layerById(doc, id) {
  return doc?.layers?.find(l => l.id === id) || null;
}

export function layerIndex(doc, id) {
  return doc?.layers?.findIndex(l => l.id === id) ?? -1;
}

export function activeLayer(doc) {
  return layerById(doc, doc?.activeId) || doc?.layers?.[doc.layers.length - 1] || null;
}

/** Bottom→top paint order, skipping hidden layers. layers[0] is the bottom. */
export function compositePlan(doc) {
  return (doc?.layers || []).filter(l => l.visible !== false).map(l => l.id);
}

/**
 * Next "Layer N", counting up from the highest numbered layer that exists.
 *
 * Deriving it from the layer *count* instead would skip a free number whenever
 * a layer had been renamed ("Background", "Layer 1", "Layer 2", "Layer 3" would
 * ask for "Layer 5"). Taking highest + 1 always yields a name nothing is using,
 * and it never fills a gap left by a deleted layer, so the list stays readable.
 */
export function nextLayerName(doc) {
  const layers = doc?.layers || [];
  let highest = 0;
  for (const layer of layers) {
    const m = /^Layer (\d+)$/.exec(String(layer.name || ''));
    if (m) highest = Math.max(highest, Number(m[1]));
  }
  return `Layer ${highest > 0 ? highest + 1 : layers.length + 1}`;
}

function withLayers(doc, layers, patch = {}) {
  return { ...doc, layers: layers.map(l => ({ ...l })), ...patch };
}

/** True when a new layer would blow the pixel budget for this canvas size. */
export function canAddLayer(doc) {
  return (doc?.layers?.length || 0) < maxLayersFor(doc?.width, doc?.height);
}

export function addLayer(doc, { name, aboveActive = true } = {}) {
  if (!canAddLayer(doc)) {
    throw new Error(`That canvas size allows ${maxLayersFor(doc.width, doc.height)} layers — flatten or merge some first.`);
  }
  const id = `layer-${(doc.seq || 0) + 1}`;
  const layer = createLayer(id, name || nextLayerName(doc));
  const layers = [...doc.layers];
  // layers[0] is the bottom of the stack, so "not above the active layer" means
  // underneath everything. A missing active layer falls back to the top.
  const activeAt = layerIndex(doc, doc.activeId);
  const at = aboveActive ? (activeAt < 0 ? layers.length : activeAt + 1) : 0;
  layers.splice(at, 0, layer);
  return makeOp(withLayers(doc, layers, { seq: (doc.seq || 0) + 1, activeId: id }), { created: [id] });
}

export function removeLayer(doc, id) {
  if ((doc?.layers?.length || 0) <= 1) throw new Error('The last layer cannot be deleted.');
  const index = layerIndex(doc, id);
  if (index < 0) throw new Error('That layer is not in this document.');
  const layers = doc.layers.filter(l => l.id !== id);
  const nextActive = layers[Math.min(index, layers.length - 1)].id;
  return makeOp(withLayers(doc, layers, { activeId: nextActive }), { destroyed: [id] });
}

export function duplicateLayer(doc, id) {
  if (!canAddLayer(doc)) {
    throw new Error(`That canvas size allows ${maxLayersFor(doc.width, doc.height)} layers — flatten or merge some first.`);
  }
  const source = layerById(doc, id ?? doc.activeId);
  if (!source) throw new Error('That layer is not in this document.');
  const newId = `layer-${(doc.seq || 0) + 1}`;
  const copy = createLayer(newId, `${source.name} copy`.slice(0, MAX_LAYER_NAME), {
    visible: source.visible,
    opacity: source.opacity,
    blend: source.blend,
    locked: false
  });
  const layers = [...doc.layers];
  layers.splice(layerIndex(doc, source.id) + 1, 0, copy);
  return makeOp(withLayers(doc, layers, { seq: (doc.seq || 0) + 1, activeId: newId }), {
    created: [newId],
    copyFrom: source.id
  });
}

export function moveLayer(doc, id, direction) {
  const index = layerIndex(doc, id);
  if (index < 0) throw new Error('That layer is not in this document.');
  const layers = [...doc.layers];
  let target = index;
  if (direction === 'up') target = index + 1;
  else if (direction === 'down') target = index - 1;
  else if (direction === 'top') target = layers.length - 1;
  else if (direction === 'bottom') target = 0;
  else throw new Error(`Unknown direction "${direction}".`);
  target = Math.min(layers.length - 1, Math.max(0, target));
  if (target === index) return makeOp(withLayers(doc, layers));
  const [moved] = layers.splice(index, 1);
  layers.splice(target, 0, moved);
  return makeOp(withLayers(doc, layers));
}

/** opacity is clamped, blend is validated, names are truncated; junk keys are ignored. */
export function setLayer(doc, id, patch = {}) {
  const index = layerIndex(doc, id);
  if (index < 0) throw new Error('That layer is not in this document.');
  const layer = { ...doc.layers[index] };
  if ('visible' in patch) layer.visible = Boolean(patch.visible);
  if ('locked' in patch) layer.locked = Boolean(patch.locked);
  if ('opacity' in patch) layer.opacity = Math.round(clampToRange(patch.opacity, { min: 0, max: 100 }));
  if ('blend' in patch && BLEND_MODES.includes(patch.blend)) layer.blend = patch.blend;
  if ('name' in patch && String(patch.name).trim()) layer.name = String(patch.name).trim().slice(0, MAX_LAYER_NAME);
  const layers = [...doc.layers];
  layers[index] = layer;
  return makeOp(withLayers(doc, layers));
}

export function setActiveLayer(doc, id) {
  if (!layerById(doc, id)) throw new Error('That layer is not in this document.');
  return makeOp(withLayers(doc, doc.layers, { activeId: id }));
}

/** Merge a layer into the one below it. The lower layer keeps its id and settings. */
export function mergeDown(doc, id) {
  const index = layerIndex(doc, id ?? doc.activeId);
  if (index < 0) throw new Error('That layer is not in this document.');
  if (index === 0) throw new Error('The bottom layer has nothing to merge into.');
  const source = doc.layers[index];
  const target = doc.layers[index - 1];
  const layers = doc.layers.filter(l => l.id !== source.id);
  return makeOp(withLayers(doc, layers, { activeId: target.id }), {
    destroyed: [source.id],
    merge: { targetId: target.id, sourceId: source.id }
  });
}

/** Collapse every visible layer into one. Hidden layers are discarded. */
export function flattenDoc(doc, name = 'Flattened') {
  const visible = compositePlan(doc);
  if (!visible.length) throw new Error('Every layer is hidden, so there is nothing to flatten.');
  const keep = createLayer(`layer-${(doc.seq || 0) + 1}`, String(name).slice(0, MAX_LAYER_NAME));
  const destroyed = doc.layers.map(l => l.id);
  return makeOp(withLayers(doc, [keep], { seq: (doc.seq || 0) + 1, activeId: keep.id }), {
    created: [keep.id],
    destroyed,
    merge: { targetId: keep.id, sourceIds: visible }
  });
}

export function resizeDoc(doc, width, height) {
  const size = validateCanvasSize(width, height);
  if (size.width === doc.width && size.height === doc.height) return makeOp(withLayers(doc, doc.layers));
  return makeOp(
    withLayers(doc, doc.layers, { width: size.width, height: size.height }),
    { resize: { fromWidth: doc.width, fromHeight: doc.height, ...size } }
  );
}

export function renameDoc(doc, name) {
  return makeOp(withLayers(doc, doc.layers, { name: String(name || 'Untitled').trim().slice(0, MAX_LAYER_NAME) || 'Untitled' }));
}

/** Can this layer be painted on right now? */
export function layerAcceptsPaint(doc, id) {
  const layer = layerById(doc, id ?? doc.activeId);
  if (!layer) return false;
  return !layer.locked && layer.visible !== false;
}

/* ================================= history ================================= */

export const HISTORY_LIMIT = 20;
export const HISTORY_BYTE_BUDGET = 48 * 1024 * 1024;

export function imageDataBytes(width, height) {
  return Math.max(0, Number(width) || 0) * Math.max(0, Number(height) || 0) * 4;
}

/**
 * An entry is `{ label, doc, pixels }` where `pixels` is an array of
 * `{ id, width, height, data }` snapshots for only the layers the action
 * touched. Snapshooting per-layer rather than per-document is what keeps undo
 * affordable on a 16-layer file.
 */
export function entryBytes(entry) {
  return (entry?.pixels || []).reduce((sum, p) => sum + imageDataBytes(p.width, p.height), 0);
}

export function historyBytes(history) {
  return [...(history?.undo || []), ...(history?.redo || [])].reduce((sum, e) => sum + entryBytes(e), 0);
}

export function createHistory({ limit = HISTORY_LIMIT, byteBudget = HISTORY_BYTE_BUDGET } = {}) {
  return { limit: Math.max(1, limit), byteBudget: Math.max(1, byteBudget), undo: [], redo: [], dropped: 0 };
}

/**
 * Record an action, dropping the oldest entries until the step count and the
 * byte budget are both satisfied — a 4096² layer snapshot is 64 MB on its own,
 * so an unbounded stack would take the tab down long before it ran out of steps.
 *
 * `clearRedo` is true for a genuine new action, which is the only time the redo
 * branch should be thrown away. Replaying a redo has to record its inverse on
 * the undo stack *without* clearing the rest of the redo branch, or redoing two
 * steps in a row silently stops after the first.
 */
export function pushUndo(history, entry, { clearRedo = true } = {}) {
  if (!history || !entry) return history;
  history.undo.push(entry);
  if (clearRedo) history.redo.length = 0;
  return trimHistory(history);
}

/** Drop oldest undo steps until the count and byte budget hold. Returns the history. */
export function trimHistory(history) {
  if (!history) return history;
  while (history.undo.length > history.limit) {
    history.undo.shift();
    history.dropped++;
  }
  while (history.undo.length > 1 && historyBytes(history) > history.byteBudget) {
    history.undo.shift();
    history.dropped++;
  }
  return history;
}

export function popUndo(history) {
  return history?.undo?.length ? history.undo.pop() : undefined;
}

export function pushRedo(history, entry) {
  if (!history || !entry) return history;
  history.redo.push(entry);
  return trimHistory(history);
}

export function popRedo(history) {
  return history?.redo?.length ? history.redo.pop() : undefined;
}

export function clearHistory(history) {
  if (!history) return history;
  history.undo.length = 0;
  history.redo.length = 0;
  history.dropped = 0;
  return history;
}

/* ================================ rendering ================================ */

function applyState(g, { color, alpha, composite = 'source-over', cap = 'round', width = 1 }) {
  g.globalCompositeOperation = composite;
  g.globalAlpha = Math.min(1, Math.max(0, Number(alpha) || 0));
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = Math.max(0.25, Number(width) || 0.25);
  g.lineCap = cap;
  g.lineJoin = 'round';
}

function strokeLine(g, from, to, width) {
  g.beginPath();
  if (from.x === to.x && from.y === to.y) {
    g.moveTo(from.x, from.y);
    g.lineTo(from.x + 0.01, from.y + 0.01);
  } else {
    g.moveTo(from.x, from.y);
    g.lineTo(to.x, to.y);
  }
  if (width !== undefined) g.lineWidth = Math.max(0.25, width);
  g.stroke();
}

function stampDots(g, from, to, opts) {
  const { radius, color, alpha, spacing, random = Math.random, grain = 1, composite = 'source-over' } = opts;
  const points = densifySegment(from, to, Math.max(0.5, radius * spacing));
  g.globalCompositeOperation = composite;
  g.fillStyle = color;
  for (const p of points) {
    const spread = radius * grain;
    const n = Math.max(3, Math.round(radius * grain * 1.4));
    for (let i = 0; i < n; i++) {
      const a = random() * Math.PI * 2;
      const r = Math.sqrt(random()) * spread;
      g.globalAlpha = Math.min(1, alpha * (0.35 + 0.65 * random()));
      g.beginPath();
      g.arc(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, Math.max(0.4, radius * 0.12), 0, Math.PI * 2);
      g.fill();
    }
  }
}

/** A soft build-up: many low-alpha circles, which is what makes an airbrush soft. */
function softDab(g, x, y, radius, color, alpha, passes, random = Math.random, jitter = 0.06) {
  const n = Math.max(1, passes);
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    g.globalAlpha = Math.min(1, alpha / n);
    const r = radius * (0.55 + 0.45 * (i / Math.max(1, n - 1)));
    g.beginPath();
    g.arc(x + (random() - 0.5) * radius * jitter, y + (random() - 0.5) * radius * jitter, Math.max(0.5, r), 0, Math.PI * 2);
    g.fill();
  }
}

/**
 * Paint one segment of a freehand stroke with a brush.
 *
 * `g` is any 2D-context-like object, so tests can pass a recorder. `random`
 * makes grain deterministic. One call paints one mirrored copy — the caller
 * loops over mirrorPoints().
 */
export function paintSegment(g, options = {}) {
  const brush = brushById(options.brush?.id || options.brush) || brushById('pen');
  const from = { x: Number(options.from?.x) || 0, y: Number(options.from?.y) || 0 };
  const to = { x: Number(options.to?.x) || 0, y: Number(options.to?.y) || 0 };
  const size = clampToRange(options.size ?? brush.size, SIZE_RANGE);
  const pressure = pressureOf({ pointerType: 'pen', pressure: options.pressure }, brush.pressure);
  const radius = Math.max(0.5, radiusFor(size, pressure));
  const alphaBase = clampToRange(options.opacity ?? brush.opacity, OPACITY_RANGE) / 100
    * clampToRange(options.flow ?? brush.flow, FLOW_RANGE) / 100;
  const color = options.color || '#4f2f23';
  const random = options.random || Math.random;
  const composite = brush.erase ? 'destination-out' : 'source-over';

  g.save?.();

  if (brush.scatter) {
    stampDots(g, from, to, { radius, color, alpha: alphaBase, spacing: brush.spacing, random, grain: 1.1, composite });
    g.restore?.();
    return { brush: brush.id, radius, alpha: alphaBase, color };
  }

  if (brush.grain) {
    // Textured brushes lay a thin solid core so the stroke stays readable, then grain on top.
    applyState(g, { color, alpha: alphaBase * (brush.waxy ? 0.55 : 0.35), composite, cap: brush.cap, width: radius * (brush.waxy ? 1.5 : 1.1) });
    strokeLine(g, from, to);
    stampDots(g, from, to, { radius, color, alpha: alphaBase * 0.85, spacing: brush.spacing, random, grain: brush.grain, composite });
    if (brush.waxy) {
      applyState(g, { color, alpha: alphaBase * 0.4, composite, cap: brush.cap, width: Math.max(0.6, radius * 0.35) });
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      for (const side of [-1, 1]) {
        const off = radius * 0.55 * side;
        strokeLine(g, { x: from.x + nx * off, y: from.y + ny * off }, { x: to.x + nx * off, y: to.y + ny * off });
      }
    }
    g.restore?.();
    return { brush: brush.id, radius, alpha: alphaBase, color, grain: brush.grain };
  }

  if (brush.passes) {
    const points = densifySegment(from, to, Math.max(0.6, radius * brush.spacing));
    g.globalCompositeOperation = composite;
    for (const p of points) {
      softDab(g, p.x, p.y, radius, color, alphaBase, brush.passes, random, brush.id === 'watercolour' ? 0.12 : 0.05);
    }
    if (brush.wetEdge) {
      // Watercolour darkens where it pools: a slightly wider, even thinner ring.
      g.globalCompositeOperation = composite;
      for (const p of points) {
        g.globalAlpha = Math.min(1, alphaBase * 0.35);
        g.beginPath();
        g.arc(p.x, p.y, radius * 1.06, 0, Math.PI * 2);
        g.stroke?.();
        g.strokeStyle = color;
        g.lineWidth = Math.max(0.5, radius * 0.14);
        g.stroke();
      }
    }
    g.restore?.();
    return { brush: brush.id, radius, alpha: alphaBase, color, passes: brush.passes };
  }

  if (brush.glow) {
    applyState(g, { color, alpha: alphaBase * 0.14, composite, cap: brush.cap, width: radius * 6 });
    strokeLine(g, from, to);
    applyState(g, { color, alpha: alphaBase * 0.24, composite, cap: brush.cap, width: radius * 3.4 });
    strokeLine(g, from, to);
    applyState(g, { color, alpha: alphaBase * 0.4, composite, cap: brush.cap, width: radius * 2 });
    strokeLine(g, from, to);
    applyState(g, { color: '#fffdf3', alpha: alphaBase, composite, cap: brush.cap, width: Math.max(0.8, radius * 0.7) });
    strokeLine(g, from, to);
    g.restore?.();
    return { brush: brush.id, radius, alpha: alphaBase, color, glow: true };
  }

  if (brush.id === 'rainbow') {
    const hue = ((Number(options.hue) || 0) % 360 + 360) % 360;
    const ink = `hsl(${hue}, 88%, 55%)`;
    applyState(g, { color: ink, alpha: alphaBase, composite, cap: brush.cap, width: radius * 2 });
    strokeLine(g, from, to);
    g.restore?.();
    return { brush: brush.id, radius, alpha: alphaBase, color: ink, hue: (hue + (brush.hueStep || 7)) % 360 };
  }

  if (brush.id === 'calligraphy') {
    const width = calligraphyWidth(angleOf(from, to), size, { nibAngle: brush.nibAngle, nibRatio: brush.nibRatio });
    applyState(g, { color, alpha: alphaBase, composite, cap: brush.cap, width: Math.max(0.8, width * (0.4 + 0.6 * pressure)) });
    strokeLine(g, from, to);
    g.restore?.();
    return { brush: brush.id, radius, alpha: alphaBase, color, nibWidth: width };
  }

  if (brush.id === 'marker') {
    applyState(g, { color, alpha: alphaBase, composite, cap: brush.cap, width: radius * 2 * (brush.widthScale || 1) });
    strokeLine(g, from, to);
    g.restore?.();
    return { brush: brush.id, radius, alpha: alphaBase, color };
  }

  // pen, pencil-core and anything else: one clean round line
  applyState(g, { color, alpha: alphaBase, composite, cap: brush.cap, width: radius * 2 });
  strokeLine(g, from, to);
  g.restore?.();
  return { brush: brush.id, radius, alpha: alphaBase, color };
}

/** Drag-out shapes. `filled` uses fill instead of stroke. */
export function drawShape(g, options = {}) {
  const brush = brushById(options.brush?.id || options.brush) || brushById('line');
  const shape = brush.shape || options.shape || 'line';
  const from = { x: Number(options.from?.x) || 0, y: Number(options.from?.y) || 0 };
  const to = { x: Number(options.to?.x) || 0, y: Number(options.to?.y) || 0 };
  const size = clampToRange(options.size ?? brush.size, SIZE_RANGE);
  const alpha = clampToRange(options.opacity ?? brush.opacity, OPACITY_RANGE) / 100;
  const color = options.color || '#4f2f23';
  const filled = Boolean(options.filled);
  const lineWidth = Math.max(1, size * 0.45);

  g.save?.();
  applyState(g, { color, alpha, composite: brush.erase ? 'destination-out' : 'source-over', cap: 'round', width: lineWidth });

  if (shape === 'line') {
    strokeLine(g, from, to);
  } else if (shape === 'rect') {
    const x = Math.min(from.x, to.x);
    const y = Math.min(from.y, to.y);
    const w = Math.abs(to.x - from.x);
    const h = Math.abs(to.y - from.y);
    if (filled) g.fillRect(x, y, w, h);
    else g.strokeRect(x, y, w, h);
  } else if (shape === 'circle') {
    const r = Math.hypot(to.x - from.x, to.y - from.y);
    g.beginPath();
    g.arc(from.x, from.y, r, 0, Math.PI * 2);
    if (filled) g.fill(); else g.stroke();
  } else if (shape === 'star') {
    const r = Math.max(6, Math.hypot(to.x - from.x, to.y - from.y));
    const rot = Math.atan2(to.y - from.y, to.x - from.x);
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = rot + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? r : r * 0.45;
      const x = from.x + Math.cos(a) * rad;
      const y = from.y + Math.sin(a) * rad;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
    if (filled) g.fill(); else g.stroke();
  }
  g.restore?.();
  return { shape, filled, lineWidth };
}

/** Sticker glyphs, drawn from paths so no image assets are needed. */
export function stampGlyph(g, kind, x, y, size, color = '#e78167', outline = '#4f2f23') {
  const r = Math.max(2, Number(size) || 2);
  g.save?.();
  g.translate?.(x, y);
  g.fillStyle = color;
  g.strokeStyle = outline;
  g.lineWidth = Math.max(1.5, r * 0.1);
  g.lineJoin = 'round';
  g.lineCap = 'round';

  if (kind === 'Star') {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? r : r * 0.45;
      if (i === 0) g.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    g.closePath();
    g.fill();
    g.stroke();
  } else if (kind === 'Heart') {
    g.beginPath();
    g.moveTo(0, r * 0.75);
    g.bezierCurveTo(-r * 1.2, -r * 0.25, -r * 0.45, -r * 1.05, 0, -r * 0.4);
    g.bezierCurveTo(r * 0.45, -r * 1.05, r * 1.2, -r * 0.25, 0, r * 0.75);
    g.closePath();
    g.fill();
    g.stroke();
  } else if (kind === 'Flower') {
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      g.beginPath();
      g.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.36, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    g.fillStyle = '#ffe17d';
    g.beginPath();
    g.arc(0, 0, r * 0.3, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  } else if (kind === 'Sparkle') {
    g.beginPath();
    g.moveTo(0, -r);
    g.quadraticCurveTo(r * 0.16, -r * 0.16, r, 0);
    g.quadraticCurveTo(r * 0.16, r * 0.16, 0, r);
    g.quadraticCurveTo(-r * 0.16, r * 0.16, -r, 0);
    g.quadraticCurveTo(-r * 0.16, -r * 0.16, 0, -r);
    g.closePath();
    g.fill();
    g.stroke();
  } else if (kind === 'Leaf') {
    g.beginPath();
    g.moveTo(-r * 0.8, r * 0.6);
    g.quadraticCurveTo(-r * 0.2, -r * 1.05, r * 0.85, -r * 0.6);
    g.quadraticCurveTo(r * 0.2, r * 0.9, -r * 0.8, r * 0.6);
    g.closePath();
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(-r * 0.7, r * 0.55);
    g.lineTo(r * 0.7, -r * 0.5);
    g.stroke();
  } else if (kind === 'Bubble') {
    g.globalAlpha = 0.55;
    g.beginPath();
    g.arc(0, 0, r * 0.85, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.globalAlpha = 0.95;
    g.fillStyle = '#fffdf3';
    g.beginPath();
    g.arc(-r * 0.28, -r * 0.3, r * 0.2, 0, Math.PI * 2);
    g.fill();
  } else {
    // Waffle: a rounded square with a 3×3 grid of syrup pockets.
    g.beginPath();
    if (g.roundRect) g.roundRect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7, r * 0.3);
    else g.rect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7);
    g.fill();
    g.stroke();
    g.strokeStyle = outline;
    g.lineWidth = Math.max(1, r * 0.08);
    for (let i = 1; i < 3; i++) {
      const o = -r * 0.85 + (r * 1.7 * i) / 3;
      g.beginPath(); g.moveTo(o, -r * 0.8); g.lineTo(o, r * 0.8); g.stroke();
      g.beginPath(); g.moveTo(-r * 0.8, o); g.lineTo(r * 0.8, o); g.stroke();
    }
  }
  g.restore?.();
  return { kind, r };
}

/* ============================= project save/load ============================ */

export const PROJECT_MAGIC = 'waffle-art-beta';
export const PROJECT_VERSION = 1;
export const MAX_PROJECT_BYTES = 32 * 1024 * 1024;

/** Serialise a document plus each layer's PNG data URL. */
export function serializeProject(doc, images) {
  const lookup = images instanceof Map ? images : new Map(Object.entries(images || {}));
  return JSON.stringify({
    magic: PROJECT_MAGIC,
    version: PROJECT_VERSION,
    name: doc.name,
    width: doc.width,
    height: doc.height,
    activeId: doc.activeId,
    layers: doc.layers.map(l => ({ ...l, image: lookup.get(l.id) || null }))
  });
}

const DATA_URL_RE = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;

/**
 * Parse and validate a saved project. Every field is checked, because these
 * files arrive from disk and a bad one should fail with a readable message
 * rather than half-building a document.
 */
export function parseProject(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('That project file is empty.');
  if (text.length > MAX_PROJECT_BYTES) throw new Error('That project file is too large to open.');
  let raw;
  try { raw = JSON.parse(text); } catch { throw new Error('That project file is not valid JSON.'); }
  if (!raw || typeof raw !== 'object') throw new Error('That project file is not a Waffle Art project.');
  if (raw.magic !== PROJECT_MAGIC) throw new Error('That file was not saved by Art Studio (Beta).');
  if (Number(raw.version) !== PROJECT_VERSION) throw new Error(`This build reads version ${PROJECT_VERSION} projects, that file is version ${raw.version}.`);
  const size = validateCanvasSize(raw.width, raw.height);
  if (!Array.isArray(raw.layers) || !raw.layers.length) throw new Error('That project has no layers.');
  if (raw.layers.length > MAX_LAYERS) throw new Error(`Projects are limited to ${MAX_LAYERS} layers.`);

  const seen = new Set();
  const layers = [];
  const images = new Map();
  for (const entry of raw.layers) {
    if (!entry || typeof entry !== 'object') throw new Error('One of the layers in that project is malformed.');
    const id = String(entry.id || '').trim();
    if (!id) throw new Error('A layer in that project is missing its id.');
    if (seen.has(id)) throw new Error(`Two layers share the id "${id}".`);
    seen.add(id);
    layers.push(createLayer(id, entry.name || `Layer ${layers.length + 1}`, {
      visible: entry.visible !== false,
      locked: Boolean(entry.locked),
      opacity: Math.round(clampToRange(entry.opacity ?? 100, { min: 0, max: 100 })),
      blend: BLEND_MODES.includes(entry.blend) ? entry.blend : 'source-over'
    }));
    if (entry.image != null) {
      if (typeof entry.image !== 'string' || !DATA_URL_RE.test(entry.image)) {
        throw new Error(`Layer "${id}" has an image that is not a PNG data URL.`);
      }
      images.set(id, entry.image);
    }
  }

  const activeId = layers.some(l => l.id === raw.activeId) ? String(raw.activeId) : layers[layers.length - 1].id;
  const doc = {
    version: PROJECT_VERSION,
    width: size.width,
    height: size.height,
    name: String(raw.name || 'Untitled').slice(0, MAX_LAYER_NAME),
    seq: layers.length,
    layers,
    activeId
  };
  return { doc, images };
}
