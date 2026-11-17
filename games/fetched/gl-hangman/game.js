(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const wrongEl = document.getElementById('wrong');
  const wonEl = document.getElementById('won');
  const messageEl = document.getElementById('message');
  const keysEl = document.getElementById('keys');

  const W = canvas.width, H = canvas.height;
  const WORDS = ['canvas', 'gravity', 'pixel', 'quantum', 'nebula', 'rocket', 'crystal', 'velocity',
    'matrix', 'photon', 'galaxy', 'plasma', 'circuit', 'diamond', 'horizon', 'mystic'];
  const MAX = 6;

  let word, guessed, wrong, over, wins;

  function newGame() {
    word = WORDS[Math.floor(Math.random() * WORDS.length)].toUpperCase();
    guessed = new Set();
    wrong = 0; over = false;
    wrongEl.textContent = '0';
    messageEl.textContent = 'Pick a letter to guess.';
    drawKeys();
    draw();
  }

  function guess(letter) {
    if (over || guessed.has(letter)) return;
    guessed.add(letter);
    if (!word.includes(letter)) {
      wrong++;
      wrongEl.textContent = String(wrong);
    }
    const solved = [...word].every(l => guessed.has(l));
    if (solved) { over = true; wins++; wonEl.textContent = String(wins); messageEl.textContent = `You got it: ${word}! 🎉`; }
    else if (wrong >= MAX) { over = true; messageEl.textContent = `Out of tries — it was ${word}.`; }
    drawKeys();
    draw();
  }

  function drawKeys() {
    keysEl.innerHTML = '';
    for (let i = 65; i <= 90; i++) {
      const ch = String.fromCharCode(i);
      const b = document.createElement('button');
      b.className = 'btn key';
      b.textContent = ch;
      b.disabled = over || guessed.has(ch);
      b.addEventListener('click', () => guess(ch));
      keysEl.appendChild(b);
    }
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#141a3a'); g.addColorStop(1, '#0a0c1d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#cdd6ff'; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(60, 300); ctx.lineTo(180, 300); ctx.moveTo(120, 300); ctx.lineTo(120, 60);
    ctx.lineTo(230, 60); ctx.lineTo(230, 100); ctx.stroke();

    const parts = [
      () => { ctx.beginPath(); ctx.arc(230, 125, 25, 0, Math.PI * 2); ctx.stroke(); }, // head
      () => { ctx.beginPath(); ctx.moveTo(230, 150); ctx.lineTo(230, 215); ctx.stroke(); }, // body
      () => { ctx.beginPath(); ctx.moveTo(230, 165); ctx.lineTo(195, 200); ctx.stroke(); }, // arm L
      () => { ctx.beginPath(); ctx.moveTo(230, 165); ctx.lineTo(265, 200); ctx.stroke(); }, // arm R
      () => { ctx.beginPath(); ctx.moveTo(230, 215); ctx.lineTo(200, 265); ctx.stroke(); }, // leg L
      () => { ctx.beginPath(); ctx.moveTo(230, 215); ctx.lineTo(260, 265); ctx.stroke(); }, // leg R
    ];
    for (let i = 0; i < wrong; i++) parts[i]();

    ctx.font = '700 46px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let x = W / 2 - (word.length - 1) * 18;
    for (const ch of word) {
      const shown = guessed.has(ch) || over;
      ctx.fillStyle = shown ? '#80ed99' : '#4cc9f0';
      ctx.fillText(shown ? ch : '_', x, 285);
      x += 36;
    }
  }

  document.getElementById('new').addEventListener('click', newGame);
  wins = 0;
  newGame();
})();
