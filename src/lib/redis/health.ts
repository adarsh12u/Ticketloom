import { prisma } from "@/lib/db/prisma";
import { redisPing } from "@/lib/redis/client";
import { getQueueConnectionOptions } from "@/lib/queues/connection";
import { QUEUE_NAMES } from "@/lib/queues/names";
import { Queue } from "bullmq";

export type HealthStatus = "healthy" | "degraded" | "unavailable" | "disabled";

export type SystemHealth = {
  postgres: { status: HealthStatus; latencyMs: number | null };
  redis: { status: HealthStatus; latencyMs: number | null };
  worker: { status: HealthStatus; detail: string };
  checkedAt: string;
};

async function checkPostgres(): Promise<SystemHealth["postgres"]> {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "healthy", latencyMs: Date.now() - started };
  } catch {
    return { status: "unavailable", latencyMs: null };
  }
}

async function checkRedis(): Promise<SystemHealth["redis"]> {
  const started = Date.now();
  const ping = await redisPing();
  if (ping === "disabled") return { status: "disabled", latencyMs: null };
  if (ping === "ok") return { status: "healthy", latencyMs: Date.now() - started };
  return { status: "unavailable", latencyMs: null };
}

async function checkWorker(): Promise<SystemHealth["worker"]> {
  const connection = getQueueConnectionOptions();
  if (!connection) {
    return { status: "disabled", detail: "REDIS_URL is not configured" };
  }

  try {
    const queue = new Queue(QUEUE_NAMES.email, { connection });
    const [counts, workers] = await Promise.all([
      queue.getJobCounts("waiting", "active", "delayed", "failed"),
      queue.getWorkers(),
    ]);
    await queue.close();

    if (!workers.length) {
      return {
        status: "degraded",
        detail: `queues reachable, no workers connected (waiting=${counts.waiting ?? 0}, failed=${counts.failed ?? 0})`,
      };
    }

    return {
      status: "healthy",
      detail: `workers=${workers.length} (waiting=${counts.waiting ?? 0}, active=${counts.active ?? 0}, failed=${counts.failed ?? 0})`,
    };
  } catch (error) {
    return {
      status: "unavailable",
      detail: error instanceof Error ? error.message : "queue unreachable",
    };
  }
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const [postgres, redis, worker] = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkWorker(),
  ]);

  return {
    postgres,
    redis,
    worker,
    checkedAt: new Date().toISOString(),
  };
}
