import { cn } from "@/lib/utils";

type MetricCardProps = {
  title: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
};

export function MetricCard({ title, value, change, trend = "neutral", className }: MetricCardProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-4 shadow-sm", className)}>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        {change ? (
          <span
            className={cn(
              "text-xs font-medium",
              trend === "up" && "text-success",
              trend === "down" && "text-destructive",
              trend === "neutral" && "text-muted-foreground",
            )}
          >
            {change}
          </span>
        ) : null}
      </div>
    </div>
  );
}
