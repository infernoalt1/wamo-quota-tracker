
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// reconstruct __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for bulk uploads

// Serve static files from the React build directory (dist)
app.use(express.static(path.join(__dirname, 'dist')));

// Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// --- DB Initialization & Seeding ---
const initDB = async () => {
  try {
    const client = await pool.connect();
    
    // Create Tables if they don't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL, 
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        voting_power INTEGER DEFAULT 1,
        custom_targets JSONB DEFAULT '{}'::jsonb,
        avatar_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT users_role_check CHECK (role IN ('admin', 'director', 'writer', 'guest'))
      );
      
      CREATE TABLE IF NOT EXISTS quotas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        target_count INTEGER NOT NULL DEFAULT 5,
        vote_target INTEGER DEFAULT 3,
        quota_pool_vote_target INTEGER DEFAULT 16,
        global_pool_vote_target INTEGER DEFAULT 4,
        min_voting_pool_size INTEGER DEFAULT 15,
        voting_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        instructions TEXT,
        due_date TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN DEFAULT FALSE,
        quota_type TEXT NOT NULL DEFAULT 'formal',
        assignment_mode TEXT NOT NULL DEFAULT 'global',
        is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS quota_assignments (
        quota_id UUID REFERENCES quotas(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        custom_target INTEGER,
        PRIMARY KEY (quota_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS rounds (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        tag TEXT,
        description TEXT,
        target_size INTEGER DEFAULT 10,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS problems (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        author_id UUID REFERENCES users(id),
        quota_id UUID REFERENCES quotas(id),
        round_id UUID REFERENCES rounds(id), -- Kept for legacy compatibility/primary display
        title TEXT NOT NULL,
        statement TEXT NOT NULL,
        solution TEXT,
        answer_key TEXT,
        image_data TEXT,
        difficulty NUMERIC(3,1) DEFAULT 0,
        topics TEXT[] DEFAULT '{}',
        score INTEGER DEFAULT 0,
        comparison_appearances INTEGER NOT NULL DEFAULT 0,
        comparison_wins INTEGER NOT NULL DEFAULT 0,
        comparison_losses INTEGER NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        order_index INTEGER DEFAULT 0,
        version INTEGER DEFAULT 1,
        deleted_at TIMESTAMP WITH TIME ZONE,
        deleted_by UUID REFERENCES users(id),
        deletion_reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- New: Many-to-Many Join Table for Rounds
      CREATE TABLE IF NOT EXISTS problem_rounds (
        problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
        round_id UUID REFERENCES rounds(id) ON DELETE CASCADE,
        order_index INTEGER DEFAULT 0,
        PRIMARY KEY (problem_id, round_id)
      );

      CREATE TABLE IF NOT EXISTS votes (
        user_id UUID REFERENCES users(id),
        problem_id UUID REFERENCES problems(id),
        vote_value INTEGER NOT NULL,
        invalid_reason TEXT,
        invalidated_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, problem_id)
      );

      CREATE TABLE IF NOT EXISTS comparison_votes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        voter_id UUID REFERENCES users(id),
        quota_id UUID REFERENCES quotas(id),
        vote_bucket TEXT NOT NULL CHECK (vote_bucket IN ('quota_pool', 'global_pool')),
        shown_problem_ids UUID[] NOT NULL,
        shown_key TEXT NOT NULL,
        selected_problem_id UUID REFERENCES problems(id),
        response_time_ms INTEGER,
        details_opened BOOLEAN NOT NULL DEFAULT FALSE,
        low_confidence BOOLEAN NOT NULL DEFAULT FALSE,
        is_optional BOOLEAN NOT NULL DEFAULT FALSE,
        is_skipped BOOLEAN NOT NULL DEFAULT FALSE,
        skip_reason TEXT,
        is_valid BOOLEAN NOT NULL DEFAULT TRUE,
        invalid_reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS comparison_vote_items (
        vote_id UUID REFERENCES comparison_votes(id) ON DELETE CASCADE,
        problem_id UUID REFERENCES problems(id),
        was_selected BOOLEAN NOT NULL DEFAULT FALSE,
        wins_awarded INTEGER NOT NULL DEFAULT 0,
        losses_awarded INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (vote_id, problem_id)
      );

      CREATE TABLE IF NOT EXISTS comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        problem_id UUID REFERENCES problems(id),
        user_id UUID REFERENCES users(id),
        text TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        problem_id UUID,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        metadata JSONB DEFAULT '{}'::jsonb,
        read_at TIMESTAMP WITH TIME ZONE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // --- MIGRATION: Ensure new columns exist for old databases ---
    await client.query(`
      ALTER TABLE problems ADD COLUMN IF NOT EXISTS difficulty NUMERIC(3,1) DEFAULT 0;
      ALTER TABLE problems ADD COLUMN IF NOT EXISTS topics TEXT[] DEFAULT '{}';
      ALTER TABLE problems ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
      ALTER TABLE problems ADD COLUMN IF NOT EXISTS image_data TEXT;
      ALTER TABLE problems ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;
      ALTER TABLE problems ADD COLUMN IF NOT EXISTS solution TEXT;
      ALTER TABLE problems ADD COLUMN IF NOT EXISTS answer_key TEXT;
      ALTER TABLE problems ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
      ALTER TABLE problems ADD COLUMN IF NOT EXISTS round_id UUID REFERENCES rounds(id);
      ALTER TABLE problems ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE problems ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id);
      ALTER TABLE problems ADD COLUMN IF NOT EXISTS deletion_reason TEXT;
      ALTER TABLE problems ADD COLUMN IF NOT EXISTS comparison_appearances INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE problems ADD COLUMN IF NOT EXISTS comparison_wins INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE problems ADD COLUMN IF NOT EXISTS comparison_losses INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_id UUID;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

      UPDATE problems SET difficulty = 10 WHERE difficulty > 10;
      UPDATE problems SET difficulty = 0.5 WHERE difficulty < 0.5 OR difficulty IS NULL;
      
      ALTER TABLE rounds ADD COLUMN IF NOT EXISTS tag TEXT;
      ALTER TABLE rounds ADD COLUMN IF NOT EXISTS target_size INTEGER DEFAULT 10;
      ALTER TABLE quotas ADD COLUMN IF NOT EXISTS vote_target INTEGER DEFAULT 3;
      ALTER TABLE quotas ADD COLUMN IF NOT EXISTS quota_pool_vote_target INTEGER;
      ALTER TABLE quotas ADD COLUMN IF NOT EXISTS global_pool_vote_target INTEGER;
      ALTER TABLE quotas ADD COLUMN IF NOT EXISTS min_voting_pool_size INTEGER;
      ALTER TABLE quotas ADD COLUMN IF NOT EXISTS voting_enabled BOOLEAN;
      ALTER TABLE quotas ADD COLUMN IF NOT EXISTS quota_type TEXT NOT NULL DEFAULT 'formal';
      ALTER TABLE quotas ADD COLUMN IF NOT EXISTS assignment_mode TEXT NOT NULL DEFAULT 'global';
      ALTER TABLE quotas ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT TRUE;
      ALTER TABLE votes ADD COLUMN IF NOT EXISTS invalid_reason TEXT;
      ALTER TABLE votes ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMP WITH TIME ZONE;

      CREATE TABLE IF NOT EXISTS quota_assignments (
        quota_id UUID REFERENCES quotas(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        custom_target INTEGER,
        PRIMARY KEY (quota_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS comparison_votes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        voter_id UUID REFERENCES users(id),
        quota_id UUID REFERENCES quotas(id),
        vote_bucket TEXT NOT NULL CHECK (vote_bucket IN ('quota_pool', 'global_pool')),
        shown_problem_ids UUID[] NOT NULL,
        shown_key TEXT NOT NULL,
        selected_problem_id UUID REFERENCES problems(id),
        response_time_ms INTEGER,
        details_opened BOOLEAN NOT NULL DEFAULT FALSE,
        low_confidence BOOLEAN NOT NULL DEFAULT FALSE,
        is_optional BOOLEAN NOT NULL DEFAULT FALSE,
        is_skipped BOOLEAN NOT NULL DEFAULT FALSE,
        skip_reason TEXT,
        is_valid BOOLEAN NOT NULL DEFAULT TRUE,
        invalid_reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS comparison_vote_items (
        vote_id UUID REFERENCES comparison_votes(id) ON DELETE CASCADE,
        problem_id UUID REFERENCES problems(id),
        was_selected BOOLEAN NOT NULL DEFAULT FALSE,
        wins_awarded INTEGER NOT NULL DEFAULT 0,
        losses_awarded INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (vote_id, problem_id)
      );

      UPDATE quotas
      SET quota_pool_vote_target = COALESCE(quota_pool_vote_target, vote_target, 3),
          global_pool_vote_target = COALESCE(global_pool_vote_target, 0),
          min_voting_pool_size = COALESCE(min_voting_pool_size, 15),
          voting_enabled = COALESCE(voting_enabled, TRUE);

      UPDATE quotas
      SET vote_target = 0,
          quota_pool_vote_target = 0,
          global_pool_vote_target = 0,
          voting_enabled = FALSE
      WHERE quota_type = 'general';

      UPDATE votes v
      SET invalid_reason = 'self_vote',
          invalidated_at = COALESCE(v.invalidated_at, CURRENT_TIMESTAMP)
      FROM problems p
      WHERE v.problem_id = p.id
        AND v.user_id = p.author_id
        AND v.invalid_reason IS NULL;

      UPDATE problems p
      SET score = COALESCE((
        SELECT SUM(v.vote_value)
        FROM votes v
        WHERE v.problem_id = p.id
          AND v.invalid_reason IS NULL
          AND v.user_id IS DISTINCT FROM p.author_id
      ), 0);
    `);

    // --- MIGRATION: Notifications table (for existing databases) ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        problem_id UUID,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        metadata JSONB DEFAULT '{}'::jsonb,
        read_at TIMESTAMP WITH TIME ZONE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Existing databases may have been created with notifications.problem_id as
    // a foreign key to problems. Deletion notices need to survive the problem
    // row being deleted, so keep this column as a plain UUID.
    const notifProblemConstraints = await client.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'notifications'::regclass
        AND contype = 'f'
        AND conkey = ARRAY[
          (
            SELECT attnum
            FROM pg_attribute
            WHERE attrelid = 'notifications'::regclass
              AND attname = 'problem_id'
          )
        ]::smallint[]
    `);
    for (const row of notifProblemConstraints.rows) {
      const constraintName = row.conname.replace(/"/g, '""');
      await client.query(`ALTER TABLE notifications DROP CONSTRAINT "${constraintName}"`);
    }

    // --- MIGRATION: Backfill problem_rounds from legacy round_id if empty ---
    const checkJoin = await client.query('SELECT count(*) FROM problem_rounds');
    if (parseInt(checkJoin.rows[0].count) === 0) {
        await client.query(`
            INSERT INTO problem_rounds (problem_id, round_id, order_index)
            SELECT id, round_id, order_index FROM problems WHERE round_id IS NOT NULL
        `);
    }

    // // --- MIGRATION: Update Statuses for New Workflow ---
    // // 1. Ensure problems in rounds are marked 'accepted'
    // await client.query("UPDATE problems SET status = 'accepted' WHERE id IN (SELECT problem_id FROM problem_rounds)");
    
    // // 2. Ensure problems NOT in rounds but 'approved' (legacy Pool) are moved to 'pending' (Waitlist)
    // //    We only do this for problems that are 'approved' and have NO round entries.
    // //    This effectively resets the pool so the Director must verify everything via Waitlist.
    // await client.query("UPDATE problems SET status = 'pending' WHERE status = 'approved' AND id NOT IN (SELECT problem_id FROM problem_rounds)");

    // --- MIGRATION: Update Role Constraint to include 'director' and 'guest' ---
    try {
       await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
       await client.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'director', 'writer', 'guest'))`);
    } catch (e) {
       console.log("Constraint update warning (may already exist):", e.message);
    }

    // Seed Admin if not exists
    const adminCheck = await client.query("SELECT * FROM users WHERE role = 'admin'");
    if (adminCheck.rows.length === 0) {
      const hash = await bcrypt.hash('admin123', 10);
      await client.query(
        "INSERT INTO users (name, email, password_hash, role, voting_power) VALUES ($1, $2, $3, $4, $5)",
        ['Director', 'admin@probfair.org', hash, 'admin', 5]
      );
      console.log('--- Default Admin Account Created: admin@probfair.org / admin123 ---');
    }

    // Seed Guest if not exists
    const guestCheck = await client.query("SELECT * FROM users WHERE role = 'guest'");
    if (guestCheck.rows.length === 0) {
      const hash = await bcrypt.hash('guest123', 10);
      await client.query(
        "INSERT INTO users (name, email, password_hash, role, voting_power) VALUES ($1, $2, $3, $4, $5)",
        ['Guest Contributor', 'guest@probfair.org', hash, 'guest', 0]
      );
      console.log('--- Guest Account Created ---');
    }

    // Seed General Quota if none exists
    const generalQuotaCheck = await client.query("SELECT * FROM quotas WHERE quota_type = 'general' LIMIT 1");
    if (generalQuotaCheck.rows.length === 0) {
      await client.query(
        `INSERT INTO quotas (
          name, target_count, vote_target, quota_pool_vote_target, global_pool_vote_target,
          min_voting_pool_size, voting_enabled, instructions, is_active, quota_type, assignment_mode, is_enabled
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        ['General Submissions', 0, 0, 0, 0, 15, false, 'Submit problems freely, outside of any formal quota cycle.', true, 'general', 'global', true]
      );
      console.log('--- General Submissions quota created ---');
    }
    
    client.release();
    console.log("Database initialized successfully.");
  } catch (err) {
    console.error("Error initializing database:", err);
  }
};

// --- Middleware: Verify JWT ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- Helper: Create Notification (safe to call inside transactions) ---
async function createNotification(db, { userId, actorId, problemId, type, title, body, metadata }) {
  if (!userId) return;
  try {
    await db.query(
      `INSERT INTO notifications (user_id, actor_id, problem_id, type, title, body, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, actorId || null, problemId || null, type, title, body, JSON.stringify(metadata || {})]
    );
  } catch (e) {
    console.error('createNotification failed:', e.message);
  }
}

async function createRoundMembershipNotification(db, { userId, actorId, problemId, type, title, body, metadata }) {
  if (!userId) return;
  const roundId = metadata?.roundId;
  if (!roundId) {
    return createNotification(db, { userId, actorId, problemId, type, title, body, metadata });
  }

  try {
    const existing = await db.query(
      `SELECT id FROM notifications
       WHERE user_id = $1
         AND problem_id = $2
         AND type IN ('problem_added_to_round', 'problem_removed_from_round')
         AND metadata->>'roundId' = $3
         AND created_at > CURRENT_TIMESTAMP - INTERVAL '10 minutes'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, problemId || null, roundId]
    );

    if (existing.rows.length > 0) {
      await db.query(
        `UPDATE notifications
         SET actor_id = $1,
             type = $2,
             title = $3,
             body = $4,
             metadata = $5,
             read_at = NULL,
             created_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6`,
        [actorId || null, type, title, body, JSON.stringify(metadata || {}), existing.rows[0].id]
      );
      return;
    }

    await createNotification(db, { userId, actorId, problemId, type, title, body, metadata });
  } catch (e) {
    console.error('createRoundMembershipNotification failed:', e.message);
  }
}

function normalizeDifficulty(input) {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return 0.5;
  return Number(Math.min(Math.max(parsed, 0.5), 10).toFixed(1));
}

const VALID_VOTE_BUCKETS = new Set(['quota_pool', 'global_pool']);

function getInt(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
}

function getQuotaPoolVoteTarget(q) {
  return getInt(q.quota_pool_vote_target ?? q.quotaPoolVoteTarget ?? q.vote_target ?? q.voteTarget, 3);
}

function getGlobalPoolVoteTarget(q) {
  return getInt(q.global_pool_vote_target ?? q.globalPoolVoteTarget, 0);
}

function getMinVotingPoolSize(q) {
  return Math.max(3, getInt(q.min_voting_pool_size ?? q.minVotingPoolSize, 15));
}

function mapQuotaRow(q) {
  const quotaPoolVoteTarget = getQuotaPoolVoteTarget(q);
  const globalPoolVoteTarget = getGlobalPoolVoteTarget(q);
  return {
    id: q.id,
    name: q.name,
    target: getInt(q.target_count ?? q.target, 5),
    voteTarget: quotaPoolVoteTarget + globalPoolVoteTarget,
    quotaPoolVoteTarget,
    globalPoolVoteTarget,
    minVotingPoolSize: getMinVotingPoolSize(q),
    votingEnabled: q.voting_enabled !== false,
    instructions: q.instructions,
    dueDate: q.due_date ? new Date(q.due_date).getTime() : null,
    quotaType: q.quota_type || 'formal',
    assignmentMode: q.assignment_mode || 'global',
    isEnabled: q.is_enabled !== false,
    assignedUserIds: q.assigned_user_ids || []
  };
}

function mapProblemRow(row, { hideAuthor = false } = {}) {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: hideAuthor ? 'Hidden' : (row.author_name || 'Unknown'),
    quotaId: row.quota_id,
    roundId: row.round_id,
    roundIds: row.round_ids || [],
    title: row.title,
    statement: row.statement,
    solution: row.solution,
    answerKey: row.answer_key,
    imageData: row.image_data,
    difficulty: normalizeDifficulty(row.difficulty),
    topics: row.topics || [],
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    score: parseInt(row.valid_score ?? row.score ?? '0', 10),
    votedBy: row.voted_by || [],
    status: row.status || 'pending',
    orderIndex: row.order_index || 0,
    roundOrderIndexes: row.round_order_indexes || {},
    version: row.version,
    commentCount: parseInt(row.comment_count || '0', 10),
    comparisonAppearances: parseInt(row.comparison_appearances || '0', 10),
    comparisonWins: parseInt(row.comparison_wins || '0', 10),
    comparisonLosses: parseInt(row.comparison_losses || '0', 10)
  };
}

function normalizeShownIds(ids) {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.filter(Boolean).map(String))];
}

function getShownKey(ids) {
  return normalizeShownIds(ids).sort().join(':');
}

async function getEligibleQuota(client, quotaId, user) {
  const result = await client.query(
    `SELECT q.*,
       array_agg(qa.user_id) FILTER (WHERE qa.user_id IS NOT NULL) as assigned_user_ids
     FROM quotas q
     LEFT JOIN quota_assignments qa ON qa.quota_id = q.id
     WHERE q.id = $1 AND q.is_enabled = TRUE
     GROUP BY q.id`,
    [quotaId]
  );
  if (result.rows.length === 0) return null;
  const q = result.rows[0];
  if ((q.quota_type || 'formal') !== 'formal') return null;
  const isAdmin = user.role === 'admin' || user.role === 'director';
  const assignedIds = q.assigned_user_ids || [];
  const canUse = isAdmin
    || q.quota_type === 'general'
    || q.assignment_mode === 'global'
    || assignedIds.includes(user.id);
  return canUse ? q : null;
}

async function getVotingProgress(client, quotaRow, userId) {
  const q = mapQuotaRow(quotaRow);
  const submitted = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM problems
     WHERE quota_id = $1
       AND author_id = $2
       AND deleted_at IS NULL
       AND status IN ('approved', 'accepted')`,
    [q.id, userId]
  );
  const voteCounts = await client.query(
    `SELECT vote_bucket, COUNT(*)::int AS count
     FROM comparison_votes
     WHERE voter_id = $1
       AND quota_id = $2
       AND is_valid = TRUE
       AND is_skipped = FALSE
     GROUP BY vote_bucket`,
    [userId, q.id]
  );
  const rawByBucket = { quota_pool: 0, global_pool: 0 };
  for (const row of voteCounts.rows) rawByBucket[row.vote_bucket] = parseInt(row.count || '0', 10);
  const quotaRequired = q.quotaPoolVoteTarget;
  const globalRequired = q.globalPoolVoteTarget;
  const quotaRaw = rawByBucket.quota_pool;
  const globalRaw = rawByBucket.global_pool;
  return {
    quota: q,
    writingCompleted: parseInt(submitted.rows[0]?.count || '0', 10),
    writingRequired: q.quotaType === 'general' ? 0 : q.target,
    quotaPool: {
      completed: Math.min(quotaRaw, quotaRequired),
      rawCompleted: quotaRaw,
      required: quotaRequired
    },
    globalPool: {
      completed: Math.min(globalRaw, globalRequired),
      rawCompleted: globalRaw,
      required: globalRequired
    },
    totalCompleted: Math.min(quotaRaw, quotaRequired) + Math.min(globalRaw, globalRequired),
    totalRawCompleted: quotaRaw + globalRaw,
    totalRequired: quotaRequired + globalRequired,
    isComplete: quotaRaw >= quotaRequired && globalRaw >= globalRequired
  };
}

function chooseNextBucket(progress, requestedBucket) {
  if (VALID_VOTE_BUCKETS.has(requestedBucket)) return requestedBucket;
  const quotaReq = progress.quotaPool.required;
  const globalReq = progress.globalPool.required;
  const quotaPct = quotaReq > 0 ? progress.quotaPool.rawCompleted / quotaReq : Infinity;
  const globalPct = globalReq > 0 ? progress.globalPool.rawCompleted / globalReq : Infinity;
  const quotaNeedsVotes = quotaReq > 0 && progress.quotaPool.rawCompleted < quotaReq;
  const globalNeedsVotes = globalReq > 0 && progress.globalPool.rawCompleted < globalReq;
  if (quotaNeedsVotes && globalNeedsVotes) return quotaPct <= globalPct ? 'quota_pool' : 'global_pool';
  if (quotaNeedsVotes) return 'quota_pool';
  if (globalNeedsVotes) return 'global_pool';
  return quotaReq > 0 ? 'quota_pool' : 'global_pool';
}

async function getEligibleProblemCount(client, quotaId, userId, bucket) {
  const params = [userId, quotaId];
  const quotaFilter = bucket === 'quota_pool' ? 'p.quota_id = $2' : 'p.quota_id IS DISTINCT FROM $2';
  const result = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM problems p
     WHERE p.deleted_at IS NULL
       AND p.status IN ('approved', 'accepted')
       AND p.author_id IS DISTINCT FROM $1
       AND ${quotaFilter}`,
    params
  );
  return parseInt(result.rows[0]?.count || '0', 10);
}

async function getCandidateProblems(client, quotaId, userId, bucket) {
  const quotaFilter = bucket === 'quota_pool' ? 'p.quota_id = $2' : 'p.quota_id IS DISTINCT FROM $2';
  const result = await client.query(
    `SELECT p.*, q.name as source_name, u.name as author_name,
        (SELECT COUNT(*) FROM comments WHERE problem_id = p.id) as comment_count,
        COALESCE(COUNT(cvi.vote_id), 0) as voting_appearances
     FROM problems p
     LEFT JOIN quotas q ON q.id = p.quota_id
     LEFT JOIN users u ON p.author_id = u.id
     LEFT JOIN comparison_vote_items cvi ON cvi.problem_id = p.id
     WHERE p.deleted_at IS NULL
       AND p.status IN ('approved', 'accepted')
       AND p.author_id IS DISTINCT FROM $1
       AND ${quotaFilter}
     GROUP BY p.id, q.name, u.name
     ORDER BY voting_appearances ASC, p.comparison_appearances ASC, random()
     LIMIT 24`,
    [userId, quotaId]
  );
  return result.rows;
}

async function recentShownKeys(client, quotaId, userId, bucket) {
  const result = await client.query(
    `SELECT shown_key
     FROM comparison_votes
     WHERE voter_id = $1 AND quota_id = $2 AND vote_bucket = $3
     ORDER BY created_at DESC
     LIMIT 80`,
    [userId, quotaId, bucket]
  );
  return new Set(result.rows.map(r => r.shown_key));
}

function pickTriple(candidates, seenKeys) {
  const pool = [...candidates];
  for (let attempt = 0; attempt < 80; attempt++) {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const triple = [];
    const authors = new Set();
    for (const candidate of shuffled) {
      if (triple.length < 2 || !authors.has(candidate.author_id)) {
        triple.push(candidate);
        authors.add(candidate.author_id);
      }
      if (triple.length === 3) break;
    }
    if (triple.length < 3) {
      triple.push(...shuffled.filter(c => !triple.some(t => t.id === c.id)).slice(0, 3 - triple.length));
    }
    if (triple.length === 3 && !seenKeys.has(getShownKey(triple.map(p => p.id)))) {
      return triple.sort(() => Math.random() - 0.5);
    }
  }
  return pool.slice(0, 3).sort(() => Math.random() - 0.5);
}

async function validateVotingProblemSet(client, { quotaId, userId, bucket, shownProblemIds, selectedProblemId, requireSelected }) {
  if (!VALID_VOTE_BUCKETS.has(bucket)) {
    return { ok: false, status: 400, error: 'Invalid vote bucket.' };
  }
  const ids = normalizeShownIds(shownProblemIds);
  if (ids.length !== 3) {
    return { ok: false, status: 400, error: 'A comparison vote must include exactly 3 shown problems.' };
  }
  if (requireSelected && !ids.includes(selectedProblemId)) {
    return { ok: false, status: 400, error: 'Selected problem must be one of the shown problems.' };
  }
  const result = await client.query(
    `SELECT id, author_id, quota_id, status, deleted_at
     FROM problems
     WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  if (result.rows.length !== 3) {
    return { ok: false, status: 400, error: 'One or more shown problems are unavailable.' };
  }
  for (const row of result.rows) {
    if (row.deleted_at || !['approved', 'accepted'].includes(row.status || 'pending')) {
      return { ok: false, status: 400, error: 'One or more shown problems are not eligible for voting.' };
    }
    if (row.author_id === userId) {
      return { ok: false, status: 400, error: 'You cannot vote on a set containing your own problem.' };
    }
    if (bucket === 'quota_pool' && row.quota_id !== quotaId) {
      return { ok: false, status: 400, error: 'Quota pool votes must use problems from the selected quota.' };
    }
    if (bucket === 'global_pool' && row.quota_id === quotaId) {
      return { ok: false, status: 400, error: 'Global pool votes must use problems outside the selected quota.' };
    }
  }
  return { ok: true, ids, shownKey: getShownKey(ids), rows: result.rows };
}

// --- Routes: Auth ---

app.get('/auth/me', authenticateToken, async (req, res) => {
  try {
     const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
     const user = result.rows[0];
     if (!user) return res.sendStatus(404);
     
     res.json({
        id: user.id,
        name: user.name,
        role: user.role,
        votingPower: user.voting_power,
        customTargets: user.custom_targets || {},
        avatarUrl: user.avatar_url || null
     });
  } catch(err) {
     console.error(err);
     res.sendStatus(500);
  }
});

app.post('/auth/guest-login', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users WHERE role = 'guest' LIMIT 1");
    const user = result.rows[0];
    if (!user) return res.status(500).json({error: "Guest account not configured"});

    const token = jwt.sign({ id: user.id, role: user.role, power: user.voting_power }, process.env.JWT_SECRET);
    res.json({ accessToken: token, user: {
       id: user.id,
       name: user.name,
       role: user.role,
       votingPower: user.voting_power,
       customTargets: user.custom_targets || {},
       avatarUrl: user.avatar_url || null
    }});
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Login failed" });
  }
});

app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, role, avatarUrl } = req.body;
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Ensure role is valid
    const safeRole = ['admin', 'director', 'writer'].includes(role) ? role : 'writer';

    // Return all fields needed for the frontend User interface
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, role, avatar_url) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, role, voting_power, custom_targets, avatar_url',
      [name, email, hashedPassword, safeRole, avatarUrl || null]
    );
    
    const u = result.rows[0];
    res.json({
        id: u.id,
        name: u.name,
        role: u.role,
        votingPower: u.voting_power,
        customTargets: u.custom_targets || {},
        avatarUrl: u.avatar_url || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Allow login by name (for the UI list selection) OR email
    let result;
    if (email.includes('@')) {
        result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    } else {
        // Fallback for ID login if passed
        result = await pool.query('SELECT * FROM users WHERE id = $1', [email]);
    }
    
    const user = result.rows[0];

    if (!user) return res.status(400).json({ error: 'User not found' });

    if (await bcrypt.compare(password, user.password_hash)) {
      const token = jwt.sign({ id: user.id, role: user.role, power: user.voting_power }, process.env.JWT_SECRET);
      
      res.json({ accessToken: token, user: { 
        id: user.id, 
        name: user.name, 
        role: user.role, 
        votingPower: user.voting_power,
        customTargets: user.custom_targets || {},
        avatarUrl: user.avatar_url || null
      }});
    } else {
      res.status(403).json({ error: 'Invalid password' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send();
  }
});

// --- Routes: Users ---

app.get('/api/users', async (req, res) => {
  // Made public to populate the Login "Select User" list
  try {
    const result = await pool.query("SELECT id, name, role, voting_power, custom_targets, avatar_url FROM users WHERE role != 'guest' ORDER BY name");
    const users = result.rows.map(u => ({
        id: u.id,
        name: u.name,
        role: u.role,
        votingPower: u.voting_power,
        customTargets: u.custom_targets || {},
        avatarUrl: u.avatar_url || null,
        password: '' // Don't send hashes
    }));
    res.json(users);
  } catch (err) {
    console.error("Fetch users failed:", err);
    res.status(500).json({error: 'Failed'});
  }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'director') return res.sendStatus(403);
  
  const { id } = req.params;
  const { name, password, votingPower, customTargets, role, avatarUrl } = req.body;
  
  try {
    // Permission Check: Sub-Director Limitations
    if (req.user.role === 'director') {
        // 1. Cannot modify password
        if (password && password.trim() !== '') {
            return res.status(403).json({ error: "Directors cannot modify passwords" });
        }
        
        // 2. Cannot modify Admins
        const targetCheck = await pool.query('SELECT role FROM users WHERE id = $1', [id]);
        if (targetCheck.rows.length > 0 && targetCheck.rows[0].role === 'admin') {
             return res.status(403).json({ error: "Directors cannot modify Admins" });
        }
    }

    let query = 'UPDATE users SET name = $1, voting_power = $2, custom_targets = $3';
    let params = [name, votingPower, customTargets];
    let paramIndex = 4;

    // Update Password (if allowed and present)
    if (password && password.trim() !== '') {
        const hashedPassword = await bcrypt.hash(password, 10);
        query += `, password_hash = $${paramIndex++}`;
        params.push(hashedPassword);
    }
    
    // Update Role (Admin only)
    if (role && req.user.role === 'admin') {
         query += `, role = $${paramIndex++}`;
         params.push(role);
    }

    if (avatarUrl !== undefined) {
         query += `, avatar_url = $${paramIndex++}`;
         params.push(avatarUrl || null);
    }

    query += ` WHERE id = $${paramIndex}`;
    params.push(id);
    
    await pool.query(query, params);

    // FIX: Propagate Voting Power Changes
    if (votingPower !== undefined) {
        await pool.query('UPDATE votes SET vote_value = $1 WHERE user_id = $2', [votingPower, id]);
        await pool.query(`
          UPDATE problems 
          SET score = (
            SELECT COALESCE(SUM(vote_value), 0) 
            FROM votes
            WHERE votes.problem_id = problems.id
              AND votes.invalid_reason IS NULL
              AND votes.user_id IS DISTINCT FROM problems.author_id
          )
          WHERE id IN (SELECT problem_id FROM votes WHERE user_id = $1)
        `, [id]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Update failed' });
  }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'director') return res.sendStatus(403);
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const userId = req.params.id;

        // Permission Check: Director cannot delete Admin or Director
        if (req.user.role === 'director') {
             const targetCheck = await client.query('SELECT role FROM users WHERE id = $1', [userId]);
             const targetRole = targetCheck.rows[0]?.role;
             if (targetRole === 'admin' || targetRole === 'director') {
                 await client.query('ROLLBACK');
                 return res.status(403).json({ error: "Directors can only delete Writers" });
             }
        }

        await client.query('DELETE FROM votes WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM comments WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM votes WHERE problem_id IN (SELECT id FROM problems WHERE author_id = $1)', [userId]);
        await client.query('DELETE FROM comments WHERE problem_id IN (SELECT id FROM problems WHERE author_id = $1)', [userId]);
        await client.query('DELETE FROM problems WHERE author_id = $1', [userId]);
        await client.query('DELETE FROM users WHERE id = $1', [userId]);
        await client.query('COMMIT');
        res.json({ success: true });
    } catch(err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Delete failed' });
    } finally {
        client.release();
    }
});

// --- Routes: Problems ---

app.get('/api/problems', authenticateToken, async (req, res) => {
  // Guests should NOT see problems
  if (req.user.role === 'guest') {
    return res.json([]);
  }

  try {
    const result = await pool.query(`
      SELECT p.*, u.name as author_name,
      COALESCE((
        SELECT SUM(v.vote_value)
        FROM votes v
        WHERE v.problem_id = p.id
          AND v.invalid_reason IS NULL
          AND v.user_id IS DISTINCT FROM p.author_id
      ), 0) as valid_score,
      (SELECT array_agg(v.user_id) FROM votes v WHERE v.problem_id = p.id AND v.invalid_reason IS NULL AND v.user_id IS DISTINCT FROM p.author_id) as voted_by,
      (SELECT COUNT(*) FROM comments WHERE problem_id = p.id) as comment_count,
      (SELECT array_agg(round_id) FROM problem_rounds WHERE problem_id = p.id) as round_ids,
      (SELECT COALESCE(json_object_agg(round_id, order_index), '{}'::json) FROM problem_rounds WHERE problem_id = p.id) as round_order_indexes
      FROM problems p
      LEFT JOIN users u ON p.author_id = u.id
      WHERE p.deleted_at IS NULL
      ORDER BY valid_score DESC, p.created_at DESC
    `);
    
    const problems = result.rows.map(row => ({
      ...row,
      authorName: row.author_name || 'Unknown',
      authorId: row.author_id,
      quotaId: row.quota_id, // Ensure we send this
      score: parseInt(row.valid_score || '0', 10),
      roundId: row.round_id, // Legacy/Primary round
      roundIds: row.round_ids || [], // New: Many-to-Many
      difficulty: normalizeDifficulty(row.difficulty),
      topics: row.topics || [],
      status: row.status || 'pending',
      orderIndex: row.order_index || 0,
      roundOrderIndexes: row.round_order_indexes || {},
      createdAt: new Date(row.created_at).getTime(),
      votedBy: row.voted_by || [],
      imageData: row.image_data,
      solution: row.solution,
      answerKey: row.answer_key,
      version: row.version,
      commentCount: parseInt(row.comment_count || '0'),
      comparisonAppearances: parseInt(row.comparison_appearances || '0', 10),
      comparisonWins: parseInt(row.comparison_wins || '0', 10),
      comparisonLosses: parseInt(row.comparison_losses || '0', 10)
    }));

    res.json(problems);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch problems' });
  }
});

app.get('/api/problems/deleted', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'director') {
    return res.sendStatus(403);
  }

  try {
    const result = await pool.query(`
      SELECT p.*, u.name as author_name,
        deleter.id as deleted_by_id,
        deleter.name as deleted_by_name,
        deleter.avatar_url as deleted_by_avatar_url,
        COALESCE((
          SELECT SUM(v.vote_value)
          FROM votes v
          WHERE v.problem_id = p.id
            AND v.invalid_reason IS NULL
            AND v.user_id IS DISTINCT FROM p.author_id
        ), 0) as valid_score,
        (SELECT array_agg(v.user_id) FROM votes v WHERE v.problem_id = p.id AND v.invalid_reason IS NULL AND v.user_id IS DISTINCT FROM p.author_id) as voted_by,
        (SELECT COUNT(*) FROM comments WHERE problem_id = p.id) as comment_count,
        (SELECT array_agg(round_id) FROM problem_rounds WHERE problem_id = p.id) as round_ids,
        (SELECT COALESCE(json_object_agg(round_id, order_index), '{}'::json) FROM problem_rounds WHERE problem_id = p.id) as round_order_indexes
      FROM problems p
      LEFT JOIN users u ON p.author_id = u.id
      LEFT JOIN users deleter ON p.deleted_by = deleter.id
      WHERE p.deleted_at IS NOT NULL
      ORDER BY p.deleted_at DESC
    `);

    const problems = result.rows.map(row => ({
      ...row,
      authorName: row.author_name || 'Unknown',
      authorId: row.author_id,
      quotaId: row.quota_id,
      score: parseInt(row.valid_score || '0', 10),
      roundId: row.round_id,
      roundIds: row.round_ids || [],
      difficulty: normalizeDifficulty(row.difficulty),
      topics: row.topics || [],
      status: row.status || 'pending',
      orderIndex: row.order_index || 0,
      roundOrderIndexes: row.round_order_indexes || {},
      createdAt: new Date(row.created_at).getTime(),
      votedBy: row.voted_by || [],
      imageData: row.image_data,
      solution: row.solution,
      answerKey: row.answer_key,
      version: row.version,
      commentCount: parseInt(row.comment_count || '0'),
      comparisonAppearances: parseInt(row.comparison_appearances || '0', 10),
      comparisonWins: parseInt(row.comparison_wins || '0', 10),
      comparisonLosses: parseInt(row.comparison_losses || '0', 10),
      deletedAt: row.deleted_at ? new Date(row.deleted_at).getTime() : null,
      deletedBy: row.deleted_by_id || row.deleted_by || null,
      deletedByName: row.deleted_by_name || null,
      deletedByAvatarUrl: row.deleted_by_avatar_url || null,
      deletionReason: row.deletion_reason || null
    }));

    res.json(problems);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch deleted problems' });
  }
});

