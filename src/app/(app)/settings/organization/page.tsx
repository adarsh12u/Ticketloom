import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { OrganizationSettingsForm } from "@/components/organization/organization-settings-form";
import { RoleBadge } from "@/components/organization/role-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hasPermission } from "@/lib/authz";
import { requireUser } from "@/lib/auth/session";
import { organizationService } from "@/services/organization-service";

export const metadata: Metadata = { title: "Organization settings" };

export default async function OrganizationSettingsPage() {
  const user = await requireUser("/settings/organization");
  let organization;
  try {
    organization = await organizationService.getActive(user.id);
  } catch {
    redirect("/onboarding");
  }

  const canUpdate = hasPermission(organization.role, "organization.update");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Organization</h1>
          <p className="text-sm text-muted-foreground">
            Workspace identity and membership for the active organization.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RoleBadge role={organization.role} />
          <Button asChild variant="outline">
            <Link href="/settings/members">Manage members</Link>
          </Button>
        </div>
      </div>

      <OrganizationSettingsForm
        name={organization.name}
        slug={organization.slug}
        canUpdate={canUpdate}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your access</CardTitle>
          <CardDescription>
            Permissions are derived from your membership role on the server — never from the client.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
            {organization.permissions.map((permission) => (
              <li key={permission} className="font-mono text-xs">
                {permission}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
