import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { WebSocket } from 'ws';
import { CASTLES, CASTLE_TYPES, VILLAGE, SKILLS, SKILL_LIST, TREES, DUNGEONS, CAVES, RELIC_LIST, MOBS, landValue, moveBody, inCastle, inCastleWalls, losClear, passable, dungeonAt, tierOf, somaForTier } from './shared.mjs';
import { Game, CAPTURE_TIME } from './engine.mjs';
import { memoryStore, accountService } from './accounts.mjs';
import { setupEldyn } from './server.mjs';

function setup(progress = {}) {
  let t = 1e12;
  const game = new Game({ now: () => t });
  const msgs = [];
  const p = game.join({ id: 'acc-1', username: 'Tester', progress }, (s) => msgs.push(JSON.parse(s)));
  game.gridBuild();
  return { game, p, msgs, advance: (ms) => { t += ms; } };
}
const away = (c) => ({ x: c.x + CASTLE_TYPES[c.type].outer + 500, y: c.y });

test('castles of all three kinds stand on land, well apart, away from the village', () => {
  const kinds = new Set(CASTLES.map((c) => c.type));
  assert.deepEqual([...kinds].sort(), ['castle', 'citadel', 'fort']);
  for (const c of CASTLES) {
    const o = CASTLE_TYPES[c.type].outer;
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) assert.ok(landValue(c.x + dx * o, c.y + dy * o) > 0, c.name);
    assert.ok(Math.hypot(c.x - VILLAGE.x, c.y - VILLAGE.y) > 1000, c.name);
    for (const d of CASTLES) if (d !== c) assert.ok(Math.hypot(c.x - d.x, c.y - d.y) > o + CASTLE_TYPES[d.type].outer + 200, `${c.name} / ${d.name}`);
  }
  assert.ok(CASTLES.length >= 40, 'a big map');
});

test('walls stop movement and sight; the gates lead in to the inner courtyard', () => {
  for (const c of [CASTLES.find((k) => k.type === 'fort'), CASTLES.find((k) => k.type === 'castle')]) {
    const L = CASTLE_TYPES[c.type];
    let [x, y] = moveBody(c.x - L.outer - 40, c.y, 14, 200, 0);
    assert.ok(x < c.x - L.outer + 1, `${c.type}: blocked by the west wall`);
    assert.equal(losClear(c.x - L.outer - 40, c.y, c.x - L.outer + 60, c.y), false);
    // In through the outer south gate.
    [x, y] = moveBody(c.x, c.y + L.outer + 60, 14, 0, -120);
    assert.ok(inCastleWalls(c, x, y), `${c.type}: through the gate`);
  }
});

test('dungeons are walkable chains of rooms reached through cave mouths', () => {
  assert.equal(DUNGEONS.length, 6); assert.equal(CAVES.length, 6);
  for (const d of DUNGEONS) {
    assert.ok(passable(d.start.x, d.start.y, 14), d.name);
    assert.ok(passable(d.rooms.at(-1).x, d.rooms.at(-1).y, 30), d.name + ' boss room');
    assert.equal(dungeonAt(d.start.x, d.start.y), d);
    assert.equal(passable(d.bx - 40, d.start.y, 14), false, 'outside the rooms is solid');
  }
  const { game, p, advance } = setup();
  const cave = CAVES[0];
  p.x = cave.x; p.y = cave.y; advance(50); game.tick();
  assert.ok(dungeonAt(p.x, p.y), 'walking into the cave takes you down');
  assert.ok([...game.npcs.values()].some((n) => n.def.boss && n.dungeon === cave.dungeon), 'the boss is home');
});

test('soma tiers get steeper: early tiers are quick, later ones take far longer', () => {
  assert.equal(tierOf(0), 0); assert.equal(tierOf(somaForTier(10)), 10); assert.equal(tierOf(somaForTier(10) - 1), 9);
  assert.ok(somaForTier(20) - somaForTier(19) > 10 * (somaForTier(2) - somaForTier(1)));
});

