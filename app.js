import './style.css';
import { cupboards, resolveTools, cupboardToolCount } from './catalog.js';
import { waffleMascotSVG, cupboardIconSVG, toolPropSVG, uiIconSVG } from './icons-25d.js';
import { isMuted, toggleMute, playPop, playBoing, playCupboardOpen, playSquish, playSparkle } from './sfx.js';
import { mountMathScience } from './tools-math-science.js';
import { mountCode } from './tools-code.js';
import { mountTextArt } from './tools-text-art.js';
import { mountEnglish } from './tools-english.js';
import { mountMusic } from './tools-music.js';
import { mountVideo } from './tools-video.js';
import { mountGames } from './games.js';
import { openWaffleAI, warmupWaffleAI, isWaffleAiLocked, WAFFLE_AI_LOCK_MESSAGE } from './waffle-ai.js';
import { isBackupBuild } from './build-mode.js';
import { openChangelog } from './changelog.js';
import { APP_LANGUAGES, getAppLanguage, setAppLanguage, initAppI18n } from './i18n.js';
import { gameSlider } from './ui-kit.js';
import {
  TEXT_MODELS,
  EXECUTION_MODES,
  QUANT_PRESETS,
  getSelectedTextModel,
  setSelectedTextModel,
  getSelectedImageModel,
  setSelectedImageModel,
  getSelectedExecutionMode,
  setSelectedExecutionMode,
  getSelectedQuantPreset,
  setSelectedQuantPreset,
  getSmartPromptEnabled,
  setSmartPromptEnabled,
  getAiTemperature,
  setAiTemperature,
  isTempUnlocked,
  setTempUnlocked,
  detectDeviceDiagnostics,
  precacheTextModel,
  listPrecachedModels,
  removePrecachedModel,
  clearPrecachedModels,
  estimateModelStorage,
  requestPersistentStorage,
  AI_DISCLAIMER_TEXT
} from './waffle-browser-ai.js';
import { IMAGE_MODELS, detectImageCapabilities } from './waffle-image-gen.js';

const $ = s => document.querySelector(s);
const storage = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

const rawFavs = storage.get('bite-favorites', []);
const rawRecent = storage.get('bite-recent', []);
let favorites = new Set(Array.isArray(rawFavs) ? rawFavs : []);
let recent = Array.isArray(rawRecent) ? rawRecent : [];
let active = 'all';
let view = 0;
let toolCleanup = null;
let searchQuery = '';
let wallQuipAbort = null;
let bounceStreak = 0;
let bounceTimer = null;

const KITCHEN_THEMES = [
  { id: 'butter', label: '🧇 Butter Waffle' },
  { id: 'matcha', label: '🍵 Matcha Pantry' },
  { id: 'berry', label: '🍓 Berry Bakery' },
  { id: 'midnight', label: '🌙 Midnight Snack' },
  { id: 'blueberry', label: '🫐 Blueberry Jam' },
  { id: 'citrus', label: '🍊 Citrus Marmalade' },
  { id: 'lavender', label: '🪻 Lavender Honey' },
  { id: 'mintchoco', label: '🍫 Mint Choco Chip' }
];
let kitchenTheme = storage.get('bite-kitchen-theme', 'butter');
if (!KITCHEN_THEMES.some(t => t.id === kitchenTheme)) kitchenTheme = 'butter';
document.documentElement.dataset.kitchenTheme = kitchenTheme;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CUPBOARD_THEME = {
  math:    { color: '#e68b76', trim: '#b45a47', doodles: ['×', '÷'], tagline: 'ONE CUPBOARD. TEN TOOLS.' },
  code:    { color: '#7eb7b5', trim: '#4e8785', doodles: ['<', '/>'], tagline: 'BUILD IT. RUN IT. SEE IT.' },
  text:    { color: '#a595c4', trim: '#756495', doodles: ['Aa', '✎'], tagline: 'A PLACE FOR EVERY WORD.' },
  art:     { color: '#e895bf', trim: '#b8638e', doodles: ['✿', '◈'], tagline: 'MAKE A COLORFUL MESS.' },
  science: { color: '#94c496', trim: '#609362', doodles: ['⚛', '⚖'], tagline: 'FEED YOUR CURIOSITY.' },
  english: { color: '#f3be72', trim: '#b87d32', doodles: ['Aa', '文'], tagline: 'ENGLISH & LANGUAGES.' },
  music:   { color: '#f3b07c', trim: '#ba6e3a', doodles: ['♪', '♫'], tagline: 'COMPOSE. PLAY. GROOVE.' },
  video:   { color: '#84b4eb', trim: '#4b78b3', doodles: ['🎬', '✦'], tagline: 'EDIT. GRADE. RENDER.' },
  games:   { color: '#d7b5eb', trim: '#9875b4', doodles: ['★', '♧'], tagline: '51 GAMES + ROPER FANCADE' }
};

const ALL_CUPBOARDS = [
  ...cupboards,
  { id: 'games', name: 'Games & Fun', short: '51 offline arcade & Fancade hits, four of them drawn in-house', icon: '♧', color: '#d7b5eb', trim: '#9875b4', star: 'games', tools: [] }
];

// Backup-only utilities (see `backupToolAdditions` in catalog.js). The public
// kitchen resolves to the identical 115-tool array it always used; only
// backup.html asks for the extras, which are spliced in beside the tool each one
// is an upgrade of.
const BACKUP_BUILD = isBackupBuild();
const TOOLS = resolveTools(BACKUP_BUILD);

const app = $('#app');
const aiLocked = isWaffleAiLocked();

