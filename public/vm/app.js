import RFB from './novnc/core/rfb.js';
const $ = id => document.getElementById(id);
let rfb = null, authenticated = false, configured = false, polling = false;
async function api(path, data) {
  const response = await fetch('/api/vm/' + path, { method: data === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store', headers: data === undefined ? {} : { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(10000) });
  const result = await response.json().catch(() => ({ error: 'The remote desktop backend is unavailable.' }));
  if (!response.ok) { const error = new Error(result.error || 'Request failed.'); error.status = response.status; throw error; }
  return result;
}
function status(badge, message) { $('badge').textContent = badge; $('status').textContent = message; }
function authUi(value) { authenticated = value; $('login-form').hidden = value || !configured; $('connection-actions').hidden = !value; }
async function refresh() {
  if (polling || rfb) return;
  polling = true;
  try {
    const info = await api('config');
    configured = info.configured;
    $('computer-name').textContent = info.label;
    $('setup').hidden = configured;
    $('retry').hidden = true;
    if (!configured) { authUi(false); status('SETUP REQUIRED', 'Configure the private access password, connector token, and website origin on Render.'); return; }
    try {
      const session = await api('session');
      authUi(true);
      $('connect').disabled = !session.online || session.busy;
      status(session.online ? (session.busy ? 'IN USE' : 'CONNECTOR ONLINE') : 'HOME OFFLINE', session.online ? (session.busy ? 'Another viewer is connected. Disconnect it before starting a new session.' : 'Your home connector is online. Connect to open the desktop here.') : 'Start the connector on your home PC and leave it running. This page checks again automatically.');
    } catch (error) {
      if (error.status !== 401) throw error;
      authUi(false);
      status('SIGN IN', 'Enter your private website access password to check your home computer and connect.');
    }
  } catch (error) { status('CONNECTION ERROR', error.message); $('retry').hidden = false; }
  finally { polling = false; }
}
$('login-form').onsubmit = async event => {
  event.preventDefault();
  $('sign-in').disabled = true;
  const password = $('access-password').value;
  $('access-password').value = '';
  try { await api('login', { password }); await refresh(); }
  catch (error) { status('SIGN-IN FAILED', error.message); }
  finally { $('sign-in').disabled = false; }
};
$('sign-out').onclick = async () => {
  try { await api('logout', {}); authUi(false); status('SIGNED OUT', 'The desktop session is closed.'); }
  catch (error) { status('SIGN-OUT FAILED', error.message + ' Try signing out again.'); }
};
function disconnect() { rfb?.disconnect(); }
function connect() {
  if (rfb || !authenticated) return;
  $('connect').disabled = true;
  $('workspace').hidden = false;
  $('landing').hidden = true;
  $('session-status').textContent = 'Connecting to home...';
  $('view-only').checked = false;
  const url = new URL('/api/vm/socket', location.href);
  url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  try {
    const client = new RFB($('desktop-screen'), url.href, { shared: true });
    rfb = client;
    client.scaleViewport = true;
    client.resizeSession = false;
    client.qualityLevel = 5;
    client.compressionLevel = 6;
    client.addEventListener('connect', () => { $('session-status').textContent = 'Connected - click the desktop to control it'; $('vnc-form').hidden = true; client.focus(); });
    client.addEventListener('credentialsrequired', event => {
      if (event.detail.types.some(type => type !== 'password')) { $('session-status').textContent = 'Use password-based VNC authentication on the home server.'; disconnect(); return; }
      $('vnc-form').hidden = false;
      $('vnc-password').focus();
    });
    client.addEventListener('securityfailure', () => { $('session-status').textContent = 'VNC authentication failed. Check the home VNC password.'; });
    client.addEventListener('desktopname', event => { $('desktop-name').textContent = event.detail.name; });
    client.addEventListener('disconnect', event => {
      if (rfb !== client) return;
      rfb = null;
      $('vnc-password').value = '';
      $('clipboard-text').value = '';
      $('vnc-form').hidden = true;
      $('clipboard-form').hidden = true;
      $('workspace').hidden = true;
      $('landing').hidden = false;
      $('desktop-screen').replaceChildren();
      $('connect').disabled = false;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      status('DISCONNECTED', event.detail.clean ? 'Remote desktop disconnected.' : 'Connection ended. Check the home connector, VNC password, or sign in again if your 30-minute session expired.');
      $('retry').hidden = false;
    });
  } catch (error) { rfb = null; $('workspace').hidden = true; $('landing').hidden = false; $('connect').disabled = false; status('CONNECTION FAILED', error.message); }
}
$('vnc-form').onsubmit = event => { event.preventDefault(); const password = $('vnc-password').value; $('vnc-password').value = ''; $('vnc-form').hidden = true; rfb?.sendCredentials({ password }); };
$('cancel-vnc').onclick = disconnect;
$('connect').onclick = connect;
$('disconnect').onclick = disconnect;
$('ctrl-alt-del').onclick = () => rfb?.sendCtrlAltDel();
$('view-only').onchange = () => { if (rfb) rfb.viewOnly = $('view-only').checked; };
$('fullscreen').onclick = () => $('workspace').requestFullscreen?.().catch(() => {});
$('clipboard-toggle').onclick = () => { $('clipboard-form').hidden = false; $('clipboard-text').focus(); };
$('cancel-clipboard').onclick = () => { $('clipboard-form').hidden = true; $('clipboard-text').value = ''; rfb?.focus(); };
$('clipboard-form').onsubmit = event => { event.preventDefault(); if (rfb && !rfb.viewOnly) rfb.clipboardPasteFrom($('clipboard-text').value); $('clipboard-text').value = ''; $('clipboard-form').hidden = true; rfb?.focus(); };
$('retry').onclick = refresh;
setInterval(() => { if (configured && !rfb && !$('access-password').value) refresh(); }, 5000);
window.addEventListener('pagehide', disconnect);
refresh();
