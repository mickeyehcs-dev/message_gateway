/**
 * Web Push Subscription and Management Service
 */

import { queryFirst, queryAll, execute } from "../db/index.js";
import { normalizeTopic } from "../security/validation.js";
import { validateExternalUrl } from "../security/ssrf.js";
import { WebPushProvider } from "../providers/webpush.js";

/**
 * Subscribes a browser client to a specific topic
 * @param {object} db 
 * @param {object} params
 * @param {string} params.topic 
 * @param {object} params.subscription 
 * @param {string} [params.device_name]
 * @returns {Promise<{success: boolean, topic: string, destination_id: number, message: string}>}
 */
export async function subscribeClient(db, { topic, subscription, device_name = "" }) {
  if (!topic) {
    throw new Error("Topic name is required to subscribe");
  }

  const normalizedTopic = normalizeTopic(topic);
  if (!normalizedTopic) {
    throw new Error("Invalid topic identifier. Topics must be lowercase alphanumeric with '.', '_', '-', or ':'");
  }

  if (!subscription || typeof subscription !== "object") {
    throw new Error("Push subscription payload is required");
  }

  const endpoint = typeof subscription.endpoint === "string" ? subscription.endpoint.trim() : "";
  if (!endpoint) {
    throw new Error("Push subscription endpoint URL is required");
  }

  const ssrfCheck = validateExternalUrl(endpoint, false);
  if (!ssrfCheck.valid) {
    throw new Error(`Invalid push endpoint URL: ${ssrfCheck.error}`);
  }

  const keys = subscription.keys || {};
  if (!keys.p256dh || !keys.auth) {
    throw new Error("Push subscription must contain encryption keys: 'p256dh' and 'auth'");
  }

  // 1. Verify Topic exists and is active
  const topicRecord = await queryFirst(
    db,
    "SELECT id, name, enabled, webpush_config_json FROM topics WHERE name = ?",
    [normalizedTopic]
  );

  if (!topicRecord) {
    throw new Error(`Topic '${normalizedTopic}' does not exist. Please select or configure an active topic in the Admin Panel.`);
  }

  if (topicRecord.enabled !== 1) {
    throw new Error(`Topic '${normalizedTopic}' is currently disabled.`);
  }

  let topicWebPushCfg = {};
  try {
    topicWebPushCfg = topicRecord.webpush_config_json ? JSON.parse(topicRecord.webpush_config_json) : {};
  } catch {
    topicWebPushCfg = {};
  }

  if (topicWebPushCfg.webpush_enabled === false) {
    throw new Error(`Web Push subscriptions are disabled for topic '${normalizedTopic}'.`);
  }

  // 2. Find or Create Destination for this push endpoint
  const webpushDestinations = await queryAll(
    db,
    "SELECT id, name, config_json, enabled FROM destinations WHERE type = 'webpush'"
  );

  let targetDest = null;
  for (const d of webpushDestinations) {
    try {
      const cfg = typeof d.config_json === "string" ? JSON.parse(d.config_json) : d.config_json;
      if (cfg && cfg.endpoint === endpoint) {
        targetDest = d;
        break;
      }
    } catch {
      // Ignore corrupted json
    }
  }

  const deviceLabel = device_name ? device_name.trim().slice(0, 50) : "Browser Client";
  const newConfig = {
    endpoint,
    keys: {
      p256dh: keys.p256dh,
      auth: keys.auth
    },
    device_name: deviceLabel,
    updated_at: new Date().toISOString()
  };

  let destinationId;
  if (targetDest) {
    destinationId = targetDest.id;
    await execute(
      db,
      "UPDATE destinations SET config_json = ?, enabled = 1, updated_at = datetime('now') WHERE id = ?",
      [JSON.stringify(newConfig), destinationId]
    );
  } else {
    const endpointHash = endpoint.split("/").pop().slice(-8) || Math.random().toString(36).slice(2, 8);
    const destName = `push-${normalizedTopic}-${endpointHash}`;

    // Handle collision if a destination with exact name exists
    const existingName = await queryFirst(db, "SELECT id FROM destinations WHERE name = ?", [destName]);
    const finalDestName = existingName ? `${destName}-${Date.now().toString(36).slice(-4)}` : destName;

    const res = await execute(
      db,
      `
      INSERT INTO destinations (name, type, config_json, enabled, created_at, updated_at)
      VALUES (?, 'webpush', ?, 1, datetime('now'), datetime('now'))
      `,
      [finalDestName, JSON.stringify(newConfig)]
    );
    destinationId = res.lastRowId;
  }

  // 3. Ensure Subscription exists for (topic_id, destination_id)
  const existingSub = await queryFirst(
    db,
    "SELECT id, enabled FROM subscriptions WHERE topic_id = ? AND destination_id = ?",
    [topicRecord.id, destinationId]
  );

  if (existingSub) {
    if (existingSub.enabled !== 1) {
      await execute(db, "UPDATE subscriptions SET enabled = 1 WHERE id = ?", [existingSub.id]);
    }
  } else {
    await execute(
      db,
      `
      INSERT INTO subscriptions (topic_id, destination_id, enabled, created_at)
      VALUES (?, ?, 1, datetime('now'))
      `,
      [topicRecord.id, destinationId]
    );
  }

  return {
    success: true,
    topic: normalizedTopic,
    destination_id: destinationId,
    message: `Subscribed successfully to topic '${normalizedTopic}'`
  };
}

