// Hanbin Island: game data and world geometry shared by the server and the browser.
// The map is generated from a fixed seed, so both sides build exactly the same island.

export const MAP_SEED = 7331;
export const WORLD = { W: 9600, H: 6400, CASTLE_HALF: 230, WALL: 26, GATE: 120, TOWER_R: 36, KEEP_W: 132, KEEP_H: 96, SAFE_R: 300 };
const { W, H, CASTLE_HALF: CH, WALL, GATE, TOWER_R } = WORLD;

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
  const nx = (x / W - 0.5) * 2, ny = (y / H - 0.5) * 2;
  const d = Math.pow(nx ** 4 + ny ** 4, 0.25);
  return 1 - d + (fbm(x / 1100, y / 1100, MAP_SEED, 4) - 0.5) * 0.7 - 0.04;
}
export const isLand = (x, y) => landValue(x, y) > 0;

// ------------------------------------------------------------------ regions
const NAMES = ['Frostmere', 'Pinecrest', 'Greywatch', 'Stormhold', 'Gullcliff', 'Wyrmfang', 'Thornwood', 'Ambermoor', 'Brackenford', 'Redmarsh',
  'Kestrel Vale', 'Ironreach', 'Duskhollow', 'Saltmarch', 'Willowmere', 'Cinderpeak', 'Goldmeadow', 'Ravensgate', 'Mosswater', 'Dunewatch',
  'Coralstrand', 'Ashfield', 'Highbarrow'];
const R0 = rng(MAP_SEED);
const SEEDS = [];
{
  const COLS = 6, ROWS = 4, cw = (W * 0.74) / COLS, ch = (H * 0.72) / ROWS;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    let x = W * 0.13 + (c + 0.5) * cw + (R0() - 0.5) * cw * 0.45;
    let y = H * 0.14 + (r + 0.5) * ch + (R0() - 0.5) * ch * 0.45;
    SEEDS.push({ x, y });
  }
  // Push crowded centres apart so no castle sits on top of another (or of the village).
  for (let it = 0; it < 60; it++) for (let i = 0; i < SEEDS.length; i++) for (let j = i + 1; j < SEEDS.length; j++) {
    const a = SEEDS[i], b = SEEDS[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    if (d >= 1300) continue;
    const push = (1300 - d) / 2 / d;
    a.x -= dx * push; a.y -= dy * push; b.x += dx * push; b.y += dy * push;
    for (const s of [a, b]) {
      s.x = clamp(s.x, W * 0.1, W * 0.9); s.y = clamp(s.y, H * 0.12, H * 0.88);
      for (let k = 0; k < 20 && landValue(s.x, s.y) < 0.3; k++) { s.x += (W / 2 - s.x) * 0.05; s.y += (H / 2 - s.y) * 0.05; }
    }
  }
  for (const s of SEEDS) { s.x = Math.round(s.x); s.y = Math.round(s.y); }
}
export const SANCTUARY = SEEDS.reduce((best, s, i) => (Math.hypot(s.x - W / 2, s.y - H / 2) < Math.hypot(SEEDS[best].x - W / 2, SEEDS[best].y - H / 2) ? i : best), 0);
export const VILLAGE = { x: SEEDS[SANCTUARY].x, y: SEEDS[SANCTUARY].y, r: WORLD.SAFE_R };

export const RC = 40, GW = Math.ceil(W / RC), GH = Math.ceil(H / RC);
export const REGION_GRID = new Int8Array(GW * GH);
export const LAND_GRID = new Uint8Array(GW * GH);
for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
  const x = gx * RC + RC / 2, y = gy * RC + RC / 2;
  const wx = x + (fbm(x / 700, y / 700, MAP_SEED + 5, 2) - 0.5) * 700, wy = y + (fbm(x / 700, y / 700, MAP_SEED + 9, 2) - 0.5) * 700;
  let best = 0, bd = Infinity;
  for (let i = 0; i < SEEDS.length; i++) { const d = (SEEDS[i].x - wx) ** 2 + (SEEDS[i].y - wy) ** 2; if (d < bd) { bd = d; best = i; } }
  REGION_GRID[gy * GW + gx] = best;
  LAND_GRID[gy * GW + gx] = landValue(x, y) > 0 ? 1 : 0;
}
export const regionAt = (x, y) => REGION_GRID[clamp(Math.floor(y / RC), 0, GH - 1) * GW + clamp(Math.floor(x / RC), 0, GW - 1)];

