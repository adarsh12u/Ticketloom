import type { NextConfig } from "next";

/**
 * Production security headers.
 * CSP is intentionally omitted by default — Google OAuth redirects and Socket.IO
 * upgrades need a deployment-specific policy (see docs/deployment.md).
 */
function buildSecurityHeaders() {
  const headers = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=()",
    },
  ];

  const publicUrl = process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  if (publicUrl.startsWith("https://")) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    });
  }

  return headers;
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders(),
      },
    ];
  },
};

export default nextConfig;
