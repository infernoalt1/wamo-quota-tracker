import {createGame,addPlayer,act,snapshot,isPsychic,guessers,points,tick} from './engine.js';
import {gameMarkup,updateOwnMarker} from './game-ui.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const storage={get(k,f=null){try{return JSON.parse(localStorage.getItem('wl-'+k))??f;}catch{return f;}},set(k,v){try{localStorage.setItem('wl-'+k,JSON.stringify(v));}catch{}}};
let options={connection:'online',visibility:'private',source:'builtin',mode:'classic',input:'dial',guesserTimer:0},session=null,local=null,view=null,localId=null,ready=false,demo=false,last='',polling=false,guess=90,sound=storage.get('sound',true),custom=storage.get('prompts',[]),toastTimer;
$('#name').value=storage.get('name','');if(storage.get('dark',false))document.documentElement.classList.add('dark');
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4500);}
function beep(){if(!sound)return;try{const context=new AudioContext(),o=context.createOscillator(),gain=context.createGain();o.connect(gain);gain.connect(context.destination);gain.gain.setValueAtTime(.05,context.currentTime);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+.2);o.frequency.value=620;o.start();o.stop(context.currentTime+.2);o.onended=()=>context.close();}catch{}}
function modal(title,html){$('#modal-title').textContent=title;$('#modal-body').innerHTML=html;if(!$('#modal').open)$('#modal').showModal();}
$('#close-modal').onclick=()=>$('#modal').close();
$('#theme').onclick=()=>{document.documentElement.classList.toggle('dark');storage.set('dark',document.documentElement.classList.contains('dark'));$('#theme').textContent=document.documentElement.classList.contains('dark')?'☀️':'🌙';};
$('#sound').textContent=sound?'🔊':'🔇';$('#sound').onclick=()=>{sound=!sound;storage.set('sound',sound);$('#sound').textContent=sound?'🔊':'🔇';beep();};
$('#name').oninput=()=>{storage.set('name',$('#name').value);updateJoin();};
function updateJoin(){const code=$('#code').value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);$('#code').value=code;$$('#code-boxes span').forEach((el,i)=>{el.textContent=code[i]||'';el.classList.toggle('active',i===code.length);});$('#join').disabled=code.length!==6||!$('#name').value.trim();}
$('#code').oninput=updateJoin;$('#code').onkeydown=e=>{if(e.key==='Enter'&&!$('#join').disabled)$('#join').click();};updateJoin();
$$('[data-step]').forEach(b=>b.onclick=()=>{const [key,delta]=b.dataset.step.split(':'),el=$('#'+key);el.value=Math.min(+el.max,Math.max(+el.min,+el.value+ +delta));});
function choiceHandlers(root=document){root.querySelectorAll('.choice').forEach(group=>group.querySelectorAll('button').forEach(b=>b.onclick=()=>{options[group.dataset.option]=b.dataset.value;group.querySelectorAll('button').forEach(c=>{c.classList.toggle('selected',c===b);c.setAttribute('aria-pressed',String(c===b));});$('#visibility').hidden=options.connection==='local';$('#create').textContent=options.connection==='local'?'Start Local Game':'Create Game';$('#player-label').textContent=options.connection==='local'?'PLAYERS':'MAX PLAYERS';$('#connection-hint').textContent=options.connection==='local'?'Pass and play on a single device.':'Everyone plays on their own device.';$('#visibility-hint').textContent=options.visibility==='public'?'Anyone can find and join your game.':'Only players with the code can join.';$('#prompt-hint').textContent=options.source==='custom'?'Use your saved prompts. Add them in Advanced Settings.':'Play with a collection of built-in spectrum prompts.';}));}choiceHandlers();
function getConfig(){return {...options,rounds:+$('#rounds').value,maxPlayers:+$('#maxPlayers').value,custom:options.source==='custom'?custom:[]};}