app.post('/api/problems', authenticateToken, async (req, res) => {
  try {
    const { title, statement, quotaId, difficulty, topics, imageData, solution, answerKey } = req.body;
    
    const diffVal = normalizeDifficulty(difficulty);
    
    const result = await pool.query(
      'INSERT INTO problems (author_id, quota_id, title, statement, difficulty, topics, status, image_data, solution, answer_key, version) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1) RETURNING *',
      [req.user.id, quotaId, title, statement, diffVal, topics || [], 'pending', imageData, solution, answerKey]
    );

    res.json({ ...result.rows[0], isAcceptable: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Submission failed' });
  }
});

app.put('/api/problems/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const updates = req.body; // Expect partial updates
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    // 1. Verify ownership or admin status
    const check = await pool.query('SELECT author_id, title, status, deleted_at FROM problems WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Problem not found' });
    if (check.rows[0].deleted_at) return res.status(409).json({ error: 'Cannot edit a deleted problem' });
    
    const authorId = check.rows[0].author_id;
    if (authorId !== userId && userRole !== 'admin' && userRole !== 'director') {
      return res.status(403).json({ error: 'Not authorized to edit this problem' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Handle Round Assignment Special Case (Many-to-Many)
        if (updates.roundId !== undefined) {
             const newRoundId = updates.roundId;
             
             // If assigning to a round (not null/undefined)
             if (newRoundId) {
                // Check if already in this round
                const exists = await client.query('SELECT * FROM problem_rounds WHERE problem_id = $1 AND round_id = $2', [id, newRoundId]);
                if (exists.rows.length === 0) {
                     // Get max index
                     const maxIdxRes = await client.query('SELECT MAX(order_index) as m FROM problem_rounds WHERE round_id = $1', [newRoundId]);
                     const nextIdx = (maxIdxRes.rows[0].m || 0) + 1;
                     await client.query('INSERT INTO problem_rounds (problem_id, round_id, order_index) VALUES ($1, $2, $3)', [id, newRoundId, nextIdx]);

                     // Notify problem author
                     const roundInfoRes = await client.query('SELECT name FROM rounds WHERE id = $1', [newRoundId]);
                     const roundName = roundInfoRes.rows[0]?.name || 'a round';
                     const authorId = check.rows[0].author_id;
                     const problemTitle = check.rows[0].title;
                     if (authorId && authorId !== req.user.id) {
                         await createRoundMembershipNotification(client, {
                             userId: authorId, actorId: req.user.id, problemId: id,
                             type: 'problem_added_to_round',
                             title: 'Added to Round',
                             body: `'${problemTitle}' was added to ${roundName}.`,
                             metadata: { roundId: newRoundId, roundName, problemTitle }
                         });
                     }
                }
                // Update legacy column for display compatibility
                await client.query('UPDATE problems SET round_id = $1 WHERE id = $2', [newRoundId, id]);
             } else if (newRoundId === null) {
                 // Explicit null means remove from round? 
                 // NOTE: Front end sends { roundId: null } when removing from *specific* round context usually.
                 // But for simplicity, if frontend sends roundId, we update legacy.
                 // For removing, we should use a specific endpoint or handle it carefully.
                 // We will update the legacy column to null. 
                 await client.query('UPDATE problems SET round_id = NULL WHERE id = $1', [id]);
                 // We do NOT delete from problem_rounds here because we don't know WHICH round to remove from 
                 // without more context, unless we clear ALL.
                 // Use separate logic/endpoint for removing from round.
             }
        }
        
        // 2. Dynamic Update Query Construction for problems table
        const setClauses = [];
        const values = [];
        let idx = 1;

        // Whitelist allowed fields to prevent arbitrary column injection
        const allowedFields = ['title', 'statement', 'solution', 'answerKey', 'difficulty', 'topics', 'imageData', 'status', 'version'];
        
        // Mapping frontend camelCase to DB snake_case
        const dbMapping = {
            title: 'title',
            statement: 'statement',
            solution: 'solution',
            answerKey: 'answer_key',
            difficulty: 'difficulty',
            topics: 'topics',
            imageData: 'image_data',
            status: 'status'
            // version is handled specially
        };

        // Build SET clauses
        const contentFieldsChanged = Object.keys(updates).some(key =>
          ['title', 'statement', 'solution', 'answerKey', 'difficulty', 'topics', 'imageData'].includes(key)
        );
        let updatedProblemTitle = check.rows[0].title;
        for (const key of Object.keys(updates)) {
            if (allowedFields.includes(key) && key !== 'version') {
                 const dbCol = dbMapping[key];
                 if (dbCol) {
                     setClauses.push(`${dbCol} = $${idx++}`);
                     values.push(key === 'difficulty' ? normalizeDifficulty(updates[key]) : (updates[key] === undefined ? null : updates[key]));
                 }
            }
        }

        if (setClauses.length > 0) {
            // Handle Version Increment
            setClauses.push(`version = version + 1`);

            let query = `UPDATE problems SET ${setClauses.join(', ')} WHERE id = $${idx++}`;
            values.push(id);

            // Optimistic locking check (if version provided)
            if (updates.version !== undefined) {
                 query += ` AND version = $${idx++}`;
                 values.push(updates.version);
            }

            query += ` RETURNING *`;
            const updateRes = await client.query(query, values);
            updatedProblemTitle = updateRes.rows[0]?.title || updatedProblemTitle;

            if (updates.status && updates.status !== check.rows[0].status && check.rows[0].author_id !== req.user.id) {
                const notificationDetails = {
                    approved: {
                        type: 'problem_approved',
                        title: 'Problem Approved',
                        body: `Your problem '${check.rows[0].title}' was approved.`
                    },
                    pending: {
                        type: 'problem_returned_to_waitlist',
                        title: 'Returned to Waitlist',
                        body: `'${check.rows[0].title}' was returned to the waitlist.`
                    }
                }[updates.status];

                if (notificationDetails) {
                    await createNotification(client, {
                        userId: check.rows[0].author_id,
                        actorId: req.user.id,
                        problemId: id,
                        ...notificationDetails,
                        metadata: { problemTitle: check.rows[0].title }
                    });
                }
            }

            if (contentFieldsChanged && check.rows[0].author_id !== req.user.id) {
                await createNotification(client, {
                    userId: check.rows[0].author_id,
                    actorId: req.user.id,
                    problemId: id,
                    type: 'problem_edited',
                    title: 'Problem Edited',
                    body: `Your problem '${updatedProblemTitle}' was edited.`,
                    metadata: { problemTitle: updatedProblemTitle }
                });
            }
        }

        await client.query('COMMIT');
        
        // Fetch fresh
        const fresh = await pool.query('SELECT * FROM problems WHERE id = $1', [id]);
        res.json({ success: true, problem: fresh.rows[0] });

    } catch(e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Update failed', details: err.message });
  }
});

app.delete('/api/problems/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'director') {
    return res.sendStatus(403);
  }

  const { id } = req.params;
  const { reason } = req.body || {};
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const exists = await client.query('SELECT id, author_id, title, deleted_at FROM problems WHERE id = $1', [id]);
    if (exists.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Problem not found' });
    }

    const { author_id: authorId, title: problemTitle, deleted_at: deletedAt } = exists.rows[0];
    if (deletedAt) {
      await client.query('ROLLBACK');
      return res.json({ success: true });
    }

    await client.query('DELETE FROM problem_rounds WHERE problem_id = $1', [id]);
    await client.query(
      `UPDATE problems
       SET deleted_at = CURRENT_TIMESTAMP,
           deleted_by = $1,
           deletion_reason = $2,
           round_id = NULL
       WHERE id = $3`,
      [req.user.id, reason?.trim() || null, id]
    );

    if (authorId && authorId !== req.user.id) {
      await createNotification(client, {
        userId: authorId, actorId: req.user.id, problemId: id,
        type: 'problem_deleted',
        title: 'Problem Deleted',
        body: reason?.trim()
          ? `Your problem '${problemTitle}' was deleted. Reason: ${reason.trim()}`
          : `Your problem '${problemTitle}' was deleted.`,
        metadata: { problemTitle, reason: reason?.trim() || null }
      });
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Delete problem failed' });
  } finally {
    client.release();
  }
});

