/**
 * Distributed rate limiter using Cloudflare D1
 * Avoids reliance on ephemeral Worker in-memory state
 */

/**
 * Checks and increments rate limit counter
 * @param {D1Database} db 
 * @param {string} key - Unique rate limit bucket key (e.g. "source:123", "login:admin")
 * @param {number} maxLimit - Maximum allowed requests in window
 * @param {number} windowSeconds - Sliding window duration in seconds
 * @returns {Promise<{allowed: boolean, remaining: number, resetAt: number}>}
 */
export async function checkRateLimit(db, key, maxLimit, windowSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const resetAt = now + windowSeconds;

  try {
    // Read current rate limit entry
    const existing = await db
      .prepare("SELECT count, reset_at FROM rate_limits WHERE key = ?")
      .bind(key)
      .first();

    if (!existing || existing.reset_at <= now) {
      // Bucket expired or does not exist yet: create or reset
      await db
        .prepare(`
          INSERT INTO rate_limits (key, count, reset_at)
          VALUES (?, 1, ?)
          ON CONFLICT(key) DO UPDATE SET count = 1, reset_at = excluded.reset_at
        `)
        .bind(key, resetAt)
        .run();

      return {
        allowed: true,
        remaining: maxLimit - 1,
        resetAt
      };
    }

    // Active window exists
    if (existing.count >= maxLimit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: existing.reset_at
      };
    }

    // Increment count
    await db
      .prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?")
      .bind(key)
      .run();

    return {
      allowed: true,
      remaining: Math.max(0, maxLimit - (existing.count + 1)),
      resetAt: existing.reset_at
    };
  } catch (error) {
    // If rate limit table check fails, log warning and allow request to proceed (fail open for availability, bounded)
    console.error("rate_limit_error", { key, error: error instanceof Error ? error.message : "unknown" });
    return {
      allowed: true,
      remaining: 1,
      resetAt
    };
  }
}

/**
 * Cleans up expired rate limit entries from D1
 * @param {D1Database} db 
 */
export async function cleanupExpiredRateLimits(db) {
  const now = Math.floor(Date.now() / 1000);
  try {
    await db.prepare("DELETE FROM rate_limits WHERE reset_at <= ?").bind(now).run();
  } catch (error) {
    console.error("cleanup_rate_limits_error", error);
  }
}
