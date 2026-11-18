// Hanbin Island browser client: sign-in, rendering, HUD and input.
import {
  WORLD, REGIONS, CASTLES, VILLAGE, SKILLS, SKILL_LIST, TREES, MOBS, RANKS, ROADS, LAND_GRID, REGION_GRID, GW, GH, RC,
  rankOf, somaForTier, regionAt, moveBody, landValue, noise, fbm, roadDist, propsIn, rng,
} from './shared.mjs';
import { creature, playerLook, banner, prop, castleBase, castleTop, villageBase, villageTop, CASTLE_SPRITE_SIZE, VILLAGE_SPRITE_SIZE } from './sprites.mjs';

const { W: WW, H: WH, CASTLE_HALF: CH } = WORLD;
const $ = (id) => document.getElementById(id);
const cv = $('game'), ctx = cv.getContext('2d');
const mini = $('mini'), mctx = mini.getContext('2d');
let VW = innerWidth, VH = innerHeight, DPR = 1, zoom = 1;
function resize() {
  DPR = Math.min(2, devicePixelRatio || 1); VW = innerWidth; VH = innerHeight;
  cv.width = VW * DPR; cv.height = VH * DPR; cv.style.width = VW + 'px'; cv.style.height = VH + 'px';
  zoom = Math.max(0.55, Math.min(1.6, Math.min(VW / 1500, VH / 840)));
}
addEventListener('resize', resize); resize();

const BIOME_RGB = { grass: [92, 148, 64], forest: [70, 126, 56], darkforest: [48, 92, 52], snow: [228, 236, 242], rock: [132, 128, 120], ash: [86, 74, 70], swamp: [86, 104, 66], desert: [218, 190, 126], heath: [140, 146, 78] };
const BIOME_NAME = { grass: 'Meadows', forest: 'Forest', darkforest: 'Deep forest', snow: 'Tundra', rock: 'Highlands', ash: 'Ashlands', swamp: 'Marsh', desert: 'Dunes', heath: 'Heath' };
const STATUS = [[1, '💫', 'Stunned'], [4, '🐌', 'Slowed'], [8, '📉', 'Weakened'], [16, '⬆️', 'Rallied'], [32, '🛡️', 'Shielded'], [128, '🌿', 'Regenerating']];
const TALL = new Set(['tree', 'pine', 'dead', 'cactus']);

