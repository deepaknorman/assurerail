-- PR-14: additive conventional secondary DA/PTC observation-only dossiers.
-- No table below dispatches cash, transfers title, updates an external register or makes a Rail
-- projection authoritative. Historic evidence remains restrictive and append-only.

CREATE TABLE "SecondaryTransfer" (
  "id" TEXT NOT NULL, "transactionCaseId" TEXT NOT NULL, "transactionRoute" TEXT NOT NULL,
  "routePackRef" TEXT NOT NULL, "routePackVersion" TEXT NOT NULL,
  "executionMode" TEXT NOT NULL DEFAULT 'OBSERVE_ONLY', "transferReference" TEXT NOT NULL,
  "instrumentReference" TEXT NOT NULL, "instrumentDigest" TEXT NOT NULL,
  "sellerInstitutionId" TEXT NOT NULL, "buyerInstitutionId" TEXT NOT NULL,
  "trusteeInstitutionId" TEXT, "recordkeeperInstitutionId" TEXT NOT NULL,
  "quantityUnits" TEXT NOT NULL, "quantityScale" INTEGER NOT NULL,
  "considerationCurrency" TEXT NOT NULL, "considerationMinorUnits" TEXT NOT NULL,
  "considerationScale" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'COLLECTING',
  "aggregateVersion" INTEGER NOT NULL DEFAULT 1, "creationIdempotencyKey" TEXT NOT NULL,
  "creationRequestDigest" TEXT NOT NULL, "proposedByUserId" TEXT, "proposedByMandateId" TEXT,
  "proposalStepUpId" TEXT, "proposalDigest" TEXT, "proposedAt" TIMESTAMP(3),
  "reviewedByUserId" TEXT, "reviewedByMandateId" TEXT, "reviewStepUpId" TEXT,
  "reviewReason" TEXT, "reviewedAt" TIMESTAMP(3), "reconciledAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL, "createdByMandateId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecondaryTransfer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecondaryTransferEvidence" (
  "id" TEXT NOT NULL, "secondaryTransferId" TEXT NOT NULL, "evidenceType" TEXT NOT NULL,
  "version" INTEGER NOT NULL, "providerInstitutionId" TEXT NOT NULL, "evidenceObjectId" TEXT NOT NULL,
  "evidenceResult" TEXT NOT NULL, "assertionDigest" TEXT NOT NULL, "sourceAsOfAt" TIMESTAMP(3) NOT NULL,
  "idempotencyKey" TEXT NOT NULL, "requestDigest" TEXT NOT NULL, "recordedByUserId" TEXT NOT NULL,
  "recordedByMandateId" TEXT NOT NULL, "stepUpEvidenceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecondaryTransferEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecondaryTransferLeg" (
  "id" TEXT NOT NULL, "secondaryTransferId" TEXT NOT NULL, "legKey" TEXT NOT NULL,
  "legType" TEXT NOT NULL, "sequence" INTEGER NOT NULL, "performerInstitutionId" TEXT NOT NULL,
  "performerClass" TEXT NOT NULL, "expectedEvidenceType" TEXT NOT NULL,
  "expectedAssertionDigest" TEXT NOT NULL, "evidenceRecordId" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'PLANNED', "comparisonDigest" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecondaryTransferLeg_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecondaryTransferBreak" (
  "id" TEXT NOT NULL, "secondaryTransferId" TEXT NOT NULL, "breakCode" TEXT NOT NULL,
  "severity" TEXT NOT NULL, "expectedDigest" TEXT NOT NULL, "observedDigest" TEXT NOT NULL,
  "blockedCapabilities" JSONB NOT NULL, "ownerInstitutionId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN', "detail" JSONB NOT NULL, "openedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecondaryTransferBreak_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SecondaryTransfer_transactionCaseId_key" ON "SecondaryTransfer"("transactionCaseId");
CREATE UNIQUE INDEX "SecondaryTransfer_seller_creation_idem_key" ON "SecondaryTransfer"("sellerInstitutionId", "creationIdempotencyKey");
CREATE UNIQUE INDEX "SecondaryTransfer_transactionCaseId_transferReference_key" ON "SecondaryTransfer"("transactionCaseId", "transferReference");
CREATE INDEX "SecondaryTransfer_sellerInstitutionId_status_createdAt_idx" ON "SecondaryTransfer"("sellerInstitutionId", "status", "createdAt");
CREATE INDEX "SecondaryTransfer_buyerInstitutionId_status_createdAt_idx" ON "SecondaryTransfer"("buyerInstitutionId", "status", "createdAt");
CREATE INDEX "SecondaryTransfer_transactionRoute_status_updatedAt_idx" ON "SecondaryTransfer"("transactionRoute", "status", "updatedAt");
CREATE UNIQUE INDEX "SecondaryTransferEvidence_transfer_type_version_key" ON "SecondaryTransferEvidence"("secondaryTransferId", "evidenceType", "version");
CREATE UNIQUE INDEX "SecondaryTransferEvidence_transfer_type_assertion_key" ON "SecondaryTransferEvidence"("secondaryTransferId", "evidenceType", "assertionDigest");
CREATE UNIQUE INDEX "SecondaryTransferEvidence_transfer_idem_key" ON "SecondaryTransferEvidence"("secondaryTransferId", "idempotencyKey");
CREATE INDEX "SecondaryTransferEvidence_transfer_type_created_idx" ON "SecondaryTransferEvidence"("secondaryTransferId", "evidenceType", "createdAt");
CREATE INDEX "SecondaryTransferEvidence_evidenceObjectId_idx" ON "SecondaryTransferEvidence"("evidenceObjectId");
CREATE UNIQUE INDEX "SecondaryTransferLeg_secondaryTransferId_legKey_key" ON "SecondaryTransferLeg"("secondaryTransferId", "legKey");
CREATE UNIQUE INDEX "SecondaryTransferLeg_secondaryTransferId_sequence_key" ON "SecondaryTransferLeg"("secondaryTransferId", "sequence");
CREATE UNIQUE INDEX "SecondaryTransferLeg_transfer_evidence_key" ON "SecondaryTransferLeg"("secondaryTransferId", "evidenceRecordId");
CREATE INDEX "SecondaryTransferLeg_transfer_state_sequence_idx" ON "SecondaryTransferLeg"("secondaryTransferId", "state", "sequence");
CREATE UNIQUE INDEX "SecondaryTransferBreak_transfer_code_key" ON "SecondaryTransferBreak"("secondaryTransferId", "breakCode");
CREATE INDEX "SecondaryTransferBreak_transfer_status_severity_idx" ON "SecondaryTransferBreak"("secondaryTransferId", "status", "severity");
CREATE INDEX "SecondaryTransferBreak_ownerInstitutionId_status_createdAt_idx" ON "SecondaryTransferBreak"("ownerInstitutionId", "status", "createdAt");

ALTER TABLE "SecondaryTransfer" ADD CONSTRAINT "SecondaryTransfer_transactionCaseId_fkey" FOREIGN KEY ("transactionCaseId") REFERENCES "TransactionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecondaryTransfer" ADD CONSTRAINT "SecondaryTransfer_sellerInstitutionId_fkey" FOREIGN KEY ("sellerInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecondaryTransfer" ADD CONSTRAINT "SecondaryTransfer_buyerInstitutionId_fkey" FOREIGN KEY ("buyerInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecondaryTransfer" ADD CONSTRAINT "SecondaryTransfer_trusteeInstitutionId_fkey" FOREIGN KEY ("trusteeInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecondaryTransfer" ADD CONSTRAINT "SecondaryTransfer_recordkeeperInstitutionId_fkey" FOREIGN KEY ("recordkeeperInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecondaryTransferEvidence" ADD CONSTRAINT "SecondaryTransferEvidence_secondaryTransferId_fkey" FOREIGN KEY ("secondaryTransferId") REFERENCES "SecondaryTransfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecondaryTransferEvidence" ADD CONSTRAINT "SecondaryTransferEvidence_providerInstitutionId_fkey" FOREIGN KEY ("providerInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecondaryTransferEvidence" ADD CONSTRAINT "SecondaryTransferEvidence_evidenceObjectId_fkey" FOREIGN KEY ("evidenceObjectId") REFERENCES "EvidenceObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecondaryTransferLeg" ADD CONSTRAINT "SecondaryTransferLeg_secondaryTransferId_fkey" FOREIGN KEY ("secondaryTransferId") REFERENCES "SecondaryTransfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecondaryTransferBreak" ADD CONSTRAINT "SecondaryTransferBreak_secondaryTransferId_fkey" FOREIGN KEY ("secondaryTransferId") REFERENCES "SecondaryTransfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecondaryTransferBreak" ADD CONSTRAINT "SecondaryTransferBreak_ownerInstitutionId_fkey" FOREIGN KEY ("ownerInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
