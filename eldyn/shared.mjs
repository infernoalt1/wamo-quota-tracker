// Hanbin Island: game data and world geometry shared by the server and the browser.
// The map is generated from a fixed seed, so both sides build exactly the same island.

export const MAP_SEED = 7331;
// IH is the island's height; the dungeons sit in their own caverns below it (y >= IH), reached by cave mouths.
export const WORLD = { W: 18000, IH: 12000, H: 20400, SAFE_R: 300 };
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

// ------------------------------------------------------------------ island shape
export function landValue(x, y) {
  if (y >= IH) return -1;
  const nx = (x / W - 0.5) * 2, ny = (y / IH - 0.5) * 2;
  const d = Math.pow(nx ** 4 + ny ** 4, 0.25);
  return 1 - d + (fbm(x / 1600, y / 1600, MAP_SEED, 4) - 0.5) * 0.7 - 0.04;
}

// ------------------------------------------------------------------ region names (built from syllables, never repeating)
const PRE = ['Frost', 'Pine', 'Grey', 'Storm', 'Gull', 'Wyrm', 'Thorn', 'Amber', 'Bracken', 'Red', 'Kestrel', 'Iron', 'Dusk', 'Salt', 'Willow', 'Cinder',
  'Gold', 'Raven', 'Moss', 'Dune', 'Coral', 'Ash', 'High', 'Elder', 'Bright', 'Hollow', 'Stone', 'Wolf', 'Oak', 'Mist', 'Sun', 'Black', 'Silver', 'Fen', 'Crow', 'Briar', 'Heron', 'Copper', 'Ember', 'Rook'];
const SUF = ['mere', 'crest', 'watch', 'hold', 'cliff', 'fang', 'wood', 'moor', 'ford', 'marsh', 'vale', 'reach', 'hollow', 'march', 'peak', 'meadow', 'gate', 'water', 'barrow', 'strand', 'field', 'dale', 'spire', 'fell', 'brook', 'rock', 'wick', 'combe', 'haven', 'stead'];

// ------------------------------------------------------------------ regions
const R0 = rng(MAP_SEED);
const SEEDS = [];
{
  const COLS = 8, ROWS = 6, cw = (W * 0.78) / COLS, ch = (IH * 0.76) / ROWS, MIN = 1720;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    SEEDS.push({ x: W * 0.11 + (c + 0.5) * cw + (R0() - 0.5) * cw * 0.45, y: IH * 0.12 + (r + 0.5) * ch + (R0() - 0.5) * ch * 0.45 });
  }
  // Push crowded centres apart so castles never sit on top of each other.
  for (let it = 0; it < 200; it++) for (let i = 0; i < SEEDS.length; i++) for (let j = i + 1; j < SEEDS.length; j++) {
    const a = SEEDS[i], b = SEEDS[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    if (d >= MIN) continue;
    const push = (MIN - d) / 2 / d;
    a.x -= dx * push; a.y -= dy * push; b.x += dx * push; b.y += dy * push;
    for (const s of [a, b]) {
      s.x = clamp(s.x, W * 0.09, W * 0.91); s.y = clamp(s.y, IH * 0.1, IH * 0.9);
      for (let k = 0; k < 30 && landValue(s.x, s.y) < 0.25; k++) { s.x += (W / 2 - s.x) * 0.02; s.y += (IH / 2 - s.y) * 0.02; }
    }
  }
  for (const s of SEEDS) { s.x = Math.round(s.x); s.y = Math.round(s.y); }
}
export const SANCTUARY = SEEDS.reduce((best, s, i) => (Math.hypot(s.x - W / 2, s.y - IH / 2) < Math.hypot(SEEDS[best].x - W / 2, SEEDS[best].y - IH / 2) ? i : best), 0);
export const VILLAGE = { x: SEEDS[SANCTUARY].x, y: SEEDS[SANCTUARY].y, r: WORLD.SAFE_R };

