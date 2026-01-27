
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
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT users_role_check CHECK (role IN ('admin', 'director', 'writer', 'guest'))
      );
      
      CREATE TABLE IF NOT EXISTS quotas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        target_count INTEGER NOT NULL DEFAULT 5,
        vote_target INTEGER DEFAULT 3,
        instructions TEXT,
        due_date TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS rounds (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        folder TEXT DEFAULT 'Default',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS problems (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        author_id UUID REFERENCES users(id),
        quota_id UUID REFERENCES quotas(id),
        round_id UUID REFERENCES rounds(id),
        title TEXT NOT NULL,
        statement TEXT NOT NULL,
        solution TEXT,
        answer_key TEXT,
        image_data TEXT,
        difficulty NUMERIC(3,1) DEFAULT 0,
        topics TEXT[] DEFAULT '{}',
        score INTEGER DEFAULT 0,
        status TEXT DEFAULT 'waitlist', -- Default changed to waitlist
        order_index INTEGER DEFAULT 0,
        version INTEGER DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS round_problems (
        round_id UUID REFERENCES rounds(id) ON DELETE CASCADE,
        problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
        order_index INTEGER DEFAULT 0,
        PRIMARY KEY (round_id, problem_id)
      );

      CREATE TABLE IF NOT EXISTS votes (
        user_id UUID REFERENCES users(id),
        problem_id UUID REFERENCES problems(id),
        vote_value INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, problem_id)
      );

      CREATE TABLE IF NOT EXISTS comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        problem_id UUID REFERENCES problems(id),
        user_id UUID REFERENCES users(id),
        text TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // --- MIGRATION: Ensure new columns exist for old databases ---
    await client.query(`
      ALTER TABLE problems ADD COLUMN IF NOT EXISTS difficulty NUMERIC(3,1) DEFAULT 0;
      ALTER TABLE problems ADD COLUMN IF NOT EXISTS topics TEXT[] DEFAULT '{}';
      ALTER TABLE problems ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'waitlist';
      ALTER TABLE problems ADD COLUMN IF NOT EXISTS image_data TEXT;
      ALTER TABLE problems ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;
      ALTER TABLE problems ADD COLUMN IF NOT EXISTS solution TEXT;
      ALTER TABLE problems ADD COLUMN IF NOT EXISTS answer_key TEXT;
      ALTER TABLE problems ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
      ALTER TABLE problems ADD COLUMN IF NOT EXISTS round_id UUID REFERENCES rounds(id);
      
      ALTER TABLE rounds ADD COLUMN IF NOT EXISTS folder TEXT DEFAULT 'Default';
      ALTER TABLE quotas ADD COLUMN IF NOT EXISTS vote_target INTEGER DEFAULT 3;
    `);

    // --- MIGRATION: Migrate Legacy Single-Round Problems to Join Table ---
    // If problems have round_id set but no entry in round_problems, insert them
    await client.query(`
      INSERT INTO round_problems (round_id, problem_id, order_index)
      SELECT round_id, id, order_index FROM problems
      WHERE round_id IS NOT NULL
      ON CONFLICT (round_id, problem_id) DO NOTHING
    `);

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

    // Seed Initial Quota if not exists
    const quotaCheck = await client.query("SELECT * FROM quotas");
    if (quotaCheck.rows.length === 0) {
       await client.query(
         "INSERT INTO quotas (name, target_count, vote_target, instructions, is_active) VALUES ($1, $2, $3, $4, $5)",
         ['General Submission', 5, 3, 'Standard middle school math contest problems.', true]
       );
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
        customTargets: user.custom_targets || {}
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
       customTargets: user.custom_targets || {}
    }});
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Login failed" });
  }
});

