"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CircleHelp,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sparkles,
} from "lucide-react";

import { ThemeToggle } from "@/components/shared/theme-toggle";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { useSidebar } from "@/components/layout/sidebar-context";
import {
  getUserInitials,
  type ShellOrganization,
  type ShellUser,
} from "@/components/layout/shell-types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { signOut } from "next-auth/react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

function useCommandPalette() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return { open, setOpen };
}

function titleFromPath(pathname: string) {
  if (pathname === "/dashboard") return "Overview";
  const segment = pathname.split("/").filter(Boolean).pop();
  if (!segment) return "Overview";
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

type AppHeaderProps = {
  user: ShellUser;
  organization: ShellOrganization | null;
  organizations: ShellOrganization[];
};

export function AppHeader({ user, organization, organizations }: AppHeaderProps) {
  const pathname = usePathname();
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebar();
  const { open: searchOpen, setOpen: setSearchOpen } = useCommandPalette();
  const [aiOpen, setAiOpen] = React.useState(false);
  const pageTitle = titleFromPath(pathname);
  const initials = getUserInitials(user);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>

          <Breadcrumb className="hidden min-w-0 sm:block">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">Ticketloom</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <p className="truncate text-sm font-medium sm:hidden">{pageTitle}</p>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5">
          <Button
            variant="outline"
            className="hidden h-9 w-56 justify-start gap-2 text-muted-foreground md:inline-flex"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left text-sm">Search…</span>
            <kbd className="pointer-events-none rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Search"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => setAiOpen(true)}
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">AI</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
                <Bell className="h-4 w-4" />
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                Notifications
                <Badge variant="secondary">3</Badge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="flex flex-col items-start gap-0.5 py-2.5">
                <span className="text-sm font-medium">Ticket assigned</span>
                <span className="text-xs text-muted-foreground">
                  #1042 was assigned to you
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex flex-col items-start gap-0.5 py-2.5">
                <span className="text-sm font-medium">New chat message</span>
                <span className="text-xs text-muted-foreground">
                  Alex mentioned you in #support
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex flex-col items-start gap-0.5 py-2.5">
                <span className="text-sm font-medium">Urgent ticket opened</span>
                <span className="text-xs text-muted-foreground">
                  Payment webhook failures reported
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="icon" aria-label="Help" asChild>
            <Link href="/#documentation">
              <CircleHelp className="h-4 w-4" />
            </Link>
          </Button>

          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="User menu">
                <Avatar className="h-8 w-8">
                  {user.image ? <AvatarImage src={user.image} alt={user.name ?? user.email} /> : null}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-0.5">
                  <span>{user.name ?? "Account"}</span>
                  <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/members">Members</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/organization">Organization</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/onboarding">Onboarding</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <AppSidebar
            className="w-full border-0"
            onNavigate={() => setMobileOpen(false)}
            user={user}
            organization={organization}
            organizations={organizations}
          />
        </SheetContent>
      </Sheet>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Global search</DialogTitle>
            <DialogDescription>Search tickets, customers, knowledge, and more.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search tickets, customers, articles…"
              className="h-12 border-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="p-3">
            <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Quick links
            </p>
            <div className="space-y-1">
              {[
                { label: "Tickets", href: "/tickets" },
                { label: "Customers", href: "/customers" },
                { label: "Knowledge Base", href: "/knowledge" },
                { label: "Team Chat", href: "/chat" },
              ].map((item) => (
                <Button
                  key={item.href}
                  variant="ghost"
                  className="h-9 w-full justify-start"
                  asChild
                  onClick={() => setSearchOpen(false)}
                >
                  <Link href={item.href}>{item.label}</Link>
                </Button>
              ))}
            </div>
            <p className="mt-3 px-1 text-xs text-muted-foreground">
              Full search will connect to backend data in a later milestone.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Assistant
            </DialogTitle>
            <DialogDescription>
              Practical AI tools for support workflows. Open a ticket or chat to draft summaries and replies.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 text-sm text-muted-foreground">
            <p>
              Use the AI assistant panel on ticket detail or in chat. Suggestions are never auto-sent —
              insert into the composer, edit if needed, then send yourself.
            </p>
            <p>
              Requires Ollama with <code className="text-xs">llama3.2</code> and{" "}
              <code className="text-xs">nomic-embed-text</code>, or <code className="text-xs">AI_PROVIDER=mock</code>{" "}
              for tests.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
