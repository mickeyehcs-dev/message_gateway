# Universal Notification Gateway (Cloudflare Workers + D1)

API-first implementation with:
- Explicit topics only (no wildcard matching)
- Per-source API tokens and topic allow-lists
- Individual subscriptions and recipient groups
- Email through the configured sender API, with a separate API key and sender ID per email destination
- Multiple Telegram bot/chat destinations
- Multiple ntfy server/topic destinations
- Synchronous delivery with per-destination results
- D1 event and delivery logs
- AES-GCM encryption for Telegram and ntfy tokens stored in D1
- Admin API protected by `ADMIN_API_KEY`

## Important limitations

1. Synchronous delivery waits for all matching providers. The Worker has a 10-second timeout per provider; a slow provider can make the source request take a while. Cloudflare plan/runtime limits still apply.
2. This starter has no browser dashboard. Manage it through the authenticated admin HTTP API or build a dashboard behind a proper server-side session. Do not embed `ADMIN_API_KEY` in public frontend code.
3. Email API behavior is assumed from the provided example: one recipient per request and a successful 2xx response indicates acceptance. Verify the provider's response semantics.
4. Do not accept arbitrary destinations from incoming source requests. Destinations are managed by the admin API.
5. D1 is not a durable queue. With synchronous delivery, a Worker termination after a provider accepts a message but before logging can leave ambiguous delivery status. Use a Queue/outbox architecture if you later switch to asynchronous delivery.
6. The `CORS_ORIGIN` option is optional and should only be set to one trusted origin. API clients such as servers and curl do not need CORS.

## Admin panel

After deployment, open the root domain `https://YOUR-WORKER-URL/` in your browser (the `/admin` path also works). Sign in with `ADMIN_API_KEY`. The key is held in the tab's `sessionStorage` and sent only to this same-origin Worker API; it is cleared when you log out or close the browser tab. Do not open the admin panel on a shared/public computer.

The dashboard supports creating and listing topics, sources, destinations, recipient groups, group memberships, and subscriptions; disabling records; and viewing recent delivery logs. Source tokens are shown only once after creation, so copy them securely. Destination credentials are never displayed after creation.

For additional protection, put the `/admin` path behind Cloudflare Access if your deployment supports it. The API key is still required by the admin API.

## 1. Prerequisites

