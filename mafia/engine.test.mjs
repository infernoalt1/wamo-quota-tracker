import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, addPlayer, act, leave, snapshot, setPresence, tick, roleCounts, setupProblem, startProblem } from './engine.mjs';

const T0 = 1_000_000;

// Builds a room at Night 1 with chosen roles, in seat order.
function game(roles, settings = {}) {
  const room = createRoom('ABCDEF', T0);
  Object.assign(room.settings, settings);
  room.settings.roles.mode = 'custom';
  const names = roles.map((_, i) => 'P' + (i + 1));
  const players = names.map(n => addPlayer(room, n, T0));
  for (const p of players) p.ready = true;
  const count = r => roles.filter(x => x === r).length;
  Object.assign(room.settings.roles, { mafia: count('mafia'), villager: count('villager'), doctor: !!count('doctor'), detective: !!count('detective'), jester: !!count('jester') });
  act(room, players[0], { action: 'start' }, T0);
  players.forEach((p, i) => { p.role = roles[i]; });
  next(room);
  assert.equal(room.phase, 'night');
  return { room, players, by: Object.fromEntries(names.map((n, i) => [n, players[i]])) };
}
const next = room => tick(room, room.deadline);
const target = (room, player, t) => act(room, player, { action: 'target', seq: room.seq, target: t?.id ?? null });
const vote = (room, player, t) => act(room, player, { action: 'vote', seq: room.seq, target: t === 'abstain' ? t : t.id });
const toVoting = room => { while (room.phase !== 'voting') next(room); };
const toNight = room => { while (room.phase !== 'night') next(room); };
const announcement = room => room.announcement.text;

test('default role table matches the rules, including unlisted sizes', () => {
  const room = createRoom('A');
  const table = { 6: [1, 2], 7: [2, 2], 8: [2, 3], 9: [2, 4], 10: [2, 5], 12: [3, 6], 15: [4, 8] };
  for (const [n, [mafia, villager]] of Object.entries(table)) {
    const c = roleCounts(room.settings, +n);
    assert.deepEqual([c.mafia, c.doctor, c.detective, c.jester, c.villager], [mafia, 1, 1, 1, villager]);
  }
  for (let n = 3; n <= 15; n++) assert.equal(setupProblem(roleCounts(room.settings, n), n), null, `size ${n}`);
  room.settings.roles.jester = false;
  assert.equal(roleCounts(room.settings, 8).villager, 4);
});

test('starting requires a valid distribution, ready players, and the host', () => {
  const room = createRoom('A', T0);
  const [a, b, c, d] = ['A', 'B', 'C', 'D'].map(n => addPlayer(room, n, T0));
  assert.throws(() => addPlayer(room, 'a', T0), /taken/);
  assert.throws(() => act(room, b, { action: 'start' }), /host/);
  assert.match(startProblem(room), /Waiting for 3 players/);
  for (const p of [b, c, d]) act(room, p, { action: 'ready', ready: true });
  assert.equal(startProblem(room), null);
  setPresence(room, d, false);
  assert.match(startProblem(room), /disconnected/);
  setPresence(room, d, true);
  act(room, a, { action: 'settings', patch: { roles: { mode: 'custom' } } });
  assert.equal(startProblem(room), null, 'custom starts from the valid auto deal');
  act(room, a, { action: 'settings', patch: { roles: { villager: 5 } } });
  assert.match(startProblem(room), /add up to/);
  act(room, a, { action: 'settings', patch: { roles: { mafia: 2, villager: 2, doctor: false, detective: false, jester: false } } });
  assert.match(startProblem(room), /win immediately/);
  assert.throws(() => act(room, a, { action: 'start' }), /win immediately/);
  assert.equal(room.phase, 'lobby');
  assert.throws(() => act(room, a, { action: 'settings', patch: { timers: { night: 1 } } }), /between/);
  assert.throws(() => act(room, a, { action: 'settings', patch: { maxPlayers: 3 } }), /between/, 'cannot shrink below seated players');
});

