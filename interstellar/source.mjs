import { readdir,readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
// A standard ustar archive: only this integration's source and dependency manifests.
// No environment files, app data, repository credentials, or node_modules.
export async function sourceArchive(){
  const entries=[];
  async function walk(url,prefix){for(const item of await readdir(url,{withFileTypes:true})){if(item.isSymbolicLink())continue;const name=prefix+item.name;if(item.isDirectory())await walk(new URL(item.name+'/',url),name+'/');else entries.push([name,await readFile(new URL(item.name,url))]);}}
  await walk(new URL('./',import.meta.url),'interstellar/');
  for(const file of ['package.json','package-lock.json'])entries.push([file,await readFile(new URL('../'+file,import.meta.url))]);
  const chunks=[];
  for(const [name,data] of entries){
    const header=Buffer.alloc(512);let filename=name,prefix='';
    if(Buffer.byteLength(name)>100){const index=name.lastIndexOf('/');prefix=name.slice(0,index);filename=name.slice(index+1);}
    if(Buffer.byteLength(filename)>100||Buffer.byteLength(prefix)>155)throw Error('Source filename too long.');
    header.write(filename,0,100);header.write('0000644\0',100);header.write('0000000\0',108);header.write('0000000\0',116);
    header.write(data.length.toString(8).padStart(11,'0')+'\0',124);header.write('00000000000\0',136);header.fill(32,148,156);header.write('0',156);header.write('ustar\0',257);header.write('00',263);header.write(prefix,345,155);
    const sum=header.reduce((a,b)=>a+b,0);header.write(sum.toString(8).padStart(6,'0')+'\0 ',148);
    chunks.push(header,data,Buffer.alloc((512-data.length%512)%512));
  }
  chunks.push(Buffer.alloc(1024));return gzipSync(Buffer.concat(chunks));
}
