/**
 * The Waffle Music Lab bench, mounted and played in a DOM.
 *
 * This is the mode that says experimental on its own panel, and the reason it gets
 * a jsdom suite rather than source pins is that two of its bugs were only visible
 * by running it: a seeded generator that re-derived its state from the seed inside
 * the returned function — so every call gave the same number and some seeds
 * composed sixteen rests and played silence — and a melody that re-rolled its
 * direction per note, so it oscillated between two adjacent degrees instead of
 * going anywhere. `node --check` passed both. Neither is a rule about the source;
 * both are behaviours.
 *
 * It is mounted with no AudioContext anywhere, because that is the state the bench
 * has to survive: a page without one gets `null` from the audio bus and every voice
 * must return early rather than throw. jsdom has no canvas 2d context either, so
 * the spectrum's `getContext('2d')` returning null is exercised on every paint.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';

const dom = new JSDOM('<!DOCTYPE html><html lang="en"><body><div id="root"></div></body></html>', {
  url: 'https://the-creative-master.github.io/BiteSizedUtilities/',
  pretendToBeVisual: true
});
const { window } = dom;
for (const key of ['document', 'localStorage', 'sessionStorage', 'CustomEvent', 'Event', 'HTMLElement', 'Node', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  if (window[key] !== undefined) globalThis[key] = window[key];
}
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.window = window;
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
// No network, and no audio: the point of this suite is that the bench works without
// either, because a page that has not been interacted with yet has no AudioContext.
globalThis.fetch = () => Promise.resolve({ ok: false, status: 501, json: async () => ({}), headers: new Map() });
assert.equal(typeof window.AudioContext, 'undefined', 'jsdom has no AudioContext, which is the state under test');

const { mountMusic } = await import('../tools-music.js');
const musicSrc = fs.readFileSync(path.join(process.cwd(), 'tools-music.js'), 'utf8');
const styleSrc = fs.readFileSync(path.join(process.cwd(), 'style.css'), 'utf8');

const root = () => window.document.querySelector('#root');
const $ = sel => window.document.querySelector(sel);
const $$ = sel => [...window.document.querySelectorAll(sel)];
const click = el => el.dispatchEvent(new window.Event('click', { bubbles: true }));

let teardown = null;

/** Mount fresh, switch to the bench, and hand back the handles the tests need. */
function openBench() {
  if (teardown) { teardown(); teardown = null; }
  root().replaceChildren();
  teardown = mountMusic('waffle-music-lab', root());
  const tab = $$('button').find(b => b.textContent.includes('Experimental'));
  assert.ok(tab, 'the sixth tab is on the panel');
  click(tab);
  return {
    cells: () => $$('.bench-cell'),
    readout: () => $('.bench-readout')?.textContent ?? '',
    code: () => $('.bench-code-input'),
    btn: label => $$('button').find(b => b.textContent.includes(label)),
    slider: label => $$('input[type=range]').find(i => (i.getAttribute('aria-label') || '') .includes(label)
      || i.closest('label')?.textContent.includes(label)
      || i.parentElement?.textContent.includes(label))
  };
}

test('the bench is a sixth mode, and it says experimental where it can be seen', () => {
  const b = openBench();
  assert.match($('.bench-badge').textContent, /🧪 EXPERIMENTAL/, 'the badge is on the panel itself');
  const note = $('.bench-banner .tool-note').textContent;
  assert.match(note, /A bench, not a finished tool/, 'and so is the sentence about what it is');
  assert.match(note, /New, and likely to change\./, 'which is the part that makes the badge honest');
  // A test label must not ship into the public build: the version string this file
  // is written under is not something a visitor to the site should be shown.
  assert.doesNotMatch(note, /TVBR|TVAR|1\.3/i, 'no build label on a user-visible surface');
  assert.ok(b.btn('Play Bench') && b.btn('Compose') && b.btn('New seed') && b.btn('Copy bench code'),
    'with the four things a bench is for');
});

test('it mounts with no AudioContext and no canvas context, and does not throw', () => {
  // Every paint calls scope.getContext('2d'), which jsdom leaves null, and every
  // voice goes through a bus that has nothing at the end of it.
  const b = openBench();
  assert.equal(b.cells().length, 16, 'sixteen steps are drawn anyway');
  assert.match(b.readout(), /notes? in /, 'and the readout describes them');
  assert.ok($('.bench-scope'), 'the spectrum canvas is in the DOM even with nothing to draw into it');
});