test('role assignment gives everyone exactly one role from the distribution', () => {
  const room = createRoom('A', T0);
  const players = Array.from({ length: 8 }, (_, i) => addPlayer(room, 'P' + i, T0));
  for (const p of players) p.ready = true;
  act(room, players[0], { action: 'start' }, T0);
  assert.equal(room.phase, 'roleReveal');
  const dealt = players.map(p => p.role).sort();
  assert.deepEqual(dealt, ['detective', 'doctor', 'jester', 'mafia', 'mafia', 'villager', 'villager', 'villager']);
  assert.throws(() => act(room, players[0], { action: 'start' }), /already started/);
});

test('phases follow the fixed order with the host-set timers', () => {
  const { room } = game(['mafia', 'doctor', 'detective', 'villager', 'villager', 'jester']);
  const seen = [];
  for (let i = 0; i < 4; i++) {
    const started = room.deadline;
    next(room);
    seen.push(room.phase);
    assert.equal(room.deadline - started, room.settings.timers[room.phase] * 1000);
  }
  assert.deepEqual(seen, ['dayAnnouncement', 'discussion', 'voting', 'elimination']);
  next(room);
  assert.equal(room.phase, 'night');
  assert.equal(room.round, 2);
  assert.equal(tick(room, room.deadline - 1), false, 'nothing moves before the deadline');
});

test('the Mafia kill succeeds, and is blocked by the Doctor', () => {
  const { room, by } = game(['mafia', 'doctor', 'detective', 'villager', 'villager', 'villager', 'jester']);
  target(room, by.P1, by.P4);
  next(room);
  assert.equal(by.P4.alive, false);
  assert.match(announcement(room), /Morning has arrived\. P4 was killed.*a Villager/);
  toNight(room);
  target(room, by.P1, by.P5);
  target(room, by.P2, by.P5);
  next(room);
  assert.equal(by.P5.alive, true);
  assert.equal(announcement(room), 'Morning has arrived. Nobody died last night.');
  assert.doesNotMatch(JSON.stringify(snapshot(room, by.P3)), /protect/i, 'public state never mentions the save');
});

test('Mafia cannot target teammates or the dead, and skip the kill when nobody votes', () => {
  const { room, by } = game(['mafia', 'mafia', 'doctor', 'detective', 'villager', 'villager', 'villager', 'jester']);
  assert.throws(() => target(room, by.P1, by.P2), /cannot choose/);
  target(room, by.P1, by.P5);
  target(room, by.P1, null);
  next(room);
  assert.equal(announcement(room), 'Morning has arrived. Nobody died last night.');
  toNight(room);
  target(room, by.P1, by.P5);
  next(room);
  toNight(room);
  assert.throws(() => target(room, by.P1, by.P5), /cannot choose/);
});

test('Mafia ties go to the leader, then to the lowest seat', () => {
  const roles = ['mafia', 'mafia', 'mafia', 'villager', 'villager', 'villager', 'villager', 'villager', 'jester'];
  // The leader's own vote settles a tie.
  let g = game(roles);
  target(g.room, g.by.P1, g.by.P6);
  target(g.room, g.by.P2, g.by.P5);
  assert.deepEqual(snapshot(g.room, g.by.P1).night.tied.sort(), [g.by.P5.id, g.by.P6.id].sort());
  next(g.room);
  assert.equal(g.by.P6.alive, false);
  // No leader vote: the lowest seat among the tied players.
  g = game(roles);
  target(g.room, g.by.P2, g.by.P6);
  target(g.room, g.by.P3, g.by.P5);
  next(g.room);
  assert.equal(g.by.P5.alive, false);
  // A majority beats the leader.
  g = game(roles);
  target(g.room, g.by.P1, g.by.P6);
  target(g.room, g.by.P2, g.by.P5);
  target(g.room, g.by.P3, g.by.P5);
  next(g.room);
  assert.equal(g.by.P5.alive, false);
  assert.equal(g.by.P6.alive, true);
  // Leadership passes when the lowest seat dies.
  g = game(roles);
  toVoting(g.room);
  for (const p of [g.by.P4, g.by.P5, g.by.P6]) vote(g.room, p, g.by.P1);
  next(g.room);
  toNight(g.room);
  assert.equal(snapshot(g.room, g.by.P2).night.leader, g.by.P2.id);
});

