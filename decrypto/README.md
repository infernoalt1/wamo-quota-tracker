# Decrypto

Open `/decrypto/`. Create a room, share its invitation link, and split 4–8 players into two teams. Up to 16 people may join including spectators. No account, database, or external API is required.

In the lobby, the host can choose **Classic** or **Custom** under **Word list**. Paste 8–100 unique words or phrases separated by commas, semicolons, or newlines, then click **Save word list**. Entries may contain letters, numbers, spaces, apostrophes, and hyphens (40 characters maximum). Case-insensitive duplicates are removed. Eight different entries are randomly dealt across the two teams. The saved choice persists for rematches; only the lobby host receives the custom pool for editing. A larger pool makes it harder to infer opposing words. Lists cannot change during a game.

Production uses the existing `node server.js` entry point; deploy the `decrypto/` directory with the server. For isolated development, `npm run dev:decrypto` starts port 3002. `npm run dev` proxies `/decrypto` and its WebSocket to that server. `DECRYPTO_PORT` overrides the standalone port (update the Vite proxy if using it).

The server owns words, codes, scoring, roles, and phase transitions. Each socket receives a personalized snapshot. Session credentials are random server-generated tokens stored in the browser's session storage; refresh and temporary network loss resume the same seat. Opening the same session elsewhere replaces the old socket. Host responsibility moves to a connected player on disconnection. Rooms live in memory and expire after 30 minutes without connected players; a server restart clears rooms. Use one server instance, as with the other in-memory party games.

Team changes, spectating, and host removal are available in the lobby. Active-game joins spectate. Midgame team switching is intentionally blocked because it reveals both teams' words. The host can reset to the lobby at any point to regroup and deal fresh words. A disconnected seat is retained during play; refresh to reclaim it. Returning to the lobby lets the host remove abandoned seats.

Gameplay follows the standard two-team rules: rotating encryptors, four fixed words, three distinct digits, no first-round interceptions, Blue then Amber transmissions, two-token win/loss conditions checked after both transmissions, eight-round limit, score and keyword tiebreaks, and shared victory if still tied. This version is untimed. Keyword tiebreaks require exact case-insensitive words in matching positions. Players judge semantic clue rules; the server rejects literal keywords and repeated clues. Chat supports public and private team channels, and encryptors cannot send chat until their own transmission resolves. Use external voice chat if desired; encryptors must remain silent there too.

Rule reference: https://www.rulespal.com/decrypto/rulebook. Independent adaptation of the game by Thomas Dagenais-Lespérance, published by Scorpion Masqué. Word pool and interface are original; no official assets are bundled.

Run `npm run test:decrypto` for rule, privacy, WebSocket, and browser-client flow tests.
