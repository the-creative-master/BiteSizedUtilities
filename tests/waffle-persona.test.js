import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  WAFFLE_IDENTITY,
  WAFFLE_IDENTITY_GUARD,
  WAFFLE_ATTACHED_FILE_RULE,
  buildWaffleSystemPrompt,
  isWafflePersona,
  stripModelScaffolding
} from '../waffle-persona.js';

/* ------------------------------------------------------------------ *
 * The bug this release exists to fix
 * ------------------------------------------------------------------ */

test('the reply Falcon 3 1B was actually sending comes back as the reply', () => {
  // Reported verbatim: every answer, including "hello", arrived wrapped as if it
  // were a file the kitchen had attached.
  const reported = '--- BEGIN FILE ---\n\nHello! How can I assist you today?\n\n--- END FILE ---\n';
  assert.equal(stripModelScaffolding(reported).trim(), 'Hello! How can I assist you today?');

  // And nothing about the answer itself is touched.
  const answer = 'Use `x**2`, not `x^2`:\n\n```python\nprint(x ** 2)\n```\n\nThat is the whole fix.';
  assert.equal(stripModelScaffolding(answer), answer, 'an ordinary answer is byte-identical after cleaning');
});

test('every shape the markers arrive in is removed, and the line goes with them', () => {
  const shapes = [
    '--- BEGIN FILE ---',
    '--- END FILE ---',
    '--- BEGIN FILE: notes.txt ---',
    '--- END FILE: notes.txt ---',
    '--BEGIN FILE--',
    '   --- BEGIN FILE ---   ',
    '--- WEB SEARCH RESULTS ---',
    '--- END WEB SEARCH RESULTS ---'
  ];
  for (const line of shapes) {
    const out = stripModelScaffolding(`Before.\n${line}\nAfter.`);
    assert.equal(out, 'Before.\nAfter.', `${JSON.stringify(line)} is gone, newline and all`);
    assert.ok(!out.includes('\n\n'), 'and it leaves no blank line where it was');
  }
});

test('ordinary Markdown that looks a bit like a marker survives', () => {
  const kept = [
    'A rule:\n---\nand more.',
    '- one\n- two\n- three',
    'Try this:\n```python\nprint(1)\n```\nDone.',
    'A table:\n| a | b |\n|---|---|\n| 1 | 2 |',
    'Dashes mid-sentence --- like this --- stay.',
    '--- BEGINNING OF SOMETHING ELSE ---'
  ];
  for (const text of kept) {
    assert.equal(stripModelScaffolding(text), text, JSON.stringify(text.slice(0, 40)));
  }
});

/* ------------------------------------------------------------------ *
 * Streaming: never flash a marker, never eat a real one
 * ------------------------------------------------------------------ */

test('a half-written marker is held back mid-stream and comes back if it was text', () => {
  for (const tail of ['-', '--', '---', '--- B', '--- BE', '--- BEGIN FI', '--- END FILE', '--- WEB SE']) {
    const shown = stripModelScaffolding(`Answer.\n${tail}`, { streaming: true });
    assert.equal(shown, 'Answer.\n', `${JSON.stringify(tail)} is not shown yet`);
  }
  // The same tail, once it turns out to be an ordinary line, is not eaten: the
  // next token completes it and the hold-back stops matching.
  assert.equal(
    stripModelScaffolding('Answer.\n--- BEGINNING of a section', { streaming: true }),
    'Answer.\n--- BEGINNING of a section'
  );
  assert.equal(
    stripModelScaffolding('Answer.\n- a bullet', { streaming: true }),
    'Answer.\n- a bullet'
  );
});

test('the committed message keeps a trailing rule that only looked like a marker', () => {
  // Holding back is a streaming-only trick. The final text is what gets stored,
  // copied and exported, so a bare `---` at the end has to survive it.
  assert.equal(stripModelScaffolding('Answer.\n---'), 'Answer.\n---');
  assert.equal(stripModelScaffolding('Answer.\n---', { streaming: true }), 'Answer.\n');
});

test('an unclosed reasoning block is dropped where it always was, and kept where it always was', () => {
  const truncated = 'The answer is 4.\n<think>more reasoning that never closed';
  assert.equal(stripModelScaffolding(truncated, { streaming: true }), 'The answer is 4.\n');
  assert.equal(stripModelScaffolding(truncated, { dropUnclosedThink: true }), 'The answer is 4.\n');
  // Two of the engine return paths have only ever removed *closed* blocks. This
  // release adds fence cleaning, not a change of mind about those two.
  assert.equal(stripModelScaffolding(truncated), truncated);
  assert.equal(
    stripModelScaffolding('<think>hidden</think>shown', { dropUnclosedThink: true }),
    'shown'
  );
});

/* ------------------------------------------------------------------ *
 * The persona
 * ------------------------------------------------------------------ */