test('Doctor may self-protect but never the same player on consecutive nights', () => {
  const { room, by } = game(['mafia', 'doctor', 'villager', 'villager', 'villager', 'villager']);
  target(room, by.P2, by.P2);
  next(room);
  toNight(room);
  assert.throws(() => target(room, by.P2, by.P2), /cannot choose/);
  assert.equal(snapshot(room, by.P2).night.blocked, by.P2.id);
  target(room, by.P2, by.P3);
  next(room);
  toNight(room);
  target(room, by.P2, by.P2);
  next(room);
  toNight(room);
  // Skipping a night resets the restriction.
  next(room);
  toNight(room);
  target(room, by.P2, by.P2);
});

test('Detective results are private, correct, and lost on death', () => {
  const { room, by } = game(['mafia', 'doctor', 'detective', 'villager', 'villager', 'jester']);
  assert.throws(() => target(room, by.P3, by.P3), /cannot choose/);
  target(room, by.P3, by.P1);
  next(room);
  assert.equal(snapshot(room, by.P3).investigations[0].text, 'Your investigation reveals that P1 is Mafia.');
  assert.equal(snapshot(room, by.P1).investigations, undefined);
  assert.equal(snapshot(room, by.P4).investigations, undefined);
  toNight(room);
  target(room, by.P3, by.P6);
  target(room, by.P1, by.P3);
  next(room);
  assert.equal(by.P3.alive, false);
  assert.equal(room.investigations[1].text, 'Your investigation reveals that P6 is Not Mafia.');
  assert.equal(snapshot(room, by.P3).investigations, undefined, 'a detective killed the same night cannot read the result');
  assert.ok(room.events.some(e => e.type === 'night' && e.investigated === by.P6.id), 'the server log keeps it');
});

test('voting: self, dead, and stale votes rejected; last vote counts; ties and abstains eliminate nobody', () => {
  const { room, by } = game(['mafia', 'doctor', 'detective', 'villager', 'villager', 'villager', 'jester']);
  const stale = room.seq;
  toVoting(room);
  assert.throws(() => act(room, by.P2, { action: 'vote', seq: stale, target: by.P1.id }), /phase has ended/);
  assert.throws(() => vote(room, by.P1, by.P1), /cannot vote/);
  vote(room, by.P2, by.P3);
  vote(room, by.P2, by.P4);
  vote(room, by.P3, by.P4);
  vote(room, by.P4, by.P2);
  vote(room, by.P5, 'abstain');
  next(room);
  assert.equal(by.P4.alive, false);
  assert.match(announcement(room), /P4 was voted out\. They were a Villager/);
  assert.deepEqual(room.lastVote.tallies.map(t => [t.name, t.count]), [['P4', 2], ['P2', 1]]);
  assert.deepEqual(room.lastVote.abstained, ['P5']);
  toVoting(room);
  assert.throws(() => vote(room, by.P4, by.P2), /living/);
  assert.throws(() => vote(room, by.P2, by.P4), /cannot vote/);
  vote(room, by.P1, by.P2);
  vote(room, by.P2, by.P1);
  next(room);
  assert.match(announcement(room), /tied/);
  assert.equal(by.P1.alive && by.P2.alive, true);
  toVoting(room);
  for (const p of [by.P1, by.P2, by.P3]) vote(room, p, 'abstain');
  next(room);
  assert.match(announcement(room), /Nobody received/);
});

