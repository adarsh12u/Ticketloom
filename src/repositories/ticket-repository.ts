import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { formatTicketNumber } from "@/lib/tickets/ticket-number";
import { slugify } from "@/lib/utils/slug";

const ticketListInclude = {
  customer: {
    select: { id: true, name: true, email: true, company: true },
  },
  assignee: {
    select: { id: true, name: true, email: true, image: true, firstName: true, lastName: true },
  },
  createdBy: {
    select: { id: true, name: true, email: true, image: true, firstName: true, lastName: true },
  },
  team: {
    select: { id: true, name: true, slug: true },
  },
  tags: {
    include: {
      tag: true,
    },
  },
} satisfies Prisma.TicketInclude;

const ticketDetailInclude = {
  ...ticketListInclude,
  messages: {
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  activities: {
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { createdAt: "desc" as const },
    take: 100,
  },
} satisfies Prisma.TicketInclude;

export type TicketListFilters = {
  organizationId: string;
  q?: string;
  status?: Prisma.EnumTicketStatusFilter["equals"];
  priority?: Prisma.EnumTicketPriorityFilter["equals"];
  assigneeId?: string;
  customerId?: string;
  teamId?: string;
  tagId?: string;
  createdFrom?: Date;
  createdTo?: Date;
  includeArchived?: boolean;
  sortBy: "createdAt" | "updatedAt" | "priority" | "status" | "number" | "dueAt";
  sortDir: "asc" | "desc";
  skip: number;
  take: number;
};

export const ticketRepository = {
  async nextTicketNumber(organizationId: string, tx: Prisma.TransactionClient = prisma) {
    const rows = await tx.$queryRaw<Array<{ last_number: number }>>`
      INSERT INTO ticket_counters (organization_id, last_number)
      VALUES (${organizationId}, 1)
      ON CONFLICT (organization_id)
      DO UPDATE SET last_number = ticket_counters.last_number + 1
      RETURNING last_number
    `;
    const number = rows[0]?.last_number;
    if (!number || number < 1) {
      throw new Error("Failed to allocate ticket number");
    }
    return {
      number,
      numberKey: formatTicketNumber(number),
    };
  },

  async findByIdForOrg(organizationId: string, ticketId: string) {
    return prisma.ticket.findFirst({
      where: { id: ticketId, organizationId },
      include: ticketDetailInclude,
    });
  },

  async findByNumberKeyForOrg(organizationId: string, numberKey: string) {
    return prisma.ticket.findFirst({
      where: { organizationId, numberKey },
      include: ticketDetailInclude,
    });
  },

  async list(filters: TicketListFilters) {
    const where: Prisma.TicketWhereInput = {
      organizationId: filters.organizationId,
      ...(filters.includeArchived ? {} : { archivedAt: null }),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.teamId ? { teamId: filters.teamId } : {}),
      ...(filters.tagId ? { tags: { some: { tagId: filters.tagId } } } : {}),
      ...(filters.createdFrom || filters.createdTo
        ? {
            createdAt: {
              ...(filters.createdFrom ? { gte: filters.createdFrom } : {}),
              ...(filters.createdTo ? { lte: filters.createdTo } : {}),
            },
          }
        : {}),
      ...(filters.q
        ? {
            OR: [
              { numberKey: { contains: filters.q.toUpperCase(), mode: "insensitive" } },
              { subject: { contains: filters.q, mode: "insensitive" } },
              { customer: { name: { contains: filters.q, mode: "insensitive" } } },
              { customer: { email: { contains: filters.q, mode: "insensitive" } } },
              { customer: { company: { contains: filters.q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.TicketOrderByWithRelationInput = {
      [filters.sortBy]: filters.sortDir,
    };

    const [items, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: ticketListInclude,
        orderBy,
        skip: filters.skip,
        take: filters.take,
      }),
      prisma.ticket.count({ where }),
    ]);

    return { items, total };
  },

  async createWithRelations(params: {
    organizationId: string;
    subject: string;
    description: string;
    status: Prisma.TicketCreateInput["status"];
    priority: Prisma.TicketCreateInput["priority"];
    type: Prisma.TicketCreateInput["type"];
    customerId: string;
    createdById: string;
    assigneeId?: string | null;
    teamId?: string | null;
    tagIds?: string[];
    dueAt?: Date | null;
    firstResponseDueAt?: Date | null;
    resolutionDueAt?: Date | null;
  }) {
    return prisma.$transaction(async (tx) => {
      const { number, numberKey } = await ticketRepository.nextTicketNumber(
        params.organizationId,
        tx,
      );

      const ticket = await tx.ticket.create({
        data: {
          organizationId: params.organizationId,
          number,
          numberKey,
          subject: params.subject,
          description: params.description,
          status: params.status ?? "OPEN",
          priority: params.priority ?? "MEDIUM",
          type: params.type ?? "QUESTION",
          customerId: params.customerId,
          createdById: params.createdById,
          assigneeId: params.assigneeId ?? null,
          teamId: params.teamId ?? null,
          dueAt: params.dueAt ?? null,
          firstResponseDueAt: params.firstResponseDueAt ?? null,
          resolutionDueAt: params.resolutionDueAt ?? null,
          ...(params.tagIds?.length
            ? {
                tags: {
                  create: params.tagIds.map((tagId) => ({ tagId })),
                },
              }
            : {}),
        },
      });

      await tx.ticketActivity.create({
        data: {
          organizationId: params.organizationId,
          ticketId: ticket.id,
          actorId: params.createdById,
          type: "TICKET_CREATED",
          message: `Ticket ${numberKey} created`,
          metadata: {
            numberKey,
            status: ticket.status,
            priority: ticket.priority,
          },
        },
      });

      if (params.assigneeId) {
        await tx.ticketActivity.create({
          data: {
            organizationId: params.organizationId,
            ticketId: ticket.id,
            actorId: params.createdById,
            type: "ASSIGNED",
            message: "Ticket assigned",
            metadata: { assigneeId: params.assigneeId },
          },
        });
      }

      return tx.ticket.findFirstOrThrow({
        where: { id: ticket.id, organizationId: params.organizationId },
        include: ticketDetailInclude,
      });
    });
  },

  async update(ticketId: string, organizationId: string, data: Prisma.TicketUpdateInput) {
    return prisma.ticket.update({
      where: { id: ticketId },
      data,
      include: ticketDetailInclude,
    }).then(async (ticket) => {
      if (ticket.organizationId !== organizationId) {
        throw new Error("Ticket organization mismatch");
      }
      return ticket;
    });
  },

  async replaceTags(ticketId: string, organizationId: string, tagIds: string[]) {
    return prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: { id: ticketId, organizationId },
        include: { tags: true },
      });
      if (!ticket) return null;

      const previous = new Set(ticket.tags.map((row) => row.tagId));
      const next = new Set(tagIds);

      await tx.ticketTag.deleteMany({ where: { ticketId } });
      if (tagIds.length) {
        await tx.ticketTag.createMany({
          data: tagIds.map((tagId) => ({ ticketId, tagId })),
        });
      }

      return {
        added: [...next].filter((id) => !previous.has(id)),
        removed: [...previous].filter((id) => !next.has(id)),
      };
    });
  },

  async createActivity(data: {
    organizationId: string;
    ticketId: string;
    actorId: string | null;
    type: Prisma.TicketActivityCreateInput["type"];
    message?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return prisma.ticketActivity.create({
      data: {
        organizationId: data.organizationId,
        ticketId: data.ticketId,
        actorId: data.actorId,
        type: data.type,
        message: data.message,
        metadata: data.metadata,
      },
    });
  },

  async createMessage(data: {
    organizationId: string;
    ticketId: string;
    authorId: string;
    body: string;
    visibility: "INTERNAL" | "CUSTOMER";
  }) {
    return prisma.$transaction(async (tx) => {
      const message = await tx.ticketMessage.create({
        data: {
          organizationId: data.organizationId,
          ticketId: data.ticketId,
          authorId: data.authorId,
          body: data.body,
          visibility: data.visibility,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      await tx.ticketActivity.create({
        data: {
          organizationId: data.organizationId,
          ticketId: data.ticketId,
          actorId: data.authorId,
          type: data.visibility === "INTERNAL" ? "INTERNAL_NOTE_ADDED" : "REPLY_ADDED",
          message:
            data.visibility === "INTERNAL"
              ? "Internal note added"
              : "Customer-visible reply added",
          metadata: { messageId: message.id, visibility: data.visibility },
        },
      });

      if (data.visibility === "CUSTOMER") {
        await tx.ticket.updateMany({
          where: {
            id: data.ticketId,
            organizationId: data.organizationId,
            firstRespondedAt: null,
          },
          data: { firstRespondedAt: new Date() },
        });
      }

      return message;
    });
  },

  async findCustomer(organizationId: string, customerId: string) {
    return prisma.customer.findFirst({
      where: { id: customerId, organizationId },
    });
  },

  async upsertCustomer(
    organizationId: string,
    input: { name: string; email: string; company?: string | null; phone?: string | null },
    actorId?: string,
  ) {
    const { customerRepository } = await import("@/repositories/customer-repository");
    return customerRepository.upsertForTicket(organizationId, input, actorId);
  },

  async listCustomers(organizationId: string, q?: string) {
    const { customerRepository } = await import("@/repositories/customer-repository");
    const result = await customerRepository.list({
      organizationId,
      q,
      includeArchived: false,
      sort: "alphabetical",
      skip: 0,
      take: 50,
    });
    return result.items;
  },

  async findTeam(organizationId: string, teamId: string) {
    return prisma.team.findFirst({ where: { id: teamId, organizationId } });
  },

  async listTeams(organizationId: string) {
    return prisma.team.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
  },

  async createTeam(organizationId: string, name: string, description?: string | null) {
    const base = slugify(name);
    let slug = base;
    let attempt = 0;
    while (attempt < 10) {
      try {
        return await prisma.team.create({
          data: {
            organizationId,
            name,
            slug,
            description: description ?? null,
          },
        });
      } catch {
        attempt += 1;
        slug = `${base}-${attempt + 1}`;
      }
    }
    return prisma.team.create({
      data: {
        organizationId,
        name,
        slug: `${base}-${Date.now().toString(36)}`,
        description: description ?? null,
      },
    });
  },

  async listTags(organizationId: string) {
    return prisma.tag.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
  },

  async findTagsInOrg(organizationId: string, tagIds: string[]) {
    if (!tagIds.length) return [];
    return prisma.tag.findMany({
      where: { organizationId, id: { in: tagIds } },
    });
  },

  async createTag(organizationId: string, name: string, color?: string | null) {
    const base = slugify(name);
    let slug = base;
    let attempt = 0;
    while (attempt < 10) {
      try {
        return await prisma.tag.create({
          data: { organizationId, name, slug, color: color ?? null },
        });
      } catch {
        attempt += 1;
        slug = `${base}-${attempt + 1}`;
      }
    }
    return prisma.tag.create({
      data: {
        organizationId,
        name,
        slug: `${base}-${Date.now().toString(36)}`,
        color: color ?? null,
      },
    });
  },

  async assertAssigneeMembership(organizationId: string, userId: string) {
    return prisma.membership.findFirst({
      where: {
        organizationId,
        userId,
        status: "ACTIVE",
      },
    });
  },
};
