/**
 * Administrator service handling CRUD for sources, topics, destinations,
 * groups, subscriptions, events, and audit logs.
 */

import { generateSecureToken, sha256, encryptSecret } from "../security/crypto.js";
import { normalizeTopic, isValidSeverity, isValidEmail } from "../security/validation.js";
import { getProvider } from "../providers/index.js";
import { queryFirst, queryAll, execute } from "../db/index.js";
import { sanitizeLogString } from "../security/redaction.js";

/**
 * System Overview and Dashboard Metrics
 */
export async function getAdminOverview(db) {
  const [sourcesCount, topicsCount, destinationsCount, eventsCount, successDeliveries, failedDeliveries] = await Promise.all([
    queryFirst(db, "SELECT COUNT(*) as count FROM sources"),
    queryFirst(db, "SELECT COUNT(*) as count FROM topics WHERE enabled = 1"),
    queryFirst(db, "SELECT COUNT(*) as count FROM destinations WHERE enabled = 1"),
    queryFirst(db, "SELECT COUNT(*) as count FROM events"),
    queryFirst(db, "SELECT COUNT(*) as count FROM delivery_logs WHERE status = 'success'"),
    queryFirst(db, "SELECT COUNT(*) as count FROM delivery_logs WHERE status = 'failed'")
  ]);

  const recentEvents = await queryAll(
    db,
    `
    SELECT e.id, e.topic, e.title, e.severity, e.status, e.created_at, s.name as source_name
    FROM events e
    LEFT JOIN sources s ON s.id = e.source_id
    ORDER BY e.id DESC
    LIMIT 10
    `
  );

  const failureSummaries = await queryAll(
    db,
    `
    SELECT dl.destination_id, d.name AS destination_name, d.type AS provider_type,
           COUNT(*) as failure_count, MAX(dl.created_at) as last_failure_at,
           dl.error_message
    FROM delivery_logs dl
    JOIN destinations d ON d.id = dl.destination_id
    WHERE dl.status = 'failed'
    GROUP BY dl.destination_id
    ORDER BY failure_count DESC
    LIMIT 5
    `
  );

  return {
    metrics: {
      totalSources: sourcesCount?.count || 0,
      activeTopics: topicsCount?.count || 0,
      activeDestinations: destinationsCount?.count || 0,
      totalEvents: eventsCount?.count || 0,
      successfulDeliveries: successDeliveries?.count || 0,
      failedDeliveries: failedDeliveries?.count || 0
    },
    recentEvents,
    failureSummaries
  };
}

/**
 * Sources Management
 */
export async function listSources(db) {
  const sources = await queryAll(
    db,
    `
    SELECT s.id, s.name, s.enabled, s.rate_limit_per_minute, s.created_at, s.last_used_at,
           (SELECT COUNT(*) FROM events WHERE source_id = s.id) as events_count
    FROM sources s
    ORDER BY s.id DESC
    `
  );

  // Fetch allowed topics for each source
  const sourceTopics = await queryAll(db, "SELECT source_id, topic_name FROM source_topics");
  const topicsMap = new Map();
  for (const st of sourceTopics) {
    if (!topicsMap.has(st.source_id)) topicsMap.set(st.source_id, []);
    topicsMap.get(st.source_id).push(st.topic_name);
  }

  return sources.map(s => ({
    ...s,
    allowed_topics: topicsMap.get(s.id) || []
  }));
}

