import './style.css';
import { cupboards, allTools } from './catalog.js';
import { waffleMascotSVG, cupboardIconSVG, toolPropSVG, uiIconSVG } from './icons-25d.js';
import { isMuted, toggleMute, playPop, playBoing, playCupboardOpen, playSquish } from './sfx.js';

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

const WAFFLE_QUIPS = [
  'Boing! Sweet math!',
  'Tap a cupboard door!',
  'Freshly baked utilities!',
  '68 real GitHub games inside!',
  'Waffle power!',
  'Pick a toy off the shelf!'
];
let quipIndex = 0;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CUPBOARD_THEME = {
  math:    { color: '#e68b76', trim: '#b45a47', doodles: ['×', '÷'], tagline: 'ONE CUPBOARD. TEN TOOLS.' },
  code:    { color: '#7eb7b5', trim: '#4e8785', doodles: ['<', '/>'], tagline: 'BUILD IT. RUN IT. SEE IT.' },
  text:    { color: '#a595c4', trim: '#756495', doodles: ['Aa', '✎'], tagline: 'A PLACE FOR EVERY WORD.' },
  art:     { color: '#e895bf', trim: '#b8638e', doodles: ['✿', '◈'], tagline: 'MAKE A COLORFUL MESS.' },
  science: { color: '#94c496', trim: '#609362', doodles: ['⚛', '⚖'], tagline: 'FEED YOUR CURIOSITY.' },
  games:   { color: '#d7b5eb', trim: '#9875b4', doodles: ['★', '♧'], tagline: 'REAL OPEN-SOURCE GAMES FROM GITHUB' }
};

const ALL_CUPBOARDS = [
  ...cupboards,
  { id: 'games', name: 'Games & Fun', short: '68 real open-source games', icon: '♧', color: '#d7b5eb', trim: '#9875b4', star: 'games', tools: [] }
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
      </nav>
    </header>

    <main id="main" class="kitchen-stage"></main>

    <aside class="waffle-corner" aria-label="Sir Waffle Mascot">
      <div class="counter-plate-wrap">
        <div class="waffle-speech" id="waffle-speech">Tap a cupboard!</div>
        <button type="button" class="waffle-mascot-btn" id="waffle-mascot" aria-label="Tap Sir Waffle mascot to bounce">
          ${waffleMascotSVG()}
        </button>
      </div>
    </aside>
  </div>
  <div id="toast" role="status" aria-live="polite"></div>
`;

function triggerWaffleBounce(clientX, clientY, fromMascot = false) {
  playBoing();
  const grid = $('#waffle-grid');
  const mascot = $('#waffle-mascot');
  const speech = $('#waffle-speech');

  grid.classList.remove('is-bouncing');
  void grid.offsetWidth;
  grid.classList.add('is-bouncing');

  mascot.classList.remove('is-bouncing');
  void mascot.offsetWidth;
  mascot.classList.add('is-bouncing');

  if (fromMascot || Math.random() < 0.7) {
    quipIndex = (quipIndex + 1) % WAFFLE_QUIPS.length;
    speech.textContent = WAFFLE_QUIPS[quipIndex];
    speech.classList.remove('pop-in');
    void speech.offsetWidth;
    speech.classList.add('pop-in');
  }

  if (typeof clientX === 'number' && typeof clientY === 'number') {
    const pops = $('#waffle-pops');
    const pop = document.createElement('span');
    pop.className = 'waffle-ripple';
    pop.style.left = `${clientX}px`;
    pop.style.top = `${clientY}px`;
    pops.append(pop);
    setTimeout(() => pop.remove(), 650);
  }
}

$('#waffle-mascot').addEventListener('click', e => {
  e.stopPropagation();
  const rect = e.currentTarget.getBoundingClientRect();
  triggerWaffleBounce(rect.left + rect.width / 2, rect.top + rect.height / 2, true);
});

$('#sound-toggle').addEventListener('click', () => {
  const nowMuted = toggleMute();
  $('#sound-toggle').setAttribute('aria-pressed', String(!nowMuted));
  $('#sound-icon').innerHTML = uiIconSVG(nowMuted ? 'soundOff' : 'soundOn');
  toast(nowMuted ? 'Kitchen sounds muted' : 'Kitchen sounds ON!');
});

// Tapping anywhere on the waffle wall bounces the waffle background & Sir Waffle
document.addEventListener('click', e => {
  if (e.target.closest('button, a, input, textarea, select, canvas, .gslider-track, .tool-window-card, .cupboard-card, .cabinet-bookcase, .game-hud, .kitchen-search-pill')) return;
  triggerWaffleBounce(e.clientX, e.clientY, false);
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
  const countText = c.id === 'games' ? '68 GAMES' : `${c.tools.length} UTILITIES`;
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
  $('#waffle-speech').textContent = 'Tap a cupboard!';

  $('#main').innerHTML = `
    <section class="kitchen-home" aria-label="Cozy 2.5D Utility Kitchen">
      ${woodenSignboardHTML({ kicker: 'WELCOME TO THE TINY UTILITY KITCHEN', title: 'Bite Sized Utilities', rivets: true })}
      <div class="choose-pill-wrap">
        <span class="choose-pill">CHOOSE A CUPBOARD</span>
      </div>
      <div class="kitchen-search-pill">
        <span class="search-svg">${uiIconSVG('search')}</span>
        <input id="kitchen-search" type="text" value="${esc(searchQuery)}" placeholder='Search for a utility… try "calculator", "roman", "json"' aria-label="Search utilities">
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
  bindActions();
  if (searchQuery.trim()) renderSearchMatches();
}

