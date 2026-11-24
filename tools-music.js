import { gEl, gameBtn, gameTabs, gameToggle, gameSlider, gameColorPicker, gameFilePill, gameField, statBox, copyToClipboard } from './ui-kit.js';
import { triggerFileDownload } from './file-tools-client.js';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SCALES = {
  Major: [0, 2, 4, 5, 7, 9, 11],
  Pentatonic: [0, 2, 4, 7, 9],
  Minor: [0, 2, 3, 5, 7, 8, 10],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Phrygian: [0, 1, 3, 5, 7, 8, 10],
  Lydian: [0, 2, 4, 6, 7, 9, 11],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],
  'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11],
  Blues: [0, 3, 5, 6, 7, 10],
  'Whole Tone': [0, 2, 4, 6, 8, 10],
  Chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
};
const LAB_COLORS = ['#e78167', '#f09a50', '#ffe17d', '#9ee09e', '#82bbb6', '#88b5d8', '#b89ad9', '#f2a2b4'];

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function midiToName(midi) {
  const n = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[n]}${oct}`;
}

function createAudioEngine() {
  let ctx = null;
  let bus = null;
  let analyser = null;
  const ensure = () => {
    if (!ctx && typeof window !== 'undefined') {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  };
  /**
   * One gain into one analyser into the speakers.
   *
   * Every voice the lab makes goes through here instead of straight to
   * `destination`, which is what lets the experimental bench draw a spectrum of
   * the music it is actually playing. A visualiser wired to the microphone would
   * have drawn the room; one wired to an oscillator it invented itself would have
   * drawn a guess. This one draws the output.
   */
  const out = () => {
    const c = ensure();
    if (!c) return null;
    if (!bus || bus.context !== c) {
      bus = c.createGain();
      bus.gain.value = 0.92;
      analyser = c.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.72;
      bus.connect(analyser);
      analyser.connect(c.destination);
    }
    return bus;
  };
  /** The analyser, or null on a page with no AudioContext at all. */
  const getAnalyser = () => (out() ? analyser : null);
  const playTone = (freq, { type = 'triangle', duration = 0.28, gain = 0.22, when = 0, attack = 0.01, slideTo = null } = {}) => {
    const c = ensure();
    if (!c) return;
    const dest = out();
    if (!dest) return;
    const t = c.currentTime + when;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + duration);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack + 0.02, duration));
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + duration + 0.03);
  };
  const playDrum = (kind, when = 0, vol = 0.35) => {
    const c = ensure();
    if (!c) return;
    const dest = out();
    if (!dest) return;
    const t = c.currentTime + when;
    if (kind === 'kick') {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(145, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.14);
      g.gain.setValueAtTime(vol * 1.4, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(g); g.connect(dest);
      osc.start(t); osc.stop(t + 0.24);
      return;
    }
    if (kind === 'bass') {
      playTone(65.4, { type: 'sawtooth', duration: 0.2, gain: vol * 0.7, when });
      return;
    }
    const len = Math.floor(c.sampleRate * (kind === 'openhat' ? 0.24 : kind === 'clap' ? 0.15 : 0.11));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = (kind === 'hihat' || kind === 'openhat') ? 'highpass' : 'bandpass';
    filt.frequency.value = kind === 'hihat' || kind === 'openhat' ? 6800 : kind === 'clap' ? 1800 : 1200;
    const g = c.createGain();
    g.gain.setValueAtTime(vol * (kind === 'hihat' ? 0.45 : 0.8), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len / c.sampleRate);
    src.connect(filt); filt.connect(g); g.connect(dest);
    src.start(t);
    if (kind === 'snare') {
      playTone(185, { type: 'triangle', duration: 0.09, gain: vol * 0.45, when, slideTo: 90 });
    }
  };
  const close = () => {
    if (ctx && typeof ctx.close === 'function') ctx.close().catch(() => {});
    ctx = null;
    bus = null;
    analyser = null;
  };
  return { ensure, playTone, playDrum, close, getAnalyser };
}

function encodeWavFromSamples(samples, sampleRate = 44100) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const wStr = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  wStr(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  wStr(8, 'WAVE');
  wStr(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  wStr(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Uint8Array(buf);
}

// 1. STAR UTILITY: WAFFLE MUSIC LAB (Chrome Music Lab Knockoff)
function mountWaffleMusicLab(root) {
  const audio = createAudioEngine();
  let mode = 'song';
  let timer = null;
  let rafId = null;
  let micStream = null;

  /**
   * The experimental bench's setup, kept here rather than inside its own render so
   * that loading somebody else's bench code can rebuild every control around the
   * values it carried. `pattern: null` means "compose one on the way in".
   */
  const bench = {
    scale: 'Major', inst: 'triangle', bpm: 104, density: 5,
    swing: 0, humanise: 0, seed: 20260, bass: true, pattern: null
  };

  const panel = gEl('div', { class: 'game-panel' });
  const stage = gEl('div', { style: { marginTop: '12px' } });

  const stopLoops = () => {
    if (timer) { clearInterval(timer); timer = null; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (micStream) { micStream.getTracks?.().forEach(t => t.stop()); micStream = null; }
  };

  // --- Mode 1: Song Maker ---
  const renderSongMaker = () => {
    stopLoops();
    const cols = 16;
    const rows = 14;
    let bpm = 120;
    let scaleName = 'Major';
    let inst = 'triangle';
    let playing = false;
    let step = 0;
    const grid = Array.from({ length: rows }, () => Array(cols).fill(false));
    const drums = Array.from({ length: 2 }, () => Array(cols).fill(false));
    // Cute starter melody
    [0, 2, 4, 7, 9, 11, 12, 14].forEach((c, i) => { grid[rows - 1 - (i % 7)][c] = true; });
    [0, 4, 8, 12].forEach(c => { drums[0][c] = true; });
    [2, 6, 10, 14].forEach(c => { drums[1][c] = true; });

    const getRowMidi = r => {
      const intervals = SCALES[scaleName] || SCALES.Major;
      const idx = rows - 1 - r;
      const oct = Math.floor(idx / intervals.length);
      const deg = intervals[idx % intervals.length];
      return 60 + oct * 12 + deg;
    };

    const gridWrap = gEl('div', { style: { overflowX: 'auto', padding: '10px', borderRadius: '16px', background: '#fff9ec', border: '3px solid #4f2f23' } });
    const cells = [];
    const drumCells = [];

    const paintGrid = () => {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const btn = cells[r][c];
          const on = grid[r][c];
          const activeCol = playing && c === step;
          btn.style.background = on ? LAB_COLORS[(rows - 1 - r) % LAB_COLORS.length] : (c % 4 === 0 ? '#f6ebd5' : '#fffdf8');
          btn.style.transform = activeCol ? 'scale(1.08)' : 'scale(1)';
          btn.style.boxShadow = activeCol ? '0 0 0 2px #4f2f23' : 'none';
        }
      }
      for (let d = 0; d < 2; d++) {
        for (let c = 0; c < cols; c++) {
          const btn = drumCells[d][c];
          const on = drums[d][c];
          const activeCol = playing && c === step;
          btn.style.background = on ? (d === 0 ? '#e78167' : '#82bbb6') : (c % 4 === 0 ? '#f6ebd5' : '#fffdf8');
          btn.style.boxShadow = activeCol ? '0 0 0 2px #4f2f23' : 'none';
        }
      }
    };

    const table = gEl('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(26px, 1fr))`, gap: '4px', minWidth: '480px' } });
    for (let r = 0; r < rows; r++) {
      cells[r] = [];
      for (let c = 0; c < cols; c++) {
        const b = gEl('button', {
          type: 'button',
          class: 'gbtn',
          'aria-label': `Note row ${r + 1} step ${c + 1}`,
          style: { padding: '0', height: '24px', minHeight: '24px', borderRadius: '6px', border: '2px solid #d5bfa3' },
          onClick: () => {
            grid[r][c] = !grid[r][c];
            if (grid[r][c]) audio.playTone(midiToFreq(getRowMidi(r)), { type: inst, duration: 0.25 });
            paintGrid();
          }
        });
        cells[r][c] = b;
        table.append(b);
      }
    }
    const drumBar = gEl('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(26px, 1fr))`, gap: '4px', marginTop: '8px', paddingTop: '8px', borderTop: '2.5px dashed #d5bfa3', minWidth: '480px' } });
    for (let d = 0; d < 2; d++) {
      drumCells[d] = [];
      for (let c = 0; c < cols; c++) {
        const b = gEl('button', {
          type: 'button',
          class: 'gbtn',
          'aria-label': `Drum ${d === 0 ? 'Kick' : 'Snare'} step ${c + 1}`,
          style: { padding: '0', height: '22px', minHeight: '22px', borderRadius: d === 0 ? '999px' : '5px', border: '2px solid #c9b091' },
          onClick: () => {
            drums[d][c] = !drums[d][c];
            if (drums[d][c]) audio.playDrum(d === 0 ? 'kick' : 'snare');
            paintGrid();
          }
        });
        drumCells[d][c] = b;
        drumBar.append(b);
      }
    }
    gridWrap.append(table, drumBar);
    paintGrid();

    const tick = () => {
      for (let r = 0; r < rows; r++) {
        if (grid[r][step]) audio.playTone(midiToFreq(getRowMidi(r)), { type: inst, duration: (60 / bpm) * 0.65, gain: 0.16 });
      }
      if (drums[0][step]) audio.playDrum('kick');
      if (drums[1][step]) audio.playDrum('snare');
      paintGrid();
      step = (step + 1) % cols;
    };

    const playBtn = gameBtn('▶ Play Song', 'primary', () => {
      playing = !playing;
      playBtn.textContent = playing ? '⏹ Stop' : '▶ Play Song';
      if (playing) {
        step = 0;
        tick();
        timer = setInterval(tick, (60 / bpm / 2) * 1000);
      } else {
        stopLoops();
        paintGrid();
      }
    });

    const scaleTabs = gameTabs(['Major', 'Pentatonic', 'Minor', 'Blues', 'Chromatic'], scaleName, v => { scaleName = v; }, 'Scale');
    const instTabs = gameTabs([['triangle', 'Marimba'], ['sine', 'Bell'], ['sawtooth', 'Synth'], ['square', '8-Bit']], inst, v => { inst = v; }, 'Instrument');
    const bpmSlider = gameSlider({
      label: 'Tempo', min: 60, max: 180, step: 5, value: bpm, unit: ' BPM',
      onChange: v => {
        bpm = v;
        if (playing) { clearInterval(timer); timer = setInterval(tick, (60 / bpm / 2) * 1000); }
      }
    });

    const exportWavBtn = gameBtn('⬇ Export WAV', '', () => {
      const sr = 22050;
      const stepSec = 60 / bpm / 2;
      const total = Math.floor(cols * stepSec * sr);
      const out = new Float32Array(total);
      for (let c = 0; c < cols; c++) {
        const start = Math.floor(c * stepSec * sr);
        for (let r = 0; r < rows; r++) {
          if (!grid[r][c]) continue;
          const freq = midiToFreq(getRowMidi(r));
          const len = Math.floor(stepSec * 0.9 * sr);
          for (let i = 0; i < len && start + i < total; i++) {
            const env = Math.exp(-i / (sr * 0.12));
            out[start + i] += Math.sin(2 * Math.PI * freq * (i / sr)) * 0.16 * env;
          }
        }
        if (drums[0][c]) {
          for (let i = 0; i < Math.floor(0.14 * sr) && start + i < total; i++) {
            const t = i / sr;
            out[start + i] += Math.sin(2 * Math.PI * (120 * Math.exp(-t * 16) + 35) * t) * 0.32 * Math.exp(-t * 12);
          }
        }
        if (drums[1][c]) {
          for (let i = 0; i < Math.floor(0.08 * sr) && start + i < total; i++) {
            out[start + i] += (Math.random() * 2 - 1) * 0.15 * Math.exp(-(i / sr) * 35);
          }
        }
      }
      triggerFileDownload(encodeWavFromSamples(out, sr), 'waffle-song-maker.wav', 'audio/wav');
    });

    const randomBtn = gameBtn('🎲 Randomize', '', () => {
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) grid[r][c] = Math.random() < 0.11;
      for (let c = 0; c < cols; c++) { drums[0][c] = c % 4 === 0 || Math.random() < 0.18; drums[1][c] = c % 4 === 2; }
      paintGrid();
    });
    const clearBtn = gameBtn('Clear', '', () => {
      for (let r = 0; r < rows; r++) grid[r].fill(false);
      drums[0].fill(false); drums[1].fill(false);
      paintGrid();
    });

    stage.replaceChildren(
      gEl('div', { class: 'tool-row', style: { flexWrap: 'wrap', gap: '8px' } }, playBtn, randomBtn, clearBtn, exportWavBtn),
      gEl('div', { class: 'tool-row', style: { flexWrap: 'wrap', gap: '10px', marginTop: '8px' } }, scaleTabs.el, instTabs.el),
      bpmSlider.el,
      gridWrap
    );
  };

  // --- Mode 2: Kandinsky (Draw shapes that become music!) ---
  const renderKandinsky = () => {
    stopLoops();
    const canvas = gEl('canvas', { width: 640, height: 320, style: { width: '100%', maxHeight: '320px', borderRadius: '16px', border: '3px solid #4f2f23', background: '#fffdf7', cursor: 'crosshair', touchAction: 'none' } });
    const ctx = canvas.getContext('2d');
    const shapes = [];
    let drawing = null;
    let color = '#e78167';
    let playing = false;
    let playX = 0;

    const redraw = () => {
      ctx.fillStyle = '#fffdf7';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (const s of shapes) {
        ctx.strokeStyle = s.color;
        ctx.fillStyle = s.color;
        ctx.lineWidth = 5;
        if (s.kind === 'circle') {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#4f2f23';
          ctx.lineWidth = 3;
          ctx.stroke();
        } else if (s.pts?.length > 1) {
          ctx.beginPath();
          ctx.moveTo(s.pts[0].x, s.pts[0].y);
          for (let i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i].x, s.pts[i].y);
          ctx.stroke();
        }
      }
      if (playing) {
        ctx.strokeStyle = '#4f2f23';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(playX, 0);
        ctx.lineTo(playX, canvas.height);
        ctx.stroke();
      }
    };
    redraw();

    const getPos = e => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX ?? rect.left) - rect.left) * (canvas.width / Math.max(1, rect.width)),
        y: ((e.clientY ?? rect.top) - rect.top) * (canvas.height / Math.max(1, rect.height))
      };
    };

    canvas.addEventListener('pointerdown', e => {
      const p = getPos(e);
      drawing = { kind: 'line', color, pts: [p], startTime: Date.now() };
      shapes.push(drawing);
      const midi = Math.round(78 - (p.y / canvas.height) * 28);
      audio.playTone(midiToFreq(midi), { type: 'sine', duration: 0.2 });
    });
    canvas.addEventListener('pointermove', e => {
      if (!drawing) return;
      const p = getPos(e);
      drawing.pts.push(p);
      redraw();
    });
    canvas.addEventListener('pointerup', e => {
      if (!drawing) return;
      const p = getPos(e);
      const dist = Math.hypot(p.x - drawing.pts[0].x, p.y - drawing.pts[0].y);
      if (drawing.pts.length < 6 && dist < 18) {
        shapes.pop();
        shapes.push({ kind: 'circle', x: p.x, y: p.y, r: 18 + Math.random() * 14, color });
        audio.playDrum('kick');
      }
      drawing = null;
      redraw();
    });

    const playBtn = gameBtn('▶ Play Drawing', 'primary', () => {
      playing = !playing;
      playBtn.textContent = playing ? '⏹ Stop' : '▶ Play Drawing';
      if (!playing) { stopLoops(); redraw(); return; }
      playX = 0;
      const triggered = new Set();
      timer = setInterval(() => {
        playX += 8;
        if (playX >= canvas.width) { playX = 0; triggered.clear(); }
        shapes.forEach((s, idx) => {
          const sx = s.kind === 'circle' ? s.x : s.pts[0]?.x || 0;
          if (!triggered.has(idx) && Math.abs(sx - playX) < 10) {
            triggered.add(idx);
            if (s.kind === 'circle') audio.playDrum(s.y > 160 ? 'kick' : 'snare');
            else {
              const sy = s.pts[0]?.y || 160;
              audio.playTone(midiToFreq(Math.round(80 - (sy / canvas.height) * 30)), { type: 'triangle', duration: 0.3 });
            }
          }
        });
        redraw();
      }, 30);
    });

    const picker = gameColorPicker(color, c => { color = c; }, 'Brush Color');
    const clr = gameBtn('Clear Canvas', '', () => { shapes.length = 0; redraw(); });
    stage.replaceChildren(
      gEl('p', { class: 'tool-note', text: 'Draw squiggles for pitched melodies or tap anywhere for percussion circles — then hit Play!' }),
      gEl('div', { class: 'tool-row', style: { gap: '8px', flexWrap: 'wrap' } }, playBtn, clr),
      picker.el,
      canvas
    );
  };

  // --- Mode 3: Rhythm (4-Beat Drum Toy) ---
  const renderRhythm = () => {
    stopLoops();
    const tracks = ['kick', 'snare', 'hihat', 'clap'];
    const labels = ['🥁 Kick', '🪘 Snare', '✨ Hi-Hat', '👏 Clap'];
    const steps = 8;
    const pat = Array.from({ length: 4 }, (_, r) => Array.from({ length: steps }, (__, c) => (r === 0 && c % 4 === 0) || (r === 1 && c % 4 === 2) || (r === 2 && c % 2 === 1)));
    let cur = 0;
    let playing = false;
    const wrap = gEl('div', { style: { display: 'grid', gap: '8px', marginTop: '10px' } });
    const btns = [];

    const draw = () => {
      tracks.forEach((_, r) => {
        for (let c = 0; c < steps; c++) {
          const b = btns[r][c];
          b.style.background = pat[r][c] ? LAB_COLORS[r] : '#fff9ec';
          b.style.transform = playing && c === cur ? 'scale(1.1)' : 'scale(1)';
          b.style.boxShadow = playing && c === cur ? '0 0 0 2px #4f2f23' : 'none';
        }
      });
    };
    tracks.forEach((tr, r) => {
      btns[r] = [];
      const row = gEl('div', { style: { display: 'grid', gridTemplateColumns: '95px repeat(8, 1fr)', gap: '6px', alignItems: 'center' } },
        gEl('strong', { text: labels[r], style: { fontSize: '13px' } })
      );
      for (let c = 0; c < steps; c++) {
        const b = gEl('button', {
          type: 'button', class: 'gbtn', style: { height: '38px', borderRadius: '10px', border: '2.5px solid #4f2f23' },
          onClick: () => { pat[r][c] = !pat[r][c]; if (pat[r][c]) audio.playDrum(tr); draw(); }
        });
        btns[r][c] = b;
        row.append(b);
      }
      wrap.append(row);
    });
    draw();

    const playBtn = gameBtn('▶ Play Rhythm', 'primary', () => {
      playing = !playing;
      playBtn.textContent = playing ? '⏹ Stop' : '▶ Play Rhythm';
      if (!playing) { stopLoops(); draw(); return; }
      cur = 0;
      const stepFn = () => {
        tracks.forEach((tr, r) => { if (pat[r][cur]) audio.playDrum(tr); });
        draw();
        cur = (cur + 1) % steps;
      };
      stepFn();
      timer = setInterval(stepFn, 220);
    });
    stage.replaceChildren(playBtn, wrap);
  };

  // --- Mode 4: Chords & Arpeggio ---
  const renderChords = () => {
    stopLoops();
    let root = 60;
    let qual = 'Major';
    const formulas = { Major: [0, 4, 7], Minor: [0, 3, 7], '7th': [0, 4, 7, 10], Maj7: [0, 4, 7, 11], Sus4: [0, 5, 7], Dim: [0, 3, 6] };
    const info = statBox('Active Chord', 'C Major (C - E - G)');

    const playChord = (arp = false) => {
      const notes = (formulas[qual] || [0, 4, 7]).map(iv => root + iv);
      info.set(`${NOTE_NAMES[root % 12]} ${qual} (${notes.map(midiToName).join(' - ')})`);
      notes.forEach((m, i) => audio.playTone(midiToFreq(m), { type: 'triangle', duration: 0.7, when: arp ? i * 0.11 : 0, gain: 0.18 }));
    };

    const rootTabs = gameTabs(NOTE_NAMES.map((n, i) => [String(60 + i), n]), String(root), v => { root = Number(v); playChord(false); }, 'Root Note');
    const qualTabs = gameTabs(Object.keys(formulas), qual, v => { qual = v; playChord(false); }, 'Chord Quality');
    stage.replaceChildren(
      rootTabs.el,
      qualTabs.el,
      gEl('div', { class: 'tool-row', style: { gap: '8px', marginTop: '8px' } },
        gameBtn('🎹 Strum Chord', 'primary', () => playChord(false)),
        gameBtn('✨ Arpeggiate', '', () => playChord(true))
      ),
      info.el
    );
  };

  // --- Mode 5: Harmonic Spectrogram ---
  const renderSpectro = () => {
    stopLoops();
    const canvas = gEl('canvas', { width: 600, height: 220, style: { width: '100%', maxHeight: '220px', borderRadius: '14px', border: '3px solid #4f2f23', background: '#241814' } });
    const ctx = canvas.getContext('2d');
    const bars = Array.from({ length: 16 }, (_, i) => (i === 0 ? 1 : 0.45 / (i + 1)));
    let baseFreq = 220;

    const drawBars = () => {
      ctx.fillStyle = '#241814';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const bw = canvas.width / bars.length;
      bars.forEach((v, i) => {
        const h = Math.max(8, v * (canvas.height - 28));
        ctx.fillStyle = LAB_COLORS[i % LAB_COLORS.length];
        ctx.fillRect(i * bw + 6, canvas.height - h - 10, bw - 12, h);
      });
    };
    drawBars();

    const playHarmonics = () => {
      bars.forEach((amp, i) => {
        if (amp > 0.04) audio.playTone(baseFreq * (i + 1), { type: 'sine', duration: 0.6, gain: amp * 0.16 });
      });
    };

    canvas.addEventListener('pointerdown', e => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX ?? rect.left) - rect.left) / Math.max(1, rect.width);
      const y = ((e.clientY ?? rect.top) - rect.top) / Math.max(1, rect.height);
      const idx = Math.max(0, Math.min(bars.length - 1, Math.floor(x * bars.length)));
      bars[idx] = Math.max(0.02, Math.min(1, 1 - y));
      drawBars();
      playHarmonics();
    });

    const freqSlider = gameSlider({ label: 'Fundamental Pitch', min: 110, max: 660, step: 5, value: baseFreq, unit: ' Hz', onChange: v => { baseFreq = v; } });
    stage.replaceChildren(
      gEl('p', { class: 'tool-note', text: 'Click or drag harmonic bars to sculpt your own synthesizer timbre!' }),
      freqSlider.el,
      gameBtn('🔊 Play Additive Synth', 'primary', playHarmonics),
      canvas
    );
  };

  // --- Mode 6: The Bench (experimental, new in 1.3 TVBR 3) ---
  /**
   * A bench rather than a finished tool, and labelled that way on screen.
   *
   * The Song Maker is a drawing surface where every cell is a decision somebody
   * made. This is the other idea: a seeded composer that writes a tune through the
   * scale, and four sliders that change how it is *played* rather than what it
   * says — swing, humanise, an automatic bass, and a spectrum of the lab's own
   * output. It does not reuse the Song Maker's grid on purpose; the two are
   * answering different questions and a merged control panel would be worse at
   * both.
   */
  const renderBench = () => {
    stopLoops();
    const steps = 16;
    const rows = 14;
    let scaleName = bench.scale;
    let inst = bench.inst;
    let bpm = bench.bpm;
    let density = bench.density;
    let swing = bench.swing;
    let humanise = bench.humanise;
    let seed = bench.seed;
    let bassOn = bench.bass;
    let playing = false;
    let step = 0;
    let lastRow = Math.floor(rows / 2);

    const getRowMidi = r => {
      const intervals = SCALES[scaleName] || SCALES.Major;
      const idx = rows - 1 - r;
      const oct = Math.floor(idx / intervals.length);
      const deg = intervals[idx % intervals.length];
      return 60 + oct * 12 + deg;
    };

    /**
     * mulberry32. The composer is seeded on purpose: a bench code hands somebody
     * the same tune, not a similar one.
     *
     * The state has to live in the closure and be *mutated* by each call. Written
     * the obvious-looking way — re-deriving it from the seed inside the returned
     * function — every call returns the same number, and a seed whose one number
     * falls under the rest threshold composes sixteen rests and plays silence.
     */
    const makeRng = seed0 => {
      let s = seed0 >>> 0;
      return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    };

    /**
     * A tune, not a grid full of dice.
     *
     * The Randomize button on the Song Maker is uniform noise, which is why nobody
     * plays it twice. This walks the scale instead: mostly steps with a leap now
     * and then, rests that get more likely as the phrase fills so `density` means
     * something, a slow arch up in the first half and back down in the second, and
     * a last note on the tonic — because an ear reads degree zero as a full stop
     * and a phrase that ends anywhere else sounds like it was cut off.
     */
    const compose = () => {
      const rand = makeRng(seed);
      const want = Math.max(2, Math.round((density / 10) * steps * 0.85));
      const out = Array(steps).fill(null);
      let row = Math.floor(rows / 2);
      let dir = rand() < 0.5 ? 1 : -1;
      let placed = 0;
      for (let c = 0; c < steps; c++) {
        if (placed >= want || rand() < 0.16 + (placed / want) * 0.22) continue;
        // Momentum, not a coin per note. A melody runs in one direction for a
        // couple of steps and then turns; picking the direction afresh every time
        // is what made the first version of this oscillate between two adjacent
        // degrees, which is less a tune than two notes arguing.
        if (rand() < 0.3) dir = -dir;
        const leap = rand() < 0.18 ? (rand() < 0.6 ? 2 : 3) : 1;
        const arch = c < steps / 2 ? 1 : -1;
        const nudge = rand() < 0.25 ? arch : 0;
        let next = row + dir * leap + nudge;
        // Turn round at the top and bottom rather than grinding along the edge.
        if (next < 0 || next > rows - 1) {
          dir = -dir;
          next = Math.max(0, Math.min(rows - 1, row + dir * leap));
        }
        row = next;
        out[c] = row;
        lastRow = row;
        placed += 1;
      }
      if (placed) {
        // Land on the tonic, but on the *nearest* one: degree zero reads as a full
        // stop wherever it sits, and a phrase that leaps two octaves down to find
        // it sounds like it was cut off mid-sentence.
        const perOctave = (SCALES[scaleName] || SCALES.Major).length;
        const last = out[steps - 2] === null || out[steps - 2] === undefined ? lastRow : out[steps - 2];
        const tonics = [rows - 1, rows - 1 - perOctave, rows - 1 - 2 * perOctave].filter(r => r >= 0 && r < rows);
        out[steps - 1] = tonics.reduce((best, r) => (Math.abs(r - last) < Math.abs(best - last) ? r : best), tonics[0]);
      }
      // A bench that composes silence is a bug wearing a seed's clothes. With a
      // real walk this needs about one seed in ten thousand, and it is cheaper to
      // guarantee a phrase than to explain an empty strip.
      if (!placed) {
        out[0] = rows - 1;
        out[4] = Math.max(0, rows - 3);
        out[8] = rows - 1;
        out[steps - 1] = rows - 1;
      }
      return out;
    };

    let pattern = Array.isArray(bench.pattern) && bench.pattern.length === steps
      ? bench.pattern.slice()
      : compose();
    bench.pattern = pattern;

    const describe = () => {
      const notes = pattern.filter(r => r !== null).length;
      return notes + (notes === 1 ? ' note' : ' notes') + ' in ' + scaleName +
        ', seed ' + seed + ' · swing ' + swing + '% · humanise ' + humanise + '%' +
        (bassOn ? ' · auto bass on' : '');
    };

    const readout = gEl('p', { class: 'bench-readout', role: 'status' });

    const strip = gEl('div', {
      class: 'bench-strip', role: 'group',
      'aria-label': 'Generated steps. Tap a step to add or remove its note.'
    });
    const cells = [];
    for (let c = 0; c < steps; c++) {
      const b = gEl('button', {
        type: 'button', class: 'bench-cell',
        onClick: () => {
          if (pattern[c] === null) pattern[c] = lastRow;
          else { lastRow = pattern[c]; pattern[c] = null; }
          bench.pattern = pattern;
          paint();
        }
      });
      cells.push(b);
      strip.append(b);
    }

    const paint = () => {
      for (let c = 0; c < steps; c++) {
        const cell = cells[c];
        const row = pattern[c];
        const name = row === null ? '·' : midiToName(getRowMidi(row));
        cell.textContent = name;
        cell.style.background = row === null ? '#fffdf8' : LAB_COLORS[row % LAB_COLORS.length];
        cell.classList.toggle('is-live', playing && c === step);
        cell.setAttribute('aria-label', 'Step ' + (c + 1) + (row === null ? ', rest' : ', ' + name));
      }
      readout.textContent = describe();
    };

    // The spectrum of the lab's own output, through the bus in createAudioEngine.
    const scope = gEl('canvas', { class: 'bench-scope', width: 640, height: 110, 'aria-hidden': 'true' });
    const drawScope = () => {
      if (typeof requestAnimationFrame !== 'function') return;
      rafId = requestAnimationFrame(drawScope);
      const g = scope.getContext('2d');
      if (!g) return;
      g.fillStyle = '#241814';
      g.fillRect(0, 0, scope.width, scope.height);
      const an = audio.getAnalyser ? audio.getAnalyser() : null;
      if (!an || typeof an.getByteFrequencyData !== 'function') {
        g.fillStyle = '#6b5a4d';
        g.fillRect(0, scope.height / 2, scope.width, 2);
        return;
      }
      const bins = new Uint8Array(an.frequencyBinCount);
      an.getByteFrequencyData(bins);
      const bw = scope.width / bins.length;
      for (let i = 0; i < bins.length; i++) {
        const h = Math.max(2, (bins[i] / 255) * (scope.height - 8));
        g.fillStyle = LAB_COLORS[i % LAB_COLORS.length];
        g.fillRect(i * bw, scope.height - h, Math.max(1, bw - 1), h);
      }
    };

    const tick = () => {
      const eighth = 60 / bpm / 2;
      // Swing pushes every other step late by a percentage of one step: the thing
      // a metronome-locked grid cannot do, and the reason the same notes stop
      // sounding like a typewriter somewhere around 25%.
      let when = step % 2 === 1 ? eighth * (swing / 100) : 0;
      let vel = 1;
      if (humanise > 0) {
        // Deliberately unseeded. This is the difference between two performances
        // of the same tune, so it must not repeat; the seed owns the notes.
        when = Math.max(0, when + (Math.random() - 0.5) * 2 * (humanise / 100) * eighth * 0.4);
        vel = 1 + (Math.random() - 0.5) * 2 * (humanise / 100) * 0.5;
      }
      const row = pattern[step];
      if (row !== null) {
        audio.playTone(midiToFreq(getRowMidi(row)), { type: inst, duration: eighth * 0.95, gain: 0.17 * vel, when });
      }
      if (bassOn && (step === 0 || step === 8)) {
        // Two octaves under the tonic, on the two steps a 16-bar phrase turns on.
        audio.playTone(midiToFreq(getRowMidi(rows - 1) - 24), { type: 'sine', duration: eighth * 1.7, gain: 0.19, when });
      }
      paint();
      step = (step + 1) % steps;
    };

    const playBtn = gameBtn('▶ Play Bench', 'primary', () => {
      playing = !playing;
      playBtn.textContent = playing ? '⏹ Stop' : '▶ Play Bench';
      if (playing) {
        step = 0;
        audio.ensure();
        tick();
        timer = setInterval(tick, (60 / bpm / 2) * 1000);
        drawScope();
      } else {
        stopLoops();
        paint();
        const g = scope.getContext('2d');
        if (g) { g.fillStyle = '#241814'; g.fillRect(0, 0, scope.width, scope.height); }
      }
    });

    const composeBtn = gameBtn('🎼 Compose', '', () => {
      pattern = compose();
      bench.pattern = pattern;
      paint();
    });
    const newSeedBtn = gameBtn('🎲 New seed', '', () => {
      seed = Math.floor(Math.random() * 100000);
      bench.seed = seed;
      pattern = compose();
      bench.pattern = pattern;
      paint();
    });

    /** The whole bench as one short line, so a tune travels without a file. The
     *  melody is not in it — the seed is, and the seed regenerates it exactly. */
    const benchCode = () => ['WL1', scaleName, inst, String(bpm), String(density),
      String(swing), String(humanise), String(seed), bassOn ? '1' : '0'].join('.');
    const copyBtn = gameBtn('⧉ Copy bench code', '', async () => {
      const code = benchCode();
      try {
        await copyToClipboard(code);
        readout.textContent = 'Copied: ' + code;
      } catch {
        readout.textContent = 'Copy was blocked — here it is: ' + code;
      }
    });

    const clampInt = (v, lo, hi, fall) => {
      const n = Number.parseInt(v, 10);
      return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fall;
    };
    const codeInput = gEl('input', {
      type: 'text', class: 'bench-code-input', placeholder: 'Paste a bench code (WL1.…)',
      'aria-label': 'Bench code to load', spellcheck: false
    });
    const loadBtn = gameBtn('Load code', '', () => {
      const parts = String(codeInput.value || '').trim().split('.');
      const bad = () => { readout.textContent = 'That is not a bench code. One looks like ' + benchCode(); };
      if (parts.length !== 9 || parts[0] !== 'WL1' || !(parts[1] in SCALES)) return bad();
      bench.scale = parts[1];
      bench.inst = parts[2];
      bench.bpm = clampInt(parts[3], 40, 240, bpm);
      bench.density = clampInt(parts[4], 1, 10, density);
      bench.swing = clampInt(parts[5], 0, 60, swing);
      bench.humanise = clampInt(parts[6], 0, 40, humanise);
      bench.seed = clampInt(parts[7], 0, 2147483647, seed);
      bench.bass = parts[8] === '1';
      bench.pattern = null;
      // Rebuild rather than poke values into live controls: every slider, tab and
      // toggle would otherwise be showing the previous setup while playing the new
      // one, which is the same class of lie this release is about.
      renderBench();
    });

    const scaleTabs = gameTabs(['Major', 'Pentatonic', 'Minor', 'Blues', 'Chromatic'], scaleName, v => {
      scaleName = v; bench.scale = v; paint();
    }, 'Scale');
    const instTabs = gameTabs([['triangle', 'Marimba'], ['sine', 'Bell'], ['sawtooth', 'Synth'], ['square', '8-Bit']], inst, v => {
      inst = v; bench.inst = v;
    }, 'Voice');
    const bassToggle = gameToggle('Auto bass', bassOn, v => { bassOn = v; bench.bass = v; paint(); });

    const bpmSlider = gameSlider({
      label: 'Tempo', min: 40, max: 200, step: 2, value: bpm, unit: ' BPM',
      onChange: v => {
        bpm = v; bench.bpm = v;
        if (playing) { clearInterval(timer); timer = setInterval(tick, (60 / bpm / 2) * 1000); }
      }
    });
    const densitySlider = gameSlider({
      label: 'Density', min: 1, max: 10, step: 1, value: density, unit: '/10',
      onChange: v => { density = v; bench.density = v; }
    });
    const swingSlider = gameSlider({
      label: 'Swing', min: 0, max: 60, step: 2, value: swing, unit: '%',
      onChange: v => { swing = v; bench.swing = v; paint(); }
    });
    const humaniseSlider = gameSlider({
      label: 'Humanise', min: 0, max: 40, step: 2, value: humanise, unit: '%',
      onChange: v => { humanise = v; bench.humanise = v; paint(); }
    });

    stage.replaceChildren(
      gEl('div', { class: 'bench-banner' },
        gEl('span', { class: 'bench-badge', text: '🧪 EXPERIMENTAL' }),
        gEl('p', {
          class: 'tool-note',
          text: 'A bench, not a finished tool: a seeded composer, swing and humanise on the timing, an automatic bass, and a spectrum of what the lab is actually playing. New, and likely to change. Everything runs on this device and nothing is uploaded.'
        })
      ),
      gEl('div', { class: 'tool-row', style: { flexWrap: 'wrap', gap: '8px' } }, playBtn, composeBtn, newSeedBtn, copyBtn),
      gEl('div', { class: 'tool-row', style: { flexWrap: 'wrap', gap: '10px', marginTop: '8px' } }, scaleTabs.el, instTabs.el, bassToggle.el),
      bpmSlider.el,
      densitySlider.el,
      swingSlider.el,
      humaniseSlider.el,
      readout,
      strip,
      scope,
      gEl('div', { class: 'tool-row', style: { flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginTop: '10px' } }, codeInput, loadBtn)
    );
    paint();
  };

  const modeTabs = gameTabs([
    ['song', '🎼 Song Maker'],
    ['kandinsky', '🎨 Kandinsky'],
    ['rhythm', '🥁 Rhythm'],
    ['chords', '🎹 Chords'],
    ['spectro', '🌈 Harmonics'],
    ['bench', '🧪 Experimental']
  ], mode, v => {
    mode = v;
    if (v === 'song') renderSongMaker();
    else if (v === 'kandinsky') renderKandinsky();
    else if (v === 'rhythm') renderRhythm();
    else if (v === 'chords') renderChords();
    else if (v === 'bench') renderBench();
    else renderSpectro();
  }, 'Waffle Music Lab Mode');

  panel.append(modeTabs.el, stage);
  root.replaceChildren(panel);
  renderSongMaker();

  return () => { stopLoops(); audio.close(); };
}

