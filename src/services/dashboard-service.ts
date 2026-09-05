import { requireOrganizationContext, hasPermission } from "@/lib/authz";
import { cacheGetOrSet } from "@/lib/redis/cache";
import { CACHE_TTL, cacheKeys } from "@/lib/redis/keys";
import { customerRepository } from "@/repositories/customer-repository";
import { ticketRepository } from "@/repositories/ticket-repository";

export type DashboardSummary = {
  tickets: {
    total: number;
    open: number;
    urgent: number;
    resolved: number;
  };
  customers: {
    total: number;
    active: number;
    prospects: number;
  };
};

/**
 * Cache-aside dashboard aggregates.
 * PostgreSQL remains source of truth; Redis miss loads counts then SETs with short TTL.
 */
export const dashboardService = {
  async getSummary(userId: string): Promise<DashboardSummary> {
    const context = await requireOrganizationContext(userId);
    const organizationId = context.organization.id;
    const canTickets = hasPermission(context.role, "tickets.read");
    const canCustomers = hasPermission(context.role, "customers.read");

    const { value } = await cacheGetOrSet(
      organizationId,
      cacheKeys.dashboardSummary(organizationId),
      CACHE_TTL.dashboardSummary,
      async () => {
        const emptyTickets = { total: 0, open: 0, urgent: 0, resolved: 0 };
        const emptyCustomers = { total: 0, active: 0, prospects: 0 };

        const [tickets, customers] = await Promise.all([
          canTickets
            ? Promise.all([
                ticketRepository.list({
                  organizationId,
                  includeArchived: false,
                  sortBy: "createdAt",
                  sortDir: "desc",
                  skip: 0,
                  take: 1,
                }),
                ticketRepository.list({
                  organizationId,
                  status: "OPEN",
                  includeArchived: false,
                  sortBy: "createdAt",
                  sortDir: "desc",
                  skip: 0,
                  take: 1,
                }),
                ticketRepository.list({
                  organizationId,
                  priority: "URGENT",
                  includeArchived: false,
                  sortBy: "createdAt",
                  sortDir: "desc",
                  skip: 0,
                  take: 1,
                }),
                ticketRepository.list({
                  organizationId,
                  status: "RESOLVED",
                  includeArchived: false,
                  sortBy: "createdAt",
                  sortDir: "desc",
                  skip: 0,
                  take: 1,
                }),
              ]).then(([all, open, urgent, resolved]) => ({
                total: all.total,
                open: open.total,
                urgent: urgent.total,
                resolved: resolved.total,
              }))
            : Promise.resolve(emptyTickets),
          canCustomers
            ? customerRepository.countForOrg(organizationId)
            : Promise.resolve(emptyCustomers),
        ]);

        return { tickets, customers };
      },
    );

    return value;
  },
};
