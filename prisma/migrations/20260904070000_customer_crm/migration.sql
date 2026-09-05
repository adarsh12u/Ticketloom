-- Milestone 5: Customer CRM (non-destructive; preserves M2–M4 data)

CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PROSPECT', 'ARCHIVED');
CREATE TYPE "CustomerActivityType" AS ENUM (
  'CUSTOMER_CREATED',
  'CUSTOMER_UPDATED',
  'CUSTOMER_ARCHIVED',
  'CUSTOMER_RESTORED',
  'NOTE_ADDED',
  'TAG_ADDED',
  'TAG_REMOVED',
  'TICKET_CREATED',
  'TICKET_RESOLVED',
  'TICKET_CLOSED',
  'STATUS_CHANGED'
);

ALTER TABLE "customers" ADD COLUMN "first_name" TEXT;
ALTER TABLE "customers" ADD COLUMN "last_name" TEXT;
ALTER TABLE "customers" ADD COLUMN "job_title" TEXT;
ALTER TABLE "customers" ADD COLUMN "image" TEXT;
ALTER TABLE "customers" ADD COLUMN "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "customers" ADD COLUMN "source" TEXT;
ALTER TABLE "customers" ADD COLUMN "profile_notes" TEXT;
ALTER TABLE "customers" ADD COLUMN "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "customers" ADD COLUMN "archived_at" TIMESTAMP(3);

UPDATE "customers"
SET "last_activity_at" = COALESCE("updated_at", "created_at", CURRENT_TIMESTAMP)
WHERE "last_activity_at" IS NOT NULL;

CREATE TABLE "customer_tags" (
    "customer_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    CONSTRAINT "customer_tags_pkey" PRIMARY KEY ("customer_id","tag_id")
);

CREATE TABLE "customer_notes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customer_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_activities" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "type" "CustomerActivityType" NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customers_organization_id_status_idx" ON "customers"("organization_id", "status");
CREATE INDEX "customers_organization_id_company_idx" ON "customers"("organization_id", "company");
CREATE INDEX "customers_organization_id_last_activity_at_idx" ON "customers"("organization_id", "last_activity_at");
CREATE INDEX "customers_organization_id_created_at_idx" ON "customers"("organization_id", "created_at");
CREATE INDEX "customers_organization_id_archived_at_idx" ON "customers"("organization_id", "archived_at");
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

CREATE INDEX "customer_tags_tag_id_idx" ON "customer_tags"("tag_id");
CREATE INDEX "customer_notes_customer_id_created_at_idx" ON "customer_notes"("customer_id", "created_at");
CREATE INDEX "customer_notes_organization_id_idx" ON "customer_notes"("organization_id");
CREATE INDEX "customer_activities_customer_id_created_at_idx" ON "customer_activities"("customer_id", "created_at");
CREATE INDEX "customer_activities_organization_id_idx" ON "customer_activities"("organization_id");
CREATE INDEX "customer_activities_organization_id_type_idx" ON "customer_activities"("organization_id", "type");

ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_activities" ADD CONSTRAINT "customer_activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_activities" ADD CONSTRAINT "customer_activities_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_activities" ADD CONSTRAINT "customer_activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
