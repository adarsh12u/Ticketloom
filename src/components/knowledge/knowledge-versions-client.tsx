"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

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

export type KnowledgeVersionItem = {
  id: string;
  versionNumber: number;
  title: string;
  changeSummary: string | null;
  createdAt: string;
  editor: { id: string; name: string | null; email: string } | null;
};

type KnowledgeVersionsClientProps = {
  articleId: string;
  articleTitle: string;
  currentVersionId: string | null;
  publishedVersionId: string | null;
  items: KnowledgeVersionItem[];
  canRestore: boolean;
};

export function KnowledgeVersionsClient({
  articleId,
  articleTitle,
  currentVersionId,
  publishedVersionId,
  items,
  canRestore,
}: KnowledgeVersionsClientProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function restoreVersion(versionId: string) {
    setPendingId(versionId);
    try {
      const response = await fetch(`/api/knowledge/${articleId}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionId,
          changeSummary: "Restored from version history",
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to restore version.");
      }
      toast.success("Version restored as a new draft revision");
      router.push(`/knowledge/${articleId}`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to restore version.",
      );
    } finally {
      setPendingId(null);
    }
  }

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
              <Link href={`/knowledge/${articleId}`}>{articleTitle}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Versions</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Version history</h1>
        <p className="text-sm text-muted-foreground">
          Restore creates a new draft version from the selected snapshot.
        </p>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <ul className="divide-y">
          {items.length === 0 ? (
            <li className="p-8 text-center text-sm text-muted-foreground">
              No versions yet.
            </li>
          ) : (
            items.map((version) => (
              <li
                key={version.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      v{version.versionNumber}: {version.title}
                    </span>
                    {version.id === currentVersionId ? (
                      <Badge variant="default">Current</Badge>
                    ) : null}
                    {version.id === publishedVersionId ? (
                      <Badge variant="success">Published</Badge>
                    ) : null}
                  </div>
                  {version.changeSummary ? (
                    <p className="text-sm text-muted-foreground">
                      {version.changeSummary}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {new Date(version.createdAt).toLocaleString()}
                    {version.editor
                      ? ` · ${version.editor.name ?? version.editor.email}`
                      : ""}
                  </p>
                </div>
                {canRestore && version.id !== currentVersionId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={pendingId !== null}
                    onClick={() => void restoreVersion(version.id)}
                  >
                    {pendingId === version.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    Restore
                  </Button>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
