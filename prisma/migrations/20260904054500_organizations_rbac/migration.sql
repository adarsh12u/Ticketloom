-- Milestone 3: Organizations & RBAC (non-destructive)

ALTER TYPE "MembershipRole" ADD VALUE IF NOT EXISTS 'VIEWER';

CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'DEACTIVATED');

CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

ALTER TABLE "users" ADD COLUMN "active_organization_id" TEXT;

ALTER TABLE "memberships" ADD COLUMN "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE TABLE "organization_invitations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'AGENT',
    "token_hash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "invited_by_id" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_invitations_token_hash_key" ON "organization_invitations"("token_hash");
CREATE INDEX "organization_invitations_organization_id_idx" ON "organization_invitations"("organization_id");
CREATE INDEX "organization_invitations_email_idx" ON "organization_invitations"("email");
CREATE INDEX "organization_invitations_organization_id_email_status_idx" ON "organization_invitations"("organization_id", "email", "status");
CREATE INDEX "organization_invitations_expires_at_idx" ON "organization_invitations"("expires_at");
CREATE INDEX "memberships_organization_id_status_idx" ON "memberships"("organization_id", "status");
CREATE INDEX "users_active_organization_id_idx" ON "users"("active_organization_id");

UPDATE "users" AS u
SET "active_organization_id" = m."organization_id"
FROM (
  SELECT DISTINCT ON ("user_id") "user_id", "organization_id"
  FROM "memberships"
  ORDER BY "user_id", "created_at" ASC
) AS m
WHERE u."id" = m."user_id"
  AND u."active_organization_id" IS NULL;

ALTER TABLE "users"
  ADD CONSTRAINT "users_active_organization_id_fkey"
  FOREIGN KEY ("active_organization_id") REFERENCES "organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "organization_invitations"
  ADD CONSTRAINT "organization_invitations_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_invitations"
  ADD CONSTRAINT "organization_invitations_invited_by_id_fkey"
  FOREIGN KEY ("invited_by_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
