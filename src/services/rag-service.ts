import { getAiConfig } from "@/lib/ai/config";
import { chunkArticle, hashContent } from "@/lib/ai/chunking";
import { getEmbeddingProvider } from "@/lib/ai/embeddings";
import { delimitUntrusted, truncateContext } from "@/lib/ai/safety";
import { knowledgeRepository } from "@/repositories/knowledge-repository";
import {
  ragRepository,
  type VectorSearchHit,
} from "@/repositories/rag-repository";

export class RagServiceError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "VALIDATION" | "UNAVAILABLE" = "VALIDATION",
  ) {
    super(message);
    this.name = "RagServiceError";
  }
}

export type HybridHit = {
  articleId: string;
  title: string;
  content: string;
  section: string | null;
  category: string | null;
  score: number;
  source: "vector" | "fts" | "hybrid";
};

function normalizeScores(values: number[]): number[] {
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  return values.map((v) => (v - min) / span);
}

export const ragService = {
  async indexArticleVersion(organizationId: string, articleId: string) {
    const article = await ragRepository.findPublishedArticleForIndex(
      organizationId,
      articleId,
    );
    if (!article || !article.publishedVersion) {
      await ragRepository.deleteChunksForArticle(organizationId, articleId);
      return { indexed: false, reason: "not-published" as const };
    }

    const version = article.publishedVersion;
    const body = version.bodyMarkdown || article.bodyText || "";
    const chunks = chunkArticle({ title: article.title, body });
    const embedder = getEmbeddingProvider();
    const embedded = await embedder.embedTexts(chunks.map((c) => c.content));

    const rows = chunks.map((chunk, index) => ({
      organizationId,
      knowledgeBaseId: article.knowledgeBaseId,
      articleId: article.id,
      articleVersionId: version.id,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      title: chunk.title,
      section: chunk.section,
      category: article.category?.name ?? null,
      contentHash: chunk.contentHash || hashContent(chunk.content),
      embedding: embedded.embeddings[index]!,
    }));

    await ragRepository.replaceVersionChunks(rows);
    return {
      indexed: true as const,
      chunkCount: rows.length,
      articleVersionId: version.id,
      contentHash: hashContent(body),
    };
  },

  async deindexArticle(organizationId: string, articleId: string) {
    const result = await ragRepository.deleteChunksForArticle(
      organizationId,
      articleId,
    );
    return { deleted: result.count };
  },

  async retrieve(params: {
    organizationId: string;
    userId?: string | null;
    query: string;
    limit?: number;
  }): Promise<{ hits: HybridHit[]; latencyMs: number }> {
    const started = Date.now();
    const config = getAiConfig();
    const limit = params.limit ?? config.maxRetrievedChunks;
    const query = params.query.trim();
    if (!query) {
      return { hits: [], latencyMs: 0 };
    }

    try {
      const hits = await this.hybridSearch({
        organizationId: params.organizationId,
        query,
        limit,
      });

      await ragRepository.createRetrievalEvent({
        organizationId: params.organizationId,
        userId: params.userId,
        query,
        retrievedArticleIds: [...new Set(hits.map((h) => h.articleId))],
        retrievalScores: hits.map((h) => ({
          articleId: h.articleId,
          score: h.score,
          source: h.source,
        })),
        selectedChunkCount: hits.length,
        success: true,
        latencyMs: Date.now() - started,
      });

      return { hits, latencyMs: Date.now() - started };
    } catch (error) {
      await ragRepository.createRetrievalEvent({
        organizationId: params.organizationId,
        userId: params.userId,
        query,
        retrievedArticleIds: [],
        selectedChunkCount: 0,
        success: false,
        latencyMs: Date.now() - started,
      });
      throw error;
    }
  },

  async hybridSearch(params: {
    organizationId: string;
    query: string;
    limit: number;
  }): Promise<HybridHit[]> {
    const embedder = getEmbeddingProvider();
    const [embedded, fts] = await Promise.all([
      embedder.embedTexts([params.query]),
      knowledgeRepository.searchArticles({
        organizationId: params.organizationId,
        query: params.query,
        status: "PUBLISHED",
        skip: 0,
        take: params.limit,
      }),
    ]);

    const vectorHits: VectorSearchHit[] = await ragRepository.similaritySearch({
      organizationId: params.organizationId,
      embedding: embedded.embeddings[0]!,
      limit: params.limit,
    });

    const vectorScores = normalizeScores(vectorHits.map((h) => h.similarity));
    const ftsRanks = Object.values(fts.ranks ?? {});
    const ftsNorm = normalizeScores(
      fts.items.map((item) => Number(fts.ranks?.[item.id] ?? 0)),
    );

    const byArticle = new Map<string, HybridHit>();

    vectorHits.forEach((hit, index) => {
      const score = vectorScores[index] ?? 0;
      byArticle.set(hit.articleId, {
        articleId: hit.articleId,
        title: hit.title,
        content: hit.content,
        section: hit.section,
        category: hit.category,
        score,
        source: "vector",
      });
    });

    fts.items.forEach((item, index) => {
      const ftsScore = ftsNorm[index] ?? 0;
      const existing = byArticle.get(item.id);
      if (existing) {
        existing.score = (existing.score + ftsScore) / 2;
        existing.source = "hybrid";
      } else {
        byArticle.set(item.id, {
          articleId: item.id,
          title: item.title,
          content: item.excerpt || item.bodyText?.slice(0, 500) || item.title,
          section: null,
          category: item.category?.name ?? null,
          score: ftsScore,
          source: "fts",
        });
      }
    });

    void ftsRanks;

    return [...byArticle.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, params.limit);
  },

  buildContext(hits: HybridHit[], maxChars?: number): string {
    const config = getAiConfig();
    const parts = hits.map((hit, index) =>
      delimitUntrusted(
        `kb-${index + 1}:${hit.title}`,
        [
          `Title: ${hit.title}`,
          hit.section ? `Section: ${hit.section}` : null,
          hit.category ? `Category: ${hit.category}` : null,
          hit.content,
        ]
          .filter(Boolean)
          .join("\n"),
      ),
    );
    return truncateContext(parts, maxChars ?? config.maxContextChars);
  },
};
