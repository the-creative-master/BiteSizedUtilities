/** Cozy 2.5D Developer Utilities — zero default HTML select/checkbox/range/color inputs */
import { gEl, gameBtn, gameTabs, gameToggle, gameSlider, gameColorPicker, gameField, statBox, copyToClipboard } from './ui-kit.js';
import { playPop, playSparkle } from './sfx.js';
import { streamWaffleChat, formatWaffleMarkdown, isWaffleAiLocked, waffleAiLockedNoticeHTML, waffleModelPendingNoticeHTML } from './waffle-ai.js';
import { detectDeviceDiagnostics, aiSpeedProfile, clipToCharBudget } from './waffle-browser-ai.js';
import { getAppLanguage } from './i18n.js';

/**
 * The one model this helper is allowed to use, and the only thing that model is
 * allowed to be used for.
 *
 * Code diagnostics used to run on Qwen 2.5 Coder 1.5B, the largest model in the
 * kitchen, which on a CPU-only tablet meant a ~700 MB download and a wait long
 * enough to look broken. Granite Code 0.5B is what it runs on from 1.2.1: small
 * enough to load on the devices that actually hit a syntax error, and trained for
 * this rather than borrowed for it.
 *
 * The weights are not here yet — the entry in TEXT_MODELS carries `arrivesIn`
 * instead of a repo — so the helper says that plainly and stops. It does not
 * substitute another model, because "only Granite" is the whole point of pinning
 * it: an answer from a different model looks exactly like an answer from this
 * one, and the testing that decided the pin would mean nothing.
 */
const CODE_DIAGNOSTIC_MODEL_ID = 'granite-code-0.5b';

