"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  History,
  Loader2,
  Pencil,
  RotateCcw,
  Send,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { KnowledgeFeedback } from "@/components/knowledge/knowledge-feedback";
import { KnowledgeMarkdown } from "@/components/knowledge/knowledge-markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export type KnowledgeArticleView = {
  id: string;
  title: string;
  excerpt: string | null;
  status: string;
  visibility: string;
  bodyHtml: string;
  bodyMarkdown: string;
  viewCount: number;
  helpfulCount: number;
  unhelpfulCount: number;
  publishedAt: string | null;
  updatedAt: string;
  category: { id: string; name: string } | null;
  tags: Array<{ id: string; name: string }>;
  author: { id: string; name: string | null; email: string } | null;
};

export type RelatedArticle = {
  id: string;
  title: string;
  excerpt: string | null;
};

type KnowledgeArticleDetailProps = {
  article: KnowledgeArticleView;
  related: RelatedArticle[];
  permissions: {
    canUpdate: boolean;
    canReview: boolean;
    canPublish: boolean;
    canArchive: boolean;
  };
  isAuthor: boolean;
};

function statusVariant(status: string) {
  switch (status) {
    case "PUBLISHED":
      return "success" as const;
    case "IN_REVIEW":
      return "warning" as const;
    case "ARCHIVED":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

export function KnowledgeArticleDetail({
  article,
  related,
  permissions,
  isAuthor,
}: KnowledgeArticleDetailProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = React.useState<string | null>(null);

  const canEdit =
    permissions.canUpdate &&
    (permissions.canPublish || isAuthor) &&
    article.status !== "ARCHIVED";

  async function runAction(
    action: string,
    path: string,
    body?: Record<string, unknown>,
  ) {
    setPendingAction(action);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? `Unable to ${action}.`);
      }
      toast.success(`Article ${action}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Unable to ${action}.`);
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/knowledge">Knowledge Base</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{article.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {article.title}
            </h1>
            <Badge variant={statusVariant(article.status)}>
              {article.status.replaceAll("_", " ")}
            </Badge>
            <Badge variant="outline">{article.visibility}</Badge>
          </div>
          {article.excerpt ? (
            <p className="max-w-2xl text-sm text-muted-foreground">
              {article.excerpt}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {article.category ? <span>{article.category.name}</span> : null}
            {article.author ? (
              <span>by {article.author.name ?? article.author.email}</span>
            ) : null}
            <span>{article.viewCount} views</span>
            <span>Updated {new Date(article.updatedAt).toLocaleString()}</span>
          </div>
          {article.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {article.tags.map((tag) => (
                <Badge key={tag.id} variant="secondary">
                  {tag.name}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <Button asChild variant="outline" className="gap-1.5">
              <Link href={`/knowledge/${article.id}/edit`}>
                <Pencil className="h-4 w-4" />
                Edit
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" className="gap-1.5">
            <Link href={`/knowledge/${article.id}/versions`}>
              <History className="h-4 w-4" />
              Versions
            </Link>
          </Button>
          {(permissions.canUpdate || permissions.canReview) &&
          article.status === "DRAFT" ? (
            <Button
              type="button"
              variant="secondary"
              className="gap-1.5"
              disabled={pendingAction !== null}
              onClick={() =>
                void runAction("submitted", `/api/knowledge/${article.id}/submit`)
              }
            >
              {pendingAction === "submitted" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Submit for review
            </Button>
          ) : null}
          {permissions.canPublish &&
          (article.status === "DRAFT" || article.status === "IN_REVIEW") ? (
            <Button
              type="button"
              className="gap-1.5"
              disabled={pendingAction !== null}
              onClick={() =>
                void runAction("published", `/api/knowledge/${article.id}/publish`)
              }
            >
              {pendingAction === "published" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Publish
            </Button>
          ) : null}
          {permissions.canArchive && article.status === "PUBLISHED" ? (
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              disabled={pendingAction !== null}
              onClick={() =>
                void runAction("archived", `/api/knowledge/${article.id}/archive`)
              }
            >
              {pendingAction === "archived" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Archive className="h-4 w-4" />
              )}
              Archive
            </Button>
          ) : null}
          {permissions.canArchive && article.status === "ARCHIVED" ? (
            <Button
              type="button"
              variant="secondary"
              className="gap-1.5"
              disabled={pendingAction !== null}
              onClick={() =>
                void runAction("restored", `/api/knowledge/${article.id}/restore`)
              }
            >
              {pendingAction === "restored" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Restore
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <KnowledgeMarkdown html={article.bodyHtml} />
        </div>
        <aside className="space-y-4">
          {article.status === "PUBLISHED" ? (
            <KnowledgeFeedback
              articleId={article.id}
              helpfulCount={article.helpfulCount}
              unhelpfulCount={article.unhelpfulCount}
            />
          ) : null}
          {related.length > 0 ? (
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm font-medium">Related articles</p>
              <ul className="mt-3 space-y-2">
                {related.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/knowledge/${item.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {item.title}
                    </Link>
                    {item.excerpt ? (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {item.excerpt}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
