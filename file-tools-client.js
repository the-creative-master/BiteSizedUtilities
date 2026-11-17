// Pure-JS DOCX (OOXML) generator & file text extractor (zero external deps)

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function makeZip(entries) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBytes = enc.encode(name);
    const body = typeof data === 'string' ? enc.encode(data) : data;
    const crc = crc32(body);

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, body.length, true);
    lv.setUint32(22, body.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, body.length, true);
    cv.setUint32(24, body.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);

    parts.push(local, body);
    central.push(cd);
    offset += local.length + body.length;
  }

  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const total = offset + cdSize + 22;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) { out.set(p, pos); pos += p.length; }
  for (const c of central) { out.set(c, pos); pos += c.length; }
  out.set(eocd, pos);
  return out;
}

function xmlEsc(s) {
  return String(s).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  }[c]));
}

function inlineRunsXml(text) {
  // Parse **bold**, *italic*, `code`
  const tokens = [];
  const re = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*)/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push({ t: text.slice(last, m.index) });
    const s = m[0];
    if (s.startsWith('**')) tokens.push({ t: s.slice(2, -2), b: true });
    else if (s.startsWith('`')) tokens.push({ t: s.slice(1, -1), code: true });
    else tokens.push({ t: s.slice(1, -1), i: true });
    last = re.lastIndex;
  }
  if (last < text.length) tokens.push({ t: text.slice(last) });
  if (!tokens.length) return '<w:r><w:t xml:space="preserve"></w:t></w:r>';
  return tokens.map(tok => {
    const rPr = [];
    if (tok.b) rPr.push('<w:b/>');
    if (tok.i) rPr.push('<w:i/>');
    if (tok.code) rPr.push('<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:shd w:val="clear" w:color="auto" w:fill="F2E6D0"/>');
    return `<w:r>${rPr.length ? `<w:rPr>${rPr.join('')}</w:rPr>` : ''}<w:t xml:space="preserve">${xmlEsc(tok.t)}</w:t></w:r>`;
  }).join('');
}

function markdownToDocumentXml(markdownText, title = '') {
  const paragraphs = [];
  if (title && !/^\s*#\s+/.test(markdownText)) {
    paragraphs.push(`<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t xml:space="preserve">${xmlEsc(title)}</w:t></w:r></w:p>`);
  }
  let inCode = false;
  for (const rawLine of String(markdownText || '').split(/\r?\n/)) {
    if (/^\s*```/.test(rawLine)) {
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      paragraphs.push(
        `<w:p><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F5EFE4"/><w:ind w:left="360"/></w:pPr>` +
        `<w:r><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${xmlEsc(rawLine)}</w:t></w:r></w:p>`
      );
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(rawLine);
    if (h) {
      const style = `Heading${h[1].length}`;
      paragraphs.push(`<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${inlineRunsXml(h[2])}</w:p>`);
      continue;
    }
    const li = /^\s*[-*•]\s+(.*)$/.exec(rawLine);
    if (li) {
      paragraphs.push(`<w:p><w:pPr><w:ind w:left="480"/></w:pPr><w:r><w:t xml:space="preserve">• </w:t></w:r>${inlineRunsXml(li[1])}</w:p>`);
      continue;
    }
    const ol = /^\s*(\d+)\.\s+(.*)$/.exec(rawLine);
    if (ol) {
      paragraphs.push(`<w:p><w:pPr><w:ind w:left="480"/></w:pPr><w:r><w:t xml:space="preserve">${xmlEsc(ol[1])}. </w:t></w:r>${inlineRunsXml(ol[2])}</w:p>`);
      continue;
    }
    if (!rawLine.trim()) {
      paragraphs.push('<w:p/>');
      continue;
    }
    paragraphs.push(`<w:p>${inlineRunsXml(rawLine)}</w:p>`);
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.join('\n    ')}
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`;
}

export function createDocxBytes(markdownText, title = '') {
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:color w:val="2B1E16"/></w:rPr>
    <w:pPr><w:spacing w:after="140" w:line="276" w:lineRule="auto"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/><w:basedOn w:val="Normal"/>
    <w:rPr><w:b/><w:sz w:val="36"/><w:color w:val="7A4623"/></w:rPr>
    <w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/><w:basedOn w:val="Normal"/>
    <w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="9B5929"/></w:rPr>
    <w:pPr><w:spacing w:before="180" w:after="90"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/><w:basedOn w:val="Normal"/>
    <w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="4F2F23"/></w:rPr>
    <w:pPr><w:spacing w:before="140" w:after="60"/></w:pPr>
  </w:style>
</w:styles>`;

  return makeZip([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rels },
    { name: 'word/_rels/document.xml.rels', data: docRels },
    { name: 'word/styles.xml', data: styles },
    { name: 'word/document.xml', data: markdownToDocumentXml(markdownText, title) }
  ]);
}

