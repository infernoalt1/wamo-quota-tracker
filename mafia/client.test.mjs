import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import express from 'express';
import http from 'node:http';
import { WebSocket } from 'ws';
import { JSDOM, VirtualConsole } from 'jsdom';
import { setupMafia } from './server.mjs';

test('browser clients play a full match over real WebSockets, with private traffic and reconnects', { timeout: 30000 }, async () => {
  const app = express(), server = http.createServer(app), game = setupMafia(app, server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`, html = await readFile(new URL('index.html', import.meta.url), 'utf8'), script = await readFile(new URL('app.js', import.meta.url), 'utf8');
  const clients = [], errors = [];
  async function wait(fn, label) { for (let i = 0; i < 400; i++) { if (fn()) return; await new Promise(resolve => setTimeout(resolve, 10)); } throw Error('Timed out: ' + label); }
  function client(saved) {
    const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
    const dom = new JSDOM(html, { url: origin + '/mafia/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
    const c = { dom, sockets: [], view: null, states: 0 };
    const w = dom.window;
    w.WebSocket = class extends WebSocket { constructor(url) { super(url); c.sockets.push(this); this.on('message', data => { const m = JSON.parse(data.toString()); if (m.type === 'state') { c.view = m.room; c.states++; } }); } };
    w.confirm = () => true; w.HTMLDialogElement.prototype.showModal = function() { this.open = true; }; w.HTMLDialogElement.prototype.close = function() { this.open = false; };
    if (saved) w.sessionStorage.setItem('mafia.session', saved);
    w.eval(script); clients.push(c); return c;
  }
  const q = (c, s) => c.dom.window.document.querySelector(s);
  const text = (c, s) => q(c, s).textContent;
  const open = c => wait(() => c.sockets[0]?.readyState === 1, 'connected');
  const pressEnter = (c, s) => { q(c, s).dispatchEvent(new c.dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); q(c, s).form.requestSubmit(q(c, s).form.querySelector('button')); };
  const button = (c, name) => [...c.dom.window.document.querySelectorAll('#stage button')].find(b => b.textContent.includes(name));
  const expire = room => { room.deadline = 0; };
  try {
    const redirect = await fetch(origin + '/mafia?room=ABCDEF', { redirect: 'manual' }); assert.equal(redirect.status, 308); assert.equal(redirect.headers.get('location'), '/mafia/?room=ABCDEF');
    for (const route of ['/mafia/', '/mafia/app.js', '/mafia/style.css']) assert.equal((await fetch(origin + route)).status, 200);
    assert.equal((await fetch(origin + '/mafia/engine.mjs')).status, 404, 'server code is not public');

    const a = client(); await open(a);
    q(a, '#name').value = 'Ana'; pressEnter(a, '#name'); await wait(() => a.view, 'created by pressing enter');
    const code = a.view.code, room = game.rooms.get(code);
    assert.equal(text(a, '.code'), code);
    async function join(name) { const x = client(); await open(x); q(x, '#name').value = name; q(x, '#room-code').value = code; pressEnter(x, '#room-code'); await wait(() => x.view, name + ' joined'); return x; }
    const others = []; for (const name of ['Bo', 'Cy', 'Di', 'Ed', 'Fay']) others.push(await join(name));
    const all = [a, ...others];
    await wait(() => a.view.players.length === 6, 'six joined');

    // Enter sends chat, clears the box, and keeps a half-typed draft through someone else's update.
    q(a, '#chat-input').value = 'hello <b>all</b>'; pressEnter(a, '#chat-input');
    assert.equal(q(a, '#chat-input').value, '');
    await wait(() => others[0].view.chat.public.length === 1, 'chat delivered');
    await wait(() => text(others[0], '#chat-log').includes('hello <b>all</b>'), 'chat rendered as text');
    assert.equal(q(others[0], '#chat-log b + b'), null, 'names cannot inject markup');
    q(a, '#chat-input').value = 'half typed';
    q(others[1], '#ready') && q(others[1], '#ready').click();
    await wait(() => a.view.players.find(p => p.name === 'Cy').ready, 'ready shown');
    assert.equal(q(a, '#chat-input').value, 'half typed');
    q(a, '#chat-input').value = '';

    assert.equal(button(a, 'Start game').disabled, true);
    for (const x of others) { if (!x.view.players.find(p => p.id === x.view.me).ready) q(x, '#ready').click(); }
    await wait(() => !a.view.startProblem, 'all ready');
    await wait(() => !button(a, 'Start game').disabled, 'start enabled');
    button(a, 'Start game').click();
    await wait(() => all.every(x => x.view.phase === 'roleReveal'), 'roles dealt');
    for (const x of all) assert.equal(x.view.players.filter(p => p.role).length >= 1, true);

    // Script the deal, so the rest of the match is predictable. Everyone is told by the next phase's update.
    const roles = { Ana: 'mafia', Bo: 'doctor', Cy: 'detective', Di: 'villager', Ed: 'villager', Fay: 'jester' };
    for (const p of room.players) p.role = roles[p.name];
    const by = name => all.find(x => x.view.players.find(p => p.id === x.view.me).name === name);
    const idOf = name => room.players.find(p => p.name === name).id;
    expire(room); await wait(() => all.every(x => x.view.phase === 'night'), 'night 1');
    assert.equal(document_theme(a), 'night');
    assert.match(text(by('Di'), '#stage'), /asleep/);
    assert.equal(q(by('Di'), '#stage [data-target]'), null, 'a villager gets no targets');
    assert.equal(q(by('Di'), '#chat-input').disabled, true, 'public chat closes at night');
    assert.equal(q(by('Ana'), '#chat-input').disabled, false, 'mafia can chat');

    // Night actions reach only the player who made them. A bystander sees no traffic at all, not even a blank update.
    const villager = by('Di'), quiet = villager.states;
    q(by('Ana'), `[data-target="${idOf('Di')}"]`).click();
    await wait(() => by('Ana').view.night.choice === idOf('Di'), 'mafia vote recorded');
    q(by('Bo'), `[data-target="${idOf('Di')}"]`).click();
    await wait(() => by('Bo').view.night.choice === idOf('Di'), 'doctor choice');
    q(by('Cy'), `[data-target="${idOf('Ana')}"]`).click();
    await wait(() => by('Cy').view.night.choice === idOf('Ana'), 'detective choice');
    q(by('Ana'), '#chat-input').value = 'mafia secret'; pressEnter(by('Ana'), '#chat-input');
    await wait(() => by('Ana').view.chat.mafia?.length === 1, 'mafia chat');
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(villager.states, quiet, 'no update reached the villager');
    q(by('Ana'), '#chat-input').value = 'half typed mafia plan';

    expire(room); await wait(() => all.every(x => x.view.phase === 'dayAnnouncement'), 'morning');
    assert.match(text(a, '#stage'), /Nobody died/);
    assert.equal(q(by('Ana'), '#chat-input').value, '', 'a mafia draft is not left in the public chat box');
    assert.equal(q(by('Ana'), '#chat-form').dataset.channel, 'public');
    assert.equal(document_theme(a), 'dayAnnouncement');
    expire(room); await wait(() => all.every(x => x.view.phase === 'discussion'), 'discussion');
    assert.match(text(by('Cy'), '#stage'), /Ana is Mafia/);
    assert.doesNotMatch(text(by('Di'), '#stage'), /is Mafia/);

    // Refresh mid-match: a new page with the saved session gets the same seat and role back.
    const savedDetective = by('Cy').dom.window.sessionStorage.getItem('mafia.session');
    by('Cy').sockets[0].close(); await wait(() => !room.players.find(p => p.name === 'Cy').connected, 'detective offline');
    const stolen = new WebSocket(origin.replace('http', 'ws') + '/mafia/ws'); await new Promise(resolve => stolen.once('open', resolve));
    const refusal = new Promise(resolve => stolen.once('message', d => resolve(JSON.parse(d.toString()))));
    stolen.send(JSON.stringify({ action: 'resume', room: code, token: 'guess' })); assert.equal((await refusal).type, 'error'); stolen.terminate();
    const back = client(savedDetective); await wait(() => back.view, 'detective back');
    assert.equal(back.view.players.find(p => p.id === back.view.me).role, 'detective');
    assert.match(text(back, '#stage'), /Ana is Mafia/);

    // A late joiner spectates and only sees public state.
    const watcher = await join('Gus');
    assert.equal(q(watcher, '#chat-input').disabled, true);
    assert.equal(watcher.view.players.filter(p => p.role).length, 0);
    assert.doesNotMatch(JSON.stringify(watcher.view), /mafia secret/);

    // Voting: everyone votes out the Jester, who wins alone while the match continues.
    expire(room); await wait(() => all.filter(x => x !== by('Cy')).every(x => x.view.phase === 'voting') && back.view.phase === 'voting', 'voting');
    for (const voter of [by('Ana'), by('Bo'), back]) {
      assert.equal(q(voter, '#submit-vote').disabled, true, 'submit waits for a choice');
      q(voter, `[data-target="${idOf('Fay')}"]`).click();
      assert.equal(q(voter, '#submit-vote').disabled, false);
      q(voter, '#submit-vote').click();
      await wait(() => voter.view.vote.choice === idOf('Fay'), 'vote recorded');
    }
    q(by('Di'), '#abstain').click(); await wait(() => by('Di').view.vote.choice === 'abstain', 'abstained');
    assert.equal(by('Ed').view.lastVote, null, 'votes are hidden until close');
    expire(room); await wait(() => all.filter(x => x !== by('Cy')).every(x => x.view.phase === 'elimination'), 'result');
    assert.match(text(a, '#stage'), /Fay was the Jester! The Jester has achieved their win condition!/);
    assert.match(text(a, '.vote-table'), /Fay/);
    assert.match(text(by('Fay'), '#stage'), /You won!/);
    assert.equal(q(by('Fay'), '#chat-tabs [data-tab=dead]').textContent, 'Dead');
    assert.equal(q(by('Di'), '#chat-tabs [data-tab=dead]'), null);

    // Night 2: the Detective is killed, then the vote removes the last Mafia member and Town wins.
    expire(room); await wait(() => back.view.phase === 'night', 'night 2');
    q(by('Ana'), `[data-target="${idOf('Ed')}"]`).click();
    await wait(() => by('Ana').view.night.choice === idOf('Ed'), 'mafia vote 2');
    expire(room); await wait(() => back.view.phase === 'dayAnnouncement', 'morning 2');
    assert.match(text(a, '#stage'), /Ed was killed during the night/);
    assert.match(text(by('Ed'), '#stage'), /You have been eliminated/);
    assert.equal(q(by('Ed'), '#chat-input').disabled, false, 'dead chat is open');
    expire(room); await wait(() => back.view.phase === 'discussion', 'discussion 2');
    expire(room); await wait(() => back.view.phase === 'voting', 'voting 2');
    assert.equal(by('Ed').view.vote, undefined, 'the dead cannot vote');
    q(back, `[data-target="${idOf('Ana')}"]`).click(); q(back, '#submit-vote').click();
    await wait(() => back.view.vote.choice === idOf('Ana'), 'final vote');
    expire(room); await wait(() => back.view.phase === 'gameOver', 'game over');
    assert.match(text(back, '#stage'), /Town wins!/);
    assert.match(text(back, '#stage'), /Fay also won as the Jester/);
    assert.match(text(back, '#stage'), /You won\./);
    assert.match(text(a, '#stage'), /You lost\./);
    assert.equal(back.view.players.filter(p => p.role).length, 7 - 1, 'all roles shown');
    assert.equal(room.deadline, null);

    assert.equal(button(back, 'Play again'), undefined, 'only the host resets');
    button(a, 'Play again').click();
    await wait(() => back.view.phase === 'lobby', 'back in lobby');
    assert.equal(back.view.players.filter(p => p.role).length, 0);
    assert.equal(watcher.view.players.find(p => p.id === watcher.view.me).spectator, false, 'the spectator gets a seat');

    // Leaving from the lobby gives up the seat and returns to the menu.
    q(watcher, '#leave').click(); await wait(() => q(watcher, '#menu').hidden === false, 'left');
    assert.equal(errors.length, 0, errors.join('\n'));
  } finally {
    for (const c of clients) { for (const ws of c.sockets) { ws.onclose = null; ws.onmessage = null; ws.terminate(); } c.dom.window.close(); }
    game.close(); await new Promise(resolve => server.close(resolve));
  }
  function document_theme(c) { return c.dom.window.document.body.dataset.phase; }
});
