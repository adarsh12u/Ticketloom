import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { authConfig } from "@/lib/auth/auth.config";
import { prisma } from "@/lib/db/prisma";
import { authService } from "@/services/auth-service";
import { userRepository } from "@/repositories/user-repository";

const CREDENTIALS_CHECK_INTERVAL_MS = 60_000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      // Prevent Google account linking from taking over unverified password accounts.
      if (account?.provider === "google" && user.email) {
        const existing = await userRepository.findByEmail(user.email);
        if (existing?.passwordHash && !existing.emailVerified) {
          console.warn("[auth] blocked Google link to unverified password account");
          return false;
        }
        if (existing && !existing.emailVerified) {
          await userRepository.markEmailVerified(existing.id);
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { credentialsChangedAt: true },
        });
        token.credentialsChangedAt = dbUser?.credentialsChangedAt?.getTime() ?? 0;
        token.lastCredentialsCheck = Date.now();
        delete token.error;
      }

      if (trigger === "update" && session?.name) {
        token.name = session.name;
      }

      // Invalidate JWTs issued before a password reset / credentials change.
      if (token.sub && typeof token.iat === "number" && !token.error) {
        const now = Date.now();
        const lastCheck = typeof token.lastCredentialsCheck === "number"
          ? token.lastCredentialsCheck
          : 0;
        const shouldRefresh = now - lastCheck >= CREDENTIALS_CHECK_INTERVAL_MS;

        if (shouldRefresh) {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub },
            select: { credentialsChangedAt: true },
          });
          token.lastCredentialsCheck = now;
          const changedAt = dbUser?.credentialsChangedAt?.getTime() ?? 0;
          token.credentialsChangedAt = changedAt;
          if (changedAt > 0 && token.iat * 1000 < changedAt) {
            token.error = "CredentialsChanged";
          }
        } else {
          const changedAt =
            typeof token.credentialsChangedAt === "number"
              ? token.credentialsChangedAt
              : 0;
          if (changedAt > 0 && token.iat * 1000 < changedAt) {
            token.error = "CredentialsChanged";
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token.error === "CredentialsChanged") {
        return {
          ...session,
          user: undefined as never,
          expires: new Date(0).toISOString(),
        };
      }

      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.email = token.email ?? session.user.email;
        session.user.name = token.name ?? session.user.name;
        session.user.image = token.picture ?? session.user.image;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id) return;
      const workspaceName =
        user.name?.trim() ||
        (user.email ? `${user.email.split("@")[0]} workspace` : "My Workspace");
      await authService.ensureOwnerWorkspaceForUser(user.id, workspaceName);
      // Google (and other OAuth) emails are treated as verified.
      await userRepository.markEmailVerified(user.id);
    },
  },
});
