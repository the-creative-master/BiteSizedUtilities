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
  const intro = make('p', 'One hundred little worlds. Find your next favorite, jump right in, and take the whole original arcade offline. A hundred games, each with its own little world.');
  const controlsBar = make('div', '', 'arcade-controls');
  const form = make('form', '', 'tool-form');
  form.setAttribute('role', 'search');
  const label = make('label', 'Find a game ');
  const search = make('input'); search.type = 'search'; search.placeholder = 'Search titles, controls, licenses…'; search.setAttribute('aria-label', 'Search games'); label.append(search); form.append(label);
  form.addEventListener('submit', e => e.preventDefault());
  const filterBar = make('nav', '', 'arcade-filters'); filterBar.setAttribute('aria-label', 'Filter games by style');
  const archive = make('a', '↓ Download all 75 originals', 'action arcade-archive'); archive.href = assetURL('games/zips/original-games.zip'); archive.download = 'bitesized-original-arcade.zip';
  const random = make('button', '✦ Surprise me', 'action arcade-random'); random.type = 'button';
  const seedButton = make('button','◈ Daily score challenge','action arcade-seed');seedButton.type='button';
  const status = make('p', 'Loading local catalog…'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const player = make('section', '', 'panel games-player'); player.hidden = true; player.setAttribute('aria-label', 'Game player');
  const grid = make('div', '', 'game-grid');
  const credits = make('a', 'Licenses, sources & offline audit'); credits.href = assetURL('games/ATTRIBUTION.md');
  controlsBar.append(archive, random, seedButton); shell.append(title, intro, controlsBar, form, filterBar, status, player, grid, credits);
  let activeCard = null, selectedGenre = 'All'; let visibleGames = [], valid = [], render = () => {};
  const genres = ['All','Puzzles','Arcade','Driving','Strategy','Quiz & Words','Cozy'];
  const genreKey={'all':'All','puzzles':'Puzzles','arcade':'Arcade','driving':'Driving','strategy':'Strategy','quiz & words':'Quiz & Words','cozy':'Cozy'};
  function genre(game){if(game.origin!=='first-party')return 'Arcade';const m=game.mechanic;return m==='drive'?'Driving':['number-path','anagram','cipher','merge','mosaic','maze','ladder'].includes(m)?(m==='anagram'||m==='ladder'?'Quiz & Words':'Puzzles'):['life','ecosystem','market','fishing'].includes(m)?'Cozy':['defense','tactics','deck'].includes(m)?'Strategy':['quiz'].includes(m)?'Quiz & Words':'Arcade';}
  for(const g of genres){const b=make('button',`${g} · 0`,'action arcade-filter');b.type='button';b.setAttribute('aria-pressed',String(g==='All'));b.addEventListener('click',()=>{selectedGenre=g;renderFilters();render()});filterBar.append(b)}
  function renderFilters(){const counts=Object.fromEntries(genres.map(g=>[g,g==='All'?valid.length:valid.filter(x=>genre(x)===g).length]));for(const b of filterBar.children){const g=genreKey[b.textContent.split(' · ')[0].toLocaleLowerCase()]||b.textContent.split(' · ')[0];b.textContent=`${g} · ${counts[g]}`;b.setAttribute('aria-pressed',String(g===selectedGenre));b.classList.toggle('is-active',g===selectedGenre)}}
  random.addEventListener('click',()=>{const source=visibleGames.length?visibleGames:valid;if(!source.length)return;const g=source[Math.floor(Math.random()*source.length)];const button=grid.querySelector(`[data-game-id=\"${g.id}\"]`);if(button)launch(g,button);});
  seedButton.addEventListener('click',()=>{const game=visibleGames.find(g=>g.origin==='first-party'&&['life','quiz','deck','market','ecosystem','mosaic','anagram'].includes(g.mechanic))||valid.find(g=>g.origin==='first-party'&&g.mechanic==='life');if(!game)return;const day=new Date().toISOString().slice(0,10);game.seed=`daily-${day}-${game.mechanic}`;const button=grid.querySelector(`[data-game-id=\"${game.id}\"]`);if(button)launch(game,button);});
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
    valid = games.filter(g => g && typeof g.title === 'string' && typeof g.license === 'string' && safePath(g.entrypoint, '.html') && safePath(g.zip, '.zip'));
    // Navigation may have replaced the root while the catalog was loading.
    if (shell.parentNode !== root) return;
    gameCount = valid.length;
    render = () => {
      const query = search.value.trim().toLocaleLowerCase();
      const shown = valid.filter(g => (selectedGenre==='All'||genre(g)===selectedGenre) && [g.title, g.description, g.mechanic, g.license, g.controls, g.repo].join(' ').toLocaleLowerCase().includes(query));
      visibleGames=shown; grid.replaceChildren(); renderFilters();
      for (const game of shown) {
        const card = make('article', '', `game-card panel ${game.origin==='first-party'?'game-original':'game-open-source'}`);
        const h = make('h3', game.title);
        const license = make('p', '', 'game-provenance'); license.append(make('span',game.license,'game-license-chip'),make('span',game.origin==='first-party'?'Made here':'Open-source classic','game-origin-chip'),make('span',genre(game),'game-genre-chip'));
        const blurb = make('p', game.description || game.controls || 'A little game to brighten the break.','game-description');
        const actions = make('div', '', 'tool-form');
        const play = make('button', 'Play now ↗', 'action'); play.type = 'button'; play.setAttribute('aria-label', `Play ${game.title}`); play.dataset.gameId=game.id;play.addEventListener('click', () => launch(game, play));
        const zip = make('a', 'Offline ZIP', 'action'); zip.href = assetURL(game.zip); zip.download = `${game.id}.zip`; zip.setAttribute('aria-label', `Download ${game.title} offline ZIP`);
        const launchNote = make('p',game.controls || game.keyboard || 'Click to start.', 'game-controls'); launchNote.prepend(document.createTextNode('HOW TO PLAY · '));
        actions.append(play, zip); card.append(license, h, blurb, launchNote, actions); grid.append(card);
      }
      status.textContent = shown.length ? `${shown.length} little games · ${valid.filter(g => g.origin === 'first-party').length} original creations · ${new Set(valid.filter(g => g.origin !== 'first-party').map(g => g.repo)).size} open-source game sources` : 'No games match this filter. Try another shelf.';
    };
    search.addEventListener('input', render); render();
  } catch (error) { status.textContent = `Unable to load the offline arcade: ${error.message}. Serve the app through its local web server.`; }
  return () => { player.replaceChildren(); if (shell.parentNode === root) shell.remove(); };
}
