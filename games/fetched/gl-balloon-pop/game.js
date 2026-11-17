(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const timeEl = document.getElementById('time');
  const bestEl = document.getElementById('best');
  const messageEl = document.getElementById('message');
  const startBtn = document.getElementById('start');

  const W = canvas.width, H = canvas.height;
  const COLORS = ['#ff5a7a', '#ffd166', '#80ed99', '#4cc9f0', '#c77dff'];
  const BEST_KEY = 'balloon-best';

  let balloons, score, time, running, lastSpawn, combo, lastTime;

  function reset() {
    balloons = [];
    score = 0; time = 30; combo = 0;
    running = false; lastSpawn = 0;
    scoreEl.textContent = '0';
    timeEl.textContent = '30';
    bestEl.textContent = String(localStorage.getItem(BEST_KEY) || 0);
    messageEl.textContent = 'Click a balloon to pop it! Start pops the timer.';
  }

  function spawn() {
    const r = 24 + Math.random() * 16;
    balloons.push({
      x: r + Math.random() * (W - 2 * r),
      y: H + r,
      r,
      vy: 1.2 + Math.random() * 1.6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      wob: Math.random() * Math.PI * 2,
    });
  }

  function pop(x, y) {
    if (!running) return;
    for (let i = balloons.length - 1; i >= 0; i--) {
      const b = balloons[i];
      const dx = x - b.x, dy = y - (b.y - b.r * 0.7);
      if (dx * dx + dy * dy <= b.r * b.r) {
        balloons.splice(i, 1);
        combo++;
        score += 10 + Math.min(combo, 10) * 2;
        scoreEl.textContent = String(score);
        return;
      }
    }
    combo = 0;
  }

  function loop(t) {
    if (!running) { requestAnimationFrame(loop); return; }
    const dt = Math.min(0.05, (t - lastTime) / 1000 || 0);
    lastTime = t;
    time -= dt;
    timeEl.textContent = String(Math.max(0, Math.ceil(time)));

    if (t - lastSpawn > 520) { spawn(); lastSpawn = t; }
    for (let i = balloons.length - 1; i >= 0; i--) {
      const b = balloons[i];
      b.y -= b.vy * (1 + dt * 3);
      b.wob += dt * 4;
      if (b.y < -b.r) { balloons.splice(i, 1); }
    }

    if (time <= 0) {
      running = false;
      if (score > Number(localStorage.getItem(BEST_KEY) || 0)) {
        localStorage.setItem(BEST_KEY, String(score)); bestEl.textContent = String(score);
      }
      messageEl.textContent = `Time! Score: ${score}`;
    }
    draw();
    requestAnimationFrame(loop);
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1a2350'); g.addColorStop(1, '#0a0c1d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    balloons.forEach(b => {
      const wob = Math.sin(b.wob) * 4;
      ctx.save();
      ctx.shadowBlur = 16; ctx.shadowColor = b.color;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.ellipse(b.x + wob, b.y - b.r * 0.7, b.r * 0.85, b.r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = b.color;
      ctx.beginPath();
      ctx.moveTo(b.x + wob, b.y + b.r * 0.3);
      ctx.lineTo(b.x + wob + 4, b.y + b.r * 0.9);
      ctx.stroke();
    });
  }

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    pop((e.clientX - rect.left) * (W / rect.width),
        (e.clientY - rect.top) * (H / rect.height));
  });

  startBtn.addEventListener('click', () => {
    if (running) return;
    reset(); running = true; lastTime = performance.now();
    messageEl.textContent = 'Pop them all!';
    requestAnimationFrame(loop);
  });

  reset();
  draw();
})();