app.innerHTML = `
  <div class="waffle-world" id="waffle-bg">
    <div class="waffle-grid-layer" id="waffle-grid"></div>
    <div class="waffle-pops" id="waffle-pops" aria-hidden="true"></div>
  </div>
  <div class="game-viewport">
    ${isBackupBuild() ? `
    <div class="backup-banner" id="backup-banner" data-no-i18n>
      <span class="gbadge backup-banner-badge">🧇 BACKUP KITCHEN</span>
      <span class="backup-banner-copy">Waffle AI and every AI control are switched on in this build. Everything here is unfinished on purpose.</span>
      <a class="gbtn gbtn-chip backup-banner-exit" href="./index.html">Back to the kitchen</a>
    </div>` : ''}
    <header class="game-hud">
      <div class="hud-left">
        <button type="button" class="gbtn gnav-btn selected" data-nav="all" id="home-pill">
          <span class="gnav-icon">${uiIconSVG('home')}</span>
          <span class="gnav-label">Home kitchen</span>
        </button>
      </div>
      <nav class="game-nav" aria-label="Kitchen navigation">
        <button type="button" class="gbtn gnav-btn" data-nav="favorites">
          <span class="gnav-icon">${uiIconSVG('heart')}</span>
          <span class="gnav-label">Saved</span>
          <span class="gnav-count" id="fav-count">${favorites.size}</span>
        </button>
        <button type="button" class="gbtn gnav-btn" data-nav="recent">
          <span class="gnav-icon">${uiIconSVG('clock')}</span>
          <span class="gnav-label">Recent</span>
        </button>
        <button type="button" class="gbtn gnav-btn sound-btn" id="sound-toggle" aria-label="Toggle sound effects" aria-pressed="${!isMuted()}">
          <span class="gnav-icon" id="sound-icon">${uiIconSVG(isMuted() ? 'soundOff' : 'soundOn')}</span>
        </button>
        <button type="button" class="gbtn gnav-btn changelog-nav-btn" id="changelog-toggle" aria-label="Open the changelog" title="What's New">
          <span class="gnav-icon">${uiIconSVG('scroll')}</span>
          <span class="gnav-label">What&rsquo;s New</span>
        </button>
        <button type="button" class="gbtn gnav-btn settings-nav-btn" id="settings-toggle" aria-label="Open Settings" title="Settings">
          <span class="gnav-icon">${uiIconSVG('gear')}</span>
          <span class="gnav-label">Settings</span>
        </button>
      </nav>
    </header>

    <main id="main" class="kitchen-stage"></main>

    <div class="settings-overlay" id="settings-overlay" hidden>
      <div class="settings-card" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div class="window-grab-pill" aria-hidden="true"></div>
        <div class="settings-head">
          <div class="settings-title-group">
            <span class="gnav-icon">${uiIconSVG('gear')}</span>
            <h2 id="settings-title">Settings</h2>
          </div>
          <button type="button" class="window-close-x" id="settings-close" aria-label="Close settings">✕</button>
        </div>
        <div class="gfield">
          <span class="gfield-label">Sound Effects</span>
          <div>
            <button type="button" class="gtoggle ${!isMuted() ? 'is-on' : ''}" id="settings-sound-toggle" aria-pressed="${!isMuted()}">
              <span class="gtoggle-knob" aria-hidden="true"></span>
              <span id="settings-sound-label">${isMuted() ? 'Muted' : 'Kitchen Sounds On'}</span>
            </button>
          </div>
        </div>
        <div class="gfield">
          <span class="gfield-label">Kitchen Mood</span>
          <div class="gtabs settings-theme-grid" id="settings-theme-list"></div>
        </div>
        <div class="gfield">
          <span class="gfield-label">Language</span>
          <div class="gtabs settings-lang-grid" id="settings-lang-list"></div>
        </div>
        ${isBackupBuild() ? `
        <div class="gfield settings-ai-section" id="settings-ai-section" data-no-i18n>
          <span class="gfield-label">AI Models &amp; Device Fallbacks</span>
          <div class="waffle-disclaimer-box">
            <div class="waffle-disclaimer-head">
              <strong>⚠ DEVICE &amp; WEBGPU DISCLAIMER</strong>
              <span class="waffle-device-pill is-risk" id="settings-device-pill">Checking WebGPU…</span>
            </div>
            <p class="waffle-disclaimer-copy">${esc(AI_DISCLAIMER_TEXT)}</p>
            <p class="waffle-device-detail" id="settings-device-detail" hidden></p>
          </div>
          <div class="settings-sub-label">Chat AI Model</div>
          <div class="waffle-pill-grid" id="settings-ai-text-list"></div>
          <div class="settings-sub-label">Image AI Model</div>
          <div class="waffle-pill-grid" id="settings-ai-image-list"></div>
          <div class="settings-sub-label">Fallback / Runtime Mode</div>
          <div class="waffle-pill-grid" id="settings-ai-exec-list"></div>
          <div class="settings-sub-label">Quantization / File Size</div>
          <div class="waffle-pill-grid" id="settings-ai-quant-list"></div>
          <div class="settings-sub-label">Pre-cache Models On This Device</div>
          <div class="waffle-precache" id="settings-ai-precache"></div>
          <div class="settings-sub-label">Temperature (Experienced Users Only)</div>
          <div id="settings-temp-wrap"></div>
        </div>
        ` : ''}
      </div>
    </div>

    <div class="settings-overlay" id="english-warning-overlay" hidden>
      <div class="settings-card warning-popup-card" role="dialog" aria-modal="true" aria-labelledby="eng-warn-title" data-no-i18n>
        <div class="settings-head">
          <strong id="eng-warn-title">⚠ English &amp; Languages — Device Warning</strong>
          <button type="button" class="window-close-x" id="eng-warn-close" aria-label="Close warning">✕</button>
        </div>
        <div class="waffle-disclaimer-box">
          <div class="waffle-disclaimer-head">
            <strong>⚠ DEVICE &amp; WEBGPU NOTICE</strong>
            <span class="waffle-device-pill is-risk" id="eng-warn-device-pill">Checking WebGPU…</span>
          </div>
          <p class="waffle-disclaimer-copy">${esc(AI_DISCLAIMER_TEXT)}</p>
          <p class="waffle-disclaimer-copy">⚠ iPhone / Mobile Warning: Devices below iOS 26 or without WebGPU (~1 in 4 phones) may crash or run slowly with local AI models. Waffle Translate uses Google Translate; the other 14 tools use AI with automatic WebGPU → WLlama → WASM CPU / Local Server fallbacks.</p>
        </div>
        <div class="warning-popup-actions">
          <button type="button" class="gbtn" id="eng-warn-settings">⚙ Open AI Settings</button>
          <button type="button" class="gbtn gbtn-primary" id="eng-warn-ok">I Understand — Continue</button>
        </div>
      </div>
    </div>

    <div class="settings-overlay" id="exp-warning-overlay" hidden>
      <div class="settings-card warning-popup-card" role="dialog" aria-modal="true" aria-labelledby="exp-warn-title" data-no-i18n>
        <div class="settings-head">
          <strong id="exp-warn-title">⚠ Experienced Users Only</strong>
          <button type="button" class="window-close-x" id="exp-warn-cancel" aria-label="Cancel">✕</button>
        </div>
        <div class="waffle-disclaimer-box">
          <p class="waffle-disclaimer-copy"><strong>Changing AI Temperature is for experienced users only.</strong></p>
          <p class="waffle-disclaimer-copy">• Higher values (1.0 – 1.5) can make small local models hallucinate, ramble, or output broken code/gibberish.<br>• Very low values (0.0 – 0.2) can make replies robotic or repetitive.<br>• Recommended default is <strong>0.70</strong>.</p>
        </div>
        <div class="warning-popup-actions">
          <button type="button" class="gbtn" id="exp-warn-back">Keep Locked (0.70)</button>
          <button type="button" class="gbtn gbtn-primary" id="exp-warn-confirm">I’m an Experienced User — Unlock</button>
        </div>
      </div>
    </div>

    <aside class="waffle-corner" aria-label="${aiLocked ? 'Sir Waffle' : 'Waffle AI Button'}">
      <div class="counter-plate-wrap">
        <button type="button" class="waffle-speech" id="waffle-speech" data-waffle-tap aria-label="${aiLocked ? 'Say hello to Sir Waffle' : 'Open Waffle AI chatbot'}">${aiLocked ? 'Tap Sir Waffle!' : 'Touch me for Waffle AI!'}</button>
        <button type="button" class="waffle-mascot-btn" id="waffle-mascot" data-waffle-tap aria-label="${aiLocked ? 'Sir Waffle' : 'Open Waffle AI chatbot'}" title="${aiLocked ? 'Sir Waffle' : 'Open Waffle AI!'}">
          ${waffleMascotSVG()}
          ${aiLocked ? '' : '<span class="waffle-ai-tag" aria-hidden="true">Waffle AI</span>'}
        </button>
      </div>
    </aside>
  </div>
  <div id="toast" role="status" aria-live="polite"></div>
`;

