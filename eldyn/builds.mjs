// Hanbin Island tools: the toolbelt combat system (modelled on Eldyn's tool-based combat).
// Every number the game uses for a tool lives here; the in-game descriptions are generated from it.
// Damage is per hit against 80 HP. Times are in ms, distances in px, modifiers in percent.

export const BASE_HP = 80, SLOTS = 10, TURN_RATE = (600 * Math.PI) / 180; // rad per second
export const ATK_CAP = [-90, 75], DEF_CAP = [-50, 90], SPD_CAP = [0.2, 2], ALLY_SHIELD_CAP = 20, AURA_GAP = 300;
// Moving away from where you face (more than 100° off) is slower, so kiting has a cost.
export const BACKPEDAL = 0.75, BACKPEDAL_ANGLE = (100 * Math.PI) / 180;
export const RESPEC_COST = 0.05, MAX_TRAPS = 10, MAX_TROOPS = 5;

export const PATHS = [
  { id: 'warrior', name: 'Warrior', color: '#e0584f', blurb: 'Melee weapons, shields and duellist maneuvers.' },
  { id: 'hunter', name: 'Hunter', color: '#6fbf5a', blurb: 'Ranged weapons, short blades, traps and moving unseen.' },
  { id: 'alchemist', name: 'Alchemist', color: '#a56ae0', blurb: 'Thrown concoctions, crowd control, leech, heals and disguise.' },
  { id: 'auxiliary', name: 'Auxiliary', color: '#e0b84f', blurb: 'Banners for your team, banners that hold forts, and a hired army.' },
];
export const GROUPS = {
  weapon: 'Weapon', sidearm: 'Sidearm', shield: 'Shield', maneuver: 'Maneuver', thrown: 'Thrown', heal: 'Heal',
  buff: 'Buff', stealth: 'Stealth', banner: 'Banner', trap: 'Trap', troops: 'Troops',
};
// Time-to-kill bands (seconds against 80 HP, no defence, attacking non-stop) every weapon must sit in.
export const TTK_BANDS = { light: [4.4, 5.0], heavy: [4.6, 5.2], reach: [5.4, 7.5], ranged: [5.5, 7.5], side: [14, Infinity] };

