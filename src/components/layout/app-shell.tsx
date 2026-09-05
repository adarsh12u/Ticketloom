"use client";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarProvider, useSidebar } from "@/components/layout/sidebar-context";
import type { ShellOrganization, ShellUser } from "@/components/layout/shell-types";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: React.ReactNode;
  user: ShellUser;
  organization: ShellOrganization | null;
  organizations: ShellOrganization[];
};

function AppShellFrame({ children, user, organization, organizations }: AppShellProps) {
  const { collapsed } = useSidebar();

  return (
    <div className="flex min-h-screen bg-background">
      <div
        className={cn(
          "hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex",
          collapsed ? "lg:w-[68px]" : "lg:w-64",
        )}
      >
        <AppSidebar
          user={user}
          organization={organization}
          organizations={organizations}
        />
      </div>
      <div
        className={cn(
          "flex min-h-screen flex-1 flex-col",
          collapsed ? "lg:pl-[68px]" : "lg:pl-64",
        )}
      >
        <AppHeader
          user={user}
          organization={organization}
          organizations={organizations}
        />
        <main className="flex-1 px-3 py-4 sm:px-4 lg:px-6 lg:py-6">{children}</main>
      </div>
    </div>
  );
}

export function AppShell({ children, user, organization, organizations }: AppShellProps) {
  return (
    <SidebarProvider>
      <AppShellFrame
        user={user}
        organization={organization}
        organizations={organizations}
      >
        {children}
      </AppShellFrame>
    </SidebarProvider>
  );
}
