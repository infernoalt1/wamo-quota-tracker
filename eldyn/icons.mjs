// Hanbin Island icons: every tool, status and HUD symbol is painted on a canvas (no emoji), cached,
// and handed out as a data URL for <img> tags or as a canvas for the game view.
import { drawWeapon, drawBow, shade, radial, blob, OUT } from './sprites.mjs';
import { TOOLS } from './builds.mjs';

const PX = 96; // icons are painted at 96px and shown at 32-48px, so they stay sharp on any screen
const urls = new Map(), canvases = new Map();
function make(draw) {
  const c = document.createElement('canvas'); c.width = c.height = PX;
  const x = c.getContext('2d'); x.scale(PX / 48, PX / 48); x.lineJoin = 'round'; x.lineCap = 'round';
  draw(x);
  return c;
}
const STEEL = '#d8dee6', WOOD = '#7a5530', GOLD = '#e0b84f';

// ------------------------------------------------------------------ building blocks
function line(x, pts, col, w) { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.moveTo(...pts[0]); for (const p of pts.slice(1)) x.lineTo(...p); x.stroke(); }
function poly(x, pts, fill, stroke = OUT, w = 1.4) { x.beginPath(); x.moveTo(...pts[0]); for (const p of pts.slice(1)) x.lineTo(...p); x.closePath(); if (fill) { x.fillStyle = fill; x.fill(); } if (stroke) { x.strokeStyle = stroke; x.lineWidth = w; x.stroke(); } }
function arrowHead(x, tx, ty, ang, size, col) { poly(x, [[tx, ty], [tx - Math.cos(ang - 0.5) * size, ty - Math.sin(ang - 0.5) * size], [tx - Math.cos(ang + 0.5) * size, ty - Math.sin(ang + 0.5) * size]], col, OUT, 1.2); }
function arrow(x, x0, y0, x1, y1, col = '#f0e0b0', w = 4.5) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  line(x, [[x0, y0], [x1 - Math.cos(a) * 6, y1 - Math.sin(a) * 6]], OUT, w + 2.4); line(x, [[x0, y0], [x1 - Math.cos(a) * 6, y1 - Math.sin(a) * 6]], col, w);
  arrowHead(x, x1, y1, a, 11, col);
}
function arcArrow(x, cx, cy, r, a0, a1, col = '#f0e0b0', w = 4.5) {
  x.strokeStyle = OUT; x.lineWidth = w + 2.4; x.beginPath(); x.arc(cx, cy, r, a0, a1, a1 < a0); x.stroke();
  x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.arc(cx, cy, r, a0, a1, a1 < a0); x.stroke();
  const tx = cx + Math.cos(a1) * r, ty = cy + Math.sin(a1) * r, tan = a1 + (a1 < a0 ? -Math.PI / 2 : Math.PI / 2);
  arrowHead(x, tx + Math.cos(tan) * 4, ty + Math.sin(tan) * 4, tan, 11, col);
}
function speedLines(x, x0, y0, n = 3, len = 10, col = 'rgba(240,230,200,.8)') { for (let i = 0; i < n; i++) line(x, [[x0 - len - (i % 2) * 4, y0 + (i - (n - 1) / 2) * 6], [x0, y0 + (i - (n - 1) / 2) * 6]], col, 2); }
function flask(x, liquid, cx = 24, cy = 28, r = 12, glow = null) {
  // round-bottomed glass flask with a cork
  x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(cx + 2, cy + r - 1, r * 0.9, 3, 0, 0, 7); x.fill();
  x.fillStyle = 'rgba(220,235,245,.35)'; x.fillRect(cx - 4, cy - r - 9, 8, 11);
  x.strokeStyle = OUT; x.lineWidth = 1.4; x.strokeRect(cx - 4, cy - r - 9, 8, 11);
  blob(x, cx, cy, r, r, 'rgba(220,235,245,.35)', OUT, 1.6);
  x.save(); x.beginPath(); x.arc(cx, cy, r - 1.2, 0, 7); x.clip();
  const g = x.createLinearGradient(0, cy - r * 0.3, 0, cy + r); g.addColorStop(0, shade(liquid, 0.25)); g.addColorStop(1, shade(liquid, -0.3));
  x.fillStyle = g; x.fillRect(cx - r, cy - r * 0.25, r * 2, r * 2);
  x.fillStyle = 'rgba(255,255,255,.25)'; x.beginPath(); x.ellipse(cx, cy - r * 0.25, r - 1.5, 2, 0, 0, 7); x.fill();
  x.restore();
  x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.ellipse(cx - r * 0.45, cy - r * 0.35, 2.2, 4, 0.5, 0, 7); x.fill();
  x.fillStyle = '#a07848'; x.fillRect(cx - 4.5, cy - r - 13, 9, 5); x.strokeStyle = OUT; x.lineWidth = 1.2; x.strokeRect(cx - 4.5, cy - r - 13, 9, 5);
  if (glow) { const gg = x.createRadialGradient(cx, cy, 1, cx, cy, r + 6); gg.addColorStop(0, glow); gg.addColorStop(1, 'rgba(0,0,0,0)'); x.globalCompositeOperation = 'lighter'; x.fillStyle = gg; x.beginPath(); x.arc(cx, cy, r + 6, 0, 7); x.fill(); x.globalCompositeOperation = 'source-over'; }
}
function flame(x, cx, by, h, w = h * 0.55) {
  const layers = [['#c83a10', 1], ['#ff8a20', 0.72], ['#ffe080', 0.42]];
  for (const [c, k] of layers) { x.fillStyle = c; x.beginPath(); x.moveTo(cx, by - h * k); x.bezierCurveTo(cx + w * k, by - h * k * 0.5, cx + w * k * 0.9, by, cx, by); x.bezierCurveTo(cx - w * k * 0.9, by, cx - w * k, by - h * k * 0.5, cx, by - h * k); x.fill(); }
  x.strokeStyle = 'rgba(80,20,0,.6)'; x.lineWidth = 1; x.beginPath(); x.moveTo(cx, by - h); x.bezierCurveTo(cx + w, by - h * 0.5, cx + w * 0.9, by, cx, by); x.bezierCurveTo(cx - w * 0.9, by, cx - w, by - h * 0.5, cx, by - h); x.stroke();
}
function cloud(x, cx, cy, s, col) { for (const [dx, dy, r] of [[-9, 3, 8], [0, -3, 10], [10, 2, 8], [3, 6, 8], [-4, 7, 7]]) blob(x, cx + dx * s, cy + dy * s, r * s, r * s, radial(x, cx + dx * s, cy + dy * s, r * s, col), null); for (const [dx, dy, r] of [[-9, 3, 8], [0, -3, 10], [10, 2, 8]]) { x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 1; x.beginPath(); x.arc(cx + dx * s, cy + dy * s, r * s, Math.PI * 0.9, Math.PI * 2.1); x.stroke(); } }
function coinBadge(x) { blob(x, 38, 38, 7.5, 7.5, radial(x, 38, 38, 7.5, '#f0c84a'), OUT, 1.3); x.strokeStyle = '#a07820'; x.lineWidth = 1; x.beginPath(); x.arc(38, 38, 4.5, 0, 7); x.stroke(); }
function pole(x, px, top, bottom) { line(x, [[px, top], [px, bottom]], OUT, 4.4); line(x, [[px, top], [px, bottom]], '#8a6038', 2.6); blob(x, px, top, 2.4, 2.4, GOLD, OUT, 1); }
// A weapon sprite, laid diagonally and scaled to fill the icon.
function weaponIcon(kind, opts = {}) {
  return make((x) => {
    const tmp = document.createElement('canvas'); tmp.width = tmp.height = 360;
    const t = tmp.getContext('2d'); t.translate(180, 180); t.scale(4, 4); t.rotate(opts.rot ?? -Math.PI / 4);
    if (kind === 'bow') drawBow(t, false, opts.len); else drawWeapon(t, kind, true);
    const d = t.getImageData(0, 0, 360, 360).data; let x0 = 360, y0 = 360, x1 = 0, y1 = 0;
    for (let y = 0; y < 360; y++) for (let i = 0; i < 360; i++) if (d[(y * 360 + i) * 4 + 3] > 20) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, sc = Math.min(40 / w, 40 / h, opts.max || 0.6);
    x.save(); x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 2; x.shadowOffsetX = 1; x.shadowOffsetY = 1.5;
    x.drawImage(tmp, x0, y0, w, h, 24 - (w * sc) / 2, 24 - (h * sc) / 2, w * sc, h * sc);
    x.restore();
    if (opts.extra) opts.extra(x);
  });
}
// Front-facing shields: [outline path builder, field colour, rim colour, device].
function shieldIcon(kind) {
  return make((x) => {
    const field = { buckler: '#9aa3ad', targe: '#7a5030', parma: '#a83a30', round: '#8a6038', kite: '#2a5aa0', heraldic: '#c0392b', scutum: '#a82a2a', pavise: '#e8dcc0' }[kind];
    const path = () => {
      x.beginPath();
      if (kind === 'buckler') x.arc(24, 24, 13, 0, 7);
      else if (kind === 'targe' || kind === 'parma') x.arc(24, 24, 17, 0, 7);
      else if (kind === 'round') x.arc(24, 24, 20, 0, 7);
      else if (kind === 'kite') { x.moveTo(24, 3); x.quadraticCurveTo(41, 6, 39, 18); x.quadraticCurveTo(35, 34, 24, 46); x.quadraticCurveTo(13, 34, 9, 18); x.quadraticCurveTo(7, 6, 24, 3); }
      else if (kind === 'heraldic') { x.moveTo(8, 6); x.lineTo(40, 6); x.lineTo(40, 22); x.quadraticCurveTo(38, 38, 24, 45); x.quadraticCurveTo(10, 38, 8, 22); x.closePath(); }
      else if (kind === 'scutum') { x.moveTo(11, 4); x.quadraticCurveTo(24, 1, 37, 4); x.lineTo(37, 44); x.quadraticCurveTo(24, 47, 11, 44); x.closePath(); }
      else { x.moveTo(10, 4); x.lineTo(38, 4); x.lineTo(38, 45); x.lineTo(10, 45); x.closePath(); }
    };
    x.save(); x.translate(1.5, 2); path(); x.fillStyle = 'rgba(0,0,0,.35)'; x.fill(); x.restore();
    path(); const g = x.createLinearGradient(8, 4, 40, 44); g.addColorStop(0, shade(field, 0.25)); g.addColorStop(1, shade(field, -0.3)); x.fillStyle = g; x.fill();
    x.save(); path(); x.clip();
    if (kind === 'round') { x.strokeStyle = 'rgba(40,24,10,.45)'; x.lineWidth = 1.2; for (let i = 10; i < 44; i += 6) line(x, [[i, 2], [i, 46]], 'rgba(40,24,10,.45)', 1.2); }
    if (kind === 'targe') { for (let a = 0; a < 8; a++) blob(x, 24 + Math.cos(a * 0.785) * 11, 24 + Math.sin(a * 0.785) * 11, 1.6, 1.6, '#d8c070', null); }
    if (kind === 'kite') { x.fillStyle = GOLD; x.fillRect(22, 4, 4, 42); x.fillRect(9, 15, 30, 4); }
    if (kind === 'heraldic') { poly(x, [[8, 30], [24, 16], [40, 30], [40, 36], [24, 22], [8, 36]], '#f0d070', null); }
    if (kind === 'scutum') { x.strokeStyle = GOLD; x.lineWidth = 1.6; x.strokeRect(14, 7, 20, 35); line(x, [[24, 9], [24, 40]], GOLD, 1.6); line(x, [[14, 24], [34, 24]], GOLD, 1.6); }
    if (kind === 'pavise') { x.fillStyle = '#a82a2a'; x.fillRect(21, 4, 6, 42); x.fillRect(10, 18, 28, 6); }
    x.restore();
    path(); x.strokeStyle = kind === 'buckler' || kind === 'parma' ? '#d8dce0' : '#b8a060'; x.lineWidth = 2.6; x.stroke();
    path(); x.strokeStyle = OUT; x.lineWidth = 1; x.stroke();
    if (kind !== 'pavise' && kind !== 'heraldic' && kind !== 'kite') blob(x, 24, 24, kind === 'buckler' ? 4.5 : 5.5, kind === 'buckler' ? 4.5 : 5.5, radial(x, 24, 24, 5.5, '#d8dce0'), OUT, 1.2);
  });
}

