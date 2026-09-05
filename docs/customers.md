# Customer CRM

## Overview

Milestone 5 delivers an organization-scoped Customer CRM that integrates with ticketing.

Customers are never hard-deleted when they have ticket history — archive/restore is used instead.

## Models

- Extended `Customer` (names, status, source, job title, image, lastActivityAt, archive)
- `CustomerTag` — reuses Milestone 4 `Tag`
- `CustomerNote` — internal-only notes
- `CustomerActivity` — persisted CRM timeline

## Status

`ACTIVE | INACTIVE | PROSPECT | ARCHIVED`

## API

- `GET/POST /api/customers`
- `GET /api/customers/meta`
- `GET/PATCH/DELETE /api/customers/[id]` (DELETE = archive)
- `POST /api/customers/[id]/restore`
- `POST /api/customers/[id]/notes`

## UI

- `/customers` — search, filters, sort, pagination
- `/customers/new`
- `/customers/[id]` — profile, tickets, notes, activity

## Ticket integration

- Customer profile → ticket history + create ticket
- Ticket detail → open customer profile
- Ticket create/resolve/close emits customer activity events

## RBAC

| Permission | OWNER/ADMIN | AGENT | VIEWER |
|------------|-------------|-------|--------|
| customers.read | ✓ | ✓ | ✓ |
| customers.create | ✓ | ✓ | |
| customers.update | ✓ | ✓ | |
| customers.delete (archive) | ✓ | | |
