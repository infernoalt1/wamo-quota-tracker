import assert from 'node:assert/strict';
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:5173';
const cookies=new Map();
async function post(who,data){const r=await fetch(origin+'/botc/api/game',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(cookies.has(who)?{Cookie:cookies.get(who)}:{})},body:JSON.stringify(data)});const c=r.headers.get('set-cookie');if(c)cookies.set(who,c.split(';')[0]);const body=await r.json();return {status:r.status,body};}
const created=await post(0,{type:'create',name:'API Host'});assert.equal(created.status,200,JSON.stringify(created.body));const code=created.body.code;
const joins=await Promise.all([1,2,3,4,5,6].map(i=>post(i,{type:'join',code,name:`API Player ${i}`})));joins.forEach(r=>assert.equal(r.status,200,JSON.stringify(r.body)));
const forbidden=await post(1,{type:'start',code});assert.equal(forbidden.status,400);
const started=await post(0,{type:'start',code});assert.equal(started.status,200);
let states=[];const nightStart=Date.now();for(let rounds=0;rounds<60;rounds++){
 states=await Promise.all(Array.from({length:7},async(_,i)=>{const r=await fetch(origin+`/botc/api/game?code=${code}`,{headers:{Cookie:cookies.get(i)}});assert.equal(r.status,200);return r.json();}));
 states.forEach(v=>v.players.forEach(p=>{assert(!('role' in p));assert(!('session' in p));}));
 if(states[0].phase==='day')break;
 // Dawn comes 5–15 seconds after the last choice, so a night with nobody left to wake is still night for a while.
 const i=states.findIndex(v=>v.pending);if(i<0){await new Promise(done=>setTimeout(done,500));continue;}const q=states[i].pending;const targets=states[i].players.filter(p=>!q.notSelf||p.id!==states[i].me.id).slice(0,q.count).map(p=>p.id);
 const r=await post(i,{type:'night',code,key:q.key,targets});assert.equal(r.status,200);
}
assert.equal(states[0].phase,'day');assert(Date.now()-nightStart>=4500,'Dawn came too soon.');
const whisper=await post(0,{type:'chat',code,text:'private integration check',to:states[1].me.id});assert.equal(whisper.status,200);
const outsider=await fetch(origin+`/botc/api/game?code=${code}`,{headers:{Cookie:cookies.get(2)}}).then(r=>r.json());assert(!outsider.messages.some(m=>m.text==='private integration check'));
const unauthorized=await fetch(origin+`/botc/api/game?code=${code}`);assert.equal(unauthorized.status,401);
const group=await post(0,{type:'group',code,title:'Plot',members:[states[1].me.id,states[2].me.id]});assert.equal(group.status,200,JSON.stringify(group.body));
const groupId=group.body.groups[0].id;assert.equal((await post(1,{type:'chat',code,text:'group integration check',group:groupId})).status,200);
const member=await fetch(origin+`/botc/api/game?code=${code}`,{headers:{Cookie:cookies.get(2)}}).then(r=>r.json());assert(member.messages.some(m=>m.text==='group integration check'));
const nonMember=await fetch(origin+`/botc/api/game?code=${code}`,{headers:{Cookie:cookies.get(3)}}).then(r=>r.json());assert(!nonMember.messages.some(m=>m.text==='group integration check'));assert.equal(nonMember.groups.length,0);
const lobby=await post(0,{type:'create',name:'Lobby Host'});const lobbyCode=lobby.body.code;const seated=await post(1,{type:'join',code:lobbyCode,name:'Afk'});assert.equal(seated.status,200);
assert.equal((await post(1,{type:'kick',code:lobbyCode,target:lobby.body.me.id})).status,400);
assert.equal((await post(0,{type:'kick',code:lobbyCode,target:seated.body.me.id})).status,200);
const kicked=await fetch(origin+`/botc/api/game?code=${lobbyCode}`,{headers:{Cookie:cookies.get(1)}});assert.equal(kicked.status,400);assert.match((await kicked.json()).error,/Join/);
assert.equal((await post(1,{type:'join',code:lobbyCode,name:'Afk'})).status,200);
const table=who=>fetch(origin+`/botc/api/game?code=${code}`,{headers:{Cookie:cookies.get(who)}}).then(r=>r.json());
// The live stream pokes another player's page as soon as someone acts.
const poked=new Promise((done,fail)=>{
 const c=new AbortController(),timer=setTimeout(()=>{c.abort();fail(Error('No poke within 3 seconds.'));},3000);
 fetch(origin+`/botc/api/game/events?code=${code}`,{headers:{Cookie:cookies.get(3)},signal:c.signal}).then(async r=>{
  assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/event-stream/);
  const reader=r.body.getReader();for(;;){const {value,done:end}=await reader.read();if(end)break;if(new TextDecoder().decode(value).includes('data: 1')){clearTimeout(timer);c.abort();done();return;}}
 }).catch(e=>{if(e.name!=='AbortError')fail(e);});
});
await new Promise(done=>setTimeout(done,300));assert.equal((await post(4,{type:'chat',code,text:'poke check'})).status,200);await poked;
assert.equal((await fetch(origin+`/botc/api/game/events?code=${code}`)).status,401);
// A spectator can join a game in progress, sees no characters or whispers, and cannot talk or take a seat.
const watcher=await post(7,{type:'spectate',code,name:'API Watcher'});assert.equal(watcher.status,200,JSON.stringify(watcher.body));assert(watcher.body.me.spectator);
assert(!watcher.body.messages.some(m=>m.text==='private integration check'));assert(watcher.body.players.every(p=>!('role' in p)));
assert.equal((await post(7,{type:'chat',code,text:'hi'})).status,400);assert.equal((await post(7,{type:'join',code,name:'Late'})).status,400);
// Ending a game early needs a majority; the reveal shows every character and the game log, but never whispers.
assert.equal((await post(0,{type:'rematch',code})).status,400);
const vote=(await post(1,{type:'propose',code,kind:'reveal'})).body.proposal;assert(vote);
for(const i of [2,3,4])if((await table(3)).phase!=='ended')await post(i,{type:'proposal_vote',code,proposal:vote.id,yes:true});
const end=await table(7);
assert.equal(end.phase,'ended');assert(end.called);assert.equal(end.winner,null);assert(end.players.every(p=>p.role));
assert(end.timeline.some(r=>r.kind==='choice'));assert(!JSON.stringify(end.timeline).includes('private integration check'));
console.log('PASS: 7 independent sessions, concurrent joins, host permissions, night-to-day flow, dawn delay, private views, whispers, group chats, live pokes, spectators, table vote, game log, kicking, anonymous denial.');
