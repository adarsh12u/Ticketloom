import { NextResponse } from "next/server";

import {
  handleOrganizationRouteError,
  requireApiUser,
} from "@/controllers/organization-controller";
import { organizationService } from "@/services/organization-service";

export async function GET() {
  try {
    const user = await requireApiUser();
    const invitations = await organizationService.listInvitations(user.id);
    return NextResponse.json({ invitations });
  } catch (error) {
    return handleOrganizationRouteError(error);
  }
}
