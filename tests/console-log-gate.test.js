// 1.3 put the console log in both kitchens; 1.3.1 takes it out of the public
// one and leaves it where a build gets tried. The hazard is a half-removed
// feature: a panel that renders over a buffer nothing writes to, or a buffer
// that keeps filling on every visitor's device behind a panel nobody can open.
// So the gate has to cover the recording, the printing and the markup together.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  telLog, telWarn, telemetryCount, telemetryEntries, formatTelemetryLog,
  clearTelemetry, consoleLogShipped, setConsoleLogShipped,
  telemetryEnabled, setTelemetryEnabled, traceToolMount
} from '../waffle-telemetry.js';

const appSrc = fs.readFileSync('app.js', 'utf8');

// Every test in here flips module state, so each one puts it back: the file runs
// in one process and a leaked `shipped = false` would make the tests after it
// pass for the wrong reason.
function withShipped(v, fn) {
  const wasShipped = consoleLogShipped();
  const wasEnabled = telemetryEnabled();
  try {
    setConsoleLogShipped(v);
    clearTelemetry();
    return fn();
  } finally {
    setConsoleLogShipped(wasShipped);
    setTelemetryEnabled(wasEnabled);
    clearTelemetry();
  }
}

function captureConsole(fn) {
  const seen = [];
  const real = { log: console.log, warn: console.warn };
  console.log = (...a) => seen.push(['log', ...a]);
  console.warn = (...a) => seen.push(['warn', ...a]);
  try { fn(); } finally { console.log = real.log; console.warn = real.warn; }
  return seen;
}

test('the module records by default, so it stays testable where there is no page to ask', () => {
  // The default looks backwards for a gate that is off in the public kitchen,
  // and it is deliberate: in Node there is no `document`, so `isBackupBuild()`
  // is false everywhere, and a default of false would silence every test that
  // asserts a line was recorded. The app says which kitchen it is; the module
  // obeys.
  withShipped(true, () => {
    assert.equal(consoleLogShipped(), true);
    telLog('tool', 'calculator mounted', { cupboard: 'math', mountMs: 4.2 });
    assert.equal(telemetryCount(), 1, 'a line was recorded');
    assert.match(formatTelemetryLog(), /\[waffle:tool\] calculator mounted cupboard=math mountMs=4\.2/);
  });
});

test('a kitchen that does not ship the log records nothing at all', () => {
  withShipped(false, () => {
    assert.equal(consoleLogShipped(), false);
    telLog('tool', 'calculator mounted', { cupboard: 'math', mountMs: 4.2 });
    telWarn('ai', 'chat turn failed', { outcome: 'failed' });
    const result = traceToolMount({ id: 'x', name: 'X', cupboard: 'math', mount: () => ({ ok: true }) });
    assert.ok(result, 'and the wrapped mount still runs and still returns — the gate costs a feature, not a utility');
    assert.equal(telemetryCount(), 0, 'nothing in the buffer');
    assert.deepEqual(telemetryEntries(), []);
    assert.equal(formatTelemetryLog(), '', 'and nothing for a copy button to copy');
  });
});

test('the gate covers the console and the buffer at once, not one of them', () => {
  const off = withShipped(false, () => captureConsole(() => {
    telLog('tool', 'a mounted');
    telWarn('ai', 'b failed');
  }));
  assert.deepEqual(off, [], 'a kitchen without the log prints nothing either');

  const on = withShipped(true, () => captureConsole(() => {
    telLog('tool', 'a mounted');
    telWarn('ai', 'b failed');
  }));
  assert.equal(on.length, 2, 'while one with it prints both lines');
  assert.deepEqual(on.map(l => l[0]), ['log', 'warn']);
  assert.equal(on[0][1], '[waffle:tool]', 'still tagged by scope');
});

test('the console kill switch still works inside a kitchen that does ship the log', () => {
  // Two different switches, and they are not the same decision: `shipped` is
  // which kitchen this is, `enabled` is whether the visitor wants console
  // output. Silencing the console must not blind the buffer, because the panel
  // is the reason the buffer exists on a device with no DevTools.
  withShipped(true, () => {
    setTelemetryEnabled(false);
    const seen = captureConsole(() => telLog('tool', 'a mounted'));
    assert.deepEqual(seen, [], 'the console is quiet');
    assert.equal(telemetryCount(), 1, 'but the line was still recorded for the panel');
    setTelemetryEnabled(true);
  });
});

test('turning the log off empties what it had already collected', () => {
  withShipped(true, () => {
    telLog('tool', 'a mounted');
    assert.equal(telemetryCount(), 1);
    setConsoleLogShipped(false);
    assert.equal(telemetryCount(), 0,
      'a gate that left the old lines in the buffer would hand the next reader a log from a kitchen that does not have one');
  });
});

test('the app sets the gate from the one build flag, before anything can log', () => {
  assert.match(appSrc, /setConsoleLogShipped\(BACKUP_BUILD\);/, 'one call, from the flag the rest of the build uses');
  const flagAt = appSrc.indexOf('const BACKUP_BUILD = isBackupBuild();');
  const gateAt = appSrc.indexOf('setConsoleLogShipped(BACKUP_BUILD);');
  const firstTrace = appSrc.indexOf('traceToolMount({');
  assert.ok(flagAt > -1 && gateAt > flagAt, 'set after the flag is read');
  assert.ok(gateAt < firstTrace,
    'and before the first instrumented mount, so no line is recorded while the kitchen is still deciding whether it keeps one');
});

test('the panel is rendered only where the log is kept', () => {
  const open = appSrc.indexOf('${consoleLogShipped() ? `');
  assert.ok(open > -1, 'the markup is behind the gate');
  const close = appSrc.indexOf("` : ''}", open);
  assert.ok(close > open, 'and the conditional closes');
  const block = appSrc.slice(open, close);
  for (const id of ['settings-tel-toggle', 'settings-tel-copy', 'settings-tel-clear', 'settings-tel-log',
    'On-Screen Console Log']) {
    assert.ok(block.includes(id), `${id} is inside it`);
  }
  // The device facts are the other half of that popup and they are not part of
  // this change: removing a log must not remove the report a visitor pastes
  // when the AI will not start.
  const deviceFacts = appSrc.indexOf('id="settings-device-detail"');
  assert.ok(deviceFacts > -1 && deviceFacts < open,
    'the detected-device facts stay in the popup, outside the gated block');
  assert.match(appSrc, /function paintDeviceFacts\(d\) \{/, 'painted from the diagnostics passed in');
  const paint = appSrc.slice(appSrc.indexOf('function paintDeviceFacts(d) {'));
  assert.ok(!/formatTelemetryLog|telemetryEntries|telemetryCount/.test(paint.slice(0, 2000)),
    'and it reads nothing from the telemetry buffer, so it survives the log leaving');
});
