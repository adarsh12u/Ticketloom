import { createHash, randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { embeddingToPgVectorLiteral } from "@/lib/ai/embeddings";
import { prisma } from "@/lib/db/prisma";

export type ChunkUpsertRow = {
  organizationId: string;
  knowledgeBaseId: string;
  articleId: string;
  articleVersionId: string;
  chunkIndex: number;
  content: string;
  title: string;
  section: string | null;
  category: string | null;
  contentHash: string;
  embedding: number[];
};

export type VectorSearchHit = {
  id: string;
  articleId: string;
  articleVersionId: string;
  title: string;
  section: string | null;
  content: string;
  category: string | null;
  similarity: number;
};

export const ragRepository = {
  hashQuery(query: string): string {
    return createHash("sha256").update(query.trim().toLowerCase()).digest("hex");
  },

  async deleteChunksForArticle(organizationId: string, articleId: string) {
    return prisma.knowledgeChunk.deleteMany({
      where: { organizationId, articleId },
    });
  },

  async deleteChunksForVersion(organizationId: string, articleVersionId: string) {
    return prisma.knowledgeChunk.deleteMany({
      where: { organizationId, articleVersionId },
    });
  },

  async replaceVersionChunks(rows: ChunkUpsertRow[]) {
    if (rows.length === 0) return { count: 0 };
    const organizationId = rows[0]!.organizationId;
    const articleVersionId = rows[0]!.articleVersionId;
    const articleId = rows[0]!.articleId;

    await prisma.$transaction(async (tx) => {
      await tx.knowledgeChunk.deleteMany({
        where: { organizationId, articleId },
      });

      for (const row of rows) {
        const id = randomChunkId();
        const vector = embeddingToPgVectorLiteral(row.embedding);
        await tx.$executeRaw`
          INSERT INTO knowledge_chunks (
            id, organization_id, knowledge_base_id, article_id, article_version_id,
            chunk_index, content, title, section, category, content_hash,
            embedding, created_at, updated_at
          ) VALUES (
            ${id},
            ${row.organizationId},
            ${row.knowledgeBaseId},
            ${row.articleId},
            ${row.articleVersionId},
            ${row.chunkIndex},
            ${row.content},
            ${row.title},
            ${row.section},
            ${row.category},
            ${row.contentHash},
            ${Prisma.raw(`'${vector}'::vector`)},
            NOW(),
            NOW()
          )
        `;
      }
    });

    return { count: rows.length, articleVersionId };
  },

  async similaritySearch(params: {
    organizationId: string;
    embedding: number[];
    limit: number;
  }): Promise<VectorSearchHit[]> {
    const vector = embeddingToPgVectorLiteral(params.embedding);
    const rows = await prisma.$queryRaw<VectorSearchHit[]>`
      SELECT
        c.id,
        c.article_id AS "articleId",
        c.article_version_id AS "articleVersionId",
        c.title,
        c.section,
        c.content,
        c.category,
        (1 - (c.embedding <=> ${Prisma.raw(`'${vector}'::vector`)}))::float AS similarity
      FROM knowledge_chunks c
      INNER JOIN knowledge_articles a
        ON a.id = c.article_id
       AND a.organization_id = c.organization_id
      WHERE c.organization_id = ${params.organizationId}
        AND c.embedding IS NOT NULL
        AND a.status = 'PUBLISHED'
      ORDER BY c.embedding <=> ${Prisma.raw(`'${vector}'::vector`)} ASC
      LIMIT ${params.limit}
    `;
    return rows;
  },

  async createRetrievalEvent(input: {
    organizationId: string;
    userId?: string | null;
    query: string;
    retrievedArticleIds: string[];
    retrievalScores?: unknown;
    selectedChunkCount: number;
    success: boolean;
    latencyMs?: number | null;
  }) {
    return prisma.ragRetrievalEvent.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        queryHash: this.hashQuery(input.query),
        queryPreview: input.query.slice(0, 120),
        retrievedArticleIds: input.retrievedArticleIds,
        retrievalScores:
          input.retrievalScores === undefined
            ? undefined
            : (input.retrievalScores as Prisma.InputJsonValue),
        selectedChunkCount: input.selectedChunkCount,
        success: input.success,
        latencyMs: input.latencyMs ?? null,
      },
    });
  },

  async findPublishedArticleForIndex(organizationId: string, articleId: string) {
    return prisma.knowledgeArticle.findFirst({
      where: {
        id: articleId,
        organizationId,
        status: "PUBLISHED",
        publishedVersionId: { not: null },
      },
      include: {
        publishedVersion: true,
        category: { select: { name: true } },
      },
    });
  },
};

function randomChunkId() {
  return `chk_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}
