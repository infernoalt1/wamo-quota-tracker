// Lasting results for logged-in players. Rooms are forgotten after six hours; these are not.
import { randomUUID } from 'node:crypto';
import { results } from './engine.mjs';
import { SCRIPTS } from './characters.mjs';
import { pictureOf, keyOf, usernameOf } from './accounts.mjs';
import { adminKeys } from './admin.mjs';
import { POINTS, lookOf, CHAMPION_STYLE, championStyleOf, stillStyleOf } from './cosmetics.mjs';

// With fewer accounts at the table, one person with several browser profiles could farm wins.
export const MIN_ACCOUNTS=3;

const tally=rows=>({games:rows.length,wins:rows.filter(r=>r.won).length});
// The daily bonus resets at midnight UTC, the same moment for everyone.
export const dayStart=(now=Date.now())=>new Date(Math.floor(now/86400000)*86400000);
// Leaderboard rounds run Monday–Thursday and Friday–Sunday, from midnight Pacific time (where the players are).
// The winner of one round is champion during the next.
const ZONE='America/Los_Angeles',DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const zoned=new Intl.DateTimeFormat('en-US',{timeZone:ZONE,year:'numeric',month:'numeric',day:'numeric',weekday:'short',hour:'numeric',minute:'numeric',second:'numeric',hourCycle:'h23'});
const partsAt=t=>Object.fromEntries(zoned.formatToParts(t).map(p=>[p.type,p.value]));
// The moment a Pacific calendar day begins. Date.UTC rolls day overflow into the next month, so y/m/d can run past month ends.
function midnight(y,m,d){
  let t=Date.UTC(y,m,d,8);
  for(let i=0;i<3;i++){const p=partsAt(t);t+=Date.UTC(y,m,d)-Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);}
  return t;
}
export function roundOf(now=Date.now()){
  const p=partsAt(now),dow=DAYS.indexOf(p.weekday),early=dow>=1&&dow<=4;
  const back=early?dow-1:(dow+2)%7,y=+p.year,m=+p.month-1,d=+p.day-back;
  return {start:new Date(midnight(y,m,d)),end:new Date(midnight(y,m,d+(early?4:3))),name:early?'Monday–Thursday':'Friday–Sunday'};
}
// Each win in a row is worth more than the last. `before` is how many wins in a row came before this one.
export const streakBonus=before=>Math.min(POINTS.streakMax,POINTS.streak*before);
// Points for one player's game, itemised so the end screen can explain them.
export function pointsFor(p,firstWinToday,streak=0){
  const parts=[['Finished the game',POINTS.finish]];
  if(p.won)parts.push(['Your team won',POINTS.win]);
  if(p.won&&p.demon)parts.push(['Won as the Demon',POINTS.demon]);
  if(p.won&&firstWinToday)parts.push(['First win today',POINTS.daily]);
  if(p.won&&streak>0)parts.push([`${streak+1} wins in a row`,streakBonus(streak)]);
  return {total:parts.reduce((n,[,v])=>n+v,0),parts};
}
// The round's board: most points first, then most wins, then fewest games.
const byPoints=(a,b)=>b.points-a.points||b.wins-a.wins||a.games-b.games||a.username.localeCompare(b.username);
const entry=t=>({username:t.username,avatar:pictureOf(t),look:lookOf(t.look),points:t.points,games:t.games,wins:t.wins});
const refuse=(message,status=400)=>Object.assign(Error(message),{status,expose:true});
// The champion writes their own title: any text up to the limit, with invisible characters taken out.
export function championTitleOf(value){
  const v=String(value??'').normalize('NFKC').replace(/\p{C}/gu,'').replace(/\s+/g,' ').trim();
  if(!v||[...v].length>CHAMPION_STYLE.maxLength)throw refuse(`Titles are 1–${CHAMPION_STYLE.maxLength} characters.`);
  return v;
}
// From the Hall of Champions (newest first): rounds won per account, and the title each player keeps once they have won enough.
// The kept title is the last one they wrote, held still.
export function keptTitles(hall){
  const wins=new Map(),kept=new Map();
  for(const h of hall)wins.set(h.id,(wins.get(h.id)||0)+1);
  for(const h of hall)if(h.title&&wins.get(h.id)>=CHAMPION_STYLE.keep&&!kept.has(h.id))kept.set(h.id,{title:h.title,style:stillStyleOf(championStyleOf(h.style))});
  return {wins,kept};
}
const scriptOf=value=>value&&value!=='all'?(Object.hasOwn(SCRIPTS,value)?value:null):undefined;

