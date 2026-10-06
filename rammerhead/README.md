# Rammerhead / Marine Field Notes

`/rammerhead` starts as an illustrated scientific field journal about hammerhead sharks. Enter **Up, Up, Down, Down, Left, Left, Right, Right** to reveal the Rammerhead browser. Footer arrow buttons provide the same sequence on touch devices. Repeated held keys are ignored, unrelated keys clear the sequence, and a six-second pause resets it. Refresh always returns to the research page. **Back to research** removes the browser frame; Escape also works while focus is in the outer page.

## Local use

Run `npm run dev:rammerhead` and visit `http://localhost:3005/rammerhead`. The real Rammerhead engine starts on `127.0.0.1:3004` when unlocked. `RAMMERHEAD_PORT` and `RAMMERHEAD_LOCAL_PORT` override these ports. Vite proxies `/rammerhead` to port 3005; `npm run dev:full` includes that server. The production Node app mounts the page directly.

`npm run test:rammerhead` checks the exact sequence, mobile controls, reset, errors, real engine sessions, HTTP routes, and private-network destination blocking.

## Production hosting

For this project, the entry is **https://quota.wamomath.org/rammerhead**. The proposed companion hostname is **rammerhead.quota.wamomath.org**; see `hosting.env.example`. It must be added in DNS and in the existing hosting service before it will resolve and receive HTTPS traffic. No separate paid server is necessary.

Rammerhead rewrites URLs at the origin root; it cannot simply be mounted under an Express path. Arbitrary website scripts also must not share the main application's origin. The user-facing page remains `/rammerhead`, while its sandboxed browser uses a separate hostname.

1. Add a second HTTPS hostname to the **same Node service** (preferably on a separate registrable domain, without app cookies).
2. Set `RAMMERHEAD_PROXY_ORIGIN=https://your-proxy-host.example` on that service. Use an origin only, without a path.
3. Route both hostnames to the service, preserving the original Host header and WebSocket upgrades. The configured proxy hostname is dispatched to Rammerhead before app middleware. Other hostnames serve the normal app.
4. Restart the service. Unlock `/rammerhead` on the main hostname.

Remote access without that setting returns a setup error rather than a nonworking localhost frame. No DNS, domain, or public deployment changes are made automatically. The arrow sequence is an interface Easter egg, **not authentication**: users can inspect the source or open the proxy hostname directly. Restrict access at your hosting gateway if a private instance is needed.

## Behavior and limits

- Uses the actual MIT-licensed [Rammerhead 1.2.64](https://github.com/binary-person/rammerhead), installed from npm, including its shipped browser rewrite assets.
- Sessions live in memory, expire after 30 minutes idle or four hours total, and reset on restart. New session revokes the current session. Closing the outer frame does not immediately erase its server session; it expires normally.
- Public HTTP/HTTPS destinations on ports 80/443 only. A loopback-only egress proxy resolves and pins public destination IPs; private, loopback, link-local and reserved addresses are rejected on every connection, including redirect destinations.
- Session creation is bounded to 60 per minute and 200 active sessions. Proxy traffic/session IDs are not logged by this integration.
- One proxy origin is used; sites requiring Rammerhead's dual-origin emulation, popups, unsupported browser APIs or particular authentication flows may not work. The sandbox blocks top-level navigation and popups.
- Rammerhead and its Hammerhead dependency currently have upstream npm audit findings with no automatic fix. This integration does not claim to resolve upstream vulnerabilities. Keep it isolated from sensitive services and review upgrades before public deployment.

Scientific references appear directly in the field journal and link to NOAA Fisheries. The SVG is an original stylized illustration, not a measurement diagram.
