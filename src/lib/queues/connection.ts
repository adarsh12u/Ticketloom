import type { ConnectionOptions } from "bullmq";

import { getRedisUrl } from "@/lib/redis/client";

/**
 * BullMQ requires a dedicated connection style:
 * maxRetriesPerRequest: null for blocking Worker commands.
 * Do NOT use ioredis keyPrefix with BullMQ.
 */
export function getQueueConnectionOptions(): ConnectionOptions | null {
  const url = getRedisUrl();
  if (!url) return null;

  return {
    url,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  };
}

export function requireQueueConnection(): ConnectionOptions {
  const connection = getQueueConnectionOptions();
  if (!connection) {
    throw new Error("REDIS_URL is required for BullMQ queues.");
  }
  return connection;
}
