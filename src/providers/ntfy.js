/**
 * ntfy server / topic delivery provider adapter
 */

import { BaseProvider } from "./base.js";
import { decryptSecret } from "../security/crypto.js";
import { validateExternalUrl } from "../security/ssrf.js";
import { sanitizeLogString } from "../security/redaction.js";

export class NtfyProvider extends BaseProvider {
  /**
   * Resolves authentication token for ntfy if configured
   * @param {object} destination 
   * @param {object} env 
   * @returns {Promise<string>}
   */
  async resolveAuthToken(destination, env) {
    if (destination.secret_ciphertext) {
      try {
        const decrypted = await decryptSecret(destination.secret_ciphertext, env.DESTINATION_ENCRYPTION_KEY);
        if (decrypted) return decrypted;
      } catch (err) {
        console.error("ntfy_token_decrypt_error", sanitizeLogString(err.message));
      }
    }
    return "";
  }

  /**
   * Sends a notification to an ntfy topic
   * @param {object} destination 
   * @param {object} notification 
   * @param {object} env 
   * @returns {Promise<{success: boolean, httpStatus?: number, responseExcerpt?: string, errorMessage?: string}>}
   */
  async send(destination, notification, env) {
    let cfg = {};
    try {
      cfg = typeof destination.config_json === "string" ? JSON.parse(destination.config_json) : destination.config_json || {};
    } catch {
      return { success: false, errorMessage: "Invalid destination JSON configuration" };
    }

    const baseUrl = (cfg.base_url || "https://ntfy.sh").trim().replace(/\/+$/, "");
    const topic = (cfg.topic || "").trim();

    if (!topic || !/^[A-Za-z0-9_-]{1,128}$/.test(topic)) {
      return { success: false, errorMessage: "Invalid ntfy topic name. Must be 1-128 alphanumeric characters, hyphens or underscores." };
    }

    // SSRF verification: only allow HTTPS (or HTTP if env.ALLOW_HTTP_NTFY === "true")
    const allowHttp = env.ALLOW_HTTP_NTFY === "true";
    const urlValidation = validateExternalUrl(baseUrl, allowHttp);
    if (!urlValidation.valid) {
      return { success: false, errorMessage: `ntfy URL security check failed: ${urlValidation.error}` };
    }

    const targetUrl = `${baseUrl}/${encodeURIComponent(topic)}`;
    const authToken = await this.resolveAuthToken(destination, env);

    const priorityMap = {
      critical: "urgent", // 5
      error: "high",      // 4
      warning: "default", // 3
      info: "low"         // 2
    };

    const headers = {
      "Content-Type": "text/plain; charset=utf-8",
      "Title": (notification.title || `${(notification.severity || "INFO").toUpperCase()}: ${notification.topic}`).slice(0, 250),
      "Priority": priorityMap[notification.severity?.toLowerCase()] || "default",
      "Tags": notification.severity === "critical" ? "warning,skull" : notification.severity === "error" ? "rotating_light" : "bell"
    };

    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    // Format body with message and optional metadata
    let body = notification.message || "";
    if (notification.metadata && Object.keys(notification.metadata).length > 0) {
      body += "\n\nMetadata:\n" + JSON.stringify(notification.metadata, null, 2);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers,
        body,
        signal: controller.signal
      });

      const responseText = await response.text();
      clearTimeout(timeout);

      if (!response.ok) {
        return {
          success: false,
          httpStatus: response.status,
          errorMessage: sanitizeLogString(`ntfy returned HTTP ${response.status}: ${responseText.slice(0, 300)}`),
          responseExcerpt: sanitizeLogString(responseText.slice(0, 500))
        };
      }

      return {
        success: true,
        httpStatus: response.status,
        responseExcerpt: sanitizeLogString(responseText.slice(0, 500))
      };
    } catch (err) {
      clearTimeout(timeout);
      const isTimeout = err && err.name === "AbortError";
      const errMsg = isTimeout ? "ntfy request timed out after 10 seconds" : (err instanceof Error ? err.message : "Unknown network error");
      return {
        success: false,
        errorMessage: sanitizeLogString(errMsg)
      };
    }
  }

  /**
   * Tests ntfy destination connectivity
   * @param {object} destination 
   * @param {object} env 
   * @returns {Promise<{success: boolean, httpStatus?: number, message: string}>}
   */
  async test(destination, env) {
    const testNotification = {
      topic: "gateway.test",
      title: "Gateway Test",
      message: "ntfy destination connection verified successfully.",
      severity: "info",
      metadata: { test: true }
    };
    const res = await this.send(destination, testNotification, env);
    return {
      success: res.success,
      httpStatus: res.httpStatus,
      message: res.success ? "Test notification published to ntfy" : (res.errorMessage || "Failed to publish test notification to ntfy")
    };
  }
}
