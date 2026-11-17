(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const movesEl = document.getElementById('moves');
  const bestEl = document.getElementById('best');
  const messageEl = document.getElementById('message');
  const restartEl = document.getElementById('restart');

  const W = canvas.width, H = canvas.height, N = 8;
  const TILE = W / N;
  const COLORS = ['#ff5e7e', '#ffd166', '#80ed99', '#4cc9f0', '#c98bff', '#ff9d5e'];
  const BEST_KEY = 'match3-best';

  let grid, score, moves, best, sel, busy;

  function rand() { return Math.floor(Math.random() * COLORS.length); }

  function newBoard() {
    grid = [];
    for (let r = 0; r < N; r++) {
      grid.push([]);
      for (let c = 0; c < N; c++) {
        let v;
        do { v = rand(); } while ((c >= 2 && grid[r][c - 1] === v && grid[r][c - 2] === v) ||
                                 (r >= 2 && grid[r - 1][c] === v && grid[r - 2][c] === v));
        grid[r][c] = v;
      }
    }
  }

  function bestKey() { try { return parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) { return 0; } }

  function newGame() {
    newBoard();
    score = 0; moves = 20; sel = null; busy = false;
    best = bestKey();
    scoreEl.textContent = '0'; movesEl.textContent = '20'; bestEl.textContent = String(best);
    messageEl.textContent = 'Swap adjacent gems to match three or more.';
    draw();
  }

  function findMatches() {
    const set = new Set();
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        const v = grid[r][c];
        let n = 1; for (let k = c + 1; k < N && grid[r][k] === v; k++) n++;
        if (n >= 3) for (let k = c; k < c + n; k++) set.add(r + ',' + k);
        n = 1; for (let k = r + 1; k < N && grid[k][c] === v; k++) n++;
        if (n >= 3) for (let k = r; k < r + n; k++) set.add(k + ',' + c);
      }
    return set;
  }

  function resolve() {
    let combo = 0;
    while (true) {
      const m = findMatches();
      if (m.size === 0) break;
      combo++;
      m.forEach(k => { const [r, c] = k.split(',').map(Number); grid[r][c] = -1; });
      score += m.size * 10 * combo;
      for (let c = 0; c < N; c++) {
        const col = [];
        for (let r = N - 1; r >= 0; r--) if (grid[r][c] !== -1) col.push(grid[r][c]);
        while (col.length < N) col.push(rand());
        for (let r = N - 1, i = 0; r >= 0; r--, i++) grid[r][c] = col[i];
      }
    }
    scoreEl.textContent = String(score);
    if (score > best) { best = score; bestEl.textContent = String(best); try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {} }
  }

  function cellFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    const y = (e.clientY - rect.top) * (H / rect.height);
    return { c: Math.floor(x / TILE), r: Math.floor(y / TILE) };
  }

  function onClick(e) {
    if (busy || moves <= 0) return;
    const { r, c } = cellFromEvent(e);
    if (r < 0 || c < 0 || r >= N || c >= N) return;
    if (!sel) { sel = { r, c }; draw(); return; }
    const adj = Math.abs(sel.r - r) + Math.abs(sel.c - c) === 1;
    if (!adj) { sel = { r, c }; draw(); return; }
    busy = true;
    const a = sel, b = { r, c };
    [grid[a.r][a.c], grid[b.r][b.c]] = [grid[b.r][b.c], grid[a.r][a.c]];
    if (findMatches().size === 0) {
      [grid[a.r][a.c], grid[b.r][b.c]] = [grid[b.r][b.c], grid[a.r][a.c]];
      sel = null; busy = false; draw();
      messageEl.textContent = 'No match — try another swap.';
      return;
    }
    moves--; movesEl.textContent = String(moves);
    sel = null;
    resolve();
    busy = false;
    if (moves <= 0 && findMatches().size === 0) messageEl.textContent = 'Out of moves! Press New Board.';
    else messageEl.textContent = 'Nice! Cascades scored points.';
    draw();
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#141a3a'); g.addColorStop(1, '#0a0c1d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        const x = c * TILE, y = r * TILE;
        if (sel && sel.r === r && sel.c === c) {
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
          roundRect(ctx, x + 3, y + 3, TILE - 6, TILE - 6, 8); ctx.stroke();
        }
        const v = grid[r][c];
        if (v < 0) continue;
        ctx.save(); ctx.shadowBlur = 12; ctx.shadowColor = COLORS[v];
        ctx.fillStyle = COLORS[v];
        roundRect(ctx, x + 6, y + 6, TILE - 12, TILE - 12, 10); ctx.fill();
        ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        roundRect(ctx, x + 11, y + 11, TILE - 22, (TILE - 22) / 2, 6); ctx.fill();
      }
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  canvas.addEventListener('click', onClick);
  restartEl.addEventListener('click', newGame);

  newGame();
})();
