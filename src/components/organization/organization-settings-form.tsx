"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type OrganizationSettingsFormProps = {
  name: string;
  slug: string;
  canUpdate: boolean;
};

export function OrganizationSettingsForm({
  name,
  slug,
  canUpdate,
}: OrganizationSettingsFormProps) {
  const router = useRouter();
  const [orgName, setOrgName] = React.useState(name);
  const [orgSlug, setOrgSlug] = React.useState(slug);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canUpdate) return;
    setPending(true);
    try {
      const response = await fetch("/api/organizations/current", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName, slug: orgSlug }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to update organization.");
      toast.success("Organization updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update organization.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Organization profile</CardTitle>
        <CardDescription>
          Name and URL-safe slug for your workspace. Slugs must be unique.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Name</Label>
            <Input
              id="org-name"
              value={orgName}
              disabled={!canUpdate || pending}
              onChange={(event) => setOrgName(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-slug">Slug</Label>
            <Input
              id="org-slug"
              value={orgSlug}
              disabled={!canUpdate || pending}
              onChange={(event) => setOrgSlug(event.target.value)}
              required
            />
          </div>
          {canUpdate ? (
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              You need organization update permission to edit these settings.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
