import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { TicketsListClient } from "@/components/tickets/tickets-list-client";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentOrganizationContext, hasPermission } from "@/lib/authz";
import { requireUser } from "@/lib/auth/session";
import { listTicketsSchema } from "@/lib/validations/ticket";
import { ticketService } from "@/services/ticket-service";

export const metadata: Metadata = { title: "Tickets" };

type TicketsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function TicketsContent({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requireUser("/tickets");
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") flat[key] = value;
    else if (Array.isArray(value) && value[0]) flat[key] = value[0];
  }

  const parsed = listTicketsSchema.safeParse(flat);
  if (!parsed.success) {
    redirect("/tickets");
  }

  const context = await getCurrentOrganizationContext(user.id);
  if (!context || !hasPermission(context.role, "tickets.read")) {
    redirect("/dashboard");
  }

  const [list, meta] = await Promise.all([
    ticketService.list(user.id, parsed.data),
    ticketService.getMeta(user.id),
  ]);

  return (
    <TicketsListClient
      items={list.items.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      }))}
      page={list.page}
      totalPages={list.totalPages}
      total={list.total}
      canCreate={hasPermission(context.role, "tickets.create")}
      agents={meta.agents}
      teams={meta.teams}
      tags={meta.tags}
    />
  );
}

export default async function TicketsPage({ searchParams }: TicketsPageProps) {
  const params = await searchParams;
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <TicketsContent searchParams={params} />
    </Suspense>
  );
}
