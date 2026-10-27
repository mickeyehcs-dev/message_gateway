/**
 * Email delivery provider adapter
 * Interacts with configured HTTP email sender API
 */

import { BaseProvider } from "./base.js";
import { isValidEmail, escapeHtml } from "../security/validation.js";
import { decryptSecret } from "../security/crypto.js";
import { sanitizeLogString } from "../security/redaction.js";

export class EmailProvider extends BaseProvider {
  /**
   * Resolves the email API key for a destination
   * @param {object} destination 
   * @param {object} env 
   * @returns {Promise<string>}
   */
  async resolveApiKey(destination, env) {
    if (destination.secret_ciphertext) {
      try {
        const decrypted = await decryptSecret(destination.secret_ciphertext, env.DESTINATION_ENCRYPTION_KEY);
        if (decrypted) return decrypted;
      } catch (err) {
        console.error("email_key_decrypt_error", sanitizeLogString(err.message));
      }
    }
    return env.EMAIL_API_KEY || "";
  }

  /**
   * Sends an email notification
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

    const to = cfg.to;
    if (!to || !isValidEmail(to)) {
      return { success: false, errorMessage: `Invalid recipient email address: '${to || ""}'` };
    }

    const apiKey = await this.resolveApiKey(destination, env);
    if (!apiKey) {
      return { success: false, errorMessage: "Email API key is not configured for this destination or worker environment" };
    }

    const apiUrl = cfg.api_url || env.EMAIL_API_URL || "https://sender-api.mickey.qzz.io/api/v1/send";
    const senderId = cfg.sender_id || env.EMAIL_SENDER_ID || "snd_mvcmbbyw";

    const subject = notification.title || `[${(notification.severity || "INFO").toUpperCase()}] ${notification.topic}`;
    const htmlBody = this.buildEmailHtml(notification);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey
        },
        body: JSON.stringify({
          to,
          subject,
          html: htmlBody,
          sender_id: senderId
        }),
        signal: controller.signal
      });

      const responseText = await response.text();
      clearTimeout(timeout);

      if (!response.ok) {
        return {
          success: false,
          httpStatus: response.status,
          errorMessage: sanitizeLogString(`Email provider returned HTTP ${response.status}: ${responseText.slice(0, 300)}`),
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
      const errMsg = isTimeout ? "Email provider request timed out after 10 seconds" : (err instanceof Error ? err.message : "Unknown network error");
      return {
        success: false,
        errorMessage: sanitizeLogString(errMsg)
      };
    }
  }

  /**
   * Tests email destination configuration
   * @param {object} destination 
   * @param {object} env 
   * @returns {Promise<{success: boolean, httpStatus?: number, message: string}>}
   */
  async test(destination, env) {
    const testNotification = {
      topic: "gateway.test",
      title: "Notification Gateway - Test Email",
      message: "This is a verification test notification from your Universal Notification Gateway.",
      severity: "info",
      metadata: { test: true, timestamp: new Date().toISOString() }
    };
    const res = await this.send(destination, testNotification, env);
    return {
      success: res.success,
      httpStatus: res.httpStatus,
      message: res.success ? "Test email sent successfully" : (res.errorMessage || "Failed to send test email")
    };
  }

  buildEmailHtml(notification) {
    const metadata = notification.metadata && Object.keys(notification.metadata).length > 0
      ? `<pre style="white-space:pre-wrap;background:#182238;color:#a8b5cc;padding:12px;border-radius:6px;font-size:12px">${escapeHtml(JSON.stringify(notification.metadata, null, 2))}</pre>`
      : "";

    const severityColor = {
      info: "#315fb2",
      warning: "#d97706",
      error: "#dc2626",
      critical: "#991b1b"
    }[notification.severity?.toLowerCase()] || "#315fb2";

    return `
      <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;color:#1e293b;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <div style="background:${severityColor};color:#ffffff;padding:16px 20px">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;opacity:0.9">${escapeHtml(notification.severity || "info")} &bull; ${escapeHtml(notification.topic || "notification")}</div>
          <h2 style="margin:4px 0 0 0;font-size:18px;font-weight:600">${escapeHtml(notification.title || "Notification Alert")}</h2>
        </div>
        <div style="padding:20px;background:#ffffff">
          <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;white-space:pre-wrap">${escapeHtml(notification.message || "")}</p>
          ${metadata}
          <div style="margin-top:20px;padding-top:12px;border-top:1px solid #f1f5f9;font-size:12px;color:#94a3b8">
            Sent by Universal Notification Gateway &bull; ${new Date().toUTCString()}
          </div>
        </div>
      </div>
    `;
  }
}
