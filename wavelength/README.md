# Wavelength

The standalone page is available at `/wavelength/` in both `npm run dev` and the production server (`npm run build` followed by `npm start`). Vite and Express mount the same independent room API. No third-party game service or account is required.

Includes online create/join with six-character codes, public rooms, three game modes, local pass-and-play, a guided demo, custom prompts, dial/number input, dark mode, and optional sound. The in-game layout has player and score lists, a central semicircular dial, and a shared chat panel. Each player has a stable color matching their visual guess marker. Psychics see the actual target needle; guessers never receive the target until the reveal.

Advanced Settings offers a guesser-only timer (Off, 15, 30, 45, 60, or 90 seconds). Online deadlines begin after all clues are submitted and are enforced by the server, even if a player's tab stops updating. Expiry locks each remaining player's latest marker, defaulting to the middle if it was never moved. In local play, each guesser's individual timer begins after Ready; passing the device and giving clues are untimed.

Online state is polled every two seconds, with marker updates sent at most four times per second while dragging. Chat is attributed to the authenticated player, limited to 300 characters per message, and retains the last 100 messages in the room. Rooms are in memory and expire after six hours of inactivity or a server restart. Custom prompts and local totals stay in browser storage; there is no account-backed stats service.

Run `node --test wavelength/*.test.mjs` for rules, target secrecy, multiplayer HTTP integration, and DOM interaction tests.

Visual reference: https://wavelengthonline.io/ (inspected October 17, 2026), plus the user's psychic and turn-result screenshots. The layout, palette, and Fredoka font follow the reference. Game logic and server are implemented independently. This is not affiliated with CMYK Games or the original website. Original website account login, feedback service, translations, and editorial/legal pages are not mirrored.
