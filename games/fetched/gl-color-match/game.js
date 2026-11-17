/* 🟦 Color Match — vanilla JS, IIFE, no dependencies. */
(function () {
  "use strict";

  // ---------- DOM refs ----------
  const els = {
    score: document.getElementById("score"),
    combo: document.getElementById("combo"),
    best: document.getElementById("best"),
    target: document.getElementById("target"),
    grid: document.getElementById("grid"),
    timerFill: document.getElementById("timer-fill"),
    overlay: document.getElementById("overlay"),
    overlayTitle: document.getElementById("overlay-title"),
    overlayText: document.getElementById("overlay-text"),
    startBtn: document.getElementById("start-btn"),
    canvas: document.getElementById("bg-canvas"),
  };

  const BEST_KEY = "colormatch.best";

  // ---------- State ----------
  const state = {
    running: false,
    score: 0,
    combo: 0,
    round: 0,
    best: loadBest(),
    options: [],
    correctIndex: -1,
    endTime: 0,
    timeTotal: 0,
    rafId: null,
    locked: false,
  };

  // ---------- Helpers ----------
  function loadBest() {
    try {
      const v = parseInt(localStorage.getItem(BEST_KEY), 10);
      return Number.isFinite(v) && v > 0 ? v : 0;
    } catch (e) {
      return 0;
    }
  }

  function saveBest(v) {
    try {
      localStorage.setItem(BEST_KEY, String(v));
    } catch (e) {
      /* localStorage unavailable — ignore */
    }
  }

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function hslCss(h, s, l) {
    return "hsl(" + Math.round(h) + " " + Math.round(s) + "% " + Math.round(l) + "%)";
  }

  // Difficulty in [0,1] grows with round count.
  function difficulty() {
    return clamp(state.round / 25, 0, 1);
  }

  function optionCount() {
    return clamp(3 + Math.floor(state.round / 3), 3, 9);
  }

  function timeForRound() {
    return clamp(2600 - state.round * 90, 900, 2600);
  }

  // ---------- Color generation ----------
  function makeTarget() {
    const h = rand(0, 360);
    const s = rand(55, 80);
    const l = rand(48, 62);
    return { h: h, s: s, l: l, css: hslCss(h, s, l), isTarget: true };
  }

  function makeDistractor(target, d, used) {
    const hueSpread = 46 - 34 * d;
    const lightSpread = 20 - 14 * d;
    for (let i = 0; i < 40; i++) {
      const dh = (Math.random() * 2 - 1) * hueSpread;
      const dl = (Math.random() * 2 - 1) * lightSpread;
      const h = ((target.h + dh) % 360 + 360) % 360;
      const l = clamp(target.l + dl, 14, 84);
      const s = clamp(target.s + (Math.random() * 2 - 1) * 10, 38, 92);
      const css = hslCss(h, s, l);
      if (css !== target.css && !used.has(css)) {
        used.add(css);
        return { h: h, s: s, l: l, css: css, isTarget: false };
      }
    }
    // Fallback: large hue shift guarantees uniqueness vs target.
    const h = (target.h + 180) % 360;
    const css = hslCss(h, target.s, target.l);
    used.add(css);
    return { h: h, s: target.s, l: target.l, css: css, isTarget: false };
  }

  function buildRound() {
    const d = difficulty();
    const count = optionCount();
    const target = makeTarget();
    const used = new Set([target.css]);
    const options = [target];
    for (let i = 1; i < count; i++) {
      options.push(makeDistractor(target, d, used));
    }
    // Shuffle (Fisher–Yates).
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = options[i];
      options[i] = options[j];
      options[j] = t;
    }
    state.options = options;
    state.correctIndex = options.findIndex(function (o) { return o.isTarget; });
  }

  // ---------- Rendering ----------
  function renderGrid() {
    els.grid.innerHTML = "";
    state.options.forEach(function (opt, i) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "swatch";
      btn.style.background = opt.css;
      btn.setAttribute("aria-label", "Color option " + (i + 1));
      btn.dataset.index = String(i);
      if (i < 9) {
        const key = document.createElement("span");
        key.className = "key";
        key.textContent = String(i + 1);
        btn.appendChild(key);
      }
      btn.addEventListener("click", function () { onPick(i); });
      els.grid.appendChild(btn);
    });
  }

  function renderTarget() {
    els.target.style.background = state.options[state.correctIndex].css;
    els.target.classList.remove("pop");
    void els.target.offsetWidth; // force reflow to restart animation
    els.target.classList.add("pop");
  }

  function renderHud() {
    els.score.textContent = String(state.score);
    const mult = comboMultiplier();
    els.combo.textContent = "x" + mult;
    els.best.textContent = String(state.best);
  }

  function comboMultiplier() {
    return clamp(state.combo, 1, 10);
  }

  // ---------- Round flow ----------
  function nextRound() {
    state.round += 1;
    buildRound();
    renderGrid();
    renderTarget();
    renderHud();

    state.locked = false;
    state.timeTotal = timeForRound();
    state.endTime = performance.now() + state.timeTotal;
    state.running = true;
    els.timerFill.style.background = "";
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.rafId = requestAnimationFrame(tick);
  }

  function tick(now) {
    if (!state.running) return;
    const remaining = state.endTime - now;
    const ratio = Math.max(0, remaining / state.timeTotal);
    els.timerFill.style.transform = "scaleX(" + ratio + ")";
    if (ratio < 0.35) {
      els.timerFill.style.background = "linear-gradient(90deg, var(--bad), #ff9f43)";
    } else {
      els.timerFill.style.background = "";
    }
    if (remaining <= 0) {
      onTimeout();
      return;
    }
    state.rafId = requestAnimationFrame(tick);
  }

  function onPick(index) {
    if (!state.running || state.locked) return;
    const opt = state.options[index];
    if (!opt) return;
    if (opt.isTarget) {
      handleCorrect(index);
    } else {
      handleWrong(index);
    }
  }

  function handleCorrect(index) {
    state.locked = true;
    state.running = false;
    if (state.rafId) cancelAnimationFrame(state.rafId);

    state.combo += 1;
    const points = 10 * comboMultiplier();
    state.score += points;
    if (state.score > state.best) {
      state.best = state.score;
      saveBest(state.best);
    }
    renderHud();

    const node = els.grid.children[index];
    if (node) node.classList.add("correct");

    setTimeout(function () {
      if (state.score >= 0) nextRound();
    }, 230);
  }

  function handleWrong(index) {
    state.locked = true;
    state.running = false;
    if (state.rafId) cancelAnimationFrame(state.rafId);

    const picked = els.grid.children[index];
    if (picked) picked.classList.add("wrong");

    const correct = els.grid.children[state.correctIndex];
    if (correct) correct.classList.add("correct");

    gameOver();
  }

  function onTimeout() {
    state.locked = true;
    state.running = false;
    if (state.rafId) cancelAnimationFrame(state.rafId);
    els.timerFill.style.transform = "scaleX(0)";

    const correct = els.grid.children[state.correctIndex];
    if (correct) correct.classList.add("correct");

    gameOver();
  }

  function gameOver() {
    const isBest = state.score >= state.best && state.score > 0;
    setTimeout(function () {
      showOverlay(
        "Game Over",
        "You scored " + state.score + " points with a best combo of x" +
          clamp(state.combo, 1, 10) + "." +
          (isBest ? " 🏆 New best score!" : " Best: " + state.best + "."),
        "Play Again"
      );
    }, 620);
  }

  // ---------- Overlay ----------
  function showOverlay(title, text, btn) {
    els.overlayTitle.textContent = title;
    els.overlayText.textContent = text;
    els.startBtn.textContent = btn;
    els.overlay.classList.remove("hidden");
  }

  function hideOverlay() {
    els.overlay.classList.add("hidden");
  }

  function startGame() {
    state.score = 0;
    state.combo = 0;
    state.round = 0;
    hideOverlay();
    renderHud();
    nextRound();
  }

  // ---------- Input ----------
  els.startBtn.addEventListener("click", startGame);

  document.addEventListener("keydown", function (e) {
    if (!state.running || state.locked) return;
    const n = parseInt(e.key, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 9) {
      const idx = n - 1;
      if (idx < state.options.length) onPick(idx);
    }
  });

  // ---------- Background particles (canvas) ----------
  function initBackground() {
    const canvas = els.canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let w = 0, h = 0, dpr = 1;
    const dots = [];
    const COLORS = ["#7c5cff", "#00e0ff", "#ff5cc8", "#2ee6a6"];

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn() {
      dots.length = 0;
      const count = Math.round(clamp((w * h) / 26000, 18, 60));
      for (let i = 0; i < count; i++) {
        dots.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: rand(18, 70),
          vx: rand(-0.18, 0.18),
          vy: rand(-0.18, 0.18),
          c: COLORS[Math.floor(Math.random() * COLORS.length)],
          a: rand(0.05, 0.16),
        });
      }
    }

    let last = performance.now();
    function frame(now) {
      const dt = Math.min((now - last) / 16.67, 3);
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (d.x < -d.r) d.x = w + d.r;
        if (d.x > w + d.r) d.x = -d.r;
        if (d.y < -d.r) d.y = h + d.r;
        if (d.y > h + d.r) d.y = -d.r;
        const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
        g.addColorStop(0, hexA(d.c, d.a));
        g.addColorStop(1, hexA(d.c, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(frame);
    }

    function hexA(hex, a) {
      const n = parseInt(hex.slice(1), 16);
      const r = (n >> 16) & 255;
      const g = (n >> 8) & 255;
      const b = n & 255;
      return "rgba(" + r + "," + g + "," + b + "," + a + ")";
    }

    resize();
    spawn();
    window.addEventListener("resize", function () { resize(); spawn(); });
    requestAnimationFrame(frame);
  }

  // ---------- Boot ----------
  renderHud();
  initBackground();
})();
