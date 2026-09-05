"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type NewCustomerFormProps = {
  tags: Array<{ id: string; name: string }>;
};

export function NewCustomerForm({ tags }: NewCustomerFormProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: String(form.get("firstName") || "") || null,
          lastName: String(form.get("lastName") || "") || null,
          name: String(form.get("name") || "") || undefined,
          email: String(form.get("email") ?? ""),
          phone: String(form.get("phone") || "") || null,
          company: String(form.get("company") || "") || null,
          jobTitle: String(form.get("jobTitle") || "") || null,
          status: String(form.get("status") || "ACTIVE"),
          source: String(form.get("source") || "") || null,
          profileNotes: String(form.get("profileNotes") || "") || null,
          tagIds: selectedTags,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        customer?: { id: string };
      };
      if (!response.ok || !data.customer) {
        throw new Error(data.error ?? "Unable to create customer.");
      }
      toast.success("Customer created");
      router.push(`/customers/${data.customer.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create customer.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader>
        <CardTitle>Create customer</CardTitle>
        <CardDescription>
          Capture contact details used across tickets, chat, and future customer portals.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" name="firstName" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" name="lastName" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Display name (optional)</Label>
            <Input id="name" name="name" placeholder="Defaults from first/last name" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input id="company" name="company" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobTitle">Job title</Label>
              <Input id="jobTitle" name="jobTitle" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue="ACTIVE"
                className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="PROSPECT">PROSPECT</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Input id="source" name="source" placeholder="Referral, website, import…" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="profileNotes">Profile summary</Label>
            <Textarea id="profileNotes" name="profileNotes" rows={3} />
          </div>
          {tags.length ? (
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const active = selectedTags.includes(tag.id);
                  return (
                    <Button
                      key={tag.id}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      onClick={() =>
                        setSelectedTags((current) =>
                          active
                            ? current.filter((id) => id !== tag.id)
                            : [...current, tag.id],
                        )
                      }
                    >
                      {tag.name}
                    </Button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.push("/customers")}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create customer
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
