/**
 * AI runtime configuration (Ollama / mock).
 * Never hard-code secrets; all values come from env.
 */

export type AiProviderName = "ollama" | "mock";

export type AiConfig = {
  enabled: boolean;
  provider: AiProviderName;
  ollamaBaseUrl: string;
  model: string;
  embeddingModel: string;
  embeddingDimensions: number;
  requestTimeoutMs: number;
  healthTimeoutMs: number;
  maxContextChars: number;
  maxChunkChars: number;
  minChunkChars: number;
  maxRetrievedChunks: number;
};

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

function parseIntEnv(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getAiConfig(): AiConfig {
  const providerRaw = (process.env.AI_PROVIDER ?? "ollama").toLowerCase();
  const provider: AiProviderName = providerRaw === "mock" ? "mock" : "ollama";

  return {
    enabled: parseBool(process.env.AI_ENABLED, true),
    provider,
    ollamaBaseUrl: (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(
      /\/$/,
      "",
    ),
    model: process.env.AI_MODEL ?? "llama3.2",
    embeddingModel: process.env.AI_EMBEDDING_MODEL ?? "nomic-embed-text",
    embeddingDimensions: 768,
    requestTimeoutMs: parseIntEnv(process.env.AI_REQUEST_TIMEOUT_MS, 60_000),
    healthTimeoutMs: parseIntEnv(process.env.AI_HEALTH_TIMEOUT_MS, 3_000),
    maxContextChars: parseIntEnv(process.env.AI_MAX_CONTEXT_CHARS, 12_000),
    maxChunkChars: parseIntEnv(process.env.AI_MAX_CHUNK_CHARS, 1_200),
    minChunkChars: parseIntEnv(process.env.AI_MIN_CHUNK_CHARS, 800),
    maxRetrievedChunks: parseIntEnv(process.env.AI_MAX_RETRIEVED_CHUNKS, 6),
  };
}
