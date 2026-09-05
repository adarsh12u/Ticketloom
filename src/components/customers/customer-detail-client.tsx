"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Loader2, Lock, MessageSquare, RotateCcw, Ticket } from "lucide-react";
import { toast } from "sonner";

import {
  CustomerStatusBadge,
  customerInitials,
} from "@/components/customers/customer-badges";
import {
  TicketPriorityBadge,
  TicketStatusBadge,
} from "@/components/tickets/ticket-badges";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Person = {
  id: string;
  name: string | null;
  email: string;
};

type CustomerDetail = {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  image: string | null;
  status: string;
  source: string | null;
  profileNotes: string | null;
  lastActivityAt: string | Date;
  archivedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  tags: Array<{ id: string; name: string }>;
  notes: Array<{
    id: string;
    body: string;
    createdAt: string | Date;
    author: Person;
  }>;
  activities: Array<{
    id: string;
    type: string;
    message: string | null;
    createdAt: string | Date;
    actor: Person | null;
  }>;
  tickets: Array<{
    id: string;
    numberKey: string;
    subject: string;
    status: string;
    priority: string;
    createdAt: string | Date;
  }>;
};

type CustomerDetailClientProps = {
  customer: CustomerDetail;
  canUpdate: boolean;
  canDelete: boolean;
  canCreateTicket: boolean;
  tags: Array<{ id: string; name: string }>;
  organizationName: string;
};

