import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { WebSocket } from 'ws';
import {
  CASTLES, CASTLE_TYPES, VILLAGE, DUNGEONS, CAVES, MOBS, RANKS, landValue, moveBody, inCastleWalls, losClear, passable, dungeonAt, tierOf, somaForTier,
  valorGain, somaGain, NPC_REWARD, CAP_BASE, CAP_LIFT, PUBLIC_FACTIONS,
} from './shared.mjs';
import { Game, CAPTURE_TIME, SEASON, migrateProgress, DT } from './engine.mjs';
import {
  TOOLS, TOOL_LIST, PATHS, GROUPS, SLOTS, START_KIT, UNLOCKABLE, TTK_BANDS, TURN_RATE, BASE_HP, ATK_CAP,
  ttk, damagePerUse, burstTime, attackBuffs, keysFor,
} from './builds.mjs';
import { ARCHETYPES, roundRobin, seeded } from './balance.mjs';
import { memoryStore, accountService } from './accounts.mjs';
import { setupEldyn } from './server.mjs';

function setup(progress = {}, id = 'acc-1', name = 'Tester') {
  let t = 1e12;
  const game = new Game({ now: () => t });
  const msgs = [];
  const p = game.join({ id, username: name, progress: { season: SEASON, ...progress } }, (s) => msgs.push(JSON.parse(s)));
  game.gridBuild();
  return { game, p, msgs, advance: (ms) => { t += ms; } };
}
const away = (c) => ({ x: c.x + CASTLE_TYPES[c.type].outer + 500, y: c.y });
// Clears everything near a spot so a test fight is just what the test puts there.
function clearAround(game, x, y, r = 1500) { for (const n of [...game.npcs.values()]) if (Math.hypot(n.x - x, n.y - y) < r) game.killNpc(n, null, true); game.gridBuild(); }
function arena(progress) {
  const s = setup(progress);
  Object.assign(s.p, away(CASTLES[0]));
  clearAround(s.game, s.p.x, s.p.y);
  return s;
}
const run = (game, advance, ms) => { for (let i = 0; i < ms / 50; i++) { advance(50); game.tick(); } };
const setRank = (game, p, idx) => { p.valor = RANKS[idx].v; game.recalc(p); };
// An open spot about 100 px from a player, for placing traps.
function openSpot(game, p) { for (let a = 0; a < 6.28; a += 0.4) { const x = p.x + Math.cos(a) * 100, y = p.y + Math.sin(a) * 100; if (game.placePoint(p, 200, { ax: x, ay: y })) return { x, y }; } throw new Error('no open spot'); }

// ------------------------------------------------------------------ the map
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

test('walls stop movement and sight; the gates lead inside', () => {
  for (const c of [CASTLES.find((k) => k.type === 'fort'), CASTLES.find((k) => k.type === 'castle')]) {
    const L = CASTLE_TYPES[c.type];
    let [x, y] = moveBody(c.x - L.outer - 40, c.y, 14, 200, 0);
    assert.ok(x < c.x - L.outer + 1, `${c.type}: blocked by the west wall`);
    assert.equal(losClear(c.x - L.outer - 40, c.y, c.x - L.outer + 60, c.y), false);
    [x, y] = moveBody(c.x, c.y + L.outer + 60, 14, 0, -120);
    assert.ok(inCastleWalls(c, x, y), `${c.type}: through the gate`);
  }
});

test('dungeons are walkable chains of rooms reached through cave mouths, guarded by a Dweller in every room', () => {
  assert.equal(DUNGEONS.length, 6); assert.equal(CAVES.length, 6);
  for (const d of DUNGEONS) {
    assert.ok(passable(d.start.x, d.start.y, 14), d.name);
    assert.ok(passable(d.rooms.at(-1).x, d.rooms.at(-1).y, 30), d.name + ' boss room');
    assert.equal(dungeonAt(d.start.x, d.start.y), d);
  }
  const { game, p, advance } = setup();
  const cave = CAVES[0];
  p.x = cave.x; p.y = cave.y; advance(50); game.tick();
  assert.ok(dungeonAt(p.x, p.y), 'walking into the cave takes you down');
  assert.ok([...game.npcs.values()].some((n) => n.def.boss && n.dungeon === cave.dungeon), 'the boss is home');
  assert.ok([...game.npcs.values()].some((n) => n.kind === 'dweller' && n.dungeon === cave.dungeon));
});

// ------------------------------------------------------------------ the tool catalog and its balance gates
test('70 tools to unlock (plus 8 free) across Warrior, Hunter, Alchemist and Auxiliary, each hanging from a tool on its own path', () => {
  assert.deepEqual(PATHS.map((p) => p.id), ['warrior', 'hunter', 'alchemist', 'auxiliary']);
  assert.equal(UNLOCKABLE.length, 70); assert.equal(START_KIT.length, 8);
  assert.equal(SLOTS, 7);
  assert.ok(START_KIT.length >= SLOTS, 'a new player can fill every slot');
  for (const t of TOOL_LIST) {
    assert.ok(GROUPS[t.group], t.id);
    assert.ok(t.cd > 0 && t.desc, t.id);
    if (t.req) { assert.ok(TOOLS[t.req], t.id); assert.equal(TOOLS[t.req].path, t.path, t.id); }
    else assert.ok(START_KIT.includes(t.id), `${t.id} has no parent, so it must be free`);
  }
});

