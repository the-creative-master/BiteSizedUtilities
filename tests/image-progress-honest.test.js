/**
 * The progress bar, and the two ways it lied.
 *
 * It was reported from a real device as "image gen stuck at 4%". Nothing was
 * stuck: at 4% the run was waiting on the chat model that rewrites a short prompt
 * before the image engine is asked for anything, and that phase reported nothing
 * at all. Underneath it were two mapping bugs that produced the same symptom from
 * the other direction — a stage with no fraction printed the floor of its band and
 * the rule against walking backwards then held that number, and weights arrive in
 * shards that each restart their own `loaded/total` at zero, so the bar climbed
 * once and waited at the clamp for the rest of the download.
 *
 * All three are testable without an engine, a GPU or a download, because the
 * mapping is a pure function of an event and the state it is handed. That is why
 * it was lifted out of `reportProgress` in the first place: a bar that can only be
 * exercised by generating a picture cannot be exercised at all in CI.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  progressFromEvent, newProgressState, stageFraction, humanDuration
} from '../waffle-image-gen.js';

const aiSrc = fs.readFileSync('waffle-ai.js', 'utf8');
const cssSrc = fs.readFileSync('style.css', 'utf8');

const MB = 2 ** 20;
const GB = 2 ** 30;

/** A run, driven event by event, collecting what the surface would have shown. */
function run(events) {
  const state = newProgressState(0);
  return events.map(([now, stage, detail]) => progressFromEvent({ stage, detail }, state, now));
}

const ev = (now, stage, detail) => [now, stage, detail];

/* --------------------------------- the shards --------------------------------- */

test('three shards walk the band once between them instead of three times over it', () => {
  // The shape of a real phone download: 3.3 GB in three shards, each reporting its
  // own loaded/total, each therefore restarting at zero.
  const shard = 1100 * MB;
  const reports = run([
    ev(0, 'weights', { shard: 1, shards: 3, loaded: 0, total: shard }),
    ev(20_000, 'weights', { shard: 1, shards: 3, loaded: shard, total: shard }),
    ev(20_100, 'weights', { shard: 2, shards: 3, loaded: 0, total: shard }),
    ev(40_000, 'weights', { shard: 2, shards: 3, loaded: shard, total: shard }),
    ev(40_100, 'weights', { shard: 3, shards: 3, loaded: 0, total: shard }),
    ev(60_000, 'weights', { shard: 3, shards: 3, loaded: shard, total: shard })
  ]);
  const percents = reports.map(r => r.percent);

  // The band is 28…78. Folded correctly the last shard ends at its top; unfolded,
  // every shard would have ended at 78 and the two after it would have been held
  // there by the clamp with nothing moving.
  assert.equal(percents[0], 28, 'shard one starts at the floor of the band');
  assert.equal(percents[1], 45, 'and ends a third of the way across it');
  assert.equal(percents[3], 61, 'shard two ends two thirds across');
  assert.equal(percents[5], 78, 'shard three ends at the top');

  for (let i = 1; i < percents.length; i++) {
    assert.ok(percents[i] >= percents[i - 1], `the bar never walks backwards (step ${i})`);
  }
  // The bug, stated as the thing that must not happen: a shard boundary that
  // produces no visible movement at all.
  assert.ok(percents[2] < percents[3], 'shard two moves after it starts');
  assert.ok(percents[4] < percents[5], 'and so does shard three');
});

test('a shard reports its own bytes and which shard it is, because those are the numbers worth reading', () => {
  const [r] = run([ev(5_000, 'weights', { shard: 2, shards: 3, loaded: 500 * MB, total: 1100 * MB })]);
  assert.equal(r.loadedMB, 500);
  assert.equal(r.totalMB, 1100);
  assert.equal(r.shard, 2);
  assert.equal(r.shards, 3);
  assert.equal(r.indeterminate, false, 'a stage with a fraction is a measurement');
});

/* -------------------------------- the frozen bar ------------------------------- */

test('a stage with nothing to measure says so instead of printing its band floor', () => {
  const [fetchStart] = run([ev(1_000, 'text-encoder', {})]);
  assert.equal(fetchStart.indeterminate, true, 'flagged, so the surface stripes the bar and counts seconds');
  assert.equal(fetchStart.percent, 5, 'the number is still the floor of the band');
  assert.equal(fetchStart.stage, '1/4 · Text encoder', 'and the label still says what is happening');

  // The reason this matters: the same event, once bytes arrive, is a measurement.
  const [, withBytes] = run([
    ev(1_000, 'text-encoder', {}),
    ev(2_000, 'text-encoder', { loaded: 400 * MB, total: 1000 * MB })
  ]);
  assert.equal(withBytes.indeterminate, false);
  assert.ok(withBytes.percent > 5, 'and the bar moves off the floor');
});

