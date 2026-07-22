-- AlterTable
ALTER TABLE "BillingEvent" ADD COLUMN     "sourceEventId" TEXT;

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "actor" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "detail" JSONB NOT NULL,
    "noteId" TEXT,
    "governed" BOOLEAN NOT NULL DEFAULT false,
    "prevHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "anchorRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_seq_key" ON "AuditLog"("seq");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_hash_key" ON "AuditLog"("hash");

-- CreateIndex
CREATE INDEX "AuditLog_event_idx" ON "AuditLog"("event");

-- CreateIndex
CREATE INDEX "AuditLog_noteId_idx" ON "AuditLog"("noteId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingEvent_sourceEventId_key" ON "BillingEvent"("sourceEventId");

-- CreateIndex
CREATE UNIQUE INDEX "Dvp_settlementRef_key" ON "Dvp"("settlementRef");

