-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'PENDING', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ConversationParticipantRole" AS ENUM ('AGENT', 'VIEWER');

-- CreateEnum
CREATE TYPE "ChatMessageType" AS ENUM ('TEXT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ConversationActivityType" AS ENUM ('CONVERSATION_CREATED', 'MESSAGE_SENT', 'ASSIGNED', 'UNASSIGNED', 'STATUS_CHANGED', 'PARTICIPANT_ADDED', 'LINKED_TICKET', 'RESOLVED', 'CLOSED', 'REOPENED');

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "ticket_id" TEXT,
    "subject" TEXT,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "assigned_agent_id" TEXT,
    "last_message_at" TIMESTAMP(3),
    "last_message_preview" VARCHAR(280),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "ConversationParticipantRole" NOT NULL DEFAULT 'AGENT',
    "last_read_at" TIMESTAMP(3),
    "last_read_message_id" TEXT,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender_user_id" TEXT,
    "client_message_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "ChatMessageType" NOT NULL DEFAULT 'TEXT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_read_states" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_read_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_activities" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "type" "ConversationActivityType" NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversations_organization_id_idx" ON "conversations"("organization_id");

-- CreateIndex
CREATE INDEX "conversations_organization_id_status_idx" ON "conversations"("organization_id", "status");

-- CreateIndex
CREATE INDEX "conversations_organization_id_customer_id_idx" ON "conversations"("organization_id", "customer_id");

-- CreateIndex
CREATE INDEX "conversations_organization_id_assigned_agent_id_idx" ON "conversations"("organization_id", "assigned_agent_id");

-- CreateIndex
CREATE INDEX "conversations_organization_id_last_message_at_idx" ON "conversations"("organization_id", "last_message_at");

-- CreateIndex
CREATE INDEX "conversations_organization_id_created_at_idx" ON "conversations"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "conversations_ticket_id_idx" ON "conversations"("ticket_id");

-- CreateIndex
CREATE INDEX "conversations_customer_id_idx" ON "conversations"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_organization_id_ticket_id_key" ON "conversations"("organization_id", "ticket_id");

-- CreateIndex
CREATE INDEX "conversation_participants_organization_id_idx" ON "conversation_participants"("organization_id");

-- CreateIndex
CREATE INDEX "conversation_participants_user_id_idx" ON "conversation_participants"("user_id");

-- CreateIndex
CREATE INDEX "conversation_participants_conversation_id_idx" ON "conversation_participants"("conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_participants_conversation_id_user_id_key" ON "conversation_participants"("conversation_id", "user_id");

-- CreateIndex
CREATE INDEX "chat_messages_organization_id_idx" ON "chat_messages"("organization_id");

-- CreateIndex
CREATE INDEX "chat_messages_conversation_id_created_at_idx" ON "chat_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_messages_organization_id_conversation_id_created_at_idx" ON "chat_messages"("organization_id", "conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_messages_sender_user_id_idx" ON "chat_messages"("sender_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_conversation_id_client_message_id_key" ON "chat_messages"("conversation_id", "client_message_id");

-- CreateIndex
CREATE INDEX "message_read_states_user_id_read_at_idx" ON "message_read_states"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "message_read_states_organization_id_idx" ON "message_read_states"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_read_states_message_id_user_id_key" ON "message_read_states"("message_id", "user_id");

-- CreateIndex
CREATE INDEX "conversation_activities_conversation_id_created_at_idx" ON "conversation_activities"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "conversation_activities_organization_id_idx" ON "conversation_activities"("organization_id");

-- CreateIndex
CREATE INDEX "conversation_activities_organization_id_type_idx" ON "conversation_activities"("organization_id", "type");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_agent_id_fkey" FOREIGN KEY ("assigned_agent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_read_states" ADD CONSTRAINT "message_read_states_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_read_states" ADD CONSTRAINT "message_read_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_activities" ADD CONSTRAINT "conversation_activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_activities" ADD CONSTRAINT "conversation_activities_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_activities" ADD CONSTRAINT "conversation_activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
