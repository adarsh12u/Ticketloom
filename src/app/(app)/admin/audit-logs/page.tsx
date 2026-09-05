import type { Metadata } from "next";
import { ScrollText } from "lucide-react";

import { FeaturePlaceholder } from "@/components/shared/feature-placeholder";

export const metadata: Metadata = { title: "Audit Logs" };

export default function AuditLogsPage() {
  return (
    <FeaturePlaceholder
      title="Audit Logs"
      description="Track security and business events with tenant isolation."
      milestone="Milestone 3"
      icon={ScrollText}
    />
  );
}
