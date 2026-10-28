/**
 * Web Push notification delivery provider adapter
 * RFC 8030, RFC 8291 (aes128gcm), RFC 8292 (VAPID)
 */

import { BaseProvider } from "./base.js";
import { getOrGenerateVapidKeys } from "../security/vapid.js";
import { buildPushPayload } from "@block65/webcrypto-web-push";
import { validateExternalUrl } from "../security/ssrf.js";
import { sanitizeLogString } from "../security/redaction.js";
import { queryFirst, execute } from "../db/index.js";

export class WebPushProvider extends BaseProvider {
  /**
   * Sends a Web Push notification to a browser push subscription
   * @param {object} destination - Destination record from DB
   * @param {object} notification - Notification payload (topic, title, message, severity, metadata)
   * @param {object} env - Cloudflare Workers environment bindings
   * @returns {Promise<{success: boolean, httpStatus?: number, responseExcerpt?: string, errorMessage?: string}>}
   */
  async send(destination, notification, env = {}) {
    let cfg = {};
    try {
      cfg = typeof destination.config_json === "string" ? JSON.parse(destination.config_json) : (destination.config_json || {});
    } catch {
      return { success: false, errorMessage: "Invalid destination JSON configuration" };
    }

    const endpoint = (cfg.endpoint || "").trim();
    if (!endpoint) {
      return { success: false, errorMessage: "Missing Web Push subscription endpoint URL" };
    }

    // SSRF verification: only allow public HTTPS endpoints
    const urlValidation = validateExternalUrl(endpoint, false);
    if (!urlValidation.valid) {
      return { success: false, errorMessage: `Web Push endpoint security check failed: ${urlValidation.error}` };
    }

    const keys = cfg.keys || {};
    if (!keys.p256dh || !keys.auth) {
      return { success: false, errorMessage: "Missing client encryption keys (p256dh and auth are required)" };
    }

    // Resolve Topic Configuration & Style (if DB available)
    let topicConfig = {};
    if (env.DB && notification.topic) {
      try {
        const topicRecord = await queryFirst(
          env.DB,
          "SELECT webpush_config_json FROM topics WHERE name = ?",
          [notification.topic]
        );
        if (topicRecord && topicRecord.webpush_config_json) {
          topicConfig = JSON.parse(topicRecord.webpush_config_json);
        }
      } catch {
        // Fall back to defaults if error
      }
    }

    // Determine target click URL (per-alert metadata > destination override > topic default > '/')
    const clickUrl = (notification.metadata && (notification.metadata.url || notification.metadata.click_url))
      || cfg.click_url
      || topicConfig.click_url
      || "/";

    const icon = cfg.icon || topicConfig.icon || "/favicon.ico";
    const badge = cfg.badge || topicConfig.badge || "";
    const image = cfg.image || topicConfig.image || undefined;
    const requireInteraction = cfg.require_interaction !== undefined
      ? Boolean(cfg.require_interaction)
      : (topicConfig.require_interaction === true || notification.severity === "critical");
    const vibrate = cfg.vibrate || topicConfig.vibrate || (notification.severity === "critical" ? [200, 100, 200, 100, 400] : [100, 50, 100]);
    const tag = cfg.tag || topicConfig.tag || `ung-${notification.topic || 'alert'}`;
    const actions = Array.isArray(topicConfig.actions) ? topicConfig.actions : [];

    // Construct push data payload
    const pushData = {
      title: notification.title || `[${(notification.severity || "INFO").toUpperCase()}] ${notification.topic || "Notification"}`,
      message: notification.message || "",
      body: notification.message || "",
      severity: notification.severity || "info",
      topic: notification.topic || "",
      click_url: clickUrl,
      url: clickUrl,
      icon,
      badge,
      image,
      requireInteraction,
      vibrate,
      tag,
      actions,
      timestamp: Date.now(),
      metadata: notification.metadata || {}
    };

    let vapid;
    try {
      vapid = await getOrGenerateVapidKeys(env.DB, env);
    } catch (err) {
      return { success: false, errorMessage: `Failed to resolve VAPID keys: ${err.message}` };
    }

    const subscription = {
      endpoint,
      keys: {
        p256dh: keys.p256dh,
        auth: keys.auth
      }
    };

    let pushPayload;
    try {
      pushPayload = await buildPushPayload(
        {
          data: pushData,
          options: {
            ttl: 86400,
            urgency: notification.severity === "critical" ? "high" : "normal",
            topic: notification.topic ? notification.topic.slice(0, 32) : undefined
          }
        },
        subscription,
        vapid
      );
    } catch (err) {
      return {
        success: false,
        errorMessage: sanitizeLogString(`Web Push encryption error: ${err.message}`)
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(endpoint, {
        method: pushPayload.method,
        headers: pushPayload.headers,
        body: pushPayload.body,
        signal: controller.signal
      });

      const responseText = await response.text();
      clearTimeout(timeout);

      // Handle successful push delivery (200 OK, 201 Created, 202 Accepted)
      if (response.status === 200 || response.status === 201 || response.status === 202) {
        return {
          success: true,
          httpStatus: response.status,
          responseExcerpt: sanitizeLogString(responseText.slice(0, 500) || "Push received by gateway")
        };
      }

      // Handle expired or unsubscribed clients (404 Not Found, 410 Gone)
      if (response.status === 404 || response.status === 410) {
        if (env.DB && destination.id) {
          try {
            await execute(
              env.DB,
              "UPDATE destinations SET enabled = 0, updated_at = datetime('now') WHERE id = ?",
              [destination.id]
            );
          } catch {
            // Ignore DB update errors during delivery
          }
        }
        return {
          success: false,
          httpStatus: response.status,
          errorMessage: "Web Push subscription has expired or was unsubscribed by the user (HTTP 410/404). Destination disabled."
        };
      }

      return {
        success: false,
        httpStatus: response.status,
        errorMessage: sanitizeLogString(`Push service returned HTTP ${response.status}: ${responseText.slice(0, 300)}`),
        responseExcerpt: sanitizeLogString(responseText.slice(0, 500))
      };
    } catch (err) {
      clearTimeout(timeout);
      const isTimeout = err && err.name === "AbortError";
      const errMsg = isTimeout ? "Web Push request timed out after 10 seconds" : (err instanceof Error ? err.message : "Unknown network error");
      return {
        success: false,
        errorMessage: sanitizeLogString(errMsg)
      };
    }
  }

  /**
   * Tests destination connectivity with a test notification
   * @param {object} destination 
   * @param {object} env 
   * @returns {Promise<{success: boolean, httpStatus?: number, message: string}>}
   */
  async test(destination, env) {
    const testNotification = {
      topic: "gateway.test",
      title: "Gateway Test: Web Push",
      message: "Browser Web Push notification connection verified successfully.",
      severity: "info",
      metadata: { test: true }
    };
    const res = await this.send(destination, testNotification, env);
    return {
      success: res.success,
      httpStatus: res.httpStatus,
      message: res.success
        ? "Test push notification dispatched successfully."
        : (res.errorMessage || "Failed to dispatch test push notification.")
    };
  }
}
