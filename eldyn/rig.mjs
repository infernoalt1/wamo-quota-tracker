// Hanbin Island weapon animation. A fighter's weapon is held in the right hand at the end of an arm that
// moves from the shoulder, so a swing travels in a real arc: wind-up, a fast strike, follow-through and a
// recovery. The torso twists into the blow, the weapon smears while it moves fast and its tip leaves a trail.
// All coordinates are in body space (facing +x, +y is the fighter's right) and sprite units.

const ease = { out: (q) => 1 - (1 - q) ** 4, inOut: (q) => (q < 0.5 ? 2 * q * q : 1 - (-2 * q + 2) ** 2 / 2), back: (q) => { const c = 1.6; return 1 + (c + 1) * (q - 1) ** 3 + c * (q - 1) ** 2; } };
const lerp = (a, b, q) => a + (b - a) * q;
const mix = (p, r, q) => ({ ha: lerp(p.ha, r.ha, q), al: lerp(p.al, r.al, q), wa: lerp(p.wa, r.wa, q), tw: lerp(p.tw, r.tw, q), lean: lerp(p.lean, r.lean, q), fast: lerp(p.fast || 0, r.fast || 0, q) });
export const SHOULDER = [1, 7];
// How far a weapon's tip is from the grip (sprite units), for the trail.
const TIP = { sword: 26, rapier: 30, axe: 24, greataxe: 32, dagger: 15, club: 28, spear: 36, staffplain: 28, greatsword: 39, flail: 28, mace: 22, pike: 46, partisan: 48, lance: 42, glaive: 41, halberd: 36, pollaxe: 35, ranseur: 40, bardiche: 32, pilum: 28 };
export const tipOf = (kind) => TIP[kind] || 26;
// How a weapon kind is carried and used.
function styleOf(tool, kind) {
  if (tool && tool.type === 'strike') {
    const h = tool.hits[0];
    if ((h.arc || 0) >= 360) return 'spin';
    if (h.line) return 'thrust';
    return 'slash';
  }
  if (tool && tool.type === 'charge') return 'thrust';
  return ['spear', 'pike', 'partisan', 'lance', 'ranseur', 'rapier', 'pollaxe'].includes(kind) ? 'thrust' : 'slash';
}
function idle(kind, style) {
  if (style === 'thrust') return { ha: 0.75, al: 8, wa: -0.12, tw: 0, lean: 0 };
  if (['greatsword', 'bardiche', 'halberd', 'glaive', 'greataxe', 'staffplain'].includes(kind)) return { ha: 0.6, al: 8, wa: -0.95, tw: 0, lean: 0 };
  return { ha: 0.55, al: 9, wa: -0.5, tw: 0, lean: 0 };
}
// The pose t ms into an attack with `tool` (or the idle guard when not attacking).
export function pose(tool, kind, t, step = 0) {
  const style = styleOf(tool, kind), rest = idle(kind, style);
  const breathe = { ...rest, ha: rest.ha + step * 0.06, wa: rest.wa + step * 0.05 };
  if (!tool || tool.type !== 'strike' && tool.type !== 'charge' || t == null || t > 2600) return breathe;
  const w = tool.windup || 0;
  // just before a quick blow (used for its smear): already drawn back
  if (t < 0) return w || tool.type === 'charge' ? breathe : cocked(styleOf(tool, kind), 1, tool);
  if (tool.type === 'charge') {
    const cock = { ha: 0.9, al: 5, wa: -0.05, tw: 0.15, lean: -2 }, couch = { ha: 0.25, al: 13, wa: 0, tw: -0.1, lean: 6, fast: 1 };
    if (t < w) return mix(rest, cock, ease.inOut(t / w));
    if (t < w + tool.dur) return couch;
    return mix(couch, rest, Math.min(1, (t - w - tool.dur) / 300));
  }
  const hits = tool.hits;
  // before the first blow: wind up (long for heavy weapons, a flick for quick ones)
  const first = cocked(style, 1, tool);
  if (t < w) return mix(rest, first, ease.inOut(t / w));
  let k = 0;
  for (let i = 0; i < hits.length; i++) if (t >= w + hits[i].t) k = i;
  const ht = t - w - hits[k].t, dir = k % 2 ? -1 : 1, last = k === hits.length - 1;
  const from = k === 0 ? (w ? first : mix(rest, first, 1)) : endOf(style, -dir, tool);
  const to = endOf(style, dir, tool), over = overshoot(style, dir, tool);
  const STRIKE = style === 'thrust' ? 75 : style === 'spin' ? 330 : 95;
  if (ht < STRIKE) {
    if (style === 'spin') { const q = ht / STRIKE; return { ha: -1.2 + q * Math.PI * 2, al: 13, wa: -1.2 + q * Math.PI * 2 + 0.2, tw: 0, lean: 2, fast: 1 }; }
    return { ...mix(from, to, ease.out(ht / STRIKE)), fast: 1 };
  }
  if (style === 'spin') return last ? mix({ ha: -1.2, al: 13, wa: -1, tw: 0, lean: 2 }, rest, Math.min(1, (ht - STRIKE) / 300)) : { ha: -1.2, al: 13, wa: -1, tw: 0, lean: 2 };
  if (ht < STRIKE + 90) return mix(to, over, ease.out((ht - STRIKE) / 90));
  if (!last) {
    // between blows: cock back for the next one (the backhand starts where this one ended)
    const nextIn = w + hits[k + 1].t - t, gap = hits[k + 1].t - hits[k].t - STRIKE - 90;
    const q = gap > 0 ? 1 - Math.max(0, nextIn) / gap : 1;
    return mix(over, endOf(style, dir, tool), Math.min(1, Math.max(0, q)) * 0.3);
  }
  return mix(over, rest, ease.inOut(Math.min(1, (ht - STRIKE - 90) / 320)));
}
function cocked(style, dir, tool) {
  const heavy = (tool.windup || 0) >= 300;
  if (style === 'thrust') return { ha: 0.95, al: 4, wa: 0.02, tw: 0.25, lean: -3 };
  if (style === 'spin') return { ha: -1.2, al: 12, wa: -1, tw: 0, lean: 0 };
  return { ha: dir * (heavy ? 2.0 : 1.7), al: heavy ? 9 : 10, wa: dir * (heavy ? 2.5 : 2.0), tw: dir * (heavy ? 0.5 : 0.35), lean: heavy ? -3 : -1 };
}
function endOf(style, dir, tool) {
  if (style === 'thrust') { const reach = tool.hits ? tool.hits[0].reach : 160; return { ha: 0.12, al: 15 + Math.min(10, reach / 20), wa: 0, tw: -0.12, lean: 6 }; }
  if (style === 'spin') return { ha: -1.2, al: 13, wa: -1, tw: 0, lean: 2 };
  // where a slash ends is where the opposite slash starts
  return { ha: -dir * 1.05, al: 12, wa: -dir * 1.3, tw: -dir * 0.32, lean: 4 };
}
function overshoot(style, dir, tool) {
  if (style === 'thrust') { const e = endOf(style, dir, tool); return { ...e, al: e.al - 2, lean: e.lean - 1 }; }
  return { ha: -dir * 1.2, al: 11.5, wa: -dir * 1.55, tw: -dir * 0.38, lean: 3 };
}
// Where the grip is and which way the weapon points, for a pose.
export function grip(p) {
  const hx = SHOULDER[0] + Math.cos(p.ha) * p.al, hy = SHOULDER[1] + Math.sin(p.ha) * p.al;
  return { hx, hy, wa: p.wa };
}