export const RC = 60, GW = Math.ceil(W / RC), GH = Math.ceil(IH / RC);
export const REGION_GRID = new Int8Array(GW * GH);
export const LAND_GRID = new Uint8Array(GW * GH);
for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
  const x = gx * RC + RC / 2, y = gy * RC + RC / 2;
  const wx = x + (fbm(x / 900, y / 900, MAP_SEED + 5, 2) - 0.5) * 900, wy = y + (fbm(x / 900, y / 900, MAP_SEED + 9, 2) - 0.5) * 900;
  let best = 0, bd = Infinity;
  for (let i = 0; i < SEEDS.length; i++) { const d = (SEEDS[i].x - wx) ** 2 + (SEEDS[i].y - wy) ** 2; if (d < bd) { bd = d; best = i; } }
  REGION_GRID[gy * GW + gx] = best;
  LAND_GRID[gy * GW + gx] = landValue(x, y) > 0 ? 1 : 0;
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
const parent = SEEDS.map(() => -1);
{
  const seen = new Set([SANCTUARY]), q = [SANCTUARY];
  while (q.length) { const a = q.shift(); for (const b of [...adj[a]].sort((m, n) => m - n)) if (!seen.has(b)) { seen.add(b); parent[b] = a; q.push(b); } }
}
function biomeFor(s, i) {
  if (i === SANCTUARY) return 'grass';
  const fx = s.x / W, fy = s.y / IH;
  if (fy < 0.28) return fx > 0.64 ? 'ash' : fx > 0.38 ? 'rock' : 'snow';
  if (fy > 0.72) return fx > 0.58 ? 'desert' : fx < 0.3 ? 'heath' : ['grass', 'heath'][i % 2];
  if (fx < 0.26) return fy < 0.5 ? 'darkforest' : 'forest';
  if (fx > 0.74) return 'swamp';
  return ['forest', 'grass', 'heath', 'grass'][i % 4];
}
// Danger by distance from the Haven, handed out by rank so every level exists: a safe heart, a deadly rim.
const DANGER = SEEDS.map(() => 0);
{
  const order = SEEDS.map((s, i) => i).filter((i) => i !== SANCTUARY).sort((a, b) => Math.hypot(SEEDS[a].x - VILLAGE.x, SEEDS[a].y - VILLAGE.y) - Math.hypot(SEEDS[b].x - VILLAGE.x, SEEDS[b].y - VILLAGE.y));
  const cuts = [0.1, 0.28, 0.48, 0.68, 0.86, 1];
  order.forEach((i, k) => { DANGER[i] = 1 + cuts.findIndex((c) => (k + 0.5) / order.length <= c); });
}
const NR = rng(MAP_SEED + 21), usedNames = new Set();
function regionName() {
  for (;;) { const n = PRE[Math.floor(NR() * PRE.length)] + SUF[Math.floor(NR() * SUF.length)]; if (!usedNames.has(n)) { usedNames.add(n); return n; } }
}
export const REGIONS = SEEDS.map((s, i) => ({
  id: i, x: s.x, y: s.y, biome: biomeFor(s, i),
  name: i === SANCTUARY ? 'Hanbin Haven' : regionName(),
  danger: DANGER[i],
  neighbors: [...adj[i]],
}));
export const ISLAND_REGIONS = REGIONS.length;

// ------------------------------------------------------------------ castle layouts
// Forts guard the safe heartland, castles the middle ring, citadels (with a moat) the dangerous coasts.
// All coordinates are relative to the castle's centre. Walls are [x, y, w, h].
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
export const CASTLE_TYPES = {
  fort: {
    name: 'Fort', walls: ring(240, 26, 'NS', 120), towers: corners(240, 26, 36), keep: [-66, -70, 132, 96], moat: [],
    outer: 240, inner: 212, rings: [[240, 26]],
  },
  castle: {
    name: 'Castle', walls: [...ring(350, 28, 'S', 130), ...ring(180, 22, 'N', 104)], towers: [...corners(350, 28, 42), ...corners(180, 22, 28)], keep: [-52, -46, 104, 80], moat: [],
    outer: 350, inner: 158, rings: [[350, 28], [180, 22]],
  },
  citadel: {
    name: 'Citadel', walls: [...ring(450, 30, 'S', 130), ...ring(305, 26, 'N', 120), ...ring(170, 22, 'S', 100)],
    towers: [...corners(450, 30, 46), ...corners(305, 26, 34), ...corners(170, 22, 26)], keep: [-48, -42, 96, 72],
    moat: ring(540, 56, 'S', 150), outer: 540, inner: 148, rings: [[450, 30], [305, 26], [170, 22]],
  },
};
// Bigger layouts on coastal sites that cannot fit them step down to a smaller one.
const fits = (type, x, y) => { const o = CASTLE_TYPES[type].outer + 40; return [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [1, 0], [-1, 0], [0, -1]].every(([a, b]) => landValue(x + a * o, y + b * o) > 0); };
function castleType(danger, x, y) {
  const want = danger <= 2 ? 'fort' : danger <= 4 ? 'castle' : 'citadel', order = ['citadel', 'castle', 'fort'];
  return order.slice(order.indexOf(want)).find((t) => fits(t, x, y)) || 'fort';
}
export const CASTLES = REGIONS.filter((r) => r.id !== SANCTUARY).map((r) => {
  const type = castleType(r.danger, r.x, r.y);
  return { id: r.id, x: r.x, y: r.y, type, name: `${r.name} ${CASTLE_TYPES[type].name}`, danger: r.danger };
});
export const castleOf = (regionId) => CASTLES.find((c) => c.id === regionId) || null;
// The courtyard you must hold to capture (the innermost ring).
export const inCastle = (c, x, y) => { const L = CASTLE_TYPES[c.type]; return Math.abs(x - c.x) < L.inner && Math.abs(y - c.y) < L.inner; };
export const inCastleWalls = (c, x, y) => { const L = CASTLE_TYPES[c.type]; return Math.abs(x - c.x) < L.outer && Math.abs(y - c.y) < L.outer; };

