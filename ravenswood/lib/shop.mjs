// Spending points on decorations. Points come only from playing; there is no real money here.
import { ITEM, KINDS, UNLOCKS, lookOf, progressOf, unlocked } from './cosmetics.mjs';
import { dress } from './accounts.mjs';
import { dayStart } from './leaderboard.mjs';

const itemOf=id=>typeof id==='string'&&Object.hasOwn(ITEM,id)?ITEM[id]:null;

export function mountShop(router,{store,identity,accounts}){
  const refuse=(message,status=400)=>Object.assign(Error(message),{status,expose:true});
  const handle=fn=>async(req,res)=>{try{
    if(req.method==='POST'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw refuse('Use the game website to shop.',403);
    if(!store)throw refuse('The shop is not set up on this server.',503);
    const session=identity(req),account=session?await store.bySession(session):null;
    if(!account)throw refuse('Log in to earn points and use the shop.',401);
    await fn(req,res,account);
  }catch(e){if(!e.expose)console.error('BOTC shop:',e.message);res.status(e.expose?e.status:503).json({error:e.expose?e.message:'The shop is unavailable right now.'});}};

  async function stateOf(account){
    const [wallet,rows,won]=await Promise.all([store.wallet(account.id),store.history(account.id),store.wonSince([account.id],dayStart())]);
    return {
      balance:wallet.earned-wallet.spent,earned:wallet.earned,owned:wallet.owned,look:lookOf(account.look)||{},
      progress:progressOf(rows),daily:{ready:!won.has(account.id),resetsAt:dayStart().getTime()+86400000},
    };
  }
  // Save the look, and dress every seat the account holds. `later` means a game in progress keeps the old look for now.
  async function wear(account,look){
    const saved=await store.setLook(account.id,lookOf(look));let later=false;
    accounts.eachSeat(account.session,(seat,game)=>{if(dress(seat,game,lookOf(saved.look)))later=true;});
    return {saved,later};
  }
  router.get('/shop',handle(async(req,res,account)=>res.json(await stateOf(account))));
  router.post('/shop/buy',handle(async(req,res,account)=>{
    const item=itemOf(req.body?.item);
    if(!item?.price)throw refuse('That item is not for sale.');
    if(await store.buy(account.id,item.id,item.price)==='short')throw refuse('You do not have enough points for that yet.');
    // Most people buy something to wear it, so it goes straight on.
    const {saved,later}=await wear(account,{...lookOf(account.look),[item.kind]:item.id});
    res.json({...await stateOf(saved),later});
  }));
  router.post('/shop/equip',handle(async(req,res,account)=>{
    const kind=req.body?.kind,id=req.body?.item??null;
    if(!Object.hasOwn(KINDS,kind))throw refuse('Choose a frame, name colour or title.');
    if(id!==null){
      const item=itemOf(id);
      if(item?.kind!==kind)throw refuse('That item does not exist.');
      if(item.price&&!(await store.wallet(account.id)).owned.includes(id))throw refuse('Buy this item first.');
      if(item.unlock&&!unlocked(item,progressOf(await store.history(account.id))))throw refuse(`Not unlocked yet: ${UNLOCKS[item.unlock].text.toLowerCase()}.`);
    }
    const look={...lookOf(account.look)};
    if(id===null)delete look[kind];else look[kind]=id;
    const {saved,later}=await wear(account,look);
    res.json({...await stateOf(saved),later});
  }));
}
