import { describe, it, expect, beforeEach } from "vitest";
import { createTestDatabase } from "./helpers/test-db.js";
import { hashPassword } from "../src/security/crypto.js";
import { loginAdmin, authenticateAdmin, logoutAdmin } from "../src/auth/admin.js";
import { authenticateSource } from "../src/auth/source.js";
import { createSource } from "../src/services/admin.js";

describe("Authentication & Session Management", () => {
  let db;

  beforeEach(async () => {
    db = createTestDatabase();

    // Create an active admin user
    const { hash, salt, iterations } = await hashPassword("super-secret-password-123", null, 100000);
    await db.prepare(`
      INSERT INTO admin_users (username, salt, password_hash, iterations, enabled)
      VALUES (?, ?, ?, ?, 1)
    `).bind("admin_test", salt, hash, iterations).run();

    // Create a disabled admin user
    await db.prepare(`
      INSERT INTO admin_users (username, salt, password_hash, iterations, enabled)
      VALUES (?, ?, ?, ?, 0)
    `).bind("admin_disabled", salt, hash, iterations).run();
  });

  it("should successfully authenticate an administrator with valid password", async () => {
    const res = await loginAdmin(db, "admin_test", "super-secret-password-123", "127.0.0.1");
    expect(res.success).toBe(true);
    expect(res.token).toBeDefined();
    expect(res.token.startsWith("adm_sess_")).toBe(true);
    expect(res.username).toBe("admin_test");

    // Verify authenticated session
    const authCheck = await authenticateAdmin(db, `Bearer ${res.token}`);
    expect(authCheck.authenticated).toBe(true);
    expect(authCheck.username).toBe("admin_test");
  });

  it("should reject an administrator login with an incorrect password", async () => {
    const res = await loginAdmin(db, "admin_test", "wrong-password", "127.0.0.1");
    expect(res.success).toBe(false);
    expect(res.status).toBe(401);
    expect(res.error).toBe("Invalid username or password");
  });

  it("should reject an administrator login for an unknown username", async () => {
    const res = await loginAdmin(db, "non_existent_user", "super-secret-password-123", "127.0.0.1");
    expect(res.success).toBe(false);
    expect(res.status).toBe(401);
    expect(res.error).toBe("Invalid username or password");
  });

  it("should reject a disabled administrator", async () => {
    const res = await loginAdmin(db, "admin_disabled", "super-secret-password-123", "127.0.0.1");
    expect(res.success).toBe(false);
    expect(res.status).toBe(401);
    expect(res.error).toBe("Invalid username or password");
  });

  it("should enforce session expiration", async () => {
    const login = await loginAdmin(db, "admin_test", "super-secret-password-123", "127.0.0.1");
    expect(login.success).toBe(true);

    // Manually expire the session in the database
    const pastDate = new Date(Date.now() - 3600000).toISOString();
    await db.prepare("UPDATE admin_sessions SET expires_at = ?").bind(pastDate).run();

    const authCheck = await authenticateAdmin(db, `Bearer ${login.token}`);
    expect(authCheck.authenticated).toBe(false);
    expect(authCheck.error).toContain("expired");
  });

  it("should revoke a session on logout", async () => {
    const login = await loginAdmin(db, "admin_test", "super-secret-password-123", "127.0.0.1");
    expect(login.success).toBe(true);

    const loggedOut = await logoutAdmin(db, login.token);
    expect(loggedOut).toBe(true);

    const authCheck = await authenticateAdmin(db, `Bearer ${login.token}`);
    expect(authCheck.authenticated).toBe(false);
    expect(authCheck.error).toContain("revoked");
  });

  it("should authenticate a registered active source with valid API key", async () => {
    // Create topic first
    await db.prepare("INSERT INTO topics (name, description, enabled) VALUES ('system.alerts', 'desc', 1)").run();

    const created = await createSource(db, {
      name: "app-server-1",
      allowed_topics: ["system.alerts"],
      rate_limit_per_minute: 100
    });

    expect(created.token).toBeDefined();
    expect(created.token.startsWith("src_")).toBe(true);

    const authResult = await authenticateSource(db, `Bearer ${created.token}`);
    expect(authResult.authenticated).toBe(true);
    expect(authResult.source.name).toBe("app-server-1");
  });

  it("should reject an invalid source credential", async () => {
    const authResult = await authenticateSource(db, "Bearer invalid_source_token_12345");
    expect(authResult.authenticated).toBe(false);
    expect(authResult.status).toBe(401);
  });

  it("should reject a disabled source", async () => {
    await db.prepare("INSERT INTO topics (name, description, enabled) VALUES ('system.alerts', 'desc', 1)").run();
    const created = await createSource(db, {
      name: "disabled-app",
      allowed_topics: ["system.alerts"]
    });

    // Disable the source
    await db.prepare("UPDATE sources SET enabled = 0 WHERE id = ?").bind(created.id).run();

    const authResult = await authenticateSource(db, `Bearer ${created.token}`);
    expect(authResult.authenticated).toBe(false);
    expect(authResult.status).toBe(403);
    expect(authResult.error).toContain("disabled");
  });

  it("should reject missing or malformed Authorization header", async () => {
    const res1 = await authenticateAdmin(db, null);
    expect(res1.authenticated).toBe(false);

    const res2 = await authenticateSource(db, "Basic xyz123");
    expect(res2.authenticated).toBe(false);
  });
});