// The player list is alphabetical and shows no results, so it cannot be read as a ranking.
function standings(totals){
  return totals.map(t=>({username:t.username,avatar:pictureOf(t),look:lookOf(t.look),games:t.games}))
    .sort((a,b)=>a.username.localeCompare(b.username,undefined,{sensitivity:'base'}));
}
function profileOf(account,rows){
  const counts=new Map();
  for(const r of rows){const c=counts.get(r.initial_role)||[];c.push(r);counts.set(r.initial_role,c);}
  return {
    username:account.username,avatar:pictureOf(account),look:lookOf(account.look),...tally(rows),
    survived:rows.filter(r=>r.survived).length,
    good:tally(rows.filter(r=>!r.evil)),evil:tally(rows.filter(r=>r.evil)),
    demonWins:rows.filter(r=>r.demon&&r.won).length,
    scripts:Object.keys(SCRIPTS).map(id=>({id,...tally(rows.filter(r=>r.script===id))})).filter(s=>s.games),
    characters:[...counts].map(([role,list])=>({role,...tally(list)})).sort((a,b)=>b.games-a.games||b.wins-a.wins).slice(0,5),
    recent:rows.slice(0,10).map(r=>({script:r.script,endedAt:new Date(r.ended_at).getTime(),players:r.players,role:r.initial_role,finalRole:r.role,evil:r.evil,won:r.won,survived:r.survived})),
  };
}