/**
 * Unsubscribes a browser push endpoint from a topic
 * @param {object} db 
 * @param {object} params
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function unsubscribeClient(db, { topic, endpoint }) {
  if (!topic || !endpoint) {
    throw new Error("Both 'topic' and 'endpoint' are required to unsubscribe");
  }

  const normalizedTopic = normalizeTopic(topic);
  const topicRecord = await queryFirst(db, "SELECT id FROM topics WHERE name = ?", [normalizedTopic]);
  if (!topicRecord) {
    return { success: true, message: "Topic not found" };
  }

  const webpushDestinations = await queryAll(
    db,
    "SELECT id, config_json FROM destinations WHERE type = 'webpush'"
  );

  let targetDestId = null;
  for (const d of webpushDestinations) {
    try {
      const cfg = typeof d.config_json === "string" ? JSON.parse(d.config_json) : d.config_json;
      if (cfg && cfg.endpoint === endpoint) {
        targetDestId = d.id;
        break;
      }
    } catch {
      // Continue
    }
  }

  if (targetDestId) {
    await execute(
      db,
      "DELETE FROM subscriptions WHERE topic_id = ? AND destination_id = ?",
      [topicRecord.id, targetDestId]
    );
  }

  return {
    success: true,
    message: `Unsubscribed successfully from topic '${normalizedTopic}'`
  };
}

/**
 * Lists all active topics available for public Web Push subscriptions on the login page
 * @param {object} db 
 * @returns {Promise<Array<{name: string, description: string, webpush_config: object}>>}
 */
export async function getAvailableTopics(db) {
  const topics = await queryAll(
    db,
    "SELECT id, name, description, webpush_config_json FROM topics WHERE enabled = 1 ORDER BY name ASC"
  );

  return topics
    .map(t => {
      let cfg = {};
      try {
        cfg = t.webpush_config_json ? JSON.parse(t.webpush_config_json) : {};
      } catch {
        cfg = {};
      }
      return {
        id: t.id,
        name: t.name,
        description: t.description || "",
        webpush_config: {
          webpush_enabled: cfg.webpush_enabled !== false,
          click_url: cfg.click_url || "/",
          icon: cfg.icon || "/favicon.ico",
          badge: cfg.badge || "",
          require_interaction: cfg.require_interaction === true
        }
      };
    })
    .filter(t => t.webpush_config.webpush_enabled);
}

/**
 * Checks subscription status for an endpoint across topics
 * @param {object} db 
 * @param {string} endpoint 
 * @param {string} [topic]
 * @returns {Promise<{subscribed: boolean, topics: string[]}>}
 */
export async function getSubscriptionStatus(db, endpoint, topic = null) {
  if (!endpoint) return { subscribed: false, topics: [] };

  const webpushDestinations = await queryAll(
    db,
    "SELECT id, config_json FROM destinations WHERE type = 'webpush' AND enabled = 1"
  );

  let targetDestId = null;
  for (const d of webpushDestinations) {
    try {
      const cfg = typeof d.config_json === "string" ? JSON.parse(d.config_json) : d.config_json;
      if (cfg && cfg.endpoint === endpoint) {
        targetDestId = d.id;
        break;
      }
    } catch {
      // Continue
    }
  }

  if (!targetDestId) return { subscribed: false, topics: [] };

  const subs = await queryAll(
    db,
    `
    SELECT t.name FROM subscriptions s
    JOIN topics t ON t.id = s.topic_id
    WHERE s.destination_id = ? AND s.enabled = 1 AND t.enabled = 1
    `,
    [targetDestId]
  );

  const topicNames = subs.map(s => s.name);
  const isSubscribed = topic ? topicNames.includes(normalizeTopic(topic)) : topicNames.length > 0;

  return {
    subscribed: isSubscribed,
    topics: topicNames
  };
}

/**
 * Dispatches an instant test push notification to a subscription
 * @param {object} db 
 * @param {object} params
 * @param {object} env 
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function sendTestPush(db, { subscription, topic = "test.topic", title, message, url }, env) {
  const provider = new WebPushProvider();
  const dummyDest = {
    id: 0,
    name: "test-subscription",
    type: "webpush",
    config_json: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      click_url: url || "/admin"
    })
  };

  const notification = {
    topic: topic || "gateway.test",
    title: title || "Universal Notification Gateway",
    message: message || "Web Push notification test successful! Real-time alerts are working.",
    severity: "info",
    metadata: {
      url: url || "/"
    }
  };

  const result = await provider.send(dummyDest, notification, { ...env, DB: db });
  return {
    success: result.success,
    message: result.success ? "Test push notification sent successfully!" : (result.errorMessage || "Failed to dispatch test notification")
  };
}
