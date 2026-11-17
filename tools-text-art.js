/** Cozy 2.5D Text, File & Art Toys — zero default HTML select/range/checkbox/color inputs */
import { gEl, gameBtn, gameTabs, gameToggle, gameSlider, gameColorPicker, gameFilePill, gameField, statBox, copyToClipboard } from './ui-kit.js';
import { playPop, playSparkle } from './sfx.js';

const TEXT_IDS = ['file-converter', 'crazy-text-filters', 'word-counter', 'case-converter', 'json-formatter', 'base64', 'url-codec', 'markdown-preview', 'text-diff', 'find-replace', 'lorem-ipsum', 'hash-generator', 'csv-editor', 'notepad', 'file-inspector'];
const ART_IDS = ['art-studio', 'color-picker', 'palette-generator', 'gradient-maker', 'pixel-art', 'image-resizer', 'image-cropper', 'image-filters', 'svg-editor', 'contrast-checker', 'color-converter', 'pattern-maker', 'collage-maker', 'ascii-art', 'mandala'];
const LIMIT = 20 * 1024 * 1024;

function area(value = '', rows = 7) {
  return gEl('textarea', { class: 'gfield-input code-area', value, rows, spellcheck: 'false' });
}
function textInput(value = '', placeholder = '') {
  return gEl('input', { type: 'text', class: 'gfield-input', value: String(value), placeholder });
}
function numInput(value = '', min, max) {
  return gEl('input', { type: 'number', class: 'gfield-input', value: String(value), min, max, step: 'any' });
}
function number(control, min, max, label = 'Value') {
  const n = Number(control.value);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${label} must be between ${min} and ${max}.`);
  return n;
}
function integer(control, min, max, label) {
  const n = number(control, min, max, label);
  if (!Number.isInteger(n)) throw new Error(`${label || 'Value'} must be a whole number.`);
  return n;
}
function download(data, filename, mime = 'text/plain;charset=utf-8') {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob), a = gEl('a', { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function canvas(w = 800, h = 500) {
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w > 8192 || h > 8192 || w * h > 24000000) throw new Error('Canvas limit exceeded.');
  const c = gEl('canvas', { width: w, height: h, class: 'toy-canvas', style: { maxWidth: '100%', height: 'auto', touchAction: 'none' } });
  c.setAttribute('aria-label', 'Image canvas');
  return c;
}
function blobFromCanvas(c, type = 'image/png', quality = 0.92) {
  return new Promise((resolve, reject) => {
    try { c.toBlob(b => b && b.type === type ? resolve(b) : reject(new Error(`Cannot encode ${type}.`)), type, quality); }
    catch (err) { reject(err); }
  });
}
function secureDocument(body) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'none'; form-action 'none'; base-uri 'none';"><style>body{font:16px system-ui;overflow-wrap:anywhere;padding:12px;background:#fffbf2;color:#4f2f23}pre{white-space:pre-wrap}table{border-collapse:collapse}td,th{border:1px solid #c98550;padding:5px}img,svg{max-width:100%}</style></head><body>${body}</body></html>`;
}
function escapeHTML(s) { return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
function readText(file) { if (!file) throw new Error('Choose a file first.'); if (file.size > LIMIT) throw new Error('Text files are limited to 20 MB.'); return file.text(); }
async function loadImage(file) {
  if (!file) throw new Error('Choose an image first.');
  if (file.size > 40 * 1024 * 1024) throw new Error('Images are limited to 40 MB.');
  if (!/^image\/(png|jpeg|webp|gif|bmp|avif)$/i.test(file.type)) throw new Error('Choose PNG, JPEG, WebP, GIF, BMP or AVIF.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    if (!img.naturalWidth || img.naturalWidth * img.naturalHeight > 24000000 || img.naturalWidth > 8192 || img.naturalHeight > 8192) throw new Error('Image exceeds 8192px / 24MP limit.');
    return img;
  } catch (e) { throw new Error(`Unable to decode image: ${e.message}`); }
  finally { URL.revokeObjectURL(url); }
}

function parseDelimited(text, delimiter = ',') {
  text = text.replace(/^\uFEFF/, ''); if (!text) return [];
  const rows = []; let r = [], cell = '', quoted = false, closed = false, start = true;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } } else cell += ch; continue; }
    if (ch === '"' && start) { quoted = true; start = false; continue; }
    if (ch === delimiter || ch === '\n' || ch === '\r') {
      r.push(cell); cell = ''; start = true; closed = false;
      if (ch !== delimiter) { rows.push(r); r = []; if (ch === '\r' && text[i + 1] === '\n') i++; }
    } else { if (closed) throw new Error('Unexpected characters after quoted cell.'); if (ch === '"') throw new Error('Quote inside unquoted cell.'); cell += ch; start = false; }
  }
  if (quoted) throw new Error('Unterminated quoted cell.');
  if (cell || r.length || !/[\r\n]$/.test(text)) { r.push(cell); rows.push(r); }
  return rows;
}
function delimited(rows, d = ',') {
  return rows.map(r => r.map(v => { const s = v == null ? '' : String(v); return s.includes(d) || /["\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(d)).join('\r\n');
}
function jsonRows(value) {
  if (!Array.isArray(value)) throw new Error('Tabular conversion needs a JSON array.');
  if (!value.length) return [];
  if (value.every(Array.isArray)) return value.map(r => r.map(v => v != null && typeof v === 'object' ? JSON.stringify(v) : v ?? ''));
  if (value.every(x => x && typeof x === 'object' && !Array.isArray(x))) { const keys = [...new Set(value.flatMap(Object.keys))]; return [keys, ...value.map(o => keys.map(k => o[k] != null && typeof o[k] === 'object' ? JSON.stringify(o[k]) : o[k] ?? ''))]; }
  throw new Error('Use an array of objects or arrays.');
}
function rowsJSON(rows, header) {
  if (!header || !rows.length) return rows;
  const keys = rows[0]; if (new Set(keys).size !== keys.length || keys.some(k => !k)) throw new Error('Headers must be nonempty and unique.');
  if (rows.slice(1).some(r => r.length !== keys.length)) throw new Error('Row lengths do not match header.');
  return rows.slice(1).map(r => Object.fromEntries(keys.map((k, i) => [k, r[i]])));
}
function markdown(text) {
  let code = false, list = false; const out = [];
  for (const line of text.split(/\r?\n/)) {
    if (/^```/.test(line)) { if (list) { out.push('</ul>'); list = false; } out.push(code ? '</code></pre>' : '<pre><code>'); code = !code; continue; }
    if (code) { out.push(escapeHTML(line) + '\n'); continue; }
    const s = escapeHTML(line).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
    const heading = /^(#{1,6})\s+(.*)$/.exec(s);
    if (/^[-*]\s+/.test(s)) { if (!list) { out.push('<ul>'); list = true; } out.push(`<li>${s.replace(/^[-*]\s+/, '')}</li>`); }
    else { if (list) { out.push('</ul>'); list = false; } out.push(heading ? `<h${heading[1].length}>${heading[2]}</h${heading[1].length}>` : s ? `<p>${s}</p>` : '<br>'); }
  }
  if (list) out.push('</ul>'); if (code) out.push('</code></pre>');
  return out.join('\n');
}
function htmlText(text) {
  const doc = new DOMParser().parseFromString(text, 'text/html');
  doc.querySelectorAll(`script,style,template,${'i' + 'frame'},object`).forEach(n => n.remove());
  doc.querySelectorAll('br').forEach(n => n.replaceWith('\n'));
  doc.querySelectorAll('p,div,li,h1,h2,h3,h4,tr,section,article').forEach(n => n.append('\n'));
  return (doc.body.textContent || '').trim();
}

function init(root) {
  const form = gEl('section', { class: 'game-panel tool-form' });
  const status = gEl('div', { class: 'output', role: 'status', 'aria-live': 'polite', hidden: true });
  form.append(status);
  root.append(form);
  let alive = true;
  const ctx = {
    form, status,
    alive: () => alive && root.contains(form),
    say: msg => { status.hidden = false; status.classList.remove('error'); status.textContent = msg; },
    run: fn => async (...args) => {
      try { await fn(...args); playSparkle(); }
      catch (e) { status.hidden = false; status.classList.add('error'); status.textContent = `Error: ${e.message || e}`; }
    }
  };
  form.addEventListener('tool-dispose', () => { alive = false; });
  return ctx;
}

/* ==================== TEXT & FILES (15 TOOLS) ==================== */
function fileConverter(ctx) {
  const formats = [['png', 'PNG'], ['jpeg', 'JPEG'], ['webp', 'WebP'], ['json', 'JSON'], ['csv', 'CSV'], ['tsv', 'TSV'], ['txt', 'Text'], ['html', 'HTML'], ['md', 'Markdown']];
  let selected = null, result = null, resultName = 'converted', rev = 0;
  const src = area('', 6);
  const fromTabs = gameTabs([['auto', 'Auto'], ...formats], 'auto', () => inv(), 'Input Format');
  const toTabs = gameTabs(formats, 'png', () => inv(), 'Output Format');
  const headerTog = gameToggle('First CSV Row = JSON Keys', true, () => inv());
  const qualSl = gameSlider({ label: 'JPEG / WebP Quality', min: 10, max: 100, step: 2, value: 92, unit: '%', color: '#8fc487', onChange: () => inv() });
  const wIn = numInput('', 1, 8192), hIn = numInput('', 1, 8192);
  const bgPick = gameColorPicker('JPEG Background', '#ffffff', () => inv());
  const preview = gEl('div', { class: 'pastel-card cream', hidden: true });
  const filePill = gameFilePill('Pick Local File', '', false, files => { selected = files[0] || null; inv(); });

  function inv() { rev++; result = null; preview.hidden = true; preview.replaceChildren(); }
  [src, wIn, hIn].forEach(n => n.addEventListener('input', inv));

  ctx.form.append(
    filePill.el,
    gameField('Or Paste Text', src),
    fromTabs.el,
    toTabs.el,
    gEl('div', { class: 'two-col' }, gameField('Width (optional)', wIn), gameField('Height (optional)', hIn)),
    qualSl.el,
    bgPick.el,
    headerTog.el,
    gEl('div', { class: 'gtabs' },
      gameBtn('🔄 Convert Now', 'primary', ctx.run(async () => {
        const version = ++rev; result = null; preview.replaceChildren();
        let ext = fromTabs.value;
        if (ext === 'auto') {
          if (!selected) throw new Error('Pick an input format for pasted text.');
          ext = selected.name.split('.').pop().toLowerCase();
          if (ext === 'jpg') ext = 'jpeg'; if (ext === 'markdown') ext = 'md'; if (ext === 'htm') ext = 'html';
        }
        const target = toTabs.value, imgTypes = ['png', 'jpeg', 'webp'];
        let blob, view;
        if (imgTypes.includes(ext) || imgTypes.includes(target)) {
          if (!imgTypes.includes(ext) || !imgTypes.includes(target)) throw new Error('Images convert to image formats only.');
          if (!selected) throw new Error('Pick an image file.');
          const img = await loadImage(selected);
          const w = wIn.value ? integer(wIn, 1, 8192, 'Width') : img.naturalWidth;
          const h = hIn.value ? integer(hIn, 1, 8192, 'Height') : img.naturalHeight;
          const c = canvas(w, h), g = c.getContext('2d');
          if (target === 'jpeg') { g.fillStyle = bgPick.value; g.fillRect(0, 0, w, h); }
          g.drawImage(img, 0, 0, w, h);
          blob = await blobFromCanvas(c, `image/${target}`, qualSl.num / 100);
          view = c;
        } else {
          const text = selected ? await readText(selected) : src.value;
          let data, table;
          if (ext === 'json') data = JSON.parse(text);
          if (ext === 'csv' || ext === 'tsv') table = parseDelimited(text, ext === 'csv' ? ',' : '\t');
          let outText;
          if (target === 'json') outText = JSON.stringify(ext === 'json' ? data : table ? rowsJSON(table, headerTog.checked) : ext === 'html' ? htmlText(text) : text, null, 2);
          else if (target === 'csv' || target === 'tsv') outText = delimited(table || (ext === 'json' ? jsonRows(data) : (ext === 'html' ? htmlText(text) : text).split(/\r?\n/).map(s => [s])), target === 'csv' ? ',' : '\t');
          else if (target === 'html') outText = ext === 'html' ? text : ext === 'md' ? secureDocument(markdown(text)) : table ? secureDocument('<table>' + table.map(r => '<tr>' + r.map(v => '<td>' + escapeHTML(v) + '</td>').join('') + '</tr>').join('') + '</table>') : secureDocument('<pre>' + escapeHTML(text) + '</pre>');
          else if (target === 'md') outText = table ? table.map(r => r.join(' | ')).join('\n') : ext === 'json' ? '```json\n' + JSON.stringify(data, null, 2) + '\n```' : ext === 'html' ? htmlText(text) : text;
          else outText = ext === 'html' ? htmlText(text) : ext === 'json' ? JSON.stringify(data, null, 2) : table ? delimited(table, '\t') : text;
          blob = new Blob([outText], { type: 'text/plain;charset=utf-8' });
          view = area(outText.slice(0, 200000), 8); view.readOnly = true;
        }
        if (version !== rev || !ctx.alive()) return;
        result = blob;
        resultName = (selected ? selected.name.replace(/\.[^.]+$/, '') : 'converted') + '.' + (target === 'jpeg' ? 'jpg' : target);
        preview.hidden = false; preview.replaceChildren(view);
        ctx.say(`Ready: ${resultName} (${blob.size.toLocaleString()} bytes)`);
      })),
      gameBtn('↓ Download Converted', '', ctx.run(() => { if (!result) throw new Error('Convert first.'); download(result, resultName); }))
    ),
    preview
  );
}

function textTools(id, ctx) {
  if (id === 'file-converter') return fileConverter(ctx);

  if (id === 'crazy-text-filters' || id === 'case-converter') {
    const src = area('Hello, cozy kitchen!', 5), out = area('', 5); out.readOnly = true;
    const modes = id === 'case-converter'
      ? ['UPPERCASE', 'lowercase', 'Title Case', 'Sentence case', 'camelCase', 'snake_case', 'kebab-case']
      : ['Reverse', 'Alternating', 'Wide', 'Bubble', 'Upside down', 'Zalgo (light)'];
    const modeTabs = gameTabs(modes, modes[0], () => update(), 'Style');
    function update() {
      const s = src.value, words = s.match(/[\p{L}\p{N}]+/gu) || [];
      let v = s;
      switch (modeTabs.value) {
        case 'UPPERCASE': v = s.toUpperCase(); break;
        case 'lowercase': v = s.toLowerCase(); break;
        case 'Title Case': v = s.toLowerCase().replace(/\p{L}[\p{L}\p{M}'’]*/gu, w => w[0].toUpperCase() + w.slice(1)); break;
        case 'Sentence case': v = s.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (_, a, b) => a + b.toUpperCase()); break;
        case 'camelCase': v = words.map((w, i) => i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()).join(''); break;
        case 'snake_case': v = words.join('_').toLowerCase(); break;
        case 'kebab-case': v = words.join('-').toLowerCase(); break;
        case 'Reverse': v = Array.from(s).reverse().join(''); break;
        case 'Alternating': { let i = 0; v = Array.from(s).map(c => /\p{L}/u.test(c) ? (i++ % 2 ? c.toLowerCase() : c.toUpperCase()) : c).join(''); break; }
        case 'Wide': v = Array.from(s).map(c => c === ' ' ? '\u3000' : c.charCodeAt(0) >= 33 && c.charCodeAt(0) <= 126 ? String.fromCharCode(c.charCodeAt(0) + 65248) : c).join(''); break;
        case 'Bubble': v = Array.from(s).map(c => /[a-z]/.test(c) ? String.fromCodePoint(0x24d0 + c.charCodeAt(0) - 97) : /[A-Z]/.test(c) ? String.fromCodePoint(0x24b6 + c.charCodeAt(0) - 65) : c).join(''); break;
        case 'Upside down': { const a = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!?', b = 'ɐqɔpǝɟƃɥıɾʞlɯuodbɹsʇnʌʍxʎz∀𐐒ƆᗡƎℲ⅁HIſʞ˥WNOԀΌᴚS⊥∩ΛMX⅄Z¡¿'; const map = Array.from(b); v = Array.from(s).reverse().map(c => a.includes(c) ? map[a.indexOf(c)] || c : c).join(''); break; }
        default: v = Array.from(s).map(c => /\S/.test(c) ? c + '\u0307\u0323' : c).join('');
      }
      out.value = v;
    }
    src.addEventListener('input', update);
    ctx.form.append(modeTabs.el, gEl('div', { class: 'two-col' }, gameField('Input Text', src), gameField('Result', out)), gEl('div', { class: 'gtabs' }, gameBtn('📋 Copy Result', 'primary', () => copyToClipboard(out.value)), gameBtn('↓ Download .txt', 'chip', () => download(out.value, 'text.txt'))));
    update();
    return;
  }

  if (id === 'word-counter') {
    const src = area('Sir Waffle baked 12 warm waffles in the cozy kitchen!\nCount words, characters, and reading time.', 7);
    const stW = statBox('Words', '0', 'peach'), stC = statBox('Characters', '0', 'cream'), stB = statBox('UTF-8 Bytes', '0', 'cream'), stL = statBox('Lines / Read', '0', 'cream');
    const update = () => {
      const s = src.value;
      const words = typeof Intl.Segmenter === 'function' ? [...new Intl.Segmenter(undefined, { granularity: 'word' }).segment(s)].filter(x => x.isWordLike).length : (s.match(/[\p{L}\p{N}]+/gu) || []).length;
      stW.set(words); stC.set(Array.from(s).length); stB.set(new TextEncoder().encode(s).length); stL.set(`${s ? s.split(/\r\n|\r|\n/).length : 0} lines · ${Math.ceil(words / 200)}m`);
    };
    src.addEventListener('input', update);
    ctx.form.append(gameField('Your Text', src), gEl('div', { class: 'stat-grid' }, stW.el, stC.el, stB.el, stL.el));
    update();
    return;
  }

  if (id === 'json-formatter') {
    const src = area('{"kitchen":"cozy","waffles":12,"ready":true}', 7), out = area('', 7); out.readOnly = true;
    const indent = gameTabs([['2', '2 Spaces'], ['4', '4 Spaces'], ['Tab', 'Tab']], '2', null, 'Indent');
    const fmt = min => ctx.run(() => { const d = JSON.parse(src.value); out.value = JSON.stringify(d, null, min ? 0 : indent.value === 'Tab' ? '\t' : Number(indent.value)); ctx.say('Valid JSON!'); });
    ctx.form.append(indent.el, gEl('div', { class: 'two-col' }, gameField('Input JSON', src), gameField('Formatted', out)), gEl('div', { class: 'gtabs' }, gameBtn('✨ Format', 'primary', fmt(false)), gameBtn('⚡ Minify', '', fmt(true)), gameBtn('↓ Download .json', 'chip', () => download(out.value, 'formatted.json'))));
    return;
  }

  if (id === 'base64' || id === 'url-codec') {
    const src = area('Hello, cozy kitchen!', 5), out = area('', 5); out.readOnly = true;
    const mode = gameTabs(id === 'base64' ? [['Standard', 'Standard Base64'], ['URL-safe', 'URL-safe Base64']] : [['URL component', 'Component'], ['Whole URI', 'Whole URI']], id === 'base64' ? 'Standard' : 'URL component', null, 'Mode');
    const act = encode => ctx.run(() => {
      const s = src.value;
      if (id === 'base64') {
        if (encode) {
          const bytes = new TextEncoder().encode(s); let bin = '';
          for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
          let v = btoa(bin);
          out.value = mode.value === 'URL-safe' ? v.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : v;
        } else {
          let v = s.replace(/\s/g, '');
          if (mode.value === 'URL-safe') v = v.replace(/-/g, '+').replace(/_/g, '/');
          out.value = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(v), c => c.charCodeAt(0)));
        }
      } else out.value = mode.value === 'Whole URI' ? (encode ? encodeURI(s) : decodeURI(s)) : (encode ? encodeURIComponent(s) : decodeURIComponent(s));
      ctx.say('Done!');
    });
    ctx.form.append(mode.el, gEl('div', { class: 'two-col' }, gameField('Input', src), gameField('Output', out)), gEl('div', { class: 'gtabs' }, gameBtn('Encode →', 'primary', act(true)), gameBtn('← Decode', '', act(false))));
    return;
  }

  if (id === 'markdown-preview') {
    const src = area('# Cozy Markdown\n\n**Bold**, *italic*, and `inline code`.\n\n- Warm waffles\n- Direct 2.5D preview', 9);
    const preview = gEl('div', { class: 'pastel-card cream md-live-preview', style: { minHeight: '260px', padding: '14px', overflow: 'auto' } });
    const update = () => { preview.innerHTML = markdown(src.value); };
    src.addEventListener('input', update);
    ctx.form.append(gEl('div', { class: 'two-col' }, gameField('Markdown', src), preview), gameBtn('↓ Download HTML', 'primary', () => download(secureDocument(markdown(src.value)), 'preview.html', 'text/html')));
    update();
    return;
  }

  if (id === 'text-diff') {
    const a = area('First line\nOriginal waffle recipe\nThird line', 6), b = area('First line\nCozy waffle recipe!\nThird line\nBonus syrup!', 6);
    const out = gEl('pre', { class: 'output diff-tray' });
    const compare = ctx.run(() => {
      const x = a.value.split('\n'), y = b.value.split('\n');
      const dp = Array.from({ length: x.length + 1 }, () => new Uint32Array(y.length + 1));
      for (let i = x.length - 1; i >= 0; i--) for (let j = y.length - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      const lines = []; let i = 0, j = 0, added = 0, removed = 0;
      while (i < x.length || j < y.length) {
        if (i < x.length && j < y.length && x[i] === y[j]) { lines.push(gEl('span', { class: 'diff-eq', text: '  ' + x[i++] + '\n' })); j++; }
        else if (j < y.length && (i === x.length || dp[i][j + 1] >= dp[i + 1][j])) { lines.push(gEl('span', { class: 'diff-add', text: '+ ' + y[j++] + '\n' })); added++; }
        else { lines.push(gEl('span', { class: 'diff-del', text: '- ' + x[i++] + '\n' })); removed++; }
      }
      out.replaceChildren(...lines);
      ctx.say(`+${added} added · −${removed} removed`);
    });
    ctx.form.append(gEl('div', { class: 'two-col' }, gameField('Original', a), gameField('Changed', b)), gameBtn('🔍 Compare Lines', 'primary', compare), out);
    compare();
    return;
  }

  if (id === 'find-replace') {
    const src = area('Waffles are great. Waffles are warm!', 5), out = area('', 5); out.readOnly = true;
    const findIn = textInput('Waffles'), repIn = textInput('Pancakes');
    const rxTog = gameToggle('Regex', false), csTog = gameToggle('Case Sensitive', true), allTog = gameToggle('Replace All', true);
    ctx.form.append(
      gEl('div', { class: 'two-col' }, gameField('Find', findIn), gameField('Replace With', repIn)),
      gEl('div', { class: 'gtabs' }, rxTog.el, csTog.el, allTog.el),
      gEl('div', { class: 'two-col' }, gameField('Input', src), gameField('Output', out)),
      gameBtn('🪄 Replace', 'primary', ctx.run(() => {
        if (!findIn.value) throw new Error('Enter text to find.');
        const escRx = findIn.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(rxTog.checked ? findIn.value : escRx, (allTog.checked ? 'g' : '') + (csTog.checked ? '' : 'i'));
        let count = 0;
        out.value = src.value.replace(re, () => { count++; return repIn.value; });
        ctx.say(`${count} replacements made.`);
      }))
    );
    return;
  }

  if (id === 'lorem-ipsum') {
    const countSl = gameSlider({ label: 'Amount', min: 1, max: 20, step: 1, value: 3, color: '#f7c46c' });
    const kind = gameTabs([['Paragraphs', 'Paragraphs'], ['Sentences', 'Sentences'], ['Words', 'Words']], 'Paragraphs', null, 'Unit');
    const out = area('', 8); out.readOnly = true;
    const words = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco'.split(' ');
    const gen = () => {
      playSparkle();
      const n = countSl.num; let idx = 0;
      const sent = () => { const w = Array.from({ length: 10 }, () => words[idx++ % words.length]).join(' '); return w[0].toUpperCase() + w.slice(1) + '.'; };
      out.value = kind.value === 'Words' ? Array.from({ length: n }, () => words[idx++ % words.length]).join(' ') : Array.from({ length: n }, () => kind.value === 'Sentences' ? sent() : Array.from({ length: 4 }, sent).join(' ')).join(kind.value === 'Paragraphs' ? '\n\n' : ' ');
    };
    ctx.form.append(kind.el, countSl.el, gEl('div', { class: 'gtabs' }, gameBtn('✨ Generate', 'primary', gen), gameBtn('📋 Copy', 'chip', () => copyToClipboard(out.value))), out);
    gen();
    return;
  }

  if (id === 'hash-generator') {
    const src = area('Cozy Kitchen', 4), out = area('', 3); out.readOnly = true;
    let picked = null;
    const filePill = gameFilePill('Or Hash a Local File', '', false, fs => { picked = fs[0] || null; });
    const algo = gameTabs(['SHA-256', 'SHA-384', 'SHA-512', 'SHA-1'], 'SHA-256', null, 'Algorithm');
    ctx.form.append(
      gameField('Text Input', src), filePill.el, algo.el,
      gameBtn('🔐 Compute Hash', 'primary', ctx.run(async () => {
        const data = picked ? await picked.arrayBuffer() : new TextEncoder().encode(src.value);
        out.value = Array.from(new Uint8Array(await crypto.subtle.digest(algo.value, data)), b => b.toString(16).padStart(2, '0')).join('');
        ctx.say('Digest calculated locally.');
      })),
      gameField('Hex Digest', out)
    );
    return;
  }

  if (id === 'csv-editor') {
    const src = area('Item,Qty\nWaffles,12\nSyrup,4', 5);
    const delim = gameTabs([[',', 'CSV (,)'], ['\t', 'TSV (Tab)']], ',', null, 'Format');
    const tableWrap = gEl('div', { class: 'pastel-card cream', style: { overflowX: 'auto' } });
    let data = [];
    const draw = () => {
      const t = gEl('table', { class: 'gtable' });
      data.forEach((r, i) => {
        const tr = gEl('tr');
        r.forEach((v, j) => {
          const cell = textInput(v);
          cell.addEventListener('input', () => { data[i][j] = cell.value; });
          tr.append(gEl('td', {}, gEl('div', { class: 'gfield-tray' }, cell)));
        });
        tr.append(gEl('td', {}, gameBtn('✕', 'danger', () => { data.splice(i, 1); draw(); })));
        t.append(tr);
      });
      tableWrap.replaceChildren(t);
    };
    const parse = () => {
      const rows = parseDelimited(src.value, delim.value), cols = Math.max(1, ...rows.map(r => r.length));
      data = rows.map(r => Array.from({ length: cols }, (_, i) => r[i] || ''));
      draw();
    };
    const filePill = gameFilePill('Import CSV/TSV', '.csv,.tsv', false, ctx.run(async fs => { if (!fs[0]) return; src.value = await readText(fs[0]); if (/\.tsv$/i.test(fs[0].name)) delim.value = '\t'; parse(); }));
    ctx.form.append(filePill.el, delim.el, gameField('Raw CSV / TSV', src), gEl('div', { class: 'gtabs' }, gameBtn('Load Grid', 'primary', ctx.run(parse)), gameBtn('+ Row', '', () => { data.push(Array(data[0]?.length || 1).fill('')); draw(); }), gameBtn('+ Col', '', () => { data.forEach(r => r.push('')); draw(); }), gameBtn('↓ Download', 'chip', () => download(delimited(data, delim.value), delim.value === ',' ? 'table.csv' : 'table.tsv'))), tableWrap);
    parse();
    return;
  }

  if (id === 'notepad') {
    const key = 'bitesized-notepad-v1', src = area('', 12);
    const autoTog = gameToggle('Autosave Locally', false);
    const filePill = gameFilePill('Open .txt / .md', '.txt,.md', false, ctx.run(async fs => { if (fs[0]) { src.value = await readText(fs[0]); ctx.say('File loaded.'); } }));
    const save = ctx.run(() => { localStorage.setItem(key, src.value); ctx.say('Saved in browser!'); });
    let timer;
    src.addEventListener('input', () => { clearTimeout(timer); if (autoTog.checked) timer = setTimeout(() => { if (ctx.alive() && autoTog.checked) save(); }, 500); });
    ctx.form.append(filePill.el, gameField('Cozy Kitchen Notepad', src), autoTog.el, gEl('div', { class: 'gtabs' }, gameBtn('💾 Save', 'primary', save), gameBtn('📂 Load Saved', '', ctx.run(() => { src.value = localStorage.getItem(key) || ''; ctx.say('Loaded.'); })), gameBtn('↓ Download .txt', 'chip', () => download(src.value, 'note.txt'))));
    return;
  }

  if (id === 'file-inspector') {
    const stName = statBox('File Name', '—', 'peach'), stSize = statBox('Size', '—', 'cream'), stType = statBox('MIME', '—', 'cream');
    const out = gEl('pre', { class: 'output code-console-tray' }, 'Pick any file to inspect its first 512 bytes in hex.');
    const filePill = gameFilePill('Pick Any File', '', false, ctx.run(async fs => {
      const f = fs[0]; if (!f) return;
      stName.set(f.name); stSize.set(`${f.size.toLocaleString()} B`); stType.set(f.type || 'unknown');
      const bytes = new Uint8Array(await f.slice(0, 512).arrayBuffer());
      out.textContent = Array.from({ length: Math.ceil(bytes.length / 16) }, (_, i) => {
        const b = bytes.slice(i * 16, i * 16 + 16);
        return (i * 16).toString(16).padStart(8, '0') + '  ' + Array.from(b, n => n.toString(16).padStart(2, '0')).join(' ').padEnd(47) + '  ' + Array.from(b, n => n >= 32 && n < 127 ? String.fromCharCode(n) : '.').join('');
      }).join('\n');
    }));
    ctx.form.append(filePill.el, gEl('div', { class: 'stat-grid' }, stName.el, stSize.el, stType.el), out);
    return;
  }
}

/* ==================== ART & COLORING (15 TOOLS) ==================== */
function hexRGB(hex) { const s = hex.trim().replace(/^#/, ''); if (!/^(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(s)) throw new Error('Enter hex color.'); const v = s.length === 3 ? s.split('').map(c => c + c).join('') : s; return [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16)); }
function rgbHex(rgb) { return '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join(''); }
function rgbHSL([r, g, b]) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2; let h = 0, s = 0; if (d) { s = d / (1 - Math.abs(2 * l - 1)); h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return [h, s * 100, l * 100]; }
function hslRGB(h, s, l) { h = ((h % 360) + 360) % 360; s /= 100; l /= 100; const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2; const v = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return v.map(n => Math.round((n + m) * 255)); }
function luminance(rgb) { const v = rgb.map(n => { n /= 255; return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4; }); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; }
function pointer(c, e) { const b = c.getBoundingClientRect(); return { x: (e.clientX - b.left) * c.width / b.width, y: (e.clientY - b.top) * c.height / b.height }; }

function floodFillCanvas(g, w, h, startX, startY, fillRGBA, tol = 28) {
  const x0 = Math.max(0, Math.min(w - 1, Math.floor(startX)));
  const y0 = Math.max(0, Math.min(h - 1, Math.floor(startY)));
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const idx0 = (y0 * w + x0) * 4;
  const sr = d[idx0], sg = d[idx0 + 1], sb = d[idx0 + 2], sa = d[idx0 + 3];
  const [fr, fg, fb, fa] = fillRGBA;
  if (Math.abs(sr - fr) <= 2 && Math.abs(sg - fg) <= 2 && Math.abs(sb - fb) <= 2 && Math.abs(sa - fa) <= 2) return;
  const match = i => Math.abs(d[i] - sr) <= tol && Math.abs(d[i + 1] - sg) <= tol && Math.abs(d[i + 2] - sb) <= tol && Math.abs(d[i + 3] - sa) <= tol;
  const seen = new Uint8Array(w * h);
  const stack = [x0, y0];
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    let lx = x;
    while (lx >= 0 && !seen[y * w + lx] && match((y * w + lx) * 4)) lx--;
    lx++;
    let spanUp = false, spanDown = false;
    for (let cx = lx; cx < w; cx++) {
      const p = y * w + cx;
      const i = p * 4;
      if (seen[p] || !match(i)) break;
      seen[p] = 1;
      d[i] = fr; d[i + 1] = fg; d[i + 2] = fb; d[i + 3] = fa;
      if (y > 0) {
        const up = !seen[(y - 1) * w + cx] && match(((y - 1) * w + cx) * 4);
        if (!spanUp && up) { stack.push(cx, y - 1); spanUp = true; }
        else if (spanUp && !up) spanUp = false;
      }
      if (y + 1 < h) {
        const dn = !seen[(y + 1) * w + cx] && match(((y + 1) * w + cx) * 4);
        if (!spanDown && dn) { stack.push(cx, y + 1); spanDown = true; }
        else if (spanDown && !dn) spanDown = false;
      }
    }
  }
  g.putImageData(img, 0, 0);
}

function drawStickerStamp(g, kind, x, y, size, color) {
  g.save();
  g.translate(x, y);
  const r = size;
  g.fillStyle = color;
  g.strokeStyle = '#4f2f23';
  g.lineWidth = Math.max(2, r * 0.12);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  if (kind === 'Star') {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const rad = i % 2 === 0 ? r : r * 0.44;
      i === 0 ? g.moveTo(Math.cos(a) * rad, Math.sin(a) * rad) : g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    g.closePath(); g.fill(); g.stroke();
  } else if (kind === 'Heart') {
    g.beginPath();
    g.moveTo(0, r * 0.8);
    g.bezierCurveTo(-r * 1.2, r * 0.05, -r * 0.9, -r * 0.95, 0, -r * 0.35);
    g.bezierCurveTo(r * 0.9, -r * 0.95, r * 1.2, r * 0.05, 0, r * 0.8);
    g.fill(); g.stroke();
  } else if (kind === 'Flower') {
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      g.beginPath();
      g.arc(Math.cos(a) * r * 0.52, Math.sin(a) * r * 0.52, r * 0.42, 0, Math.PI * 2);
      g.fill(); g.stroke();
    }
    g.fillStyle = '#ffe58f';
    g.beginPath(); g.arc(0, 0, r * 0.34, 0, Math.PI * 2); g.fill(); g.stroke();
  } else if (kind === 'Sparkle') {
    g.beginPath();
    g.moveTo(0, -r); g.quadraticCurveTo(0, 0, r, 0);
    g.quadraticCurveTo(0, 0, 0, r); g.quadraticCurveTo(0, 0, -r, 0);
    g.quadraticCurveTo(0, 0, 0, -r);
    g.fill(); g.stroke();
  } else {
    // Waffle stamp!
    const s = r * 1.45;
    g.fillStyle = '#f2be6b';
    g.beginPath();
    g.roundRect?.(-s / 2, -s / 2, s, s, r * 0.32) || g.rect(-s / 2, -s / 2, s, s);
    g.fill(); g.stroke();
    g.fillStyle = '#c78336';
    const step = s / 3.4;
    for (let gx = -1; gx <= 1; gx++) for (let gy = -1; gy <= 1; gy++) {
      g.fillRect(gx * step - step * 0.28, gy * step - step * 0.28, step * 0.56, step * 0.56);
    }
    g.fillStyle = '#ffe58f';
    g.fillRect(-s * 0.16, -s * 0.16, s * 0.32, s * 0.32);
  }
  g.restore();
}

function artStudio(ctx, pixel = false) {
  const c = canvas(pixel ? 512 : 900, pixel ? 512 : 520);
  const g = c.getContext('2d', { willReadFrequently: true });
  const colorPick = gameColorPicker(pixel ? 'Pixel Crayon' : 'Studio Ink & Color', '#e78167');

  const toolOpts = pixel
    ? [['pen', '🖌 Pixel'], ['fill', '🪣 Fill'], ['line', '📏 Line'], ['eraser', '🧽 Eraser']]
    : [
        ['pen', '🖌 Pen'], ['marker', '🖍 Marker'], ['nib', '✒ Nib'],
        ['rainbow', '🌈 Rainbow'], ['spray', '✨ Spray'], ['fill', '🪣 Fill'],
        ['line', '📏 Line'], ['rect', '⬜ Rect'], ['circle', '⭕ Circle'],
        ['star', '⭐ Star'], ['sticker', '🧇 Stamp'], ['eraser', '🧽 Eraser']
      ];
  const toolTabs = gameTabs(toolOpts, 'pen', () => {
    if (!pixel && stickerRow) stickerRow.hidden = toolTabs.value !== 'sticker';
    if (!pixel && shapeRow) shapeRow.hidden = !['rect', 'circle', 'star'].includes(toolTabs.value);
  }, 'Brush & Tool');

  const symTabs = gameTabs(
    pixel ? [['off', 'Off'], ['mx', 'Mirror X'], ['k4', '4-Way']] : [['off', 'Off'], ['mx', 'Mirror X'], ['my', 'Mirror Y'], ['k4', '4-Way Kaleido']],
    'off',
    null,
    'Symmetry'
  );

  const paperBgMap = {
    Cream: { css: '#fff8e8', flat: '#fff8e8' },
    Transparent: { css: 'repeating-conic-gradient(#f5ebd6 0% 25%,#fffdf8 0% 50%) 0 / 24px 24px', flat: '#ffffff' },
    Chalkboard: { css: '#2c211d', flat: '#2c211d' },
    Sky: { css: '#dff0fc', flat: '#dff0fc' },
    DotGrid: { css: 'radial-gradient(#d8bd93 1.8px, #fff9ec 1.8px) 0 / 22px 22px', flat: '#fff9ec' }
  };
  const paperTabs = !pixel
    ? gameTabs([['Cream', '🧈 Warm Cream'], ['Transparent', '🏁 Transparent'], ['Chalkboard', '🖤 Chalkboard'], ['Sky', '☁ Sky'], ['DotGrid', '⠿ Dot Grid']], 'Cream', () => {
        c.style.background = paperBgMap[paperTabs.value].css;
      }, 'Paper Backdrop')
    : null;

  const sizeSl = gameSlider({ label: pixel ? 'Pixel Brush Cells (32×32)' : 'Brush / Stamp Size', min: 1, max: pixel ? 6 : 64, step: 1, value: pixel ? 1 : 12, unit: pixel ? 'cells' : 'px', color: '#e78167' });
  const alphaSl = !pixel ? gameSlider({ label: 'Opacity', min: 10, max: 100, step: 5, value: 100, unit: '%', color: '#7eb7b5' }) : null;
  const fillShapeTog = !pixel ? gameToggle('Filled Shapes', false) : null;
  const gridTog = pixel ? gameToggle('Show 32×32 Grid', true, () => applyPixelBg()) : null;
  const stickerTabs = !pixel ? gameTabs(['Waffle', 'Star', 'Heart', 'Flower', 'Sparkle'], 'Waffle', null, 'Sticker Stamp') : null;

  const shapeRow = !pixel ? gEl('div', { class: 'gtabs', hidden: true }, fillShapeTog.el) : null;
  const stickerRow = !pixel ? gEl('div', { hidden: true }, stickerTabs.el) : null;

  const history = [];
  const redoStack = [];
  let active = false, startPt = null, last = null, pid = null, previewBase = null, rainbowHue = 0;

  const snap = () => {
    history.push(g.getImageData(0, 0, c.width, c.height));
    if (history.length > 20) history.shift();
    redoStack.length = 0;
  };

  function applyPixelBg() {
    if (gridTog?.checked) {
      c.style.background = 'linear-gradient(to right, rgba(79,47,35,.1) 1px, transparent 1px) 0 / 16px 16px, linear-gradient(to bottom, rgba(79,47,35,.1) 1px, transparent 1px) 0 / 16px 16px, repeating-conic-gradient(#f5ebd6 0% 25%,#fffdf8 0% 50%) 0 / 32px 32px';
    } else {
      c.style.background = 'repeating-conic-gradient(#f5ebd6 0% 25%,#fffdf8 0% 50%) 0 / 32px 32px';
    }
  }

  if (pixel) {
    c.style.imageRendering = 'pixelated';
    applyPixelBg();
  } else {
    c.style.background = paperBgMap.Cream.css;
    try {
      const pendingImport = sessionStorage.getItem('waffle-art-import');
      if (pendingImport) {
        sessionStorage.removeItem('waffle-art-import');
        const im = new Image();
        im.onload = () => {
          const sc = Math.min(c.width / im.naturalWidth, c.height / im.naturalHeight);
          const w = im.naturalWidth * sc, h = im.naturalHeight * sc;
          g.drawImage(im, (c.width - w) / 2, (c.height - h) / 2, w, h);
          ctx.say('Loaded Waffle AI image onto Art Studio canvas!');
        };
        im.src = pendingImport;
      }
    } catch {}
  }

  const mirrorPoints = pt => {
    const pts = [pt];
    const mode = symTabs.value;
    if (mode === 'mx' || mode === 'k4') pts.push({ x: c.width - pt.x, y: pt.y });
    if (mode === 'my' || mode === 'k4') pts.push({ x: pt.x, y: c.height - pt.y });
    if (mode === 'k4') pts.push({ x: c.width - pt.x, y: c.height - pt.y });
    return pts;
  };

  const strokeSym = (a, b, drawFn) => {
    const pa = mirrorPoints(a), pb = mirrorPoints(b);
    for (let i = 0; i < pa.length; i++) drawFn(pa[i], pb[i]);
  };

  const paintStroke = (p1, p2) => {
    const mode = toolTabs.value;
    const isErase = mode === 'eraser';
    const sz = sizeSl.num;
    const baseAlpha = alphaSl ? alphaSl.num / 100 : 1;
    let ink = colorPick.value;

    g.save();
    g.globalCompositeOperation = isErase ? 'destination-out' : 'source-over';
    g.globalAlpha = mode === 'marker' ? baseAlpha * 0.42 : baseAlpha;

    if (mode === 'rainbow') {
      rainbowHue = (rainbowHue + 7) % 360;
      ink = `hsl(${rainbowHue}, 88%, 55%)`;
    }

    if (pixel) {
      const cell = 16, n = sz;
      strokeSym(p2, p2, pt => {
        const cx = Math.floor(pt.x / cell) * cell;
        const cy = Math.floor(pt.y / cell) * cell;
        if (isErase) g.clearRect(cx, cy, n * cell, n * cell);
        else { g.fillStyle = ink; g.fillRect(cx, cy, n * cell, n * cell); }
      });
    } else if (mode === 'spray') {
      g.fillStyle = ink;
      const density = Math.max(10, Math.round(sz * 1.1));
      strokeSym(p2, p2, pt => {
        for (let k = 0; k < density; k++) {
          const ang = Math.random() * Math.PI * 2;
          const rad = Math.random() * sz;
          const dotR = Math.max(1, sz * 0.08);
          g.beginPath();
          g.arc(pt.x + Math.cos(ang) * rad, pt.y + Math.sin(ang) * rad, dotR, 0, Math.PI * 2);
          g.fill();
        }
      });
    } else if (mode === 'nib') {
      g.strokeStyle = ink;
      g.fillStyle = ink;
      const steps = Math.max(1, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / 2));
      strokeSym(p1, p2, (a, b) => {
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const x = a.x + (b.x - a.x) * t;
          const y = a.y + (b.y - a.y) * t;
          g.beginPath();
          g.moveTo(x - sz * 0.45, y + sz * 0.22);
          g.lineTo(x + sz * 0.45, y - sz * 0.22);
          g.lineWidth = Math.max(2, sz * 0.22);
          g.stroke();
        }
      });
    } else {
      g.strokeStyle = ink;
      g.fillStyle = ink;
      g.lineWidth = sz;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      strokeSym(p1, p2, (a, b) => {
        if (a.x === b.x && a.y === b.y) {
          g.beginPath(); g.arc(a.x, a.y, sz / 2, 0, Math.PI * 2); g.fill();
        } else {
          g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
        }
      });
    }
    g.restore();
  };

  const drawShapePreview = (a, b) => {
    if (previewBase) g.putImageData(previewBase, 0, 0);
    const mode = toolTabs.value;
    const sz = pixel ? sizeSl.num * 16 : sizeSl.num;
    g.save();
    g.globalAlpha = alphaSl ? alphaSl.num / 100 : 1;
    g.strokeStyle = colorPick.value;
    g.fillStyle = colorPick.value;
    g.lineWidth = pixel ? 16 : Math.max(2, sz * 0.45);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    strokeSym(a, b, (p1, p2) => {
      if (mode === 'line') {
        g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.stroke();
      } else if (mode === 'rect') {
        const rx = Math.min(p1.x, p2.x), ry = Math.min(p1.y, p2.y);
        const rw = Math.abs(p2.x - p1.x), rh = Math.abs(p2.y - p1.y);
        if (fillShapeTog?.checked) g.fillRect(rx, ry, rw, rh);
        else g.strokeRect(rx, ry, rw, rh);
      } else if (mode === 'circle') {
        const r = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        g.beginPath(); g.arc(p1.x, p1.y, r, 0, Math.PI * 2);
        if (fillShapeTog?.checked) g.fill(); else g.stroke();
      } else if (mode === 'star') {
        const r = Math.max(8, Math.hypot(p2.x - p1.x, p2.y - p1.y));
        const rot = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const ang = rot + i * Math.PI / 5;
          const rad = i % 2 === 0 ? r : r * 0.45;
          i === 0 ? g.moveTo(p1.x + Math.cos(ang) * rad, p1.y + Math.sin(ang) * rad)
                  : g.lineTo(p1.x + Math.cos(ang) * rad, p1.y + Math.sin(ang) * rad);
        }
        g.closePath();
        if (fillShapeTog?.checked) g.fill(); else g.stroke();
      }
    });
    g.restore();
  };

  c.addEventListener('pointerdown', e => {
    if (active || e.button !== 0) return;
    e.preventDefault();
    const pt = pointer(c, e);
    const mode = toolTabs.value;
    snap();

    if (mode === 'fill') {
      const rgb = hexRGB(colorPick.value);
      const a = alphaSl ? Math.round(alphaSl.num * 2.55) : 255;
      for (const mpt of mirrorPoints(pt)) {
        floodFillCanvas(g, c.width, c.height, mpt.x, mpt.y, [...rgb, a], pixel ? 8 : 30);
      }
      playPop(640);
      return;
    }

    if (mode === 'sticker') {
      const sz = Math.max(16, sizeSl.num * 1.4);
      for (const mpt of mirrorPoints(pt)) {
        drawStickerStamp(g, stickerTabs.value, mpt.x, mpt.y, sz, colorPick.value);
      }
      playPop(700);
      return;
    }

    active = true;
    pid = e.pointerId;
    startPt = pt;
    last = pt;
    c.setPointerCapture?.(pid);

    if (['line', 'rect', 'circle', 'star'].includes(mode)) {
      previewBase = history[history.length - 1];
      drawShapePreview(startPt, pt);
    } else {
      paintStroke(pt, pt);
    }
  });

  c.addEventListener('pointermove', e => {
    if (!active || e.pointerId !== pid) return;
    e.preventDefault();
    const pt = pointer(c, e);
    const mode = toolTabs.value;
    if (['line', 'rect', 'circle', 'star'].includes(mode)) {
      drawShapePreview(startPt, pt);
    } else {
      paintStroke(last, pt);
      last = pt;
    }
  });

  const end = e => {
    if (e.pointerId === pid) {
      active = false; last = null; startPt = null; pid = null; previewBase = null;
    }
  };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => c.addEventListener(n, end));

  const importImgPill = !pixel
    ? gameFilePill('🖼 Import Photo', 'image/*', false, ctx.run(async fs => {
        if (!fs[0]) return;
        const img = await loadImage(fs[0]);
        snap();
        const sc = Math.min(c.width / img.naturalWidth, c.height / img.naturalHeight);
        const w = img.naturalWidth * sc, h = img.naturalHeight * sc;
        g.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
        ctx.say('Imported onto canvas!');
      }))
    : null;

  const exportWithBackdrop = async (mime, ext) => {
    if (pixel || paperTabs?.value === 'Transparent') {
      download(await blobFromCanvas(c), `${pixel ? 'pixel-art' : 'art-studio'}.png`);
      return;
    }
    const out = canvas(c.width, c.height);
    const og = out.getContext('2d');
    og.fillStyle = paperBgMap[paperTabs.value].flat;
    og.fillRect(0, 0, out.width, out.height);
    og.drawImage(c, 0, 0);
    download(await blobFromCanvas(out, mime), `art-studio.${ext}`);
  };

  ctx.form.append(...[
    toolTabs.el,
    stickerRow,
    shapeRow,
    symTabs.el,
    paperTabs?.el,
    colorPick.el,
    sizeSl.el,
    alphaSl?.el,
    gridTog?.el,
    gEl('div', { class: 'gtabs' }, ...[
      gameBtn('↩ Undo', '', () => {
        const s = history.pop();
        if (s) { redoStack.push(g.getImageData(0, 0, c.width, c.height)); g.putImageData(s, 0, 0); }
      }),
      gameBtn('↪ Redo', '', () => {
        const s = redoStack.pop();
        if (s) { history.push(g.getImageData(0, 0, c.width, c.height)); g.putImageData(s, 0, 0); }
      }),
      importImgPill?.el,
      gameBtn('🗑 Clear', 'danger', () => { snap(); g.clearRect(0, 0, c.width, c.height); }),
      gameBtn('↓ Save PNG', 'primary', ctx.run(() => exportWithBackdrop('image/png', 'png'))),
      !pixel ? gameBtn('↓ Save JPG', 'chip', ctx.run(() => exportWithBackdrop('image/jpeg', 'jpg'))) : null
    ].filter(Boolean)),
    gEl('div', { class: 'graph-bezel' }, c)
  ].filter(Boolean));
}

function colorTools(id, ctx) {
  if (id === 'color-converter') {
    const mode = gameTabs(['HEX', 'RGB', 'HSL'], 'HEX', null, 'Input Format');
    const a = textInput('#e78167');
    const swatch = gEl('div', { class: 'pastel-card', style: { height: '74px' } });
    const stH = statBox('HEX', '#e78167', 'peach'), stR = statBox('RGB', '—', 'cream'), stL = statBox('HSL', '—', 'cream');
    const upd = ctx.run(() => {
      let rgb;
      if (mode.value === 'HEX') rgb = hexRGB(a.value);
      else {
        const vals = a.value.replace(/^(rgb|hsl)\(/i, '').replace(/\)$/g, '').replace(/%/g, '').split(/[\s,]+/).filter(Boolean).map(Number);
        if (vals.length !== 3) throw new Error('Enter 3 numbers.');
        rgb = mode.value === 'RGB' ? vals.map(Math.round) : hslRGB(...vals);
      }
      const hex = rgbHex(rgb), hsl = rgbHSL(rgb);
      swatch.style.background = hex;
      stH.set(hex); stR.set(`rgb(${rgb.join(', ')})`); stL.set(`hsl(${hsl[0].toFixed(0)}°, ${hsl[1].toFixed(0)}%, ${hsl[2].toFixed(0)}%)`);
    });
    ctx.form.append(mode.el, gameField('Color Value', a), gameBtn('Convert', 'primary', upd), swatch, gEl('div', { class: 'stat-grid' }, stH.el, stR.el, stL.el));
    upd();
    return;
  }
  if (id === 'contrast-checker') {
    const fg = gameColorPicker('Text Color', '#4f2f23', () => upd()), bg = gameColorPicker('Background Color', '#fff9ec', () => upd());
    const sample = gEl('div', { class: 'pastel-card', text: 'Cozy Kitchen Readability Preview — Aa Bb Cc 123', style: { padding: '24px', fontSize: '22px', textAlign: 'center' } });
    const stRatio = statBox('Contrast Ratio', '—', 'peach'), stAA = statBox('WCAG AA', '—', 'cream'), stAAA = statBox('WCAG AAA', '—', 'cream');
    function upd() {
      const l1 = luminance(hexRGB(fg.value)), l2 = luminance(hexRGB(bg.value)), ratio = (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
      sample.style.color = fg.value; sample.style.background = bg.value;
      stRatio.set(`${ratio.toFixed(2)}:1`); stAA.set(ratio >= 4.5 ? '✅ PASS' : '❌ FAIL'); stAAA.set(ratio >= 7 ? '✅ PASS' : '❌ FAIL');
    }
    ctx.form.append(gEl('div', { class: 'two-col' }, fg.el, bg.el), sample, gEl('div', { class: 'stat-grid' }, stRatio.el, stAA.el, stAAA.el));
    upd();
    return;
  }
  if (id === 'color-picker') {
    const pick = gameColorPicker('Picked Color', '#e78167', () => upd());
    const c = canvas(600, 320), g = c.getContext('2d', { willReadFrequently: true });
    const stHex = statBox('HEX', '#e78167', 'peach'), stRgb = statBox('RGB', '—', 'cream');
    const filePill = gameFilePill('Sample Image', 'image/*', false, ctx.run(async fs => {
      if (!fs[0]) return;
      const img = await loadImage(fs[0]);
      c.width = Math.min(720, img.naturalWidth); c.height = Math.max(1, Math.round(c.width * img.naturalHeight / img.naturalWidth));
      g.drawImage(img, 0, 0, c.width, c.height);
    }));
    const upd = () => { const rgb = hexRGB(pick.value); stHex.set(pick.value); stRgb.set(`rgb(${rgb.join(', ')})`); };
    c.addEventListener('click', e => {
      const p = pointer(c, e), rgba = g.getImageData(Math.min(c.width - 1, Math.max(0, Math.floor(p.x))), Math.min(c.height - 1, Math.max(0, Math.floor(p.y))), 1, 1).data;
      pick.value = rgbHex([...rgba].slice(0, 3)); upd(); playPop(640);
    });
    ctx.form.append(pick.el, filePill.el, gEl('div', { class: 'graph-bezel' }, c), gEl('div', { class: 'stat-grid' }, stHex.el, stRgb.el));
    upd();
    return;
  }
  if (id === 'palette-generator') {
    const base = gameColorPicker('Base Color', '#e78167', () => upd());
    const mode = gameTabs(['Analogous', 'Complementary', 'Triadic', 'Monochromatic'], 'Analogous', () => upd(), 'Harmony');
    const swatches = gEl('div', { class: 'token-swatch-shelf' });
    let colors = [];
    function upd() {
      const [h, s, l] = rgbHSL(hexRGB(base.value));
      colors = Array.from({ length: 5 }, (_, i) => rgbHex(hslRGB(h + (mode.value === 'Analogous' ? (i - 2) * 25 : mode.value === 'Complementary' ? (i % 2) * 180 : mode.value === 'Triadic' ? (i % 3) * 120 : 0), mode.value === 'Monochromatic' ? s : Math.max(20, s - (i % 2) * 12), mode.value === 'Monochromatic' ? 18 + i * 16 : Math.max(12, Math.min(88, l + (i - 2) * 8)))));
      swatches.replaceChildren(...colors.map(hex => gameBtn(hex, '', () => copyToClipboard(hex))));
      [...swatches.children].forEach((b, i) => { b.style.background = colors[i]; b.style.color = luminance(hexRGB(colors[i])) > .179 ? '#222' : '#fff'; });
    }
    ctx.form.append(base.el, mode.el, gEl('div', { class: 'gtabs' }, gameBtn('🎲 Random Base', 'primary', () => { base.value = rgbHex([...crypto.getRandomValues(new Uint8Array(3))]); upd(); }), gameBtn('↓ Export JSON', 'chip', () => download(JSON.stringify(colors, null, 2), 'palette.json', 'application/json'))), swatches);
    upd();
    return;
  }
  if (id === 'gradient-maker') {
    const a = gameColorPicker('Start Color', '#e78167', () => upd()), b = gameColorPicker('End Color', '#ffe17d', () => upd());
    const angSl = gameSlider({ label: 'Angle', min: 0, max: 360, step: 5, value: 90, unit: '°', color: '#f7c46c', onChange: () => upd() });
    const kind = gameTabs(['Linear', 'Radial'], 'Linear', () => upd(), 'Type');
    const c = canvas(760, 320), code = area('', 2); code.readOnly = true;
    function upd() {
      const g = c.getContext('2d'), deg = angSl.num;
      let grad;
      if (kind.value === 'Linear') { const r = deg * Math.PI / 180, dx = Math.sin(r), dy = -Math.cos(r), ex = (Math.abs(c.width * dx) + Math.abs(c.height * dy)) / 2; grad = g.createLinearGradient(c.width / 2 - dx * ex, c.height / 2 - dy * ex, c.width / 2 + dx * ex, c.height / 2 + dy * ex); }
      else grad = g.createRadialGradient(380, 160, 0, 380, 160, 420);
      grad.addColorStop(0, a.value); grad.addColorStop(1, b.value); g.fillStyle = grad; g.fillRect(0, 0, 760, 320);
      code.value = `background: ${kind.value === 'Linear' ? `linear-gradient(${deg}deg, ${a.value}, ${b.value})` : `radial-gradient(circle, ${a.value}, ${b.value})`};`;
    }
    ctx.form.append(gEl('div', { class: 'two-col' }, a.el, b.el), kind.el, angSl.el, gEl('div', { class: 'graph-bezel' }, c), gameField('CSS Code', code), gameBtn('↓ Save PNG', 'primary', ctx.run(async () => download(await blobFromCanvas(c), 'gradient.png'))));
    upd();
  }
}

function imageTools(id, ctx) {
  const c = canvas(720, 400), g = c.getContext('2d'); let img = null;
  const ready = () => { if (!img) throw new Error('Pick an image first.'); };
  const ctrlBox = gEl('div', { class: 'pastel-card cream' });
  let onImg = () => {};
  const filePill = gameFilePill('Pick Raster Image', 'image/*', false, ctx.run(async fs => {
    if (!fs[0]) return;
    img = await loadImage(fs[0]);
    onImg();
  }));
  if (id === 'image-resizer') {
    const wIn = numInput(800, 1, 8192), hIn = numInput(450, 1, 8192), lockTog = gameToggle('Lock Aspect', true), smoothTog = gameToggle('Smooth Pixels', true);
    wIn.addEventListener('input', () => { if (lockTog.checked && img && Number(wIn.value) > 0) hIn.value = Math.max(1, Math.round(Number(wIn.value) * img.naturalHeight / img.naturalWidth)); });
    const render = () => { ready(); const w = integer(wIn, 1, 8192, 'Width'), h = integer(hIn, 1, 8192, 'Height'); c.width = w; c.height = h; g.imageSmoothingEnabled = smoothTog.checked; g.drawImage(img, 0, 0, w, h); ctx.say(`Resized to ${w} × ${h}`); };
    onImg = () => { wIn.value = img.naturalWidth; hIn.value = img.naturalHeight; render(); };
    ctrlBox.append(gEl('div', { class: 'two-col' }, gameField('Width', wIn), gameField('Height', hIn)), gEl('div', { class: 'gtabs' }, lockTog.el, smoothTog.el, gameBtn('Apply Resize', 'primary', ctx.run(render))));
  } else if (id === 'image-cropper') {
    const xIn = numInput(0, 0, 8192), yIn = numInput(0, 0, 8192), wIn = numInput(400, 1, 8192), hIn = numInput(300, 1, 8192);
    const render = () => { ready(); const x = integer(xIn, 0, img.naturalWidth - 1, 'X'), y = integer(yIn, 0, img.naturalHeight - 1, 'Y'), w = integer(wIn, 1, img.naturalWidth - x, 'W'), h = integer(hIn, 1, img.naturalHeight - y, 'H'); c.width = w; c.height = h; g.drawImage(img, x, y, w, h, 0, 0, w, h); ctx.say(`Cropped ${w} × ${h}`); };
    onImg = () => { xIn.value = yIn.value = 0; wIn.value = img.naturalWidth; hIn.value = img.naturalHeight; render(); };
    ctrlBox.append(gEl('div', { class: 'two-col' }, gameField('X', xIn), gameField('Y', yIn), gameField('Crop Width', wIn), gameField('Crop Height', hIn)), gameBtn('✂ Crop Image', 'primary', ctx.run(render)));
  } else {
    const eff = gameTabs(['None', 'Grayscale', 'Sepia', 'Invert', 'Blur', 'Brightness', 'Contrast', 'Saturate', 'Hue rotate'], 'Grayscale', () => { if (img) render(); }, 'Filter Effect');
    const amtSl = gameSlider({ label: 'Intensity', min: 0, max: 200, step: 5, value: 120, unit: '%', color: '#b89ad9', onChange: () => { if (img) render(); } });
    const render = () => { ready(); c.width = img.naturalWidth; c.height = img.naturalHeight; const n = amtSl.num; const f = { None: 'none', Grayscale: `grayscale(${n / 200})`, Sepia: `sepia(${n / 200})`, Invert: `invert(${n / 200})`, Blur: `blur(${n / 10}px)`, Brightness: `brightness(${n}%)`, Contrast: `contrast(${n}%)`, Saturate: `saturate(${n}%)`, 'Hue rotate': `hue-rotate(${n * 1.8}deg)` }[eff.value]; g.clearRect(0, 0, c.width, c.height); g.filter = f; g.drawImage(img, 0, 0); g.filter = 'none'; };
    onImg = render;
    ctrlBox.append(eff.el, amtSl.el);
  }
  ctx.form.append(filePill.el, ctrlBox, gEl('div', { class: 'graph-bezel' }, c), gameBtn('↓ Save PNG', 'primary', ctx.run(async () => { ready(); download(await blobFromCanvas(c), `${id}.png`); })));
}

function svgEditor(ctx) {
  const src = area('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="220" viewBox="0 0 400 220">\n  <rect width="400" height="220" rx="28" fill="#ffe17d" stroke="#4f2f23" stroke-width="8"/>\n  <circle cx="200" cy="110" r="64" fill="#e78167" stroke="#4f2f23" stroke-width="8"/>\n</svg>', 10);
  const preview = gEl('div', { class: 'pastel-card cream', style: { display: 'grid', placeItems: 'center', minHeight: '240px', padding: '12px' } });
  const validate = () => {
    const xml = new DOMParser().parseFromString(src.value, 'image/svg+xml');
    if (xml.querySelector('parsererror') || xml.documentElement.localName !== 'svg') throw new Error('Invalid SVG.');
    xml.querySelectorAll('script,foreignObject').forEach(n => n.remove());
    xml.querySelectorAll('*').forEach(el => {
      for (const a of [...el.attributes]) if (/^on/i.test(a.name)) el.removeAttribute(a.name);
    });
    return xml;
  };
  const render = () => {
    const doc = validate();
    const cleanSvg = new XMLSerializer().serializeToString(doc.documentElement);
    const img = gEl('img', {
      alt: 'SVG preview',
      src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(cleanSvg),
      style: { maxWidth: '100%', maxHeight: '260px', display: 'block', borderRadius: '14px' }
    });
    preview.replaceChildren(img);
  };
  const filePill = gameFilePill('Open .svg', '.svg', false, ctx.run(async fs => { if (fs[0]) { src.value = await readText(fs[0]); render(); } }));
  ctx.form.append(filePill.el, gEl('div', { class: 'two-col' }, gameField('SVG XML', src), preview), gEl('div', { class: 'gtabs' }, gameBtn('✨ Render Preview', 'primary', ctx.run(render)), gameBtn('↓ Save .svg', 'chip', ctx.run(() => { validate(); download(src.value, 'drawing.svg', 'image/svg+xml'); }))));
  render();
}

function patternMaker(ctx) {
  const kind = gameTabs(['Dots', 'Stripes', 'Checkerboard', 'Waves'], 'Dots', () => render(), 'Pattern');
  const fg = gameColorPicker('Foreground', '#e78167', () => render()), bg = gameColorPicker('Background', '#fff9ec', () => render());
  const spSl = gameSlider({ label: 'Spacing', min: 16, max: 140, step: 4, value: 44, unit: 'px', color: '#7ec3d4', onChange: () => render() });
  const szSl = gameSlider({ label: 'Motif Size', min: 2, max: 50, step: 2, value: 12, unit: 'px', color: '#f7c46c', onChange: () => render() });
  const c = canvas(760, 340);
  function render() {
    const step = spSl.num, n = szSl.num, g = c.getContext('2d');
    g.fillStyle = bg.value; g.fillRect(0, 0, c.width, c.height); g.fillStyle = fg.value; g.strokeStyle = fg.value; g.lineWidth = n;
    if (kind.value === 'Dots') { for (let y = step / 2; y < c.height; y += step) for (let x = step / 2; x < c.width; x += step) { g.beginPath(); g.arc(x, y, Math.min(n, step / 2), 0, Math.PI * 2); g.fill(); } }
    else if (kind.value === 'Stripes') { for (let x = 0; x < c.width; x += step) g.fillRect(x, 0, Math.min(n, step), c.height); }
    else if (kind.value === 'Checkerboard') { for (let y = 0; y < c.height; y += step) for (let x = 0; x < c.width; x += step) if ((Math.floor(x / step) + Math.floor(y / step)) % 2 === 0) g.fillRect(x, y, step, step); }
    else { for (let y = -step; y < c.height + step; y += step) { g.beginPath(); for (let x = 0; x <= c.width; x += 4) { const yy = y + Math.sin(x / step * Math.PI * 2) * step / 4; x === 0 ? g.moveTo(x, yy) : g.lineTo(x, yy); } g.stroke(); } }
  }
  ctx.form.append(kind.el, gEl('div', { class: 'two-col' }, fg.el, bg.el), spSl.el, szSl.el, gEl('div', { class: 'graph-bezel' }, c), gameBtn('↓ Save PNG', 'primary', ctx.run(async () => download(await blobFromCanvas(c), 'pattern.png'))));
  render();
}

function collageMaker(ctx) {
  const colsSl = gameSlider({ label: 'Columns', min: 1, max: 6, step: 1, value: 2, color: '#8fc487', onChange: () => { if (images.length) render(); } });
  const gapSl = gameSlider({ label: 'Gap', min: 0, max: 40, step: 2, value: 12, unit: 'px', color: '#f7c46c', onChange: () => { if (images.length) render(); } });
  const fit = gameTabs([['Cover', 'Cover Crop'], ['Contain', 'Contain Fit']], 'Cover', () => { if (images.length) render(); }, 'Fit Mode');
  const bg = gameColorPicker('Frame Background', '#fff9ec', () => { if (images.length) render(); });
  const c = canvas(640, 320); let images = [];
  const render = () => {
    if (!images.length) throw new Error('Choose 1–16 images first.');
    const cols = colsSl.num, s = 260, d = gapSl.num, rows = Math.ceil(images.length / cols), w = cols * s + (cols + 1) * d, h = rows * s + (rows + 1) * d;
    c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = bg.value; g.fillRect(0, 0, w, h);
    images.forEach((img, i) => {
      const x = d + (i % cols) * (s + d), y = d + Math.floor(i / cols) * (s + d);
      const sc = (fit.value === 'Cover' ? Math.max : Math.min)(s / img.naturalWidth, s / img.naturalHeight), iw = img.naturalWidth * sc, ih = img.naturalHeight * sc;
      g.save(); g.beginPath(); g.rect(x, y, s, s); g.clip(); g.drawImage(img, x + (s - iw) / 2, y + (s - ih) / 2, iw, ih); g.restore();
    });
  };
  const filePill = gameFilePill('Pick Multiple Images (max 16)', 'image/*', true, ctx.run(async fs => {
    images = []; for (const f of fs.slice(0, 16)) images.push(await loadImage(f)); render();
  }));
  ctx.form.append(filePill.el, fit.el, colsSl.el, gapSl.el, bg.el, gEl('div', { class: 'graph-bezel' }, c), gameBtn('↓ Save Collage PNG', 'primary', ctx.run(async () => download(await blobFromCanvas(c), 'collage.png'))));
}

function asciiArt(ctx) {
  const wSl = gameSlider({ label: 'Columns', min: 20, max: 160, step: 5, value: 80, color: '#7ec3d4', onChange: () => { if (img) render(); } });
  const ramp = textInput('@%#*+=-:. ');
  const invTog = gameToggle('Invert Shading', false, () => { if (img) render(); });
  const out = area('', 16); out.style.fontFamily = 'monospace'; out.style.whiteSpace = 'pre'; out.readOnly = true;
  let img = null;
  const render = () => {
    if (!img) throw new Error('Choose an image first.');
    const w = wSl.num, h = Math.max(1, Math.round(w * img.naturalHeight / img.naturalWidth * 0.5));
    const chars = Array.from(ramp.value || '@%#*+=-:. ');
    const c = canvas(w, h), g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
    const px = g.getImageData(0, 0, w, h).data, lines = [];
    for (let y = 0; y < h; y++) {
      let line = '';
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        let l = (.2126 * px[i] + .7152 * px[i + 1] + .0722 * px[i + 2]) / 255;
        if (invTog.checked) l = 1 - l;
        line += chars[Math.round(l * (chars.length - 1))];
      }
      lines.push(line);
    }
    out.value = lines.join('\n');
  };
  const filePill = gameFilePill('Pick Image for ASCII Art', 'image/*', false, ctx.run(async fs => { if (fs[0]) { img = await loadImage(fs[0]); render(); } }));
  ctx.form.append(filePill.el, wSl.el, gameField('Character Ramp', ramp), invTog.el, out, gameBtn('↓ Download .txt', 'primary', () => download(out.value, 'ascii-art.txt')));
}

function mandala(ctx) {
  const c = canvas(640, 640), g = c.getContext('2d');
  const col = gameColorPicker('Mandala Ink', '#b89ad9');
  const szSl = gameSlider({ label: 'Brush Thickness', min: 1, max: 20, step: 1, value: 4, unit: 'px', color: '#b89ad9' });
  const symSl = gameSlider({ label: 'Symmetry Petals', min: 4, max: 32, step: 2, value: 12, color: '#f7c46c' });
  const mirTog = gameToggle('Mirror Each Petal', true);
  const history = []; let active = false, last = null, pid = null;
  const snap = () => { history.push(g.getImageData(0, 0, 640, 640)); if (history.length > 10) history.shift(); };
  const seg = (a, b) => {
    const n = symSl.num;
    for (let i = 0; i < n; i++) {
      g.save(); g.translate(320, 320); g.rotate(i * Math.PI * 2 / n);
      const draw = () => { g.beginPath(); g.moveTo(a.x - 320, a.y - 320); g.lineTo(b.x - 320, b.y - 320); g.stroke(); };
      draw(); if (mirTog.checked) { g.scale(1, -1); draw(); }
      g.restore();
    }
  };
  c.style.background = '#fffdf8';
  c.addEventListener('pointerdown', e => { if (active || e.button !== 0) return; snap(); active = true; pid = e.pointerId; c.setPointerCapture?.(pid); last = pointer(c, e); g.strokeStyle = col.value; g.lineWidth = szSl.num; g.lineCap = 'round'; seg(last, { x: last.x + .01, y: last.y }); });
  c.addEventListener('pointermove', e => { if (!active || e.pointerId !== pid) return; const nxt = pointer(c, e); seg(last, nxt); last = nxt; });
  const end = e => { if (e.pointerId === pid) { active = false; last = null; pid = null; } };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => c.addEventListener(n, end));
  ctx.form.append(
    col.el, szSl.el, symSl.el,
    gEl('div', { class: 'gtabs' },
      mirTog.el,
      gameBtn('🌸 Stamp Rosette', '', () => { snap(); g.strokeStyle = col.value; g.lineWidth = szSl.num; const n = symSl.num; for (let i = 0; i < n; i++) { g.save(); g.translate(320, 320); g.rotate(i * Math.PI * 2 / n); g.beginPath(); g.ellipse(0, -125, 44, 120, 0, 0, Math.PI * 2); g.stroke(); g.restore(); } }),
      gameBtn('↩ Undo', 'chip', () => { const s = history.pop(); if (s) g.putImageData(s, 0, 0); }),
      gameBtn('🗑 Clear', 'danger', () => { snap(); g.clearRect(0, 0, 640, 640); }),
      gameBtn('↓ Save PNG', 'primary', ctx.run(async () => download(await blobFromCanvas(c), 'mandala.png')))
    ),
    gEl('div', { class: 'graph-bezel' }, c)
  );
}

export function mountTextArt(id, root) {
  if ((!TEXT_IDS.includes(id) && !ART_IDS.includes(id)) || !root || typeof root.append !== 'function' || typeof root.querySelectorAll !== 'function') return false;
  root.querySelectorAll('.tool-form').forEach(n => n.dispatchEvent(new Event('tool-dispose')));
  root.replaceChildren();
  const ctx = init(root);
  try {
    if (TEXT_IDS.includes(id)) textTools(id, ctx);
    else if (id === 'art-studio' || id === 'pixel-art') artStudio(ctx, id === 'pixel-art');
    else if (['color-picker', 'palette-generator', 'gradient-maker', 'contrast-checker', 'color-converter'].includes(id)) colorTools(id, ctx);
    else if (['image-resizer', 'image-cropper', 'image-filters'].includes(id)) imageTools(id, ctx);
    else if (id === 'svg-editor') svgEditor(ctx);
    else if (id === 'pattern-maker') patternMaker(ctx);
    else if (id === 'collage-maker') collageMaker(ctx);
    else if (id === 'ascii-art') asciiArt(ctx);
    else if (id === 'mandala') mandala(ctx);
  } catch (err) { ctx.say(`Unable to initialize: ${err.message}`); }
  return true;
}
