import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { newGame, join, start, act, kill, view, results } from '../lib/engine.mjs';
import { mountLeaderboard, MIN_GAMES } from '../lib/leaderboard.mjs';
import { keyOf } from '../lib/accounts.mjs';

// The same interface as the Postgres store, held in memory.
function memoryStore(){
  const accounts=[],games=[],rows=[];
  return {
    accounts,games,rows,
    add(username){const a={id:crypto.randomUUID(),username,key:keyOf(username),session:crypto.randomUUID(),avatar_version:0,pictured:false};accounts.push(a);return a;},
    byKey:async key=>accounts.find(a=>a.key===key)||null,
    accountIds:async sessions=>new Map(accounts.filter(a=>sessions.includes(a.session)).map(a=>[a.session,a.id])),
    async saveGame({players,...game}){if(games.some(g=>g.id===game.id))throw Error('duplicate key');games.push({...game,ended_at:new Date(Date.now()+games.length)});for(const p of players)rows.push({game_id:game.id,...p});},
    async totals(script){
      const by=new Map();
      for(const r of rows){const g=games.find(x=>x.id===r.game_id);if(script&&g.script!==script)continue;const list=by.get(r.account)||[];list.push(r);by.set(r.account,list);}
      const n=(list,f)=>list.filter(f).length;
      return [...by].map(([id,list])=>{const a=accounts.find(x=>x.id===id);return {id,username:a.username,avatar_version:a.avatar_version,pictured:a.pictured,games:list.length,wins:n(list,r=>r.won),good_games:n(list,r=>!r.evil),good_wins:n(list,r=>!r.evil&&r.won),evil_games:n(list,r=>r.evil),evil_wins:n(list,r=>r.evil&&r.won),demon_wins:n(list,r=>r.demon&&r.won)};});
    },
    async history(id){
      return rows.filter(r=>r.account===id).map(r=>{const g=games.find(x=>x.id===r.game_id);return {script:g.script,ended_at:g.ended_at,players:g.size,role:r.role,initial_role:r.initialRole,evil:r.evil,won:r.won,survived:r.survived,demon:r.demon};}).sort((a,b)=>b.ended_at-a.ended_at);
    },
  };
}
const ROLES5=['chef','soldier','slayer','poisoner','imp'];
const settled=()=>new Promise(done=>setTimeout(done,10));
// A five-seat table where the first `logged` seats belong to accounts and the rest are guests.
function table(store,logged,roles=ROLES5){
  const sessions=roles.map((_,i)=>i<logged?store.add(`Player${i}`).session:crypto.randomUUID());
  const g=newGame('ABCDEFGH','P0',sessions[0]);
  for(let i=1;i<roles.length;i++)join(g,`P${i}`,sessions[i]);
  start(g,roles);return {g,sessions};
}
// Keeps a game in a rooms map the way the server does, noting the end on every save.
function harness(store){
  const rooms=new Map(),board=mountLeaderboard(express.Router(),{store,rooms});
  const save=g=>{board.noteEnd(g);rooms.set(g.code,{state:JSON.stringify(g),updated:Date.now()});};
  const load=code=>JSON.parse(rooms.get(code).state);
  return {rooms,board,save,load};
}
const goodWins=g=>{g.poison=null;kill(g,g.players[4],'execution');assert.equal(g.winner,'good');};

