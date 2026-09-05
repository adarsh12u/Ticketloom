import { NextResponse } from "next/server";

import { AuthorizationError, isAuthorizationError } from "@/lib/authz/errors";
import { getCurrentUser } from "@/lib/auth/session";
import { TicketServiceError, ticketService } from "@/services/ticket-service";

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

export function handleTicketRouteError(error: unknown) {
  if (isAuthorizationError(error)) {
    const status = error.code === "UNAUTHENTICATED" ? 401 : 403;
    return jsonError(error.message, status, error.code);
  }

  if (error instanceof TicketServiceError) {
    const statusMap: Record<TicketServiceError["code"], number> = {
      NOT_FOUND: 404,
      VALIDATION: 400,
      FORBIDDEN: 403,
      INVALID_ASSIGNEE: 400,
      INVALID_CUSTOMER: 400,
      INVALID_TEAM: 400,
      INVALID_TAG: 400,
    };
    return jsonError(error.message, statusMap[error.code] ?? 400, error.code);
  }

  console.error("[ticket-api]", error instanceof Error ? error.message : "unknown error");
  return jsonError("Unable to complete ticket request.", 500);
}

export { ticketService };
