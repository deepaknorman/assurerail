CREATE TABLE "EnterpriseIntegrationProfile" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "connectorRegistrationId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "connectorClass" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "materialFunctions" JSONB NOT NULL,
  "routeScope" JSONB NOT NULL,
  "dataClassification" TEXT NOT NULL,
  "serviceLevel" JSONB NOT NULL,
  "reconciliationPolicy" JSONB NOT NULL,
  "authorityPolicy" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "profileDigest" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestDigest" TEXT NOT NULL,
  "proposedByUserId" TEXT NOT NULL,
  "proposedByMandateId" TEXT NOT NULL,
  "proposalStepUpId" TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "reviewStepUpId" TEXT,
  "reviewReason" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnterpriseIntegrationProfile_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "EnterpriseIntegrationGate" (
  "id" TEXT NOT NULL,
  "enterpriseIntegrationProfileId" TEXT NOT NULL,
  "gateCode" TEXT NOT NULL,
  "gateKind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "accountableParty" TEXT NOT NULL,
  "developerConformanceRunId" TEXT,
  "evidenceObjectId" TEXT,
  "evidenceDigest" TEXT,
  "sourceAsOfAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "qualifications" JSONB NOT NULL,
  "recordedByUserId" TEXT,
  "recordedByMandateId" TEXT,
  "stepUpEvidenceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnterpriseIntegrationGate_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "EnterpriseCaseIntegrationBinding" (
  "id" TEXT NOT NULL,
  "transactionCaseId" TEXT NOT NULL,
  "enterpriseIntegrationProfileId" TEXT NOT NULL,
  "materialFunction" TEXT NOT NULL,
  "performerInstitutionId" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "authorityClass" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROPOSED',
  "idempotencyKey" TEXT NOT NULL,
  "requestDigest" TEXT NOT NULL,
  "proposedByUserId" TEXT NOT NULL,
  "proposedByMandateId" TEXT NOT NULL,
  "proposalStepUpId" TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "reviewStepUpId" TEXT,
  "reviewReason" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnterpriseCaseIntegrationBinding_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "EnterpriseIntegrationHealthObservation" (
  "id" TEXT NOT NULL,
  "enterpriseIntegrationProfileId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "observedStatus" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "sourceAsOfAt" TIMESTAMP(3) NOT NULL,
  "evidenceDigest" TEXT NOT NULL,
  "detail" JSONB NOT NULL,
  "recordedByUserId" TEXT NOT NULL,
  "recordedByMandateId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnterpriseIntegrationHealthObservation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EIP_connector_version_key" ON "EnterpriseIntegrationProfile"("connectorRegistrationId", "version");
CREATE UNIQUE INDEX "EIP_institution_idempotency_key" ON "EnterpriseIntegrationProfile"("institutionId", "idempotencyKey");
CREATE UNIQUE INDEX "EIP_institution_digest_key" ON "EnterpriseIntegrationProfile"("institutionId", "profileDigest");
CREATE INDEX "EIP_institution_class_status_idx" ON "EnterpriseIntegrationProfile"("institutionId", "connectorClass", "status");
CREATE UNIQUE INDEX "EIG_profile_code_key" ON "EnterpriseIntegrationGate"("enterpriseIntegrationProfileId", "gateCode");
CREATE INDEX "EIG_profile_status_idx" ON "EnterpriseIntegrationGate"("enterpriseIntegrationProfileId", "status");
CREATE INDEX "EIG_conformance_idx" ON "EnterpriseIntegrationGate"("developerConformanceRunId");
CREATE INDEX "EIG_evidence_idx" ON "EnterpriseIntegrationGate"("evidenceObjectId");
CREATE UNIQUE INDEX "ECIB_case_function_key" ON "EnterpriseCaseIntegrationBinding"("transactionCaseId", "materialFunction");
CREATE UNIQUE INDEX "ECIB_case_idempotency_key" ON "EnterpriseCaseIntegrationBinding"("transactionCaseId", "idempotencyKey");
CREATE INDEX "ECIB_profile_status_idx" ON "EnterpriseCaseIntegrationBinding"("enterpriseIntegrationProfileId", "status");
CREATE INDEX "ECIB_performer_status_idx" ON "EnterpriseCaseIntegrationBinding"("performerInstitutionId", "status");
CREATE UNIQUE INDEX "EIHO_profile_sequence_key" ON "EnterpriseIntegrationHealthObservation"("enterpriseIntegrationProfileId", "sequence");
CREATE UNIQUE INDEX "EIHO_profile_digest_key" ON "EnterpriseIntegrationHealthObservation"("enterpriseIntegrationProfileId", "evidenceDigest");
CREATE INDEX "EIHO_profile_asof_idx" ON "EnterpriseIntegrationHealthObservation"("enterpriseIntegrationProfileId", "sourceAsOfAt");
ALTER TABLE "EnterpriseIntegrationProfile" ADD CONSTRAINT "EnterpriseIntegrationProfile_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnterpriseIntegrationProfile" ADD CONSTRAINT "EIP_connector_fkey" FOREIGN KEY ("connectorRegistrationId") REFERENCES "ConnectorRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnterpriseIntegrationGate" ADD CONSTRAINT "EIG_profile_fkey" FOREIGN KEY ("enterpriseIntegrationProfileId") REFERENCES "EnterpriseIntegrationProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnterpriseIntegrationGate" ADD CONSTRAINT "EIG_conformance_fkey" FOREIGN KEY ("developerConformanceRunId") REFERENCES "DeveloperConformanceRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnterpriseIntegrationGate" ADD CONSTRAINT "EIG_evidence_fkey" FOREIGN KEY ("evidenceObjectId") REFERENCES "EvidenceObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnterpriseCaseIntegrationBinding" ADD CONSTRAINT "ECIB_case_fkey" FOREIGN KEY ("transactionCaseId") REFERENCES "TransactionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnterpriseCaseIntegrationBinding" ADD CONSTRAINT "ECIB_profile_fkey" FOREIGN KEY ("enterpriseIntegrationProfileId") REFERENCES "EnterpriseIntegrationProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnterpriseCaseIntegrationBinding" ADD CONSTRAINT "ECIB_performer_fkey" FOREIGN KEY ("performerInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnterpriseIntegrationHealthObservation" ADD CONSTRAINT "EIHO_profile_fkey" FOREIGN KEY ("enterpriseIntegrationProfileId") REFERENCES "EnterpriseIntegrationProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
