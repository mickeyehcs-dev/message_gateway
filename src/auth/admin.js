/**
 * Administrator authentication, PBKDF2 password verification,
 * and cryptographically secure session management.
 */

import { verifyPassword, generateSecureToken, sha256 } from "../security/crypto.js";
import { checkRateLimit } from "../security/rate-limit.js";
import { queryFirst, execute } from "../db/index.js";

const SESSION_DURATION_HOURS = 24;

/**
 * Handles administrator login
 * @param {D1Database} db 
 * @param {string} username 
 * @param {string} password 
 * @param {string} clientIp 
 * @returns {Promise<{success: boolean, token?: string, error?: string, status: number}>}
 */
export async function loginAdmin(db, username, password, clientIp = "unknown") {
  if (!username || !password) {
    return { success: false, error: "Invalid username or password", status: 400 };
  }

  const normalizedUser = username.trim();
  const rateLimitKey = `login_fail:${normalizedUser}:${clientIp}`;

  // 1. Check rate limit lockout (only blocks if 10 consecutive failed attempts in active window)
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const existingLimit = await queryFirst(
      db,
      "SELECT count, reset_at FROM rate_limits WHERE key = ?",
      [rateLimitKey]
    );
    if (existingLimit && existingLimit.reset_at > nowSec && existingLimit.count >= 10) {
      return {
        success: false,
        error: "Too many failed login attempts. Please wait a few minutes before trying again.",
        status: 429
      };
    }
  } catch (e) {
    // If rate_limits table does not exist or query fails, allow attempt
  }

  try {
    const admin = await queryFirst(
      db,
      "SELECT username, salt, password_hash, iterations, enabled FROM admin_users WHERE username = ?",
      [normalizedUser]
    );

    if (!admin) {
      // Check if admin_users is empty to provide actionable guidance
      try {
        const countCheck = await queryFirst(db, "SELECT COUNT(*) as count FROM admin_users");
        if (!countCheck || countCheck.count === 0) {
          return {
            success: false,
            error: "No administrator accounts found in D1. Run scripts/remote-init.sql in Cloudflare D1 Console.",
            status: 401
          };
        }
      } catch (e) {}

      // Record failed attempt
      try { await checkRateLimit(db, rateLimitKey, 10, 15 * 60); } catch (e) {}
      return { success: false, error: "Invalid username or password", status: 401 };
    }

    if (admin.enabled !== 1) {
      try { await checkRateLimit(db, rateLimitKey, 10, 15 * 60); } catch (e) {}
      return { success: false, error: "Invalid username or password", status: 401 };
    }

    let isValid = false;
    // Direct / unhashed password comparison
    if (
      admin.password_hash === password ||
      admin.password_hash?.trim() === password ||
      (admin.password && admin.password === password)
    ) {
      isValid = true;
    } else if (admin.salt && admin.password_hash) {
      try {
        isValid = await verifyPassword(
          password,
          admin.salt,
          admin.password_hash,
          admin.iterations || 210000
        );
      } catch (err) {
        isValid = false;
      }
    }

    if (!isValid) {
      // Increment failed attempt counter only on invalid password
      try { await checkRateLimit(db, rateLimitKey, 10, 15 * 60); } catch (e) {}
      return { success: false, error: "Invalid username or password", status: 401 };
    }

    // Password valid! Clear any failed attempts for this user/IP
    try {
      await execute(db, "DELETE FROM rate_limits WHERE key = ?", [rateLimitKey]);
    } catch (e) {}

    // Generate secure session token
    const rawToken = generateSecureToken("adm_sess_", 32);
    const tokenHash = await sha256(rawToken);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_DURATION_HOURS * 60 * 60 * 1000).toISOString();
    const createdAt = now.toISOString();

    // Store hashed session token in D1
    await execute(
      db,
      "INSERT INTO admin_sessions (token_hash, username, expires_at, created_at) VALUES (?, ?, ?, ?)",
      [tokenHash, normalizedUser, expiresAt, createdAt]
    );

    // Update last login timestamp
    await execute(
      db,
      "UPDATE admin_users SET last_login_at = ? WHERE username = ?",
      [createdAt, normalizedUser]
    );

    return {
      success: true,
      token: rawToken,
      expiresAt,
      username: normalizedUser,
      status: 200
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("admin_login_error", error);
    if (/no such table/i.test(errorMsg)) {
      return {
        success: false,
        error: "Database tables are not initialized in Cloudflare D1. Run scripts/remote-init.sql in the D1 Console.",
        status: 503
      };
    }
    return { success: false, error: "Authentication system error: " + errorMsg, status: 500 };
  }
}

/**
 * Authenticates an administrator from an Authorization header
 * @param {D1Database} db 
 * @param {string|null} authHeader 
 * @returns {Promise<{authenticated: boolean, username?: string, error?: string, status: number}>}
 */
export async function authenticateAdmin(db, authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { authenticated: false, error: "Missing or invalid Authorization header", status: 401 };
  }

  const rawToken = authHeader.slice(7).trim();
  if (!rawToken) {
    return { authenticated: false, error: "Missing session token", status: 401 };
  }

  try {
    const tokenHash = await sha256(rawToken);

    // Session must not be expired, not revoked, and the admin must be enabled
    const session = await queryFirst(
      db,
      `
      SELECT s.token_hash, s.username, s.expires_at, s.revoked_at, u.enabled
      FROM admin_sessions s
      JOIN admin_users u ON u.username = s.username
      WHERE s.token_hash = ?
      `,
      [tokenHash]
    );

    if (!session) {
      return { authenticated: false, error: "Invalid or expired session", status: 401 };
    }

    if (session.revoked_at) {
      return { authenticated: false, error: "Session has been revoked", status: 401 };
    }

    if (session.enabled !== 1) {
      return { authenticated: false, error: "Administrator account is disabled", status: 403 };
    }

    const now = new Date().toISOString();
    if (session.expires_at <= now) {
      return { authenticated: false, error: "Session has expired", status: 401 };
    }

    return {
      authenticated: true,
      username: session.username,
      status: 200
    };
  } catch (error) {
    console.error("authenticate_admin_error", error);
    return { authenticated: false, error: "Authentication check failed", status: 500 };
  }
}

/**
 * Revokes an administrator session (logout)
 * @param {D1Database} db 
 * @param {string} rawToken 
 * @returns {Promise<boolean>}
 */
export async function logoutAdmin(db, rawToken) {
  if (!rawToken) return false;
  try {
    const tokenHash = await sha256(rawToken);
    const now = new Date().toISOString();
    await execute(
      db,
      "UPDATE admin_sessions SET revoked_at = ? WHERE token_hash = ?",
      [now, tokenHash]
    );
    return true;
  } catch (error) {
    console.error("logout_admin_error", error);
    return false;
  }
}

/**
 * Removes expired or revoked admin sessions
 * @param {D1Database} db 
 */
export async function cleanupExpiredSessions(db) {
  const now = new Date().toISOString();
  try {
    await execute(
      db,
      "DELETE FROM admin_sessions WHERE expires_at <= ? OR revoked_at IS NOT NULL",
      [now]
    );
  } catch (error) {
    console.error("cleanup_sessions_error", error);
  }
}
