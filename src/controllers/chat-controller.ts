import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { AuthorizationError, isAuthorizationError } from "@/lib/authz/errors";
import { ChatServiceError, chatService } from "@/services/chat-service";

export { chatService };

export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthorizationError("Authentication required.", "UNAUTHENTICATED");
  }
  return user;
}

export function handleChatRouteError(error: unknown) {
  if (isAuthorizationError(error)) {
    const status =
      error.code === "UNAUTHENTICATED"
        ? 401
        : error.code === "MISSING_PERMISSION" || error.code === "FORBIDDEN"
          ? 403
          : 403;
    return NextResponse.json({ error: error.message }, { status });
  }

  if (error instanceof ChatServiceError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "RATE_LIMITED"
          ? 429
          : error.code === "FORBIDDEN" || error.code === "UNAUTHORIZED"
            ? 403
            : error.code === "CONFLICT"
              ? 409
              : 400;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }

  console.error("[chat-api]", error instanceof Error ? error.message : error);
  return NextResponse.json({ error: "Unexpected chat error." }, { status: 500 });
}
