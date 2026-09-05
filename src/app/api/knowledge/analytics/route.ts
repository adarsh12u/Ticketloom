import { NextResponse } from "next/server";

import {
  handleKnowledgeRouteError,
  knowledgeService,
  requireApiUser,
} from "@/controllers/knowledge-controller";

export async function GET() {
  try {
    const user = await requireApiUser();
    const analytics = await knowledgeService.getAnalytics(user.id);
    return NextResponse.json(analytics);
  } catch (error) {
    return handleKnowledgeRouteError(error);
  }
}
