# RAG (Milestone 11)

Retrieval-Augmented Generation indexes published knowledge articles into `knowledge_chunks` with **pgvector** embeddings and combines vector similarity with Postgres full-text search.

## Database

- Local development uses **Homebrew Postgres 18** with **pgvector 0.8.1** on the `ticketloom` database.
- Migration enables: `CREATE EXTENSION IF NOT EXISTS vector;`
- Embeddings: `vector(768)` for `nomic-embed-text`
- Index: HNSW cosine ops on `knowledge_chunks.embedding`

Do **not** run `prisma migrate reset` against the shared local database.

### Optional Docker Postgres (alternate setups only)

`docker-compose.yml` may include a commented `postgres` + pgvector service on port **5433**. Default `DATABASE_URL` remains Homebrew Postgres on `5432`.

## Indexing

- Queue: `ticketloom-knowledge-indexing`
- Job: `index-knowledge-article`
- Triggered when an article is **published** (index) or **archived / unpublished** (deindex)
- Idempotent: replaces chunks for the article; content hashed per chunk

Worker:

```bash
npm run worker
```

## Hybrid retrieval

1. Embed the query (`nomic-embed-text` via Ollama, or mock in tests)
2. Vector search filtered by `organizationId` + **PUBLISHED** articles only
3. FTS via existing knowledge repository search
4. Normalize ranks, merge by `articleId`, return top chunks

## Privacy

`RagRetrievalEvent` stores a **query hash** and a **120-character preview**, not the full sensitive query by default.
