const $ = id => document.getElementById(id);
async function load() {
  $('connect').hidden = true;
  $('connect').removeAttribute('href');
  $('setup').hidden = true;
  $('retry').hidden = true;
  $('badge').textContent = 'CHECKING SETUP';
  $('status').textContent = 'Checking connection setup…';
  try {
    const response = await fetch('/api/vm/config', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Configuration unavailable');
    const config = await response.json();
    $('computer-name').textContent = config.label || 'Home computer';
    if (!config.configured) {
      $('badge').textContent = 'SETUP REQUIRED';
      $('status').textContent = config.reason === 'invalid-configuration' ? 'The remote desktop address needs correcting. Follow the setup guide to update it.' : 'The website owner has disabled the remote desktop launch button.';
      $('setup').hidden = false;
      $('retry').hidden = false;
      return;
    }
    const destination = new URL(config.gatewayUrl);
    if (destination.protocol !== 'https:' || destination.username || destination.password || destination.search || destination.hash) throw new Error('Invalid configuration');
    $('connect').href = destination.href;
    $('connect').hidden = false;
    const google = destination.origin === 'https://remotedesktop.google.com';
    $('connect').textContent = google ? 'Open Chrome Remote Desktop ↗' : 'Sign in & connect ↗';
    $('badge').textContent = google ? 'GOOGLE SIGN-IN' : 'GATEWAY CONFIGURED';
    $('status').textContent = google ? 'Sign in with the Google account used on your home PC, then select your computer. Complete home setup first if it is not listed.' : 'Your sign-in gateway is configured. It will check whether your home computer is available when you connect.';
  } catch {
    $('badge').textContent = 'SETUP UNAVAILABLE';
    $('status').textContent = 'Could not read the server configuration. Check that the website backend is running, then try again.';
    $('setup').hidden = false;
    $('retry').hidden = false;
  }
}
$('retry').onclick = load;
load();
