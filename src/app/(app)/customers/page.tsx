import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { CustomersListClient } from "@/components/customers/customers-list-client";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentOrganizationContext, hasPermission } from "@/lib/authz";
import { requireUser } from "@/lib/auth/session";
import { listCustomersSchema } from "@/lib/validations/customer";
import { customerService } from "@/services/customer-service";

export const metadata: Metadata = { title: "Customers" };

type CustomersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function CustomersContent({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requireUser("/customers");
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") flat[key] = value;
    else if (Array.isArray(value) && value[0]) flat[key] = value[0];
  }

  const parsed = listCustomersSchema.safeParse(flat);
  if (!parsed.success) redirect("/customers");

  const context = await getCurrentOrganizationContext(user.id);
  if (!context || !hasPermission(context.role, "customers.read")) {
    redirect("/dashboard");
  }

  const [list, meta] = await Promise.all([
    customerService.list(user.id, parsed.data),
    customerService.getMeta(user.id),
  ]);

  return (
    <CustomersListClient
      items={list.items.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        lastActivityAt: item.lastActivityAt.toISOString(),
      }))}
      page={list.page}
      totalPages={list.totalPages}
      total={list.total}
      canCreate={hasPermission(context.role, "customers.create")}
      tags={meta.tags}
    />
  );
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
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
      <CustomersContent searchParams={params} />
    </Suspense>
  );
}