app.post('/api/problems/:id/restore', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'director') {
    return res.sendStatus(403);
  }

  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const exists = await client.query('SELECT id, author_id, title, deleted_at FROM problems WHERE id = $1', [id]);
    if (exists.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Problem not found' });
    }
    if (!exists.rows[0].deleted_at) {
      await client.query('ROLLBACK');
      return res.json({ success: true });
    }

    await client.query(
      `UPDATE problems
       SET deleted_at = NULL,
           deleted_by = NULL,
           deletion_reason = NULL,
           status = 'approved',
           round_id = NULL
       WHERE id = $1`,
      [id]
    );
    await client.query('DELETE FROM problem_rounds WHERE problem_id = $1', [id]);

    const authorId = exists.rows[0].author_id;
    const problemTitle = exists.rows[0].title;
    if (authorId && authorId !== req.user.id) {
      await createNotification(client, {
        userId: authorId, actorId: req.user.id, problemId: id,
        type: 'problem_restored',
        title: 'Problem Restored',
        body: `Your problem '${problemTitle}' was restored to the pool.`,
        metadata: { problemTitle }
      });
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Restore problem failed' });
  } finally {
    client.release();
  }
});

// New Route: Remove problem from a specific round
app.delete('/api/problems/:id/round/:roundId', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'director') return res.sendStatus(403);
    const { id, roundId } = req.params;

    try {
        // Fetch problem and round info before deletion for notification
        const [probRes, roundRes] = await Promise.all([
            pool.query('SELECT author_id, title FROM problems WHERE id = $1', [id]),
            pool.query('SELECT name FROM rounds WHERE id = $1', [roundId])
        ]);
        const authorId = probRes.rows[0]?.author_id;
        const problemTitle = probRes.rows[0]?.title || 'A problem';
        const roundName = roundRes.rows[0]?.name || 'a round';

        await pool.query('DELETE FROM problem_rounds WHERE problem_id = $1 AND round_id = $2', [id, roundId]);

        // Update legacy column if it matches
        await pool.query('UPDATE problems SET round_id = NULL WHERE id = $1 AND round_id = $2', [id, roundId]);

        // Status update logic: If no rounds left, set to 'approved' (pool)
        const check = await pool.query('SELECT count(*) FROM problem_rounds WHERE problem_id = $1', [id]);
        if (parseInt(check.rows[0].count) === 0) {
            await pool.query("UPDATE problems SET status = 'approved' WHERE id = $1", [id]);
        }

        if (authorId && authorId !== req.user.id) {
            await createRoundMembershipNotification(pool, {
                userId: authorId, actorId: req.user.id, problemId: id,
                type: 'problem_removed_from_round',
                title: 'Removed from Round',
                body: `'${problemTitle}' was removed from ${roundName}.`,
                metadata: { roundId, roundName, problemTitle }
            });
        }

        res.json({ success: true });
    } catch(e) {
        console.error(e);
        res.status(500).json({ error: 'Remove from round failed' });
    }
});


