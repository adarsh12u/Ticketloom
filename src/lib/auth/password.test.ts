import { describe, expect, it, beforeEach } from "vitest";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  generateSecureToken,
  hashToken,
  passwordResetIdentifier,
} from "@/lib/auth/tokens";
import { checkRateLimit, resetRateLimitStore } from "@/lib/rate-limit/memory-rate-limit";
import {
  loginSchema,
  signupSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";

describe("password hashing", () => {
  it("hashes and verifies passwords", async () => {
    const hash = await hashPassword("SecurePass123!");
    expect(hash).not.toContain("SecurePass123!");
    expect(await verifyPassword("SecurePass123!", hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });
});

describe("auth validation", () => {
  it("accepts valid signup payload", () => {
    const result = signupSchema.safeParse({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      password: "SecurePass123!",
      workspaceName: "Analytical Engine",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email and weak password", () => {
    expect(loginSchema.safeParse({ email: "bad", password: "short" }).success).toBe(false);
    expect(
      signupSchema.safeParse({
        firstName: "",
        lastName: "X",
        email: "not-an-email",
        password: "123",
        workspaceName: "A",
      }).success,
    ).toBe(false);
  });

  it("requires reset token fields", () => {
    expect(
      resetPasswordSchema.safeParse({
        email: "ada@example.com",
        token: "",
        password: "SecurePass123!",
      }).success,
    ).toBe(false);
  });
});

describe("token helpers", () => {
  it("hashes tokens deterministically and never returns plaintext as hash", () => {
    const token = generateSecureToken();
    const hashed = hashToken(token);
    expect(hashed).toHaveLength(64);
    expect(hashed).not.toEqual(token);
    expect(hashToken(token)).toEqual(hashed);
    expect(passwordResetIdentifier("Ada@Example.com")).toBe(
      "password-reset:ada@example.com",
    );
  });
});

describe("memory rate limit", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it("blocks after limit is exceeded", () => {
    expect(checkRateLimit("test:ip", 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit("test:ip", 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit("test:ip", 2, 60_000).allowed).toBe(false);
  });
});
