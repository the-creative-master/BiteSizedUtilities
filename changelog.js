import { uiIconSVG } from './icons-25d.js';

/**
 * The kitchen's release notes. Newest first — `openChangelog()` renders them
 * top to bottom exactly in this order, so 1.0.1 sits above 1.0.
 *
 * This lives in the app rather than a README.md on purpose: the project's test
 * suite requires that no README.md exists, and visitors on GitHub Pages never
 * see repo files anyway.
 */
export const APP_VERSION = '1.0.1';

export const CHANGELOG = [
  {
    version: '1.0.1',
    date: 'November 17, 2026',
    title: 'Small models, big honesty',
    groups: [
      {
        label: '🤖 Waffle AI runs on the small models',
        items: [
          'Waffle AI is live again, on the models under 1B parameters: SmolLM2 135M, SmolLM2 360M, Qwen 2.5 0.5B, Qwen 3 0.6B and Qwen 3.5 0.8B. Those are the ones that reliably start and answer on real devices.',
          'SmolLM2 135M is the new default at about 70 MB, so a first conversation no longer waits on a 700 MB download that a phone tab often cannot hold.',
          'Photos and file attachments now need Qwen 3.5 0.8B, the only model here with a vision encoder. The paperclip greys out on a text-only model and tells you which one to pick, instead of accepting an upload it cannot read.',
          'Tool badges name the model that will actually answer, and follow along when you switch models in Settings.',
          'The AI panel is back in Settings for everyone: model pickers, image picker, fallback runtime mode, quantization, on-device pre-cache, and temperature.'
        ]
      },
      {
        label: '🧪 Beta testing unlocks the big ones',
        items: [
          'Llama 3.2 1B, DeepSeek R1 1.5B and the two 1.5B Qwen models moved to BiteSizedUtilities Beta Testing. Tap Sir Waffle ten times within three seconds and the kitchen takes you there, with all nine models selectable.',
          'Settings says so too — the note under the model picker is a button straight to the beta door.',
          'Beta builds are unfinished on purpose. The large models still fail on some devices and browsers, and finding out exactly which is what we need testers for.'
        ]
      },
      {
        label: '📝 New in the kitchen',
        items: [
          'This changelog. Open it any time from What’s New in the kitchen header.',
          'CodeHub’s AI Error Diagnostics keeps its dedicated Qwen 2.5 Coder 1.5B model. A small general model cannot read a stack trace usefully, so this one stays big on purpose.',
          'The header no longer claims a model is pre-cached and running on a server that does not exist on this host.'
        ]
      },
      {
        label: '🛠 Under the hood',
        items: [
          'Matched the ONNX Runtime WASM build to the one Transformers.js actually ships. This was the real reason models downloaded perfectly and then refused to answer: two different runtime builds were being mixed.',
          'Models can now be pre-cached on-device through Wllama’s own ModelManager, so a cached model starts with no network at all.',
          'WebGPU is only requested when the adapter genuinely supports it, so Chromium’s shader-f16 abort no longer takes the whole runtime down with it.',
          'Every reply names the engine that answered it, and a fallback lists which runtimes failed and why instead of collapsing into one vague error.',
          'Several models shared a single GGUF filename, which could silently load the wrong weights. Each model now resolves its own file, and a missing one is skipped rather than guessed.',
          'The automatic fallback chain can no longer quietly reach for a model this build does not offer.',
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
          '45 offline games including Roper and the whole SchoolGames cabinet \u2014 all playable with no connection at all, embedded straight into the kitchen.'
        ]
      },
      {
        label: '🤖 Waffle AI',
        items: [
          'An on-device chat assistant over nine open-source models, from SmolLM2 135M up to DeepSeek R1 1.5B (1.0.1 narrowed the public picker to the models under 1B and moved the rest to beta testing).',
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

  const entries = CHANGELOG.map((entry, idx) => `
    <article class="changelog-entry ${idx === 0 ? 'is-latest' : ''}">
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
      </p>
      <div class="changelog-list">${entries}</div>
      <footer class="changelog-foot">
        <span class="changelog-foot-note">BiteSized Utilities ${esc(APP_VERSION)}</span>
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
