import type { Metadata } from "next";

import { RoleBadge } from "@/components/organization/role-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROLE_PERMISSIONS } from "@/lib/authz/permissions";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Roles & permissions" };

const PRIMARY_ROLES = ["OWNER", "ADMIN", "AGENT", "VIEWER"] as const;

export default async function RolesSettingsPage() {
  await requireUser("/settings/roles");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Roles & permissions</h1>
        <p className="text-sm text-muted-foreground">
          Server-side RBAC catalog. Future modules check these permission keys.
        </p>
      </div>

      <div className="grid gap-4">
        {PRIMARY_ROLES.map((role) => (
          <Card key={role}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="text-base">{role}</CardTitle>
                <CardDescription>
                  {ROLE_PERMISSIONS[role].length} permissions
                </CardDescription>
              </div>
              <RoleBadge role={role} />
            </CardHeader>
            <CardContent>
              <ul className="grid gap-1 sm:grid-cols-2">
                {ROLE_PERMISSIONS[role].map((permission) => (
                  <li key={permission} className="font-mono text-xs text-muted-foreground">
                    {permission}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
