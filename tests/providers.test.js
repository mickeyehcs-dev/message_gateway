import { describe, it, expect, vi, afterEach } from "vitest";
import { EmailProvider } from "../src/providers/email.js";
import { TelegramProvider } from "../src/providers/telegram.js";
import { WebPushProvider } from "../src/providers/webpush.js";
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

  describe("WebPush Provider & SSRF Prevention", () => {
    it("should block private IPv4 and loopback addresses", () => {
      expect(validateExternalUrl("https://localhost/push").valid).toBe(false);
      expect(validateExternalUrl("https://127.0.0.1/push").valid).toBe(false);
      expect(validateExternalUrl("https://10.0.0.1/push").valid).toBe(false);
      expect(validateExternalUrl("https://192.168.1.1/push").valid).toBe(false);
      expect(validateExternalUrl("https://169.254.169.254/latest/meta-data").valid).toBe(false);
      expect(validateExternalUrl("https://[::1]/push").valid).toBe(false);
    });

    it("should allow valid public HTTPS push service URLs", () => {
      expect(validateExternalUrl("https://fcm.googleapis.com/fcm/send/sub-id").valid).toBe(true);
      expect(validateExternalUrl("https://updates.push.services.mozilla.com/wpush/v2/sub-id").valid).toBe(true);
      expect(validateExternalUrl("https://web.push.apple.com/sub-id").valid).toBe(true);
    });

    it("should block URLs with embedded user credentials", () => {
      expect(validateExternalUrl("https://user:password@fcm.googleapis.com").valid).toBe(false);
    });

    it("should block plain HTTP push endpoints", () => {
      expect(validateExternalUrl("http://push.example.com", false).valid).toBe(false);
    });

    it("should reject SSRF when webpush destination targets a private IP", async () => {
      const webpushProvider = new WebPushProvider();
      const destination = {
        config_json: JSON.stringify({
          endpoint: "https://127.0.0.1:8080/push",
          keys: { p256dh: "key", auth: "auth" }
        })
      };

      const outcome = await webpushProvider.send(destination, { message: "Test" }, {});
      expect(outcome.success).toBe(false);
      expect(outcome.errorMessage).toContain("security check failed");
    });

    it("should successfully deliver a web push notification to a public endpoint", async () => {
      const webpushProvider = new WebPushProvider();

      // Mock push server endpoint
      vi.stubGlobal("fetch", vi.fn(async (url, opts) => {
        return new Response("OK", { status: 201 });
      }));

      // Generate real ephemeral client ECDH keys for valid test encryption
      const clientKeyPair = await crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveBits"]
      );
      const rawClientPub = await crypto.subtle.exportKey("raw", clientKeyPair.publicKey);
      const toB64Url = (buf) => Buffer.from(buf).toString("base64url");
      const clientAuth = crypto.getRandomValues(new Uint8Array(16));

      const destination = {
        id: 1,
        config_json: JSON.stringify({
          endpoint: "https://fcm.googleapis.com/fcm/send/test-sub-123",
          keys: {
            p256dh: toB64Url(rawClientPub),
            auth: toB64Url(clientAuth)
          },
          click_url: "/admin#events"
        })
      };

      const outcome = await webpushProvider.send(destination, {
        topic: "ops.alerts",
        title: "Database Alert",
        message: "High memory utilization",
        severity: "warning"
      }, {});

      expect(outcome.success).toBe(true);
      expect(outcome.httpStatus).toBe(201);
    });

    it("should handle 410 Gone for expired browser subscriptions", async () => {
      const webpushProvider = new WebPushProvider();

      vi.stubGlobal("fetch", vi.fn(async () => {
        return new Response("Unregistered", { status: 410 });
      }));

      const clientKeyPair = await crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveBits"]
      );
      const rawClientPub = await crypto.subtle.exportKey("raw", clientKeyPair.publicKey);
      const toB64Url = (buf) => Buffer.from(buf).toString("base64url");

      const destination = {
        id: 2,
        config_json: JSON.stringify({
          endpoint: "https://fcm.googleapis.com/fcm/send/expired-sub",
          keys: {
            p256dh: toB64Url(rawClientPub),
            auth: toB64Url(crypto.getRandomValues(new Uint8Array(16)))
          }
        })
      };

      const outcome = await webpushProvider.send(destination, { message: "Test" }, {});
      expect(outcome.success).toBe(false);
      expect(outcome.httpStatus).toBe(410);
      expect(outcome.errorMessage).toContain("expired or was unsubscribed");
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
