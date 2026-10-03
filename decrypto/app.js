(() => {
  const $ = s => document.querySelector(s);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const titles = { blue: 'Blue', amber: 'Amber' }, teams = ['blue', 'amber'];
  const app = $('#app');
  let ws, state, session, retry, intentional = false, lastScope = '', drafts = {};
  try { session = JSON.parse(sessionStorage.getItem('decrypto.session')); } catch {}
  function notice(text) { $('#notice').textContent = text; $('#notice').hidden = !text; clearTimeout(notice.timer); if (text) notice.timer = setTimeout(() => { $('#notice').hidden = true; }, 6500); }
  function saveSession(value) { session = value; try { if (value) sessionStorage.setItem('decrypto.session', JSON.stringify(value)); else sessionStorage.removeItem('decrypto.session'); } catch {} }
  function send(action, data = {}) { if (ws?.readyState !== 1) return notice('Reconnecting. Please wait a moment.'); ws.send(JSON.stringify({ action, ...data })); }
  function connect() {
    clearTimeout(retry); intentional = false;
    $('#connection').textContent = 'Connecting…';
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/decrypto/ws`);
    ws.onopen = () => { $('#connection').textContent = '● Connected'; if (session) send('resume', session); render(); };
    ws.onmessage = event => {
      const m = JSON.parse(event.data);
      if (m.type === 'session') { saveSession({ room: m.room, token: m.token }); history.replaceState(null, '', '/decrypto/?room=' + m.room); }
      if (m.type === 'state') { state = m.room; render(); }
      if (m.type === 'error') { notice(m.message); if (m.expired) { saveSession(null); state = null; render(); } }
      if (m.type === 'left' || m.type === 'removed') { saveSession(null); state = null; drafts = {}; history.replaceState(null, '', '/decrypto/'); render(); if (m.type === 'removed') notice('The host removed you from the room.'); }
    };
    ws.onclose = event => {
      $('#connection').textContent = event.code === 4001 ? 'Session open elsewhere' : '○ Reconnecting…';
      if (event.code === 4001) { intentional = true; notice('This session opened in another tab. Use that tab to continue.'); }
      if (!intentional) retry = setTimeout(connect, 1500);
      render();
    };
    ws.onerror = () => {};
  }
  function landing() {
    const room = new URLSearchParams(location.search).get('room') || '';
    return `<section class="landing"><div class="intro"><span class="eyebrow"><span class="live-dot"></span> TWO TEAMS. ONE SHARED FREQUENCY.</span><h1>Keep your friends<br>close.<br><em>Your codes closer.</em></h1><p>A game of clever clues and intercepted secrets.<br>Get your team on the same wavelength—without<br class="desktop"> letting the other side tune in.</p><div class="facts"><span>4–8 players</span><span>15–30 minutes</span><span>Play from anywhere</span></div><div class="preview" aria-hidden="true"><div class="preview-top">INCOMING TRANSMISSION <span>● LIVE</span></div><div class="preview-code"><span>3</span><i>·</i><span>1</span><i>·</i><span>4</span></div><div class="preview-bottom">THREE CLUES. <span>A THOUSAND POSSIBILITIES.</span></div></div></div><div class="entry panel"><span class="eyebrow">WELCOME, CODEBREAKER</span><h2>Find your frequency.</h2><p>Start a room or join your friends.</p><form id="entry-form"><label for="name">Your name</label><input id="name" name="name" maxlength="24" placeholder="What should we call you?" autocomplete="nickname" required><button class="primary wide" name="action" value="create">Create a room <span>↗</span></button><div class="divider"><span>OR JOIN A TRANSMISSION</span></div><label for="room-code">Room code</label><input id="room-code" name="room" maxlength="6" placeholder="ABCDEF" value="${escape(room)}" autocomplete="off" autocapitalize="characters"><button class="secondary wide" name="action" value="join">Join room <span>→</span></button></form><div class="entry-note"><span>◎</span> No account needed. Just bring your people.</div></div></section>`;
  }
  function playerList(team) {
    return state.players.filter(p => p.team === team).map(p => `<div class="player"><span class="avatar ${team || ''}">${escape(p.name.slice(0, 1).toUpperCase())}</span><span class="player-name">${escape(p.name)} ${p.id === state.me ? '<small>(you)</small>' : ''}<small>${p.id === state.host ? 'Host' : state.teams[team]?.encoder === p.id ? 'Encryptor' : ''}${!p.connected ? ' · disconnected' : ''}</small></span>${state.phase === 'lobby' && state.host === state.me && p.id !== state.me ? `<button class="quiet remove" data-remove="${p.id}" aria-label="Remove ${escape(p.name)}">×</button>` : `<span class="presence ${p.connected ? 'online' : ''}"></span>`}</div>`).join('');
  }
  function lobby(me) {
    const ready = teams.every(t => state.players.filter(p => p.team === t && p.connected).length >= 2) && state.players.filter(p => p.team).every(p => p.connected);
    return `<div class="section-heading"><div><span class="eyebrow">THE BRIEFING ROOM</span><h1>Pick a side. Bring a friend.</h1><p>Two to four players on each team. Secret words arrive when the game starts.</p></div></div><div class="team-grid">${teams.map(t => `<section class="panel team-card ${t}"><div class="team-heading"><span class="team-mark">${t === 'blue' ? '◈' : '✳'}</span><div><span class="eyebrow">FREQUENCY ${t === 'blue' ? '01' : '02'}</span><h2>${titles[t]} team</h2></div><span class="count">${state.players.filter(p => p.team === t).length}/4</span></div><div class="roster">${playerList(t) || '<p class="empty">A clean slate. Be the first to join.</p>'}</div><button class="${me.team === t ? 'selected' : 'secondary'} wide" data-team="${t}" ${me.team === t || state.players.filter(p => p.team === t).length >= 4 ? 'disabled' : ''}>${me.team === t ? '✓ Your team' : `Join ${titles[t]} team →`}</button></section>`).join('')}</div><div class="lobby-bottom"><div><strong>${ready ? 'All systems ready.' : 'Waiting for the crew.'}</strong><p>${ready ? 'The host can start whenever everyone is ready.' : 'At least two connected players on each team to start.'}</p></div>${state.host === me.id ? `<button class="primary" data-action="start" ${ready ? '' : 'disabled'}>Start game <span>→</span></button>` : '<span class="pill">Waiting for host</span>'}</div><details class="spectators"><summary>Spectators (${state.players.filter(p => !p.team).length})</summary>${playerList(null)}${me.team ? '<button class="quiet" data-team="spectator">Switch to spectator</button>' : '<p>You’re watching. Join a team to play.</p>'}</details>`;
  }
  const codeText = code => code?.join(' · ') || '—';
  function codeForm(target, own) {
    return `<form id="guess-form" class="action-form"><div class="code-inputs">${[0, 1, 2].map(i => `<label>Clue ${i + 1}<select name="digit${i}" required><option value="">—</option>${[1, 2, 3, 4].map(n => `<option value="${n}">${n}</option>`).join('')}</select></label>`).join('')}</div><button class="primary wide">Lock ${own ? 'decode' : 'interception'} →</button><small>Discuss first. One teammate locks the answer for everyone.</small></form>`;
  }
  function activity(me) {
    const own = state.teams[me.team];
    if (state.phase === 'clues') {
      if (own?.encoder === me.id) return `<span class="eyebrow">YOUR TURN TO ENCRYPT</span><h2>Make yourself understood.</h2><p>Give a clue for each word in this secret code. Only you can see the code.</p><div class="secret-code">${own.code.map(n => `<span>${n}</span>`).join('<i>·</i>')}</div>${own.cluesReady ? '<div class="waiting">✓ Clues locked. Waiting for the other encryptor.</div>' : `<form id="clue-form">${own.code.map((n, i) => `<label for="clue${i}">Clue ${i + 1}<span class="muted"> for ${n} · ${escape(own.words[n - 1])}</span></label><input id="clue${i}" name="clue${i}" maxlength="80" required autocomplete="off" placeholder="A connection only your team will make…">`).join('')}<p class="hint">Use meaning, not spelling. No keywords, translations, or repeated clues.</p><button class="primary wide">Transmit clues →</button></form>`}`;
      return `<span class="eyebrow">COMPOSING TRANSMISSIONS</span><h2>The encryptors are thinking.</h2><p>Each encryptor is writing three clues. Study the history while you wait.</p><div class="waiting-list">${teams.map(t => `<div><span class="dot ${t}"></span><strong>${escape(state.players.find(p => p.id === state.teams[t].encoder)?.name)}</strong><span>${state.teams[t].cluesReady ? '✓ Ready' : 'Writing clues…'}</span></div>`).join('')}</div>`;
    }
    if (state.phase === 'guess') {
      const t = state.teams[state.target], isOwn = me.team === state.target;
      const allowed = me.team && (isOwn ? t.encoder !== me.id : state.round > 1);
      const locked = isOwn ? t.decode : t.intercept;
      return `<span class="eyebrow">${titles[state.target].toUpperCase()} TRANSMISSION / ${isOwn ? 'DECODE' : 'INTERCEPT'}</span><h2>${isOwn ? 'Read between the lines.' : 'Tune into their frequency.'}</h2><div class="clue-list">${(t.clues || []).map((c, i) => `<div><span>0${i + 1}</span><strong>${escape(c)}</strong></div>`).join('')}</div>${allowed && !locked ? codeForm(state.target, isOwn) : `<div class="waiting">${!me.team ? 'You’re spectating this transmission.' : locked ? `✓ Your team locked ${codeText(locked)}. Waiting for the other answer.` : isOwn ? 'Your teammates are decoding. Keep the code to yourself.' : 'No interceptions in round one. Listen and build your notes.'}</div>`}<div class="lock-status"><span>${t.decodeReady ? '✓' : '○'} ${titles[state.target]} decode</span>${state.round > 1 ? `<span>${t.interceptReady ? '✓' : '○'} ${titles[state.target === 'blue' ? 'amber' : 'blue']} interception</span>` : ''}</div>`;
    }
    if (state.phase === 'tiebreak') return `<span class="eyebrow">ONE LAST TRANSMISSION</span><h2>Can you name their secrets?</h2><p>The scores are tied. Guess the other team’s four words in numbered order. Exact matches count.</p>${!me.team || state.tieReady[me.team] ? '<div class="waiting">Waiting for both teams to lock their word guesses.</div>' : `<form id="tie-form">${[0, 1, 2, 3].map(i => `<label for="word${i}">Opponent’s word ${i + 1}</label><input id="word${i}" name="word${i}" maxlength="80" required autocomplete="off">`).join('')}<button class="primary wide">Lock keyword guesses →</button></form>`}`;
    if (state.phase === 'finished') return `<span class="eyebrow">TRANSMISSION COMPLETE</span><h2>${state.winner === 'draw' ? 'A shared victory.' : `${titles[state.winner]} cracked it.`}</h2><p>${escape(state.reason)}</p><div class="result-mark ${state.winner}">✳</div>${state.host === me.id ? '<button class="primary wide" data-action="lobby">Play again · return to lobby →</button>' : '<div class="waiting">Waiting for the host to open the lobby.</div>'}`;
    return `<span class="eyebrow">ROUND ${state.round} COMPLETE</span><h2>Message received.</h2><p>Review the revealed codes below. Next round, a new encryptor takes over on each team.</p>${state.host === me.id ? '<button class="primary" data-action="next">Next round →</button>' : '<div class="waiting">Waiting for the host to start the next round.</div>'}`;
  }
  function notebook() {
    return `<section class="notebook"><div class="section-heading"><div><span class="eyebrow">THE PAPER TRAIL</span><h2>Intelligence log</h2></div><span class="muted">Clues grouped by revealed number</span></div><div class="team-grid">${teams.map(t => `<div class="panel ${t}"><h3>${titles[t]} frequency</h3><div class="word-history">${[1, 2, 3, 4].map(n => `<div><b>${n}</b><span>${state.history.filter(h => h.team === t).flatMap(h => h.code.map((c, i) => c === n ? h.clues[i] : null).filter(Boolean)).map(c => `<span class="clue-chip">${escape(c)}</span>`).join('') || '<span class="muted">No signals yet</span>'}</span></div>`).join('')}</div></div>`).join('')}</div><details class="round-log" ${state.phase === 'round_end' || state.phase === 'finished' ? 'open' : ''}><summary>Round-by-round results (${state.history.length} transmissions)</summary>${state.history.slice().reverse().map(h => `<div class="log-item"><div><span class="dot ${h.team}"></span><strong>Round ${h.round} · ${titles[h.team]}</strong><span class="mono">${codeText(h.code)}</span></div><p>${h.clues.map((c, i) => `${escape(c)} <b>→ ${h.code[i]}</b>`).join(' / ')}</p><small>Decode ${codeText(h.decode)} · ${h.decoded ? 'Correct' : 'Miscommunication +1'}<br>Intercept ${codeText(h.intercept)} · ${h.round === 1 ? 'Not available in round one' : h.intercepted ? 'Interception +1' : 'Missed'}</small></div>`).join('') || '<p>Revealed codes will appear here.</p>'}</details></section>`;
  }
  function playing(me) {
    return `<div class="game-heading"><div><span class="eyebrow">${state.phase === 'finished' ? 'FINAL SCORE' : `ROUND ${state.round} / 8`}</span><h1>${me.team ? `${titles[me.team]} frequency` : 'Eyes on the signals.'}</h1></div><span class="pill">${me.team ? state.teams[me.team].encoder === me.id ? 'You are the encryptor' : 'You are a codebreaker' : 'Spectator'}</span></div><div class="scoreboard">${teams.map(t => `<div class="score ${t}"><strong><span class="dot ${t}"></span>${titles[t]}</strong><span><b>${state.teams[t].interceptions}</b>/2 intercepts</span><span><b>${state.teams[t].misses}</b>/2 misses</span></div>`).join('')}</div>${state.players.some(p => p.team && !p.connected) ? '<div class="disconnect-note">A teammate is disconnected. Their seat and secrets are saved for reconnection. If they cannot return, the host can reset to the lobby.</div>' : ''}${(me.team ? [me.team] : []).concat(state.phase === 'finished' ? teams.filter(t => t !== me.team) : []).map(t => `<section class="secrets ${t}"><div class="secret-label"><span class="eyebrow">${state.phase === 'finished' ? titles[t].toUpperCase() + ' KEYWORDS' : 'YOUR TEAM’S EYES ONLY'}</span><span>${state.phase === 'finished' ? 'Secrets revealed' : 'Fixed for the entire game'}</span></div><div class="word-grid">${state.teams[t].words.map((w, i) => `<div><span>0${i + 1}</span><strong>${escape(w)}</strong></div>`).join('')}</div></section>`).join('')}<div class="play-grid"><section class="panel activity">${activity(me)}</section><aside class="panel crew"><span class="eyebrow">ON THE LINE</span>${teams.map(t => `<h3 class="${t}-text">${titles[t]} team</h3>${playerList(t)}`).join('')}</aside></div>${notebook()}`;
  }
  function chat(me) {
    return `<section class="panel chat"><div class="section-heading"><div><span class="eyebrow">KEEP IN TOUCH</span><h2>Room & team chat</h2></div></div><div id="messages" class="messages" aria-live="polite">${state.chat.map(c => `<div><span class="chat-channel ${c.channel}">${c.channel === 'room' ? 'Room' : 'Team'}</span><strong>${escape(c.name)}</strong><span>${escape(c.text)}</span></div>`).join('') || '<p class="muted">Say hello. Use team chat to discuss your guesses privately.</p>'}</div><form id="chat-form"><label class="sr-only" for="channel">Chat channel</label><select id="channel" name="channel"><option value="room">Room</option>${me.team ? '<option value="team">Team only</option>' : ''}</select><label class="sr-only" for="message">Message</label><input id="message" name="message" maxlength="300" required placeholder="Write a message…" autocomplete="off"><button class="secondary">Send ↑</button></form><small>Encryptors stay silent until their own code is revealed.</small></section>`;
  }
  function render() {
    const active = document.activeElement, activeName = active?.name;
    const selection = active?.tagName === 'INPUT' ? [active.selectionStart, active.selectionEnd] : null;
    app.querySelectorAll('input,select').forEach(el => { if (el.name) drafts[el.name] = el.value; });
    const scope = state ? `${state.code}:${state.phase}:${state.round}:${state.target}:${state.players.find(p => p.id === state.me)?.team}` : 'entry';
    if (scope !== lastScope) { drafts = Object.fromEntries(Object.entries(drafts).filter(([key]) => ['name', 'room', 'message', 'channel'].includes(key))); lastScope = scope; }
    if (!state) app.innerHTML = landing();
    else {
      const me = state.players.find(p => p.id === state.me);
      app.innerHTML = `<div class="room-toolbar"><div><span class="eyebrow">ROOM</span><button id="invite" class="room-code" title="Copy invitation link">${state.code} <span>⧉</span></button></div><div><button class="quiet" id="copy-link">Invite friends ↗</button>${state.host === me.id && state.phase !== 'lobby' && state.phase !== 'finished' ? '<button class="quiet" id="reset">Return to lobby</button>' : ''}<button class="quiet" id="leave">Leave room</button></div></div>${state.phase === 'lobby' ? lobby(me) : playing(me)}${chat(me)}`;
    }
    app.querySelectorAll('input,select').forEach(el => { if (Object.hasOwn(drafts, el.name)) el.value = drafts[el.name]; });
    if (activeName) { const el = app.querySelector(`[name="${activeName}"]`); if (el) { el.focus({ preventScroll: true }); if (selection && el.tagName === 'INPUT') try { el.setSelectionRange(...selection); } catch {} } }
    if ($('#messages')) $('#messages').scrollTop = $('#messages').scrollHeight;
    if (ws?.readyState !== 1) app.querySelectorAll('button,input,select').forEach(el => { el.disabled = true; });
  }
  app.addEventListener('submit', event => {
    event.preventDefault(); const f = event.target, data = new FormData(f);
    if (f.id === 'entry-form') { const action = event.submitter?.value || 'create'; if (action === 'join' && !String(data.get('room')).trim()) return notice('Enter your six-character room code.'); send(action, { name: data.get('name'), room: data.get('room') }); }
    if (f.id === 'clue-form') send('clues', { clues: [0, 1, 2].map(i => data.get('clue' + i)) });
    if (f.id === 'guess-form') { const code = [0, 1, 2].map(i => Number(data.get('digit' + i))); if (new Set(code).size !== 3) return notice('Use three different digits.'); send('guess', { code, round: state.round, target: state.target }); }
    if (f.id === 'tie-form') send('tiebreak', { words: [0, 1, 2, 3].map(i => data.get('word' + i)) });
    if (f.id === 'chat-form') { send('chat', { channel: data.get('channel'), text: data.get('message') }); f.elements.message.value = ''; drafts.message = ''; }
  });
  app.addEventListener('click', async event => {
    const b = event.target.closest('button'); if (!b) return;
    if (b.dataset.team) send('team', { team: b.dataset.team === 'spectator' ? null : b.dataset.team });
    if (b.dataset.action) send(b.dataset.action);
    if (b.dataset.remove && confirm('Remove this player from the lobby?')) send('remove', { player: b.dataset.remove });
    if (b.id === 'reset' && confirm('End this game and return everyone to the lobby? The next game will use new secret words.')) send('lobby');
    if (b.id === 'leave' && (state.phase === 'lobby' || state.phase === 'finished' || confirm('Leave this game? Your seat will be marked disconnected. The host can return everyone to the lobby to regroup.'))) send('leave');
    if (b.id === 'copy-link' || b.id === 'invite') { const link = `${location.origin}/decrypto/?room=${state.code}`; try { await navigator.clipboard.writeText(link); notice('Invitation link copied. Send it to your friends.'); } catch { prompt('Copy this invitation link:', link); } }
  });
  $('#rules-open').onclick = () => $('#rules').showModal();
  $('#rules-close').onclick = () => $('#rules').close();
  render(); connect();
})();
