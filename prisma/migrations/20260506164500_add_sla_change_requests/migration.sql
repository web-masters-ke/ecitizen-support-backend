-- Soft-archive on sla_policies
ALTER TABLE "sla_policies"
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "archived_by" UUID;

-- Approval workflow enums
DO $$ BEGIN
  CREATE TYPE "SlaChangeAction" AS ENUM ('CREATE', 'UPDATE', 'ARCHIVE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SlaChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Approval workflow rows
CREATE TABLE IF NOT EXISTS "sla_change_requests" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "agency_id"        UUID NOT NULL,
  "target_policy_id" UUID,
  "action"           "SlaChangeAction" NOT NULL,
  "payload"          JSONB NOT NULL,
  "status"           "SlaChangeStatus" NOT NULL DEFAULT 'PENDING',
  "requested_by"     UUID NOT NULL,
  "request_reason"   TEXT,
  "reviewed_by"      UUID,
  "reviewed_at"      TIMESTAMP,
  "reviewer_comment" TEXT,
  "created_at"       TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "sla_change_requests_status_created_at_idx"
  ON "sla_change_requests" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "sla_change_requests_agency_id_status_idx"
  ON "sla_change_requests" ("agency_id", "status");
