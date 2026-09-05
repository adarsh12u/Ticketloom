import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { resetAiProviderCache } from "@/lib/ai/provider";
import { organizationRepository } from "@/repositories/organization-repository";
import { knowledgeService } from "@/services/knowledge-service";
import { ragService } from "@/services/rag-service";

const runIntegration = Boolean(process.env.DATABASE_URL);

describe.runIf(runIntegration)("ragService integration", () => {
  const suffix = Date.now();
  let ownerA = "";
  let ownerB = "";
  let orgA = "";
  let orgB = "";
  let articleA = "";
  let articleB = "";

  beforeAll(async () => {
    process.env.AUTH_SECRET ??= "test-secret-ticketloom-auth-32chars!!";
    process.env.AI_PROVIDER = "mock";
    process.env.AI_ENABLED = "true";
    delete process.env.MOCK_AI_UNAVAILABLE;
    resetAiProviderCache();

    const passwordHash = await hashPassword("SecurePass123!");
    const [userA, userB] = await Promise.all([
      prisma.user.create({
        data: { email: `rag-owner-a-${suffix}@example.com`, name: "RAG A", passwordHash },
      }),
      prisma.user.create({
        data: { email: `rag-owner-b-${suffix}@example.com`, name: "RAG B", passwordHash },
      }),
    ]);
    ownerA = userA.id;
    ownerB = userB.id;

    orgA = (
      await organizationRepository.createWithOwner({
        name: `RAG Org A ${suffix}`,
        ownerUserId: ownerA,
        slug: `rag-a-${suffix}`,
      })
    ).organization.id;
    orgB = (
      await organizationRepository.createWithOwner({
        name: `RAG Org B ${suffix}`,
        ownerUserId: ownerB,
        slug: `rag-b-${suffix}`,
      })
    ).organization.id;

    const createdA = await knowledgeService.create(ownerA, {
      title: "Reset MFA for billing",
      bodyMarkdown:
        "# Reset MFA\n\n" +
        "Follow these steps to reset multi-factor authentication for billing users. ".repeat(20),
    });
    articleA = createdA.id;
    await knowledgeService.submitForReview(ownerA, articleA);
    await knowledgeService.publish(ownerA, articleA, "Publish for RAG");

    const createdB = await knowledgeService.create(ownerB, {
      title: "Secret org B article",
      bodyMarkdown: "# Secret\n\n" + "Org B confidential content. ".repeat(30),
    });
    articleB = createdB.id;
    await knowledgeService.submitForReview(ownerB, articleB);
    await knowledgeService.publish(ownerB, articleB, "Publish B");

    // Index directly (queue may be unavailable in tests)
    await ragService.indexArticleVersion(orgA, articleA);
    await ragService.indexArticleVersion(orgB, articleB);
  });

  beforeEach(() => {
    process.env.AI_PROVIDER = "mock";
    resetAiProviderCache();
  });

  afterAll(async () => {
    const orgIds = [orgA, orgB].filter(Boolean);
    if (orgIds.length) {
      await prisma.knowledgeChunk.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.ragRetrievalEvent.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.knowledgeArticleFeedback.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.knowledgeArticleView.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.knowledgeSearchEvent.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.knowledgeArticleActivity.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.knowledgeArticleTag.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.knowledgeArticle.updateMany({
        where: { organizationId: { in: orgIds } },
        data: { currentVersionId: null, publishedVersionId: null },
      });
      await prisma.knowledgeArticleVersion.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.knowledgeArticle.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.knowledgeCategory.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.knowledgeTag.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.knowledgeBase.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.membership.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    }
    await prisma.user.deleteMany({ where: { id: { in: [ownerA, ownerB].filter(Boolean) } } });
    await prisma.$disconnect();
  });

  it("indexes chunks with mock embeddings", async () => {
    const chunks = await prisma.knowledgeChunk.findMany({
      where: { organizationId: orgA, articleId: articleA },
    });
    expect(chunks.length).toBeGreaterThan(0);
  });

  it("filters retrieval by organization", async () => {
    const { hits } = await ragService.retrieve({
      organizationId: orgA,
      userId: ownerA,
      query: "reset MFA billing authentication",
    });
    expect(hits.every((hit) => hit.articleId !== articleB)).toBe(true);

    const foreign = await ragService.retrieve({
      organizationId: orgB,
      userId: ownerB,
      query: "reset MFA billing authentication",
    });
    expect(foreign.hits.every((hit) => hit.articleId !== articleA)).toBe(true);
  });

  it("returns empty hits for nonsense query without throwing", async () => {
    const { hits } = await ragService.retrieve({
      organizationId: orgA,
      userId: ownerA,
      query: "zzzzzxqqq unrelated gibberish 99999",
    });
    expect(Array.isArray(hits)).toBe(true);
  });

  it("deindexes archived content", async () => {
    await ragService.deindexArticle(orgA, articleA);
    const remaining = await prisma.knowledgeChunk.count({
      where: { organizationId: orgA, articleId: articleA },
    });
    expect(remaining).toBe(0);
    // re-index for isolation of later tests if any
    await ragService.indexArticleVersion(orgA, articleA);
  });
});