export async function createSource(db, data) {
  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name || name.length > 100) {
    throw new Error("Source name is required (1-100 characters)");
  }

  const existing = await queryFirst(db, "SELECT id FROM sources WHERE name = ?", [name]);
  if (existing) {
    throw new Error(`A source named '${name}' already exists`);
  }

  const allowedTopics = Array.isArray(data.allowed_topics) ? data.allowed_topics : [];
  if (allowedTopics.length === 0) {
    throw new Error("At least one allowed topic must be assigned to the source");
  }

  const rawToken = generateSecureToken("src_", 32);
  const tokenHash = await sha256(rawToken);
  const rateLimit = Number.isInteger(data.rate_limit_per_minute) && data.rate_limit_per_minute > 0 ? data.rate_limit_per_minute : 60;

  const result = await execute(
    db,
    "INSERT INTO sources (name, token_hash, enabled, rate_limit_per_minute, created_at) VALUES (?, ?, 1, ?, datetime('now'))",
    [name, tokenHash, rateLimit]
  );

  const sourceId = result.lastRowId;

  // Insert topic permissions
  for (const topic of allowedTopics) {
    const norm = normalizeTopic(topic);
    if (norm) {
      await execute(
        db,
        "INSERT INTO source_topics (source_id, topic_name, created_at) VALUES (?, ?, datetime('now')) ON CONFLICT DO NOTHING",
        [sourceId, norm]
      );
    }
  }

  return {
    id: sourceId,
    name,
    token: rawToken, // Returned ONLY upon initial creation
    allowed_topics: allowedTopics,
    rate_limit_per_minute: rateLimit
  };
}

export async function rotateSourceKey(db, sourceId) {
  const source = await queryFirst(db, "SELECT id, name FROM sources WHERE id = ?", [sourceId]);
  if (!source) throw new Error("Source not found");

  const rawToken = generateSecureToken("src_", 32);
  const tokenHash = await sha256(rawToken);

  await execute(
    db,
    "UPDATE sources SET token_hash = ? WHERE id = ?",
    [tokenHash, sourceId]
  );

  return {
    id: source.id,
    name: source.name,
    token: rawToken // Returned ONLY once upon rotation
  };
}

export async function updateSource(db, sourceId, data) {
  const source = await queryFirst(db, "SELECT id, name FROM sources WHERE id = ?", [sourceId]);
  if (!source) throw new Error("Source not found");

  if (typeof data.name === "string" && data.name.trim()) {
    await execute(db, "UPDATE sources SET name = ? WHERE id = ?", [data.name.trim(), sourceId]);
  }

  if (typeof data.enabled === "boolean" || data.enabled === 0 || data.enabled === 1) {
    await execute(db, "UPDATE sources SET enabled = ? WHERE id = ?", [data.enabled ? 1 : 0, sourceId]);
  }

  if (Number.isInteger(data.rate_limit_per_minute) && data.rate_limit_per_minute > 0) {
    await execute(db, "UPDATE sources SET rate_limit_per_minute = ? WHERE id = ?", [data.rate_limit_per_minute, sourceId]);
  }

  if (Array.isArray(data.allowed_topics)) {
    await execute(db, "DELETE FROM source_topics WHERE source_id = ?", [sourceId]);
    for (const topic of data.allowed_topics) {
      const norm = normalizeTopic(topic);
      if (norm) {
        await execute(
          db,
          "INSERT INTO source_topics (source_id, topic_name, created_at) VALUES (?, ?, datetime('now')) ON CONFLICT DO NOTHING",
          [sourceId, norm]
        );
      }
    }
  }

  return { success: true };
}

export async function deleteSource(db, sourceId) {
  const res = await execute(db, "DELETE FROM sources WHERE id = ?", [sourceId]);
  if (res.changes === 0) throw new Error("Source not found");
  return { success: true };
}

/**
 * Topics Management
 */
export async function listTopics(db) {
  return await queryAll(
    db,
    `
    SELECT t.id, t.name, t.description, t.enabled, t.created_at,
           (SELECT COUNT(*) FROM source_topics WHERE topic_name = t.name) as sources_count,
           (SELECT COUNT(*) FROM subscriptions WHERE topic_id = t.id AND enabled = 1) as subscriptions_count
    FROM topics t
    ORDER BY t.name ASC
    `
  );
}

