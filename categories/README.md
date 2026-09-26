# Categories

A private multiplayer Categories / Concentration game for 2-12 people. The parent server mounts this folder at **https://quota.wamomath.org/categories/**, alongside Sketch Party. `/categories` redirects to the trailing-slash URL and preserves room invites. No new service, database, build step, or runtime dependencies are needed.

## Run and deploy

- From this folder: `npm start`, then open http://localhost:3220. Use Node 20+. `PORT` overrides the port.
- From the repository: use the existing `npm run build` / `npm start` deployment. Deploy `categories/` and the root `server.js` together to the existing hosting service.
- Tests: install the root dependencies with `npm install`, then run `npm test` from this folder or `npm run test:categories` from the repository. The client regression test uses the development-only `jsdom` dependency to exercise three independent clients through the real HTTP/SSE server under `/categories/`; it does not replace visual browser review.
- Local Vite alone does not serve this game; use the Node server or the standalone command.

One server process holds room state in memory, matching Sketch Party. Use one service instance; rooms reset on server restart/deployment. Unoccupied rooms expire after 15 minutes. Horizontal scaling would require shared state and pub/sub.

## Community judging

Every category is judged by friends. A nonempty answer with letters or numbers is accepted immediately unless it repeats an accepted answer. The game does not attempt to decide whether the answer fits the category, and it makes no external judging requests. No key, subscription, or provider configuration is required.

`catalog.mjs` contains category prompts only, including animals, foods, cities, countries, brands, entertainment, local people, and inside jokes. Add prompts there, or enter custom categories in the lobby. The Local pack is opt-in and is excluded from the random All mix, since those prompts depend on knowing the group.

Duplicate detection ignores capitalization, punctuation, apostrophes, spacing, and accents. It also handles common singular/plural forms for common-noun categories such as Animals and Household objects. Specific answers remain separate: shark and great white shark both count. Names, titles, brands, and custom prompts do not undergo plural stemming; Cars and Car remain distinct movie answers. Semantic synonyms and abbreviations are not guessed: friends can call out an alternate name for an already-used answer. Empty or punctuation-only submissions prompt the player to type an answer while their timer keeps running.

## Fast Call Outs

1. Submit before the server's deadline. The turn timer stops and the answer is accepted immediately.
2. Other players still alive in this round have **2.5 seconds** to press **Call Out**. If nobody does, the next turn starts automatically.
3. With **3 or more active players**, show the disputed answer and the caller. Exactly **one additional active player** can confirm by pressing **Agree - does not fit** within **4 seconds**. The answerer and caller cannot confirm. No confirmation means the answer counts and play continues.
4. With **exactly 2 active players**, the opponent's call-out succeeds immediately. Eliminated players and late spectators do not count toward that threshold and cannot participate.
5. A successful call-out immediately marks the answer invalid and eliminates the answerer. It is removed from duplicate tracking. Visible history strikes it out; hidden history does not expose it after the current interaction.
6. The caller gets **1.5 seconds** to undo, both on initiating a call-out and after it succeeds. Undo restores the answer and player, then moves to the next turn. Round points and the next turn settle after this grace period, so an accidental click cannot award a permanent point.

An unconfirmed call-out expires without penalty. If its caller leaves or all eligible confirmers leave, the answer stands; a departure never silently converts a pending confirmation into an automatic rejection. All actions are authorized and checked against the current turn and server deadline. Repeated confirmations, stale actions, self-confirmations, and spectator participation are rejected.

## Game flow and recovery

- For a specific lineup, set **Category selection → Choose every round**. Each round has its own input: pick a built-in suggestion or type any category (up to 80 characters). Rounds run in that exact order; repeated categories are allowed. Plans support 1–20 rounds, save with the lobby settings, and survive refreshes while the room exists. Every round must have a category before Start.
- To shuffle custom ideas instead, choose the **Custom** pack and enter one category per line. The normal pack/shuffle option remains available.
- After the final round, **Every answer. Every round.** shows each player's submitted answers grouped by round/category, with accepted, repeated, called-out, and timeout outcomes, call-out details, and the round winner. This intentionally reveals answers hidden during play. Blank invalid input and out-of-turn requests are not game answers and are not recorded.
- Every room member can download **Export answers (CSV)** or **Export full game (JSON)**. CSV contains one row per answer/timeout with player, round, category, result, round winner, and final score; spreadsheet formula-like text is escaped. JSON also includes the complete final roster, scores, timestamps, and call-out metadata. Neither format contains session credentials.
- The last completed recap remains available in the lobby and on refresh. Export before the next game starts: recaps are inaccessible during active games and the next completed game replaces the previous recap. As with rooms, exports are not permanently stored on the server and are lost on server restart or room expiration.

- Host controls rounds, turn time, history visibility, packs, a fixed category, custom categories, a per-round category plan, and classic/rhythm mode. Start saves the current settings first.
- Everyone alive takes turns in join order with a rotating first player each round. Only the last survivor earns a point. Everybody returns next round. Highest score wins; ties share the crown. Departed players remain in final standings.
- In hidden-history mode, only the current answer is shown during its short review/Call Out interaction. During the game, snapshots contain no old answers, including rejected answers, and exports are blocked. Accepted answers remain in server memory for duplicate checks. The completed-game recap reveals the full history to the room afterward.
- Concentration uses a synchronized four-beat loop at 120 BPM with visual pulses and optional synthesized audio. Each turn spans the configured time, two beats per second. This is typed rhythm play. Browser/network latency can affect the heard beat.
- Session-scoped credentials resume the same identity after refresh. SSE sends state every half second. A seven-second watchdog and browser wake events recover stale streams. Multiple tabs sharing a credential replace the previous stream; use separate browser contexts for separate players.
- Disconnections retain the player's place for 60 seconds; their turn timer still runs. After that, they leave the round and may resume as spectators until the next round. A disconnected host is replaced after 20 seconds. Explicit Leave invalidates the session. Rooms with fewer than two participants finish after the result screen.

The game has server-side authorization, bounded request sizes, room/player limits, basic throttling, escaped player text, and stale-turn checks. It is intended for private groups of friends playing honestly.