test('a voted-out Jester wins alone and the match continues', () => {
  const { room, by } = game(['mafia', 'doctor', 'detective', 'villager', 'villager', 'jester']);
  toVoting(room);
  for (const p of [by.P1, by.P2, by.P3]) vote(room, p, by.P6);
  next(room);
  assert.equal(announcement(room), 'P6 was the Jester! The Jester has achieved their win condition!');
  assert.equal(room.phase, 'elimination');
  assert.equal(room.result.jester, by.P6.id);
  toNight(room);
  toVoting(room);
  vote(room, by.P2, by.P1);
  next(room);
  assert.equal(room.phase, 'gameOver');
  const final = snapshot(room, by.P4).result;
  assert.equal(final.winner, 'town');
  assert.ok(final.winners.includes(by.P6.id) && final.winners.includes(by.P2.id));
  assert.ok(!final.winners.includes(by.P1.id));
});

test('a Jester killed at night or left alive does not win', () => {
  const { room, by } = game(['mafia', 'doctor', 'detective', 'villager', 'jester']);
  target(room, by.P1, by.P5);
  next(room);
  assert.equal(by.P5.alive, false);
  assert.equal(room.result, null);
  const again = game(['mafia', 'doctor', 'villager', 'villager', 'jester']);
  toVoting(again.room);
  vote(again.room, again.by.P2, again.by.P1);
  next(again.room);
  assert.equal(again.room.result.winner, 'town');
  assert.equal(again.room.result.jester, undefined);
  assert.ok(!snapshot(again.room, again.by.P1).result.winners.includes(again.by.P5.id));
});

test('the rules examples: parity, Jester counts as non-Mafia, both victories together', () => {
  // Example 1: 2 Mafia against 2 Villagers and a Jester continues.
  let g = game(['mafia', 'mafia', 'villager', 'villager', 'jester']);
  next(g.room);
  assert.equal(g.room.phase, 'dayAnnouncement');
  // Example 2: 2 Mafia, 1 Villager, 1 Jester is parity.
  g = game(['mafia', 'mafia', 'villager', 'villager', 'jester']);
  target(g.room, g.by.P1, g.by.P3);
  next(g.room);
  assert.equal(g.room.phase, 'gameOver');
  assert.equal(g.room.result.winner, 'mafia');
  // Example 3: voting out the Jester at 1/1/1 gives a Jester and a Mafia victory.
  g = game(['mafia', 'villager', 'jester']);
  toVoting(g.room);
  vote(g.room, g.by.P1, g.by.P3);
  next(g.room);
  assert.equal(g.room.phase, 'gameOver');
  assert.deepEqual([g.room.result.winner, g.room.result.jester], ['mafia', g.by.P3.id]);
  // Eliminated team members share the team win.
  g = game(['mafia', 'mafia', 'villager', 'villager', 'villager', 'jester', 'doctor']);
  toVoting(g.room);
  for (const p of [g.by.P3, g.by.P4, g.by.P5]) vote(g.room, p, g.by.P1);
  next(g.room);
  toVoting(g.room);
  vote(g.room, g.by.P3, g.by.P2);
  next(g.room);
  assert.equal(g.room.result.winner, 'town');
  assert.ok(snapshot(g.room, g.by.P3).result.winners.includes(g.by.P3.id));
});

