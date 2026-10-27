import { describe, it, expect, beforeEach } from "vitest";
import { createTestDatabase } from "./helpers/test-db.js";
import { createSource, createTopic } from "../src/services/admin.js";
import { handleRequest } from "../src/router.js";
import { normalizeTopic, escapeHtml } from "../src/security/validation.js";

describe("Validation and Edge Cases", () => {
  let db;
  let env;
  let sourceAuthHeader;

  beforeEach(async () => {
    db = createTestDatabase();
    env = {
      DB: db,
      DESTINATION_ENCRYPTION_KEY: "validation-key-0123456789abcdef"
    };

    await createTopic(db, { name: "sys.logs" });
    const source = await createSource(db, { name: "test-app", allowed_topics: ["sys.logs"] });
    sourceAuthHeader = `Bearer ${source.token}`;
  });

  it("should normalize topic names to lowercase and strip whitespace", () => {
    expect(normalizeTopic("  SYS.LOGS  ")).toBe("sys.logs");
    expect(normalizeTopic("api:v1.status_update")).toBe("api:v1.status_update");
  });

  it("should reject invalid topic names", () => {
    expect(normalizeTopic("")).toBeNull();
    expect(normalizeTopic("topic with spaces")).toBeNull();
    expect(normalizeTopic("topic/with/slashes")).toBeNull();
    expect(normalizeTopic(".invalid_start")).toBeNull();
  });

  it("should properly escape HTML characters to prevent XSS injection", () => {
    const raw = '<script>alert("xss")</script>&foo=\'bar\'';
    const escaped = escapeHtml(raw);
    expect(escaped).not.toContain("<script>");
    expect(escaped).toContain("&lt;script&gt;");
    expect(escaped).toContain("&amp;foo=");
    expect(escaped).toContain("&#039;bar&#039;");
  });

  it("should return HTTP 400 when notification request has malformed JSON", async () => {
    const req = new Request("http://localhost/v1/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": sourceAuthHeader
      },
      body: "{ broken json: 123"
    });

    const res = await handleRequest(req, env);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid JSON");
  });

  it("should return HTTP 400 when missing required message field", async () => {
    const req = new Request("http://localhost/v1/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": sourceAuthHeader
      },
      body: JSON.stringify({
        topic: "sys.logs",
        title: "No message"
      })
    });

    const res = await handleRequest(req, env);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("required 'message' field");
  });

  it("should return HTTP 400 when payload exceeds maximum size limit (64KB)", async () => {
    const hugeMessage = "X".repeat(70 * 1024); // 70 KB
    const req = new Request("http://localhost/v1/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": sourceAuthHeader
      },
      body: JSON.stringify({
        topic: "sys.logs",
        message: hugeMessage
      })
    });

    const res = await handleRequest(req, env);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("exceeds maximum size");
  });

  it("should include security headers on all responses", async () => {
    const req = new Request("http://localhost/health", { method: "GET" });
    const res = await handleRequest(req, env);

    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
  });
});
