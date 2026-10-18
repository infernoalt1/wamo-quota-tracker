import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createGame,addPlayer,act,snapshot,isPsychic,guessers,points,tick,playerColors} from '../public/wavelength/engine.js';
import {wavelengthApi} from './server.mjs';

for(const mode of ['classic','reverse','teams'])test(`${mode}: full game, secret targets, scoring, restart`,()=>{
  const g=createGame({mode,rounds:1});for(let i=0;i<4;i++)addPlayer(g,String(i),'Player '+i);
  assert.throws(()=>act(g,'1',{action:'start'}));act(g,'0',{action:'start'});
  for(let turn=0;turn<4;turn++){
    for(const p of g.players){assert.equal('target' in snapshot(g,p.id),isPsychic(g,p.id));}
    for(const p of g.players.filter(p=>isPsychic(g,p.id)))act(g,p.id,{action:'clue',clue:'Coffee'});
    assert.equal(g.phase,'guess');for(const p of g.players)assert.equal('target' in snapshot(g,p.id),isPsychic(g,p.id));
    const eligible=guessers(g);for(const p of eligible){act(g,p.id,{action:'guess',value:g.target});assert.throws(()=>act(g,p.id,{action:'guess',value:g.target}));}
    assert.equal(g.phase,'result');assert.equal(g.lastScore,eligible.length*5);assert.equal(snapshot(g,'0').target,g.target);act(g,'0',{action:'next'});
  }
  assert.equal(g.phase,'finished');act(g,'0',{action:'restart'});assert.equal(g.phase,'lobby');assert.equal(g.score,0);assert.equal(g.players.length,4);
});

test('player colors stay distinct and stable; live markers do not reveal the target',()=>{
  const g=createGame({maxPlayers:12});for(let i=0;i<12;i++)addPlayer(g,String(i),'Player '+i);
  assert.equal(new Set(g.players.map(p=>p.color)).size,12);assert.deepEqual(g.players.map(p=>p.color),playerColors);
  act(g,'0',{action:'start'});act(g,'0',{action:'clue',clue:'Coffee'});act(g,'1',{action:'aim',value:42});
  assert.equal(snapshot(g,'0').drafts['1'],42);assert.equal(snapshot(g,'2').drafts['1'],42);assert.equal(snapshot(g,'2').target,undefined);
  assert.throws(()=>act(g,'0',{action:'aim',value:5}));assert.throws(()=>act(g,'1',{action:'guess',value:NaN}));
});

test('guesser timer never runs during clue phase, locks current markers once, and rejects late guesses',()=>{
  const g=createGame({guesserTimer:15});for(let i=0;i<3;i++)addPlayer(g,String(i),'Player '+i);
  act(g,'0',{action:'start'},1000);assert.deepEqual(g.deadlines,{});assert.equal(tick(g,100000),false);
  act(g,'0',{action:'clue',clue:'Coffee'},100000);assert.equal(g.deadlines['1'],115000);assert.equal(g.deadlines['0'],undefined);
  act(g,'1',{action:'aim',value:g.target},101000);act(g,'2',{action:'guess',value:g.target},102000);
  assert.equal(tick(g,114999),false);assert.equal(tick(g,115000),true);assert.equal(g.phase,'result');assert.equal(g.lastScore,10);assert.deepEqual(g.timedOut,['1']);assert.equal(g.guesses['1'],g.target);
  const score=g.score;assert.equal(tick(g,200000),false);assert.equal(g.score,score);assert.throws(()=>act(g,'1',{action:'guess',value:20},115001));
  act(g,'0',{action:'next'},115001);assert.deepEqual(g.deadlines,{});assert.deepEqual(g.timedOut,[]);
});

test('local guessers receive their own timer only after Ready; repeated Ready cannot extend it',()=>{
  const g=createGame({guesserTimer:30,connection:'local'});for(let i=0;i<3;i++)addPlayer(g,String(i),'Player '+i);
  act(g,'0',{action:'start'},0);act(g,'0',{action:'clue',clue:'Coffee'},1000);assert.deepEqual(g.deadlines,{});
  act(g,'1',{action:'ready'},10000);act(g,'1',{action:'ready'},20000);assert.equal(g.deadlines['1'],40000);
  tick(g,40000);assert.equal(g.phase,'guess');assert.equal(g.guesses['1'],90);assert.equal(g.guesses['2'],undefined);
  act(g,'2',{action:'ready'},90000);assert.equal(g.deadlines['2'],120000);tick(g,120000);assert.equal(g.phase,'result');
});

