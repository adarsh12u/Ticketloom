import { AppShell } from "@/components/layout/app-shell";
import { getActiveOrganization, requireUser } from "@/lib/auth/session";
import { organizationService } from "@/services/organization-service";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [organization, organizations] = await Promise.all([
    getActiveOrganization(user.id),
    organizationService.listForUser(user.id),
  ]);

  return (
    <AppShell user={user} organization={organization} organizations={organizations}>
      {children}
    </AppShell>
  );
}
