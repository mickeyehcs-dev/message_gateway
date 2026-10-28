/**
 * HTTP Router and Route Dispatcher
 */

import { readJsonSafe } from "./security/validation.js";
import { loginAdmin, authenticateAdmin, logoutAdmin, cleanupExpiredSessions } from "./auth/admin.js";
import { authenticateSource } from "./auth/source.js";
import { processNotification } from "./services/routing.js";
import * as adminService from "./services/admin.js";
import * as webpushService from "./services/webpush.js";
import { renderDashboardHtml } from "./ui/dashboard.js";
import { renderServiceWorkerJs } from "./ui/service-worker.js";
import { getOrGenerateVapidKeys, generateVapidKeys } from "./security/vapid.js";
import { queryFirst, execute } from "./db/index.js";

/**
 * Standard JSON response helper
 */
export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders
    }
  });
}

/**
 * Standard error response helper
 */
export function fail(error, status = 400, details = null) {
  const body = { ok: false, error };
  if (details) body.details = details;
  return json(body, status);
}

/**
 * Computes CORS and Security Headers
 */
export function getCorsAndSecurityHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowedOrigin = env.CORS_ORIGIN || null;

  const headers = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer"
  };

  if (allowedOrigin && origin && (allowedOrigin === "*" || allowedOrigin === origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, DELETE, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Idempotency-Key";
    headers["Access-Control-Max-Age"] = "86400";
  }

  return headers;
}

/**
 * Attaches security headers to any response
 */
