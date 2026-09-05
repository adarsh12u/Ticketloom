import { NextResponse } from "next/server";

import {
  handleOrganizationRouteError,
  requireApiUser,
} from "@/controllers/organization-controller";
import { switchOrganizationSchema } from "@/lib/validations/organization";
import { organizationService } from "@/services/organization-service";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const parsed = switchOrganizationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const organization = await organizationService.switch(
      user.id,
      parsed.data.organizationId,
    );
    return NextResponse.json({ organization });
  } catch (error) {
    return handleOrganizationRouteError(error);
  }
}
