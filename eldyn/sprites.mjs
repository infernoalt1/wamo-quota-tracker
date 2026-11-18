// Hanbin Island sprite atlas. Every character, creature, prop and building is painted once into an
// offscreen canvas (at 2x for sharp edges) and cached; the renderer only blits and rotates them.
import { WORLD, HOUSES, VILLAGE, rng } from './shared.mjs';

const SS = 2; // supersampling
const cache = new Map();
function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.ceil(w * SS); c.height = Math.ceil(h * SS); const x = c.getContext('2d'); x.scale(SS, SS); return [c, x]; }
const memo = (key, fn) => { let v = cache.get(key); if (!v) { v = fn(); cache.set(key, v); } return v; };

// ------------------------------------------------------------------ colour helpers
function hex(c) {
  if (c.startsWith('rgb')) return c.match(/\d+/g).slice(0, 3).map(Number);
  c = c.replace('#', ''); if (c.length === 3) c = c.split('').map((x) => x + x).join(''); const n = parseInt(c, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function shade(c, f) { const [r, g, b] = hex(c); const m = (v) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f); return `rgb(${m(r)},${m(g)},${m(b)})`; }
const OUT = 'rgba(20,14,10,.85)';
function blob(x, cx, cy, rx, ry, fill, line = OUT, lw = 1.4, rot = 0) {
  x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
  if (fill) { x.fillStyle = fill; x.fill(); }
  if (line) { x.strokeStyle = line; x.lineWidth = lw; x.stroke(); }
}
function radial(x, cx, cy, r, c) { const g = x.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r * 1.1); g.addColorStop(0, shade(c, 0.28)); g.addColorStop(0.6, c); g.addColorStop(1, shade(c, -0.35)); return g; }

// ------------------------------------------------------------------ weapons (drawn in hand space, pointing +x)
function weapon(x, kind, swing) {
  x.save();
  if (kind === 'sword' || kind === 'rapier') {
    x.rotate(swing ? -0.2 : -0.9);
    const len = kind === 'rapier' ? 26 : 22, w = kind === 'rapier' ? 1.6 : 3;
    x.fillStyle = '#5a3a1a'; x.fillRect(-4, -1.5, 5, 3);
    x.fillStyle = '#c9a43a'; x.fillRect(0, -5, 2.5, 10);
    const g = x.createLinearGradient(0, -w, 0, w); g.addColorStop(0, '#f4f7fb'); g.addColorStop(1, '#8d97a6');
    x.fillStyle = g; x.beginPath(); x.moveTo(2.5, -w / 2); x.lineTo(len, -w / 2); x.lineTo(len + 4, 0); x.lineTo(len, w / 2); x.lineTo(2.5, w / 2); x.closePath(); x.fill();
    x.strokeStyle = OUT; x.lineWidth = 0.8; x.stroke();
  } else if (kind === 'axe') {
    x.rotate(swing ? -0.1 : -0.8);
    x.fillStyle = '#6b4523'; x.fillRect(-4, -1.5, 22, 3);
    x.fillStyle = '#b8c0c8'; x.beginPath(); x.moveTo(14, -1.5); x.quadraticCurveTo(20, -10, 23, -9); x.lineTo(21, 1.5); x.closePath(); x.fill(); x.strokeStyle = OUT; x.lineWidth = 0.8; x.stroke();
  } else if (kind === 'club') {
    x.rotate(swing ? 0 : -0.7);
    x.fillStyle = '#7a5230'; x.beginPath(); x.moveTo(-3, -2); x.lineTo(24, -5.5); x.quadraticCurveTo(30, 0, 24, 5.5); x.lineTo(-3, 2); x.closePath(); x.fill(); x.strokeStyle = OUT; x.lineWidth = 1; x.stroke();
    x.fillStyle = '#5a3a20'; for (const [a, b] of [[16, -4], [21, 3], [25, -1]]) { x.beginPath(); x.arc(a, b, 1.2, 0, 7); x.fill(); }
  } else if (kind === 'spear') {
    x.rotate(swing ? 0.05 : -0.25);
    x.fillStyle = '#7a5530'; x.fillRect(-12, -1.2, 40, 2.4);
    x.fillStyle = '#d8dee6'; x.beginPath(); x.moveTo(28, -3); x.lineTo(36, 0); x.lineTo(28, 3); x.closePath(); x.fill(); x.strokeStyle = OUT; x.lineWidth = 0.8; x.stroke();
  } else if (kind === 'staff') {
    x.rotate(-0.15);
    x.fillStyle = '#6a4a2a'; x.fillRect(-10, -1.4, 34, 2.8);
    const g = x.createRadialGradient(26, 0, 0.5, 26, 0, 6); g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#c48aff'); g.addColorStop(1, 'rgba(120,60,220,0)');
    x.fillStyle = g; x.beginPath(); x.arc(26, 0, 6, 0, 7); x.fill();
    x.fillStyle = '#9a6ae0'; x.beginPath(); x.arc(26, 0, 3, 0, 7); x.fill();
  } else if (kind === 'darkstaff') {
    x.rotate(-0.15);
    x.fillStyle = '#2a1a2a'; x.fillRect(-10, -1.4, 32, 2.8);
    x.fillStyle = '#e0e0d0'; x.beginPath(); x.arc(24, 0, 4, 0, 7); x.fill(); x.fillStyle = '#300'; x.fillRect(24, -2, 1.5, 1.5); x.fillRect(24, 0.6, 1.5, 1.5);
  }
  x.restore();
}
function bow(x, drawn) {
  x.save();
  x.strokeStyle = '#7a4a22'; x.lineWidth = 2.6; x.beginPath(); x.arc(-4, 0, 14, -1.1, 1.1); x.stroke();
  x.strokeStyle = '#e8e0c8'; x.lineWidth = 0.7; x.beginPath();
  const ex = -4 + Math.cos(1.1) * 14, ey = Math.sin(1.1) * 14, pull = drawn ? -9 : -1;
  x.moveTo(ex, -ey); x.lineTo(pull, 0); x.lineTo(ex, ey); x.stroke();
  if (drawn) { x.strokeStyle = '#d8c8a0'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(pull, 0); x.lineTo(14, 0); x.stroke(); x.fillStyle = '#ccc'; x.beginPath(); x.moveTo(14, -2); x.lineTo(18, 0); x.lineTo(14, 2); x.fill(); }
  x.restore();
}
function shield(x, color) {
  x.save();
  x.beginPath(); x.ellipse(0, 0, 4.5, 9.5, 0, 0, 7); x.fillStyle = radial(x, 0, 0, 9, color); x.fill();
  x.strokeStyle = '#b8a060'; x.lineWidth = 1.6; x.stroke();
  x.fillStyle = '#d8c070'; x.beginPath(); x.arc(0.5, 0, 1.8, 0, 7); x.fill();
  x.restore();
}