test('skill trees have five branching trees with long cooldowns', () => {
  assert.equal(TREES.length, 5);
  for (const tr of TREES) {
    const kids = new Map();
    for (const s of SKILL_LIST.filter((k) => k.tree === tr.id)) if (s.req) kids.set(s.req, (kids.get(s.req) || 0) + 1);
    assert.ok([...kids.values()].some((n) => n >= 2), `${tr.id} branches`);
  }
  for (const s of SKILL_LIST) if (!s.free && !s.passive) assert.ok(s.cd >= 2500, s.id);
});

test('learning needs points, tier and the parent skill; you start with one point', () => {
  const { game, p } = setup({ soma: somaForTier(5) });
  assert.equal(p.tier, 5); assert.equal(p.pts, 6);
  game.handle(p, { t: 'learn', id: 'whirlwind' });
  assert.ok(!p.skills.includes('whirlwind'));
  game.handle(p, { t: 'learn', id: 'cleave' });
  game.handle(p, { t: 'learn', id: 'whirlwind' });
  assert.ok(p.skills.includes('whirlwind'));
  game.handle(p, { t: 'learn', id: 'heavy_blade' });
  assert.ok(p.skills.includes('heavy_blade') && !p.hotbar.includes('heavy_blade'));
});

test('skill points reset only in the village', () => {
  const { game, p } = setup({ soma: somaForTier(5), skills: ['cleave', 'parry'] });
  Object.assign(p, away(CASTLES[0]));
  game.handle(p, { t: 'reset' });
  assert.ok(p.skills.includes('cleave'));
  p.x = VILLAGE.x + 60; p.y = VILLAGE.y;
  game.handle(p, { t: 'reset' });
  assert.deepEqual(p.skills.sort(), ['arrow', 'slash']);
});

test('dying drops half your carried gold for anyone to pick up, but banked gold is safe', () => {
  const { game, p, msgs } = setup({ valor: 1000, gold: 300, bank: 500 });
  Object.assign(p, away(CASTLES[0]));
  game.killPlayer(p, null);
  assert.equal(p.valor, 250); assert.equal(p.gold, 150); assert.equal(p.bank, 500);
  assert.equal([...game.loot.values()][0].gold, 150);
  assert.ok(msgs.some((m) => m.t === 'died' && m.gold === 150));
});

test('walking into the Haven banks carried gold', () => {
  const { game, p, advance } = setup({ gold: 120 });
  p.x = VILLAGE.x + 40; p.y = VILLAGE.y;
  advance(50); game.tick();
  assert.equal(p.gold, 0); assert.equal(p.bank, 120);
});

test('relics: equip only where allowed, no duplicates, fuse pairs, salvage for gold', () => {
  const { game, p } = setup({ soma: somaForTier(8), bank: 1000, relics: [{ u: 1, k: 'leech_fang', lv: 1 }, { u: 2, k: 'leech_fang', lv: 1 }, { u: 3, k: 'whetstone', lv: 1 }] });
  assert.equal(p.rslots, 3);
  Object.assign(p, away(CASTLES[0]));
  game.handle(p, { t: 'equip', u: 1, s: 0 });
  assert.deepEqual(p.equip, [], 'not out in the wild');
  p.x = VILLAGE.x + 40; p.y = VILLAGE.y;
  game.handle(p, { t: 'equip', u: 1, s: 0 });
  game.handle(p, { t: 'equip', u: 2, s: 1 });
  assert.deepEqual(p.equip, [1], 'no two of the same relic');
  assert.ok(Math.abs(p.rel.lifesteal - 0.05) < 1e-9);
  game.handle(p, { t: 'fuse', u: 1 });
  assert.equal(p.relics.find((r) => r.u === 1).lv, 2);
  assert.equal(p.relics.length, 2); assert.equal(p.bank, 1000 - 180);
  assert.ok(Math.abs(p.rel.lifesteal - 0.062) < 1e-9);
  game.handle(p, { t: 'salvage', u: 3 });
  assert.equal(p.bank, 1000 - 180 + 25);
});

