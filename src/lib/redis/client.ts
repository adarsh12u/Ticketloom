import Redis from "ioredis";

declare global {
  var __ticketloomRedis: Redis | undefined;
  var __ticketloomRedisStatus: "unknown" | "ready" | "error" | "disabled";
}

globalThis.__ticketloomRedisStatus ??= "unknown";

export function getRedisUrl(): string | null {
  const url = process.env.REDIS_URL?.trim();
  return url || null;
}

export function isRedisConfigured(): boolean {
  return Boolean(getRedisUrl());
}

/**
 * Shared Redis client for cache + rate limiting.
 * BullMQ workers use a separate connection with maxRetriesPerRequest: null.
 */
export function getRedisClient(): Redis | null {
  const url = getRedisUrl();
  if (!url) {
    globalThis.__ticketloomRedisStatus = "disabled";
    return null;
  }

  if (!globalThis.__ticketloomRedis) {
    const client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      // Never log credentials; connection string may include password.
      showFriendlyErrorStack: process.env.NODE_ENV !== "production",
    });

    client.on("ready", () => {
      globalThis.__ticketloomRedisStatus = "ready";
    });
    client.on("error", (error) => {
      globalThis.__ticketloomRedisStatus = "error";
      console.error("[redis] connection error", {
        message: error instanceof Error ? error.message : "unknown",
      });
    });
    client.on("end", () => {
      if (globalThis.__ticketloomRedisStatus !== "disabled") {
        globalThis.__ticketloomRedisStatus = "error";
      }
    });

    globalThis.__ticketloomRedis = client;
  }

  return globalThis.__ticketloomRedis;
}

export async function ensureRedisConnected(): Promise<Redis | null> {
  const client = getRedisClient();
  if (!client) return null;

  try {
    if (client.status === "wait" || client.status === "end") {
      await client.connect();
    } else if (client.status === "connecting") {
      await new Promise<void>((resolve, reject) => {
        const onReady = () => {
          cleanup();
          resolve();
        };
        const onError = (error: Error) => {
          cleanup();
          reject(error);
        };
        const cleanup = () => {
          client.off("ready", onReady);
          client.off("error", onError);
        };
        client.once("ready", onReady);
        client.once("error", onError);
      });
    }
    return client;
  } catch (error) {
    globalThis.__ticketloomRedisStatus = "error";
    console.error("[redis] unable to connect", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

export async function redisPing(): Promise<"ok" | "error" | "disabled"> {
  if (!isRedisConfigured()) return "disabled";
  const client = await ensureRedisConnected();
  if (!client) return "error";
  try {
    const result = await client.ping();
    return result === "PONG" ? "ok" : "error";
  } catch {
    return "error";
  }
}

export async function disconnectRedis(): Promise<void> {
  const client = globalThis.__ticketloomRedis;
  if (!client) return;
  try {
    await client.quit();
  } catch {
    client.disconnect();
  } finally {
    globalThis.__ticketloomRedis = undefined;
    globalThis.__ticketloomRedisStatus = "disabled";
  }
}

export function getRedisStatus(): typeof globalThis.__ticketloomRedisStatus {
  return globalThis.__ticketloomRedisStatus;
}
