import { NextResponse } from "next/server";

import {
  aiService,
  handleAiRouteError,
  requireApiUser,
} from "@/controllers/ai-controller";
import { suggestionEventBodySchema } from "@/lib/validations/ai";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const parsed = suggestionEventBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const result = await aiService.recordSuggestionEvent(user.id, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return handleAiRouteError(error);
  }
}