// `onRecorded(game,status)` hears how each finished game ended up: saved, skipped, called or failed.
export function mountLeaderboard(router,{store,rooms,identity=()=>null,admins=adminKeys(),clock=Date.now,onRecorded=()=>{}}){
  const handle=fn=>async(req,res)=>{try{
    if(!store)throw refuse('The leaderboard is not set up on this server.',503);
    await fn(req,res);
  }catch(e){if(!e.expose)console.error('BOTC leaderboard:',e.message);res.status(e.expose?e.status:503).json({error:e.expose?e.message:'The leaderboard is unavailable right now.'});}};
  router.get('/leaderboard',handle(async(req,res)=>{
    const script=scriptOf(req.query.script);
    if(script===null)throw refuse('Unknown game mode.');
    res.json({minAccounts:MIN_ACCOUNTS,players:standings(await store.totals(script))});
  }));
  router.get('/leaderboard/player',handle(async(req,res)=>{
    const account=await store.byKey(keyOf(usernameOf(req.query.username)));
    if(!account)throw refuse('No player has that name.',404);
    res.json({minAccounts:MIN_ACCOUNTS,player:profileOf(account,await store.history(account.id))});
  }));

  // Every reign is written down, so wins can be counted. The reign under way follows last round's board (an account marked
  // as an alt loses it); a past reign nobody loaded the board during is filled in from its round's games, once per server start.
  let crowned='',filled=null;
  async function crown(start,top){
    const key=`${start.getTime()}:${top?.id||''}`;if(crowned===key)return;
    await (top?store.crown(start,top.id,true):store.uncrown(start));crowned=key;
  }
  function fill(start){
    if(filled?.at===start.getTime())return filled.done;
    const done=(async()=>{
      // Champions from the old weekly board were filed under midnight UTC, between round starts. Each moves to the reign
      // it began (the next round start), and if that reign is already written down for the same player, its title joins it.
      const old=await store.hall();
      for(const h of old){
        const at=new Date(h.week);if(roundOf(at.getTime()).start.getTime()===at.getTime())continue;
        const to=roundOf(at.getTime()).end,there=old.find(x=>new Date(x.week).getTime()===to.getTime());
        if(!there||there.id===h.id&&!there.title&&h.title)await store.setChampion(to,h.id,h.title,h.style);
        await store.uncrown(at);
      }
      const first=await store.firstGameAt();if(!first)return;
      const have=new Set((await store.hall()).map(h=>new Date(h.week).getTime()));
      for(let r=roundOf(new Date(first).getTime()).end;r<start;r=roundOf(r.getTime()).end){
        if(have.has(r.getTime()))continue;
        const top=(await store.weekly(roundOf(r.getTime()-1).start,r)).sort(byPoints)[0];
        if(top)await store.crown(r,top.id,false);
      }
    })().catch(e=>{filled=null;throw e;});
    filled={at:start.getTime(),done};return done;
  }
  // The round a reign was won in: the one before it began.
  const wonIn=week=>{const end=new Date(week).getTime();return {start:roundOf(end-1).start.getTime(),end,name:roundOf(end-1).name};};
  // This round's board, last round's winner (the reigning champion), everyone on a win streak of two or more,
  // the Hall of Champions and the titles players have kept.
  async function week(){
    const {start,end,name}=roundOf(clock()),last=roundOf(start.getTime()-1).start;
    const [rows,prev,streaks]=await Promise.all([store.weekly(start,end),store.weekly(last,start),store.streaks(2)]);
    const top=prev.sort(byPoints)[0]||null;
    await crown(start,top);await fill(start);
    const hall=await store.hall(),{wins,kept}=keptTitles(hall),marked=new Set(),now=hall.find(h=>new Date(h.week).getTime()===start.getTime()&&h.id===top?.id);
    return {start:start.getTime(),ends:end.getTime(),round:name,players:rows.sort(byPoints).slice(0,10).map(entry),
      champion:top&&{...entry(top),title:now?.title??null,style:now?.title?championStyleOf(now.style):null,wins:wins.get(top.id)||0},
      streaks:Object.fromEntries(streaks.map(s=>[s.username,s.streak])),
      hall:hall.slice(0,30).map(h=>({week:new Date(h.week).getTime(),won:wonIn(h.week),username:h.username,avatar:pictureOf(h),look:lookOf(h.look),
        title:h.title,style:h.title?stillStyleOf(championStyleOf(h.style)):null,wins:wins.get(h.id),
        // The round whose title the player keeps: their newest with one, once they have won enough.
        kept:!!h.title&&kept.has(h.id)&&!marked.has(h.id)&&!!marked.add(h.id)})),
      kept:Object.fromEntries(hall.filter(h=>kept.has(h.id)).map(h=>[h.username,kept.get(h.id)])),
      wins:Object.fromEntries(hall.map(h=>[h.username,wins.get(h.id)]))};
  }
  router.get('/leaderboard/week',handle(async(req,res)=>res.json(await week())));
  // Seated in a game being played: the champion's title can't change then, so it can never carry a signal mid-game.
  const playing=session=>[...rooms.values()].some(room=>{if(!room.state.includes(session))return false;const g=JSON.parse(room.state);return !['lobby','ended'].includes(g.phase)&&g.players.some(p=>p.session===session);});
  router.post('/leaderboard/champion-title',handle(async(req,res)=>{
    if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw refuse('Use the game website to change your title.',403);
    const session=identity(req),account=session?await store.bySession(session):null;
    if(!account)throw refuse('Log in first.',401);
    const {start}=roundOf(clock()),top=(await store.weekly(roundOf(start.getTime()-1).start,start)).sort(byPoints)[0];
    // An admin can clear a title nobody should see: the reigning champion's, or any round's in the Hall (`week`).
    if(req.body?.clear){
      if(!admins.has(keyOf(account.username)))throw refuse('Only an admin can clear the champion’s title.',403);
      const at=req.body.week===undefined?start:Number.isSafeInteger(req.body.week)?new Date(req.body.week):null;
      if(!at)throw refuse('Choose a round.');
      await store.clearTitle(at);
      return res.json(await week());
    }
    if(top?.id!==account.id)throw refuse('Only the reigning champion can write the title.',403);
    if(playing(session))throw refuse('Change your title between games.');
    await store.setChampion(start,account.id,championTitleOf(req.body?.title),championStyleOf(req.body?.style));
    res.json(await week());
  }));

  // Rewrite a room's saved state, but only while it still holds the same finished game.
  function settle(code,id,change){
    const room=rooms.get(code);if(!room)return;
    const game=JSON.parse(room.state);if(game.ledger?.id!==id)return;
    change(game.ledger);rooms.set(code,{state:JSON.stringify(game),updated:room.updated});
  }
  async function write(code,id,game){
    try{
      const rows=results(game),accounts=await store.accountIds(rows.map(r=>r.session));
      const players=rows.filter(r=>accounts.has(r.session)).map(({session,...r})=>({...r,account:accounts.get(session)}));
      if(players.length<MIN_ACCOUNTS){settle(code,id,l=>{l.status='skipped';});onRecorded(game,'skipped');return;}
      const wonToday=await store.wonSince(players.filter(p=>p.won).map(p=>p.account),dayStart());
      const streaks=await store.streaksOf(players.filter(p=>p.won).map(p=>p.account));
      const earned=new Map(players.map(p=>[p.account,pointsFor(p,!wonToday.has(p.account),p.won?streaks.get(p.account)||0:0)]));
      players.forEach(p=>{p.points=earned.get(p.account).total;});
      await store.saveGame({id,script:game.settings.script,winner:game.winner,reason:game.reason,size:rows.length,players});
      settle(code,id,l=>{
        l.status='saved';l.sessions=rows.filter(r=>accounts.has(r.session)).map(r=>r.session);
        l.points=Object.fromEntries(l.sessions.map(s=>[s,earned.get(accounts.get(s))]));
      });
      onRecorded(game,'saved');
    }catch(e){console.error('BOTC leaderboard:',e.message);settle(code,id,l=>{l.status='failed';});onRecorded(game,'failed');}
  }
  return {
    // Called just before a game is saved. Marking the game first means it is written exactly once.
    // Going back to the lobby clears the mark, and a game abandoned that way never reaches here.
    noteEnd(game){
      if(!store||game.phase!=='ended'||game.ledger)return;
      // A game the table voted to stop has no winner, so it earns nothing and is not recorded.
      if(game.called){game.ledger={id:randomUUID(),status:'called',sessions:[]};onRecorded(game,'called');return;}
      const id=randomUUID();game.ledger={id,status:'pending',sessions:[]};
      queueMicrotask(()=>write(game.code,id,structuredClone(game)));
    },
    statusFor:(game,session)=>game.ledger?{status:game.ledger.status,counted:game.ledger.sessions.includes(session),needed:MIN_ACCOUNTS,...(game.ledger.points?.[session]?{points:game.ledger.points[session]}:{})}:null,
  };
}