// Neighbouring regions, danger by distance from the sanctuary, and the land cells in each region.
const adj = SEEDS.map(() => new Set());
export const REGION_CELLS = SEEDS.map(() => []);
for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
  const i = gy * GW + gx; if (!LAND_GRID[i]) continue;
  const a = REGION_GRID[i];
  REGION_CELLS[a].push(i);
  if (gx + 1 < GW && LAND_GRID[i + 1] && REGION_GRID[i + 1] !== a) { adj[a].add(REGION_GRID[i + 1]); adj[REGION_GRID[i + 1]].add(a); }
  if (gy + 1 < GH && LAND_GRID[i + GW] && REGION_GRID[i + GW] !== a) { adj[a].add(REGION_GRID[i + GW]); adj[REGION_GRID[i + GW]].add(a); }
}
const depth = SEEDS.map(() => Infinity), parent = SEEDS.map(() => -1);
{
  depth[SANCTUARY] = 0; const q = [SANCTUARY];
  while (q.length) { const a = q.shift(); for (const b of [...adj[a]].sort((m, n) => m - n)) if (depth[b] === Infinity) { depth[b] = depth[a] + 1; parent[b] = a; q.push(b); } }
}
function biomeFor(s, i) {
  if (i === SANCTUARY) return 'grass';
  const fx = s.x / W, fy = s.y / H;
  if (fy < 0.3) return fx > 0.62 ? 'ash' : fx > 0.38 ? 'rock' : 'snow';
  if (fy > 0.7) return fx > 0.55 ? 'desert' : fx < 0.3 ? 'heath' : 'grass';
  if (fx < 0.3) return fy < 0.5 ? 'darkforest' : 'forest';
  if (fx > 0.72) return 'swamp';
  return ['forest', 'grass', 'heath'][i % 3];
}
let nameI = 0;
export const REGIONS = SEEDS.map((s, i) => ({
  id: i, x: s.x, y: s.y, biome: biomeFor(s, i),
  name: i === SANCTUARY ? 'Hanbin Haven' : NAMES[nameI++],
  danger: i === SANCTUARY ? 0 : Math.min(5, 1 + Math.floor(Math.hypot(s.x - VILLAGE.x, s.y - VILLAGE.y) / 900)),
  neighbors: [...adj[i]],
}));
export const CASTLES = REGIONS.filter((r) => r.id !== SANCTUARY).map((r) => ({ id: r.id, x: r.x, y: r.y, name: r.name + ' Castle', danger: r.danger }));
export const castleOf = (regionId) => CASTLES.find((c) => c.id === regionId) || null;
export const inCastle = (c, x, y) => Math.abs(x - c.x) < CH - WALL && Math.abs(y - c.y) < CH - WALL;