test('balance: every weapon kills inside its time-to-kill band and sidearms never carry a fight alone', () => {
  for (const t of TOOL_LIST) {
    if (!t.cls) continue;
    const k = ttk(t), [lo, hi] = TTK_BANDS[t.cls];
    assert.ok(k >= lo - 1e-9 && k <= hi + 1e-9, `${t.id}: ${k.toFixed(2)}s is outside ${lo}-${hi}`);
  }
  for (const t of TOOL_LIST.filter((x) => x.group === 'sidearm')) assert.ok(ttk(t) >= TTK_BANDS.side[0], t.id);
  assert.ok(TOOL_LIST.filter((t) => t.group === 'weapon').every((t) => damagePerUse(t) > 0));
});

test('balance: no legal kit kills an 80 HP target in under 1.2s, even with every buff up', () => {
  const weapons = TOOL_LIST.filter((t) => t.group === 'weapon'), sides = [null, ...TOOL_LIST.filter((t) => t.group === 'sidearm' && damagePerUse(t) > 0)];
  const groups = Object.values(attackBuffs()).map((a) => [null, ...a]);
  let worst = Infinity;
  const pick = (i, acc, w, s) => { if (i === groups.length) { worst = Math.min(worst, burstTime(w, s, acc.filter(Boolean))); return; } for (const b of groups[i]) pick(i + 1, [...acc, b], w, s); };
  for (const w of weapons) for (const s of sides) pick(0, [], w, s);
  assert.ok(worst >= 1200, `fastest kill ${worst}ms`);
  assert.equal(ATK_CAP[1], 75);
});

test('balance: shields trade off differently but protect about equally, and none holds +50 for more than 60% of 10s', () => {
  for (const t of TOOL_LIST.filter((x) => x.type === 'shield')) {
    const avg = (t.def * t.dur) / t.cd;
    assert.ok(avg >= 14 && avg <= 24, `${t.id} averages ${avg.toFixed(1)} defence`);
    let up = 0;
    if (t.def >= 50) for (let s = 0; s < 10000; s += t.cd) up += Math.min(t.dur, 10000 - s);
    assert.ok(up <= 6000, `${t.id} holds +${t.def} for ${up}ms of 10s`);
  }
});

test('balance: in the duel simulator no kit wins more than 60% against the field, and the starter kit wins at least 35%', () => {
  const { rate } = seeded(1, () => roundRobin(ARCHETYPES, 20));
  for (const [k, v] of Object.entries(rate)) assert.ok(v <= 0.6, `${k} wins ${(v * 100).toFixed(0)}%`);
  assert.ok(rate.starter >= 0.35, `starter wins ${(rate.starter * 100).toFixed(0)}%`);
});

test('the grind: an average player reaches tier 10 in 8-12 hours and tier 30 in 130-180 hours', () => {
  // Minute by minute: 2.5 NPC kills a minute, a death about every 28 minutes, 10% territory bonus.
  const hours = { 10: [], 30: [] };
  for (let run = 1; run <= 120; run++) {
    let s = 0, V = 0, tier = 0, r = run * 7919 + 13;
    const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
    for (let min = 1; min < 60 * 400 && tier < 30; min++) {
      const vn = 20 + 12 * tier, cap = 6000 + 400 * tier;
      for (let k = 0; k < 2.5; k++) { s += somaGain(V, vn, NPC_REWARD, 0.1); V = Math.min(cap, V + valorGain(V, vn, NPC_REWARD, 0.1)); }
      if (rnd() < 1 / 28) V = 0;
      while (somaForTier(tier + 1) <= s) { tier++; if (hours[tier]) hours[tier].push(min / 60); }
    }
  }
  const med = (a) => a.sort((x, y) => x - y)[a.length >> 1];
  assert.ok(med(hours[10]) >= 8 && med(hours[10]) <= 12, `tier 10 in ${med(hours[10]).toFixed(1)}h`);
  assert.ok(med(hours[30]) >= 130 && med(hours[30]) <= 180, `tier 30 in ${med(hours[30]).toFixed(1)}h`);
});

test('soma tiers: 69 for tier 1, 23,220 for tier 10, 970,642 for tier 30, and tierOf inverts the curve', () => {
  assert.equal(somaForTier(1), 69); assert.equal(somaForTier(10), 23220); assert.equal(somaForTier(30), 970642);
  for (const t of [1, 5, 10, 25, 50]) { assert.equal(tierOf(somaForTier(t)), t); assert.equal(tierOf(somaForTier(t) - 1), t - 1); }
});