async function triggerWallBounce(clientX, clientY) {
  playBoing();
  const grid = $('#waffle-grid');
  const speech = $('#waffle-speech');

  grid.classList.remove('is-bouncing');
  void grid.offsetWidth;
  grid.classList.add('is-bouncing');

  if (typeof clientX === 'number' && typeof clientY === 'number') {
    const pops = $('#waffle-pops');
    const pop = document.createElement('span');
    pop.className = 'waffle-ripple';
    pop.style.left = `${clientX}px`;
    pop.style.top = `${clientY}px`;
    pops.append(pop);
    setTimeout(() => pop.remove(), 650);

    const bits = ['🧇', '🧈', '🍯', '✨', '★'];
    for (let i = 0; i < 5; i++) {
      const sp = document.createElement('span');
      sp.className = 'waffle-burst';
      sp.textContent = bits[(i + bounceStreak) % bits.length];
      const ang = (Math.PI * 2 * i) / 5 + Math.random() * 0.6;
      const dist = 34 + Math.random() * 34;
      sp.style.left = `${clientX}px`;
      sp.style.top = `${clientY}px`;
      sp.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
      sp.style.setProperty('--dy', `${Math.sin(ang) * dist - 18}px`);
      pops.append(sp);
      setTimeout(() => sp.remove(), 750);
    }
  }

  bounceStreak++;
  clearTimeout(bounceTimer);
  bounceTimer = setTimeout(() => { bounceStreak = 0; }, 1600);
  if (bounceStreak === 5 || bounceStreak === 10) {
    playSparkle();
    toast(bounceStreak === 10 ? '🍯 ×10 Syrup Frenzy!' : '✨ ×5 Waffle Combo!');
  }

  // AI-powered quips only exist in the backup build. While Waffle AI is paused
  // the wall just bounces, and nothing reaches for a model or an endpoint.
  if (aiLocked) {
    speech.textContent = bounceStreak >= 10 ? '🍯 Syrup Frenzy!' : 'Boing!';
    speech.classList.remove('pop-in');
    void speech.offsetWidth;
    speech.classList.add('pop-in');
    return;
  }

  if (wallQuipAbort) wallQuipAbort.abort();
  const ac = new AbortController();
  wallQuipAbort = ac;

  speech.textContent = '✨ Thinking…';
  speech.classList.remove('pop-in');
  void speech.offsetWidth;
  speech.classList.add('pop-in');

  try {
    const res = await fetch('./api/waffle-ai/wall-quip', { method: 'POST', signal: ac.signal });
    if (!res.ok) throw new Error('Quip error');
    const data = await res.json();
    if (!ac.signal.aborted && data.quip) {
      speech.textContent = data.quip;
      speech.classList.remove('pop-in');
      void speech.offsetWidth;
      speech.classList.add('pop-in');
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      speech.textContent = 'Boing! Touch me for Waffle AI!';
    }
  }
}

function handleOpenWaffleAI(e) {
  e.stopPropagation();
  playPop(620);
  openWaffleAI();
}

$('#waffle-mascot').addEventListener('click', handleOpenWaffleAI);
$('#waffle-speech').addEventListener('click', handleOpenWaffleAI);

/* The hidden unlock gesture: a fast run of taps on Sir Waffle opens the backup
 * kitchen, where Waffle AI and every AI control are switched on. The recipe
 * lives only in these two constants and is not printed anywhere in the UI or in
 * the changelog. Listened for in the capture phase because the mascot's own
 * handler calls stopPropagation(), and it also counts taps on Sir Waffle inside
 * the "Waffle AI is paused" notice, so the run does not have to restart. */
const UNLOCK_TAP_TARGET = 10;
const UNLOCK_TAP_WINDOW_MS = 3000;
let unlockTaps = [];

function openBackupKitchen() {
  playSparkle();
  toast('🧇 Unlocked — opening the backup kitchen');
  // Resolved against the document so it works from a GitHub Pages sub-path.
  setTimeout(() => { window.location.href = new URL('backup.html', document.baseURI).href; }, 260);
}

function registerWaffleTap() {
  if (isBackupBuild()) { unlockTaps = []; return; }
  const now = Date.now();
  unlockTaps = unlockTaps.filter(t => now - t <= UNLOCK_TAP_WINDOW_MS).concat(now);
  // The run is deliberately not broadcast or counted out loud anywhere. The only
  // feedback is the paused-AI notice opening on the first tap and one toast when
  // the run lands — an unlock that narrates its own recipe is not an unlock.
  if (unlockTaps.length < UNLOCK_TAP_TARGET) return;
  unlockTaps = [];
  openBackupKitchen();
}

document.addEventListener('click', e => {
  if (e.target.closest?.('[data-waffle-tap]')) registerWaffleTap();
}, true);

$('#sound-toggle').addEventListener('click', () => {
  const nowMuted = toggleMute();
  syncSoundUI();
  toast(nowMuted ? 'Kitchen sounds muted' : 'Kitchen sounds ON!');
});

// Tapping anywhere on the waffle wall bounces the waffle background & triggers an AI-powered quip!
document.addEventListener('click', e => {
  if (e.target.closest('button, a, input, textarea, select, canvas, .gslider-track, .tool-window-card, .cupboard-card, .cabinet-bookcase, .game-hud, .kitchen-search-pill, .waffle-ai-dialog, .waffle-ai-overlay, .settings-card, .settings-overlay')) return;
  triggerWallBounce(e.clientX, e.clientY);
});

