// Hand-crafted, multi-color 2.5D cartoon game SVG props & mascots.
// Every single tool across all cupboards & featured games has its own distinct illustration!
const INK = '#4f2f23';

export function waffleMascotSVG(cls = 'waffle-svg') {
  return `<svg class="${cls}" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <ellipse cx="100" cy="172" rx="76" ry="18" fill="#fff3dc" stroke="${INK}" stroke-width="5"/>
    <ellipse cx="100" cy="170" rx="58" ry="11" fill="#edd3ac"/>
    <ellipse cx="76" cy="162" rx="11" ry="7" fill="#e59a47" stroke="${INK}" stroke-width="4.5"/>
    <ellipse cx="124" cy="162" rx="11" ry="7" fill="#e59a47" stroke="${INK}" stroke-width="4.5"/>
    <rect x="30" y="42" width="140" height="122" rx="36" fill="#cd8133" stroke="${INK}" stroke-width="5"/>
    <rect x="30" y="30" width="140" height="122" rx="36" fill="#f7c46c" stroke="${INK}" stroke-width="5"/>
    <rect x="42" y="42" width="116" height="98" rx="25" fill="#f5b858"/>
    <g>
      <rect x="50" y="50" width="22" height="20" rx="6" fill="#d38735" stroke="#b97024" stroke-width="2"/>
      <rect x="78" y="50" width="22" height="20" rx="6" fill="#d38735" stroke="#b97024" stroke-width="2"/>
      <rect x="106" y="50" width="22" height="20" rx="6" fill="#d38735" stroke="#b97024" stroke-width="2"/>
      <rect x="134" y="50" width="16" height="20" rx="5" fill="#d38735" stroke="#b97024" stroke-width="2"/>
      <rect x="50" y="77" width="22" height="20" rx="6" fill="#d38735" stroke="#b97024" stroke-width="2"/>
      <rect x="78" y="77" width="22" height="20" rx="6" fill="#d38735" stroke="#b97024" stroke-width="2"/>
      <rect x="106" y="77" width="22" height="20" rx="6" fill="#d38735" stroke="#b97024" stroke-width="2"/>
      <rect x="134" y="77" width="16" height="20" rx="5" fill="#d38735" stroke="#b97024" stroke-width="2"/>
      <rect x="50" y="104" width="22" height="20" rx="6" fill="#d38735" stroke="#b97024" stroke-width="2"/>
      <rect x="78" y="104" width="22" height="20" rx="6" fill="#d38735" stroke="#b97024" stroke-width="2"/>
      <rect x="106" y="104" width="22" height="20" rx="6" fill="#d38735" stroke="#b97024" stroke-width="2"/>
      <rect x="134" y="104" width="16" height="20" rx="5" fill="#d38735" stroke="#b97024" stroke-width="2"/>
    </g>
    <path d="M46 40 C52 24, 148 24, 154 40 C158 54, 145 62, 138 51 C132 42, 124 64, 115 57 C108 51, 103 70, 94 61 C86 52, 78 66, 70 54 C63 44, 53 58, 46 40Z" fill="#c96f2d" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>
    <rect x="75" y="16" width="50" height="26" rx="9" transform="rotate(-7 100 29)" fill="#fff099" stroke="${INK}" stroke-width="4.5"/>
    <rect x="83" y="22" width="20" height="6" rx="3" transform="rotate(-7 100 29)" fill="#fffbe2"/>
    <ellipse cx="64" cy="109" rx="12" ry="7.5" fill="#ff9e9e" opacity="0.88"/>
    <ellipse cx="136" cy="109" rx="12" ry="7.5" fill="#ff9e9e" opacity="0.88"/>
    <g>
      <circle cx="76" cy="95" r="10.5" fill="${INK}"/>
      <circle cx="124" cy="95" r="10.5" fill="${INK}"/>
      <circle cx="73" cy="91" r="3.8" fill="#fff8eb"/>
      <circle cx="121" cy="91" r="3.8" fill="#fff8eb"/>
    </g>
    <path d="M89 107 Q100 121 111 107" stroke="${INK}" stroke-width="4.8" stroke-linecap="round" fill="none"/>
    <path d="M30 98 C14 89, 13 111, 29 113" fill="#f7c46c" stroke="${INK}" stroke-width="4.8" stroke-linecap="round"/>
    <path d="M170 98 C186 89, 187 111, 171 113" fill="#f7c46c" stroke="${INK}" stroke-width="4.8" stroke-linecap="round"/>
  </svg>`;
}

