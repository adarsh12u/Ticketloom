import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/lib/authz/errors";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { organizationRepository } from "@/repositories/organization-repository";
import { ticketRepository } from "@/repositories/ticket-repository";
import {
  CustomerServiceError,
  customerService,
} from "@/services/customer-service";
import { ticketService } from "@/services/ticket-service";

const runIntegration = Boolean(process.env.DATABASE_URL);

describe.runIf(runIntegration)("customerService integration", () => {
  const suffix = Date.now();
  const ownerEmail = `owner-m5-${suffix}@example.com`;
  const viewerEmail = `viewer-m5-${suffix}@example.com`;
  const outsiderEmail = `outsider-m5-${suffix}@example.com`;

  let ownerId = "";
  let viewerId = "";
  let outsiderId = "";
  let orgAId = "";
  let orgBId = "";
  let customerId = "";
  let tagId = "";
  let foreignCustomerId = "";

  beforeAll(async () => {
    process.env.AUTH_SECRET ??= "test-secret-ticketloom-auth-32chars!!";
    const passwordHash = await hashPassword("SecurePass123!");

    const owner = await prisma.user.create({
      data: { email: ownerEmail, name: "Owner M5", passwordHash },
    });
    ownerId = owner.id;

    const viewer = await prisma.user.create({
      data: { email: viewerEmail, name: "Viewer M5", passwordHash },
    });
    viewerId = viewer.id;

    const outsider = await prisma.user.create({
      data: { email: outsiderEmail, name: "Outsider M5", passwordHash },
    });
    outsiderId = outsider.id;

    const orgA = await organizationRepository.createWithOwner({
      name: `CRM Org A ${suffix}`,
      ownerUserId: ownerId,
      slug: `crm-a-${suffix}`,
    });
    orgAId = orgA.organization.id;

    const orgB = await organizationRepository.createWithOwner({
      name: `CRM Org B ${suffix}`,
      ownerUserId: outsiderId,
      slug: `crm-b-${suffix}`,
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

    const tag = await ticketRepository.createTag(orgAId, "vip", "gold");
    tagId = tag.id;

    const foreign = await customerService.create(outsiderId, {
      firstName: "Foreign",
      lastName: "Customer",
      email: `foreign-${suffix}@example.com`,
    });
    foreignCustomerId = foreign.id;
  });

  afterAll(async () => {
    const orgIds = [orgAId, orgBId].filter(Boolean);
    if (orgIds.length) {
      await prisma.customerActivity.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.customerNote.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.customerTag.deleteMany({
        where: { customer: { organizationId: { in: orgIds } } },
      });
      await prisma.ticketActivity.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.ticketMessage.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.ticketTag.deleteMany({
        where: { ticket: { organizationId: { in: orgIds } } },
      });
      await prisma.ticket.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.ticketCounter.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.customer.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.tag.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.team.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.membership.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.organizationInvitation.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    }
    await prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, viewerEmail, outsiderEmail] } },
    });
    await prisma.$disconnect();
  });

  it("creates, retrieves, and updates customers", async () => {
    const created = await customerService.create(ownerId, {
      firstName: "Ada",
      lastName: "Lovelace",
      email: `ada-${suffix}@example.com`,
      company: "Analytical Engines",
      phone: "+1-555-0100",
      status: "PROSPECT",
      tagIds: [tagId],
    });

    expect(created.name).toBe("Ada Lovelace");
    expect(created.status).toBe("PROSPECT");
    expect(created.tags.some((tag) => tag.id === tagId)).toBe(true);
    expect(created.activities.some((activity) => activity.type === "CUSTOMER_CREATED")).toBe(
      true,
    );
    customerId = created.id;

    const loaded = await customerService.get(ownerId, customerId);
    expect(loaded.email).toBe(`ada-${suffix}@example.com`);

    const updated = await customerService.update(ownerId, customerId, {
      status: "ACTIVE",
      jobTitle: "Mathematician",
    });
    expect(updated.status).toBe("ACTIVE");
    expect(updated.jobTitle).toBe("Mathematician");
    expect(updated.activities.some((activity) => activity.type === "STATUS_CHANGED")).toBe(
      true,
    );
  });

  it("supports search, pagination, filtering, and sorting", async () => {
    await customerService.create(ownerId, {
      name: "Grace Hopper",
      email: `grace-${suffix}@example.com`,
      company: "Navy",
    });

    const searched = await customerService.list(ownerId, {
      page: 1,
      pageSize: 10,
      q: "Ada",
      sort: "alphabetical",
      includeArchived: false,
    });
    expect(searched.items.some((item) => item.id === customerId)).toBe(true);

    const filtered = await customerService.list(ownerId, {
      page: 1,
      pageSize: 10,
      status: "ACTIVE",
      company: "Analytical",
      tagId,
      sort: "recently_active",
      includeArchived: false,
    });
    expect(filtered.items.some((item) => item.id === customerId)).toBe(true);

    const page = await customerService.list(ownerId, {
      page: 1,
      pageSize: 1,
      sort: "newest",
      includeArchived: false,
    });
    expect(page.pageSize).toBe(1);
    expect(page.total).toBeGreaterThanOrEqual(2);
  });

  it("links tickets and records customer activity/notes", async () => {
    const ticket = await ticketService.create(ownerId, {
      subject: "Punch card reader issue",
      description: "Hardware failure",
      customerId,
      priority: "HIGH",
    });

    const profile = await customerService.get(ownerId, customerId);
    expect(profile.tickets.some((item) => item.id === ticket!.id)).toBe(true);
    expect(profile.activities.some((activity) => activity.type === "TICKET_CREATED")).toBe(
      true,
    );

    const note = await customerService.addNote(
      ownerId,
      customerId,
      "Internal context for future agents",
    );
    expect(note.body).toContain("Internal context");

    await ticketService.update(ownerId, ticket!.id, { status: "RESOLVED" });
    const afterResolve = await customerService.get(ownerId, customerId);
    expect(
      afterResolve.activities.some((activity) => activity.type === "TICKET_RESOLVED"),
    ).toBe(true);
  });

  it("archives and restores without destroying ticket history", async () => {
    const archived = await customerService.archive(ownerId, customerId);
    expect(archived.status).toBe("ARCHIVED");
    expect(archived.archivedAt).toBeTruthy();

    const listed = await customerService.list(ownerId, {
      page: 1,
      pageSize: 50,
      includeArchived: false,
      sort: "newest",
    });
    expect(listed.items.some((item) => item.id === customerId)).toBe(false);

    const restored = await customerService.restore(ownerId, customerId);
    expect(restored.status).toBe("ACTIVE");
    expect(restored.archivedAt).toBeNull();

    const tickets = await ticketService.list(ownerId, {
      page: 1,
      pageSize: 20,
      customerId,
      includeArchived: false,
      sortBy: "createdAt",
      sortDir: "desc",
    });
    expect(tickets.total).toBeGreaterThanOrEqual(1);
  });

  it("enforces RBAC, isolation, and invalid input", async () => {
    await expect(customerService.get(outsiderId, customerId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    } satisfies Partial<CustomerServiceError>);

    await expect(customerService.get(ownerId, foreignCustomerId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    } satisfies Partial<CustomerServiceError>);

    await expect(
      customerService.create(viewerId, {
        name: "Blocked",
        email: `blocked-${suffix}@example.com`,
      }),
    ).rejects.toThrow(AuthorizationError);

    await expect(
      customerService.update(viewerId, customerId, { company: "Nope" }),
    ).rejects.toThrow(AuthorizationError);

    await expect(customerService.archive(viewerId, customerId)).rejects.toThrow(
      AuthorizationError,
    );

    await expect(
      customerService.create(ownerId, {
        email: "missing-name@example.com",
      } as never),
    ).rejects.toMatchObject({
      code: "VALIDATION",
    } satisfies Partial<CustomerServiceError>);

    await expect(
      customerService.create(ownerId, {
        name: "Dup",
        email: `ada-${suffix}@example.com`,
      }),
    ).rejects.toMatchObject({
      code: "DUPLICATE_EMAIL",
    } satisfies Partial<CustomerServiceError>);
  });
});
