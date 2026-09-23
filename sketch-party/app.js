import {emojiAvatar} from './rules.mjs?v=3';
const $=s=>document.querySelector(s),canvas=$('#canvas'),ctx=canvas.getContext('2d');
let auth=null,state=null,source=null,current=null,color='#283449',sound=false,overlayKey='',toastTimer,queue=Promise.resolve();
let activeChannel='everyone',activeTurn=null;
const chatHistory=[];
const faces=['🙂','😎','🤠','🤓','🥸','😺','🐸','👽','🐼','🦊','🐙','🐻'];
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500);}
async function api(action,data={}){const response=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...auth,action,...data})});const result=await response.json();if(!response.ok)throw Error(result.error);return result;}
function action(type,data){return api(type,data).catch(e=>toast(e.message));}
function draw(s){if(!s.points.length)return;ctx.strokeStyle=s.color;ctx.fillStyle=s.color;ctx.lineWidth=s.size;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(s.points[0].x,s.points[0].y);for(const p of s.points.slice(1))ctx.lineTo(p.x,p.y);ctx.stroke();if(s.points.length===1){ctx.beginPath();ctx.arc(s.points[0].x,s.points[0].y,s.size/2,0,Math.PI*2);ctx.fill();}}
function reset(strokes=[]){ctx.fillStyle='white';ctx.fillRect(0,0,1000,700);strokes.forEach(draw);}
function appendMessage(m,playSound=false){const div=document.createElement('div');div.className='message '+m.kind;if(m.name){const name=document.createElement('b');name.textContent=m.name+': ';div.append(name);}div.append(document.createTextNode(m.text));$('#messages').append(div);while($('#messages').children.length>250)$('#messages').firstChild.remove();$('#messages').scrollTop=$('#messages').scrollHeight;if(playSound&&sound&&m.kind==='correct'){try{const a=new AudioContext(),o=a.createOscillator(),g=a.createGain();o.connect(g);g.connect(a.destination);o.frequency.value=660;g.gain.value=.08;o.start();o.stop(a.currentTime+.12);o.onended=()=>a.close();}catch{}}}
function refreshChat(){ $('#messages').replaceChildren(); chatHistory.filter(m=>!m.channel||(m.turn===activeTurn&&m.channel===activeChannel)).forEach(m=>appendMessage(m)); }
function message(m){chatHistory.push(m);if(chatHistory.length>250)chatHistory.shift();if(!m.channel||(m.turn===activeTurn&&m.channel===activeChannel))appendMessage(m,true);}
function celebrate(points,artist=false){if(!Number.isFinite(points)||points<=0)return;const el=$('#success');el.hidden=false;el.textContent=artist?`✎ Nice drawing! +${points.toLocaleString()} points`:`✓ You guessed it! +${points} points`;el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop');}
function overlay(html){$('#overlay-content').innerHTML=html;}
function render(s){
  const me=s.players.find(p=>p.id===s.you);
  if(activeTurn!==s.turn||!['draw','reveal'].includes(s.phase)){$('#success').hidden=true;$('#success').textContent='';}
  if(activeChannel!==s.channel||activeTurn!==s.turn){activeChannel=s.channel;activeTurn=s.turn;refreshChat();}
  $('#chat-title').textContent=s.channel==='solved'?'You know the word!':s.channel==='guessing'?'Guesses & chat':'Room chat';
  $('#chat-badge').textContent=s.channel==='solved'?'\u2713 Solved':s.channel==='guessing'?'Guessing':'Everyone';
  $('#chat-hint').textContent=s.channel==='solved'?'Only the artist and correct guessers can see this chat.':s.channel==='guessing'?'Only players still guessing can see this chat.':'Everyone can chat. Private turn messages stay private.';
  $('.chat').classList.toggle('solved-chat',s.channel==='solved');
  $('#guess-input').placeholder=s.channel==='solved'?'Chat with the people who got it...':s.channel==='guessing'?'Type your guess here...':'Message everyone...';
  if(me?.guessed&&['draw','reveal'].includes(s.phase)&&$('#success').hidden)celebrate(me.earned);
  if(s.phase==='reveal'&&s.drawer===s.you&&$('#success').hidden)celebrate(me?.earned,true);
  state=s;$('#round').textContent=s.phase==='lobby'?'WAITING ROOM':`ROUND ${s.round} OF ${s.rounds}`;const drawer=s.players.find(p=>p.id===s.drawer);const mine=s.drawer===s.you;
  $('#turn').textContent=s.phase==='finished'?'That’s a wrap!':s.phase==='lobby'?'Good friends. Great guesses.':mine?'Your turn to draw!':`${drawer?.name||'Someone'} is drawing`;
  $('#word').textContent=s.word||s.mask||(s.phase==='choose'?'Choosing a word…':'Invite your friends');$('#timer').textContent=s.seconds||'—';$('#count').textContent=s.players.length+'/12';$('#roomcode').textContent=s.code;
  $('#word').classList.toggle('status-word',!s.word&&!s.mask);
  $('#word-label').textContent=s.phase==='draw'?(mine?'DRAW THIS':me?.guessed?'YOU GOT IT':'GUESS THIS WORD'):s.phase==='choose'?'GET READY':s.phase==='reveal'?'THE WORD WAS':'DRAW & GUESS';
  $('#timer').classList.toggle('urgent',s.phase==='draw'&&s.seconds<=10);
  document.body.dataset.phase=s.phase;
  $('#players').replaceChildren();const ranked=[...s.players].sort((a,b)=>b.score-a.score);
  s.players.forEach((p,i)=>{const row=document.createElement('div');row.className='player'+(p.guessed?' correct':'')+(p.id===s.drawer?' is-drawing':'');const face=document.createElement('span');face.className='face';face.textContent=p.avatar||faces[i%faces.length];const info=document.createElement('div');info.className='info';const name=document.createElement('strong');name.textContent=p.name+(p.id===s.you?' (you)':'');const score=document.createElement('small');score.textContent=`${p.score} points ${p.id===s.drawer?' • drawing ✎':p.guessed?' • guessed ✓':''}`;info.append(name,score);const rank=document.createElement('span');rank.className='rank';rank.textContent='#'+(ranked.findIndex(q=>q.id===p.id)+1);row.append(face,info,rank);$('#players').append(row);});
  $('#overlay').hidden=s.phase==='draw';document.querySelectorAll('.toolbar button,.toolbar input,.toolbar select').forEach(el=>el.disabled=!mine||s.phase!=='draw');$('#note').textContent=mine?'You have the pencil. Make every squiggle count.':'Watch the canvas. Your next great guess is coming.';
  const key=[s.phase,s.drawer,s.round,s.host,s.players.length].join(':');if(key===overlayKey)return;overlayKey=key;
  if(s.phase==='lobby'){overlay('<div class="symbol">✏️</div><h2>The gang’s all drawing.</h2><p>Share your room link and invite a friend.<br>We’ll take turns drawing and guessing.</p>');if(s.host===s.you){const btn=document.createElement('button');btn.className='primary';btn.textContent=s.players.length<2?'Waiting for a friend…':'Everybody’s here. Let’s play →';btn.disabled=s.players.length<2;btn.onclick=()=>action('start');$('#overlay-content').append(btn);}else $('#overlay-content').append('Waiting for the host to start…');}
  if(s.phase==='choose'){overlay(`<div class="symbol">🤔</div><h2>${mine?'Pick your masterpiece.':'A masterpiece is loading.'}</h2><p>${mine?'Choose a word you want to draw.':'Your artist is choosing a word. Get ready!'}</p><div class="choices"></div>`);s.choices.forEach(w=>{const btn=document.createElement('button');btn.textContent=w;btn.onclick=()=>action('choose',{word:w});$('.choices').append(btn);});}
  if(s.phase==='reveal'){overlay('<div class="symbol">✨</div><h2>That was…</h2><div class="winner"></div><p>Next artist, get your drawing hand ready.</p>');$('.winner').textContent=s.word;}
  if(s.phase==='finished'){overlay('<div class="symbol">🏆</div><h2>A round of applause.</h2><div class="winner"></div><p>The drawings were questionable. The company was excellent.</p>');$('.winner').textContent=ranked.filter(p=>p.score===ranked[0].score).map(p=>p.name).join(' & ')+' won!';if(s.host===s.you){const btn=document.createElement('button');btn.className='primary';btn.textContent='One more game →';btn.onclick=()=>action('start');$('#overlay-content').append(btn);}}
}
function connect(){source?.close();$('#welcome').hidden=true;$('#game').hidden=false;source=new EventSource(`/events?room=${auth.room}&token=${auth.token}`);source.addEventListener('solved',e=>celebrate(JSON.parse(e.data).points));source.addEventListener('state',e=>render(JSON.parse(e.data)));source.addEventListener('drawing',e=>reset(JSON.parse(e.data)));source.addEventListener('stroke',e=>draw(JSON.parse(e.data)));source.addEventListener('chat',e=>message(JSON.parse(e.data)));source.onerror=()=>toast('Connection interrupted. Trying to reconnect…');history.replaceState(null,'',`?room=${auth.room}`);}
async function enter(kind){if(!$('#name').reportValidity())return;try{auth=await api(kind,{name:$('#name').value,avatar:$('#avatar').value,room:$('#code').value.toUpperCase(),rounds:$('#rounds').value,duration:$('#duration').value,words:$('#custom').value.split(/[,\n\r]+/)});localStorage.setItem('sketch-name',$('#name').value);localStorage.setItem('sketch-avatar',$('#avatar').value);connect();}catch(e){toast(e.message);}}
$('#entry').onsubmit=e=>{e.preventDefault();enter('create');};$('#join').onclick=()=>enter('join');$('#name').value=localStorage.getItem('sketch-name')||'';$('#code').value=new URLSearchParams(location.search).get('room')||'';
$('#wordfile').onchange=async e=>{if(e.target.files[0])$('#custom').value=await e.target.files[0].text();};
$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(`${location.origin}/?room=${auth.room}`);toast('Invite link copied. Send it to your friends!');}catch{toast(`Room code: ${auth.room}`);}};
$('#guess').onsubmit=e=>{e.preventDefault();const input=$('#guess-input');if(input.value.trim()){action('chat',{text:input.value});input.value='';}};
const colors=['#ffffff','#283449','#929bad','#ef5350','#ff9b51','#f4d35e','#70c78d','#26aaa5','#5596ef','#7663dc','#cc75be','#965d43'];
function pick(c){color=c;$('#color').value=c;$('#eraser').classList.toggle('active',c==='#ffffff');document.querySelectorAll('.swatch').forEach(b=>b.classList.toggle('selected',b.dataset.color===c));}
colors.forEach(c=>{const b=document.createElement('button');b.className='swatch';b.style.background=c;b.dataset.color=c;b.setAttribute('aria-label',`Brush color ${c}`);b.onclick=()=>pick(c);$('#palette').append(b);});pick(color);$('#color').oninput=e=>pick(e.target.value);$('#eraser').onclick=()=>pick('#ffffff');
function point(e){const r=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(1000,(e.clientX-r.left)*1000/r.width)),y:Math.max(0,Math.min(700,(e.clientY-r.top)*700/r.height))};}
function flush(){if(!current)return;const s=current;current=null;queue=queue.then(()=>api('stroke',{stroke:s})).catch(e=>toast(e.message));}
canvas.onpointerdown=e=>{if(state?.phase!=='draw'||state.drawer!==state.you)return;canvas.setPointerCapture(e.pointerId);current={color,size:Number($('#size').value),points:[point(e)]};draw(current);};
canvas.onpointermove=e=>{if(!current)return;if(state?.phase!=='draw'||state.drawer!==state.you){current=null;return;}const p=point(e);draw({...current,points:[current.points.at(-1),p]});current.points.push(p);if(current.points.length>=40){const old=current;flush();current={color:old.color,size:old.size,points:[p]};}};
canvas.onpointerup=flush;canvas.onpointercancel=flush;canvas.onlostpointercapture=flush;
$('#clear').onclick=()=>{queue=queue.then(()=>action('clear'));};$('#undo').onclick=()=>{queue=queue.then(()=>action('undo'));};
$('#sound').onclick=()=>{sound=!sound;$('#sound').textContent=sound?'Sound on':'Sound off';};reset();

