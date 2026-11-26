// Spending points on decorations, mystery chests and gifts. Points come only from playing; there is no real money here.
import { ITEM, KINDS, UNLOCKS, CHEST, GIFT, SETS, bundleOf, lookOf, progressOf, unlocked, rollChest } from './cosmetics.mjs';
import { flair } from './engine.mjs';
import { dress, keyOf, usernameOf } from './accounts.mjs';
import { dayStart } from './leaderboard.mjs';

const itemOf=id=>typeof id==='string'&&Object.hasOwn(ITEM,id)?ITEM[id]:null;

// `heldFor(accountId)` is what the account has staked on spectator bets still being played.
export function mountShop(router,{store,identity,accounts,heldFor=()=>0}){
  const refuse=(message,status=400)=>Object.assign(Error(message),{status,expose:true});
  const handle=fn=>async(req,res)=>{try{
    if(req.method==='POST'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw refuse('Use the game website to shop.',403);
    if(!store)throw refuse('The shop is not set up on this server.',503);
    const session=identity(req),account=session?await store.bySession(session):null;
    if(!account)throw refuse('Log in to earn points and use the shop.',401);
    await fn(req,res,account);
  }catch(e){if(!e.expose)console.error('BOTC shop:',e.message);res.status(e.expose?e.status:503).json({error:e.expose?e.message:'The shop is unavailable right now.'});}};

  async function stateOf(account){
    const since=dayStart();
    const [wallet,rows,won,gifts]=await Promise.all([store.wallet(account.id),store.history(account.id),store.wonSince([account.id],since),store.giftsReceived(account.id)]);
    const held=heldFor(account.id);
    return {
      balance:wallet.earned-wallet.spent+(wallet.adjust||0)-held,held,earned:wallet.earned,owned:wallet.owned,look:lookOf(account.look)||{},
      progress:progressOf(rows),daily:{ready:!won.has(account.id),resetsAt:since.getTime()+86400000},
      chest:CHEST,gift:{...GIFT,allowed:rows.length>=GIFT.minGames},
      gifts:gifts.map(g=>({from:g.username,amount:g.amount,at:new Date(g.at).getTime()})),
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
    if(await store.buy(account.id,item.id,item.price,heldFor(account.id))==='short')throw refuse('You do not have enough points for that yet.');
    // Most people buy something to wear it, so it goes straight on.
    const {saved,later}=await wear(account,{...lookOf(account.look),[item.kind]:item.id});
    res.json({...await stateOf(saved),later});
  }));
  router.post('/shop/chest',handle(async(req,res,account)=>{
    const opened=await store.openChest(account.id,{price:CHEST.price,refund:CHEST.refund,held:heldFor(account.id),roll:()=>rollChest(),bundle:bundleOf});
    if(opened.result==='short')throw refuse(`A chest costs ${CHEST.price} points.`);
    // A new Chroma is shown to everyone at the account's tables, but only between games, so it can never carry a signal mid-game.
    const set=ITEM[opened.item]?.set;
    if(set&&!opened.duplicate)accounts.eachSeat(account.session,(seat,game)=>{if(!['lobby','ended'].includes(game.phase))return false;flair(game,seat.id,set);});
    res.json({...await stateOf(account),opened:{item:opened.item,duplicate:opened.duplicate,refund:opened.duplicate?CHEST.refund:0}});
  }));
  router.post('/shop/gift',handle(async(req,res,account)=>{
    const amount=req.body?.amount;
    if(!Number.isInteger(amount)||amount<GIFT.min)throw refuse(`Gift at least ${GIFT.min} points.`);
    const to=await store.byKey(keyOf(usernameOf(req.body?.to)));
    if(!to)throw refuse('No player has that name.',404);
    if(to.id===account.id)throw refuse('You cannot gift points to yourself.');
    if((await store.history(account.id)).length<GIFT.minGames)throw refuse(`You can gift points once you have played ${GIFT.minGames} recorded games.`);
    if(!await store.sharedGame(account.id,to.id))throw refuse('You can only gift points to someone you have played a recorded game with.');
    const sent=await store.gift({from:account.id,to:to.id,amount,held:heldFor(account.id)});
    if(sent==='short')throw refuse('You do not have enough points for that gift.');
    res.json({...await stateOf(account),sent:{to:to.username,amount}});
  }));
  // Wear every piece of a Chroma set at once.
  router.post('/shop/equip-set',handle(async(req,res,account)=>{
    const set=req.body?.set;
    if(typeof set!=='string'||!Object.hasOwn(SETS,set))throw refuse('That set does not exist.');
    const owned=(await store.wallet(account.id)).owned;
    if(!SETS[set].items.every(id=>owned.includes(id)))throw refuse('Find this Chroma in a chest first.');
    const look={...lookOf(account.look)};for(const id of SETS[set].items)look[ITEM[id].kind]=id;
    const {saved,later}=await wear(account,look);
    res.json({...await stateOf(saved),later});
  }));
  router.post('/shop/equip',handle(async(req,res,account)=>{
    const kind=req.body?.kind,id=req.body?.item??null;
    if(!Object.hasOwn(KINDS,kind))throw refuse('Choose what kind of decoration to change.');
    if(id!==null){
      const item=itemOf(id);
      if(item?.kind!==kind)throw refuse('That item does not exist.');
      if((item.price||item.chest)&&!(await store.wallet(account.id)).owned.includes(id))throw refuse(item.chest?'Find this item in a chest first.':'Buy this item first.');
      if(item.unlock&&!unlocked(item,progressOf(await store.history(account.id))))throw refuse(`Not unlocked yet: ${UNLOCKS[item.unlock].text.toLowerCase()}.`);
    }
    const look={...lookOf(account.look)};
    if(id===null)delete look[kind];else look[kind]=id;
    const {saved,later}=await wear(account,look);
    res.json({...await stateOf(saved),later});
  }));
}