// Roads follow the route outward from the sanctuary, entering each castle by its south gate.
export const ROADS = [];
for (let b = 0; b < SEEDS.length; b++) {
  const a = parent[b]; if (a < 0) continue;
  const A = SEEDS[a], B = SEEDS[b];
  let wet = false;
  for (let t = 0; t <= 1; t += 0.04) if (landValue(A.x + (B.x - A.x) * t, A.y + (B.y - A.y) * t) <= 0) wet = true;
  if (!wet) ROADS.push({ x0: A.x, y0: A.y, x1: B.x, y1: B.y });
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
  { name: 'Rat Warrens', danger: 2, theme: 'warren', mobs: [['rat', 5], ['bat', 3], ['bandit', 1]], boss: 'broodmother', biomes: ['grass', 'heath', 'swamp'] },
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
export const VALOR_CAP = 8000;
// Each rank keeps the rewards of the ranks below it. Dying costs 75% of valor, so rewards can be lost.
export const RANKS = [
  { name: 'Peasant', v: 0, perk: 'Every journey starts somewhere.' },
  { name: 'Squire', v: 80, perk: '+10% max health.' },
  { name: 'Soldier', v: 250, perk: '+8% damage.' },
  { name: 'Knight', v: 600, perk: 'Recall: teleport home to Hanbin Haven after an 8s channel.' },
  { name: 'Baron', v: 1200, perk: 'Fort travel: teleport to any castle your faction holds (open the map).' },
  { name: 'Count', v: 2000, perk: '+10% more max health, energy regenerates 15% faster.' },
  { name: 'Duke', v: 3200, perk: 'Commander aura: faction allies near you deal 10% more damage.' },
  { name: 'Prince', v: 5000, perk: 'Swift travel: teleports take 3s. +8% move speed.' },
  { name: 'King', v: 8000, perk: 'Royal might: +10% more damage and max health. All of Hanbin hears of your fall.' },
];
export const RECALL_RANK = 3, TRAVEL_RANK = 4, AURA_RANK = 6;
export function rankBonus(idx) {
  return {
    hp: 1 + (idx >= 1 ? 0.1 : 0) + (idx >= 5 ? 0.1 : 0) + (idx >= 8 ? 0.1 : 0),
    dmg: 1 + (idx >= 2 ? 0.08 : 0) + (idx >= 8 ? 0.1 : 0),
    en: idx >= 5 ? 1.15 : 1, speed: idx >= 7 ? 1.08 : 1,
    channel: idx >= 7 ? 3000 : 8000,
  };
}
// Status combos, shown in the help and on the skills that set them up.
export const COMBOS = [
  ['Shatter', 'Fire on a Chilled foe (Frost Nova, Frostbite, Cryomancy, Blizzard) deals +60% and breaks the chill.'],
  ['Ignite', 'Fire on a poisoned foe (Poison Flask, Venom Blades) bursts into flame, hitting everything nearby.'],
  ['Crush', 'Melee hits on a stunned foe deal +35% (Shield Bash, Concussion, Ground Slam).'],
  ['Pinned', 'Ranged hits deal double damage to a rooted foe (Snare Trap, Javelin).'],
  ['Wall Slam', 'Knocking a foe into a wall, tower or rock stuns it for 1s and deals extra damage.'],
  ['Marked', "Crippling Shot and Hunter's Mark: you and your allies deal +20% damage to the foe."],
  ['Exposed', 'Exposed foes (Parry, Riposte, War Cry, Smoke Bomb) take +15% damage and deal 40% less.'],
  ['Backstab', 'Daggers deal +30% to foes that are not facing you, so let a friend or a summon hold their attention.'],
];
export function rankOf(valor) {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) if (valor >= RANKS[i].v) idx = i;
  return { idx, name: RANKS[idx].name, next: RANKS[idx + 1] ? RANKS[idx + 1].v : null, cur: RANKS[idx].v };
}

