import { NextResponse } from "next/server";

import { handleOrganizationRouteError } from "@/controllers/organization-controller";
import { checkRateLimit } from "@/lib/redis/rate-limit";
import { organizationService } from "@/services/organization-service";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const rate = await checkRateLimit(`invite-preview:${ip}`, 30, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many invitation lookups. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds) },
        },
      );
    }

    const { token } = await context.params;
    const invitation = await organizationService.getInvitationPreview(
      decodeURIComponent(token),
    );
    return NextResponse.json({ invitation });
  } catch (error) {
    return handleOrganizationRouteError(error);
  }
}
