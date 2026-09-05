# Real-time Chat & Communication (Milestone 8)

## Architecture

```text
Browser (socket.io-client)
  → Socket.IO server (`npm run socket`, port 3001)
      → auth middleware (Auth.js JWT cookie)
      → event handlers
      → chatService
      → conversationRepository
      → PostgreSQL

HTTP APIs (`/api/chat/*`) share the same service layer for history, lists, and ticket/customer links.

Redis:
  - Socket.IO `@socket.io/redis-adapter` (pub/sub) for multi-node broadcast
  - Presence connection sets (`presence:org:{orgId}:user:{userId}:connections`)
  - Existing rate limiting for message/conversation creation
```

PostgreSQL remains the source of truth for conversations and messages.

## Local development

```bash
npm run redis:up
npm run socket    # Socket.IO on :3001
npm run worker    # optional background jobs
npm run dev       # Next.js on :3000
```

Environment:

```bash
REDIS_URL=redis://127.0.0.1:6379
SOCKET_PORT=3001
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
AUTH_SECRET=...
```

Never expose `REDIS_URL` to the browser.

## Socket authentication

Every connection is authenticated via Auth.js JWT session cookie (`authjs.session-token`).

The server:

1. Decodes the JWT with `AUTH_SECRET`
2. Loads the user
3. Resolves **active organization membership** from the database
4. Rejects unauthenticated / non-member sockets

Client-supplied `userId`, `organizationId`, and `role` are ignored.

## Room strategy

| Room | Purpose |
|------|---------|
| `org:{organizationId}:conversation:{conversationId}` | Message / typing events |
| `org:{organizationId}:inbox` | Conversation list updates / unread |
| `org:{organizationId}:presence` | Online / offline |

Join requires `chat.read` + conversation exists in the user’s organization.

## Typed events

See `src/lib/chat/socket-events.ts`:

- `conversation:join` / `leave`
- `message:send` / `message:new`
- `message:read`
- `typing:start` / `stop` (ephemeral, not persisted)
- `presence:update`
- `conversation:updated`
- `assignment:updated`
- `unread:updated`

Important writes use Socket.IO acknowledgements:

```ts
{ ok: true, data } | { ok: false, code, message }
```

Codes: `UNAUTHENTICATED`, `UNAUTHORIZED`, `NOT_FOUND`, `VALIDATION_ERROR`, `RATE_LIMITED`, `CONFLICT`, `INTERNAL_ERROR`.

## Message persistence & idempotency

Flow: validate → authorize → rate limit → DB transaction → emit.

`clientMessageId` (UUID) is unique per conversation (`@@unique([conversationId, clientMessageId])`). Retries return the existing row instead of duplicating.

## Presence

Redis sets track socket IDs per user. A user stays online while any connection remains (multi-tab safe). TTLs refresh on heartbeat/connect.

## Read receipts & unread

`ConversationParticipant.lastReadAt` + `MessageReadState` power unread counts without scanning entire histories on every UI render. Unread map is refreshed over the inbox room.

## RBAC

Permissions: `chat.read`, `chat.create`, `chat.update`, `chat.assign`.

| Role | Access |
|------|--------|
| OWNER / ADMIN | full |
| AGENT | read/create/update/assign |
| VIEWER | read only |

## Ticket / customer integration

- Ticket detail → **Open chat** (`/chat?ticketId=…`) creates or opens the linked conversation
- Customer detail → **Conversations** (`/chat?customerId=…`)
- Chat context panel links back to ticket + customer profile
- One conversation per ticket (`@@unique([organizationId, ticketId])` when ticket is set)

## Rate limiting

Reuses Redis rate limiter:

- conversation create: `chat:create:{userId}`
- message send: `chat:message:{userId}`

## Reconnect

Client reconnects automatically (`socket.io-client`). On reconnect + conversation select, it re-joins the room and reloads history from HTTP APIs. Do not treat in-memory socket state as durable.

## Security notes

- Cross-tenant joins/messages return `NOT_FOUND` / `UNAUTHORIZED`
- Assignment verifies membership in the active organization
- Typing events require conversation access; unauthorized typing is dropped
- Message bodies are not written to socket auth logs
