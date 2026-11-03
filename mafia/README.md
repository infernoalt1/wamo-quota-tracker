# Mafia

Open `/mafia/`. Create a room, share its invitation link, and play with 3–15 people on separate devices (6–15 recommended). No account, database, or external API is required.

Production uses the existing `node server.js` entry point; deploy the `mafia/` directory with the server. For isolated development, `npm run dev:mafia` starts port 3006, and `npm run dev` proxies `/mafia` and its WebSocket there. `MAFIA_PORT` overrides the standalone port (update the Vite proxy if using it).

`engine.mjs` owns the rules and the state machine: Lobby, Role Reveal, Night, Day Announcement, Discussion, Voting, Elimination, Game Over. Every phase change goes through a table of legal transitions, and every player action is checked on the server. `snapshot()` is the only way state leaves the server: each socket gets its own view, built field by field, so a role, a pending vote, or a private chat isn't sent to anyone who may not see it. Night actions and private chat only update the people involved, so a client can't detect them from traffic either.

Session credentials are random server-generated tokens. Refreshing or losing the connection returns the same seat, and the main menu offers a rejoin after closing the tab. Hosting moves to a connected player on disconnection. Rooms and their event logs live in memory and expire after 30 minutes without connected players; a server restart clears rooms. Use one server instance, as with the other in-memory party games.

## Choices where the rules left room

- **Mafia ties:** the leader's vote breaks a tie if it is on a tied player, else the lowest seat wins. Moving their vote onto a tied player always settles the tie, so the leader needs no extra control.
- **Role table:** 11, 13, and 14 players aren't in the rules table, so they use 2, 3, and 3 Mafia. Below 6 players, one Mafia member is dealt and the Doctor, Detective, and Jester are added in that order while seats remain.
- **Player count:** this is the seat limit. Recommended deals follow whoever is actually seated. Custom deals must add up to the seated count before the game can start.
- **Ready:** everyone but the host must be ready and connected before the host can start.
- **Vote results:** once a vote closes, totals and who voted for whom are public.
- **Chat:** open to the living from morning until the next night, including during voting. Spectators who join mid-match read public chat only, so a player can't open a second tab to read dead chat.
- **Dead players:** they get dead chat, but no hidden roles or night choices until the game ends. They could otherwise pass those to a living friend outside the game.
- **Private information after the game:** roles are shown to everyone, but Mafia chat, dead chat, and night choices stay private.

Run `npm run test:mafia` for rule, privacy, and browser-client flow tests.
