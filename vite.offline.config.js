/**
 * The single-file build: one HTML document that contains the whole kitchen.
 *
 * `npm run build:offline` makes it, and it lands beside the rest of the site as
 * `dist/offline.html`. The backup kitchen has a button that downloads it.
 *
 * Why it is a separate config and not a third Rollup input:
 *
 *   - A page opened from a folder cannot load an ES module. Chrome refuses
 *     `file://` module scripts outright, which is exactly the "Waffle Kitchen
 *     hiccup" an unzipped site produces. So the code has to arrive as a
 *     *classic* script, and Rollup only writes those in iife/umd format — a
 *     format Vite's HTML pipeline never emits, because every script it puts in
 *     an HTML file is `type="module"`.
 *   - `inlineDynamicImports` is required for iife, and Rollup refuses it with
 *     more than one entry. The normal build has two (index and the backup page).
 *
 * So this builds `app.js` as a library, and then writes the HTML around it by
 * hand. That is easy here and would not be in most apps: `index.html`'s body is
 * a single empty `<div id="app">`, because app.js builds the entire DOM.
 *
 * What this build cannot do, and says so instead of trying: Waffle AI (model
 * weights are fetched, and the engines are workers and WASM), CodeHub's
 * runtimes (workers again), and the games (separate pages, and a `file://` page
 * may not frame another one). `__WAFFLE_OFFLINE__` is what makes those refuse
 * before importing, so their code is not in this file at all.
 */
import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const OUT = 'dist-offline';

/** Inline anything this size or smaller: fonts and icons become data: URLs. */
const INLINE_EVERYTHING = 1024 * 1024;

