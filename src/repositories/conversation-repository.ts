import type {
  ChatMessage,
  Conversation,
  ConversationParticipant,
  ConversationStatus,
  Prisma,
} from "@/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";

export type ConversationListFilters = {
  organizationId: string;
  q?: string;
  status?: ConversationStatus;
  customerId?: string;
  ticketId?: string;
  assignedAgentId?: string | null;
  skip: number;
  take: number;
};

const conversationListInclude = {
  customer: {
    select: {
      id: true,
      name: true,
      email: true,
      company: true,
      image: true,
      status: true,
    },
  },
  ticket: {
    select: {
      id: true,
      numberKey: true,
      subject: true,
      status: true,
      priority: true,
    },
  },
  assignedAgent: {
    select: { id: true, name: true, email: true, image: true },
  },
  _count: {
    select: { messages: true, participants: true },
  },
} satisfies Prisma.ConversationInclude;

export const conversationRepository = {
  async create(data: {
    organizationId: string;
    customerId: string;
    ticketId?: string | null;
    subject?: string | null;
    assignedAgentId?: string | null;
    creatorUserId: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.create({
        data: {
          organizationId: data.organizationId,
          customerId: data.customerId,
          ticketId: data.ticketId ?? null,
          subject: data.subject ?? null,
          assignedAgentId: data.assignedAgentId ?? null,
          status: "OPEN",
        },
        include: conversationListInclude,
      });

      await tx.conversationParticipant.create({
        data: {
          organizationId: data.organizationId,
          conversationId: conversation.id,
          userId: data.creatorUserId,
          role: "AGENT",
        },
      });

      if (data.assignedAgentId && data.assignedAgentId !== data.creatorUserId) {
        await tx.conversationParticipant.create({
          data: {
            organizationId: data.organizationId,
            conversationId: conversation.id,
            userId: data.assignedAgentId,
            role: "AGENT",
          },
        });
      }

      await tx.conversationActivity.create({
        data: {
          organizationId: data.organizationId,
          conversationId: conversation.id,
          actorId: data.creatorUserId,
          type: "CONVERSATION_CREATED",
          message: "Conversation created",
          metadata: {
            customerId: data.customerId,
            ticketId: data.ticketId ?? null,
          },
        },
      });

      return conversation;
    });
  },

  async findByIdForOrg(organizationId: string, conversationId: string) {
    return prisma.conversation.findFirst({
      where: { id: conversationId, organizationId },
      include: {
        ...conversationListInclude,
        participants: {
          where: { leftAt: null },
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
      },
    });
  },

  async findByTicket(organizationId: string, ticketId: string) {
    return prisma.conversation.findFirst({
      where: { organizationId, ticketId },
      include: conversationListInclude,
    });
  },

  async list(filters: ConversationListFilters) {
    const where: Prisma.ConversationWhereInput = {
      organizationId: filters.organizationId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.ticketId ? { ticketId: filters.ticketId } : {}),
      ...(filters.assignedAgentId === null
        ? { assignedAgentId: null }
        : filters.assignedAgentId
          ? { assignedAgentId: filters.assignedAgentId }
          : {}),
      ...(filters.q
        ? {
            OR: [
              { subject: { contains: filters.q, mode: "insensitive" } },
              { lastMessagePreview: { contains: filters.q, mode: "insensitive" } },
              { customer: { name: { contains: filters.q, mode: "insensitive" } } },
              { customer: { email: { contains: filters.q, mode: "insensitive" } } },
              { ticket: { numberKey: { contains: filters.q.toUpperCase(), mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: conversationListInclude,
        orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
        skip: filters.skip,
        take: filters.take,
      }),
      prisma.conversation.count({ where }),
    ]);

    return { items, total };
  },

  async listForCustomer(organizationId: string, customerId: string, take = 20) {
    return prisma.conversation.findMany({
      where: { organizationId, customerId },
      include: conversationListInclude,
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      take,
    });
  },

  async update(
    organizationId: string,
    conversationId: string,
    data: Prisma.ConversationUncheckedUpdateManyInput,
  ) {
    await prisma.conversation.updateMany({
      where: { id: conversationId, organizationId },
      data,
    });
    return this.findByIdForOrg(organizationId, conversationId);
  },

  async ensureParticipant(data: {
    organizationId: string;
    conversationId: string;
    userId: string;
    role?: "AGENT" | "VIEWER";
  }) {
    return prisma.conversationParticipant.upsert({
      where: {
        conversationId_userId: {
          conversationId: data.conversationId,
          userId: data.userId,
        },
      },
      create: {
        organizationId: data.organizationId,
        conversationId: data.conversationId,
        userId: data.userId,
        role: data.role ?? "AGENT",
      },
      update: {
        leftAt: null,
        role: data.role ?? "AGENT",
      },
    });
  },

  async findParticipant(conversationId: string, userId: string) {
    return prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
    });
  },

  async createMessage(data: {
    organizationId: string;
    conversationId: string;
    senderUserId: string;
    clientMessageId: string;
    body: string;
    type?: "TEXT" | "SYSTEM";
  }): Promise<{ message: ChatMessage; created: boolean }> {
    try {
      const message = await prisma.$transaction(async (tx) => {
        const created = await tx.chatMessage.create({
          data: {
            organizationId: data.organizationId,
            conversationId: data.conversationId,
            senderUserId: data.senderUserId,
            clientMessageId: data.clientMessageId,
            body: data.body,
            type: data.type ?? "TEXT",
          },
        });

        const preview = data.body.slice(0, 280);
        await tx.conversation.update({
          where: { id: data.conversationId },
          data: {
            lastMessageAt: created.createdAt,
            lastMessagePreview: preview,
            updatedAt: new Date(),
          },
        });

        await tx.conversationActivity.create({
          data: {
            organizationId: data.organizationId,
            conversationId: data.conversationId,
            actorId: data.senderUserId,
            type: "MESSAGE_SENT",
            message: "Message sent",
            metadata: { messageId: created.id },
          },
        });

        return created;
      });
      return { message, created: true };
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "P2002"
      ) {
        const existing = await prisma.chatMessage.findUnique({
          where: {
            conversationId_clientMessageId: {
              conversationId: data.conversationId,
              clientMessageId: data.clientMessageId,
            },
          },
        });
        if (existing) return { message: existing, created: false };
      }
      throw error;
    }
  },

  async listMessages(params: {
    organizationId: string;
    conversationId: string;
    cursor?: string;
    take: number;
  }) {
    let cursorCreatedAt: Date | undefined;
    if (params.cursor) {
      const cursorMessage = await prisma.chatMessage.findFirst({
        where: {
          id: params.cursor,
          conversationId: params.conversationId,
          organizationId: params.organizationId,
        },
        select: { createdAt: true },
      });
      cursorCreatedAt = cursorMessage?.createdAt;
    }

    const messages = await prisma.chatMessage.findMany({
      where: {
        organizationId: params.organizationId,
        conversationId: params.conversationId,
        deletedAt: null,
        ...(cursorCreatedAt ? { createdAt: { lt: cursorCreatedAt } } : {}),
      },
      include: {
        sender: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
      take: params.take + 1,
    });

    const hasMore = messages.length > params.take;
    const items = hasMore ? messages.slice(0, params.take) : messages;
    const chronological = items.reverse();
    return {
      items: chronological,
      nextCursor: hasMore ? chronological[0]?.id ?? null : null,
      hasMore,
    };
  },

  async findMessage(organizationId: string, messageId: string) {
    return prisma.chatMessage.findFirst({
      where: { id: messageId, organizationId },
      include: {
        sender: { select: { id: true, name: true, email: true, image: true } },
      },
    });
  },

  async softDeleteMessage(organizationId: string, messageId: string) {
    await prisma.chatMessage.updateMany({
      where: { id: messageId, organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return this.findMessage(organizationId, messageId);
  },

  async editMessage(organizationId: string, messageId: string, body: string) {
    await prisma.chatMessage.updateMany({
      where: { id: messageId, organizationId, deletedAt: null },
      data: { body, editedAt: new Date() },
    });
    return this.findMessage(organizationId, messageId);
  },

  async markRead(params: {
    organizationId: string;
    conversationId: string;
    userId: string;
    messageId: string;
  }) {
    const message = await prisma.chatMessage.findFirst({
      where: {
        id: params.messageId,
        conversationId: params.conversationId,
        organizationId: params.organizationId,
      },
    });
    if (!message) return null;

    await prisma.$transaction([
      prisma.messageReadState.upsert({
        where: {
          messageId_userId: {
            messageId: params.messageId,
            userId: params.userId,
          },
        },
        create: {
          organizationId: params.organizationId,
          messageId: params.messageId,
          userId: params.userId,
        },
        update: { readAt: new Date() },
      }),
      prisma.conversationParticipant.updateMany({
        where: {
          conversationId: params.conversationId,
          userId: params.userId,
        },
        data: {
          lastReadAt: message.createdAt,
          lastReadMessageId: message.id,
        },
      }),
    ]);

    return message;
  },

  async countUnread(organizationId: string, conversationId: string, userId: string) {
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
    });

    return prisma.chatMessage.count({
      where: {
        organizationId,
        conversationId,
        deletedAt: null,
        senderUserId: { not: userId },
        ...(participant?.lastReadAt
          ? { createdAt: { gt: participant.lastReadAt } }
          : {}),
      },
    });
  },

  async unreadCountsForUser(organizationId: string, userId: string) {
    const conversations = await prisma.conversation.findMany({
      where: { organizationId },
      select: {
        id: true,
        participants: {
          where: { userId },
          select: { lastReadAt: true },
        },
      },
      take: 200,
      orderBy: { lastMessageAt: "desc" },
    });

    const counts: Record<string, number> = {};
    await Promise.all(
      conversations.map(async (conversation) => {
        const lastReadAt = conversation.participants[0]?.lastReadAt;
        const count = await prisma.chatMessage.count({
          where: {
            organizationId,
            conversationId: conversation.id,
            deletedAt: null,
            senderUserId: { not: userId },
            ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
          },
        });
        if (count > 0) counts[conversation.id] = count;
      }),
    );
    return counts;
  },

  async createActivity(data: {
    organizationId: string;
    conversationId: string;
    actorId?: string | null;
    type: Prisma.ConversationActivityCreateInput["type"];
    message?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return prisma.conversationActivity.create({
      data: {
        organizationId: data.organizationId,
        conversationId: data.conversationId,
        actorId: data.actorId ?? null,
        type: data.type,
        message: data.message,
        metadata: data.metadata,
      },
    });
  },
};

export type ConversationListItem = Conversation & {
  customer: {
    id: string;
    name: string;
    email: string;
    company: string | null;
    image: string | null;
    status: string;
  };
  ticket: {
    id: string;
    numberKey: string;
    subject: string;
    status: string;
    priority: string;
  } | null;
  assignedAgent: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
  _count: { messages: number; participants: number };
};

export type ParticipantRow = ConversationParticipant;