// ------------------------------------------------------------------ unlocking and the toolbelt
test('keys: one per tier; a tool needs its parent and a key; the starting kit is free', () => {
  const { game, p, msgs } = setup({ soma: somaForTier(2) });
  assert.equal(p.tier, 2); assert.equal(p.keys, 2);
  for (const id of START_KIT) assert.ok(TOOLS[id]);
  game.handle(p, { t: 'unlock', id: 'partisan' });
  assert.ok(!p.unlocked.includes('partisan') && /Pike first/.test(msgs.filter((m) => m.t === 'err').at(-1).m));
  game.handle(p, { t: 'unlock', id: 'pike' }); game.handle(p, { t: 'unlock', id: 'partisan' });
  assert.deepEqual(p.unlocked, ['pike', 'partisan']); assert.equal(p.keys, 0);
  game.handle(p, { t: 'unlock', id: 'glaive' });
  assert.ok(!p.unlocked.includes('glaive'), 'no keys left');
  assert.equal(keysFor(5, ['pike']), 4);
});

test('the toolbelt changes only in the Haven or your own castle; new players start with a full belt', () => {
  const { game, p, msgs } = setup({ soma: somaForTier(1), unlocked: ['pike'] });
  assert.equal(p.belt.length, SLOTS); assert.ok(p.belt.every(Boolean));
  Object.assign(p, away(CASTLES[0]));
  game.handle(p, { t: 'belt', s: 0, id: 'pike' });
  assert.notEqual(p.belt[0], 'pike'); assert.match(msgs.at(-1).m, /Haven/);
  p.x = VILLAGE.x + 30; p.y = VILLAGE.y;
  game.handle(p, { t: 'belt', s: 0, id: 'pike' });
  assert.equal(p.belt[0], 'pike');
  game.handle(p, { t: 'belt', s: 1, id: 'greatsword' });
  assert.notEqual(p.belt[1], 'greatsword', 'only owned tools');
});

test('respec returns every key for 5% of your soma, only in the Haven', () => {
  const { game, p } = setup({ soma: somaForTier(10), unlocked: ['pike', 'partisan'] });
  Object.assign(p, away(CASTLES[0]));
  game.handle(p, { t: 'respec' });
  assert.equal(p.unlocked.length, 2);
  p.x = VILLAGE.x; p.y = VILLAGE.y;
  const before = p.soma;
  game.handle(p, { t: 'respec' });
  assert.deepEqual(p.unlocked, []); assert.equal(p.soma, before - Math.floor(before * 0.05)); assert.equal(p.tier, 9);
});

// ------------------------------------------------------------------ combat rules
test('tools in the same group share a cooldown; tools in different groups work together', () => {
  const { game, p, advance } = arena();
  p.belt = ['spear', 'shortsword', 'buckler', 'bollock', null, null, null];
  game.handle(p, { t: 'use', s: 0, on: 1, a: 0 }); game.handle(p, { t: 'use', s: 0, on: 0 });
  assert.ok(p.gcd.weapon > game.T);
  const until = p.gcd.weapon;
  game.handle(p, { t: 'use', s: 1, on: 1, a: 0 }); game.handle(p, { t: 'use', s: 1, on: 0 });
  assert.equal(p.gcd.weapon, until, 'the Shortsword waits for the Spear');
  game.handle(p, { t: 'use', s: 2, on: 1, a: 0 }); game.handle(p, { t: 'use', s: 3, on: 1, a: 0 });
  assert.ok(p.gcd.shield > game.T && p.gcd.sidearm > game.T, 'shield and sidearm alongside the weapon');
  void advance;
});

test('damage = base × (1 + attack/100) × (1 − defence/100), with caps, unrounded', () => {
  const { game, p } = arena();
  const n = game.mkNpc('reiver', p.x + 40, p.y, {}); n.target = null; game.gridBuild();
  game.addEff(p, { atk: 30 }, 5000); game.addEff(n, { def: 35 }, 5000);
  const hp = n.hp, dealt = game.dealDamage(p, n, 10, {});
  assert.ok(Math.abs(dealt - 10 * 1.3 * 0.65) < 1e-9); assert.ok(Math.abs(n.hp - (hp - dealt)) < 1e-9);
  game.addEff(p, { atk: 500 }, 5000); game.addEff(n, { def: 500 }, 5000);
  assert.ok(Math.abs(game.dealDamage(p, n, 10, {}) - 10 * 1.75 * 0.1) < 1e-9, 'attack capped at +75, defence at 90');
  game.addEff(n, { def: -1000 }, 5000);
  assert.equal(game.defOf(n), -50);
});

