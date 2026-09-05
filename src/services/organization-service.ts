import type { MembershipRole } from "@/generated/prisma/client";

import {
  getPermissionsForRole,
  normalizeRole,
  type Permission,
} from "@/lib/authz/permissions";
import {
  requireOrganizationContext,
  requireOrganizationMembership,
  requirePermission,
  switchActiveOrganization,
} from "@/lib/authz";
import { AuthorizationError } from "@/lib/authz/errors";
import { generateSecureToken, hashToken } from "@/lib/auth/tokens";
import { deliverEmail } from "@/services/email-delivery-service";
import { enqueueInvitationExpiry, QueueUnavailableError } from "@/lib/queues/producers";
import { cacheGetOrSet } from "@/lib/redis/cache";
import { CACHE_TTL, cacheKeys } from "@/lib/redis/keys";
import {
  invalidateOrganizationCaches,
} from "@/lib/redis/invalidation";
import type {
  CreateOrganizationInput,
  InviteMemberInput,
  RemoveMemberInput,
  UpdateMemberRoleInput,
} from "@/lib/validations/organization";
import { invitationRepository } from "@/repositories/invitation-repository";
import { organizationRepository } from "@/repositories/organization-repository";
import { userRepository } from "@/repositories/user-repository";
import { slugify } from "@/lib/utils/slug";

const INVITATION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export class OrganizationServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "SLUG_TAKEN"
      | "VALIDATION"
      | "NOT_FOUND"
      | "DUPLICATE_MEMBER"
      | "DUPLICATE_INVITE"
      | "INVALID_INVITE"
      | "EXPIRED_INVITE"
      | "LAST_OWNER"
      | "FORBIDDEN" = "VALIDATION",
  ) {
    super(message);
    this.name = "OrganizationServiceError";
  }
}

function toPublicOrg(organization: { id: string; name: string; slug: string }, role: MembershipRole) {
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    role,
    permissions: getPermissionsForRole(role),
  };
}