function updateNav() {
  document.querySelectorAll('[data-nav]').forEach(b => {
    b.classList.toggle('selected', b.dataset.nav === active);
  });
  $('#fav-count').textContent = favorites.size;
}

function woodenSignboardHTML({ kicker, title, leftDoodle = '', rightDoodle = '', rivets = false }) {
  return `
    <div class="wood-sign-wrap">
      <div class="hanging-ropes" aria-hidden="true"><span></span><span></span></div>
      <div class="wood-signboard">
        <span class="nail n-tl" aria-hidden="true"></span>
        <span class="nail n-tr" aria-hidden="true"></span>
        ${leftDoodle ? `<span class="sign-doodle" aria-hidden="true">${leftDoodle}</span>` : ''}
        ${rivets ? `<span class="brass-bolt" aria-hidden="true"></span>` : ''}
        <div class="sign-center">
          <span class="sign-kicker">${esc(kicker)}</span>
          <h1 class="sign-heading">${esc(title)}</h1>
        </div>
        ${rivets ? `<span class="brass-bolt" aria-hidden="true"></span>` : ''}
        ${rightDoodle ? `<span class="sign-doodle" aria-hidden="true">${rightDoodle}</span>` : ''}
      </div>
    </div>
  `;
}

function cupboardCard(c) {
  const theme = CUPBOARD_THEME[c.id] || { color: c.color, trim: c.trim };
  const countText = c.id === 'games' ? '51 GAMES' : `${cupboardToolCount(c.id, BACKUP_BUILD)} UTILITIES`;
  return `
    <article class="cupboard-card" style="--cup:${theme.color};--trim:${theme.trim}" data-cupboard="${c.id}">
      <div class="cupboard-crown" aria-hidden="true"></div>
      <div class="cupboard-frame">
        <div class="cupboard-recess" aria-hidden="true">
          <div class="mini-shelf ms1"><span></span><span></span><span></span></div>
          <div class="mini-shelf ms2"><span></span><span></span></div>
        </div>
        <button type="button" class="cupboard-door" data-open-cupboard="${c.id}" aria-label="Open ${esc(c.name)} cupboard">
          <span class="hinge h-top" aria-hidden="true"></span>
          <span class="hinge h-bot" aria-hidden="true"></span>
          <div class="door-molding">
            <div class="door-icon-wrap">${cupboardIconSVG(c.id)}</div>
            <span class="cupboard-label">${esc(c.name)}</span>
            <span class="cupboard-count">${countText}</span>
          </div>
          <span class="door-knob" aria-hidden="true"></span>
        </button>
      </div>
    </article>
  `;
}

function shelfItemCard(t) {
  const isFav = favorites.has(t.id);
  return `
    <div class="shelf-object-slot">
      <button type="button" class="favorite-sticker ${isFav ? 'is-favorite' : ''}" data-fav="${t.id}" aria-label="${isFav ? 'Unsave' : 'Save'} ${esc(t.name)}" aria-pressed="${isFav}">
        ${uiIconSVG('heart')}
      </button>
      <button type="button" class="shelf-object" data-tool="${t.id}" style="--cup:${t.color}">
        <span class="object-tile">${toolPropSVG(t.id)}</span>
        <span class="object-label">${esc(t.name)}</span>
      </button>
    </div>
  `;
}

function chunkShelves(items, perShelf) {
  const shelves = [];
  for (let i = 0; i < items.length; i += perShelf) {
    shelves.push(items.slice(i, i + perShelf));
  }
  return shelves;
}

function renderSearchMatches() {
  const q = searchQuery.trim().toLowerCase();
  const host = $('#home-search-results');
  const gridHost = $('#home-cupboard-grid');
  if (!host || !gridHost) return;
  if (!q) {
    host.hidden = true;
    gridHost.hidden = false;
    return;
  }
  const hits = TOOLS.filter(t => `${t.name} ${t.description} ${t.id}`.toLowerCase().includes(q));
  gridHost.hidden = true;
  host.hidden = false;
  const perShelf = window.innerWidth <= 640 ? 2 : 4;
  const shelves = chunkShelves(hits, perShelf);
  host.innerHTML = hits.length
    ? `<div class="cabinet-bookcase"><div class="cabinet-crown" aria-hidden="true"></div><div class="cabinet-interior">
        ${shelves.map((row, idx) => `
          <div class="wooden-shelf-row" style="animation-delay:${idx * 55}ms">
            <div class="shelf-objects-grid shelf-cols-${perShelf}">${row.map(shelfItemCard).join('')}</div>
            <div class="wooden-plank" aria-hidden="true"></div>
          </div>
        `).join('')}
      </div></div>`
    : `<div class="empty-shelf"><p>No kitchen toys matched “${esc(searchQuery)}”. Try “calc”, “quiz”, or “json”!</p></div>`;
  bindActions(host);
}

function home() {
  toolCleanup?.();
  toolCleanup = null;
  view++;
  active = 'all';
  updateNav();
  $('#waffle-speech').textContent = 'Touch me for Waffle AI!';

  $('#main').innerHTML = `
    <section class="kitchen-home" aria-label="Cozy 2.5D Utility Kitchen">
      ${woodenSignboardHTML({ kicker: 'WELCOME TO THE TINY UTILITY KITCHEN', title: 'Bite Sized Utilities', rivets: true })}
      <div class="choose-pill-wrap">
        <span class="choose-pill">CHOOSE A CUPBOARD</span>
      </div>
      <div class="kitchen-search-row">
        <div class="kitchen-search-pill">
          <span class="search-svg">${uiIconSVG('search')}</span>
          <input id="kitchen-search" type="text" value="${esc(searchQuery)}" placeholder='Search for a utility… try "calculator", "roman", "json"' aria-label="Search utilities">
        </div>
        <button type="button" class="gbtn gbtn-primary kitchen-surprise-btn" id="surprise-tool-btn">🎲 Surprise Toy!</button>
      </div>
      <div class="cupboard-grid" id="home-cupboard-grid">
        ${ALL_CUPBOARDS.map(cupboardCard).join('')}
      </div>
      <div id="home-search-results" hidden></div>
      <div class="kitchen-counter-ledge" aria-hidden="true">
        <div class="ledge-top"></div>
        <div class="ledge-front"></div>
      </div>
    </section>
  `;
  const searchInput = $('#kitchen-search');
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    renderSearchMatches();
  });
  $('#surprise-tool-btn')?.addEventListener('click', () => {
    const pick = TOOLS[Math.floor(Math.random() * TOOLS.length)];
    if (!pick) return;
    playSparkle();
    toast(`🎲 ${pick.name}!`);
    location.hash = `tool/${pick.id}`;
  });
  bindActions();
  if (searchQuery.trim()) renderSearchMatches();
}