test('the composer never produces silence, whatever seed it is handed', () => {
  // This is the bug the first version had: a generator that re-derived its state
  // from the seed inside the returned function gives the same number every call, so
  // a seed whose one number fell under the rest threshold composed sixteen rests.
  const empty = [];
  for (let i = 0; i < 40; i++) {
    const b = openBench();
    b.code().value = `WL1.Minor.triangle.104.5.0.0.${i * 7919}.1`;
    click(b.btn('Load code'));
    const cells = $$('.bench-cell');
    assert.equal(cells.length, 16);
    const placed = cells.filter(c => c.textContent !== '·').length;
    if (placed === 0) empty.push(i * 7919);
  }
  assert.deepEqual(empty, [], 'no seed composes an empty strip');
});

test('a seed owns the tune: the same code twice is the same melody', () => {
  const stripOf = code => {
    const b = openBench();
    b.code().value = code;
    click(b.btn('Load code'));
    return $$('.bench-cell').map(c => c.textContent).join('|');
  };
  const code = 'WL1.Blues.sine.132.7.24.10.4242.0';
  const once = stripOf(code);
  const twice = stripOf(code);
  assert.equal(once, twice, 'byte-identical, because the seed is in the code and the melody is not');
  assert.notEqual(once.split('|').filter(t => t !== '·').length, 0, 'and it is not the empty strip');
  const other = stripOf('WL1.Blues.sine.132.7.24.10.4243.0');
  assert.notEqual(once, other, 'a different seed is a different tune');
});

test('different seeds give different tunes, not one tune with a different label', () => {
  const seen = new Set();
  for (let s = 0; s < 25; s++) {
    const b = openBench();
    b.code().value = `WL1.Major.triangle.104.6.0.0.${1000 + s}.1`;
    click(b.btn('Load code'));
    seen.add($$('.bench-cell').map(c => c.textContent).join('|'));
  }
  assert.equal(seen.size, 25, '25 seeds, 25 melodies');
});

test('density changes how much is played, and the readout says so', () => {
  const countFor = density => {
    const b = openBench();
    b.code().value = `WL1.Pentatonic.triangle.104.${density}.0.0.777.1`;
    click(b.btn('Load code'));
    return {
      placed: $$('.bench-cell').filter(c => c.textContent !== '·').length,
      readout: $('.bench-readout').textContent
    };
  };
  const sparse = countFor(1);
  const dense = countFor(10);
  assert.ok(sparse.placed < dense.placed, `${sparse.placed} notes at density 1, ${dense.placed} at 10`);
  assert.ok(sparse.placed >= 2, 'and even the sparsest setting is a phrase, not a single note');
  // The count on screen is the count in the strip, at both ends of the range. A
  // hardcoded expectation here would pin whatever the composer happened to place
  // under one seed rather than the property that matters.
  for (const r of [sparse, dense]) {
    assert.match(r.readout, new RegExp(`^${r.placed} notes? in Pentatonic, seed 777`),
      `the readout says ${r.placed}, and the strip holds ${r.placed}`);
  }
  assert.match(sparse.readout, /^\d+ notes? in /, 'and the readout is a sentence, not a debug dump');
  assert.ok(dense.placed <= 16, 'sixteen steps is the ceiling however dense the setting');
});

test('a bench code round-trips, and the controls are rebuilt around it', () => {
  const b = openBench();
  const code = 'WL1.Chromatic.square.180.9.44.30.31337.0';
  b.code().value = code;
  click(b.btn('Load code'));
  // Rebuild rather than poke values into live controls: every slider and toggle
  // would otherwise show the previous setup while playing the new one, which is the
  // same class of lie the progress bar was telling.
  assert.match($('.bench-readout').textContent, /swing 44% · humanise 30%/, 'swing and humanise came through');
  assert.doesNotMatch($('.bench-readout').textContent, /auto bass on/, 'and so did bass off');
  const scale = $$('button').find(x => x.textContent.trim() === 'Chromatic' && x.getAttribute('aria-pressed') === 'true');
  assert.ok(scale, 'the scale tab moved to the one the code named');
  const voice = $$('button').find(x => x.textContent.trim() === '8-Bit' && x.getAttribute('aria-pressed') === 'true');
  assert.ok(voice, 'and so did the voice');
});