$('#advanced').onclick=()=>{
  const choices=(key,items)=>'<div class="choice" data-option="'+key+'">'+items.map(([value,label])=>'<button data-value="'+value+'" class="'+(String(options[key])===String(value)?'selected':'')+'">'+label+'</button>').join('')+'</div>';
  modal('Advanced Settings', '<div class="stack compact"><div class="row"><div><span class="label">CUSTOM PROMPTS</span><p>'+custom.length+' saved prompts</p></div><button class="mini" id="edit-prompts">Edit</button></div><div><span class="label">GAME MODE</span>'+choices('mode',[['classic','One Psychic'],['reverse','One Guesser'],['teams','Teams']])+'<p>One Psychic gives a clue to everyone. One Guesser receives clues from everyone. Teams alternate turns (4+ players).</p></div><div><span class="label">INPUT MODE</span>'+choices('input',[['dial','Dial'],['number','Numbers']])+'</div><div><span class="label">GUESSER TIME LIMIT</span>'+choices('guesserTimer',[0,15,30,45,60,90].map(n=>[n,n?n+" seconds":"Off"]))+'<p>The timer starts after the clue is submitted. When time runs out, each guesser’s current marker locks in automatically. The psychic has unlimited time.</p><p>In local play, each guesser gets their own timer after tapping Ready.</p></div></div>');
  choiceHandlers($('#modal'));$('#edit-prompts').onclick=editPrompts;
};
function editPrompts(){let draft=custom.map(p=>[...p]);function draw(){modal('Custom Prompts',`<p>Create your own spectrum prompts. Saved prompts persist in your browser and can be used in games.</p><div id="prompt-rows">${draft.map((p,i)=>`<div class="prompt-row"><input type="text" aria-label="Left label ${i+1}" maxlength="50" value="${escape(p[0])}" data-i="${i}" data-side="0" placeholder="e.g. Overrated"><input type="text" aria-label="Right label ${i+1}" maxlength="50" value="${escape(p[1])}" data-i="${i}" data-side="1" placeholder="e.g. Underrated"><button data-remove="${i}" aria-label="Remove prompt">×</button></div>`).join('')||'<p>No custom prompts yet. Click + New Prompt to add one.</p>'}</div><div class="row"><button id="add-prompt" class="mini">+ New Prompt</button><button id="save-prompts" class="mini green">Save Prompts</button></div>`);$$('#prompt-rows input').forEach(el=>el.oninput=()=>draft[+el.dataset.i][+el.dataset.side]=el.value);$$('[data-remove]').forEach(el=>el.onclick=()=>{draft.splice(+el.dataset.remove,1);draw();});$('#add-prompt').onclick=()=>{if(draft.length<100){draft.push(['','']);draw();}};$('#save-prompts').onclick=()=>{custom=draft.filter(p=>p.every(s=>s.trim())).map(p=>p.map(s=>s.trim()));storage.set('prompts',custom);$('#modal').close();toast('Prompts saved!');};}draw();}
$('#prompts-link').onclick=editPrompts;
function rules(){modal('How to Play',`<div class="rules"><h3>1. Give a clue</h3><p>The psychic sees a hidden target between two opposite ideas. Give a clue that falls at that position. Keep the target secret!</p><h3>2. Guess the vibe</h3><p>Everyone else discusses the clue and moves their dial to the matching position. Lock in your guess when ready.</p><h3>3. Reveal and score</h3><p>Within 5° earns 5 points; within 15° earns 3; within 25° earns 1. Outside those bands earns 0. Each player gets a turn as psychic each round.</p><h3>Three ways to play</h3><p>One Psychic: one person gives a clue, everyone else guesses. One Guesser: everyone sees the same target and gives a clue to one guesser. Teams: players alternate between two teams; only the psychic's teammates guess.</p><h3>Local play</h3><p>Select In Person and enter player names. Pass the device to the named player before revealing their screen. Online players each use their own device.</p><h3>Tips</h3><p>Use clues your friends know. A target near “Hot” might be “lava”; nearer the middle, “bathwater.” Avoid giving numbers or saying the position directly.</p></div>`);}
$('#help').onclick=rules;$$('.rules-link').forEach(b=>b.onclick=rules);$('#faq').onclick=()=>modal('Frequently Asked Questions','<h3>How many players?</h3><p>2–12 players. Teams requires at least 4.</p><h3>Do I need an account?</h3><p>No. Enter a nickname, create a room, and share the six-character code.</p><h3>Can I play on one device?</h3><p>Yes! Choose In Person. Each player takes a private turn on the same device.</p><h3>Where are rooms saved?</h3><p>Rooms live on this server and expire after six hours of inactivity or a server restart. Custom prompts and local scores are stored in this browser.</p>');
async function api(path,body){const response=await fetch('/wavelength/api'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.token}:{})},...(body?{body:JSON.stringify(body)}:{})});let data;try{data=await response.json();}catch{throw Error('Game server unavailable. Please try again.');}if(!response.ok)throw Error(data.error||'Request failed.');if(data.serverNow)serverOffset=data.serverNow-Date.now();return data;}
async function refresh(){try{const rooms=await api('/rooms');$('#public-games').className=rooms.length?'':'empty';$('#public-games').innerHTML=rooms.length?rooms.map(r=>`<div class="row room-entry"><div><strong class="blue-text">${escape(r.code)}</strong><p class="hint">Host: ${escape(r.host)} · ${r.players}/${r.max} players</p></div><button class="mini" data-join="${escape(r.code)}">Join</button></div>`).join(''):'No public games right now. Create one!';$$('[data-join]').forEach(b=>b.onclick=()=>join(b.dataset.join));}catch{$('#public-games').textContent='Cannot reach the game server. Local play is still available.';}}
$('#refresh').onclick=refresh;
function saveSession(){try{if(session)sessionStorage.setItem('wl-session',JSON.stringify(session));else sessionStorage.removeItem('wl-session');}catch{}}
async function enter(data){session={code:data.code,token:data.token};saveSession();local=null;demo=false;ready=true;view=null;last="";show(data.game);}
async function join(code){if(!$('#name').value.trim())return toast('Enter your name first.');try{await enter(await api('/rooms/'+code+'/join',{name:$('#name').value}));}catch(e){toast(e.message);}}
$('#join').onclick=()=>join($('#code').value);
$('#create').onclick=async()=>{if(!$('#name').value.trim())return toast('Enter your name first.');const c=getConfig();if(options.source==='custom'&&!custom.length){editPrompts();return;}if(options.connection==='local'){modal('Who’s playing?',`<p>Enter a name for each player. Pass the device when prompted.</p><div class="stack compact">${Array.from({length:Math.max(2,Math.min(12,c.maxPlayers))},(_,i)=>`<input type="text" class="local-name" maxlength="16" aria-label="Player ${i+1}" value="${escape(i===0?$('#name').value:'Player '+(i+1))}">`).join('')}<button id="start-local" class="action coral">Start Game</button></div>`);$('#start-local').onclick=()=>{try{local=createGame(c);$$('.local-name').forEach((n,i)=>addPlayer(local,String(i),n.value));act(local,'0',{action:'start'});session=null;saveSession();demo=false;view=null;last='';$('#modal').close();chooseLocal();}catch(e){toast(e.message);}};return;}$('#create').disabled=true;try{await enter(await api('/rooms',{name:$('#name').value,config:c}));}catch(e){toast(e.message);}finally{$('#create').disabled=false;}};
function chooseLocal(){if(local.phase==='clue')localId=local.players.find(p=>isPsychic(local,p.id)&&!local.clues[p.id])?.id;else if(local.phase==='guess')localId=guessers(local).find(p=>local.guesses[p.id]===undefined)?.id;else localId='0';ready=['result','finished'].includes(local.phase);guess=90;show(snapshot(local,localId));}

