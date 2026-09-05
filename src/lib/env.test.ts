import { describe, expect, it } from "vitest";

import { validateServerEnv } from "@/lib/env";

describe("env validation", () => {
  it("accepts a minimal valid development config", () => {
    const result = validateServerEnv({
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://ticketloom:ticketloom@localhost:5432/ticketloom",
      AUTH_SECRET: "x".repeat(32),
    });
    expect(result.ok).toBe(true);
  });

  it("rejects short AUTH_SECRET", () => {
    const result = validateServerEnv({
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://localhost/ticketloom",
      AUTH_SECRET: "too-short",
    });
    expect(result.ok).toBe(false);
  });

  it("requires REDIS_URL in production", () => {
    const result = validateServerEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://localhost/ticketloom",
      AUTH_SECRET: "x".repeat(32),
      AUTH_URL: "https://app.example.com",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.includes("REDIS_URL"))).toBe(true);
    }
  });
});
