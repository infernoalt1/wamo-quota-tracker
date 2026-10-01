<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1iZftsT3Nd-jxKPSUg3tdNSJbS2vOFIKZ

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## Remote desktop

Open `/vm` for an embedded noVNC desktop viewer and `/vm/setup.html` for the Windows setup guide. The home connector makes an outbound WebSocket connection to the existing Render server; no Cloudflare access, external viewer, or router port forwarding is needed. Configure a password-protected loopback-only VNC server on the home PC, then set `VM_PUBLIC_ORIGIN`, `VM_ACCESS_PASSWORD`, and `VM_AGENT_TOKEN` on Render. Use one Render instance. See [remote-desktop/README.md](remote-desktop/README.md). Run `npm run test:vm` for authenticated relay and connector tests.

## Hollow Knight launcher

Open `/hollowknight` (redirects to `/hollowknight/`). The supplied Unity port and a standalone launcher live in `public/hollowknight/` and are copied to `dist` by the normal Vite build. Deploy the entire directory: it contains **about 1.01 GB** of game assets. The hosting service needs enough disk space and bandwidth for this; the app does not fetch game assets from a third-party host.

The launcher downloads up to three files at once, checks each file's byte length and SHA-256 hash, and stores completed files in a versioned browser Cache Storage cache. Pause, interrupted downloads, and retries retain completed files. Subsequent launches read data/wasm chunks locally and assemble Blob URLs for Unity; they still require engine initialization and sufficient memory. Cutscenes support cached byte-range requests. A service worker scoped to `/hollowknight/` caches the launcher and serves local assets, including offline after a completed installation. Offline bookmarks should use the trailing-slash URL.

HTTPS (or localhost), WebGL 2, browser storage, and a desktop browser are required. Persistent storage is requested but browsers can deny it; private browsing, browser cleanup, or eviction can remove the cache. **Clear downloaded files** deletes only this game's asset caches and preserves IndexedDB game saves. Saves are local to the browser and origin, not synced to WAMO accounts. The original port credits remain in the launcher and bundled README.

`npm run build` automatically regenerates the integrity manifest; use `npm run prepare:hollowknight` after editing files during development too. Asset and launcher versions are separate, so a launcher-only update does not force another 1 GB download. Service worker updates wait for existing game tabs to close. Run `npm run test:hollowknight` for download, integrity, resume, range-serving, and launcher checks. These tests do not validate actual Unity rendering or full gameplay.

## Cookie Clicker

The supplied Cookie Clicker 2.058 archive is served directly at `/cookieclicker/` (with `/cookieclicker` redirecting there), without an iframe. Vite copies `public/cookieclicker/` into the production build; deploy with the existing `npm run build` and Node server workflow. Images, fonts, sounds, translations, and minigames are bundled locally. Original credits and notices are preserved. Copied advertising, tracking, and Cloudflare injection scripts are removed; remote metadata is replaced with local defaults, so live upstream update notifications, community names, and live herald counts are unavailable.

Progress saves in this browser under `CookieClickerGame-WAMO`. Existing saves from another domain do not transfer automatically: use the game's Options → Export save / Import save. Game assets and code remain attributed to their original creators; the supplied source includes a notice requesting no rehosting. No deployment or permission grant is implied by this local integration.

Run `npm run test:cookieclicker` to check local assets, routing, and the game startup/click/save flow.

## HTML compiler

Open `/compiler` (or `/compiler/`) in development or on the deployed site. Edit HTML, CSS, and JavaScript, then choose **Run code** to open the result in a new browser tab without an iframe. The editor saves drafts locally and can download a combined `index.html`. Full HTML documents, fragments, and inline scripts are supported; use absolute URLs for external assets. JavaScript in the JavaScript tab runs as a classic script after the HTML. Preview code is not sandboxed and shares the site's origin, so only run trusted code. Run `npm run test:compiler` to check document generation and script execution.

## Categories party game

The Node server also serves the standalone multiplayer game in [`categories/`](categories/README.md) at `/categories/`, alongside `/sketch-party/`. Deploy the folder and root `server.js` together using the existing hosting setup. Run `npm run test:categories` for game tests. Friends judge every category through Call Outs; no external service or API key is needed.
