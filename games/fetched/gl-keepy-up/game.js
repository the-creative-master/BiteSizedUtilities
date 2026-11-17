(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const airEl = document.getElementById('air');
  const messageEl = document.getElementById('message');
  const restartEl = document.getElementById('restart');

  const W = canvas.width, H = canvas.height;
  const BEST_KEY = 'keepyup-best';

  let ball, score, best, over, frame;

  function bestKey() { try { return parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) { return 0; } }

  function newGame() {
    ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, r: 22 };
    score = 0; over = false; frame = 0;
    best = bestKey();
    scoreEl.textContent = '0'; bestEl.textContent = String(best); airEl.textContent = '0';
    messageEl.textContent = 'Click or press Space to bump the ball.';
    draw();
  }

  function bump(e) {
    if (over) return;
    let px = ball.x;
    if (e && e.clientX !== undefined) {
      const rect = canvas.getBoundingClientRect();
      px = (e.clientX - rect.left) * (W / rect.width);
    }
    const dx = px - ball.x;
    ball.vy = -9.5;
    ball.vx = Math.max(-4, Math.min(4, dx * 0.05));
  }

  function update() {
    if (over) return;
    frame++;
    ball.vy += 0.32;
    ball.x += ball.vx; ball.y += ball.vy;
    ball.vx *= 0.99;
    if (ball.x < ball.r) { ball.x = ball.r; ball.vx *= -0.6; }
    if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx *= -0.6; }
    if (ball.y - ball.r <= 0 && ball.vy < 0) { ball.vy *= -0.6; }
    if (ball.y + ball.r >= H) {
      over = true;
      if (score > best) { best = score; bestEl.textContent = String(best); try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {} }
      messageEl.textContent = 'The ball dropped! Press Restart.';
    }
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#141a3a'); g.addColorStop(1, '#0a0c1d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(76,201,240,0.4)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, H - 2); ctx.lineTo(W, H - 2); ctx.stroke();
    ctx.save(); ctx.shadowBlur = 16; ctx.shadowColor = '#80ed99';
    ctx.fillStyle = '#80ed99';
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(10,20,20,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r * 0.55, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    if (!over) { score++; scoreEl.textContent = String(score); airEl.textContent = String(Math.round(ball.y)); }
  }

  window.addEventListener('keydown', e => { if (e.key === ' ') { bump(); e.preventDefault(); } });
  canvas.addEventListener('click', bump);
  restartEl.addEventListener('click', newGame);

  function loop() { update(); draw(); requestAnimationFrame(loop); }
  newGame(); requestAnimationFrame(loop);
})();