test('Sir Waffle says who he is and what the site is, in two sentences', () => {
  const prompt = buildWaffleSystemPrompt();
  assert.match(prompt, /^You are Sir Waffle/, 'the name is the first thing in the prompt');
  assert.match(prompt, /BiteSizedUtilities/, 'and so is the site');
  assert.match(prompt, /runs in the browser/, 'which is the one thing worth knowing about it');
  assert.match(prompt, /writing and language tools, maths, art, code and games/, 'described by what is in it');

  // The identity is two sentences. A small model imitates its instructions, so
  // this is a budget and not a style preference.
  const identity = WAFFLE_IDENTITY.split('. ').filter(Boolean);
  assert.ok(identity.length <= 2, `the introduction is ${identity.length} sentences`);
  assert.ok(WAFFLE_IDENTITY.length < 260, `and ${WAFFLE_IDENTITY.length} characters long`);
  assert.ok(prompt.length < 1000, `the whole standing persona is ${prompt.length} characters`);
});

test('the identity is told not to leak into answers that are not about it', () => {
  const prompt = buildWaffleSystemPrompt();
  assert.match(prompt, /Answer the question that was asked/, 'the guard is in there');
  assert.match(WAFFLE_IDENTITY_GUARD, /never work waffles, syrup or the kitchen into an unrelated answer/);
  assert.ok(prompt.endsWith(WAFFLE_IDENTITY_GUARD), 'and it is the last thing the model reads');

  // The rule this replaces was written to keep waffle roleplay out of the
  // prompt. Adding a name must not put the roleplay back.
  assert.ok(!/maple syrup|crispy waffle|golden waffle|delicious|breakfast/i.test(prompt),
    'no flavour imagery for the model to imitate');
  assert.equal(prompt.match(/waffle/gi)?.length, 2, 'the word appears in the name and in the guard, nowhere else');
});

test('the attached-file rule travels only with a message that has a file', () => {
  const plain = buildWaffleSystemPrompt();
  const withFile = buildWaffleSystemPrompt({ hasFile: true });

  assert.ok(!plain.includes('BEGIN FILE'), 'a chat with nothing attached never hears about the markers');
  assert.ok(!plain.includes('END FILE'));
  assert.match(withFile, /--- BEGIN FILE: <name> ---/, 'and a chat with a file hears exactly how they look');
  assert.match(withFile, /do not write them yourself/, 'plus the half that stops the model echoing them');

  // The rule has to describe the marker the UI really writes, which the old
  // unconditional sentence did not: it named a filename-less format the app
  // never produced.
  const ui = fs.readFileSync('waffle-ai.js', 'utf8');
  assert.ok(ui.includes('--- BEGIN FILE: ${f.name} ---'), 'the UI writes BEGIN FILE: <name>');
  assert.ok(ui.includes('--- END FILE: ${f.name} ---'), 'and END FILE: <name>');
  assert.ok(!/BEGIN FILE ---/.test(ui.replace(/waffle-persona[\s\S]*$/, '')), 'so nothing emits the filename-less form');
});

test('vision turns on the vision rule and changes nothing else', () => {
  const vision = buildWaffleSystemPrompt({ vision: true });
  assert.match(vision, /^You are Sir Waffle/, 'still introduces itself');
  assert.match(vision, /strictly based on what is actually visible/, 'and is told not to invent what is not shown');
  assert.ok(!vision.includes('BEGIN FILE'));
  assert.equal(
    buildWaffleSystemPrompt({ vision: true, hasFile: true }).includes('BEGIN FILE'), true,
    'both can be true at once: an image and a document in one message'
  );
});

test('the persona is recognisable, so the server does not repeat a rule it already carries', () => {
  for (const opts of [{}, { vision: true }, { hasFile: true }, { vision: true, hasFile: true }]) {
    assert.equal(isWafflePersona(buildWaffleSystemPrompt(opts)), true, JSON.stringify(opts));
  }
  // A tool's own prompt is not ours, and still needs the language rule appended.
  assert.equal(isWafflePersona('You are a strict translator. Output ONLY the exact translated text.'), false);
  assert.equal(isWafflePersona('You are an expert, concise code debugger inside CodeHub.'), false);
  assert.equal(isWafflePersona(undefined), false);
  assert.equal(isWafflePersona(''), false);

  const serverSrc = fs.readFileSync('waffle-ai-server.js', 'utf8');
  assert.match(serverSrc, /isWafflePersona\(baseSys\)/,
    'the guard is decided by the opening line, not by comparing whole strings');
  assert.ok(!serverSrc.includes('baseSys === WAFFLE_SYSTEM_PROMPT'),
    'which would have appended "Respond in English" to a persona that already says it');
});

test('the server persona is the same text the browser builds, minus the file rule', async () => {
  const { WAFFLE_SYSTEM_PROMPT } = await import('../waffle-ai-server.js');
  assert.equal(WAFFLE_SYSTEM_PROMPT, buildWaffleSystemPrompt(), 'one builder, two kitchens');
  assert.equal(isWafflePersona(WAFFLE_SYSTEM_PROMPT), true);
  assert.ok(!WAFFLE_SYSTEM_PROMPT.includes('BEGIN FILE'),
    'it is fixed when the session is created, so it cannot know whether the next message has a file');
});

