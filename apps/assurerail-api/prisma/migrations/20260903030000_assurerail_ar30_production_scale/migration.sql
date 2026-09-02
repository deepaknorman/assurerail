CREATE TABLE "ProductionScaleAssessment" (
  "id" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "targetOperatingMode" TEXT NOT NULL,
  "buildCommit" TEXT NOT NULL,
  "deploymentActivationId" TEXT,
  "boardState" TEXT NOT NULL,
  "assessment" JSONB NOT NULL,
  "controlDigest" TEXT NOT NULL,
  "assessmentDigest" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'GENERATED',
  "idempotencyKey" TEXT NOT NULL,
  "requestDigest" TEXT NOT NULL,
  "generatedByUserId" TEXT NOT NULL,
  "generatorAuthorityRef" TEXT NOT NULL,
  "generationStepUpId" TEXT NOT NULL,
  "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedByUserId" TEXT,
  "reviewerAuthorityRef" TEXT,
  "reviewStepUpId" TEXT,
  "reviewReason" TEXT,
  "reviewDigest" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductionScaleAssessment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductionScaleAssessment_assessmentDigest_key" ON "ProductionScaleAssessment"("assessmentDigest");
CREATE UNIQUE INDEX "ProductionScaleAssessment_reviewDigest_key" ON "ProductionScaleAssessment"("reviewDigest");
CREATE UNIQUE INDEX "PSA_environment_idempotency_key" ON "ProductionScaleAssessment"("environment", "idempotencyKey");
CREATE INDEX "PSA_environment_target_time_idx" ON "ProductionScaleAssessment"("environment", "targetOperatingMode", "assessedAt");
CREATE INDEX "PSA_state_status_time_idx" ON "ProductionScaleAssessment"("boardState", "status", "assessedAt");
CREATE INDEX "PSA_activation_idx" ON "ProductionScaleAssessment"("deploymentActivationId");

ALTER TABLE "ProductionScaleAssessment" ADD CONSTRAINT "PSA_activation_fkey"
  FOREIGN KEY ("deploymentActivationId") REFERENCES "DeploymentActivation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