test('privacy: a snapshot holds nothing beyond what that viewer may know', () => {
  const { room, by } = game(['mafia', 'mafia', 'doctor', 'detective', 'villager', 'villager', 'jester', 'villager']);
  const spectator = addPlayer(room, 'Watcher');
  target(room, by.P1, by.P5);
  target(room, by.P3, by.P5);
  target(room, by.P4, by.P1);
  act(room, by.P1, { action: 'chat', channel: 'mafia', text: 'secret plan' });
  const hidden = /secret plan/;
  for (const viewer of [by.P3, by.P4, by.P5, by.P7, spectator]) {
    const json = JSON.stringify(snapshot(room, viewer));
    assert.doesNotMatch(json, hidden);
    assert.doesNotMatch(json, /token/);
    assert.equal(snapshot(room, viewer).players.filter(p => p.role && p.id !== viewer.id).length, 0, viewer.name + ' sees no other roles');
    assert.equal(snapshot(room, viewer).night?.team, undefined);
    assert.equal(snapshot(room, viewer).night?.tied, undefined);
  }
  const mafia = snapshot(room, by.P1);
  assert.match(JSON.stringify(mafia), hidden);
  assert.deepEqual(mafia.players.filter(p => p.role).map(p => p.name), ['P1', 'P2']);
  assert.equal(snapshot(room, by.P3).night.choice, by.P5.id);
  assert.equal(snapshot(room, by.P5).night, undefined, 'villagers have no action');
  next(room);
  toVoting(room);
  vote(room, by.P2, by.P3);
  assert.equal(snapshot(room, by.P4).vote.choice, null, 'pending votes stay private');
  assert.equal(snapshot(room, by.P4).lastVote, null);
  assert.deepEqual(room.events[0].type, 'roles');
  assert.doesNotMatch(JSON.stringify(snapshot(room, by.P4)), /"events"/);
});

test('private actions only notify the people allowed to see them', () => {
  const { room, by } = game(['mafia', 'mafia', 'doctor', 'detective', 'villager', 'villager', 'villager', 'jester']);
  const names = list => list.map(p => p.name).sort();
  assert.deepEqual(names(target(room, by.P1, by.P5)), ['P1', 'P2']);
  assert.deepEqual(names(target(room, by.P3, by.P5)), ['P3']);
  assert.deepEqual(names(target(room, by.P4, by.P5)), ['P4']);
  assert.deepEqual(names(act(room, by.P1, { action: 'chat', channel: 'mafia', text: 'hi' })), ['P1', 'P2']);
  next(room);
  toVoting(room);
  assert.deepEqual(names(vote(room, by.P6, by.P1)), ['P6']);
});

test('chat channels follow life, phase, and role, and a stale channel is rejected', () => {
  const { room, by } = game(['mafia', 'mafia', 'doctor', 'villager', 'villager', 'villager', 'villager', 'jester']);
  const say = (p, channel) => act(room, p, { action: 'chat', channel, text: 'x' });
  const spectator = addPlayer(room, 'Watcher');
  assert.throws(() => say(by.P4, 'public'), /closed at night/);
  assert.throws(() => say(by.P1, 'public'), /closed/);
  assert.throws(() => say(by.P3, 'mafia'), /closed/);
  say(by.P1, 'mafia');
  assert.throws(() => say(spectator, 'public'), /Spectators/);
  target(room, by.P1, by.P4);
  next(room);
  assert.throws(() => say(by.P1, 'mafia'), /closed/, 'a mafia draft sent after dawn does not become public');
  say(by.P1, 'public');
  assert.throws(() => say(by.P4, 'public'), /closed/);
  say(by.P4, 'dead');
  assert.equal(snapshot(room, by.P1).chat.dead, undefined);
  assert.equal(snapshot(room, spectator).chat.dead, undefined);
  assert.equal(snapshot(room, by.P4).chat.dead.length, 1);
  assert.equal(snapshot(room, by.P4).chat.mafia, undefined);
  assert.throws(() => target(room, by.P4, by.P5), /phase has ended/);
  assert.equal(room.chat.public.filter(m => !m.system).length, 1);
  assert.throws(() => act(room, by.P1, { action: 'chat', channel: 'public', text: '   ' }), /Write a message/);
});

test('reveal setting hides a dead role until the match ends, but not a Jester win', () => {
  const { room, by } = game(['mafia', 'doctor', 'villager', 'villager', 'villager', 'jester'], { reveal: false });
  target(room, by.P1, by.P3);
  next(room);
  assert.doesNotMatch(announcement(room), /They were/);
  assert.equal(snapshot(room, by.P4).players.find(p => p.id === by.P3.id).role, null);
  toVoting(room);
  for (const p of [by.P1, by.P2, by.P4]) vote(room, p, by.P6);
  next(room);
  assert.equal(snapshot(room, by.P4).players.find(p => p.id === by.P6.id).role, 'jester');
  toVoting(room);
  vote(room, by.P2, by.P1);
  next(room);
  assert.equal(snapshot(room, by.P4).players.find(p => p.id === by.P3.id).role, 'villager');
});

