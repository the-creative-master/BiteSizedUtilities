(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const youEl = document.getElementById('you');
  const aiEl = document.getElementById('ai');
  const turnEl = document.getElementById('turn');
  const messageEl = document.getElementById('message');
  const restartEl = document.getElementById('restart');

  const W = canvas.width, H = canvas.height, N = 8, T = W / N;
  // 0 empty, 1 you (moves up, r--), 2 ai (moves down, r++), 3 you king, 4 ai king
  let board, turn, sel, mustCapture, winner;

  function inB(r, c) { return r >= 0 && r < N && c >= 0 && c < N; }
  function sideOf(p) { return p === 1 || p === 3 ? 1 : p === 2 || p === 4 ? 2 : 0; }
  function isKing(p) { return p === 3 || p === 4; }

  function newGame() {
    board = [];
    for (let r = 0; r < N; r++) {
      board.push([]);
      for (let c = 0; c < N; c++) {
        if ((r + c) % 2 === 1) {
          if (r < 3) board[r].push(2);
          else if (r > 4) board[r].push(1);
          else board[r].push(0);
        } else board[r].push(0);
      }
    }
    turn = 1; sel = null; mustCapture = null; winner = 0;
    turnEl.textContent = 'You'; messageEl.textContent = 'Your move.';
    draw();
  }

  function dirs(p) {
    if (p === 1) return [[-1, -1], [-1, 1]];
    if (p === 2) return [[1, -1], [1, 1]];
    return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  }

  function legalMoves(r, c, side) {
    const p = board[r][c]; if (sideOf(p) !== side) return [];
    const out = [];
    for (const [dr, dc] of dirs(p)) {
      const nr = r + dr, nc = c + dc;
      if (inB(nr, nc) && board[nr][nc] === 0) out.push({ r, c, nr, nc, cap: null });
    }
    for (const [dr, dc] of dirs(p)) {
      const mr = r + dr, mc = c + dc, nr = r + 2 * dr, nc = c + 2 * dc;
      if (inB(nr, nc) && board[nr][nc] === 0 && inB(mr, mc) && board[mr][mc] !== 0 && sideOf(board[mr][mc]) !== side)
        out.push({ r, c, nr, nc, cap: [mr, mc] });
    }
    return out;
  }

  function allMoves(side) {
    const out = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++)
      if (board[r][c] && sideOf(board[r][c]) === side) out.push(...legalMoves(r, c, side));
    return out;
  }

  function cellFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    const y = (e.clientY - rect.top) * (H / rect.height);
    return { r: Math.floor(y / T), c: Math.floor(x / T) };
  }

  function count(side) { let n = 0; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (board[r][c] && sideOf(board[r][c]) === side) n++; return n; }
  function updateCounts() { youEl.textContent = String(count(1)); aiEl.textContent = String(count(2)); }

  function anyCaptures(side) { return allMoves(side).some(m => m.cap); }

  function onClick(e) {
    if (winner || turn !== 1) return;
    const { r, c } = cellFromEvent(e);
    if (!inB(r, c)) return;
    if (sel) {
      const moves = legalMoves(sel.r, sel.c, 1).filter(m => !mustCapture || m.cap);
      const mv = moves.find(m => m.nr === r && m.nc === c);
      if (mv) { doMove(mv); afterMove(1, mv); return; }
    }
    if (board[r][c] && sideOf(board[r][c]) === 1) {
      sel = { r, c };
      if (anyCaptures(1)) mustCapture = true;
      draw();
    }
  }

  function doMove(mv) {
    const p = board[mv.r][mv.c];
    board[mv.r][mv.c] = 0;
    if (mv.cap) board[mv.cap[0]][mv.cap[1]] = 0;
    let np = p;
    if (!isKing(p) && ((p === 1 && mv.nr === 0) || (p === 2 && mv.nr === N - 1))) np = p === 1 ? 3 : 4;
    board[mv.nr][mv.nc] = np;
  }

  function afterMove(side, mv) {
    sel = null;
    if (mv.cap) {
      const more = legalMoves(0, 0, side).length; // placeholder, recompute below
    }
    const cont = mv.cap ? legalMoves(mv.nr, mv.nc, side).filter(m => m.cap) : [];
    if (mv.cap && cont.length) {
      if (side === 1) { sel = { r: mv.nr, c: mv.nc }; mustCapture = true; turnEl.textContent = 'You'; draw(); return; }
      setTimeout(aiChain, 300, mv.nr, mv.nc); return;
    }
    mustCapture = null; updateCounts();
    if (winnerMsg()) return;
    turn = side === 1 ? 2 : 1; turnEl.textContent = turn === 1 ? 'You' : 'AI';
    if (turn === 2) setTimeout(aiTurn, 350);
    draw();
  }

  function aiChain(r, c) {
    const more = legalMoves(r, c, 2).filter(m => m.cap);
    if (!more.length) { mustCapture = null; turn = 1; turnEl.textContent = 'You'; updateCounts(); winnerMsg(); if (anyCaptures(1)) mustCapture = true; draw(); return; }
    const mv = more[Math.floor(Math.random() * more.length)];
    doMove(mv);
    setTimeout(aiChain, 300, mv.nr, mv.nc);
  }

  function aiTurn() {
    if (winner) return;
    let moves = allMoves(2);
    if (moves.length === 0) { winnerMsg(); return; }
    const caps = moves.filter(m => m.cap);
    moves = caps.length ? caps : moves;
    const mv = moves[Math.floor(Math.random() * moves.length)];
    doMove(mv);
    const more = mv.cap ? legalMoves(mv.nr, mv.nc, 2).filter(m => m.cap) : [];
    if (mv.cap && more.length) { setTimeout(aiChain, 300, mv.nr, mv.nc); return; }
    mustCapture = null; turn = 1; turnEl.textContent = 'You'; updateCounts(); winnerMsg();
    if (anyCaptures(1)) mustCapture = true; draw();
  }

  function winnerMsg() {
    if (allMoves(1).length === 0 || count(1) === 0) { winner = 2; messageEl.textContent = 'AI wins!'; return true; }
    if (allMoves(2).length === 0 || count(2) === 0) { winner = 1; messageEl.textContent = 'You win! 🎉'; return true; }
    return false;
  }

  function draw() {
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        const x = c * T, y = r * T;
        ctx.fillStyle = (r + c) % 2 ? '#2c2f52' : '#11132e';
        ctx.fillRect(x, y, T, T);
        const p = board[r][c];
        if (p) {
          const col = (p === 1 || p === 3) ? '#ff5e7e' : '#4cc9f0';
          ctx.save(); ctx.shadowBlur = 10; ctx.shadowColor = col; ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(x + T / 2, y + T / 2, T * 0.36, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(x + T / 2, y + T / 2, T * 0.2, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
          if (isKing(p)) { ctx.fillStyle = '#ffe66d'; ctx.font = 'bold 18px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('★', x + T / 2, y + T / 2); }
        }
        if (sel && sel.r === r && sel.c === c) { ctx.strokeStyle = '#ffe66d'; ctx.lineWidth = 3; ctx.strokeRect(x + 2, y + 2, T - 4, T - 4); }
      }
    if (sel) {
      const moves = legalMoves(sel.r, sel.c, 1).filter(m => !mustCapture || m.cap);
      moves.forEach(m => { ctx.fillStyle = 'rgba(128,237,153,0.4)'; ctx.beginPath(); ctx.arc(m.nc * T + T / 2, m.nr * T + T / 2, T * 0.16, 0, Math.PI * 2); ctx.fill(); });
    }
  }

  canvas.addEventListener('click', onClick);
  restartEl.addEventListener('click', newGame);
  newGame();
})();
