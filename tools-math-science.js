/** Cozy 2.5D Science & Physics Toys — zero default HTML select/range/checkbox inputs */
import { MATH_NUMBER_TOOLS } from './tools-math-numbers.js';
import { gEl, gameBtn, gameTabs, gameSlider, gameField, statBox } from './ui-kit.js';
import { playPop, playSparkle, playBoing } from './sfx.js';

const PI = Math.PI;
const G = 6.67430e-11;
const C = 299792458;
const R = 8.31446261815324;
const H = 6.62607015e-34;
const LN2 = Math.LN2;

function numberText(n) {
  if (!Number.isFinite(n)) throw new Error('The result is not finite. Check the inputs and domains.');
  if (Object.is(n, -0) || n === 0) return '0';
  return Number(n.toPrecision(10)).toString();
}
function positive(n, name, zero = false) {
  if (zero ? n < 0 : n <= 0) throw new Error(`${name} must be ${zero ? 'nonnegative' : 'greater than zero'}.`);
  return n;
}
function integer(n, name, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error(`${name} must be a whole number from ${min} to ${max}.`);
  return n;
}
function kelvin(value, unit) {
  const k = unit === 'C' ? value + 273.15 : unit === 'F' ? (value - 32) * 5 / 9 + 273.15 : value;
  if (k < -1e-10) throw new Error('Temperature cannot be below absolute zero (0 K).');
  return Math.max(0, k);
}
function fromKelvin(k, unit) { return unit === 'C' ? k - 273.15 : unit === 'F' ? (k - 273.15) * 9 / 5 + 32 : k; }

function numInput(val, opts = {}) {
  return gEl('input', { type: 'number', step: 'any', class: 'gfield-input', value: String(val), ...opts });
}
function readNum(inp, label, min, max) {
  const raw = String(inp.value ?? '').trim();
  if (!raw) throw new Error(`${label} is required.`);
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`${label} must be a finite number.`);
  if (min !== undefined && n < min) throw new Error(`${label} must be at least ${min}.`);
  if (max !== undefined && n > max) throw new Error(`${label} must be at most ${max}.`);
  return n;
}
function makeCanvas(w = 680, h = 230) {
  const c = gEl('canvas', { width: w, height: h, class: 'toy-canvas' });
  const bezel = gEl('div', { class: 'graph-bezel' }, c);
  return { c, bezel };
}

