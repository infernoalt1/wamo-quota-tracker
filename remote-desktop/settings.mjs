export function vmSettings(env = process.env) {
  let origin;
  try {
    const url = new URL(env.VM_PUBLIC_ORIGIN || '');
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error();
    if (url.protocol !== 'https:' && !(env.NODE_ENV !== 'production' && local && url.protocol === 'http:')) throw new Error();
    origin = url.origin;
  } catch { origin = null; }
  const password = env.VM_ACCESS_PASSWORD || '';
  const agentToken = env.VM_AGENT_TOKEN || '';
  const enabled = env.VM_ENABLED?.toLowerCase() !== 'false';
  return {
    configured: !!(enabled && origin && password.length >= 16 && agentToken.length >= 32 && password !== agentToken),
    origin, password, agentToken, secure: origin?.startsWith('https:') || false,
    label: (env.VM_COMPUTER_NAME?.trim() || 'Home computer').slice(0, 80),
  };
}
