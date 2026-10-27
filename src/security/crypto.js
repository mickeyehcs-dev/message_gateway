/**
 * Cryptographic operations using the Web Crypto API
 * Compliant with Cloudflare Workers runtime
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Derives a PBKDF2-SHA256 password hash
 * @param {string} password 
 * @param {Uint8Array|string} salt - Base64 string or Uint8Array
 * @param {number} iterations - Minimum 100,000, default 210,000
 * @returns {Promise<{hash: string, salt: string, iterations: number}>}
 */
export async function hashPassword(password, salt = null, iterations = 210000) {
  let saltBytes;
  if (!salt) {
    saltBytes = crypto.getRandomValues(new Uint8Array(16));
  } else if (typeof salt === "string") {
    saltBytes = base64ToUint8Array(salt);
  } else {
    saltBytes = salt;
  }

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  const derivedKey = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: Math.max(100000, iterations),
      hash: "SHA-256"
    },
    keyMaterial,
    256 // 32 bytes
  );

  return {
    hash: uint8ArrayToBase64(new Uint8Array(derivedKey)),
    salt: uint8ArrayToBase64(saltBytes),
    iterations
  };
}

/**
 * Verifies a password against stored PBKDF2 parameters in constant time
 * @param {string} password 
 * @param {string} storedSalt - Base64 encoded salt
 * @param {string} storedHash - Base64 encoded hash
 * @param {number} iterations 
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, storedSalt, storedHash, iterations = 210000) {
  try {
    if (!password || !storedSalt || !storedHash) return false;
    const computed = await hashPassword(password, storedSalt, iterations);
    const computedBytes = base64ToUint8Array(computed.hash);
    const storedBytes = base64ToUint8Array(storedHash);

    if (computedBytes.byteLength !== storedBytes.byteLength) return false;
    return timingSafeEqual(computedBytes, storedBytes);
  } catch {
    return false;
  }
}

/**
 * Constant-time comparison of two Uint8Array buffers
 * @param {Uint8Array} a 
 * @param {Uint8Array} b 
 * @returns {boolean}
 */
export function timingSafeEqual(a, b) {
  if (a.byteLength !== b.byteLength) return false;
  let c = 0;
  for (let i = 0; i < a.byteLength; i++) {
    c |= a[i] ^ b[i];
  }
  return c === 0;
}

/**
 * Generates a SHA-256 hex hash of a string
 * @param {string} str 
 * @returns {Promise<string>}
 */
export async function sha256(str) {
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Computes a deterministic canonical SHA-256 hash of a payload for idempotency verification
 * @param {any} payload 
 * @returns {Promise<string>}
 */
export async function hashPayload(payload) {
  const canonical = canonicalJsonStringify(payload);
  return sha256(canonical);
}

/**
 * Generates a cryptographically secure random token
 * @param {string} prefix - Optional prefix (e.g. "src_")
 * @param {number} bytes - Number of random bytes
 * @returns {string}
 */
export function generateSecureToken(prefix = "", bytes = 32) {
  const random = crypto.getRandomValues(new Uint8Array(bytes));
  let token = "";
  for (let i = 0; i < random.length; i++) {
    token += random[i].toString(16).padStart(2, "0");
  }
  return prefix + token;
}

/**
 * Encrypts a secret string using AES-256-GCM
 * @param {string} secret 
 * @param {string} masterKeySecret - Master encryption key
 * @returns {Promise<string>} Encrypted string format: "iv_base64:ciphertext_base64"
 */
export async function encryptSecret(secret, masterKeySecret) {
  if (!secret) return "";
  if (!masterKeySecret) {
    throw new Error("DESTINATION_ENCRYPTION_KEY is required to encrypt secrets");
  }

  const key = await deriveAesKey(masterKeySecret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(secret);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext
  );

  return `${uint8ArrayToBase64(iv)}:${uint8ArrayToBase64(new Uint8Array(ciphertext))}`;
}

/**
 * Decrypts a secret string using AES-256-GCM
 * @param {string} encrypted - Format: "iv_base64:ciphertext_base64"
 * @param {string} masterKeySecret 
 * @returns {Promise<string>}
 */
export async function decryptSecret(encrypted, masterKeySecret) {
  if (!encrypted) return "";
  if (!masterKeySecret) {
    throw new Error("DESTINATION_ENCRYPTION_KEY is required to decrypt secrets");
  }

  const parts = encrypted.split(":");
  if (parts.length !== 2) {
    throw new Error("Invalid encrypted secret format");
  }

  const iv = base64ToUint8Array(parts[0]);
  const ciphertext = base64ToUint8Array(parts[1]);
  const key = await deriveAesKey(masterKeySecret);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return decoder.decode(decrypted);
}

// Internal helper to derive AES-256 key from a master secret passphrase
async function deriveAesKey(masterKeySecret) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(masterKeySecret),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("universal-notification-gateway-salt"),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Canonical JSON stringification for deterministic hash calculation
function canonicalJsonStringify(obj) {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalJsonStringify).join(",") + "]";
  }
  const keys = Object.keys(obj).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + canonicalJsonStringify(obj[k])).join(",") + "}";
}

// Base64 converters compatible with Cloudflare Workers Web Crypto
export function uint8ArrayToBase64(uint8Array) {
  let binary = "";
  const len = uint8Array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
