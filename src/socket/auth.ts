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

/**
 * Auth.js uses `__Secure-` cookies only when the app URL is HTTPS.
 * Docker local runs NODE_ENV=production on http://localhost — cookie must match AUTH_URL,
 * not NODE_ENV alone (mismatch → socket Offline / composer disabled).
 */
function useSecureAuthCookies() {
  const url = process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  if (url.startsWith("https://")) return true;
  if (url.startsWith("http://")) return false;
  return process.env.NODE_ENV === "production";
}

function cookieName(secure = useSecureAuthCookies()) {
  return secure ? "__Secure-authjs.session-token" : "authjs.session-token";
}

async function readSessionToken(options: {
  cookieHeader: string;
  secret: string;
  tokenFromAuth?: string;
}) {
  const secure = useSecureAuthCookies();
  const names = secure
    ? [cookieName(true), cookieName(false)]
    : [cookieName(false), cookieName(true)];

  for (const name of names) {
    const token = await getToken({
      req: {
        headers: {
          cookie: options.cookieHeader,
          authorization: options.tokenFromAuth
            ? `Bearer ${options.tokenFromAuth}`
            : undefined,
        },
      } as never,
      secret: options.secret,
      secureCookie: name.startsWith("__Secure-"),
      cookieName: name,
      raw: false,
    });
    if (token?.sub) return token;
  }
  return null;
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

  const token = await readSessionToken({
    cookieHeader: handshake.headers.cookie ?? "",
    secret,
    tokenFromAuth,
  });

  // Fallback: raw session JWT passed explicitly (tests / non-browser clients)
  let userId = token?.sub;
  if (!userId && tokenFromAuth) {
    const secure = useSecureAuthCookies();
    const name = cookieName(secure);
    const decoded = await getToken({
      req: { headers: { cookie: `${name}=${tokenFromAuth}` } } as never,
      secret,
      secureCookie: secure,
      cookieName: name,
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
