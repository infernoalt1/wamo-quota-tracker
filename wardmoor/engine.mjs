// Wardmoor: server-authoritative world simulation. No networking in this file.
export const WORLD = 3600, REGION = 1200, DT = 1 / 20, MAX_HUMANS = 40, MAX_BAND = 10, VIEW = 1050, STONE_RADIUS = 170;

export const TOOLS = [
  { id: 'pike', name: 'Ashwood Pike', kind: 'melee', renown: 0, dmg: 17, reach: 125, arc: 0.3, windup: 0.18, cool: 0.62, kb: 120, pierce: 0 },
  { id: 'buckler', name: 'Round Buckler', kind: 'guard', renown: 0, block: 0.8, arc: 1.25, speed: 0.55 },
  { id: 'bandage', name: 'Field Bandage', kind: 'heal', renown: 0, heal: 35, channel: 1.6, cool: 12 },
  { id: 'billhook', name: 'Billhook', kind: 'melee', renown: 60, dmg: 20, reach: 105, arc: 1.05, windup: 0.24, cool: 0.72, kb: 160, pierce: 0 },
  { id: 'sling', name: 'Shepherd Sling', kind: 'shot', renown: 160, dmg: 20, speed: 720, life: 0.9, windup: 0.3, cool: 1.05, kb: 60, pierce: 0 },
  { id: 'maul', name: 'Stone Maul', kind: 'melee', renown: 320, dmg: 44, reach: 92, arc: 0.8, windup: 0.5, cool: 1.35, kb: 420, pierce: 0.5 },
  { id: 'scythe', name: 'War Scythe', kind: 'melee', renown: 650, dmg: 36, reach: 135, arc: 1.35, windup: 0.42, cool: 1.2, kb: 220, pierce: 0.15 },
];
export const ARMORS = [
  { id: 'cloth', name: 'Wool Cloak', renown: 0, dr: 0, speed: 1 },
  { id: 'gambeson', name: 'Quilted Coat', renown: 40, dr: 0.15, speed: 0.97 },
  { id: 'mail', name: 'Ring Shirt', renown: 200, dr: 0.3, speed: 0.9 },
  { id: 'plate', name: 'Moorsteel Plate', renown: 500, dr: 0.45, speed: 0.8 },
];
const MONSTERS = {
  ghoul: { code: 1, hp: 40, speed: 150, r: 18, renown: 4, aggro: 340, weapon: { kind: 'melee', dmg: 8, reach: 42, arc: 0.9, windup: 0.3, cool: 1, kb: 60, pierce: 0 } },
  wolf: { code: 2, hp: 55, speed: 275, r: 20, renown: 9, aggro: 460, weapon: { kind: 'melee', dmg: 11, reach: 46, arc: 0.8, windup: 0.2, cool: 0.8, kb: 70, pierce: 0 } },
  brute: { code: 3, hp: 190, speed: 150, r: 34, renown: 32, aggro: 400, weapon: { kind: 'melee', dmg: 28, reach: 80, arc: 1, windup: 0.6, cool: 1.5, kb: 340, pierce: 0.3 } },
  militia: { code: 4, hp: 70, speed: 205, r: 20, renown: 6, aggro: 300, weapon: { kind: 'melee', dmg: 9, reach: 88, arc: 0.5, windup: 0.3, cool: 1.1, kb: 90, pierce: 0 } },
};
const BOTS = [['Aldous', 'Reeves'], ['Brannoch', ''], ['Cerys', 'Thornguard'], ['Dunmere', 'Reeves'], ['Ysolde', ''], ['Tam Harrow', 'Thornguard'], ['Hobb', ''], ['Maren', 'Reeves'], ['Osric', ''], ['Wynn', 'Thornguard']];
const BASE_SPEED = 235, MAX_RENOWN = 99999, RESPAWN_DELAY = 2, SPAWN_SHIELD = 3, COMBAT_WINDOW = 8;
const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const wrap = a => { a %= TAU; if (a > Math.PI) a -= TAU; if (a < -Math.PI) a += TAU; return a; };
const mulberry = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

export const unlockedArmor = renown => ARMORS.reduce((best, a, i) => renown >= a.renown ? i : best, 0);
export const regionIndex = (x, y) => clamp(Math.floor(y / REGION), 0, 2) * 3 + clamp(Math.floor(x / REGION), 0, 2);
export const bounty = victim => 12 + Math.floor(victim.renown * 0.25);

