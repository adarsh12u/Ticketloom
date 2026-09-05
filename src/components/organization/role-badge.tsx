import { Badge } from "@/components/ui/badge";
import { roleBadgeVariant } from "@/components/layout/shell-types";
import { cn } from "@/lib/utils";

type RoleBadgeProps = {
  role: string;
  className?: string;
};

export function RoleBadge({ role, className }: RoleBadgeProps) {
  return (
    <Badge variant={roleBadgeVariant(role)} className={cn("font-medium", className)}>
      {role}
    </Badge>
  );
}