// 2. 808 Beat Maker
function mountBeatSequencer(root) {
  const audio = createAudioEngine();
  const tracks = [
    ['kick', 'Kick'],
    ['snare', 'Snare'],
    ['clap', 'Clap'],
    ['hihat', 'Closed Hat'],
    ['openhat', 'Open Hat'],
    ['bass', '808 Bass']
  ];
  const steps = 16;
  const grid = Array.from({ length: tracks.length }, () => Array(steps).fill(false));
  const loadPreset = name => {
    grid.forEach(r => r.fill(false));
    if (name === 'Hip-Hop') {
      [0, 3, 8, 10].forEach(i => { grid[0][i] = true; grid[5][i] = true; });
      [4, 12].forEach(i => { grid[1][i] = true; grid[2][i] = true; });
      for (let i = 0; i < 16; i += 2) grid[3][i] = true;
    } else if (name === 'House') {
      [0, 4, 8, 12].forEach(i => { grid[0][i] = true; });
      [4, 12].forEach(i => { grid[2][i] = true; });
      [2, 6, 10, 14].forEach(i => { grid[4][i] = true; });
      [1, 5, 9, 13].forEach(i => { grid[5][i] = true; });
    } else {
      [0, 6, 10].forEach(i => { grid[0][i] = true; });
      [4, 12].forEach(i => { grid[1][i] = true; });
      [0, 2, 4, 6, 8, 10, 12, 14].forEach(i => { grid[3][i] = true; });
    }
  };
  loadPreset('Hip-Hop');

  let bpm = 110;
  let playing = false;
  let step = 0;
  let timer = null;
  const cellBtns = [];
  const table = gEl('div', { style: { display: 'grid', gap: '6px', overflowX: 'auto', marginTop: '10px' } });

  const paint = () => {
    tracks.forEach((_, r) => {
      for (let c = 0; c < steps; c++) {
        const b = cellBtns[r][c];
        b.style.background = grid[r][c] ? LAB_COLORS[r % LAB_COLORS.length] : (c % 4 === 0 ? '#f4e6cf' : '#fff9ec');
        b.style.boxShadow = playing && c === step ? '0 0 0 2px #4f2f23' : 'none';
      }
    });
  };

  tracks.forEach(([id, label], r) => {
    cellBtns[r] = [];
    const row = gEl('div', { style: { display: 'grid', gridTemplateColumns: '94px repeat(16, minmax(22px, 1fr))', gap: '4px', alignItems: 'center', minWidth: '520px' } },
      gEl('span', { text: label, style: { fontWeight: '700', fontSize: '12px' } })
    );
    for (let c = 0; c < steps; c++) {
      const b = gEl('button', {
        type: 'button', class: 'gbtn', style: { height: '28px', minHeight: '28px', padding: '0', borderRadius: '7px', border: '2px solid #4f2f23' },
        onClick: () => { grid[r][c] = !grid[r][c]; if (grid[r][c]) audio.playDrum(id); paint(); }
      });
      cellBtns[r][c] = b;
      row.append(b);
    }
    table.append(row);
  });
  paint();

  const playBtn = gameBtn('▶ Play Beat', 'primary', () => {
    playing = !playing;
    playBtn.textContent = playing ? '⏹ Stop' : '▶ Play Beat';
    if (!playing) { clearInterval(timer); timer = null; paint(); return; }
    step = 0;
    const tick = () => {
      tracks.forEach(([id], r) => { if (grid[r][step]) audio.playDrum(id); });
      paint();
      step = (step + 1) % steps;
    };
    tick();
    timer = setInterval(tick, (60 / bpm / 4) * 1000);
  });

  const presetTabs = gameTabs(['Hip-Hop', 'House', 'Lo-Fi'], 'Hip-Hop', v => { loadPreset(v); paint(); }, 'Kit Preset');
  const bpmS = gameSlider({ label: 'BPM', min: 65, max: 170, step: 1, value: bpm, unit: ' BPM', onChange: v => { bpm = v; if (playing) { clearInterval(timer); timer = setInterval(() => { tracks.forEach(([id], r) => { if (grid[r][step]) audio.playDrum(id); }); paint(); step = (step + 1) % steps; }, (60 / bpm / 4) * 1000); } } });

  const panel = gEl('div', { class: 'game-panel' },
    gEl('div', { class: 'tool-row', style: { gap: '8px', flexWrap: 'wrap' } }, playBtn, gameBtn('Clear', '', () => { grid.forEach(r => r.fill(false)); paint(); })),
    presetTabs.el,
    bpmS.el,
    table
  );
  root.replaceChildren(panel);
  return () => { if (timer) clearInterval(timer); audio.close(); };
}

