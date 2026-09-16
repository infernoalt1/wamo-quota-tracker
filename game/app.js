const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const AVATARS = ['orb', 'bolt', 'star', 'moon', 'wave', 'flower', 'diamond', 'cross'];
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
    button.setAttribute('aria-label', avatar);
    button.innerHTML = '<span></span>';
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
  playerCount.textContent = `${room.players.filter((p) => p.connected).length} / 10`;
  playerList.innerHTML = room.players.map((p) => {
    const role = p.isMaster ? 'Word Master' : (p.isHost ? 'Host' : 'Contactor');
    return `<div class="player ${p.connected ? '' : 'offline'}">
      <span class="player-mark" data-avatar="${escapeHtml(p.avatar)}"></span>
      <div class="player-name">${escapeHtml(p.name)}<small>${p.connected ? role : 'offline'}</small></div>

    </div>`;
  }).join('');
}

function renderActivity() {
  const events = state.room.events || [];
  activityList.innerHTML = events.length ? events.map((event) => `<div class="activity ${escapeHtml(event.tone || '')}">
    ${escapeHtml(event.text)}<time>${escapeHtml(formatTime(event.at))}</time>
  </div>`).join('') : '<div class="empty-state">Nothing yet.</div>';
}

function renderLobby() {
  const room = state.room;
  gameCard.classList.add('hidden');
  lobbyCard.classList.remove('hidden');

  if (room.phase === 'lobby' || room.phase === 'round_end') {
    const finished = room.phase === 'round_end';
    const options = room.players.filter(p => p.connected).map(p => '<option value="' + p.id + '">' + escapeHtml(p.name) + '</option>').join('');
    lobbyCard.innerHTML = `<p class="eyebrow">${finished ? 'Round ' + room.round + ' complete' : 'Lobby'}</p>
      <h3>${finished ? (room.winner === 'master' ? 'Word Master wins!' : 'Contactors win!') : 'Round setup'}</h3>
      ${finished ? '<div class="secret-reveal">' + escapeHtml(room.revealedSecret) + '</div>' : ''}
      ${me().isHost ? `<form id="roundForm" class="master-picker">
        <label for="masterSelect">Word Master</label>
        <select id="masterSelect" required><option value="">Choose a player</option>${options}</select>
        <label for="roundMinutes">Time limit · minutes</label>
        <input id="roundMinutes" type="number" min="1" max="60" step="1" required value="${room.roundMinutes || 5}" />
        <button class="button primary big" type="submit" ${room.players.filter(p => p.connected).length < 3 ? 'disabled' : ''}>${finished ? 'Start next round' : 'Start round'}</button>
        ${room.players.filter(p => p.connected).length < 3 ? '<p class="micro">Waiting for at least 3 players.</p>' : ''}
      </form>` : '<p>Waiting for the host to choose the Word Master.</p>'}`;
    $('#roundForm')?.addEventListener('submit', event => {
      event.preventDefault();
      send({ type: 'start_round', masterId: $('#masterSelect').value, roundMinutes: Number($('#roundMinutes').value) });
    });
    return;
  }

  if (room.phase === 'picking') {
    const master = playerById(room.masterId);
    if (me().isMaster) {
      lobbyCard.innerHTML = `<p class="eyebrow">Round ${room.round}</p>
        <h3>Choose the secret word.</h3>
        <p>Only you will see it. Everyone else starts with the first letter.</p>
        <form id="secretForm" class="inline-form">
          <input id="secretInput" type="password" maxlength="40" autocomplete="off" placeholder="secret word" autofocus />
          <button class="button primary" type="submit">Lock it in</button>
        </form>`;
      $('#secretForm').addEventListener('submit', (event) => {
        event.preventDefault();
        send({ type: 'set_secret', word: $('#secretInput').value });
      });
      setTimeout(() => $('#secretInput')?.focus(), 30);
    } else {
      lobbyCard.innerHTML = `<p class="eyebrow">Round ${room.round}</p>
        <h3>${escapeHtml(master?.name || 'The Word Master')} is choosing.</h3>
        <p>They’re picking a secret word. You’ll only get the first letter once the round starts.</p>`;
    }
    return;
  }

}

function renderWordProgress() {
  const prefix = state.room.prefix || '';
  const letters = [...prefix].map((char) => `<span class="word-letter revealed">${escapeHtml(char)}</span>`);
  letters.push('<span class="word-letter unknown">?</span>');
  return letters.join('');
}

function clueStatusLabel(clue) {
  return ({ open: 'open', countdown: 'contact called', matched: 'matched', blocked: 'blocked', missed: 'missed' })[clue.status] || clue.status;
}

