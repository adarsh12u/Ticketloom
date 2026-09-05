import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

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
import { knowledgeService } from "@/services/knowledge-service";

export const metadata: Metadata = { title: "New article" };

export default async function NewKnowledgeArticlePage() {
  const user = await requireUser("/knowledge/new");
  const context = await getCurrentOrganizationContext(user.id);
  if (!context || !hasPermission(context.role, "knowledge.create")) {
    redirect("/knowledge");
  }
  if (!hasPermission(context.role, "knowledge.read")) {
    redirect("/dashboard");
  }

  const [categories, tags] = await Promise.all([
    knowledgeService.listCategories(user.id),
    knowledgeService.listTags(user.id),
  ]);

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
            <BreadcrumbPage>New article</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New article</h1>
        <p className="text-sm text-muted-foreground">
          Draft content for agents. Publish when ready for the organization.
        </p>
      </div>

      <KnowledgeArticleEditor
        mode="create"
        categories={categories.items.map((item) => ({
          id: item.id,
          name: item.name,
        }))}
        tags={tags.items.map((item) => ({ id: item.id, name: item.name }))}
      />
    </div>
  );
}
