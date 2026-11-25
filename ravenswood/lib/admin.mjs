// Tools for whoever runs the site. Admins are the accounts named in BOTC_ADMINS (comma-separated usernames).
import { keyOf, usernameOf } from './accounts.mjs';

export const GRANT=Object.freeze({max:100000});

export function adminKeys(list=process.env.BOTC_ADMINS){
  return new Set(String(list||'').split(',').map(n=>n.trim()).filter(Boolean).map(keyOf));
}

export function mountAdmin(router,{store,identity,admins=adminKeys()}){
  const refuse=(message,status=400)=>Object.assign(Error(message),{status,expose:true});
  const handle=fn=>async(req,res)=>{try{
    if(req.method==='POST'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw refuse('Use the game website.',403);
    if(!store)throw refuse('Accounts are not set up on this server.',503);
    const session=identity(req),account=session?await store.bySession(session):null;
    if(!account||!admins.has(keyOf(account.username)))throw refuse('This page is for admins only.',403);
    await fn(req,res,account);
  }catch(e){if(!e.expose)console.error('BOTC admin:',e.message);res.status(e.expose?e.status:503).json({error:e.expose?e.message:'The admin page is unavailable right now.'});}};

  const recent=async()=>(await store.grants()).map(g=>({to:g.to,by:g.by,amount:g.amount,at:new Date(g.at).getTime()}));
  router.get('/admin',handle(async(req,res)=>res.json({grants:await recent(),max:GRANT.max})));
  // A positive amount gives points; a negative one takes them back.
  router.post('/admin/grant',handle(async(req,res,account)=>{
    const amount=req.body?.amount;
    if(!Number.isInteger(amount)||amount===0||Math.abs(amount)>GRANT.max)throw refuse(`Give between 1 and ${GRANT.max} points, or a negative number to take some away.`);
    const to=await store.byKey(keyOf(usernameOf(req.body?.to)));
    if(!to)throw refuse('No player has that name.',404);
    await store.grant({to:to.id,by:account.id,amount});
    res.json({grants:await recent(),max:GRANT.max,granted:{to:to.username,amount,balance:await store.balance(to.id)}});
  }));
}