// ------------------------------------------------------------------ humanoids (top-down, facing +x)
// o: { skin, tunic, armor, head, hair, weapon, shield, cape, scale, robe }
function humanoid(o, step, atk) {
  const s = o.scale || 1, R = 34 * s;
  const [c, x] = canvas(R * 2, R * 2);
  x.translate(R, R); x.scale(s, s);
  const bodyC = o.armor === 'plate' ? '#aab3c2' : o.armor === 'chain' ? '#8c939c' : o.armor === 'leather' ? '#8a5a32' : o.armor === 'ribs' ? '#e6e0cc' : o.tunic;
  // cape
  if (o.cape) {
    x.fillStyle = radial(x, -8, 0, 14, o.cape); x.beginPath(); x.moveTo(-1, -12); x.quadraticCurveTo(-18, -14, -20, 0); x.quadraticCurveTo(-18, 14, -1, 12); x.closePath(); x.fill();
    x.strokeStyle = OUT; x.lineWidth = 1.2; x.stroke();
  }
  // feet
  if (!o.robe) {
    const boot = o.armor === 'plate' ? '#6a7280' : o.armor === 'ribs' ? '#ddd6c0' : '#3a2a1c';
    blob(x, 3 + step * 5, -6, 5, 3.4, boot); blob(x, 3 - step * 5, 6, 5, 3.4, boot);
  } else {
    x.fillStyle = shade(o.tunic, -0.25); x.beginPath(); x.ellipse(-2, 0, 13, 15, 0, 0, 7); x.fill(); x.strokeStyle = OUT; x.lineWidth = 1.2; x.stroke();
  }
  // off hand: shield or bow
  const swing = atk ? 1 : 0;
  if (o.weapon === 'bow') { x.save(); x.translate(10 + swing * 2, -3); bow(x, atk); x.restore(); }
  if (o.shield) { x.save(); x.translate(5, -13); shield(x, o.shield); x.restore(); }
  // torso
  x.fillStyle = radial(x, 0, 0, 13, bodyC);
  x.beginPath(); x.ellipse(0, 0, 8.5, 13, 0, 0, 7); x.fill(); x.strokeStyle = OUT; x.lineWidth = 1.5; x.stroke();
  if (o.armor === 'plate' || o.armor === 'chain' || o.armor === 'leather') {
    // tabard stripe in the wearer's colours
    x.fillStyle = o.tunic; x.beginPath(); x.ellipse(1, 0, 5, 6.5, 0, 0, 7); x.fill(); x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 0.8; x.stroke();
  }
  if (o.armor === 'plate') { for (const sy of [-11, 11]) blob(x, -0.5, sy, 5.5, 4.5, radial(x, 0, sy, 5, '#c4ccd8'), OUT, 1); }
  if (o.armor === 'chain') { x.fillStyle = 'rgba(40,40,50,.25)'; for (let i = -6; i <= 6; i += 3) for (let j = -10; j <= 10; j += 3) if ((i * i) / 64 + (j * j) / 169 < 1) x.fillRect(i - 0.5, j - 0.5, 1, 1); }
  if (o.armor === 'leather') { x.strokeStyle = '#4a2a14'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(-6, -9); x.lineTo(6, 9); x.stroke(); }
  if (o.armor === 'ribs') { x.strokeStyle = '#9a9480'; x.lineWidth = 1; for (const j of [-7, -3.5, 0, 3.5, 7]) { x.beginPath(); x.moveTo(-4, j); x.quadraticCurveTo(2, j * 1.1, 5, j * 0.9); x.stroke(); } }
  // hands & main weapon
  const skin = o.skin;
  const hx = atk ? 13 : 9, hy = atk ? 7 : 11;
  if (o.weapon !== 'bow') blob(x, 7, -11, 3.2, 3.2, o.armor === 'plate' ? '#9aa3b2' : skin, OUT, 1);
  x.save(); x.translate(hx, hy);
  if (o.weapon && o.weapon !== 'bow') weapon(x, o.weapon, atk);
  x.restore();
  blob(x, hx, hy, 3.2, 3.2, o.armor === 'plate' ? '#9aa3b2' : skin, OUT, 1);
  if (o.weapon === 'bow') blob(x, 9 + swing * 2, -3, 3, 3, skin, OUT, 1);
  // head
  head(x, o);
  return c;
}
function head(x, o) {
  const hr = 7.6;
  if (o.head === 'skull') {
    blob(x, 1, 0, hr, hr * 0.95, radial(x, 1, 0, hr, '#ece6d2'));
    x.fillStyle = '#2a1a10'; x.beginPath(); x.arc(5, -2.8, 1.7, 0, 7); x.arc(5, 2.8, 1.7, 0, 7); x.fill();
    return;
  }
  if (o.head === 'hood') {
    blob(x, 0, 0, hr + 1.5, hr + 1, radial(x, 0, 0, hr + 1, o.hood || o.tunic));
    x.fillStyle = 'rgba(0,0,0,.55)'; x.beginPath(); x.ellipse(5, 0, 3.5, 5, 0, 0, 7); x.fill();
    if (o.eyes) { x.fillStyle = o.eyes; x.fillRect(6, -2.5, 1.6, 1.6); x.fillRect(6, 1, 1.6, 1.6); }
    return;
  }
  blob(x, 1, 0, hr, hr, radial(x, 1, 0, hr, o.skin));
  if (o.head === 'helm' || o.head === 'greathelm' || o.head === 'plume') {
    x.fillStyle = radial(x, 0, 0, hr + 1, '#b8c0cc'); x.beginPath(); x.arc(0.5, 0, hr + 0.8, 0, 7); x.fill(); x.strokeStyle = OUT; x.lineWidth = 1.3; x.stroke();
    x.strokeStyle = '#6a7280'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(-6, 0); x.lineTo(6, 0); x.stroke();
    if (o.head === 'greathelm') { x.fillStyle = '#222'; x.fillRect(5, -3.5, 1.6, 7); }
    if (o.head === 'plume') { x.fillStyle = o.plume || '#c0392b'; x.beginPath(); x.ellipse(-5, 0, 7, 2.6, 0, 0, 7); x.fill(); x.strokeStyle = OUT; x.lineWidth = 0.8; x.stroke(); }
  } else if (o.head === 'bandana') {
    x.fillStyle = o.hair || '#b03030'; x.beginPath(); x.arc(0.5, 0, hr + 0.3, Math.PI * 0.55, Math.PI * 1.45); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(-6, -1); x.lineTo(-11, -3); x.lineTo(-10, 1); x.closePath(); x.fill();
  } else if (o.head === 'bald') {
    x.fillStyle = 'rgba(0,0,0,.18)'; x.beginPath(); x.arc(-1, 0, 4, 0, 7); x.fill();
    x.fillStyle = '#eee'; x.beginPath(); x.moveTo(6, -4); x.lineTo(9, -6); x.lineTo(7, -2.5); x.fill(); x.beginPath(); x.moveTo(6, 4); x.lineTo(9, 6); x.lineTo(7, 2.5); x.fill();
  } else {
    // hair, with optional circlet or crown
    x.fillStyle = radial(x, -2, 0, hr, o.hair || '#4a3020'); x.beginPath(); x.arc(0.5, 0, hr + 0.4, Math.PI * 0.6, Math.PI * 1.4); x.quadraticCurveTo(-2, 0, 0.5 + Math.cos(Math.PI * 0.6) * hr, Math.sin(Math.PI * 0.6) * hr); x.fill();
    x.beginPath(); x.arc(-1, 0, hr * 0.85, 0, 7); x.fill();
    if (o.head === 'crown' || o.head === 'circlet') {
      x.strokeStyle = '#f0c840'; x.lineWidth = 2; x.beginPath(); x.arc(0.5, 0, hr - 1.2, 0, 7); x.stroke();
      if (o.head === 'crown') { x.fillStyle = '#f0c840'; for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; x.beginPath(); x.arc(0.5 + Math.cos(a) * (hr - 1.2), Math.sin(a) * (hr - 1.2), 1.8, 0, 7); x.fill(); } x.fillStyle = '#e03050'; x.beginPath(); x.arc(0.5 + hr - 1.2, 0, 1.3, 0, 7); x.fill(); }
    }
  }
}

