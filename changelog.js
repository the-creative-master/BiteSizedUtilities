import { uiIconSVG } from './icons-25d.js';
import { isBackupBuild } from './build-mode.js';

/**
 * The kitchen's release notes. Newest first — `openChangelog()` renders them
 * top to bottom exactly in this order, so 1.1 sits above 1.0.1 above 1.0.
 *
 * Two lists live here on purpose:
 *
 *   CHANGELOG  every public release. This is all index.html ever shows.
 *   TVAR_LOG   extended minor versions built *after* a release, shown only in
 *              the backup kitchen. TVAR means "test version after release", so
 *              1.1 TVAR 1 is the first test build made on top of 1.1. The
 *              counter resets with each public release, and nothing about it is
 *              mentioned on the public page — there it is simply 1.1.
 *
 *
 * This lives in the app rather than only in the repo's README on purpose:
 * visitors on GitHub Pages never see repo files, and the release notes belong
 * where the kitchen is.
 */
export const APP_VERSION = '1.2.6';

/** Test versions built after 1.2 shipped. Reset to 0 on every public release. */
export const TVAR = 4;

/**
 * The release cycle the open test build belongs to.
 *
 * Its own constant rather than APP_VERSION, because the two are not the same
 * string any more: 1.2.1 is what the public kitchen reports, while the backup
 * kitchen is still testing on top of 1.2. Deriving the extended label from
 * APP_VERSION would have announced "1.2.6 TVAR 1" — a build that has never
 * existed — and renumbered the entry below it that documents the one that has.
 */
export const TVAR_CYCLE = '1.2';

/** `1.2 TVAR 4` — the extended label, used only while a test version is open. */
export const APP_VERSION_EXTENDED = `${TVAR_CYCLE} TVAR ${TVAR}`;

/** What the footer of the changelog should call this build. */
export function appVersionLabel() {
  // TVAR 0 means "no test version is open", so both builds report the release.
  return isBackupBuild() && TVAR > 0 ? APP_VERSION_EXTENDED : APP_VERSION;
}

/**
 * Extended minor versions, newest first, backup kitchen only. Each one is a
 * real build a person can open, so each one documents what changed in it and
 * what is known to be rough — that is the whole point of writing them down.
 */
