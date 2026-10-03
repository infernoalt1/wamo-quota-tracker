import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { WebSocket } from 'ws';
import { setupDecrypto } from './server.mjs';
import { setupContactGame } from '../contact-game.js';
import { fileURLToPath } from 'node:url';

test('transport authentication, invalid packets, host-only actions, leave and independent upgrade routing', { timeout: 15000 }, async () => {
  const app = express(), server = http.createServer(app), game = setupDecrypto(app, server), sockets = [];
  // Register another existing game's upgrade handler on the same HTTP server.
  setupContactGame(app, server, fileURLToPath(new URL('../', import.meta.url)));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `ws://127.0.0.1:${server.address().port}/decrypto/ws`;
  function connect(options) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url, options); sockets.push(ws); ws.queue = [];
      ws.on('message', data => ws.queue.push(JSON.parse(data.toString())));
      ws.once('open', () => resolve(ws)); ws.once('error', reject);
    });
  }
  async function take(ws, type) {
    for (let i = 0; i < 200; i++) { const index = ws.queue.findIndex(m => m.type === type); if (index >= 0) return ws.queue.splice(index, 1)[0]; await new Promise(resolve => setTimeout(resolve, 10)); }
    throw Error('No response: ' + type);
  }
  const send = (ws, value) => ws.send(JSON.stringify(value));
  try {
    await assert.rejects(connect({ origin: 'https://untrusted.example' }));
    const host = await connect(); host.send('{'); assert.match((await take(host, 'error')).message, /Invalid message/);
    send(host, { action: 'create', name: 'Host' }); const session = await take(host, 'session'); const state = (await take(host, 'state')).room;
    assert.equal(session.room.length, 6); assert.equal(session.token.length, 36);
    const guest = await connect(); send(guest, { action: 'resume', room: session.room, token: 'wrong-token' }); assert.equal((await take(guest, 'error')).expired, true);
    send(guest, { action: 'join', room: session.room, name: 'Guest' }); await take(guest, 'session'); await take(guest, 'state');
    send(guest, { action: 'lobby' }); assert.match((await take(guest, 'error')).message, /host/);
    send(guest, { action: 'remove', player: state.me }); assert.match((await take(guest, 'error')).message, /host/);
    send(guest, { action: 'leave' }); await take(guest, 'left'); assert.equal(game.rooms.get(session.room).players.length, 1);
    send(guest, { action: 'team', team: 'blue' }); assert.match((await take(guest, 'error')).message, /join a room/);
    send(guest, { action: 'join', room: session.room, name: 'Again' }); await take(guest, 'session'); const guestState = (await take(guest, 'state')).room;
    send(host, { action: 'remove', player: guestState.me }); await take(guest, 'removed');
    assert.equal(game.rooms.get(session.room).players.length, 1);
  } finally {
    for (const ws of sockets) ws.terminate();
    game.close(); await new Promise(resolve => server.close(resolve));
  }
});