// ------------------------------------------------------------------ beasts (facing +x)
function legs(x, n, len, spread, step, col, lw = 3) {
  x.strokeStyle = col; x.lineWidth = lw; x.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const fx = (i % (n / 2)) / (n / 2 - 1 || 1), side = i < n / 2 ? -1 : 1, ph = (i % 2 ? 1 : -1) * side * step;
    const bx = -spread / 2 + fx * spread;
    x.beginPath(); x.moveTo(bx, side * 3); x.lineTo(bx + ph * 4, side * len); x.stroke();
  }
}
function quadruped(kind, step, atk) {
  const spec = {
    wolf: { len: 15, wid: 7.5, col: '#8d8f94', head: 6, snout: 5, ear: 1, tail: 10, tailc: '#6f7177', R: 30 },
    boar: { len: 14, wid: 9, col: '#6b4a32', head: 6.5, snout: 4, tusk: 1, tail: 3, R: 30 },
    bear: { len: 20, wid: 13, col: '#5a3e2a', head: 9, snout: 4, round: 1, tail: 2, R: 40 },
  }[kind];
  const [c, x] = canvas(spec.R * 2, spec.R * 2); x.translate(spec.R, spec.R);
  legs(x, 4, spec.wid + 3, spec.len * 1.2, step, shade(spec.col, -0.4), kind === 'bear' ? 5 : 3);
  if (spec.tail > 3) { x.strokeStyle = spec.tailc; x.lineWidth = 4; x.lineCap = 'round'; x.beginPath(); x.moveTo(-spec.len + 2, 0); x.quadraticCurveTo(-spec.len - 6, step * 4, -spec.len - spec.tail, step * 3); x.stroke(); }
  blob(x, 0, 0, spec.len, spec.wid, radial(x, 0, 0, spec.len, spec.col));
  if (kind === 'wolf') { x.fillStyle = 'rgba(40,40,45,.35)'; x.beginPath(); x.ellipse(-2, 0, spec.len * 0.7, 2.5, 0, 0, 7); x.fill(); }
  if (kind === 'boar') { x.strokeStyle = '#2a1a10'; x.lineWidth = 1.5; for (let i = -8; i < 6; i += 3) { x.beginPath(); x.moveTo(i, -1.5); x.lineTo(i + 2, 1.5); x.stroke(); } }
  const hx = spec.len - 1 + (atk ? 4 : 0);
  blob(x, hx, 0, spec.head, spec.head * 0.9, radial(x, hx, 0, spec.head, shade(spec.col, 0.05)));
  blob(x, hx + spec.head, 0, spec.snout, spec.snout * 0.65, shade(spec.col, kind === 'boar' ? 0.25 : -0.1), OUT, 1);
  x.fillStyle = '#111'; x.beginPath(); x.arc(hx + spec.head + spec.snout - 1, 0, 1.4, 0, 7); x.fill();
  if (spec.ear) { x.fillStyle = shade(spec.col, -0.2); for (const sy of [-1, 1]) { x.beginPath(); x.moveTo(hx - 2, sy * 3); x.lineTo(hx - 6, sy * 7); x.lineTo(hx + 1, sy * 6); x.closePath(); x.fill(); } }
  if (spec.round) for (const sy of [-1, 1]) blob(x, hx - 4, sy * 7, 2.6, 2.6, shade(spec.col, -0.15), OUT, 1);
  if (spec.tusk) { x.fillStyle = '#f0ead8'; for (const sy of [-1, 1]) { x.beginPath(); x.moveTo(hx + spec.head + 1, sy * 2.5); x.lineTo(hx + spec.head + 6, sy * 5); x.lineTo(hx + spec.head + 2, sy * 4); x.fill(); } }
  x.fillStyle = atk ? '#ff4030' : '#e8c040'; for (const sy of [-1, 1]) { x.beginPath(); x.arc(hx + spec.head * 0.5, sy * spec.head * 0.42, 1.2, 0, 7); x.fill(); }
  return c;
}
function spider(step, atk) {
  const R = 34, [c, x] = canvas(R * 2, R * 2); x.translate(R, R);
  x.strokeStyle = '#1c1420'; x.lineWidth = 2.4; x.lineCap = 'round';
  for (let i = 0; i < 4; i++) for (const side of [-1, 1]) {
    const a = (-0.9 + i * 0.6) * side, ph = ((i % 2) * 2 - 1) * step * 0.25 * side, k = side * (1.2 + i * 0.12);
    x.beginPath(); x.moveTo(2, 0);
    const mx = 2 + Math.cos(a + ph + side * 0.9) * 13, my = Math.sin(a + ph + side * 0.9) * 13 * 1.2;
    x.lineTo(mx, my); x.lineTo(mx + Math.cos(a + ph + k * 0.4) * 10 - 4, my + side * 8); x.stroke();
  }
  blob(x, -9, 0, 12, 10, radial(x, -9, 0, 12, '#3a2840'));
  x.fillStyle = '#c03040'; x.beginPath(); x.moveTo(-12, -3); x.lineTo(-6, 0); x.lineTo(-12, 3); x.lineTo(-9, 0); x.fill();
  blob(x, 5 + (atk ? 3 : 0), 0, 6.5, 5.5, radial(x, 5, 0, 6, '#4a3450'));
  x.fillStyle = '#ff3a3a'; for (const [ex, ey] of [[9, -2], [9, 2], [8, -3.5], [8, 3.5]]) { x.beginPath(); x.arc(ex + (atk ? 3 : 0), ey, 1, 0, 7); x.fill(); }
  return c;
}
function wraith(step, atk) {
  const R = 34, [c, x] = canvas(R * 2, R * 2); x.translate(R, R);
  const g = x.createLinearGradient(-26, 0, 10, 0); g.addColorStop(0, 'rgba(60,70,130,0)'); g.addColorStop(0.5, 'rgba(70,80,150,.75)'); g.addColorStop(1, 'rgba(110,120,200,.95)');
  x.fillStyle = g; x.beginPath(); x.moveTo(8, -12);
  for (let i = 0; i <= 6; i++) { const t = i / 6; x.lineTo(-14 - 10 * Math.sin(t * Math.PI) - (i % 2) * 6 + step * 2, -12 + 24 * t); }
  x.lineTo(8, 12); x.quadraticCurveTo(14, 0, 8, -12); x.fill();
  if (atk) { x.strokeStyle = '#b0c8ff'; x.lineWidth = 2; for (const sy of [-1, 1]) { x.beginPath(); x.moveTo(6, sy * 9); x.lineTo(18, sy * 6); x.stroke(); } }
  blob(x, 3, 0, 7.5, 7.5, radial(x, 3, 0, 7.5, '#3a4070'), 'rgba(160,180,255,.6)', 1.2);
  x.fillStyle = '#8ff0ff'; x.shadowColor = '#8ff0ff'; x.shadowBlur = 6; x.fillRect(6, -3.2, 2.2, 1.8); x.fillRect(6, 1.4, 2.2, 1.8); x.shadowBlur = 0;
  return c;
}

