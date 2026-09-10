import {
  requireOrganizationContext,
  requirePermission,
} from "@/lib/authz";
import { AuthorizationError } from "@/lib/authz/errors";
import { checkRateLimit } from "@/lib/redis/rate-limit";
import { conversationRepository } from "@/repositories/conversation-repository";
import { customerRepository } from "@/repositories/customer-repository";
import { organizationRepository } from "@/repositories/organization-repository";
import { ticketRepository } from "@/repositories/ticket-repository";

export class ChatServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NOT_FOUND"
      | "VALIDATION"
      | "FORBIDDEN"
      | "CONFLICT"
      | "RATE_LIMITED"
      | "UNAUTHORIZED" = "VALIDATION",
  ) {
    super(message);
    this.name = "ChatServiceError";
  }
}

async function requireChatPermission(
  userId: string,
  permission: "chat.read" | "chat.create" | "chat.update" | "chat.assign",
) {
  const context = await requireOrganizationContext(userId);
  requirePermission(context.role, permission);
  return context;
}

function toPublicConversation(
  conversation: NonNullable<
    Awaited<ReturnType<typeof conversationRepository.findByIdForOrg>>
  >,
) {
  return {
    id: conversation.id,
    organizationId: conversation.organizationId,
    customerId: conversation.customerId,
    ticketId: conversation.ticketId,
    subject: conversation.subject,
    status: conversation.status,
    assignedAgentId: conversation.assignedAgentId,
    lastMessageAt: conversation.lastMessageAt,
    lastMessagePreview: conversation.lastMessagePreview,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    closedAt: conversation.closedAt,
    customer: conversation.customer,
    ticket: conversation.ticket,
    assignedAgent: conversation.assignedAgent,
    participants: conversation.participants?.map((participant) => ({
      id: participant.id,
      userId: participant.userId,
      role: participant.role,
      lastReadAt: participant.lastReadAt,
      user: participant.user,
    })),
    counts: conversation._count,
  };
}

function toPublicMessage(
  message: NonNullable<Awaited<ReturnType<typeof conversationRepository.findMessage>>>,
) {
  return {
    id: message.id,
    organizationId: message.organizationId,
    conversationId: message.conversationId,
    senderUserId: message.senderUserId,
    clientMessageId: message.clientMessageId,
    body: message.deletedAt ? "" : message.body,
    type: message.type,
    createdAt: message.createdAt,
    editedAt: message.editedAt,
    deletedAt: message.deletedAt,
    sender: message.sender,
  };
}

