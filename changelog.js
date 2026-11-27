import { uiIconSVG } from './icons-25d.js';
import { isBackupBuild } from './build-mode.js';

/**
 * The kitchen's release notes. Newest first — `openChangelog()` renders them
 * top to bottom exactly in this order, so 1.1 sits above 1.0.1 above 1.0.
 *
 * Two lists live here on purpose:
 *
 *   CHANGELOG  every public release. This is all index.html ever shows.
 *   TVBR_LOG   test versions, shown only in the backup kitchen. Two labels, and
 *              the difference between them is where the build sits relative to a
 *              release — they are not two spellings of one thing:
 *
 *                TVAR means "Test Version AFTER Release": built on top of a
 *                     release that has already shipped. 1.1 TVAR 1 came after
 *                     1.1, and the three 1.2 ones after 1.2.
 *                TVBR means "Test Version BEfore Release": built toward a
 *                     release that has not shipped yet. 1.3 TVBR 4 is open while
 *                     the public kitchen is still on 1.2.12, because 1.3 does
 *                     not exist yet and this is what it is being tried on.
 *
 *              The counter resets when the release it belongs to ships, and
 *              nothing about it is mentioned on the public page — there it is
 *              simply 1.2.12. Each entry keeps the label that says where it sat,
 *              so the six below read TVAR and are not renamed to agree with the
 *              one above them. The list itself is named for the label the open
 *              build carries, and it holds both kinds.
 *
 *
 * This lives in the app rather than only in the repo's README on purpose:
 * visitors on GitHub Pages never see repo files, and the release notes belong
 * where the kitchen is.
 */
export const APP_VERSION = '1.2.12';

/**
 * How many test builds of the open cycle there have been. Reset to 0 when that
 * cycle's release ships — and once 1.3 has, a build made on top of it is a test
 * version *after* a release, so it reads 1.3 TVAR 1 rather than TVBR.
 */
export const TVBR = 4;

/**
 * The release the open test build comes *before*.
 *
 * Its own constant rather than APP_VERSION, because the two are not the same
 * string and cannot be: 1.2.12 is what the public kitchen reports, while the
 * backup kitchen is testing toward 1.3, which has not shipped. Deriving the
 * extended label from APP_VERSION would have announced "1.2.12 TVBR 1" — a
 * build that has never existed — and renumbered the entries that document the
 * ones that have.
 *
 * A public release that ships *part* of an open cycle does not close it. That is
 * not a hypothetical any more, it has happened three times: 1.2.10 carried the star
 * utilities and nothing else of 1.3 TVBR 3, and 1.2.11 carries five new
 * utilities, a file splitter and a cheaper chat out of 1.3 TVBR 4 while leaving
 * the four new models in the kitchen they are being tried in.
 *
 *              1.2.12 is the third, and a different shape again: it carries
 *              nothing out of a test build at all. A runtime upgrade and a fit
 *              check are not test-only content — both builds have always shared
 *              one WASM binary and one budget — so there was nowhere to try them
 *              first. All three moved the public version and left this cycle
 *              where it was, so the counter counts on rather than resetting: 3,
 *              then 4, then 4 again while 1.3 still has not shipped.
 */
export const TVBR_CYCLE = '1.3';

/**
 * `1.3 TVBR 1` — the extended label, used only while a test version is open.
 * TVBR is in the template rather than derived because the open build is a
 * before-release one; a test build made after its release ships reads TVAR, and
 * this line is the single place that would have to say so.
 */
export const APP_VERSION_EXTENDED = `${TVBR_CYCLE} TVBR ${TVBR}`;

/** What the footer of the changelog should call this build. */
export function appVersionLabel() {
  // TVBR 0 means "no test version is open", so both builds report the release.
  return isBackupBuild() && TVBR > 0 ? APP_VERSION_EXTENDED : APP_VERSION;
}

/**
 * Extended minor versions, newest first, backup kitchen only. Each one is a
 * real build a person can open, so each one documents what changed in it and
 * what is known to be rough — that is the whole point of writing them down.
 */
