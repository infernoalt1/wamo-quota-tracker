// Ground colours for one map chunk. Runs in a Web Worker so building terrain never stalls the game.
import { REGIONS, ROADS, landValue, noise, fbm, roadDist, regionAt } from './shared.mjs';

export const BIOME_RGB = { grass: [92, 148, 64], forest: [70, 126, 56], darkforest: [48, 92, 52], snow: [228, 236, 242], rock: [132, 128, 120], ash: [86, 74, 70], swamp: [86, 104, 66], desert: [218, 190, 126], heath: [140, 146, 78] };
const SAND = [222, 206, 150], DIRT = [150, 118, 78];

// Returns RGBA pixels for the chunk at (cx, cy); each pixel covers res x res world units.
export function chunkPixels(cx, cy, size, res) {
  const n = size / res, d = new Uint8ClampedArray(n * n * 4), x0 = cx * size, y0 = cy * size;
  const roads = ROADS.filter((r) => Math.max(r.x0, r.x1) > x0 - 40 && Math.min(r.x0, r.x1) < x0 + size + 40 && Math.max(r.y0, r.y1) > y0 - 40 && Math.min(r.y0, r.y1) < y0 + size + 40);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = x0 + i * res + res / 2, y = y0 + j * res + res / 2, lv = landValue(x, y), o = (j * n + i) * 4;
    let r, g, b;
    if (lv < 0) {
      const t = Math.min(1, -lv / 0.14), wave = noise(x / 70, y / 26 + x / 400, 77) > 0.72 ? 14 : 0;
      r = 78 - 46 * t + wave; g = 158 - 86 * t + wave; b = 182 - 52 * t + wave;
    } else {
      const jx = x + (noise(x / 26, y / 26, 91) - 0.5) * 80, jy = y + (noise(x / 26, y / 26, 93) - 0.5) * 80;
      const biome = REGIONS[regionAt(jx, jy)].biome, c = BIOME_RGB[biome];
      const br = 0.86 + 0.26 * fbm(x / 260, y / 260, 41, 2) + (noise(x / 9, y / 9, 7) - 0.5) * 0.08;
      r = c[0] * br; g = c[1] * br; b = c[2] * br;
      if (lv < 0.04 && biome !== 'snow') { const t = 1 - lv / 0.04; r += (SAND[0] - r) * t; g += (SAND[1] - g) * t; b += (SAND[2] - b) * t; }
      if (roads.length) {
        const rd = roadDist(x, y, roads) + (noise(x / 30, y / 30, 5) - 0.5) * 8;
        if (rd < 24) { const t = Math.min(1, (24 - rd) / 8) * (0.85 + noise(x / 7, y / 7, 3) * 0.15); r += (DIRT[0] - r) * t; g += (DIRT[1] - g) * t; b += (DIRT[2] - b) * t; }
      }
    }
    d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
  }
  return d;
}
