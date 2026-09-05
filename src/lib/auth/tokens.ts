import { createHash, randomBytes } from "crypto";

export function generateSecureToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function passwordResetIdentifier(email: string): string {
  return `password-reset:${email.toLowerCase()}`;
}

export function emailVerificationIdentifier(email: string): string {
  return `email-verification:${email.toLowerCase()}`;
}

export const PASSWORD_RESET_TTL_MS = 1000 * 60 * 60; // 1 hour
export const EMAIL_VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
