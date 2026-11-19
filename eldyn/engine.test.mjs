import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { WebSocket } from 'ws';
import { CASTLES, CASTLE_TYPES, VILLAGE, DUNGEONS, CAVES, RELIC_LIST, MOBS, landValue, moveBody, inCastle, inCastleWalls, losClear, passable, dungeonAt, tierOf, somaForTier } from './shared.mjs';
import { Game, CAPTURE_TIME, SEASON, BUILD_VERSION, migrateProgress, migrateBuild } from './engine.mjs';
import { TREES, TALENT_LIST, WEAPON_IDS, HOTBAR_SLOTS, masteryXp, masteryOf, forgeCost } from './builds.mjs';
import { memoryStore, accountService } from './accounts.mjs';
import { setupEldyn } from './server.mjs';

function setup(progress = {}) {
  let t = 1e12;
  const game = new Game({ now: () => t });
  const msgs = [];
  const p = game.join({ id: 'acc-1', username: 'Tester', progress: { season: SEASON, ...progress } }, (s) => msgs.push(JSON.parse(s)));
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

test('builds: five talent trees and six weapon trees that branch, with ranked passives and real abilities', () => {
  assert.equal(TREES.filter((t) => !t.weapon).length, 5);
  assert.deepEqual(TREES.filter((t) => t.weapon).map((t) => t.weapon), WEAPON_IDS);
  assert.equal(WEAPON_IDS.length, 6);
  for (const tr of TREES) {
    const list = TALENT_LIST.filter((n) => n.tree === tr.id), kids = new Map();
    for (const n of list) if (n.req) kids.set(n.req, (kids.get(n.req) || 0) + 1);
    assert.ok([...kids.values()].some((k) => k >= 2), `${tr.id} branches`);
    assert.ok(list.filter((n) => !n.active).length > list.filter((n) => n.active).length, `${tr.id} is mostly passives`);
    assert.ok(list.some((n) => n.max > 1), `${tr.id} has ranked talents`);
  }
  for (const n of TALENT_LIST) if (n.active) assert.ok(n.active.cd >= 5000 && n.active.en > 0, n.id);
});

test('talents need points, the parent talent, and 2 points per row in the tree; you start with one point', () => {
  const { game, p, msgs } = setup({ bv: BUILD_VERSION, soma: somaForTier(5) });
  assert.equal(p.tier, 5); assert.equal(p.pts, 6);
  game.handle(p, { t: 'learn', id: 'wide_swings' });
  assert.ok(!p.tal.wide_swings, 'needs Brutality first');
  game.handle(p, { t: 'learn', id: 'brutality' });
  game.handle(p, { t: 'learn', id: 'wide_swings' });
  assert.ok(!p.tal.wide_swings, 'row 1 needs 2 points in Warfare');
  assert.match(msgs.filter((m) => m.t === 'err').at(-1).m, /2 points/);
  game.handle(p, { t: 'learn', id: 'brutality' });
  game.handle(p, { t: 'learn', id: 'wide_swings' });
  assert.equal(p.tal.brutality, 2); assert.equal(p.tal.wide_swings, 1); assert.equal(p.pts, 3);
  assert.ok(Math.abs(p.st.melee - 0.1) < 1e-9 && Math.abs(p.st.arc - 0.12) < 1e-9, 'ranks add up into stats');
  game.handle(p, { t: 'learn', id: 'bloodlust' }); game.handle(p, { t: 'learn', id: 'war_cry' });
  assert.ok(p.tal.war_cry && p.hotbar.includes('war_cry'), 'abilities go on the hotbar');
  assert.ok(!p.hotbar.includes('bloodlust'), 'passives do not');
});

test('weapon mastery: soma trains the weapon in hand, and its talents only work while you wield it', () => {
  const { game, p } = setup({ bv: BUILD_VERSION, soma: somaForTier(5) });
  assert.equal(p.wp, 'sword'); assert.equal(p.mlv.sword, 0);
  game.gain(p, 0, masteryXp(3));
  assert.equal(p.mlv.sword, 3); assert.equal(p.mlv.bow, 0); assert.equal(p.mpts.sword, 3);
  game.handle(p, { t: 'learn', id: 'sw_edge' }); game.handle(p, { t: 'learn', id: 'sw_edge' });
  assert.ok(Math.abs(p.st.wdmg - 0.1) < 1e-9);
  game.handle(p, { t: 'learn', id: 'bw_draw' });
  assert.ok(!p.tal.bw_draw, 'no bow mastery yet');
  game.handle(p, { t: 'swap' });
  assert.equal(p.wp, 'bow'); assert.ok(!p.st.wdmg, 'sword talents switch off with the sword away');
});

test('holding attack swings the weapon in hand: melee arcs, piercing thrusts, arrows and bursting bolts', () => {
  for (const [w, kills] of [['sword', 1], ['greataxe', 2], ['spear', 3], ['daggers', 1], ['bow', 1], ['staff', 3]]) {
    const { game, p, advance } = setup({ bv: BUILD_VERSION, wset: [w, w === 'bow' ? 'sword' : 'bow'] });
    Object.assign(p, away(CASTLES[0]));
    for (const n of [...game.npcs.values()]) if (Math.hypot(n.x - p.x, n.y - p.y) < 1500) game.killNpc(n, null, true);
    const foes = [0, 1, 2].map((i) => game.mkNpc('rat', p.x + 55 + i * 26, p.y + (w === 'staff' || w === 'spear' ? 0 : (i - 1) * 24), {}));
    for (const f of foes) f.stunUntil = 1e15;
    game.gridBuild();
    p.ang = 0; game.handle(p, { t: 'atk', on: 1, a: 0 });
    for (let i = 0; i < 80; i++) { advance(50); game.tick(); }
    const hit = foes.filter((f) => f.dead || f.hp < f.maxhp).length;
    assert.ok(hit >= kills, `${w} hit ${hit} of 3`);
    assert.ok(p.en > 0);
  }
});

test('energy comes back by landing weapon hits', () => {
  const { game, p, advance } = setup({ bv: BUILD_VERSION });
  Object.assign(p, away(CASTLES[0]));
  const ogre = game.mkNpc('ogre', p.x + 50, p.y, {}); ogre.stunUntil = 1e15; game.gridBuild();
  p.en = 0; p.ang = 0;
  game.attack(p);
  assert.ok(p.en >= 2.5, 'a landed swing restores energy');
});

test('a dodge roll avoids every hit while rolling, then goes on cooldown', () => {
  const { game, p } = setup({ bv: BUILD_VERSION });
  Object.assign(p, away(CASTLES[0]));
  const ogre = game.mkNpc('ogre', p.x + 40, p.y, {}); game.gridBuild();
  game.handle(p, { t: 'roll', a: 0 });
  assert.equal(game.dealDamage(ogre, p, 50), 0, 'dodged');
  const cd = p.cds.roll;
  game.handle(p, { t: 'roll', a: 0 });
  assert.equal(p.cds.roll, cd, 'cannot roll again yet');
  p.iframeUntil = 0;
  assert.ok(game.dealDamage(ogre, p, 50) > 0);
});

test('weapon abilities need their weapon in hand; the pair of weapons changes only where allowed', () => {
  const { game, p, msgs } = setup({ bv: BUILD_VERSION, soma: somaForTier(10), wx: { sword: masteryXp(5) } });
  for (const id of ['sw_edge', 'sw_edge', 'sw_edge', 'sw_combo', 'whirlwind']) game.handle(p, { t: 'learn', id });
  assert.ok(p.tal.whirlwind);
  Object.assign(p, away(CASTLES[0]));
  game.handle(p, { t: 'swap' });
  p.en = 100; game.cast(p, p.hotbar.indexOf('whirlwind'), 0);
  assert.ok(!p.spin && msgs.some((m) => m.t === 'err' && /needs your Longsword/.test(m.m)));
  game.handle(p, { t: 'wset', s: 1, w: 'staff' });
  assert.deepEqual(p.wset, ['sword', 'bow'], 'not out in the wild');
  p.x = VILLAGE.x + 40; p.y = VILLAGE.y;
  game.handle(p, { t: 'wset', s: 1, w: 'staff' });
  assert.deepEqual(p.wset, ['sword', 'staff']); assert.equal(p.wp, 'staff');
});

test('the blacksmith forges weapons for banked gold in the Haven', () => {
  const { game, p } = setup({ bv: BUILD_VERSION, bank: 1000 });
  Object.assign(p, away(CASTLES[0]));
  game.handle(p, { t: 'forge', w: 'sword' });
  assert.equal(p.forge.sword, 0);
  p.x = VILLAGE.x + 40; p.y = VILLAGE.y;
  const before = game.wdmg(p);
  game.handle(p, { t: 'forge', w: 'sword' }); game.handle(p, { t: 'forge', w: 'sword' });
  assert.equal(p.forge.sword, 2); assert.equal(p.bank, 1000 - forgeCost(1) - forgeCost(2));
  assert.ok(Math.abs(game.wdmg(p) / before - 1.12) < 1e-9);
});

test('talents and mastery reset only in the village, one tree at a time', () => {
  const { game, p } = setup({ bv: BUILD_VERSION, soma: somaForTier(5), wx: { sword: masteryXp(2) }, tal: { brutality: 2, sw_edge: 2 } });
  assert.equal(p.tal.brutality, 2); assert.equal(p.tal.sw_edge, 2);
  Object.assign(p, away(CASTLES[0]));
  game.handle(p, { t: 'reset' });
  assert.equal(p.tal.brutality, 2);
  p.x = VILLAGE.x + 60; p.y = VILLAGE.y;
  game.handle(p, { t: 'reset' });
  assert.ok(!p.tal.brutality && p.tal.sw_edge === 2, 'talents reset, mastery kept');
  game.handle(p, { t: 'reset', w: 'sword' });
  assert.deepEqual(p.tal, {});
});

test('the combat rework refunds old skills once and seeds mastery from soma', () => {
  const { progress } = migrateProgress({ season: SEASON, soma: 2000, skills: ['slash', 'arrow', 'cleave'], hotbar: ['slash', 'cleave'] });
  const b = migrateBuild(progress);
  assert.deepEqual(b.tal, {}); assert.equal(b.wx.spear, 500); assert.ok(b.note);
  assert.equal(migrateBuild({ bv: BUILD_VERSION, tal: { brutality: 1 } }).tal.brutality, 1, 'only once');
  const { p } = setup({ soma: 2000, skills: ['slash', 'cleave'] });
  assert.equal(p.mlv.sword, masteryOf(500)); assert.deepEqual(p.tal, {});
  assert.equal(p.hotbar.length, HOTBAR_SLOTS);
});

test('synergy: Bloodlust heals on melee hits, Backstab rewards striking a distracted foe', () => {
  const { game, p } = setup({ bv: BUILD_VERSION, soma: somaForTier(8), wx: { daggers: masteryXp(4) }, tal: { brutality: 2, bloodlust: 3, dg_sharp: 2, dg_backstab: 1 }, wset: ['daggers', 'bow'] });
  Object.assign(p, away(CASTLES[0]));
  const ogre = game.mkNpc('ogre', p.x + 40, p.y, {}); game.gridBuild();
  p.hp = 50; p.st.crit = 0;
  game.dealDamage(p, ogre, 100, { melee: true, premul: true });
  assert.ok(p.hp > 50, 'healed by Bloodlust');
  ogre.ang = Math.PI; // facing you
  const facing = game.dealDamage(p, ogre, 100, { melee: true, premul: true, back: 0.3 });
  ogre.ang = 0; // facing away
  const behind = game.dealDamage(p, ogre, 100, { melee: true, premul: true, back: 0.3 });
  assert.ok(behind > facing * 1.4, `${behind} vs ${facing}`);
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
  const world = { season: SEASON, factions: { 3: { id: 3, name: 'Gulls', color: '#3498db', leader: 'a', leaderName: 'A', members: ['acc-1'] } }, castles: { [c.id]: { o: 3, l: 3 } }, nextFac: 4 };
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
    for (const f of ['shared.mjs', 'builds.mjs', 'terrain.mjs', 'chunkworker.mjs', 'sprites.mjs', 'client.mjs']) assert.match((await fetch(`http://${base}/eldyn/${f}`)).headers.get('content-type'), /javascript/, f);
    // Every file reference is versioned so stale caches can never mix old and new files.
    const html = await (await fetch(`http://${base}/eldyn/`)).text(), v = html.match(/style\.css\?v=(\w+)/)[1];
    assert.match(html, new RegExp(`client\\.mjs\\?v=${v}`));
    const client = await (await fetch(`http://${base}/eldyn/client.mjs?v=${v}`)).text();
    assert.match(client, new RegExp(`'\\./shared\\.mjs\\?v=${v}'`)); assert.match(client, new RegExp(`'\\./chunkworker\\.mjs\\?v=${v}'`));
    const css = await fetch(`http://${base}/eldyn/style.css?v=${v}`);
    assert.match(css.headers.get('cache-control'), /immutable/); assert.match(await css.text(), /\.relic \{/);
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

test('season 2: veterans start fresh with a badge, a capped head start and their old record kept', () => {
  const { progress, note } = migrateProgress({ soma: 26000, valor: 3500, skills: ['cleave'], fac: 3 });
  assert.equal(progress.season, SEASON); assert.equal(progress.vet, 1); assert.equal(progress.bank, 300);
  assert.equal(progress.soma, somaForTier(5), 'head start capped at tier 5');
  assert.equal(progress.legacy.soma, 26000); assert.equal(progress.fac, 3); assert.ok(note);
  assert.equal(migrateProgress({ soma: 900 }).progress.soma, 90, '10% of old soma');
  const fresh = migrateProgress({});
  assert.ok(!fresh.progress.vet && !fresh.note && fresh.progress.soma === 0, 'brand-new players are not veterans');
  assert.equal(migrateProgress(progress).progress, progress, 'migrates only once');
});

test('old castle owners are cleared for the new season, but factions stay', () => {
  const c = CASTLES[2];
  const game = new Game({ world: { factions: { 3: { id: 3, name: 'Gulls', color: '#3498db', leader: 'a', members: ['a'] } }, castles: { [c.id]: 3 }, nextFac: 4 }, now: () => 1e12 });
  assert.equal(game.castles.find((k) => k.id === c.id).owner, 0);
  assert.ok(game.factions[3]);
});

test('newcomers earn double soma until tier 5', () => {
  const { game, p } = setup();
  game.gain(p, 0, 10);
  assert.equal(p.soma, 20);
  p.soma = somaForTier(5); p.tier = 5;
  game.gain(p, 0, 10);
  assert.equal(p.soma, somaForTier(5) + 10);
});
