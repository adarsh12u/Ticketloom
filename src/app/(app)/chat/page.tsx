import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/session";
import { getCurrentOrganizationContext, hasPermission } from "@/lib/authz";
import { chatService } from "@/services/chat-service";
import { organizationRepository } from "@/repositories/organization-repository";

export const metadata: Metadata = { title: "Support Chat" };

type ChatPageProps = {
  searchParams: Promise<{ conversationId?: string; ticketId?: string; customerId?: string }>;
};

function serializeConversation(item: Awaited<ReturnType<typeof chatService.list>>["items"][number]) {
  return {
    id: item.id,
    subject: item.subject,
    status: item.status,
    customerId: item.customerId,
    ticketId: item.ticketId,
    assignedAgentId: item.assignedAgentId,
    lastMessageAt: item.lastMessageAt
      ? new Date(item.lastMessageAt).toISOString()
      : null,
    lastMessagePreview: item.lastMessagePreview,
    unreadCount: item.unreadCount ?? 0,
    customer: item.customer,
    ticket: item.ticket,
    assignedAgent: item.assignedAgent,
  };
}

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const user = await requireUser("/chat");
  const context = await getCurrentOrganizationContext(user.id);
  if (!context || !hasPermission(context.role, "chat.read")) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  let focusId = params.conversationId ?? null;

  if (params.ticketId && hasPermission(context.role, "chat.create")) {
    const conversation = await chatService.getOrCreateForTicket(user.id, params.ticketId);
    focusId = conversation.id;
  }

  const [list, members] = await Promise.all([
    chatService.list(user.id, {
      page: 1,
      pageSize: 50,
      customerId: params.customerId,
    }),
    organizationRepository.listMembers(context.organization.id),
  ]);

  const agents = members
    .filter((member) => member.status === "ACTIVE")
    .map((member) => ({
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
    }));

  return (
    <div>
      <PageHeader
        title="Support Chat"
        description="Real-time customer conversations linked to tickets and CRM profiles."
      />
      <ChatWorkspace
        userId={user.id}
        initialConversations={list.items.map(serializeConversation)}
        initialConversationId={focusId}
        agents={agents}
        canUpdate={hasPermission(context.role, "chat.update")}
        canAssign={hasPermission(context.role, "chat.assign")}
        canUseAi={hasPermission(context.role, "ai.use")}
      />
    </div>
  );
}
