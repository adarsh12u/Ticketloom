/**
 * Tenant-safe Redis cache key builders.
 * Every organization-scoped key MUST include organizationId.
 */

export const CACHE_TTL = {
  /** Dashboard aggregates change often but tolerate brief staleness. */
  dashboardSummary: 30,
  /** Ticket list metadata (agents/teams/tags) is relatively stable. */
  ticketsMeta: 60,
  /** Customer list metadata (tags/counts) is relatively stable. */
  customersMeta: 60,
  /** Single ticket detail — short TTL; invalidated on writes. */
  ticket: 45,
  /** Single customer profile — short TTL; invalidated on writes. */
  customer: 45,
  /** Organization profile for the active tenant. */
  organization: 120,
  /** Knowledge category tree per knowledge base. */
  knowledgeCategories: 120,
  /** Popular / most-viewed knowledge articles. */
  knowledgePopular: 60,
  /** Knowledge dashboard summary counts. */
  knowledgeSummary: 30,
  /** Org-wide analytics dashboard (7/30/90). */
  analyticsDashboard: 60,
} as const;

export const cacheKeys = {
  dashboardSummary: (organizationId: string) =>
    `org:${organizationId}:dashboard:summary`,
  ticketsMeta: (organizationId: string) => `org:${organizationId}:tickets:meta`,
  customersMeta: (organizationId: string) =>
    `org:${organizationId}:customers:meta`,
  ticket: (organizationId: string, ticketId: string) =>
    `org:${organizationId}:ticket:${ticketId}`,
  customer: (organizationId: string, customerId: string) =>
    `org:${organizationId}:customer:${customerId}`,
  organization: (organizationId: string) =>
    `org:${organizationId}:organization`,
  knowledgeCategories: (organizationId: string, knowledgeBaseId: string) =>
    `org:${organizationId}:knowledge:${knowledgeBaseId}:categories`,
  knowledgePopular: (organizationId: string) =>
    `org:${organizationId}:knowledge:popular`,
  knowledgeSummary: (organizationId: string) =>
    `org:${organizationId}:knowledge:summary`,
  analyticsDashboard: (organizationId: string) =>
    `org:${organizationId}:analytics:dashboard`,
};

export function assertOrgScopedKey(key: string, organizationId: string) {
  const prefix = `org:${organizationId}:`;
  if (!key.startsWith(prefix)) {
    throw new Error("Cache key is not scoped to the expected organization.");
  }
}
