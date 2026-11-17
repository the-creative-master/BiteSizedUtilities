(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const streakEl = document.getElementById('streak');
  const bestEl = document.getElementById('best');
  const messageEl = document.getElementById('message');
  const restartEl = document.getElementById('restart');

  const W = canvas.width, H = canvas.height;
  const BEST_KEY = 'mathmaster-best';

  let problem, answer, input, timeLeft, maxTime, streak, score, best, level, flash;

  function ri(n) { return Math.floor(Math.random() * n); }

  function generate() {
    level = Math.min(5, 1 + Math.floor(streak / 3));
    let a, b, op, ans;
    const r = ri(level + 1);
    if (r === 0 || level === 1) { a = ri(20) + 1; b = ri(20) + 1; op = '+'; ans = a + b; }
    else if (r === 1) { a = ri(20) + 1; b = ri(20) + 1; op = '-'; ans = a - b; if (ans < 0) [a, b] = [b, a], ans = a - b; }
    else if (r === 2) { a = ri(12) + 1; b = ri(12) + 1; op = '×'; ans = a * b; }
    else if (r === 3) { b = ri(12) + 1; ans = ri(12) + 1; a = b * ans; op = '÷'; }
    else { a = ri(50) + 1; b = ri(50) + 1; op = ri(2) ? '+' : '-'; ans = op === '+' ? a + b : Math.max(a, b) - Math.min(a, b); if (op === '-') a = Math.max(a, b), b = Math.min(a, b); }
    problem = `${a} ${op} ${b} = ?`;
    answer = String(ans);
    input = '';
    maxTime = 600 - streak * 8; if (maxTime < 220) maxTime = 220;
    timeLeft = maxTime;
  }

  function bestKey() { try { return parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) { return 0; } }

  function newGame() {
    score = 0; streak = 0; best = bestKey(); flash = null;
    scoreEl.textContent = '0'; streakEl.textContent = '0'; bestEl.textContent = String(best);
    messageEl.textContent = 'Type the answer and press Enter.';
    generate();
  }

  function submit() {
    if (input === '') return;
    if (input === answer) {
      streak++; score += 10 * streak; flash = '#80ed99';
      if (score > best) { best = score; bestEl.textContent = String(best); try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {} }
      scoreEl.textContent = String(score); streakEl.textContent = String(streak);
      messageEl.textContent = 'Correct! 🎉';
    } else {
      streak = 0; streakEl.textContent = '0'; flash = '#ff5e7e';
      messageEl.textContent = `Wrong — it was ${answer}.`;
    }
    scoreEl.textContent = String(score);
    generate();
  }

  function onKey(e) {
    if (e.key >= '0' && e.key <= '9') input += e.key;
    else if (e.key === 'Backspace') input = input.slice(0, -1);
    else if (e.key === 'Enter') submit();
    else return;
    e.preventDefault();
    draw();
  }

  function loop() {
    if (timeLeft > 0) {
      timeLeft--;
      if (timeLeft === 0) {
        streak = 0; streakEl.textContent = '0'; flash = '#ff5e7e';
        messageEl.textContent = `Time up — it was ${answer}.`;
        generate();
      }
    }
    draw();
    requestAnimationFrame(loop);
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#141a3a'); g.addColorStop(1, '#0a0c1d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // timer bar
    const frac = Math.max(0, timeLeft / maxTime);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    roundRect(ctx, 20, 20, W - 40, 12, 6); ctx.fill();
    ctx.save(); ctx.shadowBlur = 14; ctx.shadowColor = frac > 0.3 ? '#4cc9f0' : '#ff5e7e';
    ctx.fillStyle = frac > 0.3 ? '#4cc9f0' : '#ff5e7e';
    roundRect(ctx, 20, 20, (W - 40) * frac, 12, 6); ctx.fill(); ctx.restore();

    if (flash) {
      ctx.fillStyle = flash; ctx.font = '700 20px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(messageEl.textContent.includes('🎉') ? '✓' : '✗', W / 2, 80);
    }

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#eef1ff'; ctx.font = '700 52px system-ui';
    ctx.fillText(problem, W / 2, H / 2 - 10);
    ctx.fillStyle = input ? '#ffe66d' : '#6b7299'; ctx.font = '700 40px ui-monospace, monospace';
    ctx.fillText(input || '?', W / 2, H / 2 + 55);
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  window.addEventListener('keydown', onKey);
  restartEl.addEventListener('click', newGame);

  newGame();
  requestAnimationFrame(loop);
})();