async function collection(id) {
  toolCleanup?.();
  toolCleanup = null;
  view++;
  const ticket = view;
  active = id;
  updateNav();

  const theme = CUPBOARD_THEME[id] || { color: '#ffe5a8', trim: '#d4a65a', doodles: ['★', '★'], tagline: 'YOUR KITCHEN SHELF' };

  if (id === 'games') {
    $('#waffle-speech').textContent = 'Offline arcade heaven!';
    $('#main').innerHTML = `
      <section class="open-cupboard-scene" style="--cup:${theme.color};--trim:${theme.trim}">
        ${woodenSignboardHTML({ kicker: theme.tagline, title: 'Games & Fun', leftDoodle: theme.doodles[0], rightDoodle: theme.doodles[1] })}
        <div class="cabinet-bookcase arcade-bookcase">
          <div class="cabinet-crown" aria-hidden="true"></div>
          <div class="cabinet-interior" id="game-root">
            <p class="empty-msg">Loading 68 real open-source games…</p>
          </div>
        </div>
      </section>
    `;
    bindActions();
    try {
      const m = await import('./games.js');
      if (ticket === view) {
        const cleanup = await m.mountGames($('#game-root'));
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

  $('#waffle-speech').textContent = c ? `${c.name}!` : 'Your shelf!';

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
}

async function openTool(id) {
  const t = allTools.find(x => x.id === id);
  if (!t) return;
  toolCleanup?.();
  toolCleanup = null;
  view++;
  const ticket = view;
  active = t.cupboard;
  recent = [id, ...recent.filter(x => x !== id)].slice(0, 20);
  storage.set('bite-recent', recent);
  updateNav();
  $('#waffle-speech').textContent = t.name + '!';

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
          <div class="tool-workspace" id="tool-root"><p class="empty-msg">Opening toy box…</p></div>
        </div>
      </div>
    </section>
  `;
  bindActions();
  window.scrollTo({ top: 0, behavior: 'auto' });

  try {
    const module = (t.cupboard === 'math' || t.cupboard === 'science')
      ? await import('./tools-math-science.js')
      : t.cupboard === 'code'
        ? await import('./tools-code.js')
        : await import('./tools-text-art.js');
    if (ticket !== view) return;
    $('#tool-root').replaceChildren();
    const result = module.mountMathScience?.(id, $('#tool-root'))
      || module.mountCode?.(id, $('#tool-root'))
      || module.mountTextArt?.(id, $('#tool-root'));
    if (typeof result === 'function') toolCleanup = result;
    if (!result) $('#tool-root').textContent = 'This toy could not be opened.';
  } catch (e) {
    console.error(e);
    if (ticket === view) $('#tool-root').textContent = 'Something went wrong opening this toy.';
  }
}

function bindActions(root = document) {
  root.querySelectorAll('[data-nav]').forEach(b => {
    b.onclick = () => { playPop(500); navigate(b.dataset.nav); };
  });

  root.querySelectorAll('[data-open-cupboard]').forEach(b => {
    b.onclick = () => {
      const id = b.dataset.openCupboard;
      const card = b.closest('.cupboard-card');
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      playCupboardOpen();
      if (!card || reduced) {
        navigate(id);
        return;
      }
      card.classList.add('is-opening');
      setTimeout(() => navigate(id), 420);
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
bindActions();
route();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch(console.warn);
}
