import { ensureRedisConnected } from "@/lib/redis/client";
import { assertOrgScopedKey } from "@/lib/redis/keys";

export type CacheGetResult<T> =
  | { hit: true; value: T }
  | { hit: false; value?: undefined };

/**
 * Cache-aside helpers. PostgreSQL remains source of truth.
 * Redis unavailable → treat as miss / no-op write (safe degradation).
 */
export async function cacheGet<T>(
  organizationId: string,
  key: string,
): Promise<CacheGetResult<T>> {
  assertOrgScopedKey(key, organizationId);
  const client = await ensureRedisConnected();
  if (!client) return { hit: false };

  try {
    const raw = await client.get(key);
    if (raw == null) return { hit: false };
    return { hit: true, value: JSON.parse(raw) as T };
  } catch (error) {
    console.error("[cache] get failed; falling back to database", {
      keyPrefix: key.split(":").slice(0, 3).join(":"),
      message: error instanceof Error ? error.message : "unknown",
    });
    return { hit: false };
  }
}

export async function cacheSet(
  organizationId: string,
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<boolean> {
  assertOrgScopedKey(key, organizationId);
  if (ttlSeconds <= 0) {
    throw new Error("Cache TTL must be positive.");
  }

  const client = await ensureRedisConnected();
  if (!client) return false;

  try {
    await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
    return true;
  } catch (error) {
    console.error("[cache] set failed", {
      keyPrefix: key.split(":").slice(0, 3).join(":"),
      message: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
}

export async function cacheDel(
  organizationId: string,
  keys: string[],
): Promise<number> {
  if (!keys.length) return 0;
  for (const key of keys) {
    assertOrgScopedKey(key, organizationId);
  }

  const client = await ensureRedisConnected();
  if (!client) return 0;

  try {
    return await client.del(...keys);
  } catch (error) {
    console.error("[cache] del failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return 0;
  }
}

export async function cacheGetOrSet<T>(
  organizationId: string,
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<{ value: T; fromCache: boolean }> {
  const cached = await cacheGet<T>(organizationId, key);
  if (cached.hit) {
    return { value: cached.value, fromCache: true };
  }

  const value = await loader();
  await cacheSet(organizationId, key, value, ttlSeconds);
  return { value, fromCache: false };
}
