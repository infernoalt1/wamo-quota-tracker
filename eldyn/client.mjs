// Hanbin Island browser client: sign-in, rendering, HUD and input.
import {
  WORLD, REGIONS, CASTLES, VILLAGE, MOBS, RANKS, ROADS, LAND_GRID, REGION_GRID, GW, GH, RC, RANK,
  rankOf, somaForTier, regionAt, moveBody, landValue, roadDist, propsIn, rng,
  CASTLE_TYPES, DUNGEONS, CAVES, DGRID, DT_SIZE, CASTLE_LEVEL_COST, CAP_LIFT, PRIVATE_MAX, dungeonAt, ISLANDS, landBase, BRIDGES, BRIDGE_W,
} from './shared.mjs';
import { TOOLS, TOOL_LIST, PATHS, GROUPS, SLOTS, SLOT_TIERS, slotsFor, START_KIT, TURN_RATE, BACKPEDAL, BACKPEDAL_ANGLE, owns, unlockCheck, toolStats, isPlaced, RESPEC_COST, isAttack, actionTime } from './builds.mjs';
import { BIOME_RGB, chunkPixels } from './terrain.mjs';
import { toolImg, statusCanvas, uiImg, uiIcon } from './icons.mjs';
import { creature, playerLook, banner, prop, castleBase, castleTop, castleSize, caveSprite, portalSprite, villageBase, villageTop, VILLAGE_SPRITE_SIZE, TOOL_SPRITE, weaponSprite, SWINGS, lookScale } from './sprites.mjs';
import * as feel from './feel.mjs';

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
  const g = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.55, hurt ? 'rgba(90,0,0,.25)' : 'rgba(0,0,0,.28)'); g.addColorStop(1, hurt ? 'rgba(110,0,0,.7)' : 'rgba(0,0,0,.72)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  vignette = c; vignetteHurt = hurt;
  return c;
}
addEventListener('resize', resize); resize();

const BIOME_NAME = { grass: 'Meadows', forest: 'Forest', darkforest: 'Deep forest', snow: 'Tundra', rock: 'Highlands', ash: 'Ashlands', swamp: 'Marsh', desert: 'Dunes', heath: 'Heath' };
const STATUS = [1, 4, 8, 16, 32, 64, 128, 256]; // rooted, slowed, weakened, empowered, shield up, travelling, healing, hurting over time
const TALL = new Set(['tree', 'pine', 'dead', 'cactus']);
const angDiff = (a, b) => Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
const turnToward = (a, b, max) => { const d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; return a + Math.max(-max, Math.min(max, d)); };

// ------------------------------------------------------------------ state
let ws = null, myId = null, started = false, chatOpen = false, connected = false;
const me = { x: VILLAGE.x, y: VILLAGE.y, sx: 0, sy: 0, h: 80, mh: 80, v: 0, cap: 5000, s: 0, w: 0, sp: 190, fl: 0, dead: 0, rs: 0, cz: -1, cp: 0, cdf: 0, ph: 0, ang: 0, init: false, gcd: [], q: -1 };
let prof = { unlocked: [], belt: [], keys: 0, tier: 0, fac: 0, name: '', rank: 0, maxhp: 80, vet: 0, code: null, spots: [] };
const ents = new Map();
let projs = [], zones = [], fxs = [], floaters = [], radar = { e: [], a: [] };
let meta = { c: [], f: [], lb: [], on: 0, bosses: [] };
const facInfo = new Map(), owners = new Map(), levels = new Map();
let loot = [];
const gcdEnd = {}, gcdTotal = {};
let seq = 0, lastDeath = null, rallyFrom = null;
const keys = {}, held = new Set(), toggled = new Set(), lastPress = {};
let mouseX = VW / 2, mouseY = VH / 2, kbTurn = null;
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } } };
// A private faction share link (?join=CODE) is remembered until you are in the game.
const joinCode = new URLSearchParams(location.search).get('join');

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
    case 'welcome':
      myId = m.id; connected = true; me.init = false; ents.clear(); $('login').style.display = 'none';
      if (joinCode) { send({ t: 'fjc', code: joinCode }); history.replaceState(null, '', location.pathname); }
      if (!started) { started = true; requestAnimationFrame(frame); }
      break;
    case 'prof': prof = m; buildHotbar(); if (panelOpen('skills')) renderSkills(); if (panelOpen('factions')) renderFactions(); break;
    case 'meta': {
      meta = m; facInfo.clear(); m.f.forEach((f) => facInfo.set(f.id, f));
      let changed = false;
      for (const [id, o, lv] of m.c) { levels.set(id, lv); if (owners.get(id) !== o) { owners.set(id, o); changed = true; } }
      if (changed) miniDirty = true;
      if (panelOpen('factions')) renderFactions(); if (panelOpen('board')) renderBoard();
      renderRankings();
      break;
    }
    case 'radar': radar = m; break;
    case 'chat': {
      const f = facInfo.get(m.f), tag = m.sc === 'f' ? '[Faction] ' : m.sc === 'w' ? '[World] ' : '';
      addChat(`${tag}${f && m.sc !== 'f' ? '[' + f.name + '] ' : ''}${m.n}: ${m.m}`, m.sc === 'f' ? '#7fd0ff' : m.sc === 'w' ? '#ffd890' : (f ? f.color : '#eadfc4'));
      break;
    }
    case 'msg': addChat(m.m, m.c || '#cdbf9a'); break;
    case 'err': toast(m.m); addChat(m.m, '#f08070'); break;
    case 'toast': if (/^Soma tier/.test(m.m)) feel.sfx('level'); toast(m.m); break;
    case 'gain': { const ex = []; if (m.v) ex.push('+' + m.v + ' valor'); if (m.s) ex.push('+' + m.s + ' soma'); if (m.g) ex.push('+' + m.g + ' gold'); if (m.w) ex.push('+' + m.w + ' wood'); if (ex.length) floaters.push({ x: me.x, y: me.y - 34 - Math.random() * 14, txt: ex.join('  '), c: '#d8b4ff', t0: performance.now(), life: 1400 }); break; }
    case 'died': lastDeath = m; deathShown = null; break;
    case 'rally': rallyFrom = { id: m.id, n: m.n, until: performance.now() + 30000 }; showRally(); break;
  }
}
function onSnap(m) {
  const prevH = me.h;
  // Your own position is predicted locally; only take the server's after a forced move (dash, push,
  // teleport, respawn) or if the two have drifted far apart.
  const { x, y, ...rest } = m.me;
  Object.assign(me, rest);
  me.sx = x; me.sy = y;
  if (!me.init || m.me.tp !== me.tpSeen || Math.hypot(x - me.x, y - me.y) > 220) { me.x = x; me.y = y; me.init = true; me.tpSeen = m.me.tp; me.ang = m.me.a; }
  if (me.h < prevH) me.flash = performance.now();
  const now = performance.now();
  for (const g in gcdEnd) gcdEnd[g] = 0;
  for (const [g, rem, total] of m.me.gcd) { gcdEnd[g] = now + rem; gcdTotal[g] = total; }
  seq++;
  for (const e of m.e) {
    let o = ents.get(e.i);
    if (!o) { o = { x: e.x, y: e.y, ph: Math.random() * 6, h: e.h, buf: [] }; ents.set(e.i, o); }
    if (e.h < o.h) o.flash = now;
    if (e.at !== undefined) { const st = animNow - e.at; if (!o.atkStart || o.atkTool !== e.lt || Math.abs(st - o.atkStart) > 150) { o.atkStart = st; o.atkTool = e.lt; } }
    o.buf.push([now, e.x, e.y]); if (o.buf.length > 8) o.buf.shift();
    Object.assign(o, { k: e.k, a: e.a, h: e.h, m: e.m, fl: e.fl, n: e.n, f: e.f, rk: e.rk, ti: e.ti, ow: e.ow, wp: e.wp, sh: e.sh, at: e.at, sp: e.sp, el: e.el, enr: e.en, iv: e.iv || 0, vt: e.vt, seq, id: e.i });
  }
  for (const [id, o] of ents) if (o.seq !== seq) ents.delete(id);
  projs = m.pr; zones = m.zs; loot = m.lt || [];
  for (const f of m.fx) {
    const ddx = f.x - me.x, dd = Math.hypot(ddx, f.y - me.y);
    if (f.t === 'dmg') {
      const mine = f.by === myId, onMe = f.to === myId, big = f.v >= 14;
      floaters.push({ x: f.x + (Math.random() * 14 - 7), y: f.y, txt: String(f.v), c: onMe ? '#ff6050' : mine ? (big ? '#ffd040' : '#fff0d0') : '#e0b8a8', t0: now, life: 900, big: mine && big ? 1 : 0, pop: mine || onMe });
      if (!f.dot) feel.spill(f.x, f.y + 10, f.a || 0, f.v, f.k, now);
      if (mine) { feel.sfx(f.sh ? 'block' : big ? 'hithard' : 'hit'); feel.shake(f.dot ? 0 : 2 + Math.min(5, f.v / 5)); if (!f.dot) feel.stop(big ? 75 : 50, now); }
      else if (onMe) { feel.sfx(f.sh ? 'block' : 'hurt'); feel.shake(4 + Math.min(7, f.v / 3)); feel.hurtFlash(now); }
      else if (!f.dot) feel.sfx(f.sh ? 'block' : 'hit', ddx, dd, 0.55);
      continue;
    }
    if (f.t === 'die') { feel.addBody(f, now); feel.sfx('die', ddx, dd, f.k === 'player' ? 1 : 0.6); if (f.k === 'logs') feel.sfx('wood', ddx, dd); continue; }
    if ((f.t === 'arc' || f.t === 'thrust') && f.i === myId && now - lastPredict < 2500) continue; // already shown when you pressed
    if (f.t === 'arc') feel.sfx(f.w > 2.5 ? 'heavy' : 'swing', ddx, dd, 0.6);
    else if (f.t === 'thrust') feel.sfx('thrust', ddx, dd, 0.6);
    else if (f.t === 'boom') feel.sfx('boom', ddx, dd);
    else if (f.t === 'parry') feel.sfx('block', ddx, dd);
    if (f.t === 'heal') { floaters.push({ x: f.x, y: f.y, txt: '+' + f.v, c: '#8fe8a0', t0: now, life: 900 }); if (dd < 40) feel.sfx('heal', 0, 0, 0.5); }
    else if (f.t === 'combo') floaters.push({ x: f.x, y: f.y, txt: f.txt + '!', c: '#ffe066', t0: now, life: 1100, big: 1 });
    else { f.t0 = now; f.seed = Math.random() * 1000; fxs.push(f); }
  }
}

