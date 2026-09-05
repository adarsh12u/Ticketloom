import { NextResponse } from "next/server";

import {
  handleKnowledgeRouteError,
  knowledgeService,
  requireApiUser,
} from "@/controllers/knowledge-controller";
import {
  restoreArticleSchema,
  restoreVersionSchema,
} from "@/lib/validations/knowledge";

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

    const asRecord =
      body && typeof body === "object" ? (body as Record<string, unknown>) : {};

    if (typeof asRecord.versionId === "string" && asRecord.versionId.length > 0) {
      const parsed = restoreVersionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: "Validation failed.",
            issues: parsed.error.flatten().fieldErrors,
          },
          { status: 400 },
        );
      }
      const article = await knowledgeService.restoreVersion(
        user.id,
        id,
        parsed.data.versionId,
        parsed.data.changeSummary,
      );
      return NextResponse.json({ article });
    }

    const parsed = restoreArticleSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const article = await knowledgeService.restore(user.id, id);
    return NextResponse.json({ article });
  } catch (error) {
    return handleKnowledgeRouteError(error);
  }
}
