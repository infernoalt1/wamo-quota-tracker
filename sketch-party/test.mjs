import {test} from 'node:test';
import assert from 'node:assert/strict';
import {server,rooms,snapshot,tick} from './server.mjs';
import {guessPoints,artistPoints,emojiAvatar,wordHint} from './rules.mjs';

test('whole-point formula, time normalization and hints',()=>{
 assert.equal(guessPoints(20000,20000,80000),750);
 assert.equal(guessPoints(22000,20000,80000),721);
 assert.equal(guessPoints(40000,20000,80000),557);
 assert.equal(guessPoints(70000,20000,80000),434);
 assert.equal(guessPoints(40000,40000,160000),750);
 for(let t=0;t<80000;t+=100)assert.ok(guessPoints(t,0,80000)>=guessPoints(t+100,0,80000));
 assert.equal(artistPoints([40000,40000],2,80000),1100);
 assert.equal(artistPoints([40000],2,80000),550);
 assert.equal(artistPoints([],2,80000),0);
 assert.equal(wordHint('hot dog',[1,4],19999,60000),'___ ___');
 assert.equal(wordHint('hot dog',[1,4],20000,60000),'_o_ ___');
 assert.equal(wordHint('hot dog',[1,4],40000,60000),'_o_ d__');
 for(const e of ['🙂','👩🏽‍🚀','🇺🇦','1️⃣'])assert.equal(emojiAvatar(e),e);
 assert.throws(()=>emojiAvatar('hello'));
});

test('multiplayer lifecycle, private routing, results, departures and rematches',async t=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const call=async(action,data={})=>{const response=await fetch(base+'/api',{method:'POST',body:JSON.stringify({action,...data})});return{status:response.status,...await response.json()};};
 const join=async(name,room)=>call('join',{name,room});
 const setup=async()=>{const h=await call('create',{name:'Host',rounds:1,duration:60,words:['apple','banana','cactus']});const a=await join('A',h.room),b=await join('B',h.room),r=rooms.get(h.room);return{h,a,b,r};};
 const begin=async(h,r)=>{await call('start',h);await call('choose',{...h,word:r.choices[0]});};
 const capture=p=>{const events=[];p.streams.add({write:chunk=>events.push(JSON.parse(chunk.split('\ndata: ')[1])),end(){}});return events;};
 try{
 await t.test('no immediate awards; guesses public, solved replies private; settlement once',async()=>{
  const {h,a,b,r}=await setup();const events=r.players.map(capture);await begin(h,r);
  events.forEach(e=>e.length=0);await call('chat',{...a,text:'wrong'});assert.ok(events.every(e=>e.some(m=>m.text==='wrong')));
  r.players[1].lastChat=0;await call('chat',{...a,text:r.word});assert.ok(r.players.every(p=>p.score===0));assert.equal(r.phase,'draw');assert.equal(r.players[1].earned,0);
  events.forEach(e=>e.length=0);r.players[1].lastChat=0;await call('chat',{...a,text:'secret'});assert.ok(events[0].some(m=>m.text==='secret'));assert.ok(events[1].some(m=>m.text==='secret'));assert.ok(!events[2].some(m=>m.text==='secret'));
  assert.equal(snapshot(r,r.players[2]).word,null);assert.equal(snapshot(r,r.players[1]).word,r.word);
  await call('chat',{...b,text:r.word});assert.equal(r.phase,'reveal');assert.equal(r.results.length,3);assert.ok(r.players[0].score>1000);assert.ok(r.players[1].score>=400);
  const scores=r.players.map(p=>p.score);tick();assert.deepEqual(r.players.map(p=>p.score),scores);
 });
 await t.test('mid-turn arrivals spectate, cannot spoil or score, join the next turn',async()=>{
  const {h,a,b,r}=await setup();await begin(h,r);const late=await join('Late',h.room),p=r.players.at(-1);assert.ok(snapshot(r,p).spectator);assert.equal(r.eligible.length,2);
  const messages=capture(r.players[1]);await call('chat',{...late,text:r.word});assert.equal(p.guessed,false);assert.ok(!messages.some(m=>m.text===r.word));
  await call('chat',{...a,text:r.word});await call('leave',b);assert.equal(r.phase,'reveal');assert.equal(r.players.length,3);assert.ok(r.players[0].score<=600);assert.equal(p.score,0);
  r.deadline=Date.now()-1;tick();assert.equal(r.phase,'choose');assert.equal(snapshot(r,p).spectator,false);assert.ok(r.queue.includes(p.id));
 });
 await t.test('drawer departure settles earned answers and transfers host',async()=>{
  const {h,a,r}=await setup();await begin(h,r);await call('chat',{...a,text:r.word});const host=r.players[0];await call('leave',h);assert.equal(r.phase,'reveal');assert.equal(r.players.length,2);assert.equal(r.host,r.players[0].id);assert.ok(host.score>0);assert.ok(r.results.some(p=>p.id===host.id&&p.left));
 });
 await t.test('disconnect grace removes blocker; one remaining player ends game after reveal',async()=>{
  const {h,a,b,r}=await setup();await begin(h,r);await call('chat',{...a,text:r.word});const absent=r.players[2];absent.connectedOnce=true;absent.lastSeen=Date.now()-6000;tick();assert.equal(r.phase,'reveal');assert.equal(r.players.length,2);
  await call('leave',a);r.deadline=Date.now()-1;tick();assert.equal(r.phase,'finished');assert.match(r.finishReason,/Not enough/);
 });
 await t.test('schedule completes, standings include departures, settings change in lobby only',async()=>{
  const {h,a,b,r}=await setup();await call('leave',b);await begin(h,r);await call('chat',{...a,text:r.word});r.deadline=Date.now()-1;tick();assert.equal(r.drawer,r.players[1].id);
  await call('choose',{...a,word:r.choices[0]});r.players[0].lastChat=0;await call('chat',{...h,text:r.word});r.deadline=Date.now()-1;tick();assert.equal(r.phase,'finished');assert.equal(snapshot(r,r.players[0]).standings.length,2);
  assert.equal((await call('start',h)).status,400);await call('rematch',h);assert.equal(r.phase,'lobby');assert.equal((await call('settings',{...a,rounds:5})).status,400);
  await call('settings',{...h,rounds:5,duration:90,words:['moon','sun','earth']});assert.equal(r.rounds,5);assert.equal(r.duration,90);assert.deepEqual(r.words,['moon','sun','earth']);await call('start',h);assert.ok(r.players.every(p=>p.score===0));
 });
 await t.test('choosing artist leaves without stalling, short word never fully revealed',async()=>{
  const {h,r}=await setup();await call('start',h);const original=r.drawer;await call('leave',h);assert.equal(r.phase,'choose');assert.notEqual(r.drawer,original);
  assert.equal(wordHint('a',[],60000,60000),'_');
 });
 await t.test('SSE reconnect snapshot and static assets work',async()=>{
  const h=await call('create',{name:'Reconnect'});const controller=new AbortController();const res=await fetch(`${base}/events?room=${h.room}&token=${h.token}`,{signal:controller.signal});assert.equal(res.status,200);const reader=res.body.getReader();const first=await reader.read();assert.ok(new TextDecoder().decode(first.value).includes('event: state'));controller.abort();assert.equal((await call('resume',h)).status,200);
  for(const route of ['/','/app.js','/style.css','/rules.mjs'])assert.equal((await fetch(base+route)).status,200);
 });
 }finally{rooms.clear();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
