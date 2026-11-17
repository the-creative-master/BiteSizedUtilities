(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const levelEl = document.getElementById('level');
  const messageEl = document.getElementById('message');
  const startEl = document.getElementById('start');
  const pauseEl = document.getElementById('pause');
  const restartEl = document.getElementById('restart');

  const TILE = 28, COLS = 20, ROWS = 22;
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;
  const W = canvas.width, H = canvas.height;

  const DIRS = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
  const GHOST_COLORS = ['#ff5e7e', '#5ee7ff', '#ff9d5e', '#c98bff'];

  let grid, dots, score, lives, level, running, paused, mouth, frightened, win;

  function isWall(c, r) {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true;
    if (c === 0 || r === 0 || c === COLS - 1 || r === ROWS - 1) return true;
    if (c % 2 === 0 && r % 2 === 0) return true;
    return false;
  }
  function center(c, r) { return { x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 }; }
  function tileOf(e) { return { c: Math.floor(e.x / TILE), r: Math.floor(e.y / TILE) }; }

  function buildLevel() {
    dots = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (!isWall(c, r)) {
          let type = 1;
          if ((c === 1 && r === 1) || (c === COLS - 2 && r === 1) ||
              (c === 1 && r === ROWS - 2) || (c === COLS - 2 && r === ROWS - 2)) type = 2;
          dots.push({ c, r, type, eaten: false });
        }
  }

  let pac, ghosts;

  function resetPositions() {
    const pc = center(9, 11);
    pac = { x: pc.x, y: pc.y, dir: { dx: 0, dy: 0 }, next: { dx: 0, dy: 0 }, speed: 2 };
    const homes = [[9, 9], [10, 9], [9, 10], [10, 10]];
    ghosts = GHOST_COLORS.map((col, i) => {
      const h = center(homes[i][0], homes[i][1]);
      return { x: h.x, y: h.y, dir: DIRS[i % 4], color: col, eaten: false };
    });
  }

  function newGame() {
    score = 0; lives = 3; level = 1; win = false; mouth = 0;
    frightened = 0;
    buildLevel(); resetPositions();
    running = false; paused = false;
    scoreEl.textContent = '0'; livesEl.textContent = '3'; levelEl.textContent = '1';
    messageEl.textContent = 'Press Start to play. Arrow keys / WASD to move.';
    draw();
  }

  function start() {
    if (running) return;
    if (win) { level++; levelEl.textContent = String(level); buildLevel(); resetPositions(); win = false; }
    running = true; paused = false;
    messageEl.textContent = 'Eat all the dots!';
  }

  function remaining() { return dots.filter(d => !d.eaten).length; }

  function movePac() {
    const t = tileOf(pac), ctr = center(t.c, t.r);
    const near = Math.abs(pac.x - ctr.x) < pac.speed && Math.abs(pac.y - ctr.y) < pac.speed;
    if (near) {
      pac.x = ctr.x; pac.y = ctr.y;
      if ((pac.next.dx || pac.next.dy) && !isWall(t.c + pac.next.dx, t.r + pac.next.dy)) pac.dir = pac.next;
      else if (isWall(t.c + pac.dir.dx, t.r + pac.dir.dy)) pac.dir = { dx: 0, dy: 0 };
    }
    pac.x += pac.dir.dx * pac.speed;
    pac.y += pac.dir.dy * pac.speed;
    // wrap
    if (pac.x < 0) pac.x = W; if (pac.x > W) pac.x = 0;
    if (pac.y < 0) pac.y = H; if (pac.y > H) pac.y = 0;
    // eat
    const pt = tileOf(pac);
    for (const d of dots) {
      if (!d.eaten && d.c === pt.c && d.r === pt.r) {
        d.eaten = true;
        score += d.type === 2 ? 50 : 10;
        if (d.type === 2) frightened = 420;
        scoreEl.textContent = String(score);
      }
    }
    if (remaining() === 0) { win = true; running = false; messageEl.textContent = 'Level clear! Press Start for more.'; }
  }

  function ghostStep(g) {
    const t = tileOf(g), ctr = center(t.c, t.r);
    const near = Math.abs(g.x - ctr.x) < 2 && Math.abs(g.y - ctr.y) < 2;
    const sp = frightened > 0 && !g.eaten ? 1.4 : 2;
    if (near) {
      g.x = ctr.x; g.y = ctr.y;
      const opts = [];
      for (const d of DIRS) {
        if (d.dx === -g.dir.dx && d.dy === -g.dir.dy) continue;
        if (!isWall(t.c + d.dx, t.r + d.dy)) opts.push(d);
      }
      let pool = opts.length ? opts : [g.dir];
      const pt = tileOf(pac);
      let best = pool[0], bd = Infinity;
      for (const d of pool) {
        const nc = t.c + d.dx, nr = t.r + d.dy;
        const dd = (nc - pt.c) ** 2 + (nr - pt.r) ** 2;
        const v = frightened > 0 && !g.eaten ? -dd : dd;
        if (v < bd) { bd = v; best = d; }
      }
      g.dir = best;
    }
    g.x += g.dir.dx * sp; g.y += g.dir.dy * sp;
    if (g.x < 0) g.x = W; if (g.x > W) g.x = 0;
    if (g.y < 0) g.y = H; if (g.y > H) g.y = 0;
  }

  function checkCollisions() {
    for (const g of ghosts) {
      if (Math.hypot(g.x - pac.x, g.y - pac.y) < TILE * 0.6) {
        if (frightened > 0 && !g.eaten) {
          g.eaten = true; score += 200; scoreEl.textContent = String(score);
          const h = center(9 + Math.floor(Math.random() * 2), 9 + Math.floor(Math.random() * 2));
          g.x = h.x; g.y = h.y; g.eaten = false;
        } else if (!g.eaten) {
          lives--; livesEl.textContent = String(lives);
          if (lives <= 0) { running = false; messageEl.textContent = 'Game Over! Press Restart.'; }
          else { resetPositions(); messageEl.textContent = 'Caught! ' + lives + ' lives left.'; }
          return;
        }
      }
    }
  }

  function loop() {
    if (running && !paused) {
      mouth = (mouth + 0.18) % (Math.PI);
      if (frightened > 0) frightened--;
      movePac();
      ghosts.forEach(ghostStep);
      checkCollisions();
    }
    draw();
    requestAnimationFrame(loop);
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a0c1d'); g.addColorStop(1, '#141a3a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // walls
    ctx.save();
    ctx.shadowBlur = 12; ctx.shadowColor = 'rgba(76,201,240,0.5)';
    ctx.fillStyle = '#1d2766';
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (isWall(c, r)) roundRect(ctx, c * TILE + 2, r * TILE + 2, TILE - 4, TILE - 4, 6), ctx.fill();
    ctx.restore();

    // dots
    for (const d of dots) {
      if (d.eaten) continue;
      const ctr = center(d.c, d.r);
      if (d.type === 2) {
        const p = 4 + Math.sin(mouth * 3) * 1.5;
        ctx.fillStyle = '#ffd166';
        ctx.beginPath(); ctx.arc(ctr.x, ctr.y, p + 2, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = '#9fd6ff';
        ctx.beginPath(); ctx.arc(ctr.x, ctr.y, 2.6, 0, Math.PI * 2); ctx.fill();
      }
    }

    // ghosts
    for (const gh of ghosts) {
      const col = (frightened > 0 && !gh.eaten) ? '#5762d5' : gh.color;
      ctx.save();
      ctx.shadowBlur = 14; ctx.shadowColor = col;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(gh.x, gh.y, TILE * 0.42, Math.PI, 0);
      ctx.lineTo(gh.x + TILE * 0.42, gh.y + TILE * 0.42);
      ctx.lineTo(gh.x - TILE * 0.42, gh.y + TILE * 0.42);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(gh.x - 5, gh.y - 2, 3, 0, Math.PI * 2); ctx.arc(gh.x + 5, gh.y - 2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#101030';
      const ex = gh.dir.dx * 2;
      ctx.beginPath(); ctx.arc(gh.x - 5 + ex, gh.y - 2, 1.4, 0, Math.PI * 2); ctx.arc(gh.x + 5 + ex, gh.y - 2, 1.4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // pac
    ctx.save();
    ctx.shadowBlur = 16; ctx.shadowColor = '#ffe66d';
    ctx.fillStyle = '#ffe66d';
    const open = Math.abs(Math.sin(mouth)) * 0.32 * Math.PI;
    let ang = 0;
    if (pac.dir.dx === 1) ang = 0; else if (pac.dir.dx === -1) ang = Math.PI;
    else if (pac.dir.dy === 1) ang = Math.PI / 2; else if (pac.dir.dy === -1) ang = -Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(pac.x, pac.y);
    ctx.arc(pac.x, pac.y, TILE * 0.46, ang + open, ang - open + Math.PI * 2);
    ctx.closePath(); ctx.fill();
    ctx.restore();
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

  const KEYMAP = {
    ArrowUp: { dx: 0, dy: -1 }, ArrowDown: { dx: 0, dy: 1 },
    ArrowLeft: { dx: -1, dy: 0 }, ArrowRight: { dx: 1, dy: 0 },
    w: { dx: 0, dy: -1 }, s: { dx: 0, dy: 1 }, a: { dx: -1, dy: 0 }, d: { dx: 1, dy: 0 },
  };
  window.addEventListener('keydown', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (KEYMAP[k]) { pac.next = KEYMAP[k]; e.preventDefault(); }
    if (k === 'p') paused = !paused;
  });

  startEl.addEventListener('click', start);
  pauseEl.addEventListener('click', () => paused = !paused);
  restartEl.addEventListener('click', newGame);

  newGame();
  requestAnimationFrame(loop);
})();
