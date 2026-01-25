const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const { GoogleGenAI } = require("@google/genai");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the React build directory (dist)
app.use(express.static(path.join(__dirname, 'dist')));

// Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// AI Initialization
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
        role TEXT NOT NULL CHECK (role IN ('admin', 'writer')),
        voting_power INTEGER DEFAULT 1,
        custom_targets JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS quotas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        target_count INTEGER NOT NULL DEFAULT 5,
        instructions TEXT,
        due_date TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS problems (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        author_id UUID REFERENCES users(id),
        quota_id UUID REFERENCES quotas(id),
        title TEXT NOT NULL,
        statement TEXT NOT NULL,
        difficulty NUMERIC(3,1) DEFAULT 0,
        topics TEXT[] DEFAULT '{}',
        score INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS votes (
        user_id UUID REFERENCES users(id),
        problem_id UUID REFERENCES problems(id),
        vote_value INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, problem_id)
      );
    `);
    
    // --- MIGRATION: Ensure new columns exist for old databases ---
    await client.query(`
      ALTER TABLE problems ADD COLUMN IF NOT EXISTS difficulty NUMERIC(3,1) DEFAULT 0;
      ALTER TABLE problems ADD COLUMN IF NOT EXISTS topics TEXT[] DEFAULT '{}';
      ALTER TABLE problems ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
    `);

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

    // Seed Initial Quota if not exists
    const quotaCheck = await client.query("SELECT * FROM quotas");
    if (quotaCheck.rows.length === 0) {
       await client.query(
         "INSERT INTO quotas (name, target_count, instructions, is_active) VALUES ($1, $2, $3, $4)",
         ['General Submission', 5, 'Standard middle school math contest problems.', true]
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

// --- Routes: AI Analysis ---
app.post('/api/ai/analyze', authenticateToken, async (req, res) => {
  try {
    const { statement, title, difficulty } = req.body;
    
    if (!process.env.API_KEY) {
       return res.json({ text: "AI Analysis is not configured (Missing API Key)." });
    }

    const prompt = `
      Act as a strict Math Olympiad Editor. Analyze the following math problem proposed for a middle school contest.
      
      Title: ${title}
      Proposed Difficulty (0-10): ${difficulty}
      Problem Statement (LaTeX): 
      ${statement}

      Please provide a brief critique covering:
      1. Clarity & Ambiguity Check (Is there only one answer? Is phrasing clear?)
      2. Difficulty Assessment (Does it match the proposed rating?)
      3. Suggestions for improvement.
      
      Keep the response concise (under 100 words).
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-latest',
      contents: prompt,
    });
    
    res.json({ text: response.text });
  } catch (err) {
    console.error("AI Error:", err);
    res.status(500).json({ error: "Failed to analyze problem" });
  }
});

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

app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Return all fields needed for the frontend User interface
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, role, voting_power, custom_targets',
      [name, email, hashedPassword, role || 'writer']
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
    const result = await pool.query('SELECT id, name, role, voting_power, custom_targets FROM users ORDER BY name');
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
  if (req.user.role !== 'admin') return res.sendStatus(403);
  
  const { id } = req.params;
  const { name, password, votingPower, customTargets } = req.body;
  
  try {
    let query = 'UPDATE users SET name = $1, voting_power = $2, custom_targets = $3';
    let params = [name, votingPower, customTargets];
    
    if (password && password.trim() !== '') {
        const hashedPassword = await bcrypt.hash(password, 10);
        query += ', password_hash = $4 WHERE id = $5';
        params.push(hashedPassword, id);
    } else {
        query += ' WHERE id = $4';
        params.push(id);
    }
    
    await pool.query(query, params);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Update failed' });
  }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        const userId = req.params.id;
        await client.query('DELETE FROM votes WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM votes WHERE problem_id IN (SELECT id FROM problems WHERE author_id = $1)', [userId]);
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
  try {
    const result = await pool.query(`
      SELECT p.*, u.name as author_name, 
      (SELECT array_agg(user_id) FROM votes WHERE problem_id = p.id) as voted_by
      FROM problems p
      LEFT JOIN users u ON p.author_id = u.id
      ORDER BY p.score DESC
    `);
    
    const problems = result.rows.map(row => ({
      ...row,
      authorName: row.author_name || 'Unknown',
      authorId: row.author_id,
      quotaId: row.quota_id, // Ensure we send this
      difficulty: row.difficulty ? parseFloat(row.difficulty) : 0,
      topics: row.topics || [],
      status: row.status || 'pending',
      createdAt: new Date(row.created_at).getTime(),
      votedBy: row.voted_by || []
    }));

    res.json(problems);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch problems' });
  }
});