// 3. Chord Progression Builder
function mountChordProgression(root) {
  const audio = createAudioEngine();
  let keyIdx = 0;
  let style = 'Pop (I–V–vi–IV)';
  const styles = {
    'Pop (I–V–vi–IV)': [0, 7, 9, 5],
    'Jazz (ii–V–I–vi)': [2, 7, 0, 9],
    'Lo-Fi (IV–V–iii–vi)': [5, 7, 4, 9],
    'Epic (vi–IV–I–V)': [9, 5, 0, 7]
  };
  const padsWrap = gEl('div', { class: 'tool-row', style: { flexWrap: 'wrap', gap: '8px', marginTop: '10px' } });
  let timer = null;

  const chordNotes = semi => {
    const minorish = [2, 4, 9].includes(semi);
    const rootMidi = 60 + keyIdx + semi;
    return minorish ? [rootMidi, rootMidi + 3, rootMidi + 7, rootMidi + 10] : [rootMidi, rootMidi + 4, rootMidi + 7];
  };

  const renderPads = () => {
    padsWrap.replaceChildren();
    const prog = styles[style] || styles['Pop (I–V–vi–IV)'];
    prog.forEach((semi, idx) => {
      const notes = chordNotes(semi);
      const name = `${NOTE_NAMES[(keyIdx + semi) % 12]}${[2, 4, 9].includes(semi) ? 'm' : ''}`;
      padsWrap.append(gameBtn(`${idx + 1}. ${name} (${notes.map(midiToName).join(' ')})`, 'chip', () => {
        notes.forEach((m, i) => audio.playTone(midiToFreq(m), { type: 'triangle', duration: 0.75, when: i * 0.04, gain: 0.16 }));
      }));
    });
  };

  const playLoop = gameBtn('▶ Play Progression', 'primary', () => {
    if (timer) { clearInterval(timer); timer = null; playLoop.textContent = '▶ Play Progression'; return; }
    playLoop.textContent = '⏹ Stop Loop';
    let idx = 0;
    const prog = styles[style];
    const stepFn = () => {
      const notes = chordNotes(prog[idx]);
      notes.forEach((m, i) => audio.playTone(midiToFreq(m), { type: 'triangle', duration: 0.85, when: i * 0.03, gain: 0.15 }));
      idx = (idx + 1) % prog.length;
    };
    stepFn();
    timer = setInterval(stepFn, 950);
  });

  renderPads();
  const panel = gEl('div', { class: 'game-panel' },
    gameTabs(NOTE_NAMES.map((n, i) => [String(i), n]), '0', v => { keyIdx = Number(v); renderPads(); }, 'Key').el,
    gameTabs(Object.keys(styles), style, v => { style = v; renderPads(); }, 'Progression Formula').el,
    gEl('div', { class: 'tool-row', style: { marginTop: '8px' } }, playLoop),
    padsWrap
  );
  root.replaceChildren(panel);
  return () => { if (timer) clearInterval(timer); audio.close(); };
}

