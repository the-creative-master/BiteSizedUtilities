/**
 * Where the offline zip lives, and how the button that downloads it says how big
 * it is.
 *
 * The zip is a GitHub release asset, not a file on the site. Two reasons, both
 * measured rather than guessed. At 224 MB it would take the Pages site from
 * 437 MB to 661 MB against a 1 GB soft limit, and every deploy would upload it
 * again; and every download would come out of the site's own 100 GB a month,
 * which is roughly 440 downloads. A release asset is stored and served by
 * GitHub's release CDN instead, costs the site nothing, and allows 2 GB.
 *
 * This module is browser-safe on purpose — no `node:` imports, nothing that reads
 * the filesystem — because scripts/make-offline-zip.mjs imports *these* constants
 * rather than the other way round. The dependency has to point that way: the
 * builder needs Node, and the button is bundled into the kitchen.
 */

export const OFFLINE_ZIP_NAME = 'BiteSizedUtilities-offline.zip';
export const OFFLINE_ZIP_RELEASE_TAG = 'offline-zip';

/** Written next to the site by the builder, and read back to label the button. */
export const OFFLINE_ZIP_META_PATH = './offline-zip.json';

/** Used when the page is not on Pages — a local build, `npm run dev`, a test. */
export const FALLBACK_REPO = 'the-creative-master/BiteSizedUtilities';

/**
 * The download URL for the zip belonging to *this* site.
 *
 * Derived from the Pages origin rather than hardcoded, so a fork points at its own
 * release instead of handing out somebody else's zip — a fork's CI rebuilds the
 * archive from its own dist, and the two would otherwise disagree. On Pages the
 * owner is the subdomain and the repository is the first path segment.
 */
/** The asset URL for a repository. The builder needs this too, hence its own function. */
export function releaseDownloadUrl(repo = FALLBACK_REPO, name = OFFLINE_ZIP_NAME, tag = OFFLINE_ZIP_RELEASE_TAG) {
  return `https://github.com/${repo}/releases/download/${tag}/${name}`;
}

export function offlineZipUrl(loc = (typeof location === 'undefined' ? undefined : location)) {
  const m = /^https?:\/\/([a-z0-9-]+)\.github\.io\/([^/?#]+)/i.exec(loc?.href || '');
  return releaseDownloadUrl(m ? `${m[1]}/${m[2]}` : FALLBACK_REPO);
}

const MB = 1024 * 1024;

/**
 * Put the real size on the button once it is known.
 *
 * The kitchen is built before the zip exists, so no build step can bake the number
 * in — it would be last deploy's number anyway, since the site grows. The builder
 * writes `offline-zip.json` into dist after the archive is closed, and this reads
 * it back. Everything about it is optional: if the file is not there, is stale, or
 * the fetch fails, the button still downloads and simply does not quote a size.
 *
 * A 224 MB download that arrives unannounced, on a metered connection, is the
 * whole reason this exists.
 */
export async function annotateOfflineZipButton(doc = (typeof document === 'undefined' ? undefined : document)) {
  const link = doc?.querySelector?.('[data-offline-zip]');
  if (!link) return null;
  try {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 4000) : null;
    let res;
    try {
      res = await fetch(OFFLINE_ZIP_META_PATH, { cache: 'no-store', signal: controller?.signal });
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (!res.ok) return null;
    const meta = await res.json();
    if (!meta || typeof meta.bytes !== 'number' || meta.bytes <= 0) return null;

    const size = link.querySelector('[data-offline-zip-size]');
    if (size) size.textContent = ` · ${Math.round(meta.bytes / MB)} MB`;
    const parts = [];
    if (typeof meta.files === 'number') parts.push(`${meta.files} files`);
    if (typeof meta.extractedBytes === 'number') parts.push(`${Math.round(meta.extractedBytes / MB)} MB extracted`);
    if (meta.weights && typeof meta.weights.bytes === 'number') parts.push(`${Math.round(meta.weights.bytes / MB)} MB of model weights`);
    if (typeof meta.builtAt === 'string') parts.push(`built ${meta.builtAt.slice(0, 10)}`);
    if (parts.length) link.title = `The entire site in one zip: ${parts.join(', ')}. Needs a computer to run.`;
    return meta;
  } catch {
    return null;
  }
}