function showEnglishEntryWarning() {
  const overlay = $('#english-warning-overlay');
  if (!overlay) return;
  overlay.hidden = false;
  detectDeviceDiagnostics().then(d => {
    const pill = $('#eng-warn-device-pill');
    if (pill) {
      pill.textContent = d.summaryLabel;
      pill.className = `waffle-device-pill ${d.hasRisk ? 'is-risk' : 'is-ok'}`;
    }
  }).catch(() => {});
}

async function collection(id) {
  toolCleanup?.();
  toolCleanup = null;
  view++;
  const ticket = view;
  const prevActive = active;
  active = id;
  updateNav();

  const theme = CUPBOARD_THEME[id] || { color: '#ffe5a8', trim: '#d4a65a', doodles: ['★', '★'], tagline: 'YOUR KITCHEN SHELF' };

  if (id === 'games') {
    $('#main').innerHTML = `
      <section class="open-cupboard-scene" style="--cup:${theme.color};--trim:${theme.trim}">
        ${woodenSignboardHTML({ kicker: theme.tagline, title: 'Games & Fun', leftDoodle: theme.doodles[0], rightDoodle: theme.doodles[1] })}
        <div class="cabinet-bookcase arcade-bookcase">
          <div class="cabinet-crown" aria-hidden="true"></div>
          <div class="cabinet-interior" id="game-root">
            <p class="empty-msg">Loading 51 Arcade & Fancade games…</p>
          </div>
        </div>
      </section>
    `;
    bindActions();
    try {
      if (ticket === view) {
        const cleanup = await mountGames($('#game-root'));
        if (typeof cleanup === 'function') toolCleanup = cleanup;
      }
    } catch (e) {
      if (ticket === view) $('#game-root').textContent = 'The arcade could not load.';
      console.error(e);
    }
    return;
  }

  const c = cupboards.find(x => x.id === id);
  const title = c ? c.name : id === 'favorites' ? 'Saved Toys' : 'Recently Played';
  const tagline = c ? theme.tagline : id === 'favorites' ? 'YOUR FAVORITE OBJECTS' : 'PICK UP WHERE YOU LEFT OFF';
  const tools = c
    ? TOOLS.filter(t => t.cupboard === id)
    : id === 'favorites'
      ? TOOLS.filter(t => favorites.has(t.id))
      : recent.map(rid => TOOLS.find(t => t.id === rid)).filter(Boolean);

  // 2 per shelf on mobile & Math (clean 5-shelf wooden cabinet!), 3 per shelf on wider 15-tool cupboards
  const perShelf = (window.innerWidth <= 640 || id === 'math') ? 2 : 3;
  const shelves = chunkShelves(tools, perShelf);

  $('#main').innerHTML = `
    <section class="open-cupboard-scene" style="--cup:${theme.color};--trim:${theme.trim}">
      ${woodenSignboardHTML({ kicker: tagline, title, leftDoodle: theme.doodles[0], rightDoodle: theme.doodles[1] })}
      <div class="cabinet-bookcase ${perShelf === 2 ? 'cabinet-compact' : ''}">
        <div class="cabinet-crown" aria-hidden="true"></div>
        <div class="cabinet-interior">
          ${shelves.length ? shelves.map((row, rIdx) => `
            <div class="wooden-shelf-row" style="animation-delay:${rIdx * 65}ms">
              <div class="shelf-objects-grid shelf-cols-${perShelf}">${row.map(shelfItemCard).join('')}</div>
              <div class="wooden-plank" aria-hidden="true"></div>
            </div>
          `).join('') : `
            <div class="empty-shelf">
              <p>${id === 'favorites' ? 'Tap the heart sticker on any toy to keep it on this shelf!' : 'Open any toy in a cupboard and it will appear here!'}</p>
              <button type="button" class="gbtn gbtn-primary" data-nav="all">Back to Kitchen Wall</button>
            </div>
          `}
        </div>
      </div>
    </section>
  `;
  bindActions();
  window.scrollTo({ top: 0, behavior: 'auto' });
  if (id === 'english' && prevActive !== 'english') {
    showEnglishEntryWarning();
  }
}

function openTool(id) {
  const t = TOOLS.find(x => x.id === id);
  if (!t) return;
  toolCleanup?.();
  toolCleanup = null;
  view++;
  active = t.cupboard;
  recent = [id, ...recent.filter(x => x !== id)].slice(0, 20);
  storage.set('bite-recent', recent);
  updateNav();

  const cup = cupboards.find(c => c.id === t.cupboard);
  const isFav = favorites.has(id);

  $('#main').innerHTML = `
    <section class="tool-window-stage" style="--cup:${t.color};--trim:${cup?.trim || '#b88456'}">
      <div class="tool-window-card">
        <div class="tool-window-header">
          <div class="window-grab-pill" aria-hidden="true"></div>
          <div class="window-head-row">
            <div class="window-title-group">
              <span class="window-tool-icon">${toolPropSVG(t.id)}</span>
              <div>
                <span class="window-kicker">${esc((cup?.name || t.cupboard).toUpperCase())}</span>
                <h1>${esc(t.name)}</h1>
              </div>
            </div>
            <div class="window-head-actions">
              <button type="button" class="gbtn favorite-btn ${isFav ? 'is-favorite' : ''}" data-fav="${id}" aria-label="${isFav ? 'Unsave' : 'Save'} ${esc(t.name)}" aria-pressed="${isFav}">
                <span class="btn-svg">${uiIconSVG('heart')}</span>
              </button>
              <button type="button" class="window-close-x" data-nav="${t.cupboard}" aria-label="Close and return to ${esc(cup?.name || 'shelf')}">✕</button>
            </div>
          </div>
        </div>
        <div class="tool-window-body">
          <div class="tool-workspace" id="tool-root"></div>
        </div>
      </div>
    </section>
  `;
  bindActions();
  window.scrollTo({ top: 0, behavior: 'auto' });

  try {
    const rootEl = $('#tool-root');
    const result = (t.cupboard === 'math' || t.cupboard === 'science')
      ? mountMathScience(id, rootEl)
      : t.cupboard === 'code'
        ? mountCode(id, rootEl)
        : t.cupboard === 'english'
          ? mountEnglish(id, rootEl)
          : t.cupboard === 'music'
            ? mountMusic(id, rootEl)
            : t.cupboard === 'video'
              ? mountVideo(id, rootEl)
              : mountTextArt(id, rootEl);
    if (typeof result === 'function') toolCleanup = result;
    if (!result) rootEl.textContent = 'This toy could not be opened.';
  } catch (e) {
    console.error(e);
    $('#tool-root').textContent = 'Something went wrong opening this toy.';
  }
}

