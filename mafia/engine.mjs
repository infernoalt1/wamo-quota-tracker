import { randomInt, randomUUID } from 'node:crypto';

export const ROLES = ['mafia', 'doctor', 'detective', 'jester', 'villager'];
export const ALIGNMENT = { mafia: 'mafia', doctor: 'town', detective: 'town', villager: 'town', jester: 'neutral' };
export const MIN_PLAYERS = 3, MAX_PLAYERS = 15, MAX_MEMBERS = 40;
const ROLE_NAMES = { mafia: 'Mafia', doctor: 'Doctor', detective: 'Detective', jester: 'Jester', villager: 'Villager' };
const ROLE_REVEAL_SECONDS = 8;
const MAFIA_BY_COUNT = { 3: 1, 4: 1, 5: 1, 6: 1, 7: 2, 8: 2, 9: 2, 10: 2, 11: 2, 12: 3, 13: 3, 14: 3, 15: 4 };
const TIMER_LIMITS = { night: [10, 180], dayAnnouncement: [3, 30], discussion: [15, 600], voting: [10, 180], elimination: [3, 30] };
const CHAT_LIMIT = 300;

// The match lifecycle. Every phase change goes through enter(), which refuses anything not listed here.
const TRANSITIONS = {
  lobby: ['roleReveal'],
  roleReveal: ['night'],
  night: ['dayAnnouncement', 'gameOver'],
  dayAnnouncement: ['discussion'],
  discussion: ['voting'],
  voting: ['elimination', 'gameOver'],
  elimination: ['night'],
  gameOver: ['lobby'],
};

export function createRoom(code, now = Date.now()) {
  return {
    code, phase: 'lobby', seq: 0, deadline: null, round: 0, host: null, players: [], updated: now,
    settings: {
      maxPlayers: MAX_PLAYERS, reveal: true,
      timers: { night: 45, dayAnnouncement: 5, discussion: 120, voting: 45, elimination: 5 },
      roles: { mode: 'auto', doctor: true, detective: true, jester: true, mafia: 1, villager: 2 },
    },
    ...freshMatch(),
  };
}

function freshMatch() {
  return {
    chat: { public: [], mafia: [], dead: [] }, events: [], log: [], announcement: null, lastVote: null, result: null, setup: null,
    mafiaVotes: new Map(), doctorTarget: null, detectiveTarget: null, lastProtected: null, investigations: [], votes: new Map(),
  };
}

const cleanText = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const seated = room => room.players.filter(p => !p.spectator);
const living = room => seated(room).filter(p => p.alive);
const byId = (room, id) => room.players.find(p => p.id === id);
const inMatch = room => room.phase !== 'lobby' && room.phase !== 'gameOver';
const livingMafia = room => living(room).filter(p => p.role === 'mafia').sort((a, b) => a.seat - b.seat);

export function addPlayer(room, rawName, now = Date.now()) {
  const name = cleanText(rawName, 20);
  if (!name) throw Error('Enter a name.');
  if (room.players.some(p => p.name.toLowerCase() === name.toLowerCase())) throw Error('That name is already taken in this room.');
  if (room.players.length >= MAX_MEMBERS) throw Error('This room is full.');
  if (room.phase === 'lobby' && seated(room).length >= room.settings.maxPlayers) throw Error('This room is full.');
  const player = { id: randomUUID(), token: randomUUID(), name, connected: true, left: false, ws: null, ready: false, seat: null, spectator: room.phase !== 'lobby', alive: false, role: null };
  room.players.push(player);
  if (!room.host) room.host = player.id;
  room.updated = now;
  return player;
}

function pickHost(room) {
  const next = room.players.find(p => p.connected && !p.spectator) ?? room.players.find(p => p.connected) ?? room.players[0];
  room.host = next?.id ?? null;
}

export function setPresence(room, player, connected) {
  player.connected = connected;
  if (connected) player.left = false;
  const host = byId(room, room.host);
  if (connected ? !host?.connected : host === player) pickHost(room);
}

function fillSeats(room) {
  for (const p of room.players) {
    if (!p.spectator) continue;
    if (seated(room).length >= room.settings.maxPlayers) break;
    p.spectator = false;
  }
}

function removePlayer(room, player) {
  room.players = room.players.filter(p => p !== player);
  if (room.host === player.id) pickHost(room);
  if (room.phase === 'lobby') fillSeats(room);
}

// Lobby seats and spectators are given up on leaving. A seat in a match stays so the same session can return to it.
export function leave(room, player) {
  if (room.phase === 'lobby' || player.spectator) { removePlayer(room, player); return true; }
  player.left = true;
  setPresence(room, player, false);
  return false;
}

