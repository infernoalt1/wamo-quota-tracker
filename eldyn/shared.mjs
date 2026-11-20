// Hanbin Island: game data and world geometry shared by the server and the browser.
// The map is generated from a fixed seed, so both sides build exactly the same island.

export const MAP_SEED = 7331;
// Saved castle owners only carry over while the map is the same one.
export const MAP_ID = 'archipelago-1';
// IH is the height of the sea and its islands; the dungeons sit in their own caverns below it (y >= IH), reached by cave mouths.
export const WORLD = { W: 30000, IH: 20000, H: 28400, SAFE_R: 300 };
const { W, IH } = WORLD;

// ------------------------------------------------------------------ noise
function hash(x, y, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function noise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, s, oct = 3) {
  let t = 0, amp = 1, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { t += noise(x * f, y * f, s + i * 17) * amp; n += amp; amp *= 0.5; f *= 2; }
  return t / n;
}
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ------------------------------------------------------------------ the archipelago
// Eight islands, each with its own land and danger, joined by long timber bridges. Hanbin, in the
// middle, holds the Haven; the further an island lies from it, the deadlier it is.
export const ISLANDS = [
  { id: 0, name: 'Hanbin', x: 15000, y: 10400, rx: 5300, ry: 4100, rot: 0.08, danger: [1, 3], land: 'heart' },
  { id: 1, name: 'The Frostmark', x: 14200, y: 2700, rx: 5600, ry: 1900, rot: -0.05, danger: [4, 5], land: 'frost' },
  { id: 2, name: 'Emberreach', x: 25300, y: 8400, rx: 2900, ry: 4200, rot: 0.15, danger: [5, 6], land: 'ember' },
  { id: 3, name: 'Mirewold', x: 5300, y: 9200, rx: 3000, ry: 4700, rot: -0.1, danger: [3, 5], land: 'mire' },
  { id: 4, name: 'The Sunscar', x: 16800, y: 17700, rx: 5200, ry: 1800, rot: 0.04, danger: [3, 4], land: 'sun' },
  { id: 5, name: 'Gull Isles', x: 5000, y: 17000, rx: 2300, ry: 1600, rot: 0.3, danger: [2, 3], land: 'gull' },
  { id: 6, name: 'Thornholm', x: 25600, y: 1900, rx: 2000, ry: 1250, rot: -0.2, danger: [6, 6], land: 'thorn' },
  { id: 7, name: 'Saltspire', x: 26300, y: 16700, rx: 1900, ry: 1700, rot: 0.2, danger: [4, 5], land: 'salt' },
];
for (const I of ISLANDS) { I.cos = Math.cos(I.rot); I.sin = Math.sin(I.rot); }
// Bridges: [x0, y0, x1, y1, island A, island B]. Each end sits well inside its island.
export const BRIDGE_W = 110;
export const BRIDGES = [
  [14600, 7000, 14300, 3900, 0, 1],
  [19900, 9300, 22900, 8800, 0, 2],
  [10300, 10000, 7700, 9600, 0, 3],
  [16300, 13900, 16600, 16500, 0, 4],
  [5300, 13300, 5100, 15900, 3, 5],
  [25500, 4800, 25600, 2700, 2, 6],
  [21400, 17600, 25000, 16900, 4, 7],
].map(([x0, y0, x1, y1, a, b], id) => ({ id, x0, y0, x1, y1, a, b, len: Math.hypot(x1 - x0, y1 - y0) }));

// How far inside an island's oval a point is: 1 at its centre, 0 on the oval.
function islandRaw(I, x, y) {
  const dx = x - I.x, dy = y - I.y, u = (dx * I.cos + dy * I.sin) / I.rx, v = (-dx * I.sin + dy * I.cos) / I.ry;
  return 1 - Math.sqrt(u * u + v * v);
}
export function islandOf(x, y) {
  let best = 0, bv = -Infinity;
  for (const I of ISLANDS) { const v = islandRaw(I, x, y); if (v > bv) { bv = v; best = I.id; } }
  return best;
}
// Land without bridges: > 0 is land, < 0 is sea.
export function landBase(x, y) {
  if (y >= IH || x < 0 || y < 0 || x > W) return -1;
  let best = -9;
  for (const I of ISLANDS) { const v = islandRaw(I, x, y); if (v > best) best = v; }
  if (best < -0.6) return best;
  return best + (fbm(x / 1500, y / 1500, MAP_SEED, 4) - 0.5) * 0.6 + (fbm(x / 520, y / 520, MAP_SEED + 3, 3) - 0.5) * 0.22 + (noise(x / 160, y / 160, MAP_SEED + 4) - 0.5) * 0.04 - 0.02;
}
// The bridge deck under a point, if any: { b, t (0..1 along), d (signed distance from the centre line) }.
export function bridgeAt(x, y) {
  for (const b of BRIDGES) {
    if (x < Math.min(b.x0, b.x1) - BRIDGE_W || x > Math.max(b.x0, b.x1) + BRIDGE_W || y < Math.min(b.y0, b.y1) - BRIDGE_W || y > Math.max(b.y0, b.y1) + BRIDGE_W) continue;
    const sx = (b.x1 - b.x0) / b.len, sy = (b.y1 - b.y0) / b.len, px = x - b.x0, py = y - b.y0;
    const t = px * sx + py * sy, d = -px * sy + py * sx;
    if (t >= 0 && t <= b.len && Math.abs(d) <= BRIDGE_W / 2) return { b, t: t / b.len, along: t, d };
  }
  return null;
}
// Land including bridge decks (decks count as just-barely land, so nothing grows on them).
export function landValue(x, y) {
  const v = landBase(x, y);
  if (v >= 0.05 || y >= IH) return v;
  return bridgeAt(x, y) ? 0.05 : v;
}

// ------------------------------------------------------------------ region names (built from syllables, never repeating)
const PRE = ['Frost', 'Pine', 'Grey', 'Storm', 'Gull', 'Wyrm', 'Thorn', 'Amber', 'Bracken', 'Red', 'Kestrel', 'Iron', 'Dusk', 'Salt', 'Willow', 'Cinder',
  'Gold', 'Raven', 'Moss', 'Dune', 'Coral', 'Ash', 'High', 'Elder', 'Bright', 'Hollow', 'Stone', 'Wolf', 'Oak', 'Mist', 'Sun', 'Black', 'Silver', 'Fen', 'Crow', 'Briar', 'Heron', 'Copper', 'Ember', 'Rook'];
const SUF = ['mere', 'crest', 'watch', 'hold', 'cliff', 'fang', 'wood', 'moor', 'ford', 'marsh', 'vale', 'reach', 'hollow', 'march', 'peak', 'meadow', 'gate', 'water', 'barrow', 'strand', 'field', 'dale', 'spire', 'fell', 'brook', 'rock', 'wick', 'combe', 'haven', 'stead'];

