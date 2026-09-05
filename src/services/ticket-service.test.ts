import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/lib/authz/errors";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { organizationRepository } from "@/repositories/organization-repository";
import { ticketRepository } from "@/repositories/ticket-repository";
import { TicketServiceError, ticketService } from "@/services/ticket-service";

const runIntegration = Boolean(process.env.DATABASE_URL);

describe.runIf(runIntegration)("ticketService integration", () => {
  const suffix = Date.now();
  const ownerEmail = `owner-m4-${suffix}@example.com`;
  const viewerEmail = `viewer-m4-${suffix}@example.com`;
  const outsiderEmail = `outsider-m4-${suffix}@example.com`;

  let ownerId = "";
  let viewerId = "";
  let outsiderId = "";
  let orgAId = "";
  let orgBId = "";
  let ticketId = "";
  let customerId = "";
  let teamId = "";
  let tagId = "";

  beforeAll(async () => {
    process.env.AUTH_SECRET ??= "test-secret-ticketloom-auth-32chars!!";
    const passwordHash = await hashPassword("SecurePass123!");

    const owner = await prisma.user.create({
      data: {
        email: ownerEmail,
        name: "Owner M4",
        passwordHash,
      },
    });
    ownerId = owner.id;

    const viewer = await prisma.user.create({
      data: {
        email: viewerEmail,
        name: "Viewer M4",
        passwordHash,
      },
    });
    viewerId = viewer.id;

    const outsider = await prisma.user.create({
      data: {
        email: outsiderEmail,
        name: "Outsider M4",
        passwordHash,
      },
    });
    outsiderId = outsider.id;

    const orgA = await organizationRepository.createWithOwner({
      name: `Tickets Org A ${suffix}`,
      ownerUserId: ownerId,
      slug: `tickets-a-${suffix}`,
    });
    orgAId = orgA.organization.id;

    const orgB = await organizationRepository.createWithOwner({
      name: `Tickets Org B ${suffix}`,
      ownerUserId: outsiderId,
      slug: `tickets-b-${suffix}`,
    });
    orgBId = orgB.organization.id;

    await organizationRepository.createMembership({
      userId: viewerId,
      organizationId: orgAId,
      role: "VIEWER",
      status: "ACTIVE",
    });
    await prisma.user.update({
      where: { id: viewerId },
      data: { activeOrganizationId: orgAId },
    });

    const customer = await ticketRepository.upsertCustomer(orgAId, {
      name: "Acme Buyer",
      email: `buyer-${suffix}@acme.test`,
      company: "Acme",
    });
    customerId = customer.id;

    const team = await ticketRepository.createTeam(orgAId, "Support", "L1");
    teamId = team.id;

    const tag = await ticketRepository.createTag(orgAId, "billing", "blue");
    tagId = tag.id;
  });

  afterAll(async () => {
    const orgIds = [orgAId, orgBId].filter(Boolean);
    if (orgIds.length) {
      await prisma.ticketActivity.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.ticketMessage.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.ticketTag.deleteMany({
        where: { ticket: { organizationId: { in: orgIds } } },
      });
      await prisma.ticket.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.ticketCounter.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.tag.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.team.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.customer.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.membership.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.organizationInvitation.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    }

    const emails = [ownerEmail, viewerEmail, outsiderEmail];
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await prisma.$disconnect();
  });

  it("creates tickets with sequential numbers and customer association", async () => {
    const ticket = await ticketService.create(ownerId, {
      subject: "Payment failed on checkout",
      description: "Customer cannot complete payment.",
      customerId,
      priority: "HIGH",
      teamId,
      tagIds: [tagId],
      assigneeId: ownerId,
    });

    expect(ticket?.numberKey).toBe("TKT-000001");
    expect(ticket?.customer.id).toBe(customerId);
    expect(ticket?.team?.id).toBe(teamId);
    expect(ticket?.tags.some((tag) => tag.id === tagId)).toBe(true);
    expect(ticket?.activities.some((activity) => activity.type === "TICKET_CREATED")).toBe(
      true,
    );
    ticketId = ticket!.id;
  });

  it("allocates ticket numbers safely under concurrent creation", async () => {
    const created = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        ticketService.create(ownerId, {
          subject: `Concurrent ticket ${index}`,
          description: "Concurrent create",
          customerId,
        }),
      ),
    );

    const numbers = created.map((ticket) => ticket!.number).sort((a, b) => a - b);
    expect(new Set(numbers).size).toBe(8);
    expect(numbers[0]).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < numbers.length; i += 1) {
      expect(numbers[i]).toBeGreaterThan(numbers[i - 1]);
    }
  });

  it("retrieves, updates status/priority, and assigns", async () => {
    const loaded = await ticketService.get(ownerId, ticketId);
    expect(loaded?.id).toBe(ticketId);

    const updated = await ticketService.update(ownerId, ticketId, {
      status: "IN_PROGRESS",
      priority: "URGENT",
      assigneeId: ownerId,
    });

    expect(updated?.status).toBe("IN_PROGRESS");
    expect(updated?.priority).toBe("URGENT");
    expect(
      updated?.activities.some((activity) => activity.type === "STATUS_CHANGED"),
    ).toBe(true);
    expect(
      updated?.activities.some((activity) => activity.type === "PRIORITY_CHANGED"),
    ).toBe(true);
  });

  it("lists with pagination, search, filtering, and sorting", async () => {
    const listed = await ticketService.list(ownerId, {
      page: 1,
      pageSize: 5,
      q: "Payment",
      status: undefined,
      priority: "URGENT",
      assigneeId: ownerId,
      customerId,
      teamId,
      tagId,
      includeArchived: false,
      sortBy: "createdAt",
      sortDir: "desc",
    });

    expect(listed.items.length).toBeGreaterThanOrEqual(1);
    expect(listed.pageSize).toBe(5);
    expect(listed.total).toBeGreaterThanOrEqual(1);
    expect(listed.items[0]?.numberKey).toMatch(/^TKT-/);

    const page2 = await ticketService.list(ownerId, {
      page: 2,
      pageSize: 3,
      sortBy: "number",
      sortDir: "asc",
      includeArchived: false,
    });
    expect(page2.page).toBe(2);
    expect(page2.items.length).toBeGreaterThan(0);
  });

  it("prevents cross-tenant access and unauthorized mutations", async () => {
    await expect(ticketService.get(outsiderId, ticketId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    } satisfies Partial<TicketServiceError>);

    await expect(
      ticketService.update(outsiderId, ticketId, { status: "CLOSED" }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    } satisfies Partial<TicketServiceError>);

    await expect(
      ticketService.create(viewerId, {
        subject: "Viewer should not create",
        description: "Nope",
        customerId,
      }),
    ).rejects.toThrow(AuthorizationError);

    await expect(
      ticketService.update(viewerId, ticketId, { priority: "LOW" }),
    ).rejects.toThrow(AuthorizationError);

    await expect(ticketService.archive(viewerId, ticketId)).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("separates internal notes from customer-visible replies and records activity", async () => {
    const note = await ticketService.addMessage(ownerId, ticketId, {
      body: "Internal diagnosis details",
      visibility: "INTERNAL",
    });
    const reply = await ticketService.addMessage(ownerId, ticketId, {
      body: "Thanks, we are looking into this.",
      visibility: "CUSTOMER",
    });

    expect(note.visibility).toBe("INTERNAL");
    expect(reply.visibility).toBe("CUSTOMER");

    const loaded = await ticketService.get(ownerId, ticketId);
    expect(loaded?.messages.some((message) => message.visibility === "INTERNAL")).toBe(true);
    expect(loaded?.messages.some((message) => message.visibility === "CUSTOMER")).toBe(true);
    expect(
      loaded?.activities.some((activity) => activity.type === "INTERNAL_NOTE_ADDED"),
    ).toBe(true);
    expect(loaded?.activities.some((activity) => activity.type === "REPLY_ADDED")).toBe(true);
    expect(loaded?.firstRespondedAt).toBeTruthy();
  });

  it("archives tickets with delete permission only", async () => {
    const archived = await ticketService.archive(ownerId, ticketId);
    expect(archived?.archivedAt).toBeTruthy();
    expect(archived?.activities.some((activity) => activity.type === "ARCHIVED")).toBe(true);

    const listed = await ticketService.list(ownerId, {
      page: 1,
      pageSize: 50,
      includeArchived: false,
      sortBy: "createdAt",
      sortDir: "desc",
    });
    expect(listed.items.some((item) => item.id === ticketId)).toBe(false);
  });

  it("rejects invalid assignee/customer from another organization", async () => {
    await expect(
      ticketService.create(ownerId, {
        subject: "Bad customer",
        description: "Should fail",
        customerId: "missing-customer",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_CUSTOMER",
    } satisfies Partial<TicketServiceError>);

    await expect(
      ticketService.create(ownerId, {
        subject: "Bad assignee",
        description: "Should fail",
        customerId,
        assigneeId: outsiderId,
      }),
    ).rejects.toMatchObject({
      code: "INVALID_ASSIGNEE",
    } satisfies Partial<TicketServiceError>);
  });
});
