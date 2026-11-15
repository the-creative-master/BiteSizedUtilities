# BiteSized Utilities

**A little tool for everything.** A cozy, privacy-first browser-tool kitchen with six cupboards, 75 utilities, and a downloadable offline arcade: **25 games from 13 source repositories**.

## Run locally

Requires Node.js 22+ and npm.

```sh
npm ci
npm run dev
```

For the production build:

```sh
npm test
npm run build
npm run preview
```

Serve `dist/` over HTTP(S). Opening `index.html` with `file://` is not supported: ES modules, WebAssembly and service workers require a real web origin. No application server, account or database is needed.

## The cupboards

Each of the first five cupboards has **exactly 15 working tools**:

- **Math & Numbers:** Calculator, Unit Converter, Percentage Lab, Fraction Kitchen, Statistics, Random Numbers, Number Bases, Prime Checker, Scientific Calculator, Equation Solver, Geometry, Loan Calculator, Tip & Split, Date Calculator, Roman Numerals.
- **Coding & Developing:** CodeHub, JSON Validator, Regex Tester, UUID Generator, Timestamp Kitchen, Developer Base Converter, HTML Entities, JWT Decoder, CSS Minifier, JavaScript Formatter, SQL Formatter, Hash Playground, Color Tokens, Git Cheatsheet, HTTP Status Codes.
- **Text & Files:** File Converter, Crazy Text Filters, Word Counter, Case Converter, JSON Formatter, Base64 Studio, URL Encoder, Markdown Preview, Text Diff, Find & Replace, Lorem Ipsum, File & Text Hash, CSV Editor, Pocket Notepad, File Inspector.
- **Art & Coloring:** Art Studio, Color Picker, Palette Generator, Gradient Maker, Pixel Art, Image Resizer, Image Cropper, Image Filters, SVG Playground, Contrast Checker, Color Converter, Pattern Maker, Collage Maker, ASCII Art, Mandala Maker.
- **Science & Physics:** Physics Hub, Periodic Table, Motion Calculator, Force & Momentum, Energy Calculator, Gravity Explorer, Wave Lab, Circuit Calculator, Optics Bench, Pressure Calculator, Density Calculator, Temperature Lab, Ideal Gas Law, Half-Life Calculator, Scientific Constants.
- **Games & Fun:** vendored, licensed, self-contained games with source attribution and downloadable offline archives. See `games/ATTRIBUTION.md` and `games/catalog.json` for the exact collection.

## CodeHub: what actually runs

CodeHub has a **75-entry language/format catalogue**, not 75 installed language engines. Executable entries, educational subsets and editor-only entries have different badges and explicit runtime notes. The full installed matrix is in CodeHub itself.

Verified local execution includes JavaScript, TypeScript, CoffeeScript, **Python through bundled Pyodide 314.0.7**, Lua, SQLite SQL, Brainfuck and Befunge-93. Additional small interpreters cover Boolfuck, Ook!, Whitespace, and explicitly labeled BASIC/Forth/Lisp/Scheme subsets. HTML/CSS/JavaScript run together in a separate sandboxed browser preview. JSON parsing is listed as a format tool, not misrepresented as a programming-language implementation.

**The request for at least 50 fully executable languages is not yet met.** Node.js is separate from browser JavaScript and has no installed Node/WebContainer adapter. Java, C and C++ are editor-only, as are other entries without genuine local runtimes. Their Run button is disabled. Installing actual WASM toolchains, runtime libraries and compatible licenses is future work, not simulated output. The precise split is **13 executable catalogue entries, 4 executable educational subsets, and 58 editor-only entries** (the 13 include the combined web preview and JSON parser). See `runtimes/README.md` for exact versions and limitations.

## File Converter scope

The current converter genuinely handles PNG/JPEG/WebP image transcoding and JSON/CSV/TSV/TXT/HTML/Markdown text/tabular conversions. It does **not** yet support PDF, Office documents, audio/video transcoding or archive conversion. Unsupported conversions are rejected rather than renaming file extensions.

## Local-first, not pretend-offline

The UI, fonts, utilities and bundled runtime assets are served from this repository. File conversions happen on your device. Favorites, recent tools and the notepad use browser local storage. There is no analytics or backend upload endpoint.

After a production visit the service worker precaches the app shell. Games and language runtimes are **not all precached** because of their size: they are cached on demand after a successful fetch, subject to browser storage limits. A game ZIP is the most dependable way to keep that game offline. A fresh browser cannot load unvisited runtime assets without either the locally running server or an initial connection.

CodeHub runs user code in isolated workers or sandboxed frames. Running untrusted code still has CPU and memory risks; do not enter secrets. Never treat a JWT decoder as a signature verifier. Math, finance and science tools are educational/general-use helpers, not professional advice.

## Deployment

`.github/workflows/pages.yml` builds and deploys on pushes to `main`. In repository **Settings → Pages → Build and deployment**, choose **GitHub Actions**. Vite uses relative asset paths, so project subpaths are supported. Publish the contents of `dist/` to any static host.

## Testing

`npm test` checks catalogue integrity, all 75 implementation registrations, and local game assets. `node tests/browser-smoke.mjs` additionally smoke-tests every tool, navigation, search, favorites, mobile overflow, uncaught browser errors and accidental external requests; start the dev/preview server first and install Playwright Chromium if needed.

Third-party game and runtime licenses are preserved in their respective directories. Font licenses are in `public/fonts/`.
