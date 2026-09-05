import { NextResponse } from "next/server";

import { AuthorizationError, isAuthorizationError } from "@/lib/authz/errors";
import { getCurrentUser } from "@/lib/auth/session";
import {
  CustomerServiceError,
  customerService,
} from "@/services/customer-service";

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

export function handleCustomerRouteError(error: unknown) {
  if (isAuthorizationError(error)) {
    const status = error.code === "UNAUTHENTICATED" ? 401 : 403;
    return jsonError(error.message, status, error.code);
  }

  if (error instanceof CustomerServiceError) {
    const statusMap: Record<CustomerServiceError["code"], number> = {
      NOT_FOUND: 404,
      VALIDATION: 400,
      DUPLICATE_EMAIL: 409,
      INVALID_TAG: 400,
      FORBIDDEN: 403,
    };
    return jsonError(error.message, statusMap[error.code] ?? 400, error.code);
  }

  console.error("[customer-api]", error instanceof Error ? error.message : "unknown");
  return jsonError("Unable to complete customer request.", 500);
}

export { customerService };
