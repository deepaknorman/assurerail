ALTER TABLE "InstitutionServicePrincipal"
  ADD COLUMN "displayName" TEXT NOT NULL DEFAULT 'Legacy service principal',
  ADD COLUMN "credentialFingerprint" TEXT,
  ADD COLUMN "proposedByUserId" TEXT,
  ADD COLUMN "proposalStepUpId" TEXT,
  ADD COLUMN "approvedByUserId" TEXT,
  ADD COLUMN "approvalStepUpId" TEXT,
  ADD COLUMN "approvalReason" TEXT;

CREATE TABLE "InstitutionIdentityConnection" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "connectionKey" TEXT NOT NULL,
  "protocol" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "issuer" TEXT NOT NULL,
  "audience" TEXT NOT NULL,
  "metadataDigest" TEXT NOT NULL,
  "emailDomains" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROPOSED',
  "proposedByUserId" TEXT NOT NULL,
  "proposalStepUpId" TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "reviewStepUpId" TEXT,
  "reviewReason" TEXT,
  "effectiveAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstitutionIdentityConnection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InstitutionIdentityConnection_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "InstitutionIdentityConnection_institutionId_connectionKey_key" ON "InstitutionIdentityConnection"("institutionId", "connectionKey");
CREATE INDEX "InstitutionIdentityConnection_institutionId_status_idx" ON "InstitutionIdentityConnection"("institutionId", "status");
CREATE INDEX "InstitutionIdentityConnection_expiresAt_idx" ON "InstitutionIdentityConnection"("expiresAt");

CREATE TABLE "InstitutionAccessReview" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "reviewRef" TEXT NOT NULL,
  "scope" JSONB NOT NULL,
  "evidenceRefs" JSONB NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROPOSED',
  "conclusion" TEXT,
  "proposedByUserId" TEXT NOT NULL,
  "proposalStepUpId" TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "reviewStepUpId" TEXT,
  "reviewReason" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstitutionAccessReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InstitutionAccessReview_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "InstitutionAccessReview_institutionId_reviewRef_key" ON "InstitutionAccessReview"("institutionId", "reviewRef");
CREATE INDEX "InstitutionAccessReview_institutionId_status_dueAt_idx" ON "InstitutionAccessReview"("institutionId", "status", "dueAt");

CREATE TABLE "InstitutionExitPlan" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "exitRef" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "requestedEffectiveAt" TIMESTAMP(3) NOT NULL,
  "scope" JSONB NOT NULL,
  "evidenceRefs" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROPOSED',
  "proposedByUserId" TEXT NOT NULL,
  "proposalStepUpId" TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "reviewStepUpId" TEXT,
  "reviewReason" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstitutionExitPlan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InstitutionExitPlan_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "InstitutionExitPlan_institutionId_exitRef_key" ON "InstitutionExitPlan"("institutionId", "exitRef");
CREATE INDEX "InstitutionExitPlan_institutionId_status_idx" ON "InstitutionExitPlan"("institutionId", "status");
CREATE INDEX "InstitutionExitPlan_requestedEffectiveAt_idx" ON "InstitutionExitPlan"("requestedEffectiveAt");
