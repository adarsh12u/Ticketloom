# Analytics (Milestone 12)

Organization-scoped support analytics dashboard at **`/analytics`**.

Knowledge-specific analytics remain at **`/knowledge/analytics`**.

## Access

Requires `analytics.read` (VIEWER+).

## API

`GET /api/analytics?range=7|30|90`

Returns aggregates for:

- Support / tickets (created, open, by status, daily volume)
- Customers (total, new in range, active)
- Chat (conversations, messages, by status)
- Knowledge (articles, views, searches, zero-result searches)
- AI (requests, success rate, latency, feature usage, RAG usage, acceptance rates, helpful rate)

Results are cached briefly in Redis under `org:{organizationId}:analytics:dashboard:{range}`.

## Charts

The dashboard uses **Recharts** for ticket volume and AI usage trends, with KPI cards for the selected date range.
