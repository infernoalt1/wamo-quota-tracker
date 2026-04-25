
-- Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL, -- using email as username/login id
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'director', 'writer', 'guest')),
  voting_power INTEGER DEFAULT 1,
  custom_targets JSONB DEFAULT '{}'::jsonb, -- Store quota specific overrides: {"quota_id": 10}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Quotas/Rounds Table
CREATE TABLE quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  target_count INTEGER NOT NULL DEFAULT 5,
  instructions TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Problems Table
CREATE TABLE problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES users(id),
  quota_id UUID REFERENCES quotas(id),
  title TEXT NOT NULL,
  statement TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Votes Table (To track who voted for what, preventing double votes)
CREATE TABLE votes (
  user_id UUID REFERENCES users(id),
  problem_id UUID REFERENCES problems(id),
  vote_value INTEGER NOT NULL, -- Stores the power used for this vote
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, problem_id)
);

-- Initial Seed Data
INSERT INTO quotas (name, target_count, instructions, is_active, due_date) 
VALUES ('General Submission', 5, 'Standard middle school math contest problems.', TRUE, NULL);

-- Default Admin (Password: admin123)
-- Hash generated via bcrypt
INSERT INTO users (name, email, password_hash, role, voting_power)
VALUES ('Director', 'admin@probfair.org', '$2b$10$YourHashedPasswordHere...', 'admin', 5);