export async function createTopic(db, data) {
  const name = normalizeTopic(data.name);
  if (!name) {
    throw new Error("Invalid topic identifier. Topics must be lowercase alphanumeric with ., _, -, or : (1-100 characters)");
  }

  const existing = await queryFirst(db, "SELECT id FROM topics WHERE name = ?", [name]);
  if (existing) {
    throw new Error(`Topic '${name}' already exists`);
  }

  const description = typeof data.description === "string" ? data.description.trim().slice(0, 500) : "";

  const res = await execute(
    db,
    "INSERT INTO topics (name, description, enabled, created_at) VALUES (?, ?, 1, datetime('now'))",
    [name, description]
  );

  return { id: res.lastRowId, name, description, enabled: 1 };
}

export async function updateTopic(db, topicId, data) {
  const topic = await queryFirst(db, "SELECT id FROM topics WHERE id = ?", [topicId]);
  if (!topic) throw new Error("Topic not found");

  if (typeof data.description === "string") {
    await execute(db, "UPDATE topics SET description = ? WHERE id = ?", [data.description.trim().slice(0, 500), topicId]);
  }

  if (typeof data.enabled === "boolean" || data.enabled === 0 || data.enabled === 1) {
    await execute(db, "UPDATE topics SET enabled = ? WHERE id = ?", [data.enabled ? 1 : 0, topicId]);
  }

  return { success: true };
}

export async function deleteTopic(db, topicId) {
  const res = await execute(db, "DELETE FROM topics WHERE id = ?", [topicId]);
  if (res.changes === 0) throw new Error("Topic not found");
  return { success: true };
}

/**
 * Destinations Management
 */
export async function listDestinations(db) {
  const destinations = await queryAll(
    db,
    `
    SELECT id, name, type, config_json, enabled, created_at, updated_at,
           (secret_ciphertext IS NOT NULL AND secret_ciphertext != '') as has_secret
    FROM destinations
    ORDER BY id DESC
    `
  );

  return destinations.map(d => {
    let cfg = {};
    try { cfg = JSON.parse(d.config_json); } catch {}
    return {
      id: d.id,
      name: d.name,
      type: d.type,
      config: cfg,
      has_secret: Boolean(d.has_secret),
      enabled: d.enabled,
      created_at: d.created_at,
      updated_at: d.updated_at
    };
  });
}

export async function createDestination(db, data, encryptionKey) {
  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name || name.length > 100) throw new Error("Destination name is required (1-100 characters)");

  const type = typeof data.type === "string" ? data.type.trim().toLowerCase() : "";
  if (!["email", "telegram", "ntfy"].includes(type)) {
    throw new Error("Destination type must be one of: email, telegram, ntfy");
  }

  const existing = await queryFirst(db, "SELECT id FROM destinations WHERE name = ?", [name]);
  if (existing) throw new Error(`A destination named '${name}' already exists`);

  const config = data.config && typeof data.config === "object" ? data.config : {};
  let secretCiphertext = null;

  if (data.secret && typeof data.secret === "string" && data.secret.trim()) {
    if (!encryptionKey) {
      throw new Error("DESTINATION_ENCRYPTION_KEY is required to securely encrypt destination secrets");
    }
    secretCiphertext = await encryptSecret(data.secret.trim(), encryptionKey);
  }

  const res = await execute(
    db,
    `
    INSERT INTO destinations (name, type, config_json, secret_ciphertext, enabled, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `,
    [name, type, JSON.stringify(config), secretCiphertext]
  );

  return { id: res.lastRowId, name, type, config, has_secret: Boolean(secretCiphertext), enabled: 1 };
}

export async function updateDestination(db, destinationId, data, encryptionKey) {
  const dest = await queryFirst(db, "SELECT id FROM destinations WHERE id = ?", [destinationId]);
  if (!dest) throw new Error("Destination not found");

  if (typeof data.name === "string" && data.name.trim()) {
    await execute(db, "UPDATE destinations SET name = ?, updated_at = datetime('now') WHERE id = ?", [data.name.trim(), destinationId]);
  }

  if (data.config && typeof data.config === "object") {
    await execute(db, "UPDATE destinations SET config_json = ?, updated_at = datetime('now') WHERE id = ?", [JSON.stringify(data.config), destinationId]);
  }

  if (typeof data.enabled === "boolean" || data.enabled === 0 || data.enabled === 1) {
    await execute(db, "UPDATE destinations SET enabled = ?, updated_at = datetime('now') WHERE id = ?", [data.enabled ? 1 : 0, destinationId]);
  }

  // If a new secret is supplied, re-encrypt and store
  if (data.secret && typeof data.secret === "string" && data.secret.trim()) {
    if (!encryptionKey) {
      throw new Error("DESTINATION_ENCRYPTION_KEY is required to securely encrypt destination secrets");
    }
    const encrypted = await encryptSecret(data.secret.trim(), encryptionKey);
    await execute(db, "UPDATE destinations SET secret_ciphertext = ?, updated_at = datetime('now') WHERE id = ?", [encrypted, destinationId]);
  }

  return { success: true };
}

