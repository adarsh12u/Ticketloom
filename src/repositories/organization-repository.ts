import type {
  MembershipRole,
  MembershipStatus,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { slugify, uniqueSlug } from "@/lib/utils/slug";

async function allocateUniqueSlug(baseName: string, preferred?: string) {
  const base = preferred ? slugify(preferred) : slugify(baseName);
  let candidate = base;
  let attempt = 0;

  while (attempt < 20) {
    const existing = await prisma.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    attempt += 1;
    candidate = uniqueSlug(base, Math.random().toString(36).slice(2, 8));
  }

  return uniqueSlug(base, Date.now().toString(36));
}

export const organizationRepository = {
  async createWithOwner(params: {
    name: string;
    ownerUserId: string;
    role?: MembershipRole;
    slug?: string;
  }) {
    const slug = await allocateUniqueSlug(params.name, params.slug);

    return prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: params.name,
          slug,
        },
      });

      const membership = await tx.membership.create({
        data: {
          organizationId: organization.id,
          userId: params.ownerUserId,
          role: params.role ?? "OWNER",
          status: "ACTIVE",
        },
      });

      await tx.user.update({
        where: { id: params.ownerUserId },
        data: { activeOrganizationId: organization.id },
      });

      return { organization, membership };
    });
  },

  async findById(id: string) {
    return prisma.organization.findUnique({ where: { id } });
  },

  async findBySlug(slug: string) {
    return prisma.organization.findUnique({ where: { slug } });
  },

  async update(id: string, data: Prisma.OrganizationUpdateInput) {
    return prisma.organization.update({ where: { id }, data });
  },

  async findMembershipsForUser(userId: string) {
    return prisma.membership.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    });
  },

  async findActiveMembershipsForUser(userId: string) {
    return prisma.membership.findMany({
      where: { userId, status: "ACTIVE" },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    });
  },

  async findMembership(userId: string, organizationId: string) {
    return prisma.membership.findUnique({
      where: {
        userId_organizationId: { userId, organizationId },
      },
      include: { organization: true },
    });
  },

  async findActiveMembership(userId: string, organizationId: string) {
    return prisma.membership.findFirst({
      where: {
        userId,
        organizationId,
        status: "ACTIVE",
      },
      include: { organization: true },
    });
  },

  async listMembers(organizationId: string) {
    return prisma.membership.findMany({
      where: { organizationId },
      include: {
        user: {
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
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      take: 500,
    });
  },

  async findMembershipById(membershipId: string) {
    return prisma.membership.findUnique({
      where: { id: membershipId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            firstName: true,
            lastName: true,
            activeOrganizationId: true,
          },
        },
        organization: true,
      },
    });
  },

  async countOwners(organizationId: string) {
    return prisma.membership.count({
      where: {
        organizationId,
        role: "OWNER",
        status: "ACTIVE",
      },
    });
  },

  async updateMembership(
    membershipId: string,
    data: {
      role?: MembershipRole;
      status?: MembershipStatus;
    },
  ) {
    return prisma.membership.update({
      where: { id: membershipId },
      data,
    });
  },

  async deleteMembership(membershipId: string) {
    return prisma.membership.delete({ where: { id: membershipId } });
  },

  async createMembership(data: {
    userId: string;
    organizationId: string;
    role: MembershipRole;
    status?: MembershipStatus;
  }) {
    return prisma.membership.create({
      data: {
        userId: data.userId,
        organizationId: data.organizationId,
        role: data.role,
        status: data.status ?? "ACTIVE",
      },
    });
  },

  async create(data: Prisma.OrganizationCreateInput) {
    return prisma.organization.create({ data });
  },

  allocateUniqueSlug,
};
