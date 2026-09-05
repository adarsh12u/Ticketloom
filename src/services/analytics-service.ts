import { requireOrganizationContext, requirePermission } from "@/lib/authz";
import { prisma } from "@/lib/db/prisma";
import { cacheGetOrSet } from "@/lib/redis/cache";
import { CACHE_TTL, cacheKeys } from "@/lib/redis/keys";
import { aiUsageRepository } from "@/repositories/ai-usage-repository";

export class AnalyticsServiceError extends Error {
  constructor(
    message: string,
    public readonly code: "VALIDATION" | "FORBIDDEN" = "VALIDATION",
  ) {
    super(message);
    this.name = "AnalyticsServiceError";
  }
}

export type AnalyticsRange = 7 | 30 | 90;

function rangeToDates(range: AnalyticsRange) {
  const to = new Date();
  const from = new Date(to.getTime() - range * 24 * 60 * 60 * 1000);
  return { from, to };
}

export const analyticsService = {
  async getDashboard(userId: string, range: AnalyticsRange = 30) {
    if (![7, 30, 90].includes(range)) {
      throw new AnalyticsServiceError("range must be 7, 30, or 90.", "VALIDATION");
    }

    const context = await requireOrganizationContext(userId);
    requirePermission(context.role, "analytics.read");
    const organizationId = context.organization.id;
    const { from, to } = rangeToDates(range);

    const cacheKey = `${cacheKeys.analyticsDashboard(organizationId)}:${range}`;
    const { value } = await cacheGetOrSet(
      organizationId,
      cacheKey,
      CACHE_TTL.analyticsDashboard,
      async () => buildDashboard(organizationId, from, to, range),
    );

    return value;
  },
};

async function buildDashboard(
  organizationId: string,
  from: Date,
  to: Date,
  range: AnalyticsRange,
) {
  const [
    ticketStats,
    ticketsByStatus,
    ticketsByDay,
    customerStats,
    chatStats,
    knowledgeStats,
    ai,
    aiDaily,
  ] = await Promise.all([
    prisma.ticket.groupBy({
      by: ["status"],
      where: {
        organizationId,
        archivedAt: null,
        createdAt: { gte: from, lte: to },
      },
      _count: { _all: true },
    }),
    prisma.ticket.groupBy({
      by: ["status"],
      where: { organizationId, archivedAt: null },
      _count: { _all: true },
    }),
    prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
      SELECT date_trunc('day', created_at) AS day, COUNT(*)::bigint AS count
      FROM tickets
      WHERE organization_id = ${organizationId}
        AND archived_at IS NULL
        AND created_at >= ${from}
        AND created_at <= ${to}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    Promise.all([
      prisma.customer.count({
        where: { organizationId, archivedAt: null },
      }),
      prisma.customer.count({
        where: {
          organizationId,
          archivedAt: null,
          createdAt: { gte: from, lte: to },
        },
      }),
      prisma.customer.count({
        where: { organizationId, archivedAt: null, status: "ACTIVE" },
      }),
    ]),
    Promise.all([
      prisma.conversation.count({
        where: {
          organizationId,
          createdAt: { gte: from, lte: to },
        },
      }),
      prisma.chatMessage.count({
        where: {
          organizationId,
          deletedAt: null,
          createdAt: { gte: from, lte: to },
        },
      }),
      prisma.conversation.groupBy({
        by: ["status"],
        where: { organizationId },
        _count: { _all: true },
      }),
    ]),
    Promise.all([
      prisma.knowledgeArticle.count({ where: { organizationId } }),
      prisma.knowledgeArticle.count({
        where: { organizationId, status: "PUBLISHED" },
      }),
      prisma.knowledgeArticleView.count({
        where: { organizationId, createdAt: { gte: from, lte: to } },
      }),
      prisma.knowledgeSearchEvent.count({
        where: { organizationId, createdAt: { gte: from, lte: to } },
      }),
      prisma.knowledgeSearchEvent.count({
        where: {
          organizationId,
          createdAt: { gte: from, lte: to },
          resultCount: 0,
        },
      }),
    ]),
    aiUsageRepository.aggregateUsage(organizationId, from, to),
    aiUsageRepository.dailyUsageCounts(organizationId, from, to),
  ]);

  const ticketsCreatedInRange = ticketStats.reduce(
    (sum, row) => sum + row._count._all,
    0,
  );
  const openStatuses = new Set(["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER"]);
  const openNow = ticketsByStatus
    .filter((row) => openStatuses.has(row.status))
    .reduce((sum, row) => sum + row._count._all, 0);
  const resolvedNow = ticketsByStatus
    .filter((row) => row.status === "RESOLVED" || row.status === "CLOSED")
    .reduce((sum, row) => sum + row._count._all, 0);

  const [customersTotal, customersNew, customersActive] = customerStats;
  const [conversationsCreated, messagesSent, conversationsByStatus] = chatStats;
  const [
    articlesTotal,
    articlesPublished,
    knowledgeViews,
    knowledgeSearches,
    knowledgeNoResults,
  ] = knowledgeStats;

  return {
    range,
    from: from.toISOString(),
    to: to.toISOString(),
    support: {
      ticketsCreated: ticketsCreatedInRange,
      openTickets: openNow,
      resolvedTickets: resolvedNow,
      conversationsCreated,
      messagesSent,
    },
    tickets: {
      created: ticketsCreatedInRange,
      byStatus: ticketsByStatus.map((row) => ({
        status: row.status,
        count: row._count._all,
      })),
      byDay: ticketsByDay.map((row) => ({
        day: row.day.toISOString().slice(0, 10),
        count: Number(row.count),
      })),
    },
    customers: {
      total: customersTotal,
      newInRange: customersNew,
      active: customersActive,
    },
    chat: {
      conversationsCreated,
      messagesSent,
      byStatus: conversationsByStatus.map((row) => ({
        status: row.status,
        count: row._count._all,
      })),
    },
    knowledge: {
      articles: articlesTotal,
      published: articlesPublished,
      views: knowledgeViews,
      searches: knowledgeSearches,
      noResultSearches: knowledgeNoResults,
    },
    ai: {
      ...ai,
      byDay: aiDaily,
    },
  };
}

export type AnalyticsDashboard = Awaited<
  ReturnType<typeof analyticsService.getDashboard>
>;
