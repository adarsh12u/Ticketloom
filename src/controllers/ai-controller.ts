import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { AuthorizationError, isAuthorizationError } from "@/lib/authz/errors";
import { AI_UNAVAILABLE } from "@/lib/ai/types";
import { AiServiceError, aiService } from "@/services/ai-service";

export { aiService };

export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthorizationError("Authentication required.", "UNAUTHENTICATED");
  }
  return user;
}

export function handleAiRouteError(error: unknown) {
  if (isAuthorizationError(error)) {
    const status = error.code === "UNAUTHENTICATED" ? 401 : 403;
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status },
    );
  }

  if (error instanceof AiServiceError) {
    const statusMap: Record<AiServiceError["code"], number> = {
      NOT_FOUND: 404,
      VALIDATION: 400,
      FORBIDDEN: 403,
      RATE_LIMITED: 429,
      [AI_UNAVAILABLE]: 503,
      FAILURE: 502,
    };
    return NextResponse.json(
      { error: error.message, code: error.code },
      {
        status: statusMap[error.code] ?? 400,
        ...(error.code === "RATE_LIMITED"
          ? { headers: { "Retry-After": "60" } }
          : {}),
      },
    );
  }

  console.error("[ai-api]", error instanceof Error ? error.message : error);
  return NextResponse.json({ error: "Unexpected AI error." }, { status: 500 });
}
