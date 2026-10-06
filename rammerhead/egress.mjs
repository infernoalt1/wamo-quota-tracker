import http from 'node:http';
import net from 'node:net';
import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
export function publicAddress(address) {
  try { return ipaddr.process(address).range() === 'unicast'; } catch { return false; }
}
export async function resolvePublic(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(host) ? [{address:host,family:net.isIP(host)}] : await lookup(host,{all:true});
  if (!addresses.length || addresses.some(a=>!publicAddress(a.address))) throw Error('Only public internet destinations are available.');
  return addresses[0];
}
export async function createEgress() {
  const sockets=new Set();
  const server=http.createServer(async(req,res)=>{
    try {
      const url=new URL(req.url);
      if(url.protocol!=='http:' || (url.port && url.port!=='80') || url.username || url.password) throw Error('Unsupported destination.');
      const address=await resolvePublic(url.hostname);
      const headers={...req.headers,host:url.host};delete headers['proxy-authorization'];delete headers['proxy-connection'];
      const upstream=http.request({hostname:address.address,family:address.family,port:80,path:url.pathname+url.search,method:req.method,headers,timeout:30000},incoming=>{res.writeHead(incoming.statusCode,incoming.headers);incoming.pipe(res);});
      upstream.on('timeout',()=>upstream.destroy());upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end('Destination unavailable.');});req.on('aborted',()=>upstream.destroy());req.pipe(upstream);
    } catch {res.writeHead(403);res.end('Only public HTTP and HTTPS destinations are available.');}
  });
  server.on('connect',async(req,socket,head)=>{
    socket.on('error',()=>{});
    try {
      const url=new URL('https://'+req.url);
      if(url.port && url.port!=='443')throw Error('Unsupported port.');
      const address=await resolvePublic(url.hostname);
      const upstream=net.connect({host:address.address,port:443,family:address.family});sockets.add(upstream);upstream.once('close',()=>sockets.delete(upstream));
      upstream.setTimeout(60000,()=>upstream.destroy());upstream.on('error',()=>socket.destroy());socket.once('close',()=>upstream.destroy());
      upstream.once('connect',()=>{socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)upstream.write(head);socket.pipe(upstream);upstream.pipe(socket);});
    } catch {socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');}
  });
  server.on('connection',socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  return {address:`127.0.0.1:${server.address().port}`,close(){for(const s of sockets)s.destroy();server.close();}};
}
