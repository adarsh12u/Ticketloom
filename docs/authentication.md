# Authentication

## Overview

Ticketloom authentication is built with:

- **Auth.js v5** (`next-auth@5` beta — current official Next.js integration)
- **PostgreSQL + Prisma 7**
- **Credentials** (email/password)
- **Google OAuth** (optional via env)
- **JWT session strategy** (required for Credentials + Adapter coexistence)

## Architecture

```text
Client (login/signup forms)
  → Auth.js handlers / Route Handlers
  → AuthService (business rules)
  → Repositories
  → Prisma
  → PostgreSQL
```

Server session source of truth:

```ts
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/auth/session";
```

Never trust client-supplied `userId`, `organizationId`, or `role`.

## Session strategy

JWT sessions (14-day max age) with Auth.js secure cookies.

Why JWT:

- Credentials provider does not support database sessions the same way OAuth does
- Works cleanly with Prisma adapter for Account linking
- Proxy (`src/proxy.ts`) can authorize without heavy DB round-trips

Protected page layouts still call `requireUser()` as a second security layer.

## Password security

- Passwords are hashed with **bcrypt** (`bcryptjs`, 12 rounds)
- Column name: `passwordHash`
- Passwords never appear in API responses, logs, or audit payloads

## Signup flow

1. Validate with Zod (`signupSchema`)
2. Reject duplicate emails (`409`)
3. Hash password
4. Create `User`
5. Create `Organization` + `Membership(role=OWNER)`
6. Create email-verification token (hashed)
7. Establish Auth.js session via credentials sign-in
8. Redirect to `/onboarding`

## Login flow

1. Validate input
2. Auth.js Credentials `authorize`
3. Generic error on failure: `Invalid email or password.`
4. Redirect to callback URL / dashboard

## Logout

`signOut({ callbackUrl: "/login" })` invalidates the session cookie.

## Google OAuth

Env:

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
AUTH_SECRET=
AUTH_URL=http://localhost:3000
```

Google Cloud redirect URI:

```text
http://localhost:3000/api/auth/callback/google
```

### Account linking

`allowDangerousEmailAccountLinking: true` is enabled for Google only because Google provides verified emails.

Behavior:

- If a password user already exists with the same email, Google sign-in links to that user instead of creating a duplicate identity.
- If linking fails, Auth.js returns `OAuthAccountNotLinked` and the UI shows a safe message.

Documented ADR: see `docs/architecture-decisions.md`.

### First Google login

`events.createUser` creates an OWNER membership + organization when a brand-new OAuth user is created.

## Email / SMTP

When these are set, Ticketloom uses Nodemailer SMTP:

```bash
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=
```

If SMTP is not fully configured, development falls back to the console email provider.

If SMTP is configured but unreachable while running on localhost, Ticketloom also falls back to the console provider so local password-reset testing still works. Set `EMAIL_DEV_CONSOLE_FALLBACK=true` to force that behavior.

Password-reset and verification emails never return raw tokens in API responses.

## Password reset

1. `POST /api/auth/forgot-password`
2. Store **hashed** token in `VerificationToken` (`password-reset:{email}`)
3. Email via SMTP when configured (otherwise console provider in development)
4. `POST /api/auth/reset-password` validates hash + expiry, updates password, deletes tokens

Tokens:

- expire after 1 hour
- are single-use
- are never returned in API responses

## Email verification

Architecture is prepared:

- hashed token under `email-verification:{email}`
- `POST /api/auth/verify-email`

Local development logs email content to the console when SMTP is not configured.

## Protected routes

`src/proxy.ts` (Next.js 16 Proxy convention) + `requireUser()` in `(app)` layout.

Protected prefixes include dashboard, tickets, customers, knowledge, chat, analytics, reports, team, settings, admin, onboarding.

Auth pages redirect authenticated users to `/dashboard`.

## Rate limiting

In-memory limiter (`src/lib/rate-limit/memory-rate-limit.ts`) protects signup/login-adjacent endpoints.

Redis-backed limiter arrives in Milestone 6.

## Tenant isolation foundation

Organization access must be derived from authenticated membership:

```ts
requireOrganizationMembership(userId, organizationId)
```

Never authorize using a client-provided organization id alone.
