import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import express from 'express';
import http from 'node:http';
import { WebSocket } from 'ws';
import { JSDOM, VirtualConsole } from 'jsdom';
import { setupDecrypto } from './server.mjs';

test('four real WebSocket browser clients switch teams, play a full game, reconnect and rematch', { timeout: 30000 }, async () => {
  const app = express(), server = http.createServer(app), game = setupDecrypto(app, server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`, html = await readFile(new URL('index.html', import.meta.url), 'utf8'), script = await readFile(new URL('app.js', import.meta.url), 'utf8');
  const clients = [], errors = [];
  async function wait(fn, label) { for (let i = 0; i < 250; i++) { if (fn()) return; await new Promise(resolve => setTimeout(resolve, 10)); } throw Error('Timed out: ' + label); }
  function client(saved) {
    const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
    const dom = new JSDOM(html, { url: origin + '/decrypto/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
    const c = { dom, sockets: [], view: null };
    const w = dom.window;
    w.WebSocket = class extends WebSocket { constructor(url) { super(url); c.sockets.push(this); this.on('message', data => { const m = JSON.parse(data.toString()); if (m.type === 'state') c.view = m.room; }); } };
    w.confirm = () => true; w.prompt = () => ''; w.HTMLDialogElement.prototype.showModal = function() { this.open = true; }; w.HTMLDialogElement.prototype.close = function() { this.open = false; };
    if (saved) w.sessionStorage.setItem('decrypto.session', saved);
    w.eval(script); clients.push(c); return c;
  }
  const q = (c, s) => c.dom.window.document.querySelector(s);
  const input = (c, s, value) => { q(c, s).value = value; };
  const submit = (c, s, b) => q(c, s).requestSubmit(b ? q(c, b) : undefined);
  let a, b, c, d;
  try {
    const redirect = await fetch(origin + '/decrypto?room=ABCDEF', { redirect: 'manual' }); assert.equal(redirect.status, 308); assert.equal(redirect.headers.get('location'), '/decrypto/?room=ABCDEF');
    for (const route of ['/decrypto/', '/decrypto/app.js', '/decrypto/style.css']) assert.equal((await fetch(origin + route)).status, 200);
    assert.equal((await fetch(origin + '/decrypto/engine.mjs')).status, 404);
    a = client(); await wait(() => !q(a, 'button[value=create]').disabled, 'connection');
    input(a, '#name', 'Alice'); submit(a, '#entry-form', 'button[value=create]'); await wait(() => a.view, 'created');
    const room = a.view.code;
    async function join(name) { const x = client(); await wait(() => !q(x, 'button[value=join]').disabled, 'join connected'); input(x, '#name', name); input(x, '#room-code', room); submit(x, '#entry-form', 'button[value=join]'); await wait(() => x.view, 'joined'); return x; }
    b = await join('Bob'); c = await join('Carol'); d = await join('Dave');
    await wait(() => a.view.players.length === 4, 'four joined');
    q(a, '[data-team=amber]').click(); await wait(() => a.view.players.find(p => p.id === a.view.me).team === 'amber', 'switch amber');
    q(b, '[data-team=blue]').click(); await wait(() => a.view.players.filter(p => p.team === 'blue').length === 2, 'balanced');
    assert.equal(q(b, '#word-list-form'), null);
    input(a, '#word-list-mode', 'custom'); q(a, '#word-list-mode').dispatchEvent(new a.dom.window.Event('change', { bubbles: true }));
    assert.equal(q(a, '#custom-word-fields').hidden, false);
    const custom = 'copper, silver, bronze, platinum, nickel, cobalt, zinc, iron';
    input(a, '#custom-words', custom);
    input(b, '#message', 'Ready to play'); submit(b, '#chat-form');
    await wait(() => q(a, '#messages').textContent.includes('Ready to play'), 'lobby chat');
    assert.equal(q(a, '#custom-words').value, custom);
    submit(a, '#word-list-form');
    await wait(() => a.view.wordList.mode === 'custom' && b.view.wordList.mode === 'custom', 'saved word list');
    assert.equal(q(a, '#custom-words').value.split('\n').length, 8);
    assert.equal(b.view.wordList.custom, undefined);
    q(a, '[data-action=start]').click(); await wait(() => clients.every(x => x.view?.phase === 'clues'), 'start');
    const r = game.rooms.get(room);
    assert([...r.teams.blue.words, ...r.teams.amber.words].every(w => custom.includes(w)));
    const current = id => [a, b, c, d].find(x => x.view.me === id);
    assert.equal(q(a, '[data-team=blue]'), null);
    const encoderClient = current(r.teams.blue.encoder), decoderClient = current(r.players.find(p => p.team === 'blue' && p.id !== r.teams.blue.encoder).id);
    input(encoderClient, '#clue0', 'unsent draft');
    input(decoderClient, '#message', '<img src=x onerror=alert(1)>'); input(decoderClient, '#channel', 'team'); submit(decoderClient, '#chat-form');
    await wait(() => q(encoderClient, '#messages').textContent.includes('<img'), 'team chat');
    assert.equal(q(encoderClient, '#clue0').value, 'unsent draft'); assert.equal(q(encoderClient, '#messages img'), null);
    assert(!q(current(r.teams.amber.encoder), '#messages').textContent.includes('<img'));
    // Refresh one player: token restores the same identity, team, and private words.
    const old = c, saved = c.dom.window.sessionStorage.getItem('decrypto.session'), oldId = c.view.me;
    c = client(saved); await wait(() => c.view?.me === oldId, 'resume'); await wait(() => old.sockets[0].readyState === 3, 'old session replaced');
    assert.equal(c.view.players.find(p => p.id === oldId).connected, true);
    for (let round = 1; round <= 2; round++) {
      for (const team of ['blue', 'amber']) {
        const x = current(r.teams[team].encoder); await wait(() => q(x, '#clue-form'), 'encryptor form');
        for (let i = 0; i < 3; i++) input(x, '#clue' + i, `${team} signal ${round}-${i}`);
        submit(x, '#clue-form');
      }
      await wait(() => r.phase === 'guess', 'clues done');
      for (const team of ['blue', 'amber']) {
        const decoder = current(r.players.find(p => p.team === team && p.id !== r.teams[team].encoder).id);
        await wait(() => q(decoder, '#guess-form') && decoder.view.target === team, 'decoder form');
        const code = [...r.teams[team].code]; if (team === 'blue') [code[0], code[1]] = [code[1], code[0]];
        code.forEach((n, i) => input(decoder, `[name=digit${i}]`, n)); submit(decoder, '#guess-form');
        if (round > 1) {
          const interceptor = current(r.players.find(p => p.team !== team && p.team).id);
          await wait(() => q(interceptor, '#guess-form') && interceptor.view.target === team, 'interceptor form');
          const wrong = [...r.teams[team].code]; [wrong[0], wrong[1]] = [wrong[1], wrong[0]];
          wrong.forEach((n, i) => input(interceptor, `[name=digit${i}]`, n)); submit(interceptor, '#guess-form');
        }
        await wait(() => r.target !== team, 'transmission resolved');
      }
      if (round === 1) { await wait(() => q(a, '[data-action=next]'), 'round summary'); q(a, '[data-action=next]').click(); await wait(() => r.round === 2, 'next round'); }
    }
    await wait(() => a.view.phase === 'finished', 'finished'); assert.equal(r.winner, 'amber'); assert.match(q(a, '.activity').textContent, /Amber cracked it/);
    q(a, '[data-action=lobby]').click(); await wait(() => a.view.phase === 'lobby', 'rematch lobby');
    assert.equal(q(a, '#word-list-mode').value, 'custom');
    input(a, '#word-list-mode', 'classic'); submit(a, '#word-list-form');
    await wait(() => a.view.wordList.mode === 'classic', 'restore classic');
    q(a, '[data-action=start]').click(); await wait(() => a.view.phase === 'clues', 'rematch'); assert.equal(r.history.length, 0); assert.equal(r.round, 1);
    // Unexpected host disconnection transfers control; remaining host can recover to lobby.
    for (const ws of a.sockets) { ws.onclose = null; ws.onmessage = null; ws.terminate(); } a.dom.window.close();
    await wait(() => r.host !== a.view.me, 'host transfer'); const host = current(r.host);
    await wait(() => q(host, '#reset'), 'new host controls'); q(host, '#reset').click(); await wait(() => r.phase === 'lobby', 'host reset');
    assert.deepEqual(errors, []);
  } finally {
    for (const x of clients) { for (const ws of x.sockets) { ws.onclose = null; ws.onmessage = null; ws.terminate(); } x.dom.window.close(); }
    game.close(); await new Promise(resolve => server.close(resolve));
  }
});