export function CustomerDetailClient({
  customer: initial,
  canUpdate,
  canDelete,
  canCreateTicket,
  tags,
  organizationName,
}: CustomerDetailClientProps) {
  const router = useRouter();
  const [customer, setCustomer] = React.useState(initial);
  const [pending, setPending] = React.useState(false);
  const [noteBody, setNoteBody] = React.useState("");
  const [editOpen, setEditOpen] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [selectedTags, setSelectedTags] = React.useState(initial.tags.map((tag) => tag.id));

  async function patchCustomer(payload: Record<string, unknown>) {
    setPending(true);
    try {
      const response = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string; customer?: CustomerDetail };
      if (!response.ok || !data.customer) {
        throw new Error(data.error ?? "Unable to update customer.");
      }
      setCustomer(data.customer);
      setSelectedTags(data.customer.tags.map((tag) => tag.id));
      toast.success("Customer updated");
      router.refresh();
      setEditOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update customer.");
    } finally {
      setPending(false);
    }
  }

  async function addNote() {
    if (!noteBody.trim()) return;
    setPending(true);
    try {
      const response = await fetch(`/api/customers/${customer.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteBody }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to add note.");
      setNoteBody("");
      toast.success("Note added");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add note.");
    } finally {
      setPending(false);
    }
  }

  async function archiveCustomer() {
    setPending(true);
    try {
      const response = await fetch(`/api/customers/${customer.id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string; customer?: CustomerDetail };
      if (!response.ok || !data.customer) {
        throw new Error(data.error ?? "Unable to archive customer.");
      }
      setCustomer(data.customer);
      toast.success("Customer archived");
      setArchiveOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to archive customer.");
    } finally {
      setPending(false);
    }
  }

  async function restoreCustomer() {
    setPending(true);
    try {
      const response = await fetch(`/api/customers/${customer.id}/restore`, {
        method: "POST",
      });
      const data = (await response.json()) as { error?: string; customer?: CustomerDetail };
      if (!response.ok || !data.customer) {
        throw new Error(data.error ?? "Unable to restore customer.");
      }
      setCustomer(data.customer);
      toast.success("Customer restored");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to restore customer.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar className="h-14 w-14">
            {customer.image ? <AvatarImage src={customer.image} alt={customer.name} /> : null}
            <AvatarFallback className="text-base">{customerInitials(customer)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight">{customer.name}</h1>
              <CustomerStatusBadge status={customer.status} />
            </div>
            <p className="text-sm text-muted-foreground">{customer.email}</p>
            <p className="text-sm text-muted-foreground">
              {[customer.phone, customer.company, customer.jobTitle].filter(Boolean).join(" · ") ||
                "No phone or company on file"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="gap-2">
            <Link href={`/chat?customerId=${customer.id}`}>
              <MessageSquare className="h-4 w-4" />
              Conversations
            </Link>
          </Button>
          {canCreateTicket && !customer.archivedAt ? (
            <Button asChild className="gap-2">
              <Link href={`/tickets/new?customerId=${customer.id}`}>
                <Ticket className="h-4 w-4" />
                Create ticket
              </Link>
            </Button>
          ) : null}
          {canUpdate ? (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
          ) : null}
          {canDelete && !customer.archivedAt ? (
            <Button variant="outline" className="gap-2" onClick={() => setArchiveOpen(true)}>
              <Archive className="h-4 w-4" />
              Archive
            </Button>
          ) : null}
          {canUpdate && customer.archivedAt ? (
            <Button variant="outline" className="gap-2" disabled={pending} onClick={restoreCustomer}>
              <RotateCcw className="h-4 w-4" />
              Restore
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Overview</CardTitle>
              <CardDescription>
                Profile for {organizationName}. Internal notes never appear in customer replies.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">Source</p>
                <p className="font-medium">{customer.source ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last activity</p>
                <p className="font-medium">{new Date(customer.lastActivityAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium">{new Date(customer.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Updated</p>
                <p className="font-medium">{new Date(customer.updatedAt).toLocaleString()}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-muted-foreground">Profile summary</p>
                <p className="mt-1 whitespace-pre-wrap">
                  {customer.profileNotes || "No profile summary yet."}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="mb-2 text-muted-foreground">Tags</p>
                {canUpdate ? (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => {
                      const active = selectedTags.includes(tag.id);
                      return (
                        <Button
                          key={tag.id}
                          type="button"
                          size="sm"
                          variant={active ? "default" : "outline"}
                          disabled={pending}
                          onClick={() => {
                            const next = active
                              ? selectedTags.filter((id) => id !== tag.id)
                              : [...selectedTags, tag.id];
                            setSelectedTags(next);
                            void patchCustomer({ tagIds: next });
                          }}
                        >
                          {tag.name}
                        </Button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {customer.tags.map((tag) => (
                      <Badge key={tag.id} variant="outline">
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Ticket history</CardTitle>
                <CardDescription>Tickets belonging to this customer.</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/tickets?customerId=${customer.id}`}>View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {customer.tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tickets yet.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {customer.tickets.map((ticket) => (
                    <li key={ticket.id}>
                      <Link
                        href={`/tickets/${ticket.id}`}
                        className="flex flex-col gap-2 px-3 py-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">
                              {ticket.numberKey}
                            </span>
                            <TicketStatusBadge status={ticket.status} />
                            <TicketPriorityBadge priority={ticket.priority} />
                          </div>
                          <p className="mt-1 truncate text-sm font-medium">{ticket.subject}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(ticket.createdAt).toLocaleString()}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Internal notes
              </CardTitle>
              <CardDescription>
                Organization-only notes. Never exposed in customer-facing ticket replies.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {customer.notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No internal notes yet.</p>
              ) : (
                <ul className="space-y-3">
                  {customer.notes.map((note) => (
                    <li key={note.id} className="rounded-md border border-dashed px-3 py-2">
                      <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                        <span>{note.author.name ?? note.author.email}</span>
                        <span>{new Date(note.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{note.body}</p>
                    </li>
                  ))}
                </ul>
              )}
              {canUpdate ? (
                <div className="space-y-2">
                  <Label htmlFor="customer-note">Add note</Label>
                  <Textarea
                    id="customer-note"
                    value={noteBody}
                    onChange={(event) => setNoteBody(event.target.value)}
                    rows={3}
                  />
                  <Button disabled={pending || !noteBody.trim()} onClick={addNote}>
                    {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Add note
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity timeline</CardTitle>
            <CardDescription>Persisted CRM events for this customer.</CardDescription>
          </CardHeader>
          <CardContent>
            {customer.activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ol className="space-y-3 border-l pl-4">
                {customer.activities.map((activity) => (
                  <li key={activity.id} className="relative">
                    <span className="absolute -left-[1.3rem] top-1.5 h-2 w-2 rounded-full bg-primary" />
                    <p className="text-sm font-medium">
                      {activity.message ?? activity.type.replaceAll("_", " ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {activity.actor?.name ?? activity.actor?.email ?? "System"} ·{" "}
                      {new Date(activity.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit customer</DialogTitle>
            <DialogDescription>Update profile fields for this organization.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void patchCustomer({
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
              });
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="edit-firstName">First name</Label>
                <Input
                  id="edit-firstName"
                  name="firstName"
                  defaultValue={customer.firstName ?? ""}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-lastName">Last name</Label>
                <Input id="edit-lastName" name="lastName" defaultValue={customer.lastName ?? ""} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-name">Display name</Label>
              <Input id="edit-name" name="name" defaultValue={customer.name} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" name="email" type="email" defaultValue={customer.email} required />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input id="edit-phone" name="phone" defaultValue={customer.phone ?? ""} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-company">Company</Label>
                <Input id="edit-company" name="company" defaultValue={customer.company ?? ""} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="edit-jobTitle">Job title</Label>
                <Input id="edit-jobTitle" name="jobTitle" defaultValue={customer.jobTitle ?? ""} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-status">Status</Label>
                <select
                  id="edit-status"
                  name="status"
                  defaultValue={customer.status === "ARCHIVED" ? "ACTIVE" : customer.status}
                  className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PROSPECT">PROSPECT</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-source">Source</Label>
              <Input id="edit-source" name="source" defaultValue={customer.source ?? ""} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-profileNotes">Profile summary</Label>
              <Textarea
                id="edit-profileNotes"
                name="profileNotes"
                defaultValue={customer.profileNotes ?? ""}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive customer</DialogTitle>
            <DialogDescription>
              Archiving keeps ticket history intact. The customer will be hidden from default lists.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={pending} onClick={archiveCustomer}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
