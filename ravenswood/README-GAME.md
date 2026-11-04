# Ravenswood · Trouble Brewing

A multiplayer, server-authoritative Trouble Brewing table for 5–15 human players. All 22 characters are supported, with a rules-based automatic Storyteller and postgame decision audit. No API key or external model is required.

Create a room, copy the invitation, and have friends join from separate devices/browser profiles. Start with 5–15 players. Read the private journal at night; use public chat, whispers and private group chats by day. The host also plays and cannot inspect other players' roles. The host can remove players in the lobby (they may rejoin with the code), and after a game can start a new one in the same room, so the link stays the same. Use the same browser to recover your seat. A lost session cookie cannot be recovered by knowing a player's name.

See `docs/RULES-RESEARCH.md` and `docs/CHARACTERS.md` for sources, rules, balancing policy, and digital conventions. This is an unofficial implementation, not affiliated with The Pandemonium Institute. Character descriptions are paraphrased, with links to the official wiki.

## Development

The game is served at `/botc/` by the parent site. From the repository root, `npm run dev` starts the local site and `npm run build` builds it, using `botc/index.html` as the page entry. `npm run test:botc` runs rules tests. With a server running, `TEST_ORIGIN=<origin> node ravenswood/tests/api-smoke.mjs` exercises seven independent player sessions.

`server.mjs` is the API. Rooms are held in server memory, expire after six idle hours, and do not survive a restart. A private HttpOnly SameSite cookie identifies each browser's player seat; serializers omit hidden state and filter whispers. No game state is trusted from clients. Timers progress on incoming polling requests. Rooms are not publicly listed. Room codes admit players only before game start.

Limitations: no integrated voice/video, no bots replacing players, no cross-device seat recovery, and no moderation console. Balancing is heuristic, not conversational AI. Public votes use a timed hand-lock adaptation. Browser QA and human group playtesting remain outstanding.