export function createWorld(seed = 1, { bots = true } = {}) {
  const rand = mulberry(seed);
  const regions = Array.from({ length: 9 }, (_, i) => ({ i, x: (i % 3 + 0.5) * REGION, y: (Math.floor(i / 3) + 0.5) * REGION, tier: i === 4 ? 2 : i % 2 ? 1 : 0, owner: null, ownerName: '', claimer: null, progress: 0, militiaT: 0 }));
  const obstacles = [];
  for (let tries = 0; tries < 900 && obstacles.length < 190; tries++) {
    const rock = rand() < 0.24, r = rock ? 30 + rand() * 34 : 22 + rand() * 18, x = 60 + rand() * (WORLD - 120), y = 60 + rand() * (WORLD - 120);
    if (regions.some(s => Math.hypot(s.x - x, s.y - y) < STONE_RADIUS + 70 + r)) continue;
    if (obstacles.some(o => Math.hypot(o.x - x, o.y - y) < o.r + r + 70)) continue;
    obstacles.push({ k: rock ? 'rock' : 'tree', x: Math.round(x), y: Math.round(y), r: Math.round(r) });
  }
  const w = { t: 0, seed, rand, ents: new Map(), shots: [], regions, obstacles, events: [], nextId: 1, spawnT: 0, board: [], boardT: 0 };
  if (bots) for (const [name, band] of BOTS) { const b = addPlayer(w, { name, band, bot: true }); b.renown = Math.floor(rand() * 90); b.armor = unlockedArmor(b.renown); }
  spawnMonsters(w);
  return w;
}