// ------------------------------------------------------------------ one painter per tool
const W = (k, o) => () => weaponIcon(k, o);
const PAINT = {
  spear: W('spear'), shortsword: W('sword'), pike: W('pike'), partisan: W('partisan'), lance: W('lance'), glaive: W('glaive'), halberd: W('halberd'),
  pollaxe: W('pollaxe'), ranseur: W('ranseur'), bardiche: W('bardiche'), sabre: W('sword', { extra: (x) => { x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 1.5; x.beginPath(); x.arc(10, 38, 26, -1.2, -0.3); x.stroke(); } }),
  rapier: W('rapier'), battleaxe: W('axe'), greatsword: W('greatsword'), flail: W('flail'), quarterstaff: W('staffplain'), sceptre: W('mace'),
  bollock: W('dagger'), rondel: W('dagger', { extra: (x) => blob(x, 12, 36, 3, 3, '#c8ccd4', OUT, 1) }), blackjack: W('club'),
  flatbow: W('bow'), longbow: W('bow', { len: 1.35 }), crossbow: W('crossbow'), repeater: W('crossbow', { extra: (x) => { x.fillStyle = '#5a3a1a'; x.fillRect(22, 10, 9, 9); x.strokeStyle = OUT; x.lineWidth = 1.2; x.strokeRect(22, 10, 9, 9); } }),
  pilum: W('pilum'),
  plumbata: () => make((x) => { line(x, [[10, 38], [34, 14]], OUT, 4); line(x, [[10, 38], [34, 14]], WOOD, 2.4); poly(x, [[34, 14], [40, 8], [37, 17]], STEEL); blob(x, 27, 21, 4, 4, '#606870', OUT, 1); poly(x, [[10, 38], [6, 37], [9, 34]], '#e8e0d0'); poly(x, [[10, 38], [11, 42], [14, 39]], '#e8e0d0'); }),
  sling: () => make((x) => { line(x, [[8, 8], [22, 30]], '#8a6a3a', 2.4); line(x, [[40, 8], [26, 30]], '#8a6a3a', 2.4); blob(x, 24, 32, 9, 6, radial(x, 24, 32, 9, '#8a6038')); blob(x, 24, 30, 5, 5, radial(x, 24, 30, 5, '#a8a49a')); blob(x, 8, 8, 2.5, 2.5, '#5a3a1a', OUT, 1); blob(x, 40, 8, 2.5, 2.5, '#5a3a1a', OUT, 1); }),
  buckler: () => shieldIcon('buckler'), targe: () => shieldIcon('targe'), kite: () => shieldIcon('kite'), pavise: () => shieldIcon('pavise'),
  parma: () => shieldIcon('parma'), round: () => shieldIcon('round'), scutum: () => shieldIcon('scutum'), heraldic: () => shieldIcon('heraldic'),
  lunge: () => make((x) => { speedLines(x, 14, 24, 3, 9); arrow(x, 14, 24, 42, 24, '#f0d890', 6); }),
  feint: () => make((x) => { x.setLineDash([3, 3]); line(x, [[8, 34], [24, 34]], 'rgba(240,230,200,.6)', 2); x.setLineDash([]); arcArrow(x, 24, 34, 15, Math.PI, Math.PI * 1.9, '#f0d890', 4.5); blob(x, 40, 34, 4, 4, '#c04030', OUT, 1); }),
  remise: () => make((x) => { blob(x, 24, 24, 5, 5, '#c04030', OUT, 1.2); arcArrow(x, 24, 24, 15, -2.6, 1.9, '#f0d890', 4.5); }),
  parry: () => make((x) => {
    for (const s of [1, -1]) { x.save(); x.translate(24, 24); x.rotate(s * 0.78); line(x, [[-18, 0], [16, 0]], OUT, 5); line(x, [[-18, 0], [16, 0]], STEEL, 3.2); line(x, [[-13, -5], [-13, 5]], GOLD, 2.6); line(x, [[-20, 0], [-14, 0]], '#5a3a1a', 3); x.restore(); }
    for (let i = 0; i < 8; i++) { const a = i * 0.785; line(x, [[24 + Math.cos(a) * 4, 24 + Math.sin(a) * 4], [24 + Math.cos(a) * 9, 24 + Math.sin(a) * 9]], '#fff0a0', 1.8); }
  }),
  riposte: () => make((x) => { arcArrow(x, 24, 26, 14, 0.3, Math.PI + 0.6, '#9fd8ff', 3.5); x.save(); x.translate(24, 24); x.rotate(-0.78); line(x, [[-14, 0], [16, 0]], OUT, 5); line(x, [[-14, 0], [16, 0]], STEEL, 3); line(x, [[-9, -4], [-9, 4]], GOLD, 2.4); x.restore(); }),
  retreat: () => make((x) => { arrow(x, 36, 24, 8, 24, '#f0d890', 6); for (let i = 0; i < 6; i++) { const a = i * 1.05; line(x, [[40 + Math.cos(a) * 3, 24 + Math.sin(a) * 3], [40 + Math.cos(a) * 7, 24 + Math.sin(a) * 7]], '#ffb070', 1.8); } }),
  crossover: () => make((x) => { arrow(x, 34, 34, 10, 12, '#f0d890', 4); arrow(x, 14, 36, 40, 18, '#9fd8ff', 4); }),
  redemption: () => make((x) => { flame(x, 24, 44, 38, 17); }),
  sprint: () => make((x) => { speedLines(x, 14, 28, 3, 8); poly(x, [[16, 10], [27, 10], [27, 28], [40, 32], [40, 40], [16, 40]], '#7a5030'); line(x, [[16, 36], [40, 36]], 'rgba(0,0,0,.35)', 1.5); line(x, [[17, 16], [26, 16]], '#c8a060', 1.5); }),
  focus: () => make((x) => { poly(x, [[4, 24], [14, 14], [34, 14], [44, 24], [34, 34], [14, 34]], '#f0ece0'); x.beginPath(); x.moveTo(4, 24); x.quadraticCurveTo(24, 6, 44, 24); x.quadraticCurveTo(24, 42, 4, 24); x.fillStyle = '#f0ece0'; x.fill(); x.strokeStyle = OUT; x.lineWidth = 1.6; x.stroke(); blob(x, 24, 24, 8, 8, radial(x, 24, 24, 8, '#4a8ad0'), OUT, 1); blob(x, 24, 24, 3.5, 3.5, '#101010', null); blob(x, 21.5, 21.5, 1.6, 1.6, '#fff', null); }),
  shadows: () => make((x) => { x.fillStyle = '#c8d8ff'; x.beginPath(); x.arc(34, 12, 7, 0, 7); x.fill(); x.fillStyle = '#1e2a3a'; x.beginPath(); x.arc(37, 10, 6, 0, 7); x.fill(); for (const [y, w] of [[10, 8], [20, 12], [31, 16]]) poly(x, [[18, y - 6], [18 + w, y + 8], [18 - w, y + 8]], '#24402c'); x.fillStyle = '#3a2a1a'; x.fillRect(16, 38, 4, 7); }),
  draught: () => make((x) => { x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(12, 16, 22, 28); poly(x, [[10, 14], [32, 14], [31, 43], [11, 43]], '#9a6a38'); for (const yy of [20, 36]) line(x, [[10.5, yy], [31.5, yy]], '#5a5a60', 2.2); x.strokeStyle = OUT; x.lineWidth = 3.5; x.beginPath(); x.arc(33, 28, 7, -1.3, 1.3); x.stroke(); x.strokeStyle = '#9a6a38'; x.lineWidth = 2; x.stroke(); cloud(x, 21, 12, 0.6, '#fff8e0'); }),
  rations: () => make((x) => { blob(x, 24, 28, 18, 11, radial(x, 24, 26, 18, '#c8883a'), OUT, 1.6); for (const dx of [-8, 0, 8]) line(x, [[24 + dx - 3, 22], [24 + dx + 3, 30]], '#f0d090', 2); blob(x, 33, 14, 7, 5, radial(x, 33, 14, 7, '#f0d050'), OUT, 1.2); }),
  tincture: () => make((x) => flask(x, '#d04050', 24, 29, 11)),
  poultice: () => make((x) => { blob(x, 24, 30, 15, 9, radial(x, 24, 30, 15, '#f0ead8'), OUT, 1.5); line(x, [[12, 30], [36, 30]], 'rgba(0,0,0,.15)', 1); x.beginPath(); x.moveTo(12, 22); x.quadraticCurveTo(24, 2, 38, 12); x.quadraticCurveTo(28, 28, 12, 22); x.fillStyle = '#5aa040'; x.fill(); x.strokeStyle = OUT; x.lineWidth = 1.3; x.stroke(); line(x, [[13, 21], [33, 13]], '#8ad070', 1.5); }),
  blessing: () => make((x) => { for (let i = 0; i < 12; i++) { const a = i * 0.5236, l = i % 2 ? 14 : 21; line(x, [[24 + Math.cos(a) * 9, 24 + Math.sin(a) * 9], [24 + Math.cos(a) * l, 24 + Math.sin(a) * l]], '#ffe890', 2.4); } blob(x, 24, 24, 9, 9, radial(x, 24, 24, 9, '#fff2b0'), OUT, 1.2); }),
  meditation: () => make((x) => { for (const [a, c] of [[-0.9, '#f0b0c8'], [0.9, '#f0b0c8'], [0, '#f8d8e4']]) { x.save(); x.translate(24, 34); x.rotate(a); x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(9, -12, 0, -24); x.quadraticCurveTo(-9, -12, 0, 0); x.fillStyle = c; x.fill(); x.strokeStyle = OUT; x.lineWidth = 1.2; x.stroke(); x.restore(); } blob(x, 24, 38, 14, 4, '#5aa040', OUT, 1.2); }),
  cloak: () => make((x) => { x.beginPath(); x.moveTo(24, 4); x.quadraticCurveTo(38, 8, 38, 22); x.quadraticCurveTo(40, 36, 42, 44); x.lineTo(6, 44); x.quadraticCurveTo(8, 36, 10, 22); x.quadraticCurveTo(10, 8, 24, 4); const g = x.createLinearGradient(6, 4, 42, 44); g.addColorStop(0, '#6a4a8a'); g.addColorStop(1, '#2a1a3a'); x.fillStyle = g; x.fill(); x.strokeStyle = OUT; x.lineWidth = 1.5; x.stroke(); blob(x, 24, 18, 7, 8, '#120c18', null); blob(x, 21.5, 18, 1.3, 1, '#c0a0ff', null); blob(x, 26.5, 18, 1.3, 1, '#c0a0ff', null); }),
  smoke: () => make((x) => { cloud(x, 22, 30, 1, '#a8a8b0'); cloud(x, 28, 16, 0.7, '#c8c8d0'); }),
  turncoat: () => make((x) => { x.beginPath(); x.moveTo(8, 10); x.quadraticCurveTo(24, 4, 40, 10); x.quadraticCurveTo(42, 36, 24, 44); x.quadraticCurveTo(6, 36, 8, 10); x.save(); x.clip(); x.fillStyle = '#f0ece0'; x.fillRect(0, 0, 24, 48); x.fillStyle = '#3a6ac0'; x.fillRect(24, 0, 24, 48); x.restore(); x.strokeStyle = OUT; x.lineWidth = 1.6; x.stroke(); for (const ex of [16, 32]) { x.beginPath(); x.ellipse(ex, 20, 4.5, 3, 0, 0, 7); x.fillStyle = '#1a1410'; x.fill(); } x.beginPath(); x.arc(24, 30, 6, 0.2, Math.PI - 0.2); x.strokeStyle = '#1a1410'; x.lineWidth = 2; x.stroke(); }),
  gall: () => make((x) => flask(x, '#a8c840', 24, 29, 12)),
  naphtha: () => make((x) => { flask(x, '#ff8a30', 24, 30, 12); flame(x, 24, 15, 14, 6); }),
  saltpetre: () => make((x) => { blob(x, 22, 28, 14, 14, radial(x, 22, 28, 14, '#4a4a52'), OUT, 1.6); x.fillStyle = '#6a6a72'; x.fillRect(27, 11, 7, 7); x.strokeStyle = OUT; x.lineWidth = 1.2; x.strokeRect(27, 11, 7, 7); x.strokeStyle = '#c8a060'; x.lineWidth = 2; x.beginPath(); x.moveTo(31, 11); x.quadraticCurveTo(34, 4, 40, 6); x.stroke(); for (let i = 0; i < 6; i++) { const a = i * 1.05; line(x, [[40 + Math.cos(a) * 1.5, 6 + Math.sin(a) * 1.5], [40 + Math.cos(a) * 5, 6 + Math.sin(a) * 5]], '#ffd060', 1.5); } }),
  moonstone: () => make((x) => { const g = x.createRadialGradient(24, 24, 2, 24, 24, 22); g.addColorStop(0, 'rgba(180,140,255,.6)'); g.addColorStop(1, 'rgba(80,40,160,0)'); x.fillStyle = g; x.beginPath(); x.arc(24, 24, 22, 0, 7); x.fill(); poly(x, [[24, 8], [36, 18], [33, 36], [16, 39], [11, 22]], '#3a2a5a'); poly(x, [[24, 8], [36, 18], [24, 22]], '#5a4a8a', null); x.fillStyle = '#e8e0ff'; x.beginPath(); x.arc(24, 26, 6, 0, 7); x.fill(); x.fillStyle = '#3a2a5a'; x.beginPath(); x.arc(26.5, 24.5, 5, 0, 7); x.fill(); }),
  firefog: () => make((x) => { cloud(x, 24, 26, 1.1, '#d07040'); flame(x, 16, 40, 10); flame(x, 30, 42, 12); }),
  quicksilver: () => make((x) => { for (const [cx, cy, r] of [[18, 28, 9], [32, 20, 6], [33, 35, 5], [12, 14, 4]]) blob(x, cx, cy, r, r, radial(x, cx, cy, r, '#d8dce4'), OUT, 1.2); }),
  leeches: () => make((x) => { x.strokeStyle = OUT; x.lineWidth = 9; x.beginPath(); x.moveTo(8, 32); x.bezierCurveTo(14, 12, 26, 40, 40, 16); x.stroke(); x.strokeStyle = '#5a2030'; x.lineWidth = 7; x.stroke(); x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 1.5; x.stroke(); blob(x, 40, 16, 4, 4, '#3a1018', OUT, 1); for (let i = 0; i < 3; i++) blob(x, 12 + i * 4, 40 - i * 2, 1.6, 2.4, '#c02030', null); }),
  net: () => make((x) => { x.save(); x.beginPath(); x.arc(24, 24, 19, 0, 7); x.clip(); for (let i = -24; i <= 24; i += 7) { line(x, [[24 + i - 24, 0], [24 + i + 24, 48]], '#d8c890', 1.8); line(x, [[24 + i + 24, 0], [24 + i - 24, 48]], '#d8c890', 1.8); } x.restore(); x.strokeStyle = '#a08850'; x.lineWidth = 3; x.beginPath(); x.arc(24, 24, 19, 0, 7); x.stroke(); for (let i = 0; i < 6; i++) { const a = i * 1.05 + 0.3; blob(x, 24 + Math.cos(a) * 19, 24 + Math.sin(a) * 19, 2.2, 2.2, '#606870', OUT, 0.8); } }),
  lariat: () => make((x) => { x.strokeStyle = OUT; x.lineWidth = 5; x.beginPath(); x.ellipse(28, 20, 13, 10, -0.3, 0, 7); x.moveTo(17, 27); x.quadraticCurveTo(10, 36, 6, 44); x.stroke(); x.strokeStyle = '#c8a870'; x.lineWidth = 3; x.stroke(); x.setLineDash([2, 3]); x.strokeStyle = '#8a6a3a'; x.lineWidth = 1; x.stroke(); x.setLineDash([]); }),
  tripwire: () => make((x) => { for (const px of [8, 40]) { x.fillStyle = '#6a4a2a'; x.fillRect(px - 2.5, 20, 5, 18); x.strokeStyle = OUT; x.lineWidth = 1.2; x.strokeRect(px - 2.5, 20, 5, 18); } line(x, [[8, 26], [40, 26]], '#e8dcb0', 1.6); poly(x, [[21, 26], [27, 26], [29, 36], [19, 36]], GOLD); blob(x, 24, 37, 2, 2, '#5a4a20', null); }),
  foothold: () => make((x) => { x.strokeStyle = '#5a5a60'; x.lineWidth = 3; x.beginPath(); x.ellipse(24, 30, 18, 10, 0, 0, 7); x.stroke(); for (const s of [-1, 1]) { x.beginPath(); x.ellipse(24, 30 + s * 2, 15, 7, 0, s < 0 ? Math.PI : 0, s < 0 ? Math.PI * 2 : Math.PI); x.strokeStyle = OUT; x.lineWidth = 3.4; x.stroke(); x.strokeStyle = '#a8acb4'; x.lineWidth = 2; x.stroke(); } for (let i = -12; i <= 12; i += 4) { poly(x, [[24 + i - 1.5, 26], [24 + i, 21], [24 + i + 1.5, 26]], '#e0e4ea', OUT, 0.6); poly(x, [[24 + i - 1.5, 34], [24 + i, 39], [24 + i + 1.5, 34]], '#e0e4ea', OUT, 0.6); } blob(x, 24, 30, 4, 3, '#8a6a3a', OUT, 1); }),
  sulphur: () => make((x) => { blob(x, 24, 36, 16, 6, radial(x, 24, 36, 16, '#6a6a40'), OUT, 1.4); cloud(x, 24, 22, 0.9, '#d8d040'); }),
  brimstone: () => make((x) => { blob(x, 24, 38, 17, 6, radial(x, 24, 38, 17, '#5a3a2a'), OUT, 1.4); flame(x, 16, 38, 18, 7); flame(x, 30, 38, 24, 9); }),
  spinner: () => make((x) => { x.fillStyle = '#5a4030'; x.fillRect(21, 24, 6, 20); x.strokeStyle = OUT; x.lineWidth = 1.2; x.strokeRect(21, 24, 6, 20); for (let i = 0; i < 4; i++) { const a = i * 1.571 + 0.4; x.save(); x.translate(24, 20); x.rotate(a); poly(x, [[0, -2], [17, -4], [19, 0], [17, 4], [0, 2]], STEEL, OUT, 1); x.restore(); } blob(x, 24, 20, 4, 4, '#606870', OUT, 1); x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 1.5; x.beginPath(); x.arc(24, 20, 21, -0.4, 0.8); x.stroke(); }),
  pennon: () => make((x) => { pole(x, 12, 5, 45); poly(x, [[13, 7], [42, 14], [13, 22]], '#c0392b'); line(x, [[14, 10], [34, 14]], 'rgba(255,255,255,.3)', 1.5); }),
  banderole: () => make((x) => { pole(x, 10, 5, 45); x.beginPath(); x.moveTo(11, 7); x.bezierCurveTo(22, 2, 30, 14, 44, 8); x.lineTo(38, 14); x.lineTo(44, 19); x.bezierCurveTo(30, 24, 22, 13, 11, 18); x.closePath(); const g = x.createLinearGradient(11, 0, 44, 0); g.addColorStop(0, '#3a6ac0'); g.addColorStop(1, '#2a4a8a'); x.fillStyle = g; x.fill(); x.strokeStyle = OUT; x.lineWidth = 1.3; x.stroke(); }),
  gonfalon: () => make((x) => { pole(x, 24, 4, 46); line(x, [[10, 9], [38, 9]], OUT, 4); line(x, [[10, 9], [38, 9]], '#8a6038', 2.4); poly(x, [[12, 10], [36, 10], [36, 34], [32, 40], [28, 34], [24, 40], [20, 34], [16, 40], [12, 34]], '#e8e4d8'); poly(x, [[21, 16], [27, 16], [27, 22], [21, 22]], '#c0392b', null); poly(x, [[18, 19], [30, 19]], null, '#c0392b', 2); }),
  ensign: () => make((x) => { pole(x, 10, 4, 46); x.beginPath(); x.moveTo(11, 7); x.quadraticCurveTo(26, 3, 42, 8); x.lineTo(42, 27); x.quadraticCurveTo(26, 22, 11, 26); x.closePath(); x.fillStyle = '#2a7a40'; x.fill(); x.strokeStyle = OUT; x.lineWidth = 1.3; x.stroke(); blob(x, 26, 16, 5, 5, GOLD, OUT, 1); }),
  bonfire: () => make((x) => { for (const [a, c] of [[0.5, '#6a4426'], [-0.5, '#7a5030'], [0, '#5a3a1e']]) { x.save(); x.translate(24, 39); x.rotate(a); x.fillStyle = c; x.fillRect(-16, -3.5, 32, 7); x.strokeStyle = OUT; x.lineWidth = 1.2; x.strokeRect(-16, -3.5, 32, 7); x.restore(); } flame(x, 24, 38, 30, 13); }),
  hire_archer: () => weaponIcon('bow', { extra: coinBadge }),
  hire_merc: () => make((x) => { for (const s of [1, -1]) { x.save(); x.translate(22, 22); x.rotate(s * 0.78); line(x, [[-16, 0], [14, 0]], OUT, 5); line(x, [[-16, 0], [14, 0]], STEEL, 3.2); line(x, [[-11, -5], [-11, 5]], GOLD, 2.6); x.restore(); } coinBadge(x); }),
  hire_guard: () => make((x) => { line(x, [[30, 4], [30, 40]], OUT, 4); line(x, [[30, 4], [30, 40]], WOOD, 2.4); poly(x, [[27, 7], [30, 0], [33, 7]], STEEL); x.beginPath(); x.moveTo(8, 10); x.lineTo(26, 10); x.lineTo(26, 24); x.quadraticCurveTo(25, 34, 17, 39); x.quadraticCurveTo(9, 34, 8, 24); x.closePath(); x.fillStyle = '#2a5aa0'; x.fill(); x.strokeStyle = '#b8a060'; x.lineWidth = 2; x.stroke(); coinBadge(x); }),
  hire_healer: () => make((x) => { x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(9, 17, 28, 24); poly(x, [[7, 15], [35, 15], [35, 39], [7, 39]], '#8a6038'); x.strokeStyle = OUT; x.lineWidth = 2; x.beginPath(); x.arc(21, 15, 6, Math.PI, 0); x.stroke(); x.fillStyle = '#f0ece0'; x.fillRect(18, 21, 6, 14); x.fillRect(14, 25, 14, 6); coinBadge(x); }),
};