// New Route: Bulk Import Parsing
app.post('/api/problems/bulk-parse', authenticateToken, async (req, res) => {
    try {
        const { text, defaultTopics, defaultDifficulty } = req.body;
        if (!text) return res.status(400).json({ error: "No text provided" });

        const problems = [];
        const safeDefaultDifficulty = normalizeDifficulty(defaultDifficulty ?? 3);
        let currentProblem = null;
        
        // Strategy 1: Look for explicit blocks
        const blockRegex = /\\begin\{problem\}([\s\S]*?)\\end\{problem\}/g;
        let match;
        
        // Helper to extract metadata
        const extractMetadata = (content) => {
            let cleanContent = content;
            let solution = "";
            let answer = "";
            
            const solMatch = content.match(/\\begin\{solution\}([\s\S]*?)\\end\{solution\}/);
            if (solMatch) {
                solution = solMatch[1].trim();
                cleanContent = cleanContent.replace(solMatch[0], '');
            }
            
            const ansMatch = content.match(/\\answer\{(.*?)\}/);
            if (ansMatch) {
                answer = ansMatch[1].trim();
                cleanContent = cleanContent.replace(ansMatch[0], '');
            }
            
            return { statement: cleanContent.trim(), solution, answer };
        };

        while ((match = blockRegex.exec(text)) !== null) {
            const raw = match[1];
            const { statement, solution, answer } = extractMetadata(raw);
            
            problems.push({
                title: `Imported Problem ${problems.length + 1}`,
                statement: statement,
                solution: solution,
                answerKey: answer,
                topics: defaultTopics || [],
                difficulty: safeDefaultDifficulty
            });
        }

        // Strategy 2: If no blocks, look for \item
        if (problems.length === 0) {
            const items = text.split(/\\item\s/);
            if (items.length > 1) {
                items.shift(); // remove preamble
                items.forEach((item, idx) => {
                    const { statement, solution, answer } = extractMetadata(item);
                    if (statement.length > 5) {
                         problems.push({
                            title: `Imported Problem ${idx + 1}`,
                            statement: statement,
                            solution: solution,
                            answerKey: answer,
                            topics: defaultTopics || [],
                            difficulty: safeDefaultDifficulty
                        });
                    }
                });
            }
        }

        res.json({ problems });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Parsing failed" });
    }
});