const SKINS = ['#f1c9a5', '#e0ac7e', '#c68b5e', '#8d5a3b', '#f6d7bd'];
const HAIRS = ['#3a2416', '#6b4423', '#c49a4a', '#1d1a18', '#8a3b1e', '#d8d0c0'];
const nameHash = (s) => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

export function playerLook(name, rank, color, wp) {
  const h = nameHash(name);
  const armor = rank >= 3 ? 'plate' : rank === 2 ? 'chain' : rank === 1 ? 'leather' : 'cloth';
  const head = rank >= 8 ? 'crown' : rank === 7 ? 'circlet' : rank >= 3 && rank <= 6 ? (rank >= 5 ? 'plume' : 'helm') : 'hair';
  return {
    skin: SKINS[h % SKINS.length], hair: HAIRS[(h >> 4) % HAIRS.length], tunic: color || '#9a8a68', armor, head, plume: color || '#c0392b',
    weapon: wp || 'sword', shield: wp === 'sword' && rank >= 2 ? (color || '#7a6a50') : null, cape: rank >= 4 ? (color || '#7a2a2a') : null,
  };
}
const MOB_LOOK = {
  bandit: () => ({ skin: SKINS[2], tunic: '#5a4a3a', armor: 'leather', head: 'bandana', hair: '#a02828', weapon: 'axe' }),
  skeleton: () => ({ skin: '#e6e0cc', tunic: '#cfc8b0', armor: 'ribs', head: 'skull', weapon: 'bow' }),
  cultist: () => ({ skin: SKINS[4], tunic: '#4a2460', robe: 1, head: 'hood', hood: '#3a1a4a', eyes: '#ff5050', weapon: 'darkstaff' }),
  ogre: () => ({ skin: '#7d9a4a', tunic: '#6a4a2a', armor: 'cloth', head: 'bald', weapon: 'club', scale: 1.45 }),
  guard: (c) => ({ skin: SKINS[1], tunic: c, armor: 'chain', head: 'helm', weapon: 'spear' }),
  archer: (c) => ({ skin: SKINS[0], tunic: c, armor: 'leather', head: 'hood', hood: shade(c, -0.3), weapon: 'bow' }),
  captain: (c) => ({ skin: SKINS[2], tunic: c, armor: 'plate', head: 'plume', plume: c, weapon: 'sword', shield: c, cape: c, scale: 1.2 }),
  footman: (c) => ({ skin: SKINS[1], tunic: c, armor: 'chain', head: 'helm', weapon: 'sword', shield: c }),
  summoned_archer: (c) => ({ skin: SKINS[3], tunic: c, armor: 'leather', head: 'hood', hood: shade(c, -0.3), weapon: 'bow' }),
  knight: (c) => ({ skin: SKINS[0], tunic: c, armor: 'plate', head: 'greathelm', weapon: 'sword', shield: c, cape: c, scale: 1.1 }),
};
// Returns a cached canvas for a creature, plus its drawing radius in world units.
export function creature(kind, color, step, atk, look) {
  const st = step > 0.3 ? 1 : step < -0.3 ? -1 : 0, a = atk ? 1 : 0;
  if (kind === 'player') {
    const key = `p|${look.skin}|${look.hair}|${look.tunic}|${look.armor}|${look.head}|${look.weapon}|${look.shield}|${look.cape}|${st}|${a}`;
    return memo(key, () => humanoid(look, st, a));
  }
  const key = `${kind}|${color}|${st}|${a}`;
  return memo(key, () => {
    if (kind === 'wolf' || kind === 'boar' || kind === 'bear') return quadruped(kind, st, a);
    if (kind === 'spider') return spider(st, a);
    if (kind === 'wraith') return wraith(st, a);
    const lf = MOB_LOOK[kind] || MOB_LOOK.guard;
    return humanoid(lf(color || '#8a8a8a'), st, a);
  });
}
export function banner(color) {
  return memo('banner|' + color, () => {
    const [c, x] = canvas(48, 70); x.translate(14, 62);
    x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.ellipse(0, 0, 9, 4, 0, 0, 7); x.fill();
    x.fillStyle = '#6a4a2a'; x.fillRect(-1.6, -56, 3.2, 56);
    x.fillStyle = '#d8b040'; x.beginPath(); x.arc(0, -57, 2.6, 0, 7); x.fill();
    const g = x.createLinearGradient(0, -52, 28, -30); g.addColorStop(0, shade(color, 0.2)); g.addColorStop(1, shade(color, -0.3));
    x.fillStyle = g; x.beginPath(); x.moveTo(1.6, -53); x.lineTo(30, -50); x.lineTo(24, -40); x.lineTo(30, -30); x.lineTo(1.6, -32); x.closePath(); x.fill();
    x.strokeStyle = OUT; x.lineWidth = 1; x.stroke();
    x.fillStyle = '#f4e4a0'; x.beginPath(); x.arc(13, -41.5, 4, 0, 7); x.fill();
    return c;
  });
}

