-- Run this if you already have a users table without password_salt.
-- New installs: schema.sql already includes password_salt.
-- wrangler d1 execute tdd_db --remote --file=./migrations/001_add_password_salt.sql

ALTER TABLE users ADD COLUMN password_salt TEXT;
