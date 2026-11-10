import express from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { newGame, join, act, tick, view } from './lib/engine.mjs';
import { mountAccounts, defaultStore } from './lib/accounts.mjs';

const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_TTL=6*60*60*1000;
const identity=req=>req.headers.cookie?.match(/(?:^|;\s*)rw_session=([a-f0-9-]{36})/)?.[1];
const setSession=(req,res,session)=>res.setHeader('Set-Cookie',`rw_session=${session}; Path=/botc; HttpOnly; SameSite=Strict; Max-Age=31536000${req.headers['x-forwarded-proto']?.split(',')[0]==='https'?'; Secure':''}`);
function codeOf(code){const v=String(code||'').toUpperCase().trim();if(!/^[A-Z2-9]{8}$/.test(v))throw Error('Enter an eight-character room code.');return v;}
function nameOf(name){const v=String(name||'').trim();if(!v||v.length>24)throw Error('Choose a name of 1–24 characters.');return v;}
// Every poll carries the whole table, including the chat, so compress it for slow networks.
function reply(req,res,data){
  const body=JSON.stringify(data);
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Vary','Accept-Encoding');
  if(body.length>1024&&/\bgzip\b/.test(req.headers['accept-encoding']||'')){res.setHeader('Content-Encoding','gzip');return res.end(gzipSync(body));}
  res.end(body);
}

export function botcApi({store=defaultStore()}={}) {
  // Rooms hold serialized state so an engine error partway through an action cannot leave a half-applied game.
  const router=express(),rooms=new Map();
  const load=code=>{const room=rooms.get(code);if(!room)throw Error('Room not found. Check the code.');return JSON.parse(room.state);};
  const save=(code,game)=>rooms.set(code,{state:JSON.stringify(game),updated:Date.now()});
  router.use((req,res,next)=>{res.setHeader('Cache-Control','no-store, private');const now=Date.now();for(const [code,room] of rooms)if(now-room.updated>ROOM_TTL)rooms.delete(code);next();});
  router.use('/account/avatar',express.json({limit:'96kb'}));
  router.use(express.json({limit:'4kb'}));
  const accounts=mountAccounts(router,{store,rooms,identity,setSession});
  router.get('/',(req,res)=>{try{
    const session=identity(req);if(!session)return res.status(401).json({error:'Join a room to take a seat.'});
    const code=codeOf(req.query.code),game=load(code);view(game,session); // Authorize before advancing the clock.
    if(tick(game))save(code,game);
    reply(req,res,view(game,session));
  }catch(e){res.status(400).json({error:e.message});}});
  router.post('/',async(req,res)=>{try{
    if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return res.status(403).json({error:'Use the game website to submit actions.'});
    const data=req.body,session=identity(req)||randomUUID();
    setSession(req,res,session);
    const avatar=['create','join'].includes(data.type)?await accounts.avatarFor(session):null;
    if(data.type==='create'){
      const name=nameOf(data.name);
      if(rooms.size>=500)throw Error('The town is full. Please try again later.');
      if([...rooms.values()].filter(r=>Date.now()-r.updated<3600000&&r.state.includes(session)).length>=8)throw Error('You have several recent tables. Rejoin one or try later.');
      let code;do{code=Array.from(randomBytes(8),n=>ALPHABET[n%ALPHABET.length]).join('');}while(rooms.has(code));
      const game=newGame(code,name,session,avatar);save(code,game);
      return reply(req,res,view(game,session));
    }
    const code=codeOf(data.code),game=load(code);
    if(data.type==='join')join(game,nameOf(data.name),session,avatar);
    else{
      view(game,session);
      // Commit elapsed transitions independently: stale actions may fail but cannot rewind time.
      if(tick(game)){save(code,game);return reply(req,res,view(game,session));}
      act(game,session,data);
    }
    save(code,game);
    reply(req,res,data.type==='leave'?{left:true}:view(game,session));
  }catch(e){res.status(400).json({error:e.message});}});
  router.use((err,_req,res,_next)=>res.status(err.status||400).json({error:err.status===413?'Request too large.':'Invalid request.'}));
  return router;
}