test('a cached stage is finished rather than 0% of itself', () => {
  // A warm run reads the weights out of the browser's own storage in milliseconds.
  // Under the old rule that instant stage spent its milliseconds at the bottom of
  // a 20-point band, so the run that should have looked fastest looked stuck.
  assert.equal(stageFraction({ stage: 'text-encoder', detail: { cached: true } }), 1);
  assert.equal(stageFraction({ stage: 'weights', detail: { shard: 2, shards: 3, cached: true } }), 1);
  const [r] = run([ev(300, 'text-encoder', { cached: true })]);
  assert.equal(r.percent, 25, 'it lands at the top of its band');
  assert.equal(r.indeterminate, false, 'and it is not flagged as unknown');
  assert.equal(r.loadedMB, undefined, 'a cached stage has no bytes to report');
});

test('an event this file has never heard of is held, labelled, and printed anyway', () => {
  const reports = run([
    ev(0, 'weights', { shard: 1, shards: 1, loaded: 900 * MB, total: 1000 * MB }),
    ev(1_000, 'some-stage-added-in-a-later-version', { text: 'doing a new thing' })
  ]);
  const held = reports[1];
  assert.equal(held.stage, 'Working…', 'it gets a label rather than being dropped');
  assert.equal(held.indeterminate, true, 'and no number it cannot back up');
  assert.equal(held.percent, reports[0].percent, 'the bar holds where it was');
  assert.equal(held.engineStage, 'some-stage-added-in-a-later-version', 'the event it came from is still on the report');
});

test('the denoise gets half a step of credit for a finished step, and reaches the top of its band', () => {
  assert.equal(stageFraction({ stage: 'denoise', detail: { step: 1, steps: 2 } }), 0.25);
  assert.equal(stageFraction({ stage: 'denoise', detail: { step: 2, steps: 2 } }), 0.75);
  // The mobile build reports segments inside a step instead.
  assert.equal(stageFraction({ stage: 'denoise', detail: { step: 1, i: 4, n: 8 } }), 0.5);
  assert.equal(stageFraction({ stage: 'denoise', detail: {} }), null, 'and says so when it has nothing');

  const reports = run([
    ev(0, 'denoise', { step: 1, steps: 2 }),
    ev(9_000, 'denoise', { step: 2, steps: 2 })
  ]);
  assert.equal(reports[0].step, 1);
  assert.equal(reports[0].steps, 2);
  assert.ok(reports[1].percent > reports[0].percent, 'the second step moves the bar');
  assert.ok(reports[1].percent <= 98, 'without claiming the decode that has not run yet');
});

/* ---------------------------------- the clock ---------------------------------- */

test('elapsed time counts from a zero epoch, which a truthiness check would have counted from now', () => {
  // `now - (state.startedAt || now)` reads as defensive and is not: a run that
  // starts at 0 — which is what a page's own clock does — would have reported no
  // elapsed time forever, and the clock is the one signal on screen that has to
  // keep moving while a download does.
  const state = newProgressState(0);
  assert.equal(progressFromEvent({ stage: 'tokenizer', detail: {} }, state, 0).elapsedMs, 0);
  assert.equal(progressFromEvent({ stage: 'tokenizer', detail: {} }, state, 5_000).elapsedMs, 5_000);
  assert.equal(progressFromEvent({ stage: 'tokenizer', detail: {} }, state, 65_000).elapsedMs, 65_000);
});

test('an estimate waits for a rate that was actually measured, and counts the shards still to come', () => {
  // A steady 200 MB/s, so the smoothing converges on the true rate and the
  // expected number is arithmetic rather than a tolerance around a guess.
  const shard = 1000 * MB;
  const reports = run([
    ev(0, 'weights', { shard: 1, shards: 2, loaded: 0, total: shard }),
    ev(2_000, 'weights', { shard: 1, shards: 2, loaded: 400 * MB, total: shard }),
    ev(4_000, 'weights', { shard: 1, shards: 2, loaded: 800 * MB, total: shard })
  ]);
  assert.equal(reports[0].etaMs, undefined, 'the first sample of a download is not a rate');
  assert.equal(reports[1].etaMs, 8_000, 'two seconds of transfer is: 600 MB of this shard, then 1,000 MB of the next');
  assert.equal(reports[2].etaMs, 6_000, 'and it keeps counting down as bytes arrive');
  // The part that matters: an ETA built from this shard alone would have said one
  // second here, and a run that is halfway through a two-shard download is not one
  // second from finished.
  assert.ok(reports[2].etaMs > 5_000, 'the shard still to come is in the number');
});

test('a rate is not offered before it has been measured for long enough to mean anything', () => {
  const reports = run([
    ev(0, 'text-encoder', { loaded: 0, total: 1000 * MB }),
    // 400 MB in half a second. A real number, from half a second of one transfer
    // on a radio that has not decided what it is doing yet.
    ev(500, 'text-encoder', { loaded: 400 * MB, total: 1000 * MB })
  ]);
  assert.equal(reports[1].etaMs, undefined, '500 ms is not a measurement');
});

test('a rate measured on one download is not reused to promise a time for another', () => {
  const reports = run([
    ev(0, 'text-encoder', { loaded: 0, total: 1000 * MB }),
    ev(3_000, 'text-encoder', { loaded: 1000 * MB, total: 1000 * MB }),
    // A different stage: the sample resets, so no ETA is offered until this one
    // has been measured in its own right.
    ev(3_100, 'weights', { shard: 1, shards: 4, loaded: 800 * MB, total: 900 * MB })
  ]);
  assert.equal(reports[2].etaMs, undefined, 'the first sample of a new download is not an estimate');
});

