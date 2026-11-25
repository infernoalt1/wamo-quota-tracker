'use client';
import {useState,useEffect,useRef,Fragment} from 'react';
import {Moon,Sun,Users,BookOpen,ArrowRight,ArrowLeft,Copy,Check,X,Send,LockKeyhole,Eye,EyeOff,Skull,Crown,Hand,Sparkles,ScrollText,Clock3,MessageCircle,LogOut,Pause,Play,Target,Hash,NotebookPen,User,Armchair,Plus,UserX,RotateCcw,Megaphone,Camera,Trophy,Store,Coins,Lock,Gift,Dices,Package} from 'lucide-react';
import {ROLES,ROLE_LIST,SCRIPTS,COUNTS} from '../lib/characters.mjs';
import {ITEMS,ITEM,KINDS,TIERS,UNLOCKS,POINTS,CHEST,GIFT} from '../lib/cosmetics.mjs';
const types={townsfolk:'Townsfolk',outsider:'Outsiders',minion:'Minions',demon:'Demon'};
function RoleIcon({id}){return <img className="role-icon" src={`/botc/icons/${id}.png`} alt="" draggable={false}/>;}
function Avatar({src,name}){return src?<img className="avatar-img" src={`/botc/api/game/avatar/${src}`} alt="" draggable={false}/>:(name||'').slice(0,2).toUpperCase();}
const prompts={poisoner:'Choose a player to poison',monk:'Choose another player to protect',imp:'Choose a player to attack',fortune_teller:'Choose two different players',butler:'Choose another player as your master',ravenkeeper:'You died tonight. Choose a player to learn their character',sailor:'Choose a living player. Either you or they will be drunk until dusk',innkeeper:'Choose two players who cannot die tonight',chambermaid:'Choose two other living players to see who woke tonight',exorcist:'Choose a player to exorcise',gambler:'Choose a player and guess their character',courtier:'You may choose a character to make drunk for three days',professor:'You may choose a dead player to bring back',devils_advocate:'Choose a living player to save from execution tomorrow',assassin:'You may choose a player to assassinate',godfather:'An Outsider died today. Choose a player to kill',zombuul:'Choose a player to kill',pukka:'Choose a player to poison',shabaloth:'Choose two players to kill',po:'You may choose who to kill',moonchild:'You died. Publicly choose a living player. If they are good, they die tonight'};
const emptySeats=Array.from({length:10},(_,i)=>({id:`empty-${i}`,name:`Seat ${String(i+1).padStart(2,'0')}`,empty:true,alive:true}));
const countdown=(end,now)=>{const n=Math.max(0,Math.ceil((end-now)/1000));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;};
const clock=at=>new Date(at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
// A request that never answers would otherwise stop this browser from updating at all.
const timed=()=>AbortSignal.timeout(10000);
const TIMED_OUT='The connection timed out. Please try again.';
const listNames=names=>names.length<2?names.join(''):`${names.slice(0,-1).join(', ')} and ${names[names.length-1]}`;
function useMedia(query){const [match,setMatch]=useState(()=>matchMedia(query).matches);useEffect(()=>{const m=matchMedia(query),on=()=>setMatch(m.matches);on();m.addEventListener('change',on);return()=>m.removeEventListener('change',on);},[query]);return match;}
function readLocal(key){try{return {read:{},dawn:0,inbox:0,...JSON.parse(localStorage.getItem(`rw_local_${key}`)||'{}'),code:key};}catch{return {read:{},dawn:0,inbox:0,code:key};}}
// With a `timer`, the clock in the middle of the table runs: its rim drains as the time runs out, and the hand
// points at the end of what is left.
function ClockArt({timer}){
 const turn=timer?timer.share*360:0;
 return <svg viewBox="0 0 200 200" className={`clock-art ${timer?`timed ${timer.kind}`:''}`} aria-hidden="true"><circle cx="100" cy="100" r="90"/>{timer&&<circle className="clock-rim" cx="100" cy="100" r="90" pathLength="100" strokeDasharray={`${(timer.share*100).toFixed(2)} 100`} transform="rotate(-90 100 100)"/>}<circle cx="100" cy="100" r="77"/>{Array.from({length:12},(_,i)=><line key={i} x1="100" y1="17" x2="100" y2={i%3===0?'28':'23'} transform={`rotate(${i*30} 100 100)`}/>)}{timer?<path className="clock-hand" d="M100 100V30" transform={`rotate(${turn.toFixed(1)} 100 100)`}/>:<path d="M100 50V100L132 121"/>}<circle cx="100" cy="100" r="4"/><path className="spire" d="M75 153V83L100 43L125 83V153M66 153H134M84 153V119H116V153"/></svg>;
}
// What is left of the day, or of the vote while one runs.
function dayTimer(g,now){
 if(g?.phase!=='day')return null;
 const voting=!!g.nomination,end=voting?g.nomination.deadline:g.deadline,total=(voting?g.settings.voteSeconds:g.settings.daySeconds)*1000;
 if(!end)return null;
 const left=Math.max(0,end-now);
 return {share:Math.min(1,left/total),kind:g.paused?'paused':voting?'voting':left<30000?'late':'day'};
}
function JournalEntry({item}){return <article className="journal-entry"><small>{item.day?`${item.phase==='day'?'Day':'Night'} ${item.day}`:'Before the story'}</small><p>{item.text}</p>{item.grimoire&&<details><summary>Open Grimoire snapshot</summary>{item.grimoire.map((p,i)=><div className="grim-row" key={i}><strong>{p.name}</strong><span>{ROLES[p.role]?.name}{p.role==='drunk'?` (${ROLES[p.shown]?.name})`:''}{!p.alive?' · dead':''}{p.poisoned?' · poisoned':''}{p.redHerring?' · red herring':''}{p.protected?' · protected':''}{p.master?` · master: ${p.master}`:''}{p.slayerUsed?' · shot spent':''}{p.virginUsed?' · Virgin used':''}</span></div>)}<p>Bluffs: {item.bluffs.join(', ')}</p></details>}</article>;}
function Finale({g,host,busy,onClose,onNewGame,onLog}){
 // A game the table voted to stop has no winner; a spectator has no team.
 const isEvil=p=>p.evil,called=!!g.called,good=g.winner==='good',mine=g.players.find(p=>p.id===g.me.id),won=!!mine&&!called&&isEvil(mine)!==good;
 const teams=[called||good,!(called||good)].map(showGood=>({good:showGood,players:g.players.filter(p=>isEvil(p)!==showGood)})).filter(t=>t.players.length);
 // Cards flip with the town first and the Demon last, whatever order they sit in on screen.
 const rank=p=>({minion:1,demon:2}[ROLES[p.initialRole]?.type]||0),order=[...g.players].sort((a,b)=>rank(a)-rank(b)),flipAt=p=>2000+order.indexOf(p)*450;
 const [done,setDone]=useState(false);
 useEffect(()=>{const t=setTimeout(()=>setDone(true),2700+order.length*450);return()=>clearTimeout(t);},[]);
 return <div className={`finale ${called?'called':good?'good':'evil'} ${done?'done':''}`} role="dialog" aria-modal="true" aria-label={called?'The game was called':`${good?'Good':'Evil'} wins`}><div className="finale-flash"/><div className="finale-inner">
  <ClockArt/>
  <span className="eyebrow">THE STORY ENDS</span>
  <h2>{called?'Every secret revealed':good?'Good triumphs':'Evil prevails'}</h2>
  <p className="finale-reason">{g.reason}</p>
  <p className="finale-you">{!mine?'You watched this game.':called?'Nobody wins a game ended by a vote.':won?'Your team won.':'Your team lost.'}</p>
  {g.record?.points?<div className="finale-points"><strong><Coins size={16}/>+{g.record.points.total} points</strong><span>{g.record.points.parts.map(([label,n])=>`${label} +${n}`).join(' · ')}</span></div>:g.record?.counted&&<p className="small">Saved to your leaderboard record.</p>}
  {teams.map(t=><section className="finale-team" key={t.good?'good':'evil'}><h3>{t.good?'The town':'The evil team'}</h3><div className="finale-cards">{t.players.map(p=><article className={`finale-card ${t.good?'good':'evil'} ${p.id===g.me.id?'you':''} ${rank(p)===2?'demon':''}`} key={p.id} style={{'--flip':`${flipAt(p)}ms`}}>
   <div className="finale-back"><ClockArt/></div>
   <div className="finale-face"><span className="finale-glyph"><RoleIcon id={p.initialRole}/></span>
   <div><strong>{p.name}{p.id===g.me.id&&<em> you</em>}</strong><span className="finale-role">{ROLES[p.initialRole].name}</span>
   {p.shown!==p.initialRole&&<small>Believed they were the {ROLES[p.shown]?.name}</small>}
   {p.evil&&ROLES[p.initialRole]?.type==='outsider'&&<small>Turned evil</small>}
   {p.role!==p.initialRole&&<small>Became the {ROLES[p.role]?.name}</small>}
   <small className="finale-fate">{p.alive?'Survived':<><Skull size={11}/>Died</>}</small></div></div>
  </article>)}</div></section>)}
  <p className="small">The game log shows what everyone chose each night and what the Storyteller told them.</p>
  <div className="finale-actions"><button className="secondary" autoFocus onClick={onClose}>See the table</button><button className="secondary" onClick={onLog}><ScrollText size={16}/>Game log</button>{host?<button className="primary" disabled={busy} onClick={onNewGame}>New game<ArrowRight size={17}/></button>:<span className="small">The host can start a new game at this link.</span>}{!done&&<button className="text-button" onClick={()=>setDone(true)}>Skip animation</button>}</div>
 </div></div>;
}
const mixed=list=>{const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
// The character reveal at the start of a game. It waits for a tap, so nobody nearby sees the character by accident.
// The spin and the turn of the card are flat 2D and driven by timers, not 3D transforms or CSS transitions,
// so they also work on school computers without graphics acceleration or with Windows animations turned off.
// The reel: a strip of character icons slides under a gold ring, slows down smoothly and stops on yours.
const REEL_CELL=96,REEL_STOP=30,REEL_MS=3600;
function RoleReveal({role,pool,waiting,onDone}){
 const [stage,setStage]=useState('cover'),[strip,setStrip]=useState([]),timers=useRef([]),frame=useRef(0),stripEl=useRef(null);
 const later=(fn,ms)=>timers.current.push(setTimeout(fn,ms));
 const stop=()=>{timers.current.forEach(clearTimeout);timers.current=[];cancelAnimationFrame(frame.current);};
 // Fetch every icon while the card is still face down, so the reel never shows a blank on a slow network.
 useEffect(()=>{pool.forEach(id=>{const img=new Image();img.src=`/botc/icons/${id}.png`;});return stop;},[]);
 function begin(){
  // Every player's reel has the same length and runs for the same time, whatever their character.
  const others=mixed(pool.filter(id=>id!==role));
  setStrip(Array.from({length:REEL_STOP+4},(_,i)=>i===REEL_STOP?role:others[i%others.length]));setStage('spin');
 }
 // Driven frame by frame from script rather than CSS transitions, so it runs the same on every computer.
 useEffect(()=>{
  if(stage!=='spin'||!stripEl.current)return;
  const el=stripEl.current,mid=el.parentElement.clientWidth/2,at=i=>mid-(i*REEL_CELL+REEL_CELL/2);
  const from=at(2),to=at(REEL_STOP),start=performance.now();
  const step=now=>{const t=Math.min(1,(now-start)/REEL_MS),eased=1-Math.pow(1-t,4);el.style.transform=`translateX(${from+(to-from)*eased}px)`;
   if(t<1)frame.current=requestAnimationFrame(step);else{setStage('land');later(()=>setStage('turn'),1100);later(()=>setStage('face'),1300);}};
  el.style.transform=`translateX(${from}px)`;frame.current=requestAnimationFrame(step);
  return()=>cancelAnimationFrame(frame.current);
 },[stage==='spin']);
 function skip(){stop();setStage('face');}
 const mine=ROLES[role],evil=['minion','demon'].includes(mine?.type);
 return <div className="reveal" role="dialog" aria-modal="true" aria-label="Your character"><div className="reveal-inner">
  <span className="eyebrow">{stage==='face'?'YOUR SECRET CHARACTER':'THE STORYTELLER DEALS'}</span>
  {stage==='cover'?<button className="reveal-card back" onClick={begin}><ClockArt/><strong>Tap to see your character</strong><small>Make sure nobody else can see your screen.</small></button>
  :stage==='face'?<div className={`reveal-card face ${evil?'evil':'good'}`}><span className="reveal-glyph"><RoleIcon id={role}/></span><h2>{mine?.name}</h2><span className={`reveal-team ${evil?'evil':'good'}`}>{mine?.type} · {evil?'evil':'good'}</span><p>{mine?.help}</p></div>
  :<button className={`reveal-card spin ${stage}`} onClick={skip} aria-label="Skip to your character">
    <span className="reveal-reel"><span className="reveal-strip" ref={stripEl}>{strip.map((id,i)=><span className={`reveal-cell ${i===REEL_STOP&&stage!=='spin'?'lit':''}`} key={i}><RoleIcon id={id}/></span>)}</span><span className="reveal-ring"/></span>
    <strong className="reveal-name">{stage==='spin'?' ':mine?.name}</strong>
   </button>}
  {waiting&&<small className="reveal-wait"><Moon size={13}/>The Storyteller is waiting for your first night choice.</small>}
  {stage==='face'?<button className="primary" autoFocus onClick={onDone}>Into the night<ArrowRight size={17}/></button>:stage==='cover'?<button className="text-button" onClick={onDone}>Not now</button>:<button className="text-button" onClick={skip}>Skip</button>}
 </div></div>;
}
// The end-of-game log, in the order things happened, grouped by night and day.
const phaseName=r=>r.day?`${r.phase==='night'?'Night':'Day'} ${r.day}`:'Before the first night';
function logLine(r){
 if(r.kind==='choice'){
  const as=ROLES[r.role]?.name||r.role,really=r.real!==r.role?`, really the ${ROLES[r.real]?.name||r.real}`:'';
  const what=r.skip?'used no ability':`chose ${listNames([...r.targets,...(r.character?[ROLES[r.character]?.name||r.character]:[])])}`;
  const notes=[r.state&&!(r.state==='drunk'&&r.real==='drunk')?r.state:'',r.auto?'ran out of time, so the Storyteller picked':''].filter(Boolean);
  return `${r.by} (${as}${really}) ${what}${notes.length?` · ${notes.join(' · ')}`:''}.`;
 }
 if(r.kind==='told')return `Storyteller → ${r.to}: ${r.text}`;
 if(r.kind==='storyteller')return `Storyteller decided · ${r.text}`;
 return r.text;
}
function GameLog({g}){
 const rows=g.timeline||[],groups=[];
 for(const r of rows){const name=phaseName(r);if(groups.at(-1)?.name!==name)groups.push({name,rows:[]});groups.at(-1).rows.push(r);}
 function download(){
  const text=[`Ravenswood · ${SCRIPTS[g.settings.script]} · room ${g.code}, game ${g.round}`,g.reason,'',...groups.flatMap(x=>[`— ${x.name} —`,...x.rows.map(r=>`${r.at?clock(r.at):''}  ${logLine(r)}`),''])].join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/plain'}));a.download=`ravenswood-${g.code}-game-${g.round}.txt`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
 }
 return <>
  <span className="eyebrow">THE WHOLE STORY</span><h2>Game log.</h2>
  <p>What everyone chose each night, what the Storyteller told each player, and everything the town saw. Whispers and private groups stay private.</p>
  <div className="log-legend"><span className="log-kind choice">Choice</span><span className="log-kind told">Told privately</span><span className="log-kind storyteller">Storyteller</span><span className="log-kind event">Public</span><button className="secondary compact" onClick={download}><ArrowRight size={14}/>Download as text</button></div>
  {groups.map((x,i)=><section className="log-phase" key={i}><h3 className="log-heading">{x.name}</h3>{x.rows.map((r,j)=><p className={`log-row ${r.kind}`} key={j}><time>{r.at?clock(r.at):''}</time><span>{logLine(r)}</span></p>)}</section>)}
 </>;
}
// How many of each character type a table of this size has, and what can change it.
const SETUP_CHANGES={tb:'The Baron adds two Outsiders, replacing two Townsfolk.',bmr:'The Godfather adds or removes one Outsider, with a Townsfolk making up the difference.'};
const setupLine=n=>{const c=COUNTS[n];return c&&`${n} players: ${c[0]} Townsfolk · ${plural(c[1],'Outsider')} · ${plural(c[2],'Minion')} · 1 Demon`;};
function SetupChart({script,players}){
 const sizes=Object.keys(COUNTS).map(Number),rows=[['Townsfolk',0],['Outsiders',1],['Minions',2],['Demon',3]];
 return <section className="setup-chart">
  <h3 className="log-heading">Who is in play</h3>
  {COUNTS[players]&&<p className="setup-now">{setupLine(players)}</p>}
  <div className="setup-scroll"><table><thead><tr><th scope="row">Players</th>{sizes.map(n=><th key={n} className={n===players?'now':''} scope="col">{n}</th>)}</tr></thead>
   <tbody>{rows.map(([label,i])=><tr key={label} className={`setup-${label.toLowerCase()}`}><th scope="row">{label}</th>{sizes.map(n=><td key={n} className={n===players?'now':''}>{i===3?1:COUNTS[n][i]}</td>)}</tr>)}</tbody></table></div>
  <p className="small">{SETUP_CHANGES[script]}</p>
 </section>;
}
function ChatRow({active,icon,look,title,preview,time,unread,dead,onClick}){return <button className={`chat-row ${active?'active':''} ${unread?'unread':''} ${dead?'dead':''}`} onClick={onClick}><span className={`chat-avatar${frameOf(look)}`}>{icon}</span><span className="chat-row-text"><span className="chat-row-top"><strong>{title}</strong>{time&&<time>{time}</time>}</span><span className="chat-row-bottom"><span className="chat-preview">{preview}</span>{unread>0&&<span className="badge" aria-label={`${unread} unread`}>{unread}</span>}</span></span></button>;}
// Shop decorations: a frame around the picture, a colour for the name, and a title.
const frameOf=look=>look?.frame?` framed frame-${look.frame}`:'';
function Face({className,src,name,look}){return <span className={`${className}${frameOf(look)}`}><Avatar src={src} name={name}/></span>;}
function Named({name,look}){return look?.color?<span className={`ink-${look.color}`}>{name}</span>:name;}
function Title({look}){const t=ITEM[look?.title];return t?<span className={`deco-title tier-${t.tier}`}>{t.name}</span>:null;}
// A chat picture opens the sender's profile, when they have one.
function ChatFace({who,name,onOpen}){const face=<Face className="chat-avatar" src={who?.avatar} name={name} look={who?.look}/>;return who?.account?<button className="face-button" onClick={()=>onOpen(who.account)} aria-label={`See ${name}'s profile`} title="See profile">{face}</button>:face;}
const pct=(wins,games)=>games?`${Math.round(wins/games*100)}%`:'–';
async function postJson(url,body){
 try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:timed()}),data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Please try again.');return data;}
 catch(e){throw new Error(e.name==='TimeoutError'?TIMED_OUT:e.message);}
}
// A treasure chest, drawn flat so its shake works on any computer.
function ChestArt({shaking}){return <svg viewBox="0 0 120 100" className={`chest-art ${shaking?'shaking':''}`} aria-hidden="true">
 <path className="chest-lid" d="M14 46C14 22 32 16 60 16S106 22 106 46Z"/>
 <rect className="chest-body" x="14" y="46" width="92" height="42" rx="4"/>
 <path className="chest-band" d="M14 54H106M36 17V88M84 17V88"/>
 <rect className="chest-lock" x="52" y="40" width="16" height="18" rx="3"/>
 <circle className="chest-keyhole" cx="60" cy="49" r="2.4"/>
</svg>;}
// Gifting points to someone, from their profile.
function GiftBox({to,onWallet}){
 const [open,setOpen]=useState(false),[amount,setAmount]=useState(50),[busy,setBusy]=useState(false),[msg,setMsg]=useState(null);
 async function send(){
  if(busy)return;setBusy(true);setMsg(null);
  try{const data=await postJson('/botc/api/game/shop/gift',{to,amount:Number(amount)});onWallet?.(data);setMsg({ok:true,text:`You sent ${to} ${data.sent.amount} points. You can gift ${data.gift.left} more today.`});setOpen(false);}
  catch(e){setMsg({ok:false,text:e.message});}finally{setBusy(false);}
 }
 return <div className="gift-box">
  {open?<form onSubmit={e=>{e.preventDefault();send();}}><label>Points<input type="number" inputMode="numeric" min={GIFT.min} max={GIFT.max} step="1" value={amount} onChange={e=>setAmount(e.target.value)}/></label><button className="primary compact" disabled={busy}><Gift size={14}/>Send to {to}</button><button type="button" className="text-button" onClick={()=>setOpen(false)}>Cancel</button></form>
  :<button className="secondary compact" onClick={()=>setOpen(true)}><Gift size={14}/>Gift points</button>}
  <small>{GIFT.min}–{GIFT.max} points at a time, up to {GIFT.daily} a day, to people you have played a recorded game with.</small>
  {msg&&<p className={`status-note ${msg.ok?'good':'error'}`}>{msg.ok?<Check size={15}/>:<X size={15}/>}<span>{msg.text}</span></p>}
 </div>;
}
// Spectators can bet points on which team wins the game they are watching.
function BetPanel({bets,loggedIn,busy,onBet,onLogin}){
 const [team,setTeam]=useState('good'),[stake,setStake]=useState(50),total=bets.pool.good+bets.pool.evil,n=Number(stake)||0;
 return <section className="bet-panel">
  <span className="eyebrow"><Dices size={13}/>SPECTATOR BETS</span>
  <div className="bet-pool" title={`${bets.count} bet${bets.count===1?'':'s'} so far`}><span className="good">Good {bets.pool.good}</span><i style={{'--good':total?bets.pool.good/total:.5}}/><span className="evil">{bets.pool.evil} Evil</span></div>
  {bets.mine?<p>You bet <b>{bets.mine.stake}</b> on <b className={bets.mine.team}>{bets.mine.team}</b>. If you are right, you get {bets.mine.stake*2} back.</p>
  :!bets.open?<p className="small">Bets closed when Day 2 began.</p>
  :!loggedIn?<><p className="small">Log in to bet points on which team wins.</p><button className="secondary compact" onClick={onLogin}>Log in</button></>
  :<>
   <div className="bet-teams" role="group" aria-label="Team"><button className={`good ${team==='good'?'active':''}`} aria-pressed={team==='good'} onClick={()=>setTeam('good')}>Good</button><button className={`evil ${team==='evil'?'active':''}`} aria-pressed={team==='evil'} onClick={()=>setTeam('evil')}>Evil</button></div>
   <div className="bet-row"><label>Stake<input type="number" inputMode="numeric" min={bets.min} max={bets.max} step="1" value={stake} onChange={e=>setStake(e.target.value)}/></label><button className="primary compact" disabled={busy||n<bets.min||n>bets.max} onClick={()=>onBet(team,n)}>Bet {n} on {team}</button></div>
   <small>{bets.min}–{bets.max} points. A right call pays back double. Bets close when Day 2 begins, and pay out only if the game is recorded; otherwise you get your stake back.</small>
  </>}
 </section>;
}
const hoursLeft=at=>{const h=Math.max(1,Math.ceil((at-Date.now())/3600000));return h===1?'1 hour':`${h} hours`;};
function ShopSample({item,account,look}){
 const wearing={...look,[item.kind]:item.id};
 if(item.kind==='frame')return <Face className="shop-face" src={account.avatar} name={account.username} look={wearing}/>;
 if(item.kind==='color')return <span className="shop-ink"><Named name={account.username} look={wearing}/></span>;
 return <span className="shop-title-sample"><strong>{account.username}</strong><Title look={wearing}/></span>;
}
function Shop({account,wallet,onWallet,inGame,onLogin}){
 const [kind,setKind]=useState('frame'),[preview,setPreview]=useState(null),[confirm,setConfirm]=useState(null),[busy,setBusy]=useState(false),[note,setNote]=useState(''),[error,setError]=useState(''),[chest,setChest]=useState(null);
 useEffect(()=>{setConfirm(null);},[kind]);
 if(!account)return <><span className="eyebrow">THE CURIOSITY SHOP</span><h2>Dress your seat.</h2><p>Win games to earn points, then spend them on frames, name colours and titles that everyone at the table can see.</p><div className="shop-guest"><Lock size={18}/><div><strong>Log in to start earning points.</strong><p>Points come from games where at least three players are logged in.</p></div><button className="primary compact" onClick={onLogin}>Log in or sign up</button></div></>;
 if(!wallet)return <><span className="eyebrow">THE CURIOSITY SHOP</span><h2>Dress your seat.</h2><p className="small">Opening the shop…</p></>;
 const look=wallet.look||{},shown=preview?{...look,[ITEM[preview].kind]:preview}:look;
 async function call(path,body,done){
  if(busy)return;setBusy(true);setError('');setNote('');
  try{const data=await postJson(`/botc/api/game/shop${path}`,body);onWallet(data);setNote(done+(data.later?' You are in a game right now, so it shows from your next game.':''));setConfirm(null);setPreview(null);}
  catch(e){setError(e.message);}finally{setBusy(false);}
 }
 // The chest shakes for at least a second while the server rolls, then opens on what was inside.
 async function openChest(){
  if(busy)return;setBusy(true);setError('');setNote('');setChest({stage:'shaking'});const started=Date.now();
  try{const data=await postJson('/botc/api/game/shop/chest',{});await new Promise(done=>setTimeout(done,Math.max(0,1100-(Date.now()-started))));onWallet(data);setChest({stage:'open',...data.opened});}
  catch(e){setChest(null);setError(e.message);}finally{setBusy(false);}
 }
 const prize=chest?.stage==='open'?ITEM[chest.item]:null;
 const items=ITEMS.filter(i=>i.kind===kind);
 return <>
  <span className="eyebrow">THE CURIOSITY SHOP</span><h2>Dress your seat.</h2>
  {/* Stays in view while the items scroll, so each one can be tried on. */}
  <div className="shop-preview" aria-live="polite">
   <Face className="shop-face big" src={account.avatar} name={account.username} look={shown}/>
   <div className="shop-preview-text"><strong className="shop-preview-name"><Named name={account.username} look={shown}/></strong><Title look={shown}/><small>{preview?`Previewing ${ITEM[preview].name}`:'How you look at the table'}</small></div>
   <span className="shop-balance"><Coins size={18}/>{wallet.balance}<small>points</small></span>
  </div>
  <div className="shop-wallet">
    <ul className="shop-earn">
     <li><span>Finish a game</span><b>+{POINTS.finish}</b></li>
     <li><span>Your team wins</span><b>+{POINTS.win}</b></li>
     <li><span>Win as the Demon</span><b>+{POINTS.demon}</b></li>
     <li className={wallet.daily.ready?'ready':''}><span>First win today{wallet.daily.ready?' · ready':` · back in ${hoursLeft(wallet.daily.resetsAt)}`}</span><b>+{POINTS.daily}</b></li>
    </ul>
    {wallet.held>0&&<p className="shop-held"><Dices size={13}/>{wallet.held} points are riding on a bet until that game ends.</p>}
    {wallet.gifts?.length>0&&<div className="shop-gifts"><span className="eyebrow"><Gift size={12}/>GIFTS FOR YOU</span>{wallet.gifts.map((x,i)=><span key={i}><b>{x.from}</b> sent you {x.amount} points<small> · {new Date(x.at).toLocaleDateString([],{month:'short',day:'numeric'})}</small></span>)}</div>}
  </div>
  <section className={`chest-panel ${chest?.stage||''} ${prize?`tier-${prize.tier}`:''}`} aria-live="polite">
   <div className="chest-stage">{prize?<div className="chest-prize"><ShopSample item={prize} account={account} look={look}/></div>:<ChestArt shaking={chest?.stage==='shaking'}/>}</div>
   <div className="chest-text">
    <span className="tier-tag">{prize?`${TIERS[prize.tier]} ${KINDS[prize.kind].replace(/s$/,'').toLowerCase()}`:'Mystery chest'}</span>
    <h3>{prize?prize.name:chest?.stage==='shaking'?'Opening…':'What’s inside?'}</h3>
    <p>{prize?(chest.duplicate?`You already have this, so ${chest.refund} points come back to you.`:prize.blurb):'A random frame, name colour or title, including a few you can only find in chests.'}</p>
    {!prize&&<small className="chest-odds">{Object.entries(CHEST.odds).map(([t,o])=>`${TIERS[t]} ${o}%`).join(' · ')} · Duplicates give back {CHEST.refund}</small>}
    <div className="chest-actions">
     {prize&&!chest.duplicate&&look[prize.kind]!==prize.id&&<button className="primary compact" disabled={busy} onClick={()=>call('/equip',{kind:prize.kind,item:prize.id},`You are wearing ${prize.name}.`)}>Wear it</button>}
     <button className={prize?'secondary compact':'primary compact'} disabled={busy||wallet.balance<CHEST.price} onClick={openChest}><Package size={14}/>{prize?'Open another':'Open'} · {CHEST.price}</button>
     {prize&&<button className="text-button" onClick={()=>setChest(null)}>Done</button>}
     {!prize&&wallet.balance<CHEST.price&&<small className="need">{CHEST.price-wallet.balance} more needed</small>}
    </div>
   </div>
  </section>
  {inGame&&<p className="status-note"><Clock3 size={15}/><span>You are in a game. To keep things fair, changes show from your next game.</span></p>}
  {(note||error)&&<p className={`status-note ${error?'error':'good'}`} role="status">{error?<X size={15}/>:<Check size={15}/>}<span>{error||note}</span></p>}
  <div className="role-tabs">{Object.entries(KINDS).map(([key,title])=><button className={kind===key?'active':''} key={key} onClick={()=>{setKind(key);setPreview(null);}}>{title}</button>)}</div>
  <div className="shop-grid">
   {items.map(item=>{
    const owned=item.price||item.chest?wallet.owned.includes(item.id):wallet.progress[item.unlock]>=UNLOCKS[item.unlock].goal,wearing=look[item.kind]===item.id,short=item.price&&!owned?item.price-wallet.balance:0;
    return <article key={item.id} className={`shop-item tier-${item.tier} ${wearing?'wearing':''} ${preview===item.id?'previewing':''}`} onMouseEnter={()=>setPreview(item.id)} onMouseLeave={()=>setPreview(p=>p===item.id?null:p)}>
     <button className="shop-sample" onClick={()=>setPreview(p=>p===item.id?null:item.id)} onFocus={()=>setPreview(item.id)} aria-label={`Preview ${item.name}`}><ShopSample item={item} account={account} look={look}/></button>
     <div className="shop-item-text"><span className="tier-tag">{TIERS[item.tier]}{item.chest&&' · Chest only'}</span><h3>{item.name}</h3><p>{item.blurb}</p></div>
     <div className="shop-item-action">
      {wearing?<><span className="wearing-tag"><Check size={14}/>Wearing</span><button className="text-button" disabled={busy} onClick={()=>call('/equip',{kind:item.kind,item:null},`${item.name} is off.`)}>Take off</button></>
      :owned?<button className="primary compact" disabled={busy} onClick={()=>call('/equip',{kind:item.kind,item:item.id},`You are wearing ${item.name}.`)}>Wear</button>
      :item.chest?<span className="chest-only"><Package size={13}/>Found in chests</span>
      :item.unlock?<div className="unlock-progress"><span><Lock size={12}/>{UNLOCKS[item.unlock].text}</span><div className="progress-bar"><i style={{width:`${wallet.progress[item.unlock]/UNLOCKS[item.unlock].goal*100}%`}}/></div><small>{wallet.progress[item.unlock]} / {UNLOCKS[item.unlock].goal}</small></div>
      :confirm===item.id?<><button className="primary compact" disabled={busy} onClick={()=>call('/buy',{item:item.id},`You bought ${item.name} and are wearing it.`)}>Buy for {item.price}</button><button className="text-button" disabled={busy} onClick={()=>setConfirm(null)}>Cancel</button></>
      :short>0?<><span className="price"><Coins size={13}/>{item.price}</span><small className="need">{short} more needed</small></>
      :<button className="secondary compact" disabled={busy} onClick={()=>setConfirm(item.id)}><Coins size={13}/>{item.price}</button>}
     </div>
    </article>;})}
  </div>
  <p className="small shop-footnote">Points come only from playing, gifts and spectator bets; nothing here costs real money. To gift points, open someone’s profile from the Players list. Decorations never show your character or team.</p>
 </>;
}
const plural=(n,word)=>`${n} ${word}${n===1?'':'s'}`;
const MODES={all:'All games',...SCRIPTS};
async function getJson(url){
 try{const r=await fetch(url,{cache:'no-store',signal:timed()}),data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Please try again.');return data;}
 catch(e){throw new Error(e.name==='TimeoutError'?TIMED_OUT:e.message);}
}
function recordNote(record,accountsOn){
 if(!record||!accountsOn)return '';
 if(record.status==='called')return 'A game ended by a vote has no winner, so it earns no points and is not recorded. ';
 if(record.counted)return record.points?`You earned ${record.points.total} points, and the game is saved to your record. `:'This game is saved to your record. ';
 if(record.status==='skipped')return `This game is not recorded, because fewer than ${record.needed} players were logged in. `;
 if(record.status==='saved')return 'Log in before your next game to earn points and keep a record. ';
 if(record.status==='failed')return 'This game could not be saved to your record. ';
 return '';
}
function RecordRow({label,games,wins}){return <div className="record-row plain"><span>{label}</span><span>{plural(games,'game')} · {wins} won</span></div>;}
// A list of everyone with a record, A–Z. It shows no results, so nobody is ranked against anybody.
function Leaderboard({me,start,onWallet}){
 const [board,setBoard]=useState(null),[player,setPlayer]=useState(start),[profile,setProfile]=useState(null),[error,setError]=useState('');
 useEffect(()=>{
  let live=true;setError('');
  const url=player?`/botc/api/game/leaderboard/player?username=${encodeURIComponent(player)}`:'/botc/api/game/leaderboard?script=all';
  if(player)setProfile(null);
  getJson(url).then(d=>{if(!live)return;if(player)setProfile(d.player);else setBoard(d);}).catch(e=>{if(live)setError(e.message);});
  return()=>{live=false;};
 },[player]);
 if(player)return <>
  <button className="text-button back-link" onClick={()=>setPlayer(null)}><ArrowLeft size={14}/>All players</button>
  {error?<p className="status-note">{error}</p>:!profile?<p className="small">Opening the records…</p>:<>
   <div className="profile-head"><Face className="account-avatar" src={profile.avatar} name={profile.username} look={profile.look}/><div><span className="eyebrow">PLAYER RECORD</span><h2><Named name={profile.username} look={profile.look}/></h2><Title look={profile.look}/></div></div>
   {me&&me!==profile.username&&<GiftBox to={profile.username} onWallet={onWallet}/>}
   {profile.games===0?<p className="small">No recorded games yet. A game counts when at least three players at the table are logged in.</p>:<>
    <div className="stat-row">{[['Games',profile.games],['Survived',pct(profile.survived,profile.games)],['Demon wins',profile.demonWins]].map(([label,value])=><div className="stat" key={label}><b>{value}</b><small>{label}</small></div>)}</div>
    <h3 className="log-heading">By team</h3>
    <RecordRow label="Good" {...profile.good}/><RecordRow label="Evil" {...profile.evil}/>
    <h3 className="log-heading">By game mode</h3>
    {profile.scripts.map(s=><RecordRow key={s.id} label={SCRIPTS[s.id]||s.id} {...s}/>)}
    <h3 className="log-heading">Most played</h3>
    {profile.characters.map(c=><div className="record-row with-icon plain" key={c.role}><span className="record-icon"><RoleIcon id={c.role}/></span><span>{ROLES[c.role]?.name||c.role}</span><span>{plural(c.games,'game')} · {c.wins} won</span></div>)}
    <h3 className="log-heading">Recent games</h3>
    {profile.recent.map((r,i)=><div className="record-row with-icon" key={i}><span className="record-icon"><RoleIcon id={r.role}/></span><span>{ROLES[r.role]?.name||r.role}{r.finalRole!==r.role&&<small> became the {ROLES[r.finalRole]?.name}</small>}<small className="record-meta">{SCRIPTS[r.script]||r.script} · {r.players} players · {new Date(r.endedAt).toLocaleDateString([],{month:'short',day:'numeric'})}</small></span><span>{r.evil?'Evil':'Good'} · {r.survived?'survived':'died'}</span><b className={r.won?'won':'lost'}>{r.won?'Won':'Lost'}</b></div>)}
   </>}
  </>}
 </>;
 const rows=board?.players||[];
 return <>
  <span className="eyebrow">THE TOWN RECORDS</span><h2>Players.</h2>
  <p>Everyone with a recorded game, A–Z. A game counts when at least {board?.minAccounts||3} players at the table are logged in. Pick a name to see their record.</p>
  {error?<p className="status-note">{error}</p>:!board?<p className="small">Opening the records…</p>:rows.length===0?<p className="small">No games recorded yet. Finish a game with at least {board.minAccounts} logged-in players to appear here.</p>:
  <div className="leader-list">
   <div className="leader-row players leader-head" aria-hidden="true"><span>Player</span><span>Games</span></div>
   {rows.map(p=><button key={p.username} className={`leader-row players ${p.username===me?'you':''}`} onClick={()=>setPlayer(p.username)}>
     <span className="leader-player"><Face className="chat-avatar" src={p.avatar} name={p.username} look={p.look}/><span className="leader-name"><strong><Named name={p.username} look={p.look}/>{p.username===me&&<em> you</em>}</strong>{p.look?.title&&<Title look={p.look}/>}</span></span>
     <span className="leader-num">{p.games}</span>
    </button>)}
  </div>}
 </>;
}
export default function Game(){
 const [g,setG]=useState(null),[room,setRoom]=useState(''),[name,setName]=useState(''),[joinCode,setJoinCode]=useState(''),[dialog,setDialog]=useState(null),[drawer,setDrawer]=useState(null),[leaderPlayer,setLeaderPlayer]=useState(null),[tab,setTab]=useState('townsfolk'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[online,setOnline]=useState(true),[now,setNow]=useState(Date.now()),[targets,setTargets]=useState([]),[selected,setSelected]=useState(null),[showRole,setShowRole]=useState(false),[chat,setChat]=useState(''),[copied,setCopied]=useState(false),[notes,setNotes]=useState('');
 const [view,setView]=useState('town'),[chatOpen,setChatOpen]=useState(false),[screen,setScreen]=useState('you'),[local,setLocal]=useState({read:{},dawn:0,inbox:0,code:null}),[groupTitle,setGroupTitle]=useState(''),[groupPick,setGroupPick]=useState([]),[outgoing,setOutgoing]=useState([]),[guess,setGuess]=useState(''),[statement,setStatement]=useState(false);
 const [account,setAccount]=useState(null),[accountsOn,setAccountsOn]=useState(false),[authMode,setAuthMode]=useState('register'),[authName,setAuthName]=useState(''),[password,setPassword]=useState(''),[afterAuth,setAfterAuth]=useState(null),[wallet,setWallet]=useState(null);
 const outbox=useRef([]),flushing=useRef(false),lastChatReply=useRef(0);
 // Table effects: the vote being counted round the circle, the dusk and dawn glow, and seats that just fell.
 const [tally,setTally]=useState(null),[sweep,setSweep]=useState(null),[fallen,setFallen]=useState([]),[dawnHold,setDawnHold]=useState(false);
 const seenBallots=useRef(null),prevTable=useRef(null),fxTimers=useRef({});
 const fx=(name,fn,ms)=>{clearTimeout(fxTimers.current[name]);fxTimers.current[name]=setTimeout(fn,ms);};
 useEffect(()=>()=>Object.values(fxTimers.current).forEach(clearTimeout),[]);
 const narrow=useMedia('(max-width:1099px)'),phone=useMedia('(max-width:899px)');
 const chatEnd=useRef(null),polling=useRef(false),mutating=useRef(false),generation=useRef(0),seated=useRef(false),refreshNow=useRef(null),again=useRef(false);
 // One room hosts many games, so per-game browser state is keyed by round as well as code.
 const gameKey=g?`${g.code}#${g.round}`:null;
 function updateLocal(patch){setLocal(prev=>{const next={...prev,...patch};localStorage.setItem(`rw_local_${prev.code}`,JSON.stringify(next));return next;});}
 useEffect(()=>{const q=new URLSearchParams(location.search).get('room');setName(localStorage.getItem('rw_name')||'');if(q){setJoinCode(q.toUpperCase());setDialog('join');setRoom(q.toUpperCase());}else setRoom(localStorage.getItem('rw_room')||'');},[]);
 // Tells the table straight away when this tab closes; the next poll undoes it after a reload.
 useEffect(()=>{if(!room)return;const bye=()=>navigator.sendBeacon('/botc/api/game/presence',new Blob([JSON.stringify({code:room})],{type:'application/json'}));window.addEventListener('pagehide',bye);return()=>window.removeEventListener('pagehide',bye);},[room]);
 // A logged-in player is recognised straight away, and sent back to the table they were sitting at.
 useEffect(()=>{fetch('/botc/api/game/account',{cache:'no-store',signal:timed()}).then(r=>r.ok?r.json():null).then(d=>{if(!d)return;setAccountsOn(d.enabled);setAccount(d.account);if(d.account){setName(n=>n||d.account.username);if(d.room)setRoom(r=>r||d.room);}}).catch(()=>{});},[]);
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);},[]);
 // Points arrive when a counted game is saved, so the balance refreshes then too.
 useEffect(()=>{if(!account){setWallet(null);return;}getJson('/botc/api/game/shop').then(setWallet).catch(()=>{});},[account?.username,g?.record?.status]);
 // The server pokes this page whenever the table changes, so other players' moves appear at once.
 // Polling stays on underneath, both as the backstop and because it moves the timers along.
 useEffect(()=>{if(!room||typeof EventSource==='undefined')return;let last=0,timer=null;const es=new EventSource(`/botc/api/game/events?code=${encodeURIComponent(room)}`);es.onmessage=()=>{clearTimeout(timer);timer=setTimeout(()=>{last=Date.now();refreshNow.current?.();},Math.max(0,last+200-Date.now()));};return()=>{clearTimeout(timer);es.close();};},[room]);
 useEffect(()=>{if(!room)return;let alive=true;const refresh=async()=>{if(polling.current){again.current=true;return;}if(mutating.current)return;polling.current=true;again.current=false;refreshNow.current=refresh;const gen=generation.current;try{const r=await fetch(`/botc/api/game?code=${encodeURIComponent(room)}`,{cache:'no-store',signal:timed()}),data=await r.json();if(!alive||gen!==generation.current)return;if(r.ok){seated.current=true;setG(data);setOnline(true);setDialog(v=>v==='join'?null:v);localStorage.setItem('rw_room',room);}else if(r.status===401||/Join|Room not found/.test(data.error)){if(seated.current){seated.current=false;setJoinCode(room);setError('You no longer have a seat at this table. You can rejoin with the room code.');history.replaceState({},'','/botc/');}setG(null);setRoom('');localStorage.removeItem('rw_room');}else setOnline(false);}catch{if(alive)setOnline(false);}finally{polling.current=false;if(alive&&again.current)setTimeout(refresh,0);}};refreshNow.current=refresh;refresh();const t=setInterval(refresh,1800);return()=>{alive=false;refreshNow.current=null;clearInterval(t);};},[room]);
 useEffect(()=>{setTargets([]);setGuess('');if(g?.pending)setScreen('table');},[g?.pending?.key]);
 useEffect(()=>{setSelected(null);if(g)setScreen(g.phase==='lobby'?'you':'table');},[g?.phase]);
 useEffect(()=>{if(!gameKey)return;setNotes(localStorage.getItem(`rw_notes_${gameKey}`)||'');setLocal(readLocal(gameKey));setView('town');setChatOpen(false);setShowRole(false);setOutgoing([]);outbox.current=[];},[gameKey]);
 // Keep sent messages briefly after the server confirms them, in case an older poll lands afterwards.
 useEffect(()=>{setOutgoing(list=>{const seen=new Set((g?.messages||[]).map(m=>m.cid)),next=list.filter(x=>!seen.has(x.cid)||Date.now()-x.at<10000);return next.length===list.length?list:next;});},[g]);
 // A finished vote is counted round the circle: a clock hand ticks from the seat after the nominee, seat by seat,
 // and every raised hand lights up as it is counted. Only votes that finish while this page is open are played.
 useEffect(()=>{
  if(!g)return;const key=`${gameKey}:${g.day}`,n=g.ballots.length,prev=seenBallots.current;seenBallots.current={key,n};
  if(!prev||prev.key!==key||n<=prev.n||g.phase!=='day')return;
  const b=g.ballots[n-1],steps=b.votes.length,gap=Math.min(260,Math.max(140,2600/steps));let step=0;
  const next=()=>{step++;setTally({b,step,done:step>=steps});fx('tally',step<steps?next:()=>setTally(null),step<steps?gap:2600);};
  setSelected(null);setTally({b,step:0,done:false});fx('tally',next,450);
 },[g?.ballots?.length,g?.day,gameKey]);
 // Dusk and dawn glow softly inside the circle only, and a seat that has just died flashes red once.
 // At dawn the night's news waits for the glow, so the popup does not cover it.
 useEffect(()=>{
  if(!g)return;const prev=prevTable.current,alive=Object.fromEntries(g.players.map(p=>[p.id,p.alive]));
  prevTable.current={key:gameKey,phase:g.phase,alive};
  if(!prev||prev.key!==gameKey)return;
  const kind=prev.phase==='day'&&g.phase==='night'?'dusk':prev.phase==='night'&&g.phase==='day'?'dawn':null;
  const died=g.players.filter(p=>prev.alive[p.id]&&!p.alive).map(p=>p.id);
  if(kind){setSweep({kind,at:Date.now()});fx('sweep',()=>setSweep(null),1900);}
  if(kind==='dawn'){setDawnHold(true);fx('dawnHold',()=>setDawnHold(false),1500);}
  if(died.length){fx('fallStart',()=>{setFallen(died);fx('fall',()=>setFallen([]),1700);},kind==='dawn'?500:0);}
 },[g]);
 // A whisper partner or group can vanish while open (a kick, a leave); fall back to the square.
 useEffect(()=>{if(g&&!['town','journal','notes'].includes(view)&&!g.players.some(p=>p.id===view)&&!g.groups.some(c=>c.id===view)){setView('town');setChatOpen(false);}},[g,view]);
 useEffect(()=>{const close=e=>{if(e.key==='Escape'){setDialog(null);setDrawer(null);setSelected(null);}};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[]);
 const convOf=key=>(g?.messages||[]).filter(m=>m.group?m.group===key:key==='town'?!m.to:m.to&&((m.to===key&&m.from===g.me.id)||(m.from===key&&m.to===g.me.id)));
 const unreadOf=key=>local.code===gameKey?convOf(key).filter(m=>m.from!==g.me.id&&m.at>(local.read[key]||0)).length:0;
 const messages=view==='town'||view==='journal'||view==='notes'?convOf('town'):convOf(view);
 const feed=[...messages,...outgoing.filter(x=>x.conv===view&&!messages.some(m=>m.cid===x.cid)).map(x=>({id:x.cid,cid:x.cid,from:g?.me.id,text:x.text,at:x.at,statement:x.statement,sending:true}))];
 const convVisible=!!g&&(!phone||screen==='chats')&&(!narrow||chatOpen);
 const inboxCount=g?.me.inbox.length||0,latest=messages.at(-1)?.at||0;
 useEffect(()=>{if(!convVisible||local.code!==gameKey)return;if(view==='journal'){if(local.inbox!==inboxCount)updateLocal({inbox:inboxCount});}else if(view!=='notes'&&latest>(local.read[view]||0))updateLocal({read:{...local.read,[view]:latest}});},[convVisible,view,latest,inboxCount,local,gameKey]);
 useEffect(()=>{chatEnd.current?.scrollIntoView({block:'end'});},[feed.length,view,chatOpen,screen]);
 async function action(type,extra={}){if(mutating.current)return;mutating.current=true;generation.current++;setBusy(true);setError('');try{const r=await fetch('/botc/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,code:g?.code||joinCode,name,...extra}),signal:timed()}),data=await r.json();if(!r.ok)throw new Error(data.error||'Please try again.');if(data.left){seated.current=false;setRoom('');setG(null);localStorage.removeItem('rw_room');history.replaceState({},'','/botc/');}else{seated.current=true;setG(data);setRoom(data.code);localStorage.setItem('rw_room',data.code);localStorage.setItem('rw_name',name);history.replaceState({},'',`?room=${data.code}`);setDialog(null);setOnline(true);}if(type==='group')openChat(data.groups.at(-1).id);if(type==='night')setTargets([]);if(type==='nominate'||type==='slayer')setSelected(null);}catch(e){setError(e.name==='TimeoutError'?TIMED_OUT:e.message);}finally{mutating.current=false;setBusy(false);}}
 async function accountCall(path,body={}){if(mutating.current)return null;mutating.current=true;setBusy(true);setError('');try{const r=await fetch(`/botc/api/game/account${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:timed()}),data=await r.json();if(!r.ok)throw new Error(data.error||'Please try again.');generation.current++;return data;}catch(e){setError(e.name==='TimeoutError'?TIMED_OUT:e.message);return null;}finally{mutating.current=false;setBusy(false);}}
 async function signIn(){const data=await accountCall(authMode==='register'?'/register':'/login',{username:authName,password});if(!data)return;setAccount(data.account);setPassword('');setName(data.account.username);localStorage.setItem('rw_name',data.account.username);if(data.room)setRoom(r=>r||data.room);if(authMode==='login'&&data.account.avatar&&!afterAuth)setDialog(null);}
 async function logOut(){if(!await accountCall('/logout'))return;seated.current=false;setAccount(null);setRoom('');setG(null);setName('');localStorage.removeItem('rw_room');localStorage.removeItem('rw_name');history.replaceState({},'','/botc/');setDialog(null);}
 async function setPicture(image){const data=await accountCall('/avatar',{image});if(data)setAccount(data.account);}
 // Pictures are cropped and shrunk here, so a phone photo costs the server a few KB.
 async function choosePicture(file){if(!file)return;try{const bitmap=await createImageBitmap(file),side=Math.min(bitmap.width,bitmap.height),canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');c.fillStyle='#2d2836';c.fillRect(0,0,128,128);c.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,128,128);await setPicture(canvas.toDataURL('image/jpeg',.82));}catch{setError('That file could not be read as a picture.');}}
 // The wallet also carries the account's current look, so buying something dresses the top bar at once.
 function gotWallet(data){setWallet(data);setAccount(a=>a&&{...a,look:Object.keys(data.look).length?data.look:null});}
 function openShop(){setDialog(null);setDrawer('shop');}
 function openLeaders(player=null){setLeaderPlayer(player);setDialog(null);setDrawer('leaders');}
 async function placeBet(team,stake){
  if(mutating.current)return;mutating.current=true;generation.current++;setBusy(true);setError('');
  try{const data=await postJson('/botc/api/game/bet',{code:g.code,team,stake});setG(data);getJson('/botc/api/game/shop').then(gotWallet).catch(()=>{});}
  catch(e){setError(e.message);}finally{mutating.current=false;setBusy(false);}
 }
 function openLog(){updateLocal({finaleSeen:true});setDialog(null);setDrawer('log');}
 function openAccount(back=null){setAfterAuth(back);setAuthName('');setPassword('');setDialog('account');}
 const me=g?.players.find(p=>p.id===g.me.id),phase=g?.phase||'welcome',night=phase==='night',role=ROLES[g?.me.role],seats=g?.players||emptySeats,living=g?.players.filter(p=>p.alive).length||0,chosen=phase==='day'?g?.players.find(p=>p.id===selected):null,host=g?.me.id===g?.host,readyCount=g?.players.filter(p=>p.alive&&(p.ready||p.away)).length||0;
 const script=g?.settings.script||'tb',scriptRoles=ROLE_LIST.filter(r=>r.script===script);
 // Spectators see the table but cannot take part, so most controls are hidden from them.
 const spectator=!!g?.me.spectator,inPlay=phase==='day'||night;
 const revealDue=!!g&&!spectator&&inPlay&&!!g.me.role&&local.code===gameKey&&!local.revealSeen;
 const proposal=g?.proposal,present=(g?.players||[]).filter(p=>!p.away||p.id===g.me.id).length,proposalNeed=Math.floor(present/2)+1,proposalYes=proposal?Object.entries(proposal.votes).filter(([id,yes])=>yes&&!g.players.find(p=>p.id===id)?.away).length:0;
 const butlerBlocked=g?.me.role==='butler'&&!!g?.nomination&&!g.nomination.hands[me?.id]&&!g.nomination.hands[g.me.master];
 const pickable=p=>{const q=g?.pending;if(spectator)return !!p.account&&!inPlay;return !q?phase==='day'||(['lobby','ended'].includes(phase)&&!!p.account):q.count>0&&!(q.notSelf&&p.id===g.me.id)&&!(q.aliveOnly&&!p.alive)&&!(q.deadOnly&&p.alive)&&p.id!==q.notId;};
 const pendingHint=!g?.pending?'':g.pending.count===0?'Pick a character from the list.':`Click ${['','a seat','two seats','three seats'][g.pending.count]} on the table. ${g.pending.deadOnly?'Dead players only.':g.pending.aliveOnly?'Living players only.':g.pending.notId?'You cannot choose the same player as last night.':g.pending.notSelf?'You cannot choose yourself.':'You may choose yourself or a dead player.'}`;
 const maxVotes=Math.max(0,...(g?.ballots||[]).map(b=>b.count)),leaders=(g?.ballots||[]).filter(b=>b.qualified&&b.count===maxVotes),block=leaders.length===1?g.players.find(p=>p.id===leaders[0].target):null;
 const nameOf=id=>g?.players.find(p=>p.id===id)?.name||'Former player';
 function choose(id){const seatOf=g?.players.find(p=>p.id===id);if(spectator){if(seatOf?.account&&!inPlay)openLeaders(seatOf.account);return;}if(!g?.pending&&phase!=='day'){if(seatOf?.account)openLeaders(seatOf.account);return;}if(g?.pending){if(!pickable(g.players.find(p=>p.id===id)))return;setTargets(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id].slice(-g.pending.count));}else setSelected(selected===id?null:id);}
 function openChat(key){setView(key);setChatOpen(true);setScreen('chats');}
 // Messages show immediately and send in order behind the scenes, so a slow network never holds up typing.
 function send(){if(!g||spectator||night||!chat.trim()||view==='journal'||view==='notes')return;const item={cid:`${Date.now()}-${Math.random().toString(36).slice(2)}`,conv:view,code:g.code,text:chat,at:Date.now(),statement:statement&&canState,...(viewGroup?{group:viewGroup.id}:{to:view==='town'?null:view})};setChat('');setStatement(false);setOutgoing(list=>[...list,item]);outbox.current.push(item);flushOutbox();}
 async function flushOutbox(){
  if(flushing.current)return;flushing.current=true;
  while(outbox.current.length){
   const item=outbox.current.shift(),wait=lastChatReply.current+800-Date.now(); // The server allows one message every 750ms.
   if(wait>0)await new Promise(done=>setTimeout(done,wait));
   try{
    const r=await fetch('/botc/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'chat',code:item.code,cid:item.cid,text:item.text,to:item.to,group:item.group,statement:item.statement||undefined}),signal:timed()}),data=await r.json();
    if(!r.ok)throw new Error(data.error||'Please try again.');
    generation.current++;if(!mutating.current)setG(data);setOnline(true);
   }catch(e){setOutgoing(list=>list.filter(x=>x.cid!==item.cid));setChat(c=>c?`${item.text}\n${c}`:item.text);setError(e instanceof TypeError||e.name==='TimeoutError'?'Your message did not send. Check your connection and try again.':e.message);}
   lastChatReply.current=Date.now();
  }
  flushing.current=false;
 }
 function newGroup(){setGroupTitle('');setGroupPick([]);setDialog('group');}
 function submitGroup(){action('group',{title:groupTitle.trim()||listNames(groupPick.map(nameOf)).slice(0,30),members:groupPick});}
 async function copy(){try{await navigator.clipboard.writeText(`${location.origin}/botc/?room=${g.code}`);setCopied(true);setTimeout(()=>setCopied(false),2500);}catch{setError(`Copy this room code: ${g.code}`);}}
 // Tonight's news always appears at dawn, even if it was already read in the Journal during the night.
 const tonight=(g?.me.inbox||[]).filter(i=>i.phase!=='day'&&(i.day===g.day||(g.day===1&&i.day===0)));
 const dawnDue=!spectator&&phase==='day'&&local.code===gameKey&&g.day>local.dawn,newsDue=!spectator&&phase==='day'&&local.code===gameKey&&g.me.inbox.slice(local.inbox).some(i=>i.phase==='day');
 const popupItems=(g?.me.inbox||[]).filter((item,i)=>i>=local.inbox||(dawnDue&&tonight.includes(item)));
 const finaleDue=phase==='ended'&&local.code===gameKey&&!local.finaleSeen;
 const deaths=(g?.nightDeaths||[]).map(id=>id===g.me.id?'You':nameOf(id));
 const whispers=(spectator?[]:g?.players||[]).filter(p=>p.id!==g.me.id).map(p=>({p,last:convOf(p.id).at(-1)})).sort((a,b)=>(b.last?.at||0)-(a.last?.at||0));
 const previewOf=m=>m?`${m.from===g.me.id?'You':nameOf(m.from)}: ${m.text}`:'No messages yet';
 const townLast=convOf('town').at(-1),journalUnread=Math.max(0,inboxCount-local.inbox);
 const groups=g?.groups||[];
 const totalUnread=!g?0:unreadOf('town')+groups.reduce((n,c)=>n+unreadOf(c.id),0)+whispers.reduce((n,w)=>n+unreadOf(w.p.id),0)+journalUnread;
 const viewPlayer=g?.players.find(p=>p.id===view),viewGroup=groups.find(c=>c.id===view);
 // Every living player gets this control, so that bluffing the Gossip is possible.
 const canState=script==='bmr'&&view==='town'&&phase==='day'&&!g?.paused&&!!me?.alive&&!g?.me.statementUsed;
 const tallyCounted=tally?tally.b.votes.slice(0,tally.step):[],tallyYes=new Set(tallyCounted.filter(v=>v.yes).map(v=>v.id)),tallyOn=tally&&!tally.done?tallyCounted.at(-1)?.id:null;
 const nominateBlock=!chosen?'':g.nomination?'A vote is in progress.':!me.alive?'Dead players cannot nominate.':me.nominator?'You already nominated today.':chosen.nominated?`${chosen.name} was already nominated today.`:'';
 return <div className={`app ${night?'night':''} ${g?'in-game':'no-game'}`}>
 <header className="topbar"><a href="/botc/" className="brand"><span className="brand-mark">R</span><span>RAVENSWOOD<small>BLOOD ON THE CLOCKTOWER</small></span></a><div className="edition"><i/> {SCRIPTS[script].toUpperCase()}</div><nav><button className="text-button" onClick={()=>setDrawer('help')}><BookOpen size={16}/><span>How to play</span></button><button className="text-button" onClick={()=>setDrawer('roles')}><ScrollText size={16}/><span>Characters</span></button>{accountsOn&&<button className="text-button" onClick={()=>openLeaders()}><Users size={16}/><span>Players</span></button>}{accountsOn&&<button className="text-button" onClick={()=>openShop()} aria-label={wallet?`Shop, ${wallet.balance} points`:'Shop'}><Store size={16}/><span>Shop</span>{wallet&&<b className="points-pill"><Coins size={12}/>{wallet.balance}</b>}</button>}{accountsOn&&<button className="text-button" onClick={()=>openAccount()}>{account?<Face className="nav-avatar" src={account.avatar} name={account.username} look={account.look}/>:<User size={16}/>}<span>{account?account.username:'Log in'}</span></button>}</nav></header>
 {(!online||error)&&<div className="toasts">{!online&&<div className="connection-banner" role="status">Reconnecting… Your seat is saved in this browser.</div>}{error&&<div className="error-banner" role="alert">{error}<button className="icon-button" onClick={()=>setError('')} aria-label="Dismiss error"><X size={15}/></button></div>}</div>}
 <main className={`workspace screen-${screen} ${chatOpen?'chat-open':''}`}>
 <aside className="left-rail">
  {!g?<><div className="eyebrow">● YOUR EVENING IN RAVENSWOOD</div><h1>A quiet town.<br/>A terrible secret.</h1><p className="intro">A game of trust, deception, and a Demon hiding in plain sight. Bring your friends. We’ll tell the story.</p><div className="entry-actions"><button className="primary" onClick={()=>setDialog('create')}>Create a game <ArrowRight size={17}/></button><button className="secondary" onClick={()=>setDialog('join')}>Join with a code</button></div><div className="table-details"><span><Users size={15}/>5–15 players</span><span><Clock3 size={15}/>30–90 minutes</span><span><Sparkles size={15}/>Automated Storyteller</span><span><MessageCircle size={15}/>Text chat + whispers</span></div></>:<>
  <div className="room-card"><div><span className="eyebrow">ROOM CODE</span><strong>{g.code}</strong></div><button className="icon-button" onClick={copy} aria-label="Copy invitation link" title="Copy invitation link">{copied?<Check size={18}/>:<Copy size={18}/>}</button></div>
  {phase==='lobby'?<div className="lobby-controls"><h2>The gathering before the storm.</h2>{g.interrupted&&<p className="status-note"><RotateCcw size={15}/><span>The table voted to end the last game early. Everyone gets a new character when the next one begins.</span></p>}{spectator&&<p className="status-note"><Eye size={15}/><span>You are watching. Take a seat to play in the next game.</span></p>}<p className="small">Invite your friends with the room code. Everyone plays a character; the automated Storyteller does the rest.</p><label>Game mode<select value={script} disabled={!host||busy} onChange={e=>action('settings',{daySeconds:g.settings.daySeconds,script:e.target.value})}>{Object.entries(SCRIPTS).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label><label>Length of each day<select value={g.settings.daySeconds} disabled={!host||busy} onChange={e=>action('settings',{daySeconds:Number(e.target.value),script})}>{[[120,'2 minutes · quick'],[180,'3 minutes · brisk'],[240,'4 minutes · standard'],[360,'6 minutes · relaxed'],[600,'10 minutes · leisurely']].map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label><p className="small">{seats.length<5?`${5-seats.length} more player${seats.length===4?'':'s'} needed.`:seats.length<7?'5–6 player rules: evil players do not learn one another or receive Demon bluffs.':'Evil players learn their team on the first night.'}</p>{host&&seats.length>1&&<div className="seat-list"><span className="eyebrow">AT THE TABLE</span>{seats.filter(p=>p.id!==g.me.id).map(p=><div className="seat-list-row" key={p.id}><span>{p.name}{p.away&&<em className="offline-tag"> offline</em>}</span><div className="seat-list-actions">{p.pictured&&<button className="icon-button" disabled={busy} onClick={()=>action('hide_avatar',{target:p.id})} aria-label={`${p.avatarHidden?'Show':'Hide'} ${p.name}'s picture`} title={`${p.avatarHidden?'Show':'Hide'} ${p.name}'s picture`}>{p.avatarHidden?<Eye size={15}/>:<EyeOff size={15}/>}</button>}<button className="icon-button" disabled={busy} onClick={()=>action('kick',{target:p.id})} aria-label={`Remove ${p.name} from the table`} title={`Remove ${p.name} from the table`}><UserX size={15}/></button></div></div>)}<small>Removed players can rejoin with the room code.</small></div>}{spectator?<button className="primary" disabled={busy||seats.length>=15} onClick={()=>action('join',{name:g.me.name})}>Take a seat <Armchair size={16}/></button>:host?<button className="primary" disabled={busy||seats.length<5} onClick={()=>action('start')}>Begin the story <Moon size={16}/></button>:<p className="small">Waiting for the host to begin.</p>}<button className="text-button" disabled={busy} onClick={()=>action('leave')}><LogOut size={14}/>{spectator?'Stop watching':'Leave table'}</button></div>:spectator?<>
  <div className="role-card"><div className="card-heading"><span className="eyebrow">YOU ARE WATCHING</span></div><div className="role-symbol"><Eye size={30}/></div><h2>Spectator</h2><p>You see what the whole town sees: the seats, the votes and the Town square. Characters, whispers and night information stay hidden until the game ends.</p></div>
  {g.bets&&!g.bets.ended&&<BetPanel key={gameKey} bets={g.bets} loggedIn={!!account} busy={busy} onBet={placeBet} onLogin={()=>openAccount()}/>}
  {COUNTS[seats.length]&&<button className="setup-line" onClick={()=>setDrawer('roles')} title="See the character list and setup chart"><Users size={13}/><span>{setupLine(seats.length)}</span></button>}
  {phase==='ended'&&<p className="small">Every character is now shown on the table.</p>}
  <button className="text-button" disabled={busy} onClick={()=>action('leave')}><LogOut size={14}/>Stop watching</button>
  </>:<>
  <div className={`role-card ${showRole?role?.type||'':''}`}><div className="card-heading"><span className="eyebrow">YOUR SECRET CHARACTER</span><button className="icon-button" aria-label={showRole?'Hide character':'Reveal character'} onClick={()=>setShowRole(!showRole)}>{showRole?<EyeOff size={16}/>:<Eye size={16}/>}</button></div>{showRole?<><div className="role-symbol"><RoleIcon id={g.me.role}/></div><h2>{role?.name}</h2><span className={`role-type ${['minion','demon'].includes(role?.type)?'evil':'good'}`}>{role?.type} · {['minion','demon'].includes(role?.type)?'evil':'good'}</span><p>{role?.help}</p></>:<button className="secret-cover" onClick={()=>setShowRole(true)}><LockKeyhole size={22}/><strong>For your eyes only</strong><span>Click to reveal your character</span></button>}</div>
  {COUNTS[seats.length]&&<button className="setup-line" onClick={()=>setDrawer('roles')} title="See the character list and setup chart"><Users size={13}/><span>{setupLine(seats.length)}</span></button>}
  {me&&!me.alive&&phase!=='ended'&&<p className="status-note"><Skull size={15}/><span>You are dead, but still in the game. You can talk and win with your team. {me.ghost?'You have one ghost vote left.':'Your ghost vote is spent.'}</span></p>}
  {phase==='day'&&<label className="claim-field">Publicly claim a character<select value={me.claim||''} disabled={busy||g.paused} onChange={e=>action('claim',{role:e.target.value})}><option value="">Keep them guessing</option>{scriptRoles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select><small>Shown to everyone under your seat. It can be a bluff.</small></label>}
  {inPlay&&<button className="text-button" disabled={busy||!!proposal} onClick={()=>setDialog('reset')}><RotateCcw size={14}/>End game early…</button>}
  {phase==='ended'&&g.timeline&&<button className="text-button" onClick={openLog}><ScrollText size={14}/>Game log</button>}
  </>}</>}
  {phase==='ended'&&g.bets?.list&&<section className="bet-panel"><span className="eyebrow"><Dices size={13}/>SPECTATOR BETS</span>{g.bets.list.map((b,i)=><p key={i} className="bet-result"><span>{b.username} · {b.stake} on <span className={b.team}>{b.team}</span></span><b className={b.outcome}>{b.outcome==='won'?`+${b.stake}`:b.outcome==='lost'?`−${b.stake}`:b.outcome==='pending'?'…':'returned'}</b></p>)}{g.bets.status==='refunded'&&<small>This game was not recorded, so every stake was returned.</small>}</section>}
  <p className="rail-credit">Unofficial. Blood on the Clocktower and its character art are by The Pandemonium Institute. <a href="https://bloodontheclocktower.com" target="_blank" rel="noreferrer">Original game ↗</a></p>
 </aside>
 <section className="table-section">
  <div className="table-topline"><h2>{phase==='welcome'?'Your seat is waiting':phase==='lobby'?'Pull up a chair':phase==='ended'?(g.called?'The game was called':`${g.winner==='good'?'Good':'Evil'} prevails`):night?`Night ${g.day}`:`Day ${g.day}`}</h2><div className="topline-right">{g?.spectators?.length>0&&<details className="watchers"><summary title="See who is watching"><Eye size={14}/>{g.spectators.length} watching</summary><div className="watchers-list" role="list"><span className="eyebrow">SPECTATORS</span>{g.spectators.map(n=><span role="listitem" key={n}>{n}{spectator&&n===g.me.name&&<em> you</em>}</span>)}<small>They see what the town sees: no characters, whispers or night information.</small></div></details>}<span className="phase-pill">{night?<Moon size={14}/>:phase==='day'?<Sun size={14}/>:<Users size={14}/>} {phase==='welcome'?'Waiting for a story':phase==='lobby'?`${seats.length} / 15 seated`:phase==='ended'?'Story complete':night?'Nightfall':g.paused?'Paused':`${countdown(g.nomination?.deadline||g.deadline,now)} left`}</span></div></div>
  {/* A table vote is a slim strip above the circle, so it never looks like a second copy of the night prompt below. */}
  {proposal&&<div className="table-vote" role="status"><RotateCcw size={15}/><p><strong>{nameOf(proposal.by)}</strong> asks to {proposal.kind==='lobby'?'end the game and go back to the lobby':'end the game and reveal every character'}. <span>{proposalYes} of {proposalNeed} agree · {countdown(proposal.deadline,now)}</span></p>{!spectator&&<div className="table-vote-actions"><button className={proposal.votes[g.me.id]===true?'primary compact':'secondary compact'} disabled={busy} onClick={()=>action('proposal_vote',{proposal:proposal.id,yes:true})}><Check size={14}/>Agree</button><button className={proposal.votes[g.me.id]===false?'primary compact':'secondary compact'} disabled={busy} onClick={()=>action('proposal_vote',{proposal:proposal.id,yes:false})}><X size={14}/>Keep playing</button></div>}</div>}
  <div className="town-circle"><div className="town-inner"><div className="circle-orbit outer"/>
   {sweep&&<div key={sweep.at} className={`circle-sweep ${sweep.kind}`} aria-hidden="true"/>}
   {tallyOn&&(()=>{const i=seats.findIndex(p=>p.id===tallyOn);return i<0?null:<div className="tally-hand" style={{transform:`rotate(${i/seats.length*360}deg)`}} aria-hidden="true"><i/></div>;})()}
   {tally?(()=>{const b=tally.b,yes=tallyYes.size,need=Math.ceil(living/2);
    const verdict=!b.qualified?'Not enough votes':block?.id===b.target?`${nameOf(b.target)} is on the block`:leaders.length>1&&leaders.some(l=>l.target===b.target)?'A tie, so nobody is on the block':'Not more than the leading vote';
    return <div className={`centerpiece tally ${tally.done?'done':''}`} aria-live="polite"><span className="tally-label">{tally.done?'The count':'Counting'} · {nameOf(b.target)}</span><span key={yes} className={`tally-count ${yes>0?'up':''} ${tally.done&&b.qualified?'enough':''}`}>{yes}</span><span className="center-sub">{tally.done?verdict:`${need} needed`}</span></div>;})()
   :chosen?<div className="seat-menu" role="group" aria-label={`Actions for ${chosen.name}`}><button className="icon-button seat-menu-close" onClick={()=>setSelected(null)} aria-label="Clear selection"><X size={15}/></button><h3><Named name={chosen.name} look={chosen.look}/>{chosen.id===g.me.id?' (you)':''}</h3><button className="primary compact" disabled={busy||g.paused||!!nominateBlock} title={nominateBlock} onClick={()=>action('nominate',{target:chosen.id})}><Hand size={14}/>Nominate</button>{chosen.id!==g.me.id&&<button className="secondary compact" onClick={()=>{openChat(chosen.id);setSelected(null);}}><MessageCircle size={14}/>Whisper</button>}{g.me.moonPending&&chosen.alive&&<button className="primary compact" disabled={busy||g.paused} onClick={()=>action('moonchild',{target:chosen.id})}><Target size={14}/>Moonchild: choose</button>}{script==='tb'&&<button className="secondary compact" disabled={busy||g.paused||!!g.nomination||g.me.slayerUsed} title={g.me.slayerUsed?'You already took your shot.':''} onClick={()=>setDialog('slayer')}><Target size={14}/>Slayer shot</button>}{host&&chosen.pictured&&chosen.id!==g.me.id&&<button className="secondary compact" disabled={busy} onClick={()=>action('hide_avatar',{target:chosen.id})}>{chosen.avatarHidden?<Eye size={14}/>:<EyeOff size={14}/>}{chosen.avatarHidden?'Show picture':'Hide picture'}</button>}{chosen.account&&<button className="secondary compact" onClick={()=>{openLeaders(chosen.account);setSelected(null);}}><Trophy size={14}/>Profile</button>}{nominateBlock&&<small>{nominateBlock}</small>}</div>
   :<div className="centerpiece"><ClockArt timer={dayTimer(g,now)}/><span className="center-sub">{phase==='welcome'||phase==='lobby'?'TRUST IS A FRAGILE THING':phase==='ended'?'EVERY SECRET HAS A STORY':`${living} LIVING · ${seats.length-living} DEAD`}</span></div>}
   {seats.map((p,i)=>{const a=i/seats.length*Math.PI*2-Math.PI/2,canPick=!p.empty&&pickable(p);return <button key={p.id} className={`seat ${p.empty?'empty':''} ${!p.alive?'dead':''} ${p.away&&phase!=='ended'?'away':''}${p.id===g?.me.id?'you':''} ${targets.includes(p.id)||selected===p.id?'selected':''} ${g?.nomination?.target===p.id?'nominated':''} ${g?.pending&&canPick?'pickable':''} ${tallyYes.has(p.id)?'tally-yes':''} ${tallyOn===p.id?'tally-on':''} ${fallen.includes(p.id)?'falling':''}`} style={{left:`${50+41*Math.cos(a)}%`,top:`${50+41*Math.sin(a)}%`}} onClick={()=>choose(p.id)} disabled={p.empty||!canPick} aria-label={`${p.name}, ${p.alive?'alive':'dead'}${p.away&&phase!=='ended'?', offline':''}${p.id===g?.me.id?', you':''}`}><span className={`seat-token${p.empty?'':frameOf(p.look)}`}>{p.empty?<Armchair size={18}/>:phase==='ended'?<RoleIcon id={p.initialRole}/>:!p.alive?<Skull size={18}/>:<Avatar src={p.avatar} name={p.name}/>}{p.id===g?.host&&<Crown className="host-crown" size={12}/>}{g?.nomination?.hands[p.id]&&<span className="hand-indicator"><Hand size={11}/></span>}</span><span className="seat-name"><Named name={p.name} look={p.look}/>{p.id===g?.me.id&&<em>you</em>}</span><span className="seat-sub">{p.empty?'Open':phase==='ended'?ROLES[p.initialRole].name:p.away?'Offline':p.claim?`Claims ${ROLES[p.claim].name}`:!p.alive?(p.ghost?'Ghost vote left':'No vote left'):p.ready?'Ready':phase==='lobby'&&p.look?.title?<Title look={p.look}/>:' '}</span></button>;})}
  </div></div>
  {!g?<div className="action-bar"><div className="bar-text"><strong>Everyone has a part to play.</strong><p>A secret character. A circle of friends. Nobody has to sit out as Storyteller.</p></div></div>
  :phase==='lobby'?<div className="action-bar"><Users size={22}/><div className="bar-text"><strong>{seats.length<5?`Waiting for ${5-seats.length} more player${seats.length===4?'':'s'}.`:'Ready when the host is.'}</strong><p>Join from separate devices. Keep this browser to reconnect to your seat.</p></div></div>
  :phase==='ended'?<div className="action-bar"><Crown size={22}/><div className="bar-text"><strong>{g.called?'Every secret is out.':g.winner==='good'?'The town survives.':'The shadows take the town.'}</strong><p>{g.reason}</p>{(()=>{const note=[spectator?'':recordNote(g.record,accountsOn).trim(),host?'':'The host can start a new game at this link.'].filter(Boolean).join(' ');return note&&<small className="bar-note">{note}</small>;})()}</div><div className="bar-actions"><button className="secondary compact" onClick={openLog}><ScrollText size={14}/>Game log</button><button className="secondary compact" onClick={()=>updateLocal({finaleSeen:false})}>See the reveal</button>{g.record?.points&&<button className="secondary compact" onClick={()=>openShop()}><Store size={14}/>Shop</button>}{host&&<button className="secondary compact" disabled={busy} onClick={()=>action('rematch')}>New game</button>}</div></div>
  :spectator?<div className="action-bar"><Eye size={22}/><div className="bar-text"><strong>{g.nomination?`${nameOf(g.nomination.target)} stands accused · ${Object.values(g.nomination.hands).filter(Boolean).length} hands raised`:night?'The town is asleep.':block?`${block.name} is on the block (${maxVotes} votes).`:'The town is talking.'}</strong><p>You are watching. Spectators can read the Town square but cannot talk, vote or see characters.{g.spectators?.length>1?` ${g.spectators.length} people are watching.`:''}</p></div></div>
  :g.pending?<div className="action-bar urgent"><Moon size={22}/><div className="bar-text"><span className="eyebrow">YOUR TURN{g.pending.deadline?` · ${Math.max(0,Math.ceil((g.pending.deadline-now)/1000))}s LEFT`:''}</span><strong>{prompts[g.pending.role]}</strong><p>{pendingHint} {targets.length>0&&<b>Selected: {targets.map(nameOf).join(' + ')}</b>}</p>{g.pending.character&&<select className="night-guess" aria-label="Choose a character" value={guess} onChange={e=>setGuess(e.target.value)}><option value="">Choose a character…</option>{scriptRoles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select>}</div><div className="bar-actions">{g.pending.optional&&<button className="secondary compact" disabled={busy} onClick={()=>action('night',{key:g.pending.key,skip:true})}>{g.pending.role==='po'?'Choose nobody':'Not tonight'}</button>}<button className="primary compact" disabled={busy||targets.length!==g.pending.count||(g.pending.character&&!guess)} onClick={()=>action('night',{key:g.pending.key,targets,...(g.pending.character?{character:guess}:{})})}>Confirm choice <Check size={15}/></button></div></div>
  :night?<div className="action-bar"><Moon size={22}/><div className="bar-text"><strong>The town is asleep. You have nothing to do right now.</strong><p>Other players are making their choices. Dawn comes a little while after they finish, never straight away, so the length of the night gives nothing away.</p>{tonight.map(item=><p className="tonight-info" key={item.id}>{item.text}</p>)}</div></div>
  :g.nomination?<div className="action-bar vote"><Hand size={22}/><div className="bar-text"><span className="eyebrow">VOTE · {g.paused?'PAUSED':`${countdown(g.nomination.deadline,now)} LEFT`}</span><strong>{nameOf(g.nomination.target)} stands accused</strong><p>{Object.values(g.nomination.hands).filter(Boolean).length} of {Math.ceil(living/2)} needed votes raised. Hands are public and can change until the timer ends.{!me.alive?' A yes uses your ghost vote.':''}{g.me.role==='butler'?(g.me.master?` You are the Butler: you can raise your hand only while ${nameOf(g.me.master)}’s is up, and it comes down with theirs.`:' You are the Butler and have no master yet, so you cannot vote.'):''}</p></div><div className="bar-actions"><button className={g.nomination.hands[me.id]?'primary compact':'secondary compact'} title={butlerBlocked?'Your master’s hand is not raised.':''} disabled={busy||g.paused||(!me.alive&&!me.ghost)||butlerBlocked} onClick={()=>action('vote',{nomination:g.nomination.id,yes:!g.nomination.hands[me.id]})}><Hand size={15}/>{g.nomination.hands[me.id]?'Lower hand':'Raise hand'}</button></div></div>
  :<div className="action-bar"><Sun size={22}/><div className="bar-text"><strong>{block?`${block.name} is on the block (${maxVotes} votes).`:leaders.length>1?'The leading vote is tied.':'The floor belongs to the town.'}</strong><p>{g.me.moonPending?'You are the Moonchild. Click a living player and choose them. Everyone will see your choice.':block?'They will be executed at dusk unless a nomination changes the result.':script==='tb'?'Click a player to nominate, whisper, or take a Slayer shot.':'Click a player to nominate or whisper.'}</p></div><div className="bar-actions">{host&&<button className="icon-button" disabled={busy} onClick={()=>action('pause')} aria-label={g.paused?'Resume timers':'Pause timers'} title={g.paused?'Resume timers':'Pause timers'}>{g.paused?<Play size={16}/>:<Pause size={16}/>}</button>}{me.alive&&<button className={me.ready?'primary compact':'secondary compact'} disabled={busy||g.paused} onClick={()=>action('ready')} title="The day ends early when all living players are ready. Offline players count as ready.">{me.ready?<Check size={15}/>:<Moon size={15}/>}{me.ready?'Ready':'Ready for dusk'} ({readyCount}/{living})</button>}</div></div>}
 </section>
 <aside className="chat-list" aria-label="Chats">
  <h2 className="chat-list-title">Chats</h2>
  {!g?<p className="small chat-list-empty">Join a table to see your chats here.</p>:<div className="chat-rows">
   {!spectator&&<><ChatRow active={view==='journal'} icon={<LockKeyhole size={15}/>} title="Journal" preview={journalUnread?'New from the Storyteller':'Your private Storyteller notes'} unread={journalUnread} onClick={()=>openChat('journal')}/>
   <ChatRow active={view==='notes'} icon={<NotebookPen size={15}/>} title="My notes" preview="Only on this device" onClick={()=>openChat('notes')}/>
   <div className="chat-divider"/></>}
   <ChatRow active={view==='town'} icon={<Hash size={15}/>} title="Town square" preview={townLast?previewOf(townLast):'Everyone at the table'} time={townLast&&clock(townLast.at)} unread={unreadOf('town')} onClick={()=>openChat('town')}/>
   {groups.map(c=>{const last=convOf(c.id).at(-1);return <ChatRow key={c.id} active={view===c.id} icon={<Users size={15}/>} title={c.title} preview={last?previewOf(last):`${c.members.length} members`} time={last&&clock(last.at)} unread={unreadOf(c.id)} onClick={()=>openChat(c.id)}/>;})}
   {!spectator&&!night&&seats.length>=3&&<ChatRow icon={<Plus size={15}/>} title="New group" preview="Pick a few players to talk to" onClick={newGroup}/>}
   {whispers.map(({p,last})=><ChatRow key={p.id} active={view===p.id} dead={!p.alive} look={p.look} icon={p.alive?<Avatar src={p.avatar} name={p.name}/>:<Skull size={14}/>} title={p.name} preview={previewOf(last)} time={last&&clock(last.at)} unread={unreadOf(p.id)} onClick={()=>openChat(p.id)}/>)}
  </div>}
 </aside>
 <aside className="conversation" aria-label="Conversation">
  {!g?<div className="empty-conversation"><MessageCircle size={30}/><h3>Whispers start here.</h3><p>Join a table to talk to the town, or pull someone aside for a private conversation.</p></div>:<>
  <header className="conversation-head"><button className="icon-button conversation-back" onClick={()=>setChatOpen(false)} aria-label="Back to chats"><ArrowLeft size={18}/></button><div><strong>{view==='town'?'Town square':view==='journal'?'Journal':view==='notes'?'My notes':viewGroup?viewGroup.title:viewPlayer?.name}</strong><small>{view==='town'?'Everyone at the table':view==='journal'?'Private. Everything the Storyteller told you.':view==='notes'?'Only on this device':viewGroup?listNames(viewGroup.members.map(id=>id===g.me.id?'You':nameOf(id))):'Private. Only the two of you can read this.'}</small></div>{viewGroup&&<button className="icon-button group-leave" disabled={busy} onClick={()=>action('group_leave',{group:viewGroup.id})} aria-label="Leave this group" title="Leave this group"><LogOut size={15}/></button>}</header>
  {view==='journal'?<div className="journal-feed">{g.me.inbox.length===0&&<p className="small">Your night information will be kept here.</p>}{g.me.inbox.slice().reverse().map(item=><JournalEntry key={item.id} item={item}/>)}<h3 className="log-heading">Town chronicle</h3>{g.events.slice().reverse().map(ev=><div className="event" key={ev.id}><span>{ev.day?`${ev.phase==='night'?'N':'D'}${ev.day}`:'•'}</span><p>{ev.text}</p></div>)}{phase==='ended'&&<><h3 className="log-heading">Behind the curtain</h3><p className="small">Fixed red herring: {g.redHerring}. Demon bluffs: {g.bluffs.join(', ')}.</p>{g.decisions.map((d,i)=><details className="decision" key={i}><summary>{d.day?`Round ${d.day} · `:''}{d.basis}</summary><p>{String(d.result)}</p><small>{d.reason}</small></details>)}</>}</div>
  :view==='notes'?<div className="notes-panel"><textarea aria-label="Private game notes" placeholder="Claims, contradictions, who you trust…" value={notes} onChange={e=>{setNotes(e.target.value);localStorage.setItem(`rw_notes_${gameKey}`,e.target.value);}}/></div>
  :<><div className="chat-feed">{feed.length===0&&<div className="chat-empty">{view==='town'?'A new story, a quiet square. Say hello.':viewGroup?'Only the members of this group can read this conversation.':'Only you and this player can read this conversation.'}</div>}{feed.map((m,i)=>{const prev=feed[i-1],grouped=prev&&prev.from===m.from&&m.at-prev.at<300000,own=m.from===g.me.id;return <div className={`chat-message ${own?'own':''} ${grouped?'grouped':''} ${m.sending?'sending':''}`} key={m.cid||m.id}>{!grouped&&<ChatFace who={g.players.find(p=>p.id===m.from)} name={nameOf(m.from)} onOpen={openLeaders}/>}<div>{!grouped&&<strong><Named name={nameOf(m.from)} look={g.players.find(p=>p.id===m.from)?.look}/><time>{clock(m.at)}</time></strong>}<p>{m.statement&&<span className="statement-tag"><Megaphone size={11}/>Gossip statement</span>}{m.text}</p></div></div>;})}<div ref={chatEnd}/></div>
  <form className="chat-form" onSubmit={e=>{e.preventDefault();send();}}><textarea rows={1} aria-label={view==='town'?'Message the town':viewGroup?'Message this group':'Private whisper'} placeholder={spectator?'Spectators can read, but not write.':night?'The town is asleep…':statement&&canState?'Make your public statement':view==='town'?'Message the town':viewGroup?`Message ${viewGroup.title}`:`Whisper to ${viewPlayer?.name}`} value={chat} onChange={e=>setChat(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send();}}} disabled={night||spectator} maxLength={1000}/>{canState&&<button className={`statement-toggle ${statement?'on':''}`} type="button" aria-pressed={statement} aria-label="Make this a once-a-day Gossip statement" title="Make this a once-a-day Gossip statement" onClick={()=>setStatement(s=>!s)}><Megaphone size={15}/></button>}<button className="send-button" type="submit" disabled={night||spectator||!chat.trim()} aria-label="Send message"><Send size={15}/></button></form></>}
  </>}
 </aside>
 </main>
 {g&&<nav className="screen-tabs" aria-label="Game sections"><button className={screen==='table'?'active':''} onClick={()=>setScreen('table')}><Users size={17}/>Table{g.pending&&<i className="tab-dot"/>}</button><button className={screen==='you'?'active':''} onClick={()=>setScreen('you')}><User size={17}/>You</button><button className={screen==='chats'?'active':''} onClick={()=>setScreen('chats')}><MessageCircle size={17}/>Chats{totalUnread>0&&<span className="badge">{totalUnread}</span>}</button></nav>}
 {revealDue&&<RoleReveal key={gameKey} role={g.me.role} pool={scriptRoles.map(r=>r.id)} waiting={!!g.pending} onDone={()=>updateLocal({revealSeen:true})}/>}
 {finaleDue&&!dialog&&<Finale g={g} host={host} busy={busy} onClose={()=>updateLocal({finaleSeen:true})} onNewGame={()=>action('rematch')} onLog={openLog}/>}
 {(dawnDue||newsDue)&&!dialog&&!dawnHold&&<div className="modal-backdrop"><section className="modal dawn" role="dialog" aria-modal="true" aria-label={dawnDue?`Dawn of day ${g.day}`:'A private message'}>{dawnDue?<><span className="eyebrow"><Sun size={14}/>DAWN · DAY {g.day}</span><h2>{deaths.length?`${listNames(deaths)} died in the night.`:'Nobody died in the night.'}</h2></>:<><span className="eyebrow"><LockKeyhole size={14}/>A PRIVATE MESSAGE</span><h2>The Storyteller has news for you.</h2></>}<h3>{dawnDue?'Your private night':'Only you can see this'}</h3>{popupItems.length?popupItems.map(item=><JournalEntry key={item.id} item={item}/>):<p className="small">The Storyteller had nothing for you tonight.</p>}<small>This is saved in your Journal.</small><button className="primary" autoFocus onClick={()=>updateLocal({dawn:g.day,inbox:inboxCount})}>{dawnDue?'Begin the day':'Got it'}<ArrowRight size={17}/></button></section></div>}
 {dialog&&<div className="modal-backdrop" onClick={()=>setDialog(null)}><section className="modal" role="dialog" aria-modal="true" aria-label={dialog==='account'?'Your account':dialog==='slayer'?'Confirm public Slayer claim':dialog==='reset'?'End the game early':dialog==='group'?'Start a group chat':dialog==='create'?'Create a game':'Join a game'} onClick={e=>e.stopPropagation()}><button className="modal-close icon-button" aria-label="Close dialog" onClick={()=>setDialog(null)}><X size={20}/></button>{dialog==='account'?(account?<><span className="eyebrow">YOUR ACCOUNT</span><h2><Named name={account.username} look={account.look}/></h2><Title look={account.look}/><div className="account-picture"><Face className="account-avatar" src={account.avatar} name={account.username} look={account.look}/><div className="account-picture-actions"><label className={`secondary compact file-button ${busy?'disabled':''}`}><Camera size={14}/>{account.avatar?'Change picture':'Add a picture'}<input type="file" accept="image/*" disabled={busy} onChange={e=>{choosePicture(e.target.files[0]);e.target.value='';}}/></label>{account.avatar&&<button className="text-button" disabled={busy} onClick={()=>setPicture(null)}>Remove picture</button>}</div></div><p className="small">You stay logged in on this browser, and your seat follows you to any computer you log in on. If other people use this computer, log out when you finish.</p>{afterAuth&&<button className="primary" onClick={()=>{setDialog(afterAuth);setAfterAuth(null);}}>Continue<ArrowRight size={17}/></button>}<div className="account-actions">{!afterAuth&&<span className="account-links"><button className="secondary compact" onClick={()=>openLeaders(account.username)}><Trophy size={14}/>Your record</button><button className="secondary compact" onClick={()=>openShop()}><Store size={14}/>Shop</button></span>}<button className="text-button" disabled={busy} onClick={logOut}><LogOut size={14}/>Log out</button></div></>:<><span className="eyebrow">OPTIONAL · NO EMAIL NEEDED</span><h2>{authMode==='register'?'Make an account.':'Welcome back.'}</h2><p>Get a profile picture, and your seat back from any computer.</p><form onSubmit={e=>{e.preventDefault();signIn();}}><label>Username<input autoFocus value={authName} maxLength={20} minLength={2} required autoComplete="username" onChange={e=>setAuthName(e.target.value)}/></label><label>Password<input type="password" value={password} minLength={6} maxLength={72} required autoComplete={authMode==='register'?'new-password':'current-password'} onChange={e=>setPassword(e.target.value)}/></label><button className="primary" disabled={busy}>{authMode==='register'?'Create account':'Log in'}<ArrowRight size={17}/></button></form><button className="text-button" onClick={()=>setAuthMode(authMode==='register'?'login':'register')}>{authMode==='register'?'Already have an account? Log in':'New here? Make an account'}</button>{authMode==='register'&&<small>There is no email reset, so keep your password somewhere safe.</small>}</>):dialog==='reset'?<><span className="eyebrow">END THIS GAME EARLY</span><h2>Ask the table.</h2><p>Ending a game early needs a majority of the players who are online. They get a minute to agree. Either way, nobody wins and the game is not recorded.</p><div className="reset-choices"><button className="secondary" disabled={busy} onClick={()=>action('propose',{kind:'reveal'})}><Eye size={16}/><span><strong>Reveal every character and end</strong><small>Everyone sees who was who, and the full game log.</small></span></button><button className="secondary" disabled={busy} onClick={()=>action('propose',{kind:'lobby'})}><RotateCcw size={16}/><span><strong>Go back to the lobby</strong><small>Characters stay secret. Everyone keeps their seat, and new players can join.</small></span></button></div></>:dialog==='group'?<><span className="eyebrow">A PRIVATE CIRCLE</span><h2>Start a group.</h2><p>Only the players you pick can read it, and only they will see that it exists.</p><form onSubmit={e=>{e.preventDefault();submitGroup();}}><label>Group name<input autoFocus value={groupTitle} maxLength={30} placeholder="Optional" onChange={e=>setGroupTitle(e.target.value)}/></label><fieldset className="member-pick"><legend>Invite at least two players</legend>{seats.filter(p=>p.id!==g.me.id).map(p=><label key={p.id}><input type="checkbox" checked={groupPick.includes(p.id)} onChange={()=>setGroupPick(prev=>prev.includes(p.id)?prev.filter(x=>x!==p.id):[...prev,p.id])}/>{p.name}{!p.alive&&' (dead)'}</label>)}</fieldset><button className="primary" disabled={busy||groupPick.length<2}>Create group<ArrowRight size={17}/></button></form></>:dialog==='slayer'?<><span className="eyebrow">A PUBLIC, ONCE-PER-GAME CLAIM</span><h2>Take your shot?</h2><p>Everyone will see you claim Slayer and target {chosen?.name}. Anyone can bluff this action. Only a functioning Slayer can cause a death.</p><button className="primary" disabled={busy} onClick={()=>action('slayer',{target:selected})}>Shoot {chosen?.name}<Target size={16}/></button></>:<><span className="eyebrow">THE STORY BEGINS WITH YOU</span><h2>{dialog==='create'?'Gather your circle.':'A seat at the table.'}</h2><p>{dialog==='create'?'Create a room code and invite 4–14 friends. The host plays too.':'Enter your name and the code from your host.'}</p><form onSubmit={e=>{e.preventDefault();action(dialog==='create'?'create':'join');}}><label>Your name<input autoFocus value={name} maxLength={24} required placeholder="What should the town call you?" onChange={e=>setName(e.target.value)}/></label>{dialog==='join'&&<label>Room code<input className="code-input" value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,''))} maxLength={8} minLength={8} required placeholder="ABCDEFGH"/></label>}<button className="primary" disabled={busy}>{busy?'Taking your seat…':dialog==='create'?'Create the table':'Join the table'}<ArrowRight size={17}/></button>{dialog==='join'&&<button type="button" className="secondary" disabled={busy||!name.trim()||joinCode.length!==8} onClick={()=>action('spectate')}><Eye size={16}/>Just watch</button>}</form>{dialog==='join'&&<small>Spectators can watch a game already in progress, but cannot talk or vote.</small>}<small>No account needed. Your seat is saved in this browser.</small>{accountsOn&&!account&&<button className="text-button" onClick={()=>openAccount(dialog)}><Camera size={14}/>Make an account to add a picture</button>}</>}</section></div>}
 {drawer&&<div className="drawer-backdrop" onClick={()=>setDrawer(null)}><section className="handbook" role="dialog" aria-modal="true" aria-label={drawer==='roles'?'Character reference':drawer==='leaders'?'Players':drawer==='log'?'Game log':drawer==='shop'?'Shop':'How to play and Storyteller policy'} onClick={e=>e.stopPropagation()}><button className="modal-close icon-button" aria-label="Close reference" onClick={()=>setDrawer(null)}><X size={21}/></button>{drawer==='roles'?<><span className="eyebrow">THE CHARACTER ALMANAC</span><h2>Know the possibilities.</h2><p>All {scriptRoles.length} {SCRIPTS[script]} characters. The script is public; who is in play is a secret.</p><SetupChart script={script} players={g?seats.length:null}/><div className="role-tabs">{Object.entries(types).map(([key,name])=><button className={tab===key?'active':''} key={key} onClick={()=>setTab(key)}>{name}</button>)}</div>{scriptRoles.filter(r=>r.type===tab).map(r=><article className={`reference-card ${r.type}`} key={r.id}><span className="reference-symbol"><RoleIcon id={r.id}/></span><div><h3>{r.name}</h3><p>{r.help}</p><a href={r.wiki} target="_blank" rel="noreferrer">Official rules & strategy ↗</a></div></article>)}</>:drawer==='leaders'?<Leaderboard key={leaderPlayer||''} me={account?.username} start={leaderPlayer} onWallet={gotWallet}/>:drawer==='log'?(g?.timeline?<GameLog g={g}/>:<p className="small">The game log opens when the game ends.</p>):drawer==='shop'?<Shop account={account} wallet={wallet} onWallet={gotWallet} inGame={!!g&&!['lobby','ended'].includes(phase)} onLogin={()=>{setDrawer(null);openAccount();}}/>:<Help/>}</section></div>}
 </div>;
}
function Help(){return <><span className="eyebrow">WELCOME TO RAVENSWOOD BLUFF</span><h2>Trust a little.<br/>Question everything.</h2><p>A social deduction game for 5–15 human players. The website runs the Storyteller; you bring the conversation.</p>{[
 ['Two teams. One hidden Demon.','Good wins when no living Demon remains. Evil wins when only two players live. Character abilities can change this: read your role and the public script.'],
 ['Secrets at night. Stories by day.','At night, the prompt under the table tells you when it is your turn. At dawn, a popup shows who died and what you learned; it stays in your Journal. By day, share information, bluff, whisper, and nominate. Use the built-in text chat, or a voice call of your choice.'],
 ['Put it to a vote.','Each living player may nominate once per day; each player may be nominated once. Raise or lower your public hand during the voting timer. Votes lock together and are counted clockwise. At least half the living players must vote yes. The unique highest qualifying total is executed at dusk; a tie means no execution.'],
 ['Death is not the end.','Dead players keep talking and win with their team. They cannot nominate, and have one remaining yes vote for the entire game. Most character abilities stop at death.'],
 ['An automatic, rules-bound Storyteller.','A weighted rules-based policy estimates team pressure from living roles and votes against the Demon. It may support declared evil bluffs, vary legal Spy/Recluse registration, offer helpful impaired information, or redirect a Mayor attack. It does not read or understand chat like a language model.'],
 ['Fairness before theatrics.','Healthy information is constrained by the rules, including legal misregistration. False information stays believable: never an impossible number, and never a pairing that names you or your own character. The engine never invents poison, moves the red herring, changes your chosen targets, or manipulates vote totals to balance the game. Discretionary decisions are revealed after the game.'],
 ['The rhythm of this table.','Days have a host-selected timer, pausable by the host. All living players can agree to end a day early, and offline players count as ready. Nominations pause the day timer. At night, each player has 30 seconds to make their choice once it reaches their screen; if they run out of time, or are offline, the Storyteller makes it for them. Dawn always comes 5 to 15 seconds after the last choice, so the length of a night gives nothing away. Rejoin using the same browser and room link, or log in to your account on any computer. Whispers and private group chats stay open except at night. Any player can ask the table to end a game early, either by revealing every character or by going back to the lobby; a majority of the players who are online must agree. In the lobby, the host can remove absent players. A Butler can only raise their hand while their master’s hand is up, and it comes down with theirs.'],
 ['Watching a game.','Anyone with the room code can watch, even after a game has started. Spectators see the seats, the votes and the Town square, but cannot talk or vote, and see no characters, whispers or night information until the game ends. A spectator can take a seat when the table is back in the lobby. When a game ends, the game log shows what everyone chose each night and what the Storyteller told them.'],
 ['Bad Moon Rising.','The host can pick this harder game mode in the lobby. It has 25 different characters and more ways to die, and drunkenness replaces most poison. Once a day, any living player can use the megaphone in the Town square to make a tagged public statement. If the real Gossip’s statement was true, a player dies that night; anyone else is bluffing. Statements must be definite, like “Ana is evil” or “the Demon sits next to Bo”, or the Storyteller will ask you to reword them.'],
 ['Small towns, big secrets.','At 5 or 6 players, Minions and the Demon do not learn one another, and the Demon receives no starting bluffs. At 7–15, they receive the normal evil-team introduction. No Travellers or other editions are included.']
 ].map(([title,text],i)=><article className="help-step" key={title}><span>{String(i+1).padStart(2,'0')}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}<div className="sources"><h3>Built from the official rules</h3>{['Trouble_Brewing','Setup','Rules_Explanation','Abilities','States','Storyteller_Advice','Mayor','Butler'].map(p=><a key={p} href={`https://wiki.bloodontheclocktower.com/${p}`} target="_blank" rel="noreferrer">{p.replaceAll('_',' ')} ↗</a>)}</div></>;}
