import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import http from 'node:http';
import express from 'express';
import {createRoom,addPlayer,configure,start,tickRoom,submit,snapshot,callOut,confirmCallout,cancelCallout,leave,timing} from './engine.mjs';
import {catalog,normalize,answerKey} from './catalog.mjs';
import {handleRequest,rooms,tick as tickServer} from './server.mjs';
import {recapCsv} from './recap.mjs';

function game(count=3,settings={}){
  const r=createRoom('TEST');for(let i=0;i<count;i++)addPlayer(r,['Alex','Sam','Jo','Lee','Max','Kim','Bo','Val'][i]||'Player '+i);
  configure(r,{category:'animals',...settings});start(r);tickRoom(r,r.deadline);return r;
}
const current=r=>r.players.find(p=>p.id===r.active);
const answer=(r,text)=>submit(r,current(r),{answer:text,turn:r.turn},{now:r.startedAt+10});
const reviewNow=r=>r.deadline-timing.review+10;
const finishPhase=r=>tickRoom(r,r.deadline);
const category=id=>catalog.find(c=>c.id===id);

test('formatting and common noun plurals normalize without merging specific answers',()=>{
  assert.equal(normalize("McDonald's"),normalize('McDonalds'));
  assert.equal(normalize(' MC DONALDS! '),normalize('mcdonalds'));
  assert.equal(normalize('Beyonc\u00e9'),normalize('beyonce'));
  for(const [a,b] of [['shark','sharks'],['mouse','mice'],['fox','foxes'],['butterfly','butterflies'],['wolf','wolves']])assert.equal(answerKey(category('animals'),a),answerKey(category('animals'),b));
  assert.equal(answerKey(category('objects'),'knife'),answerKey(category('objects'),'knives'));
  assert.equal(answerKey(category('kitchen'),'salt shaker'),answerKey(category('kitchen'),'salt shakers'));
  assert.notEqual(answerKey(category('animals'),'shark'),answerKey(category('animals'),'great white shark'));
  assert.notEqual(answerKey(category('movies'),'Cars'),answerKey(category('movies'),'Car'));
  assert.equal(answerKey(category('planets'),'Mars'),'mars');
  assert.equal(answerKey({id:'custom'},'James'),'james');
});
test('every category, including formerly finite ones, accepts community-judged answers without network access',()=>{
  const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('Unexpected network request');};
  try{
    for(const c of catalog){
      assert.equal(c.answers,undefined);assert.equal(c.closed,undefined);
      const r=game(3,{category:c.id});answer(r,'a very unusual local answer');assert.equal(r.phase,'review',c.name);assert.equal(r.players[0].alive,true);assert.equal(r.answers[0].status,'accepted');
    }
    for(const text of ['Pluto','Camry','Elephant','qwerty','123','Unknown Local Person']){const r=game();answer(r,text);assert.equal(r.phase,'review');}
  }finally{globalThis.fetch=originalFetch;}
});
test('custom and local packs work; random All excludes personal local prompts',()=>{
  const custom=game(3,{pack:'Custom',custom:'Teachers at our school'});answer(custom,'Ms Rivera');assert.equal(custom.phase,'review');assert.equal(custom.category.name,'Teachers at our school');
  const local=game(3,{pack:'Local',category:'random'});assert.equal(local.category.pack,'Local');
  for(let i=0;i<20;i++)assert.notEqual(game(2,{category:'random',pack:'All'}).category.pack,'Local');
});
test('acceptance is immediate, pauses the timer, and rotates after a brief call-out window',()=>{
  const r=game();answer(r,'shark');assert.equal(r.phase,'review');assert.equal(r.answers.length,1);assert.equal(r.used.size,1);
  const deadline=r.deadline;tickRoom(r,deadline-1);assert.equal(r.phase,'review');tickRoom(r,deadline);assert.equal(r.phase,'turn');assert.equal(current(r).name,'Sam');assert.equal(r.answers.length,1);
});
test('duplicates eliminate, including normalization and obvious plurals',()=>{
  const r=game();answer(r,'shark');finishPhase(r);answer(r,'SHARKS!');assert.equal(r.players[1].alive,false);assert.equal(current(r).name,'Jo');
  answer(r,'great white shark');assert.equal(r.phase,'review');assert.equal(r.players[2].alive,true);
});
test('wrong player, repeated request, and stale turn cannot submit twice',()=>{
  const r=game();assert.throws(()=>submit(r,r.players[1],{answer:'fox',turn:r.turn}),/ended/);
  const turn=r.turn;answer(r,'fox');assert.throws(()=>submit(r,r.players[0],{answer:'cat',turn}),/ended/);finishPhase(r);
  assert.throws(()=>submit(r,current(r),{answer:'cat',turn}),/ended/);assert.equal(r.answers.length,1);
});
test('empty input keeps the timer running and late answers lose the turn',()=>{
  const r=game();assert.throws(()=>answer(r,'!!!'),/Type an answer/);assert.equal(r.phase,'turn');
  assert.throws(()=>submit(r,current(r),{answer:'fox',turn:r.turn},{now:r.deadline}),/Time ran out/);assert.equal(r.players[0].alive,false);
});
test('3-player call-out requires exactly one distinct additional active player',()=>{
  const r=game();answer(r,'elephant');const now=reviewNow(r);callOut(r,r.players[1],r.turn,now);
  assert.equal(r.phase,'callout');assert.equal(r.players[0].alive,true);assert.equal(snapshot(r,r.players[0],now).pending.canConfirm,false);assert.equal(snapshot(r,r.players[1],now).pending.canConfirm,false);assert.equal(snapshot(r,r.players[2],now).pending.canConfirm,true);
  assert.throws(()=>confirmCallout(r,r.players[0],r.turn,now+1),/cannot confirm/);assert.throws(()=>confirmCallout(r,r.players[1],r.turn,now+1),/cannot confirm/);
  confirmCallout(r,r.players[2],r.turn,now+2);assert.equal(r.phase,'calledout');assert.equal(r.players[0].alive,false);assert.equal(r.answers[0].status,'invalid');assert.equal(r.used.size,0);
  assert.throws(()=>confirmCallout(r,r.players[2],r.turn,now+3),/cannot confirm/);finishPhase(r);assert.equal(current(r).name,'Sam');assert.equal(r.phase,'turn');
});
test('two people suffice with eight active players; no majority is required',()=>{
  const r=game(8);answer(r,'spaceship');const now=reviewNow(r);callOut(r,r.players[4],r.turn,now);confirmCallout(r,r.players[7],r.turn,now+1);
  assert.equal(r.players[0].alive,false);assert.equal(r.phase,'calledout');assert.equal(r.pending.confirmedBy,r.players[7].id);
});
test('with exactly two active players a single opponent succeeds, but points wait for undo grace',()=>{
  const r=game(2,{rounds:1});answer(r,'spaceship');const now=reviewNow(r);callOut(r,r.players[1],r.turn,now);
  assert.equal(r.phase,'calledout');assert.equal(r.players[0].alive,false);assert.equal(r.players[1].score,0);assert.equal(r.pending.confirmedBy,null);
  tickRoom(r,r.deadline-1);assert.equal(r.players[1].score,0);finishPhase(r);assert.equal(r.phase,'result');assert.equal(r.players[1].score,1);finishPhase(r);assert.equal(r.phase,'finished');assert.equal(r.players[1].score,1);
});
test('two-player rule counts survivors, not eliminated people or late spectators',()=>{
  const r=game(4);r.players[2].alive=false;r.players[3].alive=false;const late=addPlayer(r,'Watcher');answer(r,'spaceship');const now=reviewNow(r);
  for(const p of [r.players[0],r.players[2],r.players[3],late])assert.throws(()=>callOut(r,p,r.turn,now),/cannot call out/);
  callOut(r,r.players[1],r.turn,now);assert.equal(r.phase,'calledout');
});
test('a failed call-out expires quickly without elimination or new discussion',()=>{
  const r=game();answer(r,'mystery animal');const now=reviewNow(r);callOut(r,r.players[1],r.turn,now);assert.equal(r.deadline,now+timing.confirmation);
  finishPhase(r);assert.equal(r.phase,'turn');assert.equal(current(r).name,'Sam');assert.equal(r.players[0].alive,true);assert.equal(r.answers[0].status,'accepted');assert.equal(r.used.size,1);
});
test('the caller can cancel a pending call-out; others cannot',()=>{
  const r=game();answer(r,'cat');const now=reviewNow(r);callOut(r,r.players[1],r.turn,now);
  assert.throws(()=>cancelCallout(r,r.players[0],r.turn,now+10),/undo window/);assert.throws(()=>cancelCallout(r,r.players[2],r.turn,now+10),/undo window/);
  cancelCallout(r,r.players[1],r.turn,now+10);assert.equal(r.phase,'turn');assert.equal(r.players[0].alive,true);assert.equal(r.answers[0].status,'accepted');assert.equal(r.used.size,1);
});
test('undo restores eliminated player and duplicate tracking without awarding a point',()=>{
  for(const count of [2,3]){
    const r=game(count);answer(r,'cat');const now=reviewNow(r);callOut(r,r.players[1],r.turn,now);if(count===3)confirmCallout(r,r.players[2],r.turn,now+10);
    cancelCallout(r,r.players[1],r.turn,now+20);assert.equal(r.phase,'turn');assert.equal(r.players[0].alive,true);assert.equal(r.answers[0].status,'accepted');assert.equal(r.used.size,1);assert.equal(r.players.reduce((n,p)=>n+p.score,0),0);
    answer(r,'cats');assert.equal(r.players[1].alive,false);
  }
});
test('call-out, confirmation and undo enforce exact server deadlines and turn IDs',()=>{
  let r=game();answer(r,'cat');assert.throws(()=>callOut(r,r.players[1],r.turn-1,reviewNow(r)),/cannot call out/);assert.throws(()=>callOut(r,r.players[1],r.turn,r.deadline),/cannot call out/);
  callOut(r,r.players[1],r.turn,reviewNow(r));assert.throws(()=>confirmCallout(r,r.players[2],r.turn,r.deadline),/cannot confirm/);assert.throws(()=>confirmCallout(r,r.players[2],r.turn-1,r.deadline-1),/cannot confirm/);assert.throws(()=>cancelCallout(r,r.players[1],r.turn,r.pending.undoUntil),/undo window/);
  r=game(2);answer(r,'cat');callOut(r,r.players[1],r.turn,reviewNow(r));assert.throws(()=>cancelCallout(r,r.players[1],r.turn-1,r.deadline-1),/undo window/);assert.throws(()=>cancelCallout(r,r.players[1],r.turn,r.deadline),/undo window/);
});
test('eliminated, departed and new players cannot confirm',()=>{
  const r=game(5);r.players[3].alive=false;r.players[4].left=true;r.players[4].alive=false;answer(r,'cat');const now=reviewNow(r);callOut(r,r.players[1],r.turn,now);const late=addPlayer(r,'Late');
  for(const p of [r.players[3],r.players[4],late])assert.throws(()=>confirmCallout(r,p,r.turn,now+1),/cannot confirm/);
});
test('departures during an unconfirmed call-out never convert it into automatic rejection',()=>{
  for(const departing of [1,2]){
    const r=game();answer(r,'cat');const now=reviewNow(r);callOut(r,r.players[1],r.turn,now);leave(r,r.players[departing],now+1);
    assert.equal(r.phase,'turn');assert.equal(r.players[0].alive,true);assert.equal(r.answers[0].status,'accepted');assert.equal(r.used.size,1);
  }
});
test('answerer departures, disconnects and late arrivals do not block round settlement',()=>{
  let r=game();answer(r,'cat');const now=reviewNow(r);callOut(r,r.players[1],r.turn,now);leave(r,r.players[0],now+1);assert.equal(r.phase,'turn');assert.equal(current(r).name,'Sam');
  r=game(2);answer(r,'cat');callOut(r,r.players[1],r.turn,reviewNow(r));leave(r,r.players[1],r.deadline-1);finishPhase(r);assert.equal(r.phase,'result');assert.equal(r.winner,null);assert.equal(r.players.reduce((n,p)=>n+p.score,0),0);
});
test('hidden history never leaks accepted or rejected answers after the interaction',()=>{
  for(const successful of [false,true]){
    const r=game(3,{showAnswers:false});answer(r,'secret walrus');const now=reviewNow(r);callOut(r,r.players[1],r.turn,now);
    assert.equal(snapshot(r,r.players[2],now).pending.answer,'secret walrus');assert.deepEqual(snapshot(r,r.players[2],now).answers,[]);
    if(successful)confirmCallout(r,r.players[2],r.turn,now+1);finishPhase(r);
    for(const p of r.players){const s=snapshot(r,p);assert.equal(s.pending,null);assert.ok(!JSON.stringify(s).includes('secret walrus'));assert.deepEqual(s.answers,[]);}
  }
});
test('round wins settle once and everyone returns; final results and tied scores persist',()=>{
  const r=game(2,{rounds:2});finishPhase(r);assert.equal(r.phase,'result');assert.equal(r.players[1].score,1);tickRoom(r,r.deadline-1);assert.equal(r.players[1].score,1);
  finishPhase(r);assert.equal(r.round,2);assert.equal(r.players.filter(p=>p.alive).length,2);finishPhase(r);assert.equal(current(r).name,'Sam');finishPhase(r);assert.equal(r.players[0].score,1);finishPhase(r);assert.equal(r.phase,'finished');assert.deepEqual(r.players.map(p=>p.score),[1,1]);
});
test('disconnected host transfers, grace expires, and unused rooms are collected',()=>{
  const r=createRoom('AWAY'),host=addPlayer(r,'Host'),guest=addPlayer(r,'Friend'),now=Date.now();
  guest.streams.add({write(){},end(){}});rooms.set(r.code,r);host.lastSeen=now-21000;tickServer(now);assert.equal(r.host,guest.id);assert.equal(host.left,false);
  host.lastSeen=now-61000;tickServer(now);assert.equal(host.left,true);assert.equal(guest.left,false);
  guest.streams.clear();guest.left=true;r.updated=now-16*60000;tickServer(now);assert.equal(rooms.has(r.code),false);
});
test('planned categories play in order and the finished recap includes all rounds and outcomes',()=>{
  const r=game(2,{rounds:2,categoryMode:'plan',roundPlan:['Animals','Our totally made-up category'],showAnswers:false});
  assert.equal(r.category.id,'animals');answer(r,'fox');finishPhase(r);answer(r,'FOX');
  assert.equal(r.phase,'result');assert.equal(snapshot(r,r.players[0]).recap,null);
  finishPhase(r);assert.equal(r.category.name,'Our totally made-up category');finishPhase(r);
  answer(r,'a local joke');callOut(r,r.players[0],r.turn,reviewNow(r));finishPhase(r);finishPhase(r);
  assert.equal(r.phase,'finished');const recap=snapshot(r,r.players[0]).recap;
  assert.equal(recap.rounds.length,2);assert.deepEqual(recap.rounds[0].answers.map(a=>a.status),['accepted','duplicate']);
  assert.equal(recap.rounds[0].answers[1].answer,'FOX');assert.equal(recap.rounds[1].answers[0].status,'invalid');
  assert.equal(recap.rounds[1].answers[0].callout.caller,'Alex');assert.equal(recap.rounds[1].answers[0].callout.outcome,'upheld');
  assert.ok(!JSON.stringify(recap).includes(r.players[0].token));assert.equal(recap.rounds[0].answers[0].key,undefined);
  const previous=JSON.stringify(recap);r.phase='lobby';assert.equal(snapshot(r,r.players[1]).recap.id,recap.id);
  start(r);assert.equal(snapshot(r,r.players[0]).recap,null);assert.equal(JSON.stringify(r.lastRecap),previous);assert.equal(r.gameLog.length,1);
});
test('recaps include timeouts, undone call-outs and departed players',()=>{
  const r=game(3,{rounds:1});answer(r,'cat');callOut(r,r.players[1],r.turn,reviewNow(r));confirmCallout(r,r.players[2],r.turn,reviewNow(r));cancelCallout(r,r.players[1],r.turn,r.deadline-1);
  leave(r,r.players[2]);finishPhase(r);finishPhase(r);
  assert.equal(r.phase,'finished');assert.equal(r.lastRecap.players[2].left,true);
  assert.equal(r.lastRecap.rounds[0].answers[0].callout.outcome,'undone');assert.equal(r.lastRecap.rounds[0].answers[0].status,'accepted');
  assert.equal(r.lastRecap.rounds[0].answers[1].status,'timeout');
});
test('round plan validation prevents empty rounds and rejects malformed input',()=>{
  const r=createRoom('PLAN');addPlayer(r,'A');addPlayer(r,'B');configure(r,{categoryMode:'plan',rounds:2,roundPlan:['Custom']});
  assert.throws(()=>start(r),/every round/);assert.equal(r.phase,'lobby');
  for(const roundPlan of ['Animals',[null],Array(21).fill('Animals'),['x'.repeat(81)]])assert.throws(()=>configure(r,{roundPlan}));
  configure(r,{roundPlan:['Any category','Another category']});start(r);assert.equal(r.category.name,'Any category');
});
test('CSV exports escape quotes, multiline answers, Unicode, and formula-like cells',()=>{
  const csv=recapCsv({room:'TEST',id:'game',players:[{id:'p',score:2}],rounds:[{round:1,category:'=SUM(1,2)',winner:{name:'Sam'},answers:[{player:'p',turn:1,name:'@name',answer:'hello, "world"\n\u732b',status:'accepted'}]}]});
  assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"\'=SUM(1,2)"'));assert.ok(csv.includes('"\'@name"'));assert.ok(csv.includes('"hello, ""world""\n\u732b"'));assert.ok(csv.includes('"Sam","2"'));
});
test('client assets and instructions have no legacy judges, answer sets, or majority controls',async()=>{
  const app=await readFile(new URL('./app.js',import.meta.url),'utf8'),html=await readFile(new URL('./index.html',import.meta.url),'utf8'),docs=await readFile(new URL('./README.md',import.meta.url),'utf8');
  for(const text of [app,html,docs])assert.doesNotMatch(text,/Gemini|GEMINI_API_KEY|aiAvailable|castVote|data-vote|majority|dataset(?!\.)|answer sets/i);
  assert.match(app,/confirmCallout/);assert.match(app,/cancelCallout/);assert.match(html,/Call Out/);
  await assert.rejects(()=>access(new URL('./datasets.mjs',import.meta.url)));await assert.rejects(()=>access(new URL('./validation.mjs',import.meta.url)));
});
test('mounted /categories supports HTTP call-outs, permissions, SSE recovery, undo and rematch',async t=>{
  const app=express();app.use('/categories',(req,res)=>{if(req.originalUrl.split('?')[0]==='/categories')return res.redirect(308,'/categories/'+(req.originalUrl.includes('?')?req.originalUrl.slice(req.originalUrl.indexOf('?')):''));return handleRequest(req,res);});
  const server=http.createServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();server.close();rooms.clear();});
  const base='http://127.0.0.1:'+server.address().port;
  const redirect=await fetch(base+'/categories?room=ABCDE',{redirect:'manual'});assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),'/categories/?room=ABCDE');
  for(const path of ['','app.js','style.css','config','health'])assert.equal((await fetch(base+'/categories/'+path)).status,200);
  const config=await(await fetch(base+'/categories/config')).json();assert.equal(config.aiAvailable,undefined);assert.equal(config.catalog[0].answers,undefined);
  const post=async(body,headers={})=>{const res=await fetch(base+'/categories/api',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});return {status:res.status,...await res.json()};};
  const host=await post({action:'create',name:'Host'}),guest=await post({action:'join',room:host.room,name:'Guest'}),third=await post({action:'join',room:host.room,name:'Third'});
  assert.equal(host.status,200);assert.equal(host.room.length,5);assert.equal(guest.status,200);assert.equal(third.status,200);
  assert.equal((await post({...guest,action:'start'})).status,400);assert.equal((await post({...host,action:'settings',settings:{category:'animals',rounds:1,showAnswers:false}})).status,200);assert.equal((await post({...host,action:'start'})).status,200);
  const r=rooms.get(host.room);finishPhase(r);
  assert.equal((await post({...guest,action:'export',format:'csv'})).status,400);
  assert.equal((await post({...host,action:'answer',turn:r.turn,answer:'spaceship'})).status,200);assert.equal(r.phase,'review');
  assert.equal((await post({...host,action:'callout',turn:r.turn})).status,400);
  assert.equal((await post({...guest,action:'callout',turn:r.turn})).status,200);assert.equal(r.phase,'callout');
  assert.equal((await post({...guest,action:'confirmCallout',turn:r.turn})).status,400);
  assert.equal((await post({...host,action:'resume'})).token,host.token);
  const controller=new AbortController();const stream=await fetch(base+'/categories/events?room='+third.room+'&token='+third.token,{signal:controller.signal});assert.match(stream.headers.get('content-type'),/text\/event-stream/);
  const reader=stream.body.getReader(),event=new TextDecoder().decode((await reader.read()).value);assert.ok(event.includes('event: state'));assert.ok(event.includes('"canConfirm":true'));assert.ok(!event.includes(host.token));controller.abort();
  assert.equal((await post({...third,action:'confirmCallout',turn:r.turn})).status,200);assert.equal(r.phase,'calledout');
  assert.equal((await post({...guest,action:'cancelCallout',turn:r.turn})).status,200);assert.equal(r.phase,'turn');assert.equal(r.players[0].alive,true);
  assert.equal((await post({...guest,action:'answer',answer:'SPACESHIP',turn:r.turn})).status,200);assert.equal(r.players[1].alive,false);
  assert.equal((await post({...third,action:'answer',answer:'not an animal',turn:r.turn})).status,200);
  assert.equal((await post({...host,action:'callout',turn:r.turn})).status,200);assert.equal(r.phase,'calledout');finishPhase(r);assert.equal(r.players[0].score,1);finishPhase(r);assert.equal(r.phase,'finished');
  const exported=await post({...guest,action:'export',format:'csv'});assert.equal(exported.status,200);assert.match(exported.filename,/\.csv$/);assert.match(exported.content,/SPACESHIP/);assert.match(exported.content,/duplicate/);
  assert.equal((await post({room:host.room,token:'wrong',action:'export',format:'json'})).status,410);
  assert.equal((await post({...host,action:'lobby'})).status,200);assert.equal(r.phase,'lobby');
  const exportedJson=await post({...third,action:'export',format:'json'});assert.equal(exportedJson.status,200);assert.equal(JSON.parse(exportedJson.content).rounds.length,1);
  assert.equal((await post({...guest,action:'leave'},{origin:'https://evil.example'})).status,400);
  assert.equal((await post({...host,action:'vote',value:false})).status,400);
  await post({...guest,action:'leave'});assert.equal((await post({...guest,action:'resume'})).status,410);
  assert.equal((await fetch(base+'/categories/engine.mjs')).status,404);
});
