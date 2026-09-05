import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { KnowledgeArticleEditor } from "@/components/knowledge/knowledge-article-editor";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getCurrentOrganizationContext, hasPermission } from "@/lib/authz";
import { requireUser } from "@/lib/auth/session";
import { serializeKnowledge } from "@/lib/knowledge/serialize";
import {
  KnowledgeServiceError,
  knowledgeService,
} from "@/services/knowledge-service";

type EditKnowledgePageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: EditKnowledgePageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Edit article ${id}` };
}

export default async function EditKnowledgeArticlePage({
  params,
}: EditKnowledgePageProps) {
  const user = await requireUser();
  const { id } = await params;
  const context = await getCurrentOrganizationContext(user.id);
  if (!context || !hasPermission(context.role, "knowledge.read")) {
    redirect("/dashboard");
  }
  if (!hasPermission(context.role, "knowledge.update")) {
    redirect(`/knowledge/${id}`);
  }

  let article;
  try {
    article = await knowledgeService.get(user.id, id, { recordView: false });
  } catch (error) {
    if (error instanceof KnowledgeServiceError && error.code === "NOT_FOUND") {
      notFound();
    }
    redirect("/knowledge");
  }

  if (!article) notFound();

  const canPublish =
    hasPermission(context.role, "knowledge.publish") ||
    hasPermission(context.role, "knowledge.manage");
  if (!canPublish && article.authorId !== user.id) {
    redirect(`/knowledge/${id}`);
  }
  if (article.status === "ARCHIVED") {
    redirect(`/knowledge/${id}`);
  }

  const [categories, tags] = await Promise.all([
    knowledgeService.listCategories(user.id),
    knowledgeService.listTags(user.id),
  ]);

  const serialized = serializeKnowledge(article);

  return (
    <div className="space-y-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/knowledge">Knowledge Base</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/knowledge/${id}`}>{serialized.title}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Edit</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit article</h1>
        <p className="text-sm text-muted-foreground">
          Updates create a new draft version of this article.
        </p>
      </div>

      <KnowledgeArticleEditor
        mode="edit"
        categories={categories.items.map((item) => ({
          id: item.id,
          name: item.name,
        }))}
        tags={tags.items.map((item) => ({ id: item.id, name: item.name }))}
        article={{
          id: serialized.id,
          title: serialized.title,
          excerpt: serialized.excerpt,
          bodyMarkdown: serialized.bodyMarkdown,
          categoryId: serialized.categoryId,
          visibility: serialized.visibility,
          tags: serialized.tags.map((tag) => ({ id: tag.id, name: tag.name })),
        }}
      />
    </div>
  );
}