// ------------------------------------------------------------------ castle layouts
// Forts guard the safe heartland, castles the middle ring, citadels (with a moat) the deadly isles.
// All coordinates are relative to the castle's centre. Walls are [x, y, w, h]; halls are solid buildings.
function ring(h, t, gates, gw) {
  const out = [], g = gw / 2;
  for (const d of 'NSWE') {
    const gap = gates.includes(d);
    if (d === 'N' || d === 'S') {
      const y = d === 'N' ? -h : h - t;
      if (gap) out.push([-h, y, h - g, t], [g, y, h - g, t]); else out.push([-h, y, 2 * h, t]);
    } else {
      const x = d === 'W' ? -h : h - t;
      if (gap) out.push([x, -h, t, h - g], [x, g, t, h - g]); else out.push([x, -h, t, 2 * h]);
    }
  }
  return out;
}
const corners = (h, t, r) => [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => ({ x: a * (h - t / 2), y: b * (h - t / 2), r }));
// Gatehouses: [x, y, side ('N'|'S'), gap width, ring half-size, wall thickness] (drawn, the walls already block).
export const CASTLE_TYPES = {
  fort: {
    name: 'Fort', walls: ring(240, 26, 'NS', 120), towers: corners(240, 26, 36), keep: [-66, -70, 132, 96], moat: [],
    halls: [[-206, -150, 58, 112, 'barracks'], [148, 38, 58, 112, 'stable']],
    gates: [[0, -240, 'N', 120, 26], [0, 240, 'S', 120, 26]],
    outer: 240, inner: 212, rings: [[240, 26]], style: 'timber',
  },
  castle: {
    name: 'Castle', walls: [...ring(350, 28, 'S', 130), ...ring(180, 22, 'N', 104)], towers: [...corners(350, 28, 42), ...corners(180, 22, 28)], keep: [-52, -46, 104, 80], moat: [],
    halls: [[-302, 196, 100, 92, 'barracks'], [202, 196, 100, 92, 'smithy']],
    gates: [[0, 350, 'S', 130, 28], [0, -180, 'N', 104, 22]],
    outer: 350, inner: 158, rings: [[350, 28], [180, 22]], style: 'stone',
  },
  citadel: {
    name: 'Citadel', walls: [...ring(450, 30, 'S', 130), ...ring(305, 26, 'N', 120), ...ring(170, 22, 'S', 100)],
    towers: [...corners(450, 30, 46), ...corners(305, 26, 34), ...corners(170, 22, 26)], keep: [-48, -42, 96, 72], halls: [],
    gates: [[0, 450, 'S', 130, 30], [0, -305, 'N', 120, 26], [0, 170, 'S', 100, 22]],
    moat: ring(540, 56, 'S', 150), outer: 540, inner: 148, rings: [[450, 30], [305, 26], [170, 22]], style: 'dark',
  },
};
// Does a castle of this type fit on dry land here?
const fits = (type, x, y) => { const o = CASTLE_TYPES[type].outer + 60; return [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [1, 0], [-1, 0], [0, -1], [0.6, 0.6], [-0.6, 0.6], [0.6, -0.6], [-0.6, -0.6]].every(([a, b]) => landBase(x + a * o, y + b * o) > 0.02); };

// ------------------------------------------------------------------ regions
// Region centres are scattered over each island at least MIN apart; every centre has room for a fort.
const SEEDS = [{ x: ISLANDS[0].x, y: ISLANDS[0].y, island: 0 }];
{
  const MIN = 1500;
  for (const I of ISLANDS) {
    const R = rng(MAP_SEED + I.id * 97), ext = Math.max(I.rx, I.ry) * 1.2;
    for (let k = 0; k < 3000; k++) {
      const x = Math.round(I.x + (R() * 2 - 1) * ext), y = Math.round(I.y + (R() * 2 - 1) * ext);
      if (landBase(x, y) < 0.2 || islandOf(x, y) !== I.id || !fits('fort', x, y)) continue;
      if (SEEDS.some((s) => Math.hypot(s.x - x, s.y - y) < MIN)) continue;
      if (BRIDGES.some((b) => Math.hypot(b.x0 - x, b.y0 - y) < 700 || Math.hypot(b.x1 - x, b.y1 - y) < 700)) continue;
      SEEDS.push({ x, y, island: I.id });
    }
  }
}
export const SANCTUARY = 0;
export const VILLAGE = { x: SEEDS[0].x, y: SEEDS[0].y, r: WORLD.SAFE_R };

export const RC = 60, GW = Math.ceil(W / RC), GH = Math.ceil(IH / RC);
export const REGION_GRID = new Int16Array(GW * GH);
export const LAND_GRID = new Uint8Array(GW * GH);
{
  const byIsland = ISLANDS.map((I) => SEEDS.map((s, i) => i).filter((i) => SEEDS[i].island === I.id));
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const x = gx * RC + RC / 2, y = gy * RC + RC / 2;
    const wx = x + (fbm(x / 900, y / 900, MAP_SEED + 5, 2) - 0.5) * 900, wy = y + (fbm(x / 900, y / 900, MAP_SEED + 9, 2) - 0.5) * 900;
    const land = landValue(x, y) > 0, onBridge = land && landBase(x, y) <= 0;
    // Land belongs to a region of its own island; a bridge deck to whichever end is nearer.
    const pool = land && !onBridge ? byIsland[islandOf(x, y)] : null;
    let best = 0, bd = Infinity;
    for (const i of pool && pool.length ? pool : SEEDS.keys()) { const d = (SEEDS[i].x - wx) ** 2 + (SEEDS[i].y - wy) ** 2; if (d < bd) { bd = d; best = i; } }
    REGION_GRID[gy * GW + gx] = best;
    LAND_GRID[gy * GW + gx] = land ? 1 : 0;
  }
}
const adj = SEEDS.map(() => new Set());
export const REGION_CELLS = SEEDS.map(() => []);
for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
  const i = gy * GW + gx; if (!LAND_GRID[i]) continue;
  const a = REGION_GRID[i];
  REGION_CELLS[a].push(i);
  if (gx + 1 < GW && LAND_GRID[i + 1] && REGION_GRID[i + 1] !== a) { adj[a].add(REGION_GRID[i + 1]); adj[REGION_GRID[i + 1]].add(a); }
  if (gy + 1 < GH && LAND_GRID[i + GW] && REGION_GRID[i + GW] !== a) { adj[a].add(REGION_GRID[i + GW]); adj[REGION_GRID[i + GW]].add(a); }
}
// Walking distance from the Haven in regions; it orders danger within each island and lays the roads.
const parent = SEEDS.map(() => -1), hops = SEEDS.map(() => Infinity);
{
  hops[0] = 0; const q = [0];
  while (q.length) { const a = q.shift(); for (const b of [...adj[a]].sort((m, n) => m - n)) if (hops[b] === Infinity) { hops[b] = hops[a] + 1; parent[b] = a; q.push(b); } }
}
// Each island has its own lands: [biome] chosen from where in the island a region lies (u: west-east, v: north-south).
function biomeFor(s, i) {
  if (i === SANCTUARY) return 'grass';
  const I = ISLANDS[s.island], dx = s.x - I.x, dy = s.y - I.y, u = (dx * I.cos + dy * I.sin) / I.rx, v = (-dx * I.sin + dy * I.cos) / I.ry;
  switch (I.land) {
    case 'heart': return v < -0.4 ? 'forest' : u < -0.45 ? 'forest' : u > 0.5 ? 'heath' : v > 0.45 ? ['grass', 'heath'][i % 2] : ['grass', 'forest', 'grass'][i % 3];
    case 'frost': return u > 0.45 ? 'rock' : u < -0.55 ? 'darkforest' : ['snow', 'snow', 'rock'][i % 3];
    case 'ember': return v < -0.55 || u < -0.5 ? 'rock' : 'ash';
    case 'mire': return v < -0.2 ? 'darkforest' : v > 0.35 ? 'swamp' : ['swamp', 'forest'][i % 2];
    case 'sun': return u < -0.6 ? 'heath' : 'desert';
    case 'gull': return ['heath', 'grass'][i % 2];
    case 'thorn': return ['snow', 'rock'][i % 2];
    case 'salt': return ['desert', 'swamp'][i % 2];
  }
  return 'grass';
}
// Danger rises with distance from the Haven inside each island, within that island's band.
const DANGER = SEEDS.map(() => 0);
for (const I of ISLANDS) {
  const ids = SEEDS.map((s, i) => i).filter((i) => i !== SANCTUARY && SEEDS[i].island === I.id)
    .sort((a, b) => hops[a] - hops[b] || Math.hypot(SEEDS[a].x - VILLAGE.x, SEEDS[a].y - VILLAGE.y) - Math.hypot(SEEDS[b].x - VILLAGE.x, SEEDS[b].y - VILLAGE.y));
  const [lo, hi] = I.danger, n = hi - lo + 1;
  ids.forEach((i, k) => { DANGER[i] = lo + Math.min(n - 1, Math.floor(((k + 0.5) / ids.length) * n)); });
}
const NR = rng(MAP_SEED + 21), usedNames = new Set();
function regionName() {
  for (;;) { const n = PRE[Math.floor(NR() * PRE.length)] + SUF[Math.floor(NR() * SUF.length)]; if (!usedNames.has(n)) { usedNames.add(n); return n; } }
}
export const REGIONS = SEEDS.map((s, i) => ({
  id: i, x: s.x, y: s.y, biome: biomeFor(s, i), island: s.island,
  name: i === SANCTUARY ? 'Hanbin Haven' : regionName(),
  danger: DANGER[i],
  neighbors: [...adj[i]],
}));
export const ISLAND_REGIONS = REGIONS.length;

