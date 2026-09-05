# Testing (Milestone 13)

## Strategy

| Layer | Tool | Scope |
|-------|------|-------|
| Unit | Vitest | Markdown XSS, chunking, parse-json, permissions, socket helpers |
| Integration | Vitest + PostgreSQL | Auth, RBAC, tenant isolation, tickets, CRM, chat, KB, AI (mock), RAG, analytics |
| Infrastructure | Vitest + Redis | Cache keys, rate limits, BullMQ producers |
| Smoke | `npm run smoke:auth` | Signup/login/session/logout against running app |

AI tests use `AI_PROVIDER=mock`. They **must not** require Ollama.

## Commands

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run smoke:auth   # requires `npm run dev` (or equivalent) on AUTH_URL
```

Optional:

```bash
npm audit --omit=dev
```

## High-risk coverage (M13 additions)

- ADMIN cannot assign OWNER
- Revoked invitations rejected
- Password reset sets `credentialsChangedAt`
- Reset token cannot be used for a different email
- `AUTH_REQUIRE_EMAIL_VERIFICATION=true` blocks unverified login
- AI_ENABLED=false → AI_UNAVAILABLE
- AI controller 503/502/500 mapping
- Markdown blocks `javascript:` / `data:` hrefs
- RAG cross-org retrieval
- Socket VIEWER denied `chat.update`
- Rate-limit fail-closed / memory fallback
- Chat `assertCanJoin` cross-tenant + VIEWER cannot create

## What is not automated

- Live Google OAuth consent screen
- Live Ollama e2e (optional manual)
- Full Socket.IO multi-client join attacks (unit helpers cover permission/room gates)
- Load / chaos testing of PostgreSQL outages

Do not delete older M1–M12 tests to greenwash failures.
