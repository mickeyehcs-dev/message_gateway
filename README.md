# Universal Notification Gateway

A production-ready, secure, and extensible Universal Notification Gateway built for **Cloudflare Workers** and **Cloudflare D1 (SQLite)**.

The gateway enables registered servers, microservices, and monitoring agents to dispatch notifications across email, Telegram, and Web Push notifications using a single unified API with source authentication, topic allow-lists, recipient group resolution, idempotency protection, and delivery audit logging.

---

## Table of Contents

1. [Architecture & Data Model](#1-architecture--data-model)
2. [Prerequisites & Environment Configuration](#2-prerequisites--environment-configuration)
3. [D1 Database Setup & Migrations](#3-d1-database-setup--migrations)
4. [Administrator Provisioning & Password Reset](#4-administrator-provisioning--password-reset)
5. [Local Development & Testing](#5-local-development--testing)
6. [Administrative Console & Web Push Subscription](#6-administrative-console--web-push-subscription)
7. [Delivery Channels Configuration](#7-delivery-channels-configuration)
   - [Email (HTTP Sender API)](#email-http-sender-api)
   - [Telegram Bot](#telegram-bot)
   - [Web Push (Browser Push Service) & Notification Styles](#web-push-browser-push-service--notification-styles)
8. [Notification Submission API](#8-notification-submission-api)
   - [Authentication & Topic Permissions](#authentication--topic-permissions)
   - [Request Schema & Idempotency](#request-schema--idempotency)
   - [Delivery Outcomes & Partial Failures](#delivery-outcomes--partial-failures)
9. [Administrative REST API Reference](#9-administrative-rest-api-reference)
10. [Security Model & Hardening](#10-security-model--hardening)
11. [Deployment & Operations](#11-deployment--operations)
12. [Backup, Recovery & Maintenance](#12-backup-recovery--maintenance)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Architecture & Data Model

The gateway is built with a clean modular separation of concerns:

```
├── migrations/                     # Ordered SQL schema migrations
│   ├── 0001_initial.sql            # Core topics, sources, destinations, subscriptions
│   ├── 0002_admin_users.sql        # Admin credentials and sessions
│   ├── 0003_schema_enhancements.sql# Distributed rate limiting, audit timestamps & indexes
│   └── 0004_webpush_support.sql    # Web Push support, VAPID settings & topic style configs
├── scripts/                        # Safe administration utilities
│   ├── create-admin.mjs            # Interactive admin creation with masked input
│   ├── reset-password.mjs          # Safe password reset and session invalidation
│   └── remote-init.sql             # Direct D1 remote initialization script
├── src/
│   ├── index.js                    # Worker fetch handler entry point
│   ├── router.js                   # HTTP route dispatching & security headers
│   ├── auth/                       # Administrator and source authentication
│   │   ├── admin.js                # PBKDF2 verification, session token hashing
│   │   └── source.js               # API key SHA-256 verification & rate limiting
│   ├── db/                         # Parameterized D1 query abstractions
│   │   └── index.js
│   ├── providers/                  # Pluggable notification channel adapters
│   │   ├── base.js                 # Provider base class & interface
│   │   ├── email.js                # HTTP email API adapter
│   │   ├── telegram.js             # Telegram Bot API adapter
│   │   ├── webpush.js              # Web Push RFC 8030/8291/8292 adapter with SSRF guardrails
│   │   └── index.js                # Provider factory and registry
│   ├── security/                   # Cryptography, validation, and redaction
│   │   ├── crypto.js               # Web Crypto PBKDF2-SHA256, AES-256-GCM, tokens
│   │   ├── vapid.js                # VAPID P-256 ECDSA key management & D1 persistence
│   │   ├── rate-limit.js           # Distributed D1 rate limiting
│   │   ├── redaction.js            # Secret scrubbing from logs and errors
│   │   ├── ssrf.js                 # Anti-SSRF push service endpoint validation
│   │   └── validation.js           # Topic normalization, body bounds, HTML escaping
│   ├── services/                   # Business and administrative services
│   │   ├── admin.js                # Administration API handlers and diagnostics
│   │   ├── routing.js              # Event routing, recipient resolution, and delivery
│   │   └── webpush.js              # Public client subscription service from login portal
│   └── ui/                         # Self-contained administration dashboard & service worker
│       ├── dashboard.js            # Dark-blue aesthetic, zero emojis, vanilla JS
│       └── service-worker.js       # Background push notification & click handler (/sw.js)
├── tests/                          # Automated Vitest test suite
│   ├── admin-api.test.js
│   ├── auth.test.js
│   ├── authorization.test.js
│   ├── providers.test.js
│   ├── routing.test.js
│   ├── validation.test.js
│   └── webpush.test.js
├── wrangler.jsonc                  # Cloudflare Worker and D1 configuration
└── package.json                    # Project metadata and management scripts
```

### Relational Entity Model

- **`admin_users`**: Administrator usernames, cryptographic salts, PBKDF2-SHA256 hashes (210,000 iterations), enabled flag, and login audit timestamps.
- **`admin_sessions`**: Active sessions stored **only as SHA-256 token hashes**, references to administrator, expiration timestamps, and revocation flags.
- **`sources`**: Authorized client applications with independently revocable credentials stored as SHA-256 hashes, enabled flags, rate limits, and usage timestamps.
- **`topics`**: Validated and normalized topic identifiers (e.g., `security.alerts`, `billing.invoices`) with `webpush_config_json` defining default click URL, icons, badges, vibration, and subscriber visibility.
- **`source_topics`**: Explicit many-to-many permissions defining which topics each source is authorized to publish to.
- **`destinations`**: Output notification endpoints (email, Telegram, webpush). Secrets (API keys, bot tokens) are encrypted at rest using AES-256-GCM.
- **`system_settings`**: Internal gateway configuration stored in D1, including VAPID ECDSA P-256 keys.
- **`recipient_groups` & `group_members`**: Groups combining multiple destinations with duplicate membership prevention.
- **`subscriptions`**: Rules connecting authorized recipients (individual destinations or groups) to topics, with optional source and severity filters.
- **`events`**: Notification records containing source reference, topic, title, severity, sanitized message, metadata, processing status, and idempotency key.
- **`delivery_logs`**: Detailed delivery attempts per destination with HTTP status codes, sanitized response excerpts, attempt counts, and timestamps.
- **`rate_limits`**: Distributed sliding-window rate limit counters persisted in D1.

---

## 2. Prerequisites & Environment Configuration

### Required Tools

- Node.js LTS (v20 or later; v24 recommended)
- npm (v10 or later)
- Cloudflare account with Workers and D1 enabled
- Wrangler CLI (`npm install` installs local project copy)

### Worker Secrets

Configure these secrets in Cloudflare Worker before deploying:

```bash
# 1. Master encryption key (minimum 32 random characters used for AES-256-GCM destination encryption)
npx wrangler secret put DESTINATION_ENCRYPTION_KEY

# 2. Optional: Default email API key (can also be configured per destination in D1)
npx wrangler secret put EMAIL_API_KEY

# 3. Optional: Default Telegram Bot Token (can also be configured per destination in D1)
npx wrangler secret put TELEGRAM_BOT_TOKEN
```

### Environment Variables (`wrangler.jsonc`)

The following non-secret variables are maintained in `wrangler.jsonc`:

- `EMAIL_API_URL`: HTTP email sender API endpoint (default: `https://sender-api.mickey.qzz.io/api/v1/send`).
- `EMAIL_SENDER_ID`: Account sender identifier (default: `snd_mvcmbbyw`).
- `CORS_ORIGIN`: Restrict CORS origin if accessing the API from an external web app (e.g., `https://dashboard.example.com`).

---

## 3. D1 Database Setup & Migrations

The repository is configured to use the existing D1 database binding `DB` with database name `message_gateway`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "message_gateway",
    "database_id": "5b0c65b9-7889-4917-8ce0-263507c1efa4",
    "migrations_dir": "migrations"
  }
]
```

### Applying Schema Migrations

#### Local Database (Development)
```bash
npm run db:migrate:local
```

#### Remote Database (Production)
```bash
npm run db:migrate:remote
```

*Note:* Migrations are ordered (`0001`, `0002`, `0003`) and idempotent. Existing production data is preserved.

---

## 4. Administrator Provisioning & Password Reset

You can create administrators using the interactive CLI tools or directly via D1 SQL:

### Option A: Direct SQL Command (Plain / Unhashed Password)
```bash
# Local Database
npx wrangler d1 execute message_gateway --local --command "INSERT INTO admin_users (username, salt, password_hash, iterations, enabled, created_at, updated_at) VALUES ('admin', '', 'Karthik@2006', 0, 1, datetime('now'), datetime('now')) ON CONFLICT(username) DO UPDATE SET salt='', password_hash=excluded.password_hash, iterations=0, enabled=1, updated_at=datetime('now');"

# Remote (Production) Database
npx wrangler d1 execute message_gateway --remote --command "INSERT INTO admin_users (username, salt, password_hash, iterations, enabled, created_at, updated_at) VALUES ('admin', '', 'Karthik@2006', 0, 1, datetime('now'), datetime('now')) ON CONFLICT(username) DO UPDATE SET salt='', password_hash=excluded.password_hash, iterations=0, enabled=1, updated_at=datetime('now');"
```

### Option B: Interactive CLI
```bash
npm run admin:create
```
1. Enter the admin username (e.g., `admin`).
2. Enter the admin password when prompted (input is masked).
3. Confirm the password.
4. Select target: `local` (local development D1) or `remote` (production Cloudflare D1).

### Reset Administrator Password
```bash
npm run admin:reset
```
Prompts for the username and new password, updates the password directly in D1, and automatically invalidates all existing active sessions for that administrator.

---

## 5. Local Development & Testing

### Start Local Worker Dev Server
```bash
# Copy local development secrets
cp .dev.vars.example .dev.vars

# Start Wrangler local server with local D1
npm run dev
```
Open `http://localhost:8787` or `http://localhost:8787/admin` in your browser.

### Run Automated Tests
```bash
npm test
```
The automated test suite runs 47 tests across 6 suites verifying authentication, topic permissions, routing, group expansion, provider adapters, SSRF blocking, idempotency, and admin APIs.

---

## 6. Administrative Console & Web Push Subscription

The gateway includes a self-contained, responsive interface served directly from the Worker at `/` and `/admin`.

### Dual-Portal Interface
1. **Public Web Push Subscription (Login Page)**:
   - Visitors and team members can enter any active topic (with autocomplete suggestions) and subscribe their browser or mobile device with a single click—no administrative login required.
   - Automatically handles browser `Notification.requestPermission()`, registers the gateway's background Service Worker (`/sw.js`), subscribes to push via the gateway's VAPID public key (`/v1/webpush/vapid-public-key`), and registers a push destination in D1.
   - Shows active device subscriptions and allows sending instant test push notifications directly from the browser.
2. **Administrator Console**:
   - Secure sign-in protected by PBKDF2-SHA256 password hashes and revocable SHA-256 session tokens.
   - High-contrast dark aesthetic (`#080d1a`, `#121c33`) with restrained orange accents (`#f97316`) and zero emojis.
   - Secret protection: Stored secrets (bot tokens, email keys) are masked (`••••••••`) and never exposed to the client.

### Dashboard Sections
1. **Overview**: Key metrics (sources, topics, destinations, events, deliveries), recent events feed, and delivery failure breakdowns.
2. **Sources**: Register applications, assign allowed topics, configure rate limits, view last-used timestamps, and safely rotate credentials.
3. **Topics**: Manage topics and configure **Notification Styles** (click URL, icons, badges, banners, interaction requirements, vibration patterns, and login page visibility).
4. **Destinations**: Configure Email, Telegram, and Web Push destinations, test connectivity directly with live results.
5. **Recipient Groups**: Assemble destinations into named operational groups (e.g., `devops-oncall`).
6. **Subscriptions**: Route topics to individual destinations or recipient groups with source and severity filters.
7. **Event History**: Paginated, searchable event stream with drill-down views showing recipient outcomes and a **Retry Failed Deliveries** button.
8. **Delivery Logs**: Detailed filterable audit trail for every external HTTP delivery attempt.
9. **System Settings**: Real-time diagnostic check of Cloudflare Worker bindings, D1 readiness, active Web Push subscribers, VAPID public key management, and session purge tools.

---

## 7. Delivery Channels Configuration

### Email (HTTP Sender API)
- **API URL**: Configured globally in `EMAIL_API_URL` or overridden per destination.
- **Sender ID**: Set in `EMAIL_SENDER_ID` (e.g., `snd_mvcmbbyw`).
- **Recipient**: Validated RFC 5322 email address.
- **Authentication**: Sent via `X-API-Key` header, encrypted at rest with AES-256-GCM.

### Telegram Bot
- **Bot Token**: Provided by `@BotFather`.
- **Chat ID**: Numeric identifier for direct chat or group (e.g., `-1001234567890`).
- **Formatting**: HTML formatting (`<b>[SEVERITY] Title</b>`, pre-formatted metadata). Message length bounded to 4,096 characters to prevent Telegram API errors.

### Web Push (Browser Push Service) & Notification Styles
Standard RFC 8030 / RFC 8291 (`aes128gcm`) Web Push with RFC 8292 VAPID authentication:
- **VAPID Key Generation**: Automatically created in D1 (`system_settings`) on first startup using Web Crypto ECDSA P-256 keys. Can be regenerated anytime from the System Settings panel.
- **Endpoint Protection & SSRF Prevention**: The Worker strictly verifies push service endpoints using anti-SSRF guardrails rejecting private IPv4 ranges, loopback addresses, link-local metadata endpoints (`169.254.169.254`), and non-HTTPS endpoints.
- **Automatic Unsubscribe Cleanup**: Receives HTTP 404/410 Gone from push services (FCM, Apple Push, Mozilla) when a user revokes permissions or clears browser data, and automatically removes dead destinations and subscriptions.
- **Configurable Topic Notification Styles**:
  - **Click Action (`click_url`)**: Custom URL or path opened in browser when notification is clicked (e.g., `/admin#events`, `/`, or `https://...`). If the tab is already open, the Service Worker automatically focuses it; otherwise it navigates or opens a new window.
  - **Icons & Badges (`icon`, `badge`)**: High-resolution alert icons and monochrome status bar badges.
  - **Banner Image (`image`)**: Rich visual preview for desktop and mobile notifications.
  - **Interaction Mode (`require_interaction`)**: Keeps alert on screen until dismissed by the user.
  - **Vibration Patterns (`vibrate`)**: Customizable haptic vibration intervals for mobile devices (e.g., `200, 100, 200`).
  - **Topic Web Push Toggle (`webpush_enabled`)**: Administrators can toggle whether individual topics are publicly discoverable on the login page.

---

## 8. Notification Submission API

Authorized applications submit notifications using standard HTTP POST requests:

### Endpoint
```http
POST /v1/notify
Authorization: Bearer <SOURCE_API_KEY>
Content-Type: application/json
Idempotency-Key: <OPTIONAL_UNIQUE_EVENT_ID>
```

### JSON Request Payload
```json
{
  "topic": "security.alerts",
  "title": "Suspicious login detected",
  "message": "Multiple failed SSH attempts detected from 198.51.100.24",
  "severity": "warning",
  "metadata": {
    "server": "web-node-03",
    "attempts": 5,
    "ip": "198.51.100.24"
  }
}
```

### Request Fields
| Field | Type | Required | Description |
|---|---|---|---|
| `topic` | String | Yes | Lowercase topic identifier matching source's permission list. |
| `message` | String | Yes | Primary notification text content. |
| `title` | String | No | Subject or headline (default: `[SEVERITY] topic`). |
| `severity` | String | No | One of: `info`, `warning`, `error`, `critical` (default: `info`). |
| `metadata` | Object | No | Key-value dictionary attached to deliveries. |

### Successful Delivery Response (HTTP 200)
```json
{
  "ok": true,
  "event_id": 42,
  "status": "processed",
  "stats": {
    "total": 2,
    "successful": 2,
    "failed": 0,
    "skipped": 0
  },
  "deliveries": [
    {
      "destination_id": 1,
      "destination_name": "ops-email",
      "provider": "email",
      "status": "success",
      "http_status": 200
    },
    {
      "destination_id": 2,
      "destination_name": "security-telegram",
      "provider": "telegram",
      "status": "success",
      "http_status": 200
    }
  ]
}
```

### Idempotency Behavior
- If an `Idempotency-Key` header is supplied, subsequent submissions with the same key and same payload return the cached event outcome with `"idempotent_replay": true` without re-dispatching to external providers.
- If the same `Idempotency-Key` is re-used with a **conflicting payload**, the gateway rejects the request with **HTTP 409 Conflict**.

### Delivery Statuses & Partial Failures
- `processed`: All resolved destinations accepted the notification.
- `partial_failure`: One or more providers failed; individual failure errors are recorded in `deliveries` and `delivery_logs`.
- `failed`: All provider attempts failed.
- `no_subscribers`: No active subscriptions matched the topic and severity filters.

---

## 9. Administrative REST API Reference

All `/v1/admin/*` endpoints require the header:
```http
Authorization: Bearer <ADMIN_SESSION_TOKEN>
```

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/v1/admin/overview` | Dashboard metrics and failure summary |
| `GET` | `/v1/admin/sources` | List registered sources and topic permissions |
| `POST` | `/v1/admin/sources` | Register a new source and generate API key |
| `PATCH` | `/v1/admin/sources/:id` | Update source configuration or toggle status |
| `POST` | `/v1/admin/sources/:id/rotate-key` | Invalidate previous key and issue a new key |
| `DELETE` | `/v1/admin/sources/:id` | Remove a source |
| `GET` | `/v1/admin/topics` | List all topics and subscriber counts |
| `POST` | `/v1/admin/topics` | Create a new topic |
| `PATCH` | `/v1/admin/topics/:id` | Update topic description or enabled state |
| `DELETE` | `/v1/admin/topics/:id` | Remove topic and its subscriptions |
| `GET` | `/v1/admin/destinations` | List destinations (secrets masked) |
| `POST` | `/v1/admin/destinations` | Add a destination (secrets encrypted with AES-256-GCM) |
| `PATCH` | `/v1/admin/destinations/:id` | Update destination or replace secret |
| `POST` | `/v1/admin/destinations/:id/test` | Dispatch live test notification to destination |
| `DELETE` | `/v1/admin/destinations/:id` | Remove a destination |
| `GET` | `/v1/admin/groups` | List recipient groups and members |
| `POST` | `/v1/admin/groups` | Create a recipient group |
| `POST` | `/v1/admin/groups/:id/members` | Add destination to a group |
| `DELETE` | `/v1/admin/groups/:id/members/:destId`| Remove destination from a group |
| `GET` | `/v1/admin/subscriptions` | List subscriptions |
| `POST` | `/v1/admin/subscriptions` | Create individual or group subscription |
| `DELETE` | `/v1/admin/subscriptions/:id` | Remove subscription |
| `GET` | `/v1/admin/events` | Paginated event history (`?limit=50&offset=0&status=...`) |
| `GET` | `/v1/admin/events/:id` | Detailed event information and delivery log list |
| `POST` | `/v1/admin/events/:id/retry` | Re-dispatch failed deliveries for an event |
| `GET` | `/v1/admin/delivery-logs` | Filterable provider audit logs |
| `GET` | `/v1/admin/settings` | Diagnostic environment check |
| `POST` | `/v1/admin/cleanup-sessions` | Purge expired and revoked sessions |

---

## 10. Security Model & Hardening

1. **PBKDF2-SHA256 Password Derivation**: Uses Web Crypto API with a unique 16-byte cryptographically secure random salt and 210,000 iterations.
2. **Session Security**: Session tokens are 32-byte cryptographically random hex strings. **Only SHA-256 hashes are stored in D1**.
3. **AES-256-GCM Encryption at Rest**: Destination bot tokens and API keys are encrypted at rest in D1 with unique IVs.
4. **Parameterized SQL Queries**: Every database query is strictly parameterized via `db.prepare().bind()`, eliminating SQL injection.
5. **Distributed Rate Limiting**: Distributed D1 sliding-window counters protect against brute-force administrator logins (10 failed attempts / 15 min lockout) and per-source flood attacks.
6. **Anti-SSRF Protection**: Strict host, IP, scheme, and credential validation before dispatching to external URLs.
7. **Secret Scrubbing**: Automatic redaction of Authorization headers, Bearer tokens, Telegram bot tokens, and URL secrets from delivery logs and error outputs.
8. **Strict Content Security Policy**: Restricts execution to self-origin scripts, forbids external connections, and disallows iframe embedding (`X-Frame-Options: DENY`, `frame-ancestors 'none'`).

---

## 11. Deployment & Operations

### Step-by-Step Deployment Workflow

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Authenticate with Cloudflare**:
   ```bash
   npx wrangler login
   ```

3. **Verify Database Configuration**:
   Ensure `wrangler.jsonc` points to database `message_gateway` (`5b0c65b9-7889-4917-8ce0-263507c1efa4`).

4. **Apply Migrations to Remote D1**:
   ```bash
   npm run db:migrate:remote
   ```

5. **Provision Remote Administrator**:
   ```bash
   npm run admin:create
   # Select "remote" when prompted to write directly to Cloudflare D1
   ```

6. **Set Worker Secrets**:
   ```bash
   npx wrangler secret put DESTINATION_ENCRYPTION_KEY
   npx wrangler secret put EMAIL_API_KEY
   ```

7. **Run Tests**:
   ```bash
   npm test
   ```

8. **Deploy to Cloudflare Workers**:
   ```bash
   npm run deploy
   ```

9. **Verify Deployment**:
   Navigate to `https://<YOUR_WORKER>.workers.dev/` and verify the `/health` and `/v1/auth/status` endpoints.

---

## 12. Backup, Recovery & Maintenance

### D1 Database Backup
Export database contents directly via Wrangler:
```bash
npx wrangler d1 export message_gateway --remote --output=./backup_$(date +%Y%m%d).sql
```

### Rotating Master Encryption Key
If rotating `DESTINATION_ENCRYPTION_KEY`:
1. Export existing destinations via Admin API or D1 export.
2. Update the secret in Wrangler: `npx wrangler secret put DESTINATION_ENCRYPTION_KEY`.
3. Re-save destinations in the dashboard with their credentials to re-encrypt with the new master key.

### Session Maintenance
Expired sessions are automatically ignored by expiration timestamps (`expires_at < datetime('now')`). They can be permanently purged anytime via the dashboard Settings tab or via API:
```bash
curl -X POST https://<YOUR_WORKER>.workers.dev/v1/admin/cleanup-sessions \
  -H "Authorization: Bearer <ADMIN_SESSION_TOKEN>"
```

---

## 13. Troubleshooting

| Symptom | Cause | Solution |
|---|---|---|
| `D1 database tables not yet initialized` (503) | Migrations have not been applied to the remote database | Run `npm run db:migrate:remote`. |
| `DESTINATION_ENCRYPTION_KEY is required` | The encryption key secret is missing | Execute `npx wrangler secret put DESTINATION_ENCRYPTION_KEY`. |
| `Source is not authorized to publish to topic` | Topic permission not granted to source | In the dashboard, edit the source and select the topic in the multi-select box. |
| `Web Push URL security check failed` | The target push service endpoint points to a private/loopback IP address | Verify the push endpoint is a public HTTPS host provided by the browser push service. |
| `Too many failed login attempts` | Login rate limiter triggered | Wait 15 minutes or reset password via `npm run admin:reset`. |
