(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const youEl = document.getElementById('you');
  const aiEl = document.getElementById('ai');
  const turnEl = document.getElementById('turn');
  const messageEl = document.getElementById('message');

  const W = canvas.width, H = canvas.height, N = 5;
  const GAP = W / N, PAD = GAP / 2;
  // hLines[r][c]: between (r,c)-(r,c+1), r,c in 0..N-1 / 0..N-2
  // vLines[r][c]: between (r,c)-(r+1,c), r in 0..N-2, c in 0..N-1
  let hLines, vLines, boxes, current;

  function newGame() {
    hLines = Array.from({ length: N }, () => Array(N - 1).fill(false));
    vLines = Array.from({ length: N - 1 }, () => Array(N).fill(false));
    boxes = Array.from({ length: N - 1 }, () => Array(N - 1).fill(0));
    current = 1;
    youEl.textContent = '0'; aiEl.textContent = '0';
    turnEl.textContent = 'You';
    messageEl.textContent = 'Click a line between two dots.';
    draw();
  }

  function dotPos(r, c) { return { x: PAD + c * GAP, y: PAD + r * GAP }; }

  function lineMid(r, c, horiz) {
    const a = dotPos(r, c), b = dotPos(r + (horiz ? 0 : 1), c + (horiz ? 1 : 0));
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function boxOwner(r, c) {
    if (hLines[r][c] && hLines[r + 1] && hLines[r + 1][c] && vLines[r][c] && vLines[r][c + 1]) return true;
    return false;
  }

  function claimLine(r, c, horiz) {
    let scored = false;
    if (horiz) hLines[r][c] = true;
    else vLines[r][c] = true;
    if (r > 0 && boxOwner(r - 1, c)) { if (boxes[r - 1][c] === 0) { boxes[r - 1][c] = current; scored = true; } }
    if (r < N - 2 && boxOwner(r, c)) { if (boxes[r][c] === 0) { boxes[r][c] = current; scored = true; } }
    if (!horiz) {
      if (c > 0 && boxOwner(r, c - 1)) { if (boxes[r][c - 1] === 0) { boxes[r][c - 1] = current; scored = true; } }
      if (c < N - 2 && boxOwner(r, c)) { if (boxes[r][c] === 0) { boxes[r][c] = current; scored = true; } }
    }
    return scored;
  }

  function totals() {
    let y = 0, a = 0;
    boxes.flat().forEach(v => { if (v === 1) y++; else if (v === 2) a++; });
    return { y, a };
  }

  function finishIfDone() {
    const t = totals();
    youEl.textContent = String(t.y); aiEl.textContent = String(t.a);
    if (t.y + t.a === (N - 1) * (N - 1)) {
      messageEl.textContent = t.y > t.a ? 'You win! 🎉' : t.a > t.y ? 'AI wins!' : 'Draw!';
      turnEl.textContent = 'Over';
      return true;
    }
    return false;
  }

  function aiTurn() {
    if (current !== 2) return;
    const moves = [];
    let chance = null;
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N - 1; c++) if (!hLines[r][c]) moves.push([r, c, true]);
    for (let r = 0; r < N - 1; r++)
      for (let c = 0; c < N; c++) if (!vLines[r][c]) moves.push([r, c, false]);
    // prefer completing a box
    for (const [r, c, hz] of moves) {
      const saved = hz ? hLines[r][c] : vLines[r][c];
      if (hz) hLines[r][c] = true; else vLines[r][c] = true;
      let completes = false;
      if (boxOwner(r - 1, c) || boxOwner(r, c) || (!hz && (boxOwner(r, c - 1) || boxOwner(r, c)))) completes = true;
      if (hz) hLines[r][c] = saved; else vLines[r][c] = saved;
      if (completes) { chance = [r, c, hz]; break; }
    }
    if (!chance) chance = moves[Math.floor(Math.random() * moves.length)];
    const scored = claimLine(chance[0], chance[1], chance[2]);
    if (finishIfDone()) return;
    if (!scored) { current = 1; turnEl.textContent = 'You'; messageEl.textContent = 'Your move.'; }
    draw();
    if (current === 2) setTimeout(aiTurn, 350);
  }

  function onClick(e) {
    if (current !== 1) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    const y = (e.clientY - rect.top) * (H / rect.height);
    let best = null, bestD = 18 * 18;
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N - 1; c++) {
        const m = lineMid(r, c, true);
        const d = (m.x - x) ** 2 + (m.y - y) ** 2;
        if (d < bestD) { bestD = d; best = [r, c, true]; }
      }
    for (let r = 0; r < N - 1; r++)
      for (let c = 0; c < N; c++) {
        const m = lineMid(r, c, false);
        const d = (m.x - x) ** 2 + (m.y - y) ** 2;
        if (d < bestD) { bestD = d; best = [r, c, false]; }
      }
    if (!best) return;
    const [r, c, hz] = best;
    if (hz ? hLines[r][c] : vLines[r][c]) return;
    const scored = claimLine(r, c, hz);
    if (finishIfDone()) { draw(); return; }
    if (!scored) { current = 2; turnEl.textContent = 'AI'; messageEl.textContent = 'AI thinking…'; draw(); setTimeout(aiTurn, 350); }
    else draw();
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, W, W);
    g.addColorStop(0, '#141a3a'); g.addColorStop(1, '#0a0c1d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        const p = dotPos(r, c);
        ctx.fillStyle = '#9fd6ff';
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
      }
    ctx.strokeStyle = '#4cc9f0';
    ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N - 1; c++) if (hLines[r][c]) {
        const a = dotPos(r, c), b = dotPos(r, c + 1);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    for (let r = 0; r < N - 1; r++)
      for (let c = 0; c < N; c++) if (vLines[r][c]) {
        const a = dotPos(r, c), b = dotPos(r + 1, c);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    for (let r = 0; r < N - 1; r++)
      for (let c = 0; c < N - 1; c++) {
        const owner = boxes[r][c];
        if (!owner) continue;
        const x = PAD + c * GAP, y = PAD + r * GAP;
        ctx.fillStyle = owner === 1 ? 'rgba(255,90,122,0.35)' : 'rgba(255,209,102,0.35)';
        ctx.fillRect(x + 4, y + 4, GAP - 8, GAP - 8);
      }
    requestAnimationFrame(() => {});
  }

  canvas.addEventListener('click', onClick);
  document.getElementById('new').addEventListener('click', newGame);
  newGame();
})();
