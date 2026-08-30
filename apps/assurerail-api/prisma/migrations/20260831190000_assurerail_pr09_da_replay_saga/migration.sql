-- PR-09: additive, observe-only conventional DA replay and durable external-action saga.
-- No legacy Note/DvP table is renamed or rewritten, and no live external dispatch is enabled.

CREATE TABLE "DaReplayAuthorisation" (
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
  CONSTRAINT "DaReplayAuthorisation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SettlementSaga" (
  "id" TEXT NOT NULL,
  "transactionCaseId" TEXT NOT NULL,
  "sagaVersion" INTEGER NOT NULL DEFAULT 1,
  "routePackRef" TEXT NOT NULL,
  "routePackVersion" TEXT NOT NULL,
  "executionMode" TEXT NOT NULL DEFAULT 'OBSERVE_ONLY',
  "state" TEXT NOT NULL DEFAULT 'READY',
  "idempotencyKey" TEXT NOT NULL,
  "requestDigest" TEXT NOT NULL,
  "planDigest" TEXT NOT NULL,
  "legalMechanism" TEXT NOT NULL,
  "considerationCurrency" TEXT NOT NULL,
  "considerationMinorUnits" TEXT NOT NULL,
  "considerationScale" INTEGER NOT NULL,
  "historicOutcomeRef" TEXT NOT NULL,
  "historicOutcomeDigest" TEXT NOT NULL,
  "historicOutcomeEvidenceObjectId" TEXT NOT NULL,
  "transfereeCreditDecisionEvidenceObjectId" TEXT NOT NULL,
  "executedTransferDocumentEvidenceObjectId" TEXT NOT NULL,
  "expectedOutcome" JSONB NOT NULL,
  "expectedOutcomeDigest" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdByMandateId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reconciledAt" TIMESTAMP(3),
  CONSTRAINT "SettlementSaga_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SettlementLeg" (
  "id" TEXT NOT NULL,
  "settlementSagaId" TEXT NOT NULL,
  "legKey" TEXT NOT NULL,
  "legType" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "participantOwnerInstitutionId" TEXT NOT NULL,
  "performerClass" TEXT NOT NULL,
  "expected" JSONB NOT NULL,
  "expectedDigest" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'PLANNED',
  "currentObservationVersion" INTEGER NOT NULL DEFAULT 0,
  "reconciledByUserId" TEXT,
  "reconciliationStepUpId" TEXT,
  "reconciliationReason" TEXT,
  "reconciliationIdempotencyKey" TEXT,
  "reconciliationRequestDigest" TEXT,
  "reconciledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SettlementLeg_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SagaLegObservation" (
  "id" TEXT NOT NULL,
  "settlementLegId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestDigest" TEXT NOT NULL,
  "observation" JSONB NOT NULL,
  "observationDigest" TEXT NOT NULL,
  "externalReference" TEXT NOT NULL,
  "finalityClass" TEXT NOT NULL,
  "signatureStatus" TEXT NOT NULL,
  "evidenceObjectId" TEXT NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "recordedByUserId" TEXT NOT NULL,
  "recordedByMandateId" TEXT NOT NULL,
  "comparisonResult" TEXT NOT NULL,
  "comparison" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SagaLegObservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthoritativeRecordDeclaration" (
  "id" TEXT NOT NULL,
  "transactionCaseId" TEXT NOT NULL,
  "recordType" TEXT NOT NULL,
  "authorityClass" TEXT NOT NULL,
  "recordkeeperInstitutionId" TEXT,
  "sourceReferenceId" TEXT,
  "declarationEvidenceRef" TEXT NOT NULL,
  "declarationEvidenceDigest" TEXT NOT NULL,
  "declarationEvidenceObjectId" TEXT NOT NULL,
  "routePackRef" TEXT NOT NULL,
  "routePackVersion" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdByUserId" TEXT NOT NULL,
  "createdByMandateId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthoritativeRecordDeclaration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthoritativeRecordSnapshot" (
  "id" TEXT NOT NULL,
  "authoritativeRecordDeclarationId" TEXT NOT NULL,
  "settlementSagaId" TEXT NOT NULL,
  "snapshotKind" TEXT NOT NULL,
  "recordReference" TEXT NOT NULL,
  "payloadDigest" TEXT NOT NULL,
  "evidenceObjectId" TEXT NOT NULL,
  "sourceAsOfAt" TIMESTAMP(3) NOT NULL,
  "recordedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthoritativeRecordSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReconciliationBreak" (
  "id" TEXT NOT NULL,
  "transactionCaseId" TEXT NOT NULL,
  "settlementSagaId" TEXT NOT NULL,
  "settlementLegId" TEXT,
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
  "resolutionEvidenceRef" TEXT,
  "resolutionEvidenceDigest" TEXT,
  "resolutionReason" TEXT,
  "resolvedByUserId" TEXT,
  "independentlyClosedByUserId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReconciliationBreak_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SagaRepairAction" (
  "id" TEXT NOT NULL,
  "reconciliationBreakId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestDigest" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "replacementObservation" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "authorityEvidenceRef" TEXT NOT NULL,
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
  "appliedObservationId" TEXT,
  "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "appliedAt" TIMESTAMP(3),
  CONSTRAINT "SagaRepairAction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DaReplayAuthorisation_transactionCaseId_key" ON "DaReplayAuthorisation"("transactionCaseId");
CREATE UNIQUE INDEX "DaReplayAuthorisation_transactionCaseId_idempotencyKey_key" ON "DaReplayAuthorisation"("transactionCaseId", "idempotencyKey");
CREATE INDEX "DaReplayAuthorisation_status_createdAt_idx" ON "DaReplayAuthorisation"("status", "createdAt");

CREATE UNIQUE INDEX "SettlementSaga_transactionCaseId_sagaVersion_key" ON "SettlementSaga"("transactionCaseId", "sagaVersion");
CREATE UNIQUE INDEX "SettlementSaga_transactionCaseId_idempotencyKey_key" ON "SettlementSaga"("transactionCaseId", "idempotencyKey");
CREATE INDEX "SettlementSaga_transactionCaseId_state_idx" ON "SettlementSaga"("transactionCaseId", "state");
CREATE INDEX "SettlementSaga_state_updatedAt_idx" ON "SettlementSaga"("state", "updatedAt");
CREATE INDEX "SettlementSaga_historicOutcomeEvidenceObjectId_idx" ON "SettlementSaga"("historicOutcomeEvidenceObjectId");
CREATE INDEX "SettlementSaga_transfereeCreditDecisionEvidenceObjectId_idx" ON "SettlementSaga"("transfereeCreditDecisionEvidenceObjectId");
CREATE INDEX "SettlementSaga_executedTransferDocumentEvidenceObjectId_idx" ON "SettlementSaga"("executedTransferDocumentEvidenceObjectId");

CREATE UNIQUE INDEX "SettlementLeg_settlementSagaId_legKey_key" ON "SettlementLeg"("settlementSagaId", "legKey");
CREATE UNIQUE INDEX "SettlementLeg_settlementSagaId_sequence_key" ON "SettlementLeg"("settlementSagaId", "sequence");
CREATE UNIQUE INDEX "SettlementLeg_saga_reconciliation_idempotency_key" ON "SettlementLeg"("settlementSagaId", "reconciliationIdempotencyKey");
CREATE INDEX "SettlementLeg_settlementSagaId_state_sequence_idx" ON "SettlementLeg"("settlementSagaId", "state", "sequence");

CREATE UNIQUE INDEX "SagaLegObservation_settlementLegId_version_key" ON "SagaLegObservation"("settlementLegId", "version");
CREATE UNIQUE INDEX "SagaLegObservation_settlementLegId_idempotencyKey_key" ON "SagaLegObservation"("settlementLegId", "idempotencyKey");
CREATE INDEX "SagaLegObservation_settlementLegId_createdAt_idx" ON "SagaLegObservation"("settlementLegId", "createdAt");
CREATE INDEX "SagaLegObservation_evidenceObjectId_idx" ON "SagaLegObservation"("evidenceObjectId");

CREATE UNIQUE INDEX "AuthoritativeRecordDeclaration_transactionCaseId_key" ON "AuthoritativeRecordDeclaration"("transactionCaseId");
CREATE INDEX "AuthoritativeRecordDeclaration_recordkeeperInstitutionId_st_idx" ON "AuthoritativeRecordDeclaration"("recordkeeperInstitutionId", "status");
CREATE INDEX "AuthoritativeRecordDeclaration_sourceReferenceId_idx" ON "AuthoritativeRecordDeclaration"("sourceReferenceId");
CREATE INDEX "AuthoritativeRecordDeclaration_declarationEvidenceObjectId_idx" ON "AuthoritativeRecordDeclaration"("declarationEvidenceObjectId");

CREATE UNIQUE INDEX "AuthoritativeRecordSnapshot_settlementSagaId_snapshotKind_key" ON "AuthoritativeRecordSnapshot"("settlementSagaId", "snapshotKind");
CREATE INDEX "AuthoritativeRecordSnapshot_authoritativeRecordDeclarationI_idx" ON "AuthoritativeRecordSnapshot"("authoritativeRecordDeclarationId", "sourceAsOfAt");
CREATE INDEX "AuthoritativeRecordSnapshot_evidenceObjectId_idx" ON "AuthoritativeRecordSnapshot"("evidenceObjectId");

CREATE INDEX "ReconciliationBreak_transactionCaseId_status_severity_idx" ON "ReconciliationBreak"("transactionCaseId", "status", "severity");
CREATE INDEX "ReconciliationBreak_settlementSagaId_status_idx" ON "ReconciliationBreak"("settlementSagaId", "status");
CREATE INDEX "ReconciliationBreak_ownerInstitutionId_status_dueAt_idx" ON "ReconciliationBreak"("ownerInstitutionId", "status", "dueAt");

CREATE UNIQUE INDEX "SagaRepairAction_appliedObservationId_key" ON "SagaRepairAction"("appliedObservationId");
CREATE UNIQUE INDEX "SagaRepairAction_reconciliationBreakId_idempotencyKey_key" ON "SagaRepairAction"("reconciliationBreakId", "idempotencyKey");
CREATE INDEX "SagaRepairAction_reconciliationBreakId_status_proposedAt_idx" ON "SagaRepairAction"("reconciliationBreakId", "status", "proposedAt");

ALTER TABLE "DaReplayAuthorisation" ADD CONSTRAINT "DaReplayAuthorisation_transactionCaseId_fkey" FOREIGN KEY ("transactionCaseId") REFERENCES "TransactionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementSaga" ADD CONSTRAINT "SettlementSaga_transactionCaseId_fkey" FOREIGN KEY ("transactionCaseId") REFERENCES "TransactionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementSaga" ADD CONSTRAINT "SettlementSaga_historicOutcomeEvidenceObjectId_fkey" FOREIGN KEY ("historicOutcomeEvidenceObjectId") REFERENCES "EvidenceObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementSaga" ADD CONSTRAINT "SettlementSaga_transfereeCreditDecisionEvidenceObjectId_fkey" FOREIGN KEY ("transfereeCreditDecisionEvidenceObjectId") REFERENCES "EvidenceObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementSaga" ADD CONSTRAINT "SettlementSaga_executedTransferDocumentEvidenceObjectId_fkey" FOREIGN KEY ("executedTransferDocumentEvidenceObjectId") REFERENCES "EvidenceObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementLeg" ADD CONSTRAINT "SettlementLeg_settlementSagaId_fkey" FOREIGN KEY ("settlementSagaId") REFERENCES "SettlementSaga"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SagaLegObservation" ADD CONSTRAINT "SagaLegObservation_settlementLegId_fkey" FOREIGN KEY ("settlementLegId") REFERENCES "SettlementLeg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SagaLegObservation" ADD CONSTRAINT "SagaLegObservation_evidenceObjectId_fkey" FOREIGN KEY ("evidenceObjectId") REFERENCES "EvidenceObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuthoritativeRecordDeclaration" ADD CONSTRAINT "AuthoritativeRecordDeclaration_transactionCaseId_fkey" FOREIGN KEY ("transactionCaseId") REFERENCES "TransactionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuthoritativeRecordDeclaration" ADD CONSTRAINT "AuthoritativeRecordDeclaration_recordkeeperInstitutionId_fkey" FOREIGN KEY ("recordkeeperInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuthoritativeRecordDeclaration" ADD CONSTRAINT "AuthoritativeRecordDeclaration_sourceReferenceId_fkey" FOREIGN KEY ("sourceReferenceId") REFERENCES "SourceReference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuthoritativeRecordDeclaration" ADD CONSTRAINT "AuthoritativeRecordDeclaration_declarationEvidenceObjectId_fkey" FOREIGN KEY ("declarationEvidenceObjectId") REFERENCES "EvidenceObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuthoritativeRecordSnapshot" ADD CONSTRAINT "AuthoritativeRecordSnapshot_authoritativeRecordDeclaration_fkey" FOREIGN KEY ("authoritativeRecordDeclarationId") REFERENCES "AuthoritativeRecordDeclaration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuthoritativeRecordSnapshot" ADD CONSTRAINT "AuthoritativeRecordSnapshot_settlementSagaId_fkey" FOREIGN KEY ("settlementSagaId") REFERENCES "SettlementSaga"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuthoritativeRecordSnapshot" ADD CONSTRAINT "AuthoritativeRecordSnapshot_evidenceObjectId_fkey" FOREIGN KEY ("evidenceObjectId") REFERENCES "EvidenceObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReconciliationBreak" ADD CONSTRAINT "ReconciliationBreak_transactionCaseId_fkey" FOREIGN KEY ("transactionCaseId") REFERENCES "TransactionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReconciliationBreak" ADD CONSTRAINT "ReconciliationBreak_settlementSagaId_fkey" FOREIGN KEY ("settlementSagaId") REFERENCES "SettlementSaga"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReconciliationBreak" ADD CONSTRAINT "ReconciliationBreak_settlementLegId_fkey" FOREIGN KEY ("settlementLegId") REFERENCES "SettlementLeg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReconciliationBreak" ADD CONSTRAINT "ReconciliationBreak_ownerInstitutionId_fkey" FOREIGN KEY ("ownerInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SagaRepairAction" ADD CONSTRAINT "SagaRepairAction_reconciliationBreakId_fkey" FOREIGN KEY ("reconciliationBreakId") REFERENCES "ReconciliationBreak"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SagaRepairAction" ADD CONSTRAINT "SagaRepairAction_appliedObservationId_fkey" FOREIGN KEY ("appliedObservationId") REFERENCES "SagaLegObservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
