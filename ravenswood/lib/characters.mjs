const wiki = (name) => `https://wiki.bloodontheclocktower.com/${name.replaceAll(' ', '_')}`;

/** Paraphrased player reference. Mechanical resolution belongs to the server engine. */
export const ROLES = Object.freeze(Object.fromEntries([
  ['washerwoman', 'Washerwoman', 'townsfolk', 'On the first night, learn a Townsfolk character and two players, one of whom has that character.'],
  ['librarian', 'Librarian', 'townsfolk', 'On the first night, learn an Outsider character and two possible players, or learn that there are no Outsiders.'],
  ['investigator', 'Investigator', 'townsfolk', 'On the first night, learn a Minion character and two players, one of whom registers as that Minion.'],
  ['chef', 'Chef', 'townsfolk', 'Start with the total number of neighboring evil pairs around the seating circle. A run of three evil players makes two pairs.'],
  ['empath', 'Empath', 'townsfolk', 'Every night, learn how many of your nearest living neighbors, one in each direction, register as evil.'],
  ['fortune_teller', 'Fortune Teller', 'townsfolk', 'Every night, select two players and learn whether either registers as a Demon. One fixed good player also gives a positive result.'],
  ['undertaker', 'Undertaker', 'townsfolk', 'After the first night, learn the character of the player who died from execution that day, if anyone did.'],
  ['monk', 'Monk', 'townsfolk', 'After the first night, select another player each night to protect from the Demon until dawn.'],
  ['ravenkeeper', 'Ravenkeeper', 'townsfolk', 'When you die during a night, choose any player that night and learn their character.'],
  ['virgin', 'Virgin', 'townsfolk', 'Your first nominator is immediately executed if they register as Townsfolk. The first nomination spends this ability either way.'],
  ['slayer', 'Slayer', 'townsfolk', 'Once during the game, make a public daytime shot at a player. A living Demon hit by a functioning shot dies.'],
  ['soldier', 'Soldier', 'townsfolk', 'While your ability works, the Demon cannot kill you with its ability. Execution can still kill you.'],
  ['mayor', 'Mayor', 'townsfolk', 'With you alive and your ability working, good wins if the day ends with three survivors and no execution. Night attacks may be redirected.'],
  ['butler', 'Butler', 'outsider', 'Choose another player as master each night. While alive, you can vote the following day only when your master is voting too.'],
  ['drunk', 'Drunk', 'outsider', 'You are secretly an Outsider who believes they are a Townsfolk. That apparent ability has no effect, and its information may be misleading.'],
  ['recluse', 'Recluse', 'outsider', 'You are good, but other abilities may detect you as evil, a Minion or a Demon. This can happen even after death.'],
  ['saint', 'Saint', 'outsider', 'If your functioning ability triggers when execution kills you, good loses immediately. Other causes of death do not trigger it.'],
  ['poisoner', 'Poisoner', 'minion', 'Select a player every night to disable their ability for that night and the next day. Their information can be misleading.'],
  ['spy', 'Spy', 'minion', 'Each night, inspect the hidden game state. You may register as good, a Townsfolk or an Outsider, including after death.'],
  ['scarlet_woman', 'Scarlet Woman', 'minion', 'If the Demon dies with at least five players alive just before that death, your functioning ability turns you into the Demon.'],
  ['baron', 'Baron', 'minion', 'Setup includes two extra Outsiders, replacing two Townsfolk. This setup change remains if you die or become poisoned.'],
  ['imp', 'Imp', 'demon', 'After the first night, choose a player to kill each night. If you kill yourself, a living Minion becomes the new Imp.'],
].map(([id, name, type, help]) => [id, Object.freeze({ id, name, type, help, wiki: wiki(name) })])));

export const ROLE_LIST = Object.freeze(Object.values(ROLES));