const isPlayer = e => e.kind === 'player';
const players = w => [...w.ents.values()].filter(isPlayer);
const weaponOf = e => e.weapon || TOOLS[e.tool];
const cleanName = (s, fallback) => String(s ?? '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, '').trim().slice(0, 16) || fallback;

function clearSpot(w, x, y, r) { return !w.obstacles.some(o => Math.hypot(o.x - x, o.y - y) < o.r + r + 8); }
function spawnPoint(w) {
  const corner = w.regions.filter(r => r.tier === 0);
  for (let i = 0; i < 40; i++) {
    const r = corner[Math.floor(w.rand() * corner.length)], x = r.x + (w.rand() - 0.5) * REGION * 0.75, y = r.y + (w.rand() - 0.5) * REGION * 0.75;
    if (clearSpot(w, x, y, 24)) return { x, y };
  }
  return { x: corner[0].x, y: corner[0].y };
}

export function addPlayer(w, { name, band, bot = false }) {
  if (!bot && players(w).filter(p => !p.bot).length >= MAX_HUMANS) throw Error('This world is full. Try again shortly.');
  const bandName = cleanName(band, '');
  const id = w.nextId++, team = bandName ? 'b:' + bandName.toLowerCase() : 'p:' + id;
  if (bandName && players(w).filter(p => p.team === team).length >= MAX_BAND) throw Error(`The warband ${bandName} is full.`);
  const at = spawnPoint(w);
  const e = { id, kind: 'player', bot, name: cleanName(name, 'Wanderer'), bandName, team, x: at.x, y: at.y, r: 22, angle: 0, hp: 100, maxHp: 100, renown: 0, tool: 0, armor: 0, input: { mx: 0, my: 0, fire: false }, kx: 0, ky: 0, cool: 0, healCool: 0, healing: 0, swing: null, guard: false, shield: SPAWN_SHIELD, lastHit: -99, dead: false, deadAt: 0, killer: '', kills: 0, aiT: 0, target: 0 };
  w.ents.set(id, e);
  return e;
}

export function removePlayer(w, e) {
  w.ents.delete(e.id);
  if (!players(w).some(p => p.team === e.team)) for (const r of w.regions) if (r.owner === e.team) release(w, r);
}

function release(w, r) {
  r.owner = null; r.ownerName = ''; r.claimer = null; r.progress = 0;
  dropMilitia(w, r);
}
function dropMilitia(w, r) { for (const m of [...w.ents.values()]) if (m.kind === 'militia' && m.region === r.i) w.ents.delete(m.id); }

export function setInput(w, e, m) {
  if (Number.isFinite(m.mx)) e.input.mx = clamp(m.mx, -1, 1);
  if (Number.isFinite(m.my)) e.input.my = clamp(m.my, -1, 1);
  if (Number.isFinite(m.a)) e.angle = wrap(m.a);
  e.input.fire = m.f === true;
  if (Number.isInteger(m.tool) && TOOLS[m.tool] && e.renown >= TOOLS[m.tool].renown && m.tool !== e.tool) { e.tool = m.tool; e.swing = null; e.healing = 0; }
  if (Number.isInteger(m.armor) && ARMORS[m.armor] && e.renown >= ARMORS[m.armor].renown && w.t - e.lastHit >= COMBAT_WINDOW) e.armor = m.armor;
}

export function respawn(w, e) {
  if (!e.dead || w.t - e.deadAt < RESPAWN_DELAY) return false;
  const at = spawnPoint(w);
  Object.assign(e, { x: at.x, y: at.y, hp: e.maxHp, dead: false, shield: SPAWN_SHIELD, kx: 0, ky: 0, cool: 0, healCool: 0, healing: 0, swing: null, guard: false, killer: '', lastHit: -99 });
  if (e.renown < TOOLS[e.tool].renown) e.tool = 0;
  e.armor = Math.min(e.armor, unlockedArmor(e.renown));
  return true;
}

function hostile(w, a, b) {
  if (a === b || a.dead || b.dead) return false;
  const aMon = !isPlayer(a) && a.kind !== 'militia', bMon = !isPlayer(b) && b.kind !== 'militia';
  if (aMon || bMon) return aMon !== bMon;
  if (a.kind === 'militia' && b.kind === 'militia') return false;
  if (a.kind === 'militia') { const o = w.regions[a.region].owner; return !!o && o !== b.team; }
  if (b.kind === 'militia') { const o = w.regions[b.region].owner; return !!o && o !== a.team; }
  return a.team !== b.team;
}

function speedOf(e) {
  if (!isPlayer(e)) return e.speed * (e.swing ? 0.5 : 1);
  const t = TOOLS[e.tool];
  return BASE_SPEED * ARMORS[e.armor].speed * (e.guard ? t.speed : 1) * (e.swing ? 0.62 : 1) * (e.healing > 0 ? 0.45 : 1);
}

function hurt(w, v, a, dmg, fromAngle, tool) {
  if (v.dead || v.shield > 0) return;
  let d = dmg, kb = tool.kb, blocked = false;
  if (v.guard && Math.abs(wrap(fromAngle - v.angle)) <= TOOLS[v.tool].arc) { d *= 1 - TOOLS[v.tool].block * (1 - tool.pierce); kb *= 0.4; blocked = true; }
  if (isPlayer(v)) d *= 1 - ARMORS[v.armor].dr * (1 - tool.pierce);
  v.hp -= d; v.lastHit = w.t; v.healing = 0;
  v.kx -= Math.cos(fromAngle) * kb; v.ky -= Math.sin(fromAngle) * kb;
  w.events.push({ k: 'hit', x: Math.round(v.x), y: Math.round(v.y), v: Math.ceil(d), blocked });
  if (v.hp <= 0) kill(w, v, a);
}

function kill(w, v, a) {
  v.dead = true; v.hp = 0; v.deadAt = w.t; v.swing = null; v.guard = false; v.healing = 0;
  w.events.push({ k: 'die', x: Math.round(v.x), y: Math.round(v.y), c: isPlayer(v) ? 0 : MONSTERS[v.kind].code });
  const base = isPlayer(v) ? bounty(v) : MONSTERS[v.kind].renown;
  if (a && isPlayer(a) && !a.dead) {
    const bonus = w.regions[regionIndex(v.x, v.y)].owner === a.team ? 1.25 : 1;
    a.renown = Math.min(MAX_RENOWN, a.renown + Math.ceil(base * bonus));
    if (isPlayer(v)) a.kills++;
  }
  if (isPlayer(v)) {
    v.killer = a ? (a.name || labelOf(a)) : 'the moor';
    v.renown = Math.floor(v.renown * 0.6);
    w.events.push({ k: 'feed', a: v.killer, b: v.name });
  } else w.ents.delete(v.id);
}
const labelOf = e => ({ ghoul: 'a ghoul', wolf: 'a moor wolf', brute: 'a barrow brute', militia: 'the militia' })[e.kind] || 'the moor';

function strike(w, e, tool) {
  const cos = Math.cos(e.angle), sin = Math.sin(e.angle);
  if (tool.kind === 'shot') {
    w.shots.push({ id: w.nextId++, x: e.x + cos * (e.r + 10), y: e.y + sin * (e.r + 10), vx: cos * tool.speed, vy: sin * tool.speed, life: tool.life, owner: e.id, tool });
    return;
  }
  w.events.push({ k: 'strike', id: e.id, x: Math.round(e.x), y: Math.round(e.y), a: +e.angle.toFixed(2), reach: tool.reach, arc: tool.arc });
  for (const t of [...w.ents.values()]) {
    if (!hostile(w, e, t)) continue;
    const dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy);
    if (d > tool.reach + t.r) continue;
    if (Math.abs(wrap(Math.atan2(dy, dx) - e.angle)) > tool.arc + Math.atan2(t.r, Math.max(d, 1))) continue;
    hurt(w, t, e, tool.dmg, Math.atan2(e.y - t.y, e.x - t.x), tool);
    if (e.dead) return;
  }
}