export const organizationService = {
  async listForUser(userId: string) {
    const memberships = await organizationRepository.findActiveMembershipsForUser(userId);
    return memberships.map((membership) =>
      toPublicOrg(membership.organization, membership.role),
    );
  },

  async getActive(userId: string) {
    const context = await requireOrganizationContext(userId);
    const organizationId = context.organization.id;

    const { value: organization } = await cacheGetOrSet(
      organizationId,
      cacheKeys.organization(organizationId),
      CACHE_TTL.organization,
      async () => ({
        id: context.organization.id,
        name: context.organization.name,
        slug: context.organization.slug,
      }),
    );

    return {
      ...toPublicOrg(organization, context.role),
      membershipId: context.membership.id,
      status: context.membership.status,
    };
  },

  async create(userId: string, input: CreateOrganizationInput) {
    if (input.slug) {
      const existing = await organizationRepository.findBySlug(slugify(input.slug));
      if (existing) {
        throw new OrganizationServiceError(
          "This organization slug is already taken.",
          "SLUG_TAKEN",
        );
      }
    }

    const result = await organizationRepository.createWithOwner({
      name: input.name,
      ownerUserId: userId,
      slug: input.slug,
      role: "OWNER",
    });

    return toPublicOrg(result.organization, result.membership.role);
  },

  async update(userId: string, input: { name?: string; slug?: string }) {
    const context = await requireOrganizationContext(userId);
    requirePermission(context.role, "organization.update");

    if (input.slug) {
      const slug = slugify(input.slug);
      const existing = await organizationRepository.findBySlug(slug);
      if (existing && existing.id !== context.organization.id) {
        throw new OrganizationServiceError(
          "This organization slug is already taken.",
          "SLUG_TAKEN",
        );
      }
    }

    const updated = await organizationRepository.update(context.organization.id, {
      ...(input.name ? { name: input.name } : {}),
      ...(input.slug ? { slug: slugify(input.slug) } : {}),
    });

    await invalidateOrganizationCaches(context.organization.id);

    return toPublicOrg(updated, context.role);
  },

  async switch(userId: string, organizationId: string) {
    const context = await switchActiveOrganization(userId, organizationId);
    return toPublicOrg(context.organization, context.role);
  },

  async listMembers(userId: string) {
    const context = await requireOrganizationContext(userId);
    requirePermission(context.role, "members.read");

    const members = await organizationRepository.listMembers(context.organization.id);
    return members.map((member) => ({
      id: member.id,
      role: member.role,
      normalizedRole: normalizeRole(member.role),
      status: member.status,
      createdAt: member.createdAt,
      user: member.user,
      permissions: getPermissionsForRole(member.role),
    }));
  },

  async inviteMember(userId: string, input: InviteMemberInput) {
    const context = await requireOrganizationContext(userId);
    requirePermission(context.role, "members.invite");

    const email = input.email.toLowerCase();
    await invitationRepository.expireOverdue(context.organization.id);

    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      const existingMembership = await organizationRepository.findMembership(
        existingUser.id,
        context.organization.id,
      );
      if (existingMembership && existingMembership.status === "ACTIVE") {
        throw new OrganizationServiceError(
          "This user is already a member of the organization.",
          "DUPLICATE_MEMBER",
        );
      }
    }

    const pending = await invitationRepository.findPendingByOrgEmail(
      context.organization.id,
      email,
    );
    if (pending) {
      throw new OrganizationServiceError(
        "A pending invitation already exists for this email.",
        "DUPLICATE_INVITE",
      );
    }

    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    await invitationRepository.deletePendingForEmail(context.organization.id, email);
    const invitation = await invitationRepository.create({
      organizationId: context.organization.id,
      email,
      role: input.role,
      tokenHash,
      expiresAt,
      invitedById: userId,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const inviteUrl = `${appUrl}/invite/${encodeURIComponent(rawToken)}`;

    try {
      await deliverEmail(
        {
          to: email,
          subject: `You're invited to ${context.organization.name} on Ticketloom`,
          text: `You have been invited to join ${context.organization.name} as ${input.role}.\nAccept: ${inviteUrl}\nThis invitation expires in 7 days.`,
          html: `<p>You have been invited to join <strong>${context.organization.name}</strong> as <strong>${input.role}</strong>.</p><p><a href="${inviteUrl}">Accept invitation</a></p><p>This invitation expires in 7 days.</p>`,
        },
        {
          purpose: "invitation",
          dedupeKey: invitation.id,
        },
      );
    } catch (error) {
      if (error instanceof QueueUnavailableError) {
        throw new OrganizationServiceError(
          "Invitation saved but email could not be queued. Configure Redis/worker and retry.",
          "VALIDATION",
        );
      }
      throw error;
    }

    await enqueueInvitationExpiry({
      invitationId: invitation.id,
      organizationId: context.organization.id,
      expiresAt,
    });

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      status: invitation.status,
    };
  },

  async listInvitations(userId: string) {
    const context = await requireOrganizationContext(userId);
    requirePermission(context.role, "members.read");
    await invitationRepository.expireOverdue(context.organization.id);
    return invitationRepository.listForOrganization(context.organization.id);
  },

  async updateMemberRole(userId: string, input: UpdateMemberRoleInput) {
    const context = await requireOrganizationContext(userId);
    requirePermission(context.role, "members.update");

    const membership = await organizationRepository.findMembershipById(input.membershipId);
    if (!membership || membership.organizationId !== context.organization.id) {
      throw new OrganizationServiceError("Member not found.", "NOT_FOUND");
    }

    if (membership.role === "OWNER" && input.role !== "OWNER") {
      const owners = await organizationRepository.countOwners(context.organization.id);
      if (owners <= 1) {
        throw new OrganizationServiceError(
          "You cannot demote the last owner.",
          "LAST_OWNER",
        );
      }
    }

    // Only OWNER may grant OWNER. ADMIN cannot self-promote or crown others.
    if (input.role === "OWNER" && context.role !== "OWNER") {
      throw new OrganizationServiceError(
        "Only an owner can assign the owner role.",
        "FORBIDDEN",
      );
    }

    if (membership.userId === userId && membership.role === "OWNER" && input.role !== "OWNER") {
      const owners = await organizationRepository.countOwners(context.organization.id);
      if (owners <= 1) {
        throw new OrganizationServiceError(
          "You cannot demote yourself as the last owner.",
          "LAST_OWNER",
        );
      }
    }

    const updated = await organizationRepository.updateMembership(membership.id, {
      role: input.role,
    });

    return {
      id: updated.id,
      role: updated.role,
      status: updated.status,
    };
  },

  async removeMember(userId: string, input: RemoveMemberInput) {
    const context = await requireOrganizationContext(userId);
    requirePermission(context.role, "members.remove");

    const membership = await organizationRepository.findMembershipById(input.membershipId);
    if (!membership || membership.organizationId !== context.organization.id) {
      throw new OrganizationServiceError("Member not found.", "NOT_FOUND");
    }

    if (membership.role === "OWNER") {
      const owners = await organizationRepository.countOwners(context.organization.id);
      if (owners <= 1) {
        throw new OrganizationServiceError(
          "You cannot remove the last owner.",
          "LAST_OWNER",
        );
      }
    }

    if (membership.userId === userId) {
      throw new OrganizationServiceError(
        "You cannot remove yourself. Ask another owner/admin.",
        "FORBIDDEN",
      );
    }

    await organizationRepository.deleteMembership(membership.id);

    if (membership.user.activeOrganizationId === context.organization.id) {
      const remaining = await organizationRepository.findActiveMembershipsForUser(
        membership.userId,
      );
      await userRepository.setActiveOrganization(
        membership.userId,
        remaining[0]?.organizationId ?? null,
      );
    }

    return { ok: true as const };
  },

  async getInvitationPreview(rawToken: string) {
    const invitation = await invitationRepository.findByTokenHash(hashToken(rawToken));
    if (!invitation) {
      throw new OrganizationServiceError("This invitation is invalid.", "INVALID_INVITE");
    }

    if (invitation.status === "ACCEPTED" || invitation.status === "REVOKED") {
      throw new OrganizationServiceError("This invitation is no longer valid.", "INVALID_INVITE");
    }

    if (invitation.expiresAt.getTime() < Date.now() || invitation.status === "EXPIRED") {
      if (invitation.status === "PENDING") {
        await invitationRepository.revoke(invitation.id).catch(() => undefined);
      }
      throw new OrganizationServiceError("This invitation has expired.", "EXPIRED_INVITE");
    }

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      organization: {
        id: invitation.organization.id,
        name: invitation.organization.name,
        slug: invitation.organization.slug,
      },
      invitedBy: invitation.invitedBy,
      expiresAt: invitation.expiresAt,
    };
  },

  async acceptInvitation(userId: string, rawToken: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AuthorizationError("Unauthenticated", "UNAUTHENTICATED");
    }

    const invitation = await invitationRepository.findByTokenHash(hashToken(rawToken));
    if (!invitation || invitation.status !== "PENDING") {
      throw new OrganizationServiceError("This invitation is invalid.", "INVALID_INVITE");
    }

    if (invitation.expiresAt.getTime() < Date.now()) {
      await invitationRepository.revoke(invitation.id).catch(() => undefined);
      throw new OrganizationServiceError("This invitation has expired.", "EXPIRED_INVITE");
    }

    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new OrganizationServiceError(
        "This invitation was sent to a different email address.",
        "FORBIDDEN",
      );
    }

    const existing = await organizationRepository.findMembership(
      userId,
      invitation.organizationId,
    );

    const membership =
      existing ??
      (await organizationRepository.createMembership({
        userId,
        organizationId: invitation.organizationId,
        role: invitation.role,
        status: "ACTIVE",
      }));

    if (existing && existing.status !== "ACTIVE") {
      await organizationRepository.updateMembership(existing.id, {
        status: "ACTIVE",
        role: invitation.role,
      });
    }

    await invitationRepository.markAccepted(invitation.id);
    await userRepository.setActiveOrganization(userId, invitation.organizationId);

    return {
      organization: toPublicOrg(invitation.organization, membership.role),
      membershipId: membership.id,
    };
  },

  async assertPermission(
    userId: string,
    organizationId: string,
    permission: Permission,
  ) {
    const context = await requireOrganizationMembership(userId, organizationId);
    requirePermission(context.role, permission);
    return context;
  },
};
