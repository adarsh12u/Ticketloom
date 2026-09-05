import type {
  Prisma,
  TicketActivityType,
  TicketPriority,
  TicketStatus,
} from "@/generated/prisma/client";

import {
  requireOrganizationContext,
  requirePermission,
} from "@/lib/authz";
import { AuthorizationError } from "@/lib/authz/errors";
import { computeSlaDeadlines } from "@/lib/tickets/ticket-number";
import { cacheGetOrSet } from "@/lib/redis/cache";
import { CACHE_TTL, cacheKeys } from "@/lib/redis/keys";
import {
  invalidateCustomerCaches,
  invalidateTicketCaches,
} from "@/lib/redis/invalidation";
import type {
  CreateTicketInput,
  CreateTicketMessageInput,
  ListTicketsInput,
  UpdateTicketInput,
} from "@/lib/validations/ticket";
import { ticketRepository } from "@/repositories/ticket-repository";
import { organizationRepository } from "@/repositories/organization-repository";

export class TicketServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NOT_FOUND"
      | "VALIDATION"
      | "FORBIDDEN"
      | "INVALID_ASSIGNEE"
      | "INVALID_CUSTOMER"
      | "INVALID_TEAM"
      | "INVALID_TAG" = "VALIDATION",
  ) {
    super(message);
    this.name = "TicketServiceError";
  }
}

function toPublicTicket(ticket: Awaited<ReturnType<typeof ticketRepository.findByIdForOrg>>) {
  if (!ticket) return null;
  return {
    id: ticket.id,
    organizationId: ticket.organizationId,
    number: ticket.number,
    numberKey: ticket.numberKey,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    type: ticket.type,
    dueAt: ticket.dueAt,
    firstResponseDueAt: ticket.firstResponseDueAt,
    resolutionDueAt: ticket.resolutionDueAt,
    firstRespondedAt: ticket.firstRespondedAt,
    resolvedAt: ticket.resolvedAt,
    closedAt: ticket.closedAt,
    archivedAt: ticket.archivedAt,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    customer: ticket.customer,
    assignee: ticket.assignee,
    createdBy: ticket.createdBy,
    team: ticket.team,
    tags: ticket.tags.map((row) => row.tag),
    messages: ticket.messages,
    activities: ticket.activities,
  };
}

function toListItem(ticket: Awaited<ReturnType<typeof ticketRepository.list>>["items"][number]) {
  return {
    id: ticket.id,
    number: ticket.number,
    numberKey: ticket.numberKey,
    subject: ticket.subject,
    status: ticket.status,
    priority: ticket.priority,
    type: ticket.type,
    dueAt: ticket.dueAt,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    archivedAt: ticket.archivedAt,
    customer: ticket.customer,
    assignee: ticket.assignee,
    team: ticket.team,
    tags: ticket.tags.map((row) => row.tag),
  };
}

async function requireTicketPermission(
  userId: string,
  permission:
    | "tickets.read"
    | "tickets.create"
    | "tickets.update"
    | "tickets.delete"
    | "tickets.assign",
) {
  const context = await requireOrganizationContext(userId);
  requirePermission(context.role, permission);
  return context;
}

async function loadTicketOrThrow(organizationId: string, ticketId: string) {
  const ticket = await ticketRepository.findByIdForOrg(organizationId, ticketId);
  if (!ticket || ticket.organizationId !== organizationId) {
    throw new TicketServiceError("Ticket not found.", "NOT_FOUND");
  }
  return ticket;
}

function statusTimestamps(status: TicketStatus, previous: TicketStatus) {
  const now = new Date();
  const data: {
    status: TicketStatus;
    resolvedAt?: Date | null;
    closedAt?: Date | null;
  } = { status };

  if (status === "RESOLVED" && previous !== "RESOLVED") {
    data.resolvedAt = now;
  }
  if (status === "CLOSED" && previous !== "CLOSED") {
    data.closedAt = now;
    if (previous !== "RESOLVED") {
      data.resolvedAt = now;
    }
  }
  if (status !== "RESOLVED" && status !== "CLOSED") {
    if (previous === "RESOLVED" || previous === "CLOSED") {
      data.resolvedAt = null;
      data.closedAt = null;
    }
  }
  return data;
}

