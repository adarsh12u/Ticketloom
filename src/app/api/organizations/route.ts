import { NextResponse } from "next/server";

import {
  handleOrganizationRouteError,
  requireApiUser,
} from "@/controllers/organization-controller";
import { createOrganizationSchema } from "@/lib/validations/organization";
import { organizationService } from "@/services/organization-service";

export async function GET() {
  try {
    const user = await requireApiUser();
    const organizations = await organizationService.listForUser(user.id);
    const active = await organizationService.getActive(user.id).catch(() => null);
    return NextResponse.json({ organizations, active });
  } catch (error) {
    return handleOrganizationRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const parsed = createOrganizationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const organization = await organizationService.create(user.id, parsed.data);
    return NextResponse.json({ organization }, { status: 201 });
  } catch (error) {
    return handleOrganizationRouteError(error);
  }
}
