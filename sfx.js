// Procedural cozy 2.5D mobile game sound effects via Web Audio API (no external audio files).
let ctx = null;
let muted = false;

try {
  muted = localStorage.getItem('bite-muted') === '1';
} catch {}

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('bite-muted', muted ? '1' : '0'); } catch {}
  if (!muted) playPop(580);
  return muted;
}

function getCtx() {
  if (muted) return null;
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, duration, type = 'sine', gain = 0.08, delay = 0, slideTo = null) {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime + delay;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(gain, now + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(amp);
  amp.connect(c.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

export function playPop(freq = 520) {
  tone(freq, 0.09, 'triangle', 0.09, 0, freq * 1.28);
}

export function playSquish() {
  tone(360, 0.08, 'sine', 0.08, 0, 240);
  tone(460, 0.07, 'triangle', 0.06, 0.04, 620);
}

export function playBoing() {
  tone(220, 0.24, 'sine', 0.12, 0, 440);
  tone(330, 0.16, 'triangle', 0.07, 0.07, 520);
}

export function playCupboardOpen() {
  tone(260, 0.11, 'triangle', 0.09, 0, 340);
  tone(390, 0.13, 'triangle', 0.08, 0.08, 520);
  tone(587, 0.15, 'sine', 0.07, 0.16);
}

export function playDiceRoll() {
  [0, 0.06, 0.12, 0.19, 0.27].forEach((d, i) => {
    tone(280 + i * 55, 0.055, 'triangle', 0.07, d, 190);
  });
}

export function playSparkle() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    tone(f, 0.18, 'triangle', 0.08, i * 0.065);
  });
}
