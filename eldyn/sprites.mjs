// Hanbin Island sprite atlas. Every character, creature, prop and building is painted once into an
// offscreen canvas (at 2x for sharp edges) and cached; the renderer only blits and rotates them.
import { CASTLE_TYPES, HOUSES, VILLAGE, rng } from './shared.mjs';

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
// Polearms: [shaft length, head shape].
const POLE = { pike: [52, 'spear'], partisan: [54, 'fork'], lance: [48, 'spear'], glaive: [42, 'blade'], halberd: [42, 'axe'], pollaxe: [40, 'hook'], ranseur: [44, 'fork'], bardiche: [38, 'wide'], pilum: [34, 'spear'] };
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
  } else if (kind === 'greataxe') {
    x.rotate(swing ? 0.1 : -0.9);
    x.fillStyle = '#5a3a1e'; x.fillRect(-6, -1.8, 32, 3.6);
    const g = x.createLinearGradient(20, -14, 20, 14); g.addColorStop(0, '#eef2f6'); g.addColorStop(1, '#8a94a2');
    x.fillStyle = g; x.beginPath(); x.moveTo(19, -2); x.quadraticCurveTo(24, -15, 32, -14); x.quadraticCurveTo(29, 0, 32, 14); x.quadraticCurveTo(24, 15, 19, 2); x.closePath(); x.fill();
    x.strokeStyle = OUT; x.lineWidth = 0.9; x.stroke();
    x.fillStyle = '#c9a43a'; x.fillRect(17, -2.5, 3, 5);
  } else if (kind === 'dagger') {
    x.rotate(swing ? 0.15 : -0.5);
    x.fillStyle = '#4a2e14'; x.fillRect(-3, -1.3, 5, 2.6);
    x.fillStyle = '#9a8a5a'; x.fillRect(2, -3, 1.6, 6);
    const g = x.createLinearGradient(0, -1.5, 0, 1.5); g.addColorStop(0, '#f4f7fb'); g.addColorStop(1, '#8d97a6');
    x.fillStyle = g; x.beginPath(); x.moveTo(3.6, -1.6); x.lineTo(13, -0.6); x.lineTo(15, 0); x.lineTo(13, 0.6); x.lineTo(3.6, 1.6); x.closePath(); x.fill();
    x.strokeStyle = OUT; x.lineWidth = 0.7; x.stroke();
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
  } else if (kind === 'greatsword') {
    x.rotate(swing ? -0.15 : -0.95);
    x.fillStyle = '#4a2e14'; x.fillRect(-7, -1.8, 9, 3.6);
    x.fillStyle = '#c9a43a'; x.fillRect(1, -6.5, 3, 13);
    const g = x.createLinearGradient(0, -3, 0, 3); g.addColorStop(0, '#f4f7fb'); g.addColorStop(1, '#8d97a6');
    x.fillStyle = g; x.beginPath(); x.moveTo(4, -2.4); x.lineTo(34, -2.4); x.lineTo(39, 0); x.lineTo(34, 2.4); x.lineTo(4, 2.4); x.closePath(); x.fill();
    x.strokeStyle = OUT; x.lineWidth = 0.8; x.stroke();
  } else if (kind === 'flail') {
    x.rotate(swing ? 0.3 : -0.7);
    x.fillStyle = '#5a3a1e'; x.fillRect(-4, -1.5, 14, 3);
    x.strokeStyle = '#8a8f98'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(10, 0); x.quadraticCurveTo(16, swing ? 6 : -4, 21, 0); x.stroke();
    x.fillStyle = '#6a707a'; x.beginPath(); x.arc(24, 0, 4.2, 0, 7); x.fill(); x.strokeStyle = OUT; x.lineWidth = 0.8; x.stroke();
    x.fillStyle = '#c8ccd4'; for (let i = 0; i < 6; i++) { const a = i * 1.05; x.beginPath(); x.moveTo(24 + Math.cos(a) * 4, Math.sin(a) * 4); x.lineTo(24 + Math.cos(a) * 6.5, Math.sin(a) * 6.5); x.lineTo(24 + Math.cos(a + 0.4) * 4, Math.sin(a + 0.4) * 4); x.fill(); }
  } else if (kind === 'mace') {
    x.rotate(swing ? 0 : -0.7);
    x.fillStyle = '#6a4a2a'; x.fillRect(-3, -1.3, 20, 2.6);
    x.fillStyle = '#d8b040'; x.beginPath(); x.arc(19, 0, 3.6, 0, 7); x.fill(); x.strokeStyle = OUT; x.lineWidth = 0.8; x.stroke();
  } else if (kind === 'staffplain') {
    x.rotate(swing ? 0.1 : -0.3);
    x.fillStyle = '#7a5530'; x.fillRect(-16, -1.4, 44, 2.8); x.strokeStyle = OUT; x.lineWidth = 0.6; x.strokeRect(-16, -1.4, 44, 2.8);
  } else if (kind === 'crossbow') {
    x.fillStyle = '#6a4a2a'; x.fillRect(-4, -2, 22, 4);
    x.strokeStyle = '#5a3a1a'; x.lineWidth = 2.4; x.beginPath(); x.moveTo(14, -11); x.quadraticCurveTo(18, 0, 14, 11); x.stroke();
    x.strokeStyle = '#e8e0c8'; x.lineWidth = 0.7; x.beginPath(); x.moveTo(14, -11); x.lineTo(swing ? 10 : 4, 0); x.lineTo(14, 11); x.stroke();
    x.fillStyle = '#ccd'; x.fillRect(4, -0.8, 16, 1.6);
  } else if (kind === 'sling') {
    x.strokeStyle = '#8a6a3a'; x.lineWidth = 1; x.beginPath(); x.moveTo(0, 0); x.lineTo(swing ? 18 : 9, swing ? -2 : 8); x.stroke();
    x.fillStyle = '#7a5a30'; x.beginPath(); x.ellipse(swing ? 18 : 9, swing ? -2 : 8, 3, 2, 0, 0, 7); x.fill();
  } else if (POLE[kind]) {
    const [len, head] = POLE[kind];
    x.rotate(swing ? 0.05 : -0.25);
    x.fillStyle = '#7a5530'; x.fillRect(-14, -1.2, len, 2.4);
    const e = len - 14; x.fillStyle = '#d8dee6'; x.strokeStyle = OUT; x.lineWidth = 0.8; x.beginPath();
    if (head === 'spear') { x.moveTo(e, -3); x.lineTo(e + 8, 0); x.lineTo(e, 3); }
    else if (head === 'blade') { x.moveTo(e - 2, -2); x.quadraticCurveTo(e + 10, -7, e + 13, 0); x.lineTo(e - 2, 2.5); }
    else if (head === 'axe') { x.moveTo(e, -1); x.lineTo(e + 8, 0); x.lineTo(e, 1); x.moveTo(e - 6, -1); x.quadraticCurveTo(e - 2, -11, e + 3, -10); x.lineTo(e + 1, -1); }
    else if (head === 'hook') { x.moveTo(e, -2); x.lineTo(e + 9, 0); x.lineTo(e, 2); x.moveTo(e - 3, 1); x.quadraticCurveTo(e - 1, 8, e - 7, 7); x.lineTo(e - 3, 2); }
    else if (head === 'fork') { x.moveTo(e, -2); x.lineTo(e + 10, 0); x.lineTo(e, 2); x.moveTo(e - 2, -1); x.lineTo(e + 4, -6); x.lineTo(e + 1, -1); x.moveTo(e - 2, 1); x.lineTo(e + 4, 6); x.lineTo(e + 1, 1); }
    else if (head === 'wide') { x.moveTo(e - 8, -1.5); x.quadraticCurveTo(e - 4, -12, e + 6, -11); x.quadraticCurveTo(e + 2, -4, e + 4, 1.5); x.lineTo(e - 8, 1.5); }
    x.closePath(); x.fill(); x.stroke();
  } else if (kind === 'darkstaff') {
    x.rotate(-0.15);
    x.fillStyle = '#2a1a2a'; x.fillRect(-10, -1.4, 32, 2.8);
    x.fillStyle = '#e0e0d0'; x.beginPath(); x.arc(24, 0, 4, 0, 7); x.fill(); x.fillStyle = '#300'; x.fillRect(24, -2, 1.5, 1.5); x.fillRect(24, 0.6, 1.5, 1.5);
  }
  x.restore();
}
function bow(x, drawn, len = 1) {
  x.save(); x.scale(1, len);
  x.strokeStyle = '#7a4a22'; x.lineWidth = 2.6; x.beginPath(); x.arc(-4, 0, 14, -1.1, 1.1); x.stroke();
  x.strokeStyle = '#e8e0c8'; x.lineWidth = 0.7; x.beginPath();
  const ex = -4 + Math.cos(1.1) * 14, ey = Math.sin(1.1) * 14, pull = drawn ? -9 : -1;
  x.moveTo(ex, -ey); x.lineTo(pull, 0); x.lineTo(ex, ey); x.stroke();
  if (drawn) { x.strokeStyle = '#d8c8a0'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(pull, 0); x.lineTo(14, 0); x.stroke(); x.fillStyle = '#ccc'; x.beginPath(); x.moveTo(14, -2); x.lineTo(18, 0); x.lineTo(14, 2); x.fill(); }
  x.restore();
}
// Shapes of the shields, seen from above: [half-depth, half-width, shape].
const SHIELD = { buckler: [3, 6, 'o'], parma: [3.5, 7, 'o'], targe: [4, 8.5, 'o'], round: [4.5, 11, 'o'], kite: [4.5, 11, 'k'], heraldic: [4.5, 10.5, 'k'], scutum: [5, 12, 'r'], pavise: [6, 14, 'r'] };
function shield(x, color, kind) {
  const [d, w, sh] = SHIELD[kind] || [4.5, 9.5, 'o'];
  x.save();
  x.beginPath();
  if (sh === 'r') { x.moveTo(-d, -w); x.quadraticCurveTo(d * 1.6, -w, d, 0); x.quadraticCurveTo(d * 1.6, w, -d, w); x.closePath(); }
  else if (sh === 'k') { x.moveTo(-d, -w); x.lineTo(d, -w * 0.6); x.lineTo(d * 1.4, w * 0.4); x.lineTo(-d * 0.2, w); x.closePath(); }
  else x.ellipse(0, 0, d, w, 0, 0, 7);
  x.fillStyle = radial(x, 0, 0, w, color); x.fill();
  x.strokeStyle = '#b8a060'; x.lineWidth = 1.6; x.stroke();
  x.fillStyle = '#d8c070'; x.beginPath(); x.arc(0.5, 0, kind === 'heraldic' ? 3 : 1.8, 0, 7); x.fill();
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
  if (o.weapon === 'crossbow' || o.weapon === 'sling') { x.save(); x.translate(8, 0); weapon(x, o.weapon, atk); x.restore(); }
  if (o.shield) { x.save(); x.translate(o.raised ? 11 : 5, o.raised ? -6 : -13); shield(x, o.shield, o.shieldKind); x.restore(); }
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
  if (o.weapon === 'dagger') { x.save(); x.translate(atk ? 8 : 10, atk ? -12 : -10); weapon(x, 'dagger', !atk); x.restore(); }
  if (o.weapon !== 'bow') blob(x, 7, -11, 3.2, 3.2, o.armor === 'plate' ? '#9aa3b2' : skin, OUT, 1);
  x.save(); x.translate(hx, hy);
  if (o.weapon && o.weapon !== 'bow' && o.weapon !== 'crossbow' && o.weapon !== 'sling') weapon(x, o.weapon, atk);
  x.restore();
  blob(x, hx, hy, 3.2, 3.2, o.armor === 'plate' ? '#9aa3b2' : skin, OUT, 1);
  if (o.weapon === 'bow') blob(x, 9 + swing * 2, -3, 3, 3, skin, OUT, 1);
  // head
  head(x, o);
  if (o.crown) crownOn(x, 1, 0, 7.6);
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
const QUAD = {
  wolf: { len: 15, wid: 7.5, col: '#8d8f94', head: 6, snout: 5, ear: 1, tail: 10, tailc: '#6f7177', R: 30 },
  boar: { len: 14, wid: 9, col: '#6b4a32', head: 6.5, snout: 4, tusk: 1, tail: 3, R: 30 },
  bear: { len: 20, wid: 13, col: '#5a3e2a', head: 9, snout: 4, round: 1, tail: 2, R: 40 },
  rat: { len: 9, wid: 4.6, col: '#7a7068', head: 4, snout: 3, round: 1, tail: 14, tailc: '#d89a9a', thin: 1, R: 26 },
  broodmother: { len: 9, wid: 4.8, col: '#5a4640', head: 4, snout: 3, round: 1, tail: 14, tailc: '#c87a7a', thin: 1, R: 26, s: 3.4, eyes: '#ff2a2a' },
};
function quadruped(kind, step, atk) {
  const spec = QUAD[kind], s = spec.s || 1, R = spec.R * s;
  const [c, x] = canvas(R * 2, R * 2); x.translate(R, R); x.scale(s, s);
  legs(x, 4, spec.wid + 3, spec.len * 1.2, step, shade(spec.col, -0.4), kind === 'bear' ? 5 : spec.thin ? 2 : 3);
  if (spec.tail > 3) { x.strokeStyle = spec.tailc; x.lineWidth = spec.thin ? 1.6 : 4; x.lineCap = 'round'; x.beginPath(); x.moveTo(-spec.len + 2, 0); x.quadraticCurveTo(-spec.len - 6, step * 4, -spec.len - spec.tail, step * 3); x.stroke(); }
  blob(x, 0, 0, spec.len, spec.wid, radial(x, 0, 0, spec.len, spec.col));
  if (kind === 'wolf') { x.fillStyle = 'rgba(40,40,45,.35)'; x.beginPath(); x.ellipse(-2, 0, spec.len * 0.7, 2.5, 0, 0, 7); x.fill(); }
  if (kind === 'boar') { x.strokeStyle = '#2a1a10'; x.lineWidth = 1.5; for (let i = -8; i < 6; i += 3) { x.beginPath(); x.moveTo(i, -1.5); x.lineTo(i + 2, 1.5); x.stroke(); } }
  if (kind === 'broodmother') { x.strokeStyle = 'rgba(30,20,20,.5)'; x.lineWidth = 0.6; for (let i = -7; i < 6; i += 2) { x.beginPath(); x.moveTo(i, -3.5); x.lineTo(i + 1, 3.5); x.stroke(); } }
  const hx = spec.len - 1 + (atk ? 4 : 0) / s;
  blob(x, hx, 0, spec.head, spec.head * 0.9, radial(x, hx, 0, spec.head, shade(spec.col, 0.05)), OUT, 1.4 / s);
  blob(x, hx + spec.head, 0, spec.snout, spec.snout * 0.65, shade(spec.col, kind === 'boar' ? 0.25 : -0.1), OUT, 1 / s);
  x.fillStyle = '#111'; x.beginPath(); x.arc(hx + spec.head + spec.snout - 1, 0, spec.thin ? 0.8 : 1.4, 0, 7); x.fill();
  if (spec.ear) { x.fillStyle = shade(spec.col, -0.2); for (const sy of [-1, 1]) { x.beginPath(); x.moveTo(hx - 2, sy * 3); x.lineTo(hx - 6, sy * 7); x.lineTo(hx + 1, sy * 6); x.closePath(); x.fill(); } }
  if (spec.round) for (const sy of [-1, 1]) blob(x, hx - spec.head * 0.45, sy * spec.head * 0.8, spec.head * 0.3, spec.head * 0.3, spec.thin ? '#d8a0a0' : shade(spec.col, -0.15), OUT, 1 / s);
  if (spec.tusk) { x.fillStyle = '#f0ead8'; for (const sy of [-1, 1]) { x.beginPath(); x.moveTo(hx + spec.head + 1, sy * 2.5); x.lineTo(hx + spec.head + 6, sy * 5); x.lineTo(hx + spec.head + 2, sy * 4); x.fill(); } }
  x.fillStyle = spec.eyes || (atk ? '#ff4030' : '#e8c040'); for (const sy of [-1, 1]) { x.beginPath(); x.arc(hx + spec.head * 0.5, sy * spec.head * 0.42, spec.thin ? 0.7 : 1.2, 0, 7); x.fill(); }
  return c;
}
function spider(step, atk, s = 1, body = '#3a2840') {
  const R = 34 * s, [c, x] = canvas(R * 2, R * 2); x.translate(R, R); x.scale(s, s);
  x.strokeStyle = shade(body, -0.5); x.lineWidth = 2.4; x.lineCap = 'round';
  for (let i = 0; i < 4; i++) for (const side of [-1, 1]) {
    const a = (-0.9 + i * 0.6) * side, ph = ((i % 2) * 2 - 1) * step * 0.25 * side, k = side * (1.2 + i * 0.12);
    x.beginPath(); x.moveTo(2, 0);
    const mx = 2 + Math.cos(a + ph + side * 0.9) * 13, my = Math.sin(a + ph + side * 0.9) * 13 * 1.2;
    x.lineTo(mx, my); x.lineTo(mx + Math.cos(a + ph + k * 0.4) * 10 - 4, my + side * 8); x.stroke();
  }
  blob(x, -9, 0, 12, 10, radial(x, -9, 0, 12, body), OUT, 1.4 / s);
  x.fillStyle = '#c03040'; x.beginPath(); x.moveTo(-12, -3); x.lineTo(-6, 0); x.lineTo(-12, 3); x.lineTo(-9, 0); x.fill();
  blob(x, 5 + (atk ? 3 : 0), 0, 6.5, 5.5, radial(x, 5, 0, 6, shade(body, 0.12)), OUT, 1.4 / s);
  x.fillStyle = '#ff3a3a'; for (const [ex, ey] of [[9, -2], [9, 2], [8, -3.5], [8, 3.5]]) { x.beginPath(); x.arc(ex + (atk ? 3 : 0), ey, 1, 0, 7); x.fill(); }
  return c;
}
function crownOn(x, cx, cy, r) {
  x.fillStyle = '#f0c840'; x.strokeStyle = '#8a6a10'; x.lineWidth = 0.8;
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; x.beginPath(); x.moveTo(cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7); x.lineTo(cx + Math.cos(a) * (r + 3), cy + Math.sin(a) * (r + 3)); x.lineTo(cx + Math.cos(a + 0.5) * r * 0.7, cy + Math.sin(a + 0.5) * r * 0.7); x.fill(); x.stroke(); }
  x.beginPath(); x.arc(cx, cy, r * 0.72, 0, 7); x.strokeStyle = '#f0c840'; x.lineWidth = 2; x.stroke();
}
function wraith(step, atk, s = 1, crown = false) {
  const R = 34 * s, [c, x] = canvas(R * 2, R * 2); x.translate(R, R); x.scale(s, s);
  const g = x.createLinearGradient(-26, 0, 10, 0); g.addColorStop(0, 'rgba(60,70,130,0)'); g.addColorStop(0.5, crown ? 'rgba(60,30,90,.8)' : 'rgba(70,80,150,.75)'); g.addColorStop(1, crown ? 'rgba(110,60,160,.95)' : 'rgba(110,120,200,.95)');
  x.fillStyle = g; x.beginPath(); x.moveTo(8, -12);
  for (let i = 0; i <= 6; i++) { const t = i / 6; x.lineTo(-14 - 10 * Math.sin(t * Math.PI) - (i % 2) * 6 + step * 2, -12 + 24 * t); }
  x.lineTo(8, 12); x.quadraticCurveTo(14, 0, 8, -12); x.fill();
  if (atk) { x.strokeStyle = '#b0c8ff'; x.lineWidth = 2; for (const sy of [-1, 1]) { x.beginPath(); x.moveTo(6, sy * 9); x.lineTo(18, sy * 6); x.stroke(); } }
  blob(x, 3, 0, 7.5, 7.5, radial(x, 3, 0, 7.5, crown ? '#3a2050' : '#3a4070'), 'rgba(160,180,255,.6)', 1.2);
  x.fillStyle = crown ? '#ff60ff' : '#8ff0ff'; x.shadowColor = x.fillStyle; x.shadowBlur = 6; x.fillRect(6, -3.2, 2.2, 1.8); x.fillRect(6, 1.4, 2.2, 1.8); x.shadowBlur = 0;
  if (crown) crownOn(x, 3, 0, 7);
  return c;
}
function bat(step, atk) {
  const R = 26, [c, x] = canvas(R * 2, R * 2); x.translate(R, R);
  const flap = step === 0 ? 0.6 : step > 0 ? 1 : 0.25;
  x.fillStyle = '#3a2a3a'; x.strokeStyle = OUT; x.lineWidth = 1;
  for (const sy of [-1, 1]) {
    x.beginPath(); x.moveTo(2, sy * 3);
    x.quadraticCurveTo(-2, sy * 14 * flap + sy * 4, -8, sy * (6 + 14 * flap));
    x.lineTo(-4, sy * (4 + 8 * flap)); x.lineTo(-9, sy * (3 + 6 * flap)); x.lineTo(-4, sy * 3); x.closePath(); x.fill(); x.stroke();
  }
  blob(x, 0, 0, 6, 4.5, radial(x, 0, 0, 6, '#5a4050'));
  blob(x, 6 + (atk ? 2 : 0), 0, 3.5, 3.2, '#4a3444', OUT, 1);
  x.fillStyle = '#ff5050'; x.fillRect(7.5, -1.6, 1.2, 1.1); x.fillRect(7.5, 0.6, 1.2, 1.1);
  for (const sy of [-1, 1]) { x.fillStyle = '#4a3444'; x.beginPath(); x.moveTo(4, sy * 2); x.lineTo(3, sy * 5.5); x.lineTo(6, sy * 3); x.fill(); }
  return c;
}
function scorpion(step, atk) {
  const R = 32, [c, x] = canvas(R * 2, R * 2); x.translate(R, R);
  const col = '#b08440';
  legs(x, 6, 10, 14, step, shade(col, -0.4), 2);
  x.strokeStyle = col; x.lineWidth = 4; x.lineCap = 'round'; x.beginPath(); x.moveTo(-8, 0); x.quadraticCurveTo(-22, step * 3, -14, atk ? 2 : -6); x.stroke();
  x.fillStyle = '#5a2a10'; x.beginPath(); x.moveTo(-14, atk ? 2 : -6); x.lineTo(atk ? -4 : -9, atk ? 3 : -9); x.lineTo(-12, atk ? 5 : -3); x.fill();
  for (let i = 0; i < 4; i++) blob(x, -6 + i * 4, 0, 4, 5.5 - i * 0.3, radial(x, -6 + i * 4, 0, 5, col), OUT, 1);
  for (const sy of [-1, 1]) {
    x.strokeStyle = shade(col, -0.2); x.lineWidth = 2.6; x.beginPath(); x.moveTo(8, sy * 3); x.lineTo(13 + (atk ? 3 : 0), sy * 7); x.stroke();
    blob(x, 16 + (atk ? 3 : 0), sy * 7, 3.8, 2.6, shade(col, 0.1), OUT, 1);
  }
  x.fillStyle = '#111'; x.fillRect(10, -1.5, 1.2, 1.2); x.fillRect(10, 0.4, 1.2, 1.2);
  return c;
}
function imp(step, atk) {
  const R = 26, [c, x] = canvas(R * 2, R * 2); x.translate(R, R);
  for (const sy of [-1, 1]) { x.fillStyle = '#7a1a10'; x.beginPath(); x.moveTo(-1, sy * 3); x.lineTo(-10, sy * (12 + step * 2)); x.lineTo(-4, sy * 6); x.lineTo(-8, sy * (8 + step)); x.closePath(); x.fill(); }
  blob(x, 0, 0, 5.5, 6.5, radial(x, 0, 0, 6, '#d8402a'));
  blob(x, 4, 0, 4.5, 4.5, radial(x, 4, 0, 4.5, '#e85a3a'), OUT, 1);
  x.fillStyle = '#2a1a10'; for (const sy of [-1, 1]) { x.beginPath(); x.moveTo(3, sy * 3); x.lineTo(-1, sy * 7); x.lineTo(5, sy * 4); x.fill(); }
  x.fillStyle = atk ? '#fff' : '#ffd040'; x.fillRect(6.5, -1.8, 1.4, 1.2); x.fillRect(6.5, 0.6, 1.4, 1.2);
  if (atk) { x.fillStyle = 'rgba(255,140,40,.6)'; x.beginPath(); x.arc(0, 0, 11, 0, 7); x.fill(); }
  return c;
}
function golem(step, atk, s = 1, lava = false) {
  const R = 40 * s, [c, x] = canvas(R * 2, R * 2); x.translate(R, R); x.scale(s, s);
  const col = lava ? '#4a3a36' : '#7a7670';
  for (const sy of [-1, 1]) blob(x, 2 + step * sy * 4, sy * 9, 7, 5, shade(col, -0.2), OUT, 1.4 / s);
  for (const sy of [-1, 1]) blob(x, 8 + (atk ? 6 : 0), sy * 17, 6.5, 6, radial(x, 8, sy * 17, 6, shade(col, 0.1)), OUT, 1.4 / s);
  x.fillStyle = radial(x, 0, 0, 18, col); x.beginPath(); x.moveTo(-12, -16); x.lineTo(10, -15); x.lineTo(14, 0); x.lineTo(10, 15); x.lineTo(-12, 16); x.lineTo(-16, 0); x.closePath(); x.fill(); x.strokeStyle = OUT; x.lineWidth = 1.6 / s; x.stroke();
  x.strokeStyle = lava ? '#ff7a20' : 'rgba(30,30,30,.45)'; x.lineWidth = lava ? 1.6 : 1;
  if (lava) { x.shadowColor = '#ff6a10'; x.shadowBlur = 5; }
  for (const [a, b, c2, d] of [[-10, -8, -2, -2], [-2, -2, 6, -9], [-4, 4, 4, 10], [-12, 6, -5, 2]]) { x.beginPath(); x.moveTo(a, b); x.lineTo(c2, d); x.stroke(); }
  x.shadowBlur = 0;
  if (!lava) { x.fillStyle = 'rgba(90,140,60,.6)'; x.beginPath(); x.ellipse(-6, -8, 5, 3, 0.4, 0, 7); x.fill(); }
  blob(x, 9, 0, 6, 6.5, radial(x, 9, 0, 6, shade(col, 0.15)), OUT, 1.2 / s);
  x.fillStyle = lava ? '#ffb030' : '#70e0ff'; x.shadowColor = x.fillStyle; x.shadowBlur = 5; x.fillRect(12, -3, 2, 1.8); x.fillRect(12, 1.2, 2, 1.8); x.shadowBlur = 0;
  if (lava) crownOn(x, 9, 0, 6);
  return c;
}
function elemental(kind, step, atk) {
  const R = 30, [c, x] = canvas(R * 2, R * 2); x.translate(R, R);
  if (kind === 'fire_elemental') {
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + step * 0.3, d = 12 + (i % 2) * 5; x.fillStyle = i % 2 ? 'rgba(255,120,30,.75)' : 'rgba(255,200,60,.8)'; x.beginPath(); x.moveTo(Math.cos(a - 0.35) * 8, Math.sin(a - 0.35) * 8); x.lineTo(Math.cos(a) * d, Math.sin(a) * d); x.lineTo(Math.cos(a + 0.35) * 8, Math.sin(a + 0.35) * 8); x.fill(); }
    const g = x.createRadialGradient(2, 0, 1, 0, 0, 13); g.addColorStop(0, '#fff8d0'); g.addColorStop(0.45, '#ffb030'); g.addColorStop(1, '#c03010');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, 11 + (atk ? 2 : 0), 0, 7); x.fill();
    x.fillStyle = '#4a1000'; x.fillRect(5, -3, 2, 2); x.fillRect(5, 1, 2, 2);
  } else {
    const g = x.createRadialGradient(0, 0, 1, 0, 0, 16); g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, '#b8ecff'); g.addColorStop(1, 'rgba(90,170,230,0)');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, 16, 0, 7); x.fill();
    x.strokeStyle = 'rgba(220,250,255,.9)'; x.lineWidth = 1.4;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + step * 0.2; x.beginPath(); x.moveTo(Math.cos(a) * 5, Math.sin(a) * 5); x.lineTo(Math.cos(a) * (13 + (atk ? 4 : 0)), Math.sin(a) * (13 + (atk ? 4 : 0))); x.stroke(); }
    x.fillStyle = '#2a5a8a'; x.fillRect(4, -2.5, 1.8, 1.8); x.fillRect(4, 0.8, 1.8, 1.8);
  }
  return c;
}

