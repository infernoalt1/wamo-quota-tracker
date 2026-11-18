# Ravenswood · Trouble Brewing

A multiplayer, server-authoritative Blood on the Clocktower table for 5–15 human players. The host picks Trouble Brewing (22 characters) or Bad Moon Rising (25 characters) in the lobby. All characters are supported, with a rules-based automatic Storyteller and postgame decision audit. No API key or external model is required.

Create a room, copy the invitation, and have friends join from separate devices/browser profiles. Start with 5–15 players. Read the private journal at night; use public chat, whispers and private group chats by day. The host also plays and cannot inspect other players' roles. The host can remove players in the lobby (they may rejoin with the code), and can send the table back to the lobby at any time, even mid-game, so the link stays the same and new players can join. Characters are dealt again at the next start. Use the same browser to recover your seat. A lost session cookie cannot be recovered by knowing a player's name.

See `docs/RULES-RESEARCH.md` and `docs/CHARACTERS.md` for sources, rules, balancing policy, and digital conventions. This is an unofficial implementation, not affiliated with The Pandemonium Institute. Character descriptions are paraphrased, with links to the official wiki. The icons in `public/botc/icons/` are official art from that wiki, resized to 256 px, and belong to The Pandemonium Institute.

## Development

The game is served at `/botc/` by the parent site. From the repository root, `npm run dev` starts the local site and `npm run build` builds it, using `botc/index.html` as the page entry. `npm run test:botc` runs rules tests. With a server running, `TEST_ORIGIN=<origin> node ravenswood/tests/api-smoke.mjs` exercises seven independent player sessions.

`server.mjs` is the API. Rooms are held in server memory, expire after six idle hours, and do not survive a restart. A private HttpOnly SameSite cookie identifies each browser's player seat; serializers omit hidden state and filter whispers. No game state is trusted from clients. Timers progress on incoming polling requests. Rooms are not publicly listed. Room codes admit players only before game start.

Accounts are optional and live in `lib/accounts.mjs`, in a `botc_accounts` table separate from the quota tracker's users. A logged-in player's cookie holds their account's session, so seats follow the account between devices. Without `DATABASE_URL` the login option is hidden and everyone plays as a guest. There is no email, so a forgotten password has to be reset in the database.

The leaderboard lives in `lib/leaderboard.mjs`. When a game ends, the server saves it to `botc_games` and `botc_game_players`, with one row per logged-in player, but only if at least three players at the table are logged in, so one person cannot farm wins with several browser profiles. Guests are left out. A game the host sends back to the lobby before it ends is never saved. Wins follow the player's team at the end of the game, so a Goon who turned evil wins with evil. The board is all-time, can be filtered by game mode, and ranks players by win rate once they have five games. Everyone with fewer games is listed below the ranked players. Each name opens a profile showing the player's record by team and mode, their most-played characters and recent games.

Limitations: no integrated voice/video, no bots replacing players, and no moderation console beyond the host's kick and hide-picture controls. Balancing is heuristic, not conversational AI. Public votes use a timed hand-lock adaptation. Browser QA and human group playtesting remain outstanding.
