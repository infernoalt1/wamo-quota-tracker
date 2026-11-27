import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { newGame, join, spectate, start, act, kill, view, results } from '../lib/engine.mjs';
import { mountLeaderboard } from '../lib/leaderboard.mjs';
import { keyOf } from '../lib/accounts.mjs';
import { botcApi } from '../server.mjs';
import { lookOf, progressOf, ITEM, CHEST, CHEST_ITEMS, SETS, rollChest } from '../lib/cosmetics.mjs';
import { createBets } from '../lib/bets.mjs';
import { adminKeys, GRANT } from '../lib/admin.mjs';

// The same interface as the Postgres store, held in memory.
function memoryStore(){
  const accounts=[],games=[],rows=[];
  return {
    accounts,games,rows,
    items:[],
    add(username){const a={id:crypto.randomUUID(),username,key:keyOf(username),session:crypto.randomUUID(),avatar_version:0,pictured:false,look:null};accounts.push(a);return a;},
    async create({id,username,key,session,hash}){if(accounts.some(a=>a.key===key||a.session===session))return null;const a={id,username,key,session,password_hash:hash??'x',avatar_version:0,pictured:false,look:null};accounts.push(a);return {...a};},
    byKey:async key=>accounts.find(a=>a.key===key)||null,
    bySession:async session=>{const a=accounts.find(x=>x.session===session);return a?{...a}:null;},
    async setLook(id,look){const a=accounts.find(x=>x.id===id);a.look=look;return {...a};},
    wonSince:async(ids,since)=>new Set(rows.filter(r=>r.won&&ids.includes(r.account)&&games.find(g=>g.id===r.game_id).ended_at>=since).map(r=>r.account)),
    ledger:[],
    async wallet(id){const mine=this.items.filter(i=>i.account===id);return {earned:rows.filter(r=>r.account===id).reduce((n,r)=>n+(r.points||0),0),spent:mine.reduce((n,i)=>n+i.price,0),adjust:this.ledger.filter(l=>l.account===id).reduce((n,l)=>n+l.delta,0),owned:mine.map(i=>i.item)};},
    async balance(id){const w=await this.wallet(id);return w.earned-w.spent+w.adjust;},
    async buy(id,item,price,held=0){const w=await this.wallet(id);if(w.owned.includes(item))return 'owned';if(await this.balance(id)-held<price)return 'short';this.items.push({account:id,item,price});return 'bought';},
    async openChest(id,{price,refund,held=0,roll,bundle=item=>[item]}){if(await this.balance(id)-held<price)return {result:'short'};const item=roll(),duplicate=(await this.wallet(id)).owned.includes(item);this.ledger.push({account:id,delta:-price,kind:'chest',item,at:new Date()});if(duplicate)this.ledger.push({account:id,delta:refund,kind:'chest_refund',item,at:new Date()});else for(const x of bundle(item))if(!this.items.some(i=>i.account===id&&i.item===x))this.items.push({account:id,item:x,price:0});return {result:'opened',item,duplicate};},
    async gift({from,to,amount,held=0}){if(await this.balance(from)-held<amount)return 'short';const at=new Date();this.ledger.push({account:from,delta:-amount,kind:'gift',other:to,at},{account:to,delta:amount,kind:'gift',other:from,at});return 'sent';},
    async giftsReceived(id){return this.ledger.filter(l=>l.account===id&&['gift','grant'].includes(l.kind)&&l.delta>0).reverse().slice(0,5).map(l=>({username:accounts.find(a=>a.id===l.other).username,amount:l.delta,at:l.at}));},
    async sharedGame(a,b){return rows.some(r=>r.account===a&&rows.some(x=>x.account===b&&x.game_id===r.game_id));},
    async setPassword(id,hash){accounts.find(a=>a.id===id).password_hash=hash;},
    async resetPassword({id,by,hash}){accounts.find(a=>a.id===id).password_hash=hash;this.ledger.push({account:id,delta:0,kind:'reset',other:by,at:new Date()});},
    async chromaOwners(items){const by=new Map();for(const i of this.items)if(items.includes(i.item)){const a=accounts.find(x=>x.id===i.account);by.set(a.username,[...(by.get(a.username)||[]),i.item].sort());}return [...by].sort().map(([username,items])=>({username,items}));},
    async recallChromas({items,setOf,by,per}){const out=[];for(const a of accounts){const mine=this.items.filter(i=>i.account===a.id&&items.includes(i.item)).map(i=>i.item);if(!mine.length)continue;const sets=[...new Set(mine.map(setOf))].sort();this.items=this.items.filter(i=>!(i.account===a.id&&items.includes(i.item)));const look=Object.fromEntries(Object.entries(a.look||{}).filter(([,v])=>!items.includes(v)));a.look=Object.keys(look).length?look:null;for(const set of sets)this.ledger.push({account:a.id,delta:per,kind:'recall',other:by,item:set,at:new Date()});out.push({username:a.username,sets,amount:per*sets.length});}return out.sort((x,y)=>x.username.localeCompare(y.username));},
    async grant({to,by,amount}){this.ledger.push({account:to,delta:amount,kind:'grant',other:by,at:new Date()});},
    async grants(){return this.ledger.filter(l=>l.kind==='grant').reverse().slice(0,20).map(l=>({to:accounts.find(a=>a.id===l.account).username,by:accounts.find(a=>a.id===l.other)?.username,amount:l.delta,at:l.at}));},
    async balances(){return Promise.all(accounts.map(async a=>{const w=await this.wallet(a.id);return {id:a.id,username:a.username,created_at:new Date(),earned:w.earned,spent:w.spent,adjust:w.adjust,games:rows.filter(r=>r.account===a.id).length};}));},
    async activity(id){const name=x=>accounts.find(a=>a.id===x)?.username??null;return [
      ...rows.filter(r=>r.account===id).map(r=>({kind:'game',delta:r.points||0,item:r.initialRole,won:r.won,script:games.find(g=>g.id===r.game_id).script,at:games.find(g=>g.id===r.game_id).ended_at})),
      ...this.items.filter(i=>i.account===id&&i.price>0).map(i=>({kind:'buy',delta:-i.price,item:i.item,at:new Date(0)})),
      ...this.ledger.filter(l=>l.account===id).map(l=>({kind:l.kind,delta:l.delta,item:l.item,other:name(l.other),at:l.at}))].sort((a,b)=>b.at-a.at);},
    async activityTotals(id){const t={};for(const r of await this.activity(id)){const k=r.kind+(['gift','grant','bet'].includes(r.kind)&&r.delta<0?'_out':'');t[k]??={kind:k,n:0,total:0};t[k].n++;t[k].total+=r.delta;}return Object.values(t);},
    async addLedger(list){for(const r of list)this.ledger.push({...r,at:new Date()});},
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
  const {points,...status}=board.statusFor(saved,sessions[0]);assert.deepEqual(status,{status:'saved',counted:true,needed:3});assert.equal(points.total,45);
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
test('games still in play, and games the table votes to abandon, are never recorded',async()=>{
  const store=memoryStore(),{save,load}=harness(store),{g,sessions}=table(store,5);
  save(g);act(g,sessions[1],{type:'propose',kind:'lobby'});for(const s of sessions.slice(2,4))act(g,s,{type:'proposal_vote',proposal:g.proposal.id,yes:true});save(g);assert(load('ABCDEFGH').interrupted);await settled();
  assert.equal(store.games.length,0);
  assert.equal(load('ABCDEFGH').ledger,undefined);
});
test('a game the table votes to end and reveal has no winner, earns nothing and is never recorded',async()=>{
  const store=memoryStore(),{save,load}=harness(store),{g,sessions}=table(store,5);
  act(g,sessions[1],{type:'propose',kind:'reveal'});for(const s of sessions.slice(2,4))act(g,s,{type:'proposal_vote',proposal:g.proposal.id,yes:true});
  assert.equal(g.phase,'ended');save(g);await settled();
  assert.equal(store.games.length,0);assert.equal(load('ABCDEFGH').ledger.status,'called');
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
async function played(store,account,games,wins,{evil=false,script='tb',role='chef',demon=false,points=0,survived}={}){
  for(let i=0;i<games;i++)await store.saveGame({id:crypto.randomUUID(),script,winner:'good',reason:'',size:5,players:[{account:account.id,role,initialRole:role,evil,won:i<wins,survived:survived??i%2===0,demon,points}]});
}
test('the player list is alphabetical, with games played and no results',async()=>{
  const store=memoryStore(),[ana,bo,cy,di]=['Ana','Bo','Cy','Di'].map(n=>store.add(n));
  await played(store,ana,5,3);await played(store,bo,10,6);await played(store,cy,6,5);await played(store,di,2,2);
  await played(store,ana,2,2,{evil:true,demon:true,role:'imp',script:'bmr'});
  const s=await serve(store);
  try{
    const all=await s.get('/leaderboard');
    assert.equal(all.status,200);
    assert.deepEqual(all.data.players.map(p=>[p.username,p.games]),[['Ana',7],['Bo',10],['Cy',6],['Di',2]]);
    // Nothing in the list says who wins, so nobody can be ranked from it.
    assert(all.data.players.every(p=>!('wins' in p)&&!('rank' in p)&&!('good' in p)&&!('demonWins' in p)));
    const moon=await s.get('/leaderboard?script=bmr');
    assert.deepEqual(moon.data.players.map(p=>[p.username,p.games]),[['Ana',2]]);
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

const evilWins=g=>{g.poison=null;[0,1,2].forEach(i=>kill(g,g.players[i],'slayer'));assert.equal(g.winner,'evil');};
const nextGame=(load,host,end)=>{const g=load('ABCDEFGH');act(g,host,{type:'rematch'});start(g,ROLES5);end(g);return g;};
test('winners earn the most, and Demon wins and the first win of the day add a bonus',async()=>{
  const store=memoryStore(),{save,load,board}=harness(store),{g,sessions}=table(store,5);
  goodWins(g);save(g);await settled();
  assert.deepEqual(store.rows.map(r=>r.points),[45,45,45,5,5]);
  assert.deepEqual(board.statusFor(load('ABCDEFGH'),sessions[0]).points,{total:45,parts:[['Finished the game',5],['Your team won',25],['First win today',15]]});
  save(nextGame(load,sessions[0],evilWins));await settled();
  assert.deepEqual(store.rows.slice(5).map(r=>r.points),[5,5,5,45,55]);
  save(nextGame(load,sessions[0],goodWins));await settled();
  assert.deepEqual(store.rows.slice(10).map(r=>r.points),[30,30,30,5,5]);
});
test('decorations that no longer exist simply disappear',()=>{
  assert.deepEqual(lookOf({frame:'nope',color:'ash',title:'brass'}),{color:'ash'});
  assert.equal(lookOf({frame:'constructor'}),null);
  assert.equal(progressOf([{won:true,demon:true,evil:true,survived:false,initial_role:'imp'}]).demon_wins,1);
});

async function shop(clock=()=>Date.UTC(2026,0,15)){
  const store=memoryStore(),app=express();app.use('/botc/api/game',botcApi({store,admins:adminKeys(' Boss , '),clock}));
  const server=await new Promise(done=>{const s=app.listen(0,'127.0.0.1',()=>done(s));});
  const base=`http://127.0.0.1:${server.address().port}/botc/api/game`;
  const browser=()=>{let cookie='';return async(path,body)=>{const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)}),set=r.headers.get('set-cookie');if(set)cookie=set.split(';')[0];return {status:r.status,data:await r.json()};};};
  const member=async name=>{const call=browser();await call('/account/register',{username:name,password:'hunter22'});return {call,account:store.accounts.find(a=>a.username===name)};};
  return {store,browser,member,close:()=>server.close()};
}
const shopTest=(name,fn)=>test(name,async()=>{const s=await shop();try{await fn(s);}finally{s.close();}});
shopTest('the shop needs an account, and sells only what you can afford',async({store,browser,member})=>{
  assert.equal((await browser()('/shop')).status,401);
  const {call,account}=await member('Ana');
  let r=await call('/shop');assert.equal(r.status,200);assert.equal(r.data.balance,0);assert.deepEqual(r.data.look,{});assert.equal(r.data.daily.ready,true);
  assert.equal((await call('/shop/buy',{item:'brass'})).status,400);
  await played(store,account,5,5,{points:30});
  r=await call('/shop/buy',{item:'brass'});
  assert.equal(r.status,200);assert.equal(r.data.balance,30);assert.deepEqual(r.data.owned,['brass']);assert.deepEqual(r.data.look,{frame:'brass'});assert.equal(r.data.later,false);
  r=await call('/shop/buy',{item:'brass'});assert.equal(r.data.balance,30);
  for(const item of ['demon_crown','__proto__','constructor',42])assert.equal((await call('/shop/buy',{item})).status,400);
  assert.equal((await call('/shop/buy',{item:'nightshade'})).status,400);
  assert.equal((await call('/account')).data.account.look.frame,'brass');
});
shopTest('you can only wear what you own or have earned, and can take things off',async({store,member})=>{
  const {call,account}=await member('Ana');
  assert.equal((await call('/shop/equip',{kind:'frame',item:'nightshade'})).status,400);
  assert.equal((await call('/shop/equip',{kind:'frame',item:'demon_crown'})).status,400);
  assert.equal((await call('/shop/equip',{kind:'frame',item:'ash'})).status,400);
  assert.equal((await call('/shop/equip',{kind:'hat',item:null})).status,400);
  await played(store,account,10,10,{evil:true,demon:true,role:'imp',survived:false});
  let r=await call('/shop/equip',{kind:'frame',item:'demon_crown'});
  assert.equal(r.status,200);assert.deepEqual(r.data.look,{frame:'demon_crown'});assert.equal(r.data.progress.demon_wins,10);
  r=await call('/shop/equip',{kind:'color',item:'ghostlight'});assert.deepEqual(r.data.look,{frame:'demon_crown',color:'ghostlight'});
  r=await call('/shop/equip',{kind:'frame',item:null});assert.deepEqual(r.data.look,{color:'ghostlight'});
});
shopTest('seats show the account and look, and a change made mid-game waits for the next game',async({store,member})=>{
  const ana=await member('Ana'),others=await Promise.all(['Bo','Cy','Di','Ed'].map(member));
  await played(store,ana.account,10,10,{points:30});
  await ana.call('/shop/buy',{item:'brass'});
  const game=(await ana.call('/',{type:'create',name:'Ana'})).data,code=game.code;
  for(const o of others)await o.call('/',{type:'join',name:o.account.username,code});
  let seen=(await others[0].call(`?code=${code}`)).data.players[0];
  assert.equal(seen.account,'Ana');assert.deepEqual(seen.look,{frame:'brass'});
  await ana.call('/shop/equip',{kind:'color',item:null});
  await ana.call('/',{type:'start',code});
  const r=await ana.call('/shop/buy',{item:'nightshade'});
  assert.equal(r.data.later,true);assert.deepEqual(r.data.look,{frame:'nightshade'});
  assert.deepEqual((await others[0].call(`?code=${code}`)).data.players[0].look,{frame:'brass'});
  const vote=(await others[0].call('/',{type:'propose',kind:'lobby',code})).data.proposal;
  for(const o of others.slice(1,3))await o.call('/',{type:'proposal_vote',proposal:vote.id,code,yes:true});
  assert.deepEqual((await others[0].call(`?code=${code}`)).data.players[0].look,{frame:'nightshade'});
  assert.equal((await others[0].call(`?code=${code}`)).data.players[1].account,'Bo');
});
// Games that two accounts played together, so gifting between them is allowed.
async function together(store,a,b,games,points=30){
  for(let i=0;i<games;i++)await store.saveGame({id:crypto.randomUUID(),script:'tb',winner:'good',reason:'',size:5,players:[a,b].map(x=>({account:x.id,role:'chef',initialRole:'chef',evil:false,won:true,survived:true,demon:false,points}))});
}
shopTest('a chest costs points and gives a random decoration; chest-only items can be worn once found',async({store,member})=>{
  const {call,account}=await member('Ana');
  assert.equal((await call('/shop/chest',{})).status,400);
  await played(store,account,10,10,{points:15});
  let r=await call('/shop/chest',{});assert.equal(r.status,200,JSON.stringify(r.data));
  const got=ITEM[r.data.opened.item];assert(got&&(got.price||got.chest));assert.equal(r.data.opened.duplicate,false);
  assert.equal(r.data.balance,150-CHEST.price);assert(r.data.owned.includes(got.id));
  assert.equal((await call('/shop/chest',{})).status,400);
  assert.equal((await call('/shop/equip',{kind:'frame',item:'eclipse'})).status,400);
  store.items.push({account:account.id,item:'eclipse',price:0});
  assert.equal((await call('/shop/equip',{kind:'frame',item:'eclipse'})).status,200);
  assert.equal((await call('/shop/buy',{item:'eclipse'})).status,400);
});
test('a duplicate from a chest refunds part of the price instead',async()=>{
  const store=memoryStore(),ana=store.add('Ana');await played(store,ana,20,20,{points:30});
  store.items.push({account:ana.id,item:'brass',price:120});
  const opened=await store.openChest(ana.id,{price:CHEST.price,refund:CHEST.refund,roll:()=>'brass'});
  assert.deepEqual(opened,{result:'opened',item:'brass',duplicate:true});
  assert.equal(await store.balance(ana.id),600-120-CHEST.price+CHEST.refund);
});
test('a sale takes its share off items and chests, cuts the duplicate refund too, and refuses a price that has changed',async()=>{
  let now=Date.UTC(2026,10,27,20);const s=await shop(()=>now);
  try{
    const {call,account}=await s.member('Ana');await played(s.store,account,10,10,{points:100});
    let r=await call('/shop');assert.equal(r.data.sale.name,'Black Friday');assert.equal(r.data.chest.price,30);assert.equal(r.data.chest.refund,12);
    assert(r.data.chest.refund<r.data.chest.price);
    assert.equal((await call('/shop/buy',{item:'clock',price:1600})).status,409);
    r=await call('/shop/buy',{item:'clock',price:480});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.balance,1000-480);
    r=await call('/shop/chest',{price:30});assert.equal(r.status,200);assert.equal(r.data.balance,1000-480-30);
    now=Date.UTC(2026,10,28,8);
    r=await call('/shop');assert.equal(r.data.sale,null);assert.equal(r.data.chest.price,CHEST.price);
    r=await call('/shop/buy',{item:'moon',price:270});assert.equal(r.status,409);assert.match(r.data.error,/sale has ended/);
  }finally{s.close();}
});
test('chest odds follow the published tiers and never give an earned-only item',()=>{
  const seen={};for(let i=0;i<4000;i++){const item=ITEM[rollChest()];assert(!item.unlock);seen[item.tier]=(seen[item.tier]||0)+1;}
  for(const [tier,odds] of Object.entries(CHEST.odds))assert(Math.abs(seen[tier]/4000*100-odds)<4,`${tier}: ${seen[tier]}`);
  assert.equal(rollChest(()=>0),CHEST_ITEMS.find(i=>i.tier==='common').id);
});
shopTest('gifts go only to people you have played with, any amount they can afford, and need some games first',async({store,member})=>{
  const ana=await member('Ana'),bo=await member('Bo'),cy=await member('Cy');
  await together(store,ana.account,bo.account,2);
  assert.match((await ana.call('/shop/gift',{to:'Bo',amount:20})).data.error,/recorded games/);
  await together(store,ana.account,bo.account,3);await played(store,cy.account,5,5,{points:30});
  assert.match((await ana.call('/shop/gift',{to:'Ana',amount:20})).data.error,/yourself/);
  assert.match((await ana.call('/shop/gift',{to:'Cy',amount:20})).data.error,/played a recorded game with/);
  assert.equal((await ana.call('/shop/gift',{to:'Nobody',amount:20})).status,404);
  assert.equal((await ana.call('/shop/gift',{to:'Bo',amount:5})).status,400);
  assert.equal((await ana.call('/shop/gift',{to:'Bo',amount:20.5})).status,400);
  let r=await ana.call('/shop/gift',{to:'Bo',amount:60});assert.equal(r.status,200,JSON.stringify(r.data));
  assert.equal(r.data.balance,150-60);assert.deepEqual(r.data.sent,{to:'Bo',amount:60});
  // No daily limit and no top size: only what you can afford.
  r=await ana.call('/shop/gift',{to:'Bo',amount:90});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.balance,0);
  assert.match((await ana.call('/shop/gift',{to:'Bo',amount:10})).data.error,/enough points/);
  r=await bo.call('/shop');assert.equal(r.data.balance,150+150);assert.equal(r.data.gifts[0].from,'Ana');assert.equal(r.data.gifts[0].amount,90);
});
test('bets: only spectators, only before Day 2, within limits and what they can afford, once per game',async()=>{
  const store=memoryStore(),bets=createBets({store}),ana=store.add('Ana'),bo=store.add('Bo');await played(store,ana,4,4,{points:30});
  const g=newGame('ABCDEFGH','P0','s0');for(let i=1;i<5;i++)join(g,`P${i}`,`s${i}`);spectate(g,'Ana',ana.session);spectate(g,'Bo',bo.session);start(g,ROLES5);
  await assert.rejects(bets.place(g,'s1',ana,'good',20),/Only spectators/);
  await assert.rejects(bets.place(g,ana.session,ana,'neutral',20),/good or evil/);
  await assert.rejects(bets.place(g,ana.session,ana,'good',500),/between/);
  await assert.rejects(bets.place(g,bo.session,bo,'good',20),/enough points/);
  await bets.place(g,ana.session,ana,'evil',100);assert.equal(bets.heldFor(ana.id),100);
  await assert.rejects(bets.place(g,ana.session,ana,'good',10),/already/);
  assert.deepEqual(bets.viewFor(g,ana.session).mine,{team:'evil',stake:100});assert.equal(bets.viewFor(g,'s1'),null);
  const later=structuredClone(g);later.day=2;await assert.rejects(bets.place(later,bo.session,bo,'good',10),/Day 2/);
});
test('a recorded game pays bets on the winning team double and takes the losing stakes; anything else refunds',async()=>{
  const store=memoryStore(),bets=createBets({store}),ana=store.add('Ana'),bo=store.add('Bo');await played(store,ana,4,4,{points:30});await played(store,bo,4,4,{points:30});
  const table=()=>{const g=newGame('ABCDEFGH','P0','s0');for(let i=1;i<5;i++)join(g,`P${i}`,`s${i}`);spectate(g,'Ana',ana.session);spectate(g,'Bo',bo.session);start(g,ROLES5);return g;};
  let g=table();await bets.place(g,ana.session,ana,'good',50);await bets.place(g,bo.session,bo,'evil',30);
  goodWins(g);await bets.settle(g,'saved');
  assert.equal(await store.balance(ana.id),120+50);assert.equal(await store.balance(bo.id),120-30);assert.equal(bets.heldFor(ana.id),0);
  assert.deepEqual(bets.viewFor(g,'s1').list.map(b=>[b.username,b.outcome]),[['Ana','won'],['Bo','lost']]);
  for(const end of ['skipped','called','failed']){g=table();g.round=Math.random();await bets.place(g,ana.session,ana,'evil',40);goodWins(g);await bets.settle(g,end);assert.equal(await store.balance(ana.id),170);assert.equal(bets.viewFor(g,'s1').status,'refunded');}
  g=table();g.round=99;await bets.place(g,ana.session,ana,'good',40);assert.equal(bets.heldFor(ana.id),40);
  const next=structuredClone(g);next.round=100;bets.sync(next);assert.equal(bets.heldFor(ana.id),0);assert.equal(await store.balance(ana.id),170);
});
shopTest('a spectator bets through the site, and points held in a bet cannot be spent meanwhile',async({store,browser,member})=>{
  const host=browser(),game=(await host('/',{type:'create',name:'Host'})).data;
  for(let i=1;i<5;i++)await browser()('/',{type:'join',name:`P${i}`,code:game.code});
  await host('/',{type:'start',code:game.code});
  const ana=await member('Ana');await played(store,ana.account,10,10,{points:30});
  assert.equal((await host('/bet',{code:game.code,team:'good',stake:20})).status,401);
  assert.match((await ana.call('/bet',{code:game.code,team:'good',stake:20})).data.error,/Only spectators/);
  await ana.call('/',{type:'spectate',name:'Ana',code:game.code});
  const r=await ana.call('/bet',{code:game.code,team:'good',stake:100});assert.equal(r.status,200,JSON.stringify(r.data));
  assert.deepEqual(r.data.bets.mine,{team:'good',stake:100});assert.equal(r.data.bets.pool.good,100);
  const wallet=(await ana.call('/shop')).data;assert.equal(wallet.held,100);assert.equal(wallet.balance,300-100);
  assert.match((await ana.call('/shop/buy',{item:'violet'})).data.error,/enough points/);
});
shopTest('only admins can give points, and the player sees them in their shop',async({store,browser,member})=>{
  assert.deepEqual([...adminKeys('Boss, ana ,,')],['boss','ana']);assert.equal(adminKeys(undefined).size,0);
  const boss=await member('Boss'),ana=await member('Ana');
  assert.equal((await boss.call('/account')).data.account.admin,true);assert.equal((await ana.call('/account')).data.account.admin,undefined);
  assert.equal((await browser()('/admin')).status,403);
  assert.equal((await ana.call('/admin')).status,403);
  assert.equal((await ana.call('/admin/grant',{to:'Ana',amount:500})).status,403);
  let r=await boss.call('/admin');assert.equal(r.status,200);assert.deepEqual(r.data.grants,[]);
  for(const amount of [0,1.5,'50',GRANT.max+1])assert.equal((await boss.call('/admin/grant',{to:'Ana',amount})).status,400,String(amount));
  assert.equal((await boss.call('/admin/grant',{to:'Nobody',amount:50})).status,404);
  r=await boss.call('/admin/grant',{to:'ana',amount:500});assert.equal(r.status,200,JSON.stringify(r.data));
  assert.deepEqual(r.data.granted,{to:'Ana',amount:500,balance:500});
  r=await boss.call('/admin/grant',{to:'Ana',amount:-200});assert.equal(r.data.granted.balance,300);
  assert.deepEqual(r.data.grants.map(g=>[g.to,g.by,g.amount]),[['Ana','Boss',-200],['Ana','Boss',500]]);
  r=await ana.call('/shop');assert.equal(r.data.balance,300);assert.deepEqual(r.data.gifts.map(g=>[g.from,g.amount]),[['Boss',500]]);
  assert.equal((await ana.call('/shop/buy',{item:'brass'})).status,200);
  r=await boss.call('/admin');const row=r.data.players.find(p=>p.username==='Ana');
  assert.equal(row.balance,300-ITEM.brass.price);assert.equal(row.spent,ITEM.brass.price);assert.equal(r.data.players.length,2);
});
shopTest('a player can change their own password, given the current one',async({browser,member})=>{
  const ana=await member('Ana');
  assert.equal((await browser()('/account/password',{current:'hunter22',password:'new password'})).status,401);
  assert.equal((await ana.call('/account/password',{current:'wrong one',password:'new password'})).status,401);
  assert.equal((await ana.call('/account/password',{current:'hunter22',password:'short'})).status,400);
  const r=await ana.call('/account/password',{current:'hunter22',password:'new password'});assert.equal(r.status,200,JSON.stringify(r.data));
  assert.equal((await browser()('/account/login',{username:'Ana',password:'hunter22'})).status,401);
  assert.equal((await browser()('/account/login',{username:'Ana',password:'new password'})).status,200);
  assert.equal((await ana.call('/account')).data.account.username,'Ana');
});
shopTest('an admin can take back every Chroma, paying for each set',async({store,member})=>{
  const boss=await member('Boss'),ana=await member('Ana'),bo=await member('Bo');
  for(const item of [...SETS.glass.items,...SETS.wisps.items,'brass'])store.items.push({account:ana.account.id,item,price:0});
  for(const item of SETS.kaleido.items)store.items.push({account:bo.account.id,item,price:0});
  await store.setLook(ana.account.id,{frame:'glass',title:'wisps_title',color:'glass_ink'});await store.setLook(bo.account.id,{frame:'kaleido'});
  assert.equal((await ana.call('/admin/recall-chromas',{})).status,403);
  let r=await boss.call('/admin');assert.equal(r.data.recallPer,5000);
  assert.deepEqual(r.data.chromas,[{username:'Ana',sets:['glass','wisps']},{username:'Bo',sets:['kaleido']}]);
  for(const per of [-1,1.5,'5000'])assert.equal((await boss.call('/admin/recall-chromas',{per})).status,400,String(per));
  r=await boss.call('/admin/recall-chromas',{});assert.equal(r.status,200,JSON.stringify(r.data));
  assert.deepEqual(r.data.recalled,[{username:'Ana',sets:['glass','wisps'],amount:10000},{username:'Bo',sets:['kaleido'],amount:5000}]);
  assert.deepEqual(r.data.chromas,[]);
  r=await ana.call('/shop');assert.equal(r.data.balance,10000);assert.deepEqual(r.data.owned,['brass']);assert.deepEqual(r.data.look,{});
  r=await bo.call('/shop');assert.equal(r.data.balance,5000);assert.deepEqual(r.data.owned,[]);
  r=await boss.call('/admin/player?username=Ana');assert.deepEqual(r.data.player.activity.filter(a=>a.kind==='recall').map(a=>[a.item,a.delta,a.other]).sort(),[['glass',5000,'Boss'],['wisps',5000,'Boss']]);
  assert.deepEqual((await boss.call('/admin/recall-chromas',{per:0})).data.recalled,[]);
});
shopTest('an admin can give a player who forgot their password a new one',async({store,browser,member})=>{
  const boss=await member('Boss'),ana=await member('Ana');
  assert.equal((await ana.call('/admin/reset',{username:'Boss'})).status,403);
  assert.equal((await boss.call('/admin/reset',{username:'Nobody'})).status,404);
  const r=await boss.call('/admin/reset',{username:'ana'});assert.equal(r.status,200,JSON.stringify(r.data));
  assert.equal(r.data.reset.username,'Ana');assert.match(r.data.reset.password,/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
  assert.equal((await browser()('/account/login',{username:'Ana',password:'hunter22'})).status,401);
  const login=await browser()('/account/login',{username:'Ana',password:r.data.reset.password});
  assert.equal(login.status,200,JSON.stringify(login.data));assert.equal(login.data.account.username,'Ana');
  const p=(await boss.call('/admin/player?username=Ana')).data.player;
  assert.deepEqual(p.activity.map(a=>[a.kind,a.delta,a.other]),[['reset',0,'Boss']]);assert.equal(p.balance,0);
  // Or the admin picks it.
  for(const password of ['short',42,'x'.repeat(73)])assert.equal((await boss.call('/admin/reset',{username:'Ana',password})).status,400,String(password));
  assert.equal((await boss.call('/admin/reset',{username:'Ana',password:'moonlit raven'})).data.reset.password,'moonlit raven');
  assert.equal((await browser()('/account/login',{username:'Ana',password:'moonlit raven'})).status,200);
});
shopTest('an admin sees the points a player earned, spent, opened and was given',async({store,member})=>{
  const boss=await member('Boss'),ana=await member('Ana');
  assert.equal((await ana.call('/admin/player?username=Boss')).status,403);
  assert.equal((await boss.call('/admin/player?username=Nobody')).status,404);
  await played(store,ana.account,4,4,{points:30});
  await boss.call('/admin/grant',{to:'Ana',amount:300});
  await ana.call('/shop/buy',{item:'brass'});
  await store.openChest(ana.account.id,{price:CHEST.price,refund:CHEST.refund,roll:()=>'brass'});
  const r=await boss.call('/admin/player?username=ana');assert.equal(r.status,200,JSON.stringify(r.data));
  const p=r.data.player;
  assert.equal(p.username,'Ana');assert.equal(p.balance,120+300-ITEM.brass.price-CHEST.price+CHEST.refund);
  assert.deepEqual(p.totals.game,{n:4,total:120});assert.deepEqual(p.totals.grant,{n:1,total:300});assert.deepEqual(p.totals.chest,{n:1,total:-CHEST.price});
  assert.deepEqual(p.totals.chest_refund,{n:1,total:CHEST.refund});assert.deepEqual(p.totals.buy,{n:1,total:-ITEM.brass.price});
  const kinds=p.activity.map(a=>a.kind);for(const k of ['game','buy','chest','chest_refund','grant'])assert(kinds.includes(k),k);
  assert.equal(p.activity.find(a=>a.kind==='chest').item,'brass');assert.equal(p.activity.find(a=>a.kind==='grant').other,'Boss');
  assert.equal(p.activity.find(a=>a.kind==='game').item,'chef');
});
// Opens a chest with chosen dice: the first number picks the tier, the next the item.
async function rigged(call,...rolls){const random=Math.random;let i=0;Math.random=()=>rolls[Math.min(i++,rolls.length-1)];try{return await call('/shop/chest',{});}finally{Math.random=random;}}
test('a Chroma is a whole set of five, one of each kind, and only its frame can be rolled',()=>{
  for(const set of Object.values(SETS)){
    assert.deepEqual(set.items.map(id=>ITEM[id].kind).sort(),['color','frame','hand','mark','title']);
    for(const id of set.items){assert.equal(ITEM[id].tier,'chroma');assert(ITEM[id].chest);}
    assert(ITEM[set.items.find(id=>ITEM[id].kind==='hand')].fx);assert(ITEM[set.items.find(id=>ITEM[id].kind==='mark')].fx);
  }
  assert.equal(CHEST.odds.chroma,0.3);assert.equal(CHEST.price,100);
  const found=new Set();for(let i=0;i<300;i++)found.add(rollChest((()=>{let n=0;return()=>n++?i/300:.999;})()));
  assert.deepEqual([...found].sort(),Object.keys(SETS).sort());
});
shopTest('a Chroma chest gives the whole set, can be worn at once, and is announced to the table between games',async({store,browser,member})=>{
  const ana=await member('Ana');await played(store,ana.account,10,10,{points:30});
  const host=browser(),game=(await host('/',{type:'create',name:'Host'})).data;
  await ana.call('/',{type:'join',name:'Ana',code:game.code});
  let r=await rigged(ana.call,.999,.9);assert.equal(r.status,200,JSON.stringify(r.data));
  assert.deepEqual(r.data.opened,{item:'kaleido',duplicate:false,refund:0});
  for(const id of SETS.kaleido.items)assert(r.data.owned.includes(id),id);
  let table=(await host(`/?code=${game.code}`)).data;
  assert.equal(table.flair.length,1);assert.equal(table.flair[0].set,'kaleido');assert.equal(table.flair[0].seat,table.players.find(p=>p.name==='Ana').id);
  r=await ana.call('/shop/equip-set',{set:'kaleido'});assert.equal(r.status,200,JSON.stringify(r.data));
  assert.deepEqual(r.data.look,{frame:'kaleido',color:'kaleido_ink',title:'kaleido_title',hand:'kaleido_hand',mark:'kaleido_mark'});
  for(const set of ['glass','__proto__',42])assert.equal((await ana.call('/shop/equip-set',{set})).status,400);
  // The same set again is a duplicate: part of the price back, and nothing to announce.
  r=await rigged(ana.call,.999,.9);assert.equal(r.data.opened.duplicate,true);assert.equal(r.data.balance,300-2*CHEST.price+CHEST.refund);
  table=(await host(`/?code=${game.code}`)).data;assert.equal(table.flair.length,1);
});
shopTest('a Chroma found during a game is not announced at that table',async({store,browser,member})=>{
  const host=browser(),game=(await host('/',{type:'create',name:'Host'})).data;
  for(let i=1;i<4;i++)await browser()('/',{type:'join',name:`P${i}`,code:game.code});
  const bo=await member('Bo');await played(store,bo.account,5,5,{points:30});
  await bo.call('/',{type:'join',name:'Bo',code:game.code});
  assert.equal((await host('/',{type:'start',code:game.code})).status,200);
  const r=await rigged(bo.call,.999,.1);assert.equal(r.data.opened.item,'glass');
  assert.deepEqual((await host(`/?code=${game.code}`)).data.flair,[]);
});
