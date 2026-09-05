import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NewCustomerForm } from "@/components/customers/new-customer-form";
import { getCurrentOrganizationContext, hasPermission } from "@/lib/authz";
import { requireUser } from "@/lib/auth/session";
import { customerService } from "@/services/customer-service";

export const metadata: Metadata = { title: "New customer" };

export default async function NewCustomerPage() {
  const user = await requireUser("/customers/new");
  const context = await getCurrentOrganizationContext(user.id);
  if (!context || !hasPermission(context.role, "customers.create")) {
    redirect("/customers");
  }

  const meta = await customerService.getMeta(user.id);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New customer</h1>
        <p className="text-sm text-muted-foreground">
          Create an organization-scoped customer profile for support and CRM workflows.
        </p>
      </div>
      <NewCustomerForm tags={meta.tags} />
    </div>
  );
}