// New Route: Update Status (Admin Only)
app.patch('/api/problems/:id/status', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'director') return res.sendStatus(403);

  const { id } = req.params;
  const { status } = req.body;

  if (!['pending', 'approved', 'accepted'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const oldRes = await pool.query('SELECT author_id, title, status as old_status FROM problems WHERE id = $1', [id]);
    const oldProblem = oldRes.rows[0];

    await pool.query('UPDATE problems SET status = $1 WHERE id = $2', [status, id]);

    if (oldProblem && oldProblem.author_id !== req.user.id) {
      const authorId = oldProblem.author_id;
      const problemTitle = oldProblem.title;
      if (status === 'approved' && oldProblem.old_status !== 'approved') {
        await createNotification(pool, {
          userId: authorId, actorId: req.user.id, problemId: id,
          type: 'problem_approved',
          title: 'Problem Approved',
          body: `Your problem '${problemTitle}' was approved.`,
          metadata: {}
        });
      } else if (status === 'pending' && oldProblem.old_status !== 'pending') {
        await createNotification(pool, {
          userId: authorId, actorId: req.user.id, problemId: id,
          type: 'problem_returned_to_waitlist',
          title: 'Returned to Waitlist',
          body: `'${problemTitle}' was returned to the waitlist.`,
          metadata: {}
        });
      }
    }

    res.json({ success: true, status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Status update failed' });
  }
});

// New Route: Reorder Round (Admin Only) - Sets status to 'accepted' and updates order_index
app.post('/api/rounds/reorder', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'director') return res.sendStatus(403);
  
  const { problems, roundId, slotIndexes } = req.body; // Array of problem IDs in desired order, and the Round ID
  
  const client = await pool.connect();
  try {
      await client.query('BEGIN');
      
      // For each problem ID in the list, update its order_index in the join table
      // If roundId is provided, update problem_rounds. 
      // Fallback to updating problems table if only legacy mode, but we should enforce roundId
      
      if (roundId) {
          for (let i = 0; i < problems.length; i++) {
              const orderIndex = Array.isArray(slotIndexes) && Number.isInteger(slotIndexes[i]) ? slotIndexes[i] : i;
              await client.query(
                  'UPDATE problem_rounds SET order_index = $1 WHERE problem_id = $2 AND round_id = $3',
                  [orderIndex, problems[i], roundId]
              );
              // Also update main table order_index if this is the "primary" round (legacy compat)
              // Just simpler to update it always, though it might get overwritten by other round reorders.
              await client.query(
                  'UPDATE problems SET order_index = $1 WHERE id = $2',
                   [orderIndex, problems[i]]
              );
          }
      } else {
          // Legacy behavior
           for (let i = 0; i < problems.length; i++) {
              await client.query('UPDATE problems SET order_index = $1 WHERE id = $2', [i, problems[i]]);
          }
      }
      
      await client.query('COMMIT');
      res.json({ success: true });
  } catch (e) {
      await client.query('ROLLBACK');
      console.error(e);
      res.status(500).json({ error: 'Reorder failed' });
  } finally {
      client.release();
  }
});