export const ticketService = {
  async getMeta(userId: string) {
    const context = await requireTicketPermission(userId, "tickets.read");
    const organizationId = context.organization.id;

    const { value } = await cacheGetOrSet(
      organizationId,
      cacheKeys.ticketsMeta(organizationId),
      CACHE_TTL.ticketsMeta,
      async () => {
        const [customers, teams, tags, members] = await Promise.all([
          ticketRepository.listCustomers(organizationId),
          ticketRepository.listTeams(organizationId),
          ticketRepository.listTags(organizationId),
          organizationRepository.listMembers(organizationId),
        ]);

        return {
          customers: customers.map((customer) => ({
            id: customer.id,
            name: customer.name,
            email: customer.email,
          })),
          teams,
          tags,
          agents: members
            .filter((member) => member.status === "ACTIVE")
            .map((member) => ({
              id: member.user.id,
              name: member.user.name,
              email: member.user.email,
              role: member.role,
            })),
        };
      },
    );

    return value;
  },

  async list(userId: string, input: ListTicketsInput) {
    const context = await requireTicketPermission(userId, "tickets.read");
    const page = input.page;
    const pageSize = input.pageSize;
    const result = await ticketRepository.list({
      organizationId: context.organization.id,
      q: input.q,
      status: input.status,
      priority: input.priority,
      assigneeId: input.assigneeId,
      customerId: input.customerId,
      teamId: input.teamId,
      tagId: input.tagId,
      createdFrom: input.createdFrom,
      createdTo: input.createdTo,
      includeArchived: input.includeArchived,
      sortBy: input.sortBy,
      sortDir: input.sortDir,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items: result.items.map(toListItem),
      page,
      pageSize,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
    };
  },

  async get(userId: string, ticketId: string) {
    const context = await requireTicketPermission(userId, "tickets.read");
    const ticket = await loadTicketOrThrow(context.organization.id, ticketId);
    return toPublicTicket(ticket);
  },

  async create(userId: string, input: CreateTicketInput) {
    const context = await requireTicketPermission(userId, "tickets.create");
    const organizationId = context.organization.id;

    let customerId = input.customerId;
    if (customerId) {
      const existing = await ticketRepository.findCustomer(organizationId, customerId);
      if (!existing) {
        throw new TicketServiceError("Customer not found in this organization.", "INVALID_CUSTOMER");
      }
    } else if (input.customer) {
      const customer = await ticketRepository.upsertCustomer(
        organizationId,
        input.customer,
        userId,
      );
      customerId = customer.id;
    } else {
      throw new TicketServiceError("Customer is required.", "VALIDATION");
    }

    if (input.assigneeId) {
      const membership = await ticketRepository.assertAssigneeMembership(
        organizationId,
        input.assigneeId,
      );
      if (!membership) {
        throw new TicketServiceError(
          "Assignee must be an active organization member.",
          "INVALID_ASSIGNEE",
        );
      }
      requirePermission(context.role, "tickets.assign");
    }

    if (input.teamId) {
      const team = await ticketRepository.findTeam(organizationId, input.teamId);
      if (!team) {
        throw new TicketServiceError("Team not found in this organization.", "INVALID_TEAM");
      }
    }

    if (input.tagIds?.length) {
      const tags = await ticketRepository.findTagsInOrg(organizationId, input.tagIds);
      if (tags.length !== input.tagIds.length) {
        throw new TicketServiceError("One or more tags are invalid.", "INVALID_TAG");
      }
    }

    const priority = (input.priority ?? "MEDIUM") as TicketPriority;
    const sla =
      input.firstResponseDueAt || input.resolutionDueAt
        ? {
            firstResponseDueAt: input.firstResponseDueAt ?? null,
            resolutionDueAt: input.resolutionDueAt ?? null,
          }
        : computeSlaDeadlines(priority);

    const ticket = await ticketRepository.createWithRelations({
      organizationId,
      subject: input.subject,
      description: input.description,
      status: input.status ?? "OPEN",
      priority,
      type: input.type ?? "QUESTION",
      customerId: customerId!,
      createdById: userId,
      assigneeId: input.assigneeId ?? null,
      teamId: input.teamId ?? null,
      tagIds: input.tagIds,
      dueAt: input.dueAt ?? null,
      firstResponseDueAt: sla.firstResponseDueAt,
      resolutionDueAt: sla.resolutionDueAt,
    });

    const { customerRepository } = await import("@/repositories/customer-repository");
    await customerRepository.createActivity({
      organizationId,
      customerId: customerId!,
      actorId: userId,
      type: "TICKET_CREATED",
      message: `Ticket ${ticket.numberKey} created`,
      metadata: { ticketId: ticket.id, numberKey: ticket.numberKey },
    });

    await invalidateTicketCaches(organizationId, ticket.id);
    await invalidateCustomerCaches(organizationId, customerId!);

    return toPublicTicket(ticket);
  },

  async update(userId: string, ticketId: string, input: UpdateTicketInput) {
    const context = await requireTicketPermission(userId, "tickets.update");
    const organizationId = context.organization.id;
    const existing = await loadTicketOrThrow(organizationId, ticketId);

    if (input.assigneeId !== undefined) {
      requirePermission(context.role, "tickets.assign");
      if (input.assigneeId) {
        const membership = await ticketRepository.assertAssigneeMembership(
          organizationId,
          input.assigneeId,
        );
        if (!membership) {
          throw new TicketServiceError(
            "Assignee must be an active organization member.",
            "INVALID_ASSIGNEE",
          );
        }
      }
    }

    if (input.customerId) {
      const customer = await ticketRepository.findCustomer(organizationId, input.customerId);
      if (!customer) {
        throw new TicketServiceError("Customer not found in this organization.", "INVALID_CUSTOMER");
      }
    }

    if (input.teamId) {
      const team = await ticketRepository.findTeam(organizationId, input.teamId);
      if (!team) {
        throw new TicketServiceError("Team not found in this organization.", "INVALID_TEAM");
      }
    }

    if (input.tagIds) {
      const tags = await ticketRepository.findTagsInOrg(organizationId, input.tagIds);
      if (tags.length !== input.tagIds.length) {
        throw new TicketServiceError("One or more tags are invalid.", "INVALID_TAG");
      }
    }

    const activities: Array<{
      type: TicketActivityType;
      message: string;
      metadata?: Prisma.InputJsonValue;
    }> = [];

    const data: Parameters<typeof ticketRepository.update>[2] = {};

    if (input.subject && input.subject !== existing.subject) {
      data.subject = input.subject;
      activities.push({
        type: "SUBJECT_CHANGED",
        message: "Subject updated",
        metadata: { from: existing.subject, to: input.subject },
      });
    }

    if (input.description !== undefined) {
      data.description = input.description;
    }

    if (input.status && input.status !== existing.status) {
      Object.assign(data, statusTimestamps(input.status, existing.status));
      activities.push({
        type: "STATUS_CHANGED",
        message: `Status changed to ${input.status}`,
        metadata: { from: existing.status, to: input.status },
      });
    }

    if (input.priority && input.priority !== existing.priority) {
      data.priority = input.priority;
      activities.push({
        type: "PRIORITY_CHANGED",
        message: `Priority changed to ${input.priority}`,
        metadata: { from: existing.priority, to: input.priority },
      });
    }

    if (input.type && input.type !== existing.type) {
      data.type = input.type;
      activities.push({
        type: "TYPE_CHANGED",
        message: `Type changed to ${input.type}`,
        metadata: { from: existing.type, to: input.type },
      });
    }

    if (input.customerId && input.customerId !== existing.customerId) {
      data.customer = { connect: { id: input.customerId } };
      activities.push({
        type: "CUSTOMER_CHANGED",
        message: "Customer changed",
        metadata: { from: existing.customerId, to: input.customerId },
      });
    }

    if (input.assigneeId !== undefined && input.assigneeId !== existing.assigneeId) {
      if (input.assigneeId === null) {
        data.assignee = { disconnect: true };
        activities.push({ type: "UNASSIGNED", message: "Assignee cleared" });
      } else if (!existing.assigneeId) {
        data.assignee = { connect: { id: input.assigneeId } };
        activities.push({
          type: "ASSIGNED",
          message: "Ticket assigned",
          metadata: { assigneeId: input.assigneeId },
        });
      } else {
        data.assignee = { connect: { id: input.assigneeId } };
        activities.push({
          type: "REASSIGNED",
          message: "Ticket reassigned",
          metadata: { from: existing.assigneeId, to: input.assigneeId },
        });
      }
    }

    if (input.teamId !== undefined && input.teamId !== existing.teamId) {
      if (input.teamId === null) {
        data.team = { disconnect: true };
      } else {
        data.team = { connect: { id: input.teamId } };
      }
      activities.push({
        type: "TEAM_CHANGED",
        message: "Team updated",
        metadata: { from: existing.teamId, to: input.teamId },
      });
    }

    if (input.dueAt !== undefined) data.dueAt = input.dueAt;
    if (input.firstResponseDueAt !== undefined) {
      data.firstResponseDueAt = input.firstResponseDueAt;
    }
    if (input.resolutionDueAt !== undefined) {
      data.resolutionDueAt = input.resolutionDueAt;
    }

    if (Object.keys(data).length > 0) {
      await ticketRepository.update(ticketId, organizationId, data);
    }

    if (input.tagIds) {
      const changes = await ticketRepository.replaceTags(ticketId, organizationId, input.tagIds);
      if (changes) {
        for (const tagId of changes.added) {
          activities.push({
            type: "TAG_ADDED",
            message: "Tag added",
            metadata: { tagId },
          });
        }
        for (const tagId of changes.removed) {
          activities.push({
            type: "TAG_REMOVED",
            message: "Tag removed",
            metadata: { tagId },
          });
        }
      }
    }

    for (const activity of activities) {
      await ticketRepository.createActivity({
        organizationId,
        ticketId,
        actorId: userId,
        type: activity.type,
        message: activity.message,
        metadata: activity.metadata,
      });
    }

    if (input.status && input.status !== existing.status) {
      const { customerRepository } = await import("@/repositories/customer-repository");
      if (input.status === "RESOLVED") {
        await customerRepository.createActivity({
          organizationId,
          customerId: existing.customerId,
          actorId: userId,
          type: "TICKET_RESOLVED",
          message: `Ticket ${existing.numberKey} resolved`,
          metadata: { ticketId, numberKey: existing.numberKey },
        });
      }
      if (input.status === "CLOSED") {
        await customerRepository.createActivity({
          organizationId,
          customerId: existing.customerId,
          actorId: userId,
          type: "TICKET_CLOSED",
          message: `Ticket ${existing.numberKey} closed`,
          metadata: { ticketId, numberKey: existing.numberKey },
        });
      }
    }

    if (activities.length === 0 && Object.keys(data).length > 0) {
      await ticketRepository.createActivity({
        organizationId,
        ticketId,
        actorId: userId,
        type: "UPDATED",
        message: "Ticket updated",
      });
    }

    await invalidateTicketCaches(organizationId, ticketId);
    await invalidateCustomerCaches(organizationId, existing.customerId);

    return toPublicTicket(await loadTicketOrThrow(organizationId, ticketId));
  },

  async archive(userId: string, ticketId: string) {
    const context = await requireTicketPermission(userId, "tickets.delete");
    const organizationId = context.organization.id;
    const existing = await loadTicketOrThrow(organizationId, ticketId);

    if (existing.archivedAt) {
      return toPublicTicket(existing);
    }

    await ticketRepository.update(ticketId, organizationId, {
      archivedAt: new Date(),
    });
    await ticketRepository.createActivity({
      organizationId,
      ticketId,
      actorId: userId,
      type: "ARCHIVED",
      message: "Ticket archived",
    });

    await invalidateTicketCaches(organizationId, ticketId);
    await invalidateCustomerCaches(organizationId, existing.customerId);

    return toPublicTicket(await loadTicketOrThrow(organizationId, ticketId));
  },

  async addMessage(userId: string, ticketId: string, input: CreateTicketMessageInput) {
    const context = await requireTicketPermission(userId, "tickets.update");
    const organizationId = context.organization.id;
    await loadTicketOrThrow(organizationId, ticketId);

    const message = await ticketRepository.createMessage({
      organizationId,
      ticketId,
      authorId: userId,
      body: input.body,
      visibility: input.visibility,
    });

    return message;
  },

  async createCustomer(
    userId: string,
    input: { name: string; email: string; company?: string | null; phone?: string | null },
  ) {
    const { customerService } = await import("@/services/customer-service");
    return customerService.create(userId, {
      name: input.name,
      email: input.email,
      company: input.company,
      phone: input.phone,
    });
  },

  async createTeam(userId: string, input: { name: string; description?: string | null }) {
    const context = await requireOrganizationContext(userId);
    requirePermission(context.role, "organization.update");
    return ticketRepository.createTeam(
      context.organization.id,
      input.name,
      input.description,
    );
  },

  async createTag(userId: string, input: { name: string; color?: string | null }) {
    const context = await requireOrganizationContext(userId);
    requirePermission(context.role, "tickets.update");
    return ticketRepository.createTag(context.organization.id, input.name, input.color);
  },

  /** Used by tests and internal callers that already resolved org context incorrectly. */
  async assertOrgIsolation(userId: string, foreignOrganizationId: string, ticketId: string) {
    const context = await requireOrganizationContext(userId);
    if (context.organization.id === foreignOrganizationId) {
      throw new AuthorizationError("Unexpected same organization", "FORBIDDEN");
    }
    const ticket = await ticketRepository.findByIdForOrg(foreignOrganizationId, ticketId);
    if (ticket) {
      // Service getters always scope by the caller's org — simulating IDOR attempt
      const own = await ticketRepository.findByIdForOrg(context.organization.id, ticketId);
      if (own) {
        throw new TicketServiceError("Cross-tenant ticket leaked.", "FORBIDDEN");
      }
    }
    return true;
  },
};