/* 1. PHYSICS HUB — Cozy 2.5D Pendulum Laboratory */
function physicsHub(root) {
  const panel = gEl('section', { class: 'game-panel' });
  const presets = gEl('div', { class: 'preset-row' },
    gEl('span', { class: 'gbadge' }, 'World Gravity:'),
    ...[['Earth 9.81', 9.80665], ['Moon 1.62', 1.62], ['Mars 3.72', 3.72], ['Jupiter 24.8', 24.79]].map(([name, g]) =>
      gameBtn(name, 'chip', () => { slG.value = g; resetState(); })
    )
  );

  const slLen = gameSlider({ label: 'Rod Length L', min: 0.2, max: 6, step: 0.1, value: 2, unit: 'm', color: '#7ec3d4', onChange: () => resetState() });
  const slMass = gameSlider({ label: 'Bob Mass m', min: 0.5, max: 20, step: 0.5, value: 2, unit: 'kg', color: '#e78167', onChange: () => resetState() });
  const slG = gameSlider({ label: 'Gravity g', min: 0, max: 30, step: 0.2, value: 9.8, unit: 'm/s²', color: '#f7c46c', onChange: () => resetState() });
  const slAngle = gameSlider({ label: 'Release Angle θ', min: -170, max: 170, step: 5, value: 38, unit: '°', color: '#b89ad9', onChange: () => resetState() });
  const slDamp = gameSlider({ label: 'Air Damping b', min: 0, max: 1.5, step: 0.02, value: 0.02, unit: 's⁻¹', color: '#8fc487', onChange: () => resetState() });

  const { c, bezel } = makeCanvas(700, 320);
  const stAngle = statBox('Angle', '38.0°', 'peach');
  const stSpeed = statBox('Bob Speed', '0.00 m/s', 'cream');
  const stEnergy = statBox('Total Energy', '—', 'cream');
  const stPeriod = statBox('Small-Angle Period', '—', 'cream');
  const keFill = gEl('div', { class: 'meter-fill ke' });
  const peFill = gEl('div', { class: 'meter-fill pe' });
  const energyBar = gEl('div', { class: 'pastel-card cream' },
    gEl('div', { class: 'gslider-head' }, gEl('strong', {}, '⚡ Kinetic vs Potential Energy'), gEl('span', { class: 'gbadge' }, 'RK4 240Hz')),
    gEl('div', { class: 'split-meter' }, keFill, peFill)
  );

  let running = false, frame = 0, last = 0, acc = 0;
  let state = { theta: 38 * PI / 180, omega: 0, time: 0 };
  const startBtn = gameBtn('▶ Start Swing', 'primary', toggleRun);
  const resetBtn = gameBtn('↺ Release Again', '', () => { playBoing(); resetState(); });

  panel.append(
    presets,
    gEl('div', { class: 'two-col' }, slLen.el, slMass.el, slG.el, slAngle.el),
    slDamp.el,
    gEl('div', { class: 'gtabs' }, startBtn, resetBtn),
    bezel,
    energyBar,
    gEl('div', { class: 'stat-grid' }, stAngle.el, stSpeed.el, stEnergy.el, stPeriod.el)
  );
  root.replaceChildren(panel);

  const ctx = c.getContext?.('2d');
  function cfg() { return { length: slLen.num, mass: slMass.num, gravity: slG.num, angle: slAngle.num, damping: slDamp.num }; }
  function resetState() {
    const cf = cfg();
    state = { theta: cf.angle * PI / 180, omega: 0, time: 0 };
    last = 0; acc = 0;
    draw();
  }
  function step(dt) {
    const cf = cfg();
    const f = (t, o) => -cf.gravity / cf.length * Math.sin(t) - cf.damping * o;
    const t = state.theta, o = state.omega;
    const k1t = o, k1o = f(t, o), k2t = o + k1o * dt / 2, k2o = f(t + k1t * dt / 2, k2t);
    const k3t = o + k2o * dt / 2, k3o = f(t + k2t * dt / 2, k3t), k4t = o + k3o * dt, k4o = f(t + k3t * dt, k4t);
    state.theta += dt / 6 * (k1t + 2 * k2t + 2 * k3t + k4t);
    state.omega += dt / 6 * (k1o + 2 * k2o + 2 * k3o + k4o);
    state.time += dt;
  }
  function draw() {
    const cf = cfg();
    const kinetic = 0.5 * cf.mass * (cf.length * state.omega) ** 2;
    const potential = cf.mass * cf.gravity * cf.length * (1 - Math.cos(state.theta));
    const tot = kinetic + potential;
    stAngle.set(`${(state.theta * 180 / PI).toFixed(1)}°`);
    stSpeed.set(`${Math.abs(cf.length * state.omega).toFixed(2)} m/s`);
    stEnergy.set(`${tot.toFixed(2)} J`);
    stPeriod.set(cf.gravity > 0 ? `${(2 * PI * Math.sqrt(cf.length / cf.gravity)).toFixed(2)} s` : '∞');
    const kp = tot > 1e-6 ? (kinetic / tot) * 100 : 0;
    keFill.style.width = `${kp}%`;
    peFill.style.width = `${100 - kp}%`;
    if (!ctx) return;
    const w = c.width, h = c.height, px = w / 2, py = 38;
    const rodPx = 70 + 170 * Math.sqrt(cf.length / 6);
    const bx = px + rodPx * Math.sin(state.theta), by = py + rodPx * Math.cos(state.theta);
    ctx.fillStyle = '#fff9ec';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ead8b7'; ctx.lineWidth = 1.5;
    for (let gx = 40; gx < w; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    for (let gy = 40; gy < h; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
    ctx.setLineDash([6, 6]); ctx.strokeStyle = '#b99364'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + rodPx); ctx.stroke(); ctx.setLineDash([]);
    // Wood beam + brass pivot
    ctx.fillStyle = '#c98550'; ctx.strokeStyle = '#4f2f23'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(px - 70, py - 14, 140, 20, 10); ctx.fill(); ctx.stroke();
    // Rod
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bx, by); ctx.stroke();
    ctx.fillStyle = '#ffe17d'; ctx.beginPath(); ctx.arc(px, py, 8, 0, PI * 2); ctx.fill(); ctx.stroke();
    // Bob
    const r = 16 + 10 * Math.log10(cf.mass + 1);
    ctx.fillStyle = '#e78167'; ctx.beginPath(); ctx.arc(bx, by, r, 0, PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff5ea'; ctx.beginPath(); ctx.arc(bx - r * 0.3, by - r * 0.3, r * 0.25, 0, PI * 2); ctx.fill();
    ctx.fillStyle = '#4f2f23'; ctx.font = 'bold 15px Fredoka, sans-serif';
    ctx.fillText(`t = ${state.time.toFixed(2)} s`, 16, 28);
  }
  function tick(now) {
    if (!running || !c.isConnected) { running = false; startBtn.textContent = '▶ Start Swing'; return; }
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0; last = now; acc += dt;
    while (acc >= 1 / 240) { step(1 / 240); acc -= 1 / 240; }
    draw(); frame = requestAnimationFrame(tick);
  }
  function toggleRun() {
    running = !running;
    startBtn.textContent = running ? '⏸ Pause' : '▶ Resume';
    if (running) { last = 0; frame = requestAnimationFrame(tick); }
    else cancelAnimationFrame(frame);
  }
  draw();
}

/* 2. PERIODIC TABLE — Pastel Interactive Element Tiles */
const ELEMENT_DATA = `H|Hydrogen|1.008
He|Helium|4.002602
Li|Lithium|6.94
Be|Beryllium|9.0121831
B|Boron|10.81
C|Carbon|12.011
N|Nitrogen|14.007
O|Oxygen|15.999
F|Fluorine|18.998403163
Ne|Neon|20.1797
Na|Sodium|22.98976928
Mg|Magnesium|24.305
Al|Aluminium|26.9815385
Si|Silicon|28.085
P|Phosphorus|30.973761998
S|Sulfur|32.06
Cl|Chlorine|35.45
Ar|Argon|39.95
K|Potassium|39.0983
Ca|Calcium|40.078
Sc|Scandium|44.955908
Ti|Titanium|47.867
V|Vanadium|50.9415
Cr|Chromium|51.9961
Mn|Manganese|54.938044
Fe|Iron|55.845
Co|Cobalt|58.933194
Ni|Nickel|58.6934
Cu|Copper|63.546
Zn|Zinc|65.38
Ga|Gallium|69.723
Ge|Germanium|72.630
As|Arsenic|74.921595
Se|Selenium|78.971
Br|Bromine|79.904
Kr|Krypton|83.798
Rb|Rubidium|85.4678
Sr|Strontium|87.62
Y|Yttrium|88.90584
Zr|Zirconium|91.224
Nb|Niobium|92.90637
Mo|Molybdenum|95.95
Tc|Technetium|[98]
Ru|Ruthenium|101.07
Rh|Rhodium|102.90550
Pd|Palladium|106.42
Ag|Silver|107.8682
Cd|Cadmium|112.414
In|Indium|114.818
Sn|Tin|118.710
Sb|Antimony|121.760
Te|Tellurium|127.60
I|Iodine|126.90447
Xe|Xenon|131.293
Cs|Caesium|132.90545196
Ba|Barium|137.327
La|Lanthanum|138.90547
Ce|Cerium|140.116
Pr|Praseodymium|140.90766
Nd|Neodymium|144.242
Pm|Promethium|[145]
Sm|Samarium|150.36
Eu|Europium|151.964
Gd|Gadolinium|157.25
Tb|Terbium|158.92535
Dy|Dysprosium|162.500
Ho|Holmium|164.93033
Er|Erbium|167.259
Tm|Thulium|168.93422
Yb|Ytterbium|173.045
Lu|Lutetium|174.9668
Hf|Hafnium|178.49
Ta|Tantalum|180.94788
W|Tungsten|183.84
Re|Rhenium|186.207
Os|Osmium|190.23
Ir|Iridium|192.217
Pt|Platinum|195.084
Au|Gold|196.966569
Hg|Mercury|200.592
Tl|Thallium|204.38
Pb|Lead|207.2
Bi|Bismuth|208.98040
Po|Polonium|[209]
At|Astatine|[210]
Rn|Radon|[222]
Fr|Francium|[223]
Ra|Radium|[226]
Ac|Actinium|[227]
Th|Thorium|232.0377
Pa|Protactinium|231.03588
U|Uranium|238.02891
Np|Neptunium|[237]
Pu|Plutonium|[244]
Am|Americium|[243]
Cm|Curium|[247]
Bk|Berkelium|[247]
Cf|Californium|[251]
Es|Einsteinium|[252]
Fm|Fermium|[257]
Md|Mendelevium|[258]
No|Nobelium|[259]
Lr|Lawrencium|[266]
Rf|Rutherfordium|[267]
Db|Dubnium|[268]
Sg|Seaborgium|[269]
Bh|Bohrium|[270]
Hs|Hassium|[269]
Mt|Meitnerium|[278]
Ds|Darmstadtium|[281]
Rg|Roentgenium|[282]
Cn|Copernicium|[285]
Nh|Nihonium|[286]
Fl|Flerovium|[289]
Mc|Moscovium|[290]
Lv|Livermorium|[293]
Ts|Tennessine|[294]
Og|Oganesson|[294]`;

const CAT_COLORS = {
  'Alkali metal': '#ffd0be',
  'Alkaline earth metal': '#ffe5a8',
  'Transition metal': '#f7d8b4',
  'Post-transition metal': '#d4e4f7',
  'Metalloid': '#d9f0c7',
  'Other nonmetal': '#b8e8ca',
  'Halogen': '#bfe8f2',
  'Noble gas': '#e4d2f7',
  'Lanthanide': '#f8cfe0',
  'Actinide': '#f6c3cb'
};

const ELEMENTS = ELEMENT_DATA.split('\n').map((line, index) => {
  const [symbol, name, mass] = line.split('|'), z = index + 1;
  let period, group;
  if (z <= 2) { period = 1; group = z === 1 ? 1 : 18; }
  else if (z <= 10) { period = 2; group = z <= 4 ? z - 2 : z + 8; }
  else if (z <= 18) { period = 3; group = z <= 12 ? z - 10 : z; }
  else if (z <= 36) { period = 4; group = z - 18; }
  else if (z <= 54) { period = 5; group = z - 36; }
  else if (z <= 86) { period = 6; group = z <= 56 ? z - 54 : z >= 72 ? z - 68 : null; }
  else { period = 7; group = z <= 88 ? z - 86 : z >= 104 ? z - 100 : null; }
  const lanthanide = z >= 57 && z <= 71, actinide = z >= 89 && z <= 103;
  const column = lanthanide ? z - 54 : actinide ? z - 86 : group;
  const row = lanthanide ? 9 : actinide ? 10 : period;
  let category;
  if (lanthanide) category = 'Lanthanide';
  else if (actinide) category = 'Actinide';
  else if (group === 18) category = 'Noble gas';
  else if (group === 17) category = 'Halogen';
  else if ([5, 14, 32, 33, 51, 52].includes(z)) category = 'Metalloid';
  else if ([1, 6, 7, 8, 15, 16, 34].includes(z)) category = 'Other nonmetal';
  else if (group === 1) category = 'Alkali metal';
  else if (group === 2) category = 'Alkaline earth metal';
  else if (group >= 3 && group <= 12) category = 'Transition metal';
  else category = 'Post-transition metal';
  return { z, symbol, name, mass, period, group, column, row, category };
});

function periodicTable(root) {
  const panel = gEl('section', { class: 'game-panel' });
  const searchIn = gEl('input', { type: 'text', class: 'gfield-input', placeholder: 'Search Gold, Fe, 79, Neon…', 'aria-label': 'Find element' });
  const cats = [['', 'All 118'], ...Object.keys(CAT_COLORS).map(c => [c, c])];
  const catTabs = gameTabs(cats, '', () => update(), 'Element Family');
  const card = gEl('div', { class: 'elem-spotlight-card' });
  const grid = gEl('div', { class: 'periodic-grid-25d' });
  const buttons = [];

  function pick(e) {
    playPop(620);
    for (const b of buttons) b.classList.toggle('is-picked', Number(b.dataset.z) === e.z);
    const state = [35, 80].includes(e.z) ? '💧 Liquid' : [1, 2, 7, 8, 9, 10, 17, 18, 36, 54, 86].includes(e.z) ? '☁️ Gas' : e.z >= 104 || [85, 87, 100, 101, 102, 103].includes(e.z) ? '✨ Predicted' : '🧊 Solid';
    card.style.background = CAT_COLORS[e.category];
    card.replaceChildren(
      gEl('div', { class: 'elem-big-tile' }, gEl('small', {}, `#${e.z}`), gEl('strong', {}, e.symbol)),
      gEl('div', { class: 'elem-info' },
        gEl('h3', {}, `${e.name} (${e.symbol})`),
        gEl('div', { class: 'preset-row' },
          gEl('span', { class: 'gbadge' }, e.category),
          gEl('span', { class: 'gbadge' }, state),
          gEl('span', { class: 'gbadge' }, `Mass: ${e.mass}`),
          gEl('span', { class: 'gbadge' }, `Period ${e.period} · Group ${e.group || 'f-block'}`)
        )
      )
    );
  }

  for (const e of ELEMENTS) {
    const b = gEl('button', {
      type: 'button', class: 'elem-tile-btn',
      style: { gridColumn: String(e.column), gridRow: String(e.row), background: CAT_COLORS[e.category] },
      'data-z': String(e.z), title: `${e.z}. ${e.name}`
    }, gEl('small', {}, e.z), gEl('strong', {}, e.symbol));
    b.addEventListener('click', () => pick(e));
    buttons.push(b);
    grid.append(b);
  }

  function update() {
    const q = searchIn.value.trim().toLowerCase();
    const fam = catTabs.value;
    ELEMENTS.forEach((e, i) => {
      const ok = (!q || e.name.toLowerCase().includes(q) || e.symbol.toLowerCase() === q || String(e.z) === q || (q === 'aluminum' && e.z === 13)) && (!fam || e.category === fam);
      buttons[i].style.opacity = ok ? '1' : '0.18';
      buttons[i].disabled = !ok;
    });
  }

  searchIn.addEventListener('input', update);
  panel.append(gameField('Find Element', searchIn), catTabs.el, card, gEl('div', { class: 'periodic-scroll' }, grid));
  root.replaceChildren(panel);
  pick(ELEMENTS[0]);
}

/* 3. MOTION — Rocket Track Visualizer */
function motion(root) {
  const panel = gEl('section', { class: 'game-panel' });
  const uIn = numInput(0), aIn = numInput(9.81), tIn = numInput(3);
  const { c, bezel } = makeCanvas(640, 170);
  const stV = statBox('Final Speed v', '—', 'peach');
  const stS = statBox('Displacement s', '—', 'cream');
  const stD = statBox('Distance', '—', 'cream');
  const stAvg = statBox('Average Speed', '—', 'cream');
  const errBox = gEl('p', { class: 'output error', hidden: true });

  function update() {
    try {
      errBox.hidden = true;
      const u = readNum(uIn, 'Initial speed u'), a = readNum(aIn, 'Acceleration a'), t = positive(readNum(tIn, 'Elapsed time t', 0), 'Time', true);
      const v = u + a * t, s = u * t + 0.5 * a * t * t;
      let dist = Math.abs(s);
      if (a !== 0) { const turn = -u / a; if (turn > 0 && turn < t) { const f = u * turn + 0.5 * a * turn * turn; dist = Math.abs(f) + Math.abs(s - f); } }
      stV.set(`${numberText(v)} m/s`);
      stS.set(`${numberText(s)} m`);
      stD.set(`${numberText(dist)} m`);
      stAvg.set(t ? `${numberText(s / t)} m/s` : '—');
      const ctx = c.getContext?.('2d');
      if (ctx) {
        const w = c.width, h = c.height;
        ctx.fillStyle = '#e8f5ff'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#c98550'; ctx.fillRect(0, h - 36, w, 36);
        ctx.strokeStyle = '#4f2f23'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0, h - 36); ctx.lineTo(w, h - 36); ctx.stroke();
        const span = Math.max(10, Math.abs(s) * 1.4);
        const rx = w / 2 + (s / span) * (w * 0.36);
        ctx.fillStyle = '#ffe17d'; ctx.beginPath(); ctx.roundRect(rx - 26, h - 78, 52, 34, 12); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e78167'; ctx.beginPath(); ctx.arc(rx - 14, h - 42, 9, 0, PI * 2); ctx.arc(rx + 14, h - 42, 9, 0, PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#4f2f23'; ctx.font = 'bold 14px Fredoka, sans-serif';
        ctx.fillText(`0 m`, w / 2 - 12, h - 14);
        ctx.fillText(`s = ${numberText(s)} m`, Math.min(w - 130, Math.max(16, rx - 30)), 34);
      }
    } catch (e) { errBox.hidden = false; errBox.textContent = e.message; }
  }
  [uIn, aIn, tIn].forEach(i => i.addEventListener('input', update));
  panel.append(
    gEl('div', { class: 'two-col' }, gameField('Initial Speed u (m/s)', uIn), gameField('Acceleration a (m/s²)', aIn)),
    gameField('Time t (s)', tIn),
    bezel, errBox,
    gEl('div', { class: 'stat-grid' }, stV.el, stS.el, stD.el, stAvg.el)
  );
  root.replaceChildren(panel);
  update();
}

