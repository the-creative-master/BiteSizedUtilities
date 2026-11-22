/**
 * The folder build: the whole kitchen as one classic script.
 *
 *   npm run build:classic     →  dist-classic/kitchen.js
 *
 * It exists for one reason. `scripts/make-offline-zip.mjs` puts it into the offline
 * zip next to a rewritten `index.html`, so that a person who unzips the archive and
 * double-clicks `index.html` gets **the kitchen** rather than a page of
 * instructions. That is the whole product; everything else here is consequence.
 *
 * Why it cannot just be the site's own bundle:
 *
 *   - A browser refuses an ES module from a `file:` page. That is not a setting and
 *     not a permission — the origin of a page on the disk is opaque, so the module
 *     request has no origin to satisfy. It is why the site's index.html shows a
 *     fallback when opened from a folder.
 *   - A classic script has no such rule. `<script src="./kitchen.js">` from a page
 *     on the disk is what every website did before modules, and it still works.
 *   - Rollup only writes classic scripts in `iife` or `umd` format, and `iife`
 *     requires `inlineDynamicImports`, which requires a single entry. Vite's HTML
 *     pipeline never emits any of that, because every script it puts in an HTML file
 *     is `type="module"`. Hence a second config rather than a second input.
 *
 * What this build cannot do, and says so instead of trying: Waffle AI and image
 * generation (their engines are WASM and workers, and their weights are fetched) and
 * CodeHub's runtimes (workers again). `globalThis.__WAFFLE_FOLDER__` folds to true
 * here, and each guard sits immediately before the `await import()` it protects, so
 * those packages are not in this file at all. The 115 utilities, the art tools, the
 * catalogue and the games menu all work.
 *
 * `minify` and `target` are off for a boring reason: esbuild's child process was
 * killed by memory pressure in the sandbox partway through this bundle twice, taking
 * the build with it. This artifact is a 1 MB script inside a 228 MB archive; a
 * readable file that builds is worth more than a smaller one that does not.
 */
import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export const CLASSIC_OUT = 'dist-classic';
export const CLASSIC_ENTRY = 'kitchen.js';
export const CLASSIC_CSS = 'kitchen.css';
const STUB = path.resolve('folder-stubs/ai-vendor.js');
const FONTS_CSS = path.resolve('public/fonts/fonts.css');

/**
 * The site's five faces, with the woff2 inside them.
 *
 * `public/fonts/fonts.css` is copied rather than processed, so it reaches the
 * browser as `url(./nunito-latin-800-normal.woff2)`. A font is one of the things a
 * page off the disk cannot have: fonts are CORS-restricted, and a `file:` or
 * `content:` page has an opaque origin to satisfy them with, so all five come back
 * blocked. That is five red errors in the console for a kitchen that otherwise
 * works, and it is why the front page no longer links this sheet at all.
 *
 * 80 KB of woff2 becomes about 109 KB of base64 inside a stylesheet that ships in a
 * 228 MB archive, so the folder build keeps the site's own type instead of falling
 * back to whatever the device has. Missing files are a build failure, not a
 * silent `url()` that would 404 for somebody else later.
 */
