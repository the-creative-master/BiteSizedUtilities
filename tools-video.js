import { gEl, gameBtn, gameTabs, gameToggle, gameSlider, gameColorPicker, gameFilePill, gameField, statBox, copyToClipboard } from './ui-kit.js';
import { createDocxBytes, triggerFileDownload } from './file-tools-client.js';

// 1. STAR UTILITY: WAFFLE STUDIO (Full Multi-Layer Photo & Video Editor + NLE)
function mountWaffleStudio(root) {
  let studioMode = 'photo'; // 'photo' | 'video'
  let toolMode = 'move'; // 'move' | 'brush' | 'eraser'
  let brushColor = '#ffe17d';
  let brushSize = 14;
  let aspect = '16:9';

  const canvas = gEl('canvas', {
    width: 960,
    height: 540,
    style: {
      width: '100%',
      maxHeight: '420px',
      borderRadius: '16px',
      border: '3.5px solid #4f2f23',
      background: '#1e1613',
      cursor: 'grab',
      touchAction: 'none',
      objectFit: 'contain'
    }
  });
  const ctx = canvas.getContext('2d');
  const paintCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (paintCanvas) { paintCanvas.width = 960; paintCanvas.height = 540; }
  const paintCtx = paintCanvas ? paintCanvas.getContext('2d') : null;

  const grade = { brightness: 100, contrast: 100, saturate: 100, blur: 0, vignette: 18, preset: 'Original' };
  const layers = [
    { id: 'bg-grad', kind: 'backdrop', name: 'Studio Backdrop', visible: true, opacity: 100, blend: 'source-over', x: 0, y: 0, scale: 1, rot: 0, colorA: '#3d2820', colorB: '#1d1411' },
    { id: 'title-1', kind: 'text', name: 'Title Layer', visible: true, opacity: 100, blend: 'source-over', x: 480, y: 270, scale: 1, rot: 0, text: 'WAFFLE STUDIO', color: '#ffe17d', fontSize: 56 },
    { id: 'paint-1', kind: 'paint', name: 'Paint Overlay', visible: true, opacity: 100, blend: 'source-over', x: 0, y: 0, scale: 1, rot: 0 }
  ];
  let selectedId = 'title-1';

  // Video Timeline State
  let videoClips = [];
  let isPlaying = false;
  let timelineTime = 0;
  let trimIn = 0;
  let trimOut = 10;
  let playSpeed = 1;
  let rafId = null;
  let lastFrameTs = 0;
  let recorder = null;

  const layersListEl = gEl('div', { style: { display: 'grid', gap: '6px', marginTop: '8px' } });
  const clipStat = statBox('Studio Canvas', '960×540 · 3 Layers');
  const textInput = gEl('input', { class: 'gfield-input', type: 'text', value: 'WAFFLE STUDIO', placeholder: 'Edit selected text layer…' });

  const setAspect = ratio => {
    aspect = ratio;
    const map = { '16:9': [960, 540], '9:16': [540, 960], '1:1': [720, 720], '4:5': [640, 800] };
    const [w, h] = map[ratio] || [960, 540];
    canvas.width = w;
    canvas.height = h;
    if (paintCanvas) { paintCanvas.width = w; paintCanvas.height = h; }
    const titleL = layers.find(l => l.id === 'title-1');
    if (titleL) { titleL.x = w / 2; titleL.y = h / 2; }
    clipStat.set(`${w}×${h} · ${layers.length} Layers`);
    renderFrame();
  };

  function applyFilterStr() {
    let extra = '';
    if (grade.preset === 'Noir B&W') extra = ' grayscale(100%)';
    else if (grade.preset === 'Portra Warm') extra = ' sepia(18%)';
    else if (grade.preset === 'Cine Teal-Orange') extra = ' hue-rotate(-8deg)';
    else if (grade.preset === 'Faded Film') extra = ' sepia(24%) contrast(90%)';
    return `brightness(${grade.brightness}%) contrast(${grade.contrast}%) saturate(${grade.saturate}%) blur(${grade.blur}px)${extra}`;
  }

  function renderFrame() {
    const w = canvas.width, h = canvas.height;
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.filter = applyFilterStr();

    for (const layer of layers) {
      if (!layer.visible) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, (layer.opacity ?? 100) / 100));
      ctx.globalCompositeOperation = layer.blend || 'source-over';

      if (layer.kind === 'backdrop') {
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, layer.colorA || '#3d2820');
        g.addColorStop(1, layer.colorB || '#1d1411');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      } else if (layer.kind === 'image' && layer.img) {
        const iw = layer.img.naturalWidth || layer.img.width || w;
        const ih = layer.img.naturalHeight || layer.img.height || h;
        const baseScale = Math.min(w / iw, h / ih);
        const dw = iw * baseScale * (layer.scale || 1);
        const dh = ih * baseScale * (layer.scale || 1);
        ctx.translate(layer.x, layer.y);
        ctx.rotate(((layer.rot || 0) * Math.PI) / 180);
        ctx.drawImage(layer.img, -dw / 2, -dh / 2, dw, dh);
      } else if (layer.kind === 'video' && layer.video && layer.video.readyState >= 2) {
        const vw = layer.video.videoWidth || w;
        const vh = layer.video.videoHeight || h;
        const baseScale = Math.min(w / vw, h / vh);
        const dw = vw * baseScale * (layer.scale || 1);
        const dh = vh * baseScale * (layer.scale || 1);
        ctx.translate(layer.x, layer.y);
        ctx.rotate(((layer.rot || 0) * Math.PI) / 180);
        ctx.drawImage(layer.video, -dw / 2, -dh / 2, dw, dh);
      } else if (layer.kind === 'paint' && paintCanvas) {
        ctx.drawImage(paintCanvas, 0, 0);
      } else if (layer.kind === 'text') {
        ctx.translate(layer.x, layer.y);
        ctx.rotate(((layer.rot || 0) * Math.PI) / 180);
        ctx.scale(layer.scale || 1, layer.scale || 1);
        ctx.font = `700 ${layer.fontSize || 48}px Fredoka, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#2d1912';
        ctx.strokeText?.(layer.text || '', 0, 0);
        ctx.fillStyle = layer.color || '#ffe17d';
        ctx.fillText(layer.text || '', 0, 0);
      }
      ctx.restore();
    }

    ctx.filter = 'none';
    if (grade.vignette > 0) {
      const vg = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, Math.max(w, h) * 0.72);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, `rgba(0,0,0,${(grade.vignette / 100) * 0.85})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  function refreshLayerStack() {
    layersListEl.replaceChildren(...[...layers].reverse().map(layer => {
      const isSel = layer.id === selectedId;
      return gEl('div', {
        style: {
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px',
          padding: '6px 10px', borderRadius: '11px',
          border: `2.5px solid ${isSel ? '#e78167' : '#4f2f23'}`,
          background: isSel ? '#fff3d6' : '#fff9ec'
        }
      },
        gEl('button', {
          type: 'button', class: 'gbtn', text: `${layer.visible ? '👁' : '🚫'} ${layer.name}`,
          style: { flex: '1', textAlign: 'left', padding: '5px 8px', fontSize: '12px' },
          onClick: () => {
            selectedId = layer.id;
            if (layer.kind === 'text') textInput.value = layer.text || '';
            refreshLayerStack();
          }
        }),
        gameBtn(layer.visible ? 'Hide' : 'Show', 'chip', () => { layer.visible = !layer.visible; refreshLayerStack(); renderFrame(); }),
        gameBtn('↑', 'chip', () => {
          const i = layers.indexOf(layer);
          if (i < layers.length - 1) { [layers[i], layers[i + 1]] = [layers[i + 1], layers[i]]; refreshLayerStack(); renderFrame(); }
        }),
        gameBtn('↓', 'chip', () => {
          const i = layers.indexOf(layer);
          if (i > 0) { [layers[i], layers[i - 1]] = [layers[i - 1], layers[i]]; refreshLayerStack(); renderFrame(); }
        }),
        layer.kind !== 'backdrop' ? gameBtn('✕', 'danger', () => {
          const i = layers.indexOf(layer);
          if (i >= 0) layers.splice(i, 1);
          if (selectedId === layer.id) selectedId = layers[layers.length - 1]?.id || null;
          refreshLayerStack();
          renderFrame();
        }) : null
      );
    }));
    clipStat.set(`${canvas.width}×${canvas.height} · ${layers.length} Layers`);
  }

  // Canvas pointer interactions (Drag Layer / Brush / Eraser)
  let dragging = false;
  let lastPt = null;
  const getPt = e => {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX ?? r.left) - r.left) * (canvas.width / Math.max(1, r.width)),
      y: ((e.clientY ?? r.top) - r.top) * (canvas.height / Math.max(1, r.height))
    };
  };
  canvas.addEventListener('pointerdown', e => {
    dragging = true;
    lastPt = getPt(e);
    if ((toolMode === 'brush' || toolMode === 'eraser') && paintCtx) {
      paintCtx.save();
      paintCtx.globalCompositeOperation = toolMode === 'eraser' ? 'destination-out' : 'source-over';
      paintCtx.fillStyle = brushColor;
      paintCtx.beginPath();
      paintCtx.arc(lastPt.x, lastPt.y, brushSize / 2, 0, Math.PI * 2);
      paintCtx.fill();
      paintCtx.restore();
      renderFrame();
    }
  });
  canvas.addEventListener('pointermove', e => {
    if (!dragging || !lastPt) return;
    const pt = getPt(e);
    if (toolMode === 'move') {
      const sel = layers.find(l => l.id === selectedId);
      if (sel && (sel.kind === 'image' || sel.kind === 'video' || sel.kind === 'text')) {
        sel.x += pt.x - lastPt.x;
        sel.y += pt.y - lastPt.y;
        renderFrame();
      }
    } else if (paintCtx) {
      paintCtx.save();
      paintCtx.globalCompositeOperation = toolMode === 'eraser' ? 'destination-out' : 'source-over';
      paintCtx.strokeStyle = brushColor;
      paintCtx.lineWidth = brushSize;
      paintCtx.lineCap = 'round';
      paintCtx.beginPath();
      paintCtx.moveTo(lastPt.x, lastPt.y);
      paintCtx.lineTo(pt.x, pt.y);
      paintCtx.stroke();
      paintCtx.restore();
      renderFrame();
    }
    lastPt = pt;
  });
  window.addEventListener?.('pointerup', () => { dragging = false; lastPt = null; });

  // Media Loaders
  const addPhotoPill = gameFilePill('➕ Add Photo Layer', 'image/*', false, files => {
    const file = files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const id = `img-${Date.now()}`;
      layers.splice(layers.length - 1, 0, {
        id, kind: 'image', name: file.name.slice(0, 18), visible: true,
        opacity: 100, blend: 'source-over', x: canvas.width / 2, y: canvas.height / 2, scale: 1, rot: 0, img
      });
      selectedId = id;
      refreshLayerStack();
      renderFrame();
    };
    img.src = URL.createObjectURL(file);
  });

  const timeScrubber = gameSlider({
    label: 'Playhead Scrubber', min: 0, max: 10, step: 0.1, value: 0, unit: 's',
    onChange: v => {
      timelineTime = v;
      videoClips.forEach(vc => { if (vc.video) vc.video.currentTime = Math.min(vc.video.duration || 10, v); });
      renderFrame();
    }
  });

  const addVideoPill = gameFilePill('🎬 Add Video Clip', 'video/*', false, files => {
    const file = files?.[0];
    if (!file) return;
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.muted = false;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      studioMode = 'video';
      trimIn = 0;
      trimOut = Math.max(1, Math.round((video.duration || 10) * 10) / 10);
      const id = `vid-${Date.now()}`;
      const layer = {
        id, kind: 'video', name: file.name.slice(0, 18), visible: true,
        opacity: 100, blend: 'source-over', x: canvas.width / 2, y: canvas.height / 2, scale: 1, rot: 0, video
      };
      layers.splice(layers.length - 1, 0, layer);
      videoClips.push(layer);
      selectedId = id;
      video.currentTime = 0;
      video.onseeked = () => renderFrame();
      refreshLayerStack();
      renderFrame();
    };
  });

  // Playback Loop for Video Timeline
  const tickVideo = ts => {
    if (!isPlaying) return;
    const dt = lastFrameTs ? (ts - lastFrameTs) / 1000 : 0.016;
    lastFrameTs = ts;
    timelineTime += dt * playSpeed;
    if (timelineTime > trimOut) {
      timelineTime = trimIn;
      videoClips.forEach(vc => { if (vc.video) vc.video.currentTime = trimIn; });
    }
    timeScrubber.value = Math.min(10, Math.round(timelineTime * 10) / 10);
    renderFrame();
    rafId = requestAnimationFrame(tickVideo);
  };

  const playVideoBtn = gameBtn('▶ Play Timeline', 'primary', () => {
    isPlaying = !isPlaying;
    playVideoBtn.textContent = isPlaying ? '⏹ Pause' : '▶ Play Timeline';
    if (isPlaying) {
      lastFrameTs = 0;
      videoClips.forEach(vc => {
        if (vc.video) {
          vc.video.playbackRate = playSpeed;
          vc.video.currentTime = timelineTime;
          vc.video.play().catch(() => {});
        }
      });
      rafId = requestAnimationFrame(tickVideo);
    } else {
      if (rafId) cancelAnimationFrame(rafId);
      videoClips.forEach(vc => vc.video?.pause());
    }
  });

  const exportWebmBtn = gameBtn('🎬 Export .webm Video', '', () => {
    if (typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
      clipStat.set('MediaRecorder unavailable — use Export PNG instead.');
      return;
    }
    const stream = canvas.captureStream(30);
    const chunks = [];
    recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm' });
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      triggerFileDownload(blob, 'waffle-studio-edit.webm', 'video/webm');
      clipStat.set('Exported waffle-studio-edit.webm!');
    };
    const recLenMs = Math.max(1500, Math.min(15000, (trimOut - trimIn) * 1000));
    timelineTime = trimIn;
    if (!isPlaying) playVideoBtn.click();
    recorder.start();
    clipStat.set(`Recording ${(recLenMs / 1000).toFixed(1)}s WebM…`);
    setTimeout(() => { if (recorder && recorder.state === 'recording') recorder.stop(); }, recLenMs);
  });

  textInput.addEventListener('input', () => {
    const sel = layers.find(l => l.id === selectedId);
    if (sel && sel.kind === 'text') {
      sel.text = textInput.value;
      renderFrame();
    }
  });

  refreshLayerStack();
  renderFrame();

  const panel = gEl('div', { class: 'game-panel' },
    gEl('div', { class: 'tool-row', style: { gap: '8px', flexWrap: 'wrap' } },
      addPhotoPill.el,
      addVideoPill.el,
      gameBtn('➕ Add Text Layer', '', () => {
        const id = `txt-${Date.now()}`;
        layers.splice(layers.length - 1, 0, { id, kind: 'text', name: 'New Title', visible: true, opacity: 100, blend: 'source-over', x: canvas.width / 2, y: canvas.height / 2, scale: 1, rot: 0, text: textInput.value || 'Hello Studio!', color: brushColor, fontSize: 48 });
        selectedId = id;
        refreshLayerStack();
        renderFrame();
      }),
      gameBtn('📸 Export PNG', 'primary', () => {
        if (typeof canvas.toBlob === 'function') {
          canvas.toBlob(b => { if (b) triggerFileDownload(b, 'waffle-studio-photo.png', 'image/png'); }, 'image/png');
        }
      }),
      exportWebmBtn
    ),
    gEl('div', { class: 'tool-row', style: { gap: '8px', flexWrap: 'wrap', marginTop: '8px' } },
      gameTabs([['move', '✋ Move Layer'], ['brush', '🖌 Paint Brush'], ['eraser', '🧽 Eraser']], toolMode, v => { toolMode = v; canvas.style.cursor = v === 'move' ? 'grab' : 'crosshair'; }, 'Active Tool').el,
      gameTabs(['16:9', '9:16', '1:1', '4:5'], aspect, setAspect, 'Canvas Ratio').el
    ),
    canvas,
    clipStat.el,
    gEl('div', { class: 'tool-row', style: { gap: '8px', flexWrap: 'wrap', marginTop: '8px' } },
      playVideoBtn,
      gameTabs([['0.5', '0.5×'], ['1', '1×'], ['1.5', '1.5×'], ['2', '2×']], '1', v => { playSpeed = Number(v); }, 'Speed').el
    ),
    timeScrubber.el,
    gameField('Text Layer Content', textInput),
    gameTabs(['Original', 'Cine Teal-Orange', 'Portra Warm', 'Noir B&W', 'Faded Film'], 'Original', v => {
      grade.preset = v;
      if (v === 'Cine Teal-Orange') { grade.contrast = 115; grade.saturate = 122; }
      else if (v === 'Portra Warm') { grade.brightness = 104; grade.saturate = 112; }
      else if (v === 'Faded Film') { grade.contrast = 92; grade.brightness = 105; }
      else { grade.brightness = 100; grade.contrast = 100; grade.saturate = 100; }
      renderFrame();
    }, 'Color LUT Preset').el,
    gameTabs([['source-over', 'Normal'], ['multiply', 'Multiply'], ['screen', 'Screen'], ['overlay', 'Overlay']], 'source-over', v => {
      const sel = layers.find(l => l.id === selectedId);
      if (sel) { sel.blend = v; renderFrame(); }
    }, 'Layer Blend Mode').el,
    gameSlider({ label: 'Selected Opacity', min: 10, max: 100, step: 2, value: 100, unit: '%', onChange: v => { const s = layers.find(l => l.id === selectedId); if (s) { s.opacity = v; renderFrame(); } } }).el,
    gameSlider({ label: 'Selected Scale', min: 25, max: 250, step: 5, value: 100, unit: '%', onChange: v => { const s = layers.find(l => l.id === selectedId); if (s) { s.scale = v / 100; renderFrame(); } } }).el,
    gameSlider({ label: 'Selected Rotation', min: -180, max: 180, step: 5, value: 0, unit: '°', onChange: v => { const s = layers.find(l => l.id === selectedId); if (s) { s.rot = v; renderFrame(); } } }).el,
    gameSlider({ label: 'Brightness', min: 40, max: 180, step: 2, value: 100, unit: '%', onChange: v => { grade.brightness = v; renderFrame(); } }).el,
    gameSlider({ label: 'Contrast', min: 40, max: 200, step: 2, value: 100, unit: '%', onChange: v => { grade.contrast = v; renderFrame(); } }).el,
    gameSlider({ label: 'Saturation', min: 0, max: 200, step: 5, value: 100, unit: '%', onChange: v => { grade.saturate = v; renderFrame(); } }).el,
    gameSlider({ label: 'Vignette', min: 0, max: 100, step: 5, value: 18, unit: '%', onChange: v => { grade.vignette = v; renderFrame(); } }).el,
    gameColorPicker(brushColor, c => {
      brushColor = c;
      const sel = layers.find(l => l.id === selectedId);
      if (sel && sel.kind === 'text') { sel.color = c; renderFrame(); }
    }, 'Brush / Text Color').el,
    gameSlider({ label: 'Brush Size', min: 2, max: 60, step: 2, value: brushSize, unit: 'px', onChange: v => { brushSize = v; } }).el,
    gEl('strong', { text: 'Layer Stack', style: { display: 'block', marginTop: '10px' } }),
    layersListEl
  );
  root.replaceChildren(panel);
  return () => {
    isPlaying = false;
    if (rafId) cancelAnimationFrame(rafId);
    videoClips.forEach(vc => vc.video?.pause());
  };
}

