-- Add the website + description columns that the admin Edit Service
-- Provider modal already exposes. The frontend was sending them on
-- create / update but the schema had no place to store them, and the
-- Description field rendered blank for every provider.

ALTER TABLE "service_providers" ADD COLUMN "website" VARCHAR(500);
ALTER TABLE "service_providers" ADD COLUMN "description" TEXT;
