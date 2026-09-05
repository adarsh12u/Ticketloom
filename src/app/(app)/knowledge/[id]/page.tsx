import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { KnowledgeArticleDetail } from "@/components/knowledge/knowledge-article-detail";
import { getCurrentOrganizationContext, hasPermission } from "@/lib/authz";
import { requireUser } from "@/lib/auth/session";
import { renderSafeMarkdown } from "@/lib/knowledge/markdown";
import {
  KnowledgeServiceError,
  knowledgeService,
} from "@/services/knowledge-service";

type KnowledgeArticlePageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: KnowledgeArticlePageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Article ${id}` };
}

export default async function KnowledgeArticlePage({
  params,
}: KnowledgeArticlePageProps) {
  const user = await requireUser();
  const { id } = await params;
  const context = await getCurrentOrganizationContext(user.id);
  if (!context || !hasPermission(context.role, "knowledge.read")) {
    redirect("/dashboard");
  }

  let article;
  try {
    article = await knowledgeService.get(user.id, id);
  } catch (error) {
    if (error instanceof KnowledgeServiceError && error.code === "NOT_FOUND") {
      notFound();
    }
    redirect("/knowledge");
  }

  if (!article) notFound();

  const relatedResult = article.categoryId
    ? await knowledgeService.list(user.id, {
        page: 1,
        pageSize: 6,
        categoryId: article.categoryId,
        status: "PUBLISHED",
      })
    : { items: [] as Awaited<ReturnType<typeof knowledgeService.list>>["items"] };

  const related = relatedResult.items
    .filter((item) => item.id !== article.id)
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      title: item.title,
      excerpt: item.excerpt,
    }));

  const bodyHtml =
    article.bodyHtml ?? renderSafeMarkdown(article.bodyMarkdown ?? "");

  return (
    <KnowledgeArticleDetail
      article={{
        id: article.id,
        title: article.title,
        excerpt: article.excerpt,
        status: article.status,
        visibility: article.visibility,
        bodyHtml,
        bodyMarkdown: article.bodyMarkdown,
        viewCount: article.viewCount,
        helpfulCount: article.helpfulCount,
        unhelpfulCount: article.unhelpfulCount,
        publishedAt: article.publishedAt?.toISOString() ?? null,
        updatedAt: article.updatedAt.toISOString(),
        category: article.category
          ? { id: article.category.id, name: article.category.name }
          : null,
        tags: article.tags.map((tag) => ({ id: tag.id, name: tag.name })),
        author: article.author
          ? {
              id: article.author.id,
              name: article.author.name,
              email: article.author.email,
            }
          : null,
      }}
      related={related}
      permissions={{
        canUpdate: hasPermission(context.role, "knowledge.update"),
        canReview: hasPermission(context.role, "knowledge.review"),
        canPublish: hasPermission(context.role, "knowledge.publish"),
        canArchive: hasPermission(context.role, "knowledge.archive"),
      }}
      isAuthor={article.authorId === user.id}
    />
  );
}
