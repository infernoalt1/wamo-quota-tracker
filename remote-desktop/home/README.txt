WAMO HOME DESKTOP CONNECTOR

Run only on your own home PC. This connects OUTBOUND to your website and
stays visible in a terminal. Ctrl+C stops it. No automatic startup is installed.

1. Install Node.js LTS from https://nodejs.org/ on the home computer.
2. Install TightVNC Server with a password and loopback-only connections
   on 127.0.0.1:5900. See your website's /vm/setup.html for the exact settings.
3. In this folder, run:
   npm ci
   node configure.mjs
4. Open the generated render-settings.local.txt and copy all its variables
   into Render Environment for your website. Deploy the updated website code.
   VM_ACCESS_PASSWORD is the password you enter on the website's /vm page.
5. Run npm start and keep this terminal open. Open /vm, sign in, connect,
   then enter your home VNC password when the in-page viewer asks.

Keep config.local.json and render-settings.local.txt PRIVATE. Never upload
or commit them. The configuration generator will not overwrite existing files.
The agent token is separate from the website password and VNC password.
No Google account, Cloudflare access, router port forwarding, or Supabase
changes are needed. Administrator help may be required for host installation.

https://quota.wamomath.org/vm/setup.html