- Cloudflare account with Workers and D1
- Node.js LTS and npm
- Wrangler CLI (installed through this project's dev dependency)
- Email sender API key and sender ID
- Telegram bot token/chat ID if using Telegram
- ntfy topic and optional token if using ntfy

## 2. Configure Cloudflare

From this directory:

```bash
npm install
npx wrangler login
npx wrangler d1 create universal-notification-gateway
```

Copy the returned D1 `database_id` into `wrangler.jsonc`, replacing `REPLACE_WITH_D1_DATABASE_ID`.

Create secrets. Use a long, random admin key and a different long random encryption key (at least 32 characters). For example, generate values locally with a password manager or a cryptographically secure generator; do not commit them.

```bash
npx wrangler secret put ADMIN_API_KEY
npx wrangler secret put DESTINATION_ENCRYPTION_KEY
npx wrangler secret put EMAIL_API_KEY
```

Wrangler prompts for each secret. `DESTINATION_ENCRYPTION_KEY` is used to encrypt bot and ntfy tokens at rest. If you lose or change it, those stored credentials cannot be decrypted; back it up securely. To rotate it, implement a controlled re-encryption migration before replacing the secret.

Edit `EMAIL_SENDER_ID` in `wrangler.jsonc` to a valid sender ID from your mail service. It may also be overridden per email destination.

Apply schema and deploy:

```bash
npm run db:migrate:remote
npm run deploy
```

Use the deployed `workers.dev` URL for initial testing. Add a custom domain later in the Cloudflare Worker settings if desired.

## 3. Admin API authentication

Every `/v1/admin/*` request requires:

```http
Authorization: Bearer YOUR_ADMIN_API_KEY
Content-Type: application/json
```

Never place the admin key in browser JavaScript, a public repository, or a website's client-side code.

Set a shell variable to make examples easier:

```bash
export BASE_URL="https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev"
read -s ADMIN_API_KEY
export ADMIN_API_KEY
```

For each `curl` below, use `-H "Authorization: Bearer $ADMIN_API_KEY"`.

## 4. Create topics

```bash
curl -sS -X POST "$BASE_URL/v1/admin/topics" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"security.attack","description":"Security alerts"}'

curl -sS -X POST "$BASE_URL/v1/admin/topics" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"server.down","description":"Server availability"}'
```

Topic names are explicit. `*` and `server.*` are not accepted as topics or subscriptions.

## 5. Create sources

A source token is returned only once. Store it in the source server's secret/environment configuration.

```bash
curl -sS -X POST "$BASE_URL/v1/admin/sources" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"production-server","allowed_topics":["server.down","security.attack"]}'
```

Copy the returned `token` immediately. The database stores only its SHA-256 hash.

## 6. Create destinations

### Email

Each email destination is configured in the admin panel with its own recipient address, sender ID, and sender API key. The API key is encrypted in D1 using `DESTINATION_ENCRYPTION_KEY`; it is not returned by destination listing endpoints. You no longer need a global `EMAIL_API_KEY` secret. The email API URL remains configurable through `EMAIL_API_URL`.

```bash
curl -sS -X POST "$BASE_URL/v1/admin/destinations" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"ops-email","type":"email","to":"ops@example.com","sender_id":"snd_REPLACE_ME","api_key":"REPLACE_WITH_EMAIL_API_KEY"}'
```

### Telegram

Create a bot using BotFather, add it to the intended chat/group, and obtain the chat ID. Do not expose the bot token in logs or source control.

```bash
curl -sS -X POST "$BASE_URL/v1/admin/destinations" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"security-bot-chat","type":"telegram","bot_token":"REPLACE_WITH_BOT_TOKEN","chat_id":"REPLACE_WITH_CHAT_ID"}'
```

Each destination stores one bot/chat pair. The same bot can be configured as separate destinations for separate chats.

### ntfy

```bash
curl -sS -X POST "$BASE_URL/v1/admin/destinations" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"server-alerts-topic","type":"ntfy","base_url":"https://ntfy.sh","topic":"REPLACE_WITH_PRIVATE_TOPIC","token":"OPTIONAL_NTFY_ACCESS_TOKEN"}'
```

Omit `token` for a public topic. For private alerts, use a private topic and a token supported by your ntfy server. Self-hosted ntfy base URLs should be trusted and preferably HTTPS.

## 7. Create recipient groups and memberships

```bash
curl -sS -X POST "$BASE_URL/v1/admin/groups" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"operations","description":"Operations recipients"}'

# Replace group_id and destination_id with the IDs returned by creation calls.
curl -sS -X POST "$BASE_URL/v1/admin/group-members" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"group_id":1,"destination_id":1}'
```

A group can contain email, Telegram, and ntfy destinations.

## 8. Create subscriptions

Subscribe a group to a topic:

```bash
curl -sS -X POST "$BASE_URL/v1/admin/subscriptions" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"topic":"server.down","group_id":1}'
```

Subscribe one destination only when a particular source emits critical events:

```bash
curl -sS -X POST "$BASE_URL/v1/admin/subscriptions" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"topic":"security.attack","source_id":1,"severity":"critical","destination_id":2}'
```

A subscription with `source_id` omitted or `null` applies to every authorized source publishing that topic. A `severity` omitted or `null` matches all severities. Each subscription must target exactly one destination or one group.

## 9. Send an event

```bash
curl -i -X POST "$BASE_URL/v1/notify" \
  -H "Authorization: Bearer REPLACE_WITH_SOURCE_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: prod-server-incident-2026-001" \
  -d '{
    "topic":"server.down",
    "severity":"critical",
    "message":"Production server is not responding",
    "metadata":{"host":"prod-01","check":"https"}
  }'
```

Successful response includes an event ID and per-destination delivery statuses. If one provider fails, the API returns HTTP `207 Multi-Status` and includes the failure. The gateway records the event before attempting deliveries.

Optional fields:
- `subject`: email subject / notification title
- `html`: custom HTML body for email only; only send trusted HTML because it is not sanitized
- `metadata`: JSON object included in notification context
- `idempotency_key`: or use the `Idempotency-Key` header

If a custom `html` body is supplied, it is passed directly to the mail provider. Do not allow untrusted users to control it.

## 10. Query management data

```bash
curl -sS "$BASE_URL/v1/admin/topics" -H "Authorization: Bearer $ADMIN_API_KEY"
curl -sS "$BASE_URL/v1/admin/sources" -H "Authorization: Bearer $ADMIN_API_KEY"
curl -sS "$BASE_URL/v1/admin/destinations" -H "Authorization: Bearer $ADMIN_API_KEY"
curl -sS "$BASE_URL/v1/admin/groups" -H "Authorization: Bearer $ADMIN_API_KEY"
curl -sS "$BASE_URL/v1/admin/group-members" -H "Authorization: Bearer $ADMIN_API_KEY"
curl -sS "$BASE_URL/v1/admin/subscriptions" -H "Authorization: Bearer $ADMIN_API_KEY"
curl -sS "$BASE_URL/v1/admin/logs?limit=100" -H "Authorization: Bearer $ADMIN_API_KEY"
```

Disable records without deleting their history:

```bash
curl -sS -X POST "$BASE_URL/v1/admin/sources/1/disable" -H "Authorization: Bearer $ADMIN_API_KEY"
curl -sS -X POST "$BASE_URL/v1/admin/destinations/1/disable" -H "Authorization: Bearer $ADMIN_API_KEY"
curl -sS -X POST "$BASE_URL/v1/admin/subscriptions/1/disable" -H "Authorization: Bearer $ADMIN_API_KEY"
curl -sS -X POST "$BASE_URL/v1/admin/groups/1/disable" -H "Authorization: Bearer $ADMIN_API_KEY"
curl -sS -X POST "$BASE_URL/v1/admin/topics/1/disable" -H "Authorization: Bearer $ADMIN_API_KEY"
```

## 11. Health check

```bash
curl -sS "$BASE_URL/health"
```

Expected:

```json
{"ok":true,"service":"universal-notification-gateway"}
```

## 12. Security and operational checklist

- Use a custom domain and Cloudflare-managed HTTPS if desired.
- Keep `ADMIN_API_KEY` and `DESTINATION_ENCRYPTION_KEY` as Worker secrets. Email API keys are stored encrypted per email destination in D1.
- Rotate the email API key if it was pasted into a public or untrusted place.
- Restrict admin endpoints further with Cloudflare Access or another admin-only control when practical.
- Add Cloudflare rate limiting/WAF rules to `/v1/notify` and admin paths.
- Set a maximum acceptable event rate per source; this starter does not implement per-source rate limiting itself.
- Set D1 retention/cleanup for events and logs before volume grows.
- Avoid sending passwords, session cookies, API keys, or sensitive personal data in messages/metadata.
- Review email provider response semantics and Telegram/ntfy access controls before production use.
- Delivery is synchronous and may partially succeed. A failed response does not prove that a provider did not accept a message; use idempotency and provider-side delivery IDs if the provider supports them.
