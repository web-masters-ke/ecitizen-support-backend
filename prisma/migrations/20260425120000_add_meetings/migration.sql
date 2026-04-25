-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('ACTIVE', 'ENDED');

-- AlterTable: add meetings relation to tickets (no column needed — FK is on meetings side)

-- CreateTable
CREATE TABLE "meetings" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "room_name" VARCHAR(100) NOT NULL,
    "jitsi_url" VARCHAR(500) NOT NULL,
    "started_by_id" UUID NOT NULL,
    "status" "MeetingStatus" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meetings_room_name_key" ON "meetings"("room_name");
CREATE INDEX "meetings_ticket_id_idx" ON "meetings"("ticket_id");

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_started_by_id_fkey" FOREIGN KEY ("started_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
