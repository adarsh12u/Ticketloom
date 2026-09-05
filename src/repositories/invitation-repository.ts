import type { MembershipRole, InvitationStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export const invitationRepository = {
  async create(data: {
    organizationId: string;
    email: string;
    role: MembershipRole;
    tokenHash: string;
    expiresAt: Date;
    invitedById: string;
  }) {
    return prisma.organizationInvitation.create({
      data: {
        organizationId: data.organizationId,
        email: data.email.toLowerCase(),
        role: data.role,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        invitedById: data.invitedById,
        status: "PENDING",
      },
    });
  },

  async findByTokenHash(tokenHash: string) {
    return prisma.organizationInvitation.findUnique({
      where: { tokenHash },
      include: {
        organization: true,
        invitedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  },

  async findPendingByOrgEmail(organizationId: string, email: string) {
    return prisma.organizationInvitation.findFirst({
      where: {
        organizationId,
        email: email.toLowerCase(),
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
    });
  },

  async listForOrganization(organizationId: string, status?: InvitationStatus) {
    return prisma.organizationInvitation.findMany({
      where: {
        organizationId,
        ...(status ? { status } : {}),
      },
      include: {
        invitedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async markAccepted(id: string) {
    return prisma.organizationInvitation.update({
      where: { id },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
      },
    });
  },

  async revoke(id: string) {
    return prisma.organizationInvitation.update({
      where: { id },
      data: { status: "REVOKED" },
    });
  },

  async expireOverdue(organizationId?: string) {
    return prisma.organizationInvitation.updateMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: new Date() },
        ...(organizationId ? { organizationId } : {}),
      },
      data: { status: "EXPIRED" },
    });
  },

  async deletePendingForEmail(organizationId: string, email: string) {
    return prisma.organizationInvitation.deleteMany({
      where: {
        organizationId,
        email: email.toLowerCase(),
        status: "PENDING",
      },
    });
  },
};
