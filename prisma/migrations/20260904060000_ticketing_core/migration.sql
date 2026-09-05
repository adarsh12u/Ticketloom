-- Milestone 4: Ticketing / Customer Support Core (non-destructive)

CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESOLVED', 'CLOSED');
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "TicketType" AS ENUM ('QUESTION', 'INCIDENT', 'PROBLEM', 'FEATURE_REQUEST', 'OTHER');
CREATE TYPE "TicketMessageVisibility" AS ENUM ('INTERNAL', 'CUSTOMER');
CREATE TYPE "TicketActivityType" AS ENUM (
  'TICKET_CREATED',
  'STATUS_CHANGED',
  'PRIORITY_CHANGED',
  'TYPE_CHANGED',
  'ASSIGNED',
  'REASSIGNED',
  'UNASSIGNED',
  'TEAM_CHANGED',
  'CUSTOMER_CHANGED',
  'TAG_ADDED',
  'TAG_REMOVED',
  'SUBJECT_CHANGED',
  'INTERNAL_NOTE_ADDED',
  'REPLY_ADDED',
  'ARCHIVED',
  'RESTORED',
  'UPDATED'
);

CREATE TABLE "ticket_counters" (
    "organization_id" TEXT NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ticket_counters_pkey" PRIMARY KEY ("organization_id")
);

CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT,
    "external_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "number_key" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "type" "TicketType" NOT NULL DEFAULT 'QUESTION',
    "customer_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "assignee_id" TEXT,
    "team_id" TEXT,
    "due_at" TIMESTAMP(3),
    "first_response_due_at" TIMESTAMP(3),
    "resolution_due_at" TIMESTAMP(3),
    "first_responded_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ticket_tags" (
    "ticket_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    CONSTRAINT "ticket_tags_pkey" PRIMARY KEY ("ticket_id","tag_id")
);

CREATE TABLE "ticket_messages" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" "TicketMessageVisibility" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ticket_activities" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "type" "TicketActivityType" NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ticket_activities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customers_organization_id_email_key" ON "customers"("organization_id", "email");
CREATE INDEX "customers_organization_id_idx" ON "customers"("organization_id");
CREATE INDEX "customers_organization_id_name_idx" ON "customers"("organization_id", "name");
CREATE INDEX "customers_email_idx" ON "customers"("email");

CREATE UNIQUE INDEX "teams_organization_id_slug_key" ON "teams"("organization_id", "slug");
CREATE INDEX "teams_organization_id_idx" ON "teams"("organization_id");

CREATE UNIQUE INDEX "tags_organization_id_slug_key" ON "tags"("organization_id", "slug");
CREATE INDEX "tags_organization_id_idx" ON "tags"("organization_id");

CREATE UNIQUE INDEX "tickets_organization_id_number_key" ON "tickets"("organization_id", "number");
CREATE UNIQUE INDEX "tickets_organization_id_number_key_key" ON "tickets"("organization_id", "number_key");
CREATE INDEX "tickets_organization_id_idx" ON "tickets"("organization_id");
CREATE INDEX "tickets_organization_id_status_idx" ON "tickets"("organization_id", "status");
CREATE INDEX "tickets_organization_id_priority_idx" ON "tickets"("organization_id", "priority");
CREATE INDEX "tickets_organization_id_assignee_id_idx" ON "tickets"("organization_id", "assignee_id");
CREATE INDEX "tickets_organization_id_customer_id_idx" ON "tickets"("organization_id", "customer_id");
CREATE INDEX "tickets_organization_id_team_id_idx" ON "tickets"("organization_id", "team_id");
CREATE INDEX "tickets_organization_id_created_at_idx" ON "tickets"("organization_id", "created_at");
CREATE INDEX "tickets_organization_id_updated_at_idx" ON "tickets"("organization_id", "updated_at");
CREATE INDEX "tickets_organization_id_archived_at_idx" ON "tickets"("organization_id", "archived_at");
CREATE INDEX "tickets_number_key_idx" ON "tickets"("number_key");
CREATE INDEX "tickets_status_idx" ON "tickets"("status");
CREATE INDEX "tickets_priority_idx" ON "tickets"("priority");
CREATE INDEX "tickets_assignee_id_idx" ON "tickets"("assignee_id");
CREATE INDEX "tickets_customer_id_idx" ON "tickets"("customer_id");

CREATE INDEX "ticket_tags_tag_id_idx" ON "ticket_tags"("tag_id");

CREATE INDEX "ticket_messages_ticket_id_created_at_idx" ON "ticket_messages"("ticket_id", "created_at");
CREATE INDEX "ticket_messages_organization_id_idx" ON "ticket_messages"("organization_id");
CREATE INDEX "ticket_messages_organization_id_visibility_idx" ON "ticket_messages"("organization_id", "visibility");

CREATE INDEX "ticket_activities_ticket_id_created_at_idx" ON "ticket_activities"("ticket_id", "created_at");
CREATE INDEX "ticket_activities_organization_id_idx" ON "ticket_activities"("organization_id");
CREATE INDEX "ticket_activities_organization_id_type_idx" ON "ticket_activities"("organization_id", "type");

ALTER TABLE "ticket_counters" ADD CONSTRAINT "ticket_counters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tags" ADD CONSTRAINT "tags_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tickets" ADD CONSTRAINT "tickets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ticket_tags" ADD CONSTRAINT "ticket_tags_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_tags" ADD CONSTRAINT "ticket_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ticket_activities" ADD CONSTRAINT "ticket_activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_activities" ADD CONSTRAINT "ticket_activities_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_activities" ADD CONSTRAINT "ticket_activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
