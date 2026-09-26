import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomInt} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRoom,addPlayer,configure,start,submit,callOut,confirmCallout,cancelCallout,leave,tickRoom,snapshot} from './engine.mjs';
import {publicCatalog} from './catalog.mjs';
export const rooms=new Map();
const assets=new Map(await Promise.all(['index.html','app.js','style.css'].map(async name=>[name,await readFile(new URL(name,import.meta.url))])));
const limits=new Map();
function rateLimit(key,max,window=60000){const now=Date.now();let item=limits.get(key);if(!item||now>item.until){item={count:0,until:now+window};limits.set(key,item);}if(++item.count>max)throw Error('A little slower, please. Try again shortly.');}
function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(body));}
export function broadcast(r){for(const p of r.players)for(const stream of p.streams){if(stream.destroyed||stream.writableEnded){p.streams.delete(stream);continue;}if(stream.writableLength>262144){stream.destroy();continue;}stream.write(`event: state\ndata: ${JSON.stringify(snapshot(r,p))}\n\n`);}}
export async function handleRequest(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  const url=new URL(req.url,'http://localhost');
  try{
    if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{app:'categories',version:2});
    if(req.method==='GET'&&url.pathname==='/config')return json(res,200,{catalog:publicCatalog});
    if(req.method==='GET'&&url.pathname==='/events'){
      const r=rooms.get(url.searchParams.get('room')),p=r?.players.find(p=>p.token===url.searchParams.get('token')&&!p.explicitLeave);
      if(!p||p.left)return json(res,410,{error:'Session expired. Rejoin the room.'});
      // Only the newest tab owns the live connection for this session.
      for(const old of p.streams)old.end();p.streams.clear();
      res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders();res.write('retry: 2000\n\n');p.streams.add(res);p.lastSeen=Date.now();r.updated=Date.now();broadcast(r);
      res.on('close',()=>{p.streams.delete(res);if(!p.streams.size)p.lastSeen=Date.now();});return;
    }
    if(req.method==='POST'&&url.pathname==='/api'){
      // Same-origin JSON requests only; do not inherit the parent app's permissive CORS for mutations.
      if(req.headers.origin){let origin;try{origin=new URL(req.headers.origin);}catch{throw Error('Invalid origin.');}if(origin.host!==req.headers.host)throw Error('Use the game’s own page.');}
      if(!req.headers['content-type']?.includes('application/json'))throw Error('Send JSON.');
      let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>8192)throw Error('Request too large.');}
      const b=JSON.parse(raw);if(!b||typeof b!=='object')throw Error('Invalid request.');
      let r=rooms.get(String(b.room||'').trim().toUpperCase()),p=r?.players.find(p=>p.token===b.token&&!p.explicitLeave),result={ok:true};
      if(b.action==='create'||b.action==='join'){
        rateLimit(`join:${req.socket.remoteAddress}`,40);
        if(b.action==='create'){
          if(rooms.size>=500)throw Error('The party is full. Try again later.');
          let code;do{code=Array.from({length:5},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(31)]).join('');}while(rooms.has(code));
          r=createRoom(code);p=addPlayer(r,b.name);rooms.set(code,r);
        }else{if(!r)throw Error('Room not found. Check your code.');p=addPlayer(r,b.name);}
        result={room:r.code,token:p.token};
      }else{
        if(!r||!p)return json(res,410,{error:'Room expired. Create or join a new room.'});
        rateLimit(`player:${p.id}`,100);p.lastSeen=Date.now();
        if(p.left&&b.action!=='resume')return json(res,410,{error:'Reconnect to the room first.'});
        tickRoom(r);
        if(b.action==='resume'){
          if(p.left){if(r.players.filter(q=>!q.left).length>=12)throw Error('Room is full.');p.left=false;p.alive=false;r.host??=p.id;}
          result={room:r.code,token:p.token};
        }else if(b.action==='leave'){p.explicitLeave=true;leave(r,p);}
        else if(b.action==='answer')submit(r,p,b);
        else if(b.action==='callout')callOut(r,p,b.turn);
        else if(b.action==='confirmCallout')confirmCallout(r,p,b.turn);
        else if(b.action==='cancelCallout')cancelCallout(r,p,b.turn);
        else {
          if(r.host!==p.id)throw Error('Only the host can do that.');
          if(b.action==='settings'){if(r.phase!=='lobby')throw Error('Change settings in the lobby.');configure(r,b.settings||{});}
          else if(b.action==='start')start(r);
          else if(b.action==='lobby'){if(r.phase!=='finished')throw Error('Finish this game first.');r.phase='lobby';r.deadline=0;r.pending=null;r.event=null;r.answers=[];r.category=null;}
          else throw Error('Unknown action.');
        }
      }
      r.updated=Date.now();broadcast(r);return json(res,200,result);
    }
    if(req.method!=='GET')return json(res,405,{error:'Method not allowed.'});
    const file={'/':'index.html','/app.js':'app.js','/style.css':'style.css'}[url.pathname];
    if(!file)return json(res,404,{error:'Not found.'});
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'self'; frame-ancestors 'self'; form-action 'self'");
    res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8'});res.end(assets.get(file));
  }catch(error){if(!res.headersSent)json(res,400,{error:error.message||'Something went wrong.'});else res.end();}
}
export function tick(now=Date.now()){
  for(const [key,item]of limits)if(now>item.until)limits.delete(key);
  for(const r of rooms.values()){
    const connected=r.players.some(p=>p.streams.size);if(connected)r.updated=now;
    if(!connected&&now-r.updated>15*60000){rooms.delete(r.code);continue;}
    for(const p of r.players)if(!p.left&&!p.streams.size&&now-p.lastSeen>60000)leave(r,p,now);
    const host=r.players.find(p=>p.id===r.host);
    if(!host||host.left||(!host.streams.size&&now-host.lastSeen>20000)){const next=r.players.find(p=>!p.left&&p.streams.size);if(next)r.host=next.id;}
    tickRoom(r,now);broadcast(r);
  }
}
export const server=http.createServer(handleRequest);
const timer=setInterval(tick,500);timer.unref();
if(process.argv[1]===fileURLToPath(import.meta.url))server.listen(Number(process.env.PORT)||3220,'0.0.0.0',()=>console.log(`Categories → http://localhost:${process.env.PORT||3220}`));
