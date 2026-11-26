// Optional player accounts for the game, kept apart from the quota tracker's users.
import pg from 'pg';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { lookOf } from './cosmetics.mjs';

const MAX_PICTURE=48*1024;
const MINUTE=60*1000;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const COLUMNS='id,username,password_hash,session,avatar_version,avatar IS NOT NULL AS pictured,look';
const SCHEMA=`CREATE TABLE IF NOT EXISTS botc_accounts(
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  username_key TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  session UUID NOT NULL UNIQUE,
  avatar BYTEA,
  avatar_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS botc_games(
  id UUID PRIMARY KEY,
  script TEXT NOT NULL,
  winner TEXT NOT NULL,
  reason TEXT NOT NULL,
  players SMALLINT NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS botc_game_players(
  game_id UUID NOT NULL REFERENCES botc_games(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES botc_accounts(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  initial_role TEXT NOT NULL,
  evil BOOLEAN NOT NULL,
  won BOOLEAN NOT NULL,
  survived BOOLEAN NOT NULL,
  demon BOOLEAN NOT NULL,
  PRIMARY KEY(game_id,account_id)
);
CREATE INDEX IF NOT EXISTS botc_game_players_account ON botc_game_players(account_id);
ALTER TABLE botc_accounts ADD COLUMN IF NOT EXISTS look JSONB;
ALTER TABLE botc_game_players ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS botc_items(
  account_id UUID NOT NULL REFERENCES botc_accounts(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  price INTEGER NOT NULL,
  bought_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(account_id,item)
);
CREATE TABLE IF NOT EXISTS botc_ledger(
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES botc_accounts(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  kind TEXT NOT NULL,
  other_id UUID,
  item TEXT,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS botc_ledger_account ON botc_ledger(account_id,at)`;
// A balance is what games earned, less what was bought, plus everything in the ledger (chests, gifts and bets).
const BALANCE=`(SELECT coalesce(sum(points),0)::int FROM botc_game_players WHERE account_id=$1)
  -(SELECT coalesce(sum(price),0)::int FROM botc_items WHERE account_id=$1)
  +(SELECT coalesce(sum(delta),0)::int FROM botc_ledger WHERE account_id=$1)`;
