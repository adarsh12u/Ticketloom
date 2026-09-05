import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/lib/authz/errors";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { organizationRepository } from "@/repositories/organization-repository";
import { ticketRepository } from "@/repositories/ticket-repository";
import { analyticsService } from "@/services/analytics-service";
import { ticketService } from "@/services/ticket-service";

const runIntegration = Boolean(process.env.DATABASE_URL);

describe.runIf(runIntegration)("analyticsService integration", () => {
  const suffix = Date.now();
  let ownerA = "";
  let ownerB = "";
  let orgA = "";
  let orgB = "";

  beforeAll(async () => {
    process.env.AUTH_SECRET ??= "test-secret-ticketloom-auth-32chars!!";
    const passwordHash = await hashPassword("SecurePass123!");
    const [userA, userB] = await Promise.all([
      prisma.user.create({
        data: {
          email: `analytics-a-${suffix}@example.com`,
          name: "Analytics A",
          passwordHash,
        },
      }),
      prisma.user.create({
        data: {
          email: `analytics-b-${suffix}@example.com`,
          name: "Analytics B",
          passwordHash,
        },
      }),
    ]);
    ownerA = userA.id;
    ownerB = userB.id;

    orgA = (
      await organizationRepository.createWithOwner({
        name: `Analytics Org A ${suffix}`,
        ownerUserId: ownerA,
        slug: `analytics-a-${suffix}`,
      })
    ).organization.id;
    orgB = (
      await organizationRepository.createWithOwner({
        name: `Analytics Org B ${suffix}`,
        ownerUserId: ownerB,
        slug: `analytics-b-${suffix}`,
      })
    ).organization.id;

    const customerA = await ticketRepository.upsertCustomer(orgA, {
      name: "Analytics Customer",
      email: `analytics-cust-${suffix}@example.com`,
    });
    await ticketService.create(ownerA, {
      subject: "Analytics ticket",
      description: "Track me",
      customerId: customerA.id,
      priority: "LOW",
      type: "QUESTION",
    });

    await prisma.aiUsageEvent.create({
      data: {
        organizationId: orgA,
        userId: ownerA,
        feature: "TICKET_SUMMARY",
        provider: "mock",
        model: "mock-llama",
        status: "SUCCESS",
        latencyMs: 12,
      },
    });
  });

  afterAll(async () => {
    const orgIds = [orgA, orgB].filter(Boolean);
    if (orgIds.length) {
      await prisma.aiUsageEvent.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.aiSuggestionEvent.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.ragRetrievalEvent.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.ticketActivity.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.ticketMessage.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.ticket.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.ticketCounter.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.customer.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.membership.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    }
    await prisma.user.deleteMany({ where: { id: { in: [ownerA, ownerB].filter(Boolean) } } });
    await prisma.$disconnect();
  });

  it("returns aggregates for the active organization", async () => {
    const data = await analyticsService.getDashboard(ownerA, 30);
    expect(data.range).toBe(30);
    expect(data.tickets.created).toBeGreaterThanOrEqual(1);
    expect(data.customers.total).toBeGreaterThanOrEqual(1);
    expect(data.ai.requests).toBeGreaterThanOrEqual(1);
  });

  it("isolates tenants", async () => {
    const dataB = await analyticsService.getDashboard(ownerB, 30);
    expect(dataB.tickets.created).toBe(0);
    expect(dataB.ai.requests).toBe(0);
  });

  it("rejects invalid ranges", async () => {
    await expect(
      analyticsService.getDashboard(ownerA, 15 as never),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

void AuthorizationError;
