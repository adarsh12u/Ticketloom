# Docker

## Principles

- **Homebrew Postgres on `:5432` and Docker Postgres on `:5433` are separate.**
- Docker Postgres uses volume `ticketloom_postgres_data_v3` (new empty DB on first start).
- **Never** run `docker compose down -v` unless you intentionally delete Docker volumes.
- **Never** run `prisma migrate reset` for shared/production data.

## Services

| Service | Image | Host port | Profile |
|---------|-------|-----------|---------|
| `redis` | `redis:7.4-alpine` | `127.0.0.1:6379` | default |
| `postgres` | `pgvector/pgvector:pg18` | `127.0.0.1:5433` | `full` |

Postgres 18 mounts volume `ticketloom_postgres_data_v3` at `/var/lib/postgresql` (image requirement). Separate from Homebrew data on host `:5432`.
| `ollama` | `ollama/ollama:0.6.5` | `127.0.0.1:11434` | `full` |
| `migrate` | app image | — | `full` (one-shot) |
| `app` | Dockerfile | `3000` | `full` |
| `worker` | Dockerfile | — | `full` |
| `socket` | Dockerfile | `3001` | `full` |

Redis/Postgres/Ollama bind to **localhost only** (not public `0.0.0.0`).

## Development (Homebrew Postgres)

```bash
npm run redis:up          # redis only
# DATABASE_URL=...@localhost:5432/...
npm run db:deploy         # or db:migrate during development
npm run worker
npm run socket
npm run dev
```

## Full Docker stack

```bash
cp .env.docker.example .env.docker
# set AUTH_SECRET (and SMTP/Google as needed)

docker compose --env-file .env.docker config   # validate
docker compose --env-file .env.docker --profile full up -d --build
# migrate runs once before app/worker/socket (service_completed_successfully)

# Optional: pull models (NOT automatic during image build)
docker exec -it ticketloom-ollama ollama pull llama3.2
docker exec -it ticketloom-ollama ollama pull nomic-embed-text
```

Manual migrate (if needed):

```bash
npm run docker:migrate
```

Stop without deleting volumes:

```bash
npm run docker:down
# equivalent: docker compose --profile full down
```

## Health checks

- Postgres: `pg_isready`
- Redis: `redis-cli ping`
- App: `GET /api/health`
- Socket: `GET /health`
- Worker: Redis ping from process
- Ollama: `ollama list`

## Worker scaling

Default compose runs **one** worker container. To scale:

```bash
docker compose --env-file .env.docker --profile full up -d --scale worker=2
```

Repeatable SLA/analytics jobs use fixed job ids — safe with multiple workers. Do not run duplicate custom schedulers outside BullMQ.

## Image

Multi-stage `Dockerfile`:

1. `deps` — `npm ci`
2. `builder` — `prisma generate` + `next build`
3. `runner` — pruned production deps + prisma CLI + `tsx` for worker/socket

Entrypoints:

- App: `npm run start`
- Worker: `npm run worker`
- Socket: `npm run socket`
- Migrate: `npx prisma migrate deploy`