test('your facing turns toward the aim at a fixed rate, and attacks go where you face', () => {
  const { game, p, advance } = arena();
  p.ang = 0; game.handle(p, { t: 'in', a: Math.PI, x: p.x, y: p.y, tp: p.tp });
  advance(50); game.tick();
  assert.ok(Math.abs(p.ang - TURN_RATE * DT) < 1e-6 || Math.abs(p.ang + TURN_RATE * DT) < 1e-6);
  run(game, advance, 400);
  assert.ok(Math.abs(Math.abs(p.ang) - Math.PI) < 1e-6);
});

test('a Battleaxe swings four times and only hits foes still in the arc', () => {
  const { game, p, advance } = arena({ soma: somaForTier(1), unlocked: ['battleaxe'] });
  p.belt[0] = 'battleaxe'; p.ang = p.aim = 0;
  const n = game.mkNpc('ogre', p.x + 60, p.y, {}); n.hp = n.maxhp = 500; n.def = { ...n.def, spd: 0, dmg: 0 }; game.gridBuild();
  game.handle(p, { t: 'use', s: 0, on: 1, a: 0 }); game.handle(p, { t: 'use', s: 0, on: 0 });
  run(game, advance, 500);
  const after2 = n.hp;
  assert.ok(Math.abs(500 - after2 - 16) < 1, `two swings of 8 landed (${500 - after2})`);
  n.x += 400; game.gridBuild();
  run(game, advance, 1200);
  assert.equal(n.hp, after2, 'the last two swings missed');
});

test('Parry blocks the next melee hit and weakens the attacker; Riposte only works right after', () => {
  const { game, p, advance, msgs } = arena({ soma: somaForTier(2), unlocked: ['parry', 'riposte'] });
  p.belt = ['spear', 'parry', 'riposte', null, null, null, null];
  const n = game.mkNpc('reiver', p.x + 40, p.y, {}); n.target = null; game.gridBuild();
  game.handle(p, { t: 'use', s: 2, on: 1, a: 0 }); game.handle(p, { t: 'use', s: 2, on: 0 });
  assert.match(msgs.filter((m) => m.t === 'err').at(-1).m, /just after/);
  game.handle(p, { t: 'use', s: 1, on: 1, a: 0 }); game.handle(p, { t: 'use', s: 1, on: 0 });
  assert.equal(game.dealDamage(n, p, 20, { melee: true }), 0);
  assert.ok(game.atkOf(n) < 0 && game.atkOf(p) > 0);
  assert.ok(game.dealDamage(n, p, 20, { melee: true }) > 0, 'only one hit is parried');
  game.handle(p, { t: 'use', s: 2, on: 1, a: 0 });
  assert.ok(p.gcd.maneuver > game.T);
  void advance;
});

test('shields and heals have costs: a Poultice heals but lowers your defence and speed', () => {
  const { game, p, advance } = arena({ soma: somaForTier(2), unlocked: ['tincture', 'poultice'] });
  p.belt = ['spear', 'buckler', 'poultice', 'rations', null, null, null];
  p.hp = 30;
  game.handle(p, { t: 'use', s: 2, on: 1 }); game.handle(p, { t: 'use', s: 2, on: 0 });
  assert.equal(game.defOf(p), -25); assert.ok(game.speedOf(p) < 190);
  run(game, advance, 5000);
  assert.ok(p.hp >= 54 && p.hp <= 61, `healed to ${p.hp} (25 from the Poultice, plus resting)`);
  game.handle(p, { t: 'use', s: 1, on: 1 });
  assert.equal(game.defOf(p), 35);
});

test('the Scutum protects allies behind and beside you, up to +20 from allies', () => {
  const { game, p, advance } = arena({ soma: somaForTier(2), unlocked: ['targe', 'scutum'] });
  p.belt[2] = 'scutum'; p.ang = p.aim = 0;
  const ally = game.mkNpc('hire_guard', p.x - 50, p.y, { owner: p.id }); game.gridBuild();
  game.handle(p, { t: 'use', s: 2, on: 1, a: 0 }); game.handle(p, { t: 'use', s: 2, on: 0 });
  advance(50); game.tick(); advance(50); game.tick();
  assert.equal(game.defOf(ally), 4);
  game.addEff(ally, { def: 30, ally: 1, tag: 'x' }, 2000);
  assert.equal(game.defOf(ally), 20, 'ally shields are capped');
});

// ------------------------------------------------------------------ valor, soma and ranks
test('kills pay Valor and Soma from the formulas: NPCs a fifth of players, more when you carry more Valor', () => {
  const { game, p } = arena();
  const n = game.mkNpc('reiver', p.x + 40, p.y, {}); game.gridBuild();
  game.killNpc(n, p);
  assert.ok(Math.abs(p.valor - valorGain(0, 60, NPC_REWARD, 0)) < 1e-9);
  assert.ok(Math.abs(p.soma - somaGain(0, 60, NPC_REWARD, 0)) < 1e-9);
  p.valor = 1000; const s0 = p.soma;
  game.killNpc(game.mkNpc('reiver', p.x + 40, p.y, {}), p);
  assert.ok(p.soma - s0 > 20, 'carrying Valor multiplies Soma');
  p.valor = CAP_BASE - 1;
  game.gain(p, 500, 0);
  assert.equal(p.valor, CAP_BASE, 'capped by territory');
});

