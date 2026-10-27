/**
 * Redaction utility to scrub secrets, keys, and authorization headers from logs and responses
 */

const SECRET_PATTERNS = [
  // Bearer tokens and Authorization headers
  /(Bearer\s+)[A-Za-z0-9_\-\.=]+/gi,
  /(authorization:\s*)[^\s,]+/gi,
  // Telegram bot tokens (e.g. 123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11)
  /(bot\d+:)[A-Za-z0-9_-]+/gi,
  /(\/bot)[0-9]+:[A-Za-z0-9_-]+/gi,
  // API keys and secrets in query strings or JSON
  /((?:api[_-]?key|token|secret|password|credential)[":=\s]+)["']?[A-Za-z0-9_\-\.=]+["']?/gi,
  // Generic hex/base64 tokens longer than 24 chars
  /(?:key|token|auth)=([A-Za-z0-9_\-\.]{20,})/gi
];

/**
 * Redacts known sensitive patterns from a string or error message
 * @param {string} text 
 * @returns {string} Sanitized text
 */
export function sanitizeLogString(text) {
  if (typeof text !== "string") return "";
  let sanitized = text;

  // Redact Telegram bot token in URLs: https://api.telegram.org/bot<token>/sendMessage -> /bot[REDACTED]/sendMessage
  sanitized = sanitized.replace(/\/bot\d+:[A-Za-z0-9_-]+/gi, "/bot[REDACTED]");

  // Redact Bearer tokens
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, "Bearer [REDACTED]");

  // Redact API key / secret query parameters
  sanitized = sanitized.replace(/([?&](?:key|api_key|token|secret|auth)=)[^&]+/gi, "$1[REDACTED]");

  // Apply general secret patterns
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) => {
      if (match.toLowerCase().includes("bearer")) return "Bearer [REDACTED]";
      return "[REDACTED]";
    });
  }

  // Bound length to prevent denial of service via huge logs
  if (sanitized.length > 2000) {
    sanitized = sanitized.slice(0, 2000) + "... [truncated]";
  }

  return sanitized;
}

/**
 * Creates a sanitized representation of headers for logging
 * @param {Headers} headers 
 * @returns {Record<string, string>}
 */
export function sanitizeHeaders(headers) {
  const result = {};
  if (!headers || typeof headers.entries !== "function") return result;

  for (const [key, value] of headers.entries()) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === "authorization" || lowerKey === "cookie" || lowerKey === "set-cookie" || lowerKey.includes("key") || lowerKey.includes("secret") || lowerKey.includes("token")) {
      result[key] = "[REDACTED]";
    } else {
      result[key] = value;
    }
  }

  return result;
}