// ------------------------------------------------------------------ public
export function toolCanvas(id) {
  let c = canvases.get(id);
  if (!c) { const p = PAINT[id]; c = p ? p() : make((x) => blob(x, 24, 24, 12, 12, '#888')); canvases.set(id, c); }
  return c;
}
export function toolIcon(id) {
  let u = urls.get(id);
  if (!u) { u = toolCanvas(id).toDataURL(); urls.set(id, u); }
  return u;
}
export const toolImg = (id, cls = 'ti') => (TOOLS[id] ? `<img class="${cls}" src="${toolIcon(id)}" alt="" draggable="false">` : '');

// Status effects shown under a fighter: [flag bit, painter, label].
const ST = {
  1: (x) => { for (const dx of [-7, 7]) { x.strokeStyle = OUT; x.lineWidth = 6; x.beginPath(); x.ellipse(24 + dx, 24, 9, 6, 0, 0, 7); x.stroke(); x.strokeStyle = '#b8bcc4'; x.lineWidth = 3.6; x.stroke(); } },
  4: (x) => { for (const dy of [-8, 4]) { x.strokeStyle = OUT; x.lineWidth = 7; x.beginPath(); x.moveTo(11, 14 + dy); x.lineTo(24, 26 + dy); x.lineTo(37, 14 + dy); x.stroke(); x.strokeStyle = '#7ac0ff'; x.lineWidth = 4.4; x.stroke(); } },
  8: (x) => arrow(x, 24, 8, 24, 42, '#ff6a5a', 7),
  16: (x) => arrow(x, 24, 42, 24, 8, '#ffd060', 7),
  32: (x) => { x.beginPath(); x.moveTo(9, 8); x.lineTo(39, 8); x.lineTo(39, 24); x.quadraticCurveTo(37, 38, 24, 44); x.quadraticCurveTo(11, 38, 9, 24); x.closePath(); x.fillStyle = '#5a8ad0'; x.fill(); x.strokeStyle = OUT; x.lineWidth = 2.4; x.stroke(); },
  64: (x) => { x.strokeStyle = '#c8a0ff'; x.lineWidth = 4; x.beginPath(); for (let a = 0; a < 12; a += 0.2) { const r = 2 + a * 1.6; x.lineTo(24 + Math.cos(a) * r, 24 + Math.sin(a) * r); } x.stroke(); },
  128: (x) => { x.fillStyle = OUT; x.fillRect(17, 6, 14, 36); x.fillRect(6, 17, 36, 14); x.fillStyle = '#6ae08a'; x.fillRect(19, 8, 10, 32); x.fillRect(8, 19, 32, 10); },
  256: (x) => { x.beginPath(); x.moveTo(24, 5); x.quadraticCurveTo(40, 26, 36, 34); x.arc(24, 32, 12, 0.15, Math.PI - 0.15); x.quadraticCurveTo(8, 26, 24, 5); x.fillStyle = '#9a5ad0'; x.fill(); x.strokeStyle = OUT; x.lineWidth = 2.4; x.stroke(); },
};
const stCache = new Map();
export function statusCanvas(bit) { let c = stCache.get(bit); if (!c && ST[bit]) { c = make(ST[bit]); stCache.set(bit, c); } return c || null; }

