-- Universal Notification Gateway - Cloudflare D1 Remote Database Initialization
-- Single-pass idempotent schema for Cloudflare D1 Web Console

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  webpush_config_json TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT,
  rate_limit_per_minute INTEGER DEFAULT 60
);

CREATE TABLE IF NOT EXISTS source_topics (
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  topic_name TEXT NOT NULL REFERENCES topics(name) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (source_id, topic_name)
);

CREATE TABLE IF NOT EXISTS destinations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('email', 'telegram', 'webpush')),
  config_json TEXT NOT NULL,
  secret_ciphertext TEXT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS recipient_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS group_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES recipient_groups(id) ON DELETE CASCADE,
  destination_id INTEGER NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (group_id, destination_id)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  source_id INTEGER REFERENCES sources(id) ON DELETE CASCADE,
  severity TEXT CHECK (severity IS NULL OR severity IN ('info', 'warning', 'error', 'critical')),
  destination_id INTEGER REFERENCES destinations(id) ON DELETE CASCADE,
  group_id INTEGER REFERENCES recipient_groups(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK ((destination_id IS NOT NULL AND group_id IS NULL) OR (destination_id IS NULL AND group_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources(id),
  topic TEXT NOT NULL REFERENCES topics(name),
  title TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  message TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  idempotency_key TEXT,
  payload_hash TEXT,
  status TEXT NOT NULL DEFAULT 'processed',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (source_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS delivery_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  destination_id INTEGER NOT NULL REFERENCES destinations(id),
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  http_status INTEGER,
  response_excerpt TEXT NOT NULL DEFAULT '',
  error_message TEXT NOT NULL DEFAULT '',
  attempt_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS admin_users (
  username TEXT PRIMARY KEY,
  salt TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  iterations INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  username TEXT NOT NULL REFERENCES admin_users(username) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Performance and Query Indexes
CREATE INDEX IF NOT EXISTS idx_source_topics_topic ON source_topics(topic_name);
CREATE INDEX IF NOT EXISTS idx_subscriptions_match ON subscriptions(topic_id, source_id, severity, enabled);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id, enabled);
CREATE INDEX IF NOT EXISTS idx_events_source_idempotency ON events(source_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_topic ON events(topic);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_created ON delivery_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_event ON delivery_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_dest_status ON delivery_logs(destination_id, status);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expiry ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON rate_limits(reset_at);
CREATE INDEX IF NOT EXISTS idx_sources_enabled ON sources(enabled);
CREATE INDEX IF NOT EXISTS idx_destinations_enabled ON destinations(enabled);

-- Initial Administrator Accounts
INSERT INTO admin_users (username, salt, password_hash, iterations, enabled)
VALUES ('admin', '', 'Karthik@2006', 0, 1)
ON CONFLICT(username) DO UPDATE SET password_hash='Karthik@2006', enabled=1;

INSERT INTO admin_users (username, salt, password_hash, iterations, enabled)
VALUES ('karthik', '', 'Karthik@2006', 0, 1)
ON CONFLICT(username) DO UPDATE SET password_hash='Karthik@2006', enabled=1;

-- Reset any stuck rate limit locks
DELETE FROM rate_limits;