test('reverse mode waits for every clue; timer off leaves guesses untimed',()=>{
  const g=createGame({mode:'reverse',guesserTimer:15});for(let i=0;i<3;i++)addPlayer(g,String(i),'P'+i);
  act(g,'0',{action:'start'},0);act(g,'1',{action:'clue',clue:'Coffee'},1000);assert.deepEqual(g.deadlines,{});
  act(g,'2',{action:'clue',clue:'Tea'},5000);assert.deepEqual(g.deadlines,{'0':20000});
  const untimed=createGame();addPlayer(untimed,'a','A');addPlayer(untimed,'b','B');act(untimed,'a',{action:'start'});act(untimed,'a',{action:'clue',clue:'Tea'});assert.equal(tick(untimed,Number.MAX_SAFE_INTEGER),false);assert.equal(untimed.phase,'guess');
});

test('chat is shared, attributed by authenticated player, bounded, and rate limited',()=>{
  const g=createGame();addPlayer(g,'a','Alex');addPlayer(g,'b','Sam');
  act(g,'a',{action:'chat',text:'<img src=x onerror=alert(1)>',playerId:'b'},1000);
  assert.equal(snapshot(g,'b').chat[0].playerId,'a');assert.throws(()=>act(g,'a',{action:'chat',text:'Spam'},1100));assert.throws(()=>act(g,'x',{action:'chat',text:'Unknown'},2000));assert.throws(()=>act(g,'b',{action:'chat',text:'x'.repeat(301)},2000));
  for(let i=0;i<105;i++)act(g,'b',{action:'chat',text:'Message '+i},2000+i*1000);assert.equal(g.chat.length,100);assert.equal(g.chat.at(-1).text,'Message 104');
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
    await call(`/rooms/${host.code}/action`,{action:'chat',text:'Hello from guest',playerId:host.game.you},guest.token);
    const hostChat=(await call(`/rooms/${host.code}`,null,host.token)).data.game.chat;
    assert.equal(hostChat[0].text,'Hello from guest');assert.equal(hostChat[0].playerId,guest.game.you);
    await call(`/rooms/${host.code}/action`,{action:'aim',value:70},guest.token);
    const hostView=(await call(`/rooms/${host.code}`,null,host.token)).data.game;
    assert.equal(hostView.drafts[guest.game.you],70);assert.equal(hostView.target,target);
    assert.equal((await call(`/rooms/${host.code}`,null,guest.token)).data.game.target,undefined);
    const result=await call(`/rooms/${host.code}/action`,{action:'guess',value:target},guest.token);assert.equal(result.data.game.phase,'result');assert.equal(result.data.game.score,5);
  }finally{await new Promise(r=>server.close(r));}
});

test('HTTP reads enforce expiry without a client submitting a final guess',async()=>{
  const app=express();app.use('/wavelength/api',wavelengthApi());const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${server.address().port}/wavelength/api`;
  const call=async(path,body,token)=>{const response=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});assert.equal(response.status,200);return response.json();};
  try{
    const host=await call('/rooms',{name:'Host',config:{guesserTimer:1,connection:'local'}});
    const guest=await call(`/rooms/${host.code}/join`,{name:'Guest'}),path=`/rooms/${host.code}`;
    await call(path+'/action',{action:'start'},host.token);
    const clue=await call(path+'/action',{action:'clue',clue:'Coffee'},host.token);
    assert.equal(clue.game.config.connection,'online');const deadline=clue.game.deadlines[guest.game.you];assert.ok(deadline>Date.now());
    await call(path+'/action',{action:'aim',value:50},guest.token);
    await new Promise(resolve=>setTimeout(resolve,Math.max(0,deadline-Date.now()+30)));
    const {game}=await call(path,null,guest.token);assert.equal(game.phase,'result');assert.equal(game.guesses[guest.game.you],50);assert.deepEqual(game.timedOut,[guest.game.you]);
  }finally{await new Promise(r=>server.close(r));}
});
