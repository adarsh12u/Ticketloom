# Deployment

## Architecture

```text
Browser
  ├── HTTPS → Next.js (app)        :3000
  └── WSS/WS → Socket.IO (socket)  :3001
         │
         ▼
   Application services
         │
    ┌────┼──────────────┐
    ▼    ▼              ▼
 Postgres Redis      BullMQ worker
 +pgvector              │
    │                   ├── SMTP (email)
    │                   └── Ollama (AI/RAG embeddings + generation)
    └── Prisma migrate deploy (one-shot)
```

## Safe production sequence

1. Configure secrets (never commit `.env` / `.env.docker`).
2. Start Postgres + Redis (and Ollama if AI is enabled).
3. Verify connectivity (`pg_isready`, `redis-cli ping`).
4. Run **`prisma migrate deploy`** (never `migrate reset`).
5. Start **app**, **worker**, **socket**.
6. Verify `GET /api/health` and `GET :3001/health`.
7. Pull Ollama models manually if needed.

## Environment

See `.env.example` (host/Homebrew) and `.env.docker.example` (Compose).

Required in production:

- `DATABASE_URL`
- `REDIS_URL`
- `AUTH_SECRET` (≥32 chars)
- `AUTH_URL` / `NEXT_PUBLIC_APP_URL`
- SMTP unless `EMAIL_ALLOW_CONSOLE=true` (not recommended)

Startup validation: `src/lib/env.ts` via `src/instrumentation.ts` (Next.js) and worker/socket entrypoints.

## Security headers

Configured in `next.config.ts`:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy` (camera/mic/geo/payment disabled)
- `Strict-Transport-Security` when `AUTH_URL`/`NEXT_PUBLIC_APP_URL` is `https://`

**CSP** is not set by default (Google OAuth + Socket.IO need a tailored policy at the reverse proxy).

## Networking / CORS

- Socket.IO CORS origin defaults to `NEXT_PUBLIC_APP_URL` / `AUTH_URL`.
- Override with `SOCKET_CORS_ORIGINS` (comma-separated). Do not use `*` with credentials.
- Redis and Postgres are bound to `127.0.0.1` in Compose — put a reverse proxy in front of app/socket only.

## Reverse proxy notes

Terminate TLS at nginx/Caddy/Traefik. Forward:

- `/` → app:3000
- Socket path / port 3001 → socket service (or path-based upgrade)

Set trusted proxy IPs so `x-forwarded-for` rate-limit keys cannot be spoofed.

## CI

GitHub Actions: `.github/workflows/ci.yml`

- Postgres (pgvector) + Redis services
- `AI_PROVIDER=mock` (no Ollama)
- `typecheck`, `lint`, `test`, `build`
