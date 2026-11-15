# Code tools: local runtime matrix

`tools-code.js` exports `mountCode(id, root)`. Unknown IDs return `false` without modifying the root. CodeHub returns an **idempotent disposal function** (truthy for existing callers); the other 14 utilities return `true`. Call the disposer when navigating away. Remounting a root, removing it from the document, or dispatching `tool-dispose` also cancels jobs and removes listeners/iframes. An unconnected root should be attached before the next DOM mutation.

## Honest coverage

The catalogue has **75 entries: 13 executable + 4 executable subsets + 58 editor-only**. This is **not 75 or 50 executable programming languages**. HTML/CSS/JS is one combined web entry, JSON is a parser rather than a programming language, TypeScript/CoffeeScript compile into JavaScript, and Lisp/Scheme share one educational evaluator.

| Entry | Status | Actual local implementation / constraints |
|---|---|---|
| HTML / CSS / JavaScript | Executable | Three distinct editors, real browser preview in opaque-origin `sandbox="allow-scripts"` iframe; forwarded console/errors; 15-second preview lifetime |
| JavaScript | Executable | Disposable classic Web Worker, browser APIs only, `input` string; **not Node.js** |
| TypeScript | Executable | TypeScript **5.9.3** `transpileModule`, ES2022 → worker; syntax diagnostics, **no semantic type checker or package resolver** |
| CoffeeScript | Executable | CoffeeScript **2.7.0**, genuine local compiler → worker |
| Python | Executable | **Pyodide 314.0.7** / CPython WASM, local standard library; fresh module worker each run |
| Lua | Executable | **Fengari 0.1.5**, Lua 5.3 semantics in worker; no OS filesystem; `print` captured, `input` global string |
| SQLite SQL | Executable | **sql.js 1.16.0** WASM; fresh in-memory database per run, all result sets rendered as JSON |
| JSON | Parser | Native strict JSON parse/pretty print, not a general language |
| Brainfuck | Executable | 8-bit wrapping cells; fixed 65,536-cell wrapping tape; character I/O, EOF=0; bracket validation and instruction limit |
| Boolfuck | Executable | Bit cells on the same bounded wrapping tape; `,`/`;` little-endian byte I/O; EOF=0; noninstructions ignored |
| Ook! | Executable | Validates paired Ook tokens, translates the eight canonical instructions to the actual Brainfuck interpreter |
| Whitespace | Executable | Stack, heap, arithmetic, labels, branches, calls/return, character and integer I/O; JS-number integers rather than arbitrary-precision spec integers |
| Befunge-93 | Executable | 80×25 toroidal grid, stack/arithmetic/branch/string/input/output/self-modification; division by zero is an explicit error rather than interactive implementation-specific behavior |
| BASIC | **Subset** | Numbered or sequential lines, LET, PRINT with semicolons, INPUT, IF/THEN, GOTO, GOSUB/RETURN, FOR/TO/STEP/NEXT, END/STOP, REM. Arithmetic/string expressions and ABS/INT/SQR/LEN/CHR$/ASC/STR$. No arrays, DATA, colon-separated statements, graphics, or full QBASIC |
| Forth | **Subset** | Numbers, stack words, arithmetic, comparisons, bitwise words, definitions, IF/ELSE/THEN, BEGIN/UNTIL, return-stack transfers, emit/printing; no ANS conformance, memory words, DO/LOOP, or input parser words |
| Lisp | **Subset** | Proper lists, quote, lexical lambda/closures, define/defun, if, begin, let, set!, and/or, arithmetic, basic list functions, print/display; not Common Lisp |
| Scheme | **Subset** | Same educational evaluator as Lisp; not R5RS/R7RS, no hygienic macros, continuations, numeric tower, dotted pairs, or module system |

### Editor-only entries (58)

Node.js; Java; C; C++; C#; Go; Rust; Ruby; PHP; Swift; Kotlin; Scala; R; Julia; Perl; Haskell; OCaml; F#; Elixir; Erlang; Clojure; Dart; Groovy; PowerShell; Bash; Zsh; Fish; POSIX shell; Objective-C; Pascal; Fortran; COBOL; Ada; D; Nim; Zig; V; Crystal; Smalltalk; Prolog; Racket; Elm; PureScript; Reason; Solidity; Vyper; Assembly; WebAssembly text; MATLAB/Octave; VHDL; Verilog; GraphQL; YAML; TOML; XML; Markdown; standalone CSS; standalone HTML.

These can be edited, copied, and downloaded. Their **Run button is disabled**. Standalone HTML/CSS authors should use the executable combined web entry. There is **no WebContainer, Node, JVM, C/C++ compiler, remote execution service, or fake transpiler**. An attempted `@chriskoch/jscpp` package lookup returned npm 404, so it was not used or claimed.

## Pyodide version verification and assets

Verified with unauthenticated public GitHub API requests on 2026-11-15:

