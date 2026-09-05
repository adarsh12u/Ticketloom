import type { IncomingMessage } from "node:http";

import { getToken } from "next-auth/jwt";

import {
  getCurrentOrganizationContext,
  requireOrganizationMembership,
} from "@/lib/authz";
import { roleHasPermission, type Permission } from "@/lib/authz/permissions";
import { userRepository } from "@/repositories/user-repository";

export type SocketAuthContext = {
  userId: string;
  email: string;
  organizationId: string;
  role: string;
};

function cookieName() {
  return process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
}

/**
 * Resolve authenticated user from Auth.js JWT cookie or handshake auth.token.
 * Never trust client-provided userId / organizationId / role.
 */
export async function authenticateSocketHandshake(
  handshake: {
    headers: IncomingMessage["headers"];
    auth?: Record<string, unknown>;
  },
): Promise<SocketAuthContext> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is required for socket authentication.");
  }

  const tokenFromAuth =
    typeof handshake.auth?.token === "string" ? handshake.auth.token : undefined;

  const token = await getToken({
    req: {
      headers: {
        cookie: handshake.headers.cookie ?? "",
        authorization: tokenFromAuth ? `Bearer ${tokenFromAuth}` : undefined,
      },
    } as never,
    secret,
    secureCookie: process.env.NODE_ENV === "production",
    cookieName: cookieName(),
    raw: false,
  });

  // Fallback: raw session JWT passed explicitly (tests / non-browser clients)
  let userId = token?.sub;
  if (!userId && tokenFromAuth) {
    const decoded = await getToken({
      req: { headers: { cookie: `${cookieName()}=${tokenFromAuth}` } } as never,
      secret,
      secureCookie: process.env.NODE_ENV === "production",
      cookieName: cookieName(),
    });
    userId = decoded?.sub;
  }

  if (!userId) {
    const err = new Error("UNAUTHENTICATED");
    err.name = "SocketAuthError";
    throw err;
  }

  const user = await userRepository.findSafeById(userId);
  if (!user) {
    const err = new Error("UNAUTHENTICATED");
    err.name = "SocketAuthError";
    throw err;
  }

  const context = await getCurrentOrganizationContext(user.id);
  if (!context) {
    const err = new Error("UNAUTHORIZED");
    err.name = "SocketAuthError";
    throw err;
  }

  return {
    userId: user.id,
    email: user.email,
    organizationId: context.organization.id,
    role: context.role,
  };
}

export async function assertSocketPermission(
  auth: SocketAuthContext,
  permission: Permission,
) {
  if (!roleHasPermission(auth.role as never, permission)) {
    const err = new Error("UNAUTHORIZED");
    err.name = "SocketAuthError";
    throw err;
  }
}

export async function assertOrgMembership(userId: string, organizationId: string) {
  return requireOrganizationMembership(userId, organizationId);
}
