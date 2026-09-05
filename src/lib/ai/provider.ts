import { getAiConfig } from "@/lib/ai/config";
import type { AIProvider } from "@/lib/ai/types";
import { createMockAiProvider } from "@/lib/ai/providers/mock-provider";
import { createOllamaProvider } from "@/lib/ai/providers/ollama-provider";

let cached: AIProvider | null = null;
let cachedKey: string | null = null;

export function getAiProvider(): AIProvider {
  const config = getAiConfig();
  const key = `${config.provider}:${config.ollamaBaseUrl}:${config.model}:${config.embeddingModel}:${config.enabled}`;
  if (cached && cachedKey === key) return cached;

  if (!config.enabled || config.provider === "mock") {
    cached = createMockAiProvider();
  } else {
    cached = createOllamaProvider(config);
  }
  cachedKey = key;
  return cached;
}

/** Test helper — clear singleton between cases. */
export function resetAiProviderCache() {
  cached = null;
  cachedKey = null;
}