function nearestHostile(w, e, range) {
  let best = 0, bd = range;
  for (const t of w.ents.values()) {
    if (t.shield > 0 || !hostile(w, e, t)) continue;
    const d = Math.hypot(t.x - e.x, t.y - e.y);
    if (d < bd && !(e.bot && t.bot && d > 160)) { bd = d; best = t.id; }
  }
  return best;
}

function pickGoal(w, e) {
  const open = w.regions.filter(r => r.owner !== e.team).sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y)).slice(0, 3);
  e.goal = open.length ? open[Math.floor(w.rand() * open.length)].i : -1;
  e.goalT = w.t + 45;
}

function steer(e, x, y, stop = 0) {
  const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy);
  if (d <= stop || d < 1) { e.input.mx = e.input.my = 0; return; }
  e.input.mx = dx / d; e.input.my = dy / d;
}

function thinkBot(w, e) {
  if (e.healing > 0) { e.input.mx = e.input.my = 0; return; }
  e.aiT -= DT;
  if (e.aiT <= 0) {
    e.aiT = 0.25 + w.rand() * 0.25;
    if (e.goal === undefined || e.goal < 0 || w.regions[e.goal].owner === e.team || w.t >= e.goalT) pickGoal(w, e);
    const claiming = e.goal >= 0 && Math.hypot(w.regions[e.goal].x - e.x, w.regions[e.goal].y - e.y) <= STONE_RADIUS;
    e.target = nearestHostile(w, e, claiming ? 150 : 300);
    if (e.hp < 40 && e.healCool <= 0 && !e.target) { e.tool = 2; e.input.mx = e.input.my = 0; e.input.fire = true; return; }
    e.tool = [6, 5, 3, 0].find(i => e.renown >= TOOLS[i].renown) ?? 0;
    e.input.fire = false;
  }
  if (TOOLS[e.tool].kind === 'heal') return;
  const t = w.ents.get(e.target);
  if (t && !t.dead) {
    const d = Math.hypot(t.x - e.x, t.y - e.y), reach = weaponOf(e).reach + t.r;
    e.angle = Math.atan2(t.y - e.y, t.x - e.x);
    steer(e, t.x, t.y, reach * 0.7);
    if (e.aiT > 0.2) e.input.fire = d <= reach && w.rand() < 0.5;
    return;
  }
  const goal = w.regions[e.goal];
  if (goal) { e.angle = Math.atan2(goal.y - e.y, goal.x - e.x); steer(e, goal.x, goal.y, 90); }
  e.input.fire = false;
}

function thinkCreature(w, e) {
  e.aiT -= DT;
  if (e.aiT <= 0) { e.aiT = 0.3 + w.rand() * 0.3; e.target = nearestHostile(w, e, e.aggro); if (!e.target) { e.wx = e.homeX + (w.rand() - 0.5) * 360; e.wy = e.homeY + (w.rand() - 0.5) * 360; } }
  const t = w.ents.get(e.target);
  if (t && !t.dead && Math.hypot(e.x - e.homeX, e.y - e.homeY) < e.leash) {
    const d = Math.hypot(t.x - e.x, t.y - e.y), reach = e.weapon.reach + t.r;
    e.angle = Math.atan2(t.y - e.y, t.x - e.x);
    steer(e, t.x, t.y, reach * 0.75);
    e.input.fire = d <= reach;
    return;
  }
  e.input.fire = false;
  const gx = e.wx ?? e.homeX, gy = e.wy ?? e.homeY;
  steer(e, gx, gy, 30);
  if (e.input.mx || e.input.my) e.angle = Math.atan2(e.input.my, e.input.mx);
}

