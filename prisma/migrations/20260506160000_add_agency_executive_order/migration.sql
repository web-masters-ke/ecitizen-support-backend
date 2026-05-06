-- Add Executive Order metadata to agencies
ALTER TABLE "agencies"
  ADD COLUMN IF NOT EXISTS "executive_order_ref" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "executive_order_year" INTEGER;
