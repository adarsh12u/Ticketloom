import type { Prisma } from "@/generated/prisma/client";

import {
  requireOrganizationContext,
  requirePermission,
} from "@/lib/authz";
import { AuthorizationError } from "@/lib/authz/errors";
import { cacheGetOrSet } from "@/lib/redis/cache";
import { CACHE_TTL, cacheKeys } from "@/lib/redis/keys";
import { invalidateCustomerCaches } from "@/lib/redis/invalidation";
import {
  buildCustomerDisplayName,
  createCustomerSchema,
  type CreateCustomerInput,
  type ListCustomersInput,
  type UpdateCustomerInput,
} from "@/lib/validations/customer";
import { customerRepository } from "@/repositories/customer-repository";
import { ticketRepository } from "@/repositories/ticket-repository";

export class CustomerServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NOT_FOUND"
      | "VALIDATION"
      | "DUPLICATE_EMAIL"
      | "INVALID_TAG"
      | "FORBIDDEN" = "VALIDATION",
  ) {
    super(message);
    this.name = "CustomerServiceError";
  }
}

function toPublicCustomer(
  customer: NonNullable<Awaited<ReturnType<typeof customerRepository.findByIdForOrg>>>,
) {
  return {
    id: customer.id,
    organizationId: customer.organizationId,
    name: customer.name,
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    phone: customer.phone,
    company: customer.company,
    jobTitle: customer.jobTitle,
    image: customer.image,
    status: customer.status,
    source: customer.source,
    profileNotes: customer.profileNotes,
    lastActivityAt: customer.lastActivityAt,
    archivedAt: customer.archivedAt,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
    tags: customer.tags.map((row) => row.tag),
    notes: customer.notes,
    activities: customer.activities,
    tickets: customer.tickets,
    counts: customer._count,
  };
}

function toListItem(
  customer: Awaited<ReturnType<typeof customerRepository.list>>["items"][number],
) {
  return {
    id: customer.id,
    name: customer.name,
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    phone: customer.phone,
    company: customer.company,
    jobTitle: customer.jobTitle,
    image: customer.image,
    status: customer.status,
    source: customer.source,
    lastActivityAt: customer.lastActivityAt,
    archivedAt: customer.archivedAt,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
    tags: customer.tags.map((row) => row.tag),
    ticketCount: customer._count.tickets,
    noteCount: customer._count.notes,
  };
}

async function requireCustomerPermission(
  userId: string,
  permission:
    | "customers.read"
    | "customers.create"
    | "customers.update"
    | "customers.delete",
) {
  const context = await requireOrganizationContext(userId);
  requirePermission(context.role, permission);
  return context;
}

