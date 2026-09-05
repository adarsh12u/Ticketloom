import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SystemHealthPanel } from "@/components/admin/system-health-panel";
import { requireUser } from "@/lib/auth/session";
import { getCurrentOrganizationContext } from "@/lib/authz";
import { normalizeRole } from "@/lib/authz/permissions";

export const metadata: Metadata = { title: "System health" };

export default async function SystemHealthPage() {
  const user = await requireUser();
  const context = await getCurrentOrganizationContext(user.id);
  if (!context) {
    redirect("/onboarding");
  }

  const role = normalizeRole(context.role);
  if (role !== "OWNER" && role !== "ADMIN") {
    redirect("/dashboard");
  }

  return <SystemHealthPanel />;
}
