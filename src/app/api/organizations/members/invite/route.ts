import { NextResponse } from "next/server";

import {
  handleOrganizationRouteError,
  requireApiUser,
} from "@/controllers/organization-controller";
import { checkRateLimit } from "@/lib/redis/rate-limit";
import { inviteMemberSchema } from "@/lib/validations/organization";
import { organizationService } from "@/services/organization-service";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rate = await checkRateLimit(`invite:${user.id}:${ip}`, 20, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many invitation requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }

    const body = await request.json();
    const parsed = inviteMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const invitation = await organizationService.inviteMember(user.id, parsed.data);
    return NextResponse.json({ invitation }, { status: 201 });
  } catch (error) {
    return handleOrganizationRouteError(error);
  }
}
