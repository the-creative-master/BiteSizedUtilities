(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const levelEl = document.getElementById('level');
  const bestEl = document.getElementById('best');
  const messageEl = document.getElementById('message');
  const startBtn = document.getElementById('start');

  const W = canvas.width;
  const H = canvas.height;
  const BEST_KEY = 'bb-best-score';
  const PADDLE_BASE_W = 110;

  const STATE = { READY: 'ready', PLAYING: 'playing', GAMEOVER: 'gameover' };
  let state = STATE.READY;

  let score = 0;
  let lives = 3;
  let level = 1;
  let best = Number(localStorage.getItem(BEST_KEY) || 0);

  const paddle = { w: PADDLE_BASE_W, h: 16, x: W / 2 - PADDLE_BASE_W / 2, y: H - 36, speed: 9, expand: 0 };
  let balls = [];
  let bricks = [];
  let powerups = [];
  const keys = { left: false, right: false };

  const BRICK_ROWS_START = 4;
  const BRICK_COLS = 9;
  const BRICK_W = 60;
  const BRICK_H = 22;
  const BRICK_GAP = 6;
  const BRICK_TOP = 60;
  const COLORS = ['#ff5a5f', '#ffb703', '#4cc9f0', '#80ed99', '#c77dff'];

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function resetBall() {
    balls = [{
      x: paddle.x + paddle.w / 2,
      y: paddle.y - 12,
      vx: 3.4 * (Math.random() < 0.5 ? -1 : 1),
      vy: -4.2,
      r: 8,
    }];
  }

  function buildBricks() {
    bricks = [];
    const rows = BRICK_ROWS_START + (level - 1);
    const totalW = BRICK_COLS * BRICK_W + (BRICK_COLS - 1) * BRICK_GAP;
    const offsetX = (W - totalW) / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        bricks.push({
          x: offsetX + c * (BRICK_W + BRICKEN_GAP()),
          y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
          w: BRICK_W, h: BRICK_H,
          color: COLORS[r % COLORS.length],
          points: (rows - r) * 10,
          alive: true,
        });
      }
    }
  }

  function BRICKEN_GAP() { return BRICK_GAP; }

  function startLevel() {
    buildBricks();
    resetBall();
    powerups = [];
    paddle.x = W / 2 - paddle.w / 2;
    paddle.expand = 0;
    state = STATE.PLAYING;
    messageEl.textContent = '';
  }

  function startGame() {
    score = 0;
    lives = 3;
    level = 1;
    paddle.w = PADDLE_BASE_W;
    startLevel();
    startBtn.disabled = true;
    updateHud();
  }

  function updateHud() {
    scoreEl.textContent = String(score);
    livesEl.textContent = String(lives);
    levelEl.textContent = String(level);
    bestEl.textContent = String(best);
  }

  function spawnPowerup(x, y) {
    const types = ['expand', 'multiball'];
    powerups.push({ x, y, vy: 2.6, r: 11, type: types[Math.floor(Math.random() * types.length)] });
  }

  function applyPowerup(type) {
    if (type === 'expand') {
      paddle.w = 175;
      paddle.expand = 600;
    } else if (type === 'multiball') {
      const extra = balls.map((b) => ({ x: b.x, y: b.y, vx: -b.vx, vy: b.vy, r: b.r }));
      balls = balls.concat(extra);
    }
  }

  function loseLife() {
    lives -= 1;
    if (lives <= 0) {
      state = STATE.GAMEOVER;
      if (score > best) { best = score; localStorage.setItem(BEST_KEY, String(best)); }
      updateHud();
      messageEl.textContent = `Game Over! Score: ${score} — Best: ${best}.`;
      startBtn.disabled = false;
      startBtn.textContent = 'Play Again';
    } else if (lives <= 0) {
      // handled above
    } else {
      resetBall();
      updateHud();
    }
  }

  function update() {
    if (state !== STATE.PLAYING) return;

    if (keys.left) paddle.x -= paddle.speed;
    if (keys.right) paddle.x += paddle.speed;
    paddle.x = Math.max(0, Math.min(W - paddle.w, paddle.x));
    if (paddle.expand > 0) {
      paddle.expand -= 1;
      if (paddle.expand === 0) paddle.w = PADDLE_BASE_W;
    }

    for (const ball of balls) {
      ball.x += ball.vx;
      ball.y += ball.vy;

      if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
      if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); }
      if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }

      if (ball.vy > 0 &&
          ball.y + ball.r >= paddle.y &&
          ball.y + ball.r <= paddle.y + paddle.h + Math.abs(ball.vy) &&
          ball.x >= paddle.x && ball.x <= paddle.x + paddle.w) {
        ball.y = paddle.y - ball.r;
        const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
        ball.vx = hit * 4.8;
        ball.vy = -Math.max(Math.abs(ball.vy), 3.4);
      }

      for (const b of bricks) {
        if (!b.alive) continue;
        if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w &&
            ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
          b.alive = false;
          score += b.points;
          const overlapX = Math.min(ball.x + ball.r - b.x, b.x + b.w - (ball.x - ball.r));
          const overlapY = Math.min(ball.y + ball.r - b.y, b.y + b.h - (ball.y - ball.r));
          if (overlapX < overlapY) ball.vx *= -1; else ball.vy *= -1;
          if (Math.random() < 0.18) spawnPowerup(b.x + b.w / 2, b.y + b.h / 2);
          break;
        }
      }
    }

    balls = balls.filter((b) => b.y - b.r <= H);
    if (balls.length === 0) { loseLife(); return; }

    for (const p of powerups) {
      p.y += p.vy;
      if (p.y + p.r >= paddle.y && p.y - p.r <= paddle.y + paddle.h &&
          p.x >= paddle.x && p.x <= paddle.x + paddle.w) {
        applyPowerup(p.type);
        p.collected = true;
      }
    }
    powerups = powerups.filter((p) => !p.collected && p.y - p.r <= H);

    if (bricks.every((b) => !b.alive)) {
      level += 1;
      startLevel();
      updateHud();
    }
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#10142e');
    g.addColorStop(1, '#0a0c1d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    for (const b of bricks) {
      if (!b.alive) continue;
      ctx.fillStyle = b.color;
      roundRect(ctx, b.x, b.y, b.w, b.h, 6);
      ctx.fill();
    }

    const pg = ctx.createLinearGradient(paddle.x, 0, paddle.x + paddle.w, 0);
    pg.addColorStop(0, '#4cc9f0');
    pg.addColorStop(1, '#80ed99');
    ctx.fillStyle = pg;
    roundRect(ctx, paddle.x, paddle.y, paddle.w, paddle.h, 8);
    ctx.fill();

    for (const ball of balls) {
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#4cc9f0';
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    for (const p of powerups) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.type === 'expand' ? '#ffb703' : '#c77dff';
      ctx.fill();
      ctx.fillStyle = '#10142e';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.type === 'expand' ? 'W' : 'M', p.x, p.y);
    }
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  // input
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 'ArrowRight') keys.right = true;
    if ((e.key === ' ' || e.key === 'Enter') && state === STATE.READY) startGame();
  });
  document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'ArrowRight') keys.right = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    if (state !== STATE.PLAYING) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mx = (e.clientX - rect.left) * scaleX;
    paddle.x = Math.max(0, Math.min(W - paddle.w, mx - paddle.w / 2));
  });
  startBtn.addEventListener('click', startGame);

  buildBricks();
  resetBall();
  updateHud();
  requestAnimationFrame(loop);
})();
