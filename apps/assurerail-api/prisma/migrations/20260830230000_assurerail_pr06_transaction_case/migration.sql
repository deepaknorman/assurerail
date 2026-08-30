-- PR-06: neutral transaction case, immutable versions, scoped parties/functions/conditions,
-- two-person decisions, optimistic transitions and deterministic replay receipts.
-- Additive. No legacy Note or room write path is switched by this migration.

CREATE TABLE "TransactionCase" (
  "id" TEXT NOT NULL,
  "caseReference" TEXT NOT NULL,
  "ownerInstitutionId" TEXT NOT NULL,
  "transactionRoute" TEXT NOT NULL,
  "representation" TEXT NOT NULL,
  "jurisdiction" TEXT NOT NULL,
  "marketContext" TEXT NOT NULL,
  "placementOrListing" TEXT NOT NULL,
  "lifecycleLeg" TEXT NOT NULL,
  "assetClass" TEXT NOT NULL,
  "operatingMode" TEXT NOT NULL,
  "routePackRef" TEXT NOT NULL,
  "routePackVersion" TEXT NOT NULL,
  "extensionProfileRef" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "routeState" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "currentVersion" INTEGER NOT NULL DEFAULT 1,
  "aggregateVersion" INTEGER NOT NULL DEFAULT 1,
  "creationIdempotencyKey" TEXT NOT NULL,
  "creationRequestDigest" TEXT NOT NULL,
  "evidenceLockedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdByMandateId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransactionCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CaseVersion" (
  "id" TEXT NOT NULL,
  "transactionCaseId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "spec" JSONB NOT NULL,
  "specDigest" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "supersedesVersionId" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdByMandateId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaseVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CaseParty" (
  "id" TEXT NOT NULL,
  "transactionCaseId" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "partyRole" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROPOSED',
  "authorityMandateId" TEXT,
  "appointmentId" TEXT,
  "authorityEvidenceRef" TEXT NOT NULL,
  "acceptedByUserId" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaseParty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CaseFunctionAssignment" (
  "id" TEXT NOT NULL,
  "transactionCaseId" TEXT NOT NULL,
  "materialFunction" TEXT NOT NULL,
  "performer" TEXT NOT NULL,
  "performerInstitutionId" TEXT,
  "appointmentId" TEXT,
  "authorityEvidenceRef" TEXT,
  "permissionEvidenceRef" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PROPOSED',
  "effectiveAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaseFunctionAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CaseCondition" (
  "id" TEXT NOT NULL,
  "transactionCaseId" TEXT NOT NULL,
  "conditionKind" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "ownerInstitutionId" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "evidenceObjectId" TEXT,
  "waiverAuthorityRef" TEXT,
  "resolutionReason" TEXT,
  "resolvedByUserId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaseCondition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CaseDecision" (
  "id" TEXT NOT NULL,
  "transactionCaseId" TEXT NOT NULL,
  "decisionType" TEXT NOT NULL,
  "proposal" JSONB NOT NULL,
  "proposalDigest" TEXT NOT NULL,
  "rulePackRef" TEXT NOT NULL,
  "rulePackVersion" TEXT NOT NULL,
  "evidenceBundleDigest" TEXT NOT NULL,
  "caseAggregateVersion" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROPOSED',
  "reason" TEXT NOT NULL,
  "proposedByUserId" TEXT NOT NULL,
  "proposedByMandateId" TEXT NOT NULL,
  "proposalStepUpId" TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "reviewStepUpId" TEXT,
  "reviewReason" TEXT,
  "effectiveAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaseDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CaseApproval" (
  "id" TEXT NOT NULL,
  "caseDecisionId" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "checkerUserId" TEXT NOT NULL,
  "checkerMandateId" TEXT NOT NULL,
  "stepUpEvidenceId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "approvalDigest" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaseApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CaseTransition" (
  "id" TEXT NOT NULL,
  "transactionCaseId" TEXT NOT NULL,
  "command" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestDigest" TEXT NOT NULL,
  "fromStatus" TEXT NOT NULL,
  "toStatus" TEXT NOT NULL,
  "expectedVersion" INTEGER NOT NULL,
  "resultingVersion" INTEGER NOT NULL,
  "guardResult" JSONB NOT NULL,
  "evidenceBundleDigest" TEXT NOT NULL,
  "rulePackRef" TEXT NOT NULL,
  "rulePackVersion" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actingInstitutionId" TEXT NOT NULL,
  "authorityMandateId" TEXT NOT NULL,
  "stepUpEvidenceId" TEXT NOT NULL,
  "transitionDigest" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaseTransition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CaseReplayReceipt" (
  "id" TEXT NOT NULL,
  "transactionCaseId" TEXT NOT NULL,
  "aggregateVersion" INTEGER NOT NULL,
  "exportDigest" TEXT NOT NULL,
  "replayDigest" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "detail" JSONB NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaseReplayReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TransactionCase_caseReference_key" ON "TransactionCase"("caseReference");
CREATE UNIQUE INDEX "TransactionCase_owner_creation_key" ON "TransactionCase"("ownerInstitutionId","creationIdempotencyKey");
CREATE INDEX "TransactionCase_owner_status_idx" ON "TransactionCase"("ownerInstitutionId","status");
CREATE INDEX "TransactionCase_route_rep_mode_status_idx" ON "TransactionCase"("transactionRoute","representation","operatingMode","status");
CREATE UNIQUE INDEX "CaseVersion_case_version_key" ON "CaseVersion"("transactionCaseId","version");
CREATE UNIQUE INDEX "CaseVersion_case_digest_key" ON "CaseVersion"("transactionCaseId","specDigest");
CREATE UNIQUE INDEX "CaseParty_case_institution_role_key" ON "CaseParty"("transactionCaseId","institutionId","partyRole");
CREATE INDEX "CaseParty_institution_status_idx" ON "CaseParty"("institutionId","status");
CREATE INDEX "CaseParty_case_status_idx" ON "CaseParty"("transactionCaseId","status");
CREATE UNIQUE INDEX "CaseFunctionAssignment_case_function_key" ON "CaseFunctionAssignment"("transactionCaseId","materialFunction");
CREATE INDEX "CaseFunctionAssignment_performer_status_idx" ON "CaseFunctionAssignment"("performerInstitutionId","status");
CREATE UNIQUE INDEX "CaseCondition_case_code_key" ON "CaseCondition"("transactionCaseId","code");
CREATE INDEX "CaseCondition_case_status_due_idx" ON "CaseCondition"("transactionCaseId","status","dueAt");
CREATE INDEX "CaseCondition_owner_status_idx" ON "CaseCondition"("ownerInstitutionId","status");
CREATE UNIQUE INDEX "CaseDecision_case_type_digest_key" ON "CaseDecision"("transactionCaseId","decisionType","proposalDigest");
CREATE INDEX "CaseDecision_case_status_idx" ON "CaseDecision"("transactionCaseId","status");
CREATE UNIQUE INDEX "CaseApproval_approvalDigest_key" ON "CaseApproval"("approvalDigest");
CREATE UNIQUE INDEX "CaseApproval_decision_checker_key" ON "CaseApproval"("caseDecisionId","checkerUserId");
CREATE UNIQUE INDEX "CaseTransition_transitionDigest_key" ON "CaseTransition"("transitionDigest");
CREATE UNIQUE INDEX "CaseTransition_case_idempotency_key" ON "CaseTransition"("transactionCaseId","idempotencyKey");
CREATE UNIQUE INDEX "CaseTransition_case_resulting_version_key" ON "CaseTransition"("transactionCaseId","resultingVersion");
CREATE INDEX "CaseTransition_case_occurred_idx" ON "CaseTransition"("transactionCaseId","occurredAt");
CREATE UNIQUE INDEX "CaseReplayReceipt_case_version_replay_key" ON "CaseReplayReceipt"("transactionCaseId","aggregateVersion","replayDigest");
CREATE INDEX "CaseReplayReceipt_case_created_idx" ON "CaseReplayReceipt"("transactionCaseId","createdAt");

ALTER TABLE "TransactionCase" ADD CONSTRAINT "TransactionCase_ownerInstitutionId_fkey" FOREIGN KEY ("ownerInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseVersion" ADD CONSTRAINT "CaseVersion_transactionCaseId_fkey" FOREIGN KEY ("transactionCaseId") REFERENCES "TransactionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseParty" ADD CONSTRAINT "CaseParty_transactionCaseId_fkey" FOREIGN KEY ("transactionCaseId") REFERENCES "TransactionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseParty" ADD CONSTRAINT "CaseParty_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseFunctionAssignment" ADD CONSTRAINT "CaseFunctionAssignment_transactionCaseId_fkey" FOREIGN KEY ("transactionCaseId") REFERENCES "TransactionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseFunctionAssignment" ADD CONSTRAINT "CaseFunctionAssignment_performerInstitutionId_fkey" FOREIGN KEY ("performerInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseCondition" ADD CONSTRAINT "CaseCondition_transactionCaseId_fkey" FOREIGN KEY ("transactionCaseId") REFERENCES "TransactionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseDecision" ADD CONSTRAINT "CaseDecision_transactionCaseId_fkey" FOREIGN KEY ("transactionCaseId") REFERENCES "TransactionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseApproval" ADD CONSTRAINT "CaseApproval_caseDecisionId_fkey" FOREIGN KEY ("caseDecisionId") REFERENCES "CaseDecision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseTransition" ADD CONSTRAINT "CaseTransition_transactionCaseId_fkey" FOREIGN KEY ("transactionCaseId") REFERENCES "TransactionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseReplayReceipt" ADD CONSTRAINT "CaseReplayReceipt_transactionCaseId_fkey" FOREIGN KEY ("transactionCaseId") REFERENCES "TransactionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
