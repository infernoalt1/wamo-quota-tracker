# Categories

A private multiplayer Categories / Concentration game for 2–12 people. The parent server mounts this folder at **https://quota.wamomath.org/categories/**, alongside Sketch Party. `/categories` redirects to the trailing-slash URL and preserves room invites. No new service, database, build step, or dependencies are needed.

## Run and deploy

- From this folder: `npm start`, then open http://localhost:3220. Use Node 20+. `PORT` overrides the port. The standalone command reads your process environment; to load an existing root `.env` explicitly, run `node --env-file=../.env server.mjs` on Node 20.6+.
- From the repository: use the existing `npm run build` / `npm start` deployment. Commit and deploy `categories/` **and the changed root `server.js`** to the existing hosting service.
- Tests: `npm test` from this folder, or `npm run test:categories` from the repository.
- Local Vite alone does not serve this game; use the Node server or the standalone command.

This is one-process, in-memory multiplayer, matching the existing Sketch Party deployment. Use one service instance; rooms reset on server restart/deployment. Unoccupied rooms expire after 15 minutes. Horizontal scaling would require shared state and pub/sub.

## Answer validation

Set **`GEMINI_API_KEY`** in the hosting service's server environment to enable AI for open-ended categories. The existing key can be reused. Optionally set `CATEGORIES_AI_MODEL` (default `gemini-2.5-flash`) to a compatible Gemini model. The key stays on the server; only the current category and submitted answer go to Gemini, without usernames or room codes. Requests use the official [generateContent REST API](https://ai.google.dev/api/generate-content) with JSON responses and a 6.5-second timeout. Live provider validation requires an actual configured key and working model.

Without a key, the lobby explicitly says that open-ended answers use group voting. AI errors, timeouts, and uncertainty also go to a vote, even if optional challenges are off. Automatic mode never silently treats an unvalidated answer as AI-approved. Group mode uses deterministic lists when available and votes on other answers.

Country answers cover the 193 UN members and two observer states. Planets cover the eight IAU planets (not dwarf planets). US states and NBA teams have finite lists. Other categories have open-ended AI/group judging with common-answer seeds. Add categories or accepted aliases in `catalog.mjs`; `=` separates aliases in a `|`-separated list. Duplicate detection uses local Unicode/case/punctuation normalization plus known aliases, never AI. It does not claim to identify every semantic synonym or spelling error.

## Rules and recovery

- Host controls rounds, turn time, history visibility, packs, a fixed category, custom categories (one per line), validation, challenges, and classic/rhythm mode. Changes save in the lobby; Start saves the current form first.
- Server deadlines determine timeliness. Submitting locks the turn immediately while validation runs. Valid/invalid verdicts are briefly visible; with challenges enabled, players have three seconds to request a group vote. Answerers can appeal invalid verdicts.
- Every other participant, including eliminated players and spectators, can vote once. A strict majority must reject; ties and abstentions favor the answer. A vote expires after nine seconds. Duplicates and timeouts cannot be challenged.
- Hidden-history mode exposes the current answer only during the short review/vote, then removes it from subsequent snapshots. No old answers or AI explanations containing them are sent to clients. Accepted answers remain server-side for duplicate checks.
- Concentration uses a synchronized four-beat loop at 120 BPM, visual pulses and optional synthesized audio. Each turn spans the configured number of seconds (two beats per second); submissions must arrive within that turn. This is typed rhythm play, not voice recognition or microphone timing. Browser/network latency can affect the heard beat.
- Everyone alive takes turns in join order, with a rotating first player each round. Only the round's last survivor earns one point. All players return for the next category. New arrivals watch until then. Highest score wins; ties share the crown. Final results include departed players.
- Session-scoped credentials resume the same identity after refresh or reconnect. SSE sends snapshots every half second. A seven-second watchdog and browser wake events resume stale streams. Multiple tabs sharing a credential replace the previous stream; use separate browser contexts for separate players.
- Disconnected players retain their place for 60 seconds; their current timer still runs. After that they leave the round and may reconnect as spectators until the next round. A disconnected host is replaced by a connected player after 20 seconds. Explicit Leave invalidates that session. Rooms with fewer than two players finish after the round result.

The game has server-side authorization, bounded request sizes, room/player limits, basic per-connection throttling, escaped player text, and stale-turn checks. It is designed for private friend groups, without accounts or public-room discovery.
