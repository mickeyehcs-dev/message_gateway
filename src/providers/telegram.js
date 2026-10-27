/**
 * Telegram Bot API delivery provider adapter
 */

import { BaseProvider } from "./base.js";
import { decryptSecret } from "../security/crypto.js";
import { escapeHtml } from "../security/validation.js";
import { sanitizeLogString } from "../security/redaction.js";

const TELEGRAM_MAX_TEXT_LENGTH = 4096;

export class TelegramProvider extends BaseProvider {
  /**
   * Resolves the bot token for a destination
   * @param {object} destination 
   * @param {object} env 
   * @returns {Promise<string>}
   */
  async resolveBotToken(destination, env) {
    if (destination.secret_ciphertext) {
      try {
        const decrypted = await decryptSecret(destination.secret_ciphertext, env.DESTINATION_ENCRYPTION_KEY);
        if (decrypted) return decrypted;
      } catch (err) {
        console.error("telegram_token_decrypt_error", sanitizeLogString(err.message));
      }
    }
    return env.TELEGRAM_BOT_TOKEN || "";
  }

  /**
   * Sends a message via Telegram Bot API
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

    const chatId = cfg.chat_id;
    if (!chatId) {
      return { success: false, errorMessage: "Telegram chat_id is required" };
    }

    const botToken = await this.resolveBotToken(destination, env);
    if (!botToken) {
      return { success: false, errorMessage: "Telegram bot token is not configured" };
    }

    const text = this.formatTelegramMessage(notification);
    const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true
        }),
        signal: controller.signal
      });

      const responseText = await response.text();
      clearTimeout(timeout);

      let parsed;
      try { parsed = JSON.parse(responseText); } catch { parsed = {}; }

      if (!response.ok || parsed.ok === false) {
        const description = parsed.description || responseText.slice(0, 300);
        return {
          success: false,
          httpStatus: response.status,
          errorMessage: sanitizeLogString(`Telegram error: ${description}`),
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
      const errMsg = isTimeout ? "Telegram request timed out after 10 seconds" : (err instanceof Error ? err.message : "Unknown network error");
      return {
        success: false,
        errorMessage: sanitizeLogString(errMsg)
      };
    }
  }

  /**
   * Tests Telegram destination connectivity
   * @param {object} destination 
   * @param {object} env 
   * @returns {Promise<{success: boolean, httpStatus?: number, message: string}>}
   */
  async test(destination, env) {
    const testNotification = {
      topic: "gateway.test",
      title: "Gateway Test",
      message: "Telegram destination connection verified successfully.",
      severity: "info",
      metadata: { test: true }
    };
    const res = await this.send(destination, testNotification, env);
    return {
      success: res.success,
      httpStatus: res.httpStatus,
      message: res.success ? "Test Telegram message sent successfully" : (res.errorMessage || "Failed to send Telegram message")
    };
  }

  /**
   * Formats the notification safely with HTML markup, truncating if over 4096 characters
   * @param {object} notification 
   * @returns {string}
   */
  formatTelegramMessage(notification) {
    const severity = (notification.severity || "info").toUpperCase();
    const topic = escapeHtml(notification.topic || "");
    const title = escapeHtml(notification.title || "Notification");
    const message = escapeHtml(notification.message || "");

    let formatted = `<b>[${severity}] ${title}</b>\n<i>Topic: ${topic}</i>\n\n${message}`;

    if (notification.metadata && Object.keys(notification.metadata).length > 0) {
      const metaJson = escapeHtml(JSON.stringify(notification.metadata, null, 2));
      formatted += `\n\n<pre>${metaJson}</pre>`;
    }

    if (formatted.length > TELEGRAM_MAX_TEXT_LENGTH) {
      formatted = formatted.slice(0, TELEGRAM_MAX_TEXT_LENGTH - 15) + "\n...[truncated]";
    }

    return formatted;
  }
}