function castleType(danger, x, y) {
  const want = danger <= 2 ? 'fort' : danger <= 4 ? 'castle' : 'citadel', order = ['citadel', 'castle', 'fort'];
  return order.slice(order.indexOf(want)).find((t) => fits(t, x, y)) || 'fort';
}
export const CASTLES = REGIONS.filter((r) => r.id !== SANCTUARY).map((r) => {
  const type = castleType(r.danger, r.x, r.y);
  return { id: r.id, x: r.x, y: r.y, type, name: `${r.name} ${CASTLE_TYPES[type].name}`, danger: r.danger, island: r.island };
});
export const castleOf = (regionId) => CASTLES.find((c) => c.id === regionId) || null;
// The courtyard you must hold to capture (the innermost ring).
export const inCastle = (c, x, y) => { const L = CASTLE_TYPES[c.type]; return Math.abs(x - c.x) < L.inner && Math.abs(y - c.y) < L.inner; };
export const inCastleWalls = (c, x, y) => { const L = CASTLE_TYPES[c.type]; return Math.abs(x - c.x) < L.outer && Math.abs(y - c.y) < L.outer; };

// Roads follow the route outward from the Haven. Between islands they run over the bridge.
export const ROADS = [];
{
  const dry = (x0, y0, x1, y1) => { for (let t = 0; t <= 1; t += 0.02) if (landValue(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t) <= 0) return false; return true; };
  for (let b = 0; b < SEEDS.length; b++) {
    const a = parent[b]; if (a < 0) continue;
    const A = SEEDS[a], B = SEEDS[b];
    let path = null;
    if (A.island === B.island) { if (dry(A.x, A.y, B.x, B.y)) path = [[A.x, A.y], [B.x, B.y]]; }
    else {
      const br = BRIDGES.find((q) => (q.a === A.island && q.b === B.island) || (q.b === A.island && q.a === B.island));
      if (br) {
        const [ea, eb] = br.a === A.island ? [[br.x0, br.y0], [br.x1, br.y1]] : [[br.x1, br.y1], [br.x0, br.y0]];
        const pts = [[A.x, A.y], ea, eb, [B.x, B.y]];
        if (pts.slice(1).every((p, k) => dry(pts[k][0], pts[k][1], p[0], p[1]))) path = pts;
      }
    }
    if (path) for (let k = 1; k < path.length; k++) ROADS.push({ x0: path[k - 1][0], y0: path[k - 1][1], x1: path[k][0], y1: path[k][1] });
  }
}
export function roadDist(x, y, roads = ROADS) {
  let best = Infinity;
  for (const r of roads) {
    const sx = r.x1 - r.x0, sy = r.y1 - r.y0, t = clamp(((x - r.x0) * sx + (y - r.y0) * sy) / (sx * sx + sy * sy), 0, 1);
    const d = Math.hypot(x - (r.x0 + sx * t), y - (r.y0 + sy * t));
    if (d < best) best = d;
  }
  return best;
}

