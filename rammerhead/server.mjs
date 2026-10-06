import express from 'express';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createEngine } from './engine.mjs';
export function setupRammerhead(app,server,{env=process.env}={}) {
  let enginePromise;
  const configured=env.RAMMERHEAD_PROXY_ORIGIN ? new URL(env.RAMMERHEAD_PROXY_ORIGIN) : null;
  if(configured && (configured.pathname!=='/' || !['https:','http:'].includes(configured.protocol)))throw Error('RAMMERHEAD_PROXY_ORIGIN must be an origin without a path.');
  const getEngine=()=>enginePromise ||= createEngine(configured?{origin:configured.origin}:{listen:true,port:Number(env.RAMMERHEAD_LOCAL_PORT || 3004)}).catch(error=>{enginePromise=null;throw error;});
  const isProxy=req=>configured && req.headers.host===configured.host;
  app.use((req,res,next)=>{
    if(!isProxy(req))return next();
    getEngine().then(engine=>engine.request(req,res)).catch(()=>res.status(503).send('Proxy could not start.'));
  });
  const upgrade=(req,socket,head)=>{if(isProxy(req))getEngine().then(engine=>engine.upgrade(req,socket,head)).catch(()=>socket.destroy());};server.on('upgrade',upgrade);
  app.get('/rammerhead/config',async(req,res)=>{
    res.set('Cache-Control','no-store');
    try {
      const host=new URL('http://'+req.headers.host).hostname;
      if(!configured && !['localhost','127.0.0.1','[::1]'].includes(host))return res.status(503).json({error:'The host needs to configure RAMMERHEAD_PROXY_ORIGIN with a separate HTTPS hostname for the proxy.'});
      const engine=await getEngine();res.json({origin:engine.origin});
    } catch {res.status(503).json({error:'The browsing server could not start. Check the server configuration and port availability.'});}
  });
  for(const [route,file] of [['/rammerhead','index.html'],['/rammerhead/','index.html'],['/rammerhead/app.js','app.js'],['/rammerhead/style.css','style.css']]) {
    app.get(route,(_req,res)=>{res.set('X-Content-Type-Options','nosniff');res.set('Referrer-Policy','no-referrer');res.sendFile(fileURLToPath(new URL(file,import.meta.url)));});
  }
  app.use('/rammerhead',(_req,res)=>res.status(404).end());
  return {async close(){server.off('upgrade',upgrade);(await enginePromise)?.close();}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const app=express(),server=http.createServer(app);setupRammerhead(app,server);
  server.listen(Number(process.env.RAMMERHEAD_PORT || 3005),'127.0.0.1',()=>console.log('Hammerhead field notes: http://127.0.0.1:'+(process.env.RAMMERHEAD_PORT || 3005)+'/rammerhead'));
}