// 4. 2-Octave Poly Synth
function mountPianoSynth(root) {
  const audio = createAudioEngine();
  let wave = 'triangle';
  let decay = 0.45;
  let octave = 4;
  const lastNote = statBox('Last Played', 'Tap any key or press A–L');
  const keysWrap = gEl('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '10px' } });

  const buildKeys = () => {
    keysWrap.replaceChildren();
    const startMidi = (octave + 1) * 12;
    for (let i = 0; i < 25; i++) {
      const midi = startMidi + i;
      const name = midiToName(midi);
      const isSharp = name.includes('#');
      keysWrap.append(gEl('button', {
        type: 'button',
        class: 'gbtn',
        text: name,
        style: {
          minWidth: isSharp ? '36px' : '42px',
          height: isSharp ? '76px' : '104px',
          background: isSharp ? '#4f2f23' : '#fff9ec',
          color: isSharp ? '#fff9ec' : '#4f2f23',
          fontSize: '11px',
          padding: '6px 4px',
          alignSelf: 'flex-start'
        },
        onClick: () => {
          lastNote.set(`${name} (${midiToFreq(midi).toFixed(1)} Hz)`);
          audio.playTone(midiToFreq(midi), { type: wave, duration: decay, gain: 0.2 });
        }
      }));
    }
  };
  buildKeys();

  const keyMap = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14 };
  const onKey = e => {
    const semi = keyMap[e.key?.toLowerCase()];
    if (semi !== undefined && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
      const midi = (octave + 1) * 12 + semi;
      lastNote.set(`${midiToName(midi)} (${midiToFreq(midi).toFixed(1)} Hz)`);
      audio.playTone(midiToFreq(midi), { type: wave, duration: decay, gain: 0.2 });
    }
  };
  window.addEventListener?.('keydown', onKey);

  const panel = gEl('div', { class: 'game-panel' },
    gameTabs([['sine', 'Sine'], ['triangle', 'Triangle'], ['sawtooth', 'Saw'], ['square', 'Square']], wave, v => { wave = v; }, 'Oscillator').el,
    gameTabs([['3', 'Oct 3'], ['4', 'Oct 4'], ['5', 'Oct 5']], String(octave), v => { octave = Number(v); buildKeys(); }, 'Octave').el,
    gameSlider({ label: 'Release Tail', min: 0.1, max: 1.5, step: 0.05, value: decay, unit: 's', onChange: v => { decay = v; } }).el,
    lastNote.el,
    keysWrap
  );
  root.replaceChildren(panel);
  return () => { window.removeEventListener?.('keydown', onKey); audio.close(); };
}

