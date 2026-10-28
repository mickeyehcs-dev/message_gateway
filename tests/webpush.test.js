import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createTestDatabase } from "./helpers/test-db.js";
import { handleRequest } from "../src/router.js";
import { createTopic, createSource } from "../src/services/admin.js";

describe("Web Push Notifications & Subscription API", () => {
  let db;
  let env;
  let clientKeyPair;
  let rawClientPub;
  let clientAuth;
  let toB64Url;

  beforeEach(async () => {
    db = createTestDatabase();
    env = {
      DB: db,
      DESTINATION_ENCRYPTION_KEY: "test-encryption-key-0123456789abcdef",
      VAPID_SUBJECT: "mailto:test@example.com"
    };

    clientKeyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"]
    );
    rawClientPub = await crypto.subtle.exportKey("raw", clientKeyPair.publicKey);
    toB64Url = (buf) => Buffer.from(buf).toString("base64url");
    clientAuth = crypto.getRandomValues(new Uint8Array(16));

    // Mock external push service (e.g. Google FCM)
    vi.stubGlobal("fetch", vi.fn(async (url, opts) => {
      return new Response("OK", { status: 201 });
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should serve the browser Service Worker script on GET /sw.js", async () => {
    const req = new Request("http://localhost/sw.js", { method: "GET" });
    const res = await handleRequest(req, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/javascript");
    expect(res.headers.get("Service-Worker-Allowed")).toBe("/");
    const text = await res.text();
    expect(text).toContain("self.addEventListener('push'");
    expect(text).toContain("self.addEventListener('notificationclick'");
  });

  it("should return the VAPID public key on GET /v1/webpush/vapid-public-key", async () => {
    const req = new Request("http://localhost/v1/webpush/vapid-public-key", { method: "GET" });
    const res = await handleRequest(req, env);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(typeof data.publicKey).toBe("string");
    expect(data.publicKey.length).toBeGreaterThan(40);
  });

  it("should list active topics for Web Push subscription on GET /v1/webpush/topics", async () => {
    await createTopic(db, {
      name: "system.alerts",
      description: "Critical system notifications",
      webpush_config: {
        webpush_enabled: true,
        click_url: "/admin#events",
        icon: "https://example.com/icon.png"
      }
    });

    const req = new Request("http://localhost/v1/webpush/topics", { method: "GET" });
    const res = await handleRequest(req, env);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.topics)).toBe(true);
    const topic = data.topics.find(t => t.name === "system.alerts");
    expect(topic).toBeDefined();
    expect(topic.webpush_config.click_url).toBe("/admin#events");
    expect(topic.webpush_config.icon).toBe("https://example.com/icon.png");
  });

  it("should subscribe a browser to a topic from the login page", async () => {
    await createTopic(db, {
      name: "devops.incidents",
      description: "Live DevOps alert channel",
      webpush_config: {
        webpush_enabled: true,
        click_url: "https://example.com/incidents"
      }
    });

    const subPayload = {
      topic: "devops.incidents",
      device_name: "MacBook Pro Chrome",
      subscription: {
        endpoint: "https://fcm.googleapis.com/fcm/send/client-token-987",
        keys: {
          p256dh: toB64Url(rawClientPub),
          auth: toB64Url(clientAuth)
        }
      }
    };

    const req = new Request("http://localhost/v1/webpush/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subPayload)
    });

    const res = await handleRequest(req, env);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.topic).toBe("devops.incidents");
    expect(data.destination_id).toBeGreaterThan(0);

    // Verify subscription status
    const statusReq = new Request("http://localhost/v1/webpush/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: "https://fcm.googleapis.com/fcm/send/client-token-987",
        topic: "devops.incidents"
      })
    });
    const statusRes = await handleRequest(statusReq, env);
    const statusData = await statusRes.json();
    expect(statusData.subscribed).toBe(true);
    expect(statusData.topics).toContain("devops.incidents");
  });

  it("should send an instant test push notification to a subscriber", async () => {
    const testReq = new Request("http://localhost/v1/webpush/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: {
          endpoint: "https://fcm.googleapis.com/fcm/send/test-direct",
          keys: {
            p256dh: toB64Url(rawClientPub),
            auth: toB64Url(clientAuth)
          }
        },
        topic: "infra.alerts",
        title: "Test Alert",
        message: "Hello from gateway test"
      })
    });

    const testRes = await handleRequest(testReq, env);
    expect(testRes.status).toBe(200);
    const testData = await testRes.json();
    expect(testData.ok).toBe(true);
  });

  it("should unsubscribe a client endpoint from a topic", async () => {
    await createTopic(db, { name: "infra.alerts", description: "Infra alerts" });

    // Subscribe
    const subReq = new Request("http://localhost/v1/webpush/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: "infra.alerts",
        subscription: {
          endpoint: "https://fcm.googleapis.com/fcm/send/unsub-target",
          keys: {
            p256dh: toB64Url(rawClientPub),
            auth: toB64Url(clientAuth)
          }
        }
      })
    });
    await handleRequest(subReq, env);

    // Unsubscribe
    const unsubReq = new Request("http://localhost/v1/webpush/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: "infra.alerts",
        endpoint: "https://fcm.googleapis.com/fcm/send/unsub-target"
      })
    });
    const unsubRes = await handleRequest(unsubReq, env);
    expect(unsubRes.status).toBe(200);
    const unsubData = await unsubRes.json();
    expect(unsubData.ok).toBe(true);

    // Verify unsubscribed
    const statusReq = new Request("http://localhost/v1/webpush/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: "https://fcm.googleapis.com/fcm/send/unsub-target",
        topic: "infra.alerts"
      })
    });
    const statusRes = await handleRequest(statusReq, env);
    const statusData = await statusRes.json();
    expect(statusData.subscribed).toBe(false);
  });

  it("should route notifications ingested via /v1/notify to subscribed Web Push clients", async () => {
    // 1. Setup topic
    await createTopic(db, {
      name: "prod.errors",
      description: "Production error events",
      webpush_config: {
        webpush_enabled: true,
        click_url: "/admin#events",
        icon: "/icons/error.png"
      }
    });

    // 2. Setup source
    const source = await createSource(db, {
      name: "api-backend",
      allowed_topics: ["prod.errors"]
    });

    // 3. Client subscribes via Web Push
    const subReq = new Request("http://localhost/v1/webpush/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: "prod.errors",
        device_name: "Operations Dashboard Chrome",
        subscription: {
          endpoint: "https://fcm.googleapis.com/fcm/send/prod-error-client",
          keys: {
            p256dh: toB64Url(rawClientPub),
            auth: toB64Url(clientAuth)
          }
        }
      })
    });
    const subRes = await handleRequest(subReq, env);
    expect(subRes.status).toBe(200);

    // 4. Source publishes notification to /v1/notify
    const notifyReq = new Request("http://localhost/v1/notify", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${source.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        topic: "prod.errors",
        title: "HTTP 500 Spike Detected",
        message: "Payment service error rate exceeded 5% threshold",
        severity: "critical",
        metadata: {
          service: "billing-api",
          url: "https://dashboard.example.com/incidents/inc-4091"
        }
      })
    });

    const notifyRes = await handleRequest(notifyReq, env);
    expect(notifyRes.status).toBe(200);
    const notifyData = await notifyRes.json();
    expect(notifyData.ok).toBe(true);
    expect(notifyData.stats.successful).toBe(1);
    expect(notifyData.deliveries[0].provider).toBe("webpush");
    expect(notifyData.deliveries[0].status).toBe("success");
  });
});
