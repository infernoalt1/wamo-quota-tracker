import {test} from 'node:test';
import assert from 'node:assert/strict';
import {server,rooms,snapshot,tick} from './server.mjs';
import {guessPoints,artistPoints,emojiAvatar,wordHint} from './rules.mjs';
import {LiveConnection,mergeChat,requestJSON} from './live-connection.mjs';
import words from './words.mjs';

test('uploaded word pack and retained authorized chat',()=>{
 assert.equal(words.length,2312);assert.equal(new Set(words).size,2312);
 assert.ok(words.includes('BMW'));assert.ok(words.includes('AC/DC'));assert.ok(words.includes('William Shakespeare'));assert.ok(!words.includes('word'));
 const privateMessage={id:'private-1',channel:'solved',turn:1,text:'private conversation'};
 const publicMessage={id:'public-1',channel:'guessing',turn:2,text:'new turn'};
 assert.deepEqual(mergeChat([privateMessage],[privateMessage,publicMessage]),[privateMessage,publicMessage]);
});

test('transient network errors recover instead of freezing; silent stream restarts; 410 expires',async()=>{
 class FakeSource{static instances=[];constructor(){this.listeners={};FakeSource.instances.push(this);}addEventListener(t,fn){this.listeners[t]=fn;}close(){this.closed=true;}}
 let failure=true,expired=false,now=0;const statuses=[],received=[];
 const live=new LiveConnection({url:'events',EventSourceClass:FakeSource,clock:()=>now,resume:async()=>{if(failure)throw new TypeError('Failed to fetch');},onStatus:s=>statuses.push(s),onEvent:(t,d)=>received.push([t,d]),onExpired:()=>expired=true});
 try{
  await live.recover();assert.equal(live.closed,false);assert.equal(expired,false);
  failure=false;await live.recover();assert.equal(FakeSource.instances.length,2);
  FakeSource.instances.at(-1).listeners.state({data:'{"phase":"draw"}'});assert.equal(statuses.at(-1),'connected');
  now=13000;await live.checkHealth();assert.equal(FakeSource.instances.length,3);
  FakeSource.instances[0].listeners.state({data:'{"phase":"stale"}'});assert.equal(received.length,1);
  live.resume=async()=>{throw Object.assign(new Error('gone'),{status:410});};await live.recover();assert.equal(expired,true);assert.equal(live.closed,true);
 }finally{live.close();}
});

test('requests carry a deadline and preserve HTTP failure status',async()=>{
 await assert.rejects(()=>requestJSON('api',{},async(_url,options)=>{assert.ok(options.signal instanceof AbortSignal);return{ok:false,status:410,json:async()=>({error:'expired'})};}),e=>e.status===410);
});

test('whole-point formula, time normalization and hints',()=>{
 assert.equal(guessPoints(20000,1,80000),800);
 assert.equal(guessPoints(22000,2,80000),590);
 assert.equal(guessPoints(40000,3,80000),433);
 assert.equal(guessPoints(70000,4,80000),250);
 assert.equal(guessPoints(40000,1,160000),800);
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
  assert.ok(r.players[0].chatHistory.some(m=>m.text==='secret'));
  assert.ok(r.players[1].chatHistory.some(m=>m.text==='secret'));
  assert.ok(!r.players[2].chatHistory.some(m=>m.text==='secret'));
  r.deadline=Date.now()-1;tick();assert.ok(r.players[1].chatHistory.some(m=>m.text==='secret'));
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
  const {h,a,b,r}=await setup();await begin(h,r);await call('chat',{...a,text:r.word});const absent=r.players[2];absent.connectedOnce=true;absent.lastSeen=Date.now()-16000;tick();assert.equal(r.phase,'reveal');assert.equal(r.players.length,2);
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
 await t.test('detached player resumes without losing score; intentional leave stays left',async()=>{
  const {h,a,r}=await setup();const p=r.players[1];p.score=321;p.lastSeen=Date.now()-16000;tick();assert.ok(!r.players.includes(p));
  assert.equal((await call('resume',a)).status,200);assert.ok(r.players.includes(p));assert.equal(p.score,321);
  await call('leave',a);assert.equal((await call('resume',a)).status,410);
 });
 await t.test('batched drawing validates turn and strokes before adding anything',async()=>{
  const {h,r}=await setup();await begin(h,r);const stroke={color:'#283449',size:9,points:[{x:0,y:0},{x:10,y:10}]};
  assert.equal((await call('stroke',{...h,turn:r.turn,strokes:[stroke,stroke]})).status,200);assert.equal(r.strokes.length,2);
  assert.equal((await call('stroke',{...h,turn:r.turn-1,strokes:[stroke]})).status,400);assert.equal(r.strokes.length,2);
  assert.equal((await call('stroke',{...h,turn:r.turn,strokes:[stroke,{...stroke,color:'bad'}]})).status,400);assert.equal(r.strokes.length,2);
 });
 await t.test('SSE reconnect snapshot and static assets work',async()=>{
  const h=await call('create',{name:'Reconnect'});const controller=new AbortController();const res=await fetch(`${base}/events?room=${h.room}&token=${h.token}`,{signal:controller.signal});assert.equal(res.status,200);const reader=res.body.getReader();const first=await reader.read();let output=new TextDecoder().decode(first.value);while(!output.includes('event: state'))output+=new TextDecoder().decode((await reader.read()).value);assert.ok(output.includes('event: state'));controller.abort();assert.equal((await call('resume',h)).status,200);
  for(const route of ['/','/app.js','/style.css','/rules.mjs','/live-connection.mjs'])assert.equal((await fetch(base+route)).status,200);
 });
 }finally{rooms.clear();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
