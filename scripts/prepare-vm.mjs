import fs from 'node:fs';
import path from 'node:path';
const target = path.resolve('public/vm/novnc');
const source = path.resolve('node_modules/@novnc/novnc');
fs.mkdirSync(target, { recursive: true });
function copy(from, to) {
  if (fs.statSync(from).isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const name of fs.readdirSync(from)) copy(path.join(from, name), path.join(to, name));
  } else fs.copyFileSync(from, to);
}
for (const name of ['core', 'vendor', 'docs', 'AUTHORS', 'LICENSE.txt']) copy(path.join(source, name), path.join(target, name));

// Small portable ZIP writer (stored entries). Only the explicit non-secret source
// files below are packaged; config.local.json and node_modules are never included.
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
}
const local = [], central = [];
let offset = 0;
const names = ['agent.mjs', 'configure.mjs', 'package.json', 'package-lock.json', 'config.example.json', 'README.txt'];
for (const name of names) {
  const filename = Buffer.from('wamo-home-connector/' + name);
  const data = fs.readFileSync(path.join('remote-desktop/home', name));
  const crc = crc32(data);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x21, 12);
  header.writeUInt32LE(crc, 14); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(filename.length, 26);
  local.push(header, filename, data);
  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt16LE(0x21, 14);
  entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(data.length, 20); entry.writeUInt32LE(data.length, 24); entry.writeUInt16LE(filename.length, 28); entry.writeUInt32LE(offset, 42);
  central.push(entry, filename);
  offset += header.length + filename.length + data.length;
}
const directory = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50); end.writeUInt16LE(names.length, 8); end.writeUInt16LE(names.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
fs.writeFileSync('public/vm/home-connector.zip', Buffer.concat([...local, directory, end]));
console.log('Prepared local noVNC sources/licenses and the home connector ZIP (no secrets).');
