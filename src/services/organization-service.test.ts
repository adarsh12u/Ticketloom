import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { hashToken } from "@/lib/auth/tokens";
import { AuthorizationError } from "@/lib/authz/errors";
import {
  hasPermission,
  requireOrganizationMembership,
  requirePermission,
  switchActiveOrganization,
} from "@/lib/authz";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import {
  OrganizationServiceError,
  organizationService,
} from "@/services/organization-service";

const runIntegration = Boolean(process.env.DATABASE_URL);

describe.runIf(runIntegration)("organizationService integration", () => {
  const suffix = Date.now();
  const ownerEmail = `owner-m3-${suffix}@example.com`;
  const agentEmail = `agent-m3-${suffix}@example.com`;
  const outsiderEmail = `outsider-m3-${suffix}@example.com`;
  const inviteEmail = `invite-m3-${suffix}@example.com`;

  let ownerId = "";
  let agentId = "";
  let outsiderId = "";
  let orgAId = "";
  let orgBId = "";
  let agentMembershipId = "";
  let rawInviteToken = "";

  beforeAll(async () => {
    process.env.AUTH_SECRET ??= "test-secret-ticketloom-auth-32chars!!";
    const passwordHash = await hashPassword("SecurePass123!");

    const owner = await prisma.user.create({
      data: {
        email: ownerEmail,
        name: "Owner M3",
        firstName: "Owner",
        lastName: "M3",
        passwordHash,
      },
    });
    ownerId = owner.id;

    const agent = await prisma.user.create({
      data: {
        email: agentEmail,
        name: "Agent M3",
        firstName: "Agent",
        lastName: "M3",
        passwordHash,
      },
    });
    agentId = agent.id;

    const outsider = await prisma.user.create({
      data: {
        email: outsiderEmail,
        name: "Outsider M3",
        firstName: "Out",
        lastName: "Sider",
        passwordHash,
      },
    });
    outsiderId = outsider.id;

    const invited = await prisma.user.create({
      data: {
        email: inviteEmail,
        name: "Invitee M3",
        firstName: "Invite",
        lastName: "Ee",
        passwordHash,
      },
    });
    void invited;

    const orgA = await organizationService.create(ownerId, {
      name: `Org A ${suffix}`,
      slug: `org-a-${suffix}`,
    });
    orgAId = orgA.id;

    const orgB = await organizationService.create(outsiderId, {
      name: `Org B ${suffix}`,
      slug: `org-b-${suffix}`,
    });
    orgBId = orgB.id;
  });

  afterAll(async () => {
    const emails = [ownerEmail, agentEmail, outsiderEmail, inviteEmail];
    const users = await prisma.user.findMany({ where: { email: { in: emails } } });
    const userIds = users.map((user) => user.id);
    const orgIds = [orgAId, orgBId].filter(Boolean);

    if (orgIds.length) {
      await prisma.organizationInvitation.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.membership.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    }

    if (userIds.length) {
      await prisma.membership.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.account.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    await prisma.$disconnect();
  });

  it("creates organization with unique slug and OWNER membership", async () => {
    const active = await organizationService.getActive(ownerId);
    expect(active.id).toBe(orgAId);
    expect(active.role).toBe("OWNER");
    expect(active.slug).toBe(`org-a-${suffix}`);
  });

  it("rejects duplicate organization slug", async () => {
    await expect(
      organizationService.create(ownerId, {
        name: "Conflict",
        slug: `org-a-${suffix}`,
      }),
    ).rejects.toMatchObject({ code: "SLUG_TAKEN" } satisfies Partial<OrganizationServiceError>);
  });

  it("creates membership and rejects duplicates", async () => {
    const membership = await prisma.membership.create({
      data: {
        userId: agentId,
        organizationId: orgAId,
        role: "AGENT",
        status: "ACTIVE",
      },
    });
    agentMembershipId = membership.id;

    await expect(
      prisma.membership.create({
        data: {
          userId: agentId,
          organizationId: orgAId,
          role: "VIEWER",
          status: "ACTIVE",
        },
      }),
    ).rejects.toThrow();
  });

  it("enforces OWNER/ADMIN/AGENT/VIEWER permissions", async () => {
    expect(hasPermission("OWNER", "members.invite")).toBe(true);
    expect(hasPermission("ADMIN", "members.invite")).toBe(true);
    expect(hasPermission("AGENT", "members.invite")).toBe(false);
    expect(hasPermission("VIEWER", "members.update")).toBe(false);

    expect(() => requirePermission("AGENT", "members.invite")).toThrow(AuthorizationError);
    expect(() => requirePermission("VIEWER", "organization.update")).toThrow(
      AuthorizationError,
    );
  });

  it("prevents unauthorized and cross-tenant organization access", async () => {
    await expect(requireOrganizationMembership(agentId, orgBId)).rejects.toThrow(
      AuthorizationError,
    );
    await expect(requireOrganizationMembership(outsiderId, orgAId)).rejects.toThrow(
      AuthorizationError,
    );
    await expect(
      organizationService.updateMemberRole(outsiderId, {
        membershipId: agentMembershipId,
        role: "ADMIN",
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    } satisfies Partial<OrganizationServiceError>);
    await expect(
      organizationService.assertPermission(outsiderId, orgAId, "members.read"),
    ).rejects.toThrow(AuthorizationError);
  });

  it("switches organization only for valid memberships", async () => {
    // Give owner membership in org B as ADMIN for switch test
    await prisma.membership.create({
      data: {
        userId: ownerId,
        organizationId: orgBId,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });

    const switched = await switchActiveOrganization(ownerId, orgBId);
    expect(switched.organization.id).toBe(orgBId);
    expect(switched.role).toBe("ADMIN");

    await expect(switchActiveOrganization(ownerId, "missing-org")).rejects.toThrow(
      AuthorizationError,
    );

    // Restore active org A for remaining tests
    await switchActiveOrganization(ownerId, orgAId);
  });

  it("lists members and updates roles with last-owner protection", async () => {
    const members = await organizationService.listMembers(ownerId);
    expect(members.some((member) => member.user.email === agentEmail)).toBe(true);

    await organizationService.updateMemberRole(ownerId, {
      membershipId: agentMembershipId,
      role: "VIEWER",
    });

    const ownerMembership = members.find((member) => member.user.id === ownerId);
    expect(ownerMembership).toBeTruthy();

    await expect(
      organizationService.updateMemberRole(ownerId, {
        membershipId: ownerMembership!.id,
        role: "ADMIN",
      }),
    ).rejects.toMatchObject({ code: "LAST_OWNER" } satisfies Partial<OrganizationServiceError>);
  });

  it("prevents AGENT from managing members and protects last owner removal", async () => {
    await expect(
      organizationService.inviteMember(agentId, {
        email: `blocked-${suffix}@example.com`,
        role: "AGENT",
      }),
    ).rejects.toThrow(AuthorizationError);

    const ownerMembership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: { userId: ownerId, organizationId: orgAId },
      },
    });

    await expect(
      organizationService.removeMember(ownerId, { membershipId: ownerMembership!.id }),
    ).rejects.toMatchObject({ code: "LAST_OWNER" } satisfies Partial<OrganizationServiceError>);
  });

  it("creates invitations with hashed tokens and rejects invalid/expired/reuse", async () => {
    const invitation = await organizationService.inviteMember(ownerId, {
      email: inviteEmail,
      role: "AGENT",
    });
    expect(invitation.email).toBe(inviteEmail);

    const stored = await prisma.organizationInvitation.findUnique({
      where: { id: invitation.id },
    });
    expect(stored?.tokenHash).toBeTruthy();
    expect(JSON.stringify(stored)).not.toContain("raw");

    // Recover token by creating a controlled invite for expiration/reuse tests
    const { generateSecureToken } = await import("@/lib/auth/tokens");
    rawInviteToken = generateSecureToken();
    await prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: { tokenHash: hashToken(rawInviteToken) },
    });

    await expect(organizationService.getInvitationPreview("invalid-token")).rejects.toMatchObject({
      code: "INVALID_INVITE",
    } satisfies Partial<OrganizationServiceError>);

    await prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    await expect(
      organizationService.getInvitationPreview(rawInviteToken),
    ).rejects.toMatchObject({
      code: "EXPIRED_INVITE",
    } satisfies Partial<OrganizationServiceError>);

    // Fresh invite for acceptance
    const freshToken = generateSecureToken();
    const fresh = await prisma.organizationInvitation.create({
      data: {
        organizationId: orgAId,
        email: inviteEmail,
        role: "AGENT",
        tokenHash: hashToken(freshToken),
        expiresAt: new Date(Date.now() + 60_000 * 60),
        invitedById: ownerId,
        status: "PENDING",
      },
    });
    rawInviteToken = freshToken;

    const invitee = await prisma.user.findUniqueOrThrow({ where: { email: inviteEmail } });
    const accepted = await organizationService.acceptInvitation(invitee.id, freshToken);
    expect(accepted.organization.id).toBe(orgAId);

    await expect(
      organizationService.acceptInvitation(invitee.id, freshToken),
    ).rejects.toMatchObject({
      code: "INVALID_INVITE",
    } satisfies Partial<OrganizationServiceError>);

    const reused = await prisma.organizationInvitation.findUnique({ where: { id: fresh.id } });
    expect(reused?.status).toBe("ACCEPTED");
    expect(reused?.acceptedAt).toBeTruthy();
  });

  it("prevents ADMIN from assigning OWNER role", async () => {
    // Promote agent to ADMIN first (as owner), then attempt OWNER crowning as that admin
    await organizationService.updateMemberRole(ownerId, {
      membershipId: agentMembershipId,
      role: "ADMIN",
    });

    const outsiderMembership = await prisma.membership.create({
      data: {
        userId: outsiderId,
        organizationId: orgAId,
        role: "AGENT",
        status: "ACTIVE",
      },
    });

    await expect(
      organizationService.updateMemberRole(agentId, {
        membershipId: outsiderMembership.id,
        role: "OWNER",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    } satisfies Partial<OrganizationServiceError>);

    await prisma.membership.delete({ where: { id: outsiderMembership.id } });

    // Restore agent to AGENT for later remove-member test
    await organizationService.updateMemberRole(ownerId, {
      membershipId: agentMembershipId,
      role: "AGENT",
    });
  });

  it("rejects revoked invitations on preview and accept", async () => {
    const { generateSecureToken } = await import("@/lib/auth/tokens");
    const token = generateSecureToken();
    const revoked = await prisma.organizationInvitation.create({
      data: {
        organizationId: orgAId,
        email: `revoked-${suffix}@example.com`,
        role: "AGENT",
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 60_000 * 60),
        invitedById: ownerId,
        status: "REVOKED",
      },
    });

    await expect(organizationService.getInvitationPreview(token)).rejects.toMatchObject({
      code: expect.stringMatching(/INVALID_INVITE|REVOKED/),
    });

    const invitee = await prisma.user.create({
      data: {
        email: `revoked-user-${suffix}@example.com`,
        name: "Revoked User",
        passwordHash: await hashPassword("SecurePass123!"),
      },
    });

    await expect(
      organizationService.acceptInvitation(invitee.id, token),
    ).rejects.toMatchObject({
      code: expect.stringMatching(/INVALID_INVITE|REVOKED/),
    });

    await prisma.organizationInvitation.delete({ where: { id: revoked.id } });
    await prisma.user.delete({ where: { id: invitee.id } });
  });

  it("removes members and enforces permission on server", async () => {
    await organizationService.removeMember(ownerId, { membershipId: agentMembershipId });
    const gone = await prisma.membership.findUnique({ where: { id: agentMembershipId } });
    expect(gone).toBeNull();

    await expect(organizationService.listMembers(agentId)).rejects.toThrow();
  });

  it("rejects unauthenticated organization context helpers", async () => {
    await expect(requireOrganizationMembership("missing-user", orgAId)).rejects.toThrow(
      AuthorizationError,
    );
  });
});
