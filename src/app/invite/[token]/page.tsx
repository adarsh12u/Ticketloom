import type { Metadata } from "next";

import { InvitationAcceptCard } from "@/components/organization/invitation-accept-card";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { getCurrentUser } from "@/lib/auth/session";
import {
  OrganizationServiceError,
  organizationService,
} from "@/services/organization-service";

export const metadata: Metadata = { title: "Accept invitation" };

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token: rawToken } = await params;
  const token = decodeURIComponent(rawToken);
  const user = await getCurrentUser();

  let invitation = null;
  let error: string | null = null;

  try {
    const preview = await organizationService.getInvitationPreview(token);
    invitation = {
      email: preview.email,
      role: preview.role,
      expiresAt: preview.expiresAt.toISOString(),
      organization: preview.organization,
      invitedBy: preview.invitedBy,
    };
  } catch (previewError) {
    if (previewError instanceof OrganizationServiceError) {
      error = previewError.message;
    } else {
      error = "This invitation is invalid.";
    }
  }

  return (
    <div className="relative min-h-screen bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.94_0.03_255)_0%,_transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top,_oklch(0.26_0.04_255)_0%,_transparent_50%)]" />
      <header className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-6">
        <Logo href="/" />
        <ThemeToggle />
      </header>
      <main className="relative z-10 px-4 py-10 sm:px-6">
        <InvitationAcceptCard
          token={token}
          authenticated={Boolean(user)}
          invitation={invitation}
          error={error}
        />
      </main>
    </div>
  );
}
