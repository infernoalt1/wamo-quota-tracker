import { ROLES } from './characters.mjs';

export const COUNTS = {5:[3,0,1],6:[3,1,1],7:[5,0,1],8:[5,1,1],9:[5,2,1],10:[7,0,2],11:[7,1,2],12:[7,2,2],13:[9,0,3],14:[9,1,3],15:[9,2,3]};
const ids = Object.keys(ROLES);
const ofType = type => ids.filter(id => ROLES[id].type === type);
const rand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
const pick = a => a[Math.floor(rand()*a.length)];
const shuffle = a => { a=[...a]; for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
const assert = (v,m) => {if(!v) throw new Error(m);};
const live = g => g.players.filter(p=>p.alive);
const player = (g,id) => g.players.find(p=>p.id===id);
const evil = p => ['minion','demon'].includes(ROLES[p.role]?.type);
const label = id => ROLES[id]?.name || id;
export function poisoned(g,p) {const s=player(g,g.poison?.source);return !!(s?.alive && s.role==='poisoner' && g.poison.target===p.id);}
export function impaired(g,p) {return p.role==='drunk'||poisoned(g,p);}
const active = (g,p) => !!p?.alive&&!impaired(g,p);
function log(g,text){g.events.push({id:crypto.randomUUID(),day:g.day,phase:g.phase,text});}
function tell(g,p,text,extra={}){p.inbox.push({id:crypto.randomUUID(),day:g.day,phase:g.phase,text,...extra});}
function audit(g,basis,result,reason){g.decisions.push({day:g.day,phase:g.phase,basis,result,reason});}

// This is an intentionally bounded heuristic, not a language model or a win predictor.
// It can only rank outcomes independently authorized by a character's ability.
function pressure(g){
 const living=live(g), good=living.filter(p=>!evil(p)), bad=living.filter(evil);
 const info=good.filter(p=>['empath','fortune_teller','undertaker','slayer'].includes(p.role)&&active(g,p)).length;
 const demon=living.find(p=>p.role==='imp');
 const suspicion=g.ballots.filter(b=>b.target===demon?.id).reduce((n,b)=>Math.max(n,b.count),0);
 return (living.length>5?0.15:-0.3)+info*0.2+(good.length-bad.length*2)*0.08+suspicion*0.12;
}
function favorEvil(g){return rand() < Math.max(.2,Math.min(.85,.55+pressure(g)*.25));}
function discretion(g,basis,truth,alternative){
 const chosen=favorEvil(g)?alternative:truth;
 audit(g,basis,chosen,`Legal choice; balance score ${pressure(g).toFixed(2)}. Weighted variety preserves uncertainty.`);
 return chosen;
}
function alignment(g,p){
 if(!impaired(g,p)&&p.role==='spy') return discretion(g,'Spy alignment registration',true,false);
 if(!impaired(g,p)&&p.role==='recluse') return discretion(g,'Recluse alignment registration',false,true);
 return evil(p);
}
function seenRole(g,p){
 if(!impaired(g,p)&&p.role==='spy') return discretion(g,'Spy character registration',p.role,ROLES[p.claim]?.type==='townsfolk'||ROLES[p.claim]?.type==='outsider'?p.claim:pick(ofType('townsfolk')));
 if(!impaired(g,p)&&p.role==='recluse') return discretion(g,'Recluse character registration',p.role,pick([...ofType('minion'),'imp']));
 return p.role;
}
function numberInfo(g,p,n,max){return impaired(g,p)?discretion(g,`${label(p.shown)}: impaired information`,n,pick(Array.from({length:max+1},(_,i)=>i).filter(x=>x!==n))):n;}
function roleInfo(g,p,target){const truth=seenRole(g,target);return impaired(g,p)?discretion(g,`${label(p.shown)}: impaired information`,truth,evil(target)?(target.claim||pick(ofType('townsfolk'))):pick(ofType('minion'))):truth;}
export function newGame(code,name,session){
 const p={id:crypto.randomUUID(),session,name,alive:true,ghost:true,inbox:[],claim:'',ready:false};
 return {code,host:p.id,players:[p],phase:'lobby',day:0,events:[],messages:[],decisions:[],ballots:[],queue:[],pending:null,poison:null,protection:null,nightDeaths:[],deadline:null,paused:false,settings:{daySeconds:240,voteSeconds:40},created:Date.now()};
}
export function join(g,name,session){
 const existing=g.players.find(p=>p.session===session);if(existing)return existing;
 assert(g.phase==='lobby','This game has already started.');assert(g.players.length<15,'This table is full.');
 assert(!g.players.some(p=>p.name.toLowerCase()===name.toLowerCase()),'That name is already seated.');
 const p={id:crypto.randomUUID(),session,name,alive:true,ghost:true,inbox:[],claim:'',ready:false};g.players.push(p);return p;
}
export function start(g,forcedRoles){
 assert(COUNTS[g.players.length],'Gather 5–15 players to begin.');
 let [t,o,m]=COUNTS[g.players.length];
 const minions=shuffle(ofType('minion')).slice(0,m);if(minions.includes('baron')){t-=2;o+=2;}
 const bag=forcedRoles||shuffle([...shuffle(ofType('townsfolk')).slice(0,t),...shuffle(ofType('outsider')).slice(0,o),...minions,'imp']);
 const drunkShown=pick(ofType('townsfolk').filter(r=>!bag.includes(r)));
 g.players.forEach((p,i)=>{p.role=bag[i];p.initialRole=p.role;p.shown=p.role==='drunk'?drunkShown:p.role;p.initialShown=p.shown;p.alive=true;p.ghost=true;p.slayerUsed=false;p.virginUsed=false;p.inbox=[];});
 g.redHerring=pick(g.players.filter(p=>!evil(p))).id;
 g.bluffs=shuffle([...ofType('townsfolk'),...ofType('outsider')].filter(r=>!g.players.some(p=>p.role===r||p.shown===r))).slice(0,3);
 if(g.players.length>=7){
  const demon=g.players.find(p=>p.role==='imp'),mins=g.players.filter(p=>ROLES[p.role].type==='minion');
  tell(g,demon,`Your Minions: ${mins.map(p=>p.name).join(', ')}. Safe bluffs: ${g.bluffs.map(label).join(', ')}.`);
  mins.forEach(p=>tell(g,p,`The Demon is ${demon.name}. Other Minions: ${mins.filter(x=>x!==p).map(x=>x.name).join(', ')||'none'}.`));
 }
 audit(g,'Setup','Roles assigned, fixed red herring, and bluffs chosen','Standard population counts; Baron replaces two Townsfolk. Drunk receives an unused Townsfolk identity.');
 beginNight(g);
}
function win(g,team,reason){g.phase='ended';g.winner=team;g.reason=reason;g.pending=null;g.deadline=null;log(g,`${team==='good'?'Good':'Evil'} wins. ${reason}`);}
function checkWin(g){if(!live(g).some(p=>p.role==='imp'))win(g,'good','No living Demon remains.');else if(live(g).length<=2)win(g,'evil','Only two players remain alive.');}
export function kill(g,p,cause,selfKill=false){
 if(!p.alive)return false;
 const before=live(g).length,wasRole=p.role,wasActive=active(g,p);
 // Check succession before removing poison or any other dying-source effect.
 const successor=before>=5?g.players.find(x=>x.role==='scarlet_woman'&&active(g,x)):null;
 p.alive=false;
 if(cause==='night'){g.nightDeaths.push(p.id);if(p.shown==='ravenkeeper')g.queue.unshift({id:p.id,role:'ravenkeeper',deathTrigger:true});}
 if(cause==='execution'){g.executedDeath=p.id;if(wasRole==='saint'&&wasActive){win(g,'evil','The Saint died by execution.');return true;}}
 if(wasRole==='imp'){
  let next=successor;
  if(!next&&selfKill)next=pick(g.players.filter(x=>x.alive&&ROLES[x.role].type==='minion'));
  if(next){audit(g,selfKill?'Imp self-kill / Scarlet Woman succession':'Scarlet Woman mandatory succession',next.name,'Successor chosen before victory check; new Imp does not attack again this night.');next.role='imp';next.shown='imp';tell(g,next,'You are now the Imp. You remain evil.');}
 }
 checkWin(g);return true;
}
function protectedFromDemon(g,p){const source=player(g,g.protection?.source);return (p.role==='soldier'&&active(g,p))||(g.protection?.target===p.id&&source?.role==='monk'&&active(g,source));}
function attack(g,imp,target){
 if(!active(g,imp)||!target.alive||protectedFromDemon(g,target))return;
 if(target.role==='mayor'&&active(g,target)){
  const helpEvil=favorEvil(g);
  // Never select the Demon as a bounce: the policy should not award itself the win.
  let candidates=g.players.filter(p=>p.id!==target.id&&p.role!=='imp');
  if(helpEvil)candidates=candidates.filter(p=>p.alive&&!evil(p));
  else {const useful=candidates.filter(p=>!p.alive||evil(p)||p.role==='ravenkeeper'||protectedFromDemon(g,p));if(useful.length)candidates=useful;}
  const redirect=live(g).length>3&&rand()<.85?pick(candidates):null;
  audit(g,'Mayor night redirection',redirect?.name||'No redirect',`Legal optional redirect; balance score ${pressure(g).toFixed(2)}. Never deliberately bounce onto the Demon.`);
  if(redirect){target=redirect;if(!target.alive||protectedFromDemon(g,target))return;}
 }
 kill(g,target,'night',target.id===imp.id);
}
function firstInfo(g,p){
 const wanted={washerwoman:'townsfolk',librarian:'outsider',investigator:'minion'}[p.shown];
 const truth=g.players.filter(x=>ROLES[x.role].type===wanted);
 let candidates=truth.map(x=>({target:x,role:x.role}));
 if(wanted==='townsfolk'||wanted==='outsider')g.players.filter(x=>x.role==='spy'&&!impaired(g,x)).forEach(x=>candidates.push({target:x,role:pick(ofType(wanted))}));
 if(wanted==='minion')g.players.filter(x=>x.role==='recluse'&&!impaired(g,x)).forEach(x=>candidates.push({target:x,role:pick(ofType('minion'))}));
 if(wanted==='outsider'&&truth.length===0&&!impaired(g,p)){tell(g,p,'You learn: there are 0 Outsiders.');return;}
 let chosen=pick(candidates);
 if(impaired(g,p)&&favorEvil(g)){chosen={target:pick(g.players.filter(x=>x.id!==p.id)),role:pick(ofType(wanted))};audit(g,`${label(p.shown)}: impaired information`,`${chosen.target.name} / ${label(chosen.role)}`,'An arbitrary pairing is legal while impaired.');}
 if(!chosen){tell(g,p,'You learn: there are 0 Outsiders.');return;}
 const decoy=pick(g.players.filter(x=>x.id!==p.id&&x.id!==chosen.target.id));
 const pair=shuffle([chosen.target,decoy]);
 audit(g,`${label(p.shown)} initial pairing`,`${pair.map(x=>x.name).join(' / ')}: ${label(chosen.role)}`,'A legal actual or misregistering match is required unless the recipient is impaired.');
 tell(g,p,`One of ${pair[0].name} and ${pair[1].name} is the ${label(chosen.role)}.`);
}
function automatic(g,p,role){
 if(['washerwoman','librarian','investigator'].includes(role)){firstInfo(g,p);return;}
 if(role==='chef'){
  let n=0;g.players.forEach((a,i)=>{const b=g.players[(i+1)%g.players.length];if(alignment(g,a)&&alignment(g,b))n++;});
  tell(g,p,`You learn: ${numberInfo(g,p,n,g.players.length)} neighboring evil pair(s).`);
 }else if(role==='empath'){
  const living=live(g),i=living.indexOf(p);const neighbors=[living[(i+living.length-1)%living.length],living[(i+1)%living.length]];
  const n=neighbors.filter(x=>alignment(g,x)).length;tell(g,p,`You learn: ${numberInfo(g,p,n,2)} evil living neighbor(s).`);
 }else if(role==='undertaker'){
  const target=player(g,g.executedDeath);if(target)tell(g,p,`The player who died by execution was the ${label(roleInfo(g,p,target))}.`);
 }else if(role==='spy'){
  const grim=g.players.map(x=>({name:x.name,role:x.role,shown:x.shown,alive:x.alive,poisoned:poisoned(g,x),redHerring:g.redHerring===x.id,protected:g.protection?.target===x.id,master:player(g,x.master)?.name||null,slayerUsed:x.slayerUsed,virginUsed:x.virginUsed}));
  if(impaired(g,p)){const a=pick(grim),b=pick(grim.filter(x=>x!==a));[a.role,b.role]=[b.role,a.role];audit(g,'Poisoned Spy grimoire','Two character labels exchanged','The Spy has no functioning ability while poisoned.');}
  tell(g,p,'Your Grimoire snapshot.',{grimoire:grim,bluffs:g.bluffs.map(label)});
 }
}
export function beginNight(g){
 g.phase='night';g.day++;g.deadline=null;g.poison=null;g.protection=null;g.nightDeaths=[];g.pending=null;g.ready=[];
 g.players.forEach(p=>{p.ready=false;p.nominated=false;p.nominator=false;p.publicAlive=p.alive;});
 const order=g.day===1?['poisoner','spy','washerwoman','librarian','investigator','chef','empath','fortune_teller','butler']:['poisoner','monk','spy','imp','undertaker','empath','fortune_teller','butler'];
 g.queue=order.flatMap(role=>g.players.filter(p=>p.shown===role).map(p=>({id:p.id,role})));
 log(g,`Night ${g.day} falls. Check your private Storyteller panel.`);advanceNight(g);
}
export function advanceNight(g){
 while(g.phase==='night'&&!g.pending&&g.queue.length){
  const item=g.queue.shift(),p=player(g,item.id);if(!p||(p.shown!==item.role)||(!p.alive&&!item.deathTrigger))continue;
  if(['poisoner','monk','imp','fortune_teller','butler','ravenkeeper'].includes(item.role)){
   g.pending={...item,key:crypto.randomUUID(),count:item.role==='fortune_teller'?2:1,notSelf:['monk','butler'].includes(item.role)};
  }else automatic(g,p,item.role);
 }
 if(g.phase==='night'&&!g.pending&&!g.queue.length){
  g.phase='day';g.protection=null;g.players.forEach(p=>p.publicAlive=p.alive);g.ballots=[];g.nomination=null;g.executedDeath=null;g.executionOccurred=false;g.deadline=Date.now()+g.settings.daySeconds*1000;
  log(g,g.nightDeaths.length?`Dawn breaks. ${g.nightDeaths.map(id=>player(g,id).name).join(', ')} died in the night.`:'Dawn breaks. Nobody died in the night.');
 }
}
function nightChoice(g,p,data){
 const q=g.pending;assert(q?.id===p.id&&q.key===data.key,'That night action is no longer waiting.');
 assert(Array.isArray(data.targets)&&data.targets.length===q.count&&new Set(data.targets).size===q.count,'Choose the required number of different players.');
 const targets=data.targets.map(id=>player(g,id));assert(targets.every(Boolean),'Choose seated players.');assert(!q.notSelf||targets.every(x=>x.id!==p.id),'Choose another player.');
 const t=targets[0];g.pending=null;
 if(q.role==='poisoner'&&active(g,p))g.poison={source:p.id,target:t.id};
 if(q.role==='monk'&&active(g,p))g.protection={source:p.id,target:t.id};
 if(q.role==='imp')attack(g,p,t);
 if(q.role==='butler')p.master=t.id;
 if(q.role==='fortune_teller'){
  let yes=targets.some(x=>x.role==='imp'||x.id===g.redHerring);
  if(!yes&&targets.some(x=>x.role==='recluse'&&!impaired(g,x)))yes=discretion(g,'Recluse Demon registration',false,true);
  if(impaired(g,p))yes=discretion(g,'Fortune Teller: impaired information',yes,!yes);
  tell(g,p,`${targets.map(x=>x.name).join(' + ')}: ${yes?'YES':'NO'}.`);
 }
 if(q.role==='ravenkeeper')tell(g,p,`${t.name} is the ${label(roleInfo(g,p,t))}.`);
 if(['poisoner','monk','imp','butler'].includes(q.role))tell(g,p,`Your choice: ${t.name}.`);
 advanceNight(g);
}
function execute(g,target){
 g.executionOccurred=true;g.executedDeath=null;log(g,`${target.name} is executed.`);kill(g,target,'execution');
 if(g.phase!=='ended')beginNight(g);
}
export function endDay(g){
 if(g.phase!=='day'||g.nomination)return;
 const max=Math.max(0,...g.ballots.map(b=>b.count));const best=g.ballots.filter(b=>b.count===max&&b.qualified);
 if(best.length===1){execute(g,player(g,best[0].target));return;}
 log(g,'The day ends without an execution.');
 // Mayor checks the concluding day before Poisoner's effect expires for the next night.
 if(live(g).length===3&&g.players.some(p=>p.role==='mayor'&&active(g,p))){win(g,'good','The Mayor survived to dusk with three alive and no execution.');return;}
 g.executedDeath=null;beginNight(g);
}
function finishVote(g){
 const n=g.nomination;let count=0;const votes=[];
 for(let i=1;i<=g.players.length;i++){
  const p=g.players[(g.players.findIndex(x=>x.id===n.target)+i)%g.players.length];
  const yes=!!n.hands[p.id]&&(p.alive||p.ghost);
  if(yes){count++;if(!p.alive)p.ghost=false;}
  votes.push({id:p.id,yes});
 }
 const qualified=count>=Math.ceil(live(g).length/2);
 g.ballots.push({target:n.target,count,qualified,votes,day:g.day});
 log(g,`${player(g,n.target).name}: ${count} vote${count===1?'':'s'}${qualified?'':' — below the execution threshold'}.`);
 g.nomination=null;g.deadline=Date.now()+Math.max(30000,n.remaining);
}
export function tick(g,now=Date.now()){
 if(g.paused||g.phase!=='day')return false;
 if(g.nomination&&now>=g.nomination.deadline){finishVote(g);return true;}
 if(!g.nomination&&g.deadline&&now>=g.deadline){endDay(g);return true;}return false;
}
export function act(g,session,data){
 const p=g.players.find(x=>x.session===session);assert(p,'Join this room first.');
 const t=player(g,data.target);
 if(data.type==='chat'){
  assert(g.phase!=='night','The town is asleep. Save your conversations for dawn.');
  const text=String(data.text||'').trim();assert(text.length>0&&text.length<=1000,'Write 1–1000 characters.');
  assert(Date.now()-(p.lastMessage||0)>750,'Please wait a moment before sending again.');
  if(data.to)assert(player(g,data.to),'Choose a seated player.');
  g.messages.push({id:crypto.randomUUID(),from:p.id,to:data.to||null,text,at:Date.now()});g.messages=g.messages.slice(-500);p.lastMessage=Date.now();return;
 }
 if(data.type==='leave'){assert(g.phase==='lobby','Keep your seat during a game. You can reconnect in this browser.');g.players=g.players.filter(x=>x!==p);if(g.host===p.id)g.host=g.players[0]?.id;return;}
 if(data.type==='settings'){assert(g.phase==='lobby'&&p.id===g.host,'Only the host can set lobby options.');assert([120,240,360,600].includes(data.daySeconds),'Choose a supported day duration.');g.settings.daySeconds=data.daySeconds;return;}
 if(data.type==='start'){assert(g.phase==='lobby'&&p.id===g.host,'Only the host can start from the lobby.');start(g);return;}
 if(data.type==='pause'){
  assert(p.id===g.host&&g.phase==='day','Only the host can pause daytime.');
  if(!g.paused){g.paused=true;g.pausedAt=Date.now();}else{const delta=Date.now()-g.pausedAt;g.paused=false;if(g.deadline)g.deadline+=delta;if(g.nomination)g.nomination.deadline+=delta;}return;
 }
 if(data.type==='night'){assert(g.phase==='night','It is not night.');nightChoice(g,p,data);return;}
 assert(g.phase==='day'&&!g.paused,'Wait for an active day.');
 if(data.type==='claim'){assert(data.role===''||ROLES[data.role],'Choose a script character.');p.claim=data.role;return;}
 if(data.type==='ready'){
  assert(!g.nomination,'Finish the current vote first.');p.ready=!p.ready;
  if(live(g).every(x=>x.ready))endDay(g);return;
 }
 if(data.type==='nominate'){
  assert(!g.nomination,'A nomination is already in progress.');assert(p.alive&&!p.nominator,'You can nominate once per day while alive.');assert(t&&!t.nominated,'That player has already been nominated today.');
  p.nominator=true;t.nominated=true;g.players.forEach(x=>x.ready=false);
  log(g,`${p.name} nominates ${t.name}.`);
  if(t.shown==='virgin'&&t.alive&&!t.virginUsed){
   t.virginUsed=true;let townsfolk=ROLES[p.role].type==='townsfolk';
   if(p.role==='spy'&&!impaired(g,p))townsfolk=discretion(g,'Spy registration to Virgin',false,true);
   if(t.role==='virgin'&&active(g,t)&&townsfolk){execute(g,p);return;}
  }
  g.nomination={id:crypto.randomUUID(),target:t.id,by:p.id,hands:{},deadline:Date.now()+g.settings.voteSeconds*1000,remaining:Math.max(0,g.deadline-Date.now())};return;
 }
 if(data.type==='vote'){
  assert(g.nomination?.id===data.nomination,'This vote has ended.');assert(p.alive||p.ghost,'Your ghost vote has been spent.');
  // All votes are public raised hands until the count, so the Butler can follow a master.
  // As the official almanac directs, accidental illegal votes count, with a private reminder.
  if(data.yes&&p.role==='butler'&&active(g,p)&&!g.nomination.hands[p.master])tell(g,p,'Butler reminder: you may only keep your hand raised if your master is voting. Please lower it if they are not.');
  g.nomination.hands[p.id]=!!data.yes;return;
 }
 if(data.type==='slayer'){
  assert(!g.nomination,'Use a Slayer claim between nominations.');assert(t,'Choose a seated player.');assert(!p.slayerUsed,'You have already made your public Slayer shot.');
  p.slayerUsed=true;log(g,`${p.name} claims Slayer and shoots ${t.name}.`);
  let demon=t.role==='imp';if(t.role==='recluse'&&!impaired(g,t))demon=discretion(g,'Recluse registration to Slayer',false,true);
  if(p.role==='slayer'&&active(g,p)&&demon&&t.alive){log(g,`${t.name} dies.`);kill(g,t,'slayer');}else log(g,'Nothing happens.');return;
 }
 throw new Error('Unknown action.');
}
export function view(g,session){
 const me=g.players.find(p=>p.session===session);assert(me,'Join this room first.');
 const ended=g.phase==='ended';
 return {code:g.code,host:g.host,phase:g.phase,day:g.day,settings:g.settings,paused:g.paused,deadline:g.deadline,now:Date.now(),winner:g.winner,reason:g.reason,
 players:g.players.map(p=>({id:p.id,name:p.name,alive:g.phase==='night'?p.publicAlive:p.alive,ghost:p.ghost,claim:p.claim,ready:p.ready,nominated:p.nominated,nominator:p.nominator,...(ended?{role:p.role,initialRole:p.initialRole,shown:p.initialShown}: {})})),
 me:{id:me.id,role:me.shown,slayerUsed:me.slayerUsed,master:me.master,inbox:me.inbox},
 pending:g.pending?.id===me.id?g.pending:null,events:g.events,ballots:g.ballots,nomination:g.nomination?{id:g.nomination.id,target:g.nomination.target,by:g.nomination.by,hands:g.nomination.hands,deadline:g.nomination.deadline}:null,
 messages:g.messages.filter(m=>!m.to||m.from===me.id||m.to===me.id),
 ...(ended?{decisions:g.decisions,redHerring:player(g,g.redHerring)?.name,bluffs:g.bluffs.map(label)}:{})};
}
