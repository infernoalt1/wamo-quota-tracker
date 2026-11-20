// Hanbin Island: the authoritative game simulation. It knows nothing about sockets or databases;
// the server feeds it players and messages and persists what it reports.
// Combat follows Eldyn's toolbelt model: every attack, shield, heal and maneuver is a tool with a timed
// sequence and a cooldown shared by its group. Tier gives choice (keys), never health or damage.
import {
  WORLD, VILLAGE, REGIONS, CASTLES, CASTLE_TYPES, SANCTUARY, REGION_CELLS, RC, GW, MOBS, WILD_BY_BIOME, ELITE_AFFIXES,
  DUNGEONS, CAVES, CASTLE_LEVEL_COST, CASTLE_TAX, HOUSES,
  rankOf, tierOf, garrisonFor, inCastleWalls, moveBody, freeAt, shotBlocked, losClear, dungeonAt, regionAt, propsIn,
  CAP_BASE, CAP_LIFT, TERR_BONUS, TERR_MAX, NPC_REWARD, CAPTURE_VALOR, valorGain, somaGain, RANK, rankHp, COMMAND_RANK, TROOP_NAMES,
  PUBLIC_FACTIONS, PRIVATE_MAX,
} from './shared.mjs';
import {
  TOOLS, SLOTS, START_KIT, START_BELT, TURN_RATE, ATK_CAP, DEF_CAP, SPD_CAP, ALLY_SHIELD_CAP, AURA_GAP, RESPEC_COST, MAX_TRAPS, MAX_TROOPS,
  owns, unlockCheck, sanitizeUnlocks, keysFor, BACKPEDAL, BACKPEDAL_ANGLE,
} from './builds.mjs';

const { W } = WORLD;
export const TICK = 50, DT = TICK / 1000;
export const CAPTURE_TIME = 3; // seconds of exclusive presence inside the walls
export const DYING_MS = 5000, QUICK_TRAVEL_MS = 20000, RALLY_TROOPS_MS = 10000, HIRE_MS = 3000, FORFEIT_MS = 10000;
const VIEW_W = 1100, VIEW_H = 700;
const FAC_COLORS = ['#9b59b6', '#e67e22', '#1abc9c', '#ff6fae', '#c8d6e5', '#8e44ad', '#16a085', '#d35400', '#2ecc71', '#7f8c8d'];
const ORDERS = new Set(['follow', 'kill', 'scatter', 'hold', 'heal', 'obey', 'fend']);

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = (a, b) => a + Math.random() * (b - a);
const rd = Math.round;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angDiff = (a, b) => Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
const turnToward = (a, b, max) => { const d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; return a + clamp(d, -max, max); };
const inSafe = (e) => Math.hypot(e.x - VILLAGE.x, e.y - VILLAGE.y) < VILLAGE.r;
function pickWeighted(tbl) {
  let tot = 0; for (const [, w] of tbl) tot += w;
  let r = Math.random() * tot;
  for (const [k, w] of tbl) if ((r -= w) <= 0) return k;
  return tbl[0][0];
}
export const factionNameOk = (n) => /^[\p{L}\p{N} _\-']{3,30}$/u.test(n);
const code6 = () => Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 4);

// ---------------------------------------------------------------- seasons
// Season 3 brought the toolbelt rework and everyone starts fresh. Earlier players keep the ★ Veteran
// badge and their old record under `legacy`.
export const SEASON = 3;
export function migrateProgress(pr) {
  if (pr.season === SEASON) return { progress: pr, note: null };
  const oldSoma = Math.max(0, pr.soma | 0), played = oldSoma > 0 || !!pr.vet;
  const progress = { season: SEASON, soma: 0, bank: 0 };
  if (!played) return { progress, note: null };
  progress.vet = 1;
  progress.legacy = { season: pr.season || 1, soma: oldSoma };
  return { progress, note: `Season ${SEASON} has begun: combat now works like Eldyn, with tools in a 7-slot toolbelt. Everyone starts fresh. As a veteran you keep the ★ badge, and your old record (${oldSoma} soma) is saved.` };
}

export class Game {
  constructor({ world = {}, now = () => Date.now() } = {}) {
    this.now = now; this.T = now(); this.tickNo = 0; this.idc = 0;
    this.players = new Map(); this.npcs = new Map(); this.loot = new Map();
    this.projs = []; this.zones = []; this.fxq = []; this.timers = []; this.recentKills = new Map();
    const fresh = world.season !== SEASON;
    this.factions = {}; this.nextFac = fresh ? 10 : Math.max(10, world.nextFac || 10);
    if (!fresh) for (const [id, f] of Object.entries(world.factions || {})) this.factions[id] = { ...f, members: [...(f.members || [])] };
    for (const pf of PUBLIC_FACTIONS) if (!this.factions[pf.id]) this.factions[pf.id] = { ...pf, pub: true, members: [] };
    this.worldDirty = fresh;
    this.castles = CASTLES.map((c) => {
      const saved = !fresh && world.castles && world.castles[c.id];
      const ownerId = typeof saved === 'object' && saved ? saved.o : saved;
      const owner = ownerId && this.factions[ownerId] ? +ownerId : 0;
      const level = owner && typeof saved === 'object' ? clamp(saved.l | 0, 1, 3) : 1;
      const biome = REGIONS[c.id].biome, kinds = garrisonFor(c.type, c.danger, level, biome);
      return { ...c, biome, owner, level, slots: kinds.map(() => null), slotAt: kinds.map(() => 0), prog: { fac: '', t: 0 }, calm: 99, others: 0 };
    });
    this.facStats = {}; this.refreshFactionStats();
    this.wildCount = REGIONS.map(() => 0);
    this.wildCap = REGIONS.map((r) => (r.id === SANCTUARY || r.dungeon !== undefined ? 0 : clamp(Math.round((REGION_CELLS[r.id].length * RC * RC) / 400000), 8, 30)));
    for (const c of this.castles) this.spawnGarrison(c);
    for (const r of REGIONS) for (let k = 0; k < this.wildCap[r.id]; k++) this.spawnWild(r.id, true);
    this.dungeons = DUNGEONS.map((d) => ({ d, packs: [], boss: null, bossAt: 0 }));
    for (const ds of this.dungeons) this.populateDungeon(ds);
    this.logSpots = []; this.placeLogs();
    this.grid = new Map(); this.nextMeta = 0; this.nextSpawnT = 0; this.nextTax = this.T + 60000; this.nextDungeonCheck = 0;
  }
  nid() { return ++this.idc; }
  getEnt(id) { return this.players.get(id) || this.npcs.get(id); }
  fx(o) { this.fxq.push(o); }
  later(e, ms, fn) { this.timers.push({ at: this.T + ms, e, fn }); }
  say(p, m) { if (p && p.isPlayer) this.send(p, { t: 'err', m }); }
  send(p, obj) { if (p.out) p.out(typeof obj === 'string' ? obj : JSON.stringify(obj)); }
  broadcast(obj) { const s = JSON.stringify(obj); for (const p of this.players.values()) this.send(p, s); }

