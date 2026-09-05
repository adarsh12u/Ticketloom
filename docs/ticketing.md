# Ticketing

## Overview

Milestone 4 delivers the organization-scoped customer support ticketing core.

Every ticket belongs to an `Organization`. All reads/writes resolve the caller's **active organization membership** and required `tickets.*` permission on the server.

## Models

- `Customer` — org-scoped foundation (full CRM later)
- `Team` — assignment group
- `Tag` — labels
- `TicketCounter` — atomic per-org sequence for `TKT-000001`
- `Ticket` — core case record + SLA timestamps
- `TicketTag` — M2M
- `TicketMessage` — `INTERNAL` notes vs `CUSTOMER` replies
- `TicketActivity` — persisted timeline events

## Ticket number

`TicketCounter` uses:

```sql
INSERT … ON CONFLICT DO UPDATE SET last_number = last_number + 1 RETURNING last_number
```

inside a transaction with ticket creation — safe under concurrency.

## RBAC

| Permission | OWNER | ADMIN | AGENT | VIEWER |
|------------|-------|-------|-------|--------|
| tickets.read | ✓ | ✓ | ✓ | ✓ |
| tickets.create | ✓ | ✓ | ✓ | |
| tickets.update | ✓ | ✓ | ✓ | |
| tickets.assign | ✓ | ✓ | ✓ | |
| tickets.delete | ✓ | ✓ | | |

## API

- `GET/POST /api/tickets`
- `GET /api/tickets/meta`
- `GET/PATCH/DELETE /api/tickets/[id]` (DELETE = archive)
- `POST /api/tickets/[id]/messages`
- `GET/POST /api/customers`
- `GET/POST /api/teams`
- `GET/POST /api/tags`

## UI

- `/tickets` — search, filters, sort, pagination
- `/tickets/new`
- `/tickets/[id]` — properties, conversation, internal notes, activity

## Security

- Never trust client `organizationId` / role / userId
- Ticket loads always scoped by authenticated membership org
- Assignees/customers/teams/tags must belong to the same org
- Internal notes are separate from customer-visible messages