app.post('/api/problems/:id/vote', authenticateToken, async (req, res) => {
  if (req.user.role === 'guest') return res.sendStatus(403);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const userId = req.user.id;
    const problemRes = await client.query('SELECT author_id, deleted_at FROM problems WHERE id = $1', [id]);
    if (problemRes.rows.length === 0 || problemRes.rows[0].deleted_at) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Problem not found' });
    }
    if (problemRes.rows[0].author_id === userId) {
      await client.query(
        `UPDATE votes
         SET invalid_reason = 'self_vote',
             invalidated_at = COALESCE(invalidated_at, CURRENT_TIMESTAMP)
         WHERE user_id = $1 AND problem_id = $2 AND invalid_reason IS NULL`,
        [userId, id]
      );
      await client.query(
        `UPDATE problems p
         SET score = COALESCE((
           SELECT SUM(v.vote_value)
           FROM votes v
           WHERE v.problem_id = p.id
             AND v.invalid_reason IS NULL
             AND v.user_id IS DISTINCT FROM p.author_id
         ), 0)
         WHERE p.id = $1`,
        [id]
      );
      await client.query('COMMIT');
      return res.status(400).json({ error: 'You cannot vote for your own problem.' });
    }

    const userRes = await client.query('SELECT voting_power FROM users WHERE id = $1', [userId]);
    const currentPower = userRes.rows.length > 0 ? (userRes.rows[0].voting_power || 1) : 1;

    const check = await client.query('SELECT vote_value FROM votes WHERE user_id = $1 AND problem_id = $2 AND invalid_reason IS NULL', [userId, id]);
    
    if (check.rows.length > 0) {
      await client.query('DELETE FROM votes WHERE user_id = $1 AND problem_id = $2', [userId, id]);
    } else {
      await client.query(`
        INSERT INTO votes (user_id, problem_id, vote_value, invalid_reason, invalidated_at)
        VALUES ($1, $2, $3, NULL, NULL)
        ON CONFLICT (user_id, problem_id)
        DO UPDATE SET vote_value = EXCLUDED.vote_value,
                      invalid_reason = NULL,
                      invalidated_at = NULL
      `, [userId, id, currentPower]);
    }

    await client.query(
      `UPDATE problems p
       SET score = COALESCE((
         SELECT SUM(v.vote_value)
         FROM votes v
         WHERE v.problem_id = p.id
           AND v.invalid_reason IS NULL
           AND v.user_id IS DISTINCT FROM p.author_id
       ), 0)
       WHERE p.id = $1`,
      [id]
    );

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Voting failed' });
  } finally {
    client.release();
  }
});

// --- Comments Routes ---

