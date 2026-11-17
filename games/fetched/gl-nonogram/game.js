(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const levelEl = document.getElementById('level');
  const missEl = document.getElementById('miss');
  const maxEl = document.getElementById('max');
  const messageEl = document.getElementById('message');
  const restartEl = document.getElementById('restart');

  // Each puzzle: 2D array of 0/1. Filled = 1.
  const PUZZLES = [
    [
      [1,1,1,1,1],
      [1,0,0,0,1],
      [1,0,1,0,1],
      [1,0,0,0,1],
      [1,1,1,1,1],
    ],
    [
      [0,1,1,1,0],
      [1,1,1,1,1],
      [1,1,0,1,1],
      [0,1,1,1,0],
      [0,0,1,0,0],
    ],
    [
      [1,0,0,0,1],
      [0,1,0,1,0],
      [0,0,1,0,0],
      [0,1,0,1,0],
      [1,0,0,0,1],
    ],
  ];

  const MAX_MISS = 5;
  let sol, grid, marks, N, cell, miss, level, over;

  function runClues(arr) {
    const out = []; let cnt = 0;
    for (const v of arr) { if (v) cnt++; else if (cnt) { out.push(cnt); cnt = 0; } }
    if (cnt) out.push(cnt);
    return out.length ? out : [0];
  }

  function newGame() {
    sol = PUZZLES[level % PUZZLES.length];
    N = sol.length;
    grid = Array.from({ length: N }, () => new Array(N).fill(0));
    marks = Array.from({ length: N }, () => new Array(N).fill(0));
    miss = 0; over = false;
    cell = Math.floor(Math.min(canvas.width, canvas.height) / (N + 1)) - 4;
    levelEl.textContent = String(level + 1);
    missEl.textContent = '0'; maxEl.textContent = String(MAX_MISS);
    messageEl.textContent = 'Click to fill, right-click to mark X.';
    draw();
  }

  function rowClues() { return sol.map(r => runClues(r)); }
  function colClues() {
    const out = [];
    for (let c = 0; c < N; c++) out.push(runClues(sol.map(r => r[c])));
    return out;
  }

  function onClick(e) {
    if (over) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    const c = Math.floor((x - cell) / cell), r = Math.floor((y - cell) / cell);
    if (r < 0 || r >= N || c < 0 || c >= N) return;
    const mark = e.button === 2;
    if (mark) { if (grid[r][c]) return; marks[r][c] = marks[r][c] ? 0 : 1; }
    else {
      if (marks[r][c]) return;
      if (grid[r][c]) { grid[r][c] = 0; }
      else {
        grid[r][c] = 1;
        if (!sol[r][c]) { miss++; missEl.textContent = String(miss); if (miss >= MAX_MISS) { over = true; messageEl.textContent = 'Too many mistakes!'; draw(); return; } }
      }
    }
    if (checkWin()) { over = true; messageEl.textContent = 'Solved! 🎉'; }
    draw();
  }

  function checkWin() {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (sol[r][c] && !grid[r][c]) return false;
    return true;
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    g.addColorStop(0, '#15233b'); g.addColorStop(1, '#0f1330');
    ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);

    const rc = rowClues(), cc = colClues();
    ctx.fillStyle = '#9aa0c3'; ctx.font = `${Math.max(10, cell * 0.3)}px system-ui`; ctx.textBaseline = 'middle';
    for (let r = 0; r < N; r++) { ctx.textAlign = 'right'; const cl = rc[r]; cl.forEach((v, i) => { const n = cl.length; ctx.fillText(String(v), cell - 6 - (n - 1 - i) * cell * 0.32, cell + r * cell + cell / 2); }); }
    for (let c = 0; c < N; c++) { ctx.textAlign = 'center'; const cl = cc[c]; cl.forEach((v, i) => ctx.fillText(String(v), cell + c * cell + cell / 2, cell - 6 - (cl.length - 1 - i) * cell * 0.32)); }

    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const x = cell + c * cell, y = cell + r * cell;
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(x, y, cell - 1, cell - 1);
      if (grid[r][c]) { ctx.save(); ctx.shadowBlur = 10; ctx.shadowColor = '#80ed99'; ctx.fillStyle = '#80ed99'; ctx.fillRect(x + 2, y + 2, cell - 5, cell - 5); ctx.restore(); }
      else if (marks[r][c]) { ctx.strokeStyle = '#ff5e7e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 6, y + 6); ctx.lineTo(x + cell - 8, y + cell - 8); ctx.moveTo(x + cell - 8, y + 6); ctx.lineTo(x + 6, y + cell - 8); ctx.stroke(); }
    }
  }

  canvas.addEventListener('click', onClick);
  canvas.addEventListener('contextmenu', e => { e.preventDefault(); onClick(e); });
  restartEl.addEventListener('click', () => { level = (level + 1) % PUZZLES.length; newGame(); });
  let level = 0;
  newGame();
})();
