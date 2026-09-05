import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { hashPassword } from "@/lib/auth/password";
import { markdownToPlainText, renderSafeMarkdown } from "@/lib/knowledge/markdown";
import { prisma } from "@/lib/db/prisma";
import { organizationRepository } from "@/repositories/organization-repository";
import {
  knowledgeService,
} from "@/services/knowledge-service";
import { processMaintenanceJob } from "@/workers/processors/maintenance-processor";
import { JOB_NAMES } from "@/lib/queues/names";

describe("knowledge markdown safety", () => {
  it("escapes raw HTML and renders safe markdown", () => {
    const html = renderSafeMarkdown(
      '# Hello\n\n<script>alert(1)</script>\n\nClick [here](https://example.com)',
    );
    expect(html).toContain("<h1>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("href=\"https://example.com\"");
    expect(markdownToPlainText("**bold** text")).toContain("bold text");
  });

  it("blocks javascript: and data: hrefs", () => {
    const html = renderSafeMarkdown(
      '[bad](javascript:alert(1)) [also](data:text/html,hi) [ok](https://safe.example)',
    );
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:text/html");
    expect(html).not.toContain('href="javascript');
    expect(html).toContain('href="https://safe.example"');
  });
});

const runIntegration = Boolean(process.env.DATABASE_URL);

