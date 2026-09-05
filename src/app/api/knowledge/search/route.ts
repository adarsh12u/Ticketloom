import { NextResponse } from "next/server";

import {
  handleKnowledgeRouteError,
  knowledgeService,
  requireApiUser,
} from "@/controllers/knowledge-controller";
import { checkRateLimit } from "@/lib/redis/rate-limit";
import { searchKnowledgeSchema } from "@/lib/validations/knowledge";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const url = new URL(request.url);
    const parsed = searchKnowledgeSchema.safeParse(
      Object.fromEntries(url.searchParams),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rate = await checkRateLimit(
      `search:knowledge:${user.id}:${ip}`,
      60,
      60_000,
    );
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many search requests. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds) },
        },
      );
    }

    const result = await knowledgeService.search(user.id, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return handleKnowledgeRouteError(error);
  }
}