function bindActions(root = document) {
  root.querySelectorAll('[data-nav]').forEach(b => {
    b.onclick = () => { playPop(500); navigate(b.dataset.nav); };
  });

  root.querySelectorAll('[data-open-cupboard]').forEach(b => {
    b.onclick = () => {
      playCupboardOpen();
      navigate(b.dataset.openCupboard);
    };
  });

  root.querySelectorAll('[data-tool]').forEach(b => {
    b.onclick = () => { playSquish(); location.hash = 'tool/' + b.dataset.tool; };
  });

  root.querySelectorAll('[data-fav]').forEach(b => {
    b.onclick = e => {
      e.stopPropagation();
      playPop(660);
      const id = b.dataset.fav;
      if (favorites.has(id)) favorites.delete(id);
      else favorites.add(id);
      storage.set('bite-favorites', [...favorites]);
      document.querySelectorAll(`[data-fav="${id}"]`).forEach(el => {
        el.classList.toggle('is-favorite', favorites.has(id));
        el.setAttribute('aria-pressed', String(favorites.has(id)));
      });
      $('#fav-count').textContent = favorites.size;
      toast(favorites.has(id) ? 'Saved to your favorites shelf!' : 'Removed from favorites.');
      if (active === 'favorites') collection('favorites');
    };
  });
}

function navigate(id) {
  location.hash = id === 'all' ? 'kitchen' : id;
}

function route() {
  document.querySelectorAll('.tool-form').forEach(n => n.dispatchEvent(new Event('tool-dispose')));
  toolCleanup?.();
  toolCleanup = null;
  const hash = decodeURIComponent(location.hash.slice(1));
  if (hash.startsWith('tool/')) openTool(hash.slice(5));
  else if (cupboards.some(c => c.id === hash) || ['favorites', 'recent', 'games'].includes(hash)) collection(hash);
  else home();
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
}

window.addEventListener('hashchange', route);
window.addEventListener('waffle-open-art-studio', e => {
  const dataUrl = e?.detail?.dataUrl;
  if (dataUrl) {
    try { sessionStorage.setItem('waffle-art-import', dataUrl); } catch {}
  }
  openTool('art-studio');
});
function syncSoundUI() {
  const on = !isMuted();
  const btn = $('#sound-toggle');
  if (btn) btn.setAttribute('aria-pressed', String(on));
  const ic = $('#sound-icon');
  if (ic) ic.innerHTML = uiIconSVG(on ? 'soundOn' : 'soundOff');
  const st = $('#settings-sound-toggle');
  if (st) {
    st.classList.toggle('is-on', on);
    st.setAttribute('aria-pressed', String(on));
  }
  const sl = $('#settings-sound-label');
  if (sl) sl.textContent = on ? 'Kitchen Sounds On' : 'Muted';
}

let settingsImageCaps = { hasWebGPU: false, hasF16: false };

/* ------------------------------------------------------------------ *
 * Pre-cache panel — download a model's GGUF into on-device storage
 * (OPFS) once, so later chats start instantly and work with no server.
 * ------------------------------------------------------------------ */
let precacheState = { entries: [], storage: null, busy: null, busyDetail: '', error: '' };
let precacheAbort = null;

async function refreshPrecacheState() {
  // The panel only exists in the backup build; without it there is nothing to
  // refresh and no reason to open OPFS or wake the model manager.
  if (!$('#settings-ai-precache')) return;
  try {
    const [entries, storageInfo] = await Promise.all([
      listPrecachedModels().catch(() => []),
      estimateModelStorage().catch(() => null)
    ]);
    precacheState = { ...precacheState, entries, storage: storageInfo };
  } catch {}
  if (!$('#settings-overlay')?.hidden) renderPrecachePanel();
}

function renderPrecachePanel() {
  const box = $('#settings-ai-precache');
  if (!box) return;
  const byRepo = new Map(precacheState.entries.map(e => [e.key, e]));
  const mb = b => (b > 0 ? `${Math.round(b / 1048576)} MB` : '?');
  const st = precacheState.storage;

  const rows = TEXT_MODELS.filter(m => m.hfGgufRepo).map(m => {
    const entry = byRepo.get(m.hfGgufRepo);
    const cached = Boolean(entry?.usable);
    const busy = precacheState.busy === m.id;
    const stateLabel = busy
      ? (precacheState.busyDetail || 'Working…')
      : cached
        ? `✅ On device · ${mb(entry.sizeBytes)} · ${entry.quant || 'GGUF'}`
        : entry?.onDisk
          ? '⚠ Cached but incomplete — re-cache it'
          : `⬇ Not cached · ~${m.ggufMB || '?'} MB`;
    return `
      <div class="waffle-precache-row ${busy ? 'is-busy' : ''}">
        <div class="waffle-precache-info">
          <strong>${m.label}</strong>
          <small>${stateLabel}</small>
        </div>
        <div class="waffle-precache-actions">
          ${busy ? '<button type="button" class="gbtn waffle-mini-btn" data-precache-stop>Stop</button>' : ''}
          <button type="button" class="gbtn waffle-mini-btn" data-precache="${m.id}" ${busy ? 'disabled' : ''}>${cached ? '↻ Re-cache' : '⬇ Pre-cache'}</button>
          ${cached ? `<button type="button" class="gbtn waffle-mini-btn" data-precache-rm="${entry.key}" title="Delete this cached model">🗑</button>` : ''}
        </div>
      </div>`;
  }).join('');

  box.innerHTML = `
    <p class="waffle-precache-copy">
      Static hosts like GitHub Pages have no llama.cpp server, so models are streamed from
      Hugging Face on first use. Pre-cache them here and they are stored on this device
      (OPFS) — later chats start instantly and keep working offline.
    </p>
    ${precacheState.error ? `<p class="waffle-precache-error">${precacheState.error}</p>` : ''}
    ${rows}
    <div class="waffle-precache-foot">
      <span>${st ? `Device storage: ${mb(st.usageBytes)} used of ${mb(st.quotaBytes)}${st.persistent ? ' · kept' : ''}` : 'Device storage: unknown'}</span>
      <span class="waffle-precache-foot-btns">
        ${st && !st.persistent ? '<button type="button" class="gbtn waffle-mini-btn" id="precache-persist">🔒 Ask to keep</button>' : ''}
        <button type="button" class="gbtn waffle-mini-btn" id="precache-clear">🧹 Clear all cached models</button>
      </span>
    </div>
  `;

  box.querySelectorAll('[data-precache]').forEach(btn => {
    btn.addEventListener('click', () => startPrecache(btn.dataset.precache));
  });
  box.querySelector('[data-precache-stop]')?.addEventListener('click', () => {
    precacheAbort?.abort();
  });
  box.querySelectorAll('[data-precache-rm]').forEach(btn => {
    btn.addEventListener('click', async () => {
      playPop(420);
      await removePrecachedModel(btn.dataset.precacheRm).catch(() => {});
      await refreshPrecacheState();
    });
  });
  box.querySelector('#precache-clear')?.addEventListener('click', async () => {
    playPop(380);
    await clearPrecachedModels().catch(() => {});
    await refreshPrecacheState();
  });
  box.querySelector('#precache-persist')?.addEventListener('click', async () => {
    const ok = await requestPersistentStorage();
    precacheState.error = ok ? '' : 'This browser refused to mark storage persistent; cached models may still be evicted when space is tight.';
    await refreshPrecacheState();
  });
}

