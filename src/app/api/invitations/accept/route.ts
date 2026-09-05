import { NextResponse } from "next/server";

import {
  handleOrganizationRouteError,
  requireApiUser,
} from "@/controllers/organization-controller";
import { checkRateLimit } from "@/lib/redis/rate-limit";
import { acceptInvitationSchema } from "@/lib/validations/organization";
import { organizationService } from "@/services/organization-service";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const rate = await checkRateLimit(`invite-accept:${user.id}:${ip}`, 20, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many invitation attempts. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds) },
        },
      );
    }

    const body = await request.json();
    const parsed = acceptInvitationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const result = await organizationService.acceptInvitation(
      user.id,
      parsed.data.token,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return handleOrganizationRouteError(error);
  }
}