// 5. Tap Tempo & Metronome
function mountMetronomePro(root) {
  const audio = createAudioEngine();
  let bpm = 120;
  let beats = 4;
  let running = false;
  let curBeat = 0;
  let timer = null;
  let taps = [];

  const bpmStat = statBox('Tempo', `${bpm} BPM`);
  const dotsWrap = gEl('div', { class: 'tool-row', style: { gap: '8px', margin: '10px 0' } });
  const renderDots = () => {
    dotsWrap.replaceChildren();
    for (let i = 0; i < beats; i++) {
      const active = running && i === curBeat;
      dotsWrap.append(gEl('div', {
        text: String(i + 1),
        style: {
          width: '38px', height: '38px', borderRadius: '999px', display: 'grid', placeItems: 'center',
          fontWeight: '700', border: '3px solid #4f2f23',
          background: active ? (i === 0 ? '#e78167' : '#ffe17d') : '#fff9ec'
        }
      }));
    }
  };
  renderDots();

  const restartTimer = () => {
    if (timer) clearInterval(timer);
    if (!running) return;
    const stepFn = () => {
      audio.playTone(curBeat === 0 ? 1050 : 740, { type: 'sine', duration: 0.06, gain: curBeat === 0 ? 0.3 : 0.18 });
      renderDots();
      curBeat = (curBeat + 1) % beats;
    };
    stepFn();
    timer = setInterval(stepFn, (60 / bpm) * 1000);
  };

  const toggleBtn = gameBtn('▶ Start Click', 'primary', () => {
    running = !running;
    toggleBtn.textContent = running ? '⏹ Stop Click' : '▶ Start Click';
    curBeat = 0;
    if (running) restartTimer();
    else { clearInterval(timer); timer = null; renderDots(); }
  });

  const bpmSlider = gameSlider({
    label: 'BPM', min: 30, max: 240, step: 1, value: bpm, unit: ' BPM',
    onChange: v => { bpm = v; bpmStat.set(`${bpm} BPM`); if (running) restartTimer(); }
  });

  const tapBtn = gameBtn('👆 Tap Tempo', '', () => {
    const now = Date.now();
    taps = taps.filter(t => now - t < 2500);
    taps.push(now);
    if (taps.length >= 2) {
      const diffs = taps.slice(1).map((t, i) => t - taps[i]);
      const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      bpm = Math.max(30, Math.min(240, Math.round(60000 / avg)));
      bpmSlider.value = bpm;
      bpmStat.set(`${bpm} BPM`);
      if (running) restartTimer();
    }
  });

  const panel = gEl('div', { class: 'game-panel' },
    gEl('div', { class: 'tool-row', style: { gap: '8px' } }, toggleBtn, tapBtn),
    gameTabs([['2', '2/4'], ['3', '3/4'], ['4', '4/4'], ['5', '5/4'], ['6', '6/8']], '4', v => { beats = Number(v); curBeat = 0; renderDots(); }, 'Time Signature').el,
    bpmSlider.el,
    bpmStat.el,
    dotsWrap
  );
  root.replaceChildren(panel);
  return () => { if (timer) clearInterval(timer); audio.close(); };
}

