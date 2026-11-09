import { ROLES } from './characters.mjs';
import { readStatement } from './gossip.mjs';

export const COUNTS = {5:[3,0,1],6:[3,1,1],7:[5,0,1],8:[5,1,1],9:[5,2,1],10:[7,0,2],11:[7,1,2],12:[7,2,2],13:[9,0,3],14:[9,1,3],15:[9,2,3]};
const ids = Object.keys(ROLES);
const ofType = type => ids.filter(id => ROLES[id].type === type && ROLES[id].script === 'tb');
const moonType = type => ids.filter(id => ROLES[id].type === type && ROLES[id].script === 'bmr');
const moon = g => g.settings.script === 'bmr';
const rand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
const pick = a => a[Math.floor(rand()*a.length)];
const shuffle = a => { a=[...a]; for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
const assert = (v,m) => {if(!v) throw new Error(m);};
const live = g => g.players.filter(p=>p.alive);
const player = (g,id) => g.players.find(p=>p.id===id);
const evil = p => p.aligned ? p.aligned==='evil' : ['minion','demon'].includes(ROLES[p.role]?.type);
const isDemon = p => ROLES[p.role]?.type==='demon';
const label = id => ROLES[id]?.name || id;
export function poisoned(g,p) {const s=player(g,g.poison?.source);return !!((s?.alive||s?.zombuulUp) && ['poisoner','pukka'].includes(s.role) && g.poison.target===p.id);}
export function impaired(g,p) {return p.role==='drunk'||poisoned(g,p)||g.drunks.some(d=>d.id===p.id&&g.day<=d.until);}
const active = (g,p) => !!(p?.alive||p?.zombuulUp)&&!impaired(g,p);
function log(g,text){g.events.push({id:crypto.randomUUID(),day:g.day,phase:g.phase,text});}
function tell(g,p,text,extra={}){p.inbox.push({id:crypto.randomUUID(),day:g.day,phase:g.phase,text,...extra});}
function audit(g,basis,result,reason){g.decisions.push({day:g.day,phase:g.phase,basis,result,reason});}

// This is an intentionally bounded heuristic, not a language model or a win predictor.
// It can only rank outcomes independently authorized by a character's ability.
const INFO_ROLES=['empath','fortune_teller','undertaker','slayer','chambermaid','gossip','exorcist','gambler','professor'];
function pressure(g){
 const living=live(g), good=living.filter(p=>!evil(p)), bad=living.filter(evil);
 const info=good.filter(p=>INFO_ROLES.includes(p.role)&&active(g,p)).length;
 const demon=living.find(isDemon);
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
// A good identity an evil player could pass as, never the one the viewer already holds.
function goodCover(p,viewer){return ['townsfolk','outsider'].includes(ROLES[p.claim]?.type)&&p.claim!==viewer.shown?p.claim:pick(ofType('townsfolk').filter(r=>r!==viewer.shown));}
function seenRole(g,p,viewer){
 if(!impaired(g,p)&&p.role==='spy') return discretion(g,'Spy character registration',p.role,goodCover(p,viewer));
 if(!impaired(g,p)&&p.role==='recluse') return discretion(g,'Recluse character registration',p.role,pick([...ofType('minion'),'imp']));
 return p.role;
}
function numberInfo(g,p,n,max){return impaired(g,p)?discretion(g,`${label(p.shown)}: impaired information`,n,pick(Array.from({length:max+1},(_,i)=>i).filter(x=>x!==n))):n;}
function roleInfo(g,p,target){
 // Reading yourself must not expose a Drunk or give an impaired player a nonsense identity.
 if(target.id===p.id)return p.shown;
 const truth=seenRole(g,target,p);return impaired(g,p)?discretion(g,`${label(p.shown)}: impaired information`,truth,evil(target)?goodCover(target,p):pick(ofType('minion'))):truth;
}
const seat=(name,session,id=crypto.randomUUID())=>({id,session,name,alive:true,ghost:true,inbox:[],claim:'',ready:false});
const lobby=settings=>({phase:'lobby',day:0,events:[],messages:[],groups:[],decisions:[],ballots:[],queue:[],pending:null,poison:null,protection:null,nightDeaths:[],drunks:[],woke:[],innkeep:[],deadline:null,paused:false,settings});
export function newGame(code,name,session){
 const p=seat(name,session);
 return {code,host:p.id,players:[p],round:1,...lobby({daySeconds:240,voteSeconds:40,script:'tb'}),created:Date.now()};
}
export function join(g,name,session){
 const existing=g.players.find(p=>p.session===session);if(existing)return existing;
 assert(g.phase==='lobby','This game has already started.');assert(g.players.length<15,'This table is full.');
 assert(!g.players.some(p=>p.name.toLowerCase()===name.toLowerCase()),'That name is already seated.');
 const p=seat(name,session);g.players.push(p);return p;
}
function unseat(g,p){
 g.players=g.players.filter(x=>x!==p);
 g.groups.forEach(c=>{c.members=c.members.filter(id=>id!==p.id);});g.groups=g.groups.filter(c=>c.members.length);
 if(g.host===p.id)g.host=g.players[0]?.id;
}
// Back to the lobby in the same room: the code, link, host, seats and settings all carry over.
function rematch(g){
 const {code,host,players,round,settings,created,phase}=g;
 for(const key of Object.keys(g))delete g[key];
 Object.assign(g,{code,host,players:players.map(p=>seat(p.name,p.session,p.id)),round:round+1,...lobby(settings),created,interrupted:phase!=='ended'});
}
export function start(g,forcedRoles){
 assert(COUNTS[g.players.length],'Gather 5–15 players to begin.');
 delete g.interrupted;
 let [t,o,m]=COUNTS[g.players.length];
 const minions=shuffle(ofType('minion')).slice(0,m);if(minions.includes('baron')){t-=2;o+=2;}
 // A lone Townsfolk Washerwoman would have no other Townsfolk to learn about.
 const bag=moon(g)?moonBag(g,forcedRoles):forcedRoles||shuffle([...shuffle(ofType('townsfolk').filter(r=>t>1||r!=='washerwoman')).slice(0,t),...shuffle(ofType('outsider')).slice(0,o),...minions,'imp']);
 const drunkShown=pick(ofType('townsfolk').filter(r=>!bag.includes(r)));
 g.players.forEach((p,i)=>{p.role=bag[i];p.initialRole=p.role;p.shown=p.role==='drunk'?drunkShown:p.role==='lunatic'?bag.find(r=>ROLES[r].type==='demon'):p.role;p.initialShown=p.shown;p.alive=true;p.ghost=true;p.slayerUsed=false;p.virginUsed=false;p.inbox=[];});
 g.redHerring=pick(g.players.filter(p=>!evil(p))).id;
 // Nobody claims Drunk or Lunatic, and an Outsider bluff is a giveaway at a table with no Outsiders.
 const townsfolk=moon(g)?moonType('townsfolk'):ofType('townsfolk'),outsiders=(moon(g)?moonType('outsider'):ofType('outsider')).filter(r=>r!=='drunk'&&r!=='lunatic');
 g.bluffs=shuffle([...townsfolk,...(COUNTS[g.players.length][1]>0?outsiders:[])].filter(r=>!g.players.some(p=>p.role===r||p.shown===r))).slice(0,3);
 const demon=g.players.find(isDemon),mins=g.players.filter(p=>ROLES[p.role].type==='minion'),lunatic=g.players.find(p=>p.role==='lunatic');
 if(g.players.length>=7){
  tell(g,demon,`Your Minions: ${mins.map(p=>p.name).join(', ')}. Safe bluffs: ${g.bluffs.map(label).join(', ')}.`);
  mins.forEach(p=>tell(g,p,`The Demon is ${demon.name}. Other Minions: ${mins.filter(x=>x!==p).map(x=>x.name).join(', ')||'none'}.`));
  // A Lunatic gets a convincing but invented version of the same introduction.
  if(lunatic)tell(g,lunatic,`Your Minions: ${shuffle(g.players.filter(p=>p!==lunatic)).slice(0,mins.length).map(p=>p.name).join(', ')}. Safe bluffs: ${shuffle([...townsfolk,...outsiders]).slice(0,3).map(label).join(', ')}.`);
 }
 if(lunatic)tell(g,demon,`${lunatic.name} is the Lunatic and believes they are a Demon.`);
 audit(g,'Setup','Roles assigned, fixed red herring, and bluffs chosen','Standard population counts; Baron replaces two Townsfolk. Drunk receives an unused Townsfolk identity.');
 beginNight(g);
}
function win(g,team,reason){g.phase='ended';g.winner=team;g.reason=reason;g.pending=null;g.deadline=null;log(g,`${team==='good'?'Good':'Evil'} wins. ${reason}`);}
function checkWin(g){
 if(g.mastermindDay)return;
 // A Zombuul that appears dead is still alive for ending the game.
 const alive=g.players.filter(p=>p.alive||p.zombuulUp);
 if(!alive.some(isDemon))win(g,'good','No living Demon remains.');else if(alive.length<=2)win(g,'evil','Only two players remain alive.');
}
export function kill(g,p,cause,selfKill=false,by={}){
 if(!p.alive&&!p.zombuulUp)return false;
 if(moon(g)){
  const saved=spared(g,p,cause,by);
  if(saved){if(saved==='fool')p.foolUsed=true;audit(g,`${p.name} did not die`,saved,'Something protected them from this death.');return false;}
  if(p.role==='zombuul'&&!p.zombuulSpent&&active(g,p)&&!by.force){
   p.zombuulSpent=true;p.alive=false;p.zombuulUp=true;
   if(cause==='night')g.nightDeaths.push(p.id);
   if(g.phase==='day')g.diedToday=true;
   tell(g,p,'You appear dead to the town, but you live on. You still act at night.');return true;
  }
 }
 const wasDead=!p.alive,before=live(g).length,wasRole=p.role,wasActive=active(g,p);
 // Check succession before removing poison or any other dying-source effect.
 const successor=before>=5?g.players.find(x=>x.role==='scarlet_woman'&&active(g,x)):null;
 p.alive=false;p.zombuulUp=false;
 if(cause==='night'&&!wasDead){g.nightDeaths.push(p.id);if(p.shown==='ravenkeeper')g.queue.unshift({id:p.id,role:'ravenkeeper',deathTrigger:true});}
 if(moon(g))moonDeath(g,p,cause,by,wasActive);
 if(cause==='execution'){g.executedDeath=p.id;if(wasRole==='saint'&&wasActive){win(g,'evil','The Saint died by execution.');return true;}}
 if(wasRole==='imp'){
  let next=successor;
  if(!next&&selfKill)next=pick(g.players.filter(x=>x.alive&&ROLES[x.role].type==='minion'));
  if(next){audit(g,selfKill?'Imp self-kill / Scarlet Woman succession':'Scarlet Woman mandatory succession',next.name,'Successor chosen before victory check; new Imp does not attack again this night.');next.role='imp';next.shown='imp';tell(g,next,'You are now the Imp. You remain evil.');}
 }
 checkWin(g);return true;
}
function protectedFromDemon(g,p){const source=player(g,g.protection?.source);return (p.role==='soldier'&&active(g,p))||(g.protection?.target===p.id&&source?.role==='monk'&&active(g,source));}
// The Storyteller's read of the table decides whether a Mayor attack lands and where it goes if not.
function mayorRedirect(g,mayor){
 const decide=(target,why)=>{audit(g,'Mayor night redirection',target?.name||'No redirect',`${why} Balance score ${pressure(g).toFixed(2)}.`);return target;};
 const living=live(g).length;
 if(living<=3)return decide(null,'The Imp found the Mayor at the final three; the Storyteller does not overrule the endgame.');
 // Never select the Demon as a bounce: the policy should not award itself the win.
 const others=g.players.filter(p=>p.id!==mayor.id&&p.role!=='imp'),alive=others.filter(p=>p.alive);
 if(favorEvil(g)){
  if(living===4)return decide(null,'Evil needs help: another death would leave the Mayor one quiet day from winning.');
  const threats=alive.filter(p=>INFO_ROLES.includes(p.role)&&active(g,p)&&!p.slayerUsed);
  return threats.length?decide(pick(threats),'Evil needs help: the attack lands on a working information role.'):decide(null,'Evil needs help: nobody left is more dangerous than the Mayor.');
 }
 // Good needs help, so the night should cost them as little as possible.
 const tiers=[pressure(g)<0?alive.filter(evil):[],alive.filter(p=>p.role==='ravenkeeper'&&active(g,p)),others.filter(p=>!p.alive||protectedFromDemon(g,p)),alive.filter(p=>!evil(p)&&!INFO_ROLES.includes(p.role))];
 const best=tiers.find(t=>t.length);
 return best?decide(pick(best),'Good needs help: the attack lands where it costs them least.'):decide(null,'Good needs help, but no redirect would cost less than the Mayor.');
}
function attack(g,imp,target){
 if(!active(g,imp)||!target.alive||protectedFromDemon(g,target))return;
 if(target.role==='mayor'&&active(g,target)){
  const redirect=mayorRedirect(g,target);
  if(redirect){target=redirect;if(!target.alive||protectedFromDemon(g,target))return;}
 }
 kill(g,target,'night',target.id===imp.id);
}
function firstInfo(g,p){
 const wanted={washerwoman:'townsfolk',librarian:'outsider',investigator:'minion'}[p.shown];
 // The reader is never part of their own pairing and never learns their own character:
 // that teaches a real Washerwoman nothing and tells a Drunk exactly what they are.
 const others=g.players.filter(x=>x.id!==p.id),roles=ofType(wanted).filter(r=>r!==p.shown);
 let candidates=others.filter(x=>ROLES[x.role].type===wanted).map(x=>({target:x,role:x.role}));
 if(wanted==='townsfolk'||wanted==='outsider')others.filter(x=>x.role==='spy'&&!impaired(g,x)).forEach(x=>candidates.push({target:x,role:pick(roles)}));
 if(wanted==='minion')others.filter(x=>x.role==='recluse'&&!impaired(g,x)).forEach(x=>candidates.push({target:x,role:pick(roles)}));
 const lie=impaired(g,p)&&favorEvil(g);
 // Only a table with truly no Outsiders hears this; a Drunk Librarian's own seat still counts as one.
 if(wanted==='outsider'&&!lie&&!g.players.some(x=>ROLES[x.role].type==='outsider')){tell(g,p,'You learn: there are 0 Outsiders.');return;}
 let chosen=pick(candidates);
 if(lie||!chosen){chosen={target:pick(others),role:pick(roles)};audit(g,`${label(p.shown)}: impaired information`,`${chosen.target.name} / ${label(chosen.role)}`,'An arbitrary pairing is legal while impaired, or when no real match exists.');}
 const decoy=pick(others.filter(x=>x.id!==chosen.target.id));
 const pair=shuffle([chosen.target,decoy]);
 audit(g,`${label(p.shown)} initial pairing`,`${pair.map(x=>x.name).join(' / ')}: ${label(chosen.role)}`,'A legal actual or misregistering match is required unless the recipient is impaired.');
 tell(g,p,`One of ${pair[0].name} and ${pair[1].name} is the ${label(chosen.role)}.`);
}
function automatic(g,p,role){
 if(['washerwoman','librarian','investigator'].includes(role)){firstInfo(g,p);return;}
 if(role==='chef'){
  // Each seat registers once per reading, so one Recluse or Spy cannot count both ways.
  const seen=g.players.map(x=>alignment(g,x)),n=seen.filter((e,i)=>e&&seen[(i+1)%seen.length]).length;
  // False counts stay believable: k evil players can form at most k-1 neighboring pairs.
  tell(g,p,`You learn: ${numberInfo(g,p,n,g.players.filter(evil).length-1)} neighboring evil pair(s).`);
 }else if(role==='empath'){
  const living=live(g),i=living.indexOf(p);const neighbors=[living[(i+living.length-1)%living.length],living[(i+1)%living.length]];
  const n=neighbors.filter(x=>alignment(g,x)).length;tell(g,p,`You learn: ${numberInfo(g,p,n,Math.min(2,living.filter(evil).length))} evil living neighbor(s).`);
 }else if(role==='undertaker'){
  const target=player(g,g.executedDeath);if(target)tell(g,p,`The player who died by execution was the ${label(roleInfo(g,p,target))}.`);
 }else if(role==='spy'){
  const grim=g.players.map(x=>({name:x.name,role:x.role,shown:x.shown,alive:x.alive,poisoned:poisoned(g,x),redHerring:g.redHerring===x.id,protected:g.protection?.target===x.id,master:player(g,x.master)?.name||null,slayerUsed:x.slayerUsed,virginUsed:x.virginUsed}));
  if(impaired(g,p)){const a=pick(grim),b=pick(grim.filter(x=>x!==a));[a.role,b.role]=[b.role,a.role];audit(g,'Poisoned Spy grimoire','Two character labels exchanged','The Spy has no functioning ability while poisoned.');}
  tell(g,p,'Your Grimoire snapshot.',{grimoire:grim,bluffs:g.bluffs.map(label)});
 }
}
// Bad Moon Rising: everything below runs only when the table chose that script.
const MOON_FIRST=['sailor','courtier','godfather','devils_advocate','lunatic','pukka','grandmother','chambermaid'];
const MOON_OTHER=['sailor','innkeeper','courtier','gambler','devils_advocate','lunatic','exorcist','zombuul','pukka','shabaloth','po','assassin','godfather','gossip','tinker','moonchild','professor','chambermaid'];
const MOON_AUTO={1:['godfather','grandmother'],other:['gossip','tinker','moonchild']};
const MOON_DEMONS=['zombuul','pukka','shabaloth','po'];
function moonBag(g,forced){
 if(forced)return forced;
 let [t,o,m]=COUNTS[g.players.length];
 const minions=shuffle(moonType('minion')).slice(0,m);
 if(minions.includes('godfather')){const more=o===0||rand()<.5;o+=more?1:-1;t+=more?-1:1;audit(g,'Godfather setup',more?'One extra Outsider':'One fewer Outsider','The Godfather adds or removes one Outsider.');}
 return shuffle([...shuffle(moonType('townsfolk')).slice(0,t),...shuffle(moonType('outsider')).slice(0,o),...minions,pick(moonType('demon'))]);
}
const drunkUntil=(g,p,until)=>{g.drunks.push({id:p.id,until});};
function nearestLiving(g,p){
 const seats=g.players,at=seats.indexOf(p),found=[];
 for(const step of [1,-1])for(let i=1;i<seats.length;i++){const x=seats[(at+step*i+seats.length*i)%seats.length];if(x.alive){found.push(x);break;}}
 return found;
}
function teaLadyGuards(g,p){
 return g.players.some(x=>x.role==='tea_lady'&&active(g,x)&&x.alive&&nearestLiving(g,x).includes(p)&&nearestLiving(g,x).every(n=>!evil(n)));
}
// The reason this death is prevented, or null. Night causes stay free of side effects so the Gossip can test targets.
function spared(g,p,cause,by){
 if(by.force)return null;
 if(p.role==='sailor'&&active(g,p))return 'Sailor';
 if(cause==='night'&&g.innkeep.includes(p.id))return 'Innkeeper';
 if(teaLadyGuards(g,p))return 'Tea Lady';
 if(cause==='execution'){
  const source=player(g,g.advocate?.source);
  if(g.advocate?.target===p.id&&source?.role==='devils_advocate'&&active(g,source))return "Devil's Advocate";
  if(!evil(p)&&g.players.some(x=>x.role==='pacifist'&&active(g,x))&&rand()<.35&&!favorEvil(g))return 'Pacifist';
 }
 if(p.role==='fool'&&active(g,p)&&!p.foolUsed)return 'fool';
 return null;
}
function moonDeath(g,p,cause,by,wasActive){
 if(g.phase==='day'){g.diedToday=true;if(ROLES[p.role].type==='outsider')g.outsiderDied=true;}
 if(by.demon)g.players.filter(x=>x.role==='grandmother'&&x.grandchild===p.id&&active(g,x)).forEach(x=>kill(g,x,cause));
 if(p.role==='moonchild'&&wasActive){p.moonPending=true;tell(g,p,'You died. Publicly choose a living player: select their seat. If they are good, they die tonight.');}
 if(cause==='execution'){
  if(ROLES[p.role].type==='minion'&&g.players.some(x=>x.role==='minstrel'&&active(g,x)))g.players.filter(x=>x!==p).forEach(x=>drunkUntil(g,x,g.day+1));
  // Only an active Mastermind stops the game ending on the Demon's execution.
  if(isDemon(p)&&!g.players.some(x=>isDemon(x)&&(x.alive||x.zombuulUp))&&g.players.some(x=>x.role==='mastermind'&&active(g,x))){g.mastermindDay=g.day+1;audit(g,'Mastermind','One more day','The Demon died by execution with a Mastermind in play.');}
 }
}
function moonQueue(g){
 const first=g.day===1,auto=first?MOON_AUTO[1]:MOON_AUTO.other;
 return (first?MOON_FIRST:MOON_OTHER).flatMap(role=>role==='lunatic'?g.players.filter(p=>p.role==='lunatic').map(p=>({id:p.id,role:p.shown})):g.players.filter(p=>p.role===role).map(p=>({id:p.id,role,auto:auto.includes(role)})));
}
// What a player is asked for tonight, or null if they do not wake.
function moonPrompt(g,p,role){
 const later=g.day>1;
 if(role==='sailor')return {count:1,aliveOnly:true};
 if(role==='innkeeper')return later&&{count:2};
 if(role==='chambermaid')return {count:2,aliveOnly:true,notSelf:true};
 if(role==='exorcist')return later&&{count:1,notId:p.lastChoice||null};
 if(role==='gambler')return later&&{count:1,character:true};
 if(role==='courtier')return !p.abilityUsed&&{count:0,character:true,optional:true};
 if(role==='professor')return later&&!p.abilityUsed&&g.players.some(x=>!x.publicAlive)&&{count:1,deadOnly:true,optional:true};
 if(role==='devils_advocate')return {count:1,aliveOnly:true,notId:p.lastChoice||null};
 if(role==='assassin')return later&&!p.abilityUsed&&{count:1,optional:true};
 if(role==='godfather')return g.outsiderDied&&{count:1};
 if(role==='pukka')return {count:1};
 if(role==='zombuul')return later&&!g.diedToday&&{count:1};
 if(role==='shabaloth')return later&&{count:2};
 if(role==='po')return later&&{count:p.poCharged?3:1,optional:true};
 return null;
}
function moonAuto(g,p,role){
 if(role==='grandmother'){
  const child=pick(g.players.filter(x=>x!==p&&!evil(x)));p.grandchild=child.id;g.woke.push(p.id);
  const shown=impaired(g,p)?discretion(g,'Grandmother: impaired information',child.role,pick(moonType('townsfolk').filter(r=>r!==child.role&&r!=='grandmother'))):child.role;
  tell(g,p,`${child.name} is your grandchild, the ${label(shown)}.`);
 }else if(role==='godfather'){
  g.woke.push(p.id);
  let seen=g.players.filter(x=>ROLES[x.role].type==='outsider').map(x=>x.role);
  if(impaired(g,p))seen=discretion(g,'Godfather: impaired information',seen,shuffle(moonType('outsider')).slice(0,Math.max(1,seen.length)));
  tell(g,p,seen.length?`Outsiders in play: ${seen.map(label).join(', ')}.`:'There are no Outsiders in play.');
 }else if(role==='gossip'){
  const said=g.gossip;
  if(said?.by===p.id&&said.truth&&active(g,p)){
   // The Gossip should be able to tell the statement landed, so pick someone who will really die.
   const pool=live(g).filter(x=>x!==p&&!isDemon(x)&&!spared(g,x,'night',{})),good=pool.filter(x=>!evil(x)),info=good.filter(x=>INFO_ROLES.includes(x.role)),bad=pool.filter(evil);
   const target=favorEvil(g)?pick(info.length?info:good):pick(bad.length?bad:good);
   audit(g,'Gossip statement was true',target?.name||'Nobody could die',`Statement read as: ${said.reading}. Balance score ${pressure(g).toFixed(2)}.`);
   if(target)kill(g,target,'night');
  }else if(said?.by===p.id)audit(g,'Gossip statement',said.truth?'True, but the Gossip was impaired':'False',`Statement read as: ${said.reading}.`);
 }else if(role==='tinker'){
  if(active(g,p)&&favorEvil(g)&&rand()<.12){audit(g,'Tinker','Died',`The Tinker might die at any time. Balance score ${pressure(g).toFixed(2)}.`);kill(g,p,'night');}
 }else if(role==='moonchild'){
  const target=player(g,g.moonTarget?.target);
  if(g.moonTarget?.by===p.id&&target?.alive&&!evil(target)&&!impaired(g,p))kill(g,target,'night');
  if(g.moonTarget?.by===p.id)g.moonTarget=null;
 }
}
function moonSkip(g,p,q){if(q.role==='po'&&p.role==='po'&&active(g,p))p.poCharged=true;}
function moonResolve(g,p,q,targets,data){
 const real=p.role===q.role,t=targets[0];
 // The first player to choose a sober Goon is drunk before their ability resolves.
 const goon=real&&!g.goonChosen&&targets.find(x=>x.role==='goon'&&active(g,x));
 if(goon){g.goonChosen=true;drunkUntil(g,p,g.day);goon.aligned=evil(p)?'evil':'good';audit(g,'Goon chosen',`${p.name} is drunk until dusk`,`${goon.name} joined their team.`);}
 const on=real&&active(g,p);
 p.lastChoice=t?.id;
 if(p.role==='lunatic'){const demon=g.players.find(isDemon);if(demon&&(demon.alive||demon.zombuulUp)&&!impaired(g,p))tell(g,demon,`The Lunatic chose: ${targets.map(x=>x.name).join(', ')}.`);}
 if(['courtier','professor','assassin'].includes(q.role))p.abilityUsed=true;
 const demonKill=x=>kill(g,x,'night',false,{demon:true});
 switch(q.role){
  case 'sailor':if(on){
   const helpEvil=favorEvil(g),drunk=t===p||!evil(t)===helpEvil?(t===p?p:t):p;
   drunkUntil(g,drunk,g.day);audit(g,'Sailor',`${drunk.name} is drunk`,`Balance score ${pressure(g).toFixed(2)}.`);}break;
  case 'innkeeper':if(on){
   g.innkeep=targets.map(x=>x.id);
   const [good,other]=[targets.filter(x=>!evil(x)),targets.filter(evil)];
   const drunk=favorEvil(g)?pick(good.length?good:targets):pick(other.length?other:targets);
   drunkUntil(g,drunk,g.day);audit(g,'Innkeeper',`${drunk.name} is drunk`,`Balance score ${pressure(g).toFixed(2)}.`);}break;
  case 'chambermaid':{
   const n=targets.filter(x=>g.woke.includes(x.id)).length;
   tell(g,p,`${targets.map(x=>x.name).join(' + ')}: ${impaired(g,p)?discretion(g,'Chambermaid: impaired information',n,pick([0,1,2].filter(x=>x!==n))):n} woke tonight.`);break;}
  case 'exorcist':if(on&&isDemon(t)&&(t.alive||t.zombuulUp)){g.exorcised=t.id;tell(g,t,`The Exorcist is ${p.name}. You do not wake tonight.`);}break;
  case 'gambler':if(on&&t.role!==data.character)kill(g,p,'night');break;
  case 'courtier':if(on)g.players.filter(x=>x.role===data.character).forEach(x=>drunkUntil(g,x,g.day+2));break;
  case 'professor':if(on&&!t.alive&&ROLES[t.role].type==='townsfolk'){t.alive=true;t.ghost=true;g.risen=[...(g.risen||[]),t.id];}break;
  case 'devils_advocate':if(on)g.advocate={source:p.id,target:t.id};break;
  case 'assassin':if(on)kill(g,t,'night',false,{force:true});break;
  case 'godfather':if(on)kill(g,t,'night');break;
  case 'zombuul':if(on)demonKill(t);break;
  case 'pukka':if(on){const earlier=player(g,g.poison?.target);g.poison={source:p.id,target:t.id};if(earlier)demonKill(earlier);}break;
  case 'shabaloth':if(on){
   const back=(p.lastChosen||[]).map(id=>player(g,id)).filter(x=>x&&!x.alive);
   targets.forEach(demonKill);p.lastChosen=targets.map(x=>x.id);
   if(g.phase==='night'&&back.length&&!favorEvil(g)&&rand()<.3){const r=pick(back);r.alive=true;r.ghost=true;g.risen=[...(g.risen||[]),r.id];audit(g,'Shabaloth regurgitation',r.name,'A dead player chosen last night might come back.');}}break;
  case 'po':if(on){p.poCharged=false;targets.forEach(demonKill);}break;
 }
 if(q.role!=='chambermaid')tell(g,p,`Your choice: ${[...targets.map(x=>x.name),...(data.character?[label(data.character)]:[])].join(', ')}.`);
}
export function beginNight(g){
 g.phase='night';g.day++;g.deadline=null;if(!moon(g))g.poison=null;g.protection=null;g.nightDeaths=[];g.pending=null;g.ready=[];
 g.drunks=g.drunks.filter(d=>g.day<=d.until);g.woke=[];g.innkeep=[];g.exorcised=null;g.goonChosen=false;g.risen=[];g.tinkerAt=null;
 g.players.forEach(p=>{p.ready=false;p.nominated=false;p.nominator=false;p.publicAlive=p.alive;});
 const order=g.day===1?['poisoner','spy','washerwoman','librarian','investigator','chef','empath','fortune_teller','butler']:['poisoner','monk','spy','imp','undertaker','empath','fortune_teller','butler'];
 g.queue=moon(g)?moonQueue(g):order.flatMap(role=>g.players.filter(p=>p.shown===role).map(p=>({id:p.id,role})));
 log(g,`Night ${g.day} falls.`);advanceNight(g);
}
export function advanceNight(g){
 while(g.phase==='night'&&!g.pending&&g.queue.length&&moon(g)){
  const item=g.queue.shift(),p=player(g,item.id);
  if(!p)continue;
  if(item.auto){moonAuto(g,p,item.role);continue;}
  if(!(p.alive||p.zombuulUp)||g.exorcised===p.id||g.mastermindDay&&isDemon(p))continue;
  const prompt=moonPrompt(g,p,item.role);
  if(!prompt)continue;
  // Late in a game there may be too few legal targets; waiting on an impossible choice would freeze the night.
  if(prompt.count>g.players.filter(x=>(!prompt.notSelf||x!==p)&&(!prompt.aliveOnly||x.publicAlive)&&(!prompt.deadOnly||!x.publicAlive)&&x.id!==prompt.notId).length)continue;
  g.woke.push(p.id);g.pending={id:item.id,role:item.role,key:crypto.randomUUID(),...prompt};
 }
 while(g.phase==='night'&&!g.pending&&g.queue.length&&!moon(g)){
  const item=g.queue.shift(),p=player(g,item.id);if(!p||(p.shown!==item.role)||(!p.alive&&!item.deathTrigger))continue;
  if(['poisoner','monk','imp','fortune_teller','butler','ravenkeeper'].includes(item.role)){
   g.pending={...item,key:crypto.randomUUID(),count:item.role==='fortune_teller'?2:1,notSelf:['monk','butler'].includes(item.role)};
  }else automatic(g,p,item.role);
 }
 if(g.phase==='night'&&!g.pending&&!g.queue.length){
  g.phase='day';g.protection=null;g.players.forEach(p=>p.publicAlive=p.alive);g.ballots=[];g.nomination=null;g.executedDeath=null;g.executionOccurred=false;g.deadline=Date.now()+g.settings.daySeconds*1000;
  g.diedToday=false;g.outsiderDied=false;g.gossip=null;
  // A Tinker might die at any time, so the Storyteller may also pick a moment during the day.
  g.tinkerAt=moon(g)&&g.players.some(p=>p.role==='tinker'&&active(g,p))&&favorEvil(g)&&rand()<.12?Date.now()+rand()*g.settings.daySeconds*1000:null;
  log(g,g.nightDeaths.length?`Dawn breaks. ${g.nightDeaths.map(id=>player(g,id).name).join(', ')} died in the night.`:'Dawn breaks. Nobody died in the night.');
  const back=(g.risen||[]).filter(id=>player(g,id)?.alive).map(id=>player(g,id).name);
  if(back.length)log(g,`${back.join(', ')} has returned to life.`);
 }
}
function nightChoice(g,p,data){
 const q=g.pending;assert(q?.id===p.id&&q.key===data.key,'That night action is no longer waiting.');
 if(moon(g)&&q.optional&&data.skip){g.pending=null;moonSkip(g,p,q);advanceNight(g);return;}
 assert(Array.isArray(data.targets)&&data.targets.length===q.count&&new Set(data.targets).size===q.count,'Choose the required number of different players.');
 const targets=data.targets.map(id=>player(g,id));assert(targets.every(Boolean),'Choose seated players.');assert(!q.notSelf||targets.every(x=>x.id!==p.id),'Choose another player.');
 if(moon(g)){
  // Validate against who the town believes is alive, so a choice cannot reveal tonight's deaths.
  assert(!q.aliveOnly||targets.every(x=>x.publicAlive),'Choose a living player.');
  assert(!q.deadOnly||targets.every(x=>!x.publicAlive),'Choose a dead player.');
  assert(!q.notId||targets.every(x=>x.id!==q.notId),'Choose someone different from last night.');
  assert(!q.character||ROLES[data.character]?.script==='bmr','Choose a character from this script.');
  g.pending=null;moonResolve(g,p,q,targets,data);advanceNight(g);return;
 }
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
 g.executionOccurred=true;g.executedDeath=null;log(g,`${target.name} is executed.`);
 const lastDay=moon(g)&&g.mastermindDay===g.day;
 const died=kill(g,target,'execution');
 if(moon(g)&&!died&&target.alive)log(g,`${target.name} does not die.`);
 if(lastDay){win(g,evil(target)?'good':'evil',`The Mastermind's extra day: ${target.name} was executed and their team loses.`);return;}
 if(g.phase!=='ended')beginNight(g);
}
export function endDay(g){
 if(g.phase!=='day'||g.nomination)return;
 const max=Math.max(0,...g.ballots.map(b=>b.count));const best=g.ballots.filter(b=>b.count===max&&b.qualified);
 if(best.length===1){execute(g,player(g,best[0].target));return;}
 log(g,'The day ends without an execution.');
 if(moon(g)&&g.mastermindDay===g.day){win(g,'good',"The Mastermind's extra day ended with no execution.");return;}
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
 if(g.tinkerAt&&now>=g.tinkerAt){
  g.tinkerAt=null;
  const p=g.players.find(x=>x.role==='tinker'&&active(g,x));
  if(p){if(!spared(g,p,'day',{}))log(g,`${p.name} dies.`);audit(g,'Tinker','Chosen to die during the day',`The Tinker might die at any time. Balance score ${pressure(g).toFixed(2)}.`);kill(g,p,'day');return true;}
 }
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
  if(data.group)assert(g.groups.find(c=>c.id===data.group)?.members.includes(p.id),'You are not in that group.');
  else if(data.to)assert(player(g,data.to),'Choose a seated player.');
  if(data.statement){
   assert(moon(g)&&g.phase==='day'&&!g.paused,'Statements can only be made during an active day.');
   assert(!data.to&&!data.group,'A statement must be made in the Town square.');
   assert(p.alive,'Only living players can make a statement.');
   assert(p.statementDay!==g.day,'You have already made a statement today.');
   // Every statement is held to the same standard, so a bluffer's looks just like the Gossip's.
   const read=readStatement(text,g,p,{evil,impaired:x=>impaired(g,x),poisoned:x=>poisoned(g,x)});
   assert(read,'The Storyteller must be able to tell whether a statement is true or false. Try something definite, like "Ana is evil", "the Demon sits next to Bo" or "there are two Outsiders".');
   p.statementDay=g.day;
   if(p.role==='gossip')g.gossip={by:p.id,reading:read.reading,truth:read.truth};
  }
  // cid lets the sender match this message to the copy already showing on their screen.
  g.messages.push({id:crypto.randomUUID(),cid:typeof data.cid==='string'?data.cid.slice(0,40):null,from:p.id,to:data.group?null:data.to||null,group:data.group||null,statement:!!data.statement,text,at:Date.now()});g.messages=g.messages.slice(-500);p.lastMessage=Date.now();return;
 }
 if(data.type==='group'){
  assert(g.phase!=='night','The town is asleep. Save your conversations for dawn.');
  const title=String(data.title||'').trim();assert(title.length>0&&title.length<=30,'Name the group in 1–30 characters.');
  assert(Array.isArray(data.members),'Choose who to invite.');
  const members=[...new Set([p.id,...data.members])];assert(members.length>=3,'A group needs at least two other players. Use a whisper for one.');assert(members.every(id=>player(g,id)),'Choose seated players.');
  assert(g.groups.length<40,'This table has too many groups.');
  g.groups.push({id:crypto.randomUUID(),title,members});return;
 }
 if(data.type==='group_leave'){
  const c=g.groups.find(x=>x.id===data.group);assert(c?.members.includes(p.id),'You are not in that group.');
  c.members=c.members.filter(id=>id!==p.id);g.groups=g.groups.filter(x=>x.members.length);return;
 }
 if(data.type==='leave'){assert(g.phase==='lobby','Keep your seat during a game. You can reconnect in this browser.');unseat(g,p);return;}
 if(data.type==='kick'){assert(g.phase==='lobby'&&p.id===g.host,'Only the host can remove players, and only in the lobby.');assert(t&&t.id!==p.id,'Choose another seated player.');unseat(g,t);return;}
 if(data.type==='rematch'){assert(g.phase!=='lobby'&&p.id===g.host,'Only the host can send the table back to the lobby.');rematch(g);return;}
 if(data.type==='settings'){assert(g.phase==='lobby'&&p.id===g.host,'Only the host can set lobby options.');assert([120,180,240,360,600].includes(data.daySeconds),'Choose a supported day duration.');assert(data.script===undefined||['tb','bmr'].includes(data.script),'Choose a supported game mode.');g.settings.daySeconds=data.daySeconds;if(data.script)g.settings.script=data.script;return;}
 if(data.type==='start'){assert(g.phase==='lobby'&&p.id===g.host,'Only the host can start from the lobby.');start(g);return;}
 if(data.type==='pause'){
  assert(p.id===g.host&&g.phase==='day','Only the host can pause daytime.');
  if(!g.paused){g.paused=true;g.pausedAt=Date.now();}else{const delta=Date.now()-g.pausedAt;g.paused=false;if(g.deadline)g.deadline+=delta;if(g.nomination)g.nomination.deadline+=delta;if(g.tinkerAt)g.tinkerAt+=delta;}return;
 }
 if(data.type==='night'){assert(g.phase==='night','It is not night.');nightChoice(g,p,data);return;}
 assert(g.phase==='day'&&!g.paused,'Wait for an active day.');
 if(data.type==='claim'){assert(data.role===''||ROLES[data.role]?.script===g.settings.script,'Choose a script character.');p.claim=data.role;return;}
 if(data.type==='moonchild'){
  assert(p.moonPending,'You have no Moonchild choice to make.');assert(t?.alive,'Choose a living player.');
  p.moonPending=false;g.moonTarget={by:p.id,target:t.id};log(g,`${p.name} is the Moonchild and chooses ${t.name}.`);return;
 }
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
   // Registering as Townsfolk executes the Spy, so the evil-favoring choice is to not register.
   if(p.role==='spy'&&!impaired(g,p))townsfolk=discretion(g,'Spy registration to Virgin',true,false);
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
  assert(!moon(g),'There is no Slayer in this game mode.');assert(!g.nomination,'Use a Slayer claim between nominations.');assert(t,'Choose a seated player.');assert(!p.slayerUsed,'You have already made your public Slayer shot.');
  p.slayerUsed=true;log(g,`${p.name} claims Slayer and shoots ${t.name}.`);
  let demon=t.role==='imp';if(t.role==='recluse'&&!impaired(g,t))demon=discretion(g,'Recluse registration to Slayer',false,true);
  if(p.role==='slayer'&&active(g,p)&&demon&&t.alive){log(g,`${t.name} dies.`);kill(g,t,'slayer');}else log(g,'Nothing happens.');return;
 }
 throw new Error('Unknown action.');
}
export function view(g,session){
 const me=g.players.find(p=>p.session===session);assert(me,'Join this room first.');
 const ended=g.phase==='ended';
 const groups=g.groups.filter(c=>c.members.includes(me.id));
 return {code:g.code,round:g.round,interrupted:g.interrupted,host:g.host,phase:g.phase,day:g.day,settings:g.settings,paused:g.paused,deadline:g.deadline,now:Date.now(),winner:g.winner,reason:g.reason,
 players:g.players.map(p=>({id:p.id,name:p.name,alive:g.phase==='night'?p.publicAlive:p.alive,ghost:p.ghost,claim:p.claim,ready:p.ready,nominated:p.nominated,nominator:p.nominator,...(ended?{role:p.role,initialRole:p.initialRole,shown:p.initialShown,evil:evil(p)}: {})})),
 me:{id:me.id,role:me.shown,slayerUsed:me.slayerUsed,master:me.master,inbox:me.inbox,moonPending:!!me.moonPending,statementUsed:me.statementDay===g.day},
 // Night deaths stay hidden until dawn, when the same names are announced publicly.
 nightDeaths:g.phase==='day'?g.nightDeaths:[],pending:g.pending?.id===me.id?g.pending:null,events:g.events,ballots:g.ballots,nomination:g.nomination?{id:g.nomination.id,target:g.nomination.target,by:g.nomination.by,hands:g.nomination.hands,deadline:g.nomination.deadline}:null,
 groups,messages:g.messages.filter(m=>m.group?groups.some(c=>c.id===m.group):!m.to||m.from===me.id||m.to===me.id),
 ...(ended?{decisions:g.decisions,redHerring:player(g,g.redHerring)?.name,bluffs:g.bluffs.map(label)}:{})};
}
