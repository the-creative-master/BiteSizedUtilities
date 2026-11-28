// The on-screen half of the telemetry: the buffer, the formatter, and the
// panel wiring in Settings.
//
// This exists because a console is no use on a device that has no DevTools,
// which describes the tablet this kitchen most needs diagnosing on. It also
// exists because the first cut of the telemetry shipped with no tests at all —
// it was covered by a syntax check and a successful build, and `traceToolMount`
// sits in app.js, which cannot be imported in Node or jsdom because it imports
// a stylesheet. So the hook had never executed anywhere when it went live.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  telLog, telWarn, telemetryEntries, telemetryCount, clearTelemetry,
  subscribeTelemetry, formatEntry, formatTelemetryLog,
  setTelemetryEnabled, telemetryEnabled,
  logAiTurn, resetAiTurnLedger, aiTurnLedger,
  traceToolMount, netFacts, elapsedMs
} from '../waffle-telemetry.js';

const appSrc = fs.readFileSync('app.js', 'utf8');

test('a logged line is kept, and reads back as one greppable line', () => {
  clearTelemetry();
  telLog('tool', 'calculator mounted', { cupboard: 'math', mountMs: 4.2, cleanupReturned: false });

  assert.equal(telemetryCount(), 1);
  const line = formatTelemetryLog();
  assert.match(line, /\[waffle:tool\] calculator mounted/);
  assert.match(line, /cupboard=math mountMs=4\.2 cleanupReturned=no/);
  assert.match(line, /^\d\d:\d\d:\d\d\.\d\d\d/, 'timestamped, so two lines can be ordered');
  assert.ok(!line.includes('\n'), 'and it is one line, not a pretty-printed object');
});

test('a warning is distinguishable in the copied text, not just in colour', () => {
  clearTelemetry();
  telLog('ai', 'fine');
  telWarn('ai', 'not fine');
  const [a, b] = formatTelemetryLog().split('\n');
  assert.ok(!a.includes('WARN'), 'an ordinary line is not marked');
  assert.match(b, /WARN \[waffle:ai\] not fine/, 'and a warning says so in the text itself');
});

test('a value nobody measured prints as unknown, never as a plausible number', () => {
  clearTelemetry();
  telLog('net', 'fetched', { status: 200, bytes: null, header: undefined, empty: '' });
  const line = formatTelemetryLog();
  assert.match(line, /status=200/);
  assert.match(line, /bytes=unknown/, 'null is unknown');
  assert.match(line, /header=unknown/, 'and so is undefined');
  assert.match(line, /empty=unknown/, 'an empty string means nobody said, not that the answer was blank');
  assert.ok(!/=0\b/.test(line), 'nothing was quietly turned into a zero');
});

test('the buffer is bounded, oldest first out', () => {
  clearTelemetry();
  for (let i = 0; i < 200; i++) telLog('tool', `line ${i}`);
  assert.equal(telemetryCount(), 80, 'it stops at the cap');
  const lines = formatTelemetryLog().split('\n');
  assert.match(lines[0], /line 120/, 'and it kept the newest 80, not the first');
  assert.match(lines[79], /line 199/);
});

test('silencing the console does not blind the panel', () => {
  clearTelemetry();
  setTelemetryEnabled(false);
  try {
    assert.equal(telemetryEnabled(), false);
    telLog('tool', 'still recorded');
    assert.equal(telemetryCount(), 1, 'the buffer is the point on a device with no console');
  } finally { setTelemetryEnabled(true); }
});

test('clearing empties it, and a subscriber hears about both', () => {
  clearTelemetry();
  let calls = 0;
  const off = subscribeTelemetry(() => { calls++; });
  telLog('tool', 'one');
  assert.equal(calls, 1, 'notified on a new line');
  clearTelemetry();
  assert.equal(calls, 2, 'and on a clear, so an open panel does not show stale entries');
  assert.equal(telemetryCount(), 0);
  off();
  telLog('tool', 'two');
  assert.equal(calls, 2, 'unsubscribing really unsubscribes');
  assert.deepEqual(telemetryEntries().length, 1, 'entries() is a copy, not the live array');
  clearTelemetry();
});

test('a subscriber that throws does not take the utility down with it', () => {
  clearTelemetry();
  const off = subscribeTelemetry(() => { throw new Error('bad renderer'); });
  assert.doesNotThrow(() => telLog('tool', 'survives'));
  assert.equal(telemetryCount(), 1, 'and the line was still recorded');
  off(); clearTelemetry();
});

test('the turn ledger accumulates against the window and resets with the model', () => {
  resetAiTurnLedger('gemma-2-2b');
  const base = { model: 'gemma-2-2b', useGpu: true, nCtx: 2048, outcome: 'ok' };

  const t1 = logAiTurn({ ...base, promptTokens: 600, replyTokensSeen: 200, genMs: 4000, chunks: 200 });
  assert.equal(t1.turn, 1);
  assert.equal(t1.cumulativePromptTokens, 600);
  assert.equal(t1.windowHeadroomTokens, 2048 - 600);
  assert.equal(t1.windowExhausted, false);
  assert.equal(t1.tokensPerSec, 50, 'derived from two measured numbers: 200 tokens over 4000 ms');
  assert.equal(t1.runtime, 'WebGPU');

  logAiTurn({ ...base, promptTokens: 800 });
  const t3 = logAiTurn({ ...base, promptTokens: 900 });
  assert.equal(t3.turn, 3);
  assert.equal(t3.cumulativePromptTokens, 2300, '600 + 800 + 900');
  assert.equal(t3.windowExhausted, true, 'and 2300 is past a 2048 window');
  assert.ok(t3.windowHeadroomTokens < 0, 'negative, which is what a frozen turn should show');

  resetAiTurnLedger('falcon3-1b');
  assert.deepEqual(aiTurnLedger(), { turnNo: 0, cumulativePromptTokens: 0, model: 'falcon3-1b' },
    'a fresh instance means a fresh context, so the ledger starts again');
  clearTelemetry();
});

