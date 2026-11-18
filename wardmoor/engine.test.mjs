import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, removePlayer, setInput, respawn, step, viewFor, drainEvents, TOOLS, ARMORS, DT, bounty } from './engine.mjs';

const world = () => createWorld(7, { bots: false });
const clearMonsters = w => { for (const e of [...w.ents.values()]) if (e.kind !== 'player') w.ents.delete(e.id); };
function duel(w) {
  clearMonsters(w);
  const a = addPlayer(w, { name: 'A' }), b = addPlayer(w, { name: 'B' });
  Object.assign(a, { x: 1000, y: 200, shield: 0, angle: 0 });
  Object.assign(b, { x: 1090, y: 200, shield: 0, angle: Math.PI });
  w.obstacles.length = 0;
  return [a, b];
}
function swing(w, a) {
  setInput(w, a, { f: true }); for (let i = 0; i < 6; i++) step(w); setInput(w, a, { f: false });
}

test('a pike thrust wounds a hostile player in reach', () => {
  const w = world(), [a, b] = duel(w);
  swing(w, a);
  assert.equal(b.hp, 100 - TOOLS[0].dmg);
});

test('a raised buckler reduces frontal damage but not attacks from behind', () => {
  const w = world(), [a, b] = duel(w);
  b.tool = 1; setInput(w, b, { f: true, a: Math.PI }); step(w);
  swing(w, a);
  assert.ok(b.hp > 100 - TOOLS[0].dmg * 0.25, `front hp ${b.hp}`);
  const w2 = world(), [c, d] = duel(w2);
  d.tool = 1; setInput(w2, d, { f: true, a: 0 }); step(w2);
  swing(w2, c);
  assert.equal(d.hp, 100 - TOOLS[0].dmg);
});

test('armor reduces damage', () => {
  const w = world(), [a, b] = duel(w);
  b.armor = 3;
  swing(w, a);
  assert.equal(b.hp, 100 - TOOLS[0].dmg * (1 - ARMORS[3].dr));
});

test('warband members cannot hurt each other', () => {
  const w = world(); clearMonsters(w); w.obstacles.length = 0;
  const a = addPlayer(w, { name: 'A', band: 'Crows' }), b = addPlayer(w, { name: 'B', band: 'crows' });
  Object.assign(a, { x: 1000, y: 200, shield: 0, angle: 0 }); Object.assign(b, { x: 1090, y: 200, shield: 0 });
  swing(w, a);
  assert.equal(b.hp, 100);
});

test('warbands are capped at ten', () => {
  const w = world();
  for (let i = 0; i < 10; i++) addPlayer(w, { name: 'P' + i, band: 'Crows' });
  assert.throws(() => addPlayer(w, { name: 'X', band: 'CROWS' }), /full/);
});

test('killing a player pays their bounty and costs them renown', () => {
  const w = world(), [a, b] = duel(w);
  b.renown = 400; b.hp = 1;
  const expected = bounty(b);
  swing(w, a);
  assert.equal(b.dead, true);
  assert.equal(a.renown, expected);
  assert.equal(b.renown, 240);
});

test('locked tools and armor cannot be selected', () => {
  const w = world(), [a] = duel(w);
  setInput(w, a, { tool: 5, armor: 3 });
  assert.equal(a.tool, 0); assert.equal(a.armor, 0);
  a.renown = 500;
  setInput(w, a, { tool: 5, armor: 3 });
  assert.equal(a.tool, 5); assert.equal(a.armor, 3);
});

test('malformed input is ignored', () => {
  const w = world(), [a] = duel(w), before = a.angle;
  setInput(w, a, { mx: NaN, my: 'x', a: Infinity, tool: 99, armor: -1, f: 'yes' });
  assert.equal(a.angle, before); assert.equal(a.tool, 0); assert.equal(a.input.fire, false);
});

test('standing alone at a stone captures the region, and it pays bonus renown', () => {
  const w = world(); clearMonsters(w);
  const a = addPlayer(w, { name: 'A' }), r = w.regions[0];
  Object.assign(a, { x: r.x, y: r.y, shield: 0 });
  for (let i = 0; i < 12 / DT + 2; i++) { step(w); clearMonsters(w); }
  assert.equal(r.owner, a.team);
  assert.equal(a.renown, 40);
  assert.ok(drainEvents(w).some(e => e.k === 'capture'));
});

test('a rival at the stone pauses the capture', () => {
  const w = world(); clearMonsters(w);
  const a = addPlayer(w, { name: 'A' }), b = addPlayer(w, { name: 'B' }), r = w.regions[0];
  Object.assign(a, { x: r.x, y: r.y }); Object.assign(b, { x: r.x + 30, y: r.y });
  for (let i = 0; i < 40; i++) { step(w); clearMonsters(w); }
  assert.equal(r.progress, 0);
});

test('a region is released when its last owner leaves', () => {
  const w = world(), a = addPlayer(w, { name: 'A' }), r = w.regions[0];
  r.owner = a.team; r.ownerName = 'A';
  removePlayer(w, a);
  assert.equal(r.owner, null);
});

test('respawn waits, then restores the player and drops tools they lost', () => {
  const w = world(), [a, b] = duel(w);
  b.renown = 90; b.tool = 3; b.hp = 1;
  swing(w, a);
  assert.equal(respawn(w, b), false);
  for (let i = 0; i < 2 / DT + 1; i++) step(w);
  assert.equal(respawn(w, b), true);
  assert.equal(b.hp, 100); assert.equal(b.dead, false); assert.equal(b.renown, 54); assert.equal(b.tool, 0);
});

test('the view only contains nearby entities and survives a long bot match', () => {
  const w = createWorld(3), p = addPlayer(w, { name: 'Me' });
  for (let i = 0; i < 20 * 120; i++) step(w);
  const v = viewFor(w, p, drainEvents(w));
  assert.ok(v.e.every(e => Math.abs(e[2] - p.x) <= 1050 && Math.abs(e[3] - p.y) <= 1050));
  assert.equal(v.r.length, 9);
  for (const e of w.ents.values()) assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y) && Number.isFinite(e.hp));
  assert.ok(w.regions.some(r => r.owner), 'bots captured at least one region');
});