const T = (id, name, path, req, group, cd, spec, desc) => ({ id, name, path, req, group, cd, ...spec, desc });
const hit = (t, dmg, o = {}) => ({ t, dmg, ...o });
export const TOOL_LIST = [
  // ------------------------------------------------------------- Warrior: melee weapons
  T('spear', 'Spear', 'warrior', null, 'weapon', 700, { cls: 'reach', type: 'strike', hits: [hit(0, 10, { line: 1, reach: 130, first: 1 })] }, 'Straight thrust that hits the first foe.'),
  T('shortsword', 'Shortsword', 'warrior', null, 'weapon', 450, { cls: 'light', type: 'strike', hits: [hit(0, 8, { arc: 100, reach: 70 })] }, 'Quick 100° slash.'),
  T('pike', 'Pike', 'warrior', 'spear', 'weapon', 700, { cls: 'reach', type: 'strike', hits: [hit(0, 10, { line: 1, reach: 190, first: 1, push: 60 })], after: { spd: -15, dur: 500 } }, 'Long thrust that pushes the foe back. You are slower for a moment after each thrust.'),
  T('partisan', 'Partisan', 'warrior', 'pike', 'weapon', 950, { cls: 'reach', type: 'strike', hits: [hit(0, 11, { line: 1, reach: 200, first: 1 })] }, 'The longest thrust in the game.'),
  T('lance', 'Lance', 'warrior', 'pike', 'weapon', 2200, { cls: 'reach', type: 'charge', dist: 200, dur: 400, dmg: 24, push: 70, after: { spd: -40, atk: -20, dur: 2000 } }, 'Charge forward and run through the first foe, knocking it back. Afterwards you are slow and weaker for 2s.'),
  T('glaive', 'Glaive', 'warrior', 'spear', 'weapon', 1200, { cls: 'reach', type: 'strike', hits: [0, 200, 400].map((t) => hit(t, 5, { arc: 90, reach: 140, pull: 15 })) }, 'Three quick swipes, each pulling foes toward you.'),
  T('halberd', 'Halberd', 'warrior', 'glaive', 'weapon', 1000, { cls: 'reach', type: 'strike', hits: [hit(0, 13, { arc: 70, reach: 140, root: 300 })] }, 'Chop that holds the foe in place for a moment.'),
  T('pollaxe', 'Pollaxe', 'warrior', 'halberd', 'weapon', 1000, { cls: 'reach', type: 'strike', hits: [hit(0, 11, { line: 1, reach: 150, first: 1, pull: 60 })] }, 'Hook that drags the foe toward you.'),
  T('ranseur', 'Ranseur', 'warrior', 'glaive', 'weapon', 900, { cls: 'reach', type: 'strike', hits: [hit(0, 10, { line: 1, reach: 150, first: 1, push: 90 })] }, 'Thrust that shoves the foe far back.'),
  T('bardiche', 'Bardiche', 'warrior', 'ranseur', 'weapon', 1250, { cls: 'heavy', type: 'strike', windup: 300, hits: [hit(0, 20, { arc: 160, reach: 120 })] }, 'Short wind-up, then a wide 160° chop.'),
  T('sabre', 'Sabre', 'warrior', 'shortsword', 'weapon', 700, { cls: 'light', type: 'strike', step: 20, hits: [hit(0, 12, { arc: 100, reach: 80, push: 40 })], after: { spd: -30, dur: 400 } }, 'Slash with a step forward that pushes the foe back. You are slower for a moment after.'),
  T('rapier', 'Rapier', 'warrior', 'sabre', 'weapon', 800, { cls: 'light', type: 'strike', windup: 100, hits: [hit(0, 13, { line: 1, reach: 110, first: 1 })] }, 'Quick, precise thrust.'),
  T('battleaxe', 'Battleaxe', 'warrior', 'shortsword', 'weapon', 2400, { cls: 'heavy', type: 'strike', hits: [[0, 8], [400, 8], [800, 10], [1200, 14]].map(([t, d]) => hit(t, d, { arc: 110, reach: 90 })) }, 'Four swings in a row, each harder. Only foes still in the arc are hit.'),
  T('greatsword', 'Greatsword', 'warrior', 'battleaxe', 'weapon', 1600, { cls: 'heavy', type: 'strike', windup: 450, hits: [hit(0, 26, { arc: 150, reach: 105 })] }, 'Slow wind-up, then a huge 150° sweep.'),
  T('flail', 'Flail', 'warrior', 'battleaxe', 'weapon', 1900, { cls: 'heavy', type: 'strike', hits: [0, 400, 800].map((t) => hit(t, 11, { arc: 360, reach: 95 })) }, 'Three full spins that hit everything around you. Once started it can\'t be stopped.'),
  T('quarterstaff', 'Quarterstaff', 'warrior', 'shortsword', 'sidearm', 1600, { cls: 'side', type: 'strike', hits: [0, 250].map((t) => hit(t, 4, { arc: 90, reach: 95, push: 15 })) }, 'Sidearm: two quick strikes with a small push. Use it between weapon swings.'),
  // ------------------------------------------------------------- Warrior: shields
  T('buckler', 'Buckler', 'warrior', null, 'shield', 3500, { type: 'shield', def: 40, dur: 2000, spd: -10 }, 'Small, quick shield.'),
  T('targe', 'Targe', 'warrior', 'buckler', 'shield', 4500, { type: 'shield', def: 45, dur: 2000, atk: -10 }, 'Round shield.'),
  T('kite', 'Kite Shield', 'warrior', 'targe', 'shield', 7000, { type: 'shield', def: 50, dur: 2500, atk: -35, spd: -10 }, 'Tall shield.'),
  T('pavise', 'Pavise', 'warrior', 'kite', 'shield', 9000, { type: 'shield', def: 85, dur: 2500, atk: -40, spd: -40, shove: 30 }, 'The strongest shield: shoves away foes that touch you, but you can barely move or hurt anyone behind it.'),
  T('parma', 'Parma', 'warrior', 'buckler', 'shield', 2500, { type: 'shield', def: 50, dur: 1000 }, 'Fast shield. The half-second gap between raises is its weakness.'),
  T('round', 'Round Shield', 'warrior', 'parma', 'shield', 5000, { type: 'shield', def: 75, dur: 1500, atk: -60 }, 'Very strong, but your attacks are crippled while it is up: strike in the gaps, then raise it again.'),
  T('scutum', 'Scutum', 'warrior', 'targe', 'shield', 7000, { type: 'shield', def: 56, dur: 2500, atk: -15, spd: -20, ally: { r: 120, def: 4, behind: 1 } }, 'Big legionary shield. Allies behind or beside you get +4 defence per Scutum (up to +20).'),
  T('heraldic', 'Heraldic Shield', 'warrior', 'scutum', 'shield', 6000, { type: 'shield', def: 40, dur: 2500, ally: { r: 150, def: 10 } }, 'Shield bearing your colours. Allies near you get +10 defence.'),
  // ------------------------------------------------------------- Warrior: maneuvers and buffs
  T('lunge', 'Lunge', 'warrior', null, 'maneuver', 6000, { type: 'move', dir: 'fwd', dist: 120, buff: { atk: 30, dur: 1500 }, after: { spd: -20, dur: 1000, delay: 1500 } }, 'Dash forward with +30 attack for 1.5s, then you are slower for 1s.'),
  T('feint', 'Feint', 'warrior', 'lunge', 'maneuver', 8000, { type: 'move', dir: 'side', target: 160, buff: { atk: 30, dur: 1500 } }, 'Needs a foe within 160: step round to its side, with +30 attack for 1.5s.'),
  T('remise', 'Remise', 'warrior', 'feint', 'maneuver', 9000, { type: 'move', dir: 'circle', target: 160, aoe: { r: 50, dmg: 6 }, buff: { atk: 40, dur: 800 } }, 'Needs a foe within 160: circle 120° round it, hitting everything close for 6, with +40 attack for 0.8s.'),
  T('parry', 'Parry', 'warrior', 'lunge', 'maneuver', 8000, { type: 'parry', window: 400, buff: { atk: 20, dur: 1500 }, foe: { atk: -20, spd: -30, dur: 1200 } }, 'For 0.4s the next melee hit on you is fully blocked. The attacker gets -20 attack and is 30% slower for 1.2s; you get +20 attack.'),
  T('riposte', 'Riposte', 'warrior', 'parry', 'maneuver', 10000, { type: 'move', dir: 'attacker', dist: 100, within: 1500, buff: { atk: 50, dur: 1000 } }, 'Only within 1.5s of being hit or parrying: dash at your attacker with +50 attack for 1s.'),
  T('retreat', 'Retreat', 'warrior', 'lunge', 'maneuver', 8000, { type: 'move', dir: 'back', dist: 140, aoe: { r: 60, dmg: 6, push: 60, atStart: 1 } }, 'Dash backward. Foes next to where you stood take 6 and are pushed away.'),
  T('crossover', 'Cross Over', 'warrior', 'retreat', 'maneuver', 6000, { type: 'move', dir: 'cross', target: 160, dist: 120 }, 'Needs a foe within 160: step back and to the side while still facing it.'),
  T('redemption', 'Redemption', 'warrior', 'parry', 'buff', 20000, { type: 'buff', eff: { atk: 30, spd: 15, def: -35 }, dur: 4000 }, '+30 attack and +15% speed for 4s, but -35 defence.'),
  // ------------------------------------------------------------- Hunter: ranged
  T('sling', 'Sling', 'hunter', null, 'weapon', 550, { cls: 'ranged', type: 'shoot', dmg: 7, speed: 700, range: 450, proj: 'stone' }, 'Stone shot. No movement penalty.'),
  T('flatbow', 'Flatbow', 'hunter', 'sling', 'weapon', 800, { cls: 'ranged', type: 'shoot', dmg: 10, speed: 760, range: 550, during: { spd: -10, dur: 300 } }, 'Arrow. You are a little slower while drawing.'),
  T('longbow', 'Longbow', 'hunter', 'flatbow', 'weapon', 1300, { cls: 'ranged', type: 'shoot', windup: 500, dmg: 16, speed: 900, range: 800, during: { spd: -40, dur: 500 }, maim: { spd: -15, dur: 800 } }, 'Long draw (40% slower while drawing), then a long-range arrow that maims (target 15% slower for 0.8s).'),
  T('crossbow', 'Crossbow', 'hunter', 'flatbow', 'weapon', 1800, { cls: 'ranged', type: 'shoot', dmg: 20, speed: 1000, range: 650, proj: 'bolt' }, 'Fast, heavy bolt.'),
  T('repeater', 'Repeating Crossbow', 'hunter', 'crossbow', 'weapon', 1800, { cls: 'ranged', type: 'shoot', count: 4, every: 200, dmg: 5, speed: 900, range: 500, proj: 'bolt', during: { spd: -35, dur: 800 } }, 'Four bolts in quick succession. You are slower while firing.'),
  T('pilum', 'Pilum', 'hunter', 'sling', 'sidearm', 4000, { cls: 'side', type: 'shoot', dmg: 4, speed: 650, range: 400, proj: 'pilum', eff: { def: -20, spd: -20, dur: 2000 } }, 'Sidearm: thrown spear. The target gets -20 defence and is 20% slower for 2s. The answer to shields.'),
  T('plumbata', 'Plumbata', 'hunter', 'pilum', 'weapon', 2200, { cls: 'ranged', type: 'shoot', dmg: 28, speed: 750, range: 600, proj: 'dart', small: 1, arm: 200 }, 'Weighted dart with a tiny hitbox. It only hurts after flying 200 px.'),
  // ------------------------------------------------------------- Hunter: blades and footwork
  T('bollock', 'Bollock Dagger', 'hunter', 'sling', 'sidearm', 800, { cls: 'side', type: 'strike', hits: [hit(0, 4, { arc: 60, reach: 50 })] }, 'Sidearm: fast stab at close range.'),
  T('rondel', 'Rondel Dagger', 'hunter', 'bollock', 'sidearm', 1300, { cls: 'side', type: 'strike', hits: [hit(0, 7, { arc: 60, reach: 55, eff: { spd: -20, dur: 800 } })] }, 'Sidearm: stab that slows the target 20% for 0.8s.'),
  T('blackjack', 'Blackjack', 'hunter', 'rondel', 'sidearm', 4000, { cls: 'side', type: 'strike', hits: [hit(0, 3, { arc: 70, reach: 55, eff: { spd: -40, dur: 1500, tag: 'blackjack' } })] }, 'Sidearm: cosh that slows the target 40% for 1.5s. Doesn\'t stack with itself.'),
  T('sprint', 'Sprint', 'hunter', 'bollock', 'maneuver', 12000, { type: 'buff', eff: { spd: 60 }, dur: 3000, after: { spd: -20, dur: 1500, delay: 3000 } }, '+60% speed for 3s, then 20% slower for 1.5s.'),
  T('shadows', 'Hide in Shadows', 'hunter', 'sprint', 'stealth', 15000, { type: 'stealth', invis: 0.85, dur: 6000, need: 'shadow', breakMove: 1 }, '85% invisible for 6s while you stand still in forest or a building\'s shadow.'),
  T('focus', 'Deadly Focus', 'hunter', 'longbow', 'buff', 15000, { type: 'buff', eff: { ratk: 40, def: -20, spd: -15 }, dur: 5000 }, '+40 attack on ranged hits, -20 defence and 15% slower, for 5s.'),
  // ------------------------------------------------------------- Hunter: traps
  T('tripwire', 'Tripwire', 'hunter', 'sling', 'trap', 1500, { type: 'trap', npc: 'tripwire', wood: 2, range: 200 }, 'Deals 5 to each foe that crosses it, 3 times. Visible.'),
  T('foothold', 'Foothold Trap', 'hunter', 'tripwire', 'trap', 1500, { type: 'trap', npc: 'foothold', wood: 3, range: 200 }, 'Roots the first foe for 1.5s and deals 6.'),
  T('sulphur', 'Sulphur Trap', 'hunter', 'foothold', 'trap', 1500, { type: 'trap', npc: 'sulphur', wood: 4, range: 200 }, 'Bursts into a poison cloud (80 px): 3 per second for 4s.'),
  T('brimstone', 'Brimstone Trap', 'hunter', 'sulphur', 'trap', 1500, { type: 'trap', npc: 'brimstone', wood: 5, range: 200 }, 'Bursts for 14, then burns for 2 per second for 3s.'),
  T('spinner', 'Spinner Trap', 'hunter', 'brimstone', 'trap', 1500, { type: 'trap', npc: 'spinner', wood: 8, range: 200 }, 'Post with a spinning lead ball: once triggered it hits foes within 70 for 6 every 0.6s for 15s. Can\'t be pushed.'),
  T('net', 'Net', 'hunter', 'tripwire', 'thrown', 10000, { type: 'lob', range: 300, flight: 400, r: 60, root: 1200, aim: 1 }, 'Throw to a point within 300: roots foes within 60 for 1.2s.'),
  T('lariat', 'Lariat', 'hunter', 'net', 'thrown', 8000, { type: 'shoot', dmg: 3, speed: 700, range: 350, proj: 'rope', pull: 120 }, 'Rope throw (our design): pulls the first foe hit 120 toward you and deals 3.'),
  // ------------------------------------------------------------- Alchemist: thrown and control
  T('gall', 'Phial of Gall', 'alchemist', 'rations', 'thrown', 3000, { type: 'lob', range: 350, flight: 450, r: 60, dmg: 8, dot: { dps: 2, dur: 3000 }, aim: 1 }, 'Thrown up to 350: 8 to foes within 60, then acid for 2 per second for 3s.'),
  T('naphtha', 'Naphtha', 'alchemist', 'gall', 'thrown', 5000, { type: 'lob', range: 300, flight: 450, r: 70, zone: { dps: 4, dur: 4000 }, aim: 1 }, 'Thrown up to 300: a fire patch of 70 for 4s, 4 per second to every foe inside.'),
  T('saltpetre', 'Saltpetre', 'alchemist', 'naphtha', 'thrown', 6000, { type: 'lob', range: 400, flight: 600, r: 70, dmg: 16, push: 80, eff: { spd: -30, dur: 1000 }, aim: 1 }, 'Thrown up to 400, explodes after 0.6s: 16 within 70, pushes foes 80 and slows them. Best at mid range.'),
  T('moonstone', 'Moonstone', 'alchemist', 'gall', 'thrown', 9000, { type: 'gather', r: 160, to: 40, dur: 600, dmg: 2 }, 'Smoothly pulls every foe within 160 to a point just in front of you.'),
  T('firefog', 'Firefog', 'alchemist', 'moonstone', 'thrown', 9000, { type: 'repel', r: 90, dist: 100, dmg: 3 }, 'Cloud that pushes foes within 90 away by 100.'),
  T('quicksilver', 'Quicksilver', 'alchemist', 'moonstone', 'sidearm', 8000, { cls: 'side', type: 'shoot', dmg: 0, speed: 600, range: 350, proj: 'vial', players: 1, eff: { cd: 30, dur: 3000 } }, 'Sidearm: splash a player so their cooldowns run 30% slower for 3s. No effect on NPCs (our design).'),
  T('leeches', 'Leeches', 'alchemist', 'rations', 'thrown', 7000, { type: 'cone', r: 100, arc: 70, dps: 4, dur: 3000, leech: 1 }, '100 px cone: each foe takes 4 per second for 3s, and you heal all of it.'),
  T('sceptre', 'Sceptre', 'alchemist', 'leeches', 'sidearm', 1500, { cls: 'side', type: 'strike', hits: [hit(0, 5, { arc: 90, reach: 70, eff: { def: -15, dur: 3000 } })] }, 'Sidearm: strike that gives the target -15 defence for 3s, which also raises your leech.'),
  T('draught', "Berserker's Draught", 'alchemist', 'leeches', 'buff', 24000, { type: 'buff', eff: { atk: 50, def: -30, leech: 50 }, dur: 4000 }, '+50 attack, -30 defence and +50 leech for 4s.'),
  // ------------------------------------------------------------- Alchemist: heals
  T('rations', 'Rations', 'alchemist', null, 'heal', 15000, { type: 'heal', amt: 18, after: { spd: -30, dur: 1500 } }, 'Heal 18 at once, then you are 30% slower for 1.5s.'),
  T('tincture', "Mender's Tincture", 'alchemist', 'rations', 'heal', 10000, { type: 'heal', amt: 8, hot: { rate: 2, dur: 4000 }, toAlly: 250 }, 'Thrown at the most hurt ally within 250 (or yourself): 8 at once plus 2 per second for 4s.'),
  T('poultice', "Sage's Poultice", 'alchemist', 'tincture', 'heal', 22000, { type: 'heal', hot: { rate: 5, dur: 5000 }, self: { def: -25, spd: -40, dur: 5000 } }, 'Heal 5 per second for 5s, but -25 defence and 40% slower while it works.'),
  T('blessing', 'Blessing', 'alchemist', 'poultice', 'heal', 30000, { type: 'heal', hot: { rate: 4, dur: 6000 }, allies: 150, self: { def: -30, spd: -50, dur: 6000 } }, 'You and allies within 150 heal 4 per second for 6s. You get -30 defence and are 50% slower while it works.'),
  T('meditation', 'Meditation', 'alchemist', 'poultice', 'heal', 25000, { type: 'heal', hot: { rate: 8, dur: 5000 }, self: { def: -40, root: 1, dur: 5000 } }, 'Heal 8 per second for 5s, but you can\'t move and have -40 defence.'),
  // ------------------------------------------------------------- Alchemist: stealth
  T('cloak', 'Shadow Cloak', 'alchemist', 'rations', 'stealth', 20000, { type: 'stealth', invis: 0.7, dur: 8000, eff: { spd: -40 }, breakAct: 1, breakHit: 1 }, '70% invisible for 8s while creeping at 60% speed. Attacking or being hit ends it.'),
  T('smoke', 'Apparition Smoke', 'alchemist', 'cloak', 'stealth', 30000, { type: 'stealth', invis: 0.99, dur: 3000 }, '99% invisible for 3s, even while moving. NPCs lose you, but strike where they last saw you.'),
  T('turncoat', 'Turncoat', 'alchemist', 'smoke', 'stealth', 45000, { type: 'disguise', dur: 10000 }, 'For 10s, or until you attack, other players see you as one of their own. No effect on NPCs.'),
  // ------------------------------------------------------------- Auxiliary
  T('pennon', 'Pennon', 'auxiliary', null, 'banner', 12000, { type: 'aura', r: 150, eff: { atk: 10 }, dur: 6000 }, 'Carried banner: allies within 150 get +10 attack for 6s.'),
  T('banderole', 'Banderole', 'auxiliary', 'pennon', 'banner', 15000, { type: 'aura', r: 150, eff: { spd: 10 }, hot: 1, dur: 6000 }, 'Carried banner (our design): allies within 150 get +10% speed and heal 1 per second for 6s.'),
  T('gonfalon', 'Gonfalon', 'auxiliary', 'pennon', 'banner', 30000, { type: 'deploy', npc: 'gonfalon', wood: 10, range: 200, aura: 1 }, 'Deploy a banner (120 HP, 2 min): allies within 180 get +15 defence. Holds a fort while it stands inside the walls.'),
  T('ensign', 'Ensign', 'auxiliary', 'banderole', 'banner', 30000, { type: 'deploy', npc: 'ensign', wood: 10, range: 200, aura: 1 }, 'Deploy a banner (80 HP, 2 min): allies within 180 heal 1 per second. Holds a fort.'),
  T('bonfire', 'Bonfire', 'auxiliary', 'pennon', 'banner', 20000, { type: 'deploy', npc: 'bonfire', wood: 4, range: 200, any: 1, self: { def: -20, dur: 2000 } }, 'Light a bonfire within 200 (60s): allies within 120 heal 1.5 per second. Lighting it gives you -20 defence for 2s.'),
  T('hire_archer', 'Hire Archer', 'auxiliary', 'pennon', 'troops', 3000, { type: 'hire', npc: 'hire_archer', gold: 60 }, 'Hire an archer (50 HP, Sling) for 60 banked gold.'),
  T('hire_merc', 'Hire Mercenary', 'auxiliary', 'hire_archer', 'troops', 3000, { type: 'hire', npc: 'hire_merc', gold: 80 }, 'Hire a mercenary (70 HP, Shortsword) for 80 banked gold.'),
  T('hire_guard', 'Hire Guard', 'auxiliary', 'hire_merc', 'troops', 3000, { type: 'hire', npc: 'hire_guard', gold: 100 }, 'Hire a guard (90 HP, Spear and Buckler) for 100 banked gold.'),
  T('hire_healer', 'Hire Healer', 'auxiliary', 'hire_archer', 'troops', 3000, { type: 'hire', npc: 'hire_healer', gold: 120 }, "Hire a healer (50 HP) who throws Mender's Tincture at hurt allies, for 120 banked gold."),
];
export const TOOLS = Object.fromEntries(TOOL_LIST.map((t) => [t.id, t]));
// Eight free tools. New players start with a sidearm too, so a veteran's sidearm is no edge.
export const START_KIT = ['spear', 'shortsword', 'buckler', 'lunge', 'sling', 'rations', 'pennon', 'bollock'];
export const START_BELT = ['spear', 'bollock', 'buckler', 'lunge', 'sling', 'rations'];
// The toolbelt has 10 slots. Six are open from the start; the rest open at these Soma tiers.
export const SLOT_TIERS = [0, 0, 0, 0, 0, 0, 3, 7, 13, 21];
export const slotsFor = (tier) => SLOT_TIERS.filter((t) => tier >= t).length;
export const UNLOCKABLE = TOOL_LIST.filter((t) => !START_KIT.includes(t.id)).map((t) => t.id);
// Tools that aim at a point (the cursor) rather than straight ahead.
export const isPlaced = (t) => t.type === 'trap' || t.type === 'deploy' || (t.type === 'lob' && t.aim);

