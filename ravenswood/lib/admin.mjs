// Tools for whoever runs the site. Admins are the accounts named in BOTC_ADMINS (comma-separated usernames).
import { keyOf, usernameOf } from './accounts.mjs';

export const GRANT=Object.freeze({max:100000});

export function adminKeys(list=process.env.BOTC_ADMINS){
  return new Set(String(list||'').split(',').map(n=>n.trim()).filter(Boolean).map(keyOf));
}

const time=at=>new Date(at).getTime();

// `heldFor(accountId)` is what the account has staked on spectator bets still being played.
export function mountAdmin(router,{store,identity,admins=adminKeys(),heldFor=()=>0}){
  const refuse=(message,status=400)=>Object.assign(Error(message),{status,expose:true});
  const handle=fn=>async(req,res)=>{try{
    if(req.method==='POST'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw refuse('Use the game website.',403);
    if(!store)throw refuse('Accounts are not set up on this server.',503);
    const session=identity(req),account=session?await store.bySession(session):null;
    if(!account||!admins.has(keyOf(account.username)))throw refuse('This page is for admins only.',403);
    await fn(req,res,account);
  }catch(e){if(!e.expose)console.error('BOTC admin:',e.message);res.status(e.expose?e.status:503).json({error:e.expose?e.message:'The admin page is unavailable right now.'});}};
  const playerNamed=async name=>{const p=await store.byKey(keyOf(usernameOf(name)));if(!p)throw refuse('No player has that name.',404);return p;};

  // Everyone's points, and the latest grants.
  async function overview(){
    const [grants,rows]=await Promise.all([store.grants(),store.balances()]);
    return {
      max:GRANT.max,
      grants:grants.map(g=>({to:g.to,by:g.by,amount:g.amount,at:time(g.at)})),
      players:rows.map(r=>{const held=heldFor(r.id);return {username:r.username,balance:r.earned-r.spent+r.adjust-held,held,earned:r.earned,spent:r.spent,games:r.games,joined:time(r.created_at)};}),
    };
  }
  router.get('/admin',handle(async(req,res)=>res.json(await overview())));
  // One player's history: games, purchases, chests, gifts, bets and grants.
  router.get('/admin/player',handle(async(req,res)=>{
    const p=await playerNamed(req.query.username);
    const [wallet,rows,totals]=await Promise.all([store.wallet(p.id),store.activity(p.id),store.activityTotals(p.id)]);
    const held=heldFor(p.id);
    res.json({player:{
      username:p.username,balance:wallet.earned-wallet.spent+(wallet.adjust||0)-held,held,owned:wallet.owned,
      totals:Object.fromEntries(totals.map(t=>[t.kind,{n:t.n,total:t.total}])),
      activity:rows.map(r=>({kind:r.kind,delta:r.delta,item:r.item??null,other:r.other??null,won:r.won??null,script:r.script??null,at:time(r.at)})),
    }});
  }));
  // A positive amount gives points; a negative one takes them back.
  router.post('/admin/grant',handle(async(req,res,account)=>{
    const amount=req.body?.amount;
    if(!Number.isInteger(amount)||amount===0||Math.abs(amount)>GRANT.max)throw refuse(`Give between 1 and ${GRANT.max} points, or a negative number to take some away.`);
    const to=await playerNamed(req.body?.to);
    await store.grant({to:to.id,by:account.id,amount});
    res.json({...await overview(),granted:{to:to.username,amount,balance:await store.balance(to.id)-heldFor(to.id)}});
  }));
}
