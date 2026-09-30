import { assetCacheName, inspectCache, downloadAsset } from './cache-core.js';

const manifest = globalThis.HK_MANIFEST;
const $ = id => document.getElementById(id);
const format = bytes => bytes >= 1e9 ? (bytes / 1e9).toFixed(2) + ' GB' : (bytes / 1e6).toFixed(1) + ' MB';
let cache, installed, controller, busy = false, unity, urls = [], starting = false;
const total = manifest.assets.reduce((sum, asset) => sum + asset.size, 0);
$('size').textContent = format(total);
function status(heading, message, badge) {
  $('heading').textContent = heading;
  $('status').textContent = message;
  $('badge').textContent = badge;
}
function connection() { $('connection').textContent = navigator.onLine ? '● Online' : '○ Offline'; }
connection();
window.addEventListener('online', connection);
window.addEventListener('offline', connection);
async function storage() {
  const estimate = await navigator.storage?.estimate?.();
  $('storage').textContent = estimate?.quota ? format(Math.max(0, estimate.quota - estimate.usage)) : 'Not reported';
  if (await navigator.storage?.persisted?.()) $('storage-note').textContent = 'Persistent storage enabled. Files are protected from automatic storage cleanup.';
  return estimate;
}
async function refresh() {
  installed = await inspectCache(cache, manifest);
  $('progress').value = installed.bytes / total * 100;
  $('amount').textContent = `${format(installed.bytes)} / ${format(total)}`;
  $('speed').textContent = `${installed.present.length} / ${manifest.assets.length} files`;
  $('cache-state').textContent = installed.complete ? 'Ready offline' : installed.bytes ? 'Partial download' : 'Not installed';
  $('primary').textContent = installed.complete ? 'PLAY HOLLOW KNIGHT  →' : installed.bytes ? 'RESUME DOWNLOAD  ↓' : 'DOWNLOAD & PREPARE  ↓';
  $('primary').disabled = false;
  $('clear').disabled = installed.present.length === 0;
  $('protect').disabled = !navigator.storage?.persist;
  if (installed.complete) status('Your kingdom awaits', 'All game files are stored on this device. Launch without downloading them again.', 'READY TO PLAY');
  else status(installed.bytes ? 'Pick up where you left off' : 'Make room for an adventure', `${format(total)} stored locally, including cutscenes. Download once, then play from this browser’s cache.`, installed.bytes ? 'PAUSED' : 'NOT INSTALLED');
  await storage();
}
function lock(value) {
  busy = value;
  $('primary').disabled = value;
  $('clear').disabled = value || !installed?.present.length;
  $('protect').disabled = value || !navigator.storage?.persist;
}
async function download() {
  lock(true);
  controller = new AbortController();
  const signal = controller.signal;
  let failure;
  try {
    const estimate = await storage();
    if (estimate?.quota && estimate.quota - estimate.usage < total - installed.bytes + 50e6) throw new Error('Not enough browser storage. Free some disk space or use another browser, then retry.');
    try { await navigator.storage?.persist?.(); } catch { /* Persistence is optional. */ }
    $('pause').hidden = false;
    status('Bringing Hallownest to you', 'Downloading and verifying game files. You can pause and resume at any time.', 'DOWNLOADING');
    const completed = new Set(installed.present.map(asset => asset.path));
    const queue = manifest.assets.filter(asset => !completed.has(asset.path));
    const progress = new Map();
    const baseBytes = installed.bytes;
    const started = performance.now();
    let next = 0;
    const report = () => {
      const bytes = [...progress.values()].reduce((sum, value) => sum + value, 0);
      const rate = bytes / Math.max(1, (performance.now() - started) / 1000);
      const remaining = Math.max(0, total - baseBytes - bytes);
      $('progress').value = (baseBytes + bytes) / total * 100;
      $('amount').textContent = `${format(baseBytes + bytes)} / ${format(total)}`;
      $('speed').textContent = `${format(rate)}/s · ${Math.ceil(remaining / Math.max(rate, 1) / 60)} min left`;
    };
    const worker = async () => {
      while (next < queue.length && !signal.aborted) {
        const asset = queue[next++];
        try {
          await downloadAsset(cache, asset, signal, bytes => { progress.set(asset.path, bytes); report(); });
        } catch (error) { if (!signal.aborted) { failure = error; controller.abort(); } return; }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if (failure) throw failure;
    await refresh();
    if (!installed.complete) status('Download paused', 'Completed files are safe. Resume to download the remaining files.', 'PAUSED');
  } catch (error) {
    await refresh();
    status('Download needs attention', error.name === 'QuotaExceededError' ? 'Browser storage is full. Free space and resume; completed files have been kept.' : error.message, 'RETRY AVAILABLE');
  } finally { controller = null; $('pause').hidden = true; lock(false); }
}
async function assemble(suffix, type) {
  const assets = manifest.assets.filter(asset => asset.path.includes(suffix + '.part')).sort((a, b) => Number(a.path.split('.part')[1]) - Number(b.path.split('.part')[1]));
  const parts = [];
  for (const asset of assets) {
    const response = await cache.match(new URL(asset.path, document.baseURI));
    if (!response) throw new Error('A cached game file is missing. Return to the launcher and resume the download.');
    parts.push(await response.blob());
  }
  const url = URL.createObjectURL(new Blob(parts, { type }));
  urls.push(url);
  return url;
}
async function start() {
  if (starting) return;
  starting = true;
  lock(true);
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    if (!gl) throw new Error('WebGL 2 is unavailable. Enable hardware acceleration or try a supported desktop browser.');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    status('Opening the gates', 'Reading local files and starting Unity. This can take a moment even with a full cache.', 'STARTING ENGINE');
    const dataUrl = await assemble('.data', 'application/octet-stream');
    const codeUrl = await assemble('.wasm', 'application/wasm');
    if (!window.createUnityInstance) await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'Build/Glitches HK.loader.js';
      script.onload = resolve;
      script.onerror = () => { script.remove(); reject(new Error('Could not load the game engine. Retry after checking your cache.')); };
      document.body.append(script);
    });
    // Keep a full-size canvas behind the launcher while Unity initializes.
    $('game').hidden = false;
    $('game').style.visibility = 'hidden';
    unity = await window.createUnityInstance($('unity-canvas'), {
      dataUrl, codeUrl, frameworkUrl: new URL('Build/Glitches HK.framework.js', document.baseURI).href,
      streamingAssetsUrl: new URL('StreamingAssets', document.baseURI).href,
      companyName: 'Stratus Dev Ports', productName: 'Hollow Knight', productVersion: 'Perfect Port',
      autoSyncPersistentDataPath: true,
      cacheControl: () => 'no-store',
      showBanner: (message, type) => { if (type === 'error') status('Engine message', String(message), 'ENGINE ERROR'); },
    }, progress => { $('progress').value = progress * 100; $('speed').textContent = `Engine ${Math.round(progress * 100)}%`; });
    $('game').style.visibility = '';
    $('launcher').hidden = true;
    $('unity-canvas').focus();
    urls.forEach(url => URL.revokeObjectURL(url)); urls = [];
  } catch (error) {
    $('game').hidden = true;
    $('game').style.visibility = '';
    urls.forEach(url => URL.revokeObjectURL(url)); urls = [];
    await refresh();
    status('The game could not start', String(error.message || error) + ' Close other tabs to free memory, then reload and retry.', 'STARTUP FAILED');
  } finally { starting = false; lock(false); }
}
$('primary').onclick = () => { if (!busy) (installed.complete ? start() : download()); };
$('pause').onclick = () => controller?.abort();
$('protect').onclick = async () => {
  try {
    const granted = await navigator.storage.persist();
    $('storage-note').textContent = granted ? 'Persistent storage enabled. Files are protected from automatic storage cleanup.' : 'Your browser did not grant persistent storage. The cache still works but may be cleared when space is low.';
  } catch { $('storage-note').textContent = 'Persistent storage is unavailable in this browser.'; }
};
$('clear').onclick = () => { $('clear-confirm').hidden = false; };
$('cancel-clear').onclick = () => { $('clear-confirm').hidden = true; };
$('confirm-clear').onclick = async () => {
  if (busy) return;
  lock(true);
  try {
    // Only this game's asset caches. Never touch IndexedDB game saves or other apps.
    for (const key of await caches.keys()) if (key.startsWith('wamo-hollowknight-assets-')) await caches.delete(key);
    cache = await caches.open(assetCacheName(manifest));
    $('clear-confirm').hidden = true;
    await refresh();
  } catch (error) { status('Unable to clear files', error.message, 'CACHE ERROR'); }
  finally { lock(false); }
};
$('fullscreen').onclick = () => $('game').requestFullscreen?.().catch(() => {});
$('exit').onclick = async () => {
  $('exit').disabled = true;
  try { await unity?.Quit(); location.reload(); }
  catch { $('exit').disabled = false; $('exit').textContent = 'Reload page to exit'; $('exit').onclick = () => location.reload(); }
};
async function init() {
  try {
    if (!window.isSecureContext || !('serviceWorker' in navigator) || !('caches' in window)) throw new Error('Caching requires HTTPS (or localhost) and a browser with service workers. Open this site over HTTPS.');
    const alreadyControlled = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (alreadyControlled && !busy && !unity) location.reload(); });
    await navigator.serviceWorker.register('/hollowknight/sw.js', { scope: '/hollowknight/', type: 'module', updateViaCache: 'none' });
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    cache = await caches.open(assetCacheName(manifest));
    await refresh();
  } catch (error) { status('Launcher unavailable', error.message, 'SETUP REQUIRED'); $('primary').textContent = 'RELOAD TO RETRY'; $('primary').disabled = false; $('primary').onclick = () => location.reload(); }
}
init();
