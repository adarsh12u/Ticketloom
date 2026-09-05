import type { Membership, MembershipRole, Organization } from "@/generated/prisma/client";

import { AuthorizationError } from "@/lib/authz/errors";
import {
  type Permission,
  roleHasPermission,
} from "@/lib/authz/permissions";
import { organizationRepository } from "@/repositories/organization-repository";
import { userRepository } from "@/repositories/user-repository";

export type OrgMembershipContext = {
  userId: string;
  organization: Organization;
  membership: Membership;
  role: MembershipRole;
};

export async function getCurrentOrganizationContext(
  userId: string,
): Promise<OrgMembershipContext | null> {
  const user = await userRepository.findById(userId);
  if (!user) return null;

  const organizationId = user.activeOrganizationId;

  if (organizationId) {
    const membership = await organizationRepository.findActiveMembership(
      userId,
      organizationId,
    );
    if (membership) {
      return {
        userId,
        organization: membership.organization,
        membership,
        role: membership.role,
      };
    }
  }

  const memberships = await organizationRepository.findActiveMembershipsForUser(userId);
  const primary = memberships[0];
  if (!primary) return null;

  if (user.activeOrganizationId !== primary.organizationId) {
    await userRepository.setActiveOrganization(userId, primary.organizationId);
  }

  return {
    userId,
    organization: primary.organization,
    membership: primary,
    role: primary.role,
  };
}

export async function requireOrganizationContext(
  userId: string,
): Promise<OrgMembershipContext> {
  const context = await getCurrentOrganizationContext(userId);
  if (!context) {
    throw new AuthorizationError(
      "You are not a member of any organization.",
      "NOT_A_MEMBER",
    );
  }
  return context;
}

export async function requireOrganizationMembership(
  userId: string,
  organizationId: string,
): Promise<OrgMembershipContext> {
  const membership = await organizationRepository.findActiveMembership(
    userId,
    organizationId,
  );

  if (!membership) {
    throw new AuthorizationError(
      "You do not have access to this organization.",
      "NOT_A_MEMBER",
    );
  }

  return {
    userId,
    organization: membership.organization,
    membership,
    role: membership.role,
  };
}

export function hasPermission(role: MembershipRole, permission: Permission): boolean {
  return roleHasPermission(role, permission);
}

export function requirePermission(
  role: MembershipRole,
  permission: Permission,
): void {
  if (!hasPermission(role, permission)) {
    throw new AuthorizationError(
      "You do not have permission to perform this action.",
      "MISSING_PERMISSION",
    );
  }
}

export function requireOrganizationRole(
  role: MembershipRole,
  allowed: MembershipRole[],
): void {
  if (allowed.includes(role)) return;
  // Legacy M2 roles map onto ADMIN / VIEWER for role gates
  if (role === "MANAGER" && allowed.includes("ADMIN")) return;
  if (role === "CUSTOMER" && allowed.includes("VIEWER")) return;
  throw new AuthorizationError(
    "You do not have the required role for this action.",
    "FORBIDDEN",
  );
}

export async function switchActiveOrganization(
  userId: string,
  organizationId: string,
): Promise<OrgMembershipContext> {
  const context = await requireOrganizationMembership(userId, organizationId);
  await userRepository.setActiveOrganization(userId, organizationId);
  return context;
}
