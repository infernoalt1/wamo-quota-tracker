// Hanbin Island accounts and saved world, kept apart from every other game's tables.
import pg from 'pg';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';

const SCHEMA = `CREATE TABLE IF NOT EXISTS hanbin_accounts(
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  username_key TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  session UUID NOT NULL UNIQUE,
  progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS hanbin_world(
  id SMALLINT PRIMARY KEY,
  data JSONB NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;
const COLUMNS = 'id,username,session,password_hash,progress';

export function pgStore(pool) {
  let ready;
  const prepare = () => (ready ||= pool.query(SCHEMA).catch((e) => { ready = null; throw e; }));
  const one = async (sql, args) => { await prepare(); return (await pool.query(sql, args)).rows[0] || null; };
  return {
    async create({ id, username, key, hash, session }) {
      try { return await one(`INSERT INTO hanbin_accounts(id,username,username_key,password_hash,session) VALUES($1,$2,$3,$4,$5) RETURNING ${COLUMNS}`, [id, username, key, hash, session]); }
      catch (e) { if (e.code === '23505') return null; throw e; }
    },
    byKey: (key) => one(`SELECT ${COLUMNS} FROM hanbin_accounts WHERE username_key=$1`, [key]),
    bySession: (session) => one(`SELECT ${COLUMNS} FROM hanbin_accounts WHERE session=$1`, [session]),
    setSession: (id, session) => one(`UPDATE hanbin_accounts SET session=$2 WHERE id=$1 RETURNING ${COLUMNS}`, [id, session]),
    saveProgress: (id, progress) => one('UPDATE hanbin_accounts SET progress=$2 WHERE id=$1 RETURNING id', [id, JSON.stringify(progress)]),
    loadWorld: async () => (await one('SELECT data FROM hanbin_world WHERE id=1'))?.data || null,
    saveWorld: (data) => one(`INSERT INTO hanbin_world(id,data) VALUES(1,$1) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,saved_at=now() RETURNING id`, [JSON.stringify(data)]),
  };
}

// Used when there is no database (local development and tests): everything lives until the process stops.
export function memoryStore() {
  const accounts = new Map();
  let world = null;
  const copy = (a) => (a ? { ...a, progress: structuredClone(a.progress) } : null);
  return {
    async create({ id, username, key, hash, session }) {
      if ([...accounts.values()].some((a) => a.key === key)) return null;
      const a = { id, username, key, password_hash: hash, session, progress: {} };
      accounts.set(id, a); return copy(a);
    },
    byKey: async (key) => copy([...accounts.values()].find((a) => a.key === key)),
    bySession: async (session) => copy([...accounts.values()].find((a) => a.session === session)),
    setSession: async (id, session) => { const a = accounts.get(id); if (a) a.session = session; return copy(a); },
    saveProgress: async (id, progress) => { const a = accounts.get(id); if (a) a.progress = structuredClone(progress); return a ? { id } : null; },
    loadWorld: async () => structuredClone(world),
    saveWorld: async (data) => { world = structuredClone(data); return { id: 1 }; },
  };
}

export function defaultStore() {
  if (!process.env.DATABASE_URL) { console.warn('Hanbin Island: no DATABASE_URL, accounts are kept in memory only.'); return memoryStore(); }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false, max: 3, connectionTimeoutMillis: 5000 });
  pool.on('error', (e) => console.error('Hanbin Island database:', e.message));
  return pgStore(pool);
}

const refuse = (message, status = 400) => Object.assign(new Error(message), { status, expose: true });
export const keyOf = (username) => username.toLocaleLowerCase('en');
export function usernameOf(value) {
  const v = String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (!/^[\p{L}\p{N}][\p{L}\p{N} _.-]{1,15}$/u.test(v)) throw refuse('Usernames are 2-16 letters or numbers.');
  return v;
}
function passwordOf(value) {
  const v = String(value || '');
  if (v.length < 6 || Buffer.byteLength(v) > 72) throw refuse('Passwords are 6-72 characters.');
  return v;
}
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

export function accountService(store, { rounds = 10 } = {}) {
  return {
    async register(username, password) {
      const name = usernameOf(username), pass = passwordOf(password);
      const a = await store.create({ id: randomUUID(), username: name, key: keyOf(name), hash: await bcrypt.hash(pass, rounds), session: randomUUID() });
      if (!a) throw refuse('That username is taken.', 409);
      return { session: a.session, username: a.username };
    },
    async login(username, password) {
      const name = usernameOf(username), pass = passwordOf(password);
      const a = await store.byKey(keyOf(name));
      if (!a || !(await bcrypt.compare(pass, a.password_hash))) throw refuse('Wrong username or password.', 401);
      const b = await store.setSession(a.id, randomUUID());
      return { session: b.session, username: b.username };
    },
    async bySession(session) {
      session = String(session || '');
      if (!UUID.test(session)) return null;
      return store.bySession(session);
    },
  };
}
