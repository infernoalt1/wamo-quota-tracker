import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { WebSocket } from 'ws';
import { setupMedium } from './server.mjs';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { createRoom, addPlayer, snapshot, act } from './engine.mjs';
test('HTTP routes, real remote sessions, private answers and reconnect',async t=>{
 const app=express(),server=http.createServer(app),game=setupMedium(app,server);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port,clients=[];t.after(()=>{clients.forEach(c=>c.ws.terminate());game.close();server.close();});
 assert.equal((await fetch(`http://127.0.0.1:${port}/medium`)).status,200);
 assert.equal((await fetch(`http://127.0.0.1:${port}/medium/engine.mjs`)).status,404);
 async function client(){const ws=new WebSocket(`ws://127.0.0.1:${port}/medium/ws`),messages=[];ws.on('message',d=>messages.push(JSON.parse(d)));await new Promise(r=>ws.once('open',r));const c={ws,messages,send:m=>ws.send(JSON.stringify(m)),async wait(fn){const until=Date.now()+3000;while(Date.now()<until){const found=messages.find(fn);if(found)return found;await new Promise(r=>setTimeout(r,5));}throw Error('Timed out');}};clients.push(c);return c;}
 const a=await client();a.send({action:'create',name:'Alice'});const session=await a.wait(m=>m.type==='session');const b=await client();b.send({action:'join',room:session.room,name:'Bob'});await b.wait(m=>m.type==='session');a.send({action:'ready'});b.send({action:'ready'});await a.wait(m=>m.room?.players?.length===2&&m.room.players.every(p=>p.ready));a.send({action:'start'});await b.wait(m=>m.room?.phase==='playing');a.send({action:'submit',word:'confidential'});const hidden=await b.wait(m=>m.room?.groups?.[0]?.submitted.length===1);assert.ok(!JSON.stringify(hidden).includes('confidential'));b.send({action:'submit',word:'confidential'});const result=await b.wait(m=>m.room?.phase==='results');assert.equal(result.room.players[0].score,3);
 a.ws.close();const c=await client();c.send({action:'resume',room:session.room,token:session.token});const resumed=await c.wait(m=>m.type==='state');assert.equal(resumed.room.me,result.room.host);assert.equal(resumed.room.phase,'results');
});
test('client renders landing, lobby, play, hidden state and results without errors',async()=>{
 const html=await readFile(new URL('./index.html',import.meta.url),'utf8'),js=await readFile(new URL('./app.js',import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'http://localhost/medium/',runScripts:'outside-only'});let socket;class FakeSocket{constructor(){socket=this;this.readyState=1;}send(){}}dom.window.WebSocket=FakeSocket;dom.window.eval(js);const doc=dom.window.document;
 assert.ok(doc.querySelector('#entry-form'));assert.ok(doc.querySelector('#join-form'));
 const r=createRoom('ABCDEF'),p=addPlayer(r,'Alice'),q=addPlayer(r,'<Bob>');const update=()=>socket.onmessage({data:JSON.stringify({type:'state',room:snapshot(r,p)})});update();assert.equal(doc.querySelectorAll('.player').length,2);assert.ok(doc.querySelector('#settings-form'));assert.ok(doc.body.textContent.includes('<Bob>'));assert.equal(doc.querySelector('Bob'),null);
 for(const a of [p,q])act(r,a,{action:'ready'});act(r,p,{action:'start'});update();assert.equal(doc.querySelectorAll('.word-card').length,2);assert.ok(doc.querySelector('#answer-form'));
 act(r,q,{action:'submit',word:'hidden'});update();assert.ok(!doc.body.textContent.includes('hidden'));act(r,p,{action:'submit',word:'hidden'});update();assert.ok(doc.body.textContent.includes('Round complete.'));assert.ok(doc.querySelector('#next'));dom.window.close();
});

