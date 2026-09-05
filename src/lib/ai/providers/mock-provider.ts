import { createHash } from "node:crypto";

import {
  AiUnavailableError,
  type AIProvider,
  type AiHealthStatus,
  type EmbedRequest,
  type EmbedResponse,
  type GenerateRequest,
  type GenerateResponse,
} from "@/lib/ai/types";

/**
 * Deterministic mock provider for tests.
 * Set MOCK_AI_UNAVAILABLE=true to simulate downtime (never invents fake live answers).
 */
export function createMockAiProvider(): AIProvider {
  return {
    name: "mock",

    async health(): Promise<AiHealthStatus> {
      if (process.env.MOCK_AI_UNAVAILABLE === "true") {
        return {
          available: false,
          provider: "mock",
          model: "mock-llama",
          embeddingModel: "mock-embed",
          reason: "Mock provider forced unavailable",
        };
      }
      return {
        available: true,
        provider: "mock",
        model: "mock-llama",
        embeddingModel: "mock-embed",
      };
    },

    async generate(request: GenerateRequest): Promise<GenerateResponse> {
      if (process.env.MOCK_AI_UNAVAILABLE === "true") {
        throw new AiUnavailableError("Mock AI provider is unavailable.");
      }

      const started = Date.now();
      const joined = request.messages.map((m) => m.content).join("\n");
      const lower = joined.toLowerCase();

      let text: string;
      if (lower.includes("tone") || lower.includes("rewrite")) {
        text = JSON.stringify({
          rewritten: `[mock-rewritten] ${joined.slice(-200)}`.slice(0, 500),
        });
      } else if (lower.includes("reply") || lower.includes("draft")) {
        text = JSON.stringify({
          reply: "Thank you for contacting support. We are looking into this and will update you shortly.",
          rationale: "Mock polite acknowledgment.",
        });
      } else if (lower.includes("conversation summary") || lower.includes("chat transcript")) {
        text = JSON.stringify({
          summary: "Mock conversation summary of the recent exchange.",
          keyPoints: ["Customer reported an issue", "Agent acknowledged"],
          openQuestions: ["Awaiting customer confirmation"],
        });
      } else if (lower.includes("knowledge") || lower.includes("rag")) {
        text = JSON.stringify({
          answer: "Based on the knowledge base excerpts, follow the documented steps.",
          citations: [{ title: "Mock Article", relevance: "high" }],
          confidence: "medium",
        });
      } else {
        text = JSON.stringify({
          summary: "Mock ticket summary covering the reported issue and current status.",
          customerIssue: "Customer needs assistance with the reported problem.",
          currentStatus: "Open / in progress",
          nextSteps: ["Acknowledge", "Investigate", "Resolve"],
        });
      }

      return {
        text,
        model: "mock-llama",
        provider: "mock",
        inputTokens: Math.ceil(joined.length / 4),
        outputTokens: Math.ceil(text.length / 4),
        latencyMs: Math.max(1, Date.now() - started),
      };
    },

    async embed(request: EmbedRequest): Promise<EmbedResponse> {
      if (process.env.MOCK_AI_UNAVAILABLE === "true") {
        throw new AiUnavailableError("Mock AI provider is unavailable.");
      }

      const started = Date.now();
      const embeddings = request.texts.map((text) => deterministicEmbedding(text, 768));
      return {
        embeddings,
        model: "mock-embed",
        provider: "mock",
        latencyMs: Math.max(1, Date.now() - started),
      };
    },
  };
}

function deterministicEmbedding(text: string, dims: number): number[] {
  const vector = new Array<number>(dims).fill(0);
  const hash = createHash("sha256").update(text).digest();
  for (let i = 0; i < dims; i++) {
    const byte = hash[i % hash.length]!;
    vector[i] = ((byte / 255) * 2 - 1) * ((i % 7) + 1) / 7;
  }
  // L2 normalize for cosine similarity
  let norm = 0;
  for (const v of vector) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return vector.map((v) => v / norm);
}
