
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
  vote_target INTEGER DEFAULT 20,
  quota_pool_vote_target INTEGER DEFAULT 16,
  global_pool_vote_target INTEGER DEFAULT 4,
  min_voting_pool_size INTEGER DEFAULT 15,
  voting_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  instructions TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tag TEXT,
  description TEXT,
  target_size INTEGER DEFAULT 10,
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
  comparison_appearances INTEGER NOT NULL DEFAULT 0,
  comparison_wins INTEGER NOT NULL DEFAULT 0,
  comparison_losses INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Votes Table (To track who voted for what, preventing double votes)
CREATE TABLE votes (
  user_id UUID REFERENCES users(id),
  problem_id UUID REFERENCES problems(id),
  vote_value INTEGER NOT NULL, -- Stores the power used for this vote
  invalid_reason TEXT,
  invalidated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, problem_id)
);

CREATE TABLE comparison_votes (
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

CREATE TABLE comparison_vote_items (
  vote_id UUID REFERENCES comparison_votes(id) ON DELETE CASCADE,
  problem_id UUID REFERENCES problems(id),
  was_selected BOOLEAN NOT NULL DEFAULT FALSE,
  wins_awarded INTEGER NOT NULL DEFAULT 0,
  losses_awarded INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (vote_id, problem_id)
);

-- Initial Seed Data
INSERT INTO quotas (
  name,
  target_count,
  vote_target,
  quota_pool_vote_target,
  global_pool_vote_target,
  min_voting_pool_size,
  voting_enabled,
  instructions,
  is_active,
  due_date
) 
VALUES ('General Submission', 0, 0, 0, 0, 15, FALSE, 'Standard middle school math contest problems.', TRUE, NULL);

-- Default Admin (Password: admin123)
-- Hash generated via bcrypt
INSERT INTO users (name, email, password_hash, role, voting_power)
VALUES ('Director', 'admin@probfair.org', '$2b$10$YourHashedPasswordHere...', 'admin', 5);
