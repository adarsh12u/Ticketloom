import { z } from "zod";

export const ticketIdBodySchema = z.object({
  ticketId: z.string().min(1),
});

export const conversationSummaryBodySchema = z
  .object({
    ticketId: z.string().min(1).optional(),
    conversationId: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    const hasTicket = Boolean(value.ticketId);
    const hasConversation = Boolean(value.conversationId);
    if (hasTicket === hasConversation) {
      ctx.addIssue({
        code: "custom",
        message: "Provide exactly one of ticketId or conversationId.",
      });
    }
  });

export const suggestReplyBodySchema = z.object({
  ticketId: z.string().min(1).optional(),
  conversationId: z.string().min(1).optional(),
  includeKnowledge: z.boolean().optional().default(true),
});

export const toneTransformBodySchema = z.object({
  text: z.string().trim().min(1).max(8_000),
  tone: z.enum(["professional", "friendly", "empathetic", "concise"]),
  suggestionId: z.string().min(1).max(64).optional(),
});

export const knowledgeSuggestionsBodySchema = z.object({
  query: z.string().trim().min(1).max(2_000),
  ticketId: z.string().min(1).optional(),
  conversationId: z.string().min(1).optional(),
});

export const suggestionEventBodySchema = z.object({
  suggestionId: z.string().min(1).max(64),
  feature: z.enum([
    "TICKET_SUMMARY",
    "CONVERSATION_SUMMARY",
    "REPLY_SUGGESTION",
    "TONE_TRANSFORM",
    "KNOWLEDGE_SEARCH",
    "RAG_ANSWER",
  ]),
  eventType: z.enum([
    "INSERTED",
    "EDITED",
    "SENT",
    "FEEDBACK_HELPFUL",
    "FEEDBACK_NOT_HELPFUL",
  ]),
});

export type ToneTransformBody = z.infer<typeof toneTransformBodySchema>;
export type SuggestionEventBody = z.infer<typeof suggestionEventBodySchema>;
