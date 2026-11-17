(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const coinsEl = document.getElementById('coins');
  const bestEl = document.getElementById('best');
  const timeEl = document.getElementById('time');
  const messageEl = document.getElementById('message');
  const restartEl = document.getElementById('restart');

  const W = canvas.width, H = canvas.height;
  const LEVEL_W = 1900;
  const GROUND_Y = H - 40;
  const BEST_KEY = 'platformjump-best';

  const PLATFORMS = [
    { x: 0, y: GROUND_Y, w: LEVEL_W, h: 40 },
    { x: 200, y: 270, w: 120, h: 16 },
    { x: 380, y: 210, w: 120, h: 16 },
    { x: 560, y: 270, w: 120, h: 16 },
    { x: 740, y: 210, w: 120, h: 16 },
    { x: 920, y: 150, w: 120, h: 16 },
    { x: 1120, y: 230, w: 140, h: 16 },
    { x: 1320, y: 180, w: 120, h: 16 },
    { x: 1500, y: 250, w: 120, h: 16 },
  ];
  const COIN_POS = [
    [260, 235], [440, 175], [620, 235], [800, 175], [980, 115],
    [1180, 195], [1380, 145], [1560, 215], [300, GROUND_Y - 30], [1000, GROUND_Y - 30],
  ];
  const GOAL = { x: 1760, y: GROUND_Y - 70, w: 28, h: 70 };

  let player, coins, camX, started, over, won, t0, coinCount, best;

  function bestKey() { try { return parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) { return 0; } }

  function newGame() {
    player = { x: 60, y: GROUND_Y - 40, vx: 0, vy: 0, w: 28, h: 36, onGround: false };
    coins = COIN_POS.map(([x, y]) => ({ x, y, got: false }));
    camX = 0; started = false; over = false; won = false; coinCount = 0;
    best = bestKey();
    coinsEl.textContent = '0'; bestEl.textContent = String(best); timeEl.textContent = '0.0s';
    messageEl.textContent = '←/→ to move, Space / ↑ to jump.';
    draw();
  }

  function start() { if (!started && !over && !won) { started = true; t0 = performance.now(); messageEl.textContent = 'Go!'; } }

  function update() {
    if (!started || over || won) return;
    const KEYS = window.__keys || {};
    if (KEYS['ArrowLeft'] || KEYS['a']) player.vx = -4.2;
    else if (KEYS['ArrowRight'] || KEYS['d']) player.vx = 4.2;
    else player.vx = 0;
    player.vy += 0.65; player.x += player.vx; player.y += player.vy;
    if (player.x < 0) player.x = 0; if (player.x > LEVEL_W - player.w) player.x = LEVEL_W - player.w;

    player.onGround = false;
    for (const p of PLATFORMS) {
      if (player.vy >= 0 && player.x + player.w > p.x && player.x < p.x + p.w) {
        const feet = player.y + player.h, prev = feet - player.vy;
        if (prev <= p.y + 1 && feet >= p.y) { player.y = p.y - player.h; player.vy = 0; player.onGround = true; }
      }
    }
    if (player.y > H + 120) { over = true; messageEl.textContent = 'You fell! Press Restart.'; }

    for (const c of coins) if (!c.got && Math.abs(player.x + player.w / 2 - c.x) < 18 && Math.abs(player.y + player.h / 2 - c.y) < 18) {
      c.got = true; coinCount++; coinsEl.textContent = String(coinCount);
    }
    if (player.x + player.w > GOAL.x && player.y + player.h > GOAL.y && player.x < GOAL.x + GOAL.w) {
      won = true; best = Math.max(best, coinCount);
      bestEl.textContent = String(best); try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
      messageEl.textContent = `You reached the flag with ${coinCount} coins!`;
    }

    camX = Math.max(0, Math.min(LEVEL_W - W, player.x - W / 2));
    timeEl.textContent = ((performance.now() - t0) / 1000).toFixed(1) + 's';
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1b1240'); g.addColorStop(1, '#0a0c1d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // stars
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 40; i++) { const x = (i * 97 + camX * 0.2) % (W + 20); ctx.fillRect((x + W) % W, (i * 41) % H, 2, 2); }

    ctx.save(); ctx.translate(-camX, 0);
    // platforms
    for (const p of PLATFORMS) {
      ctx.save(); ctx.shadowBlur = 12; ctx.shadowColor = '#4cc9f0';
      ctx.fillStyle = '#2b3a78'; roundRect(ctx, p.x, p.y, p.w, p.h, 6); ctx.fill(); ctx.restore();
    }
    // coins
    for (const c of coins) if (!c.got) {
      ctx.save(); ctx.shadowBlur = 12; ctx.shadowColor = '#ffd166';
      ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(c.x, c.y, 9, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    // goal flag
    ctx.fillStyle = '#80ed99'; ctx.fillRect(GOAL.x, GOAL.y, 4, GOAL.h);
    ctx.fillStyle = '#ff5e7e'; ctx.beginPath(); ctx.moveTo(GOAL.x + 4, GOAL.y); ctx.lineTo(GOAL.x + 28, GOAL.y + 12); ctx.lineTo(GOAL.x + 4, GOAL.y + 24); ctx.fill();
    // player
    ctx.save(); ctx.shadowBlur = 14; ctx.shadowColor = '#80ed99';
    ctx.fillStyle = '#80ed99'; roundRect(ctx, player.x, player.y, player.w, player.h, 8); ctx.fill(); ctx.restore();
    ctx.restore();
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  window.__keys = {};
  window.addEventListener('keydown', e => {
    window.__keys[e.key] = true;
    if (e.key === ' ' || e.key === 'ArrowUp') { if (player.onGround && started && !over && !won) player.vy = -12; start(); e.preventDefault(); }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' '].includes(e.key)) e.preventDefault();
  });
  window.addEventListener('keyup', e => window.__keys[e.key] = false);
  canvas.addEventListener('click', start);
  restartEl.addEventListener('click', newGame);

  function loop() { update(); draw(); requestAnimationFrame(loop); }
  newGame(); requestAnimationFrame(loop);
})();
