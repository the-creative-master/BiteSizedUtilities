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
export const APP_VERSION = '1.1';

/** Test versions built after 1.1 shipped. Reset to 0 on every public release. */
export const TVAR = 3;

/** `1.1 TVAR 3` — the version string the backup kitchen reports. */
export const APP_VERSION_EXTENDED = `${APP_VERSION} TVAR ${TVAR}`;

/** What the footer of the changelog should call this build. */
export function appVersionLabel() {
  return isBackupBuild() ? APP_VERSION_EXTENDED : APP_VERSION;
}

/**
 * Extended minor versions, newest first, backup kitchen only. Each one is a
 * real build a person can open, so each one documents what changed in it and
 * what is known to be rough — that is the whole point of writing them down.
 */
export const TVAR_LOG = [
  {
    // The newest entry always spells the counter out literally, and a test
    // pins it to APP_VERSION_EXTENDED, so history cannot quietly renumber
    // itself when the counter moves.
    version: `${APP_VERSION} TVAR 3`,
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
    version: `${APP_VERSION} TVAR 2`,
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
    version: `${APP_VERSION} TVAR 1`,
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
