-- Database schema for Tower Defense Game
-- Run this SQL in your Cloudflare D1 database

-- Users table
-- Passwords: hashed with PBKDF2 + per-user salt before storage. Never stored or sent in plain text.
-- Usernames: stored in plain text for lookup and display.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_created_at ON users(created_at);

-- Game stats table (for future use - tracking player stats, high scores, etc.)
CREATE TABLE IF NOT EXISTS game_stats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  wave_reached INTEGER DEFAULT 0,
  enemies_killed INTEGER DEFAULT 0,
  towers_placed INTEGER DEFAULT 0,
  best_score INTEGER DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_game_stats_user_id ON game_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_game_stats_best_score ON game_stats(best_score);

-- Game sessions table (for tracking individual game sessions)
CREATE TABLE IF NOT EXISTS game_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  wave_reached INTEGER DEFAULT 0,
  enemies_killed INTEGER DEFAULT 0,
  towers_placed INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id ON game_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_started_at ON game_sessions(started_at);