export const TVBR_LOG = [
  {
    version: '1.3 TVBR 4',
    date: 'November 25, 2026',
    title: 'Four models above the 1.7B, a reply that costs less to watch, and Math & Numbers grows to fifteen',
    tvbr: true,
    groups: [
      {
        label: '\u{1F916} The model menu grows in this kitchen only: two 2B models and two 3B ones',
        items: [
          'The public menu has always stopped at SmolLM2 1.7B, about 1 GB. This build goes past it: MiniCPM 2B (~1.5 GB), Llama 3.2 3B (~1.8 GB), Qwen 2.5 3B (~1.85 GB) and Gemma 2 2B (~2.4 GB), cheapest download first like the rest of the ladder.',
          'They are here and not there on purpose, and the reason is the honest one: four repository paths that nobody could check from where they were written. This sandbox has no route to huggingface.co, so a wrong path is a guess that costs a failed attempt on a device — which is what the second kitchen exists to absorb before everybody is asked to download it.',
          'None of the four sizes is a measurement. Each is arithmetic scaled from a sibling in the same table whose size *was* measured on a device: Qwen 2.5 3B from the 881.6 MB the 1.5B came back at, Llama 3.2 3B from the 1B this table has carried since 1.2, MiniCPM 2B from SmolLM2 1.7B at the same quant. Each entry says which sibling and by how much.',
          'Every one is then rounded up, because ggufMB is a ceiling and not a description. A ceiling ten percent low fails a load that would have worked and tells the visitor to raise a number they cannot see; a ceiling ten percent high only makes the fit check conservative, which for a 1.5\u20132.4 GB model is the right answer anyway. The repository tree still prices the real file before anything downloads, and the source report shows the measured size on the device.',
          'Gemma 2 2B is the heaviest file on any menu here despite being the smaller of the two 2B models, and that is worth saying out loud rather than discovering mid-download: it is 2.61B parameters, and 0.59B of them are a 256,000-word vocabulary embedding that GGUF quantisation conventionally leaves at 16-bit.',
          'Opening the seam between the menus again has a cost, so it is written down instead of left to be found: both builds share one localStorage, so a model chosen here and not offered publicly falls back to the default when the same browser opens the public page. That loses a preference, not a working app \u2014 and it is pinned by a test rather than assumed.',
          'SmolLM2 1.7B stopped being the biggest thing on every menu, so its badge now says which menu it tops. A title that is true in one build and false in the other is the same mistake as a progress bar that reports a number it cannot back up.',
          'None of the four is anywhere near the 400 MB per-model ceiling a deploy self-hosts under, so no deploy will ship them inside the site. They download once, into the visitor\u2019s own storage, and the pre-cache budget is unaffected.',
          'What is not being claimed: none of them has been run here. This sandbox has no WebGPU, so no reply in this build has ever been generated by any model, new or old. What has been checked is the table, the menu order, the quantisation ranges, the numbering, and that every entry can be diagnosed without producing junk.'
        ]
      },
      {
        label: '\u{1F4AC} A reply arrived a token at a time, and every token rebuilt the whole conversation',
        items: [
          'The chat feed was rebuilt from scratch for every single token: each message\u2019s markdown parsed again, and feed.innerHTML replaced, which also destroys and recreates every image element in the thread. The cost of showing one more character therefore grew with the length of the conversation \u2014 the wrong way round for the thing that happens most often in a chat.',
          'A token now paints the bubble it is arriving in, and at most once per frame. The whole feed is rebuilt when the reply is finished, which is when the Copy and Save buttons appear on it.',
          'This one does not depend on how fast the model is. Coalescing paints into frames only helps above about sixty tokens a second, and a small model on a tablet CPU is nowhere near that; repainting one bubble instead of twenty helps at any speed at all.',
          'It is main-thread work, which is the part a phone cares about. This is the same class of problem as the image runs that got killed: not the model being slow, but the page spending its budget on something the screen cannot show.',
          'The bit that could have broken quietly is the numbering. A code box is numbered by its position in a list shared by the whole thread, so a paint of one bubble on its own can leave every older bubble\u2019s Copy button pointing at somebody else\u2019s code. The cheap paint puts the list back to where that bubble starts before it reformats, and refuses to run at all unless the feed on screen still matches the thread in memory.',
          'Every condition it cannot vouch for sends it back to a full rebuild, which is slower and always correct: a user bubble, an image run, a bubble it cannot find, a thread that is not the one on screen.',
          'Image generation is deliberately untouched. Its progress still paints directly on its own one-second clock rather than being coalesced into frames \u2014 that clock is the signal a paused or killed run is judged by, and it was written after a run spent several minutes announcing 4%.',
          'What this does not do: it does not make the model faster. Tokens still arrive at whatever speed the device can produce them. It makes watching them arrive cheap.'
        ]
      },
      {
        label: '\u{1F522} What shipped publicly as 1.2.10 did not close 1.3, and what 1.2.11 carries',
        items: [
          'Math & Numbers goes from ten tools to fifteen: Equation Solver, Statistics Lab, Matrix Calculator, Geometry Calculator, and Factors/GCD & LCM. All five show their working the way the cupboard already does \u2014 an answer arrives with the substitution it came from, not just the answer.',
          'They recompute as you type rather than only when you press the button. Both are there: the button stays, because pressing a thing is a different kind of confirmation than watching a number change.',
          'Lorem Ipsum is gone and a File Splitter took its place. The naming is the whole point of it: parts come out as notes.part01.txt, extension last, so each one opens as the type it came from and nobody has to rename twenty files before they can use any of them.',
          'What it deliberately does not produce is notes.txt.part1 or notes.txt.firstpart. Those need a rename before anything can open them, and a tool that hands you twenty of those has handed you twenty chores. The other naming is available behind a switch that says out loud what it will cost you.',
          'Joining sorts by part number rather than by the order a file manager handed the pieces over, and refuses a missing part, a duplicate, an untagged name, or pieces of two different files. A joined file with a hole in it is worse than no file at all.',
          'Releasing part of an open cycle does not close it, so the counter moved to 4 and the cycle stays 1.3: five of the things this build has are public now, and 1.3 itself still has not shipped. The public notes for 1.2.11 say nothing about any of this, because a public page is not allowed to mention a test version in either spelling.'
        ]
      },
      {
        label: '\u{1F6A7} Still open in 1.3',
        items: [
          'The four new models are unrun. Their repository paths, their real file sizes and their behaviour on a device that has to hold them are all still to be found out here, which is the entire reason they are on this menu and not the other one.',
          'Granite Code 0.5B is still reserved for CodeHub\u2019s error diagnostics with no repository against it, because an invented path would fail as a 404 and read as a broken model rather than a model that has not arrived.',
          'Nothing in this build changes image generation, the wake lock, the device-lost race or the progress reporting. Those were 1.3 TVBR 3 and they are still the state of the art here.'
        ]
      }
    ]
  },
  {
    version: '1.3 TVBR 3',
    date: 'November 24, 2026',
    title: 'The progress bar was lying, the cupboard stars were invisible, and the Music Lab grew a bench',
    tvbr: true,
    groups: [
      {
        label: '\u{1F3A8} Image generation: 4% for several minutes, and 4% was never a measurement',
        items: [
          'The report was \u201Cimage gen stuck at 4%\u201D, and it was not stuck. At 4% the run was waiting on the chat model, which rewrites a short prompt as one vivid sentence before the image engine is asked for anything: a separate model to download and load on a cold start, announced the whole time as Polishing prompt\u2026 4%. Then it moved, and a picture arrived. The bar had been describing nothing at all.',
          'That phase could always have reported. streamWaffleChat takes an onStatus callback and the chat surface uses it; the call from /imagine did not pass one, so the only thing on screen was a number chosen before the work started. It now passes the chat engine\u2019s own status through, word for word, and says which model is loading and why.',
          'Two more ways the same bar lied, both in the mapping from engine events to a percentage. A stage that reported no fraction fell back to the bottom of its band, and the rule that stops the bar walking backwards then held that number for as long as the stage lasted \u2014 so \u201Cfetching text encoder\u2026\u201D, which arrives before the first byte does, parked the run at the floor of a 20-point band. And weights arrive in shards, each restarting its own loaded/total at zero, so shard two pulled the bar back down and the same rule froze it at shard one\u2019s high-water mark for the rest of a multi-gigabyte download.',
          'Shards are folded in now: the fraction is (shard \u2212 1 + this shard\u2019s progress) \u00F7 shards, so three shards walk the band once between them instead of three times over the same ground. A cold run reads 36, 45, 61, 78 where it used to read 45, 45, 45, 45.',
          '\u201Ccached\u201D is a finished stage rather than 0% of itself. Reading a shard out of the browser\u2019s own storage takes milliseconds, and it used to spend them at the bottom of its band on every warm run \u2014 the run that should look fastest looked stuck.',
          'A report now carries what is actually known, and says when that is not enough. indeterminate means the engine named a stage but reported no fraction for it, and the surface then stripes the bar and counts seconds instead of printing a number it cannot back up. Alongside it go the engine\u2019s own bytes \u2014 412 MB of 1,024 MB, part 2 of 3 \u2014 the denoise step, and how long the run has taken.',
          'An estimate appears only once there is something to estimate from: two samples of the same download at least 1.2 seconds apart, smoothed, and rate-limited to the file in flight so a speed measured on the 5 MB tokenizer is never used to promise a time for three gigabytes of weights. It is labelled \u201Cabout \u2026 left, estimated\u201D, because a guess with a unit on it is the same lie with extra steps.',
          'One clock on screen cannot freeze. The run stamps its own elapsed time onto the bubble once a second whether or not the engine has said anything, so a busy download and a dead one no longer look identical \u2014 which was the actual complaint. It is cleared in the same finally that clears the abort controller, so a stopped run does not leave a counter running behind a finished message.',
          'The header badge printed a percentage even when the run had nothing to measure, so the frozen number appeared twice on screen. It reads elapsed time during an indeterminate phase and a percentage only when one was measured.',
          'One stage had no band at all: encode-reference, where a picture supplied as a reference goes through the VAE encoder. It fell into the generic \u201CWorking\u2026\u201D row. The band table now covers every stage the engine can emit, and an event it still does not recognise is printed as the engine worded it, held at the current percent, and marked indeterminate rather than dropped.',
          'What is still true and not fixed by any of this: a first run is a multi-gigabyte download, a phone radio changes its mind about its own speed, and the estimate will be wrong sometimes. What is no longer true is a number that holds still and implies nothing is happening.'
        ]
      },
      {
        label: '\u{1F50B} Battery optimisation: a run that gets interrupted now ends, explains itself, and can be finished',
        items: [
          'The report was that battery optimisation kept killing image generation, and that turning it off for Chrome did not stop Chrome printing \u201CAw, Snap!\u201D. Both halves are true and they are not the same failure. A frozen tab is an OEM power manager suspending a background tab\u2019s timers, and a killed one is the renderer or the GPU process being discarded \u2014 which is what lands on screen as Aw, Snap. Exempting the app does not reliably stop the first, because the decision is about the tab and a tab with the screen off is a background tab however the app is classified.',
          'A page cannot prevent either. What it can do is stop being silent about them and stop being broken afterwards, which is what changed here. Neither is prevented; both are now survivable.',
          'The screen lock a power manager actually respects. navigator.wakeLock.request(\u2019screen\u2019) is asked for before the first byte rather than after the first stall \u2014 by the time a run has stalled there may be nothing left running to ask \u2014 held for the length of the run, and released when it ends, because a finished generation has no business keeping a screen on. The system drops the sentinel whenever the page is hidden, so it is asked for again on the way back and after every release event.',
          'Where there is no lock to give, the page says so instead of implying a protection it does not have. The first progress report carries one of three sentences: the screen is being held on; the lock was refused, so keep this tab on screen, because a hidden tab is the one thing that will pause this run; or this browser offers no screen lock at all, and nothing in here can stop the system pausing a hidden run. Settings and the AI panel\u2019s device facts both state which of those applies, because it is part of choosing a build.',
          'A lost GPU used to be invisible. The engine reports device.lost as a warning event and carries on, so a run whose device had been taken away could simply never finish \u2014 the bar held its last number, the seconds counted up, and nothing was coming. Worse, the engine object survived, so every later attempt in the same tab was handed the same dead device and failed the same quiet way until the page was reloaded. A loss now ends that run and releases that engine, so the next attempt asks for a device that works.',
          'The generation is raced against the loss rather than awaited alone, and the failure is put into words that name the cause, the size it happened at, and the lever that changes the odds: the weights already in this browser are kept, so trying again does not re-download them, and if it keeps happening on this build the phone build keeps far less memory resident. A warning event no longer pulls the bar backwards either \u2014 it holds the percent and says \u201CThe GPU went away\u201D instead of the label \u201CWarning\u201D, which told nobody anything.',
          'A paused tab is reported as paused. The one-second ticker measures its own gap, and a timer that took three minutes to fire was not busy: the overrun is accumulated and printed in the facts line as \u201Cthe system paused this tab for 4 min 12 s\u201D. That is the one measurement of an interruption that cannot be faked from inside a frozen tab, because the tab was not running to fake it.',
          'And a killed tab can offer to finish. What was in flight is written to storage before the first byte and cleared in the finally, so a run the system killed leaves a trace; the tab that comes back offers it once, with a \u25B6 Run it again button in the same place in the thread, and says the part that matters \u2014 the weights it had already downloaded are still in this browser, so trying again does not start from nothing. A twelve-hour expiry keeps a run cut off yesterday from being news today, and a notice that cannot be dismissed is clutter, so there is a Dismiss.',
          'What none of this does, stated because the alternative is a settings screen that over-promises: it cannot stop a renderer being killed, it cannot keep a tab alive that the system has decided to discard, and on a browser with no Screen Wake Lock there is no protection to offer at all. What it can do is make the interruption cheap \u2014 the download survives, the retry works, and the reason is on screen.'
        ]
      },
      {
        label: '\u2B50 Star utilities: a plinth instead of a slot, and a badge that follows the tool',
        items: [
          'catalog.js has named one utility per cupboard as its star since 1.2 \u2014 Calculator, CodeHub, File Converter, Art Studio, Physics Hub, Waffle Translate, Waffle Music Lab, Waffle Studio \u2014 and nothing on screen ever read the flag. A cupboard\u2019s flagship looked exactly like the fourteenth utility beside it, and the sentence that says what it is had nowhere to go: a shelf card is a tile and a name.',
          'A cupboard now opens on a plinth. The star sits above the shelves on a 108 px tile against a shelf object\u2019s 82 \u2014 close to twice the area \u2014 with its description under the name, a badge that names the cupboard it stars in \u2014 \u2B50 Star of Coding & Developing \u2014 an Open it \u2192 pill, and the same heart sticker it always had, so saving it did not move. The whole card is the button, and it is labelled for a screen reader as what it is and where it comes from.',
          'The star comes off the row rather than being emphasised inside it, which is the part that makes it a layout and not a highlight: a cupboard reads as one flagship and the tools beside it, and the shelf underneath is one slot shorter rather than one slot louder.',
          'The same tool as a guest keeps the shelf and wears a corner \u2B50 instead \u2014 on Saved Toys, in Recently Played, and in search results, where three hits could each have claimed a plinth and none of them is the star of the shelf they are standing on. The cupboard is named in the accessible label, and the tile gets an underline and a warm glow so a 27 px badge is not the only thing carrying it.',
          'Games & Fun declares its star as the cupboard itself and carries no tool list, so the arcade gets no plinth: it has its own cabinet view, and 51 games are not one flagship.',
          'Both layouts collapse on a phone \u2014 the plinth tile to 74 px, the strip of steps to eight across \u2014 and neither animates for anybody who has asked the system not to.'
        ]
      },
      {
        label: '\u{1F3B5} Waffle Music Lab: a sixth mode, and it says experimental on the panel',
        items: [
          '\u{1F9EA} Experimental joins Song Maker, Kandinsky, Rhythm, Chords and Harmonics. The badge is on the panel itself and not only in these notes, because a bench is allowed to change and a visitor is entitled to know that before they trust it.',
          'A seeded composer. The Song Maker\u2019s Randomize is uniform noise \u2014 every cell an independent 11% \u2014 which is why nobody plays it twice. This walks the scale instead: mostly steps with a leap now and then, momentum so a phrase runs in one direction for a couple of notes before turning, rests that get likelier as the phrase fills so Density actually means something, a slow arch up through the first half and back down through the second, and a landing on the nearest tonic, because degree zero reads as a full stop and a two-octave leap to find it sounds like the phrase was cut off.',
          'Momentum was not in the first version and the difference is the whole feature. Picking a direction afresh per note made the walk oscillate between two adjacent degrees, which is less a tune than two notes arguing. Twenty-five seeds now produce twenty-five distinct melodies with rests in them.',
          'The seed is the point: mulberry32, and a bench code carries the settings and the seed rather than the melody, so WL1.Minor.sine.132.7.24.10.4242.0 hands somebody else the same tune instead of a similar one. Copy, paste, load. A code that does not parse says so and prints one that does.',
          'Swing and Humanise change how a tune is played rather than what it says. Swing pushes every other step late by a percentage of one step \u2014 the thing a metronome-locked grid cannot do, and the reason the same notes stop sounding like a typewriter somewhere around 25%. Humanise jitters timing and loudness and is deliberately not seeded: it is the difference between two performances of the same tune, so it must not repeat.',
          'Auto bass puts the tonic two octaves down on the two steps a sixteen-bar phrase turns on, and a spectrum draws what the lab is actually playing. Every voice now goes through one gain into one analyser into the speakers instead of straight to destination, which is what makes that possible \u2014 a visualiser wired to the microphone would have drawn the room, and one wired to an oscillator it invented itself would have drawn a guess.',
          'The sixteen steps are tappable: a rest becomes a note at the last pitch used, a note becomes a rest, and the readout keeps saying what the bench is holding \u2014 8 notes in Minor, seed 4242 \u00B7 swing 24% \u00B7 humanise 10% \u00B7 auto bass on.',
          'A bug found while testing it, written down because it is the kind that survives a review and a green test run: the first version of the generator re-derived its state from the seed inside the returned function, so every call produced the same number, and any seed whose one number fell under the rest threshold composed sixteen rests and played silence. State lives in the closure and is mutated per call now, and a composer that places nothing falls back to a four-note phrase rather than handing over an empty strip.'
        ]
      },
      {
        label: '\u{1F6A2} What made it into 1.2.10, and what did not',
        items: [
          'Shipped: the star utilities \u2014 the overhauled layouts and the clear badges \u2014 are public as 1.2.10. They are layout and copy over a flag the catalogue has carried since 1.2, they touch no model, no storage and no network, and they behave the same on a phone and a desktop, which is why they were the part worth releasing on their own.',
          'Not shipped: the image progress work, the interruption work and the Music Lab bench. The bench calls itself experimental on its own panel, and the other two are repairs to a run rather than something a public release note would advertise as a feature. All three stay in this build and in the 1.3 cycle.',
          'Releasing part of an open cycle does not close it, so the counter did not reset: 1.3 has still not shipped, and this build is still a test version before it. What changed is that the public kitchen moved from 1.2.8 to 1.2.10 underneath an unchanged TVBR label.'
        ]
      },
      {
        label: '\u{1F9EA} What is checked',
        items: [
          'tests/image-progress-honest.test.js drives a whole cold run through the mapping without an engine, a GPU or a download: shards fold into the band instead of restarting it, a cached stage lands at the top of its band, a stage with no fraction is flagged rather than printed as a number, an unknown stage is held and labelled, the bar never walks backwards, and the estimate appears only after a measured rate.',
          'Two of those are written down because they were found rather than designed. elapsedMs counted from now forever when the run started at a zero epoch, because a truthiness check treats 0 as missing; and the seeded composer played silence for some seeds. Both have a test that fails if they come back.',
          'tests/star-utilities.test.js holds the rendering the catalogue test could not: a cupboard gets exactly one plinth and its star is not also on a shelf underneath, the badge names the cupboard, a guest appearance carries the corner badge and the cupboard in its accessible label, and Saved Toys and search results get no plinth at all.',
          'tests/music-lab-bench.test.js mounts the bench in jsdom with no AudioContext anywhere \u2014 the state it has to survive, since a page without one gets null from the bus and must not throw: sixteen tappable steps, a code that round-trips to the same tune, a code that does not parse refused in words, Density changing the note count, and a sweep of seeds in which none produces an empty pattern.',
          'tests/image-battery-survive.test.js drives the interruption itself with a fake wake lock and no GPU: the screen is asked for once and given back, asked for again after the system drops it, refused without throwing the run away, and reported as unavailable where the API does not exist; a device loss ends the run, releases the engine, and is worded as one; the bar holds its percent through a warning; and the whole surface is checked for the claims it must not make \u2014 no \u201Cfixed\u201D, no \u201Cnever paused\u201D, no \u201Cprevents the system from\u201D, because pinning an over-claim as a test is how an over-claim survives a review.',
          'Re-anchored rather than added: the progress pins in tests/ai-image-engine.test.js now describe the shard-aware mapping and the honest badge instead of the frozen one, and tests/backup-build.test.js points at this entry for the new build\u2019s title.'
        ]
      }
    ]
  },
  {
    version: '1.3 TVBR 2',
    date: 'November 24, 2026',
    title: 'Image generation was never going to work, and the warnings took up the whole room',
    tvbr: true,
    groups: [
      {
        label: '\u{1F3A8} Image generation: broken on every device, because it was broken on none of them in particular',
        items: [
          'It was reported from a 9950X3D2 and then from every other device tried, which is the shape a bug has when the hardware is not the variable. Asking the deployed site for the model files it wanted returned HTTP 404, and nothing in the repository ever produced them: the model fetcher downloads GGUF only, the build copies games, runtimes, GGUF weights and the ORT runtimes, CI pre-caches GGUF only, and git holds zero files under that path. The dev server mounted the route at a cache folder nothing fills, and the three tests that would have caught it were wrapped in a check for whether the folder exists, so they never ran.',
          'So every /imagine ended the same way, on every browser: Image generation hit a bump: Model file HTTP 404: studio-ai-hq3/t2i09/te09/gq.onnx — after tokenising the prompt, and for a short one after running a whole chat model to polish it first. Two people would have read that as a device problem, which is why it is written down here instead.',
          'Both models are gone rather than repaired. SDXS-512 and SD-Turbo were 2023 checkpoints at 512\u00D7512, and the chunks they wanted came to about 675 MB and 2.5 GB — over the build\u2019s 400 MB self-host budget between them, so even a working download path would have had to send somebody to Hugging Face anyway.',
          'What replaced them is FLUX.2 Klein 4B, through flux-klein.js 0.7.0 (MIT): a 4B rectified-flow transformer, Apache-2.0, and the model Bonsai Image 4B is itself a requantisation of. Bonsai was the starting point for the search and is not what ships, for a concrete reason — it runs on MLX for Apple silicon and Gemlite kernels for CUDA, and there is no browser runtime for either. The model underneath it has one.',
          'The kitchen\u2019s own dependencies already covered it. flux-klein.js asks for @huggingface/transformers ^4.2.0 and onnxruntime-web ^1.27.0 as peers, and this build ships 4.3.2 and 1.31.1, so the engine added code and no new runtime. Its transformer is hand-written WGSL on WebGPU; the tokenizer, the distilled 0.6B text encoder and the VAE decoder are the parts that run through ONNX Runtime.',
          'The weights are not in the deploy, on purpose. They stream from the model\u2019s Hugging Face repo into the browser\u2019s own origin-private storage on the first run and stay there, so a build ships about 5.1 MB of tokenizer and no gigabytes. The trade is stated where it is met: the first /imagine downloads roughly 3.3 GB on a phone or 5 GB on a desktop, and the progress line says so before it starts rather than after.',
          'Two builds sit behind one menu, because one size does not fit a phone. The desktop build keeps an int8 transformer resident on the GPU, about 4 GB, and is the fast path; the phone build streams int4 shards from storage through a three-slot ring and keeps roughly 0.6 GB resident, which is what survives an iPhone\u2019s 2 GB tab cap. Recommended lets the engine pick by device, and the other two pills force either. Decoding uses the 2.9M-parameter tiny decoder — about 11 MB instead of 107 MB per output shape and a twentieth of the work, for slightly softer textures — and two steps, the setting its author calls fast and good.',
          'Failures now say what they are. No WebGPU, no adapter granted, a GPU that ran out of room mid-run, a browser that will not keep the weights, a download that dropped: each has its own sentence, and an unrecognised error passes its own message through rather than being dressed up as one of them. A run that cannot finish is refused before it starts — a quota far below what the weights need gets an answer in words instead of a gigabyte download that the browser then throws away.',
          'Settings grew a \u{1F9F9} Clear cached image weights button that says how much is cached and gives it back, because several gigabytes of somebody\u2019s storage is not a thing to leave with no way out. And the old \u201CWASM CPU Fallback\u201D badge is gone: a WGSL transformer has no CPU path, so a browser without WebGPU now reads needs WebGPU \u00B7 not available here instead of being promised a slower one.',
          'One more thing had to go, and it would have survived a perfect engine: the stored choice of image model was clamped on the way in and on the way out, so anything that was not sd-turbo was written down and read back as sdxs-512. A new menu nobody can select from is still a broken feature, so both accessors now keep the id they are given and the menu resolves it — including a retired one, which is captioned as retired on any picture a saved chat still holds rather than being relabelled with the model that ships now.'
        ]
      },
      {
        label: '\u26A0\uFE0F The warnings: one sentence on screen, and the rest one tap away',
        items: [
          'The device disclaimer is 887 characters and 155 words, and it was printed in full in four places: the Waffle AI header, the welcome bubble, Settings, and the English cupboard popup. Opening the AI panel alone put about 1,774 characters of it on screen before anybody had asked a question, and most of it described hardware the reader does not have.',
          'What stays visible now is 28 words: Waffle AI runs entirely on this device, so speed and quality depend on your hardware. Nothing you type is uploaded, and some devices cannot run it at all. That is the whole of it, in the header, in Settings and in the English popup alike.',
          'Nothing was cut to get there. The 887 characters moved behind the device pill, word for word, into a popup that also carries the profile this device was recognised as and the hardware facts the runtime choices are made from — cores, RAM, the WASM budget, OPFS, storage used against quota, whether llama.cpp can use the GPU, and whether threading is available. The pill was already pressable; it now opens that instead of only re-asking which device this is, and the question is still one tap further in.',
          'The welcome bubble is a greeting again. It used to open with a nine-model menu, a list of attachable file types and the full disclaimer — several screens to scroll past, and model names that went stale with every release. The menu is in Settings and always was.',
          'The English popup kept the one sentence that is actually about English tools — Waffle Translate uses Google Translate, the others use on-device AI with automatic fallbacks — and its separate 260-character iPhone paragraph joined the long text in the popup rather than staying inline.'
        ]
      },
      {
        label: '\u{1F9F0} What had to change underneath, and what deliberately did not',
        items: [
          'waffle-image-gen.js was rewritten rather than patched: 501 lines of chunk tables, a CLIP tokenizer, alphas-cumprod and hand-assembled ONNX feeds became 596 lines that drive an engine somebody else maintains. Same contract in and out, so the chat surface that calls it did not have to change shape.',
          'The tokenizer is the one asset a bundler cannot hand over. The engine finds it with new URL(\u2018../tokenizer/\u2019, import.meta.url) marked @vite-ignore, and Rollup emits no directory for that, so the build now copies the package\u2019s three files to dist/flux-klein-tokenizer/ and the dev server mounts the same path; the module probes for them and passes the directory over. The probe checks the content type as well as the status, because a static host that answers a missing path with its index.html would make an HTML page look like a 5 MB vocabulary.',
          'ONNX Runtime\u2019s .wasm files are self-hosted where the build already puts them, at dist/ort/, found by the same probe and falling back to the library\u2019s CDN copy when they are not there. Mixing one build\u2019s ORT JavaScript with another\u2019s wasm is the failure that downloads a model fine and then dies creating the session, so this is looked up rather than assumed.',
          'The service worker\u2019s list of paths that carry real model files lost api/waffle-ai/sd-models/, which no build ever produced. It kept the GGUF one. The image weights never needed a place on that list: they come from a different origin, and the worker steps aside for those before it looks at any of it — which is also why several gigabytes of them are not copied into the cache a second time.',
          'No cross-origin isolation headers came back. ONNX Runtime can thread its wasm only under COOP/COEP, and removing those is what made workers start again on GitHub Pages; the engine tolerates their absence and runs single-threaded, a few seconds slower per prompt. The thread count still reads the same flag and lands on one, exactly as the chat pipeline does.',
          'The prompt-polishing step was reworded, because it was writing for a different model. Klein\u2019s text encoder is a distilled Qwen3 run through a chat template, so it is handed one vivid descriptive sentence instead of a comma-separated pile of Stable Diffusion tags.',
          'Two build failures turned up on the way, both worth recording. The engine runs its ONNX jobs in a module worker that imports its own cache module, which Rollup cannot emit as iife — Vite\u2019s default for workers — so the build stopped dead until worker.format became es. Every browser that can run the image model at all supports module workers, and the runtimes the rest of the kitchen uses are copied as plain files rather than bundled, so nothing else changed shape.',
          'The second was older than this build. The step that removes duplicate copies of ONNX Runtime\u2019s wasm kept only the first stable directory it found, so a hashed asset byte-identical to dist/ort/x.wasm survived for differing from dist/ort-chat/x.wasm — 14.8 MB of dead weight on every deploy. It now matches any of them by size. dist/assets is 1.8 MB and holds no wasm at all.',
          'What the change costs, measured on the build rather than estimated: the main bundle went from 726 kB (252 kB gzipped) to 745 kB (258 kB gzipped) — about 6 kB gzipped for the new wiring, the two popups and this entry itself, which ships in the bundle it describes. Rounded to whole kilobytes on purpose: quoting two decimals here would be a number this very sentence keeps changing. The engine is a separate 77.63 kB chunk (28.35 kB gzipped) that loads only when somebody asks for a picture, with an 8.53 kB worker beside it, and 5.2 MB of tokenizer served as plain files that the service worker does not precache.',
          'Reading how much of that tokenizer-and-weights storage is in use does not load the engine, which is the reason the Settings readout walks the browser\u2019s own storage directory instead of asking the library: importing the pipeline to print one number off a button would have cost 28 kB gzipped the first time anybody opened Settings.',
          'The stylesheet gained two blocks and a cap: a small button under a short warning, and a device popup whose card is height-limited and scrolls inside itself so the button that closes it cannot end up below the fold on a phone.'
        ]
      },
      {
        label: '\u{1F9EA} What is checked, and what cannot be from here',
        items: [
          'The dead tests are gone rather than re-aimed. Three assertions about pre-cached SD chunk files were inside a check for a folder that does not exist, so they had never run; the assertion that the model menu exposes SDXS-512 and SD-Turbo was pinning the thing that was broken. Both were replaced by tests of the menu that ships, the storage maths, the size and step clamps, the progress bands and the failure sentences.',
          'The warning split is tested on both sides: that the short line is what the header, Settings and the English popup render, that it stays inside 20 to 30 words, and that the long text is still present in the popups it moved to, unchanged — so shortening the visible warning cannot quietly become deleting it.',
          'What no test in this repository can do is run the model. Generating a picture needs a WebGPU device and several gigabytes of download, and the test runner has neither; the browser tests here are Chromium-in-CI only and cannot install a GPU. So the engine is tested up to the boundary — the preflight, the clamps, the progress mapping, the error wording — and the generation itself is verified by the build succeeding and by the paths it asks for existing, which is the check that was missing last time.',
          'The suite is 375 tests: 349 pass here and 26 fail in this sandbox because they drive a real Chromium that cannot be installed in it — the same 26 that have always been CI-only, and they are green there. The two new files are 16 tests on the engine and 7 on the warning split, and five existing files were re-anchored rather than deleted: the changelog\u2019s own entry indices shifted by one when this build was added above them; the catalogue test that pinned the two dead checkpoints now checks the menu that ships; the service worker\u2019s list of served model paths lost the entry that never served anything; the lock test follows the device probes into the function they were folded into; and the overlay test follows the device pill into the popup it now opens.',
          'Known rough edges, written down rather than discovered later: the first run is a multi-gigabyte download with no way to shrink it, the desktop build wants about 5 GB of GPU memory and will fail on a small card, output is capped at 1024\u00D71024 and at 512\u00D7512 on an iPhone, and a browser that will not grant persistent storage may re-download the weights on a later visit. The weights come from a third-party Hugging Face repo, so their availability is not this kitchen\u2019s to guarantee.'
        ]
      }
    ]
  },
  {
    version: '1.3 TVBR 1',
    date: 'November 24, 2026',
    title: 'The chat grew a memory and a sidebar, and this build comes before its release rather than after it',
    tvbr: true,
    groups: [
      {
        label: '\u{1F3F7}\uFE0F TVBR, and how it differs from the TVAR entries below',
        items: [
          'TVBR means Test Version BEfore Release: a build made toward a release that has not shipped yet. This is the first one for 1.3, which is why it reads 1.3 TVBR 1 while the public kitchen still says 1.2.8 — the version it is testing toward does not exist yet, and the overhauled chat below is what 1.3 is being tried on.',
          'The six entries below read TVAR, Test Version AFTER Release, because that is what they were: builds made on top of a release that had already shipped, three on 1.2 and three on 1.1. They are 1.2 TVAR 1 to 3 and 1.1 TVAR 1 to 3, and none of them has been renamed or renumbered. The two labels say where a build sits relative to its release, not which spelling was current when it was written.',
          'So the counter opens again here rather than continuing from TVAR 3: when 1.3 ships it goes back to 0 with it, and anything built on top of 1.3 after that is 1.3 TVAR 1. Cycle and count are separate constants so a new cycle can start at 1 without touching the entries already written down.',
          'The public kitchen reports none of it. It is at 1.2.8 and stays there, and everything in the three groups below is the backup kitchen\u2019s alone: one flag, read by both the markup and the behaviour, decides which build is which, so there is no rail without a store behind it and no store writing chats nobody can open.'
        ]
      },
      {
        label: '\u{1F9C7} The layout: a chat that looks like a chat',
        items: [
          'Two panes instead of one column. A 264px rail of every conversation kept on this device sits beside the conversation, and the dialog widened from 680px to as much as 1040px to make room for it. Below 900px the rail slides over the chat as a drawer from a \u2630 Chats button in the header and starts shut, because a phone has no room for both and opening the kitchen to find a panel hiding the conversation defeats the purpose.',
          'Every entry is named after the first thing said rather than \u201CNew chat\u201D: 44 characters of it with the markdown stripped, an emoji from six rules about what was asked (\u{1F3A8} an image, \u{1F9FE} code, \u{1F9C7} the kitchen, \u{1F522} sums, \u270D\uFE0F writing, \u{1F50E} a lookup, \u{1F4AC} anything else), then how many messages it holds and how long ago. A thread is named once and left alone, so the rail cannot shuffle under the cursor while it is being read; \u270E renames one by hand and a hand-renamed title is never overwritten.',
          '\u201CNew Chat\u201D stopped destroying anything. It used to reset the conversation to the greeting and the old one was simply gone; now it starts a fresh thread and the previous one stays in the rail, which is the whole difference between a new chat and a deleted one. Deleting is its own act: \u2715 on one thread, or all of them behind a confirmation that says what Export is for.',
          'Opening the kitchen reopens the last conversation instead of a blank one, and a pill under the disclaimer names where it is being kept — Saved, Saving\u2026, Saved without its pictures, Could not save — rather than leaving a person to guess whether what they just said was written down.',
          'The rail keeps the house style rather than borrowing one: 2.5px ink borders, the wooden drop shadow, butter yellow on the thread that is open, buttons that lift on hover and stay visible where there is no hover to find them. 31 new blocks in the stylesheet, none of them touching a rule the rest of the kitchen reads.'
        ]
      },
      {
        label: '\u{1F4BE} Where the chats live, and the wall in front of them',
        items: [
          'Chats are saved as they settle: one write at the end of every repaint, debounced 350ms and skipped entirely while a reply is still streaming, so a half-written answer is never the one that gets remembered. One hook at the end of rendering rather than one at each of the four places a message is added, because those drift apart.',
          'Storage is tried in order — IndexedDB, then localStorage, then plain memory — and the pill names which one the kitchen got, because \u201Csaved\u201D means a different amount on each. A browser that refuses both still gets a conversation that lasts the visit, and says so instead of pretending otherwise.',
          'The limit, stated plainly because it cannot be engineered around: nothing a browser stores survives Clear cookies and site data. Chrome and Firefox file IndexedDB, localStorage, OPFS and the cache together under that one button, and this kitchen has no server to put a conversation anywhere else — it is a static site. What survives closing the tab, restarting the browser and coming back next month does not survive that.',
          'Export writes every kept chat into one .json file, which is the only copy that outlives a wipe, and Import reads one back. Importing cannot roll a live conversation backwards: threads are matched by id and the newer timestamp wins, so an old file meeting a chat that has moved on loses, and the tally reports how many were added, updated and left alone. A file that is not a chat export is refused with the reason it was refused.',
          'Pictures are the part that does not fit. A generated image is a data URL, so a thread is held to 6 MB and anything over it is written down without its pictures, each one flagged so the bubble can say why; if the smaller copy is refused too, the write reports the failure rather than swallowing it. The rail holds 60 threads and drops the oldest past that.',
          'What never reaches storage: streaming state, progress bars and empty bubbles are stripped on the way in, so a reopened chat cannot show a reply frozen mid-word. The storage itself is one new module, waffle-chat-store.js at 348 lines, which nothing but waffle-ai.js imports.'
        ]
      },
      {
        label: '\u{1F9EA} What is checked, and what is not',
        items: [
          'tests/ai-chat-store.test.js, 12 tests, and IndexedDB is one of the paths rather than being skipped: a store only ever tested against an in-memory Map proves nothing about the one that ships. The tests carry a small fake — open, one object store, the five requests the backend issues — that can also be told to refuse a write, which is how the quota path gets tested at all.',
          'What they hold down: a round trip through IndexedDB newest-first; titles from every emoji rule plus the markdown, multi-part and over-long cases; pictures dropped over budget with the words kept; a quota refusal answered by a second, smaller write and then reported honestly when that fails too; the 60-thread cap; the three-step fallback and its degraded flag; a localStorage kitchen that finds its chats after a simulated reload; an export/import round trip; the newer-wins rule in both directions; seven files that are not exports, each refused; and the sanitising helpers against null, a bare string and a 200-character title.',
          'What they do not: no real browser storage runs in node, so IndexedDB here is a fake wearing the same interface, and nothing asserts the layout — the rail, the drawer and the pill are checked by eye in the preview, while tests/ai-overlay-dom.test.js still pins the overlay ids the rest of the kitchen depends on. The browser tests remain CI-only, because that is where there is a Chromium to run them in.'
        ]
      }
    ]
  },
  {
    version: '1.2 TVAR 3',
    date: 'November 23, 2026',
    title: 'The error that blamed file:// for everything, and the notice that replaces it',
    tvbr: true,
    groups: [
      {
        label: '\u{1F41B} What was actually wrong',
        items: [
          'workerJob had one fallback string for every runtime that would not start, and it named a protocol: "Runtime could not load over file://; serve over HTTP." It was reached whenever the browser handed over no message of its own, which happens on a served page too — a worker file left out of a deploy, a host sending it as text/plain, a rate-limited request. The diagnosis was invented by the code that printed it.',
          'It also read two different ways for one wall. A worker can fail at the onerror event, or by throwing straight out of its constructor, which is what an opaque origin does; the catch passed the raw error through untouched, so which of the two messages a person saw depended on the browser they were holding.'
        ]
      },
      {
        label: '\u{1F527} What it does now',
        items: [
          'One helper decides from the page\u2019s own protocol. On file:, blob: or content: it names the wall and hands over the address the kitchen is served from, which is a literal because a folder has no address bar to derive one from. Anywhere else it reports the exact runtime URL that did not load and the protocol it was asked over.',
          'Where the browser does have something to say, the browser\u2019s message is passed through instead of being replaced, so a real break on the served site stays visible rather than being dressed up as somebody\u2019s disk.',
          'Both failure paths go through the helper now, so the two read the same. python is still the one language with a worker file of its own and is reported as python-worker.js rather than the shared one.',
          'The five tools whose work happens in a worker — CodeHub, the Regex Tester and the three formatters — get one notice each at the top, built by the same helper, returning null on a served page so it costs nothing where it is not needed. The two tools in that cupboard which run in the page, the JSON validator and the hash playground, get none, and a test holds that line.'
        ]
      },
      {
        label: '\u{1F9EA} What is checked, and what is not',
        items: [
          'tests/code-runtime-origin.test.js mounts all seven tools in jsdom twice, once with a served location and once with a folder one, and asserts the notice lands on exactly the five that need a worker. jsdom will not mount a document whose URL is a file: one — it throws about localStorage on an opaque origin, the same rule wearing a different hat — so the location is swapped under it instead.',
          'The counts in the notice come from the catalogue and are cross-checked against the filter field, which is stamped from the same array, so a hard-coded 41 would fail rather than quietly drift.',
          'What this does not do is make a language run from a folder. The worker is also the thing that stops a runaway program: a while(true) in one is terminated when its time is up, the same protection that ends a regex backtracking catastrophically, and run in the page instead it freezes the tab and takes the kitchen with it. The browser suite still executes 17 languages and the four formatter operations over HTTP on every deploy, untouched.'
        ]
      }
    ]
  },
  {
    version: '1.2 TVAR 2',
    date: 'November 23, 2026',
    title: 'SCRAPPED: the offline download, and the wall four builds of it kept finding',
    tvbr: true,
    groups: [
      {
        label: '\u{1F5D1}\u{FE0F} What is gone',
        items: [
          'The whole offline package: the archive, the packer that made it, the second build of the kitchen it opened into, the pages and launcher scripts that came with it, the button in this kitchen that handed it over, and the workflow steps that built, verified and published it on every deploy. The release it lived under is deleted as well, so there is no 228 MB file to download and nothing left that looks like one.',
          'The public kitchen is untouched by any of it. The folder build never loaded on the served site, the button only ever appeared here, and the four builds that produced the archive never changed what a visitor sees.',
          'What stays is the offline route the site already had, and it needs no download at all: after one visit the kitchen keeps a copy of itself in the browsers that allow one, along with the model weights it can serve, so it survives losing the connection.'
        ]
      },
      {
        label: '\u{1F9F1} The wall, stated once',
        items: [
          'A page opened off the disk gets an origin the browser will not trust, and from one it refuses three things: an ES module, a worker, and a fetch of the file sitting next to it. That is not a bug in this site and there is no setting to flip. It is the same rule everywhere, which is why four builds of packaging all arrived at the same place.',
          'One of the three was beatable. The folder build compiled the whole kitchen into a single classic script, which a page on the disk will run, and the kitchen did open: 115 utilities on the shelves, 95 of them working, and 26 of the 51 games playable on tap, all of it measured from the source rather than remembered.',
          'The other two are not. Waffle AI needs a worker, or a module, or a fetch of 93 MB of weights, and every engine there is to choose from \u2014 Wllama, ONNX Runtime, node-llama-cpp \u2014 needs at least one of the three. CodeHub needs a worker for every language it offers, and every one of them fails the same way, which is why the whole cupboard goes with a single line about a runtime that could not load over file:.'
        ]
      },
      {
        label: '\u{1F4DC} The four builds this one replaces',
        items: [
          'The first was the whole kitchen as one HTML file, which proved the bundling worked and that a file that size is not something anybody opens twice. The second replaced it with the entire site as an archive, because one file cannot hold 400 MB of games, runtimes and weights, and because shipping it inside the site would have taken Pages to 661 MB and burned the monthly bandwidth in about 440 downloads.',
          'The third was the correction: the archive\u2019s own front page explained itself instead of being the kitchen, and assumed a reader had Python or a terminal ready. It became a second build of the kitchen as a classic script, with the AI engines aliased out \u2014 which is what kept 190 MB of base64 WASM out of it \u2014 and the game catalog bundled in, so a double-click landed in the kitchen instead of in a wall of instructions.',
          'The fourth was the closest to working, and is the one this entry closes. It fixed a picker that had only ever recognised file:, so a tablet\u2019s content: address got the folder build instead of a module it would refuse; it moved the manifest, the fonts and the app stylesheet into that picker; it inlined the five faces into the folder build\u2019s own sheet; and it stopped the console shouting about a service worker, a warm-up, a status probe and a pre-cache that a page on the disk cannot do.'
        ]
      },
      {
        label: '\u{1F9EE} What was worth keeping from it',
        items: [
          'The habit of measuring instead of remembering. The last build counted what a folder could run from the source it had just built \u2014 every game classified by whether it fetches, uses a worker, loads a module or pulls in WASM, every utility by which branch of its cupboard\u2019s mount chain reaches an AI \u2014 and refused to pack an archive whose own documents disagreed with the count.',
          'It caught the copy lying in both directions: once claiming all 115 utilities work off the disk, and once claiming only 85 do when 95 actually did. Both numbers had been written by hand, in five places, and neither had been checked against anything.',
          'The machinery went with the archive it was built for, because a served site has nothing to refuse. The lesson did not: a count in a document is a claim about the source, and belongs in a test that reads the source.'
        ]
      },
      {
        label: '\u{2705} How the removal was checked',
        items: [
          'By the suite rather than by eye. Nothing in the source may mention the packer, the folder flag, the archive\u2019s front page or the button that offered it; the workflow may contain no step that builds, verifies or publishes an archive; and the page that answers a folder double-click may not point at a file that no longer ships.',
          'The release beside this one is the same kitchen as 1.2.6 with all of that lifted out, so the version moves because the codebase does, not because anything a visitor can see has changed.'
        ]
      }
    ]
  },
  {
    version: '1.2 TVAR 1',
    date: 'November 22, 2026',
    title: 'Eight models, tighter quants, and a door that is not a gesture',
    tvbr: true,
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
    tvbr: true,
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
    tvbr: true,
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
    tvbr: true,
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
    version: '1.2.12',
    date: 'November 27, 2026',
    title: 'Chat runs about twice as fast on a CPU, an interrupted download now continues instead of restarting, and the device report was budgeting a heap that did not exist',
    groups: [
      {
        label: '\u{1F4AC} The chat runtime moved to Wllama 4, and the speed is not a rounding error',
        items: [
          'Generation is 2.1 to 2.5 times faster and prompt processing 2.4 to 2.8 times faster on Chrome’s CPU path, on the runtime’s own benchmarks against the version this kitchen was on. Firefox gains a little less, Safari less again.',
          'The gain comes from two things that were simply not turned on: llama.cpp’s SIMD and relaxed-SIMD kernels, and a 32-bit memory build in place of Memory64. Nothing about how a reply is produced changed, which is why the whole upgrade needed no code change at all.',
          'It matters most on the devices that need it most. A phone or a tablet with no usable GPU runs every token through one WASM thread, so the CPU path is not a fallback there — it is the product.',
          'What it does not do is add threads. A static host sends no COOP/COEP headers, so SharedArrayBuffer is unavailable and the runtime stays single-threaded however many cores the device has. That trade was made deliberately: those headers would break every embedded game and every cross-origin asset in the kitchen.',
          'Speculative decoding arrived in the same release and is deliberately left off, because on a CPU it is usually slower — and a CPU is the only place most visitors are running this.'
        ]
      },
      {
        label: '\u{1F4E5} A download that gets interrupted now continues instead of starting again',
        items: [
          'A model file is a few hundred megabytes at the smallest and a couple of gigabytes at the largest, fetched over a phone radio by a tab the operating system is free to suspend. Losing that download near the end used to mean losing all of it.',
          'Progress is written every 256 MB as the file arrives, and an interrupted fetch continues from the last byte written rather than from zero, wherever the server and the storage both honour a range request. Five attempts in a row that produce no new bytes is what finally gives up.',
          'A file of 64 MB or more also arrives over several connections at once instead of one, which is the difference between a model taking four minutes and taking ninety seconds on a link that would otherwise idle between chunks.',
          'Loading a model that is already in on-device storage is about 2.8 times faster as well: the cache is read through a synchronous access handle straight into the runtime’s memory instead of being copied through the page first.',
          'None of this makes a first download small. It makes a second attempt cheap, which on a device that suspends tabs is the part that decides whether a model ever arrives at all.'
        ]
      },
      {
        label: '\u{1F9EE} The device report was budgeting a heap that did not exist',
        items: [
          'A real report from a real tablet said two things at once: that its GPU was verified, and that the chat runtime could not use it because the adapter has no FP16. The kitchen believed the first and ignored the second when it worked out how much memory a model could have.',
          'With a GPU present it budgeted 2 GB, on the reasoning that the weights would live in video memory and the heap only had to hold scratch. On that device the weights were never going to live in video memory, so the heap had to hold every one of them — and the budget described a machine that did not exist.',
          'The same confusion silenced the warning. Every guard that meant “unless the GPU can take it” read “an adapter exists”, so a model too large for the heap was attempted anyway with nothing on screen to say why. That is a hang with no explanation, which is the worst of the available outcomes.',
          'Both now key on the fact that was actually established: whether the runtime that will run the model can use the GPU. On the device that reported this, the heap budget moves from 2048 MB to 2662 MB — 614 MB of room an 8 GB machine was being told it did not have.',
          'The fix is not “make the number bigger”, and it does not only move it up. Treat the same device as a memory-tight phone and the budget becomes 1843 MB rather than 2048, because a tab the system is free to reap gets the conservative figure it should always have had. What changes in both directions is the ending: a model too large for the heap is refused in a sentence that names both numbers and the GPU that cannot help, instead of being attempted until the bar stops moving.',
          'No model on the public menu is near either figure, so nothing a visitor can pick today behaves differently because of this. What changes is that the number in the device report is the number the kitchen actually uses, which is the difference between a diagnostic and a decoration.'
        ]
      },
      {
        label: '\u{1F6AB} What did not change',
        items: [
          'Still 120 utilities across eight cupboards, all eight fifteen deep, and the games cabinet at 51. Nothing was added, moved or renamed.',
          'A GPU without FP16 still runs chat on the CPU. The runtime’s WebGPU backend requires that feature and nothing here changes it, so the gate that sends such a device to the CPU was always correct — it was only ever applied to the wrong number.',
          'Image generation is untouched: its engine, its progress reporting, the screen lock it holds, and the way an interrupted run is remembered and offered back are all exactly as they were.',
          'Still no accounts, no subscriptions and no uploads. A model is downloaded once to the device and runs there, and nothing typed into the chat leaves it.'
        ]
      }
    ]
  },
  {
    version: '1.2.11',
    date: 'November 25, 2026',
    title: 'Math & Numbers grows to fifteen, Lorem Ipsum becomes a file splitter that names its own pieces, and a reply costs less to watch',
    groups: [
      {
        label: '\u{1F522} Math & Numbers: five new tools, and every one of them shows its working',
        items: [
          'Equation Solver does linear, quadratic and two-equation systems. An answer arrives with the substitution it came from \u2014 x = (7 \u2212 22) \u00F7 3, not just 5 \u2014 and a quadratic brings its discriminant, its vertex, and its complex pair when the curve never reaches the axis.',
          'It refuses in sentences rather than dividing by zero. a = 0 on the quadratic tab says that is a straight line and points at the tab that solves it; two parallel lines say they never meet; two that are the same line say every point on them is a solution.',
          'Statistics Lab takes a pasted list and gives the whole picture: count, sum, mean, median, both quartiles, the range between them, outliers by the 1.5 rule, and a histogram of what you actually typed rather than of a smooth curve fitted to it.',
          'It says what it skipped instead of quietly dropping it, and it will not report a spread for a single number \u2014 a median of one value is a fact, a quartile of one value is a fiction.',
          'Matrix Calculator handles 2\u00D72 and 3\u00D73: add, subtract, multiply, transpose, determinant and inverse, with the matrices drawn in brackets rather than typed into a grid of labels. A singular matrix is told to be singular instead of being inverted into nonsense.',
          'Geometry Calculator measures nine shapes, flat and solid, and every measurement comes with the formula and the numbers substituted into it. A triangle gets Heron\u2019s formula from its three sides \u2014 and three sides that cannot form a triangle are refused rather than measured.',
          'Factors, GCD & LCM is the companion to the Prime Checker that was already here: prime factorisations with their exponents, the full divisor list, and GCD and LCM across a whole set of numbers, with a coprime set named as one.',
          'All five recompute as you type, not only when you press the button. The button is still there, because pressing a thing is a different kind of confirmation than watching a number change.',
          'They are built with the cupboard\u2019s own chunky controls like the ten that were already there \u2014 no browser dropdowns, no thin native sliders, no checkboxes.'
        ]
      },
      {
        label: '\u2702\uFE0F Lorem Ipsum is gone, and a file splitter took its place',
        items: [
          'The kitchen had one tool that generated prose nobody reads. It now has one that handles files people actually have, and the cupboard is the same size it was.',
          'The naming is the point of it, so it is the first thing on screen: a 23 MB notes.txt split at 5 MB comes out as notes.part01.txt, notes.part02.txt and so on. Extension last, so each part opens as the type it came from, with no renaming step before you can use any of them.',
          'What it deliberately does not produce is notes.txt.part1 or notes.txt.firstpart. Those are grouping names, and every one of them needs a rename before anything can open it \u2014 a tool that hands you twenty of those has handed you twenty chores.',
          'If you want the grouping names anyway, the switch is right there, and it says out loud that those parts will need renaming. The default is the one that does not.',
          'Part numbers are zero-padded, so a file manager sorts part02 before part10 and the twentieth piece is not waiting somewhere in the middle of the list.',
          'Files with no extension split cleanly, a leading dot is treated as a name rather than an extension so .gitignore stays .gitignore, and archive.tar.gz keeps the .gz it is actually opened by.',
          'Splitting never reads your file into memory \u2014 it slices it \u2014 so a file far larger than the device could hold still splits on it. The neighbouring text tools have a 20 MB reading limit for exactly the reason this one does not.',
          'Joining puts the pieces back in numerical order rather than in the order your file manager happened to hand them over, and it refuses a missing part, a duplicated one, a name with no part number, or pieces belonging to two different files. A joined file with a hole in it is worse than no file.',
          'It stops at 200 parts and tells you why, because a browser will not reliably hand over more downloads than that and quietly dropping some of them is the failure nobody can see coming.',
          'Every part name and size is listed on screen before anything downloads, and the browser will ask permission for multiple downloads \u2014 that is the whole operation, not something going wrong.'
        ]
      },
      {
        label: '\u{1F4AC} Waffle AI: showing the next word no longer costs the whole conversation',
        items: [
          'A reply arrives a token at a time, and the page used to rebuild the entire conversation for every one of them: each message\u2019s markdown parsed again, and every image in the thread destroyed and recreated. The cost of the next character grew with the length of the chat, which is backwards.',
          'A token now repaints the bubble it is arriving in, at most once per screen frame, and the conversation is rebuilt once when the reply finishes. Same streaming to look at, and far less work behind it.',
          'This is main-thread work, and main-thread work is what a phone spends its battery and its patience on. A long thread used to make every reply more expensive to watch than the last one.',
          'The part that could have broken quietly was the numbering: a code box is numbered by its place in the whole conversation, so repainting one bubble on its own could have left an older bubble\u2019s Copy button holding somebody else\u2019s code. It does not, and there is a test that clicks the buttons to say so.',
          'Image generation is untouched by this. It still reports on its own one-second clock, and that clock still paints directly rather than waiting for a frame \u2014 it is the signal an interrupted run is judged by.',
          'What this does not do is make the model faster. Tokens still arrive at whatever speed your device can produce them; this only makes watching them arrive cheap.'
        ]
      },
      {
        label: '\u{1F9FA} What did not change',
        items: [
          'The kitchen is 120 utilities across eight cupboards, up from 115, and for the first time all eight cupboards are fifteen deep rather than seven of them matching and one lagging behind.',
          'Every tool that was already here opens the way it did, including the ten in Math & Numbers that the five new ones joined. Nothing was moved to make room, and nothing was renamed.',
          'Still no accounts, no subscriptions and no uploads. Everything runs on your device, and the five new tools are arithmetic that never leaves it.',
          'The star of each cupboard still sits on its own plinth above the shelf, the games cabinet is still 51 games, and CodeHub still runs 41 of its 42 languages in the browser.'
        ]
      }
    ]
  },
  {
    version: '1.2.10',
    date: 'November 24, 2026',
    title: 'Every cupboard opens on its star now: Art Studio and seven others came off the shelf and onto a plinth',
    groups: [
      {
        label: '\u2B50 A plinth instead of a slot',
        items: [
          'The catalogue has named one utility per cupboard as its star since 1.2, and until now nothing on screen read that flag. Art Studio \u2014 layers, 18 brushes and a 4096 px canvas \u2014 sat on a shelf in Art & Coloring looking exactly like any of the fourteen utilities beside it, which is not what the tool a cupboard is known for should look like.',
          'A cupboard now opens on a plinth. The star sits above the shelves on a tile 108 px across against a shelf object\u2019s 82 \u2014 a third wider, and close to twice the area \u2014 in the cupboard\u2019s own colour, with its description under the name and an \u201COpen it \u2192\u201D on the tile. The shelves below hold everything else.',
          'The star comes off the row rather than being emphasised inside it, and that is the part which makes this a layout instead of a highlight: a cupboard reads as one flagship and the tools beside it, rather than fifteen equal tiles one of which glows. It also means a cupboard opens on the tool it is known for rather than on whatever happens to sort first.',
          'The description is why the plinth is bigger. A shelf label is forty pixels of name with no room for anything else, and \u201CMulti-layer Photo & Video NLE + WebM export\u201D is the difference between recognising Waffle Studio and wondering what it is.',
          'The heart sticker moved with the tile and kept its state, so a saved star is still saved on its plinth, and the plinth opens its tool through the same binding every other tile uses. Nothing about tapping a utility changed.'
        ]
      },
      {
        label: '\u{1F3F7}\uFE0F One badge, meaning the same thing everywhere',
        items: [
          'The badge names the cupboard: \u201C\u2B50 Star of Art & Coloring\u201D on the plinth. It is one sentence rather than one design, so the same badge cannot drift into meaning two different things in two different places.',
          'The same tool as a guest keeps the shelf it is on and wears a corner \u2B50 instead \u2014 on Saved Toys, in Recently Played, and in search results, where three hits could each have claimed a plinth and none of them should. A guest does not take over somebody else\u2019s shelf, so the emphasis there is a corner star and an underline rather than a bigger tile.',
          'A screen reader is told the same fact either way. The plinth\u2019s open button reads \u201COpen Art Studio, star of the Art & Coloring cupboard\u201D, a guest tile carries that sentence as its own label, and the visible \u2B50 is decorative so it is never spoken twice.',
          'The heart on both is a real toggle reporting its state, and its label changes between Save and Unsave along with the state it is in.'
        ]
      },
      {
        label: '\u{1F3A8} The eight stars, and the cupboard that has none',
        items: [
          'Calculator in Math & Numbers, CodeHub in Coding & Developing, File Converter in Text & Files, Art Studio in Art & Coloring, Physics Hub in Science & Physics, Waffle Translate in English & Languages, Waffle Music Lab in Music & Composing, and Waffle Studio in Videography & Editing.',
          'Games & Fun gets no plinth. It declares itself as its own star and carries no utility list: 51 games are not one flagship, and the arcade has its own cabinet view rather than shelves of tools.',
          'Each star is derived from the cupboard it belongs to instead of being listed a second time, so a cupboard cannot end up with two flags or none \u2014 and a test holds that, along with one plinth per cupboard and no star left sitting on a shelf underneath its own plinth.'
        ]
      },
      {
        label: '\u{1F6AB} What did not change',
        items: [
          'No behaviour did. The kitchen still has 115 utilities across eight cupboards, every tool opens the way it did, and nothing was added, removed or renamed to make the layout work.',
          'Both layouts collapse on a phone: the plinth tile drops to 74 px and the badge shrinks with it, so a flagship does not eat the screen it is being shown on.',
          'Neither animates for anybody who has asked the system not to. The plinth\u2019s press transform and transition sit inside a prefers-reduced-motion block, along with the rest of the kitchen\u2019s.',
          'Search did not change either. Results are still two to a shelf on a phone and four on a wide screen; the only difference is a corner star on the ones that are somebody\u2019s flagship.'
        ]
      }
    ]
  },
  {
    version: '1.2.8',
    date: 'November 23, 2026',
    title: 'CodeHub stopped blaming the wrong thing, a folder is told once instead of 41 times, and one game now comes with a warning',
    groups: [
      {
        label: '\u{1F50E} An error that guessed, and guessed wrong',
        items: [
          'When a runtime would not start, every language in CodeHub answered with the same line: "Runtime could not load over file://; serve over HTTP." It said that wherever the page was served from. On the site itself, a runtime that genuinely failed to load — a file missing from a deploy, a wrong content type from the host — reported itself as a problem with somebody\u2019s disk, and sent whoever went looking after the wrong cause.',
          'The message now says which wall was actually hit. Served over HTTP it names the file that did not load and the protocol it was asked over, and where the browser has something of its own to say, the browser\u2019s words come through instead of being replaced by a guess.',
          'How the runtimes load has not changed at all: the same worker files, the same limits, the same heavy runtimes given longer to warm up. The deployed worker was fetched and read while these notes were being written, and it is served intact.'
        ]
      },
      {
        label: '\u{1F4C1} What a folder is told now',
        items: [
          'A page opened straight off a disk has an origin no browser will start a worker from. CodeHub runs 41 of its 42 languages inside one, and the Regex Tester, the CSS Minifier, the JavaScript Formatter and the SQL Formatter run theirs in one too — five tools that all fail with the same line, whichever language is picked.',
          'Those five now say it once, at the top, before a single character is typed: what the wall is, that it is the origin and not the runtime, and the address of the kitchen that is served, as a link that can be tapped. A folder can still follow a link even when it cannot start a worker.',
          'The old advice is gone from it. Serving over HTTP is not something a folder can do — there is no server in it, and a tablet needs an app of its own to run one — so the notice hands over an address instead of an instruction.',
          'The HTML / CSS / JS sandbox still runs from a folder, because it executes in the page with no worker and nothing fetched, and the notice says so rather than leaving one working language to look like a broken promise about the other 41.'
        ]
      },
      {
        label: '\u26A0\uFE0F A warning on the one game that needs it',
        items: [
          'BitLife is a life simulation built around grown-up life — relationships and sex, crime and prison, drinking, gambling and money — and it was sitting on the shelf beside 2048 and Google Dino with nothing to say so. BitLife is published commercially as a 17+ game for exactly that content.',
          'It now carries a red 16+ pill on the shelf, and opening it puts a full warning where the play buttons were: what the game is about, that it is not for a young child, and that if a child is the one holding the device the shelf has plenty else on it. The launcher and the three links in the header stay hidden until somebody says they are old enough, so there is no route into the game that does not pass the warning.',
          'Nothing is remembered, so the warning comes back every time the game is opened. A child who taps through it once has not bought it for good.',
          'The rating lives in the cabinet list rather than in the code, and an entry that carries one has to carry the reason with it — a test holds that — so the next game that needs a warning is a line in a file and not a change to the shelf.',
          'Nothing else in the cabinet is rated. The other 50 are cartoon and abstract action: popping balloons, stacking blocks, voxel obstacle courses, defending space bases. Putting a red wall in front of those would flag the games a six-year-old is exactly the right age for, which is how warnings get tapped past without being read.'
        ]
      },
      {
        label: '\u{1F9F1} This does not make the languages run from a folder, and cannot',
        items: [
          'A worker cannot be constructed from an opaque origin, and there is no honest way to run the languages in the page instead: the worker is also what stops a runaway program. An endless loop in a worker is terminated when its time is up, the same protection that ends a pattern which backtracks catastrophically. Run in the page, it freezes the tab and takes the whole kitchen with it.',
          'So this release makes the failure true and actionable rather than making it disappear. On the served site every language runs exactly as it did before.',
          'A copy of the kitchen already sitting unzipped on a disk will not receive any of this. It is a folder of files that nothing here can reach, so it keeps the message it was built with — opening the site is the fix for that one, and always was.'
        ]
      }
    ]
  },
  {
    version: '1.2.7',
    date: 'November 23, 2026',
    title: 'The offline download is gone, and nothing you use went with it',
    groups: [
      {
        label: '\u{1F9F9} An experiment that ended',
        items: [
          'This site no longer builds or publishes an offline archive. For four test builds it handed out the entire kitchen as one download \u2014 every game, every code runtime and the model weights \u2014 so that somebody with no connection could unzip it and open index.html. That download is gone, and the release it lived under has been deleted with it.',
          'If you already have a copy, it still opens and still works: it is a folder on your disk, and nothing here can reach it. There will simply be no newer one.',
          'Every tool, game, model and cupboard on the site is exactly as it was in 1.2.6. The version moves because a large amount of machinery came out of the codebase, not because anything you can see has changed.'
        ]
      },
      {
        label: '\u{1F9F1} Why, which is a browser rule and not a bug',
        items: [
          'A page opened straight off a disk gets an origin the browser will not trust, and from one it refuses three things: an ES module, a worker, and a fetch of the file sitting beside it. It is the same rule in every browser and there is no setting that flips it.',
          'Packaging got around the first of those, and the kitchen did open from a folder: 95 of the 115 utilities worked, and 26 of the 51 games played. It never got around the other two, and the two things that need them are the two worth downloading for \u2014 Waffle AI, which needs a worker and 93 MB of weights, and CodeHub, whose languages all run in workers and so all fail together with a single line about a runtime that could not load.',
          'A download that cannot do the two things it was for is not a smaller version of the site. It is a wall with a kitchen in front of it, so the wall came down.'
        ]
      },
      {
        label: '\u{1F4F6} Offline the way the site already does it',
        items: [
          'There is still an offline route, and it needs no download, no install and no terminal. In the browsers that allow it, the kitchen keeps a copy of itself after a visit, along with the small models it can serve from its own origin, so losing the connection afterwards costs nothing.',
          'That copy is a browser feature and not a promise, so the site detects what it has rather than claiming what it does not: where a browser will not keep one, the kitchen says so instead of failing quietly later.'
        ]
      },
      {
        label: '\u{1F50E} What else changed',
        items: [
          'Nothing a visitor can reach. The code that came out was a second build of the kitchen, a packer, a set of instructions and a button in the other build; the served site never loaded any of it.',
          'The page that answers a double-click on an unzipped copy of the source still does, and now says what to run instead of pointing at instructions that no longer ship with anything.'
        ]
      }
    ]
  },
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

  const releases = isBackupBuild() ? [...TVBR_LOG, ...CHANGELOG] : CHANGELOG;

  const entries = releases.map((entry, idx) => `
    <article class="changelog-entry ${idx === 0 ? 'is-latest' : ''}${entry.tvbr ? ' is-tvbr' : ''}">
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
        ${isBackupBuild() ? 'This build also lists its test versions: builds made around a release, newest first.' : ''}
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
