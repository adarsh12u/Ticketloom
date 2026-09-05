import type { Metadata } from "next";
import { Inbox } from "lucide-react";

import { FeaturePlaceholder } from "@/components/shared/feature-placeholder";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <FeaturePlaceholder
      title="Inbox"
      description="Unified inbox for support conversations and assignments."
      milestone="Milestone 8"
      icon={Inbox}
    />
  );
}