export async function testDestination(db, destinationId, env) {
  const dest = await queryFirst(
    db,
    "SELECT id, name, type, config_json, secret_ciphertext, enabled FROM destinations WHERE id = ?",
    [destinationId]
  );

  if (!dest) throw new Error("Destination not found");

  const provider = getProvider(dest.type);
  if (!provider) throw new Error(`Unsupported provider: ${dest.type}`);

  return await provider.test(dest, env);
}

export async function deleteDestination(db, destinationId) {
  const res = await execute(db, "DELETE FROM destinations WHERE id = ?", [destinationId]);
  if (res.changes === 0) throw new Error("Destination not found");
  return { success: true };
}

/**
 * Recipient Groups Management
 */
export async function listGroups(db) {
  const groups = await queryAll(
    db,
    `
    SELECT id, name, description, enabled, created_at,
           (SELECT COUNT(*) FROM group_members WHERE group_id = recipient_groups.id AND enabled = 1) as members_count
    FROM recipient_groups
    ORDER BY name ASC
    `
  );

  const members = await queryAll(
    db,
    `
    SELECT gm.id as membership_id, gm.group_id, gm.destination_id, d.name as destination_name, d.type as destination_type, gm.enabled
    FROM group_members gm
    JOIN destinations d ON d.id = gm.destination_id
    `
  );

  const membersMap = new Map();
  for (const m of members) {
    if (!membersMap.has(m.group_id)) membersMap.set(m.group_id, []);
    membersMap.get(m.group_id).push(m);
  }

  return groups.map(g => ({
    ...g,
    members: membersMap.get(g.id) || []
  }));
}

export async function createGroup(db, data) {
  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name || name.length > 100) throw new Error("Group name is required (1-100 characters)");

  const existing = await queryFirst(db, "SELECT id FROM recipient_groups WHERE name = ?", [name]);
  if (existing) throw new Error(`A group named '${name}' already exists`);

  const description = typeof data.description === "string" ? data.description.trim().slice(0, 500) : "";

  const res = await execute(
    db,
    "INSERT INTO recipient_groups (name, description, enabled, created_at) VALUES (?, ?, 1, datetime('now'))",
    [name, description]
  );

  return { id: res.lastRowId, name, description, enabled: 1 };
}

export async function updateGroup(db, groupId, data) {
  const group = await queryFirst(db, "SELECT id FROM recipient_groups WHERE id = ?", [groupId]);
  if (!group) throw new Error("Group not found");

  if (typeof data.name === "string" && data.name.trim()) {
    await execute(db, "UPDATE recipient_groups SET name = ? WHERE id = ?", [data.name.trim(), groupId]);
  }

  if (typeof data.description === "string") {
    await execute(db, "UPDATE recipient_groups SET description = ? WHERE id = ?", [data.description.trim().slice(0, 500), groupId]);
  }

  if (typeof data.enabled === "boolean" || data.enabled === 0 || data.enabled === 1) {
    await execute(db, "UPDATE recipient_groups SET enabled = ? WHERE id = ?", [data.enabled ? 1 : 0, groupId]);
  }

  return { success: true };
}

export async function deleteGroup(db, groupId) {
  const res = await execute(db, "DELETE FROM recipient_groups WHERE id = ?", [groupId]);
  if (res.changes === 0) throw new Error("Group not found");
  return { success: true };
}

