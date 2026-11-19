// Hanbin Island builds: weapons, talent trees and weapon mastery trees.
// You fight mostly with your weapon (hold the mouse to attack). Talents and mastery shape how those
// attacks behave; a handful of abilities with real cooldowns sit on top.

// ------------------------------------------------------------------ weapons
// type: melee (arc) | thrust (line) | shot (arrow) | bolt (bursting magic). every = ms between attacks.
export const WEAPONS = {
  sword: { name: 'Longsword', icon: '⚔️', type: 'melee', every: 430, dmg: 20, range: 84, arc: 1.9, desc: 'Sword and shield. Balanced swings; every third swing is a wide, heavy cleave that knocks foes back.' },
  greataxe: { name: 'Greataxe', icon: '🪓', type: 'melee', every: 820, dmg: 48, range: 100, arc: 2.7, knock: 40, desc: 'Slow, crushing arcs that hit everything in front of you and shove foes back.' },
  daggers: { name: 'Twin Daggers', icon: '🗡️', type: 'melee', every: 250, dmg: 10, range: 62, arc: 1.4, crit: 0.1, back: 0.3, desc: 'Very fast stabs with 10% base critical chance. Strikes on foes that are not facing you (or are stunned) deal +30%.' },
  spear: { name: 'War Spear', icon: '🔱', type: 'thrust', every: 580, dmg: 27, range: 150, width: 24, desc: 'Long thrusts that pierce every foe in a line. Keep enemies at the tip.' },
  bow: { name: 'Longbow', icon: '🏹', type: 'shot', every: 620, dmg: 19, speed: 720, life: 0.85, desc: 'Arrows from long range. Fragile up close.' },
  staff: { name: 'Runestaff', icon: '🪄', type: 'bolt', every: 740, dmg: 20, speed: 520, life: 0.95, aoe: 55, splash: 0.5, desc: 'Arcane bolts that burst on impact, splashing half their damage onto foes nearby.' },
};
export const WEAPON_IDS = Object.keys(WEAPONS);
export const DEFAULT_WSET = ['sword', 'bow'];

// Mastery: soma you earn while wielding a weapon also trains it. Each mastery level is a point for
// that weapon's tree. Level 1 takes 40 soma, level 10 about 1,330, level 20 about 13,700.
export const MAX_MASTERY = 20;
export const masteryXp = (L) => (L <= 0 ? 0 : Math.round((40 * (1.25 ** L - 1)) / 0.25));
export function masteryOf(xp) {
  let L = 0;
  while (L < MAX_MASTERY && masteryXp(L + 1) <= xp) L++;
  return L;
}
// The blacksmith in the Haven forges weapons with banked gold: +6% weapon damage per level.
export const FORGE_MAX = 10, FORGE_BONUS = 0.06;
export const forgeCost = (lv) => 80 * lv * lv; // cost to reach level lv
export const HOTBAR_SLOTS = 6;
export const ROLL_CD = 3500, ROLL_DIST = 150, ROLL_MS = 260;
export const PVP_MUL = 0.7; // players hit other players for 70%

// ------------------------------------------------------------------ trees
export const TREES = [
  { id: 'warfare', name: 'Warfare', color: '#e0584f', blurb: 'Melee power: wider swings, lifesteal, stuns, and a berserker finish.' },
  { id: 'precision', name: 'Precision', color: '#6fbf5a', blurb: 'Ranged damage and critical strikes: split shots, piercing, traps and marks.' },
  { id: 'arcana', name: 'Arcana', color: '#a56ae0', blurb: 'Elements and energy: burns, chills, static, and the big spells.' },
  { id: 'command', name: 'Command', color: '#e0b84f', blurb: 'Lead the field: summons, auras and war banners.' },
  { id: 'finesse', name: 'Finesse', color: '#4fc3e0', blurb: 'Footwork and defence: dodging, evasion, parries and vanishing.' },
  ...WEAPON_IDS.map((w) => ({ id: 'w_' + w, weapon: w, name: WEAPONS[w].name, color: '#d8c8a0', blurb: `${WEAPONS[w].desc} Mastery points come from soma earned while wielding it; its talents only work while it is in your hands.` })),
];
export const TREE = Object.fromEntries(TREES.map((t) => [t.id, t]));

