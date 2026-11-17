import './style.css';
import { cupboards, allTools } from './catalog.js';
import { waffleMascotSVG, cupboardIconSVG, toolPropSVG, uiIconSVG } from './icons-25d.js';
import { isMuted, toggleMute, playPop, playBoing, playCupboardOpen, playSquish, playSparkle } from './sfx.js';
import { mountMathScience } from './tools-math-science.js';
import { mountCode } from './tools-code.js';
import { mountTextArt } from './tools-text-art.js';
import { mountEnglish } from './tools-english.js';
import { mountGames } from './games.js';
import { openWaffleAI, warmupWaffleAI } from './waffle-ai.js';
import { APP_LANGUAGES, getAppLanguage, setAppLanguage, initAppI18n } from './i18n.js';
import { gameSlider } from './ui-kit.js';
import {
  TEXT_MODELS,
  EXECUTION_MODES,
  getSelectedTextModel,
  setSelectedTextModel,
  getSelectedImageModel,
  setSelectedImageModel,
  getSelectedExecutionMode,
  setSelectedExecutionMode,
  getSmartPromptEnabled,
  setSmartPromptEnabled,
  getAiTemperature,
  setAiTemperature,
  isTempUnlocked,
  setTempUnlocked,
  detectDeviceDiagnostics,
  AI_DISCLAIMER_TEXT
} from './waffle-browser-ai.js';
import { IMAGE_MODELS, detectImageCapabilities } from './waffle-image-gen.js';

const $ = s => document.querySelector(s);
const storage = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

let favorites = new Set(storage.get('bite-favorites', []));
let recent = storage.get('bite-recent', []);
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
  games:   { color: '#d7b5eb', trim: '#9875b4', doodles: ['★', '♧'], tagline: '45 GAMES + ROPER FANCADE' }
};

const ALL_CUPBOARDS = [
  ...cupboards,
  { id: 'games', name: 'Games & Fun', short: '45 SchoolGames & Fancade hits', icon: '♧', color: '#d7b5eb', trim: '#9875b4', star: 'games', tools: [] }
];

const app = $('#app');
app.innerHTML = `
  <div class="waffle-world" id="waffle-bg">
    <div class="waffle-grid-layer" id="waffle-grid"></div>
    <div class="waffle-pops" id="waffle-pops" aria-hidden="true"></div>
  </div>
  <div class="game-viewport">
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
        <div class="gfield settings-ai-section" id="settings-ai-section" data-no-i18n>
          <span class="gfield-label">AI Models &amp; Device Fallbacks</span>
          <div class="waffle-disclaimer-box">
            <div class="waffle-disclaimer-head">
              <strong>⚠ DEVICE &amp; WEBGPU DISCLAIMER</strong>
              <span class="waffle-device-pill is-risk" id="settings-device-pill">Checking WebGPU…</span>
            </div>
            <p class="waffle-disclaimer-copy">${esc(AI_DISCLAIMER_TEXT)}</p>
          </div>
          <div class="settings-sub-label">Chat AI Model</div>
          <div class="waffle-pill-grid" id="settings-ai-text-list"></div>
          <div class="settings-sub-label">Image AI Model</div>
          <div class="waffle-pill-grid" id="settings-ai-image-list"></div>
          <div class="settings-sub-label">Fallback / Runtime Mode</div>
          <div class="waffle-pill-grid" id="settings-ai-exec-list"></div>
          <div class="settings-sub-label">Temperature (Experienced Users Only)</div>
          <div id="settings-temp-wrap"></div>
        </div>
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

    <aside class="waffle-corner" aria-label="Waffle AI Button">
      <div class="counter-plate-wrap">
        <button type="button" class="waffle-speech" id="waffle-speech" aria-label="Open Waffle AI chatbot">Touch me for Waffle AI!</button>
        <button type="button" class="waffle-mascot-btn" id="waffle-mascot" aria-label="Open Waffle AI chatbot" title="Open Waffle AI!">
          ${waffleMascotSVG()}
          <span class="waffle-ai-tag" aria-hidden="true">Waffle AI</span>
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
  const countText = c.id === 'games' ? '45 GAMES' : `${c.tools.length} UTILITIES`;
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
  const hits = allTools.filter(t => `${t.name} ${t.description} ${t.id}`.toLowerCase().includes(q));
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
    const pick = allTools[Math.floor(Math.random() * allTools.length)];
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
            <p class="empty-msg">Loading 45 Arcade & Fancade games…</p>
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
    ? allTools.filter(t => t.cupboard === id)
    : id === 'favorites'
      ? allTools.filter(t => favorites.has(t.id))
      : recent.map(rid => allTools.find(t => t.id === rid)).filter(Boolean);

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
  const t = allTools.find(x => x.id === id);
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

  detectDeviceDiagnostics().then(d => {
    const pill = $('#settings-device-pill');
    if (pill) {
      pill.textContent = d.summaryLabel;
      pill.className = `waffle-device-pill ${d.hasRisk ? 'is-risk' : 'is-ok'}`;
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
  if (scrollToSection === 'ai') {
    setTimeout(() => $('#settings-ai-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  }
}

$('#settings-toggle').addEventListener('click', () => openSettingsModal());
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
route();
initAppI18n();

setTimeout(() => warmupWaffleAI(), 800);

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    navigator.serviceWorker.register('./sw.js').catch(console.warn);
  } else {
    navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
    if ('caches' in window) caches.keys().then(ks => ks.filter(k => k.startsWith('bite-')).forEach(k => caches.delete(k))).catch(() => {});
  }
}
