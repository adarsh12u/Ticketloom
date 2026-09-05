import { NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/redis/rate-limit";
import { AuthServiceError, authService } from "@/services/auth-service";
import { z } from "zod";

const verifySchema = z.object({
  email: z.email(),
  token: z.string().min(1),
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rate = await checkRateLimit(`verify:${ip}`, 20, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid verification request." }, { status: 400 });
  }

  try {
    await authService.verifyEmail(parsed.data);
    return NextResponse.json({ ok: true, message: "Email verified successfully." });
  } catch (error) {
    if (error instanceof AuthServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to verify email." }, { status: 500 });
  }
}
