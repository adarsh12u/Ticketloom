"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  roleBadgeVariant,
  type ShellOrganization,
} from "@/components/layout/shell-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type OrganizationSwitcherProps = {
  organization: ShellOrganization | null;
  organizations: ShellOrganization[];
  collapsed?: boolean;
  className?: string;
};

export function OrganizationSwitcher({
  organization,
  organizations,
  collapsed = false,
  className,
}: OrganizationSwitcherProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function switchOrganization(organizationId: string) {
    if (!organization || organizationId === organization.id || pending) return;
    setPending(true);
    try {
      const response = await fetch("/api/organizations/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to switch organization.");
      }
      toast.success("Organization switched");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to switch organization.");
    } finally {
      setPending(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          disabled={pending}
          className={cn(
            "h-auto w-full justify-start gap-2 px-2 py-2",
            collapsed && "justify-center px-0",
            className,
          )}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" />
          </span>
          {!collapsed ? (
            <>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium">
                  {organization?.name ?? "Select organization"}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {organization?.role ?? "No membership"}
                </span>
              </span>
              <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
            </>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.length === 0 ? (
          <DropdownMenuItem disabled>No organizations yet</DropdownMenuItem>
        ) : (
          organizations.map((org) => (
            <DropdownMenuItem
              key={org.id}
              className="flex items-center gap-2"
              onClick={() => switchOrganization(org.id)}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{org.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {org.slug}
                </span>
              </span>
              <Badge variant={roleBadgeVariant(org.role)} className="shrink-0 text-[10px]">
                {org.role}
              </Badge>
              {organization?.id === org.id ? (
                <Check className="h-4 w-4 shrink-0 text-primary" />
              ) : null}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings/organization" className="gap-2">
            Organization settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/members" className="gap-2">
            Members
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/onboarding" className="gap-2">
            <Plus className="h-4 w-4" />
            Create organization
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
