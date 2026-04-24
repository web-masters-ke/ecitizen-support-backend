-- AlterTable
ALTER TABLE "agencies" ADD COLUMN     "sla_document_name" VARCHAR(500),
ADD COLUMN     "sla_document_url" TEXT,
ADD COLUMN     "sla_signed_at" TIMESTAMP(3);
