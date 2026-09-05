import { cacheKeys } from "@/lib/redis/keys";
import { cacheDel } from "@/lib/redis/cache";

export async function invalidateOrganizationCaches(organizationId: string) {
  await cacheDel(organizationId, [
    cacheKeys.dashboardSummary(organizationId),
    cacheKeys.ticketsMeta(organizationId),
    cacheKeys.customersMeta(organizationId),
    cacheKeys.organization(organizationId),
  ]);
}

export async function invalidateTicketCaches(
  organizationId: string,
  ticketId?: string,
) {
  const keys = [
    cacheKeys.dashboardSummary(organizationId),
    cacheKeys.ticketsMeta(organizationId),
  ];
  if (ticketId) {
    keys.push(cacheKeys.ticket(organizationId, ticketId));
  }
  await cacheDel(organizationId, keys);
}

export async function invalidateCustomerCaches(
  organizationId: string,
  customerId?: string,
) {
  const keys = [
    cacheKeys.dashboardSummary(organizationId),
    cacheKeys.customersMeta(organizationId),
  ];
  if (customerId) {
    keys.push(cacheKeys.customer(organizationId, customerId));
  }
  await cacheDel(organizationId, keys);
}

export async function invalidateKnowledgeCaches(
  organizationId: string,
  knowledgeBaseId?: string,
) {
  const keys = [
    cacheKeys.dashboardSummary(organizationId),
    cacheKeys.knowledgePopular(organizationId),
    cacheKeys.knowledgeSummary(organizationId),
  ];
  if (knowledgeBaseId) {
    keys.push(cacheKeys.knowledgeCategories(organizationId, knowledgeBaseId));
  }
  await cacheDel(organizationId, keys);
}
