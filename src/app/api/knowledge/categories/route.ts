import { NextResponse } from "next/server";

import {
  handleKnowledgeRouteError,
  knowledgeService,
  requireApiUser,
} from "@/controllers/knowledge-controller";
import { createCategorySchema } from "@/lib/validations/knowledge";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const url = new URL(request.url);
    const knowledgeBaseId = url.searchParams.get("knowledgeBaseId") ?? undefined;
    const result = await knowledgeService.listCategories(user.id, knowledgeBaseId);
    return NextResponse.json(result);
  } catch (error) {
    return handleKnowledgeRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const parsed = createCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const category = await knowledgeService.createCategory(user.id, parsed.data);
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    return handleKnowledgeRouteError(error);
  }
}