app.post('/api/problems', authenticateToken, async (req, res) => {
  try {
    const { title, statement, quotaId, difficulty, topics } = req.body;
    
    const diffVal = (difficulty && !isNaN(difficulty)) ? difficulty : 0;
    
    const result = await pool.query(
      'INSERT INTO problems (author_id, quota_id, title, statement, difficulty, topics, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [req.user.id, quotaId, title, statement, diffVal, topics || [], 'pending']
    );

    res.json({ ...result.rows[0], isAcceptable: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Submission failed' });
  }
});

app.put('/api/problems/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { title, statement, difficulty, topics } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    // 1. Verify ownership or admin status
    const check = await pool.query('SELECT author_id FROM problems WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Problem not found' });
    
    const authorId = check.rows[0].author_id;
    if (authorId !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to edit this problem' });
    }

    // 2. Update
    const diffVal = (difficulty && !isNaN(difficulty)) ? difficulty : 0;
    
    const result = await pool.query(
      'UPDATE problems SET title = $1, statement = $2, difficulty = $3, topics = $4 WHERE id = $5 RETURNING *',
      [title, statement, diffVal, topics, id]
    );

    res.json({ success: true, problem: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Update failed' });
  }
});

// New Route: Update Status (Admin Only)
app.patch('/api/problems/:id/status', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  
  const { id } = req.params;
  const { status } = req.body;

  if (!['pending', 'shortlisted', 'accepted'].includes(status)) {
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

app.post('/api/problems/:id/vote', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const userId = req.user.id;
    const power = req.user.power; // This assumes JWT has up-to-date power

    // Check existing vote
    const check = await client.query('SELECT * FROM votes WHERE user_id = $1 AND problem_id = $2', [userId, id]);
    
    if (check.rows.length > 0) {
      await client.query('DELETE FROM votes WHERE user_id = $1 AND problem_id = $2', [userId, id]);
      await client.query('UPDATE problems SET score = score - $1 WHERE id = $2', [power, id]);
    } else {
      await client.query('INSERT INTO votes (user_id, problem_id, vote_value) VALUES ($1, $2, $3)', [userId, id, power]);
      await client.query('UPDATE problems SET score = score + $1 WHERE id = $2', [power, id]);
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

// --- Routes: Quotas ---

app.get('/api/quotas', authenticateToken, async (req, res) => {
  const result = await pool.query('SELECT id, name, target_count as target, instructions, due_date FROM quotas');
  const quotas = result.rows.map(q => ({
      ...q,
      dueDate: q.due_date ? new Date(q.due_date).getTime() : null
  }));
  res.json(quotas);
});

app.post('/api/quotas', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  
  const { name, target, instructions, dueDate } = req.body;
  
  try {
    const dateVal = dueDate ? new Date(dueDate).toISOString() : null;
    const result = await pool.query(
      'INSERT INTO quotas (name, target_count, instructions, due_date) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, target, instructions, dateVal]
    );
    const row = result.rows[0];
    res.json({
        id: row.id,
        name: row.name,
        target: row.target_count,
        instructions: row.instructions,
        dueDate: row.due_date ? new Date(row.due_date).getTime() : null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Creation failed' });
  }
});

app.put('/api/quotas/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  const { id } = req.params;
  const { name, target, instructions, dueDate } = req.body;
  try {
    const dateVal = dueDate ? new Date(dueDate).toISOString() : null;
    const result = await pool.query(
      'UPDATE quotas SET name = $1, target_count = $2, instructions = $3, due_date = $4 WHERE id = $5 RETURNING *',
      [name, target, instructions, dateVal, id]
    );
    const row = result.rows[0];
    res.json({
        id: row.id,
        name: row.name,
        target: row.target_count,
        instructions: row.instructions,
        dueDate: row.due_date ? new Date(row.due_date).getTime() : null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Update failed' });
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