test('relic synergy: pull, close-range and lifesteal work together on a hit', () => {
  const { game, p } = setup({ soma: somaForTier(12), relics: [{ u: 1, k: 'lodestone', lv: 1 }, { u: 2, k: 'brawler_knuckles', lv: 1 }, { u: 3, k: 'leech_fang', lv: 1 }], equip: [1, 2, 3] });
  Object.assign(p, away(CASTLES[0]));
  const far = game.mkNpc('ogre', p.x + 200, p.y, {});
  const near = game.mkNpc('ogre', p.x + 60, p.y + 200, {});
  game.gridBuild();
  p.hp = p.maxhp / 2;
  const before = far.x, hpBefore = p.hp;
  const dFar = game.dealDamage(p, far, 40, { premul: true });
  assert.ok(far.x < before - 30, 'pulled toward you');
  assert.ok(p.hp > hpBefore, 'healed by lifesteal');
  near.x = p.x + 60; near.y = p.y;
  const dNear = game.dealDamage(p, near, 40, { premul: true });
  assert.equal(dNear, Math.round(40 * 1.25), 'close-range bonus');
  assert.equal(dFar, 40);
});

test('splash damage hits the pack around your target, but never cascades', () => {
  const { game, p } = setup({ soma: somaForTier(12), relics: [{ u: 1, k: 'shrapnel_core', lv: 1 }, { u: 2, k: 'prism_echoes', lv: 1 }], equip: [1, 2] });
  Object.assign(p, away(CASTLES[0]));
  const pack = [0, 1, 2, 3].map((i) => game.mkNpc('ogre', p.x + 200 + i * 20, p.y + (i % 2) * 20, {}));
  game.gridBuild();
  game.dealDamage(p, pack[0], 100, { premul: true });
  for (const n of pack.slice(1)) assert.equal(n.maxhp - n.hp, 25, 'each neighbour takes 25%');
});

test('elites and bosses drop relics', () => {
  const { game, p } = setup();
  Object.assign(p, away(CASTLES[0]));
  const boss = game.mkNpc('bone_king', p.x + 100, p.y, {});
  game.killNpc(boss, p);
  const drops = [...game.loot.values()];
  assert.ok(drops.filter((l) => l.relic).length >= 2 && drops.some((l) => l.gold));
  assert.ok(drops.every((l) => l.owner === 'acc-1'), 'reserved for the killer at first');
});

test('enemy variety: many kinds with different behaviours', () => {
  const ais = new Set(Object.values(MOBS).map((m) => m.ai));
  for (const a of ['melee', 'kite', 'charger', 'leaper', 'caster', 'healer', 'summoner', 'exploder', 'slam', 'boss']) assert.ok(ais.has(a), a);
  assert.ok(Object.keys(MOBS).length >= 30);
  assert.ok(RELIC_LIST.length >= 25);
});

test('a faction captures a castle by clearing its garrison and holding the inner courtyard', () => {
  const { game, p, msgs, advance } = setup({ soma: 40000 });
  game.handle(p, { t: 'fc', n: 'Red Wolves' });
  assert.ok(p.fac);
  const c = game.castles.find((k) => k.type === 'castle');
  p.x = c.x; p.y = c.y + CASTLE_TYPES.castle.inner - 30;
  assert.ok(inCastle(c, p.x, p.y));
  for (let i = 0; i < (CAPTURE_TIME + 3) * 20; i++) {
    advance(50); game.tick();
    for (const id of c.slots) { const n = game.npcs.get(id); if (n && n.team === 'wild') game.killNpc(n, p); }
    p.hp = p.maxhp; p.x = c.x; p.y = c.y + CASTLE_TYPES.castle.inner - 30;
  }
  assert.equal(c.owner, p.fac);
  assert.ok(msgs.some((m) => m.t === 'msg' && /conquered/.test(m.m)));
  // Fortifying needs banked gold.
  p.bank = 5000;
  const before = c.slots.length;
  game.handle(p, { t: 'fortify', id: c.id });
  assert.equal(c.level, 2); assert.ok(c.slots.length > before); assert.equal(p.bank, 4200);
  assert.deepEqual(game.worldState().castles, { [c.id]: { o: p.fac, l: 2 } });
});

