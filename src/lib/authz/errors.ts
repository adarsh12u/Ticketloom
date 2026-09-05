export class AuthorizationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "UNAUTHENTICATED"
      | "FORBIDDEN"
      | "NOT_A_MEMBER"
      | "MISSING_PERMISSION"
      | "LAST_OWNER"
      | "INVALID_ORGANIZATION" = "FORBIDDEN",
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function isAuthorizationError(error: unknown): error is AuthorizationError {
  return error instanceof AuthorizationError;
}
