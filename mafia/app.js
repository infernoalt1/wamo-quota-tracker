(() => {
  const $ = s => document.querySelector(s);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ROLE = {
    mafia: { name: 'Mafia', team: 'mafia', teamName: 'Mafia', about: 'You work with the other Mafia to take over the town while pretending to be innocent.', win: 'Win when living Mafia equal or outnumber everyone else alive.', ability: 'Each night, vote with your team on one non-Mafia player to kill. You can also chat with your team at night.' },
    doctor: { name: 'Doctor', team: 'town', teamName: 'Town', about: 'You keep the town alive, one patient at a time.', win: 'Win when all Mafia are dead.', ability: 'Each night, protect one living player from the Mafia. You can pick yourself, but never the same player two nights running. You aren’t told if it worked.' },
    detective: { name: 'Detective', team: 'town', teamName: 'Town', about: 'You search for the Mafia. Share what you find carefully, as nobody has to believe you.', win: 'Win when all Mafia are dead.', ability: 'Each night, investigate another living player and privately learn if they are Mafia.' },
    villager: { name: 'Villager', team: 'town', teamName: 'Town', about: 'You have no ability. Listen closely, and vote well.', win: 'Win when all Mafia are dead.', ability: 'None. You sleep through the night.' },
    jester: { name: 'Jester', team: 'neutral', teamName: 'Neutral', about: 'You are on nobody’s side. Look suspicious enough to get voted out.', win: 'Win alone by being voted out by day. Dying at night or surviving to the end is a loss.', ability: 'None. The Detective sees you as Not Mafia.' },
  };
  const TIMERS = [['night', 'Night', 10, 180], ['dayAnnouncement', 'Morning', 3, 30], ['discussion', 'Discussion', 15, 600], ['voting', 'Voting', 10, 180], ['elimination', 'Result', 3, 30]];
  const PHASE_LABEL = { lobby: 'Lobby', roleReveal: 'Roles dealt', night: 'Night', dayAnnouncement: 'Morning', discussion: 'Day', voting: 'Voting', elimination: 'Result', gameOver: 'Game over' };
  const CHANNEL_LABEL = { public: 'Town', mafia: 'Mafia', dead: 'Dead' };
  const SESSION_KEY = 'mafia.session', REJOIN_KEY = 'mafia.rejoin';
  let ws, state, session, retry, intentional = false, serverOffset = 0, voteChoice = null, voteSeq = -1, lastSeq = -1, tab = 'public', pendingChat = null, chatSignature = '', screen = null, audio, enterPressed = false;
  const store = {
    read(area, key) { try { return JSON.parse(window[area].getItem(key)); } catch { return null; } },
    write(area, key, value) { try { if (value === null) window[area].removeItem(key); else window[area].setItem(key, JSON.stringify(value)); } catch {} },
  };
  session = store.read('sessionStorage', SESSION_KEY);
  // An invite to a different room wins over this tab's old seat, which stays available from the rejoin button.
  const invited = new URLSearchParams(location.search).get('room')?.toUpperCase();
  if (session && invited && invited !== session.room) session = null;
  const prefs = { name: '', sounds: true, ...(store.read('localStorage', 'mafia.prefs') || {}) };
  const savePrefs = () => store.write('localStorage', 'mafia.prefs', prefs);

  function notice(text) { $('#notice').textContent = text; $('#notice').hidden = !text; clearTimeout(notice.timer); if (text) notice.timer = setTimeout(() => { $('#notice').hidden = true; }, 6000); }
  function saveSession(value) { session = value; store.write('sessionStorage', SESSION_KEY, value); }
  function send(action, data = {}) { if (ws?.readyState !== 1) return notice('Reconnecting. Please wait a moment.'); ws.send(JSON.stringify({ action, ...data })); }
  function connect() {
    clearTimeout(retry); intentional = false;
    $('#connection').textContent = 'Connecting…';
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/mafia/ws`);
    ws.onopen = () => { $('#connection').textContent = ''; if (session) send('resume', session); };
    ws.onmessage = event => {
      const m = JSON.parse(event.data);
      if (m.type === 'session') {
        saveSession({ room: m.room, token: m.token });
        store.write('localStorage', REJOIN_KEY, { room: m.room, token: m.token, name: m.name });
        history.replaceState(null, '', '/mafia/?room=' + m.room);
      }
      if (m.type === 'state') { state = m.room; serverOffset = (state.serverNow || Date.now()) - Date.now(); pendingChat = null; render(); }
      if (m.type === 'error') {
        notice(m.message);
        // Only give a refused message back if it would still go to the channel it was written for.
        if (pendingChat?.channel === tab && !$('#chat-input').value) $('#chat-input').value = pendingChat.text;
        pendingChat = null;
        if (m.expired) { const rejoin = store.read('localStorage', REJOIN_KEY); if (rejoin?.token === session?.token || !session) store.write('localStorage', REJOIN_KEY, null); saveSession(null); state = null; render(); }
      }
      if (m.type === 'left' || m.type === 'removed') {
        if (m.final || m.type === 'removed') store.write('localStorage', REJOIN_KEY, null);
        saveSession(null); state = null; history.replaceState(null, '', '/mafia/'); render();
        if (m.type === 'removed') notice('The host removed you from the room.');
      }
    };
    ws.onclose = event => {
      $('#connection').textContent = event.code === 4001 ? 'Open in another tab' : 'Reconnecting…';
      if (event.code === 4001) { intentional = true; notice('This seat opened in another tab. Use that tab to continue.'); }
      if (!intentional) retry = setTimeout(connect, 1500);
    };
    ws.onerror = () => {};
  }

  const me = () => state.players.find(p => p.id === state.me);
  const player = id => state.players.find(p => p.id === id);
  const seated = () => state.players.filter(p => !p.spectator);
  const isHost = () => state.host === state.me;
  const inMatch = () => state && state.phase !== 'lobby' && state.phase !== 'gameOver';
  const tag = role => `<span class="tag ${ROLE[role].team}">${ROLE[role].name}</span>`;

  function menu() {
    const code = new URLSearchParams(location.search).get('room') || '', rejoin = store.read('localStorage', REJOIN_KEY);
    return `<div class="menu-copy"><h1>Trust nobody.</h1><p>By night, the Mafia strikes. By day, the town votes on who to blame. A game of lies for 6–15 players, each on their own device.</p></div>
    <form class="panel entry" id="entry-form" autocomplete="off">
      ${rejoin ? `<div class="rejoin"><span>Back to room <b>${escape(rejoin.room)}</b> as ${escape(rejoin.name)}?</span><button type="button" class="primary" id="rejoin">Rejoin</button></div>` : ''}
      <label class="field">Your name<input id="name" maxlength="20" placeholder="What should we call you?" value="${escape(prefs.name)}" autocomplete="nickname"></label>
      <button class="primary wide" name="action" value="create">Create game</button>
      <div class="divider"><span>or join with a code</span></div>
      <label class="field">Room code<input id="room-code" maxlength="6" placeholder="ABCDEF" value="${escape(code.toUpperCase())}" autocapitalize="characters"></label>
      <button class="secondary wide" name="action" value="join">Join game</button>
    </form>`;
  }

  function seatRow(p) {
    const removable = state.phase === 'lobby' && isHost() && p.id !== state.me;
    const over = state.phase === 'gameOver', won = over && state.result.winners.includes(p.id);
    const notes = [];
    if (p.id === state.host) notes.push('Host');
    if (!p.connected) notes.push('Offline');
    const status = state.phase === 'lobby' ? (p.id === state.host ? '' : p.ready ? '<span class="ready" title="Ready">✓ Ready</span>' : '<span class="waiting">Not ready</span>') : '';
    return `<div class="seat ${p.alive || state.phase === 'lobby' ? '' : 'dead'} ${p.id === state.me ? 'self' : ''} ${p.connected ? '' : 'offline'}">
      <span class="seat-name"><span class="name-text">${escape(p.name)}</span>${p.id === state.me ? ' <small>(you)</small>' : ''}${notes.length ? ` <small>${notes.join(' · ')}</small>` : ''}</span>
      ${p.role ? tag(p.role) : ''}${state.phase !== 'lobby' && !p.alive ? '<span class="rip">Dead</span>' : ''}${over && won ? '<span class="won">Won</span>' : ''}${status}
      ${removable ? `<button class="quiet remove" data-remove="${escape(p.id)}" aria-label="Remove ${escape(p.name)}">✕</button>` : ''}
    </div>`;
  }

  function renderSeats() {
    const players = seated(), watching = state.players.filter(p => p.spectator);
    const alive = players.filter(p => p.alive).length;
    $('#seats-title').textContent = state.phase === 'lobby' ? `Players ${players.length}/${state.settings.maxPlayers}` : state.phase === 'gameOver' ? 'Final roles' : `Alive ${alive}/${players.length}`;
    $('#seats').innerHTML = players.map(seatRow).join('') + (watching.length ? `<p class="watching">Watching: ${watching.map(p => escape(p.name)).join(', ')}</p>` : '');
  }

  function stepper(key, label, value, min, max, editable) {
    return `<div class="stepper"><span>${label}</span><div><button type="button" class="quiet" data-step="${key}" data-delta="-1" ${!editable || value <= min ? 'disabled' : ''} aria-label="Fewer: ${label}">−</button><b>${value}</b><button type="button" class="quiet" data-step="${key}" data-delta="1" ${!editable || value >= max ? 'disabled' : ''} aria-label="More: ${label}">+</button></div></div>`;
  }

  function lobby() {
    const s = state.settings, host = isHost(), you = me(), r = s.roles, c = state.counts;
    const off = host ? '' : 'disabled';
    const toggle = (role, label) => `<label class="check"><input type="checkbox" data-role="${role}" ${r[role] ? 'checked' : ''} ${off}> ${label}</label>`;
    return `<div class="stage-head"><div><span class="eyebrow">Invite your friends</span><h1 class="code">${escape(state.code)}</h1></div><button class="secondary" id="copy-link">Copy invite link</button></div>
    <div class="lobby-settings">
      <section class="setting-block"><h3>Table</h3>
        ${stepper('maxPlayers', 'Player count', s.maxPlayers, Math.max(3, seated().length), 15, host)}
        <label class="check"><input type="checkbox" id="reveal" ${s.reveal ? 'checked' : ''} ${off}> Reveal a player’s role when they die</label>
      </section>
      <section class="setting-block"><h3>Roles</h3>
        <div class="segmented" role="group" aria-label="Role distribution"><button type="button" data-mode="auto" aria-pressed="${r.mode === 'auto'}" ${off}>Recommended</button><button type="button" data-mode="custom" aria-pressed="${r.mode === 'custom'}" ${off}>Custom</button></div>
        <div class="checks">${toggle('doctor', 'Doctor')}${toggle('detective', 'Detective')}${toggle('jester', 'Jester')}</div>
        ${r.mode === 'custom' ? `<div class="steppers">${stepper('mafia', 'Mafia', r.mafia, 1, 15, host)}${stepper('villager', 'Villagers', r.villager, 0, 15, host)}</div>` : ''}
        <p class="deal">Deals: ${c.mafia} Mafia${c.doctor ? ', 1 Doctor' : ''}${c.detective ? ', 1 Detective' : ''}${c.jester ? ', 1 Jester' : ''}, ${c.villager} Villager${c.villager === 1 ? '' : 's'}</p>
      </section>
      <section class="setting-block timers"><h3>Timers (seconds)</h3><div class="timer-row">${TIMERS.map(([key, label, min, max]) => `<label>${label}<input type="number" id="timer-${key}" data-timer="${key}" min="${min}" max="${max}" value="${s.timers[key]}" ${off}></label>`).join('')}</div></section>
    </div>
    <div class="stage-foot"><p class="hint">${escape(state.startProblem || 'Everyone is ready.')}</p>
      ${you.spectator ? '<span class="pill">Watching. A seat opens when someone leaves.</span>' : host ? `<button class="primary" data-action="start" ${state.startProblem ? 'disabled' : ''}>Start game</button>` : `<button class="${you.ready ? 'secondary' : 'primary'}" id="ready">${you.ready ? 'Not ready' : 'I’m ready'}</button>`}
    </div>`;
  }

  function teammates() {
    return state.players.filter(p => p.role === 'mafia' && p.id !== state.me);
  }

  function roleBody() {
    const you = me();
    if (!you.role) return '<p>You are watching this match.</p>';
    const info = ROLE[you.role];
    return `<div class="role-card ${info.team}"><span class="eyebrow">${info.teamName}</span><h1>${info.name}</h1><p>${info.about}</p><dl><dt>To win</dt><dd>${info.win}</dd><dt>Ability</dt><dd>${info.ability}</dd>${you.role === 'mafia' ? `<dt>Your team</dt><dd>${teammates().map(p => escape(p.name)).join(', ') || 'You work alone.'}</dd>` : ''}</dl></div>`;
  }

  function fallen() {
    const you = me();
    if (you.spectator) return '<p class="fallen">You are watching this match.</p>';
    if (you.alive || !you.role) return '';
    if (state.result?.jester === you.id) return `<div class="fallen jester"><b>You won!</b> The town voted you out, just as you wanted. Keep watching and chat with the dead.</div>`;
    return `<div class="fallen"><b>You have been eliminated.</b> You were ${you.role === 'mafia' ? 'in the Mafia' : `the ${ROLE[you.role].name}`}. You can watch the rest of the match and talk in dead chat.</div>`;
  }

  function targetButton(id, chosen, extra = '') {
    const p = player(id);
    return `<button type="button" class="target ${chosen ? 'chosen' : ''}" data-target="${escape(id)}" aria-pressed="${chosen}"><span class="target-name">${escape(p.name)}</span>${extra}</button>`;
  }

  function investigations() {
    if (!state.investigations?.length) return '';
    return `<div class="results"><h3>Your investigations</h3><ul>${state.investigations.map(r => `<li class="${r.isMafia ? 'is-mafia' : ''}"><span>Night ${r.round}</span> ${escape(r.text)}</li>`).join('')}</ul></div>`;
  }

  function night() {
    const n = state.night, head = `<div class="stage-head"><div><span class="eyebrow">Night ${state.round}</span><h1>${n?.action === 'kill' ? 'Choose your target' : n?.action === 'protect' ? 'Who will you protect?' : n?.action === 'investigate' ? 'Who will you investigate?' : 'The town is asleep'}</h1></div></div>`;
    if (!n) {
      const you = me(), waiting = you.alive && !you.spectator ? '<p class="big-note">Nothing to do tonight. Sit tight and try to remember what you heard today.</p>' : '<p class="big-note">Roles are choosing their targets in secret.</p>';
      return `${head}${fallen()}${waiting}`;
    }
    if (n.action === 'kill') {
      const voters = id => n.team.filter(t => t.choice === id).map(t => escape(t.name)).join(', ');
      const leaderIsMe = n.leader === state.me, leaderName = player(n.leader)?.name;
      const line = n.tied.length ? (leaderIsMe ? 'Votes are tied. As leader, your vote decides: pick one of the tied players.' : `Votes are tied. ${escape(leaderName)}’s vote decides.`) : n.planned ? `The team will attack ${escape(player(n.planned).name)}.` : 'No target yet. If nobody votes, there is no kill.';
      return `${head}<div class="target-grid">${n.targets.map(id => targetButton(id, n.choice === id, voters(id) ? `<small>${voters(id)}</small>` : '')).join('')}</div><p class="action-note">${line} ${leaderIsMe ? '' : `<span class="muted">Leader: ${escape(leaderName)}.</span>`}</p>`;
    }
    const blocked = n.blocked ? `<p class="action-note muted">You protected ${escape(player(n.blocked)?.name)} last night, so you can’t pick them again.</p>` : '';
    return `${head}<div class="target-grid">${n.targets.map(id => targetButton(id, n.choice === id)).join('')}</div>${blocked}<p class="action-note">${n.choice ? `Chosen: ${escape(player(n.choice).name)}. You can change this until time runs out.` : 'Pick a player. If you don’t, nothing happens tonight.'}</p>${investigations()}`;
  }

  function discussion() {
    const alive = seated().filter(p => p.alive).length;
    return `<div class="stage-head"><div><span class="eyebrow">Day ${state.round}</span><h1>Talk it out</h1></div></div>${fallen()}<p class="announcement">${escape(state.announcement?.text)}</p><p class="action-note">${alive} players remain. Accuse, defend, or claim a role in the chat. Voting opens when the timer ends.</p>${investigations()}`;
  }

  function voting() {
    const v = state.vote;
    if (!v) return `<div class="stage-head"><div><span class="eyebrow">Day ${state.round}</span><h1>The town is voting</h1></div></div>${fallen()}<p class="big-note">Votes are revealed when the timer ends.</p>`;
    if (voteSeq !== state.seq) { voteSeq = state.seq; voteChoice = null; }
    const current = v.choice === 'abstain' ? 'You abstained.' : v.choice ? `Your vote: ${escape(player(v.choice)?.name)}.` : 'You haven’t voted yet.';
    const pick = voteChoice ?? (v.choice === 'abstain' ? null : v.choice);
    return `<div class="stage-head"><div><span class="eyebrow">Day ${state.round}</span><h1>Who should go?</h1></div></div><div class="target-grid">${v.targets.map(id => targetButton(id, pick === id)).join('')}</div>
    <div class="vote-actions"><button class="primary" id="submit-vote" ${!pick || pick === v.choice ? 'disabled' : ''}>Submit vote</button><button class="secondary" id="abstain" ${v.choice === 'abstain' ? 'disabled' : ''}>Abstain</button><span class="action-note">${current} You can change it until time runs out.</span></div>`;
  }

  function voteTable() {
    const v = state.lastVote;
    if (!v) return '';
    const top = v.tallies[0]?.count || 1;
    const rows = v.tallies.map(t => `<li><span class="bar-name">${escape(t.name)}</span><span class="bar"><i style="width:${Math.round(t.count / top * 100)}%"></i></span><b>${t.count}</b><small>${t.voters.map(escape).join(', ')}</small></li>`).join('');
    const extra = [v.abstained.length ? `Abstained: ${v.abstained.map(escape).join(', ')}` : '', v.noVote.length ? `No vote: ${v.noVote.map(escape).join(', ')}` : ''].filter(Boolean).join(' · ');
    return `<div class="vote-table"><h3>Final votes</h3><ul>${rows || '<li class="muted">No votes were cast.</li>'}</ul>${extra ? `<p class="muted">${extra}</p>` : ''}</div>`;
  }

  function gameOver() {
    const r = state.result, you = me(), winName = r.winner === 'town' ? 'Town wins!' : 'Mafia wins!';
    const jester = r.jester ? `<p class="jester-win">${escape(player(r.jester)?.name)} also won as the Jester.</p>` : '';
    const personal = you.spectator ? '' : `<p class="personal">${r.winners.includes(you.id) ? 'You won.' : 'You lost.'}</p>`;
    return `<div class="victory ${r.winner}"><span class="eyebrow">Game over</span><h1>${winName}</h1>${jester}${personal}</div>
    <div class="history"><h3>Match history</h3><ol>${state.log.map(e => `<li class="${e.kind}"><span>${e.round ? e.round : ''}</span>${escape(e.text)}</li>`).join('')}</ol></div>
    <div class="stage-foot"><p class="hint">${isHost() ? 'Everyone goes back to the lobby.' : 'Waiting for the host to start another game.'}</p>${isHost() ? '<button class="primary" data-action="lobby">Play again</button>' : ''}</div>`;
  }

  function stage() {
    switch (state.phase) {
      case 'lobby': return lobby();
      case 'roleReveal': return me().role ? roleBody() : `<p class="big-note">Roles have been dealt. You’re watching this match.</p>`;
      case 'night': return night();
      case 'dayAnnouncement': return `<div class="center-stage">${fallen()}<span class="eyebrow">Day ${state.round}</span><p class="announcement big">${escape(state.announcement?.text)}</p></div>`;
      case 'discussion': return discussion();
      case 'voting': return voting();
      case 'elimination': return `<div class="stage-head"><div><span class="eyebrow">Day ${state.round}</span><h1>The votes are in</h1></div></div>${fallen()}<p class="announcement">${escape(state.announcement?.text)}</p>${voteTable()}`;
      case 'gameOver': return gameOver();
      default: return '';
    }
  }

  // Redrawing replaces the stage, so an input being edited keeps its value, cursor, and focus.
  function renderStage() {
    const active = document.activeElement, id = active?.id && $('#stage').contains(active) ? active.id : null;
    const value = id ? active.value : null;
    $('#stage').innerHTML = stage();
    if (id) { const again = document.getElementById(id); if (again) { if (value !== null && again.type === 'number') again.value = value; again.focus(); } }
  }

  function chatPlaceholder() {
    if (state.chatChannel === tab) return tab === 'mafia' ? 'Only the Mafia can read this. Press Enter to send.' : tab === 'dead' ? 'Only the dead can read this. Press Enter to send.' : 'Press Enter to send.';
    if (state.chatChannel) return `You can only write in ${CHANNEL_LABEL[state.chatChannel]} chat right now.`;
    if (me().spectator) return 'Spectators can’t chat during a match.';
    return state.phase === 'night' ? 'Chat is closed at night.' : 'Chat is closed right now.';
  }

  function renderChat() {
    const tabs = Object.keys(state.chat);
    if (!tabs.includes(tab)) tab = 'public';
    $('#chat-tabs').innerHTML = tabs.map(t => `<button type="button" role="tab" data-tab="${t}" aria-selected="${t === tab}" class="${t}">${CHANNEL_LABEL[t]}</button>`).join('');
    const log = $('#chat-log'), messages = state.chat[tab] || [];
    const signature = tab + '|' + messages.length + '|' + (messages[messages.length - 1]?.at ?? '');
    if (signature !== chatSignature) {
      const pinned = log.scrollHeight - log.scrollTop - log.clientHeight < 40 || chatSignature.split('|')[0] !== tab;
      chatSignature = signature;
      log.innerHTML = messages.length ? messages.map(m => m.system ? `<p class="msg system">${escape(m.text)}</p>` : `<p class="msg ${m.from === state.me ? 'mine' : ''}"><b>${escape(m.name)}</b> ${escape(m.text)}</p>`).join('') : `<p class="msg empty">${tab === 'public' ? 'No messages yet.' : 'Nothing here yet.'}</p>`;
      if (pinned) log.scrollTop = log.scrollHeight;
    }
    const open = state.chatChannel === tab, input = $('#chat-input');
    input.disabled = !open; $('#chat-send').disabled = !open;
    input.placeholder = chatPlaceholder();
    $('#chat-form').dataset.channel = tab;
  }

  function renderStatus() {
    $('#status').innerHTML = `<span class="phase-label">${PHASE_LABEL[state.phase]}${state.round && inMatch() && state.phase !== 'roleReveal' ? ' ' + state.round : ''}</span><span id="timer" class="timer"></span>`;
    countdown();
  }

  function countdown() {
    const el = $('#timer');
    if (!el || !state) return;
    if (!state.deadline) { el.textContent = ''; return; }
    const seconds = Math.max(0, Math.ceil((state.deadline - Date.now() - serverOffset) / 1000));
    el.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    el.classList.toggle('urgent', seconds <= 10 && state.phase !== 'dayAnnouncement' && state.phase !== 'elimination' && state.phase !== 'roleReveal');
  }
  setInterval(countdown, 200);

  function chime(phase) {
    if (!prefs.sounds) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state !== 'running') return;
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.frequency.value = phase === 'night' ? 196 : phase === 'voting' ? 523 : 392;
      gain.gain.setValueAtTime(0.08, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.5);
      osc.connect(gain).connect(audio.destination);
      osc.start(); osc.stop(audio.currentTime + 0.5);
    } catch {}
  }

  function render() {
    const next = state ? 'table' : 'menu';
    $('#menu').hidden = next !== 'menu'; $('#table').hidden = next !== 'table';
    document.body.dataset.phase = state ? state.phase : 'menu';
    $('#leave').hidden = !state; $('#role-open').hidden = !state?.players.find(p => p.id === state.me)?.role;
    if (!state) {
      $('#status').innerHTML = '';
      if (screen !== 'menu') $('#menu').innerHTML = menu();
      screen = 'menu'; chatSignature = '';
      return;
    }
    screen = 'table';
    if (state.seq !== lastSeq) {
      if (lastSeq !== -1) chime(state.phase);
      lastSeq = state.seq;
      if (state.chatChannel && state.chatChannel !== tab) {
        // A half-typed private message must not stay in the box once Enter would post it somewhere else.
        if (tab !== 'public') $('#chat-input').value = '';
        tab = state.chatChannel;
      }
    }
    renderStatus(); renderSeats(); renderStage(); renderChat();
  }

  document.addEventListener('keydown', event => { enterPressed = event.key === 'Enter' && event.target.tagName === 'INPUT'; });
  document.addEventListener('submit', event => {
    event.preventDefault();
    if (event.target.id === 'chat-form') {
      const input = $('#chat-input'), text = input.value.trim();
      if (!text || input.disabled) return;
      pendingChat = { channel: event.target.dataset.channel, text: input.value };
      send('chat', { channel: event.target.dataset.channel, text });
      input.value = '';
      input.focus();
      return;
    }
    if (event.target.id === 'entry-form') {
      const name = $('#name').value.trim(), room = $('#room-code').value.trim().toUpperCase();
      // Browsers report Enter as a click on the first button (Create), so a typed code has to decide what Enter means.
      const action = enterPressed || !event.submitter ? (room ? 'join' : 'create') : event.submitter.value;
      enterPressed = false;
      if (!name) { notice('Enter your name first.'); $('#name').focus(); return; }
      if (action === 'join' && !room) { notice('Enter a room code to join.'); $('#room-code').focus(); return; }
      prefs.name = name; savePrefs();
      send(action, action === 'join' ? { name, room } : { name });
    }
  });

  document.addEventListener('click', event => {
    if (audio?.state === 'suspended') audio.resume();
    else if (!audio && prefs.sounds) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch {} }
    const el = event.target.closest('button, [data-tab]');
    if (!el) return;
    if (el.dataset.close !== undefined) { el.closest('dialog').close(); return; }
    if (el.id === 'rejoin') { const rejoin = store.read('localStorage', REJOIN_KEY); if (rejoin) { saveSession({ room: rejoin.room, token: rejoin.token }); send('resume', session); } return; }
    if (!state) return;
    if (el.dataset.tab) { tab = el.dataset.tab; renderChat(); if (!$('#chat-input').disabled) $('#chat-input').focus(); return; }
    if (el.dataset.remove) { send('remove', { player: el.dataset.remove }); return; }
    if (el.dataset.action) { send(el.dataset.action); return; }
    if (el.dataset.target) {
      if (state.phase === 'voting') { voteChoice = el.dataset.target; renderStage(); return; }
      if (state.night) send('target', { seq: state.seq, target: state.night.choice === el.dataset.target ? null : el.dataset.target });
      return;
    }
    if (el.id === 'submit-vote' && voteChoice) { send('vote', { seq: state.seq, target: voteChoice }); return; }
    if (el.id === 'abstain') { voteChoice = null; send('vote', { seq: state.seq, target: 'abstain' }); return; }
    if (el.id === 'ready') { send('ready', { ready: !me().ready }); return; }
    if (el.id === 'copy-link') {
      const link = `${location.origin}/mafia/?room=${state.code}`;
      navigator.clipboard?.writeText(link).then(() => notice('Invite link copied.'), () => notice(link)) ?? notice(link);
      return;
    }
    if (el.dataset.step) {
      const value = (el.dataset.step === 'maxPlayers' ? state.settings.maxPlayers : state.settings.roles[el.dataset.step]) + Number(el.dataset.delta);
      send('settings', { patch: el.dataset.step === 'maxPlayers' ? { maxPlayers: value } : { roles: { [el.dataset.step]: value } } });
      return;
    }
    if (el.dataset.mode) send('settings', { patch: { roles: { mode: el.dataset.mode } } });
  });

  document.addEventListener('change', event => {
    const el = event.target;
    if (!state || !$('#stage').contains(el)) return;
    if (el.id === 'reveal') send('settings', { patch: { reveal: el.checked } });
    if (el.dataset.role) send('settings', { patch: { roles: { [el.dataset.role]: el.checked } } });
    if (el.dataset.timer) send('settings', { patch: { timers: { [el.dataset.timer]: Number(el.value) } } });
  });

  // A rejected timer would otherwise keep showing the refused number once it loses focus.
  document.addEventListener('focusout', event => { if (event.target.dataset?.timer && state?.phase === 'lobby') setTimeout(() => { if (!$('#stage').contains(document.activeElement) || document.activeElement.tagName !== 'INPUT') renderStage(); }, 300); });

  function openDialog(id) {
    const dialog = $('#' + id);
    if (id === 'settings') { $('#default-name').value = prefs.name; $('#sounds').checked = prefs.sounds; }
    if (id === 'role-card') $('#role-body').innerHTML = roleBody();
    if (!dialog.open) dialog.showModal();
  }
  $('#rules-open').onclick = () => openDialog('rules');
  $('#settings-open').onclick = () => openDialog('settings');
  $('#role-open').onclick = () => openDialog('role-card');
  $('#default-name').oninput = event => { prefs.name = event.target.value.trim(); savePrefs(); const name = $('#name'); if (name && !name.value) name.value = prefs.name; };
  $('#sounds').onchange = event => { prefs.sounds = event.target.checked; savePrefs(); };
  $('#leave').onclick = () => {
    if (inMatch() && !me()?.spectator && !confirm('Leave this match? Your role stays in the game, and you can rejoin from the main menu.')) return;
    send('leave');
  };

  render();
  connect();
})();
