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
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_TYPES,
} from "@/lib/validations/ticket";

type Meta = {
  customers: Array<{ id: string; name: string; email: string }>;
  teams: Array<{ id: string; name: string }>;
  tags: Array<{ id: string; name: string }>;
  agents: Array<{ id: string; name: string | null; email: string }>;
};

type NewTicketFormProps = {
  meta: Meta;
  canAssign: boolean;
  initialCustomerId?: string;
};

export function NewTicketForm({ meta, canAssign, initialCustomerId }: NewTicketFormProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [mode, setMode] = React.useState<"existing" | "new">(
    meta.customers.length || initialCustomerId ? "existing" : "new",
  );
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);

    try {
      const payload: Record<string, unknown> = {
        subject: String(form.get("subject") ?? ""),
        description: String(form.get("description") ?? ""),
        status: String(form.get("status") ?? "OPEN"),
        priority: String(form.get("priority") ?? "MEDIUM"),
        type: String(form.get("type") ?? "QUESTION"),
        teamId: String(form.get("teamId") || "") || null,
        assigneeId: canAssign ? String(form.get("assigneeId") || "") || null : undefined,
        tagIds: selectedTags,
      };

      if (mode === "existing") {
        payload.customerId = String(form.get("customerId") ?? "");
      } else {
        payload.customer = {
          name: String(form.get("customerName") ?? ""),
          email: String(form.get("customerEmail") ?? ""),
          company: String(form.get("customerCompany") || "") || null,
        };
      }

      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as {
        error?: string;
        ticket?: { id: string };
      };
      if (!response.ok || !data.ticket) {
        throw new Error(data.error ?? "Unable to create ticket.");
      }

      toast.success("Ticket created");
      router.push(`/tickets/${data.ticket.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create ticket.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader>
        <CardTitle>Create ticket</CardTitle>
        <CardDescription>
          Capture the issue, customer, and routing details for your support team.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" name="subject" required minLength={3} maxLength={200} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" required rows={6} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue="OPEN"
                className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {TICKET_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <select
                id="priority"
                name="priority"
                defaultValue="MEDIUM"
                className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {TICKET_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                name="type"
                defaultValue="QUESTION"
                className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {TICKET_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === "existing" ? "default" : "outline"}
                onClick={() => setMode("existing")}
                disabled={!meta.customers.length}
              >
                Existing customer
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "new" ? "default" : "outline"}
                onClick={() => setMode("new")}
              >
                New customer
              </Button>
            </div>

            {mode === "existing" ? (
              <div className="space-y-2">
                <Label htmlFor="customerId">Customer</Label>
                <select
                  id="customerId"
                  name="customerId"
                  required
                  defaultValue={initialCustomerId ?? ""}
                  className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">Select customer</option>
                  {meta.customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} ({customer.email})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customerName">Customer name</Label>
                  <Input id="customerName" name="customerName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerEmail">Customer email</Label>
                  <Input id="customerEmail" name="customerEmail" type="email" required />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="customerCompany">Company</Label>
                  <Input id="customerCompany" name="customerCompany" />
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {canAssign ? (
              <div className="space-y-2">
                <Label htmlFor="assigneeId">Assignee</Label>
                <select
                  id="assigneeId"
                  name="assigneeId"
                  className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                  defaultValue=""
                >
                  <option value="">Unassigned</option>
                  {meta.agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name ?? agent.email}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="teamId">Team</Label>
              <select
                id="teamId"
                name="teamId"
                className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                defaultValue=""
              >
                <option value="">No team</option>
                {meta.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {meta.tags.length ? (
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2">
                {meta.tags.map((tag) => {
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
            <Button type="button" variant="outline" onClick={() => router.push("/tickets")}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create ticket
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