// Roads follow the route outward from the sanctuary.
export const ROADS = [];
for (let b = 0; b < SEEDS.length; b++) {
  const a = parent[b]; if (a < 0) continue;
  const A = SEEDS[a], B = SEEDS[b];
  let wet = false;
  for (let t = 0; t <= 1; t += 0.05) if (!isLand(A.x + (B.x - A.x) * t, A.y + (B.y - A.y) * t)) wet = true;
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

// ------------------------------------------------------------------ solids (walls, towers, buildings, rocks, trunks)
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
  const { x, y } = c, g = GATE / 2;
  rect(x - CH, y - CH, WALL, CH * 2, { k: 'wall' });
  rect(x + CH - WALL, y - CH, WALL, CH * 2, { k: 'wall' });
  for (const yy of [y - CH, y + CH - WALL]) { rect(x - CH, yy, CH - g, WALL, { k: 'wall' }); rect(x + g, yy, CH - g, WALL, { k: 'wall' }); }
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) addSolid({ t: 'circ', x: x + dx * (CH - WALL / 2), y: y + dy * (CH - WALL / 2), r: TOWER_R, shot: true, k: 'tower' });
  rect(x - WORLD.KEEP_W / 2, y - WORLD.KEEP_H / 2 - 20, WORLD.KEEP_W, WORLD.KEEP_H, { k: 'keep' });
}
// Village buildings ring the well at the centre of Hanbin Haven.
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
// Scatter trees, rocks and the like, keeping roads, castles and the village clear.
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
  const R = rng(MAP_SEED + 11), S = 72;
  for (let gx = 0; gx < W / S; gx++) for (let gy = 0; gy < H / S; gy++) {
    const x = gx * S + R() * S, y = gy * S + R() * S, roll = R(), v = Math.floor(R() * 4);
    if (landValue(x, y) < 0.06) continue;
    if (Math.hypot(x - VILLAGE.x, y - VILLAGE.y) < VILLAGE.r + 60) continue;
    if (CASTLES.some((c) => Math.abs(x - c.x) < CH + 110 && Math.abs(y - c.y) < CH + 110)) continue;
    if (roadDist(x, y) < 60) continue;
    let acc = 0, kind = null;
    for (const [k, p] of PROP_RULES[REGIONS[regionAt(x, y)].biome]) { acc += p; if (roll < acc) { kind = k; break; } }
    if (!kind) continue;
    const p = { k: kind, x: Math.round(x), y: Math.round(y), v };
    if (kind === 'rock') { p.r = 16 + v * 5; addSolid({ t: 'circ', x: p.x, y: p.y, r: p.r, shot: true, k: 'rock' }); }
    else if (kind === 'tree' || kind === 'pine' || kind === 'dead') { p.r = 11; addSolid({ t: 'circ', x: p.x, y: p.y, r: 11, shot: false, k: 'trunk' }); }
    else if (kind === 'cactus') { p.r = 10; addSolid({ t: 'circ', x: p.x, y: p.y, r: 10, shot: false, k: 'trunk' }); }
    else p.r = 14; // bushes are walk-through
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
// Moves a round body, sliding along walls and coastline. Long moves go in short steps so nothing tunnels.
export function moveBody(x, y, r, dx, dy) {
  const len = Math.hypot(dx, dy), steps = Math.max(1, Math.ceil(len / 18));
  for (let i = 0; i < steps; i++) {
    let nx = clamp(x + dx / steps, r, W - r), ny = clamp(y + dy / steps, r, H - r);
    if (!isLand(nx, ny)) { if (isLand(nx, y)) ny = y; else if (isLand(x, ny)) nx = x; else break; }
    [nx, ny] = resolve(nx, ny, r);
    if (!isLand(nx, ny)) break;
    x = nx; y = ny;
  }
  return [x, y];
}
export const freeAt = (x, y, r) => x > r && y > r && x < W - r && y < H - r && isLand(x, y) && !solidsNear(x, y, r).some((s) => overlap(s, x, y, r));
export const shotBlocked = (x, y) => solidsNear(x, y, 2).some((s) => s.shot && overlap(s, x, y, 2));
// True when nothing that blocks arrows (walls, towers, buildings, rocks) lies between the two points.
export function losClear(ax, ay, bx, by) {
  const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 12);
  for (let i = 1; i < n; i++) { const t = i / n; if (shotBlocked(ax + (bx - ax) * t, ay + (by - ay) * t)) return false; }
  return true;
}

// ------------------------------------------------------------------ valor & ranks
export const VALOR_CAP = 8000;
export const RANKS = [
  { name: 'Peasant', v: 0 }, { name: 'Squire', v: 80 }, { name: 'Soldier', v: 250 }, { name: 'Knight', v: 600 }, { name: 'Baron', v: 1200 },
  { name: 'Count', v: 2000 }, { name: 'Duke', v: 3200 }, { name: 'Prince', v: 5000 }, { name: 'King', v: 8000 },
];
export function rankOf(valor) {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) if (valor >= RANKS[i].v) idx = i;
  return { idx, name: RANKS[idx].name, next: RANKS[idx + 1] ? RANKS[idx + 1].v : null, cur: RANKS[idx].v };
}

// ------------------------------------------------------------------ soma
export const somaForTier = (t) => 40 * t * t;
export const tierOf = (soma) => Math.floor(Math.sqrt(Math.max(0, soma) / 40));
export const slotsForTier = (t) => Math.min(10, 5 + Math.floor(t / 5));

