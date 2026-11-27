import express from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { newGame, join, spectate, act, tick, seen, view } from './lib/engine.mjs';
import { mountAccounts, defaultStore } from './lib/accounts.mjs';
import { mountLeaderboard } from './lib/leaderboard.mjs';
import { mountShop } from './lib/shop.mjs';
import { createBets } from './lib/bets.mjs';
import { mountAdmin, adminKeys } from './lib/admin.mjs';

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

// A closed tab says goodbye at once; this catches crashes and lost connections, and is long enough for a throttled background tab.
export function botcApi({store=defaultStore(),awayAfter=90*1000,admins=adminKeys(),clock=Date.now}={}) {
  // Rooms hold serialized state so an engine error partway through an action cannot leave a half-applied game.
  const router=express(),rooms=new Map(),presence=new Map();
  // Presence changes on every poll, so it stays out of the saved game.
  const markSeen=(code,session)=>presence.set(`${code}:${session}`,{at:Date.now(),closed:false});
  const isAway=(code,session,now=Date.now())=>{const seen=presence.get(`${code}:${session}`);return !seen||seen.closed||now-seen.at>awayAfter;};
  // Offline players count as ready for dusk, so the engine is told who they are on every poll and action.
  const awayIds=game=>new Set(game.players.filter(p=>isAway(game.code,p.session)).map(p=>p.id));
  function send(req,res,game,session){
    markSeen(game.code,session);
    const data=view(game,session),now=Date.now();
    data.players.forEach((p,i)=>{p.away=isAway(game.code,game.players[i].session,now);});
    const record=leaderboard.statusFor(game,session);if(record)data.record=record;
    const book=bets.viewFor(game,session);if(book)data.bets=book;
    reply(req,res,data);
  }
  const load=code=>{const room=rooms.get(code);if(!room)throw Error('Room not found. Check the code.');return JSON.parse(room.state);};
  // Every change pokes each open page in the room, which fetches its own view at once instead of waiting for its next poll.
  const streams=new Map();
  const poke=code=>{for(const res of streams.get(code)||[])res.write('data: 1\n\n');};
  const save=(code,game)=>{leaderboard.noteEnd(game);bets.sync(game);rooms.set(code,{state:JSON.stringify(game),updated:Date.now()});poke(code);};
  // Keeps quiet connections from being closed by proxies along the way.
  const beat=setInterval(()=>{for(const set of streams.values())for(const res of set)res.write(': keep-alive\n\n');},25000);beat.unref?.();
  router.use((req,res,next)=>{res.setHeader('Cache-Control','no-store, private');const now=Date.now();for(const [code,room] of rooms)if(now-room.updated>ROOM_TTL){rooms.delete(code);bets.forgetRoom(code);}for(const [key,seen] of presence)if(now-seen.at>ROOM_TTL)presence.delete(key);next();});
  router.use('/account/avatar',express.json({limit:'96kb'}));
  router.use(express.json({limit:'4kb'}));
  const accounts=mountAccounts(router,{store,rooms,identity,setSession,admins});
  const bets=createBets({store});
  const leaderboard=mountLeaderboard(router,{store,rooms,onRecorded:(game,status)=>bets.settle(game,status)});
  mountShop(router,{store,identity,accounts,heldFor:bets.heldFor,clock});
  mountAdmin(router,{store,identity,admins,heldFor:bets.heldFor});
  // A logged-in spectator stakes points on which team wins the game they are watching.
  router.post('/bet',async(req,res)=>{try{
    if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return res.status(403).json({error:'Use the game website to bet.'});
    if(!store)return res.status(503).json({error:'Betting is not set up on this server.'});
    const session=identity(req),account=session?await store.bySession(session):null;
    if(!account)return res.status(401).json({error:'Log in to bet points.'});
    const code=codeOf(req.body?.code),game=load(code);
    await bets.place(game,session,account,req.body?.team,req.body?.stake);
    send(req,res,game,session);
  }catch(e){res.status(e.status||400).json({error:e.message});}});
  router.get('/',(req,res)=>{try{
    const session=identity(req);if(!session)return res.status(401).json({error:'Join a room to take a seat.'});
    const code=codeOf(req.query.code),game=load(code);view(game,session); // Authorize before advancing the clock.
    markSeen(code,session);
    if(seen(game,session)|tick(game,Date.now(),awayIds(game)))save(code,game);
    send(req,res,game,session);
  }catch(e){res.status(400).json({error:e.message});}});
  router.get('/events',(req,res)=>{
    try{
      const session=identity(req);if(!session)return res.status(401).end();
      const code=codeOf(req.query.code);view(load(code),session); // Only someone at this table may listen.
      res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
      res.flushHeaders?.();res.write('retry: 3000\n\n');
      if(!streams.has(code))streams.set(code,new Set());streams.get(code).add(res);
      res.on('close',()=>{const set=streams.get(code);set?.delete(res);if(set&&!set.size)streams.delete(code);});
    }catch(e){res.status(400).json({error:e.message});}
  });
  router.post('/presence',(req,res)=>{
    if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return res.status(403).end();
    const seen=presence.get(`${req.body?.code}:${identity(req)}`);if(seen)seen.closed=true;
    res.status(204).end();
  });
  router.post('/',async(req,res)=>{try{
    if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return res.status(403).json({error:'Use the game website to submit actions.'});
    const data=req.body,session=identity(req)||randomUUID();
    setSession(req,res,session);
    const {avatar=null,...who}=['create','join'].includes(data.type)?await accounts.seatFor(session):{};
    if(data.type==='create'){
      const name=nameOf(data.name);
      if(rooms.size>=500)throw Error('The town is full. Please try again later.');
      if([...rooms.values()].filter(r=>Date.now()-r.updated<3600000&&r.state.includes(session)).length>=8)throw Error('You have several recent tables. Rejoin one or try later.');
      let code;do{code=Array.from(randomBytes(8),n=>ALPHABET[n%ALPHABET.length]).join('');}while(rooms.has(code));
      const game=newGame(code,name,session,avatar,who);save(code,game);
      return send(req,res,game,session);
    }
    const code=codeOf(data.code),game=load(code);
    if(data.type==='join')join(game,nameOf(data.name),session,avatar,who);
    else if(data.type==='spectate')spectate(game,nameOf(data.name),session);
    else{
      view(game,session);markSeen(code,session);
      // Commit elapsed transitions first, on their own: the action is then checked against the new state,
      // so a stale action may fail but can never rewind time.
      if(seen(game,session)|tick(game,Date.now(),awayIds(game)))save(code,game);
      act(game,session,data,awayIds(game));
    }
    save(code,game);
    if(data.type==='leave')return reply(req,res,{left:true});
    send(req,res,game,session);
  }catch(e){res.status(400).json({error:e.message});}});
  router.use((err,_req,res,_next)=>res.status(err.status||400).json({error:err.status===413?'Request too large.':'Invalid request.'}));
  return router;
}
