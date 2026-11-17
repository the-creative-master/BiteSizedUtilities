(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const timeEl = document.getElementById('time');
  const bestEl = document.getElementById('best');
  const messageEl = document.getElementById('message');
  const startBtn = document.getElementById('start');

  const GAME_DURATION = 30; // seconds
  const TARGET_RADIUS = 30;
  const TICK_MS = 100;
  const BEST_KEY = 'ctt-best-score';

  let running = false;
  let score = 0;
  let timeLeft = GAME_DURATION;
  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  let target = null;
  let particles = [];
  let lastTime = performance.now();
  let timerId = null;

  function randomTarget() {
    const margin = TARGET_RADIUS + 14;
    const x = margin + Math.random() * (canvas.width - margin * 2);
    const y = margin + Math.random() * (canvas.height - margin * 2);
    return { x, y, r: TARGET_RADIUS, born: performance.now() };
  }

  function spawnParticles(x, y) {
    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 * i) / 16 + Math.random() * 0.5;
      const speed = 2 + Math.random() * 3.5;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        r: 2 + Math.random() * 3,
      });
    }
  }

  function drawBackground() {
    const g = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, 40,
      canvas.width / 2, canvas.height / 2, canvas.width
    );
    g.addColorStop(0, '#1b2150');
    g.addColorStop(1, '#0b0e22');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawTarget(now) {
    if (!target) return;
    const pulse = Math.sin((now - target.born) / 220) * 0.1 + 1;
    const r = target.r * pulse;

    const glow = ctx.createRadialGradient(target.x, target.y, r * 0.2, target.x, target.y, r * 2.2);
    glow.addColorStop(0, 'rgba(255, 90, 95, 0.5)');
    glow.addColorStop(1, 'rgba(255, 90, 95, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(target.x, target.y, r * 2.2, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createRadialGradient(
      target.x - r * 0.35, target.y - r * 0.35, r * 0.1,
      target.x, target.y, r
    );
    body.addColorStop(0, '#ffa2a5');
    body.addColorStop(1, '#ff3b5c');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(target.x, target.y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.stroke();
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08;
      p.life -= dt * 0.0016;
    }
    particles = particles.filter((p) => p.life > 0);
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function render(now) {
    const dt = now - lastTime;
    lastTime = now;
    drawBackground();
    drawTarget(now);
    updateParticles(dt);
    drawParticles();
    requestAnimationFrame(render);
  }

  function updateHud() {
    scoreEl.textContent = String(score);
    timeEl.textContent = String(Math.ceil(timeLeft));
    bestEl.textContent = String(best);
  }

  function endGame() {
    running = false;
    clearInterval(timerId);
    timerId = null;
    target = null;

    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
    }

    updateHud();
    messageEl.textContent = `Time's up! Score: ${score} — Best: ${best}.`;
    startBtn.disabled = false;
  }

  function startGame() {
    if (running) return;

    score = 0;
    timeLeft = GAME_DURATION;
    running = true;
    target = randomTarget();
    particles = [];
    messageEl.textContent = '';
    startBtn.disabled = true;

    updateHud();

    timerId = setInterval(() => {
      timeLeft -= TICK_MS / 1000;
      if (timeLeft <= 0) {
        timeLeft = 0;
        endGame();
        return;
      }
      updateHud();
    }, TICK_MS);
  }

  canvas.addEventListener('click', (event) => {
    if (!running || !target) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (event.clientX - rect.left) * scaleX;
    const clickY = (event.clientY - rect.top) * scaleY;

    const dx = clickX - target.x;
    const dy = clickY - target.y;
    const hit = dx * dx + dy * dy <= target.r * target.r;

    if (hit) {
      score += 1;
      spawnParticles(target.x, target.y);
      target = randomTarget();
      updateHud();
    }
  });

  startBtn.addEventListener('click', startGame);

  updateHud();
  requestAnimationFrame(render);
})();
