import type { Metadata } from "next";
import { FileText } from "lucide-react";

import { FeaturePlaceholder } from "@/components/shared/feature-placeholder";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <FeaturePlaceholder
      title="Reports"
      description="Generate weekly and performance reports via background workers."
      milestone="Milestone 12"
      icon={FileText}
    />
  );
}
