/* 🎯 Aim Trainer — vanilla JS, Canvas, IIFE, rAF loop. */
(function () {
  "use strict";

  // ---------- DOM ----------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const hud = {
    time: document.getElementById("hud-time"),
    acc: document.getElementById("hud-acc"),
    combo: document.getElementById("hud-combo"),
    score: document.getElementById("hud-score"),
    best: document.getElementById("hud-best"),
  };
  const menu = document.getElementById("menu");
  const endScreen = document.getElementById("end");
  const startBtn = document.getElementById("start-btn");
  const againBtn = document.getElementById("again-btn");
  const durationSeg = document.getElementById("duration-seg");
  const endEls = {
    acc: document.getElementById("end-acc"),
    rt: document.getElementById("end-rt"),
    hits: document.getElementById("end-hits"),
    combo: document.getElementById("end-combo"),
    score: document.getElementById("end-score"),
    record: document.getElementById("end-record"),
  };

  // ---------- Config ----------
  const PALETTE = {
    cyan: "#22d3ee",
    violet: "#7c3aed",
    pink: "#ec4899",
    amber: "#fbbf24",
  };
  const BASE_POINTS = 100;
  const SPAWN_GAP = 110; // ms between targets
  const STORE_BEST_SCORE = "aimtrainer.bestScore";
  const STORE_BEST_ACC = "aimtrainer.bestAccuracy";

  // ---------- State ----------
  let W = 0, H = 0, dpr = 1;
  let state = "menu"; // menu | playing | ended
  let duration = 45; // seconds
  let durationMs = duration * 1000;

  let target = null;          // {x,y,r,spawn,life,maxLife,hue}
  let particles = [];
  let ripples = [];
  let spawnTimer = 0;         // delay before next spawn

  let stats = null;
  let startTime = 0;
  let lastFrame = 0;
  let bestScore = 0;
  let bestAccuracy = 0;

  // ---------- Sizing ----------
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // If a target falls outside after resize, pull it back in.
    if (target) {
      target.x = clamp(target.x, target.r, W - target.r);
      target.y = clamp(target.y, target.r, H - target.r);
    }
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  // ---------- Best scores ----------
  function loadBest() {
    bestScore = parseFloat(localStorage.getItem(STORE_BEST_SCORE)) || 0;
    bestAccuracy = parseFloat(localStorage.getItem(STORE_BEST_ACC)) || 0;
    hud.best.textContent = Math.round(bestScore).toLocaleString();
  }
  function saveBest() {
    if (stats.score > bestScore) {
      bestScore = stats.score;
      localStorage.setItem(STORE_BEST_SCORE, String(bestScore));
    }
    if (stats.accuracy > bestAccuracy) {
      bestAccuracy = stats.accuracy;
      localStorage.setItem(STORE_BEST_ACC, String(bestAccuracy));
    }
    hud.best.textContent = Math.round(bestScore).toLocaleString();
  }

  // ---------- Targets ----------
  function spawnTarget() {
    const progress = clamp(elapsed() / durationMs, 0, 1);
    const r = lerp(40, 22, progress); // shrinks over time
    const margin = r + 8;
    const x = margin + Math.random() * (W - margin * 2);
    const y = margin + Math.random() * (H - margin * 2);
    const life = lerp(1700, 850, progress); // faster deadline over time
    const hue = Math.floor(Math.random() * 3); // 0 cyan,1 violet,2 pink
    target = {
      x, y, r,
      spawn: performance.now(),
      life,
      maxLife: life,
      hue,
      pulse: Math.random() * Math.PI * 2,
    };
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  // ---------- Round flow ----------
  function elapsed() { return performance.now() - startTime; }

  function startGame() {
    durationMs = duration * 1000;
    stats = {
      clicks: 0,
      hits: 0,
      misses: 0,        // empty-space clicks
      expired: 0,       // targets that timed out
      score: 0,
      combo: 0,
      bestCombo: 0,
      rtSum: 0,
      rtCount: 0,
      accuracy: 100,
    };
    target = null;
    particles = [];
    ripples = [];
    spawnTimer = 0;
    startTime = performance.now();
    state = "playing";
    menu.classList.add("hidden");
    endScreen.classList.add("hidden");
    lastFrame = performance.now();
    updateHud();
    requestAnimationFrame(loop);
  }

  function endGame() {
    state = "ended";
    saveBest();
    const acc = stats.clicks > 0 ? (stats.hits / stats.clicks) * 100 : 0;
    stats.accuracy = acc;
    const avgRt = stats.rtCount > 0 ? Math.round(stats.rtSum / stats.rtCount) : 0;

    endEls.acc.textContent = acc.toFixed(1) + "%";
    endEls.rt.textContent = avgRt + " ms";
    endEls.hits.textContent = stats.hits;
    endEls.combo.textContent = "x" + multiplier(stats.bestCombo).toFixed(1);
    endEls.score.textContent = Math.round(stats.score).toLocaleString();

    let msg = "";
    if (stats.score >= bestScore && stats.score > 0) msg += "🏆 New best score! ";
    if (acc >= bestAccuracy && stats.clicks > 0) msg += "🎯 New best accuracy!";
    endEls.record.textContent = msg;

    endScreen.classList.remove("hidden");
  }

  function multiplier(combo) {
    // x1.0 -> grows 0.25 every 4 consecutive hits, capped at x5.
    return Math.min(5, 1 + Math.floor(combo / 4) * 0.25);
  }

  // ---------- Input ----------
  function onCanvasClick(e) {
    if (state !== "playing") return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    stats.clicks++;
    addRipple(x, y, false);

    if (target && dist(x, y, target.x, target.y) <= target.r) {
      hitTarget(x, y);
    } else {
      stats.misses++;
      stats.combo = 0;
      updateHud();
    }
  }

  function dist(x1, y1, x2, y2) {
    const dx = x1 - x2, dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function hitTarget(x, y) {
    const now = performance.now();
    const rt = now - target.spawn;
    stats.hits++;
    stats.rtSum += rt;
    stats.rtCount++;
    stats.combo++;
    if (stats.combo > stats.bestCombo) stats.bestCombo = stats.combo;

    const mult = multiplier(stats.combo);
    // Speed bonus: faster reaction -> up to +100% points.
    const speed = clamp(1 - (rt - 300) / 1400, 0.1, 1);
    const gained = BASE_POINTS * mult * (0.5 + speed);
    stats.score += gained;

    burst(target.x, target.y, target.hue);
    target = null;
    spawnTimer = now + SPAWN_GAP;
    updateHud();
  }

  function addRipple(x, y, hit) {
    ripples.push({ x, y, t: 0, hit });
  }

  function burst(x, y, hue) {
    const colors = [PALETTE.cyan, PALETTE.violet, PALETTE.pink];
    const c = colors[hue];
    const n = 18;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.3;
      const sp = 2 + Math.random() * 4;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1,
        decay: 0.018 + Math.random() * 0.02,
        r: 2 + Math.random() * 3,
        color: c,
      });
    }
  }

  // ---------- Update / Render ----------
  function updateHud() {
    const remain = Math.max(0, durationMs - elapsed());
    hud.time.textContent = (remain / 1000).toFixed(1);
    const acc = stats.clicks > 0 ? (stats.hits / stats.clicks) * 100 : 100;
    hud.acc.textContent = acc.toFixed(0) + "%";
    hud.combo.textContent = "x" + multiplier(stats.combo).toFixed(1);
    hud.score.textContent = Math.round(stats.score).toLocaleString();
  }

  function loop(now) {
    if (state !== "playing") return;
    const dt = now - lastFrame;
    lastFrame = now;

    // End condition
    if (elapsed() >= durationMs) {
      endGame();
      return;
    }

    // Spawn logic
    if (!target && now >= spawnTimer) {
      spawnTarget();
    }
    // Expire target if its lifetime ran out
    if (target && now - target.spawn >= target.life) {
      stats.expired++;
      stats.combo = 0;
      target = null;
      spawnTimer = now + SPAWN_GAP;
      updateHud();
    }

    updateParticles();
    updateRipples();

    render();
    updateHud();
    requestAnimationFrame(loop);
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.vy += 0.06; // slight gravity
      p.life -= p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function updateRipples() {
    for (let i = ripples.length - 1; i >= 0; i--) {
      ripples[i].t += 0.06;
      if (ripples[i].t >= 1) ripples.splice(i, 1);
    }
  }

  function render() {
    ctx.clearRect(0, 0, W, H);

    // Subtle vignette grid backdrop on canvas
    drawBackdrop();

    if (target) drawTarget(target);
    drawParticles();
    drawRipples();
  }

  function drawBackdrop() {
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, "rgba(124,58,237,0.10)");
    g.addColorStop(1, "rgba(7,5,18,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawTarget(t) {
    const pulse = 1 + Math.sin(t.pulse + performance.now() / 220) * 0.08;
    const r = t.r * pulse;
    const colors = [PALETTE.cyan, PALETTE.violet, PALETTE.pink];
    const c1 = colors[t.hue];
    const c2 = colors[(t.hue + 1) % 3];

    // ring showing remaining life
    const lifeLeft = 1 - (performance.now() - t.spawn) / t.life;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(t.x, t.y, r + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(lifeLeft, 0, 1));
    ctx.stroke();
    ctx.restore();

    // glow body
    const grad = ctx.createRadialGradient(t.x, t.y, r * 0.1, t.x, t.y, r);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.35, c1);
    grad.addColorStop(1, c2);

    ctx.save();
    ctx.shadowColor = c1;
    ctx.shadowBlur = 28;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // inner dot
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(t.x, t.y, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = clamp(p.life, 0, 1);
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawRipples() {
    for (const r of ripples) {
      const rad = r.t * (r.hit ? 46 : 30);
      ctx.save();
      ctx.globalAlpha = (1 - r.t) * 0.6;
      ctx.strokeStyle = r.hit ? PALETTE.cyan : "rgba(255,255,255,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ---------- Wiring ----------
  canvas.addEventListener("pointerdown", onCanvasClick);
  window.addEventListener("resize", resize);

  durationSeg.addEventListener("click", function (e) {
    const btn = e.target.closest(".seg-btn");
    if (!btn) return;
    duration = parseInt(btn.dataset.duration, 10);
    durationSeg.querySelectorAll(".seg-btn").forEach(function (b) {
      b.classList.toggle("active", b === btn);
    });
  });

  startBtn.addEventListener("click", startGame);
  againBtn.addEventListener("click", startGame);

  // ---------- Init ----------
  resize();
  loadBest();
})();
