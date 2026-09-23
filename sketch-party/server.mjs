import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID, randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import words from './words.mjs';
import {guessPoints, artistPoints, emojiAvatar} from './rules.mjs';
export const rooms = new Map();
const VERSION='3';
// Keep UI files and server rules from the same startup, even during edits.
const assets=new Map(await Promise.all(['index.html','app.js','style.css','rules.mjs'].map(async name=>[name,await readFile(new URL(name,import.meta.url))])));
const clamp = (v,a,b) => Math.min(b,Math.max(a,Number(v)||a));
const clean = (v,n=100) => String(v??'').trim().slice(0,n);
export const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g,'');
function send(p,type,data){ for(const stream of p.streams) stream.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`); }
function broadcast(r,type,data){r.players.forEach(p=>send(p,type,data));}
function state(r){r.players.forEach(p=>send(p,'state',{code:r.code,host:r.host,players:r.players.map(({id,name,avatar,score,guessed,earned})=>({id,name,avatar,score,guessed,earned})),phase:r.phase,drawer:r.drawer,round:r.round,rounds:r.rounds,seconds:Math.max(0,Math.ceil((r.deadline-Date.now())/1000)),duration:r.duration,turn:r.turn,channel:r.phase==='draw'?(p.id===r.drawer||p.guessed?'solved':'guessing'):'everyone',word:r.phase==='reveal'||p.id===r.drawer||p.guessed?r.word:null,mask:r.word?.replace(/[a-z0-9]/gi,'_'),choices:p.id===r.drawer&&r.phase==='choose'?r.choices:[],you:p.id}));}
function chat(r,text,kind='system',name=''){broadcast(r,'chat',{text,kind,name});}
function next(r){
  r.turn++; if(r.turn>=r.order.length*r.rounds){r.phase='finished';r.deadline=0;chat(r,'Game over! Create a new masterpiece next time.');state(r);return;}
  r.round=Math.floor(r.turn/r.order.length)+1;r.drawer=r.order[r.turn%r.order.length];
  if(!r.players.some(p=>p.id===r.drawer)){next(r);return;}
  r.phase='choose';r.word=null;r.strokes=[];r.players.forEach(p=>{p.guessed=false;p.earned=0;});
  r.choices=[...r.words].sort(()=>Math.random()-.5).slice(0,3);r.deadline=Date.now()+15000;broadcast(r,'drawing',[]);state(r);
}
function choose(r,word){r.word=word;r.phase='draw';r.eligible=r.players.filter(p=>p.id!==r.drawer).map(p=>p.id);r.solved=0;r.artistAward=0;r.deadline=Date.now()+r.duration*1000;state(r);}
function reveal(r){if(r.phase!=='draw')return;r.phase='reveal';r.deadline=Date.now()+5000;chat(r,`The word was ${r.word}.`);state(r);}
export async function handleRequest(req,res){
  const url=new URL(req.url,'http://localhost');
  try {
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Sketch-Version',VERSION);
    if(url.pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({app:'sketch-party',version:VERSION}));return;}
    if(url.pathname==='/events'){
      const r=rooms.get(url.searchParams.get('room')),p=r?.players.find(p=>p.token===url.searchParams.get('token'));
      if(!p){res.writeHead(401);res.end();return;}
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write(': connected\n\n');p.streams.add(res);p.lastSeen=Date.now();
      send(p,'drawing',r.strokes);state(r);req.on('close',()=>{p.streams.delete(res);p.lastSeen=Date.now();});return;
    }
    if(req.method==='POST'&&url.pathname==='/api'){
      let body='';for await(const chunk of req){body+=chunk;if(body.length>200000)throw Error('Request too large');}const b=JSON.parse(body);
      let r=rooms.get(clean(b.room).toUpperCase()),p=r?.players.find(p=>p.token===b.token);let result={ok:true};
      if(b.action==='create'||b.action==='join'){
        const avatar=emojiAvatar(b.avatar??'\u{1F642}');
        if(b.action==='create'){
          let code;do{code=randomInt(0,36**6).toString(36).padStart(6,'0').toUpperCase();}while(rooms.has(code));
          const custom=Array.isArray(b.words)?[...new Set(b.words.map(w=>clean(w,40).toLowerCase()).filter(w=>/^[a-z][a-z -]*$/.test(w)))].slice(0,2000):[];
          r={code,players:[],phase:'lobby',round:0,rounds:clamp(b.rounds,1,10),duration:clamp(b.duration,30,180),deadline:0,strokes:[],words:custom.length>=3?custom:words};rooms.set(code,r);
        }
        if(!r)throw Error('Room not found. Check the invite code.');if(r.players.length>=12)throw Error('This room is full.');if(r.phase!=='lobby'&&r.phase!=='finished')throw Error('This game has started. Join after it finishes.');
        p={id:randomUUID(),token:randomUUID(),name:clean(b.name,20)||'Artist',avatar,score:0,guessed:false,streams:new Set(),lastSeen:Date.now()};r.players.push(p);r.host??=p.id;result={room:r.code,token:p.token};chat(r,`${p.name} joined the room.`);state(r);
      }else{
        if(!r||!p)throw Error('Please join a room first.');p.lastSeen=Date.now();
        if(b.action==='avatar'){p.avatar=emojiAvatar(b.avatar);state(r);}
        else if(b.action==='start') {if(p.id!==r.host)throw Error('Only the host can start.');if(!['lobby','finished'].includes(r.phase))throw Error('Game already started.');if(r.players.length<2)throw Error('Invite at least one friend to play.');r.players.forEach(p=>p.score=0);r.order=r.players.map(p=>p.id);r.turn=-1;next(r);}
        else if(b.action==='choose'){if(r.phase!=='choose'||p.id!==r.drawer||!r.choices.includes(b.word))throw Error('Invalid word choice.');choose(r,b.word);}
        else if(b.action==='stroke'){
          if(r.phase!=='draw'||p.id!==r.drawer)throw Error('It is not your turn.');if(r.strokes.length>=15000)throw Error('Drawing limit reached.');
          const s=b.stroke;if(!s||!/^#[0-9a-f]{6}$/i.test(s.color)||!Array.isArray(s.points)||s.points.length>100)throw Error('Invalid stroke');
          const stroke={color:s.color,size:clamp(s.size,1,60),points:s.points.map(pt=>({x:clamp(pt.x,0,1000),y:clamp(pt.y,0,700)}))};r.strokes.push(stroke);r.players.filter(q=>q.id!==p.id).forEach(q=>send(q,'stroke',stroke));
        }else if(b.action==='clear'||b.action==='undo'){if(r.phase!=='draw'||p.id!==r.drawer)throw Error('It is not your turn.');if(b.action==='clear')r.strokes=[];else r.strokes.pop();broadcast(r,'drawing',r.strokes);}
        else if(b.action==='chat'){
          if(r.phase==='draw'&&Date.now()>=r.deadline)reveal(r);
          const value=clean(b.text);if(!value)throw Error('Enter a guess.');if(Date.now()-(p.lastChat||0)<350)throw Error('A little slower, please.');p.lastChat=Date.now();
          if(r.phase==='draw'&&p.id!==r.drawer&&!p.guessed&&normalize(value)===normalize(r.word)){
            p.guessed=true;p.earned=guessPoints(r.deadline-Date.now(),r.duration*1000);p.score+=p.earned;
            r.solved++;const total=artistPoints(r.solved,r.eligible.length);const drawer=r.players.find(q=>q.id===r.drawer);if(drawer){drawer.score+=total-r.artistAward;drawer.earned=total;}r.artistAward=total;
            send(p,'solved',{word:r.word,points:p.earned});chat(r,`${p.name} guessed the word!`,'correct');
            if(r.players.filter(q=>q.id!==r.drawer).every(q=>q.guessed))reveal(r);state(r);
          }else if(r.phase==='draw'){
            const knows=p.id===r.drawer||p.guessed;
            r.players.filter(q=>(q.id===r.drawer||q.guessed)===knows).forEach(q=>send(q,'chat',{text:value,kind:knows?'private':'message',name:p.name,channel:knows?'solved':'guessing',turn:r.turn}));
          }else chat(r,value,'message',p.name);
        }else throw Error('Unknown action.');
      }
      res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));return;
    }
    const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/rules.mjs':'rules.mjs'};const file=files[url.pathname];if(!file){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':file.endsWith('.js')||file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});res.end(assets.get(file));
  }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}
}
export const server=http.createServer(handleRequest);
const timer=setInterval(()=>{for(const r of rooms.values()){
  const gone=r.players.filter(p=>!p.streams.size&&Date.now()-p.lastSeen>60000);if(gone.length){r.players=r.players.filter(p=>!gone.includes(p));if(!r.players.length){rooms.delete(r.code);continue;}if(!r.players.some(p=>p.id===r.host))r.host=r.players[0].id;if(gone.some(p=>p.id===r.drawer)&&r.phase==='draw')reveal(r);state(r);}
  if(r.deadline&&Date.now()>=r.deadline){if(r.phase==='choose')choose(r,r.choices[0]);else if(r.phase==='draw')reveal(r);else if(r.phase==='reveal')next(r);}else state(r);
}},1000);timer.unref();
if(process.argv[1]===fileURLToPath(import.meta.url))server.listen(Number(process.env.PORT)||3210,'0.0.0.0',()=>console.log('Sketch Party → http://localhost:'+(process.env.PORT||3210)));
