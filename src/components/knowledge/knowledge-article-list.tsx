"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BarChart3, FolderTree, Plus, Search } from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  KNOWLEDGE_ARTICLE_STATUSES,
  KNOWLEDGE_VISIBILITIES,
} from "@/lib/validations/knowledge";

export type KnowledgeListItem = {
  id: string;
  title: string;
  excerpt: string | null;
  status: string;
  visibility: string;
  viewCount: number;
  helpfulCount: number;
  unhelpfulCount: number;
  publishedAt: string | null;
  updatedAt: string;
  category: { id: string; name: string } | null;
  tags: Array<{ id: string; name: string }>;
  author: { id: string; name: string | null; email: string } | null;
};

type CategoryOption = { id: string; name: string };
type TagOption = { id: string; name: string };

type KnowledgeArticleListProps = {
  items: KnowledgeListItem[];
  page: number;
  totalPages: number;
  total: number;
  canCreate: boolean;
  canManage: boolean;
  canAnalytics: boolean;
  categories: CategoryOption[];
  tags: TagOption[];
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

export function KnowledgeArticleList({
  items,
  page,
  totalPages,
  total,
  canCreate,
  canManage,
  canAnalytics,
  categories,
  tags,
}: KnowledgeArticleListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = React.useState(searchParams.get("q") ?? "");

  function updateParams(mutator: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutator(params);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function onSearch(event: React.FormEvent) {
    event.preventDefault();
    updateParams((params) => {
      if (q.trim()) params.set("q", q.trim());
      else params.delete("q");
      params.delete("page");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Knowledge Base</h1>
          <p className="text-sm text-muted-foreground">
            {total} article{total === 1 ? "" : "s"} in the active organization
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAnalytics ? (
            <Button asChild variant="outline" className="gap-2">
              <Link href="/knowledge/analytics">
                <BarChart3 className="h-4 w-4" />
                Analytics
              </Link>
            </Button>
          ) : null}
          {canManage ? (
            <Button asChild variant="outline" className="gap-2">
              <Link href="/knowledge/categories">
                <FolderTree className="h-4 w-4" />
                Categories
              </Link>
            </Button>
          ) : null}
          {canCreate ? (
            <Button asChild className="gap-2">
              <Link href="/knowledge/new">
                <Plus className="h-4 w-4" />
                New article
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="space-y-3 border-b p-3 sm:p-4">
          <form onSubmit={onSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Search title and content…"
                className="pl-8"
              />
            </div>
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={searchParams.get("status") ?? ""}
              onChange={(event) =>
                updateParams((params) => {
                  if (event.target.value) params.set("status", event.target.value);
                  else params.delete("status");
                  params.delete("page");
                })
              }
            >
              <option value="">All statuses</option>
              {KNOWLEDGE_ARTICLE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>

            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={searchParams.get("visibility") ?? ""}
              onChange={(event) =>
                updateParams((params) => {
                  if (event.target.value)
                    params.set("visibility", event.target.value);
                  else params.delete("visibility");
                  params.delete("page");
                })
              }
            >
              <option value="">All visibility</option>
              {KNOWLEDGE_VISIBILITIES.map((visibility) => (
                <option key={visibility} value={visibility}>
                  {visibility}
                </option>
              ))}
            </select>

            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={searchParams.get("categoryId") ?? ""}
              onChange={(event) =>
                updateParams((params) => {
                  if (event.target.value)
                    params.set("categoryId", event.target.value);
                  else params.delete("categoryId");
                  params.delete("page");
                })
              }
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={searchParams.get("tagId") ?? ""}
              onChange={(event) =>
                updateParams((params) => {
                  if (event.target.value) params.set("tagId", event.target.value);
                  else params.delete("tagId");
                  params.delete("page");
                })
              }
            >
              <option value="">All tags</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <ul className="divide-y">
          {items.length === 0 ? (
            <li className="p-8 text-center text-sm text-muted-foreground">
              No articles found.{" "}
              {canCreate ? (
                <Link
                  href="/knowledge/new"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Create one
                </Link>
              ) : null}
            </li>
          ) : (
            items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/knowledge/${item.id}`}
                  className="flex flex-col gap-2 p-4 transition-colors hover:bg-accent/30 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{item.title}</span>
                      <Badge variant={statusVariant(item.status)}>
                        {item.status.replaceAll("_", " ")}
                      </Badge>
                      <Badge variant="outline">{item.visibility}</Badge>
                    </div>
                    {item.excerpt ? (
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {item.excerpt}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {item.category ? <span>{item.category.name}</span> : null}
                      {item.author?.name || item.author?.email ? (
                        <span>by {item.author.name ?? item.author.email}</span>
                      ) : null}
                      <span>{item.viewCount} views</span>
                    </div>
                    {item.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {item.tags.map((tag) => (
                          <Badge key={tag.id} variant="secondary">
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground">
                    Updated {new Date(item.updatedAt).toLocaleDateString()}
                  </time>
                </Link>
              </li>
            ))
          )}
        </ul>

        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() =>
                  updateParams((params) => {
                    params.set("page", String(page - 1));
                  })
                }
              >
                Previous
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() =>
                  updateParams((params) => {
                    params.set("page", String(page + 1));
                  })
                }
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
