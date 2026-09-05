import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import {
  getCurrentOrganizationContext,
  requireOrganizationMembership as requireMembershipAuthz,
} from "@/lib/authz";
import { userRepository } from "@/repositories/user-repository";

export type AppSessionUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  firstName: string | null;
  lastName: string | null;
};

export type ActiveOrganization = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

/**
 * Server-side session source of truth.
 * Never trust client-provided userId / organizationId for authorization.
 */
export const getSession = cache(async () => {
  return auth();
});

export const getCurrentUser = cache(async (): Promise<AppSessionUser | null> => {
  const session = await getSession();
  if (!session?.user?.id) {
    return null;
  }

  const user = await userRepository.findSafeById(session.user.id);
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    firstName: user.firstName,
    lastName: user.lastName,
  };
});

export async function requireUser(callbackUrl = "/dashboard"): Promise<AppSessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  return user;
}

/**
 * Active organization is resolved from authenticated membership + User.activeOrganizationId.
 * Never accept organizationId from the client without membership verification.
 */
export const getActiveOrganization = cache(
  async (userId: string): Promise<ActiveOrganization | null> => {
    const context = await getCurrentOrganizationContext(userId);
    if (!context) return null;

    return {
      id: context.organization.id,
      name: context.organization.name,
      slug: context.organization.slug,
      role: context.role,
    };
  },
);

/**
 * Tenant isolation: organization context must come from authenticated membership.
 */
export async function requireOrganizationMembership(
  userId: string,
  organizationId: string,
) {
  return requireMembershipAuthz(userId, organizationId);
}
