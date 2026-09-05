import type {
  KnowledgeArticleStatus,
  MembershipRole,
} from "@/generated/prisma/client";

import {
  hasPermission,
  requireOrganizationContext,
  requirePermission,
} from "@/lib/authz";
import { AuthorizationError } from "@/lib/authz/errors";
import { renderSafeMarkdown } from "@/lib/knowledge/markdown";
import { cacheGetOrSet } from "@/lib/redis/cache";
import { invalidateKnowledgeCaches } from "@/lib/redis/invalidation";
import { CACHE_TTL, cacheKeys } from "@/lib/redis/keys";
import type {
  CreateArticleInput,
  CreateCategoryInput,
  CreateTagInput,
  FeedbackInput,
  ListArticlesInput,
  SearchKnowledgeInput,
  UpdateArticleInput,
  UpdateCategoryInput,
} from "@/lib/validations/knowledge";
import { knowledgeRepository } from "@/repositories/knowledge-repository";
import { enqueueKnowledgeIndex } from "@/lib/queues/producers";

export class KnowledgeServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NOT_FOUND"
      | "VALIDATION"
      | "FORBIDDEN"
      | "CONFLICT"
      | "INVALID_TRANSITION"
      | "INVALID_CATEGORY"
      | "INVALID_TAG"
      | "INVALID_PARENT" = "VALIDATION",
  ) {
    super(message);
    this.name = "KnowledgeServiceError";
  }
}

type KnowledgePermission =
  | "knowledge.read"
  | "knowledge.create"
  | "knowledge.update"
  | "knowledge.review"
  | "knowledge.publish"
  | "knowledge.archive"
  | "knowledge.manage";

const ALLOWED_TRANSITIONS: Record<
  KnowledgeArticleStatus,
  readonly KnowledgeArticleStatus[]
> = {
  DRAFT: ["IN_REVIEW", "PUBLISHED"],
  IN_REVIEW: ["DRAFT", "PUBLISHED"],
  PUBLISHED: ["DRAFT", "ARCHIVED"],
  ARCHIVED: ["DRAFT"],
};

async function requireKnowledgePermission(
  userId: string,
  permission: KnowledgePermission,
) {
  const context = await requireOrganizationContext(userId);
  requirePermission(context.role, permission);
  return context;
}

function canPublish(role: MembershipRole) {
  return hasPermission(role, "knowledge.publish");
}

function restrictedReaderStatuses(
  role: MembershipRole,
): KnowledgeArticleStatus[] | null {
  if (canPublish(role) || hasPermission(role, "knowledge.manage")) {
    return null;
  }
  return ["PUBLISHED"];
}

function assertTransition(
  from: KnowledgeArticleStatus,
  to: KnowledgeArticleStatus,
) {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new KnowledgeServiceError(
      `Cannot transition article from ${from} to ${to}.`,
      "INVALID_TRANSITION",
    );
  }
}

function mapRepoError(error: unknown): never {
  if (error instanceof Error) {
    if (error.message === "INVALID_CATEGORY") {
      throw new KnowledgeServiceError("Invalid category.", "INVALID_CATEGORY");
    }
    if (error.message === "INVALID_TAG") {
      throw new KnowledgeServiceError("Invalid tag.", "INVALID_TAG");
    }
    if (error.message === "INVALID_PARENT") {
      throw new KnowledgeServiceError("Invalid parent category.", "INVALID_PARENT");
    }
    if (error.message === "CATEGORY_CYCLE") {
      throw new KnowledgeServiceError(
        "Category parent would create a cycle.",
        "VALIDATION",
      );
    }
    if (error.message === "NO_VERSION") {
      throw new KnowledgeServiceError(
        "Article has no version to publish.",
        "VALIDATION",
      );
    }
  }
  throw error;
}

