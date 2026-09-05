import { assertNoSecretLeakageInPublicEnv, requireServerEnv } from "@/lib/env";

/**
 * Next.js instrumentation — runs once on server startup.
 * Validates production configuration without printing secrets.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  assertNoSecretLeakageInPublicEnv();

  if (process.env.SKIP_ENV_VALIDATION === "true") {
    console.warn("[env] SKIP_ENV_VALIDATION=true — skipping startup validation");
    return;
  }

  // Tests / local scripts may omit full production set.
  if (process.env.NODE_ENV === "test") return;

  try {
    requireServerEnv();
    console.info("[env] server environment validated");
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw error;
    }
    console.warn("[env] validation warning", {
      message: error instanceof Error ? error.message : "invalid env",
    });
  }
}