export const customerService = {
  async list(userId: string, input: ListCustomersInput) {
    const context = await requireCustomerPermission(userId, "customers.read");
    const result = await customerRepository.list({
      organizationId: context.organization.id,
      q: input.q,
      status: input.status,
      company: input.company,
      tagId: input.tagId,
      createdFrom: input.createdFrom,
      createdTo: input.createdTo,
      includeArchived: input.includeArchived,
      sort: input.sort,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    });

    return {
      items: result.items.map(toListItem),
      page: input.page,
      pageSize: input.pageSize,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / input.pageSize)),
    };
  },

  async get(userId: string, customerId: string) {
    const context = await requireCustomerPermission(userId, "customers.read");
    const customer = await customerRepository.findByIdForOrg(
      context.organization.id,
      customerId,
    );
    if (!customer) {
      throw new CustomerServiceError("Customer not found.", "NOT_FOUND");
    }
    return toPublicCustomer(customer);
  },

  async create(userId: string, input: CreateCustomerInput) {
    const context = await requireCustomerPermission(userId, "customers.create");
    const organizationId = context.organization.id;

    const parsed = createCustomerSchema.safeParse(input);
    if (!parsed.success) {
      throw new CustomerServiceError("Invalid customer payload.", "VALIDATION");
    }
    input = parsed.data;

    const email = input.email.toLowerCase();

    const existing = await customerRepository.findByEmail(organizationId, email);
    if (existing && existing.status !== "ARCHIVED") {
      throw new CustomerServiceError(
        "A customer with this email already exists.",
        "DUPLICATE_EMAIL",
      );
    }

    if (input.tagIds?.length) {
      const tags = await customerRepository.findTagsInOrg(organizationId, input.tagIds);
      if (tags.length !== input.tagIds.length) {
        throw new CustomerServiceError("One or more tags are invalid.", "INVALID_TAG");
      }
    }

    if (existing?.status === "ARCHIVED" || existing?.archivedAt) {
      await customerRepository.update(organizationId, existing.id, {
        status: input.status ?? "ACTIVE",
        archivedAt: null,
        name: buildCustomerDisplayName({ ...input, email }),
        firstName: input.firstName ?? existing.firstName,
        lastName: input.lastName ?? existing.lastName,
        phone: input.phone ?? existing.phone,
        company: input.company ?? existing.company,
        jobTitle: input.jobTitle ?? existing.jobTitle,
        image: input.image || existing.image,
        source: input.source ?? existing.source,
        profileNotes: input.profileNotes ?? existing.profileNotes,
      });
      await customerRepository.createActivity({
        organizationId,
        customerId: existing.id,
        actorId: userId,
        type: "CUSTOMER_RESTORED",
        message: "Customer restored",
      });
      if (input.tagIds) {
        await customerRepository.replaceTags(organizationId, existing.id, input.tagIds);
      }
      const fresh = await customerRepository.findByIdForOrg(organizationId, existing.id);
      await invalidateCustomerCaches(organizationId, existing.id);
      return toPublicCustomer(fresh!);
    }

    const customer = await customerRepository.create({
      organizationId,
      actorId: userId,
      email,
      name: input.name,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      company: input.company,
      jobTitle: input.jobTitle,
      image: input.image || null,
      status: input.status ?? "ACTIVE",
      source: input.source,
      profileNotes: input.profileNotes,
      tagIds: input.tagIds,
    });

    await invalidateCustomerCaches(organizationId, customer.id);
    return toPublicCustomer(customer);
  },

  async update(userId: string, customerId: string, input: UpdateCustomerInput) {
    const context = await requireCustomerPermission(userId, "customers.update");
    const organizationId = context.organization.id;
    const existing = await customerRepository.findByIdForOrg(organizationId, customerId);
    if (!existing) {
      throw new CustomerServiceError("Customer not found.", "NOT_FOUND");
    }

    if (input.email && input.email.toLowerCase() !== existing.email) {
      const clash = await customerRepository.findByEmail(
        organizationId,
        input.email.toLowerCase(),
      );
      if (clash && clash.id !== customerId) {
        throw new CustomerServiceError(
          "A customer with this email already exists.",
          "DUPLICATE_EMAIL",
        );
      }
    }

    if (input.tagIds) {
      const tags = await customerRepository.findTagsInOrg(organizationId, input.tagIds);
      if (tags.length !== input.tagIds.length) {
        throw new CustomerServiceError("One or more tags are invalid.", "INVALID_TAG");
      }
    }

    const nextName = buildCustomerDisplayName({
      name: input.name ?? existing.name,
      firstName:
        input.firstName !== undefined ? input.firstName : existing.firstName,
      lastName: input.lastName !== undefined ? input.lastName : existing.lastName,
      email: input.email ?? existing.email,
    });

    const data: Prisma.CustomerUpdateInput = {
      ...(input.name !== undefined ||
      input.firstName !== undefined ||
      input.lastName !== undefined
        ? { name: nextName }
        : {}),
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
      ...(input.email !== undefined ? { email: input.email.toLowerCase() } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.company !== undefined ? { company: input.company } : {}),
      ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
      ...(input.image !== undefined ? { image: input.image || null } : {}),
      ...(input.source !== undefined ? { source: input.source } : {}),
      ...(input.profileNotes !== undefined ? { profileNotes: input.profileNotes } : {}),
    };

    if (input.status && input.status !== existing.status) {
      data.status = input.status;
      await customerRepository.createActivity({
        organizationId,
        customerId,
        actorId: userId,
        type: "STATUS_CHANGED",
        message: `Status changed to ${input.status}`,
        metadata: { from: existing.status, to: input.status },
      });
    }

    const updated = await customerRepository.update(organizationId, customerId, data);
    if (!updated) {
      throw new CustomerServiceError("Customer not found.", "NOT_FOUND");
    }

    if (input.tagIds) {
      const changes = await customerRepository.replaceTags(
        organizationId,
        customerId,
        input.tagIds,
      );
      if (changes) {
        for (const tagId of changes.added) {
          await customerRepository.createActivity({
            organizationId,
            customerId,
            actorId: userId,
            type: "TAG_ADDED",
            message: "Tag added",
            metadata: { tagId },
          });
        }
        for (const tagId of changes.removed) {
          await customerRepository.createActivity({
            organizationId,
            customerId,
            actorId: userId,
            type: "TAG_REMOVED",
            message: "Tag removed",
            metadata: { tagId },
          });
        }
      }
    }

    await customerRepository.createActivity({
      organizationId,
      customerId,
      actorId: userId,
      type: "CUSTOMER_UPDATED",
      message: "Customer profile updated",
    });

    const fresh = await customerRepository.findByIdForOrg(organizationId, customerId);
    await invalidateCustomerCaches(organizationId, customerId);
    return toPublicCustomer(fresh!);
  },

  async archive(userId: string, customerId: string) {
    const context = await requireCustomerPermission(userId, "customers.delete");
    const organizationId = context.organization.id;
    const existing = await customerRepository.findByIdForOrg(organizationId, customerId);
    if (!existing) {
      throw new CustomerServiceError("Customer not found.", "NOT_FOUND");
    }
    if (existing.archivedAt || existing.status === "ARCHIVED") {
      return toPublicCustomer(existing);
    }

    await customerRepository.update(organizationId, customerId, {
      status: "ARCHIVED",
      archivedAt: new Date(),
    });
    await customerRepository.createActivity({
      organizationId,
      customerId,
      actorId: userId,
      type: "CUSTOMER_ARCHIVED",
      message: "Customer archived",
    });

    const fresh = await customerRepository.findByIdForOrg(organizationId, customerId);
    await invalidateCustomerCaches(organizationId, customerId);
    return toPublicCustomer(fresh!);
  },

  async restore(userId: string, customerId: string) {
    const context = await requireCustomerPermission(userId, "customers.update");
    const organizationId = context.organization.id;
    const existing = await customerRepository.findByIdForOrg(organizationId, customerId);
    if (!existing) {
      throw new CustomerServiceError("Customer not found.", "NOT_FOUND");
    }

    await customerRepository.update(organizationId, customerId, {
      status: "ACTIVE",
      archivedAt: null,
    });
    await customerRepository.createActivity({
      organizationId,
      customerId,
      actorId: userId,
      type: "CUSTOMER_RESTORED",
      message: "Customer restored",
    });

    const fresh = await customerRepository.findByIdForOrg(organizationId, customerId);
    await invalidateCustomerCaches(organizationId, customerId);
    return toPublicCustomer(fresh!);
  },

  async addNote(userId: string, customerId: string, body: string) {
    const context = await requireCustomerPermission(userId, "customers.update");
    const organizationId = context.organization.id;
    const existing = await customerRepository.findByIdForOrg(organizationId, customerId);
    if (!existing) {
      throw new CustomerServiceError("Customer not found.", "NOT_FOUND");
    }

    const note = await customerRepository.createNote({
      organizationId,
      customerId,
      authorId: userId,
      body,
    });
    await invalidateCustomerCaches(organizationId, customerId);
    return note;
  },

  async getMeta(userId: string) {
    const context = await requireCustomerPermission(userId, "customers.read");
    const organizationId = context.organization.id;

    const { value } = await cacheGetOrSet(
      organizationId,
      cacheKeys.customersMeta(organizationId),
      CACHE_TTL.customersMeta,
      async () => {
        const [tags, counts] = await Promise.all([
          ticketRepository.listTags(organizationId),
          customerRepository.countForOrg(organizationId),
        ]);
        return {
          tags,
          counts,
          organization: {
            id: context.organization.id,
            name: context.organization.name,
            slug: context.organization.slug,
          },
        };
      },
    );

    return value;
  },

  async assertCannotAccessForeign(userId: string, foreignCustomerId: string) {
    const context = await requireOrganizationContext(userId);
    const customer = await customerRepository.findByIdForOrg(
      context.organization.id,
      foreignCustomerId,
    );
    if (customer) {
      throw new AuthorizationError("Unexpected access", "FORBIDDEN");
    }
    return true;
  },
};
