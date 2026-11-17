(function () {
  function memoryStorage() {
    const store = new Map();
    const api = {
      getItem: k => (store.has(String(k)) ? store.get(String(k)) : null),
      setItem: (k, v) => { store.set(String(k), String(v)); },
      removeItem: k => { store.delete(String(k)); },
      clear: () => { store.clear(); },
      key: i => Array.from(store.keys())[i] ?? null,
      get length() { return store.size; }
    };
    return new Proxy(api, {
      get(target, prop) {
        if (prop in target) {
          const val = target[prop];
          return typeof val === 'function' ? val.bind(target) : val;
        }
        return store.has(String(prop)) ? store.get(String(prop)) : undefined;
      },
      set(target, prop, value) { store.set(String(prop), String(value)); return true; },
      deleteProperty(target, prop) { store.delete(String(prop)); return true; },
      has(target, prop) { return prop in target || store.has(String(prop)); },
      ownKeys() { return Array.from(store.keys()); },
      getOwnPropertyDescriptor(target, prop) {
        if (store.has(String(prop))) return { configurable: true, enumerable: true, value: store.get(String(prop)) };
        return undefined;
      }
    });
  }
  for (const name of ['localStorage', 'sessionStorage']) {
    try { void window[name].length; } catch {
      try { Object.defineProperty(window, name, { configurable: true, value: memoryStorage() }); } catch {}
    }
  }
  try {
    const orig = window.indexedDB;
    if (!orig) throw new Error('missing');
    orig.databases?.();
  } catch {}

  if (window.__arcadeControlsInstalled) return;
  window.__arcadeControlsInstalled = true;

  const scriptEl = document.currentScript;
  const appRoot = scriptEl?.src ? new URL('../#games', scriptEl.src).href : '/#games';

  function mount() {
    if (!document.body || document.getElementById('offline-arcade-controls')) return;
    const box = document.createElement('div');
    box.id = 'offline-arcade-controls';
    box.style.cssText = 'position:fixed;top:8px;right:8px;z-index:2147483647;display:flex;gap:6px;font:600 12px system-ui,sans-serif;';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = 'background:#4f2f23;color:#fff8e8;border:2px solid #f7d996;border-radius:10px;padding:7px 11px;cursor:pointer;font:inherit';
    btn.textContent = window.opener ? '✕ Close Tab' : '← Back to Arcade';
    btn.setAttribute('aria-label', window.opener ? 'Close game tab' : 'Back to Arcade');
    btn.addEventListener('click', () => {
      if (window.opener) {
        try { window.close(); } catch {}
      }
      if (history.length > 1) history.back();
      else location.assign(appRoot);
    });
    box.appendChild(btn);
    document.body.appendChild(box);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
