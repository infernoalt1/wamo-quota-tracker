import {randomInt,randomUUID} from 'node:crypto';
import {catalog,answerKey,normalize} from './catalog.mjs';
import {validateAnswer} from './validation.mjs';

export const defaults={rounds:5,seconds:10,showAnswers:true,pack:'All',category:'random',custom:'',mode:'normal'};
export const timing={review:2500,confirmation:4000,undo:1500};
const integer=(n,min,max)=>Math.min(max,Math.max(min,Math.round(Number(n)||min)));
export function configure(r,input) {
  const s={...r.settings};
  for(const key of ['rounds','seconds'])if(input[key]!==undefined)s[key]=integer(input[key],key==='rounds'?1:4,key==='rounds'?20:30);
  for(const key of ['showAnswers'])if(input[key]!==undefined){if(typeof input[key]!=='boolean')throw Error('Invalid setting.');s[key]=input[key];}
  for(const [key,options] of Object.entries({pack:['All','Everyday','World','Culture','Local','Custom'],mode:['normal','rhythm']}))if(input[key]!==undefined){if(!options.includes(input[key]))throw Error('Invalid setting.');s[key]=input[key];}
  if(input.category!==undefined){if(input.category!=='random'&&!catalog.some(c=>c.id===input.category))throw Error('Unknown category.');s.category=input.category;}
  if(input.custom!==undefined)s.custom=String(input.custom).trim().slice(0,1000);
  r.settings=s;
}
export function createRoom(code){return {code,players:[],host:null,settings:{...defaults},phase:'lobby',round:0,turn:0,deadline:0,used:new Set(),answers:[],category:null,pending:null,event:null,usedCategories:[],updated:Date.now()};}
export function addPlayer(r,name) {
  if(r.players.filter(p=>!p.left).length>=12)throw Error('This room is full (12 players).');
  const p={id:randomUUID(),token:randomUUID(),name:String(name||'').trim().slice(0,20),score:0,alive:false,left:false,streams:new Set(),lastSeen:Date.now(),color:r.players.length%8};
  if(!p.name)throw Error('Choose a name first.');
  r.players.push(p);r.host??=p.id;return p;
}
const available=r=>r.players.filter(p=>!p.left);
const living=r=>r.players.filter(p=>!p.left&&p.alive);
function event(r,kind,text){r.event={id:randomUUID(),kind,text};}
function finish(r,text='Every round played. Every point earned.') {r.phase='finished';r.deadline=0;r.pending=null;r.active=null;event(r,'finish',text);}
function settleRound(r,now) {
  if(living(r).length>1)return false;
  const winner=living(r)[0];if(winner)winner.score++;
  r.winner=winner?.id||null;r.phase='result';r.deadline=now+6500;r.pending=null;r.active=null;
  event(r,'win',winner?`${winner.name} takes the round!`:'No survivors this round.');return true;
}
function beginTurn(r,now,after=r.active) {
  if(settleRound(r,now))return;
  const index=r.players.findIndex(p=>p.id===after);
  for(let offset=1;offset<=r.players.length;offset++){
    const p=r.players[(index+offset+r.players.length)%r.players.length];
    if(p.alive&&!p.left){r.active=p.id;break;}
  }
  r.turn++;r.phase='turn';r.pending=null;r.startedAt=now;r.deadline=now+r.settings.seconds*1000;
}
function nextRound(r,now) {
  if(r.round>=r.settings.rounds){finish(r);return;}
  if(available(r).length<2){finish(r,'Not enough players to continue. Invite a friend for another game.');return;}
  let pool;
  if(r.settings.pack==='Custom')pool=[...new Set(r.settings.custom.split('\n').map(s=>s.trim()).filter(Boolean))].map((name,i)=>({id:`custom-${i}`,name:name.slice(0,80),pack:'Custom',difficulty:'Wildcard',icon:'✨'}));
  else pool=r.settings.category!=='random'?catalog.filter(c=>c.id===r.settings.category):catalog.filter(c=>r.settings.pack==='All'?c.pack!=='Local':c.pack===r.settings.pack);
  if(!pool.length)throw Error('Add at least one custom category.');
  let fresh=pool.filter(c=>!r.usedCategories.includes(c.id));if(!fresh.length){r.usedCategories=[];fresh=pool;}
  r.category=fresh[randomInt(fresh.length)];r.usedCategories.push(r.category.id);
  r.round++;r.used=new Set();r.answers=[];r.pending=null;r.event=null;r.winner=null;
  r.players.forEach(p=>{p.alive=!p.left;p.reason='';});
  const participants=available(r);r.active=participants[(r.round-1)%participants.length].id;
  r.phase='reveal';r.deadline=now+3000;
}
export function start(r,now=Date.now()) {
  if(r.phase!=='lobby')throw Error('Return to the lobby first.');
  if(available(r).length<2)throw Error('Invite at least one friend to play.');
  if(r.settings.pack==='Custom'&&!r.settings.custom.trim())throw Error('Add at least one custom category.');
  r.players=r.players.filter(p=>!p.left);r.players.forEach(p=>p.score=0);r.round=0;r.usedCategories=[];nextRound(r,now);
}
function eliminate(r,p,reason,now) {
  if(p){p.alive=false;p.reason=reason;event(r,'out',`${p.name} is out — ${reason}`);}
  beginTurn(r,now,p?.id||r.active);
}
function continueAccepted(r,now,text='That counts!') {
  const player=r.pending.player;
  event(r,'accepted',text);beginTurn(r,now,player);
}
export function submit(r,p,body,{now=Date.now()}={}) {
  if(r.phase!=='turn'||r.active!==p.id||body.turn!==r.turn)throw Error('This turn has ended.');
  if(now>=r.deadline){eliminate(r,p,'Time ran out.',now);throw Error('Time ran out.');}
  const answer=String(body.answer??'').trim().slice(0,80);
  if(!normalize(answer))throw Error('Type an answer first.');
  const key=answerKey(r.category,answer);
  if(r.used.has(key)){eliminate(r,p,'Already said this round.',now);return;}
  const result=validateAnswer(r.category,answer);
  if(result.verdict==='invalid'){eliminate(r,p,result.reason,now);return;}
  const record={id:randomUUID(),player:p.id,name:p.name,answer,key,status:'accepted'};
  // Acceptance and duplicate tracking happen immediately, before the call-out window.
  r.used.add(key);r.answers.push(record);
  r.pending={id:record.id,player:p.id,answer,key,reason:result.reason,opponents:living(r).filter(q=>q.id!==p.id).map(q=>q.id),caller:null,confirmedBy:null,undoUntil:0};
  r.phase='review';r.deadline=now+timing.review;event(r,'accepted','That counts!');
}
function succeedCallout(r,now,confirmer=null){
  const pending=r.pending,player=r.players.find(p=>p.id===pending.player);
  pending.confirmedBy=confirmer;pending.undoUntil=now+timing.undo;
  player.alive=false;player.reason='Called out.';
  r.answers.find(a=>a.id===pending.id).status='invalid';r.used.delete(pending.key);
  r.phase='calledout';r.deadline=pending.undoUntil;
  event(r,'out',`${player.name} is out — call-out succeeded.`);
  // Elimination is immediate; defer turn/point settlement for the brief undo grace.
}
export function callOut(r,p,turn,now=Date.now()){
  if(r.phase!=='review'||turn!==r.turn||now>=r.deadline||p.left||!p.alive||!r.pending.opponents.includes(p.id))throw Error('You cannot call out this answer.');
  r.pending.caller=p.id;r.pending.undoUntil=now+timing.undo;
  r.pending.eligible=living(r).filter(q=>q.id!==p.id&&q.id!==r.pending.player).map(q=>q.id);
  if(living(r).length===2){succeedCallout(r,now);return;}
  r.phase='callout';r.deadline=now+timing.confirmation;
  event(r,'callout',`${p.name} called it out. One other active player must agree.`);
}
export function confirmCallout(r,p,turn,now=Date.now()){
  if(r.phase!=='callout'||turn!==r.turn||now>=r.deadline||p.left||!p.alive||!r.pending.eligible.includes(p.id))throw Error('You cannot confirm this call-out.');
  succeedCallout(r,now,p.id);
}
export function cancelCallout(r,p,turn,now=Date.now()){
  if(!['callout','calledout'].includes(r.phase)||turn!==r.turn||p.left||r.pending.caller!==p.id||now>=r.pending.undoUntil)throw Error('The undo window has closed.');
  const player=r.players.find(q=>q.id===r.pending.player);
  if(player.left)throw Error('That player has left.');
  if(r.phase==='calledout'){
    player.alive=true;player.reason='';
    r.answers.find(a=>a.id===r.pending.id).status='accepted';r.used.add(r.pending.key);
  }
  continueAccepted(r,now,'Call-out canceled. The answer counts.');
}
export function leave(r,p,now=Date.now()) {
  p.left=true;p.alive=false;for(const stream of p.streams)stream.end();p.streams.clear();
  if(r.host===p.id)r.host=available(r)[0]?.id||null;
  if(['turn','review','callout','calledout','reveal'].includes(r.phase)){
    // A departure cannot turn an unconfirmed three-player call-out into a win.
    if(r.phase==='callout'&&p.id!==r.pending.player){
      if(p.id===r.pending.caller||!living(r).some(q=>r.pending.eligible.includes(q.id))){continueAccepted(r,now,'Call-out ended. The answer counts.');return;}
    }
    if(r.phase==='calledout'&&p.id!==r.pending.player)return;
    if(settleRound(r,now))return;
    if(r.active===p.id)beginTurn(r,now,p.id);
  }
}
export function tickRoom(r,now=Date.now()) {
  if(!r.deadline||now<r.deadline)return;
  if(r.phase==='reveal'){r.phase='turn';r.turn++;r.startedAt=now;r.deadline=now+r.settings.seconds*1000;}
  else if(r.phase==='turn')eliminate(r,r.players.find(p=>p.id===r.active),'Time ran out.',now);
  else if(r.phase==='review')continueAccepted(r,now);
  else if(r.phase==='callout')continueAccepted(r,now,'No confirmation. The answer counts.');
  else if(r.phase==='calledout')beginTurn(r,now,r.pending.player);
  else if(r.phase==='result')nextRound(r,now);
}
export function snapshot(r,p,now=Date.now()) {
  const current=['review','callout','calledout'].includes(r.phase)?r.pending:null;
  return {code:r.code,you:p.id,host:r.host,phase:r.phase,round:r.round,turn:r.turn,deadline:r.deadline,startedAt:r.startedAt,serverNow:now,active:r.active,winner:r.winner,
    settings:r.settings,category:r.category?(({answers,plurals,...c})=>c)(r.category):null,event:r.event,
    players:r.players.map(q=>({id:q.id,name:q.name,score:q.score,alive:q.alive,left:q.left,color:q.color,reason:q.reason,online:q.streams.size>0||now-q.lastSeen<15000})),
    answers:r.settings.showAnswers?r.answers.map(({name,answer,status})=>({name,answer,status})):[],answerCount:r.answers.filter(a=>a.status==='accepted').length,
    pending:current?{answer:current.answer,player:current.player,reason:current.reason,caller:current.caller,confirmedBy:current.confirmedBy,undoUntil:current.undoUntil,
      canCallOut:r.phase==='review'&&now<r.deadline&&!p.left&&p.alive&&current.opponents.includes(p.id),
      canConfirm:r.phase==='callout'&&now<r.deadline&&!p.left&&p.alive&&current.eligible.includes(p.id),
      canUndo:['callout','calledout'].includes(r.phase)&&!p.left&&p.id===current.caller&&now<current.undoUntil}:null};
}
