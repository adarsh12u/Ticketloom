import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { KnowledgeCategoriesManager } from "@/components/knowledge/knowledge-categories-manager";
import { getCurrentOrganizationContext, hasPermission } from "@/lib/authz";
import { requireUser } from "@/lib/auth/session";
import { serializeKnowledge } from "@/lib/knowledge/serialize";
import { knowledgeService } from "@/services/knowledge-service";

export const metadata: Metadata = { title: "Knowledge categories" };

export default async function KnowledgeCategoriesPage() {
  const user = await requireUser("/knowledge/categories");
  const context = await getCurrentOrganizationContext(user.id);
  if (!context || !hasPermission(context.role, "knowledge.read")) {
    redirect("/dashboard");
  }
  if (!hasPermission(context.role, "knowledge.manage")) {
    redirect("/knowledge");
  }

  const categories = await knowledgeService.listCategories(user.id);
  const items = serializeKnowledge(categories.items).map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    parentCategoryId: item.parentCategoryId,
    sortOrder: item.sortOrder,
    status: item.status,
  }));

  return <KnowledgeCategoriesManager items={items} />;
}
