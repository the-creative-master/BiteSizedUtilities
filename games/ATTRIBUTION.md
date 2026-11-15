# Offline game sources, licenses and audit

25 playable games from 13 GitHub repositories. LittleJS entries are distinct upstream games, not separate source repositories.

## Redistribution scope

This collection is a modified offline redistribution. Every game directory and ZIP contains the original full license, pinned revision in SOURCE.json, modification notes in OFFLINE-README.md, and a full MIT license for first-party compatibility adapters. Repository license declarations and bundled notices were inspected; this is a practical source/license audit, not a legal guarantee of independent asset authorship.

Runtime assets are local or embedded. Remote fonts, analytics, remote emoji rendering, external embeds, and uncertain sounds are omitted. A restrictive game CSP denies network connections. Games run with sandbox="allow-scripts" only: no same-origin permission, popups, downloads from within games, or persistent storage. Host-side ZIP downloads remain available.

## Games and pinned revisions

| Game | Source and revision | License | Adaptation |
| --- | --- | --- | --- |
| 2048 | [gabrielecirulli/2048](https://github.com/gabrielecirulli/2048/tree/478b6ec346e3787f589e4af751378d06ded4cbbc) · `478b6ec346e3787f589e4af751378d06ded4cbbc` | MIT | Local upstream runtime; sandbox compatibility adapter. |
| Canvas Tetris | [jakesgordon/javascript-tetris](https://github.com/jakesgordon/javascript-tetris/tree/e5c0c42f7dac0f3514a55eff656c6e22e95d68ed) · `e5c0c42f7dac0f3514a55eff656c6e22e95d68ed` | MIT | Local upstream runtime; sandbox compatibility adapter. |
| Pong: One or Two Players | [jakesgordon/javascript-pong](https://github.com/jakesgordon/javascript-pong/tree/ca3240536e4f79ab7144388e56ed19de715b6662) · `ca3240536e4f79ab7144388e56ed19de715b6662` | MIT | Tutorial links removed. External-origin sound assets replaced by silent adapter. |
| Classic Tetris | [dionyziz/canvas-tetris](https://github.com/dionyziz/canvas-tetris/tree/4e497d1c858914f0a1f0818698029d1c7dad090b) · `4e497d1c858914f0a1f0818698029d1c7dad090b` | MIT | Pop sound omitted because its separate provenance is undocumented. Keyboard ignored until Play to prevent upstream uninitialized-board error. |
| Garden Snake | [rembound/Snake-Game-HTML5](https://github.com/rembound/Snake-Game-HTML5/tree/91030dd3cbec5b88fd67887ce6a51e4f108eeed0) · `91030dd3cbec5b88fd67887ce6a51e4f108eeed0` | MIT | Local upstream runtime; sandbox compatibility adapter. |
| Pixel Snake | [janbodnar/JavaScript-Snake-Game](https://github.com/janbodnar/JavaScript-Snake-Game/tree/c8478561bdeb8b19c928a74a9d3c35e3a70f3153) · `c8478561bdeb8b19c928a74a9d3c35e3a70f3153` | BSD-2-Clause | Local upstream runtime; sandbox compatibility adapter. |
| Match Three | [rembound/Match-3-Game-HTML5](https://github.com/rembound/Match-3-Game-HTML5/tree/be7df47403668623ed40073fa87d39d9b4c7da2d) · `be7df47403668623ed40073fa87d39d9b4c7da2d` | MIT | Local upstream runtime; sandbox compatibility adapter. |
| Emoji Minesweeper | [muan/emoji-minesweeper](https://github.com/muan/emoji-minesweeper/tree/2187e371e9a0f87cf54a207031760fc33b858a9a) · `2187e371e9a0f87cf54a207031760fc33b858a9a` | MIT | Native emoji only: CDN Twemoji, service worker, analytics and web font removed. |
| Hexsweep | [kianPk/hexsweep](https://github.com/kianPk/hexsweep/tree/0c074dcaf443da4b77fccc91fcc9ed481bd12411) · `0c074dcaf443da4b77fccc91fcc9ed481bd12411` | MIT | Local upstream runtime; sandbox compatibility adapter. |
| Peg Solitaire | [gamelabz/html5-game-peg-solitaire](https://github.com/gamelabz/html5-game-peg-solitaire/tree/a4a9e26bd8a9cbd6c0436d511b9c3256957abf97) · `a4a9e26bd8a9cbd6c0436d511b9c3256957abf97` | MIT | Local upstream runtime; sandbox compatibility adapter. |
| Klondike Solitaire | [AashishChakravarty/solitaire](https://github.com/AashishChakravarty/solitaire/tree/f26b5c54eb260546b3eb1eabdbc6e83f361af42f) · `f26b5c54eb260546b3eb1eabdbc6e83f361af42f` | MIT | Local upstream runtime; sandbox compatibility adapter. |
| Blockrain | [Aerolab/blockrain.js](https://github.com/Aerolab/blockrain.js/tree/ba6d4192370d2ce4f75ce31796f345eb5711b489) · `ba6d4192370d2ce4f75ce31796f345eb5711b489` | MIT | Minimal first-party offline host; retains original game engine and local jQuery. |
| Little Breakout | [KilledByAPixel/LittleJS](https://github.com/KilledByAPixel/LittleJS/tree/42619bd28010fb50e400686dcd475eccbd053256) · `42619bd28010fb50e400686dcd475eccbd053256` | MIT | Upstream ES modules bundled as classic script; textures and level JSON inlined for opaque-origin and file:// play. |
| Little Gem Puzzle | [KilledByAPixel/LittleJS](https://github.com/KilledByAPixel/LittleJS/tree/42619bd28010fb50e400686dcd475eccbd053256) · `42619bd28010fb50e400686dcd475eccbd053256` | MIT | Upstream ES modules bundled as classic script; textures and level JSON inlined for opaque-origin and file:// play. |
| Little Platform Adventure | [KilledByAPixel/LittleJS](https://github.com/KilledByAPixel/LittleJS/tree/42619bd28010fb50e400686dcd475eccbd053256) · `42619bd28010fb50e400686dcd475eccbd053256` | MIT | Upstream ES modules bundled as classic script; textures and level JSON inlined for opaque-origin and file:// play. |
| Flappy Flight | [KilledByAPixel/LittleJS](https://github.com/KilledByAPixel/LittleJS/tree/42619bd28010fb50e400686dcd475eccbd053256) · `42619bd28010fb50e400686dcd475eccbd053256` | MIT | Playable upstream mini-game, not a separate repository. First-party standalone bootstrap. |
| Solo Paddle | [KilledByAPixel/LittleJS](https://github.com/KilledByAPixel/LittleJS/tree/42619bd28010fb50e400686dcd475eccbd053256) · `42619bd28010fb50e400686dcd475eccbd053256` | MIT | Playable upstream mini-game, not a separate repository. First-party standalone bootstrap. |
| Lunar Lander | [KilledByAPixel/LittleJS](https://github.com/KilledByAPixel/LittleJS/tree/42619bd28010fb50e400686dcd475eccbd053256) · `42619bd28010fb50e400686dcd475eccbd053256` | MIT | Playable upstream mini-game, not a separate repository. First-party standalone bootstrap. |
| Hill Glider | [KilledByAPixel/LittleJS](https://github.com/KilledByAPixel/LittleJS/tree/42619bd28010fb50e400686dcd475eccbd053256) · `42619bd28010fb50e400686dcd475eccbd053256` | MIT | Playable upstream mini-game, not a separate repository. First-party standalone bootstrap. |
| Grapple Run | [KilledByAPixel/LittleJS](https://github.com/KilledByAPixel/LittleJS/tree/42619bd28010fb50e400686dcd475eccbd053256) · `42619bd28010fb50e400686dcd475eccbd053256` | MIT | Playable upstream mini-game, not a separate repository. First-party standalone bootstrap. |
| Ball Track | [KilledByAPixel/LittleJS](https://github.com/KilledByAPixel/LittleJS/tree/42619bd28010fb50e400686dcd475eccbd053256) · `42619bd28010fb50e400686dcd475eccbd053256` | MIT | Playable upstream mini-game, not a separate repository. First-party standalone bootstrap. |
| 3D Dodge Arena | [KilledByAPixel/LittleJS](https://github.com/KilledByAPixel/LittleJS/tree/42619bd28010fb50e400686dcd475eccbd053256) · `42619bd28010fb50e400686dcd475eccbd053256` | MIT | Playable upstream mini-game, not a separate repository. First-party standalone bootstrap. |
| 3D Box Puzzle | [KilledByAPixel/LittleJS](https://github.com/KilledByAPixel/LittleJS/tree/42619bd28010fb50e400686dcd475eccbd053256) · `42619bd28010fb50e400686dcd475eccbd053256` | MIT | Playable upstream mini-game, not a separate repository. First-party standalone bootstrap. |
| 3D Circuit Racer | [KilledByAPixel/LittleJS](https://github.com/KilledByAPixel/LittleJS/tree/42619bd28010fb50e400686dcd475eccbd053256) · `42619bd28010fb50e400686dcd475eccbd053256` | MIT | Playable upstream mini-game, not a separate repository. First-party standalone bootstrap. |
| Sliding Eleven | [KilledByAPixel/LittleJS](https://github.com/KilledByAPixel/LittleJS/tree/42619bd28010fb50e400686dcd475eccbd053256) · `42619bd28010fb50e400686dcd475eccbd053256` | MIT | Playable upstream mini-game, not a separate repository. First-party bootstrap; sliding puzzle additionally shuffled and given win detection. |

## Additional notices and asset decisions

- Blockrain includes local jQuery 1.11.1 and the bundled jQuery UI widget factory (1.11.2); complete MIT texts are in JQUERY-LICENSE.txt and JQUERY-UI-LICENSE.txt, in addition to the Blockrain MIT license.
- LittleJS full license and COPYRIGHT.txt are preserved in each LittleJS game, including the upstream Box2D zlib-style notice even where unused engine functionality is bundled. Textures are the upstream LittleJS examples; no Flappy Bird artwork is imported. Audio is synthesized by the engine.
- Pixel Snake retains Jan Bodnar’s full BSD-2-Clause text and sprite assets distributed in that repository.
- Pong’s externally sourced sounds and Classic Tetris’s undocumented pop sound are omitted, not relicensed. Canvas Tetris’s performance overlay is replaced by a first-party no-op adapter.
- Emoji Minesweeper uses operating-system emoji, not a bundled third-party emoji font/artwork set.
- The remaining art consists of original repository assets or programmatic/CSS rendering covered by the retained repository notices; no external game/media downloads are required.

## Deliberate exclusions

- nebez/floppybird: upstream README discloses copied Flappy Bird graphics without permission.
- jakesgordon/javascript-breakout: sound assets carry CC BY-ND, outside this permissive-only selection.
- dwmkerr/spaceinvaders: classicgaming.cc sound provenance not adequately licensed for this bundle.
- jakesgordon/javascript-snakes: external font, stock watermark, music and effects have unclear redistribution scope.

## Offline operation and limitations

Serve the main application over HTTP (Vite or the production static build). The downloaded ZIPs contain games/<slug>/index.html plus their assets and licenses; extract before opening. The games are classic scripts rather than ES-module/CORS-dependent builds and are designed for extracted file:// use; the confirmed release smoke test uses HTTP-served script-only sandbox frames. A browser with JavaScript, canvas, and WebGL for LittleJS is required. Browser sound autoplay restrictions may require a click.

Game ZIPs are prebuilt and SHA-256 hashes are recorded in ZIP-MANIFEST.json. No runtime fetch of GitHub/CDNs is required. Optional games are not guaranteed to be service-worker-preloaded: offline launch in the hosted app requires its local files or a prior successful cache load. Downloading and extracting a ZIP is the reliable standalone offline route. Scores are session-only; refresh/close resets them.

SMOKE-TEST.json records startup and basic interaction checks, not complete playthroughs or cross-browser certification.


## First-party original games

The catalog also includes 75 original, locally authored browser mini-games in `games/original/` (25 focused mechanics, each with distinct rules, level structure, and scenario). They are explicitly labeled `first-party`, licensed MIT, and use the reusable local `engine.js` plus a per-game launcher/configuration. Their titles, descriptions, puzzles, and art are original. This collection is not affiliated with commercial games such as Drive Mad or BitLife and contains no copied names, artwork, questions, wording, game code, or unofficial downloads. Broad genres (physics driving, life choices, original trivia, and tower defense) informed some themes only.

Each original game has a standalone launcher, unique rules/scenario, keyboard and touch/mouse input where applicable, pause/restart, score/progress, deterministic seeded setup, and no external dependencies. Each per-game ZIP preserves `games/original/<slug>/index.html`, includes its shared-engine dependency at `games/original/engine.js`, a full MIT LICENSE, and README/attribution. `games/zips/original-games.zip` is a complete offline collection with a root `index.html` launcher and all relative paths preserved.

Original game count: 75. Combined catalog: 100 games (25 GitHub-sourced games + 75 first-party originals).


## First-party validation summary

The expanded catalog and every ZIP were checked for readable manifests, preserved entrypoint paths, included MIT license, and ZIP integrity. All 75 first-party launchers were opened in headless Chromium from `file://`; each initialized its canvas, configuration, status, and reset control with zero page errors. The Vite app menu reported 100 games; search found a first-party title; its iframe used `sandbox="allow-scripts"`; a game launched; and no non-local network requests or host page errors were observed. This was a smoke test, not a full playthrough of all possible levels, accessibility certification, or cross-browser QA.