export function inlineFonts(css) {
  const source = fs.readFileSync(FONTS_CSS, 'utf8');
  const missing = [];
  const inlined = source.replace(/url\(([^)]+)\)/g, (whole, ref) => {
    const name = String(ref).trim().replace(/^['"]|['"]$/g, '').replace(/^\.\//, '');
    const at = path.resolve(path.dirname(FONTS_CSS), name);
    if (!fs.existsSync(at)) {
      missing.push(name);
      return whole;
    }
    return `url(data:font/woff2;base64,${fs.readFileSync(at).toString('base64')})`;
  });
  if (missing.length) {
    throw new Error(`public/fonts/fonts.css points at files that are not in public/fonts: ${missing.join(', ')}`);
  }
  const faces = (inlined.match(/@font-face/g) || []).length;
  if (!faces) throw new Error('public/fonts/fonts.css has no @font-face in it, so there is nothing to inline');
  return { css: `${css}\n${inlined}\n`, faces, bytes: Buffer.byteLength(inlined) };
}

export default defineConfig({
  base: './',
  define: {
    'globalThis.__WAFFLE_FOLDER__': 'true'
  },
  resolve: {
    // The guards in the source are what make the app refuse politely. This is what
    // makes the bytes impossible to ship: every route to the three AI vendor
    // packages resolves to a 1 KB stub, so a guard that is missed, or a new import
    // site added later, costs a refusal that explains itself instead of 179 MB of
    // base64 WASM in the middle of an archive.
    alias: [
      { find: /^@huggingface\/transformers$/, replacement: STUB },
      { find: /^@wllama\/wllama$/, replacement: STUB },
      { find: /^@wllama\/wllama-compat$/, replacement: STUB },
      { find: /^onnxruntime-web(\/.*)?$/, replacement: STUB }
    ]
  },
  build: {
    outDir: CLASSIC_OUT,
    emptyOutDir: true,
    cssCodeSplit: false,
    // Fonts and icons become data: URLs. A page on the disk can still read its own
    // folder, but inlining means one less thing that can go wrong.
    assetsInlineLimit: 1024 * 1024,
    minify: false,
    cssMinify: false,
    target: 'esnext',
    reportCompressedSize: false,
    lib: {
      entry: path.resolve('app.js'),
      formats: ['iife'],
      name: 'BiteSizedUtilities',
      fileName: () => CLASSIC_ENTRY
    },
    rollupOptions: {
      output: { inlineDynamicImports: true }
    }
  },
  plugins: [
    {
      name: 'waffle-classic-report',
      enforce: 'post',
      // writeBundle rather than closeBundle: the chunk is right here in the bundle
      // object, and guessing the filename Rollup chose is how the first version of
      // this hook failed with ENOENT.
      writeBundle(_options, bundle) {
        const js = Object.values(bundle).find(f => f.type === 'chunk' && f.isEntry);
        if (!js) throw new Error('the folder build produced no entry chunk');
        const kb = n => `${(n / 1024).toFixed(1)} KB`;

        // Proof rather than trust, and a compile rather than a word search. A regex
        // for `import.meta` once matched this project's own release notes, which
        // describe that trap and so legitimately contain it; `vm.Script` asks the
        // real question, which is whether a browser can parse this as a classic
        // script. It rejects import.meta, import, export and top-level await, and
        // no string or comment can fake a pass.
        const fatal = [];
        try {
          new vm.Script(js.code, { filename: CLASSIC_ENTRY });
        } catch (err) {
          fatal.push(`does not parse as a classic script: ${err.message}`);
        }
        if (/AGFzbQ/.test(js.code)) fatal.push('contains base64 WASM, which is how it once reached 190 MB');
        if (!/__WAFFLE_FOLDER__|folderVendorStub|ships no AI engine/.test(js.code)) {
          fatal.push('the vendor stub is not in it, so the alias did not apply');
        }

        const css = Object.values(bundle).filter(f => f.type === 'asset' && f.fileName.endsWith('.css'));
        if (!css.length) throw new Error('the folder build produced no stylesheet');
        const styles = css.map(f => (typeof f.source === 'string' ? f.source : Buffer.from(f.source).toString('utf8'))).join('\n');
        const typed = inlineFonts(styles);
        fs.writeFileSync(path.resolve(CLASSIC_OUT, CLASSIC_CSS), typed.css);
        // Every url() must carry its bytes. Matched whole and then filtered rather
        // than written as `url\((?!data:)`: the quote is optional in CSS, so a
        // pattern that lets it be skipped lets the engine retry without consuming
        // it, and nine of the app's own inlined SVG backgrounds read as files.
        const external = (typed.css.match(/url\([^)]*\)/g) || []).filter(u => !/^url\(\s*['"]?data:/i.test(u));
        if (external.length) {
          fatal.push(`the stylesheet still points at ${external.length} file(s) instead of carrying them: ${external.slice(0, 3).join(', ')}`);
        }

        console.log(`[classic] folder kitchen → ${CLASSIC_OUT}/${CLASSIC_ENTRY} (${kb(js.code.length)} script, ${kb(typed.css.length)} style with ${typed.faces} faces inlined)`);
        console.log(`[classic] ${fatal.length ? 'BROKEN: ' + fatal.join('; ') : 'parses as a classic script, no WASM, AI engines stubbed out'}`);
        if (fatal.length) throw new Error(`kitchen.js is not usable from a folder: ${fatal.join('; ')}`);
      }
    }
  ]
});