- Requested **314.0.7 really exists**: https://api.github.com/repos/pyodide/pyodide/releases/tags/314.0.7
- Release: https://github.com/pyodide/pyodide/releases/tag/314.0.7
- Latest stable API returned **314.0.8**, not 314.0.7: https://api.github.com/repos/pyodide/pyodide/releases/latest
- Vendored the **requested 314.0.7** core archive: https://github.com/pyodide/pyodide/releases/download/314.0.7/pyodide-core-314.0.7.tar.bz2 (6,757,104 compressed bytes).

The usable browser files are vendored in `pyodide/` (~13 MB uncompressed). There is **no automatic CDN install or optional remote download**: the runtime is already installed and clicking Run loads same-origin files. Extra Python packages are **not** bundled; package installation is not offered. Manually importing package installers in user code can access the network; do not assume worker code is a network security sandbox.

Pyodide 314 requires a **module worker**. `python-worker.js` is used directly by the UI; `worker.js` also delegates Python requests to a nested module worker for callers using the common dispatcher API. Terminating a parent worker terminates its child.

## Other utilities

All 15 requested IDs are implemented. Real dependencies: Prettier **3.10.1** with Babel/ESTree/TypeScript parsers; sql-formatter **15.9.0**; CSS Tree **3.2.1** (AST-based whitespace minification, not semantic optimization). Version manifest: `vendor/versions.json`; upstream licenses: `vendor/licenses/` and `pyodide/LICENSE`.

UUID v4 and v7 use Web Crypto; v7 is not monotonic within a millisecond. Timestamp conversion is millisecond-precision, including explicit numeric unit selection and timezone-bearing ISO input. Base conversion is BigInt-based (2–36). JWT decoding **does not verify signatures**. HTML entity output is always text. Hashes use SubtleCrypto SHA-1/256/384/512, not MD5, encryption, or password hashing. Color tokens use a fixed-lightness HSL ramp, not a perceptually uniform algorithm. Git and HTTP references are searchable; dangerous Git commands and nonstandard HTTP codes are labeled.

## Isolation, bounds, and known limits

- Host code never evaluates user snippets. JS uses `new Function` **only inside a disposable worker**; HTML/CSS/JS execute only in the sandboxed iframe.
- Worker timeout: **5 seconds** normally, **45 seconds** Python cold start; regex **2 seconds**. Stop/dispose terminates workers, not merely a timer flag. No persisted sessions across runs.
- Inputs: 1 MB for worker jobs; regex text 100,000 chars, pattern 10,000; 1,000 regex matches. Output 100,000 characters, with instruction/call limits for embedded interpreters. BASIC/Lisp/Whitespace/Forth use JavaScript number arithmetic, so very large integers lose precision.
- The web iframe disallows same-origin privileges, forms, popups, frames, and fetch connections via sandbox/CSP. Console messages require matching source window and random channel. Snippets cannot access the parent DOM. This is **not a comprehensive hostile-code security product**: browsers may share iframe and parent threads; `while(true){}` in preview can hang the tab before its 15s removal timer runs. Browser reload may be necessary. DOM allocations can exhaust memory.
- Worker execution is responsive isolation, **not a network/credential security boundary**. Browser workers have same-origin capabilities, can fetch, and deliberately malicious code can tamper with its own runtime/protocol. Do not run hostile code on an origin containing sensitive data. A separate execution origin would be needed for that threat model.
- Serve via HTTP(S), not `file://`. Clipboard and SubtleCrypto require HTTPS or localhost. Supported browsers need modern Worker, WebAssembly, BigInt, TextDecoder, and AbortController.
- Offline means assets are served locally or already cached. An uncached remote deployment does not magically work without connectivity.

## Vite integration

URLs resolve from `new URL('runtimes/', document.baseURI)`, not `import.meta.url`, so production asset hashing does not redirect them. Existing build plugin copies the complete directory to `dist/runtimes`. Its small `configureServer` addition streams runtime assets byte-for-byte with correct JS/MJS/WASM MIME types. This is essential: Vite's dev HTML/HMR transform otherwise injects an `import '/@vite/client'` into **classic workers and importScripts bundles** and breaks them. No duplicate `public/runtimes` tree.

## Verification

From repository root:

```sh
node --check tools-code.js
node --check runtimes/worker.js
node --check runtimes/python-worker.js
node --test tests/code-runtime.test.js
# Test actual Vite dev asset delivery, assuming the server is already running:
CODE_TEST_ORIGIN=http://localhost:4173 node --test tests/code-runtime.test.js
# Test copied production runtime tree after a successful build:
CODE_TEST_ASSETS="$PWD/dist" node --test tests/code-runtime.test.js
```

Tests use real Chromium via the project's Playwright dependency, not mocked interpreter output. Coverage includes all 16 dispatcher modes, all 15 mounted tool IDs, sandbox execution and console forwarding, invalid programs, real SHA-256, HTML entity safety, formatter correctness, timeouts, and disposal. `tests/runtime-smoke.mjs` (integration owner's independent suite) also passed its 12 runtimes, including classic-dispatcher Python delegation.
