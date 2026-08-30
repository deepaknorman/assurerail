-- PR-08: case-level room write authority, active Rail room controls, connector subject mapping,
-- and provider-neutral source-completion dispatch/reconciliation. Additive and fail-closed.

ALTER TABLE "CaseRoom"
  ADD COLUMN "creationIdempotencyKey" TEXT,
  ADD COLUMN "creationRequestDigest" TEXT,
  ADD COLUMN "closeIdempotencyKey" TEXT,
  ADD COLUMN "closeRequestDigest" TEXT,
  ADD COLUMN "closeReason" TEXT;

ALTER TABLE "RoomGrant"
  ADD COLUMN "grantVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "invitationIdempotencyKey" TEXT,
  ADD COLUMN "invitationRequestDigest" TEXT,
  ADD COLUMN "invitationDigest" TEXT,
  ADD COLUMN "invitationExpiresAt" TIMESTAMP(3),
  ADD COLUMN "grantedByMandateId" TEXT,
  ADD COLUMN "acceptedByUserId" TEXT,
  ADD COLUMN "acceptedByMandateId" TEXT,
  ADD COLUMN "acceptedAt" TIMESTAMP(3),
  ADD COLUMN "acceptanceIdempotencyKey" TEXT,
  ADD COLUMN "acceptanceRequestDigest" TEXT;

ALTER TABLE "RoomMessage"
  ADD COLUMN "messageIdempotencyKey" TEXT,
  ADD COLUMN "messageRequestDigest" TEXT;

ALTER TABLE "ExternalInstruction"
  ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "lockedAt" TIMESTAMP(3),
  ADD COLUMN "lockOwner" TEXT,
  ADD COLUMN "lastError" TEXT;

DROP INDEX "ExternalInstruction_state_createdAt_idx";
CREATE INDEX "ExternalInstruction_state_nextAttemptAt_idx" ON "ExternalInstruction"("state", "nextAttemptAt");

