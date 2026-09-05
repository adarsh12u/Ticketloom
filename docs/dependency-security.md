# Dependency security review

Performed after M13, before M14. Policy: no `npm audit fix --force`, no Prisma downgrade, no blind upgrades, no Auth.js architecture changes solely for audit noise.

## Snapshot

| Item | Before | After |
|------|--------|-------|
| `bullmq` | `5.58.5` (`^5.58.5`) | `5.81.4` (`^5.81.4`) |
| transitive `uuid` via BullMQ | `9.0.1` (moderate GHSA-w5hq-g745-h8pq) | **removed** (BullMQ uses `crypto.randomUUID` / randomBytes since 5.76.2) |
| `nodemailer` | `8.0.11` | unchanged |
| `prisma` / `@prisma/client` | `7.10.0` | unchanged |

## Applied change: BullMQ only

**Why safe**

- Same major line (v5 → v5); did **not** jump to BullMQ 6.x (`latest` is 6.3.4).
- Upstream fix: [bullmq#4099](https://github.com/taskforcesh/bullmq/pull/4099) shipped in **5.76.2** — replaces `uuid` with Node `crypto`.
- Public API used by Ticketloom (`Queue`, `Worker`, job options, retries, delayed/repeatable jobs) remains on the v5 surface.
- Verified post-install: `node_modules/bullmq` has **no** `uuid` dependency; `npm ls uuid` is empty.

**Compatibility fix required by 5.81.x**

BullMQ now rejects most custom `jobId` values that contain `:`. Ticketloom job id builders in `src/lib/queues/producers.ts` were updated to hyphenated ids (`safeJobId`). This is not a product feature change — only queue idempotency key formatting.

Note: after deploy, restart workers. Old repeatable job keys using colon ids may remain in Redis until cleaned; new keys are `sla-scan-repeatable` and `knowledge-analytics-repeatable`.

## Not changed — documented residual risk

### nodemailer / Auth.js (high) — GHSA-p6gq-j5cr-w38f

| Field | Detail |
|-------|--------|
| Severity | High |
| Affected | `nodemailer` ≤ 9.0.0 |
| Fixed in | `nodemailer` ≥ **9.0.1** |
| Chain | Direct `nodemailer@8.0.11`; also deduped into `@auth/core` / `next-auth` / `@auth/prisma-adapter` |
| Upstream fix | Exists as a **major** bump (8 → 9) |
| Why not applied now | Major version; requires deliberate compatibility check. Ticketloom does not use Auth.js Nodemailer magic-link provider architecture change. Our SMTP path uses only `createTransport` / `sendMail` (no message `raw`). |
| Mitigation | Do not pass untrusted `raw` message bodies; do not enable file/URL attachment resolution from user input. Monitor Auth.js peer guidance before adopting nodemailer 9. |

### Prisma CLI transitive: deepmerge-ts / mysql2 (high)

| Package | Path | Runtime for Ticketloom app? |
|---------|------|----------------------------|
| `deepmerge-ts@7.1.5` | `prisma` → `@prisma/config` | **No** — Prisma **CLI / config** (devDependency) |
| `mysql2@3.15.3` | `prisma` → `mysql2` | **No** — unused; app uses **PostgreSQL** via `pg` + `@prisma/adapter-pg` |

`npm audit` may suggest `prisma@6.19.3` via `--force`. That is a **major downgrade** and is **forbidden**. Keep Prisma 7.10.0 until official Prisma 7 patches land.

## Re-audit guidance

```bash
npm audit --omit=dev
npm ls bullmq uuid nodemailer
```

Expect the BullMQ/uuid moderate finding to be gone. Nodemailer and Prisma-CLI transitive advisories may remain until upstream majors/patches are adopted deliberately.