export const chatService = {
  async list(
    userId: string,
    input: {
      page?: number;
      pageSize?: number;
      q?: string;
      status?: "OPEN" | "PENDING" | "RESOLVED" | "CLOSED";
      customerId?: string;
      ticketId?: string;
      assignedAgentId?: string | null;
    },
  ) {
    const context = await requireChatPermission(userId, "chat.read");
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 30;
    const result = await conversationRepository.list({
      organizationId: context.organization.id,
      q: input.q,
      status: input.status,
      customerId: input.customerId,
      ticketId: input.ticketId,
      assignedAgentId: input.assignedAgentId,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const unread = await conversationRepository.unreadCountsForUser(
      context.organization.id,
      userId,
    );

    return {
      items: result.items.map((item) => ({
        ...toPublicConversation(item as never),
        unreadCount: unread[item.id] ?? 0,
      })),
      page,
      pageSize,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
    };
  },

  async get(userId: string, conversationId: string) {
    const context = await requireChatPermission(userId, "chat.read");
    const conversation = await conversationRepository.findByIdForOrg(
      context.organization.id,
      conversationId,
    );
    if (!conversation) {
      throw new ChatServiceError("Conversation not found.", "NOT_FOUND");
    }
    await conversationRepository.ensureParticipant({
      organizationId: context.organization.id,
      conversationId,
      userId,
      role: "AGENT",
    });
    const unreadCount = await conversationRepository.countUnread(
      context.organization.id,
      conversationId,
      userId,
    );
    return { ...toPublicConversation(conversation), unreadCount };
  },

  async create(
    userId: string,
    input: {
      customerId: string;
      ticketId?: string | null;
      subject?: string | null;
      assignedAgentId?: string | null;
    },
  ) {
    const context = await requireChatPermission(userId, "chat.create");
    const organizationId = context.organization.id;

    const rate = await checkRateLimit(`chat:create:${userId}`, 20, 60_000);
    if (!rate.allowed) {
      throw new ChatServiceError("Too many conversations created.", "RATE_LIMITED");
    }

    const customer = await customerRepository.findByIdForOrg(
      organizationId,
      input.customerId,
    );
    if (!customer) {
      throw new ChatServiceError("Customer not found.", "NOT_FOUND");
    }

    if (input.ticketId) {
      const ticket = await ticketRepository.findByIdForOrg(organizationId, input.ticketId);
      if (!ticket || ticket.organizationId !== organizationId) {
        throw new ChatServiceError("Ticket not found.", "NOT_FOUND");
      }
      if (ticket.customerId !== input.customerId) {
        throw new ChatServiceError(
          "Ticket does not belong to this customer.",
          "VALIDATION",
        );
      }
      const existing = await conversationRepository.findByTicket(
        organizationId,
        input.ticketId,
      );
      if (existing) {
        return toPublicConversation(
          (await conversationRepository.findByIdForOrg(organizationId, existing.id))!,
        );
      }
    }

    if (input.assignedAgentId) {
      const membership = await organizationRepository.findActiveMembership(
        input.assignedAgentId,
        organizationId,
      );
      if (!membership) {
        throw new ChatServiceError("Assignee is not a member.", "VALIDATION");
      }
    }

    const conversation = await conversationRepository.create({
      organizationId,
      customerId: input.customerId,
      ticketId: input.ticketId,
      subject: input.subject ?? customer.name,
      assignedAgentId: input.assignedAgentId,
      creatorUserId: userId,
    });

    return toPublicConversation(
      (await conversationRepository.findByIdForOrg(organizationId, conversation.id))!,
    );
  },

  async getOrCreateForTicket(userId: string, ticketId: string) {
    const context = await requireChatPermission(userId, "chat.create");
    const organizationId = context.organization.id;
    const ticket = await ticketRepository.findByIdForOrg(organizationId, ticketId);
    if (!ticket || ticket.organizationId !== organizationId) {
      throw new ChatServiceError("Ticket not found.", "NOT_FOUND");
    }

    const existing = await conversationRepository.findByTicket(organizationId, ticketId);
    if (existing) {
      return this.get(userId, existing.id);
    }

    return this.create(userId, {
      customerId: ticket.customerId,
      ticketId: ticket.id,
      subject: ticket.subject,
      assignedAgentId: ticket.assigneeId,
    });
  },

  async listForCustomer(userId: string, customerId: string) {
    const context = await requireChatPermission(userId, "chat.read");
    const customer = await customerRepository.findByIdForOrg(
      context.organization.id,
      customerId,
    );
    if (!customer) {
      throw new ChatServiceError("Customer not found.", "NOT_FOUND");
    }
    const items = await conversationRepository.listForCustomer(
      context.organization.id,
      customerId,
    );
    return items.map((item) => toPublicConversation(item as never));
  },

  async listMessages(
    userId: string,
    conversationId: string,
    input: { cursor?: string; limit?: number },
  ) {
    const context = await requireChatPermission(userId, "chat.read");
    const conversation = await conversationRepository.findByIdForOrg(
      context.organization.id,
      conversationId,
    );
    if (!conversation) {
      throw new ChatServiceError("Conversation not found.", "NOT_FOUND");
    }

    const result = await conversationRepository.listMessages({
      organizationId: context.organization.id,
      conversationId,
      cursor: input.cursor,
      take: Math.min(input.limit ?? 50, 100),
    });

    return {
      items: result.items.map((message) => toPublicMessage(message as never)),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  },

  async sendMessage(
    userId: string,
    input: { conversationId: string; body: string; clientMessageId: string },
  ) {
    const context = await requireChatPermission(userId, "chat.update");
    const organizationId = context.organization.id;

    const rate = await checkRateLimit(`chat:message:${userId}`, 60, 60_000);
    if (!rate.allowed) {
      throw new ChatServiceError("Too many messages.", "RATE_LIMITED");
    }

    const conversation = await conversationRepository.findByIdForOrg(
      organizationId,
      input.conversationId,
    );
    if (!conversation) {
      throw new ChatServiceError("Conversation not found.", "NOT_FOUND");
    }

    await conversationRepository.ensureParticipant({
      organizationId,
      conversationId: input.conversationId,
      userId,
    });

    const { message, created } = await conversationRepository.createMessage({
      organizationId,
      conversationId: input.conversationId,
      senderUserId: userId,
      clientMessageId: input.clientMessageId,
      body: input.body,
    });

    const full = await conversationRepository.findMessage(organizationId, message.id);
    return {
      message: toPublicMessage(full!),
      created,
      conversationId: input.conversationId,
      organizationId,
    };
  },

  async markRead(userId: string, input: { conversationId: string; messageId: string }) {
    const context = await requireChatPermission(userId, "chat.read");
    const conversation = await conversationRepository.findByIdForOrg(
      context.organization.id,
      input.conversationId,
    );
    if (!conversation) {
      throw new ChatServiceError("Conversation not found.", "NOT_FOUND");
    }

    await conversationRepository.ensureParticipant({
      organizationId: context.organization.id,
      conversationId: input.conversationId,
      userId,
    });

    const message = await conversationRepository.markRead({
      organizationId: context.organization.id,
      conversationId: input.conversationId,
      userId,
      messageId: input.messageId,
    });
    if (!message) {
      throw new ChatServiceError("Message not found.", "NOT_FOUND");
    }

    const unreadCount = await conversationRepository.countUnread(
      context.organization.id,
      input.conversationId,
      userId,
    );

    return {
      conversationId: input.conversationId,
      messageId: input.messageId,
      unreadCount,
      organizationId: context.organization.id,
      userId,
    };
  },

  async assign(userId: string, input: { conversationId: string; assigneeId: string | null }) {
    const context = await requireChatPermission(userId, "chat.assign");
    const organizationId = context.organization.id;
    const conversation = await conversationRepository.findByIdForOrg(
      organizationId,
      input.conversationId,
    );
    if (!conversation) {
      throw new ChatServiceError("Conversation not found.", "NOT_FOUND");
    }

    if (input.assigneeId) {
      const membership = await organizationRepository.findActiveMembership(
        input.assigneeId,
        organizationId,
      );
      if (!membership) {
        throw new ChatServiceError("Assignee is not a member.", "VALIDATION");
      }
      await conversationRepository.ensureParticipant({
        organizationId,
        conversationId: input.conversationId,
        userId: input.assigneeId,
      });
    }

    const updated = await conversationRepository.update(organizationId, input.conversationId, {
      assignedAgentId: input.assigneeId,
    });

    await conversationRepository.createActivity({
      organizationId,
      conversationId: input.conversationId,
      actorId: userId,
      type: input.assigneeId ? "ASSIGNED" : "UNASSIGNED",
      message: input.assigneeId ? "Conversation assigned" : "Conversation unassigned",
      metadata: { assigneeId: input.assigneeId },
    });

    return toPublicConversation(updated!);
  },

  async updateStatus(
    userId: string,
    conversationId: string,
    status: "OPEN" | "PENDING" | "RESOLVED" | "CLOSED",
  ) {
    const context = await requireChatPermission(userId, "chat.update");
    const organizationId = context.organization.id;
    const conversation = await conversationRepository.findByIdForOrg(
      organizationId,
      conversationId,
    );
    if (!conversation) {
      throw new ChatServiceError("Conversation not found.", "NOT_FOUND");
    }

    const updated = await conversationRepository.update(organizationId, conversationId, {
      status,
      closedAt: status === "CLOSED" || status === "RESOLVED" ? new Date() : null,
    });

    await conversationRepository.createActivity({
      organizationId,
      conversationId,
      actorId: userId,
      type: "STATUS_CHANGED",
      message: `Status changed to ${status}`,
      metadata: { status },
    });

    return toPublicConversation(updated!);
  },

  async editMessage(
    userId: string,
    input: { conversationId: string; messageId: string; body: string },
  ) {
    const context = await requireChatPermission(userId, "chat.update");
    const message = await conversationRepository.findMessage(
      context.organization.id,
      input.messageId,
    );
    if (!message || message.conversationId !== input.conversationId) {
      throw new ChatServiceError("Message not found.", "NOT_FOUND");
    }
    if (message.senderUserId !== userId) {
      throw new AuthorizationError("You can only edit your own messages.", "FORBIDDEN");
    }

    const updated = await conversationRepository.editMessage(
      context.organization.id,
      input.messageId,
      input.body,
    );
    return {
      message: toPublicMessage(updated!),
      organizationId: context.organization.id,
    };
  },

  async deleteMessage(
    userId: string,
    input: { conversationId: string; messageId: string },
  ) {
    const context = await requireChatPermission(userId, "chat.update");
    const message = await conversationRepository.findMessage(
      context.organization.id,
      input.messageId,
    );
    if (!message || message.conversationId !== input.conversationId) {
      throw new ChatServiceError("Message not found.", "NOT_FOUND");
    }
    if (message.senderUserId !== userId) {
      throw new AuthorizationError("You can only delete your own messages.", "FORBIDDEN");
    }

    const updated = await conversationRepository.softDeleteMessage(
      context.organization.id,
      input.messageId,
    );
    return {
      message: toPublicMessage(updated!),
      organizationId: context.organization.id,
    };
  },

  async assertCanJoin(userId: string, conversationId: string) {
    const context = await requireChatPermission(userId, "chat.read");
    const conversation = await conversationRepository.findByIdForOrg(
      context.organization.id,
      conversationId,
    );
    if (!conversation) {
      throw new ChatServiceError("Conversation not found.", "NOT_FOUND");
    }
    await conversationRepository.ensureParticipant({
      organizationId: context.organization.id,
      conversationId,
      userId,
    });
    return {
      organizationId: context.organization.id,
      conversationId,
      userId,
      role: context.role,
    };
  },

  async unreadCounts(userId: string) {
    const context = await requireChatPermission(userId, "chat.read");
    return conversationRepository.unreadCountsForUser(context.organization.id, userId);
  },
};
