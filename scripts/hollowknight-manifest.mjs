import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = path.resolve('public/hollowknight');
const assets = [];
async function hashFile(file) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else {
      const relative = path.relative(root, file).replaceAll('\\', '/');
      const ext = path.extname(file);
      const type = ({ '.js': 'text/javascript', '.json': 'application/json', '.mp4': 'video/mp4', '.txt': 'text/plain', '.png': 'image/png', '.ico': 'image/x-icon', '.css': 'text/css' })[ext] || 'application/octet-stream';
      assets.push({ path: relative, size: fs.statSync(file).size, sha256: await hashFile(file), type });
    }
  }
}
for (const dir of ['Build', 'StreamingAssets', 'TemplateData']) await walk(path.join(root, dir));
assets.sort((a, b) => a.path.localeCompare(b.path));
const assetVersion = createHash('sha256').update(JSON.stringify(assets)).digest('hex').slice(0, 16);
const hash = createHash('sha256').update(assetVersion);
for (const name of ['index.html', 'launcher.js', 'launcher.css', 'cache-core.js', 'sw.js']) hash.update(fs.readFileSync(path.join(root, name)));
const manifest = { version: hash.digest('hex').slice(0, 16), assetVersion, assets };
fs.writeFileSync(path.join(root, 'manifest.js'), 'globalThis.HK_MANIFEST = ' + JSON.stringify(manifest, null, 2) + ';\n');
console.log(`Hollow Knight: ${assets.length} verified assets, ${(assets.reduce((sum, asset) => sum + asset.size, 0) / 1e9).toFixed(2)} GB; version ${manifest.version}`);