// N(id, name, tree, icon, [col, row], options)
//   max: ranks · req: parent talent · lvl: soma tier (or mastery for weapon trees) needed
//   mods: stats added per rank · active: { cd, en } for abilities · excl: a talent it cannot be combined with
// Row r of a tree also needs 2×r points already spent in that tree.
const N = (id, name, tree, icon, at, o) => ({ id, name, tree, icon, at, max: 1, req: null, lvl: 0, mods: null, active: null, excl: null, weapon: TREE[tree].weapon || null, ...o });
const A = (cd, en) => ({ cd, en });
export const TALENT_LIST = [
  // ---- Warfare
  N('brutality', 'Brutality', 'warfare', '💪', [1, 0], { max: 3, mods: { melee: 0.05 }, desc: 'Melee hits deal +5% damage per rank.' }),
  N('wide_swings', 'Wide Swings', 'warfare', '🌙', [0, 1], { max: 2, req: 'brutality', mods: { arc: 0.12, reach: 0.06 }, desc: 'Melee swings are 12% wider and reach 6% farther per rank.' }),
  N('bloodlust', 'Bloodlust', 'warfare', '🩸', [2, 1], { max: 3, req: 'brutality', mods: { lifesteal: 0.015 }, desc: 'Melee hits heal you for 1.5% of the damage per rank.' }),
  N('concussion', 'Concussion', 'warfare', '💫', [0, 2], { req: 'wide_swings', mods: { concuss: 1 }, desc: 'Every 5th melee hit stuns its target for 0.6s. Melee hits on stunned foes Crush for +35%.' }),
  N('war_cry', 'War Cry', 'warfare', '😤', [1, 2], { req: 'brutality', active: A(16000, 25), desc: 'Foes within 220 are Exposed for 5s (they take 15% more and deal 40% less), and you attack 25% faster for 6s.' }),
  N('juggernaut', 'Juggernaut', 'warfare', '🛡️', [2, 2], { max: 3, req: 'bloodlust', mods: { maxhp: 0.06 }, desc: '+6% max health per rank.' }),
  N('rampage', 'Rampage', 'warfare', '🔥', [0, 3], { max: 2, req: 'concussion', mods: { rampage: 0.08 }, desc: 'Kills make you attack 8% faster per rank for 5s, stacking 3 times.' }),
  N('leap_slam', 'Leap Slam', 'warfare', '🦘', [1, 3], { req: 'war_cry', active: A(12000, 30), desc: 'Leap up to 280 toward the cursor and slam down: 50 damage and a 40% slow to foes within 120.' }),
  N('unbreakable', 'Unbreakable', 'warfare', '🪨', [2, 3], { max: 2, req: 'juggernaut', mods: { dr: 0.04 }, desc: 'Take 4% less damage per rank.' }),
  N('executioner', 'Executioner', 'warfare', '⚰️', [0, 4], { max: 2, req: 'rampage', mods: { execute: 0.15 }, desc: '+15% damage per rank to foes under 35% health.' }),
  N('berserker', 'Berserker', 'warfare', '👹', [1, 4], { lvl: 12, req: 'leap_slam', mods: { berserk: 1 }, desc: 'Below half health you attack 30% faster and your lifesteal is doubled.' }),
  N('iron_will', 'Iron Will', 'warfare', '🧱', [2, 4], { req: 'unbreakable', mods: { ccr: 0.5 }, desc: 'Stuns and slows on you last half as long.' }),

  // ---- Precision
  N('steady_aim', 'Steady Aim', 'precision', '🎯', [1, 0], { max: 3, mods: { ranged: 0.05 }, desc: 'Ranged hits deal +5% damage per rank.' }),
  N('keen_eye', 'Keen Eye', 'precision', '👁️', [0, 1], { max: 3, req: 'steady_aim', mods: { crit: 0.03 }, desc: '+3% critical strike chance per rank, with every attack.' }),
  N('quickdraw', 'Quickdraw', 'precision', '⚡', [2, 1], { max: 3, req: 'steady_aim', mods: { raspd: 0.05 }, desc: 'Bow and staff attacks are 5% faster per rank.' }),
  N('deadly', 'Deadly Strikes', 'precision', '☠️', [0, 2], { max: 2, req: 'keen_eye', mods: { critDmg: 0.25 }, desc: 'Critical strikes deal +25% more damage per rank (normally 175%).' }),
  N('snare_trap', 'Snare Trap', 'precision', '🪤', [1, 2], { req: 'steady_aim', active: A(14000, 20), desc: 'Hidden trap that roots the first foe for 2.2s. Ranged hits deal double to rooted foes (Pinned).' }),
  N('split_shot', 'Split Shot', 'precision', '🔱', [2, 2], { req: 'quickdraw', mods: { split: 1 }, desc: 'Basic ranged attacks fire 2 extra projectiles at 35% damage.' }),
  N('hunters_mark', "Hunter's Mark", 'precision', '🎯', [0, 3], { req: 'deadly', mods: { huntMark: 1 }, desc: 'Critical strikes Mark the foe for 4s: your side deals +20% damage to it.' }),
  N('volley', 'Volley', 'precision', '🌠', [1, 3], { req: 'snare_trap', active: A(12000, 30), desc: 'Loose a fan of 7 arrows, 18 damage each.' }),
  N('piercing', 'Piercing', 'precision', '📌', [2, 3], { max: 2, req: 'split_shot', mods: { pierce: 1 }, desc: 'Projectiles pass through 1 more foe per rank.' }),
  N('assassin', 'Assassin', 'precision', '🥷', [0, 4], { lvl: 12, req: 'hunters_mark', mods: { assassin: 1 }, desc: 'Hits on foes above 90% health are always critical.' }),
  N('rain_of_arrows', 'Rain of Arrows', 'precision', '🌧️', [1, 4], { lvl: 10, req: 'volley', active: A(22000, 45), desc: 'Arrows pour onto the target area for 2s.' }),
  N('far_sight', 'Far Sight', 'precision', '🔭', [2, 4], { max: 2, req: 'piercing', mods: { far: 0.08, range: 0.12 }, desc: 'Projectiles fly 12% farther and deal +8% per rank to foes over 300 away.' }),

  // ---- Arcana
  N('attunement', 'Attunement', 'arcana', '✨', [1, 0], { max: 3, mods: { elem: 0.06 }, desc: 'Elemental damage +6% per rank: fire, frost, lightning, poison, burns, explosions and staff bolts.' }),
  N('kindling', 'Kindling', 'arcana', '🕯️', [0, 1], { max: 3, req: 'attunement', mods: { burnCh: 0.06 }, desc: 'Hits have a 6% chance per rank to set foes ablaze for 40% of the hit over 3s.' }),
  N('frostbite', 'Frostbite', 'arcana', '🥶', [2, 1], { max: 2, req: 'attunement', mods: { chillCh: 0.06 }, desc: 'Hits have a 6% chance per rank to Chill: a 35% slow for 2.5s. Fire on a chilled foe Shatters.' }),
  N('fireball', 'Fireball', 'arcana', '🔥', [0, 2], { req: 'kindling', active: A(8000, 25), desc: 'Hurl a fireball: 40 damage and a burst around the target. Shatters chilled foes and Ignites poisoned ones.' }),
  N('mana_flow', 'Mana Flow', 'arcana', '💧', [1, 2], { max: 2, req: 'attunement', mods: { enHit: 1, enRegen: 0.15 }, desc: 'Weapon hits restore 1 more energy per rank, and energy regenerates 15% faster per rank.' }),
  N('frost_nova', 'Frost Nova', 'arcana', '❄️', [2, 2], { req: 'frostbite', active: A(14000, 30), desc: 'Burst of frost: 30 damage, then slows and Chills foes within 170.' }),
  N('poison_flask', 'Poison Flask', 'arcana', '☠️', [0, 3], { req: 'fireball', active: A(12000, 25), desc: 'Throw a flask that leaves a poison cloud for 6s. Fire on poisoned foes Ignites.' }),
  N('static_charge', 'Static Charge', 'arcana', '⚡', [1, 3], { max: 2, req: 'mana_flow', mods: { static: 1 }, desc: 'Every 6th hit (every 5th at rank 2) arcs lightning to 3 nearby foes for 60% of the hit.' }),
  N('healing_draught', 'Healing Draught', 'arcana', '🧪', [2, 3], { req: 'frost_nova', active: A(16000, 25), desc: 'Heal yourself for 70 and allies nearby for 40.' }),
  N('meteor', 'Meteor', 'arcana', '☄️', [0, 4], { lvl: 10, req: 'poison_flask', active: A(28000, 60), desc: 'Call down a meteor on the target area: 180 damage and a stun.' }),
  N('conflux', 'Conflux', 'arcana', '🌀', [1, 4], { lvl: 12, req: 'static_charge', mods: { conflux: 0.25 }, desc: '+25% elemental damage to foes that are burning, chilled or poisoned.' }),
  N('overflow', 'Overflow', 'arcana', '🔮', [2, 4], { req: 'healing_draught', mods: { overflow: 0.15 }, desc: 'While your energy is full, your hits deal +15% damage. Pairs well with Mana Flow.' }),

  // ---- Command
  N('rally', 'Rally', 'command', '📯', [1, 0], { active: A(25000, 30), desc: 'You and allies within 320: +30% damage and +20% speed for 8s.' }),
  N('summon_footmen', 'Summon Footmen', 'command', '🪖', [0, 1], { req: 'rally', active: A(30000, 35), desc: 'Call two footmen to fight beside you for 45s.' }),
  N('leadership', 'Leadership', 'command', '🎖️', [2, 1], { max: 3, req: 'rally', mods: { lead: 0.03 }, desc: 'Allies within 300 of you, players and summons alike, deal +3% damage per rank.' }),
  N('drill_sergeant', 'Drill Sergeant', 'command', '📣', [0, 2], { max: 3, req: 'summon_footmen', mods: { summon: 0.12 }, desc: 'Your summons have +12% health and damage per rank.' }),
  N('war_banner', 'War Banner', 'command', '🚩', [1, 2], { req: 'rally', active: A(35000, 35), desc: 'Plant a banner for 12s that heals and Rallies allies near it.' }),
  N('tactician', 'Tactician', 'command', '♟️', [2, 2], { max: 2, req: 'leadership', mods: { tactic: 0.03 }, desc: 'You deal +3% damage per rank for each ally within 300 (up to 4), summons included.' }),
  N('summon_archers', 'Summon Archers', 'command', '🏹', [0, 3], { req: 'drill_sergeant', active: A(40000, 45), desc: 'Call three archers for 50s.' }),
  N('battle_standard', 'Battle Standard', 'command', '🏳️', [1, 3], { req: 'war_banner', mods: { standard: 1 }, desc: 'Your War Banner stands for 20s instead of 12s, and its aura reaches 300 instead of 200.' }),
  N('formation', 'Formation', 'command', '🛡️', [2, 3], { max: 2, req: 'tactician', mods: { formation: 0.04 }, desc: 'You and allies within 200 take 4% less damage per rank.' }),
  N('summon_knights', 'Summon Knights', 'command', '🐴', [0, 4], { lvl: 10, req: 'summon_archers', active: A(50000, 60), desc: 'Call three armoured knights for 60s.' }),
  N('shield_wall', 'Shield Wall', 'command', '🏰', [1, 4], { req: 'battle_standard', mods: { shieldWall: 0.2 }, desc: 'Everyone your Rally touches also takes 20% less damage while it lasts.' }),
  N('warlord', 'Warlord', 'command', '👑', [2, 4], { lvl: 12, req: 'formation', mods: { summonTtl: 0.5, summon: 0.2 }, desc: 'Summons last 50% longer and are 20% stronger.' }),
  N('legion_call', 'Legion Call', 'command', '⚜️', [0, 5], { lvl: 16, req: 'summon_knights', active: A(100000, 90), desc: 'Summon a legion of four knights and four archers.' }),

  // ---- Finesse
  N('footwork', 'Footwork', 'finesse', '👣', [1, 0], { max: 3, mods: { dodgeCd: 400 }, desc: 'Your dodge roll recovers 0.4s faster per rank.' }),
  N('evasion', 'Evasion', 'finesse', '🍃', [0, 1], { max: 3, req: 'footwork', mods: { evade: 0.04 }, desc: '4% chance per rank to evade a hit completely.' }),
  N('swiftness', 'Swiftness', 'finesse', '💨', [2, 1], { max: 2, req: 'footwork', mods: { speed: 0.04 }, desc: '+4% move speed per rank.' }),
  N('parry', 'Parry', 'finesse', '🤺', [0, 2], { req: 'evasion', active: A(5000, 10), desc: 'Brief guard that blocks the next hit, stuns the attacker and Exposes it.' }),
  N('tumble', 'Tumble', 'finesse', '🤸', [1, 2], { req: 'footwork', mods: { tumble: 0.6 }, desc: 'Your first hit within 1.5s of a dodge roll deals +60% damage.' }),
  N('shadowstep', 'Shadowstep', 'finesse', '👤', [2, 2], { req: 'swiftness', active: A(12000, 18), desc: 'Vanish and reappear at the cursor, up to 300 away.' }),
  N('riposte', 'Riposte', 'finesse', '🗡️', [0, 3], { req: 'parry', active: A(6000, 15), desc: 'Lunge forward, Exposing foes in your path. Double damage right after a parry.' }),
  N('thick_skin', 'Thick Skin', 'finesse', '🦏', [1, 3], { max: 3, req: 'tumble', mods: { dr: 0.04 }, desc: 'Take 4% less damage per rank.' }),
  N('smoke_bomb', 'Smoke Bomb', 'finesse', '🌫️', [2, 3], { req: 'shadowstep', active: A(18000, 20), desc: 'Smoke cloud that slows and Exposes foes inside it for 4s.' }),
  N('counter', 'Counterattack', 'finesse', '♞', [0, 4], { req: 'riposte', mods: { counter: 0.5 }, desc: 'Evading, blocking, parrying or rolling through a hit makes your next hit within 2s deal +50% damage.' }),
  N('iron_skin', 'Iron Skin', 'finesse', '🪨', [1, 4], { req: 'thick_skin', active: A(22000, 30), desc: 'Take 60% less damage for 5s.' }),
  N('last_stand', 'Last Stand', 'finesse', '🔥', [2, 4], { lvl: 12, req: 'smoke_bomb', mods: { lastStand: 1 }, desc: 'Below 30% health you take 35% less damage.' }),

  // ---- Longsword mastery
  N('sw_edge', 'Honed Edge', 'w_sword', '⚔️', [1, 0], { max: 3, mods: { wdmg: 0.05 }, desc: 'Longsword damage +5% per rank.' }),
  N('sw_block', 'Shield Block', 'w_sword', '🛡️', [0, 1], { max: 3, req: 'sw_edge', mods: { block: 0.05 }, desc: '5% chance per rank to block a hit with your shield.' }),
  N('sw_combo', 'Momentum', 'w_sword', '🌙', [2, 1], { max: 2, req: 'sw_edge', mods: { combo: 0.25 }, desc: 'Your third swing deals +25% more damage per rank.' }),
  N('shield_bash', 'Shield Bash', 'w_sword', '💥', [0, 2], { req: 'sw_block', active: A(8000, 20), desc: 'Bash with your shield for 150% weapon damage and a 1.3s stun. Follow up to Crush.' }),
  N('sw_retaliate', 'Retaliation', 'w_sword', '↩️', [1, 2], { req: 'sw_edge', mods: { retaliate: 1 }, desc: 'Blocking or parrying a hit makes your next swing a guaranteed critical strike.' }),
  N('whirlwind', 'Whirlwind', 'w_sword', '🌀', [2, 2], { req: 'sw_combo', active: A(12000, 30), desc: 'Spin three times, hitting everything around you for 130% weapon damage each.' }),
  N('sw_bulwark', 'Bulwark', 'w_sword', '🏰', [0, 3], { max: 2, req: 'shield_bash', mods: { maxhp: 0.08 }, desc: '+8% max health per rank.' }),
  N('sw_flurry', 'Flurry', 'w_sword', '💨', [2, 3], { max: 2, req: 'whirlwind', mods: { aspd: 0.06 }, desc: 'Swing 6% faster per rank.' }),
  N('sw_wave', 'Blade Wave', 'w_sword', '🌊', [1, 4], { lvl: 10, req: 'sw_retaliate', mods: { wave: 1 }, desc: 'Your third swing also launches a blade wave that pierces foes for 60% of its damage.' }),
  N('judgement', 'Judgement', 'w_sword', '✝️', [2, 4], { lvl: 12, req: 'sw_flurry', active: A(20000, 40), desc: 'A cross-slash for 300% weapon damage in front of you that heals you for 15% of your max health.' }),

  // ---- Greataxe mastery
  N('ax_heft', 'Heft', 'w_greataxe', '🪓', [1, 0], { max: 3, mods: { wdmg: 0.06 }, desc: 'Greataxe damage +6% per rank.' }),
  N('ax_cleave', 'Cleave Through', 'w_greataxe', '🌙', [0, 1], { max: 2, req: 'ax_heft', mods: { arc: 0.15, reach: 0.08 }, desc: 'Axe swings are 15% wider and reach 8% farther per rank.' }),
  N('ax_rend', 'Rend', 'w_greataxe', '🩸', [2, 1], { max: 2, req: 'ax_heft', mods: { rend: 0.15 }, desc: 'Swings make foes bleed for 15% of the hit per rank over 3s.' }),
  N('ground_slam', 'Ground Slam', 'w_greataxe', '💢', [0, 2], { req: 'ax_cleave', active: A(12000, 30), desc: 'Slam the ground: 200% weapon damage, a 50% slow and a 0.6s stun to everything within 170.' }),
  N('ax_brute', 'Brute Force', 'w_greataxe', '🦍', [1, 2], { req: 'ax_heft', mods: { brute: 1 }, desc: 'Your knockbacks travel 50% farther, and Wall Slams you cause deal triple damage.' }),
  N('ax_bloodbath', 'Bloodbath', 'w_greataxe', '🍷', [2, 2], { max: 2, req: 'ax_rend', mods: { killHeal: 0.04 }, desc: 'Kills heal you for 4% of your max health per rank.' }),
  N('ax_momentum', 'Unstoppable', 'w_greataxe', '🌪️', [0, 3], { max: 2, req: 'ground_slam', mods: { axeMo: 0.06 }, desc: 'Each swing that lands within 2s of the last makes the next 6% faster per rank, up to 4 stacks.' }),
  N('execute', 'Execute', 'w_greataxe', '⚰️', [2, 3], { req: 'ax_bloodbath', active: A(14000, 30), desc: 'Brutal chop for 250% weapon damage, doubled against foes under 35% health.' }),
  N('titan_strike', 'Titan Strike', 'w_greataxe', '🔨', [1, 4], { lvl: 10, req: 'ax_brute', active: A(26000, 50), desc: 'Overhead blow: 350% weapon damage in a cone, a 1.8s stun and a knockback (Wall Slam).' }),

  // ---- Twin Daggers mastery
  N('dg_sharp', 'Sharpened', 'w_daggers', '🗡️', [1, 0], { max: 3, mods: { crit: 0.03 }, desc: '+3% critical strike chance per rank with daggers.' }),
  N('dg_backstab', 'Backstab', 'w_daggers', '🔪', [0, 1], { max: 2, req: 'dg_sharp', mods: { back: 0.25 }, desc: 'Strikes on foes not facing you deal +25% more per rank.' }),
  N('dg_venom', 'Venom Blades', 'w_daggers', '🐍', [2, 1], { max: 3, req: 'dg_sharp', mods: { venomCh: 0.1 }, desc: 'Hits have a 10% chance per rank to poison foes for 80% of the hit over 3s. Fire on a poisoned foe Ignites.' }),
  N('fan_of_knives', 'Fan of Knives', 'w_daggers', '✴️', [0, 2], { req: 'dg_backstab', active: A(9000, 25), desc: 'Throw 10 knives in a ring, each for 250% weapon damage and passing through a foe.' }),
  N('dg_lacerate', 'Lacerate', 'w_daggers', '🩸', [1, 2], { max: 2, req: 'dg_sharp', mods: { lacerate: 0.3 }, desc: 'Critical strikes make foes bleed for 30% of the hit per rank over 3s.' }),
  N('dg_quick', 'Quick Hands', 'w_daggers', '💨', [2, 2], { max: 2, req: 'dg_venom', mods: { aspd: 0.06 }, desc: 'Stab 6% faster per rank.' }),
  N('ambush', 'Ambush', 'w_daggers', '👤', [0, 3], { req: 'fan_of_knives', active: A(10000, 25), desc: 'Blink behind the foe nearest the cursor (within 320) and strike for 400% weapon damage, always critical.' }),
  N('dg_opportunist', 'Opportunist', 'w_daggers', '🦊', [2, 3], { req: 'dg_quick', mods: { opportunist: 0.3 }, desc: '+30% damage to stunned, slowed or rooted foes.' }),
  N('dg_thousand', 'Thousand Cuts', 'w_daggers', '🌸', [1, 4], { lvl: 10, req: 'dg_lacerate', mods: { thousand: 1 }, desc: 'Every 10th dagger hit strikes 4 more times at once.' }),

  // ---- War Spear mastery
  N('sp_reach', 'Long Reach', 'w_spear', '📏', [1, 0], { max: 2, mods: { reach: 0.12 }, desc: 'Thrusts reach 12% farther per rank.' }),
  N('sp_impale', 'Impale', 'w_spear', '🔱', [0, 1], { max: 3, req: 'sp_reach', mods: { wdmg: 0.06 }, desc: 'Spear damage +6% per rank.' }),
  N('sp_keepaway', 'Keep Away', 'w_spear', '✋', [2, 1], { max: 2, req: 'sp_reach', mods: { keepAway: 18 }, desc: 'Thrusts push foes back 18 per rank.' }),
  N('lunge', 'Lunge', 'w_spear', '➡️', [0, 2], { req: 'sp_impale', active: A(7000, 20), desc: 'Dash 200 forward, skewering every foe in your path for 180% weapon damage.' }),
  N('sp_phalanx', 'Phalanx', 'w_spear', '🛡️', [1, 2], { max: 2, req: 'sp_reach', mods: { dr: 0.04, maxhp: 0.05 }, desc: 'Take 4% less damage and gain 5% max health per rank.' }),
  N('sp_sweep', 'Sweep', 'w_spear', '🔄', [2, 2], { req: 'sp_keepaway', mods: { sweep: 1 }, desc: 'Every 3rd attack becomes a sweep that hits all around you.' }),
  N('javelin', 'Javelin', 'w_spear', '🎯', [0, 3], { req: 'lunge', active: A(9000, 25), desc: 'Hurl a javelin that pierces everything for 220% weapon damage and roots foes for 0.8s (Pinned).' }),
  N('sp_skewer', 'Skewer', 'w_spear', '🍢', [2, 3], { max: 2, req: 'sp_sweep', mods: { skewer: 0.12 }, desc: 'Each foe a thrust passes through adds +12% damage per rank to the hits behind it.' }),
  N('sp_dragon', "Dragon's Breath", 'w_spear', '🐉', [1, 4], { lvl: 10, req: 'sp_phalanx', mods: { gale: 1 }, desc: 'Every 4th thrust also sends a wind blade 400 forward for 100% damage.' }),

  // ---- Longbow mastery
  N('bw_draw', 'Draw Weight', 'w_bow', '🏹', [1, 0], { max: 3, mods: { wdmg: 0.05 }, desc: 'Bow damage +5% per rank.' }),
  N('bw_quick', 'Nimble Fingers', 'w_bow', '💨', [0, 1], { max: 3, req: 'bw_draw', mods: { aspd: 0.05 }, desc: 'Shoot 5% faster per rank.' }),
  N('bw_broad', 'Broadheads', 'w_bow', '🩸', [2, 1], { max: 2, req: 'bw_draw', mods: { bleedArrow: 0.2 }, desc: 'Arrows make foes bleed for 20% of the hit per rank over 3s.' }),
  N('power_shot', 'Power Shot', 'w_bow', '🎯', [0, 2], { req: 'bw_quick', active: A(7000, 20), desc: 'A fast shot for 300% weapon damage that pierces 3 foes.' }),
  N('bw_ricochet', 'Ricochet', 'w_bow', '↪️', [1, 2], { max: 2, req: 'bw_draw', mods: { ricochet: 1 }, desc: 'Arrows bounce to 1 more foe per rank for 60% damage.' }),
  N('crippling_shot', 'Crippling Shot', 'w_bow', '🦵', [2, 2], { req: 'bw_broad', active: A(10000, 15), desc: 'Slows the target by 55% and Marks it for 6s: your side deals +20% damage to it.' }),
  N('explosive_arrow', 'Explosive Arrow', 'w_bow', '💥', [0, 3], { req: 'power_shot', active: A(12000, 30), desc: 'An arrow for 200% weapon damage that bursts for 300% more on everything within 120.' }),
  N('bw_focus', 'Focus', 'w_bow', '🧘', [2, 3], { max: 2, req: 'crippling_shot', mods: { focus: 0.12 }, desc: 'After standing still for 1s you deal +12% damage per rank.' }),
  N('piercing_gale', 'Piercing Gale', 'w_bow', '🌪️', [1, 4], { lvl: 10, req: 'bw_ricochet', active: A(26000, 45), desc: 'A great bolt for 500% weapon damage that pierces everything and hurls foes back (Wall Slam).' }),

  // ---- Runestaff mastery
  N('st_focus', 'Runecraft', 'w_staff', '🪄', [1, 0], { max: 3, mods: { wdmg: 0.05 }, desc: 'Staff damage +5% per rank.' }),
  N('st_burst', 'Wide Burst', 'w_staff', '💠', [0, 1], { max: 2, req: 'st_focus', mods: { burst: 0.25 }, desc: 'Bolt bursts are 25% larger per rank.' }),
  N('st_pyro', 'Pyromancy', 'w_staff', '🔥', [1, 1], { req: 'st_focus', excl: 'st_cryo', mods: { pyro: 0.3 }, desc: 'Bolts become fire: they burn foes for 30% of the hit over 3s, Shatter chilled foes and Ignite poisoned ones. Not with Cryomancy.' }),
  N('st_cryo', 'Cryomancy', 'w_staff', '❄️', [2, 1], { req: 'st_focus', excl: 'st_pyro', mods: { cryo: 1 }, desc: 'Bolts become frost: they slow foes by 30% and Chill them, setting up Shatter for fire allies. Not with Pyromancy.' }),
  N('chain_lightning', 'Chain Lightning', 'w_staff', '⚡', [0, 2], { req: 'st_burst', active: A(10000, 30), desc: 'Lightning that leaps between up to 5 foes, starting at 250% weapon damage.' }),
  N('st_siphon', 'Siphon', 'w_staff', '🔋', [1, 2], { max: 2, req: 'st_focus', mods: { enHit: 2 }, desc: 'Bolts restore 2 more energy per rank on hit.' }),
  N('blizzard', 'Blizzard', 'w_staff', '🌨️', [2, 2], { req: 'st_focus', active: A(16000, 40), desc: 'A storm on the target area for 4s: 50% weapon damage every quarter second, slowing and Chilling.' }),
  N('st_twin', 'Twin Bolts', 'w_staff', '♊', [0, 3], { req: 'chain_lightning', mods: { twin: 1 }, desc: 'Fire two bolts in a narrow fan, each for 65% damage.' }),
  N('st_glass', 'Glass Cannon', 'w_staff', '🔮', [2, 3], { req: 'blizzard', mods: { wdmg: 0.2, maxhp: -0.1 }, desc: '+20% staff damage, but 10% less max health.' }),
  N('arcane_orb', 'Arcane Orb', 'w_staff', '🟣', [1, 4], { lvl: 10, req: 'st_siphon', active: A(20000, 45), desc: 'Launch a slow orb that passes through foes, zapping everything within 120 of it for 60% weapon damage four times a second.' }),
];
export const TALENTS = Object.fromEntries(TALENT_LIST.map((n) => [n.id, n]));
export const ACTIVE_IDS = TALENT_LIST.filter((n) => n.active).map((n) => n.id);