// Small HUD symbols: key, coin, wood, lock.
const UI = {
  key: (x) => { blob(x, 14, 24, 9, 9, null, OUT, 7); blob(x, 14, 24, 9, 9, null, GOLD, 4.4); line(x, [[23, 24], [43, 24]], OUT, 7); line(x, [[23, 24], [43, 24]], GOLD, 4.4); for (const px of [36, 42]) { line(x, [[px, 24], [px, 32]], OUT, 6); line(x, [[px, 24], [px, 32]], GOLD, 3.4); } },
  coin: (x) => { for (const [cx, cy] of [[20, 30], [28, 22]]) { blob(x, cx, cy, 13, 13, radial(x, cx, cy, 13, '#f0c84a'), OUT, 2); x.strokeStyle = '#a07820'; x.lineWidth = 1.6; x.beginPath(); x.arc(cx, cy, 8.5, 0, 7); x.stroke(); } },
  wood: (x) => { for (const [cx, cy] of [[15, 32], [33, 32], [24, 17]]) { blob(x, cx, cy, 10, 10, radial(x, cx, cy, 10, '#8a5a30'), OUT, 2); blob(x, cx, cy, 6, 6, '#d8b078', null); x.strokeStyle = 'rgba(120,80,40,.7)'; x.lineWidth = 1; x.beginPath(); x.arc(cx, cy, 3.5, 0, 7); x.stroke(); } },
  lock: (x) => { x.strokeStyle = OUT; x.lineWidth = 7; x.beginPath(); x.arc(24, 20, 9, Math.PI, 0); x.stroke(); x.strokeStyle = '#b8bcc4'; x.lineWidth = 4; x.stroke(); poly(x, [[11, 20], [37, 20], [37, 42], [11, 42]], '#c8a040', OUT, 2.2); blob(x, 24, 29, 3, 3, '#3a2a10', null); x.fillStyle = '#3a2a10'; x.fillRect(22.8, 29, 2.4, 7); },
  star: (x) => poly(x, Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 9 : 21; return [24 + Math.cos(a) * r, 26 + Math.sin(a) * r]; }), GOLD, OUT, 2),
};
const uiCache = new Map();
export function uiIcon(name) { let u = uiCache.get(name); if (!u) { u = make(UI[name]).toDataURL(); uiCache.set(name, u); } return u; }
export const uiImg = (name, title = '') => `<img class="ui-ico" src="${uiIcon(name)}" alt="${title}" title="${title}" draggable="false">`;