/* ------------------------------------------------------------------ *
 * Every path cleans, and only one place defines how
 * ------------------------------------------------------------------ */

test('all three engines clean through the one helper', () => {
  const browser = fs.readFileSync('waffle-browser-ai.js', 'utf8');
  const ui = fs.readFileSync('waffle-ai.js', 'utf8');
  const server = fs.readFileSync('waffle-ai-server.js', 'utf8');

  for (const [name, src] of [['waffle-browser-ai.js', browser], ['waffle-ai.js', ui], ['waffle-ai-server.js', server]]) {
    assert.match(src, /from '\.\/waffle-persona\.js';/, `${name} imports the shared module`);
    assert.ok(!/<\\\/think>/.test(src), `${name} no longer carries its own copy of the reasoning-block regex`);
  }

  // ONNX (streaming + three returns), WLlama (streaming + return): seven.
  assert.ok(browser.split('stripModelScaffolding(').length - 1 >= 7,
    'both in-browser engines clean what they stream and what they return');
  assert.match(ui, /onToken\?\.\(payload\.text, stripModelScaffolding\(finalText, \{ streaming: true \}\)\);/,
    'the server path cleans tokens as they arrive, which it never used to');
  assert.match(server, /stripModelScaffolding\(reply \|\| fullText \|\| ''\)/, 'and the server cleans its final text');

  assert.match(browser, /import \{ stripModelScaffolding \} from '\.\/waffle-persona\.js';/);
  assert.equal(fs.readFileSync('waffle-persona.js', 'utf8').split('export function').length - 1, 3,
    'the module exports the builder, the recogniser and the cleaner');
});

test('the chat persona is built, not inlined, and the narrow tools get no biography', () => {
  const ui = fs.readFileSync('waffle-ai.js', 'utf8');
  assert.match(ui, /buildWaffleSystemPrompt\(\{ hasFile: Boolean\(fileContext\) \}\)/,
    'the turn knows whether it carries a file');
  assert.match(ui, /buildWaffleSystemPrompt\(\{ vision: true, hasFile: Boolean\(fileContext\) \}\)/,
    'and so does a turn that carries an image as well');
  assert.ok(!ui.includes('You are a helpful, accurate assistant. Answer clearly in Markdown.'),
    'the old inline persona is gone');

  // A tool that says "Output ONLY the exact translated text" must not also be
  // given a biography: the identity is for conversations. Both files mention Sir
  // Waffle elsewhere and legitimately — a "thinking…" label, and YAML/XML/ERB
  // sample snippets in CodeHub's language list — so this checks the prompts
  // themselves rather than the whole file.
  const promptCounts = { 'tools-english.js': 15, 'tools-code.js': 1 };
  for (const [f, expected] of Object.entries(promptCounts)) {
    const src = fs.readFileSync(f, 'utf8');
    assert.ok(!src.includes('waffle-persona'), `${f} keeps its own task prompt`);
    const prompts = src.split('\n').filter(l => /systemPrompt\s*:/.test(l));
    assert.equal(prompts.length, expected, `${f} still has the ${expected} task prompts this checks`);
    for (const line of prompts) {
      assert.ok(!line.includes('Sir Waffle'), `${f} does not introduce anyone to a task: ${line.trim().slice(0, 60)}`);
      assert.ok(!line.includes('BiteSizedUtilities'), `${f} does not describe the site to a task`);
    }
  }
});

test('the persona is built inside the turn that knows what it is carrying', () => {
  // `sendMessage` is only driven end to end by the Playwright suites, so the
  // thing a source pin has to catch here is a name that is not in scope: a
  // typo in `fileContext` would parse fine and then throw a ReferenceError the
  // first time anybody sent a message.
  const ui = fs.readFileSync('waffle-ai.js', 'utf8');
  const send = ui.slice(ui.indexOf('async function sendMessage(rawText) {'));
  assert.ok(send.length > 1000, 'that is the whole function, not a fragment');

  const declares = send.indexOf('const fileContext = nonImageFiles.map(');
  const builds = send.indexOf('buildWaffleSystemPrompt({ hasFile: Boolean(fileContext) })');
  const uses = send.indexOf('systemPrompt: effectiveSystemPrompt');
  assert.ok(declares > -1, 'the turn computes what was attached');
  assert.ok(builds > declares, 'the persona is built after that, so the name is in scope');
  assert.ok(uses > builds, 'and the engine is handed the result');

  // The image branch has to carry the same information: a message can hold a
  // photo and a document at once.
  const vision = send.indexOf('buildWaffleSystemPrompt({ vision: true, hasFile: Boolean(fileContext) })');
  assert.ok(vision > declares && vision < uses, 'the vision turn does too');
});

test('the fence cleaning cannot be reached by a prompt injection that renames the markers', () => {
  // Only the four markers this kitchen writes are removed. A model that invents
  // its own scaffolding is a different bug and should stay visible rather than
  // be silently swallowed.
  const invented = '--- BEGIN RESPONSE ---\nhello\n--- END RESPONSE ---';
  assert.equal(stripModelScaffolding(invented), invented);
});
