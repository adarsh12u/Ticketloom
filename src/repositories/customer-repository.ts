import type { CustomerStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { buildCustomerDisplayName } from "@/lib/validations/customer";

const listInclude = {
  tags: { include: { tag: true } },
  _count: { select: { tickets: true, notes: true } },
} satisfies Prisma.CustomerInclude;

const detailInclude = {
  tags: { include: { tag: true } },
  notes: {
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
    orderBy: { createdAt: "desc" as const },
    take: 50,
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
  tickets: {
    where: { archivedAt: null },
    orderBy: { createdAt: "desc" as const },
    take: 50,
    select: {
      id: true,
      numberKey: true,
      subject: true,
      status: true,
      priority: true,
      createdAt: true,
      updatedAt: true,
      resolvedAt: true,
      closedAt: true,
    },
  },
  _count: { select: { tickets: true, notes: true } },
} satisfies Prisma.CustomerInclude;

export type CustomerListFilters = {
  organizationId: string;
  q?: string;
  status?: CustomerStatus;
  company?: string;
  tagId?: string;
  createdFrom?: Date;
  createdTo?: Date;
  includeArchived?: boolean;
  sort: "newest" | "oldest" | "recently_active" | "alphabetical";
  skip: number;
  take: number;
};

export const customerRepository = {
  async findByIdForOrg(organizationId: string, customerId: string) {
    return prisma.customer.findFirst({
      where: { id: customerId, organizationId },
      include: detailInclude,
    });
  },

  async findByEmail(organizationId: string, email: string) {
    return prisma.customer.findUnique({
      where: {
        organizationId_email: {
          organizationId,
          email: email.toLowerCase(),
        },
      },
    });
  },

  async list(filters: CustomerListFilters) {
    const where: Prisma.CustomerWhereInput = {
      organizationId: filters.organizationId,
      ...(filters.includeArchived
        ? {}
        : { archivedAt: null, status: { not: "ARCHIVED" } }),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.company
        ? { company: { contains: filters.company, mode: "insensitive" } }
        : {}),
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
              { name: { contains: filters.q, mode: "insensitive" } },
              { firstName: { contains: filters.q, mode: "insensitive" } },
              { lastName: { contains: filters.q, mode: "insensitive" } },
              { email: { contains: filters.q, mode: "insensitive" } },
              { phone: { contains: filters.q, mode: "insensitive" } },
              { company: { contains: filters.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.CustomerOrderByWithRelationInput =
      filters.sort === "oldest"
        ? { createdAt: "asc" }
        : filters.sort === "recently_active"
          ? { lastActivityAt: "desc" }
          : filters.sort === "alphabetical"
            ? { name: "asc" }
            : { createdAt: "desc" };

    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: listInclude,
        orderBy,
        skip: filters.skip,
        take: filters.take,
      }),
      prisma.customer.count({ where }),
    ]);

    return { items, total };
  },

  async create(params: {
    organizationId: string;
    email: string;
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    company?: string | null;
    jobTitle?: string | null;
    image?: string | null;
    status?: Exclude<CustomerStatus, "ARCHIVED">;
    source?: string | null;
    profileNotes?: string | null;
    tagIds?: string[];
    actorId: string;
  }) {
    const email = params.email.toLowerCase();
    const name = buildCustomerDisplayName(params);

    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          organizationId: params.organizationId,
          email,
          name,
          firstName: params.firstName ?? null,
          lastName: params.lastName ?? null,
          phone: params.phone ?? null,
          company: params.company ?? null,
          jobTitle: params.jobTitle ?? null,
          image: params.image || null,
          status: params.status ?? "ACTIVE",
          source: params.source ?? null,
          profileNotes: params.profileNotes ?? null,
          lastActivityAt: new Date(),
          ...(params.tagIds?.length
            ? {
                tags: {
                  create: params.tagIds.map((tagId) => ({ tagId })),
                },
              }
            : {}),
        },
      });

      await tx.customerActivity.create({
        data: {
          organizationId: params.organizationId,
          customerId: customer.id,
          actorId: params.actorId,
          type: "CUSTOMER_CREATED",
          message: `Customer ${name} created`,
          metadata: { email, status: customer.status },
        },
      });

      return tx.customer.findFirstOrThrow({
        where: { id: customer.id, organizationId: params.organizationId },
        include: detailInclude,
      });
    });
  },

  async update(
    organizationId: string,
    customerId: string,
    data: Prisma.CustomerUpdateInput,
  ) {
    const existing = await prisma.customer.findFirst({
      where: { id: customerId, organizationId },
    });
    if (!existing) return null;

    return prisma.customer.update({
      where: { id: customerId },
      data: {
        ...data,
        lastActivityAt: new Date(),
      },
      include: detailInclude,
    });
  },

  async replaceTags(organizationId: string, customerId: string, tagIds: string[]) {
    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: customerId, organizationId },
        include: { tags: true },
      });
      if (!customer) return null;

      const previous = new Set(customer.tags.map((row) => row.tagId));
      const next = new Set(tagIds);

      await tx.customerTag.deleteMany({ where: { customerId } });
      if (tagIds.length) {
        await tx.customerTag.createMany({
          data: tagIds.map((tagId) => ({ customerId, tagId })),
        });
      }

      return {
        added: [...next].filter((id) => !previous.has(id)),
        removed: [...previous].filter((id) => !next.has(id)),
      };
    });
  },

  async createNote(params: {
    organizationId: string;
    customerId: string;
    authorId: string;
    body: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const note = await tx.customerNote.create({
        data: {
          organizationId: params.organizationId,
          customerId: params.customerId,
          authorId: params.authorId,
          body: params.body,
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

      await tx.customerActivity.create({
        data: {
          organizationId: params.organizationId,
          customerId: params.customerId,
          actorId: params.authorId,
          type: "NOTE_ADDED",
          message: "Internal note added",
          metadata: { noteId: note.id },
        },
      });

      await tx.customer.update({
        where: { id: params.customerId },
        data: { lastActivityAt: new Date() },
      });

      return note;
    });
  },

  async createActivity(data: {
    organizationId: string;
    customerId: string;
    actorId?: string | null;
    type: Prisma.CustomerActivityCreateInput["type"];
    message?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return prisma.$transaction(async (tx) => {
      const activity = await tx.customerActivity.create({
        data: {
          organizationId: data.organizationId,
          customerId: data.customerId,
          actorId: data.actorId ?? null,
          type: data.type,
          message: data.message,
          metadata: data.metadata,
        },
      });

      await tx.customer.updateMany({
        where: { id: data.customerId, organizationId: data.organizationId },
        data: { lastActivityAt: new Date() },
      });

      return activity;
    });
  },

  async upsertForTicket(
    organizationId: string,
    input: { name: string; email: string; company?: string | null; phone?: string | null },
    actorId?: string,
  ) {
    const email = input.email.toLowerCase();
    const existing = await prisma.customer.findUnique({
      where: { organizationId_email: { organizationId, email } },
    });

    if (existing) {
      return prisma.customer.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          company: input.company ?? undefined,
          phone: input.phone ?? undefined,
          lastActivityAt: new Date(),
          ...(existing.status === "ARCHIVED"
            ? { status: "ACTIVE", archivedAt: null }
            : {}),
        },
      });
    }

    const created = await prisma.customer.create({
      data: {
        organizationId,
        email,
        name: input.name,
        company: input.company ?? null,
        phone: input.phone ?? null,
        status: "ACTIVE",
        lastActivityAt: new Date(),
      },
    });

    if (actorId) {
      await prisma.customerActivity.create({
        data: {
          organizationId,
          customerId: created.id,
          actorId,
          type: "CUSTOMER_CREATED",
          message: `Customer ${created.name} created`,
          metadata: { email, via: "ticket" },
        },
      });
    }

    return created;
  },

  async countForOrg(organizationId: string) {
    const [total, active, prospects] = await Promise.all([
      prisma.customer.count({
        where: { organizationId, archivedAt: null, status: { not: "ARCHIVED" } },
      }),
      prisma.customer.count({
        where: { organizationId, status: "ACTIVE", archivedAt: null },
      }),
      prisma.customer.count({
        where: { organizationId, status: "PROSPECT", archivedAt: null },
      }),
    ]);
    return { total, active, prospects };
  },

  async findTagsInOrg(organizationId: string, tagIds: string[]) {
    if (!tagIds.length) return [];
    return prisma.tag.findMany({
      where: { organizationId, id: { in: tagIds } },
    });
  },
};
