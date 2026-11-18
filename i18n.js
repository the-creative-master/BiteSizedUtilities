import { EN_KEYS, NATIVE_DICTS } from './i18n-dicts.js';

export const APP_LANGUAGES = [
  { name: 'English', native: 'English', code: 'en' },
  { name: 'Spanish', native: 'Español', code: 'es' },
  { name: 'French', native: 'Français', code: 'fr' },
  { name: 'German', native: 'Deutsch', code: 'de' },
  { name: 'Arabic', native: 'العربية', code: 'ar' },
  { name: 'Japanese', native: '日本語', code: 'ja' },
  { name: 'Korean', native: '한국어', code: 'ko' },
  { name: 'Mandarin Chinese', native: '中文', code: 'zh-CN' },
  { name: 'Portuguese', native: 'Português', code: 'pt' },
  { name: 'Italian', native: 'Italiano', code: 'it' },
  { name: 'Russian', native: 'Русский', code: 'ru' },
  { name: 'Hindi', native: 'हिन्दी', code: 'hi' },
  { name: 'Turkish', native: 'Türkçe', code: 'tr' },
  { name: 'Dutch', native: 'Nederlands', code: 'nl' },
  { name: 'Vietnamese', native: 'Tiếng Việt', code: 'vi' }
];

const LANG_KEY = 'bite-app-language';
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'SVG', 'PATH', 'PRE', 'CODE', 'NOSCRIPT', 'CANVAS', 'IFRAME']);

const COUNT_WORDS = {
  es: { utilities: 'HERRAMIENTAS', games: 'JUEGOS', offlineGames: 'juegos sin conexión', controls: 'Controles' },
  fr: { utilities: 'OUTILS', games: 'JEUX', offlineGames: 'jeux hors ligne', controls: 'Contrôles' },
  de: { utilities: 'WERKZEUGE', games: 'SPIELE', offlineGames: 'Offline-Spiele', controls: 'Steuerung' },
  ar: { utilities: 'أداة', games: 'ألعاب', offlineGames: 'ألعاب دون اتصال', controls: 'التحكم' },
  ja: { utilities: '個のツール', games: '本のゲーム', offlineGames: 'オフラインゲーム', controls: '操作' },
  ko: { utilities: '개 도구', games: '개 게임', offlineGames: '오프라인 게임', controls: '조작법' },
  'zh-CN': { utilities: '个工具', games: '款游戏', offlineGames: '离线游戏', controls: '操作方式' },
  pt: { utilities: 'FERRAMENTAS', games: 'JOGOS', offlineGames: 'jogos offline', controls: 'Controles' },
  it: { utilities: 'STRUMENTI', games: 'GIOCHI', offlineGames: 'giochi offline', controls: 'Comandi' },
  ru: { utilities: 'ИНСТРУМЕНТОВ', games: 'ИГР', offlineGames: 'офлайн-игр', controls: 'Управление' },
  hi: { utilities: 'टूल्स', games: 'गेम्स', offlineGames: 'ऑफ़लाइन गेम', controls: 'नियंत्रण' },
  tr: { utilities: 'ARAÇ', games: 'OYUN', offlineGames: 'çevrimdışı oyun', controls: 'Kontroller' },
  nl: { utilities: 'TOOLS', games: 'SPELLEN', offlineGames: 'offline games', controls: 'Besturing' },
  vi: { utilities: 'CÔNG CỤ', games: 'TRÒ CHƠI', offlineGames: 'game ngoại tuyến', controls: 'Điều khiển' }
};

let currentLang = 'English';
try {
  const saved = localStorage.getItem(LANG_KEY);
  if (saved && APP_LANGUAGES.some(l => l.name === saved)) currentLang = saved;
} catch {}

const origTextMap = new WeakMap();
const origAttrMap = new WeakMap();
const dictCache = new Map();
let observer = null;
let translateTimer = null;

function getDict(code) {
  if (dictCache.has(code)) return dictCache.get(code);
  const exact = new Map();
  const lower = new Map();
  const list = NATIVE_DICTS[code];
  if (list) {
    EN_KEYS.forEach((src, i) => {
      const dst = list[i];
      if (dst) {
        exact.set(src, dst);
        if (!lower.has(src.toLowerCase())) lower.set(src.toLowerCase(), dst);
      }
    });
  }
  const bundle = { exact, lower, words: COUNT_WORDS[code] || {} };
  dictCache.set(code, bundle);
  return bundle;
}

export function getAppLanguage() {
  return currentLang;
}

export function getAppLanguageMeta() {
  return APP_LANGUAGES.find(l => l.name === currentLang) || APP_LANGUAGES[0];
}

