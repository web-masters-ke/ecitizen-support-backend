-- Track when an "almost overdue" warning was sent so we don't spam agents
ALTER TABLE "sla_tracking"
  ADD COLUMN IF NOT EXISTS "response_warning_at" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "resolution_warning_at" TIMESTAMP;
