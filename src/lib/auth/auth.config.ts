import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

import { loginSchema } from "@/lib/validations/auth";

/**
 * Edge/proxy-safe Auth.js config.
 * Do not import Prisma or Node-only modules here if this file is used from proxy.
 * (Next.js 16 proxy runs on Node.js, but we keep this split for clarity.)
 */
export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 14, // 14 days
  },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID ?? process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? process.env.AUTH_GOOGLE_SECRET,
            // Linking is gated in src/lib/auth/index.ts signIn: refuse linking to
            // password accounts that have not verified email (account-takeover defense).
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    Credentials({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials, request) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const ip =
          request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          request?.headers?.get("x-real-ip") ??
          "unknown";

        // Lazy import keeps Prisma out of static edge bundles if any
        const { authService, AuthServiceError } = await import("@/services/auth-service");
        try {
          return await authService.validateCredentials(
            parsed.data.email,
            parsed.data.password,
            { ip },
          );
        } catch (error) {
          if (error instanceof AuthServiceError) {
            return null;
          }
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = Boolean(auth?.user);

      const isAuthPage =
        pathname.startsWith("/login") ||
        pathname.startsWith("/signup") ||
        pathname.startsWith("/forgot-password") ||
        pathname.startsWith("/reset-password");

      const isProtected =
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/tickets") ||
        pathname.startsWith("/customers") ||
        pathname.startsWith("/knowledge") ||
        pathname.startsWith("/inbox") ||
        pathname.startsWith("/chat") ||
        pathname.startsWith("/analytics") ||
        pathname.startsWith("/reports") ||
        pathname.startsWith("/team") ||
        pathname.startsWith("/settings") ||
        pathname.startsWith("/admin") ||
        pathname.startsWith("/onboarding");

      if (isProtected && !isLoggedIn) {
        return false;
      }

      if (isAuthPage && isLoggedIn) {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }

      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }

      if (trigger === "update" && session?.name) {
        token.name = session.name;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.email = token.email ?? session.user.email;
        session.user.name = token.name ?? session.user.name;
        session.user.image = token.picture ?? session.user.image;
      }
      return session;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
