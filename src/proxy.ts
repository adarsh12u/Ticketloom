import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth/auth.config";

const { auth } = NextAuth(authConfig);

export const proxy = auth;

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/tickets/:path*",
    "/customers/:path*",
    "/knowledge/:path*",
    "/inbox/:path*",
    "/chat/:path*",
    "/analytics/:path*",
    "/reports/:path*",
    "/team/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/invite/:path*",
    "/onboarding",
    "/onboarding/:path*",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
  ],
};
