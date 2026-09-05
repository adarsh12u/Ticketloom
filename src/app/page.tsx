import type { Metadata } from "next";

import { MarketingLanding } from "@/components/marketing/landing-page";

export const metadata: Metadata = {
  title: "Ticketloom — AI-assisted support workspace",
};

export default function HomePage() {
  return <MarketingLanding />;
}
