import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Settings" };

const settingsLinks = [
  {
    title: "Organization",
    description: "Name, slug, and workspace identity.",
    href: "/settings/organization",
  },
  {
    title: "Members",
    description: "Invite teammates, change roles, and manage access.",
    href: "/settings/members",
  },
  {
    title: "Roles & permissions",
    description: "Review the RBAC permission catalog by role.",
    href: "/settings/roles",
  },
] as const;

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Organization and access controls for your active workspace.
        </p>
      </div>
      <div className="grid gap-4">
        {settingsLinks.map((item) => (
          <Card key={item.href}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href={item.href}>Open</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
