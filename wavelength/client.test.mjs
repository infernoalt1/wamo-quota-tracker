import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import * as engine from '../public/wavelength/engine.js';
import * as ui from '../public/wavelength/game-ui.js';

test('homepage controls, custom prompts, local round, and demo',async()=>{
  const html=await fs.readFile(new URL('../public/wavelength/index.html',import.meta.url),'utf8');
  const source=await fs.readFile(new URL('../public/wavelength/app.js',import.meta.url),'utf8');
  const dom=new JSDOM(html,{url:'http://localhost/wavelength/',runScripts:'outside-only'}),w=dom.window;
  Object.assign(w,engine,ui);w.fetch=async()=>({ok:true,json:async()=>[]});w.setInterval=()=>0;w.setTimeout=()=>0;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  try{w.eval(source.replace(/^import[^\n]+\n/gm,''));const $=s=>w.document.querySelector(s);const click=s=>{assert.ok($(s),`Missing ${s}`);$(s).click();};
    $('#name').value='Alex';$('#name').dispatchEvent(new w.Event('input'));click('#theme');assert.ok(w.document.documentElement.classList.contains('dark'));
    click('#prompts-link');click('#add-prompt');const inputs=w.document.querySelectorAll('#prompt-rows input');inputs[0].value='Sweet';inputs[1].value='Sour';for(const i of inputs)i.dispatchEvent(new w.Event('input'));click('#save-prompts');assert.deepEqual(JSON.parse(w.localStorage.getItem('wl-prompts')),[['Sweet','Sour']]);
    click('#advanced');click('[data-option="guesserTimer"] [data-value="30"]');click('#close-modal');
    click('[data-value="local"]');$('#maxPlayers').value='2';$('#rounds').value='1';click('#create');click('#start-local');assert.match($('#game').textContent,/Pass to Alex/);assert.ok($('.chat-panel'));click('#ready');assert.ok($('.target-needle'));assert.equal($('#timer'),null);$('#clue').value='Coffee';$('#clue-form').dispatchEvent(new w.Event('submit',{cancelable:true}));assert.match($('#game').textContent,/Pass to Player 2/);click('#ready');assert.match($('#timer').textContent,/30s/);assert.equal($('.target-needle'),null);$('#guess').value='120';$('#guess').dispatchEvent(new w.Event('input'));assert.ok($('#own-marker'));click('#lock');assert.match($('#game').textContent,/Turn Result/);assert.ok($('.target-needle'));assert.ok($('.guess-marker'));assert.doesNotMatch($('#game').textContent,/120°|Target:/);
    $('#chat-input').value='<b>Hello</b>';$('#chat-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(resolve=>setImmediate(resolve));assert.match($('.chat-message').textContent,/<b>Hello<\/b>/);assert.equal($('.chat-message b'),null);assert.equal($('#chat-input').value,'');
    click('#next');assert.match($('#game').textContent,/Pass to Player 2/);
    click('#demo');assert.match($('#game').textContent,/fresh cup of coffee/);click('#lock');assert.match($('#game').textContent,/Turn Result/);assert.ok($('.target-needle'));
  }finally{await new Promise(resolve=>setImmediate(resolve));w.close();}
});
