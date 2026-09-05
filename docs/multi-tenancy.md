# Multi-tenancy & RBAC

## Strategy

Ticketloom is a **multi-tenant** B2B SaaS. The tenancy root is **Organization**.

- Users may belong to **many** organizations via `Membership`.
- Every organization-scoped operation resolves membership **server-side**.
- Client-supplied `organizationId`, `userId`, `role`, or `permissions` are never trusted.

```text
User
 └── Membership (role, status)
      └── Organization
           ├── Members
           ├── Invitations
           ├── Customers / Teams / Tags
           └── Tickets (+ messages, activities)
```

## Active organization

`User.activeOrganizationId` stores the user's current workspace preference.

Resolution order (`getCurrentOrganizationContext`):

1. If `activeOrganizationId` is set **and** the user has an **ACTIVE** membership → use it.
2. Otherwise fall back to the user's first ACTIVE membership and repair `activeOrganizationId`.
3. If the user has no ACTIVE membership → unauthorized for org-scoped routes.

Switching organizations (`POST /api/organizations/switch`):

1. Authenticate.
2. `requireOrganizationMembership(userId, organizationId)`.
3. Persist `activeOrganizationId`.
4. Refresh UI with `router.refresh()`.

## Roles

Primary roles:

| Role   | Intent                                      |
|--------|---------------------------------------------|
| OWNER  | Full control including org delete           |
| ADMIN  | Manage members/settings (no org delete)     |
| AGENT  | Day-to-day ticket/customer/knowledge work   |
| VIEWER | Read-only                                   |

Legacy Milestone 2 roles `MANAGER` / `CUSTOMER` remain in the enum and map to ADMIN / VIEWER permissions.

## Permissions

Permission keys live in `src/lib/authz/permissions.ts`.

Examples:

- `organization.read|update|delete`
- `members.read|invite|update|remove`
- `tickets.*`, `customers.*`, `knowledge.*`, `analytics.read`

Server helpers:

- `requireOrganizationContext(userId)`
- `requireOrganizationMembership(userId, organizationId)`
- `hasPermission(role, permission)`
- `requirePermission(role, permission)`
- `requireOrganizationRole(role, allowed)`
- `switchActiveOrganization(userId, organizationId)`

## Invitations

`OrganizationInvitation` stores **hashed** tokens only (`tokenHash`).

Security rules:

- Secure random raw token emailed once
- SHA-256 hash at rest
- Expiry (7 days)
- Status machine: PENDING → ACCEPTED | REVOKED | EXPIRED
- Accept requires authenticated user whose email matches the invitation
- Token reuse blocked after ACCEPTED
- Duplicate pending invites for same org+email rejected

Public UI: `/invite/[token]`

## Tenant isolation

Future modules must:

1. Authenticate the user.
2. Resolve the **active** organization from membership (not from the client).
3. Scope every query with that `organizationId`.
4. Check the required permission.

Cross-tenant access is rejected even if a foreign `organizationId` or membership id is posted.

## Last-owner protection

- Cannot demote the last OWNER.
- Cannot remove the last OWNER.
- Users cannot remove themselves (ask another owner/admin).
