(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d'), mini = $('minimap').getContext('2d');
  const INTERP_MS = 130, TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const INK = '#16201c', REGION_TONES = ['#5b6f4e', '#66704a', '#566b50', '#6a6c47', '#4d5a4a', '#62704c', '#58704f', '#6b7049', '#5c6a4b'];
  const ARMOR_COLORS = ['#7d6a52', '#b39a6b', '#8f979a', '#c6ced0'];
  const SKIN = '#d8b48d';

  let ws = null, meta = null, bg = null, you = null, regions = [], myId = 0, joined = false;
  let snaps = new Map(), shots = [], lastSnap = 0, pred = null, fx = [], thrusts = new Map(), rocks = new Map();
  let tool = 0, armor = 0, deadShown = false, spawnWait = 0;
  const keys = new Set(), mouse = { x: 0, y: 0, down: false };
  const typing = () => $('gate').hidden === false || $('rules').open;

  function teamColor(team, light = 52) {
    let h = 0; for (const ch of team) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return `hsl(${h % 360} 62% ${light}%)`;
  }
  function mulberry(seed) { return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function resize() { const r = devicePixelRatio || 1; canvas.width = innerWidth * r; canvas.height = innerHeight * r; }
  addEventListener('resize', resize); resize();

  // Terrain is painted once into a single image, at half world resolution.
  function paintTerrain() {
    const c = document.createElement('canvas'); c.width = c.height = meta.world / 2;
    const g = c.getContext('2d'), rand = mulberry(meta.seed);
    g.scale(0.5, 0.5);
    for (let i = 0; i < 9; i++) { g.fillStyle = REGION_TONES[i]; g.fillRect(i % 3 * meta.region, Math.floor(i / 3) * meta.region, meta.region, meta.region); }
    for (let i = 0; i < 2600; i++) {
      const x = rand() * meta.world, y = rand() * meta.world, r = 20 + rand() * 90;
      g.fillStyle = ['rgba(34,50,38,.13)', 'rgba(150,140,84,.10)', 'rgba(120,88,70,.08)', 'rgba(80,110,76,.13)'][Math.floor(rand() * 4)];
      g.beginPath(); g.ellipse(x, y, r, r * (0.5 + rand() * 0.5), rand() * TAU, 0, TAU); g.fill();
    }
    g.strokeStyle = 'rgba(203,187,136,.55)'; g.lineCap = 'round'; g.lineWidth = 34;
    for (let i = 0; i < 9; i++) {
      const x = (i % 3 + 0.5) * meta.region, y = (Math.floor(i / 3) + 0.5) * meta.region;
      if (i % 3 < 2) { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + meta.region / 2, y + (rand() - 0.5) * 300, x + meta.region, y); g.stroke(); }
      if (i < 6) { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (rand() - 0.5) * 300, y + meta.region / 2, x, y + meta.region); g.stroke(); }
    }
    g.strokeStyle = 'rgba(22,32,28,.5)'; g.lineWidth = 1.6;
    for (let i = 0; i < 9000; i++) {
      const x = rand() * meta.world, y = rand() * meta.world;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - 3 + rand() * 6, y - 5 - rand() * 7); g.stroke();
    }
    g.strokeStyle = 'rgba(22,32,28,.55)'; g.lineWidth = 3; g.setLineDash([26, 20]);
    for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(i * meta.region, 0); g.lineTo(i * meta.region, meta.world); g.moveTo(0, i * meta.region); g.lineTo(meta.world, i * meta.region); g.stroke(); }
    return c;
  }

  // Tools are drawn pointing along +x from the wielder's right hand.
  function drawTool(g, id, raised) {
    const shaft = (x0, x1, col = '#6e4a2b') => { g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.moveTo(x0, 13); g.lineTo(x1, 13); g.stroke(); g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); g.moveTo(x0, 13); g.lineTo(x1, 13); g.stroke(); };
    const shape = (fill, path) => { g.fillStyle = fill; g.strokeStyle = INK; g.lineWidth = 2.5; g.beginPath(); path(); g.closePath(); g.fill(); g.stroke(); };
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (id === 'pike') { shaft(-22, 104); shape('#c9ced0', () => { g.moveTo(100, 7); g.lineTo(128, 13); g.lineTo(100, 19); }); }
    else if (id === 'billhook') { shaft(-20, 82); shape('#b9bfc1', () => { g.moveTo(78, 6); g.lineTo(106, 8); g.quadraticCurveTo(112, 24, 96, 33); g.quadraticCurveTo(98, 22, 78, 20); }); }
    else if (id === 'maul') { shaft(-18, 72); shape('#8a8d88', () => { g.rect(62, -7, 28, 40); }); }
    else if (id === 'scythe') { shaft(-24, 104); shape('#d3d7d8', () => { g.moveTo(102, 8); g.quadraticCurveTo(138, 24, 120, 74); g.quadraticCurveTo(118, 36, 96, 20); }); }
    else if (id === 'sling') { g.strokeStyle = '#a07a4c'; g.lineWidth = 3; g.beginPath(); g.moveTo(4, 13); g.quadraticCurveTo(26, 34, 44, 18); g.stroke(); shape('#7f8280', () => g.arc(44, 18, 6, 0, TAU)); }
    else if (id === 'bandage') { shape('#efe7d2', () => g.arc(10, 13, 11, 0, TAU)); g.strokeStyle = '#b23a30'; g.lineWidth = 3; g.beginPath(); g.moveTo(5, 13); g.lineTo(15, 13); g.moveTo(10, 8); g.lineTo(10, 18); g.stroke(); }
    else if (id === 'buckler') {
      const cx = raised ? 32 : 6, cy = raised ? 0 : 22, r = raised ? 25 : 17;
      shape('#7c5b34', () => g.arc(cx, cy, r, 0, TAU));
      shape('#c6ccce', () => g.arc(cx, cy, r * 0.32, 0, TAU));
    }
  }

  function paintFigure(e, now) {
    ctx.save(); ctx.translate(e.x, e.y);
    ctx.fillStyle = 'rgba(10,16,12,.32)'; ctx.beginPath(); ctx.ellipse(3, 8, e.kind === 3 ? 42 : 25, e.kind === 3 ? 34 : 20, 0, 0, TAU); ctx.fill();
    ctx.rotate(e.a);
    if (e.kind === 1) paintGhoul(now, e);
    else if (e.kind === 2) paintWolf(now, e);
    else if (e.kind === 3) paintBrute(now, e);
    else paintPerson(e, now);
    ctx.restore();
  }
  function blob(fill, x, y, rx, ry = rx) { ctx.fillStyle = fill; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
  const lunge = (e, now) => { const t = thrusts.get(e.id); if (!t) return 0; const p = (now - t) / 220; return p < 1 ? Math.sin(p * Math.PI) : 0; };

  function paintPerson(e, now) {
    const meta_tool = meta.tools[e.tool] || meta.tools[0];
    const militia = e.kind === 4, windup = e.st === 1 ? -14 : 0, thrust = lunge(e, now) * (meta_tool.arc > 0.6 ? 0 : 34);
    const sweep = meta_tool.arc > 0.6 ? lunge(e, now) * meta_tool.arc * 1.6 - meta_tool.arc * 0.8 * Math.sign(lunge(e, now)) : 0;
    ctx.save(); ctx.rotate(sweep); ctx.translate(windup + thrust, 0);
    if (militia) drawTool(ctx, 'pike', false); else if (meta_tool.id !== 'buckler') drawTool(ctx, meta_tool.id, false);
    ctx.restore();
    if (!militia && meta_tool.id === 'buckler') drawTool(ctx, 'buckler', e.st === 2);
    const coat = militia ? '#6a7680' : ARMOR_COLORS[e.armor] || ARMOR_COLORS[0];
    blob(coat, 0, 0, 16, 25);
    if (e.team) { ctx.fillStyle = teamColor(e.team); ctx.fillRect(-5, -17, 10, 34); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.strokeRect(-5, -17, 10, 34); }
    blob(SKIN, 13, 16, 6); blob(SKIN, 13, -16, 6);
    blob(militia ? '#4d5860' : e.armor >= 2 ? '#a7afb2' : '#5a4632', 1, 0, 11);
    if (e.st === 3) { ctx.strokeStyle = '#efe7d2'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 32, now / 180, now / 180 + 4); ctx.stroke(); }
  }
  function paintGhoul(now, e) {
    const claw = e.st === 1 ? 7 : lunge(e, now) * 12;
    blob('#8d9a8a', 0, 0, 14, 19);
    blob('#6d786b', 12 + claw, 14, 5); blob('#6d786b', 12 + claw, -14, 5);
    blob('#a9b3a0', 6, 0, 10);
    ctx.fillStyle = '#d9483a'; ctx.beginPath(); ctx.arc(11, 4, 1.9, 0, TAU); ctx.arc(11, -4, 1.9, 0, TAU); ctx.fill();
  }
  function paintWolf(now, e) {
    const snap = lunge(e, now) * 12;
    blob('#4e5258', -14, 0, 20, 12);
    blob('#5e6369', 4 + snap, 0, 11, 11);
    ctx.fillStyle = '#3c4045'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(10 + snap, -7); ctx.lineTo(28 + snap, 0); ctx.lineTo(10 + snap, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-33, 0); ctx.lineTo(-52, Math.sin(now / 90) * 6); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke();
    ctx.fillStyle = '#e8c35a'; ctx.beginPath(); ctx.arc(10 + snap, 4, 1.7, 0, TAU); ctx.arc(10 + snap, -4, 1.7, 0, TAU); ctx.fill();
  }
  function paintBrute(now, e) {
    const swing = e.st === 1 ? -0.7 : lunge(e, now) * 1.2;
    ctx.save(); ctx.rotate(swing); ctx.strokeStyle = INK; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(10, 28); ctx.lineTo(82, 18); ctx.stroke(); ctx.strokeStyle = '#5c4630'; ctx.lineWidth = 7; ctx.stroke(); blob('#6d6a5f', 86, 18, 16); ctx.restore();
    blob('#7a6b58', 0, 0, 27, 37);
    blob('#8d7a64', 20, 30, 11); blob('#8d7a64', 20, -30, 11);
    blob('#938067', 8, 0, 17);
    ctx.strokeStyle = '#e8dfc6'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(20, -9); ctx.lineTo(29, -13); ctx.moveTo(20, 9); ctx.lineTo(29, 13); ctx.stroke();
  }

  function paintStone(r, state, now) {
    const col = state[0] ? teamColor(state[0]) : '#d7ccaa';
    ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.setLineDash([18, 14]); ctx.lineDashOffset = -now / 80; ctx.globalAlpha = .75;
    ctx.beginPath(); ctx.arc(r.x, r.y, meta.stone, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    if (state[3] > 0) { ctx.strokeStyle = teamColor(state[2], 62); ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(r.x, r.y, meta.stone - 16, -Math.PI / 2, -Math.PI / 2 + TAU * state[3]); ctx.stroke(); }
    ctx.fillStyle = 'rgba(10,16,12,.35)'; ctx.beginPath(); ctx.ellipse(r.x + 8, r.y + 24, 46, 16, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#7b7f7c'; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath();
    ctx.moveTo(r.x - 34, r.y + 24); ctx.lineTo(r.x - 26, r.y - 56); ctx.lineTo(r.x + 8, r.y - 74); ctx.lineTo(r.x + 32, r.y - 44); ctx.lineTo(r.x + 36, r.y + 24); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(r.x - 10, r.y - 34); ctx.lineTo(r.x, r.y - 8); ctx.lineTo(r.x + 10, r.y - 34); ctx.stroke();
    if (state[1]) label(state[1], r.x, r.y - 90, '#f0e6cb', 20);
  }
  function label(text, x, y, color = '#f0e6cb', size = 15) {
    ctx.font = `${size}px "Iowan Old Style","Palatino Linotype",Georgia,serif`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(16,22,18,.9)'; ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y); ctx.fillStyle = color; ctx.fillText(text, x, y);
  }

  function rockShape(o) {
    if (!rocks.has(o)) { const rand = mulberry(o.x * 7 + o.y), pts = []; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r = o.r * (0.82 + rand() * 0.3); pts.push([Math.cos(a) * r, Math.sin(a) * r]); } rocks.set(o, pts); }
    return rocks.get(o);
  }
  function paintObstacle(o) {
    ctx.save(); ctx.translate(o.x, o.y);
    ctx.fillStyle = 'rgba(10,16,12,.3)'; ctx.beginPath(); ctx.ellipse(6, 10, o.r * 1.1, o.r * 0.95, 0, 0, TAU); ctx.fill();
    if (o.k === 'tree') {
      blob('#2f4a35', 0, 0, o.r * 1.2);
      ctx.lineWidth = 0;
      for (const [x, y, s, c] of [[-.45, -.3, .7, '#3b5a3f'], [.4, -.4, .62, '#44664a'], [.1, .45, .66, '#37553c'], [-.1, -.05, .5, '#507555']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x * o.r, y * o.r, s * o.r, 0, TAU); ctx.fill(); }
    } else {
      const pts = rockShape(o);
      ctx.fillStyle = '#6f7472'; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(214,214,204,.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-o.r * .45, -o.r * .3); ctx.lineTo(0, -o.r * .55); ctx.lineTo(o.r * .4, -o.r * .2); ctx.stroke();
    }
    ctx.restore();
  }

  function sampled(now) {
    const out = [], renderAt = now - INTERP_MS;
    for (const s of snaps.values()) {
      if (now - s.seen > 400) continue;
      const span = s.next.at - s.prev.at, p = span > 0 ? clamp((renderAt - s.prev.at) / span, 0, 1) : 1;
      let da = s.next.a - s.prev.a; if (da > Math.PI) da -= TAU; if (da < -Math.PI) da += TAU;
      out.push({ ...s.next, x: s.prev.x + (s.next.x - s.prev.x) * p, y: s.prev.y + (s.next.y - s.prev.y) * p, a: s.prev.a + da * p });
    }
    return out;
  }

  function predict(dt) {
    if (!you || you.dead) return;
    let mx = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0), my = (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0);
    const len = Math.hypot(mx, my); if (len > 1) { mx /= len; my /= len; }
    pred.x += mx * you.speed * dt; pred.y += my * you.speed * dt;
    for (const o of meta.obstacles) { const dx = pred.x - o.x, dy = pred.y - o.y, d = Math.hypot(dx, dy), min = o.r + 22; if (d < min && d > 0.01) { pred.x = o.x + dx / d * min; pred.y = o.y + dy / d * min; } }
    const err = Math.hypot(you.x - pred.x, you.y - pred.y);
    if (err > 180) { pred.x = you.x; pred.y = you.y; }
    else { const k = Math.min(1, dt * 7); pred.x += (you.x - pred.x) * k; pred.y += (you.y - pred.y) * k; }
  }

  let lastFrame = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - lastFrame) / 1000); lastFrame = now;
    const dpr = devicePixelRatio || 1, w = innerWidth, h = innerHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#1c2622'; ctx.fillRect(0, 0, w, h);
    if (!meta) return;
    predict(dt);
    const scale = Math.max(w / 1600, h / 900);
    const cx = pred ? pred.x : meta.world / 2, cy = pred ? pred.y : meta.world / 2;
    const halfW = w / 2 / scale + 120, halfH = h / 2 / scale + 120;
    const inView = (x, y, pad = 0) => Math.abs(x - cx) < halfW + pad && Math.abs(y - cy) < halfH + pad;
    ctx.translate(w / 2, h / 2); ctx.scale(scale, scale); ctx.translate(-cx, -cy);
    ctx.drawImage(bg, 0, 0, meta.world, meta.world);
    regions.forEach((state, i) => { const r = { x: (i % 3 + 0.5) * meta.region, y: (Math.floor(i / 3) + 0.5) * meta.region }; if (inView(r.x, r.y, 220)) paintStone(r, state, now); });
    const list = sampled(now), me = list.find(e => e.id === myId);
    if (me && pred) { me.x = pred.x; me.y = pred.y; me.a = Math.atan2(mouse.y - h / 2, mouse.x - w / 2); }
    list.sort((a, b) => a.y - b.y);
    for (const o of meta.obstacles) if (inView(o.x, o.y, 90)) paintObstacle(o);
    for (const e of list) if (inView(e.x, e.y, 80)) { if (e.shield) ctx.globalAlpha = .55 + .25 * Math.sin(now / 90); paintFigure(e, now); ctx.globalAlpha = 1; }
    const age = (now - lastSnap) / 1000;
    for (const s of shots) { ctx.fillStyle = '#c2c5c0'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(s[1] + s[3] * age, s[2] + s[4] * age, 6, 0, TAU); ctx.fill(); ctx.stroke(); }
    for (const e of list) {
      if (!inView(e.x, e.y, 60) || (e.kind !== 0 && e.kind !== 4 && e.hp >= 100)) continue;
      const top = e.y - (e.kind === 3 ? 58 : 42);
      if (e.kind === 0) label((e.band ? `[${e.band}] ` : '') + e.name, e.x, top - 11, e.id === myId ? '#f4c98f' : '#f0e6cb');
      if (e.kind === 0 && e.renown >= 100 && e.id !== myId) label(`bounty ${12 + Math.floor(e.renown / 4)}`, e.x, top - 30, '#e39a5e', 13);
      if (e.hp < 100 || e.kind === 4) { ctx.fillStyle = 'rgba(16,22,18,.85)'; ctx.fillRect(e.x - 26, top - 5, 52, 7); ctx.fillStyle = e.id === myId ? '#d9793a' : '#b23a30'; ctx.fillRect(e.x - 25, top - 4, 50 * e.hp / 100, 5); }
    }
    paintEffects(now);
    drawMinimap();
    updateCooldowns();
  }

  function paintEffects(now) {
    fx = fx.filter(f => now - f.at < f.life);
    for (const f of fx) {
      const p = (now - f.at) / f.life;
      ctx.globalAlpha = 1 - p;
      if (f.k === 'strike') { ctx.strokeStyle = '#f2ead2'; ctx.lineWidth = 7 * (1 - p) + 1; ctx.beginPath(); ctx.arc(f.x, f.y, f.reach * (0.82 + p * 0.18), f.a - f.arc, f.a + f.arc); ctx.stroke(); }
      else if (f.k === 'text') label(f.text, f.x, f.y - p * 46, f.color, f.size);
      else if (f.k === 'burst') { ctx.fillStyle = f.color; for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + f.x, d = 14 + p * 44; ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 5 * (1 - p), 0, TAU); ctx.fill(); } }
      ctx.globalAlpha = 1;
    }
  }

  function drawMinimap() {
    const g = mini, S = 168, cell = S / 3;
    g.clearRect(0, 0, S, S);
    regions.forEach((r, i) => {
      const x = i % 3 * cell, y = Math.floor(i / 3) * cell;
      g.fillStyle = r[0] ? teamColor(r[0], 38) : 'rgba(95,110,80,.55)'; g.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      g.fillStyle = '#e9dfc4'; g.beginPath(); g.arc(x + cell / 2, y + cell / 2, 3.5, 0, TAU); g.fill();
      if (r[3] > 0) { g.strokeStyle = teamColor(r[2], 66); g.lineWidth = 2; g.beginPath(); g.arc(x + cell / 2, y + cell / 2, 9, -Math.PI / 2, -Math.PI / 2 + TAU * r[3]); g.stroke(); }
    });
    if (you && pred) { g.fillStyle = '#f4a64f'; g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.arc(pred.x / meta.world * S, pred.y / meta.world * S, 4.5, 0, TAU); g.fill(); g.stroke(); }
  }

  function buildBar() {
    const bar = $('bar'); bar.textContent = '';
    meta.tools.forEach((t, i) => {
      const b = document.createElement('button'); b.className = 'slot'; b.type = 'button'; b.title = t.name; b.dataset.i = i;
      const c = document.createElement('canvas'); c.width = c.height = 132;
      const g = c.getContext('2d'); g.translate(66, 66); if (t.id !== 'bandage') g.rotate(-Math.PI / 4);
      const scale = t.id === 'bandage' || t.id === 'buckler' ? 2.2 : t.id === 'sling' ? 1.5 : 0.82;
      g.scale(scale, scale); g.translate(t.id === 'bandage' ? -10 : t.id === 'buckler' ? -6 : t.id === 'sling' ? -24 : -50, t.id === 'buckler' ? -22 : -13);
      drawTool(g, t.id, false);
      const n = document.createElement('b'); n.textContent = i + 1;
      const lock = document.createElement('small'); lock.textContent = t.renown ? String(t.renown) : '';
      const shade = document.createElement('u');
      b.append(c, n, lock, shade); bar.append(b);
      b.addEventListener('click', e => { e.stopPropagation(); pickTool(i); });
    });
  }
  function pickTool(i) { if (you && you.renown >= meta.tools[i].renown) tool = i; }
  function cycleArmor() {
    if (!you || you.combat) return;
    for (let n = 1; n <= meta.armors.length; n++) { const i = (armor + n) % meta.armors.length; if (you.renown >= meta.armors[i].renown) { armor = i; sendInput({ armor: i }); return; } }
  }
  function updateCooldowns() {
    if (!you) return;
    document.querySelectorAll('.slot').forEach((b, i) => {
      const t = meta.tools[i], shade = b.lastElementChild;
      const left = t.kind === 'heal' ? you.healCool / 12 : (i === you.tool && t.cool ? you.cool / t.cool : 0);
      shade.style.height = `${clamp(left, 0, 1) * 100}%`; shade.style.top = 'auto';
    });
  }

  function hudFromSnapshot(s) {
    const y = s.you, prevRenown = you ? you.renown : y.renown;
    you = y; tool = y.tool === tool || y.renown >= meta.tools[tool].renown ? tool : y.tool; armor = y.armor;
    $('hp').style.width = `${y.hp / y.maxHp * 100}%`; $('hp-text').textContent = `${y.hp} / ${y.maxHp}`;
    $('renown').textContent = `${y.renown} renown`;
    $('armor').textContent = `Q: ${meta.armors[y.armor].name}`;
    $('armor').style.opacity = y.combat ? .55 : 1;
    document.querySelectorAll('.slot').forEach((b, i) => { b.classList.toggle('on', i === y.tool); const open = y.renown >= meta.tools[i].renown; b.classList.toggle('locked', !open); b.children[2].hidden = open; });
    const board = $('board'); board.textContent = '';
    const h = document.createElement('h2'); h.textContent = 'Most renowned'; board.append(h);
    for (const [name, band, renown] of s.b) { const d = document.createElement('div'), a = document.createElement('span'), b = document.createElement('span'); a.textContent = (band ? `[${band}] ` : '') + name; b.textContent = renown; d.append(a, b); board.append(d); }
    const i = Math.min(2, Math.floor(y.y / meta.region)) * 3 + Math.min(2, Math.floor(y.x / meta.region)), r = regions[i], claim = $('claim');
    const near = r && Math.hypot(y.x - (i % 3 + 0.5) * meta.region, y.y - (Math.floor(i / 3) + 0.5) * meta.region) <= meta.stone;
    claim.hidden = !near;
    if (near) { claim.textContent = r[3] > 0 ? 'Claiming this stone' : r[1] ? `Held by ${r[1]}` : 'Unclaimed stone'; if (r[3] > 0) { const bar = document.createElement('i'); bar.style.width = `${r[3] * 100}%`; claim.append(bar); } }
    if (y.renown > prevRenown && pred) fx.push({ k: 'text', text: `+${y.renown - prevRenown} renown`, x: pred.x, y: pred.y - 60, color: '#f4c98f', size: 19, at: performance.now(), life: 1100 });
    if (y.dead && !deadShown) { deadShown = true; showDeath(y); }
    if (!y.dead && deadShown) { deadShown = false; pred = { x: y.x, y: y.y }; $('gate').hidden = true; }
  }

  function showDeath(y) {
    $('gate-title').textContent = 'You fell';
    $('gate-text').textContent = `Slain by ${y.killer || 'the moor'}. You keep ${y.renown} renown.`;
    $('gate-fields').hidden = true; $('go').textContent = 'Rise again'; $('go').disabled = true;
    $('gate').hidden = false; keys.clear(); mouse.down = false;
    clearTimeout(spawnWait); spawnWait = setTimeout(() => { $('go').disabled = false; $('go').focus(); }, 2100);
  }

  function feedLine(text) { const d = document.createElement('div'); d.textContent = text; $('feed').prepend(d); while ($('feed').children.length > 5) $('feed').lastChild.remove(); setTimeout(() => d.remove(), 8000); }

  function receive(s) {
    const now = performance.now();
    regions = s.r; shots = s.p; lastSnap = now;
    const seen = new Set();
    for (const a of s.e) {
      const cur = { id: a[0], kind: a[1], x: a[2], y: a[3], a: a[4], hp: a[5], tool: a[6], st: a[7], renown: a[8], name: a[9], band: a[10], team: a[11], armor: a[12], shield: a[13], at: now };
      const old = snaps.get(cur.id); seen.add(cur.id);
      snaps.set(cur.id, old ? { prev: old.next, next: cur, seen: now } : { prev: cur, next: cur, seen: now });
    }
    for (const id of snaps.keys()) if (!seen.has(id)) snaps.delete(id);
    if (!pred) pred = { x: s.you.x, y: s.you.y };
    hudFromSnapshot(s);
    for (const ev of s.ev) {
      if (ev.k === 'strike') { thrusts.set(ev.id, now); fx.push({ ...ev, at: now, life: 170 }); }
      else if (ev.k === 'hit') fx.push({ k: 'text', text: ev.blocked ? `blocked ${ev.v}` : String(ev.v), x: ev.x, y: ev.y - 30, color: ev.blocked ? '#cfd6d8' : '#ffb59d', size: 18, at: now, life: 620 });
      else if (ev.k === 'die') fx.push({ k: 'burst', x: ev.x, y: ev.y, color: ev.c ? '#59625a' : '#a33a30', at: now, life: 520 });
      else if (ev.k === 'heal') fx.push({ k: 'text', text: 'patched up', x: ev.x, y: ev.y - 40, color: '#efe7d2', size: 17, at: now, life: 900 });
      else if (ev.k === 'feed') feedLine(`${ev.a} slew ${ev.b}`);
      else if (ev.k === 'capture') feedLine(`${ev.a} claimed a stone`);
    }
  }

  function sendInput(extra) {
    if (!ws || ws.readyState !== 1 || !you) return;
    const w = innerWidth, h = innerHeight, playing = !typing();
    ws.send(JSON.stringify({ t: 'i', mx: playing ? (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0) : 0, my: playing ? (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0) : 0, a: Math.atan2(mouse.y - h / 2, mouse.x - w / 2), f: playing && mouse.down, tool, ...extra }));
  }
  setInterval(sendInput, 50);

  function showError(text) { const e = $('gate-error'); e.textContent = text; e.hidden = !text; }
  function connect() {
    $('go').disabled = true; showError('');
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/wardmoor/ws`);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', name: $('name').value, band: $('band').value }));
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.t === 'w') {
        meta = m; myId = m.id; bg = paintTerrain(); buildBar(); joined = true;
        try { localStorage.setItem('wardmoor-name', $('name').value); } catch {}
        $('gate').hidden = true; $('hud').hidden = false; $('go').disabled = false;
      } else if (m.t === 's' && meta) receive(m);
      else if (m.t === 'err') { showError(m.message); $('go').disabled = false; if (!joined) ws.close(); }
    };
    ws.onclose = () => {
      if (!joined) { $('go').disabled = false; if (!$('gate-error').textContent) showError('Could not reach the moor. Try again.'); return; }
      joined = false; you = null; pred = null; meta = null; snaps.clear(); regions = [];
      $('hud').hidden = true; $('gate').hidden = false; $('gate-fields').hidden = false;
      $('gate-title').textContent = 'Connection lost'; $('gate-text').textContent = 'The world is still out there. Walk back in.'; $('go').textContent = 'Walk the moor'; $('go').disabled = false;
    };
  }

  $('gate-form').addEventListener('submit', e => {
    e.preventDefault();
    if (joined && ws?.readyState === 1) ws.send(JSON.stringify({ t: 'spawn' }));
    else connect();
  });
  $('rules-close').addEventListener('click', () => $('rules').close());
  $('armor').addEventListener('click', e => { e.stopPropagation(); cycleArmor(); });
  const KEY_MAP = { arrowup: 'w', arrowdown: 's', arrowleft: 'a', arrowright: 'd' };
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && joined && $('gate').hidden) { e.preventDefault(); if ($('rules').open) $('rules').close(); else $('rules').showModal(); return; }
    if (typing()) return;
    const k = KEY_MAP[e.key.toLowerCase()] || e.key.toLowerCase();
    if ('wasd'.includes(k) && k.length === 1) { keys.add(k); e.preventDefault(); }
    else if (k === 'q' && !e.repeat) cycleArmor();
    else if (/^[1-7]$/.test(k)) pickTool(Number(k) - 1);
  });
  addEventListener('keyup', e => keys.delete(KEY_MAP[e.key.toLowerCase()] || e.key.toLowerCase()));
  addEventListener('blur', () => { keys.clear(); mouse.down = false; });
  addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  canvas.addEventListener('mousedown', e => { if (e.button === 0) mouse.down = true; });
  addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  try { $('name').value = localStorage.getItem('wardmoor-name') || ''; } catch {}
  requestAnimationFrame(frame);
})();
