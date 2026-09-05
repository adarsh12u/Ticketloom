export const AI_UNAVAILABLE = "AI_UNAVAILABLE" as const;

export type AiUnavailableCode = typeof AI_UNAVAILABLE;

export class AiUnavailableError extends Error {
  readonly code: AiUnavailableCode = AI_UNAVAILABLE;

  constructor(message = "AI provider is unavailable.") {
    super(message);
    this.name = "AiUnavailableError";
  }
}

export type GenerateMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type GenerateRequest = {
  messages: GenerateMessage[];
  model?: string;
  temperature?: number;
  format?: "json" | "text";
};

export type GenerateResponse = {
  text: string;
  model: string;
  provider: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
};

export type EmbedRequest = {
  texts: string[];
  model?: string;
};

export type EmbedResponse = {
  embeddings: number[][];
  model: string;
  provider: string;
  latencyMs: number;
};

export type AiHealthStatus = {
  available: boolean;
  provider: string;
  model: string;
  embeddingModel: string;
  reason?: string;
};

export interface AIProvider {
  readonly name: string;
  generate(request: GenerateRequest): Promise<GenerateResponse>;
  embed(request: EmbedRequest): Promise<EmbedResponse>;
  health(): Promise<AiHealthStatus>;
}
