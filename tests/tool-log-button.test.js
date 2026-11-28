// 1.3 TVAR 1 moves the console log from the bottom of a device-warning popup to
// the corner of the utility being debugged. The hazard is not the button, it is
// the second copy of the log that a button invites: two panels over one buffer,
// painted by two functions, disagreeing about the last 80 lines. So these pin the
// button's placement, its gate, and the fact that there is still one buffer.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  telLog, telemetryCount, formatTelemetryLog, clearTelemetry,
  setConsoleLogShipped, consoleLogShipped, traceToolMount
} from '../waffle-telemetry.js';

const appSrc = fs.readFileSync('app.js', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
const gamesSrc = fs.readFileSync('games.js', 'utf8');

function fnSrc(name) {
  const start = appSrc.indexOf(`function ${name}(`);
  assert.ok(start > -1, `${name}() exists in app.js`);
  const next = appSrc.indexOf('\nfunction ', start + 1);
  return appSrc.slice(start, next < 0 ? appSrc.length : next);
}

test('every utility window gets the button in the corner row it already has', () => {
  const openTool = fnSrc('openTool');
  assert.match(openTool, /data-open-console-log/, 'openTool renders it');
  // openTool is the single choke point all 105 utilities pass through, which is
  // why the button is in one place rather than in a hundred.
  const actions = openTool.slice(openTool.indexOf('<div class="window-head-actions">'));
  const logAt = actions.indexOf('data-open-console-log');
  const favAt = actions.indexOf('data-fav=');
  const closeAt = actions.indexOf('window-close-x');
  assert.ok(logAt > -1 && favAt > -1 && closeAt > -1, 'the corner row has all three');
  assert.ok(logAt < favAt && favAt < closeAt,
    'log, then heart, then close: the corner row keeps its existing order and gains one button');
  assert.match(openTool, /aria-label="Show the console log"/, 'named for a screen reader, not by its emoji');
  assert.match(openTool, /title="Console log"/, 'and for a pointer that hovers');
});

test('the button and its overlay are rendered only where the log is kept', () => {
  // 1.3.1 made the log a test-kitchen instrument. A button in the public kitchen
  // would open a panel that is always empty, which is worse than no button.
  const gated = appSrc.match(/\$\{consoleLogShipped\(\) \? `/g) || [];
  assert.ok(gated.length >= 2, `both the button and the overlay sit behind the gate (found ${gated.length})`);

  const btnAt = appSrc.indexOf('data-open-console-log');
  const btnGate = appSrc.lastIndexOf('${consoleLogShipped() ? `', btnAt);
  assert.ok(btnAt - btnGate < 700, 'the button is inside a gated block, not merely after one');

  const overlayAt = appSrc.indexOf('id="console-log-overlay"');
  const overlayGate = appSrc.lastIndexOf('${consoleLogShipped() ? `', overlayAt);
  assert.ok(overlayAt - overlayGate < 900, 'and so is the overlay it opens');

  // The gate is read, not a second copy of the build flag: consoleLogShipped() is
  // set once from isBackupBuild(), so the button and the recording cannot
  // disagree about which kitchen this is.
  assert.match(appSrc, /setConsoleLogShipped\(BACKUP_BUILD\);/, 'one call sets it, from the build flag');
  assert.ok(!/data-open-console-log[\s\S]{0,200}isBackupBuild\(\)/.test(appSrc),
    'and the button does not re-ask the question a second way');
});

test('the overlay is one dialog with the controls the inline panel already had', () => {
  for (const id of ['console-log-overlay', 'console-log-title', 'console-log-close',
    'console-log-copy', 'console-log-clear', 'console-log-text']) {
    assert.match(appSrc, new RegExp(`id="${id}"`), `${id} exists`);
  }
  for (const id of ['console-log-close', 'console-log-copy', 'console-log-clear']) {
    assert.match(appSrc, new RegExp(`\\$\\('#${id}'\\)\\?\\.addEventListener`), `${id} is wired`);
  }
  assert.match(appSrc, /role="dialog" aria-modal="true" aria-labelledby="console-log-title"/,
    'it is a dialog that says what labels it');
  assert.match(appSrc, /\$\('#console-log-overlay'\);\n  if \(!overlay\) return;\n  overlay\.hidden = false;/,
    'and opening it is guarded, so a kitchen without it does not throw');
  assert.match(appSrc, /a value nobody could measure prints unknown/,
    'it repeats the promise the log makes, rather than letting the reader assume it');
});

test('two surfaces, one buffer, one painter', () => {
  const paint = fnSrc('paintTelemetryLog');
  assert.match(paint, /\$\('#settings-tel-log'\)/, 'the painter still finds the inline panel');
  assert.match(paint, /\$\('#console-log-text'\)/, 'and the overlay');
  assert.match(paint, /for \(const box of \[inline, \$\('#console-log-text'\)\]\)/,
    'one loop over both, so they cannot show different lines');
  assert.match(paint, /box\.textContent = text \|\| empty;/, 'painted as text, never as markup');
  assert.ok(!/innerHTML/.test(paint), 'and the painter has no innerHTML at all');

  assert.equal(appSrc.match(/subscribeTelemetry\(/g).length, 1, 'still subscribed exactly once');
  assert.match(appSrc, /^subscribeTelemetry\(\(\) => \{/m, 'at module scope, unindented');
  const sub = appSrc.slice(appSrc.indexOf('subscribeTelemetry(() => {'));
  assert.match(sub.slice(0, 320), /console-log-overlay/,
    'and the one subscription repaints whichever surface is open');

  // A second painter would be a second opinion about what the last 80 lines are.
  assert.equal(appSrc.match(/function paintTelemetryLog/g).length, 1, 'there is one painter');
});

test('the copy says which build it came from, identically from either surface', () => {
  const header = /copyToClipboard\(`BiteSizedUtilities \$\{appVersionLabel\(\)\} \\u2014 on-screen log\\n\$\{body\}`\)/g;
  const hits = appSrc.match(header) || [];
  assert.equal(hits.length, 2, 'both copy buttons use the same header, so a pasted log cannot be told apart by where it was copied from');
  assert.equal(appSrc.match(/const body = formatTelemetryLog\(\) \|\| '\(empty\)';/g).length, 2,
    'and both fall back to naming an empty log rather than copying nothing');
  assert.equal(appSrc.match(/clearTelemetry\(\); paintTelemetryLog\(\);/g).length, 2,
    'clearing from either surface clears the one buffer they share');
});

test('the button takes the corner row it joins rather than inventing a size', () => {
  const btn = css.slice(css.indexOf('.console-log-btn {'));
  const fav = css.slice(css.indexOf('.favorite-btn {'));
  for (const prop of ['width: 42px', 'height: 42px', 'padding: 7px', 'border-radius: 50%']) {
    assert.ok(btn.slice(0, 220).includes(prop), `the log button is ${prop}`);
    assert.ok(fav.slice(0, 160).includes(prop), `like the heart beside it, which is also ${prop}`);
  }
  assert.match(css, /#console-log-overlay \.settings-card \{/, 'the overlay card has its own width');
  assert.match(css, /overscroll-behavior: contain/,
    'and scrolling the log does not scroll the kitchen underneath it');
  assert.ok(!css.includes('backdrop-filter'), 'still no frosted blur anywhere in the kitchen');
});

test('Games & Fun gets no button, because it gets no lines', () => {
  // The exclusion 1.3 wrote down: those are animation loops on
  // requestAnimationFrame, where a console line per frame costs more than it
  // reports. A button over an empty buffer would advertise a log that does not
  // exist for the one cupboard that never had one.
  assert.ok(!gamesSrc.includes('data-open-console-log'), 'the games module renders no log button');
  assert.ok(!gamesSrc.includes('traceToolMount'), 'and is not instrumented');
  assert.match(appSrc, /Games & Fun mounts\s*\n?\s*\/\/ through its own path|Games & Fun mounts through its own path/,
    'openTool says why the cupboard is not covered');
});

test('the buffer the button opens is the one the mounts actually write', () => {
  const was = consoleLogShipped();
  try {
    setConsoleLogShipped(true);
    clearTelemetry();
    traceToolMount({ id: 'calculator', name: 'Calculator', cupboard: 'math', mount: () => ({ ok: true }) });
    telLog('ai', 'chat turn 1', { model: 'MiniCPM-V 4.6 1.3B', chunks: 12, replyChars: 0 });
    assert.equal(telemetryCount(), 2, 'two lines from two different scopes');
    const text = formatTelemetryLog();
    assert.match(text, /\[waffle:tool\] calculator mounted cupboard=math/, 'the mount line the button would show');
    // Quoted, because the formatter wraps any value containing a space: a copied
    // log has to stay parseable by something other than an eye, and a model name
    // with three spaces in it would otherwise read as four key=value pairs.
    assert.match(text, /\[waffle:ai\] chat turn 1 model="MiniCPM-V 4\.6 1\.3B" chunks=12 replyChars=0/,
      'and the AI turn beside it, with the model name quoted so the line still parses');

    setConsoleLogShipped(false);
    assert.equal(telemetryCount(), 0,
      'and in a kitchen that does not ship the log there is nothing for the button to open, which is why it is not rendered there');
  } finally {
    setConsoleLogShipped(was);
    clearTelemetry();
  }
});
