# 🧰 BiteSizedUtilities

> **Small tools. Big utility. Zero fuss.**

**BiteSizedUtilities** is a cozy, browser-first collection of calculators, coding tools, text utilities, art tools, science experiments, music tools, video editors, and offline arcade games. It is presented as a 2.5D kitchen: open a cupboard, pick a toy, and get started.

[![Version](https://img.shields.io/badge/Version-1.2.8-blue)](#)
[![Built for the web](https://img.shields.io/badge/Built%20for-the%20web-orange)](#)
[![Utilities](https://img.shields.io/badge/Utilities-120-green)](#)
[![Games](https://img.shields.io/badge/Games-51-purple)](#)

---

## ✨ Highlights

- **120 utility tools** across eight cupboards
- **51 offline arcade and puzzle games**
- **No account required** and mostly browser-powered
- **Favorites and recently opened tools** saved in local browser storage
- **Search, surprise picks, and 8 kitchen themes**
- **Multiple languages** for the interface
- **Keyboard-friendly controls, sound effects, and responsive layouts**
- **Waffle AI** chat, image generation, web search, file analysis, and model settings
- **Art, music, video, code, and game experiences** that work directly in the browser

## 🗂️ The kitchen

| Cupboard | What you'll find |
|---|---|
| **Math & Numbers** | Calculators, graphing, fractions, percentages, dice, Roman numerals, number bases, primes, and sequences |
| **Coding & Developing** | CodeHub, formatters, converters, regex tools, UUID tools, timestamp tools, and browser runtimes |
| **Text & Files** | File conversion, text tools, ASCII and text-art utilities |
| **Art & Coloring** | Layered art studio, brushes, canvas tools, and image editing |
| **Science & Physics** | Physics calculators and interactive science tools |
| **English & Languages** | Translation, grammar, tone rewriting, summarizing, vocabulary, flashcards, conversation practice, and more |
| **Music & Composing** | Drum sequencer, synth, chords, metronome, tuner, visualizers, SFX, and songwriter tools |
| **Video & Editing** | Waffle Studio, teleprompter, subtitles, chroma key, timelapse, LUTs, frame grabbing, bitrate and exposure tools |
| **Games & Fun** | Offline arcade titles, puzzles, Fancade collection, and original games |

## 💻 CodeHub and runtimes

CodeHub can edit, run, format, or preview a wide range of code entries.

- Real execution: HTML/CSS/JavaScript, JavaScript, TypeScript, CoffeeScript, Python, Lua, SQLite SQL, Brainfuck, Boolfuck, Ook!, Whitespace, Befunge-93, and Bash
- Local educational subsets: BASIC, Forth, Lisp, and Scheme
- Browser preview in a sandboxed iframe
- Python powered by locally vendored Pyodide WebAssembly
- Lua powered by Fengari and SQL powered by sql.js
- Numerous editor-only language entries for editing and downloading code
- Disposable workers and execution bounds isolate and stop untrusted snippets

Runtimes and asset behavior are documented in [`runtimes/README.md`](runtimes/README.md).

> Code runtimes are execution tools, not OS emulators. File-system, networking, and package capabilities vary by runtime.

## 🎮 Games

The arcade loads from a local game catalog and can launch games directly or in a new tab. It includes favorites and fan-content, with search and category filters.

- **51 game entries** in the catalog
- Action, puzzle, casual, and Fancade categories
- Direct local launch without iframe embedding
- Offline assets where included
- Age-gated entries with a fresh warning shown before each launch
- Attribution information in [`games/ATTRIBUTION.md`](games/ATTRIBUTION.md)

## 🧇 Waffle AI

Waffle AI is the assistant built into the kitchen:

- Chat and text generation
- Image generation
- Web-search-assisted answers
- Uploaded text, document, code, and image analysis
- Browser WebGPU/WASM and fallback runtimes
- Downloadable chat replies, Markdown, DOCX, source code, and images
- On-device model pre-caching
- Runtime and device diagnostics

The project includes settings for text and image models, execution mode, quantization, smart prompts, and AI temperature.

## 🚀 Run locally

### Requirements

- A current browser
- [Node.js](https://nodejs.org/) and npm

### Start the development server

```bash
git clone https://github.com/the-creative-master/BiteSizedUtilities.git
cd BiteSizedUtilities
npm install
npm run dev
```

Vite prints the local address, usually `http://localhost:5173`.

### Build for production

```bash
npm run build
npm run preview
```

The production build is written to `dist/`.

> Use HTTP or HTTPS rather than opening files with `file://`. Features such as Clipboard access, Web Crypto, WebGPU, workers, and secure-context APIs work most reliably on localhost or HTTPS.

## 🧪 Testing

The repository has Node tests and browser smoke tests covering catalog counts, utility mounting, code runtimes, the games cabinet, AI UI, backups, and art tools.

```bash
npm test
```

Useful focused checks include:

```bash
node --test tests/catalog.test.js
node --test tests/code-runtime.test.js
node --test tests/cabinet-games.test.js
node --test tests/all-tools-ui.test.js
```

Browser and runtime smoke tests may require the Vite server or a successful production build.

## 🗃️ Project structure

| Path | Purpose |
|---|---|
| `index.html` | App entry document and metadata |
| `app.js` | Kitchen navigation, cupboards, routing, settings, and UI |
| `catalog.js` | Public utility catalog |
| `tools-*.js` | Tool-family mount functions and implementations |
| `games.js` / `games/` | Arcade catalog and offline game assets |
| `runtimes/` | Code execution runtimes and runtime documentation |
| `waffle-ai.js` | Waffle AI chat and assistant interface |
| `waffle-browser-ai.js` | Browser model selection and inference fallbacks |
| `waffle-image-gen.js` | Browser image-generation integrations |
| `style.css` | 2.5D kitchen, cupboard, and modal styling |
| `tests/` | Node and browser test suite |
| `public/` | Static manifest, favicon, and public assets |

## 🎨 Settings and personalization

Open the gear in the kitchen to customize:

- Kitchen sounds
- Eight kitchen themes
- App language
- Waffle AI text and image models
- Execution/fallback mode
- Quantization and model pre-caching
- Device and WebGPU information
- Advanced AI temperature controls

Preferences and favorites are stored locally in the browser.

## 🤝 Contributing

Contributions are welcome.

1. Search open issues or create a focused issue.
2. Fork the repository and create a descriptive branch.
3. Keep changes small and verify affected tests.
4. Run `npm run build` before submitting UI or runtime changes.
5. Include screenshots or recording links for visual changes.
6. Document new runtimes, dependencies, or browser requirements.

Please include clear reproduction steps, expected behavior, actual behavior, and relevant browser/device information for bugs.

## 📄 Credits

- Some games and runtime assets are bundled from third-party open-source projects.
- Attribution and original-source details live in [`games/ATTRIBUTION.md`](games/ATTRIBUTION.md) and relevant source files.
- Refer to the corresponding upstream licenses before redistribution or modification.

## 🔒 Privacy

This is a mostly static, client-side project. Favorites, recent tools, preferences, and settings are stored in browser storage. Waffle AI features may read user-selected files and make network requests to model or search providers when used.

See the project UI and source for the specific model, provider, and data-storage behavior before using AI features.
