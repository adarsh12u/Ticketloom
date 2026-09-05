import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { TicketDetailClient } from "@/components/tickets/ticket-detail-client";
import { getCurrentOrganizationContext, hasPermission } from "@/lib/authz";
import { requireUser } from "@/lib/auth/session";
import { TicketServiceError, ticketService } from "@/services/ticket-service";

type TicketPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: TicketPageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Ticket ${id}` };
}

export default async function TicketDetailPage({ params }: TicketPageProps) {
  const user = await requireUser();
  const { id } = await params;
  const context = await getCurrentOrganizationContext(user.id);
  if (!context || !hasPermission(context.role, "tickets.read")) {
    redirect("/dashboard");
  }

  let ticket;
  let meta;
  try {
    [ticket, meta] = await Promise.all([
      ticketService.get(user.id, id),
      ticketService.getMeta(user.id),
    ]);
  } catch (error) {
    if (error instanceof TicketServiceError && error.code === "NOT_FOUND") {
      notFound();
    }
    redirect("/tickets");
  }

  if (!ticket) notFound();

  return (
    <TicketDetailClient
      key={`${ticket.id}-${ticket.updatedAt.toISOString()}`}
      ticket={{
        ...ticket,
        dueAt: ticket.dueAt?.toISOString() ?? null,
        firstResponseDueAt: ticket.firstResponseDueAt?.toISOString() ?? null,
        resolutionDueAt: ticket.resolutionDueAt?.toISOString() ?? null,
        resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
        closedAt: ticket.closedAt?.toISOString() ?? null,
        archivedAt: ticket.archivedAt?.toISOString() ?? null,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
        messages: ticket.messages.map((message) => ({
          ...message,
          createdAt: message.createdAt.toISOString(),
        })),
        activities: ticket.activities.map((activity) => ({
          ...activity,
          createdAt: activity.createdAt.toISOString(),
        })),
      }}
      canUpdate={hasPermission(context.role, "tickets.update")}
      canAssign={hasPermission(context.role, "tickets.assign")}
      canDelete={hasPermission(context.role, "tickets.delete")}
      canUseAi={hasPermission(context.role, "ai.use")}
      agents={meta.agents}
      teams={meta.teams}
      tags={meta.tags}
    />
  );
}