export const TVAR_LOG = [
  {
    version: '1.2 TVAR 4',
    date: 'November 23, 2026',
    title: 'FOLDER-KITCHEN: the archive\u2019s index.html opens into the kitchen',
    tvar: true,
    groups: [
      {
        label: '\u{1F9C7} What this build corrects',
        items: [
          'The last test build shipped an archive whose index.html explained itself instead of being the kitchen. Double-clicking it gave a card about file: pages and a wall of instructions, with a terminal command at the bottom of it \u2014 and a download that cannot be opened without reading it first is a download most people will not open at all.',
          'Worse, the instructions assumed a tool. Every route it offered into the site needed Python 3, and a person on a machine without it \u2014 which is most machines that are not a developer\u2019s \u2014 had nothing left to try. Not everybody has a shell ready, and nothing about opening a folder should require one.',
          'So the archive now carries a second copy of the kitchen, built the one way a browser will still run off the disk, and its index.html picks between the two by looking at how it was opened. Off the disk it starts the folder build; served over http it starts the real module app. One tap, either way, and no prerequisite software in either branch.'
        ]
      },
      {
        label: '\u{1F50C} The folder build, and why it is a different build',
        items: [
          'npm run build:classic makes dist-classic/kitchen.js: the whole kitchen as one classic script, about 1 MB, plus its own kitchen.css. A browser refuses an ES module from a file: page, refuses a worker from one, and refuses a fetch of the file beside it \u2014 and a classic script is the one thing left that runs. That is not a setting or a polyfill; it is the same rule in every browser.',
          'The AI engines are aliased out of it, and that is what keeps it at a megabyte. onnxruntime-web carries its WASM binaries inside its own JavaScript as base64, and inlining every dynamic import into one script would have pulled 190 MB of them along. Waffle AI therefore reports itself unavailable in the folder build rather than pretending, and says so in the same words it uses when a network is missing.',
          'The game catalog is bundled instead of fetched, which is the difference between a games cupboard and an error. From a file: page the fetch is refused and the cupboard reads \u201cUnable to load the offline arcade\u201d in the one place where an empty arcade is most confusing \u2014 a folder holding all 51 games. The served build keeps fetching it, through an alias that resolves the same import to null, so its 32 KB stays lazy.'
        ]
      },
      {
        label: '\u{1F3AE} What a folder gives you now, measured',
        items: [
          'The kitchen, all 115 utilities on its shelves, 85 of them working outright \u2014 the maths, science, text, art, music and video cupboards, whose modules contain no fetch and no worker at all \u2014 the games cupboard listing all 51 games, and 26 of those games playable on tap. The game count is not a guess: each cabinet page was read and classified by whether it fetches, uses a worker, loads a module or pulls in WASM, and 26 of them are a whole game in one page with nothing else to read.',
          'The other 25 games read their own files as they load, which is the one refusal the folder build cannot work around. They are in the archive and they are listed in the cupboard; they open properly once the folder is served.',
          'Three groups stay asleep, and each is named rather than waved at: the whole English & Languages cupboard, because 14 of its 15 tools ask Waffle AI and the fifteenth calls a translation API; CodeHub, JavaScript and Web, because they run your code in a worker, the rest of that cupboard being among the 85; and Waffle AI itself, along with the other 25 games. Each of them says why instead of failing quietly, and nothing here needs a network, an account, or anything installed.'
        ]
      },
      {
        label: '\u{1F5A5} The server is still there, and still optional',
        items: [
          'start-server.bat, start-server.command and start-server.sh are unchanged: Python 3, bound to 127.0.0.1, port 8123, stopping when the window closes. Serving the folder lifts every refusal at once, and the same index.html then loads the full site \u2014 all 51 games, the runtimes, and Waffle AI on the weights that came in the archive.',
          'What changed is its place in the instructions. It is no longer the price of admission and it is no longer the first thing the archive says. START-HERE.html and README.txt now lead with the tap, list what works without a server, and offer the server as one double-click for the rest.',
          'A phone or tablet still cannot run a local server without a third-party app, and this build does not pretend otherwise. It can open index.html and get the kitchen and the games that work from a folder \u2014 though a tablet\u2019s file manager picks the browser, and some of those refuse local files outright. Where the site itself was already visited, its own offline mode remains the better route there.'
        ]
      },
      {
        label: '\u{1F9EA} How it is proven, not assumed',
        items: [
          'The archive is unzipped and booted. A test takes index.html, kitchen.js and kitchen.css out of the finished zip into a temporary folder, opens the first as a file: URL with a real DOM doing the loading, and asserts the kitchen rendered, that the games cupboard opened onto shelves, and that neither the hiccup card nor the old explanation is anywhere in the mount point.',
          'The picker itself is checked in the archive rather than in the staging directory, because replacing an entry is exactly the kind of thing zip can quietly not do. Both of its branches are asserted on, since only one of them runs in a test and the other is the live site.',
          'The packer refuses to run at all without dist-classic/kitchen.js, and the workflow builds it before it packs. The file count in the stamped docs counts the folder build\u2019s two files now, which it did not, and the weights sentence says \u201c1 file\u201d instead of \u201c1 files\u201d.'
        ]
      }
    ]
  },
  {
    version: '1.2 TVAR 3',
    date: 'November 23, 2026',
    title: 'OFFLINE-ZIP: the entire site as one download, and the single file retired',
    tvar: true,
    groups: [
      {
        label: '\u{1F9C7} What this build is for',
        items: [
          'The single HTML file from the last test build is gone \u2014 the config that made it, the stub that kept the AI engines out of it, the flag that folded it, the button that downloaded it and the tests that pinned it. In its place there is one download and one button: the entire site as a zip.',
          'A zip is the honest shape for this site. The single file could only ever hold what a browser will run from a folder, which is the tools and nothing else; the zip holds every game, runtime and model weight, and the price is that it has to be served rather than double-clicked.'
        ]
      },
      {
        label: '\u{1F4E6} What is in the archive',
        items: [
          'Every file the site serves, unpacked at the archive root so extracting gives a folder you can use rather than one you have to rearrange: the built app, all 51 games, the CodeHub runtimes and their WASM, both ONNX runtimes, the GGUF engine, the fonts, the icons, the service worker, and the model weights Waffle AI runs on.',
          'Measured rather than estimated. Without the weights it is 209 files, 338 MB extracted, 139 MB to download \u2014 41 percent, because WASM compresses to about a quarter of itself and the games only to about two thirds, being single-file pages with their assets already encoded inside them. With the weights a deploy ships roughly 224 MB.',
          'Packed in 29 seconds by npm run zip:offline, which is scripts/make-offline-zip.mjs reading dist/ after the build has copied the weights into it. That ordering is the whole trick: the weights are in dist/ because the build put them there, which is what makes this an offline archive rather than a copy of the source.'
        ]
      },
      {
        label: '\u{1F5A5} Why it needs a computer, said plainly',
        items: [
          'A browser refuses three things from a file: page \u2014 an ES module, a worker, and one page opening another. Between them those are the kitchen, the code runtimes and every game. Nothing written into the archive can change that, so the archive explains it instead: START-HERE.html opens from a folder, says which of the two situations you are in, and gives the one command that ends it.',
          'start-server.bat, start-server.command and start-server.sh each need Python 3, serve the folder to 127.0.0.1 only, on port 8123, and stop when their window closes. The executable bits are stored in git, so a double-click still works after extracting.',
          'Two caveats are written into the archive rather than left to be discovered. Threaded WASM runs one thread deep, because shared-memory threads need cross-origin isolation headers that python http.server cannot send, and the site detects that and drops a thread instead of failing. And a phone or tablet cannot do the serving at all without a third-party app, so this download is for a computer.'
        ]
      },
      {
        label: '\u{1F527} How it is published, and why not on the site',
        items: [
          'The archive is a GitHub release asset under the offline-zip tag, rebuilt and replaced on every deploy to main. At 224 MB, shipping it inside the site would have taken Pages from 437 MB to 661 MB against a 1 GB soft limit, re-uploaded it on every deploy, and served every download out of the site\u2019s own 100 GB a month \u2014 roughly 440 downloads. A release asset costs the site nothing and allows 2 GB.',
          'The button works out the URL from the Pages origin instead of hardcoding it, so a fork points at its own archive rather than handing out somebody else\u2019s. The size on the button is fetched from offline-zip.json, which the packer writes into dist/ after closing the archive, because no build step can know the number before the file exists.',
          'The archive is listed back and checked once it is built: sixteen required entries, plus the weights when the build has any. zip reports success on a directory missing half its contents, and that failure would only surface on somebody\u2019s machine weeks later.'
        ]
      },
      {
        label: '\u{1F9EA} What was checked, and what it caught',
        items: [
          'The archive was extracted into a scratch folder and start-server.sh was run on it, exactly as the instructions say. Then every cross-reference in the folder was resolved over http: all 28 service-worker precache entries, all 51 game entrypoints, and the runtimes including the Luau and Bash vendor binaries. All of them answer 200.',
          'START-HERE.html was booted in jsdom twice, at a file: URL and at an http one, because it shows a different page in each and both halves have to be right. index.html was booted from the extracted folder too, and its explanation now points at START-HERE.html instead of a file that no longer exists.',
          'It caught one bug of its own making: the packer writes offline-zip.json into dist/, so a second run packed the previous run\u2019s metadata into the next archive, stale and quoting the wrong size. The file is now deleted before packing and rewritten after. A first check that grepped the archive for the words import.meta also had to go \u2014 the release notes describe that trap, so the words are legitimately in there.'
        ]
      }
    ]
  },
  {
    version: '1.2 TVAR 2',
    date: 'November 23, 2026',
    title: 'OFFLINE-HTML-TEST: the whole kitchen in one file, and a folder that stops hiccupping',
    tvar: true,
    groups: [
      {
        label: '\u{1F9C7} What this build is for',
        items: [
          'One addition and one repair, and nothing else. The addition is a button in this kitchen that hands you the entire site as a single HTML file. The repair is that opening an unzipped copy of the site from a folder no longer produces a Waffle Kitchen hiccup.',
          'The public kitchen is untouched: same version, same model menu, same behaviour. The offline file is mentioned in this entry and in this kitchen only, because it is a test of a build shape and not a feature yet.'
        ]
      },
      {
        label: '\u2B07 The offline file',
        items: [
          'About 1.2 MB, one document: every tool, the stylesheet and all the fonts inlined as data URLs. There is nothing left to fetch, so it works from a folder with no server, no network and no neighbouring files.',
          'It is a classic script and not a module, which is the whole trick. A browser refuses an ES module from a file: page outright, and that refusal is exactly what an unzipped site runs into.',
          'npm run build:offline makes it from vite.offline.config.js. That is a second config rather than a third input to the first one, because Rollup will only inline dynamic imports when there is a single entry and the output format is not a module.'
        ]
      },
      {
        label: '\u{1F6AB} What it refuses, and why',
        items: [
          'Waffle AI, image generation, the CodeHub runtimes and the games are not in this file and say so. Their weights are downloaded, their engines are workers and WASM, and a file: page gets no cross-origin isolation, so none of them could run even if they were inlined. Every ordinary tool works.',
          'The reason is a single folded flag: globalThis.__WAFFLE_OFFLINE__ becomes true in this build, and each guard sits immediately before the await import() it protects. onnxruntime-web carries its WASM inside its own JavaScript as base64, so the first attempt measured 190 MB. The guards, plus a stub that the three vendor packages resolve to, brought it to 1.2 MB.',
          'That stub is the guarantee behind the guards. A guard that is missed, or a new import site added later without anyone remembering, now costs a refusal that explains itself instead of a 179 MB HTML file.'
        ]
      },
      {
        label: '\u{1F9EA} How it was checked',
        items: [
          'The built file was booted in jsdom at a file: URL instead of being read. That is what caught a temporal dead zone in the flattened bundle, where an exported constant was hoisted above the declaration it aliased and killed the kitchen before it rendered. No source-level check can see that, because the source is correct.',
          'The build now fails rather than warns if the artifact contains base64 WASM, a script with a src, a stylesheet or manifest to fetch, a module script, or import.meta. Those five are precisely what breaks a page opened from a folder.',
          'An unzipped source folder is answered by index.html itself: on a file: page and only there, it replaces its own contents with a short explanation and a link to the offline kitchen, instead of showing a hiccup that blames the visitor.'
        ]
      }
    ]
  },
  {
    version: '1.2 TVAR 1',
    date: 'November 22, 2026',
    title: 'Eight models, tighter quants, and a door that is not a gesture',
    tvar: true,
    groups: [
      {
        label: '\u{1F9EA} What this build is for',
        items: [
          'This is the release plus a tighter model menu and a new way in, and nothing else. The public kitchen at 1.2.1 still offers five models; the eight below are here so reliability can be compared across a wider set before anybody is asked to live with it.',
          'Everything in here is a decision that can be reversed by editing one list. If a model turns out to be a dead end on a real device, it comes off the list and the table keeps the entry.'
        ]
      },
      {
        label: '\u{1F916} The tighter model set',
        items: [
          'Eight, each one limited to the quantisations it may be fetched at: SmolLM2 135M and SmolLM2 360M at full 16-bit and nothing less; Qwen 2.5 0.5B and Qwen 3 0.6B at 4, 5 or 6 bit; Qwen 3.5 0.8B, Falcon 3 1B and Qwen 2.5 1.5B at 3, 4, 5 or 6 bit; SmolLM2 1.7B anywhere from 2 bit to 6, because the first question about the biggest model here is whether it fits at all.',
          'A range is what may be used, not what is preferred: each model still leads with the quantisation that has actually been tested, so widening a list cannot quietly downgrade the model somebody gets. SmolLM2 1.7B still asks for Q4_K_M first and may fall as low as Q2_K; the two Qwen models went the other way, because 3-bit is outside the range they were given and 4-bit is better than what they were doing.',
          'The range is a limit, not a preference order with a fallback behind it. A repository that publishes none of the allowed quants fails out loud instead of being served something the range excluded.',
          'Falcon 3 1B is new, and GGUF-only: no ONNX repository for it is being claimed here, because a guessed one costs a failed attempt on the device before the runtime that would have worked gets its turn.',
          'SmolLM2 360M went from a 170 MB 3-bit file to a 720 MB 16-bit one. That is over the ceiling for shipping weights inside the site, so it always downloads from Hugging Face on first use.',
          'Every size in the table except two is arithmetic from parameter counts, not a measurement \u2014 the sandbox these were written in cannot reach Hugging Face. The repository tree prices the real file before anything downloads, and the source report on the device shows the measured number.',
          'Granite Code 0.5B is in the table and on no menu. It is reserved for CodeHub\u2019s error diagnostics, it has no repository entry yet, and it is the model those diagnostics wait for.'
        ]
      },
      {
        label: '\u{1F6AA} The door',
        items: [
          'The tap gesture is gone. A fast run of taps on Sir Waffle was a door anybody could be told about and anybody could hit by accident while bouncing the waffle wall, and it navigated to an address that sat in the bundle in plain text.',
          'This build is not on the host under its own name any more. It ships as DONTASKMEWHATTHATIS.txt \u2014 a few kilobytes of what looks like obfuscated build junk \u2014 and the built page inside it is ciphertext. The address that used to open it returns a 404.',
          'The way in is a string typed at Waffle AI. That string is also the key the file was encoded with, so the file is useless without it and the string appears nowhere in the source or the bundle as text.',
          'Be clear about what that buys. A static site has nowhere to keep a secret: the key ships next to the ciphertext, so this is obfuscation and not encryption, and somebody determined can recover the string by running the bundle\u2019s own decoder. What it does stop is grepping, viewing source, guessing the address, and stumbling in.'
        ]
      },
      {
        label: '\u{26A0}\u{FE0F} Known rough edges',
        items: [
          'After the door opens, the address bar says the page it always said \u2014 and reloading that address gets a 404, because there is no file there. Type the string again.',
          'The door hands the decoded page to the next load rather than mounting it in place, because both kitchens are built from the same module and a document evaluates a module URL once. In a browser that refuses sessionStorage it falls back to mounting here, which re-runs the page with this one\u2019s document-level listeners still attached \u2014 so a wall bounce can fire twice. That path is the exception, not the plan.',
          'The repository path for Falcon 3 1B has not been verified against Hugging Face. If it is wrong, the source report says "not found" and names the repository it tried.',
          'The self-hosting budget is unchanged, so a deploy still ships only SmolLM2 135M from its own origin. Everything else on this menu downloads on first use.'
        ]
      }
    ]
  },
  {
    // The newest entry always spells the counter out literally, and a test
    // pins it to APP_VERSION_EXTENDED, so history cannot quietly renumber
    // itself when the counter moves.
    version: '1.1 TVAR 3',  // history: a test build of the 1.1 cycle
    date: 'November 20, 2026',
    title: 'The one that knows what a Huawei tablet is',
    tvar: true,
    groups: [
      {
        label: '\u{1F41B} What was actually wrong',
        items: [
          'The kitchen asked a device two questions \u2014 "is there a WebGPU adapter?" and "is it an iPhone?" \u2014 and treated every other answer as a desktop browser. On a Huawei MatePad that is wrong in both directions. Chromium shipped WebGPU on desktop in 113 but on Android only in 144, and ArkWeb is Chromium 114\u2013144 depending on the HarmonyOS version, so an adapter handed back there is not proof of one. A runtime that tries it first can hang the tab instead of failing cleanly.',
          'Every device got the same order: ONNX WebGPU \u2192 WLlama with GPU layers \u2192 WLlama on the CPU \u2192 ONNX WASM. On a tablet whose GPU cannot be trusted, that puts the least reliable runtime first and the most reliable one third, so two failures were watched before anything had a chance to work.',
          'The memory budget was a desktop number. HarmonyOS and Android reap a tab whose WebAssembly heap grows into the system\u2019s way, and those browsers rarely report deviceMemory at all \u2014 so the kitchen chose models that downloaded perfectly and died during load, which reads as a broken model rather than a tight one.',
          'And nothing said which browser this actually was. A failure report from a MatePad and one from a Windows desktop looked identical, while their causes were different.'
        ]
      },
      {
        label: '\u{1F9E0} What the NPU question turned out to be',
        items: [
          'The Kirin NPU cannot be reached from a web page \u2014 not by this kitchen, and not by any page in any browser. The one web API that can address an NPU is WebNN; Chrome\u2019s implementation is a desktop origin trial (M147\u2013M149) with Android explicitly excluded, and ArkWeb and Huawei Browser do not ship it. On HarmonyOS the NPU belongs to native apps through HiAI and MindSpore Lite, and a web page has no door to it.',
          'What changed is that the door is now wired properly, and the kitchen says plainly whether it is open. `navigator.ml` is detected; where a browser does expose WebNN \u2014 with JSPI, and with an ONNX runtime that contains the provider \u2014 the NPU is tried *first*, ahead of the GPU. Where it does not, the report and the AI panel say so in words instead of leaving the visitor to guess why an NPU-equipped tablet is running on its CPU.',
          'The ONNX WebNN provider lives in onnxruntime-web\u2019s JSPI build, about 18 MB. Sending that to every visitor for a path no phone can take would be dead weight, so `WAFFLE_WEBNN=1 npm run build` ships the runtime and switches the NPU path on; the default build carries neither.',
          'The AI panel now shows the profile it recognised: browser and Chromium baseline, adapter status and trust, the NPU sentence, WASM SIMD, threading, heap budget and on-device storage. When AI fails on a Huawei tablet, that block is the part that explains why \u2014 and it is what a pasted report carries home.'
        ]
      },
      {
        label: '\u{1F527} What changed for Huawei and HarmonyOS tablets',
        items: [
          'A real platform profile is read from the user agent: HarmonyOS/OpenHarmony version, ArkWeb version, Huawei Browser version, HMS Core, the device model in either form Huawei uses ("HUAWEI MatePad Pro 13.2" and the CTR-LX3 style codes), phone/tablet/TV, and the Chromium baseline \u2014 including Huawei\u2019s own ArkWeb mapping (4.1\u20135.1 \u2192 M114, 6.0/6.1 \u2192 M132, 7.0 \u2192 M144) for the user agents that carry no Chrome token, and the bare engine version some Huawei builds print instead of one.',
          'A WebGPU adapter is graded rather than merely detected: `verified` on desktop and on Android Chromium 144+, `suspect` below that, `absent` when there is none. Suspect does not mean removed \u2014 it means tried *last*, after the CPU runtimes, so a hang cannot cost the whole chain.',
          'The order now comes from the device. `rankBrowserAttempts()` returns NPU \u2192 GPU \u2192 CPU on a verified one and NPU \u2192 CPU \u2192 GPU on a suspect one, and asking for WebGPU explicitly in Settings still forces GPU first, because that is what was asked for.',
          'WASM SIMD is probed with a real module instead of assumed, since both llama.cpp and ONNX Runtime need it and an engine without it fails in ways that look like a corrupt download.',
          'The heap budget on a phone or tablet with no verified GPU keeps a wider margin \u2014 35% of reported memory, capped at 1.8 GB \u2014 because a model that fits beats a bigger one that gets the tab reaped.',
          'A device that cannot be recognised is reported as an unknown platform and falls back to the old conservative order, rather than being given a guess.'
        ]
      },
      {
        label: '\u{26A0}\u{FE0F} Known rough edges',
        items: [
          'No current phone or tablet browser exposes WebNN, so a MatePad runs on its CPU (or its GPU, when WebGPU is real). That is slower than the silicon is capable of, and no web page can change it \u2014 the honest fix is a native app.',
          'The profile is read from a user agent, which a browser can rewrite, trim or omit. In-app ArkWeb views (Lark, WeChat) announce themselves differently from Huawei Browser, and both are handled, but a browser that hides its version simply gets the conservative path.',
          'The ArkWeb\u2192Chromium mapping is Huawei\u2019s documented one, not a measurement of the device in front of you; a vendor build can differ from the baseline it claims.'
        ]
      }
    ]
  },
  {
    version: '1.1 TVAR 2',  // history: a test build of the 1.1 cycle
    date: 'November 19, 2026',
    title: 'The one that stops freezing, and stops blaming your network',
    tvar: true,
    groups: [
      {
        label: '\u{1F41B} What was actually wrong',
        items: [
          'Waffle AI would answer one question and then freeze on the next. The tab stayed open, the input stayed greyed out, and no error ever appeared, which made it look like the model had died. The model was fine.',
          'A browser runtime answers one request at a time. WLlama holds a single inference slot per loaded model and only releases it when its own loop finishes or its own abort fires. Walking away from a stream \u2014 pressing Stop, closing the dialog, an engine error halfway through a reply \u2014 left that slot occupied, so the next prompt queued behind a runtime that was still busy with the one before it.',
          'Nothing in the whole fallback chain had a timeout. That is what turned a wait into a freeze: the flag that disables the composer is only cleared when a reply finishes, and that reply was never going to finish.',
          'A wedged runtime was also reused. The kitchen kept the loaded model between questions to save a reload, which is right for a healthy one and exactly wrong for one that stopped answering.'
        ]
      },
      {
        label: '\u{1F527} What changed',
        items: [
          'Stop now really stops. The abort signal is handed to WLlama itself, which cancels the request and releases the slot instead of generating into a queue nobody is reading any more.',
          'A runtime that was walked away from is thrown away rather than reused, so the next question starts on a clean worker instead of inheriting a busy one.',
          'Only one inference runs at a time anywhere in the kitchen. The chat, CodeHub\u2019s AI Error Diagnostics and the AI writing tools now share a single queue, so two overlapping requests can no longer deadlock each other.',
          'Every attempt is watched for silence instead of for total time, with two windows because the phases fail differently: up to four minutes before the first token (downloading, compiling WASM and shaders \u2014 slow, but it reports progress), and 45 seconds once text is streaming, because a reply that goes quiet mid-sentence for 45 seconds is not thinking.',
          'When the watchdog fires it says so in the reply \u2014 which runtime went quiet, for how long, and that it was discarded \u2014 and the next runtime in the fallback chain takes over. A permanent freeze became a message and a retry.',
          'Pressing Stop while a runtime is wedged frees the input after five seconds instead of never. ONNX generation cannot be interrupted at all, so the page simply stops waiting for it.',
          'A stall is classified as its own kind of failure, so a wedged runtime is never reported as a network problem or a broken model file, and it gets its own fix line.'
        ]
      },
      {
        label: '\u{1F50E} What the new error report caught in itself',
        items: [
          'A real failure came back from a real device: five runtimes, every one of them "Failed to fetch", and the kitchen concluded that huggingface.co was unreachable \u2014 blocked network, firewall, DNS, a privacy extension. Then the same report printed the evidence that this was wrong: the repository API had answered HTTP 200 from that browser moments earlier.',
          'Metadata and weights are not the same request. Hugging Face serves the repository information from huggingface.co and redirects the file itself to its LFS CDN, so a firewall, proxy or extension can allow one and block the other. An engine only ever sees "Failed to fetch", which cannot tell those apart \u2014 and the report was not checking either.',
          'It now asks for one byte of the file the loaders really download: the GGUF for the WLlama path and the .onnx weight for the browser path. It prints what came back \u2014 the HTTP status, the total size from the range answer, and the CDN host the request was redirected to. One byte, because a diagnostic has no business downloading 880 MB to make a point.',
          'When the metadata answered and no file could be fetched, the headline is overruled: "Hugging Face answered, but the model file could not be downloaded", with the fix that actually applies \u2014 serve the weights from this site with `node scripts/fetch-model.mjs`, which takes the CDN redirect out of the path entirely.',
          'It only overrules on a clean contradiction. If the file downloaded fine, or the metadata failed too, the original headline stands: a diagnosis that argues with its own evidence is worse than none.',
          'The same report caught a wrong number in the model table. Qwen 2.5 1.5B was listed at about 700 MB; the file it would really load is 881.6 MB, so the "will this fit on this device?" check was being computed from a figure 26% too small. The table now carries the measured size, and says where it came from.'
        ]
      },
      {
        label: '\u{1F50D} What the next failure report taught it',
        items: [
          'The improved report came back from a real device and immediately showed two more of its own gaps. It said the ONNX repository was refused with HTTP 401 \u2014 but that was the repository in the model table, not the one the loader used. The loader walks a list of candidates and quietly falls through to the first that really holds .onnx weights, so the report was describing a repository nobody had asked for.',
          'It now walks the same list in the same order, prints each candidate with its HTTP status, and names the one the loader would settle on \u2014 and it probes the files of *that* repository, not the configured one.',
          'It also could not tell two very different blockages apart, because both look like "Failed to fetch". The loaders ask for model files with a Range header, and Range is not a CORS-simple header, so the browser has to preflight the request with an OPTIONS call before any byte is sent. A proxy, firewall or privacy extension that drops preflights therefore breaks every model download while leaving the plain API calls working.',
          'So a failed download is now retried once as a plain, header-free request. If that gets through, the report says the host is reachable and the *ranged* request is what is being stopped, and the fix names OPTIONS, the CDN hosts and the extension \u2014 instead of telling the visitor their network is down.',
          'It now says whether this browser already holds the model on *this origin*. Pre-cached copies belong to one origin, so the same model can be ready on the live site and missing on a preview host, a localhost port or a fresh deploy \u2014 which is the usual reason "it worked yesterday" stops being true.',
          'And it caught a second wrong number in the model table: SmolLM2 135M was listed and badged at about 70 MB, while the file it actually loads measures 93.0 MB. Both figures are corrected, because that number is what the "will this fit on this device?" check is computed from.'
        ]
      },
      {
        label: '\u{1F9CA} Pre-caching now happens by itself',
        items: [
          'The model weights can now ship with the site. A deploy pre-caches the small models onto its own origin before it builds, so they are served from the same place as everything else \u2014 no third-party host, no CDN redirect, no cross-origin request for a firewall or a privacy extension to refuse.',
          'And the loader was quietly ignoring them. A file this site served was step three of the WLlama load order: it was only reached when no Hugging Face repository was configured, and every model has one. So a site could be carrying the model and still send the visitor to a CDN that was blocked. The same-origin copy is now tried *first*, and the browser keeps it on the device on the way, so the next start needs no network at all.',
          'A deployed site would have served them into a wall. The offline service worker answered *every* path under `api/` with a 501 \u2014 \u201Cno llama.cpp server on this static host\u201D \u2014 and the model files the build ships live under `api/`. So a site carrying the weights looked like it carried nothing, and every load went back to Hugging Face anyway. Those paths are passed through now; the chat API is still answered at once.',
          'What the site carries, the kitchen now copies by itself. Once the page has settled it pre-caches those files in the background \u2014 same-origin only, at most once every twelve hours, skipped on a data-saver connection, and cancelled the instant a chat starts so the two never compete. Settings \u2192 AI Models shows it happening, and has a Stop button.',
          'Those rows are marked \u{1F3E0} Served by this site with their real size, and pre-caching one takes the local file rather than asking Hugging Face for it.',
          'An HTML page is no longer mistaken for a model. A static host with no such file answers 200 with its own index page, which the old probe counted as present \u2014 it would have tried to load four kilobytes of markup as a GGUF and reported a corrupt download. A served file now has to be a real one, and the error report says so when it is not.',
          '`npm run precache` does what a deploy does (every model under 1B parameters, smallest first, up to a 160 MB budget so the published site stays well under the 1 GB Pages cap). `--max-mb` and `WAFFLE_SELF_HOST_MB` set that budget for the fetch and the build.',
          'The error report follows: when this origin serves the file it says the WLlama path never needed Hugging Face, and when a blocked download is diagnosed on a site that carries the model, the advice points at this origin instead of the visitor\u2019s network.'
        ]
      },
      {
        label: '\u{26A0}\u{FE0F} Known rough edges',
        items: [
          'A wedged WASM or WebGPU worker cannot be revived from inside the tab. The kitchen recovers by discarding it and starting the next attempt clean, but if one model wedges every single time, reloading the page is still the real fix.',
          'The watchdog measures silence, so a runtime that emits one token a minute forever would not be caught. That is deliberate: killing a slow reply that is still working is worse than waiting for it.',
          'This was diagnosed from the runtime\u2019s own source rather than reproduced on a device, so the counters are conservative. If a healthy reply is ever cut off, the two windows are the numbers to change.'
        ]
      }
    ]
  },
  {
    version: '1.1 TVAR 1',  // history: a test build of the 1.1 cycle
    date: 'November 18, 2026',
    title: 'First test build after 1.1',
    tvar: true,
    groups: [
      {
        label: '\u{1F9EA} What a TVAR build is',
        items: [
          'TVAR stands for test version after release. A TVAR build is the shipped release plus everything being tried on top of it, and this list only exists in the backup kitchen \u2014 the public page keeps saying 1.1 and nothing more.',
          'The counter resets with every public release, so 1.1 TVAR 1 is the first test build after 1.1, and the first one after 1.2 would be 1.2 TVAR 1.',
          'Nothing here is promised. A TVAR entry can be rewritten, renumbered or thrown away before it becomes a release, which is exactly why it is written down separately.'
        ]
      },
      {
        label: '\u{1F916} Waffle AI failures now carry facts from Hugging Face',
        items: [
          'When a model fails, the reply now ends with a source report fetched live from the Hugging Face API: whether the repository exists, whether it is gated or private, when it was last modified, how many files it holds, and whether the exact quantization file this build asks for is actually in there.',
          'If the file is missing but the repository is fine, the report lists the quants that *are* there with their real byte sizes and names the closest match, so the fix is a one-line change to the model table instead of a guessing game.',
          'It also reports the true size of the file it tried to load, so an out-of-memory failure can say "that file is 1.9 GB and this browser budgets 700 MB" instead of only "not enough memory".',
          'The self-hosted copy is checked too: whether this site is serving the model itself from api/waffle-ai/gguf/, or reaching for the network at all.',
          'The report is fetched with a short timeout and wrapped so it can never replace the real error. If Hugging Face cannot be reached, the failure says that plainly and the original message is untouched.'
        ]
      },
      {
        label: '\u{1F373} This build is called the backup kitchen',
        items: [
          'The second build used to announce itself as a testing programme \u2014 in the changelog, on a banner, and in a hint that counted taps out loud. It does not do that any more: the page is backup.html, the banner says backup kitchen, and nothing in the public build explains how to get here.',
          'The layered art studio is now called Art Studio (with layers), which says what the tool actually does. Project files saved under its earlier name still open.',
          'The kitchen no longer prints a recipe for the unlock gesture anywhere, including in the notice that appears when Waffle AI is paused.'
        ]
      },
      {
        label: '\u{1F41B} Fixed while doing it',
        items: [
          'The paused-AI notice claimed the kitchen had 45 games. It has 51, and the number now matches the cabinet.',
          'A welcome README was added to the repository, which the test suite had been forbidding since an earlier cleanup. The rule was retired rather than the file, so the build is green again.'
        ]
      }
    ]
  }
];

