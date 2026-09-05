import { NextResponse } from "next/server";
import { AuthError } from "next-auth";

import { signIn } from "@/lib/auth";
import { checkRateLimit } from "@/lib/redis/rate-limit";
import { signupSchema } from "@/lib/validations/auth";
import { AuthServiceError, authService } from "@/services/auth-service";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rate = await checkRateLimit(`signup:${ip}`, 10, 60_000);
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

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const result = await authService.signup(parsed.data);

    try {
      await signIn("credentials", {
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json(
          {
            error: "Account created, but automatic sign-in failed. Please log in.",
            user: result.user,
          },
          { status: 201 },
        );
      }
      throw error;
    }

    return NextResponse.json(
      {
        ok: true,
        user: result.user,
        organization: result.organization,
        redirectTo: "/onboarding",
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AuthServiceError) {
      const status = error.code === "DUPLICATE_EMAIL" ? 409 : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }

    console.error("[signup] unexpected error", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Unable to create account." }, { status: 500 });
  }
}
