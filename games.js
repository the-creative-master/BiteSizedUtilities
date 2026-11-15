/** Offline GitHub game library. No third-party code runs in the host document. */
export let gameCount = 0;
const assetURL = path => new URL(path, new URL(import.meta.env?.BASE_URL || './', document.baseURI)).href;
const safePath = (path, suffix) => typeof path === 'string' && /^games\/[a-zA-Z0-9_./-]+$/.test(path) && !path.split('/').includes('..') && path.endsWith(suffix);

export async function mountGames(root) {
  if (!root || typeof root.replaceChildren !== 'function') throw new TypeError('mountGames requires a DOM element');
  const shell = document.createElement('section');
  shell.className = 'games-library panel';
  root.replaceChildren(shell);
  const make = (tag, text, cls) => { const el = document.createElement(tag); if (text) el.textContent = text; if (cls) el.className = cls; return el; };
  const title = make('h2', 'Offline Arcade');
  const intro = make('p', 'Real open-source games, kept locally. Play in an isolated frame or download a complete offline ZIP.');
  const form = make('form', '', 'tool-form');
  form.setAttribute('role', 'search');
  const label = make('label', 'Find a game ');
  const search = make('input'); search.type = 'search'; search.placeholder = 'Search titles, controls, licenses…'; search.setAttribute('aria-label', 'Search games'); label.append(search); form.append(label);
  form.addEventListener('submit', e => e.preventDefault());
  const status = make('p', 'Loading local catalog…'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const player = make('section', '', 'panel games-player'); player.hidden = true; player.setAttribute('aria-label', 'Game player');
  const grid = make('div', '', 'game-grid');
  const credits = make('a', 'Licenses, sources & offline audit'); credits.href = assetURL('games/ATTRIBUTION.md');
  shell.append(title, intro, form, status, player, grid, credits);
  let activeCard = null;
  function stop() { player.replaceChildren(); player.hidden = true; activeCard?.focus(); activeCard = null; }
  function launch(game, button) {
    activeCard = button; player.replaceChildren(); player.hidden = false;
    const heading = make('h3', game.title);
    const controls = make('p', game.controls || game.keyboard || 'Use the on-screen controls.');
    const note = make('p', 'Click inside the game to give it keyboard focus. Close stops the game. Scores are session-only.');
    const toolbar = make('div', '', 'tool-form');
    const restart = make('button', 'Restart', 'action'); restart.type = 'button';
    const close = make('button', 'Close game', 'action'); close.type = 'button'; close.addEventListener('click', stop);
    const download = make('a', 'Download offline ZIP', 'action'); download.href = assetURL(game.zip); download.download = `${game.id}.zip`;
    const frame = make('iframe'); frame.title = `${game.title} — isolated offline game`;
    frame.setAttribute('sandbox', 'allow-scripts'); frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.style.cssText = 'display:block;width:100%;height:70vh;min-height:420px;border:1px solid currentColor;border-radius:12px;background:#fff';
    frame.src = assetURL(game.entrypoint);
    restart.addEventListener('click', () => { frame.src = assetURL(game.entrypoint); });
    toolbar.append(restart, close, download); player.append(heading, controls, note, toolbar, frame);
    player.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); close.focus();
  }
  try {
    const response = await fetch(assetURL('games/catalog.json'));
    if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
    const payload = await response.json();
    const games = Array.isArray(payload) ? payload : payload.games;
    if (!Array.isArray(games)) throw new Error('Invalid local game catalog');
    const valid = games.filter(g => g && typeof g.title === 'string' && typeof g.license === 'string' && safePath(g.entrypoint, '.html') && safePath(g.zip, '.zip'));
    // Navigation may have replaced the root while the catalog was loading.
    if (shell.parentNode !== root) return;
    gameCount = valid.length;
    function render() {
      const query = search.value.trim().toLocaleLowerCase();
      const shown = valid.filter(g => [g.title, g.license, g.controls, g.repo].join(' ').toLocaleLowerCase().includes(query));
      grid.replaceChildren();
      for (const game of shown) {
        const card = make('article', '', 'game-card panel');
        const h = make('h3', game.title);
        const license = make('p', `${game.license} · GitHub source · offline`);
        const hint = make('p', game.controls || game.keyboard || 'Use the on-screen controls.');
        const actions = make('div', '', 'tool-form');
        const play = make('button', 'Play', 'action'); play.type = 'button'; play.setAttribute('aria-label', `Play ${game.title}`); play.addEventListener('click', () => launch(game, play));
        const zip = make('a', 'Offline ZIP', 'action'); zip.href = assetURL(game.zip); zip.download = `${game.id}.zip`; zip.setAttribute('aria-label', `Download ${game.title} offline ZIP`);
        actions.append(play, zip); card.append(h, license, hint, actions); grid.append(card);
      }
      status.textContent = shown.length ? `${shown.length} of ${valid.length} games · ${new Set(valid.map(g => g.repo)).size} source repositories` : 'No games match your search.';
    }
    search.addEventListener('input', render); render();
  } catch (error) { status.textContent = `Unable to load the offline arcade: ${error.message}. Serve the app through its local web server.`; }
  return () => { player.replaceChildren(); if (shell.parentNode === root) shell.remove(); };
}
