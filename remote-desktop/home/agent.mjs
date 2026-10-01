import net from 'node:net';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';

export function startAgent(config, { log = console.log, allowLocalTest = false } = {}) {
  const origin = new URL(config.website);
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') throw new Error('website must be the HTTPS origin only.');
  const local = ['127.0.0.1', 'localhost'].includes(origin.hostname);
  if (origin.protocol !== 'https:' && !(allowLocalTest && local && origin.protocol === 'http:')) throw new Error('Use an HTTPS website address.');
  if (typeof config.agentToken !== 'string' || config.agentToken.length < 32) throw new Error('Set the private agentToken (at least 32 characters).');
  const port = config.vncPort ?? 5900;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid local VNC port.');
  origin.protocol = origin.protocol === 'https:' ? 'wss:' : 'ws:';
  origin.pathname = '/api/vm/agent';
  let ws, desktop, reconnectTimer, keepalive, stopped = false, retries = 0;
  const closeDesktop = () => {
    const current = desktop;
    desktop = null;
    current?.socket.destroy();
  };
  const connect = () => {
    if (stopped) return;
    log('Connecting to the website relay...');
    ws = new WebSocket(origin, { headers: { Authorization: `Bearer ${config.agentToken}` }, perMessageDeflate: false, maxPayload: 256 * 1024, handshakeTimeout: 20000 });
    let alive = true;
    ws.on('open', () => {
      retries = 0;
      log('Home connector online. Open /vm on your website to sign in and connect.');
      keepalive = setInterval(() => {
        if (!alive) return ws.terminate();
        alive = false;
        ws.ping();
      }, 30000);
      keepalive.unref();
    });
    ws.on('pong', () => { alive = true; });
    ws.on('message', (data, binary) => {
      if (binary) {
        if (!desktop || data.length <= 16 || data.subarray(0, 16).toString('hex') !== desktop.id) return;
        if (desktop.socket.writableLength > 1024 * 1024) { closeDesktop(); return; }
        desktop.socket.write(data.subarray(16));
        return;
      }
      let message;
      try { message = JSON.parse(data.toString()); } catch { return; }
      if (!/^[a-f0-9]{32}$/.test(message.id || '')) return;
      if (message.type === 'close' && desktop?.id === message.id) { closeDesktop(); log('Viewer disconnected.'); }
      if (message.type !== 'open') return;
      closeDesktop();
      // The relay cannot choose a host or port. Only this PC's loopback VNC is exposed.
      const socket = net.createConnection({ host: '127.0.0.1', port });
      const current = { socket, id: message.id };
      desktop = current;
      socket.setTimeout(10000);
      socket.on('connect', () => { socket.setTimeout(0); log('Authenticated website viewer connected to the local desktop.'); });
      const fail = () => {
        if (desktop !== current) return;
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'error', id: current.id }));
        closeDesktop();
      };
      socket.on('timeout', fail);
      socket.on('error', () => { log('Local desktop unavailable. Check the VNC server on 127.0.0.1 and its configured port.'); fail(); });
      socket.on('close', fail);
      socket.on('data', chunk => {
        if (desktop !== current || ws.readyState !== WebSocket.OPEN) return;
        if (ws.bufferedAmount > 8 * 1024 * 1024) { fail(); return; }
        ws.send(Buffer.concat([Buffer.from(current.id, 'hex'), chunk]), { binary: true });
      });
    });
    ws.on('unexpected-response', (_request, response) => {
      log(`Relay rejected the connector (HTTP ${response.statusCode}). Check the server configuration and token; no secret is printed here.`);
      if ([401, 403].includes(response.statusCode)) stopped = true;
      response.resume();
      ws.terminate();
    });
    ws.on('error', () => { log('Relay connection interrupted.'); });
    ws.on('close', () => {
      clearInterval(keepalive);
      closeDesktop();
      if (stopped) return;
      const delay = Math.min(30000, 1000 * 2 ** Math.min(retries++, 5)) + Math.floor(Math.random() * 500);
      log(`Reconnecting in ${Math.ceil(delay / 1000)} seconds...`);
      reconnectTimer = setTimeout(connect, delay);
    });
  };
  connect();
  return { stop() { stopped = true; clearTimeout(reconnectTimer); clearInterval(keepalive); closeDesktop(); ws?.terminate(); } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const configPath = process.argv[2] || fileURLToPath(new URL('config.local.json', import.meta.url));
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const agent = startAgent(config);
    process.on('SIGINT', () => { agent.stop(); process.exit(0); });
    process.on('SIGTERM', () => { agent.stop(); process.exit(0); });
  } catch (error) { console.error('Connector setup error:', error.message); process.exitCode = 1; }
}
