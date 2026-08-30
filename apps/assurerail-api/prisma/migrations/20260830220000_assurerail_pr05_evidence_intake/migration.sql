-- PR-05: provider-neutral evidence/document versions and connector certification.
-- Additive; legacy inline documents and mutable ingress rows remain readable during compatibility.

ALTER TABLE "Document" ALTER COLUMN "data" DROP NOT NULL;
ALTER TABLE "Document" ADD COLUMN "neutralDocumentVersionId" TEXT;
CREATE UNIQUE INDEX "Document_neutralDocumentVersionId_key" ON "Document"("neutralDocumentVersionId");

ALTER TABLE "IngestedPool" ADD COLUMN "neutralIntakeSubmissionId" TEXT;
CREATE UNIQUE INDEX "IngestedPool_neutralIntakeSubmissionId_key" ON "IngestedPool"("neutralIntakeSubmissionId");

ALTER TABLE "InstitutionEvidenceSnapshot" ADD COLUMN "evidenceVersionId" TEXT;
CREATE UNIQUE INDEX "InstitutionEvidenceSnapshot_evidenceVersionId_key" ON "InstitutionEvidenceSnapshot"("evidenceVersionId");

CREATE TABLE "ConnectorRegistration" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "providerReferenceId" TEXT,
  "connectorKey" TEXT NOT NULL,
  "connectorType" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "transport" TEXT NOT NULL,
  "endpoint" TEXT,
  "schemaProfiles" JSONB NOT NULL,
  "credentialVaultRef" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING_CERTIFICATION',
  "createdByUserId" TEXT NOT NULL,
  "suspendedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConnectorRegistration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConnectorCertification" (
  "id" TEXT NOT NULL,
  "connectorRegistrationId" TEXT NOT NULL,
  "profileRef" TEXT NOT NULL,
  "schemaId" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "operatingMode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROPOSED',
  "conformanceEvidenceDigest" TEXT NOT NULL,
  "conformanceResult" JSONB NOT NULL,
  "qualifications" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "proposedByUserId" TEXT NOT NULL,
  "proposalStepUpId" TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "reviewStepUpId" TEXT,
  "reviewReason" TEXT,
  "effectiveAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConnectorCertification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EvidenceObject" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "transactionCaseId" TEXT,
  "evidenceType" TEXT NOT NULL,
  "classification" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "currentVersion" INTEGER NOT NULL DEFAULT 0,
  "retentionUntilAt" TIMESTAMP(3) NOT NULL,
  "legalHold" BOOLEAN NOT NULL DEFAULT false,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvidenceObject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EvidenceVersion" (
  "id" TEXT NOT NULL,
  "evidenceObjectId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "providerReferenceId" TEXT,
  "intakeSubmissionId" TEXT,
  "schemaId" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "payloadDigest" TEXT NOT NULL,
  "signatureStatus" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "sourceAsOfAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "qualifications" JSONB NOT NULL,
  "validationStatus" TEXT NOT NULL,
  "validationDetail" JSONB NOT NULL,
  "supersedesVersionId" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvidenceVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RailDocumentFamily" (
  "id" TEXT NOT NULL,
  "evidenceObjectId" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "transactionCaseId" TEXT,
  "title" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "currentVersion" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RailDocumentFamily_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RailDocumentVersion" (
  "id" TEXT NOT NULL,
  "documentFamilyId" TEXT NOT NULL,
  "evidenceVersionId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "filename" TEXT NOT NULL,
  "claimedContentType" TEXT NOT NULL,
  "detectedContentType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "storageRef" TEXT NOT NULL,
  "malwareStatus" TEXT NOT NULL,
  "malwareEngine" TEXT,
  "malwareSignature" TEXT,
  "encryptionClass" TEXT NOT NULL,
  "objectVersionRef" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RailDocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EvidenceAccessGrant" (
  "id" TEXT NOT NULL,
  "evidenceObjectId" TEXT NOT NULL,
  "granteeInstitutionId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "classification" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3),
  "grantedByUserId" TEXT NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvidenceAccessGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EvidenceAccessReceipt" (
  "id" TEXT NOT NULL,
  "evidenceObjectId" TEXT NOT NULL,
  "evidenceVersionId" TEXT,
  "actorUserId" TEXT NOT NULL,
  "actingInstitutionId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "requestDigest" TEXT NOT NULL,
  "receiptDigest" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvidenceAccessReceipt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EvidenceRetentionEvent" (
  "id" TEXT NOT NULL,
  "evidenceObjectId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "stepUpEvidenceId" TEXT NOT NULL,
  "priorLegalHold" BOOLEAN NOT NULL,
  "resultingLegalHold" BOOLEAN NOT NULL,
  "eventDigest" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvidenceRetentionEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConnectorRegistration_institutionId_connectorKey_key" ON "ConnectorRegistration"("institutionId", "connectorKey");
CREATE INDEX "ConnectorRegistration_institutionId_status_idx" ON "ConnectorRegistration"("institutionId", "status");
CREATE INDEX "ConnectorRegistration_providerReferenceId_idx" ON "ConnectorRegistration"("providerReferenceId");
CREATE UNIQUE INDEX "ConnectorCertification_evidence_key" ON "ConnectorCertification"("connectorRegistrationId", "profileRef", "schemaVersion", "operatingMode", "conformanceEvidenceDigest");
CREATE INDEX "ConnectorCertification_connectorRegistrationId_status_idx" ON "ConnectorCertification"("connectorRegistrationId", "status");
CREATE INDEX "ConnectorCertification_expiresAt_idx" ON "ConnectorCertification"("expiresAt");
CREATE INDEX "EvidenceObject_institutionId_transactionCaseId_idx" ON "EvidenceObject"("institutionId", "transactionCaseId");
CREATE INDEX "EvidenceObject_institutionId_status_idx" ON "EvidenceObject"("institutionId", "status");
CREATE INDEX "EvidenceObject_retentionUntilAt_idx" ON "EvidenceObject"("retentionUntilAt");
CREATE UNIQUE INDEX "EvidenceVersion_intakeSubmissionId_key" ON "EvidenceVersion"("intakeSubmissionId");
CREATE UNIQUE INDEX "EvidenceVersion_evidenceObjectId_version_key" ON "EvidenceVersion"("evidenceObjectId", "version");
CREATE UNIQUE INDEX "EvidenceVersion_evidenceObjectId_payloadDigest_key" ON "EvidenceVersion"("evidenceObjectId", "payloadDigest");
CREATE INDEX "EvidenceVersion_providerReferenceId_idx" ON "EvidenceVersion"("providerReferenceId");
CREATE INDEX "EvidenceVersion_payloadDigest_idx" ON "EvidenceVersion"("payloadDigest");
CREATE INDEX "EvidenceVersion_expiresAt_idx" ON "EvidenceVersion"("expiresAt");
CREATE UNIQUE INDEX "RailDocumentFamily_evidenceObjectId_key" ON "RailDocumentFamily"("evidenceObjectId");
CREATE INDEX "RailDocumentFamily_institutionId_transactionCaseId_idx" ON "RailDocumentFamily"("institutionId", "transactionCaseId");
CREATE UNIQUE INDEX "RailDocumentVersion_evidenceVersionId_key" ON "RailDocumentVersion"("evidenceVersionId");
CREATE UNIQUE INDEX "RailDocumentVersion_storageRef_key" ON "RailDocumentVersion"("storageRef");
CREATE UNIQUE INDEX "RailDocumentVersion_documentFamilyId_version_key" ON "RailDocumentVersion"("documentFamilyId", "version");
CREATE INDEX "RailDocumentVersion_malwareStatus_idx" ON "RailDocumentVersion"("malwareStatus");
CREATE UNIQUE INDEX "EvidenceAccessGrant_object_grantee_purpose_key" ON "EvidenceAccessGrant"("evidenceObjectId", "granteeInstitutionId", "purpose");
CREATE INDEX "EvidenceAccessGrant_granteeInstitutionId_status_idx" ON "EvidenceAccessGrant"("granteeInstitutionId", "status");
CREATE INDEX "EvidenceAccessGrant_expiresAt_idx" ON "EvidenceAccessGrant"("expiresAt");
CREATE UNIQUE INDEX "EvidenceAccessReceipt_receiptDigest_key" ON "EvidenceAccessReceipt"("receiptDigest");
CREATE INDEX "EvidenceAccessReceipt_evidenceObjectId_occurredAt_idx" ON "EvidenceAccessReceipt"("evidenceObjectId", "occurredAt");
CREATE INDEX "EvidenceAccessReceipt_actingInstitutionId_occurredAt_idx" ON "EvidenceAccessReceipt"("actingInstitutionId", "occurredAt");
CREATE UNIQUE INDEX "EvidenceRetentionEvent_eventDigest_key" ON "EvidenceRetentionEvent"("eventDigest");
CREATE INDEX "EvidenceRetentionEvent_evidenceObjectId_occurredAt_idx" ON "EvidenceRetentionEvent"("evidenceObjectId", "occurredAt");

ALTER TABLE "ConnectorRegistration" ADD CONSTRAINT "ConnectorRegistration_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConnectorRegistration" ADD CONSTRAINT "ConnectorRegistration_providerReferenceId_fkey" FOREIGN KEY ("providerReferenceId") REFERENCES "ProviderReference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConnectorCertification" ADD CONSTRAINT "ConnectorCertification_connectorRegistrationId_fkey" FOREIGN KEY ("connectorRegistrationId") REFERENCES "ConnectorRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvidenceObject" ADD CONSTRAINT "EvidenceObject_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvidenceVersion" ADD CONSTRAINT "EvidenceVersion_evidenceObjectId_fkey" FOREIGN KEY ("evidenceObjectId") REFERENCES "EvidenceObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvidenceVersion" ADD CONSTRAINT "EvidenceVersion_providerReferenceId_fkey" FOREIGN KEY ("providerReferenceId") REFERENCES "ProviderReference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvidenceVersion" ADD CONSTRAINT "EvidenceVersion_intakeSubmissionId_fkey" FOREIGN KEY ("intakeSubmissionId") REFERENCES "IntakeSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InstitutionEvidenceSnapshot" ADD CONSTRAINT "InstitutionEvidenceSnapshot_evidenceVersionId_fkey" FOREIGN KEY ("evidenceVersionId") REFERENCES "EvidenceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RailDocumentFamily" ADD CONSTRAINT "RailDocumentFamily_evidenceObjectId_fkey" FOREIGN KEY ("evidenceObjectId") REFERENCES "EvidenceObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RailDocumentFamily" ADD CONSTRAINT "RailDocumentFamily_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RailDocumentVersion" ADD CONSTRAINT "RailDocumentVersion_documentFamilyId_fkey" FOREIGN KEY ("documentFamilyId") REFERENCES "RailDocumentFamily"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RailDocumentVersion" ADD CONSTRAINT "RailDocumentVersion_evidenceVersionId_fkey" FOREIGN KEY ("evidenceVersionId") REFERENCES "EvidenceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvidenceAccessGrant" ADD CONSTRAINT "EvidenceAccessGrant_evidenceObjectId_fkey" FOREIGN KEY ("evidenceObjectId") REFERENCES "EvidenceObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvidenceAccessReceipt" ADD CONSTRAINT "EvidenceAccessReceipt_evidenceObjectId_fkey" FOREIGN KEY ("evidenceObjectId") REFERENCES "EvidenceObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvidenceAccessReceipt" ADD CONSTRAINT "EvidenceAccessReceipt_evidenceVersionId_fkey" FOREIGN KEY ("evidenceVersionId") REFERENCES "EvidenceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvidenceRetentionEvent" ADD CONSTRAINT "EvidenceRetentionEvent_evidenceObjectId_fkey" FOREIGN KEY ("evidenceObjectId") REFERENCES "EvidenceObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
