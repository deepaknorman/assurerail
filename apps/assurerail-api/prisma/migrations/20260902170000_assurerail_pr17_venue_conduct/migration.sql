CREATE TABLE "ConductPolicyRelease" (
  "id" TEXT NOT NULL, "policyRef" TEXT NOT NULL, "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROPOSED', "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "prohibitedActionRules" JSONB NOT NULL,
  "fairAccessRules" JSONB NOT NULL, "communicationsRules" JSONB NOT NULL,
  "allocationRules" JSONB NOT NULL, "slaRules" JSONB NOT NULL, "policyDigest" TEXT NOT NULL,
  "proposedByUserId" TEXT NOT NULL, "proposalStepUpId" TEXT NOT NULL,
  "reviewedByUserId" TEXT, "reviewStepUpId" TEXT, "reviewReason" TEXT,
  "reviewedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConductPolicyRelease_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ConductPolicyRelease_policyRef_version_key" ON "ConductPolicyRelease"("policyRef", "version");
CREATE UNIQUE INDEX "ConductPolicyRelease_policyDigest_key" ON "ConductPolicyRelease"("policyDigest");
CREATE INDEX "ConductPolicyRelease_status_effectiveFrom_expiresAt_idx" ON "ConductPolicyRelease"("status", "effectiveFrom", "expiresAt");

CREATE TABLE "VenueConductSignal" (
  "id" TEXT NOT NULL, "signalType" TEXT NOT NULL, "transactionCaseId" TEXT,
  "commercialOpportunityId" TEXT, "institutionId" TEXT, "route" TEXT, "cohortRef" TEXT,
  "sourceEventRef" TEXT NOT NULL, "sourceOccurredAt" TIMESTAMP(3) NOT NULL,
  "sourceEvidenceRef" TEXT NOT NULL, "sourceEvidenceDigest" TEXT NOT NULL, "facts" JSONB NOT NULL,
  "factsDigest" TEXT NOT NULL, "policyReleaseId" TEXT NOT NULL, "evaluation" JSONB NOT NULL,
  "evaluationDigest" TEXT NOT NULL, "result" TEXT NOT NULL DEFAULT 'REVIEW_REQUIRED',
  "idempotencyKey" TEXT NOT NULL, "recordedByUserId" TEXT NOT NULL, "stepUpEvidenceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VenueConductSignal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VenueConductSignal_sourceEventRef_idempotencyKey_key" ON "VenueConductSignal"("sourceEventRef", "idempotencyKey");
CREATE UNIQUE INDEX "VenueConductSignal_event_digest_policy_key" ON "VenueConductSignal"("sourceEventRef", "sourceEvidenceDigest", "policyReleaseId");
CREATE INDEX "VenueConductSignal_transactionCaseId_createdAt_idx" ON "VenueConductSignal"("transactionCaseId", "createdAt");
CREATE INDEX "VenueConductSignal_commercialOpportunityId_createdAt_idx" ON "VenueConductSignal"("commercialOpportunityId", "createdAt");
CREATE INDEX "VenueConductSignal_institutionId_createdAt_idx" ON "VenueConductSignal"("institutionId", "createdAt");
CREATE INDEX "VenueConductSignal_result_createdAt_idx" ON "VenueConductSignal"("result", "createdAt");

CREATE TABLE "VenueConductAlert" (
  "id" TEXT NOT NULL, "signalId" TEXT NOT NULL, "alertCode" TEXT NOT NULL, "severity" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN', "evidentialClassification" TEXT NOT NULL DEFAULT 'REVIEW_REQUIRED',
  "ownerUserId" TEXT NOT NULL, "dueAt" TIMESTAMP(3) NOT NULL, "resolution" TEXT,
  "resolutionEvidenceRef" TEXT, "resolutionEvidenceDigest" TEXT, "reviewedByUserId" TEXT,
  "reviewStepUpId" TEXT, "closedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VenueConductAlert_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VenueConductAlert_signalId_key" ON "VenueConductAlert"("signalId");
CREATE INDEX "VenueConductAlert_status_dueAt_idx" ON "VenueConductAlert"("status", "dueAt");
CREATE INDEX "VenueConductAlert_ownerUserId_status_dueAt_idx" ON "VenueConductAlert"("ownerUserId", "status", "dueAt");

CREATE TABLE "VenueConductInvestigation" (
  "id" TEXT NOT NULL, "alertId" TEXT NOT NULL, "complaintId" TEXT, "status" TEXT NOT NULL DEFAULT 'OPEN',
  "legalHold" BOOLEAN NOT NULL DEFAULT false, "scope" JSONB NOT NULL, "evidenceRefs" JSONB NOT NULL,
  "assigneeUserId" TEXT NOT NULL, "dueAt" TIMESTAMP(3) NOT NULL, "conclusion" TEXT,
  "conclusionClass" TEXT, "proposedByUserId" TEXT NOT NULL, "lastChangedByUserId" TEXT NOT NULL,
  "stepUpEvidenceId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VenueConductInvestigation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VenueConductInvestigation_alertId_status_idx" ON "VenueConductInvestigation"("alertId", "status");
CREATE INDEX "VenueConductInvestigation_complaintId_status_idx" ON "VenueConductInvestigation"("complaintId", "status");
CREATE INDEX "VenueConductInvestigation_assigneeUserId_status_dueAt_idx" ON "VenueConductInvestigation"("assigneeUserId", "status", "dueAt");

CREATE TABLE "VenueComplaint" (
  "id" TEXT NOT NULL, "complaintRef" TEXT NOT NULL, "complainantInstitutionId" TEXT,
  "transactionCaseId" TEXT, "commercialOpportunityId" TEXT, "category" TEXT NOT NULL,
  "summary" TEXT NOT NULL, "evidenceRefs" JSONB NOT NULL, "status" TEXT NOT NULL DEFAULT 'OPEN',
  "ownerUserId" TEXT NOT NULL, "dueAt" TIMESTAMP(3) NOT NULL, "idempotencyKey" TEXT NOT NULL,
  "requestDigest" TEXT NOT NULL, "recordedByUserId" TEXT NOT NULL, "stepUpEvidenceId" TEXT NOT NULL,
  "resolution" TEXT, "resolutionEvidenceRef" TEXT, "resolutionEvidenceDigest" TEXT,
  "resolvedByUserId" TEXT, "resolvedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VenueComplaint_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VenueComplaint_complaintRef_key" ON "VenueComplaint"("complaintRef");
CREATE UNIQUE INDEX "VenueComplaint_idempotencyKey_key" ON "VenueComplaint"("idempotencyKey");
CREATE UNIQUE INDEX "VenueComplaint_requestDigest_key" ON "VenueComplaint"("requestDigest");
CREATE INDEX "VenueComplaint_status_dueAt_idx" ON "VenueComplaint"("status", "dueAt");
CREATE INDEX "VenueComplaint_complainantInstitutionId_status_createdAt_idx" ON "VenueComplaint"("complainantInstitutionId", "status", "createdAt");

CREATE TABLE "VenueCorrection" (
  "id" TEXT NOT NULL, "complaintId" TEXT, "targetType" TEXT NOT NULL, "targetRef" TEXT NOT NULL,
  "reason" TEXT NOT NULL, "priorDigest" TEXT NOT NULL, "correctedDigest" TEXT NOT NULL,
  "correctionEvidenceRef" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PROPOSED',
  "proposalDigest" TEXT NOT NULL, "proposedByUserId" TEXT NOT NULL, "proposalStepUpId" TEXT NOT NULL,
  "reviewedByUserId" TEXT, "reviewStepUpId" TEXT, "reviewReason" TEXT,
  "reviewedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VenueCorrection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VenueCorrection_proposalDigest_key" ON "VenueCorrection"("proposalDigest");
CREATE INDEX "VenueCorrection_targetType_targetRef_createdAt_idx" ON "VenueCorrection"("targetType", "targetRef", "createdAt");
CREATE INDEX "VenueCorrection_complaintId_status_idx" ON "VenueCorrection"("complaintId", "status");

CREATE TABLE "VenueControlAction" (
  "id" TEXT NOT NULL, "actionType" TEXT NOT NULL, "scopeType" TEXT NOT NULL, "scopeRef" TEXT NOT NULL,
  "severity" TEXT NOT NULL, "reason" TEXT NOT NULL, "evidenceRefs" JSONB NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROPOSED', "proposalDigest" TEXT NOT NULL,
  "proposedByUserId" TEXT NOT NULL, "proposalStepUpId" TEXT NOT NULL, "reviewedByUserId" TEXT,
  "reviewStepUpId" TEXT, "reviewReason" TEXT, "reviewedAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VenueControlAction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VenueControlAction_proposalDigest_key" ON "VenueControlAction"("proposalDigest");
CREATE INDEX "VenueControlAction_type_status_window_idx" ON "VenueControlAction"("actionType", "status", "effectiveFrom", "expiresAt");
CREATE INDEX "VenueControlAction_scopeType_scopeRef_status_idx" ON "VenueControlAction"("scopeType", "scopeRef", "status");

CREATE TABLE "VenueCapacityBudget" (
  "id" TEXT NOT NULL, "environment" TEXT NOT NULL, "route" TEXT NOT NULL, "cohortRef" TEXT NOT NULL,
  "metric" TEXT NOT NULL, "unit" TEXT NOT NULL, "warningThreshold" TEXT NOT NULL, "hardThreshold" TEXT NOT NULL,
  "version" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'ACTIVE', "budgetDigest" TEXT NOT NULL,
  "changedByUserId" TEXT NOT NULL, "stepUpEvidenceId" TEXT NOT NULL, "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VenueCapacityBudget_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VenueCapacityBudget_budgetDigest_key" ON "VenueCapacityBudget"("budgetDigest");
CREATE UNIQUE INDEX "VenueCapacityBudget_scope_metric_version_key" ON "VenueCapacityBudget"("environment", "route", "cohortRef", "metric", "version");
CREATE INDEX "VenueCapacityBudget_environment_route_cohortRef_status_idx" ON "VenueCapacityBudget"("environment", "route", "cohortRef", "status");

CREATE TABLE "VenueCapacityObservation" (
  "id" TEXT NOT NULL, "capacityBudgetId" TEXT NOT NULL, "observedValue" TEXT NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL, "state" TEXT NOT NULL, "sourceEvidenceRef" TEXT NOT NULL,
  "sourceEvidenceDigest" TEXT NOT NULL, "observationDigest" TEXT NOT NULL, "recordedByUserId" TEXT NOT NULL,
  "stepUpEvidenceId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VenueCapacityObservation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VenueCapacityObservation_observationDigest_key" ON "VenueCapacityObservation"("observationDigest");
CREATE UNIQUE INDEX "VenueCapacityObservation_capacityBudgetId_observedAt_key" ON "VenueCapacityObservation"("capacityBudgetId", "observedAt");
CREATE INDEX "VenueCapacityObservation_capacityBudgetId_state_observedAt_idx" ON "VenueCapacityObservation"("capacityBudgetId", "state", "observedAt");
CREATE INDEX "VenueCapacityObservation_state_observedAt_idx" ON "VenueCapacityObservation"("state", "observedAt");

ALTER TABLE "VenueConductSignal" ADD CONSTRAINT "VenueConductSignal_policyReleaseId_fkey" FOREIGN KEY ("policyReleaseId") REFERENCES "ConductPolicyRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VenueConductAlert" ADD CONSTRAINT "VenueConductAlert_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "VenueConductSignal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VenueConductInvestigation" ADD CONSTRAINT "VenueConductInvestigation_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "VenueConductAlert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VenueConductInvestigation" ADD CONSTRAINT "VenueConductInvestigation_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "VenueComplaint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VenueCorrection" ADD CONSTRAINT "VenueCorrection_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "VenueComplaint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VenueCapacityObservation" ADD CONSTRAINT "VenueCapacityObservation_capacityBudgetId_fkey" FOREIGN KEY ("capacityBudgetId") REFERENCES "VenueCapacityBudget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