export function createDocxBlob(markdownText, title = '') {
  return new Blob([createDocxBytes(markdownText, title)], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
}

async function inflateStream(bytes, format = 'deflate-raw') {
  if (typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream(format);
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const buf = await new Response(ds.readable).arrayBuffer();
    return new Uint8Array(buf);
  }
  throw new Error('Deflate decompression is not supported in this environment.');
}

async function readZipEntries(arrayBuffer, filterFn) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Invalid ZIP/OOXML archive.');
  const cdOffset = view.getUint32(eocd + 16, true);
  const totalEntries = view.getUint16(eocd + 10, true);
  const dec = new TextDecoder();
  const out = [];

  let ptr = cdOffset;
  for (let idx = 0; idx < totalEntries && ptr + 46 <= bytes.length; idx++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break;
    const method = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);
    const name = dec.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));
    ptr += 46 + nameLen + extraLen + commentLen;

    if (!filterFn(name)) continue;
    const lNameLen = view.getUint16(localOffset + 26, true);
    const lExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    const rawSlice = bytes.subarray(dataStart, dataStart + compSize);
    const body = method === 0 ? rawSlice : method === 8 ? await inflateStream(rawSlice, 'deflate-raw') : null;
    if (body) out.push({ name, text: dec.decode(body) });
  }
  return out;
}

function xmlToText(xmlStr, tagName = 't') {
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(xmlStr, 'application/xml');
    const paras = [...doc.getElementsByTagNameNS('*', 'p')];
    if (paras.length) {
      return paras.map(p => [...p.getElementsByTagNameNS('*', tagName)].map(t => t.textContent).join('')).filter(Boolean).join('\n').trim();
    }
    const nodes = [...doc.getElementsByTagNameNS('*', tagName)];
    if (nodes.length) return nodes.map(n => n.textContent).filter(Boolean).join('\n').trim();
  }
  return xmlStr
    .replace(/<\/(?:w:p|a:p|p)>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .trim();
}

export async function extractTextFromDocxBuffer(arrayBuffer) {
  const entries = await readZipEntries(arrayBuffer, n => /^word\/document\d*\.xml$/i.test(n));
  if (!entries.length) throw new Error('Could not find word/document.xml inside DOCX.');
  return entries.map(e => xmlToText(e.text, 't')).filter(Boolean).join('\n\n').trim();
}

function parsePdfOperators(chunk) {
  const pieces = [];
  const decodePdfStr = s => s
    .replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '\\');
  for (const m of chunk.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) {
    pieces.push(decodePdfStr(m[1]));
  }
  for (const m of chunk.matchAll(/\[((?:[^[\]]|\((?:\\.|[^\\)])*\))*)\]\s*TJ/g)) {
    const sub = [];
    for (const p of m[1].matchAll(/\(((?:\\.|[^\\)])*)\)/g)) sub.push(decodePdfStr(p[1]));
    if (sub.length) pieces.push(sub.join(''));
  }
  return pieces.join(' ').replace(/\s+/g, ' ').trim();
}

