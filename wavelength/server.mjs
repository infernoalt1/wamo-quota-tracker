import express from 'express';
import { randomBytes } from 'node:crypto';
import { createGame, addPlayer, act, snapshot } from '../public/wavelength/engine.js';

export function wavelengthApi() {
  // A sub-application initializes Express request/response helpers in Vite's Connect server too.
  const router=express(),rooms=new Map(),limits=new Map();
  router.use(express.json({limit:'24kb'}));
  router.use((req,res,next)=>{res.setHeader('Cache-Control','no-store');const now=Date.now(),key=req.socket.remoteAddress;let limit=limits.get(key);if(!limit||now-limit.time>60000){limit={time:now,count:0};limits.set(key,limit);}if(++limit.count>600)return res.status(429).json({error:'Too many requests. Try again in a minute.'});for(const [code,room] of rooms)if(now-room.updated>6*60*60*1000)rooms.delete(code);for(const [ip,rate] of limits)if(now-rate.time>60000)limits.delete(ip);next();});
  router.get('/rooms',(_req,res)=>res.json([...rooms.values()].filter(r=>r.game.config.visibility==='public'&&r.game.phase==='lobby').map(r=>({code:r.code,host:r.game.players[0].name,players:r.game.players.length,max:r.game.config.maxPlayers}))));
  const identity=(req,r)=>{const token=req.headers.authorization?.replace(/^Bearer /,'');const id=r.tokens.get(token);if(!id)throw Error('Your session has expired. Join again.');return id;};
  router.post('/rooms',(req,res)=>{try{if(rooms.size>=500)throw Error('Server full. Please try again later.');let code;do{code=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));const id=randomBytes(12).toString('hex'),token=randomBytes(24).toString('hex'),game=createGame(req.body.config);addPlayer(game,id,req.body.name);const room={code,game,tokens:new Map([[token,id]]),updated:Date.now()};rooms.set(code,room);res.json({code,token,game:snapshot(game,id)});}catch(e){res.status(400).json({error:e.message});}});
  router.post('/rooms/:code/join',(req,res)=>{try{const r=rooms.get(req.params.code);if(!r)throw Error('Room not found or expired.');const id=randomBytes(12).toString('hex'),token=randomBytes(24).toString('hex');addPlayer(r.game,id,req.body.name);r.tokens.set(token,id);r.updated=Date.now();res.json({code:r.code,token,game:snapshot(r.game,id)});}catch(e){res.status(400).json({error:e.message});}});
  router.get('/rooms/:code',(req,res)=>{try{const r=rooms.get(req.params.code);if(!r)return res.status(404).json({error:'Room not found or expired.'});const id=identity(req,r);r.updated=Date.now();res.json({game:snapshot(r.game,id)});}catch(e){res.status(401).json({error:e.message});}});
  router.post('/rooms/:code/action',(req,res)=>{try{const r=rooms.get(req.params.code);if(!r)throw Error('Room not found or expired.');const id=identity(req,r);act(r.game,id,req.body);r.updated=Date.now();res.json({game:snapshot(r.game,id)});}catch(e){res.status(400).json({error:e.message});}});
  return router;
}