export function tUI(text, code = getAppLanguageMeta().code) {
  if (!text || code === 'en') return text;
  const trimmed = String(text).trim();
  if (!trimmed) return text;

  const { exact, lower, words } = getDict(code);
  if (exact.has(trimmed)) return exact.get(trimmed);
  if (lower.has(trimmed.toLowerCase())) return lower.get(trimmed.toLowerCase());

  // Dynamic patterns: counts & labels
  let m = trimmed.match(/^(\d+)\s+UTILITIES$/i);
  if (m && words.utilities) return `${m[1]} ${words.utilities}`;

  m = trimmed.match(/^(\d+)\s+GAMES$/i);
  if (m && words.games) return `${m[1]} ${words.games}`;

  m = trimmed.match(/^(All|Action|Puzzle|Casual|Fancade)\s*·\s*(\d+)$/);
  if (m) return `${exact.get(m[1]) || m[1]} · ${m[2]}`;

  m = trimmed.match(/^(ACTION|PUZZLE|CASUAL|FANCADE)\s*·\s*OFFLINE ARCADE$/i);
  if (m) {
    const cap = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
    return `${(exact.get(cap) || cap).toUpperCase()} · OFFLINE ARCADE`;
  }

  m = trimmed.match(/^(\d+)\s+offline\s+games\s+ready\s+to\s+play$/i);
  if (m && words.offlineGames) return `${m[1]} ${words.offlineGames}`;

  m = trimmed.match(/^Controls:\s*(.+)$/i);
  if (m && words.controls) return `${words.controls}: ${m[1]}`;

  m = trimmed.match(/^([A-Za-z &/+.-]+):\s*(.+)$/);
  if (m) {
    const head = exact.get(m[1].trim()) || lower.get(m[1].trim().toLowerCase());
    const tail = exact.get(m[2].trim()) || lower.get(m[2].trim().toLowerCase()) || m[2].trim();
    if (head) return `${head}: ${tail}`;
  }

  // Strip trailing colon for label lookup
  if (trimmed.endsWith(':')) {
    const base = trimmed.slice(0, -1).trim();
    const hit = exact.get(base) || lower.get(base.toLowerCase());
    if (hit) return `${hit}:`;
  }

  return text;
}

function shouldSkipElement(el) {
  if (!el || el.nodeType !== 1) return false;
  if (SKIP_TAGS.has(el.tagName)) return true;
  if (el.id === 'waffle-ai-overlay' || el.closest?.('#waffle-ai-overlay')) return true;
  if (el.hasAttribute?.('data-no-i18n') || el.closest?.('[data-no-i18n]')) return true;
  if (el.classList?.contains('code-area') || el.classList?.contains('cm-editor')) return true;
  return false;
}

function collectTargets(root) {
  const textNodes = [];
  const attrs = [];
  if (!root) return { textNodes, attrs };

  const walk = node => {
    if (!node) return;
    if (node.nodeType === 3) {
      if (shouldSkipElement(node.parentElement)) return;
      const raw = node.nodeValue || '';
      const trimmed = raw.trim();
      if (!trimmed || trimmed.length < 2 || /^[\d\s.,:;!?+\-*/=<>()[\]{}|\\/@#$%^&*~`'"•★☆◈⌘▤✿⚛文♧✕✓✔▶⏸⏹⬇⬆⇄📎🎨🤖🌐✨⚠📄🔊📋🃏💬🎭🔍📝📚🪶💡📖✉🧠🗣]+$/.test(trimmed)) {
        return;
      }
      if (!origTextMap.has(node)) origTextMap.set(node, raw);
      textNodes.push(node);
      return;
    }
    if (node.nodeType !== 1 || shouldSkipElement(node)) return;
    if ((node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') && node.hasAttribute('placeholder')) {
      let store = origAttrMap.get(node);
      if (!store) { store = {}; origAttrMap.set(node, store); }
      if (store.placeholder === undefined) store.placeholder = node.getAttribute('placeholder') || '';
      if (store.placeholder.trim().length >= 2) attrs.push({ node, attr: 'placeholder', orig: store.placeholder });
    }
    for (const child of node.childNodes) walk(child);
  };

  walk(root);
  return { textNodes, attrs };
}

function restoreEnglish(root) {
  if (!root) return;
  const walk = node => {
    if (node.nodeType === 3) {
      if (origTextMap.has(node)) node.nodeValue = origTextMap.get(node);
      return;
    }
    if (node.nodeType !== 1 || shouldSkipElement(node)) return;
    const store = origAttrMap.get(node);
    if (store?.placeholder !== undefined) node.setAttribute('placeholder', store.placeholder);
    for (const child of node.childNodes) walk(child);
  };
  walk(root);
}

export function applyAppLanguage(root = document.querySelector('#app')) {
  if (typeof document === 'undefined' || !root) return;
  const meta = getAppLanguageMeta();
  document.documentElement.lang = meta.code;
  document.documentElement.dir = meta.code === 'ar' ? 'rtl' : 'ltr';

  if (meta.name === 'English') {
    restoreEnglish(root);
    return;
  }

  const { textNodes, attrs } = collectTargets(root);
  for (const n of textNodes) {
    const orig = origTextMap.get(n) || '';
    const trimmed = orig.trim();
    const tr = tUI(trimmed, meta.code);
    if (tr && tr !== trimmed) {
      const lead = orig.match(/^\s*/)?.[0] || '';
      const trail = orig.match(/\s*$/)?.[0] || '';
      n.nodeValue = lead + tr + trail;
    }
  }
  for (const a of attrs) {
    const tr = tUI(a.orig.trim(), meta.code);
    if (tr) a.node.setAttribute(a.attr, tr);
  }
}

export function setAppLanguage(langName) {
  if (!APP_LANGUAGES.some(l => l.name === langName)) return;
  currentLang = langName;
  try { localStorage.setItem(LANG_KEY, langName); } catch {}
  applyAppLanguage();
}

export function initAppI18n(root = document.querySelector('#app')) {
  if (typeof document === 'undefined' || !root) return;
  applyAppLanguage(root);
  if (observer) observer.disconnect();
  observer = new MutationObserver(muts => {
    if (currentLang === 'English') return;
    const relevant = muts.some(m => !shouldSkipElement(m.target));
    if (!relevant) return;
    clearTimeout(translateTimer);
    translateTimer = setTimeout(() => applyAppLanguage(root), 30);
  });
  observer.observe(root, { childList: true, subtree: true });
}