test('dying loses all Valor (and half the carried gold and wood) but never Soma or unlocks', () => {
  const { game, p, msgs } = arena({ soma: somaForTier(3), unlocked: ['pike'] });
  p.valor = 700; game.recalc(p); p.gold = 40; p.wood = 9;
  assert.equal(p.maxhp, 100, 'Guard and Knight add 10 health each');
  const soma = p.soma;
  game.killPlayer(p, null);
  assert.equal(p.valor, 0); assert.equal(p.soma, soma); assert.deepEqual(p.unlocked, ['pike']);
  assert.equal(p.gold, 20); assert.equal(p.wood, 5); assert.equal(p.maxhp, 80);
  assert.ok(msgs.some((m) => m.t === 'died'));
  assert.ok([...game.loot.values()].some((l) => l.gold === 20 && l.wood === 4));
});

test('killing a player pays far more, but not twice in ten minutes', () => {
  const { game, p } = arena();
  const q = game.join({ id: 'acc-2', username: 'Foe', progress: { season: SEASON } }, () => {});
  if (q.fac === p.fac) game.setFaction(q, PUBLIC_FACTIONS.find((f) => f.id !== p.fac).id, true);
  q.x = p.x + 40; q.y = p.y; q.valor = 2000; game.gridBuild();
  game.killPlayer(q, p);
  assert.ok(Math.abs(p.valor - valorGain(0, 2000, 1, 0)) < 1e-9);
  const v = p.valor; q.dead = false; q.valor = 2000;
  game.killPlayer(q, p);
  assert.equal(p.valor, v);
});

test('after dying you rise in the Haven or a fort your faction holds', () => {
  const { game, p, advance } = arena();
  const fort = game.castles.find((c) => c.type === 'fort');
  fort.owner = p.fac; game.refreshFactionStats();
  game.killPlayer(p, null);
  game.handle(p, { t: 'respawn', at: fort.id });
  assert.ok(p.dead, 'not before the 5s are up');
  advance(5100); game.tick();
  assert.deepEqual(game.respawnSpots(p), [fort.id]);
  game.handle(p, { t: 'respawn', at: fort.id });
  assert.ok(!p.dead && inCastleWalls(fort, p.x, p.y));
});

// ------------------------------------------------------------------ factions and conquest
test('everyone joins the smallest public faction; private factions take 10 and are joined by code', () => {
  const { game, p } = setup();
  assert.ok(PUBLIC_FACTIONS.some((f) => f.id === p.fac));
  const others = [];
  for (let i = 0; i < 4; i++) others.push(game.join({ id: 'a' + i, username: 'P' + i, progress: { season: SEASON } }, () => {}));
  const counts = PUBLIC_FACTIONS.map((f) => [...game.players.values()].filter((x) => x.fac === f.id).length);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, counts.join(','));
  game.handle(p, { t: 'fc', n: 'Les Épées du Nord' });
  const f = game.factions[p.fac];
  assert.ok(!f.pub && f.code);
  for (let i = 0; i < 4; i++) game.handle(others[i], { t: 'fjc', code: f.code });
  assert.equal(f.members.length, 5);
  game.handle(others[0], { t: 'fl' });
  assert.ok(game.factions[others[0].fac].pub, 'leaving a private faction puts you back in a public one');
  assert.deepEqual(game.progressOf(p).fac, f.id);
});

test('a castle falls when only one faction is inside its walls for 3 seconds; survivors outside switch sides', () => {
  const { game, p, msgs, advance } = setup();
  const c = game.castles.find((k) => k.type === 'fort');
  const L = CASTLE_TYPES.fort;
  p.x = c.x; p.y = c.y + L.inner - 30;
  for (const n of [...game.npcs.values()]) if (n.castle !== c.id && Math.hypot(n.x - c.x, n.y - c.y) < 1500) game.killNpc(n, null, true);
  // Lure one defender out past the walls; the rest fall.
  const lured = game.npcs.get(c.slots[1]); lured.x = c.x + L.outer + 300; lured.y = c.y; lured.home = { x: lured.x, y: lured.y }; lured.leash = 99999;
  run(game, advance, 1000);
  assert.equal(c.owner, 0, 'defenders inside: no capture');
  for (const id of c.slots) { const n = game.npcs.get(id); if (n && n !== lured) game.killNpc(n, p); }
  p.x = c.x; p.y = c.y; p.hp = p.maxhp; // the defenders' sabres may have pushed us back out of the gate
  run(game, advance, (CAPTURE_TIME - 1) * 1000);
  assert.equal(c.owner, 0, 'not before 3 seconds');
  run(game, advance, 1500);
  assert.equal(c.owner, p.fac);
  assert.equal(lured.team, 'f:' + p.fac, 'the lured defender pledged allegiance');
  assert.ok(msgs.some((m) => m.t === 'msg' && /conquered/.test(m.m)));
  assert.equal(game.capOf(p), CAP_BASE + CAP_LIFT.fort);
  p.bank = 5000;
  game.handle(p, { t: 'fortify', id: c.id });
  assert.equal(c.level, 2); assert.equal(p.bank, 4200);
});

