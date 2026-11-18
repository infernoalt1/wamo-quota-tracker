import express from 'express';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { createWorld, addPlayer, removePlayer, setInput, respawn, step, viewFor, drainEvents, TOOLS, ARMORS, WORLD, REGION, DT, STONE_RADIUS } from './engine.mjs';

export function setupWardmoor(app, server) {
  const world = createWorld(Math.floor(Math.random() * 1e9));
  const wss = new WebSocketServer({ noServer: true, maxPayload: 2048 });
  app.get('/wardmoor', (req, res, next) => req.path.endsWith('/') ? next() : res.redirect(308, '/wardmoor/'));
  app.get(['/wardmoor/', '/wardmoor/index.html', '/wardmoor/app.js', '/wardmoor/style.css'], (req, res) => {
    const name = req.path.endsWith('app.js') ? 'app.js' : req.path.endsWith('style.css') ? 'style.css' : 'index.html';
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(fileURLToPath(new URL(name, import.meta.url)));
  });
  app.use('/wardmoor', (_req, res) => res.status(404).send('Not found'));
  const send = (ws, data) => { if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 262144) ws.send(JSON.stringify(data)); };
  const upgrade = (req, socket, head) => {
    if (req.url?.split('?')[0] !== '/wardmoor/ws') return;
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
    ws.on('close', () => { if (ws.player) removePlayer(world, ws.player); ws.player = null; });
    ws.on('message', data => {
      try {
        if (Date.now() - ws.windowStart > 1000) { ws.windowStart = Date.now(); ws.count = 0; }
        if (++ws.count > 60) return;
        const m = JSON.parse(data.toString());
        if (!m || typeof m !== 'object') return;
        if (m.t === 'join' && !ws.player) {
          ws.player = addPlayer(world, { name: m.name, band: m.band });
          send(ws, { t: 'w', id: ws.player.id, world: WORLD, region: REGION, stone: STONE_RADIUS, seed: world.seed, obstacles: world.obstacles, tools: TOOLS.map(({ id, name, kind, renown, cool, reach, arc }) => ({ id, name, kind, renown, cool, reach, arc })), armors: ARMORS.map(({ id, name, renown, dr, speed }) => ({ id, name, renown, dr, speed })) });
        } else if (ws.player && m.t === 'i') setInput(world, ws.player, m);
        else if (ws.player && m.t === 'spawn') respawn(world, ws.player);
      } catch (error) { send(ws, { t: 'err', message: error instanceof SyntaxError ? 'Invalid message.' : error.message }); }
    });
  });
  let frame = 0;
  const tick = setInterval(() => {
    const humans = [...wss.clients].filter(ws => ws.player);
    if (!humans.length) return;
    step(world, DT);
    if (++frame % 2) return;
    const events = drainEvents(world);
    for (const ws of humans) send(ws, viewFor(world, ws.player, events));
  }, DT * 1000);
  tick.unref();
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); }
  }, 15000);
  heartbeat.unref();
  return { world, close() { clearInterval(tick); clearInterval(heartbeat); server.off('upgrade', upgrade); for (const ws of wss.clients) ws.terminate(); wss.close(); } };
}

// Standalone development server, without the main application's database.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const app = express(), server = http.createServer(app);
  setupWardmoor(app, server);
  server.listen(Number(process.env.WARDMOOR_PORT || 3007), '127.0.0.1', () => console.log('Wardmoor: http://127.0.0.1:' + (process.env.WARDMOOR_PORT || 3007) + '/wardmoor/'));
}
