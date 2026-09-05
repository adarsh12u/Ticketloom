import {
  LayoutDashboard,
  Ticket,
  Users,
  BookOpen,
  Inbox,
  MessageSquare,
  BarChart3,
  FileText,
  UserCog,
  Shield,
  ScrollText,
  Settings,
  Building2,
  Activity,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export type NavGroup = {
  label?: string;
  items: NavItem[];
};

export const appNavigation: NavGroup[] = [
  {
    items: [
      {
        title: "Overview",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Workspace",
    items: [
      { title: "Tickets", href: "/tickets", icon: Ticket },
      { title: "Customers", href: "/customers", icon: Users },
      { title: "Knowledge Base", href: "/knowledge", icon: BookOpen },
    ],
  },
  {
    label: "Collaborate",
    items: [
      { title: "Inbox", href: "/inbox", icon: Inbox },
      { title: "Support Chat", href: "/chat", icon: MessageSquare },
    ],
  },
  {
    label: "Analytics",
    items: [
      { title: "Analytics", href: "/analytics", icon: BarChart3 },
      { title: "Reports", href: "/reports", icon: FileText },
    ],
  },
  {
    label: "Admin",
    items: [
      { title: "Members", href: "/settings/members", icon: UserCog },
      { title: "Roles & Permissions", href: "/settings/roles", icon: Shield },
      { title: "System health", href: "/admin/system", icon: Activity },
      { title: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText },
    ],
  },
  {
    items: [
      { title: "Organization", href: "/settings/organization", icon: Building2 },
      { title: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export const marketingNav = [
  { title: "Features", href: "/#features" },
  { title: "Pricing", href: "/#pricing" },
  { title: "Documentation", href: "/#documentation" },
] as const;
