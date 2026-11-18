import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { WebSocket } from 'ws';
import { CASTLES, VILLAGE, WORLD, SKILLS, SKILL_LIST, TREES, isLand, moveBody, inCastle, losClear } from './shared.mjs';
import { Game, CAPTURE_TIME } from './engine.mjs';
import { memoryStore, accountService } from './accounts.mjs';
import { setupEldyn } from './server.mjs';

function setup(progress = {}) {
  let t = 1e12;
  const game = new Game({ now: () => t });
  const msgs = [];
  const p = game.join({ id: 'acc-1', username: 'Tester', progress }, (s) => msgs.push(JSON.parse(s)));
  return { game, p, msgs, advance: (ms) => { t += ms; } };
}

test('every castle stands on land, apart from the others and away from the village', () => {
  for (const c of CASTLES) {
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) assert.ok(isLand(c.x + dx * 260, c.y + dy * 260), c.name);
    assert.ok(Math.hypot(c.x - VILLAGE.x, c.y - VILLAGE.y) > 1000, c.name);
    for (const o of CASTLES) if (o !== c) assert.ok(Math.hypot(c.x - o.x, c.y - o.y) > 900, `${c.name} / ${o.name}`);
  }
});

test('castle walls stop movement and sight, but the gate lets you in', () => {
  const c = CASTLES[0], H = WORLD.CASTLE_HALF;
  let [x, y] = [c.x - H - 40, c.y];
  [x, y] = moveBody(x, y, 14, 200, 0);
  assert.ok(x < c.x - H + 1, 'blocked by the west wall');
  assert.equal(losClear(c.x - H - 40, c.y, c.x - H + 60, c.y), false);
  [x, y] = moveBody(c.x, c.y + H + 60, 14, 0, -150);
  assert.ok(inCastle(c, x, y), 'walked in through the south gate');
});

test('skill trees have five trees, branching prerequisites and long cooldowns', () => {
  assert.equal(TREES.length, 5);
  assert.ok(SKILL_LIST.length >= 40);
  for (const tr of TREES) {
    const list = SKILL_LIST.filter((s) => s.tree === tr.id);
    const kids = new Map();
    for (const s of list) if (s.req) { assert.equal(SKILLS[s.req].tree, tr.id); kids.set(s.req, (kids.get(s.req) || 0) + 1); }
    assert.ok([...kids.values()].some((n) => n >= 2), `${tr.id} branches`);
  }
  for (const s of SKILL_LIST) if (!s.free && !s.passive) assert.ok(s.cd >= 2500, s.id);
});

test('learning needs points, tier and the parent skill; passives stay off the hotbar', () => {
  const { game, p } = setup({ soma: 40 * 5 * 5 }); // tier 5
  assert.equal(p.tier, 5); assert.equal(p.pts, 5);
  game.handle(p, { t: 'learn', id: 'whirlwind' }); // needs cleave first
  assert.ok(!p.skills.includes('whirlwind'));
  game.handle(p, { t: 'learn', id: 'cleave' });
  game.handle(p, { t: 'learn', id: 'whirlwind' });
  assert.ok(p.skills.includes('whirlwind'));
  game.handle(p, { t: 'learn', id: 'titan_strike' }); // tier 14
  assert.ok(!p.skills.includes('titan_strike'));
  game.handle(p, { t: 'learn', id: 'heavy_blade' });
  assert.ok(p.skills.includes('heavy_blade') && !p.hotbar.includes('heavy_blade'));
  assert.equal(p.mods.melee, 1.15);
  game.handle(p, { t: 'hb', s: 4, id: 'heavy_blade' });
  assert.notEqual(p.hotbar[4], 'heavy_blade');
  assert.equal(p.pts, 2);
});

test('skills beyond what the tier allows are refunded on join', () => {
  const { p } = setup({ soma: 40, skills: ['cleave', 'shield_bash', 'parry'], hotbar: ['slash', 'cleave', 'parry'] });
  assert.equal(p.tier, 1);
  assert.equal(p.skills.filter((s) => !SKILLS[s].free).length, 1);
  assert.ok(p.hotbar.every((s) => !s || p.skills.includes(s)));
});

test('dying costs 75% of valor and no soma', () => {
  const { game, p, msgs } = setup({ valor: 1000, soma: 500 });
  p.x = CASTLES[0].x + 600; p.y = CASTLES[0].y;
  game.killPlayer(p, null);
  assert.equal(p.valor, 250); assert.equal(p.soma, 500);
  assert.ok(msgs.some((m) => m.t === 'died' && m.lost === 750));
});