app.get('/api/problems/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT c.id, c.text, c.created_at, u.id as user_id, u.name as user_name, u.avatar_url as user_avatar_url
       FROM comments c 
       JOIN users u ON c.user_id = u.id 
       WHERE c.problem_id = $1 
       ORDER BY c.created_at ASC`,
      [id]
    );
    const comments = result.rows.map(r => ({
      id: r.id,
      text: r.text,
      createdAt: new Date(r.created_at).getTime(),
      userId: r.user_id,
      userName: r.user_name,
      userAvatarUrl: r.user_avatar_url || null
    }));
    res.json(comments);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

app.post('/api/problems/:id/comments', authenticateToken, async (req, res) => {
  if (req.user.role === 'guest') return res.sendStatus(403);
  try {
    const { id } = req.params;
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({error: "Empty comment"});

    // Fetch problem author and title; fetch commenter name
    const [probRes, commenterRes] = await Promise.all([
      pool.query('SELECT author_id, title FROM problems WHERE id = $1', [id]),
      pool.query('SELECT name, avatar_url FROM users WHERE id = $1', [req.user.id])
    ]);

    const result = await pool.query(
      'INSERT INTO comments (problem_id, user_id, text) VALUES ($1, $2, $3) RETURNING id, created_at',
      [id, req.user.id, text]
    );

    const commenterName = commenterRes.rows[0]?.name || 'Someone';
    const commenterAvatarUrl = commenterRes.rows[0]?.avatar_url || null;
    const authorId = probRes.rows[0]?.author_id;
    const problemTitle = probRes.rows[0]?.title || 'a problem';

    // Don't notify the author about their own comment
    if (authorId && authorId !== req.user.id) {
      await createNotification(pool, {
        userId: authorId, actorId: req.user.id, problemId: id,
        type: 'problem_commented',
        title: 'New Comment',
        body: `${commenterName} commented on '${problemTitle}'.`,
        metadata: { commentId: result.rows[0].id, commenterName }
      });
    }

    res.json({
      id: result.rows[0].id,
      userId: req.user.id,
      userName: commenterName,
      userAvatarUrl: commenterAvatarUrl,
      text,
      createdAt: new Date(result.rows[0].created_at).getTime()
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to post comment" });
  }
});

// --- Admin: Reset All Votes ---
app.post('/api/admin/reset-votes', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  
  const client = await pool.connect();
  try {
      await client.query('BEGIN');
      await client.query('TRUNCATE TABLE votes');
      await client.query('TRUNCATE TABLE comparison_vote_items, comparison_votes');
      await client.query('UPDATE problems SET score = 0');
      await client.query('UPDATE problems SET comparison_appearances = 0, comparison_wins = 0, comparison_losses = 0');
      await client.query('COMMIT');
      res.json({ success: true });
  } catch (e) {
      await client.query('ROLLBACK');
      console.error(e);
      res.status(500).json({ error: 'Reset failed' });
  } finally {
      client.release();
  }
});

// --- Routes: Guided Comparison Voting ---

app.get('/api/voting/quotas', authenticateToken, async (req, res) => {
  if (req.user.role === 'guest') return res.sendStatus(403);
  const client = await pool.connect();
  try {
    const isAdmin = req.user.role === 'admin' || req.user.role === 'director';
    const result = isAdmin
      ? await client.query(`
          SELECT q.*,
          array_agg(qa.user_id) FILTER (WHERE qa.user_id IS NOT NULL) as assigned_user_ids
          FROM quotas q
          LEFT JOIN quota_assignments qa ON qa.quota_id = q.id
          WHERE q.is_enabled = TRUE AND q.quota_type = 'formal'
          GROUP BY q.id
          ORDER BY q.quota_type ASC, q.created_at DESC
        `)
      : await client.query(`
          SELECT DISTINCT q.*,
            NULL::uuid[] as assigned_user_ids
          FROM quotas q
          WHERE q.is_enabled = TRUE AND q.voting_enabled IS DISTINCT FROM FALSE AND q.quota_type = 'formal' AND (
            q.assignment_mode = 'global'
            OR (q.assignment_mode = 'selected'
                AND EXISTS (
                  SELECT 1 FROM quota_assignments qa
                  WHERE qa.quota_id = q.id AND qa.user_id = $1
                ))
          )
          ORDER BY q.quota_type ASC, q.created_at DESC
        `, [req.user.id]);

    const progress = [];
    for (const quota of result.rows) {
      progress.push(await getVotingProgress(client, quota, req.user.id));
    }
    res.json(progress);
  } catch (err) {
    console.error('Failed to fetch voting quotas:', err);
    res.status(500).json({ error: 'Failed to fetch voting quotas' });
  } finally {
    client.release();
  }
});

app.get('/api/voting/next', authenticateToken, async (req, res) => {
  if (req.user.role === 'guest') return res.sendStatus(403);
  const { quotaId, bucket = 'auto' } = req.query;
  if (!quotaId) return res.status(400).json({ error: 'quotaId is required' });

  const client = await pool.connect();
  try {
    const quotaRow = await getEligibleQuota(client, quotaId, req.user);
    if (!quotaRow) return res.status(404).json({ error: 'Quota not found or unavailable.' });
    const progress = await getVotingProgress(client, quotaRow, req.user.id);
    const selectedBucket = chooseNextBucket(progress, bucket);
    const required = selectedBucket === 'quota_pool'
      ? progress.quotaPool.required
      : progress.globalPool.required;
    const minEligible = selectedBucket === 'quota_pool'
      ? progress.quota.minVotingPoolSize
      : 3;
    const eligibleCount = await getEligibleProblemCount(client, quotaId, req.user.id, selectedBucket);

    if (!progress.quota.votingEnabled) {
      return res.json({
        status: 'blocked',
        quotaId,
        bucket: selectedBucket,
        nextBucket: selectedBucket,
        problems: [],
        progress,
        eligibleCount,
        minEligible,
        message: 'Voting is currently disabled for this quota.'
      });
    }
    if (required === 0 && !progress.isComplete) {
      return res.json({
        status: 'complete',
        quotaId,
        bucket: selectedBucket,
        nextBucket: selectedBucket,
        problems: [],
        progress,
        eligibleCount,
        minEligible,
        message: 'This voting bucket has no required votes.'
      });
    }
    if (eligibleCount < minEligible) {
      const label = selectedBucket === 'quota_pool' ? 'Quota pool' : 'Global pool';
      return res.json({
        status: 'blocked',
        quotaId,
        bucket: selectedBucket,
        nextBucket: selectedBucket,
        problems: [],
        progress,
        eligibleCount,
        minEligible,
        message: `${label} voting opens once there are at least ${minEligible} eligible problems. Current eligible pool: ${eligibleCount} / ${minEligible}.`
      });
    }

    const candidates = await getCandidateProblems(client, quotaId, req.user.id, selectedBucket);
    if (candidates.length < 3) {
      return res.json({
        status: 'blocked',
        quotaId,
        bucket: selectedBucket,
        nextBucket: selectedBucket,
        problems: [],
        progress,
        eligibleCount: candidates.length,
        minEligible: 3,
        message: 'Not enough eligible problems to show a comparison.'
      });
    }

    const seenKeys = await recentShownKeys(client, quotaId, req.user.id, selectedBucket);
    const triple = pickTriple(candidates, seenKeys);
    res.json({
      status: 'ready',
      quotaId,
      bucket: selectedBucket,
      nextBucket: selectedBucket,
      problems: triple.map(row => mapProblemRow(row, { hideAuthor: true })),
      progress,
      eligibleCount,
      minEligible
    });
  } catch (err) {
    console.error('Failed to fetch voting set:', err);
    res.status(500).json({ error: 'Failed to fetch voting set' });
  } finally {
    client.release();
  }
});

app.post('/api/voting/submit', authenticateToken, async (req, res) => {
  if (req.user.role === 'guest') return res.sendStatus(403);
  const { quotaId, bucket, shownProblemIds, selectedProblemId, responseTimeMs, detailsOpened } = req.body;
  if (!quotaId) return res.status(400).json({ error: 'quotaId is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const quotaRow = await getEligibleQuota(client, quotaId, req.user);
    if (!quotaRow) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Quota not found or unavailable.' });
    }
    const validation = await validateVotingProblemSet(client, {
      quotaId,
      userId: req.user.id,
      bucket,
      shownProblemIds,
      selectedProblemId,
      requireSelected: true
    });
    if (!validation.ok) {
      await client.query('ROLLBACK');
      return res.status(validation.status).json({ error: validation.error });
    }
    const duplicate = await client.query(
      `SELECT id FROM comparison_votes
       WHERE voter_id = $1
         AND quota_id = $2
         AND vote_bucket = $3
         AND shown_key = $4
         AND is_skipped = FALSE
       LIMIT 1`,
      [req.user.id, quotaId, bucket, validation.shownKey]
    );
    if (duplicate.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This exact comparison set has already been submitted.' });
    }

    const progressBefore = await getVotingProgress(client, quotaRow, req.user.id);
    const required = bucket === 'quota_pool' ? progressBefore.quotaPool.required : progressBefore.globalPool.required;
    const rawCompleted = bucket === 'quota_pool' ? progressBefore.quotaPool.rawCompleted : progressBefore.globalPool.rawCompleted;
    const optional = rawCompleted >= required;
    const responseMs = getInt(responseTimeMs, 0);
    const lowConfidence = responseMs > 0 && responseMs < 3000;

    const vote = await client.query(
      `INSERT INTO comparison_votes (
        voter_id, quota_id, vote_bucket, shown_problem_ids, shown_key, selected_problem_id,
        response_time_ms, details_opened, low_confidence, is_optional
       )
       VALUES ($1, $2, $3, $4::uuid[], $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        req.user.id,
        quotaId,
        bucket,
        validation.ids,
        validation.shownKey,
        selectedProblemId,
        responseMs || null,
        !!detailsOpened,
        lowConfidence,
        optional
      ]
    );

    for (const problemId of validation.ids) {
      const selected = problemId === selectedProblemId;
      await client.query(
        `INSERT INTO comparison_vote_items (vote_id, problem_id, was_selected, wins_awarded, losses_awarded)
         VALUES ($1, $2, $3, $4, $5)`,
        [vote.rows[0].id, problemId, selected, selected ? 2 : 0, selected ? 0 : 1]
      );
      await client.query(
        `UPDATE problems
         SET comparison_appearances = comparison_appearances + 1,
             comparison_wins = comparison_wins + $1,
             comparison_losses = comparison_losses + $2
         WHERE id = $3`,
        [selected ? 2 : 0, selected ? 0 : 1, problemId]
      );
    }

    const progress = await getVotingProgress(client, quotaRow, req.user.id);
    await client.query('COMMIT');
    res.json({ success: true, progress, optional, lowConfidence });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to submit comparison vote:', err);
    res.status(500).json({ error: 'Failed to submit comparison vote' });
  } finally {
    client.release();
  }
});

app.post('/api/voting/skip', authenticateToken, async (req, res) => {
  if (req.user.role === 'guest') return res.sendStatus(403);
  const { quotaId, bucket, shownProblemIds, reason, responseTimeMs, detailsOpened } = req.body;
  if (!quotaId) return res.status(400).json({ error: 'quotaId is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const quotaRow = await getEligibleQuota(client, quotaId, req.user);
    if (!quotaRow) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Quota not found or unavailable.' });
    }
    const validation = await validateVotingProblemSet(client, {
      quotaId,
      userId: req.user.id,
      bucket,
      shownProblemIds,
      selectedProblemId: null,
      requireSelected: false
    });
    if (!validation.ok) {
      await client.query('ROLLBACK');
      return res.status(validation.status).json({ error: validation.error });
    }
    await client.query(
      `INSERT INTO comparison_votes (
        voter_id, quota_id, vote_bucket, shown_problem_ids, shown_key,
        response_time_ms, details_opened, is_skipped, skip_reason
       )
       VALUES ($1, $2, $3, $4::uuid[], $5, $6, $7, TRUE, $8)`,
      [
        req.user.id,
        quotaId,
        bucket,
        validation.ids,
        validation.shownKey,
        getInt(responseTimeMs, 0) || null,
        !!detailsOpened,
        reason || null
      ]
    );
    const progress = await getVotingProgress(client, quotaRow, req.user.id);
    await client.query('COMMIT');
    res.json({ success: true, progress });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to skip comparison set:', err);
    res.status(500).json({ error: 'Failed to skip comparison set' });
  } finally {
    client.release();
  }
});

// --- Routes: Quotas ---

