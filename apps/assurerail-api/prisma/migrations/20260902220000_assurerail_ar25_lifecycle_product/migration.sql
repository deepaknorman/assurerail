CREATE TABLE "RailLifecyclePlan" (
  "id" TEXT NOT NULL,
  "transactionCaseId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "periodStartAt" TIMESTAMP(3) NOT NULL,
  "periodEndAt" TIMESTAMP(3) NOT NULL,
  "executionMode" TEXT NOT NULL DEFAULT 'OBSERVE_ONLY',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "routePackRef" TEXT NOT NULL,
  "routePackVersion" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestDigest" TEXT NOT NULL,
  "planDigest" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdByMandateId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reconciledAt" TIMESTAMP(3),
  CONSTRAINT "RailLifecyclePlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RailLifecycleObligation" (
  "id" TEXT NOT NULL,
  "lifecyclePlanId" TEXT NOT NULL,
  "obligationKey" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "materialFunction" TEXT NOT NULL,
  "accountableInstitutionId" TEXT NOT NULL,
  "performerClass" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "expected" JSONB NOT NULL,
  "expectedDigest" TEXT NOT NULL,
  "amountCurrency" TEXT,
  "amountMinorUnits" TEXT,
  "amountScale" INTEGER,
  "state" TEXT NOT NULL DEFAULT 'PLANNED',
  "currentEventVersion" INTEGER NOT NULL DEFAULT 0,
  "reconciledByUserId" TEXT,
  "reconciliationStepUpId" TEXT,
  "reconciliationReason" TEXT,
  "reconciliationIdempotencyKey" TEXT,
  "reconciliationRequestDigest" TEXT,
  "reconciledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RailLifecycleObligation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RailLifecycleEvent" (
  "id" TEXT NOT NULL,
  "lifecycleObligationId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestDigest" TEXT NOT NULL,
  "observed" JSONB NOT NULL,
  "observedDigest" TEXT NOT NULL,
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
  CONSTRAINT "RailLifecycleEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RailLifecycleBreak" (
  "id" TEXT NOT NULL,
  "transactionCaseId" TEXT NOT NULL,
  "lifecyclePlanId" TEXT NOT NULL,
  "lifecycleObligationId" TEXT NOT NULL,
  "lifecycleEventId" TEXT NOT NULL,
  "breakCode" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "expectedDigest" TEXT NOT NULL,
  "observedDigest" TEXT NOT NULL,
  "blockedCapabilities" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "ownerInstitutionId" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "openedByUserId" TEXT NOT NULL,
  "resolutionEvidenceRef" TEXT,
  "resolvedByUserId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RailLifecycleBreak_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RailLifecyclePlan_transactionCaseId_version_key" ON "RailLifecyclePlan"("transactionCaseId", "version");
CREATE UNIQUE INDEX "RailLifecyclePlan_transactionCaseId_idempotencyKey_key" ON "RailLifecyclePlan"("transactionCaseId", "idempotencyKey");
CREATE INDEX "RailLifecyclePlan_transactionCaseId_status_periodEndAt_idx" ON "RailLifecyclePlan"("transactionCaseId", "status", "periodEndAt");
CREATE UNIQUE INDEX "RailLifecycleObligation_lifecyclePlanId_obligationKey_key" ON "RailLifecycleObligation"("lifecyclePlanId", "obligationKey");
CREATE UNIQUE INDEX "RailLifecycleObligation_lifecyclePlanId_sequence_key" ON "RailLifecycleObligation"("lifecyclePlanId", "sequence");
CREATE UNIQUE INDEX "RailLifecycleObligation_plan_reconcile_key" ON "RailLifecycleObligation"("lifecyclePlanId", "reconciliationIdempotencyKey");
CREATE INDEX "RailLifecycleObligation_lifecyclePlanId_state_sequence_idx" ON "RailLifecycleObligation"("lifecyclePlanId", "state", "sequence");
CREATE INDEX "RailLifecycleObligation_owner_due_state_idx" ON "RailLifecycleObligation"("accountableInstitutionId", "dueAt", "state");
CREATE UNIQUE INDEX "RailLifecycleEvent_lifecycleObligationId_version_key" ON "RailLifecycleEvent"("lifecycleObligationId", "version");
CREATE UNIQUE INDEX "RailLifecycleEvent_lifecycleObligationId_idempotencyKey_key" ON "RailLifecycleEvent"("lifecycleObligationId", "idempotencyKey");
CREATE INDEX "RailLifecycleEvent_evidenceObjectId_idx" ON "RailLifecycleEvent"("evidenceObjectId");
CREATE INDEX "RailLifecycleBreak_transactionCaseId_status_dueAt_idx" ON "RailLifecycleBreak"("transactionCaseId", "status", "dueAt");
CREATE INDEX "RailLifecycleBreak_lifecyclePlanId_status_idx" ON "RailLifecycleBreak"("lifecyclePlanId", "status");
CREATE INDEX "RailLifecycleBreak_lifecycleObligationId_status_idx" ON "RailLifecycleBreak"("lifecycleObligationId", "status");
CREATE INDEX "RailLifecycleBreak_ownerInstitutionId_status_dueAt_idx" ON "RailLifecycleBreak"("ownerInstitutionId", "status", "dueAt");
CREATE UNIQUE INDEX "RailLifecycleBreak_lifecycleEventId_key" ON "RailLifecycleBreak"("lifecycleEventId");

ALTER TABLE "RailLifecyclePlan" ADD CONSTRAINT "RailLifecyclePlan_transactionCaseId_fkey" FOREIGN KEY ("transactionCaseId") REFERENCES "TransactionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RailLifecycleObligation" ADD CONSTRAINT "RailLifecycleObligation_lifecyclePlanId_fkey" FOREIGN KEY ("lifecyclePlanId") REFERENCES "RailLifecyclePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RailLifecycleObligation" ADD CONSTRAINT "RailLifecycleObligation_accountableInstitutionId_fkey" FOREIGN KEY ("accountableInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RailLifecycleEvent" ADD CONSTRAINT "RailLifecycleEvent_lifecycleObligationId_fkey" FOREIGN KEY ("lifecycleObligationId") REFERENCES "RailLifecycleObligation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RailLifecycleEvent" ADD CONSTRAINT "RailLifecycleEvent_evidenceObjectId_fkey" FOREIGN KEY ("evidenceObjectId") REFERENCES "EvidenceObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RailLifecycleBreak" ADD CONSTRAINT "RailLifecycleBreak_transactionCaseId_fkey" FOREIGN KEY ("transactionCaseId") REFERENCES "TransactionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RailLifecycleBreak" ADD CONSTRAINT "RailLifecycleBreak_lifecyclePlanId_fkey" FOREIGN KEY ("lifecyclePlanId") REFERENCES "RailLifecyclePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RailLifecycleBreak" ADD CONSTRAINT "RailLifecycleBreak_lifecycleObligationId_fkey" FOREIGN KEY ("lifecycleObligationId") REFERENCES "RailLifecycleObligation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RailLifecycleBreak" ADD CONSTRAINT "RailLifecycleBreak_lifecycleEventId_fkey" FOREIGN KEY ("lifecycleEventId") REFERENCES "RailLifecycleEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RailLifecycleBreak" ADD CONSTRAINT "RailLifecycleBreak_ownerInstitutionId_fkey" FOREIGN KEY ("ownerInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
