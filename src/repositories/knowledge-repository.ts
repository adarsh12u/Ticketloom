import type {
  KnowledgeArticleActivityType,
  KnowledgeArticleStatus,
  KnowledgeCategoryStatus,
  KnowledgeVisibility,
  Prisma,
} from "@/generated/prisma/client";
import { Prisma as PrismaRuntime } from "@/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";
import { markdownToPlainText } from "@/lib/knowledge/markdown";
import { slugifyKnowledgeTitle } from "@/lib/knowledge/slug";
import { uniqueSlug } from "@/lib/utils/slug";

const userSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
  firstName: true,
  lastName: true,
} satisfies Prisma.UserSelect;

const tagSelect = {
  id: true,
  name: true,
  slug: true,
  knowledgeBaseId: true,
} satisfies Prisma.KnowledgeTagSelect;

const articleListInclude = {
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      parentCategoryId: true,
    },
  },
  author: { select: userSelect },
  owner: { select: userSelect },
  tags: {
    include: { tag: { select: tagSelect } },
  },
  currentVersion: {
    select: {
      id: true,
      versionNumber: true,
      title: true,
      changeSummary: true,
      createdAt: true,
      publishedAt: true,
    },
  },
  publishedVersion: {
    select: {
      id: true,
      versionNumber: true,
      title: true,
      publishedAt: true,
    },
  },
  _count: {
    select: { versions: true, feedback: true, views: true },
  },
} satisfies Prisma.KnowledgeArticleInclude;

const articleDetailInclude = {
  ...articleListInclude,
  knowledgeBase: {
    select: {
      id: true,
      name: true,
      slug: true,
      visibility: true,
      status: true,
    },
  },
  currentVersion: true,
  publishedVersion: true,
  activities: {
    include: { actor: { select: userSelect } },
    orderBy: { createdAt: "desc" as const },
    take: 50,
  },
} satisfies Prisma.KnowledgeArticleInclude;

export type ArticleListFilters = {
  organizationId: string;
  knowledgeBaseId?: string;
  q?: string;
  categoryId?: string;
  tagId?: string;
  status?: KnowledgeArticleStatus | KnowledgeArticleStatus[];
  visibility?: KnowledgeVisibility;
  authorId?: string;
  /** When set with statuses including drafts, also include author's own drafts. */
  includeAuthorDraftsFor?: string;
  skip: number;
  take: number;
};

export type SearchArticleFilters = {
  organizationId: string;
  query: string;
  categoryId?: string;
  tagId?: string;
  status?: KnowledgeArticleStatus | KnowledgeArticleStatus[];
  visibility?: KnowledgeVisibility;
  skip: number;
  take: number;
};