// 6. Chromatic Tuner & Reference
function mountGuitarTuner(root) {
  const audio = createAudioEngine();
  const tunings = {
    'Guitar Standard': [['E2', 82.41], ['A2', 110], ['D3', 146.83], ['G3', 196], ['B3', 246.94], ['E4', 329.63]],
    'Drop D': [['D2', 73.42], ['A2', 110], ['D3', 146.83], ['G3', 196], ['B3', 246.94], ['E4', 329.63]],
    'Ukulele (GCEA)': [['G4', 392], ['C4', 261.63], ['E4', 329.63], ['A4', 440]],
    'Bass 4-String': [['E1', 41.2], ['A1', 55], ['D2', 73.42], ['G2', 98]]
  };
  let tuning = 'Guitar Standard';
  let micStream = null;
  let rafId = null;
  const noteStat = statBox('Detected Pitch', 'Tap a string or start Mic Tuner');
  const stringsRow = gEl('div', { class: 'tool-row', style: { flexWrap: 'wrap', gap: '8px', marginTop: '8px' } });

  const renderStrings = () => {
    stringsRow.replaceChildren();
    (tunings[tuning] || []).forEach(([n, hz]) => {
      stringsRow.append(gameBtn(`🔊 ${n} (${hz} Hz)`, 'chip', () => {
        noteStat.set(`Reference: ${n} (${hz} Hz)`);
        audio.playTone(hz, { type: 'triangle', duration: 1.3, gain: 0.24 });
      }));
    });
  };
  renderStrings();

  const autoCorrelate = (buf, sr) => {
    let rms = 0;
    for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
    if (Math.sqrt(rms / buf.length) < 0.015) return -1;
    let bestOff = -1, bestCorr = 0;
    const minOff = Math.floor(sr / 1000), maxOff = Math.floor(sr / 65);
    for (let off = minOff; off <= maxOff; off++) {
      let corr = 0;
      for (let i = 0; i < buf.length - off; i++) corr += buf[i] * buf[i + off];
      if (corr > bestCorr) { bestCorr = corr; bestOff = off; }
    }
    return bestOff > 0 ? sr / bestOff : -1;
  };

  const micBtn = gameBtn('🎙 Start Mic Tuner', 'primary', async () => {
    if (micStream) {
      micStream.getTracks().forEach(t => t.stop());
      micStream = null;
      if (rafId) cancelAnimationFrame(rafId);
      micBtn.textContent = '🎙 Start Mic Tuner';
      return;
    }
    try {
      const c = audio.ensure();
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const src = c.createMediaStreamSource(micStream);
      const analyser = c.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      micBtn.textContent = '⏹ Stop Mic';
      const loop = () => {
        if (!micStream) return;
        analyser.getFloatTimeDomainData(buf);
        const hz = autoCorrelate(buf, c.sampleRate);
        if (hz > 0) {
          const midi = Math.round(69 + 12 * Math.log2(hz / 440));
          const target = midiToFreq(midi);
          const cents = Math.round(1200 * Math.log2(hz / target));
          noteStat.set(`${midiToName(midi)} · ${hz.toFixed(1)} Hz (${cents >= 0 ? '+' : ''}${cents} cents)`);
        }
        rafId = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      noteStat.set('Microphone unavailable — use reference string tones above!');
    }
  });

  const panel = gEl('div', { class: 'game-panel' },
    gameTabs(Object.keys(tunings), tuning, v => { tuning = v; renderStrings(); }, 'Instrument Tuning').el,
    stringsRow,
    gEl('div', { class: 'tool-row', style: { marginTop: '10px' } }, micBtn),
    noteStat.el
  );
  root.replaceChildren(panel);
  return () => {
    if (rafId) cancelAnimationFrame(rafId);
    if (micStream) micStream.getTracks().forEach(t => t.stop());
    audio.close();
  };
}

// 7. Circle of Fifths
function mountCircleOfFifths(root) {
  const audio = createAudioEngine();
  const fifths = [
    ['C', 'Am', '0♯/♭', 60], ['G', 'Em', '1♯', 67], ['D', 'Bm', '2♯', 62],
    ['A', 'F#m', '3♯', 69], ['E', 'C#m', '4♯', 64], ['B', 'G#m', '5♯', 71],
    ['F#', 'D#m', '6♯', 66], ['Db', 'Bbm', '5♭', 61], ['Ab', 'Fm', '4♭', 68],
    ['Eb', 'Cm', '3♭', 63], ['Bb', 'Gm', '2♭', 70], ['F', 'Dm', '1♭', 65]
  ];
  const keyInfo = statBox('Selected Key', 'C Major / A Minor (0♯/♭)');
  const row = gEl('div', { class: 'tool-row', style: { flexWrap: 'wrap', gap: '8px', marginTop: '8px' } });
  fifths.forEach(([maj, min, sig, midi]) => {
    row.append(gameBtn(`${maj} (${min})`, 'chip', () => {
      keyInfo.set(`${maj} Major / ${min} · Key Signature: ${sig}`);
      [0, 4, 7].forEach((iv, i) => audio.playTone(midiToFreq(midi + iv), { type: 'triangle', duration: 0.7, when: i * 0.05 }));
    }));
  });
  const panel = gEl('div', { class: 'game-panel' },
    gEl('p', { class: 'tool-note', text: 'Tap any key on the Circle of Fifths to hear its Major triad and view its relative minor & key signature.' }),
    keyInfo.el,
    row
  );
  root.replaceChildren(panel);
  return () => audio.close();
}

// 8. Scale & Mode Finder
function mountScaleFinder(root) {
  const audio = createAudioEngine();
  let rootIdx = 0;
  let scale = 'Major';
  const notesBox = statBox('Scale Notes', 'C – D – E – F – G – A – B');
  const keysRow = gEl('div', { class: 'tool-row', style: { flexWrap: 'wrap', gap: '6px', marginTop: '8px' } });

  const refresh = () => {
    const ivs = SCALES[scale] || SCALES.Major;
    const names = ivs.map(iv => NOTE_NAMES[(rootIdx + iv) % 12]);
    notesBox.set(names.join(' – '));
    keysRow.replaceChildren();
    ivs.forEach(iv => {
      const m = 60 + rootIdx + iv;
      keysRow.append(gameBtn(midiToName(m), 'chip', () => audio.playTone(midiToFreq(m), { type: 'triangle', duration: 0.4 })));
    });
  };
  refresh();

  const panel = gEl('div', { class: 'game-panel' },
    gameTabs(NOTE_NAMES.map((n, i) => [String(i), n]), '0', v => { rootIdx = Number(v); refresh(); }, 'Root').el,
    gameTabs(Object.keys(SCALES), scale, v => { scale = v; refresh(); }, 'Mode / Scale').el,
    gameBtn('▶ Play Ascending Scale', 'primary', () => {
      const ivs = SCALES[scale] || SCALES.Major;
      [...ivs, 12].forEach((iv, idx) => audio.playTone(midiToFreq(60 + rootIdx + iv), { type: 'triangle', duration: 0.25, when: idx * 0.16 }));
    }),
    notesBox.el,
    keysRow
  );
  root.replaceChildren(panel);
  return () => audio.close();
}

// 9. Waveform & Spectrum Lab
function mountAudioVisualizer(root) {
  const audio = createAudioEngine();
  let mode = 'bars';
  let rafId = null;
  let phase = 0;
  let audioEl = null;
  let analyser = null;
  const canvas = gEl('canvas', { width: 640, height: 240, style: { width: '100%', maxHeight: '240px', borderRadius: '14px', border: '3px solid #4f2f23', background: '#261814', marginTop: '10px' } });
  const ctx = canvas.getContext('2d');
  const bins = new Uint8Array(64);

  const draw = () => {
    ctx.fillStyle = '#261814';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (analyser) {
      analyser.getByteFrequencyData(bins);
    } else {
      phase += 0.06;
      for (let i = 0; i < bins.length; i++) {
        bins[i] = Math.round(90 + 80 * Math.sin(phase + i * 0.35) * Math.cos(phase * 0.5 + i * 0.1));
      }
    }
    if (mode === 'bars') {
      const bw = canvas.width / bins.length;
      for (let i = 0; i < bins.length; i++) {
        const h = (bins[i] / 255) * (canvas.height - 20);
        ctx.fillStyle = LAB_COLORS[i % LAB_COLORS.length];
        ctx.fillRect(i * bw + 1, canvas.height - h, bw - 2, h);
      }
    } else if (mode === 'mirror') {
      const bw = canvas.width / bins.length;
      const mid = canvas.height / 2;
      for (let i = 0; i < bins.length; i++) {
        const h = (bins[i] / 255) * (mid - 12);
        ctx.fillStyle = LAB_COLORS[i % LAB_COLORS.length];
        ctx.fillRect(i * bw + 1, mid - h, bw - 2, h * 2);
      }
    } else {
      const cx = canvas.width / 2, cy = canvas.height / 2;
      for (let i = 0; i < bins.length; i++) {
        const ang = (i / bins.length) * Math.PI * 2;
        const r = 34 + (bins[i] / 255) * 76;
        ctx.strokeStyle = LAB_COLORS[i % LAB_COLORS.length];
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * 30, cy + Math.sin(ang) * 30);
        ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
        ctx.stroke();
      }
    }
    rafId = requestAnimationFrame(draw);
  };
  draw();

  const filePill = gameFilePill('Load Audio (.mp3/.wav/.ogg)', 'audio/*', false, async files => {
    const file = files?.[0];
    if (!file) return;
    const c = audio.ensure();
    if (!c) return;
    if (audioEl) { audioEl.pause(); audioEl = null; }
    audioEl = new Audio(URL.createObjectURL(file));
    audioEl.crossOrigin = 'anonymous';
    const src = c.createMediaElementSource(audioEl);
    analyser = c.createAnalyser();
    analyser.fftSize = 128;
    src.connect(analyser);
    analyser.connect(c.destination);
    audioEl.play().catch(() => {});
  });

  const panel = gEl('div', { class: 'game-panel' },
    gameTabs([['bars', 'Spectrum Bars'], ['mirror', 'Mirror Wave'], ['radial', 'Radial Burst']], mode, v => { mode = v; }, 'Visualizer Style').el,
    gEl('div', { class: 'tool-row', style: { gap: '8px', marginTop: '8px' } }, filePill.el, gameBtn('⏸ Pause/Play', '', () => { if (audioEl) audioEl.paused ? audioEl.play() : audioEl.pause(); })),
    canvas
  );
  root.replaceChildren(panel);
  return () => {
    if (rafId) cancelAnimationFrame(rafId);
    if (audioEl) audioEl.pause();
    audio.close();
  };
}