test('a finished game with three accounts is saved, and guests are left out',async()=>{
  const store=memoryStore(),{save,load,board}=harness(store),{g,sessions}=table(store,3);
  goodWins(g);save(g);
  assert.equal(load('ABCDEFGH').ledger.status,'pending');
  await settled();
  const saved=load('ABCDEFGH');
  assert.equal(saved.ledger.status,'saved');
  assert.equal(store.games.length,1);
  assert.deepEqual({script:store.games[0].script,winner:store.games[0].winner,size:store.games[0].size},{script:'tb',winner:'good',size:5});
  assert.equal(store.rows.length,3);
  assert.deepEqual(store.rows.map(r=>[r.role,r.won,r.evil]),[['chef',true,false],['soldier',true,false],['slayer',true,false]]);
  assert.deepEqual(board.statusFor(saved,sessions[0]),{status:'saved',counted:true,needed:3});
  assert.deepEqual(board.statusFor(saved,sessions[4]),{status:'saved',counted:false,needed:3});
});
test('a game with fewer than three accounts does not count',async()=>{
  const store=memoryStore(),{save,load,board}=harness(store),{g,sessions}=table(store,2);
  goodWins(g);save(g);await settled();
  assert.equal(store.games.length,0);
  assert.deepEqual(board.statusFor(load('ABCDEFGH'),sessions[0]),{status:'skipped',counted:false,needed:3});
});
test('a game is saved once however often it is saved afterwards, and the next game is saved too',async()=>{
  const store=memoryStore(),{save,load}=harness(store),{g,sessions}=table(store,5);
  goodWins(g);save(g);save(g);await settled();
  const again=load('ABCDEFGH');save(again);act(again,sessions[1],{type:'chat',text:'gg'});save(again);await settled();
  assert.equal(store.games.length,1);
  const next=load('ABCDEFGH');act(next,sessions[0],{type:'rematch'});assert.equal(next.ledger,undefined);save(next);
  start(next,ROLES5);next.poison=null;kill(next,next.players[0],'slayer');kill(next,next.players[1],'slayer');kill(next,next.players[2],'slayer');assert.equal(next.winner,'evil');
  save(next);await settled();
  assert.equal(store.games.length,2);
  assert.deepEqual(store.rows.slice(5).map(r=>r.won),[false,false,false,true,true]);
});
test('games still in play, and games the host abandons, are never recorded',async()=>{
  const store=memoryStore(),{save,load}=harness(store),{g,sessions}=table(store,5);
  save(g);act(g,sessions[0],{type:'rematch'});save(g);assert(load('ABCDEFGH').interrupted);await settled();
  assert.equal(store.games.length,0);
  assert.equal(load('ABCDEFGH').ledger,undefined);
});
test('a slow save does not touch a room that has already moved on to the next game',async()=>{
  const store=memoryStore(),{save,load,rooms}=harness(store),{g,sessions}=table(store,5);
  goodWins(g);save(g);
  const next=load('ABCDEFGH');act(next,sessions[0],{type:'rematch'});rooms.set('ABCDEFGH',{state:JSON.stringify(next),updated:Date.now()});
  await settled();
  assert.equal(store.games.length,1);
  assert.equal(load('ABCDEFGH').ledger,undefined);
  assert.equal(load('ABCDEFGH').phase,'lobby');
});
test('a database failure is marked on the game, and play carries on',async()=>{
  const store=memoryStore();store.saveGame=async()=>{throw Error('connection refused');};
  const {save,load}=harness(store),{g}=table(store,5);
  const quiet=console.error;console.error=()=>{};
  try{goodWins(g);save(g);await settled();}finally{console.error=quiet;}
  assert.equal(load('ABCDEFGH').ledger.status,'failed');
});
test('without accounts nothing is noted on the game',()=>{
  const {save,load}=harness(null),g=newGame('ABCDEFGH','P0','s0');for(let i=1;i<5;i++)join(g,`P${i}`,`s${i}`);start(g,ROLES5);goodWins(g);save(g);
  assert.equal(load('ABCDEFGH').ledger,undefined);
});
test('results judge the team at the end, count the dead as winners, and mark the Demon',()=>{
  const {g}=table(memoryStore(),0);g.players[1].alive=false;g.players[0].aligned='evil';goodWins(g);
  const r=results(g);
  assert.deepEqual(r.map(x=>x.won),[false,true,true,false,false]);
  assert.equal(r[1].survived,false);
  assert.deepEqual(r.map(x=>x.demon),[false,false,false,false,true]);
  assert(!JSON.stringify(view(g,g.players[0].session)).includes('ledger'));
});