test('a code that is not a code is refused, with an example of one that is', () => {
  const b = openBench();
  const before = $$('.bench-cell').map(c => c.textContent).join('|');
  for (const bad of ['hello', 'WL2.Major.sine.104.5.0.0.1.1', 'WL1.NotAScale.sine.104.5.0.0.1.1',
    'WL1.Major.sine.104.5.0.0.1', '']) {
    b.code().value = bad;
    click(b.btn('Load code'));
    assert.match($('.bench-readout').textContent, /^That is not a bench code\. One looks like WL1\./,
      `"${bad}" is refused and the refusal carries an example`);
    assert.equal($$('.bench-cell').map(c => c.textContent).join('|'), before,
      'and the strip that was there is untouched');
  }
});

test('a code that is out of range is clamped rather than believed', () => {
  const b = openBench();
  b.code().value = 'WL1.Major.sine.9999.999.999.999.99999999999.1';
  click(b.btn('Load code'));
  assert.match($('.bench-readout').textContent, /swing 60% · humanise 40%/,
    'swing caps at 60 and humanise at 40');
  // The tempo slider caps lower than the code parser, because a code can be typed;
  // what matters is that nothing here produces an unusable bench.
  const tempo = $$('input[type=range]').map(i => Number(i.value)).sort((x, y) => x - y);
  assert.ok(tempo.every(Number.isFinite), 'every slider still holds a number');
});

test('the sixteen steps are tappable in both directions', () => {
  const b = openBench();
  b.code().value = 'WL1.Major.triangle.104.1.0.0.5.0';
  click(b.btn('Load code'));
  const cells = $$('.bench-cell');
  const rest = cells.find(c => c.textContent === '·');
  assert.ok(rest, 'a sparse bench has a rest to tap');
  click(rest);
  assert.notEqual(rest.textContent, '·', 'a rest becomes a note');
  assert.match($('.bench-readout').textContent, /notes? in Major/, 'and the readout follows');
  click(rest);
  assert.equal(rest.textContent, '·', 'and a note becomes a rest again');
});

test('a step says what it is holding, to a screen reader and to a listener', () => {
  const b = openBench();
  const cells = b.cells();
  assert.equal(cells[0].getAttribute('aria-label'), `Step 1, ${cells[0].textContent === '·' ? 'rest' : cells[0].textContent}`);
  assert.equal($('.bench-strip').getAttribute('aria-label'),
    'Generated steps. Tap a step to add or remove its note.', 'the group explains the interaction');
  assert.equal($('.bench-readout').getAttribute('role'), 'status',
    'and the readout is a live region, so a tap is announced rather than only shown');
});

test('Compose and New seed both write a strip, and New seed changes the seed', () => {
  const b = openBench();
  const first = b.readout();
  click(b.btn('Compose'));
  assert.match(b.readout(), /seed (\d+)/, 'Compose keeps the seed it was given');
  assert.equal(b.readout().match(/seed (\d+)/)[1], first.match(/seed (\d+)/)[1],
    'because recomposing under the same seed is the same tune — that is what makes a code worth copying');
  click(b.btn('New seed'));
  const after = b.readout();
  assert.notEqual(after.match(/seed (\d+)/)[1], first.match(/seed (\d+)/)[1], 'New seed picks another');
  const n = Number(after.match(/^(\d+) notes?/)[1]);
  assert.ok(n >= 2, `and still composes a phrase (${n} notes)`);
});

test('Play starts and Stop stops, without an audio context to play into', () => {
  const b = openBench();
  click(b.btn('Play Bench'));
  assert.equal(b.btn('Stop')?.textContent.trim(), '⏹ Stop', 'the button says what it now does');
  assert.ok($$('.bench-cell').some(c => c.classList.contains('is-live')), 'and a step is lit');
  click(b.btn('Stop'));
  assert.ok(b.btn('Play Bench'), 'the button is back to Play');
  assert.equal($$('.bench-cell').filter(c => c.classList.contains('is-live')).length, 0,
    'nothing stays lit after Stop, because stopLoops cleared the timer');
});

test('leaving the bench and the tool stops everything it started', () => {
  const b = openBench();
  click(b.btn('Play Bench'));
  assert.ok(b.btn('Stop'));
  // The tab back to Song Maker, then the teardown the registry hands the app.
  click($$('button').find(x => x.textContent.includes('Song Maker')));
  assert.equal($$('.bench-cell').length, 0, 'the bench is gone from the stage');
  teardown();
  teardown = null;
  assert.match(musicSrc, /return \(\) => \{ stopLoops\(\); audio\.close\(\); \};/,
    'and the tool\u2019s own teardown stops the loops and closes the bus');
});

