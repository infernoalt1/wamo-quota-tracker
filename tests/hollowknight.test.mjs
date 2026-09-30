import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { assetUrl, assetCacheName, inspectCache, downloadAsset, rangeResponse, CACHE_PREFIX } from '../public/hollowknight/cache-core.js';

class MemoryCache {
  entries = new Map();
  async keys() { return [...this.entries.keys()].map(url => ({ url })); }
  async match(key) { return this.entries.get(String(key.url || key))?.clone(); }
  async put(key, response) { this.entries.set(String(key.url || key), response.clone()); }
}
function fixture(name, body) {
  return { path: name, size: Buffer.byteLength(body), sha256: createHash('sha256').update(body).digest('hex'), type: 'application/octet-stream' };
}

test('verified downloads survive resume and do not refetch cached files', async () => {
  const cache = new MemoryCache();
  const asset = fixture('Build/test.part1', 'first chunk');
  const controller = new AbortController();
  let requests = 0;
  let progress = 0;
  const fetcher = async () => { requests++; return new Response('first chunk'); };
  await downloadAsset(cache, asset, controller.signal, bytes => progress = bytes, fetcher);
  assert.equal(progress, asset.size);
  await downloadAsset(cache, asset, controller.signal, () => {}, fetcher);
  assert.equal(requests, 1);
  const manifest = { assetVersion: 'one', assets: [asset, fixture('Build/test.part2', 'next')] };
  const partial = await inspectCache(cache, manifest);
  assert.equal(partial.complete, false);
  assert.equal(partial.bytes, asset.size);
  await downloadAsset(cache, manifest.assets[1], controller.signal, () => {}, async () => new Response('next'));
  assert.equal((await inspectCache(cache, manifest)).complete, true);
});

test('HTTP errors, truncated files, corruption, and cancellation never mark files ready', async () => {
  const cache = new MemoryCache();
  const asset = fixture('Build/fail.part1', 'good');
  for (const [response, expected] of [[new Response('missing', { status: 404 }), /404/], [new Response('bad'), /Incomplete/], [new Response('evil'), /verification/]]) {
    await assert.rejects(downloadAsset(cache, asset, new AbortController().signal, () => {}, async () => response), expected);
    assert.equal((await cache.keys()).length, 0);
  }
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(downloadAsset(cache, asset, controller.signal, () => {}, async () => new Response('good')), { name: 'AbortError' });
  assert.equal((await cache.keys()).length, 0);
});

test('cached cutscenes support normal, open-ended, suffix, and invalid byte ranges', async () => {
  const response = () => new Response('0123456789', { headers: { 'Content-Type': 'video/mp4' } });
  for (const [range, text, header] of [['bytes=2-5', '2345', 'bytes 2-5/10'], ['bytes=7-', '789', 'bytes 7-9/10'], ['bytes=-3', '789', 'bytes 7-9/10'], ['bytes=8-99', '89', 'bytes 8-9/10']]) {
    const result = await rangeResponse(response(), range);
    assert.equal(result.status, 206);
    assert.equal(await result.text(), text);
    assert.equal(result.headers.get('content-range'), header);
    assert.equal(result.headers.get('content-type'), 'video/mp4');
  }
  for (const range of ['bytes=20-', 'bytes=8-2', 'bytes=-0', 'bytes=-', 'invalid', 'bytes=0-1,3-5']) assert.equal((await rangeResponse(response(), range)).status, 416);
});

test('manifest covers every bundled asset and keeps launcher updates separate', () => {
  const root = path.resolve('public/hollowknight');
  const context = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'manifest.js'), 'utf8'), context);
  const manifest = context.HK_MANIFEST;
  assert.equal(manifest.assets.filter(asset => /\.data\.part\d+$/.test(asset.path)).length, 44);
  assert.equal(manifest.assets.filter(asset => /\.wasm\.part\d+$/.test(asset.path)).length, 3);
  for (const asset of manifest.assets) {
    assert.equal(fs.statSync(path.join(root, asset.path)).size, asset.size, asset.path);
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);
  }
  assert.equal(assetCacheName(manifest), assetCacheName({ ...manifest, version: 'new-launcher' }));
  const shellHash = createHash('sha256').update(manifest.assetVersion);
  for (const name of ['index.html', 'launcher.js', 'launcher.css', 'cache-core.js', 'sw.js']) shellHash.update(fs.readFileSync(path.join(root, name)));
  assert.equal(manifest.version, shellHash.digest('hex').slice(0, 16), 'regenerate manifest after editing launcher');
});