test('a turn with nothing measured reports unknowns rather than zeroes', () => {
  resetAiTurnLedger(null);
  const t = logAiTurn({ outcome: 'failed' });
  assert.equal(t.promptTokens, null);
  assert.equal(t.tokensPerSec, null, 'no division by a number nobody supplied');
  assert.equal(t.windowHeadroomTokens, undefined, 'and no headroom claim without a window');
  assert.equal(t.model, 'unknown');
  clearTelemetry();
});

test('the mount hook reports the real return value and the real error', () => {
  clearTelemetry();
  const cleanup = () => {};
  const out = traceToolMount({ id: 'x', name: 'X', cupboard: 'math', mount: () => cleanup });
  assert.equal(out, cleanup, 'the mount result is passed straight through');
  assert.match(formatTelemetryLog(), /cleanupReturned=yes/, 'and it saw that a cleanup came back');

  clearTelemetry();
  const boom = new DOMException('Aborted', 'AbortError');
  assert.throws(
    () => traceToolMount({ id: 'y', name: 'Y', cupboard: 'code', mount: () => { throw boom; } }),
    /Aborted/, 'the error is rethrown, so the caller still shows its own message'
  );
  const logged = formatTelemetryLog();
  assert.match(logged, /WARN \[waffle:tool\] y mount FAILED/);
  assert.match(logged, /error=AbortError/, 'with the error name, which String(err) would have lost');
  clearTelemetry();
});

test('network facts say whether a byte count was measured or declared', () => {
  const declared = netFacts('https://x/y', { status: 200, ok: true, headers: { get: () => '4096' } }, 12);
  assert.equal(declared.bytes, 4096);
  assert.equal(declared.bytesSource, 'content-length');

  const measured = netFacts('https://x/y', { status: 200, ok: true, headers: { get: () => null } }, 12, 3000);
  assert.equal(measured.bytes, 3000);
  assert.equal(measured.bytesSource, 'measured');

  const none = netFacts('https://x/y', { status: 500, ok: false, headers: { get: () => null } }, 12);
  assert.equal(none.bytes, null, 'a chunked response with no body read has no byte count');
  assert.equal(none.bytesSource, 'unknown', 'and it says so instead of implying zero');
});

test('elapsedMs never reports a negative or a NaN duration', () => {
  const t = Date.now() + 100000;
  assert.equal(elapsedMs(t), 0, 'a clock that goes backwards reads as zero, not as negative');
  assert.equal(elapsedMs(undefined), null, 'and no start reads as unknown');
});

/* ---------------- the panel in Settings ---------------- */

test('the panel is in Settings, next to the device report it complements', () => {
  assert.match(appSrc, /On-Screen Console Log/);
  assert.match(appSrc, /id="settings-tel-log"/);
  for (const id of ['settings-tel-toggle', 'settings-tel-copy', 'settings-tel-clear']) {
    assert.match(appSrc, new RegExp(`id="${id}"`), `${id} exists`);
    assert.match(appSrc, new RegExp(`\\$\\('#${id}'\\)\\?\\.addEventListener`), `${id} is wired`);
  }
  assert.match(appSrc, /a tablet has no console to open/, 'and it says why it exists');
});

test('the panel renders text, never markup, and subscribes once', () => {
  // The lines carry error messages and adapter names from outside the page. A
  // log rendered with innerHTML would be a way in.
  const paint = appSrc.slice(appSrc.indexOf('function paintTelemetryLog'));
  assert.match(paint, /box\.textContent = text \|\|/, 'painted as text');
  assert.ok(!/settings-tel-log[\s\S]{0,400}innerHTML/.test(appSrc), 'and never as HTML');

  // The Settings markup is re-rendered every time it opens, so subscribing in
  // the render path would add a listener per open and leak them.
  //
  // Column zero plus exactly one occurrence is the whole proof: any call nested
  // inside a function body would be indented, and a second call would show up in
  // the count. (An earlier version of this assertion sliced the source between
  // `function renderSettingsModal` and `function openSettingsModal` and checked
  // that range, which was wrong twice over — those two functions are not
  // adjacent, so the slice spanned several unrelated functions and the
  // module-scope call landed inside it.)
  assert.match(appSrc, /^subscribeTelemetry\(\(\) => \{/m, 'subscribed at module scope, unindented');
  assert.equal(appSrc.match(/subscribeTelemetry\(/g).length, 1, 'and called exactly once, so not once per render');
  assert.equal(appSrc.match(/paintTelemetryLog\(\)/g).length >= 3, true,
    'the painter is called from the handlers rather than subscribed per open');
});

test('the copy button labels what it copied', () => {
  // A pasted log that does not say which build it came from is half as useful,
  // and the whole reason this panel exists is that the reader is not at a
  // keyboard where they can check.
  assert.match(appSrc, /BiteSizedUtilities \$\{appVersionLabel\(\)\}/);
  assert.match(appSrc, /import \{ openChangelog, appVersionLabel \} from '\.\/changelog\.js';/,
    'and appVersionLabel is actually imported, not just referenced');
  assert.match(appSrc, /import \{ gameSlider, copyToClipboard \} from '\.\/ui-kit\.js';/,
    'reusing the clipboard helper the rest of the kitchen uses');
  assert.match(appSrc, /Copy failed/, 'with a fallback message when the clipboard refuses');
});