export function roleCounts(settings, playerCount) {
  const r = settings.roles;
  if (r.mode === 'custom') return { mafia: r.mafia, doctor: +r.doctor, detective: +r.detective, jester: +r.jester, villager: r.villager };
  const mafia = MAFIA_BY_COUNT[playerCount] ?? 1;
  let left = Math.max(0, playerCount - mafia);
  const take = enabled => { if (enabled && left > 0) { left--; return 1; } return 0; };
  const doctor = take(r.doctor), detective = take(r.detective), jester = take(r.jester);
  return { mafia, doctor, detective, jester, villager: left };
}

export function setupProblem(counts, playerCount) {
  const total = ROLES.reduce((sum, role) => sum + counts[role], 0);
  if (total !== playerCount) return `The roles add up to ${total}, but ${playerCount} ${playerCount === 1 ? 'player is' : 'players are'} seated.`;
  const town = counts.doctor + counts.detective + counts.villager;
  if (counts.mafia < 1) return 'At least one Mafia member is needed.';
  if (town < 1) return 'At least one Town player is needed.';
  if (counts.mafia >= town + counts.jester) return 'Mafia would win immediately with these roles. Add non-Mafia players.';
  return null;
}

export function startProblem(room) {
  const players = seated(room);
  if (players.length < MIN_PLAYERS) return `At least ${MIN_PLAYERS} players are needed (6–15 recommended).`;
  const away = players.find(p => !p.connected);
  if (away) return `${away.name} is disconnected. Wait for them or remove them.`;
  const waiting = players.filter(p => p.id !== room.host && !p.ready);
  if (waiting.length) return `Waiting for ${waiting.length === 1 ? waiting[0].name : waiting.length + ' players'} to get ready.`;
  return setupProblem(roleCounts(room.settings, players.length), players.length);
}

function enter(room, phase, now) {
  if (!TRANSITIONS[room.phase]?.includes(phase)) throw Error(`Illegal transition: ${room.phase} to ${phase}.`);
  room.phase = phase;
  room.seq++;
  const seconds = phase === 'roleReveal' ? ROLE_REVEAL_SECONDS : room.settings.timers[phase];
  room.deadline = seconds ? now + seconds * 1000 : null;
  room.updated = now;
}

function say(room, text, now, kind = 'event') {
  room.log.push({ text, kind, round: room.round });
  room.chat.public.push({ system: true, text, at: now });
  if (room.chat.public.length > CHAT_LIMIT) room.chat.public.shift();
}

function record(room, event, now) { room.events.push({ ...event, seq: room.seq, round: room.round, at: now }); }

