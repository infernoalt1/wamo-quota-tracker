// Hanbin Island game feel: synthesized sound, blood and dust, splatter that stays on the ground, bodies
// that fall, screen shake, hit-stop and the arc a weapon travels through when it swings.

// ------------------------------------------------------------------ sound (synthesized with WebAudio, no files)
let actx = null, master = null, noise = null, muted = false, volume = 0.55;
try { muted = localStorage.getItem('hanbin_mute') === '1'; } catch { /* private mode */ }
export function initAudio() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain(); master.gain.value = muted ? 0 : volume;
    const comp = actx.createDynamicsCompressor(); master.connect(comp); comp.connect(actx.destination);
    noise = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { actx = null; }
}
export const isMuted = () => muted;
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : volume; try { localStorage.setItem('hanbin_mute', m ? '1' : '0'); } catch { /* ignore */ } }
function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function out(vol, pan) {
  const g = actx.createGain(); g.gain.value = vol;
  if (actx.createStereoPanner) { const p = actx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(master); } else g.connect(master);
  return g;
}
function burst(dest, t, dur, type, f0, f1, q = 1, peak = 1, attack = 0.005) {
  const src = actx.createBufferSource(); src.buffer = noise; src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const flt = actx.createBiquadFilter(); flt.type = type; flt.Q.value = q; flt.frequency.setValueAtTime(f0, t); flt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = actx.createGain(); env(g, t, attack, peak, dur);
  src.connect(flt); flt.connect(g); g.connect(dest); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
}
function tone(dest, t, dur, type, f0, f1, peak = 1, attack = 0.004) {
  const o = actx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = actx.createGain(); env(g, t, attack, peak, dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
}
const SOUNDS = {
  swing: (d, t) => burst(d, t, 0.17, 'bandpass', 500, 2600, 1.4, 0.7, 0.03),
  heavy: (d, t) => { burst(d, t, 0.3, 'bandpass', 260, 1300, 1.1, 0.9, 0.06); burst(d, t, 0.25, 'lowpass', 400, 120, 0.7, 0.4, 0.05); },
  thrust: (d, t) => burst(d, t, 0.1, 'highpass', 1400, 3200, 0.8, 0.6, 0.01),
  spin: (d, t) => { for (let i = 0; i < 3; i++) burst(d, t + i * 0.09, 0.12, 'bandpass', 700, 1800, 1.5, 0.5, 0.02); },
  bow: (d, t) => { tone(d, t, 0.14, 'sawtooth', 210, 110, 0.35); burst(d, t, 0.08, 'highpass', 2000, 4000, 0.7, 0.3); },
  sling: (d, t) => burst(d, t, 0.14, 'bandpass', 900, 400, 2, 0.6, 0.02),
  hit: (d, t) => { tone(d, t, 0.13, 'sine', 140, 48, 1); burst(d, t, 0.07, 'lowpass', 2400, 500, 0.7, 0.8); },
  hithard: (d, t) => { tone(d, t, 0.2, 'sine', 120, 38, 1.2); burst(d, t, 0.1, 'lowpass', 3000, 300, 0.7, 1); burst(d, t + 0.02, 0.06, 'highpass', 3000, 5000, 0.7, 0.35); },
  block: (d, t) => { tone(d, t, 0.32, 'triangle', 880, 840, 0.45); tone(d, t, 0.22, 'triangle', 1330, 1290, 0.3); burst(d, t, 0.04, 'highpass', 3000, 6000, 0.7, 0.6); },
  hurt: (d, t) => { tone(d, t, 0.18, 'sine', 95, 40, 1.2); burst(d, t, 0.12, 'lowpass', 900, 200, 0.7, 0.8); },
  die: (d, t) => { burst(d, t, 0.5, 'lowpass', 900, 90, 0.8, 0.9, 0.02); tone(d, t, 0.45, 'sine', 110, 45, 0.7); },
  shield: (d, t) => { tone(d, t, 0.09, 'square', 190, 150, 0.25); burst(d, t, 0.06, 'bandpass', 600, 400, 3, 0.5); },
  heal: (d, t) => { [660, 880, 1100].forEach((f, i) => tone(d, t + i * 0.06, 0.22, 'sine', f, f, 0.25)); },
  level: (d, t) => { [523, 659, 784, 1046].forEach((f, i) => tone(d, t + i * 0.09, 0.4, 'triangle', f, f, 0.3)); },
  click: (d, t) => tone(d, t, 0.04, 'square', 900, 700, 0.12),
  boom: (d, t) => { burst(d, t, 0.6, 'lowpass', 1200, 60, 0.7, 1.2, 0.01); tone(d, t, 0.4, 'sine', 80, 30, 1); },
  wood: (d, t) => { tone(d, t, 0.08, 'triangle', 260, 180, 0.5); burst(d, t, 0.05, 'bandpass', 1200, 700, 2, 0.6); },
};
// Plays a sound; dx/dist place it in the world relative to you (farther is quieter and panned).
export function sfx(name, dx = 0, dist = 0, vol = 1) {
  if (!actx || muted || !SOUNDS[name] || dist > 1100) return;
  const fall = Math.max(0, 1 - dist / 1100) ** 1.5;
  if (fall * vol < 0.03) return;
  SOUNDS[name](out(vol * fall, dx / 700), actx.currentTime + 0.005);
}

// ------------------------------------------------------------------ what a hit spills
const SPILL = {
  skeleton: '#d8d0b8', risen: '#d8d0b8', bone_king: '#d8d0b8', golem: '#8a8478', forgelord: '#8a6a58', fire_elemental: '#ff8a30', imp: '#ff7a20',
  frost_wisp: '#bfe4ff', wraith: '#4a3a5a', hollow_prince: '#4a3a5a', spider: '#7a9a30', silkweaver: '#9ab040', scorpion: '#6a8a30',
  logs: '#a07848', tripwire: '#8a7a5a', foothold: '#7a7a80', gonfalon: '#a07848', ensign: '#a07848', bonfire: '#5a4030', spinner: '#7a7a80',
};
const BLOODY = (k) => !SPILL[k];
export const spillColor = (k) => SPILL[k] || '#7a0a0a';

// ------------------------------------------------------------------ particles, decals and bodies
const parts = [], decals = [], bodies = [];
let shakeAmt = 0, hitStop = 0, flashT = 0;
// Droplets fly out along the blow, arc down and leave a splat where they land.
export function spill(x, y, ang, amount, kind, now) {
  const col = spillColor(kind), bloody = BLOODY(kind), n = Math.min(26, Math.round(5 + amount * 0.9));
  for (let i = 0; i < n; i++) {
    const a = ang + (Math.random() - 0.5) * (bloody ? 1.3 : 2.4), sp = 70 + Math.random() * 230;
    parts.push({ x, y: y + 6, z: 10 + Math.random() * 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8, vz: 60 + Math.random() * 160, r: 1.2 + Math.random() * 2.2, col, t0: now, life: 900, splat: bloody && Math.random() < 0.55 });
  }
  if (bloody) decal(x + Math.cos(ang) * 10, y + 8 + Math.sin(ang) * 8, 5 + amount * 0.35, col, now);
}
export function decal(x, y, r, col, now, pool = false) {
  const blobs = [];
  for (let i = 0; i < (pool ? 9 : 5); i++) { const a = Math.random() * 6.28, d = Math.random() * r * (pool ? 0.6 : 0.9); blobs.push([Math.cos(a) * d, Math.sin(a) * d * 0.7, r * (0.25 + Math.random() * (pool ? 0.6 : 0.45))]); }
  decals.push({ x, y, col, t0: now, life: pool ? 40000 : 25000, blobs, pool, grow: pool ? 2500 : 0 });
  if (decals.length > 350) decals.splice(0, decals.length - 350);
}
export function addBody(b, now) { b.t0 = now; bodies.push(b); if (bodies.length > 40) bodies.shift(); if (BLOODY(b.k)) decal(b.x, b.y + 4, 22, spillColor(b.k), now, true); }
export function shake(a) { shakeAmt = Math.min(14, Math.max(shakeAmt, a)); }
export function stop(ms, now) { hitStop = Math.max(hitStop, now + ms); }
export function hurtFlash(now) { flashT = now; }
export const flashAlpha = (now) => Math.max(0, 0.35 - (now - flashT) / 900);
export const stopped = (now) => now < hitStop;
// Camera offset for this frame (decays smoothly).
export function shakeOffset(dt) {
  if (shakeAmt < 0.1) return [0, 0];
  const a = shakeAmt; shakeAmt *= Math.pow(0.0015, dt);
  return [(Math.random() - 0.5) * 2 * a, (Math.random() - 0.5) * 2 * a];
}
export function stepParticles(dt, now) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= 520 * dt; p.vx *= 1 - 2.5 * dt; p.vy *= 1 - 2.5 * dt;
    if (p.z <= 0) {
      if (p.splat) decals.push({ x: p.x, y: p.y, col: p.col, t0: now, life: 20000, blobs: [[0, 0, p.r * 1.4]], pool: false, grow: 0 });
      parts.splice(i, 1); continue;
    }
    if (now - p.t0 > p.life) parts.splice(i, 1);
  }
  for (let i = decals.length - 1; i >= 0; i--) if (now - decals[i].t0 > decals[i].life) decals.splice(i, 1);
  for (let i = bodies.length - 1; i >= 0; i--) if (now - bodies[i].t0 > 9000) bodies.splice(i, 1);
}
export function drawDecals(ctx, now, x0, y0, x1, y1) {
  for (const d of decals) {
    if (d.x < x0 - 60 || d.x > x1 + 60 || d.y < y0 - 60 || d.y > y1 + 60) continue;
    const age = now - d.t0, fade = Math.min(1, (d.life - age) / 4000), grow = d.grow ? Math.min(1, 0.3 + age / d.grow) : 1;
    ctx.globalAlpha = 0.72 * fade; ctx.fillStyle = d.col;
    for (const [bx, by, br] of d.blobs) { ctx.beginPath(); ctx.ellipse(d.x + bx * grow, d.y + by * grow, br * grow, br * grow * 0.75, 0, 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}
export function drawParticles(ctx) {
  for (const p of parts) {
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.8, 0, 7); ctx.fill();
    ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y - p.z * 0.6, p.r, 0, 7); ctx.fill();
  }
}
// Bodies lie where they fell: the sprite tipped over, darkened, fading out after a few seconds.
export function drawBodies(ctx, now, x0, y0, x1, y1, spriteOf) {
  for (const b of bodies) {
    if (b.x < x0 - 80 || b.x > x1 + 80 || b.y < y0 - 80 || b.y > y1 + 80) continue;
    const age = now - b.t0, fall = Math.min(1, age / 260), alpha = Math.min(1, (9000 - age) / 2500);
    const img = spriteOf(b); if (!img) continue;
    const w = img.width / 2 * 1.3, h = img.height / 2 * 1.3;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(b.x, b.y); ctx.rotate(b.a + Math.PI + fall * 0.9);
    ctx.scale(1, 1 - 0.25 * fall);
    ctx.filter = `brightness(${1 - 0.35 * fall}) saturate(${1 - 0.4 * fall})`;
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}

// ------------------------------------------------------------------ how a weapon moves through an attack
// Returns the weapon's angle (relative to facing), how far forward it is pushed, and whether a hit is
// happening right now. t is ms since the attack began.
const ease = (q) => 1 - (1 - q) ** 3;
export const IDLE_ROT = -0.75;
export function weaponPose(tool, t) {
  if (!tool || t == null || t > 2600) return { rot: IDLE_ROT, fwd: 0 };
  const w = tool.windup || 0;
  if (tool.type === 'shoot' || tool.type === 'charge') return { rot: 0.05, fwd: tool.type === 'charge' && t > w && t < w + tool.dur ? 10 : 0 };
  if (tool.type !== 'strike') return { rot: IDLE_ROT, fwd: 0 };
  const hits = tool.hits, line = hits[0].line, arc = Math.min(6.28, ((hits[0].arc || 90) * Math.PI) / 180);
  if (t < w) { const q = t / w; return line ? { rot: 0.08, fwd: -8 * q } : { rot: IDLE_ROT - (arc / 2 + 0.3 - Math.abs(IDLE_ROT) * 0) * q * 0.9, fwd: -2 * q }; }
  // find the swing in progress (each hit is one swing; repeated hits alternate direction)
  let k = 0; for (let i = 0; i < hits.length; i++) if (t >= w + hits[i].t) k = i;
  const ht = t - w - hits[k].t, dir = k % 2 ? -1 : 1;
  if (line) {
    if (ht < 70) return { rot: 0.08, fwd: -8 + 30 * ease(ht / 70) };
    if (ht < 260) return { rot: 0.08, fwd: 22 * (1 - (ht - 70) / 190) };
    return { rot: Math.max(IDLE_ROT, 0.08 - (ht - 260) / 300), fwd: 0 };
  }
  if (arc >= 6.2) { const q = Math.min(1, ht / 340); return { rot: -0.4 + q * 6.28, fwd: 4 }; }
  const from = -dir * (arc / 2 + 0.3), to = dir * (arc / 2 + 0.15);
  if (ht < 120) return { rot: from + (to - from) * ease(ht / 120), fwd: 3 };
  if (ht < 220) return { rot: to, fwd: 2 };
  const last = k === hits.length - 1;
  if (!last) return { rot: to, fwd: 2 };
  const q = Math.min(1, (ht - 220) / 260);
  return { rot: to + (IDLE_ROT - to) * ease(q), fwd: 2 * (1 - q) };
}
