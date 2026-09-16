-- Durable Initial Assessment remediation and comparable reassessment lineage.
ALTER TABLE "AssessmentProcessingJob"
  ADD COLUMN "scopeDigest" TEXT,
  ADD COLUMN "baselineRunId" TEXT,
  ADD COLUMN "reassessmentOrdinal" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "AssessmentRemediationItem" (
  "id" TEXT NOT NULL,
  "engagementId" TEXT NOT NULL,
  "sourceRunId" TEXT NOT NULL,
  "gapKey" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "affectedScope" TEXT NOT NULL,
  "affectedPairs" JSONB NOT NULL,
  "affectedPairCount" INTEGER NOT NULL,
  "unresolvedRecordCount" INTEGER NOT NULL DEFAULT 0,
  "defaultOwnerRole" TEXT NOT NULL,
  "ownerRole" TEXT,
  "requiredEvidenceTypes" JSONB NOT NULL,
  "correctionEvidenceVersionIds" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "plannedByUserId" TEXT,
  "planningStepUpId" TEXT,
  "plannedAt" TIMESTAMP(3),
  "resolvedByRunId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentRemediationItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssessmentRemediationItem_sourceRunId_gapKey_key" ON "AssessmentRemediationItem"("sourceRunId", "gapKey");
CREATE INDEX "AssessmentRemediationItem_engagementId_sourceRunId_status_idx" ON "AssessmentRemediationItem"("engagementId", "sourceRunId", "status");
CREATE INDEX "AssessmentProcessingJob_baselineRunId_idx" ON "AssessmentProcessingJob"("baselineRunId");
ALTER TABLE "AssessmentRemediationItem" ADD CONSTRAINT "AssessmentRemediationItem_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "AssessmentEngagement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentRemediationItem" ADD CONSTRAINT "AssessmentRemediationItem_sourceRunId_fkey" FOREIGN KEY ("sourceRunId") REFERENCES "AssessmentProcessingJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentProcessingJob" ADD CONSTRAINT "AssessmentProcessingJob_baselineRunId_fkey" FOREIGN KEY ("baselineRunId") REFERENCES "AssessmentProcessingJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentRemediationItem" ADD CONSTRAINT "AssessmentRemediationItem_state" CHECK (
  category IN ('DOCUMENTATION','DATA_QUALITY','CREDIT','LEGAL','OPERATIONS')
  AND severity IN ('CRITICAL','HIGH','MEDIUM','LOW')
  AND "affectedScope" IN ('PAIRS','PORTFOLIO')
  AND "affectedPairCount" >= 0 AND "unresolvedRecordCount" >= 0
  AND "defaultOwnerRole" IN ('SELLER_DATA','SELLER_OPERATIONS','SELLER_CREDIT','SELLER_LEGAL','SELLER_COMPLIANCE')
  AND ("ownerRole" IS NULL OR "ownerRole" IN ('SELLER_DATA','SELLER_OPERATIONS','SELLER_CREDIT','SELLER_LEGAL','SELLER_COMPLIANCE'))
  AND status IN ('OPEN','EVIDENCE_ATTACHED','CARRIED_FORWARD','RESOLVED_BY_RERUN')
);
ALTER TABLE "AssessmentRemediationItem" ADD CONSTRAINT "AssessmentRemediationItem_plan" CHECK (
  (("ownerRole" IS NULL AND "plannedByUserId" IS NULL AND "planningStepUpId" IS NULL AND "plannedAt" IS NULL)
  OR ("ownerRole" IS NOT NULL AND "plannedByUserId" IS NOT NULL AND "planningStepUpId" IS NOT NULL AND "plannedAt" IS NOT NULL))
  AND (status <> 'EVIDENCE_ATTACHED' OR "ownerRole" IS NOT NULL)
);
ALTER TABLE "AssessmentProcessingJob" ADD CONSTRAINT "AssessmentProcessingJob_reassessment" CHECK (
  "reassessmentOrdinal" >= 0
  AND (("reassessmentOrdinal" = 0 AND "baselineRunId" IS NULL) OR (stage = 'INITIAL' AND "reassessmentOrdinal" > 0 AND "baselineRunId" IS NOT NULL AND "scopeDigest" IS NOT NULL))
);
