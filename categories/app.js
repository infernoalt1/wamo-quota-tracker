const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const app=$('#app');
let config={catalog:[]},session=null,state=null,source=null,lastMessage=0,signature='',offset=0,recovering=false,retryAt=0,draft=null,answerDraft='',answerTurn=-1,busy=false,lastEvent=null,lastBeat=-1,audio=null,sound=false;
const storage={get(k){try{return sessionStorage.getItem(k);}catch{return null;}},set(k,v){try{sessionStorage.setItem(k,v);}catch{}},remove(k){try{sessionStorage.removeItem(k);}catch{}}};
try{session=JSON.parse(storage.get('categories.session'));}catch{}
let name=storage.get('categories.name')||'';
let face=storage.get('categories.emoji')||'🐸';
const faces=['🙂','😎','😂','🥹','🤩','🥳','😈','💀','👻','👽','🤖','🤡','🐸','🐱','🐶','🦊','🐼','🐻','🐵','🐙','🦄','🐥','🦋','🐢','🔥','🌈','⭐','🌻','🍄','🍕','🍉','🎨'];
function pickFace(){
  const dialog=$('#emoji-picker'),input=$('#custom-emoji'),preview=$('#emoji-preview');
  let chosen=state?.players.find(p=>p.id===state.you)?.emoji||face;
  const select=value=>{chosen=value;input.value=value;preview.textContent=value||'…';$('#emoji-error').textContent='';document.querySelectorAll('[data-emoji]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.emoji===value)));};
  $('#emoji-grid').innerHTML=faces.map(e=>`<button type="button" data-emoji="${e}" aria-label="Choose ${e}">${e}</button>`).join('');
  document.querySelectorAll('[data-emoji]').forEach(b=>b.onclick=()=>select(b.dataset.emoji));
  select(chosen);input.oninput=()=>select(input.value.trim());
  $('#emoji-form').onsubmit=async e=>{
    e.preventDefault();const button=$('#use-emoji');if(button.disabled)return;
    if(chosen.length>64||[...new Intl.Segmenter('en',{granularity:'grapheme'}).segment(chosen)].length!==1||!/[\p{Extended_Pictographic}\p{Regional_Indicator}\u20e3]/u.test(chosen)||! /^[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\u200d\ufe0f\ufe0e\u20e3\u{e0020}-\u{e007f}0-9#*]+$/u.test(chosen)){$('#emoji-error').textContent='Choose one emoji.';input.focus();return;}
    button.disabled=true;
    try{if(state)await api('avatar',{emoji:chosen});face=chosen;storage.set('categories.emoji',face);document.querySelectorAll('[data-edit-face]').forEach(b=>{b.querySelector('.avatar').textContent=face;});dialog.close();}catch(error){$('#emoji-error').textContent=error.message;}finally{button.disabled=false;}
  };
  dialog.showModal();
}
const invite=new URLSearchParams(location.search).get('room')?.toUpperCase()||'';
if(session&&invite&&session.room!==invite){session=null;storage.remove('categories.session');}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),4200);}
async function api(action,data={}){
  const response=await fetch('./api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...session,...data,action}),signal:AbortSignal.timeout(12000)});
  let result;try{result=await response.json();}catch{throw Error('The server is unavailable. Trying to reconnect.');}
  if(!response.ok){const e=Error(result.error||'Please try again.');e.expired=response.status===410;throw e;}return result;
}
function beep(frequency=600,duration=.08){if(!sound)return;try{audio??=new AudioContext();if(audio.state==='suspended')audio.resume();const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.connect(gain);gain.connect(audio.destination);oscillator.frequency.value=frequency;gain.gain.setValueAtTime(.04,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);oscillator.start();oscillator.stop(audio.currentTime+duration);}catch{}}
$('#sound').onclick=()=>{sound=!sound;$('#sound').innerHTML=`♫ <span>Sound ${sound?'on':'off'}</span>`;$('#sound').setAttribute('aria-pressed',String(sound));$('#sound').setAttribute('aria-label',sound?'Mute sound':'Enable sound');beep();};
$('#help').onclick=()=>$('#rules').showModal();document.querySelectorAll('.dialog-close').forEach(b=>b.onclick=()=>$('#rules').close());
document.querySelectorAll('.emoji-close').forEach(b=>b.onclick=()=>$('#emoji-picker').close());
const option=(value,label,selected)=>`<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(label)}</option>`;
function landing(){
  document.body.dataset.phase='landing';
  $('#connection').textContent='';
  app.innerHTML=`<section class="landing"><section class="entry-card"><h1>categories<span>.</span></h1><form id="entry-form"><button type="button" class="face-picker" data-edit-face aria-label="Choose your emoji"><span class="avatar">${esc(face)}</span><span>Change emoji</span></button><label for="name">Nickname</label><input id="name" name="name" autocomplete="nickname" maxlength="20" placeholder="Your name" value="${esc(name)}" required><button class="button primary" type="submit" name="intent" value="create">Create room</button><div class="or"><span></span>or<span></span></div><div class="join-row"><input id="room-code" name="room" maxlength="5" autocomplete="off" placeholder="Room code" value="${esc(invite)}" aria-label="Room code"><button class="button dark" type="submit" name="intent" value="join">Join</button></div></form><small class="entry-meta">2&ndash;12 players</small></section></section>`;
  $('[data-edit-face]').onclick=pickFace;
  $('#entry-form').onsubmit=async e=>{e.preventDefault();if(busy)return;const action=e.submitter?.value||'create';name=$('#name').value.trim();const room=$('#room-code').value.trim().toUpperCase();if(!name)return toast('Choose a nickname first.');if(action==='join'&&!room)return toast('Enter your friend’s room code.');busy=true;e.submitter?.setAttribute('disabled','');try{session=await api(action,{name,room,emoji:face});storage.set('categories.session',JSON.stringify(session));storage.set('categories.name',name);history.replaceState(null,'',`?room=${session.room}`);connect();}catch(error){toast(error.message);e.submitter?.removeAttribute('disabled');}finally{busy=false;}};
}
function connect(){source?.close();lastMessage=Date.now();$('#connection').textContent='Connecting…';source=new EventSource(`./events?room=${encodeURIComponent(session.room)}&token=${encodeURIComponent(session.token)}`);source.addEventListener('state',e=>{lastMessage=Date.now();retryAt=0;$('#connection').textContent='Connected';const next=JSON.parse(e.data);offset=next.serverNow-Date.now();if(answerTurn!==next.turn){answerDraft='';answerTurn=next.turn;lastBeat=-1;}if(next.phase==='lobby'&&(state?.phase!=='lobby'||next.host!==state?.host))draft=null;state=next;const {serverNow,...stable}=next;const key=JSON.stringify(stable);if(key!==signature){signature=key;render();}if(next.event?.id!==lastEvent){lastEvent=next.event?.id;if(next.event)beep(next.event.kind==='out'?180:next.event.kind==='win'?880:660,.16);}});source.onerror=()=>{$('#connection').textContent='Reconnecting…';};}
async function recover(){if(!session||recovering||Date.now()<retryAt)return;recovering=true;try{await api('resume');connect();}catch(error){if(error.expired){source?.close();session=null;state=null;signature='';storage.remove('categories.session');landing();toast(error.message);}else{retryAt=Date.now()+4000;$('#connection').textContent='Offline · retrying…';}}finally{recovering=false;}}
const avatar=p=>`<span class="avatar color-${p.color}">${esc(p.emoji||face)}</span>`;
function players(){return `<aside class="players panel"><div class="section-heading"><h3>Players</h3><span>${state.players.filter(p=>!p.left).length}/12</span></div><div class="player-list">${state.players.map(p=>`<div class="player ${p.id===state.active&&p.alive?'active':''} ${!p.alive&&state.phase!=='lobby'?'eliminated':''} ${p.left?'departed':''}">${p.id===state.you&&state.phase==='lobby'?`<button class="edit-face" data-edit-face aria-label="Change your emoji">${avatar(p)}</button>`:avatar(p)}<div class="player-name"><b>${esc(p.name)} ${p.id===state.you?'<small>(you)</small>':''}</b><small>${p.left?'Left the room':!p.online?'Reconnecting…':state.phase==='lobby'?(p.id===state.host?'★ Host':'Ready'):p.id===state.active&&p.alive?(state.phase==='turn'?'Answering':'Answer submitted'):p.alive?'Still in':p.reason||'Out'}</small></div><span class="score">${p.score}<small>pts</small></span></div>`).join('')}</div></aside>`;}
function roundPlanner(s){
  if(s.categoryMode!=='plan')return '';
  return '<section class="round-planner"><h3>Round categories</h3><datalist id="category-ideas">'+config.catalog.map(c=>'<option value="'+esc(c.name)+'"></option>').join('')+'</datalist><div class="round-plan-grid">'+Array.from({length:s.rounds},(_,i)=>'<label for="round-category-'+i+'">Round '+(i+1)+'<input id="round-category-'+i+'" name="roundCategory" list="category-ideas" maxlength="80" placeholder="Any category" value="'+esc(s.roundPlan?.[i]||'')+'" required></label>').join('')+'</div></section>';
}
function recapView(){
  const recap=state.recap;if(!recap)return '';
  const labels={accepted:'Accepted',invalid:'Called out',duplicate:'Repeat',timeout:'Timed out',left:'Left'};
  return '<section class="recap panel"><div class="section-heading"><h3>'+ (state.phase==='lobby'?'Last game recap':'Game recap')+'</h3><span>'+recap.rounds.length+' ROUNDS</span></div><div class="recap-exports"><button class="button secondary" data-export="csv">Download CSV</button><button class="button secondary" data-export="json">Download JSON</button></div>'+recap.rounds.map(round=>'<details class="recap-round" open><summary>Round '+round.round+' &middot; '+esc(round.category)+'<small>'+esc(round.winner?round.winner.name+' won':'No winner')+'</small></summary><div class="recap-scroll"><table><caption class="sr-only">Answers for round '+round.round+'</caption><thead><tr><th scope="col">Player</th><th scope="col">Answer</th><th scope="col">Result</th></tr></thead><tbody>'+round.answers.map(a=>'<tr><td>'+esc(recap.players.find(p=>p.id===a.player)?.emoji||'')+' '+esc(a.name)+'</td><td>'+esc(a.answer||'(no answer)')+'</td><td><span class="recap-status status-'+esc(a.status)+'">'+esc(labels[a.status]||a.status)+'</span>'+(a.callout?'<small>Call Out: '+esc(a.callout.caller)+' &middot; '+esc(a.callout.outcome)+(a.callout.confirmedBy?' &middot; confirmed by '+esc(a.callout.confirmedBy):'')+'</small>':'')+'</td></tr>').join('')+(round.answers.length?'':'<tr><td colspan="3">No answers were submitted.</td></tr>')+'</tbody></table></div></details>').join('')+'</section>';
}
async function exportRecap(format){
  if(busy)return;busy=true;
  try{
    const result=await api('export',{format});
    const blob=new Blob([result.content],{type:format==='csv'?'text/csv;charset=utf-8':'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=result.filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Export downloaded.');
  }catch(error){toast(error.message);}finally{busy=false;}
}

function settings(){
  const host=state.host===state.you,s=host?(draft||state.settings):state.settings;
  return `<section class="settings panel"><div class="section-heading"><h3>Game settings</h3><span>${host?'HOST':'HOST SETTINGS'}</span></div>
  <form id="settings-form"><fieldset ${host?'':'disabled'}><div class="settings-grid">
  <label>Rounds<select name="rounds">${Array.from({length:20},(_,i)=>i+1).map(n=>option(String(n),n+' round'+(n===1?'':'s'),String(s.rounds))).join('')}</select></label>
  <label>Time per turn<select name="seconds">${[4,6,8,10,15,20,30].map(n=>option(String(n),n+' seconds',String(s.seconds))).join('')}</select></label>
  <label>Category selection<select name="categoryMode">${option('shuffle','Shuffle categories',s.categoryMode)}${option('plan','Choose every round',s.categoryMode)}</select></label><label class="${s.categoryMode==='plan'?'hidden':''}">Category pack<select name="pack">${['All','Everyday','World','Culture','Local','Custom'].map(n=>option(n,n==='All'?'All categories':n==='Local'?'Local - your people':n,s.pack)).join('')}</select></label>
  <label class="${s.categoryMode==='plan'?'hidden':''}">Category<select name="category" ${s.pack==='Custom'?'disabled':''}>${option('random','Surprise me',s.category)}${config.catalog.filter(c=>s.pack==='All'?c.pack!=='Local':c.pack===s.pack).map(c=>option(c.id,c.name,s.category)).join('')}</select></label>
  <label>Game mode<select name="mode">${option('normal','Classic countdown',s.mode)}${option('rhythm','Concentration - 120 BPM',s.mode)}</select></label>
  </div>
  ${roundPlanner(s)}<label class="custom-label ${s.pack==='Custom'&&s.categoryMode!=='plan'?'':'hidden'}">Your custom categories <small>One per line</small><textarea name="custom" rows="3" maxlength="1000" placeholder="Teachers at our school&#10;Things that are annoying">${esc(s.custom)}</textarea></label>
  <label class="toggle-row"><span><b>Show previous answers</b></span><input name="showAnswers" type="checkbox" role="switch" ${s.showAnswers?'checked':''}></label>
  </fieldset>
  ${host?`<div class="start-row"><button type="submit" class="button secondary" value="save">Save settings</button><button type="submit" class="button primary" value="start" ${state.players.filter(p=>!p.left).length<2?'disabled':''}>Start game</button></div><p class="start-note">${state.players.filter(p=>!p.left).length<2?'Waiting for one more player.':''}</p>`:'<div class="waiting">Waiting for the host to start<span>...</span></div>'}</form></section>`;
}
function board(){
  const s=state,me=s.players.find(p=>p.id===s.you),active=s.players.find(p=>p.id===s.active),mine=s.active===s.you,category=s.category;
  if(s.phase==='result'||s.phase==='finished')return results();
  let body='';
  if(s.phase==='reveal')body=`<div class="reveal-card"><span class="eyebrow">ROUND ${s.round}</span><div class="reveal-icon">${category.icon}</div><h2>${esc(category.name)}</h2><div class="ready-count" data-countdown></div></div>`;
  else{
    const pending=s.pending,caller=s.players.find(p=>p.id===pending?.caller),confirmer=s.players.find(p=>p.id===pending?.confirmedBy);
    const heading=s.phase==='turn'?(mine?'YOUR TURN':esc(active?.name)+' is answering...'):s.phase==='callout'?'Call Out: '+esc(caller?.name)+' CALLED IT OUT':s.phase==='calledout'?'CALLED OUT':'THAT COUNTS!';
    const reason=s.phase==='callout'?'Waiting for one confirmation.':s.phase==='calledout'?(confirmer?'Confirmed by '+confirmer.name+'. '+active?.name+' is out.':'Two players remain: the opponent’s call-out stands.'):'';
    body=`<div class="category-heading"><h2><span>${category.icon}</span> ${esc(category.name)}</h2></div><div class="turn-zone ${mine?'your-turn':''}"><div class="turn-label">${heading}</div>
      ${s.phase==='turn'?`<div class="timer" data-countdown></div><div class="timer-track"><div id="timer-fill"></div></div>${s.settings.mode==='rhythm'?'<div class="beats" aria-label="Four beat rhythm"><i></i><i></i><i></i><i></i></div><p class="beat-caption">Keep the rhythm - answer before the beats run out</p>':''}`: `<div class="answer-reveal ${s.phase==='calledout'?'invalid-answer':''}">&ldquo;${esc(pending?.answer)}&rdquo;</div><p class="verdict-reason">${esc(reason)}</p><small class="review-clock"><span data-countdown></span>s ${s.phase==='review'?'to Call Out':s.phase==='callout'?'for one confirmation':'until play continues'}</small>`}
      ${s.phase==='turn'&&mine?`<form id="answer-form"><label class="sr-only" for="answer">Your answer</label><div class="answer-row"><input id="answer" autocomplete="off" maxlength="80" placeholder="Your answer" value="${esc(answerDraft)}" required><button class="button primary" type="submit">Send</button></div></form>`:s.phase==='turn'?`<div class="spectator-message">${me.alive?'':'Back next round'}</div>`:''}
      <div class="callout-actions">${pending?.canCallOut?'<button class="button secondary" id="callout">Call Out</button>':''}${pending?.canConfirm?'<button class="button danger" id="confirm-callout">Agree - does not fit</button>':''}${pending?.canUndo?'<button class="button secondary" id="cancel-callout">Undo my call-out</button>':''}</div>
      ${s.phase==='callout'&&!pending?.canConfirm?`<p class="callout-hint">${pending?.player===s.you?'Another active player must confirm.':pending?.caller===s.you?'Waiting for one other player to agree...':'You are watching this call-out.'}</p>`:''}
    </div>`;
  }
  return `<section class="game-board panel">${body}</section><section class="answer-history panel"><div class="section-heading"><h3>${s.settings.showAnswers?'Already said':'Memory mode'}</h3><span>${s.answerCount} ACCEPTED</span></div>${s.settings.showAnswers?`<div class="answer-chips">${s.answers.length?s.answers.map((a,i)=>`<span class="${a.status==='invalid'?'invalid-answer':''}"><small>${esc(s.players.find(p=>p.id===a.player)?.emoji||'')}</small> ${esc(a.answer)} <em>${a.status==='invalid'?'Called out - ':''}${esc(a.name)}</em></span>`).join(''):'<p class="empty-note">No answers yet.</p>'}</div>`:'<p class="memory-note">Answers hidden until the game ends.</p>'}</section>`;
}
function results(){
  const finished=state.phase==='finished',sorted=[...state.players].sort((a,b)=>b.score-a.score),leaders=sorted.filter(p=>p.score===sorted[0].score),winner=state.players.find(p=>p.id===state.winner);
  return `<section class="result-board panel"><div class="confetti" aria-hidden="true">✦ <span>✳</span> · <span>✷</span> ✦</div><span class="eyebrow">${finished?'GAME OVER':`ROUND ${state.round}`}</span><div class="trophy">${finished?'🏆':'👑'}</div><h2>${finished?(leaders.length>1?'Tie!':`${esc(leaders[0].name)} wins!`):(winner?`${esc(winner.name)} takes it!`:'No winner')}</h2><p>${finished?(leaders.length>1?leaders.map(p=>esc(p.name)).join(' & ')+' finish tied.':esc(state.event?.text)):(winner?'+1 point':'No point awarded this round.')}</p><div class="leaderboard">${sorted.map((p,i)=>`<div class="leader-row"><span class="rank">${i&&p.score===sorted[i-1].score?sorted.findIndex(q=>q.score===p.score)+1:i+1}</span>${avatar(p)}<b>${esc(p.name)}${p.id===state.you?' (you)':''}${p.left?' · left':''}</b><strong>${p.score}<small>pts</small></strong></div>`).join('')}</div>${finished?(state.host===state.you?'<button class="button primary" id="lobby">Back to lobby</button>':'<p>Waiting for the host to bring everyone back.</p>'):`<div class="next-round">${state.round>=state.settings.rounds?'Final results':'Next category'} in <b data-countdown></b>…</div>`}</section>`;
}
function render(){
  document.body.dataset.phase=state.phase;
  const focus=document.activeElement,id=focus?.id,selection=focus?.selectionStart;
  app.innerHTML=`<section class="room-heading"><div><span class="eyebrow">${state.phase==='lobby'?'ROOM':`ROUND ${state.round} OF ${state.settings.rounds}`}</span><h1>${state.phase==='lobby'?'Lobby':state.phase==='finished'?'Results':`Round ${state.round}`}</h1></div><div class="room-actions"><button id="invite" class="room-code" title="Copy invite link"><small>ROOM CODE · COPY INVITE</small><b>${esc(state.code)} <span>↗</span></b></button><button id="leave" class="text-button">Leave room</button></div></section><div class="room-layout">${players()}<div class="main-stage">${state.phase==='lobby'?settings():board()}${['lobby','finished'].includes(state.phase)?recapView():''}</div></div><div class="event-banner ${state.event?.kind==='out'?'out':''}" role="status">${!['result','finished'].includes(state.phase)?esc(state.event?.text||''):''}</div>`;
  document.querySelectorAll('[data-edit-face]').forEach(b=>b.onclick=pickFace);
  $('#invite').onclick=async()=>{const link=new URL(`?room=${state.code}`,location.href).href;try{await navigator.clipboard.writeText(link);toast('Invite copied.');}catch{toast(`Share this room code: ${state.code}`);}};
  $('#leave').onclick=async()=>{try{await api('leave');source?.close();session=null;state=null;signature='';storage.remove('categories.session');location.href='./';}catch(error){toast(error.message);}};
  const form=$('#settings-form');if(form&&state.host===state.you){
    const read=()=>{const data=new FormData(form);return {...Object.fromEntries(data),rounds:Number(data.get('rounds')),seconds:Number(data.get('seconds')),showAnswers:data.has('showAnswers'),category:data.get('category')||'random',roundPlan:Array.from({length:20},(_,i)=>data.getAll('roundCategory')[i]??draft?.roundPlan?.[i]??state.settings.roundPlan?.[i]??'')};};
    form.oninput=e=>{draft=read();if(e.target.name==='pack'){draft.category='random';render();}else if(['category','categoryMode','rounds'].includes(e.target.name))render();};
    form.onsubmit=async e=>{e.preventDefault();if(busy)return;const intent=e.submitter?.value;busy=true;const settings=read();e.submitter.disabled=true;try{await api('settings',{settings});draft=null;if(intent==='start')await api('start');else toast('Settings saved.');}catch(error){toast(error.message);}finally{busy=false;signature='';render();}};
  }
  if($('#answer-form')){
    $('#answer').oninput=e=>answerDraft=e.target.value;
    $('#answer-form').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;const button=e.submitter;button.disabled=true;try{await api('answer',{answer:answerDraft,turn:state.turn});answerDraft='';}catch(error){toast(error.message);}finally{busy=false;if(button.isConnected)button.disabled=false;}};
  }
  if($('#callout'))$('#callout').onclick=()=>action('callout',{turn:state.turn});
  if($('#confirm-callout'))$('#confirm-callout').onclick=()=>action('confirmCallout',{turn:state.turn});
  if($('#cancel-callout'))$('#cancel-callout').onclick=()=>action('cancelCallout',{turn:state.turn});
  document.querySelectorAll('[data-export]').forEach(button=>button.onclick=()=>exportRecap(button.dataset.export));
  if($('#lobby'))$('#lobby').onclick=()=>action('lobby');
  if(id&&document.getElementById(id)){const target=document.getElementById(id);target.focus({preventScroll:true});try{target.setSelectionRange(selection,selection);}catch{}}
  else if($('#answer')&&matchMedia('(pointer:fine)').matches)$('#answer').focus({preventScroll:true});
  updateClock();
}
async function action(kind,data){if(busy)return;busy=true;try{await api(kind,data);}catch(error){toast(error.message);}finally{busy=false;}}
function updateClock(){
  if(!state)return;const now=Date.now()+offset,remaining=Math.max(0,state.deadline-now),seconds=Math.ceil(remaining/1000);
  document.querySelectorAll('[data-countdown]').forEach(el=>{el.textContent=String(seconds).padStart(2,'0');el.classList.toggle('urgent',state.phase==='turn'&&seconds<=3);});
  const undo=$('#cancel-callout');if(undo)undo.disabled=now>=state.pending.undoUntil;
  const fill=$('#timer-fill');if(fill)fill.style.transform=`scaleX(${Math.min(1,remaining/(state.settings.seconds*1000))})`;
  if(state.phase==='turn'){
    const beat=Math.max(0,Math.floor((now-state.startedAt)/500));
    document.querySelectorAll('.beats i').forEach((el,i)=>el.classList.toggle('lit',i===beat%4));
    if(beat!==lastBeat){lastBeat=beat;if(state.settings.mode==='rhythm')beep(beat%4===0?640:380,.04);else if(seconds<=3&&beat%2===0)beep(800,.06);}
  }
}
setInterval(updateClock,60);
setInterval(()=>{if(session&&Date.now()-lastMessage>7000)recover();},2000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session)recover();});window.addEventListener('online',recover);
try{const response=await fetch('./config');if(!response.ok)throw Error();config=await response.json();}catch{toast('Couldn’t load category options. Refresh to try again.');}
if(session){landing();await recover();}else landing();
