/* 🔢 Number Guess — vanilla JS, wrapped in an IIFE, fully self-contained. */
(function () {
  "use strict";

  // ---- Config ----------------------------------------------------------------
  const DIFFICULTIES = {
    easy:   { label: "Easy",   min: 1, max: 50 },
    medium: { label: "Medium", min: 1, max: 100 },
    hard:   { label: "Hard",   min: 1, max: 500 },
    expert: { label: "Expert", min: 1, max: 1000 },
  };

  const STORAGE_KEY = "ng_stats_v1";

  // ---- DOM -------------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const els = {
    difficulty: $("difficulty"),
    tries: $("tries"),
    best: $("best"),
    games: $("games"),
    rangeLo: $("range-lo"),
    rangeHi: $("range-hi"),
    rangeHint: $("range-hint"),
    deadLeft: $("dead-left"),
    deadRight: $("dead-right"),
    rangeLive: $("range-live"),
    rangeMarker: $("range-marker"),
    guessInput: $("guess-input"),
    guessBtn: $("guess-btn"),
    feedback: $("feedback"),
    history: $("history"),
    overlay: $("overlay"),
    overlayTitle: $("overlay-title"),
    overlayText: $("overlay-text"),
    overlayBtn: $("overlay-btn"),
  };

  // ---- State -----------------------------------------------------------------
  let state = null;
  let stats = loadStats();

  function loadStats() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          gamesPlayed: Number(parsed.gamesPlayed) || 0,
          bestByDiff: Object.assign({ easy: null, medium: null, hard: null, expert: null }, parsed.bestByDiff || {}),
        };
      }
    } catch (e) {
      /* ignore corrupt storage */
    }
    return { gamesPlayed: 0, bestByDiff: { easy: null, medium: null, hard: null, expert: null } };
  }

  function saveStats() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch (e) {
      /* storage might be unavailable; game still works in-memory */
    }
  }

  function newGame(diffKey) {
    const cfg = DIFFICULTIES[diffKey];
    const answer = cfg.min + Math.floor(Math.random() * (cfg.max - cfg.min + 1));
    state = {
      diff: diffKey,
      min: cfg.min,
      max: cfg.max,
      answer: answer,
      lo: cfg.min - 1,   // answer is strictly greater than lo
      hi: cfg.max + 1,   // answer is strictly less than hi
      tries: 0,
      over: false,
      guesses: [],
    };
    renderDifficultyActive(diffKey);
    updateHud();
    resetRange();
    clearHistory();
    setFeedback("I picked a number between " + cfg.min + " and " + cfg.max + ". Good luck!", "");
    hideOverlay();
    els.guessInput.disabled = false;
    els.guessBtn.disabled = false;
    els.guessInput.value = "";
    els.guessInput.focus();
  }

  // ---- Rendering -------------------------------------------------------------
  function renderDifficultyActive(diffKey) {
    const btns = els.difficulty.querySelectorAll(".diff-btn");
    btns.forEach((b) => b.classList.toggle("active", b.dataset.diff === diffKey));
  }

  function updateHud() {
    els.tries.textContent = state ? String(state.tries) : "0";
    const best = state ? stats.bestByDiff[state.diff] : null;
    els.best.textContent = best == null ? "—" : String(best);
    els.games.textContent = String(stats.gamesPlayed);
  }

  function resetRange() {
    const cfg = DIFFICULTIES[state.diff];
    els.rangeLo.textContent = String(cfg.min);
    els.rangeHi.textContent = String(cfg.max);
    els.rangeHint.textContent = "Hidden number is somewhere here";
    els.deadLeft.style.width = "0%";
    els.deadRight.style.width = "0%";
    els.rangeLive.style.left = "0%";
    els.rangeLive.style.width = "100%";
    els.rangeMarker.classList.remove("show");
  }

  // Position (0..100) of a value along the full [min, max] scale.
  function pctOf(value) {
    const span = state.max - state.min;
    if (span <= 0) return 0;
    return ((value - state.min) / span) * 100;
  }

  function updateRange() {
    // Dead zones: [min, lo] and [hi, max]. Live zone: (lo, hi).
    const leftDead = pctOf(state.lo) - pctOf(state.min); // lo sits at pctOf(lo); min at 0
    const rightDead = pctOf(state.max) - pctOf(state.hi); // hi sits at pctOf(hi); max at 100
    els.deadLeft.style.width = clampPct(leftDead) + "%";
    els.deadRight.style.width = clampPct(rightDead) + "%";
    const liveLeft = pctOf(state.lo);
    const liveWidth = pctOf(state.hi) - pctOf(state.lo);
    els.rangeLive.style.left = clampPct(liveLeft) + "%";
    els.rangeLive.style.width = Math.max(0, clampPct(liveWidth)) + "%";
    els.rangeLo.textContent = String(state.lo + 1);
    els.rangeHi.textContent = String(state.hi - 1);
    const remaining = (state.hi - 1) - (state.lo + 1) + 1;
    els.rangeHint.textContent =
      remaining <= 1 ? "Only one number left!" : remaining + " possible number" + (remaining === 1 ? "" : "s");
  }

  function clampPct(v) {
    return Math.max(0, Math.min(100, v));
  }

  function setFeedback(msg, kind) {
    els.feedback.textContent = msg;
    els.feedback.className = "feedback" + (kind ? " " + kind : "");
  }

  function clearHistory() {
    els.history.innerHTML = "";
  }

  function addChip(value, kind) {
    const chip = document.createElement("span");
    chip.className = "chip " + kind;
    chip.textContent = String(value);
    els.history.appendChild(chip);
  }

  function showOverlay(title, text, btn) {
    els.overlayTitle.textContent = title;
    els.overlayText.textContent = text;
    els.overlayBtn.textContent = btn;
    els.overlay.classList.remove("hidden");
  }

  function hideOverlay() {
    els.overlay.classList.add("hidden");
  }

  // ---- Gameplay --------------------------------------------------------------
  function submitGuess() {
    if (!state || state.over) return;
    const raw = els.guessInput.value.trim();
    if (raw === "") {
      setFeedback("Type a number first.", "err");
      return;
    }
    const guess = Number(raw);
    if (!Number.isInteger(guess)) {
      setFeedback("Please enter a whole number.", "err");
      return;
    }
    if (guess < state.min || guess > state.max) {
      setFeedback("Enter a number between " + state.min + " and " + state.max + ".", "err");
      return;
    }
    if (state.guesses.indexOf(guess) !== -1) {
      setFeedback("You already tried " + guess + ". Try another.", "err");
      return;
    }

    state.tries += 1;
    state.guesses.push(guess);
    els.guessInput.value = "";

    if (guess === state.answer) {
      win();
      return;
    }

    // Narrow the known range.
    if (guess < state.answer) {
      state.lo = Math.max(state.lo, guess);
      setFeedback(guess + " is too low. Aim higher.", "low");
      addChip(guess, "low");
    } else {
      state.hi = Math.min(state.hi, guess);
      setFeedback(guess + " is too high. Aim lower.", "high");
      addChip(guess, "high");
    }

    updateRange();
    // Place marker at the guessed value.
    els.rangeMarker.style.left = clampPct(pctOf(guess)) + "%";
    els.rangeMarker.classList.add("show");
    updateHud();
    els.guessInput.focus();
  }

  function win() {
    state.over = true;
    addChip(state.answer, "correct");
    updateHud();

    stats.gamesPlayed += 1;
    const prevBest = stats.bestByDiff[state.diff];
    let isRecord = false;
    if (prevBest == null || state.tries < prevBest) {
      stats.bestByDiff[state.diff] = state.tries;
      isRecord = true;
    }
    saveStats();
    updateHud();

    els.guessInput.disabled = true;
    els.guessBtn.disabled = true;

    const diffLabel = DIFFICULTIES[state.diff].label;
    const title = isRecord ? "🏆 New Best!" : "🎉 You got it!";
    const text =
      "The number was " + state.answer + ". You solved it in " + state.tries +
      " " + (state.tries === 1 ? "try" : "tries") + " on " + diffLabel + "." +
      (isRecord ? " That's your fewest yet on this difficulty!" : "");
    showOverlay(title, text, "Play Again");
  }

  // ---- Events ----------------------------------------------------------------
  els.difficulty.addEventListener("click", (e) => {
    const btn = e.target.closest(".diff-btn");
    if (!btn) return;
    newGame(btn.dataset.diff);
  });

  els.guessBtn.addEventListener("click", submitGuess);

  els.guessInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitGuess();
    }
  });

  els.guessInput.addEventListener("input", () => {
    // Strip anything that isn't a digit so the number field behaves predictably.
    const cleaned = els.guessInput.value.replace(/[^0-9]/g, "");
    if (cleaned !== els.guessInput.value) els.guessInput.value = cleaned;
  });

  els.overlayBtn.addEventListener("click", () => {
    if (state && state.over) {
      // Play again on the same difficulty.
      newGame(state.diff);
    } else {
      // Initial start: begin on Medium by default.
      newGame("medium");
    }
  });

  // ---- Background canvas (subtle floating glow orbs) ------------------------
  function initBackground() {
    const canvas = $("bg-canvas");
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, dpr = 1;
    const orbs = [];
    const COLORS = ["#7c5cff", "#00e0ff", "#ff5cc8"];

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function makeOrbs() {
      orbs.length = 0;
      const count = Math.max(5, Math.min(11, Math.round((w * h) / 90000)));
      for (let i = 0; i < count; i++) {
        orbs.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 60 + Math.random() * 140,
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25,
          c: COLORS[i % COLORS.length],
          a: 0.06 + Math.random() * 0.06,
        });
      }
    }

    function tick() {
      ctx.clearRect(0, 0, w, h);
      for (const o of orbs) {
        o.x += o.vx;
        o.y += o.vy;
        if (o.x < -o.r) o.x = w + o.r;
        if (o.x > w + o.r) o.x = -o.r;
        if (o.y < -o.r) o.y = h + o.r;
        if (o.y > h + o.r) o.y = -o.r;
        const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        g.addColorStop(0, hexA(o.c, o.a));
        g.addColorStop(1, hexA(o.c, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(tick);
    }

    function hexA(hex, a) {
      const n = parseInt(hex.slice(1), 16);
      const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      return "rgba(" + r + "," + g + "," + b + "," + a + ")";
    }

    resize();
    makeOrbs();
    window.addEventListener("resize", () => { resize(); makeOrbs(); });
    requestAnimationFrame(tick);
  }

  // ---- Boot ------------------------------------------------------------------
  function init() {
    initBackground();
    updateHud();
    // Start screen: overlay visible, difficulty inactive until a choice is made.
    showOverlay(
      "🔢 Number Guess",
      "Choose a difficulty and start guessing. I'll tell you if you're too high or too low, and the bar below will narrow as you rule out numbers.",
      "Play"
    );
    els.guessInput.disabled = true;
    els.guessBtn.disabled = true;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
