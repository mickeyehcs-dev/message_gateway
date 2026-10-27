import { describe, it, expect, beforeEach } from "vitest";
import { createTestDatabase } from "./helpers/test-db.js";
import { createSource, createTopic, createDestination, listDestinations } from "../src/services/admin.js";
import { handleRequest } from "../src/router.js";
import { hashPassword } from "../src/security/crypto.js";

describe("Authorization and Scoping", () => {
  let db;
  let env;
  let sourceAuthHeader;
  let adminAuthHeader;

  beforeEach(async () => {
    db = createTestDatabase();
    env = {
      DB: db,
      DESTINATION_ENCRYPTION_KEY: "secret-master-key-0123456789abcdef",
      EMAIL_API_KEY: "test-email-key"
    };

    // Create topics
    await createTopic(db, { name: "billing.events", description: "Billing alerts" });
    await createTopic(db, { name: "security.critical", description: "Security alerts" });
    await createTopic(db, { name: "disabled.topic", description: "Disabled topic" });
    await db.prepare("UPDATE topics SET enabled = 0 WHERE name = 'disabled.topic'").run();

    // Create source permitted ONLY to billing.events
    const source = await createSource(db, {
      name: "billing-service",
      allowed_topics: ["billing.events"]
    });
    sourceAuthHeader = `Bearer ${source.token}`;

    // Create admin user and session
    const { hash, salt, iterations } = await hashPassword("admin-secure-pass-123", null, 100000);
    await db.prepare(`
      INSERT INTO admin_users (username, salt, password_hash, iterations, enabled)
      VALUES (?, ?, ?, ?, 1)
    `).bind("root_admin", salt, hash, iterations).run();

    // Sign in admin
    const loginReq = new Request("http://localhost/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "root_admin", password: "admin-secure-pass-123" })
    });
    const loginRes = await handleRequest(loginReq, env);
    const loginData = await loginRes.json();
    adminAuthHeader = `Bearer ${loginData.token}`;
  });

  it("should prevent a source from publishing to an unauthorized topic", async () => {
    const req = new Request("http://localhost/v1/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": sourceAuthHeader
      },
      body: JSON.stringify({
        topic: "security.critical",
        title: "Unauthorized publish attempt",
        message: "This should be forbidden",
        severity: "error"
      })
    });

    const res = await handleRequest(req, env);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("not authorized to publish");
  });

  it("should reject notifications to a disabled topic", async () => {
    // Add permission for disabled.topic
    await db.prepare("INSERT INTO source_topics (source_id, topic_name) VALUES (1, 'disabled.topic')").run();

    const req = new Request("http://localhost/v1/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": sourceAuthHeader
      },
      body: JSON.stringify({
        topic: "disabled.topic",
        title: "Alert to disabled topic",
        message: "Message",
        severity: "warning"
      })
    });

    const res = await handleRequest(req, env);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("disabled");
  });

  it("should reject source credentials from accessing administrative routes", async () => {
    const req = new Request("http://localhost/v1/admin/overview", {
      method: "GET",
      headers: { "Authorization": sourceAuthHeader }
    });

    const res = await handleRequest(req, env);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain("Invalid or expired session");
  });

  it("should reject administrator session tokens from submitting notifications as a source", async () => {
    const req = new Request("http://localhost/v1/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": adminAuthHeader
      },
      body: JSON.stringify({
        topic: "billing.events",
        title: "Test",
        message: "Test message",
        severity: "info"
      })
    });

    const res = await handleRequest(req, env);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain("Invalid source credential");
  });

  it("should never return destination secrets or ciphertext in API responses", async () => {
    // Create destination with secret
    await createDestination(
      db,
      {
        name: "test-telegram-dest",
        type: "telegram",
        config: { chat_id: "12345678" },
        secret: "super-confidential-bot-token-987654321"
      },
      env.DESTINATION_ENCRYPTION_KEY
    );

    const req = new Request("http://localhost/v1/admin/destinations", {
      method: "GET",
      headers: { "Authorization": adminAuthHeader }
    });

    const res = await handleRequest(req, env);
    expect(res.status).toBe(200);
    const json = await res.json();
    const dest = json.items.find(d => d.name === "test-telegram-dest");
    expect(dest).toBeDefined();

    // Verify secret properties
    expect(dest.secret).toBeUndefined();
    expect(dest.secret_ciphertext).toBeUndefined();
    expect(dest.has_secret).toBe(true);

    const bodyString = JSON.stringify(json);
    expect(bodyString).not.toContain("super-confidential-bot-token-987654321");
  });
});