test('a faction captures a castle once its defenders are gone, and the garrison changes sides', () => {
  const { game, p, msgs, advance } = setup({ soma: 40000 });
  game.handle(p, { t: 'fc', n: 'Red Wolves' });
  assert.ok(p.fac);
  const c = game.castles[0];
  p.x = c.x; p.y = c.y + 120;
  for (let i = 0; i < (CAPTURE_TIME + 3) * 20; i++) {
    advance(50); game.tick();
    for (const id of c.slots) { const n = game.npcs.get(id); if (n && n.team === 'wild') game.killNpc(n, p); }
    p.hp = p.maxhp;
  }
  assert.equal(c.owner, p.fac);
  assert.ok(msgs.some((m) => m.t === 'msg' && /conquered/.test(m.m)));
  assert.ok(c.slots.every((id) => game.npcs.get(id)?.team === 'f:' + p.fac));
  assert.deepEqual(game.worldState().castles, { [c.id]: p.fac });
  // Leaving as the only member disbands the faction and frees the castle.
  game.handle(p, { t: 'fl' });
  assert.equal(c.owner, 0);
  assert.deepEqual(game.worldState().factions, {});
});

test('a saved world is restored, including castle owners', () => {
  const world = { factions: { 3: { id: 3, name: 'Gulls', color: '#3498db', leader: 'a', leaderName: 'A', members: ['acc-1'] } }, castles: { [CASTLES[2].id]: 3 }, nextFac: 4 };
  const game = new Game({ world, now: () => 1e12 });
  assert.equal(game.castles.find((c) => c.id === CASTLES[2].id).owner, 3);
  const p = game.join({ id: 'acc-1', username: 'A', progress: { fac: 3 } }, () => {});
  assert.equal(p.fac, 3);
  const q = game.join({ id: 'acc-2', username: 'B', progress: { fac: 3 } }, () => {});
  assert.equal(q.fac, 0, 'not a listed member');
});

test('accounts: register, reject duplicates and wrong passwords, sign in by session', async () => {
  const store = memoryStore(), acc = accountService(store, { rounds: 4 });
  const r = await acc.register('Aria', 'hunter22');
  await assert.rejects(acc.register('aria', 'whatever1'), /taken/);
  await assert.rejects(acc.login('Aria', 'wrongpass'), /Wrong/);
  const l = await acc.login('ARIA', 'hunter22');
  assert.notEqual(l.session, r.session);
  assert.equal(await acc.bySession(r.session), null, 'old session is replaced');
  assert.equal((await acc.bySession(l.session)).username, 'Aria');
  await assert.rejects(acc.register('x', 'hunter22'), /Usernames/);
});

test('server: sign up over HTTP, join over WebSocket, progress is saved on leave', async () => {
  const store = memoryStore(), app = express(), server = http.createServer(app);
  const h = setupEldyn(app, server, { store });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `127.0.0.1:${server.address().port}`;
  try {
    const page = await fetch(`http://${base}/eldyn/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Hanbin Island/);
    const mod = await fetch(`http://${base}/eldyn/shared.mjs`);
    assert.match(mod.headers.get('content-type'), /javascript/);
    const reg = await (await fetch(`http://${base}/eldyn/api/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'Bram', password: 'castle99' }) })).json();
    assert.ok(reg.session);
    const ws = new WebSocket(`ws://${base}/eldyn/ws`);
    const seen = new Set();
    await new Promise((resolve, reject) => {
      ws.on('open', () => ws.send(JSON.stringify({ t: 'join', session: reg.session })));
      ws.on('message', (d) => { const m = JSON.parse(d); seen.add(m.t); if (seen.has('welcome') && seen.has('s')) resolve(); });
      ws.on('error', reject);
      setTimeout(() => reject(new Error('no snapshot: ' + [...seen])), 4000);
    });
    const p = [...h.game.players.values()][0];
    p.soma = 777;
    ws.close();
    await new Promise((r) => setTimeout(r, 200));
    const a = await store.byKey('bram');
    assert.equal(a.progress.soma, 777);
    // A bad session is told to sign in again.
    const bad = new WebSocket(`ws://${base}/eldyn/ws`);
    const reply = await new Promise((resolve) => { bad.on('open', () => bad.send(JSON.stringify({ t: 'join', session: '00000000-0000-0000-0000-000000000000' }))); bad.on('message', (d) => resolve(JSON.parse(d))); });
    assert.equal(reply.t, 'auth');
    bad.close();
  } finally { h.close(); server.close(); }
});
