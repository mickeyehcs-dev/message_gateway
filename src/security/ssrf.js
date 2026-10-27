/**
 * Server-Side Request Forgery (SSRF) Prevention
 * Validates URLs before HTTP requests are dispatched to external providers
 */

// Private IPv4 ranges
const PRIVATE_IPV4_PATTERNS = [
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,           // 127.0.0.0/8 (Loopback)
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,            // 10.0.0.0/8 (Private)
  /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/, // 172.16.0.0/12 (Private)
  /^192\.168\.\d{1,3}\.\d{1,3}$/,              // 192.168.0.0/16 (Private)
  /^169\.254\.\d{1,3}\.\d{1,3}$/,              // 169.254.0.0/16 (Link-local / AWS metadata)
  /^0\.0\.0\.0$/,                              // 0.0.0.0
  /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\.\d{1,3}\.\d{1,3}$/ // CGNAT 100.64.0.0/10
];

const FORBIDDEN_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "local",
  "internal",
  "metadata.google.internal",
  "instance-data"
]);

/**
 * Validates an external provider URL to prevent SSRF
 * @param {string} urlString 
 * @param {boolean} allowHttp - Whether plain http:// is permitted (default: false, https only)
 * @returns {{valid: boolean, error?: string, parsedUrl?: URL}}
 */
export function validateExternalUrl(urlString, allowHttp = false) {
  if (typeof urlString !== "string" || !urlString.trim()) {
    return { valid: false, error: "URL string is required" };
  }

  let parsed;
  try {
    parsed = new URL(urlString.trim());
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  // Scheme verification
  if (parsed.protocol !== "https:" && (!allowHttp || parsed.protocol !== "http:")) {
    return { valid: false, error: "Only HTTPS URLs are permitted" };
  }

  // Reject credentials in URL (e.g. https://user:pass@example.com)
  if (parsed.username || parsed.password) {
    return { valid: false, error: "URLs containing user credentials are not allowed" };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Check forbidden hostnames
  if (FORBIDDEN_HOSTNAMES.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    return { valid: false, error: `Forbidden target host: ${hostname}` };
  }

  // Check IPv4 private and loopback ranges
  for (const pattern of PRIVATE_IPV4_PATTERNS) {
    if (pattern.test(hostname)) {
      return { valid: false, error: `Direct access to private IP address ${hostname} is blocked` };
    }
  }

  // Check IPv6 addresses (enclosed in brackets, e.g. [::1])
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    const rawIp = hostname.slice(1, -1).toLowerCase();
    if (
      rawIp === "::1" ||
      rawIp === "0:0:0:0:0:0:0:1" ||
      rawIp === "::" ||
      rawIp.startsWith("fe80:") || // Link-local
      rawIp.startsWith("fc00:") || // Unique local
      rawIp.startsWith("fd00:")
    ) {
      return { valid: false, error: `Direct access to private IPv6 address ${hostname} is blocked` };
    }
  }

  return { valid: true, parsedUrl: parsed };
}
