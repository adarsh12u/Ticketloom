"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type KnowledgeAnalyticsData = {
  totals: {
    articles: number;
    published: number;
    drafts: number;
    inReview: number;
    archived: number;
    views: number;
    searches: number;
    noResultSearches: number;
  };
  popular: Array<{
    id: string;
    title: string;
    viewCount: number;
    helpfulCount: number;
    unhelpfulCount: number;
  }>;
  poorFeedback: Array<{
    id: string;
    title: string;
    helpfulCount: number;
    unhelpfulCount: number;
  }>;
  recentlyUpdated: Array<{
    id: string;
    title: string;
    updatedAt: string;
    status: string;
  }>;
  topQueries: Array<{
    query: string;
    count: number;
  }>;
};

type KnowledgeAnalyticsDashboardProps = {
  data: KnowledgeAnalyticsData;
};

export function KnowledgeAnalyticsDashboard({
  data,
}: KnowledgeAnalyticsDashboardProps) {
  const { totals } = data;

  const statCards = [
    { label: "Articles", value: totals.articles },
    { label: "Published", value: totals.published },
    { label: "In review", value: totals.inReview },
    { label: "Drafts", value: totals.drafts },
    { label: "Views", value: totals.views },
    { label: "Searches", value: totals.searches },
  ];

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
            <BreadcrumbPage>Analytics</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Knowledge analytics
        </h1>
        <p className="text-sm text-muted-foreground">
          Usage, feedback, and search signals for the knowledge base.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Popular articles</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {data.popular.length === 0 ? (
                <li className="text-sm text-muted-foreground">No data yet.</li>
              ) : (
                data.popular.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3">
                    <Link
                      href={`/knowledge/${item.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {item.title}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {item.viewCount} views
                    </span>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {data.poorFeedback.length === 0 ? (
                <li className="text-sm text-muted-foreground">
                  No low-feedback articles.
                </li>
              ) : (
                data.poorFeedback.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3">
                    <Link
                      href={`/knowledge/${item.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {item.title}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {item.helpfulCount}/{item.unhelpfulCount}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recently updated</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {data.recentlyUpdated.length === 0 ? (
                <li className="text-sm text-muted-foreground">No updates yet.</li>
              ) : (
                data.recentlyUpdated.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/knowledge/${item.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {item.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="outline">{item.status}</Badge>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top search queries</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {data.topQueries.length === 0 ? (
                <li className="text-sm text-muted-foreground">No searches yet.</li>
              ) : (
                data.topQueries.map((item) => (
                  <li
                    key={item.query}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-sm">{item.query}</span>
                    <Badge variant="secondary">{item.count}</Badge>
                  </li>
                ))
              )}
            </ul>
            {totals.noResultSearches > 0 ? (
              <p className="mt-4 text-xs text-muted-foreground">
                {totals.noResultSearches} searches returned no results.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