function startMatch(room, now) {
  const players = seated(room);
  const counts = roleCounts(room.settings, players.length);
  const deck = ROLES.flatMap(role => Array(counts[role]).fill(role));
  for (let i = deck.length - 1; i > 0; i--) { const j = randomInt(i + 1); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  players.forEach((p, i) => { p.seat = i + 1; p.role = deck[i]; p.alive = true; p.revealed = false; });
  room.setup = counts;
  enter(room, 'roleReveal', now);
  record(room, { type: 'roles', roles: players.map(p => [p.id, p.role]) }, now);
}

function beginNight(room, now) {
  room.round++;
  room.mafiaVotes = new Map(); room.doctorTarget = null; room.detectiveTarget = null; room.votes = new Map();
  enter(room, 'night', now);
}

// Most votes wins. A tie goes to the leader's vote (changing it onto a tied player always settles the tie), then to the lowest seat.
function mafiaPlan(room) {
  const voters = livingMafia(room), tally = new Map();
  for (const voter of voters) {
    const target = byId(room, room.mafiaVotes.get(voter.id));
    if (target?.alive && target.role !== 'mafia') tally.set(target, (tally.get(target) ?? 0) + 1);
  }
  const leader = voters[0] ?? null;
  if (!tally.size) return { leader, tied: [], target: null };
  const top = Math.max(...tally.values());
  const tops = [...tally].filter(([, n]) => n === top).map(([p]) => p).sort((a, b) => a.seat - b.seat);
  if (tops.length === 1) return { leader, tied: [], target: tops[0] };
  const choice = tops.find(p => p.id === room.mafiaVotes.get(leader.id));
  return { leader, tied: tops, target: choice ?? tops[0] };
}

const roleSentence = player => `They were ${player.role === 'mafia' ? 'a member of the Mafia' : `the ${ROLE_NAMES[player.role]}`}.`.replace('the Villager', 'a Villager');

function checkWin(room) {
  const mafia = livingMafia(room).length, alive = living(room);
  const town = alive.filter(p => ALIGNMENT[p.role] === 'town').length, others = alive.length - mafia;
  if (!mafia) return 'town';
  if (!town || mafia >= others) return 'mafia';
  return null;
}

function finish(room, winner, now) {
  room.result = { ...room.result, winner };
  say(room, winner === 'town' ? 'Town wins! All Mafia members are dead.' : 'Mafia wins! They now control the vote.', now, 'victory');
  record(room, { type: 'gameOver', winner }, now);
  enter(room, 'gameOver', now);
  room.deadline = null;
}

function resolveNight(room, now) {
  const doctor = living(room).find(p => p.role === 'doctor'), detective = living(room).find(p => p.role === 'detective');
  const protectedPlayer = doctor ? byId(room, room.doctorTarget) : null;
  const attacked = mafiaPlan(room).target;
  const killed = attacked && attacked !== protectedPlayer ? attacked : null;
  const investigated = detective ? byId(room, room.detectiveTarget) : null;
  if (investigated) {
    const isMafia = investigated.role === 'mafia';
    room.investigations.push({ round: room.round, target: investigated.id, isMafia, text: `Your investigation reveals that ${investigated.name} is ${isMafia ? 'Mafia' : 'Not Mafia'}.` });
  }
  room.lastProtected = protectedPlayer?.id ?? null;
  record(room, { type: 'night', protected: protectedPlayer?.id ?? null, attacked: attacked?.id ?? null, killed: killed?.id ?? null, investigated: investigated?.id ?? null }, now);
  let text = 'Morning has arrived. Nobody died last night.';
  if (killed) {
    killed.alive = false;
    killed.revealed = room.settings.reveal;
    text = `Morning has arrived. ${killed.name} was killed during the night.${room.settings.reveal ? ' ' + roleSentence(killed) : ''}`;
  }
  room.announcement = { text, killed: killed?.id ?? null };
  say(room, text, now);
  const winner = checkWin(room);
  if (winner) finish(room, winner, now); else enter(room, 'dayAnnouncement', now);
}

function resolveVote(room, now) {
  const alive = living(room), tally = new Map(), abstained = [];
  for (const voter of alive) {
    const choice = room.votes.get(voter.id);
    if (choice === 'abstain') { abstained.push(voter.name); continue; }
    const target = byId(room, choice);
    if (!target?.alive || target === voter) continue;
    if (!tally.has(target)) tally.set(target, []);
    tally.get(target).push(voter.name);
  }
  const voted = new Set(room.votes.keys());
  const tallies = [...tally].map(([p, voters]) => ({ id: p.id, name: p.name, count: voters.length, voters })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const top = tallies[0]?.count ?? 0, leaders = tallies.filter(t => t.count === top);
  const out = top > 0 && leaders.length === 1 ? byId(room, leaders[0].id) : null;
  room.lastVote = { round: room.round, tallies, abstained, noVote: alive.filter(p => !voted.has(p.id)).map(p => p.name), eliminated: out?.id ?? null };
  const totals = [...tallies.map(t => `${t.name}: ${t.count}`), ...(abstained.length ? [`Abstained: ${abstained.length}`] : [])];
  say(room, `Vote totals. ${totals.join(', ') || 'No votes were cast.'}`, now, 'vote');
  record(room, { type: 'vote', votes: [...room.votes], eliminated: out?.id ?? null }, now);
  let text = top > 0 ? 'The vote was tied. Nobody was eliminated.' : 'Nobody received a vote. Nobody was eliminated.';
  if (out) {
    out.alive = false;
    const jester = out.role === 'jester';
    out.revealed = room.settings.reveal || jester;
    text = jester ? `${out.name} was the Jester! The Jester has achieved their win condition!` : `${out.name} was voted out.${room.settings.reveal ? ' ' + roleSentence(out) : ''}`;
    if (jester) { room.result = { jester: out.id }; record(room, { type: 'jesterWin', player: out.id }, now); }
  }
  room.announcement = { text, killed: out?.id ?? null };
  say(room, text, now);
  const winner = out ? checkWin(room) : null;
  if (winner) finish(room, winner, now); else enter(room, 'elimination', now);
}

// Advances at most one phase per expired deadline, so a repeated tick can never resolve the same phase twice.
export function tick(room, now = Date.now()) {
  if (room.deadline === null || now < room.deadline) return false;
  const phase = room.phase;
  if (phase === 'roleReveal' || phase === 'elimination') beginNight(room, now);
  else if (phase === 'night') resolveNight(room, now);
  else if (phase === 'dayAnnouncement') enter(room, 'discussion', now);
  else if (phase === 'discussion') enter(room, 'voting', now);
  else if (phase === 'voting') resolveVote(room, now);
  return true;
}

function writableChannel(room, player) {
  if (!inMatch(room)) return 'public';
  if (player.spectator) return null;
  if (!player.alive) return 'dead';
  if (room.phase === 'night') return player.role === 'mafia' ? 'mafia' : null;
  return room.phase === 'roleReveal' ? null : 'public';
}

function nightAction(room, player) {
  if (room.phase !== 'night' || player.spectator || !player.alive) return null;
  const others = living(room);
  if (player.role === 'mafia') return { action: 'kill', choice: room.mafiaVotes.get(player.id) ?? null, targets: others.filter(p => p.role !== 'mafia').map(p => p.id), blocked: null };
  if (player.role === 'doctor') return { action: 'protect', choice: room.doctorTarget, targets: others.filter(p => p.id !== room.lastProtected).map(p => p.id), blocked: room.lastProtected };
  if (player.role === 'detective') return { action: 'investigate', choice: room.detectiveTarget, targets: others.filter(p => p !== player).map(p => p.id), blocked: null };
  return null;
}

function requirePhase(room, message, phase) {
  if (room.phase !== phase || message.seq !== room.seq) throw Error('That phase has ended.');
}

function requireHost(room, player) { if (room.host !== player.id) throw Error('Only the host can do that.'); }

function applySettings(room, patch) {
  if (room.phase !== 'lobby') throw Error('Settings can only change in the lobby.');
  const s = room.settings, int = (value, min, max, label) => {
    if (!Number.isInteger(value) || value < min || value > max) throw Error(`${label} must be between ${min} and ${max}.`);
    return value;
  };
  if ('maxPlayers' in patch) s.maxPlayers = int(patch.maxPlayers, Math.max(MIN_PLAYERS, seated(room).length), MAX_PLAYERS, 'Player count');
  if ('reveal' in patch) s.reveal = !!patch.reveal;
  for (const [phase, [min, max]] of Object.entries(TIMER_LIMITS)) if (patch.timers && phase in patch.timers) s.timers[phase] = int(patch.timers[phase], min, max, 'That timer');
  const roles = patch.roles;
  if (roles && typeof roles === 'object') {
    if (roles.mode === 'auto' || roles.mode === 'custom') {
      // Custom starts from what auto would have dealt, so it is immediately valid.
      if (roles.mode === 'custom' && s.roles.mode !== 'custom') { const counts = roleCounts(s, seated(room).length); s.roles.mafia = Math.max(1, counts.mafia); s.roles.villager = counts.villager; }
      s.roles.mode = roles.mode;
    }
    for (const role of ['doctor', 'detective', 'jester']) if (role in roles) s.roles[role] = !!roles[role];
    if ('mafia' in roles) s.roles.mafia = int(roles.mafia, 1, MAX_PLAYERS, 'Mafia count');
    if ('villager' in roles) s.roles.villager = int(roles.villager, 0, MAX_PLAYERS, 'Villager count');
  }
}

function resetToLobby(room, now) {
  enter(room, 'lobby', now);
  room.deadline = null;
  room.round = 0;
  Object.assign(room, freshMatch());
  room.players = room.players.filter(p => !p.left);
  for (const p of room.players) { p.ready = false; p.seat = null; p.alive = false; p.role = null; p.revealed = false; p.spectator = true; }
  fillSeats(room);
  if (!byId(room, room.host)?.connected) pickHost(room);
}

// Applies one player's message. Returns who must hear about it: null for everyone, or a list of players.
// Night actions and private chat must not reach anyone else, because even an extra update would reveal that they happened.
export function act(room, player, m, now = Date.now()) {
  room.updated = now;
  switch (m.action) {
    case 'ready':
      if (room.phase !== 'lobby' || player.spectator) throw Error('You can only ready up in the lobby.');
      player.ready = !!m.ready;
      return null;
    case 'settings':
      requireHost(room, player);
      if (!m.patch || typeof m.patch !== 'object') throw Error('Invalid settings.');
      applySettings(room, m.patch);
      return null;
    case 'start': {
      requireHost(room, player);
      if (room.phase !== 'lobby') throw Error('The match has already started.');
      const problem = startProblem(room);
      if (problem) throw Error(problem);
      startMatch(room, now);
      return null;
    }
    case 'remove': {
      requireHost(room, player);
      if (room.phase !== 'lobby') throw Error('Players can only be removed in the lobby.');
      const target = byId(room, m.player);
      if (!target || target === player) throw Error('That player cannot be removed.');
      removePlayer(room, target);
      return null;
    }
    case 'lobby':
      requireHost(room, player);
      if (room.phase !== 'gameOver') throw Error('The match is still going.');
      resetToLobby(room, now);
      return null;
    case 'chat': {
      const text = cleanText(m.text, 300);
      if (!text) throw Error('Write a message first.');
      const channel = writableChannel(room, player);
      // The channel must be the one the sender saw: a message typed in Mafia chat must never fall through to public at dawn.
      if (!channel || channel !== m.channel) throw Error(channelClosed(room, player));
      const log = room.chat[channel];
      log.push({ from: player.id, name: player.name, text, at: now });
      if (log.length > CHAT_LIMIT) log.shift();
      if (channel === 'mafia') return livingMafia(room);
      if (channel === 'dead') return seated(room).filter(p => !p.alive);
      return null;
    }
    case 'target': {
      requirePhase(room, m, 'night');
      const options = nightAction(room, player);
      if (!options) throw Error('You have no action tonight.');
      const target = m.target ?? null;
      if (target !== null && !options.targets.includes(target)) throw Error('You cannot choose that player.');
      if (options.action === 'kill') {
        if (target === null) room.mafiaVotes.delete(player.id); else room.mafiaVotes.set(player.id, target);
        return livingMafia(room);
      }
      if (options.action === 'protect') room.doctorTarget = target; else room.detectiveTarget = target;
      return [player];
    }
    case 'vote': {
      requirePhase(room, m, 'voting');
      if (player.spectator || !player.alive) throw Error('Only living players can vote.');
      const target = byId(room, m.target);
      if (m.target !== 'abstain' && (!target?.alive || target.spectator || target === player)) throw Error('You cannot vote for that player.');
      room.votes.set(player.id, m.target);
      return [player];
    }
    default:
      throw Error('Unknown action.');
  }
}

function channelClosed(room, player) {
  if (player.spectator) return 'Spectators cannot chat during a match.';
  if (room.phase === 'night') return 'Public chat is closed at night.';
  return 'That chat is closed right now.';
}

// The only way game state leaves the server. Every hidden field is included per viewer, so what is not added here cannot leak.
export function snapshot(room, viewer, now = Date.now()) {
  const over = room.phase === 'gameOver', isMafia = viewer.role === 'mafia';
  const roleVisible = p => p.role && (p === viewer || over || p.revealed || (isMafia && p.role === 'mafia'));
  const winners = over ? seated(room).filter(p => ALIGNMENT[p.role] === room.result.winner || p.id === room.result.jester).map(p => p.id) : [];
  const view = {
    code: room.code, phase: room.phase, seq: room.seq, round: room.round, deadline: room.deadline, serverNow: now, host: room.host, me: viewer.id,
    settings: room.settings, setup: room.setup, log: room.log, announcement: room.announcement, lastVote: room.lastVote,
    result: over ? { ...room.result, winners } : room.result ? { jester: room.result.jester } : null,
    players: [...room.players].sort((a, b) => (a.spectator - b.spectator) || (a.seat ?? 0) - (b.seat ?? 0)).map(p => ({
      id: p.id, name: p.name, connected: p.connected, ready: p.ready, spectator: p.spectator, seat: p.seat, alive: p.alive,
      role: roleVisible(p) ? p.role : null,
    })),
    chatChannel: writableChannel(room, viewer),
    chat: { public: room.chat.public },
  };
  if (room.phase === 'lobby') {
    const count = seated(room).length;
    view.counts = roleCounts(room.settings, count);
    view.startProblem = startProblem(room);
  }
  if (isMafia && (viewer.alive || over)) {
    view.chat.mafia = room.chat.mafia;
  }
  if (viewer.role && !viewer.alive) view.chat.dead = room.chat.dead;
  if (viewer.role === 'detective' && viewer.alive) view.investigations = room.investigations;
  const night = nightAction(room, viewer);
  if (night) {
    view.night = night;
    if (isMafia) {
      const plan = mafiaPlan(room);
      view.night.team = livingMafia(room).map(p => ({ id: p.id, name: p.name, choice: room.mafiaVotes.get(p.id) ?? null }));
      view.night.leader = plan.leader?.id ?? null;
      view.night.tied = plan.tied.map(p => p.id);
      view.night.planned = plan.target?.id ?? null;
    }
  }
  if (room.phase === 'voting' && !viewer.spectator && viewer.alive) {
    view.vote = { choice: room.votes.get(viewer.id) ?? null, targets: living(room).filter(p => p !== viewer).map(p => p.id) };
  }
  return view;
}
