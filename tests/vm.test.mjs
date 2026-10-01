import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { getVmConfig } from '../remote-desktop/config.mjs';

test('remote desktop defaults to Google, supports disabling, and exposes no secrets', () => {
  assert.deepEqual(getVmConfig({}), { configured: true, label: 'Home computer', gatewayUrl: 'https://remotedesktop.google.com/access/' });
  assert.equal(getVmConfig({ VM_GATEWAY_URL: ' ' }).gatewayUrl, 'https://remotedesktop.google.com/access/');
  assert.deepEqual(getVmConfig({ VM_ENABLED: 'false' }), { configured: false, label: 'Home computer', reason: 'disabled' });
  const config = getVmConfig({ VM_GATEWAY_URL: ' https://desktop.wamomath.org/ ', VM_COMPUTER_NAME: 'My PC', JWT_SECRET: 'private', DATABASE_URL: 'private' });
  assert.deepEqual(config, { configured: true, label: 'My PC', gatewayUrl: 'https://desktop.wamomath.org/' });
  assert.ok(!JSON.stringify(config).includes('private'));
});

test('rejects insecure URLs, credentials, tokens, and local addresses', () => {
  for (const url of ['http://desktop.example.com', 'javascript:alert(1)', '//desktop.example.com', 'https://user:password@desktop.example.com', 'https://desktop.example.com/?token=private', 'https://desktop.example.com/#token', 'https://localhost', 'https://127.0.0.1', 'https://[::1]', 'not a url']) {
    const config = getVmConfig({ VM_GATEWAY_URL: url });
    assert.equal(config.configured, false, url);
    assert.equal(config.gatewayUrl, undefined);
  }
});

async function launch(t, fetcher) {
  const dom = new JSDOM(fs.readFileSync('public/vm/index.html', 'utf8'), { url: 'https://quota.wamomath.org/vm/', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  dom.window.fetch = fetcher;
  dom.window.AbortSignal.timeout = () => undefined;
  dom.window.eval(fs.readFileSync('public/vm/app.js', 'utf8'));
  for (let i = 0; i < 50 && dom.window.document.getElementById('badge').textContent === 'CHECKING SETUP'; i++) await new Promise(resolve => setTimeout(resolve, 5));
  return id => dom.window.document.getElementById(id);
}
const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });

test('disabled UI offers setup without an active remote link', async t => {
  const $ = await launch(t, async () => json(getVmConfig({ VM_ENABLED: 'false' })));
  assert.equal($('badge').textContent, 'SETUP REQUIRED');
  assert.equal($('connect').hidden, true);
  assert.equal($('connect').hasAttribute('href'), false);
  assert.equal($('setup').hidden, false);
});

test('default UI opens Google and explains that home enrollment is still needed', async t => {
  const $ = await launch(t, async () => json(getVmConfig({})));
  assert.equal($('badge').textContent, 'GOOGLE SIGN-IN');
  assert.equal($('connect').href, 'https://remotedesktop.google.com/access/');
  assert.equal($('connect').textContent, 'Open Chrome Remote Desktop ↗');
  assert.equal($('connect').hidden, false);
  assert.match($('status').textContent, /Complete home setup first/);
});

test('configured UI links to a separate authenticated origin without claiming host availability', async t => {
  const $ = await launch(t, async (url, options) => {
    assert.equal(url, '/api/vm/config');
    assert.equal(options.cache, 'no-store');
    return json(getVmConfig({ VM_GATEWAY_URL: 'https://desktop.wamomath.org/', VM_COMPUTER_NAME: '<img src=x onerror=alert(1)>' }));
  });
  assert.equal($('badge').textContent, 'GATEWAY CONFIGURED');
  assert.equal($('connect').href, 'https://desktop.wamomath.org/');
  assert.equal($('connect').target, '_blank');
  assert.match($('connect').rel, /noopener/);
  assert.equal($('computer-name').children.length, 0);
  assert.match($('status').textContent, /check whether/);
});

test('backend outages, SPA fallback HTML, and unsafe responses offer retry', async t => {
  for (const response of [new Response('outage', { status: 503 }), new Response('<html>fallback</html>', { headers: { 'Content-Type': 'text/html' } }), json({ configured: true, gatewayUrl: 'javascript:alert(1)' })]) {
    const $ = await launch(t, async () => response);
    assert.equal($('badge').textContent, 'SETUP UNAVAILABLE');
    assert.equal($('connect').hidden, true);
    assert.equal($('retry').hidden, false);
  }
});
