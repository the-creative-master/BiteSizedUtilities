/**
 * Who Sir Waffle is, and what gets wiped off a model's answer before you see it.
 *
 * DOM-free and Node-free on purpose. `waffle-ai.js` (the chat UI),
 * `waffle-browser-ai.js` (the in-browser engines) and `waffle-ai-server.js` (the
 * optional llama.cpp server) all import this one file, so the two kitchens
 * cannot drift apart on who they are, or on what a clean answer looks like.
 */

/**
 * The identity: who it is, and what the site is. Two sentences, and no more.
 *
 * A 135M model reads a system prompt as a sample of house style and imitates
 * it, so this is deliberately a fact and not a flavour. Two sentences is enough
 * for it to know its name and what the kitchen does; a paragraph of waffle
 * imagery is how every answer ends up being about breakfast. It goes first in
 * the prompt so that if the device budget truncates anything, what is lost is a
 * house rule and not the name.
 */
export const WAFFLE_IDENTITY =
  'You are Sir Waffle, the AI in BiteSizedUtilities — a free set of small utilities that runs in the browser: writing and language tools, maths, art, code and games.';

/**
 * The other half of the same idea: the identity is allowed to exist, and is not
 * allowed to leak. Without this a small model answers "what is 2+2" with a
 * waffle metaphor, because the prompt mentioned waffles and it is trying to be
 * agreeable.
 */
export const WAFFLE_IDENTITY_GUARD =
  'Answer the question that was asked. Mention the site or yourself only when the question is about them, and never work waffles, syrup or the kitchen into an unrelated answer.';

/** Standing rules about the answer itself. Order is the order they matter in. */
export const WAFFLE_HOUSE_RULES = [
  'Always respond in English unless the user explicitly asks you to write in another language.',
  'Keep answers clear, truthful, factual, and well-formatted in Markdown.',
  'When writing code, always use standard fenced code blocks with the language name (like ```python).',
  'Only when the user asks you to make, create, or generate a downloadable file (such as .docx, .md, .txt, .csv, .json, .html, .py, .js), wrap the full file contents inside a fenced block whose tag is file:filename.ext (for example ```file:notes.docx or ```file:hello.py).'
];

/**
 * The attached-file rule — sent only with a message that actually carries a file.
 *
 * This used to be part of the standing persona, unconditionally, and that is why
 * Falcon 3 1B answered every message, including "hello", wrapped in
 * `--- BEGIN FILE ---` and `--- END FILE ---`. Nothing was wrong with its
 * weights: the prompt showed it a marker format on every single turn, and a 1B
 * model treats what it is shown as the shape an answer takes. It was also
 * describing the wrong markers — the UI emits `--- BEGIN FILE: <name> ---`, with
 * the filename, which is what this text now says.
 *
 * It is worth the tokens when a file is really there, because without it small
 * models claim they cannot see attachments. It is not worth them when there is
 * no file, and it is actively harmful then.
 */
export const WAFFLE_ATTACHED_FILE_RULE =
  'This message includes a file between --- BEGIN FILE: <name> --- and --- END FILE: <name> --- markers. Read and use that text directly, and never say you cannot see, read or access attached files. Those markers belong to the incoming file, not to your reply: do not write them yourself.';

/** The vision variant, which replaces nothing and is simply added. */
export const WAFFLE_VISION_RULE =
  'Describe and answer strictly based on what is actually visible in the attached image(s). Do not guess or invent objects that are not clearly shown.';

/**
 * Build the persona for one turn.
 *
 * @param {boolean} vision  the message carries image attachments
 * @param {boolean} hasFile the message carries an extracted non-image file
 */
export function buildWaffleSystemPrompt({ vision = false, hasFile = false } = {}) {
  return [
    WAFFLE_IDENTITY,
    vision ? WAFFLE_VISION_RULE : '',
    ...WAFFLE_HOUSE_RULES,
    hasFile ? WAFFLE_ATTACHED_FILE_RULE : '',
    WAFFLE_IDENTITY_GUARD
  ].filter(Boolean).join(' ');
}

