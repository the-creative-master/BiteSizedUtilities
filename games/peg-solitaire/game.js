(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const pegsEl = document.getElementById('pegs');
  const messageEl = document.getElementById('message');

  const W = canvas.width, H = canvas.height, N = 7, CELL = W / N;
  // -1 invalid, 0 empty, 1 peg
  const SHAPE = [
    [-1,-1, 1, 1, 1,-1,-1],
    [-1,-1, 1, 1, 1,-1,-1],
    [ 1, 1, 1, 1, 1, 1, 1],
    [ 1, 1, 1, 0, 1, 1, 1],
    [ 1, 1, 1, 1, 1, 1, 1],
    [-1,-1, 1, 1, 1,-1,-1],
    [-1,-1, 1, 1, 1,-1,-1],
  ];

  let board, selected;

  function newGame() {
    board = SHAPE.map(row => row.slice());
    selected = null;
    pegsEl.textContent = '32';
    messageEl.textContent = 'Click a peg, then a landing spot.';
    draw();
  }

  function countPegs() { return board.flat().filter(v => v === 1).length; }

  function hasMoves() {
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        if (board[r][c] !== 1) continue;
        for (const [dr, dc] of [[2,0],[-2,0],[0,2],[0,-2]]) {
          const mr = r + dr / 2, mc = c + dc / 2, nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < N && nc >= 0 && nc < N && board[nr][nc] === 0 && board[mr][mc] === 1) return true;
        }
      }
    return false;
  }

  function cellFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left) * (W / rect.width) / CELL);
    const r = Math.floor((e.clientY - rect.top) * (H / rect.height) / CELL);
    if (r < 0 || r >= N || c < 0 || c >= N || board[r][c] === -1) return;
    if (selected === null) {
      if (board[r][c] === 1) {
        const mr = Math.floor(r + 0), mc = 0;
        const can = [[2,0],[-2,0],[0,2],[0,-2]].some(([dr, dc]) => {
          const nr = r + dr, nc = c + dc, mid = board[r + dr/2]?.[c + dc/2];
          return nr >= 0 && nr < N && nc >= 0 && nc < N && board[nr][nc] === 0 && mid === 1;
        });
        if (can) { selected = { r, c }; messageEl.textContent = 'Now pick a landing spot.'; }
      }
    } else {
      const sr = selected.r, sc = selected.c;
      if (r === sr && c === sc) { selected = null; return; }
      if (Math.abs(r - sr) + Math.abs(c - sc) === 2 && (r === sr || c === sc) && board[r][c] === 0) {
        const mr = (sr + r) / 2, mc = (sc + c) / 2;
        if (board[mr][mc] === 1) {
          board[sr][sc] = 0; board[mr][mc] = 0; board[r][c] = 1;
          selected = null;
          pegsEl.textContent = String(countPegs());
          if (countPegs() === 1) messageEl.textContent = 'You win! 🎉';
          else if (!hasMoves()) messageEl.textContent = `No moves left — ${countPegs()} pegs remain.`;
          else messageEl.textContent = 'Nice move!';
        }
      } else if (board[r][c] === 1) {
        const can = [[2,0],[-2,0],[0,2],[0,-2]].some(([dr, dc]) => {
          const nr = r + dr, nc = c + dc, mid = board[r + dr/2]?.[c + dc/2];
          return nr >= 0 && nr < N && nc >= 0 && nc < N && board[nr][nc] === 0 && mid === 1;
        });
        selected = can ? { r, c } : null;
      } else selected = null;
    }
    draw();
  }

  function draw() {
    ctx.fillStyle = '#0a0c1d';
    ctx.fillRect(0, 0, W, H);
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        const x = c * CELL, y = r * CELL;
        if (board[r][c] === -1) continue;
        ctx.fillStyle = '#101a3a';
        roundRect(ctx, x + 6, y + 6, CELL - 12, CELL - 12, 10); ctx.fill();
        if (board[r][c] === 1) {
          ctx.save();
          ctx.shadowBlur = 14; ctx.shadowColor = '#80ed99';
          ctx.fillStyle = (selected && selected.r === r && selected.c === c) ? '#ffd166' : '#80ed99';
          ctx.beginPath(); ctx.arc(x + CELL / 2, y + CELL / 2, CELL / 2 - 12, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      }
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  canvas.addEventListener('click', cellFromEvent);
  document.getElementById('new').addEventListener('click', newGame);
  newGame();
})();
