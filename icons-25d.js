// Hand-crafted, multi-color 2.5D cartoon game SVG props & icons (no monochrome icons).
const INK = '#4b3121';

export function waffleMascotSVG(cls = 'waffle-svg') {
  return `<svg class="${cls}" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <ellipse cx="90" cy="162" rx="56" ry="12" fill="#8d5c34" opacity="0.24"/>
    <rect x="24" y="34" width="132" height="122" rx="34" fill="#d99442" stroke="${INK}" stroke-width="5"/>
    <rect x="24" y="24" width="132" height="122" rx="34" fill="#f7c46c" stroke="${INK}" stroke-width="5"/>
    <rect x="35" y="35" width="110" height="100" rx="24" fill="#f5b858"/>
    <!-- Waffle pockets -->
    <g fill="#d68c3a" stroke="#b97228" stroke-width="2">
      <rect x="43" y="43" width="22" height="20" rx="6"/>
      <rect x="71" y="43" width="22" height="20" rx="6"/>
      <rect x="99" y="43" width="22" height="20" rx="6"/>
      <rect x="125" y="43" width="14" height="20" rx="5"/>
      <rect x="43" y="70" width="22" height="20" rx="6"/>
      <rect x="71" y="70" width="22" height="20" rx="6"/>
      <rect x="99" y="70" width="22" height="20" rx="6"/>
      <rect x="125" y="70" width="14" height="20" rx="5"/>
      <rect x="43" y="97" width="22" height="20" rx="6"/>
      <rect x="71" y="97" width="22" height="20" rx="6"/>
      <rect x="99" y="97" width="22" height="20" rx="6"/>
      <rect x="125" y="97" width="14" height="20" rx="5"/>
    </g>
    <!-- Syrup drizzle -->
    <path d="M40 34 C45 20, 135 20, 140 34 C144 46, 132 54, 126 44 C121 36, 114 55, 106 49 C99 43, 95 62, 87 54 C80 46, 71 58, 64 47 C58 38, 48 50, 40 34Z" fill="#c96f2d" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <!-- Butter pat hat -->
    <rect x="67" y="13" width="46" height="24" rx="8" transform="rotate(-6 90 25)" fill="#fff099" stroke="${INK}" stroke-width="4.5"/>
    <rect x="74" y="18" width="18" height="6" rx="3" transform="rotate(-6 90 25)" fill="#fffbe0"/>
    <!-- Cute face -->
    <ellipse cx="56" cy="103" rx="11" ry="7" fill="#ff9e9e" opacity="0.85"/>
    <ellipse cx="124" cy="103" rx="11" ry="7" fill="#ff9e9e" opacity="0.85"/>
    <g class="waffle-eyes">
      <circle cx="67" cy="90" r="9.5" fill="${INK}"/>
      <circle cx="113" cy="90" r="9.5" fill="${INK}"/>
      <circle cx="64" cy="86.5" r="3.4" fill="#fff8eb"/>
      <circle cx="110" cy="86.5" r="3.4" fill="#fff8eb"/>
      <circle cx="70" cy="93" r="1.6" fill="#fff8eb"/>
      <circle cx="116" cy="93" r="1.6" fill="#fff8eb"/>
    </g>
    <path d="M80 100 Q90 113 100 100" stroke="${INK}" stroke-width="4.5" stroke-linecap="round" fill="none"/>
    <!-- Little hands -->
    <path d="M23 94 C11 90, 10 108, 24 108" fill="#f7c46c" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M157 94 C169 90, 170 108, 156 108" fill="#f7c46c" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>
  </svg>`;
}

