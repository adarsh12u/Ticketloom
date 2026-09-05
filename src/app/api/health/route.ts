import { NextResponse } from "next/server";

import { getSystemHealth } from "@/lib/redis/health";

/**
 * Public-ish health probe for ops — no credentials, no connection strings.
 */
export async function GET() {
  const health = await getSystemHealth();
  const unhealthy =
    health.postgres.status === "unavailable" ||
    health.redis.status === "unavailable";

  return NextResponse.json(
    {
      status: unhealthy ? "degraded" : "ok",
      postgres: health.postgres.status,
      redis: health.redis.status,
      worker: health.worker.status,
      checkedAt: health.checkedAt,
    },
    { status: unhealthy ? 503 : 200 },
  );
}
