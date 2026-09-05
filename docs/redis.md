# Redis, Caching & Rate Limiting (Milestone 6)

## Architecture

```text
HTTP request
  → Route / Service
  → cacheGetOrSet(org-scoped key)
      HIT  → return Redis value
      MISS → PostgreSQL → SET EX ttl → return
```

PostgreSQL remains the source of truth. Redis is an acceleration and coordination layer.

Central modules:

| Module | Role |
|--------|------|
| `src/lib/redis/client.ts` | Shared ioredis client, reconnect, ping, shutdown |
| `src/lib/redis/keys.ts` | Tenant-safe key builders + TTL documentation |
| `src/lib/redis/cache.ts` | Cache-aside get/set/del/getOrSet |
| `src/lib/redis/invalidation.ts` | Targeted key deletion (no FLUSHDB) |
| `src/lib/redis/rate-limit.ts` | Redis fixed-window limiter + memory fallback |
| `src/lib/redis/health.ts` | Postgres + Redis + worker/queue health |

Never import Redis from browser code. Never log `REDIS_URL` or passwords.

## Local Redis (free)

```bash
npm run redis:up
# equivalent: docker compose up -d redis
```

Uses `docker-compose.yml` → Redis 7.4 Alpine on `6379` with AOF persistence.

Stop:

```bash
npm run redis:down
```

Set in `.env` (see `.env.example`):

```bash
REDIS_URL=redis://127.0.0.1:6379
```

If `REDIS_URL` is unset, the app still runs: cache misses through to Postgres; emails send synchronously; rate limits use in-process memory.

## Tenant-safe keys

Every organization-scoped key **must** include `organizationId`:

```text
org:{organizationId}:dashboard:summary
org:{organizationId}:tickets:meta
org:{organizationId}:customers:meta
org:{organizationId}:ticket:{ticketId}
org:{organizationId}:customer:{customerId}
org:{organizationId}:organization
```

`assertOrgScopedKey` rejects cross-tenant key access.

## TTLs (`CACHE_TTL`)

| Key | Seconds | Why |
|-----|---------|-----|
| dashboard summary | 30 | Aggregates change often; brief staleness OK |
| tickets / customers meta | 60 | Agents/tags/counts relatively stable |
| ticket / customer detail keys | 45 | Short window; writes invalidate |
| organization profile | 120 | Name/slug change infrequently |

No infinite TTLs. Writes call targeted invalidation (dashboard + related meta + entity key).

## Rate limiting

Sensitive endpoints use Redis when configured:

- login (`login:{ip}:{email}`)
- signup / forgot / reset / verify (IP)
- invitations (`invite:{userId}:{ip}`)
- ticket/customer search with `q` (`search:*:{userId}:{ip}`)

**Failure policy**

1. Prefer Redis.
2. If Redis is down → in-process memory fallback (dev resilience).
3. If `RATE_LIMIT_FAIL_CLOSED=true` and Redis is configured but down → deny.

Do not trust client-supplied `organizationId` for tenant rate limits; use authenticated user id / IP from the request.

## Health

- `GET /api/health` — postgres / redis / worker status (no secrets)
- `GET /api/admin/system` — OWNER/ADMIN only, includes queue counts + recent failures (payloads redacted)
- UI: `/admin/system`

## Degraded mode

| Concern | Redis down |
|---------|------------|
| Cache | Miss → Postgres |
| Rate limit | Memory fallback (or fail-closed if configured) |
| Jobs | Producer throws — never pretend queued |