async function startPrecache(modelId) {
  if (precacheState.busy) return;
  playPop(620);
  precacheAbort = new AbortController();
  precacheState = { ...precacheState, busy: modelId, busyDetail: 'Resolving the best quant…', error: '' };
  renderPrecachePanel();
  try {
    await precacheTextModel(modelId, {
      signal: precacheAbort.signal,
      onProgress: p => {
        precacheState.busyDetail = p.detail || '';
        const row = document.querySelector('.waffle-precache-row.is-busy .waffle-precache-info small');
        if (row) row.textContent = precacheState.busyDetail;
      }
    });
    precacheState.error = '';
  } catch (err) {
    if (err?.name !== 'AbortError') precacheState.error = String(err?.message || err);
  } finally {
    precacheState = { ...precacheState, busy: null, busyDetail: '' };
    precacheAbort = null;
    await refreshPrecacheState();
  }
}

function renderSettingsModal() {
  syncSoundUI();
  const themeList = $('#settings-theme-list');
  if (themeList) {
    themeList.innerHTML = KITCHEN_THEMES.map(t => `
      <button type="button" class="gbtn gtab ${t.id === kitchenTheme ? 'is-active' : ''}" data-pick-theme="${t.id}">
        <span>${esc(t.label)}</span>
      </button>
    `).join('');
    themeList.querySelectorAll('[data-pick-theme]').forEach(btn => {
      btn.addEventListener('click', () => {
        kitchenTheme = btn.dataset.pickTheme;
        document.documentElement.dataset.kitchenTheme = kitchenTheme;
        storage.set('bite-kitchen-theme', kitchenTheme);
        playSparkle();
        renderSettingsModal();
      });
    });
  }
  const list = $('#settings-lang-list');
  if (list) {
    const cur = getAppLanguage();
    list.innerHTML = APP_LANGUAGES.map(l => `
      <button type="button" class="gbtn gtab ${l.name === cur ? 'is-active' : ''}" data-pick-lang="${esc(l.name)}" data-no-i18n>
        <span>${esc(l.native)}</span>
      </button>
    `).join('');
    list.querySelectorAll('[data-pick-lang]').forEach(btn => {
      btn.addEventListener('click', () => {
        const lang = btn.dataset.pickLang;
        playPop(620);
        setAppLanguage(lang);
        renderSettingsModal();
      });
    });
  }

  const textList = $('#settings-ai-text-list');
  if (textList) {
    const curText = getSelectedTextModel();
    textList.innerHTML = TEXT_MODELS.map(m => `
      <button type="button" class="gbtn waffle-model-pill ${curText === m.id ? 'selected' : ''}" data-set-text="${esc(m.id)}" title="${esc(m.desc)}">
        <strong>${esc(m.label)}</strong>
        <small>${esc(m.badge)}</small>
      </button>
    `).join('');
    textList.querySelectorAll('[data-set-text]').forEach(btn => {
      btn.addEventListener('click', () => {
        setSelectedTextModel(btn.dataset.setText);
        playPop(640);
        renderSettingsModal();
      });
    });
  }

  const imgList = $('#settings-ai-image-list');
  if (imgList) {
    const curImg = getSelectedImageModel();
    const smartOn = getSmartPromptEnabled();
    imgList.innerHTML = `
      ${IMAGE_MODELS.map(m => {
        const disabled = m.requiresWebGPU && !settingsImageCaps.hasWebGPU;
        return `
          <button type="button" class="gbtn waffle-model-pill ${curImg === m.id ? 'selected' : ''}" data-set-img="${esc(m.id)}" ${disabled ? 'disabled title="Requires WebGPU browser"' : `title="${esc(m.sizeLabel)}"`}>
            <strong>${esc(m.name)}</strong>
            <small>${disabled ? 'Needs WebGPU' : esc(m.badge)}</small>
          </button>
        `;
      }).join('')}
      <button type="button" class="gbtn waffle-model-pill ${smartOn ? 'selected' : ''}" id="settings-smart-prompt">
        <strong>✨ Smart Prompt: ${smartOn ? 'ON' : 'OFF'}</strong>
        <small>Expand short image prompts</small>
      </button>
    `;
    imgList.querySelectorAll('[data-set-img]').forEach(btn => {
      btn.addEventListener('click', () => {
        setSelectedImageModel(btn.dataset.setImg);
        playPop(640);
        renderSettingsModal();
      });
    });
    imgList.querySelector('#settings-smart-prompt')?.addEventListener('click', () => {
      setSmartPromptEnabled(!smartOn);
      playPop(600);
      renderSettingsModal();
    });
  }

  const execList = $('#settings-ai-exec-list');
  if (execList) {
    const curExec = getSelectedExecutionMode();
    execList.innerHTML = EXECUTION_MODES.map(m => `
      <button type="button" class="gbtn waffle-model-pill ${curExec === m.id ? 'selected' : ''}" data-set-exec="${esc(m.id)}" title="${esc(m.desc)}">
        <strong>${esc(m.label)}</strong>
        <small>${esc(m.desc)}</small>
      </button>
    `).join('');
    execList.querySelectorAll('[data-set-exec]').forEach(btn => {
      btn.addEventListener('click', () => {
        setSelectedExecutionMode(btn.dataset.setExec);
        playPop(640);
        renderSettingsModal();
      });
    });
  }

  const quantList = $('#settings-ai-quant-list');
  if (quantList) {
    const curQuant = getSelectedQuantPreset();
    quantList.innerHTML = QUANT_PRESETS.map(q => `
      <button type="button" class="gbtn waffle-model-pill ${curQuant === q.id ? 'selected' : ''}" data-set-quant="${esc(q.id)}" title="${esc(q.desc)}">
        <strong>${esc(q.label)}</strong>
        <small>${esc(q.desc)}</small>
      </button>
    `).join('');
    quantList.querySelectorAll('[data-set-quant]').forEach(btn => {
      btn.addEventListener('click', () => {
        setSelectedQuantPreset(btn.dataset.setQuant);
        playPop(640);
        renderSettingsModal();
      });
    });
  }

  renderPrecachePanel();

  const tempWrap = $('#settings-temp-wrap');
  if (tempWrap) {
    const curTemp = getAiTemperature();
    if (!isTempUnlocked()) {
      tempWrap.innerHTML = `
        <div class="settings-temp-locked">
          <span>Current: <strong>${curTemp.toFixed(2)}</strong> (Balanced Default)</span>
          <button type="button" class="gbtn" id="settings-unlock-temp">🔓 Unlock Temperature Control (Experienced Users Only)</button>
        </div>
      `;
      tempWrap.querySelector('#settings-unlock-temp')?.addEventListener('click', () => {
        playPop(520);
        $('#exp-warning-overlay').hidden = false;
      });
    } else {
      tempWrap.innerHTML = `<div class="settings-temp-controls"></div>`;
      const box = tempWrap.querySelector('.settings-temp-controls');
      const slider = gameSlider({
        label: 'Temperature',
        min: 0,
        max: 1.5,
        step: 0.05,
        value: curTemp,
        format: v => `${v.toFixed(2)}${v <= 0.3 ? ' · Precise' : v <= 0.85 ? ' · Balanced' : ' · Creative'}`,
        onChange: v => setAiTemperature(v)
      });
      const lockBtn = document.createElement('button');
      lockBtn.type = 'button';
      lockBtn.className = 'gbtn gbtn-chip';
      lockBtn.textContent = '🔒 Reset & Lock (0.70)';
      lockBtn.addEventListener('click', () => {
        setAiTemperature(0.7);
        setTempUnlocked(false);
        playPop(460);
        renderSettingsModal();
      });
      box.append(slider.el, lockBtn);
    }
  }

  // Both probes only feed the AI panel, so skip them entirely while AI is paused.
  if (!isBackupBuild()) return;

  detectDeviceDiagnostics().then(d => {
    const pill = $('#settings-device-pill');
    if (pill) {
      pill.textContent = d.summaryLabel;
      pill.className = `waffle-device-pill ${d.hasRisk ? 'is-risk' : 'is-ok'}`;
    }
    // The facts that decide which models this device can actually run. Without
    // them a skipped model just looks like a random failure.
    const detail = $('#settings-device-detail');
    if (detail) {
      const gb = n => `${(n / 1024 ** 3).toFixed(1)} GB`;
      const bits = [
        `${d.cores || '?'} cores`,
        d.deviceMemoryGB ? `${d.deviceMemoryGB} GB RAM` : 'RAM unknown',
        `wasm budget ${gb(d.wasmBudgetBytes || 0)}`,
        d.hasOPFS ? 'OPFS ok' : 'no OPFS (pre-cache unavailable)',
        d.storageQuotaMB ? `storage ${Math.round((d.storageUsageMB || 0) / 1024)} / ${Math.round(d.storageQuotaMB / 1024)} GB used` : null,
        d.wllamaGpuSafe ? 'llama.cpp WebGPU safe' : 'llama.cpp WebGPU blocked (no FP16) → CPU',
        d.canThread ? 'multi-thread ok' : 'single-thread (no COOP/COEP on static hosts)'
      ].filter(Boolean);
      detail.textContent = bits.join(' · ');
      detail.hidden = false;
    }
  }).catch(() => {});
  detectImageCapabilities().then(caps => {
    const changed = caps.hasWebGPU !== settingsImageCaps.hasWebGPU;
    settingsImageCaps = caps;
    if (changed && !$('#settings-overlay').hidden) renderSettingsModal();
  }).catch(() => {});
}

