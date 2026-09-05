-- CreateEnum
CREATE TYPE "KnowledgeVisibility" AS ENUM ('INTERNAL', 'PUBLIC');

-- CreateEnum
CREATE TYPE "KnowledgeBaseStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "KnowledgeCategoryStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "KnowledgeArticleStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "KnowledgeArticleActivityType" AS ENUM ('ARTICLE_CREATED', 'ARTICLE_UPDATED', 'SUBMITTED_FOR_REVIEW', 'ARTICLE_PUBLISHED', 'ARTICLE_ARCHIVED', 'ARTICLE_REOPENED', 'VERSION_CREATED', 'VERSION_RESTORED', 'CATEGORY_CHANGED', 'TAGS_CHANGED', 'VISIBILITY_CHANGED');

-- CreateTable
CREATE TABLE "knowledge_bases" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "visibility" "KnowledgeVisibility" NOT NULL DEFAULT 'INTERNAL',
    "status" "KnowledgeBaseStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_bases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_categories" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "knowledge_base_id" TEXT NOT NULL,
    "parent_category_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "KnowledgeCategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_articles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "knowledge_base_id" TEXT NOT NULL,
    "category_id" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "status" "KnowledgeArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "KnowledgeVisibility" NOT NULL DEFAULT 'INTERNAL',
    "author_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "current_version_id" TEXT,
    "published_version_id" TEXT,
    "body_text" TEXT NOT NULL DEFAULT '',
    "published_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "unhelpful_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_article_versions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "body_markdown" TEXT NOT NULL,
    "body_text" TEXT NOT NULL,
    "change_summary" TEXT,
    "editor_id" TEXT NOT NULL,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_article_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_tags" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "knowledge_base_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_article_tags" (
    "article_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,

    CONSTRAINT "knowledge_article_tags_pkey" PRIMARY KEY ("article_id","tag_id")
);

-- CreateTable
CREATE TABLE "knowledge_article_views" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "viewer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_article_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_article_feedback" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "helpful" BOOLEAN NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_article_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_article_activities" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "type" "KnowledgeArticleActivityType" NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_article_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_search_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT,
    "query" TEXT NOT NULL,
    "result_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_search_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_bases_organization_id_idx" ON "knowledge_bases"("organization_id");

-- CreateIndex
CREATE INDEX "knowledge_bases_organization_id_status_idx" ON "knowledge_bases"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_bases_organization_id_slug_key" ON "knowledge_bases"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "knowledge_categories_organization_id_idx" ON "knowledge_categories"("organization_id");

-- CreateIndex
CREATE INDEX "knowledge_categories_knowledge_base_id_sort_order_idx" ON "knowledge_categories"("knowledge_base_id", "sort_order");

-- CreateIndex
CREATE INDEX "knowledge_categories_parent_category_id_idx" ON "knowledge_categories"("parent_category_id");

-- CreateIndex
CREATE INDEX "knowledge_categories_organization_id_status_idx" ON "knowledge_categories"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_categories_knowledge_base_id_slug_key" ON "knowledge_categories"("knowledge_base_id", "slug");

-- CreateIndex
CREATE INDEX "knowledge_articles_organization_id_idx" ON "knowledge_articles"("organization_id");

-- CreateIndex
CREATE INDEX "knowledge_articles_organization_id_status_idx" ON "knowledge_articles"("organization_id", "status");

-- CreateIndex
CREATE INDEX "knowledge_articles_organization_id_visibility_idx" ON "knowledge_articles"("organization_id", "visibility");

-- CreateIndex
CREATE INDEX "knowledge_articles_organization_id_category_id_idx" ON "knowledge_articles"("organization_id", "category_id");

-- CreateIndex
CREATE INDEX "knowledge_articles_organization_id_updated_at_idx" ON "knowledge_articles"("organization_id", "updated_at");

-- CreateIndex
CREATE INDEX "knowledge_articles_organization_id_published_at_idx" ON "knowledge_articles"("organization_id", "published_at");

