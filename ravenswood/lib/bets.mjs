// Spectators betting points on which team wins the game they are watching.
// Players never bet, so nobody can profit from throwing their own game. Bets close when Day 2 begins.
// A stake is only held in memory while the game runs: if the server restarts or the table goes back to the lobby,
// the bet is void and nothing is lost. Bets pay out only when the game is recorded; otherwise every stake is refunded.
import { BET } from './cosmetics.mjs';

const TEAMS=['good','evil'];
const refuse=(message,status=400)=>Object.assign(Error(message),{status,expose:true});

export function createBets({store}){
  // `${code}#${round}` → {code,round,bets:[{account,session,username,team,stake}],result:null|{status,winner}}
  const books=new Map();
  const keyOf=g=>`${g.code}#${g.round}`;
  const busy=new Set();
  const isOpen=g=>['night','day'].includes(g.phase)&&g.day<=1;
  // Points staked on games that are still being played. They cannot be spent until the bet settles.
  function heldFor(account){let n=0;for(const b of books.values())if(!b.result)for(const x of b.bets)if(x.account===account)n+=x.stake;return n;}

  async function place(game,session,account,team,stake){
    if(!game.spectators?.some(s=>s.session===session))throw refuse('Only spectators can bet, so nobody at the table can profit from their own game.');
    if(!isOpen(game))throw refuse('Bets close when Day 2 begins.');
    if(!TEAMS.includes(team))throw refuse('Bet on good or evil.');
    if(!Number.isInteger(stake)||stake<BET.min||stake>BET.max)throw refuse(`Bet between ${BET.min} and ${BET.max} points.`);
    const key=keyOf(game),book=books.get(key)||{code:game.code,round:game.round,bets:[],result:null};
    if(book.bets.some(b=>b.account===account.id))throw refuse('You have already bet on this game.');
    if(busy.has(account.id))throw refuse('One moment, your last bet is still going through.');
    busy.add(account.id);
    try{
      const w=await store.wallet(account.id),balance=w.earned-w.spent+(w.adjust||0)-heldFor(account.id);
      if(balance<stake)throw refuse('You do not have enough points for that bet.');
      book.bets.push({account:account.id,session,username:account.username,team,stake});books.set(key,book);
    }finally{busy.delete(account.id);}
  }

  // Called once the leaderboard knows what happened to the game: 'saved' pays out, anything else refunds.
  async function settle(game,status){
    const book=books.get(keyOf(game));if(!book||book.result)return;
    let outcome=status==='saved'&&TEAMS.includes(game.winner)?'paid':'refunded';
    book.result={status:outcome,winner:game.winner};
    if(outcome==='paid'){
      try{await store.addLedger(book.bets.map(b=>({account:b.account,delta:b.team===game.winner?b.stake:-b.stake,kind:'bet'})));}
      catch(e){console.error('BOTC bets:',e.message);book.result={status:'refunded',winner:game.winner};}
    }
  }
  // A table that went back to the lobby mid-game leaves its bets unsettled: they are void.
  function sync(game){for(const book of books.values())if(book.code===game.code&&book.round!==game.round&&!book.result)book.result={status:'refunded',winner:null};}
  function forgetRoom(code){for(const [key,book] of books)if(book.code===code)books.delete(key);}

  // What the page shows. Spectators see the pool and their own bet while the game runs; everyone sees the bets at the end.
  function viewFor(game,session){
    const book=books.get(keyOf(game)),spectating=!!game.spectators?.some(s=>s.session===session);
    const bets=book?.bets||[],sum=team=>bets.filter(b=>b.team===team).reduce((n,b)=>n+b.stake,0);
    if(game.phase==='ended'){
      if(!bets.length)return null;
      const status=book.result?.status||'pending';
      return {ended:true,status,list:bets.map(b=>({username:b.username,team:b.team,stake:b.stake,outcome:status==='paid'?(b.team===game.winner?'won':'lost'):status}))};
    }
    if(!spectating||game.phase==='lobby')return null;
    const mine=bets.find(b=>b.session===session);
    return {open:isOpen(game),min:BET.min,max:BET.max,pool:{good:sum('good'),evil:sum('evil')},count:bets.length,mine:mine?{team:mine.team,stake:mine.stake}:null};
  }
  return {place,settle,sync,forgetRoom,viewFor,heldFor};
}
