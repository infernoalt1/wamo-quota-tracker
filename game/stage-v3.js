const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const AVATARS = ['orb', 'bolt', 'star', 'moon', 'wave', 'flower', 'diamond', 'cross'];
const FACES = { orb:'Panda', bolt:'Fox', star:'Robot', moon:'Cat', wave:'Frog', flower:'Purple robot', diamond:'Koala', cross:'Octopus' };
const face = avatar => `<span class="avatar-face" data-face="${AVATARS.includes(avatar) ? avatar : 'orb'}" aria-hidden="true"></span>`;
const SESSION_KEY = 'contact_room_session';
const PROFILE_KEY = 'contact_room_profile';

const state = {
  socket: null,
  room: null,
  joinedCode: '',
  avatar: 'orb',
  sessionId: getSessionId(),
  reconnectTimer: null,
  toastTimer: null,
  intentionalClose: false
};

const landingView = $('#landingView');
const roomView = $('#roomView');
const connectionStatus = $('#connectionStatus');
const nameInput = $('#nameInput');
const roomInput = $('#roomInput');
const avatarPicker = $('#avatarPicker');
const createBtn = $('#createBtn');
const joinForm = $('#joinForm');
const roomCode = $('#roomCode');
const copyInviteBtn = $('#copyInviteBtn');
const leaveBtn = $('#leaveBtn');
const playerList = $('#playerList');
const playerCount = $('#playerCount');
const lobbyCard = $('#lobbyCard');
const gameCard = $('#gameCard');
const activityList = $('#activityList');
const toast = $('#toast');

function getSessionId() {
  let value = sessionStorage.getItem(SESSION_KEY);
  if (!value) {
    value = `p_${crypto.randomUUID().replaceAll('-', '')}`;
    sessionStorage.setItem(SESSION_KEY, value);
  }
  return value;
}

function loadProfile() {
  try {
    const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
    if (profile.name) nameInput.value = String(profile.name).slice(0, 24);
    if (AVATARS.includes(profile.avatar)) state.avatar = profile.avatar;
  } catch {}
}

