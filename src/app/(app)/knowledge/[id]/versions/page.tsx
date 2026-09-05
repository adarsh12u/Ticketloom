import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { KnowledgeVersionsClient } from "@/components/knowledge/knowledge-versions-client";
import { getCurrentOrganizationContext, hasPermission } from "@/lib/authz";
import { requireUser } from "@/lib/auth/session";
import { serializeKnowledge } from "@/lib/knowledge/serialize";
import {
  KnowledgeServiceError,
  knowledgeService,
} from "@/services/knowledge-service";

type VersionsPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: VersionsPageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Versions ${id}` };
}

export default async function KnowledgeVersionsPage({
  params,
}: VersionsPageProps) {
  const user = await requireUser();
  const { id } = await params;
  const context = await getCurrentOrganizationContext(user.id);
  if (!context || !hasPermission(context.role, "knowledge.read")) {
    redirect("/dashboard");
  }

  let article;
  let versions;
  try {
    [article, versions] = await Promise.all([
      knowledgeService.get(user.id, id, { recordView: false }),
      knowledgeService.listVersions(user.id, id),
    ]);
  } catch (error) {
    if (error instanceof KnowledgeServiceError && error.code === "NOT_FOUND") {
      notFound();
    }
    redirect("/knowledge");
  }

  if (!article) notFound();

  const canRestore =
    hasPermission(context.role, "knowledge.update") &&
    (hasPermission(context.role, "knowledge.publish") ||
      hasPermission(context.role, "knowledge.manage") ||
      article.authorId === user.id);

  const serializedVersions = serializeKnowledge(versions.items).map((version) => ({
    id: version.id,
    versionNumber: version.versionNumber,
    title: version.title,
    changeSummary: version.changeSummary,
    createdAt:
      typeof version.createdAt === "string"
        ? version.createdAt
        : version.createdAt.toISOString(),
    editor: version.editor
      ? {
          id: version.editor.id,
          name: version.editor.name,
          email: version.editor.email,
        }
      : null,
  }));

  return (
    <KnowledgeVersionsClient
      articleId={article.id}
      articleTitle={article.title}
      currentVersionId={versions.currentVersionId}
      publishedVersionId={versions.publishedVersionId}
      items={serializedVersions}
      canRestore={canRestore}
    />
  );
}
