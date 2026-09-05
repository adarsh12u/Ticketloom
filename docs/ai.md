# AI Assistance (Milestone 10)

Ticketloom AI features help agents summarize tickets/conversations, draft replies, transform tone, and query the knowledge base. **AI never auto-sends messages** — every draft must be inserted and sent by a human.

## Providers

| Env | Purpose |
|-----|---------|
| `AI_PROVIDER` | `ollama` (default) or `mock` (tests) |
| `OLLAMA_BASE_URL` | Default `http://localhost:11434` |
| `AI_MODEL` | Generation model — default `llama3.2` |
| `AI_EMBEDDING_MODEL` | Embeddings — default `nomic-embed-text` (768-dim) |
| `AI_ENABLED` | `true`/`false` |

When the provider is down, endpoints return **`AI_UNAVAILABLE` (503)**. Ticketloom does **not** invent fake answers while the real provider is unavailable. Use `AI_PROVIDER=mock` only for automated tests.

## Local Ollama setup

Models are **not** auto-downloaded by the app.

```bash
# Install Ollama (macOS / Linux) — see https://ollama.com
ollama serve

# Pull required models manually
ollama pull llama3.2
ollama pull nomic-embed-text
```

Verify:

```bash
curl http://localhost:11434/api/tags
```

## Permissions

- Permission key: `ai.use`
- Granted to **AGENT**, **ADMIN**, **OWNER** (and legacy MANAGER)
- **VIEWER** / **CUSTOMER** cannot use AI

## Sync vs async

- Summaries, reply suggestions, tone transform, knowledge Q&A: **synchronous** HTTP
- Knowledge indexing for RAG: **BullMQ** queue `ticketloom-knowledge-indexing`

## Acceptance tracking

Suggestion lifecycle events are recorded separately:

- `GENERATED` / `INSERTED` / `EDITED` / `SENT`
- `FEEDBACK_HELPFUL` / `FEEDBACK_NOT_HELPFUL`

Prompts are **not** stored in `AiUsageEvent` by default.

## API

- `POST /api/ai/ticket-summary`
- `POST /api/ai/conversation-summary` — `{ ticketId }` or `{ conversationId }`
- `POST /api/ai/suggest-reply`
- `POST /api/ai/tone-transform`
- `POST /api/ai/knowledge-suggestions`
- `POST /api/ai/suggestion-events`
- `GET /api/ai/status`

Rate limit: ~20 requests/minute per user.
