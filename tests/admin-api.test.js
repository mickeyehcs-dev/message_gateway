import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createTestDatabase } from "./helpers/test-db.js";
import { hashPassword } from "../src/security/crypto.js";
import { handleRequest } from "../src/router.js";

describe("Administrative API Endpoints", () => {
  let db;
  let env;
  let adminAuthHeader;

  beforeEach(async () => {
    db = createTestDatabase();
    env = {
      DB: db,
      DESTINATION_ENCRYPTION_KEY: "admin-suite-test-key-0123456789abcdef"
    };

    // Create admin user
    const { hash, salt, iterations } = await hashPassword("admin-super-pass", null, 100000);
    await db.prepare(`
      INSERT INTO admin_users (username, salt, password_hash, iterations, enabled)
      VALUES (?, ?, ?, ?, 1)
    `).bind("admin_operator", salt, hash, iterations).run();

    // Login
    const loginReq = new Request("http://localhost/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin_operator", password: "admin-super-pass" })
    });
    const loginRes = await handleRequest(loginReq, env);
    const loginData = await loginRes.json();
    adminAuthHeader = `Bearer ${loginData.token}`;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should render the admin dashboard HTML on GET / and GET /admin", async () => {
    const resRoot = await handleRequest(new Request("http://localhost/", { method: "GET" }), env);
    expect(resRoot.status).toBe(200);
    expect(resRoot.headers.get("Content-Type")).toContain("text/html");
    const htmlRoot = await resRoot.text();
    expect(htmlRoot).toContain("Notification Gateway");
    expect(htmlRoot).toContain("Universal Notification Gateway");

    const resAdmin = await handleRequest(new Request("http://localhost/admin", { method: "GET" }), env);
    expect(resAdmin.status).toBe(200);
  });

  it("should return system overview metrics", async () => {
    const req = new Request("http://localhost/v1/admin/overview", {
      method: "GET",
      headers: { "Authorization": adminAuthHeader }
    });
    const res = await handleRequest(req, env);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.data.metrics).toBeDefined();
    expect(data.data.metrics.totalSources).toBe(0);
  });

  it("should perform complete CRUD on topics", async () => {
    // Create topic
    const createReq = new Request("http://localhost/v1/admin/topics", {
      method: "POST",
      headers: { "Authorization": adminAuthHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "app.billing", description: "Invoices and payments" })
    });
    const createRes = await handleRequest(createReq, env);
    expect(createRes.status).toBe(201);
    const createData = await createRes.json();
    const topicId = createData.item.id;
    expect(topicId).toBeDefined();

    // List topics
    const listReq = new Request("http://localhost/v1/admin/topics", {
      method: "GET",
      headers: { "Authorization": adminAuthHeader }
    });
    const listRes = await handleRequest(listReq, env);
    const listData = await listRes.json();
    expect(listData.items.some(t => t.name === "app.billing")).toBe(true);

    // Update topic
    const updateReq = new Request(`http://localhost/v1/admin/topics/${topicId}`, {
      method: "PATCH",
      headers: { "Authorization": adminAuthHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ description: "Updated description", enabled: 0 })
    });
    const updateRes = await handleRequest(updateReq, env);
    expect(updateRes.status).toBe(200);

    // Delete topic
    const deleteReq = new Request(`http://localhost/v1/admin/topics/${topicId}`, {
      method: "DELETE",
      headers: { "Authorization": adminAuthHeader }
    });
    const deleteRes = await handleRequest(deleteReq, env);
    expect(deleteRes.status).toBe(200);
  });

  it("should perform complete CRUD and key rotation on sources", async () => {
    // Create topic first
    await db.prepare("INSERT INTO topics (name, description, enabled) VALUES ('metrics.health', 'Health', 1)").run();

    // Create source
    const createReq = new Request("http://localhost/v1/admin/sources", {
      method: "POST",
      headers: { "Authorization": adminAuthHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "k8s-cluster",
        allowed_topics: ["metrics.health"],
        rate_limit_per_minute: 120
      })
    });
    const createRes = await handleRequest(createReq, env);
    expect(createRes.status).toBe(201);
    const createData = await createRes.json();
    const sourceId = createData.item.id;
    const initialToken = createData.item.token;
    expect(initialToken).toBeDefined();

    // Rotate source key
    const rotateReq = new Request(`http://localhost/v1/admin/sources/${sourceId}/rotate-key`, {
      method: "POST",
      headers: { "Authorization": adminAuthHeader }
    });
    const rotateRes = await handleRequest(rotateReq, env);
    expect(rotateRes.status).toBe(200);
    const rotateData = await rotateRes.json();
    const rotatedToken = rotateData.item.token;
    expect(rotatedToken).toBeDefined();
    expect(rotatedToken).not.toBe(initialToken);

    // Update source
    const updateReq = new Request(`http://localhost/v1/admin/sources/${sourceId}`, {
      method: "PATCH",
      headers: { "Authorization": adminAuthHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ rate_limit_per_minute: 200 })
    });
    const updateRes = await handleRequest(updateReq, env);
    expect(updateRes.status).toBe(200);

    // Delete source
    const deleteReq = new Request(`http://localhost/v1/admin/sources/${sourceId}`, {
      method: "DELETE",
      headers: { "Authorization": adminAuthHeader }
    });
    const deleteRes = await handleRequest(deleteReq, env);
    expect(deleteRes.status).toBe(200);
  });

  it("should perform CRUD and test call on destinations", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("OK", { status: 200 })));

    const clientKeyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"]
    );
    const rawClientPub = await crypto.subtle.exportKey("raw", clientKeyPair.publicKey);
    const toB64Url = (buf) => Buffer.from(buf).toString("base64url");
    const clientAuth = crypto.getRandomValues(new Uint8Array(16));

    // Create destination
    const createReq = new Request("http://localhost/v1/admin/destinations", {
      method: "POST",
      headers: { "Authorization": adminAuthHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "test-webpush-alerts",
        type: "webpush",
        config: {
          endpoint: "https://fcm.googleapis.com/fcm/send/test-sub-123",
          keys: {
            p256dh: toB64Url(rawClientPub),
            auth: toB64Url(clientAuth)
          },
          click_url: "/admin#events"
        }
      })
    });
    const createRes = await handleRequest(createReq, env);
    expect(createRes.status).toBe(201);
    const createData = await createRes.json();
    const destId = createData.item.id;

    // Test destination endpoint
    const testReq = new Request(`http://localhost/v1/admin/destinations/${destId}/test`, {
      method: "POST",
      headers: { "Authorization": adminAuthHeader }
    });
    const testRes = await handleRequest(testReq, env);
    expect(testRes.status).toBe(200);
    const testData = await testRes.json();
    expect(testData.ok).toBe(true);

    // Delete destination
    const deleteReq = new Request(`http://localhost/v1/admin/destinations/${destId}`, {
      method: "DELETE",
      headers: { "Authorization": adminAuthHeader }
    });
    const deleteRes = await handleRequest(deleteReq, env);
    expect(deleteRes.status).toBe(200);
  });

  it("should perform CRUD on recipient groups and members", async () => {
    // Create destination
    const destRes = await db.prepare("INSERT INTO destinations (name, type, config_json, enabled) VALUES ('d1', 'email', '{}', 1)").run();
    const destId = destRes.meta.last_row_id;

    // Create group
    const createGroupReq = new Request("http://localhost/v1/admin/groups", {
      method: "POST",
      headers: { "Authorization": adminAuthHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "tier-1-support", description: "First responders" })
    });
    const createGroupRes = await handleRequest(createGroupReq, env);
    expect(createGroupRes.status).toBe(201);
    const groupData = await createGroupRes.json();
    const groupId = groupData.item.id;

    // Add group member
    const addMemberReq = new Request(`http://localhost/v1/admin/groups/${groupId}/members`, {
      method: "POST",
      headers: { "Authorization": adminAuthHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ destination_id: destId })
    });
    const addMemberRes = await handleRequest(addMemberReq, env);
    expect(addMemberRes.status).toBe(200);

    // Remove group member
    const removeMemberReq = new Request(`http://localhost/v1/admin/groups/${groupId}/members/${destId}`, {
      method: "DELETE",
      headers: { "Authorization": adminAuthHeader }
    });
    const removeMemberRes = await handleRequest(removeMemberReq, env);
    expect(removeMemberRes.status).toBe(200);

    // Delete group
    const deleteGroupReq = new Request(`http://localhost/v1/admin/groups/${groupId}`, {
      method: "DELETE",
      headers: { "Authorization": adminAuthHeader }
    });
    const deleteGroupRes = await handleRequest(deleteGroupReq, env);
    expect(deleteGroupRes.status).toBe(200);
  });

  it("should query system diagnostics and trigger session cleanup", async () => {
    const diagReq = new Request("http://localhost/v1/admin/settings", {
      method: "GET",
      headers: { "Authorization": adminAuthHeader }
    });
    const diagRes = await handleRequest(diagReq, env);
    expect(diagRes.status).toBe(200);
    const diagData = await diagRes.json();
    expect(diagData.data.runtime).toBe("Cloudflare Workers");
    expect(diagData.data.config.has_encryption_key).toBe(true);

    const cleanupReq = new Request("http://localhost/v1/admin/cleanup-sessions", {
      method: "POST",
      headers: { "Authorization": adminAuthHeader }
    });
    const cleanupRes = await handleRequest(cleanupReq, env);
    expect(cleanupRes.status).toBe(200);
    const cleanupData = await cleanupRes.json();
    expect(cleanupData.ok).toBe(true);
  });
});