/* 4. FORCE — Cartoon Crate & Planet Gravity */
function force(root) {
  const panel = gEl('section', { class: 'game-panel' });
  const mIn = numInput(10), aIn = numInput(2.5), gIn = numInput(9.81), vIn = numInput(4);
  const stF = statBox('Net Force (ma)', '—', 'peach');
  const stW = statBox('Weight (mg)', '—', 'cream');
  const stP = statBox('Momentum (mv)', '—', 'cream');
  const crate = gEl('div', { class: 'force-crate-stage' });
  const errBox = gEl('p', { class: 'output error', hidden: true });

  const presets = gEl('div', { class: 'preset-row' },
    ...[['Earth', 9.80665], ['Moon', 1.62], ['Mars', 3.72], ['Jupiter', 24.79]].map(([n, gv]) =>
      gameBtn(`${n} g=${gv}`, 'chip', () => { gIn.value = gv; update(); })
    )
  );

  function update() {
    try {
      errBox.hidden = true;
      const m = positive(readNum(mIn, 'Mass'), 'Mass'), a = readNum(aIn, 'Acceleration'), g = positive(readNum(gIn, 'Gravity', 0), 'Gravity', true), v = readNum(vIn, 'Velocity');
      stF.set(`${numberText(m * a)} N`);
      stW.set(`${numberText(m * g)} N`);
      stP.set(`${numberText(m * v)} kg·m/s`);
      crate.replaceChildren(
        gEl('span', { class: 'gbadge' }, a >= 0 ? 'Push →' : '← Push'),
        gEl('div', { class: 'wooden-crate-box' }, `${m} kg`),
        gEl('span', { class: 'gbadge' }, `${numberText(m * a)} N`)
      );
    } catch (e) { errBox.hidden = false; errBox.textContent = e.message; }
  }
  [mIn, aIn, gIn, vIn].forEach(i => i.addEventListener('input', update));
  panel.append(
    presets,
    gEl('div', { class: 'two-col' }, gameField('Mass m (kg)', mIn), gameField('Acceleration a (m/s²)', aIn), gameField('Gravity g (m/s²)', gIn), gameField('Velocity v (m/s)', vIn)),
    crate, errBox,
    gEl('div', { class: 'stat-grid' }, stF.el, stW.el, stP.el)
  );
  root.replaceChildren(panel);
  update();
}