// ------------------------------------------------------------------ props
const TREE_TINT = { grass: '#4f8a3a', forest: '#3f7a34', darkforest: '#2c5a34', swamp: '#56683a', heath: '#6a8a3a', snow: '#3e6a4a', rock: '#4a7040', ash: '#4a4a3a', desert: '#6a8a3a' };
export function prop(k, v, biome) {
  return memo(`prop|${k}|${v}|${biome}`, () => {
    const R = rng(v * 977 + k.length * 31 + biome.length);
    if (k === 'tree') {
      const s = 34 + v * 4, [c, x] = canvas(s * 2 + 8, s * 2 + 8); x.translate(s + 4, s + 4);
      const base = TREE_TINT[biome] || '#4f8a3a';
      x.fillStyle = 'rgba(0,0,0,.22)'; x.beginPath(); x.ellipse(6, 8, s * 0.95, s * 0.8, 0, 0, 7); x.fill();
      const blobs = [[0, 0, s * 0.62]];
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + R(); blobs.push([Math.cos(a) * s * 0.42, Math.sin(a) * s * 0.42, s * (0.36 + R() * 0.12)]); }
      for (const [bx, by, br] of blobs) { x.fillStyle = shade(base, -0.45); x.beginPath(); x.arc(bx + 1.5, by + 2, br + 1.5, 0, 7); x.fill(); }
      for (const [bx, by, br] of blobs) { x.fillStyle = radial(x, bx, by, br, base); x.beginPath(); x.arc(bx, by, br, 0, 7); x.fill(); }
      for (let i = 0; i < 14; i++) { const a = R() * 7, d = R() * s * 0.7; x.fillStyle = `rgba(255,255,220,${0.05 + R() * 0.08})`; x.beginPath(); x.arc(Math.cos(a) * d - 3, Math.sin(a) * d - 3, 2 + R() * 4, 0, 7); x.fill(); }
      if (biome === 'grass' && v === 3) { x.fillStyle = '#d84040'; for (let i = 0; i < 8; i++) { x.beginPath(); x.arc((R() - 0.5) * s, (R() - 0.5) * s, 1.8, 0, 7); x.fill(); } }
      return { c, r: s + 4 };
    }
    if (k === 'pine') {
      const s = 30 + v * 3, [c, x] = canvas(s * 2 + 8, s * 2 + 8); x.translate(s + 4, s + 4);
      x.fillStyle = 'rgba(0,0,0,.22)'; x.beginPath(); x.ellipse(6, 8, s * 0.9, s * 0.75, 0, 0, 7); x.fill();
      const base = biome === 'snow' ? '#2f5a46' : '#2a5236';
      for (let layer = 0; layer < 4; layer++) {
        const rr = s * (1 - layer * 0.22), pts = 9, rot = layer * 0.35;
        x.fillStyle = shade(base, layer * 0.08 - 0.05); x.beginPath();
        for (let i = 0; i <= pts * 2; i++) { const a = (i / (pts * 2)) * Math.PI * 2 + rot, d = i % 2 ? rr * 0.62 : rr; x.lineTo(Math.cos(a) * d, Math.sin(a) * d); }
        x.closePath(); x.fill(); x.strokeStyle = 'rgba(10,25,15,.5)'; x.lineWidth = 1; x.stroke();
        if (biome === 'snow') { x.fillStyle = 'rgba(245,250,255,.55)'; for (let i = 0; i < pts; i++) { const a = (i / pts) * Math.PI * 2 + rot; x.beginPath(); x.arc(Math.cos(a) * rr * 0.7 - 1, Math.sin(a) * rr * 0.7 - 1, rr * 0.12, 0, 7); x.fill(); } }
      }
      x.fillStyle = '#5a3a20'; x.beginPath(); x.arc(0, 0, 3, 0, 7); x.fill();
      return { c, r: s + 4 };
    }
    if (k === 'dead') {
      const s = 30, [c, x] = canvas(s * 2 + 8, s * 2 + 8); x.translate(s + 4, s + 4);
      x.fillStyle = 'rgba(0,0,0,.2)'; x.beginPath(); x.ellipse(4, 6, 12, 9, 0, 0, 7); x.fill();
      x.strokeStyle = biome === 'ash' ? '#2a2220' : '#4a3a2a'; x.lineCap = 'round';
      const branch = (bx, by, a, len, w) => { if (len < 4) return; const ex = bx + Math.cos(a) * len, ey = by + Math.sin(a) * len; x.lineWidth = w; x.beginPath(); x.moveTo(bx, by); x.lineTo(ex, ey); x.stroke(); branch(ex, ey, a - 0.5 - R() * 0.3, len * 0.62, w * 0.65); branch(ex, ey, a + 0.5 + R() * 0.3, len * 0.6, w * 0.65); };
      for (let i = 0; i < 5; i++) branch(0, 0, (i / 5) * Math.PI * 2 + R(), 13 + R() * 6, 4);
      blob(x, 0, 0, 7, 7, '#3a2a1c');
      return { c, r: s + 4 };
    }
    if (k === 'cactus') {
      const s = 22, [c, x] = canvas(s * 2 + 8, s * 2 + 8); x.translate(s + 4, s + 4);
      x.fillStyle = 'rgba(0,0,0,.2)'; x.beginPath(); x.ellipse(4, 6, 14, 10, 0, 0, 7); x.fill();
      for (const [ax, ay] of [[-12, -4], [11, 5]]) blob(x, ax, ay, 5, 5, radial(x, ax, ay, 5, '#5a9a4a'));
      x.strokeStyle = '#4a8a3a'; x.lineWidth = 5; x.beginPath(); x.moveTo(-12, -4); x.lineTo(0, 0); x.lineTo(11, 5); x.stroke();
      blob(x, 0, 0, 10, 10, radial(x, 0, 0, 10, '#5fa84e'));
      x.strokeStyle = 'rgba(20,60,20,.5)'; x.lineWidth = 1; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); x.stroke(); }
      if (v % 2) { x.fillStyle = '#ff6a9a'; x.beginPath(); x.arc(0, 0, 3, 0, 7); x.fill(); }
      return { c, r: s + 4 };
    }
    if (k === 'bush') {
      const s = 18, [c, x] = canvas(s * 2 + 6, s * 2 + 6); x.translate(s + 3, s + 3);
      const base = shade(TREE_TINT[biome] || '#4f8a3a', 0.08);
      x.fillStyle = 'rgba(0,0,0,.2)'; x.beginPath(); x.ellipse(3, 4, s * 0.9, s * 0.7, 0, 0, 7); x.fill();
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + R(), d = s * 0.35; x.fillStyle = radial(x, Math.cos(a) * d, Math.sin(a) * d, s * 0.5, base); x.beginPath(); x.arc(Math.cos(a) * d, Math.sin(a) * d, s * 0.5, 0, 7); x.fill(); }
      if (v === 1) { x.fillStyle = '#e04060'; for (let i = 0; i < 6; i++) { x.beginPath(); x.arc((R() - 0.5) * s, (R() - 0.5) * s, 1.6, 0, 7); x.fill(); } }
      if (v === 2) { x.fillStyle = '#f0e070'; for (let i = 0; i < 6; i++) { x.beginPath(); x.arc((R() - 0.5) * s, (R() - 0.5) * s, 1.4, 0, 7); x.fill(); } }
      return { c, r: s + 3 };
    }
    // rock
    const s = 16 + v * 5 + 4, [c, x] = canvas(s * 2 + 8, s * 2 + 8); x.translate(s + 4, s + 4);
    const col = biome === 'ash' ? '#4a4040' : biome === 'desert' ? '#a88a62' : biome === 'snow' ? '#8a909a' : '#7d7b78';
    x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(4, 5, s * 0.95, s * 0.8, 0, 0, 7); x.fill();
    const pts = []; for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, d = (s - 4) * (0.82 + R() * 0.22); pts.push([Math.cos(a) * d, Math.sin(a) * d]); }
    x.beginPath(); pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath();
    x.fillStyle = radial(x, 0, 0, s, col); x.fill(); x.strokeStyle = OUT; x.lineWidth = 1.5; x.stroke();
    x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(pts[5][0] * 0.6, pts[5][1] * 0.6); x.lineTo(pts[6][0] * 0.3, pts[6][1] * 0.3); x.lineTo(pts[7][0] * 0.6, pts[7][1] * 0.6); x.stroke();
    x.strokeStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.moveTo(pts[1][0] * 0.5, pts[1][1] * 0.5); x.lineTo(pts[2][0] * 0.2, pts[2][1] * 0.1); x.stroke();
    if (biome === 'snow') { x.fillStyle = 'rgba(250,252,255,.85)'; x.beginPath(); x.ellipse(-s * 0.15, -s * 0.2, s * 0.5, s * 0.35, -0.3, 0, 7); x.fill(); }
    if (v === 3 && biome !== 'snow') { x.fillStyle = 'rgba(90,140,60,.55)'; x.beginPath(); x.ellipse(-s * 0.2, -s * 0.25, s * 0.35, s * 0.2, 0.4, 0, 7); x.fill(); }
    return { c, r: s + 4 };
  });
}

