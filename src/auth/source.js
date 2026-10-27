/**
 * Source authentication and topic authorization
 */

import { sha256 } from "../security/crypto.js";
import { checkRateLimit } from "../security/rate-limit.js";
import { queryFirst, execute } from "../db/index.js";

/**
 * Authenticates a source application from an Authorization header
 * @param {D1Database} db 
 * @param {string|null} authHeader 
 * @returns {Promise<{authenticated: boolean, source?: any, error?: string, status: number}>}
 */
export async function authenticateSource(db, authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { authenticated: false, error: "Missing or malformed Authorization header. Expected 'Bearer <SOURCE_API_KEY>'", status: 401 };
  }

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey) {
    return { authenticated: false, error: "Empty source API key", status: 401 };
  }

  try {
    const keyHash = await sha256(rawKey);

    const source = await queryFirst(
      db,
      "SELECT id, name, enabled, rate_limit_per_minute, created_at, last_used_at FROM sources WHERE token_hash = ?",
      [keyHash]
    );

    if (!source) {
      return { authenticated: false, error: "Invalid source credential", status: 401 };
    }

    if (source.enabled !== 1) {
      return { authenticated: false, error: "Source is disabled", status: 403 };
    }

    // Per-source rate limiting
    const limit = source.rate_limit_per_minute || 60;
    const rateLimitResult = await checkRateLimit(db, `source:${source.id}`, limit, 60);

    if (!rateLimitResult.allowed) {
      return {
        authenticated: false,
        error: `Rate limit exceeded. Maximum ${limit} requests per minute allowed for this source.`,
        status: 429
      };
    }

    // Update last_used_at timestamp asynchronously
    const now = new Date().toISOString();
    await execute(db, "UPDATE sources SET last_used_at = ? WHERE id = ?", [now, source.id]);

    return {
      authenticated: true,
      source,
      status: 200
    };
  } catch (error) {
    console.error("authenticate_source_error", error);
    return { authenticated: false, error: "Source authentication failed", status: 500 };
  }
}

/**
 * Verifies if a source is permitted to publish to a specific topic
 * @param {D1Database} db 
 * @param {number} sourceId 
 * @param {string} topicName 
 * @returns {Promise<boolean>}
 */
export async function isSourceAuthorizedForTopic(db, sourceId, topicName) {
  try {
    const record = await queryFirst(
      db,
      "SELECT 1 FROM source_topics WHERE source_id = ? AND topic_name = ?",
      [sourceId, topicName]
    );
    return record !== null;
  } catch (error) {
    console.error("source_topic_check_error", error);
    return false;
  }
}