test('humanDuration reads like a wait and not like a timestamp', () => {
  assert.equal(humanDuration(0), '0 s');
  assert.equal(humanDuration(45_000), '45 s');
  assert.equal(humanDuration(200_000), '3 min 20 s');
  assert.equal(humanDuration(180_000), '3 min');
  assert.equal(humanDuration(3_900_000), '1 h 05 min');
  assert.equal(humanDuration(-5), '0 s', 'a negative wait is no wait');
  assert.equal(humanDuration(undefined), '0 s', 'and neither is a missing one');
});

/* --------------------------- the surface that renders it --------------------------- */

test('the bubble prints a percentage only when one was measured', () => {
  assert.match(aiSrc, /p\.indeterminate \? '…' : `\$\{pct \?\? 0\}%`/,
    'an indeterminate phase reads as an ellipsis rather than a number');
  assert.ok(!/Math\.max\(4, p\.percent/.test(aiSrc),
    'the old bar drew 4% of width for a run that had measured nothing');
  assert.match(aiSrc, /class="waffle-img-progress\$\{p\.indeterminate \? ' is-indeterminate' : ''\}"/,
    'and the container is marked so the stylesheet can stripe it');
  assert.match(cssSrc, /\.waffle-img-progress\.is-indeterminate \.waffle-img-prog-bar > span/,
    'which it does');
  assert.match(cssSrc, /@keyframes waffle-prog-stripes/, 'with an animation a still bar cannot fake');
  assert.match(cssSrc, /prefers-reduced-motion: reduce/, 'that stops for anybody who asked it to');
});

test('the bubble carries the engine’s own numbers, and calls an estimate an estimate', () => {
  assert.match(aiSrc, /MB of \$\{p\.totalMB\} MB/, 'bytes the engine counted');
  assert.match(aiSrc, /part \$\{p\.shard\} of \$\{p\.shards\}/, 'which shard of how many');
  assert.match(aiSrc, /about \$\{humanDuration\(p\.etaMs\)\} left, estimated/,
    'an estimate that says it is one');
  assert.match(aiSrc, /step \$\{p\.step\} of \$\{p\.steps\}/, 'and the denoise step');
});

test('the phase that used to freeze at 4% now reports the chat model it is waiting on', () => {
  assert.match(aiSrc, /Polishing your prompt with the chat model/, 'by name');
  const polish = aiSrc.slice(aiSrc.indexOf('Polishing your prompt with the chat model'));
  assert.match(polish, /onStatus: s => \{/, 'wired to the chat engine’s own status');
  assert.match(polish, /s\?\.detail \|\| s\?\.state/, 'passed through rather than reworded');
  assert.ok(!/stage: 'Polishing prompt…', percent: 4/.test(aiSrc),
    'and the hard-coded 4% that described none of it is gone');
});

test('one clock on screen cannot freeze, and is stopped when the run is', () => {
  // The engine reports when it has something to say, which on a first run is
  // minutes apart. This is the signal that does not depend on it having something
  // to say.
  assert.match(aiSrc, /progressTicker = setInterval\(/, 'a one-second redraw');
  assert.match(aiSrc, /const stampElapsed = prog => \(prog \? \{ \.\.\.prog, elapsedMs: Date\.now\(\) - runStartedAt \} : prog\);/,
    'which stamps the run’s own clock onto whatever the last report was');
  assert.match(aiSrc, /if \(progressTicker\) \{ clearInterval\(progressTicker\); progressTicker = null; \}/,
    'and is cleared, so a stopped run does not leave a counter behind a finished message');
  const cleared = aiSrc.indexOf('clearInterval(progressTicker); progressTicker = null;');
  const finallyAt = aiSrc.lastIndexOf('} finally {', cleared);
  assert.ok(finallyAt > aiSrc.indexOf('async function runImageGeneration('),
    'from the same finally that clears the abort controller');
});

test('the band table covers every stage the engine can emit', () => {
  // Read out of the library's own STAGE list rather than typed in here, so a stage
  // added by a future version shows up as a missing band instead of as a bar that
  // quietly stops moving.
  const progressSrc = fs.readFileSync('node_modules/flux-klein.js/src/progress.js', 'utf8');
  const stages = [...progressSrc.matchAll(/^\s{2}([A-Z_]+): "([a-z0-9-]+)"/gm)].map(m => m[2]);
  assert.ok(stages.length >= 19, `the library declares its stages (${stages.length})`);
  const phases = fs.readFileSync('waffle-image-gen.js', 'utf8');
  const table = phases.slice(phases.indexOf('const PHASES = {'), phases.indexOf('const MB = 2 ** 20;'));
  for (const stage of stages) {
    assert.ok(new RegExp(`(^|\\n)\\s*'?${stage}'?:\\s*\\{ label:`).test(table),
      `${stage} has a band, so it is never rendered as a generic "Working…"`);
  }
});
