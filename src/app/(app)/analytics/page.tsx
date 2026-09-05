import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AnalyticsDashboardView } from "@/components/analytics/analytics-dashboard";
import { requireUser } from "@/lib/auth/session";
import { getCurrentOrganizationContext, hasPermission } from "@/lib/authz";
import { analyticsService } from "@/services/analytics-service";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const user = await requireUser("/analytics");
  const context = await getCurrentOrganizationContext(user.id);
  if (!context || !hasPermission(context.role, "analytics.read")) {
    redirect("/dashboard");
  }

  const data = await analyticsService.getDashboard(user.id, 30);

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <AnalyticsDashboardView initialData={data} />
    </div>
  );
}