export const CHANGELOG = [
  {
    version: '1.2.6',
    date: 'November 22, 2026',
    title: 'Every model is now in the normal kitchen',
    groups: [
      {
        label: '\u{1F916} Every model, in every kitchen',
        items: [
          'All seven are in Waffle AI for everybody: Qwen 2.5 0.5B, Qwen 3 0.6B, Qwen 3.5 0.8B, Falcon 3 1B, SmolLM2 360M, Qwen 2.5 1.5B and SmolLM2 1.7B. They were tried in the backup kitchen first, and they have been tried, so now they are the list.',
          'The notes for 1.2.5 mentioned Falcon 3 1B, which nobody could actually pick in this kitchen. That is the mistake this release corrects: a release note may only name a model the reader can choose.',
          'The menu is ordered by what a model costs to download, from 320 MB to roughly 1 GB, because on a tablet that is the only order a model list gets read in.'
        ]
      },
      {
        label: '\u{1F31F} The model you start with',
        items: [
          'Qwen 2.5 0.5B is the new starting model, at 320 MB: the smallest one on the menu that a deploy serves from this site itself, so the first message does not depend on reaching somebody else\u2019s server. Qwen 3 0.6B is still the one marked most reliable, and sits one row above the middle.',
          'SmolLM2 135M comes off the menu and SmolLM2 360M takes its place. The 135M was 270 MB of 16-bit weights and answered like 135M parameters; the 360M is the same family with roughly twice the model in it.',
          'If you had picked the 135M before, your setting moves to the new starting model rather than to something you can no longer see in the picker.'
        ]
      },
      {
        label: '\u{1F527} Underneath',
        items: [
          'The last-resort model the fallback chain reaches for, when a browser will not run anything else, now follows the starting model instead of being hardcoded to one that is no longer on the menu. A safety net pointing at a model the build no longer ships is a net with a hole in it.',
          'Retired models stay in the table rather than being deleted: the pre-cache budget, the source reports and a stored preference from an older visit all read that table by id.',
          'A choice stored in an older visit is checked against the menu before it is honoured, so nobody ends up with a model selected that the picker cannot show.'
        ]
      }
    ]
  },
  {
    version: '1.2.5',
    date: 'November 22, 2026',
    title: 'Sir Waffle introduces himself, and stops wrapping answers in file markers',
    groups: [
      {
        label: '\u{1F9C7} A name and a job description',
        items: [
          'The assistant now knows what it is. Two sentences at the top of its instructions say who it is — Sir Waffle — and what this site is: a free set of small utilities that runs in your browser, covering writing and language tools, maths, art, code and games.',
          'Two sentences is the entire introduction, on purpose. A small model reads its instructions as a sample of the house style and imitates them, so a paragraph of waffle imagery is how every answer ends up being about breakfast. The instructions now say the opposite as well: answer the question that was asked, and mention the site or the waffle only when the question is about them.',
          'The narrow tools keep their own instructions. A translator told to output only the translated text, or a flashcard maker told to output only FRONT || BACK || HINT lines, gets no biography at all — an identity is useful in a conversation and gets in the way of a tool.'
        ]
      },
      {
        label: '\u{1F41B} --- BEGIN FILE ---',
        items: [
          'Falcon 3 1B answered everything, including "hello", wrapped in --- BEGIN FILE --- and --- END FILE ---. Nothing was wrong with the model or with its weights: the instructions described those markers on every single turn, whether or not a file was attached, and a 1B model treated them as the shape an answer takes.',
          'That description now travels only with a message that really does carry a file, and it names the markers this kitchen actually uses — the old text described a format the app never wrote. It also says plainly that the markers belong to the incoming file and not to the reply.',
          'As a second line of defence, any model that still emits them has them removed before the answer reaches you, including half-written ones mid-stream, so a marker never flashes on screen and then disappears.',
          'The same cleaning covers the web-search markers, and it leaves ordinary Markdown alone: a --- rule, a bullet list and a fenced code block all come through untouched.'
        ]
      },
      {
        label: '\u{1F527} Underneath',
        items: [
          'The introduction and the answer cleaning now live in one small module that the chat, the in-browser engines and the optional on-device server all import, so the two kitchens cannot drift apart on who they are or on what a clean answer looks like.',
          'The server recognises one of our prompts by its opening line instead of by comparing whole strings, so it no longer repeats the language rule at a prompt that already carries it — which matters now that a turn with an attached file has a prompt of its own.',
          'Tokens streamed back from the on-device server are cleaned as they arrive. They used to be shown exactly as generated, with the tidy-up applied only to the finished answer.'
        ]
      }
    ]
  },
  {
    version: '1.2.1',
    date: 'November 22, 2026',
    title: 'Quicker answers, and a code helper that waits for the right model',
    groups: [
      {
        label: '\u{26A1} Quicker answers',
        items: [
          'Every writing tool in English & Languages used to ask a model for the same 560 tokens \u2014 about right for an essay draft, and about four times too much for an idiom. Each one now asks for the length of a good answer to its own question: 220 for pronunciation, 260 for an idiom, 400 for a summary, 520 for an essay. On a device with a small memory budget every one of those is capped again. A tablet generates a few tokens a second, so this is the difference between an answer and a spinner.',
          'Those tools also stopped appending "(Speak in English)" to every request when the kitchen is already set to English, and stopped pasting more of your document than the model was ever going to read. Both were being counted in the wait.',
          'The banner above them said "Powered by Qwen 2.5 1.5B" whatever you had chosen in Settings. It names your actual choice now.',
          'Qwen 3 0.6B is marked as the most reliable model here, because testing on real devices said so rather than table order. It is now fetched at 4-bit or better and never below: roughly 85 MB more to download, and it stops dropping instructions. Qwen 2.5 0.5B moved up with it, for the same reason.',
          'A model can be limited to a range of quantisations instead of one file with a preset chain behind it. The range is what may be used; the model still leads with the quantisation that has been tested, so a wider range cannot downgrade what is served.'
        ]
      },
      {
        label: '\u{1F50D} CodeHub\u2019s AI Error Helper',
        items: [
          'The helper that explains a runtime error and offers a fix runs on Granite Code 0.5B and on nothing else. It used to borrow Qwen 2.5 Coder 1.5B, the largest model in the kitchen, which on a CPU-only tablet meant a download of about 700 MB before it could say anything at all.',
          'Granite models will come in a later update. Until then the helper says exactly that, and stops \u2014 it does not fail with an error from a repository nobody has, and it does not quietly substitute a different model, because an answer from another model looks identical to an answer from this one and the testing that chose the pin would mean nothing.'
        ]
      },
      {
        label: '\u{1F9F0} Underneath',
        items: [
          'A model can be limited to a range of quantisations instead of one file with a preset chain behind it, and the range wins outright: no preset can widen it back.',
          'The device question is asked once per build rather than once per release number, so this kitchen and any test build made from it each ask you once.',
          'The backup kitchen is harder to get into than it was, on purpose. It is still there, and it is still where new behaviour is tried first.'
        ]
      }
    ]
  },
  {
    version: '1.2',
    date: 'November 21, 2026',
    title: 'Waffle AI is back, and quicker about it',
    groups: [
      {
        label: '\u{1F916} Waffle AI is back',
        items: [
          'Waffle AI works in the main kitchen again, with nothing to unlock first. It was paused while the runtimes underneath it were made honest about what a device can actually run, and that work is what let it come back.',
          'The backup kitchen stays, and stays reachable the way it always was. Same tools, test switches on: it is where new AI behaviour gets tried before it lands here.',
          'Five models, and only five: SmolLM2 135M, Qwen 3 0.6B, Qwen 3.5 0.8B (the one that sees pictures), Qwen 2.5 1.5B and SmolLM2 1.7B. The rest of the old menu is gone rather than greyed out, so nothing on it can be picked by accident — and a model you picked before 1.2 that is no longer offered quietly becomes the default instead of failing.'
        ]
      },
      {
        label: '\u{26A1} Faster',
        items: [
          'Every model on a deployed kitchen used to run on one CPU core. Multi-threaded WebAssembly needs two response headers, and a static host cannot send them — so the service worker this site already ships now sends them itself, and the runtimes get the threads they were always written to use. Two honest limits: it applies from the second visit onwards, because the worker has to be in charge of the page first, and a browser that does not understand the headers simply stays single-threaded, exactly as it is today. The device note says which of those you are in.',
          'A Huawei or HarmonyOS tablet now tries its own GPU first. ArkWeb reports Chromium versions that are not real Chrome releases, so its WebGPU adapter can never be verified from a user agent alone, and refusing to use it was not caution — it was giving up. The CPU runtimes stay behind it as the fallback they always were, the stall watchdog stays armed, and the note says plainly that the adapter is unverified and is being tried anyway.',
          'The note now names the GPU it found, so "the GPU was tried" and "the GPU was found" are two different sentences you can tell apart.'
        ]
      },
      {
        label: '\u{1F4F1} The device question',
        items: [
          '"Which device is this?" — Android, iOS, iPadOS, macOS, Windows, Linux, HarmonyOS — is its own window now, asked once per release instead of a strip inside the chat that changed the shape of the chat window on every device that had not answered it yet. A new release asks again with your last answer marked, because what the answer does can change between them: this one put the GPU first.',
          'The pill in the AI header reopens that window with your current answer marked, so HarmonyOS can be corrected rather than only cleared.',
          'SmolLM2 135M is served at full 16-bit. It is the model everyone meets first, and a 3-bit quant of a 135M model throws away most of what it knows. That costs about three times the download — roughly 270 MB instead of 93 — so a deploy pre-caches it, and the download comes from this site rather than from Hugging Face.'
        ]
      },
      {
        label: '\u{1F9F0} Under the counter',
        items: [
          'The games cabinet no longer phones home. Two pages were still reporting visitors to Google Analytics, one loaded an icon kit and a webfont from a CDN for a single caret glyph, and one carried the navigation bar of a proxy site, including a link out to an anime pirate. All of it is gone, and a test sweeps every page in the cabinet so it cannot come back.',
          'Tic Tac Toe arrived as two documents stapled together with its stylesheet missing, so its white headings sat on a white page and its grid border was a seven-digit hex colour no browser parses. It is one document now, in the kitchen ink, and it still plays.',
          'A deploy says twice what it is shipping: what the model cache held, and what the built site actually carries. Those are different questions, and only the second one proves anything.'
        ]
      }
    ]
  },
  {
    version: '1.1.1',
    date: 'November 20, 2026',
    title: 'Layers for everyone, and a kitchen that knows your device',
    groups: [
      {
        label: '\u{1F3A8} Art Studio',
        items: [
          'Art Studio now has layers. The separate "Art Studio (with layers)" tool is gone — its whole studio, 18 brushes (10 of them pressure-aware), per-layer opacity and blend modes, a 4096px canvas and per-layer undo, is what opens when you tap Art Studio, in both kitchens.',
          'Drawings saved from the layered studio still open, and the old link to it still works: it just opens Art Studio.'
        ]
      },
      {
        label: '\u{1F4F1} Devices',
        items: [
          'Waffle AI in the backup kitchen now asks which device you are on — Android, iOS, iPadOS, macOS, Windows, Linux or HarmonyOS — and uses the answer to decide what to run. A browser can hide or rewrite its user agent, and HarmonyOS ones often carry no version at all, so being told beats guessing.',
          'Huawei and HarmonyOS tablets are profiled properly: ArkWeb and Huawei Browser versions, the Chromium baseline behind them, the device model, and whether a WebGPU adapter can be believed. An adapter that cannot be verified is tried last instead of first, so it cannot hang the tab before the runtimes that work get a turn.',
          'The AI panel shows the profile it recognised — browser, Chromium baseline, adapter trust, NPU, WASM SIMD, threading, heap budget and on-device storage — and every AI failure report ends with the device it happened on.',
          'Phones and tablets keep a wider memory margin, because a model that fits beats a bigger one that gets the tab closed.',
          'About the NPU, plainly: no browser on a phone or tablet exposes WebNN, the only web API that can reach one, so a Kirin NPU cannot be used from a web page. The kitchen detects it, uses it first where it exists, and says so where it does not.'
        ]
      },
      {
        label: '\u{1F9F0} Under the counter',
        items: [
          'Models are pre-cached: a deploy serves the small ones from its own origin, the browser loads that copy before it ever asks Hugging Face, and it keeps a copy on the device in the background while idle — no cross-origin request, no CORS preflight, no CDN to be blocked.',
          'AI no longer freezes on a second question. Every browser runtime has a watchdog, one inference runs at a time, and a runtime that stops answering is discarded instead of reused.',
          'AI failures explain themselves with evidence checked live from the model hosts, and never contradict it: a report that says a host answered will not blame your network for the download.'
        ]
      }
    ]
  },
  {
    version: '1.1',
    date: 'November 18, 2026',
    title: 'The calculator, graphing and games update',
    groups: [
      {
        label: '\u{1F9EE} Eight calculators in one',
        items: [
          'The Calculator is now a family of chassis you pick from a shelf above the device, so the calculator face itself stays just a calculator: WAFFLE-CALC-2500 Normal, 2200 Slim, 2900 Fat and 1900 Sideways, each of them also available as a -PRO model with the full scientific keypad. Your pick is remembered on this device.',
          'Every chassis shares one honest maths engine, so -PRO is a keypad change and not a different calculator: sin, cos, tan, logs, roots, powers, factorial, memory and answer recall all evaluate the same way in all eight.',
          'The badge on the tool names the model you are holding, and a stored model that no longer exists falls back to the 2500 Normal rather than leaving a broken layout behind.'
        ]
      },
      {
        label: '\u{1F4C8} A graphing calculator that analyses what it draws',
        items: [
          'Plot five curves at once in Cartesian or polar mode, with one to eight polar turns and a radians or degrees switch.',
          'Overlays for the derivative, the shaded area under a curve, roots drawn as rings, turning points as diamonds, and crossings between two curves as X marks.',
          'The Analyse report gives the numbers behind the picture \u2014 definite integral, average value, minimum, maximum, end slopes, concavity, curvature, arc length and swept polar area \u2014 all computed locally with Simpson and bisection rules, with no server involved.',
          'Fifteen Cartesian presets and ten polar presets, your own bounds, and a Use window button that fits the curves to the screen.'
        ]
      },
      {
        label: '\u{1F373} More kitchen maths',
        items: [
          'The bodily calculator gained a fifth tab, Two-a-days, and with it Navy body-fat tape, Devine lean mass, Mosteller body surface area, waist-to-hip ratio, BMI prime, ponderal index, daily water, a protein target and Harris-Benedict energy.',
          'The fraction calculator covers eight operations with twelve insight labels and three drawn pie models, and its mixed-number output now keeps the sign on the whole number where it belongs.',
          'The percentage calculator has nine modes and twelve everyday coin examples, and it answers a nonsense input with a readable message instead of printing Infinity.'
        ]
      },
      {
        label: '\u{1F3AE} Six new games in the cabinet',
        items: [
          'Four originals drawn for this kitchen: Toast Breakout, Kitchen Snake, Syrup Glide and Waffle Whisk, each with its own 2.5D shelf logo, sound you can mute, and a best score kept on your own device.',
          'Two guests taken from GitHub with their MIT licences shipped beside them: Andromeda Invaders by Susam Pal, and SpacePi by Jack Rugile, a thirteen-level tower defence where you draw the defence lines with your mouse.',
          'The cabinet now holds 51 games, and every one of them still runs from files inside this repository with no network calls once the page is open.'
        ]
      },
      {
        label: '\u{1F3A8} Art Studio (with layers)',
        items: [
          'A pressure-aware painting studio with eighteen brushes in four groups, sixteen layers, six symmetry modes, twelve blend modes, stamps, photo import, and project files you can save and reopen later.',
          'Undo works per layer and is capped by both step count and memory, so a long painting session cannot eat the tab.',
          'It is a work in progress and only appears in the backup build, next to the AI tools that are still being fixed.'
        ]
      },
      {
        label: '\u{1F916} Waffle AI is still paused in this build',
        items: [
          'Nothing about the pause changed in 1.1: the public kitchen still tells you the truth rather than showing an assistant that guesses.',
          'The backup build carries the reliability fixes from 1.0.1 together with the small models that can answer offline, for anyone who wants to try them before they are ready for everyone.'
        ]
      }
    ]
  },
  {
    version: '1.0.1',
    date: 'November 17, 2026',
    title: 'The honest update',
    groups: [
      {
        label: '🔒 Waffle AI is paused',
        items: [
          'I apologize for the inconvenience but WaffleAI isn\u2019t available due to countless bugs with open-source AI models. We will make it available in a later update.',
          'Sir Waffle\u2019s chat, CodeHub\u2019s AI Error Diagnostics, and the AI writing helpers in English & Languages are paused together, so nothing half-works or quietly guesses.',
          'The AI model picker, image model picker, fallback runtime mode, quantization, and on-device pre-cache panels have been taken out of Settings until the feature returns.'
        ]
      },
      {
        label: '🧾 New in the kitchen',
        items: [
          'This changelog. Open it any time from What\u2019s New in the kitchen header.',
          'The header no longer claims a model is pre-cached and running on a server that does not exist on this host.'
        ]
      },
      {
        label: '🛠 Under the hood (fixed, still paused)',
        items: [
          'Matched the ONNX Runtime WASM build to the one Transformers.js actually ships. This was the real reason models downloaded perfectly and then refused to answer: two different runtime builds were being mixed.',
          'Models can now be pre-cached on-device through Wllama\u2019s own ModelManager, so a cached model starts with no network at all.',
          'WebGPU is only requested when the adapter genuinely supports it, so Chromium\u2019s shader-f16 abort no longer takes the whole runtime down with it.',
          'Every reply names the engine that answered it, and a fallback lists which runtimes failed and why instead of collapsing into one vague error.',
          'Several models shared a single GGUF filename, which could silently load the wrong weights. Each model now resolves its own file, and a missing one is skipped rather than guessed.',
          'The service worker is sub-path aware, installs even when one shell file is missing, answers API calls honestly on static hosts, and no longer caches multi-hundred-megabyte assets.'
        ]
      }
    ]
  },
  {
    version: '1.0',
    date: 'November 16, 2026',
    title: 'Grand opening',
    groups: [
      {
        label: '🧇 The kitchen opens',
        items: [
          '115 bite-sized utilities across 8 cupboards: Math & Numbers, Coding & Developing, Text & Files, Art & Coloring, Science & Physics, English & Languages, Music & Composing, and Videography & Editing.',
          'A cozy 2.5D waffle kitchen watched over by Sir Waffle, with 8 kitchen moods, sound effects, favorites, and recents.',
          'Every tool hand-drawn as its own 2.5D SVG prop \u2014 no icon library, no stock art.'
        ]
      },
      {
        label: '💻 CodeHub',
        items: [
          'Real local runtimes with no server involved: JavaScript, TypeScript, Bash, CoffeeScript, Lua, SQL, JSON, Python, Lisp, Scheme, Forth, BASIC, Befunge, Whitespace, Brainfuck, Boolfuck, and Ook.',
          'Formatters and minifiers for JS, SQL, and CSS, a regex tester with catastrophic-backtracking protection, plus UUID, timestamp, base, hash, JWT, and HTTP status utilities.',
          'A live Shadow DOM web preview for HTML, CSS, and JavaScript, with worker timeouts that genuinely terminate runaway code.'
        ]
      },
      {
        label: '🎮 Games cabinet',
        items: [
          '45 offline games including Roper and the whole offline arcade cabinet \u2014 all playable with no connection at all, embedded straight into the kitchen.'
        ]
      },
      {
        label: '🤖 Waffle AI (now paused in 1.0.1)',
        items: [
          'An on-device chat assistant over nine open-source models, from SmolLM2 135M up to DeepSeek R1 1.5B.',
          'Image generation with SDXS-512 and SD-Turbo, vision for attached photos, and a web search mode.',
          'Reads DOCX, PPTX, XLSX, and PDF payloads, and streams replies with live code boxes and downloadable file cards.'
        ]
      },
      {
        label: '🌍 For everyone',
        items: [
          '15 interface languages with native-name pickers.',
          'English & Languages tools backed by the Google Translate endpoint, with romanization and dictionary senses.'
        ]
      },
      {
        label: '🔒 The promise',
        items: [
          'No accounts, no subscriptions, no uploads, no blurred previews. Your files are processed on your own device and never leave it.',
          'Installable as an app and usable offline.'
        ]
      }
    ]
  }
];