// ------------------------------------------------------------------ skill trees
export const TREES = [
  { id: 'blade', name: 'Blade', color: '#e0584f', blurb: 'Close-range steel: wide arcs, stuns and executions.' },
  { id: 'marksman', name: 'Marksman', color: '#6fbf5a', blurb: 'Bows and traps: pierce, slow and rain arrows from afar.' },
  { id: 'sorcery', name: 'Alchemy & Sorcery', color: '#a56ae0', blurb: 'Fire, frost, lightning, poison and healing brews.' },
  { id: 'command', name: 'Command', color: '#e0b84f', blurb: 'Lead the field: buffs, banners and summoned troops.' },
  { id: 'technique', name: 'Technique', color: '#4fc3e0', blurb: 'Footwork and counters: parry, riposte, dash and vanish.' },
];
// at = [column, row] in the tree diagram. Passive skills cannot go on the hotbar.
const S = (id, name, tree, tier, req, cd, en, icon, desc, at, extra) => ({ id, name, tree, tier, req: req || null, cd, en, icon, desc, at, passive: false, free: false, ...extra });
const P = (id, name, tree, tier, req, icon, desc, at) => S(id, name, tree, tier, req, 0, 0, icon, desc, at, { passive: true });
export const SKILL_LIST = [
  S('slash', 'Slash', 'blade', 0, null, 500, 0, '⚔️', 'Quick sword arc in front of you.', [1, 0], { free: true }),
  S('cleave', 'Cleave', 'blade', 1, 'slash', 6000, 15, '🪓', 'Heavy, wide arc that knocks foes back.', [0, 1]),
  S('shield_bash', 'Shield Bash', 'blade', 2, 'slash', 9000, 15, '🛡️', 'Short bash that stuns for 1.3s.', [2, 1]),
  P('heavy_blade', 'Heavy Blade', 'blade', 3, 'cleave', '🗡️', 'Passive: melee skills deal 15% more damage.', [0, 2]),
  S('whirlwind', 'Whirlwind', 'blade', 5, 'cleave', 14000, 30, '🌀', 'Spin three times, hitting everything around you.', [1, 2]),
  S('ground_slam', 'Ground Slam', 'blade', 6, 'shield_bash', 18000, 30, '💢', 'Slam the ground: damage and slow everything nearby.', [2, 3]),
  P('bloodlust', 'Bloodlust', 'blade', 8, 'whirlwind', '🩸', 'Passive: melee hits heal you for 8% of damage dealt.', [1, 3]),
  S('executioner', 'Executioner', 'blade', 10, 'heavy_blade', 20000, 35, '⚰️', 'Brutal strike. Double damage to foes under 35% health.', [0, 4]),
  S('titan_strike', 'Titan Strike', 'blade', 14, 'ground_slam', 30000, 50, '🔨', 'Crushing cone that stuns for 1.8s.', [2, 5]),

  S('arrow', 'Arrow', 'marksman', 0, null, 650, 0, '🏹', 'Fire an arrow toward the cursor.', [1, 0], { free: true }),
  S('power_shot', 'Power Shot', 'marksman', 1, 'arrow', 7000, 15, '🎯', 'Fast shot that pierces up to three foes.', [0, 1]),
  S('crippling_shot', 'Crippling Shot', 'marksman', 2, 'arrow', 9000, 12, '🦵', 'Arrow that slows the target by 55% for 3.5s.', [2, 1]),
  S('volley', 'Volley', 'marksman', 3, 'power_shot', 12000, 25, '🌠', 'Fan of seven arrows.', [0, 2]),
  P('eagle_eye', 'Eagle Eye', 'marksman', 4, 'crippling_shot', '🦅', 'Passive: ranged damage +15%, arrows fly 25% farther.', [1, 2]),
  S('snare_trap', 'Snare Trap', 'marksman', 5, 'crippling_shot', 16000, 20, '🪤', 'Set a hidden trap that roots the first enemy for 2.2s.', [2, 3]),
  S('explosive_arrow', 'Explosive Arrow', 'marksman', 6, 'volley', 15000, 35, '💥', 'Arrow that bursts on impact.', [0, 3]),
  S('rain_of_arrows', 'Rain of Arrows', 'marksman', 10, 'explosive_arrow', 26000, 45, '🌧️', 'Arrows pour onto the target area for 2 seconds.', [0, 4]),
  S('piercing_gale', 'Piercing Gale', 'marksman', 13, 'eagle_eye', 28000, 45, '🌪️', 'A great bolt that pierces everything and hurls foes back.', [1, 5]),

  S('firebolt', 'Firebolt', 'sorcery', 1, null, 2500, 12, '🔥', 'Fireball with a small splash.', [0, 1]),
  S('healing_draught', 'Healing Draught', 'sorcery', 1, null, 12000, 20, '🧪', 'Heal yourself and nearby allies.', [2, 1]),
  S('frost_nova', 'Frost Nova', 'sorcery', 3, 'firebolt', 14000, 28, '❄️', 'Burst of frost: damages and slows enemies around you.', [0, 2]),
  S('poison_flask', 'Poison Flask', 'sorcery', 4, 'healing_draught', 12000, 25, '☠️', 'Throw a flask that leaves a poison cloud for 6s.', [2, 2]),
  P('alchemist', 'Alchemist', 'sorcery', 5, 'healing_draught', '⚗️', 'Passive: healing +35%, energy regenerates 20% faster.', [1, 2]),
  S('chain_lightning', 'Chain Lightning', 'sorcery', 6, 'frost_nova', 15000, 32, '⚡', 'Lightning that leaps between up to four foes.', [0, 3]),
  S('arcane_ward', 'Arcane Ward', 'sorcery', 7, 'alchemist', 22000, 30, '🔮', 'You and nearby allies take 60% less damage for 4s.', [1, 3]),
  S('meteor', 'Meteor', 'sorcery', 11, 'chain_lightning', 32000, 60, '☄️', 'Call down a meteor on the target area after a short delay.', [0, 4]),
  S('rejuvenation', 'Rejuvenation', 'sorcery', 12, 'arcane_ward', 30000, 40, '🌿', 'You and nearby allies regenerate health for 6s.', [1, 4]),

  S('rally', 'Rally', 'command', 2, null, 25000, 30, '📯', 'Allies nearby: +30% damage and +20% speed for 8s.', [1, 1]),
  S('summon_footmen', 'Summon Footmen', 'command', 3, 'rally', 30000, 35, '🪖', 'Call two footmen to fight for you.', [0, 2]),
  P('inspire', 'Inspire', 'command', 4, 'rally', '🎖️', 'Passive: summons are 30% stronger; Rally lasts 12s.', [1, 2]),
  S('war_banner', 'War Banner', 'command', 5, 'rally', 40000, 40, '🚩', 'Plant a banner that heals and empowers allies.', [2, 2]),
  S('summon_archers', 'Summon Archers', 'command', 7, 'summon_footmen', 40000, 45, '🏹', 'Call three archers to fight for you.', [0, 3]),
  S('war_horn', 'War Horn', 'command', 7, 'war_banner', 28000, 30, '📢', 'Blast that hurls enemies back and weakens them.', [2, 3]),
  S('fortify', 'Fortify', 'command', 9, 'war_banner', 35000, 40, '🏰', 'You and nearby allies take 60% less damage for 5s.', [1, 4]),
  S('summon_knights', 'Summon Knights', 'command', 10, 'summon_archers', 50000, 60, '🐴', 'Call three armoured knights.', [0, 4]),
  S('legion_call', 'Legion Call', 'command', 16, 'summon_knights', 100000, 90, '👑', 'Summon a legion of knights and archers.', [0, 5]),

  S('parry', 'Parry', 'technique', 1, null, 4000, 8, '🤺', 'Brief guard. Blocks the next hit, stuns and weakens the attacker.', [0, 1]),
  S('dash', 'Dash', 'technique', 1, null, 7000, 12, '💨', 'Quick dash toward the cursor.', [2, 1]),
  S('riposte', 'Riposte', 'technique', 3, 'parry', 6000, 15, '🗡️', 'Lunge forward and weaken foes. Double damage right after a parry.', [0, 2]),
  P('second_wind', 'Second Wind', 'technique', 4, 'dash', '🍃', 'Passive: +10% move speed, energy regenerates 15% faster.', [1, 2]),
  S('shadowstep', 'Shadowstep', 'technique', 5, 'dash', 12000, 18, '👤', 'Vanish and reappear at the cursor.', [2, 2]),
  S('intimidate', 'Intimidate', 'technique', 6, 'riposte', 18000, 25, '😠', 'Weaken and slow every enemy nearby.', [0, 3]),
  S('smoke_bomb', 'Smoke Bomb', 'technique', 8, 'shadowstep', 20000, 25, '🌫️', 'Smoke cloud that slows and weakens enemies inside it.', [2, 3]),
  S('iron_skin', 'Iron Skin', 'technique', 9, 'intimidate', 24000, 30, '🪨', 'Take 60% less damage for 5 seconds.', [0, 4]),
  S('counter_stance', 'Counter Stance', 'technique', 12, 'iron_skin', 28000, 30, '♞', 'For 2.2s, parry every hit that lands on you.', [0, 5]),
  P('last_stand', 'Last Stand', 'technique', 15, 'counter_stance', '🔥', 'Passive: below 30% health you take 35% less damage.', [1, 5]),
];
export const SKILLS = Object.fromEntries(SKILL_LIST.map((s) => [s.id, s]));
export const FREE_SKILLS = SKILL_LIST.filter((s) => s.free).map((s) => s.id);
export const TREE_OF = Object.fromEntries(SKILL_LIST.map((s) => [s.id, s.tree]));

