import { prisma } from "@/lib/db/prisma";
import {
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  emailVerificationIdentifier,
  generateSecureToken,
  hashToken,
  passwordResetIdentifier,
} from "@/lib/auth/tokens";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { deliverEmail } from "@/services/email-delivery-service";
import { QueueUnavailableError } from "@/lib/queues/producers";
import { organizationRepository } from "@/repositories/organization-repository";
import { userRepository } from "@/repositories/user-repository";
import type { SignupInput } from "@/lib/validations/auth";

export class AuthServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "DUPLICATE_EMAIL"
      | "INVALID_CREDENTIALS"
      | "INVALID_TOKEN"
      | "EXPIRED_TOKEN"
      | "VALIDATION"
      | "EMAIL_UNCONFIGURED"
      | "EMAIL_NOT_VERIFIED"
      | "RATE_LIMITED",
  ) {
    super(message);
    this.name = "AuthServiceError";
  }
}

/** Production defaults to requiring verified email; local/dev can opt out. */
export function requireEmailVerification(): boolean {
  if (process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === "true") return true;
  if (process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === "false") return false;
  return process.env.NODE_ENV === "production";
}

export const authService = {
  async signup(input: SignupInput) {
    const email = input.email.toLowerCase();
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new AuthServiceError(
        "An account with this email already exists.",
        "DUPLICATE_EMAIL",
      );
    }

    const passwordHash = await hashPassword(input.password);
    const name = `${input.firstName} ${input.lastName}`.trim();

    const user = await userRepository.create({
      email,
      name,
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash,
    });

    const { organization, membership } = await organizationRepository.createWithOwner({
      name: input.workspaceName,
      ownerUserId: user.id,
      role: "OWNER",
    });

    // Prepare email verification token (hashed at rest)
    await this.createEmailVerificationToken(email);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
      membership: {
        id: membership.id,
        role: membership.role,
      },
    };
  },

  async validateCredentials(email: string, password: string, options?: { ip?: string }) {
    const normalized = email.toLowerCase();
    const { checkRateLimit } = await import("@/lib/redis/rate-limit");
    const ip = options?.ip ?? "unknown";
    const rate = await checkRateLimit(`login:${ip}:${normalized}`, 10, 60_000);
    if (!rate.allowed) {
      throw new AuthServiceError(
        "Too many login attempts. Please try again later.",
        "RATE_LIMITED",
      );
    }

    const user = await userRepository.findByEmail(normalized);
    if (!user?.passwordHash) {
      // Constant-ish failure path for missing users / OAuth-only accounts
      await hashPassword(password);
      throw new AuthServiceError("Invalid email or password.", "INVALID_CREDENTIALS");
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new AuthServiceError("Invalid email or password.", "INVALID_CREDENTIALS");
    }

    if (requireEmailVerification() && !user.emailVerified) {
      throw new AuthServiceError(
        "Please verify your email before signing in.",
        "EMAIL_NOT_VERIFIED",
      );
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    };
  },

  async ensureOwnerWorkspaceForUser(userId: string, fallbackName: string) {
    const memberships = await organizationRepository.findMembershipsForUser(userId);
    if (memberships.length > 0) {
      return memberships[0];
    }

    return organizationRepository.createWithOwner({
      name: fallbackName,
      ownerUserId: userId,
      role: "OWNER",
    });
  },

  async createEmailVerificationToken(email: string) {
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const identifier = emailVerificationIdentifier(email);

    await prisma.verificationToken.deleteMany({ where: { identifier } });
    await prisma.verificationToken.create({
      data: {
        identifier,
        token: tokenHash,
        expires: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const verifyUrl = `${appUrl}/verify-email?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email.toLowerCase())}`;

    await deliverEmail(
      {
        to: email,
        subject: "Verify your Ticketloom email",
        text: `Verify your email by opening: ${verifyUrl}`,
        html: `<p>Verify your email by opening:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
      },
      {
        purpose: "email-verification",
        dedupeKey: `verify:${email.toLowerCase()}:${tokenHash.slice(0, 12)}`,
      },
    );

    return { rawToken };
  },

  async requestPasswordReset(email: string) {
    const normalized = email.toLowerCase();
    const user = await userRepository.findByEmail(normalized);

    // Always return success to avoid email enumeration
    if (!user?.passwordHash) {
      return { ok: true as const, emailed: false };
    }

    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const identifier = passwordResetIdentifier(normalized);

    await prisma.verificationToken.deleteMany({ where: { identifier } });
    await prisma.verificationToken.create({
      data: {
        identifier,
        token: tokenHash,
        expires: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(normalized)}`;

    try {
      await deliverEmail(
        {
          to: normalized,
          subject: "Reset your Ticketloom password",
          text: `Reset your password: ${resetUrl}\nThis link expires in 1 hour.`,
          html: `<p>Reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 1 hour.</p>`,
        },
        {
          purpose: "password-reset",
          dedupeKey: `reset:${normalized}:${tokenHash.slice(0, 12)}`,
        },
      );
    } catch (error) {
      if (error instanceof QueueUnavailableError) {
        throw new AuthServiceError(
          "Unable to queue password reset email right now. Please try again later.",
          "EMAIL_UNCONFIGURED",
        );
      }
      throw new AuthServiceError(
        error instanceof Error
          ? error.message
          : "Unable to send email right now. Please try again later.",
        "EMAIL_UNCONFIGURED",
      );
    }

    return { ok: true as const, emailed: true };
  },

  async resetPassword(params: { email: string; token: string; password: string }) {
    const normalized = params.email.toLowerCase();
    const identifier = passwordResetIdentifier(normalized);
    const tokenHash = hashToken(params.token);

    const record = await prisma.verificationToken.findUnique({
      where: {
        identifier_token: {
          identifier,
          token: tokenHash,
        },
      },
    });

    if (!record) {
      throw new AuthServiceError("This password reset link is invalid.", "INVALID_TOKEN");
    }

    if (record.expires.getTime() < Date.now()) {
      await prisma.verificationToken.delete({
        where: { identifier_token: { identifier, token: tokenHash } },
      });
      throw new AuthServiceError("This password reset link has expired.", "EXPIRED_TOKEN");
    }

    const user = await userRepository.findByEmail(normalized);
    if (!user) {
      throw new AuthServiceError("This password reset link is invalid.", "INVALID_TOKEN");
    }

    const passwordHash = await hashPassword(params.password);
    await userRepository.updatePassword(user.id, passwordHash);

    // Invalidate used token (and any other reset tokens for this email)
    await prisma.verificationToken.deleteMany({ where: { identifier } });

    return { userId: user.id };
  },

  async verifyEmail(params: { email: string; token: string }) {
    const normalized = params.email.toLowerCase();
    const identifier = emailVerificationIdentifier(normalized);
    const tokenHash = hashToken(params.token);

    const record = await prisma.verificationToken.findUnique({
      where: {
        identifier_token: {
          identifier,
          token: tokenHash,
        },
      },
    });

    if (!record) {
      throw new AuthServiceError("This verification link is invalid.", "INVALID_TOKEN");
    }

    if (record.expires.getTime() < Date.now()) {
      await prisma.verificationToken.delete({
        where: { identifier_token: { identifier, token: tokenHash } },
      });
      throw new AuthServiceError("This verification link has expired.", "EXPIRED_TOKEN");
    }

    const user = await userRepository.findByEmail(normalized);
    if (!user) {
      throw new AuthServiceError("This verification link is invalid.", "INVALID_TOKEN");
    }

    await userRepository.markEmailVerified(user.id);
    await prisma.verificationToken.deleteMany({ where: { identifier } });

    return { userId: user.id };
  },
};
