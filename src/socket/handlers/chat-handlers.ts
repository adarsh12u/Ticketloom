import type { Server, Socket } from "socket.io";

import {
  SOCKET_EVENTS,
  assignmentSchema,
  conversationJoinSchema,
  conversationLeaveSchema,
  conversationRoom,
  messageDeleteSchema,
  messageEditSchema,
  messageReadSchema,
  messageSendSchema,
  organizationInboxRoom,
  organizationPresenceRoom,
  typingSchema,
  type SocketAck,
  type SocketErrorCode,
} from "@/lib/chat/socket-events";
import { ChatServiceError, chatService } from "@/services/chat-service";
import { AuthorizationError } from "@/lib/authz/errors";
import type { SocketAuthContext } from "@/socket/auth";
import { assertSocketPermission } from "@/socket/auth";
import { presenceService } from "@/socket/presence";

type AuthedSocket = Socket & { data: { auth: SocketAuthContext } };

function fail(code: SocketErrorCode, message: string): SocketAck<never> {
  return { ok: false, code, message };
}

function mapError(error: unknown): SocketAck<never> {
  if (error instanceof ChatServiceError) {
    const code =
      error.code === "NOT_FOUND"
        ? "NOT_FOUND"
        : error.code === "RATE_LIMITED"
          ? "RATE_LIMITED"
          : error.code === "FORBIDDEN" || error.code === "UNAUTHORIZED"
            ? "UNAUTHORIZED"
            : error.code === "CONFLICT"
              ? "CONFLICT"
              : "VALIDATION_ERROR";
    return fail(code, error.message);
  }
  if (error instanceof AuthorizationError) {
    return fail("UNAUTHORIZED", error.message);
  }
  if (error && typeof error === "object" && "name" in error && error.name === "SocketAuthError") {
    const message = error instanceof Error ? error.message : "UNAUTHORIZED";
    return fail(
      message === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "UNAUTHORIZED",
      message === "UNAUTHENTICATED" ? "Authentication required." : "Not authorized.",
    );
  }
  console.error("[socket] handler error", {
    message: error instanceof Error ? error.message : "unknown",
  });
  return fail("INTERNAL_ERROR", "Unable to process request.");
}