// ------------------------------------------------------------------ castles
const { CASTLE_HALF: CH, WALL, GATE, TOWER_R, KEEP_W, KEEP_H } = WORLD;
const CPAD = TOWER_R + 24, CSIZE = (CH + CPAD) * 2;
function stoneTexture(x, x0, y0, w, h, base, R) {
  x.fillStyle = base; x.fillRect(x0, y0, w, h);
  const bw = 14, bh = 8;
  for (let yy = y0, row = 0; yy < y0 + h; yy += bh, row++) for (let xx = x0 - (row % 2) * 7; xx < x0 + w; xx += bw) {
    x.fillStyle = shade(base, (R() - 0.5) * 0.18); x.fillRect(Math.max(x0, xx) + 0.6, yy + 0.6, Math.min(bw, x0 + w - Math.max(x0, xx)) - 1.2, Math.min(bh, y0 + h - yy) - 1.2);
  }
}
export function castleBase(id) {
  return memo('cbase|' + id, () => {
    const R = rng(id * 101 + 7), [c, x] = canvas(CSIZE, CSIZE); x.translate(CSIZE / 2, CSIZE / 2);
    // packed earth outside, flagstones inside, roads through the gates
    x.fillStyle = 'rgba(110,90,60,.35)'; x.beginPath(); x.ellipse(0, 0, CH + 30, CH + 30, 0, 0, 7); x.fill();
    const s = CH - WALL;
    x.fillStyle = '#8a8070'; x.fillRect(-s, -s, s * 2, s * 2);
    for (let yy = -s; yy < s; yy += 18) for (let xx = -s + ((yy / 18) % 2 ? 9 : 0); xx < s; xx += 18) {
      x.fillStyle = shade('#9a9080', (R() - 0.5) * 0.22); x.fillRect(Math.max(-s, xx) + 1, yy + 1, Math.min(17, s - xx) - 1, Math.min(17, s - yy) - 1);
    }
    x.fillStyle = '#9a8460'; x.fillRect(-GATE / 2 + 8, -CH - 30, GATE - 16, CH * 2 + 60);
    for (let i = 0; i < 30; i++) { x.fillStyle = 'rgba(60,45,30,.25)'; x.beginPath(); x.arc((R() - 0.5) * (GATE - 30), (R() - 0.5) * CH * 2, 2 + R() * 3, 0, 7); x.fill(); }
    // courtyard details: hay, barrels, training dummy
    for (const [bx, by] of [[-s + 30, s - 40], [-s + 52, s - 30], [s - 34, s - 34]]) { blob(x, bx, by, 9, 9, radial(x, bx, by, 9, '#8a5a2a')); x.strokeStyle = '#4a3016'; x.lineWidth = 1; x.beginPath(); x.arc(bx, by, 6, 0, 7); x.stroke(); }
    blob(x, s - 50, -s + 40, 14, 10, radial(x, s - 50, -s + 40, 14, '#d8c070'));
    return c;
  });
}
export function castleTop(id, color) {
  return memo(`ctop|${id}|${color}`, () => {
    const R = rng(id * 131 + 3), [c, x] = canvas(CSIZE, CSIZE); x.translate(CSIZE / 2, CSIZE / 2);
    const g = GATE / 2, stone = '#8e8a82';
    const wallRect = (x0, y0, w, h) => {
      // wall body with a lighter walkway and crenellations on the outer edge
      x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(x0 + 5, y0 + 7, w, h);
      stoneTexture(x, x0, y0, w, h, stone, R);
      x.strokeStyle = OUT; x.lineWidth = 1.5; x.strokeRect(x0, y0, w, h);
      const horiz = w > h, inset = 6;
      x.fillStyle = 'rgba(255,255,255,.12)';
      if (horiz) x.fillRect(x0, y0 + inset, w, h - inset * 2); else x.fillRect(x0 + inset, y0, w - inset * 2, h);
      x.fillStyle = shade(stone, 0.18);
      const merl = 10;
      if (horiz) { const outer = y0 < 0 ? y0 : y0 + h - 5; for (let xx = x0 + 2; xx < x0 + w - 6; xx += merl * 1.6) { x.fillRect(xx, outer, merl, 5); x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 0.8; x.strokeRect(xx, outer, merl, 5); } }
      else { const outer = x0 < 0 ? x0 : x0 + w - 5; for (let yy = y0 + 2; yy < y0 + h - 6; yy += merl * 1.6) { x.fillRect(outer, yy, 5, merl); x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 0.8; x.strokeRect(outer, yy, 5, merl); } }
    };
    wallRect(-CH, -CH, WALL, CH * 2); wallRect(CH - WALL, -CH, WALL, CH * 2);
    for (const yy of [-CH, CH - WALL]) { wallRect(-CH, yy, CH - g, WALL); wallRect(g, yy, CH - g, WALL); }
    // gatehouses: small towers beside each gate with banners
    for (const yy of [-CH + WALL / 2, CH - WALL / 2]) for (const sx of [-1, 1]) {
      const gx = sx * (g + 4);
      blob(x, gx, yy, 15, 15, radial(x, gx, yy, 15, '#9a958c'), OUT, 1.5);
      x.fillStyle = shade(stone, -0.3); x.beginPath(); x.arc(gx, yy, 9, 0, 7); x.fill();
      x.fillStyle = color; x.fillRect(gx - 4, yy - 3, 8, 6);
    }
    // corner towers with conical roofs
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const tx = dx * (CH - WALL / 2), ty = dy * (CH - WALL / 2);
      x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.arc(tx + 6, ty + 8, TOWER_R, 0, 7); x.fill();
      blob(x, tx, ty, TOWER_R, TOWER_R, radial(x, tx, ty, TOWER_R, '#9a958c'), OUT, 2);
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; x.fillStyle = i % 2 ? '#b0aba2' : '#7a766e'; x.beginPath(); x.arc(tx + Math.cos(a) * (TOWER_R - 4), ty + Math.sin(a) * (TOWER_R - 4), 4, 0, 7); x.fill(); }
      const rg = x.createRadialGradient(tx - 6, ty - 6, 2, tx, ty, TOWER_R - 8);
      rg.addColorStop(0, shade(color, 0.35)); rg.addColorStop(1, shade(color, -0.45));
      x.fillStyle = rg; x.beginPath(); x.arc(tx, ty, TOWER_R - 9, 0, 7); x.fill(); x.strokeStyle = OUT; x.lineWidth = 1.2; x.stroke();
      x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 1; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; x.beginPath(); x.moveTo(tx, ty); x.lineTo(tx + Math.cos(a) * (TOWER_R - 9), ty + Math.sin(a) * (TOWER_R - 9)); x.stroke(); }
      x.fillStyle = '#e0c060'; x.beginPath(); x.arc(tx, ty, 2.5, 0, 7); x.fill();
    }
    // keep: stone walls and a pitched roof in the owner's colour
    const kx = -KEEP_W / 2, ky = -KEEP_H / 2 - 20;
    x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(kx + 8, ky + 10, KEEP_W, KEEP_H);
    stoneTexture(x, kx, ky, KEEP_W, KEEP_H, '#86827a', R); x.strokeStyle = OUT; x.lineWidth = 2; x.strokeRect(kx, ky, KEEP_W, KEEP_H);
    const roofC = shade(color, -0.15), rx0 = kx + 8, ry0 = ky + 8, rw = KEEP_W - 16, rh = KEEP_H - 16;
    x.fillStyle = shade(roofC, 0.15); x.beginPath(); x.moveTo(rx0, ry0); x.lineTo(rx0 + rw, ry0); x.lineTo(rx0 + rw - rh / 2, ry0 + rh / 2); x.lineTo(rx0 + rh / 2, ry0 + rh / 2); x.closePath(); x.fill();
    x.fillStyle = shade(roofC, -0.25); x.beginPath(); x.moveTo(rx0, ry0 + rh); x.lineTo(rx0 + rw, ry0 + rh); x.lineTo(rx0 + rw - rh / 2, ry0 + rh / 2); x.lineTo(rx0 + rh / 2, ry0 + rh / 2); x.closePath(); x.fill();
    x.fillStyle = roofC; x.beginPath(); x.moveTo(rx0, ry0); x.lineTo(rx0 + rh / 2, ry0 + rh / 2); x.lineTo(rx0, ry0 + rh); x.closePath(); x.fill();
    x.fillStyle = shade(roofC, -0.1); x.beginPath(); x.moveTo(rx0 + rw, ry0); x.lineTo(rx0 + rw - rh / 2, ry0 + rh / 2); x.lineTo(rx0 + rw, ry0 + rh); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 1; for (let yy = ry0 + 5; yy < ry0 + rh; yy += 5) { x.beginPath(); x.moveTo(rx0 + 2, yy); x.lineTo(rx0 + rw - 2, yy); x.stroke(); }
    x.strokeStyle = shade(roofC, 0.4); x.lineWidth = 2.5; x.beginPath(); x.moveTo(rx0 + rh / 2, ry0 + rh / 2); x.lineTo(rx0 + rw - rh / 2, ry0 + rh / 2); x.stroke();
    x.strokeStyle = OUT; x.lineWidth = 1.2; x.strokeRect(rx0, ry0, rw, rh);
    return c;
  });
}
export const CASTLE_SPRITE_SIZE = CSIZE;

