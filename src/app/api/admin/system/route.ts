import { NextResponse } from "next/server";

import { requireApiUser } from "@/controllers/organization-controller";
import { requireOrganizationContext, requirePermission } from "@/lib/authz";
import { AuthorizationError } from "@/lib/authz/errors";
import { getSystemHealth } from "@/lib/redis/health";
import { getQueueObservability, enqueueTicketSlaScan } from "@/lib/queues/producers";
import { normalizeRole } from "@/lib/authz/permissions";

function handleError(error: unknown) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  return NextResponse.json({ error: "Unable to load system status." }, { status: 500 });
}

async function requireAdmin(userId: string) {
  const context = await requireOrganizationContext(userId);
  const role = normalizeRole(context.role);
  if (role !== "OWNER" && role !== "ADMIN") {
    throw new AuthorizationError("System status is restricted to owners and admins.", "FORBIDDEN");
  }
  // organization.update is admin-level without exposing a new permission key
  requirePermission(context.role, "organization.update");
  return context;
}

export async function GET() {
  try {
    const user = await requireApiUser();
    await requireAdmin(user.id);

    const [health, queues] = await Promise.all([
      getSystemHealth(),
      getQueueObservability(),
    ]);

    return NextResponse.json({
      health: {
        postgres: {
          status: health.postgres.status,
          latencyMs: health.postgres.latencyMs,
        },
        redis: {
          status: health.redis.status,
          latencyMs: health.redis.latencyMs,
        },
        worker: {
          status: health.worker.status,
          detail: health.worker.detail,
        },
        checkedAt: health.checkedAt,
      },
      queues,
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    await requireAdmin(user.id);

    const body = (await request.json().catch(() => ({}))) as { action?: string };
    if (body.action !== "sla-scan") {
      return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
    }

    const result = await enqueueTicketSlaScan("manual");
    return NextResponse.json({ queued: true, jobId: result.jobId });
  } catch (error) {
    if (error instanceof Error && error.name === "QueueUnavailableError") {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return handleError(error);
  }
}
