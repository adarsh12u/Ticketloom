# Database

## Stack

- PostgreSQL
- Prisma ORM **7.10.0** (stable; not Prisma 8 RC)
- Driver adapter: `@prisma/adapter-pg` + `pg`
- Docker Postgres (Compose profile `full`): `pgvector/pgvector:pg18` on host `127.0.0.1:5433`, volume `ticketloom_postgres_data_v3` — **separate** from Homebrew `:5432`

## Safe commands

```bash
npm run db:deploy    # prisma migrate deploy (production / Docker)
npm run db:migrate   # prisma migrate dev (local schema work only)
```

Never use `prisma migrate reset` against shared data. Never `docker compose down -v` unless intentionally wiping **Docker** volumes.

## Migration order note (M14)

`realtime_chat` was renamed to `20260904075000_realtime_chat` so fresh `migrate deploy` runs after ticketing/CRM (creates `customers` / `tickets`). Existing databases that recorded the old name need a one-time history rename (data unchanged):

```sql
UPDATE "_prisma_migrations"
SET "migration_name" = '20260904075000_realtime_chat'
WHERE "migration_name" = '20260904050219_realtime_chat';
```

## Configuration

Prisma 7 keeps the datasource URL in `prisma.config.ts` (not in `schema.prisma`).

```bash
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/ticketloom?schema=public
```

## Models

### Milestone 2

- `User`
- `Account`
- `Session`
- `VerificationToken`
- `Organization`
- `Membership`

### Milestone 3 additions

- `User.activeOrganizationId` → optional FK to `Organization`
- `Membership.status` (`ACTIVE` | `INVITED` | `DEACTIVATED`)
- `MembershipRole` adds `VIEWER` (keeps legacy `MANAGER` / `CUSTOMER`)
- `OrganizationInvitation` (hashed token, expiry, status)

```text
User
 ├── activeOrganization → Organization?
 ├── Accounts / Sessions
 ├── Memberships → Organization
 └── InvitationsSent → OrganizationInvitation

Organization
 ├── Memberships
 └── Invitations
```

### Milestone 5 additions

- Extended `Customer` CRM fields + status/archive
- `CustomerTag`, `CustomerNote`, `CustomerActivity`
- Enums: `CustomerStatus`, `CustomerActivityType`

## Indexes

- `users.email` unique
- `users.active_organization_id`
- `organizations.slug` unique
- `memberships (userId, organizationId)` unique
- `memberships.organizationId`
- `memberships.userId`
- `memberships (organizationId, status)`
- `organization_invitations.token_hash` unique
- `organization_invitations.organizationId`
- `organization_invitations.email`
- `organization_invitations (organizationId, email, status)`
- `organization_invitations.expiresAt`

## Commands

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:studio
```

## Seed

Seed creates:

- `owner@ticketloom.local`
- organization `ticketloom-dev`
- OWNER membership (`ACTIVE`)
- `activeOrganizationId` set

Password comes from `SEED_USER_PASSWORD` — never hardcoded.

## Migrations

- `prisma/migrations/20260904031728_auth_foundation`
- `prisma/migrations/20260904054500_organizations_rbac`
- `prisma/migrations/20260904060000_ticketing_core`
- `prisma/migrations/20260904070000_customer_crm`
- `prisma/migrations/20260904050219_realtime_chat`
- `prisma/migrations/20260904080000_knowledge_base`
- `prisma/migrations/20260904110000_ai_rag_analytics`
- `prisma/migrations/20260904120000_m13_credentials_changed_at` (adds `users.credentials_changed_at`)

Do **not** reset the database between milestones. Apply migrations forward only.


The DB user needs permission to create shadow databases for `prisma migrate dev` (e.g. `ALTER USER ... CREATEDB`). Prefer `prisma migrate deploy` in CI.
