// Hanbin Island browser client: sign-in, rendering, HUD and input.
import {
  WORLD, REGIONS, CASTLES, VILLAGE, SKILLS, SKILL_LIST, TREES, MOBS, RANKS, ROADS, LAND_GRID, REGION_GRID, GW, GH, RC,
  rankOf, somaForTier, regionAt, moveBody, landValue, roadDist, propsIn, rng, rankBonus, RECALL_RANK, TRAVEL_RANK, COMBOS,
  CASTLE_TYPES, DUNGEONS, CAVES, DGRID, DT_SIZE, RELICS, RARITIES, CRATES, SYNERGIES, ELITE_AFFIXES, CASTLE_LEVEL_COST, MAX_RELIC_LV, MAX_STASH, relicText, dungeonAt,
} from './shared.mjs';
import { BIOME_RGB, chunkPixels } from './terrain.mjs';
import { creature, playerLook, banner, prop, castleBase, castleTop, castleSize, caveSprite, portalSprite, villageBase, villageTop, VILLAGE_SPRITE_SIZE } from './sprites.mjs';

const { W: WW, H: WORLD_H, IH: WH } = WORLD;
const $ = (id) => document.getElementById(id);
const cv = $('game'), ctx = cv.getContext('2d');
const mini = $('mini'), mctx = mini.getContext('2d');
let VW = innerWidth, VH = innerHeight, DPR = 1, zoom = 1;
function resize() {
  DPR = Math.min(1.5, devicePixelRatio || 1); VW = innerWidth; VH = innerHeight;
  cv.width = VW * DPR; cv.height = VH * DPR; cv.style.width = VW + 'px'; cv.style.height = VH + 'px';
  zoom = Math.max(0.55, Math.min(1.6, Math.min(VW / 1500, VH / 840)));
  vignette = null;
}
let vignette = null, vignetteHurt = false;
// The edge shading is drawn once per size into its own canvas instead of every frame.
function getVignette(hurt) {
  if (vignette && vignetteHurt === hurt) return vignette;
  const c = document.createElement('canvas'); c.width = Math.ceil(VW / 2); c.height = Math.ceil(VH / 2);
  const x = c.getContext('2d'), w = c.width, h = c.height;
  const g = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, hurt ? 'rgba(130,0,0,.45)' : 'rgba(0,0,0,.35)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  vignette = c; vignetteHurt = hurt;
  return c;
}
addEventListener('resize', resize); resize();

const BIOME_NAME = { grass: 'Meadows', forest: 'Forest', darkforest: 'Deep forest', snow: 'Tundra', rock: 'Highlands', ash: 'Ashlands', swamp: 'Marsh', desert: 'Dunes', heath: 'Heath' };
const STATUS = [[1, '💫', 'Stunned'], [4, '🐌', 'Slowed'], [8, '📉', 'Weakened'], [16, '⬆️', 'Rallied'], [32, '🛡️', 'Shielded'], [128, '🌿', 'Regenerating']];
const TALL = new Set(['tree', 'pine', 'dead', 'cactus']);

// ------------------------------------------------------------------ state
let ws = null, myId = null, started = false, chatOpen = false, connected = false;
const me = { x: VILLAGE.x, y: VILLAGE.y, sx: 0, sy: 0, h: 100, mh: 100, en: 100, me: 100, v: 0, s: 0, sp: 190, fl: 0, dead: 0, rs: 0, cz: -1, cp: 0, cdf: 0, ph: 0, init: false };
let prof = { skills: [], hotbar: [], pts: 0, slots: 5, tier: 0, fac: 0, name: '' };
const ents = new Map();
let projs = [], zones = [], fxs = [], floaters = [];
let meta = { c: [], f: [], lb: [], on: 0, bosses: [] };
const facInfo = new Map(), owners = new Map(), levels = new Map();
let loot = [];
const cdReady = {};
let slotSel = -1, seq = 0, lastDeath = null;
const keys = {}, held = new Set();
let mouseX = VW / 2, mouseY = VH / 2;
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } } };

// ------------------------------------------------------------------ sign-in
let authMode = 'login';
function showLogin(msg) {
  $('login').style.display = 'flex';
  const user = store.get('hanbin_user'), session = store.get('hanbin_session');
  $('resume').style.display = session && user ? 'block' : 'none';
  $('authform').style.display = session && user ? 'none' : 'block';
  $('resumeName').textContent = user || '';
  $('loginmsg').textContent = msg || '';
}
function setMode(m) {
  authMode = m;
  $('tabLogin').classList.toggle('on', m === 'login'); $('tabRegister').classList.toggle('on', m === 'register');
  $('authBtn').textContent = m === 'login' ? 'Sign in' : 'Create account';
  $('passIn').autocomplete = m === 'login' ? 'current-password' : 'new-password';
  $('loginmsg').textContent = '';
}
$('tabLogin').onclick = () => setMode('login');
$('tabRegister').onclick = () => setMode('register');
$('switchBtn').onclick = () => { store.set('hanbin_session', null); showLogin(); setMode('login'); };
$('resumeBtn').onclick = () => connect();
$('authform').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('authBtn'); btn.disabled = true; $('loginmsg').textContent = '';
  try {
    const r = await fetch(`/eldyn/api/${authMode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: $('userIn').value, password: $('passIn').value }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Something went wrong.');
    store.set('hanbin_session', j.session); store.set('hanbin_user', j.username);
    $('passIn').value = '';
    connect();
  } catch (err) { $('loginmsg').textContent = err.message; }
  finally { btn.disabled = false; }
});

// ------------------------------------------------------------------ networking
const send = (o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
function connect() {
  const session = store.get('hanbin_session');
  if (!session) return showLogin();
  $('loginmsg').textContent = 'Connecting...';
  if (ws) { ws.onclose = null; ws.close(); }
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/eldyn/ws');
  let kicked = null;
  ws.onopen = () => send({ t: 'join', session });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.t === 'auth') { store.set('hanbin_session', null); kicked = 'Your session expired. Please sign in again.'; return; }
    if (m.t === 'kicked') { kicked = m.m; return; }
    handle(m);
  };
  ws.onclose = () => {
    connected = false;
    showLogin(kicked || (started ? 'Disconnected from the server.' : 'Could not connect to the server.'));
  };
}
function handle(m) {
  switch (m.t) {
    case 's': onSnap(m); break;
    case 'welcome': myId = m.id; connected = true; me.init = false; ents.clear(); $('login').style.display = 'none'; if (!started) { started = true; requestAnimationFrame(frame); } break;
    case 'prof': prof = m; buildHotbar(); buildPassives(); if (panelOpen('skills')) renderSkills(); if (panelOpen('factions')) renderFactions(); if (panelOpen('inv')) renderInv(); break;
    case 'meta': {
      meta = m; facInfo.clear(); m.f.forEach((f) => facInfo.set(f.id, f));
      let changed = false;
      for (const [id, o, lv] of m.c) { levels.set(id, lv); if (owners.get(id) !== o) { owners.set(id, o); changed = true; } }
      if (changed) miniDirty = true;
      if (panelOpen('factions')) renderFactions(); if (panelOpen('board')) renderBoard();
      break;
    }
    case 'chat': { const f = facInfo.get(m.f); addChat(m.sc === 'f' ? `[Faction] ${m.n}: ${m.m}` : `${f ? '[' + f.name + '] ' : ''}${m.n}: ${m.m}`, m.sc === 'f' ? '#7fd0ff' : (f ? f.color : '#eadfc4')); break; }
    case 'msg': addChat(m.m, m.c || '#cdbf9a'); break;
    case 'toast': toast(m.m); break;
    case 'err': toast(m.m); addChat(m.m, '#f08070'); break;
    case 'relic': { const r = RELICS[m.r.k], rar = RARITIES[r.rarity]; toast(`${r.icon} ${rar.name} relic: ${r.name}${m.from && m.from !== 'loot' ? ' (from ' + m.from + ')' : ''}`); addChat(`You found ${r.name} (${rar.name}).`, rar.color); if (panelOpen('inv')) renderInv(); break; }
    case 'gain': { const ex = []; if (m.v) ex.push('+' + m.v + ' valor'); if (m.s) ex.push('+' + m.s + ' soma'); if (m.g) ex.push('+' + m.g + ' gold'); if (ex.length) floaters.push({ x: me.x, y: me.y - 34 - Math.random() * 14, txt: ex.join('  '), c: '#d8b4ff', t0: performance.now(), life: 1400 }); break; }
    case 'died': lastDeath = m; break;
  }
}
function onSnap(m) {
  const prevH = me.h;
  // Your own position is predicted locally; only take the server's after a forced move (dash, knockback,
  // teleport, respawn) or if the two have drifted far apart.
  const { x, y, ...rest } = m.me;
  Object.assign(me, rest);
  me.sx = x; me.sy = y;
  if (!me.init || m.me.tp !== me.tpSeen || Math.hypot(x - me.x, y - me.y) > 220) { me.x = x; me.y = y; me.init = true; me.tpSeen = m.me.tp; }
  if (me.h < prevH) me.flash = performance.now();
  for (const [id, c] of m.me.cd) cdReady[id] = performance.now() + c;
  seq++;
  const now = performance.now();
  for (const e of m.e) {
    let o = ents.get(e.i);
    if (!o) { o = { x: e.x, y: e.y, ph: Math.random() * 6, h: e.h, buf: [] }; ents.set(e.i, o); }
    if (e.h < o.h) o.flash = now;
    o.buf.push([now, e.x, e.y]); if (o.buf.length > 8) o.buf.shift();
    o.k = e.k; o.a = e.a; o.h = e.h; o.m = e.m; o.fl = e.fl; o.n = e.n; o.f = e.f; o.rk = e.rk; o.ow = e.ow; o.wp = e.wp; o.at = e.at; o.sp = e.sp; o.el = e.el; o.enr = e.en; o.seq = seq; o.id = e.i;
  }
  for (const [id, o] of ents) if (o.seq !== seq) ents.delete(id);
  projs = m.pr; zones = m.zs; loot = m.lt || [];
  for (const f of m.fx) {
    if (f.t === 'dmg') floaters.push({ x: f.x + (Math.random() * 14 - 7), y: f.y, txt: String(f.v), c: f.c ? '#ffe040' : '#ffd0c0', t0: now, life: f.c ? 1000 : 800, big: f.c });
    else if (f.t === 'heal') floaters.push({ x: f.x, y: f.y, txt: '+' + f.v, c: '#8fe8a0', t0: now, life: 900 });
    else if (f.t === 'combo') floaters.push({ x: f.x, y: f.y, txt: f.txt + '!', c: '#ffe066', t0: now, life: 1100, big: 1 });
    else { f.t0 = now; f.seed = Math.random() * 1000; fxs.push(f); }
  }
}

// ------------------------------------------------------------------ hotbar / HUD
function buildHotbar() {
  const hb = $('hotbar'); hb.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const d = document.createElement('div');
    const locked = i >= prof.slots, id = prof.hotbar[i], sk = id && SKILLS[id];
    d.className = 'slot' + (locked ? ' locked' : '') + (i === slotSel ? ' sel' : '');
    if (sk) d.style.setProperty('--tc', TREES.find((t) => t.id === sk.tree).color);
    d.innerHTML = `<span class="key">${keyName(binds['slot' + i])}</span><div class="ico">${locked ? '' : (sk ? sk.icon : '')}</div><div class="cd"></div><span class="cdt"></span>${sk && sk.en ? `<span class="en">${sk.en}</span>` : ''}${locked ? `<div class="lk">🔒<br>T${(i - 4) * 5}</div>` : ''}`;
    d.title = locked ? `Unlocks at soma tier ${(i - 4) * 5}` : sk ? `${sk.name}: ${sk.desc}\n${sk.en} energy · ${sk.cd / 1000}s cooldown\nRight-click to clear` : 'Empty slot. Click it, then click a learned skill in the skill tree (K).';
    d.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      if (locked) return;
      if (e.button === 2) { send({ t: 'hb', s: i, id: null }); return; }
      slotSel = slotSel === i ? -1 : i; buildHotbar();
      if (slotSel >= 0 && !panelOpen('skills')) togglePanel('skills');
    });
    d.addEventListener('contextmenu', (e) => e.preventDefault());
    hb.appendChild(d);
  }
}
function buildPassives() {
  const box = $('passives'); box.innerHTML = '';
  for (const id of prof.skills) { const sk = SKILLS[id]; if (!sk.passive) continue; const d = document.createElement('span'); d.textContent = sk.icon; d.title = `${sk.name}: ${sk.desc}`; box.appendChild(d); }
}
function updateHud() {
  const r = rankOf(me.v);
  $('pname').textContent = prof.name || '';
  $('prank').textContent = r.name;
  $('valbar').style.width = (r.next ? (me.v - r.cur) / (r.next - r.cur) : 1) * 100 + '%';
  $('valtxt').textContent = `Valor ${me.v}${r.next ? ' / ' + r.next : ' (max)'}`;
  const t = prof.tier, a = somaForTier(t), b = somaForTier(t + 1);
  $('somabar').style.width = ((me.s - a) / (b - a)) * 100 + '%';
  $('somatxt').textContent = `Soma tier ${t} · ${me.s} / ${b}`;
  $('ptsrow').textContent = prof.pts > 0 ? `★ ${prof.pts} skill point${prof.pts > 1 ? 's' : ''} to spend (K)` : '';
  $('goldrow').innerHTML = `🪙 <b>${me.b || 0}</b> banked${me.g ? ` · <span class="carry">${me.g} carried (bank it in the Haven or your castle)</span>` : ''}`;
  const f = facInfo.get(prof.fac);
  $('facrow').textContent = f ? `⚑ ${f.name}` : 'No faction (F)';
  $('facrow').style.color = f ? f.color : '#a99';
  $('hpbar').style.width = (me.h / me.mh) * 100 + '%'; $('hptxt').textContent = `${me.h} / ${me.mh}`;
  $('enbar').style.width = (me.en / me.me) * 100 + '%'; $('entxt').textContent = `Energy ${me.en} / ${me.me}`;
  const now = performance.now(), slots = $('hotbar').children;
  for (let i = 0; i < slots.length; i++) {
    const id = prof.hotbar[i], sk = id && SKILLS[id], cdEl = slots[i].querySelector('.cd'), cdt = slots[i].querySelector('.cdt');
    if (!sk) { cdEl.style.height = '0'; cdt.textContent = ''; continue; }
    const rem = (cdReady[id] || 0) - now;
    cdEl.style.height = rem > 0 ? Math.min(100, (rem / sk.cd) * 100) + '%' : '0';
    cdt.textContent = rem > 1000 ? Math.ceil(rem / 1000) : '';
    slots[i].classList.toggle('noen', me.en < sk.en);
  }
  const ri = regionAt(me.x, me.y), reg = REGIONS[ri], own = owners.get(ri), of = own && facInfo.get(own);
  const dg = reg.dungeon !== undefined ? DUNGEONS[reg.dungeon] : null, bossWait = dg && meta.bosses ? meta.bosses[dg.id] : 0;
  $('regionlbl').innerHTML = dg ? `<b>${reg.name}</b> <span class="dim">· dungeon · danger ${'◆'.repeat(reg.danger)}</span><br><span class="dim">${bossWait ? 'Boss returns in ' + Math.ceil(bossWait / 60000) + ' min' : 'The boss waits in the deepest room'}</span>`
    : `<b>${reg.name}</b> <span class="dim">· ${BIOME_NAME[reg.biome]}${reg.danger ? ' · danger ' + '◆'.repeat(reg.danger) : ' · safe haven'}</span>${of ? `<br><span style="color:${of.color}">Held by ${esc(of.name)}</span>` : ''}<br><span class="dim">${meta.on} online</span>`;
  const cap = $('capture');
  if (me.cz >= 0 && !me.dead) {
    const co = owners.get(me.cz), cf = co && facInfo.get(co), c = CASTLES.find((k) => k.id === me.cz);
    cap.style.display = 'block';
    $('captxt').innerHTML = `<b>${c.name}</b> · level ${me.cl || 1} · ${cf ? esc(cf.name) : 'Bandit-held'}<br>${cf && cf.id === prof.fac ? 'Your faction holds this castle. Gold you carry is banked here.' : me.cdf > 0 ? me.cdf + ' defender' + (me.cdf > 1 ? 's' : '') + ' remaining' : prof.fac ? (me.cp > 0 ? 'Capturing...' : 'Undefended! Hold the inner courtyard.') : 'Join a faction to claim castles.'}`;
    $('capbar').style.width = me.cp * 100 + '%';
  } else cap.style.display = 'none';
  $('death').style.display = me.dead ? 'flex' : 'none';
  if (me.dead && lastDeath) $('deathtxt').textContent = `You lost ${lastDeath.lost} valor${lastDeath.gold ? ' and dropped ' + lastDeath.gold + ' gold' : ''}${lastDeath.by ? ' to ' + lastDeath.by : ''}. Your soma and relics are safe. Respawning in ${Math.ceil(me.rs / 1000)}...`;
}
let lastMg = null;
setInterval(() => {
  if (!started) return;
  updateHud();
  if (lastMg !== me.mg) { lastMg = me.mg; if (panelOpen('inv')) renderInv(); }
}, 100);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function addChat(text, color) {
  const log = $('chatlog'), d = document.createElement('div');
  d.textContent = text; d.style.color = color || '#eadfc4';
  log.appendChild(d);
  while (log.children.length > 10) log.removeChild(log.firstChild);
  setTimeout(() => { d.style.transition = 'opacity 1s'; d.style.opacity = '0'; setTimeout(() => d.remove(), 1000); }, 15000);
}
let toastT = null;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.style.opacity = '1'; clearTimeout(toastT); toastT = setTimeout(() => (t.style.opacity = '0'), 3000); }

// ------------------------------------------------------------------ panels
const PANELS = ['skills', 'factions', 'board', 'help', 'map', 'keys', 'inv'];
const panelOpen = (id) => $(id).style.display === 'block';
function togglePanel(id) {
  const open = panelOpen(id);
  for (const p of PANELS) $(p).style.display = 'none';
  if (!open) {
    $(id).style.display = 'block';
    if (id === 'skills') renderSkills(); if (id === 'factions') renderFactions(); if (id === 'board') renderBoard(); if (id === 'map') renderMap(); if (id === 'keys') renderKeys(); if (id === 'inv') renderInv();
  } else if (id === 'keys') rebinding = null;
}
document.querySelectorAll('[data-close]').forEach((x) => x.addEventListener('click', () => togglePanel(x.closest('.panel').id)));
document.querySelectorAll('[data-open]').forEach((x) => x.addEventListener('click', () => togglePanel(x.dataset.open)));
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

let treeTab = 'blade', skillSel = null;
function skillState(sk) {
  const owned = prof.skills.includes(sk.id), reqOk = !sk.req || prof.skills.includes(sk.req);
  const can = !owned && !sk.free && reqOk && prof.tier >= sk.tier && prof.pts > 0;
  return { owned, reqOk, can, tierOk: prof.tier >= sk.tier };
}
function renderSkills() {
  $('skpts').textContent = `${prof.pts} point${prof.pts === 1 ? '' : 's'} to spend · soma tier ${prof.tier}`;
  const tabs = $('treetabs'); tabs.innerHTML = '';
  for (const tr of TREES) {
    const n = SKILL_LIST.filter((s) => s.tree === tr.id && prof.skills.includes(s.id)).length, tot = SKILL_LIST.filter((s) => s.tree === tr.id).length;
    const b = el('button', 'treetab' + (tr.id === treeTab ? ' on' : ''), `${tr.name} ${n}/${tot}`);
    b.style.setProperty('--tc', tr.color);
    if (SKILL_LIST.some((s) => s.tree === tr.id && skillState(s).can)) b.classList.add('glow');
    b.onclick = () => { treeTab = tr.id; skillSel = null; renderSkills(); };
    tabs.appendChild(b);
  }
  const tr = TREES.find((t) => t.id === treeTab), list = SKILL_LIST.filter((s) => s.tree === treeTab);
  const box = $('treeview'); box.innerHTML = ''; box.style.setProperty('--tc', tr.color);
  const CW = 150, RH = 84, ox = 20, oy = 16;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', CW * 3 + 40); svg.setAttribute('height', RH * 6 + 30); box.appendChild(svg);
  const pos = (s) => [ox + s.at[0] * CW + 60, oy + s.at[1] * RH + 26];
  for (const s of list) if (s.req) {
    const [x1, y1] = pos(SKILLS[s.req]), [x2, y2] = pos(s), line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('d', `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`);
    line.setAttribute('class', 'edge' + (prof.skills.includes(s.req) ? ' lit' : ''));
    svg.appendChild(line);
  }
  for (const s of list) {
    const st = skillState(s), [x, y] = pos(s);
    const d = el('div', 'node ' + (st.owned ? 'owned' : st.can ? 'avail' : 'locked') + (s.passive ? ' passive' : '') + (skillSel === s.id ? ' sel' : ''));
    d.style.left = x - 60 + 'px'; d.style.top = y - 26 + 'px';
    d.innerHTML = `<span class="ni">${s.icon}</span><span class="nn">${s.name}</span><span class="nt">${st.owned ? (s.passive ? 'passive ✓' : '✓ learned') : 'tier ' + s.tier}</span>`;
    d.onclick = () => { skillSel = s.id; renderSkills(); };
    d.ondblclick = () => { if (st.can) send({ t: 'learn', id: s.id }); };
    box.appendChild(d);
  }
  const info = $('skinfo'); info.innerHTML = '';
  const s = skillSel && SKILLS[skillSel];
  if (!s) { info.innerHTML = `<h3 style="color:${tr.color}">${tr.name}</h3><p>${tr.blurb}</p><p class="dim">Click a skill to see what it does. Each soma tier gives one skill point. Skills need the one above them in the tree. Mix trees to build your own playstyle.</p>`; return; }
  const st = skillState(s);
  info.innerHTML = `<h3 style="color:${tr.color}">${s.icon} ${s.name}</h3><p>${s.desc}</p><p class="dim">${s.passive ? 'Passive · always active once learned' : `${s.en} energy · ${s.cd / 1000}s cooldown`}<br>Needs soma tier ${s.tier}${s.req ? ` and ${SKILLS[s.req].name}` : ''}</p>`;
  if (st.can) { const b = el('button', 'primary', 'Learn (1 point)'); b.onclick = () => send({ t: 'learn', id: s.id }); info.appendChild(b); }
  else if (!st.owned && !s.free) info.appendChild(el('p', 'warn', !st.tierOk ? `Reach soma tier ${s.tier} first.` : !st.reqOk ? `Learn ${SKILLS[s.req].name} first.` : 'No skill points left.'));
  if (st.owned && !s.passive) {
    info.appendChild(el('p', 'dim', 'Put on hotbar slot:'));
    const row = el('div', 'slotpick');
    for (let i = 0; i < prof.slots; i++) {
      const cur = prof.hotbar[i], b = el('button', cur === s.id ? 'on' : '', `${(i + 1) % 10}${cur && SKILLS[cur] ? ' ' + SKILLS[cur].icon : ''}`);
      b.onclick = () => { send({ t: 'hb', s: i, id: s.id }); slotSel = -1; };
      row.appendChild(b);
    }
    info.appendChild(row);
    if (slotSel >= 0 && slotSel < prof.slots && prof.hotbar[slotSel] !== s.id) { send({ t: 'hb', s: slotSel, id: s.id }); slotSel = -1; buildHotbar(); }
  }
}
// The panel is split so the name box is only rebuilt when your faction changes, not on every
// once-a-second update (rebuilding it used to wipe whatever you were typing).
let facFormFor = null;
function renderFactions() {
  const b = $('facbody');
  if (!$('facme')) b.innerHTML = '<div id="facme"></div><div id="faccastles"></div><h4>All factions</h4><div id="faclist"></div>';
  const mine = facInfo.get(prof.fac), state = mine ? 'in:' + mine.id + ':' + mine.m + ':' + mine.c + ':' + mine.l : 'out';
  if (facFormFor !== state) { facFormFor = state; renderFactionMe($('facme'), mine); }
  renderFactionCastles($('faccastles'), mine);
  renderFactionList($('faclist'));
}
function renderFactionCastles(b, mine) {
  b.innerHTML = '';
  if (!mine) return;
  const mineC = CASTLES.filter((c) => owners.get(c.id) === mine.id);
  b.appendChild(el('h4', '', 'Your castles'));
  if (!mineC.length) { b.appendChild(el('p', 'dim', "None yet. Clear a castle's garrison and hold its inner courtyard to claim it. Every castle pays taxes to your online members each minute.")); return; }
  for (const c of mineC) {
    const lv = levels.get(c.id) || 1, r = el('div', 'frow');
    r.appendChild(el('div', 'grow', `${c.name} · level ${lv} · taxes ${8 * lv} gold/min`));
    if (lv < 3) { const bt = el('button', '', `Fortify (${CASTLE_LEVEL_COST[lv + 1]}g)`); bt.title = 'More and stronger defenders, and higher taxes. Paid from banked gold.'; bt.onclick = () => send({ t: 'fortify', id: c.id }); r.appendChild(bt); }
    b.appendChild(r);
  }
}
function renderFactionMe(b, mine) {
  b.innerHTML = '';
  if (mine) {
    const r = el('div', 'frow'); const dot = el('div', 'dot'); dot.style.background = mine.color; r.appendChild(dot);
    r.appendChild(el('div', 'grow', `${mine.name}: ${mine.m} member${mine.m === 1 ? '' : 's'}, ${mine.c} castle${mine.c === 1 ? '' : 's'}. Led by ${mine.l}`));
    const lb = el('button', '', 'Leave'); lb.onclick = () => { if (confirm(`Leave ${mine.name}?`)) send({ t: 'fl' }); }; r.appendChild(lb); b.appendChild(r);
    b.appendChild(el('p', 'dim', 'Faction chat: start a message with /f'));
  } else {
    const r = el('div', 'frow');
    const inp = el('input', 'txt'); inp.placeholder = 'New faction name'; inp.maxLength = 16; inp.style.flex = '1';
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') bt.click(); });
    const bt = el('button', 'primary', 'Found faction'); bt.onclick = () => { if (inp.value.trim()) send({ t: 'fc', n: inp.value.trim() }); };
    r.appendChild(inp); r.appendChild(bt); b.appendChild(r);
    b.appendChild(el('p', 'dim', "Names are 3-16 letters, numbers, spaces, - or '."));
  }
}
function renderFactionList(b) {
  b.innerHTML = '';
  const list = [...facInfo.values()].sort((a, c) => c.c - a.c || c.m - a.m);
  if (!list.length) b.appendChild(el('p', 'dim', 'No factions yet. Be the first!'));
  for (const f of list) {
    const r = el('div', 'frow'); const dot = el('div', 'dot'); dot.style.background = f.color; r.appendChild(dot);
    r.appendChild(el('div', 'grow', `${f.name}: ${f.m} member${f.m === 1 ? '' : 's'} · ${f.c} castle${f.c === 1 ? '' : 's'}`));
    if (!prof.fac) { const jb = el('button', '', 'Join'); jb.onclick = () => send({ t: 'fj', id: f.id }); r.appendChild(jb); }
    b.appendChild(r);
  }
}
function renderBoard() {
  const b = $('boardbody'); b.innerHTML = '';
  b.appendChild(el('h4', '', 'Rank rewards'));
  b.appendChild(el('p', 'dim', 'Valor sets your rank. Each rank keeps the rewards below it, but dying costs 75% of your valor, so you can lose them.'));
  const cur = rankOf(me.v).idx, rt = el('table', 'lb ranks');
  RANKS.forEach((r, i) => {
    const tr = el('tr', i <= cur ? 'got' : '');
    [i <= cur ? '✓' : '', r.name, r.v, r.perk].forEach((v) => tr.appendChild(el('td', '', String(v))));
    rt.appendChild(tr);
  });
  b.appendChild(rt);
  b.appendChild(el('h4', '', 'Top players online'));
  const t = el('table', 'lb'); t.innerHTML = '<tr><th>#</th><th>Name</th><th>Rank</th><th>Valor</th><th>Soma</th></tr>';
  meta.lb.forEach((p, i) => { const tr = el('tr'); const f = facInfo.get(p.f); [i + 1, (f ? `[${f.name}] ` : '') + p.n, rankOf(p.v).name, p.v, `T${p.t} (${p.s})`].forEach((v) => tr.appendChild(el('td', '', String(v)))); t.appendChild(tr); });
  b.appendChild(t);
  b.appendChild(el('h4', '', 'Realm control'));
  const f = [...facInfo.values()].filter((x) => x.c).sort((a, c) => c.c - a.c);
  if (!f.length) b.appendChild(el('p', 'dim', 'No faction holds a castle yet.'));
  f.forEach((x) => { const r = el('div', 'frow'); const dot = el('div', 'dot'); dot.style.background = x.color; r.appendChild(dot); r.appendChild(el('div', 'grow', `${x.name}: ${x.c}/${CASTLES.length} castles, ${x.m} members`)); b.appendChild(r); });
}

// ------------------------------------------------------------------ minimap & world map
const terrainMap = document.createElement('canvas'); terrainMap.width = GW; terrainMap.height = GH;
{
  const tctx = terrainMap.getContext('2d'), img = tctx.createImageData(GW, GH);
  for (let i = 0; i < GW * GH; i++) {
    const land = LAND_GRID[i], r = REGION_GRID[i], gx = i % GW, gy = (i / GW) | 0;
    let c = land ? BIOME_RGB[REGIONS[r].biome] : [36, 78, 128];
    const border = land && ((gx + 1 < GW && LAND_GRID[i + 1] && REGION_GRID[i + 1] !== r) || (gy + 1 < GH && LAND_GRID[i + GW] && REGION_GRID[i + GW] !== r));
    if (border) c = c.map((v) => v * 0.55);
    img.data.set([c[0], c[1], c[2], 255], i * 4);
  }
  tctx.putImageData(img, 0, 0);
  tctx.strokeStyle = 'rgba(120,90,50,.8)'; tctx.lineWidth = 1;
  for (const r of ROADS) { tctx.beginPath(); tctx.moveTo(r.x0 / RC, r.y0 / RC); tctx.lineTo(r.x1 / RC, r.y1 / RC); tctx.stroke(); }
}
const ownedMap = document.createElement('canvas'); ownedMap.width = GW; ownedMap.height = GH;
let miniDirty = true;
function rebuildOwned() {
  const o = ownedMap.getContext('2d'); o.clearRect(0, 0, GW, GH); o.drawImage(terrainMap, 0, 0);
  const img = o.getImageData(0, 0, GW, GH);
  const tint = new Map();
  for (const [rid, fid] of owners) { const f = facInfo.get(fid); if (f) tint.set(rid, hexRgb(f.color)); }
  for (let i = 0; i < GW * GH; i++) {
    if (!LAND_GRID[i]) continue;
    const t = tint.get(REGION_GRID[i]); if (!t) continue;
    for (let k = 0; k < 3; k++) img.data[i * 4 + k] = img.data[i * 4 + k] * 0.55 + t[k] * 0.45;
  }
  o.putImageData(img, 0, 0);
  miniDirty = false;
}
function hexRgb(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const dungeonMaps = new Map();
function dungeonMap(d) {
  let c = dungeonMaps.get(d.id);
  if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = DGRID;
  const x = c.getContext('2d'); x.fillStyle = '#0c0b0e'; x.fillRect(0, 0, DGRID, DGRID);
  for (let i = 0; i < DGRID * DGRID; i++) if (d.tiles[i]) { x.fillStyle = '#8a8070'; x.fillRect(i % DGRID, Math.floor(i / DGRID), 1, 1); }
  dungeonMaps.set(d.id, c);
  return c;
}
function drawMinimap() {
  const dg = dungeonAt(me.x, me.y);
  if (dg) {
    const mw = mini.width, mh = mini.height, s = Math.min(mw, mh) / DGRID, ox = (mw - DGRID * s) / 2;
    mctx.fillStyle = '#0c0b0e'; mctx.fillRect(0, 0, mw, mh);
    mctx.imageSmoothingEnabled = false; mctx.drawImage(dungeonMap(dg), ox, 0, DGRID * s, DGRID * s);
    const tx = (wx) => ox + ((wx - dg.bx) / DT_SIZE) * s, ty = (wy) => ((wy - dg.by) / DT_SIZE) * s;
    const br = dg.rooms[dg.rooms.length - 1];
    mctx.fillStyle = '#ff5050'; mctx.font = 'bold 12px Georgia'; mctx.textAlign = 'center'; mctx.fillText('☠', tx(br.x), ty(br.y) + 4);
    mctx.fillStyle = '#c8a0ff'; for (const q of [dg.exitPortal, dg.bossPortal]) { mctx.beginPath(); mctx.arc(tx(q.x), ty(q.y), 3, 0, 7); mctx.fill(); }
    mctx.fillStyle = '#fff'; mctx.strokeStyle = '#000'; mctx.beginPath(); mctx.arc(tx(me.x), ty(me.y), 3.5, 0, 7); mctx.fill(); mctx.stroke();
    return;
  }
  if (miniDirty && facInfo.size >= 0) rebuildOwned();
  const mw = mini.width, mh = mini.height, sx = mw / WW, sy = mh / WH;
  mctx.imageSmoothingEnabled = true; mctx.drawImage(ownedMap, 0, 0, mw, mh);
  for (const c of CASTLES) { const f = facInfo.get(owners.get(c.id)); mctx.fillStyle = f ? f.color : '#ddd'; mctx.strokeStyle = '#000'; mctx.fillRect(c.x * sx - 3, c.y * sy - 3, 6, 6); mctx.strokeRect(c.x * sx - 3, c.y * sy - 3, 6, 6); }
  mctx.fillStyle = '#7f7'; mctx.beginPath(); mctx.arc(VILLAGE.x * sx, VILLAGE.y * sy, 3.5, 0, 7); mctx.fill();
  mctx.fillStyle = '#c8a0ff'; mctx.font = 'bold 10px Georgia'; mctx.textAlign = 'center'; for (const c of CAVES) mctx.fillText('◉', c.x * sx, c.y * sy + 3);
  for (const o of ents.values()) if (o.k === 'player' && o.id !== myId) { mctx.fillStyle = isAlly(o) ? '#4f4' : '#f55'; mctx.fillRect(o.x * sx - 1.5, o.y * sy - 1.5, 3, 3); }
  mctx.fillStyle = '#fff'; mctx.strokeStyle = '#000'; mctx.beginPath(); mctx.arc(me.x * sx, me.y * sy, 3.5, 0, 7); mctx.fill(); mctx.stroke();
  mctx.strokeStyle = 'rgba(255,255,255,.7)'; mctx.strokeRect((me.x - VW / 2 / zoom) * sx, (me.y - VH / 2 / zoom) * sy, (VW / zoom) * sx, (VH / zoom) * sy);
}
function renderMap() {
  const c = $('bigmap'), w = Math.min(innerWidth * 0.86, 1100), h = w * (WH / WW);
  c.width = w * DPR; c.height = h * DPR; c.style.width = w + 'px'; c.style.height = h + 'px';
  const m = c.getContext('2d'); m.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (miniDirty) rebuildOwned();
  m.imageSmoothingEnabled = true; m.drawImage(ownedMap, 0, 0, w, h);
  const sx = w / WW, sy = h / WH;
  m.textAlign = 'center'; m.font = 'bold 12px Georgia';
  for (const r of REGIONS) {
    if (r.dungeon !== undefined) continue;
    const c2 = CASTLES.find((k) => k.id === r.id), f = facInfo.get(owners.get(r.id));
    if (c2) { m.fillStyle = f ? f.color : '#ddd'; m.strokeStyle = '#000'; m.lineWidth = 1.5; m.fillRect(r.x * sx - 5, r.y * sy - 5, 10, 10); m.strokeRect(r.x * sx - 5, r.y * sy - 5, 10, 10); }
    else { m.fillStyle = '#7f7'; m.beginPath(); m.arc(r.x * sx, r.y * sy, 6, 0, 7); m.fill(); }
    m.strokeStyle = 'rgba(0,0,0,.8)'; m.lineWidth = 3; m.fillStyle = '#fff';
    m.strokeText(r.name, r.x * sx, r.y * sy - 10); m.fillText(r.name, r.x * sx, r.y * sy - 10);
    m.font = '10px Georgia'; const sub = r.danger ? (f ? f.name : 'Bandits') + ' · ' + '◆'.repeat(r.danger) : 'Safe haven';
    m.strokeText(sub, r.x * sx, r.y * sy + 18); m.fillStyle = f ? f.color : '#ccc'; m.fillText(sub, r.x * sx, r.y * sy + 18); m.font = 'bold 12px Georgia';
  }
  for (const cv of CAVES) {
    const d = DUNGEONS[cv.dungeon], wait = meta.bosses && meta.bosses[d.id];
    m.fillStyle = '#c8a0ff'; m.strokeStyle = '#000'; m.lineWidth = 2; m.beginPath(); m.arc(cv.x * sx, cv.y * sy, 6, 0, 7); m.fill(); m.stroke();
    m.font = 'bold 11px Georgia'; m.lineWidth = 3; const lbl = `${d.name} ${'◆'.repeat(d.danger)}${wait ? ' (boss in ' + Math.ceil(wait / 60000) + 'm)' : ''}`;
    m.strokeText(lbl, cv.x * sx, cv.y * sy - 10); m.fillStyle = '#e0d0ff'; m.fillText(lbl, cv.x * sx, cv.y * sy - 10);
  }
  if (me.y < WH) { m.fillStyle = '#fff'; m.strokeStyle = '#000'; m.lineWidth = 2; m.beginPath(); m.arc(me.x * sx, me.y * sy, 5, 0, 7); m.fill(); m.stroke(); }
  const rk = rankOf(me.v).idx;
  $('maphint').textContent = rk >= TRAVEL_RANK ? 'Click a castle your faction holds to travel there, or press ' + keyName(binds.recall) + ' to recall to Hanbin Haven.'
    : rk >= RECALL_RANK ? 'Press ' + keyName(binds.recall) + " to recall to Hanbin Haven. Reach Baron to travel to your faction's castles."
    : "Reach Knight to unlock Recall, and Baron to travel between your faction's castles.";
}
$('bigmap').addEventListener('click', (e) => {
  const c = $('bigmap'), r = c.getBoundingClientRect(), wx = (e.clientX - r.left) / r.width * WW, wy = (e.clientY - r.top) / r.height * WH;
  const hit = CASTLES.map((k) => [k, Math.hypot(k.x - wx, k.y - wy)]).sort((a, b) => a[1] - b[1])[0];
  if (!hit || hit[1] > 350) return;
  const k = hit[0];
  if (rankOf(me.v).idx < TRAVEL_RANK) return toast('Fort travel unlocks at the rank of Baron.');
  if (!prof.fac || owners.get(k.id) !== prof.fac) return toast('Your faction does not hold ' + k.name + '.');
  send({ t: 'travel', id: k.id }); togglePanel('map');
});

// ------------------------------------------------------------------ input
const worldMouse = () => ({ x: me.x + (mouseX - VW / 2) / zoom, y: me.y + (mouseY - VH / 2) / zoom });
function aimAngle() { return Math.atan2(mouseY - VH / 2, mouseX - VW / 2); }
// Rebindable keys, stored per browser as KeyboardEvent.code values (layout-independent).
const ACTIONS = [
  ['up', 'Move up', 'KeyW'], ['down', 'Move down', 'KeyS'], ['left', 'Move left', 'KeyA'], ['right', 'Move right', 'KeyD'],
  ...Array.from({ length: 10 }, (_, i) => ['slot' + i, `Hotbar slot ${i + 1}`, 'Digit' + ((i + 1) % 10)]),
  ['skills', 'Skill trees', 'KeyK'], ['factions', 'Factions', 'KeyF'], ['map', 'World map', 'KeyM'], ['board', 'Leaderboard', 'Tab'],
  ['help', 'Help', 'KeyH'], ['keys', 'Keybinds', 'KeyO'], ['chat', 'Open chat', 'Enter'], ['recall', 'Recall to Haven (Knight)', 'KeyB'], ['inv', 'Relics & shop', 'KeyI'],
];
const DEFAULT_BINDS = Object.fromEntries(ACTIONS.map(([id, , code]) => [id, code]));
let binds = { ...DEFAULT_BINDS };
try { Object.assign(binds, JSON.parse(store.get('hanbin_binds') || '{}')); } catch { /* ignore a corrupt save */ }
let actionOf = new Map();
function applyBinds() {
  actionOf = new Map(Object.entries(binds).map(([a, c]) => [c, a]));
  store.set('hanbin_binds', JSON.stringify(binds));
  document.querySelectorAll('[data-open]').forEach((b) => { b.textContent = `${keyName(binds[b.dataset.open === 'board' ? 'board' : b.dataset.open])} ${b.dataset.label}`; });
  if (started || prof.slots) buildHotbar();
}
function keyName(code) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num' + code.slice(6);
  if (code.startsWith('Arrow')) return { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }[code];
  return { Space: 'Space', ShiftLeft: 'LShift', ShiftRight: 'RShift', ControlLeft: 'LCtrl', ControlRight: 'RCtrl', AltLeft: 'LAlt', AltRight: 'RAlt', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', CapsLock: 'Caps' }[code] || code;
}
const pressed = (action) => !!keys[binds[action]];
// Arrow keys also move, unless they have been bound to something else.
const arrow = (code) => keys[code] && !actionOf.has(code);
function mask() {
  if (chatOpen || me.dead || !connected) return 0;
  return (pressed('up') || arrow('ArrowUp') ? 1 : 0) | (pressed('down') || arrow('ArrowDown') ? 2 : 0) | (pressed('left') || arrow('ArrowLeft') ? 4 : 0) | (pressed('right') || arrow('ArrowRight') ? 8 : 0);
}
let rebinding = null;
function renderKeys() {
  const b = $('keysbody'); b.innerHTML = '';
  const grid = el('div', 'keygrid');
  for (const [id, label] of ACTIONS) {
    grid.appendChild(el('span', '', label));
    const btn = el('button', 'keybtn' + (rebinding === id ? ' wait' : ''), rebinding === id ? 'Press a key…' : keyName(binds[id]));
    btn.onclick = () => { rebinding = rebinding === id ? null : id; renderKeys(); };
    grid.appendChild(btn);
  }
  b.appendChild(grid);
  b.appendChild(el('p', 'dim', 'Click an action, then press the new key (Esc cancels). Picking a key that is already used swaps the two. Left click is always hotbar slot 1 and right click slot 2.'));
  const reset = el('button', '', 'Restore defaults');
  reset.onclick = () => { binds = { ...DEFAULT_BINDS }; rebinding = null; applyBinds(); renderKeys(); };
  b.appendChild(reset);
}
function castSlot(s) { const w = worldMouse(); send({ t: 'cast', s, a: +aimAngle().toFixed(3), x: Math.round(w.x), y: Math.round(w.y) }); }
// Send our predicted position 20 times a second while it differs from what the server last confirmed.
let lastA = 0, lastSent = 0, lastX = 0, lastY = 0;
setInterval(() => {
  if (!connected || !me.init) return;
  const a = aimAngle(), now = performance.now();
  const moved = Math.hypot(me.x - lastX, me.y - lastY) > 0.5 || Math.hypot(me.x - me.sx, me.y - me.sy) > 1;
  if (moved || Math.abs(a - lastA) > 0.04 || now - lastSent > 400) {
    send({ t: 'in', a: +a.toFixed(3), x: +me.x.toFixed(1), y: +me.y.toFixed(1), tp: me.tpSeen });
    lastA = a; lastSent = now; lastX = me.x; lastY = me.y;
  }
}, 50);
setInterval(() => { if (!connected || chatOpen) return; for (const s of held) castSlot(s); }, 90);

addEventListener('keydown', (e) => {
  if (!started) return;
  if (rebinding) {
    e.preventDefault();
    if (e.code !== 'Escape') {
      const old = binds[rebinding], other = actionOf.get(e.code);
      if (other && other !== rebinding) binds[other] = old;
      binds[rebinding] = e.code;
      applyBinds();
    }
    rebinding = null; renderKeys(); return;
  }
  if (chatOpen) {
    if (e.key === 'Enter') { const v = $('chatin').value.trim(); if (v) send({ t: 'chat', m: v }); closeChat(); }
    else if (e.key === 'Escape') closeChat();
    e.stopPropagation(); return;
  }
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  if (e.code === 'Escape') { for (const p of PANELS) $(p).style.display = 'none'; slotSel = -1; buildHotbar(); return; }
  const act = actionOf.get(e.code);
  if (act || e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Tab') e.preventDefault();
  keys[e.code] = true;
  if (!act || e.repeat) return;
  if (act === 'chat') return openChat();
  if (act === 'board') return togglePanel('board');
  if (act === 'recall') return send({ t: 'recall' });
  if (PANELS.includes(act)) return togglePanel(act);
  if (act.startsWith('slot')) { const s = +act.slice(4); held.add(s); castSlot(s); }
});
addEventListener('keyup', (e) => {
  keys[e.code] = false;
  const act = actionOf.get(e.code);
  if (act && act.startsWith('slot')) held.delete(+act.slice(4));
});
addEventListener('blur', () => { for (const k in keys) keys[k] = false; held.clear(); });
function openChat() { chatOpen = true; const i = $('chatin'); i.style.display = 'block'; i.value = ''; i.focus(); }
function closeChat() { chatOpen = false; const i = $('chatin'); i.style.display = 'none'; i.blur(); }
addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
cv.addEventListener('mousedown', (e) => {
  if (!connected || chatOpen) return;
  for (const p of PANELS) if (panelOpen(p)) { $(p).style.display = 'none'; return; }
  const s = e.button === 2 ? 1 : 0; held.add(s); castSlot(s);
});
addEventListener('mouseup', (e) => held.delete(e.button === 2 ? 1 : 0));
cv.addEventListener('contextmenu', (e) => e.preventDefault());

// ------------------------------------------------------------------ ground chunks
const CHUNK = 512, RES = 4, NPX = CHUNK / RES, chunks = new Map(), pending = new Set();
const tmp = document.createElement('canvas'); tmp.width = NPX; tmp.height = NPX; const tctx = tmp.getContext('2d');
let worker = null;
try {
  worker = new Worker(new URL('./chunkworker.mjs', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => { const { cx, cy, px } = e.data; pending.delete(cy * 100 + cx); finishChunk(cx, cy, px); };
  worker.onerror = () => { worker = null; pending.clear(); };
} catch { worker = null; }
// Turns raw ground pixels into a chunk canvas and sprinkles grass tufts, flowers and pebbles on top.
function finishChunk(cx, cy, px) {
  tctx.putImageData(new ImageData(px, NPX, NPX), 0, 0);
  const c = document.createElement('canvas'); c.width = CHUNK; c.height = CHUNK;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  x.drawImage(tmp, 0, 0, CHUNK, CHUNK);
  const x0 = cx * CHUNK, y0 = cy * CHUNK;
  const roads = ROADS.filter((r) => Math.max(r.x0, r.x1) > x0 - 40 && Math.min(r.x0, r.x1) < x0 + CHUNK + 40 && Math.max(r.y0, r.y1) > y0 - 40 && Math.min(r.y0, r.y1) < y0 + CHUNK + 40);
  const R = rng(cx * 7919 + cy * 104729);
  for (let k = 0; k < 90; k++) {
    const px2 = R() * CHUNK, py = R() * CHUNK, wx = x0 + px2, wy = y0 + py;
    if (landValue(wx, wy) < 0.05 || roadDist(wx, wy, roads) < 30) continue;
    const biome = REGIONS[regionAt(wx, wy)].biome, roll = R();
    if (biome === 'grass' || biome === 'forest' || biome === 'heath' || biome === 'swamp' || biome === 'darkforest') {
      x.strokeStyle = biome === 'heath' ? 'rgba(90,80,30,.5)' : 'rgba(30,70,20,.45)'; x.lineWidth = 1.4;
      for (let t = -1; t <= 1; t++) { x.beginPath(); x.moveTo(px2 + t * 2, py); x.lineTo(px2 + t * 3.5, py - 6 - R() * 3); x.stroke(); }
      if (roll < 0.18 && biome !== 'darkforest') { x.fillStyle = ['#f6f0a0', '#f080a0', '#ffffff', '#b090f0'][Math.floor(R() * 4)]; x.beginPath(); x.arc(px2 + 4, py - 3, 1.8, 0, 7); x.fill(); }
    } else if (biome === 'desert' || biome === 'rock' || biome === 'ash') {
      x.fillStyle = biome === 'ash' ? 'rgba(30,20,20,.35)' : 'rgba(80,60,40,.3)'; x.beginPath(); x.ellipse(px2, py, 2 + R() * 3, 1.5 + R() * 2, R() * 3, 0, 7); x.fill();
      if (biome === 'ash' && roll < 0.1) { x.fillStyle = 'rgba(255,110,40,.6)'; x.beginPath(); x.arc(px2 + 5, py, 1.6, 0, 7); x.fill(); }
    } else if (biome === 'snow') {
      x.fillStyle = 'rgba(160,180,200,.35)'; x.beginPath(); x.ellipse(px2, py, 6 + R() * 6, 2, 0, 0, 7); x.fill();
    }
  }
  chunks.set(cy * 100 + cx, { canvas: c, used: performance.now() });
  if (chunks.size > 60) { const old = [...chunks.entries()].sort((a, b) => a[1].used - b[1].used).slice(0, 10); for (const [ok] of old) chunks.delete(ok); }
}
let chunkBudget = 0;
// Returns a ready chunk, or asks for it (from the worker, or built here one at a time without one).
function getChunk(cx, cy) {
  const k = cy * 100 + cx, c = chunks.get(k);
  if (c) { c.used = performance.now(); return c.canvas; }
  if (pending.has(k)) return null;
  if (worker) { if (pending.size < 6) { pending.add(k); worker.postMessage({ cx, cy, size: CHUNK, res: RES }); } return null; }
  if (chunkBudget-- > 0) { finishChunk(cx, cy, chunkPixels(cx, cy, CHUNK, RES)); return chunks.get(k).canvas; }
  return null;
}

// ------------------------------------------------------------------ drawing helpers
const facColor = (id) => { const f = facInfo.get(id); return f ? f.color : null; };
function isAlly(o) { return o.id === myId || (prof.fac && o.f === prof.fac) || o.ow === myId; }
const DEFAULT_COLOR = { guard: '#7d7468', archer: '#6d6458', captain: '#5d5448', footman: '#b0a070', summoned_archer: '#90a070', knight: '#c0c0d0' };
function creatureColor(o) {
  if (o.k === 'player') return facColor(o.f);
  return facColor(o.f) || DEFAULT_COLOR[o.k] || '#888';
}
const RADIUS = (o) => (o.k === 'player' ? 14 : MOBS[o.k] ? MOBS[o.k].r : 13);

function drawShadow(x, y, r) { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(x + 2, y + r * 0.55, r * 1.05, r * 0.55, 0, 0, 7); ctx.fill(); }
function drawEnt(o, x, y, now) {
  const r = RADIUS(o), self = o.id === myId;
  if (o.k === 'banner') { const img = banner(facColor(o.f) || '#e0b84f'); ctx.drawImage(img, x - 14, y - 62, 48, 70); ctx.strokeStyle = 'rgba(255,240,180,.25)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(x, y, 200, 0, 7); ctx.stroke(); ctx.setLineDash([]); return; }
  drawShadow(x, y, r);
  if (o.el || MOBS[o.k]?.boss) { const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 1.9); g.addColorStop(0, o.el ? 'rgba(255,200,60,.35)' : 'rgba(200,60,255,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.9, 0, 7); ctx.fill(); }
  if (o.fl & 1024) { ctx.strokeStyle = `rgba(255,60,40,${0.5 + 0.5 * Math.sin(now / 50)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 6, 0, 7); ctx.stroke(); }
  if (o.fl & 2) { ctx.strokeStyle = 'rgba(80,200,240,.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 8, 0, 7); ctx.stroke(); }
  if (o.fl & 16) { ctx.strokeStyle = 'rgba(240,190,70,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 11, now / 300, now / 300 + 4.5); ctx.stroke(); }
  const step = Math.sin(o.ph || 0) * (o.moving ? 1 : 0);
  const look = o.k === 'player' ? playerLook(o.n || prof.name, o.rk || 0, facColor(o.f), o.wp) : null;
  const img = creature(o.k, creatureColor(o), step, o.at || o.sp, look);
  const w = img.width / 2 * 1.3, h = img.height / 2 * 1.3;
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.sp ? now / 60 : (self ? aimAngle() : o.a));
  if (o.k === 'wraith' || o.k === 'hollow_prince') ctx.globalAlpha = 0.85;
  if (o.enr) { ctx.shadowColor = '#ff3030'; ctx.shadowBlur = 14; }
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  if (o.flash && now - o.flash < 120) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55; ctx.drawImage(img, -w / 2, -h / 2, w, h); }
  ctx.restore();
  if (o.fl & 32) { ctx.fillStyle = 'rgba(170,180,200,.18)'; ctx.strokeStyle = 'rgba(200,210,230,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 6, 0, 7); ctx.fill(); ctx.stroke(); }
  if (o.fl & 1) { ctx.fillStyle = '#ffe680'; for (let i = 0; i < 3; i++) { const a = now / 200 + i * 2.1; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.8, y - r - 4 + Math.sin(a) * 3, 2.4, 0, 7); ctx.fill(); } }
  if (o.fl & 4) { ctx.strokeStyle = 'rgba(140,210,255,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y + r * 0.5, r + 3, r * 0.5, 0, 0, 7); ctx.stroke(); }
}
function drawLabels(o, x, y) {
  if (o.k === 'banner') return;
  const r = RADIUS(o) * 1.25, self = o.id === myId, ally = isAlly(o);
  if (o.h < o.m || o.k === 'player') {
    const bw = Math.max(32, r * 2.2), by = y - r - 14;
    ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(x - bw / 2 - 1, by - 1, bw + 2, 6);
    ctx.fillStyle = self ? '#5fd35f' : ally ? '#4cc0e0' : '#e04848'; ctx.fillRect(x - bw / 2, by, bw * Math.max(0, o.h / o.m), 4);
  }
  ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  if (o.k === 'player') {
    const f = facInfo.get(o.f), nm = o.n || prof.name;
    ctx.font = 'bold 12px Georgia'; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 3;
    ctx.strokeText(nm, x, y - r - 30); ctx.fillStyle = self ? '#fff3c4' : ally ? '#a8f0b0' : '#ffd0c0'; ctx.fillText(nm, x, y - r - 30);
    ctx.font = '10px Georgia'; const sub = `${f ? f.name + ' · ' : ''}${RANKS[o.rk || 0].name}`;
    ctx.strokeText(sub, x, y - r - 18); ctx.fillStyle = f ? f.color : '#c8bca0'; ctx.fillText(sub, x, y - r - 18);
  } else if (o.h < o.m || o.ow || o.el) {
    const boss = MOBS[o.k]?.boss;
    ctx.font = o.el || boss ? 'bold 11px Georgia' : '10px Georgia'; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 3;
    const nm = (o.el ? o.el[0].toUpperCase() + o.el.slice(1) + ' ' : '') + (MOBS[o.k] ? MOBS[o.k].name : o.k);
    ctx.strokeText(nm, x, y - r - 18); ctx.fillStyle = o.el ? '#ffd050' : ally ? '#a8e0f0' : '#f0d8c8'; ctx.fillText(nm, x, y - r - 18);
  }
  let n = 0; ctx.font = '11px serif';
  for (const [bit, ic] of STATUS) if (o.fl & bit) { ctx.fillText(ic, x - 14 + n * 14, y + r + 16); n++; }
}
function drawProjs(now) {
  for (const [x, y, k, a] of projs) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    if (k === 'fire' || k === 'dark' || k === 'frost') {
      const c1 = k === 'fire' ? '255,140,40' : k === 'frost' ? '140,210,255' : '170,90,255';
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 14); g.addColorStop(0, '#fff'); g.addColorStop(0.3, `rgba(${c1},1)`); g.addColorStop(1, `rgba(${c1},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 14, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(${c1},.35)`; ctx.beginPath(); ctx.moveTo(-6, -5); ctx.lineTo(-26, 0); ctx.lineTo(-6, 5); ctx.fill();
    } else if (k === 'gale') {
      const g = ctx.createLinearGradient(-40, 0, 14, 0); g.addColorStop(0, 'rgba(200,240,255,0)'); g.addColorStop(1, 'rgba(230,250,255,.95)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-40, -12); ctx.lineTo(-30, 0); ctx.lineTo(-40, 12); ctx.closePath(); ctx.fill();
    } else {
      if (k === 'power') { ctx.strokeStyle = 'rgba(255,240,150,.5)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(4, 0); ctx.stroke(); }
      ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(6, 0); ctx.stroke();
      ctx.fillStyle = '#d8dce0'; ctx.beginPath(); ctx.moveTo(6, -2.5); ctx.lineTo(11, 0); ctx.lineTo(6, 2.5); ctx.fill();
      ctx.fillStyle = '#e8e0d0'; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-18, -3.5); ctx.lineTo(-11, 0); ctx.lineTo(-18, 3.5); ctx.fill();
    }
    ctx.restore();
  }
}
function drawZones(now) {
  for (const z of zones) {
    if (z.t === 'poison' || z.t === 'smoke') {
      const fade = Math.min(1, z.l / 600), green = z.t === 'poison';
      for (let i = 0; i < 9; i++) {
        const a = i * 0.7 + now / 1600, d = z.r * (0.25 + (i % 3) * 0.25);
        ctx.fillStyle = green ? `rgba(110,200,60,${0.16 * fade})` : `rgba(150,150,160,${0.3 * fade})`;
        ctx.beginPath(); ctx.arc(z.x + Math.cos(a) * d, z.y + Math.sin(a) * d, z.r * 0.45, 0, 7); ctx.fill();
      }
      if (green) { ctx.fillStyle = `rgba(190,255,120,${0.5 * fade})`; for (let i = 0; i < 6; i++) { const t = ((now / 900 + i * 0.37) % 1), a = i * 1.7; ctx.beginPath(); ctx.arc(z.x + Math.cos(a) * z.r * 0.6, z.y + Math.sin(a) * z.r * 0.6 - t * 14, 3 * (1 - t), 0, 7); ctx.fill(); } }
    } else if (z.t === 'meteor') {
      const p = 1 - z.l / z.d;
      ctx.strokeStyle = 'rgba(255,90,40,.9)'; ctx.lineWidth = 3; ctx.setLineDash([10, 6]); ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = `rgba(255,90,30,${0.08 + 0.25 * p})`; ctx.beginPath(); ctx.arc(z.x, z.y, z.r * Math.max(0.1, p), 0, 7); ctx.fill();
      const my = z.y - (1 - p) * 500, mx = z.x + (1 - p) * 200;
      const g = ctx.createRadialGradient(mx, my, 2, mx, my, 26); g.addColorStop(0, '#fff6c0'); g.addColorStop(0.4, '#ff7a20'); g.addColorStop(1, 'rgba(120,30,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, 26, 0, 7); ctx.fill();
    } else if (z.t === 'rain') {
      ctx.fillStyle = 'rgba(40,30,20,.15)'; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(230,220,190,.8)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 18; i++) { const a = i * 2.39, d = Math.sqrt((i * 0.618) % 1) * z.r, t = (now / 250 + i * 0.13) % 1; const px = z.x + Math.cos(a) * d, py = z.y + Math.sin(a) * d; ctx.beginPath(); ctx.moveTo(px - 8 + t * 8, py - 30 + t * 30); ctx.lineTo(px + t * 8, py - 18 + t * 30); ctx.stroke(); }
    } else if (z.t === 'blast') {
      const p = Math.min(1, 1 - z.l / z.d);
      ctx.strokeStyle = 'rgba(255,60,40,.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 7); ctx.stroke();
      ctx.fillStyle = `rgba(255,50,30,${0.12 + 0.22 * p})`; ctx.beginPath(); ctx.arc(z.x, z.y, z.r * Math.max(0.05, p), 0, 7); ctx.fill();
    } else if (z.t === 'web') {
      ctx.strokeStyle = 'rgba(235,235,245,.55)'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(z.x, z.y); ctx.lineTo(z.x + Math.cos(a) * z.r, z.y + Math.sin(a) * z.r); ctx.stroke(); }
      for (let k = 1; k <= 4; k++) { ctx.beginPath(); for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI * 2, rr = (z.r * k) / 4; i ? ctx.lineTo(z.x + Math.cos(a) * rr, z.y + Math.sin(a) * rr) : ctx.moveTo(z.x + Math.cos(a) * rr, z.y + Math.sin(a) * rr); } ctx.stroke(); }
    } else if (z.t === 'trap') {
      ctx.strokeStyle = '#8a8070'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(z.x, z.y, 12, 0, 7); ctx.stroke();
      ctx.fillStyle = '#b0a890'; for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; ctx.beginPath(); ctx.moveTo(z.x + Math.cos(a) * 12, z.y + Math.sin(a) * 12); ctx.lineTo(z.x + Math.cos(a + 0.2) * 6, z.y + Math.sin(a + 0.2) * 6); ctx.lineTo(z.x + Math.cos(a - 0.2) * 6, z.y + Math.sin(a - 0.2) * 6); ctx.fill(); }
      ctx.strokeStyle = 'rgba(200,170,90,.3)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    }
  }
}
function drawFx(now) {
  fxs = fxs.filter((f) => now - f.t0 < 650);
  for (const f of fxs) {
    const t = now - f.t0, a = Math.max(0, 1 - t / 380);
    if (f.t === 'arc') {
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a);
      const sweep = Math.min(1, t / 120), g = ctx.createRadialGradient(0, 0, f.r * 0.4, 0, 0, f.r);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.85, f.c ? f.c : `rgba(255,255,255,${0.55 * a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = a; ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, f.r, -f.w / 2, -f.w / 2 + f.w * sweep); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
      ctx.restore();
    } else if (f.t === 'ring') {
      const rr = f.r * Math.min(1, t / 220 + 0.2);
      ctx.globalAlpha = a; ctx.strokeStyle = f.c; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(f.x, f.y, rr, 0, 7); ctx.stroke();
      if (f.fill) { ctx.globalAlpha = a * 0.25; ctx.fillStyle = f.c; ctx.fill(); }
      ctx.globalAlpha = 1;
    } else if (f.t === 'boom') {
      const p = Math.min(1, t / 160 + 0.25), rr = f.r * p;
      const g = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, rr); g.addColorStop(0, `rgba(255,250,200,${a})`); g.addColorStop(0.4, `rgba(255,140,40,${0.8 * a})`); g.addColorStop(1, 'rgba(120,30,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, rr, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(255,200,120,${a})`;
      for (let i = 0; i < 10; i++) { const an = i * 0.63 + f.seed, d = rr * (0.6 + (i % 3) * 0.25); ctx.beginPath(); ctx.arc(f.x + Math.cos(an) * d, f.y + Math.sin(an) * d, 2.5, 0, 7); ctx.fill(); }
    } else if (f.t === 'parry') {
      ctx.strokeStyle = `rgba(255,240,140,${a})`; ctx.lineWidth = 3;
      for (let i = 0; i < 8; i++) { const an = i * 0.785 + t / 80; ctx.beginPath(); ctx.moveTo(f.x + Math.cos(an) * 10, f.y + Math.sin(an) * 10); ctx.lineTo(f.x + Math.cos(an) * (22 + t / 15), f.y + Math.sin(an) * (22 + t / 15)); ctx.stroke(); }
    } else if (f.t === 'line') {
      ctx.globalAlpha = a; ctx.strokeStyle = f.c; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke(); ctx.globalAlpha = 1; ctx.lineCap = 'butt';
    } else if (f.t === 'poof') {
      ctx.fillStyle = f.c ? `rgba(60,30,90,${0.5 * a})` : `rgba(210,205,195,${0.45 * a})`;
      for (let i = 0; i < 5; i++) { const an = i * 1.26 + f.seed; ctx.beginPath(); ctx.arc(f.x + Math.cos(an) * t / 22, f.y + Math.sin(an) * t / 22 - t / 40, 8 + t / 40, 0, 7); ctx.fill(); }
    } else if (f.t === 'pulse') {
      const rr = f.r * Math.max(0.05, 1 - t / 380);
      ctx.strokeStyle = `rgba(150,110,255,${a})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(f.x, f.y, rr, 0, 7); ctx.stroke();
    } else if (f.t === 'spark') {
      ctx.fillStyle = `rgba(255,230,160,${a})`; for (let i = 0; i < 4; i++) { const an = i * 1.57 + f.seed; ctx.fillRect(f.x + Math.cos(an) * t / 30, f.y + Math.sin(an) * t / 30, 2, 2); }
    } else if (f.t === 'bolt') {
      ctx.strokeStyle = `rgba(190,220,255,${a})`; ctx.lineWidth = 3; ctx.shadowColor = '#9cf'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(f.pts[0][0], f.pts[0][1]);
      for (let i = 1; i < f.pts.length; i++) {
        const [ax, ay] = f.pts[i - 1], [bx, by] = f.pts[i];
        for (let s = 1; s <= 5; s++) { const q = s / 5, j = s < 5 ? (Math.sin(f.seed + i * 7 + s * 3 + t / 30) * 12) : 0; ctx.lineTo(ax + (bx - ax) * q + j, ay + (by - ay) * q - j); }
      }
      ctx.stroke(); ctx.shadowBlur = 0;
    }
  }
  floaters = floaters.filter((f) => now - f.t0 < f.life);
  ctx.textAlign = 'center'; ctx.font = 'bold 14px Georgia'; ctx.lineJoin = 'round';
  for (const f of floaters) {
    const p = (now - f.t0) / f.life;
    ctx.font = f.big ? `bold ${Math.round(18 + 6 * Math.max(0, 1 - p * 4))}px Georgia` : 'bold 14px Georgia';
    ctx.globalAlpha = 1 - p * p; ctx.strokeStyle = '#000'; ctx.lineWidth = f.big ? 4 : 3; ctx.strokeText(f.txt, f.x, f.y - p * 34); ctx.fillStyle = f.c; ctx.fillText(f.txt, f.x, f.y - p * 34); ctx.globalAlpha = 1;
  }
}

// Loot bags on the ground: gold sacks, and glowing relics coloured by rarity.
function drawLoot(now) {
  for (const [, x, y, kind, locked] of loot) {
    const bob = Math.sin(now / 300 + x) * 2;
    if (kind === 'gold') {
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x + 2, y + 9, 11, 5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#8a6030'; ctx.beginPath(); ctx.ellipse(x, y + bob, 11, 10, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#ffd040'; for (const [dx, dy] of [[-4, -6], [3, -7], [0, -4]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy + bob, 3, 0, 7); ctx.fill(); }
    } else {
      const c = RARITIES[kind].color, g = ctx.createRadialGradient(x, y + bob, 2, x, y + bob, 22);
      g.addColorStop(0, '#fff'); g.addColorStop(0.35, c); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y + bob, 22, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(x, y + bob); ctx.rotate(now / 700); ctx.fillStyle = c; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 0); ctx.lineTo(0, 8); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    if (locked) { ctx.font = '11px serif'; ctx.textAlign = 'center'; ctx.fillText('🔒', x + 12, y - 10); }
  }
}
// A big health bar along the top when a boss is nearby.
function drawBossBar() {
  let boss = null;
  for (const o of ents.values()) if (MOBS[o.k]?.boss && (!boss || Math.hypot(o.x - me.x, o.y - me.y) < Math.hypot(boss.x - me.x, boss.y - me.y))) boss = o;
  const el2 = $('bossbar');
  if (!boss) { el2.style.display = 'none'; return; }
  el2.style.display = 'block';
  $('bossname').textContent = MOBS[boss.k].name + (boss.enr ? ' · ENRAGED' : '');
  $('bossfill').style.width = Math.max(0, boss.h / boss.m) * 100 + '%';
}

// ------------------------------------------------------------------ relics panel
let invSel = null;
function relicCard(it, extra) {
  const r = RELICS[it.k], rar = RARITIES[r.rarity], d = el('div', 'relic' + (extra || ''));
  d.style.setProperty('--rc', rar.color);
  d.innerHTML = `<span class="ri">${r.icon}</span><span class="rn">${r.name}</span><span class="rl">${rar.name} · Lv ${it.lv}</span>`;
  d.title = `${r.name} (Lv ${it.lv}): ${relicText(it.k, it.lv)}`;
  return d;
}
function renderInv() {
  const b = $('invbody'); b.innerHTML = '';
  const manage = !!me.mg, inHaven = Math.hypot(me.x - VILLAGE.x, me.y - VILLAGE.y) < VILLAGE.r;
  const item = (u) => prof.relics.find((r) => r.u === u);
  b.appendChild(el('p', manage ? 'dim' : 'warn', manage ? 'Click a relic to equip, fuse or salvage it.' : 'You can look, but relics can only be changed in Hanbin Haven or a castle your faction holds.'));
  b.appendChild(el('h4', '', `Equipped (${prof.equip.length}/${prof.rslots} slots, more every 4 soma tiers)`));
  const eq = el('div', 'relicrow');
  for (let i = 0; i < prof.rslots; i++) {
    const it = item(prof.equip[i]);
    const d = it ? relicCard(it, invSel === it.u ? ' sel' : '') : el('div', 'relic empty', 'Empty slot');
    d.onclick = () => { invSel = it ? it.u : null; renderInv(); };
    eq.appendChild(d);
  }
  b.appendChild(eq);
  const sel = invSel && item(invSel);
  if (sel) {
    const r = RELICS[sel.k], box = el('div', 'relicinfo');
    box.innerHTML = `<b style="color:${RARITIES[r.rarity].color}">${r.icon} ${r.name}</b> · ${RARITIES[r.rarity].name} · level ${sel.lv}/${MAX_RELIC_LV}<br>${relicText(sel.k, sel.lv)}${sel.lv < MAX_RELIC_LV ? `<br><span class="dim">Next level: ${relicText(sel.k, sel.lv + 1)}</span>` : ''}`;
    const row = el('div', 'slotpick'), equipped = prof.equip.includes(sel.u);
    if (equipped) { const ub = el('button', '', 'Unequip'); ub.disabled = !manage; ub.onclick = () => send({ t: 'unequip', u: sel.u }); row.appendChild(ub); }
    else for (let i = 0; i < prof.rslots; i++) { const eb = el('button', 'primary', `Equip in slot ${i + 1}`); eb.disabled = !manage; eb.onclick = () => send({ t: 'equip', u: sel.u, s: i }); row.appendChild(eb); }
    const twin = prof.relics.some((o) => o.u !== sel.u && o.k === sel.k && o.lv === sel.lv && !prof.equip.includes(o.u));
    if (sel.lv < MAX_RELIC_LV) { const fb = el('button', '', `Fuse (needs a 2nd Lv ${sel.lv}, ${RARITIES[r.rarity].fuse * sel.lv}g)`); fb.disabled = !manage || !twin; fb.onclick = () => send({ t: 'fuse', u: sel.u }); row.appendChild(fb); }
    if (!equipped) { const sb = el('button', '', `Salvage (+${RARITIES[r.rarity].salvage * sel.lv}g)`); sb.disabled = !manage; sb.onclick = () => { if (confirm(`Salvage ${r.name}?`)) { send({ t: 'salvage', u: sel.u }); invSel = null; } }; row.appendChild(sb); }
    box.appendChild(row);
    b.appendChild(box);
  }
  b.appendChild(el('h4', '', `Stash (${prof.relics.length}/${MAX_STASH})`));
  const st = el('div', 'relicrow');
  const stash = prof.relics.filter((r) => !prof.equip.includes(r.u)).sort((a, c) => ['legendary', 'epic', 'rare', 'common'].indexOf(RELICS[a.k].rarity) - ['legendary', 'epic', 'rare', 'common'].indexOf(RELICS[c.k].rarity) || a.k.localeCompare(c.k) || c.lv - a.lv);
  if (!stash.length) st.appendChild(el('p', 'dim', 'Relics drop from elites (gold names), bosses and sometimes any monster. You can also buy crates below.'));
  for (const it of stash) { const d = relicCard(it, invSel === it.u ? ' sel' : ''); d.onclick = () => { invSel = it.u; renderInv(); }; st.appendChild(d); }
  b.appendChild(st);
  b.appendChild(el('h4', '', `Relic merchant · ${me.b || 0} gold banked`));
  const shop = el('div', 'slotpick');
  for (const [id, c] of Object.entries(CRATES)) {
    const bt = el('button', 'primary', `${c.name} (${c.price}g)`);
    bt.title = c.odds.map(([k, w]) => `${RARITIES[k].name} ${Math.round(w * 100)}%`).join(', ');
    bt.disabled = !inHaven || (me.b || 0) < c.price; bt.onclick = () => send({ t: 'buy', c: id }); shop.appendChild(bt);
  }
  b.appendChild(shop);
  if (!inHaven) b.appendChild(el('p', 'dim', 'The merchant trades only in Hanbin Haven.'));
  b.appendChild(el('h4', '', 'Builds that work'));
  const syn = el('ul', 'synergies');
  for (const [n, d] of SYNERGIES) { const li = el('li'); li.innerHTML = `<b>${n}</b>: ${esc(d)}`; syn.appendChild(li); }
  b.appendChild(syn);
}

// ------------------------------------------------------------------ frame
let last = performance.now(), frameNo = 0;
// Prop sprites are looked up once per prop and kept on it.
function propSprite(p) { return p.spr || (p.spr = prop(p.k, p.v, REGIONS[regionAt(p.x, p.y)].biome)); }
// A ring around you while a teleport channels.
function drawChannel(now) {
  if (!me.ch) return;
  const [rem, total, label] = me.ch, f = 1 - rem / total, cx = VW / 2, cy = VH / 2 - 60 * zoom;
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.arc(cx, cy, 22, 0, 7); ctx.stroke();
  ctx.strokeStyle = '#c8a0ff'; ctx.beginPath(); ctx.arc(cx, cy, 22, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke();
  ctx.font = 'bold 13px Georgia'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000';
  ctx.strokeText(label, cx, cy - 32); ctx.fillStyle = '#e8d8ff'; ctx.fillText(label, cx, cy - 32);
}
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  // You move instantly on your own screen using the same collision as the server.
  const k = mask();
  const dx = ((k & 8) ? 1 : 0) - ((k & 4) ? 1 : 0), dy = ((k & 2) ? 1 : 0) - ((k & 1) ? 1 : 0), len = Math.hypot(dx, dy);
  const ox = me.x, oy = me.y;
  if (len > 0 && !me.dead && me.sp > 0) [me.x, me.y] = moveBody(me.x, me.y, 14, (dx / len) * me.sp * dt, (dy / len) * me.sp * dt);
  const moved = Math.hypot(me.x - ox, me.y - oy);
  me.ph += moved * 0.22; me.moving = moved > 0.3;
  // Everyone else is drawn ~110ms in the past, smoothly between the two snapshots around that moment.
  const rt = now - 110;
  for (const o of ents.values()) {
    const b = o.buf, px = o.x, py = o.y;
    let i = b.length - 1;
    while (i > 0 && b[i][0] > rt) i--;
    if (i >= b.length - 1 || b[i][0] > rt) { o.x = b[i][1]; o.y = b[i][2]; }
    else { const [t0, x0, y0] = b[i], [t1, x1, y1] = b[i + 1], f = Math.min(1, (rt - t0) / (t1 - t0 || 1)); o.x = x0 + (x1 - x0) * f; o.y = y0 + (y1 - y0) * f; }
    const m2 = Math.hypot(o.x - px, o.y - py); o.ph += m2 * 0.22; o.moving = m2 > 0.2;
  }

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#20406a'; ctx.fillRect(0, 0, VW, VH);
  ctx.save(); ctx.translate(VW / 2, VH / 2); ctx.scale(zoom, zoom); ctx.translate(-me.x, -me.y);
  const hw = VW / 2 / zoom, hh = VH / 2 / zoom, x0 = me.x - hw, y0 = me.y - hh, x1 = me.x + hw, y1 = me.y + hh;
  // ground: build the nearest missing chunks first, a couple per frame
  chunkBudget = 1;
  for (let cy = Math.floor(y0 / CHUNK); cy <= Math.floor(y1 / CHUNK); cy++) for (let cx = Math.floor(x0 / CHUNK); cx <= Math.floor(x1 / CHUNK); cx++) {
    if (cx < 0 || cy < 0 || cx * CHUNK >= WW || cy * CHUNK >= WORLD_H) continue;
    const c = getChunk(cx, cy);
    if (c) ctx.drawImage(c, cx * CHUNK, cy * CHUNK, CHUNK + 0.5, CHUNK + 0.5);
    else { ctx.fillStyle = '#4a6a3a'; ctx.fillRect(cx * CHUNK, cy * CHUNK, CHUNK, CHUNK); }
  }
  // warm up the ring of chunks just off screen so walking never shows blank ground
  if (worker && pending.size === 0 && frameNo % 10 === 0) {
    for (let cy = Math.floor((y0 - CHUNK) / CHUNK); cy <= Math.floor((y1 + CHUNK) / CHUNK); cy++) for (let cx = Math.floor((x0 - CHUNK) / CHUNK); cx <= Math.floor((x1 + CHUNK) / CHUNK); cx++)
      if (cx >= 0 && cy >= 0 && cx * CHUNK < WW && cy * CHUNK < WORLD_H) getChunk(cx, cy);
  }
  const VS = VILLAGE_SPRITE_SIZE, csz = (c) => castleSize(c.type);
  const visCastles = CASTLES.filter((c) => { const h = csz(c) / 2; return c.x + h > x0 && c.x - h < x1 && c.y + h > y0 && c.y - h < y1; });
  for (const c of visCastles) { const S = csz(c); ctx.drawImage(castleBase(c), c.x - S / 2, c.y - S / 2, S, S); }
  for (const cv of CAVES) if (Math.abs(cv.x - me.x) < hw + 100 && Math.abs(cv.y - me.y) < hh + 100) ctx.drawImage(caveSprite(DUNGEONS[cv.dungeon].theme), cv.x - 75, cv.y - 70, 150, 130);
  const dgHere = dungeonAt(me.x, me.y);
  if (dgHere) for (const q of [dgHere.exitPortal, dgHere.bossPortal]) { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(now / 600); ctx.drawImage(portalSprite(), -38, -38, 76, 76); ctx.restore(); }
  drawLoot(now);
  const villageVis = Math.abs(VILLAGE.x - me.x) < hw + VS && Math.abs(VILLAGE.y - me.y) < hh + VS;
  if (villageVis) ctx.drawImage(villageBase(), VILLAGE.x - VS / 2, VILLAGE.y - VS / 2, VS, VS);
  // low props, zones, then everything with height sorted by y
  const props = propsIn(x0 - 60, y0 - 60, x1 + 60, y1 + 60), tall = [];
  for (const p of props) {
    if (TALL.has(p.k)) { tall.push(p); continue; }
    const s = propSprite(p), w = s.c.width / 2;
    ctx.drawImage(s.c, p.x - w / 2, p.y - w / 2, w, w);
  }
  drawZones(now);
  const list = [];
  for (const o of ents.values()) if (o.id !== myId && o.x > x0 - 80 && o.x < x1 + 80 && o.y > y0 - 80 && o.y < y1 + 80) list.push({ y: o.y, o });
  const self = ents.get(myId) || { id: myId, k: 'player', a: 0 };
  Object.assign(self, { h: me.h, m: me.mh, fl: me.fl, f: prof.fac, n: prof.name, rk: rankOf(me.v).idx, ph: me.ph, moving: me.moving, flash: me.flash });
  if (!me.dead) list.push({ y: me.y, o: self, self: true });
  for (const p of tall) list.push({ y: p.y + 6, p });
  list.sort((a, b) => a.y - b.y);
  for (const it of list) {
    if (it.p) {
      const p = it.p, s = propSprite(p), w = s.c.width / 2;
      const under = Math.hypot(p.x - me.x, p.y - me.y) < s.r * 0.85;
      if (under) ctx.globalAlpha = 0.45;
      ctx.drawImage(s.c, p.x - w / 2, p.y - w / 2, w, w);
      ctx.globalAlpha = 1;
    } else drawEnt(it.o, it.self ? me.x : it.o.x, it.self ? me.y : it.o.y, now);
  }
  for (const c of visCastles) {
    const S = csz(c);
    ctx.drawImage(castleTop(c, facColor(owners.get(c.id)) || '#8a5a42'), c.x - S / 2, c.y - S / 2, S, S);
  }
  if (villageVis) ctx.drawImage(villageTop(), VILLAGE.x - VS / 2, VILLAGE.y - VS / 2, VS, VS);
  drawProjs(now);
  for (const it of list) if (it.o) drawLabels(it.o, it.self ? me.x : it.o.x, it.self ? me.y : it.o.y);
  for (const c of visCastles) {
    const f = facInfo.get(owners.get(c.id)), top = c.y - CASTLE_TYPES[c.type].outer;
    ctx.textAlign = 'center'; ctx.font = 'bold 16px Georgia'; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    ctx.strokeText(c.name, c.x, top - 50); ctx.fillStyle = '#fff4d8'; ctx.fillText(c.name, c.x, top - 50);
    ctx.font = '13px Georgia'; const lbl = (f ? 'Held by ' + f.name : 'Held by bandits') + ' · ' + '◆'.repeat(c.danger) + (levels.get(c.id) > 1 ? ' · level ' + levels.get(c.id) : '');
    ctx.strokeText(lbl, c.x, top - 32); ctx.fillStyle = f ? f.color : '#c8c0b0'; ctx.fillText(lbl, c.x, top - 32);
  }
  for (const cv of CAVES) if (Math.abs(cv.x - me.x) < hw + 100 && Math.abs(cv.y - me.y) < hh + 100) {
    const d = DUNGEONS[cv.dungeon];
    ctx.textAlign = 'center'; ctx.font = 'bold 15px Georgia'; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 4;
    ctx.strokeText(d.name, cv.x, cv.y - 66); ctx.fillStyle = '#e0d0ff'; ctx.fillText(d.name, cv.x, cv.y - 66);
    ctx.font = '12px Georgia'; const sub = 'Dungeon · ' + '◆'.repeat(d.danger) + ' · walk in to enter';
    ctx.strokeText(sub, cv.x, cv.y - 50); ctx.fillStyle = '#c8b8e8'; ctx.fillText(sub, cv.x, cv.y - 50);
  }
  drawBossBar();
  if (villageVis) {
    ctx.textAlign = 'center'; ctx.font = 'bold 16px Georgia'; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 4;
    ctx.strokeText('Hanbin Haven (safe zone)', VILLAGE.x, VILLAGE.y - VILLAGE.r - 18); ctx.fillStyle = '#b8f0b0'; ctx.fillText('Hanbin Haven (safe zone)', VILLAGE.x, VILLAGE.y - VILLAGE.r - 18);
  }
  drawFx(now);
  ctx.restore();
  drawChannel(now);
  // soft vignette, red when badly hurt
  const hurt = me.h < me.mh * 0.3 && !me.dead;
  if (hurt) ctx.globalAlpha = 0.75 + 0.25 * Math.sin(now / 200);
  ctx.drawImage(getVignette(hurt), 0, 0, VW, VH); ctx.globalAlpha = 1;
  if (++frameNo % 6 === 0) drawMinimap();
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ start
$('resetBtn').onclick = () => {
  const n = prof.skills.filter((s) => !SKILLS[s].free).length;
  if (!n) return toast('You have no skill points to reset.');
  if (Math.hypot(me.x - VILLAGE.x, me.y - VILLAGE.y) > VILLAGE.r) return toast('Go to Hanbin Haven to reset your skills.');
  if (confirm(`Refund all ${n} skill point${n === 1 ? '' : 's'}? Learned skills will be removed from your hotbar.`)) send({ t: 'reset' });
};
$('combolist').innerHTML = COMBOS.map(([n, d]) => `<li><b>${n}</b>: ${d}</li>`).join('');
applyBinds();
buildHotbar();
setMode('login');
showLogin();
if (store.get('hanbin_session') && store.get('hanbin_user')) connect();