// 10. 8-Bit SFX Maker
function mountSfxCreator(root) {
  const audio = createAudioEngine();
  let startHz = 520;
  let endHz = 960;
  let dur = 0.25;
  let wave = 'square';

  const presets = {
    Coin: [987, 1318, 0.22, 'square'],
    Jump: [220, 680, 0.24, 'square'],
    Laser: [1100, 140, 0.2, 'sawtooth'],
    Powerup: [330, 1180, 0.45, 'triangle']
  };
  const s1 = gameSlider({ label: 'Start Pitch', min: 60, max: 1800, step: 10, value: startHz, unit: ' Hz', onChange: v => { startHz = v; } });
  const s2 = gameSlider({ label: 'End Pitch', min: 60, max: 1800, step: 10, value: endHz, unit: ' Hz', onChange: v => { endHz = v; } });
  const s3 = gameSlider({ label: 'Duration', min: 0.08, max: 0.8, step: 0.02, value: dur, unit: 's', onChange: v => { dur = v; } });
  const wTabs = gameTabs([['square', 'Square'], ['sawtooth', 'Saw'], ['triangle', 'Triangle'], ['sine', 'Sine']], wave, v => { wave = v; }, 'Wave');

  const panel = gEl('div', { class: 'game-panel' },
    gameTabs(Object.keys(presets), 'Coin', v => {
      const [a, b, d, w] = presets[v];
      startHz = a; endHz = b; dur = d; wave = w;
      s1.value = a; s2.value = b; s3.value = d; wTabs.value = w;
      audio.playTone(startHz, { type: wave, duration: dur, slideTo: endHz });
    }, 'Retro Preset').el,
    wTabs.el, s1.el, s2.el, s3.el,
    gEl('div', { class: 'tool-row', style: { gap: '8px', marginTop: '8px' } },
      gameBtn('▶ Play SFX', 'primary', () => audio.playTone(startHz, { type: wave, duration: dur, slideTo: endHz })),
      gameBtn('⬇ Export WAV', '', () => {
        const sr = 22050;
        const n = Math.floor(dur * sr);
        const samples = new Float32Array(n);
        let phase = 0;
        for (let i = 0; i < n; i++) {
          const p = i / n;
          const f = startHz * Math.pow(endHz / Math.max(1, startHz), p);
          phase += (2 * Math.PI * f) / sr;
          const raw = wave === 'square' ? (Math.sin(phase) >= 0 ? 1 : -1) : wave === 'sawtooth' ? ((phase / Math.PI) % 2 - 1) : Math.sin(phase);
          samples[i] = raw * 0.35 * (1 - p);
        }
        triggerFileDownload(encodeWavFromSamples(samples, sr), 'waffle-8bit-sfx.wav', 'audio/wav');
      })
    )
  );
  root.replaceChildren(panel);
  return () => audio.close();
}

// 11. BPM Delay & Reverb Calc
function mountBpmDelayCalc(root) {
  let bpm = 120;
  const out = gEl('div', { class: 'tool-grid', style: { marginTop: '10px' } });
  const render = () => {
    const q = 60000 / bpm;
    const rows = [
      ['1/1 Whole', q * 4], ['1/2 Half', q * 2], ['1/4 Quarter', q],
      ['1/8 Eighth', q / 2], ['1/16 Sixteenth', q / 4],
      ['1/4 Dotted', q * 1.5], ['1/8 Dotted', q * 0.75], ['1/8 Triplet', q / 3]
    ];
    out.replaceChildren(...rows.map(([label, ms]) => statBox(label, `${ms.toFixed(1)} ms · ${(1000 / ms).toFixed(2)} Hz`).el));
  };
  render();
  const panel = gEl('div', { class: 'game-panel' },
    gameSlider({ label: 'Track BPM', min: 40, max: 220, step: 1, value: bpm, unit: ' BPM', onChange: v => { bpm = v; render(); } }).el,
    out
  );
  root.replaceChildren(panel);
  return () => {};
}