// Totals per account; the leaderboard works out rates and ranks from these.
const TOTALS=`SELECT a.id,a.username,a.avatar_version,a.avatar IS NOT NULL AS pictured,a.look,
  count(*)::int AS games,count(*) FILTER(WHERE p.won)::int AS wins,
  count(*) FILTER(WHERE NOT p.evil)::int AS good_games,count(*) FILTER(WHERE NOT p.evil AND p.won)::int AS good_wins,
  count(*) FILTER(WHERE p.evil)::int AS evil_games,count(*) FILTER(WHERE p.evil AND p.won)::int AS evil_wins,
  count(*) FILTER(WHERE p.demon AND p.won)::int AS demon_wins
FROM botc_game_players p JOIN botc_games g ON g.id=p.game_id JOIN botc_accounts a ON a.id=p.account_id
WHERE $1::text IS NULL OR g.script=$1 GROUP BY a.id`;
export function pgStore(pool){
  let ready;
  const prepare=()=>ready||=pool.query(SCHEMA).catch(e=>{ready=null;throw e;});
  const query=async(sql,args)=>{await prepare();return (await pool.query(sql,args)).rows;};
  const one=async(sql,args)=>(await query(sql,args))[0]||null;
  // Runs `fn` in a transaction holding the given accounts' rows, locked in a fixed order so two transfers cannot deadlock.
  async function locked(ids,fn){
    await prepare();
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      await client.query('SELECT 1 FROM botc_accounts WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[ids]);
      const result=await fn(client);
      await client.query('COMMIT');
      return result;
    }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}
    finally{client.release();}
  }
  return {
    async create({id,username,key,hash,session}){
      try{return await one(`INSERT INTO botc_accounts(id,username,username_key,password_hash,session) VALUES($1,$2,$3,$4,$5) RETURNING ${COLUMNS}`,[id,username,key,hash,session]);}
      catch(e){if(e.code==='23505')return null;throw e;}
    },
    byKey:key=>one(`SELECT ${COLUMNS} FROM botc_accounts WHERE username_key=$1`,[key]),
    bySession:session=>one(`SELECT ${COLUMNS} FROM botc_accounts WHERE session=$1`,[session]),
    setPicture:(session,bytes)=>one(`UPDATE botc_accounts SET avatar=$2,avatar_version=avatar_version+1 WHERE session=$1 RETURNING ${COLUMNS}`,[session,bytes]),
    picture:async id=>(await one('SELECT avatar FROM botc_accounts WHERE id=$1',[id]))?.avatar||null,
    accountIds:async sessions=>new Map((await query('SELECT id,session FROM botc_accounts WHERE session=ANY($1::uuid[])',[sessions])).map(a=>[a.session,a.id])),
    // One statement, so a game is saved with all its players or not at all.
    async saveGame({id,script,winner,reason,size,players}){
      await query(`WITH game AS (INSERT INTO botc_games(id,script,winner,reason,players) VALUES($1,$2,$3,$4,$5))
        INSERT INTO botc_game_players(game_id,account_id,role,initial_role,evil,won,survived,demon,points)
        SELECT $1,account_id,role,initial_role,evil,won,survived,demon,points FROM jsonb_to_recordset($6::jsonb)
        AS x(account_id UUID,role TEXT,initial_role TEXT,evil BOOLEAN,won BOOLEAN,survived BOOLEAN,demon BOOLEAN,points INTEGER)`,
        [id,script,winner,reason,size,JSON.stringify(players.map(p=>({account_id:p.account,role:p.role,initial_role:p.initialRole,evil:p.evil,won:p.won,survived:p.survived,demon:p.demon,points:p.points||0})))]);
    },
    totals:script=>query(TOTALS,[script||null]),
    history:id=>query(`SELECT g.script,g.ended_at,g.players,p.role,p.initial_role,p.evil,p.won,p.survived,p.demon
      FROM botc_game_players p JOIN botc_games g ON g.id=p.game_id WHERE p.account_id=$1 ORDER BY g.ended_at DESC`,[id]),
    setLook:(id,look)=>one(`UPDATE botc_accounts SET look=$2 WHERE id=$1 RETURNING ${COLUMNS}`,[id,look&&JSON.stringify(look)]),
    wonSince:async(ids,since)=>new Set((await query(`SELECT DISTINCT p.account_id FROM botc_game_players p JOIN botc_games g ON g.id=p.game_id
      WHERE p.won AND p.account_id=ANY($1::uuid[]) AND g.ended_at>=$2`,[ids,since])).map(r=>r.account_id)),
    wallet:id=>one(`SELECT (SELECT coalesce(sum(points),0)::int FROM botc_game_players WHERE account_id=$1) AS earned,
      (SELECT coalesce(sum(price),0)::int FROM botc_items WHERE account_id=$1) AS spent,
      (SELECT coalesce(sum(delta),0)::int FROM botc_ledger WHERE account_id=$1) AS adjust,
      (SELECT coalesce(array_agg(item),'{}') FROM botc_items WHERE account_id=$1) AS owned`,[id]),
    // Every spend locks the account rows involved, so two at once take turns and points cannot be spent twice.
    // `held` is what the account has staked on bets still being played; it cannot be spent meanwhile.
    async buy(id,item,price,held=0){
      return locked([id],async client=>{
        const w=(await client.query(`SELECT ${BALANCE} AS balance,EXISTS(SELECT 1 FROM botc_items WHERE account_id=$1 AND item=$2) AS owned`,[id,item])).rows[0];
        const result=w.owned?'owned':w.balance-held<price?'short':'bought';
        if(result==='bought')await client.query('INSERT INTO botc_items(account_id,item,price) VALUES($1,$2,$3)',[id,item,price]);
        return result;
      });
    },
    // A chest costs points and gives an item (a Chroma brings its whole set, from `bundle`); a duplicate gives some points back instead.
    async openChest(id,{price,refund,held=0,roll,bundle=item=>[item]}){
      return locked([id],async client=>{
        const w=(await client.query(`SELECT ${BALANCE} AS balance,(SELECT coalesce(array_agg(item),'{}') FROM botc_items WHERE account_id=$1) AS owned`,[id])).rows[0];
        if(w.balance-held<price)return {result:'short'};
        const item=roll(),duplicate=w.owned.includes(item);
        await client.query("INSERT INTO botc_ledger(id,account_id,delta,kind,item) VALUES($1,$2,$3,'chest',$4)",[randomUUID(),id,-price,item]);
        if(duplicate)await client.query("INSERT INTO botc_ledger(id,account_id,delta,kind,item) VALUES($1,$2,$3,'chest_refund',$4)",[randomUUID(),id,refund,item]);
        else await client.query('INSERT INTO botc_items(account_id,item,price) SELECT $1,x,0 FROM unnest($2::text[]) AS x ON CONFLICT DO NOTHING',[id,bundle(item)]);
        return {result:'opened',item,duplicate};
      });
    },
    async gift({from,to,amount,held=0}){
      return locked([from,to],async client=>{
        const w=(await client.query(`SELECT ${BALANCE} AS balance`,[from])).rows[0];
        if(w.balance-held<amount)return 'short';
        await client.query("INSERT INTO botc_ledger(id,account_id,delta,kind,other_id) VALUES($1,$2,$3,'gift',$4),($5,$4,$6,'gift',$2)",[randomUUID(),from,-amount,to,randomUUID(),amount]);
        return 'sent';
      });
    },
    giftsReceived:id=>query(`SELECT a.username,l.delta AS amount,l.at FROM botc_ledger l JOIN botc_accounts a ON a.id=l.other_id
      WHERE l.account_id=$1 AND l.kind IN ('gift','grant') AND l.delta>0 ORDER BY l.at DESC LIMIT 5`,[id]),
    balance:async id=>(await one(`SELECT ${BALANCE} AS balance`,[id])).balance,
    // Points an admin gave (or took back), with who did it.
    grant:({to,by,amount})=>query("INSERT INTO botc_ledger(id,account_id,delta,kind,other_id) VALUES($1,$2,$3,'grant',$4)",[randomUUID(),to,amount,by]),
    setPassword:(id,hash)=>query('UPDATE botc_accounts SET password_hash=$2 WHERE id=$1',[id,hash]),
    // A new password set by an admin, kept in the player's history (it moves no points).
    async resetPassword({id,by,hash}){
      await query('UPDATE botc_accounts SET password_hash=$2 WHERE id=$1',[id,hash]);
      await query("INSERT INTO botc_ledger(id,account_id,delta,kind,other_id) VALUES($1,$2,0,'reset',$3)",[randomUUID(),id,by]);
    },
    // Who owns any of these items, for the admin to see before taking them back.
    chromaOwners:items=>query('SELECT a.username,array_agg(i.item ORDER BY i.item) AS items FROM botc_items i JOIN botc_accounts a ON a.id=i.account_id WHERE i.item=ANY($1::text[]) GROUP BY a.id,a.username ORDER BY a.username',[items]),
    // Takes these items back from everyone who has them: they leave the account and what it wears, and each set
    // (`setOf` an item) pays `per` points, kept in the player's history.
    async recallChromas({items,setOf,by,per}){
      const owners=await query('SELECT DISTINCT account_id FROM botc_items WHERE item=ANY($1::text[])',[items]);
      if(!owners.length)return [];
      return locked(owners.map(o=>o.account_id),async client=>{
        const rows=(await client.query('SELECT a.id,a.username,a.look,array_agg(i.item) AS items FROM botc_items i JOIN botc_accounts a ON a.id=i.account_id WHERE i.item=ANY($1::text[]) GROUP BY a.id',[items])).rows,out=[];
        for(const r of rows){
          const sets=[...new Set(r.items.map(setOf))].sort(),look=Object.fromEntries(Object.entries(r.look||{}).filter(([,v])=>!items.includes(v)));
          await client.query('DELETE FROM botc_items WHERE account_id=$1 AND item=ANY($2::text[])',[r.id,items]);
          await client.query('UPDATE botc_accounts SET look=$2 WHERE id=$1',[r.id,Object.keys(look).length?JSON.stringify(look):null]);
          for(const set of sets)await client.query("INSERT INTO botc_ledger(id,account_id,delta,kind,other_id,item) VALUES($1,$2,$3,'recall',$4,$5)",[randomUUID(),r.id,per,by,set]);
          out.push({username:r.username,sets,amount:per*sets.length});
        }
        return out.sort((a,b)=>a.username.localeCompare(b.username));
      });
    },
    grants:()=>query(`SELECT t.username AS "to",b.username AS "by",l.delta AS amount,l.at FROM botc_ledger l
      JOIN botc_accounts t ON t.id=l.account_id LEFT JOIN botc_accounts b ON b.id=l.other_id WHERE l.kind='grant' ORDER BY l.at DESC LIMIT 20`),
    // Every account's points, for the admin page.
    balances:()=>query(`SELECT a.id,a.username,a.created_at,coalesce(g.earned,0)::int AS earned,coalesce(g.games,0)::int AS games,
      coalesce(i.spent,0)::int AS spent,coalesce(l.adjust,0)::int AS adjust FROM botc_accounts a
      LEFT JOIN (SELECT account_id,sum(points) AS earned,count(*) AS games FROM botc_game_players GROUP BY account_id) g ON g.account_id=a.id
      LEFT JOIN (SELECT account_id,sum(price) AS spent FROM botc_items GROUP BY account_id) i ON i.account_id=a.id
      LEFT JOIN (SELECT account_id,sum(delta) AS adjust FROM botc_ledger GROUP BY account_id) l ON l.account_id=a.id
      ORDER BY a.created_at LIMIT 2000`),
    // One account's points coming and going, newest first: games, shop purchases (chest finds are listed as chests), and the ledger.
    activity:id=>query(`SELECT * FROM (
      SELECT 'game' AS kind,p.points AS delta,p.initial_role AS item,NULL::text AS other,p.won,g.script,g.ended_at AS at
        FROM botc_game_players p JOIN botc_games g ON g.id=p.game_id WHERE p.account_id=$1
      UNION ALL SELECT 'buy',-price,item,NULL,NULL,NULL,bought_at FROM botc_items WHERE account_id=$1 AND price>0
      UNION ALL SELECT l.kind,l.delta,l.item,o.username,NULL,NULL,l.at FROM botc_ledger l LEFT JOIN botc_accounts o ON o.id=l.other_id WHERE l.account_id=$1
    ) x ORDER BY at DESC LIMIT 300`,[id]),
    // Counts and sums by kind over the account's whole history, since the activity list is cut short.
    activityTotals:id=>query(`SELECT 'game' AS kind,count(*)::int AS n,coalesce(sum(points),0)::int AS total FROM botc_game_players WHERE account_id=$1
      UNION ALL SELECT 'buy',count(*)::int,coalesce(-sum(price),0)::int FROM botc_items WHERE account_id=$1 AND price>0
      UNION ALL SELECT kind||CASE WHEN kind IN ('gift','grant','bet') AND delta<0 THEN '_out' ELSE '' END,count(*)::int,sum(delta)::int FROM botc_ledger WHERE account_id=$1
        GROUP BY kind||CASE WHEN kind IN ('gift','grant','bet') AND delta<0 THEN '_out' ELSE '' END`,[id]),
    sharedGame:async(a,b)=>!!(await one('SELECT 1 FROM botc_game_players x JOIN botc_game_players y ON y.game_id=x.game_id WHERE x.account_id=$1 AND y.account_id=$2 LIMIT 1',[a,b])),
    // Settled bets: one row per bettor, all in one statement.
    async addLedger(rows){
      if(!rows.length)return;
      await query(`INSERT INTO botc_ledger(id,account_id,delta,kind) SELECT id,account_id,delta,kind FROM jsonb_to_recordset($1::jsonb) AS x(id UUID,account_id UUID,delta INTEGER,kind TEXT)`,
        [JSON.stringify(rows.map(r=>({id:randomUUID(),account_id:r.account,delta:r.delta,kind:r.kind})))]);
    },
  };
}
// Without a database the game still works: everyone simply plays as a guest.
export function defaultStore(){
  if(!process.env.DATABASE_URL)return null;
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:false,max:3,connectionTimeoutMillis:5000});
  pool.on('error',e=>console.error('BOTC accounts database:',e.message));
  return pgStore(pool);
}
const refuse=(message,status=400)=>Object.assign(Error(message),{status,expose:true});
export const pictureOf=a=>a?.pictured?`${a.id}?v=${a.avatar_version}`:null;
const summary=a=>a?{username:a.username,avatar:pictureOf(a),look:lookOf(a.look)}:null;
export const keyOf=username=>username.toLocaleLowerCase('en');
export function usernameOf(value){const v=String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ');if(!/^[\p{L}\p{N}][\p{L}\p{N} _.-]{1,19}$/u.test(v))throw refuse('Usernames are 2–20 letters or numbers.');return v;}
export function passwordOf(value){const v=String(value||'');if(v.length<6||Buffer.byteLength(v)>72)throw refuse('Passwords are 6–72 characters.');return v;}
function jpegOf(image){const m=/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(image)),bytes=m&&Buffer.from(m[1],'base64');if(!bytes||bytes.length>MAX_PICTURE||bytes[0]!==0xff||bytes[1]!==0xd8||bytes[2]!==0xff)throw refuse('Please choose a different picture.');return bytes;}
// Decorations cannot change mid-game: chat closes at night, so a change could be a secret signal.
// A change made during a game waits on the seat and is worn from the next game on.
export function dress(seat,game,look){
  if(!['lobby','ended'].includes(game.phase)){seat.lookNext=look;return true;}
  seat.look=look;delete seat.lookNext;return false;
}
const clientOf=req=>req.headers['x-forwarded-for']?.split(',').at(-1).trim()||req.socket.remoteAddress||'';

