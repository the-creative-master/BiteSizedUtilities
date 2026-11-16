import './style.css';
import { cupboards, allTools } from './catalog.js';
import { waffleMascotSVG, cupboardIconSVG, toolPropSVG, uiIconSVG } from './icons-25d.js';

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

const WAFFLE_QUIPS = [
  'Boing! Sweet math!',
  'Tap a cupboard!',
  'Freshly baked numbers!',
  'Waffle power! 🧇',
  'Cozy kitchen vibes!',
  'Pick a shelf toy!'
];
let quipIndex = 0;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ALL_CUPBOARDS = [
  ...cupboards,
  { id: 'games', name: 'Games & Fun', short: '100 little arcade worlds', icon: '♧', color: '#dfd0f5', trim: '#a68fd1', star: 'games', tools: [] }
];

const app = $('#app');
app.innerHTML = `
  <div class="waffle-world" id="waffle-bg" aria-hidden="false">
    <div class="waffle-grid-layer" id="waffle-grid"></div>
    <div class="waffle-pops" id="waffle-pops" aria-hidden="true"></div>
  </div>
  <div class="game-viewport">
    <header class="game-topbar">
      <div class="topbar-left">
        <button type="button" class="waffle-mascot-btn" id="waffle-mascot" aria-label="Tap Sir Waffle mascot to bounce">
          ${waffleMascotSVG()}
          <span class="waffle-speech" id="waffle-speech">Tap a cupboard!</span>
        </button>
        <button type="button" class="wood-sign-brand gbtn" data-nav="all" aria-label="Go to kitchen wall">
          <span class="sign-title">BiteSized</span>
          <span class="sign-sub">COZY KITCHEN</span>
        </button>
      </div>
      <nav class="game-nav" aria-label="Kitchen navigation">
        <button type="button" class="gbtn gnav-btn selected" data-nav="all">
          <span class="gnav-icon">${uiIconSVG('home')}</span>
          <span class="gnav-label">Kitchen</span>
        </button>
        <button type="button" class="gbtn gnav-btn" data-nav="favorites">
          <span class="gnav-icon">${uiIconSVG('heart')}</span>
          <span class="gnav-label">Saved</span>
          <span class="gnav-count" id="fav-count">${favorites.size}</span>
        </button>
        <button type="button" class="gbtn gnav-btn" data-nav="recent">
          <span class="gnav-icon">${uiIconSVG('clock')}</span>
          <span class="gnav-label">Recent</span>
        </button>
      </nav>
    </header>
    <main id="main" class="kitchen-stage"></main>
  </div>
  <div id="toast" role="status" aria-live="polite"></div>
`;

