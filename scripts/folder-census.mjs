/**
 * Counting what the offline folder can run.
 *
 * The rule is a browser's, not ours: a page that is not served has an opaque origin,
 * so it cannot fetch a file beside it, cannot start a worker, and cannot load an ES
 * module. A game or a tool that reaches for none of those does its work in the page
 * and opens on tap; one that reaches for any of them needs the folder served.
 *
 * This module holds the patterns and the counting, and nothing else. It is build and
 * test tooling, and it is deliberately NOT importable from the app: the patterns below
 * are written as regular expressions containing the very strings they look for, so a
 * census that scanned its own source would find a `fetch` and a worker in it and block
 * whatever cupboard pulled it in. That is not a hypothetical — `offline-facts.js` is
 * imported by `build-mode.js`, and while these patterns lived there the text and art
 * cupboards were counted as needing a server because of it.
 *
 * `offline-facts.js` keeps the numbers the folder build itself quotes, and the packer
 * refuses to build if they disagree with a census of the same source.
 */

/**
 * Why a single game cannot run from a folder.
 *
 * One entry per refusal a browser makes, each with the thing in a game's own source
 * that trips it. A game with none of these is a whole game in one page and opens on
 * tap; a game with any of them needs the folder served.
 */
export const GAME_BLOCKERS = [
  { id: 'fetch', label: 'it fetches files as it loads', find: /\bfetch\s*\(/ },
  { id: 'xhr', label: 'it reads files through XMLHttpRequest', find: /XMLHttpRequest/ },
  { id: 'wasm', label: 'it loads WASM', find: /\.wasm/ },
  { id: 'module', label: 'it loads an ES module', find: /<script[^>]*type\s*=\s*["']module/ },
  { id: 'worker', label: 'it starts a worker', find: /new Worker\s*\(/ }
];

/**
 * Why a single utility cannot run from a folder.
 *
 * The same three refusals, plus the two ways a tool reaches for something that is not
 * in the page at all: Waffle AI and an API.
 */
export const TOOL_BLOCKERS = [
  { id: 'ai', label: 'it asks Waffle AI to do the work', find: /from '\.\/waffle-(?:ai|browser-ai|image-gen)\.js'|\b(?:isWaffleAiLocked|openWaffleAI|streamWaffleChat|generateWaffleImage|waffleAiLockedNoticeHTML)\s*\(/ },
  { id: 'worker', label: 'it runs your code in a worker', find: /\bnew Worker\s*\(|\bworkerJob\s*\(/ },
  { id: 'fetch', label: 'it calls an API', find: /\bfetch\s*\(/ },
  { id: 'xhr', label: 'it reads files through XMLHttpRequest', find: /XMLHttpRequest/ },
  { id: 'wasm', label: 'it loads WASM', find: /\.wasm\b/ }
];

/**
 * The AI stack itself. Importing one of these is the blocker, so their contents are
 * never scanned: `waffle-browser-ai.js` is full of fetches and workers that belong to
 * it, not to the cupboard that imports it.
 */
const AI_MODULES = ['waffle-ai.js', 'waffle-browser-ai.js', 'waffle-image-gen.js'];

/** A comment line. What is written in one is not what the browser runs. */
const COMMENT = /^\s*(?:\/\/|\*|\/\*)/;

/**
 * Lines that dispatch on a tool id, restricted to the ids the cupboard actually has.
 *
 * Two shapes, because the cupboards are not written the same way. `tools-code.js` is
 * one `if (id === 'x') { … } else if (…)` chain; `tools-english.js` opens with four of
 * those and then dispatches the other eleven through a `const configs = { 'id': () => …
 * }` table. Both are counted, and both are matched against the cupboard's own ids so
 * that an unrelated string — `l.id === 'web'` inside CodeHub's language picker — is
 * not mistaken for a tool.
 *
 * A table entry only counts when it builds something: `'tone-rewriter': () => {` is a
 * tool, and `'waffle-translate': 400` is a row of the max-tokens table at the top of
 * the same file. Reading that table as the dispatch put the start of the cupboard 480
 * lines too early, which is where the shared runner is built.
 */
function dispatchSites(lines, ids) {
  const wanted = new Set(ids);
  const quoted = line => [...line.matchAll(/'([a-z0-9-]+)'/g)].map(m => m[1]).filter(id => wanted.has(id));
  const sites = [];
  lines.forEach((line, i) => {
    if (COMMENT.test(line)) return;
    const named = quoted(line);
    if (!named.length) return;
    const brace = line.indexOf('{');
    const head = brace < 0 ? line : line.slice(0, brace);
    const isIf = /^\s*(?:\}\s*)?(?:else\s+)?if\s*\(/.test(head)
      && /(?<![.\w])id\s*===|\[\s*[^\]]*\]\s*\.includes\(\s*id\s*\)/.test(head);
    const isKey = /^\s*'[a-z0-9-]+'\s*:\s*(?:async\s*)?(?:\(\s*\)\s*=>|function\b)/.test(line);
    if (isIf || isKey) sites.push({ line: i + 1, ids: named });
  });
  return sites;
}

/** Which module mounts which cupboard, read out of app.js rather than written down. */
export function toolModuleMap(appSource, cupboardIds) {
  const imports = {};
  for (const [, names, mod] of appSource.matchAll(/import \{([^}]+)\} from '\.\/([a-z0-9.-]+\.js)';/g)) {
    for (const raw of names.split(',')) {
      const name = raw.trim().split(/\s+as\s+/).pop();
      if (/^mount/.test(name)) imports[name] = mod;
    }
  }
  const at = appSource.indexOf('const result =');
  if (at < 0) throw new Error('app.js has no mount dispatch to read');
  const dispatch = appSource.slice(at, appSource.indexOf(';', at) + 1);
  const calls = [...dispatch.matchAll(/\b(mount\w+)\s*\(/g)].map(m => ({ name: m[1], at: m.index }));
  if (!calls.length) throw new Error('the mount dispatch in app.js names no mount function');
  const out = {};
  for (const id of cupboardIds) {
    // The dispatch is one nested ternary keyed on `t.cupboard`, and two cupboards are
    // never named in it at all — text and art are what is left over, so they take the
    // last branch.
    const named = dispatch.indexOf(`'${id}'`);
    const call = named < 0 ? calls[calls.length - 1] : (calls.find(c => c.at > named) || calls[calls.length - 1]);
    const mod = imports[call.name];
    if (!mod) throw new Error(`app.js mounts ${id} with ${call.name}(), which it does not import`);
    out[id] = mod;
  }
  return out;
}

/**
 * Everything a cupboard's entry module pulls in, so a helper's `fetch` is not missed.
 * Stops at the AI modules, which are the blocker rather than a source of more blockers.
 *
 * @param {string} entry
 * @param {(name: string) => string | null} read
 */
export function moduleSet(entry, read) {
  const seen = [];
  const walk = name => {
    if (seen.includes(name) || AI_MODULES.includes(name)) return;
    seen.push(name);
    const src = read(name);
    if (src === null) return;
    for (const [, mod] of src.matchAll(/from '\.\/([a-z0-9.-]+\.js)'/g)) walk(mod);
  };
  walk(entry);
  return seen;
}

/** Which of the refusals one game trips, given its own source. Empty means it plays. */
export function classifyGameSource(source) {
  return GAME_BLOCKERS.filter(b => b.find.test(source)).map(b => b.id);
}

/**
 * Count a classified cabinet.
 *
 * @param {{ id: string, blockers: string[] }[]} games
 */
export function measureGames(games) {
  const playable = games.filter(g => !g.blockers.length);
  const blocked = games.filter(g => g.blockers.length);
  const reasons = {};
  for (const b of blocked) reasons[b.id] = b.blockers.join('+');
  return {
    total: games.length,
    playable: playable.length,
    blocked: blocked.length,
    playableIds: playable.map(g => g.id),
    blockedIds: blocked.map(g => g.id),
    reasons
  };
}

/**
 * Count what a folder can run, cupboard by cupboard and tool by tool.
 *
 * A cupboard whose modules are clean is counted whole. A cupboard with a blocker in it
 * is resolved per tool, because "this module fetches" says nothing about which of its
 * fifteen tools do: ten of the coding tools work off the disk and five do not, and the
 * difference is which branch of the mount chain reaches `workerJob`.
 *
 * A branch is blocked when its own slice contains a blocker, when it calls a function
 * whose body does, or when it is handed a value built by one.
 *
 * The last case has a whole-cupboard form. English & Languages builds its runner once,
 * above the dispatch, and mounts all fifteen tools with it — `const run =
 * createRunner(form)` — so no branch of its own says anything about an AI, and a
 * per-branch scan would call eleven of them safe. A shared engine built before the
 * tools are chosen, in a module that has a blocker in it, blocks every tool the module
 * dispatches. That is the honest reading: the runner is what the tool does its work
 * with.
 *
 * @param {{ cupboards: { id: string, name: string, tools: (string[] | { id: string, title?: string })[] }[],
 *           sources: Record<string, string>,
 *           modulesByCupboard: Record<string, string[]> }} input
 */
export function classifyTools({ cupboards, sources, modulesByCupboard }) {
  const out = {
    total: 0, offline: 0, blocked: 0,
    blockedIds: [], unresolved: [], secureIds: [],
    cleanCupboards: [], byCupboard: {}
  };

  for (const c of cupboards) {
    const mods = modulesByCupboard[c.id] || [];
    const tools = c.tools.map(t => (Array.isArray(t) ? { id: t[0], title: t[1] } : { id: t.id, title: t.title || t.id }));
    const title = id => (tools.find(t => t.id === id) || {}).title || id;
    const primary = mods[0];
    const lines = (sources[primary] || '').split('\n');
    const sites = dispatchSites(lines, tools.map(t => t.id));
    const sliceOf = (site, i) => {
      const to = i + 1 < sites.length ? sites[i + 1].line : lines.length + 1;
      return { to, text: lines.slice(site.line - 1, to - 1).join('\n') };
    };

    // Which tools ask for a digest. Not a blocker: `file:` is a secure context in
    // Chrome, Firefox and Safari, so these work from a folder on the disk. Counted
    // because they would not work from an opaque `content:` address, and because a
    // cupboard gaining one is worth noticing.
    sites.forEach((site, i) => {
      if (!/\bcrypto\.(?:subtle|randomUUID)\b/.test(sliceOf(site, i).text)) return;
      for (const id of site.ids) if (!out.secureIds.includes(id)) out.secureIds.push(id);
    });

    const hits = [];
    for (const m of mods) {
      (sources[m] || '').split('\n').forEach((text, i) => {
        if (COMMENT.test(text)) return;
        for (const b of TOOL_BLOCKERS) if (b.find.test(text)) hits.push({ mod: m, line: i + 1, kind: b.id });
      });
    }
    out.total += tools.length;
    const kindsOf = list => [...new Set(list)];

    if (!hits.length) {
      out.offline += tools.length;
      out.cleanCupboards.push(c.name);
      out.byCupboard[c.id] = { name: c.name, total: tools.length, offline: tools.length, blockedIds: [], kinds: [], whole: true, sharedEngine: [] };
      continue;
    }

    const here = hits.filter(h => h.mod === primary);

    // Top-level functions, and the kinds each one carries. Nested helpers are not
    // tracked separately: they sit inside the branch that calls them, which is
    // blocked on its own account.
    const fns = [];
    lines.forEach((t, i) => {
      const m = t.match(/^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/);
      if (m) fns.push({ name: m[1], from: i + 1, to: lines.length + 1, kinds: [] });
    });
    fns.forEach((f, i) => { if (i + 1 < fns.length) f.to = fns[i + 1].from; });
    for (const h of here) {
      const f = fns.find(x => h.line >= x.from && h.line < x.to);
      if (f && !f.kinds.includes(h.kind)) f.kinds.push(h.kind);
    }

    // Names that carry a blocker: those functions, plus anything bound to one of them
    // before the dispatch starts and then handed to the tools.
    const carries = new Map(fns.filter(f => f.kinds.length).map(f => [f.name, f.kinds]));
    const first = sites.length ? sites[0].line : Infinity;
    const boundBefore = new Map();
    lines.slice(0, first - 1).forEach(t => {
      const m = t.match(/(?:const|let)\s+([A-Za-z0-9_$]+)\s*=\s*(?:await\s+)?([A-Za-z0-9_$]+)\s*\(/);
      if (!m || !carries.has(m[2])) return;
      carries.set(m[1], carries.get(m[2]));
      boundBefore.set(m[1], carries.get(m[2]));
    });
    const uses = name => new RegExp(`\\b${name}\\s*\\(|[(,]\\s*${name}\\b`);
    const after = lines.slice(first - 1).join('\n');
    // A shared engine, not a shared helper: only a value built before the tools are
    // chosen counts. `workerJob` is a function the coding cupboard calls from inside
    // five of its branches, and treating it as an engine blocked all fifteen.
    const shared = [...boundBefore.keys()].filter(name => sites.length && uses(name).test(after));

    const blockedIds = [];
    const push = (id, kinds) => {
      if (blockedIds.includes(id)) return;
      blockedIds.push(id);
      out.blockedIds.push({ cupboard: c.name, id, title: title(id), kinds: kindsOf(kinds) });
    };

    if (shared.length) {
      const kinds = kindsOf(shared.flatMap(name => boundBefore.get(name)));
      for (const t of tools) push(t.id, kinds);
    } else {
      const seen = new Set();
      sites.forEach((site, i) => {
        const { to, text } = sliceOf(site, i);
        site.ids.forEach(id => seen.add(id));
        const kinds = here.filter(h => h.line >= site.line && h.line < to).map(h => h.kind);
        for (const [name, nk] of carries) if (uses(name).test(text)) kinds.push(...nk);
        if (kinds.length) for (const id of site.ids) push(id, kinds);
      });
      // A tool in a cupboard that has a blocker, appearing nowhere in the cupboard's
      // own dispatch, cannot be called safe — so it is counted blocked and reported
      // for somebody to look at. The packer refuses to build with any of these.
      for (const t of tools) {
        if (seen.has(t.id) || blockedIds.includes(t.id)) continue;
        out.unresolved.push({ cupboard: c.name, id: t.id, title: t.title });
        push(t.id, here.map(h => h.kind));
      }
    }

    out.blocked += blockedIds.length;
    out.offline += tools.length - blockedIds.length;
    out.byCupboard[c.id] = {
      name: c.name, total: tools.length, offline: tools.length - blockedIds.length,
      blockedIds: [...blockedIds], kinds: kindsOf(here.map(h => h.kind)),
      whole: false, sharedEngine: shared
    };
  }

  return out;
}