// ------------------------------------------------------------------ dungeons
export const DUNGEON_DEFS = [
  { name: 'Rat Warrens', danger: 2, theme: 'warren', mobs: [['rat', 5], ['bat', 3], ['vagabond', 1]], boss: 'broodmother', biomes: ['grass', 'heath', 'swamp'] },
  { name: 'Sunken Crypt', danger: 3, theme: 'crypt', mobs: [['skeleton', 4], ['risen', 3], ['wraith', 1]], boss: 'bone_king', biomes: ['heath', 'grass', 'forest'] },
  { name: 'Silkweb Hollow', danger: 3, theme: 'web', mobs: [['spider', 5], ['bat', 2]], boss: 'silkweaver', biomes: ['darkforest', 'forest'] },
  { name: 'Rimefrost Caverns', danger: 4, theme: 'ice', mobs: [['yeti', 2], ['frost_wisp', 3], ['wolf', 2]], boss: 'old_rime', biomes: ['snow', 'rock'] },
  { name: 'Molten Forge', danger: 5, theme: 'forge', mobs: [['imp', 3], ['fire_elemental', 3], ['golem', 2]], boss: 'forgelord', biomes: ['ash', 'rock', 'desert'] },
  { name: 'Abyssal Vault', danger: 6, theme: 'abyss', mobs: [['wraith', 3], ['cultist', 3], ['necromancer', 1], ['troll', 2]], boss: 'hollow_prince', biomes: ['swamp', 'darkforest', 'ash'] },
];
export const DT_SIZE = 80, DGRID = 40, DBOX = DT_SIZE * DGRID;
export const DUNGEONS = DUNGEON_DEFS.map((def, i) => {
  const R = rng(MAP_SEED * 7 + i * 131);
  const bx = 600 + (i % 3) * 4200, by = IH + 600 + Math.floor(i / 3) * 4000;
  const tiles = new Uint8Array(DGRID * DGRID);
  let path;
  // A winding chain of rooms through a 5x5 grid of 8-tile cells, entrance to boss.
  for (let tries = 0; tries < 200; tries++) {
    const start = [Math.floor(R() * 5), 4], seen = new Set([start.join()]), p = [start];
    while (p.length < 8) {
      const [cx, cy] = p[p.length - 1];
      const opts = [[1, 0], [-1, 0], [0, -1], [0, 1]].map(([a, b]) => [cx + a, cy + b]).filter(([a, b]) => a >= 0 && b >= 0 && a < 5 && b < 5 && !seen.has(a + ',' + b));
      if (!opts.length) break;
      const nxt = opts[Math.floor(R() * opts.length)]; seen.add(nxt.join()); p.push(nxt);
    }
    if (p.length >= 8) { path = p; break; }
  }
  const rooms = path.map(([mx, my], k) => {
    const boss = k === path.length - 1, w = boss ? 7 : 4 + Math.floor(R() * 3), h = boss ? 7 : 4 + Math.floor(R() * 3);
    const tx = mx * 8 + Math.floor((8 - w) / 2) + (boss ? 0 : Math.floor(R() * (8 - w) / 2)), ty = my * 8 + Math.floor((8 - h) / 2) + (boss ? 0 : Math.floor(R() * (8 - h) / 2));
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) tiles[y * DGRID + x] = 1;
    return { tx, ty, w, h, x: bx + (tx + w / 2) * DT_SIZE, y: by + (ty + h / 2) * DT_SIZE, boss };
  });
  for (let k = 1; k < rooms.length; k++) {
    const a = rooms[k - 1], b = rooms[k];
    const ax = Math.floor(a.tx + a.w / 2), ay = Math.floor(a.ty + a.h / 2), bx2 = Math.floor(b.tx + b.w / 2), by2 = Math.floor(b.ty + b.h / 2);
    for (let x = Math.min(ax, bx2); x <= Math.max(ax, bx2); x++) for (const d of [0, 1]) tiles[(ay + d) * DGRID + x] = 1;
    for (let y = Math.min(ay, by2); y <= Math.max(ay, by2); y++) for (const d of [0, 1]) tiles[y * DGRID + bx2 + d] = 1;
  }
  const first = rooms[0];
  return { id: i, ...def, bx, by, tiles, rooms, start: { x: first.x, y: first.y + 40 }, exitPortal: { x: first.x, y: first.y - (first.h / 2 - 0.8) * DT_SIZE }, bossPortal: { x: rooms[rooms.length - 1].x, y: rooms[rooms.length - 1].y + (3.5 - 0.8) * DT_SIZE } };
});
export function dungeonAt(x, y) {
  if (y < IH) return null;
  const col = Math.floor((x - 600) / 4200), row = Math.floor((y - IH - 600) / 4000);
  if (col < 0 || col > 2 || row < 0 || row > 1) return null;
  const d = DUNGEONS[row * 3 + col];
  return d && x >= d.bx && y >= d.by && x < d.bx + DBOX && y < d.by + DBOX ? d : null;
}
export function dungeonFloor(x, y) {
  const d = dungeonAt(x, y); if (!d) return false;
  return d.tiles[Math.floor((y - d.by) / DT_SIZE) * DGRID + Math.floor((x - d.bx) / DT_SIZE)] === 1;
}
// Each dungeon is also a region (after the island ones), so region lookups work everywhere.
for (const d of DUNGEONS) REGIONS.push({ id: REGIONS.length, x: d.start.x, y: d.start.y, biome: 'cave', name: d.name, danger: d.danger, neighbors: [], dungeon: d.id });
export const regionAt = (x, y) => {
  if (y >= IH) { const d = dungeonAt(x, y); return d ? ISLAND_REGIONS + d.id : ISLAND_REGIONS; }
  return REGION_GRID[clamp(Math.floor(y / RC), 0, GH - 1) * GW + clamp(Math.floor(x / RC), 0, GW - 1)];
};

