-- PR-10 foundation: genericise the observe-only saga evidence boundary for conventional PTC.
-- Existing DA rows are retained. No token, Note, live instruction or external dispatch is added.

CREATE TABLE "PtcReplayAuthorisation" (
  "id" TEXT NOT NULL,
  "transactionCaseId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestDigest" TEXT NOT NULL,
  "authorityEvidenceRef" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROPOSED',
  "proposedByUserId" TEXT NOT NULL,
  "proposedByMandateId" TEXT NOT NULL,
  "proposalStepUpId" TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "reviewedByMandateId" TEXT,
  "reviewStepUpId" TEXT,
  "reviewReason" TEXT,
  "reviewIdempotencyKey" TEXT,
  "reviewRequestDigest" TEXT,
  "effectiveAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PtcReplayAuthorisation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SettlementSaga"
  ADD COLUMN "transactionRoute" TEXT NOT NULL DEFAULT 'DA',
  ADD COLUMN "routeEvidenceBundleDigest" TEXT;

UPDATE "SettlementSaga"
SET "routeEvidenceBundleDigest" = "planDigest"
WHERE "routeEvidenceBundleDigest" IS NULL;

ALTER TABLE "SettlementSaga"
  ALTER COLUMN "routeEvidenceBundleDigest" SET NOT NULL,
  ALTER COLUMN "historicOutcomeEvidenceObjectId" DROP NOT NULL,
  ALTER COLUMN "transfereeCreditDecisionEvidenceObjectId" DROP NOT NULL,
  ALTER COLUMN "executedTransferDocumentEvidenceObjectId" DROP NOT NULL;

CREATE TABLE "SagaEvidenceLink" (
  "id" TEXT NOT NULL,
  "settlementSagaId" TEXT NOT NULL,
  "evidenceObjectId" TEXT NOT NULL,
  "evidenceRole" TEXT NOT NULL,
  "evidenceDigest" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "sequence" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SagaEvidenceLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PtcReplayAuthorisation_transactionCaseId_key" ON "PtcReplayAuthorisation"("transactionCaseId");
CREATE UNIQUE INDEX "PtcReplayAuthorisation_transactionCaseId_idempotencyKey_key" ON "PtcReplayAuthorisation"("transactionCaseId", "idempotencyKey");
CREATE INDEX "PtcReplayAuthorisation_status_createdAt_idx" ON "PtcReplayAuthorisation"("status", "createdAt");
CREATE UNIQUE INDEX "SagaEvidenceLink_settlementSagaId_evidenceRole_key" ON "SagaEvidenceLink"("settlementSagaId", "evidenceRole");
CREATE UNIQUE INDEX "SagaEvidenceLink_settlementSagaId_sequence_key" ON "SagaEvidenceLink"("settlementSagaId", "sequence");
CREATE INDEX "SagaEvidenceLink_evidenceObjectId_idx" ON "SagaEvidenceLink"("evidenceObjectId");

ALTER TABLE "PtcReplayAuthorisation" ADD CONSTRAINT "PtcReplayAuthorisation_transactionCaseId_fkey" FOREIGN KEY ("transactionCaseId") REFERENCES "TransactionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SagaEvidenceLink" ADD CONSTRAINT "SagaEvidenceLink_settlementSagaId_fkey" FOREIGN KEY ("settlementSagaId") REFERENCES "SettlementSaga"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SagaEvidenceLink" ADD CONSTRAINT "SagaEvidenceLink_evidenceObjectId_fkey" FOREIGN KEY ("evidenceObjectId") REFERENCES "EvidenceObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
