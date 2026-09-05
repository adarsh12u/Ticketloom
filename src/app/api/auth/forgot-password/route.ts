import { NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/redis/rate-limit";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { AuthServiceError, authService } from "@/services/auth-service";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rate = await checkRateLimit(`forgot:${ip}`, 5, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  try {
    await authService.requestPasswordReset(parsed.data.email);
    return NextResponse.json({
      ok: true,
      message:
        "If an account exists for that email, password reset instructions have been sent.",
    });
  } catch (error) {
    if (error instanceof AuthServiceError && error.code === "EMAIL_UNCONFIGURED") {
      return NextResponse.json(
        {
          error: "Email service is not configured.",
          code: error.code,
        },
        { status: 503 },
      );
    }

    console.error("[forgot-password] unexpected error", error instanceof Error ? error.message : "unknown");
    // Still avoid enumeration
    return NextResponse.json({
      ok: true,
      message:
        "If an account exists for that email, password reset instructions have been sent.",
    });
  }
}
