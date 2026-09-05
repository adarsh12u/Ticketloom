import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { AuthServiceError, authService } from "@/services/auth-service";
import {
  generateSecureToken,
  hashToken,
  passwordResetIdentifier,
} from "@/lib/auth/tokens";

const runIntegration = Boolean(process.env.DATABASE_URL);

describe.runIf(runIntegration)("authService integration", () => {
  const suffix = Date.now();
  const email = `owner-${suffix}@example.com`;
  const password = "SecurePass123!";

  beforeAll(async () => {
    process.env.AUTH_SECRET ??= "test-secret-ticketloom-auth-32chars!!";
  });

  afterAll(async () => {
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: {
          in: [
            `password-reset:${email}`,
            `email-verification:${email}`,
          ],
        },
      },
    });
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.membership.deleteMany({ where: { userId: user.id } });
      await prisma.account.deleteMany({ where: { userId: user.id } });
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await prisma.organization.deleteMany({
      where: { name: `Workspace ${suffix}` },
    });
    await prisma.$disconnect();
  });

  it("signs up a user with organization and OWNER membership", async () => {
    const result = await authService.signup({
      firstName: "Casey",
      lastName: "Owner",
      email,
      password,
      workspaceName: `Workspace ${suffix}`,
    });

    expect(result.user.email).toBe(email);
    expect(result.organization.name).toBe(`Workspace ${suffix}`);
    expect(result.membership.role).toBe("OWNER");

    const stored = await prisma.user.findUnique({ where: { email } });
    expect(stored?.passwordHash).toBeTruthy();
    expect(JSON.stringify(result)).not.toContain(password);
    expect(JSON.stringify(result)).not.toContain(stored!.passwordHash!);
  });

  it("rejects duplicate emails", async () => {
    await expect(
      authService.signup({
        firstName: "Casey",
        lastName: "Owner",
        email,
        password,
        workspaceName: `Workspace ${suffix}-2`,
      }),
    ).rejects.toMatchObject({ code: "DUPLICATE_EMAIL" } satisfies Partial<AuthServiceError>);
  });

  it("validates credentials and rejects invalid ones", async () => {
    const user = await authService.validateCredentials(email, password);
    expect(user.email).toBe(email);

    await expect(authService.validateCredentials(email, "wrong-password")).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });

    await expect(
      authService.validateCredentials("missing@example.com", password),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("resets password with hashed single-use tokens", async () => {
    const rawToken = generateSecureToken();
    const identifier = passwordResetIdentifier(email);
    await prisma.verificationToken.create({
      data: {
        identifier,
        token: hashToken(rawToken),
        expires: new Date(Date.now() + 60_000),
      },
    });

    await authService.resetPassword({
      email,
      token: rawToken,
      password: "NewSecurePass123!",
    });

    const afterReset = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(afterReset.credentialsChangedAt).toBeTruthy();

    await expect(authService.validateCredentials(email, "NewSecurePass123!")).resolves.toBeTruthy();
    await expect(authService.validateCredentials(email, password)).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });

    await expect(
      authService.resetPassword({
        email,
        token: rawToken,
        password: "AnotherPass123!",
      }),
    ).rejects.toMatchObject({ code: "INVALID_TOKEN" });
  });

  it("rejects password reset tokens bound to a different email", async () => {
    const { hashPassword } = await import("@/lib/auth/password");
    const otherEmail = `other-reset-${suffix}@example.com`;
    await prisma.user.create({
      data: {
        email: otherEmail,
        name: "Other",
        passwordHash: await hashPassword("SecurePass123!"),
      },
    });

    const rawToken = generateSecureToken();
    const identifier = passwordResetIdentifier(email);
    await prisma.verificationToken.create({
      data: {
        identifier,
        token: hashToken(rawToken),
        expires: new Date(Date.now() + 60_000),
      },
    });

    await expect(
      authService.resetPassword({
        email: otherEmail,
        token: rawToken,
        password: "HijackPass123!",
      }),
    ).rejects.toMatchObject({ code: "INVALID_TOKEN" });

    await prisma.verificationToken.deleteMany({
      where: { identifier },
    });
    await prisma.user.delete({ where: { email: otherEmail } });
  });

  it("rejects unverified credentials when AUTH_REQUIRE_EMAIL_VERIFICATION=true", async () => {
    const previous = process.env.AUTH_REQUIRE_EMAIL_VERIFICATION;
    process.env.AUTH_REQUIRE_EMAIL_VERIFICATION = "true";
    try {
      await prisma.user.update({
        where: { email },
        data: { emailVerified: null },
      });
      await expect(
        authService.validateCredentials(email, "NewSecurePass123!"),
      ).rejects.toMatchObject({ code: "EMAIL_NOT_VERIFIED" });
    } finally {
      if (previous === undefined) {
        delete process.env.AUTH_REQUIRE_EMAIL_VERIFICATION;
      } else {
        process.env.AUTH_REQUIRE_EMAIL_VERIFICATION = previous;
      }
      await prisma.user.update({
        where: { email },
        data: { emailVerified: new Date() },
      });
    }
  });

  it("rejects expired reset tokens", async () => {
    const rawToken = generateSecureToken();
    const identifier = passwordResetIdentifier(email);
    await prisma.verificationToken.create({
      data: {
        identifier,
        token: hashToken(rawToken),
        expires: new Date(Date.now() - 1000),
      },
    });

    await expect(
      authService.resetPassword({
        email,
        token: rawToken,
        password: "ExpiredPass123!",
      }),
    ).rejects.toMatchObject({ code: "EXPIRED_TOKEN" });
  });
});
