import {test} from 'node:test';
import assert from 'node:assert/strict';
import {server,rooms,normalize} from './server.mjs';
import {guessPoints,artistPoints,emojiAvatar} from './rules.mjs';
test('scoring rewards completion, normalizes time and audience, and bounds points',()=>{
 assert.equal(guessPoints(60000,60000),500);
 assert.equal(guessPoints(30000,60000),400);
 assert.equal(guessPoints(60000,120000),400);
 assert.equal(guessPoints(0,60000),300);
 assert.equal(guessPoints(-100,60000),300);
 assert.equal(guessPoints(90000,60000),500);
 assert.equal(guessPoints(30100,60000),guessPoints(30000,60000));
 for(let t=0;t<60000;t+=100)assert.ok(guessPoints(t,60000)<=guessPoints(t+100,60000));
 assert.equal(artistPoints(1,2),500);assert.equal(artistPoints(5,10),500);
 assert.equal(artistPoints(3,3),1000);assert.equal(artistPoints(0,3),0);
});
test('avatars accept complete emoji graphemes and reject plain text',()=>{
 for(const emoji of ['🙂','👩🏽‍🚀','🇺🇦','1️⃣','👨‍👩‍👧‍👦','🏳️‍🌈'])assert.equal(emojiAvatar(emoji),emoji);
 for(const invalid of ['hi','ab🙂','🙂🙂','<script>',''])assert.throws(()=>emojiAvatar(invalid));
});
test('complete two-player game flow and permission boundaries',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 const call=async(action,data={})=>{const res=await fetch(base+'/api',{method:'POST',body:JSON.stringify({action,...data})});return{status:res.status,...await res.json()};};
 try{
 const host=await call('create',{name:'Artist',rounds:1,duration:60,words:['apple','banana','cactus']});assert.equal(host.status,200);
 const guest=await call('join',{name:'Guesser',room:host.room});assert.equal(guest.status,200);
 assert.equal((await call('start',guest)).status,400);assert.equal((await call('start',host)).status,200);
 const room=rooms.get(host.room);assert.equal(room.phase,'choose');const word=room.choices[0];
 assert.equal((await call('choose',{...guest,word})).status,400);assert.equal((await call('choose',{...host,word})).status,200);
 const controller=new AbortController();const stream=await fetch(`${base}/events?room=${guest.room}&token=${guest.token}`,{signal:controller.signal});const reader=stream.body.getReader();let received='';while(!received.includes('event: state'))received+=new TextDecoder().decode((await reader.read()).value);const payload=received.split('event: state\ndata: ')[1].split('\n')[0];const state=JSON.parse(payload);assert.equal(state.word,null);assert.equal(state.choices.length,0);assert.equal(state.mask,'_'.repeat(word.length));controller.abort();
 const stroke={color:'#283449',size:9,points:[{x:20,y:30},{x:50,y:70}]};assert.equal((await call('stroke',{...guest,stroke})).status,400);assert.equal((await call('stroke',{...host,stroke})).status,200);assert.equal(room.strokes.length,1);
 await call('undo',host);assert.equal(room.strokes.length,0);
 assert.equal((await call('chat',{...guest,text:word.toUpperCase()})).status,200);assert.equal(room.phase,'reveal');assert.ok(room.players[1].score>=100);assert.equal(room.players[0].score,1000);
 room.deadline=Date.now()-1;await new Promise(r=>setTimeout(r,1100));assert.equal(room.phase,'choose');assert.equal(room.drawer,room.players[1].id);
 await call('choose',{...guest,word:room.choices[0]});await call('chat',{...host,text:room.word});assert.equal(room.phase,'reveal');room.deadline=Date.now()-1;await new Promise(r=>setTimeout(r,1100));assert.equal(room.phase,'finished');
 assert.equal(normalize('Hot-air balloon!'),'hotairballoon');assert.equal((await fetch(base+'/')).status,200);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));rooms.clear();}
});
test('three-player chat isolation, audience scoring, deadlines, and avatar updates',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 const call=async(action,data={})=>{const res=await fetch(base+'/api',{method:'POST',body:JSON.stringify({action,...data})});return{status:res.status,...await res.json()};};
 try{
  const host=await call('create',{name:'Host',avatar:'👩🏽‍🚀',rounds:1,duration:60});
  const a=await call('join',{name:'A',avatar:'🇺🇦',room:host.room});const b=await call('join',{name:'B',room:host.room});
  const r=rooms.get(host.room),events=r.players.map(()=>[]);
  r.players.forEach((p,i)=>p.streams.add({write:chunk=>{const [type,data]=chunk.split('\ndata: ');if(data)events[i].push({type:type.slice(7),data:JSON.parse(data)});}}));
  await call('start',host);await call('choose',{...host,word:r.choices[0]});
  const clear=()=>events.forEach(e=>e.length=0);const messages=i=>events[i].filter(e=>e.type==='chat');
  clear();await call('chat',{...host,text:'Secret artist chat'});assert.equal(messages(0).length,1);assert.equal(messages(1).length,0);assert.equal(messages(2).length,0);
  clear();await call('chat',{...a,text:'wrong guess'});assert.equal(messages(0).length,0);assert.equal(messages(1).length,1);assert.equal(messages(2).length,1);
  r.players[1].lastChat=0;await call('chat',{...a,text:r.word});assert.equal(r.players[0].score,500);assert.equal(r.phase,'draw');
  assert.equal(events[1].findLast(e=>e.type==='state').data.word,r.word);assert.equal(events[2].findLast(e=>e.type==='state').data.word,null);
  clear();r.players[1].lastChat=0;await call('chat',{...a,text:`The answer was ${r.word}`});assert.equal(messages(0).length,1);assert.equal(messages(1).length,1);assert.equal(messages(2).length,0);
  assert.equal(messages(0)[0].data.channel,'solved');
  const previous=r.players[1].score;r.players[1].lastChat=0;await call('chat',{...a,text:r.word});assert.equal(r.players[1].score,previous);
  assert.equal((await call('avatar',{...a,avatar:'🏳️‍🌈'})).status,200);assert.equal(r.players[1].avatar,'🏳️‍🌈');assert.equal((await call('avatar',{...a,avatar:'not an emoji'})).status,400);
  r.deadline=Date.now()-1;await call('chat',{...b,text:r.word});assert.equal(r.players[2].score,0);assert.equal(r.phase,'reveal');assert.equal(r.players[0].score,500);
  clear();r.players[0].lastChat=0;await call('chat',{...host,text:'Everyone together again'});assert.ok(events.every((_,i)=>messages(i).length===1));
 }finally{rooms.clear();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
