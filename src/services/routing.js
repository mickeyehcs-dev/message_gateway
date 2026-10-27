/**
 * Notification routing and delivery engine
 */

import { normalizeTopic, isValidSeverity } from "../security/validation.js";
import { isSourceAuthorizedForTopic } from "../auth/source.js";
import { hashPayload } from "../security/crypto.js";
import { getProvider } from "../providers/index.js";
import { queryFirst, queryAll, execute } from "../db/index.js";
import { sanitizeLogString } from "../security/redaction.js";

/**
 * Executes the complete notification processing and delivery workflow
 * @param {D1Database} db 
 * @param {object} source - Authenticated source record
 * @param {object} payload - Notification payload { topic, title, message, severity, metadata }
 * @param {string|null} idempotencyKey - Optional idempotency key header
 * @param {object} env - Cloudflare Workers environment bindings
 * @returns {Promise<{status: number, body: object}>}
 */
export async function processNotification(db, source, payload, idempotencyKey, env) {
  // 1. Validate payload fields
  if (!payload || typeof payload !== "object") {
    return { status: 400, body: { ok: false, error: "Missing notification payload body" } };
  }

  const normalizedTopic = normalizeTopic(payload.topic);
  if (!normalizedTopic) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "Invalid or missing 'topic'. Must be 1-100 alphanumeric characters with '.', '_', '-', or ':'."
      }
    };
  }

  const title = typeof payload.title === "string" ? payload.title.trim().slice(0, 255) : "";
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  if (!message) {
    return { status: 400, body: { ok: false, error: "Missing required 'message' field" } };
  }

  const severity = (typeof payload.severity === "string" ? payload.severity.trim().toLowerCase() : "info");
  if (!isValidSeverity(severity)) {
    return { status: 400, body: { ok: false, error: "Invalid 'severity'. Allowed values: info, warning, error, critical" } };
  }

  const metadata = payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {};

  // 2. Verify source is enabled
  if (source.enabled !== 1) {
    return { status: 403, body: { ok: false, error: "Source is disabled" } };
  }

  // 3. Verify topic exists and is enabled
  const topicRecord = await queryFirst(
    db,
    "SELECT id, name, enabled FROM topics WHERE name = ?",
    [normalizedTopic]
  );

  if (!topicRecord) {
    return { status: 404, body: { ok: false, error: `Topic '${normalizedTopic}' does not exist` } };
  }

  if (topicRecord.enabled !== 1) {
    return { status: 403, body: { ok: false, error: `Topic '${normalizedTopic}' is currently disabled` } };
  }

  // 4. Verify source is authorized to publish to topic
  const isAuthorized = await isSourceAuthorizedForTopic(db, source.id, normalizedTopic);
  if (!isAuthorized) {
    return {
      status: 403,
      body: { ok: false, error: `Source '${source.name}' is not authorized to publish to topic '${normalizedTopic}'` }
    };
  }

  // 5. Handle Idempotency
  const payloadHash = await hashPayload({
    topic: normalizedTopic,
    title,
    message,
    severity,
    metadata
  });

  if (idempotencyKey) {
    const existingEvent = await queryFirst(
      db,
      "SELECT id, source_id, topic, title, severity, status, payload_hash, created_at FROM events WHERE source_id = ? AND idempotency_key = ?",
      [source.id, idempotencyKey]
    );

    if (existingEvent) {
      if (existingEvent.payload_hash && existingEvent.payload_hash !== payloadHash) {
        return {
          status: 409,
          body: {
            ok: false,
            error: "Idempotency key already used with a different notification payload"
          }
        };
      }

      // Return previous outcome summary
      const deliveryLogs = await queryAll(
        db,
        `
        SELECT dl.id, dl.destination_id, d.name AS destination_name, d.type AS provider_type,
               dl.status, dl.http_status, dl.error_message, dl.created_at
        FROM delivery_logs dl
        LEFT JOIN destinations d ON d.id = dl.destination_id
        WHERE dl.event_id = ?
        `,
        [existingEvent.id]
      );

      return {
        status: 200,
        body: {
          ok: existingEvent.status === "processed",
          idempotent_replay: true,
          event_id: existingEvent.id,
          status: existingEvent.status,
          deliveries: deliveryLogs
        }
      };
    }
  }

  // 6. Record notification event in DB with initial status
  const eventResult = await execute(
    db,
    `
    INSERT INTO events (source_id, topic, title, severity, message, metadata_json, idempotency_key, payload_hash, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'processed', datetime('now'))
    `,
    [
      source.id,
      normalizedTopic,
      title,
      severity,
      message,
      JSON.stringify(metadata),
      idempotencyKey || null,
      payloadHash
    ]
  );

  const eventId = eventResult.lastRowId;

  // 7. Find active subscriptions for topic
  const subscriptions = await queryAll(
    db,
    `
    SELECT id, topic_id, source_id, severity, destination_id, group_id
    FROM subscriptions
    WHERE topic_id = ? AND enabled = 1
      AND (source_id IS NULL OR source_id = ?)
      AND (severity IS NULL OR severity = ?)
    `,
    [topicRecord.id, source.id, severity]
  );

  // 8. Expand group subscriptions and collect target destinations
  const targetDestinationIds = new Set();

  for (const sub of subscriptions) {
    if (sub.destination_id) {
      targetDestinationIds.add(sub.destination_id);
    } else if (sub.group_id) {
      const members = await queryAll(
        db,
        "SELECT destination_id FROM group_members WHERE group_id = ? AND enabled = 1",
        [sub.group_id]
      );
      for (const m of members) {
        targetDestinationIds.add(m.destination_id);
      }
    }
  }

  // 9. If empty recipient list: mark event as 'no_subscribers'
  if (targetDestinationIds.size === 0) {
    await execute(db, "UPDATE events SET status = 'no_subscribers' WHERE id = ?", [eventId]);
    return {
      status: 200,
      body: {
        ok: false,
        event_id: eventId,
        status: "no_subscribers",
        message: `No active subscribers found for topic '${normalizedTopic}' with severity '${severity}'`,
        stats: { total: 0, successful: 0, failed: 0, skipped: 0 },
        deliveries: []
      }
    };
  }

  // 10. Load enabled destinations
  const destIdList = Array.from(targetDestinationIds);
  const placeholders = destIdList.map(() => "?").join(",");
  const destinations = await queryAll(
    db,
    `SELECT id, name, type, config_json, secret_ciphertext, enabled FROM destinations WHERE id IN (${placeholders})`,
    destIdList
  );

  const deliveryOutcomes = [];
  let successCount = 0;
  let failureCount = 0;
  let skippedCount = 0;

  // 11. Synchronous dispatch with bounded provider execution
  for (const dest of destinations) {
    if (dest.enabled !== 1) {
      skippedCount++;
      deliveryOutcomes.push({
        destination_id: dest.id,
        destination_name: dest.name,
        provider: dest.type,
        status: "skipped",
        reason: "Destination is disabled"
      });
      continue;
    }

    const provider = getProvider(dest.type);
    if (!provider) {
      failureCount++;
      const errMsg = `Unsupported provider type: ${dest.type}`;
      await recordDeliveryLog(db, eventId, dest.id, "failed", null, errMsg);
      deliveryOutcomes.push({
        destination_id: dest.id,
        destination_name: dest.name,
        provider: dest.type,
        status: "failed",
        error: errMsg
      });
      continue;
    }

    const notificationData = {
      event_id: eventId,
      source_id: source.id,
      source_name: source.name,
      topic: normalizedTopic,
      title: title || `[${severity.toUpperCase()}] ${normalizedTopic}`,
      message,
      severity,
      metadata
    };

    const outcome = await provider.send(dest, notificationData, env);

    if (outcome.success) {
      successCount++;
      await recordDeliveryLog(db, eventId, dest.id, "success", outcome.httpStatus, outcome.responseExcerpt || "");
      deliveryOutcomes.push({
        destination_id: dest.id,
        destination_name: dest.name,
        provider: dest.type,
        status: "success",
        http_status: outcome.httpStatus
      });
    } else {
      failureCount++;
      await recordDeliveryLog(db, eventId, dest.id, "failed", outcome.httpStatus, outcome.errorMessage || "Delivery failed");
      deliveryOutcomes.push({
        destination_id: dest.id,
        destination_name: dest.name,
        provider: dest.type,
        status: "failed",
        http_status: outcome.httpStatus,
        error: outcome.errorMessage
      });
    }
  }

  // 12. Compute overall event status
  let finalStatus = "processed";
  if (successCount === 0 && failureCount > 0) {
    finalStatus = "failed";
  } else if (failureCount > 0) {
    finalStatus = "partial_failure";
  }

  await execute(db, "UPDATE events SET status = ? WHERE id = ?", [finalStatus, eventId]);

  return {
    status: 200,
    body: {
      ok: finalStatus === "processed",
      event_id: eventId,
      status: finalStatus,
      stats: {
        total: destinations.length,
        successful: successCount,
        failed: failureCount,
        skipped: skippedCount
      },
      deliveries: deliveryOutcomes
    }
  };
}

/**
 * Records a delivery outcome to the delivery_logs table
 */
async function recordDeliveryLog(db, eventId, destinationId, status, httpStatus, excerptOrError) {
  const sanitized = sanitizeLogString(excerptOrError || "");
  const now = new Date().toISOString();
  await execute(
    db,
    `
    INSERT INTO delivery_logs (event_id, destination_id, status, http_status, response_excerpt, error_message, attempt_count, created_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `,
    [
      eventId,
      destinationId,
      status,
      httpStatus || null,
      status === "success" ? sanitized.slice(0, 1000) : "",
      status === "failed" ? sanitized.slice(0, 1000) : "",
      now,
      now
    ]
  );
}
