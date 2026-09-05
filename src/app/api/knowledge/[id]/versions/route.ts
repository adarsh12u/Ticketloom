import { NextResponse } from "next/server";

import {
  handleKnowledgeRouteError,
  knowledgeService,
  requireApiUser,
} from "@/controllers/knowledge-controller";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const result = await knowledgeService.listVersions(user.id, id);
    return NextResponse.json(result);
  } catch (error) {
    return handleKnowledgeRouteError(error);
  }
}
