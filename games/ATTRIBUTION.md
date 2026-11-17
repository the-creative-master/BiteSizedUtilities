# Offline game sources, licenses and audit

68 real playable open-source HTML5 games fetched directly from GitHub repositories (zero custom or synthetic games).

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


## Additional real games fetched from GitHub

| Game | Source | License | Notes |
| --- | --- | --- | --- |
| Chrome Dino Runner | [wayou/t-rex-runner](https://github.com/wayou/t-rex-runner) | BSD-3-Clause | Fetched directly from https://github.com/wayou/t-rex-runner (BSD-3-Clause). Runs offline in sandboxed iframe. |
| Floppy Bird | [nebez/floppybird](https://github.com/nebez/floppybird) | Apache-2.0 | Fetched directly from https://github.com/nebez/floppybird (Apache-2.0). Runs offline in sandboxed iframe. |
| Hextris | [Hextris/hextris](https://github.com/Hextris/hextris) | GPL-3.0 | Fetched directly from https://github.com/Hextris/hextris (GPL-3.0). Runs offline in sandboxed iframe. |
| OutRun Racer | [jakesgordon/javascript-racer](https://github.com/jakesgordon/javascript-racer) | MIT | Fetched directly from https://github.com/jakesgordon/javascript-racer (MIT). Runs offline in sandboxed iframe. |
| Gauntlet Dungeon | [jakesgordon/javascript-gauntlet](https://github.com/jakesgordon/javascript-gauntlet) | MIT | Fetched directly from https://github.com/jakesgordon/javascript-gauntlet (MIT). Runs offline in sandboxed iframe. |
| Delta Space Shooter | [jakesgordon/javascript-delta](https://github.com/jakesgordon/javascript-delta) | MIT | Fetched directly from https://github.com/jakesgordon/javascript-delta (MIT). Runs offline in sandboxed iframe. |
| Snakes & Ladders | [jakesgordon/javascript-snakes](https://github.com/jakesgordon/javascript-snakes) | MIT | Fetched directly from https://github.com/jakesgordon/javascript-snakes (MIT). Runs offline in sandboxed iframe. |
| Astray 3D Maze | [wwwtyro/Astray](https://github.com/wwwtyro/Astray) | Unlicense | Fetched directly from https://github.com/wwwtyro/Astray (Unlicense). Runs offline in sandboxed iframe. |
| A Dark Room | [doublespeakgames/adarkroom](https://github.com/doublespeakgames/adarkroom) | MPL-2.0 | Fetched directly from https://github.com/doublespeakgames/adarkroom (MPL-2.0). Runs offline in sandboxed iframe. |
| Tower Bloxx | [iamkun/tower_game](https://github.com/iamkun/tower_game) | MIT | Fetched directly from https://github.com/iamkun/tower_game (MIT). Runs offline in sandboxed iframe. |
| Pac-Man Classic | [mumuy/pacman](https://github.com/mumuy/pacman) | MIT | Fetched directly from https://github.com/mumuy/pacman (MIT). Runs offline in sandboxed iframe. |
| Star Battle | [gd4Ark/star-battle](https://github.com/gd4Ark/star-battle) | MIT | Fetched directly from https://github.com/gd4Ark/star-battle (MIT). Runs offline in sandboxed iframe. |
| HTML5 Asteroids | [dmcinnes/HTML5-Asteroids](https://github.com/dmcinnes/HTML5-Asteroids) | MIT | Fetched directly from https://github.com/dmcinnes/HTML5-Asteroids (MIT). Runs offline in sandboxed iframe. |
| Bubble Shooter | [rembound/Bubble-Shooter-HTML5](https://github.com/rembound/Bubble-Shooter-HTML5) | MIT | Fetched directly from https://github.com/rembound/Bubble-Shooter-HTML5 (MIT). Runs offline in sandboxed iframe. |
| 2048 Cupcakes | [0x0800/2048-CUPCAKES](https://github.com/0x0800/2048-CUPCAKES) | MIT | Fetched directly from https://github.com/0x0800/2048-CUPCAKES (MIT). Runs offline in sandboxed iframe. |
| Block Blast | [dffge552/block-blast](https://github.com/dffge552/block-blast) | MIT | Fetched directly from https://github.com/dffge552/block-blast (MIT). Runs offline in sandboxed iframe. |
| Pinball Arcade | [gamelabz/html5-game-pinball](https://github.com/gamelabz/html5-game-pinball) | MIT | Fetched directly from https://github.com/gamelabz/html5-game-pinball (MIT). Runs offline in sandboxed iframe. |
| Air Hockey | [gamelabz/html5-game-air-hockey](https://github.com/gamelabz/html5-game-air-hockey) | MIT | Fetched directly from https://github.com/gamelabz/html5-game-air-hockey (MIT). Runs offline in sandboxed iframe. |
| Mini Golf | [gamelabz/html5-game-mini-golf](https://github.com/gamelabz/html5-game-mini-golf) | MIT | Fetched directly from https://github.com/gamelabz/html5-game-mini-golf (MIT). Runs offline in sandboxed iframe. |
| Connect Four | [gamelabz/html5-game-connect-four](https://github.com/gamelabz/html5-game-connect-four) | MIT | Fetched directly from https://github.com/gamelabz/html5-game-connect-four (MIT). Runs offline in sandboxed iframe. |
| Checkers | [gamelabz/html5-game-checkers](https://github.com/gamelabz/html5-game-checkers) | MIT | Fetched directly from https://github.com/gamelabz/html5-game-checkers (MIT). Runs offline in sandboxed iframe. |
| Endless Runner | [gamelabz/html5-game-endless-runner](https://github.com/gamelabz/html5-game-endless-runner) | MIT | Fetched directly from https://github.com/gamelabz/html5-game-endless-runner (MIT). Runs offline in sandboxed iframe. |
| Balloon Pop | [gamelabz/html5-game-balloon-pop](https://github.com/gamelabz/html5-game-balloon-pop) | MIT | Fetched directly from https://github.com/gamelabz/html5-game-balloon-pop (MIT). Runs offline in sandboxed iframe. |
| Nonogram Picross | [gamelabz/html5-game-nonogram](https://github.com/gamelabz/html5-game-nonogram) | MIT | Fetched directly from https://github.com/gamelabz/html5-game-nonogram (MIT). Runs offline in sandboxed iframe. |
| Color Flood | [gamelabz/html5-game-color-flood](https://github.com/gamelabz/html5-game-color-flood) | MIT | Fetched directly from https://github.com/gamelabz/html5-game-color-flood (MIT). Runs offline in sandboxed iframe. |
| Dots & Boxes | [gamelabz/html5-game-dots-and-boxes](https://github.com/gamelabz/html5-game-dots-and-boxes) | MIT | Fetched directly from https://github.com/gamelabz/html5-game-dots-and-boxes (MIT). Runs offline in sandboxed iframe. |
| Platform Jump | [gamelabz/html5-game-platform-jump](https://github.com/gamelabz/html5-game-platform-jump) | MIT | Fetched directly from https://github.com/gamelabz/html5-game-platform-jump (MIT). Runs offline in sandboxed iframe. |
| Memory Cards | [gamelabz/html5-game-memory-cards](https://github.com/gamelabz/html5-game-memory-cards) | MIT | Fetched directly from https://github.com/gamelabz/html5-game-memory-cards (MIT). Runs offline in sandboxed iframe. |
| Hangman | [gamelabz/html5-game-hangman](https://github.com/gamelabz/html5-game-hangman) | MIT | Fetched directly from https://github.com/gamelabz/html5-game-hangman (MIT). Runs offline in sandboxed iframe. |
| Neon Pacman | [gamelabz/html5-game-pacman](https://github.com/gamelabz/html5-game-pacman) | MIT | Fetched directly from https://github.com/gamelabz/html5-game-pacman (MIT). Runs offline in sandboxed iframe. |
| Brick Breaker | [gamelabz/html5-game-brick-breaker](https://github.com/gamelabz/html5-game-brick-breaker) | MIT | Fetched directly from https://github.com/gamelabz/html5-game-brick-breaker (MIT). Runs offline in sandboxed iframe. |
| Space Asteroids | [gamelabz/html5-game-asteroids](https://github.com/gamelabz/html5-game-asteroids) | MIT | Fetched directly from https://github.com/gamelabz/html5-game-asteroids (MIT). Runs offline in sandboxed iframe. |
| Math Master Quiz | [gamelabz/html5-game-math-master](https://github.com/gamelabz/html5-game-math-master) | MIT | Fetched directly from https://github.com/gamelabz/html5-game-math-master (MIT). Runs offline in sandboxed iframe. |
| Gomoku | [gamelabz/html5-game-gomoku](https://github.com/gamelabz/html5-game-gomoku) | MIT | Fetched directly from https://github.com/gamelabz/html5-game-gomoku (MIT). Runs offline in sandboxed iframe. |
| Aim Trainer | [gamelabz/html5-game-aim-trainer](https://github.com/gamelabz/html5-game-aim-trainer) | MIT | Fetched directly from https://github.com/gamelabz/html5-game-aim-trainer (MIT). Runs offline in sandboxed iframe. |
| Fruit Catcher | [gamelabz/html5-game-fruit-catcher](https://github.com/gamelabz/html5-game-fruit-catcher) | MIT | Fetched directly from https://github.com/gamelabz/html5-game-fruit-catcher (MIT). Runs offline in sandboxed iframe. |
| Keepy Up | [gamelabz/html5-game-keepy-up](https://github.com/gamelabz/html5-game-keepy-up) | MIT | Fetched directly from https://github.com/gamelabz/html5-game-keepy-up (MIT). Runs offline in sandboxed iframe. |
| Cozy Bubble Pop | [gamelabz/html5-game-bubble-shooter](https://github.com/gamelabz/html5-game-bubble-shooter) | MIT | Fetched directly from https://github.com/gamelabz/html5-game-bubble-shooter (MIT). Runs offline in sandboxed iframe. |
| Color Match | [gamelabz/html5-game-color-match](https://github.com/gamelabz/html5-game-color-match) | MIT | Fetched directly from https://github.com/gamelabz/html5-game-color-match (MIT). Runs offline in sandboxed iframe. |
| Click The Target | [gamelabz/html5-game-click-the-target](https://github.com/gamelabz/html5-game-click-the-target) | MIT | Fetched directly from https://github.com/gamelabz/html5-game-click-the-target (MIT). Runs offline in sandboxed iframe. |
| Number Guess | [gamelabz/html5-game-number-guess](https://github.com/gamelabz/html5-game-number-guess) | MIT | Fetched directly from https://github.com/gamelabz/html5-game-number-guess (MIT). Runs offline in sandboxed iframe. |
| Flappy Canvas | [gamelabz/html5-game-flappy-bird](https://github.com/gamelabz/html5-game-flappy-bird) | MIT | Fetched directly from https://github.com/gamelabz/html5-game-flappy-bird (MIT). Runs offline in sandboxed iframe. |
| Match 3 Gems | [gamelabz/html5-game-match-3](https://github.com/gamelabz/html5-game-match-3) | MIT | Fetched directly from https://github.com/gamelabz/html5-game-match-3 (MIT). Runs offline in sandboxed iframe. |
