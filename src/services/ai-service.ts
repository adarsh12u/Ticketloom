import { requireOrganizationContext, requirePermission } from "@/lib/authz";
import { getAiConfig } from "@/lib/ai/config";
import { parseJsonWithSchema } from "@/lib/ai/parse-json";
import { buildConversationSummaryMessages } from "@/lib/ai/prompts/conversation-summary";
import { buildKnowledgeAnswerMessages } from "@/lib/ai/prompts/knowledge-answer";
import { buildReplySuggestionMessages } from "@/lib/ai/prompts/reply-suggestion";
import {
  buildTicketSummaryMessages,
} from "@/lib/ai/prompts/ticket-summary";
import {
  buildToneTransformMessages,
  type ToneOption,
} from "@/lib/ai/prompts/tone-transform";
import { getAiProvider, resetAiProviderCache } from "@/lib/ai/provider";
import {
  conversationSummarySchema,
  knowledgeAnswerSchema,
  replySuggestionSchema,
  ticketSummarySchema,
  toneTransformSchema,
} from "@/lib/ai/schemas";
import { delimitUntrusted, truncateContext } from "@/lib/ai/safety";
import { AiUnavailableError, AI_UNAVAILABLE } from "@/lib/ai/types";
import { checkRateLimit } from "@/lib/redis/rate-limit";
import { aiUsageRepository } from "@/repositories/ai-usage-repository";
import { conversationRepository } from "@/repositories/conversation-repository";
import { ticketRepository } from "@/repositories/ticket-repository";
import { ragService } from "@/services/rag-service";
import type { AiFeature, AiSuggestionEventType } from "@/generated/prisma/client";

export { resetAiProviderCache };

export class AiServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NOT_FOUND"
      | "VALIDATION"
      | "FORBIDDEN"
      | "RATE_LIMITED"
      | typeof AI_UNAVAILABLE
      | "FAILURE" = "VALIDATION",
  ) {
    super(message);
    this.name = "AiServiceError";
  }
}

async function requireAiAccess(userId: string) {
  const context = await requireOrganizationContext(userId);
  requirePermission(context.role, "ai.use");
  return context;
}

async function assertAiRateLimit(userId: string) {
  const rate = await checkRateLimit(`ai:user:${userId}`, 20, 60_000);
  if (!rate.allowed) {
    throw new AiServiceError(
      "Too many AI requests. Please try again shortly.",
      "RATE_LIMITED",
    );
  }
}

function assertAiEnabled() {
  const config = getAiConfig();
  if (!config.enabled) {
    throw new AiServiceError("AI features are disabled.", AI_UNAVAILABLE);
  }
}

async function recordFailure(params: {
  organizationId: string;
  userId: string;
  feature: AiFeature;
  provider: string;
  model?: string;
  latencyMs?: number;
  error: unknown;
  suggestionId?: string;
}) {
  const code =
    params.error instanceof AiUnavailableError ||
    (params.error instanceof AiServiceError && params.error.code === AI_UNAVAILABLE)
      ? AI_UNAVAILABLE
      : "FAILURE";
  await aiUsageRepository.createUsageEvent({
    organizationId: params.organizationId,
    userId: params.userId,
    feature: params.feature,
    provider: params.provider,
    model: params.model ?? null,
    status: code === AI_UNAVAILABLE ? "UNAVAILABLE" : "FAILURE",
    latencyMs: params.latencyMs ?? null,
    errorCode: code,
    suggestionId: params.suggestionId ?? null,
  });
}

function mapProviderError(error: unknown): never {
  if (error instanceof AiServiceError) throw error;
  if (error instanceof AiUnavailableError) {
    throw new AiServiceError(
      "AI is currently unavailable. Please try again later.",
      AI_UNAVAILABLE,
    );
  }
  // Never forward raw provider/network messages to API clients.
  console.error("[ai] provider failure", {
    message: error instanceof Error ? error.message : "unknown",
  });
  throw new AiServiceError(
    "Unable to complete the AI request. Please try again.",
    "FAILURE",
  );
}

