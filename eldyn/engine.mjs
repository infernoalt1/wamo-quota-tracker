// Hanbin Island: the authoritative game simulation. It knows nothing about sockets or databases;
// the server feeds it players and messages and persists what it reports.
import {
  WORLD, VILLAGE, REGIONS, CASTLES, CASTLE_TYPES, SANCTUARY, REGION_CELLS, RC, GW, SKILLS, MOBS, WILD_BY_BIOME, ELITE_AFFIXES, VALOR_CAP, FREE_SKILLS, TREE_OF,
  DUNGEONS, CAVES, RELICS, RELIC_LIST, RARITIES, MAX_RELIC_LV, MAX_STASH, CRATES, CASTLE_LEVEL_COST, CASTLE_TAX,
  rankOf, tierOf, slotsForTier, relicSlotsForTier, relicValue, garrisonFor, inCastle, inCastleWalls, moveBody, freeAt, shotBlocked, losClear,
  rankBonus, RECALL_RANK, TRAVEL_RANK, AURA_RANK, ISLAND_REGIONS, dungeonAt, somaForTier,
} from './shared.mjs';

const { W } = WORLD;
export const TICK = 50, DT = TICK / 1000;
export const CAPTURE_TIME = 10;
const VIEW_W = 1100, VIEW_H = 700;
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
export const factionNameOk = (n) => /^[\p{L}\p{N} _\-']{3,16}$/u.test(n);

// ---------------------------------------------------------------- seasons
// Season 2 (relics, dungeons, the big island) started everyone fresh. Players from before keep a
// Veteran badge, a small head start (10% of their old soma, at most tier 5) and 300 gold; their old
// progress is kept untouched under `legacy`. New players earn double soma until tier 5 to catch up.
export const SEASON = 2, FRESH_TIERS = 5;
export function migrateProgress(pr) {
  if (pr.season === SEASON) return { progress: pr, note: null };
  const oldSoma = Math.max(0, pr.soma | 0), played = oldSoma > 0 || (pr.valor | 0) > 0;
  const progress = { season: SEASON, soma: Math.min(Math.round(oldSoma * 0.1), somaForTier(FRESH_TIERS)), fac: pr.fac || 0, bank: played ? 300 : 0 };
  if (!played) return { progress, note: null };
  progress.vet = 1;
  progress.legacy = { season: pr.season || 1, soma: oldSoma, valor: pr.valor | 0, skills: pr.skills || [], hotbar: pr.hotbar || [] };
  return { progress, note: `Season ${SEASON} has begun and everyone starts fresh. As a veteran you keep the ★ badge, a head start of ${progress.soma} soma and 300 gold for relic crates. Your old record (${oldSoma} soma) is saved.` };
}

export class Game {
  constructor({ world = {}, now = () => Date.now() } = {}) {
    this.now = now; this.T = now(); this.tickNo = 0; this.idc = 0;
    this.players = new Map(); this.npcs = new Map(); this.loot = new Map();
    this.projs = []; this.zones = []; this.fxq = []; this.recentKills = new Map();
    this.factions = {}; this.nextFac = world.nextFac || 1;
    for (const [id, f] of Object.entries(world.factions || {})) this.factions[id] = { ...f, members: [...(f.members || [])] };
    this.worldDirty = world.season !== SEASON;
    this.castles = CASTLES.map((c) => {
      // A new season returns every castle to the bandits; factions themselves carry over.
      const saved = world.season === SEASON && world.castles && world.castles[c.id];
      const ownerId = typeof saved === 'object' && saved ? saved.o : saved;
      const owner = ownerId && this.factions[ownerId] ? +ownerId : 0;
      const level = owner && typeof saved === 'object' ? clamp(saved.l | 0, 1, 3) : 1;
      return { ...c, owner, level, slots: garrisonFor(c.type, c.danger, level).map(() => null), prog: { fac: 0, t: 0 }, calm: 99, nextSpawn: 0, def: 0 };
    });
    this.wildCount = REGIONS.map(() => 0);
    this.wildCap = REGIONS.map((r) => (r.id === SANCTUARY || r.dungeon !== undefined ? 0 : clamp(Math.round((REGION_CELLS[r.id].length * RC * RC) / 400000), 8, 30)));
    for (const c of this.castles) this.spawnGarrison(c);
    for (const r of REGIONS) for (let k = 0; k < this.wildCap[r.id]; k++) this.spawnWild(r.id, true);
    this.dungeons = DUNGEONS.map((d) => ({ d, packs: [], boss: null, bossAt: 0 }));
    for (const ds of this.dungeons) this.populateDungeon(ds);
    this.grid = new Map(); this.nextMeta = 0; this.nextSpawnT = 0; this.nextTax = this.T + 60000; this.nextDungeonCheck = 0;
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
  // The player whose relics apply to this hit: the player themself, or their projectile/zone. Not their summons.
  relicOwner(src) {
    if (src.isPlayer) return src;
    if (src.isStub) { const e = this.players.get(src.from); if (e) return e; }
    return null;
  }
  dmgMulOf(e) {
    let m = e.dmgMul || 1;
    if (this.T < e.weakUntil) m *= 0.6;
    if (this.T < e.buffUntil) m *= 1.3;
    if (this.T < e.auraUntil) m *= 1.1;
    if (e.elite === 'frenzied' && e.hp < e.maxhp * 0.5) m *= 1.5;
    if (e.enraged) m *= 1.3;
    return m;
  }
  speedOf(e) {
    if (this.T < e.stunUntil) return 0;
    let s = e.isPlayer ? 190 * e.mods.speed : e.def.spd * (e.elite === 'swift' ? 1.4 : 1) * (e.enraged ? 1.25 : 1);
    if (this.T < e.slowUntil) s *= e.slowF;
    if (this.T < e.buffUntil) s *= 1.2;
    return s;
  }
  stun(e, ms) { if (e.stunUntil !== undefined && e.kind !== 'banner') e.stunUntil = Math.max(e.stunUntil, this.T + (e.def && e.def.boss ? ms * 0.35 : ms)); }
  weaken(e, ms) { if (e.weakUntil !== undefined) e.weakUntil = Math.max(e.weakUntil, this.T + ms); }
  slow(e, f, ms) { if (e.slowUntil === undefined) return; if (e.def && e.def.boss) f = 1 - (1 - f) * 0.5; e.slowF = this.T < e.slowUntil ? Math.min(e.slowF, f) : f; e.slowUntil = Math.max(e.slowUntil, this.T + ms); }
  // Knockback (or pull, with a negative-facing angle). A foe stopped short by a wall or rock takes a Wall Slam.
  knock(e, ang, d, src) {
    if (e.kind === 'banner' || e.dead || e.hp <= 0 || d <= 0) return;
    if (e.def && e.def.boss) d *= 0.25;
    const ox = e.x, oy = e.y;
    [e.x, e.y] = moveBody(e.x, e.y, e.r, Math.cos(ang) * d, Math.sin(ang) * d);
    if (e.isPlayer) e.tp++;
    if (src && d >= 40 && Math.hypot(e.x - ox, e.y - oy) < d * 0.6) {
      this.combo(e, 'WALL SLAM');
      this.stun(e, 1000);
      this.dealDamage(src, e, 20 + d * 0.15, { parryable: false });
    }
  }
  combo(e, txt) {
    if (this.T < (e.comboAt || 0)) return;
    e.comboAt = this.T + 350;
    this.fx({ t: 'combo', x: e.x, y: e.y - 34, txt });
  }
  cancelChannel(p, why) { if (!p.channel) return; p.channel = null; this.send(p, { t: 'toast', m: why }); }
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
  hostileNear(src, x, y, r) { return this.near(x, y, r).filter((e) => this.hostile(src, e) && !inSafe(e) && e.kind !== 'banner'); }
  alliesNear(p, x, y, r) { return this.near(x, y, r).filter((e) => this.teamOf(e) === this.teamOf(p) && e.kind !== 'banner'); }

  // ---------------------------------------------------------------- damage
  // o: premul (already scaled), parryable, melee, ranged, el ('fire' | 'blast' | 'burn'), secondary (splash/chain/burn: no further procs)
  dealDamage(src, tgt, amt, o = {}) {
    const T = this.T;
    if (!src || tgt.dead || tgt.hp <= 0) return 0;
    if (inSafe(tgt) || (!src.isStub && inSafe(src))) return 0;
    if (!this.hostile(src, tgt)) return 0;
    if (!o.premul) amt *= this.dmgMulOf(src);
    if (o.parryable !== false && !o.secondary && (T < tgt.parryUntil || T < tgt.counterUntil)) {
      if (T < tgt.parryUntil) tgt.parryUntil = 0;
      const atk = src.isStub ? this.getEnt(src.from) : src;
      if (atk && atk.stunUntil !== undefined && dist(atk, tgt) < 400) { this.stun(atk, 1000); this.weaken(atk, 4000); }
      tgt.riposteUntil = T + 2500;
      this.fx({ t: 'parry', x: tgt.x, y: tgt.y });
      return 0;
    }
    const atk = this.relicOwner(src), rel = atk && atk.rel;
    let crit = false;
    if (rel && !o.secondary) {
      const d = Math.hypot(tgt.x - atk.x, tgt.y - atk.y);
      if (rel.close && d <= 130 + tgt.r) amt *= 1 + rel.close;
      if (rel.far && d >= 320) amt *= 1 + rel.far;
      if (rel.execute && tgt.hp < tgt.maxhp * 0.3) amt *= 1 + rel.execute;
      if (rel.berserk) amt *= 1 + rel.berserk * (1 - atk.hp / atk.maxhp);
      if (rel.momentum) amt *= 1 + Math.min(rel.momentum, atk.moveTime * 0.04);
      if (rel.chill && T < tgt.slowUntil) amt *= 1 + rel.chill;
      if (rel.crit && Math.random() < rel.crit) { amt *= 1.75; crit = true; }
    }
    const summonOwner = src.isNpc && src.owner ? this.players.get(src.owner) : null;
    if (summonOwner && summonOwner.rel.summon) amt *= 1 + summonOwner.rel.summon;
    // skill combos
    if (o.el === 'fire' && T < tgt.chillUntil) { amt *= 1.6; tgt.chillUntil = 0; this.combo(tgt, 'SHATTER'); }
    if (o.el === 'fire' && T < tgt.poisonUntil) {
      tgt.poisonUntil = 0; this.combo(tgt, 'IGNITE'); amt += 30;
      const st = src.isStub ? src : this.mkStub(src);
      this.fx({ t: 'boom', x: tgt.x, y: tgt.y, r: 110 });
      for (const e of this.near(tgt.x, tgt.y, 110)) if (e !== tgt && this.teamOf(e) !== st.team) this.dealDamage(st, e, 30, { parryable: false, premul: true, el: 'blast', secondary: true });
      if (tgt.dead || tgt.hp <= 0) return 0;
    }
    if (o.melee && T < tgt.stunUntil) { amt *= 1.35; this.combo(tgt, 'CRUSH'); }
    if (o.ranged && T < tgt.rootUntil) { amt *= 2; this.combo(tgt, 'PINNED'); }
    if (T < tgt.weakUntil) amt *= 1.15;
    if (T < tgt.markUntil && this.teamOf(src) === tgt.markTeam) amt *= 1.2;
    // defences
    if (tgt.isPlayer) {
      if (tgt.channel) this.cancelChannel(tgt, 'Teleport interrupted!');
      if (tgt.rel.dr) amt *= 1 - Math.min(0.5, tgt.rel.dr);
      if (tgt.mods.lastStand && tgt.hp < tgt.maxhp * 0.3) amt *= 0.65;
    } else {
      if (tgt.def.armor) amt *= 1 - tgt.def.armor;
      if (tgt.elite === 'armored') amt *= 0.6;
    }
    if (T < tgt.shieldUntil) amt *= 0.4;
    amt = Math.round(amt);
    if (amt <= 0) return 0;
    if (tgt.isPlayer && tgt.hp - amt <= 0 && tgt.rel.phoenix && T >= (tgt.phoenixAt || 0)) {
      tgt.phoenixAt = T + 180000; tgt.hp = Math.round(tgt.maxhp * tgt.rel.phoenix);
      this.combo(tgt, 'REBORN'); this.fx({ t: 'boom', x: tgt.x, y: tgt.y, r: 170, big: 1 });
      for (const e of this.hostileNear(tgt, tgt.x, tgt.y, 170)) this.dealDamage(tgt, e, 90, { parryable: false, el: 'fire', secondary: true });
      return 0;
    }
    tgt.hp -= amt;
    tgt.lastHit = this.rootOwner(src); tgt.lastHitAt = T;
    this.fx({ t: 'dmg', x: tgt.x, y: tgt.y - 10, v: amt, c: crit ? 1 : 0 });
    if (crit) this.combo(tgt, 'CRIT');
    // on-hit effects from the attacker
    if (o.melee && tgt.isPlayer && tgt.rel.thorns && !src.isStub && src.hp > 0) this.dealDamage(tgt, src, amt * tgt.rel.thorns, { parryable: false, premul: true, secondary: true });
    if (src.isNpc) {
      if (src.def.onHit === 'drain' || src.elite === 'vampiric') src.hp = Math.min(src.maxhp, src.hp + amt * 0.35);
      if (src.def.onHit === 'poison') this.applyDot(tgt, 'venom', src.def.dmg * 0.9, this.mkStub(src));
      if (src.def.onHit === 'slow') this.slow(tgt, 0.6, 1500);
    }
    if (rel) this.onHitRelics(atk, tgt, amt, o.secondary ? rel.echo || 0 : 1, !!o.secondary);
    if (summonOwner && summonOwner.rel.summon) {
      if (summonOwner.rel.lifesteal) src.hp = Math.min(src.maxhp, src.hp + amt * summonOwner.rel.lifesteal);
      if (summonOwner.rel.burn) this.applyDot(tgt, 'burn', amt * summonOwner.rel.burn, this.mkStub(src));
    }
    if (tgt.isNpc && !tgt.target && !tgt.returning) tgt.target = src.isStub ? src.from : src.id;
    if (tgt.hp <= 0) (tgt.isPlayer ? this.killPlayer(tgt, T - tgt.lastHitAt < 8000 ? tgt.lastHit : null) : this.killNpc(tgt, tgt.lastHit));
    return amt;
  }
  // Relic effects that fire on each hit. Secondary hits (splash, chain, burn...) only do so with Prism of Echoes,
  // and never set off further splash, chain or novas, so nothing can cascade forever.
  onHitRelics(p, tgt, amt, k, secondary) {
    const rel = p.rel;
    if (k <= 0) return;
    if (rel.lifesteal) p.hp = Math.min(p.maxhp, p.hp + amt * rel.lifesteal * k);
    if (rel.burn) this.applyDot(tgt, 'burn', amt * rel.burn * k, this.mkStub(p));
    if (rel.chill) this.slow(tgt, 0.7, 1200);
    if (rel.pull && !tgt.dead && tgt.hp > 0) {
      const d = dist(tgt, p), pull = Math.min(rel.pull * k, d - 34 - tgt.r);
      if (pull > 2) this.knock(tgt, Math.atan2(p.y - tgt.y, p.x - tgt.x), pull);
    }
    if (secondary) return;
    const st = this.mkStub(p);
    if (rel.splash) {
      const others = this.hostileNear(p, tgt.x, tgt.y, 95).filter((e) => e !== tgt);
      if (others.length) this.fx({ t: 'ring', x: tgt.x, y: tgt.y, r: 95, c: '#ffb070' });
      for (const e of others) this.dealDamage(st, e, amt * rel.splash, { parryable: false, premul: true, secondary: true });
    }
    if (rel.chain && Math.random() < rel.chain) {
      const arcs = this.hostileNear(p, tgt.x, tgt.y, 230).filter((e) => e !== tgt).sort((a, b) => dist(a, tgt) - dist(b, tgt)).slice(0, 2);
      if (arcs.length) this.fx({ t: 'bolt', x: tgt.x, y: tgt.y, pts: [[rd(tgt.x), rd(tgt.y)], ...arcs.map((e) => [rd(e.x), rd(e.y)])] });
      for (const e of arcs) this.dealDamage(st, e, amt * 0.5, { parryable: false, premul: true, secondary: true });
    }
    if (rel.nova && ++p.hitCount % 8 === 0) {
      this.fx({ t: 'ring', x: tgt.x, y: tgt.y, r: 130, c: '#7fd8ff', fill: 1 });
      for (const e of this.hostileNear(p, tgt.x, tgt.y, 130)) this.dealDamage(st, e, rel.nova * p.dmgMul, { parryable: false, premul: true, secondary: true });
    }
  }
  // Burning (relic) and venom (scorpions) tick every half second for 3 seconds; a stronger application replaces a weaker one.
  applyDot(e, kind, total, stub) {
    if (e.dead || total < 1) return;
    const cur = e[kind], dps = total / 3;
    if (cur && this.T < cur.until && cur.dps > dps) { cur.until = this.T + 3000; return; }
    e[kind] = { until: this.T + 3000, dps, stub, next: this.T + 500 };
  }
  tickStatus(e) {
    const T = this.T;
    if (T < e.regenUntil) e.hp = Math.min(e.maxhp, e.hp + e.regenRate * DT);
    for (const kind of ['burn', 'venom']) {
      const d = e[kind];
      if (!d) continue;
      if (T >= d.until) { e[kind] = null; continue; }
      if (T >= d.next) { d.next += 500; this.dealDamage(d.stub, e, d.dps * 0.5, { parryable: false, premul: true, secondary: true, el: 'burn' }); if (e.dead) return; }
    }
  }

  // ---------------------------------------------------------------- rewards, loot & death
  gain(p, v, s, g = 0) {
    if (!p || !p.isPlayer) return;
    const oldTier = p.tier, oldRank = rankOf(p.valor).idx;
    p.valor = Math.min(VALOR_CAP, p.valor + v);
    if (p.tier < FRESH_TIERS) s *= 2; // newcomers earn double soma until tier 5
    p.soma += s; p.gold += g; p.dirty = true;
    if (v || s || g) this.send(p, { t: 'gain', v, s, g });
    const nt = tierOf(p.soma);
    if (nt !== p.tier) {
      p.tier = nt; this.recalc(p);
      if (nt > oldTier) {
        p.hp = p.maxhp;
        const extra = [slotsForTier(nt) > slotsForTier(oldTier) ? 'a new hotbar slot' : '', relicSlotsForTier(nt) > relicSlotsForTier(oldTier) ? 'a new relic slot' : ''].filter(Boolean).join(' and ');
        this.send(p, { t: 'toast', m: `Soma tier ${nt}! +1 skill point${extra ? ' and ' + extra : ''}.` });
      }
      this.sendProf(p);
    }
    const nr = rankOf(p.valor).idx;
    if (nr !== p.rank) { this.recalc(p); this.sendProf(p); }
    if (nr > oldRank) {
      this.send(p, { t: 'toast', m: `You are now a ${rankOf(p.valor).name}!` });
      if (nr >= 3) this.broadcast({ t: 'msg', m: `${p.name} has risen to the rank of ${rankOf(p.valor).name}.`, c: '#e0b84f' });
    }
  }
  award(killer, v, s, g) {
    this.gain(killer, v, s, g);
    if (killer && killer.fac) for (const o of this.players.values())
      if (o !== killer && !o.dead && o.fac === killer.fac && dist(o, killer) < 700) this.gain(o, 0, Math.ceil(s * 0.35));
  }
  rollRarity(n) {
    const r = Math.random(), danger = n.danger || 1;
    if (n.def.boss) return r < 0.1 ? 'legendary' : r < 0.55 ? 'epic' : 'rare';
    if (n.elite) return r < 0.06 + 0.02 * danger ? 'epic' : r < 0.5 ? 'rare' : 'common';
    return r < 0.008 * danger ? 'epic' : r < 0.22 ? 'rare' : 'common';
  }
  randomRelic(rarity) { const pool = RELIC_LIST.filter((r) => r.rarity === rarity); return { k: pool[Math.floor(Math.random() * pool.length)].id, lv: 1 }; }
  dropLoot(x, y, o) {
    const id = this.nid();
    this.loot.set(id, { id, x: x + rnd(-14, 14), y: y + rnd(-14, 14), gold: o.gold || 0, relic: o.relic || null, owner: o.owner || null, ownerUntil: this.T + 30000, until: this.T + 180000 });
  }
  killNpc(n, killer, silent) {
    if (n.dead) return;
    n.dead = true; this.npcs.delete(n.id);
    if (n.castle >= 0) { const c = this.castles.find((k) => k.id === n.castle); if (c && c.slots[n.slot] === n.id) c.slots[n.slot] = null; }
    if (n.region >= 0) this.wildCount[n.region]--;
    if (n.master) { const m = this.npcs.get(n.master); if (m && m.minions) m.minions.delete(n.id); }
    this.fx({ t: 'poof', x: n.x, y: n.y });
    if (n.elite === 'volatile') this.zones.push({ type: 'blast', x: n.x, y: n.y, r: 120, at: this.T + 900, d: 900, dmg: n.def.dmg * 2 * n.dmgMul, team: n.team, stub: this.mkStub(n) });
    if (silent || !killer || n.owner || n.kind === 'banner' || n.minionOf) return;
    const mul = n.elite ? 3 : 1;
    this.award(killer, Math.ceil(n.def.valor * n.sc * mul), Math.ceil(n.def.soma * n.sc * mul), Math.ceil(n.def.gold * n.sc * (n.elite ? 4 : 1)));
    if (killer.rel.healOnKill) this.heal(null, killer, killer.maxhp * killer.rel.healOnKill);
    if (killer.rel.explode) {
      this.fx({ t: 'boom', x: n.x, y: n.y, r: 120 });
      const st = this.mkStub(killer);
      for (const e of this.hostileNear(killer, n.x, n.y, 120)) this.dealDamage(st, e, n.maxhp * killer.rel.explode, { parryable: false, premul: true, secondary: true });
    }
    const chance = n.def.boss ? 1 : n.elite ? 0.22 : 0.0035 * (n.danger || 1);
    if (Math.random() < chance) {
      this.dropLoot(n.x, n.y, { relic: this.randomRelic(this.rollRarity(n)), owner: killer.accountId });
      if (n.def.boss) { this.dropLoot(n.x, n.y, { relic: this.randomRelic(this.rollRarity(n)), owner: killer.accountId }); this.dropLoot(n.x, n.y, { gold: n.def.gold, owner: killer.accountId }); }
    }
    if (n.def.boss) this.broadcast({ t: 'msg', m: `⚔ ${killer.name} has slain ${n.def.name}!`, c: '#ffb030' });
  }
  killPlayer(p, killer) {
    if (p.dead) return;
    const T = this.T;
    p.dead = true; p.respawnAt = T + 5000; p.spin = null; p.channel = null; p.burn = null; p.venom = null;
    const wasRank = rankOf(p.valor);
    const lost = Math.floor(p.valor * 0.75);
    p.valor -= lost; p.dirty = true;
    const dropped = Math.floor(p.gold / 2);
    if (dropped > 0) { p.gold -= dropped; this.dropLoot(p.x, p.y, { gold: dropped }); }
    this.recalc(p); this.sendProf(p);
    this.removeSummonsOf(p.id);
    this.send(p, { t: 'died', lost, gold: dropped, by: killer && killer !== p ? killer.name : null });
    if (wasRank.idx === 8) this.broadcast({ t: 'msg', m: `👑 King ${p.name} has fallen${killer && killer !== p ? ' to ' + killer.name : ''}!`, c: '#f0c840' });
    if (killer && killer !== p && this.teamOf(killer) !== this.teamOf(p)) {
      const key = killer.accountId + ':' + p.accountId;
      if ((this.recentKills.get(key) || 0) < T) {
        this.recentKills.set(key, T + 60000);
        this.award(killer, 40 + Math.floor(lost * 0.3), 60 + p.tier * 10, 0);
      }
      this.broadcast({ t: 'msg', m: `${killer.name} slew ${p.name}.`, c: '#c06060' });
    }
  }
  respawn(p) {
    p.dead = false; p.hp = p.maxhp; p.en = p.maxen;
    for (const k of ['stunUntil', 'slowUntil', 'weakUntil', 'buffUntil', 'shieldUntil', 'parryUntil', 'counterUntil', 'regenUntil']) p[k] = 0;
    let sp = null, bd = Infinity;
    if (p.fac) for (const c of this.castles) if (c.owner === p.fac) { const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < bd) { bd = d; sp = c; } }
    const pos = sp ? this.freeSpot(sp.x, sp.y, 100) : this.villageSpot();
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
  removeSummonsOf(pid) { for (const n of [...this.npcs.values()]) if (n.owner === pid) this.killNpc(n, null, true); }
  // Recall (to the village) and fort travel (to a castle the faction holds) take a channel that damage or movement breaks.
  startChannel(p, dest, label) {
    if (p.dead) return;
    p.channel = { until: this.T + p.mods.channel, total: p.mods.channel, dest, label, x: p.x, y: p.y };
    this.send(p, { t: 'toast', m: `${label}... stand still` });
  }
  finishChannel(p) {
    const ch = p.channel; p.channel = null;
    let pos;
    if (ch.dest === 'haven') pos = this.villageSpot();
    else {
      const c = this.castles.find((k) => k.id === ch.dest);
      if (!c || c.owner !== p.fac || !p.fac) return this.say(p, 'Your faction no longer holds that castle.');
      pos = this.freeSpot(c.x, c.y, 100);
    }
    this.teleport(p, pos.x, pos.y);
  }
  teleport(p, x, y) {
    this.fx({ t: 'poof', x: p.x, y: p.y, c: '#6040a0' });
    p.x = x; p.y = y; p.tp++;
    this.fx({ t: 'ring', x, y, r: 60, c: '#c8a0ff', fill: 1 });
    this.removeSummonsOf(p.id);
  }

  // ---------------------------------------------------------------- players
  relicStats(p) {
    const r = {};
    for (const u of p.equip) { const it = p.relics.find((x) => x.u === u); if (it) { const s = RELICS[it.k].stat; r[s] = (r[s] || 0) + relicValue(it.k, it.lv); } }
    return r;
  }
  recalc(p) {
    const has = (id) => p.skills.includes(id);
    p.rank = rankOf(p.valor).idx;
    p.equip = p.equip.slice(0, relicSlotsForTier(p.tier));
    const rb = rankBonus(p.rank), rel = p.rel = this.relicStats(p);
    p.mods = {
      melee: has('heavy_blade') ? 1.15 : 1, ranged: has('eagle_eye') ? 1.15 : 1, range: (has('eagle_eye') ? 1.25 : 1) * (1 + (rel.range || 0)),
      heal: has('alchemist') ? 1.35 : 1, en: (has('alchemist') ? 1.2 : 1) * (has('second_wind') ? 1.15 : 1) * rb.en * (1 + (rel.en || 0)),
      speed: (has('second_wind') ? 1.1 : 1) * rb.speed * (1 + (rel.speed || 0)), lifesteal: has('bloodlust') ? 0.08 : 0, summon: has('inspire') ? 0.3 : 0,
      rally: has('inspire') ? 12000 : 8000, lastStand: has('last_stand'), channel: rb.channel, cd: 1 - Math.min(0.4, rel.cdr || 0), titan: 1 + (rel.titan || 0),
    };
    p.maxhp = Math.round((100 + 6 * p.tier) * rb.hp * (1 + (rel.maxhp || 0))); p.maxen = 100 + 2 * p.tier;
    p.dmgMul = (1 + 0.02 * p.tier) * rb.dmg * (1 + (rel.dmg || 0));
    p.slots = slotsForTier(p.tier); p.rslots = relicSlotsForTier(p.tier);
    p.pts = p.tier + 1 - p.skills.filter((s) => !SKILLS[s].free).length;
    p.hp = Math.min(p.hp, p.maxhp); p.en = Math.min(p.en, p.maxen);
  }
  sendProf(p) {
    this.recalc(p);
    this.send(p, { t: 'prof', skills: p.skills, hotbar: p.hotbar, pts: p.pts, slots: p.slots, tier: p.tier, fac: p.fac || 0, name: p.name, rank: p.rank, maxhp: p.maxhp, dmg: +p.dmgMul.toFixed(2), relics: p.relics, equip: p.equip, rslots: p.rslots, vet: p.vet });
  }
  send(p, obj) { if (p.out) p.out(typeof obj === 'string' ? obj : JSON.stringify(obj)); }
  broadcast(obj) { const s = JSON.stringify(obj); for (const p of this.players.values()) this.send(p, s); }

  // account = { id, username, progress }, out = function(string)
  join(account, out) {
    for (const o of this.players.values()) if (o.accountId === account.id) { this.send(o, { t: 'kicked', m: 'You signed in somewhere else.' }); if (o.onKick) o.onKick(); this.leave(o); }
    const { progress: pr, note } = migrateProgress(account.progress || {});
    const fac = pr.fac && this.factions[pr.fac] && this.factions[pr.fac].members.includes(account.id) ? +pr.fac : 0;
    const skills = [...new Set([...FREE_SKILLS, ...(Array.isArray(pr.skills) ? pr.skills : []).filter((s) => SKILLS[s])])];
    let hotbar = Array.isArray(pr.hotbar) ? pr.hotbar.slice(0, 10) : ['slash', 'arrow'];
    while (hotbar.length < 10) hotbar.push(null);
    hotbar = hotbar.map((s) => (s && skills.includes(s) && !SKILLS[s].passive ? s : null));
    let nu = Math.max(1, pr.nu | 0);
    const relics = (Array.isArray(pr.relics) ? pr.relics : []).filter((r) => r && RELICS[r.k]).slice(0, MAX_STASH).map((r) => ({ u: r.u | 0 || nu++, k: r.k, lv: clamp(r.lv | 0, 1, MAX_RELIC_LV) }));
    const seenU = new Set(); for (const r of relics) { if (seenU.has(r.u)) r.u = nu++; seenU.add(r.u); nu = Math.max(nu, r.u + 1); }
    const kinds = new Set(), equip = [];
    for (const u of Array.isArray(pr.equip) ? pr.equip : []) { const it = relics.find((r) => r.u === u); if (it && !kinds.has(it.k)) { kinds.add(it.k); equip.push(u); } }
    const pos = this.villageSpot();
    const p = {
      id: this.nid(), isPlayer: true, kind: 'player', accountId: account.id, name: account.username, out,
      x: pos.x, y: pos.y, r: 14, ang: 0, wp: 'sword', tp: 0, moveBudget: 0, channel: null,
      valor: clamp(pr.valor | 0, 0, VALOR_CAP), soma: Math.max(0, pr.soma | 0), skills, hotbar, fac,
      gold: Math.max(0, pr.gold | 0), bank: Math.max(0, pr.bank | 0), relics, equip, nu, rel: {},
      tier: 0, hp: 100, en: 100, dead: false, respawnAt: 0, cds: {}, spin: null, hitCount: 0, moveTime: 0, lastMoveAt: 0, pulseAt: 0, portalCd: 0,
      stunUntil: 0, slowUntil: 0, slowF: 1, weakUntil: 0, buffUntil: 0, shieldUntil: 0, parryUntil: 0, counterUntil: 0, riposteUntil: 0, regenUntil: 0, regenRate: 0,
      lastHit: null, lastHitAt: 0, lastChat: 0, dirty: !!note, vet: pr.vet ? 1 : 0, legacy: pr.legacy,
    };
    p.tier = tierOf(p.soma);
    this.recalc(p);
    // Skills beyond the points this tier allows (e.g. after a rebalance) are refunded.
    while (p.pts < 0) { const i = p.skills.findLastIndex((s) => !SKILLS[s].free); p.skills.splice(i, 1); this.recalc(p); }
    p.hotbar = p.hotbar.map((s) => (s && p.skills.includes(s) ? s : null));
    if (p.hotbar[0]) p.wp = WEAPON_OF[TREE_OF[p.hotbar[0]]];
    p.hp = p.maxhp; p.en = p.maxen;
    this.players.set(p.id, p);
    this.send(p, { t: 'welcome', id: p.id });
    this.sendProf(p);
    this.send(p, { t: 'meta', ...this.metaObj() });
    this.send(p, { t: 'msg', m: 'Welcome to Hanbin Island! Press H for help, K for skills, I for relics, F for factions.', c: '#e0b84f' });
    if (note) { this.send(p, { t: 'msg', m: note, c: '#ffd070' }); this.send(p, { t: 'toast', m: `Season ${SEASON} has begun!` }); }
    return p;
  }
  leave(p) {
    if (!this.players.has(p.id)) return;
    this.removeSummonsOf(p.id);
    this.players.delete(p.id);
    for (const z of this.zones) if (z.owner === p.id && z.type === 'trap') z.until = 0;
  }
  progressOf(p) {
    return { season: SEASON, valor: p.valor, soma: p.soma, skills: p.skills, hotbar: p.hotbar, fac: p.fac || 0, gold: p.gold, bank: p.bank, relics: p.relics, equip: p.equip, nu: p.nu, vet: p.vet, legacy: p.legacy };
  }
  worldState() {
    const castles = {};
    for (const c of this.castles) if (c.owner) castles[c.id] = { o: c.owner, l: c.level };
    return { season: SEASON, factions: this.factions, castles, nextFac: this.nextFac };
  }

  // ---------------------------------------------------------------- relics, gold and the shop
  // Relics and castles can be managed in the Haven or inside a castle your faction holds.
  canManage(p) { return inSafe(p) || (p.fac && this.castles.some((c) => c.owner === p.fac && inCastleWalls(c, p.x, p.y))); }
  relicAction(p, m) {
    const item = (u) => p.relics.find((r) => r.u === u);
    if (m.t === 'buy') {
      const crate = CRATES[m.c];
      if (!crate) return;
      if (!inSafe(p)) return this.say(p, 'The relic merchant is in Hanbin Haven.');
      if (p.bank < crate.price) return this.say(p, `You need ${crate.price} banked gold.`);
      if (p.relics.length >= MAX_STASH) return this.say(p, 'Your relic stash is full. Salvage something first.');
      p.bank -= crate.price;
      let r = Math.random(), rarity = crate.odds[0][0];
      for (const [k, w] of crate.odds) { if ((r -= w) <= 0) { rarity = k; break; } }
      const got = { u: p.nu++, ...this.randomRelic(rarity) };
      p.relics.push(got);
      this.send(p, { t: 'relic', r: got, from: crate.name });
    } else {
      if (!this.canManage(p)) return this.say(p, 'Relics can only be changed in Hanbin Haven or a castle your faction holds.');
      if (m.t === 'equip') {
        const it = item(m.u | 0), s = m.s | 0;
        if (!it || s < 0 || s >= p.rslots) return;
        if (p.equip.some((u) => u !== it.u && item(u)?.k === it.k && p.equip.indexOf(u) !== s)) return this.say(p, 'You already have that relic equipped.');
        const slots = Array.from({ length: p.rslots }, (_, i) => p.equip[i] ?? null);
        const prev = slots.indexOf(it.u);
        if (prev >= 0) slots[prev] = slots[s];
        slots[s] = it.u;
        p.equip = slots.filter((u) => u != null);
      } else if (m.t === 'unequip') p.equip = p.equip.filter((u) => u !== (m.u | 0));
      else if (m.t === 'fuse') {
        const it = item(m.u | 0);
        if (!it) return;
        if (it.lv >= MAX_RELIC_LV) return this.say(p, 'That relic is already at its highest level.');
        const twin = p.relics.find((r) => r !== it && r.k === it.k && r.lv === it.lv && !p.equip.includes(r.u));
        if (!twin) return this.say(p, `Fusing needs a second ${RELICS[it.k].name} of the same level (not equipped).`);
        const cost = RARITIES[RELICS[it.k].rarity].fuse * it.lv;
        if (p.bank < cost) return this.say(p, `Fusing costs ${cost} banked gold.`);
        p.bank -= cost; it.lv++;
        p.relics = p.relics.filter((r) => r !== twin);
        this.send(p, { t: 'toast', m: `${RELICS[it.k].name} is now level ${it.lv}!` });
      } else if (m.t === 'salvage') {
        const it = item(m.u | 0);
        if (!it || p.equip.includes(it.u)) return;
        const g = RARITIES[RELICS[it.k].rarity].salvage * it.lv;
        p.relics = p.relics.filter((r) => r !== it); p.bank += g;
        this.send(p, { t: 'toast', m: `Salvaged for ${g} gold` });
      }
    }
    p.dirty = true; this.sendProf(p);
  }
  fortify(p, id) {
    const c = this.castles.find((k) => k.id === (id | 0));
    if (!c || !p.fac || c.owner !== p.fac) return this.say(p, 'Your faction does not hold that castle.');
    if (c.level >= 3) return this.say(p, 'That castle is already fully fortified.');
    const cost = CASTLE_LEVEL_COST[c.level + 1];
    if (p.bank < cost) return this.say(p, `Fortifying costs ${cost} banked gold.`);
    p.bank -= cost; p.dirty = true; c.level++;
    c.slots = garrisonFor(c.type, c.danger, c.level).map((k, i) => c.slots[i] ?? null);
    this.spawnGarrison(c); this.worldDirty = true;
    this.broadcast({ t: 'msg', m: `${p.name} fortified ${c.name} to level ${c.level}.`, c: this.factions[p.fac].color });
    this.broadcast({ t: 'meta', ...this.metaObj() });
  }

  // ---------------------------------------------------------------- factions
  say(p, m) { this.send(p, { t: 'err', m }); }
  createFaction(p, name) {
    if (p.fac) return this.say(p, 'Leave your faction first.');
    name = String(name || '').trim().replace(/\s+/g, ' ');
    if (!factionNameOk(name)) return this.say(p, 'Faction names are 3-16 letters, numbers, spaces, - or \'.');
    if (Object.keys(this.factions).length >= 200) return this.say(p, 'Too many factions exist.');
    if (Object.values(this.factions).some((f) => f.name.toLowerCase() === name.toLowerCase())) return this.say(p, 'That faction name is taken.');
    const id = this.nextFac++;
    const used = new Set(Object.values(this.factions).map((f) => f.color));
    const color = FAC_COLORS.find((c) => !used.has(c)) || FAC_COLORS[(id - 1) % FAC_COLORS.length];
    this.factions[id] = { id, name, color, leader: p.accountId, leaderName: p.name, members: [p.accountId] };
    p.fac = id; p.dirty = true; this.worldDirty = true; this.sendProf(p);
    this.broadcast({ t: 'meta', ...this.metaObj() });
    this.broadcast({ t: 'msg', m: `${p.name} founded the faction ${name}!`, c: color });
  }
  joinFaction(p, id) {
    const f = this.factions[id];
    if (!f) return this.say(p, 'That faction no longer exists.');
    if (p.fac) return this.say(p, 'Leave your faction first.');
    if (f.members.length >= 100) return this.say(p, 'That faction is full.');
    if (!f.members.includes(p.accountId)) f.members.push(p.accountId);
    p.fac = +id; p.dirty = true; this.worldDirty = true; this.sendProf(p);
    for (const n of this.npcs.values()) if (n.owner === p.id) n.target = null;
    this.broadcast({ t: 'meta', ...this.metaObj() });
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
    this.broadcast({ t: 'meta', ...this.metaObj() });
  }
  disbandFaction(id) {
    const f = this.factions[id];
    if (!f) return;
    for (const c of this.castles) if (c.owner === +id) { c.owner = 0; c.level = 1; this.clearGarrison(c); c.slots = garrisonFor(c.type, c.danger, 1).map(() => null); c.calm = 99; }
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
      team: o.team || 'wild', home: { x, y }, leash: o.leash || 550, owner: o.owner || null, ttl: o.ttl || 0, danger: o.danger || 1,
      castle: o.castle ?? -1, slot: o.slot ?? -1, region: o.region ?? -1, fac: o.fac || 0, dmgMul: 1 + (sc - 1) * 0.5, master: o.master || 0, minionOf: o.minionOf || 0,
      stunUntil: 0, slowUntil: 0, slowF: 1, weakUntil: 0, buffUntil: 0, shieldUntil: 0, parryUntil: 0, counterUntil: 0, riposteUntil: 0, regenUntil: 0, regenRate: 0,
      target: null, nextAtk: 0, nextScan: 0, nextSkill: 0, wanderT: 0, wp: null, returning: false, lastHit: null, lastHitAt: 0, detour: 0, detourUntil: 0,
    };
    if (o.elite) { n.elite = o.elite; n.hp = n.maxhp = n.maxhp * 2.5; n.dmgMul *= 1.25; n.r = Math.round(n.r * 1.15); }
    this.npcs.set(n.id, n);
    return n;
  }
  eliteRoll(danger) {
    if (Math.random() > 0.04 + danger * 0.015) return null;
    const keys = Object.keys(ELITE_AFFIXES);
    return keys[Math.floor(Math.random() * keys.length)];
  }
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
        this.mkNpc(kind, s.x, s.y, { sc: 1 + 0.22 * (danger - 1), region: ri, leash: 600, danger, elite });
        this.wildCount[ri]++;
      }
      return;
    }
  }
  spawnGuard(c, i) {
    const L = CASTLE_TYPES[c.type], kind = garrisonFor(c.type, c.danger, c.level)[i];
    const span = kind === 'captain' && i === 0 ? L.inner - 30 : L.rings[0][0] - L.rings[0][1] - 34;
    let x = c.x, y = c.y + L.inner - 40;
    for (let t = 0; t < 40; t++) {
      const px = c.x + rnd(-span, span), py = c.y + rnd(-span, span);
      if (freeAt(px, py, 22)) { x = px; y = py; break; }
    }
    const sc = (1 + 0.22 * (c.danger - 1)) * (1 + 0.2 * (c.level - 1));
    const n = this.mkNpc(kind, x, y, { sc, team: c.owner ? 'f:' + c.owner : 'wild', fac: c.owner || 0, castle: c.id, slot: i, leash: 420, danger: c.danger });
    c.slots[i] = n.id;
  }
  spawnGarrison(c) { for (let i = 0; i < c.slots.length; i++) if (!c.slots[i] || !this.npcs.has(c.slots[i])) this.spawnGuard(c, i); }
  clearGarrison(c) { for (let i = 0; i < c.slots.length; i++) { const n = this.npcs.get(c.slots[i]); if (n) this.killNpc(n, null, true); c.slots[i] = null; } }
  // Dungeons: packs in every room but the first, a boss in the last. Cleared rooms refill after 3 minutes without visitors.
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
      const kind = pickWeighted(d.mobs), s = this.freeSpot(room.x, room.y, Math.min(room.w, room.h) * 30);
      const npc = this.mkNpc(kind, s.x, s.y, { sc: 1 + 0.22 * (d.danger - 1) + 0.15, leash: 520, danger: d.danger + 1, elite: i === 0 ? this.eliteRoll(d.danger + 2) : null });
      npc.dungeon = d.id;
      pack.ids.push(npc.id);
    }
    pack.emptyAt = 0;
  }
  spawnBoss(ds) {
    const room = ds.d.rooms[ds.d.rooms.length - 1];
    const b = this.mkNpc(ds.d.boss, room.x, room.y, { leash: 700, danger: ds.d.danger + 2 });
    b.dungeon = ds.d.id; b.minions = new Set();
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
    if (d < 1) return;
    const step = Math.min(d, spd * DT), base = Math.atan2(dy, dx);
    const tryAng = (a) => {
      const [nx, ny] = moveBody(n.x, n.y, n.r, Math.cos(a) * step, Math.sin(a) * step);
      return { nx, ny, prog: (nx - n.x) * Math.cos(base) + (ny - n.y) * Math.sin(base), moved: Math.hypot(nx - n.x, ny - n.y) };
    };
    if (this.T < n.detourUntil) { const r = tryAng(base + n.detour); if (r.moved > step * 0.5) { n.x = r.nx; n.y = r.ny; return; } }
    let r = tryAng(base);
    if (r.prog < step * 0.4) for (const off of [0.8, -0.8, 1.5, -1.5]) { const r2 = tryAng(base + off); if (r2.moved > step * 0.5) { r = r2; n.detour = off; n.detourUntil = this.T + 600; break; } }
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
  // A ground blast that warns first (red circle), then hits everyone on the other side inside it.
  blast(n, x, y, r, delay, dmg, extra = {}) {
    this.zones.push({ type: 'blast', x, y, r, at: this.T + delay, d: delay, dmg: dmg * this.dmgMulOf(n), team: this.teamOf(n), stub: this.mkStub(n), ...extra });
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
      case 'barrage': for (let i = 0; i < 16; i++) this.fireProj(n, (i / 16) * Math.PI * 2 + T / 900, { speed: 360, dmg: def.dmg * 0.7, life: 1.6, kind: proj }); break;
      case 'summon': this.summonMinions(n, def.minion, 4, 8); break;
      case 'leap': this.blast(n, tgt.x, tgt.y, 130, 900, def.dmg * 1.8, { mover: n.id }); break;
      case 'web': this.zones.push({ type: 'web', x: tgt.x, y: tgt.y, r: 150, until: T + 6000, d: 6000, next: T, every: 250, team: this.teamOf(n), stub: this.mkStub(n) }); break;
      case 'nova': for (const p of this.hostileNear(n, n.x, n.y, 700)) if (p.isPlayer) this.blast(n, p.x, p.y, 120, 1100, def.dmg * 1.6, { el: proj === 'fire' ? 'fire' : null, slow: proj === 'frost' }); break;
      case 'meteor': for (let i = 0; i < 4; i++) this.blast(n, tgt.x + rnd(-160, 160), tgt.y + rnd(-160, 160), 120, 1300 + i * 200, def.dmg * 2, { el: 'fire' }); break;
      case 'blink': {
        const a = Math.atan2(n.y - tgt.y, n.x - tgt.x) + Math.PI, s = this.freeSpot(tgt.x + Math.cos(a) * 70, tgt.y + Math.sin(a) * 70, 40);
        this.fx({ t: 'poof', x: n.x, y: n.y, c: '#402060' }); n.x = s.x; n.y = s.y; n.nextAtk = T;
        break;
      }
    }
  }
  updateNpc(n, awake) {
    const T = this.T;
    if (n.ttl && T > n.ttl) return this.killNpc(n, null, true);
    this.tickStatus(n);
    if (n.dead) return;
    if (n.def.regen) n.hp = Math.min(n.maxhp, n.hp + n.maxhp * n.def.regen * DT);
    if (n.kind === 'banner') {
      for (const e of this.near(n.x, n.y, 200)) if (e !== n && this.teamOf(e) === this.teamOf(n)) { e.hp = Math.min(e.maxhp, e.hp + 6 * DT); if (e.buffUntil !== undefined) e.buffUntil = Math.max(e.buffUntil, T + 1200); }
      return;
    }
    const own = n.owner ? this.players.get(n.owner) : null;
    if (n.owner && (!own || own.dead)) return this.killNpc(n, null, true);
    if (!awake && !n.owner) { if (n.hp < n.maxhp) n.hp = Math.min(n.maxhp, n.hp + n.maxhp * 0.05 * DT); return; }
    if (n.def.boss && !n.enraged && n.hp < n.maxhp * 0.35) { n.enraged = true; this.combo(n, 'ENRAGED'); }
    if (T < n.stunUntil) { n.charge = null; return; }
    const spd = this.speedOf(n);
    // An ongoing charge overrides everything else.
    if (n.charge) {
      if (T < n.charge.at) return;
      if (T > n.charge.until) n.charge = null;
      else {
        const ox = n.x, oy = n.y;
        [n.x, n.y] = moveBody(n.x, n.y, n.r, Math.cos(n.charge.ang) * spd * 3.2 * DT, Math.sin(n.charge.ang) * spd * 3.2 * DT);
        n.moving = true;
        for (const e of this.hostileNear(n, n.x, n.y, n.r + 8)) if (!n.charge.hit.has(e.id)) { n.charge.hit.add(e.id); this.dealDamage(n, e, n.def.dmg * 1.6, { melee: true }); this.knock(e, n.charge.ang, 90, n); }
        if (Math.hypot(n.x - ox, n.y - oy) < 1) n.charge = null;
        return;
      }
    }
    if (n.fuse) { if (T >= n.fuse) { this.zones.push({ type: 'blast', x: n.x, y: n.y, r: 100, at: T, d: 1, dmg: n.def.dmg * n.dmgMul, team: n.team, stub: this.mkStub(n), el: 'fire' }); this.killNpc(n, null, true); } return; }
    let tgt = n.target ? this.getEnt(n.target) : null;
    if (tgt && (tgt.dead || tgt.hp <= 0 || !this.hostile(n, tgt) || inSafe(tgt) || dist(n, tgt) > n.def.aggro * 2)) { tgt = null; n.target = null; }
    if (!n.owner) {
      const dh = Math.hypot(n.x - n.home.x, n.y - n.home.y);
      if (dh > n.leash) { n.returning = true; n.target = null; tgt = null; }
      if (n.returning && dh < 40) n.returning = false;
    }
    if (!tgt && !n.returning && T >= n.nextScan) { n.nextScan = T + 300 + Math.random() * 200; n.target = this.findTarget(n); tgt = n.target ? this.getEnt(n.target) : null; }
    n.moving = false;
    if (tgt) this.fight(n, tgt, spd);
    else if (n.owner) {
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
      const wr = n.castle >= 0 || n.dungeon !== undefined ? 80 : 160;
      if (!n.wp || T > n.wanderT) { n.wp = { x: n.home.x + rnd(-wr, wr), y: n.home.y + rnd(-wr, wr) }; n.wanderT = T + rnd(2500, 6000); }
      if (Math.hypot(n.wp.x - n.x, n.wp.y - n.y) > 10) { n.ang = Math.atan2(n.wp.y - n.y, n.wp.x - n.x); this.steer(n, n.wp.x, n.wp.y, spd * 0.35); n.moving = true; }
    }
  }
  // Combat behaviour by type. Every type falls back to closing in and hitting.
  fight(n, tgt, spd) {
    const T = this.T, def = n.def, d = dist(n, tgt), ar = def.range, cdMul = n.elite === 'swift' ? 0.7 : 1;
    n.ang = Math.atan2(tgt.y - n.y, tgt.x - n.x);
    if (T >= (n.losAt || 0)) { n.losAt = T + 250; n.los = losClear(n.x, n.y, tgt.x, tgt.y); }
    if (!n.los) { this.steer(n, tgt.x, tgt.y, spd); n.moving = true; return; }
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
        if (T >= n.nextSkill) { n.nextSkill = T + 7000 * cdMul; this.blast(n, tgt.x, tgt.y, 90, 1000, def.dmg * 1.6, { el: def.proj === 'fire' ? 'fire' : null, slow: def.proj === 'frost' }); }
        break;
      case 'healer':
        if (T >= n.nextSkill) {
          const hurt = this.near(n.x, n.y, 320).find((e) => e !== n && e.isNpc && e.team === n.team && e.hp < e.maxhp * 0.8);
          if (hurt) { n.nextSkill = T + 3000; this.heal(null, hurt, hurt.maxhp * 0.25); this.fx({ t: 'line', x: n.x, y: n.y, x2: hurt.x, y2: hurt.y, c: '#7ff0a0' }); }
        }
        break;
      case 'summoner':
        if (T >= n.nextSkill) { n.nextSkill = T + 9000; this.summonMinions(n, def.minion, 2, 3); }
        break;
      case 'exploder':
        if (d < 46 + tgt.r) { n.fuse = T + 600; n.atkAt = T; this.combo(n, '!!'); return; }
        this.steer(n, tgt.x, tgt.y, spd); n.moving = true; return;
      case 'slam':
        if (d < 150 && T >= n.nextSkill) { n.nextSkill = T + 6000 * cdMul; this.blast(n, n.x, n.y, n.r + 120, 800, def.dmg * 2); n.windUntil = T + 500; return; }
        break;
    }
    if (def.ranged) {
      const kite = def.ai === 'kite' || def.ai === 'healer' || def.ai === 'summoner' || def.ai === 'caster';
      if (kite && d < ar * 0.45) { this.steer(n, n.x - Math.cos(n.ang) * 100, n.y - Math.sin(n.ang) * 100, spd); n.moving = true; }
      else if (d > ar * 0.85) { this.steer(n, tgt.x, tgt.y, spd); n.moving = true; }
      if (d <= ar && T >= n.nextAtk) {
        n.nextAtk = T + def.cd * cdMul; n.atkAt = T;
        this.fireProj(n, n.ang + rnd(-0.05, 0.05), { speed: 440, dmg: def.dmg, life: ar / 440 + 0.3, kind: def.proj || 'arrow' });
      }
    } else if (d > ar + tgt.r + n.r - 4) { this.steer(n, tgt.x, tgt.y, spd); n.moving = true; }
    else if (T >= n.nextAtk) {
      n.nextAtk = T + def.cd * cdMul; n.atkAt = T;
      this.fx({ t: 'arc', x: n.x, y: n.y, a: n.ang, r: ar + 14, w: 1.2 });
      this.dealDamage(n, tgt, def.dmg, { melee: true });
    }
  }

  // ---------------------------------------------------------------- projectiles & zones
  mkStub(src) {
    const root = this.rootOwner(src);
    return { isStub: true, id: -1, from: src.id, x: src.x, y: src.y, team: this.teamOf(src), dmgMul: 1, credit: root ? root.id : null, hp: 1, r: 0 };
  }
  fireProj(src, ang, o) {
    const mods = src.isPlayer ? src.mods : null;
    const rangedMul = mods && o.player ? mods.ranged : 1, lifeMul = mods ? mods.range : 1;
    const mul = this.dmgMulOf(src) * rangedMul;
    this.projs.push({
      x: src.x + Math.cos(ang) * (src.r + 4), y: src.y + Math.sin(ang) * (src.r + 4),
      vx: Math.cos(ang) * o.speed, vy: Math.sin(ang) * o.speed, ang, life: o.life * lifeMul, kind: o.kind || 'arrow',
      dmg: o.dmg * mul, aoe: o.aoe || 0, aoeDmg: (o.aoeDmg || 0) * mul, pierce: o.pierce || 0, knock: o.knock || 0, slow: o.slow || 0, mark: o.mark || 0,
      el: o.kind === 'fire' ? 'fire' : null, ranged: o.kind !== 'dark' && o.kind !== 'frost' && (o.kind !== 'fire' || !!o.player),
      hit: new Set(), stub: this.mkStub(src), team: this.teamOf(src),
    });
  }
  updateProjs() {
    const keep = [];
    for (const p of this.projs) {
      p.life -= DT;
      let dead = p.life <= 0;
      for (let s = 0; s < 3 && !dead; s++) {
        p.x += (p.vx * DT) / 3; p.y += (p.vy * DT) / 3;
        if (p.x < 0 || p.y < 0 || p.x > W || p.y > WORLD.H || shotBlocked(p.x, p.y)) { dead = true; if (p.aoe) this.explode(p, null); else this.fx({ t: 'spark', x: p.x, y: p.y }); break; }
        for (const e of this.near(p.x, p.y, 8)) {
          if (p.hit.has(e.id) || this.teamOf(e) === p.team || (e.kind === 'banner' && !p.aoe)) continue;
          p.hit.add(e.id);
          if (p.dmg > 0) this.dealDamage(p.stub, e, p.dmg, { premul: true, el: p.el, ranged: p.ranged });
          if (p.kind === 'frost') this.slow(e, 0.6, 1500);
          if (p.slow) this.slow(e, 0.45, p.slow);
          if (p.mark) { e.markUntil = this.T + p.mark; e.markTeam = p.team; this.combo(e, 'MARKED'); }
          if (p.knock) this.knock(e, p.ang, p.knock, p.stub);
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
    for (const o of this.near(p.x, p.y, p.aoe)) if (o !== except && this.teamOf(o) !== p.team) this.dealDamage(p.stub, o, p.aoeDmg, { parryable: false, premul: true, el: p.el });
  }
  updateZones() {
    const T = this.T, keep = [];
    for (const z of this.zones) {
      if (z.type === 'meteor' || z.type === 'blast') {
        if (T >= z.at) {
          if (z.mover) { const m = this.npcs.get(z.mover); if (m && freeAt(z.x, z.y, m.r)) { m.x = z.x; m.y = z.y; } }
          this.fx({ t: 'boom', x: z.x, y: z.y, r: z.r, big: z.type === 'meteor' ? 1 : 0 });
          for (const e of this.near(z.x, z.y, z.r)) if (this.teamOf(e) !== z.team && e.kind !== 'banner') {
            this.dealDamage(z.stub, e, z.dmg, { parryable: false, premul: true, el: z.type === 'meteor' ? 'fire' : z.el });
            if (z.type === 'meteor') this.stun(e, 600);
            if (z.slow) this.slow(e, 0.5, 2500);
          }
          continue;
        }
      } else {
        if (T >= z.until) continue;
        if (z.type === 'trap') {
          const hit = this.near(z.x, z.y, z.r).find((e) => this.teamOf(e) !== z.team && e.kind !== 'banner');
          if (hit) { this.stun(hit, 2200); hit.rootUntil = T + 2200; this.dealDamage(z.stub, hit, z.dmg, { parryable: false, premul: true }); this.fx({ t: 'ring', x: z.x, y: z.y, r: 50, c: '#c8a060' }); continue; }
        } else if (T >= z.next) {
          z.next = T + z.every;
          for (const e of this.near(z.x, z.y, z.r)) {
            if (this.teamOf(e) === z.team) continue;
            if (z.type === 'smoke') { this.slow(e, 0.6, 700); this.weaken(e, 700); }
            else if (z.type === 'web') this.slow(e, 0.4, 600);
            else { if (z.type === 'poison') e.poisonUntil = T + 1500; this.dealDamage(z.stub, e, z.dmg, { parryable: false, premul: true, ranged: z.type === 'rain' }); }
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
    if (p.mods) { range *= p.mods.titan; if (p.mods.titan > 1) o = { ...o, knock: Math.max(o.knock || 0, 50) }; }
    this.fx({ t: 'arc', x: p.x, y: p.y, a: p.ang, r: range, w: arc, c: o.c });
    let hits = 0;
    for (const e of this.near(p.x, p.y, range)) {
      if (!this.hostile(p, e)) continue;
      if (arc < 6.2 && angDiff(Math.atan2(e.y - p.y, e.x - p.x), p.ang) > arc / 2) continue;
      if (!losClear(p.x, p.y, e.x, e.y)) continue;
      let d = dmg * (p.mods ? p.mods.melee : 1);
      if (o.execute && e.hp < e.maxhp * 0.35) d *= 2;
      const dealt = this.dealDamage(p, e, d, { melee: true });
      if (dealt > 0) {
        hits++;
        if (p.mods && p.mods.lifesteal) p.hp = Math.min(p.maxhp, p.hp + dealt * p.mods.lifesteal);
        if (o.stun) this.stun(e, o.stun);
        if (o.slow) this.slow(e, o.slow, 3000);
        if (o.knock) this.knock(e, Math.atan2(e.y - p.y, e.x - p.x), o.knock, p);
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
      this.mkNpc(k, s.x, s.y, { owner: p.id, ttl: this.T + ttl, sc: 1 + p.tier * 0.04 + p.mods.summon, leash: 99999 });
    }
    this.fx({ t: 'ring', x: p.x, y: p.y, r: 90, c: '#e0b84f' });
  }
  aimPoint(p, ang, max) {
    const tx = p.aimX ?? p.x + Math.cos(ang) * max, ty = p.aimY ?? p.y + Math.sin(ang) * max;
    const d = Math.min(max, Math.hypot(tx - p.x, ty - p.y));
    return { x: clamp(p.x + Math.cos(ang) * d, 0, W), y: clamp(p.y + Math.sin(ang) * d, 0, WORLD.H) };
  }
  runSkill(p, id, ang) {
    const T = this.T, cos = Math.cos(ang), sin = Math.sin(ang);
    switch (id) {
      case 'slash': return this.meleeArc(p, 80, 1.7, 18);
      case 'cleave': return this.meleeArc(p, 100, 2.8, 44, { knock: 70, c: '#ff9a7a' });
      case 'shield_bash': return this.meleeArc(p, 72, 1.4, 22, { stun: 1300, c: '#cfd8e8' });
      case 'whirlwind': p.spin = { left: 3, next: T }; return;
      case 'ground_slam': this.fx({ t: 'ring', x: p.x, y: p.y, r: 170, c: '#b08a5a' }); return this.meleeArc(p, 170, 6.4, 45, { slow: 0.5, stun: 600 });
      case 'executioner': return this.meleeArc(p, 95, 1.4, 90, { execute: true, c: '#ff4040' });
      case 'titan_strike': return this.meleeArc(p, 140, 2.2, 130, { stun: 1800, knock: 80, c: '#ffd070' });
      case 'arrow': return this.fireProj(p, ang, { speed: 650, dmg: 14, life: 0.85, player: 1 });
      case 'power_shot': return this.fireProj(p, ang, { speed: 900, dmg: 50, life: 0.95, kind: 'power', pierce: 3, player: 1 });
      case 'crippling_shot': return this.fireProj(p, ang, { speed: 700, dmg: 20, life: 0.85, slow: 3500, mark: 6000, kind: 'power', player: 1 });
      case 'volley': for (let i = -3; i <= 3; i++) this.fireProj(p, ang + i * 0.12, { speed: 650, dmg: 17, life: 0.85, player: 1 }); return;
      case 'snare_trap': {
        const mine = this.zones.filter((z) => z.owner === p.id && z.type === 'trap');
        if (mine.length >= 2) mine[0].until = 0;
        const pt = this.aimPoint(p, ang, 200);
        this.addZone(p, 'trap', pt.x, pt.y, 34, 30000, { dmg: 25 * this.dmgMulOf(p) });
        return;
      }
      case 'explosive_arrow': return this.fireProj(p, ang, { speed: 620, dmg: 35, life: 0.95, kind: 'fire', aoe: 120, aoeDmg: 55, player: 1 });
      case 'rain_of_arrows': { const pt = this.aimPoint(p, ang, 420); this.addZone(p, 'rain', pt.x, pt.y, 150, 2000, { dmg: 15 * this.dmgMulOf(p) * p.mods.ranged, every: 250 }); return; }
      case 'piercing_gale': return this.fireProj(p, ang, { speed: 1000, dmg: 100, life: 0.9, kind: 'gale', pierce: 99, knock: 120, player: 1 });
      case 'firebolt': return this.fireProj(p, ang, { speed: 540, dmg: 30, life: 1.0, kind: 'fire', aoe: 60, aoeDmg: 18 });
      case 'healing_draught':
        for (const e of this.alliesNear(p, p.x, p.y, 150)) this.heal(p, e, e === p ? 70 : 40);
        return this.fx({ t: 'ring', x: p.x, y: p.y, r: 150, c: '#5fe08a' });
      case 'frost_nova':
        this.fx({ t: 'ring', x: p.x, y: p.y, r: 170, c: '#8fd8ff', fill: 1 });
        for (const e of this.hostileNear(p, p.x, p.y, 170)) { this.dealDamage(p, e, 28, { parryable: false }); this.slow(e, 0.5, 3000); e.chillUntil = T + 3500; }
        return;
      case 'poison_flask': { const pt = this.aimPoint(p, ang, 300); this.addZone(p, 'poison', pt.x, pt.y, 110, 6000, { dmg: 7 * this.dmgMulOf(p) }); return this.fx({ t: 'ring', x: pt.x, y: pt.y, r: 110, c: '#7ad04a' }); }
      case 'chain_lightning': {
        const pt = this.aimPoint(p, ang, 380);
        let cur = this.hostileNear(p, pt.x, pt.y, 160).sort((a, b) => dist(a, pt) - dist(b, pt))[0];
        const pts = [[rd(p.x), rd(p.y)]], hit = new Set();
        let dmg = 50;
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
      case 'meteor': { const pt = this.aimPoint(p, ang, 400); this.zones.push({ type: 'meteor', x: pt.x, y: pt.y, r: 160, at: T + 1200, d: 1200, dmg: 170 * this.dmgMulOf(p), team: this.teamOf(p), stub: this.mkStub(p), owner: p.id }); return; }
      case 'rejuvenation':
        for (const e of this.alliesNear(p, p.x, p.y, 200)) { e.regenUntil = T + 6000; e.regenRate = 12 * p.mods.heal; }
        return this.fx({ t: 'ring', x: p.x, y: p.y, r: 200, c: '#7ff0a0', fill: 1 });
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
        for (const e of this.hostileNear(p, p.x, p.y, 260)) { this.weaken(e, 5000); this.knock(e, Math.atan2(e.y - p.y, e.x - p.x), 140, p); }
        return;
      case 'fortify':
        for (const e of this.alliesNear(p, p.x, p.y, 260)) if (e.shieldUntil !== undefined) e.shieldUntil = Math.max(e.shieldUntil, T + 5000);
        return this.fx({ t: 'ring', x: p.x, y: p.y, r: 260, c: '#9aa4b8' });
      case 'parry': p.parryUntil = T + 650; return this.fx({ t: 'ring', x: p.x, y: p.y, r: 30, c: '#4fc3e0' });
      case 'dash': { const ox = p.x, oy = p.y; [p.x, p.y] = moveBody(p.x, p.y, p.r, cos * 190, sin * 190); p.tp++; return this.fx({ t: 'line', x: ox, y: oy, x2: p.x, y2: p.y, c: '#bfefff' }); }
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
        p.x = ex; p.y = ey; p.tp++;
        return this.fx({ t: 'line', x: ox, y: oy, x2: ex, y2: ey, c: win ? '#ffe070' : '#ffffff' });
      }
      case 'shadowstep': {
        const pt = this.aimPoint(p, ang, 300);
        for (let k = 0; k < 12; k++) {
          const f = 1 - k / 12, x = p.x + (pt.x - p.x) * f, y = p.y + (pt.y - p.y) * f;
          if (freeAt(x, y, p.r) && losClear(p.x, p.y, x, y)) { this.fx({ t: 'poof', x: p.x, y: p.y, c: '#402060' }); p.x = x; p.y = y; p.tp++; this.fx({ t: 'poof', x, y, c: '#402060' }); return; }
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
    this.cancelChannel(p, 'Teleport cancelled.');
    p.en -= sk.en; p.cds[id] = this.T + sk.cd * p.mods.cd; p.ang = ang;
    p.aimX = Number.isFinite(ax) ? ax : null; p.aimY = Number.isFinite(ay) ? ay : null;
    p.wp = WEAPON_OF[sk.tree]; p.atkAt = this.T;
    this.runSkill(p, id, ang);
  }

  // ---------------------------------------------------------------- per-tick updates
  updatePlayer(p) {
    const T = this.T;
    if (p.dead) { if (T >= p.respawnAt) this.respawn(p); return; }
    this.tickStatus(p);
    if (p.dead) return;
    p.en = Math.min(p.maxen, p.en + (6 + p.tier * 0.15) * p.mods.en * DT);
    if (inSafe(p)) p.hp = Math.min(p.maxhp, p.hp + p.maxhp * 0.08 * DT);
    else if (T - p.lastHitAt > 5000) p.hp = Math.min(p.maxhp, p.hp + (1 + p.maxhp * 0.01) * DT);
    if (p.spin && T >= p.spin.next) {
      this.meleeArc(p, 120, 6.4, 26, { c: '#ffb0a0' });
      p.spin.next = T + 300;
      if (--p.spin.left <= 0) p.spin = null;
    }
    // The client moves itself; the server only grants it a speed budget to spend (see clientMove).
    const spd = this.speedOf(p);
    p.moveBudget = Math.min(spd * 0.5, p.moveBudget + spd * DT * 1.2);
    p.moveTime = T - p.lastMoveAt < 250 ? p.moveTime + DT : 0;
    if (p.channel) {
      if (Math.hypot(p.x - p.channel.x, p.y - p.channel.y) > 12) this.cancelChannel(p, 'Teleport cancelled: you moved.');
      else if (T >= p.channel.until) this.finishChannel(p);
    }
    if (p.rank >= AURA_RANK && p.fac && this.tickNo % 5 === 0) for (const o of this.near(p.x, p.y, 320)) if (o !== p && o.isPlayer && o.fac === p.fac) o.auraUntil = T + 400;
    // Gravity Lodestone pulse.
    if (p.rel.pull && T >= p.pulseAt) {
      const foes = this.hostileNear(p, p.x, p.y, 260).filter((e) => losClear(p.x, p.y, e.x, e.y));
      if (foes.length) {
        p.pulseAt = T + 5000;
        this.fx({ t: 'pulse', x: p.x, y: p.y, r: 260 });
        for (const e of foes) this.knock(e, Math.atan2(p.y - e.y, p.x - e.x), Math.min(110, dist(e, p) - 34 - e.r));
      }
    }
    // Gold is only safe once banked in the Haven or one of your faction's castles.
    if (p.gold > 0 && this.canManage(p)) { p.bank += p.gold; this.send(p, { t: 'toast', m: `Banked ${p.gold} gold` }); p.gold = 0; p.dirty = true; }
    if (this.loot.size) for (const l of this.loot.values()) {
      if (Math.abs(l.x - p.x) > 40 || Math.abs(l.y - p.y) > 40) continue;
      if (l.owner && l.owner !== p.accountId && T < l.ownerUntil) continue;
      if (l.relic && p.relics.length >= MAX_STASH) { if (T > (p.fullWarn || 0)) { p.fullWarn = T + 5000; this.say(p, 'Your relic stash is full.'); } continue; }
      if (l.gold) { p.gold += l.gold; this.send(p, { t: 'gain', v: 0, s: 0, g: l.gold }); }
      if (l.relic) { const r = { u: p.nu++, ...l.relic }; p.relics.push(r); this.send(p, { t: 'relic', r, from: 'loot' }); this.sendProf(p); }
      this.loot.delete(l.id); p.dirty = true;
    }
    // Caves and portals.
    if (T >= p.portalCd) {
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
  // Applies a position the client reports, limited by speed budget and collision.
  clientMove(p, x, y) {
    const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
    if (d < 0.05 || p.moveBudget <= 0) return;
    const f = Math.min(1, p.moveBudget / d);
    [p.x, p.y] = moveBody(p.x, p.y, p.r, dx * f, dy * f);
    p.moveBudget -= d * f;
    if (d > 1) p.lastMoveAt = this.T;
  }
  updateCastles() {
    for (const c of this.castles) {
      const defTeam = c.owner ? 'f:' + c.owner : 'wild';
      let def = 0, enemies = 0;
      for (const id of c.slots) if (id && this.npcs.has(id)) def++;
      const atk = new Map();
      for (const p of this.players.values()) {
        if (p.dead || !inCastleWalls(c, p.x, p.y)) continue;
        if (this.teamOf(p) === defTeam) def++;
        else { enemies++; if (p.fac && inCastle(c, p.x, p.y)) atk.set(p.fac, (atk.get(p.fac) || 0) + 1); }
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
      if (c.calm > 15 && this.T >= c.nextSpawn) {
        const i = c.slots.findIndex((id) => !id || !this.npcs.has(id));
        if (i >= 0) { this.spawnGuard(c, i); c.nextSpawn = this.T + 4000; }
      }
    }
  }
  captureCastle(c, facId) {
    const f = this.factions[facId];
    if (!f) { c.prog.t = 0; return; }
    const old = c.owner && this.factions[c.owner] ? this.factions[c.owner].name : 'the bandits';
    this.clearGarrison(c);
    c.owner = facId; c.level = 1; c.prog = { fac: 0, t: 0 }; c.calm = 99;
    c.slots = garrisonFor(c.type, c.danger, 1).map(() => null);
    this.spawnGarrison(c);
    for (const p of this.players.values()) if (!p.dead && p.fac === facId && inCastleWalls(c, p.x, p.y)) this.gain(p, 150 + c.danger * 50, 150 + c.danger * 80, 0);
    this.broadcast({ t: 'msg', m: `${f.name} has conquered ${c.name} from ${old}!`, c: f.color });
    this.worldDirty = true;
  }
  payTaxes() {
    const income = new Map();
    for (const c of this.castles) if (c.owner) income.set(c.owner, (income.get(c.owner) || 0) + CASTLE_TAX * c.level);
    for (const p of this.players.values()) {
      const g = p.fac && income.get(p.fac);
      if (!g) continue;
      p.bank += g; p.dirty = true;
      this.send(p, { t: 'toast', m: `Castle taxes: +${g} gold` });
    }
  }

  // ---------------------------------------------------------------- snapshots
  flagsOf(e) {
    const T = this.T; let f = 0;
    if (T < e.stunUntil) f |= 1; if (T < e.parryUntil || T < e.counterUntil) f |= 2; if (T < e.slowUntil) f |= 4;
    if (T < e.weakUntil) f |= 8; if (T < e.buffUntil) f |= 16; if (T < e.shieldUntil) f |= 32; if (T < e.riposteUntil) f |= 64;
    if (T < e.regenUntil) f |= 128; if (e.burn) f |= 256; if (e.venom) f |= 512; if (T < (e.windUntil || 0) || e.fuse) f |= 1024;
    return f;
  }
  snapshot(p) {
    const T = this.T, vx = p.x, vy = p.y, ents = [];
    const push = (e) => {
      if (e.dead || Math.abs(e.x - vx) > VIEW_W || Math.abs(e.y - vy) > VIEW_H) return;
      const o = { i: e.id, k: e.kind, x: rd(e.x), y: rd(e.y), a: +e.ang.toFixed(2), h: rd(e.hp), m: rd(e.maxhp), fl: this.flagsOf(e) };
      if (e.atkAt && T - e.atkAt < 300) o.at = 1;
      if (e.isPlayer) { o.n = e.name; o.f = e.fac || 0; o.rk = rankOf(e.valor).idx; o.wp = e.wp; if (e.spin) o.sp = 1; if (e.vet) o.vt = 1; }
      else {
        if (e.owner) { const ow = this.players.get(e.owner); o.f = ow ? ow.fac || 0 : 0; o.ow = e.owner; } else o.f = e.fac || 0;
        if (e.elite) o.el = e.elite;
        if (e.enraged) o.en = 1;
      }
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
      zs.push({ t: z.type, x: rd(z.x), y: rd(z.y), r: z.r, l: z.at ? z.at - T : z.until - T, d: z.d });
    }
    const lt = [];
    for (const l of this.loot.values()) if (Math.abs(l.x - vx) < VIEW_W && Math.abs(l.y - vy) < VIEW_H)
      lt.push([l.id, rd(l.x), rd(l.y), l.relic ? RELICS[l.relic.k].rarity : 'gold', l.owner && l.owner !== p.accountId && T < l.ownerUntil ? 1 : 0]);
    const fxs = this.fxq.filter((f) => Math.abs(f.x - vx) < VIEW_W + 200 && Math.abs(f.y - vy) < VIEW_H + 200);
    const cd = [];
    for (const id in p.cds) { const rem = p.cds[id] - T; if (rem > 0) cd.push([id, rem]); }
    let cz = -1, cp = 0, cdf = 0, cl = 0;
    for (const c of this.castles) if (inCastleWalls(c, p.x, p.y)) { cz = c.id; cp = +(c.prog.t / CAPTURE_TIME).toFixed(2); cdf = c.def; cl = c.level; break; }
    return JSON.stringify({
      t: 's', n: this.tickNo,
      me: { x: rd(p.x), y: rd(p.y), h: rd(p.hp), mh: p.maxhp, en: rd(p.en), me: p.maxen, v: p.valor, s: p.soma, g: p.gold, b: p.bank, sp: rd(this.speedOf(p)), fl: this.flagsOf(p), cd,
        dead: p.dead ? 1 : 0, rs: p.dead ? Math.max(0, p.respawnAt - T) : 0, cz, cp, cdf, cl, tp: p.tp, mg: this.canManage(p) ? 1 : 0,
        ch: p.channel ? [Math.max(0, p.channel.until - T), p.channel.total, p.channel.label] : 0 },
      e: ents, pr, zs, lt, fx: fxs,
    });
  }
  metaObj() {
    const facs = Object.values(this.factions).map((f) => ({ id: f.id, name: f.name, color: f.color, m: f.members.length, c: this.castles.filter((c) => c.owner === f.id).length, l: f.leaderName || '?' }));
    const lb = [...this.players.values()].sort((a, b) => b.valor - a.valor || b.soma - a.soma).slice(0, 10).map((p) => ({ n: p.name, v: p.valor, s: p.soma, t: p.tier, f: p.fac || 0, vt: p.vet || 0 }));
    const bosses = this.dungeons.map((ds) => (ds.boss ? 0 : Math.max(0, ds.bossAt - this.T)));
    return { c: this.castles.map((c) => [c.id, c.owner || 0, c.level]), f: facs, lb, on: this.players.size, bosses };
  }

  // ---------------------------------------------------------------- messages from a client
  handle(p, m) {
    switch (m.t) {
      case 'in':
        if (Number.isFinite(m.a)) p.ang = m.a;
        if (!p.dead && m.tp === p.tp && Number.isFinite(m.x) && Number.isFinite(m.y)) this.clientMove(p, m.x, m.y);
        break;
      case 'cast': this.cast(p, m.s, +m.a, +m.x, +m.y); break;
      case 'recall':
        if (p.dead || p.channel) break;
        if (p.rank < RECALL_RANK) { this.say(p, 'Recall unlocks at the rank of Knight.'); break; }
        if (!inSafe(p)) this.startChannel(p, 'haven', 'Recalling to Hanbin Haven');
        break;
      case 'travel': {
        if (p.dead || p.channel) break;
        if (p.rank < TRAVEL_RANK) { this.say(p, 'Fort travel unlocks at the rank of Baron.'); break; }
        const c = this.castles.find((k) => k.id === (m.id | 0));
        if (!c || !p.fac || c.owner !== p.fac) { this.say(p, 'You can only travel to castles your faction holds.'); break; }
        this.startChannel(p, c.id, `Travelling to ${c.name}`);
        break;
      }
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
      case 'reset': {
        if (p.dead || !inSafe(p)) { this.say(p, 'You can only reset your skills inside Hanbin Haven, the safe village.'); break; }
        const n = p.skills.filter((s) => !SKILLS[s].free).length;
        if (!n) break;
        p.skills = [...FREE_SKILLS];
        p.hotbar = p.hotbar.map((s) => (s && SKILLS[s].free ? s : null));
        this.removeSummonsOf(p.id);
        p.dirty = true; this.sendProf(p);
        this.send(p, { t: 'toast', m: `Skills reset: ${n} point${n === 1 ? '' : 's'} refunded` });
        break;
      }
      case 'hb': {
        const s = m.s | 0;
        if (s < 0 || s >= p.slots) break;
        if (m.id === null) p.hotbar[s] = null;
        else if (typeof m.id === 'string' && p.skills.includes(m.id) && !SKILLS[m.id].passive) { const prev = p.hotbar.indexOf(m.id); if (prev >= 0) p.hotbar[prev] = p.hotbar[s]; p.hotbar[s] = m.id; }
        else break;
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
      case 'fortify': this.fortify(p, m.id); break;
      case 'buy': case 'equip': case 'unequip': case 'fuse': case 'salvage': this.relicAction(p, m); break;
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
    if (T >= this.nextDungeonCheck) { this.nextDungeonCheck = T + 2000; this.updateDungeons(); }
    if (T >= this.nextSpawnT) {
      this.nextSpawnT = T + 300;
      for (let i = 0; i < this.wildCount.length; i++) if (this.wildCount[i] < this.wildCap[i]) { this.spawnWild(i); break; }
    }
    if (T >= this.nextTax) { this.nextTax = T + 60000; this.payTaxes(); }
    for (const [id, l] of this.loot) if (T > l.until) this.loot.delete(id);
    for (const p of this.players.values()) this.send(p, this.snapshot(p));
    this.fxq = [];
    if (T >= this.nextMeta) { this.nextMeta = T + 1000; this.broadcast({ t: 'meta', ...this.metaObj() }); }
    if (this.tickNo % 600 === 0) for (const [k, v] of this.recentKills) if (v < T) this.recentKills.delete(k);
  }
}
