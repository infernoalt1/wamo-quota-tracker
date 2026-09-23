import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomUUID,randomInt} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import words from './words.mjs';
import {guessPoints,artistPoints,emojiAvatar,wordHint} from './rules.mjs';

export const rooms=new Map();
const VERSION='4';
const assets=new Map(await Promise.all(['index.html','app.js','style.css','rules.mjs'].map(async name=>[name,await readFile(new URL(name,import.meta.url))])));
const clean=(v,n=100)=>String(v??'').trim().slice(0,n);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||a));
export const normalize=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const playerInfo=p=>({id:p.id,name:p.name,avatar:p.avatar,score:p.score,guessed:p.guessed,earned:p.earned,late:p.late});
const knows=(r,p)=>p.id===r.drawer||p.guessed;
const isSpectator=(r,p)=>['choose','draw'].includes(r.phase)&&p.id!==r.drawer&&!r.eligible.includes(p.id);
function send(p,type,data){for(const stream of p.streams)stream.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);}
function broadcast(r,type,data){r.players.forEach(p=>send(p,type,data));}
function chat(r,text,kind='system',name=''){broadcast(r,'chat',{text,kind,name});}
export function snapshot(r,p,now=Date.now()){
  return {code:r.code,host:r.host,players:r.players.map(q=>({...playerInfo(q),spectator:isSpectator(r,q)})),phase:r.phase,drawer:r.drawer,
    round:r.round,rounds:r.rounds,duration:r.duration,seconds:Math.max(0,Math.ceil((r.deadline-now)/1000)),turn:r.turn,
    channel:r.phase==='draw'?(knows(r,p)?'solved':'guessing'):'everyone',spectator:isSpectator(r,p),
    word:r.phase==='reveal'||knows(r,p)?r.word:null,
    mask:r.word?wordHint(r.word,r.hints||[],now-r.startedAt,r.duration*1000):null,
    choices:p.id===r.drawer&&r.phase==='choose'?r.choices:[],you:p.id,
    results:r.phase==='reveal'?r.results:[],standings:r.phase==='finished'?[...r.roster.values()].map(q=>({...playerInfo(q),left:!r.players.includes(q)})):[],
    finishReason:r.finishReason,settingsRevision:r.settingsRevision,customWords:r.host===p.id?r.customWords:undefined};
}
function state(r){r.players.forEach(p=>send(p,'state',snapshot(r,p)));}
function finish(r,reason='Game complete!'){
  r.phase='finished';r.deadline=0;r.drawer=null;r.word=null;r.finishReason=reason;r.players.forEach(p=>p.guessed=false);state(r);
}
function next(r){
  if(r.players.length<2){finish(r,'Not enough players to continue. Invite a friend for the next game.');return;}
  r.queue=r.queue.filter(id=>r.players.some(p=>p.id===id));
  if(!r.queue.length){
    if(r.round>=r.rounds){finish(r);return;}
    r.round++;r.queue=r.players.map(p=>p.id);
  }
  r.drawer=r.queue.shift();r.turn++;r.phase='choose';r.word=null;r.strokes=[];r.results=[];
  r.eligible=r.players.filter(p=>p.id!==r.drawer).map(p=>p.id);
  r.players.forEach(p=>{p.guessed=false;p.earned=0;p.lastChat=0;});
  const pool=[...r.words];r.choices=[];while(r.choices.length<3&&pool.length)r.choices.push(pool.splice(randomInt(pool.length),1)[0]);
  r.deadline=Date.now()+15000;broadcast(r,'drawing',[]);state(r);
}
function choose(r,word){
  r.word=word;r.phase='draw';r.startedAt=Date.now();r.deadline=r.startedAt+r.duration*1000;
  // Freeze the scoring audience when drawing begins; late arrivals are spectators.
  r.eligible=r.eligible.filter(id=>r.players.some(p=>p.id===id));r.guesses=new Map();r.settled=false;
  const positions=[...word].flatMap((c,i)=>/[a-z0-9]/i.test(c)?[i]:[]);r.hints=[];
  while(r.hints.length<Math.min(2,Math.max(0,[...word].filter(c=>/[a-z0-9]/i.test(c)).length-1))&&positions.length)r.hints.push(positions.splice(randomInt(positions.length),1)[0]);
  checkDone(r);state(r);
}
function reveal(r,reason=''){
  if(r.phase!=='draw'||r.settled)return;
  r.settled=true;
  const times=[...r.guesses.values()],first=times.length?Math.min(...times):0;
  const awards=new Map(r.eligible.map(id=>[id,r.guesses.has(id)?guessPoints(r.guesses.get(id),first,r.duration*1000):0]));
  awards.set(r.drawer,artistPoints(times,r.eligible.length,r.duration*1000));
  r.results=[...awards].map(([id,earned])=>{const p=r.roster.get(id);p.earned=earned;p.score+=earned;return{...playerInfo(p),left:!r.players.includes(p),artist:id===r.drawer};});
  r.phase='reveal';r.deadline=Date.now()+8000;chat(r,`The word was ${r.word}.${reason?' '+reason:''}`);state(r);
}
function checkDone(r){if(r.phase!=='draw')return;const active=r.players.filter(p=>r.eligible.includes(p.id));if(!r.players.some(p=>p.id===r.drawer)||active.every(p=>r.guesses.has(p.id)))reveal(r);}
function removePlayer(r,p){
  if(!r.players.includes(p))return;
  r.players=r.players.filter(q=>q!==p);for(const stream of p.streams)stream.end?.();p.streams.clear();
  if(!r.players.length){rooms.delete(r.code);return;}
  if(r.host===p.id)r.host=r.players[0].id;
  chat(r,`${p.name} left the room.`);
  if(r.phase==='draw')checkDone(r);
  else if(r.phase==='choose'&&(r.drawer===p.id||r.players.length<2))next(r);
  state(r);
}
function settings(r,b){
  let custom=r.customWords;
  if(b.words!==undefined){
    if(!Array.isArray(b.words))throw Error('Words must be a list.');
    custom=[...new Set(b.words.map(w=>clean(w,40).toLowerCase()).filter(w=>/^[a-z][a-z -]*$/.test(w)))].slice(0,2000);
    if(custom.length>0&&custom.length<3)throw Error('Add at least three distinct words, or leave the list empty.');
  }
  if(b.rounds!==undefined)r.rounds=Math.round(clamp(b.rounds,1,10));
  if(b.duration!==undefined)r.duration=Math.round(clamp(b.duration,30,180));
  r.customWords=custom;r.words=custom.length?custom:words;
  r.settingsRevision++;
}
export function tick(now=Date.now()){
  for(const r of rooms.values()){
    // Five seconds allows automatic SSE reconnects and page refreshes.
    for(const p of [...r.players])if(!p.streams.size&&now-p.lastSeen>(p.connectedOnce?5000:15000))removePlayer(r,p);
    if(!rooms.has(r.code))continue;
    if(r.deadline&&now>=r.deadline){if(r.phase==='choose')choose(r,r.choices[0]);else if(r.phase==='draw')reveal(r);else if(r.phase==='reveal')next(r);}else state(r);
  }
}
export async function handleRequest(req,res){
  const url=new URL(req.url,'http://localhost');
  try{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Sketch-Version',VERSION);
    if(url.pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({app:'sketch-party',version:VERSION}));return;}
    if(url.pathname==='/events'){
      const r=rooms.get(url.searchParams.get('room')),p=r?.players.find(p=>p.token===url.searchParams.get('token'));
      if(!p){res.writeHead(401);res.end();return;}
      res.writeHead(200,{'Content-Type':'text/event-stream','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write(': connected\n\n');p.streams.add(res);p.connectedOnce=true;p.lastSeen=Date.now();send(p,'drawing',r.strokes);state(r);
      res.on('close',()=>{p.streams.delete(res);if(!p.streams.size)p.lastSeen=Date.now();});return;
    }
    if(req.method==='POST'&&url.pathname==='/api'){
      let body='';for await(const chunk of req){body+=chunk;if(body.length>200000)throw Error('Request too large');}const b=JSON.parse(body);
      let r=rooms.get(clean(b.room).toUpperCase()),p=r?.players.find(p=>p.token===b.token),result={ok:true};
      if(b.action==='create'||b.action==='join'){
        const avatar=emojiAvatar(b.avatar??'🙂');
        if(b.action==='create'){
          let code;do{code=randomInt(0,36**6).toString(36).padStart(6,'0').toUpperCase();}while(rooms.has(code));
          r={code,players:[],roster:new Map(),phase:'lobby',round:0,rounds:3,duration:80,turn:0,deadline:0,strokes:[],eligible:[],queue:[],results:[],settingsRevision:0,words,customWords:[]};settings(r,b);rooms.set(code,r);
        }
        if(!r)throw Error('Room not found. Check the invite code.');if(r.players.length>=12)throw Error('This room is full.');
        p={id:randomUUID(),token:randomUUID(),name:clean(b.name,20)||'Artist',avatar,score:0,earned:0,guessed:false,late:!['lobby','finished'].includes(r.phase),streams:new Set(),lastSeen:Date.now()};
        r.players.push(p);r.roster.set(p.id,p);r.host??=p.id;if(p.late)r.queue.push(p.id);
        result={room:r.code,token:p.token};chat(r,`${p.name} joined${p.late?' — playing from the next drawing':''}.`);state(r);
      }else{
        if(!r||!p)throw Error('Room expired. Create or join a new room.');p.lastSeen=Date.now();
        if(r.phase==='draw'&&Date.now()>=r.deadline)reveal(r);
        if(b.action==='resume'){result={room:r.code,token:p.token};}
        else if(b.action==='leave'){removePlayer(r,p);}
        else if(b.action==='avatar'){p.avatar=emojiAvatar(b.avatar);state(r);}
        else if(b.action==='settings'){if(p.id!==r.host||r.phase!=='lobby')throw Error('Only the host can change settings in the lobby.');settings(r,b);state(r);}
        else if(b.action==='rematch'){if(p.id!==r.host||r.phase!=='finished')throw Error('Only the host can return to the lobby after a game.');r.phase='lobby';r.word=null;r.drawer=null;r.deadline=0;r.results=[];r.players.forEach(q=>{q.guessed=false;q.earned=0;});state(r);}
        else if(b.action==='start'){
          if(p.id!==r.host||r.phase!=='lobby')throw Error('Only the host can start from the lobby.');if(r.players.length<2)throw Error('Invite at least one friend to play.');
          r.players.forEach(q=>{q.score=0;q.late=false;});r.roster=new Map(r.players.map(q=>[q.id,q]));r.queue=[];r.round=0;r.finishReason=null;next(r);
        }else if(b.action==='choose'){if(r.phase!=='choose'||p.id!==r.drawer||!r.choices.includes(b.word))throw Error('Invalid word choice.');choose(r,b.word);}
        else if(b.action==='stroke'){
          if(r.phase!=='draw'||p.id!==r.drawer)throw Error('It is not your turn.');if(r.strokes.length>=15000)throw Error('Drawing limit reached.');
          const s=b.stroke;if(!s||!/^#[0-9a-f]{6}$/i.test(s.color)||!Array.isArray(s.points)||!s.points.length||s.points.length>100||s.points.some(pt=>!Number.isFinite(pt?.x)||!Number.isFinite(pt?.y)))throw Error('Invalid stroke');
          const stroke={color:s.color,size:clamp(s.size,1,60),points:s.points.map(pt=>({x:clamp(pt.x,0,1000),y:clamp(pt.y,0,700)}))};r.strokes.push(stroke);r.players.filter(q=>q!==p).forEach(q=>send(q,'stroke',stroke));
        }else if(b.action==='clear'||b.action==='undo'){if(r.phase!=='draw'||p.id!==r.drawer)throw Error('It is not your turn.');if(b.action==='clear')r.strokes=[];else r.strokes.pop();broadcast(r,'drawing',r.strokes);}
        else if(b.action==='chat'){
          const value=clean(b.text);if(!value)throw Error('Enter a guess.');if(Date.now()-(p.lastChat||0)<350)throw Error('A little slower, please.');p.lastChat=Date.now();
          if(r.phase==='draw'&&!knows(r,p)&&normalize(value)===normalize(r.word)){
            if(isSpectator(r,p)){send(p,'chat',{kind:'system',text:'That is correct! You can score from the next drawing.'});}
            else{p.guessed=true;r.guesses.set(p.id,Math.max(0,Date.now()-r.startedAt));send(p,'solved',{word:r.word});chat(r,`${p.name} guessed the word!`,'correct');checkDone(r);state(r);}
          }else if(r.phase==='draw'){
            if(isSpectator(r,p)){send(p,'chat',{kind:'system',text:'You are watching this turn. Chat and guess from the next drawing.'});}
            else{const privateChat=knows(r,p);r.players.filter(q=>!privateChat||knows(r,q)).forEach(q=>send(q,'chat',{text:value,kind:privateChat?'private':'message',name:p.name,channel:privateChat?'solved':'guessing',turn:r.turn}));}
          }else chat(r,value,'message',p.name);
        }else throw Error('Unknown action.');
      }
      res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));return;
    }
    const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/rules.mjs':'rules.mjs'},file=files[url.pathname];if(!file){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':/\.m?js$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});res.end(assets.get(file));
  }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}
}
export const server=http.createServer(handleRequest);
const timer=setInterval(tick,1000);timer.unref();
if(process.argv[1]===fileURLToPath(import.meta.url))server.listen(Number(process.env.PORT)||3210,'0.0.0.0',()=>console.log('Sketch Party → http://localhost:'+(process.env.PORT||3210)));
