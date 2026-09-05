import { NextResponse } from "next/server";

import {
  handleKnowledgeRouteError,
  knowledgeService,
  requireApiUser,
} from "@/controllers/knowledge-controller";
import { submitArticleSchema } from "@/lib/validations/knowledge";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const parsed = submitArticleSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const article = await knowledgeService.submitForReview(
      user.id,
      id,
      parsed.data.note,
    );
    return NextResponse.json({ article });
  } catch (error) {
    return handleKnowledgeRouteError(error);
  }
}