app.get('/api/quotas', authenticateToken, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin' || req.user.role === 'director';
    let result;

    if (isAdmin) {
      // Admins see all enabled quotas plus each quota's assigned user IDs
      result = await pool.query(`
        SELECT q.*,
          array_agg(qa.user_id) FILTER (WHERE qa.user_id IS NOT NULL) as assigned_user_ids
        FROM quotas q
        LEFT JOIN quota_assignments qa ON qa.quota_id = q.id
        WHERE q.is_enabled = TRUE
        GROUP BY q.id
        ORDER BY q.quota_type ASC, q.created_at DESC
      `);
    } else {
      // Writers only see quotas they are eligible for:
      //   - all enabled general quotas
      //   - all enabled global formal quotas
      //   - enabled selected-mode quotas where they have an assignment row
      result = await pool.query(`
        SELECT DISTINCT q.*,
          NULL::uuid[] as assigned_user_ids
        FROM quotas q
        WHERE q.is_enabled = TRUE AND (
          q.quota_type = 'general'
          OR (q.quota_type = 'formal' AND q.assignment_mode = 'global')
          OR (q.quota_type = 'formal' AND q.assignment_mode = 'selected'
              AND EXISTS (
                SELECT 1 FROM quota_assignments qa
                WHERE qa.quota_id = q.id AND qa.user_id = $1
              ))
        )
        ORDER BY q.quota_type ASC, q.created_at DESC
      `, [req.user.id]);
    }

    const quotas = result.rows.map(mapQuotaRow);
    res.json(quotas);
  } catch (err) {
    console.error('Failed to fetch quotas:', err);
    res.status(500).json({ error: 'Failed to fetch quotas' });
  }
});

app.post('/api/quotas', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'director') return res.sendStatus(403);

  const {
    name,
    target,
    voteTarget,
    quotaPoolVoteTarget,
    globalPoolVoteTarget,
    minVotingPoolSize,
    votingEnabled,
    instructions,
    dueDate,
    quotaType,
    assignmentMode,
    isEnabled,
    assignedUserIds
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const dateVal = dueDate ? new Date(dueDate).toISOString() : null;
    const qt = quotaType || 'formal';
    const am = assignmentMode || 'global';
    const enabled = isEnabled !== false;
    const quotaVotes = qt === 'general' ? 0 : getInt(quotaPoolVoteTarget ?? voteTarget, 16);
    const globalVotes = qt === 'general' ? 0 : getInt(globalPoolVoteTarget, 4);
    const vt = quotaVotes + globalVotes;
    const minPool = Math.max(3, getInt(minVotingPoolSize, 15));
    const votingOn = votingEnabled !== false;
    const tgt = (qt === 'general') ? 0 : (target || 5);

    const result = await client.query(
      `INSERT INTO quotas (
        name, target_count, vote_target, quota_pool_vote_target, global_pool_vote_target,
        min_voting_pool_size, voting_enabled, instructions, due_date, quota_type, assignment_mode, is_enabled
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [name, tgt, vt, quotaVotes, globalVotes, minPool, votingOn, instructions, dateVal, qt, am, enabled]
    );
    const row = result.rows[0];

    // Insert per-user assignments for 'selected' mode
    const ids = Array.isArray(assignedUserIds) ? assignedUserIds : [];
    if (am === 'selected' && ids.length > 0) {
      for (const uid of ids) {
        await client.query(
          'INSERT INTO quota_assignments (quota_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [row.id, uid]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ ...mapQuotaRow(row), assignedUserIds: ids });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Creation failed' });
  } finally {
    client.release();
  }
});

app.put('/api/quotas/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'director') return res.sendStatus(403);
  const { id } = req.params;
  const {
    name,
    target,
    voteTarget,
    quotaPoolVoteTarget,
    globalPoolVoteTarget,
    minVotingPoolSize,
    votingEnabled,
    instructions,
    dueDate,
    quotaType,
    assignmentMode,
    isEnabled,
    assignedUserIds
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const dateVal = dueDate ? new Date(dueDate).toISOString() : null;
    const qt = quotaType || 'formal';
    const am = assignmentMode || 'global';
    const enabled = isEnabled !== false;
    const quotaVotes = qt === 'general' ? 0 : getInt(quotaPoolVoteTarget ?? voteTarget, 3);
    const globalVotes = qt === 'general' ? 0 : getInt(globalPoolVoteTarget, 0);
    const vt = quotaVotes + globalVotes;
    const minPool = Math.max(3, getInt(minVotingPoolSize, 15));
    const votingOn = votingEnabled !== false;
    const tgt = (qt === 'general') ? 0 : (target || 5);

    const result = await client.query(
      `UPDATE quotas
       SET name = $1,
           target_count = $2,
           vote_target = $3,
           quota_pool_vote_target = $4,
           global_pool_vote_target = $5,
           min_voting_pool_size = $6,
           voting_enabled = $7,
           instructions = $8,
           due_date = $9,
           quota_type = $10,
           assignment_mode = $11,
           is_enabled = $12
       WHERE id = $13 RETURNING *`,
      [name, tgt, vt, quotaVotes, globalVotes, minPool, votingOn, instructions, dateVal, qt, am, enabled, id]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Quota not found' });
    }
    const row = result.rows[0];

    // Replace assignments for 'selected' mode
    await client.query('DELETE FROM quota_assignments WHERE quota_id = $1', [id]);
    const ids = Array.isArray(assignedUserIds) ? assignedUserIds : [];
    if (am === 'selected' && ids.length > 0) {
      for (const uid of ids) {
        await client.query(
          'INSERT INTO quota_assignments (quota_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, uid]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ ...mapQuotaRow(row), assignedUserIds: ids });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Update failed' });
  } finally {
    client.release();
  }
});

// --- Routes: Rounds ---

app.get('/api/rounds', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT r.*, (SELECT COUNT(*)::int FROM problem_rounds WHERE round_id = r.id) as problem_count 
            FROM rounds r 
            ORDER BY r.created_at DESC
        `);
        res.json(result.rows.map(r => ({
            id: r.id,
            name: r.name,
            tag: r.tag,
            description: r.description,
            createdAt: new Date(r.created_at).getTime(),
            problemCount: parseInt(r.problem_count || '0'),
            targetSize: parseInt(r.target_size || '10')
        })));
    } catch (e) {
        console.error(e);
        res.status(500).json({error: "Fetch rounds failed"});
    }
});

app.post('/api/rounds', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'director') return res.sendStatus(403);
    const { name, description, tag, targetSize } = req.body;
    try {
        const safeTargetSize = Math.max(1, Math.min(50, parseInt(targetSize || 10)));
        const result = await pool.query('INSERT INTO rounds (name, description, tag, target_size) VALUES ($1, $2, $3, $4) RETURNING *', [name, description, tag, safeTargetSize]);
        const r = result.rows[0];
        res.json({
            id: r.id,
            name: r.name,
            tag: r.tag,
            description: r.description,
            createdAt: new Date(r.created_at).getTime(),
            problemCount: 0,
            targetSize: parseInt(r.target_size || '10')
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({error: "Create round failed"});
    }
});

// Update Round
app.put('/api/rounds/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'director') return res.sendStatus(403);
    const { id } = req.params;
    const { name, description, tag, targetSize } = req.body;
    try {
        const safeTargetSize = Math.max(1, Math.min(50, parseInt(targetSize || 10)));
        const result = await pool.query(
            'UPDATE rounds SET name = $1, description = $2, tag = $3, target_size = $4 WHERE id = $5 RETURNING *',
            [name, description, tag, safeTargetSize, id]
        );
        if (result.rows.length === 0) return res.status(404).json({error: "Round not found"});
        const r = result.rows[0];
        // We need to fetch count again or just return previous
        res.json({
            id: r.id,
            name: r.name,
            tag: r.tag,
            description: r.description,
            createdAt: new Date(r.created_at).getTime(),
            targetSize: parseInt(r.target_size || '10'),
            // problemCount is missing here but usually update doesn't need it immediately or can refetch
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({error: "Update round failed"});
    }
});

// Delete Round
app.delete('/api/rounds/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'director') return res.sendStatus(403);
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Unassign problems first from main table (legacy)
        await client.query('UPDATE problems SET round_id = NULL, status = \'approved\' WHERE round_id = $1', [id]);
        
        // Delete from join table
        await client.query('DELETE FROM problem_rounds WHERE round_id = $1', [id]);
        
        // Delete round
        await client.query('DELETE FROM rounds WHERE id = $1', [id]);
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error(e);
        res.status(500).json({error: "Delete round failed"});
    } finally {
        client.release();
    }
});

// --- Routes: Notifications ---

app.get('/api/notifications', authenticateToken, async (req, res) => {
  if (req.user.role === 'guest') return res.json([]);
  try {
    const result = await pool.query(`
      SELECT n.id, n.user_id, n.actor_id, n.problem_id, n.type, n.title, n.body, n.metadata, n.read_at, n.created_at,
             actor.name as actor_name, actor.avatar_url as actor_avatar_url
      FROM notifications n
      LEFT JOIN users actor ON n.actor_id = actor.id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
      LIMIT 50
    `, [req.user.id]);
    res.json(result.rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      actorId: r.actor_id,
      actorName: r.actor_name || null,
      actorAvatarUrl: r.actor_avatar_url || null,
      problemId: r.problem_id,
      type: r.type,
      title: r.title,
      body: r.body,
      metadata: r.metadata || {},
      readAt: r.read_at ? new Date(r.read_at).getTime() : null,
      createdAt: new Date(r.created_at).getTime()
    })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

app.post('/api/notifications/read-all', authenticateToken, async (req, res) => {
  if (req.user.role === 'guest') return res.json({ success: true });
  try {
    await pool.query(
      `UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`,
      [req.user.id]
    );
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to mark all read' });
  }
});

app.patch('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2 AND read_at IS NULL`,
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to mark read' });
  }
});

// All other GET requests not handled before will return the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Initialize DB then Start Server
initDB().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
});
