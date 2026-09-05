# Environment Variables

Templates:

- `.env.example` — local Homebrew Postgres development
- `.env.docker.example` — Docker Compose full stack (copy to `.env.docker`)

`.env` and `.env.docker` are gitignored.

## Validation

`src/lib/env.ts` validates configuration. Next.js loads it from `src/instrumentation.ts` on startup. Worker and Socket entrypoints validate in production.

Set `SKIP_ENV_VALIDATION=true` only for special tooling.

## Browser exposure

Only `NEXT_PUBLIC_*` keys reach the client (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SOCKET_URL`). Never put secrets under that prefix.

## Reference

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | yes | Postgres connection string |
| `AUTH_SECRET` | yes | ≥32 characters |
| `AUTH_URL` | prod | Canonical app URL |
| `NEXT_PUBLIC_APP_URL` | recommended | Browser app origin |
| `NEXT_PUBLIC_SOCKET_URL` | recommended | Browser socket origin |
| `REDIS_URL` | prod | Cache, rate limit, BullMQ, Socket adapter |
| `RATE_LIMIT_FAIL_CLOSED` | recommended prod | `true` |
| `SMTP_*` / `EMAIL_FROM` | prod email | Or explicit console escape hatch |
| `GOOGLE_CLIENT_ID/SECRET` | optional | OAuth |
| `AI_*` / `OLLAMA_BASE_URL` | optional | Local AI |
| `SOCKET_PORT` | optional | Default `3001` |
| `SOCKET_CORS_ORIGINS` | optional | Comma-separated allowlist |
