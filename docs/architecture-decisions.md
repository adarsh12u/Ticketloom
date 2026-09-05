# Architecture Decisions

## ADR-001: Modular monolith with Next.js

**Decision:** Build Ticketloom as a single Next.js application (App Router) with Route Handlers for the API. Add a separate worker process later for BullMQ — not a microservice mesh.

**Why:** Matches the product scope, keeps deployment and reasoning simple for interviews, and still allows clean internal layering (services/repositories).

## ADR-002: Next.js 16.3.4 (Active LTS)

**Decision:** Use Next.js `16.3.4`, the current Active LTS stable release at project start (September 2026). Avoid canary/beta.

**Why:** Dependency policy prioritizes latest stable, compatible, and secure releases.

## ADR-003: UI foundation before backend

**Decision:** Milestone 1 ships design system + shell + public/auth/onboarding UI with no database or auth backend.

**Why:** Establishes visual consistency and navigation early. Prevents fake authentication and premature schema churn.

## ADR-004: Semantic theme tokens

**Decision:** Use CSS variables for colors (`primary`, `muted`, `sidebar`, `success`, `warning`, etc.) with a blue/white brand identity and Inter typography.

**Why:** One token change updates the whole product. Supports light/dark/system without hardcoding colors in components.

## ADR-005: shadcn/ui + Radix primitives

**Decision:** Use shadcn-style components built on Radix primitives, Tailwind CSS 4, and Lucide icons.

**Why:** Accessible primitives, consistent styling, and full ownership of component code.

## ADR-006: Shell placeholder routes

**Decision:** Sidebar destinations that belong to later milestones render intentional empty states instead of 404s.

**Why:** Milestone 1 requires no broken routes and a complete shell experience, without inventing fake feature backends.

## ADR-007: Auth.js v5 (next-auth beta) for authentication

**Decision:** Use Auth.js v5 via `next-auth@5.0.0-beta.32` with the Prisma adapter, Credentials + optional Google providers, and JWT sessions.

**Why:** It is the current official Auth.js integration for Next.js App Router. A stable non-beta `next-auth@5` release was not available at Milestone 2 time; beta is the supported production channel documented by Auth.js. Avoid v4 tutorial APIs.

## ADR-008: Prisma 7.10 stable (not 8 RC)

**Decision:** Use Prisma `7.10.0` with `prisma.config.ts` datasource URL configuration and `@prisma/adapter-pg`.

**Why:** Prisma 8 was release-candidate only. Dependency policy forbids RC/canary unless explicitly approved.

## ADR-009: JWT sessions + database adapter

**Decision:** Use JWT session strategy while still using PrismaAdapter for OAuth account persistence/linking.

**Why:** Credentials authentication requires JWT strategy; adapter remains valuable for Google account records and future session features.

## ADR-010: Organization membership is the tenancy root

**Decision:** Do not store organization ownership on `User`. Ownership is expressed as `Membership.role = OWNER`.

**Why:** Users can belong to multiple organizations; tenant isolation and RBAC must hang off membership, not a single user column.

## ADR-011: Google account linking for verified emails

**Decision:** Enable `allowDangerousEmailAccountLinking` for Google only.

**Why:** Prevents duplicate users when the same verified email signs up with password and later with Google. Password-only accounts remain distinct from unverified providers.

## ADR-012: Next.js 16 Proxy for optimistic auth redirects

**Decision:** Use `src/proxy.ts` (not deprecated `middleware.ts`) plus server `requireUser()` checks.

**Why:** Next.js 16 renamed middleware → proxy. Proxy is UX gating; server session checks remain the authorization boundary.

## ADR-013: Permission catalog over hard-coded role checks

**Decision:** Authorize with permission keys (`members.invite`, `tickets.read`, …) mapped from roles in `ROLE_PERMISSIONS`.

**Why:** Future modules can add permissions without rewriting every role gate. Roles remain the assignment UX; permissions are the enforcement unit.

## ADR-014: Hashed organization invitation tokens

**Decision:** Store only `tokenHash` for invitations; email the raw token once; enforce expiry and single use.

**Why:** Same security model as password-reset / email-verification tokens. Prevents token theft from the database alone.

## ADR-015: Active organization is a validated preference

**Decision:** Persist `User.activeOrganizationId`, but always re-validate ACTIVE membership before use.

**Why:** Supports multi-org switching without trusting client organization context for authorization.

## ADR-016: Atomic ticket counters per organization

**Decision:** Allocate ticket numbers via a dedicated `TicketCounter` row updated with `INSERT … ON CONFLICT DO UPDATE … RETURNING` inside the ticket-create transaction.

**Why:** Guarantees unique, sequential, concurrent-safe `TKT-000001` references without advisory locks or application-level races.

## ADR-017: Internal notes vs customer-visible messages

**Decision:** Store both as `TicketMessage` rows distinguished by `visibility` (`INTERNAL` | `CUSTOMER`), with matching activity events.

**Why:** Keeps the conversation model ready for email/chat while preventing accidental internal-note leakage into customer channels.

## ADR-018: Soft-archive customers instead of hard deletes

**Decision:** Customer removal is archive (`status=ARCHIVED`, `archivedAt` set). Ticket FKs remain `ON DELETE RESTRICT`.

**Why:** Support history must survive CRM cleanup. Restore is available for agents with update permission.
