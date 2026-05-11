-- Persist uploaded file bytes alongside metadata so downloads survive pod
-- restarts and don't depend on local-disk state. Populated when the backend
-- runs in local-storage mode; remains NULL when files live in S3.

ALTER TABLE "media" ADD COLUMN "file_data" BYTEA;