CREATE TABLE "ConnectorSubjectMapping" (
  "id" TEXT NOT NULL,
  "connectorRegistrationId" TEXT NOT NULL,
  "externalSubjectRef" TEXT NOT NULL,
  "subjectType" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "allowedActions" JSONB NOT NULL,
  "scopeType" TEXT NOT NULL,
  "scopeRef" TEXT,
  "authorityEvidenceRef" TEXT NOT NULL,
  "proposalDigest" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROPOSED',
  "version" INTEGER NOT NULL DEFAULT 1,
  "supersedesMappingId" TEXT,
  "proposedByUserId" TEXT NOT NULL,
  "proposalStepUpId" TEXT NOT NULL,
  "approvedByUserId" TEXT,
  "approvalStepUpId" TEXT,
  "approvalReason" TEXT,
  "effectiveAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConnectorSubjectMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoomAuthorityAssignment" (
  "id" TEXT NOT NULL,
  "transactionCaseId" TEXT NOT NULL,
  "writeSource" TEXT NOT NULL DEFAULT 'LEGACY',
  "state" TEXT NOT NULL DEFAULT 'ACTIVE',
  "cohortRef" TEXT,
  "legacyCompatibilityUntil" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "lastChangeId" TEXT,
  "allocatedByUserId" TEXT NOT NULL,
  "allocatedByMandateId" TEXT NOT NULL,
  "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomAuthorityAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoomAuthorityChange" (
  "id" TEXT NOT NULL,
  "transactionCaseId" TEXT NOT NULL,
  "assignmentId" TEXT,
  "command" TEXT NOT NULL,
  "expectedVersion" INTEGER NOT NULL,
  "fromWriteSource" TEXT NOT NULL,
  "fromState" TEXT NOT NULL,
  "toWriteSource" TEXT NOT NULL,
  "toState" TEXT NOT NULL,
  "cohortRef" TEXT,
  "legacyCompatibilityUntil" TIMESTAMP(3),
  "reason" TEXT NOT NULL,
  "authorityEvidenceRef" TEXT NOT NULL,
  "proposalDigest" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "proposedByUserId" TEXT NOT NULL,
  "proposedByMandateId" TEXT NOT NULL,
  "proposalStepUpId" TEXT NOT NULL,
  "approvedByUserId" TEXT,
  "approvedByMandateId" TEXT,
  "approvalStepUpId" TEXT,
  "reviewNote" TEXT,
  "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "appliedAt" TIMESTAMP(3),
  CONSTRAINT "RoomAuthorityChange_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SourceCompletion" (
  "id" TEXT NOT NULL,
  "transactionCaseId" TEXT NOT NULL,
  "sourceReferenceId" TEXT NOT NULL,
  "providerReferenceId" TEXT NOT NULL,
  "connectorRegistrationId" TEXT NOT NULL,
  "completionKind" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestDigest" TEXT NOT NULL,
  "completionEvidenceRef" TEXT NOT NULL,
  "completionEvidenceDigest" TEXT NOT NULL,
  "expectedSourceObjectId" TEXT NOT NULL,
  "expectedSourceVersion" TEXT NOT NULL,
  "expectedManifestDigest" TEXT NOT NULL,
  "expectedLockReference" TEXT,
  "dispatchMode" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'PENDING',
  "externalInstructionId" TEXT NOT NULL,
  "finalAcknowledgementId" TEXT,
  "observedSourceObjectId" TEXT,
  "observedSourceState" TEXT,
  "observedSourceVersion" TEXT,
  "observedManifestDigest" TEXT,
  "observedLockReference" TEXT,
  "reconciliationState" TEXT NOT NULL DEFAULT 'PENDING',
  "breakCode" TEXT,
  "breakDetail" JSONB,
  "initiatedByUserId" TEXT NOT NULL,
  "initiatedByMandateId" TEXT NOT NULL,
  "reconciledByUserId" TEXT,
  "reconciledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SourceCompletion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CaseRoom_case_creation_idempotency_key" ON "CaseRoom"("transactionCaseId", "creationIdempotencyKey");
CREATE UNIQUE INDEX "CaseRoom_case_close_idempotency_key" ON "CaseRoom"("transactionCaseId", "closeIdempotencyKey");
CREATE UNIQUE INDEX "RoomGrant_invitationDigest_key" ON "RoomGrant"("invitationDigest");
CREATE UNIQUE INDEX "RoomGrant_room_invitation_idempotency_key" ON "RoomGrant"("caseRoomId", "invitationIdempotencyKey");
CREATE UNIQUE INDEX "RoomGrant_room_acceptance_idempotency_key" ON "RoomGrant"("caseRoomId", "acceptanceIdempotencyKey");
CREATE UNIQUE INDEX "RoomMessage_room_message_idempotency_key" ON "RoomMessage"("caseRoomId", "messageIdempotencyKey");
CREATE UNIQUE INDEX "ConnectorSubjectMapping_connector_subject_version_key" ON "ConnectorSubjectMapping"("connectorRegistrationId", "externalSubjectRef", "version");
CREATE UNIQUE INDEX "ConnectorSubjectMapping_proposalDigest_key" ON "ConnectorSubjectMapping"("proposalDigest");
CREATE INDEX "ConnectorSubjectMapping_connector_subject_status_idx" ON "ConnectorSubjectMapping"("connectorRegistrationId", "externalSubjectRef", "status");
CREATE INDEX "ConnectorSubjectMapping_institutionId_status_idx" ON "ConnectorSubjectMapping"("institutionId", "status");
CREATE UNIQUE INDEX "RoomAuthorityAssignment_transactionCaseId_key" ON "RoomAuthorityAssignment"("transactionCaseId");
CREATE UNIQUE INDEX "RoomAuthorityAssignment_lastChangeId_key" ON "RoomAuthorityAssignment"("lastChangeId");
CREATE INDEX "RoomAuthorityAssignment_writeSource_state_cohortRef_idx" ON "RoomAuthorityAssignment"("writeSource", "state", "cohortRef");
CREATE UNIQUE INDEX "RoomAuthorityChange_transactionCaseId_proposalDigest_key" ON "RoomAuthorityChange"("transactionCaseId", "proposalDigest");
CREATE INDEX "RoomAuthorityChange_transactionCaseId_status_proposedAt_idx" ON "RoomAuthorityChange"("transactionCaseId", "status", "proposedAt");
CREATE UNIQUE INDEX "SourceCompletion_transactionCaseId_sourceReferenceId_key" ON "SourceCompletion"("transactionCaseId", "sourceReferenceId");
CREATE UNIQUE INDEX "SourceCompletion_providerReferenceId_idempotencyKey_key" ON "SourceCompletion"("providerReferenceId", "idempotencyKey");
CREATE UNIQUE INDEX "SourceCompletion_externalInstructionId_key" ON "SourceCompletion"("externalInstructionId");
CREATE UNIQUE INDEX "SourceCompletion_finalAcknowledgementId_key" ON "SourceCompletion"("finalAcknowledgementId");
CREATE INDEX "SourceCompletion_state_createdAt_idx" ON "SourceCompletion"("state", "createdAt");
CREATE INDEX "SourceCompletion_reconciliationState_updatedAt_idx" ON "SourceCompletion"("reconciliationState", "updatedAt");

ALTER TABLE "ConnectorSubjectMapping" ADD CONSTRAINT "ConnectorSubjectMapping_connectorRegistrationId_fkey" FOREIGN KEY ("connectorRegistrationId") REFERENCES "ConnectorRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConnectorSubjectMapping" ADD CONSTRAINT "ConnectorSubjectMapping_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomAuthorityAssignment" ADD CONSTRAINT "RoomAuthorityAssignment_transactionCaseId_fkey" FOREIGN KEY ("transactionCaseId") REFERENCES "TransactionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomAuthorityChange" ADD CONSTRAINT "RoomAuthorityChange_transactionCaseId_fkey" FOREIGN KEY ("transactionCaseId") REFERENCES "TransactionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomAuthorityChange" ADD CONSTRAINT "RoomAuthorityChange_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "RoomAuthorityAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SourceCompletion" ADD CONSTRAINT "SourceCompletion_transactionCaseId_fkey" FOREIGN KEY ("transactionCaseId") REFERENCES "TransactionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SourceCompletion" ADD CONSTRAINT "SourceCompletion_sourceReferenceId_fkey" FOREIGN KEY ("sourceReferenceId") REFERENCES "SourceReference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SourceCompletion" ADD CONSTRAINT "SourceCompletion_providerReferenceId_fkey" FOREIGN KEY ("providerReferenceId") REFERENCES "ProviderReference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SourceCompletion" ADD CONSTRAINT "SourceCompletion_connectorRegistrationId_fkey" FOREIGN KEY ("connectorRegistrationId") REFERENCES "ConnectorRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SourceCompletion" ADD CONSTRAINT "SourceCompletion_externalInstructionId_fkey" FOREIGN KEY ("externalInstructionId") REFERENCES "ExternalInstruction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SourceCompletion" ADD CONSTRAINT "SourceCompletion_finalAcknowledgementId_fkey" FOREIGN KEY ("finalAcknowledgementId") REFERENCES "ExternalAcknowledgement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
