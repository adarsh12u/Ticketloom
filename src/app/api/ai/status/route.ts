import { NextResponse } from "next/server";

import {
  aiService,
  handleAiRouteError,
  requireApiUser,
} from "@/controllers/ai-controller";

export async function GET() {
  try {
    const user = await requireApiUser();
    const status = await aiService.getStatus(user.id);
    return NextResponse.json(status);
  } catch (error) {
    return handleAiRouteError(error);
  }
}