// ------------------------------------------------------------------ creatures
// hp, dmg, spd, r (radius), range, cd (attack ms), aggro, valor, soma
const M = (o) => o;
export const MOBS = {
  wolf: M({ name: 'Wolf', hp: 45, dmg: 9, spd: 145, r: 13, range: 26, cd: 900, aggro: 260, valor: 2, soma: 6 }),
  boar: M({ name: 'Boar', hp: 70, dmg: 12, spd: 120, r: 14, range: 26, cd: 1100, aggro: 200, valor: 2, soma: 8 }),
  bandit: M({ name: 'Bandit', hp: 75, dmg: 11, spd: 115, r: 14, range: 32, cd: 1000, aggro: 300, valor: 3, soma: 10 }),
  skeleton: M({ name: 'Skeleton Archer', hp: 55, dmg: 12, spd: 90, r: 14, range: 330, cd: 1500, aggro: 380, valor: 4, soma: 12, ranged: true, proj: 'arrow' }),
  spider: M({ name: 'Giant Spider', hp: 95, dmg: 14, spd: 135, r: 16, range: 28, cd: 1000, aggro: 280, valor: 5, soma: 16 }),
  cultist: M({ name: 'Cultist', hp: 70, dmg: 18, spd: 85, r: 14, range: 360, cd: 2000, aggro: 380, valor: 5, soma: 17, ranged: true, proj: 'dark' }),
  bear: M({ name: 'Cave Bear', hp: 220, dmg: 22, spd: 110, r: 20, range: 34, cd: 1500, aggro: 240, valor: 8, soma: 26 }),
  ogre: M({ name: 'Ogre', hp: 300, dmg: 28, spd: 85, r: 23, range: 46, cd: 1800, aggro: 280, valor: 10, soma: 32 }),
  wraith: M({ name: 'Wraith', hp: 160, dmg: 22, spd: 150, r: 15, range: 36, cd: 1100, aggro: 400, valor: 9, soma: 30 }),
  guard: M({ name: 'Guard', hp: 130, dmg: 14, spd: 105, r: 14, range: 34, cd: 900, aggro: 320, valor: 6, soma: 16 }),
  archer: M({ name: 'Archer', hp: 85, dmg: 13, spd: 95, r: 14, range: 340, cd: 1300, aggro: 380, valor: 6, soma: 16, ranged: true, proj: 'arrow' }),
  captain: M({ name: 'Captain', hp: 360, dmg: 28, spd: 100, r: 18, range: 40, cd: 1100, aggro: 340, valor: 22, soma: 65 }),
  footman: M({ name: 'Footman', hp: 90, dmg: 11, spd: 135, r: 14, range: 32, cd: 900, aggro: 320, valor: 0, soma: 0 }),
  summoned_archer: M({ name: 'Archer', hp: 70, dmg: 12, spd: 125, r: 13, range: 320, cd: 1100, aggro: 360, valor: 0, soma: 0, ranged: true, proj: 'arrow' }),
  knight: M({ name: 'Knight', hp: 230, dmg: 24, spd: 130, r: 16, range: 38, cd: 900, aggro: 340, valor: 0, soma: 0 }),
  banner: M({ name: 'War Banner', hp: 150, dmg: 0, spd: 0, r: 12, range: 0, cd: 0, aggro: 0, valor: 0, soma: 0 }),
};
export const WILD_TABLE = {
  1: [['wolf', 5], ['boar', 4], ['bandit', 3]],
  2: [['wolf', 3], ['bandit', 4], ['skeleton', 3], ['spider', 2]],
  3: [['skeleton', 3], ['spider', 3], ['cultist', 3], ['bear', 2], ['bandit', 2]],
  4: [['bear', 3], ['ogre', 3], ['wraith', 3], ['cultist', 3]],
  5: [['ogre', 4], ['wraith', 4], ['bear', 2], ['cultist', 2]],
};
export function garrisonFor(danger) {
  const g = ['captain'];
  for (let i = 0; i < 2 + danger; i++) g.push('guard');
  for (let i = 0; i < 1 + Math.ceil(danger / 2); i++) g.push('archer');
  return g;
}
