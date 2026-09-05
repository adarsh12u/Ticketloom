import { Badge } from "@/components/ui/badge";

const statusVariant: Record<
  string,
  "default" | "secondary" | "outline" | "success" | "warning" | "destructive"
> = {
  ACTIVE: "success",
  INACTIVE: "secondary",
  PROSPECT: "warning",
  ARCHIVED: "outline",
};

export function CustomerStatusBadge({ status }: { status: string }) {
  return <Badge variant={statusVariant[status] ?? "outline"}>{status}</Badge>;
}

export function customerInitials(customer: {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
}) {
  if (customer.firstName || customer.lastName) {
    return `${customer.firstName?.[0] ?? ""}${customer.lastName?.[0] ?? ""}`.toUpperCase() || "C";
  }
  if (customer.name) {
    const parts = customer.name.trim().split(/\s+/);
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "C";
  }
  return customer.email.slice(0, 2).toUpperCase();
}
