-- PR-12: additive, durable readiness evidence and signed deployment activation records.
-- No existing route is activated by this migration.
CREATE TABLE "OperationalReadinessGate" (
    "id" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeRef" TEXT,
    "scopeKey" TEXT NOT NULL,
    "gateCode" TEXT NOT NULL,
    "requirementVersion" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "requirement" TEXT NOT NULL,
    "evidenceClassRequired" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "ownerUserId" TEXT NOT NULL,
    "proposedByUserId" TEXT NOT NULL,
    "proposalStepUpId" TEXT NOT NULL,
    "proposalDigest" TEXT NOT NULL,
    "currentEvidenceRef" TEXT,
    "currentEvidenceDigest" TEXT,
    "currentDecisionId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "supersedesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OperationalReadinessGate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OperationalReadinessDecision" (
    "id" TEXT NOT NULL,
    "readinessGateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "decision" TEXT NOT NULL,
    "evidenceClass" TEXT NOT NULL,
    "evidenceRef" TEXT NOT NULL,
    "evidenceDigest" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "decidedByUserId" TEXT NOT NULL,
    "decisionStepUpId" TEXT NOT NULL,
    "decisionDigest" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OperationalReadinessDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeploymentActivation" (
    "id" TEXT NOT NULL,
    "manifestId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "operatingMode" TEXT NOT NULL,
    "buildCommit" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "manifest" JSONB NOT NULL,
    "manifestDigest" TEXT NOT NULL,
    "signatureAlgorithm" TEXT NOT NULL DEFAULT 'ED25519',
    "signingKeyId" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "proposedByUserId" TEXT NOT NULL,
    "proposalStepUpId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "approvalStepUpId" TEXT,
    "approvalReason" TEXT,
    "approvalDigest" TEXT,
    "approvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedByUserId" TEXT,
    "revocationStepUpId" TEXT,
    "revocationReason" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeploymentActivation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeploymentActivationGate" (
    "deploymentActivationId" TEXT NOT NULL,
    "readinessGateId" TEXT NOT NULL,
    "readinessDecisionId" TEXT NOT NULL,
    "gateCode" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "evidenceDigest" TEXT NOT NULL,
    "boundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeploymentActivationGate_pkey" PRIMARY KEY ("deploymentActivationId", "readinessGateId")
);

CREATE UNIQUE INDEX "OperationalReadinessGate_proposalDigest_key" ON "OperationalReadinessGate"("proposalDigest");
CREATE UNIQUE INDEX "OperationalReadinessGate_currentDecisionId_key" ON "OperationalReadinessGate"("currentDecisionId");
CREATE UNIQUE INDEX "OperationalReadinessGate_scope_code_version_key" ON "OperationalReadinessGate"("environment", "scopeKey", "gateCode", "requirementVersion");
CREATE INDEX "OperationalReadinessGate_environment_status_expiry_idx" ON "OperationalReadinessGate"("environment", "status", "expiresAt");
CREATE INDEX "OperationalReadinessGate_scope_code_idx" ON "OperationalReadinessGate"("scopeType", "scopeRef", "gateCode");
CREATE INDEX "OperationalReadinessGate_owner_status_idx" ON "OperationalReadinessGate"("ownerUserId", "status");

CREATE UNIQUE INDEX "OperationalReadinessDecision_decisionDigest_key" ON "OperationalReadinessDecision"("decisionDigest");
CREATE UNIQUE INDEX "OperationalReadinessDecision_gate_version_key" ON "OperationalReadinessDecision"("readinessGateId", "version");
CREATE INDEX "OperationalReadinessDecision_gate_decision_expiry_idx" ON "OperationalReadinessDecision"("readinessGateId", "decision", "expiresAt");
CREATE INDEX "OperationalReadinessDecision_actor_created_idx" ON "OperationalReadinessDecision"("decidedByUserId", "createdAt");

CREATE UNIQUE INDEX "DeploymentActivation_manifestId_key" ON "DeploymentActivation"("manifestId");
CREATE UNIQUE INDEX "DeploymentActivation_manifestDigest_key" ON "DeploymentActivation"("manifestDigest");
CREATE UNIQUE INDEX "DeploymentActivation_approvalDigest_key" ON "DeploymentActivation"("approvalDigest");
CREATE INDEX "DeploymentActivation_environment_mode_status_idx" ON "DeploymentActivation"("environment", "operatingMode", "status", "expiresAt");
CREATE INDEX "DeploymentActivation_build_status_idx" ON "DeploymentActivation"("buildCommit", "status");

CREATE UNIQUE INDEX "DeploymentActivationGate_activation_code_key" ON "DeploymentActivationGate"("deploymentActivationId", "gateCode");
CREATE INDEX "DeploymentActivationGate_gate_bound_idx" ON "DeploymentActivationGate"("readinessGateId", "boundAt");
CREATE INDEX "DeploymentActivationGate_decision_idx" ON "DeploymentActivationGate"("readinessDecisionId");

ALTER TABLE "OperationalReadinessDecision" ADD CONSTRAINT "OperationalReadinessDecision_readinessGateId_fkey" FOREIGN KEY ("readinessGateId") REFERENCES "OperationalReadinessGate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalReadinessGate" ADD CONSTRAINT "OperationalReadinessGate_currentDecisionId_fkey" FOREIGN KEY ("currentDecisionId") REFERENCES "OperationalReadinessDecision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeploymentActivationGate" ADD CONSTRAINT "DeploymentActivationGate_deploymentActivationId_fkey" FOREIGN KEY ("deploymentActivationId") REFERENCES "DeploymentActivation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeploymentActivationGate" ADD CONSTRAINT "DeploymentActivationGate_readinessGateId_fkey" FOREIGN KEY ("readinessGateId") REFERENCES "OperationalReadinessGate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeploymentActivationGate" ADD CONSTRAINT "DeploymentActivationGate_readinessDecisionId_fkey" FOREIGN KEY ("readinessDecisionId") REFERENCES "OperationalReadinessDecision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
