/**
 * VAPID (Voluntary Application Server Identification) Key Management
 * RFC 8292 & Web Push Cryptography
 */

import { queryFirst, execute } from "../db/index.js";

/**
 * Encodes an ArrayBuffer or Uint8Array to base64url string without padding
 * @param {ArrayBuffer|Uint8Array} buffer 
 * @returns {string}
 */
export function uint8ArrayToBase64Url(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Decodes a base64 or base64url string to Uint8Array
 * @param {string} base64Url 
 * @returns {Uint8Array}
 */
export function base64UrlToUint8Array(base64Url) {
  let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generates an ECDSA P-256 VAPID keypair using Web Crypto
 * @returns {Promise<{publicKey: string, privateKey: string}>}
 */
export async function generateVapidKeys() {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );

  const jwkPrivate = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const rawPublic = await crypto.subtle.exportKey("raw", keyPair.publicKey);

  return {
    publicKey: uint8ArrayToBase64Url(new Uint8Array(rawPublic)),
    privateKey: jwkPrivate.d
  };
}

/**
 * Retrieves VAPID keys from env bindings, or persistent DB settings, or generates and stores them.
 * @param {object} db - D1 Database binding
 * @param {object} env - Cloudflare Workers environment bindings
 * @returns {Promise<{publicKey: string, privateKey: string, subject: string}>}
 */
export async function getOrGenerateVapidKeys(db, env = {}) {
  // 1. Env bindings have highest precedence if provided
  if (env && env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: env.VAPID_PUBLIC_KEY.trim(),
      privateKey: env.VAPID_PRIVATE_KEY.trim(),
      subject: (env.VAPID_SUBJECT || "mailto:admin@notification-gateway.local").trim()
    };
  }

  // 2. Check if DB has stored keys
  if (db) {
    try {
      const stored = await queryFirst(
        db,
        "SELECT value FROM system_settings WHERE key = 'vapid_keys'"
      );
      if (stored && stored.value) {
        const parsed = JSON.parse(stored.value);
        if (parsed.publicKey && parsed.privateKey) {
          return {
            publicKey: parsed.publicKey,
            privateKey: parsed.privateKey,
            subject: parsed.subject || "mailto:admin@notification-gateway.local"
          };
        }
      }

      // Generate fresh keypair and persist in system_settings
      const generated = await generateVapidKeys();
      const payload = {
        publicKey: generated.publicKey,
        privateKey: generated.privateKey,
        subject: (env && env.VAPID_SUBJECT) ? env.VAPID_SUBJECT.trim() : "mailto:admin@notification-gateway.local"
      };

      await execute(
        db,
        `
        INSERT INTO system_settings (key, value, created_at, updated_at)
        VALUES ('vapid_keys', ?, datetime('now'), datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
        `,
        [JSON.stringify(payload)]
      );

      return payload;
    } catch {
      // Fall through to memory generation if DB table not yet ready
    }
  }

  // 3. Fallback generation
  const generated = await generateVapidKeys();
  return {
    publicKey: generated.publicKey,
    privateKey: generated.privateKey,
    subject: "mailto:admin@notification-gateway.local"
  };
}
