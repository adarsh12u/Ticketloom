import { z } from "zod";

export const createConversationSchema = z.object({
  customerId: z.string().min(1),
  ticketId: z.string().min(1).optional().nullable(),
  subject: z.string().trim().max(200).optional().nullable(),
  assignedAgentId: z.string().min(1).optional().nullable(),
});

export const listConversationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  q: z.string().trim().max(200).optional(),
  status: z.enum(["OPEN", "PENDING", "RESOLVED", "CLOSED"]).optional(),
  customerId: z.string().min(1).optional(),
  ticketId: z.string().min(1).optional(),
});

export const listMessagesSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const assignConversationSchema = z.object({
  assigneeId: z.string().min(1).nullable(),
});

export const updateConversationStatusSchema = z.object({
  status: z.enum(["OPEN", "PENDING", "RESOLVED", "CLOSED"]),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type ListConversationsInput = z.infer<typeof listConversationsSchema>;