function toPublicArticle(
  article: NonNullable<
    Awaited<ReturnType<typeof knowledgeRepository.findArticleById>>
  >,
  options?: { includeHtml?: boolean },
) {
  const bodyMarkdown = article.currentVersion?.bodyMarkdown ?? "";
  return {
    id: article.id,
    organizationId: article.organizationId,
    knowledgeBaseId: article.knowledgeBaseId,
    knowledgeBase: article.knowledgeBase,
    categoryId: article.categoryId,
    category: article.category,
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt,
    status: article.status,
    visibility: article.visibility,
    authorId: article.authorId,
    ownerId: article.ownerId,
    author: article.author,
    owner: article.owner,
    currentVersionId: article.currentVersionId,
    publishedVersionId: article.publishedVersionId,
    currentVersion: article.currentVersion,
    publishedVersion: article.publishedVersion,
    bodyMarkdown,
    bodyHtml: options?.includeHtml ? renderSafeMarkdown(bodyMarkdown) : undefined,
    bodyText: article.bodyText,
    publishedAt: article.publishedAt,
    archivedAt: article.archivedAt,
    viewCount: article.viewCount,
    helpfulCount: article.helpfulCount,
    unhelpfulCount: article.unhelpfulCount,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
    tags: article.tags.map((row) => row.tag),
    activities: article.activities,
    counts: article._count,
  };
}

function toListItem(
  article: Awaited<
    ReturnType<typeof knowledgeRepository.listArticles>
  >["items"][number],
  rank?: number,
) {
  return {
    id: article.id,
    knowledgeBaseId: article.knowledgeBaseId,
    categoryId: article.categoryId,
    category: article.category,
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt,
    status: article.status,
    visibility: article.visibility,
    author: article.author,
    owner: article.owner,
    currentVersion: article.currentVersion,
    publishedVersion: article.publishedVersion,
    publishedAt: article.publishedAt,
    archivedAt: article.archivedAt,
    viewCount: article.viewCount,
    helpfulCount: article.helpfulCount,
    unhelpfulCount: article.unhelpfulCount,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
    tags: article.tags.map((row) => row.tag),
    counts: article._count,
    ...(rank !== undefined ? { rank } : {}),
  };
}

function canViewArticle(
  article: { status: KnowledgeArticleStatus; authorId: string },
  userId: string,
  role: MembershipRole,
) {
  if (canPublish(role) || hasPermission(role, "knowledge.manage")) {
    return true;
  }
  if (article.status === "PUBLISHED") return true;
  if (
    article.authorId === userId &&
    (article.status === "DRAFT" || article.status === "IN_REVIEW")
  ) {
    return hasPermission(role, "knowledge.read");
  }
  return false;
}

async function resolveKnowledgeBaseId(
  organizationId: string,
  userId: string,
  knowledgeBaseId?: string,
) {
  if (knowledgeBaseId) {
    const kb = await knowledgeRepository.findKnowledgeBase(
      organizationId,
      knowledgeBaseId,
    );
    if (!kb) {
      throw new KnowledgeServiceError("Knowledge base not found.", "NOT_FOUND");
    }
    return kb.id;
  }
  const kb = await knowledgeRepository.ensureDefaultKnowledgeBase(
    organizationId,
    userId,
  );
  return kb.id;
}

async function loadArticleOrThrow(organizationId: string, articleId: string) {
  const article = await knowledgeRepository.findArticleById(
    organizationId,
    articleId,
  );
  if (!article) {
    throw new KnowledgeServiceError("Article not found.", "NOT_FOUND");
  }
  return article;
}

