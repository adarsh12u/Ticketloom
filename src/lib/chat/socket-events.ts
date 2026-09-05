import { z } from "zod";

/** Shared Socket.IO event names — keep server/client in sync. */
export const SOCKET_EVENTS = {
  conversationJoin: "conversation:join",
  conversationLeave: "conversation:leave",
  conversationUpdated: "conversation:updated",
  messageSend: "message:send",
  messageNew: "message:new",
  messageRead: "message:read",
  messageEdited: "message:edited",
  messageDeleted: "message:deleted",
  typingStart: "typing:start",
  typingStop: "typing:stop",
  presenceUpdate: "presence:update",
  assignmentUpdated: "assignment:updated",
  unreadUpdated: "unread:updated",
  error: "error",
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

export const socketErrorCodes = [
  "UNAUTHENTICATED",
  "UNAUTHORIZED",
  "NOT_FOUND",
  "VALIDATION_ERROR",
  "RATE_LIMITED",
  "CONFLICT",
  "INTERNAL_ERROR",
] as const;

export type SocketErrorCode = (typeof socketErrorCodes)[number];

export type SocketAckError = {
  ok: false;
  code: SocketErrorCode;
  message: string;
};

export type SocketAckSuccess<T> = {
  ok: true;
  data: T;
};

export type SocketAck<T> = SocketAckSuccess<T> | SocketAckError;

export const conversationJoinSchema = z.object({
  conversationId: z.string().min(1),
});

export const conversationLeaveSchema = z.object({
  conversationId: z.string().min(1),
});

export const messageSendSchema = z.object({
  conversationId: z.string().min(1),
  body: z.string().trim().min(1).max(10_000),
  clientMessageId: z.string().uuid(),
});

export const messageReadSchema = z.object({
  conversationId: z.string().min(1),
  messageId: z.string().min(1),
});

export const typingSchema = z.object({
  conversationId: z.string().min(1),
});

export const assignmentSchema = z.object({
  conversationId: z.string().min(1),
  assigneeId: z.string().min(1).nullable(),
});

export const messageEditSchema = z.object({
  conversationId: z.string().min(1),
  messageId: z.string().min(1),
  body: z.string().trim().min(1).max(10_000),
});

export const messageDeleteSchema = z.object({
  conversationId: z.string().min(1),
  messageId: z.string().min(1),
});

export function conversationRoom(organizationId: string, conversationId: string) {
  return `org:${organizationId}:conversation:${conversationId}`;
}

export function organizationPresenceRoom(organizationId: string) {
  return `org:${organizationId}:presence`;
}

export function organizationInboxRoom(organizationId: string) {
  return `org:${organizationId}:inbox`;
}
