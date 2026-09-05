import { NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/redis/rate-limit";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { AuthServiceError, authService } from "@/services/auth-service";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rate = await checkRateLimit(`reset:${ip}`, 10, 60_000);
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

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reset request." }, { status: 400 });
  }

  try {
    await authService.resetPassword(parsed.data);
    return NextResponse.json({
      ok: true,
      message: "Password updated. You can sign in with your new password.",
    });
  } catch (error) {
    if (error instanceof AuthServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }

    console.error("[reset-password] unexpected error", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Unable to reset password." }, { status: 500 });
  }
}