function saveProfile() {
  localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: nameInput.value.trim(), avatar: state.avatar }));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function setConnection(kind, label) {
  connectionStatus.className = `connection ${kind || ''}`;
  $('span', connectionStatus).textContent = label;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function socketUrl() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}/game/ws`;
}

function connect(afterOpen) {
  if (state.socket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(state.socket.readyState)) {
    if (state.socket.readyState === WebSocket.OPEN && afterOpen) afterOpen();
    else if (state.socket.readyState === WebSocket.CONNECTING && afterOpen) state.socket.addEventListener('open', afterOpen, { once: true });
    return;
  }
  setConnection('', 'connecting');
  const ws = new WebSocket(socketUrl());
  state.socket = ws;

  ws.addEventListener('open', () => {
    setConnection('online', 'live');
    clearTimeout(state.reconnectTimer);
    if (afterOpen) afterOpen();
    else if (state.joinedCode) sendJoin(state.joinedCode, true);
  });

  ws.addEventListener('message', (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.type === 'error') return showToast(message.message || 'Something went wrong.');
    if (message.type === 'notice') return showToast(message.message || '');
    if (message.type === 'joined') {
      clearTimeout(state.toastTimer);
      toast.classList.remove('show');
      state.joinedCode = message.code;
      history.replaceState({}, '', `/game/room/${message.code}`);
      landingView.classList.add('hidden');
      roomView.classList.remove('hidden');
      return;
    }
    if (message.type === 'state') {
      state.room = message.room;
      state.clockOffset = message.serverNow - Date.now();
      renderRoom();
    }
  });

  ws.addEventListener('close', (event) => {
    if (event.code === 4001) {
      state.intentionalClose = true;
      setConnection('offline', 'Open in another tab');
      return;
    }
    setConnection('offline', 'reconnecting');
    if (!state.intentionalClose) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = setTimeout(() => connect(), 1600);
    }
  });

  ws.addEventListener('error', () => setConnection('offline', 'offline'));
}

function send(payload) {
  if (state.socket?.readyState !== WebSocket.OPEN) {
    showToast('Reconnecting…');
    connect(() => send(payload));
    return;
  }
  state.socket.send(JSON.stringify(payload));
}

function getName() {
  return nameInput.value.trim().replace(/\s+/g, ' ').slice(0, 24);
}

function ensureProfile() {
  if (!getName()) {
    nameInput.focus();
    showToast('Enter your name first.');
    return false;
  }
  saveProfile();
  return true;
}

function sendJoin(code, reconnect = false) {
  const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
  const name = reconnect ? (profile.name || getName()) : getName();
  send({ type: 'join_room', code, sessionId: state.sessionId, name, avatar: state.avatar });
}

function setupAvatars() {
  avatarPicker.innerHTML = '';
  for (const avatar of AVATARS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `avatar-option${avatar === state.avatar ? ' selected' : ''}`;
    button.dataset.avatar = avatar;
    button.setAttribute('aria-label', FACES[avatar]);
    button.innerHTML = face(avatar);
    button.addEventListener('click', () => {
      state.avatar = avatar;
      $$('.avatar-option', avatarPicker).forEach((el) => el.classList.toggle('selected', el === button));
      saveProfile();
    });
    avatarPicker.appendChild(button);
  }
}

function playerById(id) {
  return state.room?.players.find((p) => p.id === id);
}

function me() {
  return state.room?.my;
}

function formatTime(ts) {
  if (!ts) return '';
  return new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' }).format(new Date(ts));
}

function renderPlayers() {
  const room = state.room;
  playerCount.textContent = `${room.players.filter(p => p.connected).length} / 10`;
  playerList.innerHTML = room.players.map(p => `<div class="player ${p.connected ? '' : 'offline'}">
    ${face(p.avatar)}<div class="player-name">${escapeHtml(p.name)}
    <small>${p.isHost ? '<span class="role host">Host</span>' : ''}${p.isMaster ? '<span class="role master">Word Master</span>' : ''}</small>
    <span class="player-presence"><i></i>${p.connected ? 'Connected' : 'Offline'}</span></div></div>`).join('');
}

function renderActivity() {
  const events = state.room.events || [];
  activityList.innerHTML = events.slice(0, 7).map(event => `<div class="activity ${escapeHtml(event.tone || '')}"><i></i><span>${escapeHtml(event.text)}</span><time>${escapeHtml(formatTime(event.at))}</time></div>`).join('');
}

function renderSummary() {
  const room = state.room;
  const selected = $('#masterSelect')?.value || (room.phase === 'picking' ? room.masterId : '');
  const minutes = $('#roundMinutes')?.value || room.roundMinutes;
  $('#sideTools').innerHTML = `<section class="panel summary-panel"><h3>Room summary</h3>
    <div class="summary-row"><span>Players</span><strong>${room.players.filter(p => p.connected).length} / 10</strong></div>
    <div class="summary-row"><span>Round time</span><strong>${escapeHtml(minutes)} min</strong></div>
    <div class="summary-row"><span>Word Master</span><strong>${escapeHtml(playerById(selected)?.name || 'Not selected')}</strong></div>
    <div class="summary-row"><span>Skip voting</span><strong>Half of others</strong></div>
    <div class="summary-code"><span>Room code</span><strong>${room.code}</strong></div></section>`;
}

function bindSetup() {
  if (!['lobby','round_end','picking'].includes(state.room.phase)) return;
  renderSummary();
  const select = $('#masterSelect');
  if (!select) return;
  const refresh = () => {
    $$('[data-master]').forEach(button => {
      const selected = button.dataset.master === select.value;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    $$('[data-minutes]').forEach(button => {
      const selected = button.dataset.minutes === $('#roundMinutes').value;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    renderSummary();
  };
  $$('[data-master]').forEach(button => button.addEventListener('click', () => { select.value = button.dataset.master; refresh(); }));
  $$('[data-minutes]').forEach(button => button.addEventListener('click', () => { $('#roundMinutes').value = button.dataset.minutes; refresh(); }));
  select.addEventListener('change', refresh);
  $('#roundMinutes').addEventListener('input', refresh);
  $('#randomMaster')?.addEventListener('click', () => {
    const players = state.room.players.filter(p => p.connected);
    select.value = players[Math.floor(Math.random()*players.length)].id;
    refresh();
  });
  refresh();
}

function renderLobby() {
  const room = state.room;
  gameCard.classList.add('hidden');
  lobbyCard.classList.remove('hidden');
  $('#headerClock').innerHTML = '';
  if (room.phase === 'lobby' || room.phase === 'round_end') {
    const finished = room.phase === 'round_end';
    const connected = room.players.filter(p => p.connected);
    lobbyCard.innerHTML = `<div class="setup-surface"><h1>${finished ? (room.winner === 'master' ? 'Word Master wins!' : 'Contactors win!') : 'Ready to Play?'}</h1>
      ${finished ? `<div class="secret-reveal">${escapeHtml(room.revealedSecret)}</div>` : ''}
      ${me().isHost ? `<form id="roundForm">
        <div class="setup-row"><h2><span class="setup-icon">◷</span>Round time</h2><div class="time-options">${[3,5,8,10].map(n => `<button type="button" class="time-pill" data-minutes="${n}">${n} min</button>`).join('')}<label class="custom-time"><span>Custom</span><input id="roundMinutes" aria-label="Time limit in minutes" type="number" min="1" max="60" step="1" required value="${room.roundMinutes || 5}" /></label></div></div>
        <div class="setup-row master-row"><h2><span class="setup-icon">♛</span>Word Master</h2><div class="master-options">${connected.map(p => `<button type="button" class="master-choice" data-master="${p.id}">${face(p.avatar)}<span>${escapeHtml(p.name)}</span><b aria-hidden="true">♛</b></button>`).join('')}</div>
        <label class="sr-only" for="masterSelect">Word Master</label><select id="masterSelect" class="select-fallback" tabindex="-1" aria-hidden="true"><option value="">Choose a player</option>${connected.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}</select></div>
        <div class="setup-row skip-setting"><h2><span class="setup-icon">⏩</span>Skip voting</h2><span class="enabled-pill">On</span><p class="skip-rule">Author can skip instantly. Otherwise, half of the other contactors must vote, rounded up.</p></div>
        <div class="rule-note">Only one active clue at a time.</div><div class="timeout-note">♛ &nbsp; Time runs out — Word Master wins.</div>
        <div class="setup-actions"><button id="randomMaster" type="button" class="button glass">⤨ &nbsp; Pick random</button><button class="button red start-button" type="submit" ${connected.length<3 ? 'disabled' : ''}>▶ &nbsp; ${finished ? 'Next Round' : 'Start Round'}</button></div>
        ${connected.length<3 ? '<p class="waiting-note">Waiting for at least 3 players.</p>' : ''}
      </form>` : '<div class="waiting-stage"><span class="waiting-orbit"></span><p>Waiting for the host to choose the Word Master.</p></div>'}</div>`;
    $('#roundForm')?.addEventListener('submit', event => {
      event.preventDefault();
      if (!$('#masterSelect').value) return showToast('Choose a Word Master.');
      send({type:'start_round',masterId:$('#masterSelect').value,roundMinutes:Number($('#roundMinutes').value)});
    });
    return;
  }
  const master = playerById(room.masterId);
  lobbyCard.innerHTML = `<div class="setup-surface picking"><span class="master-emblem">♛</span><p class="eyebrow">Round ${room.round}</p><h1>${me().isMaster ? 'Choose your word' : `${escapeHtml(master?.name || 'Word Master')} is choosing`}</h1>
    ${me().isMaster ? `<form id="secretForm" class="inline-form"><label class="sr-only" for="secretInput">Secret word</label><input id="secretInput" type="password" maxlength="40" autocomplete="off" placeholder="Secret word" required /><button class="button blue" type="submit">Lock it in</button></form>` : '<div class="waiting-orbit"></div>'}</div>`;
  $('#secretForm')?.addEventListener('submit', event => {event.preventDefault();send({type:'set_secret',word:$('#secretInput').value});});
}

function renderWordProgress() {
  const prefix = state.room.prefix || '';
  const letters = [...prefix].map((char) => `<span class="word-letter revealed">${escapeHtml(char)}</span>`);
  letters.push('<span class="word-letter unknown">?</span>');
  return letters.join('');
}

function renderGame() {
  const room = state.room, mine = me();
  const clue = room.clues.find(c => ['open','countdown'].includes(c.status));
  const last = room.clues.find(c => !['open','countdown'].includes(c.status));
  const author = clue && playerById(clue.authorId);
  const canContact = clue && clue.status === 'open' && clue.authorId !== mine.id && !mine.isMaster;
  lobbyCard.classList.add('hidden');gameCard.classList.remove('hidden');
  $('#headerClock').innerHTML = '<div class="timer-pod"><span>Time left</span><strong id="roundClock">0:00</strong></div><span class="timer-rule">♛<span>Word Master wins<br>if time expires</span></span>';
  gameCard.innerHTML = `<div class="word-stage"><div class="word-progress" aria-label="Revealed prefix">${renderWordProgress()}</div><div class="round-label">Round ${room.round} · ${escapeHtml(playerById(room.masterId)?.name)} is Word Master</div></div>
    <article class="clue-stage ${clue?.status === 'countdown' ? 'contact-live' : ''}">
      <div class="clue-stage-top">${clue ? face(author?.avatar) : '<span class="stage-symbol">✦</span>'}<span>${clue ? `${escapeHtml(author?.name)}’s clue` : 'Next clue'}</span><span class="clue-status">${clue?.status === 'countdown' ? 'Contact in progress' : clue ? 'Open' : ''}</span></div>
      <div class="clue-body"><p class="clue-text">${clue ? escapeHtml(clue.text) : 'Waiting for a clue'}</p>${clue?.status==='countdown' ? `<div class="countdown" data-countdown="${clue.id}" data-end="${clue.countdownEndsAt}"><strong>3.0</strong></div>` : ''}</div>
      <div class="stage-status"><i></i>${clue ? (clue.status==='countdown' ? `${escapeHtml(playerById(clue.contactorId)?.name)} called Contact` : 'Clue in play') : last ? `${escapeHtml(last.status)}${last.resultWord ? ' · '+escapeHtml(last.resultWord) : ''}` : 'No active clue'}${clue?.myTarget ? `<span class="private-target">Your target: ${escapeHtml(clue.myTarget)}</span>` : ''}</div>
    </article>
    ${!mine.isMaster ? `<div class="action-deck"><button id="contactAction" class="button blue action-button" ${canContact ? '' : 'disabled'}><span aria-hidden="true">♟♟</span>Contact</button><button id="directAction" class="button glass action-button"><span aria-hidden="true">•••</span>Direct Guess</button><button class="button red action-button" data-skip="${clue?.id || ''}" ${!clue || clue.mySkipVote ? 'disabled' : ''}><span aria-hidden="true">⏩</span>${clue?.authorId === mine.id ? 'Skip Clue' : clue?.mySkipVote ? 'Voted' : 'Skip Vote'}</button></div>` : '<div class="master-banner">♛ &nbsp; Word Master</div>'}
    ${room.clues.length > (clue ? 1 : 0) ? `<details class="clue-history"><summary>Previous clues</summary>${room.clues.filter(c=>c!==clue).slice(0,8).map(c=>`<div><span>${escapeHtml(c.text)}</span><strong>${escapeHtml(c.status)}${c.resultWord ? ' · '+escapeHtml(c.resultWord) : ''}</strong></div>`).join('')}</details>` : ''}`;
  $('#sideTools').innerHTML = `${mine.isMaster ? `<section class="panel tool-panel"><h3><span class="red-icon">♛</span> Word Master tools</h3><div class="master-secret">Your word <strong>${escapeHtml(mine.secretWord)}</strong></div>${clue ? `<form class="block-form" data-block-form="${clue.id}"><label for="blockGuess">Clue word</label><input id="blockGuess" name="guess" maxlength="40" autocomplete="off" placeholder="Enter the clue word" required /><button class="button red" type="submit">⊘ &nbsp; Block Clue</button></form>` : '<p class="micro">Waiting for a clue.</p>'}</section>` : ''}
    ${!mine.isMaster ? `${!clue ? `<section class="panel tool-panel"><h3>✎ &nbsp; Submit a clue</h3><form id="clueForm"><fieldset ${clue ? 'disabled' : ''}><label for="clueText">Public clue</label><textarea id="clueText" maxlength="180" placeholder="Write your clue" required></textarea><label for="clueTarget">Hidden target word</label><input id="clueTarget" maxlength="40" autocomplete="off" placeholder="Starts with ${escapeHtml(room.prefix)}" required /><button class="button blue" type="submit">➤ &nbsp; Submit Clue</button></fieldset></form></section>` : ''}
    ${canContact ? `<section class="panel tool-panel contact-panel"><h3>Contact</h3><form data-contact-form="${clue.id}"><label for="contactGuess">Your target word</label><input id="contactGuess" name="guess" maxlength="40" autocomplete="off" required /><button class="button blue" type="submit">Call Contact</button></form></section>` : ''}
    <section class="panel tool-panel direct-panel ${state.directOpen ? '' : 'hidden'}"><h3>Direct guess</h3><form id="directForm"><label class="sr-only" for="directInput">Full secret word</label><input id="directInput" maxlength="40" autocomplete="off" placeholder="Full secret word" required /><button class="button glass" type="submit">Guess</button></form></section>` : ''}
    ${clue ? `<section class="panel vote-panel"><h3>♟ &nbsp; Skip vote</h3><div class="vote-count"><span>Other players’ votes</span><strong>${clue.skipVotes} / ${clue.skipRequired}</strong></div><progress max="${Math.max(1, clue.skipRequired)}" value="${clue.skipVotes}" aria-label="Skip votes"></progress></section>` : ''}`;
  $('#clueForm')?.addEventListener('submit', event => {
    event.preventDefault();send({type:'add_clue',text:$('#clueText').value,target:$('#clueTarget').value});
    $('#clueTarget').focus();
  });
  $('#directForm')?.addEventListener('submit', event => {event.preventDefault();send({type:'direct_guess',guess:$('#directInput').value});$('#directInput').value='';$('#directInput').focus();});
  $$('[data-contact-form]').forEach(form=>form.addEventListener('submit',event=>{event.preventDefault();send({type:'call_contact',clueId:form.dataset.contactForm,guess:form.elements.guess.value});}));
  $$('[data-block-form]').forEach(form=>form.addEventListener('submit',event=>{event.preventDefault();send({type:'block_clue',clueId:form.dataset.blockForm,guess:form.elements.guess.value});form.elements.guess.value='';form.elements.guess.focus();}));
  $$('[data-skip]').forEach(button=>button.addEventListener('click',()=>send({type:'skip_clue',clueId:button.dataset.skip})));
  $('#contactAction')?.addEventListener('click',()=>$('#contactGuess')?.focus());
  $('#directAction')?.addEventListener('click',()=>{state.directOpen=true;$('.direct-panel').classList.remove('hidden');$('#directInput')?.focus();});
  $('#clueText')?.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    if (!$('#clueTarget').value.trim()) $('#clueTarget').focus();
    else $('#clueForm').requestSubmit();
  });
  updateCountdowns();
}

function updateCountdowns() {
  const now = Date.now() + (state.clockOffset || 0);
  $$('[data-countdown]').forEach(el => {
    $('strong', el).textContent = (Math.max(0, Number(el.dataset.end) - now) / 1000).toFixed(1);
  });
  const clock = $('#roundClock');
  if (clock) {
    const seconds = Math.ceil(Math.max(0, state.room.roundEndsAt - now) / 1000);
    clock.textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
    clock.classList.toggle('urgent', seconds <= 30);
  }
}
setInterval(updateCountdowns, 100);

function renderRoom() {
  if (!state.room) return;
  const scope = state.room.code + ':' + state.room.round + ':' + state.room.phase;
  const changedPhase = state.renderScope !== scope;
  if (changedPhase) state.directOpen = false;
  const values = new Map();
  const key = el => { const clueId = el.closest('form')?.dataset.blockForm || el.closest('form')?.dataset.contactForm; return clueId ? clueId + ':' + el.name : el.id; };
  const focused = document.activeElement;
  const focusKey = focused?.matches('input, textarea, select') ? key(focused) : null;
  const selection = focused?.selectionStart;
  if (state.renderScope === scope) $$('input, textarea, select', roomView).forEach(el => values.set(key(el), el.value));
  state.renderScope = scope;
  roomCode.textContent = state.room.code;
  renderPlayers();
  renderActivity();
  if (state.room.phase === 'playing') renderGame();
  else renderLobby();
  document.body.dataset.phase = state.room.phase;
  $$('input, textarea, select', roomView).forEach(el => {
    if (values.has(key(el))) el.value = values.get(key(el));
    if (values.has(key(el)) && key(el) === focusKey) {
      el.focus();
      if (typeof selection === 'number' && ['text', 'password', 'textarea'].includes(el.type)) el.setSelectionRange(selection, selection);
    }
  });
  bindSetup();
  if (changedPhase) {
    const entry = state.room.phase === 'picking' ? $('#secretInput') : state.room.phase === 'playing' ? $('#clueText') : null;
    entry?.focus({ preventScroll: true });
  }
}

createBtn.addEventListener('click', () => {
  if (!ensureProfile()) return;
  connect(() => send({ type: 'create_room', sessionId: state.sessionId, name: getName(), avatar: state.avatar }));
});

nameInput.addEventListener('keydown', event => {
  if (event.key !== 'Enter' || event.isComposing) return;
  event.preventDefault();
  if (roomInput.value.trim()) joinForm.requestSubmit();
  else createBtn.click();
});

joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!ensureProfile()) return;
  const code = roomInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  if (code.length !== 6) return showToast('Enter the 6-character room code.');
  connect(() => sendJoin(code));
});

roomInput.addEventListener('input', () => {
  roomInput.value = roomInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
});

copyInviteBtn.addEventListener('click', async () => {
  const url = `${location.origin}/game/room/${state.room?.code || state.joinedCode}`;
  try {
    await navigator.clipboard.writeText(url);
    showToast('Invite link copied.');
  } catch {
    showToast(url);
  }
});

leaveBtn.addEventListener('click', () => {
  state.intentionalClose = true;
  state.socket?.close();
  state.room = null;
  document.body.dataset.phase = 'landing';
  $('#sideTools').innerHTML = '';
  $('#headerClock').innerHTML = '';
  state.joinedCode = '';
  history.replaceState({}, '', '/game');
  roomView.classList.add('hidden');
  landingView.classList.remove('hidden');
  setConnection('offline', 'offline');
  setTimeout(() => {
    state.intentionalClose = false;
    connect();
  }, 50);
});

loadProfile();
setupAvatars();

const routeCode = location.pathname.match(/^\/game\/room\/([A-Za-z0-9]{6})\/?$/)?.[1]?.toUpperCase();
if (routeCode) {
  roomInput.value = routeCode;
  const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
  if (profile.name) {
    state.joinedCode = routeCode;
    connect(() => sendJoin(routeCode, true));
  } else {
    showToast('Enter your name, then join the room.');
    connect();
  }
} else connect();