function ticketContextText(ticket: NonNullable<
  Awaited<ReturnType<typeof ticketRepository.findByIdForOrg>>
>) {
  const config = getAiConfig();
  const messages = (ticket.messages ?? [])
    .slice(-40)
    .map(
      (m) =>
        `[${m.visibility}] ${m.author?.name ?? m.author?.email ?? "user"}: ${m.body}`,
    )
    .join("\n");

  return truncateContext(
    [
      delimitUntrusted(
        "ticket",
        [
          `Subject: ${ticket.subject}`,
          `Status: ${ticket.status}`,
          `Priority: ${ticket.priority}`,
          `Type: ${ticket.type}`,
          `Description: ${ticket.description}`,
          ticket.customer
            ? `Customer: ${ticket.customer.name} <${ticket.customer.email}>`
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
      ),
      messages
        ? delimitUntrusted("ticket-messages", messages)
        : "",
    ].filter(Boolean),
    config.maxContextChars,
  );
}

export const aiService = {
  async getStatus(userId: string) {
    const context = await requireAiAccess(userId);
    const config = getAiConfig();
    if (!config.enabled) {
      return {
        available: false,
        provider: config.provider,
        model: config.model,
        embeddingModel: config.embeddingModel,
        reason: "AI_ENABLED=false",
        organizationId: context.organization.id,
      };
    }
    const provider = getAiProvider();
    const health = await provider.health();
    return {
      ...health,
      organizationId: context.organization.id,
    };
  },

  async summarizeTicket(userId: string, ticketId: string) {
    const context = await requireAiAccess(userId);
    await assertAiRateLimit(userId);
    assertAiEnabled();
    const organizationId = context.organization.id;
    const provider = getAiProvider();
    const suggestionId = aiUsageRepository.newSuggestionId();
    const started = Date.now();

    const ticket = await ticketRepository.findByIdForOrg(organizationId, ticketId);
    if (!ticket) {
      throw new AiServiceError("Ticket not found.", "NOT_FOUND");
    }

    try {
      const messages = buildTicketSummaryMessages(ticketContextText(ticket));
      const generated = await provider.generate({
        messages,
        format: "json",
        temperature: 0.2,
      });
      const data = parseJsonWithSchema(generated.text, ticketSummarySchema);

      await aiUsageRepository.createUsageEvent({
        organizationId,
        userId,
        feature: "TICKET_SUMMARY",
        provider: generated.provider,
        model: generated.model,
        status: "SUCCESS",
        latencyMs: generated.latencyMs,
        inputTokens: generated.inputTokens,
        outputTokens: generated.outputTokens,
        suggestionId,
      });
      await aiUsageRepository.createSuggestionEvent({
        organizationId,
        userId,
        suggestionId,
        feature: "TICKET_SUMMARY",
        eventType: "GENERATED",
      });

      return { suggestionId, feature: "TICKET_SUMMARY" as const, data };
    } catch (error) {
      await recordFailure({
        organizationId,
        userId,
        feature: "TICKET_SUMMARY",
        provider: provider.name,
        latencyMs: Date.now() - started,
        error,
        suggestionId,
      });
      mapProviderError(error);
    }
  },

  async summarizeConversation(
    userId: string,
    input: { ticketId?: string; conversationId?: string },
  ) {
    const context = await requireAiAccess(userId);
    await assertAiRateLimit(userId);
    assertAiEnabled();
    const organizationId = context.organization.id;
    const provider = getAiProvider();
    const suggestionId = aiUsageRepository.newSuggestionId();
    const started = Date.now();
    const config = getAiConfig();

    try {
      let transcript = "";
      if (input.ticketId) {
        const ticket = await ticketRepository.findByIdForOrg(
          organizationId,
          input.ticketId,
        );
        if (!ticket) throw new AiServiceError("Ticket not found.", "NOT_FOUND");
        transcript = ticketContextText(ticket);
      } else if (input.conversationId) {
        const conversation = await conversationRepository.findByIdForOrg(
          organizationId,
          input.conversationId,
        );
        if (!conversation) {
          throw new AiServiceError("Conversation not found.", "NOT_FOUND");
        }
        const messages = await conversationRepository.listMessages({
          organizationId,
          conversationId: input.conversationId,
          take: 80,
        });
        const lines = messages.items
          .map(
            (m) =>
              `${m.sender?.name ?? m.sender?.email ?? "user"}: ${m.body}`,
          )
          .join("\n");
        transcript = truncateContext(
          [
            delimitUntrusted(
              "conversation",
              `Subject: ${conversation.subject ?? "(no subject)"}`,
            ),
            delimitUntrusted("chat-transcript", lines),
          ],
          config.maxContextChars,
        );
      } else {
        throw new AiServiceError(
          "Provide ticketId or conversationId.",
          "VALIDATION",
        );
      }

      const generated = await provider.generate({
        messages: buildConversationSummaryMessages(transcript),
        format: "json",
        temperature: 0.2,
      });
      const data = parseJsonWithSchema(generated.text, conversationSummarySchema);

      await aiUsageRepository.createUsageEvent({
        organizationId,
        userId,
        feature: "CONVERSATION_SUMMARY",
        provider: generated.provider,
        model: generated.model,
        status: "SUCCESS",
        latencyMs: generated.latencyMs,
        inputTokens: generated.inputTokens,
        outputTokens: generated.outputTokens,
        suggestionId,
      });
      await aiUsageRepository.createSuggestionEvent({
        organizationId,
        userId,
        suggestionId,
        feature: "CONVERSATION_SUMMARY",
        eventType: "GENERATED",
      });

      return { suggestionId, feature: "CONVERSATION_SUMMARY" as const, data };
    } catch (error) {
      await recordFailure({
        organizationId,
        userId,
        feature: "CONVERSATION_SUMMARY",
        provider: provider.name,
        latencyMs: Date.now() - started,
        error,
        suggestionId,
      });
      mapProviderError(error);
    }
  },

  async suggestReply(
    userId: string,
    input: {
      ticketId?: string;
      conversationId?: string;
      includeKnowledge?: boolean;
    },
  ) {
    const context = await requireAiAccess(userId);
    await assertAiRateLimit(userId);
    assertAiEnabled();
    const organizationId = context.organization.id;
    const provider = getAiProvider();
    const suggestionId = aiUsageRepository.newSuggestionId();
    const started = Date.now();
    const config = getAiConfig();

    try {
      let contextText = "";
      let queryForRag = "";

      if (input.ticketId) {
        const ticket = await ticketRepository.findByIdForOrg(
          organizationId,
          input.ticketId,
        );
        if (!ticket) throw new AiServiceError("Ticket not found.", "NOT_FOUND");
        contextText = ticketContextText(ticket);
        queryForRag = `${ticket.subject}\n${ticket.description}`;
      } else if (input.conversationId) {
        const conversation = await conversationRepository.findByIdForOrg(
          organizationId,
          input.conversationId,
        );
        if (!conversation) {
          throw new AiServiceError("Conversation not found.", "NOT_FOUND");
        }
        const messages = await conversationRepository.listMessages({
          organizationId,
          conversationId: input.conversationId,
          take: 60,
        });
        const lines = messages.items
          .map((m) => `${m.sender?.name ?? "user"}: ${m.body}`)
          .join("\n");
        contextText = truncateContext(
          [
            delimitUntrusted(
              "conversation",
              `Subject: ${conversation.subject ?? "(no subject)"}`,
            ),
            delimitUntrusted("chat-transcript", lines),
          ],
          config.maxContextChars,
        );
        queryForRag = `${conversation.subject ?? ""}\n${lines.slice(-500)}`;
      } else {
        throw new AiServiceError(
          "Provide ticketId or conversationId.",
          "VALIDATION",
        );
      }

      let knowledgeContext: string | undefined;
      let retrievedSourcesCount = 0;
      if (input.includeKnowledge !== false) {
        try {
          const { hits } = await ragService.retrieve({
            organizationId,
            userId,
            query: queryForRag,
          });
          retrievedSourcesCount = hits.length;
          if (hits.length > 0) {
            knowledgeContext = ragService.buildContext(hits);
          }
        } catch {
          // RAG is best-effort for reply suggestions
        }
      }

      const generated = await provider.generate({
        messages: buildReplySuggestionMessages({
          context: contextText,
          knowledgeContext,
        }),
        format: "json",
        temperature: 0.3,
      });
      const data = parseJsonWithSchema(generated.text, replySuggestionSchema);

      await aiUsageRepository.createUsageEvent({
        organizationId,
        userId,
        feature: "REPLY_SUGGESTION",
        provider: generated.provider,
        model: generated.model,
        status: "SUCCESS",
        latencyMs: generated.latencyMs,
        inputTokens: generated.inputTokens,
        outputTokens: generated.outputTokens,
        retrievedSourcesCount,
        suggestionId,
      });
      await aiUsageRepository.createSuggestionEvent({
        organizationId,
        userId,
        suggestionId,
        feature: "REPLY_SUGGESTION",
        eventType: "GENERATED",
      });

      return {
        suggestionId,
        feature: "REPLY_SUGGESTION" as const,
        data,
        retrievedSourcesCount,
        // Human-in-the-loop: never auto-send
        autoSend: false as const,
      };
    } catch (error) {
      await recordFailure({
        organizationId,
        userId,
        feature: "REPLY_SUGGESTION",
        provider: provider.name,
        latencyMs: Date.now() - started,
        error,
        suggestionId,
      });
      mapProviderError(error);
    }
  },

  async transformTone(
    userId: string,
    input: { text: string; tone: ToneOption; suggestionId?: string },
  ) {
    const context = await requireAiAccess(userId);
    await assertAiRateLimit(userId);
    assertAiEnabled();
    const organizationId = context.organization.id;
    const provider = getAiProvider();
    const suggestionId =
      input.suggestionId ?? aiUsageRepository.newSuggestionId();
    const started = Date.now();

    try {
      const generated = await provider.generate({
        messages: buildToneTransformMessages({
          text: delimitUntrusted("draft-text", input.text),
          tone: input.tone,
        }),
        format: "json",
        temperature: 0.3,
      });
      const data = parseJsonWithSchema(generated.text, toneTransformSchema);

      await aiUsageRepository.createUsageEvent({
        organizationId,
        userId,
        feature: "TONE_TRANSFORM",
        provider: generated.provider,
        model: generated.model,
        status: "SUCCESS",
        latencyMs: generated.latencyMs,
        inputTokens: generated.inputTokens,
        outputTokens: generated.outputTokens,
        suggestionId,
      });
      await aiUsageRepository.createSuggestionEvent({
        organizationId,
        userId,
        suggestionId,
        feature: "TONE_TRANSFORM",
        eventType: "GENERATED",
      });

      return { suggestionId, feature: "TONE_TRANSFORM" as const, data };
    } catch (error) {
      await recordFailure({
        organizationId,
        userId,
        feature: "TONE_TRANSFORM",
        provider: provider.name,
        latencyMs: Date.now() - started,
        error,
        suggestionId,
      });
      mapProviderError(error);
    }
  },

  async suggestKnowledge(
    userId: string,
    input: {
      query: string;
      ticketId?: string;
      conversationId?: string;
    },
  ) {
    const context = await requireAiAccess(userId);
    await assertAiRateLimit(userId);
    assertAiEnabled();
    const organizationId = context.organization.id;
    const provider = getAiProvider();
    const suggestionId = aiUsageRepository.newSuggestionId();
    const started = Date.now();

    try {
      const { hits } = await ragService.retrieve({
        organizationId,
        userId,
        query: input.query,
      });
      const knowledgeContext =
        hits.length > 0
          ? ragService.buildContext(hits)
          : delimitUntrusted("kb", "(no knowledge excerpts retrieved)");

      const generated = await provider.generate({
        messages: buildKnowledgeAnswerMessages({
          query: delimitUntrusted("agent-query", input.query),
          knowledgeContext,
        }),
        format: "json",
        temperature: 0.2,
      });
      const data = parseJsonWithSchema(generated.text, knowledgeAnswerSchema);

      await aiUsageRepository.createUsageEvent({
        organizationId,
        userId,
        feature: "KNOWLEDGE_SEARCH",
        provider: generated.provider,
        model: generated.model,
        status: "SUCCESS",
        latencyMs: generated.latencyMs,
        inputTokens: generated.inputTokens,
        outputTokens: generated.outputTokens,
        retrievedSourcesCount: hits.length,
        suggestionId,
      });
      await aiUsageRepository.createSuggestionEvent({
        organizationId,
        userId,
        suggestionId,
        feature: "KNOWLEDGE_SEARCH",
        eventType: "GENERATED",
      });

      return {
        suggestionId,
        feature: "KNOWLEDGE_SEARCH" as const,
        data,
        sources: hits.map((h) => ({
          articleId: h.articleId,
          title: h.title,
          score: h.score,
          source: h.source,
        })),
      };
    } catch (error) {
      await recordFailure({
        organizationId,
        userId,
        feature: "KNOWLEDGE_SEARCH",
        provider: provider.name,
        latencyMs: Date.now() - started,
        error,
        suggestionId,
      });
      mapProviderError(error);
    }
  },

  async recordSuggestionEvent(
    userId: string,
    input: {
      suggestionId: string;
      feature: AiFeature;
      eventType: Exclude<AiSuggestionEventType, "GENERATED">;
    },
  ) {
    const context = await requireAiAccess(userId);
    await aiUsageRepository.createSuggestionEvent({
      organizationId: context.organization.id,
      userId,
      suggestionId: input.suggestionId,
      feature: input.feature,
      eventType: input.eventType,
    });
    return { ok: true as const };
  },

  async submitFeedback(
    userId: string,
    input: {
      suggestionId: string;
      feature: AiFeature;
      helpful: boolean;
    },
  ) {
    return this.recordSuggestionEvent(userId, {
      suggestionId: input.suggestionId,
      feature: input.feature,
      eventType: input.helpful ? "FEEDBACK_HELPFUL" : "FEEDBACK_NOT_HELPFUL",
    });
  },
};