export const knowledgeService = {
  async ensureKnowledgeBase(userId: string) {
    const context = await requireKnowledgePermission(userId, "knowledge.read");
    return knowledgeRepository.ensureDefaultKnowledgeBase(
      context.organization.id,
      userId,
    );
  },

  async listCategories(userId: string, knowledgeBaseId?: string) {
    const context = await requireKnowledgePermission(userId, "knowledge.read");
    const organizationId = context.organization.id;
    const kbId = await resolveKnowledgeBaseId(
      organizationId,
      userId,
      knowledgeBaseId,
    );

    const { value } = await cacheGetOrSet(
      organizationId,
      cacheKeys.knowledgeCategories(organizationId, kbId),
      CACHE_TTL.knowledgeCategories,
      () => knowledgeRepository.listCategories(organizationId, kbId),
    );

    return { knowledgeBaseId: kbId, items: value };
  },

  async createCategory(userId: string, input: CreateCategoryInput) {
    const context = await requireKnowledgePermission(userId, "knowledge.manage");
    const organizationId = context.organization.id;
    const kbId = await resolveKnowledgeBaseId(
      organizationId,
      userId,
      input.knowledgeBaseId,
    );

    try {
      const category = await knowledgeRepository.createCategory({
        organizationId,
        knowledgeBaseId: kbId,
        name: input.name,
        description: input.description,
        parentCategoryId: input.parentCategoryId,
        sortOrder: input.sortOrder,
      });
      await invalidateKnowledgeCaches(organizationId, kbId);
      return category;
    } catch (error) {
      mapRepoError(error);
    }
  },

  async updateCategory(
    userId: string,
    categoryId: string,
    input: UpdateCategoryInput,
  ) {
    const context = await requireKnowledgePermission(userId, "knowledge.manage");
    const organizationId = context.organization.id;

    try {
      const category = await knowledgeRepository.updateCategory(
        organizationId,
        categoryId,
        input,
      );
      if (!category) {
        throw new KnowledgeServiceError("Category not found.", "NOT_FOUND");
      }
      await invalidateKnowledgeCaches(organizationId, category.knowledgeBaseId);
      return category;
    } catch (error) {
      if (error instanceof KnowledgeServiceError) throw error;
      mapRepoError(error);
    }
  },

  async listTags(userId: string, knowledgeBaseId?: string) {
    const context = await requireKnowledgePermission(userId, "knowledge.read");
    const organizationId = context.organization.id;
    const kbId = await resolveKnowledgeBaseId(
      organizationId,
      userId,
      knowledgeBaseId,
    );
    return {
      knowledgeBaseId: kbId,
      items: await knowledgeRepository.listTags(organizationId, kbId),
    };
  },

  async createTag(userId: string, input: CreateTagInput) {
    const context = await requireKnowledgePermission(userId, "knowledge.manage");
    const organizationId = context.organization.id;
    const kbId = await resolveKnowledgeBaseId(
      organizationId,
      userId,
      input.knowledgeBaseId,
    );
    const tag = await knowledgeRepository.createTag({
      organizationId,
      knowledgeBaseId: kbId,
      name: input.name,
    });
    await invalidateKnowledgeCaches(organizationId, kbId);
    return tag;
  },

  async list(userId: string, input: ListArticlesInput) {
    const context = await requireKnowledgePermission(userId, "knowledge.read");
    const organizationId = context.organization.id;
    const restricted = restrictedReaderStatuses(context.role);

    let status: KnowledgeArticleStatus | KnowledgeArticleStatus[] | undefined =
      input.status;
    let authorId = input.authorId;
    let includeAuthorDraftsFor: string | undefined;

    if (restricted) {
      if (input.status === "ARCHIVED") {
        return {
          items: [],
          page: input.page,
          pageSize: input.pageSize,
          total: 0,
          totalPages: 1,
        };
      }
      if (input.status === "DRAFT" || input.status === "IN_REVIEW") {
        status = input.status;
        authorId = userId;
      } else if (input.status === "PUBLISHED") {
        status = "PUBLISHED";
      } else {
        status = restricted;
        includeAuthorDraftsFor = userId;
      }
    }

    const result = await knowledgeRepository.listArticles({
      organizationId,
      q: input.q,
      categoryId: input.categoryId,
      tagId: input.tagId,
      visibility: input.visibility,
      authorId,
      status,
      includeAuthorDraftsFor,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    });

    return {
      items: result.items.map((item) => toListItem(item)),
      page: input.page,
      pageSize: input.pageSize,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / input.pageSize)),
    };
  },

  async get(userId: string, articleId: string, options?: { recordView?: boolean }) {
    const context = await requireKnowledgePermission(userId, "knowledge.read");
    const organizationId = context.organization.id;
    const article = await loadArticleOrThrow(organizationId, articleId);

    if (!canViewArticle(article, userId, context.role)) {
      throw new KnowledgeServiceError("Article not found.", "NOT_FOUND");
    }

    if (options?.recordView !== false && article.status === "PUBLISHED") {
      await knowledgeRepository.recordView({
        organizationId,
        articleId,
        viewerId: userId,
      });
      await invalidateKnowledgeCaches(organizationId, article.knowledgeBaseId);
    }

    const fresh =
      options?.recordView === false
        ? article
        : ((await knowledgeRepository.findArticleById(organizationId, articleId)) ??
          article);

    return toPublicArticle(fresh, { includeHtml: true });
  },

  async create(userId: string, input: CreateArticleInput) {
    const context = await requireKnowledgePermission(userId, "knowledge.create");
    const organizationId = context.organization.id;
    const kbId = await resolveKnowledgeBaseId(
      organizationId,
      userId,
      input.knowledgeBaseId,
    );

    let tagIds = input.tagIds ?? [];
    if (input.tagNames?.length) {
      const created = await knowledgeRepository.findOrCreateTags(
        organizationId,
        kbId,
        input.tagNames,
      );
      tagIds = [...new Set([...tagIds, ...created.map((tag) => tag.id)])];
    }

    try {
      const article = await knowledgeRepository.createArticle({
        organizationId,
        knowledgeBaseId: kbId,
        authorId: userId,
        ownerId: userId,
        title: input.title,
        excerpt: input.excerpt,
        bodyMarkdown: input.bodyMarkdown,
        categoryId: input.categoryId,
        visibility: input.visibility,
        tagIds,
        changeSummary: input.changeSummary,
      });
      await invalidateKnowledgeCaches(organizationId, kbId);
      return toPublicArticle(article, { includeHtml: true });
    } catch (error) {
      mapRepoError(error);
    }
  },

  async update(userId: string, articleId: string, input: UpdateArticleInput) {
    const context = await requireKnowledgePermission(userId, "knowledge.update");
    const organizationId = context.organization.id;
    const article = await loadArticleOrThrow(organizationId, articleId);

    if (
      !canPublish(context.role) &&
      !hasPermission(context.role, "knowledge.manage") &&
      article.authorId !== userId
    ) {
      throw new KnowledgeServiceError(
        "You can only edit your own articles.",
        "FORBIDDEN",
      );
    }

    if (article.status === "ARCHIVED") {
      throw new KnowledgeServiceError(
        "Restore the article before editing.",
        "INVALID_TRANSITION",
      );
    }

    try {
      if (input.tagIds || input.tagNames) {
        let tagIds = input.tagIds ?? article.tags.map((row) => row.tagId);
        if (input.tagNames?.length) {
          const created = await knowledgeRepository.findOrCreateTags(
            organizationId,
            article.knowledgeBaseId,
            input.tagNames,
          );
          tagIds = [...new Set([...tagIds, ...created.map((tag) => tag.id)])];
        }
        await knowledgeRepository.replaceTags(organizationId, articleId, tagIds);
      }

      const updated = await knowledgeRepository.updateDraft(
        organizationId,
        articleId,
        userId,
        {
          title: input.title,
          excerpt: input.excerpt,
          bodyMarkdown: input.bodyMarkdown,
          categoryId: input.categoryId,
          visibility: input.visibility,
          changeSummary: input.changeSummary,
        },
      );
      if (!updated) {
        throw new KnowledgeServiceError("Article not found.", "NOT_FOUND");
      }
      await invalidateKnowledgeCaches(organizationId, article.knowledgeBaseId);
      return toPublicArticle(updated, { includeHtml: true });
    } catch (error) {
      if (error instanceof KnowledgeServiceError) throw error;
      mapRepoError(error);
    }
  },

  async submitForReview(userId: string, articleId: string, note?: string | null) {
    const context = await requireOrganizationContext(userId);
    if (
      !hasPermission(context.role, "knowledge.update") &&
      !hasPermission(context.role, "knowledge.review")
    ) {
      throw new AuthorizationError(
        "You do not have permission to perform this action.",
        "MISSING_PERMISSION",
      );
    }

    const organizationId = context.organization.id;
    const article = await loadArticleOrThrow(organizationId, articleId);
    assertTransition(article.status, "IN_REVIEW");

    if (
      !canPublish(context.role) &&
      !hasPermission(context.role, "knowledge.manage") &&
      article.authorId !== userId
    ) {
      throw new KnowledgeServiceError(
        "You can only submit your own articles.",
        "FORBIDDEN",
      );
    }

    const updated = await knowledgeRepository.setArticleStatus(
      organizationId,
      articleId,
      userId,
      "IN_REVIEW",
      {
        message: note ?? "Submitted for review",
        activityType: "SUBMITTED_FOR_REVIEW",
      },
    );
    await invalidateKnowledgeCaches(organizationId, article.knowledgeBaseId);
    return toPublicArticle(updated!, { includeHtml: true });
  },

  async publish(userId: string, articleId: string, changeSummary?: string | null) {
    const context = await requireKnowledgePermission(userId, "knowledge.publish");
    const organizationId = context.organization.id;
    const article = await loadArticleOrThrow(organizationId, articleId);
    assertTransition(article.status, "PUBLISHED");

    const updated = await knowledgeRepository.setArticleStatus(
      organizationId,
      articleId,
      userId,
      "PUBLISHED",
      {
        message: changeSummary ?? "Article published",
        activityType: "ARTICLE_PUBLISHED",
        metadata: changeSummary ? { changeSummary } : undefined,
      },
    );
    await invalidateKnowledgeCaches(organizationId, article.knowledgeBaseId);
    const indexJob = await enqueueKnowledgeIndex({
      organizationId,
      articleId,
      action: "index",
    }).catch((error) => {
      console.error("[knowledge] enqueue index failed", {
        articleId,
        organizationId,
        message: error instanceof Error ? error.message : error,
      });
      return null;
    });
    if (!indexJob) {
      console.warn("[knowledge] RAG index not queued (Redis/worker unavailable)", {
        articleId,
        organizationId,
      });
    }
    return toPublicArticle(updated!, { includeHtml: true });
  },

  async archive(userId: string, articleId: string, reason?: string | null) {
    const context = await requireKnowledgePermission(userId, "knowledge.archive");
    const organizationId = context.organization.id;
    const article = await loadArticleOrThrow(organizationId, articleId);
    assertTransition(article.status, "ARCHIVED");

    const updated = await knowledgeRepository.setArticleStatus(
      organizationId,
      articleId,
      userId,
      "ARCHIVED",
      {
        message: reason ?? "Article archived",
        activityType: "ARTICLE_ARCHIVED",
      },
    );
    await invalidateKnowledgeCaches(organizationId, article.knowledgeBaseId);
    const deindexJob = await enqueueKnowledgeIndex({
      organizationId,
      articleId,
      action: "deindex",
    }).catch((error) => {
      console.error("[knowledge] enqueue deindex failed", {
        articleId,
        organizationId,
        message: error instanceof Error ? error.message : error,
      });
      return null;
    });
    if (!deindexJob) {
      console.warn("[knowledge] RAG deindex not queued (Redis/worker unavailable)", {
        articleId,
        organizationId,
      });
    }
    return toPublicArticle(updated!, { includeHtml: true });
  },

  async restore(userId: string, articleId: string) {
    const context = await requireKnowledgePermission(userId, "knowledge.archive");
    const organizationId = context.organization.id;
    const article = await loadArticleOrThrow(organizationId, articleId);
    assertTransition(article.status, "DRAFT");

    const updated = await knowledgeRepository.setArticleStatus(
      organizationId,
      articleId,
      userId,
      "DRAFT",
      {
        message: "Article restored to draft",
        activityType: "ARTICLE_REOPENED",
      },
    );
    await invalidateKnowledgeCaches(organizationId, article.knowledgeBaseId);
    return toPublicArticle(updated!, { includeHtml: true });
  },

  async unpublish(userId: string, articleId: string) {
    const context = await requireKnowledgePermission(userId, "knowledge.publish");
    const organizationId = context.organization.id;
    const article = await loadArticleOrThrow(organizationId, articleId);
    assertTransition(article.status, "DRAFT");

    const updated = await knowledgeRepository.setArticleStatus(
      organizationId,
      articleId,
      userId,
      "DRAFT",
      {
        message: "Article unpublished to draft",
        activityType: "ARTICLE_REOPENED",
      },
    );
    await invalidateKnowledgeCaches(organizationId, article.knowledgeBaseId);
    const deindexJob = await enqueueKnowledgeIndex({
      organizationId,
      articleId,
      action: "deindex",
    }).catch((error) => {
      console.error("[knowledge] enqueue deindex failed", {
        articleId,
        organizationId,
        message: error instanceof Error ? error.message : error,
      });
      return null;
    });
    if (!deindexJob) {
      console.warn("[knowledge] RAG deindex not queued (Redis/worker unavailable)", {
        articleId,
        organizationId,
      });
    }
    return toPublicArticle(updated!, { includeHtml: true });
  },

  async listVersions(userId: string, articleId: string) {
    const context = await requireKnowledgePermission(userId, "knowledge.read");
    const organizationId = context.organization.id;
    const article = await loadArticleOrThrow(organizationId, articleId);

    if (!canViewArticle(article, userId, context.role)) {
      throw new KnowledgeServiceError("Article not found.", "NOT_FOUND");
    }

    const versions = await knowledgeRepository.listVersions(
      organizationId,
      articleId,
    );
    return {
      articleId,
      currentVersionId: article.currentVersionId,
      publishedVersionId: article.publishedVersionId,
      items: versions ?? [],
    };
  },

  async restoreVersion(
    userId: string,
    articleId: string,
    versionId: string,
    changeSummary?: string | null,
  ) {
    const context = await requireKnowledgePermission(userId, "knowledge.update");
    const organizationId = context.organization.id;
    const article = await loadArticleOrThrow(organizationId, articleId);

    if (
      !canPublish(context.role) &&
      !hasPermission(context.role, "knowledge.manage") &&
      article.authorId !== userId
    ) {
      throw new KnowledgeServiceError(
        "You can only restore versions on your own articles.",
        "FORBIDDEN",
      );
    }

    const updated = await knowledgeRepository.restoreVersion(
      organizationId,
      articleId,
      versionId,
      userId,
      changeSummary,
    );
    if (!updated) {
      throw new KnowledgeServiceError("Version not found.", "NOT_FOUND");
    }
    await invalidateKnowledgeCaches(organizationId, article.knowledgeBaseId);
    return toPublicArticle(updated, { includeHtml: true });
  },

  async search(userId: string, input: SearchKnowledgeInput) {
    const context = await requireKnowledgePermission(userId, "knowledge.read");
    const organizationId = context.organization.id;
    const restricted = restrictedReaderStatuses(context.role);

    const statusFilter = restricted
      ? input.status && restricted.includes(input.status)
        ? input.status
        : restricted
      : input.status;

    const result = await knowledgeRepository.searchArticles({
      organizationId,
      query: input.q,
      categoryId: input.categoryId,
      tagId: input.tagId,
      visibility: input.visibility,
      status: statusFilter,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    });

    await knowledgeRepository.recordSearchEvent({
      organizationId,
      userId,
      query: input.q,
      resultCount: result.total,
    });

    return {
      items: result.items.map((item) => toListItem(item, result.ranks[item.id])),
      page: input.page,
      pageSize: input.pageSize,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / input.pageSize)),
      q: input.q,
    };
  },

  async submitFeedback(
    userId: string,
    articleId: string,
    input: FeedbackInput,
  ) {
    const context = await requireKnowledgePermission(userId, "knowledge.read");
    const organizationId = context.organization.id;
    const article = await loadArticleOrThrow(organizationId, articleId);

    if (!canViewArticle(article, userId, context.role)) {
      throw new KnowledgeServiceError("Article not found.", "NOT_FOUND");
    }

    const feedback = await knowledgeRepository.upsertFeedback({
      organizationId,
      articleId,
      userId,
      helpful: input.helpful,
      comment: input.comment,
    });
    if (!feedback) {
      throw new KnowledgeServiceError("Article not found.", "NOT_FOUND");
    }

    await invalidateKnowledgeCaches(organizationId, article.knowledgeBaseId);
    return feedback;
  },

  async getSummary(userId: string) {
    const context = await requireKnowledgePermission(userId, "knowledge.read");
    const organizationId = context.organization.id;

    const { value } = await cacheGetOrSet(
      organizationId,
      cacheKeys.knowledgeSummary(organizationId),
      CACHE_TTL.knowledgeSummary,
      async () => {
        const analytics =
          await knowledgeRepository.getAnalyticsSummary(organizationId);
        return analytics.totals;
      },
    );

    return value;
  },

  async getPopular(userId: string) {
    const context = await requireKnowledgePermission(userId, "knowledge.read");
    const organizationId = context.organization.id;

    const { value } = await cacheGetOrSet(
      organizationId,
      cacheKeys.knowledgePopular(organizationId),
      CACHE_TTL.knowledgePopular,
      async () => {
        const items = await knowledgeRepository.listPopular(organizationId, 10);
        return items.map((item) => toListItem(item));
      },
    );

    return { items: value };
  },

  async getAnalytics(userId: string) {
    const context = await requireOrganizationContext(userId);
    if (
      !hasPermission(context.role, "knowledge.manage") &&
      !hasPermission(context.role, "analytics.read")
    ) {
      requirePermission(context.role, "knowledge.manage");
    }

    const organizationId = context.organization.id;
    const analytics =
      await knowledgeRepository.getAnalyticsSummary(organizationId);

    return {
      totals: analytics.totals,
      popular: analytics.popular.map((item) => toListItem(item)),
      poorFeedback: analytics.poorFeedback.map((item) => toListItem(item)),
      recentlyUpdated: analytics.recentlyUpdated.map((item) => toListItem(item)),
      topQueries: analytics.topQueries,
    };
  },
};
