/** 2.5D Offline Arcade — 51 Games (offline cabinet + four originals + two MIT guests + Roper Fancade) */
import { gamePropSVG } from './icons-25d.js';
import { playPop, playSquish, playSparkle } from './sfx.js';

export let gameCount = 0;
let cachedCatalog = null;
const assetURL = path => new URL(path, new URL(import.meta.env?.BASE_URL || './', document.baseURI)).href;
const safePath = (path, suffixes) => typeof path === 'string'
  && /^games\/[a-zA-Z0-9_./-]+$/.test(path)
  && !path.split('/').includes('..')
  && suffixes.some(s => path.endsWith(s));

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

  const topBar = make('div', '', 'arcade-top-bar');
  const searchWrap = make('div', '', 'gfield-tray arcade-search-tray');
  const search = make('input', '', 'gfield-input');
  search.type = 'text';
  search.placeholder = 'Search Roper, Bloons TD, Drive Mad, Impossible Quiz, Retro Bowl, BitLife…';
  search.setAttribute('aria-label', 'Search games');
  searchWrap.append(search);

  const random = make('button', '✦ Surprise Game', 'gbtn gbtn-primary');
  random.type = 'button';
  topBar.append(searchWrap, random);

  const filterBar = make('div', '', 'gtabs arcade-filters');
  const status = make('p', 'Loading the offline arcade…', 'arcade-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const player = make('section', '', 'tool-window-card arcade-player-window');
  player.hidden = true;
  player.setAttribute('aria-label', 'Game player');

  const shelvesHost = make('div', '', 'arcade-shelves-host');
  const credits = make('a', 'Game credits & catalog list', 'gbtn gbtn-chip');
  credits.href = assetURL('games/ATTRIBUTION.md');

  shell.append(topBar, filterBar, status, player, shelvesHost, credits);

  let selectedGenre = 'All';
  let visibleGames = [];
  let valid = [];
  let activeCard = null;
  let render = () => {};

  const genres = ['All', 'Action', 'Puzzle', 'Casual', 'Fancade'];

  function genre(game) {
    if (game.category && genres.includes(game.category)) return game.category;
    if (Array.isArray(game.tags) && game.tags.includes('fancade')) return 'Fancade';
    return 'Action';
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
    const counts = Object.fromEntries(genres.map(g => [
      g,
      g === 'All'
        ? valid.length
        : valid.filter(x => genre(x) === g || (Array.isArray(x.tags) && x.tags.map(t => t.toLowerCase()).includes(g.toLowerCase()))).length
    ]));
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
    const kicker = make('span', `${genre(game).toUpperCase()} · OFFLINE ARCADE`, 'window-kicker');
    const h3 = make('h2', game.title);
    titleText.append(kicker, h3);
    titleGroup.append(iconBox, titleText);

    const actions = make('div', '', 'window-head-actions');
    const playHere = make('a', '▶ Play Game', 'gbtn gbtn-primary');
    playHere.href = assetURL(game.entrypoint);
    const fullTab = make('a', '↗ New Tab', 'gbtn gbtn-chip');
    fullTab.href = assetURL(game.entrypoint);
    fullTab.target = '_blank';
    fullTab.rel = 'noopener';
    const dl = make('a', '↓ Save', 'gbtn gbtn-chip');
    dl.href = assetURL(game.entrypoint);
    dl.download = `${game.id}.html`;
    const close = make('button', '✕', 'window-close-x');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close game');
    close.addEventListener('click', stop);
    actions.append(playHere, fullTab, dl, close);
    headRow.append(titleGroup, actions);
    header.append(grab, headRow);

    const body = make('div', '', 'tool-window-body');
    const controlsNote = make(
      'p',
      `${game.description || 'Ready to play!'} · ${game.controls || 'Keyboard / Mouse / Touch'} · Launches directly without iframing.`,
      'arcade-player-controls'
    );
    const launcher = make('div', '', 'arcade-launcher-card');
    const art = make('div', '', 'arcade-launcher-art');
    art.innerHTML = gamePropSVG(game, genre(game));
    const meta = make('div', '', 'arcade-launcher-meta');
    meta.append(
      make('h3', game.title, 'arcade-launcher-title'),
      make('p', game.description || 'Ready to play offline directly from local assets.', 'arcade-launcher-desc'),
      make('p', `Controls: ${game.controls || 'Keyboard / Mouse / Touch'}`, 'arcade-launcher-controls')
    );
    const launchBtns = make('div', '', 'arcade-launcher-actions');
    const primaryPlay = make('a', '▶ Play Now (Direct)', 'gbtn gbtn-primary');
    primaryPlay.href = assetURL(game.entrypoint);
    const tabPlay = make('a', '↗ Open in New Tab', 'gbtn gbtn-chip');
    tabPlay.href = assetURL(game.entrypoint);
    tabPlay.target = '_blank';
    tabPlay.rel = 'noopener';
    launchBtns.append(primaryPlay, tabPlay);
    meta.append(launchBtns);
    launcher.append(art, meta);

    body.append(controlsNote, launcher);

    let gated = false;
    if (game.age) {
      // The warning goes where the play buttons are not. Every route into the
      // game goes dark while it is up — the launcher *and* the three links in the
      // header, because leaving those live would be a warning with a door around
      // it. Nothing is remembered either: it comes back every single time, since
      // a child who taps through it once should not have bought the game for good.
      gated = true;
      const gate = make('div', '', 'arcade-age-gate');
      gate.setAttribute('role', 'alert');
      const stamp = make('div', game.age, 'arcade-age-stamp');
      stamp.setAttribute('aria-hidden', 'true');
      const head = make('h3', `Stop — ${game.title} is rated ${game.age}.`, 'arcade-age-head');
      const why = make('p', game.ageNote || 'This one is built around grown-up content.', 'arcade-age-why');
      const who = make('p', 'It is not a game for a young child. If a child is the one holding this device, take me back and pick something else off the shelf — the rest of the cabinet has no rating on it at all.', 'arcade-age-who');
      const fresh = make('p', 'Nothing here is remembered. This warning comes back every time the game is opened.', 'arcade-age-fresh');
      const acts = make('div', '', 'arcade-age-actions');
      const back = make('button', '\u2715 Take me back to the cabinet', 'gbtn gbtn-danger');
      back.type = 'button';
      const enter = make('button', `I am ${game.age}. Open it.`, 'gbtn gbtn-primary');
      enter.type = 'button';
      acts.append(back, enter);
      gate.append(stamp, head, why, who, fresh, acts);
      body.append(gate);
      actions.hidden = true;
      controlsNote.hidden = true;
      launcher.hidden = true;
      enter.addEventListener('click', () => {
        playPop(520);
        gate.remove();
        gated = false;
        actions.hidden = false;
        controlsNote.hidden = false;
        launcher.hidden = false;
        primaryPlay.focus();
      });
      back.addEventListener('click', stop);
      enter.setAttribute('aria-describedby', 'arcade-age-note');
      fresh.id = 'arcade-age-note';
    }

    player.append(header, body);
    player.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    if (!gated) primaryPlay.focus();
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
        if (game.age) {
          // On the shelf, before anything is opened. Somebody browsing the
          // cabinet should be able to see which game is not for a child without
          // having to open it first.
          const age = make('span', `\u26A0 ${game.age}`, 'arcade-age-pill');
          age.title = `${game.title} is rated ${game.age}`;
          btn.append(age);
        }
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
    if (!cachedCatalog) {
      const response = await fetch(assetURL('games/catalog.json'));
      if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
      cachedCatalog = await response.json();
    }
    const payload = cachedCatalog;
    const games = Array.isArray(payload) ? payload : payload.games;
    if (!Array.isArray(games)) throw new Error('Invalid local game catalog');
    valid = games.filter(g => g && typeof g.title === 'string' && safePath(g.entrypoint, ['.html', '.htm']));
    if (shell.parentNode !== root) return;
    gameCount = valid.length;

    render = () => {
      const query = search.value.trim().toLocaleLowerCase();
      const shown = valid.filter(g => (
        selectedGenre === 'All'
        || genre(g) === selectedGenre
        || (Array.isArray(g.tags) && g.tags.map(t => t.toLowerCase()).includes(selectedGenre.toLowerCase()))
      ) && [g.title, g.description, g.category, ...(g.tags || []), g.id].join(' ').toLocaleLowerCase().includes(query));
      visibleGames = shown;
      shelvesHost.replaceChildren();
      renderFilters();

      const featured = shown.filter(g => g.featured);
      const rest = shown.filter(g => !g.featured);

      if (featured.length) shelvesHost.append(renderShelfSection('★ FAN FAVORITES & FANCADE', featured));
      if (rest.length) shelvesHost.append(renderShelfSection('✦ MORE ARCADE & PUZZLES', rest));

      if (!shown.length) {
        const empty = make('div', '', 'empty-shelf');
        empty.textContent = 'No games matched that search! Try "Bloons", "Drive Mad", "Retro Bowl", or "2048".';
        shelvesHost.append(empty);
      }

      status.textContent = `${shown.length} offline games ready to play`;
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