/**
 * True when a prompt is one of ours, rather than a task prompt from a tool.
 *
 * The server uses this to decide whether to repeat the language rule: a persona
 * built here already carries it, a tool's prompt ("You are a strict translator…")
 * does not, and the visitor's language choice still has to win.
 */
export function isWafflePersona(text) {
  return String(text ?? '').trimStart().startsWith(WAFFLE_IDENTITY.slice(0, 32));
}

/* ------------------------------------------------------------------ *
 * Output cleaning
 * ------------------------------------------------------------------ */

/**
 * The scaffolding lines the kitchen itself puts into a prompt, which a model
 * sometimes hands straight back. Both are matched with or without a filename,
 * with two or more dashes, and with any amount of stray spacing.
 */
const FENCE_OPENERS = [
  '--- BEGIN FILE',
  '--- END FILE',
  '--- WEB SEARCH RESULTS',
  '--- END WEB SEARCH RESULTS'
];

/**
 * One complete scaffolding line, newline included, so removing it does not leave
 * a blank line behind in the middle of an answer.
 */
const COMPLETE_FENCE =
  /^[ \t]*-{2,}[ \t]*(?:BEGIN[ \t]+FILE|END[ \t]+FILE|BEGIN[ \t]+WEB[ \t]+SEARCH[ \t]+RESULTS|END[ \t]+WEB[ \t]+SEARCH[ \t]+RESULTS|WEB[ \t]+SEARCH[ \t]+RESULTS)(?:[ \t]*:[^\n\r]*?)?[ \t]*-{0,3}[ \t]*$\r?\n?/gim;

const CLOSED_THINK = /<think>[\s\S]*?<\/think>\s*/g;
const OPEN_THINK = /<think>[\s\S]*$/;

/**
 * Take the model's scaffolding off its answer: reasoning blocks it was not asked
 * to show, and file/search fences it picked up from the prompt.
 *
 * @param {string} text        everything generated so far
 * @param {boolean} streaming  mid-reply. Holds back a tail that is still being
 *   written — an unclosed <think>, or half a fence such as `--- BE` — so it never
 *   flashes at the reader. Both come back on the next token if they turn out to
 *   be ordinary text.
 * @param {boolean} dropUnclosedThink  also remove a <think> that was never
 *   closed, which is what a model that ran out of tokens mid-reasoning leaves
 *   behind. Defaults to whatever `streaming` is; the paths that commit a final
 *   message pass it explicitly, because two of them have always dropped it and
 *   two have always kept it, and this is not the release to change either.
 */
export function stripModelScaffolding(text, { streaming = false, dropUnclosedThink = streaming } = {}) {
  let out = String(text ?? '');
  out = out.replace(CLOSED_THINK, '');
  if (dropUnclosedThink) out = out.replace(OPEN_THINK, '');
  out = out.replace(COMPLETE_FENCE, '');
  if (streaming) out = holdBackPartialFence(out);
  return out;
}

/** Drop the last line while it could still be growing into a fence. */
function holdBackPartialFence(text) {
  const cut = text.lastIndexOf('\n');
  const tail = cut === -1 ? text : text.slice(cut + 1);
  if (!couldBecomeFence(tail)) return text;
  return cut === -1 ? '' : text.slice(0, cut + 1);
}

/**
 * True for a line that is the beginning of a fence, or is a fence missing only
 * its closing dashes. A lone `-` counts, so a bullet dash can be held back for
 * one token; that is the cheap side of never showing `--- BEGIN FI`.
 */
function couldBecomeFence(line) {
  const t = line.trim().toUpperCase().replace(/\s+/g, ' ');
  if (!t.startsWith('-')) return false;
  return FENCE_OPENERS.some(o => o.startsWith(t) || t.startsWith(o));
}
