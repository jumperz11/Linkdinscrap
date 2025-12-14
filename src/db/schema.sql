-- LinkScope Database Schema
-- SQLite

-- User's own LinkedIn profile analysis
CREATE TABLE IF NOT EXISTS user_profile (
  id INTEGER PRIMARY KEY,
  linkedin_url TEXT,
  name TEXT,
  headline TEXT,
  industry TEXT,
  data JSON,
  analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Visited profiles
CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  linkedin_id TEXT UNIQUE,
  linkedin_url TEXT,
  name TEXT,
  headline TEXT,
  company TEXT,
  location TEXT,
  connection_count INTEGER,
  mutual_connections INTEGER,
  about TEXT,
  data JSON,
  score INTEGER,
  score_reason TEXT,
  category TEXT,
  action_taken TEXT,
  message_sent TEXT,
  session_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Session logs
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME,
  search_keywords TEXT,
  profiles_viewed INTEGER DEFAULT 0,
  connections_sent INTEGER DEFAULT 0,
  follows_sent INTEGER DEFAULT 0,
  status TEXT DEFAULT 'running',
  config JSON
);

-- Bot configuration
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value JSON,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Schedule settings
CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enabled INTEGER DEFAULT 0,
  times TEXT,
  days TEXT,
  search_keywords TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_session ON profiles(session_id);
CREATE INDEX IF NOT EXISTS idx_profiles_score ON profiles(score);
CREATE INDEX IF NOT EXISTS idx_profiles_category ON profiles(category);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
