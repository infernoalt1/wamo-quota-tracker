# Wavelength

The standalone page is available at `/wavelength/` in both `npm run dev` and the production server (`npm run build` followed by `npm start`). Vite and Express mount the same independent room API. No third-party game service or account is required.

Includes online create/join with six-character codes, public rooms, three game modes, local pass-and-play, a guided demo, custom prompts, dial/number input, dark mode, and optional sound. Online state is polled every two seconds. Rooms are in memory and expire after six hours of inactivity or a server restart. Custom prompts and local totals stay in browser storage; there is no account-backed stats service.

Run `node --test wavelength/*.test.mjs` for rules, target secrecy, multiplayer HTTP integration, and DOM interaction tests.

Visual reference: https://wavelengthonline.io/ (inspected October 17, 2026). The layout, palette, and Fredoka font follow the reference. Game logic and server are implemented independently. This is not affiliated with CMYK Games or the original website. Original website account login, feedback service, translations, timers, and editorial/legal pages are not mirrored.