export function applySecurityHeaders(response, securityHeaders) {
  const newHeaders = new Headers(response.headers);
  for (const [key, val] of Object.entries(securityHeaders)) {
    if (!newHeaders.has(key)) {
      newHeaders.set(key, val);
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

/**
 * Main request router
 */
export async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const securityHeaders = getCorsAndSecurityHeaders(request, env);

  // Handle CORS Preflight
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: securityHeaders });
  }

  let response;
  try {
    // 1. Admin Dashboard UI
    if ((path === "/" || path === "/admin") && method === "GET") {
      response = new Response(renderDashboardHtml(), {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
        }
      });
      return applySecurityHeaders(response, securityHeaders);
    }

    // 2. Browser Service Worker for Web Push
    if (path === "/sw.js" && method === "GET") {
      response = new Response(renderServiceWorkerJs(), {
        status: 200,
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Service-Worker-Allowed": "/",
          "Cache-Control": "no-cache, no-store, must-revalidate"
        }
      });
      return applySecurityHeaders(response, securityHeaders);
    }

    // 3. Health Check
    if (path === "/health" && method === "GET") {
      response = json({
        ok: true,
        service: "universal-notification-gateway",
        version: "universal-notification-gateway-v1",
        timestamp: new Date().toISOString()
      });
      return applySecurityHeaders(response, securityHeaders);
    }

    // 3. Auth Status Diagnostic
    if (path === "/v1/auth/status" && method === "GET") {
      if (!env || !env.DB) {
        response = json({
          ok: false,
          version: "universal-notification-gateway-v1",
          database_ready: false,
          error: "D1 database binding 'DB' is missing in Worker configuration."
        }, 503);
      } else {
        try {
          const adminCheck = await queryFirst(env.DB, "SELECT COUNT(*) as count FROM admin_users");
          response = json({
            ok: true,
            version: "universal-notification-gateway-v1",
            database_ready: true,
            admin_count: adminCheck?.count ?? 0
          });
        } catch (err) {
          response = json({
            ok: false,
            version: "universal-notification-gateway-v1",
            database_ready: false,
            error: "D1 database tables not yet initialized. Please run scripts/remote-init.sql in Cloudflare D1 Console."
          }, 503);
        }
      }
      return applySecurityHeaders(response, securityHeaders);
    }

    // Check DB binding for all subsequent API endpoints
    if (!env || !env.DB) {
      return applySecurityHeaders(
        fail("The deployed Worker has no D1 database binding named 'DB'. Please verify Worker Settings > Bindings.", 503, { code: "DB_BINDING_MISSING" }),
        securityHeaders
      );
    }

    // 4. Admin Login
    if (path === "/v1/auth/login" && method === "POST") {
      const { data, error } = await readJsonSafe(request);
      if (error) return applySecurityHeaders(fail(error), securityHeaders);

      const clientIp = request.headers.get("cf-connecting-ip") || "unknown";
      const loginResult = await loginAdmin(env.DB, data?.username, data?.password, clientIp);
      if (!loginResult.success) {
        return applySecurityHeaders(fail(loginResult.error, loginResult.status), securityHeaders);
      }

      response = json({
        ok: true,
        token: loginResult.token,
        username: loginResult.username,
        expires_at: loginResult.expiresAt
      });
      return applySecurityHeaders(response, securityHeaders);
    }

    // 5. Admin Logout
    if (path === "/v1/auth/logout" && method === "POST") {
      const authHeader = request.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        await logoutAdmin(env.DB, authHeader.slice(7).trim());
      }
      response = json({ ok: true, message: "Logged out successfully" });
      return applySecurityHeaders(response, securityHeaders);
    }

    // 6. Public Web Push Notification Routes (No login required - for device subscription)
    if (path === "/v1/webpush/vapid-public-key" && method === "GET") {
      const vapid = await getOrGenerateVapidKeys(env.DB, env);
      response = json({ ok: true, publicKey: vapid.publicKey });
      return applySecurityHeaders(response, securityHeaders);
    }

    if (path === "/v1/webpush/topics" && method === "GET") {
      const topics = await webpushService.getAvailableTopics(env.DB);
      response = json({ ok: true, topics });
      return applySecurityHeaders(response, securityHeaders);
    }

    if (path === "/v1/webpush/subscribe" && method === "POST") {
      const { data, error } = await readJsonSafe(request);
      if (error) return applySecurityHeaders(fail(error), securityHeaders);

      try {
        const result = await webpushService.subscribeClient(env.DB, data || {});
        response = json({ ok: true, ...result });
      } catch (err) {
        response = fail(err.message, 400);
      }
      return applySecurityHeaders(response, securityHeaders);
    }

    if (path === "/v1/webpush/unsubscribe" && method === "POST") {
      const { data, error } = await readJsonSafe(request);
      if (error) return applySecurityHeaders(fail(error), securityHeaders);

      try {
        const result = await webpushService.unsubscribeClient(env.DB, data || {});
        response = json({ ok: true, ...result });
      } catch (err) {
        response = fail(err.message, 400);
      }
      return applySecurityHeaders(response, securityHeaders);
    }

    if (path === "/v1/webpush/status" && method === "POST") {
      const { data, error } = await readJsonSafe(request);
      if (error) return applySecurityHeaders(fail(error), securityHeaders);

      try {
        const result = await webpushService.getSubscriptionStatus(env.DB, data?.endpoint, data?.topic);
        response = json({ ok: true, ...result });
      } catch (err) {
        response = fail(err.message, 400);
      }
      return applySecurityHeaders(response, securityHeaders);
    }

    if (path === "/v1/webpush/test" && method === "POST") {
      const { data, error } = await readJsonSafe(request);
      if (error) return applySecurityHeaders(fail(error), securityHeaders);

      try {
        const result = await webpushService.sendTestPush(env.DB, data || {}, env);
        response = json({ ok: result.success, ...result });
      } catch (err) {
        response = fail(err.message, 400);
      }
      return applySecurityHeaders(response, securityHeaders);
    }

    // 6. Notification Ingestion API (Source Authentication)
    if (path === "/v1/notify" && method === "POST") {
      const authHeader = request.headers.get("Authorization");
      const authResult = await authenticateSource(env.DB, authHeader);
      if (!authResult.authenticated) {
        return applySecurityHeaders(fail(authResult.error, authResult.status), securityHeaders);
      }

      const { data, error } = await readJsonSafe(request);
      if (error) return applySecurityHeaders(fail(error), securityHeaders);

      const idempotencyKey = request.headers.get("Idempotency-Key") || null;
      const result = await processNotification(env.DB, authResult.source, data, idempotencyKey, env);
      response = json(result.body, result.status);
      return applySecurityHeaders(response, securityHeaders);
    }

    // 7. Administrative API Routes (Protected by Admin Session)
    if (path.startsWith("/v1/admin/")) {
      const authHeader = request.headers.get("Authorization");
      const adminAuth = await authenticateAdmin(env.DB, authHeader);
      if (!adminAuth.authenticated) {
        return applySecurityHeaders(fail(adminAuth.error, adminAuth.status), securityHeaders);
      }

      response = await handleAdminRoutes(path, method, request, env, url);
      return applySecurityHeaders(response, securityHeaders);
    }

    // Fallback 404
    response = fail(`Endpoint not found: ${method} ${path}`, 404);
  } catch (error) {
    console.error("router_unhandled_error", error);
    response = fail("Internal server error. Check Worker logs.", 500);
  }

  return applySecurityHeaders(response, securityHeaders);
}

/**
 * Handles all administrative API endpoints
 */
