import "dotenv/config";
import { createServer } from "node:http";

import { createAdapter } from "@socket.io/redis-adapter";
import { Server } from "socket.io";

import { requireServerEnv } from "@/lib/env";
import { authenticateSocketHandshake } from "@/socket/auth";
import {
  bootstrapPresence,
  registerChatHandlers,
  teardownPresence,
} from "@/socket/handlers/chat-handlers";
import { createSocketAdapterClients } from "@/socket/presence";

function resolveCorsOrigins(): string | string[] {
  const fromEnv = process.env.SOCKET_CORS_ORIGINS?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL;
  return appUrl ?? "http://localhost:3000";
}

const port = Number(process.env.SOCKET_PORT ?? 3001);

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SKIP_ENV_VALIDATION !== "true") {
    requireServerEnv();
  }

  const httpServer = createServer((req, res) => {
    const path = req.url?.split("?")[0] ?? "/";
    if (path === "/health" || path === "/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", service: "ticketloom-socket" }));
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "not_found" }));
  });

  const io = new Server(httpServer, {
    cors: {
      origin: resolveCorsOrigins(),
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  const adapterClients = createSocketAdapterClients();
  if (adapterClients) {
    try {
      if (adapterClients.pubClient.status !== "ready") {
        await adapterClients.pubClient.connect();
      }
      if (adapterClients.subClient.status !== "ready") {
        await adapterClients.subClient.connect();
      }
      io.adapter(createAdapter(adapterClients.pubClient, adapterClients.subClient));
      console.info("[socket] Redis adapter enabled");
    } catch (error) {
      console.error("[socket] Redis adapter failed; continuing single-node", {
        message: error instanceof Error ? error.message : "unknown",
      });
    }
  } else {
    console.info("[socket] REDIS_URL unset — running without Redis adapter");
  }

  io.use(async (socket, next) => {
    try {
      const auth = await authenticateSocketHandshake(socket.handshake);
      socket.data.auth = auth;
      next();
    } catch (error) {
      console.info("[socket] auth rejected", {
        message: error instanceof Error ? error.message : "unknown",
      });
      next(new Error("UNAUTHENTICATED"));
    }
  });

  io.on("connection", (socket) => {
    const auth = socket.data.auth;
    console.info("[socket] connected", {
      socketId: socket.id,
      userId: auth?.userId,
      organizationId: auth?.organizationId,
    });

    void bootstrapPresence(io, socket as never);
    registerChatHandlers(io, socket as never);

    socket.on("disconnect", (reason) => {
      console.info("[socket] disconnected", {
        socketId: socket.id,
        userId: auth?.userId,
        reason,
      });
      void teardownPresence(io, socket as never);
    });
  });

  httpServer.listen(port, () => {
    console.info(`[socket] Ticketloom Socket.IO listening on :${port}`);
  });

  const shutdown = async (signal: string) => {
    console.info(`[socket] shutting down (${signal})`);
    await new Promise<void>((resolve) => io.close(() => resolve()));
    if (adapterClients) {
      adapterClients.pubClient.disconnect();
      adapterClients.subClient.disconnect();
    }
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error("[socket] fatal", error instanceof Error ? error.message : error);
  process.exit(1);
});
