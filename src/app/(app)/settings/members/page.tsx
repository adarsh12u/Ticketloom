import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MembersManager } from "@/components/organization/members-manager";
import { hasPermission } from "@/lib/authz";
import { requireUser } from "@/lib/auth/session";
import { organizationService } from "@/services/organization-service";

export const metadata: Metadata = { title: "Members" };

export default async function MembersSettingsPage() {
  const user = await requireUser("/settings/members");

  let active;
  try {
    active = await organizationService.getActive(user.id);
  } catch {
    redirect("/onboarding");
  }

  if (!hasPermission(active.role, "members.read")) {
    redirect("/dashboard");
  }

  const [members, invitations] = await Promise.all([
    organizationService.listMembers(user.id),
    organizationService.listInvitations(user.id),
  ]);

  return (
    <MembersManager
      currentUserId={user.id}
      canInvite={hasPermission(active.role, "members.invite")}
      canUpdate={hasPermission(active.role, "members.update")}
      canRemove={hasPermission(active.role, "members.remove")}
      members={members.map((member) => ({
        ...member,
        createdAt: member.createdAt.toISOString(),
      }))}
      invitations={invitations.map((invite) => ({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        status: invite.status,
        expiresAt: invite.expiresAt.toISOString(),
        invitedBy: invite.invitedBy,
      }))}
    />
  );
}