app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Ensure role is valid
    const safeRole = ['admin', 'director', 'writer'].includes(role) ? role : 'writer';

    // Return all fields needed for the frontend User interface
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, role, voting_power, custom_targets',
      [name, email, hashedPassword, safeRole]
    );
    
    const u = result.rows[0];
    res.json({
        id: u.id,
        name: u.name,
        role: u.role,
        votingPower: u.voting_power,
        customTargets: u.custom_targets || {}
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
        customTargets: user.custom_targets || {}
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
    const result = await pool.query("SELECT id, name, role, voting_power, custom_targets FROM users WHERE role != 'guest' ORDER BY name");
    const users = result.rows.map(u => ({
        id: u.id,
        name: u.name,
        role: u.role,
        votingPower: u.voting_power,
        customTargets: u.custom_targets || {},
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
  const { name, password, votingPower, customTargets, role } = req.body;
  
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
        // Also clean up round_problems for this user's problems
        await client.query('DELETE FROM round_problems WHERE problem_id IN (SELECT id FROM problems WHERE author_id = $1)', [userId]);
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
      (SELECT array_agg(user_id) FROM votes WHERE problem_id = p.id) as voted_by,
      (SELECT COUNT(*) FROM comments WHERE problem_id = p.id) as comment_count,
      (
         SELECT json_agg(json_build_object('roundId', rp.round_id, 'orderIndex', rp.order_index)) 
         FROM round_problems rp 
         WHERE rp.problem_id = p.id
      ) as assigned_rounds
      FROM problems p
      LEFT JOIN users u ON p.author_id = u.id
      ORDER BY p.score DESC
    `);
    
    const problems = result.rows.map(row => ({
      ...row,
      authorName: row.author_name || 'Unknown',
      authorId: row.author_id,
      quotaId: row.quota_id, 
      roundId: row.round_id, // Deprecated in favor of assignedRounds, kept for compat
      assignedRounds: row.assigned_rounds || [], // New M:N field
      difficulty: row.difficulty ? parseFloat(row.difficulty) : 0,
      topics: row.topics || [],
      status: row.status || 'waitlist',
      orderIndex: row.order_index || 0,
      createdAt: new Date(row.created_at).getTime(),
      votedBy: row.voted_by || [],
      imageData: row.image_data,
      solution: row.solution,
      answerKey: row.answer_key,
      version: row.version,
      commentCount: parseInt(row.comment_count || '0')
    }));

    res.json(problems);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch problems' });
  }
});

app.post('/api/problems', authenticateToken, async (req, res) => {
  try {
    const { title, statement, quotaId, difficulty, topics, imageData, solution, answerKey } = req.body;
    
    const diffVal = (difficulty && !isNaN(difficulty)) ? difficulty : 0;
    
    // Default status is now 'waitlist'
    const result = await pool.query(
      'INSERT INTO problems (author_id, quota_id, title, statement, difficulty, topics, status, image_data, solution, answer_key, version) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1) RETURNING *',
      [req.user.id, quotaId, title, statement, diffVal, topics || [], 'waitlist', imageData, solution, answerKey]
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
    const check = await pool.query('SELECT author_id FROM problems WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Problem not found' });
    
    const authorId = check.rows[0].author_id;
    if (authorId !== userId && userRole !== 'admin' && userRole !== 'director') {
      return res.status(403).json({ error: 'Not authorized to edit this problem' });
    }

    // 2. Dynamic Update Query Construction
    const setClauses = [];
    const values = [];
    let idx = 1;

    // Whitelist allowed fields to prevent arbitrary column injection
    const allowedFields = ['title', 'statement', 'solution', 'answerKey', 'difficulty', 'topics', 'imageData', 'roundId', 'status', 'version'];
    
    const dbMapping = {
        title: 'title',
        statement: 'statement',
        solution: 'solution',
        answerKey: 'answer_key',
        difficulty: 'difficulty',
        topics: 'topics',
        imageData: 'image_data',
        roundId: 'round_id', // Legacy/Single update compat
        status: 'status'
    };

    // Build SET clauses
    for (const key of Object.keys(updates)) {
        if (allowedFields.includes(key) && key !== 'version') {
             const dbCol = dbMapping[key];
             if (dbCol) {
                 // For round assignment, we might want to use the new join table logic instead of simple update
                 // But keeping basic update for 'status' or text fields is fine
                 setClauses.push(`${dbCol} = $${idx++}`);
                 values.push(updates[key] === undefined ? null : updates[key]);
             }
        }
    }

    // Special handling for Round Assignment (M:N) if passed
    if (updates.roundId !== undefined) {
         // If roundId is passed, we assume it's an assignment (add to join table) or unassignment
         if (updates.roundId === null) {
             // Removal logic - requires extra context usually, but if client sends roundId: null, 
             // it means remove from "current context". Since we don't know context here easily without more params,
             // we rely on the specific reorder/round endpoints. 
             // However, for compatibility, if roundId is updated on problems table, sync it to round_problems
             // NOTE: We are moving away from problems.round_id, so we mostly ignore this here unless specific legacy needs.
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

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(409).json({ error: 'Conflict: Problem modified or not found.' });
        }
        res.json({ success: true, problem: result.rows[0] });
    } else {
        res.json({ success: true }); // No update needed
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Update failed', details: err.message });
  }
});

// New Route: Update Status (Admin Only)
app.patch('/api/problems/:id/status', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'director') return res.sendStatus(403);
  
  const { id } = req.params;
  const { status } = req.body;

  if (!['waitlist', 'pending', 'accepted'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    await pool.query('UPDATE problems SET status = $1 WHERE id = $2', [status, id]);
    res.json({ success: true, status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Status update failed' });
  }
});

// New Route: Reorder Round (Admin Only) - Uses round_problems table
app.post('/api/rounds/reorder', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'director') return res.sendStatus(403);
  
  const { problems, roundId } = req.body; // problems is array of IDs
  if (!roundId) return res.status(400).json({ error: "Round ID required" });

  const client = await pool.connect();
  try {
      await client.query('BEGIN');
      
      // Update order in round_problems
      for (let i = 0; i < problems.length; i++) {
          // Check if exists, if so update order
          // If problem not in round, insert it (implicit add)
          await client.query(`
            INSERT INTO round_problems (round_id, problem_id, order_index)
            VALUES ($1, $2, $3)
            ON CONFLICT (round_id, problem_id) 
            DO UPDATE SET order_index = $3
          `, [roundId, problems[i], i]);

          // Also set status to accepted if it's there
          await client.query('UPDATE problems SET status = \'accepted\' WHERE id = $1', [problems[i]]);
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

// New Route: Remove from Round
app.post('/api/rounds/remove', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'director') return res.sendStatus(403);
    const { problemId, roundId } = req.body;
    try {
        await pool.query('DELETE FROM round_problems WHERE round_id = $1 AND problem_id = $2', [roundId, problemId]);
        // Note: We don't necessarily change problem status to 'pending' because it might be in another round.
        // We only set to pending if it's not in any other round?
        // For simplicity/safety, we leave status as 'accepted' if it's used elsewhere, or check count.
        const check = await pool.query('SELECT COUNT(*) FROM round_problems WHERE problem_id = $1', [problemId]);
        if (parseInt(check.rows[0].count) === 0) {
            await pool.query('UPDATE problems SET status = \'pending\' WHERE id = $1', [problemId]);
        }
        res.json({ success: true });
    } catch(e) {
        console.error(e);
        res.status(500).json({error: "Remove failed"});
    }
});

app.post('/api/problems/:id/vote', authenticateToken, async (req, res) => {
  if (req.user.role === 'guest') return res.sendStatus(403);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const userId = req.user.id;
    const userRes = await client.query('SELECT voting_power FROM users WHERE id = $1', [userId]);
    const currentPower = userRes.rows.length > 0 ? (userRes.rows[0].voting_power || 1) : 1;

    const check = await client.query('SELECT vote_value FROM votes WHERE user_id = $1 AND problem_id = $2', [userId, id]);
    
    if (check.rows.length > 0) {
      const previousValue = check.rows[0].vote_value;
      await client.query('DELETE FROM votes WHERE user_id = $1 AND problem_id = $2', [userId, id]);
      await client.query('UPDATE problems SET score = score - $1 WHERE id = $2', [previousValue, id]);
    } else {
      await client.query('INSERT INTO votes (user_id, problem_id, vote_value) VALUES ($1, $2, $3)', [userId, id, currentPower]);
      await client.query('UPDATE problems SET score = score + $1 WHERE id = $2', [currentPower, id]);
    }

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
// ... (unchanged)
app.get('/api/problems/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT c.id, c.text, c.created_at, u.id as user_id, u.name as user_name 
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
      userName: r.user_name
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
    
    const result = await pool.query(
      'INSERT INTO comments (problem_id, user_id, text) VALUES ($1, $2, $3) RETURNING id, created_at',
      [id, req.user.id, text]
    );
    
    res.json({
      id: result.rows[0].id,
      userId: req.user.id,
      userName: req.user.name,
      text,
      createdAt: new Date(result.rows[0].created_at).getTime()
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to post comment" });
  }
});

// --- Bulk Parse ---
app.post('/api/problems/bulk-parse', authenticateToken, async (req, res) => {
    try {
        const { text, defaultTopics, defaultDifficulty } = req.body;
        if (!text) return res.status(400).json({ error: "No text provided" });

        const problems = [];
        const blockRegex = /\\begin\{problem\}([\s\S]*?)\\end\{problem\}/g;
        let match;
        
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
                difficulty: defaultDifficulty || 3
            });
        }

        if (problems.length === 0) {
            const items = text.split(/\\item\s/);
            if (items.length > 1) {
                items.shift(); 
                items.forEach((item, idx) => {
                    const { statement, solution, answer } = extractMetadata(item);
                    if (statement.length > 5) {
                         problems.push({
                            title: `Imported Problem ${idx + 1}`,
                            statement: statement,
                            solution: solution,
                            answerKey: answer,
                            topics: defaultTopics || [],
                            difficulty: defaultDifficulty || 3
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

// --- Admin ---
app.post('/api/admin/reset-votes', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  const client = await pool.connect();
  try {
      await client.query('BEGIN');
      await client.query('TRUNCATE TABLE votes');
      await client.query('UPDATE problems SET score = 0');
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

// --- Quotas ---
app.get('/api/quotas', authenticateToken, async (req, res) => {
  const result = await pool.query('SELECT id, name, target_count as target, vote_target, instructions, due_date FROM quotas');
  const quotas = result.rows.map(q => ({
      id: q.id,
      name: q.name,
      target: q.target,
      voteTarget: q.vote_target || 3,
      instructions: q.instructions,
      dueDate: q.due_date ? new Date(q.due_date).getTime() : null
  }));
  res.json(quotas);
});

app.post('/api/quotas', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'director') return res.sendStatus(403);
  const { name, target, voteTarget, instructions, dueDate } = req.body;
  try {
    const dateVal = dueDate ? new Date(dueDate).toISOString() : null;
    const result = await pool.query(
      'INSERT INTO quotas (name, target_count, vote_target, instructions, due_date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, target, voteTarget || 3, instructions, dateVal]
    );
    const row = result.rows[0];
    res.json({ id: row.id, name: row.name, target: row.target_count, voteTarget: row.vote_target, instructions: row.instructions, dueDate: row.due_date ? new Date(row.due_date).getTime() : null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Creation failed' });
  }
});

app.put('/api/quotas/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'director') return res.sendStatus(403);
  const { id } = req.params;
  const { name, target, voteTarget, instructions, dueDate } = req.body;
  try {
    const dateVal = dueDate ? new Date(dueDate).toISOString() : null;
    const result = await pool.query(
      'UPDATE quotas SET name = $1, target_count = $2, vote_target = $3, instructions = $4, due_date = $5 WHERE id = $6 RETURNING *',
      [name, target, voteTarget || 3, instructions, dateVal, id]
    );
    const row = result.rows[0];
    res.json({ id: row.id, name: row.name, target: row.target_count, voteTarget: row.vote_target, instructions: row.instructions, dueDate: row.due_date ? new Date(row.due_date).getTime() : null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Update failed' });
  }
});

// --- Rounds ---
app.get('/api/rounds', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM rounds ORDER BY created_at DESC');
        res.json(result.rows.map(r => ({
            id: r.id,
            name: r.name,
            description: r.description,
            folder: r.folder,
            createdAt: new Date(r.created_at).getTime()
        })));
    } catch (e) {
        console.error(e);
        res.status(500).json({error: "Fetch rounds failed"});
    }
});

app.post('/api/rounds', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'director') return res.sendStatus(403);
    const { name, description, folder } = req.body;
    try {
        const result = await pool.query('INSERT INTO rounds (name, description, folder) VALUES ($1, $2, $3) RETURNING *', [name, description, folder || 'Default']);
        const r = result.rows[0];
        res.json({
            id: r.id,
            name: r.name,
            description: r.description,
            folder: r.folder,
            createdAt: new Date(r.created_at).getTime()
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({error: "Create round failed"});
    }
});

app.put('/api/rounds/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'director') return res.sendStatus(403);
    const { id } = req.params;
    const { name, description, folder } = req.body;
    try {
        const result = await pool.query(
            'UPDATE rounds SET name = $1, description = $2, folder = $3 WHERE id = $4 RETURNING *',
            [name, description, folder, id]
        );
        if (result.rows.length === 0) return res.status(404).json({error: "Round not found"});
        const r = result.rows[0];
        res.json({
            id: r.id,
            name: r.name,
            description: r.description,
            folder: r.folder,
            createdAt: new Date(r.created_at).getTime()
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({error: "Update round failed"});
    }
});

app.delete('/api/rounds/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'director') return res.sendStatus(403);
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Legacy cleanup (problems table)
        await client.query('UPDATE problems SET round_id = NULL, status = \'pending\', order_index = 0 WHERE round_id = $1', [id]);
        // New join table cleanup
        await client.query('DELETE FROM round_problems WHERE round_id = $1', [id]);
        
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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

initDB().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
});