// ------------------------------------------------------------------ unlocking
// One key per Soma tier. A tool needs its parent unlocked first. Start-kit tools are always unlocked.
export const keysFor = (tier, unlocked) => Math.max(0, tier - unlocked.filter((id) => !START_KIT.includes(id)).length);
export const owns = (unlocked, id) => START_KIT.includes(id) || unlocked.includes(id);
export function unlockCheck(unlocked, id, tier) {
  const t = TOOLS[id];
  if (!t) return 'Unknown tool.';
  if (owns(unlocked, id)) return 'Already unlocked.';
  if (t.req && !owns(unlocked, t.req)) return `Unlock ${TOOLS[t.req].name} first.`;
  if (keysFor(tier, unlocked) < 1) return 'No keys left. Every Soma tier gives one key.';
  return null;
}
// Keeps only unlocks whose parents are owned and that the tier can pay for (e.g. after a rebalance).
export function sanitizeUnlocks(list, tier) {
  const out = [];
  let changed = true;
  const want = Array.isArray(list) ? list.filter((id) => TOOLS[id] && !START_KIT.includes(id)) : [];
  while (changed) {
    changed = false;
    for (const id of want) if (!out.includes(id) && out.length < tier && (!TOOLS[id].req || owns(out, TOOLS[id].req))) { out.push(id); changed = true; }
  }
  return out;
}

