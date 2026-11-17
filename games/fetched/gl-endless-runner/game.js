(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const speedEl = document.getElementById('speed');
  const messageEl = document.getElementById('message');
  const restartEl = document.getElementById('restart');

  const W = canvas.width, H = canvas.height;
  const GROUND = H - 50;
  const BEST_KEY = 'runner-best';

  let player, obstacles, speed, score, best, started, over, spawnTimer, t;

  function bestKey() { try { return parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) { return 0; } }

  function newGame() {
    player = { x: 90, y: GROUND, vy: 0, w: 30, h: 44, onGround: true, duck: false };
    obstacles = []; speed = 4; score = 0; started = false; over = false; spawnTimer = 60; t = 0;
    best = bestKey();
    scoreEl.textContent = '0'; bestEl.textContent = String(best); speedEl.textContent = '1.0x';
    messageEl.textContent = 'Space / ↑ to jump, ↓ to duck. Click to start.';
    draw();
  }

  function start() { if (!started && !over) { started = true; messageEl.textContent = 'Go!'; } }

  function jump() {
    if (player.onGround && started && !over) { player.vy = -11; player.onGround = false; }
  }

  function spawn() {
    const roll = Math.random();
    if (roll < 0.45) obstacles.push({ x: W + 20, w: 26, h: 40 + Math.random() * 26, type: 'spike', y: GROUND });
    else if (roll < 0.8) obstacles.push({ x: W + 20, w: 46, h: 30, type: 'block', y: GROUND });
    else obstacles.push({ x: W + 20, w: 40, h: 30, type: 'bird', y: GROUND - 90 });
  }

  function update() {
    if (!started || over) return;
    t++;
    player.vy += 0.7; player.y += player.vy;
    if (player.y >= GROUND) { player.y = GROUND; player.vy = 0; player.onGround = true; }
    const h = player.duck && player.onGround ? player.h / 2 : player.h;
    const py = player.y - h;

    spawnTimer--;
    if (spawnTimer <= 0) { spawn(); spawnTimer = Math.max(38, 90 - speed * 4) + Math.random() * 30; }

    speed += 0.002; speedEl.textContent = (speed / 4).toFixed(1) + 'x';
    score += 1; scoreEl.textContent = String(score);

    for (const o of obstacles) {
      o.x -= speed;
      const oy = o.y - o.h;
      const hit = player.x < o.x + o.w && player.x + player.w > o.x &&
                  py < oy + o.h && player.y > oy;
      if (hit) { over = true; if (score > best) { best = score; bestEl.textContent = String(best); try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {} } messageEl.textContent = 'Crashed! Press Restart.'; }
    }
    obstacles = obstacles.filter(o => o.x + o.w > -10);
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1b1240'); g.addColorStop(1, '#0a0c1d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // parallax stars
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (let i = 0; i < 30; i++) { const x = (i * 53 - t * speed * 0.3) % W; ctx.fillRect((x + W) % W, (i * 37) % (GROUND - 20), 2, 2); }

    // ground
    ctx.fillStyle = '#241b4d'; ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = '#4cc9f0'; ctx.fillRect(0, GROUND, W, 3);

    // obstacles
    for (const o of obstacles) {
      const oy = o.y - o.h;
      ctx.save(); ctx.shadowBlur = 10; ctx.shadowColor = o.type === 'bird' ? '#ffd166' : '#ff5e7e';
      ctx.fillStyle = o.type === 'bird' ? '#ffd166' : o.type === 'block' ? '#c98bff' : '#ff5e7e';
      roundRect(ctx, o.x, oy, o.w, o.h, 6); ctx.fill(); ctx.restore();
    }

    // player
    const h = player.duck && player.onGround ? player.h / 2 : player.h;
    ctx.save(); ctx.shadowBlur = 14; ctx.shadowColor = '#80ed99';
    ctx.fillStyle = '#80ed99';
    roundRect(ctx, player.x, player.y - h, player.w, h, 8); ctx.fill(); ctx.restore();
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  const KEYS = {};
  window.addEventListener('keydown', e => {
    KEYS[e.key] = true;
    if (e.key === ' ' || e.key === 'ArrowUp') { jump(); start(); e.preventDefault(); }
    if (e.key === 'ArrowDown') player.duck = true;
  });
  window.addEventListener('keyup', e => { KEYS[e.key] = false; if (e.key === 'ArrowDown') player.duck = false; });
  canvas.addEventListener('click', start);
  restartEl.addEventListener('click', newGame);

  function loop() { update(); draw(); requestAnimationFrame(loop); }
  newGame(); requestAnimationFrame(loop);
})();
