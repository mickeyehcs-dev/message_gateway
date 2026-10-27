import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createTestDatabase } from "./helpers/test-db.js";
import { createSource, createTopic, createDestination, createGroup, addGroupMember, createSubscription } from "../src/services/admin.js";
import { handleRequest } from "../src/router.js";

describe("Routing Engine & Subscriptions", () => {
  let db;
  let env;
  let sourceAuthHeader;
  let topicId;
  let dest1;
  let dest2;

  beforeEach(async () => {
    db = createTestDatabase();
    env = {
      DB: db,
      DESTINATION_ENCRYPTION_KEY: "master-test-key-0123456789abcdef",
      EMAIL_API_KEY: "test-email-key"
    };

    // Global fetch mock
    vi.stubGlobal("fetch", vi.fn(async (url, opts) => {
      return new Response(JSON.stringify({ ok: true, message: "delivered" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }));

    // Setup topic
    const topic = await createTopic(db, { name: "infra.alerts", description: "Infra alerts" });
    topicId = topic.id;

    // Setup source
    const source = await createSource(db, { name: "monitoring-daemon", allowed_topics: ["infra.alerts"] });
    sourceAuthHeader = `Bearer ${source.token}`;

    // Setup destinations
    dest1 = await createDestination(db, {
      name: "infra-email",
      type: "email",
      config: { to: "infra@example.com", sender_id: "snd_test" },
      secret: "email-key"
    }, env.DESTINATION_ENCRYPTION_KEY);

    dest2 = await createDestination(db, {
      name: "infra-telegram",
      type: "telegram",
      config: { chat_id: "98765432" },
      secret: "bot-token-xyz"
    }, env.DESTINATION_ENCRYPTION_KEY);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should deliver notification to an individually subscribed destination", async () => {
    await createSubscription(db, {
      topic_id: topicId,
      destination_id: dest1.id
    });

    const req = new Request("http://localhost/v1/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": sourceAuthHeader },
      body: JSON.stringify({
        topic: "infra.alerts",
        title: "CPU High",
        message: "Server load is 98%",
        severity: "warning"
      })
    });

    const res = await handleRequest(req, env);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.status).toBe("processed");
    expect(data.stats.successful).toBe(1);
    expect(data.deliveries[0].destination_name).toBe("infra-email");
  });

  it("should expand recipient groups and deliver to all active group members", async () => {
    const group = await createGroup(db, { name: "oncall-infra", description: "On-call engineers" });
    await addGroupMember(db, group.id, dest1.id);
    await addGroupMember(db, group.id, dest2.id);

    // Subscribe group to topic
    await createSubscription(db, {
      topic_id: topicId,
      group_id: group.id
    });

    const req = new Request("http://localhost/v1/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": sourceAuthHeader },
      body: JSON.stringify({
        topic: "infra.alerts",
        title: "Disk Failure",
        message: "RAID degraded",
        severity: "error"
      })
    });

    const res = await handleRequest(req, env);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.stats.successful).toBe(2);
    expect(data.deliveries.length).toBe(2);
  });

  it("should deduplicate destinations if subscribed both individually and via groups", async () => {
    const group = await createGroup(db, { name: "devops-team" });
    await addGroupMember(db, group.id, dest1.id);

    // Subscribe both individually and via group
    await createSubscription(db, { topic_id: topicId, destination_id: dest1.id });
    await createSubscription(db, { topic_id: topicId, group_id: group.id });

    const req = new Request("http://localhost/v1/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": sourceAuthHeader },
      body: JSON.stringify({
        topic: "infra.alerts",
        title: "Memory leak",
        message: "High swap usage",
        severity: "warning"
      })
    });

    const res = await handleRequest(req, env);
    const data = await res.json();
    expect(data.ok).toBe(true);
    // Destination 1 must be sent to exactly once!
    expect(data.stats.total).toBe(1);
    expect(data.deliveries.length).toBe(1);
  });

  it("should report no_subscribers and ok: false when topic has no subscribers", async () => {
    const req = new Request("http://localhost/v1/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": sourceAuthHeader },
      body: JSON.stringify({
        topic: "infra.alerts",
        title: "Unlistened alert",
        message: "Nobody is listening",
        severity: "info"
      })
    });

    const res = await handleRequest(req, env);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.status).toBe("no_subscribers");
    expect(data.stats.total).toBe(0);
  });

  it("should correctly record partial provider failures", async () => {
    await createSubscription(db, { topic_id: topicId, destination_id: dest1.id });
    await createSubscription(db, { topic_id: topicId, destination_id: dest2.id });

    // Mock fetch so destination 2 fails
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      if (url.includes("telegram")) {
        return new Response(JSON.stringify({ ok: false, description: "Chat not found" }), { status: 400 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }));

    const req = new Request("http://localhost/v1/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": sourceAuthHeader },
      body: JSON.stringify({
        topic: "infra.alerts",
        title: "Partial failure test",
        message: "Testing partial results",
        severity: "warning"
      })
    });

    const res = await handleRequest(req, env);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.status).toBe("partial_failure");
    expect(data.stats.successful).toBe(1);
    expect(data.stats.failed).toBe(1);
  });

  it("should support idempotent replay without duplicate provider dispatch", async () => {
    await createSubscription(db, { topic_id: topicId, destination_id: dest1.id });
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const makeRequest = () => new Request("http://localhost/v1/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": sourceAuthHeader,
        "Idempotency-Key": "unique-event-key-42"
      },
      body: JSON.stringify({
        topic: "infra.alerts",
        title: "Idempotent ping",
        message: "First try",
        severity: "info"
      })
    });

    // First request
    const res1 = await handleRequest(makeRequest(), env);
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.event_id).toBeDefined();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Second request with SAME idempotency key and SAME payload
    const res2 = await handleRequest(makeRequest(), env);
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.idempotent_replay).toBe(true);
    expect(data2.event_id).toBe(data1.event_id);
    // Provider fetch must NOT be called a second time
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("should reject reuse of an idempotency key with a conflicting payload (HTTP 409)", async () => {
    await createSubscription(db, { topic_id: topicId, destination_id: dest1.id });

    // Request 1
    const req1 = new Request("http://localhost/v1/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": sourceAuthHeader,
        "Idempotency-Key": "same-key-100"
      },
      body: JSON.stringify({
        topic: "infra.alerts",
        title: "Original payload",
        message: "Original message",
        severity: "info"
      })
    });
    const res1 = await handleRequest(req1, env);
    expect(res1.status).toBe(200);

    // Request 2 with SAME key but DIFFERENT payload
    const req2 = new Request("http://localhost/v1/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": sourceAuthHeader,
        "Idempotency-Key": "same-key-100"
      },
      body: JSON.stringify({
        topic: "infra.alerts",
        title: "Conflicting payload",
        message: "Different message text",
        severity: "warning"
      })
    });
    const res2 = await handleRequest(req2, env);
    expect(res2.status).toBe(409);
    const data2 = await res2.json();
    expect(data2.error).toContain("Idempotency key already used with a different notification payload");
  });
});
