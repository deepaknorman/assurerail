-- PR-11 is additive and observe-only. The legal record remains the declared external authority;
-- the tokenised representation is a MIRROR projection until a later controlled-live gate.
CREATE TABLE "TokenRepresentation" (
    "id" TEXT NOT NULL,
    "transactionCaseId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "authoritativeRecordDeclarationId" TEXT NOT NULL,
    "representationType" TEXT NOT NULL DEFAULT 'TOKENISED',
    "authorityMode" TEXT NOT NULL DEFAULT 'MIRROR',
    "network" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "unitsScale" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'LINKED',
    "linkageIdempotencyKey" TEXT NOT NULL,
    "linkageRequestDigest" TEXT NOT NULL,
    "linkedByUserId" TEXT NOT NULL,
    "linkedByMandateId" TEXT NOT NULL,
    "linkageStepUpId" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TokenRepresentation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TokenAction" (
    "id" TEXT NOT NULL,
    "tokenRepresentationId" TEXT NOT NULL,
    "externalInstructionId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "executionMode" TEXT NOT NULL DEFAULT 'OBSERVE_ONLY',
    "state" TEXT NOT NULL DEFAULT 'PREPARED',
    "expected" JSONB NOT NULL,
    "expectedDigest" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestDigest" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdByMandateId" TEXT NOT NULL,
    "stepUpEvidenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TokenAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TokenReconciliationSnapshot" (
    "id" TEXT NOT NULL,
    "tokenRepresentationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestDigest" TEXT NOT NULL,
    "tokenSupplyMinor" TEXT NOT NULL,
    "tokenHoldings" JSONB NOT NULL,
    "tokenHoldingsDigest" TEXT NOT NULL,
    "economicInterests" JSONB NOT NULL,
    "economicInterestDigest" TEXT NOT NULL,
    "authoritativeRecord" JSONB NOT NULL,
    "authoritativeRecordDigest" TEXT NOT NULL,
    "evidenceObjectId" TEXT NOT NULL,
    "sourceAsOfAt" TIMESTAMP(3) NOT NULL,
    "comparison" JSONB NOT NULL,
    "comparisonDigest" TEXT NOT NULL,
    "reconciliationState" TEXT NOT NULL,
    "recordedByUserId" TEXT NOT NULL,
    "recordedByMandateId" TEXT NOT NULL,
    "stepUpEvidenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TokenReconciliationSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TokenReconciliationBreak" (
    "id" TEXT NOT NULL,
    "tokenRepresentationId" TEXT NOT NULL,
    "reconciliationSnapshotId" TEXT NOT NULL,
    "breakCode" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "expected" JSONB NOT NULL,
    "observed" JSONB NOT NULL,
    "expectedDigest" TEXT NOT NULL,
    "observedDigest" TEXT NOT NULL,
    "blockedCapabilities" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "ownerInstitutionId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "openedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TokenReconciliationBreak_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TokenRepresentation_transactionCaseId_key" ON "TokenRepresentation"("transactionCaseId");
CREATE UNIQUE INDEX "TokenRepresentation_noteId_key" ON "TokenRepresentation"("noteId");
CREATE UNIQUE INDEX "TokenRepresentation_case_linkage_key" ON "TokenRepresentation"("transactionCaseId", "linkageIdempotencyKey");
CREATE INDEX "TokenRepresentation_authority_status_idx" ON "TokenRepresentation"("authoritativeRecordDeclarationId", "status");
CREATE INDEX "TokenRepresentation_tokenId_idx" ON "TokenRepresentation"("tokenId");

CREATE UNIQUE INDEX "TokenAction_externalInstructionId_key" ON "TokenAction"("externalInstructionId");
CREATE UNIQUE INDEX "TokenAction_representation_idempotency_key" ON "TokenAction"("tokenRepresentationId", "idempotencyKey");
CREATE UNIQUE INDEX "TokenAction_representation_sequence_key" ON "TokenAction"("tokenRepresentationId", "sequence");
CREATE INDEX "TokenAction_representation_state_sequence_idx" ON "TokenAction"("tokenRepresentationId", "state", "sequence");

CREATE UNIQUE INDEX "TokenReconciliationSnapshot_representation_version_key" ON "TokenReconciliationSnapshot"("tokenRepresentationId", "version");
CREATE UNIQUE INDEX "TokenReconciliationSnapshot_representation_idempotency_key" ON "TokenReconciliationSnapshot"("tokenRepresentationId", "idempotencyKey");
CREATE INDEX "TokenReconciliationSnapshot_state_created_idx" ON "TokenReconciliationSnapshot"("tokenRepresentationId", "reconciliationState", "createdAt");
CREATE INDEX "TokenReconciliationSnapshot_evidenceObjectId_idx" ON "TokenReconciliationSnapshot"("evidenceObjectId");

CREATE UNIQUE INDEX "TokenReconciliationBreak_snapshot_code_key" ON "TokenReconciliationBreak"("reconciliationSnapshotId", "breakCode");
CREATE INDEX "TokenReconciliationBreak_representation_status_idx" ON "TokenReconciliationBreak"("tokenRepresentationId", "status", "severity");
CREATE INDEX "TokenReconciliationBreak_owner_status_due_idx" ON "TokenReconciliationBreak"("ownerInstitutionId", "status", "dueAt");

ALTER TABLE "TokenRepresentation" ADD CONSTRAINT "TokenRepresentation_transactionCaseId_fkey" FOREIGN KEY ("transactionCaseId") REFERENCES "TransactionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TokenRepresentation" ADD CONSTRAINT "TokenRepresentation_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TokenRepresentation" ADD CONSTRAINT "TokenRepresentation_authoritativeRecordDeclarationId_fkey" FOREIGN KEY ("authoritativeRecordDeclarationId") REFERENCES "AuthoritativeRecordDeclaration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TokenAction" ADD CONSTRAINT "TokenAction_tokenRepresentationId_fkey" FOREIGN KEY ("tokenRepresentationId") REFERENCES "TokenRepresentation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TokenAction" ADD CONSTRAINT "TokenAction_externalInstructionId_fkey" FOREIGN KEY ("externalInstructionId") REFERENCES "ExternalInstruction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TokenReconciliationSnapshot" ADD CONSTRAINT "TokenReconciliationSnapshot_tokenRepresentationId_fkey" FOREIGN KEY ("tokenRepresentationId") REFERENCES "TokenRepresentation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TokenReconciliationSnapshot" ADD CONSTRAINT "TokenReconciliationSnapshot_evidenceObjectId_fkey" FOREIGN KEY ("evidenceObjectId") REFERENCES "EvidenceObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TokenReconciliationBreak" ADD CONSTRAINT "TokenReconciliationBreak_tokenRepresentationId_fkey" FOREIGN KEY ("tokenRepresentationId") REFERENCES "TokenRepresentation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TokenReconciliationBreak" ADD CONSTRAINT "TokenReconciliationBreak_reconciliationSnapshotId_fkey" FOREIGN KEY ("reconciliationSnapshotId") REFERENCES "TokenReconciliationSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TokenReconciliationBreak" ADD CONSTRAINT "TokenReconciliationBreak_ownerInstitutionId_fkey" FOREIGN KEY ("ownerInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
