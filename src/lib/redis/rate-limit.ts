import { ensureRedisConnected, isRedisConfigured } from "@/lib/redis/client";
import {
  checkRateLimit as memoryCheckRateLimit,
  resetRateLimitStore,
} from "@/lib/rate-limit/memory-rate-limit";

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  backend: "redis" | "memory" | "closed";
};

/**
 * Redis sliding fixed-window rate limiter.
 *
 * Failure policy for security-sensitive endpoints:
 * 1. Prefer Redis when configured and healthy.
 * 2. Fall back to in-process memory if Redis is unavailable (local/dev resilience).
 * 3. If RATE_LIMIT_FAIL_CLOSED=true and Redis is configured but down → deny.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const failClosed = process.env.RATE_LIMIT_FAIL_CLOSED === "true";
  const redisConfigured = isRedisConfigured();

  if (redisConfigured) {
    const client = await ensureRedisConnected();
    if (client) {
      try {
        const redisKey = `rl:${key}`;
        const count = await client.incr(redisKey);
        if (count === 1) {
          await client.pexpire(redisKey, windowMs);
        }
        const ttlMs = await client.pttl(redisKey);
        if (count > limit) {
          return {
            allowed: false,
            retryAfterSeconds: Math.max(1, Math.ceil(Math.max(ttlMs, 0) / 1000)),
            backend: "redis",
          };
        }
        return { allowed: true, retryAfterSeconds: 0, backend: "redis" };
      } catch (error) {
        console.error("[rate-limit] redis failed", {
          message: error instanceof Error ? error.message : "unknown",
        });
        if (failClosed) {
          return { allowed: false, retryAfterSeconds: 60, backend: "closed" };
        }
      }
    } else if (failClosed) {
      return { allowed: false, retryAfterSeconds: 60, backend: "closed" };
    }
  }

  const memory = memoryCheckRateLimit(key, limit, windowMs);
  return { ...memory, backend: "memory" };
}

export { resetRateLimitStore };
