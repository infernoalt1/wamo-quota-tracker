export const CACHE_PREFIX = 'wamo-hollowknight-';
export const assetUrl = path => new URL(path, new URL('/hollowknight/', globalThis.location?.origin || 'https://localhost')).href;
export function assetCacheName(manifest) { return CACHE_PREFIX + 'assets-' + manifest.assetVersion; }
export async function inspectCache(cache, manifest) {
  const keys = new Set((await cache.keys()).map(key => key.url));
  const present = manifest.assets.filter(asset => keys.has(assetUrl(asset.path)));
  return { present, bytes: present.reduce((sum, asset) => sum + asset.size, 0), complete: present.length === manifest.assets.length };
}
export async function downloadAsset(cache, asset, signal, onProgress = () => {}, fetcher = fetch) {
  const url = assetUrl(asset.path);
  // Fully written entries survive cancellation; incomplete responses are never stored.
  const existing = await cache.match(url);
  if (existing) return;
  const response = await fetcher(url, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${asset.path}`);
  const chunks = [];
  let received = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      onProgress(received);
    }
  } finally { reader.releaseLock(); }
  if (received !== asset.size) throw new Error(`Incomplete file: ${asset.path}. Retry to resume.`);
  const blob = new Blob(chunks, { type: asset.type });
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(value => value.toString(16).padStart(2, '0')).join('');
  if (hash !== asset.sha256) throw new Error(`File verification failed: ${asset.path}. Retry to resume.`);
  signal?.throwIfAborted();
  await cache.put(url, new Response(blob, { headers: { 'Content-Type': asset.type, 'Content-Length': String(asset.size) } }));
}
export async function rangeResponse(response, range) {
  const blob = await response.blob();
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  const invalid = () => new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${blob.size}` } });
  if (!match || (!match[1] && !match[2])) return invalid();
  let start = match[1] ? Number(match[1]) : Math.max(0, blob.size - Number(match[2]));
  let end = match[1] && match[2] ? Math.min(Number(match[2]), blob.size - 1) : blob.size - 1;
  if (start > end || start >= blob.size) return invalid();
  return new Response(blob.slice(start, end + 1, blob.type), { status: 206, headers: { 'Content-Type': blob.type, 'Content-Range': `bytes ${start}-${end}/${blob.size}`, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' } });
}