// ------------------------------------------------------------------ toolbelt / HUD
// Ten slots: the open ones show their key, tool and the cooldown of the tool's group; the rest show the tier that opens them.
function slotKey(i) { return keyName(binds['slot' + i]); }
function buildHotbar() {
  const hb = $('hotbar'); hb.innerHTML = '';
  const open = slotsFor(prof.tier || 0);
  for (let i = 0; i < SLOTS; i++) {
    const d = el('div', 'slot ability');
    if (i >= open) {
      d.classList.add('locked');
      d.innerHTML = `<span class="key">${slotKey(i)}</span><img class="lk" src="${uiIcon('lock')}" alt=""><span class="lt">Tier ${SLOT_TIERS[i]}</span><div class="cd"></div><span class="cdt"></span>`;
      d.title = `Toolbelt slot ${i + 1} opens at Soma tier ${SLOT_TIERS[i]}.`;
      hb.appendChild(d); continue;
    }
    const id = prof.belt[i], t = id && TOOLS[id];
    if (t) d.style.setProperty('--tc', PATHS.find((p) => p.id === t.path).color); else d.classList.add('empty');
    d.innerHTML = `<span class="key">${slotKey(i)}</span>${t ? toolImg(t.id) : ''}<div class="cd"></div><span class="cdt"></span>${t && t.wood ? `<span class="en">${t.wood}<img src="${uiIcon('wood')}" alt=""></span>` : t && t.gold ? `<span class="en">${t.gold}<img src="${uiIcon('coin')}" alt=""></span>` : ''}`;
    d.title = t ? `${t.name}: ${t.desc}\n${toolStats(t)}${isPlaced(t) ? '\nAims at your cursor.' : ''}\nHold to repeat · double-click during cooldown to queue · ${keyName(binds.toggle)} + key toggles auto-repeat` : 'Empty slot. Equip a tool from the Tools panel (K) in Hanbin Haven or one of your castles.';
    d.addEventListener('mousedown', (e) => { e.stopPropagation(); if (!panelOpen('skills')) togglePanel('skills'); if (t) { skillSel = t.id; treeTab = t.path; renderSkills(); } });
    d.addEventListener('contextmenu', (e) => { e.preventDefault(); if (me.mg) send({ t: 'belt', s: i, id: null }); });
    hb.appendChild(d);
  }
}
function updateHud() {
  const r = rankOf(me.v);
  $('valnum').textContent = spaced(me.v); $('somanum').textContent = spaced(me.s);
  $('bars').firstElementChild.classList.toggle('low', me.h < me.mh * 0.5); $('bars').firstElementChild.classList.toggle('crit', me.h < me.mh * 0.25);
  $('pname').innerHTML = (prof.vet ? uiImg('star', 'Veteran') : '') + esc(prof.name || '');
  $('pname').title = prof.vet ? 'Veteran: played before Season 3' : '';
  $('prank').textContent = r.name;
  $('valbar').style.width = (r.next ? Math.min(1, (me.v - r.cur) / (r.next - r.cur)) : 1) * 100 + '%';
  $('valtxt').textContent = `Valor ${me.v}${r.next ? ' / ' + r.next : ''} · cap ${me.cap}`;
  $('valtxt').parentElement.title = `Valor lasts one life. Your faction's territory sets the cap (${me.cap}).${r.next && r.next > me.cap ? ` ${RANKS[r.idx + 1].name} needs ${r.next}: your faction must hold more land.` : ''}`;
  const t = prof.tier, a = somaForTier(t), b = somaForTier(t + 1);
  $('somabar').style.width = ((me.s - a) / (b - a)) * 100 + '%';
  $('somatxt').textContent = `Soma tier ${t} · ${me.s.toLocaleString()} / ${b.toLocaleString()}`;
  $('ptsrow').innerHTML = prof.keys > 0 ? `${uiImg('key')} ${prof.keys} key${prof.keys > 1 ? 's' : ''} to spend (K)` : '';
  $('goldrow').innerHTML = `${uiImg('coin', 'Gold')} <b>${me.b || 0}</b> banked${me.g ? ` · <span class="carry">${me.g} carried</span>` : ''} · ${uiImg('wood', 'Wood')} <b>${me.w || 0}</b> wood`;
  const f = facInfo.get(prof.fac);
  $('facrow').innerHTML = f ? `<span class="dot" style="background:${f.color}"></span>${esc(f.name)}${f.pub ? ' (public)' : ''}` : '';
  $('facrow').style.color = f ? f.color : '#a99';
  $('hpbar').style.width = Math.max(0, me.h / me.mh) * 100 + '%'; $('hptxt').textContent = `${Math.max(0, Math.ceil(me.h))} / ${me.mh}`;
  const now = performance.now(), slots = $('hotbar').querySelectorAll('.ability');
  for (let i = 0; i < slots.length; i++) {
    const id = prof.belt[i], t = id && TOOLS[id], cdEl = slots[i].querySelector('.cd'), cdt = slots[i].querySelector('.cdt');
    slots[i].classList.toggle('tog', toggled.has(i)); slots[i].classList.toggle('sel', me.q === i);
    if (!t) { cdEl.style.height = '0'; cdt.textContent = ''; continue; }
    const rem = Math.max((gcdEnd[t.id] || 0), localCd[t.id] || 0) - now;
    cdEl.style.height = rem > 0 ? Math.min(100, (rem / (gcdTotal[t.id] || t.cd)) * 100) + '%' : '0';
    cdt.textContent = rem > 950 ? Math.ceil(rem / 1000) : '';
    slots[i].classList.toggle('noen', !!(t.wood && (me.w || 0) < t.wood) || !!(t.gold && (me.b || 0) < t.gold));
  }
  const ri = regionAt(me.x, me.y), reg = REGIONS[ri], own = owners.get(ri), of = own && facInfo.get(own);
  const dg = reg.dungeon !== undefined ? DUNGEONS[reg.dungeon] : null, bossWait = dg && meta.bosses ? meta.bosses[dg.id] : 0;
  $('regionlbl').innerHTML = dg ? `<b>${reg.name}</b> <span class="dim">· dungeon · danger ${'◆'.repeat(reg.danger)}</span><br><span class="dim">${bossWait ? 'Boss returns in ' + Math.ceil(bossWait / 60000) + ' min' : 'The boss waits in the deepest room'}</span>`
    : `<b>${reg.name}</b> <span class="dim">· ${ISLANDS[reg.island].name}</span><br><span class="dim">${BIOME_NAME[reg.biome]}${reg.danger ? ' · danger ' + '◆'.repeat(reg.danger) : ' · safe haven'}</span>${of ? `<br><span style="color:${of.color}">Held by ${esc(of.name)}</span>` : ''}<br><span class="dim">${meta.on} online</span>`;
  const cap = $('capture');
  if (me.cz >= 0 && !me.dead) {
    const co = owners.get(me.cz), cf = co && facInfo.get(co), c = CASTLES.find((k) => k.id === me.cz);
    cap.style.display = 'block';
    $('captxt').innerHTML = `<b>${c.name}</b> · level ${me.cl || 1} · ${cf ? esc(cf.name) : 'Bandit-held'}<br>${cf && cf.id === prof.fac ? (me.cdf ? `<span class="warn">${me.cdf} enemies inside the walls!</span>` : 'Your faction holds this castle. Gold banks here and you can change your toolbelt.') : me.cdf > 0 ? `${me.cdf} others inside the walls. It falls when only your faction is left inside.` : me.cp > 0 ? 'Capturing...' : 'Only your faction is inside...'}`;
    $('capbar').style.width = me.cp * 100 + '%';
  } else cap.style.display = 'none';
  updateDeath();
  if (rallyFrom && now > rallyFrom.until) { rallyFrom = null; showRally(); }
}
let lastMg = null;
setInterval(() => {
  if (!started) return;
  updateHud();
  if (lastMg !== me.mg) { lastMg = me.mg; if (panelOpen('skills')) renderSkills(); }
}, 100);
const spaced = (n) => Math.floor(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const ROMAN = (n) => { if (!n) return '0'; let r = ''; for (const [v, l] of [[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]) while (n >= v) { r += l; n -= v; } return r; };
// Valor rankings at the top right: everyone online, most Valor first.
function renderRankings() {
  const box = $('rankings'); if (!box) return;
  box.innerHTML = '<div class="rt">Valor rankings</div>' + meta.lb.map((p) => `<div class="${p.n === prof.name ? 'me' : ''}">${p.n === prof.name ? '&gt; ' : ''}${rankOf(p.v).name} ${esc(p.n)} : ${spaced(p.v)}</div>`).join('');
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// After 5 seconds of dying you pick where to come back.
let deathShown = null;
function updateDeath() {
  $('death').style.display = me.dead ? 'flex' : 'none';
  if (!me.dead) { deathShown = null; return; }
  const ready = me.rs <= 0, state = ready + ':' + (prof.spots || []).join(',');
  if (lastDeath) $('deathtxt').textContent = `You lost ${lastDeath.lost} valor${lastDeath.gold ? ', dropped ' + lastDeath.gold + ' gold' : ''}${lastDeath.wood ? ' and ' + lastDeath.wood + ' wood' : ''}${lastDeath.by ? ' to ' + lastDeath.by : ''}. Your soma and unlocks are safe.${ready ? '' : ` You can rise in ${Math.ceil(me.rs / 1000)}...`}`;
  if (deathShown === state) return;
  deathShown = state;
  const box = $('deathbtns'); box.innerHTML = '';
  if (!ready) return;
  const b = el('button', 'primary', 'Rise in Hanbin Haven'); b.onclick = () => send({ t: 'respawn', at: 'haven' }); box.appendChild(b);
  for (const id of prof.spots || []) { const c = CASTLES.find((k) => k.id === id); const bb = el('button', '', `Rise at ${c.name}`); bb.onclick = () => send({ t: 'respawn', at: id }); box.appendChild(bb); }
}
function showRally() {
  const box = $('rallybox');
  if (!rallyFrom) { box.style.display = 'none'; return; }
  box.style.display = 'block'; box.innerHTML = '';
  box.appendChild(el('div', '', `${rallyFrom.n} calls the faction to rally!`));
  const go = el('button', 'primary', 'Go (20s, 4× damage while waiting)'); go.onclick = () => { send({ t: 'join_rally', id: rallyFrom.id }); rallyFrom = null; showRally(); };
  const no = el('button', '', 'Ignore'); no.onclick = () => { rallyFrom = null; showRally(); };
  box.appendChild(go); box.appendChild(no);
}

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

// ------------------------------------------------------------------ tools panel: unlock trees and the toolbelt
let treeTab = 'warrior', skillSel = null;
const NODE_W = 76, NODE_H = 78, CW = 86, RH = 100;
// Lays a path out: each root tool's family is its own small tree (depth down, leaves across), and the
// trees are packed left to right and wrapped into rows, so a path fits without scrolling sideways.
function layout(path, width) {
  const list = TOOL_LIST.filter((t) => t.path === path), pos = new Map();
  const kids = (id) => list.filter((t) => t.req === id);
  const roots = list.filter((t) => !t.req || !list.some((x) => x.id === t.req));
  const trees = roots.map((r) => {
    const local = new Map(); let col = 0, depth = 0;
    const place = (t, d) => {
      depth = Math.max(depth, d);
      const ch = kids(t.id);
      if (!ch.length) { local.set(t.id, [col++, d]); return; }
      for (const c of ch) place(c, d + 1);
      const cs = ch.map((c) => local.get(c.id)[0]);
      local.set(t.id, [(Math.min(...cs) + Math.max(...cs)) / 2, d]);
    };
    place(r, 0);
    return { local, cols: col, depth: depth + 1 };
  });
  const maxCols = (width - 24) / CW;
  let cx = 0, row = 0, rowH = 0, used = 0;
  for (const tr of trees) {
    if (cx > 0 && cx + tr.cols > maxCols + 0.01) { row += rowH + 0.3; cx = 0; rowH = 0; }
    for (const [id, [c, d]] of tr.local) pos.set(id, [cx + c, row + d]);
    used = Math.max(used, cx + tr.cols); cx += tr.cols + 0.2; rowH = Math.max(rowH, tr.depth);
  }
  return { list, pos, cols: used, rows: row + rowH };
}
function renderSkills() {
  const path = PATHS.find((p) => p.id === treeTab), open = slotsFor(prof.tier || 0);
  $('skpts').innerHTML = `${uiImg('key')} ${prof.keys} key${prof.keys === 1 ? '' : 's'} to spend · Soma tier ${prof.tier} · ${open} of ${SLOTS} toolbelt slots open`;
  const tabs = $('treetabs'); tabs.innerHTML = '';
  for (const p of PATHS) {
    const got = TOOL_LIST.filter((t) => t.path === p.id && owns(prof.unlocked, t.id)).length, all = TOOL_LIST.filter((t) => t.path === p.id).length;
    const b = el('button', 'treetab' + (p.id === treeTab ? ' on' : ''));
    b.innerHTML = `${p.name} <span class="cnt">${got}/${all}</span>`;
    b.style.setProperty('--tc', p.color);
    if (TOOL_LIST.some((t) => t.path === p.id && !unlockCheck(prof.unlocked, t.id, prof.tier))) b.classList.add('glow');
    b.onclick = () => { treeTab = p.id; skillSel = null; $('treeview').scrollTop = 0; renderSkills(); };
    tabs.appendChild(b);
  }
  const box = $('treeview'), keep = box.scrollTop;
  $('skills').style.setProperty('--tc', path.color);
  const { list, pos, cols, rows } = layout(treeTab, box.clientWidth || 800);
  const w = cols * CW + 24, h = rows * RH + 6;
  box.innerHTML = '';
  const inner = el('div', 'treeinner'); inner.style.width = w + 'px'; inner.style.height = h + 'px'; box.appendChild(inner);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', w); svg.setAttribute('height', h); inner.appendChild(svg);
  const xy = (id) => { const [c, d] = pos.get(id); return [12 + c * CW + CW / 2, 12 + d * RH]; };
  for (const t of list) if (t.req && pos.has(t.req)) {
    const [x1, y1] = xy(t.req), [x2, y2] = xy(t.id), a = y1 + NODE_H, line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('d', `M${x1},${a} C${x1},${(a + y2) / 2} ${x2},${(a + y2) / 2} ${x2},${y2}`);
    line.setAttribute('class', 'edge' + (owns(prof.unlocked, t.req) ? ' lit' : ''));
    svg.appendChild(line);
  }
  for (const t of list) {
    const have = owns(prof.unlocked, t.id), why = have ? 'owned' : unlockCheck(prof.unlocked, t.id, prof.tier), [x, y] = xy(t.id);
    const d = el('div', 'node ' + (have ? 'owned' : !why ? 'avail' : 'locked') + (skillSel === t.id ? ' sel' : '') + (prof.belt.includes(t.id) ? ' worn' : ''));
    d.style.left = x - NODE_W / 2 + 'px'; d.style.top = y + 'px';
    d.innerHTML = `${toolImg(t.id)}<span class="nn">${t.name}</span>`;
    d.title = `${t.name} (${GROUPS[t.group]}): ${t.desc}${have ? '' : !why ? '\nDouble-click to unlock.' : '\n' + why}`;
    d.onclick = () => { skillSel = t.id; renderSkills(); };
    d.ondblclick = () => { if (!why) send({ t: 'unlock', id: t.id }); };
    inner.appendChild(d);
  }
  box.scrollTop = keep;
  const info = $('skinfo'); info.innerHTML = ''; info.style.setProperty('--tc', path.color);
  const t = skillSel && TOOLS[skillSel];
  if (!t || t.path !== treeTab) {
    info.insertAdjacentHTML('beforeend', `<h3 style="color:${path.color}">${path.name}</h3><p>${path.blurb}</p><p class="dim">Every Soma tier gives one key, and each key unlocks one tool. A tool needs the one above it first. Your toolbelt has ${SLOTS} slots: ${slotsFor(0)} are open from the start and the rest open at Soma tiers ${SLOT_TIERS.filter((x) => x > 0).join(', ')}. Change it in Hanbin Haven or a castle your faction holds.</p>`);
    beltPicker(info, null);
    return;
  }
  const have = owns(prof.unlocked, t.id), why = have ? null : unlockCheck(prof.unlocked, t.id, prof.tier);
  info.insertAdjacentHTML('beforeend', `<div class="head">${toolImg(t.id)}<h3 style="color:${path.color}">${t.name}<small>${GROUPS[t.group]} · ${path.name}</small></h3></div><p>${t.desc}</p><div class="stats">${toolStats(t)}${t.req ? `<br>Needs ${TOOLS[t.req].name}` : '<br>Start of the path'}${START_KIT.includes(t.id) ? '<br>Free for everyone' : ''}</div>`);
  if (!have && !why) { const b = el('button', 'primary', 'Unlock (1 key)'); b.style.marginTop = '8px'; b.onclick = () => send({ t: 'unlock', id: t.id }); info.appendChild(b); }
  else if (!have) info.appendChild(el('p', 'warn', why));
  if (have) beltPicker(info, t.id);
}
function beltPicker(info, id) {
  info.appendChild(el('p', 'dim', id ? 'Put it in a toolbelt slot:' : 'Your toolbelt:'));
  if (!me.mg) info.appendChild(el('p', 'warn', 'You can only change your toolbelt in Hanbin Haven or a castle your faction holds.'));
  const row = el('div', 'slotpick'), open = slotsFor(prof.tier || 0);
  for (let i = 0; i < SLOTS; i++) {
    const cur = prof.belt[i], b = el('button', cur && cur === id ? 'on' : '');
    if (i >= open) {
      b.classList.add('lockd'); b.disabled = true; b.title = `Opens at Soma tier ${SLOT_TIERS[i]}`;
      b.innerHTML = `<img src="${uiIcon('lock')}" alt=""><span class="k">Tier ${SLOT_TIERS[i]}</span>`;
      row.appendChild(b); continue;
    }
    b.innerHTML = `${cur ? toolImg(cur) : ''}<span class="k">${slotKey(i)}</span>`;
    b.title = cur ? TOOLS[cur].name : 'Empty';
    b.disabled = !me.mg || !id;
    b.onclick = () => send({ t: 'belt', s: i, id });
    row.appendChild(b);
  }
  info.appendChild(row);
  info.appendChild(el('p', 'dim', 'Every tool has its own cooldown. An attack keeps you busy while it plays out, so weave a second weapon between swings.'));
}

// ------------------------------------------------------------------ factions panel
function renderFactions() {
  const b = $('facbody');
  if (!$('facme')) b.innerHTML = '<div id="facme"></div><div id="faccastles"></div><h4>Factions</h4><div id="faclist"></div>';
  const mine = facInfo.get(prof.fac), state = mine ? `${mine.id}:${mine.name}:${mine.color}:${prof.code}:${prof.rank}` : 'none';
  if ($('facme').dataset.state !== state) { $('facme').dataset.state = state; renderFactionMe($('facme'), mine); }
  renderFactionCastles($('faccastles'), mine);
  renderFactionList($('faclist'));
}
function renderFactionMe(b, mine) {
  b.innerHTML = '';
  if (!mine) return;
  const r = el('div', 'frow'); const dot = el('div', 'dot'); dot.style.background = mine.color; r.appendChild(dot);
  r.appendChild(el('div', 'grow', `${mine.name}${mine.pub ? ' (public faction)' : ' (private)'}: ${mine.m} member${mine.m === 1 ? '' : 's'}, ${mine.on} online, ${mine.c} castle${mine.c === 1 ? '' : 's'} · Valor cap ${mine.cap} · +${Math.round(mine.t * 1000) / 10}% rewards`));
  if (!mine.pub) { const lb = el('button', '', 'Leave'); lb.onclick = () => { if (confirm(`Leave ${mine.name}? You go back to a public faction.`)) send({ t: 'fl' }); }; r.appendChild(lb); }
  b.appendChild(r);
  if (prof.code) {
    const link = `${location.origin}${location.pathname}?join=${prof.code}`;
    const row = el('div', 'frow'); row.appendChild(el('div', 'grow', `Invite up to ${PRIVATE_MAX - mine.m} more: code ${prof.code}`));
    const cb = el('button', '', 'Copy link'); cb.onclick = () => { navigator.clipboard?.writeText(link); toast('Invite link copied'); }; row.appendChild(cb);
    b.appendChild(row);
  }
  b.appendChild(el('p', 'dim', `Local chat reaches players within shouting distance. ${prof.rank >= RANK.facChat ? 'Faction chat: start with /f.' : 'Faction chat opens at Herald rank.'} ${prof.rank >= RANK.world ? 'World chat: start with /w.' : ''}`));
  if (prof.rank >= RANK.rename) {
    const row = el('div', 'frow'), inp = el('input', 'txt'); inp.placeholder = 'New faction name'; inp.maxLength = 30; inp.style.flex = '1';
    inp.addEventListener('keydown', (e) => e.stopPropagation());
    const bt = el('button', '', 'Rename (Jarl)'); bt.onclick = () => { if (inp.value.trim()) send({ t: 'frn', n: inp.value.trim() }); };
    row.appendChild(inp); row.appendChild(bt); b.appendChild(row);
  }
  if (prof.rank >= RANK.colour) {
    const row = el('div', 'frow'), inp = el('input'); inp.type = 'color'; inp.value = mine.color;
    const bt = el('button', '', 'Set colour (Theyn)'); bt.onclick = () => send({ t: 'fcol', c: inp.value });
    row.appendChild(el('div', 'grow', 'Banner colour')); row.appendChild(inp); row.appendChild(bt); b.appendChild(row);
  }
  const row = el('div', 'frow'), inp = el('input', 'txt'); inp.placeholder = 'Private faction name'; inp.maxLength = 30; inp.style.flex = '1';
  inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') bt.click(); });
  const bt = el('button', 'primary', 'Found private faction'); bt.onclick = () => { if (inp.value.trim()) send({ t: 'fc', n: inp.value.trim() }); };
  row.appendChild(inp); row.appendChild(bt); b.appendChild(row);
  const row2 = el('div', 'frow'), inp2 = el('input', 'txt'); inp2.placeholder = 'Invite code'; inp2.maxLength = 12; inp2.style.flex = '1';
  inp2.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') bt2.click(); });
  const bt2 = el('button', '', 'Join with code'); bt2.onclick = () => { if (inp2.value.trim()) send({ t: 'fjc', code: inp2.value.trim() }); };
  row2.appendChild(inp2); row2.appendChild(bt2); b.appendChild(row2);
}
function renderFactionCastles(b, mine) {
  b.innerHTML = '';
  if (!mine) return;
  const mineC = CASTLES.filter((c) => owners.get(c.id) === mine.id);
  b.appendChild(el('h4', '', 'Your castles'));
  if (!mineC.length) { b.appendChild(el('p', 'dim', 'None yet. A castle falls to your faction when only your faction is left inside its walls: beat its defenders or lure them out. Every castle raises your Valor cap and pays taxes each minute.')); return; }
  for (const c of mineC) {
    const lv = levels.get(c.id) || 1, r = el('div', 'frow');
    r.appendChild(el('div', 'grow', `${c.name} · level ${lv} · +${CAP_LIFT[c.type]} cap · ${8 * lv} gold/min${c.type === 'fort' ? ' · respawn point' : ''}`));
    if (lv < 3) { const bt = el('button', '', `Fortify (${CASTLE_LEVEL_COST[lv + 1]}g)`); bt.title = 'More defenders and higher taxes. Paid from banked gold.'; bt.onclick = () => send({ t: 'fortify', id: c.id }); r.appendChild(bt); }
    b.appendChild(r);
  }
}
function renderFactionList(b) {
  b.innerHTML = '';
  const list = [...facInfo.values()].sort((a, c) => c.c - a.c || c.m - a.m);
  for (const f of list) {
    const r = el('div', 'frow'); const dot = el('div', 'dot'); dot.style.background = f.color; r.appendChild(dot);
    r.appendChild(el('div', 'grow', `${f.name}${f.pub ? ' (public)' : ''}: ${f.m} member${f.m === 1 ? '' : 's'} · ${f.on} online · ${f.c} castle${f.c === 1 ? '' : 's'}`));
    b.appendChild(r);
  }
}
function renderBoard() {
  const b = $('boardbody'); b.innerHTML = '';
  b.appendChild(el('h4', '', 'Ranks'));
  b.appendChild(el('p', 'dim', `Valor lasts one life: you lose all of it when you die or log off. It grows faster the more you have, and every kill gives more Soma the more Valor you carry. Ranks give privileges, never damage. Your faction's territory sets the Valor cap (yours: ${me.cap}).`));
  const cur = rankOf(me.v).idx, rt = el('table', 'lb ranks');
  RANKS.forEach((r, i) => {
    const tr = el('tr', i <= cur ? 'got' : '');
    [i <= cur ? '✓' : '', r.name, r.v.toLocaleString(), r.perk].forEach((v) => tr.appendChild(el('td', '', String(v))));
    rt.appendChild(tr);
  });
  b.appendChild(rt);
  b.appendChild(el('h4', '', 'Top players online'));
  const t = el('table', 'lb'); t.innerHTML = '<tr><th>#</th><th>Name</th><th>Rank</th><th>Valor</th><th>Tier</th></tr>';
  meta.lb.forEach((p, i) => { const tr = el('tr'); const f = facInfo.get(p.f); [i + 1, (f ? `[${f.name}] ` : '') + (p.vt ? '★ ' : '') + p.n, rankOf(p.v).name, p.v, p.t].forEach((v) => tr.appendChild(el('td', '', String(v)))); t.appendChild(tr); });
  b.appendChild(t);
  b.appendChild(el('h4', '', 'Realm control'));
  const f = [...facInfo.values()].filter((x) => x.c).sort((a, c) => c.c - a.c);
  if (!f.length) b.appendChild(el('p', 'dim', 'No faction holds a castle yet.'));
  f.forEach((x) => { const r = el('div', 'frow'); const dot = el('div', 'dot'); dot.style.background = x.color; r.appendChild(dot); r.appendChild(el('div', 'grow', `${x.name}: ${x.c}/${CASTLES.length} castles · Valor cap ${x.cap}`)); b.appendChild(r); });
}

// ------------------------------------------------------------------ minimap & world map
const terrainMap = document.createElement('canvas'); terrainMap.width = GW; terrainMap.height = GH;
{
  const tctx = terrainMap.getContext('2d'), img = tctx.createImageData(GW, GH);
  for (let i = 0; i < GW * GH; i++) {
    const land = LAND_GRID[i], r = REGION_GRID[i], gx = i % GW, gy = (i / GW) | 0;
    let c = land ? (landBase(gx * RC + RC / 2, gy * RC + RC / 2) <= 0 ? [150, 108, 66] : BIOME_RGB[REGIONS[r].biome]) : [32, 74, 128];
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
function drawRadar(m, sx, sy, s) {
  for (const [x, y, troop] of radar.a) { m.fillStyle = troop ? '#9fe0a0' : '#4f4'; m.fillRect(x * sx - s / 2, y * sy - s / 2, s, s); }
  for (const [x, y] of radar.e) { m.fillStyle = '#ff4040'; m.beginPath(); m.arc(x * sx, y * sy, s * 0.8, 0, 7); m.fill(); }
}
function drawMinimap() {
  const dg = dungeonAt(me.x, me.y);
  if (dg) {
    const mw = mini.width, mh = mini.height, s = Math.min(mw, mh) / DGRID, ox = (mw - DGRID * s) / 2;
    mctx.fillStyle = '#0c0b0e'; mctx.fillRect(0, 0, mw, mh);
    mctx.imageSmoothingEnabled = false; mctx.drawImage(dungeonMap(dg), ox, 0, DGRID * s, DGRID * s);
    const tx = (wx) => ox + ((wx - dg.bx) / DT_SIZE) * s, ty = (wy) => ((wy - dg.by) / DT_SIZE) * s;
    const br = dg.rooms[dg.rooms.length - 1];
    { const bx = tx(br.x), by = ty(br.y); mctx.fillStyle = '#ff5050'; mctx.strokeStyle = '#000'; mctx.lineWidth = 1; mctx.beginPath(); mctx.arc(bx, by, 5, 0, 7); mctx.fill(); mctx.stroke(); mctx.strokeStyle = '#fff'; mctx.lineWidth = 1.5; mctx.beginPath(); mctx.moveTo(bx - 2.5, by - 2.5); mctx.lineTo(bx + 2.5, by + 2.5); mctx.moveTo(bx + 2.5, by - 2.5); mctx.lineTo(bx - 2.5, by + 2.5); mctx.stroke(); }
    mctx.fillStyle = '#c8a0ff'; for (const q of [dg.exitPortal, dg.bossPortal]) { mctx.beginPath(); mctx.arc(tx(q.x), ty(q.y), 3, 0, 7); mctx.fill(); }
    mctx.fillStyle = '#fff'; mctx.strokeStyle = '#000'; mctx.beginPath(); mctx.arc(tx(me.x), ty(me.y), 3.5, 0, 7); mctx.fill(); mctx.stroke();
    return;
  }
  if (miniDirty) rebuildOwned();
  const mw = mini.width, mh = mini.height, sx = mw / WW, sy = mh / WH;
  mctx.imageSmoothingEnabled = true; mctx.drawImage(ownedMap, 0, 0, mw, mh);
  for (const c of CASTLES) { const f = facInfo.get(owners.get(c.id)); mctx.fillStyle = f ? f.color : '#ddd'; mctx.strokeStyle = '#000'; mctx.fillRect(c.x * sx - 3, c.y * sy - 3, 6, 6); mctx.strokeRect(c.x * sx - 3, c.y * sy - 3, 6, 6); }
  mctx.fillStyle = '#7f7'; mctx.beginPath(); mctx.arc(VILLAGE.x * sx, VILLAGE.y * sy, 3.5, 0, 7); mctx.fill();
  mctx.strokeStyle = '#c8a0ff'; mctx.lineWidth = 1.5; for (const c of CAVES) { mctx.beginPath(); mctx.arc(c.x * sx, c.y * sy, 2.5, 0, 7); mctx.stroke(); }
  for (const o of ents.values()) if (o.k === 'player' && o.id !== myId) { mctx.fillStyle = isAlly(o) ? '#4f4' : '#f55'; mctx.fillRect(o.x * sx - 1.5, o.y * sy - 1.5, 3, 3); }
  drawRadar(mctx, sx, sy, 3);
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
  // island names, in the sea above each island
  m.textAlign = 'center'; m.lineJoin = 'round';
  for (const I of ISLANDS) {
    const lx = I.mid * sx, ly = Math.max(16, (I.top - 260) * sy);
    m.font = 'italic bold 17px Georgia'; m.strokeStyle = 'rgba(10,20,40,.85)'; m.lineWidth = 4; m.strokeText(I.name, lx, ly); m.fillStyle = '#f0e2b8'; m.fillText(I.name, lx, ly);
  }
  m.font = '600 11px Cinzel, Georgia';
  for (const r of REGIONS) {
    if (r.dungeon !== undefined) continue;
    const c2 = CASTLES.find((k) => k.id === r.id), f = facInfo.get(owners.get(r.id));
    if (c2) { m.fillStyle = f ? f.color : '#ddd'; m.strokeStyle = '#000'; m.lineWidth = 1.5; m.fillRect(r.x * sx - 5, r.y * sy - 5, 10, 10); m.strokeRect(r.x * sx - 5, r.y * sy - 5, 10, 10); }
    else { m.fillStyle = '#7f7'; m.beginPath(); m.arc(r.x * sx, r.y * sy, 6, 0, 7); m.fill(); }
    m.strokeStyle = 'rgba(0,0,0,.8)'; m.lineWidth = 3; m.fillStyle = '#fff';
    m.strokeText(r.name, r.x * sx, r.y * sy - 10); m.fillText(r.name, r.x * sx, r.y * sy - 10);
    m.font = '9px Cinzel, Georgia'; const sub = r.danger ? (f ? f.name : 'Bandits') + ' · ' + '◆'.repeat(r.danger) + '' : 'Safe haven';
    m.strokeText(sub, r.x * sx, r.y * sy + 18); m.fillStyle = f ? f.color : '#ccc'; m.fillText(sub, r.x * sx, r.y * sy + 18); m.font = '600 11px Cinzel, Georgia';
  }
  for (const cv2 of CAVES) {
    const d = DUNGEONS[cv2.dungeon], wait = meta.bosses && meta.bosses[d.id];
    m.fillStyle = '#c8a0ff'; m.strokeStyle = '#000'; m.lineWidth = 2; m.beginPath(); m.arc(cv2.x * sx, cv2.y * sy, 6, 0, 7); m.fill(); m.stroke();
    m.font = '600 11px Cinzel, Georgia'; m.lineWidth = 3; const lbl = `${d.name} ${'◆'.repeat(d.danger)}${wait ? ' (boss in ' + Math.ceil(wait / 60000) + 'm)' : ''}`;
    m.strokeText(lbl, cv2.x * sx, cv2.y * sy - 10); m.fillStyle = '#e0d0ff'; m.fillText(lbl, cv2.x * sx, cv2.y * sy - 10);
  }
  drawRadar(m, sx, sy, 5);
  if (me.y < WH) { m.fillStyle = '#fff'; m.strokeStyle = '#000'; m.lineWidth = 2; m.beginPath(); m.arc(me.x * sx, me.y * sy, 5, 0, 7); m.fill(); m.stroke(); }
  const rk = rankOf(me.v).idx, hint = $('maphint'); hint.innerHTML = '';
  if (rk >= RANK.travel) {
    hint.appendChild(el('span', '', 'Click a castle your faction holds to quick-travel there (20s standing still, 4× damage while you wait). '));
    const hb = el('button', 'small', 'Travel to Hanbin Haven'); hb.onclick = () => { send({ t: 'travel', id: 'haven' }); togglePanel('map'); }; hint.appendChild(hb);
  } else hint.appendChild(el('span', '', 'Quick travel unlocks at the rank of Marshall. '));
  if (rk >= RANK.rally) { const rb = el('button', 'small', 'Rally my faction to me'); rb.onclick = () => send({ t: 'rally' }); hint.appendChild(rb); }
}
$('bigmap').addEventListener('click', (e) => {
  const c = $('bigmap'), r = c.getBoundingClientRect(), wx = (e.clientX - r.left) / r.width * WW, wy = (e.clientY - r.top) / r.height * WH;
  const hit = CASTLES.map((k) => [k, Math.hypot(k.x - wx, k.y - wy)]).sort((a, b) => a[1] - b[1])[0];
  if (!hit || hit[1] > 350) return;
  const k = hit[0];
  if (rankOf(me.v).idx < RANK.travel) return toast('Quick travel unlocks at the rank of Marshall.');
  if (!prof.fac || owners.get(k.id) !== prof.fac) return toast('Your faction does not hold ' + k.name + '.');
  send({ t: 'travel', id: k.id }); togglePanel('map');
});

// ------------------------------------------------------------------ input
const worldMouse = () => ({ x: me.x + (mouseX - VW / 2) / zoom, y: me.y + (mouseY - VH / 2) / zoom });
function aimAngle() { return kbTurn !== null ? kbTurn : Math.atan2(mouseY - VH / 2, mouseX - VW / 2); }
// Rebindable keys, stored per browser as KeyboardEvent.code values (layout-independent); Mouse0-2 are the mouse buttons.
const SLOT_DEFAULTS = ['Mouse0', 'Space', 'ShiftLeft', 'KeyV', 'Mouse2', 'Mouse1', 'KeyQ', 'KeyE', 'KeyR', 'KeyC'];
const ACTIONS = [
  ['up', 'Move up', 'KeyW'], ['down', 'Move down', 'KeyS'], ['left', 'Move left', 'KeyA'], ['right', 'Move right', 'KeyD'],
  ...Array.from({ length: SLOTS }, (_, i) => ['slot' + i, `Toolbelt slot ${i + 1}`, SLOT_DEFAULTS[i]]),
  ['toggle', 'Toggle auto-repeat (hold, then a slot key)', 'AltLeft'], ['turnl', 'Turn left', 'BracketLeft'], ['turnr', 'Turn right', 'BracketRight'],
  ['skills', 'Tools', 'KeyK'], ['factions', 'Factions', 'KeyF'], ['map', 'World map', 'KeyM'], ['board', 'Ranks', 'Tab'],
  ['help', 'Help', 'KeyH'], ['keys', 'Keybinds', 'KeyO'], ['chat', 'Open chat', 'Enter'], ['mute', 'Mute sound', 'KeyN'],
];
const DEFAULT_BINDS = Object.fromEntries(ACTIONS.map(([id, , code]) => [id, code]));
let binds = { ...DEFAULT_BINDS };
try {
  // Keep saved keys for actions that still exist; a saved key that now clashes with a new action's default gives way.
  const saved = JSON.parse(store.get('hanbin_binds3') || '{}');
  for (const [k, v] of Object.entries(saved)) if (DEFAULT_BINDS[k] && typeof v === 'string') binds[k] = v;
  const seen = new Map();
  for (const [id] of ACTIONS) {
    const c = binds[id];
    if (!seen.has(c)) { seen.set(c, id); continue; }
    const other = seen.get(c), loser = DEFAULT_BINDS[id] === c ? other : id;
    binds[loser] = DEFAULT_BINDS[loser]; seen.set(c, loser === other ? id : other); seen.set(binds[loser], loser);
  }
} catch { /* ignore a corrupt save */ }
let actionOf = new Map();
function applyBinds() {
  actionOf = new Map(Object.entries(binds).map(([a, c]) => [c, a]));
  store.set('hanbin_binds3', JSON.stringify(binds));
  document.querySelectorAll('[data-open]').forEach((b) => { b.textContent = `${keyName(binds[b.dataset.open])} ${b.dataset.label}`; });
  if (started) buildHotbar();
}
function keyName(code) {
  if (!code) return '—';
  if (code === 'Mouse0') return 'LMB'; if (code === 'Mouse1') return 'MMB'; if (code === 'Mouse2') return 'RMB';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num' + code.slice(6);
  if (code.startsWith('Arrow')) return { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }[code];
  return { Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'RShift', ControlLeft: 'Ctrl', ControlRight: 'RCtrl', AltLeft: 'Alt', AltRight: 'AltGr', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', CapsLock: 'Caps' }[code] || code;
}
const pressed = (action) => !!keys[binds[action]];
// Arrow keys also move, unless they have been bound to something else.
const arrow = (code) => keys[code] && !actionOf.has(code);
function mask() {
  if (chatOpen || me.dead || !connected) return 0;
  return (pressed('up') || arrow('ArrowUp') ? 1 : 0) | (pressed('down') || arrow('ArrowDown') ? 2 : 0) | (pressed('left') || arrow('ArrowLeft') ? 4 : 0) | (pressed('right') || arrow('ArrowRight') ? 8 : 0);
}
let rebinding = null, rebindAt = 0;
function renderKeys() {
  const b = $('keysbody'); b.innerHTML = '';
  const grid = el('div', 'keygrid');
  for (const [id, label] of ACTIONS) {
    grid.appendChild(el('span', '', label));
    const btn = el('button', 'keybtn' + (rebinding === id ? ' wait' : ''), rebinding === id ? 'Press a key or click…' : keyName(binds[id]));
    btn.onclick = () => { rebinding = rebinding === id ? null : id; rebindAt = performance.now(); renderKeys(); };
    grid.appendChild(btn);
  }
  b.appendChild(grid);
  b.appendChild(el('p', 'dim', 'Click an action, then press the new key or mouse button (Esc cancels). Picking a key that is already used swaps the two.'));
  const reset = el('button', '', 'Restore defaults');
  reset.onclick = () => { binds = { ...DEFAULT_BINDS }; rebinding = null; applyBinds(); renderKeys(); };
  b.appendChild(reset);
}
function bindTo(code) {
  const old = binds[rebinding], other = actionOf.get(code);
  if (other && other !== rebinding) binds[other] = old;
  binds[rebinding] = code;
  applyBinds(); rebinding = null; renderKeys();
}
// Pressing a slot: hold to repeat; a second press within 0.35s while it cools down queues one use;
// the toggle key + a slot key keeps it repeating until toggled off.
function aimMsg() { const w = worldMouse(); return { a: +aimAngle().toFixed(3), x: Math.round(w.x), y: Math.round(w.y) }; }
// Your attacks are shown at once (swing, sound, effect) instead of waiting for the server's echo.
let lastPredict = 0, animNow = 0, pausedMs = 0;
const localCd = {}, pendingFx = [];
function predictAttack(t, now) {
  if (!isAttack(t) || me.dead || now < (me.busyEnd || 0) || (gcdEnd[t.id] || 0) > now || (localCd[t.id] || 0) > now) return;
  me.atk = { tool: t, start: animNow }; me.busyEnd = now + actionTime(t); localCd[t.id] = now + t.cd; lastPredict = now;
  const w = t.windup || 0;
  if (t.type === 'strike') for (const h of t.hits) pendingFx.push({ at: now + w + h.t, h, tool: t });
  else if (t.type === 'shoot') pendingFx.push({ at: now + w, shot: t });
}
function firePending(now) {
  for (let i = pendingFx.length - 1; i >= 0; i--) {
    const p = pendingFx[i]; if (p.at > now) continue;
    pendingFx.splice(i, 1);
    if (me.dead) continue;
    if (p.shot) { feel.sfx(p.shot.id === 'sling' || p.shot.proj === 'stone' ? 'sling' : 'bow'); continue; }
    const h = p.h, arc = Math.min(6.4, ((h.arc || 0) * Math.PI) / 180);
    if (h.line) { fxs.push({ t: 'thrust', i: myId, x: me.x, y: me.y, a: me.ang, r0: 14, r1: h.reach, t0: now, seed: 0 }); feel.sfx('thrust'); }
    else { fxs.push({ t: 'arc', i: myId, x: me.x, y: me.y, a: me.ang, r: h.reach, w: arc, t0: now, seed: 0 }); feel.sfx(arc >= 6.2 ? 'spin' : arc > 2.5 || h.dmg >= 15 ? 'heavy' : 'swing'); }
  }
}
function slotDown(s, mouse) {
  const now = performance.now(), id = prof.belt[s], t = id && TOOLS[id];
  if (!t) { if (s >= slotsFor(prof.tier || 0)) toast(`That toolbelt slot opens at Soma tier ${SLOT_TIERS[s]}.`); return; }
  if (!mouse && pressed('toggle')) {
    if (toggled.has(s)) { toggled.delete(s); send({ t: 'use', s, on: 0 }); } else { toggled.add(s); send({ t: 'use', s, on: 1, ...aimMsg() }); }
    return;
  }
  const cooling = (gcdEnd[t.id] || 0) > now;
  if (cooling && now - (lastPress[s] || 0) < 350) send({ t: 'q', s, ...aimMsg() });
  lastPress[s] = now;
  held.add(s);
  feel.initAudio();
  predictAttack(t, now);
  if (t.type === 'shield') feel.sfx('shield');
  send({ t: 'use', s, on: 1, ...aimMsg() });
}
function slotUp(s) { if (!held.has(s)) return; held.delete(s); if (!toggled.has(s)) send({ t: 'use', s, on: 0 }); }
// Send our predicted position 20 times a second while it differs from what the server last confirmed.
let lastA = 0, lastSent = 0, lastX = 0, lastY = 0;
setInterval(() => {
  if (!connected || !me.init) return;
  const a = aimAngle(), now = performance.now(), w = worldMouse();
  const moved = Math.hypot(me.x - lastX, me.y - lastY) > 0.5 || Math.hypot(me.x - me.sx, me.y - me.sy) > 1;
  if (moved || Math.abs(a - lastA) > 0.02 || now - lastSent > 300 || held.size) {
    send({ t: 'in', a: +a.toFixed(3), x: +me.x.toFixed(1), y: +me.y.toFixed(1), tp: me.tpSeen, ax: Math.round(w.x), ay: Math.round(w.y) });
    lastA = a; lastSent = now; lastX = me.x; lastY = me.y;
  }
}, 50);

addEventListener('keydown', (e) => {
  if (!started) return;
  if (rebinding) { e.preventDefault(); if (e.code === 'Escape') { rebinding = null; renderKeys(); } else bindTo(e.code); return; }
  if (chatOpen) {
    if (e.key === 'Enter') { const v = $('chatin').value.trim(); if (v) send({ t: 'chat', m: v }); closeChat(); }
    else if (e.key === 'Escape') closeChat();
    e.stopPropagation(); return;
  }
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  if (e.code === 'Escape') { for (const p of PANELS) $(p).style.display = 'none'; return; }
  const act = actionOf.get(e.code);
  if (act || e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Tab' || e.code === 'AltLeft' || e.code === 'AltRight') e.preventDefault();
  keys[e.code] = true;
  if (!act || e.repeat) return;
  feel.initAudio();
  if (act === 'chat') return openChat();
  if (act === 'mute') { feel.setMuted(!feel.isMuted()); return toast(feel.isMuted() ? 'Sound off (N)' : 'Sound on (N)'); }
  if (act === 'turnl' || act === 'turnr') { if (kbTurn === null) kbTurn = me.ang; return; }
  if (PANELS.includes(act)) return togglePanel(act);
  if (act.startsWith('slot')) slotDown(+act.slice(4), false);
});
addEventListener('keyup', (e) => {
  keys[e.code] = false;
  const act = actionOf.get(e.code);
  if (act && act.startsWith('slot')) slotUp(+act.slice(4));
});
addEventListener('blur', () => { for (const k in keys) keys[k] = false; for (const s of [...held]) slotUp(s); });
function openChat() { chatOpen = true; for (const s of [...held]) slotUp(s); const i = $('chatin'); i.style.display = 'block'; i.value = ''; i.focus(); }
function closeChat() { chatOpen = false; const i = $('chatin'); i.style.display = 'none'; i.blur(); }
addEventListener('pointerdown', () => feel.initAudio());
addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; kbTurn = null; });
addEventListener('mousedown', (e) => { if (rebinding && performance.now() - rebindAt > 250 && e.target.closest('#keys')) { e.preventDefault(); bindTo('Mouse' + e.button); } });
cv.addEventListener('mousedown', (e) => {
  if (!connected || chatOpen) return;
  if (rebinding) return;
  for (const p of PANELS) if (panelOpen(p)) { $(p).style.display = 'none'; return; }
  e.preventDefault();
  const act = actionOf.get('Mouse' + e.button);
  if (act && act.startsWith('slot')) slotDown(+act.slice(4), true);
});
addEventListener('mouseup', (e) => { const act = actionOf.get('Mouse' + e.button); if (act && act.startsWith('slot')) slotUp(+act.slice(4)); });
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('auxclick', (e) => e.preventDefault());

// ------------------------------------------------------------------ ground chunks
const CHUNK = 512, RES = 2, NPX = CHUNK / RES, chunks = new Map(), pending = new Set();
const tmp = document.createElement('canvas'); tmp.width = NPX; tmp.height = NPX; const tctx = tmp.getContext('2d');
let worker = null;
try {
  worker = new Worker(new URL('./chunkworker.mjs', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => { const { cx, cy, px } = e.data; pending.delete(cy * 100 + cx); finishChunk(cx, cy, px); };
  worker.onerror = () => { worker = null; pending.clear(); };
} catch { worker = null; }
// A tiling grit texture (grain, small stones, worn patches) laid over the ground.
const GRIT = (() => {
  const n = 256, c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'), img = x.createImageData(n, n), R = rng(4242);
  for (let i = 0; i < n * n; i++) { const v = 128 + (R() - 0.5) * 70; img.data.set([v, v, v, 255], i * 4); }
  x.putImageData(img, 0, 0);
  for (let i = 0; i < 260; i++) { const px = R() * n, py = R() * n, rr = 1 + R() * 3.5; x.fillStyle = R() < 0.5 ? 'rgba(20,20,20,.5)' : 'rgba(235,235,235,.4)'; x.beginPath(); x.ellipse(px, py, rr, rr * (0.5 + R() * 0.5), R() * 3, 0, 7); x.fill(); }
  for (let i = 0; i < 40; i++) { const px = R() * n, py = R() * n, rr = 10 + R() * 30, g = x.createRadialGradient(px, py, 1, px, py, rr); g.addColorStop(0, R() < 0.5 ? 'rgba(0,0,0,.25)' : 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(128,128,128,0)'); x.fillStyle = g; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
  return c;
})();
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
  x.save(); x.globalCompositeOperation = 'overlay'; x.globalAlpha = 0.55; const pat = x.createPattern(GRIT, 'repeat'); pat.setTransform(new DOMMatrix().translate(-(x0 % 256), -(y0 % 256))); x.fillStyle = pat; x.fillRect(0, 0, CHUNK, CHUNK);
  x.globalAlpha = 1; x.globalCompositeOperation = 'multiply'; x.fillStyle = '#a9a49a'; x.fillRect(0, 0, CHUNK, CHUNK); x.restore();
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

// ------------------------------------------------------------------ bridges
// Bridge decks are drawn as crisp vector art over the ground, only where they cross water (plus a
// little way onto each shore), with planks, rails, posts and a shadow on the water.
const BRIDGE_SPANS = BRIDGES.map((b) => {
  let a0 = null, a1 = null;
  for (let a = 0; a <= b.len; a += 20) { const x = b.x0 + ((b.x1 - b.x0) * a) / b.len, y = b.y0 + ((b.y1 - b.y0) * a) / b.len; if (landBase(x, y) < 0.03) { if (a0 === null) a0 = a; a1 = a; } }
  return a0 === null ? null : { b, a0: Math.max(0, a0 - 50), a1: Math.min(b.len, a1 + 50), ang: Math.atan2(b.y1 - b.y0, b.x1 - b.x0) };
});
function drawBridges(x0, y0, x1, y1) {
  const W = BRIDGE_W;
  for (const sp of BRIDGE_SPANS) {
    if (!sp) continue;
    const { b, a0, a1, ang } = sp;
    if (Math.max(b.x0, b.x1) + W < x0 || Math.min(b.x0, b.x1) - W > x1 || Math.max(b.y0, b.y1) + W < y0 || Math.min(b.y0, b.y1) - W > y1) continue;
    ctx.save(); ctx.translate(b.x0, b.y0); ctx.rotate(ang);
    ctx.fillStyle = 'rgba(0,12,34,.38)'; ctx.fillRect(a0 + 6, -W / 2 + 12, a1 - a0, W);
    for (let a = Math.ceil((a0 + 60) / 220) * 220; a < a1 - 60; a += 220) { ctx.fillStyle = '#3a2614'; for (const sd of [-1, 1]) ctx.fillRect(a - 7, sd * (W / 2 + 2) - 7, 14, 14); }
    ctx.fillStyle = '#7a5634'; ctx.fillRect(a0, -W / 2 + 5, a1 - a0, W - 10);
    const tones = ['#9a7650', '#8c6842', '#a07c54'];
    for (let a = Math.ceil(a0 / 14) * 14, k = 0; a < a1; a += 14, k++) {
      ctx.fillStyle = tones[Math.abs(Math.round(a / 14)) % 3]; ctx.fillRect(a + 0.8, -W / 2 + 7, Math.min(12.4, a1 - a - 0.8), W - 14);
      if (Math.round(a / 14) % 5 === 0) { ctx.fillStyle = 'rgba(40,24,10,.35)'; ctx.fillRect(a + 3, -W / 2 + 7, 1.2, W - 14); }
    }
    for (const sd of [-1, 1]) {
      ctx.fillStyle = '#5a3a20'; ctx.fillRect(a0, sd * (W / 2 - 4) - 4, a1 - a0, 8);
      ctx.fillStyle = 'rgba(255,220,160,.18)'; ctx.fillRect(a0, sd * (W / 2 - 4) - 4, a1 - a0, 2);
      for (let a = Math.ceil(a0 / 110) * 110; a <= a1; a += 110) { ctx.fillStyle = '#4a2e18'; ctx.fillRect(a - 6, sd * (W / 2 - 4) - 7, 12, 14); ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1; ctx.strokeRect(a - 6, sd * (W / 2 - 4) - 7, 12, 14); }
    }
    for (const a of [a0, a1 - 14]) { ctx.fillStyle = '#8a8478'; ctx.fillRect(a, -W / 2 - 2, 14, W + 4); ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1.2; ctx.strokeRect(a, -W / 2 - 2, 14, W + 4); }
    ctx.restore();
  }
}

// ------------------------------------------------------------------ drawing helpers
function bodySprite(b) {
  if (b.k === 'logs' || (MOBS[b.k] && MOBS[b.k].obj)) return null;
  const look = b.k === 'player' ? playerLook(b.n || '', b.rk || 0, facColor(b.f), b.wp, null) : { weapon: 'none', shieldKind: null };
  if (b.k === 'player') look.weapon = 'none';
  return creature(b.k, facColor(b.f) || '#888', 0, false, look);
}
const facColor = (id) => { const f = facInfo.get(id); return f ? f.color : null; };
function isAlly(o) { return o.id === myId || (prof.fac && o.f === prof.fac) || o.ow === myId; }
const RADIUS = (o) => (o.k === 'player' ? 14 : MOBS[o.k] ? MOBS[o.k].r : 13);
const OBJ = (o) => MOBS[o.k] && MOBS[o.k].obj;

function drawShadow(x, y, r) { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(x + 2, y + r * 0.55, r * 1.05, r * 0.55, 0, 0, 7); ctx.fill(); }
// Objects: log piles, traps, deployed banners and bonfires.
function drawObject(o, x, y, now) {
  const k = o.k, col = facColor(o.f) || '#c8a060';
  if (o.iv) ctx.globalAlpha = Math.max(0.35, 1 - o.iv);
  if (k === 'logs') {
    drawShadow(x, y, 14);
    for (const [dx, dy] of [[-8, 4], [6, 5], [-1, -3]]) { ctx.fillStyle = '#7a5430'; ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x + dx, y + dy, 11, 4.5, 0.2, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#c89a60'; ctx.beginPath(); ctx.arc(x + dx + 10, y + dy + 1, 3, 0, 7); ctx.fill(); }
  } else if (k === 'gonfalon' || k === 'ensign') {
    const img = banner(col); ctx.drawImage(img, x - 14, y - 62, 48, 70);
    ctx.strokeStyle = k === 'gonfalon' ? 'rgba(180,200,255,.3)' : 'rgba(150,255,170,.3)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(x, y, 180, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  } else if (k === 'bonfire') {
    ctx.fillStyle = '#4a3020'; for (let i = 0; i < 5; i++) { const a = i * 1.26; ctx.fillRect(x + Math.cos(a) * 8 - 6, y + Math.sin(a) * 8 - 2, 12, 4); }
    for (let i = 0; i < 4; i++) { const fl = Math.sin(now / 90 + i * 1.7) * 3, g = ctx.createRadialGradient(x, y - 6, 1, x, y - 6, 14 + fl); g.addColorStop(0, 'rgba(255,240,170,.95)'); g.addColorStop(0.5, 'rgba(255,140,40,.7)'); g.addColorStop(1, 'rgba(200,40,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + (i - 1.5) * 3, y - 6 - i * 2, 12 + fl, 0, 7); ctx.fill(); }
    ctx.strokeStyle = 'rgba(255,200,120,.2)'; ctx.setLineDash([5, 7]); ctx.beginPath(); ctx.arc(x, y, 120, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  } else if (k === 'spinner') {
    ctx.fillStyle = '#5a4030'; ctx.fillRect(x - 3, y - 18, 6, 22);
    const a = o.sp ? now / 80 : 0, bx = x + Math.cos(a) * 26, by = y - 14 + Math.sin(a) * 12;
    ctx.strokeStyle = '#999'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y - 16); ctx.lineTo(bx, by); ctx.stroke();
    ctx.fillStyle = '#606870'; ctx.beginPath(); ctx.arc(bx, by, 6, 0, 7); ctx.fill();
  } else {
    // ground traps
    const tc = { tripwire: '#c8b890', foothold: '#8a8070', sulphur: '#c8d040', brimstone: '#e06030' }[k] || '#aaa';
    if (k === 'tripwire') { ctx.strokeStyle = tc; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 22, y); ctx.lineTo(x + 22, y); ctx.stroke(); ctx.fillStyle = '#5a4030'; ctx.fillRect(x - 24, y - 3, 4, 6); ctx.fillRect(x + 20, y - 3, 4, 6); }
    else { ctx.strokeStyle = tc; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.stroke(); ctx.fillStyle = tc; for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 11, y + Math.sin(a) * 11); ctx.lineTo(x + Math.cos(a + 0.2) * 5, y + Math.sin(a + 0.2) * 5); ctx.lineTo(x + Math.cos(a - 0.2) * 5, y + Math.sin(a - 0.2) * 5); ctx.fill(); } }
  }
  ctx.globalAlpha = 1;
}
function drawEnt(o, x, y, now, self) {
  if (OBJ(o)) return drawObject(o, x, y, now);
  const r = RADIUS(o);
  const alpha = o.iv ? (isAlly(o) ? Math.max(0.35, 1 - o.iv * 0.6) : Math.max(0.06, 1 - o.iv)) : 1;
  ctx.globalAlpha = alpha;
  drawShadow(x, y, r);
  if (o.el || MOBS[o.k]?.boss) { const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 1.9); g.addColorStop(0, o.el ? 'rgba(255,200,60,.35)' : 'rgba(200,60,255,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.9, 0, 7); ctx.fill(); }
  if (o.fl & 1024) { ctx.strokeStyle = `rgba(255,60,40,${0.5 + 0.5 * Math.sin(now / 50)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 6, 0, 7); ctx.stroke(); }
  if (o.fl & 2) { ctx.strokeStyle = 'rgba(80,200,240,.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 8, 0, 7); ctx.stroke(); }
  if (o.fl & 16) { ctx.strokeStyle = 'rgba(240,190,70,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 11, now / 300, now / 300 + 4.5); ctx.stroke(); }
  const step = Math.sin(o.ph || 0) * (o.moving ? 1 : 0), ang = self ? me.ang : o.a;
  // the attack in progress: your own from the moment you pressed, everyone else's from the server
  const atk = self && me.atk && animNow - me.atk.start < 2600 ? me.atk : o.atkTool ? { tool: TOOLS[o.atkTool], start: o.atkStart } : null;
  const at = atk ? animNow - atk.start : 1e9, wkind = o.k === 'player' || MOBS[o.k]?.ai === 'kit' ? TOOL_SPRITE[o.wp] : null, swings = wkind && SWINGS.has(wkind);
  const look = o.k === 'player' ? playerLook(o.n || prof.name, o.rk || 0, facColor(o.f), o.wp, o.sh) : { weapon: TOOL_SPRITE[o.wp] || null, shieldKind: o.sh || null };
  if (swings) look.weapon = 'none';
  const img = creature(o.k, facColor(o.f) || '#888', step, at < 260 || o.sp, look);
  const w = img.width / 2 * 1.3, h = img.height / 2 * 1.3;
  // a quick step into each attack, so a swing or a thrust has weight
  const ap = at / 240, lunge = ap < 1 ? Math.sin(ap * Math.PI) * 5 : 0;
  ctx.save(); ctx.translate(x + Math.cos(ang) * lunge, y + Math.sin(ang) * lunge); ctx.rotate(o.sp && o.k !== 'player' ? now / 60 : ang);
  if (o.k === 'wraith' || o.k === 'hollow_prince') ctx.globalAlpha = alpha * 0.85;
  if (o.enr) { ctx.shadowColor = '#ff3030'; ctx.shadowBlur = 14; }
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  if (o.flash && now - o.flash < 120) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55; ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = alpha; }
  if (swings) {
    // the weapon is held at the right hand and moves through the attack
    const pose = feel.weaponPose(atk && atk.tool && atk.tool.id === o.wp ? atk.tool : null, at), ws = weaponSprite(wkind), sc = 1.3 * (o.k === 'player' ? 1 : lookScale(o.k));
    ctx.save(); ctx.translate(10 * sc, 9 * sc); ctx.rotate(pose.rot + step * 0.04); ctx.translate(pose.fwd, 0);
    ctx.drawImage(ws.c, -ws.px * sc, -ws.py * sc, ws.w * sc, ws.h * sc);
    ctx.restore();
    ctx.fillStyle = '#e0b890'; ctx.strokeStyle = 'rgba(20,14,10,.85)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(10 * sc, 9 * sc, 3.6, 0, 7); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = alpha;
  // A raised shield shows as a bright arc in front.
  if (o.fl & 32) { ctx.strokeStyle = 'rgba(210,220,240,.85)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, r + 7, ang - 0.9, ang + 0.9); ctx.stroke(); }
  if (o.fl & 1) { ctx.strokeStyle = 'rgba(200,190,170,.9)'; ctx.lineWidth = 2; for (let i = -1; i <= 1; i += 2) { ctx.beginPath(); ctx.ellipse(x + i * 6, y + r * 0.6, 6, 3, 0, 0, 7); ctx.stroke(); } }
  if (o.fl & 4) { ctx.strokeStyle = 'rgba(140,210,255,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y + r * 0.5, r + 3, r * 0.5, 0, 0, 7); ctx.stroke(); }
  ctx.globalAlpha = 1;
}
function drawLabels(o, x, y) {
  if (o.k === 'logs' || (OBJ(o) && !isAlly(o) && o.h >= o.m)) return;
  const r = RADIUS(o) * 1.25, self = o.id === myId, ally = isAlly(o);
  if (o.iv >= 0.6 && !ally) return;
  const nameCol = self ? '#fff3c4' : ally ? '#8fe07a' : '#ff7060';
  if (o.h < o.m || o.k === 'player' || MOBS[o.k]?.ai === 'kit') {
    const bw = Math.max(30, r * 2.2), by = y + r + 4;
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(x - bw / 2 - 1, by - 1, bw + 2, 5);
    ctx.fillStyle = self ? '#8fe07a' : ally ? '#6ac060' : '#c83a2a'; ctx.fillRect(x - bw / 2, by, bw * Math.max(0, o.h / o.m), 3);
  }
  ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(0,0,0,.85)';
  const line = (txt, yy, font, col, lw = 3) => { ctx.font = font; ctx.lineWidth = lw; ctx.strokeText(txt, x, yy); ctx.fillStyle = col; ctx.fillText(txt, x, yy); };
  if (o.k === 'player') {
    const f = facInfo.get(o.f), tier = self ? prof.tier : o.ti;
    line(RANKS[o.rk || 0].name, y - r - 40, '600 16px Cinzel, Georgia', '#f2ece0', 4);
    line(((self ? prof.vet : o.vt) ? '★ ' : '') + (o.n || prof.name), y - r - 23, '600 13px Cinzel, Georgia', nameCol);
    line('Tier ' + ROMAN(tier || 0) + (f && !self ? ' · ' + f.name : ''), y - r - 9, '11px Cinzel, Georgia', ally ? '#b8e0a8' : '#f0b0a0');
  } else if (o.h < o.m || o.ow || o.el || MOBS[o.k]?.ai === 'kit' || MOBS[o.k]?.boss) {
    const boss = MOBS[o.k]?.boss, f = facInfo.get(o.f);
    const nm = (o.el ? o.el[0].toUpperCase() + o.el.slice(1) + ' ' : '') + (MOBS[o.k] ? MOBS[o.k].name : o.k);
    line(nm, y - r - 22, boss || o.el ? '600 15px Cinzel, Georgia' : '600 13px Cinzel, Georgia', o.el ? '#ffd050' : '#f0e8dc');
    const sub = o.ow === myId ? 'Yours' : f ? f.name : MOBS[o.k]?.ai === 'kit' ? 'Outlaw' : '';
    if (sub) line(sub, y - r - 8, '11px Cinzel, Georgia', o.ow === myId ? '#8fe07a' : f ? f.color : nameCol);
  }
  const on = STATUS.filter((bit) => o.fl & bit);
  on.forEach((bit, n) => { const c = statusCanvas(bit); if (c) ctx.drawImage(c, x - on.length * 7.5 + n * 15, y + r + 10, 14, 14); });
}
function drawProjs(now) {
  for (const [x, y, k, a] of projs) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    if (k === 'fire' || k === 'dark' || k === 'frost') {
      const c1 = k === 'fire' ? '255,140,40' : k === 'frost' ? '140,210,255' : '170,90,255';
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 14); g.addColorStop(0, '#fff'); g.addColorStop(0.3, `rgba(${c1},1)`); g.addColorStop(1, `rgba(${c1},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 14, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(${c1},.35)`; ctx.beginPath(); ctx.moveTo(-6, -5); ctx.lineTo(-26, 0); ctx.lineTo(-6, 5); ctx.fill();
    } else if (k === 'stone') {
      ctx.fillStyle = '#8a8478'; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(200,200,190,.3)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-4, 0); ctx.stroke();
    } else if (k === 'pilum' || k === 'dart') {
      const L = k === 'pilum' ? 30 : 16;
      ctx.strokeStyle = '#7a5530'; ctx.lineWidth = k === 'pilum' ? 2.5 : 2; ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(4, 0); ctx.stroke();
      ctx.fillStyle = '#e0e6ee'; ctx.beginPath(); ctx.moveTo(4, -3); ctx.lineTo(13, 0); ctx.lineTo(4, 3); ctx.fill();
      if (k === 'dart') { ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, 7); ctx.fill(); }
    } else if (k === 'rope') {
      ctx.strokeStyle = '#c8a870'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-7, 0); ctx.quadraticCurveTo(-20, 6, -34, 0); ctx.stroke();
    } else if (k === 'vial') {
      ctx.fillStyle = '#d8e0ea'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill(); ctx.fillStyle = '#9ab0c8'; ctx.beginPath(); ctx.arc(1, 1, 2.5, 0, 7); ctx.fill();
    } else {
      if (k === 'bolt') { ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(6, 0); ctx.stroke(); ctx.fillStyle = '#d8dce0'; ctx.beginPath(); ctx.moveTo(6, -3); ctx.lineTo(11, 0); ctx.lineTo(6, 3); ctx.fill(); }
      else {
        ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(6, 0); ctx.stroke();
        ctx.fillStyle = '#d8dce0'; ctx.beginPath(); ctx.moveTo(6, -2.5); ctx.lineTo(11, 0); ctx.lineTo(6, 2.5); ctx.fill();
        ctx.fillStyle = '#e8e0d0'; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-18, -3.5); ctx.lineTo(-11, 0); ctx.lineTo(-18, 3.5); ctx.fill();
      }
    }
    ctx.restore();
  }
}
const LOB_COL = { gall: '#b8d860', naphtha: '#ff8a30', saltpetre: '#f0f0e0', net: '#c8b890' };
function drawZones(now) {
  for (const z of zones) {
    if (z.t === 'cloud' || z.t === 'smoke') {
      const fade = Math.min(1, z.l / 600), green = z.t === 'cloud';
      for (let i = 0; i < 9; i++) {
        const a = i * 0.7 + now / 1600, d = z.r * (0.25 + (i % 3) * 0.25);
        ctx.fillStyle = green ? `rgba(190,200,60,${0.18 * fade})` : `rgba(150,150,160,${0.32 * fade})`;
        ctx.beginPath(); ctx.arc(z.x + Math.cos(a) * d, z.y + Math.sin(a) * d, z.r * 0.45, 0, 7); ctx.fill();
      }
    } else if (z.t === 'fire') {
      const fade = Math.min(1, z.l / 500);
      ctx.fillStyle = `rgba(80,30,10,${0.25 * fade})`; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 7); ctx.fill();
      for (let i = 0; i < 14; i++) {
        const a = i * 2.39, d = Math.sqrt((i * 0.618) % 1) * z.r * 0.9, fl = Math.sin(now / 80 + i) * 3;
        const g = ctx.createRadialGradient(z.x + Math.cos(a) * d, z.y + Math.sin(a) * d - 4, 1, z.x + Math.cos(a) * d, z.y + Math.sin(a) * d - 4, 12 + fl);
        g.addColorStop(0, `rgba(255,230,140,${0.8 * fade})`); g.addColorStop(0.5, `rgba(255,120,30,${0.5 * fade})`); g.addColorStop(1, 'rgba(200,40,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(z.x + Math.cos(a) * d, z.y + Math.sin(a) * d - 4, 12 + fl, 0, 7); ctx.fill();
      }
    } else if (z.t === 'lob') {
      // A thrown flask arcs from the thrower to where it lands; its landing circle shows the area.
      const p = Math.min(1, Math.max(0, 1 - z.l / z.d)), x = z.sx + (z.x - z.sx) * p, y = z.sy + (z.y - z.sy) * p - Math.sin(p * Math.PI) * 60;
      ctx.strokeStyle = 'rgba(255,220,160,.5)'; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = LOB_COL[z.k] || '#ddd'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill(); ctx.stroke();
    } else if (z.t === 'blast') {
      const p = Math.min(1, 1 - z.l / z.d);
      ctx.strokeStyle = 'rgba(255,60,40,.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 7); ctx.stroke();
      ctx.fillStyle = `rgba(255,50,30,${0.12 + 0.22 * p})`; ctx.beginPath(); ctx.arc(z.x, z.y, z.r * Math.max(0.05, p), 0, 7); ctx.fill();
    } else if (z.t === 'web' || z.t === 'net') {
      ctx.strokeStyle = z.t === 'net' ? 'rgba(200,180,130,.8)' : 'rgba(235,235,245,.55)'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(z.x, z.y); ctx.lineTo(z.x + Math.cos(a) * z.r, z.y + Math.sin(a) * z.r); ctx.stroke(); }
      for (let k = 1; k <= 4; k++) { ctx.beginPath(); for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI * 2, rr = (z.r * k) / 4; i ? ctx.lineTo(z.x + Math.cos(a) * rr, z.y + Math.sin(a) * rr) : ctx.moveTo(z.x + Math.cos(a) * rr, z.y + Math.sin(a) * rr); } ctx.stroke(); }
    }
  }
}
// Attack effects are drawn around the attacker's current position, so they move with them.
function fxAnchor(f) {
  if (f.i === undefined) return [f.x, f.y];
  if (f.i === myId) return [me.x, me.y];
  const o = ents.get(f.i); return o ? [o.x, o.y] : [f.x, f.y];
}
// A slash: a crescent that sweeps across the arc, bright at its leading edge and fading behind it.
function drawSlash(f, t) {
  const p = Math.min(1, t / 110), fade = Math.max(0, 1 - Math.max(0, t - 110) / 230);
  if (fade <= 0) return;
  const [ax, ay] = fxAnchor(f), a0 = f.a - f.w / 2, sweep = f.w * p, col = f.c ? '230,80,100' : '255,246,226';
  if (sweep < 0.02) return;
  ctx.save(); ctx.translate(ax, ay); ctx.globalCompositeOperation = 'lighter';
  const frac = Math.min(0.998, sweep / (Math.PI * 2)), g = ctx.createConicGradient(a0, 0, 0);
  g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(frac * 0.55, `rgba(${col},${0.16 * fade})`); g.addColorStop(frac, `rgba(${col},${0.7 * fade})`); g.addColorStop(Math.min(1, frac + 0.002), `rgba(${col},0)`);
  ctx.fillStyle = g;
  // outer edge along the arc, inner edge closing in toward the leading end (a crescent)
  ctx.beginPath(); ctx.arc(0, 0, f.r * 1.04, a0, a0 + sweep);
  for (let k = 24; k >= 0; k--) { const q = k / 24, an = a0 + sweep * q, rr = f.r * (0.95 - 0.38 * q); ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = `rgba(255,255,255,${0.85 * fade})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, f.r * 1.03, a0 + sweep * 0.45, a0 + sweep); ctx.stroke(); ctx.lineCap = 'butt';
  ctx.restore();
}
// A thrust: a tapered streak shooting out to the weapon's reach, with a glint at the tip.
function drawThrust(f, t) {
  const ext = Math.min(1, t / 70), fade = Math.max(0, 1 - Math.max(0, t - 70) / 210);
  if (fade <= 0) return;
  const [ax, ay] = fxAnchor(f), r1 = f.r0 + (f.r1 - f.r0) * ext;
  ctx.save(); ctx.translate(ax, ay); ctx.rotate(f.a); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(f.r0, 0, r1, 0);
  g.addColorStop(0, 'rgba(190,210,255,0)'); g.addColorStop(0.65, `rgba(215,230,255,${0.32 * fade})`); g.addColorStop(1, `rgba(255,255,255,${0.9 * fade})`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(f.r0, -6); ctx.lineTo(r1 - 8, -2.4); ctx.lineTo(r1 + 5, 0); ctx.lineTo(r1 - 8, 2.4); ctx.lineTo(f.r0, 6); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = `rgba(225,236,255,${0.38 * fade})`; ctx.lineWidth = 1.2;
  for (const off of [-10, 10]) { ctx.beginPath(); ctx.moveTo(f.r0 + (r1 - f.r0) * 0.3, off); ctx.lineTo(r1 - 16, off * 0.55); ctx.stroke(); }
  const gl = ctx.createRadialGradient(r1, 0, 0, r1, 0, 10); gl.addColorStop(0, `rgba(255,255,255,${fade})`); gl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(r1, 0, 10, 0, 7); ctx.fill();
  ctx.restore();
}
function drawFx(now) {
  fxs = fxs.filter((f) => now - f.t0 < 650);
  for (const f of fxs) {
    const t = now - f.t0, a = Math.max(0, 1 - t / 380);
    if (f.t === 'arc') drawSlash(f, t);
    else if (f.t === 'thrust') drawThrust(f, t);
    else if (f.t === 'ring') {
      const rr = f.r * Math.min(1, t / 220 + 0.2);
      ctx.globalAlpha = a; ctx.strokeStyle = f.c; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(f.x, f.y, rr, 0, 7); ctx.stroke();
      if (f.fill) { ctx.globalAlpha = a * 0.25; ctx.fillStyle = f.c; ctx.fill(); }
      ctx.globalAlpha = 1;
    } else if (f.t === 'boom') {
      const p = Math.min(1, t / 160 + 0.25), rr = f.r * p;
      const g = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, rr); g.addColorStop(0, `rgba(255,250,200,${a})`); g.addColorStop(0.4, `rgba(255,140,40,${0.8 * a})`); g.addColorStop(1, 'rgba(120,30,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, rr, 0, 7); ctx.fill();
    } else if (f.t === 'parry') {
      ctx.strokeStyle = `rgba(255,240,140,${a})`; ctx.lineWidth = 3;
      for (let i = 0; i < 8; i++) { const an = i * 0.785 + t / 80; ctx.beginPath(); ctx.moveTo(f.x + Math.cos(an) * 10, f.y + Math.sin(an) * 10); ctx.lineTo(f.x + Math.cos(an) * (22 + t / 15), f.y + Math.sin(an) * (22 + t / 15)); ctx.stroke(); }
    } else if (f.t === 'line') {
      ctx.globalAlpha = a; ctx.strokeStyle = f.c; ctx.lineWidth = f.w || 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke(); ctx.globalAlpha = 1; ctx.lineCap = 'butt';
    } else if (f.t === 'poof') {
      ctx.fillStyle = f.c ? `rgba(60,30,90,${0.5 * a})` : `rgba(210,205,195,${0.45 * a})`;
      for (let i = 0; i < 5; i++) { const an = i * 1.26 + f.seed; ctx.beginPath(); ctx.arc(f.x + Math.cos(an) * t / 22, f.y + Math.sin(an) * t / 22 - t / 40, 8 + t / 40, 0, 7); ctx.fill(); }
    } else if (f.t === 'pulse') {
      const rr = f.r * Math.max(0.05, 1 - t / 380);
      ctx.strokeStyle = `rgba(150,110,255,${a})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(f.x, f.y, rr, 0, 7); ctx.stroke();
    } else if (f.t === 'spark') {
      ctx.fillStyle = `rgba(255,230,160,${a})`; for (let i = 0; i < 4; i++) { const an = i * 1.57 + f.seed; ctx.fillRect(f.x + Math.cos(an) * t / 30, f.y + Math.sin(an) * t / 30, 2, 2); }
    }
  }
  floaters = floaters.filter((f) => now - f.t0 < f.life);
  ctx.textAlign = 'center'; ctx.font = '600 14px Cinzel, Georgia'; ctx.lineJoin = 'round';
  for (const f of floaters) {
    const p = (now - f.t0) / f.life;
    const pop = f.pop ? 1 + 0.6 * Math.max(0, 1 - p * 6) : 1;
    ctx.font = f.big ? `600 ${Math.round((20 + 8 * Math.max(0, 1 - p * 4)) * pop)}px Cinzel, Georgia` : `600 ${Math.round(15 * pop)}px Cinzel, Georgia`;
    ctx.globalAlpha = 1 - p * p; ctx.strokeStyle = '#000'; ctx.lineWidth = f.big ? 4 : 3; ctx.strokeText(f.txt, f.x, f.y - p * 34); ctx.fillStyle = f.c; ctx.fillText(f.txt, f.x, f.y - p * 34); ctx.globalAlpha = 1;
  }
}
// Loot bags on the ground: gold sacks and bundles of wood.
function drawLoot(now) {
  for (const [, x, y, kind] of loot) {
    const bob = Math.sin(now / 300 + x) * 2;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x + 2, y + 9, 11, 5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#8a6030'; ctx.beginPath(); ctx.ellipse(x, y + bob, 11, 10, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 1.5; ctx.stroke();
    if (kind === 'gold') { ctx.fillStyle = '#ffd040'; for (const [dx, dy] of [[-4, -6], [3, -7], [0, -4]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy + bob, 3, 0, 7); ctx.fill(); } }
    else { ctx.fillStyle = '#c89a60'; for (const dx of [-4, 0, 4]) { ctx.beginPath(); ctx.arc(x + dx, y - 6 + bob, 2.5, 0, 7); ctx.fill(); } }
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

// ------------------------------------------------------------------ frame
let last = performance.now(), frameNo = 0;
// Prop sprites are looked up once per prop and kept on it.
function propSprite(p) { return p.spr || (p.spr = prop(p.k, p.v, REGIONS[regionAt(p.x, p.y)].biome)); }
// A ring around you while a channel (quick travel, rally, hiring) runs.
function drawChannel() {
  if (!me.ch) return;
  const [rem, total, label] = me.ch, f = 1 - rem / total, cx = VW / 2, cy = VH / 2 - 60 * zoom;
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.arc(cx, cy, 22, 0, 7); ctx.stroke();
  ctx.strokeStyle = '#c8a0ff'; ctx.beginPath(); ctx.arc(cx, cy, 22, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke();
  ctx.font = '600 13px Cinzel, Georgia'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000';
  ctx.strokeText(label, cx, cy - 32); ctx.fillStyle = '#e8d8ff'; ctx.fillText(label, cx, cy - 32);
}
// Where a placed tool will land, drawn while its key is held.
function drawPlacement() {
  for (const s of held) {
    const t = TOOLS[prof.belt[s]];
    if (!t || !isPlaced(t)) continue;
    const w = worldMouse(), max = t.range, d = Math.min(max, Math.hypot(w.x - me.x, w.y - me.y)), a = Math.atan2(w.y - me.y, w.x - me.x);
    const x = me.x + Math.cos(a) * d, y = me.y + Math.sin(a) * d;
    ctx.strokeStyle = 'rgba(255,240,180,.7)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, t.r || 20, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  }
}
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  // Hit-stop: the animation clock pauses for a moment when a blow lands.
  if (feel.stopped(now)) pausedMs += dt * 1000;
  animNow = now - pausedMs;
  for (const sl of new Set([...held, ...toggled])) { const t = TOOLS[prof.belt[sl]]; if (t) predictAttack(t, now); }
  firePending(now);
  feel.stepParticles(dt, now);
  // Keyboard turning nudges the aim; facing follows the aim at a fixed rate, like on the server.
  if (kbTurn !== null) kbTurn += ((pressed('turnr') ? 1 : 0) - (pressed('turnl') ? 1 : 0)) * TURN_RATE * dt;
  if (!me.dead) me.ang = turnToward(me.ang, aimAngle(), TURN_RATE * dt);
  // You move instantly on your own screen using the same collision as the server; backpedalling is slower.
  const k = mask();
  const dx = ((k & 8) ? 1 : 0) - ((k & 4) ? 1 : 0), dy = ((k & 2) ? 1 : 0) - ((k & 1) ? 1 : 0), len = Math.hypot(dx, dy);
  const ox = me.x, oy = me.y;
  if (len > 0 && !me.dead && me.sp > 0) {
    const sp = me.sp * (angDiff(Math.atan2(dy, dx), me.ang) > BACKPEDAL_ANGLE ? BACKPEDAL : 1);
    [me.x, me.y] = moveBody(me.x, me.y, 14, (dx / len) * sp * dt, (dy / len) * sp * dt);
  }
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
  ctx.fillStyle = '#152f58'; ctx.fillRect(0, 0, VW, VH);
  const [shx, shy] = feel.shakeOffset(dt);
  ctx.save(); ctx.translate(VW / 2 + shx, VH / 2 + shy); ctx.scale(zoom, zoom); ctx.translate(-me.x, -me.y);
  const hw = VW / 2 / zoom, hh = VH / 2 / zoom, x0 = me.x - hw, y0 = me.y - hh, x1 = me.x + hw, y1 = me.y + hh;
  chunkBudget = 1;
  for (let cy = Math.floor(y0 / CHUNK); cy <= Math.floor(y1 / CHUNK); cy++) for (let cx = Math.floor(x0 / CHUNK); cx <= Math.floor(x1 / CHUNK); cx++) {
    if (cx < 0 || cy < 0 || cx * CHUNK >= WW || cy * CHUNK >= WORLD_H) continue;
    const c = getChunk(cx, cy);
    if (c) ctx.drawImage(c, cx * CHUNK, cy * CHUNK, CHUNK + 0.5, CHUNK + 0.5);
    else { ctx.fillStyle = '#4a6a3a'; ctx.fillRect(cx * CHUNK, cy * CHUNK, CHUNK, CHUNK); }
  }
  if (worker && pending.size === 0 && frameNo % 10 === 0) {
    for (let cy = Math.floor((y0 - CHUNK) / CHUNK); cy <= Math.floor((y1 + CHUNK) / CHUNK); cy++) for (let cx = Math.floor((x0 - CHUNK) / CHUNK); cx <= Math.floor((x1 + CHUNK) / CHUNK); cx++)
      if (cx >= 0 && cy >= 0 && cx * CHUNK < WW && cy * CHUNK < WORLD_H) getChunk(cx, cy);
  }
  drawBridges(x0, y0, x1, y1);
  const VS = VILLAGE_SPRITE_SIZE, csz = (c) => castleSize(c.type);
  const visCastles = CASTLES.filter((c) => { const h = csz(c) / 2; return c.x + h > x0 && c.x - h < x1 && c.y + h > y0 && c.y - h < y1; });
  for (const c of visCastles) { const S = csz(c); ctx.drawImage(castleBase(c), c.x - S / 2, c.y - S / 2, S, S); }
  for (const cv2 of CAVES) if (Math.abs(cv2.x - me.x) < hw + 100 && Math.abs(cv2.y - me.y) < hh + 100) ctx.drawImage(caveSprite(DUNGEONS[cv2.dungeon].theme), cv2.x - 75, cv2.y - 70, 150, 130);
  const dgHere = dungeonAt(me.x, me.y);
  if (dgHere) for (const q of [dgHere.exitPortal, dgHere.bossPortal]) { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(now / 600); ctx.drawImage(portalSprite(), -38, -38, 76, 76); ctx.restore(); }
  drawLoot(now);
  const villageVis = Math.abs(VILLAGE.x - me.x) < hw + VS && Math.abs(VILLAGE.y - me.y) < hh + VS;
  if (villageVis) ctx.drawImage(villageBase(), VILLAGE.x - VS / 2, VILLAGE.y - VS / 2, VS, VS);
  const props = propsIn(x0 - 60, y0 - 60, x1 + 60, y1 + 60), tall = [];
  for (const p of props) {
    if (TALL.has(p.k)) { tall.push(p); continue; }
    const s = propSprite(p), w = s.c.width / 2;
    ctx.drawImage(s.c, p.x - w / 2, p.y - w / 2, w, w);
  }
  feel.drawDecals(ctx, now, x0, y0, x1, y1);
  feel.drawBodies(ctx, now, x0, y0, x1, y1, bodySprite);
  drawZones(now);
  // Ground objects (traps, log piles) first, then everything with height sorted by y.
  const list = [];
  for (const o of ents.values()) {
    if (o.id === myId || o.x < x0 - 80 || o.x > x1 + 80 || o.y < y0 - 80 || o.y > y1 + 80) continue;
    if (OBJ(o) && MOBS[o.k].trap && o.k !== 'spinner') drawObject(o, o.x, o.y, now);
    else list.push({ y: o.y, o });
  }
  const self = ents.get(myId) || { id: myId, k: 'player', a: 0 };
  Object.assign(self, { h: me.h, m: me.mh, fl: me.fl, f: prof.fac, n: prof.name, rk: rankOf(me.v).idx, ph: me.ph, moving: me.moving, flash: me.flash, iv: me.iv || 0 });
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
    } else drawEnt(it.o, it.self ? me.x : it.o.x, it.self ? me.y : it.o.y, now, it.self);
  }
  for (const c of visCastles) {
    const S = csz(c);
    ctx.drawImage(castleTop(c, facColor(owners.get(c.id)) || '#8a5a42'), c.x - S / 2, c.y - S / 2, S, S);
  }
  if (villageVis) ctx.drawImage(villageTop(), VILLAGE.x - VS / 2, VILLAGE.y - VS / 2, VS, VS);
  feel.drawParticles(ctx);
  drawProjs(now);
  drawPlacement();
  for (const it of list) if (it.o) drawLabels(it.o, it.self ? me.x : it.o.x, it.self ? me.y : it.o.y);
  for (const c of visCastles) {
    const f = facInfo.get(owners.get(c.id)), top = c.y - CASTLE_TYPES[c.type].outer;
    ctx.textAlign = 'center'; ctx.font = '600 16px Cinzel, Georgia'; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    ctx.strokeText(c.name, c.x, top - 50); ctx.fillStyle = '#fff4d8'; ctx.fillText(c.name, c.x, top - 50);
    ctx.font = '13px Cinzel, Georgia'; const lbl = (f ? 'Held by ' + f.name : 'Held by bandits') + ' · ' + '◆'.repeat(c.danger) + (levels.get(c.id) > 1 ? ' · level ' + levels.get(c.id) : '');
    ctx.strokeText(lbl, c.x, top - 32); ctx.fillStyle = f ? f.color : '#c8c0b0'; ctx.fillText(lbl, c.x, top - 32);
  }
  for (const cv2 of CAVES) if (Math.abs(cv2.x - me.x) < hw + 100 && Math.abs(cv2.y - me.y) < hh + 100) {
    const d = DUNGEONS[cv2.dungeon];
    ctx.textAlign = 'center'; ctx.font = '600 15px Cinzel, Georgia'; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 4;
    ctx.strokeText(d.name, cv2.x, cv2.y - 66); ctx.fillStyle = '#e0d0ff'; ctx.fillText(d.name, cv2.x, cv2.y - 66);
    ctx.font = '12px Cinzel, Georgia'; const sub = 'Dungeon · ' + '◆'.repeat(d.danger) + ' · walk in to enter';
    ctx.strokeText(sub, cv2.x, cv2.y - 50); ctx.fillStyle = '#c8b8e8'; ctx.fillText(sub, cv2.x, cv2.y - 50);
  }
  drawBossBar();
  if (villageVis) {
    ctx.textAlign = 'center'; ctx.font = '600 16px Cinzel, Georgia'; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 4;
    ctx.strokeText('Hanbin Haven (safe zone)', VILLAGE.x, VILLAGE.y - VILLAGE.r - 18); ctx.fillStyle = '#b8f0b0'; ctx.fillText('Hanbin Haven (safe zone)', VILLAGE.x, VILLAGE.y - VILLAGE.r - 18);
  }
  drawFx(now);
  ctx.restore();
  drawChannel();
  const fa = feel.flashAlpha(now); if (fa > 0) { ctx.fillStyle = `rgba(160,0,0,${fa})`; ctx.fillRect(0, 0, VW, VH); }
  const hurt = me.h < me.mh * 0.3 && !me.dead;
  if (hurt) ctx.globalAlpha = 0.75 + 0.25 * Math.sin(now / 200);
  ctx.drawImage(getVignette(hurt), 0, 0, VW, VH); ctx.globalAlpha = 1;
  if (++frameNo % 6 === 0) drawMinimap();
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ start
$('resetBtn').onclick = () => {
  if (!prof.unlocked.length) return toast('You have no unlocks to reset.');
  if (Math.hypot(me.x - VILLAGE.x, me.y - VILLAGE.y) > VILLAGE.r) return toast('Respec only works in Hanbin Haven.');
  if (confirm(`Relock all ${prof.unlocked.length} unlocked tools and get every key back, for ${Math.floor(me.s * RESPEC_COST).toLocaleString()} soma (5%)?`)) send({ t: 'respec' });
};
applyBinds();
buildHotbar();
setMode('login');
showLogin();
if (store.get('hanbin_session') && store.get('hanbin_user')) connect();