// ------------------------------------------------------------------ village
const VSIZE = (VILLAGE.r + 60) * 2;
export function villageBase() {
  return memo('vbase', () => {
    const R = rng(55), [c, x] = canvas(VSIZE, VSIZE); x.translate(VSIZE / 2, VSIZE / 2);
    x.fillStyle = 'rgba(150,120,80,.45)'; x.beginPath(); x.arc(0, 0, VILLAGE.r - 10, 0, 7); x.fill();
    x.fillStyle = '#b09a74'; x.beginPath(); x.arc(0, 0, 95, 0, 7); x.fill();
    for (let i = 0; i < 160; i++) { const a = R() * 7, d = Math.sqrt(R()) * 92; x.fillStyle = shade('#b8a27a', (R() - 0.5) * 0.25); x.beginPath(); x.arc(Math.cos(a) * d, Math.sin(a) * d, 4 + R() * 4, 0, 7); x.fill(); }
    // flowers and the fence ring that marks the safe zone
    for (let i = 0; i < 70; i++) { const a = R() * 7, d = 110 + R() * (VILLAGE.r - 130); x.fillStyle = ['#f06080', '#f0d050', '#ffffff', '#a070f0'][i % 4]; x.beginPath(); x.arc(Math.cos(a) * d, Math.sin(a) * d, 1.8, 0, 7); x.fill(); }
    x.strokeStyle = '#7a5530'; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, VILLAGE.r, 0, 7); x.stroke();
    for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2; blob(x, Math.cos(a) * VILLAGE.r, Math.sin(a) * VILLAGE.r, 3.2, 3.2, '#8a6038', OUT, 1); }
    // market stalls
    for (const [sx, sy, col] of [[-60, 40, '#c04040'], [55, 50, '#3a70c0'], [0, -70, '#d0a020']]) {
      x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(sx - 18, sy - 10, 40, 26);
      for (let i = 0; i < 5; i++) { x.fillStyle = i % 2 ? '#f4ecd8' : col; x.fillRect(sx - 20 + i * 8, sy - 14, 8, 24); }
      x.strokeStyle = OUT; x.lineWidth = 1.2; x.strokeRect(sx - 20, sy - 14, 40, 24);
    }
    return c;
  });
}
export function villageTop() {
  return memo('vtop', () => {
    const R = rng(77), [c, x] = canvas(VSIZE, VSIZE), ox = VSIZE / 2 - VILLAGE.x, oy = VSIZE / 2 - VILLAGE.y;
    x.translate(VSIZE / 2, VSIZE / 2);
    // well
    blob(x, 0, 0, 22, 22, radial(x, 0, 0, 22, '#8a8478'), OUT, 2);
    x.fillStyle = '#2a5a7a'; x.beginPath(); x.arc(0, 0, 13, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,255,255,.3)'; x.beginPath(); x.arc(-4, -4, 4, 0, 7); x.fill();
    x.fillStyle = '#6a4a2a'; x.fillRect(-20, -2, 40, 4);
    x.translate(-VSIZE / 2 + ox, -VSIZE / 2 + oy);
    const ROOFS = ['#a0522d', '#5a6a8a', '#8a3a3a'];
    for (const h of HOUSES) {
      x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(h.x + 7, h.y + 9, h.w, h.h);
      x.fillStyle = '#d8c8a0'; x.fillRect(h.x, h.y, h.w, h.h); x.strokeStyle = '#5a3a1a'; x.lineWidth = 2; x.strokeRect(h.x, h.y, h.w, h.h);
      const rc = ROOFS[h.v], mid = h.y + h.h / 2;
      x.fillStyle = shade(rc, 0.12); x.fillRect(h.x - 4, h.y - 4, h.w + 8, h.h / 2 + 4);
      x.fillStyle = shade(rc, -0.2); x.fillRect(h.x - 4, mid, h.w + 8, h.h / 2 + 4);
      x.strokeStyle = 'rgba(0,0,0,.22)'; x.lineWidth = 1; for (let xx = h.x; xx < h.x + h.w + 4; xx += 6) { x.beginPath(); x.moveTo(xx, h.y - 4); x.lineTo(xx, h.y + h.h + 4); x.stroke(); }
      x.strokeStyle = shade(rc, 0.45); x.lineWidth = 3; x.beginPath(); x.moveTo(h.x - 4, mid); x.lineTo(h.x + h.w + 4, mid); x.stroke();
      x.strokeStyle = OUT; x.lineWidth = 1.5; x.strokeRect(h.x - 4, h.y - 4, h.w + 8, h.h + 8);
      const cx = h.x + h.w * (0.25 + R() * 0.5); x.fillStyle = '#7a6a5a'; x.fillRect(cx - 4, h.y + 2, 8, 9); x.strokeRect(cx - 4, h.y + 2, 8, 9);
    }
    return c;
  });
}
export const VILLAGE_SPRITE_SIZE = VSIZE;