test('disconnects keep role, life, and submitted actions; the session token is unchanged', () => {
  const { room, by } = game(['mafia', 'doctor', 'villager', 'villager', 'villager', 'jester']);
  const token = by.P1.token;
  target(room, by.P1, by.P3);
  setPresence(room, by.P1, false);
  assert.equal(room.host, by.P2.id, 'host passes on');
  next(room);
  assert.equal(by.P3.alive, false, 'the action still counts');
  assert.equal(by.P1.alive, true);
  setPresence(room, by.P1, true);
  assert.equal(by.P1.token, token);
  assert.equal(snapshot(room, by.P1).players.find(p => p.id === by.P1.id).role, 'mafia');
  assert.equal(room.host, by.P2.id);
});

test('a repeated tick cannot double-resolve, and game over stops everything', () => {
  const { room, by } = game(['mafia', 'villager', 'villager', 'jester']);
  target(room, by.P1, by.P2);
  const deadline = room.deadline;
  tick(room, deadline);
  assert.equal(tick(room, deadline), false, 'the new phase has its own later deadline');
  assert.equal(room.events.filter(e => e.type === 'night').length, 1);
  toVoting(room);
  vote(room, by.P3, by.P1);
  next(room);
  assert.equal(room.phase, 'gameOver');
  assert.equal(room.deadline, null);
  assert.equal(tick(room, Number.MAX_SAFE_INTEGER), false);
  assert.throws(() => vote(room, by.P3, by.P1), /phase has ended/);
  assert.throws(() => target(room, by.P1, by.P3), /phase has ended/);
});

test('late joiners spectate, lobby leaves free seats, and play again resets the table', () => {
  const room = createRoom('A', T0);
  const host = addPlayer(room, 'Host', T0), guest = addPlayer(room, 'Guest', T0);
  act(room, host, { action: 'settings', patch: { maxPlayers: 3 } });
  const third = addPlayer(room, 'Third', T0);
  assert.throws(() => addPlayer(room, 'Fourth', T0), /full/);
  assert.equal(leave(room, third), true);
  assert.equal(room.players.length, 2);
  addPlayer(room, 'Fourth', T0);
  const { room: played, by } = game(['mafia', 'villager', 'jester']);
  const late = addPlayer(played, 'Late');
  assert.equal(late.spectator, true);
  assert.throws(() => act(played, late, { action: 'vote', seq: played.seq, target: by.P1.id }), /phase has ended/);
  assert.equal(leave(played, by.P2), false, 'a match seat is kept');
  assert.equal(by.P2.connected, false);
  assert.throws(() => act(played, by.P1, { action: 'lobby' }), /still going/);
  toVoting(played);
  vote(played, by.P1, by.P3);
  next(played);
  assert.equal(played.phase, 'gameOver');
  const host2 = played.players.find(p => p.id === played.host);
  act(played, host2, { action: 'lobby' });
  assert.equal(played.phase, 'lobby');
  assert.equal(played.players.some(p => p.name === 'P2'), false, 'whoever left is gone');
  assert.equal(late.spectator, false, 'a spectator takes a free seat');
  assert.ok(played.players.every(p => !p.role && !p.ready));
  assert.equal(played.chat.public.length, 0);
  assert.equal(played.result, null);
  assert.equal(guest.spectator, false);
});

test('names are cleaned and text cannot carry control characters', () => {
  const room = createRoom('A', T0);
  assert.throws(() => addPlayer(room, '   ', T0), /Enter a name/);
  assert.equal(addPlayer(room, '  A‮B\n ', T0).name, 'A B');
});