const esc = s => String(s).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

let overlayEl = null;

function onKeydown(e) {
  if (e.key === 'Escape' && overlayEl && !overlayEl.hidden) closeChangelog();
}

function buildChangelog() {
  const wrap = document.createElement('div');
  wrap.className = 'settings-overlay changelog-overlay';
  wrap.id = 'changelog-overlay';
  wrap.hidden = true;

  const releases = isBackupBuild() ? [...TVAR_LOG, ...CHANGELOG] : CHANGELOG;

  const entries = releases.map((entry, idx) => `
    <article class="changelog-entry ${idx === 0 ? 'is-latest' : ''}${entry.tvar ? ' is-tvar' : ''}">
      <header class="changelog-entry-head">
        <span class="changelog-version">${esc(entry.version)}</span>
        <span class="changelog-date">${esc(entry.date)}</span>
        ${idx === 0 ? '<span class="gbadge changelog-tag">Newest</span>' : ''}
      </header>
      <p class="changelog-entry-title">${esc(entry.title)}</p>
      ${entry.groups.map(g => `
        <section class="changelog-group">
          <h3 class="changelog-group-label">${esc(g.label)}</h3>
          <ul class="changelog-items">
            ${g.items.map(item => `<li>${esc(item)}</li>`).join('')}
          </ul>
        </section>
      `).join('')}
    </article>
  `).join('');

  wrap.innerHTML = `
    <div class="settings-card changelog-card" role="dialog" aria-modal="true" aria-labelledby="changelog-title" data-no-i18n>
      <div class="window-grab-pill" aria-hidden="true"></div>
      <div class="settings-head">
        <div class="settings-title-group">
          <span class="gnav-icon">${uiIconSVG('scroll')}</span>
          <h2 id="changelog-title">What&rsquo;s New</h2>
        </div>
        <button type="button" class="window-close-x" id="changelog-close" aria-label="Close changelog">✕</button>
      </div>
      <p class="changelog-intro">
        Every change to the kitchen, newest first. No newsletter, no &ldquo;what&rsquo;s new&rdquo; modal
        on launch \u2014 come read it when you want to.
        ${isBackupBuild() ? 'This build also lists its TVAR entries: test versions made after a release, newest first.' : ''}
      </p>
      <div class="changelog-list">${entries}</div>
      <footer class="changelog-foot">
        <span class="changelog-foot-note">BiteSized Utilities ${esc(appVersionLabel())}</span>
        <button type="button" class="gbtn gbtn-primary" id="changelog-done">Back to the Kitchen</button>
      </footer>
    </div>
  `;

  wrap.addEventListener('click', e => {
    if (e.target === wrap) closeChangelog();
  });
  wrap.querySelector('#changelog-close')?.addEventListener('click', closeChangelog);
  wrap.querySelector('#changelog-done')?.addEventListener('click', closeChangelog);

  return wrap;
}

export function openChangelog() {
  if (!overlayEl) {
    overlayEl = buildChangelog();
    document.body.append(overlayEl);
    document.addEventListener('keydown', onKeydown);
  }
  overlayEl.hidden = false;
  document.body.classList.add('waffle-modal-open');
  overlayEl.querySelector('.changelog-card')?.scrollTo?.({ top: 0 });
  setTimeout(() => overlayEl?.querySelector('#changelog-close')?.focus(), 40);
}

export function closeChangelog() {
  if (!overlayEl) return;
  overlayEl.hidden = true;
  // Only release the scroll lock if no other modal (Settings, Waffle AI) is open.
  const stillOpen = document.querySelector('#settings-overlay:not([hidden]), #waffle-ai-overlay:not([hidden])');
  if (!stillOpen) document.body.classList.remove('waffle-modal-open');
}