const runtimeBase = () => new URL('runtimes/', document.baseURI);
const mounted = new WeakMap();
const MAX = 1000000;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const catalogue = [
  ['web', 'HTML / CSS / JS', 'executable', 'Local opaque-origin three-pane sandbox', ''],
  ['javascript', 'JavaScript', 'executable', 'Browser worker (ES2022)', 'console.log("Hello, JavaScript!");\nconsole.log([1,2,3].map(n => n*n));'],
  ['nodejs', 'Node.js', 'executable', 'Browser worker with Node process shim', 'console.log("Node", process.version, process.platform);\nprocess.stdout.write("Hello from Node-style stdout!\\n");'],
  ['typescript', 'TypeScript', 'executable', 'TypeScript 5.9 → worker', 'const greeting: string = "Hello, TypeScript!";\nconsole.log(greeting);'],
  ['coffeescript', 'CoffeeScript', 'executable', 'CoffeeScript 2.7 → worker', 'square = (x) -> x * x\nconsole.log square(12)'],
  ['luau', 'Luau (Roblox)', 'executable', 'Official Roblox Luau WASM runtime', 'local function factorial(n: number): number\n  if n <= 1 then return 1 end\n  return n * factorial(n - 1)\nend\nprint("Hello Luau! 6! =", factorial(6))'],
  ['haskell', 'Haskell', 'executable', 'JSHC Haskell-to-JS compiler & runtime', 'module Main where\nmain :: IO ()\nmain = putStrLn ("Hello Haskell! sum [1..10] = " ++ show (sum [1..10]))'],
  ['ruby', 'Ruby', 'executable', 'Opal 3.0 Ruby compiler & runtime', 'squares = (1..6).map { |n| n * n }\nputs "Hello Ruby! #{squares.inspect}"'],
  ['php', 'PHP 8.3', 'executable', 'PHP 8.3 WebAssembly runtime', '<?php\n$nums = [1, 2, 3, 4, 5];\necho "Hello PHP! Sum = " . array_sum($nums) . "\\n";'],
  ['sql', 'SQLite SQL', 'executable', 'sql.js SQLite WASM', "CREATE TABLE greetings (name TEXT, score INT);\nINSERT INTO greetings VALUES ('Ada', 100), ('Grace', 98);\nSELECT * FROM greetings ORDER BY score DESC;"],
  ['python', 'Python', 'executable', 'Pyodide CPython WASM', 'import sys\nprint(sys.version.split()[0])\nprint("Sum:", sum(range(1, 11)))'],
  ['c', 'C', 'executable', 'JSCPP C/C++ interpreter', '#include <stdio.h>\nint main() {\n  printf("Hello C! 6 * 7 = %d\\n", 6 * 7);\n  return 0;\n}'],
  ['cpp', 'C++', 'executable', 'JSCPP C++ interpreter', '#include <iostream>\nusing namespace std;\nint main() {\n  cout << "Hello C++! 6 * 7 = " << (6 * 7) << endl;\n  return 0;\n}'],
  ['lua', 'Lua', 'executable', 'Fengari Lua 5.3 worker', 'print("Hello, Lua!")\nfor i = 1, 5 do print(i, i * i) end'],
  ['clojure', 'Clojure', 'executable', 'Scittle Clojure SCI runtime', '(println "Hello Clojure!" (vec (map #(* % %) (range 1 7))))'],
  ['clojurescript', 'ClojureScript', 'executable', 'Scittle ClojureScript SCI runtime', '(let [nums (range 1 11)] (println "Sum:" (reduce + nums)))'],
  ['prolog', 'Prolog', 'executable', 'Tau Prolog ISO logic engine', 'likes(mary, pizza).\nlikes(john, X) :- likes(X, pizza).\n?- likes(john, Who).'],
  ['wasm', 'WebAssembly (WAT)', 'executable', 'WABT wat2wasm + live WebAssembly runner', '(module\n  (func (export "add") (param i32 i32) (result i32)\n    local.get 0\n    local.get 1\n    i32.add))\n;; Try stdin: 20 22'],
  ['jq', 'jq', 'executable', 'jq-web WASM JSON processor', '.items | map(. * 10)\n;; Try stdin: {"items":[1,2,3,4]}'],
  ['tcl', 'Tcl', 'executable', 'Tcl-JS local interpreter', 'proc square {x} { return [expr {$x * $x}] }\nputs "Hello Tcl! 9^2 = [square 9]"'],
  ['bash', 'Bash', 'subset', 'BashKit 0.21.0 WASM VFS', 'echo "Hello from Bash"; printf "Answer: %s\\n" "$((6*7))"'],
  ['sh', 'POSIX Shell', 'subset', 'BashKit 0.21.0 WASM VFS', 'for n in 1 2 3; do echo "Step $n"; done'],
  ['sass', 'Sass / SCSS', 'executable', 'Dart Sass → CSS compiler', '$berry: #e78167;\n.card { background: $berry; .title { font-weight: 800; } }'],
  ['yaml', 'YAML', 'executable', 'js-yaml → JSON parser', 'kitchen:\n  mascot: Sir Waffle\n  tools: 70'],
  ['toml', 'TOML', 'executable', 'smol-toml → JSON parser', 'title = "BiteSizedUtilities"\n[kitchen]\ntools = 70'],
  ['markdown', 'Markdown', 'executable', 'marked → HTML compiler', '# Cozy Kitchen\n- **Fast** offline tools\n- `100%` local'],
  ['xml', 'XML', 'executable', 'fast-xml-parser validator & JSON', '<kitchen tools="70"><mascot>Sir Waffle</mascot></kitchen>'],
  ['handlebars', 'Handlebars', 'executable', 'Handlebars template renderer (stdin JSON)', 'Hello {{name}}! You have {{count}} toys.'],
  ['ejs', 'EJS', 'executable', 'EJS template renderer (stdin JSON)', 'Sum: <%= (locals.a || 20) + (locals.b || 22) %>'],
  ['erb', 'ERB (Ruby)', 'executable', 'Opal::ERB template renderer (stdin JSON)', 'Hello <%= data["name"] || "Sir Waffle" %>!'],
  ['css', 'CSS', 'executable', 'csstree CSS validator & formatter', '.waffle { color: #4f2f23; border-radius: 16px; }'],
  ['json', 'JSON', 'executable', 'Strict local parser', '{"hello":"world","items":[1,2,3]}'],
  ['brainfuck', 'Brainfuck', 'executable', '65,536-cell tape VM', '++++++++[>++++++++<-]>+.'],
  ['boolfuck', 'Boolfuck', 'executable', 'Bit-tape VM', '+;+;+;+;+;+;+;+;'],
  ['ook', 'Ook!', 'executable', 'Ook → Brainfuck VM', 'Ook. Ook. Ook! Ook.'],
  ['whitespace', 'Whitespace', 'executable', 'Stack/heap VM', '   \t\n\t\n \t\n\n\n'],
  ['befunge', 'Befunge-93', 'executable', '80×25 2D grid VM', '"!dlrow ,olleH">:#,_@'],
  ['basic', 'BASIC', 'subset', 'Line-numbered BASIC', '10 FOR I = 1 TO 5\n20 PRINT I * I\n30 NEXT I\n40 END'],
  ['forth', 'Forth', 'subset', 'Stack VM', ': square dup * ;\n12 square . cr'],
  ['lisp', 'Lisp', 'subset', 'Lexical Lisp evaluator', '(define (square x) (* x x))\n(print (square 12))'],
  ['scheme', 'Scheme', 'subset', 'Shared Lisp evaluator', '(define (factorial n) (if (= n 0) 1 (* n (factorial (- n 1)))))\n(display (factorial 6))'],
  ['racket', 'Racket (subset)', 'subset', 'Shared Lisp evaluator', '(define (fib n) (if (< n 2) n (+ (fib (- n 1)) (fib (- n 2)))))\n(display (fib 8))'],
  ...[
    ['java', 'Java'], ['csharp', 'C#'], ['go', 'Go'], ['rust', 'Rust'], ['swift', 'Swift'], ['kotlin', 'Kotlin'],
    ['scala', 'Scala'], ['r', 'R'], ['julia', 'Julia'], ['perl', 'Perl'], ['ocaml', 'OCaml'], ['fsharp', 'F#'],
    ['elixir', 'Elixir'], ['erlang', 'Erlang'], ['dart', 'Dart'], ['groovy', 'Groovy'], ['powershell', 'PowerShell'],
    ['zsh', 'Zsh'], ['fish', 'Fish'], ['objectivec', 'Objective-C'], ['pascal', 'Pascal'], ['fortran', 'Fortran'],
    ['cobol', 'COBOL'], ['ada', 'Ada'], ['d', 'D'], ['nim', 'Nim'], ['zig', 'Zig'], ['v', 'V'],
    ['crystal', 'Crystal'], ['smalltalk', 'Smalltalk'], ['elm', 'Elm'], ['purescript', 'PureScript'],
    ['reason', 'Reason'], ['solidity', 'Solidity'], ['vyper', 'Vyper'], ['assembly', 'Assembly'],
    ['matlab', 'MATLAB'], ['vhdl', 'VHDL'], ['verilog', 'Verilog'], ['graphql', 'GraphQL'], ['html', 'HTML']
  ].map(([id, name]) => [id, name, 'editor-only', 'Editor / download only (no local compiler installed)', ''])
].map(([id, name, status, note, sample]) => ({ id, name, status, note, sample }));

const ids = new Set([
  'codehub', 'json-validator', 'regex-tester', 'uuid-generator', 'timestamp', 'base-converter',
  'html-entities', 'jwt-decoder', 'css-minifier', 'js-formatter', 'sql-formatter',
  'hash-playground', 'color-tokens', 'git-cheatsheet', 'http-status'
]);

function workerJob(scope, op, code, options = {}, input = '', timeout = 5000, onLog) {
  return new Promise((resolve, reject) => {
    let worker, timer, finished = false;
    const cleanup = () => { clearTimeout(timer); worker?.terminate(); scope.jobs.delete(cancel); };
    const end = (err, value) => { if (finished) return; finished = true; cleanup(); err ? reject(err) : resolve(value); };
    const cancel = () => end(Error('Execution stopped.'));
    scope.jobs.add(cancel);
    try {
      worker = new Worker(new URL(op === 'python' ? 'python-worker.js' : 'worker.js', runtimeBase()), op === 'python' ? { type: 'module' } : undefined);
      timer = setTimeout(() => end(Error(`Execution timed out after ${timeout / 1000}s.`)), timeout);
      worker.onmessage = ({ data: d }) => {
        if (d.type === 'log') onLog?.(d.text);
        else if (d.type === 'error') end(Error(d.text));
        else if (d.type === 'done') end(null, d.value);
      };
      worker.onerror = e => { e.preventDefault(); end(Error(e.message || 'Runtime could not load over file://; serve over HTTP.')); };
      worker.postMessage({ op, code, options, input });
    } catch (e) { end(e); }
  });
}

