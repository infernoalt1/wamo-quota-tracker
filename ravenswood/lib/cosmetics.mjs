// Shop decorations and how points are earned. Shared by the server and the page.
import { ROLES } from './characters.mjs';

// Points for each finished game that counts on the leaderboard. Winning is worth the most.
export const POINTS = Object.freeze({ finish: 5, win: 25, demon: 10, daily: 15 });

export const KINDS = Object.freeze({ frame: 'Frames', color: 'Name colours', title: 'Titles', hand: 'Vote hands', mark: 'Death marks' });
export const TIERS = Object.freeze({ common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', unlock: 'Earned' });

// Achievements that unlock decorations nobody can buy. Each counts matching games in a player's history.
export const UNLOCKS = Object.freeze({
  demon_wins: { goal: 10, text: 'Win 10 games as the Demon', counts: r => r.won && r.demon },
  good_wins: { goal: 25, text: 'Win 25 games on the good team', counts: r => r.won && !r.evil },
  grave_wins: { goal: 5, text: 'Win 5 games after dying', counts: r => r.won && !r.survived },
  saint_win: { goal: 1, text: 'Win a game as the Saint', counts: r => r.won && r.initial_role === 'saint' },
  minion_wins: { goal: 5, text: 'Win 5 games as a Minion', counts: r => r.won && ROLES[r.initial_role]?.type === 'minion' },
  veteran: { goal: 50, text: 'Play 50 games', counts: () => true },
});

export const ITEMS = Object.freeze([
  { id: 'brass', kind: 'frame', name: 'Brass Ring', tier: 'common', price: 120, blurb: 'Polished brass that catches the candlelight.' },
  { id: 'nightshade', kind: 'frame', name: 'Nightshade', tier: 'common', price: 150, blurb: 'A double band in poisoner’s violet.' },
  { id: 'briar', kind: 'frame', name: 'Thorned Briar', tier: 'rare', price: 400, blurb: 'A crown of thorns grown wild around you.' },
  { id: 'candle', kind: 'frame', name: 'Candlelight', tier: 'rare', price: 500, blurb: 'A flickering glow that never quite goes out.' },
  { id: 'moon', kind: 'frame', name: 'Crescent Moon', tier: 'epic', price: 900, blurb: 'Silver moonlight, with a crescent and stars.' },
  { id: 'clock', kind: 'frame', name: 'The Clocktower', tier: 'legendary', price: 1600, blurb: 'A gilded clock face that turns while the town sleeps.' },
  { id: 'demon_crown', kind: 'frame', name: 'Demon’s Crown', tier: 'unlock', unlock: 'demon_wins', blurb: 'Horns and embers for those who have ruled the night.' },
  { id: 'halo', kind: 'frame', name: 'Halo', tier: 'unlock', unlock: 'good_wins', blurb: 'For a true defender of the town.' },
  { id: 'raven', kind: 'frame', name: 'Raven’s Wing', tier: 'rare', chest: true, blurb: 'Black feathers with a blue sheen.' },
  { id: 'frost', kind: 'frame', name: 'Hoarfrost', tier: 'epic', chest: true, blurb: 'A ring of ice that never melts.' },
  { id: 'eclipse', kind: 'frame', name: 'Eclipse', tier: 'legendary', chest: true, blurb: 'A black sun with a burning gold corona.' },

  { id: 'ash', kind: 'color', name: 'Ash', tier: 'common', price: 100, blurb: 'Soft grey, like the morning after a fire.' },
  { id: 'moss', kind: 'color', name: 'Moss', tier: 'common', price: 100, blurb: 'The green of the old churchyard.' },
  { id: 'ember', kind: 'color', name: 'Ember', tier: 'common', price: 150, blurb: 'A warm, glowing orange.' },
  { id: 'violet', kind: 'color', name: 'Royal Violet', tier: 'rare', price: 300, blurb: 'Deep violet, fit for a Mastermind.' },
  { id: 'gilded', kind: 'color', name: 'Gilded', tier: 'rare', price: 500, blurb: 'Your name in burnished gold.' },
  { id: 'moonlit', kind: 'color', name: 'Moonlit', tier: 'epic', price: 900, blurb: 'Silver and blue light that drifts across your name.' },
  { id: 'bloodmoon', kind: 'color', name: 'Blood Moon', tier: 'legendary', price: 1400, blurb: 'A slow crimson shimmer. Everyone will notice.' },
  { id: 'ghostlight', kind: 'color', name: 'Ghostlight', tier: 'unlock', unlock: 'grave_wins', blurb: 'A pale glow for those who win from the grave.' },
  { id: 'bone', kind: 'color', name: 'Bone', tier: 'common', chest: true, blurb: 'Old ivory, dug up from somewhere.' },
  { id: 'verdigris', kind: 'color', name: 'Verdigris', tier: 'rare', chest: true, blurb: 'The green of an old copper bell.' },
  { id: 'aurora', kind: 'color', name: 'Aurora', tier: 'legendary', chest: true, blurb: 'Northern lights rolling across your name.' },

  { id: 'townsfolk', kind: 'title', name: 'Townsfolk at Heart', tier: 'common', price: 100, blurb: 'Honest. Probably.' },
  { id: 'night_owl', kind: 'title', name: 'Night Owl', tier: 'common', price: 100, blurb: 'Always awake when it matters.' },
  { id: 'bluffer', kind: 'title', name: 'Professional Bluffer', tier: 'common', price: 150, blurb: 'Say it with confidence.' },
  { id: 'secrets', kind: 'title', name: 'Keeper of Secrets', tier: 'rare', price: 350, blurb: 'They know more than they say.' },
  { id: 'unconvinced', kind: 'title', name: 'The Unconvinced', tier: 'rare', price: 350, blurb: 'Nobody is above suspicion.' },
  { id: 'whisperer', kind: 'title', name: 'Whisperer of Lies', tier: 'epic', price: 750, blurb: 'Every word is a careful choice.' },
  { id: 'voice', kind: 'title', name: 'Voice of the Clocktower', tier: 'legendary', price: 1300, blurb: 'When they speak, the town listens.' },
  { id: 'saint', kind: 'title', name: 'The Saint', tier: 'unlock', unlock: 'saint_win', blurb: 'Survived the town’s judgement.' },
  { id: 'mastermind', kind: 'title', name: 'Mastermind', tier: 'unlock', unlock: 'minion_wins', blurb: 'The hand behind the Demon.' },
  { id: 'veteran', kind: 'title', name: 'Veteran', tier: 'unlock', unlock: 'veteran', blurb: 'Fifty stories told.' },
  // Vote hands: how your raised hand looks, and the effect when it goes up or is counted. `fx` names a particle effect.
  { id: 'gilded_hand', kind: 'hand', name: 'Gilded Hand', tier: 'common', price: 150, fx: 'sparks', tint: ['#fff1c2', '#f2c35b', '#d99a2b'], blurb: 'A shower of gold sparks with every vote.' },
  { id: 'bone_hand', kind: 'hand', name: 'Bone Hand', tier: 'rare', price: 300, fx: 'dust', tint: ['#fff8e8', '#e9dcc0', '#cfc2a4'], blurb: 'Old ivory, and a little dust.' },
  { id: 'ember_hand', kind: 'hand', name: 'Ember Hand', tier: 'epic', price: 800, fx: 'embers', tint: ['#ffb347', '#ff7a1c', '#ffd27a'], blurb: 'Your vote rises like sparks from a fire.' },
  { id: 'ghost_hand', kind: 'hand', name: 'Ghostly Hand', tier: 'rare', chest: true, fx: 'wisps', tint: ['#bff3ff', '#8fe2ff', '#6fc9ff'], blurb: 'Pale wisps curl up from your fingers.' },
  { id: 'crimson_hand', kind: 'hand', name: 'Crimson Hand', tier: 'legendary', chest: true, fx: 'ink', tint: ['#ff3b4a', '#b5121f', '#ff8a8a'], blurb: 'Every vote leaves a spatter of red.' },
  // Death marks: what plays when you die, and the mark your seat keeps afterwards.
  { id: 'ash_mark', kind: 'mark', name: 'Ashes', tier: 'common', price: 150, fx: 'ash', icon: 'wind', tint: ['#8b8794', '#5d5a63', '#b9b4bf'], blurb: 'You crumble, and drift away on the wind.' },
  { id: 'ink_mark', kind: 'mark', name: 'Ink Splash', tier: 'rare', price: 350, fx: 'ink', icon: 'droplet', tint: ['#2a0b12', '#4d0f1c', '#7a1a2a'], blurb: 'A dark spatter across the town records.' },
  { id: 'candle_mark', kind: 'mark', name: 'Snuffed Candle', tier: 'epic', price: 850, fx: 'smoke', icon: 'flame', tint: ['#a7a2ad', '#6f6a75'], blurb: 'A thin trail of smoke where a light used to be.' },
  { id: 'raven_mark', kind: 'mark', name: 'The Raven', tier: 'legendary', price: 1500, fx: 'feathers', icon: 'bird', tint: ['#14161e', '#242a3c', '#0c0d12'], blurb: 'Black feathers scatter as the raven takes you.' },
  { id: 'ember_mark', kind: 'mark', name: 'Last Embers', tier: 'rare', chest: true, fx: 'embers', icon: 'sparkles', tint: ['#ffb347', '#ff7a1c'], blurb: 'A final glow, rising into the dark.' },
  { id: 'wisp_mark', kind: 'mark', name: 'Departing Wisp', tier: 'epic', chest: true, fx: 'wisps', icon: 'ghost', tint: ['#c8f3ff', '#9fe0ff'], blurb: 'Your spirit lifts gently from the table.' },
  { id: 'collector', kind: 'title', name: 'The Collector', tier: 'common', chest: true, blurb: 'Keeps everything. Just in case.' },
  { id: 'high_roller', kind: 'title', name: 'High Roller', tier: 'rare', chest: true, blurb: 'Bets it all, every time.' },
  { id: 'fortune', kind: 'title', name: 'Fortune’s Favourite', tier: 'epic', chest: true, blurb: 'The dice always seem to land their way.' },
]);
export const ITEM = Object.freeze(Object.fromEntries(ITEMS.map(i => [i.id, i])));

// Mystery chests: a random decoration from everything in the shop plus the chest-only items (never the earned ones).
// The tier is drawn first with these odds, then an item within it. A duplicate refunds part of the price.
export const CHEST = Object.freeze({ price: 250, refund: 100, odds: Object.freeze({ common: 55, rare: 30, epic: 11, legendary: 4 }) });
export const CHEST_ITEMS = Object.freeze(ITEMS.filter(i => i.price || i.chest));
export function rollChest(random = Math.random) {
  const tiers = Object.entries(CHEST.odds), total = tiers.reduce((n, [, w]) => n + w, 0);
  let r = random() * total, tier = tiers[0][0];
  for (const [t, w] of tiers) { if (r < w) { tier = t; break; } r -= w; }
  const pool = CHEST_ITEMS.filter(i => i.tier === tier);
  return pool[Math.floor(random() * pool.length)].id;
}
// Gifting points: small amounts, a daily cap, and only to someone you have played a recorded game with,
// so a second account cannot simply funnel points to a main one.
export const GIFT = Object.freeze({ min: 10, max: 100, daily: 100, minGames: 5 });
// Spectator bets on which team wins: a right call pays back double the stake.
export const BET = Object.freeze({ min: 10, max: 100 });

// Only real items of the right kind survive, so a removed item simply disappears.
export function lookOf(raw) {
  const look = {};
  for (const kind of Object.keys(KINDS)) if (ITEM[raw?.[kind]]?.kind === kind) look[kind] = raw[kind];
  return Object.keys(look).length ? look : null;
}
export function progressOf(rows) {
  return Object.fromEntries(Object.entries(UNLOCKS).map(([id, u]) => [id, Math.min(u.goal, rows.filter(u.counts).length)]));
}
export const unlocked = (item, progress) => !!item.unlock && progress[item.unlock] >= UNLOCKS[item.unlock].goal;
