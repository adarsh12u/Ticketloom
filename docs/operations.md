# Operations

## Processes

| Process | Command | Role |
|---------|---------|------|
| Web | `npm run start` / Compose `app` | Next.js App Router + APIs |
| Worker | `npm run worker` | BullMQ: email, SLA, knowledge indexing |
| Socket | `npm run socket` | Socket.IO realtime chat |
| Migrate | `npm run db:deploy` | Prisma migrate deploy |

## Health

```bash
curl -s http://localhost:3000/api/health
curl -s http://localhost:3001/health
```

`/api/health` reports postgres / redis / worker queue availability without secrets.

## Logging

Do **not** log:

- passwords, `AUTH_SECRET`, DB/Redis/SMTP URLs with credentials
- OAuth client secrets
- session / reset / invitation tokens
- full AI prompts with customer PII (usage events store metadata only)

Prefer short error messages already used by controllers.

## Backups

- Backup **Postgres** (Homebrew data dir or Docker volume `ticketloom_postgres_data`) separately from Redis AOF.
- Docker volume wipe (`down -v`) destroys Docker DB data only — Homebrew data is unaffected but still treat volume deletes as destructive.

## Ollama models

Models are **not** baked into images:

```bash
ollama pull llama3.2
ollama pull nomic-embed-text
# or: docker exec -it ticketloom-ollama ollama pull …
```

When Ollama is down, AI returns `AI_UNAVAILABLE` (503). The rest of the app continues.

## Incidents

| Symptom | Check |
|---------|-------|
| 503 `/api/health` | Postgres/Redis connectivity |
| Emails not sending | Worker running + SMTP / queue depth |
| Chat offline | Socket process + Redis adapter + CORS origins |
| Stale RAG | Worker + `knowledge-indexing` queue; republish article |
| AI unavailable | Ollama health + model pulls |

## Forbidden ops

- `prisma migrate reset`
- `docker compose down -v` (unless intentional wipe of **Docker** volumes)
- Committing `.env` / `.env.docker`
- Exposing Redis/Postgres to the public internet
