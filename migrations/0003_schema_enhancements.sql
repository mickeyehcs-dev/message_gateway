-- Migration 0003: Schema enhancements for production notification gateway
-- Adds audit timestamps, rate limiting state, idempotency hash, and performance indexes

PRAGMA foreign_keys = ON;

-- Administrators: add update and last login tracking
ALTER TABLE admin_users ADD COLUMN updated_at TEXT;
ALTER TABLE admin_users ADD COLUMN last_login_at TEXT;

-- Admin sessions: add revocation timestamp
ALTER TABLE admin_sessions ADD COLUMN revoked_at TEXT;

-- Sources: add last used timestamp and rate limiting configuration
ALTER TABLE sources ADD COLUMN last_used_at TEXT;
ALTER TABLE sources ADD COLUMN rate_limit_per_minute INTEGER DEFAULT 60;

-- Destinations: add update timestamp
ALTER TABLE destinations ADD COLUMN updated_at TEXT;

-- Events: add title, processing status, and payload hash for idempotency verification
ALTER TABLE events ADD COLUMN title TEXT NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN status TEXT NOT NULL DEFAULT 'processed';
ALTER TABLE events ADD COLUMN payload_hash TEXT;

-- Delivery logs: add attempt count, completion timestamp, and sanitized error message
ALTER TABLE delivery_logs ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE delivery_logs ADD COLUMN completed_at TEXT;
ALTER TABLE delivery_logs ADD COLUMN error_message TEXT NOT NULL DEFAULT '';

-- Distributed rate limit state table (avoids relying on volatile in-memory Worker state)
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at INTEGER NOT NULL
);

-- Indexes for performance and dashboard queries
CREATE INDEX IF NOT EXISTS idx_events_topic ON events(topic);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_event ON delivery_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_dest_status ON delivery_logs(destination_id, status);
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON rate_limits(reset_at);
CREATE INDEX IF NOT EXISTS idx_sources_enabled ON sources(enabled);
CREATE INDEX IF NOT EXISTS idx_destinations_enabled ON destinations(enabled);
