import { describe, it, expect, vi, afterEach } from "vitest";
import { EmailProvider } from "../src/providers/email.js";
import { TelegramProvider } from "../src/providers/telegram.js";
import { NtfyProvider } from "../src/providers/ntfy.js";
import { validateExternalUrl } from "../src/security/ssrf.js";
import { sanitizeLogString, sanitizeHeaders } from "../src/security/redaction.js";

describe("Provider Adapters & Security", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Email Provider", () => {
    it("should successfully deliver an email", async () => {
      const emailProvider = new EmailProvider();
      vi.stubGlobal("fetch", vi.fn(async (url, opts) => {
        const body = JSON.parse(opts.body);
        expect(body.to).toBe("user@example.com");
        expect(body.sender_id).toBe("snd_test");
        expect(opts.headers["X-API-Key"]).toBe("valid-api-key");
        return new Response("OK", { status: 200 });
      }));

      const destination = {
        config_json: JSON.stringify({ to: "user@example.com", sender_id: "snd_test" }),
        secret_ciphertext: null
      };

      const outcome = await emailProvider.send(destination, {
        topic: "test.topic",
        title: "Test Email",
        message: "Hello world",
        severity: "info"
      }, { EMAIL_API_KEY: "valid-api-key" });

      expect(outcome.success).toBe(true);
      expect(outcome.httpStatus).toBe(200);
    });

    it("should fail gracefully when recipient email is invalid", async () => {
      const emailProvider = new EmailProvider();
      const destination = {
        config_json: JSON.stringify({ to: "not-an-email", sender_id: "snd_test" })
      };

      const outcome = await emailProvider.send(destination, { message: "Test" }, {});
      expect(outcome.success).toBe(false);
      expect(outcome.errorMessage).toContain("Invalid recipient email");
    });
  });

  describe("Telegram Provider", () => {
    it("should deliver a message and truncate if length exceeds Telegram limits", async () => {
      const telegramProvider = new TelegramProvider();
      let sentText = "";

      vi.stubGlobal("fetch", vi.fn(async (url, opts) => {
        const body = JSON.parse(opts.body);
        sentText = body.text;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }));

      const destination = {
        config_json: JSON.stringify({ chat_id: "12345" }),
        secret_ciphertext: null
      };

      // Oversized message
      const largeMessage = "A".repeat(5000);
      const outcome = await telegramProvider.send(destination, {
        topic: "oversized.test",
        title: "Big Alert",
        message: largeMessage,
        severity: "warning"
      }, { TELEGRAM_BOT_TOKEN: "123:abc" });

      expect(outcome.success).toBe(true);
      expect(sentText.length).toBeLessThanOrEqual(4096);
      expect(sentText).toContain("[truncated]");
    });
  });

  describe("ntfy Provider & SSRF Prevention", () => {
    it("should block private IPv4 and loopback addresses", () => {
      expect(validateExternalUrl("https://localhost/topic").valid).toBe(false);
      expect(validateExternalUrl("https://127.0.0.1/topic").valid).toBe(false);
      expect(validateExternalUrl("https://10.0.0.1/topic").valid).toBe(false);
      expect(validateExternalUrl("https://192.168.1.1/topic").valid).toBe(false);
      expect(validateExternalUrl("https://169.254.169.254/latest/meta-data").valid).toBe(false);
      expect(validateExternalUrl("https://[::1]/topic").valid).toBe(false);
    });

    it("should allow valid public HTTPS URLs", () => {
      expect(validateExternalUrl("https://ntfy.sh").valid).toBe(true);
      expect(validateExternalUrl("https://ntfy.example.com").valid).toBe(true);
    });

    it("should block URLs with embedded user credentials", () => {
      expect(validateExternalUrl("https://user:password@ntfy.sh").valid).toBe(false);
    });

    it("should block plain HTTP by default", () => {
      expect(validateExternalUrl("http://ntfy.example.com", false).valid).toBe(false);
      expect(validateExternalUrl("http://ntfy.example.com", true).valid).toBe(true);
    });

    it("should reject SSRF when ntfy destination targets a private IP", async () => {
      const ntfyProvider = new NtfyProvider();
      const destination = {
        config_json: JSON.stringify({ base_url: "https://127.0.0.1:8080", topic: "alerts" })
      };

      const outcome = await ntfyProvider.send(destination, { message: "Test" }, { ALLOW_HTTP_NTFY: "false" });
      expect(outcome.success).toBe(false);
      expect(outcome.errorMessage).toContain("security check failed");
    });
  });

  describe("Secret Redaction", () => {
    it("should redact Telegram bot tokens from URLs and logs", () => {
      const log = "Request failed to https://api.telegram.org/bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz/sendMessage";
      const sanitized = sanitizeLogString(log);
      expect(sanitized).not.toContain("123456789:ABCdefGHIjklMNOpqrsTUVwxyz");
      expect(sanitized).toContain("/bot[REDACTED]");
    });

    it("should redact Bearer authorization tokens from error text", () => {
      const log = "Provider returned error with header Authorization: Bearer secret_token_xyz123";
      const sanitized = sanitizeLogString(log);
      expect(sanitized).not.toContain("secret_token_xyz123");
      expect(sanitized).toContain("Bearer [REDACTED]");
    });

    it("should redact authorization and secret headers in dictionary sanitization", () => {
      const headers = new Headers();
      headers.set("Authorization", "Bearer my-secret-session");
      headers.set("X-API-Key", "my-api-key");
      headers.set("Content-Type", "application/json");

      const sanitized = sanitizeHeaders(headers);
      expect(sanitized["authorization"]).toBe("[REDACTED]");
      expect(sanitized["x-api-key"]).toBe("[REDACTED]");
      expect(sanitized["content-type"]).toBe("application/json");
    });
  });
});
