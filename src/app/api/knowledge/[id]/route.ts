import { NextResponse } from "next/server";

import {
  handleKnowledgeRouteError,
  knowledgeService,
  requireApiUser,
} from "@/controllers/knowledge-controller";
import { updateArticleSchema } from "@/lib/validations/knowledge";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const article = await knowledgeService.get(user.id, id);
    return NextResponse.json({ article });
  } catch (error) {
    return handleKnowledgeRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateArticleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const article = await knowledgeService.update(user.id, id, parsed.data);
    return NextResponse.json({ article });
  } catch (error) {
    return handleKnowledgeRouteError(error);
  }
}
