# In-page remote desktop at /vm

The viewer is now local noVNC, served by this website. It displays the Windows home desktop inside /vm with keyboard/mouse input, fullscreen, view-only mode, Ctrl+Alt+Del, and explicit text clipboard sending. No iframe or external Google viewer is involved.

Architecture: browser -> same-origin WSS on Render -> authenticated outbound home connector -> 127.0.0.1:5900 on the home PC. Install a password-protected VNC server on the home PC and allow only loopback connections. No public VNC port, Cloudflare tunnel, DNS edit, or Supabase change is needed. The Render server is a trusted relay: TLS protects each internet hop, but this is not end-to-end encryption that hides the screen from the server operator.

Deployment
- Use the existing Node Render web service and exactly ONE running instance. Agent/viewer pairing and sessions are in memory; separate instances cannot pair connections.
- Build: npm run build. Start: npm start. The prebuild copies pinned noVNC sources/licenses and builds a connector ZIP from an explicit source-file allowlist.
- Set VM_PUBLIC_ORIGIN=https://quota.wamomath.org, VM_ACCESS_PASSWORD (at least 16 characters), VM_AGENT_TOKEN (at least 32 characters, different from the password), and optionally VM_COMPUTER_NAME.
- The connector ZIP includes configure.mjs, which generates independent random secrets and private config files when the user runs it at home. It does not transmit or display the secrets in console output.
- Remove obsolete VM_GATEWAY_URL; it is no longer used. VM_ENABLED=false disables the relay after server restart.
- Deploy/restart disconnects sessions. The home agent reconnects with backoff. The browser reconnects only on user action. Video traffic uses Render outbound bandwidth. Free-service availability and performance still depend on the host plan.

Home setup
See /vm/setup.html. Download /vm/home-connector.zip, extract it to a private folder, install Node.js LTS, run npm ci and node configure.mjs, copy generated settings into Render, then npm start. Keep this visible terminal running. Ctrl+C stops remote availability. Install/configure TightVNC as documented, including its own password, loopback-only access, and lock-on-last-disconnect. Administrator help may be required for installation. No automatic startup, shell execution, or arbitrary-network forwarding is implemented.

Authentication
- Separate high-entropy website access password; constant-time comparison, bounded login attempts (10 per 10 minutes per relay), maximum 20 sessions, 30-minute expiry.
- HttpOnly, SameSite=Strict cookie, Secure on HTTPS, restricted to /api/vm. No browser localStorage credentials.
- Exact configured Origin validation on sign-in, sign-out, and viewer WebSocket upgrades.
- Agent token sent in a WSS Authorization header, never a URL; native agents with an Origin header are rejected. Only one agent and one viewer are allowed.
- VNC password is entered in the viewer and not logged/stored by the application. The home connector configuration contains only the agent token, not the website or VNC passwords.
- Session IDs tag every forwarded frame to prevent old connections leaking data into a new viewer. Logout, expiry, and agent loss close the desktop socket. Payload and queue limits bound memory.
- Viewer assets use a CSP and forbid framing. The website owner must continue to treat same-origin scripts and the /compiler trusted-code requirement carefully.

Development
Run npm run prepare:vm, then npm run dev:vm and npm run dev in separate terminals. For local development set VM_PUBLIC_ORIGIN=http://localhost:5173 with the same strong secrets. Vite proxies /api/vm (including WebSockets) to localhost:3001. The production home connector requires HTTPS; the allowLocalTest option exists only for automated tests.

Validation
npm run test:vm checks real HTTP/WebSocket/TCP forwarding, authentication, origin checks, session expiry, cleanup, and coexistence with /game/ws. It does not claim a visual desktop session was tested. No host installation, Windows change, Render deployment, or real-user remote login has been performed automatically.

References
https://novnc.com/noVNC/docs/API.html
https://render.com/docs/websocket
https://www.tightvnc.com/download.php
