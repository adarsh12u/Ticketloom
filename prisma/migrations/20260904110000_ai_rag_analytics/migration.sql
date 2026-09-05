-- AI Assistance (M10), RAG (M11), Analytics event stores (M12)
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "AiFeature" AS ENUM (
  'TICKET_SUMMARY',
  'CONVERSATION_SUMMARY',
  'REPLY_SUGGESTION',
  'TONE_TRANSFORM',
  'KNOWLEDGE_SEARCH',
  'RAG_ANSWER'
);

-- CreateEnum
CREATE TYPE "AiUsageStatus" AS ENUM ('SUCCESS', 'FAILURE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "AiSuggestionEventType" AS ENUM (
  'GENERATED',
  'INSERTED',
  'EDITED',
  'SENT',
  'FEEDBACK_HELPFUL',
  'FEEDBACK_NOT_HELPFUL'
);

-- CreateTable
CREATE TABLE "ai_usage_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT,
    "feature" "AiFeature" NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "status" "AiUsageStatus" NOT NULL,
    "latency_ms" INTEGER,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "retrieved_sources_count" INTEGER,
    "error_code" TEXT,
    "suggestion_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_suggestion_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "suggestion_id" TEXT NOT NULL,
    "feature" "AiFeature" NOT NULL,
    "event_type" "AiSuggestionEventType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_suggestion_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "knowledge_base_id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "article_version_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "section" TEXT,
    "category" TEXT,
    "content_hash" TEXT NOT NULL,
    "embedding" vector(768),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rag_retrieval_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT,
    "query_hash" TEXT NOT NULL,
    "query_preview" TEXT NOT NULL,
    "retrieved_article_ids" TEXT[],
    "retrieval_scores" JSONB,
    "selected_chunk_count" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "latency_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rag_retrieval_events_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ai_usage_events"
  ADD CONSTRAINT "ai_usage_events_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_usage_events"
  ADD CONSTRAINT "ai_usage_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_suggestion_events"
  ADD CONSTRAINT "ai_suggestion_events_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_suggestion_events"
  ADD CONSTRAINT "ai_suggestion_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_chunks"
  ADD CONSTRAINT "knowledge_chunks_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rag_retrieval_events"
  ADD CONSTRAINT "rag_retrieval_events_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rag_retrieval_events"
  ADD CONSTRAINT "rag_retrieval_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "ai_usage_events_organization_id_created_at_idx"
  ON "ai_usage_events"("organization_id", "created_at");

CREATE INDEX "ai_usage_events_organization_id_feature_idx"
  ON "ai_usage_events"("organization_id", "feature");

CREATE INDEX "ai_usage_events_suggestion_id_idx"
  ON "ai_usage_events"("suggestion_id");

CREATE INDEX "ai_suggestion_events_organization_id_created_at_idx"
  ON "ai_suggestion_events"("organization_id", "created_at");

CREATE INDEX "ai_suggestion_events_organization_id_event_type_idx"
  ON "ai_suggestion_events"("organization_id", "event_type");

CREATE INDEX "ai_suggestion_events_suggestion_id_idx"
  ON "ai_suggestion_events"("suggestion_id");

CREATE UNIQUE INDEX "knowledge_chunks_article_version_id_chunk_index_key"
  ON "knowledge_chunks"("article_version_id", "chunk_index");

CREATE INDEX "knowledge_chunks_organization_id_article_id_idx"
  ON "knowledge_chunks"("organization_id", "article_id");

CREATE INDEX "knowledge_chunks_organization_id_knowledge_base_id_idx"
  ON "knowledge_chunks"("organization_id", "knowledge_base_id");

CREATE INDEX "rag_retrieval_events_organization_id_created_at_idx"
  ON "rag_retrieval_events"("organization_id", "created_at");

-- HNSW index for cosine similarity on embeddings (pgvector)
CREATE INDEX knowledge_chunks_embedding_hnsw_idx
  ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;