export function registerChatHandlers(io: Server, socket: AuthedSocket) {
  const auth = socket.data.auth;

  socket.join(organizationInboxRoom(auth.organizationId));
  socket.join(organizationPresenceRoom(auth.organizationId));

  socket.on(SOCKET_EVENTS.conversationJoin, async (payload, ack) => {
    try {
      await assertSocketPermission(auth, "chat.read");
      const parsed = conversationJoinSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.(fail("VALIDATION_ERROR", "Invalid join payload."));
        return;
      }

      const join = await chatService.assertCanJoin(auth.userId, parsed.data.conversationId);
      if (join.organizationId !== auth.organizationId) {
        ack?.(fail("UNAUTHORIZED", "Cross-tenant access denied."));
        return;
      }

      const room = conversationRoom(join.organizationId, join.conversationId);
      await socket.join(room);
      console.info("[socket] join", {
        userId: auth.userId,
        organizationId: auth.organizationId,
        conversationId: join.conversationId,
      });
      ack?.({ ok: true, data: { conversationId: join.conversationId, room } });
    } catch (error) {
      ack?.(mapError(error));
    }
  });

  socket.on(SOCKET_EVENTS.conversationLeave, async (payload, ack) => {
    try {
      const parsed = conversationLeaveSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.(fail("VALIDATION_ERROR", "Invalid leave payload."));
        return;
      }
      const room = conversationRoom(auth.organizationId, parsed.data.conversationId);
      await socket.leave(room);
      ack?.({ ok: true, data: { conversationId: parsed.data.conversationId } });
    } catch (error) {
      ack?.(mapError(error));
    }
  });

  socket.on(SOCKET_EVENTS.messageSend, async (payload, ack) => {
    try {
      await assertSocketPermission(auth, "chat.update");
      const parsed = messageSendSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.(fail("VALIDATION_ERROR", "Invalid message payload."));
        return;
      }

      const result = await chatService.sendMessage(auth.userId, parsed.data);
      if (result.organizationId !== auth.organizationId) {
        ack?.(fail("UNAUTHORIZED", "Cross-tenant access denied."));
        return;
      }

      const room = conversationRoom(result.organizationId, result.conversationId);
      io.to(room).emit(SOCKET_EVENTS.messageNew, {
        message: result.message,
        created: result.created,
      });
      io.to(organizationInboxRoom(result.organizationId)).emit(
        SOCKET_EVENTS.conversationUpdated,
        {
          conversationId: result.conversationId,
          lastMessagePreview: result.message.body.slice(0, 280),
          lastMessageAt: result.message.createdAt,
        },
      );
      io.to(organizationInboxRoom(result.organizationId)).emit(SOCKET_EVENTS.unreadUpdated, {
        conversationId: result.conversationId,
      });

      ack?.({ ok: true, data: { message: result.message, created: result.created } });
    } catch (error) {
      ack?.(mapError(error));
    }
  });

  socket.on(SOCKET_EVENTS.messageRead, async (payload, ack) => {
    try {
      await assertSocketPermission(auth, "chat.read");
      const parsed = messageReadSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.(fail("VALIDATION_ERROR", "Invalid read payload."));
        return;
      }
      const result = await chatService.markRead(auth.userId, parsed.data);
      if (result.organizationId !== auth.organizationId) {
        ack?.(fail("UNAUTHORIZED", "Cross-tenant access denied."));
        return;
      }
      const room = conversationRoom(result.organizationId, result.conversationId);
      socket.to(room).emit(SOCKET_EVENTS.messageRead, {
        conversationId: result.conversationId,
        messageId: result.messageId,
        userId: result.userId,
      });
      socket.emit(SOCKET_EVENTS.unreadUpdated, {
        conversationId: result.conversationId,
        unreadCount: result.unreadCount,
      });
      ack?.({ ok: true, data: result });
    } catch (error) {
      ack?.(mapError(error));
    }
  });

  socket.on(SOCKET_EVENTS.typingStart, async (payload) => {
    try {
      await assertSocketPermission(auth, "chat.update");
      const parsed = typingSchema.safeParse(payload);
      if (!parsed.success) return;
      await chatService.assertCanJoin(auth.userId, parsed.data.conversationId);
      const room = conversationRoom(auth.organizationId, parsed.data.conversationId);
      socket.to(room).emit(SOCKET_EVENTS.typingStart, {
        conversationId: parsed.data.conversationId,
        userId: auth.userId,
      });
    } catch {
      // ephemeral — ignore unauthorized typing
    }
  });

  socket.on(SOCKET_EVENTS.typingStop, async (payload) => {
    try {
      const parsed = typingSchema.safeParse(payload);
      if (!parsed.success) return;
      const room = conversationRoom(auth.organizationId, parsed.data.conversationId);
      socket.to(room).emit(SOCKET_EVENTS.typingStop, {
        conversationId: parsed.data.conversationId,
        userId: auth.userId,
      });
    } catch {
      // ignore
    }
  });

  socket.on(SOCKET_EVENTS.assignmentUpdated, async (payload, ack) => {
    try {
      await assertSocketPermission(auth, "chat.assign");
      const parsed = assignmentSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.(fail("VALIDATION_ERROR", "Invalid assignment payload."));
        return;
      }
      const conversation = await chatService.assign(auth.userId, parsed.data);
      if (conversation.organizationId !== auth.organizationId) {
        ack?.(fail("UNAUTHORIZED", "Cross-tenant access denied."));
        return;
      }
      const room = conversationRoom(auth.organizationId, conversation.id);
      io.to(room).emit(SOCKET_EVENTS.assignmentUpdated, { conversation });
      io.to(organizationInboxRoom(auth.organizationId)).emit(
        SOCKET_EVENTS.conversationUpdated,
        { conversation },
      );
      ack?.({ ok: true, data: { conversation } });
    } catch (error) {
      ack?.(mapError(error));
    }
  });

  socket.on(SOCKET_EVENTS.messageEdited, async (payload, ack) => {
    try {
      const parsed = messageEditSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.(fail("VALIDATION_ERROR", "Invalid edit payload."));
        return;
      }
      const result = await chatService.editMessage(auth.userId, parsed.data);
      if (result.organizationId !== auth.organizationId) {
        ack?.(fail("UNAUTHORIZED", "Cross-tenant access denied."));
        return;
      }
      const room = conversationRoom(auth.organizationId, parsed.data.conversationId);
      io.to(room).emit(SOCKET_EVENTS.messageEdited, { message: result.message });
      ack?.({ ok: true, data: { message: result.message } });
    } catch (error) {
      ack?.(mapError(error));
    }
  });

  socket.on(SOCKET_EVENTS.messageDeleted, async (payload, ack) => {
    try {
      const parsed = messageDeleteSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.(fail("VALIDATION_ERROR", "Invalid delete payload."));
        return;
      }
      const result = await chatService.deleteMessage(auth.userId, parsed.data);
      if (result.organizationId !== auth.organizationId) {
        ack?.(fail("UNAUTHORIZED", "Cross-tenant access denied."));
        return;
      }
      const room = conversationRoom(auth.organizationId, parsed.data.conversationId);
      io.to(room).emit(SOCKET_EVENTS.messageDeleted, { message: result.message });
      ack?.({ ok: true, data: { message: result.message } });
    } catch (error) {
      ack?.(mapError(error));
    }
  });
}

export async function bootstrapPresence(io: Server, socket: AuthedSocket) {
  const auth = socket.data.auth;
  const result = await presenceService.trackConnect(
    auth.organizationId,
    auth.userId,
    socket.id,
  );
  io.to(organizationPresenceRoom(auth.organizationId)).emit(SOCKET_EVENTS.presenceUpdate, {
    userId: auth.userId,
    online: true,
    connectionCount: result.connectionCount,
  });
}

export async function teardownPresence(io: Server, socket: AuthedSocket) {
  const auth = socket.data.auth;
  if (!auth) return;
  const result = await presenceService.trackDisconnect(
    auth.organizationId,
    auth.userId,
    socket.id,
  );
  if (!result.online) {
    io.to(organizationPresenceRoom(auth.organizationId)).emit(SOCKET_EVENTS.presenceUpdate, {
      userId: auth.userId,
      online: false,
      connectionCount: 0,
    });
  }
}
