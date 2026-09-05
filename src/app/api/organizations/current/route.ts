import { NextResponse } from "next/server";

import {
  handleOrganizationRouteError,
  requireApiUser,
} from "@/controllers/organization-controller";
import { updateOrganizationSchema } from "@/lib/validations/organization";
import { organizationService } from "@/services/organization-service";

export async function GET() {
  try {
    const user = await requireApiUser();
    const organization = await organizationService.getActive(user.id);
    return NextResponse.json({ organization });
  } catch (error) {
    return handleOrganizationRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const parsed = updateOrganizationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    if (!parsed.data.name && !parsed.data.slug) {
      return NextResponse.json(
        { error: "Provide a name and/or slug to update." },
        { status: 400 },
      );
    }

    const organization = await organizationService.update(user.id, parsed.data);
    return NextResponse.json({ organization });
  } catch (error) {
    return handleOrganizationRouteError(error);
  }
}
