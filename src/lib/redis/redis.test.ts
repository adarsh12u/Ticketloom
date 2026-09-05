import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  cacheDel,
  cacheGet,
  cacheGetOrSet,
  cacheSet,
} from "@/lib/redis/cache";
import {
  disconnectRedis,
  ensureRedisConnected,
  isRedisConfigured,
  redisPing,
} from "@/lib/redis/client";
import { getSystemHealth } from "@/lib/redis/health";
import {
  invalidateCustomerCaches,
  invalidateTicketCaches,
} from "@/lib/redis/invalidation";
import { assertOrgScopedKey, cacheKeys, CACHE_TTL } from "@/lib/redis/keys";
import {
  checkRateLimit,
  resetRateLimitStore,
} from "@/lib/redis/rate-limit";

const redisReady = Boolean(process.env.REDIS_URL);

describe("Redis infrastructure", () => {
  beforeAll(async () => {
    if (redisReady) {
      await ensureRedisConnected();
    }
  });

  afterAll(async () => {
    if (redisReady) {
      await disconnectRedis();
    }
  });

  beforeEach(() => {
    resetRateLimitStore();
  });

  it("reports configured connection status", async () => {
    if (!redisReady) {
      expect(isRedisConfigured()).toBe(false);
      expect(await redisPing()).toBe("disabled");
      return;
    }
    expect(isRedisConfigured()).toBe(true);
    expect(await redisPing()).toBe("ok");
  });

  it("health check reports postgres and redis without credentials", async () => {
    const health = await getSystemHealth();
    expect(health.postgres.status).toMatch(/healthy|unavailable/);
    expect(health.redis.status).toMatch(/healthy|unavailable|disabled/);
    expect(JSON.stringify(health)).not.toMatch(/redis:\/\/|password|DATABASE_URL/i);
  });

  it("rejects non-tenant-scoped cache keys", () => {
    expect(() => assertOrgScopedKey("global:dashboard", "org-a")).toThrow();
    expect(() =>
      assertOrgScopedKey(cacheKeys.dashboardSummary("org-a"), "org-b"),
    ).toThrow();
    expect(() =>
      assertOrgScopedKey(cacheKeys.dashboardSummary("org-a"), "org-a"),
    ).not.toThrow();
  });

  it("cache miss then hit with TTL set", async () => {
    if (!redisReady) return;

    const orgId = `org-cache-${Date.now()}`;
    const key = cacheKeys.dashboardSummary(orgId);
    await cacheDel(orgId, [key]);

    const miss = await cacheGet<string>(orgId, key);
    expect(miss.hit).toBe(false);

    await cacheSet(orgId, key, { total: 3 }, CACHE_TTL.dashboardSummary);
    const hit = await cacheGet<{ total: number }>(orgId, key);
    expect(hit.hit).toBe(true);
    if (hit.hit) expect(hit.value.total).toBe(3);

    const again = await cacheGetOrSet(orgId, key, CACHE_TTL.dashboardSummary, async () => ({
      total: 99,
    }));
    expect(again.fromCache).toBe(true);
    expect(again.value).toEqual({ total: 3 });
  });

  it("expires cache entries after TTL", async () => {
    if (!redisReady) return;

    const orgId = `org-ttl-${Date.now()}`;
    const key = cacheKeys.ticketsMeta(orgId);
    await cacheSet(orgId, key, { ok: true }, 1);
    expect((await cacheGet(orgId, key)).hit).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect((await cacheGet(orgId, key)).hit).toBe(false);
  }, 10_000);

  it("invalidates ticket and customer caches without flush", async () => {
    if (!redisReady) return;

    const orgId = `org-inv-${Date.now()}`;
    const ticketId = "tkt-1";
    const customerId = "cus-1";
    await cacheSet(orgId, cacheKeys.dashboardSummary(orgId), { a: 1 }, 60);
    await cacheSet(orgId, cacheKeys.ticket(orgId, ticketId), { id: ticketId }, 60);
    await cacheSet(orgId, cacheKeys.customer(orgId, customerId), { id: customerId }, 60);
    await cacheSet(orgId, cacheKeys.ticketsMeta(orgId), { meta: true }, 60);

    await invalidateTicketCaches(orgId, ticketId);
    expect((await cacheGet(orgId, cacheKeys.ticket(orgId, ticketId))).hit).toBe(false);
    expect((await cacheGet(orgId, cacheKeys.dashboardSummary(orgId))).hit).toBe(false);
    expect((await cacheGet(orgId, cacheKeys.ticketsMeta(orgId))).hit).toBe(false);

    await cacheSet(orgId, cacheKeys.customer(orgId, customerId), { id: customerId }, 60);
    await cacheSet(orgId, cacheKeys.customersMeta(orgId), { meta: true }, 60);
    await invalidateCustomerCaches(orgId, customerId);
    expect((await cacheGet(orgId, cacheKeys.customer(orgId, customerId))).hit).toBe(false);
    expect((await cacheGet(orgId, cacheKeys.customersMeta(orgId))).hit).toBe(false);
  });

  it("isolates cache between organizations", async () => {
    if (!redisReady) return;

    const orgA = `org-a-${Date.now()}`;
    const orgB = `org-b-${Date.now()}`;
    const payloadA = { secret: "tenant-a-only" };
    const payloadB = { secret: "tenant-b-only" };

    await cacheSet(orgA, cacheKeys.dashboardSummary(orgA), payloadA, 60);
    await cacheSet(orgB, cacheKeys.dashboardSummary(orgB), payloadB, 60);

    const a = await cacheGet<{ secret: string }>(orgA, cacheKeys.dashboardSummary(orgA));
    const b = await cacheGet<{ secret: string }>(orgB, cacheKeys.dashboardSummary(orgB));
    expect(a.hit && a.value.secret).toBe("tenant-a-only");
    expect(b.hit && b.value.secret).toBe("tenant-b-only");

    expect(() =>
      assertOrgScopedKey(cacheKeys.dashboardSummary(orgA), orgB),
    ).toThrow();
  });

  it("falls back on cache miss when Redis is unavailable", async () => {
    const previous = process.env.REDIS_URL;
    delete process.env.REDIS_URL;
    await disconnectRedis();

    const orgId = "org-fallback";
    const result = await cacheGetOrSet(orgId, cacheKeys.organization(orgId), 30, async () => ({
      id: orgId,
      name: "Fallback Org",
    }));
    expect(result.fromCache).toBe(false);
    expect(result.value.name).toBe("Fallback Org");

    if (previous) process.env.REDIS_URL = previous;
    await ensureRedisConnected();
  });

  it("rate limits login, signup, forgot-password, and invitation keys", async () => {
    const nonce = Date.now();
    const cases = [
      [`login:ip:user-${nonce}@example.com`, 2],
      [`signup:127.0.0.1:${nonce}`, 2],
      [`forgot:127.0.0.1:${nonce}`, 2],
      [`invite:user-1:127.0.0.1:${nonce}`, 2],
      [`invite-preview:127.0.0.1:${nonce}`, 2],
      [`invite-accept:user-1:127.0.0.1:${nonce}`, 2],
    ] as const;

    for (const [key, limit] of cases) {
      resetRateLimitStore();
      expect((await checkRateLimit(key, limit, 60_000)).allowed).toBe(true);
      expect((await checkRateLimit(key, limit, 60_000)).allowed).toBe(true);
      expect((await checkRateLimit(key, limit, 60_000)).allowed).toBe(false);
    }
  });

  it("fail-closes rate limits when Redis is configured but down", async () => {
    const previousUrl = process.env.REDIS_URL;
    const previousFail = process.env.RATE_LIMIT_FAIL_CLOSED;
    process.env.REDIS_URL = "redis://127.0.0.1:6399";
    process.env.RATE_LIMIT_FAIL_CLOSED = "true";
    await disconnectRedis();

    const result = await checkRateLimit(`fail-closed:${Date.now()}`, 10, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.backend).toBe("closed");

    if (previousUrl) process.env.REDIS_URL = previousUrl;
    else delete process.env.REDIS_URL;
    if (previousFail === undefined) delete process.env.RATE_LIMIT_FAIL_CLOSED;
    else process.env.RATE_LIMIT_FAIL_CLOSED = previousFail;
    await ensureRedisConnected();
  });

  it("falls back to memory rate limits when Redis fails and fail-closed is off", async () => {
    const previousUrl = process.env.REDIS_URL;
    const previousFail = process.env.RATE_LIMIT_FAIL_CLOSED;
    process.env.REDIS_URL = "redis://127.0.0.1:6399";
    process.env.RATE_LIMIT_FAIL_CLOSED = "false";
    await disconnectRedis();
    resetRateLimitStore();

    const result = await checkRateLimit(`memory-fallback:${Date.now()}`, 10, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.backend).toBe("memory");

    if (previousUrl) process.env.REDIS_URL = previousUrl;
    else delete process.env.REDIS_URL;
    if (previousFail === undefined) delete process.env.RATE_LIMIT_FAIL_CLOSED;
    else process.env.RATE_LIMIT_FAIL_CLOSED = previousFail;
    await ensureRedisConnected();
  });

  it("rejects cross-org analytics and knowledge cache keys", () => {
    expect(() =>
      assertOrgScopedKey(cacheKeys.analyticsDashboard("org-a"), "org-b"),
    ).toThrow();
    expect(() => assertOrgScopedKey(cacheKeys.knowledgePopular("org-a"), "org-b")).toThrow();
    expect(() =>
      assertOrgScopedKey(cacheKeys.analyticsDashboard("org-a"), "org-a"),
    ).not.toThrow();
  });

  it("enforces concurrent rate limiting", async () => {
    resetRateLimitStore();
    const key = `concurrent:${Date.now()}`;
    const results = await Promise.all(
      Array.from({ length: 20 }, () => checkRateLimit(key, 5, 60_000)),
    );
    const allowed = results.filter((result) => result.allowed).length;
    const denied = results.filter((result) => !result.allowed).length;
    expect(allowed).toBeLessThanOrEqual(5);
    expect(denied).toBeGreaterThan(0);
    expect(allowed + denied).toBe(20);
  });
});
