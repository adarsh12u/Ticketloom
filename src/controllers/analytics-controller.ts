import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { AuthorizationError, isAuthorizationError } from "@/lib/authz/errors";
import {
  AnalyticsServiceError,
  analyticsService,
} from "@/services/analytics-service";

export { analyticsService };

export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthorizationError("Authentication required.", "UNAUTHENTICATED");
  }
  return user;
}

export function handleAnalyticsRouteError(error: unknown) {
  if (isAuthorizationError(error)) {
    const status = error.code === "UNAUTHENTICATED" ? 401 : 403;
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status },
    );
  }

  if (error instanceof AnalyticsServiceError) {
    const statusMap: Record<AnalyticsServiceError["code"], number> = {
      VALIDATION: 400,
      FORBIDDEN: 403,
    };
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: statusMap[error.code] ?? 400 },
    );
  }

  console.error(
    "[analytics-api]",
    error instanceof Error ? error.message : error,
  );
  return NextResponse.json(
    { error: "Unexpected analytics error." },
    { status: 500 },
  );
}