  // ---------------------------------------------------------------- teams
  teamOf(e) {
    if (e.isStub) return e.team;
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
  // The live entity behind a hit (the thrower of a projectile, the caster of a dot).
  actorOf(src) { return src.isStub ? this.getEnt(src.from) : src; }
  isObj(e) { return !!(e.def && e.def.obj); }

  // ---------------------------------------------------------------- effects
  // An effect is a timed modifier: atk, ratk (ranged attack), def, spd (percent), leech, root, invis, cd (cooldown slow).
  // Effects with the same tag replace each other instead of stacking.
  addEff(e, eff, dur) {
    if (!e.effs || e.dead) return;
    const o = { ...eff, until: this.T + dur };
    if (o.tag) { const i = e.effs.findIndex((x) => x.tag === o.tag); if (i >= 0) { e.effs[i] = o; return o; } }
    e.effs.push(o);
    return o;
  }
  sumEff(e, k) { let s = 0; if (e.effs) for (const f of e.effs) if (f.until > this.T && f[k]) s += f[k]; return s; }
  atkOf(e, ranged) {
    if (!e || !e.effs) return 0;
    let a = (e.atkBase || 0) + this.sumEff(e, 'atk') + (ranged ? this.sumEff(e, 'ratk') : 0);
    if (e.elite === 'frenzied' && e.hp < e.maxhp * 0.5) a += 50;
    return clamp(a, ATK_CAP[0], ATK_CAP[1]);
  }
  defOf(e) {
    if (!e.effs) return 0;
    let d = e.defBase || 0, ally = 0;
    for (const f of e.effs) if (f.until > this.T && f.def) { if (f.ally) ally += f.def; else d += f.def; }
    return clamp(d + Math.min(ALLY_SHIELD_CAP, ally), DEF_CAP[0], DEF_CAP[1]);
  }
  rooted(e) { return e.effs ? e.effs.some((f) => f.until > this.T && f.root) : false; }
  invisOf(e) { let v = 0; if (e.effs) for (const f of e.effs) if (f.until > this.T && f.invis > v) v = f.invis; return v; }
  speedOf(e) {
    if (this.rooted(e)) return 0;
    const base = e.isPlayer ? 190 : e.def.spd * (e.elite === 'swift' ? 1.4 : 1) * (e.enraged ? 1.25 : 1);
    let m = 1 + this.sumEff(e, 'spd') / 100;
    if (e.def && e.def.boss) m = 1 - (1 - m) * 0.5;
    return base * clamp(m, SPD_CAP[0], SPD_CAP[1]);
  }
  root(e, ms) { if (!this.isObj(e)) this.addEff(e, { root: 1 }, e.def && e.def.boss ? ms * 0.35 : ms); }
  // Push (or pull, toward a point) a body. Objects can't be moved; bosses barely move.
  push(e, ang, d) {
    if (e.dead || e.hp <= 0 || d <= 0 || this.isObj(e)) return;
    if (e.def && e.def.boss) d *= 0.25;
    [e.x, e.y] = moveBody(e.x, e.y, e.r, Math.cos(ang) * d, Math.sin(ang) * d);
    if (e.isPlayer) e.tp++;
  }
  pullTo(e, x, y, d) {
    const left = Math.hypot(x - e.x, y - e.y) - e.r - 6;
    if (left > 1) this.push(e, Math.atan2(y - e.y, x - e.x), Math.min(d, left));
  }
  heal(e, amt) {
    if (!e || e.dead || e.hp <= 0 || amt <= 0 || this.isObj(e)) return;
    const before = e.hp; e.hp = Math.min(e.maxhp, e.hp + amt);
    if (e.hp - before >= 0.5) this.fx({ t: 'heal', x: e.x, y: e.y - 14, v: Math.round((e.hp - before) * 10) / 10 });
  }
  addHot(e, rate, dur) { if (e.hots && !e.dead && !this.isObj(e)) e.hots.push({ rate, until: this.T + dur }); }
  addDot(e, dps, dur, stub, leech = 0) { if (e.dots && !e.dead) e.dots.push({ dps, until: this.T + dur, next: this.T + 500, stub, leech }); }
  tickStatus(e) {
    const T = this.T;
    if (e.hots && e.hots.length) { let h = 0; e.hots = e.hots.filter((x) => { if (x.until <= T) return false; h += x.rate * DT; return true; }); if (h) e.hp = Math.min(e.maxhp, e.hp + h); }
    if (e.dots && e.dots.length) {
      for (const d of e.dots) if (T >= d.next && d.until > T - 1) { d.next += 500; this.dealDamage(d.stub, e, d.dps * 0.5, { secondary: true, dot: true, leech: d.leech, atk: 0 }); if (e.dead) return; }
      e.dots = e.dots.filter((d) => d.until > T);
    }
    if (this.tickNo % 10 === 0 && e.effs && e.effs.length) e.effs = e.effs.filter((f) => f.until > T);
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
    const x0 = Math.max(0, Math.floor((x - r - 40) / C)), x1 = Math.floor((x + r + 40) / C);
    const y0 = Math.max(0, Math.floor((y - r - 40) / C)), y1 = Math.floor((y + r + 40) / C);
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
  // Foes that a tool can hurt (objects such as traps and log piles included) / living foes only.
  foesNear(src, x, y, r) { return this.near(x, y, r).filter((e) => this.hostile(src, e) && !inSafe(e)); }
  livingFoesNear(src, x, y, r) { return this.foesNear(src, x, y, r).filter((e) => !this.isObj(e)); }
  alliesNear(src, x, y, r) { const t = this.teamOf(src); return this.near(x, y, r).filter((e) => this.teamOf(e) === t && !this.isObj(e)); }

  // ---------------------------------------------------------------- damage
  // damage = base × (1 + attack/100) × (1 − defence/100), with both capped. HP is not rounded.
  // o: melee, ranged, secondary (splash and dots: no parry), dot, leech (share of damage healed to the attacker), atk (override)
  dealDamage(src, tgt, base, o = {}) {
    const T = this.T;
    if (!src || tgt.dead || tgt.hp <= 0 || base <= 0) return 0;
    if (inSafe(tgt) || (!src.isStub && inSafe(src))) return 0;
    if (!this.hostile(src, tgt)) return 0;
    const actor = this.actorOf(src);
    if (o.melee && !o.secondary && T < (tgt.parryUntil || 0)) {
      tgt.parryUntil = 0; tgt.lastHurtAt = T; tgt.lastHurtBy = actor ? actor.id : null;
      const t = TOOLS.parry;
      this.addEff(tgt, { atk: t.buff.atk, tag: 'parry' }, t.buff.dur);
      if (actor && !this.isObj(actor)) this.addEff(actor, { atk: t.foe.atk, spd: t.foe.spd, tag: 'parried' }, t.foe.dur);
      this.fx({ t: 'parry', x: tgt.x, y: tgt.y });
      return 0;
    }
    const A = o.atk ?? this.atkOf(actor, o.ranged), D = this.defOf(tgt);
    let amt = base * (1 + A / 100) * (1 - D / 100);
    if (tgt.channel && tgt.channel.vuln) amt *= 4;
    if (amt <= 0) return 0;
    if (D >= DEF_CAP[1] && T > (tgt.blockedAt || 0)) { tgt.blockedAt = T + 600; this.combo(tgt, 'BLOCKED'); }
    tgt.hp -= amt;
    const root = this.rootOwner(src);
    tgt.lastHit = root; tgt.lastHitAt = T; tgt.combatAt = T;
    if (!o.dot) { tgt.lastHurtAt = T; tgt.lastHurtBy = actor ? actor.id : null; }
    if (actor) actor.combatAt = T;
    if (root && tgt.hitters) tgt.hitters.set(root.id, T);
    this.fx({ t: 'dmg', x: tgt.x, y: tgt.y - 10, v: amt < 10 ? Math.round(amt * 10) / 10 : Math.round(amt) });
    if (tgt.effs && tgt.effs.some((f) => f.breakHit)) this.breakStealth(tgt, 'hit');
    if (o.leech && actor && !actor.dead) this.heal(actor, amt * o.leech * (1 + this.sumEff(actor, 'leech') / 100));
    if (actor && actor.isNpc && !o.secondary) {
      if (actor.def.onHit === 'drain' || actor.elite === 'vampiric') actor.hp = Math.min(actor.maxhp, actor.hp + amt * 0.35);
      if (actor.def.onHit === 'poison') this.addDot(tgt, actor.def.dmg * 0.3, 3000, this.mkStub(actor));
      if (actor.def.onHit === 'slow') this.addEff(tgt, { spd: -40, tag: 'chill' }, 1500);
    }
    if (tgt.isNpc && !this.isObj(tgt) && actor && !tgt.obey) {
      if (!tgt.target) tgt.target = actor.id;
      if (tgt.def.social) for (const f of this.near(tgt.x, tgt.y, 300)) if (f.kind === tgt.kind && f.team === tgt.team && !f.target) f.target = actor.id;
    }
    if (tgt.hp <= 0) (tgt.isPlayer ? this.killPlayer(tgt, T - tgt.lastHitAt < 8000 ? tgt.lastHit : null) : this.killNpc(tgt, tgt.lastHit));
    return amt;
  }
  combo(e, txt) {
    if (this.T < (e.comboAt || 0)) return;
    e.comboAt = this.T + 350;
    this.fx({ t: 'combo', x: e.x, y: e.y - 34, txt });
  }

  // ---------------------------------------------------------------- territory, valor and soma
  refreshFactionStats() {
    const st = {};
    for (const c of this.castles) if (c.owner) {
      const s = st[c.owner] ||= { cap: CAP_BASE, t: 0, n: 0 };
      s.cap += CAP_LIFT[c.type]; s.t += TERR_BONUS[c.type]; s.n++;
    }
    for (const s of Object.values(st)) s.t = Math.min(TERR_MAX, s.t);
    this.facStats = st;
  }
  capOf(p) { return (p.fac && this.facStats[p.fac]) ? this.facStats[p.fac].cap : CAP_BASE; }
  terrOf(p) { return (p.fac && this.facStats[p.fac]) ? this.facStats[p.fac].t : 0; }
  gain(p, v, s, g = 0) {
    if (!p || !p.isPlayer || p.gone) return;
    const oldTier = p.tier, oldRank = p.rank;
    if (v > 0) p.valor = Math.max(p.valor, Math.min(this.capOf(p), p.valor + v));
    p.soma += s; p.gold += g; p.dirty = true;
    if (v >= 0.5 || s >= 0.5 || g) this.send(p, { t: 'gain', v: Math.round(v), s: Math.round(s), g });
    const nt = tierOf(p.soma);
    if (nt !== p.tier) {
      p.tier = nt;
      if (nt > oldTier) this.send(p, { t: 'toast', m: `Soma tier ${nt}! +1 key: unlock a tool (K).` });
      this.sendProf(p);
    }
    const nr = rankOf(p.valor).idx;
    if (nr !== oldRank) {
      this.recalc(p); this.sendProf(p);
      if (nr > oldRank) {
        this.send(p, { t: 'toast', m: `You are now a ${rankOf(p.valor).name}!` });
        if (nr === RANK.king) this.broadcast({ t: 'msg', m: `👑 ${p.name} has been crowned King!`, c: '#f0c840' });
        else if (nr >= RANK.travel) this.broadcast({ t: 'msg', m: `${p.name} has risen to the rank of ${rankOf(p.valor).name}.`, c: '#e0b84f' });
      }
    }
  }
  // Rewards for a kill, from the killer's Valor, the victim's Valor, NPC or player, and territory.
  reward(killer, victimValor, m, victim) {
    if (!killer || killer.dead) return;
    const own = killer.valor, t = this.terrOf(killer);
    const v = valorGain(own, victimValor, m, t), s = somaGain(own, victimValor, m, t);
    this.gain(killer, v, s);
    if (victim && victim.hitters) for (const [id, at] of victim.hitters) {
      const o = this.players.get(id);
      if (!o || o === killer || o.dead || o.fac !== killer.fac || !killer.fac || this.T - at > 10000 || dist(o, victim) > 600) continue;
      this.gain(o, own * 0.005, s / 2);
    }
  }
  dropLoot(x, y, o) {
    if (!o.gold && !o.wood) return;
    const id = this.nid();
    this.loot.set(id, { id, x: x + rnd(-14, 14), y: y + rnd(-14, 14), gold: o.gold || 0, wood: o.wood || 0, until: this.T + 180000 });
  }
  killNpc(n, killer, silent) {
    if (n.dead) return;
    n.dead = true; this.npcs.delete(n.id);
    if (n.castle >= 0) { const c = this.castles.find((k) => k.id === n.castle); if (c && c.slots[n.slot] === n.id) { c.slots[n.slot] = null; c.slotAt[n.slot] = this.T + rnd(40000, 80000); } }
    if (n.region >= 0) this.wildCount[n.region]--;
    if (n.master) { const m = this.npcs.get(n.master); if (m && m.minions) m.minions.delete(n.id); }
    if (n.kind === 'logs') { this.logRespawn(n.spot); if (killer && !silent) { killer.wood += 2; killer.dirty = true; this.send(killer, { t: 'gain', v: 0, s: 0, g: 0, w: 2 }); } }
    this.fx({ t: 'poof', x: n.x, y: n.y });
    if (n.elite === 'volatile') this.zones.push({ type: 'blast', x: n.x, y: n.y, r: 120, at: this.T + 900, d: 900, dmg: n.def.dmg * 2, team: n.team, stub: this.mkStub(n) });
    if (silent || !killer || this.isObj(n) || n.minionOf || n.owner === killer.id) return;
    const valor = (n.valor || 0) * (n.elite ? 3 : 1);
    this.reward(killer, valor, NPC_REWARD, n);
    const g = Math.round((n.def.gold || 0) * (n.def.boss ? 1 : rnd(0.5, 1.5)));
    if (g) this.dropLoot(n.x, n.y, { gold: g });
    if (n.def.boss) this.broadcast({ t: 'msg', m: `⚔ ${killer.name} has slain ${n.def.name}!`, c: '#ffb030' });
  }
  killPlayer(p, killer) {
    if (p.dead) return;
    const T = this.T;
    p.dead = true; p.respawnAt = T + DYING_MS; p.channel = null; p.dots = []; p.hots = []; p.effs = []; p.held.clear(); p.queued = -1;
    const lost = Math.floor(p.valor), wasRank = p.rank;
    const dg = Math.floor(p.gold / 2), dw = Math.floor(p.wood / 2);
    p.gold -= dg; p.wood -= dw; this.dropLoot(p.x, p.y, { gold: dg, wood: dw });
    p.valor = 0; p.dirty = true;
    this.recalc(p); this.sendProf(p);
    for (const n of this.npcs.values()) if (n.owner === p.id && !this.isObj(n)) { n.order = 'hold'; n.anchor = { x: n.x, y: n.y }; }
    const by = killer && killer !== p ? killer : null;
    this.send(p, { t: 'died', lost, gold: dg, wood: dw, by: by ? by.name : null });
    if (wasRank === RANK.king) this.broadcast({ t: 'msg', m: `👑 King ${p.name} has fallen${by ? ' to ' + by.name : ''}!`, c: '#f0c840' });
    else if (wasRank >= RANK.radar) this.broadcast({ t: 'msg', m: `${rankOf(lost).name} ${p.name} has fallen${by ? ' to ' + by.name : ''}.`, c: '#c06060' });
    // Pillagers grow into bigger prizes with every player they kill.
    const actor = this.getEnt(p.lastHurtBy);
    if (actor && actor.isNpc && actor.def.roam) actor.valor += valorGain(actor.valor, lost, 1);
    if (by && this.teamOf(by) !== this.teamOf(p)) {
      const key = by.accountId + ':' + p.accountId;
      if ((this.recentKills.get(key) || 0) < T) { this.recentKills.set(key, T + 600000); this.reward(by, lost, 1, p); }
      if (wasRank < RANK.radar) this.broadcast({ t: 'msg', m: `${by.name} slew ${p.name}.`, c: '#c06060' });
    }
    if (p.gone) this.removePlayer(p);
  }
  // After dying you choose where to come back: Hanbin Haven or any fort your faction holds.
  respawnSpots(p) { return this.castles.filter((c) => c.type === 'fort' && p.fac && c.owner === p.fac).map((c) => c.id); }
  respawn(p, at) {
    if (!p.dead || this.T < p.respawnAt) return;
    let pos = null;
    if (at !== 'haven' && at != null) { const c = this.castles.find((k) => k.id === +at); if (c && this.respawnSpots(p).includes(c.id)) pos = this.freeSpot(c.x, c.y, 100); }
    pos = pos || this.villageSpot();
    p.dead = false; p.hp = p.maxhp; p.gcd = {}; p.combatAt = 0;
    p.x = pos.x; p.y = pos.y; p.tp++;
  }
  villageSpot() { return this.freeSpot(VILLAGE.x, VILLAGE.y, VILLAGE.r * 0.55, 60); }
  freeSpot(x, y, spread, minD = 0) {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * 6.283, d = rnd(minD, spread), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      if (freeAt(px, py, 16)) return { x: px, y: py };
    }
    return freeAt(x, y, 16) ? { x, y } : { x: VILLAGE.x, y: VILLAGE.y + 60 };
  }
  removeOwned(pid, objectsToo = true) { for (const n of [...this.npcs.values()]) if (n.owner === pid && (objectsToo || !this.isObj(n))) this.killNpc(n, null, true); }

  // ---------------------------------------------------------------- channels: quick travel, rally, hiring
  // You stand still for the whole channel (moving cancels it). Quick travel makes you take 4× damage.
  startChannel(p, dest, label, ms, vuln) {
    if (p.dead) return;
    p.channel = { until: this.T + ms, total: ms, dest, label, x: p.x, y: p.y, vuln: !!vuln };
    this.send(p, { t: 'toast', m: `${label}... stand still` });
  }
  cancelChannel(p, why) { if (!p.channel) return; p.channel = null; this.send(p, { t: 'toast', m: why }); }
  finishChannel(p) {
    const ch = p.channel; p.channel = null;
    const d = ch.dest;
    if (d.kind === 'haven') { const s = this.villageSpot(); this.teleport(p, s.x, s.y); }
    else if (d.kind === 'castle') {
      const c = this.castles.find((k) => k.id === d.id);
      if (!c || !p.fac || c.owner !== p.fac) return this.say(p, 'Your faction no longer holds that castle.');
      const s = this.freeSpot(c.x, c.y, 100); this.teleport(p, s.x, s.y);
    } else if (d.kind === 'player') {
      const o = this.players.get(d.id);
      if (!o || o.dead || o.fac !== p.fac) return this.say(p, 'They are no longer there.');
      const s = this.freeSpot(o.x, o.y, 80, 30); this.teleport(p, s.x, s.y);
    } else if (d.kind === 'troops') {
      for (const n of this.npcs.values()) if (n.owner === p.id && !this.isObj(n)) { const s = this.freeSpot(p.x, p.y, 90, 30); n.x = s.x; n.y = s.y; n.order = 'follow'; n.leader = p.id; }
      this.fx({ t: 'ring', x: p.x, y: p.y, r: 90, c: '#e0b84f' });
    } else if (d.kind === 'hire') this.hire(p, d.tool);
  }
  teleport(p, x, y) {
    this.fx({ t: 'poof', x: p.x, y: p.y, c: '#6040a0' });
    p.x = x; p.y = y; p.tp++;
    this.fx({ t: 'ring', x, y, r: 60, c: '#c8a0ff', fill: 1 });
  }

  // ---------------------------------------------------------------- players
  recalc(p) {
    p.rank = rankOf(p.valor).idx;
    const mh = rankHp(p.rank);
    if (p.maxhp && mh > p.maxhp) p.hp += mh - p.maxhp;
    p.maxhp = mh; p.hp = Math.min(p.hp, p.maxhp);
    p.keys = keysFor(p.tier, p.unlocked);
  }
  sendProf(p) {
    this.recalc(p);
    const f = this.factions[p.fac];
    this.send(p, {
      t: 'prof', unlocked: p.unlocked, belt: p.belt, keys: p.keys, tier: p.tier, fac: p.fac || 0, name: p.name, rank: p.rank, maxhp: p.maxhp, vet: p.vet,
      code: f && !f.pub ? f.code : null, spots: this.respawnSpots(p),
    });
  }

  // account = { id, username, progress }, out = function(string)
  join(account, out) {
    for (const o of this.players.values()) if (o.accountId === account.id) { this.send(o, { t: 'kicked', m: 'You signed in somewhere else.' }); if (o.onKick) o.onKick(); this.removePlayer(o); }
    const { progress: pr, note } = migrateProgress(account.progress || {});
    const pos = this.villageSpot();
    const p = {
      id: this.nid(), isPlayer: true, kind: 'player', accountId: account.id, name: account.username, out,
      x: pos.x, y: pos.y, r: 14, ang: 0, aim: 0, tp: 0, moveBudget: 0, channel: null,
      valor: 0, soma: Math.max(0, +pr.soma || 0), fac: 0, gold: Math.max(0, pr.gold | 0), bank: Math.max(0, pr.bank | 0), wood: Math.max(0, pr.wood | 0),
      tier: 0, rank: 0, maxhp: 80, hp: 80, dead: false, respawnAt: 0, unlocked: [], belt: [], keys: 0,
      effs: [], hots: [], dots: [], gcd: {}, held: new Set(), queued: -1, hitters: new Map(),
      lastMoveAt: 0, combatAt: 0, lastHurtAt: 0, lastHurtBy: null, lastHit: null, lastHitAt: 0, lastChat: 0, wp: 'spear',
      dirty: !!note, vet: pr.vet ? 1 : 0, legacy: pr.legacy, cmdAt: 0,
    };
    p.tier = tierOf(p.soma);
    p.unlocked = sanitizeUnlocks(pr.unlocked, p.tier);
    p.belt = this.cleanBelt(p, pr.belt);
    p.wp = p.belt.find((id) => id && TOOLS[id].group === 'weapon') || 'spear';
    const want = pr.fac && this.factions[pr.fac] && this.factions[pr.fac].members.includes(account.id) ? +pr.fac : 0;
    if (want) p.fac = want; else this.assignPublic(p, true);
    this.recalc(p); p.hp = p.maxhp;
    this.players.set(p.id, p);
    this.send(p, { t: 'welcome', id: p.id });
    this.sendProf(p);
    this.send(p, { t: 'meta', ...this.metaObj() });
    this.send(p, { t: 'msg', m: `Welcome to Hanbin Island! You fight with the 7 tools in your toolbelt: left click, Space, Shift, V, right click, middle click and Q. K unlocks tools, H explains everything.`, c: '#e0b84f' });
    if (note) { this.send(p, { t: 'msg', m: note, c: '#ffd070' }); this.send(p, { t: 'toast', m: `Season ${SEASON} has begun!` }); }
    return p;
  }
  cleanBelt(p, belt) {
    const out = [], seen = new Set();
    const src = Array.isArray(belt) && belt.length ? belt : START_BELT;
    for (let i = 0; i < SLOTS; i++) { const id = src[i]; if (id && TOOLS[id] && owns(p.unlocked, id) && !seen.has(id)) { out.push(id); seen.add(id); } else out.push(null); }
    return out;
  }
  // Combat logging: if an enemy player hit you in the last 10s, your character stays for 10s so they can still win.
  leave(p) {
    if (!this.players.has(p.id) || p.gone) return;
    const by = p.lastHit && p.lastHit.isPlayer && this.players.has(p.lastHit.id) ? p.lastHit : null;
    if (!p.dead && by && this.T - p.lastHitAt < FORFEIT_MS && !inSafe(p)) {
      p.gone = true; p.out = null; p.ghostUntil = this.T + FORFEIT_MS; p.held.clear(); p.channel = null;
      return;
    }
    this.removePlayer(p);
  }
  removePlayer(p) {
    if (!this.players.has(p.id)) return;
    this.removeOwned(p.id);
    this.players.delete(p.id);
  }
  progressOf(p) {
    const f = this.factions[p.fac];
    return { season: SEASON, soma: Math.floor(p.soma), unlocked: p.unlocked, belt: p.belt, fac: f && !f.pub ? p.fac : 0, gold: p.gold, bank: p.bank, wood: p.wood, vet: p.vet, legacy: p.legacy };
  }
  worldState() {
    const castles = {};
    for (const c of this.castles) if (c.owner) castles[c.id] = { o: c.owner, l: c.level };
    return { season: SEASON, factions: this.factions, castles, nextFac: this.nextFac };
  }
  // Equipping only works in Hanbin Haven or inside a castle your faction holds.
  canManage(p) { return inSafe(p) || (p.fac && this.castles.some((c) => c.owner === p.fac && inCastleWalls(c, p.x, p.y))); }

  // ---------------------------------------------------------------- factions
  // Everyone belongs to a faction: one of the three public ones (the smallest, ties at random) or a
  // private faction of up to 10, joined with its share code.
  assignPublic(p, quiet) {
    const pubs = PUBLIC_FACTIONS.map((x) => this.factions[x.id]);
    const online = (f) => [...this.players.values()].filter((o) => o.fac === f.id).length;
    const min = Math.min(...pubs.map(online)), pick = pubs.filter((f) => online(f) === min);
    const f = pick[Math.floor(Math.random() * pick.length)];
    this.setFaction(p, f.id, quiet);
  }
  setFaction(p, id, quiet) {
    const old = this.factions[p.fac];
    if (old) { old.members = old.members.filter((a) => a !== p.accountId); if (!old.pub && !old.members.length) this.disbandFaction(old.id); }
    const f = this.factions[id];
    if (!f.members.includes(p.accountId)) f.members.push(p.accountId);
    p.fac = +id; p.dirty = true; this.worldDirty = true;
    for (const n of this.npcs.values()) if (n.owner === p.id) n.target = null;
    if (!quiet) { this.sendProf(p); this.broadcast({ t: 'meta', ...this.metaObj() }); for (const o of this.players.values()) if (o.fac === f.id && o !== p) this.send(o, { t: 'msg', m: `${p.name} joined ${f.name}.`, c: f.color }); }
  }
  createFaction(p, name) {
    name = String(name || '').trim().replace(/\s+/g, ' ');
    if (!factionNameOk(name)) return this.say(p, "Faction names are 3-30 letters, numbers, spaces, - or '.");
    if (Object.keys(this.factions).length >= 300) return this.say(p, 'Too many factions exist.');
    if (Object.values(this.factions).some((f) => f.name.toLowerCase() === name.toLowerCase())) return this.say(p, 'That faction name is taken.');
    const id = this.nextFac++;
    const used = new Set(Object.values(this.factions).map((f) => f.color));
    const color = FAC_COLORS.find((c) => !used.has(c)) || FAC_COLORS[id % FAC_COLORS.length];
    this.factions[id] = { id, name, color, pub: false, code: code6(), members: [], renamedAt: 0 };
    this.setFaction(p, id);
    this.send(p, { t: 'msg', m: `You founded ${name}. Share its code ${this.factions[id].code} (or the link in the Factions panel) to bring up to 9 friends.`, c: color });
  }
  joinByCode(p, code) {
    const f = Object.values(this.factions).find((x) => !x.pub && x.code === String(code || '').trim());
    if (!f) return this.say(p, 'No private faction has that code.');
    if (f.id === p.fac) return;
    if (f.members.length >= PRIVATE_MAX) return this.say(p, `${f.name} is full (${PRIVATE_MAX} players).`);
    this.setFaction(p, f.id);
  }
  leaveFaction(p) {
    const f = this.factions[p.fac];
    if (!f || f.pub) return this.say(p, 'You are in a public faction. Found a private one or join one with a code to change.');
    this.send(p, { t: 'msg', m: `You left ${f.name}.`, c: '#aaa' });
    this.assignPublic(p);
  }
  disbandFaction(id) {
    const f = this.factions[id];
    if (!f || f.pub) return;
    for (const c of this.castles) if (c.owner === +id) this.loseCastle(c);
    delete this.factions[id];
    this.refreshFactionStats(); this.worldDirty = true;
    this.broadcast({ t: 'msg', m: `The faction ${f.name} has fallen.`, c: '#888' });
  }
  renameFaction(p, name) {
    const f = this.factions[p.fac];
    if (!f) return;
    if (p.rank < RANK.rename) return this.say(p, 'Renaming your faction needs the rank of Jarl.');
    if (this.T - (f.renamedAt || 0) < 900000) return this.say(p, 'Your faction was renamed less than 15 minutes ago.');
    name = String(name || '').trim().replace(/\s+/g, ' ');
    if (!factionNameOk(name)) return this.say(p, "Faction names are 3-30 letters, numbers, spaces, - or '.");
    if (Object.values(this.factions).some((x) => x !== f && x.name.toLowerCase() === name.toLowerCase())) return this.say(p, 'That faction name is taken.');
    const old = f.name; f.name = name; f.renamedAt = this.T; this.worldDirty = true;
    this.broadcast({ t: 'msg', m: `${p.name} renamed ${old} to ${name}.`, c: f.color });
    this.broadcast({ t: 'meta', ...this.metaObj() });
  }
  recolourFaction(p, color) {
    const f = this.factions[p.fac];
    if (!f) return;
    if (p.rank < RANK.colour) return this.say(p, "Setting your faction's colours needs the rank of Theyn.");
    if (!/^#[0-9a-f]{6}$/i.test(color || '')) return;
    f.color = color.toLowerCase(); this.worldDirty = true;
    this.broadcast({ t: 'meta', ...this.metaObj() });
  }
  fortify(p, id) {
    const c = this.castles.find((k) => k.id === (id | 0));
    if (!c || !p.fac || c.owner !== p.fac) return this.say(p, 'Your faction does not hold that castle.');
    if (c.level >= 3) return this.say(p, 'That castle is already fully fortified.');
    const cost = CASTLE_LEVEL_COST[c.level + 1];
    if (p.bank < cost) return this.say(p, `Fortifying costs ${cost} banked gold.`);
    p.bank -= cost; p.dirty = true; c.level++;
    const kinds = garrisonFor(c.type, c.danger, c.level, c.biome);
    c.slots = kinds.map((k, i) => c.slots[i] ?? null); c.slotAt = kinds.map((k, i) => c.slotAt[i] ?? 0);
    this.spawnGarrison(c); this.worldDirty = true;
    this.broadcast({ t: 'msg', m: `${p.name} fortified ${c.name} to level ${c.level}.`, c: this.factions[p.fac].color });
    this.broadcast({ t: 'meta', ...this.metaObj() });
  }

  // ---------------------------------------------------------------- NPCs
  mkNpc(kind, x, y, o = {}) {
    const def = MOBS[kind], sc = o.sc || 1, danger = o.danger || 1;
    const kit = def.kits ? def.kits[Math.floor(Math.random() * def.kits.length)] : def.kit;
    const n = {
      id: this.nid(), isNpc: true, kind, def, x, y, ang: Math.random() * 6.28, hp: def.hp * sc, maxhp: def.hp * sc, r: def.r, sc,
      team: o.team || (def.obj && !o.owner ? kind : 'wild'), home: { x, y }, anchor: { x, y }, leash: o.leash || 550, owner: o.owner || null, ttl: o.ttl || (def.ttl ? this.T + def.ttl : 0), danger,
      castle: o.castle ?? -1, slot: o.slot ?? -1, region: o.region ?? -1, fac: o.fac || 0, master: o.master || 0, minionOf: o.minionOf || 0,
      kit: kit ? kit.slice() : null, valor: def.valor || 0, atkBase: def.obj ? 0 : def.ai === 'kit' ? -25 + 10 * (danger - 1) : 10 * (danger - 1), defBase: def.armor || 0,
      effs: [], hots: [], dots: [], gcd: {}, hitters: new Map(),
      target: null, nextAtk: 0, nextScan: 0, nextSkill: 0, nextThink: 0, wanderT: 0, wp: kit ? kit[0] : null, returning: false, lastHit: null, lastHitAt: 0, detour: 0, detourUntil: 0,
      order: o.order || 'home', leader: o.leader || 0, aggr: o.aggr ?? true, obey: false, cmdBy: 0, leaderSeen: this.T, uses: 0, spot: o.spot ?? -1,
    };
    if (o.elite) { n.elite = o.elite; n.hp = n.maxhp = n.maxhp * 2.5; n.r = Math.round(n.r * 1.15); if (o.elite === 'armored') n.defBase += 40; }
    if (def.trap && kind !== 'tripwire') n.inv = 0.4;
    if (def.trap && def.trap.uses) n.uses = def.trap.uses;
    this.npcs.set(n.id, n);
    return n;
  }
  eliteRoll(danger) {
    if (Math.random() > 0.04 + danger * 0.015) return null;
    const keys = Object.keys(ELITE_AFFIXES);
    return keys[Math.floor(Math.random() * keys.length)];
  }
  npcScale(kind, danger) { return 1 + (MOBS[kind].ai === 'kit' ? 0.15 : 0.22) * (danger - 1); }
  spawnWild(ri, ignorePlayers) {
    const cells = REGION_CELLS[ri], reg = REGIONS[ri], danger = reg.danger;
    if (!cells || !cells.length || !danger) return;
    const table = WILD_BY_BIOME[reg.biome].filter(([, , min]) => min <= danger);
    for (let tries = 0; tries < 12; tries++) {
      const cell = cells[Math.floor(Math.random() * cells.length)];
      const x = (cell % GW) * RC + Math.random() * RC, y = Math.floor(cell / GW) * RC + Math.random() * RC;
      if (!freeAt(x, y, 26)) continue;
      if (this.castles.some((c) => { const o = CASTLE_TYPES[c.type].outer + 150; return Math.abs(x - c.x) < o && Math.abs(y - c.y) < o; })) continue;
      if (Math.hypot(x - VILLAGE.x, y - VILLAGE.y) < VILLAGE.r + 350) continue;
      if (CAVES.some((c) => Math.hypot(x - c.x, y - c.y) < 200)) continue;
      if (!ignorePlayers && [...this.players.values()].some((p) => Math.hypot(p.x - x, p.y - y) < 700)) continue;
      const kind = pickWeighted(table), [lo, hi] = MOBS[kind].pack || [1, 1], count = lo + Math.floor(Math.random() * (hi - lo + 1));
      const elite = count === 1 ? this.eliteRoll(danger) : null;
      for (let i = 0; i < count; i++) {
        const s = i ? this.freeSpot(x, y, 70) : { x, y };
        this.mkNpc(kind, s.x, s.y, { sc: this.npcScale(kind, danger), region: ri, leash: MOBS[kind].roam ? 1400 : 600, danger, elite });
        this.wildCount[ri]++;
      }
      return;
    }
  }
  spawnGuard(c, i) {
    const L = CASTLE_TYPES[c.type], kind = garrisonFor(c.type, c.danger, c.level, c.biome)[i];
    const span = kind === 'captain' && i === 0 ? L.inner - 30 : L.rings[0][0] - L.rings[0][1] - 34;
    let x = c.x, y = c.y + L.inner - 40;
    for (let t = 0; t < 40; t++) {
      const px = c.x + rnd(-span, span), py = c.y + rnd(-span, span);
      if (freeAt(px, py, 22)) { x = px; y = py; break; }
    }
    const sc = this.npcScale(kind, c.danger) * (1 + 0.2 * (c.level - 1));
    const n = this.mkNpc(kind, x, y, { sc, team: c.owner ? 'f:' + c.owner : 'wild', fac: c.owner || 0, castle: c.id, slot: i, leash: 420, danger: c.danger });
    if (kind === 'ranger' && c.danger >= 3) n.kit = ['flatbow'], n.wp = 'flatbow';
    c.slots[i] = n.id;
  }
  spawnGarrison(c) { for (let i = 0; i < c.slots.length; i++) if (!c.slots[i] || !this.npcs.has(c.slots[i])) this.spawnGuard(c, i); }
  clearGarrison(c) { for (let i = 0; i < c.slots.length; i++) { const n = this.npcs.get(c.slots[i]); if (n) this.killNpc(n, null, true); c.slots[i] = null; } }
  // Log piles: break them for 2 Wood; each spot refills 3 minutes later. More of them where it is dangerous.
  placeLogs() {
    for (const r of REGIONS) {
      if (r.id === SANCTUARY || r.dungeon !== undefined || !r.danger) continue;
      const cells = REGION_CELLS[r.id]; if (!cells || !cells.length) continue;
      const want = 2 + Math.floor(r.danger / 2);
      for (let k = 0, tries = 0; k < want && tries < 60; tries++) {
        const cell = cells[Math.floor(Math.random() * cells.length)];
        const x = (cell % GW) * RC + Math.random() * RC, y = Math.floor(cell / GW) * RC + Math.random() * RC;
        if (!freeAt(x, y, 26) || this.castles.some((c) => Math.abs(x - c.x) < CASTLE_TYPES[c.type].outer + 60 && Math.abs(y - c.y) < CASTLE_TYPES[c.type].outer + 60)) continue;
        const spot = this.logSpots.length;
        this.logSpots.push({ x, y, at: 0 });
        this.mkNpc('logs', x, y, { spot });
        k++;
      }
    }
  }
  logRespawn(spot) { if (spot >= 0 && this.logSpots[spot]) this.logSpots[spot].at = this.T + 180000; }
  updateLogs() {
    for (let i = 0; i < this.logSpots.length; i++) { const s = this.logSpots[i]; if (s.at && this.T >= s.at) { s.at = 0; this.mkNpc('logs', s.x, s.y, { spot: i }); } }
  }
  // Dungeons: a Dweller and creatures in every room but the first, a boss in the last. Cleared rooms refill after 3 minutes without visitors.
  populateDungeon(ds) {
    ds.d.rooms.forEach((room, k) => {
      if (k === 0 || room.boss) return;
      const pack = { room, ids: [], emptyAt: 0 };
      this.spawnPack(ds, pack);
      ds.packs.push(pack);
    });
    this.spawnBoss(ds);
  }
  spawnPack(ds, pack) {
    const d = ds.d, room = pack.room, n = 3 + Math.floor(Math.random() * 3);
    pack.ids = [];
    for (let i = 0; i < n; i++) {
      const kind = i === 0 ? 'dweller' : pickWeighted(d.mobs), s = this.freeSpot(room.x, room.y, Math.min(room.w, room.h) * 30);
      const npc = this.mkNpc(kind, s.x, s.y, { sc: this.npcScale(kind, d.danger) + 0.15, leash: 520, danger: d.danger + 1, elite: i === 1 ? this.eliteRoll(d.danger + 2) : null });
      npc.dungeon = d.id;
      pack.ids.push(npc.id);
    }
    pack.emptyAt = 0;
  }
  spawnBoss(ds) {
    const room = ds.d.rooms[ds.d.rooms.length - 1];
    const b = this.mkNpc(ds.d.boss, room.x, room.y, { leash: 700, danger: ds.d.danger + 2 });
    b.atkBase = 0; b.dungeon = ds.d.id; b.minions = new Set();
    ds.boss = b.id;
  }
  updateDungeons() {
    const T = this.T, near = (x, y, r) => [...this.players.values()].some((p) => !p.dead && Math.hypot(p.x - x, p.y - y) < r);
    for (const ds of this.dungeons) {
      for (const pack of ds.packs) {
        if (pack.ids.some((id) => this.npcs.has(id))) continue;
        if (!pack.emptyAt) pack.emptyAt = T;
        else if (T - pack.emptyAt > 180000 && !near(pack.room.x, pack.room.y, 800)) this.spawnPack(ds, pack);
      }
      if (ds.boss && !this.npcs.has(ds.boss)) { ds.boss = null; ds.bossAt = T + 480000; }
      const br = ds.d.rooms[ds.d.rooms.length - 1];
      if (!ds.boss && T >= ds.bossAt && !near(br.x, br.y, 700)) this.spawnBoss(ds);
    }
  }
  steer(n, x, y, spd) {
    const dx = x - n.x, dy = y - n.y, d = Math.hypot(dx, dy);
    if (d < 1 || spd <= 0) return;
    const base = Math.atan2(dy, dx);
    if (angDiff(base, n.ang) > BACKPEDAL_ANGLE) spd *= BACKPEDAL;
    const step = Math.min(d, spd * DT);
    const tryAng = (a) => {
      const [nx, ny] = moveBody(n.x, n.y, n.r, Math.cos(a) * step, Math.sin(a) * step);
      return { nx, ny, prog: (nx - n.x) * Math.cos(base) + (ny - n.y) * Math.sin(base), moved: Math.hypot(nx - n.x, ny - n.y) };
    };
    if (this.T < n.detourUntil) { const r = tryAng(base + n.detour); if (r.moved > step * 0.5) { n.x = r.nx; n.y = r.ny; n.moving = true; return; } }
    let r = tryAng(base);
    if (r.prog < step * 0.4) for (const off of [0.8, -0.8, 1.5, -1.5]) { const r2 = tryAng(base + off); if (r2.moved > step * 0.5) { r = r2; n.detour = off; n.detourUntil = this.T + 600; break; } }
    n.x = r.nx; n.y = r.ny; n.moving = true;
  }
  // NPCs see anyone less than 99% invisible.
  findTarget(n) {
    let best = null, bd = Infinity;
    for (const e of this.near(n.x, n.y, n.def.aggro)) {
      if (e === n || this.isObj(e) || !this.hostile(n, e) || inSafe(e) || this.invisOf(e) >= 0.99) continue;
      const d = (e.x - n.x) ** 2 + (e.y - n.y) ** 2;
      if (d < bd && losClear(n.x, n.y, e.x, e.y)) { bd = d; best = e; }
    }
    return best ? best.id : null;
  }
  // A ground blast that warns first (red circle), then hits everyone on the other side inside it.
  blast(n, x, y, r, delay, dmg, extra = {}) {
    this.zones.push({ type: 'blast', x, y, r, at: this.T + delay, d: delay, dmg, team: this.teamOf(n), stub: this.mkStub(n), ...extra });
  }
  summonMinions(n, kind, count, cap) {
    n.minions = n.minions || new Set();
    for (const id of n.minions) if (!this.npcs.has(id)) n.minions.delete(id);
    for (let i = 0; i < count && n.minions.size < cap; i++) {
      const s = this.freeSpot(n.x, n.y, 90, 40);
      const m = this.mkNpc(kind, s.x, s.y, { sc: Math.max(1, n.sc * 0.8), team: n.team, leash: 600, master: n.id, minionOf: n.id, ttl: this.T + 60000, danger: n.danger });
      n.minions.add(m.id);
    }
    this.fx({ t: 'ring', x: n.x, y: n.y, r: 80, c: '#9a6ad0' });
  }
  bossAbility(n, tgt) {
    const T = this.T, def = n.def, ab = def.abilities[(n.abIdx = (n.abIdx || 0) + 1) % def.abilities.length];
    const proj = def.proj || 'dark';
    switch (ab) {
      case 'slam': this.blast(n, n.x, n.y, n.r + 150, 900, def.dmg * 2.2); break;
      case 'charge': n.windUntil = T + 500; n.charge = { at: T + 500, until: T + 1300, ang: Math.atan2(tgt.y - n.y, tgt.x - n.x), hit: new Set() }; break;
      case 'barrage': for (let i = 0; i < 16; i++) this.fireProj(n, (i / 16) * Math.PI * 2 + T / 900, { speed: 360, dmg: def.dmg * 0.7, range: 576, kind: proj }); break;
      case 'summon': this.summonMinions(n, def.minion, 4, 8); break;
      case 'leap': this.blast(n, tgt.x, tgt.y, 130, 900, def.dmg * 1.8, { mover: n.id }); break;
      case 'web': this.zones.push({ type: 'web', x: tgt.x, y: tgt.y, r: 150, until: T + 6000, d: 6000, next: T, every: 250, team: this.teamOf(n), stub: this.mkStub(n) }); break;
      case 'nova': for (const p of this.livingFoesNear(n, n.x, n.y, 700)) if (p.isPlayer) this.blast(n, p.x, p.y, 120, 1100, def.dmg * 1.6, { slow: proj === 'frost' }); break;
      case 'meteor': for (let i = 0; i < 4; i++) this.blast(n, tgt.x + rnd(-160, 160), tgt.y + rnd(-160, 160), 120, 1300 + i * 200, def.dmg * 2, { root: 600 }); break;
      case 'blink': {
        const a = Math.atan2(n.y - tgt.y, n.x - tgt.x) + Math.PI, s = this.freeSpot(tgt.x + Math.cos(a) * 70, tgt.y + Math.sin(a) * 70, 40);
        this.fx({ t: 'poof', x: n.x, y: n.y, c: '#402060' }); n.x = s.x; n.y = s.y; n.nextAtk = T;
        break;
      }
    }
  }
  // ---- objects: traps, deployed banners, bonfires
  updateObject(n) {
    const T = this.T, d = n.def;
    if (d.trap) {
      const tr = d.trap;
      if (n.spinUntil) {
        if (T >= n.spinUntil) return this.killNpc(n, null, true);
        if (T >= n.nextAtk) { n.nextAtk = T + tr.spin.every; this.fx({ t: 'ring', x: n.x, y: n.y, r: tr.r, c: '#b0b8c4' }); for (const e of this.livingFoesNear(n, n.x, n.y, tr.r)) this.dealDamage(n, e, tr.spin.dmg, { atk: 0 }); }
        return;
      }
      const foes = this.livingFoesNear(n, n.x, n.y, tr.r);
      if (!foes.length) return;
      const st = this.mkStub(n);
      if (tr.spin) { n.spinUntil = T + tr.spin.dur; n.inv = 0; n.nextAtk = T; return; }
      if (tr.uses) {
        n.trig = n.trig || new Map();
        for (const e of foes) if ((n.trig.get(e.id) || 0) < T) { n.trig.set(e.id, T + 1500); this.dealDamage(st, e, tr.dmg, { atk: 0 }); if (--n.uses <= 0) return this.killNpc(n, null, true); }
        return;
      }
      const e = foes[0];
      if (tr.root) { this.root(e, tr.root); this.dealDamage(st, e, tr.dmg, { atk: 0 }); }
      if (tr.cloud) this.zones.push({ type: 'cloud', x: n.x, y: n.y, r: tr.cloud.r, until: T + tr.cloud.dur, d: tr.cloud.dur, next: T, every: 500, dps: tr.cloud.dps, team: this.teamOf(n), stub: st });
      if (tr.burst) { this.fx({ t: 'boom', x: n.x, y: n.y, r: tr.burst.r }); for (const f of this.livingFoesNear(n, n.x, n.y, tr.burst.r)) { this.dealDamage(st, f, tr.burst.dmg, { atk: 0 }); this.addDot(f, tr.burn.dps, tr.burn.dur, st); } }
      return this.killNpc(n, null, true);
    }
    if (this.tickNo % 4) return;
    if (d.banner) for (const e of this.alliesNear(n, n.x, n.y, d.banner.r)) {
      if (d.banner.def) this.addEff(e, { def: d.banner.def, tag: 'gonfalon' }, 400);
      if (d.banner.hot) e.hp = Math.min(e.maxhp, e.hp + d.banner.hot * DT * 4);
    }
    if (d.fire) for (const e of this.alliesNear(n, n.x, n.y, d.fire.r)) e.hp = Math.min(e.maxhp, e.hp + d.fire.hot * DT * 4);
  }
  updateNpc(n, awake) {
    const T = this.T;
    if (n.ttl && T > n.ttl) return this.killNpc(n, null, true);
    if (this.isObj(n)) { if (n.kind !== 'logs') this.updateObject(n); return; }
    this.tickStatus(n);
    if (n.dead) return;
    if (n.def.regen) n.hp = Math.min(n.maxhp, n.hp + n.maxhp * n.def.regen * DT);
    if (!awake && !n.owner && n.order === 'home') { if (n.hp < n.maxhp) n.hp = Math.min(n.maxhp, n.hp + n.maxhp * 0.05 * DT); return; }
    if (n.def.boss && !n.enraged && n.hp < n.maxhp * 0.35) { n.enraged = true; this.combo(n, 'ENRAGED'); }
    const spd = this.speedOf(n);
    n.moving = false;
    if (n.charge) {
      if (T < n.charge.at) return;
      if (T > n.charge.until) n.charge = null;
      else {
        const ox = n.x, oy = n.y;
        [n.x, n.y] = moveBody(n.x, n.y, n.r, Math.cos(n.charge.ang) * spd * 3.2 * DT, Math.sin(n.charge.ang) * spd * 3.2 * DT);
        n.moving = true;
        for (const e of this.livingFoesNear(n, n.x, n.y, n.r + 8)) if (!n.charge.hit.has(e.id)) { n.charge.hit.add(e.id); this.dealDamage(n, e, n.def.dmg * 1.6, { melee: true }); this.push(e, n.charge.ang, 90); }
        if (Math.hypot(n.x - ox, n.y - oy) < 1) n.charge = null;
        return;
      }
    }
    if (n.fuse) { if (T >= n.fuse) { this.zones.push({ type: 'blast', x: n.x, y: n.y, r: 100, at: T, d: 1, dmg: n.def.dmg, team: n.team, stub: this.mkStub(n) }); this.killNpc(n, null, true); } return; }
    // The leader of following troops: lost from sight for 2 minutes means they go home (or hold, if hired).
    const leader = n.order === 'follow' ? this.players.get(n.leader) : null;
    if (n.order === 'follow') {
      if (leader && !leader.dead && dist(leader, n) < 900) n.leaderSeen = T;
      else if (T - n.leaderSeen > 120000) { n.order = n.owner ? 'hold' : 'home'; n.anchor = n.owner ? { x: n.x, y: n.y } : n.home; n.obey = false; }
    }
    let tgt = n.target ? this.getEnt(n.target) : null;
    if (tgt && (tgt.dead || tgt.hp <= 0 || !this.hostile(n, tgt) || inSafe(tgt) || dist(n, tgt) > n.def.aggro * 2)) { tgt = null; n.target = null; }
    // A foe that vanishes (99% invisible) is attacked where it was last seen for a few seconds.
    if (tgt && this.invisOf(tgt) >= 0.99) { if (!n.ghost || n.ghost.id !== tgt.id) n.ghost = { id: tgt.id, x: tgt.x, y: tgt.y, until: T + 3000 }; tgt = null; n.target = null; }
    if (n.order === 'follow' && n.obey) { tgt = null; n.target = null; }
    const anchor = n.order === 'home' ? n.home : n.anchor;
    if (!n.owner && n.order !== 'follow' && n.order !== 'heal') {
      const dh = Math.hypot(n.x - anchor.x, n.y - anchor.y);
      if (dh > n.leash) { n.returning = true; n.target = null; tgt = null; }
      if (n.returning && dh < 40) n.returning = false;
    }
    const scan = n.aggr && !(n.order === 'follow' && n.obey);
    if (!tgt && scan && !n.returning && T >= n.nextScan) { n.nextScan = T + 300 + Math.random() * 200; n.target = this.findTarget(n); tgt = n.target ? this.getEnt(n.target) : null; }
    if (n.def.healer && T >= n.nextThink && this.npcHeal(n)) return;
    if (tgt) return n.def.ai === 'kit' ? this.fightKit(n, tgt, spd) : this.fight(n, tgt, spd);
    if (n.ghost && T < n.ghost.until) {
      const g = n.ghost; n.ang = Math.atan2(g.y - n.y, g.x - n.x);
      if (Math.hypot(g.x - n.x, g.y - n.y) > 50) this.steer(n, g.x, g.y, spd);
      else if (n.def.ai === 'kit') this.npcSwing(n, { x: g.x, y: g.y, r: 14 });
      return;
    }
    if (n.order === 'follow' && leader && !leader.dead) {
      const d = dist(n, leader);
      if (d > 900 && n.owner) { const s = this.freeSpot(leader.x, leader.y, 60); n.x = s.x; n.y = s.y; }
      else if (d > 90) { n.ang = Math.atan2(leader.y - n.y, leader.x - n.x); this.steer(n, leader.x, leader.y, spd); }
      return;
    }
    if (n.returning) {
      n.hp = Math.min(n.maxhp, n.hp + n.maxhp * 0.1 * DT);
      n.ang = Math.atan2(anchor.y - n.y, anchor.x - n.x);
      this.steer(n, anchor.x, anchor.y, spd);
      if (Math.hypot(n.x - anchor.x, n.y - anchor.y) > n.leash * 2.5) { n.x = anchor.x; n.y = anchor.y; }
      return;
    }
    if (n.hp < n.maxhp && T - (n.combatAt || 0) > 8000) n.hp = Math.min(n.maxhp, n.hp + n.maxhp * 0.02 * DT);
    if (n.order === 'scatter' && n.scatterTo) {
      if (Math.hypot(n.scatterTo.x - n.x, n.scatterTo.y - n.y) > 12) { n.ang = Math.atan2(n.scatterTo.y - n.y, n.scatterTo.x - n.x); this.steer(n, n.scatterTo.x, n.scatterTo.y, spd); }
      else { n.order = 'hold'; n.anchor = { x: n.x, y: n.y }; n.scatterTo = null; }
      return;
    }
    const wr = n.def.roam ? 600 : n.castle >= 0 || n.dungeon !== undefined || n.order === 'hold' ? 80 : 160;
    if (!n.wp2 || T > n.wanderT) { n.wp2 = { x: anchor.x + rnd(-wr, wr), y: anchor.y + rnd(-wr, wr) }; n.wanderT = T + rnd(2500, 6000); }
    if (Math.hypot(n.wp2.x - n.x, n.wp2.y - n.y) > 10) { n.ang = Math.atan2(n.wp2.y - n.y, n.wp2.x - n.x); this.steer(n, n.wp2.x, n.wp2.y, spd * 0.35); }
  }
  // Healers look after hurt allies first.
  npcHeal(n) {
    n.nextThink = this.T + 400;
    const hurt = this.alliesNear(n, n.x, n.y, n.order === 'heal' ? 400 : 250).filter((e) => e.hp < e.maxhp * 0.75).sort((a, b) => a.hp / a.maxhp - b.hp / b.maxhp);
    if (!hurt.length) return false;
    const h = hurt[0];
    if (n.kit.includes('blessing') && hurt.length >= 2 && this.useTool(n, TOOLS.blessing) === true) return true;
    if (n.kit.includes('tincture')) {
      if (dist(n, h) > 230) { n.ang = Math.atan2(h.y - n.y, h.x - n.x); this.steer(n, h.x, h.y, this.speedOf(n)); return true; }
      if (this.useTool(n, TOOLS.tincture) === true) return true;
    }
    return false;
  }
  // Creature combat behaviour by type. Every type falls back to closing in and hitting.
  fight(n, tgt, spd) {
    const T = this.T, def = n.def, d = dist(n, tgt), ar = def.range, cdMul = n.elite === 'swift' ? 0.7 : 1;
    n.ang = Math.atan2(tgt.y - n.y, tgt.x - n.x);
    if (T >= (n.losAt || 0)) { n.losAt = T + 250; n.los = losClear(n.x, n.y, tgt.x, tgt.y); }
    if (!n.los) { this.steer(n, tgt.x, tgt.y, spd); return; }
    if (T < (n.windUntil || 0)) return;
    if (def.boss && T >= n.nextSkill) { n.nextSkill = T + (n.enraged ? 2600 : 3800); this.bossAbility(n, tgt); if (n.charge) return; }
    switch (def.ai) {
      case 'charger':
        if (d > 130 && d < 380 && T >= n.nextSkill) { n.nextSkill = T + 5000; n.windUntil = T + 450; n.charge = { at: T + 450, until: T + 1050, ang: n.ang, hit: new Set() }; n.atkAt = T; return; }
        break;
      case 'leaper':
        if (d > 110 && d < 300 && T >= n.nextSkill) { n.nextSkill = T + 4500; this.blast(n, tgt.x, tgt.y, 70, 550, def.dmg * 1.4, { mover: n.id }); n.windUntil = T + 550; return; }
        break;
      case 'caster':
        if (T >= n.nextSkill) { n.nextSkill = T + 7000 * cdMul; this.blast(n, tgt.x, tgt.y, 90, 1000, def.dmg * 1.6, { slow: def.proj === 'frost' }); }
        break;
      case 'healer':
        if (T >= n.nextSkill) {
          const hurt = this.near(n.x, n.y, 320).find((e) => e !== n && e.isNpc && e.team === n.team && !this.isObj(e) && e.hp < e.maxhp * 0.8);
          if (hurt) { n.nextSkill = T + 3000; this.heal(hurt, hurt.maxhp * 0.25); this.fx({ t: 'line', x: n.x, y: n.y, x2: hurt.x, y2: hurt.y, c: '#7ff0a0' }); }
        }
        break;
      case 'summoner':
        if (T >= n.nextSkill) { n.nextSkill = T + 9000; this.summonMinions(n, def.minion, 2, 3); }
        break;
      case 'exploder':
        if (d < 46 + tgt.r) { n.fuse = T + 600; n.atkAt = T; this.combo(n, '!!'); return; }
        this.steer(n, tgt.x, tgt.y, spd); return;
      case 'slam':
        if (d < 150 && T >= n.nextSkill) { n.nextSkill = T + 6000 * cdMul; this.blast(n, n.x, n.y, n.r + 120, 800, def.dmg * 2); n.windUntil = T + 500; return; }
        break;
    }
    if (def.ranged) {
      const kite = def.ai === 'kite' || def.ai === 'healer' || def.ai === 'summoner' || def.ai === 'caster';
      if (kite && d < ar * 0.45) this.steer(n, n.x - Math.cos(n.ang) * 100, n.y - Math.sin(n.ang) * 100, spd);
      else if (d > ar * 0.85) this.steer(n, tgt.x, tgt.y, spd);
      if (d <= ar && T >= n.nextAtk) {
        n.nextAtk = T + def.cd * cdMul; n.atkAt = T;
        this.fireProj(n, n.ang + rnd(-0.05, 0.05), { speed: 440, dmg: def.dmg, range: ar + 120, kind: def.proj || 'arrow' });
      }
    } else if (d > ar + tgt.r + n.r - 4) this.steer(n, tgt.x, tgt.y, spd);
    else if (T >= n.nextAtk) {
      n.nextAtk = T + def.cd * cdMul; n.atkAt = T;
      this.fx({ t: 'arc', x: n.x, y: n.y, a: n.ang, r: ar + 14, w: 1.2 });
      this.dealDamage(n, tgt, def.dmg, { melee: true });
    }
  }
  // ---- people fight with their tools: keep the weapon's reach, turn to face, swing when it bears.
  npcWeapon(n) { return TOOLS[n.kit.find((k) => TOOLS[k].group === 'weapon') || n.kit.find((k) => TOOLS[k].group === 'sidearm' && TOOLS[k].type !== 'shoot') || n.kit[0]]; }
  reachOf(t) { return t.type === 'strike' ? t.hits[0].reach : t.type === 'charge' ? t.dist : t.type === 'shoot' ? t.range : 60; }
  npcSwing(n, tgt) {
    const w = this.npcWeapon(n), a = Math.atan2(tgt.y - n.y, tgt.x - n.x);
    n.ang = turnToward(n.ang, a, TURN_RATE * DT * (n.elite === 'swift' ? 1.4 : 1));
    // Like a person, wait out a raised shield instead of hitting it (most of the time).
    if (tgt.shieldUntil > this.T && this.defOf(tgt) >= 70 && Math.random() < 0.85) return;
    // People hesitate a moment between swings instead of attacking frame-perfectly (bots standing in for players don't).
    if (this.T < (n.swingOk || 0)) return;
    if (angDiff(n.ang, a) < 0.3 && dist(n, tgt) <= this.reachOf(w) + tgt.r && this.useTool(n, w) === true && !n.player) n.swingOk = this.T + w.cd + rnd(100, 400);
  }
  fightKit(n, tgt, spd) {
    const T = this.T, d = dist(n, tgt), w = this.npcWeapon(n), reach = this.reachOf(w), ranged = w.type === 'shoot';
    if (T >= (n.losAt || 0)) { n.losAt = T + 250; n.los = losClear(n.x, n.y, tgt.x, tgt.y); }
    if (!n.los) { this.steer(n, tgt.x, tgt.y, spd); return; }
    const want = ranged ? reach * 0.6 : Math.max(30, reach * 0.7) + tgt.r;
    if (T >= (n.strafeAt || 0)) { n.strafeAt = T + rnd(700, 1800); n.strafe = Math.random() < 0.5 ? 1 : -1; }
    const side = Math.atan2(tgt.y - n.y, tgt.x - n.x) + n.strafe * Math.PI / 2;
    if (ranged && d < Math.min(want * 0.6, 260)) this.steer(n, n.x - (tgt.x - n.x), n.y - (tgt.y - n.y), spd);
    else if (d > want + 10) this.steer(n, tgt.x, tgt.y, spd);
    else if (!ranged && d < want * 0.5) this.steer(n, n.x - (tgt.x - n.x), n.y - (tgt.y - n.y), spd * 0.5);
    else this.steer(n, n.x + Math.cos(side) * 60, n.y + Math.sin(side) * 60, spd * 0.5);
    if (T >= n.nextThink) { n.nextThink = T + rnd(350, 550); this.npcTactics(n, tgt, d); }
    this.npcSwing(n, tgt);
  }
  // What a person does with the rest of their kit, checked a couple of times a second.
  npcTactics(n, tgt, d) {
    const T = this.T, ready = (id) => (n.gcd[TOOLS[id].group] || 0) <= T, use = (id, o) => ready(id) && this.useTool(n, TOOLS[id], o) === true;
    const w = this.npcWeapon(n), reach = this.reachOf(w), ranged = w.type === 'shoot', facing = angDiff(n.ang, Math.atan2(tgt.y - n.y, tgt.x - n.x)) < 0.35;
    const threat = (tgt.atkAt && T - tgt.atkAt < 500) || T < (tgt.windUntil || 0), close = d < reach + tgt.r + 40, at = { ax: tgt.x, ay: tgt.y };
    for (const id of n.kit) {
      const t = TOOLS[id];
      if (t === w) continue;
      switch (t.type) {
        case 'shield': if (d < 220 && (threat || Math.random() < 0.12) && use(id)) return; break;
        case 'parry': if (d < 140 && (threat || Math.random() < 0.2) && use(id)) return; break;
        case 'strike': if (facing && d < t.hits[0].reach + tgt.r && use(id)) return; break;
        case 'shoot': if (facing && d < t.range * 0.9 && d > (t.arm || 0) && (!t.players || tgt.isPlayer) && use(id)) return; break;
        case 'buff': { const want = id === 'sprint' ? (ranged ? d < 180 : d > 260) : close; if (want && use(id)) return; break; }
        case 'aura': if (d < 260 && use(id)) return; break;
        case 'heal': if (!n.def.healer && n.hp < n.maxhp * 0.45 && (t.self ? d > 150 : true) && use(id)) return; break;
        case 'gather': if (d < t.r && d > 70 && !ranged && use(id)) return; break;
        case 'repel': if (d < t.r && ranged && use(id)) return; break;
        case 'cone': if (d < t.r && use(id)) return; break;
        case 'lob': if (d > 80 && d < t.range && use(id, at)) return; break;
        case 'move':
          if (t.dir === 'fwd' && !ranged && d > reach + 40 && d < reach + 180 && use(id)) return;
          if (t.dir === 'back' && ranged && d < 110 && use(id)) return;
          if (t.dir === 'attacker' && use(id)) return;
          if (t.target && d < t.target && Math.random() < 0.35 && use(id)) return;
          break;
      }
    }
  }

  // ---------------------------------------------------------------- tools
  mkStub(src) {
    const root = this.rootOwner(src);
    return { isStub: true, id: -1, from: src.id, x: src.x, y: src.y, team: this.teamOf(src), credit: root ? root.id : null, hp: 1, r: 0 };
  }
  ready(e, t) { return (e.gcd[t.group] || 0) <= this.T; }
  // Uses a tool. Returns true, or a reason it couldn't be used.
  useTool(e, t, o = {}) {
    const T = this.T;
    if (!t || e.dead) return 'dead';
    if (!this.ready(e, t)) return 'cooldown';
    if (e.channel) { if (!e.isPlayer) return 'busy'; this.cancelChannel(e, 'Cancelled: you used a tool.'); }
    if (e.effs.some((f) => f.until > T && f.root && f.still) && t.type !== 'heal') return 'meditating';
    const why = this.toolCheck(e, t, o);
    if (why) return why;
    e.gcd[t.group] = T + t.cd; e.gcdTotal = e.gcdTotal || {}; e.gcdTotal[t.group] = t.cd;
    e.atkAt = T; e.lastTool = t.id;
    if (t.group === 'weapon' || (t.group === 'sidearm' && t.type === 'strike')) e.wp = t.id;
    if (t.group !== 'stealth') { this.breakStealth(e, 'act'); e.disguiseUntil = 0; }
    if (t.windup) e.windUntil = T + t.windup;
    this.runTool(e, t, o);
    return true;
  }
  toolCheck(e, t, o) {
    const T = this.T;
    if (inSafe(e) && (t.type === 'trap' || t.type === 'deploy')) return 'Nothing can be placed in Hanbin Haven.';
    if (t.type === 'move' && t.target) { o.foe = this.pickFoe(e, t.target); if (!o.foe) return `${t.name} needs a foe within ${t.target}.`; }
    if (t.type === 'move' && t.dir === 'attacker') {
      const a = this.getEnt(e.lastHurtBy);
      if (!a || T - (e.lastHurtAt || 0) > t.within || a.dead) return `${t.name} only works just after you are hit or parry.`;
      o.foe = a;
    }
    if (t.type === 'stealth' && t.need === 'shadow' && !this.inShadow(e)) return 'Hide in Shadows needs forest or the shadow of a building.';
    if (t.wood && e.isPlayer && e.wood < t.wood) return `${t.name} needs ${t.wood} wood (you carry ${e.wood}). Break log piles to get some.`;
    if (t.type === 'trap' || t.type === 'deploy') {
      const pt = o.pt = this.placePoint(e, t.range, o);
      if (!pt) return 'There is no room to place that there.';
      if (t.type === 'trap') {
        if ([...this.npcs.values()].filter((n) => n.owner === e.id && n.def.trap).length >= MAX_TRAPS) return `You can have at most ${MAX_TRAPS} traps out.`;
        const own = this.ownerAt(pt.x, pt.y);
        if (own && own !== e.fac) return 'Traps can only go in friendly or neutral land.';
      }
      if (t.type === 'deploy' && !t.any) {
        if (!e.fac || this.ownerAt(pt.x, pt.y) !== e.fac) return 'Banners can only be planted in your faction\'s territory.';
        if ([...this.npcs.values()].some((n) => n.def.banner && Math.hypot(n.x - pt.x, n.y - pt.y) < AURA_GAP)) return `Another banner stands within ${AURA_GAP}: auras can't overlap.`;
      }
    }
    if (t.type === 'hire') {
      if (!e.isPlayer) return 'no';
      if (!e.fac || (this.ownerAt(e.x, e.y) !== e.fac && !inSafe(e))) return 'You can only hire troops in your faction\'s territory or Hanbin Haven.';
      if (e.bank < t.gold) return `${t.name} costs ${t.gold} banked gold.`;
      if ([...this.npcs.values()].filter((n) => n.owner === e.id && !this.isObj(n)).length >= MAX_TROOPS) return `You can have ${MAX_TROOPS} hired troops at once.`;
    }
    return null;
  }
  ownerAt(x, y) { const c = this.castles.find((k) => k.id === regionAt(x, y)); return c ? c.owner : 0; }
  inShadow(e) {
    const b = REGIONS[regionAt(e.x, e.y)]?.biome;
    if (b === 'forest' || b === 'darkforest') return true;
    if (propsIn(e.x - 50, e.y - 50, e.x + 50, e.y + 50).some((p) => p.k === 'tree' || p.k === 'pine')) return true;
    return HOUSES.some((h) => Math.abs(e.x - h.x) < h.w / 2 + 50 && Math.abs(e.y - h.y) < h.h / 2 + 50);
  }
  // The nearest foe within range, preferring one in front of you.
  pickFoe(e, range) {
    let best = null, bs = Infinity;
    for (const f of this.livingFoesNear(e, e.x, e.y, range)) {
      if (this.invisOf(f) >= 0.99 && !e.isPlayer) continue;
      const s = dist(e, f) * (1 + angDiff(e.ang, Math.atan2(f.y - e.y, f.x - e.x)));
      if (s < bs) { bs = s; best = f; }
    }
    return best;
  }
  aimPoint(e, max, o) {
    const ax = Number.isFinite(o.ax) ? o.ax : e.x + Math.cos(e.ang) * max, ay = Number.isFinite(o.ay) ? o.ay : e.y + Math.sin(e.ang) * max;
    const a = Math.atan2(ay - e.y, ax - e.x), d = Math.min(max, Math.hypot(ax - e.x, ay - e.y));
    let x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d;
    // Thrown things stop at walls.
    for (let k = 0; k < 10 && !losClear(e.x, e.y, x, y); k++) { x = e.x + (x - e.x) * 0.8; y = e.y + (y - e.y) * 0.8; }
    return { x: clamp(x, 0, W), y: clamp(y, 0, WORLD.H) };
  }
  placePoint(e, max, o) { const p = this.aimPoint(e, max, o); return freeAt(p.x, p.y, 12) ? p : null; }
  selfAfter(e, a, at = 0) { if (!a) return; const fn = () => this.addEff(e, { spd: a.spd || 0, atk: a.atk || 0, tag: 'after' }, a.dur); if (at + (a.delay || 0) > 0) this.later(e, at + (a.delay || 0), fn); else fn(); }
  runTool(e, t, o) {
    const T = this.T, w = t.windup || 0;
    switch (t.type) {
      case 'strike': {
        if (t.step) this.later(e, w, () => { [e.x, e.y] = moveBody(e.x, e.y, e.r, Math.cos(e.ang) * t.step, Math.sin(e.ang) * t.step); if (e.isPlayer) e.tp++; });
        for (const h of t.hits) this.later(e, w + h.t, () => this.strike(e, h));
        this.selfAfter(e, t.after, w + t.hits[t.hits.length - 1].t);
        return;
      }
      case 'charge': {
        const ang = e.ang, steps = 4, hit = new Set();
        for (let i = 1; i <= steps; i++) this.later(e, (t.dur / steps) * i, () => {
          if (hit.size) return;
          const ox = e.x, oy = e.y;
          [e.x, e.y] = moveBody(e.x, e.y, e.r, Math.cos(ang) * t.dist / steps, Math.sin(ang) * t.dist / steps);
          if (e.isPlayer) e.tp++;
          this.fx({ t: 'line', x: ox, y: oy, x2: e.x, y2: e.y, c: 'rgba(235,225,200,.6)', w: 8 });
          const f = this.foesNear(e, e.x + Math.cos(ang) * (e.r + 6), e.y + Math.sin(ang) * (e.r + 6), 14)[0];
          if (f) { hit.add(f.id); this.dealDamage(e, f, t.dmg, { melee: true }); this.push(f, ang, t.push); }
        });
        this.selfAfter(e, t.after, t.dur);
        return;
      }
      case 'shoot': {
        if (t.during) this.addEff(e, { spd: t.during.spd, tag: 'draw' }, t.during.dur);
        for (let i = 0; i < (t.count || 1); i++) this.later(e, w + i * (t.every || 0), () => this.fireProj(e, e.ang + (e.isNpc ? rnd(-0.07, 0.07) : 0), { tool: t, speed: t.speed, dmg: t.dmg, range: t.range, kind: t.proj || 'arrow', ranged: 1 }));
        return;
      }
      case 'lob': {
        const pt = this.aimPoint(e, t.range, o), stub = this.mkStub(e), atk = this.atkOf(e);
        this.zones.push({ type: 'lob', x: pt.x, y: pt.y, r: t.r, at: T + t.flight, d: t.flight, sx: e.x, sy: e.y, tool: t.id, team: this.teamOf(e), stub, atk, from: e.id });
        return;
      }
      case 'shield': {
        this.addEff(e, { def: t.def, atk: t.atk || 0, spd: t.spd || 0, tag: 'shield', shield: t.id }, t.dur);
        e.shieldUntil = T + t.dur; e.shieldKind = t.id;
        return;
      }
      case 'parry': e.parryUntil = T + t.window; this.fx({ t: 'ring', x: e.x, y: e.y, r: 30, c: '#4fc3e0' }); return;
      case 'move': return this.maneuver(e, t, o);
      case 'buff': this.addEff(e, { ...t.eff, tag: t.id }, t.dur); this.selfAfter(e, t.after); this.fx({ t: 'ring', x: e.x, y: e.y, r: 34, c: '#ffb050' }); return;
      case 'heal': {
        let who = e;
        if (t.toAlly) {
          const c = this.alliesNear(e, e.x, e.y, t.toAlly).filter((a) => a !== e && a.hp < a.maxhp).sort((a, b) => a.hp / a.maxhp - b.hp / b.maxhp)[0];
          if (c) { who = c; this.fx({ t: 'line', x: e.x, y: e.y, x2: c.x, y2: c.y, c: 'rgba(130,240,160,.8)', w: 3 }); }
        }
        const targets = t.allies ? this.alliesNear(e, e.x, e.y, t.allies) : [who];
        for (const a of targets) { if (t.amt) this.heal(a, t.amt); if (t.hot) this.addHot(a, t.hot.rate, t.hot.dur); }
        if (t.self) this.addEff(e, { def: t.self.def || 0, spd: t.self.spd || 0, root: t.self.root ? 1 : 0, still: t.self.root ? 1 : 0, tag: 'healing' }, t.self.dur);
        this.selfAfter(e, t.after);
        this.fx({ t: 'ring', x: e.x, y: e.y, r: t.allies || 30, c: '#5fe08a' });
        return;
      }
      case 'stealth': {
        this.addEff(e, { invis: t.invis, spd: t.eff ? t.eff.spd : 0, breakAct: 1, breakHit: t.breakHit ? 1 : 0, breakMove: t.breakMove ? 1 : 0, tag: 'stealth' }, t.dur);
        e.stealthAt = T;
        if (t.id === 'smoke') this.zones.push({ type: 'smoke', x: e.x, y: e.y, r: 70, until: T + 1500, d: 1500, next: T + 99999, every: 99999, team: this.teamOf(e) });
        else this.fx({ t: 'poof', x: e.x, y: e.y, c: '#402060' });
        return;
      }
      case 'disguise': e.disguiseUntil = T + t.dur; this.fx({ t: 'poof', x: e.x, y: e.y }); return;
      case 'gather': {
        const pt = { x: e.x + Math.cos(e.ang) * t.to, y: e.y + Math.sin(e.ang) * t.to }, foes = this.livingFoesNear(e, e.x, e.y, t.r);
        this.fx({ t: 'pulse', x: e.x, y: e.y, r: t.r });
        for (const f of foes) { this.dealDamage(e, f, t.dmg, {}); for (let k = 0; k < 3; k++) this.later(f, (t.dur / 3) * k, () => this.pullTo(f, pt.x, pt.y, Math.hypot(pt.x - f.x, pt.y - f.y) / (3 - k))); }
        return;
      }
      case 'repel': {
        this.zones.push({ type: 'smoke', x: e.x, y: e.y, r: t.r, until: T + 900, d: 900, next: T + 99999, every: 99999, team: this.teamOf(e) });
        for (const f of this.livingFoesNear(e, e.x, e.y, t.r)) { this.dealDamage(e, f, t.dmg, {}); this.push(f, Math.atan2(f.y - e.y, f.x - e.x), t.dist); }
        return;
      }
      case 'cone': {
        const stub = this.mkStub(e);
        this.fx({ t: 'arc', x: e.x, y: e.y, a: e.ang, r: t.r, w: (t.arc * Math.PI) / 180, c: 'rgba(150,40,60,.7)' });
        for (const f of this.livingFoesNear(e, e.x, e.y, t.r)) if (angDiff(Math.atan2(f.y - e.y, f.x - e.x), e.ang) <= (t.arc * Math.PI) / 360) this.addDot(f, t.dps, t.dur, stub, t.leech);
        return;
      }
      case 'aura': {
        for (const a of this.alliesNear(e, e.x, e.y, t.r)) { this.addEff(a, { ...t.eff, tag: t.id }, t.dur); if (t.hot) this.addHot(a, t.hot, t.dur); }
        this.fx({ t: 'ring', x: e.x, y: e.y, r: t.r, c: '#f0d070', fill: 1 });
        return;
      }
      case 'deploy': {
        if (e.isPlayer) { e.wood -= t.wood; e.dirty = true; }
        if (t.npc !== 'bonfire') for (const n of [...this.npcs.values()]) if (n.owner === e.id && n.kind === t.npc) this.killNpc(n, null, true);
        this.mkNpc(t.npc, o.pt.x, o.pt.y, { owner: e.id, leash: 99999 });
        if (t.self) this.addEff(e, { def: t.self.def, tag: 'lighting' }, t.self.dur);
        this.fx({ t: 'ring', x: o.pt.x, y: o.pt.y, r: 60, c: '#f0d070' });
        return;
      }
      case 'trap': {
        if (e.isPlayer) { e.wood -= t.wood; e.dirty = true; }
        this.mkNpc(t.npc, o.pt.x, o.pt.y, { owner: e.id, leash: 99999, ttl: T + 180000 });
        return;
      }
      case 'hire': return this.startChannel(e, { kind: 'hire', tool: t.id }, `Hiring (${t.gold} gold)`, HIRE_MS, false);
    }
  }
  hire(p, id) {
    const t = TOOLS[id], why = this.toolCheck(p, t, {});
    if (why) return this.say(p, why);
    p.bank -= t.gold; p.dirty = true;
    const s = this.freeSpot(p.x, p.y, 70, 30);
    const n = this.mkNpc(t.npc, s.x, s.y, { owner: p.id, leash: 99999, order: 'follow', leader: p.id, aggr: true });
    n.atkBase = 0;
    this.fx({ t: 'ring', x: s.x, y: s.y, r: 50, c: '#e0b84f' });
    this.send(p, { t: 'toast', m: `${MOBS[t.npc].name} hired. Say "follow", "kill", "hold" or "scatter" near them.` });
  }
  // One hit of a strike: an arc (or a straight thrust) checked along the way you face right now.
  strike(e, h) {
    if (e.dead) return;
    const ang = e.ang, cos = Math.cos(ang), sin = Math.sin(ang);
    let hits = [];
    if (h.line) {
      this.fx({ t: 'line', x: e.x + cos * 16, y: e.y + sin * 16, x2: e.x + cos * h.reach, y2: e.y + sin * h.reach, c: 'rgba(235,240,255,.8)', w: 5 });
      for (const f of this.foesNear(e, e.x + cos * h.reach / 2, e.y + sin * h.reach / 2, h.reach / 2 + 24)) {
        const dx = f.x - e.x, dy = f.y - e.y, t = dx * cos + dy * sin;
        if (t < -f.r || t > h.reach + f.r || Math.abs(-dx * sin + dy * cos) > 16 + f.r) continue;
        if (losClear(e.x, e.y, f.x, f.y)) hits.push([t, f]);
      }
      hits.sort((a, b) => a[0] - b[0]);
      if (h.first) hits = hits.slice(0, 1);
      hits = hits.map((x) => x[1]);
    } else {
      const arc = (h.arc * Math.PI) / 180;
      this.fx({ t: 'arc', x: e.x, y: e.y, a: ang, r: h.reach, w: Math.min(6.4, arc) });
      for (const f of this.foesNear(e, e.x, e.y, h.reach)) {
        if (h.arc < 360 && angDiff(Math.atan2(f.y - e.y, f.x - e.x), ang) > arc / 2) continue;
        if (losClear(e.x, e.y, f.x, f.y)) hits.push(f);
      }
    }
    for (const f of hits) {
      if (this.dealDamage(e, f, h.dmg, { melee: true }) <= 0 || f.dead) continue;
      const a = Math.atan2(f.y - e.y, f.x - e.x);
      if (h.push) this.push(f, a, h.push);
      if (h.pull) this.pullTo(f, e.x, e.y, h.pull);
      if (h.root) this.root(f, h.root);
      if (h.eff && !this.isObj(f)) this.addEff(f, { ...h.eff, tag: h.eff.tag || undefined }, h.eff.dur);
    }
  }
  maneuver(e, t, o) {
    const f = o.foe, ox = e.x, oy = e.y;
    const go = (x, y) => {
      for (let k = 0; k < 8; k++) { const q = 1 - k / 8, tx = ox + (x - ox) * q, ty = oy + (y - oy) * q; if (freeAt(tx, ty, e.r) && losClear(ox, oy, tx, ty)) { e.x = tx; e.y = ty; break; } }
      if (e.isPlayer) e.tp++;
      this.fx({ t: 'line', x: ox, y: oy, x2: e.x, y2: e.y, c: 'rgba(220,230,255,.6)', w: 8 });
    };
    if (t.aoe && t.aoe.atStart) for (const g of this.livingFoesNear(e, ox, oy, t.aoe.r)) { this.dealDamage(e, g, t.aoe.dmg, {}); this.push(g, Math.atan2(g.y - oy, g.x - ox), t.aoe.push); }
    if (t.dir === 'fwd') go(ox + Math.cos(e.ang) * t.dist, oy + Math.sin(e.ang) * t.dist);
    else if (t.dir === 'back') go(ox - Math.cos(e.ang) * t.dist, oy - Math.sin(e.ang) * t.dist);
    else if (t.dir === 'attacker') { const a = Math.atan2(f.y - oy, f.x - ox), d = Math.max(0, Math.min(t.dist, dist(e, f) - f.r - e.r - 6)); go(ox + Math.cos(a) * d, oy + Math.sin(a) * d); e.ang = a; }
    else {
      // Enemy-relative steps keep a 40 px gap so you never overshoot.
      const base = Math.atan2(oy - f.y, ox - f.x), gap = f.r + e.r + 40, side = angDiff(e.ang + 0.3, Math.atan2(f.y - oy, f.x - ox)) < angDiff(e.ang - 0.3, Math.atan2(f.y - oy, f.x - ox)) ? 1 : -1;
      if (t.dir === 'side') { const a = base + side * Math.PI / 2; go(f.x + Math.cos(a) * gap, f.y + Math.sin(a) * gap); }
      else if (t.dir === 'circle') { const a = base + side * (2 * Math.PI) / 3, r = Math.min(dist(e, f), gap + 20); go(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r); }
      else if (t.dir === 'cross') { const a = Math.atan2(f.y - oy, f.x - ox) + Math.PI + side * Math.PI / 4; go(ox + Math.cos(a) * t.dist, oy + Math.sin(a) * t.dist); }
      e.ang = Math.atan2(f.y - e.y, f.x - e.x); if (e.isPlayer) e.aim = e.ang;
    }
    if (t.aoe && !t.aoe.atStart) { this.fx({ t: 'ring', x: e.x, y: e.y, r: t.aoe.r, c: '#ffffff' }); for (const g of this.livingFoesNear(e, e.x, e.y, t.aoe.r)) this.dealDamage(e, g, t.aoe.dmg, {}); }
    if (t.buff) this.addEff(e, { atk: t.buff.atk, tag: 'maneuver' }, t.buff.dur);
    this.selfAfter(e, t.after);
    if (t.dir === 'attacker') e.lastHurtAt = 0;
  }
  breakStealth(e, why) {
    if (!e.effs) return;
    const before = e.effs.length;
    e.effs = e.effs.filter((f) => !(f.until > this.T && ((why === 'act' && f.breakAct) || (why === 'hit' && f.breakHit) || (why === 'move' && f.breakMove))));
    if (e.effs.length !== before && e.isPlayer) this.send(e, { t: 'toast', m: 'You are visible again.' });
  }

  // ---------------------------------------------------------------- projectiles & zones
  fireProj(src, ang, o) {
    const t = o.tool;
    this.projs.push({
      x: src.x + Math.cos(ang) * (src.r + 4), y: src.y + Math.sin(ang) * (src.r + 4),
      vx: Math.cos(ang) * o.speed, vy: Math.sin(ang) * o.speed, ang, left: o.range, flown: 0, kind: o.kind || 'arrow',
      dmg: o.dmg, atk: src.isNpc && !t ? this.atkOf(src) : this.atkOf(src, true), ranged: !!o.ranged || !!t, tool: t ? t.id : null,
      hit: new Set(), stub: this.mkStub(src), team: this.teamOf(src), from: src.id,
    });
  }
  projHit(p, e) {
    const t = p.tool && TOOLS[p.tool];
    if (p.dmg > 0) this.dealDamage(p.stub, e, p.dmg, { atk: p.atk, ranged: p.ranged });
    if (!t || e.dead || this.isObj(e)) return;
    if (t.maim) this.addEff(e, { spd: t.maim.spd, tag: 'maim' }, t.maim.dur);
    if (t.eff) this.addEff(e, { def: t.eff.def || 0, spd: t.eff.spd || 0, cd: t.eff.cd || 0, tag: t.id }, t.eff.dur);
    if (t.pull) { const s = this.getEnt(p.from); if (s) this.pullTo(e, s.x, s.y, t.pull); }
    if (p.kind === 'frost') this.addEff(e, { spd: -40, tag: 'chill' }, 1500);
  }
  updateProjs() {
    const keep = [];
    for (const p of this.projs) {
      let dead = false;
      const t = p.tool && TOOLS[p.tool];
      for (let s = 0; s < 3 && !dead; s++) {
        const dx = (p.vx * DT) / 3, dy = (p.vy * DT) / 3;
        p.x += dx; p.y += dy; p.flown += Math.hypot(dx, dy);
        if (p.flown >= p.left || p.x < 0 || p.y < 0 || p.x > W || p.y > WORLD.H || shotBlocked(p.x, p.y)) { dead = true; this.fx({ t: 'spark', x: p.x, y: p.y }); break; }
        if (t && t.arm && p.flown < t.arm) continue;
        for (const e of this.near(p.x, p.y, t && t.small ? 3 : 8)) {
          if (p.hit.has(e.id) || this.teamOf(e) === p.team || e.id === p.from) continue;
          if (t && t.players && !e.isPlayer) continue;
          p.hit.add(e.id);
          this.projHit(p, e);
          dead = true; break;
        }
      }
      if (!dead) keep.push(p);
    }
    this.projs = keep;
  }
  landLob(z) {
    const t = TOOLS[z.tool];
    this.fx({ t: t.id === 'saltpetre' || t.id === 'gall' ? 'boom' : 'ring', x: z.x, y: z.y, r: t.r, c: '#c8b090' });
    const foes = this.near(z.x, z.y, t.r).filter((e) => this.teamOf(e) !== z.team && !inSafe(e));
    for (const e of foes) {
      if (t.dmg) this.dealDamage(z.stub, e, t.dmg, { atk: z.atk });
      if (e.dead || this.isObj(e)) continue;
      if (t.dot) this.addDot(e, t.dot.dps, t.dot.dur, z.stub);
      if (t.push) this.push(e, Math.atan2(e.y - z.y, e.x - z.x), t.push);
      if (t.eff) this.addEff(e, { spd: t.eff.spd, tag: t.id }, t.eff.dur);
      if (t.root) this.root(e, t.root);
    }
    if (t.zone) this.zones.push({ type: 'fire', x: z.x, y: z.y, r: t.r, until: this.T + t.zone.dur, d: t.zone.dur, next: this.T, every: 500, dps: t.zone.dps, team: z.team, stub: z.stub });
    if (t.id === 'net') this.zones.push({ type: 'net', x: z.x, y: z.y, r: t.r, until: this.T + t.root, d: t.root, next: this.T + 99999, every: 99999, team: z.team });
  }
  updateZones() {
    const T = this.T, keep = [];
    for (const z of this.zones) {
      if (z.type === 'blast' || z.type === 'lob') {
        if (T >= z.at) {
          if (z.type === 'lob') { this.landLob(z); continue; }
          if (z.mover) { const m = this.npcs.get(z.mover); if (m && freeAt(z.x, z.y, m.r)) { m.x = z.x; m.y = z.y; } }
          this.fx({ t: 'boom', x: z.x, y: z.y, r: z.r });
          for (const e of this.near(z.x, z.y, z.r)) if (this.teamOf(e) !== z.team && !this.isObj(e)) {
            this.dealDamage(z.stub, e, z.dmg, { secondary: true });
            if (z.root) this.root(e, z.root);
            if (z.slow) this.addEff(e, { spd: -50, tag: 'chill' }, 2500);
          }
          continue;
        }
      } else {
        if (T >= z.until) continue;
        if (T >= z.next) {
          z.next = T + z.every;
          for (const e of this.near(z.x, z.y, z.r)) {
            if (this.teamOf(e) === z.team || this.isObj(e)) continue;
            if (z.type === 'web') this.addEff(e, { spd: -60, tag: 'web' }, 600);
            else if (z.dps) this.dealDamage(z.stub, e, z.dps * z.every / 1000, { secondary: true, dot: true, atk: 0 });
          }
        }
      }
      keep.push(z);
    }
    this.zones = keep;
  }

  // ---------------------------------------------------------------- per-tick updates
  updatePlayer(p) {
    const T = this.T;
    if (p.gone && T >= p.ghostUntil) return this.removePlayer(p);
    if (p.dead) { if (T >= p.respawnAt + 120000) this.respawn(p, 'haven'); return; }
    this.tickStatus(p);
    if (p.dead) return;
    // Facing turns toward where you aim at a fixed rate.
    p.ang = turnToward(p.ang, p.aim, TURN_RATE * DT);
    if (inSafe(p)) p.hp = Math.min(p.maxhp, p.hp + p.maxhp * 0.08 * DT);
    else if (T - p.combatAt > 8000) p.hp = Math.min(p.maxhp, p.hp + DT);
    // Quicksilver makes your cooldowns run slower.
    const slowCd = this.sumEff(p, 'cd');
    if (slowCd) for (const g in p.gcd) if (p.gcd[g] > T) p.gcd[g] += DT * 1000 * slowCd / 100;
    if (T - p.lastMoveAt < 120 && p.effs.some((f) => f.breakMove && f.until > T && T - p.stealthAt > 300)) this.breakStealth(p, 'move');
    // Held keys repeat as soon as the tool is ready; a double-click queues one use.
    for (const s of p.held) this.useSlot(p, s, false);
    if (p.queued >= 0) { const t = TOOLS[p.belt[p.queued]]; if (!t) p.queued = -1; else if (this.ready(p, t)) { this.useSlot(p, p.queued, true); p.queued = -1; } }
    this.shieldAuras(p);
    const spd = this.speedOf(p);
    p.moveBudget = Math.min(spd * 0.5, p.moveBudget + spd * DT * 1.2);
    if (p.channel) {
      if (Math.hypot(p.x - p.channel.x, p.y - p.channel.y) > 12) this.cancelChannel(p, 'Cancelled: you moved.');
      else if (T >= p.channel.until) this.finishChannel(p);
    }
    if (p.gold > 0 && this.canManage(p)) { p.bank += p.gold; this.send(p, { t: 'toast', m: `Banked ${p.gold} gold` }); p.gold = 0; p.dirty = true; }
    if (this.loot.size) for (const l of this.loot.values()) {
      if (Math.abs(l.x - p.x) > 40 || Math.abs(l.y - p.y) > 40) continue;
      p.gold += l.gold; p.wood += l.wood;
      this.send(p, { t: 'gain', v: 0, s: 0, g: l.gold, w: l.wood });
      this.loot.delete(l.id); p.dirty = true;
    }
    if (T >= (p.portalCd || 0)) {
      for (const c of CAVES) if (Math.abs(c.x - p.x) < 40 && Math.abs(c.y - p.y) < 40) {
        const d = DUNGEONS[c.dungeon], s = this.freeSpot(d.start.x, d.start.y, 60);
        p.portalCd = T + 1500; this.teleport(p, s.x, s.y);
        this.send(p, { t: 'toast', m: `You enter ${d.name}` });
        return;
      }
      const dg = dungeonAt(p.x, p.y);
      if (dg && [dg.exitPortal, dg.bossPortal].some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 38)) {
        const s = this.freeSpot(dg.cave.x, dg.cave.y + 110, 50);
        p.portalCd = T + 1500; this.teleport(p, s.x, s.y);
      }
    }
  }
  // Scutum and Heraldic Shield protect allies around you while raised (capped at +20 from allies).
  shieldAuras(p) {
    if (this.T >= (p.shieldUntil || 0) || this.tickNo % 2) return;
    const t = TOOLS[p.shieldKind];
    if (t && t.ally) for (const a of this.alliesNear(p, p.x, p.y, t.ally.r)) {
      if (a === p) continue;
      if (t.ally.behind && angDiff(Math.atan2(a.y - p.y, a.x - p.x), p.ang) < Math.PI / 3) continue;
      this.addEff(a, { def: t.ally.def, ally: 1, tag: t.id + ':' + p.id }, 250);
    }
    if (t && t.shove) for (const f of this.livingFoesNear(p, p.x, p.y, p.r + 6)) if (this.T > (f.shovedAt || 0)) { f.shovedAt = this.T + 500; this.push(f, Math.atan2(f.y - p.y, f.x - p.x), t.shove); }
  }
  useSlot(p, s, explicit) {
    const id = p.belt[s], t = id && TOOLS[id];
    if (!t || p.dead || p.gone) return;
    if (!this.ready(p, t)) return;
    const r = this.useTool(p, t, { ax: p.aimX, ay: p.aimY });
    if (r !== true && r !== 'cooldown' && (explicit || this.T > (p.whyAt || 0))) { p.whyAt = this.T + 1500; this.say(p, r); }
  }
  // Applies a position the client reports, limited by speed budget and collision.
  clientMove(p, x, y) {
    const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
    if (d < 0.05 || p.moveBudget <= 0) return;
    // Backpedalling (moving away from where you face) costs more of the speed budget.
    const cost = d > 0.5 && angDiff(Math.atan2(dy, dx), p.ang) > BACKPEDAL_ANGLE ? 1 / BACKPEDAL : 1;
    const f = Math.min(1, p.moveBudget / (d * cost));
    [p.x, p.y] = moveBody(p.x, p.y, p.r, dx * f, dy * f);
    p.moveBudget -= d * f * cost;
    if (d > 1) p.lastMoveAt = this.T;
  }
  // A castle changes hands when exactly one faction has presence inside its walls for 3 seconds.
  // Presence: living players, NPCs of a faction (garrison, hired troops), standing Gonfalons and Ensigns.
  // Traps never count. Bandit garrisons hold their own castle.
  presenceIn(c) {
    const teams = new Map(), L = CASTLE_TYPES[c.type];
    for (const e of this.near(c.x, c.y, L.outer * 1.45)) {
      if (!inCastleWalls(c, e.x, e.y)) continue;
      if (this.isObj(e) && !e.def.holds) continue;
      let team = null;
      if (e.isPlayer) team = this.teamOf(e);
      else if (e.isNpc) { const tm = this.teamOf(e); if (tm.startsWith('f:')) team = tm; else if (tm === 'wild' && e.castle === c.id) team = 'wild'; }
      if (team) teams.set(team, (teams.get(team) || 0) + 1);
    }
    return teams;
  }
  updateCastles() {
    const T = this.T;
    for (const c of this.castles) {
      const own = c.owner ? 'f:' + c.owner : 'wild', pres = this.presenceIn(c);
      c.pres = pres;
      const enemy = [...pres.keys()].some((k) => k !== own);
      if (pres.size === 1 && !pres.has(own)) {
        const k = [...pres.keys()][0];
        if (k.startsWith('f:')) {
          if (c.prog.fac !== k) c.prog = { fac: k, t: 0 };
          c.prog.t += DT;
          if (c.prog.t >= CAPTURE_TIME) this.captureCastle(c, +k.slice(2));
        }
      } else c.prog = { fac: '', t: 0 };
      if (enemy) c.calm = 0; else c.calm += DT;
      if (c.calm > 15) for (let i = 0; i < c.slots.length; i++) if ((!c.slots[i] || !this.npcs.has(c.slots[i])) && T >= c.slotAt[i]) this.spawnGuard(c, i);
    }
  }
  captureCastle(c, facId) {
    const f = this.factions[facId];
    if (!f) { c.prog = { fac: '', t: 0 }; return; }
    const old = c.owner && this.factions[c.owner] ? this.factions[c.owner].name : 'the bandits';
    c.owner = facId; c.prog = { fac: '', t: 0 }; c.calm = 0;
    // Surviving defenders pledge allegiance to the new owner; empty posts refill over the next minute or so.
    for (let i = 0; i < c.slots.length; i++) {
      const n = this.npcs.get(c.slots[i]);
      if (n) { n.team = 'f:' + facId; n.fac = facId; n.order = 'home'; n.target = null; n.aggr = true; n.obey = false; n.returning = true; }
      else c.slotAt[i] = this.T + rnd(40000, 80000);
    }
    this.refreshFactionStats();
    for (const p of this.players.values()) if (!p.dead && p.fac === facId && inCastleWalls(c, p.x, p.y)) this.reward(p, CAPTURE_VALOR[c.type], 1, null);
    this.broadcast({ t: 'msg', m: `${f.name} has conquered ${c.name} from ${old}!`, c: f.color });
    this.broadcast({ t: 'meta', ...this.metaObj() });
    for (const p of this.players.values()) this.sendProf(p);
    this.worldDirty = true;
  }
  loseCastle(c) {
    c.owner = 0; c.level = 1;
    this.clearGarrison(c);
    const kinds = garrisonFor(c.type, c.danger, 1, c.biome);
    c.slots = kinds.map(() => null); c.slotAt = kinds.map(() => 0); c.calm = 99;
  }
  payTaxes() {
    const income = new Map();
    for (const c of this.castles) if (c.owner) income.set(c.owner, (income.get(c.owner) || 0) + CASTLE_TAX * c.level);
    for (const p of this.players.values()) {
      const g = p.fac && income.get(p.fac);
      if (!g || p.gone) continue;
      p.bank += g; p.dirty = true;
      this.send(p, { t: 'toast', m: `Castle taxes: +${g} gold` });
    }
  }

  // ---------------------------------------------------------------- orders
  // Spoken orders reach allied troops within 400. Castle troops need the right rank; hired troops obey
  // their owner. A nearby commander with more Valor overrules you.
  order(p, text) {
    const words = text.toLowerCase().trim().split(/\s+/);
    if (words.join(' ') === 'rally my troops') {
      if (![...this.npcs.values()].some((n) => n.owner === p.id && !this.isObj(n))) return this.say(p, 'You have no hired troops.') || true;
      this.startChannel(p, { kind: 'troops' }, 'Rallying your troops', RALLY_TROOPS_MS, false);
      return true;
    }
    if (words.length > 2 || !ORDERS.has(words.at(-1))) return false;
    const cmd = words.at(-1), only = words.length === 2 ? TROOP_NAMES[words[0]] : null;
    if (words.length === 2 && !only) return false;
    let n = 0, refused = 0, rankLow = 0;
    for (const t of this.near(p.x, p.y, 400)) {
      if (!t.isNpc || this.isObj(t) || this.teamOf(t) !== this.teamOf(p) || (only && t.kind !== only)) continue;
      const mine = t.owner === p.id;
      if (!mine) {
        if (t.owner || t.castle < 0) continue;
        const need = cmd === 'obey' || cmd === 'fend' ? RANK.king : COMMAND_RANK[t.kind] ?? 99;
        if (p.rank < need) { rankLow++; continue; }
        const boss = t.cmdBy && t.cmdBy !== p.id ? this.players.get(t.cmdBy) : null;
        if (boss && !boss.dead && dist(boss, t) < 900 && boss.valor > p.valor) { refused++; continue; }
      }
      if (cmd === 'heal' && !t.def.healer) continue;
      t.cmdBy = p.id;
      if (cmd === 'follow') { t.order = 'follow'; t.leader = p.id; t.leaderSeen = this.T; t.aggr = false; t.target = null; t.returning = false; }
      else if (cmd === 'kill') { t.aggr = true; }
      else if (cmd === 'scatter') { const a = Math.random() * 6.28, d = rnd(120, 260); t.order = 'scatter'; t.scatterTo = { x: t.x + Math.cos(a) * d, y: t.y + Math.sin(a) * d }; t.target = null; }
      else if (cmd === 'hold') {
        const home = t.castle >= 0 && inCastleWalls(this.castles.find((c) => c.id === t.castle), t.x, t.y);
        t.order = home ? 'home' : 'hold'; t.anchor = { x: t.x, y: t.y }; t.aggr = true; t.obey = false;
      } else if (cmd === 'heal') t.order = 'heal';
      else if (cmd === 'obey') t.obey = true;
      else if (cmd === 'fend') t.obey = false;
      n++;
    }
    if (n) this.send(p, { t: 'toast', m: `${n} ${n === 1 ? 'troop obeys' : 'troops obey'}: ${cmd}` });
    else if (refused) this.say(p, 'Those troops follow a commander with more Valor.');
    else if (rankLow) this.say(p, 'Your rank is too low to command those troops (see the Ranks panel).');
    return n > 0;
  }

  // ---------------------------------------------------------------- snapshots
  flagsOf(e) {
    const T = this.T; let f = 0;
    if (this.rooted(e)) f |= 1; if (T < (e.parryUntil || 0)) f |= 2; if (this.sumEff(e, 'spd') < 0) f |= 4;
    if (this.defOf(e) < 0) f |= 8; if (this.atkOf(e) > 0) f |= 16; if (T < (e.shieldUntil || 0)) f |= 32; if (e.channel) f |= 64;
    if (e.hots && e.hots.length) f |= 128; if (e.dots && e.dots.length) f |= 256; if (T < (e.windUntil || 0) || e.fuse) f |= 1024;
    return f;
  }
  snapshot(p) {
    const T = this.T, vx = p.x, vy = p.y, ents = [], myTeam = this.teamOf(p);
    const push = (e) => {
      if (e.dead || Math.abs(e.x - vx) > VIEW_W || Math.abs(e.y - vy) > VIEW_H) return;
      const enemy = this.teamOf(e) !== myTeam, iv = Math.max(this.invisOf(e), e.inv || 0);
      if (enemy && iv >= 0.99) return;
      const o = { i: e.id, k: e.kind, x: rd(e.x), y: rd(e.y), a: +e.ang.toFixed(2), h: Math.ceil(e.hp), m: rd(e.maxhp), fl: this.flagsOf(e) };
      if (iv) o.iv = +iv.toFixed(2);
      if (e.atkAt && T - e.atkAt < 300) o.at = 1;
      if (T < (e.shieldUntil || 0)) o.sh = e.shieldKind;
      if (e.wp) o.wp = e.wp;
      if (e.isPlayer) {
        o.n = e.name; o.f = e.fac || 0; o.rk = e.rank; if (e.vet) o.vt = 1;
        if (enemy && T < (e.disguiseUntil || 0) && p.fac) o.f = p.fac;
      } else {
        if (e.owner) { const ow = this.players.get(e.owner); o.f = ow ? ow.fac || 0 : 0; o.ow = e.owner; } else o.f = e.fac || 0;
        if (e.elite) o.el = e.elite;
        if (e.enraged) o.en = 1;
        if (e.spinUntil) o.sp = 1;
      }
      ents.push(o);
    };
    for (const e of this.players.values()) push(e);
    for (const e of this.npcs.values()) push(e);
    const pr = [];
    for (const q of this.projs) if (Math.abs(q.x - vx) < VIEW_W && Math.abs(q.y - vy) < VIEW_H) pr.push([rd(q.x), rd(q.y), q.kind, +q.ang.toFixed(2)]);
    const zs = [];
    for (const z of this.zones) {
      if (Math.abs(z.x - vx) > VIEW_W + 200 || Math.abs(z.y - vy) > VIEW_H + 200) continue;
      const o = { t: z.type, x: rd(z.x), y: rd(z.y), r: z.r, l: z.at ? z.at - T : z.until - T, d: z.d };
      if (z.type === 'lob') { o.sx = rd(z.sx); o.sy = rd(z.sy); o.k = z.tool; }
      zs.push(o);
    }
    const lt = [];
    for (const l of this.loot.values()) if (Math.abs(l.x - vx) < VIEW_W && Math.abs(l.y - vy) < VIEW_H) lt.push([l.id, rd(l.x), rd(l.y), l.gold ? 'gold' : 'wood']);
    const fxs = this.fxq.filter((f) => Math.abs(f.x - vx) < VIEW_W + 200 && Math.abs(f.y - vy) < VIEW_H + 200);
    const gcd = [];
    for (const g in p.gcd) { const rem = p.gcd[g] - T; if (rem > 0) gcd.push([g, rd(rem), (p.gcdTotal && p.gcdTotal[g]) || rem]); }
    let cz = -1, cp = 0, cdf = 0, cl = 0;
    for (const c of this.castles) if (inCastleWalls(c, p.x, p.y)) {
      cz = c.id; cl = c.level; cp = c.prog.fac === myTeam ? +(c.prog.t / CAPTURE_TIME).toFixed(2) : 0;
      if (c.pres) for (const [k, v] of c.pres) if (k !== myTeam) cdf += v;
      break;
    }
    return JSON.stringify({
      t: 's', n: this.tickNo,
      me: { x: rd(p.x), y: rd(p.y), h: +p.hp.toFixed(1), mh: p.maxhp, v: Math.floor(p.valor), cap: this.capOf(p), s: Math.floor(p.soma), g: p.gold, b: p.bank, w: p.wood, sp: rd(this.speedOf(p)), fl: this.flagsOf(p), gcd,
        dead: p.dead ? 1 : 0, rs: p.dead ? Math.max(0, p.respawnAt - T) : 0, cz, cp, cdf, cl, tp: p.tp, mg: this.canManage(p) ? 1 : 0, q: p.queued, a: +p.ang.toFixed(2),
        iv: +this.invisOf(p).toFixed(2), dg: T < (p.disguiseUntil || 0) ? 1 : 0, ch: p.channel ? [Math.max(0, p.channel.until - T), p.channel.total, p.channel.label] : 0 },
      e: ents, pr, zs, lt, fx: fxs,
    });
  }
  // Rank privileges on the map: Sentinels see enemy players in their faction's land, Bannerets all allies.
  radar(p) {
    const out = { t: 'radar', e: [], a: [] };
    if (p.rank >= RANK.radar && p.fac) for (const o of this.players.values()) if (!o.dead && o.fac !== p.fac && this.ownerAt(o.x, o.y) === p.fac && this.invisOf(o) < 0.99) out.e.push([rd(o.x), rd(o.y)]);
    if (p.rank >= RANK.allies && p.fac) {
      for (const o of this.players.values()) if (!o.dead && o !== p && o.fac === p.fac) out.a.push([rd(o.x), rd(o.y)]);
      for (const n of this.npcs.values()) if (n.owner && !this.isObj(n)) { const ow = this.players.get(n.owner); if (ow && ow.fac === p.fac) out.a.push([rd(n.x), rd(n.y), 1]); }
    }
    if (out.e.length || out.a.length || p.radarWas) this.send(p, out);
    p.radarWas = out.e.length + out.a.length > 0;
  }
  metaObj() {
    const facs = Object.values(this.factions).map((f) => ({ id: f.id, name: f.name, color: f.color, pub: f.pub ? 1 : 0, m: f.members.length, on: [...this.players.values()].filter((p) => p.fac === f.id && !p.gone).length, c: this.castles.filter((c) => c.owner === f.id).length, cap: this.facStats[f.id] ? this.facStats[f.id].cap : CAP_BASE, t: this.facStats[f.id] ? this.facStats[f.id].t : 0 }));
    const lb = [...this.players.values()].sort((a, b) => b.valor - a.valor || b.soma - a.soma).slice(0, 10).map((p) => ({ n: p.name, v: Math.floor(p.valor), s: Math.floor(p.soma), t: p.tier, f: p.fac || 0, vt: p.vet || 0 }));
    const bosses = this.dungeons.map((ds) => (ds.boss ? 0 : Math.max(0, ds.bossAt - this.T)));
    return { c: this.castles.map((c) => [c.id, c.owner || 0, c.level]), f: facs, lb, on: this.players.size, bosses };
  }

  // ---------------------------------------------------------------- messages from a client
  handle(p, m) {
    if (p.gone) return;
    const aim = () => { if (Number.isFinite(m.a)) p.aim = m.a; if (Number.isFinite(m.x) && Number.isFinite(m.y)) { p.aimX = m.x; p.aimY = m.y; } };
    switch (m.t) {
      case 'in':
        if (Number.isFinite(m.a)) p.aim = m.a;
        if (Number.isFinite(m.ax) && Number.isFinite(m.ay)) { p.aimX = m.ax; p.aimY = m.ay; }
        if (!p.dead && m.tp === p.tp && Number.isFinite(m.x) && Number.isFinite(m.y)) this.clientMove(p, m.x, m.y);
        break;
      case 'use': {
        const s = m.s | 0;
        if (s < 0 || s >= SLOTS) break;
        if (Number.isFinite(m.a)) p.aim = m.a;
        if (Number.isFinite(m.x) && Number.isFinite(m.y)) { p.aimX = m.x; p.aimY = m.y; }
        if (m.on) { p.held.add(s); this.useSlot(p, s, true); } else p.held.delete(s);
        break;
      }
      case 'q': { const s = m.s | 0; if (s >= 0 && s < SLOTS && p.belt[s]) { aim(); p.queued = s; } break; }
      case 'unlock': {
        const why = unlockCheck(p.unlocked, m.id, p.tier);
        if (why) { this.say(p, why); break; }
        p.unlocked.push(m.id); p.dirty = true; this.sendProf(p);
        this.send(p, { t: 'toast', m: `Unlocked ${TOOLS[m.id].name}. Equip it in Hanbin Haven or one of your castles.` });
        break;
      }
      case 'belt': {
        const s = m.s | 0;
        if (s < 0 || s >= SLOTS) break;
        if (!this.canManage(p)) { this.say(p, 'You can only change your toolbelt in Hanbin Haven or a castle your faction holds.'); break; }
        if (m.id === null) p.belt[s] = null;
        else if (typeof m.id === 'string' && TOOLS[m.id] && owns(p.unlocked, m.id)) { const prev = p.belt.indexOf(m.id); if (prev >= 0) p.belt[prev] = p.belt[s]; p.belt[s] = m.id; }
        else break;
        p.held.delete(s); p.dirty = true; this.sendProf(p);
        break;
      }
      case 'respec': {
        if (p.dead || !inSafe(p)) { this.say(p, 'Respec only works in Hanbin Haven.'); break; }
        if (!p.unlocked.length) { this.say(p, 'You have no unlocks to reset.'); break; }
        const cost = Math.floor(p.soma * RESPEC_COST);
        p.soma -= cost; p.tier = tierOf(p.soma); p.unlocked = []; p.belt = this.cleanBelt(p, START_BELT);
        p.dirty = true; this.sendProf(p);
        this.send(p, { t: 'toast', m: `Respec done: all keys returned for ${cost} soma.` });
        break;
      }
      case 'respawn': this.respawn(p, m.at); break;
      case 'travel': {
        if (p.dead) break;
        if (p.rank < RANK.travel) { this.say(p, 'Quick travel needs the rank of Marshall.'); break; }
        if (m.id === 'haven') { this.startChannel(p, { kind: 'haven' }, 'Travelling to Hanbin Haven', QUICK_TRAVEL_MS, true); break; }
        const c = this.castles.find((k) => k.id === (m.id | 0));
        if (!c || !p.fac || c.owner !== p.fac) { this.say(p, 'You can only travel to castles your faction holds.'); break; }
        this.startChannel(p, { kind: 'castle', id: c.id }, `Travelling to ${c.name}`, QUICK_TRAVEL_MS, true);
        break;
      }
      case 'rally': {
        if (p.dead || p.rank < RANK.rally) { this.say(p, 'Rally to needs the rank of Lord.'); break; }
        if (this.T < (p.rallyAt || 0)) { this.say(p, 'You called a rally less than a minute ago.'); break; }
        p.rallyAt = this.T + 60000;
        for (const o of this.players.values()) if (o !== p && o.fac === p.fac && !o.dead) this.send(o, { t: 'rally', id: p.id, n: p.name });
        this.send(p, { t: 'toast', m: 'Your faction has been called to you.' });
        break;
      }
      case 'join_rally': {
        const o = this.players.get(m.id | 0);
        if (!o || o.fac !== p.fac || p.dead || o.rank < RANK.rally) break;
        this.startChannel(p, { kind: 'player', id: o.id }, `Rallying to ${o.name}`, QUICK_TRAVEL_MS, true);
        break;
      }
      case 'chat': {
        if (this.T - p.lastChat < 700) break;
        const txt = String(m.m || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120);
        if (!txt) break;
        p.lastChat = this.T;
        if (txt.startsWith('/f ')) {
          if (p.rank < RANK.facChat) { this.say(p, 'Faction chat needs the rank of Herald.'); break; }
          const o = JSON.stringify({ t: 'chat', n: p.name, f: p.fac, m: txt.slice(3), sc: 'f' });
          for (const q of this.players.values()) if (q.fac === p.fac) this.send(q, o);
        } else if (txt.startsWith('/w ')) {
          if (p.rank < RANK.world) { this.say(p, 'World chat needs the rank of Lord.'); break; }
          this.broadcast({ t: 'chat', n: p.name, f: p.fac || 0, m: txt.slice(3), sc: 'w' });
        } else {
          // Local chat: heard within 900. It also carries orders to troops.
          const o = JSON.stringify({ t: 'chat', n: p.name, f: p.fac || 0, m: txt, sc: 'l' });
          for (const q of this.players.values()) if (!q.dead && Math.hypot(q.x - p.x, q.y - p.y) < 900) this.send(q, o);
          if (!p.dead) this.order(p, txt);
        }
        break;
      }
      case 'fc': this.createFaction(p, m.n); break;
      case 'fjc': this.joinByCode(p, m.code); break;
      case 'fl': this.leaveFaction(p); break;
      case 'frn': this.renameFaction(p, m.n); break;
      case 'fcol': this.recolourFaction(p, m.c); break;
      case 'fortify': this.fortify(p, m.id); break;
    }
  }

  // ---------------------------------------------------------------- main loop
  tick() {
    const T = this.T = this.now(); this.tickNo++;
    this.gridBuild();
    if (this.timers.length) {
      const due = [], rest = [];
      for (const t of this.timers) (t.at <= T ? due : rest).push(t);
      this.timers = rest;
      due.sort((a, b) => a.at - b.at);
      for (const t of due) if (!t.e.dead && (!t.e.isPlayer || this.players.has(t.e.id)) && (t.e.isPlayer || this.npcs.has(t.e.id))) t.fn();
    }
    const live = [...this.players.values()].filter((p) => !p.dead);
    for (const p of [...this.players.values()]) this.updatePlayer(p);
    for (const n of [...this.npcs.values()]) {
      if (n.dead) continue;
      const awake = n.owner || live.some((p) => Math.abs(p.x - n.x) < 1400 && Math.abs(p.y - n.y) < 1000);
      this.updateNpc(n, awake);
    }
    this.updateProjs();
    this.updateZones();
    this.updateCastles();
    if (this.tickNo % 20 === 0) this.updateLogs();
    if (T >= this.nextDungeonCheck) { this.nextDungeonCheck = T + 2000; this.updateDungeons(); }
    if (T >= this.nextSpawnT) {
      this.nextSpawnT = T + 300;
      for (let i = 0; i < this.wildCount.length; i++) if (this.wildCount[i] < this.wildCap[i]) { this.spawnWild(i); break; }
    }
    if (T >= this.nextTax) { this.nextTax = T + 60000; this.payTaxes(); }
    for (const [id, l] of this.loot) if (T > l.until) this.loot.delete(id);
    for (const p of this.players.values()) if (p.out) this.send(p, this.snapshot(p));
    this.fxq = [];
    if (T >= this.nextMeta) {
      this.nextMeta = T + 1000;
      this.broadcast({ t: 'meta', ...this.metaObj() });
      for (const p of this.players.values()) if (p.out) this.radar(p);
    }
    if (this.tickNo % 600 === 0) for (const [k, v] of this.recentKills) if (v < T) this.recentKills.delete(k);
  }
}
