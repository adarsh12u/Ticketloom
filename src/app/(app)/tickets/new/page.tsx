import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NewTicketForm } from "@/components/tickets/new-ticket-form";
import { getCurrentOrganizationContext, hasPermission } from "@/lib/authz";
import { requireUser } from "@/lib/auth/session";
import { ticketService } from "@/services/ticket-service";

export const metadata: Metadata = { title: "New ticket" };

type NewTicketPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewTicketPage({ searchParams }: NewTicketPageProps) {
  const user = await requireUser("/tickets/new");
  const context = await getCurrentOrganizationContext(user.id);
  if (!context || !hasPermission(context.role, "tickets.create")) {
    redirect("/tickets");
  }

  const params = await searchParams;
  const customerId =
    typeof params.customerId === "string"
      ? params.customerId
      : Array.isArray(params.customerId)
        ? params.customerId[0]
        : undefined;

  const meta = await ticketService.getMeta(user.id);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New ticket</h1>
        <p className="text-sm text-muted-foreground">
          Create an organization-scoped support ticket with customer and routing details.
        </p>
      </div>
      <NewTicketForm
        meta={meta}
        canAssign={hasPermission(context.role, "tickets.assign")}
        initialCustomerId={customerId}
      />
    </div>
  );
}
