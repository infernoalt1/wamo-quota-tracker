// Optional player accounts for the game, kept apart from the quota tracker's users.
import pg from 'pg';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';

const MAX_PICTURE=48*1024;
const MINUTE=60*1000;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const COLUMNS='id,username,password_hash,session,avatar_version,avatar IS NOT NULL AS pictured';
const SCHEMA=`CREATE TABLE IF NOT EXISTS botc_accounts(
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  username_key TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  session UUID NOT NULL UNIQUE,
  avatar BYTEA,
  avatar_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;
export function pgStore(pool){
  let ready;
  const query=async(sql,args)=>{ready||=pool.query(SCHEMA).catch(e=>{ready=null;throw e;});await ready;return (await pool.query(sql,args)).rows;};
  const one=async(sql,args)=>(await query(sql,args))[0]||null;
  return {
    async create({id,username,key,hash,session}){
      try{return await one(`INSERT INTO botc_accounts(id,username,username_key,password_hash,session) VALUES($1,$2,$3,$4,$5) RETURNING ${COLUMNS}`,[id,username,key,hash,session]);}
      catch(e){if(e.code==='23505')return null;throw e;}
    },
    byKey:key=>one(`SELECT ${COLUMNS} FROM botc_accounts WHERE username_key=$1`,[key]),
    bySession:session=>one(`SELECT ${COLUMNS} FROM botc_accounts WHERE session=$1`,[session]),
    setPicture:(session,bytes)=>one(`UPDATE botc_accounts SET avatar=$2,avatar_version=avatar_version+1 WHERE session=$1 RETURNING ${COLUMNS}`,[session,bytes]),
    picture:async id=>(await one('SELECT avatar FROM botc_accounts WHERE id=$1',[id]))?.avatar||null,
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
const pictureOf=a=>a?.pictured?`${a.id}?v=${a.avatar_version}`:null;
const summary=a=>a?{username:a.username,avatar:pictureOf(a)}:null;
const keyOf=username=>username.toLocaleLowerCase('en');
function usernameOf(value){const v=String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ');if(!/^[\p{L}\p{N}][\p{L}\p{N} _.-]{1,19}$/u.test(v))throw refuse('Usernames are 2–20 letters or numbers.');return v;}
function passwordOf(value){const v=String(value||'');if(v.length<6||Buffer.byteLength(v)>72)throw refuse('Passwords are 6–72 characters.');return v;}
function jpegOf(image){const m=/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(image)),bytes=m&&Buffer.from(m[1],'base64');if(!bytes||bytes.length>MAX_PICTURE||bytes[0]!==0xff||bytes[1]!==0xd8||bytes[2]!==0xff)throw refuse('Please choose a different picture.');return bytes;}
const clientOf=req=>req.headers['x-forwarded-for']?.split(',').at(-1).trim()||req.socket.remoteAddress||'';

export function mountAccounts(router,{store,rooms,identity,setSession}){
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
    res.json({enabled:true,account:summary(account),room:account?latestRoom(session):null});
  }));
  router.post('/account/register',handle(async(req,res)=>{
    limit(`register:${clientOf(req)}`,30,60*MINUTE);
    const username=usernameOf(req.body?.username),password=passwordOf(req.body?.password),session=identity(req)||randomUUID();
    if(await store.bySession(session))throw refuse('Log out before making another account.');
    // Keeping the guest's session means a player who signs up mid-game keeps their seat.
    const account=await store.create({id:randomUUID(),username,key:keyOf(username),hash:await bcrypt.hash(password,10),session});
    if(!account)throw refuse('That username is taken.',409);
    setSession(req,res,session);
    res.json({account:summary(account),room:latestRoom(session)});
  }));
  router.post('/account/login',handle(async(req,res)=>{
    const key=keyOf(usernameOf(req.body?.username)),attempts=`login:${key}`;
    limit(attempts,10,15*MINUTE);
    const account=await store.byKey(key);
    if(!account||!await bcrypt.compare(String(req.body?.password||''),account.password_hash))throw refuse('Wrong username or password.',401);
    hits.delete(attempts);
    const guest=identity(req);
    if(guest&&guest!==account.session&&!await store.bySession(guest))eachSeat(guest,(seat,game)=>{if(game.players.some(p=>p.session===account.session))return false;seat.session=account.session;seat.avatar=pictureOf(account);});
    setSession(req,res,account.session);
    res.json({account:summary(account),room:latestRoom(account.session)});
  }));
  router.post('/account/logout',handle(async(req,res)=>{setSession(req,res,randomUUID());res.json({account:null});}));
  router.post('/account/avatar',handle(async(req,res)=>{
    const session=identity(req);
    if(!session||!await store.bySession(session))throw refuse('Log in first.',401);
    limit(`picture:${session}`,30,10*MINUTE);
    const account=await store.setPicture(session,req.body?.image===null?null:jpegOf(req.body?.image));
    eachSeat(session,seat=>{seat.avatar=pictureOf(account);});
    res.json({account:summary(account)});
  }));
  router.get('/avatar/:id',handle(async(req,res)=>{
    const bytes=store&&UUID.test(req.params.id)?await store.picture(req.params.id):null;
    if(!bytes)return res.status(404).json({error:'No picture.'});
    res.setHeader('Content-Type','image/jpeg');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','public, max-age=31536000, immutable');
    res.end(bytes);
  }));
  return {avatarFor:async session=>{if(!store)return null;try{return pictureOf(await store.bySession(session));}catch{return null;}}};
}