export async function addGroupMember(db, groupId, destinationId) {
  const group = await queryFirst(db, "SELECT id FROM recipient_groups WHERE id = ?", [groupId]);
  if (!group) throw new Error("Group not found");

  const dest = await queryFirst(db, "SELECT id FROM destinations WHERE id = ?", [destinationId]);
  if (!dest) throw new Error("Destination not found");

  await execute(
    db,
    `
    INSERT INTO group_members (group_id, destination_id, enabled, created_at)
    VALUES (?, ?, 1, datetime('now'))
    ON CONFLICT(group_id, destination_id) DO UPDATE SET enabled = 1
    `,
    [groupId, destinationId]
  );

  return { success: true };
}

export async function removeGroupMember(db, groupId, destinationId) {
  const res = await execute(
    db,
    "DELETE FROM group_members WHERE group_id = ? AND destination_id = ?",
    [groupId, destinationId]
  );
  if (res.changes === 0) throw new Error("Membership not found");
  return { success: true };
}

/**
 * Subscriptions Management
 */
export async function listSubscriptions(db) {
  return await queryAll(
    db,
    `
    SELECT s.id, s.topic_id, t.name as topic_name,
           s.source_id, src.name as source_name,
           s.severity,
           s.destination_id, d.name as destination_name, d.type as destination_type,
           s.group_id, g.name as group_name,
           s.enabled, s.created_at
    FROM subscriptions s
    JOIN topics t ON t.id = s.topic_id
    LEFT JOIN sources src ON src.id = s.source_id
    LEFT JOIN destinations d ON d.id = s.destination_id
    LEFT JOIN recipient_groups g ON g.id = s.group_id
    ORDER BY s.id DESC
    `
  );
}

export async function createSubscription(db, data) {
  let topicId = data.topic_id;
  if (!topicId && data.topic) {
    const norm = normalizeTopic(data.topic);
    const topic = await queryFirst(db, "SELECT id FROM topics WHERE name = ?", [norm]);
    if (!topic) throw new Error(`Topic '${data.topic}' does not exist`);
    topicId = topic.id;
  }

  if (!topicId) throw new Error("topic_id or valid topic name is required");

  const hasDest = Number.isInteger(data.destination_id);
  const hasGroup = Number.isInteger(data.group_id);
  if (hasDest === hasGroup) {
    throw new Error("Provide exactly one of destination_id or group_id");
  }

  let severity = null;
  if (data.severity) {
    severity = data.severity.toLowerCase().trim();
    if (!isValidSeverity(severity)) throw new Error("Invalid severity filter");
  }

  const sourceId = Number.isInteger(data.source_id) ? data.source_id : null;

  const res = await execute(
    db,
    `
    INSERT INTO subscriptions (topic_id, source_id, severity, destination_id, group_id, enabled, created_at)
    VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
    `,
    [topicId, sourceId, severity, hasDest ? data.destination_id : null, hasGroup ? data.group_id : null]
  );

  return { id: res.lastRowId, success: true };
}

export async function deleteSubscription(db, subscriptionId) {
  const res = await execute(db, "DELETE FROM subscriptions WHERE id = ?", [subscriptionId]);
  if (res.changes === 0) throw new Error("Subscription not found");
  return { success: true };
}

/**
 * Events and Delivery Logs
 */
