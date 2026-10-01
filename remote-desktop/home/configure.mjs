import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = new URL('./', import.meta.url);
const configFile = new URL('config.local.json', root);
const renderFile = new URL('render-settings.local.txt', root);
if (fs.existsSync(configFile) || fs.existsSync(renderFile)) {
  console.error('Setup files already exist. Keep them to preserve the current credentials. Edit them manually if you need to change your setup.');
  process.exitCode = 1;
} else {
  const website = new URL(process.argv[2] || 'https://quota.wamomath.org');
  if (website.protocol !== 'https:' || website.username || website.password || website.pathname !== '/' || website.search || website.hash) throw new Error('Provide an HTTPS website origin, with no credentials or path.');
  const agentToken = crypto.randomBytes(32).toString('base64url');
  const password = crypto.randomBytes(24).toString('base64url');
  fs.writeFileSync(configFile, JSON.stringify({ website: website.origin, agentToken, vncPort: 5900 }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  fs.writeFileSync(renderFile, `VM_ENABLED=true\nVM_PUBLIC_ORIGIN=${website.origin}\nVM_ACCESS_PASSWORD=${password}\nVM_AGENT_TOKEN=${agentToken}\nVM_COMPUTER_NAME=Home computer\n`, { flag: 'wx', mode: 0o600 });
  console.log('Created private setup files in:', fileURLToPath(root));
  console.log('Open render-settings.local.txt and copy its values into Render Environment. Use VM_ACCESS_PASSWORD to sign in on /vm.');
  console.log('Keep both generated files private. Do not upload them to the website or commit them. No network connection was made.');
}
