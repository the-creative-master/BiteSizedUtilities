#!/usr/bin/env node
/**
 * Fetch a model's GGUF onto this machine so the kitchen can run AI with no
 * Hugging Face dependency at all.
 *
 * Why this exists: the app can load a model from `api/waffle-ai/gguf/<file>`
 * (see `localGgufUrl` in waffle-browser-ai.js), but nothing ever put a file
 * there. In the browser the only source is huggingface.co, which fails outright
 * on networks that block it — and every runtime then reports the same opaque
 * "Failed to fetch". Run this once and the model is served from the same origin
 * as the app, so it works offline, in CI previews, and behind a firewall.
 *
 *   node scripts/fetch-model.mjs                 # SmolLM2 135M (the default)
 *   node scripts/fetch-model.mjs smollm2-360m    # any id from TEXT_MODELS
 *   node scripts/fetch-model.mjs --all-small     # every model under 1B params
 *   node scripts/fetch-model.mjs --max-mb=160    # stop when the total passes 160 MB
 *   node scripts/fetch-model.mjs --force         # re-download
 *
 * `--max-mb` (or `WAFFLE_SELF_HOST_MB`) is what a deploy uses: GitHub Pages
 * should stay well under 1 GB published, so CI pre-caches in table order until
 * the budget is spent. The default model comes first, so it is the one that
 * always makes the cut — and once a model is served from this origin, the
 * browser loads that copy before it ever asks Hugging Face and keeps it on the
 * device afterwards. No cross-origin request, no CORS preflight, no CDN left to
 * be blocked, which is the failure this app keeps meeting in the wild.
 *
 * Files land in .cache/waffle-ai/, which is gitignored: weights are not source
 * code and must not end up in git history. The production build copies whatever
 * is there into dist/ so a self-hosted deploy ships them too.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEXT_MODELS, QUANT_PRESETS } from '../waffle-browser-ai.js';

const HF_BASE = 'https://huggingface.co';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, '.cache', 'waffle-ai');

const DEFAULT_MODEL = 'smollm2-135m';
const DEFAULT_PRESET = 'compact';

const args = process.argv.slice(2);
const force = args.includes('--force');
const allSmall = args.includes('--all-small');
const presetId = (args.find(a => a.startsWith('--preset=')) || '').split('=')[1] || DEFAULT_PRESET;
const maxMbArg = (args.find(a => a.startsWith('--max-mb=')) || '').split('=')[1];
const envMb = Number(process.env.WAFFLE_SELF_HOST_MB);
const maxBytes = Number(maxMbArg) > 0 ? Number(maxMbArg) * 1024 ** 2
  : Number.isFinite(envMb) && envMb > 0 ? envMb * 1024 ** 2
  : Infinity;
const positional = args.filter(a => !a.startsWith('--'));

const fmtMB = b => (b > 0 ? `${(b / 1024 ** 2).toFixed(1)} MB` : '? MB');

function pickQuantFile(files, preferredQuants) {
  const gguf = files.filter(f => f.path?.toLowerCase().endsWith('.gguf') && f.type === 'file');
  if (!gguf.length) throw new Error('repo contains no .gguf files');
  // Sharded repos cannot be served as one local file, so skip them: the local
  // route streams a single path and a partial shard would load garbage.
  const single = gguf.filter(f => !/-\d{5}-of-\d{5}\.gguf$/i.test(f.path));
  const pool = single.length ? single : gguf;
  const bySize = [...pool].sort((a, b) => (a.size || Infinity) - (b.size || Infinity));
  for (const q of preferredQuants) {
    const hit = bySize.find(f => f.path.toUpperCase().includes(q.toUpperCase()));
    if (hit) return { file: hit, quant: q };
  }
  return { file: bySize[0], quant: bySize[0] ? 'smallest available' : null };
}

/**
 * Decide what fits before anything is downloaded. Sizes come from the repo tree
 * (an API call, a few hundred bytes), so a budget cut costs no bandwidth. A file
 * already on disk still counts against the budget: the build copies it into
 * dist/ whether or not this run downloaded it.
 */
