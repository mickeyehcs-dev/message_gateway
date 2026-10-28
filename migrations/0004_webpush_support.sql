-- Migration 0004: Web Push notification support, VAPID settings, and topic style configuration
-- Replaces ntfy provider destination type with webpush

PRAGMA foreign_keys = OFF;

-- Topics: Add Web Push style and notification behaviour configuration
ALTER TABLE topics ADD COLUMN webpush_config_json TEXT NOT NULL DEFAULT '{}';

-- System Settings: Persistent key-value storage for VAPID keys and gateway metadata
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Recreate destinations table with updated check constraint ('email', 'telegram', 'webpush')
CREATE TABLE IF NOT EXISTS destinations_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('email', 'telegram', 'webpush')),
  config_json TEXT NOT NULL,
  secret_ciphertext TEXT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

INSERT INTO destinations_new (id, name, type, config_json, secret_ciphertext, enabled, created_at, updated_at)
SELECT id, name, CASE WHEN type = 'ntfy' THEN 'webpush' ELSE type END, config_json, secret_ciphertext, enabled, created_at, updated_at
FROM destinations;

DROP TABLE destinations;
ALTER TABLE destinations_new RENAME TO destinations;

CREATE INDEX IF NOT EXISTS idx_destinations_enabled ON destinations(enabled);

PRAGMA foreign_keys = ON;
