import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusVariant: Record<string, "default" | "secondary" | "outline" | "success" | "warning" | "destructive"> = {
  OPEN: "default",
  IN_PROGRESS: "secondary",
  WAITING_ON_CUSTOMER: "warning",
  RESOLVED: "success",
  CLOSED: "outline",
};

const priorityClass: Record<string, string> = {
  LOW: "border-transparent bg-muted text-muted-foreground",
  MEDIUM: "border-transparent bg-primary/10 text-primary",
  HIGH: "border-transparent bg-warning/20 text-warning-foreground",
  URGENT: "border-transparent bg-destructive/15 text-destructive",
};

export function TicketStatusBadge({ status }: { status: string }) {
  return <Badge variant={statusVariant[status] ?? "outline"}>{status.replaceAll("_", " ")}</Badge>;
}

export function TicketPriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        priorityClass[priority] ?? "bg-muted text-muted-foreground",
      )}
    >
      {priority}
    </span>
  );
}