export function planBudget(picks, budgetBytes = Infinity) {
  const take = [];
  const skip = [];
  let used = 0;
  for (const pick of picks) {
    const size = Number(pick.size) > 0 ? Number(pick.size) : 0;
    if (Number.isFinite(budgetBytes) && used + size > budgetBytes) {
      skip.push({ ...pick, size, reason: `${fmtMB(size)} would take the total past the ${fmtMB(budgetBytes)} budget` });
      continue;
    }
    used += size;
    take.push({ ...pick, size });
  }
  return { take, skip, used, budgetBytes };
}

async function fetchTree(repo) {
  const res = await fetch(`${HF_BASE}/api/models/${repo}/tree/main?recursive=true`, {
    headers: { Accept: 'application/json' }
  });
  if (!res.ok) throw new Error(`Hugging Face repo lookup failed (${res.status}) for ${repo}`);
  const files = await res.json();
  if (!Array.isArray(files)) throw new Error(`unexpected tree response for ${repo}`);
  return files;
}

async function download(url, dest, totalHint) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`download failed (${res.status}) for ${url}`);
  const total = Number(res.headers.get('content-length')) || totalHint || 0;
  if (!res.body) throw new Error('response has no body to stream');

  const tmp = `${dest}.part`;
  const out = fs.createWriteStream(tmp);
  let loaded = 0;
  let lastPrint = 0;
  try {
    for await (const chunk of res.body) {
      loaded += chunk.length;
      out.write(chunk);
      const now = Date.now();
      if (now - lastPrint > 400) {
        lastPrint = now;
        const pct = total > 0 ? ` ${Math.round((loaded / total) * 100)}%` : '';
        process.stdout.write(`\r    ${fmtMB(loaded)}${total ? ` / ${fmtMB(total)}` : ''}${pct}   `);
      }
    }
  } finally {
    out.end();
    await new Promise(r => out.once('close', r));
  }
  process.stdout.write('\r' + ' '.repeat(52) + '\r');
  fs.renameSync(tmp, dest);
  return loaded;
}

/** What would this model cost? Repo lookup only — no weights are downloaded. */
async function resolvePick(modelId) {
  const cfg = TEXT_MODELS.find(m => m.id === modelId);
  if (!cfg) {
    throw new Error(`unknown model "${modelId}". Known ids:\n  ${TEXT_MODELS.map(m => m.id).join('\n  ')}`);
  }
  if (!cfg.hfGgufRepo) throw new Error(`${modelId} has no GGUF source repo`);

  const dest = path.join(OUT_DIR, cfg.ggufFile);
  const preset = QUANT_PRESETS.find(q => q.id === presetId) || QUANT_PRESETS[0];
  const preferred = cfg.hfGgufQuant && !preset.ggufQuants.includes(cfg.hfGgufQuant)
    ? [...preset.ggufQuants, cfg.hfGgufQuant]
    : preset.ggufQuants;

  if (fs.existsSync(dest) && !force) {
    return { modelId, cfg, dest, preset, preferred, present: true, size: fs.statSync(dest).size, file: null, quant: null };
  }
  const files = await fetchTree(cfg.hfGgufRepo);
  const { file, quant } = pickQuantFile(files, preferred);
  if (!file) throw new Error(`no usable single-file GGUF in ${cfg.hfGgufRepo}`);
  return { modelId, cfg, dest, preset, preferred, present: false, size: file.size || 0, file, quant };
}