export function cupboardIconSVG(id) {
  const icons = {
    math: `<svg class="game-svg" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="14" y="12" width="52" height="58" rx="14" fill="#78b77e" stroke="${INK}" stroke-width="4"/>
      <rect x="21" y="19" width="38" height="16" rx="6" fill="#e9f7d6" stroke="${INK}" stroke-width="3"/>
      <text x="53" y="31" text-anchor="end" font-family="Fredoka,sans-serif" font-weight="700" font-size="11" fill="${INK}">123</text>
      <circle cx="27" cy="46" r="5.5" fill="#fff2b2" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="40" cy="46" r="5.5" fill="#ffd2b8" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="53" cy="46" r="5.5" fill="#bfe3ff" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="27" cy="59" r="5.5" fill="#fff2b2" stroke="${INK}" stroke-width="2.5"/>
      <rect x="35" y="53.5" width="23" height="11" rx="5.5" fill="#ff9e85" stroke="${INK}" stroke-width="2.5"/>
    </svg>`,
    code: `<svg class="game-svg" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="16" width="60" height="46" rx="12" fill="#f4b872" stroke="${INK}" stroke-width="4"/>
      <rect x="17" y="23" width="46" height="32" rx="7" fill="#524139" stroke="${INK}" stroke-width="3"/>
      <path d="M29 34 L22 39 L29 44" stroke="#ffd87d" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M51 34 L58 39 L51 44" stroke="#9ee09e" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M43 32 L37 46" stroke="#ffadad" stroke-width="3.5" stroke-linecap="round"/>
      <rect x="30" y="62" width="20" height="7" rx="3.5" fill="#d99754" stroke="${INK}" stroke-width="3"/>
    </svg>`,
    text: `<svg class="game-svg" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="13" width="48" height="54" rx="10" fill="#89bce8" stroke="${INK}" stroke-width="4"/>
      <rect x="22" y="18" width="36" height="44" rx="6" fill="#fff5e0" stroke="${INK}" stroke-width="3"/>
      <line x1="28" y1="29" x2="52" y2="29" stroke="#e58872" stroke-width="4" stroke-linecap="round"/>
      <line x1="28" y1="39" x2="48" y2="39" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>
      <line x1="28" y1="49" x2="44" y2="49" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>
      <circle cx="56" cy="54" r="11" fill="#ffd97d" stroke="${INK}" stroke-width="3.5"/>
      <path d="M52 54 L56 58 L61 50" stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    art: `<svg class="game-svg" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M40 13 C21 13 11 26 12 42 C13 58 26 67 42 67 C49 67 53 62 51 56 C49 51 54 47 60 47 C66 47 70 42 68 33 C65 21 54 13 40 13Z" fill="#f7dec2" stroke="${INK}" stroke-width="4"/>
      <circle cx="27" cy="31" r="6" fill="#ff8f8f" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="43" cy="25" r="6" fill="#ffd97d" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="56" cy="34" r="5.5" fill="#8fd3a4" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="25" cy="47" r="5.5" fill="#9bc9f2" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="38" cy="54" r="5" fill="#cda8e8" stroke="${INK}" stroke-width="2.5"/>
    </svg>`,
    science: `<svg class="game-svg" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M32 14 H48 V29 L62 56 C64 61 61 66 55 66 H25 C19 66 16 61 18 56 L32 29 V14Z" fill="#d9f2e6" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M23 48 H57 L60 56 C61 60 58 63 54 63 H26 C22 63 19 60 20 56 L23 48Z" fill="#7fd1a8"/>
      <rect x="28" y="11" width="24" height="7" rx="3.5" fill="#f6c478" stroke="${INK}" stroke-width="3.5"/>
      <circle cx="35" cy="54" r="3.5" fill="#fff5d6" stroke="${INK}" stroke-width="2"/>
      <circle cx="47" cy="57" r="2.5" fill="#fff5d6" stroke="${INK}" stroke-width="2"/>
      <circle cx="42" cy="40" r="3" fill="#a8e8ca" stroke="${INK}" stroke-width="2"/>
    </svg>`,
    games: `<svg class="game-svg" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22 25 H58 C66 25 71 34 69 47 C68 55 62 60 56 57 L48 51 H32 L24 57 C18 60 12 55 11 47 C9 34 14 25 22 25Z" fill="#c7b2ea" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M25 32 V44 M19 38 H31" stroke="#fff6e3" stroke-width="5" stroke-linecap="round"/>
      <path d="M25 32 V44 M19 38 H31" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="52" cy="34" r="4" fill="#ff9494" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="59" cy="41" r="4" fill="#ffe17d" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="45" cy="41" r="4" fill="#8ee0a3" stroke="${INK}" stroke-width="2.5"/>
    </svg>`
  };
  return icons[id] || icons.math;
}

export function toolPropSVG(id) {
  const props = {
    calculator: `<svg class="game-svg" viewBox="0 0 76 76" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="14" y="10" width="48" height="58" rx="13" fill="#9bd19b" stroke="${INK}" stroke-width="3.5"/>
      <rect x="14" y="6" width="48" height="56" rx="13" fill="#b9e6b3" stroke="${INK}" stroke-width="3.5"/>
      <rect x="21" y="13" width="34" height="14" rx="5" fill="#fff7dd" stroke="${INK}" stroke-width="3"/>
      <text x="50" y="24" text-anchor="end" font-family="Fredoka,sans-serif" font-weight="700" font-size="10" fill="${INK}">42</text>
      <rect x="21" y="32" width="9" height="9" rx="3" fill="#fff5e0" stroke="${INK}" stroke-width="2.5"/>
      <rect x="33.5" y="32" width="9" height="9" rx="3" fill="#fff5e0" stroke="${INK}" stroke-width="2.5"/>
      <rect x="46" y="32" width="9" height="9" rx="3" fill="#ffbfa3" stroke="${INK}" stroke-width="2.5"/>
      <rect x="21" y="45" width="9" height="9" rx="3" fill="#fff5e0" stroke="${INK}" stroke-width="2.5"/>
      <rect x="33.5" y="45" width="21.5" height="9" rx="4" fill="#ffe17d" stroke="${INK}" stroke-width="2.5"/>
    </svg>`,
    'graphing-calculator': `<svg class="game-svg" viewBox="0 0 76 76" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="14" width="60" height="50" rx="12" fill="#c98e54" stroke="${INK}" stroke-width="3.5"/>
      <rect x="8" y="10" width="60" height="48" rx="12" fill="#f7d59c" stroke="${INK}" stroke-width="3.5"/>
      <rect x="15" y="17" width="46" height="34" rx="6" fill="#fff8e8" stroke="${INK}" stroke-width="3"/>
      <line x1="38" y1="19" x2="38" y2="49" stroke="#d8cdb8" stroke-width="2"/>
      <line x1="17" y1="34" x2="59" y2="34" stroke="#d8cdb8" stroke-width="2"/>
      <path d="M18 42 Q28 18, 38 34 T58 24" stroke="#e57a6b" stroke-width="3.5" stroke-linecap="round" fill="none"/>
      <circle cx="38" cy="34" r="3.5" fill="#6ab07c" stroke="${INK}" stroke-width="2"/>
    </svg>`,
    'bodily-calculator': `<svg class="game-svg" viewBox="0 0 76 76" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="15" width="52" height="50" rx="14" fill="#f7b2a6" stroke="${INK}" stroke-width="3.5"/>
      <rect x="12" y="11" width="52" height="48" rx="14" fill="#ffd2c9" stroke="${INK}" stroke-width="3.5"/>
      <rect x="23" y="18" width="30" height="14" rx="7" fill="#fff7ea" stroke="${INK}" stroke-width="2.8"/>
      <path d="M38 29 L43 21" stroke="#e36d5b" stroke-width="3" stroke-linecap="round"/>
      <path d="M38 52 C38 52 25 44 25 38 C25 34.5 28 32 31.5 32 C34.2 32 36.5 33.8 38 36 C39.5 33.8 41.8 32 44.5 32 C48 32 51 34.5 51 38 C51 44 38 52 38 52Z" fill="#ff8f8f" stroke="${INK}" stroke-width="2.8"/>
    </svg>`,
    fractions: `<svg class="game-svg" viewBox="0 0 76 76" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="38" cy="40" r="24" fill="#f7c873" stroke="${INK}" stroke-width="3.5"/>
      <path d="M38 40 L38 16 A24 24 0 0 1 62 40 Z" fill="#ff9e85" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M38 40 L62 40 A24 24 0 0 1 21 57 Z" fill="#9fd99e" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="38" cy="40" r="6" fill="#fff6e0" stroke="${INK}" stroke-width="2.5"/>
    </svg>`,
    percentage: `<svg class="game-svg" viewBox="0 0 76 76" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 20 L44 12 L64 34 L38 62 L14 38 Z" fill="#ffe082" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
      <circle cx="26" cy="26" r="4" fill="#fff8e8" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="35" cy="36" r="5" fill="#ff9b85" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="47" cy="42" r="5" fill="#8fd3a4" stroke="${INK}" stroke-width="2.5"/>
      <line x1="47" y1="28" x2="34" y2="49" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>
    </svg>`,
    'dice-roller': `<svg class="game-svg" viewBox="0 0 76 76" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="24" width="32" height="32" rx="8" transform="rotate(-10 28 40)" fill="#fff6e2" stroke="${INK}" stroke-width="3.5"/>
      <circle cx="22" cy="34" r="3" fill="${INK}"/>
      <circle cx="33" cy="45" r="3" fill="${INK}"/>
      <rect x="33" y="16" width="32" height="32" rx="8" transform="rotate(12 49 32)" fill="#ffd4a8" stroke="${INK}" stroke-width="3.5"/>
      <circle cx="43" cy="25" r="3" fill="#c94d3b"/>
      <circle cx="55" cy="27" r="3" fill="#c94d3b"/>
      <circle cx="49" cy="32" r="3" fill="#c94d3b"/>
      <circle cx="42" cy="38" r="3" fill="#c94d3b"/>
      <circle cx="54" cy="40" r="3" fill="#c94d3b"/>
    </svg>`,
    'roman-numerals': `<svg class="game-svg" viewBox="0 0 76 76" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="12" width="44" height="52" rx="8" fill="#f7e4bc" stroke="${INK}" stroke-width="3.5"/>
      <rect x="12" y="10" width="52" height="10" rx="5" fill="#e5bd7b" stroke="${INK}" stroke-width="3.5"/>
      <rect x="12" y="56" width="52" height="10" rx="5" fill="#e5bd7b" stroke="${INK}" stroke-width="3.5"/>
      <line x1="27" y1="30" x2="49" y2="30" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
      <text x="38" y="48" text-anchor="middle" font-family="Fredoka,sans-serif" font-weight="700" font-size="18" fill="${INK}">XIV</text>
    </svg>`,
    'number-base': `<svg class="game-svg" viewBox="0 0 76 76" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="11" y="15" width="54" height="46" rx="10" fill="#d9a66c" stroke="${INK}" stroke-width="3.5"/>
      <rect x="17" y="21" width="42" height="34" rx="6" fill="#fff5df" stroke="${INK}" stroke-width="2.5"/>
      <line x1="18" y1="31" x2="58" y2="31" stroke="${INK}" stroke-width="2.5"/>
      <line x1="18" y1="45" x2="58" y2="45" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="28" cy="31" r="5" fill="#ff9e85" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="40" cy="31" r="5" fill="#ffd97d" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="33" cy="45" r="5" fill="#8fd3a4" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="47" cy="45" r="5" fill="#9bc9f2" stroke="${INK}" stroke-width="2.5"/>
    </svg>`,
    'prime-checker': `<svg class="game-svg" viewBox="0 0 76 76" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M38 10 L46 25 L63 27 L50 39 L53 56 L38 48 L23 56 L26 39 L13 27 L30 25 Z" fill="#ffe07d" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
      <text x="38" y="42" text-anchor="middle" font-family="Fredoka,sans-serif" font-weight="700" font-size="17" fill="${INK}">7</text>
    </svg>`,
    'sequence-playground': `<svg class="game-svg" viewBox="0 0 76 76" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="42" width="16" height="20" rx="5" fill="#ffbfa3" stroke="${INK}" stroke-width="3"/>
      <rect x="30" y="30" width="16" height="32" rx="5" fill="#ffe184" stroke="${INK}" stroke-width="3"/>
      <rect x="50" y="16" width="16" height="46" rx="5" fill="#9fd99e" stroke="${INK}" stroke-width="3"/>
      <text x="18" y="56" text-anchor="middle" font-family="Fredoka,sans-serif" font-weight="700" font-size="10" fill="${INK}">1</text>
      <text x="38" y="50" text-anchor="middle" font-family="Fredoka,sans-serif" font-weight="700" font-size="10" fill="${INK}">2</text>
      <text x="58" y="44" text-anchor="middle" font-family="Fredoka,sans-serif" font-weight="700" font-size="10" fill="${INK}">3</text>
    </svg>`
  };
  if (props[id]) return props[id];
  // Colorful cartoon generic badge for other cupboards' tools
  return `<svg class="game-svg" viewBox="0 0 76 76" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="13" y="15" width="50" height="48" rx="14" fill="#d9c6ef" stroke="${INK}" stroke-width="3.5"/>
    <rect x="13" y="11" width="50" height="46" rx="14" fill="#efe4fb" stroke="${INK}" stroke-width="3.5"/>
    <path d="M38 20 L42 29 L52 30 L45 37 L47 47 L38 42 L29 47 L31 37 L24 30 L34 29 Z" fill="#ffd97d" stroke="${INK}" stroke-width="2.8" stroke-linejoin="round"/>
  </svg>`;
}

export function uiIconSVG(name) {
  const map = {
    home: `<svg class="game-svg" viewBox="0 0 32 32" fill="none"><path d="M5 15 L16 5 L27 15 V26 C27 27.1 26.1 28 25 28 H7 C5.9 28 5 27.1 5 26 V15Z" fill="#ffd99a" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><rect x="12" y="18" width="8" height="10" rx="3" fill="#c97d4b" stroke="${INK}" stroke-width="2.2"/></svg>`,
    heart: `<svg class="game-svg" viewBox="0 0 32 32" fill="none"><path d="M16 27 C16 27 5 19.5 5 11.5 C5 7.5 8 5 11.5 5 C13.8 5 15.5 6.4 16 8 C16.5 6.4 18.2 5 20.5 5 C24 5 27 7.5 27 11.5 C27 19.5 16 27 16 27Z" fill="#ff9e9e" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
    clock: `<svg class="game-svg" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="11" fill="#bfe3ff" stroke="${INK}" stroke-width="2.5"/><path d="M16 10 V16 L20 19" stroke="${INK}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    back: `<svg class="game-svg" viewBox="0 0 32 32" fill="none"><path d="M20 7 L10 16 L20 25" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    star: `<svg class="game-svg" viewBox="0 0 32 32" fill="none"><path d="M16 4 L19.5 11.5 L28 12.5 L21.8 18.4 L23.5 26.8 L16 22.8 L8.5 26.8 L10.2 18.4 L4 12.5 L12.5 11.5 Z" fill="#ffe17d" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/></svg>`
  };
  return map[name] || map.star;
}