// 2. Storyboard & Shot List
function mountStoryboardBoard(root) {
  const shots = [
    { shot: 'Shot 1', type: 'WS', move: 'Slow Push-In', dur: 4, notes: 'Opening establishing kitchen counter at sunrise.' },
    { shot: 'Shot 2', type: 'CU', move: 'Static', dur: 3, notes: 'Hands pouring warm syrup onto golden stack.' }
  ];
  const listEl = gEl('div', { style: { display: 'grid', gap: '8px', marginTop: '10px' } });
  const shotInput = gEl('input', { class: 'gfield-input', type: 'text', placeholder: 'Describe action / dialogue for new shot…' });
  let shotType = 'MS', camMove = 'Dolly', durSec = 4;

  const renderShots = () => {
    const total = shots.reduce((a, s) => a + s.dur, 0);
    listEl.replaceChildren(
      statBox('Shoot Plan', `${shots.length} Shots · ${total}s Total Runtime`).el,
      ...shots.map((s, idx) => gEl('div', {
        style: { padding: '10px', borderRadius: '12px', background: '#fff9ec', border: '2.5px solid #4f2f23', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }
      },
        gEl('div', {},
          gEl('strong', { text: `${s.shot} · [${s.type}] · ${s.move} (${s.dur}s)` }),
          gEl('p', { text: s.notes, style: { margin: '4px 0 0', fontSize: '13px' } })
        ),
        gameBtn('✕', 'danger', () => { shots.splice(idx, 1); renderShots(); })
      ))
    );
  };
  renderShots();

  const panel = gEl('div', { class: 'game-panel' },
    gameTabs(['EWS', 'WS', 'MS', 'CU', 'ECU', 'OTS'], shotType, v => { shotType = v; }, 'Framing').el,
    gameTabs(['Static', 'Pan', 'Tilt', 'Dolly', 'Handheld', 'Drone'], camMove, v => { camMove = v; }, 'Camera Movement').el,
    gameSlider({ label: 'Shot Duration', min: 1, max: 30, step: 1, value: durSec, unit: 's', onChange: v => { durSec = v; } }).el,
    gameField('Shot Action & Notes', shotInput),
    gEl('div', { class: 'tool-row', style: { gap: '8px', flexWrap: 'wrap' } },
      gameBtn('➕ Add Shot', 'primary', () => {
        shots.push({ shot: `Shot ${shots.length + 1}`, type: shotType, move: camMove, dur: durSec, notes: shotInput.value.trim() || 'Scene action beat' });
        shotInput.value = '';
        renderShots();
      }),
      gameBtn('⬇ Export .docx Shot List', '', () => {
        const md = `# Production Storyboard & Shot List\n\n` + shots.map(s => `- **${s.shot}** [${s.type} | ${s.move} | ${s.dur}s]: ${s.notes}`).join('\n');
        triggerFileDownload(createDocxBytes(md, 'Storyboard Shot List'), 'storyboard-shot-list.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      })
    ),
    listEl
  );
  root.replaceChildren(panel);
  return () => {};
}

// 3. Studio Teleprompter
function mountTeleprompter(root) {
  let wpm = 130, fontSize = 28, mirrored = false, playing = false, timer = null;
  const scriptArea = gEl('textarea', {
    class: 'gfield-textarea', rows: 4,
    value: 'Welcome back to the channel! Today we are exploring three lighting tricks that make every desk setup look cinematic—even with just one key light and a bounce card.'
  });
  const stage = gEl('div', {
    style: {
      height: '220px', overflowY: 'auto', padding: '24px', borderRadius: '16px',
      border: '3.5px solid #4f2f23', background: '#171311', color: '#fff9ec',
      fontWeight: '700', lineHeight: '1.5', marginTop: '10px'
    }
  });
  const syncStage = () => {
    stage.textContent = scriptArea.value;
    stage.style.fontSize = `${fontSize}px`;
    stage.style.transform = mirrored ? 'scaleX(-1)' : 'none';
  };
  scriptArea.addEventListener('input', syncStage);
  syncStage();

  const playBtn = gameBtn('▶ Start Scroll', 'primary', () => {
    playing = !playing;
    playBtn.textContent = playing ? '⏸ Pause Scroll' : '▶ Start Scroll';
    if (!playing) { clearInterval(timer); timer = null; return; }
    timer = setInterval(() => {
      stage.scrollTop += Math.max(1, (wpm / 90) * (fontSize / 26));
    }, 30);
  });

  const panel = gEl('div', { class: 'game-panel' },
    gameField('Teleprompter Script', scriptArea),
    gEl('div', { class: 'tool-row', style: { gap: '8px', flexWrap: 'wrap' } },
      playBtn,
      gameBtn('↺ Rewind', '', () => { stage.scrollTop = 0; }),
      gameToggle('Mirror Text (Beam Splitter)', mirrored, v => { mirrored = v; syncStage(); }).el
    ),
    gameSlider({ label: 'Reading Speed', min: 60, max: 260, step: 10, value: wpm, unit: ' WPM', onChange: v => { wpm = v; } }).el,
    gameSlider({ label: 'Text Size', min: 18, max: 52, step: 2, value: fontSize, unit: 'px', onChange: v => { fontSize = v; syncStage(); } }).el,
    stage
  );
  root.replaceChildren(panel);
  return () => { if (timer) clearInterval(timer); };
}

// 4. SRT & VTT Subtitle Editor
function mountSubtitleStudio(root) {
  const cues = [
    { start: 0.5, end: 3.0, text: 'Welcome to the edit!' },
    { start: 3.2, end: 6.0, text: 'Captions boost watch time.' }
  ];
  const fmtSrt = sec => {
    const ms = Math.max(0, Math.round(sec * 1000));
    const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
    const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
    const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
    const r = String(ms % 1000).padStart(3, '0');
    return `${h}:${m}:${s},${r}`;
  };
  const cueIn = gEl('input', { class: 'gfield-input', type: 'text', placeholder: 'New caption line…' });
  const listEl = gEl('div', { style: { display: 'grid', gap: '6px', marginTop: '10px' } });
  const renderCues = () => {
    listEl.replaceChildren(...cues.map((c, idx) => gEl('div', {
      style: { padding: '8px 10px', borderRadius: '10px', background: '#fff9ec', border: '2px solid #4f2f23', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', fontSize: '13px' }
    }, gEl('span', { text: `${fmtSrt(c.start)} → ${fmtSrt(c.end)} : ${c.text}` }), gameBtn('✕', 'danger', () => { cues.splice(idx, 1); renderCues(); }))));
  };
  renderCues();

  const panel = gEl('div', { class: 'game-panel' },
    gameField('Caption Text', cueIn),
    gEl('div', { class: 'tool-row', style: { gap: '8px', flexWrap: 'wrap' } },
      gameBtn('➕ Add Cue (+2.5s)', 'primary', () => {
        const lastEnd = cues.length ? cues[cues.length - 1].end + 0.2 : 0.2;
        cues.push({ start: lastEnd, end: lastEnd + 2.5, text: cueIn.value.trim() || 'Caption line' });
        cueIn.value = '';
        renderCues();
      }),
      gameBtn('⏪ Shift -0.5s', '', () => { cues.forEach(c => { c.start = Math.max(0, c.start - 0.5); c.end = Math.max(0.5, c.end - 0.5); }); renderCues(); }),
      gameBtn('⏩ Shift +0.5s', '', () => { cues.forEach(c => { c.start += 0.5; c.end += 0.5; }); renderCues(); }),
      gameBtn('⬇ Export .SRT', '', () => {
        const txt = cues.map((c, i) => `${i + 1}\n${fmtSrt(c.start)} --> ${fmtSrt(c.end)}\n${c.text}\n`).join('\n');
        triggerFileDownload(txt, 'captions.srt');
      }),
      gameBtn('⬇ Export .VTT', '', () => {
        const txt = 'WEBVTT\n\n' + cues.map(c => `${fmtSrt(c.start).replace(',', '.')} --> ${fmtSrt(c.end).replace(',', '.')}\n${c.text}\n`).join('\n');
        triggerFileDownload(txt, 'captions.vtt');
      })
    ),
    listEl
  );
  root.replaceChildren(panel);
  return () => {};
}

// 5. Kinetic Title & Lower-Thirds Maker
function mountKineticTitles(root) {
  let titleText = 'ALEX RIVERA';
  let subText = 'LEAD CINEMATOGRAPHER';
  let style = 'Slide Bar';
  let accent = '#e78167';
  let rafId = null;
  let t = 0;

  const canvas = gEl('canvas', { width: 720, height: 260, style: { width: '100%', maxHeight: '240px', borderRadius: '14px', border: '3px solid #4f2f23', background: '#1f2b33', marginTop: '8px' } });
  const ctx = canvas.getContext('2d');
  const titleIn = gEl('input', { class: 'gfield-input', type: 'text', value: titleText });
  const subIn = gEl('input', { class: 'gfield-input', type: 'text', value: subText });
  titleIn.addEventListener('input', () => { titleText = titleIn.value; t = 0; });
  subIn.addEventListener('input', () => { subText = subIn.value; t = 0; });

  const draw = () => {
    t = (t + 0.02) % 1.4;
    const p = Math.min(1, t * 2.2);
    const ease = 1 - Math.pow(1 - p, 3);
    ctx.fillStyle = '#1f2b33';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    const x = style === 'Slide Bar' ? -240 + ease * 280 : 48;
    const y = style === 'Bounce Pop' ? 140 + (1 - ease) * 70 : 140;
    ctx.fillStyle = accent;
    ctx.fillRect(x, y - 4, 10, 80);
    ctx.fillStyle = '#fff9ec';
    ctx.font = '700 34px Fredoka, sans-serif';
    ctx.fillText(titleText, x + 24, y + 30);
    ctx.fillStyle = '#ffe17d';
    ctx.font = '700 18px Fredoka, sans-serif';
    ctx.fillText(subText, x + 24, y + 62);
    ctx.restore();
    rafId = requestAnimationFrame(draw);
  };
  draw();

  const panel = gEl('div', { class: 'game-panel' },
    gameField('Main Title', titleIn),
    gameField('Subtitle / Role', subIn),
    gameTabs(['Slide Bar', 'Bounce Pop', 'Minimal Clean'], style, v => { style = v; t = 0; }, 'Animation Preset').el,
    gameColorPicker(accent, c => { accent = c; }, 'Accent Color').el,
    gameBtn('📸 Export Lower-Third PNG', 'primary', () => {
      canvas.toBlob?.(b => { if (b) triggerFileDownload(b, 'lower-third.png', 'image/png'); });
    }),
    canvas
  );
  root.replaceChildren(panel);
  return () => { if (rafId) cancelAnimationFrame(rafId); };
}

// 6. Chroma Key (Green/Blue Screen) Studio
function mountGreenScreenKey(root) {
  let keyTarget = 'green';
  let tolerance = 65;
  let fgImg = null;
  let bgColor = '#5577ee';
  const canvas = gEl('canvas', { width: 640, height: 360, style: { width: '100%', maxHeight: '300px', borderRadius: '14px', border: '3px solid #4f2f23', background: bgColor, marginTop: '8px' } });
  const ctx = canvas.getContext('2d');

  const renderKey = () => {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!fgImg) {
      ctx.fillStyle = '#28a745';
      ctx.fillRect(140, 40, 360, 280);
      ctx.fillStyle = '#ffe17d';
      ctx.beginPath(); ctx.arc(320, 180, 64, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.drawImage(fgImg, 0, 0, canvas.width, canvas.height);
    }
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = frame.data;
    const br = parseInt(bgColor.slice(1, 3), 16) || 80;
    const bg = parseInt(bgColor.slice(3, 5), 16) || 120;
    const bb = parseInt(bgColor.slice(5, 7), 16) || 230;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const isKey = keyTarget === 'green'
        ? (g > r + tolerance * 0.45 && g > b + tolerance * 0.45 && g > 70)
        : (b > r + tolerance * 0.45 && b > g + tolerance * 0.45 && b > 70);
      if (isKey) { d[i] = br; d[i + 1] = bg; d[i + 2] = bb; }
    }
    ctx.putImageData(frame, 0, 0);
  };
  renderKey();

  const panel = gEl('div', { class: 'game-panel' },
    gameFilePill('Upload Green/Blue Screen Photo', 'image/*', false, files => {
      const file = files?.[0];
      if (!file) return;
      const im = new Image();
      im.onload = () => { fgImg = im; renderKey(); };
      im.src = URL.createObjectURL(file);
    }).el,
    gameTabs([['green', 'Green Screen'], ['blue', 'Blue Screen']], keyTarget, v => { keyTarget = v; renderKey(); }, 'Key Color').el,
    gameSlider({ label: 'Key Tolerance', min: 15, max: 140, step: 5, value: tolerance, onChange: v => { tolerance = v; renderKey(); } }).el,
    gameColorPicker(bgColor, c => { bgColor = c; renderKey(); }, 'Replacement Background').el,
    gameBtn('⬇ Export Keyed PNG', 'primary', () => canvas.toBlob?.(b => { if (b) triggerFileDownload(b, 'chroma-key.png', 'image/png'); })),
    canvas
  );
  root.replaceChildren(panel);
  return () => {};
}

// 7. Timelapse & Stop-Motion Builder
function mountTimelapseBuilder(root) {
  const frames = [];
  let fps = 8, idx = 0, playing = false, timer = null;
  const canvas = gEl('canvas', { width: 640, height: 360, style: { width: '100%', maxHeight: '280px', borderRadius: '14px', border: '3px solid #4f2f23', background: '#1e1613', marginTop: '8px' } });
  const ctx = canvas.getContext('2d');
  const countStat = statBox('Sequence Frames', '0 photos loaded');

  const drawFrame = () => {
    ctx.fillStyle = '#1e1613';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const f = frames[idx];
    if (f) ctx.drawImage(f, 0, 0, canvas.width, canvas.height);
  };

  const pill = gameFilePill('Add Sequence Photos', 'image/*', true, files => {
    for (const file of files || []) {
      const im = new Image();
      im.onload = () => {
        frames.push(im);
        countStat.set(`${frames.length} frames @ ${fps} FPS (${(frames.length / fps).toFixed(1)}s)`);
        drawFrame();
      };
      im.src = URL.createObjectURL(file);
    }
  });

  const playBtn = gameBtn('▶ Preview Timelapse', 'primary', () => {
    if (!frames.length) return;
    playing = !playing;
    playBtn.textContent = playing ? '⏹ Stop' : '▶ Preview Timelapse';
    if (!playing) { clearInterval(timer); timer = null; return; }
    timer = setInterval(() => { idx = (idx + 1) % frames.length; drawFrame(); }, 1000 / fps);
  });

  const panel = gEl('div', { class: 'game-panel' },
    gEl('div', { class: 'tool-row', style: { gap: '8px', flexWrap: 'wrap' } }, pill.el, playBtn),
    gameSlider({ label: 'Playback FPS', min: 1, max: 30, step: 1, value: fps, unit: ' FPS', onChange: v => { fps = v; countStat.set(`${frames.length} frames @ ${fps} FPS`); } }).el,
    countStat.el,
    canvas
  );
  root.replaceChildren(panel);
  return () => { if (timer) clearInterval(timer); };
}

// 8. Boomerang Loop Maker
function mountGifVideoLoop(root) {
  let vid = null, speed = 1.5, dir = 1, rafId = null;
  const canvas = gEl('canvas', { width: 540, height: 340, style: { width: '100%', maxHeight: '280px', borderRadius: '14px', border: '3px solid #4f2f23', background: '#1c1715', marginTop: '8px' } });
  const ctx = canvas.getContext('2d');
  const status = statBox('Boomerang Status', 'Upload a short clip to bounce forward & backward');

  const loop = () => {
    if (vid && vid.readyState >= 2) {
      const dur = vid.duration || 2;
      let next = vid.currentTime + dir * 0.025 * speed;
      if (next >= dur) { next = dur; dir = -1; }
      else if (next <= 0) { next = 0; dir = 1; }
      vid.currentTime = next;
      ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
    }
    rafId = requestAnimationFrame(loop);
  };

  const panel = gEl('div', { class: 'game-panel' },
    gameFilePill('Upload Clip for Boomerang', 'video/*', false, files => {
      const file = files?.[0];
      if (!file) return;
      vid = document.createElement('video');
      vid.src = URL.createObjectURL(file);
      vid.muted = true;
      vid.onloadedmetadata = () => {
        status.set(`Loaded ${file.name} (${(vid.duration || 0).toFixed(1)}s) — looping!`);
        loop();
      };
    }).el,
    gameSlider({ label: 'Boomerang Speed', min: 0.5, max: 3, step: 0.25, value: speed, unit: '×', onChange: v => { speed = v; } }).el,
    status.el,
    canvas
  );
  root.replaceChildren(panel);
  return () => { if (rafId) cancelAnimationFrame(rafId); };
}

// 9. Social Safe-Zone Previewer
function mountAspectSafeGuide(root) {
  let platform = 'TikTok / Reels (9:16)';
  let userImg = null;
  const canvas = gEl('canvas', { width: 540, height: 540, style: { width: '100%', maxHeight: '360px', borderRadius: '14px', border: '3px solid #4f2f23', background: '#1b1a24', marginTop: '8px' } });
  const ctx = canvas.getContext('2d');

  const draw = () => {
    const isVert = platform.includes('9:16');
    const isCinema = platform.includes('2.39:1');
    canvas.width = isVert ? 420 : 640;
    canvas.height = isVert ? 746 : isCinema ? 268 : 360;
    ctx.fillStyle = '#25202e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (userImg) ctx.drawImage(userImg, 0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#ff6d6d';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    if (isVert) {
      ctx.beginPath(); ctx.rect(20, 90, canvas.width - 96, canvas.height - 250); ctx.stroke();
      ctx.fillStyle = 'rgba(255, 109, 109, 0.25)';
      ctx.fillRect(canvas.width - 70, canvas.height - 290, 56, 170);
      ctx.fillRect(16, canvas.height - 140, canvas.width - 90, 120);
    } else {
      ctx.beginPath(); ctx.rect(32, 24, canvas.width - 64, canvas.height - 48); ctx.stroke();
    }
    ctx.setLineDash([]);
  };
  draw();

  const panel = gEl('div', { class: 'game-panel' },
    gameFilePill('Load Frame to Check Safe Zones', 'image/*', false, files => {
      const file = files?.[0];
      if (!file) return;
      const im = new Image();
      im.onload = () => { userImg = im; draw(); };
      im.src = URL.createObjectURL(file);
    }).el,
    gameTabs(['TikTok / Reels (9:16)', 'YouTube (16:9)', 'CinemaScope (2.39:1)'], platform, v => { platform = v; draw(); }, 'Safe Zone Overlay').el,
    gEl('p', { class: 'tool-note', text: 'Red dashed box marks safe area clear of platform captions, buttons, and cropped edges.' }),
    canvas
  );
  root.replaceChildren(panel);
  return () => {};
}

// 10. 3D LUT & Film Emulation Lab
function mountLutCubeLab(root) {
  let stock = 'Kodak Portra 400';
  let warm = 12, contrast = 108, fade = 8;
  let userImg = null;
  const canvas = gEl('canvas', { width: 600, height: 320, style: { width: '100%', maxHeight: '280px', borderRadius: '14px', border: '3px solid #4f2f23', marginTop: '8px' } });
  const ctx = canvas.getContext('2d');

  const stocks = {
    'Kodak Portra 400': [12, 106, 6],
    'CineStill 800T': [-14, 118, 4],
    'Fuji Velvia 50': [6, 126, 0],
    'Bleach Bypass': [-4, 138, 12]
  };

  const draw = () => {
    ctx.fillStyle = '#332822';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (userImg) {
      ctx.filter = `contrast(${contrast}%) sepia(${Math.max(0, warm)}%) brightness(${100 + fade * 0.4}%)`;
      ctx.drawImage(userImg, 0, 0, canvas.width, canvas.height);
      ctx.filter = 'none';
    } else {
      const swatches = ['#e78167', '#f7c46c', '#82bbb6', '#4f2f23', '#fff9ec'];
      swatches.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(i * (canvas.width / 5), 0, canvas.width / 5, canvas.height);
      });
    }
  };
  draw();

  const panel = gEl('div', { class: 'game-panel' },
    gameFilePill('Preview Photo with LUT', 'image/*', false, files => {
      const file = files?.[0];
      if (!file) return;
      const im = new Image();
      im.onload = () => { userImg = im; draw(); };
      im.src = URL.createObjectURL(file);
    }).el,
    gameTabs(Object.keys(stocks), stock, v => {
      stock = v;
      [warm, contrast, fade] = stocks[v];
      draw();
    }, 'Film Stock').el,
    gameBtn('⬇ Download .cube 3D LUT', 'primary', () => {
      const size = 8;
      const lines = [`TITLE "${stock}"`, `LUT_3D_SIZE ${size}`];
      for (let b = 0; b < size; b++) for (let g = 0; g < size; g++) for (let r = 0; r < size; r++) {
        const rr = Math.min(1, Math.max(0, (r / (size - 1)) + warm * 0.002));
        const gg = Math.min(1, Math.max(0, g / (size - 1)));
        const bb = Math.min(1, Math.max(0, (b / (size - 1)) - warm * 0.002));
        lines.push(`${rr.toFixed(5)} ${gg.toFixed(5)} ${bb.toFixed(5)}`);
      }
      triggerFileDownload(lines.join('\n'), `${stock.toLowerCase().replace(/\s+/g, '-')}.cube`);
    }),
    canvas
  );
  root.replaceChildren(panel);
  return () => {};
}

// 11. Frame Grabber & Contact Sheet
function mountFrameExtractor(root) {
  let vid = null;
  const canvas = gEl('canvas', { width: 640, height: 360, style: { width: '100%', maxHeight: '300px', borderRadius: '14px', border: '3px solid #4f2f23', background: '#1e1613', marginTop: '8px' } });
  const ctx = canvas.getContext('2d');
  const timeStat = statBox('Frame Time', 'Load a video clip to step frames');

  const showAt = t => {
    if (!vid) return;
    vid.currentTime = Math.max(0, Math.min(vid.duration || 10, t));
  };

  const panel = gEl('div', { class: 'game-panel' },
    gameFilePill('Load Video Clip', 'video/*', false, files => {
      const file = files?.[0];
      if (!file) return;
      vid = document.createElement('video');
      vid.src = URL.createObjectURL(file);
      vid.muted = true;
      vid.onseeked = () => {
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        timeStat.set(`Position: ${vid.currentTime.toFixed(3)}s / ${(vid.duration || 0).toFixed(2)}s`);
      };
      vid.onloadedmetadata = () => showAt(0);
    }).el,
    gEl('div', { class: 'tool-row', style: { gap: '8px', flexWrap: 'wrap', marginTop: '8px' } },
      gameBtn('◀ -1 Frame', '', () => vid && showAt(vid.currentTime - 1 / 30)),
      gameBtn('+1 Frame ▶', '', () => vid && showAt(vid.currentTime + 1 / 30)),
      gameBtn('📸 Save Frame PNG', 'primary', () => canvas.toBlob?.(b => { if (b) triggerFileDownload(b, 'video-frame.png', 'image/png'); }))
    ),
    timeStat.el,
    canvas
  );
  root.replaceChildren(panel);
  return () => {};
}

// 12. Bitrate & Storage Calc
function mountBitrateCalc(root) {
  let codec = 'H.265 (HEVC)';
  let res = '4K UHD';
  let mins = 15;
  const codecs = { 'H.264': 1, 'H.265 (HEVC)': 0.65, 'ProRes 422': 5.8, 'AV1': 0.55 };
  const baseMbps = { '1080p HD': 25, '4K UHD': 65, '6K Cinema': 150, '8K RAW': 320 };
  const out = statBox('Estimated File Size', '—');

  const calc = () => {
    const mbps = (baseMbps[res] || 65) * (codecs[codec] || 1);
    const gb = (mbps * mins * 60) / 8 / 1024;
    out.set(`${mbps.toFixed(1)} Mbps · ${gb.toFixed(2)} GB for ${mins} min`);
  };
  calc();

  const panel = gEl('div', { class: 'game-panel' },
    gameTabs(Object.keys(codecs), codec, v => { codec = v; calc(); }, 'Codec').el,
    gameTabs(Object.keys(baseMbps), res, v => { res = v; calc(); }, 'Resolution').el,
    gameSlider({ label: 'Recording Length', min: 1, max: 180, step: 1, value: mins, unit: ' min', onChange: v => { mins = v; calc(); } }).el,
    out.el
  );
  root.replaceChildren(panel);
  return () => {};
}

// 13. DoF & Focal Length Lab
function mountDofFocalCalc(root) {
  let focal = 50, aperture = 2.8, distM = 2.5, coc = 0.03;
  const out = gEl('div', { class: 'tool-grid', style: { marginTop: '10px' } });
  const calc = () => {
    const distMm = distM * 1000;
    const h = (focal * focal) / (aperture * coc) + focal;
    const nearMm = (h * distMm) / (h + (distMm - focal));
    const farMm = distMm < h ? (h * distMm) / (h - (distMm - focal)) : Infinity;
    out.replaceChildren(
      statBox('Hyperfocal Distance', `${(h / 1000).toFixed(2)} m`).el,
      statBox('Near Focus Limit', `${(nearMm / 1000).toFixed(2)} m`).el,
      statBox('Far Focus Limit', farMm === Infinity ? '∞ Infinity' : `${(farMm / 1000).toFixed(2)} m`).el,
      statBox('Total Depth of Field', farMm === Infinity ? 'Infinite' : `${((farMm - nearMm) / 100).toFixed(1)} cm`).el
    );
  };
  calc();

  const panel = gEl('div', { class: 'game-panel' },
    gameTabs([['0.03', 'Full Frame'], ['0.02', 'APS-C'], ['0.015', 'Micro 4/3']], '0.03', v => { coc = Number(v); calc(); }, 'Sensor Size').el,
    gameSlider({ label: 'Focal Length', min: 14, max: 200, step: 2, value: focal, unit: 'mm', onChange: v => { focal = v; calc(); } }).el,
    gameSlider({ label: 'Aperture (f-stop)', min: 1.2, max: 16, step: 0.2, value: aperture, unit: ' f/', onChange: v => { aperture = v; calc(); } }).el,
    gameSlider({ label: 'Subject Distance', min: 0.5, max: 15, step: 0.5, value: distM, unit: ' m', onChange: v => { distM = v; calc(); } }).el,
    out
  );
  root.replaceChildren(panel);
  return () => {};
}

// 14. Exposure & Shutter Angle Lab
function mountExposureTriangle(root) {
  let fps = 24, iso = 400, fStop = 2.8, ndStops = 0;
  const out = gEl('div', { class: 'tool-grid', style: { marginTop: '10px' } });
  const calc = () => {
    const shutter = Math.round(fps * 2);
    const ev = Math.log2((fStop * fStop) * shutter) - Math.log2(iso / 100) + ndStops;
    out.replaceChildren(
      statBox('180° Shutter Rule', `1/${shutter} sec @ ${fps} FPS`).el,
      statBox('Effective EV₁₀₀', `${ev.toFixed(1)} EV`).el,
      statBox('ND Filter Reduction', `${ndStops} Stops (ND${Math.pow(2, ndStops)})`).el
    );
  };
  calc();

  const panel = gEl('div', { class: 'game-panel' },
    gameTabs([['24', '24 FPS (Cinema)'], ['30', '30 FPS (Web)'], ['60', '60 FPS (Slow-Mo)']], '24', v => { fps = Number(v); calc(); }, 'Frame Rate').el,
    gameSlider({ label: 'ISO Sensitivity', min: 100, max: 6400, step: 100, value: iso, onChange: v => { iso = v; calc(); } }).el,
    gameSlider({ label: 'Aperture f-stop', min: 1.4, max: 16, step: 0.2, value: fStop, onChange: v => { fStop = v; calc(); } }).el,
    gameSlider({ label: 'ND Filter Stops', min: 0, max: 6, step: 1, value: ndStops, unit: ' stops', onChange: v => { ndStops = v; calc(); } }).el,
    out
  );
  root.replaceChildren(panel);
  return () => {};
}

// 15. Audio Slate & Sync Tool
function mountAudioLoudnessSync(root) {
  let ctx = null;
  const playBeep = (hz = 1000, dur = 0.12) => {
    if (!ctx && typeof window !== 'undefined') {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = hz;
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur + 0.02);
  };
  const slateStat = statBox('Sync Slate', 'Tap Clap Sync or Download 1kHz Reference Tone');

  const panel = gEl('div', { class: 'game-panel' },
    gEl('div', { class: 'tool-row', style: { gap: '8px', flexWrap: 'wrap' } },
      gameBtn('🎬 Clap 1kHz Sync Beep', 'primary', () => {
        playBeep(1000, 0.14);
        slateStat.set(`Sync Marker fired @ ${new Date().toLocaleTimeString()}`);
      }),
      gameBtn('⏱ 3-2-1 Countdown Beeps', '', () => {
        [0, 600, 1200].forEach(ms => setTimeout(() => playBeep(660, 0.08), ms));
        setTimeout(() => playBeep(1000, 0.18), 1800);
      })
    ),
    slateStat.el
  );
  root.replaceChildren(panel);
  return () => { if (ctx && typeof ctx.close === 'function') ctx.close().catch(() => {}); };
}

const VIDEO_DISPATCH = {
  'waffle-studio': mountWaffleStudio,
  'storyboard-board': mountStoryboardBoard,
  teleprompter: mountTeleprompter,
  'subtitle-studio': mountSubtitleStudio,
  'kinetic-titles': mountKineticTitles,
  'green-screen-key': mountGreenScreenKey,
  'timelapse-builder': mountTimelapseBuilder,
  'gif-video-loop': mountGifVideoLoop,
  'aspect-safe-guide': mountAspectSafeGuide,
  'lut-cube-lab': mountLutCubeLab,
  'frame-extractor': mountFrameExtractor,
  'bitrate-calc': mountBitrateCalc,
  'dof-focal-calc': mountDofFocalCalc,
  'exposure-triangle': mountExposureTriangle,
  'audio-loudness-sync': mountAudioLoudnessSync
};

export function mountVideo(id, root) {
  const fn = VIDEO_DISPATCH[id];
  if (!fn) return false;
  return fn(root) || (() => {});
}