describe.runIf(runIntegration)("knowledgeService integration", () => {
  const suffix = Date.now();
  let ownerA = "";
  let ownerB = "";
  let agentA = "";
  let viewerA = "";
  let orgA = "";
  let orgB = "";
  let articleId = "";
  let categoryId = "";
  let versionId = "";

  beforeAll(async () => {
    process.env.AUTH_SECRET ??= "test-secret-ticketloom-auth-32chars!!";
    const passwordHash = await hashPassword("SecurePass123!");

    const users = await Promise.all([
      prisma.user.create({
        data: { email: `kb-owner-a-${suffix}@example.com`, name: "KB Owner A", passwordHash },
      }),
      prisma.user.create({
        data: { email: `kb-owner-b-${suffix}@example.com`, name: "KB Owner B", passwordHash },
      }),
      prisma.user.create({
        data: { email: `kb-agent-${suffix}@example.com`, name: "KB Agent", passwordHash },
      }),
      prisma.user.create({
        data: { email: `kb-viewer-${suffix}@example.com`, name: "KB Viewer", passwordHash },
      }),
    ]);
    ownerA = users[0].id;
    ownerB = users[1].id;
    agentA = users[2].id;
    viewerA = users[3].id;

    const createdA = await organizationRepository.createWithOwner({
      name: `KB Org A ${suffix}`,
      ownerUserId: ownerA,
      slug: `kb-a-${suffix}`,
    });
    orgA = createdA.organization.id;
    const createdB = await organizationRepository.createWithOwner({
      name: `KB Org B ${suffix}`,
      ownerUserId: ownerB,
      slug: `kb-b-${suffix}`,
    });
    orgB = createdB.organization.id;

    await organizationRepository.createMembership({
      userId: agentA,
      organizationId: orgA,
      role: "AGENT",
      status: "ACTIVE",
    });
    await organizationRepository.createMembership({
      userId: viewerA,
      organizationId: orgA,
      role: "VIEWER",
      status: "ACTIVE",
    });
    await prisma.user.update({
      where: { id: agentA },
      data: { activeOrganizationId: orgA },
    });
    await prisma.user.update({
      where: { id: viewerA },
      data: { activeOrganizationId: orgA },
    });
  });

  afterAll(async () => {
    await prisma.knowledgeArticleFeedback.deleteMany({
      where: { organizationId: { in: [orgA, orgB] } },
    });
    await prisma.knowledgeArticleView.deleteMany({
      where: { organizationId: { in: [orgA, orgB] } },
    });
    await prisma.knowledgeSearchEvent.deleteMany({
      where: { organizationId: { in: [orgA, orgB] } },
    });
    await prisma.knowledgeArticleActivity.deleteMany({
      where: { organizationId: { in: [orgA, orgB] } },
    });
    await prisma.knowledgeArticleTag.deleteMany({
      where: { organizationId: { in: [orgA, orgB] } },
    });
    await prisma.knowledgeArticle.updateMany({
      where: { organizationId: { in: [orgA, orgB] } },
      data: { currentVersionId: null, publishedVersionId: null },
    });
    await prisma.knowledgeArticleVersion.deleteMany({
      where: { organizationId: { in: [orgA, orgB] } },
    });
    await prisma.knowledgeArticle.deleteMany({
      where: { organizationId: { in: [orgA, orgB] } },
    });
    await prisma.knowledgeCategory.deleteMany({
      where: { organizationId: { in: [orgA, orgB] } },
    });
    await prisma.knowledgeTag.deleteMany({
      where: { organizationId: { in: [orgA, orgB] } },
    });
    await prisma.knowledgeBase.deleteMany({
      where: { organizationId: { in: [orgA, orgB] } },
    });
    await prisma.membership.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerA, ownerB, agentA, viewerA] } } });
    await prisma.$disconnect();
  });

  it("creates knowledge base, nested categories, and prevents cycles", async () => {
    const kb = await knowledgeService.ensureKnowledgeBase(ownerA);
    expect(kb.organizationId).toBe(orgA);

    const parent = await knowledgeService.createCategory(ownerA, {
      name: "Getting Started",
      knowledgeBaseId: kb.id,
    });
    categoryId = parent.id;

    const child = await knowledgeService.createCategory(ownerA, {
      name: "Account",
      parentCategoryId: parent.id,
      knowledgeBaseId: kb.id,
    });
    expect(child.parentCategoryId).toBe(parent.id);

    await expect(
      knowledgeService.updateCategory(ownerA, parent.id, {
        parentCategoryId: child.id,
      }),
    ).rejects.toMatchObject({
      code: expect.stringMatching(/INVALID_PARENT|VALIDATION/),
    });
  });

  it("creates article versions and publishes with RBAC", async () => {
    const created = await knowledgeService.create(agentA, {
      title: "How to reset your password",
      excerpt: "Steps to reset a password securely",
      bodyMarkdown:
        "## Reset password\n\n1. Open settings\n2. Click reset\n\nUse a strong password.",
      categoryId,
      tagNames: ["authentication", "security"],
      visibility: "INTERNAL",
    });
    articleId = created.id;
    expect(created.status).toBe("DRAFT");

    await knowledgeService.submitForReview(agentA, articleId);
    const submitted = await knowledgeService.get(agentA, articleId);
    expect(submitted.status).toBe("IN_REVIEW");

    await expect(knowledgeService.publish(agentA, articleId)).rejects.toBeTruthy();

    const published = await knowledgeService.publish(ownerA, articleId, "Initial publish");
    expect(published.status).toBe("PUBLISHED");
    expect(published.publishedAt).toBeTruthy();

    await expect(knowledgeService.get(viewerA, articleId)).resolves.toBeTruthy();

    await expect(
      knowledgeService.create(viewerA, {
        title: "Viewer should not create",
        bodyMarkdown: "Nope",
      }),
    ).rejects.toThrow();
  });

  it("creates new versions on edit and supports restore", async () => {
    await knowledgeService.update(agentA, articleId, {
      bodyMarkdown: "## Reset password\n\nUpdated steps for v2.",
      changeSummary: "Clarify steps",
    });

    const versions = await knowledgeService.listVersions(ownerA, articleId);
    expect(versions.items.length).toBeGreaterThanOrEqual(2);
    versionId = versions.items[versions.items.length - 1]?.id ?? versions.items[0].id;

    const restored = await knowledgeService.restoreVersion(
      ownerA,
      articleId,
      versionId,
      "Restore earlier content",
    );
    expect(restored.currentVersionId).toBeTruthy();
    const after = await knowledgeService.listVersions(ownerA, articleId);
    expect(after.items.length).toBeGreaterThan(versions.items.length);
  });

  it("searches with FTS and enforces tenant isolation", async () => {
    const results = await knowledgeService.search(ownerA, {
      q: "password reset",
      page: 1,
      pageSize: 10,
    });
    expect(results.items.some((item) => item.id === articleId)).toBe(true);

    await expect(knowledgeService.get(ownerB, articleId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const foreign = await knowledgeService.search(ownerB, {
      q: "password",
      page: 1,
      pageSize: 10,
    });
    expect(foreign.items.some((item) => item.id === articleId)).toBe(false);
  });

  it("handles feedback upsert and archive workflow", async () => {
    // Ensure a published version is visible to viewers after edits/restores
    const current = await knowledgeService.get(ownerA, articleId);
    if (current.status !== "PUBLISHED") {
      if (current.status === "DRAFT" || current.status === "ARCHIVED") {
        if (current.status === "ARCHIVED") {
          await knowledgeService.restore(ownerA, articleId);
        }
        await knowledgeService.submitForReview(ownerA, articleId).catch(() => undefined);
        await knowledgeService.publish(ownerA, articleId, "Ready for feedback");
      } else if (current.status === "IN_REVIEW") {
        await knowledgeService.publish(ownerA, articleId, "Ready for feedback");
      }
    }

    await knowledgeService.submitFeedback(viewerA, articleId, {
      helpful: true,
    });
    await knowledgeService.submitFeedback(viewerA, articleId, {
      helpful: false,
      comment: "Missing MFA steps",
    });

    const archived = await knowledgeService.archive(ownerA, articleId, "Outdated");
    expect(archived.status).toBe("ARCHIVED");

    await expect(knowledgeService.get(viewerA, articleId)).rejects.toBeTruthy();
  });

  it("runs knowledge analytics rollup job", async () => {
    const result = await processMaintenanceJob({
      id: "kb-rollup",
      name: JOB_NAMES.knowledgeAnalyticsRollup,
      data: {},
    } as never);
    expect(result).toHaveProperty("articlesReconciled");
  });
});
