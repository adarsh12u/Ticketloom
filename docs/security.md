# Security (Milestone 13)

This document describes Ticketloom application security controls and known limitations. Items marked **NOT VERIFIED** require manual/ops confirmation before production.

## Authentication

| Control | Status |
|---------|--------|
| bcrypt password hashing (cost 12) | Verified |
| Password reset tokens hashed (SHA-256), single-use, expiring | Verified |
| Invitation tokens hashed, single-use, expiring | Verified |
| Email verification tokens hashed | Verified |
| Credentials login requires verified email in production (`AUTH_REQUIRE_EMAIL_VERIFICATION`, default on when `NODE_ENV=production`) | Fixed in M13 |
| Google OAuth linking blocked for unverified password accounts | Fixed in M13 |
| JWT invalidated after password reset via `credentialsChangedAt` | Fixed in M13 |
| Auth.js session cookies (HttpOnly; `__Secure-` in production) | Relies on Auth.js defaults — **NOT VERIFIED** beyond library defaults |
| Session max age 14 days | Verified in config |

Local development: set `AUTH_REQUIRE_EMAIL_VERIFICATION=false` if SMTP is unavailable.

## Authorization / RBAC

Server-side `requireOrganizationContext` + `requirePermission` on sensitive operations.

| Role | Notes |
|------|-------|
| VIEWER | Read-only; no `ai.use`, no writes |
| AGENT | Operational writes + `ai.use`; cannot invite, publish knowledge, or assign OWNER |
| ADMIN | Management except `organization.delete` and granting OWNER |
| OWNER | Full catalog; only OWNER may assign OWNER |

Privilege escalation (ADMIN → OWNER) is denied server-side (M13).

## Tenant isolation

Organization is derived from the authenticated user's active membership — **never** trusted from the browser for data APIs.

Verified in automated tests for: tickets, customers, chat, knowledge, AI ticket summaries, RAG retrieval, analytics aggregates, Redis cache key prefixes.

Socket rooms use server-resolved `organizationId` from JWT + membership. Client-supplied org/role/userId are ignored during handshake.

## AI / RAG

- Human-in-the-loop: AI never auto-sends customer messages
- Provider unavailable → `AI_UNAVAILABLE` (503); no fabricated answers
- Untrusted ticket/KB content delimited; shallow injection pattern filtering
- Vector search always filters `organization_id` + published articles
- Client-facing AI errors are sanitized (no raw Ollama/network messages)

Prompt-injection defenses are **best-effort**, not perfect.

## Redis / rate limiting

- Cache keys: `org:{organizationId}:…`
- Rate limit keys: `rl:…`
- Production recommendation: `RATE_LIMIT_FAIL_CLOSED=true`
- Default without fail-closed: memory fallback when Redis is down (weaker multi-instance limits)

## Email

- Production fails closed without SMTP unless `EMAIL_ALLOW_CONSOLE=true`
- Console provider never logs email bodies (tokens)

## Secrets

- `.env` / `.env*.local` gitignored
- Browser may only receive `NEXT_PUBLIC_*` (app URL, socket URL)
- Do not log `AUTH_SECRET`, DB/Redis/SMTP credentials, or raw reset tokens

## Logging / errors

API controllers return generic 500 messages; stack traces are not sent to clients.

## Known residual risks

1. Prompt injection via paraphrases (mitigated by HITL)
2. `x-forwarded-for` rate-limit keys require a trusted reverse proxy
3. Knowledge publish succeeds even if RAG index enqueue fails (logged warning; search may be stale)
4. Full Playwright E2E suite not present — critical flows covered by Vitest integration + `smoke:auth`
5. Dependency CVEs: run `npm audit` regularly; do not blind-upgrade