// ------------------------------------------------------------------ solids (walls, towers, buildings, rocks, trunks, moats)
const SOLID_CELL = 160, SGW = Math.ceil(W / SOLID_CELL);
const solidGrid = new Map();
export const SOLIDS = [];
function addSolid(s) {
  SOLIDS.push(s);
  const x0 = s.t === 'rect' ? s.x0 : s.x - s.r, x1 = s.t === 'rect' ? s.x1 : s.x + s.r;
  const y0 = s.t === 'rect' ? s.y0 : s.y - s.r, y1 = s.t === 'rect' ? s.y1 : s.y + s.r;
  for (let cx = Math.floor(x0 / SOLID_CELL); cx <= Math.floor(x1 / SOLID_CELL); cx++)
    for (let cy = Math.floor(y0 / SOLID_CELL); cy <= Math.floor(y1 / SOLID_CELL); cy++) {
      const k = cy * SGW + cx, a = solidGrid.get(k);
      if (a) a.push(s); else solidGrid.set(k, [s]);
    }
}
const rect = (x0, y0, w, h, extra) => addSolid({ t: 'rect', x0, y0, x1: x0 + w, y1: y0 + h, shot: true, ...extra });
for (const c of CASTLES) {
  const L = CASTLE_TYPES[c.type];
  for (const [x, y, w, h] of L.walls) rect(c.x + x, c.y + y, w, h, { k: 'wall' });
  for (const [x, y, w, h] of L.moat) rect(c.x + x, c.y + y, w, h, { k: 'moat', shot: false });
  for (const t of L.towers) addSolid({ t: 'circ', x: c.x + t.x, y: c.y + t.y, r: t.r, shot: true, k: 'tower' });
  const [kx, ky, kw, kh] = L.keep; rect(c.x + kx, c.y + ky, kw, kh, { k: 'keep' });
  for (const [hx, hy, hw, hh] of L.halls) rect(c.x + hx, c.y + hy, hw, hh, { k: 'hall' });
}
export const HOUSES = [];
{
  const R = rng(MAP_SEED + 3);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3, d = 175 + R() * 30, w = 74 + Math.round(R() * 20), h = 58 + Math.round(R() * 12);
    const hx = Math.round(VILLAGE.x + Math.cos(a) * d - w / 2), hy = Math.round(VILLAGE.y + Math.sin(a) * d - h / 2);
    HOUSES.push({ x: hx, y: hy, w, h, v: i % 3 });
    rect(hx, hy, w, h, { k: 'house' });
  }
  addSolid({ t: 'circ', x: VILLAGE.x, y: VILLAGE.y, r: 22, shot: false, k: 'well' });
}
// Cave mouths leading down to the dungeons, placed in a region of fitting danger and terrain.
export const CAVES = [];
{
  const R = rng(MAP_SEED + 77), used = new Set();
  for (const d of DUNGEONS) {
    const cands = REGIONS.filter((r) => r.id < ISLAND_REGIONS && r.id !== SANCTUARY && !used.has(r.id))
      .map((r) => ({ r, score: Math.abs(r.danger - d.danger) * 3 + (d.biomes.includes(r.biome) ? 0 : 2) + R() }))
      .sort((a, b) => a.score - b.score);
    for (const { r } of cands) {
      const c = castleOf(r.id), L = CASTLE_TYPES[c.type];
      let spot = null;
      for (let k = 0; k < 24 && !spot; k++) {
        const a = R() * Math.PI * 2, dist = L.outer + 380 + R() * 300, x = r.x + Math.cos(a) * dist, y = r.y + Math.sin(a) * dist;
        if (landValue(x, y) > 0.12 && regionAt(x, y) === r.id && Math.hypot(x - VILLAGE.x, y - VILLAGE.y) > 900) spot = { x: Math.round(x), y: Math.round(y) };
      }
      if (spot) { used.add(r.id); CAVES.push({ dungeon: d.id, region: r.id, ...spot }); d.cave = spot; break; }
    }
  }
}
// Scatter trees, rocks and the like, keeping roads, castles, caves and the village clear.
const PROP_RULES = {
  grass: [['tree', 0.1], ['rock', 0.025], ['bush', 0.06]],
  forest: [['tree', 0.42], ['bush', 0.08], ['rock', 0.03]],
  darkforest: [['pine', 0.3], ['tree', 0.25], ['rock', 0.04]],
  snow: [['pine', 0.2], ['rock', 0.07]],
  rock: [['rock', 0.22], ['pine', 0.06]],
  ash: [['dead', 0.1], ['rock', 0.14]],
  swamp: [['dead', 0.16], ['tree', 0.1], ['bush', 0.08]],
  desert: [['cactus', 0.06], ['rock', 0.08]],
  heath: [['bush', 0.12], ['tree', 0.05], ['rock', 0.04]],
};
export const PROPS = [];
{
  const R = rng(MAP_SEED + 11), S = 76;
  for (let gx = 0; gx < W / S; gx++) for (let gy = 0; gy < IH / S; gy++) {
    const x = gx * S + R() * S, y = gy * S + R() * S, roll = R(), v = Math.floor(R() * 4);
    if (landValue(x, y) < 0.06) continue;
    if (Math.hypot(x - VILLAGE.x, y - VILLAGE.y) < VILLAGE.r + 60) continue;
    if (CASTLES.some((c) => { const o = CASTLE_TYPES[c.type].outer + 110; return Math.abs(x - c.x) < o && Math.abs(y - c.y) < o; })) continue;
    if (CAVES.some((c) => Math.hypot(x - c.x, y - c.y) < 150)) continue;
    if (roadDist(x, y) < 60) continue;
    let acc = 0, kind = null;
    for (const [k, p] of PROP_RULES[REGIONS[regionAt(x, y)].biome]) { acc += p; if (roll < acc) { kind = k; break; } }
    if (!kind) continue;
    const p = { k: kind, x: Math.round(x), y: Math.round(y), v };
    if (kind === 'rock') { p.r = 16 + v * 5; addSolid({ t: 'circ', x: p.x, y: p.y, r: p.r, shot: true, k: 'rock' }); }
    else if (kind === 'tree' || kind === 'pine' || kind === 'dead') { p.r = 11; addSolid({ t: 'circ', x: p.x, y: p.y, r: 11, shot: false, k: 'trunk' }); }
    else if (kind === 'cactus') { p.r = 10; addSolid({ t: 'circ', x: p.x, y: p.y, r: 10, shot: false, k: 'trunk' }); }
    else p.r = 14;
    PROPS.push(p);
  }
}
const propGrid = new Map(), PCELL = 256, PGW = Math.ceil(W / PCELL);
for (const p of PROPS) { const k = Math.floor(p.y / PCELL) * PGW + Math.floor(p.x / PCELL); const a = propGrid.get(k); if (a) a.push(p); else propGrid.set(k, [p]); }
export function propsIn(x0, y0, x1, y1) {
  const out = [];
  for (let cy = Math.max(0, Math.floor(y0 / PCELL)); cy <= Math.floor(y1 / PCELL); cy++)
    for (let cx = Math.max(0, Math.floor(x0 / PCELL)); cx <= Math.min(PGW - 1, Math.floor(x1 / PCELL)); cx++) {
      const a = propGrid.get(cy * PGW + cx); if (a) for (const p of a) if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) out.push(p);
    }
  return out;
}

// ------------------------------------------------------------------ collision
export function solidsNear(x, y, r) {
  const out = [];
  for (let cx = Math.floor((x - r) / SOLID_CELL); cx <= Math.floor((x + r) / SOLID_CELL); cx++)
    for (let cy = Math.floor((y - r) / SOLID_CELL); cy <= Math.floor((y + r) / SOLID_CELL); cy++) {
      const a = solidGrid.get(cy * SGW + cx); if (a) for (const s of a) if (!out.includes(s)) out.push(s);
    }
  return out;
}
function overlap(s, x, y, r) {
  if (s.t === 'circ') return Math.hypot(x - s.x, y - s.y) < r + s.r;
  const px = clamp(x, s.x0, s.x1), py = clamp(y, s.y0, s.y1);
  return (x - px) ** 2 + (y - py) ** 2 < r * r;
}
function resolve(x, y, r) {
  for (let it = 0; it < 3; it++) {
    let moved = false;
    for (const s of solidsNear(x, y, r + 4)) {
      if (s.t === 'circ') {
        let dx = x - s.x, dy = y - s.y, d = Math.hypot(dx, dy); const m = r + s.r;
        if (d >= m) continue;
        if (d < 1e-6) { dx = 1; dy = 0; d = 1; }
        x = s.x + (dx / d) * m; y = s.y + (dy / d) * m; moved = true;
      } else {
        const px = clamp(x, s.x0, s.x1), py = clamp(y, s.y0, s.y1), dx = x - px, dy = y - py, d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        if (d2 > 1e-9) { const d = Math.sqrt(d2); x = px + (dx / d) * r; y = py + (dy / d) * r; }
        else {
          const opts = [[x - s.x0 + r, -1, 0], [s.x1 - x + r, 1, 0], [y - s.y0 + r, 0, -1], [s.y1 - y + r, 0, 1]].sort((a, b) => a[0] - b[0]);
          x += opts[0][1] * opts[0][0]; y += opts[0][2] * opts[0][0];
        }
        moved = true;
      }
    }
    if (!moved) break;
  }
  return [x, y];
}
// Island: anywhere on land. Dungeons: the whole body must be on floor tiles.
export function passable(x, y, r = 0) {
  if (y < IH) return landValue(x, y) > 0;
  const k = r * 0.8;
  return dungeonFloor(x, y) && dungeonFloor(x + k, y) && dungeonFloor(x - k, y) && dungeonFloor(x, y + k) && dungeonFloor(x, y - k);
}
export const isLand = (x, y) => passable(x, y, 0);
// Moves a round body, sliding along walls and coastline. Long moves go in short steps so nothing tunnels.
export function moveBody(x, y, r, dx, dy) {
  const len = Math.hypot(dx, dy), steps = Math.max(1, Math.ceil(len / 18));
  for (let i = 0; i < steps; i++) {
    let nx = clamp(x + dx / steps, r, W - r), ny = clamp(y + dy / steps, r, WORLD.H - r);
    if (!passable(nx, ny, r)) { if (passable(nx, y, r)) ny = y; else if (passable(x, ny, r)) nx = x; else break; }
    [nx, ny] = resolve(nx, ny, r);
    if (!passable(nx, ny, r)) break;
    x = nx; y = ny;
  }
  return [x, y];
}
export const freeAt = (x, y, r) => x > r && y > r && x < W - r && y < WORLD.H - r && passable(x, y, r) && !solidsNear(x, y, r).some((s) => overlap(s, x, y, r));
export const shotBlocked = (x, y) => (y >= IH && !dungeonFloor(x, y)) || solidsNear(x, y, 2).some((s) => s.shot && overlap(s, x, y, 2));
export function losClear(ax, ay, bx, by) {
  const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 12);
  for (let i = 1; i < n; i++) { const t = i / n; if (shotBlocked(ax + (bx - ax) * t, ay + (by - ay) * t)) return false; }
  return true;
}

