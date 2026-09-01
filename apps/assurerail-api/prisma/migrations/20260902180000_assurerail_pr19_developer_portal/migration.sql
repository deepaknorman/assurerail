CREATE TABLE "DeveloperClientRegistration" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "clientKey" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "allowedActions" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SHADOW_ONLY',
  "currentCredentialVersion" INTEGER NOT NULL DEFAULT 0,
  "createdByUserId" TEXT NOT NULL,
  "createdByMandateId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeveloperClientRegistration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeveloperClientRegistration_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DeveloperClientRegistration_institution_key" ON "DeveloperClientRegistration"("institutionId", "clientKey");
CREATE INDEX "DeveloperClientRegistration_institutionId_status_idx" ON "DeveloperClientRegistration"("institutionId", "status");

CREATE TABLE "DeveloperCredentialVersion" (
  "id" TEXT NOT NULL,
  "developerClientId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "credentialVaultRef" TEXT NOT NULL,
  "credentialFingerprint" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE_SHADOW',
  "reason" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdByMandateId" TEXT NOT NULL,
  "stepUpEvidenceId" TEXT NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "supersededAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeveloperCredentialVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeveloperCredentialVersion_developerClientId_fkey" FOREIGN KEY ("developerClientId") REFERENCES "DeveloperClientRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DeveloperCredentialVersion_client_version" ON "DeveloperCredentialVersion"("developerClientId", "version");
CREATE UNIQUE INDEX "DeveloperCredentialVersion_client_fingerprint" ON "DeveloperCredentialVersion"("developerClientId", "credentialFingerprint");
CREATE INDEX "DeveloperCredentialVersion_status_expiresAt_idx" ON "DeveloperCredentialVersion"("status", "expiresAt");

CREATE TABLE "DeveloperConformanceRun" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "connectorRegistrationId" TEXT NOT NULL,
  "fixtureSetVersion" TEXT NOT NULL,
  "schemaProfileRef" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "assertions" JSONB NOT NULL,
  "inputDigest" TEXT NOT NULL,
  "resultDigest" TEXT NOT NULL,
  "sandboxNonEvidence" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT NOT NULL,
  "createdByMandateId" TEXT NOT NULL,
  "stepUpEvidenceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeveloperConformanceRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeveloperConformanceRun_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DeveloperConformanceRun_connectorRegistrationId_fkey" FOREIGN KEY ("connectorRegistrationId") REFERENCES "ConnectorRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "DeveloperConformanceRun_scope_time" ON "DeveloperConformanceRun"("institutionId", "connectorRegistrationId", "createdAt");

CREATE TABLE "IntegrationExitExport" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "exportVersion" TEXT NOT NULL,
  "scope" JSONB NOT NULL,
  "recordCounts" JSONB NOT NULL,
  "manifestDigest" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "requestedByMandateId" TEXT NOT NULL,
  "stepUpEvidenceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationExitExport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IntegrationExitExport_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "IntegrationExitExport_institutionId_createdAt_idx" ON "IntegrationExitExport"("institutionId", "createdAt");
