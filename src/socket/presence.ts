import Redis from "ioredis";

import { ensureRedisConnected, getRedisUrl, isRedisConfigured } from "@/lib/redis/client";

const PRESENCE_TTL_SECONDS = 60;
const CONNECTION_SET_TTL = 120;

function presenceKey(organizationId: string, userId: string) {
  return `presence:org:${organizationId}:user:${userId}`;
}

function connectionsKey(organizationId: string, userId: string) {
  return `presence:org:${organizationId}:user:${userId}:connections`;
}

/**
 * Redis-backed presence with multi-tab connection counting.
 * A user stays online while at least one socket connection remains.
 */
export const presenceService = {
  async trackConnect(organizationId: string, userId: string, socketId: string) {
    if (!isRedisConfigured()) {
      return { online: true, connectionCount: 1 };
    }
    const client = await ensureRedisConnected();
    if (!client) return { online: true, connectionCount: 1 };

    const connKey = connectionsKey(organizationId, userId);
    await client.sadd(connKey, socketId);
    await client.expire(connKey, CONNECTION_SET_TTL);
    const count = await client.scard(connKey);
    await client.set(presenceKey(organizationId, userId), "1", "EX", PRESENCE_TTL_SECONDS);
    return { online: true, connectionCount: count };
  },

  async trackDisconnect(organizationId: string, userId: string, socketId: string) {
    if (!isRedisConfigured()) {
      return { online: false, connectionCount: 0 };
    }
    const client = await ensureRedisConnected();
    if (!client) return { online: false, connectionCount: 0 };

    const connKey = connectionsKey(organizationId, userId);
    await client.srem(connKey, socketId);
    const count = await client.scard(connKey);
    if (count <= 0) {
      await client.del(presenceKey(organizationId, userId));
      await client.del(connKey);
      return { online: false, connectionCount: 0 };
    }
    await client.expire(connKey, CONNECTION_SET_TTL);
    await client.set(presenceKey(organizationId, userId), "1", "EX", PRESENCE_TTL_SECONDS);
    return { online: true, connectionCount: count };
  },

  async heartbeat(organizationId: string, userId: string) {
    if (!isRedisConfigured()) return;
    const client = await ensureRedisConnected();
    if (!client) return;
    await client.set(presenceKey(organizationId, userId), "1", "EX", PRESENCE_TTL_SECONDS);
    await client.expire(connectionsKey(organizationId, userId), CONNECTION_SET_TTL);
  },

  async isOnline(organizationId: string, userId: string) {
    if (!isRedisConfigured()) return false;
    const client = await ensureRedisConnected();
    if (!client) return false;
    return Boolean(await client.exists(presenceKey(organizationId, userId)));
  },

  async listOnlineUserIds(organizationId: string, userIds: string[]) {
    if (!userIds.length) return [] as string[];
    if (!isRedisConfigured()) return [] as string[];
    const client = await ensureRedisConnected();
    if (!client) return [] as string[];
    const pipeline = client.pipeline();
    for (const userId of userIds) {
      pipeline.exists(presenceKey(organizationId, userId));
    }
    const results = await pipeline.exec();
    return userIds.filter((_, index) => Number(results?.[index]?.[1] ?? 0) === 1);
  },
};

/** Dedicated pub/sub clients for Socket.IO Redis adapter (do not reuse cache client). */
export function createSocketAdapterClients(): {
  pubClient: Redis;
  subClient: Redis;
} | null {
  const url = getRedisUrl();
  if (!url) return null;
  const pubClient = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
  });
  const subClient = pubClient.duplicate();
  return { pubClient, subClient };
}
