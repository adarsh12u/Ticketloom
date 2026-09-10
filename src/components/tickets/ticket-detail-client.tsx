"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, BookOpen, Loader2, Lock, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import {
  TicketPriorityBadge,
  TicketStatusBadge,
} from "@/components/tickets/ticket-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { KnowledgeSearchPanel } from "@/components/knowledge/knowledge-search-panel";
import { AiAssistantPanel } from "@/components/ai/ai-assistant-panel";
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_TYPES,
} from "@/lib/validations/ticket";

type Person = {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
};

type TicketDetail = {
  id: string;
  numberKey: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  type: string;
  dueAt: string | Date | null;
  firstResponseDueAt: string | Date | null;
  resolutionDueAt: string | Date | null;
  resolvedAt: string | Date | null;
  closedAt: string | Date | null;
  archivedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  customer: { id: string; name: string; email: string; company: string | null };
  assignee: Person | null;
  createdBy: Person;
  team: { id: string; name: string } | null;
  tags: Array<{ id: string; name: string; color: string | null }>;
  messages: Array<{
    id: string;
    body: string;
    visibility: "INTERNAL" | "CUSTOMER";
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
};

type TicketDetailClientProps = {
  ticket: TicketDetail;
  canUpdate: boolean;
  canAssign: boolean;
  canDelete: boolean;
  canUseAi?: boolean;
  agents: Array<{ id: string; name: string | null; email: string }>;
  teams: Array<{ id: string; name: string }>;
  tags: Array<{ id: string; name: string }>;
};

function personLabel(person: Person | null | undefined) {
  if (!person) return "—";
  return person.name ?? person.email;
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function TicketDetailClient({
  ticket: initial,
  canUpdate,
  canAssign,
  canDelete,
  canUseAi = false,
  agents,
  teams,
  tags,
}: TicketDetailClientProps) {
  const router = useRouter();
  const [ticket, setTicket] = React.useState(initial);
  const [pending, setPending] = React.useState(false);
  const [noteBody, setNoteBody] = React.useState("");
  const [replyBody, setReplyBody] = React.useState("");
  const [selectedTags, setSelectedTags] = React.useState(initial.tags.map((tag) => tag.id));

  async function patchTicket(payload: Record<string, unknown>) {
    setPending(true);
    try {
      const response = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string; ticket?: TicketDetail };
      if (!response.ok || !data.ticket) {
        throw new Error(data.error ?? "Unable to update ticket.");
      }
      setTicket(data.ticket);
      toast.success("Ticket updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update ticket.");
    } finally {
      setPending(false);
    }
  }

  async function addMessage(visibility: "INTERNAL" | "CUSTOMER", body: string, clear: () => void) {
    if (!body.trim()) return;
    setPending(true);
    try {
      const response = await fetch(`/api/tickets/${ticket.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, visibility }),
      });
      const data = (await response.json()) as {
        error?: string;
        message?: unknown;
        email?: { status?: string; to?: string; reason?: string };
      };
      if (!response.ok) throw new Error(data.error ?? "Unable to post message.");
      clear();
      if (visibility === "INTERNAL") {
        toast.success("Internal note added");
      } else if (data.email?.status === "queued" || data.email?.status === "sent") {
        toast.success(
          data.email.to
            ? `Reply posted and emailed to ${data.email.to}`
            : "Reply posted and emailed to the customer",
        );
      } else if (data.email?.status === "failed") {
        toast.error(
          data.email.reason
            ? `Reply saved, but email failed: ${data.email.reason}`
            : "Reply saved, but email failed to send.",
        );
      } else {
        toast.success("Reply added");
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to post message.");
    } finally {
      setPending(false);
    }
  }

  async function archiveTicket() {
    if (!canDelete) return;
    setPending(true);
    try {
      const response = await fetch(`/api/tickets/${ticket.id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string; ticket?: TicketDetail };
      if (!response.ok || !data.ticket) {
        throw new Error(data.error ?? "Unable to archive ticket.");
      }
      setTicket(data.ticket);
      toast.success("Ticket archived");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to archive ticket.");
    } finally {
      setPending(false);
    }
  }

  const internalNotes = ticket.messages.filter((message) => message.visibility === "INTERNAL");
  const customerReplies = ticket.messages.filter((message) => message.visibility === "CUSTOMER");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/tickets" className="text-sm text-muted-foreground hover:text-foreground">
              Tickets
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-mono text-sm">{ticket.numberKey}</span>
            {ticket.archivedAt ? <Badge variant="outline">Archived</Badge> : null}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{ticket.subject}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <TicketStatusBadge status={ticket.status} />
            <TicketPriorityBadge priority={ticket.priority} />
            <Badge variant="secondary">{ticket.type.replaceAll("_", " ")}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2">
                <BookOpen className="h-4 w-4" />
                Search knowledge
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Knowledge search</SheetTitle>
                <SheetDescription>
                  Find approved articles related to this ticket, or use AI suggestions in the side panel.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4">
                <KnowledgeSearchPanel
                  query={ticket.subject}
                  compact
                  className="border-0 p-0 shadow-none"
                />
              </div>
            </SheetContent>
          </Sheet>
          <Button asChild variant="outline" className="gap-2">
            <Link href={`/chat?ticketId=${ticket.id}`}>
              <MessageSquare className="h-4 w-4" />
              Open chat
            </Link>
          </Button>
          {canDelete && !ticket.archivedAt ? (
            <Button variant="outline" disabled={pending} onClick={archiveTicket} className="gap-2">
              <Archive className="h-4 w-4" />
              Archive
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_0.9fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {ticket.description}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Customer-visible conversation
              </CardTitle>
              <CardDescription>
                Replies here are emailed to{" "}
                <span className="font-medium text-foreground">
                  {ticket.customer.email}
                </span>
                . Internal notes stay private to your team.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {customerReplies.length === 0 ? (
                <p className="text-sm text-muted-foreground">No customer-visible messages yet.</p>
              ) : (
                <ul className="space-y-3">
                  {customerReplies.map((message) => (
                    <li key={message.id} className="rounded-md border bg-muted/30 px-3 py-2">
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>{personLabel(message.author)}</span>
                        <span>{formatDate(message.createdAt)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{message.body}</p>
                    </li>
                  ))}
                </ul>
              )}
              {canUpdate ? (
                <div className="space-y-2">
                  <Label htmlFor="reply">Add reply</Label>
                  <Textarea
                    id="reply"
                    value={replyBody}
                    onChange={(event) => setReplyBody(event.target.value)}
                    rows={3}
                    placeholder="Write a customer-visible reply…"
                  />
                  <Button
                    disabled={pending || !replyBody.trim()}
                    onClick={() => addMessage("CUSTOMER", replyBody, () => setReplyBody(""))}
                  >
                    {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Post reply & email
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Internal notes
              </CardTitle>
              <CardDescription>
                Visible only to organization members. Never exposed as customer replies.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {internalNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No internal notes yet.</p>
              ) : (
                <ul className="space-y-3">
                  {internalNotes.map((message) => (
                    <li key={message.id} className="rounded-md border border-dashed px-3 py-2">
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>{personLabel(message.author)}</span>
                        <span>{formatDate(message.createdAt)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{message.body}</p>
                    </li>
                  ))}
                </ul>
              )}
              {canUpdate ? (
                <div className="space-y-2">
                  <Label htmlFor="note">Add internal note</Label>
                  <Textarea
                    id="note"
                    value={noteBody}
                    onChange={(event) => setNoteBody(event.target.value)}
                    rows={3}
                    placeholder="Private note for agents…"
                  />
                  <Button
                    variant="secondary"
                    disabled={pending || !noteBody.trim()}
                    onClick={() => addMessage("INTERNAL", noteBody, () => setNoteBody(""))}
                  >
                    {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Add note
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity timeline</CardTitle>
              <CardDescription>Persisted events for this ticket — not hard-coded UI history.</CardDescription>
            </CardHeader>
            <CardContent>
              {ticket.activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <ol className="space-y-3 border-l pl-4">
                  {ticket.activities.map((activity) => (
                    <li key={activity.id} className="relative">
                      <span className="absolute -left-[1.3rem] top-1.5 h-2 w-2 rounded-full bg-primary" />
                      <p className="text-sm font-medium">
                        {activity.message ?? activity.type.replaceAll("_", " ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {personLabel(activity.actor)} · {formatDate(activity.createdAt)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <AiAssistantPanel
            ticketId={ticket.id}
            canUseAi={canUseAi}
            onInsertReply={(text) => setReplyBody(text)}
          />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Properties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Status</Label>
                <select
                  className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={ticket.status}
                  disabled={!canUpdate || pending}
                  onChange={(event) => patchTicket({ status: event.target.value })}
                >
                  {TICKET_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Priority</Label>
                <select
                  className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={ticket.priority}
                  disabled={!canUpdate || pending}
                  onChange={(event) => patchTicket({ priority: event.target.value })}
                >
                  {TICKET_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Type</Label>
                <select
                  className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={ticket.type}
                  disabled={!canUpdate || pending}
                  onChange={(event) => patchTicket({ type: event.target.value })}
                >
                  {TICKET_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Assignee</Label>
                <select
                  className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={ticket.assignee?.id ?? ""}
                  disabled={!canAssign || pending}
                  onChange={(event) =>
                    patchTicket({ assigneeId: event.target.value || null })
                  }
                >
                  <option value="">Unassigned</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name ?? agent.email}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Team</Label>
                <select
                  className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={ticket.team?.id ?? ""}
                  disabled={!canUpdate || pending}
                  onChange={(event) => patchTicket({ teamId: event.target.value || null })}
                >
                  <option value="">No team</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
              {canUpdate ? (
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
                          disabled={pending}
                          onClick={() => {
                            const next = active
                              ? selectedTags.filter((id) => id !== tag.id)
                              : [...selectedTags, tag.id];
                            setSelectedTags(next);
                            void patchTicket({ tagIds: next });
                          }}
                        >
                          {tag.name}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {ticket.tags.map((tag) => (
                    <Badge key={tag.id} variant="outline">
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{ticket.customer.name}</p>
              <p className="text-muted-foreground">{ticket.customer.email}</p>
              {ticket.customer.company ? (
                <p className="text-muted-foreground">{ticket.customer.company}</p>
              ) : null}
              <Button asChild variant="outline" size="sm" className="mt-1">
                <Link href={`/customers/${ticket.customer.id}`}>Open customer profile</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timestamps & SLA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDate(ticket.createdAt)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Updated</span>
                <span>{formatDate(ticket.updatedAt)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Due</span>
                <span>{formatDate(ticket.dueAt)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">First response due</span>
                <span>{formatDate(ticket.firstResponseDueAt)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Resolution due</span>
                <span>{formatDate(ticket.resolutionDueAt)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Resolved</span>
                <span>{formatDate(ticket.resolvedAt)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Closed</span>
                <span>{formatDate(ticket.closedAt)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Created by</span>
                <span>{personLabel(ticket.createdBy)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