export async function listEvents(db, { limit = 50, offset = 0, topic, sourceId, status, search }) {
  const boundedLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  const boundedOffset = Math.max(0, Number(offset) || 0);

  let whereClauses = [];
  let params = [];

  if (topic) {
    whereClauses.push("e.topic = ?");
    params.push(topic.toLowerCase().trim());
  }

  if (sourceId) {
    whereClauses.push("e.source_id = ?");
    params.push(Number(sourceId));
  }

  if (status) {
    whereClauses.push("e.status = ?");
    params.push(status);
  }

  if (search) {
    whereClauses.push("(e.title LIKE ? OR e.message LIKE ? OR e.idempotency_key = ?)");
    params.push(`%${search}%`, `%${search}%`, search);
  }

  const whereSql = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

  const totalCount = await queryFirst(
    db,
    `SELECT COUNT(*) as count FROM events e ${whereSql}`,
    params
  );

  const events = await queryAll(
    db,
    `
    SELECT e.id, e.topic, e.title, e.severity, e.message, e.status, e.idempotency_key, e.created_at,
           s.id as source_id, s.name as source_name,
           (SELECT COUNT(*) FROM delivery_logs WHERE event_id = e.id) as total_deliveries,
           (SELECT COUNT(*) FROM delivery_logs WHERE event_id = e.id AND status = 'success') as success_deliveries,
           (SELECT COUNT(*) FROM delivery_logs WHERE event_id = e.id AND status = 'failed') as failed_deliveries
    FROM events e
    LEFT JOIN sources s ON s.id = e.source_id
    ${whereSql}
    ORDER BY e.id DESC
    LIMIT ? OFFSET ?
    `,
    [...params, boundedLimit, boundedOffset]
  );

  return {
    total: totalCount?.count || 0,
    limit: boundedLimit,
    offset: boundedOffset,
    events
  };
}

export async function getEventDetails(db, eventId) {
  const event = await queryFirst(
    db,
    `
    SELECT e.id, e.topic, e.title, e.severity, e.message, e.metadata_json, e.idempotency_key, e.status, e.created_at,
           s.id as source_id, s.name as source_name
    FROM events e
    LEFT JOIN sources s ON s.id = e.source_id
    WHERE e.id = ?
    `,
    [eventId]
  );

  if (!event) throw new Error("Event not found");

  const deliveries = await queryAll(
    db,
    `
    SELECT dl.id, dl.destination_id, d.name as destination_name, d.type as destination_type,
           dl.status, dl.http_status, dl.response_excerpt, dl.error_message, dl.attempt_count, dl.created_at, dl.completed_at
    FROM delivery_logs dl
    LEFT JOIN destinations d ON d.id = dl.destination_id
    WHERE dl.event_id = ?
    ORDER BY dl.id ASC
    `,
    [eventId]
  );

  let metadata = {};
  try { metadata = JSON.parse(event.metadata_json); } catch {}

  return {
    ...event,
    metadata,
    deliveries
  };
}

export async function retryFailedDeliveries(db, eventId, env) {
  const event = await queryFirst(db, "SELECT * FROM events WHERE id = ?", [eventId]);
  if (!event) throw new Error("Event not found");

  // Find destinations that failed
  const failedLogs = await queryAll(
    db,
    `
    SELECT dl.id as log_id, dl.destination_id, dl.attempt_count,
           d.name, d.type, d.config_json, d.secret_ciphertext, d.enabled
    FROM delivery_logs dl
    JOIN destinations d ON d.id = dl.destination_id
    WHERE dl.event_id = ? AND dl.status = 'failed'
    `,
    [eventId]
  );

  if (failedLogs.length === 0) {
    return { success: true, message: "No failed deliveries found to retry", retried: 0 };
  }

  let metadata = {};
  try { metadata = JSON.parse(event.metadata_json); } catch {}

  const notificationData = {
    event_id: event.id,
    source_id: event.source_id,
    topic: event.topic,
    title: event.title,
    message: event.message,
    severity: event.severity,
    metadata
  };

  const results = [];
  for (const log of failedLogs) {
    const provider = getProvider(log.type);
    if (!provider || log.enabled !== 1) continue;

    const outcome = await provider.send(log, notificationData, env);
    const now = new Date().toISOString();
    const attempts = (log.attempt_count || 1) + 1;

    if (outcome.success) {
      await execute(
        db,
        `
        UPDATE delivery_logs
        SET status = 'success', http_status = ?, response_excerpt = ?, error_message = '',
            attempt_count = ?, completed_at = ?
        WHERE id = ?
        `,
        [outcome.httpStatus || 200, outcome.responseExcerpt || "", attempts, now, log.log_id]
      );
      results.push({ destination_id: log.destination_id, status: "success" });
    } else {
      await execute(
        db,
        `
        UPDATE delivery_logs
        SET http_status = ?, error_message = ?, attempt_count = ?, completed_at = ?
        WHERE id = ?
        `,
        [outcome.httpStatus || null, outcome.errorMessage || "Retry failed", attempts, now, log.log_id]
      );
      results.push({ destination_id: log.destination_id, status: "failed", error: outcome.errorMessage });
    }
  }

  // Update event status
  const remainingFails = await queryFirst(
    db,
    "SELECT COUNT(*) as count FROM delivery_logs WHERE event_id = ? AND status = 'failed'",
    [eventId]
  );

  const newStatus = (remainingFails?.count || 0) === 0 ? "processed" : "partial_failure";
  await execute(db, "UPDATE events SET status = ? WHERE id = ?", [newStatus, eventId]);

  return { success: true, retried: failedLogs.length, results };
}