// ------------------------------------------------------------------ valor & ranks
// Valor lasts one life: you lose all of it when you die or log off. It grows faster the more you have,
// drives how much Soma each kill gives, and ranks give privileges, never damage.
export const CAP_BASE = 5000, CAP_LIFT = { fort: 500, castle: 900, citadel: 1500 };
export const TERR_BONUS = { fort: 0.005, castle: 0.0075, citadel: 0.01 }, TERR_MAX = 0.35;
export const NPC_REWARD = 0.2, CAPTURE_VALOR = { fort: 1000, castle: 2000, citadel: 4000 };
export const valorGain = (own, victim, m = 1, t = 0) => (6 + 0.04 * own + 0.1 * victim) * m * (1 + t);
export const somaGain = (own, victim, m = 1, t = 0) => (1 + 0.1 * own + 0.05 * victim) * m * (1 + t);
export const RANKS = [
  { name: 'Vagabond', v: 0, perk: 'Every journey starts somewhere.' },
  { name: 'Guard', v: 40, perk: '+10 max health (90).' },
  { name: 'Sentinel', v: 120, perk: "See enemy players inside your faction's territory on the map. Your death is announced." },
  { name: 'Herald', v: 300, perk: 'Faction chat (start a message with /f).' },
  { name: 'Knight', v: 600, perk: '+10 max health (100). Command Rangers and Farmers.' },
  { name: 'Warden', v: 1000, perk: 'Command Reivers, Alchemists and Healers.' },
  { name: 'Banneret', v: 1600, perk: 'Command Brigands and Forest Stewards. See all allied forces on the map.' },
  { name: 'Marshall', v: 2500, perk: 'Quick travel to castles your faction holds (from the map).' },
  { name: 'Jarl', v: 4000, perk: 'Rename your faction (once per 15 minutes).' },
  { name: 'Theyn', v: 6000, perk: "Set your faction's banner colour." },
  { name: 'Lord', v: 9000, perk: 'World chat (start with /w). Rally to: faction mates can quick-travel to you.' },
  { name: 'Baron', v: 14000, perk: 'Command Honourguard, Cearls and Captains.' },
  { name: 'King', v: 46000, perk: 'Obey and Fend orders for castle troops. Your crowning and your fall are announced to the world.' },
];
export const RANK = { hp1: 1, radar: 2, facChat: 3, hp2: 4, allies: 6, travel: 7, rename: 8, colour: 9, world: 10, rally: 10, king: 12 };
export function rankOf(valor) {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) if (valor >= RANKS[i].v) idx = i;
  return { idx, name: RANKS[idx].name, next: RANKS[idx + 1] ? RANKS[idx + 1].v : null, cur: RANKS[idx].v };
}
export const rankHp = (idx) => 80 + (idx >= RANK.hp1 ? 10 : 0) + (idx >= RANK.hp2 ? 10 : 0);
// The rank a faction member needs to order each kind of castle troop (hired troops obey their owner).
export const COMMAND_RANK = { farmer: 4, ranger: 4, reiver: 5, alchemist: 5, healer: 5, brigand: 6, forest_steward: 6, honourguard: 11, cearl: 11, captain: 11 };

// ------------------------------------------------------------------ soma
// Soma is permanent. Each tier gives one key and needs far more soma than the last:
// tier 1 = 69, tier 10 = 23,220, tier 30 = 970,642, tier 50 = 5,561,734.
export const somaForTier = (t) => (t <= 0 ? 0 : Math.round(60 * t + 8.6 * t ** 3.42));
export function tierOf(soma) {
  soma = Math.max(0, soma);
  let t = Math.max(0, Math.floor((soma / 8.6) ** (1 / 3.42)) - 1);
  while (somaForTier(t + 1) <= soma) t++;
  while (t > 0 && somaForTier(t) > soma) t--;
  return t;
}