export function cupboardIconSVG(id) {
  const icons = {
    math: `<svg class="game-svg" viewBox="0 0 96 96" fill="none">
      <rect x="14" y="14" width="44" height="66" rx="12" fill="#e78167" stroke="${INK}" stroke-width="5"/>
      <rect x="22" y="23" width="28" height="15" rx="5" fill="#fff1c9" stroke="${INK}" stroke-width="4"/>
      <circle cx="27" cy="49" r="3.5" fill="${INK}"/><circle cx="36" cy="49" r="3.5" fill="${INK}"/><circle cx="45" cy="49" r="3.5" fill="${INK}"/>
      <circle cx="27" cy="60" r="3.5" fill="${INK}"/><circle cx="36" cy="60" r="3.5" fill="${INK}"/><circle cx="45" cy="60" r="3.5" fill="${INK}"/>
      <circle cx="27" cy="70" r="3.5" fill="${INK}"/><rect x="33" y="67" width="15" height="6" rx="3" fill="#ffe07d" stroke="${INK}" stroke-width="2.5"/>
      <path d="M68 25 L73 36 L85 38 L76 46 L78 58 L68 52 L58 58 L60 46 L51 38 L63 36 Z" fill="#f0ba50" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>
    </svg>`,
    code: `<svg class="game-svg" viewBox="0 0 96 96" fill="none">
      <rect x="14" y="14" width="68" height="52" rx="12" fill="#82bbb6" stroke="${INK}" stroke-width="5"/>
      <rect x="23" y="23" width="50" height="34" rx="6" fill="#2f4b49" stroke="${INK}" stroke-width="3.5"/>
      <path d="M38 33 L29 40 L38 47 M58 33 L67 40 L58 47 M51 31 L45 49" stroke="#f4c25d" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M8 68 H88 L81 82 H15 Z" fill="#e78167" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M40 74 H56" stroke="#fff1c9" stroke-width="4" stroke-linecap="round"/>
    </svg>`,
    text: `<svg class="game-svg" viewBox="0 0 96 96" fill="none">
      <rect x="12" y="16" width="46" height="58" rx="11" fill="#88b5d8" stroke="${INK}" stroke-width="5"/>
      <path d="M23 32 H46 M23 44 H42 M23 56 H36" stroke="#fff4d6" stroke-width="5" stroke-linecap="round"/>
      <rect x="46" y="34" width="38" height="44" rx="11" fill="#d8bfd8" stroke="${INK}" stroke-width="5"/>
      <text x="65" y="64" text-anchor="middle" font-family="Fredoka,sans-serif" font-weight="700" font-size="22" fill="${INK}">Aa</text>
    </svg>`,
    art: `<svg class="game-svg" viewBox="0 0 96 96" fill="none">
      <path d="M46 14 C23 14 10 30 12 49 C14 68 30 78 49 78 C57 78 62 72 60 65 C58 59 64 54 71 54 C79 54 84 48 82 37 C78 23 64 14 46 14Z" fill="#f7dec2" stroke="${INK}" stroke-width="5"/>
      <circle cx="30" cy="36" r="7" fill="#e78167" stroke="${INK}" stroke-width="3"/>
      <circle cx="49" cy="28" r="7" fill="#f0ba50" stroke="${INK}" stroke-width="3"/>
      <circle cx="65" cy="38" r="6.5" fill="#8fd3a4" stroke="${INK}" stroke-width="3"/>
      <circle cx="29" cy="56" r="6.5" fill="#88b5d8" stroke="${INK}" stroke-width="3"/>
      <circle cx="47" cy="62" r="6" fill="#c7a8dc" stroke="${INK}" stroke-width="3"/>
    </svg>`,
    science: `<svg class="game-svg" viewBox="0 0 96 96" fill="none">
      <path d="M38 14 H58 V33 L75 66 C78 73 73 80 65 80 H31 C23 80 18 73 21 66 L38 33 V14Z" fill="#d9f2e6" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M26 57 H70 L74 67 C76 72 72 76 66 76 H30 C24 76 20 72 22 67 Z" fill="#7fd1a8"/>
      <rect x="33" y="10" width="30" height="9" rx="4.5" fill="#f0ba50" stroke="${INK}" stroke-width="4"/>
      <circle cx="42" cy="64" r="4" fill="#fff5d6" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="56" cy="68" r="3" fill="#fff5d6" stroke="${INK}" stroke-width="2.5"/>
    </svg>`,
    games: `<svg class="game-svg" viewBox="0 0 96 96" fill="none">
      <path d="M24 28 H72 C82 28 88 39 85 55 C83 65 76 72 68 68 L58 60 H38 L28 68 C20 72 13 65 11 55 C8 39 14 28 24 28Z" fill="#c7b2ea" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M30 37 V51 M23 44 H37" stroke="#fff6e3" stroke-width="6.5" stroke-linecap="round"/>
      <path d="M30 37 V51 M23 44 H37" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="64" cy="39" r="5" fill="#ff8f8f" stroke="${INK}" stroke-width="3"/>
      <circle cx="73" cy="48" r="5" fill="#ffe17d" stroke="${INK}" stroke-width="3"/>
      <circle cx="55" cy="48" r="5" fill="#8ee0a3" stroke="${INK}" stroke-width="3"/>
    </svg>`,
    favorites: `<svg class="game-svg" viewBox="0 0 96 96" fill="none">
      <path d="M48 14 L58 34 L80 37 L64 53 L68 75 L48 64 L28 75 L32 53 L16 37 L38 34 Z" fill="#f0ba50" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    </svg>`,
    recent: `<svg class="game-svg" viewBox="0 0 96 96" fill="none">
      <circle cx="48" cy="48" r="34" fill="#bfe0f7" stroke="${INK}" stroke-width="5"/>
      <path d="M48 26 V48 L63 57" stroke="${INK}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  };
  return icons[id] || icons.math;
}

const wrapTile = (bg, inner) => `<svg class="game-svg" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="84" height="84" rx="22" fill="${bg}" stroke="${INK}" stroke-width="5"/>${inner}</svg>`;

// Distinct pastel tile colors for visual variety on shelves
const C = {
  coral: '#f5b8a8',
  teal: '#a9dbd6',
  sage: '#bde2b3',
  lilac: '#d9c6eb',
  honey: '#fae09b',
  cream: '#f7e5be',
  sky: '#b5d8f2',
  peach: '#ffd5b8'
};

// Every single one of the 70 utilities gets its own unique SVG!
const TOOL_SVGS = {
  // === 1. MATH & NUMBERS (10) ===
  calculator: wrapTile(C.coral, `<rect x="26" y="16" width="44" height="64" rx="10" fill="#e78167" stroke="${INK}" stroke-width="4.5"/><rect x="32" y="23" width="32" height="14" rx="4" fill="#fff1c9" stroke="${INK}" stroke-width="3.5"/><path d="M35 47h6m7 0h6m7 0h1M35 58h6m7 0h6m7 0h1M35 69h6m7 0h13" stroke="${INK}" stroke-width="5.5" stroke-linecap="round"/>`),
  'graphing-calculator': wrapTile(C.teal, `<rect x="18" y="20" width="60" height="54" rx="10" fill="#82bbb6" stroke="${INK}" stroke-width="4.5"/><path d="M28 28v38h42M28 56h42M28 42h42M42 28v38M56 28v38" stroke="#fff0cb" stroke-width="2.5"/><path d="M29 61c8-2 10-18 19-16 8 2 8 11 15 8 5-2 6-17 11-19" stroke="#c84c3c" stroke-width="5" stroke-linecap="round"/>`),
  'bodily-calculator': wrapTile(C.sage, `<circle cx="48" cy="31" r="13" fill="#f3b26d" stroke="${INK}" stroke-width="4.5"/><path d="M26 78c0-15 9-25 22-25s22 10 22 25" fill="#91b783" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/><path d="M48 61c-7-7-15 2-7 10l7 7 7-7c8-8-1-17-7-10Z" fill="#e26b62" stroke="${INK}" stroke-width="3.5"/>`),
  fractions: wrapTile(C.lilac, `<rect x="24" y="16" width="48" height="64" rx="12" fill="#c6a8ca" stroke="${INK}" stroke-width="4.5"/><path d="M34 48h28" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><circle cx="48" cy="32" r="8" fill="#fff1c9" stroke="${INK}" stroke-width="3.5"/><rect x="38" y="59" width="20" height="10" rx="5" fill="#fff1c9" stroke="${INK}" stroke-width="3.5"/>`),
  percentage: wrapTile(C.honey, `<path d="M18 30a10 10 0 0 1 10-10h34l14 14-31 43a10 10 0 0 1-14 1L18 66Z" fill="#f0b84f" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/><circle cx="58" cy="31" r="4.5" fill="#fff1c9" stroke="${INK}" stroke-width="3"/><path d="M33 63 59 40" stroke="${INK}" stroke-width="5.5" stroke-linecap="round"/><circle cx="35" cy="43" r="4.5" fill="${INK}"/><circle cx="57" cy="60" r="4.5" fill="${INK}"/>`),
  'dice-roller': wrapTile(C.teal, `<path d="M24 34 L48 21 L72 32 L48 45 Z" fill="#f7d98f" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/><path d="M24 34 L48 45 V75 L24 62 Z" fill="#df7964" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/><path d="M48 45 L72 32 V62 L48 75 Z" fill="#83b4ad" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/><circle cx="48" cy="33" r="3.5" fill="${INK}"/><circle cx="33" cy="48" r="3.5" fill="${INK}"/><circle cx="39" cy="61" r="3.5" fill="${INK}"/><circle cx="59" cy="52" r="3.5" fill="${INK}"/>`),
  'roman-numerals': wrapTile(C.cream, `<rect x="24" y="18" width="48" height="60" rx="8" fill="#efd39b" stroke="${INK}" stroke-width="4.5"/><path d="M32 31h32" stroke="#b77c49" stroke-width="4" stroke-linecap="round"/><text x="48" y="62" text-anchor="middle" font-family="Fredoka,sans-serif" font-weight="700" font-size="24" fill="${INK}">VI</text>`),
  'number-base': wrapTile(C.coral, `<rect x="16" y="20" width="30" height="26" rx="8" fill="#82bbb6" stroke="${INK}" stroke-width="4"/><rect x="50" y="50" width="30" height="26" rx="8" fill="#e78167" stroke="${INK}" stroke-width="4"/><text x="31" y="38" text-anchor="middle" font-family="Fredoka,sans-serif" font-weight="700" font-size="14" fill="#fff">01</text><text x="65" y="68" text-anchor="middle" font-family="Fredoka,sans-serif" font-weight="700" font-size="14" fill="#fff">FF</text><path d="M52 28 H68 L62 22 M68 28 L62 34 M44 68 H28 L34 62 M28 68 L34 74" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`),
  'prime-checker': wrapTile(C.honey, `<path d="M48 16 L57 34 L77 37 L62 51 L66 71 L48 61 L30 71 L34 51 L19 37 L39 34 Z" fill="#efba4f" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/><text x="48" y="54" text-anchor="middle" font-family="Fredoka,sans-serif" font-weight="700" font-size="20" fill="${INK}">7</text>`),
  'sequence-playground': wrapTile(C.sage, `<rect x="18" y="42" width="16" height="32" rx="6" fill="#e78167" stroke="${INK}" stroke-width="4"/><rect x="40" y="30" width="16" height="44" rx="6" fill="#f0ba50" stroke="${INK}" stroke-width="4"/><rect x="62" y="18" width="16" height="56" rx="6" fill="#83b4ad" stroke="${INK}" stroke-width="4"/>`),

  // === 2. CODING & DEVELOPING (15) ===
  codehub: wrapTile(C.teal, `<rect x="18" y="20" width="60" height="42" rx="9" fill="#497976" stroke="${INK}" stroke-width="4.5"/><path d="M35 34 L27 41 L35 48 M61 34 L69 41 L61 48 M51 31 L45 51" stroke="#ffe17d" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 66 H82 L75 77 H21 Z" fill="#e78167" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`),
  'json-validator': wrapTile(C.lilac, `<rect x="20" y="16" width="56" height="64" rx="12" fill="#d5b3d8" stroke="${INK}" stroke-width="4.5"/><path d="M40 30c-6 0-7 4-7 10v3c0 4-2 5-5 5 3 0 5 1 5 5v3c0 6 1 10 7 10M56 30c6 0 7 4 7 10v3c0 4 2 5 5 5-3 0-5 1-5 5v3c0 6-1 10-7 10" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/><circle cx="48" cy="48" r="4" fill="#ffe17d" stroke="${INK}" stroke-width="2.5"/>`),
  'regex-tester': wrapTile(C.honey, `<rect x="16" y="20" width="64" height="56" rx="14" fill="#efb94f" stroke="${INK}" stroke-width="4.5"/><path d="M28 42h16M36 34v16m-6-12l12 9" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><circle cx="62" cy="40" r="4" fill="${INK}"/><path d="M54 57c5 5 12 5 16 0" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`),
  'uuid-generator': wrapTile(C.sky, `<rect x="18" y="18" width="60" height="60" rx="12" fill="#88aeca" stroke="${INK}" stroke-width="4.5"/><path d="M29 33h14M52 33h15M29 48h8M47 48h20M29 63h20M58 63h9" stroke="#fff3d6" stroke-width="5" stroke-linecap="round"/><circle cx="47" cy="33" r="3.5" fill="#ffe17d"/><circle cx="41" cy="48" r="3.5" fill="#e78167"/>`),
  timestamp: wrapTile(C.peach, `<circle cx="48" cy="48" r="28" fill="#ffe17d" stroke="${INK}" stroke-width="4.5"/><circle cx="48" cy="48" r="20" fill="#fff9ec" stroke="${INK}" stroke-width="3"/><path d="M48 35v14l10 6" stroke="${INK}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`),
  'base-converter': wrapTile(C.coral, `<rect x="16" y="22" width="64" height="52" rx="12" fill="#e9947f" stroke="${INK}" stroke-width="4.5"/><text x="48" y="45" text-anchor="middle" font-family="Fredoka,sans-serif" font-weight="700" font-size="16" fill="#fff">1010</text><path d="M28 58 H68 L61 52 M68 58 L61 64" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`),
  'html-entities': wrapTile(C.teal, `<rect x="16" y="22" width="64" height="52" rx="12" fill="#7eb9b6" stroke="${INK}" stroke-width="4.5"/><path d="M34 38 L24 48 L34 58 M62 38 L72 48 L62 58" stroke="#fff9ec" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><text x="48" y="55" text-anchor="middle" font-family="Fredoka,sans-serif" font-weight="700" font-size="22" fill="${INK}">&amp;</text>`),
  'jwt-decoder': wrapTile(C.lilac, `<rect x="14" y="24" width="68" height="48" rx="12" fill="#c4add0" stroke="${INK}" stroke-width="4.5"/><rect x="22" y="33" width="15" height="30" rx="5" fill="#e78167" stroke="${INK}" stroke-width="3"/><rect x="40" y="33" width="15" height="30" rx="5" fill="#ffe17d" stroke="${INK}" stroke-width="3"/><rect x="58" y="33" width="15" height="30" rx="5" fill="#8fd3a4" stroke="${INK}" stroke-width="3"/>`),
  'css-minifier': wrapTile(C.sky, `<path d="M28 24 L20 48 L28 72 M68 24 L76 48 L68 72" stroke="${INK}" stroke-width="5.5" stroke-linecap="round"/><rect x="34" y="36" width="28" height="24" rx="7" fill="#ffe17d" stroke="${INK}" stroke-width="4"/><path d="M40 48 H56" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`),
  'js-formatter': wrapTile(C.honey, `<rect x="20" y="18" width="56" height="60" rx="11" fill="#f7d57c" stroke="${INK}" stroke-width="4.5"/><text x="48" y="57" text-anchor="middle" font-family="Fredoka,sans-serif" font-weight="700" font-size="25" fill="${INK}">JS</text>`),
  'sql-formatter': wrapTile(C.sage, `<ellipse cx="48" cy="28" rx="24" ry="9" fill="#9ed99e" stroke="${INK}" stroke-width="4"/><path d="M24 28 V66 C24 71 35 75 48 75 C61 75 72 71 72 66 V28" fill="#82c482" stroke="${INK}" stroke-width="4"/><path d="M24 41 C24 46 35 50 48 50 C61 50 72 46 72 41 M24 54 C24 59 35 63 48 63 C61 63 72 59 72 54" stroke="${INK}" stroke-width="3.5"/>`),
  'hash-playground': wrapTile(C.sage, `<rect x="18" y="18" width="60" height="60" rx="12" fill="#91b782" stroke="${INK}" stroke-width="4.5"/><path d="M41 29 L35 67 M59 29 L53 67 M28 42 H68 M26 55 H66" stroke="${INK}" stroke-width="5.5" stroke-linecap="round"/>`),
  'color-tokens': wrapTile(C.peach, `<circle cx="34" cy="36" r="11" fill="#e78167" stroke="${INK}" stroke-width="3.5"/><circle cx="62" cy="36" r="11" fill="#82bbb6" stroke="${INK}" stroke-width="3.5"/><circle cx="34" cy="62" r="11" fill="#ffe17d" stroke="${INK}" stroke-width="3.5"/><circle cx="62" cy="62" r="11" fill="#c4add0" stroke="${INK}" stroke-width="3.5"/>`),
  'git-cheatsheet': wrapTile(C.coral, `<line x1="34" y1="24" x2="34" y2="72" stroke="${INK}" stroke-width="5.5" stroke-linecap="round"/><path d="M34 56 C34 40 62 44 62 32" stroke="${INK}" stroke-width="5.5" stroke-linecap="round"/><circle cx="34" cy="26" r="8" fill="#ffe17d" stroke="${INK}" stroke-width="4"/><circle cx="34" cy="68" r="8" fill="#9ee09e" stroke="${INK}" stroke-width="4"/><circle cx="62" cy="30" r="8" fill="#e78167" stroke="${INK}" stroke-width="4"/>`),
  'http-status': wrapTile(C.sky, `<rect x="16" y="22" width="64" height="52" rx="12" fill="#fff9ec" stroke="${INK}" stroke-width="4.5"/><rect x="16" y="22" width="64" height="16" rx="8" fill="#88b5d8" stroke="${INK}" stroke-width="4"/><text x="48" y="61" text-anchor="middle" font-family="Fredoka,sans-serif" font-weight="700" font-size="22" fill="#5e9e68">200</text>`),

  // === 3. TEXT & FILES (15) ===
  'file-converter': wrapTile(C.sky, `<rect x="16" y="22" width="28" height="36" rx="6" fill="#fff9ec" stroke="${INK}" stroke-width="4"/><rect x="52" y="38" width="28" height="36" rx="6" fill="#ffe17d" stroke="${INK}" stroke-width="4"/><path d="M46 28 H64 L58 22 M64 28 L58 34" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`),
  'crazy-text-filters': wrapTile(C.lilac, `<path d="M22 64 L36 28 L50 64 M27 52 H45" stroke="${INK}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M58 30 L64 40 L74 42 L66 49 L68 59 L58 54 L48 59 L50 49 L42 42 L52 40 Z" fill="#ffe17d" stroke="${INK}" stroke-width="3.5"/>`),
  'word-counter': wrapTile(C.honey, `<rect x="20" y="18" width="56" height="60" rx="10" fill="#fff9ec" stroke="${INK}" stroke-width="4.5"/><path d="M30 33 H66 M30 45 H58 M30 57 H50" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/><circle cx="64" cy="62" r="13" fill="#9ee09e" stroke="${INK}" stroke-width="3.5"/><text x="64" y="67" text-anchor="middle" font-family="Fredoka,sans-serif" font-weight="700" font-size="13" fill="${INK}">123</text>`),
  'case-converter': wrapTile(C.peach, `<rect x="16" y="24" width="64" height="48" rx="12" fill="#fff9ec" stroke="${INK}" stroke-width="4.5"/><text x="48" y="57" text-anchor="middle" font-family="Fredoka,sans-serif" font-weight="700" font-size="27" fill="${INK}">Aa</text>`),
  'json-formatter': wrapTile(C.teal, `<rect x="20" y="18" width="56" height="60" rx="11" fill="#bfe3e0" stroke="${INK}" stroke-width="4.5"/><path d="M32 32 H50 M38 44 H62 M38 54 H58 M32 66 H48" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`),
  base64: wrapTile(C.coral, `<rect x="16" y="22" width="64" height="52" rx="12" fill="#ffd2c2" stroke="${INK}" stroke-width="4.5"/><text x="48" y="56" text-anchor="middle" font-family="Fredoka,sans-serif" font-weight="700" font-size="22" fill="${INK}">B64</text>`),
  'url-codec': wrapTile(C.sky, `<rect x="20" y="38" width="28" height="20" rx="10" fill="none" stroke="${INK}" stroke-width="5"/><rect x="48" y="38" width="28" height="20" rx="10" fill="none" stroke="#e78167" stroke-width="5"/>`),
  'markdown-preview': wrapTile(C.cream, `<rect x="16" y="22" width="64" height="52" rx="10" fill="#fff9ec" stroke="${INK}" stroke-width="4.5"/><path d="M26 58 V38 L36 50 L46 38 V58 M62 36 V58 M55 50 L62 58 L69 50" stroke="${INK}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`),
  'text-diff': wrapTile(C.sage, `<rect x="16" y="22" width="30" height="52" rx="7" fill="#ffd2c2" stroke="${INK}" stroke-width="4"/><rect x="50" y="22" width="30" height="52" rx="7" fill="#c5e8c2" stroke="${INK}" stroke-width="4"/><path d="M25 48 H37 M59 48 H71 M65 42 V54" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`),
  'find-replace': wrapTile(C.honey, `<circle cx="42" cy="42" r="18" fill="#bfe0f7" stroke="${INK}" stroke-width="4.5"/><line x1="55" y1="55" x2="73" y2="73" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`),
  'lorem-ipsum': wrapTile(C.peach, `<path d="M26 22 H70 V74 H26 Z" fill="#fff9ec" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/><path d="M58 18 L72 32 L46 58 L38 60 L40 52 Z" fill="#ffe17d" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>`),
  'hash-generator': wrapTile(C.lilac, `<path d="M48 16 C32 16 22 28 22 44 V62 C22 72 34 78 48 78 C62 78 74 72 74 62 V44 C74 28 64 16 48 16Z" fill="#fff9ec" stroke="${INK}" stroke-width="4.5"/><path d="M36 44 C36 36 42 32 48 32 C54 32 60 36 60 44 M42 52 C42 46 45 43 48 43 C51 43 54 46 54 52" stroke="#e78167" stroke-width="4" stroke-linecap="round"/>`),
  'csv-editor': wrapTile(C.sage, `<rect x="16" y="22" width="64" height="52" rx="9" fill="#fff9ec" stroke="${INK}" stroke-width="4.5"/><path d="M16 38 H80 M16 56 H80 M38 22 V74 M60 22 V74" stroke="${INK}" stroke-width="3.5"/><rect x="18" y="24" width="60" height="12" fill="#9ee09e"/>`),
  notepad: wrapTile(C.honey, `<rect x="22" y="18" width="52" height="60" rx="10" fill="#ffe599" stroke="${INK}" stroke-width="4.5"/><path d="M32 36 H64 M32 48 H64 M32 60 H52" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="20" r="4" fill="#c98550" stroke="${INK}" stroke-width="2.5"/><circle cx="48" cy="20" r="4" fill="#c98550" stroke="${INK}" stroke-width="2.5"/><circle cx="64" cy="20" r="4" fill="#c98550" stroke="${INK}" stroke-width="2.5"/>`),
  'file-inspector': wrapTile(C.sky, `<rect x="22" y="18" width="44" height="58" rx="9" fill="#fff9ec" stroke="${INK}" stroke-width="4.5"/><circle cx="60" cy="58" r="14" fill="#ffe17d" stroke="${INK}" stroke-width="4"/><line x1="70" y1="68" x2="79" y2="77" stroke="${INK}" stroke-width="5.5" stroke-linecap="round"/>`),

  // === 4. ART & COLORING (15) ===
  'art-studio': wrapTile(C.peach, `<path d="M22 68 L30 48 L64 16 L76 28 L42 62 Z" fill="#e78167" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M22 68 C16 68 15 76 24 76 C31 76 34 71 30 66 Z" fill="#ffe17d" stroke="${INK}" stroke-width="3.5"/>`),
  'color-picker': wrapTile(C.sky, `<path d="M56 22 L72 38 L38 72 H22 V56 Z" fill="#bfe0f7" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><rect x="58" y="16" width="20" height="14" rx="5" transform="rotate(45 68 23)" fill="#e78167" stroke="${INK}" stroke-width="3.5"/>`),
  'palette-generator': wrapTile(C.cream, `<rect x="18" y="20" width="18" height="56" rx="7" fill="#e78167" stroke="${INK}" stroke-width="3.5"/><rect x="39" y="20" width="18" height="56" rx="7" fill="#ffe17d" stroke="${INK}" stroke-width="3.5"/><rect x="60" y="20" width="18" height="56" rx="7" fill="#82bbb6" stroke="${INK}" stroke-width="3.5"/>`),
  'gradient-maker': wrapTile(C.lilac, `<rect x="18" y="24" width="60" height="48" rx="12" fill="#e78167" stroke="${INK}" stroke-width="4.5"/><rect x="38" y="24" width="20" height="48" fill="#f0ba50"/><rect x="58" y="24" width="20" height="48" rx="8" fill="#88b5d8"/><rect x="18" y="24" width="60" height="48" rx="12" stroke="${INK}" stroke-width="4.5"/>`),
  'pixel-art': wrapTile(C.sage, `<rect x="20" y="20" width="18" height="18" fill="#e78167" stroke="${INK}" stroke-width="3"/><rect x="39" y="20" width="18" height="18" fill="#ffe17d" stroke="${INK}" stroke-width="3"/><rect x="58" y="20" width="18" height="18" fill="#88b5d8" stroke="${INK}" stroke-width="3"/><rect x="20" y="39" width="18" height="18" fill="#9ee09e" stroke="${INK}" stroke-width="3"/><rect x="39" y="39" width="18" height="18" fill="#fff9ec" stroke="${INK}" stroke-width="3"/><rect x="58" y="39" width="18" height="18" fill="#d5b3d8" stroke="${INK}" stroke-width="3"/><rect x="39" y="58" width="18" height="18" fill="#f0ba50" stroke="${INK}" stroke-width="3"/>`),
  'image-resizer': wrapTile(C.teal, `<rect x="16" y="24" width="64" height="48" rx="8" fill="#fff9ec" stroke="${INK}" stroke-width="4" stroke-dasharray="6 4"/><rect x="22" y="42" width="32" height="24" rx="5" fill="#9ee09e" stroke="${INK}" stroke-width="3.5"/><path d="M58 38 L70 28 M62 28 H70 V36" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`),
  'image-cropper': wrapTile(C.honey, `<path d="M28 18 V62 H74 M18 30 H62 V76" stroke="${INK}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>`),
  'image-filters': wrapTile(C.coral, `<circle cx="38" cy="48" r="18" fill="#ff9e9e" fill-opacity="0.8" stroke="${INK}" stroke-width="4"/><circle cx="58" cy="48" r="18" fill="#ffe17d" fill-opacity="0.75" stroke="${INK}" stroke-width="4"/>`),
  'svg-editor': wrapTile(C.sky, `<path d="M22 66 C22 28 74 68 74 28" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/><circle cx="22" cy="66" r="6" fill="#e78167" stroke="${INK}" stroke-width="3"/><circle cx="74" cy="28" r="6" fill="#9ee09e" stroke="${INK}" stroke-width="3"/><rect x="42" y="42" width="12" height="12" fill="#ffe17d" stroke="${INK}" stroke-width="3"/>`),
  'contrast-checker': wrapTile(C.cream, `<circle cx="48" cy="48" r="26" fill="#fff9ec" stroke="${INK}" stroke-width="4.5"/><path d="M48 22 A26 26 0 0 1 48 74 Z" fill="${INK}"/>`),
  'color-converter': wrapTile(C.peach, `<circle cx="32" cy="36" r="13" fill="#ff8f8f" stroke="${INK}" stroke-width="3.5"/><circle cx="64" cy="60" r="13" fill="#82bbb6" stroke="${INK}" stroke-width="3.5"/><path d="M50 32 H66 L60 26 M46 64 H30 L36 70" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`),
  'pattern-maker': wrapTile(C.lilac, `<circle cx="32" cy="32" r="9" fill="#ffe17d" stroke="${INK}" stroke-width="3"/><circle cx="64" cy="32" r="9" fill="#e78167" stroke="${INK}" stroke-width="3"/><circle cx="32" cy="64" r="9" fill="#82bbb6" stroke="${INK}" stroke-width="3"/><circle cx="64" cy="64" r="9" fill="#9ee09e" stroke="${INK}" stroke-width="3"/><circle cx="48" cy="48" r="8" fill="#fff9ec" stroke="${INK}" stroke-width="3"/>`),
  'collage-maker': wrapTile(C.teal, `<rect x="16" y="18" width="28" height="36" rx="7" fill="#ffe17d" stroke="${INK}" stroke-width="4"/><rect x="50" y="18" width="30" height="24" rx="7" fill="#e78167" stroke="${INK}" stroke-width="4"/><rect x="50" y="48" width="30" height="30" rx="7" fill="#9ee09e" stroke="${INK}" stroke-width="4"/><rect x="16" y="60" width="28" height="18" rx="6" fill="#bfe0f7" stroke="${INK}" stroke-width="4"/>`),
  'ascii-art': wrapTile(C.cream, `<rect x="16" y="20" width="64" height="56" rx="10" fill="#4f2f23" stroke="${INK}" stroke-width="4"/><text x="48" y="46" text-anchor="middle" font-family="monospace" font-weight="700" font-size="16" fill="#ffe17d">^_~</text><text x="48" y="64" text-anchor="middle" font-family="monospace" font-weight="700" font-size="14" fill="#9ee09e">@#*</text>`),
  mandala: wrapTile(C.coral, `<circle cx="48" cy="48" r="26" fill="#fff9ec" stroke="${INK}" stroke-width="4"/><circle cx="48" cy="48" r="14" fill="#ffe17d" stroke="${INK}" stroke-width="3.5"/><circle cx="48" cy="24" r="7" fill="#e78167" stroke="${INK}" stroke-width="3"/><circle cx="48" cy="72" r="7" fill="#e78167" stroke="${INK}" stroke-width="3"/><circle cx="24" cy="48" r="7" fill="#82bbb6" stroke="${INK}" stroke-width="3"/><circle cx="72" cy="48" r="7" fill="#82bbb6" stroke="${INK}" stroke-width="3"/>`),

  // === 5. SCIENCE & PHYSICS (15) ===
  'physics-hub': wrapTile(C.sage, `<ellipse cx="48" cy="48" rx="30" ry="12" transform="rotate(35 48 48)" stroke="${INK}" stroke-width="4"/><ellipse cx="48" cy="48" rx="30" ry="12" transform="rotate(-35 48 48)" stroke="${INK}" stroke-width="4"/><circle cx="48" cy="48" r="9" fill="#e78167" stroke="${INK}" stroke-width="3.5"/>`),
  'periodic-table': wrapTile(C.sky, `<rect x="20" y="20" width="56" height="56" rx="12" fill="#fff9ec" stroke="${INK}" stroke-width="4.5"/><text x="32" y="36" font-family="Fredoka,sans-serif" font-weight="700" font-size="12" fill="${INK}">1</text><text x="48" y="62" text-anchor="middle" font-family="Fredoka,sans-serif" font-weight="700" font-size="26" fill="#4f7eb3">He</text>`),
  motion: wrapTile(C.peach, `<circle cx="62" cy="48" r="16" fill="#e78167" stroke="${INK}" stroke-width="4"/><path d="M16 40 H38 M12 48 H36 M18 56 H40" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`),
  force: wrapTile(C.coral, `<path d="M18 48 H56 L46 34 L78 48 L46 62 L56 48 Z" fill="#ffe17d" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>`),
  energy: wrapTile(C.honey, `<path d="M54 16 L26 52 H46 L40 80 L70 42 H50 Z" fill="#ffe17d" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>`),
  gravity: wrapTile(C.sage, `<circle cx="48" cy="54" r="20" fill="#e78167" stroke="${INK}" stroke-width="4.5"/><path d="M48 34 C48 24 55 20 62 20" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/><ellipse cx="55" cy="27" rx="8" ry="4" transform="rotate(-25 55 27)" fill="#9ee09e" stroke="${INK}" stroke-width="3"/>`),
  waves: wrapTile(C.teal, `<path d="M14 48 Q26 24 38 48 T62 48 T82 48" stroke="${INK}" stroke-width="5.5" stroke-linecap="round"/><path d="M14 62 Q26 38 38 62 T62 62 T82 62" stroke="#e78167" stroke-width="4" stroke-linecap="round"/>`),
  electricity: wrapTile(C.honey, `<circle cx="48" cy="40" r="18" fill="#fff099" stroke="${INK}" stroke-width="4.5"/><rect x="39" y="57" width="18" height="14" rx="4" fill="#c98550" stroke="${INK}" stroke-width="4"/><path d="M42 40 L48 34 L54 40" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`),
  optics: wrapTile(C.lilac, `<path d="M48 20 L74 68 H22 Z" fill="#d9f2ff" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/><line x1="12" y1="48" x2="34" y2="48" stroke="#ffe17d" stroke-width="4.5"/><line x1="62" y1="44" x2="84" y2="36" stroke="#ff8f8f" stroke-width="4"/><line x1="64" y1="52" x2="84" y2="56" stroke="#82bbb6" stroke-width="4"/>`),
  pressure: wrapTile(C.sky, `<circle cx="48" cy="52" r="24" fill="#fff9ec" stroke="${INK}" stroke-width="4.5"/><path d="M48 52 L60 36" stroke="#e78167" stroke-width="5" stroke-linecap="round"/><circle cx="48" cy="52" r="5" fill="${INK}"/>`),
  density: wrapTile(C.cream, `<rect x="24" y="22" width="48" height="54" rx="10" fill="#fff9ec" stroke="${INK}" stroke-width="4.5"/><rect x="26" y="42" width="44" height="16" fill="#ffe17d"/><rect x="26" y="58" width="44" height="16" rx="6" fill="#82bbb6"/>`),
  temperature: wrapTile(C.coral, `<rect x="40" y="16" width="16" height="44" rx="8" fill="#fff9ec" stroke="${INK}" stroke-width="4"/><circle cx="48" cy="64" r="13" fill="#e78167" stroke="${INK}" stroke-width="4"/><rect x="45" y="34" width="6" height="24" rx="3" fill="#e78167"/>`),
  'ideal-gas': wrapTile(C.lilac, `<rect x="20" y="22" width="56" height="52" rx="12" fill="#fff9ec" stroke="${INK}" stroke-width="4.5"/><circle cx="34" cy="38" r="5" fill="#e78167" stroke="${INK}" stroke-width="2.5"/><circle cx="58" cy="36" r="5" fill="#82bbb6" stroke="${INK}" stroke-width="2.5"/><circle cx="46" cy="58" r="5" fill="#ffe17d" stroke="${INK}" stroke-width="2.5"/><circle cx="64" cy="58" r="4" fill="#c4add0" stroke="${INK}" stroke-width="2.5"/>`),
  'half-life': wrapTile(C.honey, `<circle cx="48" cy="48" r="26" fill="#ffe17d" stroke="${INK}" stroke-width="4.5"/><path d="M48 48 L35 26 A26 26 0 0 1 61 26 Z M48 48 L74 48 A26 26 0 0 1 61 70 Z M48 48 L35 70 A26 26 0 0 1 22 48 Z" fill="${INK}"/><circle cx="48" cy="48" r="6" fill="#ffe17d"/>`),
  constants: wrapTile(C.teal, `<rect x="18" y="18" width="60" height="60" rx="14" fill="#fff9ec" stroke="${INK}" stroke-width="4.5"/><text x="48" y="61" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="38" fill="${INK}">π</text>`)
};

// Bespoke game box illustrations for Featured Flash/Fancade hits + genres
const GAME_SVGS = {
  'impossible-quiz': wrapTile(C.coral, `<circle cx="48" cy="54" r="20" fill="#4f2f23"/><path d="M48 34 C48 22 60 22 64 16" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><circle cx="66" cy="15" r="5" fill="#ffe17d" stroke="${INK}" stroke-width="2.5"/><text x="48" y="62" text-anchor="middle" font-family="Fredoka,sans-serif" font-weight="700" font-size="24" fill="#ffe17d">?!</text>`),
  'impossible-quiz-2': wrapTile(C.lilac, `<rect x="20" y="22" width="56" height="52" rx="14" fill="#f7c46c" stroke="${INK}" stroke-width="4.5"/><text x="48" y="57" text-anchor="middle" font-family="Fredoka,sans-serif" font-weight="700" font-size="26" fill="${INK}">Q2</text>`),
  'drive-mad-wobble': wrapTile(C.sky, `<rect x="20" y="34" width="56" height="22" rx="7" fill="#e78167" stroke="${INK}" stroke-width="4"/><rect x="34" y="22" width="26" height="14" rx="5" fill="#fff9ec" stroke="${INK}" stroke-width="3.5"/><circle cx="32" cy="60" r="11" fill="#574036" stroke="${INK}" stroke-width="4"/><circle cx="64" cy="60" r="11" fill="#574036" stroke="${INK}" stroke-width="4"/>`),
  'fancade-stack-3d': wrapTile(C.honey, `<rect x="22" y="56" width="52" height="16" rx="4" fill="#82bbb6" stroke="${INK}" stroke-width="3.5"/><rect x="26" y="40" width="44" height="16" rx="4" fill="#f0ba50" stroke="${INK}" stroke-width="3.5"/><rect x="32" y="24" width="32" height="16" rx="4" fill="#e78167" stroke="${INK}" stroke-width="3.5"/>`),
  'tiny-golf-putt': wrapTile(C.sage, `<line x1="56" y1="20" x2="56" y2="66" stroke="${INK}" stroke-width="4"/><path d="M56 20 L76 28 L56 36 Z" fill="#e78167" stroke="${INK}" stroke-width="3"/><ellipse cx="56" cy="68" rx="12" ry="5" fill="${INK}"/><circle cx="30" cy="64" r="9" fill="#fff9ec" stroke="${INK}" stroke-width="3.5"/>`),
  'fancy-parkour': wrapTile(C.peach, `<circle cx="48" cy="28" r="9" fill="#fff9ec" stroke="${INK}" stroke-width="3.5"/><path d="M42 20 L50 12 L56 20" stroke="#e78167" stroke-width="4" stroke-linecap="round"/><rect x="38" y="46" width="20" height="22" rx="5" fill="#e78167" stroke="${INK}" stroke-width="3.5"/><line x1="48" y1="37" x2="48" y2="46" stroke="${INK}" stroke-width="4"/>`),
  'line-sled-rider': wrapTile(C.sky, `<path d="M16 64 Q42 74 78 44" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M36 52 L54 44" stroke="${INK}" stroke-width="4"/><circle cx="46" cy="36" r="7" fill="#e78167" stroke="${INK}" stroke-width="3"/>`),
  'bloon-dart-pop': wrapTile(C.sage, `<ellipse cx="40" cy="42" rx="14" ry="18" fill="#ff8075" stroke="${INK}" stroke-width="4"/><ellipse cx="58" cy="52" rx="13" ry="16" fill="#7ec3d4" stroke="${INK}" stroke-width="4"/>`),
  'tunnel-heli': wrapTile(C.honey, `<rect x="26" y="40" width="44" height="24" rx="10" fill="#ffe17d" stroke="${INK}" stroke-width="4"/><line x1="20" y1="32" x2="76" y2="32" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><circle cx="56" cy="50" r="5" fill="#bfe0f7" stroke="${INK}" stroke-width="2.5"/>`),
  'ninja-wall-jump': wrapTile(C.lilac, `<rect x="34" y="30" width="28" height="36" rx="8" fill="#4f2f23"/><rect x="32" y="36" width="32" height="8" fill="#e78167"/><circle cx="42" cy="48" r="3" fill="#fff"/><circle cx="54" cy="48" r="3" fill="#fff"/>`),
  'papa-waffleria': wrapTile(C.peach, `<rect x="26" y="32" width="44" height="36" rx="10" fill="#f7c46c" stroke="${INK}" stroke-width="4.5"/><circle cx="48" cy="48" r="8" fill="#ff8b80" stroke="${INK}" stroke-width="3"/>`),
  'henry-kitchen-heist': wrapTile(C.cream, `<circle cx="48" cy="34" r="14" fill="#fff9ec" stroke="${INK}" stroke-width="4.5"/><path d="M48 48 V74 M32 58 L48 52 L64 58" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`),
  'odd-bot-push': wrapTile(C.teal, `<rect x="26" y="30" width="24" height="32" rx="7" fill="#7ec3d4" stroke="${INK}" stroke-width="4"/><rect x="52" y="42" width="24" height="24" rx="6" fill="#e78167" stroke="${INK}" stroke-width="4"/>`),
  'crossy-kitchen-hop': wrapTile(C.sage, `<rect x="28" y="30" width="40" height="40" rx="10" fill="#ffe17d" stroke="${INK}" stroke-width="4.5"/><circle cx="40" cy="44" r="3.5" fill="${INK}"/><circle cx="56" cy="44" r="3.5" fill="${INK}"/><rect x="42" y="52" width="12" height="7" rx="3" fill="#e78167" stroke="${INK}" stroke-width="2.5"/>`),
  'recoil-bounce': wrapTile(C.lilac, `<circle cx="38" cy="54" r="16" fill="#7ec3d4" stroke="${INK}" stroke-width="4"/><circle cx="64" cy="30" r="10" fill="#ff8b80" stroke="${INK}" stroke-width="3.5"/>`)
};

const GENRE_SVGS = {
  'Flash & Quizzes': GAME_SVGS['impossible-quiz'],
  'Fancade 2.5D': GAME_SVGS['fancade-stack-3d'],
  'Puzzles': TOOL_SVGS['sequence-playground'],
  'Driving': GAME_SVGS['drive-mad-wobble'],
  'Strategy': GAME_SVGS['bloon-dart-pop'],
  'Quiz & Words': GAME_SVGS['henry-kitchen-heist'],
  'Cozy': GAME_SVGS['papa-waffleria'],
  'Arcade': wrapTile(C.lilac, `<rect x="22" y="24" width="52" height="48" rx="12" fill="#c7b2ea" stroke="${INK}" stroke-width="4.5"/><circle cx="39" cy="48" r="6" fill="#ffe17d" stroke="${INK}" stroke-width="3"/><circle cx="57" cy="48" r="6" fill="#e78167" stroke="${INK}" stroke-width="3"/>`)
};

export function toolPropSVG(id) {
  return TOOL_SVGS[id] || GAME_SVGS[id] || GENRE_SVGS.Arcade;
}

export function gamePropSVG(game, genreName) {
  if (GAME_SVGS[game.id]) return GAME_SVGS[game.id];
  if (game.id.includes('tetris') || game.id === 'blockrain') return GAME_SVGS['fancade-stack-3d'];
  if (game.id.includes('snake')) return GAME_SVGS['crossy-kitchen-hop'];
  if (game.id.includes('2048')) return TOOL_SVGS['number-base'];
  if (game.id.includes('solitaire') || game.id.includes('mines') || game.id.includes('sweep')) return GAME_SVGS['odd-bot-push'];
  return GENRE_SVGS[genreName] || GENRE_SVGS.Arcade;
}

export function uiIconSVG(name) {
  const map = {
    home: `<svg class="game-svg" viewBox="0 0 32 32" fill="none"><path d="M5 15 L16 5 L27 15 V26 C27 27.5 26 28 24.5 28 H7.5 C6 28 5 27.5 5 26 Z" fill="#ffe599" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><rect x="12.5" y="17" width="7" height="11" rx="2" fill="#c98550" stroke="${INK}" stroke-width="2.2"/></svg>`,
    heart: `<svg class="game-svg" viewBox="0 0 32 32" fill="none"><path d="M16 27 C16 27 5 19.5 5 11.5 C5 7.5 8 5 11.5 5 C13.8 5 15.5 6.4 16 8 C16.5 6.4 18.2 5 20.5 5 C24 5 27 7.5 27 11.5 C27 19.5 16 27 16 27Z" fill="#ff9e9e" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
    clock: `<svg class="game-svg" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="11" fill="#bfe3ff" stroke="${INK}" stroke-width="2.5"/><path d="M16 10 V16 L20 19" stroke="${INK}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    back: `<svg class="game-svg" viewBox="0 0 32 32" fill="none"><path d="M20 7 L10 16 L20 25" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    soundOn: `<svg class="game-svg" viewBox="0 0 32 32" fill="none"><path d="M6 12 H11 L18 6 V26 L11 20 H6 Z" fill="#ffe184" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M22 11 C24.5 13.5 24.5 18.5 22 21" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/><path d="M25.5 8 C29.5 12 29.5 20 25.5 24" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    soundOff: `<svg class="game-svg" viewBox="0 0 32 32" fill="none"><path d="M6 12 H11 L18 6 V26 L11 20 H6 Z" fill="#e5d5b8" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M22 12 L28 20 M28 12 L22 20" stroke="#c94d3b" stroke-width="2.8" stroke-linecap="round"/></svg>`,
    search: `<svg class="game-svg" viewBox="0 0 32 32" fill="none"><circle cx="14" cy="14" r="8" stroke="${INK}" stroke-width="2.8"/><line x1="20" y1="20" x2="27" y2="27" stroke="${INK}" stroke-width="3" stroke-linecap="round"/></svg>`
  };
  return map[name] || map.home;
}
