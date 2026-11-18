// Hanbin Island: the authoritative game simulation. It knows nothing about sockets or databases;
// the server feeds it players and messages and persists what it reports.
import {
  WORLD, VILLAGE, REGIONS, CASTLES, SANCTUARY, REGION_CELLS, RC, GW, SKILLS, MOBS, WILD_TABLE, VALOR_CAP, FREE_SKILLS, TREE_OF,
  rankOf, tierOf, slotsForTier, garrisonFor, regionAt, inCastle, moveBody, freeAt, shotBlocked, losClear,
} from './shared.mjs';

const { W, H, CASTLE_HALF: CH, WALL } = WORLD;
export const TICK = 50, DT = TICK / 1000;
export const CAPTURE_TIME = 8;
const VIEW_W = 1050, VIEW_H = 650;
const FAC_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#ff6fae', '#c8d6e5', '#8e44ad', '#16a085', '#d35400'];
const WEAPON_OF = { blade: 'sword', marksman: 'bow', sorcery: 'staff', command: 'sword', technique: 'rapier' };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = (a, b) => a + Math.random() * (b - a);
const rd = Math.round;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angDiff = (a, b) => Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
const inSafe = (e) => Math.hypot(e.x - VILLAGE.x, e.y - VILLAGE.y) < VILLAGE.r;
function pickWeighted(tbl) {
  let tot = 0; for (const [, w] of tbl) tot += w;
  let r = Math.random() * tot;
  for (const [k, w] of tbl) if ((r -= w) <= 0) return k;
  return tbl[0][0];
}
export const factionNameOk = (n) => /^[A-Za-z0-9 _\-']{3,16}$/.test(n);

export class Game {
  constructor({ world = {}, now = () => Date.now() } = {}) {
    this.now = now; this.T = now(); this.tickNo = 0; this.idc = 0;
    this.players = new Map(); this.npcs = new Map();
    this.projs = []; this.zones = []; this.fxq = []; this.recentKills = new Map();
    this.factions = {}; this.nextFac = world.nextFac || 1;
    for (const [id, f] of Object.entries(world.factions || {})) this.factions[id] = { ...f, members: [...(f.members || [])] };
    this.worldDirty = false;
    this.castles = CASTLES.map((c) => {
      const owner = world.castles && this.factions[world.castles[c.id]] ? +world.castles[c.id] : 0;
      return { ...c, owner, slots: garrisonFor(c.danger).map(() => null), prog: { fac: 0, t: 0 }, calm: 99, nextSpawn: 0, def: 0 };
    });
    this.wildCount = REGIONS.map(() => 0);
    this.wildCap = REGIONS.map((r) => (r.id === SANCTUARY ? 0 : clamp(Math.round(REGION_CELLS[r.id].length / 110), 8, 22)));
    for (const c of this.castles) this.spawnGarrison(c);
    for (const r of REGIONS) for (let k = 0; k < this.wildCap[r.id]; k++) this.spawnWild(r.id, true);
    this.grid = new Map(); this.nextMeta = 0; this.nextSpawnT = 0;
  }
  nid() { return ++this.idc; }
  getEnt(id) { return this.players.get(id) || this.npcs.get(id); }
  fx(o) { this.fxq.push(o); }

  // ---------------------------------------------------------------- teams
  teamOf(e) {
    if (e.owner) { const o = this.players.get(e.owner); return o ? this.teamOf(o) : (e.team || 'x'); }
    if (e.isPlayer) return e.fac ? 'f:' + e.fac : 'p:' + e.id;
    return e.team;
  }
  hostile(a, b) { return a !== b && !a.dead && !b.dead && this.teamOf(a) !== this.teamOf(b); }
  rootOwner(e) {
    if (!e) return null;
    if (e.credit) return this.players.get(e.credit) || null;
    if (e.isPlayer) return e;
    if (e.owner) return this.players.get(e.owner) || null;
    return null;
  }
  dmgMulOf(e) {
    let m = e.dmgMul || 1;
    if (this.T < e.weakUntil) m *= 0.6;
    if (this.T < e.buffUntil) m *= 1.3;
    return m;
  }
  speedOf(e) {
    if (this.T < e.stunUntil) return 0;
    let s = e.isPlayer ? 190 * e.mods.speed : e.def.spd;
    if (this.T < e.slowUntil) s *= e.slowF;
    if (this.T < e.buffUntil) s *= 1.2;
    return s;
  }
  stun(e, ms) { if (e.stunUntil !== undefined && e.kind !== 'banner') e.stunUntil = Math.max(e.stunUntil, this.T + ms); }
  weaken(e, ms) { if (e.weakUntil !== undefined) e.weakUntil = Math.max(e.weakUntil, this.T + ms); }
  slow(e, f, ms) { if (e.slowUntil === undefined) return; e.slowF = this.T < e.slowUntil ? Math.min(e.slowF, f) : f; e.slowUntil = Math.max(e.slowUntil, this.T + ms); }
  knock(e, ang, d) { if (e.kind === 'banner' || e.dead) return; [e.x, e.y] = moveBody(e.x, e.y, e.r, Math.cos(ang) * d, Math.sin(ang) * d); }
  heal(src, e, amt) {
    if (e.dead || e.hp <= 0) return;
    amt = Math.round(amt * (src && src.mods ? src.mods.heal : 1));
    const before = e.hp; e.hp = Math.min(e.maxhp, e.hp + amt);
    if (e.hp - before >= 1) this.fx({ t: 'heal', x: e.x, y: e.y - 14, v: Math.round(e.hp - before) });
  }

  // ---------------------------------------------------------------- spatial grid
  gridBuild() {
    const grid = new Map(), C = 160;
    const add = (e) => { const k = Math.floor(e.x / C) * 1000 + Math.floor(e.y / C); const a = grid.get(k); if (a) a.push(e); else grid.set(k, [e]); };
    for (const e of this.players.values()) if (!e.dead) add(e);
    for (const e of this.npcs.values()) add(e);
    this.grid = grid;
  }
  near(x, y, r) {
    const out = [], C = 160;
    const x0 = Math.max(0, Math.floor((x - r - 30) / C)), x1 = Math.floor((x + r + 30) / C);
    const y0 = Math.max(0, Math.floor((y - r - 30) / C)), y1 = Math.floor((y + r + 30) / C);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const a = this.grid.get(cx * 1000 + cy); if (!a) continue;
      for (const e of a) {
        if (e.dead || e.hp <= 0) continue;
        const dx = e.x - x, dy = e.y - y, rr = r + e.r;
        if (dx * dx + dy * dy <= rr * rr) out.push(e);
      }
    }
    return out;
  }
  hostileNear(src, x, y, r) { return this.near(x, y, r).filter((e) => this.hostile(src, e) && !inSafe(e)); }
  alliesNear(p, x, y, r) { return this.near(x, y, r).filter((e) => this.teamOf(e) === this.teamOf(p) && e.kind !== 'banner'); }

  // ---------------------------------------------------------------- damage & death
  dealDamage(src, tgt, amt, o = {}) {
    const T = this.T;
    if (tgt.dead || tgt.hp <= 0) return 0;
    if (inSafe(tgt) || (src && !src.isStub && inSafe(src))) return 0;
    if (src && !this.hostile(src, tgt)) return 0;
    if (src && !o.premul) amt *= this.dmgMulOf(src);
    if (o.parryable !== false && (T < tgt.parryUntil || T < tgt.counterUntil)) {
      if (T < tgt.parryUntil) tgt.parryUntil = 0;
      const atk = src && src.isStub ? this.getEnt(src.from) : src;
      if (atk && atk.stunUntil !== undefined && dist(atk, tgt) < 400) { this.stun(atk, 1000); this.weaken(atk, 4000); }
      tgt.riposteUntil = T + 2500;
      this.fx({ t: 'parry', x: tgt.x, y: tgt.y });
      return 0;
    }
    if (T < tgt.shieldUntil) amt *= 0.4;
    if (tgt.isPlayer && tgt.mods.lastStand && tgt.hp < tgt.maxhp * 0.3) amt *= 0.65;
    amt = Math.round(amt);
    if (amt <= 0) return 0;
    tgt.hp -= amt;
    tgt.lastHit = this.rootOwner(src); tgt.lastHitAt = T;
    this.fx({ t: 'dmg', x: tgt.x, y: tgt.y - 10, v: amt });
    if (o.melee && src && src.isPlayer && src.mods.lifesteal) { src.hp = Math.min(src.maxhp, src.hp + amt * src.mods.lifesteal); }
    if (tgt.isNpc && src && !tgt.target && !tgt.returning) tgt.target = src.isStub ? src.from : src.id;
    if (tgt.hp <= 0) (tgt.isPlayer ? this.killPlayer(tgt, T - tgt.lastHitAt < 8000 ? tgt.lastHit : null) : this.killNpc(tgt, tgt.lastHit));
    return amt;
  }
  gain(p, v, s) {
    if (!p || !p.isPlayer) return;
    const oldTier = p.tier, oldRank = rankOf(p.valor).idx;
    p.valor = Math.min(VALOR_CAP, p.valor + v);
    p.soma += s; p.dirty = true;
    if (v || s) this.send(p, { t: 'gain', v, s });
    const nt = tierOf(p.soma);
    if (nt !== p.tier) {
      p.tier = nt; this.recalc(p);
      if (nt > oldTier) {
        p.hp = p.maxhp;
        const extra = slotsForTier(nt) > slotsForTier(oldTier) ? ' New hotbar slot unlocked!' : '';
        this.send(p, { t: 'toast', m: `Soma tier ${nt}! +1 skill point.${extra}` });
      }
      this.sendProf(p);
    }
    const nr = rankOf(p.valor).idx;
    if (nr > oldRank) {
      this.send(p, { t: 'toast', m: `You are now a ${rankOf(p.valor).name}!` });
      if (nr >= 3) this.broadcast({ t: 'msg', m: `${p.name} has risen to the rank of ${rankOf(p.valor).name}.`, c: '#e0b84f' });
    }
  }
  award(killer, v, s) {
    this.gain(killer, v, s);
    if (killer && killer.fac) for (const o of this.players.values())
      if (o !== killer && !o.dead && o.fac === killer.fac && dist(o, killer) < 700) this.gain(o, 0, Math.ceil(s * 0.35));
  }
  killNpc(n, killer, silent) {
    if (n.dead) return;
    n.dead = true; this.npcs.delete(n.id);
    if (n.castle >= 0) { const c = this.castles.find((k) => k.id === n.castle); if (c && c.slots[n.slot] === n.id) c.slots[n.slot] = null; }
    if (n.region >= 0) this.wildCount[n.region]--;
    if (!silent && killer && !n.owner && n.kind !== 'banner') this.award(killer, Math.ceil(n.def.valor * n.sc), Math.ceil(n.def.soma * n.sc));
    this.fx({ t: 'poof', x: n.x, y: n.y });
  }
  killPlayer(p, killer) {
    if (p.dead) return;
    const T = this.T;
    p.dead = true; p.respawnAt = T + 5000; p.k = 0; p.spin = null;
    const lost = Math.floor(p.valor * 0.75);
    p.valor -= lost; p.dirty = true;
    this.removeSummonsOf(p.id);
    this.send(p, { t: 'died', lost, by: killer && killer !== p ? killer.name : null });
    if (killer && killer !== p && this.teamOf(killer) !== this.teamOf(p)) {
      const key = killer.accountId + ':' + p.accountId;
      if ((this.recentKills.get(key) || 0) < T) {
        this.recentKills.set(key, T + 60000);
        this.award(killer, 40 + Math.floor(lost * 0.3), 80 + p.tier * 20);
      }
      this.broadcast({ t: 'msg', m: `${killer.name} slew ${p.name}.`, c: '#c06060' });
    }
  }
  respawn(p) {
    p.dead = false; p.hp = p.maxhp; p.en = p.maxen;
    for (const k of ['stunUntil', 'slowUntil', 'weakUntil', 'buffUntil', 'shieldUntil', 'parryUntil', 'counterUntil', 'regenUntil']) p[k] = 0;
    let sp = null, bd = Infinity;
    if (p.fac) for (const c of this.castles) if (c.owner === p.fac) { const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < bd) { bd = d; sp = c; } }
    const pos = sp ? this.freeSpot(sp.x, sp.y + 60, 120) : this.villageSpot();
    p.x = pos.x; p.y = pos.y;
  }
  villageSpot() { return this.freeSpot(VILLAGE.x, VILLAGE.y, VILLAGE.r * 0.55, 60); }
  freeSpot(x, y, spread, minD = 0) {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * 6.283, d = rnd(minD, spread), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      if (freeAt(px, py, 16)) return { x: px, y: py };
    }
    return { x: VILLAGE.x, y: VILLAGE.y + 60 };
  }
  removeSummonsOf(pid) { for (const n of [...this.npcs.values()]) if (n.owner === pid) this.killNpc(n, null, true); }

  // ---------------------------------------------------------------- players
  recalc(p) {
    const has = (id) => p.skills.includes(id);
    p.mods = {
      melee: has('heavy_blade') ? 1.15 : 1, ranged: has('eagle_eye') ? 1.15 : 1, range: has('eagle_eye') ? 1.25 : 1,
      heal: has('alchemist') ? 1.35 : 1, en: (has('alchemist') ? 1.2 : 1) * (has('second_wind') ? 1.15 : 1),
      speed: has('second_wind') ? 1.1 : 1, lifesteal: has('bloodlust') ? 0.08 : 0, summon: has('inspire') ? 0.3 : 0,
      rally: has('inspire') ? 12000 : 8000, lastStand: has('last_stand'),
    };
    p.maxhp = 100 + 8 * p.tier; p.maxen = 100 + 3 * p.tier; p.dmgMul = 1 + 0.04 * p.tier;
    p.slots = slotsForTier(p.tier);
    p.pts = p.tier - p.skills.filter((s) => !SKILLS[s].free).length;
    p.hp = Math.min(p.hp, p.maxhp); p.en = Math.min(p.en, p.maxen);
  }
  sendProf(p) {
    this.recalc(p);
    this.send(p, { t: 'prof', skills: p.skills, hotbar: p.hotbar, pts: p.pts, slots: p.slots, tier: p.tier, fac: p.fac || 0, name: p.name });
  }
  send(p, obj) { if (p.out) p.out(typeof obj === 'string' ? obj : JSON.stringify(obj)); }
  broadcast(obj) { const s = JSON.stringify(obj); for (const p of this.players.values()) this.send(p, s); }

  // account = { id, username, progress }, out = function(string)
  join(account, out) {
    for (const o of this.players.values()) if (o.accountId === account.id) { this.send(o, { t: 'kicked', m: 'You signed in somewhere else.' }); if (o.onKick) o.onKick(); this.leave(o); }
    const pr = account.progress || {};
    let fac = pr.fac && this.factions[pr.fac] && this.factions[pr.fac].members.includes(account.id) ? +pr.fac : 0;
    const skills = [...new Set([...FREE_SKILLS, ...(Array.isArray(pr.skills) ? pr.skills : []).filter((s) => SKILLS[s])])];
    let hotbar = Array.isArray(pr.hotbar) ? pr.hotbar.slice(0, 10) : ['slash', 'arrow'];
    while (hotbar.length < 10) hotbar.push(null);
    hotbar = hotbar.map((s) => (s && skills.includes(s) && !SKILLS[s].passive ? s : null));
    const pos = this.villageSpot();
    const p = {
      id: this.nid(), isPlayer: true, kind: 'player', accountId: account.id, name: account.username, out,
      x: pos.x, y: pos.y, r: 14, ang: 0, k: 0, wp: 'sword',
      valor: clamp(pr.valor | 0, 0, VALOR_CAP), soma: Math.max(0, pr.soma | 0), skills, hotbar, fac,
      tier: 0, hp: 100, en: 100, dead: false, respawnAt: 0, cds: {}, spin: null,
      stunUntil: 0, slowUntil: 0, slowF: 1, weakUntil: 0, buffUntil: 0, shieldUntil: 0, parryUntil: 0, counterUntil: 0, riposteUntil: 0, regenUntil: 0, regenRate: 0,
      lastHit: null, lastHitAt: 0, lastChat: 0, dirty: false,
    };
    p.tier = tierOf(p.soma);
    // Skills beyond the points this tier allows (e.g. after a tuning change) are refunded.
    this.recalc(p);
    while (p.pts < 0) { const i = p.skills.findLastIndex((s) => !SKILLS[s].free); p.skills.splice(i, 1); this.recalc(p); }
    p.hotbar = p.hotbar.map((s) => (s && p.skills.includes(s) ? s : null));
    if (p.hotbar[0]) p.wp = WEAPON_OF[TREE_OF[p.hotbar[0]]];
    p.hp = p.maxhp; p.en = p.maxen;
    this.players.set(p.id, p);
    this.send(p, { t: 'welcome', id: p.id });
    this.sendProf(p);
    this.send(p, { t: 'meta', ...this.metaObj() });
    this.send(p, { t: 'msg', m: 'Welcome to Hanbin Island! Press H for help, K for skills, F for factions.', c: '#e0b84f' });
    return p;
  }
  leave(p) {
    if (!this.players.has(p.id)) return;
    this.removeSummonsOf(p.id);
    this.players.delete(p.id);
    for (const z of this.zones) if (z.owner === p.id && z.type === 'trap') z.until = 0;
  }
  progressOf(p) { return { valor: p.valor, soma: p.soma, skills: p.skills, hotbar: p.hotbar, fac: p.fac || 0 }; }
  worldState() {
    const castles = {};
    for (const c of this.castles) if (c.owner) castles[c.id] = c.owner;
    return { factions: this.factions, castles, nextFac: this.nextFac };
  }

  // ---------------------------------------------------------------- factions
  say(p, m) { this.send(p, { t: 'msg', m, c: '#c06060' }); }
  createFaction(p, name) {
    if (p.fac) return this.say(p, 'Leave your faction first.');
    name = String(name || '').trim().replace(/\s+/g, ' ');
    if (!factionNameOk(name)) return this.say(p, 'Faction names are 3-16 letters or numbers.');
    if (Object.keys(this.factions).length >= 200) return this.say(p, 'Too many factions exist.');
    if (Object.values(this.factions).some((f) => f.name.toLowerCase() === name.toLowerCase())) return this.say(p, 'That faction name is taken.');
    const id = this.nextFac++;
    const used = new Set(Object.values(this.factions).map((f) => f.color));
    const color = FAC_COLORS.find((c) => !used.has(c)) || FAC_COLORS[(id - 1) % FAC_COLORS.length];
    this.factions[id] = { id, name, color, leader: p.accountId, leaderName: p.name, members: [p.accountId] };
    p.fac = id; p.dirty = true; this.worldDirty = true; this.sendProf(p);
    this.broadcast({ t: 'msg', m: `${p.name} founded the faction ${name}!`, c: color });
  }
  joinFaction(p, id) {
    const f = this.factions[id];
    if (!f) return;
    if (p.fac) return this.say(p, 'Leave your faction first.');
    if (f.members.length >= 100) return this.say(p, 'That faction is full.');
    if (!f.members.includes(p.accountId)) f.members.push(p.accountId);
    p.fac = +id; p.dirty = true; this.worldDirty = true; this.sendProf(p);
    for (const n of this.npcs.values()) if (n.owner === p.id) n.target = null;
    this.broadcast({ t: 'msg', m: `${p.name} joined ${f.name}.`, c: f.color });
  }
  leaveFaction(p) {
    const id = p.fac, f = this.factions[id];
    p.fac = 0; p.dirty = true;
    for (const n of this.npcs.values()) if (n.owner === p.id) n.target = null;
    if (f) {
      f.members = f.members.filter((a) => a !== p.accountId);
      if (!f.members.length) this.disbandFaction(id);
      else if (f.leader === p.accountId) { f.leader = f.members[0]; const nl = [...this.players.values()].find((o) => o.accountId === f.leader); f.leaderName = nl ? nl.name : '?'; }
      this.send(p, { t: 'msg', m: `You left ${f.name}.`, c: '#aaa' });
    }
    this.worldDirty = true; this.sendProf(p);
  }
  disbandFaction(id) {
    const f = this.factions[id];
    if (!f) return;
    for (const c of this.castles) if (c.owner === +id) { c.owner = 0; this.clearGarrison(c); c.calm = 99; }
    for (const p of this.players.values()) if (p.fac === +id) { p.fac = 0; p.dirty = true; this.sendProf(p); }
    delete this.factions[id];
    this.worldDirty = true;
    this.broadcast({ t: 'msg', m: `The faction ${f.name} has fallen.`, c: '#888' });
  }

  // ---------------------------------------------------------------- NPCs
  mkNpc(kind, x, y, o = {}) {
    const def = MOBS[kind], sc = o.sc || 1;
    const n = {
      id: this.nid(), isNpc: true, kind, def, x, y, ang: Math.random() * 6.28, hp: def.hp * sc, maxhp: def.hp * sc, r: def.r, sc,
      team: o.team || 'wild', home: { x, y }, leash: o.leash || 550, owner: o.owner || null, ttl: o.ttl || 0,
      castle: o.castle ?? -1, slot: o.slot ?? -1, region: o.region ?? -1, fac: o.fac || 0, dmgMul: 1 + (sc - 1) * 0.6,
      stunUntil: 0, slowUntil: 0, slowF: 1, weakUntil: 0, buffUntil: 0, shieldUntil: 0, parryUntil: 0, counterUntil: 0, riposteUntil: 0, regenUntil: 0, regenRate: 0,
      target: null, nextAtk: 0, nextScan: 0, wanderT: 0, wp: null, returning: false, lastHit: null, lastHitAt: 0, detour: 0, detourUntil: 0,
    };
    this.npcs.set(n.id, n);
    return n;
  }
  spawnWild(ri, ignorePlayers) {
    const cells = REGION_CELLS[ri], danger = REGIONS[ri].danger;
    if (!cells.length || !danger) return;
    for (let tries = 0; tries < 10; tries++) {
      const cell = cells[Math.floor(Math.random() * cells.length)];
      const x = (cell % GW) * RC + Math.random() * RC, y = Math.floor(cell / GW) * RC + Math.random() * RC;
      if (!freeAt(x, y, 24)) continue;
      if (this.castles.some((c) => Math.abs(x - c.x) < CH + 140 && Math.abs(y - c.y) < CH + 140)) continue;
      if (Math.hypot(x - VILLAGE.x, y - VILLAGE.y) < VILLAGE.r + 250) continue;
      if (!ignorePlayers && [...this.players.values()].some((p) => Math.hypot(p.x - x, p.y - y) < 600)) continue;
      this.mkNpc(pickWeighted(WILD_TABLE[danger]), x, y, { sc: 1 + 0.3 * (danger - 1), region: ri, leash: 600 });
      this.wildCount[ri]++;
      return;
    }
  }
  spawnGuard(c, i) {
    const kinds = garrisonFor(c.danger), inner = CH - WALL - 34;
    let x = c.x, y = c.y + 80;
    for (let t = 0; t < 30; t++) {
      const px = c.x + rnd(-inner, inner), py = c.y + rnd(-inner, inner);
      if (freeAt(px, py, 20)) { x = px; y = py; break; }
    }
    const n = this.mkNpc(kinds[i], x, y, { sc: 1 + 0.3 * (c.danger - 1), team: c.owner ? 'f:' + c.owner : 'wild', fac: c.owner || 0, castle: c.id, slot: i, leash: 380 });
    c.slots[i] = n.id;
  }
  spawnGarrison(c) { for (let i = 0; i < c.slots.length; i++) if (!c.slots[i] || !this.npcs.has(c.slots[i])) this.spawnGuard(c, i); }
  clearGarrison(c) {
    for (let i = 0; i < c.slots.length; i++) { const n = this.npcs.get(c.slots[i]); if (n) this.killNpc(n, null, true); c.slots[i] = null; }
  }
  steer(n, x, y, spd) {
    const dx = x - n.x, dy = y - n.y, d = Math.hypot(dx, dy);
    if (d < 1) return;
    const step = Math.min(d, spd * DT), base = Math.atan2(dy, dx);
    const tryAng = (a) => {
      const [nx, ny] = moveBody(n.x, n.y, n.r, Math.cos(a) * step, Math.sin(a) * step);
      const prog = (nx - n.x) * Math.cos(base) + (ny - n.y) * Math.sin(base);
      return { nx, ny, prog, moved: Math.hypot(nx - n.x, ny - n.y) };
    };
    if (this.T < n.detourUntil) {
      const r = tryAng(base + n.detour);
      if (r.moved > step * 0.5) { n.x = r.nx; n.y = r.ny; return; }
    }
    let r = tryAng(base);
    if (r.prog < step * 0.4) {
      for (const off of [0.8, -0.8, 1.5, -1.5]) {
        const r2 = tryAng(base + off);
        if (r2.moved > step * 0.5) { r = r2; n.detour = off; n.detourUntil = this.T + 600; break; }
      }
    }
    n.x = r.nx; n.y = r.ny;
  }
  findTarget(n) {
    let best = null, bd = Infinity;
    for (const e of this.near(n.x, n.y, n.def.aggro)) {
      if (e === n || e.kind === 'banner' || !this.hostile(n, e) || inSafe(e)) continue;
      const d = (e.x - n.x) ** 2 + (e.y - n.y) ** 2;
      if (d < bd && losClear(n.x, n.y, e.x, e.y)) { bd = d; best = e; }
    }
    return best ? best.id : null;
  }
  tickStatus(e) {
    if (this.T < e.regenUntil) e.hp = Math.min(e.maxhp, e.hp + e.regenRate * DT);
  }
  updateNpc(n, awake) {
    const T = this.T;
    if (n.ttl && T > n.ttl) return this.killNpc(n, null, true);
    this.tickStatus(n);
    if (n.kind === 'banner') {
      for (const e of this.near(n.x, n.y, 200)) if (e !== n && this.teamOf(e) === this.teamOf(n)) { e.hp = Math.min(e.maxhp, e.hp + 6 * DT); if (e.buffUntil !== undefined) e.buffUntil = Math.max(e.buffUntil, T + 1200); }
      return;
    }
    const own = n.owner ? this.players.get(n.owner) : null;
    if (n.owner && (!own || own.dead)) return this.killNpc(n, null, true);
    if (!awake && !n.owner) { if (n.hp < n.maxhp) n.hp = Math.min(n.maxhp, n.hp + n.maxhp * 0.05 * DT); return; }
    if (T < n.stunUntil) return;
    const spd = this.speedOf(n);
    let tgt = n.target ? this.getEnt(n.target) : null;
    if (tgt && (tgt.dead || tgt.hp <= 0 || !this.hostile(n, tgt) || inSafe(tgt) || dist(n, tgt) > n.def.aggro * 2)) { tgt = null; n.target = null; }
    if (!n.owner) {
      const dh = Math.hypot(n.x - n.home.x, n.y - n.home.y);
      if (dh > n.leash) { n.returning = true; n.target = null; tgt = null; }
      if (n.returning && dh < 40) n.returning = false;
    }
    if (!tgt && !n.returning && T >= n.nextScan) {
      n.nextScan = T + 300 + Math.random() * 200;
      n.target = this.findTarget(n); tgt = n.target ? this.getEnt(n.target) : null;
    }
    n.moving = false;
    if (tgt) {
      const d = dist(n, tgt), ar = n.def.range;
      n.ang = Math.atan2(tgt.y - n.y, tgt.x - n.x);
      // Re-check sight a few times a second; without it, close in instead of attacking through walls.
      if (T >= (n.losAt || 0)) { n.losAt = T + 250; n.los = losClear(n.x, n.y, tgt.x, tgt.y); }
      if (!n.los) { this.steer(n, tgt.x, tgt.y, spd); n.moving = true; }
      else if (n.def.ranged) {
        if (d > ar * 0.85) { this.steer(n, tgt.x, tgt.y, spd); n.moving = true; }
        if (d <= ar && T >= n.nextAtk) {
          n.nextAtk = T + n.def.cd;
          this.fireProj(n, n.ang + rnd(-0.05, 0.05), { speed: 440, dmg: n.def.dmg, life: ar / 440 + 0.3, kind: n.def.proj || 'arrow' });
        }
      } else if (d > ar + tgt.r + n.r - 4) { this.steer(n, tgt.x, tgt.y, spd); n.moving = true; }
      else if (T >= n.nextAtk) {
        n.nextAtk = T + n.def.cd; n.atkAt = T;
        this.fx({ t: 'arc', x: n.x, y: n.y, a: n.ang, r: ar + 14, w: 1.2 });
        this.dealDamage(n, tgt, n.def.dmg, { melee: true });
      }
    } else if (n.owner) {
      const d = dist(n, own);
      if (d > 650) { const s = this.freeSpot(own.x, own.y, 60); n.x = s.x; n.y = s.y; }
      else if (d > 90) { n.ang = Math.atan2(own.y - n.y, own.x - n.x); this.steer(n, own.x, own.y, spd); n.moving = true; }
    } else if (n.returning) {
      n.hp = Math.min(n.maxhp, n.hp + n.maxhp * 0.1 * DT);
      n.ang = Math.atan2(n.home.y - n.y, n.home.x - n.x);
      this.steer(n, n.home.x, n.home.y, spd); n.moving = true;
      if (Math.hypot(n.x - n.home.x, n.y - n.home.y) > n.leash * 2.5) { n.x = n.home.x; n.y = n.home.y; }
    } else {
      if (n.hp < n.maxhp) n.hp = Math.min(n.maxhp, n.hp + n.maxhp * 0.02 * DT);
      const wr = n.castle >= 0 ? 90 : 160;
      if (!n.wp || T > n.wanderT) { n.wp = { x: n.home.x + rnd(-wr, wr), y: n.home.y + rnd(-wr, wr) }; n.wanderT = T + rnd(2500, 6000); }
      if (Math.hypot(n.wp.x - n.x, n.wp.y - n.y) > 10) { n.ang = Math.atan2(n.wp.y - n.y, n.wp.x - n.x); this.steer(n, n.wp.x, n.wp.y, spd * 0.35); n.moving = true; }
    }
  }

  // ---------------------------------------------------------------- projectiles & zones
  mkStub(src) {
    const root = this.rootOwner(src);
    return { isStub: true, id: -1, from: src.id, x: src.x, y: src.y, team: this.teamOf(src), dmgMul: 1, credit: root ? root.id : null, hp: 1, r: 0 };
  }
  fireProj(src, ang, o) {
    const mods = src.isPlayer ? src.mods : null;
    const rangedMul = mods && o.player ? mods.ranged : 1, lifeMul = mods && o.player ? mods.range : 1;
    const mul = this.dmgMulOf(src) * rangedMul;
    this.projs.push({
      x: src.x + Math.cos(ang) * (src.r + 4), y: src.y + Math.sin(ang) * (src.r + 4),
      vx: Math.cos(ang) * o.speed, vy: Math.sin(ang) * o.speed, ang, life: o.life * lifeMul, kind: o.kind || 'arrow',
      dmg: o.dmg * mul, aoe: o.aoe || 0, aoeDmg: (o.aoeDmg || 0) * mul, pierce: o.pierce || 0, knock: o.knock || 0, slow: o.slow || 0,
      hit: new Set(), stub: this.mkStub(src), team: this.teamOf(src),
    });
  }
  updateProjs() {
    const keep = [];
    for (const p of this.projs) {
      p.life -= DT;
      let dead = p.life <= 0;
      const steps = 3;
      for (let s = 0; s < steps && !dead; s++) {
        p.x += (p.vx * DT) / steps; p.y += (p.vy * DT) / steps;
        if (p.x < 0 || p.y < 0 || p.x > W || p.y > H || shotBlocked(p.x, p.y)) {
          dead = true;
          if (p.aoe) this.explode(p, null);
          else this.fx({ t: 'spark', x: p.x, y: p.y });
          break;
        }
        for (const e of this.near(p.x, p.y, 8)) {
          if (p.hit.has(e.id) || this.teamOf(e) === p.team || e.kind === 'banner' && !p.aoe) continue;
          p.hit.add(e.id);
          if (p.dmg > 0) this.dealDamage(p.stub, e, p.dmg, { premul: true });
          if (p.slow) this.slow(e, 0.45, p.slow);
          if (p.knock) this.knock(e, p.ang, p.knock);
          if (p.aoe) this.explode(p, e);
          if (p.pierce-- <= 0) { dead = true; break; }
        }
      }
      if (!dead) keep.push(p);
    }
    this.projs = keep;
  }
  explode(p, except) {
    this.fx({ t: 'boom', x: p.x, y: p.y, r: p.aoe });
    for (const o of this.near(p.x, p.y, p.aoe)) if (o !== except && this.teamOf(o) !== p.team) this.dealDamage(p.stub, o, p.aoeDmg, { parryable: false, premul: true });
  }
  updateZones() {
    const T = this.T, keep = [];
    for (const z of this.zones) {
      if (z.type === 'meteor') {
        if (T >= z.at) {
          this.fx({ t: 'boom', x: z.x, y: z.y, r: z.r, big: 1 });
          for (const e of this.near(z.x, z.y, z.r)) if (this.teamOf(e) !== z.team) { this.dealDamage(z.stub, e, z.dmg, { parryable: false, premul: true }); this.stun(e, 600); }
          continue;
        }
      } else {
        if (T >= z.until) continue;
        if (z.type === 'trap') {
          const hit = this.near(z.x, z.y, z.r).find((e) => this.teamOf(e) !== z.team && e.kind !== 'banner');
          if (hit) { this.stun(hit, 2200); this.dealDamage(z.stub, hit, z.dmg, { parryable: false, premul: true }); this.fx({ t: 'ring', x: z.x, y: z.y, r: 50, c: '#c8a060' }); continue; }
        } else if (T >= z.next) {
          z.next = T + z.every;
          for (const e of this.near(z.x, z.y, z.r)) {
            if (this.teamOf(e) === z.team) continue;
            if (z.type === 'smoke') { this.slow(e, 0.6, 700); this.weaken(e, 700); }
            else this.dealDamage(z.stub, e, z.dmg, { parryable: false, premul: true });
          }
        }
      }
      keep.push(z);
    }
    this.zones = keep;
  }
  addZone(p, type, x, y, r, ms, o = {}) {
    const z = { type, x, y, r, until: this.T + ms, d: ms, next: this.T + 200, every: 500, team: this.teamOf(p), stub: this.mkStub(p), owner: p.id, ...o };
    this.zones.push(z);
    return z;
  }

  // ---------------------------------------------------------------- skills
  meleeArc(p, range, arc, dmg, o = {}) {
    this.fx({ t: 'arc', x: p.x, y: p.y, a: p.ang, r: range, w: arc, c: o.c });
    let hits = 0;
    for (const e of this.near(p.x, p.y, range)) {
      if (!this.hostile(p, e)) continue;
      if (arc < 6.2 && angDiff(Math.atan2(e.y - p.y, e.x - p.x), p.ang) > arc / 2) continue;
      if (!losClear(p.x, p.y, e.x, e.y)) continue;
      let d = dmg * (p.mods ? p.mods.melee : 1);
      if (o.execute && e.hp < e.maxhp * 0.35) d *= 2;
      if (this.dealDamage(p, e, d, { melee: true }) > 0) {
        hits++;
        if (o.stun) this.stun(e, o.stun);
        if (o.slow) this.slow(e, o.slow, 3000);
        if (o.knock) this.knock(e, Math.atan2(e.y - p.y, e.x - p.x), o.knock);
      }
    }
    return hits;
  }
  summon(p, kinds, ttl, cap) {
    const mine = [...this.npcs.values()].filter((n) => n.owner === p.id && n.kind !== 'banner');
    const over = mine.length + kinds.length - cap;
    for (let i = 0; i < over && i < mine.length; i++) this.killNpc(mine[i], null, true);
    for (const k of kinds) {
      const s = this.freeSpot(p.x, p.y, 70, 30);
      this.mkNpc(k, s.x, s.y, { owner: p.id, ttl: this.T + ttl, sc: 1 + p.tier * 0.05 + p.mods.summon, leash: 99999 });
    }
    this.fx({ t: 'ring', x: p.x, y: p.y, r: 90, c: '#e0b84f' });
  }
  aimPoint(p, ang, max) {
    const tx = p.aimX ?? p.x + Math.cos(ang) * max, ty = p.aimY ?? p.y + Math.sin(ang) * max;
    const d = Math.min(max, Math.hypot(tx - p.x, ty - p.y));
    return { x: clamp(p.x + Math.cos(ang) * d, 0, W), y: clamp(p.y + Math.sin(ang) * d, 0, H) };
  }
  runSkill(p, id, ang) {
    const T = this.T, cos = Math.cos(ang), sin = Math.sin(ang);
    switch (id) {
      // Blade
      case 'slash': return this.meleeArc(p, 80, 1.7, 16);
      case 'cleave': return this.meleeArc(p, 100, 2.8, 36, { knock: 60, c: '#ff9a7a' });
      case 'shield_bash': return this.meleeArc(p, 72, 1.4, 18, { stun: 1300, c: '#cfd8e8' });
      case 'whirlwind': p.spin = { left: 3, next: T }; return;
      case 'ground_slam':
        this.fx({ t: 'ring', x: p.x, y: p.y, r: 170, c: '#b08a5a' });
        return this.meleeArc(p, 170, 6.4, 38, { slow: 0.5 });
      case 'executioner': return this.meleeArc(p, 95, 1.4, 70, { execute: true, c: '#ff4040' });
      case 'titan_strike': return this.meleeArc(p, 140, 2.2, 110, { stun: 1800, knock: 40, c: '#ffd070' });
      // Marksman
      case 'arrow': return this.fireProj(p, ang, { speed: 650, dmg: 14, life: 0.85, player: 1 });
      case 'power_shot': return this.fireProj(p, ang, { speed: 900, dmg: 40, life: 0.95, kind: 'power', pierce: 3, player: 1 });
      case 'crippling_shot': return this.fireProj(p, ang, { speed: 700, dmg: 18, life: 0.85, slow: 3500, kind: 'power', player: 1 });
      case 'volley': for (let i = -3; i <= 3; i++) this.fireProj(p, ang + i * 0.12, { speed: 650, dmg: 15, life: 0.85, player: 1 }); return;
      case 'snare_trap': {
        const mine = this.zones.filter((z) => z.owner === p.id && z.type === 'trap');
        if (mine.length >= 2) mine[0].until = 0;
        const pt = this.aimPoint(p, ang, 200);
        this.addZone(p, 'trap', pt.x, pt.y, 34, 30000, { dmg: 25 * this.dmgMulOf(p) });
        return;
      }
      case 'explosive_arrow': return this.fireProj(p, ang, { speed: 620, dmg: 30, life: 0.95, kind: 'fire', aoe: 120, aoeDmg: 45, player: 1 });
      case 'rain_of_arrows': {
        const pt = this.aimPoint(p, ang, 420);
        this.addZone(p, 'rain', pt.x, pt.y, 150, 2000, { dmg: 12 * this.dmgMulOf(p) * p.mods.ranged, every: 250 });
        return;
      }
      case 'piercing_gale': return this.fireProj(p, ang, { speed: 1000, dmg: 85, life: 0.9, kind: 'gale', pierce: 99, knock: 120, player: 1 });
      // Alchemy & Sorcery
      case 'firebolt': return this.fireProj(p, ang, { speed: 540, dmg: 24, life: 1.0, kind: 'fire', aoe: 60, aoeDmg: 14 });
      case 'healing_draught':
        for (const e of this.alliesNear(p, p.x, p.y, 150)) this.heal(p, e, e === p ? 70 : 40);
        return this.fx({ t: 'ring', x: p.x, y: p.y, r: 150, c: '#5fe08a' });
      case 'frost_nova':
        this.fx({ t: 'ring', x: p.x, y: p.y, r: 170, c: '#8fd8ff', fill: 1 });
        for (const e of this.hostileNear(p, p.x, p.y, 170)) { this.dealDamage(p, e, 22, { parryable: false }); this.slow(e, 0.5, 3000); }
        return;
      case 'poison_flask': {
        const pt = this.aimPoint(p, ang, 300);
        this.addZone(p, 'poison', pt.x, pt.y, 110, 6000, { dmg: 7 * this.dmgMulOf(p) });
        return this.fx({ t: 'ring', x: pt.x, y: pt.y, r: 110, c: '#7ad04a' });
      }
      case 'chain_lightning': {
        const pt = this.aimPoint(p, ang, 380);
        let cur = this.hostileNear(p, pt.x, pt.y, 160).sort((a, b) => dist(a, pt) - dist(b, pt))[0];
        const pts = [[rd(p.x), rd(p.y)]], hit = new Set();
        let dmg = 40;
        while (cur && hit.size < 4) {
          hit.add(cur.id); pts.push([rd(cur.x), rd(cur.y)]);
          this.dealDamage(p, cur, dmg, { parryable: false }); this.stun(cur, 250);
          dmg *= 0.8;
          const from = cur;
          cur = this.hostileNear(p, from.x, from.y, 230).filter((e) => !hit.has(e.id)).sort((a, b) => dist(a, from) - dist(b, from))[0];
        }
        if (pts.length === 1) pts.push([rd(pt.x), rd(pt.y)]);
        return this.fx({ t: 'bolt', x: p.x, y: p.y, pts });
      }
      case 'arcane_ward':
        for (const e of this.alliesNear(p, p.x, p.y, 180)) if (e.shieldUntil !== undefined) e.shieldUntil = Math.max(e.shieldUntil, T + 4000);
        return this.fx({ t: 'ring', x: p.x, y: p.y, r: 180, c: '#b88cff' });
      case 'meteor': {
        const pt = this.aimPoint(p, ang, 400);
        this.zones.push({ type: 'meteor', x: pt.x, y: pt.y, r: 160, at: T + 1200, d: 1200, dmg: 130 * this.dmgMulOf(p), team: this.teamOf(p), stub: this.mkStub(p), owner: p.id });
        return;
      }
      case 'rejuvenation':
        for (const e of this.alliesNear(p, p.x, p.y, 200)) { e.regenUntil = T + 6000; e.regenRate = 12 * p.mods.heal; }
        return this.fx({ t: 'ring', x: p.x, y: p.y, r: 200, c: '#7ff0a0', fill: 1 });
      // Command
      case 'rally':
        for (const e of this.alliesNear(p, p.x, p.y, 320)) if (e.buffUntil !== undefined) e.buffUntil = T + p.mods.rally;
        return this.fx({ t: 'ring', x: p.x, y: p.y, r: 320, c: '#e0b84f' });
      case 'summon_footmen': return this.summon(p, ['footman', 'footman'], 45000, 8);
      case 'summon_archers': return this.summon(p, ['summoned_archer', 'summoned_archer', 'summoned_archer'], 50000, 8);
      case 'summon_knights': return this.summon(p, ['knight', 'knight', 'knight'], 60000, 8);
      case 'legion_call': return this.summon(p, ['knight', 'knight', 'knight', 'knight', 'summoned_archer', 'summoned_archer', 'summoned_archer', 'summoned_archer'], 60000, 12);
      case 'war_banner': {
        for (const n of this.npcs.values()) if (n.owner === p.id && n.kind === 'banner') this.killNpc(n, null, true);
        this.mkNpc('banner', p.x, p.y, { owner: p.id, ttl: T + 12000, leash: 99999 });
        return this.fx({ t: 'ring', x: p.x, y: p.y, r: 200, c: '#ffffff' });
      }
      case 'war_horn':
        this.fx({ t: 'ring', x: p.x, y: p.y, r: 260, c: '#ffcf70', fill: 1 });
        for (const e of this.hostileNear(p, p.x, p.y, 260)) { this.knock(e, Math.atan2(e.y - p.y, e.x - p.x), 140); this.weaken(e, 5000); }
        return;
      case 'fortify':
        for (const e of this.alliesNear(p, p.x, p.y, 260)) if (e.shieldUntil !== undefined) e.shieldUntil = Math.max(e.shieldUntil, T + 5000);
        return this.fx({ t: 'ring', x: p.x, y: p.y, r: 260, c: '#9aa4b8' });
      // Technique
      case 'parry': p.parryUntil = T + 650; return this.fx({ t: 'ring', x: p.x, y: p.y, r: 30, c: '#4fc3e0' });
      case 'dash': {
        const ox = p.x, oy = p.y;
        [p.x, p.y] = moveBody(p.x, p.y, p.r, cos * 190, sin * 190);
        return this.fx({ t: 'line', x: ox, y: oy, x2: p.x, y2: p.y, c: '#bfefff' });
      }
      case 'riposte': {
        const win = T < p.riposteUntil; p.riposteUntil = 0;
        const ox = p.x, oy = p.y;
        const [ex, ey] = moveBody(p.x, p.y, p.r, cos * 140, sin * 140);
        const sx = ex - ox, sy = ey - oy, len2 = sx * sx + sy * sy || 1;
        for (const e of this.near((ox + ex) / 2, (oy + ey) / 2, 110)) {
          if (!this.hostile(p, e)) continue;
          const t = clamp(((e.x - ox) * sx + (e.y - oy) * sy) / len2, 0, 1);
          if (Math.hypot(e.x - (ox + sx * t), e.y - (oy + sy * t)) > 34 + e.r) continue;
          this.dealDamage(p, e, (win ? 62 : 28) * p.mods.melee, { melee: true, parryable: !win });
          this.weaken(e, 5000);
        }
        p.x = ex; p.y = ey;
        return this.fx({ t: 'line', x: ox, y: oy, x2: ex, y2: ey, c: win ? '#ffe070' : '#ffffff' });
      }
      case 'shadowstep': {
        const pt = this.aimPoint(p, ang, 300);
        for (let k = 0; k < 12; k++) {
          const f = 1 - k / 12, x = p.x + (pt.x - p.x) * f, y = p.y + (pt.y - p.y) * f;
          if (freeAt(x, y, p.r)) { this.fx({ t: 'poof', x: p.x, y: p.y, c: '#402060' }); p.x = x; p.y = y; this.fx({ t: 'poof', x, y, c: '#402060' }); return; }
        }
        return;
      }
      case 'intimidate':
        this.fx({ t: 'ring', x: p.x, y: p.y, r: 230, c: '#c04040' });
        for (const e of this.hostileNear(p, p.x, p.y, 230)) { this.weaken(e, 6000); this.slow(e, 0.75, 4000); }
        return;
      case 'smoke_bomb': this.addZone(p, 'smoke', p.x, p.y, 140, 4000, { every: 250 }); return;
      case 'iron_skin': p.shieldUntil = T + 5000; return this.fx({ t: 'ring', x: p.x, y: p.y, r: 40, c: '#8890a0' });
      case 'counter_stance': p.counterUntil = T + 2200; return this.fx({ t: 'ring', x: p.x, y: p.y, r: 36, c: '#4fc3e0' });
    }
  }
  cast(p, slot, ang, ax, ay) {
    if (p.dead || this.T < p.stunUntil || !Number.isFinite(ang)) return;
    slot = slot | 0;
    if (slot < 0 || slot >= p.slots) return;
    const id = p.hotbar[slot], sk = id && SKILLS[id];
    if (!sk || sk.passive || !p.skills.includes(id)) return;
    if ((p.cds[id] || 0) > this.T || p.en < sk.en) return;
    p.en -= sk.en; p.cds[id] = this.T + sk.cd; p.ang = ang;
    p.aimX = Number.isFinite(ax) ? ax : null; p.aimY = Number.isFinite(ay) ? ay : null;
    p.wp = WEAPON_OF[sk.tree]; p.atkAt = this.T;
    this.runSkill(p, id, ang);
  }

  // ---------------------------------------------------------------- per-tick updates
  updatePlayer(p) {
    const T = this.T;
    if (p.dead) { if (T >= p.respawnAt) this.respawn(p); return; }
    this.tickStatus(p);
    p.en = Math.min(p.maxen, p.en + (6 + p.tier * 0.2) * p.mods.en * DT);
    if (inSafe(p)) p.hp = Math.min(p.maxhp, p.hp + p.maxhp * 0.08 * DT);
    else if (T - p.lastHitAt > 5000) p.hp = Math.min(p.maxhp, p.hp + (1 + p.maxhp * 0.01) * DT);
    if (p.spin && T >= p.spin.next) {
      this.meleeArc(p, 120, 6.4, 22, { c: '#ffb0a0' });
      p.spin.next = T + 300;
      if (--p.spin.left <= 0) p.spin = null;
    }
    const spd = this.speedOf(p);
    const dx = ((p.k & 8) ? 1 : 0) - ((p.k & 4) ? 1 : 0), dy = ((p.k & 2) ? 1 : 0) - ((p.k & 1) ? 1 : 0), len = Math.hypot(dx, dy);
    if (len > 0 && spd > 0) [p.x, p.y] = moveBody(p.x, p.y, p.r, (dx / len) * spd * DT, (dy / len) * spd * DT);
  }
  updateCastles() {
    for (const c of this.castles) {
      const defTeam = c.owner ? 'f:' + c.owner : 'wild';
      let def = 0, enemies = 0;
      for (const id of c.slots) if (id && this.npcs.has(id)) def++;
      const atk = new Map();
      for (const p of this.players.values()) {
        if (p.dead || !inCastle(c, p.x, p.y)) continue;
        if (this.teamOf(p) === defTeam) def++;
        else { enemies++; if (p.fac) atk.set(p.fac, (atk.get(p.fac) || 0) + 1); }
      }
      c.def = def;
      let lead = 0, lc = 0, tie = false;
      for (const [f, n] of atk) { if (n > lc) { lc = n; lead = f; tie = false; } else if (n === lc) tie = true; }
      if (def === 0 && lead && !tie) {
        if (c.prog.fac !== lead) { c.prog.fac = lead; c.prog.t = 0; }
        c.prog.t += DT;
        if (c.prog.t >= CAPTURE_TIME) this.captureCastle(c, lead);
      } else c.prog.t = Math.max(0, c.prog.t - 2 * DT);
      if (enemies > 0) c.calm = 0; else c.calm += DT;
      if (c.calm > 12 && this.T >= c.nextSpawn) {
        const i = c.slots.findIndex((id) => !id || !this.npcs.has(id));
        if (i >= 0) { this.spawnGuard(c, i); c.nextSpawn = this.T + 2500; }
      }
    }
  }
  captureCastle(c, facId) {
    const f = this.factions[facId];
    if (!f) { c.prog.t = 0; return; }
    const old = c.owner && this.factions[c.owner] ? this.factions[c.owner].name : 'the bandits';
    this.clearGarrison(c);
    c.owner = facId; c.prog = { fac: 0, t: 0 }; c.calm = 99;
    this.spawnGarrison(c);
    for (const p of this.players.values()) if (!p.dead && p.fac === facId && Math.hypot(p.x - c.x, p.y - c.y) <= CH + 200) this.gain(p, 250, 600 + c.danger * 150);
    this.broadcast({ t: 'msg', m: `${f.name} has conquered ${c.name} from ${old}!`, c: f.color });
    this.worldDirty = true;
  }

  // ---------------------------------------------------------------- snapshots
  flagsOf(e) {
    const T = this.T; let f = 0;
    if (T < e.stunUntil) f |= 1; if (T < e.parryUntil || T < e.counterUntil) f |= 2; if (T < e.slowUntil) f |= 4;
    if (T < e.weakUntil) f |= 8; if (T < e.buffUntil) f |= 16; if (T < e.shieldUntil) f |= 32; if (T < e.riposteUntil) f |= 64;
    if (T < e.regenUntil) f |= 128;
    return f;
  }
  snapshot(p) {
    const T = this.T, vx = p.x, vy = p.y, ents = [];
    const push = (e) => {
      if (e.dead || Math.abs(e.x - vx) > VIEW_W || Math.abs(e.y - vy) > VIEW_H) return;
      const o = { i: e.id, k: e.kind, x: rd(e.x), y: rd(e.y), a: +e.ang.toFixed(2), h: rd(e.hp), m: rd(e.maxhp), fl: this.flagsOf(e) };
      if (e.atkAt && T - e.atkAt < 300) o.at = 1;
      if (e.isPlayer) { o.n = e.name; o.f = e.fac || 0; o.rk = rankOf(e.valor).idx; o.wp = e.wp; if (e.spin) o.sp = 1; }
      else if (e.owner) { const ow = this.players.get(e.owner); o.f = ow ? ow.fac || 0 : 0; o.ow = e.owner; }
      else o.f = e.fac || 0;
      ents.push(o);
    };
    for (const e of this.players.values()) push(e);
    for (const e of this.npcs.values()) push(e);
    const pr = [];
    for (const q of this.projs) if (Math.abs(q.x - vx) < VIEW_W && Math.abs(q.y - vy) < VIEW_H) pr.push([rd(q.x), rd(q.y), q.kind, +q.ang.toFixed(2)]);
    const zs = [], myTeam = this.teamOf(p);
    for (const z of this.zones) {
      if (Math.abs(z.x - vx) > VIEW_W + 200 || Math.abs(z.y - vy) > VIEW_H + 200) continue;
      if (z.type === 'trap' && z.team !== myTeam) continue;
      zs.push({ t: z.type, x: rd(z.x), y: rd(z.y), r: z.r, l: z.type === 'meteor' ? z.at - T : z.until - T, d: z.d });
    }
    const fxs = this.fxq.filter((f) => Math.abs(f.x - vx) < VIEW_W + 200 && Math.abs(f.y - vy) < VIEW_H + 200);
    const cd = [];
    for (const id in p.cds) { const rem = p.cds[id] - T; if (rem > 0) cd.push([id, rem]); }
    let cz = -1, cp = 0, cdf = 0;
    for (const c of this.castles) if (inCastle(c, p.x, p.y)) { cz = c.id; cp = +(c.prog.t / CAPTURE_TIME).toFixed(2); cdf = c.def; break; }
    return JSON.stringify({
      t: 's', n: this.tickNo,
      me: { x: rd(p.x), y: rd(p.y), h: rd(p.hp), mh: p.maxhp, en: rd(p.en), me: p.maxen, v: p.valor, s: p.soma, sp: rd(this.speedOf(p)), fl: this.flagsOf(p), cd,
        dead: p.dead ? 1 : 0, rs: p.dead ? Math.max(0, p.respawnAt - T) : 0, cz, cp, cdf },
      e: ents, pr, zs, fx: fxs,
    });
  }
  metaObj() {
    const facs = Object.values(this.factions).map((f) => ({ id: f.id, name: f.name, color: f.color, m: f.members.length, c: this.castles.filter((c) => c.owner === f.id).length, l: f.leaderName || '?' }));
    const lb = [...this.players.values()].sort((a, b) => b.valor - a.valor || b.soma - a.soma).slice(0, 10).map((p) => ({ n: p.name, v: p.valor, s: p.soma, t: p.tier, f: p.fac || 0 }));
    return { c: this.castles.map((c) => [c.id, c.owner || 0]), f: facs, lb, on: this.players.size };
  }

  // ---------------------------------------------------------------- messages from a client
  handle(p, m) {
    switch (m.t) {
      case 'in': if (!p.dead) { p.k = m.k & 15; if (Number.isFinite(m.a)) p.ang = m.a; } break;
      case 'cast': this.cast(p, m.s, +m.a, +m.x, +m.y); break;
      case 'learn': {
        const sk = SKILLS[m.id];
        if (!sk || sk.free || p.skills.includes(sk.id) || p.tier < sk.tier || p.pts <= 0) break;
        if (sk.req && !p.skills.includes(sk.req)) break;
        p.skills.push(sk.id);
        if (!sk.passive) { const slot = p.hotbar.findIndex((s, i) => !s && i < p.slots); if (slot >= 0) p.hotbar[slot] = sk.id; }
        p.dirty = true; this.sendProf(p);
        this.send(p, { t: 'toast', m: `Learned ${sk.name}` });
        break;
      }
      case 'hb': {
        const s = m.s | 0;
        if (s < 0 || s >= p.slots) break;
        if (m.id === null) p.hotbar[s] = null;
        else if (typeof m.id === 'string' && p.skills.includes(m.id) && !SKILLS[m.id].passive) {
          const prev = p.hotbar.indexOf(m.id);
          if (prev >= 0) p.hotbar[prev] = p.hotbar[s];
          p.hotbar[s] = m.id;
        } else break;
        p.dirty = true; this.sendProf(p); break;
      }
      case 'chat': {
        if (this.T - p.lastChat < 700) break;
        const txt = String(m.m || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120);
        if (!txt) break;
        p.lastChat = this.T;
        if (txt.startsWith('/f ')) {
          if (!p.fac) { this.say(p, 'You are not in a faction.'); break; }
          const o = JSON.stringify({ t: 'chat', n: p.name, f: p.fac, m: txt.slice(3), sc: 'f' });
          for (const q of this.players.values()) if (q.fac === p.fac) this.send(q, o);
        } else this.broadcast({ t: 'chat', n: p.name, f: p.fac || 0, m: txt, sc: 'g' });
        break;
      }
      case 'fc': this.createFaction(p, m.n); break;
      case 'fj': this.joinFaction(p, m.id | 0); break;
      case 'fl': if (p.fac) this.leaveFaction(p); break;
    }
  }

  // ---------------------------------------------------------------- main loop
  tick() {
    const T = this.T = this.now(); this.tickNo++;
    this.gridBuild();
    const live = [...this.players.values()].filter((p) => !p.dead);
    for (const p of this.players.values()) this.updatePlayer(p);
    for (const n of [...this.npcs.values()]) {
      if (n.dead) continue;
      const awake = live.some((p) => Math.abs(p.x - n.x) < 1400 && Math.abs(p.y - n.y) < 1000);
      this.updateNpc(n, awake);
    }
    this.updateProjs();
    this.updateZones();
    this.updateCastles();
    if (T >= this.nextSpawnT) {
      this.nextSpawnT = T + 400;
      for (let i = 0; i < this.wildCount.length; i++) if (this.wildCount[i] < this.wildCap[i]) { this.spawnWild(i); break; }
    }
    for (const p of this.players.values()) this.send(p, this.snapshot(p));
    this.fxq = [];
    if (T >= this.nextMeta) { this.nextMeta = T + 1000; this.broadcast({ t: 'meta', ...this.metaObj() }); }
    if (this.tickNo % 600 === 0) for (const [k, v] of this.recentKills) if (v < T) this.recentKills.delete(k);
  }
}
export { regionAt };