// 12. Polyrhythm Wheel
function mountPolyrhythm(root) {
  const audio = createAudioEngine();
  let a = 3, b = 4, bpm = 90, running = false, rafId = null, angle = 0;
  const canvas = gEl('canvas', { width: 320, height: 260, style: { width: '100%', maxWidth: '340px', borderRadius: '16px', border: '3px solid #4f2f23', background: '#fff9ec' } });
  const ctx = canvas.getContext('2d');
  let lastA = -1, lastB = -1;

  const draw = () => {
    ctx.fillStyle = '#fff9ec';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const cx = 160, cy = 130;
    const drawRing = (n, r, col, freq, lastIdx, setLast) => {
      ctx.strokeStyle = '#4f2f23'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < n; i++) {
        const th = (i / n) * Math.PI * 2 - Math.PI / 2;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(cx + Math.cos(th) * r, cy + Math.sin(th) * r, 7, 0, Math.PI * 2); ctx.fill();
      }
      const px = cx + Math.cos(angle - Math.PI / 2) * r;
      const py = cy + Math.sin(angle - Math.PI / 2) * r;
      ctx.fillStyle = '#4f2f23';
      ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
      if (running) {
        const hit = Math.floor(((angle % (Math.PI * 2)) / (Math.PI * 2)) * n);
        if (hit !== lastIdx) { setLast(hit); audio.playTone(freq, { type: 'sine', duration: 0.12, gain: 0.18 }); }
      }
    };
    drawRing(a, 96, '#e78167', 523.25, lastA, v => { lastA = v; });
    drawRing(b, 58, '#82bbb6', 392.0, lastB, v => { lastB = v; });
    if (running) {
      angle += (bpm / 60) * 0.035;
      rafId = requestAnimationFrame(draw);
    }
  };
  draw();

  const btn = gameBtn('▶ Start Polyrhythm', 'primary', () => {
    running = !running;
    btn.textContent = running ? '⏹ Stop' : '▶ Start Polyrhythm';
    if (running) draw();
    else if (rafId) cancelAnimationFrame(rafId);
  });

  const panel = gEl('div', { class: 'game-panel' },
    gEl('div', { class: 'tool-row', style: { gap: '8px', flexWrap: 'wrap' } }, btn),
    gameSlider({ label: 'Outer Ring Beats', min: 2, max: 9, step: 1, value: a, onChange: v => { a = v; draw(); } }).el,
    gameSlider({ label: 'Inner Ring Beats', min: 2, max: 9, step: 1, value: b, onChange: v => { b = v; draw(); } }).el,
    canvas
  );
  root.replaceChildren(panel);
  return () => { if (rafId) cancelAnimationFrame(rafId); audio.close(); };
}

// 13. Interval & Pitch Trainer
function mountEarTrainer(root) {
  const audio = createAudioEngine();
  const intervals = [['Minor 2nd', 1], ['Major 2nd', 2], ['Minor 3rd', 3], ['Major 3rd', 4], ['Perfect 4th', 5], ['Perfect 5th', 7], ['Octave', 12]];
  let target = intervals[4];
  let baseMidi = 60;
  let score = 0;
  const status = statBox('Ear Score', '0 correct · Press Play Interval');

  const playInterval = () => {
    audio.playTone(midiToFreq(baseMidi), { type: 'triangle', duration: 0.4, when: 0 });
    audio.playTone(midiToFreq(baseMidi + target[1]), { type: 'triangle', duration: 0.5, when: 0.42 });
  };
  const nextQ = () => {
    target = intervals[Math.floor(Math.random() * intervals.length)];
    baseMidi = 57 + Math.floor(Math.random() * 10);
    playInterval();
  };

  const btns = gEl('div', { class: 'tool-row', style: { flexWrap: 'wrap', gap: '8px', marginTop: '10px' } });
  intervals.forEach(([label, semi]) => {
    btns.append(gameBtn(label, 'chip', () => {
      if (semi === target[1]) {
        score++;
        status.set(`✅ Correct (${label})! Streak: ${score}`);
        nextQ();
      } else {
        score = 0;
        status.set(`❌ That was ${target[0]}. Try the next one!`);
        nextQ();
      }
    }));
  });

  const panel = gEl('div', { class: 'game-panel' },
    gEl('div', { class: 'tool-row', style: { gap: '8px' } }, gameBtn('🔊 Play Interval', 'primary', playInterval), gameBtn('🎲 New Question', '', nextQ)),
    status.el,
    btns
  );
  root.replaceChildren(panel);
  return () => audio.close();
}

// 14. Guitar & Uke Chord Chart
function mountChordChart(root) {
  const audio = createAudioEngine();
  const shapes = {
    C: [null, 3, 2, 0, 1, 0],
    G: [3, 2, 0, 0, 0, 3],
    D: [null, null, 0, 2, 3, 2],
    A: [null, 0, 2, 2, 2, 0],
    E: [0, 2, 2, 1, 0, 0],
    Em: [0, 2, 2, 0, 0, 0],
    Am: [null, 0, 2, 2, 1, 0],
    Dm: [null, null, 0, 2, 3, 1]
  };
  const openMidi = [40, 45, 50, 55, 59, 64];
  let chord = 'C';
  const diagram = gEl('div', { style: { marginTop: '10px' } });

  const renderChord = () => {
    const frets = shapes[chord];
    const dots = frets.map((f, s) => {
      if (f === null) return `<text x="${28 + s * 28}" y="22" text-anchor="middle" font-weight="700" font-size="14" fill="#c74338">✕</text>`;
      if (f === 0) return `<circle cx="${28 + s * 28}" cy="18" r="6" fill="none" stroke="#4f2f23" stroke-width="3"/>`;
      return `<circle cx="${28 + s * 28}" cy="${22 + f * 30 - 15}" r="9" fill="#e78167" stroke="#4f2f23" stroke-width="3"/>`;
    }).join('');
    diagram.innerHTML = `<svg viewBox="0 0 196 160" width="220" style="background:#fff9ec;border:3px solid #4f2f23;border-radius:14px">
      <line x1="28" y1="30" x2="168" y2="30" stroke="#4f2f23" stroke-width="6"/>
      ${[60, 90, 120, 150].map(y => `<line x1="28" y1="${y}" x2="168" y2="${y}" stroke="#b89b78" stroke-width="2.5"/>`).join('')}
      ${[0, 1, 2, 3, 4, 5].map(s => `<line x1="${28 + s * 28}" y1="30" x2="${28 + s * 28}" y2="150" stroke="#4f2f23" stroke-width="2.5"/>`).join('')}
      ${dots}
    </svg>`;
  };
  renderChord();

  const strum = () => {
    shapes[chord].forEach((f, s) => {
      if (f !== null) audio.playTone(midiToFreq(openMidi[s] + f), { type: 'triangle', duration: 0.9, when: s * 0.045, gain: 0.14 });
    });
  };

  const panel = gEl('div', { class: 'game-panel' },
    gameTabs(Object.keys(shapes), chord, v => { chord = v; renderChord(); strum(); }, 'Guitar Chord').el,
    gameBtn('🎸 Strum Chord', 'primary', strum),
    diagram
  );
  root.replaceChildren(panel);
  return () => audio.close();
}

// 15. Songwriter Lyric Pad
function mountLyricsRhymePad(root) {
  const area = gEl('textarea', {
    class: 'gfield-textarea',
    rows: 8,
    placeholder: 'Write verses, choruses & bars…',
    value: '[Verse 1]\nLate night glow on the kitchen floor\nCounting beats till we open the door\n\n[Chorus]\nEvery melody feels brand new\nSpinning rhythms in gold and blue'
  });
  const countSyllables = word => {
    const clean = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!clean) return 0;
    const m = clean.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').match(/[aeiouy]{1,2}/g);
    return Math.max(1, m ? m.length : 1);
  };
  const breakdown = gEl('div', { style: { display: 'grid', gap: '6px', marginTop: '10px' } });
  const update = () => {
    const lines = String(area.value || '').split('\n');
    breakdown.replaceChildren(...lines.filter(l => l.trim()).map(l => {
      const words = l.trim().split(/\s+/);
      const syl = l.startsWith('[') ? 0 : words.reduce((a, w) => a + countSyllables(w), 0);
      const tail = words[words.length - 1]?.replace(/[^a-zA-Z]/g, '').slice(-3) || '';
      return gEl('div', {
        style: { padding: '6px 10px', borderRadius: '10px', background: '#fff9ec', border: '2px solid #d5bfa3', display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '13px' }
      }, gEl('span', { text: l }), gEl('strong', { text: l.startsWith('[') ? 'Section' : `${syl} syl · -${tail}` }));
    }));
  };
  area.addEventListener('input', update);
  update();

  const panel = gEl('div', { class: 'game-panel' },
    gameField('Lyrics & Song Sections', area),
    gEl('div', { class: 'tool-row', style: { gap: '8px' } },
      gameBtn('📋 Copy Lyrics', '', () => copyToClipboard(area.value)),
      gameBtn('⬇ Save .txt', 'primary', () => triggerFileDownload(area.value, 'song-lyrics.txt'))
    ),
    breakdown
  );
  root.replaceChildren(panel);
  return () => {};
}

const MUSIC_DISPATCH = {
  'waffle-music-lab': mountWaffleMusicLab,
  'beat-sequencer': mountBeatSequencer,
  'chord-progression': mountChordProgression,
  'piano-synth': mountPianoSynth,
  'metronome-pro': mountMetronomePro,
  'guitar-tuner': mountGuitarTuner,
  'circle-of-fifths': mountCircleOfFifths,
  'scale-finder': mountScaleFinder,
  'audio-visualizer': mountAudioVisualizer,
  'sfx-creator': mountSfxCreator,
  'bpm-delay-calc': mountBpmDelayCalc,
  'poly-rhythm': mountPolyrhythm,
  'ear-trainer': mountEarTrainer,
  'chord-chart': mountChordChart,
  'lyrics-rhymepad': mountLyricsRhymePad
};

export function mountMusic(id, root) {
  const fn = MUSIC_DISPATCH[id];
  if (!fn) return false;
  return fn(root) || (() => {});
}
