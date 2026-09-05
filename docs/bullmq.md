# BullMQ, Background Jobs & Workers (Milestone 7)

## Architecture

```text
Next.js HTTP app                    Worker process
─────────────────                   ──────────────
Route → Service                     src/workers/index.ts
  → deliverEmail / enqueue*           → email worker
  → Queue.add(...)                    → maintenance worker
        │                                    │
        └──────── Redis / BullMQ ────────────┘
```

HTTP handlers **must not** embed worker loops. Start the worker separately:

```bash
npm run redis:up
npm run worker
```

## Packages

- `bullmq@5.x` — queues / workers / retries / delayed / repeatable jobs
- `ioredis@5.x` — shared cache/rate-limit client (separate from BullMQ connections)

BullMQ connections use `maxRetriesPerRequest: null` and **no** `keyPrefix` (incompatible with BullMQ blocking commands).

## Queues

| Queue | Purpose |
|-------|---------|
| `ticketloom-email` | Invitation, password reset, verification emails |
| `ticketloom-maintenance` | Invitation expiry (delayed), ticket SLA scan (repeatable) |

## Email flow

```text
API validates + DB write
  → deliverEmail(...)
      REDIS unset  → sendEmail sync (M2 SMTP/console)
      REDIS set    → enqueueEmail (fail if queue down)
  → return response

Worker → processEmailJob → sendEmail (same M2 service)
```

Deterministic job IDs (`email:{purpose}:{dedupeKey}`) keep enqueue idempotent for the same intent.

## Retries

Default job options:

- `attempts: 5`
- exponential backoff starting at 2s
- `removeOnComplete` / `removeOnFail` capped by count + age

Permanent validation failures in processors throw without inventing success.

## Delayed & repeatable jobs

- **Invitation expiry** — delayed until `expiresAt`; job id `invite-expire:{invitationId}`
- **SLA scan** — repeatable every 5 minutes from the worker boot; manual trigger via admin API

## Ticket SLA processing

`ticket-sla-scan` finds approaching (≤1h) and breached deadlines, then creates activity rows with a daily `metadata.marker` so retries do not spam identical events.

## Concurrency

| Worker | Concurrency |
|--------|-------------|
| email | 5 (IO-bound SMTP) |
| maintenance | 2 |

## Observability

`GET /api/admin/system` (OWNER/ADMIN):

- waiting / active / completed / failed / delayed counts
- recent failed jobs (id, name, attempts, truncated reason — **no payloads**)

## Failure when Redis is unavailable

Producers throw `QueueUnavailableError`. Auth/org flows surface a clear error; they do **not** claim email was queued.

## Commands

```bash
npm run redis:up
npm run worker
npm run dev
npm run test
npm run typecheck
npm run lint
npm run build
```
