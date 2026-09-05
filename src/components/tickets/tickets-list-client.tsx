"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";

import {
  TicketPriorityBadge,
  TicketStatusBadge,
} from "@/components/tickets/ticket-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TICKET_PRIORITIES, TICKET_STATUSES } from "@/lib/validations/ticket";

export type TicketListItem = {
  id: string;
  numberKey: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string | Date;
  customer: { id: string; name: string; email: string } | null;
  assignee: { id: string; name: string | null; email: string } | null;
  team: { id: string; name: string } | null;
  tags: Array<{ id: string; name: string }>;
};

type TicketsListClientProps = {
  items: TicketListItem[];
  page: number;
  totalPages: number;
  total: number;
  canCreate: boolean;
  agents: Array<{ id: string; name: string | null; email: string }>;
  teams: Array<{ id: string; name: string }>;
  tags: Array<{ id: string; name: string }>;
};

function displayName(user: { name: string | null; email: string } | null) {
  if (!user) return "Unassigned";
  return user.name ?? user.email;
}

export function TicketsListClient({
  items,
  page,
  totalPages,
  total,
  canCreate,
  agents,
  teams,
  tags,
}: TicketsListClientProps) {
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
          <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
          <p className="text-sm text-muted-foreground">
            {total} ticket{total === 1 ? "" : "s"} in the active organization
          </p>
        </div>
        {canCreate ? (
          <Button asChild className="gap-2">
            <Link href="/tickets/new">
              <Plus className="h-4 w-4" />
              New ticket
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="space-y-3 border-b p-3 sm:p-4">
          <form onSubmit={onSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Search number, subject, customer…"
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
              {TICKET_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>

            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={searchParams.get("priority") ?? ""}
              onChange={(event) =>
                updateParams((params) => {
                  if (event.target.value) params.set("priority", event.target.value);
                  else params.delete("priority");
                  params.delete("page");
                })
              }
            >
              <option value="">All priorities</option>
              {TICKET_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>

            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={searchParams.get("assigneeId") ?? ""}
              onChange={(event) =>
                updateParams((params) => {
                  if (event.target.value) params.set("assigneeId", event.target.value);
                  else params.delete("assigneeId");
                  params.delete("page");
                })
              }
            >
              <option value="">All assignees</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name ?? agent.email}
                </option>
              ))}
            </select>

            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={searchParams.get("teamId") ?? ""}
              onChange={(event) =>
                updateParams((params) => {
                  if (event.target.value) params.set("teamId", event.target.value);
                  else params.delete("teamId");
                  params.delete("page");
                })
              }
            >
              <option value="">All teams</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
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

            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={`${searchParams.get("sortBy") ?? "createdAt"}:${searchParams.get("sortDir") ?? "desc"}`}
              onChange={(event) =>
                updateParams((params) => {
                  const [sortBy, sortDir] = event.target.value.split(":");
                  params.set("sortBy", sortBy);
                  params.set("sortDir", sortDir);
                })
              }
            >
              <option value="createdAt:desc">Newest</option>
              <option value="createdAt:asc">Oldest</option>
              <option value="updatedAt:desc">Recently updated</option>
              <option value="priority:desc">Priority high→low</option>
              <option value="number:desc">Number high→low</option>
            </select>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <p className="text-sm font-medium">No tickets match these filters</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a ticket or clear filters to see workspace activity.
            </p>
            {canCreate ? (
              <Button asChild className="mt-4">
                <Link href="/tickets/new">Create ticket</Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className="divide-y">
            {items.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/tickets/${ticket.id}`}
                  className="flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {ticket.numberKey}
                      </span>
                      <TicketStatusBadge status={ticket.status} />
                      <TicketPriorityBadge priority={ticket.priority} />
                    </div>
                    <p className="mt-1 truncate text-sm font-medium">{ticket.subject}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {ticket.customer?.name ?? "Unknown customer"} ·{" "}
                      {ticket.customer?.email ?? "—"}
                      {ticket.tags.length
                        ? ` · ${ticket.tags.map((tag) => tag.name).join(", ")}`
                        : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-left text-xs text-muted-foreground sm:text-right">
                    <p>{displayName(ticket.assignee)}</p>
                    <p className="mt-0.5">
                      {ticket.team?.name ? `${ticket.team.name} · ` : ""}
                      {new Date(ticket.createdAt).toLocaleString()}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
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
                variant="outline"
                size="sm"
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