async function serve(store){
  const app=express(),router=express.Router();mountLeaderboard(router,{store,rooms:new Map()});app.use(router);
  const server=await new Promise(done=>{const s=app.listen(0,'127.0.0.1',()=>done(s));});
  const get=async path=>{const r=await fetch(`http://127.0.0.1:${server.address().port}${path}`);return {status:r.status,data:await r.json()};};
  return {get,close:()=>server.close()};
}
// Records finished games directly: `wins` of `games` won, as the given side and game mode.
async function played(store,account,games,wins,{evil=false,script='tb',role='chef',demon=false}={}){
  for(let i=0;i<games;i++)await store.saveGame({id:crypto.randomUUID(),script,winner:'good',reason:'',size:5,players:[{account:account.id,role,initialRole:role,evil,won:i<wins,survived:i%2===0,demon}]});
}
test('the leaderboard ranks by win rate from five games, then lists everyone else',async()=>{
  const store=memoryStore(),[ana,bo,cy,di]=['Ana','Bo','Cy','Di'].map(n=>store.add(n));
  await played(store,ana,5,3);await played(store,bo,10,6);await played(store,cy,6,5);await played(store,di,2,2);
  await played(store,ana,2,2,{evil:true,demon:true,role:'imp',script:'bmr'});
  const s=await serve(store);
  try{
    const all=await s.get('/leaderboard');
    assert.equal(all.status,200);assert.equal(all.data.minGames,MIN_GAMES);
    assert.deepEqual(all.data.players.map(p=>[p.rank,p.username]),[[1,'Cy'],[2,'Ana'],[3,'Bo'],[null,'Di']]);
    const anaRow=all.data.players.find(p=>p.username==='Ana');
    assert.deepEqual([anaRow.games,anaRow.wins,anaRow.good,anaRow.evil,anaRow.demonWins],[7,5,{games:5,wins:3},{games:2,wins:2},2]);
    const moon=await s.get('/leaderboard?script=bmr');
    assert.deepEqual(moon.data.players.map(p=>[p.rank,p.username,p.games]),[[null,'Ana',2]]);
    assert.equal((await s.get('/leaderboard?script=tb')).data.players.find(p=>p.username==='Ana').games,5);
    assert.equal((await s.get('/leaderboard?script=all')).data.players.length,4);
    assert.equal((await s.get('/leaderboard?script=__proto__')).status,400);
  }finally{s.close();}
});
test('a player profile shows their record, characters and recent games',async()=>{
  const store=memoryStore(),ana=store.add('Ana');
  await played(store,ana,4,3);await played(store,ana,2,1,{evil:true,demon:true,role:'imp',script:'bmr'});
  const s=await serve(store);
  try{
    const r=await s.get('/leaderboard/player?username=ana');
    assert.equal(r.status,200);
    const p=r.data.player;
    assert.deepEqual([p.username,p.games,p.wins,p.survived,p.demonWins],['Ana',6,4,3,1]);
    assert.deepEqual(p.good,{games:4,wins:3});assert.deepEqual(p.evil,{games:2,wins:1});
    assert.deepEqual(p.scripts,[{id:'tb',games:4,wins:3},{id:'bmr',games:2,wins:1}]);
    assert.deepEqual(p.characters,[{role:'chef',games:4,wins:3},{role:'imp',games:2,wins:1}]);
    assert.equal(p.recent.length,6);assert.equal(p.recent[0].role,'imp');assert.equal(typeof p.recent[0].endedAt,'number');
    assert(!JSON.stringify(r.data).includes(ana.session));
    assert.equal((await s.get('/leaderboard/player?username=Nobody')).status,404);
    assert.equal((await s.get('/leaderboard/player?username=%3Cscript%3E')).status,400);
  }finally{s.close();}
});
test('without accounts the leaderboard says it is not set up',async()=>{
  const s=await serve(null);
  try{assert.equal((await s.get('/leaderboard')).status,503);}finally{s.close();}
});
test('a database failure on the leaderboard does not leak details',async()=>{
  const store=memoryStore();store.totals=async()=>{throw Error('password authentication failed for user secret');};
  const s=await serve(store),quiet=console.error;console.error=()=>{};
  try{const r=await s.get('/leaderboard');assert.equal(r.status,503);assert.doesNotMatch(JSON.stringify(r.data),/secret/);}finally{console.error=quiet;s.close();}
});
