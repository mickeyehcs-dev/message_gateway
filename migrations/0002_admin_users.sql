PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS admin_users (
 username TEXT PRIMARY KEY, salt TEXT NOT NULL, password_hash TEXT NOT NULL,
 iterations INTEGER NOT NULL DEFAULT 210000,
 enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS admin_sessions (
 token_hash TEXT PRIMARY KEY,
 username TEXT NOT NULL REFERENCES admin_users(username) ON DELETE CASCADE,
 expires_at TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expiry ON admin_sessions(expires_at);