async function allocateUniqueSlug(
  knowledgeBaseId: string,
  title: string,
  excludeArticleId?: string,
) {
  const base = slugifyKnowledgeTitle(title);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate =
      attempt === 0 ? base : uniqueSlug(base, Math.random().toString(36).slice(2, 7));
    const existing = await prisma.knowledgeArticle.findFirst({
      where: {
        knowledgeBaseId,
        slug: candidate,
        ...(excludeArticleId ? { id: { not: excludeArticleId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  return uniqueSlug(base, Date.now().toString(36));
}

async function allocateCategorySlug(
  knowledgeBaseId: string,
  name: string,
  excludeCategoryId?: string,
) {
  const base = slugifyKnowledgeTitle(name);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate =
      attempt === 0 ? base : uniqueSlug(base, Math.random().toString(36).slice(2, 7));
    const existing = await prisma.knowledgeCategory.findFirst({
      where: {
        knowledgeBaseId,
        slug: candidate,
        ...(excludeCategoryId ? { id: { not: excludeCategoryId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  return uniqueSlug(base, Date.now().toString(36));
}

async function allocateTagSlug(knowledgeBaseId: string, name: string) {
  const base = slugifyKnowledgeTitle(name);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate =
      attempt === 0 ? base : uniqueSlug(base, Math.random().toString(36).slice(2, 7));
    const existing = await prisma.knowledgeTag.findFirst({
      where: { knowledgeBaseId, slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  return uniqueSlug(base, Date.now().toString(36));
}

async function assertNoCircularParent(
  organizationId: string,
  categoryId: string,
  parentCategoryId: string,
) {
  if (categoryId === parentCategoryId) {
    throw new Error("CATEGORY_CYCLE");
  }

  let cursor: string | null = parentCategoryId;
  const seen = new Set<string>([categoryId]);

  while (cursor) {
    if (seen.has(cursor)) {
      throw new Error("CATEGORY_CYCLE");
    }
    seen.add(cursor);
    const parent: { parentCategoryId: string | null } | null =
      await prisma.knowledgeCategory.findFirst({
        where: { id: cursor, organizationId },
        select: { parentCategoryId: true },
      });
    cursor = parent?.parentCategoryId ?? null;
  }
}

async function nextVersionNumber(
  tx: Prisma.TransactionClient,
  articleId: string,
) {
  const latest = await tx.knowledgeArticleVersion.findFirst({
    where: { articleId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });
  return (latest?.versionNumber ?? 0) + 1;
}

async function recordActivity(
  tx: Prisma.TransactionClient,
  data: {
    organizationId: string;
    articleId: string;
    actorId?: string | null;
    type: KnowledgeArticleActivityType;
    message?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
) {
  return tx.knowledgeArticleActivity.create({
    data: {
      organizationId: data.organizationId,
      articleId: data.articleId,
      actorId: data.actorId ?? null,
      type: data.type,
      message: data.message ?? null,
      metadata: data.metadata,
    },
  });
}

export const knowledgeRepository = {
  async ensureDefaultKnowledgeBase(organizationId: string, userId: string) {
    const existing = await prisma.knowledgeBase.findFirst({
      where: { organizationId, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    });
    if (existing) return existing;

    return prisma.knowledgeBase.create({
      data: {
        organizationId,
        name: "Knowledge Base",
        slug: "default",
        description: "Default organization knowledge base",
        visibility: "INTERNAL",
        status: "ACTIVE",
        createdById: userId,
      },
    });
  },

  async findKnowledgeBase(organizationId: string, knowledgeBaseId: string) {
    return prisma.knowledgeBase.findFirst({
      where: { id: knowledgeBaseId, organizationId },
    });
  },

  async listCategories(organizationId: string, knowledgeBaseId: string) {
    return prisma.knowledgeCategory.findMany({
      where: { organizationId, knowledgeBaseId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        parent: { select: { id: true, name: true, slug: true } },
        _count: { select: { articles: true, children: true } },
      },
    });
  },

  async createCategory(data: {
    organizationId: string;
    knowledgeBaseId: string;
    name: string;
    description?: string | null;
    parentCategoryId?: string | null;
    sortOrder?: number;
  }) {
    if (data.parentCategoryId) {
      const parent = await prisma.knowledgeCategory.findFirst({
        where: {
          id: data.parentCategoryId,
          organizationId: data.organizationId,
          knowledgeBaseId: data.knowledgeBaseId,
        },
        select: { id: true },
      });
      if (!parent) {
        throw new Error("INVALID_PARENT");
      }
    }

    const slug = await allocateCategorySlug(data.knowledgeBaseId, data.name);

    return prisma.knowledgeCategory.create({
      data: {
        organizationId: data.organizationId,
        knowledgeBaseId: data.knowledgeBaseId,
        name: data.name,
        slug,
        description: data.description ?? null,
        parentCategoryId: data.parentCategoryId ?? null,
        sortOrder: data.sortOrder ?? 0,
        status: "ACTIVE",
      },
      include: {
        parent: { select: { id: true, name: true, slug: true } },
        _count: { select: { articles: true, children: true } },
      },
    });
  },

  async updateCategory(
    organizationId: string,
    categoryId: string,
    data: {
      name?: string;
      description?: string | null;
      parentCategoryId?: string | null;
      sortOrder?: number;
      status?: KnowledgeCategoryStatus;
    },
  ) {
    const category = await prisma.knowledgeCategory.findFirst({
      where: { id: categoryId, organizationId },
    });
    if (!category) return null;

    if (data.parentCategoryId !== undefined && data.parentCategoryId !== null) {
      const parent = await prisma.knowledgeCategory.findFirst({
        where: {
          id: data.parentCategoryId,
          organizationId,
          knowledgeBaseId: category.knowledgeBaseId,
        },
        select: { id: true },
      });
      if (!parent) {
        throw new Error("INVALID_PARENT");
      }
      await assertNoCircularParent(organizationId, categoryId, data.parentCategoryId);
    }

    const slug =
      data.name && data.name !== category.name
        ? await allocateCategorySlug(category.knowledgeBaseId, data.name, categoryId)
        : undefined;

    await prisma.knowledgeCategory.updateMany({
      where: { id: categoryId, organizationId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(slug ? { slug } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.parentCategoryId !== undefined
          ? { parentCategoryId: data.parentCategoryId }
          : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    });

    return prisma.knowledgeCategory.findFirst({
      where: { id: categoryId, organizationId },
      include: {
        parent: { select: { id: true, name: true, slug: true } },
        _count: { select: { articles: true, children: true } },
      },
    });
  },

  async listTags(organizationId: string, knowledgeBaseId: string) {
    return prisma.knowledgeTag.findMany({
      where: { organizationId, knowledgeBaseId },
      orderBy: { name: "asc" },
      include: { _count: { select: { articles: true } } },
    });
  },

  async createTag(data: {
    organizationId: string;
    knowledgeBaseId: string;
    name: string;
  }) {
    const slug = await allocateTagSlug(data.knowledgeBaseId, data.name);
    return prisma.knowledgeTag.create({
      data: {
        organizationId: data.organizationId,
        knowledgeBaseId: data.knowledgeBaseId,
        name: data.name,
        slug,
      },
      include: { _count: { select: { articles: true } } },
    });
  },

  async findOrCreateTags(
    organizationId: string,
    knowledgeBaseId: string,
    names: string[],
  ) {
    const tags = [];
    for (const name of names) {
      const slug = slugifyKnowledgeTitle(name);
      const existing = await prisma.knowledgeTag.findFirst({
        where: { organizationId, knowledgeBaseId, slug },
      });
      if (existing) {
        tags.push(existing);
        continue;
      }
      tags.push(
        await this.createTag({ organizationId, knowledgeBaseId, name }),
      );
    }
    return tags;
  },

  async replaceTags(
    organizationId: string,
    articleId: string,
    tagIds: string[],
  ) {
    const article = await prisma.knowledgeArticle.findFirst({
      where: { id: articleId, organizationId },
      select: { id: true, knowledgeBaseId: true },
    });
    if (!article) return null;

    if (tagIds.length) {
      const valid = await prisma.knowledgeTag.findMany({
        where: {
          id: { in: tagIds },
          organizationId,
          knowledgeBaseId: article.knowledgeBaseId,
        },
        select: { id: true },
      });
      if (valid.length !== tagIds.length) {
        throw new Error("INVALID_TAG");
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.knowledgeArticleTag.deleteMany({
        where: { articleId, organizationId },
      });
      if (tagIds.length) {
        await tx.knowledgeArticleTag.createMany({
          data: tagIds.map((tagId) => ({
            articleId,
            tagId,
            organizationId,
          })),
        });
      }
      await recordActivity(tx, {
        organizationId,
        articleId,
        type: "TAGS_CHANGED",
        message: "Article tags updated",
        metadata: { tagIds },
      });
    });

    return this.findArticleById(organizationId, articleId);
  },

  async createArticle(data: {
    organizationId: string;
    knowledgeBaseId: string;
    authorId: string;
    ownerId: string;
    title: string;
    excerpt?: string | null;
    bodyMarkdown: string;
    categoryId?: string | null;
    visibility?: KnowledgeVisibility;
    tagIds?: string[];
    changeSummary?: string | null;
  }) {
    if (data.categoryId) {
      const category = await prisma.knowledgeCategory.findFirst({
        where: {
          id: data.categoryId,
          organizationId: data.organizationId,
          knowledgeBaseId: data.knowledgeBaseId,
        },
        select: { id: true },
      });
      if (!category) throw new Error("INVALID_CATEGORY");
    }

    const bodyText = markdownToPlainText(data.bodyMarkdown);
    const slug = await allocateUniqueSlug(data.knowledgeBaseId, data.title);
    const excerpt =
      data.excerpt?.trim() ||
      bodyText.slice(0, 240) ||
      null;

    return prisma.$transaction(async (tx) => {
      const article = await tx.knowledgeArticle.create({
        data: {
          organizationId: data.organizationId,
          knowledgeBaseId: data.knowledgeBaseId,
          categoryId: data.categoryId ?? null,
          title: data.title,
          slug,
          excerpt,
          status: "DRAFT",
          visibility: data.visibility ?? "INTERNAL",
          authorId: data.authorId,
          ownerId: data.ownerId,
          bodyText,
        },
      });

      const version = await tx.knowledgeArticleVersion.create({
        data: {
          organizationId: data.organizationId,
          articleId: article.id,
          versionNumber: 1,
          title: data.title,
          excerpt,
          bodyMarkdown: data.bodyMarkdown,
          bodyText,
          changeSummary: data.changeSummary ?? "Initial draft",
          editorId: data.authorId,
        },
      });

      await tx.knowledgeArticle.update({
        where: { id: article.id },
        data: { currentVersionId: version.id },
      });

      if (data.tagIds?.length) {
        const valid = await tx.knowledgeTag.findMany({
          where: {
            id: { in: data.tagIds },
            organizationId: data.organizationId,
            knowledgeBaseId: data.knowledgeBaseId,
          },
          select: { id: true },
        });
        if (valid.length !== data.tagIds.length) {
          throw new Error("INVALID_TAG");
        }
        await tx.knowledgeArticleTag.createMany({
          data: data.tagIds.map((tagId) => ({
            articleId: article.id,
            tagId,
            organizationId: data.organizationId,
          })),
        });
      }

      await recordActivity(tx, {
        organizationId: data.organizationId,
        articleId: article.id,
        actorId: data.authorId,
        type: "ARTICLE_CREATED",
        message: "Article created",
        metadata: { versionId: version.id },
      });
      await recordActivity(tx, {
        organizationId: data.organizationId,
        articleId: article.id,
        actorId: data.authorId,
        type: "VERSION_CREATED",
        message: "Version 1 created",
        metadata: { versionId: version.id, versionNumber: 1 },
      });

      return tx.knowledgeArticle.findFirstOrThrow({
        where: { id: article.id, organizationId: data.organizationId },
        include: articleDetailInclude,
      });
    });
  },

  async findArticleById(organizationId: string, articleId: string) {
    return prisma.knowledgeArticle.findFirst({
      where: { id: articleId, organizationId },
      include: articleDetailInclude,
    });
  },

  async listArticles(filters: ArticleListFilters) {
    const statuses = filters.status
      ? Array.isArray(filters.status)
        ? filters.status
        : [filters.status]
      : undefined;

    const where: Prisma.KnowledgeArticleWhereInput = {
      organizationId: filters.organizationId,
      ...(filters.knowledgeBaseId
        ? { knowledgeBaseId: filters.knowledgeBaseId }
        : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.visibility ? { visibility: filters.visibility } : {}),
      ...(filters.tagId
        ? { tags: { some: { tagId: filters.tagId, organizationId: filters.organizationId } } }
        : {}),
      ...(filters.q
        ? {
            OR: [
              { title: { contains: filters.q, mode: "insensitive" } },
              { excerpt: { contains: filters.q, mode: "insensitive" } },
              { bodyText: { contains: filters.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    if (filters.includeAuthorDraftsFor && statuses) {
      where.AND = [
        {
          OR: [
            { status: { in: statuses } },
            {
              authorId: filters.includeAuthorDraftsFor,
              status: { in: ["DRAFT", "IN_REVIEW"] },
            },
          ],
        },
      ];
    } else if (statuses) {
      where.status = { in: statuses };
    }

    if (filters.authorId) {
      where.authorId = filters.authorId;
    }

    const [items, total] = await Promise.all([
      prisma.knowledgeArticle.findMany({
        where,
        include: articleListInclude,
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        skip: filters.skip,
        take: filters.take,
      }),
      prisma.knowledgeArticle.count({ where }),
    ]);

    return { items, total };
  },

  /**
   * Update draft content. When the current version is the published version,
   * creates a new version so publish history is preserved.
   */
  async updateDraft(
    organizationId: string,
    articleId: string,
    editorId: string,
    data: {
      title?: string;
      excerpt?: string | null;
      bodyMarkdown?: string;
      categoryId?: string | null;
      visibility?: KnowledgeVisibility;
      changeSummary?: string | null;
    },
  ) {
    const article = await prisma.knowledgeArticle.findFirst({
      where: { id: articleId, organizationId },
      include: { currentVersion: true },
    });
    if (!article) return null;

    if (data.categoryId) {
      const category = await prisma.knowledgeCategory.findFirst({
        where: {
          id: data.categoryId,
          organizationId,
          knowledgeBaseId: article.knowledgeBaseId,
        },
        select: { id: true },
      });
      if (!category) throw new Error("INVALID_CATEGORY");
    }

    const nextTitle = data.title ?? article.title;
    const nextBodyMarkdown =
      data.bodyMarkdown ?? article.currentVersion?.bodyMarkdown ?? "";
    const bodyText = markdownToPlainText(nextBodyMarkdown);
    const nextExcerpt =
      data.excerpt !== undefined
        ? data.excerpt
        : article.excerpt ?? (bodyText.slice(0, 240) || null);

    const needsNewVersion =
      Boolean(article.publishedVersionId) &&
      article.currentVersionId === article.publishedVersionId;

    const slug =
      data.title && data.title !== article.title
        ? await allocateUniqueSlug(article.knowledgeBaseId, data.title, articleId)
        : undefined;

    return prisma.$transaction(async (tx) => {
      let currentVersionId = article.currentVersionId;

      if (needsNewVersion || !article.currentVersionId) {
        const versionNumber = await nextVersionNumber(tx, articleId);
        const version = await tx.knowledgeArticleVersion.create({
          data: {
            organizationId,
            articleId,
            versionNumber,
            title: nextTitle,
            excerpt: nextExcerpt,
            bodyMarkdown: nextBodyMarkdown,
            bodyText,
            changeSummary: data.changeSummary ?? "Draft update",
            editorId,
          },
        });
        currentVersionId = version.id;
        await recordActivity(tx, {
          organizationId,
          articleId,
          actorId: editorId,
          type: "VERSION_CREATED",
          message: `Version ${versionNumber} created`,
          metadata: { versionId: version.id, versionNumber },
        });
      } else if (article.currentVersion) {
        await tx.knowledgeArticleVersion.update({
          where: { id: article.currentVersion.id },
          data: {
            title: nextTitle,
            excerpt: nextExcerpt,
            bodyMarkdown: nextBodyMarkdown,
            bodyText,
            ...(data.changeSummary !== undefined
              ? { changeSummary: data.changeSummary }
              : {}),
            editorId,
          },
        });
      }

      const categoryChanged =
        data.categoryId !== undefined && data.categoryId !== article.categoryId;
      const visibilityChanged =
        data.visibility !== undefined && data.visibility !== article.visibility;

      await tx.knowledgeArticle.updateMany({
        where: { id: articleId, organizationId },
        data: {
          title: nextTitle,
          ...(slug ? { slug } : {}),
          excerpt: nextExcerpt,
          bodyText,
          currentVersionId,
          ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
          ...(data.visibility !== undefined ? { visibility: data.visibility } : {}),
        },
      });

      await recordActivity(tx, {
        organizationId,
        articleId,
        actorId: editorId,
        type: "ARTICLE_UPDATED",
        message: "Article draft updated",
      });

      if (categoryChanged) {
        await recordActivity(tx, {
          organizationId,
          articleId,
          actorId: editorId,
          type: "CATEGORY_CHANGED",
          message: "Category changed",
          metadata: { categoryId: data.categoryId ?? null },
        });
      }
      if (visibilityChanged) {
        await recordActivity(tx, {
          organizationId,
          articleId,
          actorId: editorId,
          type: "VISIBILITY_CHANGED",
          message: "Visibility changed",
          metadata: { visibility: data.visibility },
        });
      }

      return tx.knowledgeArticle.findFirstOrThrow({
        where: { id: articleId, organizationId },
        include: articleDetailInclude,
      });
    });
  },

  async setArticleStatus(
    organizationId: string,
    articleId: string,
    actorId: string,
    status: KnowledgeArticleStatus,
    options?: {
      message?: string | null;
      activityType?: KnowledgeArticleActivityType;
      metadata?: Prisma.InputJsonValue;
      publishCurrentVersion?: boolean;
    },
  ) {
    const article = await prisma.knowledgeArticle.findFirst({
      where: { id: articleId, organizationId },
    });
    if (!article) return null;

    const now = new Date();

    return prisma.$transaction(async (tx) => {
      let publishedVersionId = article.publishedVersionId;
      const currentVersionId = article.currentVersionId;
      let publishedAt = article.publishedAt;
      let archivedAt = article.archivedAt;

      if (status === "PUBLISHED") {
        if (!currentVersionId && options?.publishCurrentVersion !== false) {
          throw new Error("NO_VERSION");
        }
        publishedVersionId = currentVersionId;
        publishedAt = now;
        archivedAt = null;
        if (currentVersionId) {
          await tx.knowledgeArticleVersion.update({
            where: { id: currentVersionId },
            data: { publishedAt: now },
          });
        }
      } else if (status === "ARCHIVED") {
        archivedAt = now;
      } else if (status === "DRAFT" || status === "IN_REVIEW") {
        archivedAt = null;
        if (article.status === "PUBLISHED" && status === "DRAFT") {
          // keep publishedVersionId for history; current stays as-is until next edit
        }
      }

      await tx.knowledgeArticle.updateMany({
        where: { id: articleId, organizationId },
        data: {
          status,
          publishedVersionId,
          currentVersionId,
          publishedAt,
          archivedAt,
        },
      });

      await recordActivity(tx, {
        organizationId,
        articleId,
        actorId,
        type:
          options?.activityType ??
          (status === "PUBLISHED"
            ? "ARTICLE_PUBLISHED"
            : status === "ARCHIVED"
              ? "ARTICLE_ARCHIVED"
              : status === "IN_REVIEW"
                ? "SUBMITTED_FOR_REVIEW"
                : "ARTICLE_REOPENED"),
        message: options?.message ?? `Status set to ${status}`,
        metadata: options?.metadata,
      });

      return tx.knowledgeArticle.findFirstOrThrow({
        where: { id: articleId, organizationId },
        include: articleDetailInclude,
      });
    });
  },

  async listVersions(organizationId: string, articleId: string) {
    const article = await prisma.knowledgeArticle.findFirst({
      where: { id: articleId, organizationId },
      select: { id: true },
    });
    if (!article) return null;

    return prisma.knowledgeArticleVersion.findMany({
      where: { articleId, organizationId },
      include: { editor: { select: userSelect } },
      orderBy: { versionNumber: "desc" },
    });
  },

  async findVersion(
    organizationId: string,
    articleId: string,
    versionId: string,
  ) {
    return prisma.knowledgeArticleVersion.findFirst({
      where: { id: versionId, articleId, organizationId },
      include: { editor: { select: userSelect } },
    });
  },

  /** Restore creates a NEW version from an older one. */
  async restoreVersion(
    organizationId: string,
    articleId: string,
    versionId: string,
    editorId: string,
    changeSummary?: string | null,
  ) {
    const source = await prisma.knowledgeArticleVersion.findFirst({
      where: { id: versionId, articleId, organizationId },
    });
    if (!source) return null;

    return prisma.$transaction(async (tx) => {
      const versionNumber = await nextVersionNumber(tx, articleId);
      const version = await tx.knowledgeArticleVersion.create({
        data: {
          organizationId,
          articleId,
          versionNumber,
          title: source.title,
          excerpt: source.excerpt,
          bodyMarkdown: source.bodyMarkdown,
          bodyText: source.bodyText,
          changeSummary:
            changeSummary ?? `Restored from version ${source.versionNumber}`,
          editorId,
        },
      });

      await tx.knowledgeArticle.updateMany({
        where: { id: articleId, organizationId },
        data: {
          title: source.title,
          excerpt: source.excerpt,
          bodyText: source.bodyText,
          currentVersionId: version.id,
          status: "DRAFT",
          archivedAt: null,
        },
      });

      await recordActivity(tx, {
        organizationId,
        articleId,
        actorId: editorId,
        type: "VERSION_RESTORED",
        message: `Restored version ${source.versionNumber} as version ${versionNumber}`,
        metadata: {
          sourceVersionId: source.id,
          sourceVersionNumber: source.versionNumber,
          newVersionId: version.id,
          newVersionNumber: versionNumber,
        },
      });
      await recordActivity(tx, {
        organizationId,
        articleId,
        actorId: editorId,
        type: "VERSION_CREATED",
        message: `Version ${versionNumber} created`,
        metadata: { versionId: version.id, versionNumber },
      });

      return tx.knowledgeArticle.findFirstOrThrow({
        where: { id: articleId, organizationId },
        include: articleDetailInclude,
      });
    });
  },

  async searchArticles(filters: SearchArticleFilters) {
    const statuses = filters.status
      ? Array.isArray(filters.status)
        ? filters.status
        : [filters.status]
      : null;

    const statusClause =
      statuses && statuses.length > 0
        ? PrismaRuntime.sql`AND a.status::text IN (${PrismaRuntime.join(statuses)})`
        : PrismaRuntime.empty;

    const categoryClause = filters.categoryId
      ? PrismaRuntime.sql`AND a.category_id = ${filters.categoryId}`
      : PrismaRuntime.empty;

    const visibilityClause = filters.visibility
      ? PrismaRuntime.sql`AND a.visibility::text = ${filters.visibility}`
      : PrismaRuntime.empty;

    const tagClause = filters.tagId
      ? PrismaRuntime.sql`AND EXISTS (
          SELECT 1 FROM knowledge_article_tags t
          WHERE t.article_id = a.id
            AND t.organization_id = ${filters.organizationId}
            AND t.tag_id = ${filters.tagId}
        )`
      : PrismaRuntime.empty;

    const ranked = await prisma.$queryRaw<Array<{ id: string; rank: number }>>`
      SELECT
        a.id,
        ts_rank(a.search_vector, plainto_tsquery('english', ${filters.query})) AS rank
      FROM knowledge_articles a
      WHERE a.organization_id = ${filters.organizationId}
        AND a.search_vector @@ plainto_tsquery('english', ${filters.query})
        ${statusClause}
        ${categoryClause}
        ${visibilityClause}
        ${tagClause}
      ORDER BY rank DESC, a.updated_at DESC
      LIMIT ${filters.take}
      OFFSET ${filters.skip}
    `;

    const countRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM knowledge_articles a
      WHERE a.organization_id = ${filters.organizationId}
        AND a.search_vector @@ plainto_tsquery('english', ${filters.query})
        ${statusClause}
        ${categoryClause}
        ${visibilityClause}
        ${tagClause}
    `;

    const ids = ranked.map((row) => row.id);
    if (!ids.length) {
      return { items: [], total: 0, ranks: {} as Record<string, number> };
    }

    const items = await prisma.knowledgeArticle.findMany({
      where: {
        organizationId: filters.organizationId,
        id: { in: ids },
      },
      include: articleListInclude,
    });

    const rankById = Object.fromEntries(
      ranked.map((row) => [row.id, Number(row.rank)]),
    );
    const order = new Map(ids.map((id, index) => [id, index]));
    items.sort(
      (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
    );

    return {
      items,
      total: Number(countRows[0]?.count ?? 0),
      ranks: rankById,
    };
  },

  async upsertFeedback(data: {
    organizationId: string;
    articleId: string;
    userId: string;
    helpful: boolean;
    comment?: string | null;
  }) {
    const article = await prisma.knowledgeArticle.findFirst({
      where: { id: data.articleId, organizationId: data.organizationId },
      select: { id: true },
    });
    if (!article) return null;

    return prisma.$transaction(async (tx) => {
      const existing = await tx.knowledgeArticleFeedback.findUnique({
        where: {
          articleId_userId: {
            articleId: data.articleId,
            userId: data.userId,
          },
        },
      });

      if (!existing) {
        await tx.knowledgeArticle.updateMany({
          where: { id: data.articleId, organizationId: data.organizationId },
          data: data.helpful
            ? { helpfulCount: { increment: 1 } }
            : { unhelpfulCount: { increment: 1 } },
        });
        return tx.knowledgeArticleFeedback.create({
          data: {
            organizationId: data.organizationId,
            articleId: data.articleId,
            userId: data.userId,
            helpful: data.helpful,
            comment: data.comment ?? null,
          },
        });
      }

      if (existing.helpful !== data.helpful) {
        await tx.knowledgeArticle.updateMany({
          where: { id: data.articleId, organizationId: data.organizationId },
          data: data.helpful
            ? {
                helpfulCount: { increment: 1 },
                unhelpfulCount: { decrement: 1 },
              }
            : {
                helpfulCount: { decrement: 1 },
                unhelpfulCount: { increment: 1 },
              },
        });
      }

      return tx.knowledgeArticleFeedback.update({
        where: { id: existing.id },
        data: {
          helpful: data.helpful,
          comment: data.comment ?? null,
        },
      });
    });
  },

  async recordView(data: {
    organizationId: string;
    articleId: string;
    viewerId?: string | null;
  }) {
    const article = await prisma.knowledgeArticle.findFirst({
      where: { id: data.articleId, organizationId: data.organizationId },
      select: { id: true },
    });
    if (!article) return null;

    await prisma.$transaction([
      prisma.knowledgeArticleView.create({
        data: {
          organizationId: data.organizationId,
          articleId: data.articleId,
          viewerId: data.viewerId ?? null,
        },
      }),
      prisma.knowledgeArticle.updateMany({
        where: { id: data.articleId, organizationId: data.organizationId },
        data: { viewCount: { increment: 1 } },
      }),
    ]);

    return true;
  },

  async recordSearchEvent(data: {
    organizationId: string;
    userId?: string | null;
    query: string;
    resultCount: number;
  }) {
    return prisma.knowledgeSearchEvent.create({
      data: {
        organizationId: data.organizationId,
        userId: data.userId ?? null,
        query: data.query,
        resultCount: data.resultCount,
      },
    });
  },

  async getAnalyticsSummary(organizationId: string) {
    const [
      statusGroups,
      popular,
      poorFeedback,
      recentlyUpdated,
      viewCount,
      searchEvents,
      noResultSearches,
      topQueries,
    ] = await Promise.all([
      prisma.knowledgeArticle.groupBy({
        by: ["status"],
        where: { organizationId },
        _count: { _all: true },
      }),
      prisma.knowledgeArticle.findMany({
        where: { organizationId, status: "PUBLISHED" },
        orderBy: { viewCount: "desc" },
        take: 10,
        include: articleListInclude,
      }),
      prisma.knowledgeArticle.findMany({
        where: {
          organizationId,
          unhelpfulCount: { gt: 0 },
        },
        orderBy: [{ unhelpfulCount: "desc" }, { helpfulCount: "asc" }],
        take: 10,
        include: articleListInclude,
      }),
      prisma.knowledgeArticle.findMany({
        where: { organizationId },
        orderBy: { updatedAt: "desc" },
        take: 10,
        include: articleListInclude,
      }),
      prisma.knowledgeArticleView.count({ where: { organizationId } }),
      prisma.knowledgeSearchEvent.count({ where: { organizationId } }),
      prisma.knowledgeSearchEvent.count({
        where: { organizationId, resultCount: 0 },
      }),
      prisma.$queryRaw<Array<{ query: string; count: bigint }>>`
        SELECT query, COUNT(*)::bigint AS count
        FROM knowledge_search_events
        WHERE organization_id = ${organizationId}
        GROUP BY query
        ORDER BY count DESC
        LIMIT 10
      `,
    ]);

    const byStatus = Object.fromEntries(
      statusGroups.map((row) => [row.status, row._count._all]),
    ) as Partial<Record<KnowledgeArticleStatus, number>>;

    return {
      totals: {
        articles: Object.values(byStatus).reduce((sum, n) => sum + (n ?? 0), 0),
        published: byStatus.PUBLISHED ?? 0,
        drafts: byStatus.DRAFT ?? 0,
        inReview: byStatus.IN_REVIEW ?? 0,
        archived: byStatus.ARCHIVED ?? 0,
        views: viewCount,
        searches: searchEvents,
        noResultSearches,
      },
      popular,
      poorFeedback,
      recentlyUpdated,
      topQueries: topQueries.map((row) => ({
        query: row.query,
        count: Number(row.count),
      })),
    };
  },

  async listPopular(organizationId: string, take = 10) {
    return prisma.knowledgeArticle.findMany({
      where: { organizationId, status: "PUBLISHED" },
      orderBy: { viewCount: "desc" },
      take,
      include: articleListInclude,
    });
  },
};
