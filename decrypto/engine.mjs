import { randomInt, randomUUID } from 'node:crypto';
import { words } from './words.mjs';

export const TEAM_IDS = ['blue', 'amber'];
export const other = team => team === 'blue' ? 'amber' : 'blue';
const normalize = value => String(value ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
const requireThat = (condition, message) => { if (!condition) throw Error(message); };
function shuffled(values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = randomInt(i + 1); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
const freshTeams = () => Object.fromEntries(TEAM_IDS.map(id => [id, { words: [], interceptions: 0, misses: 0, encoder: null, code: [], clues: null, draft: ['', '', ''], timedOut: false, decode: null, intercept: null }]));
export function createRoom(code) {
  return { code, phase: 'lobby', round: 0, host: null, players: [], teams: freshTeams(), history: [], chat: [], clueDeadline: null, target: null, winner: null, reason: '', tieGuesses: {}, wordList: { mode: 'classic', custom: [], version: 0 }, updated: Date.now(), revision: 0 };
}
export function addPlayer(room, name) {
  name = String(name ?? '').trim().replace(/\s+/g, ' ');
  requireThat(name.length > 0 && name.length <= 24, 'Use a name with 1–24 characters.');
  requireThat(room.players.length < 16, 'This room is full (16 people maximum).');
  const counts = TEAM_IDS.map(t => room.players.filter(p => p.team === t).length);
  const team = room.phase === 'lobby' ? (counts[0] <= counts[1] ? 'blue' : 'amber') : null;
  const p = { id: randomUUID(), token: randomUUID(), name, team: counts.every(n => n >= 4) ? null : team, connected: true };
  room.players.push(p); room.host ??= p.id;
  return p;
}
export function setPresence(room, player, connected) {
  player.connected = connected;
  if (!connected && room.host === player.id) room.host = room.players.find(p => p.connected)?.id ?? player.id;
  if (connected && !room.players.some(p => p.id === room.host && p.connected)) room.host = player.id;
}
function beginRound(room) {
  room.round++; room.phase = 'clues'; room.target = null; room.clueDeadline = null;
  for (const id of TEAM_IDS) {
    const t = room.teams[id], members = room.players.filter(p => p.team === id);
    t.encoder = members[(room.round - 1) % members.length].id;
    t.code = shuffled([1, 2, 3, 4]).slice(0, 3);
    t.clues = t.decode = t.intercept = null; t.draft = ['', '', '']; t.timedOut = false;
  }
}
function finish(room, winner, reason) { room.phase = 'finished'; room.winner = winner; room.reason = reason; room.target = null; }
function endRound(room) {
  const a = room.teams.blue, b = room.teams.amber;
  const blueWins = a.interceptions >= 2 || b.misses >= 2;
  const amberWins = b.interceptions >= 2 || a.misses >= 2;
  if (blueWins !== amberWins) return finish(room, blueWins ? 'blue' : 'amber', 'Two interceptions or two opposing miscommunications.');
  if (blueWins || amberWins || room.round >= 8) {
    const delta = (a.interceptions - a.misses) - (b.interceptions - b.misses);
    if (delta) return finish(room, delta > 0 ? 'blue' : 'amber', 'Tiebreak: interceptions minus miscommunications.');
    room.phase = 'tiebreak'; room.target = null; return;
  }
  room.phase = 'round_end'; room.target = null;
}
function resolveTransmission(room) {
  const id = room.target, t = room.teams[id];
  if (!t.decode || (room.round > 1 && !t.intercept)) return;
  const decoded = t.decode.join('') === t.code.join('');
  const intercepted = room.round > 1 && t.intercept.join('') === t.code.join('');
  if (!decoded) t.misses++;
  if (intercepted) room.teams[other(id)].interceptions++;
  room.history.push({ round: room.round, team: id, clues: [...t.clues], timedOut: t.timedOut, code: [...t.code], decode: [...t.decode], intercept: t.intercept ? [...t.intercept] : null, decoded, intercepted });
  if (id === 'blue') room.target = 'amber'; else endRound(room);
}
// The deadline belongs to the room, so it survives disconnects and tab suspension.
export function expireClues(room, now = Date.now()) {
  if (room.phase !== 'clues' || room.clueDeadline === null || now < room.clueDeadline) return false;
  for (const id of TEAM_IDS) {
    const t = room.teams[id];
    if (!t.clues) { t.clues = t.draft.map(c => c.trim().replace(/\s+/g, ' ')); t.timedOut = true; }
  }
  room.phase = 'guess'; room.target = 'blue'; room.clueDeadline = null;
  room.updated = now; room.revision++;
  return true;
}
export function act(room, p, message) {
  expireClues(room);
  const { action } = message;
  requireThat(room.players.includes(p), 'Rejoin this room.');
  if (action === 'team') {
    requireThat(room.phase === 'lobby', 'Teams can change in the lobby. Ask the host to return there first.');
    requireThat(message.team === null || TEAM_IDS.includes(message.team), 'Choose a valid team.');
    requireThat(message.team === null || room.players.filter(q => q.team === message.team && q !== p).length < 4, 'That team already has four players.');
    p.team = message.team;
  } else if (action === 'word-list') {
    requireThat(room.host === p.id && room.phase === 'lobby', 'Only the host can change the word list in the lobby.');
    requireThat(['classic', 'custom'].includes(message.mode), 'Choose the classic or custom word list.');
    let custom = room.wordList.custom;
    if (message.mode === 'custom') {
      requireThat(typeof message.text === 'string' && message.text.length <= 6000, 'Paste a word list of up to 6,000 characters.');
      custom = [...new Set(message.text.split(/[,;\r\n]+/).map(normalize).filter(Boolean))];
      requireThat(custom.length >= 8 && custom.length <= 100, 'Use 8–100 unique words or phrases. Duplicates count only once.');
      requireThat(custom.every(w => w.length <= 40 && /^[\p{L}\p{M}\p{N} '\u2019-]+$/u.test(w) && /[\p{L}\p{N}]/u.test(w)), 'Each entry must be 1–40 characters: letters, numbers, spaces, apostrophes, or hyphens.');
    }
    room.wordList = { mode: message.mode, custom, version: room.wordList.version + 1 };
  } else if (action === 'start') {
    requireThat(room.host === p.id && room.phase === 'lobby', 'Only the host can start from the lobby.');
    requireThat(TEAM_IDS.every(id => room.players.filter(q => q.team === id && q.connected).length >= 2), 'You need at least two connected players on each team.');
    requireThat(room.players.filter(q => q.team).every(q => q.connected), 'Wait for disconnected players, or remove them before starting.');
    room.teams = freshTeams(); room.history = []; room.chat = []; room.tieGuesses = {}; room.round = 0; room.winner = null; room.reason = '';
    const pool = shuffled(room.wordList.mode === 'custom' ? room.wordList.custom : words);
    for (const id of TEAM_IDS) room.teams[id].words = pool.splice(0, 4);
    beginRound(room);
  } else if (action === 'lobby') {
    requireThat(room.host === p.id, 'Only the host can return everyone to the lobby.');
    // Wipe secrets before allowing team changes. Starting again always deals new words.
    room.clueDeadline = null; room.phase = 'lobby'; room.teams = freshTeams(); room.history = []; room.chat = []; room.round = 0; room.target = null; room.tieGuesses = {}; room.winner = null;
  } else if (action === 'remove') {
    requireThat(room.host === p.id && room.phase === 'lobby', 'Only the host can remove players in the lobby.');
    const target = room.players.find(q => q.id === message.player);
    requireThat(target && target !== p, 'Choose another player.');
    room.players = room.players.filter(q => q !== target);
  } else if (action === 'clue-draft') {
    const t = room.teams[p.team];
    requireThat(room.phase === 'clues' && message.round === room.round && t?.encoder === p.id && !t.clues, 'This clue window has closed.');
    requireThat(Array.isArray(message.clues) && message.clues.length === 3 && message.clues.every(c => typeof c === 'string' && c.length <= 80), 'Use three clue fields of up to 80 characters.');
    t.draft = [...message.clues];
  } else if (action === 'clues') {
    const t = room.teams[p.team];
    requireThat((message.round === undefined || message.round === room.round) && room.phase === 'clues' && t?.encoder === p.id && !t.clues, 'Only the current encryptor can submit clues once.');
    requireThat(Array.isArray(message.clues) && message.clues.length === 3 && message.clues.every(c => typeof c === 'string' && c.trim().length > 0 && c.trim().length <= 80), 'Write three clues, up to 80 characters each.');
    const clues = message.clues.map(c => c.trim().replace(/\s+/g, ' '));
    const used = room.history.flatMap(h => h.clues).map(normalize);
    for (const team of Object.values(room.teams)) if (team.clues) used.push(...team.clues.map(normalize));
    requireThat(new Set(clues.map(normalize)).size === 3 && clues.every(c => !used.includes(normalize(c))), 'Each clue must be new. Do not repeat a clue.');
    const keywordText = value => ' ' + normalize(value).replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim() + ' ';
    requireThat(clues.every(c => !t.words.some(w => keywordText(c).includes(keywordText(w)))), 'Do not include any of your secret words in a clue.');
    t.clues = clues; t.draft = [...clues];
    if (TEAM_IDS.every(id => room.teams[id].clues)) { room.phase = 'guess'; room.target = 'blue'; room.clueDeadline = null; }
    else room.clueDeadline ??= Date.now() + 30000;
  } else if (action === 'guess') {
    requireThat(room.phase === 'guess' && p.team && message.target === room.target && message.round === room.round, 'This transmission has already moved on.');
    const t = room.teams[room.target], own = p.team === room.target;
    requireThat(!own || t.encoder !== p.id, 'Encryptors cannot decode their own code.');
    requireThat(own || room.round > 1, 'Interceptions begin in round two.');
    const key = own ? 'decode' : 'intercept';
    requireThat(!t[key], 'Your team has already locked in its guess.');
    requireThat(Array.isArray(message.code) && message.code.length === 3 && message.code.every(n => Number.isInteger(n) && n >= 1 && n <= 4) && new Set(message.code).size === 3, 'Choose three different digits from 1 to 4.');
    t[key] = [...message.code]; resolveTransmission(room);
  } else if (action === 'next') {
    requireThat(room.host === p.id && room.phase === 'round_end', 'Only the host can start the next round.');
    requireThat(room.players.filter(q => q.team).every(q => q.connected), 'Wait for your teammates to reconnect, or return to the lobby.');
    beginRound(room);
  } else if (action === 'tiebreak') {
    requireThat(room.phase === 'tiebreak' && p.team && !room.tieGuesses[p.team], 'Your team cannot submit now.');
    requireThat(Array.isArray(message.words) && message.words.length === 4 && message.words.every(w => typeof w === 'string' && w.trim().length > 0 && w.length <= 80), 'Guess all four opposing words in numbered order.');
    room.tieGuesses[p.team] = message.words.map(normalize);
    if (TEAM_IDS.every(id => room.tieGuesses[id])) {
      const score = id => room.tieGuesses[id].filter((w, i) => w === room.teams[other(id)].words[i]).length;
      const a = score('blue'), b = score('amber');
      finish(room, a === b ? 'draw' : a > b ? 'blue' : 'amber', `Keyword tiebreak: Blue ${a}, Amber ${b}. Exact words in the correct positions count.`);
    }
  } else if (action === 'chat') {
    const text = String(message.text ?? '').trim();
    requireThat(text.length > 0 && text.length <= 300, 'Messages must have 1–300 characters.');
    requireThat(message.channel === 'room' || (message.channel === 'team' && p.team), 'Choose a chat channel.');
    const t = room.teams[p.team];
    requireThat(!(['clues', 'guess'].includes(room.phase) && t?.encoder === p.id && !room.history.some(h => h.round === room.round && h.team === p.team)), 'Stay silent until your code is revealed, encryptor.');
    room.chat.push({ id: randomUUID(), player: p.id, name: p.name, text, channel: message.channel === 'team' ? p.team : 'room' });
    room.chat = room.chat.slice(-150);
  } else throw Error('Unknown game action.');
  room.updated = Date.now(); room.revision++;
}
export function snapshot(room, p) {
  const revealed = id => room.phase === 'finished' || room.history.some(h => h.round === room.round && h.team === id);
  return {
    serverNow: Date.now(), clueDeadline: room.clueDeadline, code: room.code, phase: room.phase, round: room.round, host: room.host, me: p.id, target: room.target, winner: room.winner, reason: room.reason,
    wordList: { mode: room.wordList.mode, count: room.wordList.mode === 'custom' ? room.wordList.custom.length : words.length, version: room.wordList.version, custom: room.phase === 'lobby' && room.host === p.id ? room.wordList.custom : undefined },
    players: room.players.map(({ id, name, team, connected }) => ({ id, name, team, connected })),
    teams: Object.fromEntries(TEAM_IDS.map(id => {
      const t = room.teams[id];
      return [id, { words: p.team === id || room.phase === 'finished' ? t.words : [], interceptions: t.interceptions, misses: t.misses, encoder: t.encoder,
        code: p.id === t.encoder || revealed(id) ? t.code : null,
        clues: room.phase === 'clues' ? (p.id === t.encoder ? t.clues : null) : (id === 'blue' || room.target === 'amber' || revealed(id) ? t.clues : null),
        draft: p.id === t.encoder && room.phase === 'clues' ? t.draft : undefined, timedOut: t.timedOut, cluesReady: !!t.clues, decodeReady: !!t.decode, interceptReady: !!t.intercept,
        decode: p.team === id || revealed(id) ? t.decode : null, intercept: p.team === other(id) || revealed(id) ? t.intercept : null }];
    })),
    history: room.history, chat: room.chat.filter(c => c.channel === 'room' || c.channel === p.team),
    tieReady: Object.fromEntries(TEAM_IDS.map(id => [id, !!room.tieGuesses[id]])), tieGuesses: room.phase === 'finished' ? room.tieGuesses : undefined,
  };
}
