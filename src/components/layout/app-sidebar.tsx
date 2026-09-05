"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";
import { signOut } from "next-auth/react";

import { Logo } from "@/components/shared/logo";
import { OrganizationSwitcher } from "@/components/organization/organization-switcher";
import {
  getUserInitials,
  type ShellOrganization,
  type ShellUser,
} from "@/components/layout/shell-types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebar } from "@/components/layout/sidebar-context";
import { appNavigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type AppSidebarProps = {
  className?: string;
  onNavigate?: () => void;
  user: ShellUser;
  organization: ShellOrganization | null;
  organizations: ShellOrganization[];
};

export function AppSidebar({
  className,
  onNavigate,
  user,
  organization,
  organizations,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { collapsed } = useSidebar();
  const initials = getUserInitials(user);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
          collapsed ? "w-[68px]" : "w-64",
          className,
        )}
      >
        <div className={cn("flex h-14 items-center px-3", collapsed && "justify-center")}>
          <Logo href="/dashboard" showWordmark={!collapsed} />
        </div>

        <Separator />

        <div className="px-2 py-2">
          <OrganizationSwitcher
            organization={organization}
            organizations={organizations}
            collapsed={collapsed}
          />
        </div>

        <Separator />

        <ScrollArea className="flex-1 px-2 py-3">
          <nav className="space-y-5">
            {appNavigation.map((group, groupIndex) => (
              <div key={group.label ?? `group-${groupIndex}`} className="space-y-1">
                {group.label && !collapsed ? (
                  <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </p>
                ) : null}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href));

                  const link = (
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                        collapsed && "justify-center px-2",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      {!collapsed ? <span>{item.title}</span> : null}
                    </Link>
                  );

                  if (!collapsed) {
                    return <div key={item.href}>{link}</div>;
                  }

                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{item.title}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </nav>
        </ScrollArea>

        <div className="mt-auto border-t border-sidebar-border p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "h-auto w-full justify-start gap-2 px-2 py-2",
                  collapsed && "justify-center px-0",
                )}
              >
                <Avatar className="h-8 w-8">
                  {user.image ? <AvatarImage src={user.image} alt={user.name ?? user.email} /> : null}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                {!collapsed ? (
                  <>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-medium">
                        {user.name ?? user.email}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {organization?.role ?? "Member"}
                      </span>
                    </span>
                    <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                  </>
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings">Account settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/members">Members</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </TooltipProvider>
  );
}
