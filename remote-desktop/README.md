# Remote desktop at /vm

The launcher defaults to `https://remotedesktop.google.com/access/`. This is for the user's Windows 11 home PC and Render site at `quota.wamomath.org`, without access to Cloudflare. No domain, tunnel, or Supabase changes are needed.

The full walkthrough is `/vm/setup.html`. Home host installation, Google enrollment, and a real connection test still require the user's devices and account. No host software has been installed by this website change. Windows may require administrator approval.

Deploy the repository to the existing Render Node service. If `VM_GATEWAY_URL` points at the earlier Cloudflare hostname, remove that override or replace it with the Google URL above. An unset or blank URL uses Google. `VM_COMPUTER_NAME` optionally changes the label. `VM_ENABLED=false` hides the launch button; revoke the host in Google to disable actual remote access.

`/api/vm/config` returns only public configuration with `Cache-Control: no-store`. Vite development reads the same settings from `.env`. A custom URL must use HTTPS without credentials, query parameters, or fragments. Invalid explicit configuration fails closed.

WAMO is a launcher, not a VM host, desktop proxy, or authentication service. It opens the provider in a separate tab with `noopener noreferrer`. Credentials and PINs belong in Google's interface, never WAMO. The page does not claim the home PC is enrolled or online.

`check-home.ps1` is an optional read-only Windows service check. Run it on the home PC with `powershell -File .\remote-desktop\check-home.ps1` if local script policy permits. It does not inspect credentials or test a connection.

Run `npm run test:vm` for configuration and launcher tests. Actual desktop testing requires the enrolled home PC and user sign-in.

Official reference: https://support.google.com/chrome/answer/1649523?hl=en
