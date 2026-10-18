import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import * as engine from '../public/wavelength/engine.js';

test('homepage controls, custom prompts, local round, and demo',async()=>{
  const html=await fs.readFile(new URL('../public/wavelength/index.html',import.meta.url),'utf8');
  const source=await fs.readFile(new URL('../public/wavelength/app.js',import.meta.url),'utf8');
  const dom=new JSDOM(html,{url:'http://localhost/wavelength/',runScripts:'outside-only'}),w=dom.window;
  Object.assign(w,engine);w.fetch=async()=>({ok:true,json:async()=>[]});w.setInterval=()=>0;w.setTimeout=()=>0;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  try{w.eval(source.replace(/^import[^\n]+\n/,''));const $=s=>w.document.querySelector(s);const click=s=>{assert.ok($(s),`Missing ${s}`);$(s).click();};
    $('#name').value='Alex';$('#name').dispatchEvent(new w.Event('input'));click('#theme');assert.ok(w.document.documentElement.classList.contains('dark'));
    click('#prompts-link');click('#add-prompt');const inputs=w.document.querySelectorAll('#prompt-rows input');inputs[0].value='Sweet';inputs[1].value='Sour';for(const i of inputs)i.dispatchEvent(new w.Event('input'));click('#save-prompts');assert.deepEqual(JSON.parse(w.localStorage.getItem('wl-prompts')),[['Sweet','Sour']]);
    click('[data-value="local"]');$('#maxPlayers').value='2';$('#rounds').value='1';click('#create');click('#start-local');assert.match($('#game').textContent,/Pass to Alex/);click('#ready');$('#clue').value='Coffee';$('#clue-form').dispatchEvent(new w.Event('submit',{cancelable:true}));assert.match($('#game').textContent,/Pass to Player 2/);click('#ready');$('#guess').value='120';$('#guess').dispatchEvent(new w.Event('input'));click('#lock');assert.match($('#game').textContent,/Target:/);click('#next');assert.match($('#game').textContent,/Pass to Player 2/);
    click('#demo');assert.match($('#game').textContent,/fresh cup of coffee/);click('#lock');assert.match($('#game').textContent,/Target: 140/);
  }finally{await new Promise(resolve=>setImmediate(resolve));w.close();}
});