test('traps never hold a castle, but a standing Gonfalon does', () => {
  const { game, p, advance } = setup({ soma: somaForTier(2), unlocked: ['gonfalon', 'tripwire'] });
  const c = game.castles.find((k) => k.type === 'fort');
  c.owner = p.fac; game.loseCastle(c); c.owner = p.fac; game.refreshFactionStats();
  for (const id of c.slots) { const n = game.npcs.get(id); if (n) game.killNpc(n, null, true); }
  c.slotAt = c.slotAt.map(() => Infinity);
  const trap = game.mkNpc('tripwire', c.x, c.y, { owner: p.id });
  const flag = game.mkNpc('gonfalon', c.x + 20, c.y, { owner: p.id });
  const q = game.join({ id: 'acc-2', username: 'Raider', progress: { season: SEASON } }, () => {});
  if (q.fac === p.fac) game.setFaction(q, PUBLIC_FACTIONS.find((f) => f.id !== p.fac).id, true);
  p.x = VILLAGE.x; p.y = VILLAGE.y; q.x = c.x; q.y = c.y + 40;
  run(game, advance, 4000);
  assert.equal(c.owner, p.fac, 'the Gonfalon holds it');
  game.killNpc(flag, q);
  run(game, advance, 4000);
  assert.equal(c.owner, q.fac, 'the tripwire does not');
  void trap;
});

// ------------------------------------------------------------------ troops, travel, wood, stealth
test('orders: castle troops need the rank for their kind; hired troops obey their owner', () => {
  const { game, p, msgs } = setup();
  const c = game.castles.find((k) => k.type === 'fort');
  c.owner = p.fac;
  for (const id of c.slots) { const n = game.npcs.get(id); if (n) { n.team = 'f:' + p.fac; n.fac = p.fac; } }
  p.x = c.x; p.y = c.y; game.gridBuild();
  const reiver = [...game.npcs.values()].find((n) => n.castle === c.id && n.kind === 'reiver' && Math.hypot(n.x - p.x, n.y - p.y) < 400);
  assert.ok(reiver);
  game.handle(p, { t: 'chat', m: 'reivers follow' });
  assert.notEqual(reiver.order, 'follow');
  assert.match(msgs.filter((m) => m.t === 'err').at(-1).m, /rank/);
  setRank(game, p, 5); game.T += 1000; p.lastChat = 0;
  game.handle(p, { t: 'chat', m: 'reivers follow' });
  assert.equal(reiver.order, 'follow'); assert.equal(reiver.leader, p.id);
  p.lastChat = 0; game.handle(p, { t: 'chat', m: 'hold' });
  assert.ok(reiver.order === 'hold' || reiver.order === 'home');
});

test('hiring troops costs banked gold, takes a 3s channel and stops at 5; "rally my troops" calls them', () => {
  const { game, p, advance, msgs } = setup({ soma: somaForTier(1), unlocked: ['hire_archer'] });
  p.x = VILLAGE.x; p.y = VILLAGE.y; p.belt[0] = 'hire_archer';
  game.handle(p, { t: 'use', s: 0, on: 1 }); game.handle(p, { t: 'use', s: 0, on: 0 });
  assert.match(msgs.at(-1).m, /60 banked gold/);
  p.bank = 1000;
  for (let i = 0; i < 6; i++) { p.gcd = {}; game.handle(p, { t: 'use', s: 0, on: 1 }); game.handle(p, { t: 'use', s: 0, on: 0 }); run(game, advance, 3100); }
  const mine = [...game.npcs.values()].filter((n) => n.owner === p.id);
  assert.equal(mine.length, 5); assert.equal(p.bank, 1000 - 5 * 60);
  for (const n of mine) { n.x += 900; }
  game.gridBuild(); p.lastChat = 0;
  game.handle(p, { t: 'chat', m: 'rally my troops' });
  run(game, advance, 10100);
  assert.ok(mine.filter((n) => !n.dead).every((n) => Math.hypot(n.x - p.x, n.y - p.y) < 200));
});

