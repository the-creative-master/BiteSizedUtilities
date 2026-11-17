/** Cozy 2.5D Developer Utilities — zero default HTML select/checkbox/range/color inputs */
import { gEl, gameBtn, gameTabs, gameToggle, gameSlider, gameColorPicker, gameField, statBox } from './ui-kit.js';
import { playPop, playSparkle } from './sfx.js';

const runtimeBase = () => new URL('runtimes/', document.baseURI);
const mounted = new WeakMap();
const MAX = 1000000;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const catalogue = [
  ['web', 'HTML / CSS / JS', 'executable', 'Local opaque-origin three-pane sandbox', ''],
  ['javascript', 'JavaScript', 'executable', 'Browser worker (ES2022)', 'console.log("Hello, JavaScript!");\nconsole.log([1,2,3].map(n => n*n));'],
  ['typescript', 'TypeScript', 'executable', 'TypeScript 5.9 → worker', 'const greeting: string = "Hello, TypeScript!";\nconsole.log(greeting);'],
  ['coffeescript', 'CoffeeScript', 'executable', 'CoffeeScript 2.7 → worker', 'square = (x) -> x * x\nconsole.log square(12)'],
  ['bash', 'Bash', 'subset', 'BashKit 0.21.0 WASM VFS', 'echo "Hello from Bash"; printf "%s\\n" "$((6*7))"'],
  ['python', 'Python', 'executable', 'Pyodide CPython WASM', 'import sys\nprint(sys.version.split()[0])\nprint(sum(range(10)))'],
  ['lua', 'Lua', 'executable', 'Fengari Lua 5.3 worker', 'print("Hello, Lua!")\nfor i = 1, 5 do print(i * i) end'],
  ['sql', 'SQLite SQL', 'executable', 'sql.js SQLite WASM', "CREATE TABLE greetings (name TEXT);\nINSERT INTO greetings VALUES ('Ada'), ('Grace');\nSELECT * FROM greetings;"],
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
  ...[
    ['nodejs', 'Node.js'], ['java', 'Java'], ['c', 'C'], ['cpp', 'C++'], ['csharp', 'C#'], ['go', 'Go'],
    ['rust', 'Rust'], ['ruby', 'Ruby'], ['php', 'PHP'], ['swift', 'Swift'], ['kotlin', 'Kotlin'],
    ['scala', 'Scala'], ['r', 'R'], ['julia', 'Julia'], ['perl', 'Perl'], ['haskell', 'Haskell'],
    ['ocaml', 'OCaml'], ['fsharp', 'F#'], ['elixir', 'Elixir'], ['erlang', 'Erlang'], ['clojure', 'Clojure'],
    ['dart', 'Dart'], ['groovy', 'Groovy'], ['powershell', 'PowerShell'], ['zsh', 'Zsh'], ['fish', 'Fish'],
    ['sh', 'POSIX shell'], ['objectivec', 'Objective-C'], ['pascal', 'Pascal'], ['fortran', 'Fortran'],
    ['cobol', 'COBOL'], ['ada', 'Ada'], ['d', 'D'], ['nim', 'Nim'], ['zig', 'Zig'], ['v', 'V'],
    ['crystal', 'Crystal'], ['smalltalk', 'Smalltalk'], ['prolog', 'Prolog'], ['racket', 'Racket'],
    ['elm', 'Elm'], ['purescript', 'PureScript'], ['reason', 'Reason'], ['solidity', 'Solidity'],
    ['vyper', 'Vyper'], ['assembly', 'Assembly'], ['wasm', 'WebAssembly text'], ['matlab', 'MATLAB'],
    ['vhdl', 'VHDL'], ['verilog', 'Verilog'], ['graphql', 'GraphQL'], ['yaml', 'YAML'],
    ['toml', 'TOML'], ['xml', 'XML'], ['markdown', 'Markdown'], ['css', 'CSS'], ['html', 'HTML']
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
function copy(text) {
  assert(navigator.clipboard?.writeText, 'Clipboard unavailable.');
  return navigator.clipboard.writeText(text);
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
    const featuredIds = ['javascript', 'typescript', 'python', 'sql', 'lua', 'bash', 'web', 'json', 'brainfuck', 'lisp', 'forth', 'basic'];
    let currentLang = 'javascript';
    const drafts = new Map();

    const filterIn = textIn('', 'Filter all 75 languages… e.g. rust, python, sql');
    const langChips = gameTabs(
      featuredIds.map(lid => [lid, catalogue.find(x => x.id === lid).name]),
      currentLang,
      val => switchLang(val),
      'Quick Runtime Switcher'
    );
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
    let frame = null, frameTimer = null, runId = 0;

    const clearFrame = () => { clearTimeout(frameTimer); frame?.remove(); frame = null; preview.replaceChildren(); preview.hidden = true; };
    cleanups.push(clearFrame);
    const stop = () => { runId++; for (const c of [...scope.jobs]) c(); clearFrame(); };

    function buildMoreChips(q) {
      const ql = q.trim().toLowerCase();
      moreTray.hidden = !ql;
      if (!ql) return;
      const matches = catalogue.filter(l => l.name.toLowerCase().includes(ql) || l.id.includes(ql)).slice(0, 24);
      moreTray.replaceChildren(...matches.map(l => {
        const b = gameBtn(`${l.name} (${l.status})`, l.id === currentLang ? 'primary' : 'chip', () => switchLang(l.id));
        return b;
      }));
    }

    function switchLang(nextId) {
      drafts.set(currentLang, editor.value);
      currentLang = nextId;
      if (featuredIds.includes(nextId)) langChips.value = nextId;
      stop();
      editor.value = drafts.get(nextId) ?? catalogue.find(l => l.id === nextId).sample;
      result.textContent = '';
      renderMeta();
    }

    const runBtn = gameBtn('▶ Run Code', 'primary', async () => {
      stop();
      const token = runId, l = catalogue.find(x => x.id === currentLang);
      result.textContent = '';
      result.classList.remove('error');
      try {
        if (l.id === 'web') {
          ensure(htmlIn.value); ensure(cssIn.value); ensure(jsIn.value);
          preview.hidden = false;
          frame = gEl('iframe', { class: 'arcade-iframe', title: 'HTML CSS JS sandbox preview', sandbox: 'allow-scripts', referrerPolicy: 'no-referrer' });
          frame.style.height = '280px';
          const nonce = crypto.randomUUID(), channel = crypto.randomUUID();
          frame.dataset.channel = channel;
          const bridge = `(()=>{const ch=${JSON.stringify(channel)};const send=t=>parent.postMessage({channel:ch,text:String(t)},'*');const fmt=v=>{try{return typeof v==='string'?v:JSON.stringify(v)}catch{return String(v)}};for(const lvl of['log','info','warn','error'])console[lvl]=(...a)=>send(lvl+': '+a.map(fmt).join(' '));addEventListener('error',e=>send('Error: '+e.message));})();`;
          const safeJS = jsIn.value.replace(/<\/script/gi, '<\\/script');
          frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' blob:; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; font-src data:; frame-src 'none'; form-action 'none'; base-uri 'none'"><script nonce="${nonce}">${bridge}<\/script><style>${cssIn.value.replace(/<\/style/gi, '<\\/style')}</style></head><body>${htmlIn.value}<script nonce="${nonce}">${safeJS}<\/script></body></html>`;
          preview.replaceChildren(frame);
          frameTimer = setTimeout(() => { if (runId === token) { clearFrame(); result.textContent += '\nPreview expired (15s).'; } }, 15000);
          result.textContent = 'Sandbox preview running:';
        } else {
          assert(l.status !== 'editor-only', 'No local compiler installed for this language (editing only).');
          await workerJob(scope, l.id, ensure(editor.value), {}, stdinIn.value, l.id === 'python' ? 45000 : 5000, s => {
            if (token === runId && result.textContent.length < 100000) result.textContent += s + '\n';
          });
          if (token === runId && !result.textContent) result.textContent = 'Completed (no output).';
          playSparkle();
        }
      } catch (e) {
        if (token === runId) { result.textContent += '\nError: ' + e.message; result.classList.add('error'); }
      }
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
    window.addEventListener('message', e => {
      if (frame && e.source === frame.contentWindow && e.data?.channel === frame.dataset.channel) {
        if (result.textContent.length < 100000) result.textContent += '\n' + String(e.data.text).slice(0, 10000);
      }
    }, { signal });

    panel.append(
      langChips.el,
      gameField(`Search All ${catalogue.length} Languages`, filterIn),
      moreTray,
      statusBadge,
      editorField,
      stdinField,
      webGrid,
      gEl('div', { class: 'gtabs' },
        runBtn,
        gameBtn('⏹ Stop', 'danger', () => { stop(); result.textContent += '\nStopped.'; }),
        gameBtn('↺ Sample', 'chip', () => { stop(); editor.value = catalogue.find(l => l.id === currentLang).sample; result.textContent = ''; }),
        gameBtn('↓ Save File', 'chip', () => download('codehub-' + currentLang + '.txt', currentLang === 'web' ? `<!doctype html><style>${cssIn.value}</style>${htmlIn.value}<script>${jsIn.value}<\/script>` : editor.value))
      ),
      preview,
      result
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
