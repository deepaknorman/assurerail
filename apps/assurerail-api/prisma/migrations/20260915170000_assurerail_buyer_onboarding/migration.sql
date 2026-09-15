CREATE TABLE "BuyerWorkspace" (
  "id" TEXT PRIMARY KEY,
  "institutionId" TEXT NOT NULL UNIQUE REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "customerContractId" TEXT NOT NULL REFERENCES "CustomerContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'PENDING_MSA' CHECK ("status" IN ('PENDING_MSA','ACTIVE','SUSPENDED')),
  "signedMsaDigest" TEXT NOT NULL, "signedEvidenceRef" TEXT NOT NULL,
  "signatureReviewRef" TEXT, "proposedByUserId" TEXT NOT NULL, "verifiedByUserId" TEXT,
  "verifiedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("verifiedByUserId" IS NULL OR "verifiedByUserId" <> "proposedByUserId")
);
CREATE TABLE "BuyerRequirementsProfile" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "BuyerWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "version" INTEGER NOT NULL CHECK ("version" > 0), "revision" INTEGER NOT NULL DEFAULT 0 CHECK ("revision" >= 0),
  "status" TEXT NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT','SUBMITTED','APPROVED','REJECTED')),
  "criteria" JSONB NOT NULL, "digest" TEXT, "createdBy" TEXT NOT NULL, "submittedBy" TEXT,
  "submittedAt" TIMESTAMP(3), "approvals" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BuyerRequirementsProfile_workspaceId_version_key" UNIQUE ("workspaceId","version")
);

CREATE TABLE "BuyerOnboardingEvent" (
 "id" TEXT PRIMARY KEY, "workspaceId" TEXT NOT NULL REFERENCES "BuyerWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "actorUserId" TEXT NOT NULL, "event" TEXT NOT NULL, "detail" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "BuyerOnboardingEvent_workspaceId_createdAt_idx" ON "BuyerOnboardingEvent"("workspaceId", "createdAt");
