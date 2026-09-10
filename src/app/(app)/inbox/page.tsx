import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { InboxWorkspace } from "@/components/inbox/inbox-workspace";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/session";
import { getCurrentOrganizationContext, hasPermission } from "@/lib/authz";
import { chatService } from "@/services/chat-service";
import { ticketService } from "@/services/ticket-service";

export const metadata: Metadata = { title: "Inbox" };

const OPEN_TICKET_STATUSES = new Set([
  "OPEN",
  "IN_PROGRESS",
  "WAITING_ON_CUSTOMER",
]);

const ACTIVE_CONVERSATION_STATUSES = new Set(["OPEN", "PENDING"]);

export default async function InboxPage() {
  const user = await requireUser("/inbox");
  const context = await getCurrentOrganizationContext(user.id);
  if (!context) {
    redirect("/dashboard");
  }

  const canReadChat = hasPermission(context.role, "chat.read");
  const canReadTickets = hasPermission(context.role, "tickets.read");

  if (!canReadChat && !canReadTickets) {
    redirect("/dashboard");
  }

  const [conversationsResult, ticketsResult] = await Promise.all([
    canReadChat
      ? chatService.list(user.id, { page: 1, pageSize: 50 })
      : Promise.resolve({ items: [] as Awaited<ReturnType<typeof chatService.list>>["items"] }),
    canReadTickets
      ? ticketService.list(user.id, {
          page: 1,
          pageSize: 30,
          assigneeId: user.id,
          includeArchived: false,
          sortBy: "updatedAt",
          sortDir: "desc",
        })
      : Promise.resolve({ items: [] as Awaited<ReturnType<typeof ticketService.list>>["items"] }),
  ]);

  const conversations = conversationsResult.items
    .filter((item) => ACTIVE_CONVERSATION_STATUSES.has(item.status))
    .map((item) => ({
      id: item.id,
      subject: item.subject,
      status: item.status,
      lastMessageAt: item.lastMessageAt
        ? new Date(item.lastMessageAt).toISOString()
        : null,
      lastMessagePreview: item.lastMessagePreview,
      unreadCount: item.unreadCount ?? 0,
      assignedToMe: item.assignedAgentId === user.id,
      customer: item.customer,
      ticket: item.ticket
        ? {
            id: item.ticket.id,
            numberKey: item.ticket.numberKey,
            subject: item.ticket.subject,
          }
        : null,
      assignedAgent: item.assignedAgent,
    }))
    .sort((a, b) => {
      if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
      if (a.assignedToMe !== b.assignedToMe) return a.assignedToMe ? -1 : 1;
      const aTime = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
      const bTime = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
      return bTime - aTime;
    });

  const tickets = ticketsResult.items
    .filter((item) => OPEN_TICKET_STATUSES.has(item.status))
    .map((item) => ({
      id: item.id,
      numberKey: item.numberKey,
      subject: item.subject,
      status: item.status,
      priority: item.priority,
      updatedAt: item.updatedAt.toISOString(),
      customer: item.customer
        ? {
            id: item.customer.id,
            name: item.customer.name,
            email: item.customer.email,
          }
        : null,
    }));

  return (
    <div>
      <PageHeader
        title="Inbox"
        description="Your attention queue — unread chats, conversations, and tickets assigned to you."
      />
      <InboxWorkspace
        userId={user.id}
        conversations={conversations}
        tickets={tickets}
        canReadChat={canReadChat}
        canReadTickets={canReadTickets}
      />
    </div>
  );
}