function act(w, e, dt) {
  e.cool = Math.max(0, e.cool - dt); e.healCool = Math.max(0, (e.healCool || 0) - dt); e.shield = Math.max(0, (e.shield || 0) - dt);
  if (e.swing) { e.swing.t -= dt; if (e.swing.t <= 0) { const tool = e.swing.tool; e.swing = null; strike(w, e, tool); } return; }
  if (e.healing > 0) {
    e.healing -= dt;
    if (e.healing <= 0) { e.hp = Math.min(e.maxHp, e.hp + TOOLS[2].heal); w.events.push({ k: 'heal', x: Math.round(e.x), y: Math.round(e.y) }); }
    return;
  }
  const tool = weaponOf(e);
  e.guard = tool.kind === 'guard' && e.input.fire;
  if (!e.input.fire) return;
  if ((tool.kind === 'melee' || tool.kind === 'shot') && e.cool <= 0) { e.cool = tool.cool; e.swing = { t: tool.windup, tool }; e.shield = 0; }
  else if (tool.kind === 'heal' && e.healCool <= 0 && e.hp < e.maxHp) { e.healing = tool.channel; e.healCool = tool.cool; }
}

function move(w, e, dt) {
  let { mx, my } = e.input;
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }
  const spd = speedOf(e);
  e.x += mx * spd * dt + e.kx * dt; e.y += my * spd * dt + e.ky * dt;
  const decay = Math.pow(0.0025, dt); e.kx *= decay; e.ky *= decay;
  for (const o of w.obstacles) {
    const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy), min = o.r + e.r;
    if (d < min && d > 0.01) { e.x = o.x + dx / d * min; e.y = o.y + dy / d * min; }
  }
  e.x = clamp(e.x, e.r, WORLD - e.r); e.y = clamp(e.y, e.r, WORLD - e.r);
}

function stepShots(w, dt) {
  w.shots = w.shots.filter(s => {
    s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
    const owner = w.ents.get(s.owner);
    if (s.life <= 0 || !owner || s.x < 0 || s.y < 0 || s.x > WORLD || s.y > WORLD) return false;
    if (w.obstacles.some(o => Math.hypot(o.x - s.x, o.y - s.y) < o.r)) return false;
    for (const t of [...w.ents.values()]) {
      if (!hostile(w, owner, t) || Math.hypot(t.x - s.x, t.y - s.y) > t.r + 5) continue;
      hurt(w, t, owner, s.tool.dmg, Math.atan2(-s.vy, -s.vx), s.tool);
      return false;
    }
    return true;
  });
}

function stepRegions(w, dt) {
  const live = players(w).filter(p => !p.dead);
  for (const r of w.regions) {
    const near = new Map();
    for (const p of live) if (Math.hypot(p.x - r.x, p.y - r.y) <= STONE_RADIUS) { if (!near.has(p.team)) near.set(p.team, []); near.get(p.team).push(p); }
    const teams = [...near.keys()];
    if (teams.length === 1 && teams[0] !== r.owner) {
      const team = teams[0], men = near.get(team), rate = dt / 12 * (1 + 0.2 * (men.length - 1));
      if (r.claimer !== team && r.progress > 0) r.progress = Math.max(0, r.progress - rate * 2);
      else { r.claimer = team; r.progress += rate; }
      if (r.progress >= 1) {
        dropMilitia(w, r);
        r.owner = team; r.ownerName = men[0].bandName || men[0].name; r.claimer = null; r.progress = 0; r.militiaT = 0;
        const share = Math.ceil(40 / men.length);
        for (const p of men) p.renown = Math.min(MAX_RENOWN, p.renown + share);
        w.events.push({ k: 'capture', a: r.ownerName, r: r.i });
      }
    } else if (teams.length === 0 || (teams.length === 1 && teams[0] === r.owner)) {
      r.progress = Math.max(0, r.progress - dt / 20);
      if (r.progress === 0) r.claimer = null;
    }
    if (r.owner) {
      r.militiaT -= dt;
      const count = [...w.ents.values()].filter(m => m.kind === 'militia' && m.region === r.i).length;
      if (count < 3 && r.militiaT <= 0) { r.militiaT = 8; spawnCreature(w, 'militia', r, r.x + (w.rand() - 0.5) * 240, r.y + (w.rand() - 0.5) * 240); }
    }
  }
}

