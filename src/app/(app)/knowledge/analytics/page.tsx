import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { KnowledgeAnalyticsDashboard } from "@/components/knowledge/knowledge-analytics-dashboard";
import { getCurrentOrganizationContext, hasPermission } from "@/lib/authz";
import { requireUser } from "@/lib/auth/session";
import { serializeKnowledge } from "@/lib/knowledge/serialize";
import { knowledgeService } from "@/services/knowledge-service";

export const metadata: Metadata = { title: "Knowledge analytics" };

export default async function KnowledgeAnalyticsPage() {
  const user = await requireUser("/knowledge/analytics");
  const context = await getCurrentOrganizationContext(user.id);
  if (!context || !hasPermission(context.role, "knowledge.read")) {
    redirect("/dashboard");
  }
  if (
    !hasPermission(context.role, "knowledge.manage") &&
    !hasPermission(context.role, "analytics.read")
  ) {
    redirect("/knowledge");
  }

  const analytics = await knowledgeService.getAnalytics(user.id);
  const data = serializeKnowledge({
    totals: analytics.totals,
    popular: analytics.popular.map((item) => ({
      id: item.id,
      title: item.title,
      viewCount: item.viewCount,
      helpfulCount: item.helpfulCount,
      unhelpfulCount: item.unhelpfulCount,
    })),
    poorFeedback: analytics.poorFeedback.map((item) => ({
      id: item.id,
      title: item.title,
      helpfulCount: item.helpfulCount,
      unhelpfulCount: item.unhelpfulCount,
    })),
    recentlyUpdated: analytics.recentlyUpdated.map((item) => ({
      id: item.id,
      title: item.title,
      updatedAt:
        typeof item.updatedAt === "string"
          ? item.updatedAt
          : item.updatedAt.toISOString(),
      status: item.status,
    })),
    topQueries: analytics.topQueries,
  });

  return <KnowledgeAnalyticsDashboard data={data} />;
}
