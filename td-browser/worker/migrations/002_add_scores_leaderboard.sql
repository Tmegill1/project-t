-- Migration 002: leaderboard support
-- The game_sessions table already exists (schema.sql); the leaderboard
-- endpoint sorts by score, so give it an index.
CREATE INDEX IF NOT EXISTS idx_game_sessions_score ON game_sessions(score);
