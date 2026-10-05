# Medium

A standalone, server-authoritative word association game at `/medium`.

## Run

- `npm run dev:medium`: standalone at http://127.0.0.1:3003/medium/
- Vite proxies `/medium` to this server. Run it alongside `npm run dev`, or use `npm run dev:full`.
- The production `server.js` mounts the same game directly; no extra game process is needed.
- `npm run test:medium`: engine, HTTP, WebSocket privacy/reconnect, and client rendering tests.

## Rules and pairing

2–8 players; 1–20 rounds. Everyone readies before the host starts. Every pair gets two starting words, submits privately, and reveals together. Exact spelling after trimming and lowercasing scores 3/2/1 on attempt 1/2/3. Failed answers become the next prompt. Three failures scores zero. Both players receive the pair's points. The host advances only after every pair finishes. The journal retains pair results and attempt history.

Rotating pairing uses a complete round-robin schedule, including equally rotating byes for odd rosters. Fixed pairing uses adjacent seats in the host's saved order, either manually assigned or shuffled. With odd fixed rosters, the final three players rotate their bye while all other pairs stay fixed. This exception is explained in the lobby. A sit-out earns no points that round.

The built-in list contains over 2,000 words drawn from the repository's existing word bank. Custom lists accept newline, comma, or semicolon delimiters, normalize case, remove blanks/duplicates, and discard invalid entries. Words permit English letters, internal hyphens and apostrophes, up to 30 characters. At least two distinct words are required for custom-only play. Recent starting words are avoided until the pool must be recycled.

## Hosting and session behavior

Use a Node server with WebSocket upgrade support. Serve behind HTTPS for remote play. Room codes are shareable; private reconnect tokens are stored per browser tab. Answers remain server-side until both participants submit. Room and score state live in process memory and disappear on server restart. Disconnected rooms expire after 30 minutes. A disconnected player can reload the same tab to resume; gameplay waits for their return. The host may leave the lobby, transferring ownership to the next player.

No deployment is performed by these changes. Browser visual QA was unavailable in the implementation environment; responsive layouts and reduced-motion support are included.

## Host controls and spectating

The host can kick any other player (including disconnected players) or reset to the lobby at any time. Both actions clear scores and round history while retaining the room code, remaining roster, and word settings. Kicking revokes the removed player's reconnect token and removes their team seat; remaining players ready up again. A kick removes a session, not a permanent identity ban.

Sitting-out players see a live card for every pair, including current words, attempt number, lock-in status, and all revealed attempts. Unrevealed answers stay private. Every round's result screen displays every pair's complete attempt history, with each answer attributed to its player; earlier rounds remain in the connection journal.