export async function listDeliveryLogs(db, { limit = 50, offset = 0, status, destinationId, topic, search }) {
  const boundedLimit = Math.min(200, Math.max(1, Number(limit) || 50));
  const boundedOffset = Math.max(0, Number(offset) || 0);

  let whereClauses = [];
  let params = [];

  if (status) {
    whereClauses.push("dl.status = ?");
    params.push(status);
  }

  if (destinationId) {
    whereClauses.push("dl.destination_id = ?");
    params.push(Number(destinationId));
  }

  if (topic) {
    whereClauses.push("e.topic = ?");
    params.push(topic.toLowerCase().trim());
  }

  if (search) {
    whereClauses.push("(d.name LIKE ? OR dl.error_message LIKE ? OR dl.response_excerpt LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereSql = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

  const totalCount = await queryFirst(
    db,
    `
    SELECT COUNT(*) as count
    FROM delivery_logs dl
    JOIN events e ON e.id = dl.event_id
    LEFT JOIN destinations d ON d.id = dl.destination_id
    ${whereSql}
    `,
    params
  );

  const logs = await queryAll(
    db,
    `
    SELECT dl.id, dl.event_id, e.topic, e.severity, e.title,
           dl.destination_id, d.name as destination_name, d.type as provider_type,
           dl.status, dl.http_status, dl.response_excerpt, dl.error_message, dl.attempt_count,
           dl.created_at, dl.completed_at
    FROM delivery_logs dl
    JOIN events e ON e.id = dl.event_id
    LEFT JOIN destinations d ON d.id = dl.destination_id
    ${whereSql}
    ORDER BY dl.id DESC
    LIMIT ? OFFSET ?
    `,
    [...params, boundedLimit, boundedOffset]
  );

  return {
    total: totalCount?.count || 0,
    limit: boundedLimit,
    offset: boundedOffset,
    logs
  };
}

/**
 * System Settings & Readiness Diagnostic
 */
export async function getSystemSettings(db, env) {
  const [adminCount, activeSessions] = await Promise.all([
    queryFirst(db, "SELECT COUNT(*) as count FROM admin_users WHERE enabled = 1"),
    queryFirst(db, "SELECT COUNT(*) as count FROM admin_sessions WHERE expires_at > datetime('now') AND revoked_at IS NULL")
  ]);

  return {
    runtime: "Cloudflare Workers",
    database: "Cloudflare D1 (SQLite)",
    config: {
      has_encryption_key: Boolean(env.DESTINATION_ENCRYPTION_KEY && env.DESTINATION_ENCRYPTION_KEY.length >= 16),
      email_api_url: env.EMAIL_API_URL || "https://sender-api.mickey.qzz.io/api/v1/send",
      email_sender_id: env.EMAIL_SENDER_ID || "snd_mvcmbbyw",
      has_email_api_key: Boolean(env.EMAIL_API_KEY),
      has_telegram_bot_token: Boolean(env.TELEGRAM_BOT_TOKEN),
      allow_http_ntfy: env.ALLOW_HTTP_NTFY === "true"
    },
    administrators: {
      active_count: adminCount?.count || 0,
      active_sessions: activeSessions?.count || 0
    }
  };
}