test('the bus is one gain into one analyser, so the spectrum is of the lab', () => {
  // Every voice used to make its own path to the destination, which is why a
  // spectrum of "what the lab is playing" was not available to draw.
  assert.match(musicSrc, /analyser\.fftSize = 512/, 'one analyser');
  assert.match(musicSrc, /analyser\.smoothingTimeConstant = 0\.72/, 'smoothed, because 512 bins at 60 Hz is noise');
  assert.match(musicSrc, /getAnalyser/, 'exposed to the bench');
  assert.match(musicSrc, /if \(!an \|\| typeof an\.getByteFrequencyData !== 'function'\)/,
    'and a page with no analyser gets the idle mid-line instead of a thrown error');
  assert.match(musicSrc, /g\.fillStyle = '#6b5a4d';\n        g\.fillRect\(0, scope\.height \/ 2, scope\.width, 2\);/,
    'drawn as a line, not as an empty black box that looks broken');
});

test('humanise is deliberately unseeded, and the seed owns the notes', () => {
  // Two performances of the same tune should not be identical, or "humanise" is a
  // fixed offset wearing a good name. The notes stay reproducible because they come
  // from mulberry32; the timing jitter does not.
  const tick = musicSrc.slice(musicSrc.indexOf('const tick = () => {'), musicSrc.indexOf("const playBtn = gameBtn('▶ Play Bench'"));
  assert.match(tick, /Math\.random\(\)/, 'the jitter is not from the seeded generator');
  assert.match(tick, /Deliberately unseeded/, 'and says so where the next reader will look');
  assert.match(tick, /let when = step % 2 === 1 \? eighth \* \(swing \/ 100\) : 0;/,
    'swing pushes every other step late by a percentage of one step');
  assert.match(tick, /gain: 0\.17 \* vel/, 'velocity rides the gain, so a humanised note is quieter or louder');
  assert.match(tick, /if \(bassOn && \(step === 0 \|\| step === 8\)\)/,
    'auto bass lands on the two steps a sixteen-bar phrase turns on');
  assert.match(tick, /getRowMidi\(rows - 1\) - 24/, 'two octaves under the tonic');
});

test('the walk has momentum, and the last step lands on the nearest tonic', () => {
  const compose = musicSrc.slice(musicSrc.indexOf('const compose = () =>'), musicSrc.indexOf('let pattern = Array.isArray(bench.pattern)'));
  assert.match(compose, /if \(Math\.random\(\) < 0\.3\) dir = -dir;|dir = -dir/,
    'the direction is carried and occasionally turned, not re-rolled per note');
  assert.match(compose, /const tonics = \[rows - 1, rows - 1 - perOctave, rows - 1 - 2 \* perOctave\]/,
    'the last placed step resolves to the nearest of the tonics in range');
  assert.match(compose, /if \(!placed\) \{\n        out\[0\] = rows - 1;/,
    'and a bench that composed nothing composes a four-note phrase instead');
});

test('the bench is styled, and only with variables the kitchen actually defines', () => {
  for (const sel of ['.bench-banner', '.bench-badge', '.bench-readout', '.bench-strip', '.bench-cell', '.bench-scope', '.bench-code-input']) {
    assert.ok(styleSrc.includes(sel), `${sel} is styled`);
  }
  // A rule written against a variable nobody defines paints nothing and fails
  // silently, which is how a bench can look unstyled in production and styled in a
  // screenshot taken before the variables were renamed.
  const block = styleSrc.slice(styleSrc.indexOf('.bench-banner'), styleSrc.indexOf('.bench-code-input') + 400);
  const used = [...new Set([...block.matchAll(/var\((--[a-z-]+)/g)].map(m => m[1]))];
  assert.ok(used.length, 'the bench uses the kitchen\u2019s variables rather than hardcoded ink');
  const rootVars = styleSrc.slice(styleSrc.indexOf(':root'), styleSrc.indexOf('}', styleSrc.indexOf(':root')));
  for (const v of used) {
    assert.ok(rootVars.includes(v + ':'), `${v} is defined in :root`);
  }
});

test('the user-visible copy carries no build label', () => {
  // The banner is the one sentence a visitor reads about this mode, and it ships in
  // the public build where "1.3 TVBR 3" means nothing to them.
  // A fixed window from the banner: the tool-row that follows it also appears
  // earlier in the file, so slicing to the first match of it would slice backwards.
  const start = musicSrc.indexOf("gEl('div', { class: 'bench-banner' }");
  assert.ok(start > 0, 'the banner is in the source');
  const banner = musicSrc.slice(start, start + 700);
  assert.doesNotMatch(banner, /TVBR|TVAR/, 'no test-version label in the banner');
  assert.match(banner, /🧪 EXPERIMENTAL/, 'the badge that is there instead');
});
