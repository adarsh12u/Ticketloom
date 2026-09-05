# Ticketloom

Multi-tenant customer support platform: tickets, CRM, realtime chat, knowledge base, analytics, and optional local AI/RAG (Ollama + pgvector).

**Interview one-liner:** Ticketloom weaves tickets, chat, knowledge, and AI assistance into one multi-tenant support workspace for B2B teams.

**Repository:** https://github.com/adarsh12u/Ticketloom

## Architecture

```text
Browser
  ├── HTTP  →  Next.js app (:3000)
  └── WS    →  Socket.IO (:3001)
           │
     Auth.js + RBAC + services
           │
     ┌─────┼──────────┐
     ▼     ▼          ▼
 PostgreSQL Redis   BullMQ worker
 + pgvector           ├── SMTP (email)
                      └── Ollama (AI / RAG)
```

## Stack

| Piece | Tech |
|-------|------|
| Web | Next.js 16 (App Router), TypeScript |
| DB | PostgreSQL 18 + Prisma 7 + pgvector |
| Cache / queues / sockets | Redis 7.4, BullMQ, Socket.IO |
| Auth | Auth.js (email/password + optional Google) |
| AI (optional) | Ollama (`llama3.2`, `nomic-embed-text`) |

---

## Choose a setup

| Path | When to use | Postgres |
|------|-------------|----------|
| **A — Local development** | Day-to-day coding (recommended) | Postgres on **:5432** |
| **B — Docker full stack** | Run everything in containers | Docker Postgres on **:5433** |

These databases are **independent**. Do not mix their data.

**Never** run `prisma migrate reset` or `docker compose down -v` unless you intentionally destroy data.

---

## Prerequisites

Install before Path A:

| Tool | Notes |
|------|--------|
| **Node.js 22+** | `node -v` |
| **npm** | comes with Node |
| **Git** | |
| **Docker Desktop** | needed for Redis (`npm run redis:up`) and Path B |
| **PostgreSQL 18** | Path A only |
| **pgvector** | Path A only — extension in Postgres |
| **Ollama** | optional — AI features only |

---

## Path A — Local development (start here)

### 1. Clone and install

```bash
git clone https://github.com/adarsh12u/Ticketloom.git
cd Ticketloom
npm install
```

`npm install` also runs `prisma generate`.

### 2. Create the database

Using `psql` (adjust user if needed):

```bash
createdb ticketloom
psql -d ticketloom -c 'CREATE EXTENSION IF NOT EXISTS vector;'
```

Or inside `psql`:

```sql
CREATE DATABASE ticketloom;
\c ticketloom
CREATE EXTENSION IF NOT EXISTS vector;
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with at least:

```bash
# Generate a secret:
#   openssl rand -base64 48
AUTH_SECRET=paste-generated-secret-here-at-least-32-chars

# Match your local Postgres user/password/host
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/ticketloom?schema=public

REDIS_URL=redis://127.0.0.1:6379

NEXT_PUBLIC_APP_URL=http://localhost:3000
AUTH_URL=http://localhost:3000
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001

# Required for seed login
SEED_USER_PASSWORD=ChangeMeLocal123!

# Local-friendly auth/email (recommended for first run)
AUTH_REQUIRE_EMAIL_VERIFICATION=false
EMAIL_ALLOW_CONSOLE=true
EMAIL_DEV_CONSOLE_FALLBACK=true

# AI optional — mock for no Ollama, or ollama if installed
AI_PROVIDER=mock
AI_ENABLED=true
```

Optional later:

- Google OAuth: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`  
  Redirect URI: `http://localhost:3000/api/auth/callback/google`
- Real SMTP: set `SMTP_*` and `EMAIL_FROM`, then set `EMAIL_ALLOW_CONSOLE=false`

### 4. Migrate and seed

```bash
npm run db:deploy
npm run db:seed
```

Seed login:

- **Email:** `owner@ticketloom.local`
- **Password:** whatever you set in `SEED_USER_PASSWORD`

### 5. Start Redis + app processes

Open **4 terminals** from the project root:

```bash
# Terminal 1 — Redis (Docker)
npm run redis:up

# Terminal 2 — BullMQ worker
npm run worker

# Terminal 3 — Socket.IO
npm run socket

# Terminal 4 — Next.js
npm run dev
```

