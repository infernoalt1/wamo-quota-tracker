// Ground colours for one map chunk. Runs in a Web Worker so building terrain never stalls the game.
import { WORLD, REGIONS, ROADS, DGRID, DT_SIZE, BRIDGE_W, landBase, bridgeAt, noise, fbm, roadDist, regionAt, dungeonAt } from './shared.mjs';

export const BIOME_RGB = { grass: [92, 148, 64], forest: [70, 126, 56], darkforest: [48, 92, 52], snow: [228, 236, 242], rock: [132, 128, 120], ash: [86, 74, 70], swamp: [86, 104, 66], desert: [218, 190, 126], heath: [140, 146, 78], cave: [70, 64, 60] };
const SAND = [222, 206, 150], DIRT = [150, 118, 78];
// Dungeon palettes: floor, wall top, wall face.
const THEMES = {
  warren: [[96, 78, 58], [128, 104, 76], [62, 48, 34]],
  crypt: [[84, 84, 92], [120, 120, 130], [52, 52, 60]],
  web: [[72, 66, 78], [104, 98, 110], [44, 40, 50]],
  ice: [[150, 176, 196], [206, 226, 240], [96, 124, 150]],
  forge: [[84, 54, 42], [124, 86, 66], [54, 30, 22]],
  abyss: [[50, 40, 66], [86, 72, 108], [28, 22, 40]],
};

function dungeonPixel(x, y) {
  const d = dungeonAt(x, y);
  if (!d) return [10, 9, 12];
  const tx = Math.floor((x - d.bx) / DT_SIZE), ty = Math.floor((y - d.by) / DT_SIZE);
  const at = (a, b) => a >= 0 && b >= 0 && a < DGRID && b < DGRID && d.tiles[b * DGRID + a] === 1;
  const [fl, wt, wf] = THEMES[d.theme], n = 0.85 + noise(x / 37, y / 37, 13) * 0.25;
  if (at(tx, ty)) {
    const lx = (x - d.bx) % DT_SIZE, ly = (y - d.by) % DT_SIZE, seam = lx < 3 || ly < 3 ? 0.78 : 1;
    const crack = noise(x / 9, y / 9, 31) > 0.82 ? 0.82 : 1;
    return fl.map((c) => c * n * seam * crack);
  }
  // Walls: a lit top, and a dark face where a floor tile lies just below (gives the rooms depth).
  if (at(tx, ty + 1)) {
    const ly = (y - d.by) % DT_SIZE;
    return (ly > DT_SIZE * 0.45 ? wf : wt).map((c) => c * n);
  }
  for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) if (at(tx + a, ty + b)) return wt.map((c) => c * n * 0.9);
  return [10, 9, 12];
}

// Returns RGBA pixels for the chunk at (cx, cy); each pixel covers res x res world units.
export function chunkPixels(cx, cy, size, res) {
  const n = size / res, d = new Uint8ClampedArray(n * n * 4), x0 = cx * size, y0 = cy * size;
  const roads = ROADS.filter((r) => Math.max(r.x0, r.x1) > x0 - 40 && Math.min(r.x0, r.x1) < x0 + size + 40 && Math.max(r.y0, r.y1) > y0 - 40 && Math.min(r.y0, r.y1) < y0 + size + 40);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = x0 + i * res + res / 2, y = y0 + j * res + res / 2, o = (j * n + i) * 4;
    let r, g, b;
    if (y >= WORLD.IH) [r, g, b] = dungeonPixel(x, y);
    else {
      const lv = landBase(x, y), br = lv < 0.03 ? bridgeAt(x, y) : null;
      if (br) {
        // Timber bridge: planks across the deck, a darker rail on each side and posts every so often.
        const edge = BRIDGE_W / 2 - Math.abs(br.d), plank = Math.floor(br.along / 13), grain = noise(x / 6, y / 40, 61) * 0.12;
        const tone = 0.9 + (plank % 3) * 0.05 + grain - ((br.along % 13) < 1.6 ? 0.25 : 0);
        if (edge < 9) { const post = br.along % 120 < 12; r = post ? 70 : 96; g = post ? 48 : 66; b = post ? 30 : 40; }
        else { r = 150 * tone; g = 108 * tone; b = 66 * tone; }
      } else if (lv < 0) {
        // Shallows are pale and green near the shore, the open sea deep blue; surf breaks right on the beach.
        const t = Math.min(1, -lv / 0.16), wave = noise(x / 70, y / 26 + x / 400, 77) > 0.72 ? 12 * (1 - t) + 4 : 0;
        r = 92 - 62 * t + wave; g = 176 - 104 * t + wave; b = 186 - 50 * t + wave;
        if (lv > -0.012 + (noise(x / 40, y / 40, 79) - 0.5) * 0.008) { r = 214; g = 232; b = 236; }
        else if (-lv < 0.03 && noise(x / 24, y / 24, 83) > 0.68) { r += 22; g += 22; b += 18; }
        // shadow under the edge of a bridge deck
        const nb = bridgeAt(x, y + 14);
        if (nb && !bridgeAt(x, y)) { r *= 0.7; g *= 0.7; b *= 0.75; }
      } else {
        const jx = x + (noise(x / 70, y / 70, 91) - 0.5) * 180 + (noise(x / 17, y / 17, 95) - 0.5) * 40, jy = y + (noise(x / 70, y / 70, 93) - 0.5) * 180 + (noise(x / 17, y / 17, 97) - 0.5) * 40;
        const biome = REGIONS[regionAt(jx, jy)].biome, c = BIOME_RGB[biome];
        const br = 0.86 + 0.26 * fbm(x / 260, y / 260, 41, 2) + (noise(x / 9, y / 9, 7) - 0.5) * 0.08;
        r = c[0] * br; g = c[1] * br; b = c[2] * br;
        if (lv < 0.04 && biome !== 'snow') { const t = 1 - lv / 0.04; r += (SAND[0] - r) * t; g += (SAND[1] - g) * t; b += (SAND[2] - b) * t; }
        if (roads.length) {
          const rd = roadDist(x, y, roads) + (noise(x / 30, y / 30, 5) - 0.5) * 8;
          if (rd < 24) { const t = Math.min(1, (24 - rd) / 8) * (0.85 + noise(x / 7, y / 7, 3) * 0.15); r += (DIRT[0] - r) * t; g += (DIRT[1] - g) * t; b += (DIRT[2] - b) * t; }
        }
      }
    }
    d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
  }
  return d;
}