// ------------------------------------------------------------------ soma
// Each tier costs 22% more than the last, so the climb is quick at first and long later:
// tier 5 ≈ 460 soma, tier 10 ≈ 1,700, tier 15 ≈ 5,100, tier 20 ≈ 14,300, tier 25 ≈ 39,000.
export const somaForTier = (t) => (t <= 0 ? 0 : Math.round((60 * (1.22 ** t - 1)) / 0.22));
export function tierOf(soma) {
  soma = Math.max(0, soma);
  let t = Math.floor(Math.log(1 + (soma * 0.22) / 60) / Math.log(1.22));
  while (somaForTier(t + 1) <= soma) t++;
  while (t > 0 && somaForTier(t) > soma) t--;
  return t;
}
// Relic (inventory) slots: one to start, another every 4 tiers, up to 6.
export const relicSlotsForTier = (t) => Math.min(6, 1 + Math.floor(t / 4));

// ------------------------------------------------------------------ creatures
// ai: melee | kite (keeps its distance) | charger (winds up, then rushes) | leaper | caster (bolts + ground blasts)
//     healer | summoner | exploder | slam (heavy hits + ground slams) | boss
// onHit: poison | slow | drain.  armor: share of damage ignored.  pack: [min, max] spawned together.
const M = (o) => ({ ai: 'melee', gold: Math.ceil((o.soma || 0) * 0.6), ...o });
export const MOBS = {
  rat: M({ name: 'Giant Rat', hp: 24, dmg: 5, spd: 165, r: 10, range: 22, cd: 700, aggro: 220, valor: 1, soma: 3, pack: [3, 5] }),
  bat: M({ name: 'Cave Bat', hp: 20, dmg: 6, spd: 200, r: 10, range: 22, cd: 800, aggro: 260, valor: 1, soma: 3, pack: [3, 4] }),
  wolf: M({ name: 'Wolf', hp: 50, dmg: 9, spd: 150, r: 13, range: 26, cd: 900, aggro: 260, valor: 2, soma: 6, pack: [2, 3] }),
  boar: M({ name: 'Boar', hp: 80, dmg: 12, spd: 120, r: 14, range: 26, cd: 1100, aggro: 200, valor: 2, soma: 8, ai: 'charger' }),
  bandit: M({ name: 'Bandit', hp: 80, dmg: 11, spd: 115, r: 14, range: 32, cd: 1000, aggro: 300, valor: 3, soma: 10, pack: [1, 3] }),
  bandit_archer: M({ name: 'Bandit Archer', hp: 60, dmg: 10, spd: 112, r: 14, range: 320, cd: 1400, aggro: 360, valor: 3, soma: 10, ai: 'kite', ranged: true, proj: 'arrow' }),
  skeleton: M({ name: 'Skeleton Archer', hp: 60, dmg: 12, spd: 95, r: 14, range: 330, cd: 1500, aggro: 380, valor: 4, soma: 12, ai: 'kite', ranged: true, proj: 'arrow' }),
  risen: M({ name: 'Risen', hp: 45, dmg: 9, spd: 115, r: 13, range: 30, cd: 1000, aggro: 320, valor: 1, soma: 3 }),
  spider: M({ name: 'Giant Spider', hp: 100, dmg: 14, spd: 135, r: 16, range: 28, cd: 1000, aggro: 280, valor: 5, soma: 16, ai: 'leaper' }),
  cultist: M({ name: 'Cultist', hp: 75, dmg: 18, spd: 90, r: 14, range: 360, cd: 2000, aggro: 380, valor: 5, soma: 17, ai: 'caster', ranged: true, proj: 'dark' }),
  shaman: M({ name: 'Bog Shaman', hp: 70, dmg: 8, spd: 95, r: 14, range: 300, cd: 1600, aggro: 360, valor: 5, soma: 16, ai: 'healer', ranged: true, proj: 'dark' }),
  scorpion: M({ name: 'Dune Scorpion', hp: 110, dmg: 13, spd: 125, r: 15, range: 30, cd: 1000, aggro: 260, valor: 5, soma: 16, onHit: 'poison' }),
  lizardman: M({ name: 'Lizardfolk', hp: 120, dmg: 16, spd: 120, r: 15, range: 42, cd: 1000, aggro: 300, valor: 6, soma: 18, pack: [1, 3] }),
  frost_wisp: M({ name: 'Frost Wisp', hp: 70, dmg: 14, spd: 120, r: 12, range: 300, cd: 1700, aggro: 360, valor: 6, soma: 20, ai: 'caster', ranged: true, proj: 'frost', onHit: 'slow' }),
  imp: M({ name: 'Ember Imp', hp: 55, dmg: 45, spd: 175, r: 11, range: 34, cd: 600, aggro: 300, valor: 5, soma: 16, ai: 'exploder', pack: [2, 3] }),
  bear: M({ name: 'Cave Bear', hp: 240, dmg: 22, spd: 115, r: 20, range: 34, cd: 1500, aggro: 240, valor: 8, soma: 26, ai: 'charger' }),
  yeti: M({ name: 'Yeti', hp: 300, dmg: 24, spd: 105, r: 22, range: 40, cd: 1500, aggro: 260, valor: 10, soma: 32, ai: 'slam', onHit: 'slow' }),
  golem: M({ name: 'Stone Golem', hp: 420, dmg: 26, spd: 75, r: 24, range: 42, cd: 1800, aggro: 240, valor: 11, soma: 36, ai: 'slam', armor: 0.35 }),
  ogre: M({ name: 'Ogre', hp: 320, dmg: 28, spd: 85, r: 23, range: 46, cd: 1800, aggro: 280, valor: 10, soma: 32, ai: 'slam' }),
  troll: M({ name: 'Moss Troll', hp: 340, dmg: 24, spd: 105, r: 22, range: 40, cd: 1300, aggro: 280, valor: 11, soma: 34, regen: 0.025 }),
  wraith: M({ name: 'Wraith', hp: 170, dmg: 22, spd: 150, r: 15, range: 36, cd: 1100, aggro: 400, valor: 9, soma: 30, onHit: 'drain' }),
  fire_elemental: M({ name: 'Fire Elemental', hp: 180, dmg: 22, spd: 100, r: 18, range: 320, cd: 1700, aggro: 380, valor: 10, soma: 34, ai: 'caster', ranged: true, proj: 'fire' }),
  necromancer: M({ name: 'Necromancer', hp: 150, dmg: 16, spd: 90, r: 15, range: 320, cd: 1800, aggro: 380, valor: 12, soma: 40, ai: 'summoner', ranged: true, proj: 'dark', minion: 'risen' }),
  // castle garrisons
  guard: M({ name: 'Guard', hp: 130, dmg: 14, spd: 105, r: 14, range: 36, cd: 900, aggro: 320, valor: 6, soma: 16 }),
  archer: M({ name: 'Archer', hp: 85, dmg: 13, spd: 95, r: 14, range: 340, cd: 1300, aggro: 380, valor: 6, soma: 16, ai: 'kite', ranged: true, proj: 'arrow' }),
  castle_mage: M({ name: 'Battle Mage', hp: 110, dmg: 20, spd: 95, r: 14, range: 340, cd: 1800, aggro: 380, valor: 8, soma: 22, ai: 'caster', ranged: true, proj: 'fire' }),
  knight_guard: M({ name: 'Castle Knight', hp: 280, dmg: 24, spd: 110, r: 16, range: 38, cd: 1000, aggro: 340, valor: 12, soma: 34, armor: 0.2 }),
  captain: M({ name: 'Captain', hp: 450, dmg: 28, spd: 100, r: 18, range: 42, cd: 1100, aggro: 340, valor: 25, soma: 70, ai: 'slam' }),
  // summons
  footman: M({ name: 'Footman', hp: 90, dmg: 11, spd: 135, r: 14, range: 32, cd: 900, aggro: 320, valor: 0, soma: 0 }),
  summoned_archer: M({ name: 'Archer', hp: 70, dmg: 12, spd: 125, r: 13, range: 320, cd: 1100, aggro: 360, valor: 0, soma: 0, ai: 'kite', ranged: true, proj: 'arrow' }),
  knight: M({ name: 'Knight', hp: 230, dmg: 24, spd: 130, r: 16, range: 38, cd: 900, aggro: 340, valor: 0, soma: 0 }),
  banner: M({ name: 'War Banner', hp: 150, dmg: 0, spd: 0, r: 12, range: 0, cd: 0, aggro: 0, valor: 0, soma: 0 }),
  // dungeon bosses
  broodmother: M({ name: 'The Broodmother', hp: 2600, dmg: 22, spd: 115, r: 34, range: 52, cd: 1200, aggro: 520, valor: 120, soma: 500, gold: 350, ai: 'boss', boss: 1, abilities: ['summon', 'charge', 'slam'], minion: 'rat' }),
  bone_king: M({ name: 'The Bone King', hp: 4200, dmg: 30, spd: 100, r: 30, range: 50, cd: 1200, aggro: 560, valor: 180, soma: 800, gold: 500, ai: 'boss', boss: 1, abilities: ['barrage', 'summon', 'slam'], minion: 'risen', proj: 'dark' }),
  silkweaver: M({ name: 'Silkweaver', hp: 4000, dmg: 28, spd: 130, r: 36, range: 50, cd: 1100, aggro: 560, valor: 180, soma: 800, gold: 500, ai: 'boss', boss: 1, abilities: ['leap', 'web', 'summon'], minion: 'spider' }),
  old_rime: M({ name: 'Old Rime', hp: 6500, dmg: 34, spd: 105, r: 38, range: 56, cd: 1400, aggro: 560, valor: 260, soma: 1300, gold: 750, ai: 'boss', boss: 1, abilities: ['slam', 'nova', 'charge'], onHit: 'slow', proj: 'frost' }),
  forgelord: M({ name: 'The Forgelord', hp: 8500, dmg: 40, spd: 85, r: 40, range: 58, cd: 1500, aggro: 560, valor: 340, soma: 1800, gold: 1000, ai: 'boss', boss: 1, abilities: ['barrage', 'meteor', 'slam'], armor: 0.25, proj: 'fire' }),
  hollow_prince: M({ name: 'The Hollow Prince', hp: 12000, dmg: 45, spd: 140, r: 32, range: 50, cd: 1000, aggro: 600, valor: 450, soma: 2600, gold: 1500, ai: 'boss', boss: 1, abilities: ['blink', 'barrage', 'nova', 'summon'], minion: 'wraith', onHit: 'drain', proj: 'dark' }),
};
// Wild spawns by terrain: [kind, weight, lowest danger it appears at].
export const WILD_BY_BIOME = {
  grass: [['rat', 3, 1], ['wolf', 4, 1], ['boar', 4, 1], ['bandit', 3, 1], ['bandit_archer', 2, 2], ['shaman', 1, 3], ['ogre', 2, 4]],
  heath: [['boar', 4, 1], ['bandit', 4, 1], ['wolf', 3, 1], ['bandit_archer', 3, 2], ['ogre', 2, 3], ['necromancer', 1, 5]],
  forest: [['wolf', 4, 1], ['boar', 3, 1], ['spider', 3, 2], ['bandit', 2, 1], ['bear', 2, 3], ['troll', 2, 4]],
  darkforest: [['spider', 4, 1], ['wraith', 2, 3], ['troll', 3, 3], ['cultist', 2, 2], ['necromancer', 1, 4]],
  snow: [['wolf', 4, 1], ['frost_wisp', 3, 2], ['yeti', 3, 3], ['bear', 2, 2]],
  rock: [['bat', 3, 1], ['bandit_archer', 3, 1], ['skeleton', 3, 2], ['golem', 2, 3], ['ogre', 2, 3]],
  ash: [['imp', 3, 1], ['cultist', 3, 2], ['fire_elemental', 3, 3], ['golem', 2, 4]],
  swamp: [['rat', 3, 1], ['lizardman', 4, 1], ['shaman', 2, 2], ['spider', 2, 1], ['necromancer', 1, 4], ['troll', 1, 4]],
  desert: [['scorpion', 4, 1], ['bandit', 3, 1], ['skeleton', 3, 2], ['imp', 2, 3], ['golem', 1, 5]],
};
export const ELITE_AFFIXES = {
  swift: 'Swift: moves and attacks 40% faster.',
  armored: 'Armored: ignores 40% of damage.',
  vampiric: 'Vampiric: heals from the damage it deals.',
  volatile: 'Volatile: explodes when it dies.',
  frenzied: 'Frenzied: deals 50% more damage below half health.',
};
export function garrisonFor(type, danger, level = 1) {
  const g = { fort: ['captain', 'guard', 'guard', 'guard', 'archer', 'archer'], castle: ['captain', 'knight_guard', 'guard', 'guard', 'guard', 'guard', 'guard', 'archer', 'archer', 'archer', 'castle_mage'],
    citadel: ['captain', 'captain', 'knight_guard', 'knight_guard', 'knight_guard', 'guard', 'guard', 'guard', 'guard', 'guard', 'guard', 'archer', 'archer', 'archer', 'archer', 'castle_mage', 'castle_mage'] }[type].slice();
  for (let i = 1; i < danger; i += 2) g.push('guard');
  for (let i = 1; i < level; i++) g.push('knight_guard', 'castle_mage');
  return g;
}
export const CASTLE_LEVEL_COST = [0, 0, 800, 2000]; // gold to raise a castle to level 2 and 3
export const CASTLE_TAX = 8; // gold per castle per minute, paid to each online member of the owning faction

