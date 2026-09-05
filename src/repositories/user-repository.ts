import type { Prisma, User } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export type SafeUser = Omit<User, "passwordHash">;

function omitPasswordHash<T extends { passwordHash?: string | null }>(
  user: T,
): Omit<T, "passwordHash"> {
  const clone = { ...user };
  delete clone.passwordHash;
  return clone;
}

export const userRepository = {
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  },

  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  async findSafeById(id: string): Promise<SafeUser | null> {
    const user = await prisma.user.findUnique({ where: { id } });
    return user ? omitPasswordHash(user) : null;
  },

  async create(data: Prisma.UserCreateInput) {
    return prisma.user.create({
      data: {
        ...data,
        email: data.email.toLowerCase(),
      },
    });
  },

  async updatePassword(userId: string, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        // Invalidate JWTs issued before this timestamp (see auth jwt callback).
        credentialsChangedAt: new Date(),
      },
    });
  },

  async markEmailVerified(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { emailVerified: new Date() },
    });
  },

  async setActiveOrganization(userId: string, organizationId: string | null) {
    return prisma.user.update({
      where: { id: userId },
      data: { activeOrganizationId: organizationId },
    });
  },
};
