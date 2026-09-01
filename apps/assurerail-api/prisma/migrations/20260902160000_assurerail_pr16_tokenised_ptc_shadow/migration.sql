-- PR-16: separate tokenised PTC shadow representation. No table dispatches an external action.
CREATE TABLE "PtcTokenRepresentation" (
  "id" TEXT NOT NULL, "transactionCaseId" TEXT NOT NULL, "programmeReference" TEXT NOT NULL,
  "trustReference" TEXT NOT NULL, "classReference" TEXT NOT NULL, "trancheDefinitionDigest" TEXT NOT NULL,
  "trusteeInstitutionId" TEXT NOT NULL, "recordkeeperInstitutionId" TEXT NOT NULL,
  "assuranceProviderInstitutionId" TEXT, "authoritativeRecordDeclarationId" TEXT NOT NULL,
  "network" TEXT NOT NULL, "tokenId" TEXT NOT NULL, "authorityMode" TEXT NOT NULL DEFAULT 'MIRROR',
  "status" TEXT NOT NULL DEFAULT 'EVIDENCE_OPEN', "routePackRef" TEXT NOT NULL, "routePackVersion" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL, "requestDigest" TEXT NOT NULL, "proposedByUserId" TEXT NOT NULL,
  "proposedByMandateId" TEXT NOT NULL, "proposalStepUpId" TEXT NOT NULL,
  "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "reviewedByUserId" TEXT,
  "reviewedByMandateId" TEXT, "reviewStepUpId" TEXT, "reviewReason" TEXT, "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PtcTokenRepresentation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PtcTokenEvidenceGate" (
  "id" TEXT NOT NULL, "ptcTokenRepresentationId" TEXT NOT NULL, "gateCode" TEXT NOT NULL,
  "expectedEvidenceType" TEXT NOT NULL, "accountableInstitutionId" TEXT NOT NULL, "evidenceObjectId" TEXT,
  "evidenceDigest" TEXT, "status" TEXT NOT NULL DEFAULT 'OPEN', "qualification" TEXT,
  "sourceAsOfAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PtcTokenEvidenceGate_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PtcTokenActionPlan" (
  "id" TEXT NOT NULL, "ptcTokenRepresentationId" TEXT NOT NULL, "actionType" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL, "candidateCapabilityId" TEXT NOT NULL, "state" TEXT NOT NULL DEFAULT 'BLOCKED',
  "blockingGateCodes" JSONB NOT NULL, "planDigest" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PtcTokenActionPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PtcTokenRepresentation_transactionCaseId_key" ON "PtcTokenRepresentation"("transactionCaseId");
CREATE UNIQUE INDEX "PtcTokenRepresentation_transactionCaseId_idempotencyKey_key" ON "PtcTokenRepresentation"("transactionCaseId","idempotencyKey");
CREATE UNIQUE INDEX "PtcTokenRepresentation_network_tokenId_key" ON "PtcTokenRepresentation"("network","tokenId");
CREATE INDEX "PtcTokenRepresentation_trusteeInstitutionId_status_idx" ON "PtcTokenRepresentation"("trusteeInstitutionId","status");
CREATE INDEX "PtcTokenRepresentation_recordkeeperInstitutionId_status_idx" ON "PtcTokenRepresentation"("recordkeeperInstitutionId","status");
CREATE UNIQUE INDEX "PtcTokenEvidenceGate_ptcTokenRepresentationId_gateCode_key" ON "PtcTokenEvidenceGate"("ptcTokenRepresentationId","gateCode");
CREATE INDEX "PtcTokenEvidenceGate_status_expiresAt_idx" ON "PtcTokenEvidenceGate"("status","expiresAt");
CREATE INDEX "PtcTokenEvidenceGate_evidenceObjectId_idx" ON "PtcTokenEvidenceGate"("evidenceObjectId");
CREATE UNIQUE INDEX "PtcTokenActionPlan_ptcTokenRepresentationId_actionType_key" ON "PtcTokenActionPlan"("ptcTokenRepresentationId","actionType");
CREATE UNIQUE INDEX "PtcTokenActionPlan_ptcTokenRepresentationId_sequence_key" ON "PtcTokenActionPlan"("ptcTokenRepresentationId","sequence");
CREATE INDEX "PtcTokenActionPlan_ptcTokenRepresentationId_state_idx" ON "PtcTokenActionPlan"("ptcTokenRepresentationId","state");
ALTER TABLE "PtcTokenRepresentation" ADD CONSTRAINT "PtcTokenRepresentation_transactionCaseId_fkey" FOREIGN KEY ("transactionCaseId") REFERENCES "TransactionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PtcTokenRepresentation" ADD CONSTRAINT "PtcTokenRepresentation_trusteeInstitutionId_fkey" FOREIGN KEY ("trusteeInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PtcTokenRepresentation" ADD CONSTRAINT "PtcTokenRepresentation_recordkeeperInstitutionId_fkey" FOREIGN KEY ("recordkeeperInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PtcTokenRepresentation" ADD CONSTRAINT "PtcTokenRepresentation_assuranceProviderInstitutionId_fkey" FOREIGN KEY ("assuranceProviderInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PtcTokenRepresentation" ADD CONSTRAINT "PtcTokenRepresentation_authoritativeRecordDeclarationId_fkey" FOREIGN KEY ("authoritativeRecordDeclarationId") REFERENCES "AuthoritativeRecordDeclaration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PtcTokenEvidenceGate" ADD CONSTRAINT "PtcTokenEvidenceGate_ptcTokenRepresentationId_fkey" FOREIGN KEY ("ptcTokenRepresentationId") REFERENCES "PtcTokenRepresentation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PtcTokenEvidenceGate" ADD CONSTRAINT "PtcTokenEvidenceGate_evidenceObjectId_fkey" FOREIGN KEY ("evidenceObjectId") REFERENCES "EvidenceObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PtcTokenEvidenceGate" ADD CONSTRAINT "PtcTokenEvidenceGate_accountableInstitutionId_fkey" FOREIGN KEY ("accountableInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PtcTokenActionPlan" ADD CONSTRAINT "PtcTokenActionPlan_ptcTokenRepresentationId_fkey" FOREIGN KEY ("ptcTokenRepresentationId") REFERENCES "PtcTokenRepresentation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