function triggerWaffleBounce(clientX, clientY, fromMascot = false) {
  const grid = $('#waffle-grid');
  const mascot = $('#waffle-mascot');
  const speech = $('#waffle-speech');

  grid.classList.remove('is-bouncing');
  void grid.offsetWidth;
  grid.classList.add('is-bouncing');

  mascot.classList.remove('is-bouncing');
  void mascot.offsetWidth;
  mascot.classList.add('is-bouncing');

  if (fromMascot || Math.random() < 0.6) {
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

// Tapping the waffle background (or empty stage around cupboards) bounces the waffle!
document.addEventListener('click', e => {
  if (e.target.closest('button, a, input, textarea, select, canvas, .gslider-track, .tool-workspace, .cupboard-card, .open-cupboard')) return;
  triggerWaffleBounce(e.clientX, e.clientY, false);
});

function updateNav() {
  document.querySelectorAll('[data-nav]').forEach(b => {
    b.classList.toggle('selected', b.dataset.nav === active);
  });
  $('#fav-count').textContent = favorites.size;
}

function cupboardCard(c) {
  const countText = c.id === 'games' ? '100 GAMES' : `${c.tools.length} TOYS`;
  return `
    <article class="cupboard-card" style="--cup:${c.color};--trim:${c.trim}" data-cupboard="${c.id}">
      <div class="cupboard-frame">
        <div class="cupboard-recess" aria-hidden="true">
          <div class="mini-shelf ms1"><span></span><span></span><span></span></div>
          <div class="mini-shelf ms2"><span></span><span></span></div>
        </div>
        <button type="button" class="cupboard-door" data-open-cupboard="${c.id}" aria-label="Open ${esc(c.name)} cupboard">
          <span class="hinge h-top" aria-hidden="true"></span>
          <span class="hinge h-bot" aria-hidden="true"></span>
          <div class="door-panel">
            <div class="door-icon-badge">${cupboardIconSVG(c.id)}</div>
            <span class="cupboard-label">${esc(c.name)}</span>
            <span class="cupboard-badge">${countText}</span>
          </div>
          <span class="door-knob" aria-hidden="true"></span>
        </button>
      </div>
    </article>
  `;
}

function home() {
  toolCleanup?.();
  toolCleanup = null;
  view++;
  active = 'all';
  updateNav();
  $('#waffle-speech').textContent = 'Pick a cupboard!';

  $('#main').innerHTML = `
    <section class="kitchen-wall" aria-label="Cozy 2.5D Kitchen Wall">
      <div class="wall-banner">
        <h1>Welcome to the Kitchen!</h1>
        <p>Open any cupboard to play with cozy tools — or tap Sir Waffle anytime!</p>
      </div>
      <div class="cupboard-grid">
        ${ALL_CUPBOARDS.map(cupboardCard).join('')}
      </div>
      <div class="kitchen-counter-ledge" aria-hidden="true">
        <div class="ledge-top"></div>
        <div class="ledge-front"></div>
      </div>
    </section>
  `;
  bindActions();
}

function shelfItemCard(t) {
  const isFav = favorites.has(t.id);
  return `
    <div class="shelf-object-slot">
      <button type="button" class="favorite-sticker ${isFav ? 'is-favorite' : ''}" data-fav="${t.id}" aria-label="${isFav ? 'Unsave' : 'Save'} ${esc(t.name)}" aria-pressed="${isFav}">
        ${uiIconSVG('heart')}
      </button>
      <button type="button" class="shelf-object" data-tool="${t.id}" style="--cup:${t.color}">
        <span class="object-prop">${toolPropSVG(t.id)}</span>
        <span class="object-shadow" aria-hidden="true"></span>
        <span class="object-tag">
          <strong>${esc(t.name)}</strong>
          <small>${esc(t.description)}</small>
        </span>
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

async function collection(id) {
  toolCleanup?.();
  toolCleanup = null;
  view++;
  const ticket = view;
  active = id;
  updateNav();

  if (id === 'games') {
    $('#waffle-speech').textContent = 'Play time!';
    $('#main').innerHTML = `
      <section class="open-cupboard" style="--cup:#dfd0f5;--trim:#a68fd1">
        <div class="open-cupboard-head">
          <button type="button" class="gbtn close-door-btn" data-nav="all">
            <span class="btn-svg">${uiIconSVG('back')}</span> Close Cupboard
          </button>
          <div class="cupboard-head-title">
            <span class="head-icon">${cupboardIconSVG('games')}</span>
            <div>
              <h1>Games & Fun</h1>
              <p>100 playable games on the arcade shelf</p>
            </div>
          </div>
        </div>
        <div class="tool-workspace" id="game-root"><p class="empty-msg">Sliding out the arcade shelf…</p></div>
      </section>
    `;
    bindActions();
    try {
      const m = await import('./games.js');
      if (ticket === view) await m.mountGames($('#game-root'));
    } catch (e) {
      if (ticket === view) $('#game-root').textContent = 'The arcade could not load.';
      console.error(e);
    }
    return;
  }

  const c = cupboards.find(x => x.id === id);
  const title = c ? c.name : id === 'favorites' ? 'Saved Toys' : 'Recently Played';
  const subtitle = c ? c.short : id === 'favorites' ? 'Your favorite kitchen objects' : 'Pick up where you left off';
  const tools = c
    ? allTools.filter(t => t.cupboard === id)
    : id === 'favorites'
      ? allTools.filter(t => favorites.has(t.id))
      : recent.map(rid => allTools.find(t => t.id === rid)).filter(Boolean);

  $('#waffle-speech').textContent = c ? `${c.name}!` : 'Your shelf!';

  const perShelf = window.innerWidth <= 640 ? 2 : 3;
  const shelves = chunkShelves(tools, perShelf);

  $('#main').innerHTML = `
    <section class="open-cupboard" style="--cup:${c?.color || '#ffe5a8'};--trim:${c?.trim || '#d4a65a'}">
      <div class="swing-wing left" aria-hidden="true"></div>
      <div class="swing-wing right" aria-hidden="true"></div>
      <div class="open-cupboard-head">
        <button type="button" class="gbtn close-door-btn" data-nav="all">
          <span class="btn-svg">${uiIconSVG('back')}</span> Close Cupboard
        </button>
        <div class="cupboard-head-title">
          <span class="head-icon">${cupboardIconSVG(c?.id || 'math')}</span>
          <div>
            <h1>${esc(title)}</h1>
            <p>${esc(subtitle)} • ${tools.length} ${tools.length === 1 ? 'object' : 'objects'}</p>
          </div>
        </div>
      </div>
      <div class="cupboard-shelves-stage">
        ${shelves.length ? shelves.map(row => `
          <div class="wooden-shelf-row">
            <div class="shelf-objects-grid">${row.map(shelfItemCard).join('')}</div>
            <div class="wooden-plank" aria-hidden="true"></div>
          </div>
        `).join('') : `
          <div class="empty-shelf">
            <p>${id === 'favorites' ? 'Tap the heart sticker on any toy to keep it on this shelf!' : 'Open any toy in a cupboard and it will appear here!'}</p>
            <button type="button" class="gbtn gbtn-primary" data-nav="all">Back to Kitchen Wall</button>
          </div>
        `}
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
    <section class="tool-workbench" style="--cup:${t.color};--trim:${cup?.trim || '#b88456'}">
      <div class="workbench-top">
        <button type="button" class="gbtn close-door-btn" data-nav="${t.cupboard}">
          <span class="btn-svg">${uiIconSVG('back')}</span> Back to ${esc(cup?.name || 'Shelf')}
        </button>
        <div class="workbench-title">
          <span class="workbench-prop">${toolPropSVG(t.id)}</span>
          <div>
            <h1>${esc(t.name)}</h1>
            <p>${esc(t.description)}</p>
          </div>
        </div>
        <button type="button" class="gbtn favorite-btn ${isFav ? 'is-favorite' : ''}" data-fav="${id}" aria-label="${isFav ? 'Unsave' : 'Save'} ${esc(t.name)}" aria-pressed="${isFav}">
          <span class="btn-svg">${uiIconSVG('heart')}</span>
        </button>
      </div>
      <div class="tool-workspace" id="tool-root"><p class="empty-msg">Lifting off the shelf…</p></div>
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
    b.onclick = () => navigate(b.dataset.nav);
  });

  root.querySelectorAll('[data-open-cupboard]').forEach(b => {
    b.onclick = () => {
      const id = b.dataset.openCupboard;
      const card = b.closest('.cupboard-card');
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!card || reduced) {
        navigate(id);
        return;
      }
      card.classList.add('is-opening');
      setTimeout(() => navigate(id), 340);
    };
  });

  root.querySelectorAll('[data-tool]').forEach(b => {
    b.onclick = () => { location.hash = 'tool/' + b.dataset.tool; };
  });

  root.querySelectorAll('[data-fav]').forEach(b => {
    b.onclick = e => {
      e.stopPropagation();
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
