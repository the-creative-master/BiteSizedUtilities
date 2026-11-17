(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const movesEl = document.getElementById('moves');
  const limitEl = document.getElementById('limit');
  const filledEl = document.getElementById('filled');
  const messageEl = document.getElementById('message');
  const swatches = document.getElementById('swatches');

  const W = canvas.width, H = canvas.height, N = 14, CELL = W / N;
  const LIMIT = 24;
  const COLORS = ['#ff5a7a', '#ffd166', '#80ed99', '#4cc9f0', '#c77dff', '#ff9e3d'];

  let grid, moves, over;

  function newGame() {
    grid = Array.from({ length: N }, () => Array.from({ length: N },
      () => Math.floor(Math.random() * COLORS.length)));
    moves = 0; over = false;
    movesEl.textContent = '0';
    limitEl.textContent = String(LIMIT);
    messageEl.textContent = 'Pick a color to flood.';
    draw();
  }

  function flood(color) {
    if (over) return;
    const old = grid[0][0];
    if (color === old) return;
    const seen = Array.from({ length: N }, () => Array(N).fill(false));
    const stack = [[0, 0]];
    seen[0][0] = true;
    while (stack.length) {
      const [r, c] = stack.pop();
      grid[r][c] = color;
      for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < N && nc >= 0 && nc < N && !seen[nr][nc] && grid[nr][nc] === old) {
          seen[nr][nc] = true; stack.push([nr, nc]);
        }
      }
    }
    moves++;
    movesEl.textContent = String(moves);
    const pct = Math.round((grid.flat().filter(v => v === grid[0][0]).length) / (N * N) * 100);
    filledEl.textContent = pct + '%';
    if (grid.every(row => row.every(v => v === grid[0][0]))) {
      over = true; messageEl.textContent = `Solved in ${moves} moves! 🎉`;
    } else if (moves >= LIMIT) {
      over = true; messageEl.textContent = 'Out of moves — try again!';
    }
    draw();
  }

  function draw() {
    ctx.fillStyle = '#0a0c1d';
    ctx.fillRect(0, 0, W, H);
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        ctx.fillStyle = COLORS[grid[r][c]];
        ctx.fillRect(c * CELL, r * CELL, CELL - 1, CELL - 1);
      }
  }

  COLORS.forEach((col, i) => {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.style.background = col;
    b.addEventListener('click', () => flood(i));
    swatches.appendChild(b);
  });

  newGame();
})();