function openSettingsModal(scrollToSection = '') {
  playPop(580);
  renderSettingsModal();
  $('#settings-overlay').hidden = false;
  refreshPrecacheState();
  if (scrollToSection === 'ai') {
    setTimeout(() => $('#settings-ai-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  }
}

$('#settings-toggle').addEventListener('click', () => openSettingsModal());
$('#changelog-toggle')?.addEventListener('click', () => {
  playPop(600);
  openChangelog();
});
window.addEventListener('bite-open-settings', e => openSettingsModal(e?.detail?.section || ''));
$('#settings-sound-toggle')?.addEventListener('click', () => {
  toggleMute();
  syncSoundUI();
  if (!isMuted()) playPop(640);
});
$('#settings-close').addEventListener('click', () => {
  playPop(460);
  $('#settings-overlay').hidden = true;
});

$('#eng-warn-close')?.addEventListener('click', () => {
  playPop(460);
  $('#english-warning-overlay').hidden = true;
});
$('#eng-warn-ok')?.addEventListener('click', () => {
  playPop(600);
  $('#english-warning-overlay').hidden = true;
});
$('#eng-warn-settings')?.addEventListener('click', () => {
  playPop(580);
  $('#english-warning-overlay').hidden = true;
  openSettingsModal('ai');
});
$('#english-warning-overlay')?.addEventListener('click', e => {
  if (e.target.id === 'english-warning-overlay') $('#english-warning-overlay').hidden = true;
});

const closeExpWarn = () => {
  playPop(460);
  $('#exp-warning-overlay').hidden = true;
};
$('#exp-warn-cancel')?.addEventListener('click', closeExpWarn);
$('#exp-warn-back')?.addEventListener('click', closeExpWarn);
$('#exp-warn-confirm')?.addEventListener('click', () => {
  setTempUnlocked(true);
  playSparkle();
  $('#exp-warning-overlay').hidden = true;
  renderSettingsModal();
});
$('#exp-warning-overlay')?.addEventListener('click', e => {
  if (e.target.id === 'exp-warning-overlay') closeExpWarn();
});
$('#settings-overlay').addEventListener('click', e => {
  if (e.target === $('#settings-overlay')) {
    playPop(460);
    $('#settings-overlay').hidden = true;
  }
});

bindActions();
try { route(); } catch (e) { console.error(e); home(); }
try { initAppI18n(); } catch (e) { console.error(e); }

setTimeout(() => { try { warmupWaffleAI(); } catch {} }, 800);

try {
  if ('serviceWorker' in navigator && navigator.serviceWorker) {
    if (import.meta.env.PROD) {
      navigator.serviceWorker.register('./sw.js').catch(console.warn);
    } else {
      navigator.serviceWorker.getRegistrations?.().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
      if ('caches' in window && window.caches?.keys) {
        window.caches.keys().then(ks => ks.filter(k => k.startsWith('bite-')).forEach(k => window.caches.delete(k))).catch(() => {});
      }
    }
  }
} catch {}