// ------------------------------------------------------------------ balance maths (also used by the tests)
export function damagePerUse(t) {
  if (t.type === 'strike') return t.hits.reduce((a, h) => a + h.dmg, 0);
  if (t.type === 'charge') return t.dmg;
  if (t.type === 'shoot') return t.dmg * (t.count || 1);
  return 0;
}
export const ttk = (t, hp = BASE_HP) => { const d = damagePerUse(t); return d > 0 ? hp / (d / (t.cd / 1000)) : Infinity; };
// Times (ms after use) at which a weapon's hits land.
export function hitTimes(t) {
  const w = t.windup || 0;
  if (t.type === 'strike') return t.hits.map((h) => [w + h.t, h.dmg]);
  if (t.type === 'charge') return [[t.dur / 2, t.dmg]];
  if (t.type === 'shoot') return Array.from({ length: t.count || 1 }, (_, i) => [w + i * (t.every || 0), t.dmg]);
  return [];
}
// Fastest kill of an 80 HP, no-defence target with every cooldown ready and every buff already up.
// Weapon and sidearm are used as often as their cycles allow; buffs add attack while they last.
export function burstTime(weapon, sidearm, buffs, hp = BASE_HP) {
  const events = [];
  for (const tl of [weapon, sidearm]) {
    if (!tl) continue;
    for (let start = 0; start < 4000; start += tl.cd) for (const [at, d] of hitTimes(tl)) events.push([start + at, d]);
  }
  events.sort((a, b) => a[0] - b[0]);
  let dealt = 0;
  for (const [at, d] of events) {
    const atk = buffs.reduce((a, b) => a + (at < b.dur ? b.atk : 0), 0);
    dealt += d * (1 + Math.min(ATK_CAP[1], atk) / 100);
    if (dealt >= hp) return at;
  }
  return Infinity;
}
// Buffs a kit can have up at once: one per cooldown group (and the banner of a friend is not counted).
export function attackBuffs() {
  const g = {};
  for (const t of TOOL_LIST) {
    const b = t.type === 'buff' ? { atk: t.eff.atk || 0, dur: t.dur } : t.type === 'aura' ? { atk: t.eff.atk || 0, dur: t.dur } : t.buff ? { atk: t.buff.atk, dur: t.buff.dur } : null;
    if (b && b.atk > 0) (g[t.group] ||= []).push(b);
  }
  return g;
}

// ------------------------------------------------------------------ descriptions
const sec = (ms) => `${+(ms / 1000).toFixed(2)}s`;
export function toolStats(t) {
  const out = [`${GROUPS[t.group]} group`, `cycle ${sec(t.cd)}`];
  const d = damagePerUse(t);
  if (d) out.push(`${t.type === 'strike' && t.hits.length > 1 ? t.hits.map((h) => h.dmg).join('+') : t.count ? `${t.dmg}×${t.count}` : d} damage`);
  if (t.cls) { const k = ttk(t); if (Number.isFinite(k)) out.push(`kills in ${k.toFixed(1)}s`); }
  if (t.type === 'strike') out.push(`reach ${t.hits[0].reach}`);
  if (t.range) out.push(`range ${t.range}`);
  if (t.windup) out.push(`wind-up ${sec(t.windup)}`);
  if (t.type === 'shield') out.push(`+${t.def} defence for ${sec(t.dur)}`);
  if (t.wood) out.push(`${t.wood} wood`);
  if (t.gold) out.push(`${t.gold} gold`);
  return out.join(' · ');
}