let dragActive=false,aimTimer=null,serverOffset=0;
function show(g){
  if(view&&g.you===view.you&&g.revision<view.revision)return;
  if(!view||g.turn!==view.turn||g.you!==view.you||g.phase!==view.phase)guess=g.drafts?.[g.you]??90;
  view=g;document.body.classList.add('in-game');$('#home').hidden=true;$('#game').hidden=false;
  const serial=JSON.stringify(g)+ready;if(last===serial||dragActive)return;last=serial;renderGame();
}
function updateTimer(){
  const el=$('#timer');if(!el||!view)return;
  const deadlines=Object.values(view.deadlines??{}),deadline=view.deadlines?.[view.you]??(deadlines.length?Math.max(...deadlines):0);
  if(!deadline){el.hidden=true;return;}el.hidden=false;
  const remaining=Math.max(0,Math.ceil((deadline-Date.now()-(local?0:serverOffset))/1000));
  el.classList.toggle('time-low',remaining<=10);el.textContent=remaining?remaining+'s to guess':'Time’s up — revealing…';
}
function scheduleAim(){
  if(local){try{act(local,localId,{action:'aim',value:guess});}catch{}return;}
  if(aimTimer!==null)return;const turn=view.turn,code=session?.code;
  aimTimer=setTimeout(async()=>{aimTimer=null;if(session?.code!==code||view?.turn!==turn||view?.phase!=='guess')return;try{const result=await api('/rooms/'+code+'/action',{action:'aim',value:guess,turn});if(session?.code===code)show(result.game);}catch{}},250);
}
function renderGame(){
  const g=view;
  const saved={clue:$('#clue')?.value,chat:$('#chat-input')?.value,focus:document.activeElement?.id,start:document.activeElement?.selectionStart,end:document.activeElement?.selectionEnd};
  const messages=$('#chat-messages'),atBottom=!messages||messages.scrollHeight-messages.scrollTop-messages.clientHeight<40,scroll=messages?.scrollTop??0;
  $('#game').innerHTML=gameMarkup(g,{code:session?.code,local:!!local,demo,ready,guess});
  if($('#clue')&&saved.clue!==undefined)$('#clue').value=saved.clue;
  if($('#chat-input')&&saved.chat!==undefined)$('#chat-input').value=saved.chat;
  const focused=saved.focus?document.getElementById(saved.focus):null;
  if(focused){focused.focus({preventScroll:true});if(saved.start!=null&&typeof focused.setSelectionRange==='function')focused.setSelectionRange(saved.start,saved.end);}
  $('#chat-messages').scrollTop=atBottom?$('#chat-messages').scrollHeight:scroll;
  $('#leave').onclick=()=>{modal('Leave game?', '<p>Leaving a local game ends it. Online games continue for the other players.</p><button class="action coral" id="confirm-leave">Leave Game</button>');$('#confirm-leave').onclick=()=>{clearTimeout(aimTimer);aimTimer=null;session=null;saveSession();local=null;view=null;last='';document.body.classList.remove('in-game');$('#game').hidden=true;$('#home').hidden=false;$('#modal').close();refresh();};};
  if($('#copy'))$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(location.origin+'/wavelength/?room='+session.code);toast('Invite copied!');}catch{toast('Room code: '+session.code);}};
  for(const action of ['start','next','restart'])if($('#'+action))$('#'+action).onclick=()=>send({action});
  if($('#ready'))$('#ready').onclick=()=>{ready=true;if(local.phase==='guess')act(local,localId,{action:'ready'});show(snapshot(local,localId));};
  if($('#clue-form')){
    const updateClue=()=>{$('#clue-count').textContent=$('#clue').value.length+'/150';$('#submit-clue').disabled=!$('#clue').value.trim();};
    $('#clue').oninput=updateClue;updateClue();
    $('#clue-form').onsubmit=async event=>{event.preventDefault();$('#submit-clue').disabled=true;const ok=await send({action:'clue',clue:$('#clue').value});if(!ok&&$('#clue'))updateClue();};
  }
  const chatInput=$('#chat-input'),chatSend=$('#chat-send');
  chatInput.oninput=()=>chatSend.disabled=!chatInput.value.trim()||chatInput.disabled;chatInput.oninput();
  $('#chat-form').onsubmit=async event=>{event.preventDefault();const text=$('#chat-input').value;if(!text.trim())return;$('#chat-send').disabled=true;const ok=await send({action:'chat',text});if(ok&&$('#chat-input')?.value===text)$('#chat-input').value='';if($('#chat-input'))$('#chat-input').oninput();};
  if($('#guess')){
    const update=v=>{const step=g.config.input==='number'?9:1;guess=Math.max(0,Math.min(180,Math.round(v/step)*step));$('#guess').value=guess;$('#guess').setAttribute('aria-valuetext',Math.round(guess/180*100)+'% toward '+g.prompt[1]);updateOwnMarker($('#game'),guess);if($('#guess-value'))$('#guess-value').textContent=Math.round(guess/9);scheduleAim();};
    $('#guess').oninput=event=>update(+event.target.value);
    const el=$('#dial'),move=event=>{const r=el.querySelector('svg').getBoundingClientRect(),x=(event.clientX-r.left)/r.width*600-300,y=Math.max(0,280-(event.clientY-r.top)/r.height*350);update(Math.atan2(x,y)*180/Math.PI+90);};
    el.onpointerdown=event=>{dragActive=true;el.setPointerCapture(event.pointerId);move(event);};
    el.onpointermove=event=>{if(el.hasPointerCapture(event.pointerId))move(event);};
    el.onpointerup=el.onpointercancel=()=>{dragActive=false;last='';show(view);};
    $('#lock').onclick=()=>{clearTimeout(aimTimer);aimTimer=null;$('#lock').disabled=true;send({action:'guess',value:guess,turn:g.turn}).then(ok=>{if(!ok&&$('#lock'))$('#lock').disabled=false;});};
  }
  updateTimer();
}
async function send(message){
  try{
    if(local){
      const oldPhase=local.phase;act(local,['next','start','restart'].includes(message.action)?'0':localId,message);
      if(local.phase==='finished'&&oldPhase!=='finished'){const stats=storage.get('stats',{games:0,score:0});stats.games++;stats.score+=local.score;storage.set('stats',stats);}
      if(message.action==='chat'){show(snapshot(local,localId));return true;}
      if(message.action==='restart')act(local,'0',{action:'start'});
      if(demo&&local.phase==='clue'){local.prompt=['Cold','Hot'];local.target=140;const psychic=local.players.find(p=>isPsychic(local,p.id));act(local,psychic.id,{action:'clue',clue:'A fresh cup of coffee'});}
      chooseLocal();if(demo){ready=true;show(view);}
    }else{
      const code=session.code,result=await api('/rooms/'+code+'/action',message);if(session?.code===code)show(result.game);
    }
    if(message.action!=='chat')beep();return true;
  }catch(error){toast(error.message);if(local&&view?.phase!==local.phase)chooseLocal();return false;}
}
setInterval(()=>{if(local&&tick(local)){chooseLocal();if(demo){ready=true;show(view);}beep();}updateTimer();},200);
$('#demo').onclick=()=>{session=null;saveSession();local=createGame({rounds:1,maxPlayers:2});addPlayer(local,'0','Psychic');addPlayer(local,'1','You');act(local,'0',{action:'start'});local.target=140;local.prompt=['Cold','Hot'];act(local,'0',{action:'clue',clue:'A fresh cup of coffee'});demo=true;view=null;last='';chooseLocal();ready=true;show(view);};
async function poll(){if(!session||polling)return;polling=true;try{const code=session.code;const result=await api('/rooms/'+code);if(session?.code===code)show(result.game);}catch(e){toast(e.message);}finally{polling=false;}}
try{session=JSON.parse(sessionStorage.getItem('wl-session'));}catch{}
const room=new URL(location.href).searchParams.get('room');if(room){$('#code').value=room;updateJoin();}
if(session)poll();refresh();setInterval(()=>{if(session)poll();else if(!local)refresh();},2000);
