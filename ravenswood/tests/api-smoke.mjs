import assert from 'node:assert/strict';
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:5173';
const cookies=new Map();
async function post(who,data){const r=await fetch(origin+'/botc/api/game',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(cookies.has(who)?{Cookie:cookies.get(who)}:{})},body:JSON.stringify(data)});const c=r.headers.get('set-cookie');if(c)cookies.set(who,c.split(';')[0]);const body=await r.json();return {status:r.status,body};}
const created=await post(0,{type:'create',name:'API Host'});assert.equal(created.status,200,JSON.stringify(created.body));const code=created.body.code;
const joins=await Promise.all([1,2,3,4,5,6].map(i=>post(i,{type:'join',code,name:`API Player ${i}`})));joins.forEach(r=>assert.equal(r.status,200,JSON.stringify(r.body)));
const forbidden=await post(1,{type:'start',code});assert.equal(forbidden.status,400);
const started=await post(0,{type:'start',code});assert.equal(started.status,200);
let states=[];for(let rounds=0;rounds<20;rounds++){
 states=await Promise.all(Array.from({length:7},async(_,i)=>{const r=await fetch(origin+`/botc/api/game?code=${code}`,{headers:{Cookie:cookies.get(i)}});assert.equal(r.status,200);return r.json();}));
 states.forEach(v=>v.players.forEach(p=>{assert(!('role' in p));assert(!('session' in p));}));
 if(states[0].phase==='day')break;
 const i=states.findIndex(v=>v.pending);assert(i>=0);const q=states[i].pending;const targets=states[i].players.filter(p=>!q.notSelf||p.id!==states[i].me.id).slice(0,q.count).map(p=>p.id);
 const r=await post(i,{type:'night',code,key:q.key,targets});assert.equal(r.status,200);
}
assert.equal(states[0].phase,'day');
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
console.log('PASS: 7 independent sessions, concurrent joins, host permissions, night-to-day flow, private views, whispers, group chats, kicking, anonymous denial.');
