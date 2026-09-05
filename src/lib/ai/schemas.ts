import { z } from "zod";

export const ticketSummarySchema = z.object({
  summary: z.string().min(1),
  customerIssue: z.string().min(1),
  currentStatus: z.string().min(1),
  nextSteps: z.array(z.string()).default([]),
});

export const conversationSummarySchema = z.object({
  summary: z.string().min(1),
  keyPoints: z.array(z.string()).default([]),
  openQuestions: z.array(z.string()).default([]),
});

export const replySuggestionSchema = z.object({
  reply: z.string().min(1),
  rationale: z.string().optional(),
});

export const toneTransformSchema = z.object({
  rewritten: z.string().min(1),
});

export const knowledgeAnswerSchema = z.object({
  answer: z.string().min(1),
  citations: z
    .array(
      z.object({
        title: z.string(),
        relevance: z.string().optional(),
      }),
    )
    .default([]),
  confidence: z.enum(["low", "medium", "high"]).optional(),
});

export type TicketSummary = z.infer<typeof ticketSummarySchema>;
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;
export type ReplySuggestion = z.infer<typeof replySuggestionSchema>;
export type ToneTransform = z.infer<typeof toneTransformSchema>;
export type KnowledgeAnswer = z.infer<typeof knowledgeAnswerSchema>;
