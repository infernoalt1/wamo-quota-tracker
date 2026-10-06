import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';
import { mountGhGames } from './vendor/games.js';
import { sourceArchive } from './source.mjs';
const require=createRequire(import.meta.url),root=fileURLToPath(new URL('.',import.meta.url));
export const BASE='/interstellar/browser';
export function setupInterstellar(app,server) {
  Object.assign(wisp.options,{allow_loopback_ips:false,allow_private_ips:false,allow_direct_ip:false,allow_udp_streams:false,port_whitelist:[80,443],stream_limit_total:100,stream_limit_per_host:30});
  const sockets=new Set();
  const upgrade=(req,socket,head)=>{
    if(req.url?.split('?')[0]!=='/interstellar/wisp/')return;
    try{if(req.headers.origin && new URL(req.headers.origin).host!==req.headers.host){socket.destroy();return;}}catch{socket.destroy();return;}
    if(sockets.size>=100){socket.destroy();return;}
    sockets.add(socket);socket.once('close',()=>sockets.delete(socket));socket.on('error',()=>{});
    wisp.routeRequest(req,socket,head);
  };
  server.on('upgrade',upgrade);
  app.get(['/rammerhead','/rammerhead/*'],(_req,res)=>res.status(410).type('text').send('This page has been removed.'));
  app.get(['/interstellar','/interstellar/'],(_req,res)=>res.sendFile(path.join(root,'index.html')));
  for(const file of ['app.js','style.css'])app.get('/interstellar/'+file,(_req,res)=>res.sendFile(path.join(root,file)));
  app.get('/interstellar/source.tar.gz',async(_req,res,next)=>{try{res.type('application/gzip').attachment('interstellar-source.tar.gz').send(await sourceArchive());}catch(error){next(error);}});
  app.get('/interstellar/health',(_req,res)=>res.json({ok:true,engine:'Interstellar',wisp:'/interstellar/wisp/'}));
  app.get(BASE, (req,res,next)=>req.path.endsWith('/')?next():res.redirect(308,BASE+'/'));
  const browser=express.Router();
  browser.use((_req,res,next)=>{
    res.set('X-Content-Type-Options','nosniff');res.set('Referrer-Policy','no-referrer');
    // Only this proxy subtree may be controlled, never the quota app or other games.
    res.set('Service-Worker-Allowed',BASE+'/uv/');next();
  });
  const staticOptions={setHeaders(res,file){if(/\.(m?js)$/.test(file))res.type('application/javascript');if(file.endsWith('.wasm'))res.type('application/wasm');}};
  browser.get('/baremux/index.mjs',(_req,res)=>res.type('application/javascript').sendFile(path.join(root,'vendor/baremux-index.mjs')));
  browser.use(express.static(path.join(root,'vendor/static'),{...staticOptions,redirect:false}));
  const packages=[['baremux',require('@mercuryworkshop/bare-mux/node').baremuxPath],['epoxy',require('@mercuryworkshop/epoxy-transport').epoxyPath],['libcurl',require('@mercuryworkshop/libcurl-transport').libcurlPath],['assets/ultraviolet',require('@titaniumnetwork-dev/ultraviolet').uvPath],['assets/scramjet',require('@mercuryworkshop/scramjet/path').scramjetPath]];
  for(const [prefix,folder] of packages)browser.use('/'+prefix,express.static(folder,staticOptions));
  mountGhGames(browser);
  for(const name of ['apps','games','tabs','settings'])browser.get('/'+name,(_req,res)=>res.sendFile(path.join(root,'vendor/static',name+'.html')));
  browser.use((_req,res)=>res.status(404).type('text').send('Interstellar resource not found.'));
  app.use(BASE,browser);
  app.use('/interstellar',(_req,res)=>res.status(404).end());
  return {close(){server.off('upgrade',upgrade);for(const socket of sockets)socket.destroy();}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const app=express(),server=http.createServer(app);setupInterstellar(app,server);
  server.listen(Number(process.env.PORT || process.env.INTERSTELLAR_PORT || 3005),'0.0.0.0',()=>console.log('Interstellar: /interstellar (port '+(process.env.PORT || process.env.INTERSTELLAR_PORT || 3005)+')'));
}
