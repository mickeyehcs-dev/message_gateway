const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff"
};

const SEVERITIES = new Set(["info", "warning", "error", "critical"]);
const DESTINATION_TYPES = new Set(["email", "telegram", "ntfy"]);
const MAX_BODY_BYTES = 32 * 1024;

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders }
  });
}

function fail(message, status = 400, details = undefined) {
  return json({ ok: false, error: message, ...(details ? { details } : {}) }, status);
}

function corsHeaders(request, env) {
  // API-only by default. Set CORS_ORIGIN to one exact origin if a trusted
  // browser-based admin UI is added later. Never use "*" with credentials.
  const origin = request.headers.get("Origin");
  const allowed = env.CORS_ORIGIN;
  if (origin && allowed && origin === allowed) {
    return {
      "access-control-allow-origin": allowed,
      "access-control-allow-methods": "GET, POST, PATCH, OPTIONS",
      "access-control-allow-headers": "Authorization, Content-Type, Idempotency-Key",
      "vary": "Origin"
    };
  }
  return {};
}

function withCors(response, headers) {
  const out = new Response(response.body, response);
  for (const [key, value] of Object.entries(headers)) out.headers.set(key, value);
  return out;
}

function bearer(request) {
  const value = request.headers.get("Authorization") || "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(prefix = "ngw") {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return `${prefix}_${raw}`;
}

function validSlug(value) {
  return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(value);
}

function safeText(value, max = 2000) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

async function readJson(request) {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_BODY_BYTES) throw new Error("Request body too large");
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) throw new Error("Request body too large");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Body must be valid JSON");
  }
}

