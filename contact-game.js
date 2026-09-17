import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';

export function setupContactGame(app, server, rootDir) {
const wss = new WebSocketServer({ server, path: '/game/ws', maxPayload: 8192 });

const MAX_PLAYERS = 10;
const ROOM_TTL_MS = 30 * 60 * 1000;
const DISCONNECTED_TTL_MS = 10 * 60 * 1000;
const CONTACT_MS = 3000;
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const rooms = new Map();

app.use('/game', express.static(path.join(rootDir, 'game'), { extensions: ['html'] }));
app.get('/game/room/:code', (_req, res) => res.sendFile(path.join(rootDir, 'game', 'index.html')));

function makeRoomCode() {
  for (let tries = 0; tries < 50; tries += 1) {
    let code = '';
    for (let i = 0; i < 6; i += 1) code += ROOM_ALPHABET[crypto.randomInt(ROOM_ALPHABET.length)];
    if (!rooms.has(code)) return code;
  }
  throw new Error('Could not generate a room code');
}

function cleanName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 24);
}

function cleanAvatar(value) {
  const allowed = new Set(['orb', 'bolt', 'star', 'moon', 'wave', 'flower', 'diamond', 'cross', 'bear', 'tiger', 'lion', 'rabbit', 'owl', 'penguin', 'unicorn', 'dragon', 'turtle', 'whale', 'dog', 'raccoon']);
  return allowed.has(value) ? value : 'orb';
}

function normalizeWord(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z'-]/g, '');
}

function cleanText(value, max = 180) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function id(prefix = '') {
  return prefix + crypto.randomUUID().replaceAll('-', '').slice(0, 12);
}

function touch(room) {
  room.updatedAt = Date.now();
}

function connectedPlayers(room) {
  return room.players.filter((p) => p.connected);
}

function getPlayer(room, sessionId) {
  return room.players.find((p) => p.id === sessionId);
}

function pushEvent(room, text, tone = 'neutral') {
  room.events.unshift({ id: id('e_'), text, tone, at: Date.now() });
  room.events = room.events.slice(0, 40);
}

function publicState(room, viewerId) {
  const viewer = getPlayer(room, viewerId);
  const isMaster = room.masterId === viewerId;
  return {
    type: 'state',
    serverNow: Date.now(),
    room: {
      code: room.code,
      phase: room.phase,
      round: room.round,
      hostId: room.hostId,
      masterId: room.masterId,
      prefix: room.secretWord ? room.secretWord.slice(0, room.revealedCount).toUpperCase() : '',
      roundMinutes: room.roundMinutes,
      maxWordLength: room.maxWordLength,
      chat: room.chat,
      roundEndsAt: room.roundEndsAt,
      winner: room.winner,
      roundMessage: room.roundMessage,
      revealedSecret: room.phase === 'round_end' ? room.secretWord?.toUpperCase() : null,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        connected: p.connected,
        isHost: p.id === room.hostId,
        isMaster: p.id === room.masterId
      })),
      clues: room.clues.map((clue) => ({
        id: clue.id,
        authorId: clue.authorId,
        text: clue.text,
        status: clue.status,
        contactorId: clue.contactorId,
        countdownEndsAt: clue.countdownEndsAt,
        skipVotes: eligibleVoters(room, clue).filter(p => clue.skipVotes.has(p.id)).length,
        skipRequired: Math.max(1, Math.ceil(eligibleVoters(room, clue).length / 2)),
        mySkipVote: clue.skipVotes.has(viewerId),
        resultWord: ['matched', 'blocked', 'missed'].includes(clue.status) ? clue.target.toUpperCase() : null,
        resultGuess: ['matched', 'missed'].includes(clue.status) ? clue.contactGuess.toUpperCase() : null,
        myTarget: clue.authorId === viewerId ? clue.target.toUpperCase() : null,
        myContactGuess: clue.contactorId === viewerId ? clue.contactGuess?.toUpperCase() : null
      })),
      events: room.events,
      my: viewer ? {
        id: viewer.id,
        name: viewer.name,
        avatar: viewer.avatar,
        isHost: viewer.id === room.hostId,
        isMaster,
        secretWord: isMaster && room.secretWord ? room.secretWord.toUpperCase() : null
      } : null
    }
  };
}

function send(ws, payload) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function sendError(ws, message) {
  send(ws, { type: 'error', message });
}

function broadcast(room) {
  touch(room);
  for (const player of room.players) {
    if (player.ws?.readyState === WebSocket.OPEN) send(player.ws, publicState(room, player.id));
  }
}