function spawnCreature(w, kind, r, x, y) {
  const d = MONSTERS[kind], id = w.nextId++;
  w.ents.set(id, { id, kind, x, y, r: d.r, angle: w.rand() * TAU, hp: d.hp, maxHp: d.hp, speed: d.speed, aggro: d.aggro, weapon: d.weapon, leash: kind === 'militia' ? 420 : 640, homeX: x, homeY: y, region: r.i, input: { mx: 0, my: 0, fire: false }, kx: 0, ky: 0, cool: 0, swing: null, guard: false, shield: 0, dead: false, aiT: w.rand(), target: 0 });
}

const ROSTER = [{ ghoul: 6, wolf: 0, brute: 0 }, { ghoul: 5, wolf: 3, brute: 0 }, { ghoul: 0, wolf: 4, brute: 4 }];
function spawnMonsters(w) {
  const counts = new Map();
  for (const e of w.ents.values()) if (MONSTERS[e.kind] && e.kind !== 'militia') { const k = e.region + e.kind; counts.set(k, (counts.get(k) || 0) + 1); }
  const live = players(w).filter(p => !p.dead);
  for (const r of w.regions) for (const [kind, want] of Object.entries(ROSTER[r.tier])) {
    for (let n = counts.get(r.i + kind) || 0; n < want; n++) {
      for (let i = 0; i < 10; i++) {
        const x = r.x + (w.rand() - 0.5) * REGION * 0.9, y = r.y + (w.rand() - 0.5) * REGION * 0.9;
        if (Math.hypot(x - r.x, y - r.y) < STONE_RADIUS + 60 || !clearSpot(w, x, y, MONSTERS[kind].r)) continue;
        if (live.some(p => Math.hypot(p.x - x, p.y - y) < 420)) continue;
        spawnCreature(w, kind, r, x, y); break;
      }
    }
  }
}

export function step(w, dt = DT) {
  w.t += dt;
  for (const e of [...w.ents.values()]) {
    if (e.dead) { if (e.bot && w.t - e.deadAt > 4) respawn(w, e); continue; }
    if (e.bot) thinkBot(w, e); else if (!isPlayer(e)) thinkCreature(w, e);
    move(w, e, dt);
    act(w, e, dt);
    if (!e.dead && isPlayer(e) && w.t - e.lastHit > 6) e.hp = Math.min(e.maxHp, e.hp + 1.5 * dt);
  }
  stepShots(w, dt);
  stepRegions(w, dt);
  w.spawnT -= dt;
  if (w.spawnT <= 0) { w.spawnT = 1; spawnMonsters(w); }
  w.boardT -= dt;
  if (w.boardT <= 0) { w.boardT = 1; w.board = players(w).sort((a, b) => b.renown - a.renown).slice(0, 6).map(p => [p.name, p.bandName, p.renown]); }
}

export const drainEvents = w => w.events.splice(0);

const KIND = e => isPlayer(e) ? 0 : MONSTERS[e.kind].code;
const stateOf = e => e.swing ? 1 : e.guard ? 2 : e.healing > 0 ? 3 : 0;
export function viewFor(w, p, events) {
  const near = o => Math.abs(o.x - p.x) <= VIEW && Math.abs(o.y - p.y) <= VIEW;
  const list = [];
  for (const e of w.ents.values()) {
    if (e.dead || !near(e)) continue;
    const team = e.kind === 'militia' ? w.regions[e.region].owner : e.team;
    list.push([e.id, KIND(e), Math.round(e.x), Math.round(e.y), +e.angle.toFixed(2), Math.ceil(e.hp / e.maxHp * 100), e.tool || 0, stateOf(e), e.renown || 0, e.name || '', e.bandName || '', team || '', e.armor || 0, e.shield > 0 ? 1 : 0]);
  }
  return {
    t: 's',
    you: { hp: Math.ceil(p.hp), maxHp: p.maxHp, x: Math.round(p.x), y: Math.round(p.y), renown: p.renown, tool: p.tool, armor: p.armor, dead: p.dead, killer: p.killer, speed: Math.round(speedOf(p)), cool: +p.cool.toFixed(2), healCool: +p.healCool.toFixed(1), combat: w.t - p.lastHit < COMBAT_WINDOW, kills: p.kills, shield: p.shield > 0 },
    e: list,
    p: w.shots.filter(near).map(s => [s.id, Math.round(s.x), Math.round(s.y), Math.round(s.vx), Math.round(s.vy)]),
    r: w.regions.map(r => [r.owner || '', r.ownerName, r.claimer || '', +r.progress.toFixed(2)]),
    b: w.board,
    ev: events.filter(ev => ev.k === 'feed' || ev.k === 'capture' || near(ev)),
  };
}