/* 5. ENERGY — Kinetic + Potential + Spring Meter */
function energy(root) {
  const panel = gEl('section', { class: 'game-panel' });
  const mIn = numInput(2), vIn = numInput(4), hIn = numInput(5), gIn = numInput(9.81), kIn = numInput(120), xIn = numInput(0.15);
  const stK = statBox('Kinetic ½mv²', '—', 'peach');
  const stP = statBox('Gravity mgh', '—', 'cream');
  const stS = statBox('Spring ½kx²', '—', 'cream');
  const stT = statBox('Total Energy', '—', 'cream');
  const barK = gEl('div', { class: 'meter-fill ke' });
  const barP = gEl('div', { class: 'meter-fill pe' });
  const errBox = gEl('p', { class: 'output error', hidden: true });

  function update() {
    try {
      errBox.hidden = true;
      const m = positive(readNum(mIn, 'Mass'), 'Mass'), v = positive(readNum(vIn, 'Speed', 0), 'Speed', true);
      const h = readNum(hIn, 'Height'), g = positive(readNum(gIn, 'Gravity', 0), 'Gravity', true);
      const k = positive(readNum(kIn, 'Spring k', 0), 'Spring k', true), x = readNum(xIn, 'Displacement x');
      const ke = 0.5 * m * v * v, pe = m * g * h, sp = 0.5 * k * x * x, tot = ke + pe + sp;
      stK.set(`${numberText(ke)} J`); stP.set(`${numberText(pe)} J`); stS.set(`${numberText(sp)} J`); stT.set(`${numberText(tot)} J`);
      const denom = Math.max(1e-9, Math.abs(ke) + Math.abs(pe) + Math.abs(sp));
      barK.style.width = `${(Math.abs(ke) / denom) * 100}%`;
      barP.style.width = `${(Math.abs(pe) / denom) * 100}%`;
    } catch (e) { errBox.hidden = false; errBox.textContent = e.message; }
  }
  [mIn, vIn, hIn, gIn, kIn, xIn].forEach(i => i.addEventListener('input', update));
  panel.append(
    gEl('div', { class: 'two-col' }, gameField('Mass m (kg)', mIn), gameField('Speed v (m/s)', vIn), gameField('Height h (m)', hIn), gameField('Gravity g (m/s²)', gIn), gameField('Spring k (N/m)', kIn), gameField('Spring x (m)', xIn)),
    gEl('div', { class: 'split-meter' }, barK, barP),
    errBox,
    gEl('div', { class: 'stat-grid' }, stK.el, stP.el, stS.el, stT.el)
  );
  root.replaceChildren(panel);
  update();
}

