/**
 * Centralized environment validation (Milestone 14).
 * Never log secret values. Browser may only see NEXT_PUBLIC_* keys.
 */

import { z } from "zod";

const boolish = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  AUTH_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_SOCKET_URL: z.string().url().optional(),
  REDIS_URL: z.string().optional(),
  SOCKET_PORT: z.string().optional(),
  SOCKET_CORS_ORIGINS: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_ALLOW_CONSOLE: boolish,
  EMAIL_REQUIRED: boolish,
  RATE_LIMIT_FAIL_CLOSED: boolish,
  AUTH_REQUIRE_EMAIL_VERIFICATION: boolish,
  AI_PROVIDER: z.enum(["ollama", "mock"]).optional(),
  AI_ENABLED: boolish,
  OLLAMA_BASE_URL: z.string().optional(),
  AI_MODEL: z.string().optional(),
  AI_EMBEDDING_MODEL: z.string().optional(),
  SEED_USER_PASSWORD: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

export type EnvValidationResult =
  | { ok: true; env: ServerEnv }
  | { ok: false; issues: string[] };

export function validateServerEnv(
  source: NodeJS.ProcessEnv = process.env,
): EnvValidationResult {
  const parsed = serverSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue) => `${issue.path.join(".") || "env"}: ${issue.message}`,
    );
    return { ok: false, issues };
  }

  const env = parsed.data;
  const issues: string[] = [];

  if (env.NODE_ENV === "production") {
    if (!env.REDIS_URL) {
      issues.push("REDIS_URL is required in production");
    }
    if (!env.AUTH_URL && !env.NEXT_PUBLIC_APP_URL) {
      issues.push("AUTH_URL or NEXT_PUBLIC_APP_URL is required in production");
    }
    const googleId = env.GOOGLE_CLIENT_ID || env.AUTH_GOOGLE_ID;
    const googleSecret = env.GOOGLE_CLIENT_SECRET || env.AUTH_GOOGLE_SECRET;
    if ((googleId && !googleSecret) || (!googleId && googleSecret)) {
      issues.push("Google OAuth requires both client id and client secret");
    }
  }

  if (issues.length) return { ok: false, issues };
  return { ok: true, env };
}

/** Throws a clear Error listing missing/invalid keys — never includes secret values. */
export function requireServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const result = validateServerEnv(source);
  if (!result.ok) {
    throw new Error(
      `Invalid environment configuration:\n- ${result.issues.join("\n- ")}`,
    );
  }
  return result.env;
}

export function assertNoSecretLeakageInPublicEnv() {
  const publicKeys = Object.keys(process.env).filter((key) =>
    key.startsWith("NEXT_PUBLIC_"),
  );
  const forbidden = [
    "DATABASE_URL",
    "REDIS_URL",
    "AUTH_SECRET",
    "SMTP_PASSWORD",
    "GOOGLE_CLIENT_SECRET",
    "AUTH_GOOGLE_SECRET",
  ];
  for (const key of publicKeys) {
    const upper = key.toUpperCase();
    for (const secret of forbidden) {
      if (upper.includes(secret) || upper.replace(/^NEXT_PUBLIC_/, "") === secret) {
        throw new Error(
          `Refusing to expose secret-like key via NEXT_PUBLIC_: ${key}`,
        );
      }
    }
  }
}
