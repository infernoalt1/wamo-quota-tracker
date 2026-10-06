import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createEgress } from './egress.mjs';
const require=createRequire(import.meta.url);
export async function createEngine({origin,port=0,listen=false}={}) {
  const {RammerheadProxy,RammerheadSessionMemoryStore,RammerheadLogging,generateId}=require('rammerhead');
  const logger=new RammerheadLogging({logger:()=>{}});
  const egress=await createEgress();
  let proxy;
  try {proxy=new RammerheadProxy({logger,dontListen:true,crossDomainPort:null,disableHttp2:true,getServerInfo:()=>{
    const url=new URL(origin);return {hostname:url.hostname,port:url.port || (url.protocol==='https:'?443:80),protocol:url.protocol};
  }});} catch(error){egress.close();throw error;}
  const store=new RammerheadSessionMemoryStore({logger});store.attachToProxy(proxy);
  for(const [route,file,type] of [['/','browser.html','text/html'],['/browser.js','browser.js','application/javascript'],['/browser.css','browser.css','text/css']]){
    proxy.GET(route,{content:readFileSync(new URL(file,import.meta.url)),contentType:type});
  }
  const recent=[];
  proxy.POST('/session', (req,res)=>{
    if(req.headers.origin!==origin){res.writeHead(403);return res.end('Wrong origin.');}
    while(recent.length && recent[0]<Date.now()-60000)recent.shift();
    if(recent.length>=60 || store.keys().length>=200){res.writeHead(429);return res.end('Please wait before creating another session.');}
    recent.push(Date.now());
    const id=generateId(),session=store.add(id);session.shuffleDict=null;session.setExternalProxySettings(egress.address);
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({id}));
  });
  proxy.POST('/end-session',async(req,res)=>{
    if(req.headers.origin!==origin){res.writeHead(403);return res.end();}
    const id=new URL(req.url,origin).searchParams.get('id');if(id)store.delete(id);res.writeHead(204);res.end();
  });
  // The backend serves a different origin from the app, never its root API or files.
  const request=(req,res)=>proxy.server1.emit('request',req,res);
  const upgrade=(req,socket,head)=>proxy.server1.emit('upgrade',req,socket,head);
  if(listen){try{await new Promise((resolve,reject)=>{proxy.server1.once('error',reject);proxy.server1.listen(port,'127.0.0.1',resolve);});origin=`http://127.0.0.1:${proxy.server1.address().port}`;}catch(error){proxy.close();egress.close();throw error;}}
  return {request,upgrade,get origin(){return origin;},store,close(){proxy.close();egress.close();}};
}
