import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { createEngine } from './engine.mjs';
import { setupRammerhead } from './server.mjs';
import { publicAddress,resolvePublic } from './egress.mjs';
const sequence=['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowLeft','ArrowRight','ArrowRight'];
const tick=()=>new Promise(r=>setTimeout(r,5));
test('research is default; only the exact sequence unlocks; locking removes the browsing frame',async()=>{
  const html=await readFile(new URL('./index.html',import.meta.url),'utf8'),js=await readFile(new URL('./app.js',import.meta.url),'utf8');
  const dom=new JSDOM(html,{url:'http://localhost:3005/rammerhead',runScripts:'outside-only'}),w=dom.window,d=w.document;
  let calls=0;w.scrollTo=()=>{};w.fetch=async()=>{calls++;return {ok:true,json:async()=>({origin:'http://127.0.0.1:3004'})};};w.eval(js);
  const key=(value,options={})=>d.body.dispatchEvent(new w.KeyboardEvent('keydown',{key:value,bubbles:true,...options}));
  assert.equal(d.querySelector('#browser-shell').hidden,true);assert.equal(calls,0);
  ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight'].forEach(key);await tick();assert.equal(calls,0);
  key('x');sequence.forEach(k=>key(k,{repeat:true}));await tick();assert.equal(calls,0);
  sequence.forEach(k=>key(k));await tick();assert.equal(calls,1);assert.equal(d.querySelector('#research').hidden,true);
  assert.equal(d.querySelector('#proxy-frame').src,'http://127.0.0.1:3004/');d.querySelector('#lock').click();
  assert.equal(d.querySelector('#research').hidden,false);assert.equal(d.querySelector('#proxy-frame').getAttribute('src'),null);
  sequence.forEach(k=>d.querySelector(`[data-direction="${k}"]`).click());await tick();assert.equal(calls,2);
  dom.window.close();
});
test('unlock reports configuration errors and can return to research',async()=>{
  const dom=new JSDOM(await readFile(new URL('./index.html',import.meta.url),'utf8'),{url:'http://localhost/rammerhead',runScripts:'outside-only'}),w=dom.window;
  w.scrollTo=()=>{};w.fetch=async()=>({ok:false,json:async()=>({error:'Configure the proxy hostname.'})});w.eval(await readFile(new URL('./app.js',import.meta.url),'utf8'));
  sequence.forEach(k=>w.document.body.dispatchEvent(new w.KeyboardEvent('keydown',{key:k,bubbles:true})));await tick();
  assert.match(w.document.querySelector('#proxy-status').textContent,/Configure/);assert.equal(w.document.querySelector('#retry').hidden,false);w.document.querySelector('#lock').click();assert.equal(w.document.querySelector('#research').hidden,false);w.close();
});
test('egress blocks private, loopback, metadata, reserved and mapped addresses',async()=>{
  for(const ip of ['127.0.0.1','10.0.0.1','172.16.0.1','192.168.1.1','169.254.169.254','100.64.0.1','0.0.0.0','224.0.0.1','::1','::ffff:127.0.0.1','fc00::1','fe80::1','2001:db8::1'])assert.equal(publicAddress(ip),false,ip);
  assert.equal(publicAddress('1.1.1.1'),true);await assert.rejects(resolvePublic('localhost'));await assert.rejects(resolvePublic('127.0.0.1'));
});
test('real Rammerhead creates isolated sessions, rejects cross-origin creation and revokes sessions',async t=>{
  const engine=await createEngine({listen:true});t.after(()=>engine.close());
  assert.equal((await fetch(engine.origin+'/')).status,200);
  assert.equal((await fetch(engine.origin+'/session',{method:'POST',headers:{origin:'https://other.example'}})).status,403);
  const a=await (await fetch(engine.origin+'/session',{method:'POST',headers:{origin:engine.origin}})).json();
  const b=await (await fetch(engine.origin+'/session',{method:'POST',headers:{origin:engine.origin}})).json();assert.notEqual(a.id,b.id);
  const denied=await fetch(engine.origin+'/'+a.id+'/http://127.0.0.1/',{headers:{accept:'text/html'},signal:AbortSignal.timeout(5000)});assert.equal(denied.status,403);
  await fetch(engine.origin+'/end-session?id='+a.id,{method:'POST',headers:{origin:engine.origin}});assert.equal(engine.store.has(a.id),false);assert.equal(engine.store.has(b.id),true);
  assert.equal((await fetch(engine.origin+'/hammerhead.js')).status,200);
});
test('application serves research and config without exposing backend source',async t=>{
  const app=express(),server=http.createServer(app),service=setupRammerhead(app,server,{env:{RAMMERHEAD_LOCAL_PORT:'0'}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await service.close();server.close();});const base='http://127.0.0.1:'+server.address().port;
  for(const path of ['/rammerhead','/rammerhead/'])assert.match(await (await fetch(base+path)).text(),/Marine Field Notes/);
  assert.equal((await fetch(base+'/rammerhead/engine.mjs')).status,404);
  const config=await (await fetch(base+'/rammerhead/config')).json();assert.notEqual(config.origin,base);assert.equal((await fetch(config.origin+'/')).status,200);
});
test('configured proxy hostname is dispatched separately from application routes',async t=>{
  const app=express(),server=http.createServer(app),service=setupRammerhead(app,server,{env:{RAMMERHEAD_PROXY_ORIGIN:'https://proxy.example.test'}});
  app.get('/private-app-route',(_req,res)=>res.send('application data'));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await service.close();server.close();});
  const base='http://127.0.0.1:'+server.address().port;
  assert.equal(await (await fetch(base+'/private-app-route')).text(),'application data');
  const proxyRequest=path=>new Promise((resolve,reject)=>{http.get(base+path,{headers:{host:'proxy.example.test'}},res=>{let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve(body));}).on('error',reject);});
  assert.match(await proxyRequest('/'),/Rammerhead/);
  assert.notEqual(await proxyRequest('/private-app-route'),'application data');
  const config=await (await fetch(base+'/rammerhead/config')).json();assert.equal(config.origin,'https://proxy.example.test');
});
test('browser opens actual session URLs, rejects unsafe schemes and clears its session',async()=>{
  const dom=new JSDOM(await readFile(new URL('./browser.html',import.meta.url),'utf8'),{url:'http://127.0.0.1:3004/',runScripts:'outside-only'}),w=dom.window,d=w.document,requests=[];
  w.fetch=async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({id:'session123'})};};w.eval(await readFile(new URL('./browser.js',import.meta.url),'utf8'));
  const submit=()=>d.querySelector('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  d.querySelector('#address').value='javascript:alert(1)';submit();await tick();assert.equal(requests.length,0);
  d.querySelector('#address').value='example.com';submit();await tick();assert.equal(requests[0].url,'/session');assert.equal(d.querySelector('#page').src,'http://127.0.0.1:3004/session123/https://example.com/');
  d.querySelector('#new-session').click();assert.equal(requests[1].url,'/end-session?id=session123');assert.equal(d.querySelector('#page').hidden,true);assert.equal(d.querySelector('#page').getAttribute('src'),null);w.close();
});