function ensure(s) { if (s.length > MAX) throw Error('Input exceeds 1 MB limit.'); return s; }
function assert(ok, msg) { if (!ok) throw Error(msg); }
function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function copy(text) {
  const ok = await copyToClipboard(text);
  if (!ok) throw Error('Copy failed — select and copy manually.');
}
function codeArea(value = '', rows = 7) {
  return gEl('textarea', { class: 'gfield-input code-area', rows, spellcheck: 'false', value });
}
function textIn(value = '', placeholder = '') {
  return gEl('input', { type: 'text', class: 'gfield-input', value: String(value), placeholder });
}

export function mountCode(id, root) {
  if (!ids.has(id) || !root?.replaceChildren) return false;
  mounted.get(root)?.();
  const controller = new AbortController(), { signal } = controller, scope = { jobs: new Set() }, cleanups = [];
  let disposed = false;
  const dispose = () => {
    if (disposed) return; disposed = true;
    controller.abort();
    for (const cancel of [...scope.jobs]) cancel();
    for (const clean of cleanups) clean();
    observer.disconnect();
    mounted.delete(root);
  };
  const observer = new MutationObserver(() => { if (!root.isConnected) dispose(); });
  observer.observe(root.ownerDocument.documentElement, { childList: true, subtree: true });
  mounted.set(root, dispose);
  root.replaceChildren();
  root.addEventListener('tool-dispose', dispose, { signal });

  const panel = gEl('section', { class: 'game-panel' });
  root.append(panel);

  const outConsole = () => gEl('pre', { class: 'output code-console-tray', role: 'status', 'aria-live': 'polite' });
  const runTo = (target, fn) => async () => {
    target.dataset.state = 'busy';
    target.textContent = 'Working…';
    try {
      const res = await fn();
      if (!disposed) {
        target.textContent = typeof res === 'string' ? res : JSON.stringify(res, null, 2);
        target.dataset.state = 'success';
        target.classList.remove('error');
        playSparkle();
      }
    } catch (e) {
      if (!disposed) {
        target.textContent = 'Error: ' + (e.message || e);
        target.dataset.state = 'error';
        target.classList.add('error');
      }
    }
  };
  const copyBtn = target => gameBtn('📋 Copy Output', 'chip', async () => {
    try { await copy(target.textContent); } catch (e) { target.textContent += '\n' + e.message; }
  });

  if (id === 'codehub') {
    const featuredIds = ['javascript', 'luau', 'haskell', 'ruby', 'php', 'sql', 'python', 'cpp', 'c', 'typescript', 'clojure', 'prolog', 'wasm', 'lua', 'bash', 'web'];
    let currentLang = 'javascript';
    let showAllRunnable = false;
    let aiErrorsOn = true;
    const drafts = new Map();

    const filterIn = textIn('', `Filter all ${catalogue.length} languages… e.g. luau, haskell, ruby, php, sql`);
    const langChips = gameTabs(
      featuredIds.map(lid => [lid, catalogue.find(x => x.id === lid).name]),
      currentLang,
      val => switchLang(val),
      'Quick Runtime Switcher'
    );
    const runnableToggle = gameToggle('Show All 42 Runnable Languages', false, val => {
      showAllRunnable = val;
      buildMoreChips(filterIn.value);
    });
    const aiErrorToggle = gameToggle('AI Error Diagnostics', true, val => {
      aiErrorsOn = val;
      if (!val) {
        aiAbort?.abort();
        aiBox.hidden = true;
      }
    });
    const moreTray = gEl('div', { class: 'gtabs code-lang-drawer', hidden: true });
    const statusBadge = gEl('div', { class: 'pastel-card peach' });

    const editor = codeArea(catalogue.find(x => x.id === 'javascript').sample, 9);
    const stdinIn = codeArea('', 2);
    const webGrid = gEl('div', { class: 'two-col', hidden: true });
    const htmlIn = codeArea('<h1>Hello, Kitchen Sandbox!</h1>\n<button id="hello">Tap Me</button>', 6);
    const cssIn = codeArea('body { font-family: system-ui; padding: 18px; background: #fff9ec; color: #4f2f23; }\nh1 { color: #c98550; }', 6);
    const jsIn = codeArea('document.querySelector("#hello").onclick = () => {\n  console.log("Button tapped!");\n  document.querySelector("h1").textContent = "It works!";\n};', 6);
    webGrid.append(gameField('HTML', htmlIn), gameField('CSS', cssIn), gameField('JavaScript', jsIn));

    const result = outConsole();
    const preview = gEl('div', { class: 'pastel-card cream', hidden: true });

    const aiBox = gEl('div', { class: 'pastel-card cream codehub-ai-box', hidden: true });
    const aiHead = gEl('div', { class: 'codehub-ai-head' },
      gEl('strong', {}, '✨ AI Error Helper'),
      gEl('span', { class: 'gbadge' }, 'CODER AI')
    );
    const aiBody = gEl('div', { class: 'codehub-ai-body' });
    let lastFixedCode = '';
    const applyFixBtn = gameBtn('⚡ Apply Fix to Editor', 'primary', () => {
      if (!lastFixedCode) return;
      playPop(640);
      if (currentLang === 'web') jsIn.value = lastFixedCode;
      else editor.value = lastFixedCode;
    });
    applyFixBtn.hidden = true;
    const aiActions = gEl('div', { class: 'gtabs codehub-ai-actions' }, applyFixBtn);
    aiBox.append(aiHead, aiBody, aiActions);

    let stage = null, stageTimer = null, runId = 0, aiAbort = null, lastErrorText = '';

    const clearFrame = () => { clearTimeout(stageTimer); stage?.remove(); stage = null; preview.replaceChildren(); preview.hidden = true; };
    cleanups.push(clearFrame);
    cleanups.push(() => aiAbort?.abort());
    const stop = () => {
      runId++;
      aiAbort?.abort();
      aiAbort = null;
      for (const c of [...scope.jobs]) c();
      clearFrame();
    };

    function extractFirstCodeBlock(md) {
      const m = String(md || '').match(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/);
      return m ? m[1].trimEnd() : '';
    }

    async function diagnoseWithCoderAI(errorMsg = '') {
      const l = catalogue.find(x => x.id === currentLang);
      const source = l.id === 'web'
        ? `HTML:\n${htmlIn.value}\n\nCSS:\n${cssIn.value}\n\nJS:\n${jsIn.value}`
        : editor.value;
      if (!source.trim()) return;

      // Waffle AI is paused, so diagnostics say so plainly instead of spinning
      // up a model that cannot answer.
      if (isWaffleAiLocked()) {
        aiAbort?.abort();
        aiAbort = null;
        lastFixedCode = '';
        applyFixBtn.hidden = true;
        aiBox.hidden = false;
        aiBody.innerHTML = waffleAiLockedNoticeHTML();
        return;
      }

      aiAbort?.abort();
      const ac = new AbortController();
      aiAbort = ac;
      signal.addEventListener('abort', () => ac.abort(), { once: true });

      lastFixedCode = '';
      applyFixBtn.hidden = true;
      aiBox.hidden = false;
      aiBody.innerHTML = '<span class="waffle-thinking">Analyzing code & error…</span><span class="waffle-cursor" aria-hidden="true">▌</span>';

      const appLang = getAppLanguage();
      const langHint = appLang && appLang !== 'English' ? `\n\n(Speak in ${appLang})` : '';
      // A tablet debugging a 3,200-character paste spends most of its time
      // reading it, and the runtime clips it afterwards anyway.
      const diag = await detectDeviceDiagnostics().catch(() => null);
      const profile = aiSpeedProfile(diag);
      const promptText = errorMsg
        ? `Language: ${l.name}\nError:\n${errorMsg.slice(0, 1200)}\n\nCode:\n\`\`\`${l.id}\n${clipToCharBudget(source, profile.promptChars)}\n\`\`\`\n\nExplain the root cause briefly in 2-3 sentences and provide the corrected ${l.id === 'web' ? 'JavaScript' : l.name} code in a single fenced code block.${langHint}`
        : `Language: ${l.name}\nReview this code for bugs or syntax issues. Explain concisely and provide an improved/fixed version in a single fenced code block.\n\`\`\`${l.id}\n${clipToCharBudget(source, profile.promptChars)}\n\`\`\`${langHint}`;

      try {
        const reply = await streamWaffleChat({
          modelId: CODE_DIAGNOSTIC_MODEL_ID,
          systemPrompt: 'You are an expert, concise code debugger inside CodeHub. Identify the exact bug and give a clean working fix in one fenced code block. Avoid fluff.',
          messages: [{ role: 'user', content: promptText }],
          temperature: 0.25,
          maxTokens: profile.maxTokens,
          signal: ac.signal,
          onToken(_, acc) {
            if (!disposed && aiAbort === ac) {
              aiBody.innerHTML = formatWaffleMarkdown(acc, true) + '<span class="waffle-cursor" aria-hidden="true">▌</span>';
            }
          }
        });
        if (!disposed && aiAbort === ac) {
          aiBody.innerHTML = formatWaffleMarkdown(reply, false);
          const fixed = extractFirstCodeBlock(reply);
          if (fixed) {
            lastFixedCode = fixed;
            applyFixBtn.hidden = false;
          }
          playSparkle();
        }
      } catch (err) {
        if (err.name === 'WaffleModelPending' && !disposed && aiAbort === ac) {
          // The pinned model has not arrived. Say so and offer nothing else:
          // "only Granite" is the entire point of the pin, and an answer from a
          // different model looks exactly like an answer from this one, which
          // would make the testing that chose it meaningless.
          aiBody.innerHTML = waffleModelPendingNoticeHTML({ label: err.label, arrivesIn: err.arrivesIn });
          applyFixBtn.hidden = true;
        } else if (err.name !== 'AbortError' && !disposed && aiAbort === ac) {
          aiBody.innerHTML = `<p class="waffle-md-p">AI diagnostics unavailable: ${esc(err.message || err)}</p>`;
        }
      } finally {
        if (aiAbort === ac) aiAbort = null;
      }
    }

    function buildMoreChips(q) {
      const ql = q.trim().toLowerCase();
      moreTray.hidden = !ql && !showAllRunnable;
      if (moreTray.hidden) return;
      const matches = (ql
        ? catalogue.filter(l => l.name.toLowerCase().includes(ql) || l.id.includes(ql))
        : catalogue.filter(l => l.status !== 'editor-only')
      ).slice(0, 48);
      moreTray.replaceChildren(...matches.map(l => {
        const tag = l.status === 'editor-only' ? 'editor' : 'run';
        return gameBtn(`${l.name} (${tag})`, l.id === currentLang ? 'primary' : 'chip', () => switchLang(l.id));
      }));
    }

    function switchLang(nextId) {
      drafts.set(currentLang, editor.value);
      currentLang = nextId;
      if (featuredIds.includes(nextId)) langChips.value = nextId;
      stop();
      editor.value = drafts.get(nextId) ?? catalogue.find(l => l.id === nextId).sample;
      result.textContent = '';
      result.classList.remove('error');
      aiBox.hidden = true;
      lastErrorText = '';
      renderMeta();
      if (!moreTray.hidden) buildMoreChips(filterIn.value);
    }

    const runBtn = gameBtn('▶ Run Code', 'primary', async () => {
      stop();
      const token = runId, l = catalogue.find(x => x.id === currentLang);
      result.textContent = '';
      result.classList.remove('error');
      aiBox.hidden = true;
      lastErrorText = '';
      try {
        if (l.id === 'web') {
          ensure(htmlIn.value); ensure(cssIn.value); ensure(jsIn.value);
          preview.hidden = false;
          stage = gEl('div', { class: 'web-preview-stage' });
          const shadow = stage.attachShadow({ mode: 'open' });
          const doc = new DOMParser().parseFromString(htmlIn.value, 'text/html');
          doc.querySelectorAll('script,object,embed').forEach(n => n.remove());
          const styleEl = document.createElement('style');
          styleEl.textContent = `:host{display:block;font-family:system-ui,sans-serif;color:#4f2f23;}` + cssIn.value.replace(/body\b/gi, '.web-root');
          const rootWrap = document.createElement('div');
          rootWrap.className = 'web-root';
          rootWrap.append(...doc.body.childNodes);
          shadow.append(styleEl, rootWrap);
          preview.replaceChildren(stage);
          result.textContent = 'Live Shadow DOM preview running:';
          const fmt = v => { try { return typeof v === 'string' ? v : JSON.stringify(v); } catch { return String(v); } };
          const logFn = lvl => (...a) => {
            if (runId === token && result.textContent.length < 100000) result.textContent += `\n${lvl}: ${a.map(fmt).join(' ')}`;
          };
          const scopedConsole = { log: logFn('log'), info: logFn('info'), warn: logFn('warn'), error: logFn('error') };
          const scopedDoc = {
            querySelector: sel => shadow.querySelector(sel),
            querySelectorAll: sel => shadow.querySelectorAll(sel),
            getElementById: id => shadow.getElementById(id),
            createElement: tag => document.createElement(tag),
            body: rootWrap
          };
          try {
            new Function('document', 'console', jsIn.value)(scopedDoc, scopedConsole);
          } catch (err) {
            scopedConsole.error(err.message);
            result.classList.add('error');
            lastErrorText = err.message;
            if (aiErrorsOn) diagnoseWithCoderAI(err.message);
          }
          stageTimer = setTimeout(() => { if (runId === token) result.textContent += '\nPreview session idle.'; }, 15000);
        } else {
          assert(l.status !== 'editor-only', 'No local compiler installed for this language (editing only).');
          const slowWasm = new Set(['python', 'haskell', 'php', 'luau', 'jq', 'sass']);
          result.textContent = slowWasm.has(l.id) ? `Loading ${l.name} runtime…\n` : '';
          let firstLog = true;
          await workerJob(scope, l.id, ensure(editor.value), {}, stdinIn.value, slowWasm.has(l.id) ? 45000 : 8000, s => {
            if (token === runId && result.textContent.length < 100000) {
              if (firstLog && slowWasm.has(l.id)) { result.textContent = ''; firstLog = false; }
              result.textContent += s + '\n';
            }
          });
          if (token === runId && (!result.textContent || (firstLog && slowWasm.has(l.id)))) result.textContent = 'Completed (no output).';
          playSparkle();
        }
      } catch (e) {
        if (token === runId) {
          const msg = e.message || String(e);
          result.textContent += '\nError: ' + msg;
          result.classList.add('error');
          lastErrorText = msg;
          if (aiErrorsOn) diagnoseWithCoderAI(msg);
        }
      }
    });

    const explainBtn = gameBtn('✨ AI Debug / Fix', 'chip', () => {
      playPop(600);
      diagnoseWithCoderAI(lastErrorText);
    });

    const editorField = gameField('Source Editor', editor);
    const stdinField = gameField('Standard Input (stdin)', stdinIn);

    function renderMeta() {
      const l = catalogue.find(x => x.id === currentLang);
      const isWeb = l.id === 'web';
      webGrid.hidden = !isWeb;
      editorField.hidden = isWeb;
      stdinField.hidden = isWeb;
      runBtn.disabled = l.status === 'editor-only';
      runBtn.textContent = isWeb ? '▶ Run Web Preview' : l.status === 'editor-only' ? '📝 Editor Only' : `▶ Run ${l.name}`;
      statusBadge.replaceChildren(
        gEl('div', { class: 'gslider-head' }, gEl('strong', {}, `${l.name}`), gEl('span', { class: 'gbadge' }, l.status.toUpperCase())),
        gEl('small', {}, l.note)
      );
    }

    filterIn.addEventListener('input', () => buildMoreChips(filterIn.value), { signal });

    panel.append(
      langChips.el,
      gEl('div', { class: 'gtabs' }, runnableToggle.el, aiErrorToggle.el),
      gameField(`Search All ${catalogue.length} Languages (42 Runnable Offline)`, filterIn),
      moreTray,
      statusBadge,
      editorField,
      stdinField,
      webGrid,
      gEl('div', { class: 'gtabs' },
        runBtn,
        explainBtn,
        gameBtn('⏹ Stop', 'danger', () => { stop(); result.textContent += '\nStopped.'; }),
        gameBtn('↺ Sample', 'chip', () => { stop(); editor.value = catalogue.find(l => l.id === currentLang).sample; result.textContent = ''; result.classList.remove('error'); aiBox.hidden = true; }),
        gameBtn('↓ Save File', 'chip', () => download('codehub-' + currentLang + '.txt', currentLang === 'web' ? `<!doctype html><style>${cssIn.value}</style>${htmlIn.value}<script>${jsIn.value}<\/script>` : editor.value))
      ),
      preview,
      result,
      aiBox
    );
    renderMeta();

  } else if (id === 'json-validator') {
    const src = codeArea('{"hello":"world","items":[1,2,3],"cozy":true}', 7);
    const indent = gameTabs([['2', '2 Spaces'], ['4', '4 Spaces'], ['tab', 'Tab']], '2', null, 'Indent');
    const stType = statBox('Type', 'Object', 'peach'), stItems = statBox('Keys / Items', '3', 'cream'), stSize = statBox('Bytes', '—', 'cream');
    const out = outConsole();
    const parse = () => {
      try { return JSON.parse(ensure(src.value)); }
      catch (e) {
        let loc = '';
        const m = e.message.match(/position (\d+)/);
        if (m) { const p = +m[1], pre = src.value.slice(0, p); loc = ` (line ${pre.split('\n').length}, col ${p - pre.lastIndexOf('\n')})`; }
        throw Error(e.message + loc);
      }
    };
    const updateStats = v => {
      stType.set(v === null ? 'null' : Array.isArray(v) ? 'Array' : typeof v);
      stItems.set(v && typeof v === 'object' ? (Array.isArray(v) ? v.length : Object.keys(v).length) : 1);
      stSize.set(new TextEncoder().encode(src.value).length + ' B');
    };
    panel.append(
      gameField('JSON Input', src),
      indent.el,
      gEl('div', { class: 'gtabs' },
        gameBtn('✓ Validate', 'primary', runTo(out, () => { const v = parse(); updateStats(v); return 'Valid JSON!'; })),
        gameBtn('✨ Format', '', runTo(out, () => { const v = parse(); updateStats(v); return JSON.stringify(v, null, indent.value === 'tab' ? '\t' : +indent.value); })),
        gameBtn('⚡ Minify', 'chip', runTo(out, () => { const v = parse(); updateStats(v); return JSON.stringify(v); })),
        copyBtn(out)
      ),
      gEl('div', { class: 'stat-grid' }, stType.el, stItems.el, stSize.el),
      out
    );

  } else if (id === 'regex-tester') {
    const pat = textIn('\\b\\w+\\b'), rep = textIn('$&'), src = codeArea('Hello, cozy kitchen! 123 waffles & 45 cookies.', 5);
    const flG = gameToggle('Global (g)', true), flI = gameToggle('Ignore Case (i)', false), flM = gameToggle('Multiline (m)', false);
    const out = outConsole();
    const getFlags = () => (flG.checked ? 'g' : '') + (flI.checked ? 'i' : '') + (flM.checked ? 'm' : '');
    panel.append(
      gEl('div', { class: 'two-col' }, gameField('Regex Pattern', pat), gameField('Replacement', rep)),
      gEl('div', { class: 'gtabs' }, flG.el, flI.el, flM.el),
      gameField('Test Text', src),
      gEl('div', { class: 'gtabs' },
        gameBtn('🔍 Test Matches', 'primary', runTo(out, () => workerJob(scope, 'regex', ensure(src.value), { pattern: pat.value, flags: getFlags(), replacement: rep.value, replace: false }, '', 2000))),
        gameBtn('🪄 Replace', '', runTo(out, () => workerJob(scope, 'regex', ensure(src.value), { pattern: pat.value, flags: getFlags(), replacement: rep.value, replace: true }, '', 2000))),
        copyBtn(out)
      ),
      out
    );

  } else if (id === 'uuid-generator') {
    const countSl = gameSlider({ label: 'How Many UUIDs', min: 1, max: 30, step: 1, value: 5, color: '#8fc487' });
    const ver = gameTabs([['4', 'v4 (Random)'], ['7', 'v7 (Timestamp)']], '4', null, 'UUID Version');
    const list = gEl('div', { class: 'uuid-pill-list' });
    const gen = () => {
      playSparkle();
      const n = countSl.num;
      const vals = Array.from({ length: n }, () => {
        const b = crypto.getRandomValues(new Uint8Array(16));
        if (ver.value === '7') { let t = BigInt(Date.now()); for (let i = 5; i >= 0; i--) { b[i] = Number(t & 255n); t >>= 8n; } b[6] = (b[6] & 15) | 112; }
        else b[6] = (b[6] & 15) | 64;
        b[8] = (b[8] & 63) | 128;
        const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
        return [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20)].join('-');
      });
      list.replaceChildren(...vals.map(u => gameBtn(`📋 ${u}`, 'chip', () => copy(u))));
    };
    panel.append(ver.el, countSl.el, gEl('div', { class: 'gtabs' }, gameBtn('🎲 Generate UUIDs', 'primary', gen)), list);
    gen();

  } else if (id === 'timestamp') {
    const src = textIn(String(Math.floor(Date.now() / 1000)));
    const unit = gameTabs([['s', 'Seconds'], ['ms', 'Milliseconds'], ['us', 'µs'], ['ns', 'ns']], 's', () => convert(), 'Numeric Unit');
    const stIso = statBox('ISO UTC', '—', 'peach'), stLoc = statBox('Local Time', '—', 'cream'), stSec = statBox('Unix s', '—', 'cream'), stMs = statBox('Unix ms', '—', 'cream');
    const errBox = gEl('p', { class: 'output error', hidden: true });
    const convert = () => {
      try {
        errBox.hidden = true;
        let ms;
        const raw = src.value.trim();
        if (/^[+-]?\d+$/.test(raw)) {
          const v = BigInt(raw), sc = { s: 1000n, ms: 1n, us: 1000n, ns: 1000000n }[unit.value];
          ms = Number(unit.value === 's' ? v * sc : unit.value === 'ms' ? v : v / sc);
        } else {
          ms = Date.parse(raw);
          assert(Number.isFinite(ms), 'Use Unix integer or ISO 8601 date.');
        }
        const d = new Date(ms);
        stIso.set(d.toISOString()); stLoc.set(d.toLocaleString()); stSec.set(Math.floor(ms / 1000)); stMs.set(ms);
      } catch (e) { errBox.hidden = false; errBox.textContent = e.message; }
    };
    src.addEventListener('input', convert);
    panel.append(gameField('Timestamp or ISO Date', src), unit.el, gEl('div', { class: 'gtabs' }, gameBtn('⏱ Use Now', 'primary', () => { unit.value = 'ms'; src.value = String(Date.now()); convert(); })), errBox, gEl('div', { class: 'stat-grid' }, stIso.el, stLoc.el, stSec.el, stMs.el));
    convert();

  } else if (id === 'base-converter') {
    const src = textIn('FF');
    const fromTabs = gameTabs([['2', 'Bin 2'], ['8', 'Oct 8'], ['10', 'Dec 10'], ['16', 'Hex 16'], ['36', 'Base 36']], '16', () => update(), 'Input Base');
    const stBin = statBox('Binary (2)', '—', 'cream'), stOct = statBox('Octal (8)', '—', 'cream'), stDec = statBox('Decimal (10)', '—', 'peach'), stHex = statBox('Hex (16)', '—', 'cream');
    const errBox = gEl('p', { class: 'output error', hidden: true });
    function update() {
      try {
        errBox.hidden = true;
        const a = Number(fromTabs.value);
        let s = src.value.trim().toLowerCase(), sign = 1n;
        if (s[0] === '-' || s[0] === '+') { if (s[0] === '-') sign = -1n; s = s.slice(1); }
        if ((a === 16 && s.startsWith('0x')) || (a === 2 && s.startsWith('0b')) || (a === 8 && s.startsWith('0o'))) s = s.slice(2);
        assert(s, 'Enter an integer.');
        let n = 0n;
        for (const c of s) { const v = '0123456789abcdefghijklmnopqrstuvwxyz'.indexOf(c); assert(v >= 0 && v < a, `Invalid digit "${c}" for base ${a}.`); n = n * BigInt(a) + BigInt(v); }
        n *= sign;
        stBin.set(n.toString(2)); stOct.set(n.toString(8)); stDec.set(n.toString(10)); stHex.set(n.toString(16).toUpperCase());
      } catch (e) { errBox.hidden = false; errBox.textContent = e.message; }
    }
    src.addEventListener('input', update);
    panel.append(fromTabs.el, gameField('Integer Input', src), errBox, gEl('div', { class: 'stat-grid' }, stBin.el, stOct.el, stDec.el, stHex.el));
    update();

  } else if (id === 'html-entities') {
    const src = codeArea('<div title="hello">Tom & Jerry © 😀</div>', 5);
    const allTog = gameToggle('Numeric Entities for All Code Points', false);
    const out = outConsole();
    panel.append(
      gameField('Text / HTML Entities', src),
      allTog.el,
      gEl('div', { class: 'gtabs' },
        gameBtn('Encode →', 'primary', runTo(out, () => { const s = ensure(src.value); return allTog.checked ? Array.from(s, c => '&#' + c.codePointAt(0) + ';').join('') : esc(s); })),
        gameBtn('← Decode', '', runTo(out, () => { const s = ensure(src.value), p = new DOMParser(); return s.replace(/&(?:#[xX][0-9a-fA-F]+;?|#\d+;?|[A-Za-z][A-Za-z0-9]+;)/g, e => p.parseFromString('<!doctype html><body>' + e, 'text/html').body.textContent); })),
        copyBtn(out)
      ),
      out
    );

  } else if (id === 'jwt-decoder') {
    const src = codeArea('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ3YWZmbGUtMDEiLCJuYW1lIjoiU2lyIFdhZmZsZSIsImlhdCI6MTcwMDAwMDAwMH0.demo-sig', 4);
    const hCard = gEl('div', { class: 'pastel-card peach' }), pCard = gEl('div', { class: 'pastel-card cream' }), errBox = gEl('p', { class: 'output error', hidden: true });
    function decode() {
      try {
        errBox.hidden = true;
        const parts = ensure(src.value.trim()).split('.');
        assert(parts.length === 3, 'Expected 3-part JWT (header.payload.signature).');
        const dec = s => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0))));
        const header = dec(parts[0]), payload = dec(parts[1]);
        hCard.replaceChildren(gEl('span', { class: 'gbadge' }, 'HEADER (UNVERIFIED)'), gEl('pre', { class: 'output' }, JSON.stringify(header, null, 2)));
        pCard.replaceChildren(gEl('span', { class: 'gbadge' }, 'PAYLOAD CLAIMS'), gEl('pre', { class: 'output' }, JSON.stringify(payload, null, 2)));
      } catch (e) { errBox.hidden = false; errBox.textContent = e.message; }
    }
    src.addEventListener('input', decode);
    panel.append(gameField('JWT Token (Decoded Locally Only)', src), errBox, gEl('div', { class: 'two-col' }, hCard, pCard));
    decode();

  } else if (['css-minifier', 'js-formatter', 'sql-formatter'].includes(id)) {
    const sample = {
      'css-minifier': '/* Cozy card */\n.card {\n  padding: 12px 20px;\n  color: #4f2f23;\n  background: #fff9ec;\n}',
      'js-formatter': 'const bake=(waffles)=>{console.log(`Serving ${waffles} waffles!`)};bake(5)',
      'sql-formatter': 'select id, name, flavor from pantry where ready = 1 order by name;'
    }[id];
    const src = codeArea(sample, 6);
    const dialect = id === 'sql-formatter' ? gameTabs([['sql', 'SQL'], ['sqlite', 'SQLite'], ['postgresql', 'Postgres'], ['mysql', 'MySQL']], 'sql', null, 'SQL Dialect') : null;
    const tsTog = id === 'js-formatter' ? gameToggle('Parse as TypeScript', false) : null;
    const out = outConsole();
    panel.append(
      gameField('Source Code', src),
      dialect ? dialect.el : null,
      tsTog ? tsTog.el : null,
      gEl('div', { class: 'gtabs' },
        gameBtn(id === 'css-minifier' ? '⚡ Minify CSS' : '✨ Format Code', 'primary', runTo(out, async () => {
          const res = await workerJob(scope, { 'css-minifier': 'css-minify', 'js-formatter': 'js-format', 'sql-formatter': 'sql-format' }[id], ensure(src.value), { dialect: dialect?.value, typescript: tsTog?.checked });
          return id === 'css-minifier' ? `${res}\n\n/* ${new TextEncoder().encode(src.value).length} → ${new TextEncoder().encode(res).length} bytes */` : res;
        })),
        copyBtn(out)
      ),
      out
    );

  } else if (id === 'hash-playground') {
    const src = codeArea('Hello, kitchen!', 4);
    const algo = gameTabs([['SHA-256', 'SHA-256'], ['SHA-384', 'SHA-384'], ['SHA-512', 'SHA-512'], ['SHA-1', 'SHA-1']], 'SHA-256', null, 'Hash Algorithm');
    const enc = gameTabs([['hex', 'Hex'], ['base64', 'Base64']], 'hex', null, 'Encoding');
    const out = outConsole();
    panel.append(
      gameField('UTF-8 Text', src), algo.el, enc.el,
      gEl('div', { class: 'gtabs' },
        gameBtn('🔐 Compute Hash', 'primary', runTo(out, async () => {
          const bytes = new Uint8Array(await crypto.subtle.digest(algo.value, new TextEncoder().encode(ensure(src.value))));
          return enc.value === 'hex' ? Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('') : btoa(String.fromCharCode(...bytes));
        })),
        copyBtn(out)
      ),
      out
    );

  } else if (id === 'color-tokens') {
    const picker = gameColorPicker('Seed Brand Color', '#e78167', () => gen());
    const nameIn = textIn('waffle');
    const swatches = gEl('div', { class: 'token-swatch-shelf' });
    const stWcag = statBox('Text Contrast', '—', 'peach');
    const out = outConsole();
    function gen() {
      const hex = picker.value.slice(1);
      const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
      const [r, g, b] = rgb.map(n => n / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
      let hue = 0; if (d) { hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hue = (hue * 60 + 360) % 360; }
      const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
      const lum = rgb.map(v => { const x = v / 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }).reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0);
      const black = (lum + .05) / .05, white = 1.05 / (lum + .05);
      stWcag.set(black >= white ? `Dark ink (${black.toFixed(1)}:1)` : `Light ink (${white.toFixed(1)}:1)`);
      const prefix = /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(nameIn.value.trim()) ? nameIn.value.trim() : 'brand';
      const tokens = {};
      swatches.replaceChildren(...[['50', 96], ['100', 91], ['200', 83], ['300', 73], ['400', 63], ['500', 53], ['600', 43], ['700', 33], ['800', 24], ['900', 15]].map(([k, light]) => {
        const col = `hsl(${hue.toFixed(1)} ${(sat * 100).toFixed(1)}% ${light}%)`;
        tokens[`--${prefix}-${k}`] = col;
        return gEl('div', { class: 'token-chip', style: { background: col, color: light >= 55 ? '#222' : '#fff' } }, k);
      }));
      out.textContent = `:root {\n${Object.entries(tokens).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}`;
    }
    nameIn.addEventListener('input', gen);
    panel.append(picker.el, gameField('CSS Variable Prefix', nameIn), stWcag.el, swatches, out, copyBtn(out));
    gen();

  } else if (id === 'git-cheatsheet') {
    const entries = [
      ['Setup', 'git init', 'Initialize repository'], ['Inspect', 'git status --short', 'Working tree status'],
      ['Inspect', 'git diff', 'Unstaged changes'], ['Inspect', 'git log --oneline --graph --all', 'Commit graph'],
      ['Stage', 'git add <file>', 'Stage one file'], ['Stage', 'git restore --staged <file>', 'Unstage safely'],
      ['Commit', 'git commit -m "message"', 'Create commit'], ['Branch', 'git switch -c <branch>', 'Create & switch branch'],
      ['Sync', 'git fetch --prune', 'Fetch & prune stale branches'], ['Sync', 'git push -u origin HEAD', 'Push current branch'],
      ['Undo', 'git revert <commit>', 'Safe inverse commit'], ['Undo', 'git reset --hard <commit>', 'DESTRUCTIVE: discard changes'],
      ['Stash', 'git stash push -u', 'Stash tracked + untracked'], ['Stash', 'git stash pop', 'Restore latest stash']
    ];
    const qIn = textIn('', 'Search git commands…');
    const catTabs = gameTabs([['', 'All'], ['Inspect', 'Inspect'], ['Stage', 'Stage'], ['Branch', 'Branch'], ['Sync', 'Sync'], ['Undo', 'Undo'], ['Stash', 'Stash']], '', () => render(), 'Category');
    const deck = gEl('div', { class: 'two-col' });
    const render = () => {
      const q = qIn.value.toLowerCase(), cat = catTabs.value;
      const items = entries.filter(([c, cmd, d]) => (!cat || c === cat) && [c, cmd, d].join(' ').toLowerCase().includes(q));
      deck.replaceChildren(...items.map(([c, cmd, d]) => gEl('div', { class: 'pastel-card cream' },
        gEl('div', { class: 'gslider-head' }, gEl('span', { class: 'gbadge' }, c), gameBtn('📋 Copy', 'chip', () => copy(cmd))),
        gEl('pre', { class: 'output' }, cmd),
        gEl('small', {}, d)
      )));
    };
    qIn.addEventListener('input', render);
    panel.append(gameField('Search Git', qIn), catTabs.el, deck);
    render();

  } else if (id === 'http-status') {
    const statuses = [
      [100, 'Continue', 'Client may continue sending body.'], [101, 'Switching Protocols', 'Protocol upgrade accepted.'],
      [200, 'OK', 'Request succeeded.'], [201, 'Created', 'New resource created.'], [204, 'No Content', 'Success, empty body.'],
      [301, 'Moved Permanently', 'Permanent redirect.'], [302, 'Found', 'Temporary redirect.'], [304, 'Not Modified', 'Reuse cached version.'],
      [400, 'Bad Request', 'Malformed syntax or routing.'], [401, 'Unauthorized', 'Authentication required.'], [403, 'Forbidden', 'Server refuses access.'],
      [404, 'Not Found', 'Resource not found.'], [418, "I'm a Teapot", 'Classic April Fools RFC 2324 code!'], [429, 'Too Many Requests', 'Rate limited; check Retry-After.'],
      [500, 'Internal Server Error', 'Unexpected server failure.'], [502, 'Bad Gateway', 'Invalid upstream response.'], [503, 'Service Unavailable', 'Temporary overload/maintenance.'], [504, 'Gateway Timeout', 'Upstream timed out.']
    ];
    const qIn = textIn('', 'Search code or meaning… e.g. 404, redirect, teapot');
    const grpTabs = gameTabs([['', 'All'], ['1', '1xx'], ['2', '2xx'], ['3', '3xx'], ['4', '4xx'], ['5', '5xx']], '', () => render(), 'Status Group');
    const deck = gEl('div', { class: 'two-col' });
    const render = () => {
      const q = qIn.value.toLowerCase(), grp = grpTabs.value;
      const items = statuses.filter(([code, name, desc]) => (!grp || String(code).startsWith(grp)) && `${code} ${name} ${desc}`.toLowerCase().includes(q));
      deck.replaceChildren(...items.map(([code, name, desc]) => gEl('div', { class: `pastel-card ${code >= 500 ? 'peach' : 'cream'}` },
        gEl('div', { class: 'gslider-head' }, gEl('strong', {}, `${code} ${name}`), gEl('span', { class: 'gbadge' }, `${String(code)[0]}xx`)),
        gEl('small', {}, desc)
      )));
    };
    qIn.addEventListener('input', render);
    panel.append(gameField('Search HTTP Status', qIn), grpTabs.el, deck);
    render();
  }

  return id === 'codehub' ? dispose : true;
}
