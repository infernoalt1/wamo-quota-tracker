// Hanbin Island: HTTP routes, accounts and the WebSocket game server, mounted at /eldyn.
import express from 'express';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { Game, TICK } from './engine.mjs';
import { accountService, defaultStore } from './accounts.mjs';

const FILES = { '': 'index.html', 'index.html': 'index.html', 'client.mjs': 'client.mjs', 'shared.mjs': 'shared.mjs', 'sprites.mjs': 'sprites.mjs', 'style.css': 'style.css' };
const TYPES = { html: 'text/html; charset=utf-8', mjs: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8' };
const SAVE_EVERY = 15000;

export function setupEldyn(app, server, { store = defaultStore(), now = () => Date.now() } = {}) {
  const accounts = accountService(store);
  let game = null, loading = null;
  const load = () => (loading ||= store.loadWorld().then((world) => { game = new Game({ world: world || {}, now }); }).catch((e) => { loading = null; console.error('Hanbin Island: could not load the world:', e.message); throw e; }));
  load().catch(() => {});

  // ---------------------------------------------------------------- pages
  app.get('/eldyn', (req, res, next) => (req.originalUrl.split('?')[0].endsWith('/') ? next() : res.redirect(308, '/eldyn/')));
  app.get('/eldyn/:file?', (req, res, next) => {
    const name = FILES[req.params.file || ''];
    if (!name) return next();
    res.setHeader('Content-Type', TYPES[name.split('.').pop()]);
    res.setHeader('Cache-Control', 'no-cache'); res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(fileURLToPath(new URL(name, import.meta.url)));
  });

  // ---------------------------------------------------------------- accounts
  const attempts = new Map();
  const limited = (ip) => {
    const t = Date.now(), a = (attempts.get(ip) || []).filter((x) => t - x < 60000);
    a.push(t); attempts.set(ip, a);
    if (attempts.size > 5000) attempts.clear();
    return a.length > 20;
  };
  const auth = (fn) => async (req, res) => {
    if (limited(req.ip)) return res.status(429).json({ error: 'Too many attempts. Wait a minute and try again.' });
    try { res.json(await fn(req.body?.username, req.body?.password)); }
    catch (e) { if (!e.expose) console.error('Hanbin Island accounts:', e.message); res.status(e.status || 500).json({ error: e.expose ? e.message : 'The server could not reach the account database.' }); }
  };
  const json = express.json({ limit: '2kb' });
  app.post('/eldyn/api/register', json, auth((u, p) => accounts.register(u, p)));
  app.post('/eldyn/api/login', json, auth((u, p) => accounts.login(u, p)));
  app.use('/eldyn', (_req, res) => res.status(404).send('Not found'));

  // ---------------------------------------------------------------- saving
  const saveProgress = (p) => store.saveProgress(p.accountId, game.progressOf(p)).then(() => true, (e) => { console.error('Hanbin Island save:', e.message); return false; });
  let saving = false;
  const saveAll = async () => {
    if (!game || saving) return;
    saving = true;
    try {
      for (const p of game.players.values()) if (p.dirty) { p.dirty = false; if (!(await saveProgress(p))) p.dirty = true; }
      if (game.worldDirty) { game.worldDirty = false; await store.saveWorld(game.worldState()).catch((e) => { game.worldDirty = true; console.error('Hanbin Island world save:', e.message); }); }
    } finally { saving = false; }
  };
  const saver = setInterval(saveAll, SAVE_EVERY); saver.unref();

  // ---------------------------------------------------------------- sockets
  const wss = new WebSocketServer({ noServer: true, maxPayload: 2048 });
  const upgrade = (req, socket, head) => {
    if (req.url?.split('?')[0] !== '/eldyn/ws') return;
    if (req.headers.origin) {
      try { if (new URL(req.headers.origin).host !== req.headers.host) { socket.destroy(); return; } }
      catch { socket.destroy(); return; }
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
  };
  server.on('upgrade', upgrade);
  const out = (ws) => (s) => { if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 512 * 1024) ws.send(s); };
  wss.on('connection', (ws) => {
    ws.alive = true; ws.windowStart = Date.now(); ws.count = 0;
    ws.on('pong', () => { ws.alive = true; });
    ws.on('error', () => {});
    ws.on('close', () => {
      const p = ws.player; ws.player = null;
      if (p && game) { game.leave(p); saveProgress(p); }
    });
    ws.on('message', async (data) => {
      if (Date.now() - ws.windowStart > 1000) { ws.windowStart = Date.now(); ws.count = 0; }
      if (++ws.count > 80) return;
      let m;
      try { m = JSON.parse(data.toString()); } catch { return; }
      if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
      if (ws.player) { if (game.players.has(ws.player.id)) game.handle(ws.player, m); return; }
      if (m.t !== 'join' || ws.joining) return;
      ws.joining = true;
      try {
        await load();
        const a = await accounts.bySession(m.session);
        if (!a) { ws.send(JSON.stringify({ t: 'auth' })); ws.close(); return; }
        if (ws.readyState !== WebSocket.OPEN) return;
        // Signing in again while still online carries over the live (possibly unsaved) progress.
        const live = [...game.players.values()].find((o) => o.accountId === a.id);
        const p = game.join({ id: a.id, username: a.username, progress: live ? game.progressOf(live) : a.progress }, out(ws));
        p.dirty = !!live;
        p.onKick = () => { ws.player = null; ws.close(); };
        ws.player = p;
      } catch (e) {
        console.error('Hanbin Island join:', e.message);
        if (ws.readyState === WebSocket.OPEN) { ws.send(JSON.stringify({ t: 'msg', m: 'The server is starting up. Try again in a moment.', c: '#c06060' })); ws.close(); }
      } finally { ws.joining = false; }
    });
  });
  const tick = setInterval(() => {
    if (!game || !game.players.size) return;
    try { game.tick(); } catch (e) { console.error('Hanbin Island tick:', e); }
  }, TICK);
  tick.unref();
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); }
  }, 15000);
  heartbeat.unref();
  return {
    get game() { return game; }, ready: load, saveAll,
    close() { clearInterval(tick); clearInterval(heartbeat); clearInterval(saver); server.off('upgrade', upgrade); for (const ws of wss.clients) ws.terminate(); wss.close(); },
  };
}

// Standalone development server (no database unless DATABASE_URL is set).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const app = express(), server = http.createServer(app), port = Number(process.env.ELDYN_PORT || 3008);
  setupEldyn(app, server);
  server.listen(port, '127.0.0.1', () => console.log(`Hanbin Island: http://127.0.0.1:${port}/eldyn/`));
}