Open **http://localhost:3000** and sign in with the seed user.

Health checks:

```bash
curl -s http://localhost:3000/api/health
curl -s http://localhost:3001/health
```

### 6. Optional — real local AI (Ollama)

```bash
# Install Ollama from https://ollama.com , then:
ollama pull llama3.2
ollama pull nomic-embed-text
```

In `.env`:

```bash
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
AI_MODEL=llama3.2
AI_EMBEDDING_MODEL=nomic-embed-text
```

Restart `npm run worker` and `npm run dev`.  
If Ollama is down, AI returns `AI_UNAVAILABLE` — the rest of the app still works.

### 7. Stop

```bash
# Ctrl+C on worker, socket, and next
npm run redis:down
```

---

## Path B — Docker full stack

Runs Postgres+pgvector, Redis, Next.js, worker, Socket.IO, and Ollama.

### 1. Prerequisites

- Docker Desktop **running** (`docker info` works)
- ~15+ GB free disk (Ollama image is large)

### 2. Env

```bash
cp .env.docker.example .env.docker
```

Set:

```bash
AUTH_SECRET=$(openssl rand -base64 48)
```

Paste that value into `.env.docker` as `AUTH_SECRET=...`.

For first-run email without SMTP, also add:

```bash
EMAIL_ALLOW_CONSOLE=true
```

### 3. Start

```bash
npm run docker:up
# = docker compose --env-file .env.docker --profile full up -d --build
```

Migrations run via the one-shot `migrate` service before app/worker/socket.

### 4. Verify

```bash
curl -s http://localhost:3000/api/health
curl -s http://localhost:3001/health
docker compose --env-file .env.docker --profile full ps
```

App: **http://localhost:3000**

Optional seed:

```bash
docker compose --env-file .env.docker --profile full run --rm \
  -e SEED_USER_PASSWORD=ChangeMeLocal123! \
  app npm run db:seed
```

Optional AI models:

```bash
docker exec -it ticketloom-ollama ollama pull llama3.2
docker exec -it ticketloom-ollama ollama pull nomic-embed-text
```

### 5. Stop (keeps volumes)

```bash
npm run docker:down
```

**Never** `docker compose down -v` unless you intend to wipe Docker volumes.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `DATABASE_URL is not set` / Prisma errors | Check `.env` exists and `DATABASE_URL` is correct |
| `relation does not exist` | Run `npm run db:deploy` |
| `extension "vector" does not exist` | `CREATE EXTENSION IF NOT EXISTS vector;` in the DB |
| Redis connection errors | `npm run redis:up` and confirm Docker Desktop is running |
| Google button does nothing | Set `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` and restart the app |
| Email jobs fail / unconfigured | Set `EMAIL_ALLOW_CONSOLE=true` locally, or configure SMTP |
| Port 3000/3001/6379 in use | Stop the other process or change ports in `.env` |
| AI 503 `AI_UNAVAILABLE` | Start Ollama + pull models, or set `AI_PROVIDER=mock` |
| Docker daemon EOF / won’t start | Free disk space, restart Docker Desktop, then retry |

---

## Quality checks

```bash
npm run typecheck
npm run lint
npm run test          # mock AI — Ollama not required
npm run build
npm run smoke:auth    # app must already be running
```

CI: `.github/workflows/ci.yml`

---

## Ports

| Service | Port |
|---------|------|
| Next.js | 3000 |
| Socket.IO | 3001 |
| Local Postgres | 5432 |
| Docker Postgres | 5433 (localhost only) |
| Redis | 6379 (localhost only) |
| Ollama | 11434 (localhost only) |

---

## Docs

| Doc | Topic |
|-----|--------|
| `docs/docker.md` | Compose, volumes, healthchecks |
| `docs/deployment.md` | Production sequence |
| `docs/operations.md` | Health, logging, incidents |
| `docs/environment.md` | Environment variables |
| `docs/database.md` | Prisma / migrations |
| `docs/security.md` | Auth, RBAC, tenancy |
| `docs/ai.md` / `docs/rag.md` | AI + RAG |

---

## npm scripts

```bash
npm run dev | start | worker | socket
npm run redis:up | redis:down
npm run docker:up | docker:down | docker:migrate | docker:config
npm run db:deploy | db:migrate | db:seed
npm run test | typecheck | lint | build | smoke:auth
```