/** Replace every url(...) in a stylesheet with a data: URL of the file it names. */
function inlineFontUrls(cssText) {
  return cssText.replace(/url\((['"]?)([^'")]+)\1\)/g, (whole, _q, ref) => {
    if (/^(data:|https?:)/.test(ref)) return whole;
    const file = path.resolve('public/fonts', ref.replace(/^\.\//, ''));
    if (!fs.existsSync(file)) return whole;
    const type = ref.endsWith('.woff2') ? 'font/woff2' : ref.endsWith('.woff') ? 'font/woff' : 'application/octet-stream';
    return `url(data:${type};base64,${fs.readFileSync(file).toString('base64')})`;
  });
}

export default defineConfig({
  define: {
    'globalThis.__WAFFLE_OFFLINE__': 'true'
  },
  resolve: {
    // The guards in the source are what make the app refuse politely. This is
    // what makes the bytes impossible to ship: every route to the three AI
    // vendor packages resolves to a 1 KB stub, so a guard that is missed, or a
    // new import site added later, costs a confusing refusal instead of 179 MB
    // of base64 WASM in the middle of an HTML file.
    alias: [
      { find: /^@huggingface\/transformers$/, replacement: path.resolve('offline-stubs/ai-vendor.js') },
      { find: /^@wllama\/wllama$/, replacement: path.resolve('offline-stubs/ai-vendor.js') },
      { find: /^@wllama\/wllama-compat$/, replacement: path.resolve('offline-stubs/ai-vendor.js') },
      { find: /^onnxruntime-web(\/.*)?$/, replacement: path.resolve('offline-stubs/ai-vendor.js') }
    ]
  },
  build: {
    outDir: OUT,
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: INLINE_EVERYTHING,
    // Minification is off, and that is a deliberate trade rather than an
    // oversight: esbuild's service was killed by memory pressure in the sandbox
    // while minifying 89 KB of CSS, which took the whole build with it. This
    // artefact is a test download, not the site, so a larger readable file beats
    // a build that does not finish. The public build still minifies.
    minify: false,
    cssMinify: false,
    // esnext, so Vite never hands the chunk to esbuild to transpile. Its child
    // process was being killed partway through this one — "[vite:esbuild-transpile]
    // The service was stopped" — and there is nothing to transpile anyway: the
    // browsers that can run this kitchen already speak the syntax Rollup emits.
    target: 'esnext',
    sourcemap: false,
    // Gzip-sizing every chunk is more memory for a number nobody reads here.
    reportCompressedSize: false,
    lib: {
      entry: path.resolve('app.js'),
      formats: ['iife'],
      name: 'BiteSizedUtilities',
      fileName: () => 'kitchen.js'
    },
    rollupOptions: {
      output: { inlineDynamicImports: true }
    }
  },
  plugins: [
    {
      name: 'waffle-offline-html',
      enforce: 'post',
      // writeBundle, not closeBundle: the chunk is right here in the bundle
      // object, and guessing the filename Rollup chose is how this hook first
      // failed. It also runs before Vite copies `public/`, so the fonts are read
      // from the source tree rather than from the output directory.
      writeBundle(options, bundle) {
        const parts = Object.values(bundle);
        const js = parts.find(f => f.type === 'chunk' && f.isEntry);
        const css = parts.filter(f => f.type === 'asset' && f.fileName.endsWith('.css'))
          .map(f => typeof f.source === 'string' ? f.source : Buffer.from(f.source).toString('utf8'))
          .join('\n');
        if (!js) throw new Error('the offline build produced no entry chunk');

        // The kitchen's faces live in public/fonts, which Vite copies verbatim
        // and never rewrites, so a file:// page would request them and get
        // nothing. Inline them: a data: URL is the one kind of subresource a
        // page opened from a folder is allowed to have.
        const fontCss = inlineFontUrls(fs.readFileSync('public/fonts/fonts.css', 'utf8'));
        const kb = n => `${(n / 1024).toFixed(1)} KB`;

        const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#eccd8f"><title>BiteSized Utilities \u2014 Offline</title>
<style>${fontCss}</style>
<style>${css}</style>
</head>
<body style="margin:0;background:#eccd8f;color:#4f2f23;font-family:system-ui,sans-serif"><div id="app"></div>
<script>(function(){function showFallback(msg){var el=document.getElementById('app');if(el&&!el.children.length){el.innerHTML='<div style="max-width:520px;margin:48px auto;padding:20px;background:#fff8e8;border:3px solid #4f2f23;border-radius:18px;font-weight:700"><h2>Waffle Kitchen hiccup</h2><p>'+(msg||'Could not finish loading.')+'</p></div>';}}window.addEventListener('error',function(e){showFallback(e&&e.message);});})();</script>
<script>${js.code}</script>
</body></html>
`;
        fs.mkdirSync('dist', { recursive: true });
        fs.writeFileSync(path.resolve('dist/offline.html'), html);

        // Proof, printed at build time rather than trusted. An earlier version of
        // this checked for the words "transformers" and "wllama", which the app's
        // own comments contain, so it cried wolf on a clean build and would have
        // been ignored on a dirty one. These are the things that actually break a
        // page opened from a folder.
        const fatal = [];
        if (/AGFzbQ/.test(html)) fatal.push('base64 WASM, which is how it reached 190 MB once');
        if (/<script[^>]+\ssrc=/.test(html)) fatal.push('a script with a src, which file:// will not load as a module');
        if (/<link[^>]+href=/.test(html)) fatal.push('a stylesheet or manifest to fetch');
        if (/type="module"/.test(html)) fatal.push('a module script, which file:// refuses outright');
        // Compiled, not scanned. A regex for `import.meta` matched this project's
        // own release notes — they are a string inside the bundle, and they
        // describe the very thing being checked for. Same class of false positive
        // as the earlier check that matched "transformers" in a comment.
        // `vm.Script` asks the real question: does this parse as a classic script?
        // It rejects import.meta, import/export and top-level await, and it cannot
        // be fooled by a string or a comment.
        try {
          new vm.Script(js.code, { filename: 'kitchen.js' });
        } catch (err) {
          fatal.push(`the bundle does not parse as a classic script: ${err.message}`);
        }
        if (/<script[^>]*>\s*<!\[CDATA/.test(html)) fatal.push('something that will not survive being written into HTML');
        // Not a lookahead. `url(\s*['"]?(?!data:)` looks airtight and is not: on
        // the app's own `url("data:image/svg+xml,...")` the optional quote group
        // matches zero characters, the lookahead then sees a quote instead of
        // "data:", and a perfectly self-contained stylesheet is accused of
        // pointing at a file. Extracting the values cannot backtrack its way into
        // a wrong answer, and it prints which one it meant.
        const externalUrls = [...(css + fontCss).matchAll(/url\(\s*['"]?([^'")]+)/g)]
          .map(m => m[1].trim())
          .filter(u => u && !u.startsWith('data:') && !u.startsWith('#'));
        const soft = externalUrls.length
          ? [`a stylesheet still points at ${externalUrls.length} file(s): ${externalUrls.slice(0, 3).join(', ')}`]
          : [];
        console.log(`[waffle] offline kitchen \u2192 dist/offline.html (${kb(html.length)}: ${kb(js.code.length)} script, ${kb(css.length)} app css, ${kb(fontCss.length)} fonts)`);
        console.log(`[waffle] offline kitchen: ${fatal.length || soft.length ? [fatal, soft].flat().join('; ') : 'one file, nothing to fetch, no module, no WASM'}`);
        if (fatal.length) throw new Error(`offline.html is not self-contained: ${fatal.join('; ')}`);
      }
    }
  ]
});
