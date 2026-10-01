export function getVmConfig(env = process.env) {
  const raw = env.VM_GATEWAY_URL?.trim() || 'https://remotedesktop.google.com/access/';
  const label = (env.VM_COMPUTER_NAME?.trim() || 'Home computer').slice(0, 80);
  if (env.VM_ENABLED?.trim().toLowerCase() === 'false') return { configured: false, label, reason: 'disabled' };
  try {
    const url = new URL(raw);
    // The site launches one administrator-configured HTTPS destination, never a user-supplied proxy.
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Invalid gateway URL');
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]') throw new Error('Local address');
    return { configured: true, label, gatewayUrl: url.href };
  } catch { return { configured: false, label, reason: 'invalid-configuration' }; }
}