-- CreateIndex
CREATE INDEX "knowledge_articles_knowledge_base_id_status_idx" ON "knowledge_articles"("knowledge_base_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_articles_knowledge_base_id_slug_key" ON "knowledge_articles"("knowledge_base_id", "slug");

-- CreateIndex
CREATE INDEX "knowledge_article_versions_organization_id_idx" ON "knowledge_article_versions"("organization_id");

-- CreateIndex
CREATE INDEX "knowledge_article_versions_article_id_created_at_idx" ON "knowledge_article_versions"("article_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_article_versions_article_id_version_number_key" ON "knowledge_article_versions"("article_id", "version_number");

-- CreateIndex
CREATE INDEX "knowledge_tags_organization_id_idx" ON "knowledge_tags"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_tags_knowledge_base_id_slug_key" ON "knowledge_tags"("knowledge_base_id", "slug");

-- CreateIndex
CREATE INDEX "knowledge_article_tags_tag_id_idx" ON "knowledge_article_tags"("tag_id");

-- CreateIndex
CREATE INDEX "knowledge_article_tags_organization_id_idx" ON "knowledge_article_tags"("organization_id");

-- CreateIndex
CREATE INDEX "knowledge_article_views_article_id_created_at_idx" ON "knowledge_article_views"("article_id", "created_at");

-- CreateIndex
CREATE INDEX "knowledge_article_views_organization_id_created_at_idx" ON "knowledge_article_views"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "knowledge_article_feedback_organization_id_idx" ON "knowledge_article_feedback"("organization_id");

-- CreateIndex
CREATE INDEX "knowledge_article_feedback_article_id_helpful_idx" ON "knowledge_article_feedback"("article_id", "helpful");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_article_feedback_article_id_user_id_key" ON "knowledge_article_feedback"("article_id", "user_id");

-- CreateIndex
CREATE INDEX "knowledge_article_activities_article_id_created_at_idx" ON "knowledge_article_activities"("article_id", "created_at");

-- CreateIndex
CREATE INDEX "knowledge_article_activities_organization_id_type_idx" ON "knowledge_article_activities"("organization_id", "type");

-- CreateIndex
CREATE INDEX "knowledge_search_events_organization_id_created_at_idx" ON "knowledge_search_events"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "knowledge_search_events_organization_id_result_count_idx" ON "knowledge_search_events"("organization_id", "result_count");

-- AddForeignKey
ALTER TABLE "knowledge_bases" ADD CONSTRAINT "knowledge_bases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_bases" ADD CONSTRAINT "knowledge_bases_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_categories" ADD CONSTRAINT "knowledge_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_categories" ADD CONSTRAINT "knowledge_categories_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_categories" ADD CONSTRAINT "knowledge_categories_parent_category_id_fkey" FOREIGN KEY ("parent_category_id") REFERENCES "knowledge_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "knowledge_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "knowledge_article_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_published_version_id_fkey" FOREIGN KEY ("published_version_id") REFERENCES "knowledge_article_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_article_versions" ADD CONSTRAINT "knowledge_article_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_article_versions" ADD CONSTRAINT "knowledge_article_versions_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "knowledge_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_article_versions" ADD CONSTRAINT "knowledge_article_versions_editor_id_fkey" FOREIGN KEY ("editor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_tags" ADD CONSTRAINT "knowledge_tags_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_tags" ADD CONSTRAINT "knowledge_tags_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_article_tags" ADD CONSTRAINT "knowledge_article_tags_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "knowledge_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_article_tags" ADD CONSTRAINT "knowledge_article_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "knowledge_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_article_tags" ADD CONSTRAINT "knowledge_article_tags_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_article_views" ADD CONSTRAINT "knowledge_article_views_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_article_views" ADD CONSTRAINT "knowledge_article_views_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "knowledge_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_article_views" ADD CONSTRAINT "knowledge_article_views_viewer_id_fkey" FOREIGN KEY ("viewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_article_feedback" ADD CONSTRAINT "knowledge_article_feedback_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_article_feedback" ADD CONSTRAINT "knowledge_article_feedback_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "knowledge_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_article_feedback" ADD CONSTRAINT "knowledge_article_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_article_activities" ADD CONSTRAINT "knowledge_article_activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_article_activities" ADD CONSTRAINT "knowledge_article_activities_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "knowledge_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_article_activities" ADD CONSTRAINT "knowledge_article_activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_search_events" ADD CONSTRAINT "knowledge_search_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_search_events" ADD CONSTRAINT "knowledge_search_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PostgreSQL full-text search for knowledge articles (title A, excerpt B, body C)
ALTER TABLE "knowledge_articles" ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("excerpt", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("body_text", '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS "knowledge_articles_search_vector_idx"
  ON "knowledge_articles" USING GIN ("search_vector");