// ------------------------------------------------------------------ point rules (shared by server and client)
export function treeSpent(tal, treeId) { let n = 0; for (const id in tal) if (TALENTS[id] && TALENTS[id].tree === treeId) n += tal[id]; return n; }
export function generalSpent(tal) { let n = 0; for (const id in tal) if (TALENTS[id] && !TALENTS[id].weapon) n += tal[id]; return n; }
export const talentPoints = (tier, tal) => tier + 1 - generalSpent(tal);
export const masteryPoints = (level, tal, w) => level - treeSpent(tal, 'w_' + w);
// Why a talent cannot take another rank right now, or null if it can.
// ctx: { tier, mastery: { weapon: level } }
export function learnCheck(tal, id, ctx) {
  const n = TALENTS[id];
  if (!n) return 'Unknown talent.';
  if ((tal[id] || 0) >= n.max) return 'Fully learned.';
  const w = n.weapon, level = w ? ctx.mastery[w] || 0 : ctx.tier;
  if (n.lvl && level < n.lvl) return w ? `Needs ${WEAPONS[w].name} mastery ${n.lvl}.` : `Needs soma tier ${n.lvl}.`;
  if (n.req && !tal[n.req]) return `Learn ${TALENTS[n.req].name} first.`;
  const need = n.at[1] * 2;
  if (treeSpent(tal, n.tree) < need) return `Spend ${need} points in this tree first.`;
  if (n.excl && tal[n.excl]) return `Cannot be combined with ${TALENTS[n.excl].name}.`;
  if (w ? masteryPoints(level, tal, w) <= 0 : talentPoints(ctx.tier, tal) <= 0) return w ? `No ${WEAPONS[w].name} mastery points. Earn soma while wielding it.` : 'No talent points left. Each soma tier gives one.';
  return null;
}
// Rebuilds a saved talent map so it only keeps ranks that are still legal (after a rebalance, say).
const ORDER = [...TALENT_LIST].sort((a, b) => a.at[1] - b.at[1]);
export function sanitizeTalents(saved, ctx) {
  const tal = {};
  if (!saved || typeof saved !== 'object') return tal;
  for (const n of ORDER) {
    const want = Math.min(n.max, Math.max(0, saved[n.id] | 0));
    for (let r = 0; r < want && !learnCheck(tal, n.id, ctx); r++) tal[n.id] = r + 1;
  }
  return tal;
}
