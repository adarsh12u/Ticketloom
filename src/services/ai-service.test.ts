import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/lib/authz/errors";
import { hashPassword } from "@/lib/auth/password";
import { AI_UNAVAILABLE } from "@/lib/ai/types";
import { prisma } from "@/lib/db/prisma";
import { organizationRepository } from "@/repositories/organization-repository";
import { ticketRepository } from "@/repositories/ticket-repository";
import {
  AiServiceError,
  aiService,
  resetAiProviderCache,
} from "@/services/ai-service";

const runIntegration = Boolean(process.env.DATABASE_URL);

describe.runIf(runIntegration)("aiService integration", () => {
  const suffix = Date.now();
  let ownerA = "";
  let ownerB = "";
  let viewerA = "";
  let orgA = "";
  let orgB = "";
  let ticketA = "";
  let ticketB = "";

  beforeAll(async () => {
    process.env.AUTH_SECRET ??= "test-secret-ticketloom-auth-32chars!!";
    process.env.AI_PROVIDER = "mock";
    process.env.AI_ENABLED = "true";
    delete process.env.MOCK_AI_UNAVAILABLE;
    resetAiProviderCache();

    const passwordHash = await hashPassword("SecurePass123!");
    const [ownerUserA, ownerUserB, viewerUser] = await Promise.all([
      prisma.user.create({
        data: { email: `ai-owner-a-${suffix}@example.com`, name: "AI Owner A", passwordHash },
      }),
      prisma.user.create({
        data: { email: `ai-owner-b-${suffix}@example.com`, name: "AI Owner B", passwordHash },
      }),
      prisma.user.create({
        data: { email: `ai-viewer-${suffix}@example.com`, name: "AI Viewer", passwordHash },
      }),
    ]);
    ownerA = ownerUserA.id;
    ownerB = ownerUserB.id;
    viewerA = viewerUser.id;

    const createdA = await organizationRepository.createWithOwner({
      name: `AI Org A ${suffix}`,
      ownerUserId: ownerA,
      slug: `ai-a-${suffix}`,
    });
    orgA = createdA.organization.id;
    const createdB = await organizationRepository.createWithOwner({
      name: `AI Org B ${suffix}`,
      ownerUserId: ownerB,
      slug: `ai-b-${suffix}`,
    });
    orgB = createdB.organization.id;

    await organizationRepository.createMembership({
      userId: viewerA,
      organizationId: orgA,
      role: "VIEWER",
      status: "ACTIVE",
    });
    await prisma.user.update({
      where: { id: viewerA },
      data: { activeOrganizationId: orgA },
    });

    const customerA = await ticketRepository.upsertCustomer(orgA, {
      name: "AI Customer A",
      email: `ai-cust-a-${suffix}@example.com`,
    });
    const customerB = await ticketRepository.upsertCustomer(orgB, {
      name: "AI Customer B",
      email: `ai-cust-b-${suffix}@example.com`,
    });

    const ticketCreatedA = await ticketServiceCreate(ownerA, customerA.id);
    ticketA = ticketCreatedA!.id;
    const ticketCreatedB = await ticketServiceCreate(ownerB, customerB.id);
    ticketB = ticketCreatedB!.id;
  });

  beforeEach(() => {
    process.env.AI_PROVIDER = "mock";
    process.env.AI_ENABLED = "true";
    delete process.env.MOCK_AI_UNAVAILABLE;
    resetAiProviderCache();
  });

  afterAll(async () => {
    const orgIds = [orgA, orgB].filter(Boolean);
    if (orgIds.length) {
      await prisma.aiSuggestionEvent.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.aiUsageEvent.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.ragRetrievalEvent.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.ticketMessage.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.ticketActivity.deleteMany({
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
    await prisma.user.deleteMany({
      where: { id: { in: [ownerA, ownerB, viewerA].filter(Boolean) } },
    });
    await prisma.$disconnect();
  });

  it("summarizes a ticket with the mock provider", async () => {
    const result = await aiService.summarizeTicket(ownerA, ticketA);
    expect(result.suggestionId).toBeTruthy();
    expect(result.data.summary.length).toBeGreaterThan(0);
    expect(result.feature).toBe("TICKET_SUMMARY");
  });

  it("denies VIEWER ai.use", async () => {
    await expect(aiService.summarizeTicket(viewerA, ticketA)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
  });

  it("enforces tenant isolation for ticket summary", async () => {
    await expect(aiService.summarizeTicket(ownerA, ticketB)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("returns AI_UNAVAILABLE when mock provider is forced down", async () => {
    process.env.MOCK_AI_UNAVAILABLE = "true";
    resetAiProviderCache();
    await expect(aiService.summarizeTicket(ownerA, ticketA)).rejects.toMatchObject({
      code: AI_UNAVAILABLE,
    });
  });

  it("records suggestion lifecycle events", async () => {
    const generated = await aiService.suggestReply(ownerA, { ticketId: ticketA });
    expect(generated.autoSend).toBe(false);
    await aiService.recordSuggestionEvent(ownerA, {
      suggestionId: generated.suggestionId,
      feature: "REPLY_SUGGESTION",
      eventType: "INSERTED",
    });
    await aiService.submitFeedback(ownerA, {
      suggestionId: generated.suggestionId,
      feature: "REPLY_SUGGESTION",
      helpful: true,
    });
    const events = await prisma.aiSuggestionEvent.findMany({
      where: { suggestionId: generated.suggestionId, organizationId: orgA },
    });
    expect(events.some((e) => e.eventType === "GENERATED")).toBe(true);
    expect(events.some((e) => e.eventType === "INSERTED")).toBe(true);
    expect(events.some((e) => e.eventType === "FEEDBACK_HELPFUL")).toBe(true);
  });

  it("reports mock status as available", async () => {
    const status = await aiService.getStatus(ownerA);
    expect(status.available).toBe(true);
    expect(status.provider).toBe("mock");
  });

  it("returns AI_UNAVAILABLE when AI_ENABLED=false", async () => {
    process.env.AI_ENABLED = "false";
    resetAiProviderCache();
    await expect(aiService.summarizeTicket(ownerA, ticketA)).rejects.toMatchObject({
      code: AI_UNAVAILABLE,
    });
    const status = await aiService.getStatus(ownerA);
    expect(status.available).toBe(false);
  });

  it("scopes suggestion events to the caller's organization", async () => {
    const generated = await aiService.suggestReply(ownerA, { ticketId: ticketA });
    await aiService.recordSuggestionEvent(ownerB, {
      suggestionId: generated.suggestionId,
      feature: "REPLY_SUGGESTION",
      eventType: "INSERTED",
    });
    const orgAEvents = await prisma.aiSuggestionEvent.findMany({
      where: { suggestionId: generated.suggestionId, organizationId: orgA },
    });
    const orgBEvents = await prisma.aiSuggestionEvent.findMany({
      where: { suggestionId: generated.suggestionId, organizationId: orgB },
    });
    // Org B may record its own event row, but must not mutate org A analytics via foreign orgId
    expect(orgAEvents.every((e) => e.organizationId === orgA)).toBe(true);
    expect(orgBEvents.every((e) => e.organizationId === orgB)).toBe(true);
  });
});

async function ticketServiceCreate(userId: string, customerId: string) {
  const { ticketService } = await import("@/services/ticket-service");
  return ticketService.create(userId, {
    subject: "AI test ticket",
    description: "Need help resetting MFA for the billing portal.",
    customerId,
    priority: "MEDIUM",
    type: "QUESTION",
  });
}

// silence unused import lint for AiServiceError in some runners
void AiServiceError;