test('service worker serves cached game assets, ranged movies, and offline navigation within its scope', async () => {
  const asset = fixture('StreamingAssets/test.mp4', 'movie-data');
  const manifest = { version: 'shell', assetVersion: 'game', assets: [asset] };
  const assets = new MemoryCache();
  const shell = new MemoryCache();
  await assets.put(assetUrl(asset.path), new Response('movie-data', { headers: { 'Content-Type': 'video/mp4' } }));
  await shell.put(assetUrl('index.html'), new Response('offline launcher'));
  const handlers = {};
  const context = {
    HK_MANIFEST: manifest, assetCacheName, assetUrl, CACHE_PREFIX, rangeResponse, URL, Request,
    caches: { open: async name => name.includes('assets-') ? assets : shell },
    self: { location: { origin: 'https://localhost' }, addEventListener: (name, handler) => handlers[name] = handler },
    fetch: () => { throw new Error('Unexpected network access'); },
  };
  vm.runInNewContext(fs.readFileSync('public/hollowknight/sw.js', 'utf8').replace(/^import .*;\r?\n/gm, ''), context);
  async function dispatch(request) {
    let response;
    handlers.fetch({ request, respondWith: value => response = value });
    return response;
  }
  assert.equal(await (await dispatch(new Request(assetUrl(asset.path)))).text(), 'movie-data');
  const range = await dispatch(new Request(assetUrl(asset.path), { headers: { Range: 'bytes=0-4' } }));
  assert.equal(range.status, 206);
  assert.equal(await range.text(), 'movie');
  assert.equal(await (await dispatch({ method: 'GET', url: assetUrl(''), mode: 'navigate' })).text(), 'offline launcher');
  assert.equal(await dispatch(new Request('https://localhost/compiler')), undefined);
});

test('launcher downloads, becomes ready, and reopens ready without downloading again', async t => {
  const root = path.resolve('public/hollowknight');
  const contents = new Map([['Build/test.data.part1', 'data'], ['Build/test.wasm.part1', 'wasm']]);
  const manifest = { version: 'ui', assetVersion: 'ui-assets', assets: [...contents].map(([name, body]) => fixture(name, body)) };
  const cache = new MemoryCache();
  let downloads = 0;
  let engineConfig;
  const deletedCaches = [];
  async function waitFor(predicate) {
    for (let attempt = 0; attempt < 100; attempt++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
    assert.fail('Launcher did not reach expected state');
  }
  function open() {
    const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), { url: 'https://localhost/hollowknight/', runScripts: 'outside-only', pretendToBeVisual: true });
    t.after(() => dom.window.close());
    const w = dom.window;
    Object.defineProperty(w, 'isSecureContext', { value: true });
    Object.defineProperty(w.navigator, 'serviceWorker', { value: { controller: {}, addEventListener() {}, register: async () => ({}), ready: Promise.resolve({}) } });
    Object.defineProperty(w.navigator, 'storage', { value: { estimate: async () => ({ quota: 2e9, usage: 0 }), persisted: async () => false, persist: async () => false } });
    w.HK_MANIFEST = manifest;
    w.caches = {
      open: async () => cache,
      keys: async () => [assetCacheName(manifest), 'wamo-hollowknight-assets-old', 'another-app', 'wamo-hollowknight-shell-ui'],
      delete: async name => { deletedCaches.push(name); cache.entries.clear(); return true; },
    };
    w.assetCacheName = assetCacheName;
    w.inspectCache = inspectCache;
    w.downloadAsset = (target, asset, signal, progress) => downloadAsset(target, asset, signal, progress, async () => { downloads++; return new Response(contents.get(asset.path)); });
    w.URL.createObjectURL = () => 'blob:test';
    w.URL.revokeObjectURL = () => {};
    w.HTMLCanvasElement.prototype.getContext = () => ({ getExtension: () => null });
    w.createUnityInstance = async (canvas, config, progress) => { engineConfig = config; progress(1); return { Quit: async () => {} }; };
    w.eval(fs.readFileSync(path.join(root, 'launcher.js'), 'utf8').replace(/^import .*;\r?\n/gm, ''));
    return w;
  }
  const first = open();
  await waitFor(() => first.document.getElementById('badge').textContent === 'NOT INSTALLED');
  first.document.getElementById('primary').click();
  await waitFor(() => first.document.getElementById('badge').textContent === 'READY TO PLAY' && !first.document.getElementById('primary').disabled);
  assert.equal(downloads, 2);
  const second = open();
  await waitFor(() => second.document.getElementById('badge').textContent === 'READY TO PLAY');
  second.document.getElementById('primary').click();
  await waitFor(() => second.document.getElementById('launcher').hidden);
  assert.equal(downloads, 2, 'warm launch must not fetch installed files');
  assert.equal(engineConfig.streamingAssetsUrl, 'https://localhost/hollowknight/StreamingAssets');
  assert.equal(engineConfig.autoSyncPersistentDataPath, true);
  assert.equal(second.document.getElementById('game').hidden, false);
  first.localStorage.setItem('game-save', 'keep-me');
  first.document.getElementById('clear').click();
  assert.equal(first.document.getElementById('clear-confirm').hidden, false);
  first.document.getElementById('confirm-clear').click();
  await waitFor(() => first.document.getElementById('badge').textContent === 'NOT INSTALLED');
  assert.equal(first.localStorage.getItem('game-save'), 'keep-me');
  assert.deepEqual(deletedCaches, [assetCacheName(manifest), 'wamo-hollowknight-assets-old']);
});
