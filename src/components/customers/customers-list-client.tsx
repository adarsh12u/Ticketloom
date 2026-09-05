"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";

import {
  CustomerStatusBadge,
  customerInitials,
} from "@/components/customers/customer-badges";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CUSTOMER_STATUSES } from "@/lib/validations/customer";

export type CustomerListItem = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  image: string | null;
  status: string;
  lastActivityAt: string | Date;
  createdAt: string | Date;
  ticketCount: number;
  tags: Array<{ id: string; name: string }>;
};

type CustomersListClientProps = {
  items: CustomerListItem[];
  page: number;
  totalPages: number;
  total: number;
  canCreate: boolean;
  tags: Array<{ id: string; name: string }>;
};

export function CustomersListClient({
  items,
  page,
  totalPages,
  total,
  canCreate,
  tags,
}: CustomersListClientProps) {
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
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            {total} customer{total === 1 ? "" : "s"} in the active organization
          </p>
        </div>
        {canCreate ? (
          <Button asChild className="gap-2">
            <Link href="/customers/new">
              <Plus className="h-4 w-4" />
              New customer
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
                placeholder="Search name, email, phone, company…"
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
              {CUSTOMER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <Input
              className="h-9 w-40"
              placeholder="Company"
              defaultValue={searchParams.get("company") ?? ""}
              onBlur={(event) =>
                updateParams((params) => {
                  if (event.target.value.trim()) {
                    params.set("company", event.target.value.trim());
                  } else {
                    params.delete("company");
                  }
                  params.delete("page");
                })
              }
            />

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
              value={searchParams.get("sort") ?? "newest"}
              onChange={(event) =>
                updateParams((params) => {
                  params.set("sort", event.target.value);
                })
              }
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="recently_active">Recently active</option>
              <option value="alphabetical">Alphabetical</option>
            </select>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <p className="text-sm font-medium">No customers match these filters</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a customer profile or clear filters to continue.
            </p>
            {canCreate ? (
              <Button asChild className="mt-4">
                <Link href="/customers/new">Create customer</Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Tickets</th>
                  <th className="px-4 py-3 font-medium">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((customer) => (
                  <tr key={customer.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link href={`/customers/${customer.id}`} className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          {customer.image ? (
                            <AvatarImage src={customer.image} alt={customer.name} />
                          ) : null}
                          <AvatarFallback>{customerInitials(customer)}</AvatarFallback>
                        </Avatar>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{customer.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {customer.email}
                            {customer.phone ? ` · ${customer.phone}` : ""}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div>{customer.company ?? "—"}</div>
                      {customer.jobTitle ? (
                        <div className="text-xs">{customer.jobTitle}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <CustomerStatusBadge status={customer.status} />
                      {customer.tags.length ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {customer.tags.map((tag) => tag.name).join(", ")}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{customer.ticketCount}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(customer.lastActivityAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