async function requireAdmin(request, env) {
  const supplied = bearer(request);
  if (!supplied || !env.ADMIN_API_KEY) return false;
  // Constant-time comparison of fixed-size hashes.
  const [a, b] = await Promise.all([sha256Hex(supplied), sha256Hex(env.ADMIN_API_KEY)]);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function requireSource(request, env) {
  const supplied = bearer(request);
  if (!supplied) return null;
  const hash = await sha256Hex(supplied);
  return await env.DB.prepare(
    "SELECT id, name, enabled FROM sources WHERE token_hash = ? LIMIT 1"
  ).bind(hash).first();
}

async function deriveEncryptionKey(secret) {
  if (!secret || secret.length < 32) throw new Error("DESTINATION_ENCRYPTION_KEY must be at least 32 characters");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptSecret(value, env) {
  if (!value) return null;
  const key = await deriveEncryptionKey(env.DESTINATION_ENCRYPTION_KEY);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(value);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptSecret(value, env) {
  if (!value) return "";
  const combined = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const key = await deriveEncryptionKey(env.DESTINATION_ENCRYPTION_KEY);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

async function logDelivery(env, eventId, destinationId, status, httpStatus, responseText) {
  await env.DB.prepare(`
    INSERT INTO delivery_logs (event_id, destination_id, status, http_status, response_excerpt, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).bind(eventId, destinationId, status, httpStatus ?? null, String(responseText || "").slice(0, 1000)).run();
}

async function sendEmail(destination, env, message) {
  if (!env.EMAIL_API_KEY) throw new Error("EMAIL_API_KEY Worker secret is not configured");
  const cfg = JSON.parse(destination.config_json);
  const response = await fetch(env.EMAIL_API_URL || "https://sender-api.mickey.qzz.io/api/v1/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": env.EMAIL_API_KEY
    },
    body: JSON.stringify({
      to: cfg.to,
      subject: message.subject || `[${message.severity.toUpperCase()}] ${message.topic}`,
      html: message.html || buildEmailHtml(message),
      sender_id: cfg.sender_id || env.EMAIL_SENDER_ID
    }),
    signal: AbortSignal.timeout(10000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Email provider returned HTTP ${response.status}: ${text.slice(0, 300)}`);
  return { httpStatus: response.status, responseText: text };
}

async function sendTelegram(destination, env, message) {
  const cfg = JSON.parse(destination.config_json);
  const botToken = await decryptSecret(destination.secret_ciphertext, env);
  if (!botToken) throw new Error("Telegram bot token is missing");
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const body = {
    chat_id: cfg.chat_id,
    text: formatPlainText(message),
    disable_web_page_preview: true
  };
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Telegram API returned HTTP ${response.status}: ${text.slice(0, 300)}`);
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = {}; }
  if (parsed.ok === false) throw new Error(`Telegram API error: ${String(parsed.description || "unknown error").slice(0, 300)}`);
  return { httpStatus: response.status, responseText: text };
}

async function sendNtfy(destination, env, message) {
  const cfg = JSON.parse(destination.config_json);
  const base = String(cfg.base_url || "https://ntfy.sh").replace(/\/+$/, "");
  const topic = String(cfg.topic || "");
  // Only allow an origin-like base URL; no embedded credentials.
  const parsed = new URL(base);
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error("Invalid ntfy base_url");
  }
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(topic)) throw new Error("Invalid ntfy topic");
  const headers = {
    "Content-Type": "application/json",
    "Title": (message.subject || `${message.severity.toUpperCase()}: ${message.topic}`).slice(0, 250),
    "Priority": message.severity === "critical" ? "urgent" : message.severity === "error" ? "high" : message.severity === "warning" ? "default" : "low",
    "Tags": message.severity === "critical" ? "rotating_light" : "bell"
  };
  const token = await decryptSecret(destination.secret_ciphertext, env);
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${base}/${encodeURIComponent(topic)}`, {
    method: "POST",
    headers,
    body: message.message,
    signal: AbortSignal.timeout(10000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`ntfy returned HTTP ${response.status}: ${text.slice(0, 300)}`);
  return { httpStatus: response.status, responseText: text };
}

function formatPlainText(message) {
  const lines = [
    `[${message.severity.toUpperCase()}] ${message.topic}`,
    `Source: ${message.source_name}`,
    message.message
  ];
  if (message.metadata && Object.keys(message.metadata).length) {
    lines.push(`Metadata: ${JSON.stringify(message.metadata).slice(0, 1500)}`);
  }
  return lines.join("\n").slice(0, 3900);
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function buildEmailHtml(message) {
  const metadata = message.metadata && Object.keys(message.metadata).length
    ? `<pre style="white-space:pre-wrap;background:#f4f4f5;padding:12px;border-radius:8px">${escapeHtml(JSON.stringify(message.metadata, null, 2).slice(0, 5000))}</pre>`
    : "";
  return `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#18181b">
    <div style="padding:16px;background:#111827;color:white;border-radius:10px 10px 0 0">
      <strong>${escapeHtml(message.severity.toUpperCase())}</strong> · ${escapeHtml(message.topic)}
    </div>
    <div style="padding:20px;border:1px solid #e4e4e7;border-radius:0 0 10px 10px">
      <p><strong>Source:</strong> ${escapeHtml(message.source_name)}</p>
      <p style="white-space:pre-wrap">${escapeHtml(message.message)}</p>
      ${metadata}
      <p style="font-size:12px;color:#71717a">Notification Gateway</p>
    </div>
  </div>`;
}

async function deliverToDestination(destination, env, message) {
  try {
    let result;
    if (destination.type === "email") result = await sendEmail(destination, env, message);
    else if (destination.type === "telegram") result = await sendTelegram(destination, env, message);
    else if (destination.type === "ntfy") result = await sendNtfy(destination, env, message);
    else throw new Error("Unsupported destination type");
    await logDelivery(env, message.event_id, destination.id, "success", result.httpStatus, result.responseText);
    return { destination_id: destination.id, name: destination.name, type: destination.type, status: "success", http_status: result.httpStatus };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown delivery error";
    await logDelivery(env, message.event_id, destination.id, "failed", null, reason).catch(() => {});
    return { destination_id: destination.id, name: destination.name, type: destination.type, status: "failed", error: reason };
  }
}

async function createEvent(env, event) {
  const result = await env.DB.prepare(`
    INSERT INTO events (source_id, topic, severity, message, metadata_json, idempotency_key, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    event.source_id, event.topic, event.severity, event.message,
    JSON.stringify(event.metadata || {}), event.idempotency_key || null
  ).run();
  return result.meta.last_row_id;
}

async function handleNotify(request, env) {
  const source = await requireSource(request, env);
  if (!source || !source.enabled) return fail("Invalid or disabled source token", 401);

  let body;
  try { body = await readJson(request); }
  catch (e) { return fail(e.message, 400); }

  if (!validSlug(body.topic)) return fail("topic is required and must be an explicit topic slug");
  if (!SEVERITIES.has(body.severity || "info")) return fail("severity must be info, warning, error, or critical");
  if (!safeText(body.message, 10000)) return fail("message is required (maximum 10000 characters)");
  if (body.subject !== undefined && !safeText(body.subject, 250)) return fail("subject must be 1-250 characters");
  if (body.html !== undefined && (!safeText(body.html, 20000))) return fail("html must be 1-20000 characters");
  if (body.metadata !== undefined && (body.metadata === null || typeof body.metadata !== "object" || Array.isArray(body.metadata))) {
    return fail("metadata must be a JSON object");
  }
  const severity = body.severity || "info";
  const topic = await env.DB.prepare("SELECT name FROM topics WHERE name = ? AND enabled = 1").bind(body.topic).first();
  if (!topic) return fail("Unknown or disabled topic. Wildcards are not supported; register the topic first.", 422);

  const permission = await env.DB.prepare(
    "SELECT 1 AS allowed FROM source_topics WHERE source_id = ? AND topic_name = ?"
  ).bind(source.id, body.topic).first();
  if (!permission) return fail("This source is not authorized to publish this topic", 403);

  const idempotencyKey = body.idempotency_key || request.headers.get("Idempotency-Key") || null;
  if (idempotencyKey !== null && (typeof idempotencyKey !== "string" || idempotencyKey.length < 1 || idempotencyKey.length > 128)) {
    return fail("idempotency_key must be 1-128 characters");
  }
  if (idempotencyKey) {
    const existing = await env.DB.prepare(
      "SELECT id, created_at FROM events WHERE source_id = ? AND idempotency_key = ?"
    ).bind(source.id, idempotencyKey).first();
    if (existing) return json({ ok: true, duplicate: true, event_id: existing.id, created_at: existing.created_at });
  }

  const event = {
    source_id: source.id,
    source_name: source.name,
    topic: body.topic,
    severity,
    message: body.message,
    subject: body.subject,
    html: body.html,
    metadata: body.metadata || {},
    idempotency_key: idempotencyKey
  };
  let eventId;
  try {
    eventId = await createEvent(env, event);
  } catch (e) {
    if (idempotencyKey) {
      const existing = await env.DB.prepare("SELECT id, created_at FROM events WHERE source_id = ? AND idempotency_key = ?")
        .bind(source.id, idempotencyKey).first();
      if (existing) return json({ ok: true, duplicate: true, event_id: existing.id, created_at: existing.created_at });
    }
    return fail("Could not record event", 500);
  }
  event.event_id = eventId;

  const rows = await env.DB.prepare(`
    SELECT DISTINCT d.id, d.name, d.type, d.config_json, d.secret_ciphertext
    FROM subscriptions s
    JOIN topics t ON t.id = s.topic_id AND t.enabled = 1
    JOIN destinations d ON d.enabled = 1
    LEFT JOIN recipient_groups rg ON rg.id = s.group_id AND rg.enabled = 1
    LEFT JOIN group_members gm ON gm.destination_id = d.id AND gm.enabled = 1
    WHERE s.enabled = 1
      AND t.name = ?
      AND (s.source_id IS NULL OR s.source_id = ?)
      AND (s.severity IS NULL OR s.severity = ?)
      AND (
        s.destination_id = d.id OR
        (s.group_id IS NOT NULL AND rg.id IS NOT NULL AND gm.group_id = s.group_id)
      )
  `).bind(event.topic, source.id, severity).all();

  const destinations = rows.results || [];
  if (!destinations.length) {
    return json({ ok: true, event_id: eventId, matched_destinations: 0, deliveries: [], message: "Event recorded; no active subscriptions matched." });
  }

  // Synchronous delivery: the request waits for every matching provider call.
  // Each provider has a 10-second timeout. Delivery failures are returned per destination.
  const deliveries = await Promise.all(destinations.map((destination) => deliverToDestination(destination, env, event)));
  const failed = deliveries.filter((item) => item.status === "failed").length;
  return json({
    ok: failed === 0,
    event_id: eventId,
    matched_destinations: deliveries.length,
    succeeded: deliveries.length - failed,
    failed,
    deliveries
  }, failed ? 207 : 200);
}

async function adminRoute(request, env, url) {
  if (!(await requireAdmin(request, env))) return fail("Unauthorized", 401);
  const path = url.pathname;
  const method = request.method;

  if (method === "GET" && path === "/v1/admin/topics") {
    const r = await env.DB.prepare("SELECT id, name, description, enabled, created_at FROM topics ORDER BY name").all();
    return json({ ok: true, items: r.results });
  }
  if (method === "POST" && path === "/v1/admin/topics") {
    const b = await readJsonSafe(request); if (b.error) return fail(b.error);
    if (!validSlug(b.name)) return fail("name is required (letters, numbers, dot, underscore, colon, hyphen)");
    const description = typeof b.description === "string" ? b.description.slice(0, 500) : "";
    try {
      await env.DB.prepare("INSERT INTO topics (name, description) VALUES (?, ?)").bind(b.name, description).run();
      return json({ ok: true, name: b.name }, 201);
    } catch { return fail("Topic already exists or could not be created", 409); }
  }

  if (method === "GET" && path === "/v1/admin/sources") {
    const r = await env.DB.prepare("SELECT id, name, enabled, created_at FROM sources ORDER BY id DESC").all();
    return json({ ok: true, items: r.results });
  }
  if (method === "POST" && path === "/v1/admin/sources") {
    const b = await readJsonSafe(request); if (b.error) return fail(b.error);
    if (!safeText(b.name, 100)) return fail("name is required (maximum 100 characters)");
    if (!Array.isArray(b.allowed_topics) || b.allowed_topics.length === 0 || b.allowed_topics.some((t) => !validSlug(t))) {
      return fail("allowed_topics must be a non-empty array of explicit topic names");
    }
    const token = randomToken("ngw_src");
    const hash = await sha256Hex(token);
    let id;
    try {
      const r = await env.DB.prepare("INSERT INTO sources (name, token_hash) VALUES (?, ?)").bind(b.name.trim(), hash).run();
      id = r.meta.last_row_id;
      for (const topicName of [...new Set(b.allowed_topics)]) {
        const exists = await env.DB.prepare("SELECT id FROM topics WHERE name = ? AND enabled = 1").bind(topicName).first();
        if (!exists) {
          await env.DB.prepare("DELETE FROM sources WHERE id = ?").bind(id).run();
          return fail(`Topic does not exist or is disabled: ${topicName}`, 422);
        }
        await env.DB.prepare("INSERT INTO source_topics (source_id, topic_name) VALUES (?, ?)").bind(id, topicName).run();
      }
    } catch { return fail("Could not create source; check name and topics", 409); }
    return json({ ok: true, id, name: b.name.trim(), token, warning: "Copy this token now. It cannot be retrieved later." }, 201);
  }

  if (method === "GET" && path === "/v1/admin/destinations") {
    const r = await env.DB.prepare("SELECT id, name, type, config_json, enabled, created_at FROM destinations ORDER BY id DESC").all();
    return json({ ok: true, items: (r.results || []).map((x) => ({ ...x, config: JSON.parse(x.config_json), config_json: undefined })) });
  }
  if (method === "POST" && path === "/v1/admin/destinations") {
    const b = await readJsonSafe(request); if (b.error) return fail(b.error);
    if (!safeText(b.name, 100) || !DESTINATION_TYPES.has(b.type)) return fail("name and valid type (email, telegram, ntfy) are required");
    let config = {};
    let secret = "";
    if (b.type === "email") {
      if (typeof b.to !== "string" || b.to.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.to)) return fail("A valid email address in 'to' is required");
      if (b.sender_id !== undefined && !safeText(b.sender_id, 100)) return fail("sender_id must be 1-100 characters");
      config = { to: b.to, ...(b.sender_id ? { sender_id: b.sender_id } : {}) };
    } else if (b.type === "telegram") {
      if (!safeText(b.bot_token, 300) || !safeText(String(b.chat_id ?? ""), 100)) return fail("bot_token and chat_id are required");
      secret = b.bot_token;
      config = { chat_id: String(b.chat_id) };
    } else {
      const baseUrl = b.base_url || "https://ntfy.sh";
      let parsed;
      try { parsed = new URL(baseUrl); } catch { return fail("Invalid ntfy base_url"); }
      if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) return fail("ntfy base_url must be an HTTP(S) URL without embedded credentials");
      if (typeof b.topic !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(b.topic)) return fail("ntfy topic is invalid");
      if (b.token !== undefined && !safeText(b.token, 1000)) return fail("ntfy token is invalid");
      secret = b.token || "";
      config = { base_url: baseUrl.replace(/\/+$/, ""), topic: b.topic };
    }
    const encrypted = await encryptSecret(secret, env);
    try {
      const r = await env.DB.prepare("INSERT INTO destinations (name, type, config_json, secret_ciphertext) VALUES (?, ?, ?, ?)")
        .bind(b.name.trim(), b.type, JSON.stringify(config), encrypted).run();
      return json({ ok: true, id: r.meta.last_row_id, name: b.name.trim(), type: b.type }, 201);
    } catch { return fail("Could not create destination", 409); }
  }

  if (method === "GET" && path === "/v1/admin/groups") {
    const r = await env.DB.prepare("SELECT id, name, description, enabled, created_at FROM recipient_groups ORDER BY name").all();
    return json({ ok: true, items: r.results });
  }
  if (method === "POST" && path === "/v1/admin/groups") {
    const b = await readJsonSafe(request); if (b.error) return fail(b.error);
    if (!safeText(b.name, 100)) return fail("name is required");
    try {
      const r = await env.DB.prepare("INSERT INTO recipient_groups (name, description) VALUES (?, ?)")
        .bind(b.name.trim(), typeof b.description === "string" ? b.description.slice(0, 500) : "").run();
      return json({ ok: true, id: r.meta.last_row_id, name: b.name.trim() }, 201);
    } catch { return fail("Group already exists or could not be created", 409); }
  }

  if (method === "POST" && path === "/v1/admin/group-members") {
    const b = await readJsonSafe(request); if (b.error) return fail(b.error);
    if (!Number.isInteger(b.group_id) || !Number.isInteger(b.destination_id)) return fail("group_id and destination_id must be integers");
    try {
      await env.DB.prepare("INSERT INTO group_members (group_id, destination_id) VALUES (?, ?)").bind(b.group_id, b.destination_id).run();
      return json({ ok: true }, 201);
    } catch { return fail("Membership already exists or group/destination is invalid", 409); }
  }
  if (method === "GET" && path === "/v1/admin/group-members") {
    const r = await env.DB.prepare(`
      SELECT gm.group_id, g.name AS group_name, gm.destination_id, d.name AS destination_name, d.type, gm.enabled
      FROM group_members gm JOIN recipient_groups g ON g.id=gm.group_id JOIN destinations d ON d.id=gm.destination_id
      ORDER BY g.name, d.name
    `).all();
    return json({ ok: true, items: r.results });
  }

  if (method === "GET" && path === "/v1/admin/subscriptions") {
    const r = await env.DB.prepare(`
      SELECT s.id, t.name AS topic, s.source_id, src.name AS source_name, s.severity,
             s.destination_id, d.name AS destination_name, s.group_id, g.name AS group_name,
             s.enabled, s.created_at
      FROM subscriptions s JOIN topics t ON t.id=s.topic_id
      LEFT JOIN sources src ON src.id=s.source_id
      LEFT JOIN destinations d ON d.id=s.destination_id
      LEFT JOIN recipient_groups g ON g.id=s.group_id
      ORDER BY s.id DESC
    `).all();
    return json({ ok: true, items: r.results });
  }
  if (method === "POST" && path === "/v1/admin/subscriptions") {
    const b = await readJsonSafe(request); if (b.error) return fail(b.error);
    if (!validSlug(b.topic)) return fail("topic is required");
    if (b.severity != null && !SEVERITIES.has(b.severity)) return fail("severity must be info, warning, error, or critical");
    const hasDest = Number.isInteger(b.destination_id);
    const hasGroup = Number.isInteger(b.group_id);
    if (hasDest === hasGroup) return fail("Provide exactly one of destination_id or group_id");
    const topic = await env.DB.prepare("SELECT id FROM topics WHERE name = ? AND enabled = 1").bind(b.topic).first();
    if (!topic) return fail("Topic does not exist or is disabled", 422);
    if (b.source_id != null && !Number.isInteger(b.source_id)) return fail("source_id must be an integer or null");
    try {
      await env.DB.prepare(`
        INSERT INTO subscriptions (topic_id, source_id, severity, destination_id, group_id)
        VALUES (?, ?, ?, ?, ?)
      `).bind(topic.id, b.source_id ?? null, b.severity ?? null, hasDest ? b.destination_id : null, hasGroup ? b.group_id : null).run();
      return json({ ok: true }, 201);
    } catch { return fail("Could not create subscription; verify referenced IDs and duplicate rules", 409); }
  }

  // Deactivation endpoints preserve audit history.
  const disableMatch = path.match(/^\/v1\/admin\/(sources|destinations|topics|groups|subscriptions|group-members)\/(\d+)\/disable$/);
  if (method === "POST" && disableMatch) {
    const [, entity, rawId] = disableMatch;
    const id = Number(rawId);
    const table = {
      sources: "sources", destinations: "destinations", topics: "topics",
      groups: "recipient_groups", subscriptions: "subscriptions", "group-members": "group_members"
    }[entity];
    const result = await env.DB.prepare(`UPDATE ${table} SET enabled = 0 WHERE id = ?`).bind(id).run();
    if (!result.meta.changes) return fail("Record not found", 404);
    return json({ ok: true, disabled: true });
  }

  if (method === "GET" && path === "/v1/admin/logs") {
    const limitRaw = Number(url.searchParams.get("limit") || 50);
    const limit = Math.min(200, Math.max(1, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 50));
    const r = await env.DB.prepare(`
      SELECT dl.id, dl.event_id, e.topic, e.severity, e.source_id, s.name AS source_name,
             dl.destination_id, d.name AS destination_name, d.type, dl.status,
             dl.http_status, dl.response_excerpt, dl.created_at
      FROM delivery_logs dl JOIN events e ON e.id=dl.event_id
      LEFT JOIN sources s ON s.id=e.source_id
      LEFT JOIN destinations d ON d.id=dl.destination_id
      ORDER BY dl.id DESC LIMIT ?
    `).bind(limit).all();
    return json({ ok: true, items: r.results });
  }

  return fail("Admin endpoint not found", 404);
}

async function readJsonSafe(request) {
  try { return await readJson(request); }
  catch (e) { return { error: e.message }; }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    let response;
    try {
      if (url.pathname === "/health" && request.method === "GET") {
        response = json({ ok: true, service: "universal-notification-gateway" });
      } else if (url.pathname === "/v1/notify" && request.method === "POST") {
        response = await handleNotify(request, env);
      } else if (url.pathname.startsWith("/v1/admin/")) {
        if (!["GET", "POST", "PATCH"].includes(request.method)) response = fail("Method not allowed", 405);
        else response = await adminRoute(request, env, url);
      } else {
        response = fail("Not found", 404);
      }
    } catch (error) {
      // Do not return stack traces, environment values, or provider credentials.
      console.error("gateway_error", { path: url.pathname, message: error instanceof Error ? error.message : "unknown" });
      response = fail("Internal server error", 500);
    }
    return withCors(response, cors);
  }
};
