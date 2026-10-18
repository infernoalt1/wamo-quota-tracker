import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createGame,addPlayer,act,snapshot,isPsychic,guessers,points} from '../public/wavelength/engine.js';
import {wavelengthApi} from './server.mjs';

for(const mode of ['classic','reverse','teams'])test(`${mode}: full game, secret targets, scoring, restart`,()=>{
  const g=createGame({mode,rounds:1});for(let i=0;i<4;i++)addPlayer(g,String(i),'Player '+i);
  assert.throws(()=>act(g,'1',{action:'start'}));act(g,'0',{action:'start'});
  for(let turn=0;turn<4;turn++){
    for(const p of g.players){assert.equal('target' in snapshot(g,p.id),isPsychic(g,p.id));}
    for(const p of g.players.filter(p=>isPsychic(g,p.id)))act(g,p.id,{action:'clue',clue:'Coffee'});
    assert.equal(g.phase,'guess');for(const p of g.players)assert.equal('target' in snapshot(g,p.id),false);
    const eligible=guessers(g);for(const p of eligible){act(g,p.id,{action:'guess',value:g.target});assert.throws(()=>act(g,p.id,{action:'guess',value:g.target}));}
    assert.equal(g.phase,'result');assert.equal(g.lastScore,eligible.length*5);assert.equal(snapshot(g,'0').target,g.target);act(g,'0',{action:'next'});
  }
  assert.equal(g.phase,'finished');act(g,'0',{action:'restart'});assert.equal(g.phase,'lobby');assert.equal(g.score,0);assert.equal(g.players.length,4);
});
test('score boundaries and custom prompt validation',()=>{assert.deepEqual([5,6,15,16,25,26].map(d=>points(90,90+d)),[5,3,3,1,1,0]);assert.deepEqual(createGame({custom:[['A','B'],['','bad'],['invalid']]}).config.custom,[['A','B']]);});
test('independent multiplayer clients can create, join, play; unauthorized clients cannot read targets',async()=>{
  const app=express();app.use('/wavelength/api',wavelengthApi());const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${server.address().port}/wavelength/api`;
  const call=async(path,body,token)=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};};
  try{const {data:host}=await call('/rooms',{name:'Host',config:{visibility:'public'}});const {data:guest}=await call(`/rooms/${host.code}/join`,{name:'Guest'});assert.equal((await call(`/rooms/${host.code}`)).status,401);assert.equal((await call('/rooms')).data.length,1);
    assert.equal((await call(`/rooms/${host.code}/action`,{action:'start'},guest.token)).status,400);
    const start=await call(`/rooms/${host.code}/action`,{action:'start'},host.token);const target=start.data.game.target;assert.equal(typeof target,'number');assert.equal((await call(`/rooms/${host.code}`,null,guest.token)).data.game.target,undefined);
    await call(`/rooms/${host.code}/action`,{action:'clue',clue:'Tea'},host.token);
    const result=await call(`/rooms/${host.code}/action`,{action:'guess',value:target},guest.token);assert.equal(result.data.game.phase,'result');assert.equal(result.data.game.score,5);
  }finally{await new Promise(r=>server.close(r));}
});