function clearClueTimers(room) {
  for (const clue of room.clues) {
    if (clue.timer) clearTimeout(clue.timer);
    clue.timer = null;
  }
}

function endRound(room, winner, message) {
  if (room.phase !== 'playing') return;
  clearClueTimers(room);
  clearTimeout(room.roundTimer);
  room.roundTimer = null;
  room.roundEndsAt = null;
  for (const clue of room.clues) {
    if (['open', 'countdown'].includes(clue.status)) clue.status = 'cancelled';
    clue.countdownEndsAt = null;
  }
  room.phase = 'round_end';
  room.winner = winner;
  room.roundMessage = message;
  pushEvent(room, message, winner === 'contactors' ? 'good' : 'accent');
  broadcast(room);
}

function resolveContact(room, clueId) {
  const clue = room.clues.find((c) => c.id === clueId);
  if (room.phase !== 'playing' || expireRound(room) || !clue || clue.status !== 'countdown') return;
  clue.timer = null;
  clue.countdownEndsAt = null;

  if (clue.contactGuess === clue.target) {
    clue.status = 'matched';
    if (clue.target === room.secretWord) {
      endRound(room, 'contactors', 'Contact on the secret word. Contactors win.');
      return;
    }
    room.revealedCount = Math.min(room.secretWord.length, room.revealedCount + 1);
    pushEvent(room, `Contact made on “${clue.target.toUpperCase()}”.`, 'good');
    if (room.revealedCount >= room.secretWord.length) {
      endRound(room, 'contactors', `The word was ${room.secretWord.toUpperCase()}. Contactors take the round.`);
      return;
    }
  } else {
    clue.status = 'missed';
    pushEvent(room, 'No match — clue removed.', 'neutral');
  }
  broadcast(room);
}

function validateSessionId(value) {
  return /^[a-zA-Z0-9_-]{8,80}$/.test(String(value || ''));
}

function attachPlayer(ws, room, player) {
  if (player.ws && player.ws !== ws && player.ws.readyState === WebSocket.OPEN) {
    try { player.ws.close(4001, 'Reconnected elsewhere'); } catch {}
  }
  ws.roomCode = room.code;
  ws.sessionId = player.id;
  player.ws = ws;
  player.connected = true;
  player.lastSeen = Date.now();
}

function createRoom(ws, message) {
  if (ws.roomCode) return sendError(ws, 'Leave your current room first.');
  const sessionId = String(message.sessionId || '');
  const name = cleanName(message.name);
  if (!validateSessionId(sessionId)) return sendError(ws, 'Refresh the page and try again.');
  if (!name) return sendError(ws, 'Enter a name first.');

  const code = makeRoomCode();
  const player = {
    id: sessionId,
    name,
    avatar: cleanAvatar(message.avatar),
    connected: true,
    lastSeen: Date.now(),
    ws
  };
  const room = {
    code,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    phase: 'lobby',
    round: 0,
    hostId: sessionId,
    masterId: null,
    secretWord: '',
    revealedCount: 0,
    players: [player],
    clues: [],
    events: [],
    winner: null,
    roundMessage: '',
    roundMinutes: 5,
    maxWordLength: null,
    chat: [],
    roundEndsAt: null,
    roundTimer: null
  };
  rooms.set(code, room);
  ws.roomCode = code;
  ws.sessionId = sessionId;
  pushEvent(room, `${name} opened the room.`);
  send(ws, { type: 'joined', code });
  broadcast(room);
}

