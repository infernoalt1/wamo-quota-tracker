import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';

export function setupContactGame(app, server, rootDir) {
const wss = new WebSocketServer({ server, path: '/game/ws' });

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
  const allowed = new Set(['orb', 'bolt', 'star', 'moon', 'wave', 'flower', 'diamond', 'cross']);
  return allowed.has(value) ? value : 'orb';
}

function normalizeWord(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z'-]/g, '').slice(0, 40);
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

function currentMaster(room) {
  return getPlayer(room, room.masterId);
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
      winner: room.winner,
      roundMessage: room.roundMessage,
      revealedSecret: room.phase === 'round_end' ? room.secretWord?.toUpperCase() : null,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        connected: p.connected,
        wins: p.wins,
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
        resultWord: ['matched', 'blocked', 'missed'].includes(clue.status) ? clue.target.toUpperCase() : null,
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

function nextConnectedPlayerId(room, afterId) {
  if (!room.players.length) return null;
  const start = Math.max(0, room.players.findIndex((p) => p.id === afterId));
  for (let step = 1; step <= room.players.length; step += 1) {
    const p = room.players[(start + step) % room.players.length];
    if (p.connected) return p.id;
  }
  return null;
}

function clearClueTimers(room) {
  for (const clue of room.clues) {
    if (clue.timer) clearTimeout(clue.timer);
    clue.timer = null;
  }
}

function endRound(room, winner, message) {
  clearClueTimers(room);
  room.phase = 'round_end';
  room.winner = winner;
  room.roundMessage = message;
  if (winner === 'contactors') {
    for (const player of room.players) {
      if (player.id !== room.masterId) player.wins += 1;
    }
  } else if (winner === 'master') {
    const master = currentMaster(room);
    if (master) master.wins += 1;
  }
  pushEvent(room, message, winner === 'contactors' ? 'good' : 'accent');
  broadcast(room);
}

function resolveContact(room, clueId) {
  const clue = room.clues.find((c) => c.id === clueId);
  if (!clue || clue.status !== 'countdown') return;
  clue.timer = null;
  clue.countdownEndsAt = null;

  if (clue.contactGuess === clue.target) {
    clue.status = 'matched';
    room.revealedCount = Math.min(room.secretWord.length, room.revealedCount + 1);
    pushEvent(room, `Contact made on “${clue.target.toUpperCase()}”.`, 'good');
    if (room.revealedCount >= room.secretWord.length) {
      endRound(room, 'contactors', `The word was ${room.secretWord.toUpperCase()}. Contactors take the round.`);
      return;
    }
  } else {
    clue.status = 'missed';
    pushEvent(room, `Contact missed on “${clue.target.toUpperCase()}”.`, 'neutral');
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
    wins: 0,
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
    roundMessage: ''
  };
  rooms.set(code, room);
  ws.roomCode = code;
  ws.sessionId = sessionId;
  pushEvent(room, `${name} opened the room.`);
  send(ws, { type: 'joined', code });
  broadcast(room);
}

function joinRoom(ws, message) {
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
      wins: 0,
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
  if (!player) return sendError(ws, 'You are no longer in this room.');
  fn(room, player);
}

function startRound(ws, message) {
  withRoom(ws, (room, player) => {
    if (player.id !== room.hostId) return sendError(ws, 'Only the room host can start a round.');
    if (room.phase !== 'lobby' && room.phase !== 'round_end') return sendError(ws, 'Finish the current round first.');
    if (connectedPlayers(room).length < 3) return sendError(ws, 'You need at least 3 connected players.');

    let masterId = String(message.masterId || '');
    if (room.phase === 'round_end' && !masterId) masterId = nextConnectedPlayerId(room, room.masterId);
    const master = getPlayer(room, masterId);
    if (!master?.connected) return sendError(ws, 'Choose a connected Word Master.');

    clearClueTimers(room);
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
    if (word.length < 3) return sendError(ws, 'Use a word with at least 3 letters.');
    room.secretWord = word;
    room.revealedCount = 1;
    room.phase = 'playing';
    pushEvent(room, `Round ${room.round} started. The word begins with ${word[0].toUpperCase()}.`, 'accent');
    broadcast(room);
  });
}

function addClue(ws, message) {
  withRoom(ws, (room, player) => {
    if (room.phase !== 'playing') return sendError(ws, 'The round is not active.');
    if (player.id === room.masterId) return sendError(ws, 'The Word Master cannot submit clues.');
    const text = cleanText(message.text);
    const target = normalizeWord(message.target);
    const prefix = room.secretWord.slice(0, room.revealedCount);
    if (text.length < 3) return sendError(ws, 'Give the room a little more of a clue.');
    if (target.length < 2) return sendError(ws, 'Enter the word your clue points to.');
    if (!target.startsWith(prefix)) return sendError(ws, `Your target must start with ${prefix.toUpperCase()}.`);
    if (target === room.secretWord) return sendError(ws, 'Use Direct Guess if you think you know the secret word.');

    room.clues.unshift({
      id: id('c_'),
      authorId: player.id,
      text,
      target,
      status: 'open',
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
    if (!clue || clue.status !== 'countdown' || !clue.countdownEndsAt || Date.now() >= clue.countdownEndsAt) {
      return sendError(ws, 'That contact window has closed.');
    }
    const guess = normalizeWord(message.guess);
    if (!guess) return sendError(ws, 'Type the word you think the clue means.');
    if (guess !== clue.target) {
      send(ws, { type: 'notice', message: 'Not the clue word.' });
      return;
    }
    if (clue.timer) clearTimeout(clue.timer);
    clue.timer = null;
    clue.countdownEndsAt = null;
    clue.status = 'blocked';
    pushEvent(room, `${player.name} blocked “${clue.target.toUpperCase()}”.`, 'accent');
    broadcast(room);
  });
}

function directGuess(ws, message) {
  withRoom(ws, (room, player) => {
    if (room.phase !== 'playing') return sendError(ws, 'The round is not active.');
    if (player.id === room.masterId) return sendError(ws, 'The Word Master already knows the word.');
    const guess = normalizeWord(message.guess);
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
      case 'block_clue': return blockClue(ws, message);
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
      rooms.delete(code);
    }
  }
}, 60_000);
cleanup.unref();


return { wss, rooms };
}
