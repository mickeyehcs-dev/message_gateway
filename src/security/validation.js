/**
 * Request validation and schema checks
 */

export const ALLOWED_SEVERITIES = new Set(["info", "warning", "error", "critical"]);
export const MAX_BODY_SIZE_BYTES = 64 * 1024; // 64 KB

/**
 * Validates and normalizes a topic identifier
 * Topics must be lowercase, alphanumeric with . _ - :, 1 to 100 characters
 * @param {string} topic 
 * @returns {string|null} Normalized topic or null if invalid
 */
export function normalizeTopic(topic) {
  if (typeof topic !== "string") return null;
  const trimmed = topic.trim().toLowerCase();
  const validRegex = /^[a-z0-9][a-z0-9._:-]{0,99}$/;
  if (!validRegex.test(trimmed)) return null;
  return trimmed;
}

/**
 * Validates severity string
 * @param {string} severity 
 * @returns {boolean}
 */
export function isValidSeverity(severity) {
  return typeof severity === "string" && ALLOWED_SEVERITIES.has(severity.toLowerCase());
}

/**
 * Validates email address format
 * @param {string} email 
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (typeof email !== "string" || email.length > 254) return false;
  // RFC 5322 compatible regex subset
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(email);
}

/**
 * Validates administrator username
 * @param {string} username 
 * @returns {boolean}
 */
export function isValidAdminUsername(username) {
  if (typeof username !== "string") return false;
  const trimmed = username.trim();
  return /^[A-Za-z0-9._-]{3,64}$/.test(trimmed);
}

/**
 * Validates administrator password requirements
 * @param {string} password 
 * @returns {boolean}
 */
export function isValidAdminPassword(password) {
  return typeof password === "string" && password.length >= 12 && password.length <= 256;
}

/**
 * Validates source name
 * @param {string} name 
 * @returns {boolean}
 */
export function isValidSourceName(name) {
  if (typeof name !== "string") return false;
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= 100 && /^[A-Za-z0-9 ._-]+$/.test(trimmed);
}

/**
 * Safely parses JSON with a strict size limit
 * @param {Request} request 
 * @param {number} maxBytes 
 * @returns {Promise<{data: any, error: string|null}>}
 */
export async function readJsonSafe(request, maxBytes = MAX_BODY_SIZE_BYTES) {
  try {
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > maxBytes) {
      return { data: null, error: `Request body exceeds maximum size of ${maxBytes} bytes` };
    }

    const text = await request.text();
    if (new TextEncoder().encode(text).length > maxBytes) {
      return { data: null, error: `Request body exceeds maximum size of ${maxBytes} bytes` };
    }

    if (!text || text.trim() === "") {
      return { data: null, error: "Empty request body" };
    }

    const data = JSON.parse(text);
    return { data, error: null };
  } catch (err) {
    return { data: null, error: "Invalid JSON payload: " + (err instanceof Error ? err.message : "Malformed syntax") };
  }
}

/**
 * HTML entities escaping for safe rendering in HTML contexts
 * @param {string} str 
 * @returns {string}
 */
export function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