async function handleAdminRoutes(path, method, request, env, url) {
  const encKey = env.DESTINATION_ENCRYPTION_KEY;

  // Overview
  if (path === "/v1/admin/overview" && method === "GET") {
    const data = await adminService.getAdminOverview(env.DB);
    return json({ ok: true, data });
  }

  // System Settings
  if (path === "/v1/admin/settings" && method === "GET") {
    const data = await adminService.getSystemSettings(env.DB, env);
    return json({ ok: true, data });
  }

  // Regenerate VAPID Keys
  if (path === "/v1/admin/vapid/regenerate" && method === "POST") {
    const generated = await generateVapidKeys();
    const payload = {
      publicKey: generated.publicKey,
      privateKey: generated.privateKey,
      subject: (env && env.VAPID_SUBJECT) ? env.VAPID_SUBJECT.trim() : "mailto:admin@notification-gateway.local"
    };
    await execute(
      env.DB,
      `
      INSERT INTO system_settings (key, value, created_at, updated_at)
      VALUES ('vapid_keys', ?, datetime('now'), datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
      `,
      [JSON.stringify(payload)]
    );
    return json({ ok: true, publicKey: generated.publicKey, message: "VAPID keypair regenerated successfully" });
  }

  // Cleanup Sessions
  if (path === "/v1/admin/cleanup-sessions" && method === "POST") {
    await cleanupExpiredSessions(env.DB);
    return json({ ok: true, message: "Expired sessions cleaned up successfully" });
  }

  // Sources
  if (path === "/v1/admin/sources" && method === "GET") {
    const data = await adminService.listSources(env.DB);
    return json({ ok: true, items: data });
  }
  if (path === "/v1/admin/sources" && method === "POST") {
    const { data, error } = await readJsonSafe(request);
    if (error) return fail(error);
    const result = await adminService.createSource(env.DB, data);
    return json({ ok: true, item: result }, 201);
  }

  const sourceRotateMatch = path.match(/^\/v1\/admin\/sources\/(\d+)\/rotate-key$/);
  if (sourceRotateMatch && method === "POST") {
    const sourceId = Number(sourceRotateMatch[1]);
    const result = await adminService.rotateSourceKey(env.DB, sourceId);
    return json({ ok: true, item: result });
  }

  const sourceIdMatch = path.match(/^\/v1\/admin\/sources\/(\d+)$/);
  if (sourceIdMatch) {
    const sourceId = Number(sourceIdMatch[1]);
    if (method === "PATCH") {
      const { data, error } = await readJsonSafe(request);
      if (error) return fail(error);
      await adminService.updateSource(env.DB, sourceId, data);
      return json({ ok: true, message: "Source updated successfully" });
    }
    if (method === "DELETE") {
      await adminService.deleteSource(env.DB, sourceId);
      return json({ ok: true, message: "Source deleted successfully" });
    }
  }

  // Topics
  if (path === "/v1/admin/topics" && method === "GET") {
    const data = await adminService.listTopics(env.DB);
    return json({ ok: true, items: data });
  }
  if (path === "/v1/admin/topics" && method === "POST") {
    const { data, error } = await readJsonSafe(request);
    if (error) return fail(error);
    const result = await adminService.createTopic(env.DB, data);
    return json({ ok: true, item: result }, 201);
  }

  const topicIdMatch = path.match(/^\/v1\/admin\/topics\/(\d+)$/);
  if (topicIdMatch) {
    const topicId = Number(topicIdMatch[1]);
    if (method === "PATCH") {
      const { data, error } = await readJsonSafe(request);
      if (error) return fail(error);
      await adminService.updateTopic(env.DB, topicId, data);
      return json({ ok: true, message: "Topic updated successfully" });
    }
    if (method === "DELETE") {
      await adminService.deleteTopic(env.DB, topicId);
      return json({ ok: true, message: "Topic deleted successfully" });
    }
  }

  // Destinations
  if (path === "/v1/admin/destinations" && method === "GET") {
    const data = await adminService.listDestinations(env.DB);
    return json({ ok: true, items: data });
  }
  if (path === "/v1/admin/destinations" && method === "POST") {
    const { data, error } = await readJsonSafe(request);
    if (error) return fail(error);
    const result = await adminService.createDestination(env.DB, data, encKey);
    return json({ ok: true, item: result }, 201);
  }

  const destTestMatch = path.match(/^\/v1\/admin\/destinations\/(\d+)\/test$/);
  if (destTestMatch && method === "POST") {
    const destId = Number(destTestMatch[1]);
    const result = await adminService.testDestination(env.DB, destId, env);
    return json({ ok: result.success, result });
  }

  const destIdMatch = path.match(/^\/v1\/admin\/destinations\/(\d+)$/);
  if (destIdMatch) {
    const destId = Number(destIdMatch[1]);
    if (method === "PATCH") {
      const { data, error } = await readJsonSafe(request);
      if (error) return fail(error);
      await adminService.updateDestination(env.DB, destId, data, encKey);
      return json({ ok: true, message: "Destination updated successfully" });
    }
    if (method === "DELETE") {
      await adminService.deleteDestination(env.DB, destId);
      return json({ ok: true, message: "Destination deleted successfully" });
    }
  }

  // Recipient Groups
  if (path === "/v1/admin/groups" && method === "GET") {
    const data = await adminService.listGroups(env.DB);
    return json({ ok: true, items: data });
  }
  if (path === "/v1/admin/groups" && method === "POST") {
    const { data, error } = await readJsonSafe(request);
    if (error) return fail(error);
    const result = await adminService.createGroup(env.DB, data);
    return json({ ok: true, item: result }, 201);
  }

  const groupMemberAddMatch = path.match(/^\/v1\/admin\/groups\/(\d+)\/members$/);
  if (groupMemberAddMatch && method === "POST") {
    const groupId = Number(groupMemberAddMatch[1]);
    const { data, error } = await readJsonSafe(request);
    if (error) return fail(error);
    if (!Number.isInteger(data?.destination_id)) return fail("destination_id is required");
    await adminService.addGroupMember(env.DB, groupId, data.destination_id);
    return json({ ok: true, message: "Member added to group" });
  }

  const groupMemberRemoveMatch = path.match(/^\/v1\/admin\/groups\/(\d+)\/members\/(\d+)$/);
  if (groupMemberRemoveMatch && method === "DELETE") {
    const groupId = Number(groupMemberRemoveMatch[1]);
    const destId = Number(groupMemberRemoveMatch[2]);
    await adminService.removeGroupMember(env.DB, groupId, destId);
    return json({ ok: true, message: "Member removed from group" });
  }

  const groupIdMatch = path.match(/^\/v1\/admin\/groups\/(\d+)$/);
  if (groupIdMatch) {
    const groupId = Number(groupIdMatch[1]);
    if (method === "PATCH") {
      const { data, error } = await readJsonSafe(request);
      if (error) return fail(error);
      await adminService.updateGroup(env.DB, groupId, data);
      return json({ ok: true, message: "Group updated successfully" });
    }
    if (method === "DELETE") {
      await adminService.deleteGroup(env.DB, groupId);
      return json({ ok: true, message: "Group deleted successfully" });
    }
  }

  // Subscriptions
  if (path === "/v1/admin/subscriptions" && method === "GET") {
    const data = await adminService.listSubscriptions(env.DB);
    return json({ ok: true, items: data });
  }
  if (path === "/v1/admin/subscriptions" && method === "POST") {
    const { data, error } = await readJsonSafe(request);
    if (error) return fail(error);
    const result = await adminService.createSubscription(env.DB, data);
    return json({ ok: true, item: result }, 201);
  }

  const subIdMatch = path.match(/^\/v1\/admin\/subscriptions\/(\d+)$/);
  if (subIdMatch && method === "DELETE") {
    const subId = Number(subIdMatch[1]);
    await adminService.deleteSubscription(env.DB, subId);
    return json({ ok: true, message: "Subscription deleted successfully" });
  }

  // Events
  if (path === "/v1/admin/events" && method === "GET") {
    const query = {
      limit: url.searchParams.get("limit") || 50,
      offset: url.searchParams.get("offset") || 0,
      topic: url.searchParams.get("topic") || undefined,
      sourceId: url.searchParams.get("source_id") || undefined,
      status: url.searchParams.get("status") || undefined,
      search: url.searchParams.get("search") || undefined
    };
    const data = await adminService.listEvents(env.DB, query);
    return json({ ok: true, ...data });
  }

  const eventRetryMatch = path.match(/^\/v1\/admin\/events\/(\d+)\/retry$/);
  if (eventRetryMatch && method === "POST") {
    const eventId = Number(eventRetryMatch[1]);
    const result = await adminService.retryFailedDeliveries(env.DB, eventId, env);
    return json({ ok: true, result });
  }

  const eventIdMatch = path.match(/^\/v1\/admin\/events\/(\d+)$/);
  if (eventIdMatch && method === "GET") {
    const eventId = Number(eventIdMatch[1]);
    const data = await adminService.getEventDetails(env.DB, eventId);
    return json({ ok: true, data });
  }

  // Delivery Logs
  if (path === "/v1/admin/delivery-logs" && method === "GET") {
    const query = {
      limit: url.searchParams.get("limit") || 50,
      offset: url.searchParams.get("offset") || 0,
      status: url.searchParams.get("status") || undefined,
      destinationId: url.searchParams.get("destination_id") || undefined,
      topic: url.searchParams.get("topic") || undefined,
      search: url.searchParams.get("search") || undefined
    };
    const data = await adminService.listDeliveryLogs(env.DB, query);
    return json({ ok: true, ...data });
  }

  return fail("Administrative endpoint not found", 404);
}