// ------------------------------------------------------------------ relics
// Equipped relics change every attack you make; the fun is in stacking ones that feed each other.
export const RARITIES = {
  common: { name: 'Common', color: '#cfcfcf', salvage: 25, fuse: 60 },
  rare: { name: 'Rare', color: '#4fa3ff', salvage: 70, fuse: 180 },
  epic: { name: 'Epic', color: '#b46aff', salvage: 220, fuse: 500 },
  legendary: { name: 'Legendary', color: '#ffb030', salvage: 700, fuse: 1500 },
};
export const MAX_RELIC_LV = 5, MAX_STASH = 40;
const RL = (id, name, rarity, icon, stat, base, per, text) => ({ id, name, rarity, icon, stat, base, per, text });
export const RELIC_LIST = [
  RL('iron_band', 'Iron Band', 'common', '💍', 'maxhp', 0.08, 0.02, '+{v}% max health.'),
  RL('whetstone', 'Whetstone', 'common', '🪨', 'dmg', 0.06, 0.015, '+{v}% damage.'),
  RL('swift_boots', 'Swift Boots', 'common', '👢', 'speed', 0.06, 0.01, '+{v}% move speed.'),
  RL('mana_pearl', 'Mana Pearl', 'common', '🔵', 'en', 0.2, 0.05, '+{v}% energy regeneration.'),
  RL('thorn_shard', 'Thorn Shard', 'common', '🌵', 'thorns', 0.2, 0.06, 'Melee attackers take {v}% of the damage they deal to you.'),
  RL('brawler_knuckles', "Brawler's Knuckles", 'common', '👊', 'close', 0.25, 0.06, '+{v}% damage to foes within 130 range.'),
  RL('hunters_lens', "Hunter's Lens", 'common', '🔭', 'far', 0.22, 0.05, '+{v}% damage to foes more than 320 away.'),
  RL('quiver_charm', 'Quiver Charm', 'common', '🎐', 'range', 0.2, 0.05, 'Projectiles fly {v}% farther.'),
  RL('leech_fang', 'Leech Fang', 'rare', '🦷', 'lifesteal', 0.05, 0.012, 'Heal for {v}% of all damage you deal.'),
  RL('shrapnel_core', 'Shrapnel Core', 'rare', '💣', 'splash', 0.25, 0.05, '{v}% of every hit splashes onto foes near the target.'),
  RL('ember_sigil', 'Ember Sigil', 'rare', '🔥', 'burn', 0.3, 0.06, 'Hits set foes ablaze for {v}% of the hit over 3s.'),
  RL('frost_shard', 'Frost Shard', 'rare', '🧊', 'chill', 0.12, 0.03, 'Hits slow foes, and slowed foes take +{v}% damage.'),
  RL('keen_edge', 'Keen Edge', 'rare', '🗡️', 'crit', 0.1, 0.02, '{v}% chance to critically strike for 175% damage.'),
  RL('storm_coil', 'Storm Coil', 'rare', '⚡', 'chain', 0.15, 0.03, '{v}% chance on hit to arc lightning to 2 more foes for half damage.'),
  RL('bloodthirst', 'Bloodthirst Charm', 'rare', '🩸', 'healOnKill', 0.06, 0.015, 'Kills heal you for {v}% of your max health.'),
  RL('hourglass', 'Sand Hourglass', 'rare', '⏳', 'cdr', 0.08, 0.02, 'Ability cooldowns are {v}% shorter.'),
  RL('bulwark', 'Bulwark Plate', 'rare', '🛡️', 'dr', 0.08, 0.02, 'Take {v}% less damage.'),
  RL('lodestone', 'Gravity Lodestone', 'epic', '🧲', 'pull', 35, 6, 'Your hits drag foes {v} closer, and every 5s a pulse pulls in foes within 260.'),
  RL('corpse_bloom', 'Corpse Bloom', 'epic', '🌺', 'explode', 0.25, 0.05, 'Foes you kill burst for {v}% of their max health, hitting those nearby. Bursts can chain.'),
  RL('berserker_mark', "Berserker's Mark", 'epic', '😤', 'berserk', 0.4, 0.08, 'Up to +{v}% damage as your health falls.'),
  RL('warlord_standard', "Warlord's Standard", 'epic', '🏳️', 'summon', 0.25, 0.05, 'Your summons deal +{v}% damage and use your Leech Fang and Ember Sigil.'),
  RL('momentum_spur', 'Momentum Spur', 'epic', '🏇', 'momentum', 0.24, 0.04, 'Damage builds by 4% per second while you keep moving, up to +{v}%.'),
  RL('headsman_seal', "Headsman's Seal", 'epic', '🪓', 'execute', 0.4, 0.08, '+{v}% damage to foes under 30% health.'),
  RL('maelstrom_heart', 'Heart of the Maelstrom', 'legendary', '🌀', 'nova', 60, 12, 'Every 8th hit releases a storm nova dealing {v} damage around the target.'),
  RL('phoenix_feather', 'Phoenix Feather', 'legendary', '🪶', 'phoenix', 0.3, 0.05, 'Once every 3 minutes, a killing blow instead leaves you at {v}% health and erupts in flame.'),
  RL('titan_grip', "Titan's Grip", 'legendary', '🦾', 'titan', 0.3, 0.06, 'Melee attacks reach {v}% farther and knock foes back.'),
  RL('prism_echoes', 'Prism of Echoes', 'legendary', '🔮', 'echo', 0.5, 0.1, 'Splash, lightning, nova, burst and burn damage also trigger your on-hit relics at {v}% strength.'),
];
export const RELICS = Object.fromEntries(RELIC_LIST.map((r) => [r.id, r]));
export const relicValue = (id, lv) => RELICS[id].base + RELICS[id].per * (lv - 1);
export function relicText(id, lv) {
  const r = RELICS[id], v = relicValue(id, lv);
  return r.text.replace('{v}', r.stat === 'pull' || r.stat === 'nova' ? Math.round(v) : Math.round(v * 1000) / 10);
}
// Suggested builds, shown in the inventory so players can see what feeds what.
export const SYNERGIES = [
  ['Black Hole Brawler', "Gravity Lodestone + Brawler's Knuckles + Leech Fang on a Greataxe with Wide Swings and Bloodlust. Pull everything in, then cleave it all while healing."],
  ['Chain Reaction', 'Corpse Bloom + Shrapnel Core + Prism of Echoes on a Runestaff with Wide Burst. One kill sets off the whole pack.'],
  ['Inferno', 'Ember Sigil + Shrapnel Core with Pyromancy, Kindling and Poison Flask. Splash spreads the burn, and fire on poison Ignites.'],
  ['Deadeye', "Hunter's Lens + Keen Edge + Headsman's Seal on a Longbow with Far Sight, Deadly Strikes and Assassin. Huge crits from long range."],
  ['Shadow Dancer', 'Keen Edge + Storm Coil on Twin Daggers with Backstab, Lacerate and Tumble. Roll behind a foe, then shred it.'],
  ['Phalanx', 'Frost Shard + Iron Band on a War Spear with Keep Away, Skewer and Formation. Hold a whole line of foes at the tip of your spear.'],
  ['Iron Fortress', 'Bulwark Plate + Thorn Shard + Iron Band on a Longsword with Shield Block, Retaliation and Thick Skin. Let them hit you.'],
  ['Warlord', "Warlord's Standard + Leech Fang + Ember Sigil with the Command tree. Your troops burn and drain for you."],
  ['Storm Caller', 'Storm Coil + Heart of the Maelstrom + Prism of Echoes with Static Charge and Chain Lightning. Lightning that keeps setting off more lightning.'],
  ['Berserker', "Berserker's Mark + Leech Fang + Bloodthirst Charm with Berserker and Rampage. Strongest when nearly dead."],
];
export const CRATES = {
  crate: { name: 'Relic Crate', price: 150, odds: [['common', 0.7], ['rare', 0.26], ['epic', 0.04]] },
  gilded: { name: 'Gilded Crate', price: 700, odds: [['common', 0.25], ['rare', 0.5], ['epic', 0.22], ['legendary', 0.03]] },
};
