import { ROLES } from './characters.mjs';

// Reads a public statement and decides whether it is true.
// A statement must be definite, so anything this cannot judge returns null rather than guessing.
const clean = s => String(s).toLowerCase().normalize('NFKC').replace(/[’‘`´]/g, "'").replace(/\bain't\b/g, 'is not').replace(/\bi'm\b/g, 'i am').replace(/n't\b/g, ' not').replace(/(\p{L})'s\b/gu, "$1 's ").replace(/'(?!s\b)/g, '').replace(/[^\p{L}\p{N}' ]+/gu, ' ').trim().split(/\s+/).filter(Boolean);
const ALIASES = { gossip: ['gossiper'], tea_lady: ['tealady'], devils_advocate: ['devils advocate', 'devil advocate'], moonchild: ['moon child'], grandmother: ['grandma', 'granny', 'gran'], godfather: ['god father'] };
const NUMBERS = Object.fromEntries('zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen'.split(' ').map((w, n) => [w, n]));
const BE = new Set(['is', 'are', 'was', 'were', 'am', 'be', "'s"]);
const TRAILING = new Set(['player', 'players', 'person', 'people', 'guy', 'guys', 'team', 'side', 'character', 'role', 'member', 'members']);
const CLASSES = { evil: 'evil', bad: 'evil', good: 'good', townsfolk: 'townsfolk', townsperson: 'townsfolk', townie: 'townsfolk', townies: 'townsfolk', villager: 'townsfolk', villagers: 'townsfolk', outsider: 'outsider', outsiders: 'outsider', minion: 'minion', minions: 'minion', demon: 'demon', demons: 'demon', alive: 'alive', living: 'alive', dead: 'dead', deceased: 'dead', drunk: 'drunk', poisoned: 'poisoned', sober: 'sober', healthy: 'sober' };
const NEIGHBOR = /^neighbou?r(s|ing)?$/;

function tokens(text, g) {
  const words = clean(text), script = g.settings.script;
  const known = [...g.players.map(p => ({ k: 'name', p, words: clean(p.name) })), ...Object.values(ROLES).filter(r => r.script === script).flatMap(r => [r.name, ...(ALIASES[r.id] || [])].map(name => ({ k: 'role', id: r.id, words: clean(name) })))].filter(m => m.words.length).sort((a, b) => b.words.length - a.words.length);
  const out = [];
  for (let i = 0; i < words.length;) {
    const hit = known.find(m => m.words.every((w, j) => words[i + j] === w));
    out.push(hit || { k: 'w', w: words[i] });
    i += hit ? hit.words.length : 1;
  }
  return out;
}

function neighbors(g, p) {
  const seats = g.players, at = seats.indexOf(p), found = [];
  for (const step of [1, -1]) for (let i = 1; i < seats.length; i++) { const x = seats[(at + step * i + seats.length * i) % seats.length]; if (x.alive) { found.push(x); break; } }
  return [...new Set(found)].filter(x => x !== p);
}
function matches(c, p, api) {
  if (c === 'evil') return api.evil(p);
  if (c === 'good') return !api.evil(p);
  if (c === 'alive') return p.alive;
  if (c === 'dead') return !p.alive;
  if (c === 'drunk') return api.impaired(p) && !api.poisoned(p);
  if (c === 'poisoned') return api.poisoned(p);
  if (c === 'sober') return !api.impaired(p);
  return ROLES[p.role].type === c;
}

class Reader {
  constructor(T, g, speaker, api) { Object.assign(this, { T, g, speaker, api }); }
  w(i) { return this.T[i]?.w; }
  word(i, ...options) { return options.includes(this.w(i)); }
  number(i) { const w = this.w(i); return /^\d+$/.test(w || '') ? +w : NUMBERS[w]; }
  isMe(i) { return this.word(i, 'i', 'me', 'myself'); }

  // A character, team or state, such as "the Pukka", "an evil player" or "dead".
  noun(i, determiners = true) {
    if (determiners) { if (this.word(i, 'on')) i++; if (this.word(i, 'a', 'an', 'the', 'any')) i++; }
    const t = this.T[i];
    if (t?.k === 'role') return { test: p => p.role === t.id, end: i + 1 };
    const c = CLASSES[t?.w];
    if (!c) return null;
    let end = i + 1;
    while (TRAILING.has(this.w(end))) end++;
    return { test: p => matches(c, p, this.api), end };
  }
  // "Ana", "me", "Ana, Bo and Cy" or "Ana or Bo", with the connective that joins them.
  names(i) {
    const players = []; let join = 'and';
    for (;;) {
      const t = this.T[i];
      if (t?.k === 'name') players.push(t.p); else if (this.isMe(i)) players.push(this.speaker); else break;
      i++;
      const next = this.T[i + 1];
      if (this.word(i, 'and', 'or', 'nor') && (next?.k === 'name' || this.isMe(i + 1))) { if (this.w(i) !== 'and') join = 'or'; i++; }
    }
    return players.length ? { players, join, end: i } : null;
  }
  // "at least two", "exactly one", "no", "both": how many members must fit.
  quantity(i) {
    const n = this.number(i + (this.word(i, 'at', 'more', 'fewer', 'less') ? (this.word(i + 1, 'least', 'most', 'than') ? 2 : 99) : this.word(i, 'exactly', 'only') ? 1 : 0));
    if (this.word(i, 'at') && this.word(i + 1, 'least') && n !== undefined) return { ok: c => c >= n, end: i + 3 };
    if (this.word(i, 'at') && this.word(i + 1, 'most') && n !== undefined) return { ok: c => c <= n, end: i + 3 };
    if (this.word(i, 'more') && this.word(i + 1, 'than') && n !== undefined) return { ok: c => c > n, end: i + 3 };
    if (this.word(i, 'fewer', 'less') && this.word(i + 1, 'than') && n !== undefined) return { ok: c => c < n, end: i + 3 };
    if (this.word(i, 'exactly', 'only') && n !== undefined) return { ok: c => c === n, end: i + 2 };
    if (this.number(i) !== undefined) return { ok: c => c === n, end: i + 1 };
    return null;
  }
  // The right-hand side: "is evil", "isn't the Fool", "sits next to a Minion", "is in play".
  predicate(i) {
    let neg = false;
    if (BE.has(this.w(i))) i++;
    if (this.word(i, 'not', 'never')) { neg = true; i++; }
    if (this.word(i, 'both', 'all', 'each')) i++;
    if (this.word(i, 'sitting', 'sits', 'seated', 'sat')) i++;
    const flip = (test, end) => ({ test: p => test(p) !== neg, neg, end });
    if (this.word(i, 'in') && (this.word(i + 1, 'play') || (this.word(i + 1, 'the', 'this') && this.word(i + 2, 'game')))) return { inPlay: true, neg, end: i + (this.word(i + 1, 'play') ? 2 : 3) };
    let after = 0;
    if (this.word(i, 'next') && this.word(i + 1, 'to')) after = i + 2;
    else if (this.word(i, 'adjacent') && this.word(i + 1, 'to')) after = i + 2;
    else if (this.word(i, 'beside', 'by')) after = i + 1;
    else if (NEIGHBOR.test(this.w(i) || '')) after = i + (this.word(i + 1, 'of', 'with', 'to') ? 2 : 1);
    if (after) {
      const who = this.names(after);
      if (who) return flip(p => neighbors(this.g, p).some(x => who.players.includes(x)), who.end);
      const kind = this.noun(after);
      return kind && flip(p => neighbors(this.g, p).some(kind.test), kind.end);
    }
    const who = this.names(i);
    if (who && who.players.length === 1) return flip(p => p === who.players[0], who.end);
    const kind = this.noun(i);
    return kind && flip(kind.test, kind.end);
  }
  count(group, test) { return group.filter(test).length; }
  everyone() { return this.g.players; }

  there(i) {
    if (!this.word(i, 'there')) return null;
    i++;
    if (BE.has(this.w(i))) i++;
    let neg = false;
    if (this.word(i, 'not')) { neg = true; i++; }
    let ok = c => c >= 1;
    const q = this.quantity(i);
    if (q) { ok = q.ok; i = q.end; } else if (this.word(i, 'no')) { ok = c => c === 0; i++; } else if (this.word(i, 'a', 'an', 'some', 'any')) i++;
    const kind = this.noun(i, false);
    if (!kind) return null;
    i = kind.end;
    let filter = () => true;
    if (this.word(i, 'in') && this.word(i + 1, 'play')) i += 2;
    else if (this.word(i, 'alive', 'left', 'remaining', 'living')) { filter = p => p.alive; i++; } else if (this.word(i, 'dead')) { filter = p => !p.alive; i++; }
    return { truth: () => ok(this.count(this.everyone(), p => kind.test(p) && filter(p))) !== neg, end: i };
  }
  group(i) {
    if (this.word(i, 'nobody', 'noone') || (this.word(i, 'no') && this.word(i + 1, 'one'))) { i += this.word(i, 'no') ? 2 : 1; const pred = this.predicate(i); return pred?.test && { truth: () => this.count(this.everyone(), pred.test) === 0, end: pred.end }; }
    if (this.word(i, 'everybody', 'everyone', 'all')) { i++; if (this.word(i, 'players', 'of')) i++; const pred = this.predicate(i); return pred?.test && { truth: () => this.everyone().every(pred.test), end: pred.end }; }
    if (this.word(i, 'someone', 'somebody', 'anyone')) { const pred = this.predicate(i + 1); return pred?.test && { truth: () => this.count(this.everyone(), pred.test) >= 1, end: pred.end }; }
    return null;
  }
  // "neither Ana nor Bo", "exactly one of Ana and Bo", "Ana and Bo", "Ana's neighbors".
  people(i) {
    let ok = null;
    if (this.word(i, 'either')) { ok = c => c >= 1; i++; } else if (this.word(i, 'neither', 'none')) { ok = c => c === 0; i++; if (this.word(i, 'of')) i++; } else if (this.word(i, 'both')) { i++; if (this.word(i, 'of')) i++; } else if (this.word(i, 'all') && this.word(i + 1, 'of')) i += 2;
    else {
      const q = this.quantity(i);
      if (q && this.word(q.end, 'of')) { ok = q.ok; i = q.end + 1; }
    }
    const who = this.names(i);
    if (!who) return null;
    const n = who.players.length;
    ok = ok || (who.join === 'or' ? c => c >= 1 : c => c === n);
    i = who.end;
    if (n === 1 && this.w(i) === "'s") {
      const next = this.w(i + 1);
      if (this.word(i + 1, 'character', 'role', 'job', 'identity', 'alignment', 'team')) { const pred = this.predicate(i + 2); return pred?.test && { truth: () => pred.test(who.players[0]), end: pred.end }; }
      if (NEIGHBOR.test(next || '')) return this.around(who.players[0], i + 2);
    }
    if (this.word(i, 'has', 'have')) return n === 1 ? this.has(who.players[0], i + 1) : null;
    const pred = this.predicate(i);
    return pred?.test && { truth: () => ok(this.count(who.players, pred.test)), end: pred.end };
  }
  around(p, i) {
    let ok = (c, n) => c === n && n > 0;
    if (BE.has(this.w(i))) i++;
    if (this.word(i, 'both', 'all')) i++; else if (this.word(i, 'either') || (this.word(i, 'one') && this.word(i + 1, 'of'))) { ok = c => c >= 1; i += this.word(i, 'one') ? 2 : 1; }
    const pred = this.predicate(i);
    return pred?.test && { truth: () => { const near = neighbors(this.g, p); return ok(this.count(near, pred.test), near.length); }, end: pred.end };
  }
  has(p, i) {
    let ok = c => c >= 1;
    const q = this.quantity(i);
    if (q) { ok = q.ok; i = q.end; } else if (this.word(i, 'no')) { ok = c => c === 0; i++; } else if (this.word(i, 'a', 'an')) i++;
    const kind = this.noun(i, false);
    if (!kind || !NEIGHBOR.test(this.w(kind.end) || '')) return null;
    return { truth: () => ok(this.count(neighbors(this.g, p), kind.test)), end: kind.end + 1 };
  }
  // "the Demon is Ana", "a Minion is next to Bo", "two Minions are alive", "the Pukka isn't in play".
  kinds(i) {
    let ok = c => c >= 1, all = false, counted = false;
    if (this.word(i, 'every', 'each', 'all')) { all = true; i++; } else if (this.word(i, 'no')) { ok = c => c === 0; counted = true; i++; } else {
      const q = this.quantity(i);
      if (q) { ok = q.ok; counted = true; i = q.end; } else if (this.word(i, 'the', 'a', 'an', 'some', 'any')) i++;
    }
    const kind = this.word(i, 'players', 'people') ? { test: () => true, end: i + 1 } : this.noun(i, false);
    if (!kind) return null;
    const pred = this.predicate(kind.end);
    if (!pred) return null;
    const members = () => this.everyone().filter(kind.test);
    if (pred.inPlay) return { truth: () => (counted ? ok(members().length) : members().length >= 1) !== pred.neg, end: pred.end };
    return { truth: () => (all ? members().length > 0 && members().every(pred.test) : ok(this.count(members(), pred.test))), end: pred.end };
  }
  clause(from, to) {
    for (const parse of ['there', 'group', 'people', 'kinds']) {
      const claim = this[parse](from);
      if (claim && claim.end === to) return claim;
    }
    return null;
  }
  statement(from, to) {
    if (from >= to) return null;
    const whole = this.clause(from, to);
    if (whole) return whole;
    for (let i = from + 1; i < to - 1; i++) if (this.word(i, 'and', 'but', 'or', 'plus', 'also', 'while')) {
      const left = this.clause(from, i), right = left && this.statement(i + 1, to);
      if (right) return { truth: this.w(i) === 'or' ? () => left.truth() || right.truth() : () => left.truth() && right.truth() };
    }
    return null;
  }
}

// api: { evil(p), impaired(p), poisoned(p) }. Returns { truth, reading } or null if unreadable.
export function readStatement(text, g, speaker, api) {
  const T = tokens(text, g);
  if (!T.length) return null;
  const claim = new Reader(T, g, speaker, api).statement(0, T.length);
  if (!claim) return null;
  return { truth: !!claim.truth(), reading: T.map(t => t.k === 'name' ? t.p.name : t.k === 'role' ? ROLES[t.id].name : t.w).join(' ').replace(/ 's\b/g, "'s") };
}