/* 6. GRAVITY — Orbit & Escape Speed Toy */
function gravity(root) {
  const panel = gEl('section', { class: 'game-panel' });
  const m1In = numInput('5.9722e24'), m2In = numInput(100), rIn = numInput('6371000');
  const presets = gEl('div', { class: 'preset-row' },
    ...[['Earth Surface', '5.9722e24', '6371000'], ['ISS Orbit', '5.9722e24', '6791000'], ['Moon Surface', '7.342e22', '1737400'], ['Sun Surface', '1.9885e30', '696340000']].map(([n, m, r]) =>
      gameBtn(n, 'chip', () => { m1In.value = m; rIn.value = r; update(); })
    )
  );
  const stF = statBox('Gravity Force', '—', 'peach');
  const stG = statBox('Surface g', '—', 'cream');
  const stOrb = statBox('Orbital Speed', '—', 'cream');
  const stEsc = statBox('Escape Speed', '—', 'cream');
  const errBox = gEl('p', { class: 'output error', hidden: true });

  function update() {
    try {
      errBox.hidden = true;
      const m1 = positive(readNum(m1In, 'Central mass M'), 'Central mass'), m2 = positive(readNum(m2In, 'Test mass m'), 'Test mass'), r = positive(readNum(rIn, 'Distance r'), 'Distance');
      const mu = G * m1;
      stF.set(`${numberText(mu / r / r * m2)} N`);
      stG.set(`${numberText(mu / r / r)} m/s²`);
      stOrb.set(`${numberText(Math.sqrt(mu / r))} m/s`);
      stEsc.set(`${numberText(Math.sqrt(2 * mu / r))} m/s`);
    } catch (e) { errBox.hidden = false; errBox.textContent = e.message; }
  }
  [m1In, m2In, rIn].forEach(i => i.addEventListener('input', update));
  panel.append(presets, gEl('div', { class: 'two-col' }, gameField('Central Mass M (kg)', m1In), gameField('Object Mass m (kg)', m2In)), gameField('Distance r (m)', rIn), errBox, gEl('div', { class: 'stat-grid' }, stF.el, stG.el, stOrb.el, stEsc.el));
  root.replaceChildren(panel);
  update();
}

