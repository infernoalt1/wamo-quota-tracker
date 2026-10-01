import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import net from 'node:net';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { setupVmRelay } from '../remote-desktop/relay.mjs';
import { startAgent } from '../remote-desktop/home/agent.mjs';
import { setupContactGame } from '../contact-game.js';
import { vmSettings } from '../remote-desktop/settings.mjs';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';

const password = 'test-access-password-very-long';
const agentToken = 'test-private-connector-token-0123456789';
async function harness(t, options = {}) {
  const app = express();
  const server = http.createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const env = { VM_PUBLIC_ORIGIN: origin, VM_ACCESS_PASSWORD: password, VM_AGENT_TOKEN: agentToken, ...options.env };
  const relay = setupVmRelay(app, server, { env, sessionMs: options.sessionMs || 60000 });
  const sockets = [];
  const game = setupContactGame(app, server, process.cwd());
  t.after(async () => { for (const ws of sockets) ws.terminate(); relay.dispose(); game.dispose(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const request = (route, body, cookie, requestOrigin = origin) => fetch(origin + '/api/vm/' + route, { method: body === undefined ? 'GET' : 'POST', headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json', Origin: requestOrigin }), ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const login = async () => { const response = await request('login', { password }); assert.equal(response.status, 200); return response.headers.get('set-cookie').split(';')[0]; };
  const open = (route, headers = {}) => {
    const ws = new WebSocket(origin.replace('http:', 'ws:') + route, { headers });
    sockets.push(ws);
    ws.on('error', () => {});
    return ws;
  };
  return { origin, request, login, open, relay };
}
async function rejection(ws) {
  return new Promise((resolve, reject) => { ws.on('unexpected-response', (_req, res) => { const status = res.statusCode; res.resume(); ws.terminate(); resolve(status); }); ws.on('open', () => reject(new Error('Unexpectedly authorized'))); });
}
async function waitFor(fn) { for (let i = 0; i < 100; i++) { if (await fn()) return; await new Promise(resolve => setTimeout(resolve, 10)); } assert.fail('Timed out waiting for state'); }

test('viewer stays on this site and drives noVNC without storing passwords', async t => {
  const dom = new JSDOM(fs.readFileSync('public/vm/index.html', 'utf8'), { url: 'https://quota.wamomath.org/vm/', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const w = dom.window;
  const $ = id => w.document.getElementById(id);
  let loggedIn = false, client;
  w.AbortSignal.timeout = () => undefined;
  w.fetch = async (url, options) => {
    if (url.endsWith('/config')) return Response.json({ configured: true, label: 'Home computer' });
    if (url.endsWith('/login')) { assert.equal(JSON.parse(options.body).password, 'site-password'); loggedIn = true; return Response.json({ authenticated: true }); }
    if (url.endsWith('/session')) return loggedIn ? Response.json({ online: true, busy: false }) : Response.json({ error: 'Sign in' }, { status: 401 });
    throw new Error('Unexpected request');
  };
  w.RFB = class extends w.EventTarget {
    constructor(target, url) { super(); client = this; this.target = target; this.url = url; }
    sendCredentials(credentials) { this.credentials = credentials; }
    focus() {}
    sendCtrlAltDel() { this.ctrlAltDel = true; }
    disconnect() { this.dispatchEvent(new w.CustomEvent('disconnect', { detail: { clean: true } })); }
  };
  w.eval(fs.readFileSync('public/vm/app.js', 'utf8').replace(/^\uFEFF?import RFB[^\n]*\n/, ''));
  await waitFor(() => !$('login-form').hidden);
  $('access-password').value = 'site-password';
  $('login-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await waitFor(() => !$('connect').disabled);
  assert.equal($('access-password').value, '');
  $('connect').click();
  assert.equal($('workspace').hidden, false);
  assert.equal(client.url, 'wss://quota.wamomath.org/api/vm/socket');
  assert.equal(w.document.querySelector('iframe'), null);
  client.dispatchEvent(new w.CustomEvent('credentialsrequired', { detail: { types: ['password'] } }));
  assert.equal($('vnc-form').hidden, false);
  $('vnc-password').value = 'vnc-password';
  $('vnc-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
  assert.equal(client.credentials.password, 'vnc-password');
  assert.equal($('vnc-password').value, '');
  assert.equal(w.localStorage.length, 0);
  $('ctrl-alt-del').click();
  assert.equal(client.ctrlAltDel, true);
  $('disconnect').click();
  assert.equal($('workspace').hidden, true);
  assert.equal($('landing').hidden, false);
});

 test('configuration fails closed without separate strong secrets and an HTTPS public origin', () => {
  assert.equal(vmSettings({}).configured, false);
  const good = { VM_PUBLIC_ORIGIN: 'https://quota.wamomath.org', VM_ACCESS_PASSWORD: password, VM_AGENT_TOKEN: agentToken, NODE_ENV: 'production' };
  assert.equal(vmSettings(good).configured, true);
  for (const override of [{ VM_ENABLED: 'false' }, { VM_AGENT_TOKEN: 'short' }, { VM_ACCESS_PASSWORD: 'short' }, { VM_PUBLIC_ORIGIN: 'http://example.com' }, { VM_PUBLIC_ORIGIN: 'https://example.com/path' }, { VM_PUBLIC_ORIGIN: 'https://user:pass@example.com' }, { VM_PUBLIC_ORIGIN: 'http://localhost:5173' }]) assert.equal(vmSettings({ ...good, ...override }).configured, false);
 });

 test('login has origin checks, rate limiting, HttpOnly cookies, and private status', async t => {
  const h = await harness(t);
  assert.equal((await h.request('session')).status, 401);
  assert.equal(await rejection(h.open('/api/vm/agent', { Authorization: 'Bearer wrong' })), 401);
  assert.equal(await rejection(h.open('/api/vm/socket', { Origin: h.origin })), 401);
  assert.equal((await h.request('login', { password }, null, 'https://attacker.example')).status, 403);
  const config = await (await h.request('config')).json();
  assert.equal(config.mode, 'embedded');
  assert.ok(!JSON.stringify(config).includes(agentToken));
  const login = await h.request('login', { password });
  assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await h.request('session', undefined, cookie)).status, 200);
  await h.request('logout', {}, cookie);
  assert.equal((await h.request('session', undefined, cookie)).status, 401);
  for (let i = 0; i < 9; i++) assert.equal((await h.request('login', { password: 'wrong' })).status, 401);
  assert.equal((await h.request('login', { password })).status, 429);
 });

 test('authenticated browser exchanges real TCP desktop bytes through the outbound home agent', async t => {
  const h = await harness(t);
  const cookie = await h.login();
  const tcpSockets = [];
  const vnc = net.createServer(socket => { tcpSockets.push(socket); socket.write('RFB 003.008\n'); socket.on('data', data => socket.write(Buffer.concat([Buffer.from('echo:'), data]))); });
  vnc.listen(0, '127.0.0.1'); await once(vnc, 'listening');
  const logs = [];
  const agent = startAgent({ website: h.origin, agentToken, vncPort: vnc.address().port }, { allowLocalTest: true, log: message => logs.push(message) });
  t.after(async () => { agent.stop(); for (const socket of tcpSockets) socket.destroy(); await new Promise(resolve => vnc.close(resolve)); });
  await waitFor(async () => (await (await h.request('session', undefined, cookie)).json()).online);
  assert.equal(await rejection(h.open('/api/vm/socket', { Cookie: cookie, Origin: 'https://attacker.example' })), 403);
  const viewer = h.open('/api/vm/socket', { Cookie: cookie, Origin: h.origin });
  const first = once(viewer, 'message');
  await once(viewer, 'open');
  assert.equal((await first)[0].toString(), 'RFB 003.008\n');
  const echo = once(viewer, 'message');
  viewer.send(Buffer.from('keyboard-and-mouse-packet'));
  assert.equal((await echo)[0].toString(), 'echo:keyboard-and-mouse-packet');
  assert.equal(await rejection(h.open('/api/vm/socket', { Cookie: cookie, Origin: h.origin })), 409);
  const gameSocket = h.open('/game/ws');
  await once(gameSocket, 'open');
  assert.equal(gameSocket.readyState, WebSocket.OPEN, 'existing game and desktop websocket routes coexist');
  const closed = once(viewer, 'close');
  await h.request('logout', {}, cookie);
  await closed;
  await waitFor(() => tcpSockets[0].destroyed);
  assert.ok(logs.every(line => !line.includes(agentToken)));
 });

 test('relay ignores stale frames and closes viewer when home connector disappears', async t => {
  const h = await harness(t);
  const cookie = await h.login();
  const agent = h.open('/api/vm/agent', { Authorization: `Bearer ${agentToken}` });
  await once(agent, 'open');
  const command = once(agent, 'message');
  const viewer = h.open('/api/vm/socket', { Cookie: cookie, Origin: h.origin });
  await once(viewer, 'open');
  const { id } = JSON.parse((await command)[0]);
  const messages = [];
  viewer.on('message', data => messages.push(data.toString()));
  agent.send(Buffer.concat([Buffer.alloc(16), Buffer.from('stale')]));
  agent.send(Buffer.concat([Buffer.from(id, 'hex'), Buffer.from('current')]));
  await waitFor(() => messages.length > 0);
  assert.deepEqual(messages, ['current']);
  const closed = once(viewer, 'close');
  agent.close();
  assert.equal((await closed)[0], 1011);
 });

 test('session expiration closes an active remote desktop connection', async t => {
  const h = await harness(t, { sessionMs: 250 });
  const cookie = await h.login();
  const agent = h.open('/api/vm/agent', { Authorization: `Bearer ${agentToken}` });
  await once(agent, 'open');
  const viewer = h.open('/api/vm/socket', { Cookie: cookie, Origin: h.origin });
  await once(viewer, 'open');
  assert.equal((await once(viewer, 'close'))[0], 1008);
  assert.equal((await h.request('session', undefined, cookie)).status, 401);
 });