test('quick travel needs Marshall, takes 20s standing still and you take 4× damage meanwhile', () => {
  const { game, p, advance, msgs } = arena();
  const c = game.castles.find((k) => k.type === 'castle'); c.owner = p.fac;
  game.handle(p, { t: 'travel', id: c.id });
  assert.ok(!p.channel); assert.match(msgs.at(-1).m, /Marshall/);
  setRank(game, p, 7);
  game.handle(p, { t: 'travel', id: c.id });
  assert.ok(p.channel && p.channel.vuln);
  const n = game.mkNpc('reiver', p.x + 40, p.y, {}); n.target = null; n.atkBase = 0; game.gridBuild();
  assert.ok(Math.abs(game.dealDamage(n, p, 5, {}) - 20) < 1e-9);
  game.killNpc(n, null, true); p.hp = p.maxhp;
  run(game, advance, 20100);
  assert.ok(inCastleWalls(c, p.x, p.y));
});

test('log piles give wood; traps cost wood, are capped at 10 and spring on foes', () => {
  const { game, p, advance } = arena({ soma: somaForTier(2), unlocked: ['tripwire', 'foothold'] });
  const logs = game.mkNpc('logs', p.x + 40, p.y, {}); game.gridBuild();
  p.ang = p.aim = 0; p.belt = ['shortsword', 'foothold', null, null, null, null, null];
  game.handle(p, { t: 'use', s: 0, on: 1, a: 0 });
  run(game, advance, 1500); game.handle(p, { t: 'use', s: 0, on: 0 });
  assert.ok(logs.dead); assert.equal(p.wood, 2);
  const spot = openSpot(game, p);
  game.handle(p, { t: 'use', s: 1, on: 1, ...spot }); game.handle(p, { t: 'use', s: 1, on: 0 });
  assert.equal([...game.npcs.values()].filter((n) => n.kind === 'foothold').length, 0, 'needs 3 wood');
  p.wood = 100;
  game.handle(p, { t: 'use', s: 1, on: 1, ...spot }); game.handle(p, { t: 'use', s: 1, on: 0 });
  const trap = [...game.npcs.values()].find((n) => n.kind === 'foothold');
  assert.ok(trap && p.wood === 97);
  const foe = game.mkNpc('vagabond', trap.x + 5, trap.y, {}); foe.target = null; game.gridBuild();
  advance(50); game.tick();
  assert.ok(trap.dead && game.rooted(foe));
});

test('99% invisibility hides you from enemies and NPCs; Turncoat makes enemy players see a friend', () => {
  const { game, p, advance } = arena({ soma: somaForTier(3), unlocked: ['cloak', 'smoke', 'turncoat'] });
  p.belt = ['spear', 'smoke', 'turncoat', null, null, null, null];
  const n = game.mkNpc('vagabond', p.x + 120, p.y, {}); game.gridBuild();
  assert.equal(game.findTarget(n), p.id);
  game.handle(p, { t: 'use', s: 1, on: 1 }); game.handle(p, { t: 'use', s: 1, on: 0 });
  assert.equal(game.findTarget(n), null);
  game.killNpc(n, null, true);
  const q = game.join({ id: 'acc-2', username: 'Watcher', progress: { season: SEASON } }, () => {});
  if (q.fac === p.fac) game.setFaction(q, PUBLIC_FACTIONS.find((f) => f.id !== p.fac).id, true);
  q.x = p.x + 100; q.y = p.y; game.gridBuild();
  assert.ok(!JSON.parse(game.snapshot(q)).e.some((e) => e.i === p.id), 'hidden from enemy players');
  run(game, advance, 3100);
  assert.ok(JSON.parse(game.snapshot(q)).e.some((e) => e.i === p.id), 'visible again after 3s');
  run(game, advance, 27000); // the Stealth group cools down
  game.handle(p, { t: 'use', s: 2, on: 1 }); game.handle(p, { t: 'use', s: 2, on: 0 });
  assert.equal(JSON.parse(game.snapshot(q)).e.find((e) => e.i === p.id).f, q.fac);
});

test('logging out mid-fight leaves your character for 10 seconds', () => {
  const { game, p, advance } = arena();
  const q = game.join({ id: 'acc-2', username: 'Foe', progress: { season: SEASON } }, () => {});
  if (q.fac === p.fac) game.setFaction(q, PUBLIC_FACTIONS.find((f) => f.id !== p.fac).id, true);
  q.x = p.x + 40; q.y = p.y; game.gridBuild();
  game.dealDamage(q, p, 5, {});
  game.leave(p);
  assert.ok(game.players.has(p.id) && p.gone);
  run(game, advance, 10100);
  assert.ok(!game.players.has(p.id));
});