function joinRoom(ws, message) {
  if (ws.roomCode) return sendError(ws, 'Leave your current room first.');
  const sessionId = String(message.sessionId || '');
  const code = String(message.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  const name = cleanName(message.name);
  if (!validateSessionId(sessionId)) return sendError(ws, 'Refresh the page and try again.');
  if (!name) return sendError(ws, 'Enter a name first.');
  const room = rooms.get(code);
  if (!room) return sendError(ws, 'Room not found. It may have expired.');

  let player = getPlayer(room, sessionId);
  if (!player) {
    if (room.players.length >= MAX_PLAYERS) return sendError(ws, 'That room is full.');
    player = {
      id: sessionId,
      name,
      avatar: cleanAvatar(message.avatar),
      connected: true,
      lastSeen: Date.now(),
        ws
    };
    room.players.push(player);
    pushEvent(room, `${name} joined the room.`);
  } else {
    player.name = name;
    player.avatar = cleanAvatar(message.avatar);
    pushEvent(room, `${name} reconnected.`);
  }
  attachPlayer(ws, room, player);
  send(ws, { type: 'joined', code });
  broadcast(room);
}

function withRoom(ws, fn) {
  const room = rooms.get(ws.roomCode);
  if (!room) return sendError(ws, 'That room no longer exists.');
  const player = getPlayer(room, ws.sessionId);
  if (!player || player.ws !== ws) return sendError(ws, 'You are no longer in this room.');
  if (expireRound(room)) return sendError(ws, 'Time is up.');
  fn(room, player);
}

function startRound(ws, message) {
  withRoom(ws, (room, player) => {
    if (player.id !== room.hostId) return sendError(ws, 'Only the room host can start a round.');
    if (room.phase !== 'lobby' && room.phase !== 'round_end') return sendError(ws, 'Finish the current round first.');
    if (connectedPlayers(room).length < 3) return sendError(ws, 'You need at least 3 connected players.');

    const masterId = String(message.masterId || '');
    const minutes = Number(message.roundMinutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60) return sendError(ws, 'Choose a time limit from 1 to 60 minutes.');
    const maxWordLength = message.maxWordLength == null || message.maxWordLength === '' ? null : Number(message.maxWordLength);
    if (maxWordLength !== null && (!Number.isInteger(maxWordLength) || maxWordLength < 3 || maxWordLength > 40)) return sendError(ws, 'Choose a word limit from 3 to 40, or leave it blank.');
    const master = getPlayer(room, masterId);
    if (!master?.connected) return sendError(ws, 'Choose a connected Word Master.');

    clearClueTimers(room);
    room.roundMinutes = minutes;
    room.maxWordLength = maxWordLength;
    room.roundEndsAt = null;
    room.round += 1;
    room.phase = 'picking';
    room.masterId = master.id;
    room.secretWord = '';
    room.revealedCount = 0;
    room.clues = [];
    room.winner = null;
    room.roundMessage = '';
    pushEvent(room, `${master.name} is the Word Master for round ${room.round}.`, 'accent');
    broadcast(room);
  });
}

function setSecret(ws, message) {
  withRoom(ws, (room, player) => {
    if (room.phase !== 'picking' || player.id !== room.masterId) return sendError(ws, 'You are not choosing the word right now.');
    const word = normalizeWord(message.word);
    if (word.length > (room.maxWordLength || 40)) return sendError(ws, 'Words must be at most ' + (room.maxWordLength || 40) + ' characters.');
    if (word.length < 3) return sendError(ws, 'Use a word with at least 3 letters.');
    room.secretWord = word;
    room.revealedCount = 1;
    room.phase = 'playing';
    room.roundEndsAt = Date.now() + room.roundMinutes * 60_000;
    room.roundTimer = setTimeout(() => expireRound(room), room.roundMinutes * 60_000);
    room.roundTimer.unref?.();
    pushEvent(room, `Round ${room.round} started. The word begins with ${word[0].toUpperCase()}.`, 'accent');
    broadcast(room);
  });
}

function addClue(ws, message) {
  withRoom(ws, (room, player) => {
    if (room.phase !== 'playing') return sendError(ws, 'The round is not active.');
    if (player.id === room.masterId) return sendError(ws, 'The Word Master cannot submit clues.');
    if (room.clues.some(c => ['open', 'countdown'].includes(c.status))) return sendError(ws, 'Resolve or skip the current clue first.');
    const text = cleanText(message.text);
    const target = normalizeWord(message.target);
    if (target.length > (room.maxWordLength || 40)) return sendError(ws, 'Words must be at most ' + (room.maxWordLength || 40) + ' characters.');
    const prefix = room.secretWord.slice(0, room.revealedCount);
    if (text.length < 3) return sendError(ws, 'Give the room a little more of a clue.');
    if (target.length < 2) return sendError(ws, 'Enter the word your clue points to.');
    if (!target.startsWith(prefix)) return sendError(ws, `Your target must start with ${prefix.toUpperCase()}.`);

    room.clues.unshift({
      id: id('c_'),
      authorId: player.id,
      text,
      target,
      status: 'open',
      skipVotes: new Set(),
      contactorId: null,
      contactGuess: '',
      countdownEndsAt: null,
      createdAt: Date.now(),
      timer: null
    });
    pushEvent(room, `${player.name} posted a clue.`);
    broadcast(room);
  });
}

function callContact(ws, message) {
  withRoom(ws, (room, player) => {
    if (room.phase !== 'playing') return sendError(ws, 'The round is not active.');
    if (player.id === room.masterId) return sendError(ws, 'The Word Master cannot call Contact.');
    const clue = room.clues.find((c) => c.id === message.clueId);
    if (!clue || clue.status !== 'open') return sendError(ws, 'That clue is no longer open.');
    if (clue.authorId === player.id) return sendError(ws, 'Someone else has to contact your clue.');
    const guess = normalizeWord(message.guess);
    if (guess.length > (room.maxWordLength || 40)) return sendError(ws, 'Words must be at most ' + (room.maxWordLength || 40) + ' characters.');
    if (!guess) return sendError(ws, 'Enter your target word before calling Contact.');
    const prefix = room.secretWord.slice(0, room.revealedCount);
    if (!guess.startsWith(prefix)) return sendError(ws, `Your guess must start with ${prefix.toUpperCase()}.`);

    clue.status = 'countdown';
    clue.contactorId = player.id;
    clue.contactGuess = guess;
    clue.countdownEndsAt = Date.now() + CONTACT_MS;
    clue.timer = setTimeout(() => resolveContact(room, clue.id), CONTACT_MS + 40);
    pushEvent(room, `${player.name} called Contact.`, 'accent');
    broadcast(room);
  });
}

function blockClue(ws, message) {
  withRoom(ws, (room, player) => {
    if (room.phase !== 'playing' || player.id !== room.masterId) return sendError(ws, 'Only the Word Master can block.');
    const clue = room.clues.find((c) => c.id === message.clueId);
    if (!clue || !['open', 'countdown'].includes(clue.status)) return sendError(ws, 'That clue is no longer active.');
    if (clue.status === 'countdown' && Date.now() >= clue.countdownEndsAt) {
      resolveContact(room, clue.id);
      return sendError(ws, 'That contact has resolved.');
    }
    const guess = normalizeWord(message.guess);
    if (guess.length > (room.maxWordLength || 40)) return sendError(ws, 'Words must be at most ' + (room.maxWordLength || 40) + ' characters.');
    if (!guess) return sendError(ws, 'Type the word you think the clue means.');
    if (guess !== clue.target) {
      send(ws, { type: 'notice', message: 'Not the clue word.' });
      return;
    }
    if (clue.timer) clearTimeout(clue.timer);
    clue.timer = null;
    clue.countdownEndsAt = null;
    clue.status = 'blocked';
    if (clue.target === room.secretWord) {
      endRound(room, 'contactors', 'The clue named the secret word. Contactors win.');
      return;
    }
    pushEvent(room, `${player.name} blocked “${clue.target.toUpperCase()}”.`, 'accent');
    broadcast(room);
  });
}

function directGuess(ws, message) {
  withRoom(ws, (room, player) => {
    if (room.phase !== 'playing') return sendError(ws, 'The round is not active.');
    if (player.id === room.masterId) return sendError(ws, 'The Word Master already knows the word.');
    const guess = normalizeWord(message.guess);
    if (guess.length > (room.maxWordLength || 40)) return sendError(ws, 'Words must be at most ' + (room.maxWordLength || 40) + ' characters.');
    if (!guess) return sendError(ws, 'Enter your full-word guess.');
    if (guess === room.secretWord) {
      pushEvent(room, `${player.name} guessed the secret word.`, 'good');
      endRound(room, 'contactors', `${player.name} guessed ${room.secretWord.toUpperCase()}. Contactors take the round.`);
      return;
    }
    pushEvent(room, `${player.name} made a wrong direct guess.`, 'neutral');
    send(ws, { type: 'notice', message: 'Wrong direct guess.' });
    broadcast(room);
  });
}

function expireRound(room) {
  if (room.phase !== 'playing' || Date.now() < room.roundEndsAt) return false;
  endRound(room, 'master', 'Time is up. Word Master wins.');
  return true;
}

function eligibleVoters(room, clue) {
  return connectedPlayers(room).filter(p => p.id !== room.masterId && p.id !== clue?.authorId);
}

function checkSkip(room) {
  if (room.phase !== 'playing' || expireRound(room)) return;

  const clue = room.clues.find(c =>
    ['open', 'countdown'].includes(c.status)
  );
  if (!clue) return;

  if (
    clue.status === 'countdown' &&
    Date.now() >= clue.countdownEndsAt
  ) {
    resolveContact(room, clue.id);
    return;
  }

  const voters = eligibleVoters(room, clue);
  const votes = voters.filter(p => clue.skipVotes.has(p.id)).length;
  const required = Math.max(1, Math.ceil(voters.length / 2));
  if (votes < required) return;

  clearTimeout(clue.timer);
  clue.timer = null;
  clue.countdownEndsAt = null;
  clue.status = 'skipped';
  pushEvent(room, 'Clue skipped by majority vote.');
}

function skipClue(ws, message) {
  withRoom(ws, (room, player) => {
    if (room.phase !== 'playing' || player.id === room.masterId) return sendError(ws, 'Only contactors can vote to skip.');
    const clue = room.clues.find(c => c.id === message.clueId);
    if (!clue || !['open', 'countdown'].includes(clue.status)) return sendError(ws, 'That clue is no longer active.');
    if (clue.status === 'countdown' && Date.now() >= clue.countdownEndsAt) {
      resolveContact(room, clue.id);
      return sendError(ws, 'That contact has resolved.');
    }
    if (clue.authorId === player.id) {
      clearTimeout(clue.timer);
      clue.timer = null;
      clue.countdownEndsAt = null;
      clue.status = 'skipped';
      pushEvent(room, `${player.name} skipped their clue.`);
      return broadcast(room);
    }
    clue.skipVotes.add(player.id);
    checkSkip(room);
    broadcast(room);
  });
}

function sendChat(ws, message) {
  withRoom(ws, (room, player) => {
    const text = cleanText(message.text, 300);
    if (!text) return sendError(ws, 'Enter a message.');
    if (player.lastChatAt && Date.now() - player.lastChatAt < 750) return sendError(ws, 'Please wait a moment between messages.');
    player.lastChatAt = Date.now();
    room.chat.push({ id: id('m_'), playerId: player.id, name: player.name, avatar: player.avatar, text, at: Date.now() });
    room.chat = room.chat.slice(-100);
    broadcast(room);
  });
}

function transferHostIfNeeded(room) {
  const host = getPlayer(room, room.hostId);
  if (host?.connected) return;
  const next = connectedPlayers(room)[0];
  if (next) {
    room.hostId = next.id;
    pushEvent(room, `${next.name} is now the room host.`);
  }
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return sendError(ws, 'Invalid message.'); }
    if (!message || typeof message.type !== 'string') return sendError(ws, 'Invalid message.');

    switch (message.type) {
      case 'create_room': return createRoom(ws, message);
      case 'join_room': return joinRoom(ws, message);
      case 'start_round': return startRound(ws, message);
      case 'set_secret': return setSecret(ws, message);
      case 'add_clue': return addClue(ws, message);
      case 'call_contact': return callContact(ws, message);
      case 'skip_clue': return skipClue(ws, message);
      case 'block_clue': return blockClue(ws, message);
      case 'chat': return sendChat(ws, message);
      case 'direct_guess': return directGuess(ws, message);
      default: return sendError(ws, 'Unknown action.');
    }
  });

  ws.on('close', () => {
    const room = rooms.get(ws.roomCode);
    const player = room && getPlayer(room, ws.sessionId);
    if (!room || !player || player.ws !== ws) return;
    player.connected = false;
    player.lastSeen = Date.now();
    player.ws = null;
    pushEvent(room, `${player.name} disconnected.`);

    if (room.masterId === player.id && room.phase === 'picking') {
      room.phase = 'lobby';
      room.masterId = null;
      pushEvent(room, 'Word Master selection reset because they disconnected.');
    }
    transferHostIfNeeded(room);
    checkSkip(room);
    broadcast(room);
  });
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30_000);
heartbeat.unref();

const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    room.players = room.players.filter((p) => p.connected || now - p.lastSeen < DISCONNECTED_TTL_MS);
    transferHostIfNeeded(room);
    if (!room.players.length || (connectedPlayers(room).length === 0 && now - room.updatedAt > ROOM_TTL_MS)) {
      clearClueTimers(room);
      clearTimeout(room.roundTimer);
      rooms.delete(code);
    }
  }
}, 60_000);
cleanup.unref();


function dispose() {
  clearInterval(heartbeat);
  clearInterval(cleanup);
  for (const room of rooms.values()) {
    clearClueTimers(room);
    clearTimeout(room.roundTimer);
  }
  for (const ws of wss.clients) ws.terminate();
  wss.close();
}
server.once('close', dispose);
return { wss, rooms, dispose };
}