async function downloadPick(pick) {
  const { cfg, dest, file } = pick;
  if (pick.present) {
    console.log(`  ✓ ${cfg.label} already present (${fmtMB(pick.size)}) — skipping. Use --force to re-download.`);
    return { modelId: pick.modelId, skipped: true, dest };
  }
  const quant = pick.quant;
  const url = `${HF_BASE}/${cfg.hfGgufRepo}/resolve/main/${file.path}`;
  console.log(`  · ${cfg.label} ← ${cfg.hfGgufRepo} (${pick.preset.label})`);
  console.log(`    ${file.path} · ${quant} · ${fmtMB(file.size)}`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const bytes = await download(url, dest, file.size);

  // A truncated download would load as a corrupt model later, which is far
  // harder to diagnose than a failed one, so refuse to keep a short file.
  if (file.size > 0 && bytes < file.size) {
    fs.rmSync(dest, { force: true });
    throw new Error(`download was truncated (${fmtMB(bytes)} of ${fmtMB(file.size)}); removed the partial file`);
  }

  const manifestPath = path.join(OUT_DIR, 'models.json');
  let manifest = {};
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch {}
  manifest[cfg.hfGgufRepo] = {
    modelId: cfg.id,
    file: cfg.ggufFile,
    sourceFile: file.path,
    quant,
    sizeBytes: bytes,
    fetchedAt: new Date().toISOString()
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`  ✓ saved .cache/waffle-ai/${cfg.ggufFile} (${fmtMB(bytes)})`);
  return { modelId, skipped: false, dest, bytes };
}

export async function main({ budgetBytes = maxBytes, ids = null } = {}) {
  const wanted = ids
    || (allSmall
      ? TEXT_MODELS.filter(m => Number(m.params || 0) < 1).map(m => m.id)
      : (positional.length ? positional : [DEFAULT_MODEL]));

  const budgetNote = Number.isFinite(budgetBytes) ? `, ${fmtMB(budgetBytes)} budget` : '';
  console.log(`\nWaffle AI model fetch → .cache/waffle-ai/  (${wanted.length} model${wanted.length === 1 ? '' : 's'}${budgetNote})\n`);

  // Learn every price first, then decide what fits: stopping at the first model
  // that overflows would leave a smaller later one unserved for no reason.
  const failed = [];
  const picks = [];
  for (const id of wanted) {
    try {
      picks.push(await resolvePick(id));
    } catch (err) {
      failed.push({ id, message: String(err?.message || err) });
      console.error(`  ✗ ${id}: ${err?.message || err}`);
    }
  }
  const plan = planBudget(picks, budgetBytes);
  for (const skipped of plan.skip) {
    console.log(`  – ${skipped.cfg.label}: ${skipped.reason} — it will load from Hugging Face instead`);
  }

  let ok = 0;
  for (const pick of plan.take) {
    try {
      await downloadPick(pick);
      ok++;
    } catch (err) {
      failed.push({ id: pick.modelId, message: String(err?.message || err) });
      console.error(`  ✗ ${pick.modelId}: ${err?.message || err}`);
    }
  }

  console.log(`\nDone: ${ok}/${plan.take.length} present${plan.skip.length ? `, ${plan.skip.length} left to Hugging Face by budget` : ''} (${fmtMB(plan.used)} self-hosted).`);
  if (failed.length) {
    console.log('\nFailed:');
    for (const f of failed) console.log(`  · ${f.id} — ${f.message}`);
    // Only claim a network cause when the failures actually look like one — a
    // misspelled model id is a different problem and this hint would mislead.
    const looksLikeNetwork = failed.some(f => /fetch failed|network|enotfound|econnrefused|etimedout|getaddrinfo|certificate|4\d\d|5\d\d/i.test(f.message));
    if (looksLikeNetwork) {
      console.log('\nThese look like network failures: this machine cannot reach huggingface.co');
      console.log('(firewall, DNS, proxy, or an offline sandbox). The kitchen still works without');
      console.log('them — it falls back to downloading in the browser, which succeeds on a');
      console.log('network that can reach Hugging Face.');
    }
  } else {
    console.log('The kitchen now serves these from its own origin — no Hugging Face needed.');
    console.log('Restart the dev server if it is running, then open Waffle AI.\n');
  }
  process.exitCode = failed.length ? 1 : 0;
  return { ok, failed, plan };
}

export { pickQuantFile, OUT_DIR };

// Importable for tests: run only when executed as a script.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
