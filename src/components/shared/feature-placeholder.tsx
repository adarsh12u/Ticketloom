import type { LucideIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

type FeaturePlaceholderProps = {
  title: string;
  description: string;
  milestone: string;
  icon: LucideIcon;
};

export function FeaturePlaceholder({
  title,
  description,
  milestone,
  icon: Icon,
}: FeaturePlaceholderProps) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={<Icon className="h-5 w-5" />}
        title={`${title} arrives in ${milestone}`}
        description="This shell route keeps navigation intact for Milestone 1. Backend behavior will be implemented in the matching milestone — no fake data or fake actions."
      />
    </div>
  );
}
