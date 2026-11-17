(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const youEl = document.getElementById('you');
  const aiEl = document.getElementById('ai');
  const turnEl = document.getElementById('turn');
  const messageEl = document.getElementById('message');
  const restartEl = document.getElementById('restart');

  const W = canvas.width, H = canvas.height, N = 15, T = W / N;
  const OFF = T / 2;
  // 0 empty, 1 you (black ●), 2 ai (white ○)
  let board, turn, over, lastMove;

  const DIRS = [[-1,0],[0,1],[-1,1],[1,1],[1,0],[0,-1],[1,-1],[-1,-1]];

  function inB(r, c) { return r >= 0 && r < N && c >= 0 && c < N; }

  function newGame() {
    board = Array.from({ length: N }, () => new Array(N).fill(0));
    turn = 1; over = false; lastMove = null;
    turnEl.textContent = 'You'; messageEl.textContent = 'Click to place your stone.';
    draw();
  }

  function checkWin(r, c, p) {
    for (const [dr, dc] of [[1,0],[0,1],[1,1],[1,-1]]) {
      let cnt = 1;
      for (const s of [1, -1]) {
        let nr = r + dr * s, nc = c + dc * s;
        while (inB(nr, nc) && board[nr][nc] === p) { cnt++; nr += dr * s; nc += dc * s; }
      }
      if (cnt >= 5) return true;
    }
    return false;
  }

  function scoreDir(r, c, dr, dc, p) {
    let cnt = 1, open = 0;
    for (const s of [1, -1]) {
      let nr = r + dr * s, nc = c + dc * s;
      while (inB(nr, nc) && board[nr][nc] === p) { cnt++; nr += dr * s; nc += dc * s; }
      if (inB(nr, nc) && board[nr][nc] === 0) open++;
      else if (inB(nr, nc)) open -= 0.5;
    }
    return cnt >= 5 ? 1000 : cnt * cnt * (open + 1);
  }

  function evalCell(r, c, p) {
    let s = 0;
    for (const [dr, dc] of [[1,0],[0,1],[1,1],[1,-1]]) s += scoreDir(r, c, dr, dc, p);
    return s;
  }

  function aiMove() {
    let best = null, bestScore = -1;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (board[r][c]) continue;
      const atk = evalCell(r, c, 2), def = evalCell(r, c, 1);
      const s = atk + def * 0.9;
      if (s > bestScore) { bestScore = s; best = [r, c]; }
    }
    if (!best) return;
    const [r, c] = best;
    board[r][c] = 2; lastMove = [r, c];
    if (checkWin(r, c, 2)) { over = true; messageEl.textContent = 'AI wins!'; draw(); return; }
    turn = 1; turnEl.textContent = 'You'; messageEl.textContent = 'Your move.'; draw();
  }

  function onClick(e) {
    if (over || turn !== 1) return;
    const rect = canvas.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left) * (W / rect.width - 0) / T);
    const r = Math.floor((e.clientY - rect.top) * (H / rect.height) / T);
    if (!inB(r, c) || board[r][c]) return;
    board[r][c] = 1; lastMove = [r, c];
    if (checkWin(r, c, 1)) { over = true; messageEl.textContent = 'You win! 🎉'; draw(); return; }
    turn = 2; turnEl.textContent = 'AI'; messageEl.textContent = 'AI thinking…';
    setTimeout(aiMove, 300);
    draw();
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#e8c98a'); g.addColorStop(1, '#d9a85f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(60,40,20,0.6)'; ctx.lineWidth = 1;
    for (let i = 0; i < N; i++) {
      ctx.beginPath(); ctx.moveTo(OFF + i * T, OFF); ctx.lineTo(OFF + i * T, H - OFF); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(OFF, OFF + i * T); ctx.lineTo(W - OFF, OFF + i * T); ctx.stroke();
    }
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (!board[r][c]) continue;
      const x = OFF + c * T, y = OFF + r * T;
      const col = board[r][c] === 1 ? '#1a1a2e' : '#fafaff';
      ctx.save(); ctx.shadowBlur = 6; ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, T * 0.42, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (lastMove) {
      const x = OFF + lastMove[1] * T, y = OFF + lastMove[0] * T;
      ctx.strokeStyle = '#ff5e7e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, T * 0.46, 0, Math.PI * 2); ctx.stroke();
    }
  }

  canvas.addEventListener('click', onClick);
  restartEl.addEventListener('click', newGame);
  newGame();
})();
