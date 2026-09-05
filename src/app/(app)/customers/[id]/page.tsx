import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { CustomerDetailClient } from "@/components/customers/customer-detail-client";
import { getCurrentOrganizationContext, hasPermission } from "@/lib/authz";
import { requireUser } from "@/lib/auth/session";
import { CustomerServiceError, customerService } from "@/services/customer-service";

type CustomerPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: CustomerPageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Customer ${id}` };
}

export default async function CustomerDetailPage({ params }: CustomerPageProps) {
  const user = await requireUser();
  const { id } = await params;
  const context = await getCurrentOrganizationContext(user.id);
  if (!context || !hasPermission(context.role, "customers.read")) {
    redirect("/dashboard");
  }

  let customer;
  let meta;
  try {
    [customer, meta] = await Promise.all([
      customerService.get(user.id, id),
      customerService.getMeta(user.id),
    ]);
  } catch (error) {
    if (error instanceof CustomerServiceError && error.code === "NOT_FOUND") {
      notFound();
    }
    redirect("/customers");
  }

  return (
    <CustomerDetailClient
      key={`${customer.id}-${customer.updatedAt.toISOString()}-${customer.notes.length}`}
      customer={{
        ...customer,
        lastActivityAt: customer.lastActivityAt.toISOString(),
        archivedAt: customer.archivedAt?.toISOString() ?? null,
        createdAt: customer.createdAt.toISOString(),
        updatedAt: customer.updatedAt.toISOString(),
        notes: customer.notes.map((note) => ({
          ...note,
          createdAt: note.createdAt.toISOString(),
        })),
        activities: customer.activities.map((activity) => ({
          ...activity,
          createdAt: activity.createdAt.toISOString(),
        })),
        tickets: customer.tickets.map((ticket) => ({
          ...ticket,
          createdAt: ticket.createdAt.toISOString(),
        })),
      }}
      canUpdate={hasPermission(context.role, "customers.update")}
      canDelete={hasPermission(context.role, "customers.delete")}
      canCreateTicket={hasPermission(context.role, "tickets.create")}
      tags={meta.tags}
      organizationName={meta.organization.name}
    />
  );
}
