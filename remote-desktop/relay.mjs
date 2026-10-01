import express from 'express';
import crypto from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { vmSettings } from './settings.mjs';

const COOKIE = 'wamo_vm_session';
const OPEN = WebSocket.OPEN;
const MAX_BUFFER = 8 * 1024 * 1024;
const equal = (a, b) => crypto.timingSafeEqual(crypto.createHash('sha256').update(a).digest(), crypto.createHash('sha256').update(b).digest());

export function setupVmRelay(app, server, { env = process.env, sessionMs = 30 * 60_000, heartbeatMs = 25_000 } = {}) {
  const settings = vmSettings(env);
  app.use('/vm', (_req, res, next) => {
    res.set('Referrer-Policy', 'no-referrer');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Security-Policy', `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ${settings.origin?.replace(/^http/, 'ws') || ''}; worker-src 'self' blob:; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`);
    next();
  });
  const sessions = new Map();
  let agent = null, viewer = null;
  let attempts = [];
  const wss = new WebSocketServer({ noServer: true, maxPayload: 2 * 1024 * 1024, perMessageDeflate: false });
  const router = express.Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); res.set('X-Content-Type-Options', 'nosniff'); next(); });
  router.use(express.json({ limit: '2kb' }));
  const cookieValue = req => /(?:^|;\s*)wamo_vm_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
  const authenticate = req => {
    const key = cookieValue(req);
    const session = sessions.get(key);
    if (!session || session.expires <= Date.now()) { if (key) sessions.delete(key); return null; }
    return { ...session, key };
  };
  const setCookie = (res, value, age) => res.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=/api/vm; HttpOnly; SameSite=Strict; Max-Age=${age}${settings.secure ? '; Secure' : ''}`);
  const sameOrigin = req => req.headers.origin === settings.origin;
  const stopViewer = (code = 1000, reason = 'Disconnected') => {
    const current = viewer;
    if (!current) return;
    viewer = null;
    clearTimeout(current.expiry);
    if (agent?.readyState === OPEN) agent.send(JSON.stringify({ type: 'close', id: current.id }));
    current.ws.close(code, reason);
  };
  router.get('/config', (_req, res) => res.json({ configured: settings.configured, label: settings.label, mode: 'embedded' }));
  router.post('/login', (req, res) => {
    if (!settings.configured) return res.status(503).json({ error: 'Remote desktop is not configured on this server.' });
    if (!sameOrigin(req)) return res.status(403).json({ error: 'Origin rejected.' });
    attempts = attempts.filter(time => time > Date.now() - 10 * 60_000);
    if (attempts.length >= 10) return res.status(429).set('Retry-After', '600').json({ error: 'Too many sign-in attempts. Try again in 10 minutes.' });
    attempts.push(Date.now());
    const password = req.body?.password;
    if (typeof password !== 'string' || password.length > 512 || !equal(password, settings.password)) return res.status(401).json({ error: 'Incorrect access password.' });
    const previous = cookieValue(req);
    if (previous) { sessions.delete(previous); if (viewer?.sessionKey === previous) stopViewer(); }
    for (const [key, value] of sessions) if (value.expires <= Date.now()) sessions.delete(key);
    if (sessions.size >= 20) return res.status(429).json({ error: 'Too many active sessions. Sign out or wait for a session to expire.' });
    const key = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + sessionMs;
    sessions.set(key, { expires });
    setCookie(res, key, Math.ceil(sessionMs / 1000));
    res.json({ authenticated: true, expires });
  });
  router.get('/session', (req, res) => {
    const session = authenticate(req);
    if (!session) return res.status(401).json({ error: 'Sign in to connect.' });
    res.json({ authenticated: true, online: agent?.readyState === OPEN, busy: !!viewer, expires: session.expires });
  });
  router.post('/logout', (req, res) => {
    if (!sameOrigin(req)) return res.status(403).json({ error: 'Origin rejected.' });
    const key = cookieValue(req);
    if (viewer?.sessionKey === key) stopViewer();
    sessions.delete(key);
    setCookie(res, '', 0);
    res.json({ authenticated: false });
  });
  app.use('/api/vm', router);

  const reject = (socket, code) => { socket.end(`HTTP/1.1 ${code} Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); };
  const forward = (target, data) => {
    if (!target || target.readyState !== OPEN) return false;
    if (target.bufferedAmount > MAX_BUFFER) { stopViewer(1013, 'Connection too slow; reconnect at lower quality'); return false; }
    target.send(data, { binary: true });
    return true;
  };
  const upgrade = (req, socket, head) => {
    const route = req.url?.split('?')[0];
    if (route !== '/api/vm/agent' && route !== '/api/vm/socket') return;
    if (!settings.configured) return reject(socket, 503);
    if (req.url.includes('?')) return reject(socket, 400);
    if (route === '/api/vm/agent') {
      // Native outbound connector only: bearer token never appears in a URL or browser.
      if (req.headers.origin || !equal(req.headers.authorization || '', `Bearer ${settings.agentToken}`)) return reject(socket, 401);
      if (agent) return reject(socket, 409);
      wss.handleUpgrade(req, socket, head, ws => {
        agent = ws;
        ws.alive = true;
        ws.on('pong', () => { ws.alive = true; });
        ws.on('error', () => {});
        ws.on('message', (data, binary) => {
          if (binary) {
            if (data.length <= 16 || !viewer || data.subarray(0, 16).toString('hex') !== viewer.id) return;
            forward(viewer.ws, data.subarray(16));
          } else {
            try {
              const message = JSON.parse(data.toString());
              if (message.type === 'error' && viewer?.id === message.id) stopViewer(1011, 'Home desktop connection failed');
            } catch { ws.close(1008, 'Invalid message'); }
          }
        });
        ws.on('close', () => { if (agent === ws) { agent = null; stopViewer(1011, 'Home connector disconnected'); } });
      });
    } else {
      if (!sameOrigin(req)) return reject(socket, 403);
      const session = authenticate(req);
      if (!session) return reject(socket, 401);
      if (!agent || agent.readyState !== OPEN) return reject(socket, 503);
      if (viewer) return reject(socket, 409);
      wss.handleUpgrade(req, socket, head, ws => {
        const id = crypto.randomBytes(16).toString('hex');
        const current = { id, ws, sessionKey: session.key, expiry: null };
        viewer = current;
        current.expiry = setTimeout(() => { if (viewer === current) stopViewer(1008, 'Session expired; sign in again'); }, session.expires - Date.now());
        current.expiry.unref();
        ws.alive = true;
        ws.on('pong', () => { ws.alive = true; });
        ws.on('error', () => {});
        ws.on('message', (data, binary) => {
          if (viewer !== current) return;
          if (!binary || data.length > 128 * 1024) return stopViewer(1008, 'Invalid desktop message');
          forward(agent, Buffer.concat([Buffer.from(id, 'hex'), data]));
        });
        ws.on('close', () => { if (viewer === current) stopViewer(); });
        agent.send(JSON.stringify({ type: 'open', id }));
      });
    }
  };
  server.on('upgrade', upgrade);
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) { ws.terminate(); continue; }
      ws.alive = false;
      ws.ping();
    }
    for (const [key, session] of sessions) if (session.expires <= Date.now()) sessions.delete(key);
  }, heartbeatMs);
  heartbeat.unref();
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    clearInterval(heartbeat);
    stopViewer(1001, 'Server restarting');
    for (const ws of wss.clients) ws.terminate();
    wss.close();
    sessions.clear();
    server.off('upgrade', upgrade);
  };
  server.once('close', dispose);
  return { dispose, wss };
}
