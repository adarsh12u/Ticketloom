import { getAiProvider } from "@/lib/ai/provider";
import type { EmbedResponse } from "@/lib/ai/types";

export type EmbeddingProvider = {
  embedTexts(texts: string[]): Promise<EmbedResponse>;
};

export function getEmbeddingProvider(): EmbeddingProvider {
  const provider = getAiProvider();
  return {
    async embedTexts(texts: string[]) {
      if (texts.length === 0) {
        return {
          embeddings: [],
          model: "none",
          provider: provider.name,
          latencyMs: 0,
        };
      }
      return provider.embed({ texts });
    },
  };
}

export function embeddingToPgVectorLiteral(embedding: number[]): string {
  return `[${embedding.map((n) => Number(n).toFixed(8)).join(",")}]`;
}