/* 7. WAVES — Live Oscilloscope Canvas */
function waves(root) {
  const panel = gEl('section', { class: 'game-panel' });
  const solve = gameTabs([['speed', 'Find Speed v'], ['frequency', 'Find Freq f'], ['wavelength', 'Find λ']], 'speed', () => update(), 'Solve For');
  const vIn = numInput(343), fIn = numInput(440), lIn = numInput(0.7795);
  const { c, bezel } = makeCanvas(640, 170);
  const stV = statBox('Speed v', '—', 'peach');
  const stF = statBox('Frequency f', '—', 'cream');
  const stL = statBox('Wavelength λ', '—', 'cream');
  const stT = statBox('Period T', '—', 'cream');
  const errBox = gEl('p', { class: 'output error', hidden: true });

  const presets = gEl('div', { class: 'preset-row' },
    gameBtn('Sound A4 (440 Hz)', 'chip', () => { solve.value = 'wavelength'; vIn.value = 343; fIn.value = 440; update(); }),
    gameBtn('Ocean Swell', 'chip', () => { solve.value = 'speed'; fIn.value = 0.2; lIn.value = 25; update(); })
  );

  function update() {
    try {
      errBox.hidden = true;
      let spd = readNum(vIn, 'Speed', 0), freq = readNum(fIn, 'Frequency', 0), lam = readNum(lIn, 'Wavelength', 0);
      if (solve.value === 'speed') { positive(freq, 'Frequency'); positive(lam, 'Wavelength'); spd = freq * lam; vIn.value = numberText(spd); }
      else if (solve.value === 'frequency') { positive(spd, 'Speed'); positive(lam, 'Wavelength'); freq = spd / lam; fIn.value = numberText(freq); }
      else { positive(spd, 'Speed'); positive(freq, 'Frequency'); lam = spd / freq; lIn.value = numberText(lam); }
      stV.set(`${numberText(spd)} m/s`); stF.set(`${numberText(freq)} Hz`); stL.set(`${numberText(lam)} m`); stT.set(`${numberText(1 / freq)} s`);
      const ctx = c.getContext?.('2d');
      if (ctx) {
        const w = c.width, h = c.height;
        ctx.fillStyle = '#dce8c2'; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#99b879'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
        const cycles = Math.min(18, Math.max(1.5, 4 / Math.max(0.05, Math.min(5, lam))));
        ctx.strokeStyle = '#4f2f23'; ctx.lineWidth = 4;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 2) {
          const y = h / 2 - Math.sin((x / w) * cycles * PI * 2) * (h * 0.34);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    } catch (e) { errBox.hidden = false; errBox.textContent = e.message; }
  }
  [vIn, fIn, lIn].forEach(i => i.addEventListener('input', update));
  panel.append(presets, solve.el, gEl('div', { class: 'two-col' }, gameField('Wave Speed v (m/s)', vIn), gameField('Frequency f (Hz)', fIn), gameField('Wavelength λ (m)', lIn)), bezel, errBox, gEl('div', { class: 'stat-grid' }, stV.el, stF.el, stL.el, stT.el));
  root.replaceChildren(panel);
  update();
}

/* 8. ELECTRICITY — Glowing Ohm's Law Circuit */
function electricity(root) {
  const panel = gEl('section', { class: 'game-panel' });
  const solve = gameTabs([['current', 'Find Current I'], ['voltage', 'Find Voltage V'], ['resistance', 'Find Ohms R']], 'current', () => update(), 'Solve For');
  const vIn = numInput(12), iIn = numInput(2), rIn = numInput(6), tIn = numInput(60);
  const bulb = gEl('div', { class: 'bulb-badge' }, '💡');
  const stV = statBox('Voltage', '12 V', 'peach');
  const stI = statBox('Current', '2 A', 'cream');
  const stR = statBox('Resistance', '6 Ω', 'cream');
  const stP = statBox('Power & Energy', '24 W', 'cream');
  const errBox = gEl('p', { class: 'output error', hidden: true });

  function update() {
    try {
      errBox.hidden = true;
      let V = readNum(vIn, 'Voltage'), I = readNum(iIn, 'Current'), Rval = readNum(rIn, 'Resistance', 0), T = positive(readNum(tIn, 'Time', 0), 'Time', true);
      if (solve.value === 'current') { positive(Rval, 'Resistance'); I = V / Rval; iIn.value = numberText(I); }
      else if (solve.value === 'voltage') { positive(Rval, 'Resistance'); V = I * Rval; vIn.value = numberText(V); }
      else { if (I === 0) throw new Error('Current cannot be zero.'); Rval = V / I; positive(Rval, 'Resistance'); rIn.value = numberText(Rval); }
      const P = Math.abs(V * I);
      stV.set(`${numberText(V)} V`); stI.set(`${numberText(I)} A`); stR.set(`${numberText(Rval)} Ω`); stP.set(`${numberText(P)} W · ${numberText(P * T)} J`);
      bulb.style.background = P > 30 ? '#ffe17d' : P > 5 ? '#fff2b8' : '#e6dcc8';
    } catch (e) { errBox.hidden = false; errBox.textContent = e.message; }
  }
  [vIn, iIn, rIn, tIn].forEach(i => i.addEventListener('input', update));
  panel.append(solve.el, gEl('div', { class: 'circuit-banner' }, bulb, gEl('strong', {}, 'V = I × R  ·  P = V × I')), gEl('div', { class: 'two-col' }, gameField('Voltage V (V)', vIn), gameField('Current I (A)', iIn), gameField('Resistance R (Ω)', rIn), gameField('Time t (s)', tIn)), errBox, gEl('div', { class: 'stat-grid' }, stV.el, stI.el, stR.el, stP.el));
  root.replaceChildren(panel);
  update();
}

/* 9. OPTICS — Ray Refraction & Lens Diagram */
function optics(root) {
  const panel = gEl('section', { class: 'game-panel' });
  const mode = gameTabs([['snell', 'Snell Refraction'], ['lens', 'Thin Lens']], 'snell', () => update(), 'Optics Mode');
  const fIn = numInput(0.1), uIn = numInput(0.3), n1In = numInput(1.0), n2In = numInput(1.5), angSl = gameSlider({ label: 'Incidence Angle', min: 0, max: 89, step: 1, value: 35, unit: '°', color: '#7ec3d4', onChange: () => update() });
  const { c, bezel } = makeCanvas(640, 200);
  const out = gEl('div', { class: 'output' });

  function update() {
    const ctx = c.getContext?.('2d');
    try {
      if (mode.value === 'snell') {
        const n1 = positive(readNum(n1In, 'n₁', 0.1), 'n₁'), n2 = positive(readNum(n2In, 'n₂', 0.1), 'n₂'), ang = angSl.num;
        const s = n1 / n2 * Math.sin(ang * PI / 180);
        const tir = s > 1;
        const refr = tir ? null : Math.asin(s) * 180 / PI;
        out.className = 'output';
        out.textContent = tir ? `Total Internal Reflection! Critical angle: ${numberText(Math.asin(n2 / n1) * 180 / PI)}°` : `Refraction angle θ₂ = ${numberText(refr)}° · Reflection = ${ang}°`;
        if (ctx) {
          const w = c.width, h = c.height, cx = w / 2, cy = h / 2;
          ctx.fillStyle = '#fff9ec'; ctx.fillRect(0, 0, w, cy);
          ctx.fillStyle = '#d8eef9'; ctx.fillRect(0, cy, w, cy);
          ctx.strokeStyle = '#4f2f23'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
          ctx.beginPath(); ctx.moveTo(cx, 10); ctx.lineTo(cx, h - 10); ctx.stroke(); ctx.setLineDash([]);
          const rad1 = ang * PI / 180;
          ctx.strokeStyle = '#e78167'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(cx - Math.sin(rad1) * 120, cy - Math.cos(rad1) * 120); ctx.lineTo(cx, cy); ctx.stroke();
          ctx.strokeStyle = '#5577ee';
          ctx.beginPath(); ctx.moveTo(cx, cy);
          if (tir) ctx.lineTo(cx + Math.sin(rad1) * 120, cy - Math.cos(rad1) * 120);
          else { const rad2 = refr * PI / 180; ctx.lineTo(cx + Math.sin(rad2) * 120, cy + Math.cos(rad2) * 120); }
          ctx.stroke();
        }
      } else {
        const f = readNum(fIn, 'Focal length f'), u = positive(readNum(uIn, 'Object distance u', 0.001), 'u');
        if (!f) throw new Error('Focal length cannot be zero.');
        if (Math.abs(u - f) < 1e-9) { out.textContent = 'Object at focal point → parallel rays (image at ∞).'; return; }
        const v = f * u / (u - f), mag = -v / u;
        out.className = 'output';
        out.textContent = `Image distance v = ${numberText(v)} m · Magnification = ${numberText(mag)} (${v > 0 ? 'real' : 'virtual'}, ${mag < 0 ? 'inverted' : 'upright'})`;
        if (ctx) {
          const w = c.width, h = c.height, cx = w / 2, cy = h / 2;
          ctx.fillStyle = '#fff9ec'; ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = '#b99364'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(20, cy); ctx.lineTo(w - 20, cy); ctx.stroke();
          ctx.fillStyle = '#bfe8f2'; ctx.strokeStyle = '#4f2f23'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.ellipse(cx, cy, 12, 75, 0, 0, PI * 2); ctx.fill(); ctx.stroke();
        }
      }
    } catch (e) { out.className = 'output error'; out.textContent = e.message; }
  }
  [fIn, uIn, n1In, n2In].forEach(i => i.addEventListener('input', update));
  panel.append(mode.el, angSl.el, gEl('div', { class: 'two-col' }, gameField('n₁ (Medium 1)', n1In), gameField('n₂ (Medium 2)', n2In), gameField('Focal f (m)', fIn), gameField('Object u (m)', uIn)), bezel, out);
  root.replaceChildren(panel);
  update();
}

/* 10. PRESSURE — Submarine Depth Gauge */
function pressure(root) {
  const panel = gEl('section', { class: 'game-panel' });
  const fIn = numInput(120), aIn = numInput(0.02), rhoIn = numInput(1000), hSl = gameSlider({ label: 'Fluid Depth h', min: 0, max: 100, step: 1, value: 10, unit: 'm', color: '#7ec3d4', onChange: () => update() });
  const stC = statBox('Contact P = F/A', '—', 'peach');
  const stG = statBox('Gauge ρgh', '—', 'cream');
  const stA = statBox('Total Pressure', '—', 'cream');
  const stAtm = statBox('Atmospheres', '—', 'cream');
  const errBox = gEl('p', { class: 'output error', hidden: true });

  function update() {
    try {
      errBox.hidden = true;
      const F = positive(readNum(fIn, 'Force', 0), 'Force', true), A = positive(readNum(aIn, 'Area'), 'Area'), rho = positive(readNum(rhoIn, 'Density'), 'Density'), h = hSl.num;
      const contact = F / A, gauge = rho * 9.80665 * h, abs = 101325 + gauge;
      stC.set(`${numberText(contact)} Pa`); stG.set(`${numberText(gauge)} Pa`); stA.set(`${numberText(abs / 1000)} kPa`); stAtm.set(`${numberText(abs / 101325)} atm`);
    } catch (e) { errBox.hidden = false; errBox.textContent = e.message; }
  }
  [fIn, aIn, rhoIn].forEach(i => i.addEventListener('input', update));
  panel.append(hSl.el, gEl('div', { class: 'two-col' }, gameField('Contact Force F (N)', fIn), gameField('Area A (m²)', aIn), gameField('Fluid Density ρ (kg/m³)', rhoIn)), errBox, gEl('div', { class: 'stat-grid' }, stC.el, stG.el, stA.el, stAtm.el));
  root.replaceChildren(panel);
  update();
}

/* 11. DENSITY — Float or Sink Water Tank */
function density(root) {
  const panel = gEl('section', { class: 'game-panel' });
  const solve = gameTabs([['density', 'Find ρ'], ['mass', 'Find Mass m'], ['volume', 'Find Vol V']], 'density', () => update(), 'Solve For');
  const rhoIn = numInput(750), mIn = numInput(1.5), vIn = numInput(0.002);
  const tank = gEl('div', { class: 'float-tank' });
  const cube = gEl('div', { class: 'float-cube' }, 'Block');
  const floatBadge = gEl('span', { class: 'gbadge' });
  tank.append(cube, floatBadge);
  const stR = statBox('Density', '—', 'peach');
  const stG = statBox('g/cm³', '—', 'cream');
  const errBox = gEl('p', { class: 'output error', hidden: true });

  const presets = gEl('div', { class: 'preset-row' },
    ...[['Oak 750', 750], ['Ice 917', 917], ['Water 1000', 1000], ['Gold 19300', 19300]].map(([n, d]) =>
      gameBtn(n, 'chip', () => { solve.value = 'mass'; rhoIn.value = d; update(); })
    )
  );

  function update() {
    try {
      errBox.hidden = true;
      let rho = readNum(rhoIn, 'Density', 0), m = readNum(mIn, 'Mass', 0), V = readNum(vIn, 'Volume', 0);
      if (solve.value === 'density') { positive(m, 'Mass'); positive(V, 'Volume'); rho = m / V; rhoIn.value = numberText(rho); }
      else if (solve.value === 'mass') { positive(rho, 'Density'); positive(V, 'Volume'); m = rho * V; mIn.value = numberText(m); }
      else { positive(rho, 'Density'); positive(m, 'Mass'); V = m / rho; vIn.value = numberText(V); }
      stR.set(`${numberText(rho)} kg/m³`);
      stG.set(`${numberText(rho / 1000)} g/cm³`);
      const floats = rho < 1000;
      cube.style.transform = `translateY(${floats ? '-22px' : rho === 1000 ? '0px' : '26px'})`;
      floatBadge.textContent = floats ? '🛟 Floats in Water!' : rho === 1000 ? '〰 Neutral Buoyancy' : '⚓ Sinks in Water!';
    } catch (e) { errBox.hidden = false; errBox.textContent = e.message; }
  }
  [rhoIn, mIn, vIn].forEach(i => i.addEventListener('input', update));
  panel.append(presets, solve.el, gEl('div', { class: 'two-col' }, gameField('Density ρ (kg/m³)', rhoIn), gameField('Mass m (kg)', mIn), gameField('Volume V (m³)', vIn)), tank, errBox, gEl('div', { class: 'stat-grid' }, stR.el, stG.el));
  root.replaceChildren(panel);
  update();
}

/* 12. TEMPERATURE — Glowing Thermometer Toy */
function temperature(root) {
  const panel = gEl('section', { class: 'game-panel' });
  const unit = gameTabs([['C', '°C Celsius'], ['F', '°F Fahrenheit'], ['K', 'K Kelvin']], 'C', () => update(), 'Input Scale');
  const valIn = numInput(22);
  const presets = gEl('div', { class: 'preset-row' },
    ...[['Freezing 0°C', 0, 'C'], ['Room 22°C', 22, 'C'], ['Body 98.6°F', 98.6, 'F'], ['Boiling 100°C', 100, 'C']].map(([n, v, u]) =>
      gameBtn(n, 'chip', () => { unit.value = u; valIn.value = v; update(); })
    )
  );
  const mercury = gEl('div', { class: 'thermo-fill' });
  const thermo = gEl('div', { class: 'thermo-bar' }, mercury);
  const stC = statBox('Celsius', '22 °C', 'peach');
  const stF = statBox('Fahrenheit', '71.6 °F', 'cream');
  const stK = statBox('Kelvin', '295.15 K', 'cream');
  const errBox = gEl('p', { class: 'output error', hidden: true });

  function update() {
    try {
      errBox.hidden = true;
      const k = kelvin(readNum(valIn, 'Temperature'), unit.value);
      const c = fromKelvin(k, 'C'), f = fromKelvin(k, 'F');
      stC.set(`${numberText(c)} °C`); stF.set(`${numberText(f)} °F`); stK.set(`${numberText(k)} K`);
      const pct = Math.min(100, Math.max(4, ((c + 40) / 160) * 100));
      mercury.style.width = `${pct}%`;
      mercury.style.background = c <= 0 ? '#7ec3d4' : c >= 60 ? '#e78167' : '#f7c46c';
    } catch (e) { errBox.hidden = false; errBox.textContent = e.message; }
  }
  valIn.addEventListener('input', update);
  panel.append(presets, unit.el, gameField('Temperature Value', valIn), thermo, errBox, gEl('div', { class: 'stat-grid' }, stC.el, stF.el, stK.el));
  root.replaceChildren(panel);
  update();
}

/* 13. IDEAL GAS — Bouncing Particle Box */
function idealGas(root) {
  const panel = gEl('section', { class: 'game-panel' });
  const solve = gameTabs([['P', 'Find P'], ['V', 'Find V'], ['n', 'Find n'], ['T', 'Find T']], 'P', () => update(), 'Solve PV = nRT');
  const pIn = numInput(101325), vIn = numInput(0.024), nIn = numInput(1), tIn = numInput(293.15);
  const stP = statBox('Pressure', '—', 'peach');
  const stV = statBox('Volume', '—', 'cream');
  const stN = statBox('Moles', '—', 'cream');
  const stT = statBox('Temp', '—', 'cream');
  const errBox = gEl('p', { class: 'output error', hidden: true });

  function update() {
    try {
      errBox.hidden = true;
      let P = readNum(pIn, 'P', 0), V = readNum(vIn, 'V', 0), n = readNum(nIn, 'n', 0), T = readNum(tIn, 'T', 0);
      for (const [k, l, val] of [['P', 'Pressure', P], ['V', 'Volume', V], ['n', 'Amount', n], ['T', 'Temperature', T]]) if (solve.value !== k) positive(val, l);
      if (solve.value === 'P') { P = n * R * T / V; pIn.value = numberText(P); }
      else if (solve.value === 'V') { V = n * R * T / P; vIn.value = numberText(V); }
      else if (solve.value === 'n') { n = P * V / (R * T); nIn.value = numberText(n); }
      else { T = P * V / (n * R); tIn.value = numberText(T); }
      stP.set(`${numberText(P / 101325)} atm`); stV.set(`${numberText(V * 1000)} L`); stN.set(`${numberText(n)} mol`); stT.set(`${numberText(T)} K`);
    } catch (e) { errBox.hidden = false; errBox.textContent = e.message; }
  }
  [pIn, vIn, nIn, tIn].forEach(i => i.addEventListener('input', update));
  panel.append(solve.el, gEl('div', { class: 'two-col' }, gameField('Pressure P (Pa)', pIn), gameField('Volume V (m³)', vIn), gameField('Moles n (mol)', nIn), gameField('Temp T (K)', tIn)), errBox, gEl('div', { class: 'stat-grid' }, stP.el, stV.el, stN.el, stT.el));
  root.replaceChildren(panel);
  update();
}

/* 14. HALF-LIFE — Visual Decaying Atom Grid */
function halfLife(root) {
  const panel = gEl('section', { class: 'game-panel' });
  const n0In = numInput(100), tSl = gameSlider({ label: 'Elapsed Time t', min: 0, max: 100, step: 1, value: 20, unit: 's', color: '#8fc487', onChange: () => update() });
  const hSl = gameSlider({ label: 'Half-Life T½', min: 1, max: 50, step: 1, value: 10, unit: 's', color: '#b89ad9', onChange: () => update() });
  const atomGrid = gEl('div', { class: 'atom-decay-grid' });
  const stRem = statBox('Remaining N', '25', 'peach');
  const stPct = statBox('Remaining %', '25%', 'cream');

  function update() {
    const n0 = Math.max(0.01, Number(n0In.value) || 100), t = tSl.num, half = hSl.num;
    const rem = n0 * Math.exp(-LN2 * t / half), frac = rem / n0;
    stRem.set(numberText(rem));
    stPct.set(`${(frac * 100).toFixed(1)}%`);
    const liveDots = Math.round(frac * 40);
    atomGrid.replaceChildren(...Array.from({ length: 40 }, (_, i) =>
      gEl('span', { class: `atom-dot ${i < liveDots ? 'is-live' : 'is-decayed'}` })
    ));
  }
  n0In.addEventListener('input', update);
  panel.append(gameField('Initial Amount N₀', n0In), tSl.el, hSl.el, atomGrid, gEl('div', { class: 'stat-grid' }, stRem.el, stPct.el));
  root.replaceChildren(panel);
  update();
}

/* 15. CONSTANTS — Tappable Constant Cards */
const CONSTANTS = [
  ['Speed of light in vacuum', 'c', C, 'm/s', 'Exact'],
  ['Planck constant', 'h', H, 'J·s', 'Exact'],
  ['Reduced Planck constant', 'ℏ', H / (2 * PI), 'J·s', 'h/(2π)'],
  ['Elementary charge', 'e', 1.602176634e-19, 'C', 'Exact'],
  ['Boltzmann constant', 'kB', 1.380649e-23, 'J/K', 'Exact'],
  ['Avogadro constant', 'NA', 6.02214076e23, 'mol⁻¹', 'Exact'],
  ['Molar gas constant', 'R', R, 'J/(mol·K)', 'Exact'],
  ['Gravitational constant', 'G', G, 'm³/(kg·s²)', 'CODATA 2022'],
  ['Standard gravity', 'g0', 9.80665, 'm/s²', 'Conventional'],
  ['Standard atmosphere', 'atm', 101325, 'Pa', 'Exact'],
  ['Electron mass', 'me', 9.1093837139e-31, 'kg', 'CODATA 2022'],
  ['Proton mass', 'mp', 1.67262192595e-27, 'kg', 'CODATA 2022'],
  ['Coulomb constant', 'ke', 8.9875517862e9, 'N·m²/C²', 'Derived'],
  ['Fine-structure constant', 'α', 7.2973525643e-3, '—', 'CODATA 2022'],
  ['Stefan–Boltzmann', 'σ', 5.670374419e-8, 'W/(m²·K⁴)', 'Derived'],
  ['Bohr radius', 'a0', 5.29177210544e-11, 'm', 'CODATA 2022']
];

function constants(root) {
  const panel = gEl('section', { class: 'game-panel' });
  const qIn = gEl('input', { type: 'text', class: 'gfield-input', placeholder: 'Filter constants… e.g. Planck, c, mass' });
  const deck = gEl('div', { class: 'two-col' });
  function render() {
    const q = qIn.value.trim().toLowerCase();
    const list = CONSTANTS.filter(row => row.join(' ').toLowerCase().includes(q));
    deck.replaceChildren(...list.map(([name, sym, val, unit, note]) => {
      const card = gEl('div', { class: 'pastel-card cream' },
        gEl('div', { class: 'gslider-head' }, gEl('strong', {}, `${name} (${sym})`), gEl('span', { class: 'gbadge' }, note)),
        gEl('div', { class: 'stat-mid' }, `${val} ${unit}`),
        gameBtn('Copy Value', 'chip', () => { playSparkle(); navigator.clipboard?.writeText(String(val)); })
      );
      return card;
    }));
  }
  qIn.addEventListener('input', render);
  panel.append(gameField('Search Physical Constants', qIn), deck);
  root.replaceChildren(panel);
  render();
}

const TOOLS = Object.freeze({
  ...MATH_NUMBER_TOOLS,
  'physics-hub': physicsHub,
  'periodic-table': periodicTable,
  'motion': motion,
  'force': force,
  'energy': energy,
  'gravity': gravity,
  'waves': waves,
  'electricity': electricity,
  'optics': optics,
  'pressure': pressure,
  'density': density,
  'temperature': temperature,
  'ideal-gas': idealGas,
  'half-life': halfLife,
  'constants': constants
});

export function mountMathScience(id, root) {
  if (typeof id !== 'string' || !Object.hasOwn(TOOLS, id)) return false;
  if (!root || typeof root.replaceChildren !== 'function') throw new TypeError('mountMathScience requires a DOM container.');
  TOOLS[id](root);
  return true;
}
