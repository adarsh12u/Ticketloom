import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { AuthorizationError, isAuthorizationError } from "@/lib/authz/errors";
import {
  KnowledgeServiceError,
  knowledgeService,
} from "@/services/knowledge-service";

export { knowledgeService };

export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthorizationError("Authentication required.", "UNAUTHENTICATED");
  }
  return user;
}

export function handleKnowledgeRouteError(error: unknown) {
  if (isAuthorizationError(error)) {
    const status = error.code === "UNAUTHENTICATED" ? 401 : 403;
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status },
    );
  }

  if (error instanceof KnowledgeServiceError) {
    const statusMap: Record<KnowledgeServiceError["code"], number> = {
      NOT_FOUND: 404,
      VALIDATION: 400,
      FORBIDDEN: 403,
      CONFLICT: 409,
      INVALID_TRANSITION: 400,
      INVALID_CATEGORY: 400,
      INVALID_TAG: 400,
      INVALID_PARENT: 400,
    };
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: statusMap[error.code] ?? 400 },
    );
  }

  console.error(
    "[knowledge-api]",
    error instanceof Error ? error.message : error,
  );
  return NextResponse.json(
    { error: "Unexpected knowledge error." },
    { status: 500 },
  );
}
