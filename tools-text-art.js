/* Local-only text and art tools. No network requests or runtime dependencies. */
const TEXT_IDS = ['file-converter','crazy-text-filters','word-counter','case-converter','json-formatter','base64','url-codec','markdown-preview','text-diff','find-replace','lorem-ipsum','hash-generator','csv-editor','notepad','file-inspector'];
const ART_IDS = ['art-studio','color-picker','palette-generator','gradient-maker','pixel-art','image-resizer','image-cropper','image-filters','svg-editor','contrast-checker','color-converter','pattern-maker','collage-maker','ascii-art','mandala'];
const LIMIT = 20 * 1024 * 1024;
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'style') Object.assign(node.style, value);
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  }
  for (const child of children.flat(Infinity)) if (child != null) node.append(child.nodeType ? child : document.createTextNode(String(child)));
  return node;
}
function field(label, control) { return el('label', {class:'field'}, el('span', {text:label}), control); }
function select(items, value) { return el('select', {}, items.map(item => { const [v, label] = Array.isArray(item) ? item : [item,item]; return el('option', {value:v, text:label, selected:v === value}); })); }
function input(type, value, extra = {}) { return el('input', {type, value, ...extra}); }
function area(value = '', rows = 9) { return el('textarea', {value, rows, spellcheck:false}); }
function button(label, fn) { return el('button', {type:'button', class:'action', text:label, onclick:fn}); }
function row(...children) { return el('div', {class:'two-col'}, children); }
function number(control, min, max, label = 'Value') {
  const n = Number(control.value);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${label} must be between ${min} and ${max}.`);
  return n;
}
function integer(control, min, max, label) { const n = number(control,min,max,label); if (!Number.isInteger(n)) throw new Error(`${label || 'Value'} must be a whole number.`); return n; }
function download(data, filename, mime = 'text/plain;charset=utf-8') {
  const blob = data instanceof Blob ? data : new Blob([data], {type:mime});
  const url = URL.createObjectURL(blob), a = el('a', {href:url, download:filename});
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function canvas(w = 800, h = 500) {
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w > 8192 || h > 8192 || w*h > 24000000) throw new Error('Canvas must be 1–8192 pixels per side, at most 24 million pixels.');
  const c = el('canvas', {width:w, height:h, style:{maxWidth:'100%', height:'auto', border:'1px solid #888', touchAction:'none'}});
  c.setAttribute('aria-label','Image canvas'); return c;
}
function blobFromCanvas(c, type = 'image/png', quality = 0.92) { return new Promise((resolve,reject) => {
  try { c.toBlob(b => b && b.type === type ? resolve(b) : reject(new Error(`This browser cannot encode ${type}. No mislabeled file was created.`)), type, quality); }
  catch (error) { reject(error); }
}); }
function sandbox(markup, title = 'Sandboxed preview') { return el('iframe', {sandbox:'', title, srcdoc:markup, referrerPolicy:'no-referrer', style:{width:'100%', minHeight:'300px', border:'1px solid #888'}}); }
function secureDocument(body) { return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'none'; form-action 'none'; base-uri 'none';"><style>body{font:16px system-ui;overflow-wrap:anywhere;padding:12px}pre{white-space:pre-wrap}table{border-collapse:collapse}td,th{border:1px solid;padding:5px}img,svg{max-width:100%}</style></head><body>${body}</body></html>`; }
function escapeHTML(s) { return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function readText(file) { if (!file) throw new Error('Choose a file first.'); if (file.size > LIMIT) throw new Error('Text files are limited to 20 MB.'); return file.text(); }
async function loadImage(file) {
  if (!file) throw new Error('Choose an image first.');
  if (file.size > 40 * 1024 * 1024) throw new Error('Images are limited to 40 MB.');
  // SVG is deliberately excluded: untrusted markup is previewed only in sandboxed frames.
  if (!/^image\/(png|jpeg|webp|gif|bmp|avif)$/i.test(file.type)) throw new Error('Choose a raster PNG, JPEG, WebP, GIF, BMP or AVIF image supported by this browser (not SVG).');
  const url = URL.createObjectURL(file);
  try { const img = new Image(); img.src = url; await img.decode(); if (!img.naturalWidth || img.naturalWidth*img.naturalHeight > 24000000 || img.naturalWidth > 8192 || img.naturalHeight > 8192) throw new Error('Image exceeds the 8192px / 24 megapixel limit.'); return img; }
  catch (e) { throw new Error(`Unable to decode image: ${e.message}`); }
  finally { URL.revokeObjectURL(url); }
}
// RFC 4180-style CSV/TSV parser: quotes, escaped quotes, CRLF and embedded newlines.
function parseDelimited(text, delimiter = ',') {
  text = text.replace(/^\uFEFF/,''); if (!text) return [];
  const rows = []; let r = [], cell = '', quoted = false, closed = false, start = true;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) { if (ch === '"') { if (text[i+1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } } else cell += ch; continue; }
    if (ch === '"' && start) { quoted = true; start = false; continue; }
    if (ch === delimiter || ch === '\n' || ch === '\r') {
      r.push(cell); cell = ''; start = true; closed = false;
      if (ch !== delimiter) { rows.push(r); r = []; if (ch === '\r' && text[i+1] === '\n') i++; }
    } else { if (closed) throw new Error('Unexpected characters after a quoted cell.'); if (ch === '"') throw new Error('Quote inside an unquoted cell.'); cell += ch; start = false; }
  }
  if (quoted) throw new Error('Unterminated quoted cell.');
  if (cell || r.length || !/[\r\n]$/.test(text)) { r.push(cell); rows.push(r); }
  return rows;
}
function delimited(rows, d = ',') { return rows.map(r => r.map(v => { const s = v == null ? '' : String(v); return s.includes(d) || /["\r\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; }).join(d)).join('\r\n'); }
function jsonRows(value) {
  if (!Array.isArray(value)) throw new Error('Tabular conversion needs a JSON array of objects or arrays.');
  if (!value.length) return [];
  if (value.every(Array.isArray)) return value.map(r => r.map(tabularCell));
  if (value.every(x => x && typeof x === 'object' && !Array.isArray(x))) { const keys = [...new Set(value.flatMap(Object.keys))]; return [keys, ...value.map(o => keys.map(k => tabularCell(o[k])))]; }
  throw new Error('Use an array of objects or an array of arrays for CSV/TSV.');
}
function tabularCell(v) { return v != null && typeof v === 'object' ? JSON.stringify(v) : v == null ? '' : String(v); }
function rowsJSON(rows, header) {
  if (!header || !rows.length) return rows;
  const keys = rows[0]; if (new Set(keys).size !== keys.length || keys.some(k => !k)) throw new Error('Headers must be nonempty and unique; turn off the header option to use arrays.');
  if (rows.slice(1).some(r => r.length !== keys.length)) throw new Error('Rows do not all match the header width.');
  return rows.slice(1).map(r => Object.fromEntries(keys.map((k,i) => [k,r[i]])));
}
// Small, intentionally limited Markdown renderer: raw HTML is escaped, never executed.
function markdown(text) {
  let code = false, list = false; const out = [];
  for (const line of text.split(/\r?\n/)) {
    if (/^```/.test(line)) { if (list) { out.push('</ul>'); list = false; } out.push(code ? '</code></pre>' : '<pre><code>'); code = !code; continue; }
    if (code) { out.push(escapeHTML(line)+'\n'); continue; }
    let s = escapeHTML(line).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>');
    // Links deliberately stay plain text; no remote resources or unsafe URL schemes.
    const heading = /^(#{1,6})\s+(.*)$/.exec(s);
    if (/^[-*]\s+/.test(s)) { if (!list) { out.push('<ul>'); list = true; } out.push(`<li>${s.replace(/^[-*]\s+/,'')}</li>`); }
    else { if (list) { out.push('</ul>'); list = false; } out.push(heading ? `<h${heading[1].length}>${heading[2]}</h${heading[1].length}>` : s ? `<p>${s}</p>` : '<br>'); }
  }
  if (list) out.push('</ul>'); if (code) out.push('</code></pre>'); return out.join('\n');
}
function htmlText(text) { const doc = new DOMParser().parseFromString(text,'text/html'); doc.querySelectorAll('script,style,template,iframe,object').forEach(n => n.remove()); doc.querySelectorAll('br').forEach(n => n.replaceWith('\n')); doc.querySelectorAll('p,div,li,h1,h2,h3,h4,tr,section,article').forEach(n => n.append('\n')); return (doc.body.textContent || '').trim(); }
function init(root, title) {
  const form = el('div', {class:'tool-form'}), status = el('div', {class:'output', role:'status','aria-live':'polite'});
  form.append(el('h2', {text:title}), status); root.append(form);
  let alive = true;
  const ctx = {form, status, alive:() => alive && root.contains(form), say:(message) => {status.textContent = message;}, run:fn => async (...args) => { try { await fn(...args); } catch (e) { status.textContent = `Error: ${e.message || e}`; } }};
  form.addEventListener('tool-dispose', () => { alive = false; }); return ctx;
}
function textIO(ctx, initial = '') {
  const source = area(initial), output = area('',10); output.readOnly = true;
  ctx.form.append(row(field('Input',source),field('Output',output)),button('Download output',ctx.run(() => download(output.value,'output.txt'))));
  return {source,output};
}
function fileConverter(ctx) {
  const formats = [['png','PNG image'],['jpeg','JPEG image'],['webp','WebP image'],['json','JSON'],['csv','CSV'],['tsv','TSV'],['txt','Plain text'],['html','HTML'],['md','Markdown']];
  const file = input('file',''), source = area('',8), from = select([['auto','Auto (file extension)'],...formats],'auto'), to = select(formats,'png');
  const header = input('checkbox','', {checked:true}), quality = input('number','0.92',{min:0,max:1,step:0.01}), width = input('number','',{min:1,max:8192,placeholder:'Original'}), height = input('number','',{min:1,max:8192,placeholder:'Original'}), bg = input('color','#ffffff');
  const preview = el('div',{class:'panel'}); let selected, result, resultName = 'converted', rev = 0;
  const invalidate = () => {rev++; result = null; preview.replaceChildren(); ctx.say('Settings changed. Convert to build a new download.');};
  ctx.form.append(el('p',{text:'Real PNG/JPEG/WebP encoding and explicit text conversions only. No PDF, Office or ZIP emulation. Images are rasterized (animations use one frame). Text conversion is UTF-8. HTML → Markdown extracts plain text; Markdown rendering supports headings, lists, emphasis and fenced code, not full CommonMark.'}),
    field('Source file (or paste text below)',file),field('Pasted text (used when no file selected)',source),row(field('Input format',from),field('Output format',to)),row(field('Image width (blank = original)',width),field('Image height (blank = original)',height)),row(field('JPEG/WebP quality (0–1)',quality),field('JPEG background',bg)),field('First CSV/TSV row contains JSON object keys',header), preview);
  file.addEventListener('change',() => {selected = file.files[0]; invalidate();});
  [source,from,to,header,quality,width,height,bg].forEach(n => n.addEventListener('input',invalidate));
  ctx.form.append(button('Convert',ctx.run(async () => {
    const version = ++rev; result = null; preview.replaceChildren(); ctx.say('Converting…');
    let ext = from.value;
    if (ext === 'auto') { if (!selected) throw new Error('Select an input format for pasted text.'); ext = selected.name.split('.').pop().toLowerCase(); if (ext === 'jpg') ext = 'jpeg'; if (ext === 'markdown') ext = 'md'; if (ext === 'htm') ext = 'html'; }
    const target = to.value, imageTypes = ['png','jpeg','webp']; let blob, view;
    if (imageTypes.includes(ext) || imageTypes.includes(target)) {
      if (!imageTypes.includes(ext) || !imageTypes.includes(target)) throw new Error('Image formats can only convert to image formats; text cannot be converted into an image here.');
      if (!selected) throw new Error('Select an image file.');
      // Validate magic bytes as well as MIME; never accept a renamed non-image.
      const bytes = new Uint8Array(await selected.slice(0,16).arrayBuffer());
      const actual = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10 ? 'png' : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'jpeg' : String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP' ? 'webp' : '';
      if (actual !== ext || (selected.type && selected.type !== `image/${actual}`)) throw new Error('The selected format, file signature and declared image type must agree (PNG/JPEG/WebP).');
      const img = await loadImage(selected.type ? selected : new File([selected],selected.name,{type:`image/${actual}`}));
      const w = width.value ? integer(width,1,8192,'Width') : img.naturalWidth, h = height.value ? integer(height,1,8192,'Height') : img.naturalHeight;
      const c = canvas(w,h), g = c.getContext('2d'); if (target === 'jpeg') {g.fillStyle = bg.value; g.fillRect(0,0,w,h);} g.drawImage(img,0,0,w,h);
      blob = await blobFromCanvas(c,`image/${target}`,number(quality,0,1,'Quality')); view = c;
    } else {
      if (!formats.some(([v]) => v === ext)) throw new Error('Unsupported input. Select JSON, CSV, TSV, TXT, HTML or Markdown explicitly.');
      const text = selected ? await readText(selected) : source.value;
      if (text.length > LIMIT) throw new Error('Text is limited to 20 MB.');
      let data, table;
      if (ext === 'json') data = JSON.parse(text);
      if (ext === 'csv' || ext === 'tsv') table = parseDelimited(text,ext === 'csv' ? ',' : '\t');
      let converted;
      if (target === 'json') {
        const value = ext === 'json' ? data : table ? rowsJSON(table,header.checked) : ext === 'html' ? htmlText(text) : text;
        converted = JSON.stringify(value,null,2);
      } else if (target === 'csv' || target === 'tsv') {
        const rows = table || (ext === 'json' ? jsonRows(data) : (ext === 'html' ? htmlText(text) : text).split(/\r?\n/).map(s => [s]));
        converted = delimited(rows,target === 'csv' ? ',' : '\t');
      } else if (target === 'html') {
        if (ext === 'html') converted = text;
        else if (ext === 'md') converted = secureDocument(markdown(text));
        else if (table) converted = secureDocument('<table>'+table.map(r => '<tr>'+r.map(v => '<td>'+escapeHTML(v)+'</td>').join('')+'</tr>').join('')+'</table>');
        else converted = secureDocument('<pre>'+escapeHTML(ext === 'json' ? JSON.stringify(data,null,2) : text)+'</pre>');
      } else if (target === 'md') {
        if (table) { const rows = table.map(r => r.map(v => String(v).replace(/\|/g,'\\|').replace(/\r?\n/g,'<br>'))); converted = rows.length ? [rows[0].join(' | '),rows[0].map(() => '---').join(' | '),...rows.slice(1).map(r => r.join(' | '))].join('\n') : ''; }
        else if (ext === 'json') converted = '```json\n'+JSON.stringify(data,null,2)+'\n```';
        else converted = ext === 'html' ? htmlText(text) : text;
      } else converted = ext === 'html' ? htmlText(text) : ext === 'json' ? JSON.stringify(data,null,2) : table ? delimited(table,'\t') : text;
      const mimes = {json:'application/json',csv:'text/csv',tsv:'text/tab-separated-values',txt:'text/plain',html:'text/html',md:'text/markdown'};
      blob = new Blob([converted],{type:mimes[target]+';charset=utf-8'}); view = area(converted.slice(0,200000),10); view.readOnly = true;
    }
    if (version !== rev || !ctx.alive()) return;
    result = blob; resultName = (selected ? selected.name.replace(/\.[^.]+$/,'') : 'converted')+'.'+(target === 'jpeg' ? 'jpg' : target);
    preview.replaceChildren(view); ctx.say(`Ready: ${resultName} (${blob.size.toLocaleString()} bytes).${blob.size > 200000 && !imageTypes.includes(target) ? ' Preview truncated; download is complete.' : ''}`);
  })),button('Download converted file',ctx.run(() => { if (!result) throw new Error('Convert successfully first.'); download(result,resultName); })));
}
function textTools(id, ctx) {
  if (id === 'file-converter') return fileConverter(ctx);
  if (id === 'crazy-text-filters' || id === 'case-converter') {
    const {source,output} = textIO(ctx,'Hello, local world!');
    const modes = id === 'case-converter' ? ['UPPERCASE','lowercase','Title Case','Sentence case','camelCase','snake_case','kebab-case'] : ['Reverse','Alternating','Wide','Bubble','Upside down','Zalgo (light)']; const mode = select(modes,modes[0]);
    const update = () => { const s = source.value, words = s.match(/[\p{L}\p{N}]+/gu) || []; let v;
      switch (mode.value) {
        case 'UPPERCASE': v = s.toUpperCase(); break; case 'lowercase': v = s.toLowerCase(); break;
        case 'Title Case': v = s.toLowerCase().replace(/\p{L}[\p{L}\p{M}'’]*/gu,w => w[0].toUpperCase()+w.slice(1)); break;
        case 'Sentence case': v = s.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu,(_,a,b) => a+b.toUpperCase()); break;
        case 'camelCase': v = words.map((w,i) => i ? w[0].toUpperCase()+w.slice(1).toLowerCase() : w.toLowerCase()).join(''); break;
        case 'snake_case': case 'kebab-case': v = words.join(mode.value === 'snake_case' ? '_' : '-').toLowerCase(); break;
        case 'Reverse': v = Array.from(s).reverse().join(''); break;
        case 'Alternating': { let i=0; v = Array.from(s).map(c => /\p{L}/u.test(c) ? (i++%2 ? c.toLowerCase() : c.toUpperCase()) : c).join(''); break; }
        case 'Wide': v = Array.from(s).map(c => c === ' ' ? '\u3000' : c.charCodeAt(0)>=33 && c.charCodeAt(0)<=126 ? String.fromCharCode(c.charCodeAt(0)+65248) : c).join(''); break;
        case 'Bubble': v = Array.from(s).map(c => /[a-z]/.test(c) ? String.fromCodePoint(0x24d0+c.charCodeAt(0)-97) : /[A-Z]/.test(c) ? String.fromCodePoint(0x24b6+c.charCodeAt(0)-65) : c).join(''); break;
        case 'Upside down': { const a='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!?', b='ɐqɔpǝɟƃɥıɾʞlɯuodbɹsʇnʌʍxʎz∀𐐒ƆᗡƎℲ⅁HIſʞ˥WNOԀΌᴚS⊥∩ΛMX⅄Z¡¿'; const map = Array.from(b); v = Array.from(s).reverse().map(c => a.includes(c) ? map[a.indexOf(c)] || c : c).join(''); break; }
        default: v = Array.from(s).map(c => /\S/.test(c) ? c+'\u0307\u0323' : c).join('');
      } output.value = v;
    }; ctx.form.append(field('Transformation',mode)); source.addEventListener('input',update); mode.addEventListener('change',update); update(); return;
  }
  if (id === 'word-counter') {
    const source = area(''), stats = el('pre',{class:'output'}); ctx.form.append(field('Text',source),stats);
    const update = () => { const s = source.value; const words = typeof Intl.Segmenter === 'function' ? [...new Intl.Segmenter(undefined,{granularity:'word'}).segment(s)].filter(x => x.isWordLike).length : (s.match(/[\p{L}\p{N}]+/gu)||[]).length;
      stats.textContent = `Words: ${words}\nCharacters (Unicode code points): ${Array.from(s).length}\nCharacters without whitespace: ${Array.from(s.replace(/\s/g,'')).length}\nUTF-8 bytes: ${new TextEncoder().encode(s).length}\nLines: ${s ? s.split(/\r\n|\r|\n/).length : 0}\nParagraphs: ${s.trim() ? s.trim().split(/\n\s*\n/).length : 0}\nEstimated reading time (200 words/min): ${Math.ceil(words/200)} min`; }; source.addEventListener('input',update); update(); return;
  }
  if (id === 'json-formatter') {
    const {source,output} = textIO(ctx,'{"hello":"world"}'), indent = select(['2','4','Tab'],'2');
    const format = min => ctx.run(() => { const data = JSON.parse(source.value); output.value = JSON.stringify(data,null,min ? 0 : indent.value === 'Tab' ? '\t' : Number(indent.value)); ctx.say('Valid JSON.'); });
    ctx.form.append(field('Indent',indent),button('Format / validate',format(false)),button('Minify',format(true))); return;
  }
  if (id === 'base64' || id === 'url-codec') {
    const {source,output} = textIO(ctx), mode = select(id === 'base64' ? ['Standard','URL-safe'] : ['URL component','Whole URI'],'Standard');
    const act = encode => ctx.run(() => {
      const s = source.value; if (s.length > LIMIT) throw new Error('Input exceeds 20 MB.');
      if (id === 'base64') {
        if (encode) { const bytes = new TextEncoder().encode(s); let binary=''; for (let i=0;i<bytes.length;i+=8192) binary += String.fromCharCode(...bytes.subarray(i,i+8192)); let value = btoa(binary); output.value = mode.value === 'URL-safe' ? value.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'') : value; }
        else { let value = s.replace(/\s/g,''); if (mode.value === 'URL-safe') { if (/[^A-Za-z0-9_\-=]/.test(value)) throw new Error('Invalid URL-safe Base64.'); value=value.replace(/-/g,'+').replace(/_/g,'/'); }
          if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.replace(/=+$/,'').length%4 === 1 || (value.includes('=') && value.length%4)) throw new Error('Invalid Base64 padding or alphabet.');
          const binary=atob(value), bytes=Uint8Array.from(binary,c=>c.charCodeAt(0)); output.value = new TextDecoder('utf-8',{fatal:true}).decode(bytes);
        }
      } else output.value = mode.value === 'Whole URI' ? (encode ? encodeURI(s) : decodeURI(s)) : (encode ? encodeURIComponent(s) : decodeURIComponent(s));
      ctx.say('Done. Base64 is encoding, not encryption.');
    }); ctx.form.append(field('Mode',mode),button('Encode',act(true)),button('Decode',act(false))); return;
  }
  if (id === 'markdown-preview') {
    const source=area('# Local Markdown\n\n**Bold**, *italic*, and `code`.\n\n- Safe previews\n- No remote assets'), preview=el('div',{class:'panel'}); const update=()=>preview.replaceChildren(sandbox(secureDocument(markdown(source.value)),'Markdown preview'));
    ctx.form.append(el('p',{text:'Basic Markdown: headings, lists, emphasis and fenced code. Raw HTML is escaped; links remain text.'}),row(field('Markdown',source),preview),button('Download HTML',()=>download(secureDocument(markdown(source.value)),'preview.html','text/html'))); source.addEventListener('input',update); update(); return;
  }
  if (id === 'text-diff') {
    const a=area('First line\nOriginal line'), b=area('First line\nChanged line'), out=el('pre',{class:'output',style:{whiteSpace:'pre-wrap'}});
    ctx.form.append(row(field('Original',a),field('Changed',b)),button('Compare lines',ctx.run(()=>{
      const x=a.value.split('\n'), y=b.value.split('\n'); if (x.length*y.length > 1000000) throw new Error('Comparison limited to one million line pairs. Split larger documents.');
      const dp=Array.from({length:x.length+1},()=>new Uint32Array(y.length+1));
      for(let i=x.length-1;i>=0;i--) for(let j=y.length-1;j>=0;j--) dp[i][j]=x[i]===y[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
      const lines=[]; let i=0,j=0,added=0,removed=0;
      while(i<x.length || j<y.length) { if(i<x.length && j<y.length && x[i]===y[j]) lines.push(el('span',{text:'  '+x[i++]+'\n'})),j++; else if(j<y.length && (i===x.length || dp[i][j+1]>=dp[i+1][j])) lines.push(el('ins',{text:'+ '+y[j++]+'\n'})),added++; else lines.push(el('del',{text:'- '+x[i++]+'\n'})),removed++; }
      out.replaceChildren(...lines); ctx.say(`${added} added, ${removed} removed lines.`);
    })),out); return;
  }
  if (id === 'find-replace') {
    const {source,output}=textIO(ctx), find=input('text',''), replacement=input('text',''), regex=input('checkbox',''), sensitive=input('checkbox','',{checked:true}), all=input('checkbox','',{checked:true});
    ctx.form.append(row(field('Find',find),field('Replace with',replacement)),field('Regular expression (JavaScript; use trusted patterns only)',regex),field('Case sensitive',sensitive),field('Replace all',all),el('p',{text:'Literal replacement text is used as-is. Regex mode supports $1 captures. Regex work runs in a local worker with a 1-second timeout.'}));
    let worker=null;
    ctx.form.append(button('Replace',ctx.run(async()=>{
      if(!find.value) throw new Error('Enter a search pattern.'); if(source.value.length>2000000) throw new Error('Input limited to 2 million characters.');
      if(worker) worker.terminate();
      const script=`onmessage=e=>{try{const {s,p,r,rx,cs,all}=e.data;const escaped=p.replace(/[.*+?^\u0024{}()|[\]\\\\]/g,'\\\\\u0024&');const re=new RegExp(rx?p:escaped,(all?'g':'')+(cs?'':'i'));let count=0;const out=s.replace(re,rx?function(){count++;const args=arguments;return expand(r,args)}:()=>{count++;return r});postMessage({out,count});}catch(e){postMessage({error:e.message})}};function expand(r,a){const tail=typeof a[a.length-1]==='object'?3:2,offset=a[a.length-tail],s=a[a.length-tail+1],groups=tail===3?a[a.length-1]:null;return r.replace(/\\$(\\$|&|\u0060|'|<[^>]+>|\\d{1,2})/g,(m,k)=>{if(k==='$')return '$';if(k==='&')return a[0];if(k==='\u0060')return s.slice(0,offset);if(k==="'")return s.slice(offset+a[0].length);if(k[0]==='<')return groups?(groups[k.slice(1,-1)]??''):m;const n=+k;if(n>0&&n<a.length-tail)return a[n]??'';if(k.length===2&&+k[0]>0&&+k[0]<a.length-tail)return (a[+k[0]]??'')+k[1];return m;});}`;
      const url=URL.createObjectURL(new Blob([script],{type:'text/javascript'}));
      const result=await new Promise((resolve,reject)=>{ const w=new Worker(url); worker=w; const finish=(error,value)=>{clearTimeout(timer);w.terminate();URL.revokeObjectURL(url);if(worker===w)worker=null;error?reject(error):resolve(value);}; const timer=setTimeout(()=>finish(new Error('Pattern timed out. Use a simpler expression.')),1000);w.onmessage=e=>finish(e.data.error?new Error(e.data.error):null,e.data);w.onerror=e=>finish(new Error(e.message));w.postMessage({s:source.value,p:find.value,r:replacement.value,rx:regex.checked,cs:sensitive.checked,all:all.checked}); });
      output.value=result.out; ctx.say(`${result.count} replacements.`);
    }))); return;
  }
  if(id==='lorem-ipsum') {
    const count=input('number','3',{min:1,max:100}), kind=select(['Paragraphs','Words','Sentences'],'Paragraphs'),out=area('',12);out.readOnly=true;
    const words='lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip commodo consequat duis aute irure reprehenderit voluptate velit esse cillum fugiat nulla pariatur'.split(' ');
    ctx.form.append(row(field('Count',count),field('Unit',kind)),button('Generate',ctx.run(()=>{const n=integer(count,1,100,'Count');let index=0;const sentence=()=>{const w=Array.from({length:12},()=>words[index++%words.length]).join(' ');return w[0].toUpperCase()+w.slice(1)+'.';};out.value=kind.value==='Words'?Array.from({length:n},()=>words[index++%words.length]).join(' '):Array.from({length:n},()=>kind.value==='Sentences'?sentence():Array.from({length:5},sentence).join(' ')).join(kind.value==='Paragraphs'?'\n\n':' ');})),out,button('Download',()=>download(out.value,'lorem.txt')));return;
  }
  if(id==='hash-generator') {
    const source=area(),file=input('file',''),algo=select(['SHA-256','SHA-384','SHA-512','SHA-1'],'SHA-256'),out=area('',4);out.readOnly=true;
    ctx.form.append(field('Text (ignored when a file is selected)',source),field('File (up to 40 MB)',file),field('Algorithm',algo),el('p',{text:'SHA-1 is legacy and not collision-resistant. Hashes are not passwords or encryption.'}),button('Calculate hash',ctx.run(async()=>{if(!globalThis.crypto?.subtle)throw new Error('Web Crypto requires a secure context (HTTPS or localhost).');const f=file.files[0];if(f&&f.size>40*1024*1024)throw new Error('File limited to 40 MB.');const data=f?await f.arrayBuffer():new TextEncoder().encode(source.value);out.value=Array.from(new Uint8Array(await crypto.subtle.digest(algo.value,data)),b=>b.toString(16).padStart(2,'0')).join('');ctx.say('Hash calculated locally.');})),field('Hex digest',out));return;
  }
  if(id==='csv-editor') {
    const source=area('Name,Value\nAlpha,1\nBeta,2',6), delimiter=select([[',','CSV (comma)'],['\t','TSV (tab)']],','),file=input('file','',{accept:'.csv,.tsv,text/csv,text/tab-separated-values'}),table=el('div',{class:'panel',style:{overflow:'auto'}}); let data=[];
    const draw=()=>{const t=el('table');data.forEach((r,i)=>{const tr=el('tr');r.forEach((v,j)=>{const cell=input('text',v,{'aria-label':`Row ${i+1}, column ${j+1}`});cell.addEventListener('input',()=>{data[i][j]=cell.value;});tr.append(el('td',{},cell));});tr.append(el('td',{},button('Delete row',()=>{data.splice(i,1);draw();})));t.append(tr);});table.replaceChildren(t);ctx.say(`${data.length} rows. First row is editable like other rows.`);};
    const parse=()=>{const rows=parseDelimited(source.value,delimiter.value),cols=Math.max(1,...rows.map(r=>r.length));if(rows.length*cols>10000||cols>100)throw new Error('Editor limited to 10,000 cells / 100 columns.');data=rows.map(r=>Array.from({length:cols},(_,i)=>r[i]||''));draw();};
    file.addEventListener('change',ctx.run(async()=>{if(!file.files[0])return;source.value=await readText(file.files[0]);if(/\.tsv$/i.test(file.files[0].name))delimiter.value='\t';parse();}));
    ctx.form.append(field('Import file',file),field('Delimited text',source),field('Delimiter',delimiter),button('Load text into grid',ctx.run(parse)),button('Add row',ctx.run(()=>{if((data.length+1)*(data[0]?.length||1)>10000)throw new Error('Cell limit reached.');data.push(Array(data[0]?.length||1).fill(''));draw();})),button('Add column',ctx.run(()=>{if(!data.length)data=[[]];if(data[0].length>=100||(data[0].length+1)*data.length>10000)throw new Error('Cell/column limit reached.');data.forEach(r=>r.push(''));draw();})),button('Delete last column',()=>{data.forEach(r=>r.pop());data=data.filter(r=>r.length);draw();}),button('Grid → text',()=>{source.value=delimited(data,delimiter.value);}),button('Download grid',()=>download(delimited(data,delimiter.value),delimiter.value===','?'table.csv':'table.tsv','text/plain;charset=utf-8')),el('p',{text:'CSV quoting is preserved. Spreadsheet apps may execute cells beginning with =, +, -, or @; review untrusted data before opening exported files.'}),table);parse();return;
  }
  if(id==='notepad') {
    const key='bitesized-notepad-v1',source=area('',18),file=input('file','',{accept:'.txt,.md,text/plain'}),auto=input('checkbox','',{checked:false});let timer;
    const save=ctx.run(()=>{try{localStorage.setItem(key,source.value);ctx.say('Saved in this browser.');}catch{throw new Error('Browser storage is unavailable or full. Download a backup.');}});
    file.addEventListener('change',ctx.run(async()=>{if(file.files[0]){source.value=await readText(file.files[0]);ctx.say('File loaded; not saved automatically.');}}));
    source.addEventListener('input',()=>{clearTimeout(timer);if(auto.checked)timer=setTimeout(()=>{if(ctx.alive()&&auto.checked)save();},500);});auto.addEventListener('change',()=>{clearTimeout(timer);});
    ctx.form.append(field('Open local text file',file),field('Note',source),field('Autosave to this browser (not encrypted)',auto),button('Save locally',save),button('Load saved note',ctx.run(()=>{source.value=localStorage.getItem(key)||'';ctx.say('Saved note loaded.');})),button('Delete saved note',ctx.run(()=>{if(globalThis.confirm('Delete the saved note from this browser? Current text is kept.')){localStorage.removeItem(key);ctx.say('Saved note deleted.');}})),button('Download note',()=>download(source.value,'note.txt')));return;
  }
  if(id==='file-inspector') {
    const file=input('file',''),out=el('pre',{class:'output',style:{whiteSpace:'pre-wrap'}});ctx.form.append(field('File',file),out);
    file.addEventListener('change',ctx.run(async()=>{const f=file.files[0];if(!f)return;const bytes=new Uint8Array(await f.slice(0,512).arrayBuffer());const hex=Array.from({length:Math.ceil(bytes.length/16)},(_,i)=>{const b=bytes.slice(i*16,i*16+16);return (i*16).toString(16).padStart(8,'0')+'  '+Array.from(b,n=>n.toString(16).padStart(2,'0')).join(' ').padEnd(47)+'  '+Array.from(b,n=>n>=32&&n<127?String.fromCharCode(n):'.').join('');}).join('\n');out.textContent=`Name: ${f.name}\nSize: ${f.size.toLocaleString()} bytes\nDeclared MIME (not verified): ${f.type||'unknown'}\nModified: ${new Date(f.lastModified).toISOString()}\n\nFirst ${bytes.length} bytes:\n${hex}`;}));return;
  }
}
function hexRGB(hex) { const s=hex.trim().replace(/^#/,'');if(!/^(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(s))throw new Error('Enter a 3- or 6-digit hex color.');const v=s.length===3?s.split('').map(c=>c+c).join(''):s;return [0,2,4].map(i=>parseInt(v.slice(i,i+2),16)); }
function rgbHex(rgb) { return '#'+rgb.map(v=>Math.round(v).toString(16).padStart(2,'0')).join(''); }
function rgbHSL([r,g,b]) {r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;let h=0,s=0;if(d){s=d/(1-Math.abs(2*l-1));h=max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;h*=60;if(h<0)h+=360;}return [h,s*100,l*100];}
function hslRGB(h,s,l) {h=((h%360)+360)%360;s/=100;l/=100;const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;const v=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return v.map(n=>Math.round((n+m)*255));}
function luminance(rgb) {const v=rgb.map(n=>{n/=255;return n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4;});return .2126*v[0]+.7152*v[1]+.0722*v[2];}
function pointer(c,event) {const b=c.getBoundingClientRect();return {x:(event.clientX-b.left)*c.width/b.width,y:(event.clientY-b.top)*c.height/b.height};}
function saveCanvas(ctx,c,name='art.png') {return button('Save PNG',ctx.run(async()=>download(await blobFromCanvas(c),name)));}
function artStudio(ctx,pixel=false) {
  const c=canvas(pixel?512:900,pixel?512:550),g=c.getContext('2d',{willReadFrequently:true}),color=input('color','#3355ee'),size=input('range',pixel?'1':'12',{min:1,max:pixel?8:100}),erase=input('checkbox',''),history=[];let active=false,last=null,pointerId=null;
  const snapshot=()=>{history.push(g.getImageData(0,0,c.width,c.height));if(history.length>15)history.shift();};
  const dot=p=>{g.globalCompositeOperation=erase.checked?'destination-out':'source-over';g.fillStyle=color.value;g.strokeStyle=color.value;g.lineWidth=Number(size.value);g.lineCap='round';g.lineJoin='round';if(pixel){const cell=16,n=Number(size.value);g.fillRect(Math.floor(p.x/cell)*cell,Math.floor(p.y/cell)*cell,n*cell,n*cell);}else if(last){g.beginPath();g.moveTo(last.x,last.y);g.lineTo(p.x,p.y);g.stroke();}else{g.beginPath();g.arc(p.x,p.y,Number(size.value)/2,0,Math.PI*2);g.fill();}last=p;g.globalCompositeOperation='source-over';};
  c.style.background='repeating-conic-gradient(#eee 0% 25%,white 0% 50%) 0 / 24px 24px';if(pixel)c.style.imageRendering='pixelated';
  c.addEventListener('pointerdown',e=>{if(active||e.button!==0)return;e.preventDefault();snapshot();active=true;pointerId=e.pointerId;last=null;c.setPointerCapture(e.pointerId);dot(pointer(c,e));});
  c.addEventListener('pointermove',e=>{if(!active||e.pointerId!==pointerId)return;e.preventDefault();const p=pointer(c,e);if(pixel&&last){const a=last,steps=Math.max(1,Math.ceil(Math.hypot(p.x-a.x,p.y-a.y)/8));for(let i=1;i<=steps;i++)dot({x:a.x+(p.x-a.x)*i/steps,y:a.y+(p.y-a.y)*i/steps});}else dot(p);});
  const end=e=>{if(e.pointerId!==pointerId)return;active=false;last=null;pointerId=null;};['pointerup','pointercancel','lostpointercapture'].forEach(name=>c.addEventListener(name,end));
  ctx.form.append(row(field('Color',color),field(pixel?'Brush width in cells (32×32 grid)':'Brush size (pixels)',size)),field('Eraser (transparent)',erase),button('Undo',()=>{if(active)return;const state=history.pop();if(state)g.putImageData(state,0,0);else ctx.say('No more undo steps (15 retained).');}),button('Clear',()=>{if(active)return;snapshot();g.clearRect(0,0,c.width,c.height);}),saveCanvas(ctx,c,pixel?'pixel-art.png':'painting.png'),c);
  if(pixel)ctx.form.append(button('Save native 32×32 PNG',ctx.run(async()=>{const small=canvas(32,32);small.getContext('2d').drawImage(c,0,0,32,32);download(await blobFromCanvas(small),'pixel-art-32.png');})));ctx.say('Draw with mouse, pen or touch. Transparent canvas; up to 15 undo steps.');
}
function colorTools(id,ctx) {
  if(id==='color-converter') {
    const mode=select(['HEX','RGB','HSL'],'HEX'),a=input('text','#3366ff'),out=el('pre',{class:'output'}),swatch=el('div',{style:{height:'80px'}});
    const update=()=>{let rgb;if(mode.value==='HEX')rgb=hexRGB(a.value);else {const values=a.value.replace(/^(rgb|hsl)\(/i,'').replace(/\)$/,'').replace(/%/g,'').split(/[\s,]+/).filter(Boolean).map(Number);if(values.length!==3||values.some(v=>!Number.isFinite(v)))throw new Error('Enter three numeric components.');if(mode.value==='RGB'){if(values.some(v=>v<0||v>255))throw new Error('RGB components must be 0–255.');rgb=values.map(Math.round);}else {if(values[1]<0||values[1]>100||values[2]<0||values[2]>100)throw new Error('HSL saturation/lightness must be 0–100%.');rgb=hslRGB(...values);}}
      const hex=rgbHex(rgb),hsl=rgbHSL(rgb);out.textContent=`HEX: ${hex}\nRGB: rgb(${rgb.join(', ')})\nHSL: hsl(${hsl[0].toFixed(1)}, ${hsl[1].toFixed(1)}%, ${hsl[2].toFixed(1)}%)`;swatch.style.backgroundColor=hex;ctx.say('Converted.');};
    ctx.form.append(field('Input model',mode),field('Color (#hex, r,g,b or h,s%,l%)',a),button('Convert',ctx.run(update)),swatch,out);update();return;
  }
  if(id==='contrast-checker') {
    const fg=input('color','#222222'),bg=input('color','#ffffff'),sample=el('div',{class:'panel',text:'Example text — readability matters.',style:{padding:'24px',fontSize:'24px'}}),out=el('pre',{class:'output'});
    const update=()=>{const l1=luminance(hexRGB(fg.value)),l2=luminance(hexRGB(bg.value)),ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);sample.style.color=fg.value;sample.style.background=bg.value;out.textContent=`Contrast: ${ratio.toFixed(2)}:1\nWCAG AA normal text (4.5): ${ratio>=4.5?'PASS':'FAIL'}\nWCAG AAA normal text (7): ${ratio>=7?'PASS':'FAIL'}\nAA large text / UI graphics (3): ${ratio>=3?'PASS':'FAIL'}\nLarge text: at least 18 pt regular or 14 pt bold.`;};ctx.form.append(row(field('Foreground',fg),field('Background',bg)),sample,out);[fg,bg].forEach(n=>n.addEventListener('input',update));update();return;
  }
  if(id==='color-picker') {
    const color=input('color','#3366ff'),file=input('file','',{accept:'image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp'}),c=canvas(600,350),out=area('',3);out.readOnly=true;const g=c.getContext('2d',{willReadFrequently:true});
    const update=()=>{const rgb=hexRGB(color.value);out.value=`${color.value}\nrgb(${rgb.join(', ')})\nhsl(${rgbHSL(rgb).map(v=>v.toFixed(1)).join(', ')})`;};let version=0;
    file.addEventListener('change',ctx.run(async()=>{const v=++version,img=await loadImage(file.files[0]);if(v!==version)return;c.width=Math.min(800,img.naturalWidth);c.height=Math.max(1,Math.round(c.width*img.naturalHeight/img.naturalWidth));g.drawImage(img,0,0,c.width,c.height);ctx.say('Click a pixel to sample its displayed color.');}));
    c.addEventListener('click',ctx.run(e=>{const p=pointer(c,e),rgba=g.getImageData(Math.min(c.width-1,Math.max(0,Math.floor(p.x))),Math.min(c.height-1,Math.max(0,Math.floor(p.y))),1,1).data;color.value=rgbHex(Array.from(rgba).slice(0,3));update();ctx.say(`Pixel alpha: ${(rgba[3]/255).toFixed(3)}`);}));
    ctx.form.append(field('Color',color),field('Or sample an image',file),c,field('Values',out));color.addEventListener('input',update);
    if(globalThis.EyeDropper)ctx.form.append(button('Pick screen color',ctx.run(async()=>{try{color.value=(await new globalThis.EyeDropper().open()).sRGBHex;update();}catch(e){if(e.name!=='AbortError')throw e;}})));update();return;
  }
  if(id==='palette-generator') {
    const base=input('color','#4477ee'),mode=select(['Analogous','Complementary','Triadic','Monochromatic'],'Analogous'),swatches=el('div',{class:'two-col'}),out=area('',5);out.readOnly=true;let colors=[];
    const update=()=>{const [h,s,l]=rgbHSL(hexRGB(base.value));colors=Array.from({length:5},(_,i)=>rgbHex(hslRGB(h+(mode.value==='Analogous'?(i-2)*25:mode.value==='Complementary'?(i%2)*180:mode.value==='Triadic'?(i%3)*120:0),mode.value==='Monochromatic'?s:Math.max(20,s-(i%2)*12),mode.value==='Monochromatic'?15+i*17:Math.max(10,Math.min(90,l+(i-2)*7)))));swatches.replaceChildren(...colors.map(hex=>el('div',{class:'panel',style:{backgroundColor:hex,color:luminance(hexRGB(hex))>.179?'#000':'#fff',padding:'24px'}},hex)));out.value=colors.join('\n');};
    ctx.form.append(row(field('Base color',base),field('Harmony',mode)),button('Random base',()=>{const bytes=crypto.getRandomValues(new Uint8Array(3));base.value=rgbHex([...bytes]);update();}),swatches,out,button('Download palette JSON',()=>download(JSON.stringify(colors,null,2),'palette.json','application/json')));[base,mode].forEach(n=>n.addEventListener('input',update));update();return;
  }
  if(id==='gradient-maker') {
    const a=input('color','#3366ff'),b=input('color','#ff55aa'),angle=input('number','90',{min:0,max:360}),kind=select(['Linear','Radial'],'Linear'),c=canvas(800,400),code=area('',3);code.readOnly=true;
    const update=()=>{const deg=number(angle,0,360,'Angle'),g=c.getContext('2d');let gradient;if(kind.value==='Linear'){const rad=deg*Math.PI/180,dx=Math.sin(rad),dy=-Math.cos(rad),extent=(Math.abs(c.width*dx)+Math.abs(c.height*dy))/2;gradient=g.createLinearGradient(c.width/2-dx*extent,c.height/2-dy*extent,c.width/2+dx*extent,c.height/2+dy*extent);}else gradient=g.createRadialGradient(400,200,0,400,200,Math.hypot(400,200));gradient.addColorStop(0,a.value);gradient.addColorStop(1,b.value);g.fillStyle=gradient;g.fillRect(0,0,800,400);code.value=`background: ${kind.value==='Linear'?`linear-gradient(${deg}deg, ${a.value}, ${b.value})`:`radial-gradient(circle, ${a.value}, ${b.value})`};`;};
    ctx.form.append(row(field('Start',a),field('End',b)),row(field('Type',kind),field('CSS angle',angle)),button('Render',ctx.run(update)),c,field('CSS',code),saveCanvas(ctx,c,'gradient.png'));[a,b,angle,kind].forEach(n=>n.addEventListener('input',ctx.run(update)));update();
  }
}
function imageTools(id,ctx) {
  const file=input('file','',{accept:'image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif'}),c=canvas(800,450),g=c.getContext('2d');let img=null,version=0;
  const controls=el('div',{class:'panel'});ctx.form.append(field('Source raster image',file),controls,c);let render;
  const ready=()=>{if(!img)throw new Error('Load an image first.');};
  if(id==='image-resizer') {
    const w=input('number','800',{min:1,max:8192}),h=input('number','450',{min:1,max:8192}),lock=input('checkbox','',{checked:true}),smooth=input('checkbox','',{checked:true});
    w.addEventListener('input',()=>{if(lock.checked&&img&&Number(w.value)>0)h.value=Math.max(1,Math.round(Number(w.value)*img.naturalHeight/img.naturalWidth));});h.addEventListener('input',()=>{if(lock.checked&&img&&Number(h.value)>0)w.value=Math.max(1,Math.round(Number(h.value)*img.naturalWidth/img.naturalHeight));});
    render=()=>{ready();const width=integer(w,1,8192,'Width'),height=integer(h,1,8192,'Height');canvas(width,height);c.width=width;c.height=height;g.imageSmoothingEnabled=smooth.checked;g.imageSmoothingQuality='high';g.drawImage(img,0,0,width,height);ctx.say(`Resized to ${width} × ${height}.`);};
    controls.append(row(field('Width',w),field('Height',h)),field('Lock aspect ratio while editing',lock),field('Smooth interpolation (off for pixel art)',smooth),button('Resize',ctx.run(render)));controls.onImage=()=>{w.value=img.naturalWidth;h.value=img.naturalHeight;render();};
  } else if(id==='image-cropper') {
    const x=input('number','0',{min:0}),y=input('number','0',{min:0}),w=input('number','400',{min:1}),h=input('number','300',{min:1});
    render=()=>{ready();const a=integer(x,0,img.naturalWidth-1,'X'),b=integer(y,0,img.naturalHeight-1,'Y'),width=integer(w,1,img.naturalWidth-a,'Crop width'),height=integer(h,1,img.naturalHeight-b,'Crop height');canvas(width,height);c.width=width;c.height=height;g.drawImage(img,a,b,width,height,0,0,width,height);ctx.say(`Cropped ${width} × ${height} at (${a}, ${b}). Source remains unchanged.`);};
    controls.append(row(field('X (source pixels)',x),field('Y (source pixels)',y)),row(field('Crop width',w),field('Crop height',h)),button('Apply crop',ctx.run(render)),button('Reset to full image',ctx.run(()=>{ready();x.value=y.value=0;w.value=img.naturalWidth;h.value=img.naturalHeight;render();})));controls.onImage=()=>{x.value=y.value=0;w.value=img.naturalWidth;h.value=img.naturalHeight;render();};
  } else {
    const effect=select(['None','Grayscale','Sepia','Invert','Blur','Brightness','Contrast','Saturate','Hue rotate'],'Grayscale'),amount=input('range','100',{min:0,max:200}),value=el('span',{text:'100'});
    render=()=>{ready();c.width=img.naturalWidth;c.height=img.naturalHeight;const n=number(amount,0,200,'Amount');value.textContent=String(n);const filters={None:'none',Grayscale:`grayscale(${n/200})`,Sepia:`sepia(${n/200})`,Invert:`invert(${n/200})`,Blur:`blur(${n/10}px)`,Brightness:`brightness(${n}%)`,Contrast:`contrast(${n}%)`,Saturate:`saturate(${n}%)`,'Hue rotate':`hue-rotate(${n*1.8}deg)`};if(!('filter'in g))throw new Error('Canvas filters are unavailable in this browser.');g.clearRect(0,0,c.width,c.height);g.filter=filters[effect.value];g.drawImage(img,0,0);g.filter='none';ctx.say('Filter rendered from the original image (not cumulative).');};
    controls.append(field('Filter',effect),field('Amount (0–200; blur 0–20px, hue 0–360°)',amount),value,button('Apply filter',ctx.run(render)));[effect,amount].forEach(n=>n.addEventListener('input',ctx.run(()=>{if(img)render();})));controls.onImage=render;
  }
  file.addEventListener('change',ctx.run(async()=>{const v=++version;img=null;g.clearRect(0,0,c.width,c.height);const next=await loadImage(file.files[0]);if(v!==version||!ctx.alive())return;img=next;controls.onImage();}));ctx.form.append(button('Save PNG',ctx.run(async()=>{ready();download(await blobFromCanvas(c),`${id}.png`);})));ctx.say('Load an image; all processing stays in your browser.');
}
function svgEditor(ctx) {
  const source=area('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240" viewBox="0 0 400 240">\n  <rect width="400" height="240" fill="#eef2ff"/>\n  <circle cx="200" cy="120" r="80" fill="#5577ee"/>\n</svg>',12),file=input('file','',{accept:'.svg,image/svg+xml'}),preview=el('div',{class:'panel'});
  const validate=()=>{if(source.value.length>2000000)throw new Error('SVG limited to 2 million characters.');const xml=new DOMParser().parseFromString(source.value,'image/svg+xml');if(xml.querySelector('parsererror')||xml.documentElement.localName!=='svg'||xml.documentElement.namespaceURI!=='http://www.w3.org/2000/svg')throw new Error('Invalid SVG XML or missing SVG namespace.');return xml;};
  const render=()=>{const doc=validate();const serialized=new XMLSerializer().serializeToString(doc.documentElement);preview.replaceChildren(sandbox(secureDocument(serialized),'Isolated SVG preview'));ctx.say('SVG validated. Preview is sandboxed with scripts, forms and network access disabled. Export contains your original source; review it before use elsewhere.');};
  file.addEventListener('change',ctx.run(async()=>{if(file.files[0]){source.value=await readText(file.files[0]);render();}}));ctx.form.append(field('Open SVG',file),row(field('SVG source',source),preview),button('Validate / preview',ctx.run(render)),button('Download SVG source',ctx.run(()=>{validate();download(source.value,'drawing.svg','image/svg+xml');})));render();
}
function patternMaker(ctx) {
  const kind=select(['Dots','Stripes','Checkerboard','Waves'],'Dots'),fg=input('color','#5577ee'),bg=input('color','#ffffff'),spacing=input('number','40',{min:8,max:200}),size=input('number','8',{min:1,max:100}),c=canvas(800,500),css=area('',4);css.readOnly=true;
  const render=()=>{const step=integer(spacing,8,200,'Spacing'),n=integer(size,1,100,'Motif size'),g=c.getContext('2d');g.fillStyle=bg.value;g.fillRect(0,0,c.width,c.height);g.fillStyle=fg.value;g.strokeStyle=fg.value;g.lineWidth=n;
    if(kind.value==='Dots'){for(let y=step/2;y<c.height;y+=step)for(let x=step/2;x<c.width;x+=step){g.beginPath();g.arc(x,y,Math.min(n,step/2),0,Math.PI*2);g.fill();}css.value=`background: radial-gradient(circle, ${fg.value} ${Math.min(n,step/2)}px, transparent ${Math.min(n,step/2)}px) 0 0 / ${step}px ${step}px, ${bg.value};`;}
    else if(kind.value==='Stripes'){for(let x=0;x<c.width;x+=step)g.fillRect(x,0,Math.min(n,step),c.height);css.value=`background: repeating-linear-gradient(90deg, ${fg.value} 0 ${Math.min(n,step)}px, ${bg.value} ${Math.min(n,step)}px ${step}px);`;}
    else if(kind.value==='Checkerboard'){for(let y=0;y<c.height;y+=step)for(let x=0;x<c.width;x+=step)if((Math.floor(x/step)+Math.floor(y/step))%2===0)g.fillRect(x,y,step,step);css.value=`background: repeating-conic-gradient(${fg.value} 0% 25%, ${bg.value} 0% 50%) 0 0 / ${step*2}px ${step*2}px;`;}
    else {for(let y=-step;y<c.height+step;y+=step){g.beginPath();for(let x=0;x<=c.width;x+=2){const yy=y+Math.sin(x/step*Math.PI*2)*step/4;if(x===0)g.moveTo(x,yy);else g.lineTo(x,yy);}g.stroke();}css.value='Sine-wave pattern rendered on canvas. Use Save PNG for this motif.';}ctx.say('Pattern rendered.');};
  ctx.form.append(field('Pattern',kind),row(field('Foreground',fg),field('Background',bg)),row(field('Spacing (px)',spacing),field('Motif radius / line width (px; unused for checkerboard)',size)),button('Render',ctx.run(render)),c,field('CSS equivalent (where supported)',css),saveCanvas(ctx,c,'pattern.png'));[kind,fg,bg,spacing,size].forEach(n=>n.addEventListener('input',ctx.run(render)));render();
}
function collageMaker(ctx) {
  const files=input('file','',{multiple:true,accept:'image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif'}),cols=input('number','2',{min:1,max:8}),tile=input('number','300',{min:40,max:1000}),gap=input('number','10',{min:0,max:100}),bg=input('color','#ffffff'),fit=select(['Cover (crop to fill)','Contain (letterbox)'],'Cover (crop to fill)'),c=canvas(620,320);let images=[],version=0;
  const render=()=>{if(!images.length)throw new Error('Select 1–16 images first.');const columns=integer(cols,1,8,'Columns'),s=integer(tile,40,1000,'Tile size'),d=integer(gap,0,100,'Gap'),rows=Math.ceil(images.length/columns),w=columns*s+(columns+1)*d,h=rows*s+(rows+1)*d;canvas(w,h);c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle=bg.value;g.fillRect(0,0,w,h);images.forEach((img,i)=>{const x=d+(i%columns)*(s+d),y=d+Math.floor(i/columns)*(s+d),scale=(fit.value.startsWith('Cover')?Math.max:Math.min)(s/img.naturalWidth,s/img.naturalHeight),iw=img.naturalWidth*scale,ih=img.naturalHeight*scale;g.save();g.beginPath();g.rect(x,y,s,s);g.clip();g.drawImage(img,x+(s-iw)/2,y+(s-ih)/2,iw,ih);g.restore();});ctx.say(`${images.length} images composed in selection order.`);};
  files.addEventListener('change',ctx.run(async()=>{const v=++version;images=[];const selected=[...files.files];if(!selected.length||selected.length>16)throw new Error('Select 1–16 images.');if(selected.reduce((n,f)=>n+f.size,0)>80*1024*1024)throw new Error('Combined files limited to 80 MB.');ctx.say('Decoding images…');const next=[];let pixels=0;for(const f of selected){const img=await loadImage(f);if(v!==version)return;pixels+=img.naturalWidth*img.naturalHeight;if(pixels>48000000)throw new Error('Combined decoded images limited to 48 megapixels.');next.push(img);}if(v!==version||!ctx.alive())return;images=next;render();}));
  ctx.form.append(field('Images (selection order; max 16)',files),row(field('Columns',cols),field('Tile size',tile)),row(field('Gap',gap),field('Background',bg)),field('Fit',fit),button('Compose',ctx.run(render)),c,button('Save PNG',ctx.run(async()=>{if(!images.length)throw new Error('Compose images first.');download(await blobFromCanvas(c),'collage.png');})));
}
function asciiArt(ctx) {
  const file=input('file','',{accept:'image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif'}),width=input('number','100',{min:10,max:240}),ramp=input('text','@%#*+=-:. '),invert=input('checkbox',''),out=area('',22);out.style.fontFamily='monospace';out.style.whiteSpace='pre';out.wrap='off';out.readOnly=true;let img=null,version=0;
  const render=()=>{if(!img)throw new Error('Choose an image.');const w=integer(width,10,240,'Columns'),h=Math.max(1,Math.round(w*img.naturalHeight/img.naturalWidth*.5));if(h>1500)throw new Error('Image is too tall for this column count.');const chars=Array.from(ramp.value);if(chars.length<2||chars.length>100)throw new Error('Use 2–100 ramp characters, dark to light.');const c=canvas(w,h),g=c.getContext('2d');g.fillStyle='white';g.fillRect(0,0,w,h);g.drawImage(img,0,0,w,h);const pixels=g.getImageData(0,0,w,h).data;const lines=[];for(let y=0;y<h;y++){let line='';for(let x=0;x<w;x++){const i=(y*w+x)*4;let l=(.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2])/255;if(invert.checked)l=1-l;line+=chars[Math.round(l*(chars.length-1))];}lines.push(line);}out.value=lines.join('\n');ctx.say(`${w} columns × ${h} rows.`);};
  file.addEventListener('change',ctx.run(async()=>{const v=++version;img=null;const next=await loadImage(file.files[0]);if(v!==version||!ctx.alive())return;img=next;render();}));ctx.form.append(field('Image',file),field('Columns',width),field('Ramp (dark → light, trailing space allowed)',ramp),field('Invert',invert),button('Generate ASCII',ctx.run(render)),out,button('Download text',()=>download(out.value,'ascii-art.txt')));
}
function mandala(ctx) {
  const c=canvas(700,700),g=c.getContext('2d'),color=input('color','#7755dd'),size=input('range','3',{min:1,max:25}),symmetry=input('number','12',{min:2,max:48}),mirror=input('checkbox','',{checked:true}),history=[];let active=false,last=null,pid=null;
  const snapshot=()=>{history.push(g.getImageData(0,0,700,700));if(history.length>10)history.shift();};
  const segment=(a,b)=>{const n=integer(symmetry,2,48,'Symmetry');for(let i=0;i<n;i++){g.save();g.translate(350,350);g.rotate(i*Math.PI*2/n);const paint=()=>{g.beginPath();g.moveTo(a.x-350,a.y-350);g.lineTo(b.x-350,b.y-350);g.stroke();};paint();if(mirror.checked){g.scale(1,-1);paint();}g.restore();}};
  c.style.background='#fff';c.addEventListener('pointerdown',ctx.run(e=>{if(active||e.button!==0)return;integer(symmetry,2,48,'Symmetry');snapshot();active=true;pid=e.pointerId;c.setPointerCapture(pid);last=pointer(c,e);g.strokeStyle=color.value;g.lineWidth=Number(size.value);g.lineCap='round';segment(last,{x:last.x+.01,y:last.y});}));
  c.addEventListener('pointermove',ctx.run(e=>{if(!active||pid!==e.pointerId)return;const next=pointer(c,e);segment(last,next);last=next;}));const end=e=>{if(e.pointerId===pid){active=false;last=null;pid=null;}};['pointerup','pointercancel','lostpointercapture'].forEach(n=>c.addEventListener(n,end));
  ctx.form.append(row(field('Color',color),field('Brush size',size)),field('Rotational symmetry (2–48)',symmetry),field('Mirror each sector',mirror),button('Undo',()=>{if(active)return;const state=history.pop();if(state)g.putImageData(state,0,0);}),button('Clear',()=>{if(active)return;snapshot();g.clearRect(0,0,700,700);}),button('Generate rosette',ctx.run(()=>{if(active)return;snapshot();g.strokeStyle=color.value;g.lineWidth=Number(size.value);const n=integer(symmetry,2,48,'Symmetry');for(let i=0;i<n;i++){g.save();g.translate(350,350);g.rotate(i*Math.PI*2/n);g.beginPath();g.ellipse(0,-135,48,130,0,0,Math.PI*2);g.stroke();g.restore();}})),c,saveCanvas(ctx,c,'mandala.png'));ctx.say('Draw a stroke; it repeats around the center. PNG background is transparent.');
}
/** Mount one exact registered tool ID. Unknown IDs or invalid roots return false without mutation. */
export function mountTextArt(id, root) {
  if ((!TEXT_IDS.includes(id) && !ART_IDS.includes(id)) || !root || typeof root.append !== 'function' || typeof root.querySelectorAll !== 'function') return false;
  const title=id.split('-').map(s=>s[0].toUpperCase()+s.slice(1)).join(' ');
  // Replacement avoids duplicate controls and notifies any previous mounted tool.
  root.querySelectorAll('.tool-form').forEach(n=>n.dispatchEvent(new Event('tool-dispose')));
  root.replaceChildren();const ctx=init(root,title);
  try {
    if(TEXT_IDS.includes(id))textTools(id,ctx);
    else if(id==='art-studio'||id==='pixel-art')artStudio(ctx,id==='pixel-art');
    else if(['color-picker','palette-generator','gradient-maker','contrast-checker','color-converter'].includes(id))colorTools(id,ctx);
    else if(['image-resizer','image-cropper','image-filters'].includes(id))imageTools(id,ctx);
    else if(id==='svg-editor')svgEditor(ctx);
    else if(id==='pattern-maker')patternMaker(ctx);
    else if(id==='collage-maker')collageMaker(ctx);
    else if(id==='ascii-art')asciiArt(ctx);
    else if(id==='mandala')mandala(ctx);
  } catch(error) {ctx.say(`Unable to initialize: ${error.message}`);}
  return true;
}