// ------------------------------------------------------------------ state
let ws = null, myId = null, started = false, chatOpen = false, connected = false;
const me = { x: VILLAGE.x, y: VILLAGE.y, sx: 0, sy: 0, h: 100, mh: 100, en: 100, me: 100, v: 0, s: 0, sp: 190, fl: 0, dead: 0, rs: 0, cz: -1, cp: 0, cdf: 0, ph: 0, init: false };
let prof = { skills: [], hotbar: [], pts: 0, slots: 5, tier: 0, fac: 0, name: '' };
const ents = new Map();
let projs = [], zones = [], fxs = [], floaters = [];
let meta = { c: [], f: [], lb: [], on: 0 };
const facInfo = new Map(), owners = new Map();
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
    case 'prof': prof = m; buildHotbar(); buildPassives(); if (panelOpen('skills')) renderSkills(); if (panelOpen('factions')) renderFactions(); break;
    case 'meta': {
      meta = m; facInfo.clear(); m.f.forEach((f) => facInfo.set(f.id, f));
      let changed = false;
      for (const [id, o] of m.c) if (owners.get(id) !== o) { owners.set(id, o); changed = true; }
      if (changed) miniDirty = true;
      if (panelOpen('factions')) renderFactions(); if (panelOpen('board')) renderBoard();
      break;
    }
    case 'chat': { const f = facInfo.get(m.f); addChat(m.sc === 'f' ? `[Faction] ${m.n}: ${m.m}` : `${f ? '[' + f.name + '] ' : ''}${m.n}: ${m.m}`, m.sc === 'f' ? '#7fd0ff' : (f ? f.color : '#eadfc4')); break; }
    case 'msg': addChat(m.m, m.c || '#cdbf9a'); break;
    case 'toast': toast(m.m); break;
    case 'gain': { const ex = []; if (m.v) ex.push('+' + m.v + ' valor'); if (m.s) ex.push('+' + m.s + ' soma'); if (ex.length) floaters.push({ x: me.x, y: me.y - 34 - Math.random() * 14, txt: ex.join('  '), c: '#d8b4ff', t0: performance.now(), life: 1400 }); break; }
    case 'died': lastDeath = m; break;
  }
}
function onSnap(m) {
  const prevH = me.h;
  Object.assign(me, m.me);
  me.sx = m.me.x; me.sy = m.me.y;
  if (!me.init) { me.x = me.sx; me.y = me.sy; me.init = true; }
  if (me.h < prevH) me.flash = performance.now();
  for (const [id, c] of m.me.cd) cdReady[id] = performance.now() + c;
  seq++;
  const now = performance.now();
  for (const e of m.e) {
    let o = ents.get(e.i);
    if (!o) { o = { x: e.x, y: e.y, ph: Math.random() * 6, h: e.h }; ents.set(e.i, o); }
    if (e.h < o.h) o.flash = now;
    o.tx = e.x; o.ty = e.y; o.k = e.k; o.a = e.a; o.h = e.h; o.m = e.m; o.fl = e.fl; o.n = e.n; o.f = e.f; o.rk = e.rk; o.ow = e.ow; o.wp = e.wp; o.at = e.at; o.sp = e.sp; o.seq = seq; o.id = e.i;
  }
  for (const [id, o] of ents) if (o.seq !== seq) ents.delete(id);
  projs = m.pr; zones = m.zs;
  for (const f of m.fx) {
    if (f.t === 'dmg') floaters.push({ x: f.x + (Math.random() * 14 - 7), y: f.y, txt: String(f.v), c: '#ffd0c0', t0: now, life: 800 });
    else if (f.t === 'heal') floaters.push({ x: f.x, y: f.y, txt: '+' + f.v, c: '#8fe8a0', t0: now, life: 900 });
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
  $('regionlbl').innerHTML = `<b>${reg.name}</b> <span class="dim">· ${BIOME_NAME[reg.biome]}${reg.danger ? ' · danger ' + '◆'.repeat(reg.danger) : ' · safe haven'}</span>${of ? `<br><span style="color:${of.color}">Held by ${esc(of.name)}</span>` : ''}<br><span class="dim">${meta.on} online</span>`;
  const cap = $('capture');
  if (me.cz >= 0 && !me.dead) {
    const co = owners.get(me.cz), cf = co && facInfo.get(co), c = CASTLES.find((k) => k.id === me.cz);
    cap.style.display = 'block';
    $('captxt').innerHTML = `<b>${c.name}</b> · ${cf ? esc(cf.name) : 'Bandit-held'}<br>${cf && cf.id === prof.fac ? 'Your faction holds this castle.' : me.cdf > 0 ? me.cdf + ' defender' + (me.cdf > 1 ? 's' : '') + ' remaining' : prof.fac ? (me.cp > 0 ? 'Capturing...' : 'Undefended! Hold the courtyard.') : 'Join a faction to claim castles.'}`;
    $('capbar').style.width = me.cp * 100 + '%';
  } else cap.style.display = 'none';
  $('death').style.display = me.dead ? 'flex' : 'none';
  if (me.dead && lastDeath) $('deathtxt').textContent = `You lost ${lastDeath.lost} valor${lastDeath.by ? ' to ' + lastDeath.by : ''}. Your soma is safe. Respawning in ${Math.ceil(me.rs / 1000)}...`;
}
setInterval(() => { if (started) updateHud(); }, 100);
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
const PANELS = ['skills', 'factions', 'board', 'help', 'map', 'keys'];
const panelOpen = (id) => $(id).style.display === 'block';
function togglePanel(id) {
  const open = panelOpen(id);
  for (const p of PANELS) $(p).style.display = 'none';
  if (!open) {
    $(id).style.display = 'block';
    if (id === 'skills') renderSkills(); if (id === 'factions') renderFactions(); if (id === 'board') renderBoard(); if (id === 'map') renderMap(); if (id === 'keys') renderKeys();
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
function renderFactions() {
  const b = $('facbody'); b.innerHTML = '';
  const mine = facInfo.get(prof.fac);
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
  }
  b.appendChild(el('h4', '', 'All factions'));
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
function drawMinimap() {
  if (miniDirty && facInfo.size >= 0) rebuildOwned();
  const mw = mini.width, mh = mini.height, sx = mw / WW, sy = mh / WH;
  mctx.imageSmoothingEnabled = true; mctx.drawImage(ownedMap, 0, 0, mw, mh);
  for (const c of CASTLES) { const f = facInfo.get(owners.get(c.id)); mctx.fillStyle = f ? f.color : '#ddd'; mctx.strokeStyle = '#000'; mctx.fillRect(c.x * sx - 3, c.y * sy - 3, 6, 6); mctx.strokeRect(c.x * sx - 3, c.y * sy - 3, 6, 6); }
  mctx.fillStyle = '#7f7'; mctx.beginPath(); mctx.arc(VILLAGE.x * sx, VILLAGE.y * sy, 3.5, 0, 7); mctx.fill();
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
    const c2 = CASTLES.find((k) => k.id === r.id), f = facInfo.get(owners.get(r.id));
    if (c2) { m.fillStyle = f ? f.color : '#ddd'; m.strokeStyle = '#000'; m.lineWidth = 1.5; m.fillRect(r.x * sx - 5, r.y * sy - 5, 10, 10); m.strokeRect(r.x * sx - 5, r.y * sy - 5, 10, 10); }
    else { m.fillStyle = '#7f7'; m.beginPath(); m.arc(r.x * sx, r.y * sy, 6, 0, 7); m.fill(); }
    m.strokeStyle = 'rgba(0,0,0,.8)'; m.lineWidth = 3; m.fillStyle = '#fff';
    m.strokeText(r.name, r.x * sx, r.y * sy - 10); m.fillText(r.name, r.x * sx, r.y * sy - 10);
    m.font = '10px Georgia'; const sub = r.danger ? (f ? f.name : 'Bandits') + ' · ' + '◆'.repeat(r.danger) : 'Safe haven';
    m.strokeText(sub, r.x * sx, r.y * sy + 18); m.fillStyle = f ? f.color : '#ccc'; m.fillText(sub, r.x * sx, r.y * sy + 18); m.font = 'bold 12px Georgia';
  }
  m.fillStyle = '#fff'; m.strokeStyle = '#000'; m.lineWidth = 2; m.beginPath(); m.arc(me.x * sx, me.y * sy, 5, 0, 7); m.fill(); m.stroke();
}

// ------------------------------------------------------------------ input
const worldMouse = () => ({ x: me.x + (mouseX - VW / 2) / zoom, y: me.y + (mouseY - VH / 2) / zoom });
function aimAngle() { return Math.atan2(mouseY - VH / 2, mouseX - VW / 2); }
// Rebindable keys, stored per browser as KeyboardEvent.code values (layout-independent).
const ACTIONS = [
  ['up', 'Move up', 'KeyW'], ['down', 'Move down', 'KeyS'], ['left', 'Move left', 'KeyA'], ['right', 'Move right', 'KeyD'],
  ...Array.from({ length: 10 }, (_, i) => ['slot' + i, `Hotbar slot ${i + 1}`, 'Digit' + ((i + 1) % 10)]),
  ['skills', 'Skill trees', 'KeyK'], ['factions', 'Factions', 'KeyF'], ['map', 'World map', 'KeyM'], ['board', 'Leaderboard', 'Tab'],
  ['help', 'Help', 'KeyH'], ['keys', 'Keybinds', 'KeyO'], ['chat', 'Open chat', 'Enter'],
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
let lastK = -1, lastA = 0, lastSent = 0;
setInterval(() => {
  if (!connected) return;
  const k = mask(), a = aimAngle(), now = performance.now();
  if (k !== lastK || Math.abs(a - lastA) > 0.04 || now - lastSent > 400) { send({ t: 'in', k, a: +a.toFixed(3) }); lastK = k; lastA = a; lastSent = now; }
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
const CHUNK = 512, RES = 4, NPX = CHUNK / RES, chunks = new Map(), SAND = [222, 206, 150], DIRT = [150, 118, 78];
const tmp = document.createElement('canvas'); tmp.width = NPX; tmp.height = NPX; const tctx = tmp.getContext('2d');
function buildChunk(cx, cy) {
  const img = tctx.createImageData(NPX, NPX), d = img.data, x0 = cx * CHUNK, y0 = cy * CHUNK;
  const roads = ROADS.filter((r) => Math.max(r.x0, r.x1) > x0 - 40 && Math.min(r.x0, r.x1) < x0 + CHUNK + 40 && Math.max(r.y0, r.y1) > y0 - 40 && Math.min(r.y0, r.y1) < y0 + CHUNK + 40);
  for (let j = 0; j < NPX; j++) for (let i = 0; i < NPX; i++) {
    const x = x0 + i * RES + RES / 2, y = y0 + j * RES + RES / 2, lv = landValue(x, y), o = (j * NPX + i) * 4;
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
  tctx.putImageData(img, 0, 0);
  const c = document.createElement('canvas'); c.width = CHUNK; c.height = CHUNK;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  x.drawImage(tmp, 0, 0, CHUNK, CHUNK);
  // scattered grass tufts, flowers and pebbles
  const R = rng(cx * 7919 + cy * 104729);
  for (let k = 0; k < 90; k++) {
    const px = R() * CHUNK, py = R() * CHUNK, wx = x0 + px, wy = y0 + py;
    if (landValue(wx, wy) < 0.05 || roadDist(wx, wy, roads) < 30) continue;
    const biome = REGIONS[regionAt(wx, wy)].biome, roll = R();
    if (biome === 'grass' || biome === 'forest' || biome === 'heath' || biome === 'swamp' || biome === 'darkforest') {
      x.strokeStyle = biome === 'heath' ? 'rgba(90,80,30,.5)' : 'rgba(30,70,20,.45)'; x.lineWidth = 1.4;
      for (let t = -1; t <= 1; t++) { x.beginPath(); x.moveTo(px + t * 2, py); x.lineTo(px + t * 3.5, py - 6 - R() * 3); x.stroke(); }
      if (roll < 0.18 && biome !== 'darkforest') { x.fillStyle = ['#f6f0a0', '#f080a0', '#ffffff', '#b090f0'][Math.floor(R() * 4)]; x.beginPath(); x.arc(px + 4, py - 3, 1.8, 0, 7); x.fill(); }
    } else if (biome === 'desert' || biome === 'rock' || biome === 'ash') {
      x.fillStyle = biome === 'ash' ? 'rgba(30,20,20,.35)' : 'rgba(80,60,40,.3)'; x.beginPath(); x.ellipse(px, py, 2 + R() * 3, 1.5 + R() * 2, R() * 3, 0, 7); x.fill();
      if (biome === 'ash' && roll < 0.1) { x.fillStyle = 'rgba(255,110,40,.6)'; x.beginPath(); x.arc(px + 5, py, 1.6, 0, 7); x.fill(); }
    } else if (biome === 'snow') {
      x.fillStyle = 'rgba(160,180,200,.35)'; x.beginPath(); x.ellipse(px, py, 6 + R() * 6, 2, 0, 0, 7); x.fill();
    }
  }
  return c;
}
let chunkBudget = 0;
function getChunk(cx, cy) {
  const k = cy * 100 + cx;
  let c = chunks.get(k);
  if (c) { c.used = performance.now(); return c.canvas; }
  if (chunkBudget <= 0) return null;
  chunkBudget--;
  c = { canvas: buildChunk(cx, cy), used: performance.now() };
  chunks.set(k, c);
  if (chunks.size > 48) { const old = [...chunks.entries()].sort((a, b) => a[1].used - b[1].used).slice(0, 8); for (const [ok] of old) chunks.delete(ok); }
  return c.canvas;
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
  if (o.fl & 2) { ctx.strokeStyle = 'rgba(80,200,240,.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 8, 0, 7); ctx.stroke(); }
  if (o.fl & 16) { ctx.strokeStyle = 'rgba(240,190,70,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 11, now / 300, now / 300 + 4.5); ctx.stroke(); }
  const step = Math.sin(o.ph || 0) * (o.moving ? 1 : 0);
  const look = o.k === 'player' ? playerLook(o.n || prof.name, o.rk || 0, facColor(o.f), o.wp) : null;
  const img = creature(o.k, creatureColor(o), step, o.at || o.sp, look);
  const w = img.width / 2 * 1.3, h = img.height / 2 * 1.3;
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.sp ? now / 60 : (self ? aimAngle() : o.a));
  if (o.k === 'wraith') ctx.globalAlpha = 0.85;
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
  } else if (o.h < o.m || o.ow) {
    ctx.font = '10px Georgia'; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 3; const nm = MOBS[o.k] ? MOBS[o.k].name : o.k;
    ctx.strokeText(nm, x, y - r - 18); ctx.fillStyle = ally ? '#a8e0f0' : '#f0d8c8'; ctx.fillText(nm, x, y - r - 18);
  }
  let n = 0; ctx.font = '11px serif';
  for (const [bit, ic] of STATUS) if (o.fl & bit) { ctx.fillText(ic, x - 14 + n * 14, y + r + 16); n++; }
}
function drawProjs(now) {
  for (const [x, y, k, a] of projs) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    if (k === 'fire' || k === 'dark') {
      const c1 = k === 'fire' ? '255,140,40' : '170,90,255';
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
  for (const f of floaters) { const p = (now - f.t0) / f.life; ctx.globalAlpha = 1 - p * p; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeText(f.txt, f.x, f.y - p * 34); ctx.fillStyle = f.c; ctx.fillText(f.txt, f.x, f.y - p * 34); ctx.globalAlpha = 1; }
}

// ------------------------------------------------------------------ frame
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  // self prediction with the same collision as the server, then gentle reconciliation
  const k = mask();
  const dx = ((k & 8) ? 1 : 0) - ((k & 4) ? 1 : 0), dy = ((k & 2) ? 1 : 0) - ((k & 1) ? 1 : 0), len = Math.hypot(dx, dy);
  const ox = me.x, oy = me.y;
  if (len > 0 && !me.dead && me.sp > 0) [me.x, me.y] = moveBody(me.x, me.y, 14, (dx / len) * me.sp * dt, (dy / len) * me.sp * dt);
  const ex = me.sx - me.x, ey = me.sy - me.y;
  if (Math.hypot(ex, ey) > 160) { me.x = me.sx; me.y = me.sy; } else { const f = Math.min(1, dt * 5); me.x += ex * f; me.y += ey * f; }
  const moved = Math.hypot(me.x - ox, me.y - oy);
  me.ph += moved * 0.22; me.moving = moved > 0.3;
  const f2 = Math.min(1, dt * 14);
  for (const o of ents.values()) {
    const px = o.x, py = o.y;
    o.x += (o.tx - o.x) * f2; o.y += (o.ty - o.y) * f2;
    const m2 = Math.hypot(o.x - px, o.y - py); o.ph += m2 * 0.22; o.moving = m2 > 0.2;
  }

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#20406a'; ctx.fillRect(0, 0, VW, VH);
  ctx.save(); ctx.translate(VW / 2, VH / 2); ctx.scale(zoom, zoom); ctx.translate(-me.x, -me.y);
  const hw = VW / 2 / zoom, hh = VH / 2 / zoom, x0 = me.x - hw, y0 = me.y - hh, x1 = me.x + hw, y1 = me.y + hh;
  // ground: build the nearest missing chunks first, a couple per frame
  chunkBudget = 2;
  const need = [];
  for (let cy = Math.floor(y0 / CHUNK); cy <= Math.floor(y1 / CHUNK); cy++) for (let cx = Math.floor(x0 / CHUNK); cx <= Math.floor(x1 / CHUNK); cx++) need.push([cx, cy]);
  need.sort((a, b) => Math.hypot(a[0] * CHUNK + 256 - me.x, a[1] * CHUNK + 256 - me.y) - Math.hypot(b[0] * CHUNK + 256 - me.x, b[1] * CHUNK + 256 - me.y));
  for (const [cx, cy] of need) {
    if (cx < 0 || cy < 0 || cx * CHUNK >= WW || cy * CHUNK >= WH) continue;
    const c = getChunk(cx, cy);
    if (c) ctx.drawImage(c, cx * CHUNK, cy * CHUNK, CHUNK + 0.5, CHUNK + 0.5);
    else { ctx.fillStyle = '#4a6a3a'; ctx.fillRect(cx * CHUNK, cy * CHUNK, CHUNK, CHUNK); }
  }
  const CS = CASTLE_SPRITE_SIZE, VS = VILLAGE_SPRITE_SIZE;
  const visCastles = CASTLES.filter((c) => c.x + CS / 2 > x0 && c.x - CS / 2 < x1 && c.y + CS / 2 > y0 && c.y - CS / 2 < y1);
  for (const c of visCastles) ctx.drawImage(castleBase(c.id), c.x - CS / 2, c.y - CS / 2, CS, CS);
  const villageVis = Math.abs(VILLAGE.x - me.x) < hw + VS && Math.abs(VILLAGE.y - me.y) < hh + VS;
  if (villageVis) ctx.drawImage(villageBase(), VILLAGE.x - VS / 2, VILLAGE.y - VS / 2, VS, VS);
  // low props, zones, then everything with height sorted by y
  const props = propsIn(x0 - 60, y0 - 60, x1 + 60, y1 + 60), tall = [];
  for (const p of props) {
    if (TALL.has(p.k)) { tall.push(p); continue; }
    const s = prop(p.k, p.v, REGIONS[regionAt(p.x, p.y)].biome), w = s.c.width / 2;
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
      const p = it.p, s = prop(p.k, p.v, REGIONS[regionAt(p.x, p.y)].biome), w = s.c.width / 2;
      const under = Math.hypot(p.x - me.x, p.y - me.y) < s.r * 0.85;
      if (under) ctx.globalAlpha = 0.45;
      ctx.drawImage(s.c, p.x - w / 2, p.y - w / 2, w, w);
      ctx.globalAlpha = 1;
    } else drawEnt(it.o, it.self ? me.x : it.o.x, it.self ? me.y : it.o.y, now);
  }
  for (const c of visCastles) {
    const inside = Math.abs(me.x - c.x) < CH && Math.abs(me.y - c.y) < CH;
    ctx.globalAlpha = inside ? 0.92 : 1;
    ctx.drawImage(castleTop(c.id, facColor(owners.get(c.id)) || '#8a5a42'), c.x - CS / 2, c.y - CS / 2, CS, CS);
    ctx.globalAlpha = 1;
  }
  if (villageVis) ctx.drawImage(villageTop(), VILLAGE.x - VS / 2, VILLAGE.y - VS / 2, VS, VS);
  drawProjs(now);
  for (const it of list) if (it.o) drawLabels(it.o, it.self ? me.x : it.o.x, it.self ? me.y : it.o.y);
  for (const c of visCastles) {
    const f = facInfo.get(owners.get(c.id));
    ctx.textAlign = 'center'; ctx.font = 'bold 16px Georgia'; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    ctx.strokeText(c.name, c.x, c.y - CH - 50); ctx.fillStyle = '#fff4d8'; ctx.fillText(c.name, c.x, c.y - CH - 50);
    ctx.font = '13px Georgia'; const lbl = f ? 'Held by ' + f.name : 'Held by bandits';
    ctx.strokeText(lbl, c.x, c.y - CH - 32); ctx.fillStyle = f ? f.color : '#c8c0b0'; ctx.fillText(lbl, c.x, c.y - CH - 32);
  }
  if (villageVis) {
    ctx.textAlign = 'center'; ctx.font = 'bold 16px Georgia'; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 4;
    ctx.strokeText('Hanbin Haven (safe zone)', VILLAGE.x, VILLAGE.y - VILLAGE.r - 18); ctx.fillStyle = '#b8f0b0'; ctx.fillText('Hanbin Haven (safe zone)', VILLAGE.x, VILLAGE.y - VILLAGE.r - 18);
  }
  drawFx(now);
  ctx.restore();
  // soft vignette and a red edge when hurt
  const vg = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.45, VW / 2, VH / 2, Math.max(VW, VH) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, me.h < me.mh * 0.3 && !me.dead ? `rgba(120,0,0,${0.35 + 0.15 * Math.sin(now / 200)})` : 'rgba(0,0,0,.35)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  drawMinimap();
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ start
$('resetBtn').onclick = () => {
  const n = prof.skills.filter((s) => !SKILLS[s].free).length;
  if (!n) return toast('You have no skill points to reset.');
  if (Math.hypot(me.x - VILLAGE.x, me.y - VILLAGE.y) > VILLAGE.r) return toast('Go to Hanbin Haven to reset your skills.');
  if (confirm(`Refund all ${n} skill point${n === 1 ? '' : 's'}? Learned skills will be removed from your hotbar.`)) send({ t: 'reset' });
};
applyBinds();
buildHotbar();
setMode('login');
showLogin();
if (store.get('hanbin_session') && store.get('hanbin_user')) connect();
