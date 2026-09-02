-- AR-27: append-only secondary-transfer repair proposals.
-- A repair can append a newly verified evidence version after independent review. It cannot execute
-- cash/title/register actions or overwrite the original evidence and reconciliation break.

CREATE TABLE "SecondaryTransferRepair" (
  "id" TEXT NOT NULL,
  "secondaryTransferBreakId" TEXT NOT NULL,
  "replacementEvidenceType" TEXT NOT NULL,
  "providerInstitutionId" TEXT NOT NULL,
  "evidenceObjectId" TEXT NOT NULL,
  "assertionDigest" TEXT NOT NULL,
  "authorityEvidenceRef" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestDigest" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROPOSED',
  "proposedByUserId" TEXT NOT NULL,
  "proposedByMandateId" TEXT NOT NULL,
  "proposalStepUpId" TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "reviewedByMandateId" TEXT,
  "reviewStepUpId" TEXT,
  "reviewReason" TEXT,
  "appliedEvidenceRecordId" TEXT,
  "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecondaryTransferRepair_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SecondaryTransferRepair_appliedEvidenceRecordId_key" ON "SecondaryTransferRepair"("appliedEvidenceRecordId");
CREATE UNIQUE INDEX "SecondaryTransferRepair_break_idem_key" ON "SecondaryTransferRepair"("secondaryTransferBreakId", "idempotencyKey");
CREATE INDEX "SecondaryTransferRepair_break_status_created_idx" ON "SecondaryTransferRepair"("secondaryTransferBreakId", "status", "createdAt");
CREATE INDEX "SecondaryTransferRepair_evidenceObjectId_idx" ON "SecondaryTransferRepair"("evidenceObjectId");

ALTER TABLE "SecondaryTransferRepair" ADD CONSTRAINT "SecondaryTransferRepair_secondaryTransferBreakId_fkey" FOREIGN KEY ("secondaryTransferBreakId") REFERENCES "SecondaryTransferBreak"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecondaryTransferRepair" ADD CONSTRAINT "SecondaryTransferRepair_providerInstitutionId_fkey" FOREIGN KEY ("providerInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecondaryTransferRepair" ADD CONSTRAINT "SecondaryTransferRepair_evidenceObjectId_fkey" FOREIGN KEY ("evidenceObjectId") REFERENCES "EvidenceObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
