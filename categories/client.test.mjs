import {JSDOM,VirtualConsole} from 'jsdom';
import test from 'node:test';
import express from 'express';
import {readFile} from 'node:fs/promises';
import http from 'node:http';
import assert from 'node:assert/strict';
import {handleRequest,rooms,broadcast} from './server.mjs';
import {tickRoom} from './engine.mjs';
test('three clients complete community Call Outs, recovery, undo and rematches under /categories/', {timeout:20000}, async()=>{
const html=await readFile(new URL('./index.html',import.meta.url),'utf8'),script=await readFile(new URL('./app.js',import.meta.url),'utf8');
const mounted=express();mounted.use('/categories',handleRequest);const server=http.createServer(mounted);await new Promise(done=>server.listen(0,'127.0.0.1',done));
const url=`http://127.0.0.1:${server.address().port}/categories/`,doms=[],streams=[],errors=[];
const wait=async(fn,label)=>{for(let i=0;i<150;i++){if(fn())return;await new Promise(done=>setTimeout(done,20));}throw Error('Timed out: '+label);};
function client(saved){
 const console=new VirtualConsole();console.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(html,{url,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:console});doms.push(dom);const w=dom.window;
 w.__downloads=[];w.Blob=Blob;w.URL.createObjectURL=blob=>{w.__downloads.push({blob});return 'blob:test';};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){w.__downloads.at(-1).filename=this.download;};
 w.fetch=(input,options)=>fetch(new URL(input,url),options);w.AbortSignal=AbortSignal;w.matchMedia=()=>({matches:true});
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.EventSource=class{
  listeners={};controller=new AbortController();
  constructor(path){this.owner=w;streams.push(this);(async()=>{try{const response=await fetch(new URL(path,url),{signal:this.controller.signal});const reader=response.body.getReader();let buffer='';for(;;){const{value,done}=await reader.read();if(done)break;buffer+=new TextDecoder().decode(value);let end;while((end=buffer.indexOf('\n\n'))>=0){const part=buffer.slice(0,end);buffer=buffer.slice(end+2);if(part.startsWith('event: state\n'))this.listeners.state?.({data:part.slice('event: state\ndata: '.length)});}}}catch(e){if(e.name!=='AbortError')errors.push(e.message);}})();}
  addEventListener(type,fn){this.listeners[type]=fn;}
  close(){this.controller.abort();}
 };
 if(saved)w.sessionStorage.setItem('categories.session',saved);
 w.eval(`(async()=>{${script}\n})().catch(e=>window.__error=e.message)`);
 return dom;
}
const q=(dom,s)=>dom.window.document.querySelector(s);
const change=(dom,selector,value)=>{const el=q(dom,selector);if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));};
try{
 let host=client();await wait(()=>q(host,'#entry-form'),'landing');
 q(host,'[data-edit-face]').click();change(host,'#custom-emoji','hello');q(host,'#emoji-form').requestSubmit(q(host,'#use-emoji'));assert.match(q(host,'#emoji-error').textContent,/one emoji/);
 change(host,'#custom-emoji','🧑🏽‍🚀');q(host,'#emoji-form').requestSubmit(q(host,'#use-emoji'));assert.equal(q(host,'#emoji-picker').open,false);assert.equal(q(host,'[data-edit-face] .avatar').textContent,'🧑🏽‍🚀');
 change(host,'#name','Host');q(host,'#entry-form').requestSubmit(q(host,'button[value=create]'));
 await wait(()=>q(host,'#settings-form'),'host lobby');const hostSaved=host.window.sessionStorage.getItem('categories.session'),credentials=JSON.parse(hostSaved);
 assert.equal(q(host,'button[value=start]').disabled,true);assert.equal(q(host,'[name=validation]'),null);assert.equal(q(host,'[name=challenges]'),null);
 async function join(name){const dom=client();await wait(()=>q(dom,'#entry-form'),name+' landing');change(dom,'#name',name);change(dom,'#room-code',credentials.room);q(dom,'#entry-form').requestSubmit(q(dom,'button[value=join]'));await wait(()=>q(dom,'#settings-form'),name+' lobby');return dom;}
 const guest=await join('Friend');let third=await join('Third');await wait(()=>!q(host,'button[value=start]').disabled,'start enabled');assert.equal(q(guest,'fieldset').disabled,true);
 assert.equal(rooms.get(credentials.room).players[0].emoji,'🧑🏽‍🚀');
 q(guest,'[data-edit-face]').click();q(guest,'[data-emoji="🦋"]').click();q(guest,'.emoji-close').click();assert.equal(rooms.get(credentials.room).players[1].emoji,'🐸');
 q(guest,'[data-edit-face]').click();change(guest,'#custom-emoji','🇺🇸');q(guest,'#emoji-form').requestSubmit(q(guest,'#use-emoji'));
 await wait(()=>q(host,'.player-list').textContent.includes('🇺🇸'),'emoji broadcast');assert.equal(guest.window.sessionStorage.getItem('categories.emoji'),'🇺🇸');
 change(host,'[name=rounds]','1');change(host,'[name=seconds]','30');change(host,'[name=category]','animals');change(host,'[name=showAnswers]',false);q(host,'#settings-form').requestSubmit(q(host,'button[value=start]'));
 await wait(()=>q(host,'.reveal-card'),'category reveal');const room=rooms.get(credentials.room);
 assert.equal(q(host,'[data-edit-face]'),null);
 const avatarResponse=await fetch(new URL('./api',url),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...credentials,action:'avatar',emoji:'🐸'})});assert.equal(avatarResponse.status,400);
 const advance=()=>{tickRoom(room,room.deadline);broadcast(room);};
 const send=async(dom,text)=>{await wait(()=>q(dom,'#answer-form'),'answer input');change(dom,'#answer',text);q(dom,'#answer-form').requestSubmit(q(dom,'#answer-form button'));};
 advance();await send(host,'Spaceship');await wait(()=>q(guest,'#callout'),'opponent callout button');assert.equal(q(host,'#callout'),null);assert.match(q(host,'.answer-reveal').textContent,/Spaceship/);
 q(guest,'#callout').click();await wait(()=>q(third,'#confirm-callout'),'third can confirm');assert.equal(q(host,'#confirm-callout'),null);assert.equal(q(guest,'#confirm-callout'),null);assert.match(q(third,'.turn-label').textContent,/Friend/);assert.ok(q(guest,'#cancel-callout'));
 const thirdSaved=third.window.sessionStorage.getItem('categories.session');streams.filter(s=>s.owner===third.window).forEach(s=>s.close());third.window.close();third=client(thirdSaved);await wait(()=>q(third,'#confirm-callout'),'reload during callout');assert.equal(room.players.length,3);
 q(third,'#confirm-callout').click();await wait(()=>room.phase==='calledout'&&q(guest,'.invalid-answer'),'confirmed elimination');assert.equal(room.players[0].alive,false);assert.equal(room.players[1].score,0);
 q(guest,'#cancel-callout').click();await wait(()=>q(guest,'#answer-form'),'undo and next turn');assert.equal(room.players[0].alive,true);assert.equal(room.answers[0].status,'accepted');
 for(const dom of [host,guest,third])assert.ok(!dom.window.document.body.textContent.includes('Spaceship'));
 await send(guest,'SPACESHIP');await wait(()=>q(third,'#answer-form'),'duplicate skips eliminated player');assert.equal(room.players[1].alive,false);
 await send(third,'Another weird answer');await wait(()=>q(host,'#callout'),'two survivors callout');assert.equal(q(guest,'#callout'),null);q(host,'#callout').click();await wait(()=>room.phase==='calledout'&&q(host,'#cancel-callout'),'two-player immediate result');assert.equal(room.players[2].alive,false);assert.equal(room.players[0].score,0);
 advance();await wait(()=>q(host,'.result-board'),'round result');assert.match(q(host,'.result-board h2').textContent,/Host takes it/);assert.equal(room.players[0].score,1);
 advance();await wait(()=>q(host,'#lobby'),'final results');
 await wait(()=>q(guest,'.recap'),'all players get recap');assert.match(q(host,'.recap').textContent,/Spaceship/);assert.match(q(host,'.recap').textContent,/SPACESHIP/);assert.match(q(host,'.recap').textContent,/Repeat/);assert.match(q(host,'.recap').textContent,/Called out/);
 q(guest,'[data-export="csv"]').click();await wait(()=>guest.window.__downloads[0]?.filename,'CSV download');assert.match(guest.window.__downloads[0].filename,/\.csv$/);assert.match(await guest.window.__downloads[0].blob.text(),/SPACESHIP/);
 q(host,'[data-export="json"]').click();await wait(()=>host.window.__downloads[0]?.filename,'JSON download');assert.equal(JSON.parse(await host.window.__downloads[0].blob.text()).rounds[0].answers.length,3);
 q(host,'#lobby').click();await wait(()=>q(host,'#settings-form'),'rematch lobby');
 change(host,'[name=pack]','Custom');assert.equal(q(host,'[name=category]').disabled,true);change(host,'[name=custom]','Inside jokes at lunch');q(host,'#settings-form').requestSubmit(q(host,'button[value=start]'));await wait(()=>q(host,'.reveal-card'),'custom reveal');assert.equal(room.category.name,'Inside jokes at lunch');advance();
 await send(host,'The cafeteria incident');await wait(()=>q(guest,'#callout'),'custom callout');q(guest,'#callout').click();await wait(()=>q(third,'#confirm-callout'),'unconfirmed callout');advance();await wait(()=>q(guest,'#answer-form'),'failed callout continues');assert.equal(room.players[0].alive,true);
 await send(guest,'A surprise answer');await wait(()=>room.phase==='review','regular review');advance();await wait(()=>q(third,'#answer-form'),'uncontested answer continues');advance();await wait(()=>q(host,'#answer-form'),'timeout continues');advance();await wait(()=>q(host,'.result-board'),'timeout round result');advance();await wait(()=>q(host,'#lobby'),'second final');

 q(host,'#lobby').click();await wait(()=>q(host,'#settings-form'),'planner lobby');assert.ok(q(host,'.recap'));
 change(host,'[name=categoryMode]','plan');change(host,'[name=rounds]','2');
 assert.equal(host.window.document.querySelectorAll('[name=roundCategory]').length,2);
 change(host,'#round-category-0','Animals');change(host,'#round-category-1','Anything <friends> say');
 q(host,'#settings-form').requestSubmit(q(host,'button[value=save]'));await wait(()=>room.settings.roundPlan[1]==='Anything <friends> say','saved round plan');
 streams.filter(s=>s.owner===host.window).forEach(s=>s.close());host.window.close();host=client(hostSaved);await wait(()=>q(host,'#round-category-1'),'round plan after refresh');assert.equal(q(host,'#round-category-1').value,'Anything <friends> say');assert.ok(q(host,'.recap'));
 assert.equal(q(host,'[data-edit-face] .avatar').textContent,'🧑🏽‍🚀');
 q(host,'#settings-form').requestSubmit(q(host,'button[value=start]'));await wait(()=>q(host,'.reveal-card'),'planned game');assert.equal(room.category.name,'Animals');assert.equal(q(host,'.recap'),null);
 advance();advance();advance();assert.equal(room.phase,'result');advance();assert.equal(room.category.name,'Anything <friends> say');advance();advance();advance();advance();
 await wait(()=>q(host,'#lobby'),'planned final');assert.equal(host.window.document.querySelectorAll('.recap-round').length,2);assert.match(q(host,'.recap').textContent,/Anything <friends> say/);assert.equal(q(host,'.recap friends'),null);

 assert.deepEqual(errors,[]);for(const dom of doms)assert.equal(dom.window.__error,undefined);

}finally{streams.forEach(s=>s.close());doms.forEach(d=>d.window.close());server.closeAllConnections();server.close();rooms.clear();}


});
