# Trouble Brewing research and implementation decisions

Research date: 2026-11-02. Read the official Trouble Brewing page, all 22 character entries, and the general rule sections linked below. Character-by-character notes are in CHARACTERS.md. The UI reference links every role directly to its official almanac.

## General rules

- [Setup](https://wiki.bloodontheclocktower.com/Setup): choose roles secretly, preserve seating, apply setup modifications before assignment. Baron replaces two Townsfolk with Outsiders. Drunk gets an unused Townsfolk identity. No Travellers or Fabled are implemented.
- [Rules Explanation](https://wiki.bloodontheclocktower.com/Rules_Explanation): alternate night and day; dead players remain participants, cannot nominate, and retain one yes vote. Qualifying execution requires at least half the living players. Only a unique highest qualifying vote executes; tied leaders do not execute.
- [Glossary](https://wiki.bloodontheclocktower.com/Glossary): only living players nominate; each person may nominate once and be nominated once each day. Evil-team introductions apply from seven players. The Demon receives three absent good characters as bluffs; Minions learn the Demon and one another.
- [Abilities](https://wiki.bloodontheclocktower.com/Abilities): resolve effects immediately; source death or character change stops persistent effects. A new Demon does not receive a new initial evil-team introduction. Only information authorized by a character is disclosed. Death announcements omit causes.
- [States](https://wiki.bloodontheclocktower.com/States): impairment removes mechanical effects but prompts still appear. Impaired information may be correct or incorrect. Once-per-game attempts are consumed even when impaired. Execution and death are tracked separately, including execution of dead players. Poisoning a target does not generally change its detected identity.

Base counts (Townsfolk / Outsiders / Minions / Demon): 5 = 3/0/1/1; 6 = 3/1/1/1; 7 = 5/0/1/1; 8 = 5/1/1/1; 9 = 5/2/1/1; 10 = 7/0/2/1; 11 = 7/1/2/1; 12 = 7/2/2/1; 13 = 9/0/3/1; 14 = 9/1/3/1; 15 = 9/2/3/1.

## Evil roles

- [Poisoner](https://wiki.bloodontheclocktower.com/Poisoner): chooses each night, including self/dead targets. Poison covers that night and next day and expires when the next night starts. Death or conversion to Imp ends it immediately. Mayor's concluding-day check occurs before this expiration.
- [Spy](https://wiki.bloodontheclocktower.com/Spy): nightly hidden-state snapshot; healthy registration may be good or any Townsfolk/Outsider. Registration survives death, but nightly viewing does not. Poison disables both. The implementation uses the base-edition early Spy wake, after Poisoner on night one and after Monk thereafter.
- [Scarlet Woman](https://wiki.bloodontheclocktower.com/Scarlet_Woman): a healthy living Scarlet Woman must become Imp when the Demon dies with at least five alive immediately before the death. This overrides discretionary starpass selection. Succession resolves before checking victory.
- [Baron](https://wiki.bloodontheclocktower.com/Baron): two extra Outsiders replace two Townsfolk at setup. Death or impairment never reverses the setup change.
- [Imp](https://wiki.bloodontheclocktower.com/Imp): attacks any player on nights after the first. Dead targets produce no additional death. A successful self-kill passes to a living Minion; a blocked attack does not. New Imp does not attack twice in one night.

## Storyteller policy

[Storyteller Advice](https://wiki.bloodontheclocktower.com/Storyteller_Advice) expressly supports assisting the weaker team through permitted choices, while forbidding rule-breaking and preserving player agency. The engine separates mandatory outcomes from optional choices. A small heuristic uses surviving information roles, team population, and votes against the Demon; weighted randomness avoids a predictable always-lie policy. Public role claims can support legal false character results. It does not use an LLM or interpret conversations.

Legal discretion includes impaired information, Spy/Recluse registration, initial information pairings, the red herring at setup, Mayor redirection, and eligible Imp successors. The policy never changes a submitted target, manufactures impairment, relocates the red herring, or alters vote totals. It avoids intentionally bouncing a Mayor attack onto the Demon. After the game, players see actual roles and the discretionary decision journal.

## Digital table conventions

Days last 2, 4, 6, or 10 minutes, chosen before play. All living players can agree to end early; the host can pause daytime. Each nomination has a 40-second public hand-raising window. Hands lock together and are tallied clockwise; this is a disclosed digital adaptation of a physical sweeping vote. The day clock pauses for nominations and grants at least 30 seconds afterward.

The [Butler almanac](https://wiki.bloodontheclocktower.com/Butler) puts responsibility on the player and directs the Storyteller to count accidental illegal votes and correct privately. The implementation follows this approach with private reminders; deliberate violations remain against the rules. Nights wait for player choices and never substitute AI choices for disconnected players. Reconnection is tied to the same browser's private session cookie. Text chat and whispers are built in; voice calls are external.

## Verification and limits

27 scenario tests cover setup counts, privacy, role behavior, victory, voting, and timers. A seven-session HTTP integration test covers concurrent joins, host access, night-to-day progression, whispers, and anonymous access denial. TypeScript and the production build pass. Browser visual QA was unavailable because the browser host was unavailable and native window capture did not return the selected browser. No claim is made of exhaustive rules certification or a completed human playtest.
