import type { Metadata } from "next";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Onboarding",
};

export default async function OnboardingPage() {
  await requireUser("/onboarding");

  return (
    <div className="relative min-h-screen bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.94_0.03_255)_0%,_transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top,_oklch(0.26_0.04_255)_0%,_transparent_50%)]" />
      <header className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-6">
        <Logo href="/dashboard" />
        <ThemeToggle />
      </header>
      <main className="relative z-10 px-4 py-8 sm:px-6">
        <OnboardingWizard />
      </main>
    </div>
  );
}