const SKINS = ['#f1c9a5', '#e0ac7e', '#c68b5e', '#8d5a3b', '#f6d7bd'];
const HAIRS = ['#3a2416', '#6b4423', '#c49a4a', '#1d1a18', '#8a3b1e', '#d8d0c0'];
const nameHash = (s) => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

// The sprite each weapon is drawn with in a player's hands.
// The sprite each tool is drawn with in someone's hands.
export const TOOL_SPRITE = {
  spear: 'spear', shortsword: 'sword', sabre: 'sword', rapier: 'rapier', greatsword: 'greatsword', battleaxe: 'axe', flail: 'flail',
  pike: 'pike', partisan: 'partisan', lance: 'lance', glaive: 'glaive', halberd: 'halberd', pollaxe: 'pollaxe', ranseur: 'ranseur', bardiche: 'bardiche',
  quarterstaff: 'staffplain', sceptre: 'mace', bollock: 'dagger', rondel: 'dagger', blackjack: 'club',
  sling: 'sling', flatbow: 'bow', longbow: 'bow', crossbow: 'crossbow', repeater: 'crossbow', pilum: 'pilum', plumbata: 'dagger',
};
export function playerLook(name, rank, color, wp, sh) {
  const h = nameHash(name);
  const armor = rank >= 4 ? 'plate' : rank >= 2 ? 'chain' : rank === 1 ? 'leather' : 'cloth';
  const head = rank >= 12 ? 'crown' : rank === 11 ? 'circlet' : rank >= 7 ? 'plume' : rank >= 4 ? 'helm' : 'hair';
  return {
    skin: SKINS[h % SKINS.length], hair: HAIRS[(h >> 4) % HAIRS.length], tunic: color || '#9a8a68', armor, head, plume: color || '#c0392b',
    weapon: TOOL_SPRITE[wp] || 'spear', shield: sh ? (color || '#7a6a50') : null, shieldKind: sh || null, raised: !!sh, cape: rank >= 7 ? (color || '#7a2a2a') : null,
  };
}
// Bandit-held people wear their own colours; people of a faction wear the faction's.
const wild = (c, own) => (c === WILD ? own : c);
export const WILD = '#888';
const MOB_LOOK = {
  bandit: () => ({ skin: SKINS[2], tunic: '#5a4a3a', armor: 'leather', head: 'bandana', hair: '#a02828', weapon: 'axe' }),
  bandit_archer: () => ({ skin: SKINS[1], tunic: '#4a5a3a', armor: 'leather', head: 'bandana', hair: '#2a6a3a', weapon: 'bow' }),
  skeleton: () => ({ skin: '#e6e0cc', tunic: '#cfc8b0', armor: 'ribs', head: 'skull', weapon: 'bow' }),
  risen: () => ({ skin: '#d8d0b8', tunic: '#bfb8a0', armor: 'ribs', head: 'skull', weapon: 'sword' }),
  cultist: () => ({ skin: SKINS[4], tunic: '#4a2460', robe: 1, head: 'hood', hood: '#3a1a4a', eyes: '#ff5050', weapon: 'darkstaff' }),
  necromancer: () => ({ skin: '#c8c0b0', tunic: '#1e1a24', robe: 1, head: 'hood', hood: '#141018', eyes: '#70ff90', weapon: 'darkstaff', cape: '#3a1a4a' }),
  shaman: () => ({ skin: '#7aa05a', tunic: '#5a6a2a', robe: 1, head: 'hood', hood: '#3a5a2a', eyes: '#f0e070', weapon: 'staff' }),
  lizardman: () => ({ skin: '#5a9a5a', tunic: '#3a6a4a', armor: 'leather', head: 'bald', weapon: 'spear' }),
  ogre: () => ({ skin: '#7d9a4a', tunic: '#6a4a2a', armor: 'cloth', head: 'bald', weapon: 'club', scale: 1.45 }),
  troll: () => ({ skin: '#5f8a7a', tunic: '#3a4a3a', armor: 'cloth', head: 'bald', weapon: 'club', scale: 1.45 }),
  yeti: () => ({ skin: '#c8d4dc', tunic: '#eef2f6', armor: 'cloth', head: 'bald', weapon: null, scale: 1.55 }),
  old_rime: () => ({ skin: '#a8c8dc', tunic: '#e0f0ff', armor: 'cloth', head: 'bald', weapon: 'club', scale: 2.6, crown: 1 }),
  bone_king: () => ({ skin: '#ece4cc', tunic: '#d8d0b8', armor: 'ribs', head: 'skull', weapon: 'sword', cape: '#5a2a7a', scale: 2.2, crown: 1 }),
  guard: (c) => ({ skin: SKINS[1], tunic: c, armor: 'chain', head: 'helm', weapon: 'spear' }),
  farmer: (c) => ({ skin: SKINS[2], tunic: wild(c, '#8a7a4a'), armor: 'cloth', head: 'hair', hair: HAIRS[1], weapon: 'sword' }),
  vagabond: (c) => ({ skin: SKINS[1], tunic: wild(c, '#6a5a4a'), armor: 'cloth', head: 'hood', hood: '#4a3a2a', weapon: 'spear' }),
  ranger: (c) => ({ skin: SKINS[0], tunic: wild(c, '#4a6a3a'), armor: 'leather', head: 'hood', hood: '#3a5a2a', weapon: 'sling' }),
  reiver: (c) => ({ skin: SKINS[1], tunic: wild(c, '#7a4a3a'), armor: 'leather', head: 'bandana', hair: '#6a2a1a', weapon: 'sword', shield: '#7a6a50', shieldKind: 'buckler' }),
  alchemist: (c) => ({ skin: SKINS[4], tunic: wild(c, '#4a3a6a'), robe: 1, head: 'hood', hood: '#2a1a4a', eyes: '#ffd070', weapon: 'dagger' }),
  healer: (c) => ({ skin: SKINS[0], tunic: wild(c, '#d8d8c8'), robe: 1, head: 'hood', hood: '#e8e8d8', eyes: '#70c070', weapon: 'dagger' }),
  brigand: (c) => ({ skin: SKINS[3], tunic: wild(c, '#5a4a3a'), armor: 'chain', head: 'bandana', hair: '#2a2a2a', weapon: 'axe', shield: '#6a5030', shieldKind: 'targe' }),
  pillager: (c) => ({ skin: SKINS[2], tunic: wild(c, '#8a2a2a'), armor: 'leather', head: 'bandana', hair: '#a02828', weapon: 'glaive' }),
  forest_steward: (c) => ({ skin: SKINS[1], tunic: wild(c, '#2a5a2a'), armor: 'leather', head: 'hood', hood: '#1a4a1a', weapon: 'bow' }),
  cearl: (c) => ({ skin: SKINS[0], tunic: wild(c, '#5a5a6a'), armor: 'plate', head: 'helm', weapon: 'pollaxe', scale: 1.08 }),
  honourguard: (c) => ({ skin: SKINS[0], tunic: wild(c, '#6a1a1a'), armor: 'plate', head: 'greathelm', weapon: 'greatsword', shield: wild(c, '#8a2a2a'), shieldKind: 'kite', scale: 1.12 }),
  dweller: () => ({ skin: '#b8b0a0', tunic: '#2a2430', armor: 'chain', head: 'hood', hood: '#1a1420', eyes: '#c0ff80', weapon: 'flail', scale: 1.08 }),
  hire_archer: (c) => ({ skin: SKINS[3], tunic: c, armor: 'leather', head: 'hood', hood: shade(c, -0.3), weapon: 'sling' }),
  hire_merc: (c) => ({ skin: SKINS[2], tunic: c, armor: 'chain', head: 'helm', weapon: 'sword' }),
  hire_guard: (c) => ({ skin: SKINS[1], tunic: c, armor: 'plate', head: 'helm', weapon: 'spear', shield: c, shieldKind: 'buckler' }),
  hire_healer: (c) => ({ skin: SKINS[0], tunic: c, robe: 1, head: 'hood', hood: shade(c, -0.3), eyes: '#70c070', weapon: 'dagger' }),
  archer: (c) => ({ skin: SKINS[0], tunic: c, armor: 'leather', head: 'hood', hood: shade(c, -0.3), weapon: 'bow' }),
  castle_mage: (c) => ({ skin: SKINS[4], tunic: c, robe: 1, head: 'hood', hood: shade(c, -0.35), eyes: '#ffd070', weapon: 'staff' }),
  knight_guard: (c) => ({ skin: SKINS[0], tunic: c, armor: 'plate', head: 'greathelm', weapon: 'spear', shield: c, scale: 1.12 }),
  captain: (c) => ({ skin: SKINS[2], tunic: wild(c, '#5a4a3a'), armor: 'plate', head: 'plume', plume: wild(c, '#a02020'), weapon: 'halberd', shield: wild(c, '#7a3a2a'), shieldKind: 'scutum', cape: wild(c, '#5a2a2a'), scale: 1.2 }),
  footman: (c) => ({ skin: SKINS[1], tunic: c, armor: 'chain', head: 'helm', weapon: 'sword', shield: c }),
  summoned_archer: (c) => ({ skin: SKINS[3], tunic: c, armor: 'leather', head: 'hood', hood: shade(c, -0.3), weapon: 'bow' }),
  knight: (c) => ({ skin: SKINS[0], tunic: c, armor: 'plate', head: 'greathelm', weapon: 'sword', shield: c, cape: c, scale: 1.1 }),
};
// Returns a cached canvas for a creature (sprites face +x; the renderer rotates them).
export function creature(kind, color, step, atk, look) {
  const st = step > 0.3 ? 1 : step < -0.3 ? -1 : 0, a = atk ? 1 : 0;
  if (kind === 'player') {
    const key = `p|${look.skin}|${look.hair}|${look.tunic}|${look.armor}|${look.head}|${look.weapon}|${look.shield}|${look.shieldKind}|${look.cape}|${st}|${a}`;
    return memo(key, () => humanoid(look, st, a));
  }
  const key = `${kind}|${color}|${st}|${a}|${look ? look.weapon + '|' + (look.shieldKind || '') : ''}`;
  return memo(key, () => {
    if (QUAD[kind]) return quadruped(kind, st, a);
    if (kind === 'spider') return spider(st, a);
    if (kind === 'silkweaver') return spider(st, a, 2.4, '#d8d0e4');
    if (kind === 'wraith') return wraith(st, a);
    if (kind === 'hollow_prince') return wraith(st, a, 2.1, true);
    if (kind === 'bat') return bat(st, a);
    if (kind === 'scorpion') return scorpion(st, a);
    if (kind === 'imp') return imp(st, a);
    if (kind === 'golem') return golem(st, a);
    if (kind === 'forgelord') return golem(st, a, 1.75, true);
    if (kind === 'fire_elemental' || kind === 'frost_wisp') return elemental(kind, st, a);
    const lf = MOB_LOOK[kind] || MOB_LOOK.guard, o = lf(color || WILD);
    if (look && look.weapon) o.weapon = look.weapon === 'none' ? null : look.weapon;
    if (look && look.shieldKind) { o.shield = o.shield || o.tunic; o.shieldKind = look.shieldKind; o.raised = true; }
    return humanoid(o, st, a);
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
// Three looks: forts are timber palisades with log watchtowers round a stone keep; castles are stone
// with round towers and conical roofs; citadels are dark fortresses with square towers behind a moat.
// The base layer (ground, paths, clutter) is drawn under people, the top layer (walls, towers, roofs) over.
// Castle canvases are big, so they are drawn at 1x and only the dozen most recently seen are kept.
const CPAD = 70;
export const castleSize = (type) => (CASTLE_TYPES[type].outer + CPAD) * 2;
const castleCache = new Map();
function castleMemo(key, fn) {
  let v = castleCache.get(key);
  if (v) { castleCache.delete(key); castleCache.set(key, v); return v; }
  v = fn(); castleCache.set(key, v);
  if (castleCache.size > 12) castleCache.delete(castleCache.keys().next().value);
  return v;
}
function bigCanvas(w) { const c = document.createElement('canvas'); c.width = c.height = Math.ceil(w); return [c, c.getContext('2d')]; }
function stoneTexture(x, x0, y0, w, h, base, R, bw = 14, bh = 8) {
  x.fillStyle = shade(base, -0.3); x.fillRect(x0, y0, w, h);
  for (let yy = y0, row = 0; yy < y0 + h; yy += bh, row++) for (let xx = x0 - (row % 2) * (bw / 2); xx < x0 + w; xx += bw) {
    const sx = Math.max(x0, xx), sw = Math.min(xx + bw, x0 + w) - sx, sh = Math.min(bh, y0 + h - yy);
    if (sw <= 1 || sh <= 1) continue;
    x.fillStyle = shade(base, (R() - 0.5) * 0.2); x.fillRect(sx + 0.7, yy + 0.7, sw - 1.4, sh - 1.4);
  }
}
function flagstones(x, x0, y0, w, h, base, R, sz = 18) {
  x.fillStyle = shade(base, -0.18); x.fillRect(x0, y0, w, h);
  for (let yy = y0, row = 0; yy < y0 + h; yy += sz, row++) for (let xx = x0 - (row % 2) * (sz / 2); xx < x0 + w; xx += sz) {
    const sx = Math.max(x0, xx), sw = Math.min(xx + sz, x0 + w) - sx, sh = Math.min(sz, y0 + h - yy);
    if (sw <= 2 || sh <= 2) continue;
    x.fillStyle = shade(base, (R() - 0.5) * 0.2); x.fillRect(sx + 1, yy + 1, sw - 2, sh - 2);
  }
}
// Rough ground: a base colour with blotches of a second and pebbles.
function ground(x, x0, y0, w, h, base, spot, R, n) {
  x.fillStyle = base; x.fillRect(x0, y0, w, h);
  for (let i = 0; i < n; i++) { x.fillStyle = spot; x.globalAlpha = 0.18 + R() * 0.2; x.beginPath(); x.ellipse(x0 + R() * w, y0 + R() * h, 6 + R() * 16, 4 + R() * 10, R() * 3, 0, 7); x.fill(); }
  x.globalAlpha = 1;
  for (let i = 0; i < n; i++) { x.fillStyle = 'rgba(40,30,20,.25)'; x.beginPath(); x.arc(x0 + R() * w, y0 + R() * h, 0.8 + R() * 1.6, 0, 7); x.fill(); }
}
const STYLE = {
  timber: { ground: '#8a7a52', spot: '#6f8a44', yard: '#9a8662', stone: '#8e8a82', wall: '#6e4c2c', log: '#8a5e36', walk: '#9a7650' },
  stone: { ground: '#7c8a50', spot: '#8a7656', yard: '#a09888', stone: '#9a958c', wall: '#8e8a82', walk: '#7a766e' },
  dark: { ground: '#5e5a54', spot: '#4e4a44', yard: '#77737a', stone: '#6c6872', wall: '#66626c', walk: '#56525c' },
};
const wallSide = (x0, y0, w, h) => (w > h ? (y0 + h / 2 < 0 ? 'N' : 'S') : (x0 + w / 2 < 0 ? 'W' : 'E'));
// A gable roof seen from above: two slopes meeting at a ridge along the long side.
function gableRoof(x, x0, y0, w, h, col, R) {
  const horiz = w >= h, light = shade(col, 0.16), dark = shade(col, -0.22);
  x.fillStyle = 'rgba(0,0,0,.32)'; x.fillRect(x0 + 6, y0 + 8, w, h);
  if (horiz) {
    x.fillStyle = light; x.fillRect(x0, y0, w, h / 2); x.fillStyle = dark; x.fillRect(x0, y0 + h / 2, w, h / 2);
    x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 1; for (let yy = y0 + 4; yy < y0 + h; yy += 5) { x.beginPath(); x.moveTo(x0 + 1, yy); x.lineTo(x0 + w - 1, yy); x.stroke(); }
    for (let i = 0; i < w * h / 300; i++) { x.fillStyle = `rgba(0,0,0,${0.06 + R() * 0.08})`; x.fillRect(x0 + R() * (w - 8), y0 + R() * (h - 4), 8, 4); }
    x.strokeStyle = shade(col, 0.45); x.lineWidth = 3; x.beginPath(); x.moveTo(x0 + 2, y0 + h / 2); x.lineTo(x0 + w - 2, y0 + h / 2); x.stroke();
  } else {
    x.fillStyle = light; x.fillRect(x0, y0, w / 2, h); x.fillStyle = dark; x.fillRect(x0 + w / 2, y0, w / 2, h);
    x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 1; for (let xx = x0 + 4; xx < x0 + w; xx += 5) { x.beginPath(); x.moveTo(xx, y0 + 1); x.lineTo(xx, y0 + h - 1); x.stroke(); }
    for (let i = 0; i < w * h / 300; i++) { x.fillStyle = `rgba(0,0,0,${0.06 + R() * 0.08})`; x.fillRect(x0 + R() * (w - 4), y0 + R() * (h - 8), 4, 8); }
    x.strokeStyle = shade(col, 0.45); x.lineWidth = 3; x.beginPath(); x.moveTo(x0 + w / 2, y0 + 2); x.lineTo(x0 + w / 2, y0 + h - 2); x.stroke();
  }
  x.strokeStyle = OUT; x.lineWidth = 1.5; x.strokeRect(x0, y0, w, h);
}
// A hip roof: four slopes up to a short ridge (lit from the top left).
function hipRoof(x, x0, y0, w, h, col) {
  const cx = x0 + w / 2, cy = y0 + h / 2, horiz = w >= h, r = Math.min(w, h) / 2;
  const a = horiz ? [x0 + r, cy] : [cx, y0 + r], b = horiz ? [x0 + w - r, cy] : [cx, y0 + h - r];
  const TL = [x0, y0], TR = [x0 + w, y0], BL = [x0, y0 + h], BR = [x0 + w, y0 + h];
  const face = (pts, c) => { x.fillStyle = c; x.beginPath(); x.moveTo(...pts[0]); for (const p of pts.slice(1)) x.lineTo(...p); x.closePath(); x.fill(); };
  if (horiz) { face([TL, TR, b, a], shade(col, 0.2)); face([BL, BR, b, a], shade(col, -0.28)); face([TL, BL, a], shade(col, 0.04)); face([TR, BR, b], shade(col, -0.14)); }
  else { face([TL, TR, a], shade(col, 0.2)); face([BL, BR, b], shade(col, -0.28)); face([TL, BL, b, a], shade(col, 0.04)); face([TR, BR, b, a], shade(col, -0.14)); }
  x.strokeStyle = 'rgba(0,0,0,.3)'; x.lineWidth = 1;
  for (const [p, q] of [[TL, a], [BL, horiz ? a : b], [TR, horiz ? b : a], [BR, b]]) { x.beginPath(); x.moveTo(...p); x.lineTo(...q); x.stroke(); }
  x.strokeStyle = shade(col, 0.45); x.lineWidth = 2.5; x.beginPath(); x.moveTo(...a); x.lineTo(...b); x.stroke();
  x.strokeStyle = OUT; x.lineWidth = 1.5; x.strokeRect(x0, y0, w, h);
}
function conicalRoof(x, cx, cy, r, col) {
  const g = x.createRadialGradient(cx - r * 0.35, cy - r * 0.35, 1, cx, cy, r);
  g.addColorStop(0, shade(col, 0.4)); g.addColorStop(0.55, col); g.addColorStop(1, shade(col, -0.45));
  x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
  x.strokeStyle = 'rgba(0,0,0,.28)'; x.lineWidth = 1; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); x.stroke(); }
  x.strokeStyle = OUT; x.lineWidth = 1.4; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke();
  x.fillStyle = '#e0c060'; x.beginPath(); x.arc(cx, cy, 2.4, 0, 7); x.fill();
}
// A small flag on a pole, flying east.
function pennant(x, px, py, col, len = 22) {
  x.strokeStyle = '#3a2a1a'; x.lineWidth = 2; x.beginPath(); x.moveTo(px, py); x.lineTo(px, py - 4); x.stroke();
  const g = x.createLinearGradient(px, 0, px + len, 0); g.addColorStop(0, shade(col, 0.15)); g.addColorStop(1, shade(col, -0.3));
  x.fillStyle = g; x.beginPath(); x.moveTo(px, py - 9); x.quadraticCurveTo(px + len * 0.5, py - 12, px + len, py - 5); x.quadraticCurveTo(px + len * 0.5, py - 2, px, py - 1); x.closePath(); x.fill();
  x.strokeStyle = OUT; x.lineWidth = 1; x.stroke();
  x.fillStyle = '#d8b040'; x.beginPath(); x.arc(px, py - 1, 2, 0, 7); x.fill();
}
// A banner hanging down a wall face, with a charge (a simple device) in gold.
function hangingBanner(x, cx, top, col, w = 16, h = 30) {
  x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(cx - w / 2 + 3, top + 3, w, h);
  x.fillStyle = shade(col, -0.05); x.beginPath(); x.moveTo(cx - w / 2, top); x.lineTo(cx + w / 2, top); x.lineTo(cx + w / 2, top + h); x.lineTo(cx, top + h - 6); x.lineTo(cx - w / 2, top + h); x.closePath(); x.fill();
  x.strokeStyle = OUT; x.lineWidth = 1; x.stroke();
  x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(cx - w / 2, top, w / 3, h - 4);
  x.fillStyle = '#e8c860'; x.beginPath(); x.moveTo(cx, top + 6); x.lineTo(cx + 4.5, top + 12); x.lineTo(cx, top + 18); x.lineTo(cx - 4.5, top + 12); x.closePath(); x.fill();
  x.fillStyle = '#5a3a1a'; x.fillRect(cx - w / 2 - 2, top - 2, w + 4, 3);
}
// Courtyard clutter, kept off the paths and away from buildings.
function clutter(x, kind, px, py, R) {
  if (kind === 'barrels') for (const [dx, dy] of [[0, 0], [11, 3], [4, 11]]) { blob(x, px + dx, py + dy, 6.5, 6.5, radial(x, px + dx, py + dy, 6.5, '#8a5a2a')); x.strokeStyle = '#3a2410'; x.lineWidth = 1; x.beginPath(); x.arc(px + dx, py + dy, 4, 0, 7); x.stroke(); }
  else if (kind === 'crates') for (const [dx, dy, s] of [[0, 0, 14], [15, 2, 11], [3, 15, 12]]) { x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(px + dx + 2, py + dy + 3, s, s); x.fillStyle = '#a07848'; x.fillRect(px + dx, py + dy, s, s); x.strokeStyle = '#4a3016'; x.lineWidth = 1.2; x.strokeRect(px + dx, py + dy, s, s); x.beginPath(); x.moveTo(px + dx, py + dy); x.lineTo(px + dx + s, py + dy + s); x.stroke(); }
  else if (kind === 'hay') { blob(x, px, py, 15, 10, radial(x, px, py, 15, '#d8c070')); x.strokeStyle = 'rgba(120,90,30,.5)'; x.lineWidth = 1; for (let i = -10; i <= 10; i += 4) { x.beginPath(); x.moveTo(px + i, py - 7); x.lineTo(px + i + 2, py + 7); x.stroke(); } }
  else if (kind === 'dummy') { blob(x, px, py + 2, 8, 4, 'rgba(0,0,0,.25)', null); x.strokeStyle = '#6a4a2a'; x.lineWidth = 3; x.beginPath(); x.moveTo(px - 10, py); x.lineTo(px + 10, py); x.stroke(); blob(x, px, py, 6, 6, radial(x, px, py, 6, '#c8b080')); x.fillStyle = '#8a2a2a'; x.fillRect(px - 1.5, py - 1.5, 3, 3); }
  else if (kind === 'target') { blob(x, px, py, 11, 11, '#e8e0c8'); for (const [r, c] of [[8, '#c03030'], [5, '#e8e0c8'], [2.5, '#c03030']]) blob(x, px, py, r, r, c, null); }
  else if (kind === 'rack') { x.fillStyle = '#5a3a1a'; x.fillRect(px - 14, py - 3, 28, 6); x.strokeStyle = '#c8ccd0'; x.lineWidth = 1.5; for (let j = -10; j <= 10; j += 5) { x.beginPath(); x.moveTo(px + j, py - 3); x.lineTo(px + j + 3, py - 14); x.stroke(); } }
  else if (kind === 'cart') { x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(px - 12, py - 5, 30, 18); x.fillStyle = '#8a6038'; x.fillRect(px - 14, py - 8, 26, 16); x.strokeStyle = OUT; x.lineWidth = 1; x.strokeRect(px - 14, py - 8, 26, 16); x.fillStyle = '#3a2a1a'; for (const wy of [-10, 8]) x.fillRect(px - 8, py + wy, 12, 3); x.strokeStyle = '#6a4a2a'; x.lineWidth = 2; x.beginPath(); x.moveTo(px + 12, py - 4); x.lineTo(px + 26, py - 4); x.moveTo(px + 12, py + 4); x.lineTo(px + 26, py + 4); x.stroke(); blob(x, px - 2, py, 8, 5, '#d8c070', null); }
  else if (kind === 'fire') { for (let i = 0; i < 6; i++) { const a = i * 1.05; blob(x, px + Math.cos(a) * 8, py + Math.sin(a) * 8, 3.5, 3.5, '#7a766e'); } blob(x, px, py, 5, 5, '#3a2a1a', null); const g = x.createRadialGradient(px, py, 1, px, py, 7); g.addColorStop(0, 'rgba(255,220,120,.9)'); g.addColorStop(1, 'rgba(255,90,20,0)'); x.fillStyle = g; x.beginPath(); x.arc(px, py, 7, 0, 7); x.fill(); }
  else if (kind === 'well') { blob(x, px, py, 13, 13, radial(x, px, py, 13, '#8a8478'), OUT, 1.5); blob(x, px, py, 8, 8, '#2a5a7a', null); x.fillStyle = '#6a4a2a'; x.fillRect(px - 13, py - 1.5, 26, 3); }
  else if (kind === 'tent') { x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.moveTo(px + 4, py - 11); x.lineTo(px + 22, py + 6); x.lineTo(px + 4, py + 22); x.lineTo(px - 14, py + 6); x.fill(); const c = ['#d8d0b8', '#c8b898'][Math.floor(R() * 2)]; x.fillStyle = shade(c, 0.1); x.beginPath(); x.moveTo(px, py - 16); x.lineTo(px + 16, py); x.lineTo(px, py); x.closePath(); x.fill(); x.fillStyle = shade(c, -0.15); x.beginPath(); x.moveTo(px + 16, py); x.lineTo(px, py + 16); x.lineTo(px, py); x.closePath(); x.fill(); x.fillStyle = c; x.beginPath(); x.moveTo(px, py + 16); x.lineTo(px - 16, py); x.lineTo(px, py); x.closePath(); x.fill(); x.fillStyle = shade(c, 0.2); x.beginPath(); x.moveTo(px - 16, py); x.lineTo(px, py - 16); x.lineTo(px, py); x.closePath(); x.fill(); x.strokeStyle = OUT; x.lineWidth = 1; x.beginPath(); x.moveTo(px, py - 16); x.lineTo(px + 16, py); x.lineTo(px, py + 16); x.lineTo(px - 16, py); x.closePath(); x.stroke(); }
  else if (kind === 'garden') { x.fillStyle = '#5a4026'; x.fillRect(px - 20, py - 14, 40, 28); x.strokeStyle = '#6a4a2a'; x.lineWidth = 1.5; x.strokeRect(px - 20, py - 14, 40, 28); for (let j = -10; j <= 10; j += 6.5) for (let i = -16; i <= 16; i += 6) blob(x, px + i, py + j, 2.6, 2.6, ['#5a9a3a', '#7aaa3a', '#a0b040'][Math.floor(R() * 3)], null); }
}
// Ground layer: courtyard, cobbled paths from each gate, clutter, open gate doors and the moat.
export function castleBase(c) {
  return castleMemo('cbase|' + c.id, () => {
    const L = CASTLE_TYPES[c.type], st = STYLE[L.style], S = castleSize(c.type), R = rng(c.id * 101 + 7), [cv, x] = bigCanvas(S);
    x.translate(S / 2, S / 2);
    const O = L.outer, rings = L.rings;
    x.fillStyle = 'rgba(100,84,56,.3)'; x.beginPath(); x.ellipse(0, 0, O + 50, O + 50, 0, 0, 7); x.fill();
    if (L.moat.length) {
      for (const [mx, my, mw, mh] of L.moat) {
        x.fillStyle = '#4a4238'; x.fillRect(mx - 6, my - 6, mw + 12, mh + 12);
        const g = x.createLinearGradient(mx, my, mx + mw, my + mh); g.addColorStop(0, '#24506e'); g.addColorStop(1, '#2e6488');
        x.fillStyle = g; x.fillRect(mx, my, mw, mh);
        x.strokeStyle = 'rgba(255,255,255,.16)'; x.lineWidth = 1.5;
        for (let i = 0; i < Math.max(mw, mh) / 34; i++) { const px = mx + R() * mw, py = my + R() * mh; x.beginPath(); x.moveTo(px - 8, py); x.quadraticCurveTo(px, py - 3, px + 8, py); x.stroke(); }
      }
      // drawbridge across the moat gap
      const bw = 150, by = O - 56;
      x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(-bw / 2 + 5, by, bw, 68);
      x.fillStyle = '#7a5530'; x.fillRect(-bw / 2, by - 6, bw, 68);
      x.strokeStyle = '#4a3018'; x.lineWidth = 2; for (let py = by - 6; py <= by + 62; py += 11) { x.beginPath(); x.moveTo(-bw / 2, py); x.lineTo(bw / 2, py); x.stroke(); }
      x.fillStyle = '#3a3a3a'; for (const sx of [-bw / 2 + 4, bw / 2 - 8]) x.fillRect(sx, by - 6, 4, 68);
      x.strokeStyle = '#2a2a2a'; x.lineWidth = 1.5; for (const sx of [-bw / 2 + 6, bw / 2 - 6]) { x.beginPath(); x.moveTo(sx, by - 6); x.lineTo(sx * 0.7, by - 40); x.stroke(); }
    }
    // Courtyards: outer ground, then each ring inward a little finer; the innermost ward is paved.
    const oh = rings[0][0] - rings[0][1];
    ground(x, -oh, -oh, oh * 2, oh * 2, st.ground, st.spot, R, oh / 2);
    for (let k = 1; k < rings.length; k++) {
      const h = rings[k][0] - rings[k][1];
      if (k === rings.length - 1) flagstones(x, -h, -h, h * 2, h * 2, st.yard, R);
      else ground(x, -h, -h, h * 2, h * 2, shade(st.ground, -0.08), st.spot, R, h / 2);
    }
    if (rings.length === 1) { const h = 110; flagstones(x, -h, -h - 10, h * 2, h * 2 + 20, st.yard, R, 16); }
    // Cobbled paths from every gate to the keep.
    const [kx, ky, kw, kh] = L.keep;
    for (const [gx, gy, side, gw] of L.gates) {
      const w = Math.min(gw - 20, 84), y0 = side === 'N' ? gy : ky + kh / 2, y1 = side === 'N' ? ky + kh / 2 : gy;
      flagstones(x, gx - w / 2, Math.min(y0, y1), w, Math.abs(y1 - y0), shade(st.yard, -0.06), R, 12);
      x.strokeStyle = 'rgba(0,0,0,.2)'; x.lineWidth = 2; x.strokeRect(gx - w / 2, Math.min(y0, y1), w, Math.abs(y1 - y0));
    }
    // Hall footprints get a worn apron.
    for (const [hx, hy, hw, hh] of L.halls) { x.fillStyle = 'rgba(70,52,34,.35)'; x.fillRect(hx - 8, hy - 8, hw + 16, hh + 16); }
    // Clutter: placed at random where it blocks no path, gate, hall or keep.
    const busy = [[kx - 20, ky - 20, kw + 40, kh + 40], ...L.halls.map(([a, b, w, h]) => [a - 14, b - 14, w + 28, h + 28]),
      ...L.gates.map(([gx, gy, , gw]) => [gx - gw / 2 - 10, -O, gw + 20, O * 2])];
    const clear = (px, py, r) => !busy.some(([a, b, w, h]) => px + r > a && px - r < a + w && py + r > b && py - r < b + h)
      && rings.every(([h, t]) => Math.abs(Math.abs(px) - (h - t / 2)) > t / 2 + r + 6 || Math.abs(px) > h + 4 || Math.abs(py) > h + 4) && rings.every(([h, t]) => Math.abs(Math.abs(py) - (h - t / 2)) > t / 2 + r + 6 || Math.abs(py) > h + 4 || Math.abs(px) > h + 4);
    const kinds = L.style === 'timber' ? ['hay', 'barrels', 'dummy', 'dummy', 'tent', 'tent', 'cart', 'fire', 'crates', 'rack', 'target']
      : L.style === 'stone' ? ['garden', 'well', 'barrels', 'crates', 'rack', 'dummy', 'target', 'cart', 'hay', 'tent']
        : ['rack', 'rack', 'crates', 'barrels', 'fire', 'tent', 'target', 'cart'];
    let placed = 0;
    for (let tries = 0; tries < 400 && placed < kinds.length * 2; tries++) {
      const px = (R() * 2 - 1) * (oh - 30), py = (R() * 2 - 1) * (oh - 30);
      if (!clear(px, py, 26)) continue;
      clutter(x, kinds[placed % kinds.length], px, py, R); busy.push([px - 26, py - 26, 52, 52]); placed++;
    }
    return cv;
  });
}
// Top layer: walls, towers, gatehouses, the keep and halls.
export function castleTop(c, color) {
  return castleMemo(`ctop|${c.id}|${color}`, () => {
    const L = CASTLE_TYPES[c.type], st = STYLE[L.style], S = castleSize(c.type), R = rng(c.id * 131 + 3), [cv, x] = bigCanvas(S);
    x.translate(S / 2, S / 2);
    // Drop shadows first so nothing casts a shadow over a neighbouring wall top.
    x.fillStyle = 'rgba(0,0,0,.3)';
    for (const [x0, y0, w, h] of L.walls) x.fillRect(x0 + 5, y0 + 8, w, h);
    for (const t of L.towers) { x.beginPath(); x.arc(t.x + 6, t.y + 9, t.r + 2, 0, 7); x.fill(); }
    // Walls
    for (const [x0, y0, w, h] of L.walls) {
      const side = wallSide(x0, y0, w, h), horiz = w > h;
      if (L.style === 'timber') {
        // walkway planks along the wall, then a row of sharpened stakes on the outer edge
        x.fillStyle = st.walk; x.fillRect(x0, y0, w, h);
        x.strokeStyle = 'rgba(40,24,10,.45)'; x.lineWidth = 1;
        if (horiz) for (let yy = y0 + 4; yy < y0 + h; yy += 5) { x.beginPath(); x.moveTo(x0, yy); x.lineTo(x0 + w, yy); x.stroke(); }
        else for (let xx = x0 + 4; xx < x0 + w; xx += 5) { x.beginPath(); x.moveTo(xx, y0); x.lineTo(xx, y0 + h); x.stroke(); }
        const len = horiz ? w : h, n = Math.floor(len / 10.5);
        for (let i = 0; i < n; i++) {
          const along = (horiz ? x0 : y0) + 5.25 + i * (len - 10.5) / Math.max(1, n - 1) + 0;
          const across = side === 'N' ? y0 + 6 : side === 'S' ? y0 + h - 6 : side === 'W' ? x0 + 6 : x0 + w - 6;
          const [lx, ly] = horiz ? [along, across] : [across, along];
          blob(x, lx, ly, 6, 6, radial(x, lx, ly, 6, shade(st.log, (R() - 0.5) * 0.25)), OUT, 1.1);
          x.fillStyle = shade(st.log, 0.45); x.beginPath(); x.arc(lx - 1, ly - 1, 1.8, 0, 7); x.fill();
        }
        x.strokeStyle = '#4a3018'; x.lineWidth = 2;
        if (horiz) { const ry = side === 'N' ? y0 + h - 2 : y0 + 2; x.beginPath(); x.moveTo(x0, ry); x.lineTo(x0 + w, ry); x.stroke(); }
        else { const rx = side === 'W' ? x0 + w - 2 : x0 + 2; x.beginPath(); x.moveTo(rx, y0); x.lineTo(rx, y0 + h); x.stroke(); }
        x.strokeStyle = OUT; x.lineWidth = 1.2; x.strokeRect(x0, y0, w, h);
      } else {
        stoneTexture(x, x0, y0, w, h, st.wall, R);
        // wall-walk down the middle
        const inset = Math.max(6, (horiz ? h : w) * 0.28);
        x.fillStyle = shade(st.walk, -0.05);
        if (horiz) x.fillRect(x0, y0 + inset, w, h - inset * 2); else x.fillRect(x0 + inset, y0, w - inset * 2, h);
        x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 1;
        if (horiz) for (let xx = x0 + 9; xx < x0 + w; xx += 9) { x.beginPath(); x.moveTo(xx, y0 + inset); x.lineTo(xx, y0 + h - inset); x.stroke(); }
        else for (let yy = y0 + 9; yy < y0 + h; yy += 9) { x.beginPath(); x.moveTo(x0 + inset, yy); x.lineTo(x0 + w - inset, yy); x.stroke(); }
        // merlons on both edges (big on the outside)
        const ml = L.style === 'dark' ? 12 : 10, gap = ml * 0.75, light = shade(st.wall, 0.2);
        for (const outer of [true, false]) {
          const dep = outer ? inset - 1 : Math.max(3, inset * 0.5);
          const edge = horiz ? ((side === 'N') === outer ? y0 : y0 + h - dep) : ((side === 'W') === outer ? x0 : x0 + w - dep);
          for (let p = (horiz ? x0 : y0) + 2; p < (horiz ? x0 + w : y0 + h) - ml + 2; p += ml + gap) {
            x.fillStyle = light; x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = 0.8;
            if (horiz) { x.fillRect(p, edge, ml, dep); x.strokeRect(p, edge, ml, dep); } else { x.fillRect(edge, p, dep, ml); x.strokeRect(edge, p, dep, ml); }
          }
        }
        x.strokeStyle = OUT; x.lineWidth = 1.5; x.strokeRect(x0, y0, w, h);
      }
    }
    // Towers
    for (const t of L.towers) {
      const { x: tx, y: ty, r } = t;
      if (L.style === 'timber') {
        const h = r * 0.82;
        x.fillStyle = '#7a5634'; x.fillRect(tx - h, ty - h, h * 2, h * 2);
        x.strokeStyle = 'rgba(40,24,10,.5)'; x.lineWidth = 1; for (let yy = ty - h + 5; yy < ty + h; yy += 5) { x.beginPath(); x.moveTo(tx - h, yy); x.lineTo(tx + h, yy); x.stroke(); }
        for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) blob(x, tx + a * (h - 3), ty + b * (h - 3), 4.5, 4.5, '#5a3a1e', OUT, 1);
        x.strokeStyle = OUT; x.lineWidth = 1.5; x.strokeRect(tx - h, ty - h, h * 2, h * 2);
        hipRoof(x, tx - h * 0.72, ty - h * 0.72, h * 1.44, h * 1.44, shade(color, -0.1));
        pennant(x, tx, ty - 2, color, 18);
      } else if (L.style === 'stone') {
        blob(x, tx, ty, r, r, radial(x, tx, ty, r, st.stone), OUT, 2);
        const n = Math.max(10, Math.round(r / 2.6));
        for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; x.fillStyle = i % 2 ? shade(st.stone, 0.22) : shade(st.stone, -0.25); x.beginPath(); x.arc(tx + Math.cos(a) * (r - 4), ty + Math.sin(a) * (r - 4), Math.max(3, r / 9), 0, 7); x.fill(); }
        conicalRoof(x, tx, ty, r - 8, shade(color, -0.05));
        pennant(x, tx, ty - 1, color, 18 + r / 4);
      } else {
        const h = r * 0.9;
        stoneTexture(x, tx - h, ty - h, h * 2, h * 2, st.stone, R, 10, 7);
        x.fillStyle = shade(st.stone, -0.12); x.fillRect(tx - h + 7, ty - h + 7, h * 2 - 14, h * 2 - 14);
        for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) { x.fillStyle = shade(st.stone, 0.22); x.fillRect(tx + a * (h - 4) - 4, ty + b * (h - 4) - 4, 8, 8); x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = 0.8; x.strokeRect(tx + a * (h - 4) - 4, ty + b * (h - 4) - 4, 8, 8); }
        x.strokeStyle = OUT; x.lineWidth = 2; x.strokeRect(tx - h, ty - h, h * 2, h * 2);
        x.fillStyle = '#3a3640'; x.fillRect(tx - 5, ty - 5, 10, 10);
        pennant(x, tx + h * 0.4, ty - h * 0.4, color, 16 + r / 4);
      }
    }
    // Gatehouses: a tower each side of the opening, a beam over it and banners on the outer face.
    for (const [gx, gy, side, gw, t] of L.gates) {
      const wy = side === 'N' ? gy : gy - t, tw = 30, ext = 8;
      for (const s of [-1, 1]) {
        const cx = gx + s * (gw / 2 + tw / 2 - 4), y0 = wy - ext, hgt = t + ext * 2;
        x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(cx - tw / 2 + 5, y0 + 8, tw, hgt);
        if (L.style === 'timber') { x.fillStyle = '#7a5634'; x.fillRect(cx - tw / 2, y0, tw, hgt); x.strokeStyle = OUT; x.lineWidth = 1.4; x.strokeRect(cx - tw / 2, y0, tw, hgt); hipRoof(x, cx - tw / 2 + 3, y0 + 3, tw - 6, hgt - 6, shade(color, -0.1)); }
        else { stoneTexture(x, cx - tw / 2, y0, tw, hgt, st.wall, R, 10, 7); x.fillStyle = shade(st.walk, -0.1); x.fillRect(cx - tw / 2 + 5, y0 + 5, tw - 10, hgt - 10); x.strokeStyle = OUT; x.lineWidth = 1.5; x.strokeRect(cx - tw / 2, y0, tw, hgt); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { x.fillStyle = shade(st.wall, 0.22); x.fillRect(cx + a * (tw / 2 - 4) - 3.5, y0 + hgt / 2 + b * (hgt / 2 - 4) - 3.5, 7, 7); } }
        hangingBanner(x, cx, side === 'N' ? y0 - 22 : y0 + hgt - 6, color, 14, 26);
      }
      // the beam (lintel) and a raised portcullis edge across the gap
      const by = side === 'N' ? wy + t * 0.25 : wy + t * 0.45;
      x.fillStyle = L.style === 'timber' ? '#5a3a1e' : shade(st.wall, -0.1); x.fillRect(gx - gw / 2 + 4, by, gw - 8, 7);
      x.strokeStyle = OUT; x.lineWidth = 1; x.strokeRect(gx - gw / 2 + 4, by, gw - 8, 7);
      x.strokeStyle = 'rgba(30,30,34,.85)'; x.lineWidth = 1.5; for (let px = gx - gw / 2 + 10; px < gx + gw / 2 - 6; px += 9) { x.beginPath(); x.moveTo(px, by + 7); x.lineTo(px, by + 11); x.stroke(); }
    }
    // Halls: long gabled buildings. Barracks wear the owner's colour, stables are thatched, the smithy is slate with a chimney.
    for (const [hx, hy, hw, hh, kind] of L.halls) {
      const col = kind === 'barracks' ? shade(color, -0.2) : kind === 'stable' ? '#b89a58' : '#5a6070';
      x.fillStyle = '#d8c8a0'; x.fillRect(hx, hy, hw, hh);
      gableRoof(x, hx - 4, hy - 4, hw + 8, hh + 8, col, R);
      if (kind === 'smithy') { const cx = hx + hw * 0.75, cy = hy + hh * 0.3; x.fillStyle = '#6a6460'; x.fillRect(cx - 7, cy - 7, 14, 14); x.strokeStyle = OUT; x.lineWidth = 1.2; x.strokeRect(cx - 7, cy - 7, 14, 14); x.fillStyle = '#1a1614'; x.fillRect(cx - 4, cy - 4, 8, 8); x.fillStyle = 'rgba(200,200,200,.35)'; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(cx + 6 + i * 6, cy - 6 - i * 5, 5 + i * 2, 0, 7); x.fill(); } }
    }
    // The keep: stone walls under a roof (a hip roof, turrets at the corners of bigger keeps) and the great banner.
    const [kx, ky, kw, kh] = L.keep;
    x.fillStyle = 'rgba(0,0,0,.32)'; x.fillRect(kx + 8, ky + 11, kw, kh);
    stoneTexture(x, kx, ky, kw, kh, L.style === 'dark' ? '#6a6670' : '#8a867e', R);
    x.strokeStyle = OUT; x.lineWidth = 2; x.strokeRect(kx, ky, kw, kh);
    if (L.style === 'dark') {
      // flat crenellated top with a hatch
      x.fillStyle = '#4e4a54'; x.fillRect(kx + 9, ky + 9, kw - 18, kh - 18);
      for (let p = kx + 3; p < kx + kw - 8; p += 14) for (const yy of [ky + 1, ky + kh - 8]) { x.fillStyle = '#86828c'; x.fillRect(p, yy, 8, 7); }
      for (let p = ky + 3; p < ky + kh - 8; p += 14) for (const xx of [kx + 1, kx + kw - 8]) { x.fillStyle = '#86828c'; x.fillRect(xx, p, 7, 8); }
      x.fillStyle = '#2a2630'; x.fillRect(kx + kw / 2 - 7, ky + kh / 2 - 7, 14, 14);
    } else hipRoof(x, kx + 7, ky + 7, kw - 14, kh - 14, L.style === 'timber' ? '#7a3a2a' : shade(color, -0.25));
    for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const tx = kx + a * kw, ty = ky + b * kh, r = L.style === 'timber' ? 9 : 13;
      blob(x, tx, ty, r, r, radial(x, tx, ty, r, '#8a867e'), OUT, 1.5);
      if (L.style === 'dark') { x.fillStyle = '#4e4a54'; x.beginPath(); x.arc(tx, ty, r - 4, 0, 7); x.fill(); } else conicalRoof(x, tx, ty, r - 3, L.style === 'timber' ? '#7a3a2a' : shade(color, -0.1));
    }
    pennant(x, kx + kw / 2, ky + kh / 2 - 2, color, 34);
    hangingBanner(x, kx + kw / 2, ky + kh - 2, color, 20, 34);
    return cv;
  });
}
// A rocky cave mouth with torches; and the swirling portal that leads back out of a dungeon.
export function caveSprite(theme) {
  return memo('cave|' + theme, () => {
    const R = rng(theme.length * 37), [c, x] = canvas(150, 130); x.translate(75, 70);
    x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.ellipse(6, 10, 66, 48, 0, 0, 7); x.fill();
    for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI, d = 44 + R() * 10; blob(x, Math.cos(a) * d, Math.sin(a) * d * 0.8, 16 + R() * 8, 13 + R() * 6, radial(x, Math.cos(a) * d, Math.sin(a) * d * 0.8, 18, '#7d7870')); }
    blob(x, 0, -8, 52, 36, radial(x, 0, -8, 52, '#6e6a64'));
    const g = x.createRadialGradient(0, 4, 2, 0, 4, 30); g.addColorStop(0, '#000'); g.addColorStop(1, '#1a1612');
    x.fillStyle = g; x.beginPath(); x.ellipse(0, 6, 28, 20, 0, Math.PI, 0); x.lineTo(28, 14); x.lineTo(-28, 14); x.closePath(); x.fill();
    for (const sx of [-38, 38]) { x.fillStyle = '#5a3a1a'; x.fillRect(sx - 2, 2, 4, 14); const fg = x.createRadialGradient(sx, 0, 1, sx, 0, 10); fg.addColorStop(0, '#fff3b0'); fg.addColorStop(0.5, 'rgba(255,150,40,.9)'); fg.addColorStop(1, 'rgba(255,90,20,0)'); x.fillStyle = fg; x.beginPath(); x.arc(sx, 0, 10, 0, 7); x.fill(); }
    return c;
  });
}
export function portalSprite() {
  return memo('portal', () => {
    const [c, x] = canvas(90, 90); x.translate(45, 45);
    const g = x.createRadialGradient(0, 0, 4, 0, 0, 40); g.addColorStop(0, '#fff'); g.addColorStop(0.3, '#c8a0ff'); g.addColorStop(0.75, 'rgba(110,60,220,.7)'); g.addColorStop(1, 'rgba(60,20,140,0)');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, 40, 0, 7); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 2;
    for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(0, 0, 12 + i * 7, i * 1.4, i * 1.4 + 2.2); x.stroke(); }
    return c;
  });
}

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

// Melee weapons are drawn on their own so they can swing; bows, slings and casters' staves stay in the body sprite.
export const SWINGS = new Set(['sword', 'rapier', 'axe', 'greataxe', 'dagger', 'club', 'spear', 'staffplain', 'greatsword', 'flail', 'mace', ...Object.keys(POLE)]);
// A weapon on its own canvas, held at (px, py): the grip. Units match the body sprites.
export function weaponSprite(kind) {
  return memo('wpn|' + kind, () => {
    const [c, x] = canvas(104, 48); x.translate(24, 24);
    x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowOffsetX = 1.5; x.shadowOffsetY = 2; x.shadowBlur = 1.5;
    weapon(x, kind, true);
    return { c, px: 24, py: 24, w: 104, h: 48 };
  });
}
// How big a creature's body is drawn (so a held weapon sits in its hand).
export const lookScale = (kind) => { const lf = MOB_LOOK[kind]; return lf ? lf('#888').scale || 1 : 1; };
// Shared with the icon painter.
export { weapon as drawWeapon, bow as drawBow, shade, radial, blob, OUT };
