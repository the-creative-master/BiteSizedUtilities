/** 2.5D Offline Arcade Heaven — Flash Classics, Impossible Quizzes, Fancade 2.5D & 100+ Games */
import { gamePropSVG } from './icons-25d.js';
import { playPop, playSquish, playSparkle } from './sfx.js';

export let gameCount = 0;
const assetURL = path => new URL(path, new URL(import.meta.env?.BASE_URL || './', document.baseURI)).href;
const safePath = (path, suffix) => typeof path === 'string' && /^games\/[a-zA-Z0-9_./-]+$/.test(path) && !path.split('/').includes('..') && path.endsWith(suffix);

export async function mountGames(root) {
  if (!root || typeof root.replaceChildren !== 'function') throw new TypeError('mountGames requires a DOM element');

  const shell = document.createElement('section');
  shell.className = 'arcade-shelf-shell';
  root.replaceChildren(shell);

  const make = (tag, text, cls) => {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  };

  // Top Arcade Action Bar
  const topBar = make('div', '', 'arcade-top-bar');
  const searchWrap = make('div', '', 'gfield-tray arcade-search-tray');
  const search = make('input', '', 'gfield-input');
  search.type = 'text';
  search.placeholder = 'Search Impossible Quiz, Drive Mad, Tetris, Waffleria…';
  search.setAttribute('aria-label', 'Search games');
  searchWrap.append(search);

  const random = make('button', '✦ Surprise Game', 'gbtn gbtn-primary');
  random.type = 'button';
  const archive = make('a', '↓ All Originals ZIP', 'gbtn gbtn-chip');
  archive.href = assetURL('games/zips/original-games.zip');
  archive.download = 'bitesized-original-arcade.zip';
  topBar.append(searchWrap, random, archive);

  // Genre Filter Chips
  const filterBar = make('div', '', 'gtabs arcade-filters');
  const status = make('p', 'Loading offline arcade shelves…', 'arcade-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  // Floating 2.5D Wooden Game Player Window
  const player = make('section', '', 'tool-window-card arcade-player-window');
  player.hidden = true;
  player.setAttribute('aria-label', 'Game player');

  const shelvesHost = make('div', '', 'arcade-shelves-host');
  const credits = make('a', 'Licenses & offline attribution', 'gbtn gbtn-chip');
  credits.href = assetURL('games/ATTRIBUTION.md');

  shell.append(topBar, filterBar, status, player, shelvesHost, credits);

  let selectedGenre = 'All';
  let visibleGames = [];
  let valid = [];
  let activeCard = null;
  let render = () => {};

  const genres = ['All', 'Flash & Quizzes', 'Fancade 2.5D', 'Puzzles', 'Arcade', 'Driving', 'Strategy', 'Cozy'];

  function genre(game) {
    if (game.category) return game.category;
    if (game.origin !== 'first-party') return 'Arcade';
    const m = game.mechanic;
    if (m === 'drive') return 'Driving';
    if (['number-path', 'anagram', 'cipher', 'merge', 'mosaic', 'maze', 'ladder'].includes(m)) return m === 'anagram' || m === 'ladder' ? 'Puzzles' : 'Puzzles';
    if (['life', 'ecosystem', 'market', 'fishing'].includes(m)) return 'Cozy';
    if (['defense', 'tactics', 'deck'].includes(m)) return 'Strategy';
    if (m === 'quiz') return 'Flash & Quizzes';
    return 'Arcade';
  }

  for (const g of genres) {
    const b = make('button', `${g} · 0`, 'gbtn gtab');
    b.type = 'button';
    b.dataset.genre = g;
    b.classList.toggle('is-active', g === 'All');
    b.addEventListener('click', () => {
      playPop(540);
      selectedGenre = g;
      renderFilters();
      render();
    });
    filterBar.append(b);
  }

  function renderFilters() {
    const counts = Object.fromEntries(genres.map(g => [g, g === 'All' ? valid.length : valid.filter(x => genre(x) === g).length]));
    for (const b of filterBar.children) {
      const g = b.dataset.genre;
      b.textContent = `${g} · ${counts[g]}`;
      b.classList.toggle('is-active', g === selectedGenre);
      b.setAttribute('aria-pressed', String(g === selectedGenre));
    }
  }

  function stop() {
    playPop(440);
    player.replaceChildren();
    player.hidden = true;
    activeCard?.focus();
    activeCard = null;
  }

  function launch(game, button) {
    playSparkle();
    activeCard = button;
    player.replaceChildren();
    player.hidden = false;

    const header = make('div', '', 'tool-window-header');
    const grab = make('div', '', 'window-grab-pill');
    const headRow = make('div', '', 'window-head-row');
    const titleGroup = make('div', '', 'window-title-group');
    const iconBox = make('span', '', 'window-tool-icon');
    iconBox.innerHTML = gamePropSVG(game, genre(game));
    const titleText = document.createElement('div');
    const kicker = make('span', genre(game).toUpperCase(), 'window-kicker');
    const h3 = make('h2', game.title);
    titleText.append(kicker, h3);
    titleGroup.append(iconBox, titleText);

    const actions = make('div', '', 'window-head-actions');
    const restart = make('button', '↻ Restart', 'gbtn gbtn-chip');
    restart.type = 'button';
    const big = make('button', '⛶ Big', 'gbtn gbtn-chip');
    big.type = 'button';
    const dl = make('a', '↓ ZIP', 'gbtn gbtn-chip');
    dl.href = assetURL(game.zip);
    dl.download = `${game.id}.zip`;
    const close = make('button', '✕', 'window-close-x');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close game');
    close.addEventListener('click', stop);
    actions.append(restart, big, dl, close);
    headRow.append(titleGroup, actions);
    header.append(grab, headRow);

    const body = make('div', '', 'tool-window-body');
    const controlsNote = make('p', `HOW TO PLAY: ${game.controls || game.keyboard || 'Tap or use arrow keys.'}`, 'arcade-player-controls');
    const frame = document.createElement('iframe');
    frame.className = 'arcade-iframe';
    frame.title = `${game.title} — offline game`;
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.src = assetURL(game.entrypoint);

    let expanded = false;
    big.addEventListener('click', () => {
      playPop(580);
      expanded = !expanded;
      frame.classList.toggle('is-tall', expanded);
      big.textContent = expanded ? '⊟ Normal' : '⛶ Big';
    });
    restart.addEventListener('click', () => {
      playSquish();
      frame.src = assetURL(game.entrypoint);
    });

    body.append(controlsNote, frame);
    player.append(header, body);
    player.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    close.focus();
  }

  random.addEventListener('click', () => {
    const source = visibleGames.length ? visibleGames : valid;
    if (!source.length) return;
    const g = source[Math.floor(Math.random() * source.length)];
    const btn = shelvesHost.querySelector(`[data-game-id="${g.id}"]`);
    launch(g, btn);
  });

  function renderShelfSection(heading, gamesList) {
    if (!gamesList.length) return null;
    const sec = make('div', '', 'arcade-section');
    const h = make('div', '', 'arcade-section-banner');
    h.textContent = heading;
    sec.append(h);

    const perShelf = window.innerWidth <= 640 ? 2 : 3;
    for (let i = 0; i < gamesList.length; i += perShelf) {
      const row = gamesList.slice(i, i + perShelf);
      const shelfRow = make('div', '', 'wooden-shelf-row');
      const grid = make('div', '', `shelf-objects-grid shelf-cols-${perShelf}`);
      for (const game of row) {
        const slot = make('div', '', 'shelf-object-slot arcade-slot');
        const btn = make('button', '', 'shelf-object arcade-cartridge');
        btn.type = 'button';
        btn.dataset.gameId = game.id;
        btn.setAttribute('aria-label', `Play ${game.title}`);

        const tile = make('span', '', 'object-tile');
        tile.innerHTML = gamePropSVG(game, genre(game));
        const label = make('span', game.title, 'object-label');
        const tag = make('span', genre(game), 'arcade-genre-pill');
        btn.append(tile, label, tag);
        btn.addEventListener('click', () => launch(game, btn));
        slot.append(btn);
        grid.append(slot);
      }
      const plank = make('div', '', 'wooden-plank');
      plank.setAttribute('aria-hidden', 'true');
      shelfRow.append(grid, plank);
      sec.append(shelfRow);
    }
    return sec;
  }

  try {
    const response = await fetch(assetURL('games/catalog.json'));
    if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
    const payload = await response.json();
    const games = Array.isArray(payload) ? payload : payload.games;
    if (!Array.isArray(games)) throw new Error('Invalid local game catalog');
    valid = games.filter(g => g && typeof g.title === 'string' && typeof g.license === 'string' && safePath(g.entrypoint, '.html') && safePath(g.zip, '.zip'));
    if (shell.parentNode !== root) return;
    gameCount = valid.length;

    render = () => {
      const query = search.value.trim().toLocaleLowerCase();
      const shown = valid.filter(g => (selectedGenre === 'All' || genre(g) === selectedGenre)
        && [g.title, g.description, g.mechanic, g.category, g.controls, g.id].join(' ').toLocaleLowerCase().includes(query));
      visibleGames = shown;
      shelvesHost.replaceChildren();
      renderFilters();

      const featured = shown.filter(g => g.featured || g.origin === 'arcade-hit');
      const classics = shown.filter(g => g.origin === 'github');
      const originals = shown.filter(g => g.origin === 'first-party');

      if (featured.length) shelvesHost.append(renderShelfSection('★ FEATURED FLASH, IMPOSSIBLE QUIZ & FANCADE HITS', featured));
      if (classics.length) shelvesHost.append(renderShelfSection('✦ OPEN-SOURCE ARCADE CLASSICS', classics));
      if (originals.length) shelvesHost.append(renderShelfSection('◈ 75 COZY MINI-WORLDS', originals));

      if (!shown.length) {
        const empty = make('div', '', 'empty-shelf');
        empty.textContent = 'No games matched that search! Try "Impossible", "Truck", or "Tetris".';
        shelvesHost.append(empty);
      }

      status.textContent = `${shown.length} playable offline games ready · Zero internet required!`;
    };

    search.addEventListener('input', render);
    render();
  } catch (error) {
    status.textContent = `Unable to load the offline arcade: ${error.message}.`;
  }

  return () => {
    player.replaceChildren();
    if (shell.parentNode === root) shell.remove();
  };
}
