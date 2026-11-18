// Lasting results for logged-in players. Rooms are forgotten after six hours; these are not.
import { randomUUID } from 'node:crypto';
import { results } from './engine.mjs';
import { SCRIPTS } from './characters.mjs';
import { pictureOf, keyOf, usernameOf } from './accounts.mjs';

// With fewer accounts at the table, one person with several browser profiles could farm wins.
export const MIN_ACCOUNTS=3;
// Below this many games a win rate says little, so those players are listed but not ranked.
export const MIN_GAMES=5;

const tally=rows=>({games:rows.length,wins:rows.filter(r=>r.won).length});
const rate=(wins,games)=>games?wins/games:0;
const scriptOf=value=>value&&value!=='all'?(Object.hasOwn(SCRIPTS,value)?value:null):undefined;

function standings(totals){
  const players=totals.map(t=>({username:t.username,avatar:pictureOf(t),games:t.games,wins:t.wins,good:{games:t.good_games,wins:t.good_wins},evil:{games:t.evil_games,wins:t.evil_wins},demonWins:t.demon_wins}));
  const ranked=players.filter(p=>p.games>=MIN_GAMES).sort((a,b)=>rate(b.wins,b.games)-rate(a.wins,a.games)||b.wins-a.wins||b.games-a.games||a.username.localeCompare(b.username));
  const unranked=players.filter(p=>p.games<MIN_GAMES).sort((a,b)=>b.games-a.games||b.wins-a.wins||a.username.localeCompare(b.username));
  return [...ranked.map((p,i)=>({rank:i+1,...p})),...unranked.map(p=>({rank:null,...p}))];
}
function profileOf(account,rows){
  const counts=new Map();
  for(const r of rows){const c=counts.get(r.initial_role)||[];c.push(r);counts.set(r.initial_role,c);}
  return {
    username:account.username,avatar:pictureOf(account),...tally(rows),
    survived:rows.filter(r=>r.survived).length,
    good:tally(rows.filter(r=>!r.evil)),evil:tally(rows.filter(r=>r.evil)),
    demonWins:rows.filter(r=>r.demon&&r.won).length,
    scripts:Object.keys(SCRIPTS).map(id=>({id,...tally(rows.filter(r=>r.script===id))})).filter(s=>s.games),
    characters:[...counts].map(([role,list])=>({role,...tally(list)})).sort((a,b)=>b.games-a.games||b.wins-a.wins).slice(0,5),
    recent:rows.slice(0,10).map(r=>({script:r.script,endedAt:new Date(r.ended_at).getTime(),players:r.players,role:r.initial_role,finalRole:r.role,evil:r.evil,won:r.won,survived:r.survived})),
  };
}

export function mountLeaderboard(router,{store,rooms}){
  const refuse=(message,status=400)=>Object.assign(Error(message),{status,expose:true});
  const handle=fn=>async(req,res)=>{try{
    if(!store)throw refuse('The leaderboard is not set up on this server.',503);
    await fn(req,res);
  }catch(e){if(!e.expose)console.error('BOTC leaderboard:',e.message);res.status(e.expose?e.status:503).json({error:e.expose?e.message:'The leaderboard is unavailable right now.'});}};
  router.get('/leaderboard',handle(async(req,res)=>{
    const script=scriptOf(req.query.script);
    if(script===null)throw refuse('Unknown game mode.');
    res.json({minGames:MIN_GAMES,minAccounts:MIN_ACCOUNTS,players:standings(await store.totals(script))});
  }));
  router.get('/leaderboard/player',handle(async(req,res)=>{
    const account=await store.byKey(keyOf(usernameOf(req.query.username)));
    if(!account)throw refuse('No player has that name.',404);
    res.json({minAccounts:MIN_ACCOUNTS,player:profileOf(account,await store.history(account.id))});
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
      if(players.length<MIN_ACCOUNTS)return settle(code,id,l=>{l.status='skipped';});
      await store.saveGame({id,script:game.settings.script,winner:game.winner,reason:game.reason,size:rows.length,players});
      settle(code,id,l=>{l.status='saved';l.sessions=rows.filter(r=>accounts.has(r.session)).map(r=>r.session);});
    }catch(e){console.error('BOTC leaderboard:',e.message);settle(code,id,l=>{l.status='failed';});}
  }
  return {
    // Called just before a game is saved. Marking the game first means it is written exactly once.
    // Going back to the lobby clears the mark, and a game abandoned that way never reaches here.
    noteEnd(game){
      if(!store||game.phase!=='ended'||game.ledger)return;
      const id=randomUUID();game.ledger={id,status:'pending',sessions:[]};
      queueMicrotask(()=>write(game.code,id,structuredClone(game)));
    },
    statusFor:(game,session)=>game.ledger?{status:game.ledger.status,counted:game.ledger.sessions.includes(session),needed:MIN_ACCOUNTS}:null,
  };
}
