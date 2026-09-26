import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import {createRoom,addPlayer,configure,start,tickRoom,submit,snapshot,castVote,challenge,leave} from './engine.mjs';
import {catalog,normalize,answerKey,knownVerdict} from './catalog.mjs';
import {validateAnswer} from './validation.mjs';
import {handleRequest,rooms,tick as tickServer} from './server.mjs';

function game(count=3,settings={}){const r=createRoom('TEST');for(let i=0;i<count;i++)addPlayer(r,['Alex','Sam','Jo'][i]);configure(r,{category:'planets',...settings});start(r);tickRoom(r,r.deadline);return r;}
const current=r=>r.players.find(p=>p.id===r.active);
async function answer(r,text,validate){const p=current(r);await submit(r,p,{answer:text,turn:r.turn},{now:r.startedAt+10,...(validate?{validate}: {})});}
const valid=async()=>({verdict:'valid',reason:'Accepted.'});

test('normalization, canonical aliases, and finite answer lists',()=>{
  assert.equal(normalize("McDonald's"),normalize('McDonalds'));assert.equal(normalize('Beyoncé'),normalize('beyonce'));
  const countries=catalog.find(c=>c.id==='countries');assert.equal(countries.answers.length,195);assert.equal(knownVerdict(countries,'USA'),'valid');assert.equal(answerKey(countries,'USA'),answerKey(countries,'United States'));
  assert.equal(knownVerdict(catalog.find(c=>c.id==='states'),'Alaska'),'valid');assert.equal(knownVerdict(catalog.find(c=>c.id==='states'),'Toronto'),'invalid');
  assert.equal(knownVerdict(catalog.find(c=>c.id==='planets'),'Pluto'),'invalid');assert.equal(catalog.find(c=>c.id==='nba').answers.length,30);
});
test('turns rotate, duplicates eliminate, only survivor gets a point',async()=>{
  const r=game();await answer(r,'Mars');assert.equal(r.phase,'review');tickRoom(r,r.deadline);assert.equal(r.answers.length,1);assert.equal(current(r).name,'Sam');
  await answer(r,'MARS');assert.equal(r.players[1].alive,false);assert.equal(current(r).name,'Jo');
  tickRoom(r,r.deadline);assert.equal(r.phase,'result');assert.equal(r.players[0].score,1);assert.equal(r.players[2].alive,false);
  tickRoom(r,r.deadline);assert.equal(r.phase,'reveal');assert.equal(r.round,2);assert.equal(r.players.filter(p=>p.alive).length,3);
});
test('hidden answers are absent from snapshots, including verdict history',async()=>{
  const r=game(3,{showAnswers:false});await answer(r,'Neptune');assert.equal(snapshot(r,r.players[1]).pending.answer,'Neptune');tickRoom(r,r.deadline);
  const json=JSON.stringify(snapshot(r,r.players[1]));assert.ok(!json.includes('Neptune'));assert.deepEqual(snapshot(r,current(r)).answers,[]);assert.equal(r.used.size,1);
  await answer(r,'neptune');assert.equal(r.players[1].alive,false);assert.ok(!JSON.stringify(snapshot(r,r.players[2])).includes('Neptune'));
});
test('timer stops immediately and concurrent or stale submissions cannot advance twice',async()=>{
  const r=game();let resolve;const pending=submit(r,current(r),{answer:'Earth',turn:r.turn},{now:r.startedAt+1,validate:()=>new Promise(done=>resolve=done)});
  assert.equal(r.phase,'checking');await assert.rejects(()=>answer(r,'Mars'),/ended/);tickRoom(r,r.deadline-1);assert.equal(r.phase,'checking');
  resolve({verdict:'valid',reason:'OK'});await pending;assert.equal(r.phase,'review');tickRoom(r,r.deadline);assert.equal(r.answers.length,1);
  await assert.rejects(()=>submit(r,current(r),{answer:'Venus',turn:r.turn-1}),/ended/);
});
test('late answer loses the turn; no grace window from heartbeat timing',async()=>{
  const r=game();await assert.rejects(()=>submit(r,current(r),{answer:'Mars',turn:r.turn},{now:r.deadline}),/Time ran out/);assert.equal(r.players[0].alive,false);assert.equal(current(r).name,'Sam');
});
test('uncertain AI votes exclude answerer; ties count; strict majority rejects',async()=>{
  const r=game();await answer(r,'Mars',async()=>({verdict:'unsure',reason:'Vote.'}));assert.equal(r.phase,'vote');
  assert.throws(()=>castVote(r,r.players[0],false,r.turn),/cannot vote/);castVote(r,r.players[1],true,r.turn);assert.throws(()=>castVote(r,r.players[1],false,r.turn),/already voted/);castVote(r,r.players[2],false,r.turn);assert.equal(r.answers.length,1);
  await answer(r,'Venus',async()=>({verdict:'unsure',reason:'Vote.'}));castVote(r,r.players[0],false,r.turn);castVote(r,r.players[2],false,r.turn);assert.equal(r.players[1].alive,false);
});
test('challenge allows appeal; voting timeout cannot stall game',async()=>{
  const r=game();await answer(r,'Pluto');assert.equal(r.pending.verdict,'invalid');challenge(r,r.players[0],r.turn);assert.equal(r.phase,'vote');tickRoom(r,r.deadline);assert.equal(r.answers.length,1);assert.equal(r.players[0].alive,true);
});
test('timed-out AI result is ignored after fallback and turn change',async()=>{
  const r=game();let resolve;const pending=submit(r,current(r),{answer:'Mars',turn:r.turn},{validate:()=>new Promise(done=>resolve=done)});
  tickRoom(r,r.deadline);assert.equal(r.phase,'vote');tickRoom(r,r.deadline);assert.equal(r.answers.length,1);const turn=r.turn;
  resolve({verdict:'invalid'});await pending;assert.equal(r.turn,turn);assert.equal(r.players[0].alive,true);
});
test('leaving during validation cannot resurrect a departed turn',async()=>{
  const r=game();let resolve;const p=current(r),pending=submit(r,p,{answer:'Mars',turn:r.turn},{validate:()=>new Promise(done=>resolve=done)});
  leave(r,p);assert.equal(current(r).name,'Sam');assert.equal(r.host,r.players[1].id);resolve({verdict:'valid'});await pending;assert.equal(r.answers.length,0);assert.equal(r.phase,'turn');
});
test('round limit, ties, custom packs and late spectators',()=>{
  const r=game(2,{rounds:1});const late=addPlayer(r,'New friend');assert.equal(late.alive,false);tickRoom(r,r.deadline);assert.equal(r.phase,'result');tickRoom(r,r.deadline);assert.equal(r.phase,'finished');assert.equal(r.players[1].score,1);
  const custom=game(2,{pack:'Custom',custom:'Things at a party\nTerrible superpowers'});assert.equal(custom.category.pack,'Custom');assert.ok(custom.category.name.length>0);
});
test('AI-free mode uses lists and explicit group fallback',async()=>{
  assert.equal((await validateAnswer(catalog.find(c=>c.id==='planets'),'Mars','group')).verdict,'valid');
  assert.equal((await validateAnswer(catalog.find(c=>c.id==='cold'),'snow','group')).verdict,'unsure');
});
test('AI adapter requests structured verdicts and fails safely on bad responses',async()=>{
  const savedFetch=globalThis.fetch,savedKey=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='test-only-key';
  const category=catalog.find(c=>c.id==='cold');
  try{
    globalThis.fetch=async(url,options)=>{
      assert.match(url,/generateContent$/);assert.equal(options.headers['x-goog-api-key'],'test-only-key');
      const body=JSON.parse(options.body);assert.equal(body.generationConfig.responseMimeType,'application/json');assert.deepEqual(JSON.parse(body.contents[0].parts[0].text),{category:category.name,answer:'ice'});
      return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'{"verdict":"valid"}'}]}}]})};
    };
    assert.equal((await validateAnswer(category,'ice')).verdict,'valid');
    globalThis.fetch=async()=>({ok:false});assert.equal((await validateAnswer(category,'ice')).verdict,'unsure');
    globalThis.fetch=async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:'not json'}]}}]})});assert.equal((await validateAnswer(category,'ice')).verdict,'unsure');
  }finally{globalThis.fetch=savedFetch;if(savedKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=savedKey;}
});
test('disconnected host transfers, grace expires, and unused rooms are collected',()=>{
  const r=createRoom('AWAY'),host=addPlayer(r,'Host'),guest=addPlayer(r,'Friend'),now=Date.now();
  guest.streams.add({write(){},end(){}});rooms.set(r.code,r);host.lastSeen=now-21000;tickServer(now);assert.equal(r.host,guest.id);assert.equal(host.left,false);
  host.lastSeen=now-61000;tickServer(now);assert.equal(host.left,true);assert.equal(guest.left,false);
  guest.streams.clear();guest.left=true;r.updated=now-16*60000;tickServer(now);assert.equal(rooms.has(r.code),false);
});
test('mounted /categories redirects, serves assets, supports multiplayer and resume',async t=>{
  const app=express();app.use('/categories',(req,res)=>{if(req.originalUrl.split('?')[0]==='/categories')return res.redirect(308,`/categories/${req.originalUrl.includes('?')?req.originalUrl.slice(req.originalUrl.indexOf('?')):''}`);return handleRequest(req,res);});
  const server=http.createServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();server.close();rooms.clear();});
  const base=`http://127.0.0.1:${server.address().port}`;
  const redirect=await fetch(base+'/categories?room=ABCDE',{redirect:'manual'});assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),'/categories/?room=ABCDE');
  for(const path of ['','app.js','style.css','config','health'])assert.equal((await fetch(base+'/categories/'+path)).status,200);
  const post=async(body,headers={})=>{const res=await fetch(base+'/categories/api',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});return {status:res.status,...await res.json()};};
  const host=await post({action:'create',name:'Host'});assert.equal(host.status,200);assert.equal(host.room.length,5);
  const guest=await post({action:'join',room:host.room,name:'Guest'});assert.equal(guest.status,200);
  assert.equal((await post({...guest,action:'start'})).status,400);assert.equal((await post({...host,action:'start'})).status,200);
  assert.equal((await post({...host,action:'resume'})).token,host.token);
  assert.equal((await post({...guest,action:'leave'},{origin:'https://evil.example'})).status,400);
  const controller=new AbortController();const stream=await fetch(`${base}/categories/events?room=${guest.room}&token=${guest.token}`,{signal:controller.signal});assert.equal(stream.headers.get('content-type'),'text/event-stream; charset=utf-8');
  const reader=stream.body.getReader();const event=new TextDecoder().decode((await reader.read()).value);assert.ok(event.includes('event: state'));assert.ok(!event.includes(host.token));controller.abort();
  await post({...guest,action:'leave'});assert.equal((await post({...guest,action:'resume'})).status,410);
  assert.equal((await fetch(base+'/categories/engine.mjs')).status,404);
});
