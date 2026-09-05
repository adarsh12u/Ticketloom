import { z } from "zod";

export const KNOWLEDGE_VISIBILITIES = ["INTERNAL", "PUBLIC"] as const;
export const KNOWLEDGE_ARTICLE_STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "PUBLISHED",
  "ARCHIVED",
] as const;
export const KNOWLEDGE_CATEGORY_STATUSES = ["ACTIVE", "ARCHIVED"] as const;

export const createArticleSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(200),
  excerpt: z.string().trim().max(500).optional().nullable(),
  bodyMarkdown: z.string().trim().min(1, "Content is required").max(200_000),
  categoryId: z.string().min(1).optional().nullable(),
  knowledgeBaseId: z.string().min(1).optional(),
  visibility: z.enum(KNOWLEDGE_VISIBILITIES).optional(),
  tagIds: z.array(z.string().min(1)).max(30).optional(),
  tagNames: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  changeSummary: z.string().trim().max(240).optional().nullable(),
});

export const updateArticleSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  excerpt: z.string().trim().max(500).optional().nullable(),
  bodyMarkdown: z.string().trim().min(1).max(200_000).optional(),
  categoryId: z.string().min(1).optional().nullable(),
  visibility: z.enum(KNOWLEDGE_VISIBILITIES).optional(),
  tagIds: z.array(z.string().min(1)).max(30).optional(),
  tagNames: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  changeSummary: z.string().trim().max(240).optional().nullable(),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  parentCategoryId: z.string().min(1).optional().nullable(),
  knowledgeBaseId: z.string().min(1).optional(),
  sortOrder: z.coerce.number().int().min(0).max(10_000).optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  parentCategoryId: z.string().min(1).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(10_000).optional(),
  status: z.enum(KNOWLEDGE_CATEGORY_STATUSES).optional(),
});

export const createTagSchema = z.object({
  name: z.string().trim().min(1).max(60),
  knowledgeBaseId: z.string().min(1).optional(),
});

export const feedbackSchema = z.object({
  helpful: z.boolean(),
  comment: z.string().trim().max(2000).optional().nullable(),
});

export const searchKnowledgeSchema = z.object({
  q: z.string().trim().min(1).max(200),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  categoryId: z.string().min(1).optional(),
  tagId: z.string().min(1).optional(),
  status: z.enum(KNOWLEDGE_ARTICLE_STATUSES).optional(),
  visibility: z.enum(KNOWLEDGE_VISIBILITIES).optional(),
});

export const listArticlesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(200).optional(),
  categoryId: z.string().min(1).optional(),
  tagId: z.string().min(1).optional(),
  status: z.enum(KNOWLEDGE_ARTICLE_STATUSES).optional(),
  visibility: z.enum(KNOWLEDGE_VISIBILITIES).optional(),
  authorId: z.string().min(1).optional(),
});

export const submitArticleSchema = z.object({
  note: z.string().trim().max(500).optional().nullable(),
});

export const publishArticleSchema = z.object({
  changeSummary: z.string().trim().max(240).optional().nullable(),
});

export const archiveArticleSchema = z.object({
  reason: z.string().trim().max(500).optional().nullable(),
});

export const restoreArticleSchema = z.object({
  versionId: z.string().min(1).optional(),
});

export const restoreVersionSchema = z.object({
  versionId: z.string().min(1),
  changeSummary: z.string().trim().max(240).optional().nullable(),
});

export type CreateArticleInput = z.infer<typeof createArticleSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateTagInput = z.infer<typeof createTagSchema>;
export type FeedbackInput = z.infer<typeof feedbackSchema>;
export type SearchKnowledgeInput = z.infer<typeof searchKnowledgeSchema>;
export type ListArticlesInput = z.infer<typeof listArticlesSchema>;
