import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, addPlayer, act, snapshot, schedule, cleanWords, WORDS } from './engine.mjs';
function game(n=2,settings={}){const r=createRoom('ABCDEF');const ps=Array.from({length:n},(_,i)=>addPlayer(r,'Player '+i));Object.assign(r.settings,settings);ps.forEach(p=>act(r,p,{action:'ready'}));act(r,ps[0],{action:'start'});return [r,ps];}
function answer(r,g,a,b){act(r,r.players.find(p=>p.id===g.players[0]),{action:'submit',word:a});act(r,r.players.find(p=>p.id===g.players[1]),{action:'submit',word:b});}
test('large bank, cleanup and unique starting words',()=>{assert.ok(WORDS.length>=2000);assert.deepEqual(cleanWords(' Apple, apple\n\n pear ; two words,42'),['apple','pear']);const [r]=game(8);const words=r.groups.flatMap(g=>g.words);assert.equal(new Set(words).size,8);});
test('round robin covers all edges without repeats and fair byes for 2–8 players',()=>{for(let n=2;n<=8;n++){const ids=Array.from({length:n},(_,i)=>String(i)), seen=new Set(),byes=[];for(const round of schedule(ids)){assert.equal(new Set(round.flat()).size,n);for(const pair of round){if(pair.length===1){byes.push(pair[0]);continue;}const edge=pair.slice().sort().join('-');assert.ok(!seen.has(edge));seen.add(edge);}}assert.equal(seen.size,n*(n-1)/2);if(n%2)assert.equal(new Set(byes).size,n);}});
test('answers hidden until both submit, immutable after submission, normalized exact match',()=>{const[r,ps]=game();act(r,ps[0],{action:'submit',word:' Secretword '});const view=snapshot(r,ps[1]);assert.ok(!JSON.stringify(view).includes('secretword'));assert.equal(view.groups[0].reveal,null);assert.throws(()=>act(r,ps[0],{action:'submit',word:'changed'}));act(r,ps[1],{action:'submit',word:'SECRETWORD'});assert.equal(r.phase,'results');assert.deepEqual(ps.map(p=>p.score),[3,3]);assert.deepEqual(snapshot(r,ps[1]).groups[0].reveal,['secretword','secretword']);});
for(const attempt of [1,2,3])test(`matching attempt ${attempt} earns ${4-attempt}`,()=>{const[r,ps]=game();const g=r.groups[0];for(let i=1;i<attempt;i++){answer(r,g,'moon','water');act(r,ps[0],{action:'continue'});assert.deepEqual(g.words,['moon','water']);}answer(r,g,'tide','tide');assert.equal(g.points,4-attempt);assert.equal(ps[0].score,4-attempt);assert.equal(r.history.length,1);});
test('three misses end with zero, all pairs must finish before next round',()=>{const[r,ps]=game(4);for(const g of r.groups){for(let i=0;i<3;i++){answer(r,g,'moon','water');if(i<2)act(r,r.players.find(p=>p.id===g.players[0]),{action:'continue'});}if(g===r.groups[0])assert.throws(()=>act(r,ps[0],{action:'next'}));}assert.equal(r.phase,'results');assert.ok(ps.every(p=>p.score===0));act(r,ps[0],{action:'next'});assert.equal(r.round,2);});
test('fixed even pairs stay intact; odd final trio rotates byes',()=>{for(const n of [4,5,7]){const[r,ps]=game(n,{mode:'fixed'});const first=r.groups[0].players;const sits=[];for(let round=0;round<3;round++){assert.deepEqual(r.groups[0].players,first);if(n%2)sits.push(ps.find(p=>!r.groups.some(g=>g.players.includes(p.id))).id);for(const g of r.groups)answer(r,g,'tide','tide');act(r,ps[0],{action:'next'});}if(n%2)assert.equal(new Set(sits).size,3);}});
test('custom list validation, authorization and game completion',()=>{const r=createRoom('ABCDEF'),p=addPlayer(r,'Host'),q=addPlayer(r,'Guest');assert.throws(()=>act(r,q,{action:'settings',settings:{}}));act(r,p,{action:'settings',settings:{mode:'fixed',source:'custom',rounds:1,custom:'apple'}});for(const a of [p,q])act(r,a,{action:'ready'});assert.throws(()=>act(r,p,{action:'start'}));act(r,p,{action:'settings',settings:{mode:'fixed',source:'custom',rounds:1,custom:'apple, pear'}});for(const a of [p,q])act(r,a,{action:'ready'});act(r,p,{action:'start'});assert.deepEqual(new Set(r.groups[0].words),new Set(['apple','pear']));answer(r,r.groups[0],'fruit','fruit');act(r,p,{action:'next'});assert.equal(r.phase,'finished');act(r,p,{action:'reset'});assert.equal(r.phase,'lobby');assert.equal(p.score,0);});

test('host can reset any phase while preserving room, roster and settings',()=>{
 for(const phase of ['lobby','playing','results','finished']){
  const [r,ps]=game(3,{source:'custom',custom:['moon','water']});r.phase=phase;ps[0].score=5;
  assert.throws(()=>act(r,ps[1],{action:'reset'}),/host/);
  act(r,ps[0],{action:'reset'});
  assert.equal(r.phase,'lobby');assert.equal(r.code,'ABCDEF');assert.equal(r.players.length,3);
  assert.deepEqual(r.settings.custom,['moon','water']);assert.equal(r.round,0);assert.deepEqual(r.groups,[]);
  assert.ok(ps.every(p=>p.score===0&&!p.ready));assert.deepEqual(r.history,[]);
 }
});
test('kick is host-only, removes reconnect credentials, repairs teams and resets active play',()=>{
 const [r,ps]=game(4);const token=ps[1].token;
 assert.throws(()=>act(r,ps[1],{action:'kick',player:ps[2].id}),/host/);
 assert.throws(()=>act(r,ps[0],{action:'kick',player:ps[0].id}),/themselves/);
 assert.throws(()=>act(r,ps[0],{action:'kick',player:'missing'}),/not found/);
 act(r,ps[0],{action:'kick',player:ps[1].id});assert.equal(r.phase,'lobby');
 assert.ok(!r.players.some(p=>p.token===token));assert.ok(!r.settings.order.includes(ps[1].id));
 r.players.forEach(p=>act(r,p,{action:'ready'}));act(r,ps[0],{action:'start'});
 assert.equal(r.groups.length,1);assert.ok(r.groups.every(g=>!g.players.includes(ps[1].id)));
});
test('sit-out can follow every pair and attempt but never unrevealed submissions',()=>{
 const [r,ps]=game(5);const spectator=ps.find(p=>!r.groups.some(g=>g.players.includes(p.id)));
 const g=r.groups[0],a=ps.find(p=>p.id===g.players[0]),b=ps.find(p=>p.id===g.players[1]);
 act(r,a,{action:'submit',word:'privatesubmission'});
 let view=snapshot(r,spectator);assert.equal(view.groups.length,2);assert.equal(view.groups[0].submitted.length,1);
 assert.ok(!JSON.stringify(view).includes('privatesubmission'));
 act(r,b,{action:'submit',word:'water'});view=snapshot(r,spectator);
 assert.deepEqual(view.groups[0].reveal,['privatesubmission','water']);
 act(r,a,{action:'continue'});assert.equal(snapshot(r,spectator).groups[0].attempts.length,1);
 assert.throws(()=>act(r,spectator,{action:'submit',word:'cheat'}));
});
