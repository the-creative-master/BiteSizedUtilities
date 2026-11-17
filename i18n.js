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
const CACHE_PREFIX = 'bite-i18n-v1:';
const SEP = '\n[[[BITE_SEP]]]\n';
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'SVG', 'PATH', 'PRE', 'CODE', 'NOSCRIPT', 'CANVAS', 'IFRAME']);

let currentLang = 'English';
try {
  const saved = localStorage.getItem(LANG_KEY);
  if (saved && APP_LANGUAGES.some(l => l.name === saved)) currentLang = saved;
} catch {}

const origTextMap = new WeakMap();
const origAttrMap = new WeakMap();
const memCache = new Map();
let observer = null;
let translateTimer = null;
let translating = false;

export function getAppLanguage() {
  return currentLang;
}

export function getAppLanguageMeta() {
  return APP_LANGUAGES.find(l => l.name === currentLang) || APP_LANGUAGES[0];
}

function loadLangCache(code) {
  if (memCache.has(code)) return memCache.get(code);
  let obj = {};
  try {
    obj = JSON.parse(localStorage.getItem(CACHE_PREFIX + code) || '{}') || {};
  } catch {}
  memCache.set(code, obj);
  return obj;
}

function saveLangCache(code, obj) {
  try {
    const entries = Object.entries(obj).slice(-800);
    localStorage.setItem(CACHE_PREFIX + code, JSON.stringify(Object.fromEntries(entries)));
  } catch {}
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

async function fetchTranslationsBatch(strings, targetCode) {
  const cache = loadLangCache(targetCode);
  const missing = strings.filter(s => !(s in cache));
  if (!missing.length) return cache;

  // Group into safe URL-length chunks
  let chunk = [];
  let charSum = 0;
  const batches = [];
  for (const s of missing) {
    if (chunk.length && (charSum + s.length > 900 || chunk.length >= 18)) {
      batches.push(chunk);
      chunk = [];
      charSum = 0;
    }
    chunk.push(s);
    charSum += s.length + SEP.length;
  }
  if (chunk.length) batches.push(chunk);

  for (const b of batches) {
    try {
      const joined = b.join(SEP);
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(targetCode)}&dt=t&q=${encodeURIComponent(joined)}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const fullOut = (Array.isArray(data?.[0]) ? data[0] : [])
        .map(part => (Array.isArray(part) && typeof part[0] === 'string' ? part[0] : ''))
        .join('');
      const pieces = fullOut.split(/\[\[\[?\s*BITE_SEP\s*\]?\]\]/i);
      if (pieces.length === b.length) {
        b.forEach((src, i) => {
          cache[src] = (pieces[i] || src).trim();
        });
      } else {
        // Fallback single-item translation if delimiter shifted
        await Promise.all(b.map(async src => {
          try {
            const u = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(targetCode)}&dt=t&q=${encodeURIComponent(src)}`;
            const r = await fetch(u);
            if (!r.ok) return;
            const d = await r.json();
            const out = (Array.isArray(d?.[0]) ? d[0] : []).map(p => p?.[0] || '').join('').trim();
            if (out) cache[src] = out;
          } catch {}
        }));
      }
    } catch {}
  }

  saveLangCache(targetCode, cache);
  return cache;
}

export async function applyAppLanguage(root = document.querySelector('#app')) {
  if (typeof document === 'undefined' || !root) return;
  const meta = getAppLanguageMeta();
  document.documentElement.lang = meta.code;
  document.documentElement.dir = meta.code === 'ar' ? 'rtl' : 'ltr';

  if (meta.name === 'English') {
    restoreEnglish(root);
    return;
  }

  if (translating) return;
  translating = true;
  try {
    const { textNodes, attrs } = collectTargets(root);
    const uniqueStrings = new Set();
    for (const n of textNodes) {
      const t = (origTextMap.get(n) || '').trim();
      if (t) uniqueStrings.add(t);
    }
    for (const a of attrs) {
      const t = a.orig.trim();
      if (t) uniqueStrings.add(t);
    }
    if (!uniqueStrings.size) return;

    const cache = await fetchTranslationsBatch([...uniqueStrings], meta.code);
    if (currentLang !== meta.name) return;

    for (const n of textNodes) {
      const orig = origTextMap.get(n);
      if (!orig) continue;
      const key = orig.trim();
      const tr = cache[key];
      if (tr && tr !== n.nodeValue?.trim()) {
        const lead = orig.match(/^\s*/)?.[0] || '';
        const trail = orig.match(/\s*$/)?.[0] || '';
        n.nodeValue = `${lead}${tr}${trail}`;
      }
    }
    for (const a of attrs) {
      const tr = cache[a.orig.trim()];
      if (tr) a.node.setAttribute(a.attr, tr);
    }
  } finally {
    translating = false;
  }
}

export function setAppLanguage(langName) {
  if (!APP_LANGUAGES.some(l => l.name === langName)) return;
  currentLang = langName;
  try { localStorage.setItem(LANG_KEY, langName); } catch {}
  applyAppLanguage();
}

export function initAppI18n() {
  if (typeof MutationObserver === 'undefined' || observer) return;
  const appRoot = document.querySelector('#app');
  if (!appRoot) return;
  observer = new MutationObserver(muts => {
    if (currentLang === 'English') return;
    const relevant = muts.some(m => !m.target?.closest?.('#waffle-ai-overlay'));
    if (!relevant) return;
    clearTimeout(translateTimer);
    translateTimer = setTimeout(() => applyAppLanguage(appRoot), 60);
  });
  observer.observe(appRoot, { childList: true, subtree: true });
  if (currentLang !== 'English') applyAppLanguage(appRoot);
}