async function extractTextFromPdfBuffer(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const raw = new TextDecoder('latin1').decode(bytes);
  const chunks = [];
  const direct = parsePdfOperators(raw);
  if (direct) chunks.push(direct);

  // Decompress FlateDecode PDF streams
  let pos = 0;
  while (pos < bytes.length && chunks.join('\n').length < 18000) {
    const sIdx = raw.indexOf('stream', pos);
    if (sIdx < 0) break;
    let dataStart = sIdx + 6;
    if (raw[dataStart] === '\r' && raw[dataStart + 1] === '\n') dataStart += 2;
    else if (raw[dataStart] === '\n' || raw[dataStart] === '\r') dataStart += 1;
    const eIdx = raw.indexOf('endstream', dataStart);
    if (eIdx < 0) break;
    let dataEnd = eIdx;
    if (raw[dataEnd - 1] === '\n') dataEnd--;
    if (raw[dataEnd - 1] === '\r') dataEnd--;
    const header = raw.slice(Math.max(0, sIdx - 320), sIdx);
    if (/FlateDecode/i.test(header) && dataEnd > dataStart) {
      const slice = bytes.subarray(dataStart, dataEnd);
      for (const fmt of ['deflate', 'deflate-raw']) {
        try {
          const dec = new TextDecoder('latin1').decode(await inflateStream(slice, fmt));
          const txt = parsePdfOperators(dec);
          if (txt) { chunks.push(txt); break; }
        } catch {}
      }
    }
    pos = eIdx + 9;
  }

  const out = chunks.join('\n').trim();
  if (out) return out.slice(0, 12000);
  const printable = raw.replace(/[^\x20-\x7E\r\n\t]+/g, ' ').replace(/\s{3,}/g, '\n').trim();
  return printable.slice(0, 8000) || '(PDF contains scanned images or unsupported font encoding)';
}

export async function extractTextFromUpload(file) {
  if (!file) throw new Error('No file selected.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Files are limited to 15 MB.');
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'docx') {
    const text = await extractTextFromDocxBuffer(await file.arrayBuffer());
    return text || '(Empty DOCX document)';
  }
  if (ext === 'pptx') {
    const slides = await readZipEntries(await file.arrayBuffer(), n => /^ppt\/slides\/slide\d+\.xml$/i.test(n));
    slides.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const text = slides.map((s, i) => `Slide ${i + 1}:\n${xmlToText(s.text, 't')}`).join('\n\n').trim();
    return text || '(Empty PPTX presentation)';
  }
  if (ext === 'xlsx') {
    const sheets = await readZipEntries(await file.arrayBuffer(), n => /^xl\/sharedStrings\.xml$/i.test(n));
    const text = sheets.map(s => xmlToText(s.text, 't')).join('\n').trim();
    return text || '(Empty XLSX spreadsheet)';
  }
  if (ext === 'pdf') {
    return await extractTextFromPdfBuffer(await file.arrayBuffer());
  }
  if (ext === 'doc') {
    const buf = new Uint8Array(await file.arrayBuffer());
    const raw = new TextDecoder('latin1').decode(buf);
    const printable = raw.replace(/[^\x20-\x7E\r\n\t]+/g, ' ').replace(/\s{3,}/g, '\n').trim();
    return printable.slice(0, 12000) || '(Binary .doc — convert to .docx or .txt for full text extraction)';
  }
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'ico'].includes(ext)) {
    return `[Image file: ${file.name}, ${Math.max(1, Math.round(file.size / 1024))} KB, type: ${file.type || ext}]`;
  }
  const text = await file.text();
  return text.replace(/\u0000/g, '');
}

export function triggerFileDownload(contentOrBlob, filename, mime = 'text/plain;charset=utf-8') {
  const blob = contentOrBlob instanceof Blob
    ? contentOrBlob
    : contentOrBlob instanceof Uint8Array
      ? new Blob([contentOrBlob], { type: mime })
      : new Blob([String(contentOrBlob)], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
