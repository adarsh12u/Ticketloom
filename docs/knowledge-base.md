# Knowledge Base (Milestone 9)

## Purpose

Organization-scoped knowledge management so support teams can create, review, publish, search, and improve reusable articles. This is the trusted content layer for later AI/RAG (M10/M11) — **no AI is implemented in M9**.

## Architecture

```text
Organization
  → KnowledgeBase (default auto-created)
    → Categories (tree)
    → Tags
    → Articles
      → Versions (immutable history)
      → Feedback / Views / Activities
  → Search events (analytics)
```

Layering: Route → Controller → `knowledgeService` → `knowledgeRepository` → Prisma/PostgreSQL.

## Article lifecycle

```text
DRAFT → IN_REVIEW → PUBLISHED
PUBLISHED → DRAFT (unpublish / continue editing)
PUBLISHED → ARCHIVED
ARCHIVED → DRAFT (restore)
```

- **VIEWER**: read published (and PUBLIC) articles
- **AGENT**: create/edit own drafts, submit for review (cannot publish)
- **ADMIN/OWNER**: review, publish, archive, manage categories/tags

Permissions: `knowledge.read|create|update|delete|review|publish|archive|manage`

## Versioning

Every meaningful content change creates a new `KnowledgeArticleVersion`.

- `currentVersionId` — working version
- `publishedVersionId` — last published snapshot
- Restore creates a **new** version from an older one (history never destroyed)

Content is stored as **Markdown** (`bodyMarkdown`) plus plain `bodyText` for search/AI readiness. Render with `renderSafeMarkdown` (HTML escaped first — XSS safe).

## Search

PostgreSQL full-text search via generated `search_vector` (GIN) on title/excerpt/body_text with `ts_rank`.

Always filtered by `organizationId` from the authenticated membership — never from the client.

## Caching (Redis)

Org-scoped keys:

- `org:{orgId}:knowledge:summary`
- `org:{orgId}:knowledge:popular`
- `org:{orgId}:knowledge:{kbId}:categories`

Invalidated on writes. Falls back to Postgres if Redis is down.

## BullMQ

Maintenance job `knowledge-analytics-rollup` (hourly):

- Reconciles `viewCount` from `knowledge_article_views`
- Prunes search events older than 90 days

## Integrations

- **Dashboard** — live KB counts + top article
- **Tickets** — “Search knowledge” sheet (seeds query from subject)
- **Chat** — “Knowledge” sheet in conversation header

## Routes

| Path | Purpose |
|------|---------|
| `/knowledge` | Library + search |
| `/knowledge/new` | Create |
| `/knowledge/[id]` | Read |
| `/knowledge/[id]/edit` | Edit |
| `/knowledge/[id]/versions` | History |
| `/knowledge/categories` | Category admin |
| `/knowledge/analytics` | Analytics |

## Future AI/RAG hooks (not implemented)

- `bodyText` + version history are clean retrieval units
- Published-only filter is already enforced for readers
- Search events / feedback feed quality signals for ranking

## Local development

No paid search/AI required — PostgreSQL + Redis + existing workers.

```bash
npm run redis:up
npm run worker
npm run dev
```