export function mountAccounts(router,{store,rooms,identity,setSession,admins=new Set()}){
  // Your own account also says whether you are an admin, so the game shows you the admin page.
  const mine=a=>{const s=summary(a);if(s&&admins.has(keyOf(a.username)))s.admin=true;return s;};
  const hits=new Map();
  function limit(key,max,ms){
    const now=Date.now();
    if(hits.size>5000)for(const [k,v] of hits)if(v.until<now)hits.delete(k);
    const hit=hits.get(key);
    if(!hit||hit.until<now){hits.set(key,{n:1,until:now+ms});return;}
    if(++hit.n>max)throw refuse('Too many tries. Please wait a few minutes.',429);
  }
  const seatedIn=session=>[...rooms].filter(([,room])=>room.state.includes(session));
  // A session's seats follow the account, so the game itself never needs to know about logins.
  function eachSeat(session,change){
    for(const [code,room] of seatedIn(session)){
      const game=JSON.parse(room.state),seat=game.players.find(p=>p.session===session);
      if(seat&&change(seat,game)!==false)rooms.set(code,{state:JSON.stringify(game),updated:Date.now()});
    }
  }
  function latestRoom(session){
    let best=null;
    for(const [code,room] of seatedIn(session)){const game=JSON.parse(room.state);if(game.phase!=='ended'&&game.players.some(p=>p.session===session)&&(!best||room.updated>best.updated))best={code,updated:room.updated};}
    return best?.code||null;
  }
  const handle=fn=>async(req,res)=>{try{
    if(req.method==='POST'){
      if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw refuse('Use the game website to submit actions.',403);
      if(!store)throw refuse('Accounts are not set up on this server.',503);
    }
    await fn(req,res);
  }catch(e){if(!e.expose)console.error('BOTC accounts:',e.message);res.status(e.expose?e.status:503).json({error:e.expose?e.message:'Accounts are unavailable right now.'});}};
  router.get('/account',handle(async(req,res)=>{
    if(!store)return res.json({enabled:false,account:null});
    const session=identity(req),account=session?await store.bySession(session):null;
    res.json({enabled:true,account:mine(account),room:account?latestRoom(session):null});
  }));
  router.post('/account/register',handle(async(req,res)=>{
    limit(`register:${clientOf(req)}`,30,60*MINUTE);
    const username=usernameOf(req.body?.username),password=passwordOf(req.body?.password),session=identity(req)||randomUUID();
    if(await store.bySession(session))throw refuse('Log out before making another account.');
    // Keeping the guest's session means a player who signs up mid-game keeps their seat.
    const account=await store.create({id:randomUUID(),username,key:keyOf(username),hash:await bcrypt.hash(password,10),session});
    if(!account)throw refuse('That username is taken.',409);
    setSession(req,res,session);
    res.json({account:mine(account),room:latestRoom(session)});
  }));
  router.post('/account/login',handle(async(req,res)=>{
    const key=keyOf(usernameOf(req.body?.username)),attempts=`login:${key}`;
    limit(attempts,10,15*MINUTE);
    const account=await store.byKey(key);
    if(!account||!await bcrypt.compare(String(req.body?.password||''),account.password_hash))throw refuse('Wrong username or password.',401);
    hits.delete(attempts);
    const guest=identity(req);
    if(guest&&guest!==account.session&&!await store.bySession(guest))eachSeat(guest,(seat,game)=>{if(game.players.some(p=>p.session===account.session))return false;seat.session=account.session;seat.avatar=pictureOf(account);seat.account=account.username;dress(seat,game,lookOf(account.look));});
    setSession(req,res,account.session);
    res.json({account:mine(account),room:latestRoom(account.session)});
  }));
  router.post('/account/logout',handle(async(req,res)=>{setSession(req,res,randomUUID());res.json({account:null});}));
  router.post('/account/avatar',handle(async(req,res)=>{
    const session=identity(req);
    if(!session||!await store.bySession(session))throw refuse('Log in first.',401);
    limit(`picture:${session}`,30,10*MINUTE);
    const account=await store.setPicture(session,req.body?.image===null?null:jpegOf(req.body?.image));
    eachSeat(session,seat=>{seat.avatar=pictureOf(account);});
    res.json({account:mine(account)});
  }));
  // Changing your own password needs the current one, so a computer someone left logged in can't be locked away from them.
  router.post('/account/password',handle(async(req,res)=>{
    const session=identity(req),account=session?await store.bySession(session):null;
    if(!account)throw refuse('Log in first.',401);
    const next=passwordOf(req.body?.password);
    limit(`password:${account.id}`,10,15*MINUTE);
    if(!await bcrypt.compare(String(req.body?.current||''),account.password_hash))throw refuse('Your current password is wrong.',401);
    await store.setPassword(account.id,await bcrypt.hash(next,10));
    res.json({ok:true});
  }));
  router.get('/avatar/:id',handle(async(req,res)=>{
    const bytes=store&&UUID.test(req.params.id)?await store.picture(req.params.id):null;
    if(!bytes)return res.status(404).json({error:'No picture.'});
    res.setHeader('Content-Type','image/jpeg');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','public, max-age=31536000, immutable');
    res.end(bytes);
  }));
  // What a seat shows for its account. A database hiccup just seats the player as a guest.
  async function seatFor(session){
    if(!store)return {};
    try{const a=await store.bySession(session);return a?{avatar:pictureOf(a),account:a.username,look:lookOf(a.look)}:{};}catch{return {};}
  }
  return {seatFor,eachSeat};
}
