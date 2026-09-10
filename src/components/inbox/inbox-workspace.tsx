import Link from "next/link";
import { Inbox, MessageSquare, Ticket } from "lucide-react";

import {
  TicketPriorityBadge,
  TicketStatusBadge,
} from "@/components/tickets/ticket-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "@/lib/utils/date";
import { cn } from "@/lib/utils";

export type InboxConversation = {
  id: string;
  subject: string | null;
  status: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  assignedToMe: boolean;
  customer: { id: string; name: string; email: string };
  ticket: { id: string; numberKey: string; subject: string } | null;
  assignedAgent: { id: string; name: string | null; email: string } | null;
};

export type InboxTicket = {
  id: string;
  numberKey: string;
  subject: string;
  status: string;
  priority: string;
  updatedAt: string;
  customer: { id: string; name: string; email: string } | null;
};

type InboxWorkspaceProps = {
  userId: string;
  conversations: InboxConversation[];
  tickets: InboxTicket[];
  canReadChat: boolean;
  canReadTickets: boolean;
};

export function InboxWorkspace({
  userId,
  conversations,
  tickets,
  canReadChat,
  canReadTickets,
}: InboxWorkspaceProps) {
  const unread = conversations.filter((item) => item.unreadCount > 0);
  const mine = conversations.filter(
    (item) => item.assignedToMe && item.unreadCount === 0,
  );
  const other = conversations.filter(
    (item) => !item.assignedToMe && item.unreadCount === 0,
  );

  const isEmpty = conversations.length === 0 && tickets.length === 0;

  if (isEmpty) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={<Inbox className="h-5 w-5" />}
          title="Inbox is clear"
          description="Open tickets assigned to you and active support conversations will show up here."
        />
        <div className="flex flex-wrap justify-center gap-2">
          {canReadTickets ? (
            <Button asChild variant="outline">
              <Link href="/tickets">Browse tickets</Link>
            </Button>
          ) : null}
          {canReadChat ? (
            <Button asChild>
              <Link href="/chat">Open support chat</Link>
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-tight">Conversations</h2>
          {canReadChat ? (
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link href="/chat">
                <MessageSquare className="h-3.5 w-3.5" />
                Open chat
              </Link>
            </Button>
          ) : null}
        </div>

        {!canReadChat ? (
          <p className="text-sm text-muted-foreground">
            You do not have permission to view chat conversations.
          </p>
        ) : conversations.length === 0 ? (
          <EmptyState
            className="py-10"
            icon={<MessageSquare className="h-5 w-5" />}
            title="No active conversations"
            description="Start one from a ticket with Open chat."
          />
        ) : (
          <ul className="divide-y overflow-hidden rounded-lg border bg-card">
            {unread.length > 0 ? (
              <InboxSection label="Unread" count={unread.length}>
                {unread.map((item) => (
                  <ConversationRow key={item.id} item={item} />
                ))}
              </InboxSection>
            ) : null}
            {mine.length > 0 ? (
              <InboxSection label="Assigned to you" count={mine.length}>
                {mine.map((item) => (
                  <ConversationRow key={item.id} item={item} />
                ))}
              </InboxSection>
            ) : null}
            {other.length > 0 ? (
              <InboxSection label="Team conversations" count={other.length}>
                {other.map((item) => (
                  <ConversationRow key={item.id} item={item} />
                ))}
              </InboxSection>
            ) : null}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-tight">My open tickets</h2>
          {canReadTickets ? (
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link href={`/tickets?assigneeId=${userId}`}>
                <Ticket className="h-3.5 w-3.5" />
                All my tickets
              </Link>
            </Button>
          ) : null}
        </div>

        {!canReadTickets ? (
          <p className="text-sm text-muted-foreground">
            You do not have permission to view tickets.
          </p>
        ) : tickets.length === 0 ? (
          <EmptyState
            className="py-10"
            icon={<Ticket className="h-5 w-5" />}
            title="No tickets assigned to you"
            description="When someone assigns you a ticket, it will appear here."
          />
        ) : (
          <ul className="divide-y overflow-hidden rounded-lg border bg-card">
            {tickets.map((ticket) => (
              <li key={ticket.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/tickets/${ticket.id}`}
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {ticket.subject}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {ticket.numberKey}
                      {ticket.customer ? ` · ${ticket.customer.name}` : null}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(ticket.updatedAt))}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <TicketStatusBadge status={ticket.status} />
                  <TicketPriorityBadge priority={ticket.priority} />
                  <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                    <Link href={`/tickets/${ticket.id}`}>View</Link>
                  </Button>
                  {canReadChat ? (
                    <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
                      <Link href={`/chat?ticketId=${ticket.id}`}>Open chat</Link>
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function InboxSection({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <li className="list-none">
      <div className="flex items-center justify-between bg-muted/40 px-4 py-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <Badge variant="secondary" className="text-[10px]">
          {count}
        </Badge>
      </div>
      <ul className="divide-y">{children}</ul>
    </li>
  );
}

function ConversationRow({ item }: { item: InboxConversation }) {
  return (
    <li>
      <Link
        href={`/chat?conversationId=${item.id}`}
        className={cn(
          "block px-4 py-3 transition-colors hover:bg-muted/50",
          item.unreadCount > 0 && "bg-primary/5",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.customer.name}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {item.lastMessagePreview || item.subject || "No messages yet"}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {item.unreadCount > 0 ? (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {item.unreadCount}
              </span>
            ) : null}
            {item.lastMessageAt ? (
              <span className="text-[11px] text-muted-foreground">
                {formatDistanceToNow(new Date(item.lastMessageAt))}
              </span>
            ) : null}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <Badge variant="outline" className="text-[10px]">
            {item.status}
          </Badge>
          {item.ticket ? <span>{item.ticket.numberKey}</span> : null}
          {item.assignedToMe ? (
            <Badge variant="secondary" className="text-[10px]">
              Assigned to you
            </Badge>
          ) : item.assignedAgent ? (
            <span>Assigned: {item.assignedAgent.name ?? item.assignedAgent.email}</span>
          ) : (
            <span>Unassigned</span>
          )}
        </div>
      </Link>
    </li>
  );
}
