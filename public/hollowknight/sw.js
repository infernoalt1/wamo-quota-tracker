import './manifest.js';
import { assetCacheName, assetUrl, CACHE_PREFIX, rangeResponse } from './cache-core.js';

const manifest = globalThis.HK_MANIFEST;
const shellCache = CACHE_PREFIX + 'shell-' + manifest.version;
const shell = ['index.html', 'launcher.css', 'launcher.js', 'cache-core.js', 'manifest.js', 'TemplateData/favicon.ico'].map(assetUrl);
const assets = new Set(manifest.assets.map(asset => assetUrl(asset.path)));
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(shellCache);
    await cache.addAll(shell.map(url => new Request(url, { cache: 'reload' })));
    // Updates wait for existing game tabs to close, keeping their engine and cache in sync.
  })());
});
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || (url.pathname !== '/hollowknight' && !url.pathname.startsWith('/hollowknight/'))) return;
  if (assets.has(url.href)) {
    event.respondWith((async () => {
      const cached = await (await caches.open(assetCacheName(manifest))).match(url.href);
      if (!cached) return fetch(request);
      return request.headers.has('range') ? rangeResponse(cached, request.headers.get('range')) : cached;
    })());
  } else if (request.mode === 'navigate' || shell.includes(url.href)) {
    event.respondWith((async () => {
      const key = request.mode === 'navigate' ? assetUrl('index.html') : url.href;
      const cached = await (await caches.open(shellCache)).match(key);
      return cached || fetch(request);
    })());
  }
});