test('client movement is limited by speed and walls; backpedalling costs more; stale positions are ignored', () => {
  const { game, p, advance } = setup();
  const c = CASTLES[0], L = CASTLE_TYPES[c.type];
  p.x = c.x - L.outer - 60; p.y = c.y; p.ang = p.aim = 0;
  for (let i = 0; i < 10; i++) { advance(50); game.tick(); }
  const x0 = p.x;
  game.handle(p, { t: 'in', a: 0, x: p.x - 1000, y: p.y, tp: p.tp });
  assert.ok(x0 - p.x <= 190 * 0.5 * 0.75 + 1, 'backpedalling');
  for (let i = 0; i < 20; i++) { advance(50); game.tick(); }
  game.handle(p, { t: 'in', a: 0, x: p.x + 1000, y: p.y, tp: p.tp });
  for (let i = 0; i < 20; i++) { advance(50); game.tick(); game.handle(p, { t: 'in', a: 0, x: p.x + 20, y: p.y, tp: p.tp }); }
  assert.ok(p.x < c.x - L.outer + 1);
  const x1 = p.x;
  game.handle(p, { t: 'in', a: 0, x: p.x - 10, y: p.y, tp: p.tp - 1 });
  assert.equal(p.x, x1);
});

test('people fight with tools: castles are garrisoned by Captains, Reivers and Rangers; creatures keep their own ways', () => {
  const ais = new Set(Object.values(MOBS).map((m) => m.ai));
  for (const a of ['melee', 'kite', 'charger', 'leaper', 'caster', 'healer', 'summoner', 'exploder', 'slam', 'boss', 'kit']) assert.ok(ais.has(a), a);
  for (const m of Object.values(MOBS)) if (m.kit) for (const id of m.kit) assert.ok(TOOLS[id], `${m.name}: ${id}`);
  const { game } = setup();
  const fort = game.castles.find((c) => c.type === 'fort');
  const kinds = fort.slots.map((id) => game.npcs.get(id).kind);
  assert.ok(kinds.includes('captain') && kinds.includes('reiver'));
  assert.ok(game.logSpots.length > 100, 'log piles all over the map');
});

// ------------------------------------------------------------------ seasons, saving and the server
test('season 3: everyone starts fresh; veterans keep a badge and their old record', () => {
  const { progress, note } = migrateProgress({ season: 2, soma: 26000, fac: 3 });
  assert.equal(progress.season, SEASON); assert.equal(progress.vet, 1); assert.equal(progress.soma, 0);
  assert.equal(progress.legacy.soma, 26000); assert.ok(note);
  const fresh = migrateProgress({});
  assert.ok(!fresh.progress.vet && !fresh.note);
  assert.equal(migrateProgress(progress).progress, progress, 'migrates only once');
});

test('a saved world keeps private factions and castle owners; a new season starts the map over', () => {
  const c = CASTLES[2];
  const world = { season: SEASON, factions: { 12: { id: 12, name: 'Gulls', color: '#3498db', pub: false, code: 'abc', members: ['acc-1'] } }, castles: { [c.id]: { o: 12, l: 3 } }, nextFac: 13 };
  const game = new Game({ world, now: () => 1e12 });
  assert.equal(game.castles.find((k) => k.id === c.id).owner, 12);
  for (const f of PUBLIC_FACTIONS) assert.ok(game.factions[f.id].pub);
  const old = new Game({ world: { ...world, season: 2 }, now: () => 1e12 });
  assert.equal(old.castles.find((k) => k.id === c.id).owner, 0); assert.ok(!old.factions[12]);
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

test('server: sign up over HTTP, join over WebSocket, progress is saved on leave (but not Valor)', async () => {
  const store = memoryStore(), app = express(), server = http.createServer(app);
  const h = setupEldyn(app, server, { store });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `127.0.0.1:${server.address().port}`;
  try {
    const page = await fetch(`http://${base}/eldyn/`);
    assert.match(await page.text(), /Hanbin Island/);
    for (const f of ['shared.mjs', 'builds.mjs', 'terrain.mjs', 'chunkworker.mjs', 'sprites.mjs', 'client.mjs']) assert.match((await fetch(`http://${base}/eldyn/${f}`)).headers.get('content-type'), /javascript/, f);
    const html = await (await fetch(`http://${base}/eldyn/`)).text(), v = html.match(/style\.css\?v=(\w+)/)[1];
    assert.match(html, new RegExp(`client\\.mjs\\?v=${v}`));
    const client = await (await fetch(`http://${base}/eldyn/client.mjs?v=${v}`)).text();
    assert.match(client, new RegExp(`'\\./builds\\.mjs\\?v=${v}'`)); assert.match(client, new RegExp(`'\\./chunkworker\\.mjs\\?v=${v}'`));
    const css = await fetch(`http://${base}/eldyn/style.css?v=${v}`);
    assert.match(css.headers.get('cache-control'), /immutable/); assert.match(await css.text(), /\.slot\.tog/);
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
    p.soma = 777; p.bank = 55; p.wood = 7; p.valor = 300; p.unlocked = ['pike'];
    ws.close();
    await new Promise((r) => setTimeout(r, 200));
    const a = await store.byKey('bram');
    assert.equal(a.progress.soma, 777); assert.equal(a.progress.bank, 55); assert.equal(a.progress.wood, 7);
    assert.deepEqual(a.progress.unlocked, ['pike']); assert.equal(a.progress.valor, undefined);
  } finally { h.close(); server.close(); }
});
