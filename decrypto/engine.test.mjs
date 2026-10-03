import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, addPlayer, act, snapshot, setPresence } from './engine.mjs';

function fixture() {
  const r = createRoom('ABCDEF');
  const p = ['Alice', 'Bob', 'Carol', 'Dave'].map(name => addPlayer(r, name));
  act(r, p[0], { action: 'start' });
  return { r, p, player: id => p.find(x => x.id === id) };
}
test('custom word lists validate, deal unique entries, stay private, and survive rematches', () => {
  const r = createRoom('CUSTOM'), p = ['A', 'B', 'C', 'D'].map(n => addPlayer(r, n));
  const text = 'Ice cream, Space station; café\nDragon\nRiver\nFire\nWind\nEarth\nICE CREAM';
  assert.throws(() => act(r, p[1], { action: 'word-list', mode: 'custom', text }), /host/);
  for (const invalid of ['a,b,c', 'a,A,b,B,c,C,d,D', 'x'.repeat(6001), 'a,b,c,d,e,f,g,<script>', Array.from({length:101}, (_,i) => `word ${i}`).join(',')]) {
    assert.throws(() => act(r, p[0], { action: 'word-list', mode: 'custom', text: invalid }));
    assert.equal(r.wordList.mode, 'classic');
  }
  act(r, p[0], { action: 'word-list', mode: 'custom', text });
  assert.equal(r.wordList.custom.length, 8);
  assert.equal(snapshot(r, p[0]).wordList.custom.length, 8);
  assert.equal(snapshot(r, p[1]).wordList.custom, undefined);
  act(r, p[0], { action: 'start' });
  const dealt = [...r.teams.blue.words, ...r.teams.amber.words];
  assert.equal(new Set(dealt).size, 8); assert(dealt.every(w => r.wordList.custom.includes(w)));
  assert.equal(snapshot(r, p[0]).wordList.custom, undefined);
  assert.throws(() => act(r, p[0], { action: 'word-list', mode: 'classic' }), /lobby/);
  const team = r.teams.blue.words.includes('ice cream') ? 'blue' : 'amber';
  const encoder = p.find(x => x.id === r.teams[team].encoder);
  assert.throws(() => act(r, encoder, { action: 'clues', clues: ['An ice-cream shop', 'unrelated clue', 'another clue'] }), /secret words/);
  act(r, p[0], { action: 'lobby' }); assert.equal(r.wordList.mode, 'custom');
  act(r, p[0], { action: 'start' }); assert([...r.teams.blue.words, ...r.teams.amber.words].every(w => r.wordList.custom.includes(w)));
  act(r, p[0], { action: 'lobby' }); act(r, p[0], { action: 'word-list', mode: 'classic' });
  assert.equal(r.wordList.mode, 'classic'); assert.equal(r.wordList.custom.length, 8);
});
function clues(r, player) {
  for (const team of ['blue', 'amber']) act(r, player(r.teams[team].encoder), { action: 'clues', clues: [1, 2, 3].map(n => `${team} association ${r.round}-${n}`) });
}
function answer(r, player, team, own = true, correct = true) {
  const target = r.teams[team], side = own ? team : team === 'blue' ? 'amber' : 'blue';
  const p = r.players.find(p => p.team === side && (!own || p.id !== target.encoder));
  const code = [...target.code]; if (!correct) [code[0], code[1]] = [code[1], code[0]];
  act(r, player(p.id), { action: 'guess', target: team, round: r.round, code });
}
function round(r, player, intercept = false) {
  clues(r, player);
  for (const team of ['blue', 'amber']) {
    answer(r, player, team);
    if (r.round > 1) answer(r, player, team, false, intercept);
  }
}
test('lobby team switching, capacity, spectators, role and host permissions', () => {
  const r = createRoom('ABCDEF'), a = addPlayer(r, 'Alice'), b = addPlayer(r, 'Bob');
  assert.throws(() => act(r, a, { action: 'start' }), /two connected/);
  act(r, a, { action: 'team', team: 'amber' }); assert.equal(a.team, 'amber');
  act(r, a, { action: 'team', team: null }); assert.equal(a.team, null);
  assert.throws(() => act(r, b, { action: 'start' }), /host/);
  assert.throws(() => act(r, b, { action: 'team', team: 'fake' }), /valid team/);
  act(r, a, { action: 'team', team: 'blue' });
  for (let i = 0; i < 3; i++) { const p = addPlayer(r, `Extra${i}`); act(r, p, { action: 'team', team: 'blue' }); }
  assert.throws(() => act(r, b, { action: 'team', team: 'blue' }), /four/);
  setPresence(r, a, false); assert.equal(r.host, b.id);
});
test('personalized snapshots never expose opposing words, unrevealed codes or pending answers', () => {
  const { r, p, player } = fixture();
  const observer = addPlayer(r, 'Observer'); assert.equal(observer.team, null);
  const view = snapshot(r, p[2]);
  assert.equal(view.teams.blue.words.length, 4); assert.deepEqual(view.teams.amber.words, []);
  assert.equal(view.teams.blue.code, null); assert.equal(view.teams.amber.code, null);
  assert.equal(snapshot(r, p[0]).teams.blue.code.length, 3);
  assert.deepEqual(snapshot(r, observer).teams.blue.words, []);
  assert(!JSON.stringify(view).includes(p[0].token));
  assert.throws(() => act(r, p[0], { action: 'team', team: 'amber' }), /lobby/);
  clues(r, player);
  assert.equal(snapshot(r, p[2]).teams.amber.clues, null);
  assert.throws(() => answer(r, player, 'blue', false), /round two/);
  assert.throws(() => act(r, p[0], { action: 'guess', target: 'blue', round: 1, code: r.teams.blue.code }), /Encryptors/);
  answer(r, player, 'blue'); assert.equal(r.target, 'amber'); assert.deepEqual(snapshot(r, observer).teams.blue.code, r.teams.blue.code);
  answer(r, player, 'amber'); act(r, p[0], { action: 'next' }); clues(r, player);
  answer(r, player, 'blue');
  assert.equal(snapshot(r, p[1]).teams.blue.decode, null);
  assert.equal(snapshot(r, p[1]).teams.blue.code, null);
  assert.throws(() => answer(r, player, 'blue'), /already locked/);
  answer(r, player, 'blue', false); assert.equal(r.teams.amber.interceptions, 1);
  assert.throws(() => act(r, p[0], { action: 'guess', target: 'blue', round: 2, code: [1, 2, 3] }), /moved on/);
});
test('clues validate length, uniqueness and keywords; chat respects privacy and encryptor silence', () => {
  const { r, p } = fixture();
  for (const clues of [[], ['a', 'b', ''], ['same', 'Same', 'third'], [r.teams.blue.words[0], 'alpha clue', 'beta clue']]) assert.throws(() => act(r, p[0], { action: 'clues', clues }));
  assert.throws(() => act(r, p[2], { action: 'clues', clues: ['one', 'two', 'three'] }), /encryptor/);
  assert.throws(() => act(r, p[0], { action: 'chat', channel: 'team', text: 'hint' }), /silent/);
  act(r, p[2], { action: 'chat', channel: 'team', text: 'private discussion' });
  assert.equal(snapshot(r, p[1]).chat.length, 0); assert.equal(snapshot(r, p[0]).chat.length, 1);
  act(r, p[2], { action: 'chat', channel: 'room', text: 'hello everyone' }); assert.equal(snapshot(r, p[1]).chat.length, 1);
  act(r, p[0], { action: 'clues', clues: ['first clue', 'second clue', 'third clue'] });
  assert.throws(() => act(r, p[0], { action: 'clues', clues: ['a', 'b', 'c'] }), /once/);
  assert.throws(() => act(r, p[1], { action: 'clues', clues: ['FIRST CLUE', 'new clue', 'another clue'] }), /new/);
});
test('miscommunications end games only after both transmissions and lobby resets secrets', () => {
  const { r, p, player } = fixture();
  for (let i = 1; i <= 2; i++) {
    clues(r, player); answer(r, player, 'blue', true, false);
    if (i > 1) answer(r, player, 'blue', false, false);
    assert.equal(r.phase, 'guess');
    answer(r, player, 'amber'); if (i > 1) answer(r, player, 'amber', false, false);
    if (i === 1) { assert.equal(r.phase, 'round_end'); act(r, p[0], { action: 'next' }); }
  }
  assert.equal(r.phase, 'finished'); assert.equal(r.winner, 'amber');
  assert.equal(snapshot(r, p[0]).teams.amber.words.length, 4);
  act(r, p[0], { action: 'lobby' }); assert.equal(r.phase, 'lobby'); assert.equal(r.history.length, 0);
  assert.deepEqual(snapshot(r, p[0]).teams.blue.words, []);
  act(r, p[0], { action: 'team', team: 'amber' }); act(r, p[1], { action: 'team', team: 'blue' }); act(r, p[0], { action: 'start' }); assert.equal(r.round, 1);
});
test('eight rounds rotate encryptors and finish with sealed keyword tiebreaks', () => {
  const { r, p, player } = fixture();
  for (let i = 1; i <= 8; i++) {
    assert.equal(r.teams.blue.encoder, i % 2 ? p[0].id : p[2].id);
    round(r, player);
    if (i < 8) act(r, p[0], { action: 'next' });
  }
  assert.equal(r.phase, 'tiebreak');
  act(r, p[0], { action: 'tiebreak', words: r.teams.amber.words.map(w => w.toUpperCase()) });
  assert.equal(snapshot(r, p[1]).tieGuesses, undefined); assert.equal(r.phase, 'tiebreak');
  act(r, p[1], { action: 'tiebreak', words: ['wrong', 'wrong', 'wrong', 'wrong'] });
  assert.equal(r.phase, 'finished'); assert.equal(r.winner, 'blue');
});
test('simultaneous second interceptions use keyword tiebreak and permit a shared win', () => {
  const { r, p, player } = fixture();
  round(r, player);
  for (let i = 2; i <= 3; i++) { act(r, p[0], { action: 'next' }); round(r, player, true); }
  assert.equal(r.phase, 'tiebreak');
  act(r, p[0], { action: 'tiebreak', words: r.teams.amber.words });
  act(r, p[1], { action: 'tiebreak', words: r.teams.blue.words });
  assert.equal(r.winner, 'draw');
});
test('simultaneous thresholds compare net scores before keyword tiebreak', () => {
  const { r, player } = fixture();
  r.round = 2; r.teams.blue.interceptions = 1; r.teams.blue.misses = 1;
  clues(r, player); answer(r, player, 'blue', true, false); answer(r, player, 'blue', false, false);
  answer(r, player, 'amber', true, false); answer(r, player, 'amber', false, true);
  assert.equal(r.phase, 'finished'); assert.equal(r.winner, 'blue');
});

test('two interceptions win without ending early; malformed and spectator guesses fail', () => {
  const { r, p, player } = fixture();
  const spectator = addPlayer(r, 'Spectator');
  round(r, player);
  for (let i = 2; i <= 3; i++) {
    act(r, p[0], { action: 'next' }); clues(r, player);
    assert.throws(() => act(r, spectator, { action: 'guess', target: 'blue', round: i, code: [1, 2, 3] }));
    const decoder = r.players.find(q => q.team === 'blue' && q.id !== r.teams.blue.encoder);
    for (const code of [[1, 1, 2], [0, 1, 2], ['1', 2, 3], [1, 2], [1, 2, 5]]) assert.throws(() => act(r, decoder, { action: 'guess', target: 'blue', round: i, code }), /different digits/);
    answer(r, player, 'blue'); answer(r, player, 'blue', false, true);
    assert.equal(r.phase, 'guess');
    answer(r, player, 'amber'); answer(r, player, 'amber', false, false);
  }
  assert.equal(r.phase, 'finished'); assert.equal(r.winner, 'amber');
});
