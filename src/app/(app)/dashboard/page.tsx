import type { Metadata } from "next";
import Link from "next/link";

import {
  TicketPriorityBadge,
  TicketStatusBadge,
} from "@/components/tickets/ticket-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getCurrentOrganizationContext, hasPermission } from "@/lib/authz";
import { requireUser } from "@/lib/auth/session";
import { dashboardService } from "@/services/dashboard-service";
import { knowledgeService } from "@/services/knowledge-service";
import { ticketService } from "@/services/ticket-service";
import { BookOpen, Ticket } from "lucide-react";

export const metadata: Metadata = {
  title: "Overview",
};

export default async function DashboardPage() {
  const user = await requireUser();
  const firstName = user.firstName ?? user.name?.split(" ")[0] ?? "there";
  const context = await getCurrentOrganizationContext(user.id);

  let ticketStats = { total: 0, open: 0, urgent: 0, resolved: 0 };
  let customerStats = { total: 0, active: 0, prospects: 0 };
  let knowledgeStats = { articles: 0, published: 0, drafts: 0, inReview: 0 };
  let topArticle: { id: string; title: string } | null = null;
  let recentTickets: Awaited<ReturnType<typeof ticketService.list>>["items"] = [];

  if (context) {
    const summary = await dashboardService.getSummary(user.id);
    ticketStats = summary.tickets;
    customerStats = summary.customers;
  }

  if (context && hasPermission(context.role, "knowledge.read")) {
    try {
      const [kbSummary, popular] = await Promise.all([
        knowledgeService.getSummary(user.id),
        knowledgeService.getPopular(user.id),
      ]);
      knowledgeStats = {
        articles: kbSummary.articles ?? 0,
        published: kbSummary.published ?? 0,
        drafts: kbSummary.drafts ?? 0,
        inReview: kbSummary.inReview ?? 0,
      };
      const first = popular.items[0];
      if (first) topArticle = { id: first.id, title: first.title };
    } catch {
      // knowledge base may be empty / unavailable
    }
  }

  if (context && hasPermission(context.role, "tickets.read")) {
    const recent = await ticketService.list(user.id, {
      page: 1,
      pageSize: 5,
      includeArchived: false,
      sortBy: "createdAt",
      sortDir: "desc",
    });
    recentTickets = recent.items;
  }

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Live ticket, customer, and knowledge metrics for your active organization."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/knowledge">Knowledge</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/customers">Customers</Link>
            </Button>
            <Button asChild>
              <Link href="/tickets">View tickets</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Tickets" value={String(ticketStats.total)} />
        <MetricCard title="Open Tickets" value={String(ticketStats.open)} />
        <MetricCard title="Urgent Tickets" value={String(ticketStats.urgent)} />
        <MetricCard
          title="Customers"
          value={String(customerStats.total)}
          change={`${customerStats.active} active · ${customerStats.prospects} prospects`}
          trend="neutral"
        />
      </div>

      {context && hasPermission(context.role, "knowledge.read") ? (
        <section className="mt-4 rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Knowledge Base</h2>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/knowledge">Open library</Link>
            </Button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Articles</p>
              <p className="text-lg font-semibold">{knowledgeStats.articles}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Published</p>
              <p className="text-lg font-semibold">{knowledgeStats.published}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Drafts</p>
              <p className="text-lg font-semibold">{knowledgeStats.drafts}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Needs review</p>
              <p className="text-lg font-semibold">{knowledgeStats.inReview}</p>
            </div>
          </div>
          {topArticle ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Top article:{" "}
              <Link href={`/knowledge/${topArticle.id}`} className="font-medium text-foreground hover:underline">
                {topArticle.title}
              </Link>
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No published articles yet.{" "}
              <Link href="/knowledge/new" className="text-primary hover:underline">
                Create one
              </Link>
            </p>
          )}
        </section>
      ) : null}

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-lg border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Recent tickets</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/tickets">Open list</Link>
            </Button>
          </div>
          {recentTickets.length === 0 ? (
            <div className="px-4 py-10">
              <EmptyState
                icon={<Ticket className="h-5 w-5" />}
                title="No tickets yet"
                description="Create a ticket to start tracking support work for this organization."
              />
            </div>
          ) : (
            <div className="divide-y">
              {recentTickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/tickets/${ticket.id}`}
                  className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-primary">{ticket.numberKey}</span>
                      <TicketStatusBadge status={ticket.status} />
                    </div>
                    <p className="mt-0.5 truncate text-sm text-foreground">{ticket.subject}</p>
                  </div>
                  <TicketPriorityBadge priority={ticket.priority} />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Customer snapshot</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/customers">Open CRM</Link>
            </Button>
          </div>
          <ul className="divide-y text-sm">
            <li className="flex items-center justify-between px-4 py-3">
              <span className="text-muted-foreground">Active customers</span>
              <span className="font-medium">{customerStats.active}</span>
            </li>
            <li className="flex items-center justify-between px-4 py-3">
              <span className="text-muted-foreground">Prospects</span>
              <span className="font-medium">{customerStats.prospects}</span>
            </li>
            <li className="flex items-center justify-between px-4 py-3">
              <span className="text-muted-foreground">Resolved tickets</span>
              <span className="font-medium">{ticketStats.resolved}</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
