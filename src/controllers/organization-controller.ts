import { NextResponse } from "next/server";

import { AuthorizationError, isAuthorizationError } from "@/lib/authz/errors";
import { getCurrentUser } from "@/lib/auth/session";
import {
  OrganizationServiceError,
  organizationService,
} from "@/services/organization-service";

export function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, ...(code ? { code } : {}) }, { status });
}

export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthorizationError("Authentication required.", "UNAUTHENTICATED");
  }
  return user;
}

export function handleOrganizationRouteError(error: unknown) {
  if (isAuthorizationError(error)) {
    const status =
      error.code === "UNAUTHENTICATED"
        ? 401
        : error.code === "MISSING_PERMISSION" || error.code === "FORBIDDEN"
          ? 403
          : error.code === "NOT_A_MEMBER"
            ? 403
            : 403;
    return jsonError(error.message, status, error.code);
  }

  if (error instanceof OrganizationServiceError) {
    const statusMap: Record<OrganizationServiceError["code"], number> = {
      SLUG_TAKEN: 409,
      VALIDATION: 400,
      NOT_FOUND: 404,
      DUPLICATE_MEMBER: 409,
      DUPLICATE_INVITE: 409,
      INVALID_INVITE: 400,
      EXPIRED_INVITE: 410,
      LAST_OWNER: 400,
      FORBIDDEN: 403,
    };
    return jsonError(error.message, statusMap[error.code] ?? 400, error.code);
  }

  console.error(
    "[organization-api]",
    error instanceof Error ? error.message : "unknown error",
  );
  return jsonError("Unable to complete organization request.", 500);
}

export { organizationService };
