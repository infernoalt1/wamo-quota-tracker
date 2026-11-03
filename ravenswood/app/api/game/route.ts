import { env } from 'cloudflare:workers';
import { newGame, join, act, tick, view } from '../../../lib/engine.mjs';

export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200, cookie?: string) => Response.json(data, {status, headers:{'Cache-Control':'no-store, private', ...(cookie?{'Set-Cookie':cookie}:{})}});
function identity(req:Request){return req.headers.get('cookie')?.match(/(?:^|;\s*)rw_session=([a-f0-9-]{36})/)?.[1];}
function codeOf(code:unknown){const v=String(code||'').toUpperCase().trim();if(!/^[A-Z2-9]{8}$/.test(v))throw new Error('Enter an eight-character room code.');return v;}
function db(){if(!env.DB)throw new Error('The game database is not available yet.');return env.DB;}
async function load(code:string){const row=await db().prepare('SELECT state, revision FROM rooms WHERE code = ?').bind(code).first<{state:string,revision:number}>();if(!row)throw new Error('Room not found. Check the code.');return {game:JSON.parse(row.state),revision:row.revision};}
async function save(code:string,game:unknown,revision:number){const r=await db().prepare('UPDATE rooms SET state = ?, revision = revision + 1, updated_at = ? WHERE code = ? AND revision = ?').bind(JSON.stringify(game),Date.now(),code,revision).run();return r.meta.changes===1;}
function safeError(e:unknown){const message=e instanceof Error?e.message:'Request failed.';return /SQL|D1_|database|binding|constraint/i.test(message)?json({error:'The game service is temporarily unavailable. Please retry.'},503):json({error:message},400);}
export async function GET(req:Request){
 try{
  const session=identity(req);if(!session)return json({error:'Join a room to take a seat.'},401);
  const code=codeOf(new URL(req.url).searchParams.get('code'));
  for(let attempt=0;attempt<5;attempt++){
   const {game,revision}=await load(code);view(game,session); // Authorize before advancing the clock.
   if(tick(game)&&!await save(code,game,revision))continue;
   return json(view(game,session));
  }
  return json({error:'The table is busy. Please retry.'},409);
 }catch(e){return safeError(e);}
}
export async function POST(req:Request){
 try{
  const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return json({error:'Use the game website to submit actions.'},403);
  const raw=await req.text();if(raw.length>4096)return json({error:'Request too large.'},413);
  const data=JSON.parse(raw);const session=identity(req)||crypto.randomUUID();
  const cookie=`rw_session=${session}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${new URL(req.url).protocol==='https:'?'; Secure':''}`;
  if(data.type==='create'){
   const name=String(data.name||'').trim();if(!name||name.length>24)throw new Error('Choose a name of 1–24 characters.');
   const recent=await db().prepare('SELECT COUNT(*) AS n FROM rooms WHERE updated_at > ? AND state LIKE ?').bind(Date.now()-3600000,`%${session}%`).first<{n:number}>();
   if((recent?.n||0)>=8)throw new Error('You have several recent tables. Rejoin one or try later.');
   const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
   for(let i=0;i<4;i++){
    const code=Array.from(crypto.getRandomValues(new Uint8Array(8)),n=>alphabet[n%alphabet.length]).join('');
    const game=newGame(code,name,session);const result=await db().prepare('INSERT OR IGNORE INTO rooms (code,state,revision,updated_at) VALUES (?,?,0,?)').bind(code,JSON.stringify(game),Date.now()).run();
    if(result.meta.changes)return json(view(game,session),200,cookie);
   }
   throw new Error('Could not create a room. Please retry.');
  }
  const code=codeOf(data.code);
  for(let attempt=0;attempt<6;attempt++){
   const {game,revision}=await load(code);
   if(data.type==='join'){
    const name=String(data.name||'').trim();if(!name||name.length>24)throw new Error('Choose a name of 1–24 characters.');join(game,name,session);
   }else{
    view(game,session);
    // Commit elapsed transitions independently: stale actions may fail but cannot rewind time.
    if(tick(game)){if(!await save(code,game,revision))continue;return json(view(game,session),200,cookie);}
    act(game,session,data);
   }
   if(await save(code,game,revision))return data.type==='leave'?json({left:true},200,cookie):json(view(game,session),200,cookie);
  }
  return json({error:'Someone acted at the same moment. Please try again.'},409);
 }catch(e){return safeError(e);}
}