// ------------------------------------------------------------------ creatures and people
// ai: melee | kite | charger | leaper | caster | healer | summoner | exploder | slam | boss | kit (fights with tools)
// valor: the Valor the NPC carries (what killing it is worth). armor: defence. pack: [min, max] spawned together.
const M = (o) => ({ ai: 'melee', gold: 0, spd: 170, r: 14, ...o });
const P = (o) => M({ ai: 'kit', aggro: 320, ...o });
const O = (o) => M({ obj: 1, spd: 0, dmg: 0, range: 0, cd: 0, aggro: 0, valor: 0, ...o });
export const MOBS = {
  rat: M({ name: 'Giant Rat', hp: 10, dmg: 2.5, spd: 165, r: 10, range: 22, cd: 700, aggro: 220, valor: 9, pack: [3, 5] }),
  bat: M({ name: 'Cave Bat', hp: 8, dmg: 3, spd: 200, r: 10, range: 22, cd: 800, aggro: 260, valor: 9, pack: [3, 4] }),
  wolf: M({ name: 'Wolf', hp: 20, dmg: 4.5, spd: 150, r: 13, range: 26, cd: 900, aggro: 260, valor: 18, pack: [2, 3] }),
  boar: M({ name: 'Boar', hp: 32, dmg: 6, spd: 120, r: 14, range: 26, cd: 1100, aggro: 200, valor: 24, ai: 'charger' }),
  skeleton: M({ name: 'Skeleton Archer', hp: 24, dmg: 6, spd: 95, range: 330, cd: 1500, aggro: 380, valor: 36, ai: 'kite', ranged: true, proj: 'arrow' }),
  risen: M({ name: 'Risen', hp: 18, dmg: 4.5, spd: 115, r: 13, range: 30, cd: 1000, aggro: 320, valor: 9 }),
  spider: M({ name: 'Giant Spider', hp: 40, dmg: 7, spd: 135, r: 16, range: 28, cd: 1000, aggro: 280, valor: 48, ai: 'leaper' }),
  cultist: M({ name: 'Cultist', hp: 30, dmg: 9, spd: 90, range: 360, cd: 2000, aggro: 380, valor: 51, ai: 'caster', ranged: true, proj: 'dark' }),
  shaman: M({ name: 'Bog Shaman', hp: 28, dmg: 4, spd: 95, range: 300, cd: 1600, aggro: 360, valor: 48, ai: 'healer', ranged: true, proj: 'dark' }),
  scorpion: M({ name: 'Dune Scorpion', hp: 44, dmg: 6.5, spd: 125, r: 15, range: 30, cd: 1000, aggro: 260, valor: 48, onHit: 'poison' }),
  lizardman: M({ name: 'Lizardfolk', hp: 48, dmg: 8, spd: 120, r: 15, range: 42, cd: 1000, aggro: 300, valor: 54, pack: [1, 3] }),
  frost_wisp: M({ name: 'Frost Wisp', hp: 28, dmg: 7, spd: 120, r: 12, range: 300, cd: 1700, aggro: 360, valor: 60, ai: 'caster', ranged: true, proj: 'frost', onHit: 'slow' }),
  imp: M({ name: 'Ember Imp', hp: 22, dmg: 22, spd: 175, r: 11, range: 34, cd: 600, aggro: 300, valor: 48, ai: 'exploder', pack: [2, 3] }),
  bear: M({ name: 'Cave Bear', hp: 96, dmg: 11, spd: 115, r: 20, range: 34, cd: 1500, aggro: 240, valor: 78, ai: 'charger' }),
  yeti: M({ name: 'Yeti', hp: 120, dmg: 12, spd: 105, r: 22, range: 40, cd: 1500, aggro: 260, valor: 96, ai: 'slam', onHit: 'slow' }),
  golem: M({ name: 'Stone Golem', hp: 168, dmg: 13, spd: 75, r: 24, range: 42, cd: 1800, aggro: 240, valor: 108, ai: 'slam', armor: 35 }),
  ogre: M({ name: 'Ogre', hp: 128, dmg: 14, spd: 85, r: 23, range: 46, cd: 1800, aggro: 280, valor: 96, ai: 'slam' }),
  troll: M({ name: 'Moss Troll', hp: 136, dmg: 12, spd: 105, r: 22, range: 40, cd: 1300, aggro: 280, valor: 102, regen: 0.025 }),
  wraith: M({ name: 'Wraith', hp: 68, dmg: 11, spd: 150, r: 15, range: 36, cd: 1100, aggro: 400, valor: 90, onHit: 'drain' }),
  fire_elemental: M({ name: 'Fire Elemental', hp: 72, dmg: 11, spd: 100, r: 18, range: 320, cd: 1700, aggro: 380, valor: 102, ai: 'caster', ranged: true, proj: 'fire' }),
  necromancer: M({ name: 'Necromancer', hp: 60, dmg: 8, spd: 90, r: 15, range: 320, cd: 1800, aggro: 380, valor: 120, ai: 'summoner', ranged: true, proj: 'dark', minion: 'risen' }),
  // people: they fight with the same tools and numbers as players
  farmer: P({ name: 'Farmer', hp: 40, spd: 160, aggro: 260, valor: 10, kit: ['shortsword'], social: 1, pack: [2, 4] }),
  vagabond: P({ name: 'Vagabond', hp: 50, spd: 165, aggro: 300, valor: 15, kit: ['spear'], pack: [1, 2] }),
  ranger: P({ name: 'Ranger', hp: 50, spd: 165, aggro: 420, valor: 40, kit: ['sling'] }),
  reiver: P({ name: 'Reiver', hp: 80, valor: 60, kit: ['sabre', 'buckler'] }),
  alchemist: P({ name: 'Alchemist', hp: 60, spd: 160, aggro: 360, valor: 60, kit: ['bollock', 'naphtha', 'moonstone'] }),
  healer: P({ name: 'Healer', hp: 60, spd: 160, valor: 100, kit: ['bollock', 'tincture', 'blessing'], healer: 1 }),
  brigand: P({ name: 'Brigand', hp: 110, spd: 165, valor: 120, kit: ['battleaxe', 'targe'] }),
  pillager: P({ name: 'Pillager', hp: 90, valor: 150, kit: ['glaive'], roam: 1, gold: 20, pack: [2, 3] }),
  forest_steward: P({ name: 'Forest Steward', hp: 90, aggro: 460, valor: 200, kit: ['longbow', 'shadows'] }),
  cearl: P({ name: 'Cearl', hp: 120, spd: 160, valor: 300, kit: ['pollaxe', 'moonstone'] }),
  honourguard: P({ name: 'Honourguard', hp: 140, spd: 160, valor: 300, kit: ['greatsword', 'kite', 'parry'] }),
  captain: P({ name: 'Captain', hp: 180, spd: 160, r: 16, valor: 500, kit: ['halberd', 'scutum', 'riposte'], gold: 20 }),
  dweller: P({ name: 'Dweller', hp: 150, valor: 350, kits: [['flail', 'targe'], ['crossbow', 'rondel'], ['glaive', 'parry'], ['battleaxe', 'leeches']] }),
  hire_archer: P({ name: 'Hired Archer', hp: 50, valor: 0, kit: ['sling'] }),
  hire_merc: P({ name: 'Mercenary', hp: 70, valor: 0, kit: ['shortsword'] }),
  hire_guard: P({ name: 'Hired Guard', hp: 90, valor: 0, kit: ['spear', 'buckler'] }),
  hire_healer: P({ name: 'Hired Healer', hp: 50, valor: 0, kit: ['bollock', 'tincture'], healer: 1 }),
  // objects: logs to break for Wood, traps, deployed banners and bonfires
  logs: O({ name: 'Log Pile', hp: 10, r: 16 }),
  tripwire: O({ name: 'Tripwire', hp: 10, r: 12, trap: { r: 30, uses: 3, dmg: 5 } }),
  foothold: O({ name: 'Foothold Trap', hp: 20, r: 12, trap: { r: 26, root: 1500, dmg: 6 } }),
  sulphur: O({ name: 'Sulphur Trap', hp: 20, r: 12, trap: { r: 30, cloud: { r: 80, dps: 3, dur: 4000 } } }),
  brimstone: O({ name: 'Brimstone Trap', hp: 20, r: 12, trap: { r: 30, burst: { r: 60, dmg: 14 }, burn: { dps: 2, dur: 3000 } } }),
  spinner: O({ name: 'Spinner Trap', hp: 60, r: 14, trap: { r: 70, spin: { dmg: 6, every: 600, dur: 15000 } } }),
  gonfalon: O({ name: 'Gonfalon', hp: 120, r: 12, banner: { r: 180, def: 15 }, holds: 1, ttl: 120000 }),
  ensign: O({ name: 'Ensign', hp: 80, r: 12, banner: { r: 180, hot: 1 }, holds: 1, ttl: 120000 }),
  bonfire: O({ name: 'Bonfire', hp: 30, r: 14, fire: { r: 120, hot: 1.5 }, ttl: 60000 }),
  // dungeon bosses
  broodmother: M({ name: 'The Broodmother', hp: 1300, dmg: 11, spd: 115, r: 34, range: 52, cd: 1200, aggro: 520, valor: 2000, gold: 175, ai: 'boss', boss: 1, abilities: ['summon', 'charge', 'slam'], minion: 'rat' }),
  bone_king: M({ name: 'The Bone King', hp: 2100, dmg: 15, spd: 100, r: 30, range: 50, cd: 1200, aggro: 560, valor: 3000, gold: 250, ai: 'boss', boss: 1, abilities: ['barrage', 'summon', 'slam'], minion: 'risen', proj: 'dark' }),
  silkweaver: M({ name: 'Silkweaver', hp: 2000, dmg: 14, spd: 130, r: 36, range: 50, cd: 1100, aggro: 560, valor: 3000, gold: 250, ai: 'boss', boss: 1, abilities: ['leap', 'web', 'summon'], minion: 'spider' }),
  old_rime: M({ name: 'Old Rime', hp: 3250, dmg: 17, spd: 105, r: 38, range: 56, cd: 1400, aggro: 560, valor: 4000, gold: 375, ai: 'boss', boss: 1, abilities: ['slam', 'nova', 'charge'], onHit: 'slow', proj: 'frost' }),
  forgelord: M({ name: 'The Forgelord', hp: 4250, dmg: 20, spd: 85, r: 40, range: 58, cd: 1500, aggro: 560, valor: 5000, gold: 500, ai: 'boss', boss: 1, abilities: ['barrage', 'meteor', 'slam'], armor: 25, proj: 'fire' }),
  hollow_prince: M({ name: 'The Hollow Prince', hp: 6000, dmg: 22.5, spd: 140, r: 32, range: 50, cd: 1000, aggro: 600, valor: 6000, gold: 750, ai: 'boss', boss: 1, abilities: ['blink', 'barrage', 'nova', 'summon'], minion: 'wraith', onHit: 'drain', proj: 'dark' }),
};
// Names you can put in front of an order ("rangers follow").
export const TROOP_NAMES = { farmers: 'farmer', rangers: 'ranger', reivers: 'reiver', alchemists: 'alchemist', healers: 'healer', brigands: 'brigand', stewards: 'forest_steward', cearls: 'cearl', honourguards: 'honourguard', captains: 'captain', archers: 'hire_archer', mercenaries: 'hire_merc', guards: 'hire_guard' };
// Wild spawns by terrain: [kind, weight, lowest danger it appears at].
export const WILD_BY_BIOME = {
  grass: [['farmer', 5, 1], ['rat', 2, 1], ['wolf', 3, 1], ['boar', 3, 1], ['vagabond', 4, 1], ['ranger', 2, 2], ['pillager', 2, 2], ['shaman', 1, 3], ['ogre', 2, 4]],
  heath: [['farmer', 3, 1], ['boar', 3, 1], ['vagabond', 4, 1], ['wolf', 3, 1], ['ranger', 2, 2], ['pillager', 3, 2], ['ogre', 2, 3], ['necromancer', 1, 5]],
  forest: [['wolf', 4, 1], ['boar', 3, 1], ['vagabond', 2, 1], ['spider', 3, 2], ['pillager', 2, 2], ['bear', 2, 3], ['troll', 2, 4]],
  darkforest: [['spider', 4, 1], ['wraith', 2, 3], ['troll', 3, 3], ['cultist', 2, 2], ['pillager', 2, 2], ['necromancer', 1, 4]],
  snow: [['wolf', 4, 1], ['frost_wisp', 3, 2], ['yeti', 3, 3], ['bear', 2, 2], ['vagabond', 2, 1]],
  rock: [['bat', 3, 1], ['ranger', 3, 1], ['skeleton', 3, 2], ['pillager', 2, 2], ['golem', 2, 3], ['ogre', 2, 3]],
  ash: [['imp', 3, 1], ['cultist', 3, 2], ['fire_elemental', 3, 3], ['golem', 2, 4], ['pillager', 2, 2]],
  swamp: [['rat', 3, 1], ['lizardman', 4, 1], ['shaman', 2, 2], ['spider', 2, 1], ['necromancer', 1, 4], ['troll', 1, 4]],
  desert: [['scorpion', 4, 1], ['vagabond', 3, 1], ['skeleton', 3, 2], ['pillager', 3, 2], ['imp', 2, 3], ['golem', 1, 5]],
};
export const ELITE_AFFIXES = {
  swift: 'Swift: moves and attacks 40% faster.',
  armored: 'Armored: +40 defence.',
  vampiric: 'Vampiric: heals from the damage it deals.',
  volatile: 'Volatile: explodes when it dies.',
  frenzied: 'Frenzied: +50 attack below half health.',
};
const FORESTY = new Set(['forest', 'darkforest']);
export function garrisonFor(type, danger, level = 1, biome = 'grass') {
  const g = {
    fort: ['captain', 'reiver', 'reiver', 'reiver', 'ranger', 'ranger'],
    castle: ['captain', 'honourguard', 'reiver', 'reiver', 'brigand', 'brigand', 'alchemist', 'healer', 'ranger', 'ranger', 'ranger'],
    citadel: ['captain', 'captain', 'honourguard', 'honourguard', 'cearl', 'brigand', 'brigand', 'brigand', 'reiver', 'reiver', 'alchemist', 'alchemist', 'healer', 'ranger', 'ranger', 'ranger', 'ranger'],
  }[type].slice();
  for (let i = 1; i < danger; i += 2) g.push('reiver');
  for (let i = 1; i < level; i++) g.push('honourguard', 'alchemist');
  return FORESTY.has(biome) ? g.map((k) => (k === 'ranger' ? 'forest_steward' : k)) : g;
}
export const CASTLE_LEVEL_COST = [0, 0, 800, 2000]; // gold to raise a castle to level 2 and 3
export const CASTLE_TAX = 8; // gold per castle per minute, paid to each online member of the owning faction
// The three public factions everyone joins by default (private factions hold up to 10).
export const PUBLIC_FACTIONS = [
  { id: 1, name: 'The Red Hart', color: '#e74c3c' },
  { id: 2, name: 'The Azure Boar', color: '#3498db' },
  { id: 3, name: 'The Golden Wyvern', color: '#f1c40f' },
];
export const PRIVATE_MAX = 10;