let editingProfile=false;
function savedAvatar(){try{return emojiAvatar(localStorage.getItem('sketch-avatar'));}catch{return '🙂';}}
function setAvatar(value){$('#avatar').value=value;$('#avatar-preview').textContent=value;localStorage.setItem('sketch-avatar',value);}
function previewAvatar(){
  let value;
  try{value=emojiAvatar($('#new-avatar').value);$('#emoji-error').textContent='';$('#save-avatar').disabled=false;}
  catch{value=null;$('#emoji-error').textContent='Choose one emoji. Flags, skin tones, and combined emojis work too.';$('#save-avatar').disabled=true;}
  $('#picker-preview').textContent=value||'❔';
  document.querySelectorAll('#emoji-options button').forEach(b=>{const selected=b.textContent===value;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
  return value;
}
function openPicker(inRoom){editingProfile=inRoom;$('#new-avatar').value=inRoom?state.players.find(p=>p.id===state.you).avatar:$('#avatar').value;previewAvatar();$('#avatar-dialog').showModal();}
setAvatar(savedAvatar());
for(const emoji of ['🙂','😎','😂','🥹','🤩','🥳','😈','💀','👻','👽','🤖','🤡','🐸','🐱','🐶','🦊','🐼','🐻','🐵','🐙','🦄','🐥','🦋','🐢','🔥','🌈','⭐','🌻','🍄','🍕','🍉','🎨']){
  const b=document.createElement('button');b.type='button';b.textContent=emoji;b.setAttribute('aria-label',`Use ${emoji} avatar`);b.onclick=()=>{$('#new-avatar').value=emoji;previewAvatar();};$('#emoji-options').append(b);
}
$('#new-avatar').oninput=previewAvatar;
$('#open-avatar').onclick=()=>openPicker(false);
$('#edit-avatar').onclick=()=>openPicker(true);
$('#save-avatar').onclick=async()=>{const value=previewAvatar();if(!value)return;$('#save-avatar').disabled=true;try{if(editingProfile)await api('avatar',{avatar:value});setAvatar(value);$('#avatar-dialog').close();}catch(e){$('#emoji-error').textContent=e.message;}finally{$('#save-avatar').disabled=false;}};
$('#avatar-dialog form').onsubmit=e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();$('#save-avatar').click();};
$('#score-help').onclick=()=>$('#scoring-dialog').showModal();