function renderClue(clue) {
  const author = playerById(clue.authorId);
  const contactor = playerById(clue.contactorId);
  const mine = me();
  const canContact = !mine.isMaster && clue.authorId !== mine.id && clue.status === 'open';
  const isMaster = mine.isMaster;

  let actions = '';
  if (canContact) {
    actions = `<form class="contact-row" data-contact-form="${clue.id}">
      <input name="guess" maxlength="40" autocomplete="off" placeholder="Your word…" aria-label="Your target word" />
      <button class="button dark" type="submit">Contact</button>
    </form>`;
  }

  if (clue.status === 'countdown') {
    actions = `<div class="countdown" data-countdown="${clue.id}" data-end="${clue.countdownEndsAt}">
      <span>${escapeHtml(contactor?.name || 'Someone')} called Contact</span>
      <strong>3.0</strong>
    </div>`;
  }
  if (isMaster && ['open', 'countdown'].includes(clue.status)) {
    actions += `<form class="block-form" data-block-form="${clue.id}">
      <input name="guess" maxlength="40" autocomplete="off" placeholder="Clue word" aria-label="Block guess" />
      <button class="button primary" type="submit">Block</button>
    </form>`;
  }
  if (!isMaster && ['open', 'countdown'].includes(clue.status)) {
    actions += `<button class="button ghost skip-button" data-skip="${clue.id}" ${clue.mySkipVote ? 'disabled' : ''}>${clue.mySkipVote ? 'Voted to skip' : 'Skip clue'} · ${clue.skipVotes}/${clue.skipRequired}</button>`;
  }

  let result = '';
  if (['matched', 'blocked', 'missed'].includes(clue.status)) {
    result = `<span class="result-badge ${clue.status}">${clue.status === 'matched' ? 'Contact made' : clue.status === 'blocked' ? 'Blocked' : 'No match'} · ${escapeHtml(clue.resultWord || '')}</span>`;
  }

  const privateBits = [
    clue.myTarget ? `your target: ${clue.myTarget}` : '',
    clue.myContactGuess ? `your guess: ${clue.myContactGuess}` : ''
  ].filter(Boolean).join(' · ');

  return `<article class="clue">
    <div class="clue-head">
      <span class="clue-author">${escapeHtml(author?.name || 'Player')}</span>
      <span class="clue-status">${escapeHtml(clueStatusLabel(clue))}</span>
    </div>
    <p class="clue-text">${escapeHtml(clue.text)}</p>
    ${privateBits ? `<div class="clue-meta">${escapeHtml(privateBits)}</div>` : ''}
    ${actions}
    ${result}
  </article>`;
}

function renderGame() {
  const room = state.room;
  lobbyCard.classList.add('hidden');
  gameCard.classList.remove('hidden');

  const master = playerById(room.masterId);
  const mine = me();
  const activeClue = room.clues.some(c => ['open', 'countdown'].includes(c.status));
  const composer = (mine.isMaster || activeClue) ? `<div class="composer">
      <div class="composer-label">${mine.isMaster ? 'Word Master' : 'Clue in play'}</div>
      <p class="micro">${mine.isMaster ? 'Block the active clue with its word at any time.' : 'Resolve or vote to skip the current clue.'}</p>
    </div>` : `<div class="composer">
      <div class="composer-label">Post a clue</div>
      <form id="clueForm" class="composer-grid">
        <textarea id="clueText" maxlength="180" placeholder="Your clue" aria-label="Clue"></textarea>
        <input id="clueTarget" maxlength="40" autocomplete="off" placeholder="hidden word" aria-label="Hidden target word" />
        <button class="button primary" type="submit">Post clue</button>
      </form>
      <p class="micro">Your hidden word must start with <strong>${escapeHtml(room.prefix)}</strong>.</p>
    </div>`;

  gameCard.innerHTML = `<div class="round-card">
    <div class="round-top">
      <div class="round-kicker"><span>Round ${room.round}</span><span>Master · ${escapeHtml(master?.name || '')}</span></div>
      <div class="round-clock" id="roundClock" aria-label="Time remaining"></div><div class="word-progress">${renderWordProgress()}</div>
      ${mine.isMaster ? `<div class="master-secret">Your word: <strong>${escapeHtml(mine.secretWord || '')}</strong></div>` : ''}
      ${!mine.isMaster ? `<div class="game-actions"><form id="directForm" class="inline-form"><input id="directInput" maxlength="40" autocomplete="off" placeholder="full word" aria-label="Direct guess" /><button class="button ghost" type="submit">Direct guess</button></form></div>` : ''}
    </div>
    ${composer}
    <div class="clues">${room.clues.length ? room.clues.map(renderClue).join('') : '<div class="empty-state">No active clue</div>'}</div>
  </div>`;

  $('#clueForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    send({ type: 'add_clue', text: $('#clueText').value, target: $('#clueTarget').value });
    $('#clueText').value = '';
    $('#clueTarget').value = '';
    $('#clueText').focus();
  });

  $('#directForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    send({ type: 'direct_guess', guess: $('#directInput').value });
    $('#directInput').value = '';
  });

  $$('[data-contact-form]').forEach((form) => form.addEventListener('submit', (event) => {
    event.preventDefault();
    send({ type: 'call_contact', clueId: form.dataset.contactForm, guess: form.elements.guess.value });
  }));

  $$('[data-block-form]').forEach((form) => form.addEventListener('submit', (event) => {
    event.preventDefault();
    send({ type: 'block_clue', clueId: form.dataset.blockForm, guess: form.elements.guess.value });
    form.elements.guess.value = '';
  }));

  $$('[data-skip]').forEach(button => button.addEventListener('click', () => send({ type: 'skip_clue', clueId: button.dataset.skip })));
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
  const values = new Map();
  const key = el => el.id || (el.closest('form')?.dataset.blockForm || el.closest('form')?.dataset.contactForm || '') + ':' + el.name;
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
  $$('input, textarea, select', roomView).forEach(el => {
    if (values.has(key(el))) el.value = values.get(key(el));
    if (values.has(key(el)) && key(el) === focusKey) {
      el.focus();
      if (typeof selection === 'number' && ['text', 'password', 'textarea'].includes(el.type)) el.setSelectionRange(selection, selection);
    }
  });
}

createBtn.addEventListener('click', () => {
  if (!ensureProfile()) return;
  connect(() => send({ type: 'create_room', sessionId: state.sessionId, name: getName(), avatar: state.avatar }));
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
connect();

const routeCode = location.pathname.match(/^\/game\/room\/([A-Za-z0-9]{6})\/?$/)?.[1]?.toUpperCase();
if (routeCode) {
  roomInput.value = routeCode;
  const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
  if (profile.name) {
    state.joinedCode = routeCode;
    connect(() => sendJoin(routeCode, true));
  } else {
    showToast('Enter your name, then join the room.');
  }
}