test('faction names allow spaces and accents, and errors are reported', () => {
  const { game, p, msgs } = setup();
  game.handle(p, { t: 'fc', n: 'x' });
  assert.ok(msgs.some((m) => m.t === 'err'));
  game.handle(p, { t: 'fc', n: 'Les Épées' });
  assert.ok(p.fac);
});

test('a saved world is restored, including castle owners and levels', () => {
  const c = CASTLES[2];
  const world = { factions: { 3: { id: 3, name: 'Gulls', color: '#3498db', leader: 'a', leaderName: 'A', members: ['acc-1'] } }, castles: { [c.id]: { o: 3, l: 3 } }, nextFac: 4 };
  const game = new Game({ world, now: () => 1e12 });
  const gc = game.castles.find((k) => k.id === c.id);
  assert.equal(gc.owner, 3); assert.equal(gc.level, 3);
});

test('client movement is limited by speed and walls; stale positions are ignored', () => {
  const { game, p, advance } = setup();
  const c = CASTLES[0], L = CASTLE_TYPES[c.type];
  p.x = c.x - L.outer - 60; p.y = c.y;
  for (let i = 0; i < 10; i++) { advance(50); game.tick(); }
  const x0 = p.x;
  game.handle(p, { t: 'in', a: 0, x: p.x + 1000, y: p.y, tp: p.tp });
  assert.ok(p.x - x0 <= 190 * 0.5 + 1);
  for (let i = 0; i < 20; i++) { advance(50); game.tick(); game.handle(p, { t: 'in', a: 0, x: p.x + 20, y: p.y, tp: p.tp }); }
  assert.ok(p.x < c.x - L.outer + 1);
  const x1 = p.x;
  game.handle(p, { t: 'in', a: 0, x: p.x - 10, y: p.y, tp: p.tp - 1 });
  assert.equal(p.x, x1);
});

test('accounts: register, reject duplicates and wrong passwords, sign in by session', async () => {
  const store = memoryStore(), acc = accountService(store, { rounds: 4 });
  const r = await acc.register('Aria', 'hunter22');
  await assert.rejects(acc.register('aria', 'whatever1'), /taken/);
  await assert.rejects(acc.login('Aria', 'wrongpass'), /Wrong/);
  const l = await acc.login('ARIA', 'hunter22');
  assert.equal(await acc.bySession(r.session), null);
  assert.equal((await acc.bySession(l.session)).username, 'Aria');
});

test('server: sign up over HTTP, join over WebSocket, progress is saved on leave', async () => {
  const store = memoryStore(), app = express(), server = http.createServer(app);
  const h = setupEldyn(app, server, { store });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `127.0.0.1:${server.address().port}`;
  try {
    const page = await fetch(`http://${base}/eldyn/`);
    assert.match(await page.text(), /Hanbin Island/);
    for (const f of ['shared.mjs', 'terrain.mjs', 'chunkworker.mjs', 'sprites.mjs', 'client.mjs']) assert.match((await fetch(`http://${base}/eldyn/${f}`)).headers.get('content-type'), /javascript/, f);
    const reg = await (await fetch(`http://${base}/eldyn/api/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'Bram', password: 'castle99' }) })).json();
    const ws = new WebSocket(`ws://${base}/eldyn/ws`);
    const seen = new Set();
    await new Promise((resolve, reject) => {
      ws.on('open', () => ws.send(JSON.stringify({ t: 'join', session: reg.session })));
      ws.on('message', (d) => { const m = JSON.parse(d); seen.add(m.t); if (seen.has('welcome') && seen.has('s')) resolve(); });
      ws.on('error', reject);
      setTimeout(() => reject(new Error('no snapshot: ' + [...seen])), 6000);
    });
    const p = [...h.game.players.values()][0];
    p.soma = 777; p.bank = 55; p.relics.push({ u: 9, k: 'keen_edge', lv: 2 });
    ws.close();
    await new Promise((r) => setTimeout(r, 200));
    const a = await store.byKey('bram');
    assert.equal(a.progress.soma, 777); assert.equal(a.progress.bank, 55);
    assert.deepEqual(a.progress.relics, [{ u: 9, k: 'keen_edge', lv: 2 }]);
  } finally { h.close(); server.close(); }
});
