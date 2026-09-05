"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type KnowledgeSearchHit = {
  id: string;
  title: string;
  excerpt: string | null;
  status: string;
  visibility: string;
  category?: { id: string; name: string } | null;
  tags?: Array<{ id: string; name: string }>;
  rank?: number;
};

type KnowledgeSearchPanelProps = {
  query?: string;
  className?: string;
  onSelect?: (article: KnowledgeSearchHit) => void;
  /** When true, results link to /knowledge/[id]. Default true. */
  linkResults?: boolean;
  compact?: boolean;
};

export function KnowledgeSearchPanel({
  query: initialQuery = "",
  className,
  onSelect,
  linkResults = true,
  compact = false,
}: KnowledgeSearchPanelProps) {
  const [q, setQ] = React.useState(initialQuery);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<KnowledgeSearchHit[]>([]);
  const [searched, setSearched] = React.useState(false);

  React.useEffect(() => {
    if (!initialQuery.trim()) return;
    void runSearch(initialQuery.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once from prop
  }, []);

  async function runSearch(nextQ: string) {
    if (!nextQ) {
      setItems([]);
      setSearched(false);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q: nextQ, pageSize: "20" });
      const response = await fetch(`/api/knowledge/search?${params}`);
      const data = (await response.json()) as {
        error?: string;
        items?: KnowledgeSearchHit[];
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Search failed.");
      }
      setItems(data.items ?? []);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
      setItems([]);
      setSearched(true);
    } finally {
      setPending(false);
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    void runSearch(q.trim());
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <form onSubmit={onSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search knowledge base…"
            className="pl-8"
          />
        </div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </form>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {pending && !searched ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : null}

      <ScrollArea className={cn(compact ? "h-64" : "h-[28rem]")}>
        <ul className="space-y-2 pr-3">
          {items.map((item) => {
            const content = (
              <div className="rounded-md border bg-card p-3 transition-colors hover:bg-accent/40">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{item.title}</p>
                  <Badge variant="secondary" className="shrink-0">
                    {item.status}
                  </Badge>
                </div>
                {item.excerpt ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {item.excerpt}
                  </p>
                ) : null}
                {item.category ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.category.name}
                  </p>
                ) : null}
              </div>
            );

            if (onSelect) {
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => onSelect(item)}
                  >
                    {content}
                  </button>
                </li>
              );
            }

            if (linkResults) {
              return (
                <li key={item.id}>
                  <Link href={`/knowledge/${item.id}`}>{content}</Link>
                </li>
              );
            }

            return <li key={item.id}>{content}</li>;
          })}
        </ul>
        {searched && !pending && items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No articles matched your search.
          </p>
        ) : null}
      </ScrollArea>
    </div>
  );
}
