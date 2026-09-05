import { NextResponse } from "next/server";

import {
  handleOrganizationRouteError,
  requireApiUser,
} from "@/controllers/organization-controller";
import {
  removeMemberSchema,
  updateMemberRoleSchema,
} from "@/lib/validations/organization";
import { organizationService } from "@/services/organization-service";

export async function GET() {
  try {
    const user = await requireApiUser();
    const members = await organizationService.listMembers(user.id);
    return NextResponse.json({ members });
  } catch (error) {
    return handleOrganizationRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const parsed = updateMemberRoleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const member = await organizationService.updateMemberRole(user.id, parsed.data);
    return NextResponse.json({ member });
  } catch (error) {
    return handleOrganizationRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const parsed = removeMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    await organizationService.removeMember(user.id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleOrganizationRouteError(error);
  }
}
