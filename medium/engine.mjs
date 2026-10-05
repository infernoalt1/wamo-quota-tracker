import { randomUUID, randomInt } from 'node:crypto';
import bank from '../sketch-party/words.mjs';
export const cleanWords = text => [...new Set(String(text).split(/[\n,;\r]+/).map(w => w.trim().toLowerCase()).filter(w => /^[a-z]+(?:[-'][a-z]+)*$/.test(w) && w.length <= 30))];
export const WORDS = cleanWords(bank.join('\n'));
export function schedule(ids) {
  const ring = [...ids]; if (ring.length % 2) ring.push(null);
  return Array.from({length:ring.length-1}, () => {
    const pairs = Array.from({length:ring.length/2}, (_,i) => [ring[i],ring[ring.length-1-i]].filter(Boolean));
    ring.splice(1,0,ring.pop()); return pairs;
  });
}
export function createRoom(code) { return {code, phase:'lobby', players:[], settings:{mode:'rotating', rounds:6, source:'default', custom:[], order:[]}, round:0, groups:[], history:[], recent:[], updated:Date.now()}; }
export function addPlayer(r,name) {
  name = String(name || '').trim();
  if (!name || name.length>24) throw Error('Choose a name between 1 and 24 characters.');
  if (r.phase!=='lobby' || r.players.length>=8) throw Error('This room is full or already playing.');
  if(r.players.some(p=>p.name.toLowerCase()===name.toLowerCase())) throw Error('That name is already taken.');
  const p={id:randomUUID(),token:randomUUID(),name,score:0,ready:false,connected:true};
  r.players.push(p); r.host ||= p.id; r.settings.order=r.players.map(p=>p.id); return p;
}
function nextRound(r) {
  r.round++;
  const ids = r.settings.order;
  // Preserve fixed teams; the final trio rotates its bye when the roster is odd.
  const fixed = ids.length%2 ? [...ids.slice(0,-3), ...ids.slice(-3).filter((_,i)=>i!==(r.round-1)%3)] : ids;
  const pairings = r.settings.mode==='rotating' ? r.schedule[(r.round-1)%r.schedule.length] : Array.from({length:fixed.length/2},(_,i)=>fixed.slice(i*2,i*2+2));
  r.groups=pairings.filter(p=>p.length===2).map((players,i)=> {
    const words=[];
    for(let j=0;j<2;j++) {
      let available=r.pool.filter(w=>!r.recent.includes(w)&&!words.includes(w));
      if(!available.length) {r.recent=[]; available=r.pool.filter(w=>!words.includes(w));}
      const w=available[randomInt(available.length)]; words.push(w); r.recent.push(w);
      if(r.recent.length>Math.min(100,r.pool.length-2)) r.recent.shift();
    }
    return {id:i,players,words,attempt:1,answers:{},reveal:null,done:false,points:0,attempts:[]};
  });
  r.phase='playing';
}
function resetToLobby(r) {
  r.phase='lobby'; r.players.forEach(p=>{p.ready=false;p.score=0;});
  r.groups=[]; r.history=[]; r.round=0; r.schedule=[]; r.pool=[]; r.recent=[];
}
export function act(r,p,m) {
  const host=()=>{if(p.id!==r.host) throw Error('Only the host can do that.');};
  if(m.action==='ready') {if(r.phase!=='lobby') throw Error('Game already started.'); p.ready=!p.ready;}
  else if(m.action==='settings') {
    host(); if(r.phase!=='lobby') throw Error('Settings are locked during a game.');
    const s=m.settings || {};
    if(!['rotating','fixed'].includes(s.mode)||!['default','custom','mixed'].includes(s.source)||!Number.isInteger(s.rounds)||s.rounds<1||s.rounds>20) throw Error('Invalid settings.');
    const order=s.order || r.players.map(p=>p.id);
    if(order.length!==r.players.length||new Set(order).size!==order.length||order.some(id=>!r.players.some(p=>p.id===id))) throw Error('Assign every player once.');
    r.settings={mode:s.mode,source:s.source,rounds:s.rounds,custom:cleanWords(s.custom || '').slice(0,10000),order};
    r.players.forEach(p=>p.ready=false);
  } else if(m.action==='start') {
    host(); if(r.phase!=='lobby'||r.players.length<2||!r.players.every(p=>p.ready&&p.connected)) throw Error('At least two players must be connected and ready.');
    r.pool=[...new Set([...(r.settings.source!=='custom'?WORDS:[]),...(r.settings.source!=='default'?r.settings.custom:[])])];
    if(r.pool.length<2) throw Error('Add at least two valid words to your list.');
    r.schedule=schedule(r.settings.order); r.round=0; r.history=[]; r.players.forEach(p=>p.score=0); nextRound(r);
  } else if(m.action==='submit') {
    const g=r.groups.find(g=>g.players.includes(p.id));
    if(r.phase!=='playing'||!g||g.done||g.reveal||g.answers[p.id]) throw Error('Wait for the next attempt.');
    const answer=String(m.word||'').trim().toLowerCase();
    if(!/^[a-z]+(?:[-'][a-z]+)*$/.test(answer)||answer.length>30) throw Error('Enter one English word (up to 30 letters).');
    g.answers[p.id]=answer;
    if(g.players.every(id=>g.answers[id])) {
      g.reveal=g.players.map(id=>g.answers[id]); g.attempts.push({words:[...g.words],answers:[...g.reveal]});
      const match=g.reveal[0]===g.reveal[1]; g.done=match||g.attempt===3;
      if(match) {g.points=4-g.attempt; g.players.forEach(id=>r.players.find(p=>p.id===id).score+=g.points);}
      if(r.groups.every(g=>g.done)) {r.phase='results'; r.history.push({round:r.round,groups:structuredClone(r.groups)});}
    }
  } else if(m.action==='continue') {
    const g=r.groups.find(g=>g.players.includes(p.id));
    if(r.phase!=='playing'||!g?.reveal||g.done) throw Error('No next attempt yet.');
    g.words=[...g.reveal]; g.reveal=null; g.answers={}; g.attempt++;
  } else if(m.action==='next') {
    host(); if(r.phase!=='results') throw Error('Wait for every pair to finish.');
    if(r.round>=r.settings.rounds) r.phase='finished'; else nextRound(r);
  } else if(m.action==='reset') {
    host(); resetToLobby(r);
  } else if(m.action==='kick') {
    host();
    if(m.player===r.host) throw Error('The host cannot kick themselves.');
    if(!r.players.some(p=>p.id===m.player)) throw Error('Player not found.');
    r.players=r.players.filter(p=>p.id!==m.player);
    r.settings.order=r.settings.order.filter(id=>id!==m.player);
    resetToLobby(r);
  } else throw Error('Unknown action.');
  r.updated=Date.now();
}
export function snapshot(r,p) {
  return {code:r.code,host:r.host,me:p.id,phase:r.phase,round:r.round,settings:{...r.settings,custom:p.id===r.host?r.settings.custom:[],customCount:r.settings.custom.length},bankCount:WORDS.length,
    players:r.players.map(({id,name,score,ready,connected})=>({id,name,score,ready,connected})),history:r.history,
    groups:r.groups.map(({answers,...g})=>({...g,submitted:Object.keys(answers),mine:answers[p.id]||null}))};
}
