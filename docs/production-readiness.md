# Production readiness (Milestone 13–14)

Honest checklist. Marks: **PASS**, **FIXED**, **WARNING**, **NOT VERIFIED**.

| Area | Status | Notes |
|------|--------|-------|
| Security (OWASP-oriented) | FIXED / WARNING | See `docs/security.md`; residual prompt-injection & proxy IP trust |
| Authentication | FIXED | Email verification (prod), Google link gate, session invalidation on reset |
| Authorization / RBAC | PASS | Server-side; OWNER assignment restricted |
| Tenant isolation | PASS | Service tests + RAG org filters + Redis key prefix |
| Database | PASS | Forward migrations only; Docker Postgres on :5433 separate from Homebrew |
| Redis | WARNING | Set `RATE_LIMIT_FAIL_CLOSED=true` in multi-instance prod |
| BullMQ | PASS | Dedicated `worker` process/container; scalable via `--scale worker=N` |
| Socket.IO | PASS | JWT + membership; Docker `socket` service on :3001 |
| AI | PASS | HITL; unavailable state; sanitized errors; mock tests |
| RAG | PASS | Org-scoped vectors; published-only; hybrid search |
| Analytics | PASS | Org-scoped aggregates; `/analytics` |
| Docker packaging | PASS | Compose profile `full`, multi-stage Dockerfile, healthchecks |
| CI | PASS | `.github/workflows/ci.yml` (mock AI, no Ollama) |
| Env validation | PASS | `src/lib/env.ts` + instrumentation / worker / socket |
| Security headers | PASS | nosniff, referrer, frame, permissions; CSP deferred (see deployment.md) |
| Performance | WARNING | Member list capped at 500; unread counts still chatty |
| Error handling | PASS | Generic client errors; dependency failures mapped |
| Logging | WARNING | Review log aggregation/alerting in your environment — **NOT VERIFIED** |
| Testing | PASS | Vitest suite + smoke:auth; no Playwright E2E suite |
| Environment | WARNING | Confirm production secrets via secret manager — **NOT VERIFIED** |
| Dependencies | WARNING | See `docs/dependency-security.md` |
| Accessibility | WARNING | Basic semantic UI; no formal a11y audit — **NOT VERIFIED** |

## Required production environment

```bash
NODE_ENV=production
AUTH_SECRET=<long-random>
DATABASE_URL=...
REDIS_URL=...
RATE_LIMIT_FAIL_CLOSED=true
AUTH_REQUIRE_EMAIL_VERIFICATION=true   # default when NODE_ENV=production
# SMTP required (console email disabled unless EMAIL_ALLOW_CONSOLE=true)
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASSWORD=...
EMAIL_FROM=...
NEXT_PUBLIC_APP_URL=https://your.domain
AUTH_URL=https://your.domain
# Optional
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
AI_PROVIDER=ollama
OLLAMA_BASE_URL=...
AI_MODEL=llama3.2
AI_EMBEDDING_MODEL=nomic-embed-text
```

Docker template: `.env.docker.example` → `.env.docker`. See `docs/docker.md` and `docs/deployment.md`.

## Process checklist

1. `prisma migrate deploy` (never `migrate reset`) — Compose runs this via `migrate` service
2. Redis up; worker (`npm run worker`); socket (`npm run socket`)
3. Ollama + models if AI features are enabled (manual `ollama pull`)
4. SMTP configured
5. TLS terminator sets trusted client IP for rate limits
6. Run quality gates in CI

## Not production-ready claims

Do **not** treat this as a full penetration test, compliance certification, or load-test sign-off. Remaining WARNING / NOT VERIFIED items must be owned by the deploying team.
