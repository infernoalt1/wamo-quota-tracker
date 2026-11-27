// Tools for whoever runs the site. Admins are the accounts named in BOTC_ADMINS (comma-separated usernames).
import { randomInt } from 'node:crypto';
import bcrypt from 'bcrypt';
import { keyOf, usernameOf, passwordOf } from './accounts.mjs';
import { ITEM, ITEMS } from './cosmetics.mjs';

export const GRANT=Object.freeze({max:100000});
// Taking Chromas back pays this much for each set, unless the admin chooses another amount.
export const RECALL=Object.freeze({per:5000});
const CHROMA=ITEMS.filter(i=>i.tier==='chroma').map(i=>i.id),setOf=id=>ITEM[id].set;

export function adminKeys(list=process.env.BOTC_ADMINS){
  return new Set(String(list||'').split(',').map(n=>n.trim()).filter(Boolean).map(keyOf));
}

const time=at=>new Date(at).getTime();
// Temporary passwords skip letters that are easy to misread (l, 1, o, 0, i).
const LETTERS='abcdefghjkmnpqrstuvwxyz23456789';
export const tempPassword=()=>Array.from({length:3},()=>Array.from({length:4},()=>LETTERS[randomInt(LETTERS.length)]).join('')).join('-');

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
    const [grants,rows,chromas]=await Promise.all([store.grants(),store.balances(),store.chromaOwners(CHROMA)]);
    return {
      max:GRANT.max,recallPer:RECALL.per,
      chromas:chromas.map(c=>({username:c.username,sets:[...new Set(c.items.map(setOf))].sort()})),
      grants:grants.map(g=>({to:g.to,by:g.by,amount:g.amount,at:time(g.at)})),
      players:rows.map(r=>{const held=heldFor(r.id);return {username:r.username,alt:!!r.alt,balance:r.earned-r.spent+r.adjust-held,held,earned:r.earned,spent:r.spent,games:r.games,joined:time(r.created_at)};}),
    };
  }
  router.get('/admin',handle(async(req,res)=>res.json(await overview())));
  // One player's history: games, purchases, chests, gifts, bets and grants.
  router.get('/admin/player',handle(async(req,res)=>{
    const p=await playerNamed(req.query.username);
    const [wallet,rows,totals]=await Promise.all([store.wallet(p.id),store.activity(p.id),store.activityTotals(p.id)]);
    const held=heldFor(p.id);
    res.json({player:{
      username:p.username,alt:!!p.alt,balance:wallet.earned-wallet.spent+(wallet.adjust||0)-held,held,owned:wallet.owned,
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
  // Take every Chroma back from everyone, paying `per` points for each set.
  router.post('/admin/recall-chromas',handle(async(req,res,account)=>{
    const per=req.body?.per??RECALL.per;
    if(!Number.isInteger(per)||per<0||per>GRANT.max)throw refuse(`Pay between 0 and ${GRANT.max} points for each set.`);
    const recalled=await store.recallChromas({items:CHROMA,setOf,by:account.id,per});
    res.json({...await overview(),recalled});
  }));
  // Mark (or unmark) a spare account as an alt: it can't join, start or watch games, or bet.
  router.post('/admin/alt',handle(async(req,res,account)=>{
    const p=await playerNamed(req.body?.username);
    if(typeof req.body?.alt!=='boolean')throw refuse('Say whether this is an alt account.');
    if(p.id===account.id&&req.body.alt)throw refuse('You can’t mark your own account as an alt.');
    await store.setAlt(p.id,req.body.alt);
    res.json({...await overview(),alt:{username:p.username,alt:req.body.alt}});
  }));
  // A player who forgot their password gets a new one: the admin's choice, or a random one. It is shown once, for the admin to pass on.
  router.post('/admin/reset',handle(async(req,res,account)=>{
    const chosen=req.body?.password,password=chosen==null||chosen===''?tempPassword():passwordOf(chosen),p=await playerNamed(req.body?.username);
    await store.resetPassword({id:p.id,by:account.id,hash:await bcrypt.hash(password,10)});
    res.json({reset:{username:p.username,password}});
  }));
}
