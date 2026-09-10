import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { KnowledgeArticleList } from "@/components/knowledge/knowledge-article-list";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentOrganizationContext, hasPermission } from "@/lib/authz";
import { requireUser } from "@/lib/auth/session";
import { listArticlesSchema } from "@/lib/validations/knowledge";
import { knowledgeService } from "@/services/knowledge-service";

export const metadata: Metadata = { title: "Knowledge Base" };

type KnowledgePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function KnowledgeContent({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requireUser("/knowledge");
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") flat[key] = value;
    else if (Array.isArray(value) && value[0]) flat[key] = value[0];
  }

  const parsed = listArticlesSchema.safeParse(flat);
  if (!parsed.success) redirect("/knowledge");

  const context = await getCurrentOrganizationContext(user.id);
  if (!context || !hasPermission(context.role, "knowledge.read")) {
    redirect("/dashboard");
  }

  // Create default KB once before parallel reads (avoids first-visit create races).
  await knowledgeService.ensureKnowledgeBase(user.id);

  const [list, categories, tags] = await Promise.all([
    knowledgeService.list(user.id, parsed.data),
    knowledgeService.listCategories(user.id),
    knowledgeService.listTags(user.id),
  ]);

  const items = list.items.map((item) => ({
    id: item.id,
    title: item.title,
    excerpt: item.excerpt,
    status: item.status,
    visibility: item.visibility,
    viewCount: item.viewCount,
    helpfulCount: item.helpfulCount,
    unhelpfulCount: item.unhelpfulCount,
    publishedAt: item.publishedAt?.toISOString() ?? null,
    updatedAt: item.updatedAt.toISOString(),
    category: item.category
      ? { id: item.category.id, name: item.category.name }
      : null,
    tags: item.tags.map((tag) => ({ id: tag.id, name: tag.name })),
    author: item.author
      ? {
          id: item.author.id,
          name: item.author.name,
          email: item.author.email,
        }
      : null,
  }));

  return (
    <KnowledgeArticleList
      items={items}
      page={list.page}
      totalPages={list.totalPages}
      total={list.total}
      canCreate={hasPermission(context.role, "knowledge.create")}
      canManage={hasPermission(context.role, "knowledge.manage")}
      canAnalytics={
        hasPermission(context.role, "knowledge.manage") ||
        hasPermission(context.role, "analytics.read")
      }
      categories={categories.items.map((item) => ({
        id: item.id,
        name: item.name,
      }))}
      tags={tags.items.map((item) => ({ id: item.id, name: item.name }))}
    />
  );
}

export default async function KnowledgePage({ searchParams }: KnowledgePageProps) {
  const params = await searchParams;
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <KnowledgeContent searchParams={params} />
    </Suspense>
  );
}
