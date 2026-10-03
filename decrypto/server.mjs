import express from 'express';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { randomInt } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { createRoom, addPlayer, act, snapshot, setPresence } from './engine.mjs';

export function setupDecrypto(app, server) {
  const rooms = new Map();
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
  app.get('/decrypto', (req, res, next) => req.path.endsWith('/') ? next() : res.redirect(308, '/decrypto/' + (req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '')));
  app.get(['/decrypto/', '/decrypto/index.html', '/decrypto/app.js', '/decrypto/style.css'], (req, res) => {
    const name = req.path.endsWith('app.js') ? 'app.js' : req.path.endsWith('style.css') ? 'style.css' : 'index.html';
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(fileURLToPath(new URL(name, import.meta.url)));
  });
  app.use('/decrypto', (_req, res) => res.status(404).send('Not found'));
  const send = (ws, data) => { if (ws.readyState === WebSocket.OPEN) { if (ws.bufferedAmount > 262144) ws.terminate(); else ws.send(JSON.stringify(data)); } };
  const broadcast = room => {
    for (const p of room.players) if (p.ws) send(p.ws, { type: 'state', room: snapshot(room, p) });
  };
  const disconnect = ws => {
    const r = rooms.get(ws.room), p = r?.players.find(p => p.id === ws.player);
    if (p?.ws !== ws) return;
    p.ws = null; setPresence(r, p, false); r.updated = Date.now(); broadcast(r);
  };
  const attach = (ws, r, p) => {
    const old = p.ws; p.ws = ws; ws.room = r.code; ws.player = p.id;
    if (old && old !== ws) old.close(4001, 'Opened in another tab');
    setPresence(r, p, true); r.updated = Date.now();
    send(ws, { type: 'session', room: r.code, token: p.token }); broadcast(r);
  };
  const upgrade = (req, socket, head) => {
    if (req.url?.split('?')[0] !== '/decrypto/ws') return;
    if (req.headers.origin) {
      try { if (new URL(req.headers.origin).host !== req.headers.host) { socket.destroy(); return; } }
      catch { socket.destroy(); return; }
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  };
  server.on('upgrade', upgrade);
  wss.on('connection', ws => {
    ws.alive = true; ws.windowStart = Date.now(); ws.count = 0;
    ws.on('pong', () => { ws.alive = true; });
    ws.on('error', () => {});
    ws.on('close', () => disconnect(ws));
    ws.on('message', data => {
      try {
        if (Date.now() - ws.windowStart > 10000) { ws.windowStart = Date.now(); ws.count = 0; }
        if (++ws.count > 50) throw Error('Slow down a little.');
        const m = JSON.parse(data.toString());
        if (!m || typeof m !== 'object') throw Error('Invalid message.');
        let r = rooms.get(ws.room), p = r?.players.find(p => p.id === ws.player);
        if (['create', 'join', 'resume'].includes(m.action)) {
          if (p) throw Error('Leave your current room first.');
          if (m.action === 'create') {
            if (rooms.size >= 500) throw Error('The server is full. Please try again later.');
            let code; do { code = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join(''); } while (rooms.has(code));
            r = createRoom(code); p = addPlayer(r, m.name); rooms.set(code, r);
          } else {
            r = rooms.get(String(m.room ?? '').trim().toUpperCase());
            if (!r) { send(ws, { type: 'error', message: 'Room not found or expired. Create a new room.', expired: m.action === 'resume' }); return; }
            if (m.action === 'resume') {
              p = r.players.find(q => q.token === m.token);
              if (!p) { send(ws, { type: 'error', message: 'Your session expired. Join again.', expired: true }); return; }
            } else p = addPlayer(r, m.name);
          }
          attach(ws, r, p); return;
        }
        if (!r || !p || p.ws !== ws) throw Error('Create or join a room first.');
        if (m.action === 'leave') {
          disconnect(ws);
          if (r.phase === 'lobby') r.players = r.players.filter(q => q !== p);
          ws.room = ws.player = null; send(ws, { type: 'left' }); broadcast(r); return;
        }
        if (m.action === 'remove') {
          const target = r.players.find(q => q.id === m.player);
          act(r, p, m);
          if (target?.ws) { target.ws.room = target.ws.player = null; send(target.ws, { type: 'removed' }); }
        } else act(r, p, m);
        broadcast(r);
      } catch (error) { send(ws, { type: 'error', message: error instanceof SyntaxError ? 'Invalid message.' : error.message }); }
    });
  });
  const timer = setInterval(() => {
    for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); }
    for (const [code, r] of rooms) if (!r.players.some(p => p.connected) && Date.now() - r.updated > 30 * 60 * 1000) rooms.delete(code);
  }, 15000);
  timer.unref();
  return { rooms, broadcast, close() { clearInterval(timer); server.off('upgrade', upgrade); for (const ws of wss.clients) ws.terminate(); wss.close(); } };
}

// Standalone development server, without the main application's database.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const app = express(), server = http.createServer(app);
  setupDecrypto(app, server);
  server.listen(Number(process.env.DECRYPTO_PORT || 3002), '127.0.0.1', () => console.log('Decrypto: http://127.0.0.1:' + (process.env.DECRYPTO_PORT || 3002) + '/decrypto/'));
}
