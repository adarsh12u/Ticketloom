import type { AiConfig } from "@/lib/ai/config";
import {
  AiUnavailableError,
  type AIProvider,
  type AiHealthStatus,
  type EmbedRequest,
  type EmbedResponse,
  type GenerateRequest,
  type GenerateResponse,
} from "@/lib/ai/types";

type OllamaChatResponse = {
  message?: { content?: string };
  model?: string;
  prompt_eval_count?: number;
  eval_count?: number;
};

type OllamaEmbedResponse = {
  embedding?: number[];
  embeddings?: number[][];
  model?: string;
};

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AiUnavailableError("AI provider request timed out.");
    }
    throw new AiUnavailableError(
      error instanceof Error ? error.message : "AI provider unreachable.",
    );
  } finally {
    clearTimeout(timer);
  }
}

export function createOllamaProvider(config: AiConfig): AIProvider {
  const baseUrl = config.ollamaBaseUrl;

  return {
    name: "ollama",

    async health(): Promise<AiHealthStatus> {
      try {
        const res = await fetchWithTimeout(
          `${baseUrl}/api/tags`,
          { method: "GET" },
          config.healthTimeoutMs,
        );
        if (!res.ok) {
          return {
            available: false,
            provider: "ollama",
            model: config.model,
            embeddingModel: config.embeddingModel,
            reason: `Ollama returned HTTP ${res.status}`,
          };
        }
        return {
          available: true,
          provider: "ollama",
          model: config.model,
          embeddingModel: config.embeddingModel,
        };
      } catch (error) {
        return {
          available: false,
          provider: "ollama",
          model: config.model,
          embeddingModel: config.embeddingModel,
          reason:
            error instanceof Error ? error.message : "Ollama health check failed",
        };
      }
    },

    async generate(request: GenerateRequest): Promise<GenerateResponse> {
      const started = Date.now();
      const model = request.model ?? config.model;
      let res: Response;
      try {
        res = await fetchWithTimeout(
          `${baseUrl}/api/chat`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              messages: request.messages,
              stream: false,
              format: request.format === "json" ? "json" : undefined,
              options: {
                temperature: request.temperature ?? 0.2,
              },
            }),
          },
          config.requestTimeoutMs,
        );
      } catch (error) {
        if (error instanceof AiUnavailableError) throw error;
        throw new AiUnavailableError(
          error instanceof Error ? error.message : "Ollama generate failed.",
        );
      }

      if (!res.ok) {
        throw new AiUnavailableError(`Ollama chat failed with HTTP ${res.status}.`);
      }

      const data = (await res.json()) as OllamaChatResponse;
      const text = data.message?.content?.trim() ?? "";
      if (!text) {
        throw new AiUnavailableError("Ollama returned an empty response.");
      }

      return {
        text,
        model: data.model ?? model,
        provider: "ollama",
        inputTokens: data.prompt_eval_count,
        outputTokens: data.eval_count,
        latencyMs: Date.now() - started,
      };
    },

    async embed(request: EmbedRequest): Promise<EmbedResponse> {
      const started = Date.now();
      const model = request.model ?? config.embeddingModel;
      const embeddings: number[][] = [];

      for (const text of request.texts) {
        let res: Response;
        try {
          res = await fetchWithTimeout(
            `${baseUrl}/api/embeddings`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ model, prompt: text }),
            },
            config.requestTimeoutMs,
          );
        } catch (error) {
          if (error instanceof AiUnavailableError) throw error;
          throw new AiUnavailableError(
            error instanceof Error ? error.message : "Ollama embed failed.",
          );
        }

        if (!res.ok) {
          throw new AiUnavailableError(
            `Ollama embeddings failed with HTTP ${res.status}.`,
          );
        }

        const data = (await res.json()) as OllamaEmbedResponse;
        const vector = data.embedding ?? data.embeddings?.[0];
        if (!vector || vector.length === 0) {
          throw new AiUnavailableError("Ollama returned an empty embedding.");
        }
        embeddings.push(vector);
      }

      return {
        embeddings,
        model,
        provider: "ollama",
        latencyMs: Date.now() - started,
      };
    },
  };
}
