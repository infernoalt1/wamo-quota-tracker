// Hanbin Island duel simulator: bots fight with archetype kits in a headless copy of the game, so a
// kit that wins far too often (or a starter kit that can't win at all) shows up before players find it.
// Bots are not people: this catches outliers, it does not prove perfect balance.
// Run `node eldyn/balance.mjs` for the full report.
import { Game } from './engine.mjs';
import { CASTLES, CASTLE_TYPES, freeAt, passable } from './shared.mjs';
import { BASE_HP, START_BELT } from './builds.mjs';

export const ARCHETYPES = {
  starter: START_BELT,
  shield_spear: ['spear', 'kite', 'quarterstaff', 'parry', 'rations', 'pennon'],
  pike_wall: ['pike', 'pavise', 'pilum', 'retreat', 'poultice'],
  duellist: ['rapier', 'parma', 'feint', 'bollock', 'draught', 'rations'],
  greatsword: ['greatsword', 'round', 'lunge', 'quarterstaff', 'rations'],
  berserker: ['battleaxe', 'targe', 'redemption', 'quarterstaff', 'lunge', 'rations'],
  longbow: ['longbow', 'sprint', 'focus', 'rondel', 'rations'],
  crossbow: ['repeater', 'retreat', 'pilum', 'tincture', 'buckler'],
  leech: ['glaive', 'leeches', 'sceptre', 'draught', 'buckler'],
  alchemist: ['sling', 'naphtha', 'quarterstaff', 'parma', 'rations'],
  flail: ['flail', 'scutum', 'lunge', 'blackjack', 'rations'],
  halberd: ['halberd', 'heraldic', 'parry', 'pilum', 'rations'],
};

// Three arenas outside castles: open ground, some cover, and thick cover (by how many walls, rocks and
// trees stand nearby). Duels rotate through them, since open ground favours bows and cover favours blades.
export const ARENAS = (() => {
  const list = [];
  for (const c of CASTLES) for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const d = CASTLE_TYPES[c.type].outer + 700, x = Math.round(c.x + Math.cos(a) * d), y = Math.round(c.y + Math.sin(a) * d);
    let blocked = 0, water = 0;
    for (let dx = -500; dx <= 500; dx += 40) for (let dy = -300; dy <= 300; dy += 40) { if (!passable(x + dx, y + dy, 0)) water++; else if (!freeAt(x + dx, y + dy, 26)) blocked++; }
    if (!water) list.push({ x, y, blocked });
  }
  list.sort((p, q) => p.blocked - q.blocked);
  return [0.2, 0.5, 0.8].map((q) => list[Math.floor(q * (list.length - 1))]);
})();
function arena(where = 0) {
  let t = 1e12;
  const game = new Game({ now: () => t });
  game.npcs.clear(); game.castles = []; game.dungeons = []; game.wildCap = game.wildCap.map(() => 0); game.logSpots = [];
  const { x, y } = ARENAS[where % ARENAS.length];
  return { game, x, y, step: () => { t += 50; game.tick(); } };
}
function bot(game, kit, x, y, team, ang) {
  const n = game.mkNpc('vagabond', x, y, { team, leash: 99999, order: 'hold' });
  n.def = { ...n.def, name: 'Bot', hp: BASE_HP, spd: 190, aggro: 900, social: 0, pack: null };
  n.hp = n.maxhp = BASE_HP; n.kit = kit.slice(); n.wp = kit[0]; n.ang = ang; n.atkBase = 0; n.player = true;
  return n;
}
// One duel; returns 1 if kit A wins, 0 if B wins, 0.5 for a draw (60 s without a winner).
export function duel(kitA, kitB, seedSwap = false, where = 0) {
  const { game, x, y, step } = arena(where);
  const [ka, kb] = seedSwap ? [kitB, kitA] : [kitA, kitB];
  const gap = 125 + Math.random() * 150;
  const a = bot(game, ka, x - gap, y, 'A', 0), b = bot(game, kb, x + gap, y, 'B', Math.PI);
  game.gridBuild(); a.target = b.id; b.target = a.id;
  for (let i = 0; i < 1200 && !a.dead && !b.dead; i++) step();
  const r = a.dead && !b.dead ? 0 : b.dead && !a.dead ? 1 : 0.5;
  return seedSwap ? 1 - r : r;
}
// Runs fn with Math.random replaced by a seeded generator, so a report (and the CI gate) is repeatable.
export function seeded(seed, fn) {
  const real = Math.random;
  let a = seed >>> 0;
  Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  try { return fn(); } finally { Math.random = real; }
}
// Round robin: every kit against every other, `n` duels per pairing (half from each side, spread over the arenas).
export function roundRobin(kits = ARCHETYPES, n = 10) {
  const names = Object.keys(kits), wins = {}, games = {}, pair = {};
  for (const k of names) { wins[k] = 0; games[k] = 0; }
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const A = names[i], B = names[j];
    let s = 0;
    for (let k = 0; k < n; k++) s += duel(kits[A], kits[B], k % 2 === 1, Math.floor(k / 2));
    wins[A] += s; wins[B] += n - s; games[A] += n; games[B] += n;
    pair[A + ' vs ' + B] = s / n;
  }
  const rate = Object.fromEntries(names.map((k) => [k, wins[k] / games[k]]));
  return { rate, pair };
}

if (process.argv[1] && process.argv[1].endsWith('balance.mjs')) {
  const n = +(process.argv[2] || 20), seed = +(process.argv[3] || 1), t0 = Date.now();
  const { rate, pair } = seeded(seed, () => roundRobin(ARCHETYPES, n));
  console.log(`Win rate against the field (${n} duels per pairing, ${((Date.now() - t0) / 1000).toFixed(1)}s):`);
  for (const [k, v] of Object.entries(rate).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(14)} ${(v * 100).toFixed(0)}%`);
  const lop = Object.entries(pair).filter(([, v]) => v > 0.75 || v < 0.25);
  console.log(`Lopsided pairings (worse than 25/75): ${lop.length}`);
  for (const [k, v] of lop) console.log(`  ${k}: ${(v * 100).toFixed(0)}%`);
}
